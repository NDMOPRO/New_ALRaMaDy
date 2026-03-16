import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";

const root = process.cwd();
const runId = `transcription-ai-flow-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "transcription-extraction-engine", "artifacts", "latest-run", runId);
const runtimeRoot = path.join(root, ".runtime", "transcription-ai-flow-proof", runId);
const fixtureRoot = path.join(runtimeRoot, "fixtures");
const host = "127.0.0.1";
const tenantRef = "tenant-transcription-ai-flow";
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
const pythonCandidates = [path.resolve(root, "..", ".venv311-strict", "Scripts", "python.exe"), "python"];
const pythonExecutable = pythonCandidates.find((candidate) => candidate === "python" || fs.existsSync(candidate));

if (!pythonExecutable) {
  throw new Error("python executable is required for fixture generation");
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.rmSync(runtimeRoot, { recursive: true, force: true });
["records", "evidence", "audit", "lineage", "browser", "api", "intermediate"].forEach((folder) =>
  fs.mkdirSync(path.join(outputRoot, folder), { recursive: true })
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const writeJson = (relativePath, payload) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};
const writeText = (relativePath, payload) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, payload, "utf8");
  return target;
};
const appendLog = (relativePath, line) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, `${new Date().toISOString()} ${line}\n`, "utf8");
  return target;
};
const writeRuntimeJson = (relativePath, payload) => {
  const target = path.join(runtimeRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};
const copyFileIntoProof = (sourcePath, relativePath) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};
const encodeFileBase64 = (filePath) => fs.readFileSync(filePath).toString("base64");
const pageText = async (page) =>
  page.evaluate(() => document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "");
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("no free port"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
const waitForServer = async (baseUrl) => {
  const parsed = new URL(baseUrl);
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(
          { host: parsed.hostname, port: Number(parsed.port) },
          () => {
            socket.end();
            resolve();
          }
        );
        socket.setTimeout(1500);
        socket.on("error", reject);
        socket.on("timeout", () => reject(new Error("timeout")));
      });
      return;
    } catch {}
    await wait(500);
  }
  throw new Error(`server did not start: ${baseUrl}`);
};
const startNodeServer = (command, payload, stem) => {
  const payloadPath = writeRuntimeJson(path.join("server", `${stem}.payload.json`), payload);
  const stdoutPath = path.join(outputRoot, "records", `${stem}.stdout.log`);
  const stderrPath = path.join(outputRoot, "records", `${stem}.stderr.log`);
  const child = spawn("node", ["apps/contracts-cli/dist/index.js", command, payloadPath], {
    cwd: root,
    stdio: ["ignore", fs.openSync(stdoutPath, "a"), fs.openSync(stderrPath, "a")]
  });
  return { child, payloadPath, stdoutPath, stderrPath };
};
const stopServer = (handle) => {
  if (!handle?.child || handle.child.killed) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(handle.child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      handle.child.kill("SIGTERM");
    }
  } catch {}
};
const requestJson = (url, method, payload = undefined, headers = {}) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const body = payload === undefined ? null : JSON.stringify(payload);
    const request = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}),
          ...headers
        }
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
        });
      }
    );
    request.setTimeout(0);
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
const cookieHeaderFor = async (context, baseUrl) =>
  (await context.cookies(baseUrl)).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
const loginPage = async (page, baseUrl) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "admin");
  await page.fill('input[name="password"]', "1500");
  await page.fill('input[name="tenant_ref"]', tenantRef);
  await Promise.all([page.waitForLoadState("networkidle"), page.click("#login-form button")]);
};
const createWorkbook = async (targetPath, rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Extracted");
  rows.forEach((row) => sheet.addRow(row));
  await workbook.xlsx.writeFile(targetPath);
};
const runPowerShell = (script) => {
  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "powershell failed");
};
const runPython = (script) => {
  const result = spawnSync(pythonExecutable, ["-c", script], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "python failed");
};
const createFixtures = async () => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const audioPath = path.join(fixtureRoot, "briefing.wav");
  const scannedPdfPath = path.join(fixtureRoot, "bundle-a-scan.pdf");
  const revisedPdfPath = path.join(fixtureRoot, "bundle-b-scan.pdf");
  const workbookPath = path.join(fixtureRoot, "bundle-a.xlsx");
  const revisedWorkbookPath = path.join(fixtureRoot, "bundle-b.xlsx");
  runPowerShell(`
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SetOutputToWaveFile('${audioPath.replace(/'/g, "''")}')
    $synth.Speak('Program update. Revenue reached one hundred and twenty five dollars on March fifth twenty twenty six. Action item: review invoice INV 204 and prepare an executive report.')
    $synth.Dispose()
  `);
  runPython(`
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(r"""${fixtureRoot}"""); root.mkdir(parents=True, exist_ok=True); font = ImageFont.load_default()
def make_pdf(target, owner, amount, region, invoice):
    page = Image.new("RGB", (1400, 1000), "white")
    draw = ImageDraw.Draw(page)
    draw.text((80, 60), "Board Review Dossier", fill="black", font=font)
    draw.text((80, 140), f"Revenue reached {amount} USD on 2026-03-05. Owner: {owner}. Status: On track.", fill="black", font=font)
    draw.text((80, 220), f"Invoice {invoice} belongs to {region}.", fill="black", font=font)
    page.save(root / target, "PDF", resolution=150.0)
