import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";

const root = process.cwd();
const runId = `transcription-report-presentation-dashboard-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "transcription-extraction-engine", "artifacts", "latest-run", runId);
const runtimeRoot = path.join(root, ".runtime", "transcription-report-presentation-dashboard-proof", runId);
const fixtureRoot = path.join(runtimeRoot, "fixtures");
const host = "127.0.0.1";
const tenantRef = "tenant-transcription-dashboard-flow";
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
["records", "evidence", "audit", "lineage", "browser", "export", "intermediate", "api"].forEach((folder) =>
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
const pageText = async (page) =>
  page.evaluate(() => document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "");
const writeBinary = (relativePath, payload) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(payload));
  return target;
};
const copyFileIntoProof = (sourcePath, relativePath) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};
const encodeFileBase64 = (filePath) => fs.readFileSync(filePath).toString("base64");
const writeRuntimeJson = (relativePath, payload) => {
  const target = path.join(runtimeRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};
const walkFiles = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) return [];
  const pending = [directoryPath];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  return files;
};
const readJsonIfPossible = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
};
const jsonMatches = (payload, predicate) => {
  if (Array.isArray(payload)) return payload.some((entry) => predicate(entry));
  if (payload && typeof payload === "object") return predicate(payload);
  return false;
};
const findNewestJsonInTree = (directoryPath, predicate) =>
  walkFiles(directoryPath)
    .filter((filePath) => filePath.endsWith(".json"))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .find((filePath) => jsonMatches(readJsonIfPossible(filePath), predicate)) ?? null;
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
const startNodeServer = (command, payload, stem, env = {}) => {
  const payloadPath = writeRuntimeJson(path.join("server", `${stem}.payload.json`), payload);
  const stdoutPath = path.join(outputRoot, "records", `${stem}.stdout.log`);
  const stderrPath = path.join(outputRoot, "records", `${stem}.stderr.log`);
  const child = spawn("node", ["apps/contracts-cli/dist/index.js", command, payloadPath], {
    cwd: root,
    env: { ...process.env, ...env },
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
const toBufferPayload = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (Array.isArray(value)) return Buffer.from(value);
  if (value && typeof value === "object" && Array.isArray(value.data)) return Buffer.from(value.data);
  if (value && typeof value === "object" && Array.isArray(value.content)) return Buffer.from(value.content);
  if (value && typeof value === "object") {
    const numericEntries = Object.entries(value)
      .filter(([key]) => /^\d+$/.test(key))
      .sort((left, right) => Number(left[0]) - Number(right[0]))
      .map(([, entry]) => Number(entry));
    if (numericEntries.length > 0) return Buffer.from(numericEntries);
  }
  throw new Error("unsupported binary payload");
};
const latestMatchingFile = (directoryPath, includesText) => {
  if (!fs.existsSync(directoryPath)) {
    return null;
  }
  return fs
    .readdirSync(directoryPath)
    .filter((entry) => entry.endsWith(".json") && entry.includes(includesText))
    .map((entry) => path.join(directoryPath, entry))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
};
const maybeCaptureHtmlScreenshot = async (htmlPath, targetPath) => {
  if (!browserExecutablePath || !fs.existsSync(htmlPath)) return null;
  const browser = await chromium.launch({ executablePath: browserExecutablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.screenshot({ path: targetPath, fullPage: true });
    return targetPath;
  } finally {
    await browser.close();
  }
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
  const audioPath = path.join(fixtureRoot, "meeting-audio.wav");
  const videoPath = path.join(fixtureRoot, "meeting-video.mp4");
  const scannedPdfPath = path.join(fixtureRoot, "source-dossier-scan.pdf");
  const workbookPath = path.join(fixtureRoot, "source-metrics.xlsx");
  runPowerShell(`
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SetOutputToWaveFile('${audioPath.replace(/'/g, "''")}')
    $synth.Speak('Program update. Revenue reached one hundred and twenty five dollars on March fifth twenty twenty six. Action item: review invoice INV 204 and prepare an executive report for the steering committee.')
    $synth.Dispose()
  `);
  runPython(`
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg, subprocess
root = Path(r"""${fixtureRoot}"""); root.mkdir(parents=True, exist_ok=True); font = ImageFont.load_default()
page = Image.new("RGB", (1400, 1000), "white"); draw = ImageDraw.Draw(page)
draw.text((80, 60), "Board Review Dossier", fill="black", font=font)
draw.text((80, 140), "Revenue reached 125 USD on 2026-03-05. Owner: Noura. Status: On track.", fill="black", font=font)
draw.text((80, 240), "Table 1: Regional Cases", fill="black", font=font)
headers = ["Region", "Cases", "Amount"]; rows = [["Riyadh", "8", "125"], ["Jeddah", "3", "90"], ["Dammam", "2", "65"]]
for index, header in enumerate(headers):
    x = 80 + index * 240; draw.rectangle((x, 320, x + 200, 380), outline="black", width=2); draw.text((x + 12, 340), header, fill="black", font=font)
for row_index, row in enumerate(rows):
    for col_index, value in enumerate(row):
        x = 80 + col_index * 240; y = 380 + row_index * 70
        draw.rectangle((x, y, x + 200, y + 70), outline="black", width=2); draw.text((x + 12, y + 25), value, fill="black", font=font)
