import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";

const root = process.cwd();
const runId = `report-transcription-presentation-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "report-engine", "artifacts", "latest-run", runId);
const runtimeRoot = path.join(root, ".runtime", "report-transcription-presentation-proof", runId);
const fixtureRoot = path.join(runtimeRoot, "fixtures");
const host = "127.0.0.1";
const tenantRef = "tenant-report-cross-engine";
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
const pythonCandidates = [path.resolve(root, "..", ".venv311-strict", "Scripts", "python.exe"), "python"];
const pythonExecutable = pythonCandidates.find((candidate) => candidate === "python" || fs.existsSync(candidate));

if (!pythonExecutable) throw new Error("python executable is required for fixture generation");

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.rmSync(runtimeRoot, { recursive: true, force: true });
["records", "evidence", "audit", "lineage", "browser", "export", "intermediate"].forEach((folder) =>
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {}
    await wait(400);
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
const loginPage = async (page, baseUrl, selectors) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill(selectors.email, "admin");
  await page.fill(selectors.password, "1500");
  await page.fill(selectors.tenant, tenantRef);
  await Promise.all([page.waitForLoadState("networkidle"), page.click(selectors.submit)]);
};
const pageJson = (page, target, method = "GET", body = undefined) =>
  page.evaluate(
    async ({ target: pathTarget, method: requestMethod, body: requestBody }) => {
      const response = await fetch(pathTarget, {
        method: requestMethod,
        headers: requestBody ? { "content-type": "application/json" } : {},
        body: requestBody ? JSON.stringify(requestBody) : undefined
      });
      return { status: response.status, body: await response.json() };
    },
    { target, method, body }
  );

const fixtures = await createFixtures();
const transcriptionPort = await getFreePort();
const reportPort = await getFreePort();
const presentationsPort = await getFreePort();
const transcriptionBaseUrl = `http://${host}:${transcriptionPort}`;
const reportBaseUrl = `http://${host}:${reportPort}`;
const presentationsBaseUrl = `http://${host}:${presentationsPort}`;

let transcriptionServer = null;
let reportServer = null;
let presentationsServer = null;
let browser = null;