make_pdf("bundle-a-scan.pdf", "Noura", "125", "Riyadh", "INV-204")
make_pdf("bundle-b-scan.pdf", "Amal", "140", "Jeddah", "INV-210")
  `);
  await createWorkbook(workbookPath, [
    ["Region", "CaseId", "Amount", "Date", "Owner"],
    ["Riyadh", "INV-204", 125, "2026-03-05", "Noura"],
    ["Dammam", "INV-199", 65, "2026-03-03", "Faisal"]
  ]);
  await createWorkbook(revisedWorkbookPath, [
    ["Region", "CaseId", "Amount", "Date", "Owner"],
    ["Jeddah", "INV-210", 140, "2026-03-05", "Amal"],
    ["Dammam", "INV-199", 65, "2026-03-03", "Faisal"]
  ]);
  return { audioPath, scannedPdfPath, revisedPdfPath, workbookPath, revisedWorkbookPath };
};
const waitForJobComplete = async (baseUrl, cookieHeader, jobId) => {
  for (let attempt = 0; attempt < 480; attempt += 1) {
    const response = await requestJson(`${baseUrl}/api/v1/transcription/jobs/${encodeURIComponent(jobId)}`, "GET", undefined, {
      cookie: cookieHeader
    });
    if (response.status === 200) {
      const payload = JSON.parse(response.body);
      if (payload.job?.state === "completed" && payload.bundle?.verification_gate?.exact === true) {
        return payload;
      }
    }
    await wait(1000);
  }
  throw new Error(`job did not reach completed exact state: ${jobId}`);
};
const findAiRuntimeBundlePath = (aiRoot, jobId) => {
  const candidates = [
    path.join(aiRoot, "jobs", `${jobId}.json`),
    path.join(aiRoot, "jobs", jobId, "bundle.json"),
    path.join(aiRoot, "jobs", jobId, "job.json")
  ];
  return candidates.find((entry) => fs.existsSync(entry)) ?? null;
};

const fixtures = await createFixtures();
const transcriptionPort = await getFreePort();
const transcriptionBaseUrl = `http://${host}:${transcriptionPort}`;

let transcriptionServer = null;
let browser = null;