page.save(root / "source-dossier-scan.pdf", "PDF", resolution=150.0)
poster = Image.new("RGB", (1280, 720), "#f4efe6"); poster_draw = ImageDraw.Draw(poster)
poster_draw.text((120, 140), "Live Meeting Capture\\nRevenue 125 USD\\nInvoice INV-204\\nPrepare executive report", fill="#10243b", font=font, spacing=24)
poster_path = root / "video-poster.png"; poster.save(poster_path)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ffmpeg, "-y", "-loop", "1", "-i", str(poster_path), "-i", str(root / "meeting-audio.wav"), "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(root / "meeting-video.mp4")], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
  `);
  await createWorkbook(workbookPath, [
    ["Region", "CaseId", "Amount", "Date", "Owner"],
    ["Riyadh", "INV-204", 125, "2026-03-05", "Noura"],
    ["Jeddah", "INV-201", 90, "2026-03-04", "Amal"],
    ["Dammam", "INV-199", 65, "2026-03-03", "Faisal"]
  ]);
  return { audioPath, videoPath, scannedPdfPath, workbookPath };
};
const loginPage = async (page, baseUrl, selectors, values = {}) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill(selectors.email, values.email ?? "admin");
  await page.fill(selectors.password, values.password ?? "1500");
  await page.fill(selectors.tenant, values.tenant ?? tenantRef);
  if (selectors.workspace) await page.fill(selectors.workspace, values.workspace ?? "workspace-dashboard-web");
  if (selectors.project) await page.fill(selectors.project, values.project ?? "project-dashboard-web");
  if (selectors.actor) await page.fill(selectors.actor, values.actor ?? "admin");
  await Promise.all([page.waitForLoadState("networkidle"), page.click(selectors.submit)]);
};
const pageJson = (page, target, method = "GET", body = undefined) =>
  page.evaluate(
    async ({ target: pathTarget, method: requestMethod, body: requestBody }) => {
      const response = await fetch(pathTarget, {
        method: requestMethod,
        headers: requestBody ? { "content-type": "application/json" } : {},
        body: requestBody ? JSON.stringify(requestBody) : undefined,
        credentials: "include"
      });
      return { status: response.status, body: await response.json() };
    },
    { target, method, body }
  );
const fetchJson = async (url) => {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  return JSON.parse(text);
};
const fetchText = async (url) => {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  return text;
};

const fixtures = await createFixtures();
const transcriptionPort = await getFreePort();
const reportPort = await getFreePort();
const presentationsPort = await getFreePort();
const dashboardPort = await getFreePort();
const transcriptionBaseUrl = `http://${host}:${transcriptionPort}`;
const reportBaseUrl = `http://${host}:${reportPort}`;
const presentationsBaseUrl = `http://${host}:${presentationsPort}`;
const dashboardBaseUrl = `http://${host}:${dashboardPort}`;

let transcriptionServer = null;
let reportServer = null;
let presentationsServer = null;
let dashboardServer = null;
let browser = null;