try {
  transcriptionServer = startNodeServer("transcription-serve-web", { host, port: transcriptionPort }, "transcription-web");
  reportServer = startNodeServer("report-start-platform", { host, port: reportPort }, "report-platform");
  presentationsServer = startNodeServer("presentations-serve-app", { host, port: presentationsPort }, "presentations-platform");
  await Promise.all([waitForServer(transcriptionBaseUrl), waitForServer(reportBaseUrl), waitForServer(presentationsBaseUrl)]);

  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

  const transcriptionPage = await context.newPage();
  await loginPage(transcriptionPage, transcriptionBaseUrl, {
    email: 'input[name="email"]',
    password: 'input[name="password"]',
    tenant: 'input[name="tenant_ref"]',
    submit: "#login-form button"
  });
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
  await loginPage(reportPage, reportBaseUrl, { email: "#email", password: "#password", tenant: "#tenantRef", submit: "#loginBtn" });
  await reportPage.waitForURL(`${reportBaseUrl}/reports`);
  const reportCreateResponse = await pageJson(reportPage, "/api/v1/reports/reports/create-from-transcription", "POST", {
    title: `Cross-Engine Report ${workflow.bundle.bundle_id}`,
    description: "Created from live /transcription outputs and consumed by /reports and /presentations.",
    language: "en-US",
    workflow: { job: workflow.job, bundle: workflow.bundle, report_handoff: workflow.reportHandoff, query_dataset: workflow.queryDataset },
    transcription_artifact_refs: [workflow.bundle.artifact_ref, workflow.bundle.transcript_artifact_ref, workflow.bundle.extraction_artifact_ref, workflow.bundle.summary_artifact_ref],
    transcription_runtime_refs: { report_handoff_path: reportHandoffPath, query_dataset_path: queryDatasetPath, verification_artifact_path: verificationArtifactPath, alignment_artifact_path: alignmentArtifactPath }
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
  const stateAfterConversion = reportDetail.state;
  const backSyncRecord = reportDetail.records.backSyncs.at(-1) ?? conversion.backSyncRecord ?? null;

  const presentationBundle = conversion.nativePresentationBundle;
  const presentationPublication = conversion.nativePresentationPublication;
  if (!presentationBundle || !presentationPublication) throw new Error("presentation conversion failed");
  const presentationsPage = await context.newPage();
  await loginPage(presentationsPage, presentationsBaseUrl, {
    email: 'input[name="email"]',
    password: 'input[name="password"]',
    tenant: 'input[name="tenantRef"]',
    submit: "#loginForm button"
  });
  await presentationsPage.goto(`${presentationsBaseUrl}/presentations/${presentationBundle.deck.deck_id}`, { waitUntil: "domcontentloaded" });
  await presentationsPage.waitForSelector("#readerFrame", { timeout: 120000 });
  const presentationLiveScreenshot = path.join(outputRoot, "browser", "presentation-live-deck.png");
  await presentationsPage.screenshot({ path: presentationLiveScreenshot, fullPage: true });

  const htmlExport = presentationBundle.exportArtifacts.find((entry) => entry.target === "html");
  const pdfExport = presentationBundle.exportArtifacts.find((entry) => entry.target === "pdf");
  const pptxExport = presentationBundle.exportArtifacts.find((entry) => entry.target === "pptx");
  if (!htmlExport || !pdfExport || !pptxExport) throw new Error("presentation exports incomplete");
  const finalHtmlContent = typeof htmlExport.content === "string" ? htmlExport.content : toBufferPayload(htmlExport.content).toString("utf8");
  const finalHtmlPath = writeText("export/final-presentation.html", finalHtmlContent);
  const finalPdfPath = writeBinary("export/final-presentation.pdf", toBufferPayload(pdfExport.content));
  const finalPptxPath = writeBinary("export/final-presentation.pptx", toBufferPayload(pptxExport.content));
  const previewHtmlPath = presentationBundle.previewArtifact?.html ? writeText("export/final-preview.html", presentationBundle.previewArtifact.html) : null;
  const finalFileScreenshot = await maybeCaptureHtmlScreenshot(finalHtmlPath, path.join(outputRoot, "browser", "final-presentation-file.png"));

  const reportRuntimeRoot = path.join(root, ".runtime", "report-engine", "reports", reportCreate.report.report_id);
  const presentationRuntimeRoot = path.join(root, ".runtime", "presentations-engine", "decks", presentationBundle.deck.deck_id);
  const reportEditablePath = path.join(reportRuntimeRoot, "state", "editable-report.json");
  const reportCurrentPath = path.join(reportRuntimeRoot, "state", "current.json");
  copyFileIntoProof(reportEditablePath, "intermediate/report-editable-report.json");
  copyFileIntoProof(reportCurrentPath, "intermediate/report-current-state.json");
  const presentationBundlePath = path.join(presentationRuntimeRoot, "state", "bundle.json");
  if (fs.existsSync(presentationBundlePath)) copyFileIntoProof(presentationBundlePath, "intermediate/presentation-bundle.json");

  const reportCurrent = JSON.parse(fs.readFileSync(reportCurrentPath, "utf8"));
  const reportBlocks = Array.isArray(reportCurrent.content_blocks) ? reportCurrent.content_blocks : [];
  const reportBindings = Array.isArray(reportCurrent.binding_set?.bindings) ? reportCurrent.binding_set.bindings : [];
  const reportPayloads = reportBlocks.map((block) => block.content_payload ?? {});
  const queryDatasetConsumedInReport = reportBindings.some((binding) => binding.dataset_ref === `dataset://transcription/${workflow.bundle.bundle_id}`);
  const reportHandoffConsumedInReportEngine = reportPayloads.some((payload) => payload.source_metadata?.source === "transcription-report-handoff");
  const queryDatasetVisibleInFinalOutput = finalHtmlContent.includes("INV-204") || finalHtmlContent.includes("Structured Extraction Dataset");
  const reportEngineIsLiveLoop =
    Boolean(backSyncRecord) &&
    reportBlocks.some(
      (block) =>
        String(block.title?.[0]?.value ?? "").includes("Back-Sync") ||
        block.content_payload?.source_metadata?.downstream_capability === "presentations"
    );
  if (!reportHandoffConsumedInReportEngine || !queryDatasetConsumedInReport || !queryDatasetVisibleInFinalOutput || !reportEngineIsLiveLoop) {
    throw new Error("cross-engine assertions failed");
  }

  const flowProof = {
    phase_requirement: "transcription-extraction-engine cross-engine flow proof",
    live_routes: {
      transcription: `${transcriptionBaseUrl}/transcription`,
      reports: `${reportBaseUrl}/reports/${reportCreate.report.report_id}`,
      presentations: `${presentationsBaseUrl}/presentations/${presentationBundle.deck.deck_id}`
    },
    runtime_paths: { transcription_job_root: transcriptionJobRoot, transcription_bundle_root: transcriptionBundleRoot, report_root: reportRuntimeRoot, presentation_root: presentationRuntimeRoot },
    artifacts: {
      report_handoff: reportHandoffPath,
      query_dataset: queryDatasetPath,
      verification_artifact: verificationArtifactPath,
      alignment_artifact: alignmentArtifactPath,
      report_current_state: reportCurrentPath,
      final_html: finalHtmlPath,
      final_pdf: finalPdfPath,
      final_pptx: finalPptxPath,
      final_preview_html: previewHtmlPath
    },
    screenshots: { transcription: transcriptionLiveScreenshot, reports_created: reportCreatedScreenshot, reports_converted: reportConvertedScreenshot, presentation_live: presentationLiveScreenshot, final_file: finalFileScreenshot },
    assertions: {
      transcription_exact_true: workflow.bundle.verification_gate.exact === true,
      report_handoff_consumed_in_report_engine: reportHandoffConsumedInReportEngine,
      query_dataset_consumed_in_report: queryDatasetConsumedInReport,
      query_dataset_visible_in_final_output: queryDatasetVisibleInFinalOutput,
      report_engine_is_live_loop: reportEngineIsLiveLoop
    },
    final_output: {
      report_id: reportCreate.report.report_id,
      deck_id: presentationBundle.deck.deck_id,
      publication_id: presentationPublication.publication.publication_id,
      publication_target_ref: presentationPublication.publication.target_ref
    }
  };

  writeJson("records/flow-proof.json", flowProof);
  writeJson("records/transcription-summary.json", { job_id: workflow.job.job_id, bundle_id: workflow.bundle.bundle_id, verification_gate: workflow.bundle.verification_gate });
  writeJson("records/report-create.json", { report_id: reportCreate.report.report_id, report_artifact_ref: reportCreate.reportArtifact.artifact_id, binding_set_ref: reportCreate.bindingSet.binding_set_id, source_refs: reportCreate.reportArtifact.source_refs });
  writeJson("records/report-review.json", { report_id: reviewed.report.report_id, review_state: reviewed.reviewState, report_status: reviewed.report.status });
  writeJson("records/report-approve.json", { report_id: approved.report.report_id, approval_state: approved.approvalState, report_status: approved.report.status });
  writeJson("records/report-to-presentation.json", { report_id: conversion.state.report.report_id, presentation_artifact_ref: conversion.artifact.artifact_id, back_sync_record: backSyncRecord });
  writeJson("records/presentation-publication.json", { deck_id: presentationBundle.deck.deck_id, deck_artifact_ref: presentationBundle.deckArtifact.artifact_id, publication_id: presentationPublication.publication.publication_id, export_artifact_refs: presentationBundle.exportArtifacts.map((entry) => entry.artifact.artifact_id) });

  writeJson("evidence/transcription.json", workflow.evidencePack);
  writeJson("evidence/report-create.json", reportCreate.evidencePack);
  writeJson("evidence/report-review.json", reviewed.evidencePack);
  writeJson("evidence/report-approve.json", approved.evidencePack);
  writeJson("evidence/report-convert-presentation.json", conversion.evidencePack);
  writeJson("evidence/report-back-sync.json", conversion.backSyncStage?.evidencePack ?? null);
  writeJson("evidence/presentation-native.json", presentationBundle.evidencePacks);
  writeJson("evidence/cross-engine-flow.json", { flow: "transcription -> reports -> presentations", screenshots: flowProof.screenshots, source_refs: reportCreate.reportArtifact.source_refs, final_output: flowProof.final_output });

  writeJson("audit/transcription.json", workflow.auditEvents);
  writeJson("audit/report-create.json", reportCreate.auditEvents);
  writeJson("audit/report-review.json", reviewed.auditEvents);
  writeJson("audit/report-approve.json", approved.auditEvents);
  writeJson("audit/report-convert-presentation.json", conversion.auditEvents);
  writeJson("audit/report-back-sync.json", conversion.backSyncStage?.auditEvents ?? []);
  writeJson("audit/presentation-native.json", presentationBundle.auditEvents);
  writeJson("audit/cross-engine-flow.json", { exactness_audit_path: exactnessAuditPath, counts: { transcription: workflow.auditEvents.length, report_create: reportCreate.auditEvents.length, report_review: reviewed.auditEvents.length, report_approve: approved.auditEvents.length, report_convert: conversion.auditEvents.length, report_back_sync: conversion.backSyncStage?.auditEvents?.length ?? 0, presentation_native: presentationBundle.auditEvents.length } });

  writeJson("lineage/transcription.json", workflow.lineageEdges);
  writeJson("lineage/report-create.json", reportCreate.lineageEdges);
  writeJson("lineage/report-review.json", reviewed.lineageEdges);
  writeJson("lineage/report-approve.json", approved.lineageEdges);
  writeJson("lineage/report-convert-presentation.json", conversion.lineageEdges);
  writeJson("lineage/report-back-sync.json", conversion.backSyncStage?.lineageEdges ?? []);
  writeJson("lineage/presentation-native.json", presentationBundle.lineageEdges);
  writeJson("lineage/cross-engine-flow.json", {
    bundle_to_report: { from_ref: workflow.bundle.artifact_ref, to_ref: reportCreate.reportArtifact.artifact_id, transform_ref: "transcription.report_handoff.consume" },
    query_dataset_to_report: { from_ref: queryDatasetPath, to_ref: reportCreate.reportArtifact.artifact_id, transform_ref: "transcription.query_dataset.consume" },
    report_to_presentation: { from_ref: reportCreate.reportArtifact.artifact_id, to_ref: presentationBundle.deckArtifact.artifact_id, transform_ref: "reports.convert.to_presentation" },
    verification_gate_edge: bundleVerificationLineagePath
  });

  console.log(JSON.stringify({ runId, outputRoot, runtimeRoot, flowProof: path.join(outputRoot, "records", "flow-proof.json"), finalOutput: { html: finalHtmlPath, pdf: finalPdfPath, pptx: finalPptxPath } }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => undefined);
  stopServer(presentationsServer);
  stopServer(reportServer);
  stopServer(transcriptionServer);
}