try {
  appendLog("records/progress.log", "starting transcription web server");
  transcriptionServer = startNodeServer("transcription-serve-web", { host, port: transcriptionPort }, "transcription-web");
  await waitForServer(transcriptionBaseUrl);
  appendLog("records/progress.log", `server ready ${transcriptionBaseUrl}`);

  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  await loginPage(page, transcriptionBaseUrl);
  await page.waitForURL(`${transcriptionBaseUrl}/transcription`);
  appendLog("records/progress.log", "transcription surface ready");

  const cookieHeader = await cookieHeaderFor(context, transcriptionBaseUrl);
  const startFirst = await requestJson(
    `${transcriptionBaseUrl}/api/v1/transcription/jobs/start`,
    "POST",
    {
      mode: "advanced",
      files: [
        { file_name: path.basename(fixtures.audioPath), media_type: "audio/wav", content_base64: encodeFileBase64(fixtures.audioPath) },
        { file_name: path.basename(fixtures.scannedPdfPath), media_type: "application/pdf", content_base64: encodeFileBase64(fixtures.scannedPdfPath) },
        {
          file_name: path.basename(fixtures.workbookPath),
          media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          content_base64: encodeFileBase64(fixtures.workbookPath)
        }
      ]
    },
    { cookie: cookieHeader }
  );
  if (startFirst.status !== 200) throw new Error(startFirst.body);
  const firstStartPayload = JSON.parse(startFirst.body);
  appendLog("records/progress.log", `first bundle requested ${firstStartPayload.job.job_id}`);

  const startSecond = await requestJson(
    `${transcriptionBaseUrl}/api/v1/transcription/jobs/start`,
    "POST",
    {
      mode: "advanced",
      files: [
        { file_name: path.basename(fixtures.audioPath), media_type: "audio/wav", content_base64: encodeFileBase64(fixtures.audioPath) },
        { file_name: path.basename(fixtures.revisedPdfPath), media_type: "application/pdf", content_base64: encodeFileBase64(fixtures.revisedPdfPath) },
        {
          file_name: path.basename(fixtures.revisedWorkbookPath),
          media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          content_base64: encodeFileBase64(fixtures.revisedWorkbookPath)
        }
      ]
    },
    { cookie: cookieHeader }
  );
  if (startSecond.status !== 200) throw new Error(startSecond.body);
  const secondStartPayload = JSON.parse(startSecond.body);
  appendLog("records/progress.log", `second bundle requested ${secondStartPayload.job.job_id}`);

  const firstJob = await waitForJobComplete(transcriptionBaseUrl, cookieHeader, firstStartPayload.job.job_id);
  const secondJob = await waitForJobComplete(transcriptionBaseUrl, cookieHeader, secondStartPayload.job.job_id);
  appendLog("records/progress.log", "both transcription bundles exact true");

  await page.evaluate(async ({ firstJobId, secondJobId }) => {
    await window.loadJobs?.();
    await window.loadJob?.(firstJobId);
    await window.loadJob?.(secondJobId);
  }, { firstJobId: firstJob.job.job_id, secondJobId: secondJob.job.job_id });
  const transcriptionSurfaceScreenshot = path.join(outputRoot, "browser", "transcription-surface.png");
  await page.screenshot({ path: transcriptionSurfaceScreenshot, fullPage: true });

  await page.fill("#question", "ما الذي ظهر في PDF ولم يظهر في Excel بين آخر حزمتين؟");
  await page.click("#ask-question");
  await page.waitForFunction(() => (document.getElementById("answer-output")?.textContent ?? "").includes("answer_id"), { timeout: 120000 });
  const questionUiText = await page.evaluate(() => document.getElementById("answer-output")?.textContent ?? "");
  const questionUiScreenshot = path.join(outputRoot, "browser", "transcription-question-result.png");
  await page.screenshot({ path: questionUiScreenshot, fullPage: true });
  const questionApi = await requestJson(
    `${transcriptionBaseUrl}/api/v1/transcription/question`,
    "POST",
    {
      bundle_refs: [firstJob.bundle.bundle_id, secondJob.bundle.bundle_id],
      question: "What appeared in the PDF and not in the Excel between the two bundles?",
      compare_mode: true
    },
    { cookie: cookieHeader }
  );
  if (questionApi.status !== 200) throw new Error(questionApi.body);
  const questionPayload = JSON.parse(questionApi.body);
  appendLog("records/progress.log", "ask-across-files result captured");

  await page.fill("#ai-session-id", `session-transcription-ai-${Date.now()}`);
  await page.fill("#ai-resource-ref", String(firstJob.bundle.bundle_id ?? ""));
  await page.fill("#ai-prompt", "قارن بين آخر ملفين واستخرج الاختلافات الجوهرية");
  const aiChecked = await page.locator("#ai-approval").isChecked();
  if (!aiChecked) await page.click("#ai-approval");
  const aiEntryScreenshot = path.join(outputRoot, "browser", "transcription-ai-entry.png");
  await page.screenshot({ path: aiEntryScreenshot, fullPage: true });
  const responsePromise = page.waitForResponse(
    (response) => response.url() === `${transcriptionBaseUrl}/api/v1/ai/jobs` && response.request().method() === "POST",
    { timeout: 180000 }
  );
  await page.click("#ai-run");
  const aiResponse = await responsePromise;
  if (!aiResponse.ok()) throw new Error(await aiResponse.text());
  const aiPayload = await aiResponse.json();
  appendLog("records/progress.log", `ai job requested ${aiPayload.job_id}`);

  if (aiPayload.open_path) {
    await page
      .waitForURL((currentUrl) => currentUrl.toString().startsWith(`${transcriptionBaseUrl}/transcription`), { timeout: 10000 })
      .catch(() => wait(1000));
    await page.goto(`${transcriptionBaseUrl}${aiPayload.open_path}`, { waitUntil: "domcontentloaded" }).catch(() => null);
    await wait(1000);
  }
  await page.waitForFunction(
    () => {
      const node = document.getElementById("ai-result");
      return Boolean(node && node.textContent && node.textContent.includes("capability:"));
    },
    { timeout: 180000 }
  );
  const aiResultText = await page.evaluate(() => document.getElementById("ai-result")?.textContent ?? "");
  const aiResultScreenshot = path.join(outputRoot, "browser", "transcription-ai-result.png");
  await page.screenshot({ path: aiResultScreenshot, fullPage: true });
  appendLog("records/progress.log", "ai compare result rendered on /transcription");

  const aiDetail = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs/${encodeURIComponent(aiPayload.job_id)}`, "GET", undefined, { cookie: cookieHeader })).body);
  const aiStatus = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs/${encodeURIComponent(aiPayload.job_id)}/status`, "GET", undefined, { cookie: cookieHeader })).body);
  const aiResult = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs/${encodeURIComponent(aiPayload.job_id)}/result`, "GET", undefined, { cookie: cookieHeader })).body);
  const aiEvidence = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs/${encodeURIComponent(aiPayload.job_id)}/evidence`, "GET", undefined, { cookie: cookieHeader })).body);
  const aiAudit = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs/${encodeURIComponent(aiPayload.job_id)}/audit`, "GET", undefined, { cookie: cookieHeader })).body);
  const aiLineage = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs/${encodeURIComponent(aiPayload.job_id)}/lineage`, "GET", undefined, { cookie: cookieHeader })).body);
  const aiJobsList = JSON.parse((await requestJson(`${transcriptionBaseUrl}/api/v1/ai/jobs?session_id=${encodeURIComponent(aiDetail.context.session_id)}`, "GET", undefined, { cookie: cookieHeader })).body);
  appendLog("records/progress.log", "ai api captures complete");

  const transcriptionJobRoots = [
    path.join(root, ".runtime", "transcription-web", "transcription-engine", "jobs", firstJob.job.job_id),
    path.join(root, ".runtime", "transcription-web", "transcription-engine", "jobs", secondJob.job.job_id)
  ];
  const transcriptionBundleRoots = [
    path.join(root, ".runtime", "transcription-web", "transcription-engine", "bundles", firstJob.bundle.bundle_id),
    path.join(root, ".runtime", "transcription-web", "transcription-engine", "bundles", secondJob.bundle.bundle_id)
  ];
  const aiRuntimeRoot = path.join(root, ".runtime", "transcription-web", "ai-engine");
  const aiExecutionRoot = path.join(root, ".runtime", "ai-engine-executions", "transcription", aiPayload.job_id);
  const aiRuntimeBundlePath = findAiRuntimeBundlePath(aiRuntimeRoot, aiPayload.job_id);
  const compareResultPath = path.join(aiExecutionRoot, "compare", "compare-result.json");

  copyFileIntoProof(path.join(transcriptionJobRoots[0], "artifacts", "verification-artifact.json"), "intermediate/first-verification-artifact.json");
  copyFileIntoProof(path.join(transcriptionJobRoots[1], "artifacts", "verification-artifact.json"), "intermediate/second-verification-artifact.json");
  if (aiRuntimeBundlePath) copyFileIntoProof(aiRuntimeBundlePath, "intermediate/ai-runtime-job.json");
  if (fs.existsSync(compareResultPath)) copyFileIntoProof(compareResultPath, "intermediate/ai-compare-result.json");

  writeJson("api/transcription-question.json", questionPayload);
  writeJson("api/ai-job-detail.json", aiDetail);
  writeJson("api/ai-job-status.json", aiStatus);
  writeJson("api/ai-job-result.json", aiResult);
  writeJson("api/ai-jobs-list.json", aiJobsList);
  writeJson("evidence/ai-job-evidence.json", aiEvidence);
  writeJson("audit/ai-job-audit.json", aiAudit);
  writeJson("lineage/ai-job-lineage.json", aiLineage);
  writeText("evidence/question-ui.txt", questionUiText);
  writeText("evidence/ai-result-ui.txt", aiResultText);

  const compareArtifactId = aiResult.result_artifact_refs?.find((entry) => String(entry).includes("transcription-compare-result")) ?? null;
  const aiPlanIsCorrect =
    aiDetail.plan.selected_capability === "transcription_extraction" &&
    aiDetail.plan.selected_action_ref === "transcription.compare.v1" &&
    aiDetail.plan.selected_tool_ref === "registry.transcription.compare";
  const aiExecutedComparePath = Array.isArray(aiResult.execution_step_details) && aiResult.execution_step_details.includes("transcription.compare_bundles");
  const aiOpenedOnTranscription =
    String(aiResult.open_path ?? "").startsWith("/transcription?ai_job_id=") &&
    page.url().includes(`ai_job_id=${encodeURIComponent(aiPayload.job_id)}`);
  const directQuestionAnswered =
    String(questionPayload.answer?.question ?? "").length > 0 &&
    Array.isArray(questionPayload.answer?.answer_lines) &&
    questionPayload.answer.answer_lines.length > 0;
  const compareArtifactExists = Boolean(compareArtifactId && fs.existsSync(compareResultPath));
  const aiAuditConnected = Array.isArray(aiAudit) && aiAudit.length > 0;
  const aiLineageConnected = Array.isArray(aiLineage) && aiLineage.length > 0;
  if (!aiPlanIsCorrect || !aiExecutedComparePath || !aiOpenedOnTranscription || !directQuestionAnswered || !compareArtifactExists || !aiAuditConnected || !aiLineageConnected) {
    throw new Error("transcription ai flow assertions failed");
  }
  appendLog("records/progress.log", "assertions passed");

  const flowProof = {
    phase_requirement: "transcription-extraction-engine cross-engine flow proof",
    target_flow: "transcription -> ai compare/question",
    target_surface: "/transcription",
    live_routes: {
      transcription: `${transcriptionBaseUrl}/transcription`,
      transcription_ai_result: `${transcriptionBaseUrl}${aiResult.open_path}`,
      ai_api_job: `${transcriptionBaseUrl}/api/v1/ai/jobs/${aiPayload.job_id}`
    },
    runtime_paths: {
      transcription_job_roots: transcriptionJobRoots,
      transcription_bundle_roots: transcriptionBundleRoots,
      ai_runtime_root: aiRuntimeRoot,
      ai_execution_root: aiExecutionRoot
    },
    assertions: {
      first_bundle_exact_true: firstJob.bundle.verification_gate.exact === true,
      second_bundle_exact_true: secondJob.bundle.verification_gate.exact === true,
      direct_question_answered: directQuestionAnswered,
      ai_plan_is_transcription_compare: aiPlanIsCorrect,
      ai_executed_compare_path: aiExecutedComparePath,
      ai_opened_on_transcription: aiOpenedOnTranscription,
      compare_artifact_exists: compareArtifactExists,
      ai_audit_connected: aiAuditConnected,
      ai_lineage_connected: aiLineageConnected
    },
    final_output: {
      ai_job_id: aiPayload.job_id,
      first_bundle_ref: firstJob.bundle.bundle_id,
      second_bundle_ref: secondJob.bundle.bundle_id,
      compare_artifact_id: compareArtifactId,
      compare_result_path: compareResultPath
    }
  };
  writeJson("records/flow-proof.json", flowProof);
  appendLog("records/progress.log", "proof written");

  console.log(
    JSON.stringify(
      {
        runId,
        outputRoot,
        runtimeRoot,
        flowProof: path.join(outputRoot, "records", "flow-proof.json"),
        finalOutput: flowProof.final_output
      },
      null,
      2
    )
  );
} finally {
  if (browser) await browser.close().catch(() => undefined);
  stopServer(transcriptionServer);
}
