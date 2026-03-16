import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";

const host = "127.0.0.1";
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate free port")));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
const port = await getFreePort();
const baseUrl = `http://${host}:${port}`;
const proofRoot = path.join(process.cwd(), ".runtime", "transcription-web-proof");
const fixtureRoot = path.join(proofRoot, "fixtures");
const proofFile = path.join(proofRoot, "transcription-web-regression.json");
const screenshotFile = path.join(proofRoot, "transcription-web-regression.png");
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];
const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
const pythonExe = path.resolve(process.cwd(), "..", ".venv311-strict", "Scripts", "python.exe");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = (target, method = "GET", headers = {}, body = undefined, attempt = 0) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const request = http.request(
      `${baseUrl}${target}`,
      {
        method,
        headers: {
          ...headers,
          ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {})
        },
        timeout: 1_200_000
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = data.length ? JSON.parse(data) : {};
            resolve({ statusCode: response.statusCode ?? 0, body: parsed });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error(`request timeout for ${target}`)));
    request.on("error", async (error) => {
      if (attempt < 3 && ["ECONNRESET", "ECONNREFUSED"].includes(error.code ?? "")) {
        await wait(1000 * (attempt + 1));
        try {
          resolve(await requestJson(target, method, headers, body, attempt + 1));
        } catch (retryError) {
          reject(retryError);
        }
        return;
      }
      reject(error);
    });
    if (payload) request.write(payload);
    request.end();
  });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await wait(500);
  }
  throw new Error("transcription web server did not start");
};
const stopServer = () => {
  if (server.exitCode !== null || server.killed) return;
  if (process.platform === "win32") {
    server.kill();
    try {
      spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
    return;
  }
  server.kill("SIGTERM");
};

const runPowerShell = (script) => {
  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "PowerShell command failed");
  }
};

const runPython = (script) => {
  const result = spawnSync(pythonExe, ["-c", script], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Python command failed");
  }
};

const createWorkbook = async (targetPath, rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Extracted");
  rows.forEach((row) => sheet.addRow(row));
  await workbook.xlsx.writeFile(targetPath);
};

const createFixtures = async () => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const audioPath = path.join(fixtureRoot, "meeting-audio.wav");
  const videoPath = path.join(fixtureRoot, "meeting-video.mp4");
  const textImagePath = path.join(fixtureRoot, "text-image.png");
  const tableImagePath = path.join(fixtureRoot, "table-image.png");
  const scannedPdfPath = path.join(fixtureRoot, "scanned-document.pdf");
  const revisedPdfPath = path.join(fixtureRoot, "revised-document.pdf");
  const workbookPath = path.join(fixtureRoot, "evidence-workbook.xlsx");
  const revisedWorkbookPath = path.join(fixtureRoot, "revised-workbook.xlsx");

  runPowerShell(`
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SetOutputToWaveFile('${audioPath.replace(/'/g, "''")}')
    $ssml = "<speak version='1.0' xml:lang='en-US'><voice name='Microsoft Zira Desktop'>Revenue totaled 125 dollars on March 5 2026.</voice><break time='1200ms'/><voice name='Microsoft Hazel Desktop'>Action required: review invoice INV 204 before March 7 2026.</voice></speak>"
    $synth.SpeakSsml($ssml)
    $synth.Dispose()
  `);

  runPython(`
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg, subprocess
root = Path(r"""${fixtureRoot}""")
root.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default()
text_img = Image.new("RGB", (1200, 700), "white")
draw = ImageDraw.Draw(text_img)
draw.text((40, 40), "Executive Summary\\nDate: 2026-03-05\\nInvoice: INV-204\\nAmount: USD 125\\nOwner: Noura", fill="black", font=font, spacing=20)
text_img.save(root / "text-image.png")
table_img = Image.new("RGB", (1200, 700), "white")
draw = ImageDraw.Draw(table_img)
headers = ["Region", "Cases", "Amount"]
rows = [["Riyadh", "8", "125"], ["Jeddah", "3", "90"], ["Dammam", "2", "65"]]
for index, header in enumerate(headers):
    x = 50 + index * 220
    draw.rectangle((x, 60, x + 200, 120), outline="black", width=2)
    draw.text((x + 10, 80), header, fill="black", font=font)
for row_index, row in enumerate(rows):
    for col_index, value in enumerate(row):
        x = 50 + col_index * 220
        y = 120 + row_index * 70
        draw.rectangle((x, y, x + 200, y + 70), outline="black", width=2)
        draw.text((x + 10, y + 25), value, fill="black", font=font)
table_img.save(root / "table-image.png")
text_img.save(root / "scanned-document.pdf", "PDF", resolution=150.0)
revised = Image.new("RGB", (1200, 700), "white")
draw = ImageDraw.Draw(revised)
draw.text((40, 40), "Executive Summary\\nDate: 2026-03-06\\nInvoice: INV-305\\nAmount: USD 190\\nOwner: Amal", fill="black", font=font, spacing=20)
revised.save(root / "revised-document.pdf", "PDF", resolution=150.0)
poster = Image.new("RGB", (1280, 720), "#f4efe6")
draw = ImageDraw.Draw(poster)
draw.text((120, 140), "Video Evidence\\nRevenue totaled 125 dollars.\\nReview invoice INV 204.", fill="#10243b", font=font, spacing=24)
poster_path = root / "video-poster.png"
poster.save(poster_path)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ffmpeg, "-y", "-loop", "1", "-i", str(poster_path), "-i", str(root / "meeting-audio.wav"), "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(root / "meeting-video.mp4")], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
`);

  await createWorkbook(workbookPath, [
    ["Region", "CaseId", "Amount", "Date"],
    ["Riyadh", "INV-204", 125, "2026-03-05"],
    ["Jeddah", "INV-201", 90, "2026-03-04"]
  ]);
  await createWorkbook(revisedWorkbookPath, [
    ["Region", "CaseId", "Amount", "Date"],
    ["Riyadh", "INV-305", 190, "2026-03-06"],
    ["Dammam", "INV-206", 75, "2026-03-03"]
  ]);

  return { audioPath, videoPath, textImagePath, tableImagePath, scannedPdfPath, revisedPdfPath, workbookPath, revisedWorkbookPath };
};

