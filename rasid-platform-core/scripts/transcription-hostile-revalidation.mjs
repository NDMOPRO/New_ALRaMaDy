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
const proofRoot = path.join(process.cwd(), ".runtime", "transcription-hostile-proof");
const fixtureRoot = path.join(proofRoot, "fixtures");
const proofFile = path.join(proofRoot, "transcription-hostile-revalidation.json");
const screenshotFile = path.join(proofRoot, "transcription-hostile-revalidation.png");
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];
const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
const pythonExe = path.resolve(process.cwd(), "..", ".venv311-strict", "Scripts", "python.exe");

const hostileStartedAt = Date.now();
const tenantRef = `tenant-transcription-hostile-${hostileStartedAt}`;
const workspaceId = `workspace-transcription-hostile-${hostileStartedAt}`;
const projectId = `project-transcription-hostile-${hostileStartedAt}`;

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
        timeout: 600_000
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
    } catch {}
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

const ensureFixtures = async () => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const audioPath = path.join(fixtureRoot, "meeting-audio.wav");
  const videoPath = path.join(fixtureRoot, "meeting-video.mp4");
  const tableImagePath = path.join(fixtureRoot, "table-image.png");
  const scannedPdfPath = path.join(fixtureRoot, "scanned-document.pdf");
  const workbookPath = path.join(fixtureRoot, "evidence-workbook.xlsx");

  if ([audioPath, videoPath, tableImagePath, scannedPdfPath, workbookPath].every((filePath) => fs.existsSync(filePath))) {
    return { audioPath, videoPath, tableImagePath, scannedPdfPath, workbookPath };
  }

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
text_img = Image.new("RGB", (1200, 700), "white")
draw = ImageDraw.Draw(text_img)
draw.text((40, 40), "Executive Summary\\nDate: 2026-03-05\\nInvoice: INV-204\\nAmount: USD 125\\nOwner: Noura", fill="black", font=font, spacing=20)
text_img.save(root / "scanned-document.pdf", "PDF", resolution=150.0)
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

  return { audioPath, videoPath, tableImagePath, scannedPdfPath, workbookPath };
};

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
  const fixtures = await ensureFixtures();
  await waitForServer();

  browser = await chromium.launch(chromePath ? { executablePath: chromePath, headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="email"]', { timeout: 120000 });
  await page.fill('input[name="email"]', "admin");
  await page.fill('input[name="password"]', "1500");
  await page.fill('input[name="tenant_ref"]', tenantRef);
  await page.click("button");
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
  }, null, { timeout: 900000 });
  const uploadStatus = await page.locator("#upload-status").textContent();
  const jobId = uploadStatus?.match(/Job created:\s+(\S+)/)?.[1];
  if (!jobId) throw new Error(`failed to parse job id from upload status: ${uploadStatus ?? "missing"}`);
  await page.waitForFunction(() => {
    const verification = document.querySelector("#verification")?.textContent ?? "";
    return verification.includes('"exact": true') && verification.includes('"warning_codes": []');
  }, null, { timeout: 900000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#refresh-jobs", { timeout: 120000 });
  await page.click("#refresh-jobs");
  await page.waitForFunction(
    (expectedJobId) => [...document.querySelectorAll("button.job")].some((button) => (button.textContent ?? "").includes(expectedJobId)),
    jobId,
    { timeout: 120000 }
  );
  await page.locator(`button.job:has-text("${jobId}")`).click();
  await page.waitForFunction(() => {
    const verification = document.querySelector("#verification")?.textContent ?? "";
    const visualProof = document.querySelector("#visual-proof")?.textContent ?? "";
    return verification.includes('"exact": true') && visualProof.includes('"disagreements": []');
  }, null, { timeout: 120000 });
  await page.screenshot({ path: screenshotFile, fullPage: true });
  const screenshotStats = fs.statSync(screenshotFile);

  const loginResponse = await requestJson("/api/v1/governance/auth/login", "POST", {}, {
    email: "admin",
    password: "1500",
    tenant_ref: tenantRef,
    workspace_id: workspaceId,
    project_id: projectId
  });
  const token = loginResponse.body.data.accessToken;
  const apiResponse = await requestJson(
    `/api/v1/transcription/jobs/${encodeURIComponent(jobId)}`,
    "GET",
    { authorization: `Bearer ${token}`, "x-tenant-ref": tenantRef }
  );
  const payload = apiResponse.body;
  const bundle = payload.bundle;
  const jobRoot = path.join(process.cwd(), ".runtime", "transcription-web", "transcription-engine", "jobs", jobId);
  const verificationArtifactPath = path.join(jobRoot, "artifacts", "verification-artifact.json");
  const alignmentArtifactPath = path.join(jobRoot, "artifacts", "alignment-artifact.json");
  const exactnessAuditPath = path.join(jobRoot, "audit", `audit-${jobId}-transcription-exactness_gate-v1-verification.json`);
  const lineagePath = path.join(jobRoot, "lineage", `edge-${bundle.bundle_id}-${bundle.verification_gate.gate_id}.json`);

  const verificationArtifact = JSON.parse(fs.readFileSync(verificationArtifactPath, "utf8"));
  const alignmentArtifact = JSON.parse(fs.readFileSync(alignmentArtifactPath, "utf8"));
  const exactnessAudit = JSON.parse(fs.readFileSync(exactnessAuditPath, "utf8"));
  const lineageEdge = JSON.parse(fs.readFileSync(lineagePath, "utf8"));

  const gateFromApi = bundle.verification_gate;
  const gateFromVerificationArtifact = verificationArtifact.verification_gate;
  const gateFromAlignmentArtifact = alignmentArtifact.verification_gate;

  const consistency = {
    exact_true_everywhere:
      gateFromApi.exact === true &&
      gateFromVerificationArtifact.exact === true &&
      gateFromAlignmentArtifact.exact === true,
    warnings_empty_everywhere:
      (gateFromApi.warning_codes ?? []).length === 0 &&
      (gateFromVerificationArtifact.warning_codes ?? []).length === 0 &&
      (gateFromAlignmentArtifact.warning_codes ?? []).length === 0,
    score_consistent:
      gateFromApi.verification_score === 1 &&
      gateFromVerificationArtifact.verification_score === 1 &&
      gateFromAlignmentArtifact.verification_score === 1,
    disagreements_zero_consistent:
      bundle.disagreements.length === 0 &&
      verificationArtifact.disagreements.length === 0,
    aligned_word_count_match:
      bundle.aligned_words.length === alignmentArtifact.aligned_words.length &&
      bundle.aligned_words.length > 0,
    gate_id_match:
      gateFromApi.gate_id === gateFromVerificationArtifact.gate_id &&
      gateFromApi.gate_id === gateFromAlignmentArtifact.gate_id,
    audit_exactness_match:
      exactnessAudit.action_ref === "transcription.exactness_gate.v1" &&
      exactnessAudit.metadata.exact === true &&
      exactnessAudit.metadata.verification_score === 1 &&
      exactnessAudit.metadata.unresolved_disagreements === 0,
    lineage_bundle_to_gate_match:
      lineageEdge.from_ref === bundle.bundle_id &&
      lineageEdge.to_ref === bundle.verification_gate.gate_id &&
      lineageEdge.transform_ref === "transcription.exactness_gate",
    screenshot_fresh:
      screenshotStats.mtimeMs >= hostileStartedAt && screenshotStats.size > 0
  };

  if (!Object.values(consistency).every(Boolean)) {
    throw new Error(`hostile consistency check failed: ${JSON.stringify(consistency)}`);
  }

  const proof = {
    created_at: new Date().toISOString(),
    base_url: baseUrl,
    screenshot: screenshotFile,
    job_id: jobId,
    bundle_id: bundle.bundle_id,
    verification_artifact: verificationArtifactPath,
    alignment_artifact: alignmentArtifactPath,
    exactness_audit: exactnessAuditPath,
    lineage_edge: lineagePath,
    source_kinds: bundle.sources.map((source) => source.input_kind),
    aligned_word_count: bundle.aligned_words.length,
    on_screen_text_count: bundle.on_screen_text.length,
    disagreement_count: bundle.disagreements.length,
    verification_gate: gateFromApi,
    consistency
  };

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