try {
  transcriptionServer = startNodeServer("transcription-serve-web", { host, port: transcriptionPort }, "transcription-web");
  reportServer = startNodeServer("report-start-platform", { host, port: reportPort }, "report-platform");
  presentationsServer = startNodeServer("presentations-serve-app", { host, port: presentationsPort }, "presentations-platform");
  dashboardServer = startNodeServer("dashboard-serve-web", { host, port: dashboardPort }, "dashboard-web", {
    RASID_DASHBOARD_WEB_HOST: host,
    RASID_DASHBOARD_WEB_PORT: String(dashboardPort)
  });

  await Promise.all([
    waitForServer(transcriptionBaseUrl),
    waitForServer(reportBaseUrl),
    waitForServer(presentationsBaseUrl),
    waitForServer(dashboardBaseUrl)
  ]);

  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

  const transcriptionPage = await context.newPage();
  await loginPage(
    transcriptionPage,
    transcriptionBaseUrl,
    {
      email: 'input[name="email"]',
      password: 'input[name="password"]',
      tenant: 'input[name="tenant_ref"]',
      submit: "#login-form button"
    },
    { tenant: tenantRef }
  );
  await transcriptionPage.waitForURL(`${transcriptionBaseUrl}/transcription`);
  const transcriptionStart = await pageJson(transcriptionPage, "/api/v1/transcription/jobs/start", "POST", {
    mode: "advanced",
    files: [
      { file_name: path.basename(fixtures.audioPath), media_type: "audio/wav", content_base64: encodeFileBase64(fixtures.audioPath) },
      { file_name: path.basename(fixtures.videoPath), media_type: "video/mp4", content_base64: encodeFileBase64(fixtures.videoPath) },
      { file_name: path.basename(fixtures.scannedPdfPath), media_type: "application/pdf", content_base64: encodeFileBase64(fixtures.scannedPdfPath) },
      { file_name: path.basename(fixtures.workbookPath), media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content_base64: encodeFileBase64(fixtures.workbookPath) }
    ]
  });
  if (transcriptionStart.status !== 200) throw new Error(JSON.stringify(transcriptionStart.body));
  const transcriptionPayload = transcriptionStart.body;
  await transcriptionPage.evaluate(async (jobId) => {
    await window.loadJobs?.();
    await window.loadJob?.(jobId);
  }, transcriptionPayload.job.job_id);
  await transcriptionPage.waitForFunction(
    () => document.querySelector("#verification")?.textContent?.includes('"exact": true'),
    undefined,
    { timeout: 300000 }
  );
  const transcriptionLiveScreenshot = path.join(outputRoot, "browser", "transcription-live.png");
  await transcriptionPage.screenshot({ path: transcriptionLiveScreenshot, fullPage: true });

  const workflow = {
    job: transcriptionPayload.job,
    bundle: transcriptionPayload.bundle,
    reportHandoff: transcriptionPayload.report_handoff,
    queryDataset: transcriptionPayload.query_dataset,
    evidencePack: transcriptionPayload.evidence,
    auditEvents: transcriptionPayload.audit,
    lineageEdges: transcriptionPayload.lineage
  };
  const transcriptionJobRoot = path.join(root, ".runtime", "transcription-web", "transcription-engine", "jobs", workflow.job.job_id);
  const transcriptionBundleRoot = path.join(root, ".runtime", "transcription-web", "transcription-engine", "bundles", workflow.bundle.bundle_id);
  const reportHandoffPath = path.join(transcriptionJobRoot, "artifacts", "report-handoff.json");
  const queryDatasetPath = path.join(transcriptionJobRoot, "artifacts", "query-dataset.json");
  const verificationArtifactPath = path.join(transcriptionJobRoot, "artifacts", "verification-artifact.json");
  const alignmentArtifactPath = path.join(transcriptionJobRoot, "artifacts", "alignment-artifact.json");
  const exactnessAuditPath = path.join(transcriptionJobRoot, "audit", `audit-${workflow.job.job_id}-transcription-exactness_gate-v1-verification.json`);
  const bundleVerificationLineagePath = path.join(transcriptionJobRoot, "lineage", `edge-${workflow.bundle.bundle_id}-verification-gate-${workflow.job.job_id}.json`);
  copyFileIntoProof(reportHandoffPath, "intermediate/transcription-report-handoff.json");
  copyFileIntoProof(queryDatasetPath, "intermediate/transcription-query-dataset.json");
  copyFileIntoProof(verificationArtifactPath, "intermediate/transcription-verification-artifact.json");
  copyFileIntoProof(alignmentArtifactPath, "intermediate/transcription-alignment-artifact.json");

  const reportPage = await context.newPage();
  await loginPage(
    reportPage,
    reportBaseUrl,
    { email: "#email", password: "#password", tenant: "#tenantRef", submit: "#loginBtn" },
    { tenant: tenantRef }
  );
  await reportPage.waitForURL(`${reportBaseUrl}/reports`);
  const reportCreateResponse = await pageJson(reportPage, "/api/v1/reports/reports/create-from-transcription", "POST", {
    title: `Transcription Flow ${workflow.bundle.bundle_id}`,
    description: "Created from live /transcription outputs and continued through reports, presentations, and dashboards.",
    language: "en-US",
    workflow: { job: workflow.job, bundle: workflow.bundle, report_handoff: workflow.reportHandoff, query_dataset: workflow.queryDataset },
    transcription_artifact_refs: [
      workflow.bundle.artifact_ref,
      workflow.bundle.transcript_artifact_ref,
      workflow.bundle.extraction_artifact_ref,
      workflow.bundle.summary_artifact_ref
    ],
    transcription_runtime_refs: {
      report_handoff_path: reportHandoffPath,
      query_dataset_path: queryDatasetPath,
      verification_artifact_path: verificationArtifactPath,
      alignment_artifact_path: alignmentArtifactPath
    }
  });
  if (reportCreateResponse.status !== 200) throw new Error(JSON.stringify(reportCreateResponse.body));
  const reportCreate = reportCreateResponse.body.data;
  await reportPage.goto(`${reportBaseUrl}/reports/${reportCreate.report.report_id}`, { waitUntil: "networkidle" });
  const reportCreatedScreenshot = path.join(outputRoot, "browser", "report-live-created.png");
  await reportPage.screenshot({ path: reportCreatedScreenshot, fullPage: true });
  const reviewResponse = await pageJson(reportPage, `/api/v1/reports/reports/${reportCreate.report.report_id}/review`, "POST", {});
  if (reviewResponse.status !== 200) throw new Error(JSON.stringify(reviewResponse.body));
  const reviewed = reviewResponse.body.data;
  const approveResponse = await pageJson(reportPage, `/api/v1/reports/reports/${reportCreate.report.report_id}/approve`, "POST", {});
  if (approveResponse.status !== 200) throw new Error(JSON.stringify(approveResponse.body));
  const approved = approveResponse.body.data;
  const convertResponse = await pageJson(
    reportPage,
    `/api/v1/reports/reports/${reportCreate.report.report_id}/convert/presentation`,
    "POST",
    { target_ref: `platform://presentations/${reportCreate.report.report_id}` }
  );
  if (convertResponse.status !== 200) throw new Error(JSON.stringify(convertResponse.body));
  const conversion = convertResponse.body.data;
  await wait(1000);
  const reportConvertedScreenshot = path.join(outputRoot, "browser", "report-live-converted.png");
  await reportPage.screenshot({ path: reportConvertedScreenshot, fullPage: true });
  const reportDetail = (await pageJson(reportPage, `/api/v1/reports/reports/${reportCreate.report.report_id}`)).body.data;
  const backSyncRecord = reportDetail.records.backSyncs.at(-1) ?? conversion.backSyncRecord ?? null;

  const presentationBundle = conversion.nativePresentationBundle;
  const presentationPublication = conversion.nativePresentationPublication;
  if (!presentationBundle || !presentationPublication) throw new Error("presentation conversion failed");

  const presentationsPage = await context.newPage();
  await loginPage(
    presentationsPage,
    presentationsBaseUrl,
    {
      email: 'input[name="email"]',
      password: 'input[name="password"]',
      tenant: 'input[name="tenantRef"]',
      submit: "#loginForm button"
    },
    { tenant: tenantRef }
  );
  await presentationsPage.goto(`${presentationsBaseUrl}/presentations/${presentationBundle.deck.deck_id}`, { waitUntil: "domcontentloaded" });
  await presentationsPage.waitForSelector("#readerFrame", { timeout: 120000 });
  const presentationsPlatformScreenshot = path.join(outputRoot, "browser", "presentations-platform-live.png");
  await presentationsPage.screenshot({ path: presentationsPlatformScreenshot, fullPage: true });

  const htmlExport = presentationBundle.exportArtifacts.find((entry) => entry.target === "html");
  const pdfExport = presentationBundle.exportArtifacts.find((entry) => entry.target === "pdf");
  const pptxExport = presentationBundle.exportArtifacts.find((entry) => entry.target === "pptx");
  if (!htmlExport || !pdfExport || !pptxExport) throw new Error("presentation exports incomplete");
  const finalHtmlContent = typeof htmlExport.content === "string" ? htmlExport.content : toBufferPayload(htmlExport.content).toString("utf8");
  const finalHtmlPath = writeText("export/final-presentation.html", finalHtmlContent);
  const finalPdfPath = writeBinary("export/final-presentation.pdf", toBufferPayload(pdfExport.content));
  const finalPptxPath = writeBinary("export/final-presentation.pptx", toBufferPayload(pptxExport.content));
  const finalPresentationFileScreenshot = await maybeCaptureHtmlScreenshot(
    finalHtmlPath,
    path.join(outputRoot, "browser", "final-presentation-file.png")
  );

  const dashboardLoginPage = await context.newPage();
  await loginPage(
    dashboardLoginPage,
    dashboardBaseUrl,
    {
      email: "#email",
      password: "#password",
      tenant: "#tenant",
      workspace: "#workspace",
      project: "#project",
      actor: "#actor",
      submit: "#login"
    },
    {
      tenant: tenantRef,
      workspace: "workspace-dashboard-web",
      project: "project-dashboard-web",
      actor: "admin"
    }
  );
  await dashboardLoginPage.waitForURL(`${dashboardBaseUrl}/data`);
  await dashboardLoginPage.goto(`${dashboardBaseUrl}/presentations?deck_id=${encodeURIComponent(presentationBundle.deck.deck_id)}`, {
    waitUntil: "networkidle"
  });
  await dashboardLoginPage.waitForSelector("#canvas-presentation-to-dashboard", { timeout: 120000 });
  await dashboardLoginPage.evaluate(() => {
    const checkbox = document.getElementById("canvas-approval-granted");
    if (checkbox) checkbox.checked = true;
  });
  const dashboardPresentationSurfaceScreenshot = path.join(outputRoot, "browser", "dashboard-presentations-surface.png");
  await dashboardLoginPage.screenshot({ path: dashboardPresentationSurfaceScreenshot, fullPage: true });

  await dashboardLoginPage.click("#canvas-presentation-to-dashboard");
  await dashboardLoginPage.waitForURL((url) => url.pathname === "/dashboards" && url.searchParams.has("dashboard_id"), {
    timeout: 120000
  });
  const dashboardId = new URL(dashboardLoginPage.url()).searchParams.get("dashboard_id");
  if (!dashboardId) throw new Error("dashboard id missing after presentation conversion");
  const presentationBridgeRoot = path.join(root, ".runtime", "dashboard-web", "presentation-bridges", presentationBundle.deck.deck_id);
  const bridgeRunDirectory =
    fs
      .readdirSync(presentationBridgeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${dashboardId}-`))
      .map((entry) => path.join(presentationBridgeRoot, entry.name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
  if (!bridgeRunDirectory) throw new Error("presentation bridge runtime directory missing after conversion");
  const bridgeManifestPath = path.join(bridgeRunDirectory, "bridge-manifest.json");
  const bridgeArtifactPath = path.join(bridgeRunDirectory, `bridge-${presentationBundle.deck.deck_id}-${dashboardId}.artifact.json`);
  const bridgeEvidencePath = path.join(bridgeRunDirectory, `bridge-${presentationBundle.deck.deck_id}-${dashboardId}.evidence.json`);
  const bridgeAuditPath = path.join(bridgeRunDirectory, `bridge-${presentationBundle.deck.deck_id}-${dashboardId}.audit.json`);
  const bridgeLineagePath = path.join(bridgeRunDirectory, `bridge-${presentationBundle.deck.deck_id}-${dashboardId}.lineage.json`);
  if (!fs.existsSync(bridgeManifestPath)) throw new Error("presentation bridge manifest missing after conversion");
  const dashboardConversion = {
    open_path: `/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}`,
    presentation_bridge: {
      ...JSON.parse(fs.readFileSync(bridgeManifestPath, "utf8")),
      bridge_manifest_path: bridgeManifestPath,
      bridge_artifact_path: bridgeArtifactPath,
      bridge_evidence_path: bridgeEvidencePath,
      bridge_audit_path: bridgeAuditPath,
      bridge_lineage_path: bridgeLineagePath
    }
  };
  const dashboardDetailScreenshot = path.join(outputRoot, "browser", "dashboard-live.png");
  await dashboardLoginPage.screenshot({ path: dashboardDetailScreenshot, fullPage: true });

  const dashboardStateResponse = await pageJson(
    dashboardLoginPage,
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`
  );
  if (dashboardStateResponse.status !== 200) throw new Error(JSON.stringify(dashboardStateResponse.body));
  const dashboardState = dashboardStateResponse.body;
  const dashboardLiveText = await pageText(dashboardLoginPage);
  writeText("evidence/dashboard-live.txt", dashboardLiveText);

  await dashboardLoginPage.evaluate(() => {
    const checkbox = document.getElementById("canvas-approval-granted");
    if (checkbox) checkbox.checked = true;
  });
  const publishResponsePromise = dashboardLoginPage.waitForResponse((response) =>
    response.url().includes("/api/v1/dashboards/publish") && response.request().method() === "POST"
  );
  await dashboardLoginPage.click("#canvas-publish-dashboard");
  const dashboardPublishResponse = await publishResponsePromise;
  const publishPayload = await dashboardPublishResponse.json();

  const shareResponse = await pageJson(dashboardLoginPage, "/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  if (shareResponse.status !== 200) throw new Error(JSON.stringify(shareResponse.body));
  const sharePayload = shareResponse.body;

  const exportWidgetRef =
    dashboardState.dashboard.widgets.find((widget) => widget.widget_type !== "filter")?.widget_id ??
    dashboardState.dashboard.widgets[0]?.widget_id;
  if (!exportWidgetRef) throw new Error("No exportable widget found in downstream dashboard.");
  const exportTargetResponse = await pageJson(dashboardLoginPage, "/api/v1/dashboards/export-widget-target", "POST", {
    dashboard_id: dashboardId,
    widget_ref: exportWidgetRef,
    target_kind: "live_external"
  });
  if (exportTargetResponse.status !== 200) throw new Error(JSON.stringify(exportTargetResponse.body));
  const exportTargetPayload = exportTargetResponse.body;

  const publishedPage = await context.newPage();
  await publishedPage.goto(publishPayload.transport.served_embed_html_url, { waitUntil: "networkidle" });
  const publishedEmbedScreenshot = path.join(outputRoot, "browser", "published-embed.png");
  await publishedPage.screenshot({ path: publishedEmbedScreenshot, fullPage: true });
  const publishedEmbedText = await pageText(publishedPage);
  writeText("evidence/published-embed.txt", publishedEmbedText);

  const sharedPage = await context.newPage();
  await sharedPage.goto(sharePayload.transport.served_embed_html_url, { waitUntil: "networkidle" });
  const sharedEmbedScreenshot = path.join(outputRoot, "browser", "shared-embed.png");
  await sharedPage.screenshot({ path: sharedEmbedScreenshot, fullPage: true });
  const sharedEmbedText = await pageText(sharedPage);
  writeText("evidence/shared-embed.txt", sharedEmbedText);

  const externalTargetPage = await context.newPage();
  await externalTargetPage.goto(`${dashboardBaseUrl}${exportTargetPayload.transfer.open_path}`, { waitUntil: "networkidle" });
  const externalTargetScreenshot = path.join(outputRoot, "browser", "dashboard-external-target.png");
  await externalTargetPage.screenshot({ path: externalTargetScreenshot, fullPage: true });
  const externalTargetText = await pageText(externalTargetPage);
  writeText("evidence/dashboard-external-target.txt", externalTargetText);

  const publishManifest = await fetchJson(publishPayload.transport.served_manifest_url);
  const publishState = await fetchJson(publishPayload.transport.served_publish_state_url);
  const publishEmbedPayload = await fetchJson(publishPayload.transport.served_embed_payload_url);
  const publishEmbedHtml = await fetchText(publishPayload.transport.served_embed_html_url);
  const shareManifest = await fetchJson(sharePayload.transport.served_manifest_url);
  const shareState = await fetchJson(sharePayload.transport.served_publish_state_url);
  const shareEmbedPayload = await fetchJson(sharePayload.transport.served_embed_payload_url);
  const shareEmbedHtml = await fetchText(sharePayload.transport.served_embed_html_url);
  const governanceLibraryResponse = await pageJson(dashboardLoginPage, "/api/v1/governance/library");
  const governanceAuditResponse = await pageJson(dashboardLoginPage, "/api/v1/governance/audit");
  const governanceLineageResponse = await pageJson(dashboardLoginPage, "/api/v1/governance/lineage");
  const governanceEvidenceResponse = await pageJson(dashboardLoginPage, "/api/v1/governance/evidence");
  if (
    governanceLibraryResponse.status !== 200 ||
    governanceAuditResponse.status !== 200 ||
    governanceLineageResponse.status !== 200 ||
    governanceEvidenceResponse.status !== 200
  ) {
    throw new Error("governance live routes did not return 200");
  }
  const governanceLibraryPayload = governanceLibraryResponse.body;
  const governanceAuditPayload = governanceAuditResponse.body;
  const governanceLineagePayload = governanceLineageResponse.body;
  const governanceEvidencePayload = governanceEvidenceResponse.body;
  writeJson("api/dashboard-publish-manifest.json", publishManifest);
  writeJson("api/dashboard-publish-state.json", publishState);
  writeJson("api/dashboard-publish-embed-payload.json", publishEmbedPayload);
  writeText("export/dashboard-publish-embed.html", publishEmbedHtml);
  writeJson("api/dashboard-share-manifest.json", shareManifest);
  writeJson("api/dashboard-share-state.json", shareState);
  writeJson("api/dashboard-share-embed-payload.json", shareEmbedPayload);
  writeText("export/dashboard-share-embed.html", shareEmbedHtml);
  writeJson("api/governance-library.json", governanceLibraryPayload);
  writeJson("api/governance-audit.json", governanceAuditPayload);
  writeJson("api/governance-lineage.json", governanceLineagePayload);
  writeJson("api/governance-evidence.json", governanceEvidencePayload);

  const libraryPage = await context.newPage();
  await libraryPage.goto(`${dashboardBaseUrl}/library`, { waitUntil: "networkidle" });
  const libraryLiveScreenshot = path.join(outputRoot, "browser", "library-live.png");
  await libraryPage.screenshot({ path: libraryLiveScreenshot, fullPage: true });
  const libraryLiveText = await pageText(libraryPage);
  writeText("evidence/library-live.txt", libraryLiveText);

  const governancePage = await context.newPage();
  await governancePage.goto(`${dashboardBaseUrl}/governance`, { waitUntil: "networkidle" });
  const governanceLiveScreenshot = path.join(outputRoot, "browser", "governance-live.png");
  await governancePage.screenshot({ path: governanceLiveScreenshot, fullPage: true });
  const governanceLiveText = await pageText(governancePage);
  writeText("evidence/governance-live.txt", governanceLiveText);

  const reportRuntimeRoot = path.join(root, ".runtime", "report-engine", "reports", reportCreate.report.report_id);
  const presentationRuntimeRoot = path.join(root, ".runtime", "presentations-engine", "decks", presentationBundle.deck.deck_id);
  const dashboardRuntimeRoot = path.join(root, ".runtime", "dashboard-web", "dashboard-engine", "dashboards", dashboardId);
  const governanceTenantRoot = path.join(root, ".runtime", "governance-engine", "tenants", tenantRef);
  const reportCurrentPath = path.join(reportRuntimeRoot, "state", "current.json");
  const presentationBundlePath = path.join(presentationRuntimeRoot, "state", "bundle-snapshot.json");
  const presentationStatePath = path.join(presentationRuntimeRoot, "state", "current.json");
  const dashboardCurrentStatePath = path.join(dashboardRuntimeRoot, "state", "current.json");
  const bridge = dashboardConversion.presentation_bridge;

  copyFileIntoProof(reportCurrentPath, "intermediate/report-current-state.json");
  copyFileIntoProof(presentationBundlePath, "intermediate/presentation-bundle-snapshot.json");
  copyFileIntoProof(presentationStatePath, "intermediate/presentation-current-state.json");
  copyFileIntoProof(bridge.bridge_manifest_path, "intermediate/presentation-dashboard-bridge-manifest.json");
  copyFileIntoProof(dashboardCurrentStatePath, "intermediate/dashboard-current-state.json");
  copyFileIntoProof(exportTargetPayload.transfer.preview_path, "export/dashboard-external-target.html");
  copyFileIntoProof(exportTargetPayload.transfer.artifact_path, "export/dashboard-external-target-artifact.json");
  copyFileIntoProof(exportTargetPayload.transfer.evidence_path, "evidence/dashboard-export-target.json");
  copyFileIntoProof(exportTargetPayload.transfer.audit_path, "audit/dashboard-export-target.json");
  copyFileIntoProof(exportTargetPayload.transfer.lineage_path, "lineage/dashboard-export-target.json");
  copyFileIntoProof(bridge.bridge_evidence_path, "evidence/presentation-dashboard-bridge.json");
  copyFileIntoProof(bridge.bridge_audit_path, "audit/presentation-dashboard-bridge.json");
  copyFileIntoProof(bridge.bridge_lineage_path, "lineage/presentation-dashboard-bridge.json");

  const reportCreateAuditPath = latestMatchingFile(path.join(reportRuntimeRoot, "audit"), "report_create");
  const reportReviewAuditPath = latestMatchingFile(path.join(reportRuntimeRoot, "audit"), "report_review");
  const reportApproveAuditPath = latestMatchingFile(path.join(reportRuntimeRoot, "audit"), "report_approve");
  const reportConvertAuditPath = latestMatchingFile(path.join(reportRuntimeRoot, "audit"), "presentation");
  const reportConvertLineagePath = latestMatchingFile(path.join(reportRuntimeRoot, "lineage"), presentationBundle.deck.deck_id);
  const dashboardPublishAuditPath = latestMatchingFile(path.join(dashboardRuntimeRoot, "audit"), "dashboard-publish");
  const dashboardShareAuditPath = latestMatchingFile(path.join(dashboardRuntimeRoot, "audit"), "dashboard-share");
  const dashboardDatasetLineagePath = latestMatchingFile(path.join(dashboardRuntimeRoot, "lineage"), "dataset");
  const dashboardPublishLineagePath = latestMatchingFile(path.join(dashboardRuntimeRoot, "lineage"), "publish");
  const dashboardShareLineagePath = latestMatchingFile(path.join(dashboardRuntimeRoot, "lineage"), "share");
  if (reportCreateAuditPath) copyFileIntoProof(reportCreateAuditPath, "audit/report-create-runtime.json");
  if (reportReviewAuditPath) copyFileIntoProof(reportReviewAuditPath, "audit/report-review-runtime.json");
  if (reportApproveAuditPath) copyFileIntoProof(reportApproveAuditPath, "audit/report-approve-runtime.json");
  if (reportConvertAuditPath) copyFileIntoProof(reportConvertAuditPath, "audit/report-convert-presentation-runtime.json");
  if (reportConvertLineagePath) copyFileIntoProof(reportConvertLineagePath, "lineage/report-convert-presentation-runtime.json");
  if (dashboardPublishAuditPath) copyFileIntoProof(dashboardPublishAuditPath, "audit/dashboard-publish-runtime.json");
  if (dashboardShareAuditPath) copyFileIntoProof(dashboardShareAuditPath, "audit/dashboard-share-runtime.json");
  if (dashboardDatasetLineagePath) copyFileIntoProof(dashboardDatasetLineagePath, "lineage/dashboard-dataset-runtime.json");
  if (dashboardPublishLineagePath) copyFileIntoProof(dashboardPublishLineagePath, "lineage/dashboard-publish-runtime.json");
  if (dashboardShareLineagePath) copyFileIntoProof(dashboardShareLineagePath, "lineage/dashboard-share-runtime.json");

  const libraryAssetRefs = [
    ...(publishPayload.snapshot?.dashboard?.publication_metadata?.library_asset_refs ?? []),
    ...(publishState.dashboard?.publication_metadata?.library_asset_refs ?? []),
    ...(dashboardState.dashboard?.publication_metadata?.library_asset_refs ?? [])
  ];
  const libraryAssetId = libraryAssetRefs.at(-1) ?? null;
  const governanceLibrary = Array.isArray(governanceLibraryPayload.library) ? governanceLibraryPayload.library : [];
  const governanceAudit = Array.isArray(governanceAuditPayload.audit) ? governanceAuditPayload.audit : [];
  const governanceLineage = Array.isArray(governanceLineagePayload.lineage) ? governanceLineagePayload.lineage : [];
  const governanceEvidence = Array.isArray(governanceEvidencePayload.evidence) ? governanceEvidencePayload.evidence : [];
  const governanceLibraryRecord = governanceLibrary.find((entry) => entry.asset_id === libraryAssetId) ?? null;
  const governanceAuditRecord =
    governanceAudit.find(
      (entry) =>
        entry.action_ref === "dashboard.publish.v1" &&
        (entry.target_ref === dashboardId ||
          entry.target_ref === publishPayload.publication.publication_id ||
          (Array.isArray(entry.object_refs) &&
            (entry.object_refs.includes(dashboardId) || entry.object_refs.includes(publishPayload.publication.publication_id))))
    ) ?? null;
  const governanceEvidenceRecord =
    governanceEvidence.find(
      (entry) =>
        entry.action_id === "dashboard.publish.v1" &&
        (entry.resource_ref === dashboardId ||
          entry.resource_ref === publishPayload.publication.publication_id ||
          (Array.isArray(entry.source_refs) &&
            (entry.source_refs.includes(dashboardId) || entry.source_refs.includes(workflow.bundle.artifact_ref))))
    ) ?? null;
  const governanceLineageRecord =
    governanceLineage.find(
      (entry) =>
        (entry.action_ref === "dashboard.publish.v1" ||
          entry.transform_ref === "dashboard.publish.v1" ||
          entry.transform_ref === "dashboard.publish") &&
        (entry.from_ref === dashboardId ||
          entry.to_ref === publishPayload.publication.publication_id ||
          entry.to_ref === libraryAssetId)
    ) ?? null;
  const governanceLibraryRuntimePath =
    (libraryAssetId &&
      findNewestJsonInTree(governanceTenantRoot, (entry) => entry?.asset_id === libraryAssetId)) ??
    null;
  const governanceAuditRuntimePath = findNewestJsonInTree(
    governanceTenantRoot,
    (entry) =>
      entry?.action_ref === "dashboard.publish.v1" &&
      (entry?.target_ref === dashboardId ||
        entry?.target_ref === publishPayload.publication.publication_id ||
        (Array.isArray(entry?.object_refs) &&
          (entry.object_refs.includes(dashboardId) || entry.object_refs.includes(publishPayload.publication.publication_id))))
  );
  const governanceEvidenceRuntimePath = findNewestJsonInTree(
    governanceTenantRoot,
    (entry) =>
      entry?.action_id === "dashboard.publish.v1" &&
      (entry?.resource_ref === dashboardId ||
        entry?.resource_ref === publishPayload.publication.publication_id ||
        (Array.isArray(entry?.source_refs) &&
          (entry.source_refs.includes(dashboardId) || entry.source_refs.includes(workflow.bundle.artifact_ref))))
  );
  const governanceLineageRuntimePath = findNewestJsonInTree(
    governanceTenantRoot,
    (entry) =>
      (entry?.action_ref === "dashboard.publish.v1" ||
        entry?.transform_ref === "dashboard.publish.v1" ||
        entry?.transform_ref === "dashboard.publish") &&
      (entry?.from_ref === dashboardId ||
        entry?.to_ref === publishPayload.publication.publication_id ||
        entry?.to_ref === libraryAssetId)
  );
  if (governanceLibraryRuntimePath) copyFileIntoProof(governanceLibraryRuntimePath, "intermediate/governance-library-record.json");
  if (governanceAuditRuntimePath) copyFileIntoProof(governanceAuditRuntimePath, "audit/governance-dashboard-publish-runtime.json");
  if (governanceEvidenceRuntimePath) copyFileIntoProof(governanceEvidenceRuntimePath, "evidence/governance-dashboard-publish-runtime.json");
  if (governanceLineageRuntimePath) copyFileIntoProof(governanceLineageRuntimePath, "lineage/governance-dashboard-publish-runtime.json");

  const reportCurrent = JSON.parse(fs.readFileSync(reportCurrentPath, "utf8"));
  const reportBlocks = Array.isArray(reportCurrent.content_blocks) ? reportCurrent.content_blocks : [];
  const reportBindings = Array.isArray(reportCurrent.binding_set?.bindings) ? reportCurrent.binding_set.bindings : [];
  const reportPayloads = reportBlocks.map((block) => block.content_payload ?? {});
  const queryDatasetConsumedInReport = reportBindings.some((binding) => binding.dataset_ref === `dataset://transcription/${workflow.bundle.bundle_id}`);
  const reportHandoffConsumedInReportEngine = reportPayloads.some((payload) => payload.source_metadata?.source === "transcription-report-handoff");
  const reportEngineIsLiveLoop =
    Boolean(backSyncRecord) &&
    reportBlocks.some(
      (block) =>
        String(block.title?.[0]?.value ?? "").includes("Back-Sync") ||
        block.content_payload?.source_metadata?.downstream_capability === "presentations"
    );
  const presentationToDashboardConsumed =
    Array.isArray(dashboardState.dashboard.source_dataset_refs) &&
    dashboardState.dashboard.source_dataset_refs.every((datasetRef) =>
      bridge.dataset_mappings.some((mapping) => mapping.local_dataset_id === datasetRef)
    );
  const visibleDownstreamText = [dashboardLiveText, publishedEmbedText, sharedEmbedText, externalTargetText]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("\n");
  const queryDatasetVisibleInDashboard =
    visibleDownstreamText.includes("INV-204") ||
    visibleDownstreamText.includes("125") ||
    visibleDownstreamText.includes("Riyadh") ||
    visibleDownstreamText.includes("Noura");
  const publishDashboardId = publishPayload.snapshot?.dashboard?.dashboard_id ?? publishPayload.dashboard_id ?? publishManifest.dashboard_id;
  const shareDashboardId = sharePayload.snapshot?.dashboard?.dashboard_id ?? sharePayload.dashboard_id ?? shareManifest.dashboard_id;
  const exportDashboardId = exportTargetPayload.transfer.dashboard_id ?? exportTargetPayload.dashboard_id;
  const publishShareExportContinuity =
    publishDashboardId === dashboardId &&
    shareDashboardId === dashboardId &&
    exportDashboardId === dashboardId;
  const dashboardLibraryAssetCreated = Boolean(libraryAssetId);
  const dashboardLibraryAssetMirroredToGovernance = Boolean(governanceLibraryRecord && governanceLibraryRuntimePath);
  const dashboardGovernanceAuditConnected = Boolean(governanceAuditRecord && governanceAuditRuntimePath);
  const dashboardGovernanceEvidenceConnected = Boolean(governanceEvidenceRecord && governanceEvidenceRuntimePath);
  const dashboardGovernanceLineageConnected = Boolean(governanceLineageRecord && governanceLineageRuntimePath);
  const governanceVisibleInSurface =
    libraryLiveText.includes(dashboardId) ||
    libraryLiveText.includes(libraryAssetId ?? "") ||
    governanceLiveText.includes("dashboard.publish.v1") ||
    governanceLiveText.includes(publishPayload.publication.publication_id);
  if (
    workflow.bundle.verification_gate.exact !== true ||
    !reportHandoffConsumedInReportEngine ||
    !queryDatasetConsumedInReport ||
    !reportEngineIsLiveLoop ||
    !presentationToDashboardConsumed ||
    !queryDatasetVisibleInDashboard ||
    !publishShareExportContinuity ||
    !dashboardLibraryAssetCreated ||
    !dashboardLibraryAssetMirroredToGovernance ||
    !dashboardGovernanceAuditConnected ||
    !dashboardGovernanceEvidenceConnected ||
    !dashboardGovernanceLineageConnected ||
    !governanceVisibleInSurface
  ) {
    throw new Error("cross-engine dashboard/governance assertions failed");
  }

  const flowProof = {
    phase_requirement: "transcription-extraction-engine cross-engine flow proof",
    live_flow: "transcription -> reports -> presentations -> dashboards -> library/governance",
    live_routes: {
      transcription: `${transcriptionBaseUrl}/transcription`,
      reports: `${reportBaseUrl}/reports/${reportCreate.report.report_id}`,
      presentations_platform: `${presentationsBaseUrl}/presentations/${presentationBundle.deck.deck_id}`,
      presentations_dashboard_surface: `${dashboardBaseUrl}/presentations?deck_id=${encodeURIComponent(presentationBundle.deck.deck_id)}`,
      dashboards: `${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}`,
      library: `${dashboardBaseUrl}/library`,
      governance: `${dashboardBaseUrl}/governance`
    },
    runtime_paths: {
      transcription_job_root: transcriptionJobRoot,
      transcription_bundle_root: transcriptionBundleRoot,
      report_root: reportRuntimeRoot,
      presentation_root: presentationRuntimeRoot,
      dashboard_root: dashboardRuntimeRoot,
      governance_tenant_root: governanceTenantRoot
    },
    fresh_artifacts: {
      report_handoff: reportHandoffPath,
      query_dataset: queryDatasetPath,
      verification_artifact: verificationArtifactPath,
      alignment_artifact: alignmentArtifactPath,
      report_current_state: reportCurrentPath,
      presentation_bundle_snapshot: presentationBundlePath,
      presentation_bridge_manifest: bridge.bridge_manifest_path,
      dashboard_current_state: dashboardCurrentStatePath,
      dashboard_live_text: path.join(outputRoot, "evidence", "dashboard-live.txt"),
      published_embed_text: path.join(outputRoot, "evidence", "published-embed.txt"),
      shared_embed_text: path.join(outputRoot, "evidence", "shared-embed.txt"),
      external_target_text: path.join(outputRoot, "evidence", "dashboard-external-target.txt"),
      publish_manifest: path.join(outputRoot, "api", "dashboard-publish-manifest.json"),
      share_manifest: path.join(outputRoot, "api", "dashboard-share-manifest.json"),
      governance_library_api: path.join(outputRoot, "api", "governance-library.json"),
      governance_audit_api: path.join(outputRoot, "api", "governance-audit.json"),
      governance_lineage_api: path.join(outputRoot, "api", "governance-lineage.json"),
      governance_evidence_api: path.join(outputRoot, "api", "governance-evidence.json"),
      governance_library_runtime: governanceLibraryRuntimePath,
      governance_audit_runtime: governanceAuditRuntimePath,
      governance_lineage_runtime: governanceLineageRuntimePath,
      governance_evidence_runtime: governanceEvidenceRuntimePath,
      external_target_artifact: exportTargetPayload.transfer.artifact_path
    },
    screenshots: {
      transcription: transcriptionLiveScreenshot,
      report_created: reportCreatedScreenshot,
      report_converted: reportConvertedScreenshot,
      presentations_platform: presentationsPlatformScreenshot,
      presentations_dashboard_surface: dashboardPresentationSurfaceScreenshot,
      dashboard: dashboardDetailScreenshot,
      published_embed: publishedEmbedScreenshot,
      shared_embed: sharedEmbedScreenshot,
      external_target: externalTargetScreenshot,
      library: libraryLiveScreenshot,
      governance: governanceLiveScreenshot,
      final_presentation_file: finalPresentationFileScreenshot
    },
    assertions: {
      transcription_exact_true: workflow.bundle.verification_gate.exact === true,
      report_handoff_consumed_in_report_engine: reportHandoffConsumedInReportEngine,
      query_dataset_consumed_in_report: queryDatasetConsumedInReport,
      report_engine_is_live_loop: reportEngineIsLiveLoop,
      presentation_to_dashboard_consumed: presentationToDashboardConsumed,
      query_dataset_visible_in_dashboard: queryDatasetVisibleInDashboard,
      publish_share_export_continuity: publishShareExportContinuity,
      dashboard_library_asset_created: dashboardLibraryAssetCreated,
      dashboard_library_asset_mirrored_to_governance: dashboardLibraryAssetMirroredToGovernance,
      dashboard_governance_audit_connected: dashboardGovernanceAuditConnected,
      dashboard_governance_evidence_connected: dashboardGovernanceEvidenceConnected,
      dashboard_governance_lineage_connected: dashboardGovernanceLineageConnected,
      governance_visible_in_surface: governanceVisibleInSurface
    },
    final_output: {
      report_id: reportCreate.report.report_id,
      deck_id: presentationBundle.deck.deck_id,
      dashboard_id: dashboardId,
      library_asset_id: libraryAssetId,
      publish_publication_id: publishPayload.publication.publication_id,
      share_publication_id: sharePayload.publication.publication_id,
      export_transfer_id: exportTargetPayload.transfer.transfer_id,
      publish_embed_url: publishPayload.transport.served_embed_html_url,
      share_embed_url: sharePayload.transport.served_embed_html_url,
      export_open_path: `${dashboardBaseUrl}${exportTargetPayload.transfer.open_path}`
    }
  };

  writeJson("records/flow-proof.json", flowProof);
  writeJson("records/transcription-summary.json", {
    job_id: workflow.job.job_id,
    bundle_id: workflow.bundle.bundle_id,
    verification_gate: workflow.bundle.verification_gate
  });
  writeJson("records/report-create.json", reportCreate);
  writeJson("records/report-review.json", reviewed);
  writeJson("records/report-approve.json", approved);
  writeJson("records/report-to-presentation.json", conversion);
  writeJson("api/presentation-to-dashboard.json", dashboardConversion);
  writeJson("api/dashboard-state.json", dashboardState);
  writeJson("api/dashboard-publish.json", publishPayload);
  writeJson("api/dashboard-share.json", sharePayload);
  writeJson("api/dashboard-export-target.json", exportTargetPayload);
  writeJson("records/governance-library-record.json", governanceLibraryRecord);
  writeJson("records/governance-audit-record.json", governanceAuditRecord);
  writeJson("records/governance-evidence-record.json", governanceEvidenceRecord);
  writeJson("records/governance-lineage-record.json", governanceLineageRecord);

  writeJson("evidence/transcription.json", workflow.evidencePack);
  writeJson("evidence/report-create.json", reportCreate.evidencePack);
  writeJson("evidence/report-review.json", reviewed.evidencePack);
  writeJson("evidence/report-approve.json", approved.evidencePack);
  writeJson("evidence/report-convert-presentation.json", conversion.evidencePack);
  writeJson("evidence/presentation-native.json", presentationBundle.evidencePacks);
  writeJson("evidence/dashboard-publish.json", publishManifest);
  writeJson("evidence/dashboard-share.json", shareManifest);
  writeJson("evidence/cross-engine-flow.json", {
    flow: "transcription -> reports -> presentations -> dashboards -> library/governance",
    bridge_manifest_path: bridge.bridge_manifest_path,
    source_refs: [
      workflow.bundle.artifact_ref,
      reportCreate.reportArtifact.artifact_id,
      presentationBundle.deckArtifact.artifact_id,
      dashboardId,
      libraryAssetId
    ],
    final_output: flowProof.final_output,
    governance_refs: {
      library_record: governanceLibraryRecord?.asset_id ?? null,
      audit_event: governanceAuditRecord?.event_id ?? null,
      evidence_record: governanceEvidenceRecord?.evidence_id ?? null,
      lineage_edge: governanceLineageRecord?.edge_id ?? null
    }
  });

  writeJson("audit/transcription.json", workflow.auditEvents);
  writeJson("audit/report-create.json", reportCreate.auditEvents);
  writeJson("audit/report-review.json", reviewed.auditEvents);
  writeJson("audit/report-approve.json", approved.auditEvents);
  writeJson("audit/report-convert-presentation.json", conversion.auditEvents);
  writeJson("audit/presentation-native.json", presentationBundle.auditEvents);
  writeJson("audit/cross-engine-flow.json", {
    exactness_audit_path: exactnessAuditPath,
    presentation_bridge_audit_path: bridge.bridge_audit_path,
    dashboard_publish_audit_path: dashboardPublishAuditPath,
    dashboard_share_audit_path: dashboardShareAuditPath,
    governance_dashboard_publish_audit_path: governanceAuditRuntimePath,
    export_target_audit_path: exportTargetPayload.transfer.audit_path,
    counts: {
      transcription: workflow.auditEvents.length,
      report_create: reportCreate.auditEvents.length,
      report_review: reviewed.auditEvents.length,
      report_approve: approved.auditEvents.length,
      report_convert: conversion.auditEvents.length,
      presentation_native: presentationBundle.auditEvents.length,
      governance_audit: governanceAudit.length,
      governance_evidence: governanceEvidence.length,
      governance_lineage: governanceLineage.length,
      governance_library: governanceLibrary.length
    }
  });

  writeJson("lineage/transcription.json", workflow.lineageEdges);
  writeJson("lineage/report-create.json", reportCreate.lineageEdges);
  writeJson("lineage/report-review.json", reviewed.lineageEdges);
  writeJson("lineage/report-approve.json", approved.lineageEdges);
  writeJson("lineage/report-convert-presentation.json", conversion.lineageEdges);
  writeJson("lineage/presentation-native.json", presentationBundle.lineageEdges);
  writeJson("lineage/cross-engine-flow.json", {
    bundle_to_report: {
      from_ref: workflow.bundle.artifact_ref,
      to_ref: reportCreate.reportArtifact.artifact_id,
      transform_ref: "transcription.report_handoff.consume"
    },
    report_to_presentation: {
      from_ref: reportCreate.reportArtifact.artifact_id,
      to_ref: presentationBundle.deckArtifact.artifact_id,
      transform_ref: "reports.convert.to_presentation"
    },
    presentation_to_dashboard: {
      from_ref: presentationBundle.deckArtifact.artifact_id,
      to_ref: dashboardId,
      transform_ref: "presentations.convert.to_dashboard"
    },
    dashboard_to_publish: {
      from_ref: dashboardId,
      to_ref: publishPayload.publication.publication_id,
      transform_ref: "dashboards.publish"
    },
    dashboard_to_share: {
      from_ref: dashboardId,
      to_ref: sharePayload.publication.publication_id,
      transform_ref: "dashboards.share"
    },
    dashboard_to_export: {
      from_ref: dashboardId,
      to_ref: exportTargetPayload.transfer.transfer_id,
      transform_ref: "dashboards.export_widget_target"
    },
    dashboard_to_library: {
      from_ref: dashboardId,
      to_ref: libraryAssetId,
      transform_ref: "dashboards.publish.to_library"
    },
    library_to_governance: {
      from_ref: libraryAssetId,
      to_ref: governanceLibraryRecord?.asset_id ?? null,
      transform_ref: "governance.library.mirror"
    },
    verification_gate_edge: bundleVerificationLineagePath,
    presentation_bridge_lineage_path: bridge.bridge_lineage_path,
    governance_publish_lineage_path: governanceLineageRuntimePath
  });

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
  stopServer(dashboardServer);
  stopServer(presentationsServer);
  stopServer(reportServer);
  stopServer(transcriptionServer);
}