const toUploadPayload = (paths) =>
  paths.map((filePath) => ({
    file_name: path.basename(filePath),
    media_type: filePayload(filePath).mimeType,
    content_base64: fs.readFileSync(filePath).toString("base64")
  }));

const filePayload = (filePath) => ({
  name: path.basename(filePath),
  mimeType:
    filePath.endsWith(".wav") ? "audio/wav" :
    filePath.endsWith(".mp4") ? "video/mp4" :
    filePath.endsWith(".pdf") ? "application/pdf" :
    filePath.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
    "image/png"
});

const server = spawn("node", ["apps/contracts-cli/dist/index.js", "transcription-serve-web"], {
  cwd: process.cwd(),
  env: { ...process.env, RASID_TRANSCRIPTION_WEB_PORT: String(port) },
  stdio: "ignore"
});
let browser;
let exitCode = 0;

try {
  fs.mkdirSync(proofRoot, { recursive: true });
  const fixtures = await createFixtures();
  await waitForServer();

  browser = await chromium.launch(chromePath ? { executablePath: chromePath, headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="email"]', { timeout: 120000 });
  await page.fill('input[name="email"]', "admin");
  await page.fill('input[name="password"]', "1500");
  await page.fill('input[name="tenant_ref"]', "tenant-transcription-web");
  await page.click('button');
  await page.waitForURL(`${baseUrl}/transcription`);
  await page.locator("#file-input").setInputFiles([
    fixtures.audioPath,
    fixtures.videoPath,
    fixtures.scannedPdfPath,
    fixtures.tableImagePath,
    fixtures.workbookPath
  ]);
  await page.click("#start-job");
  await page.waitForFunction(() => {
    const status = document.querySelector("#upload-status")?.textContent ?? "";
    return status.includes("Job created:") || status.includes("Failed");
  }, null, { timeout: 1_200_000 });
  await page.waitForFunction(() => {
    const verification = document.querySelector("#verification")?.textContent ?? "";
    return verification.includes('"exact": true');
  }, null, { timeout: 1_200_000 });
  await page.waitForFunction(() => {
    const transcript = document.querySelector("#transcript")?.textContent ?? "";
    const visualProof = document.querySelector("#visual-proof")?.textContent ?? "";
    return transcript.length > 20 && visualProof.includes('"disagreements": []');
  }, null, { timeout: 600000 });

  const uploadStatus = await page.locator("#upload-status").textContent();
  const firstJobId = uploadStatus?.match(/Job created:\s+(\S+)/)?.[1];
  if (!firstJobId) throw new Error(`failed to read created job id from upload status: ${uploadStatus ?? "missing"}`);

  const loginResponse = await requestJson("/api/v1/governance/auth/login", "POST", {}, {
    email: "admin",
    password: "1500",
    tenant_ref: "tenant-transcription-web",
    workspace_id: "workspace-transcription-web",
    project_id: "project-transcription-web"
  });
  const token = loginResponse.body.data.accessToken;
  const api = async (target, method = "GET", body = undefined) => {
    const response = await requestJson(
      target,
      method,
      { authorization: `Bearer ${token}`, "x-tenant-ref": "tenant-transcription-web" },
      body
    );
    return response.body;
  };

  const secondJob = await api("/api/v1/transcription/jobs/start", "POST", {
    mode: "advanced",
    files: toUploadPayload([fixtures.revisedPdfPath, fixtures.revisedWorkbookPath])
  });
  const secondJobId = secondJob.job.job_id;
  const firstJob = await api(`/api/v1/transcription/jobs/${encodeURIComponent(firstJobId)}`);
  const secondJobSnapshot = await api(`/api/v1/transcription/jobs/${encodeURIComponent(secondJobId)}`);
  const compare = await api("/api/v1/transcription/compare", "POST", {
    left_bundle_ref: firstJob.bundle.bundle_id,
    right_bundle_ref: secondJobSnapshot.bundle.bundle_id
  });
  const answer = await api("/api/v1/transcription/question", "POST", {
    bundle_refs: [firstJob.bundle.bundle_id],
    question: "What appeared in the PDF and not in the Excel?",
    compare_mode: true
  });

  await page.click("#refresh-jobs");
  await page.waitForFunction(
    (targetJobId) => [...document.querySelectorAll("button.job")].some((entry) => (entry.textContent ?? "").includes(targetJobId)),
    firstJobId,
    { timeout: 120000 }
  );
  await page.selectOption("#compare-left", firstJobId);
  await page.selectOption("#compare-right", secondJobId);
  await page.click("#run-compare");
  await page.waitForFunction(() => (document.querySelector("#compare-output")?.textContent ?? "").includes("compare_id"), null, { timeout: 120000 });
  await page.fill("#question", "What appeared in the PDF and not in the Excel?");
  await page.locator("#ask-question").click({ force: true });
  await page.waitForFunction(() => (document.querySelector("#answer-output")?.textContent ?? "").includes("only:"), null, { timeout: 120000 });
  await page.screenshot({ path: screenshotFile, fullPage: true });
  await browser.close();

  const proof = {
    created_at: new Date().toISOString(),
    base_url: baseUrl,
    screenshot: screenshotFile,
    first_job_id: firstJobId,
    second_job_id: secondJobId,
    first_bundle_id: firstJob.bundle.bundle_id,
    first_source_kinds: firstJob.bundle.sources.map((source) => source.input_kind),
    first_segment_count: firstJob.bundle.segments.length,
    first_table_count: firstJob.bundle.tables.length,
    first_field_count: firstJob.bundle.fields.length,
    first_entity_count: firstJob.bundle.entities.length,
    first_aligned_word_count: firstJob.bundle.aligned_words.length,
    first_on_screen_text_count: firstJob.bundle.on_screen_text.length,
    first_disagreement_count: firstJob.bundle.disagreements.length,
    first_verification_gate: firstJob.bundle.verification_gate,
    ui_upload_status: uploadStatus,
    first_summary_levels: firstJob.bundle.summaries.map((summary) => summary.level),
    first_qa_seed_count: firstJob.bundle.qa_seeds.length,
    first_audit_count: firstJob.audit.length,
    first_lineage_count: firstJob.lineage.length,
    compare_summary: compare.compareResult.summary,
    compare_changed_refs: compare.compareResult.changed_refs.length,
    answer_text: answer.answer.answer_text,
    answer_citations: answer.answer.cited_source_refs
  };

  if (!proof.first_source_kinds.includes("audio_file")) throw new Error("audio source was not processed");
  if (!proof.first_source_kinds.includes("video_file")) throw new Error("video source was not processed");
  if (!proof.first_source_kinds.includes("pdf") && !proof.first_source_kinds.includes("scanned_document")) {
    throw new Error("pdf source was not processed");
  }
  if (!proof.first_source_kinds.includes("spreadsheet_file")) throw new Error("spreadsheet source was not processed");
  if (proof.first_segment_count < 4) throw new Error("segment count is too low");
  if (proof.first_table_count < 2) throw new Error("table extraction did not execute");
  if (proof.first_field_count < 3 || proof.first_entity_count < 3) throw new Error("structured extraction is too sparse");
  if (proof.first_aligned_word_count < 3) throw new Error("forced-alignment-style word timestamps are missing");
  if (proof.first_on_screen_text_count < 1) throw new Error("video on-screen OCR did not execute");
  if (typeof proof.first_verification_gate?.exact !== "boolean") throw new Error("verification gate missing");
  if (proof.first_verification_gate?.exact !== true) throw new Error("verification gate did not close");
  if ((proof.first_verification_gate?.warning_codes ?? []).length > 0) throw new Error("verification gate still carries blocking warnings");
  if (!proof.first_summary_levels.includes("executive")) throw new Error("executive summary missing");
  if (proof.first_qa_seed_count < 2) throw new Error("qa seed generation missing");
  if (proof.first_audit_count < 2 || proof.first_lineage_count < 2) throw new Error("audit or lineage proof missing");
  if (proof.compare_changed_refs < 1) throw new Error("compare output is empty");
  if (!/only:/i.test(proof.answer_text)) throw new Error("question answering did not produce compare-style answer");

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} catch (error) {
  exitCode = 1;
  throw error;
} finally {
  try {
    await browser?.close();
  } catch {}
  stopServer();
  await wait(500);
  process.exit(exitCode);
}
