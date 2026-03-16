import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ExcelJS from "exceljs";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const { TranscriptionExtractionEngine } = await load("packages/transcription-extraction-engine/dist/index.js");
const { ReportEngine } = await load("packages/report-engine/dist/index.js");
const { startReportPlatformServer } = await load("packages/report-engine/dist/platform.js");

const runId = `report-cross-engine-flow-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "report-engine", "artifacts", "latest-run", runId);
const runtimeBaseRoot = path.join(root, ".runtime", "report-cross-engine-flow");
const runtimeRoot = path.join(runtimeBaseRoot, runId);
const transcriptionRoot = path.join(runtimeRoot, "transcription-engine");
const reportRoot = path.join(runtimeRoot, "report-engine");
const fixtureRoot = path.join(runtimeRoot, "fixtures", runId);
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
const pythonCandidates = [
  path.resolve(root, "..", ".venv311-strict", "Scripts", "python.exe"),
  "python"
];
const pythonExecutable = pythonCandidates.find((candidate) => candidate === "python" || fs.existsSync(candidate));
const transcriptionSchemaNamespace = "rasid.shared.transcription.v1";
const transcriptionSchemaVersion = "1.0.0";

if (!pythonExecutable) {
  throw new Error("No python executable available for transcription fixture generation.");
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outputRoot, "records"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "evidence"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "audit"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "lineage"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "export"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "browser"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "intermediate"), { recursive: true });
fs.mkdirSync(runtimeBaseRoot, { recursive: true });

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

const runPowerShell = (script) => {
  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "PowerShell command failed");
  }
};

const runPython = (script) => {
  const result = spawnSync(pythonExecutable, ["-c", script], { encoding: "utf8" });
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

root = Path(r"""${fixtureRoot}""")
root.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default()

page1 = Image.new("RGB", (1400, 1000), "white")
draw = ImageDraw.Draw(page1)
draw.text((80, 60), "Board Review Dossier", fill="black", font=font)
draw.text((80, 120), "Section 1: Executive Summary", fill="black", font=font)
draw.text((80, 180), "Revenue reached 125 USD on 2026-03-05. Owner: Noura. Status: On track.", fill="black", font=font)
draw.text((80, 260), "Table 1: Regional Cases", fill="black", font=font)
headers = ["Region", "Cases", "Amount"]
rows = [["Riyadh", "8", "125"], ["Jeddah", "3", "90"], ["Dammam", "2", "65"]]
for index, header in enumerate(headers):
    x = 80 + index * 240
    draw.rectangle((x, 320, x + 200, 380), outline="black", width=2)
    draw.text((x + 12, 340), header, fill="black", font=font)
for row_index, row in enumerate(rows):
    for col_index, value in enumerate(row):
        x = 80 + col_index * 240
        y = 380 + row_index * 70
        draw.rectangle((x, y, x + 200, y + 70), outline="black", width=2)
        draw.text((x + 12, y + 25), value, fill="black", font=font)

page2 = Image.new("RGB", (1400, 1000), "white")
draw2 = ImageDraw.Draw(page2)
draw2.text((80, 60), "Section 2: Risks and Actions", fill="black", font=font)
draw2.text((80, 140), "Chart 1: Revenue Trend", fill="black", font=font)
draw2.rectangle((120, 220, 250, 760), outline="black", width=2)
draw2.rectangle((320, 320, 450, 760), outline="black", width=2)
draw2.rectangle((520, 180, 650, 760), outline="black", width=2)
draw2.text((120, 780), "Jan", fill="black", font=font)
draw2.text((320, 780), "Feb", fill="black", font=font)
draw2.text((520, 780), "Mar", fill="black", font=font)
draw2.text((80, 860), "Caption: March closed above target. Link: https://example.com/board-review", fill="black", font=font)

source_pdf = root / "source-dossier-scan.pdf"
page1.save(source_pdf, "PDF", resolution=150.0, save_all=True, append_images=[page2])

poster = Image.new("RGB", (1280, 720), "#f4efe6")
poster_draw = ImageDraw.Draw(poster)
poster_draw.text((120, 140), "Live Meeting Capture\\nRevenue 125 USD\\nInvoice INV-204\\nPrepare executive report", fill="#10243b", font=font, spacing=24)
poster_path = root / "video-poster.png"
poster.save(poster_path)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([
    ffmpeg, "-y", "-loop", "1", "-i", str(poster_path), "-i", str(root / "meeting-audio.wav"),
    "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(root / "meeting-video.mp4")
], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
`);

  await createWorkbook(workbookPath, [
    ["Region", "CaseId", "Amount", "Date", "Owner"],
    ["Riyadh", "INV-204", 125, "2026-03-05", "Noura"],
    ["Jeddah", "INV-201", 90, "2026-03-04", "Amal"],
    ["Dammam", "INV-199", 65, "2026-03-03", "Faisal"]
  ]);

  return { audioPath, videoPath, scannedPdfPath, workbookPath };
};

const toAttachment = (filePath, inputKind) => ({
  schema_namespace: transcriptionSchemaNamespace,
  schema_version: transcriptionSchemaVersion,
  attachment_id: path.basename(filePath, path.extname(filePath)),
  file_name: path.basename(filePath),
  file_path: filePath,
  content_base64: null,
  media_type:
    filePath.endsWith(".wav") ? "audio/wav" :
    filePath.endsWith(".mp4") ? "video/mp4" :
    filePath.endsWith(".pdf") ? "application/pdf" :
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  input_kind: inputKind,
  external_ref: null,
  batch_ref: "batch-cross-engine-flow"
});

const pickText = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((entry) => pickText(entry)).filter(Boolean).join(" | ");
  if (value && typeof value === "object") {
    for (const key of ["text", "normalized_text", "value", "title", "label", "name", "summary", "caption"]) {
      if (key in value) {
        const picked = pickText(value[key]);
        if (picked) return picked;
      }
    }
    return JSON.stringify(value);
  }
  return "";
};

const normalizeTableRows = (table) => {
  const headers = Array.isArray(table.headers)
    ? table.headers.map((entry) => pickText(entry))
    : Array.isArray(table.columns)
      ? table.columns.map((entry) => pickText(entry))
      : [];
  const rawRows = Array.isArray(table.rows) ? table.rows : [];
  const rows = rawRows.map((row) => {
    if (Array.isArray(row)) return row.map((entry) => pickText(entry));
    if (row && typeof row === "object" && headers.length > 0) return headers.map((header) => pickText(row[header]));
    return [pickText(row)];
  });
  return headers.length > 0 ? [headers, ...rows] : rows;
};

const sectionBodyFromRefs = (bundle, segmentRefs) => {
  if (!Array.isArray(segmentRefs) || segmentRefs.length === 0) return "";
  return segmentRefs
    .map((segmentRef) => bundle.segments.find((segment) => segment.segment_id === segmentRef))
    .filter(Boolean)
    .map((segment) => segment.normalized_text || segment.original_text || "")
    .filter(Boolean)
    .join("\n\n");
};

const buildReportSections = (workflow) => {
  const handoff = workflow.reportHandoff;
  const sections = [];
  const executiveSummary = pickText(handoff.executive_summary);
  if (executiveSummary) {
    sections.push({
      section_kind: "executive_summary",
      title: "Executive Summary",
      blocks: [
        {
          block_type: "narrative",
          title: "Executive Summary",
          body: executiveSummary,
          citations: Array.isArray(handoff.source_refs) ? handoff.source_refs : [],
          source_metadata: {
            source: "transcription-report-handoff",
            verification_gate: workflow.bundle.verification_gate,
            bundle_id: workflow.bundle.bundle_id
          },
          source_lineage_refs: workflow.lineageEdges.slice(0, 5).map((edge) => edge.edge_id)
        }
      ]
    });
  }

  const handoffSections = Array.isArray(handoff.sections) ? handoff.sections : [];
  handoffSections.forEach((section, index) => {
    const sectionTitle = pickText(section.title) || `Section ${index + 1}`;
    const segmentRefs = Array.isArray(section.segment_refs) ? section.segment_refs : [];
    const body = sectionBodyFromRefs(workflow.bundle, segmentRefs) || `Source: ${pickText(section.source_ref) || workflow.bundle.bundle_id}`;
    sections.push({
      section_kind: index === 0 && !executiveSummary ? "executive_summary" : "body",
      title: sectionTitle,
      blocks: [
        {
          block_type: "narrative",
          title: sectionTitle,
          body,
          citations: segmentRefs,
          source_metadata: {
            source_ref: pickText(section.source_ref),
            segment_refs: segmentRefs,
            bundle_id: workflow.bundle.bundle_id
          },
          source_lineage_refs: workflow.lineageEdges
            .filter((edge) => segmentRefs.includes(edge.from_ref) || segmentRefs.includes(edge.to_ref))
            .map((edge) => edge.edge_id)
        }
      ]
    });
  });

  if (Array.isArray(handoff.tables) && handoff.tables.length > 0) {
    sections.push({
      section_kind: "appendix",
      title: "Extracted Tables",
      blocks: handoff.tables.slice(0, 3).map((table, index) => ({
        block_type: "table",
        title: pickText(table.title) || pickText(table.caption) || `Table ${index + 1}`,
        body: pickText(table.summary),
        table_rows: normalizeTableRows(table),
        caption: pickText(table.caption),
        citations: [pickText(table.source_ref)].filter(Boolean),
        source_metadata: {
          table_ref: pickText(table.table_id),
          source_ref: pickText(table.source_ref),
          extracted_from: "transcription"
        },
        source_lineage_refs: workflow.lineageEdges
          .filter((edge) => edge.from_ref === table.table_id || edge.to_ref === table.table_id)
          .map((edge) => edge.edge_id)
      }))
    });
  }

  const actionItems = Array.isArray(handoff.action_items) ? handoff.action_items : [];
  if (actionItems.length > 0) {
    sections.push({
      section_kind: "appendix",
      title: "Action Items",
      blocks: [
        {
          block_type: "commentary",
          title: "Action Items",
          body: actionItems.map((item, index) => `${index + 1}. ${pickText(item.description || item.title || item)}`).join("\n"),
          citations: Array.isArray(handoff.source_refs) ? handoff.source_refs : [],
          source_metadata: {
            action_item_count: actionItems.length,
            bundle_id: workflow.bundle.bundle_id
          },
          source_lineage_refs: workflow.lineageEdges.slice(-5).map((edge) => edge.edge_id)
        }
      ]
    });
  }

  return sections;
};

const filePathFromArtifact = (artifact) => {
  const uri = artifact?.storage_ref?.uri;
  if (!uri) return null;
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
};

const maybeCaptureHtmlScreenshot = async (htmlPath, targetPath) => {
  if (!browserExecutablePath || !fs.existsSync(htmlPath)) return null;
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: browserExecutablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.screenshot({ path: targetPath, fullPage: true });
    return targetPath;
  } finally {
    await browser.close();
  }
};

const maybeCaptureUrlScreenshot = async (url, targetPath, waitFor = 1200) => {
  if (!browserExecutablePath) return null;
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: browserExecutablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(url, { waitUntil: "networkidle" });
    if (waitFor > 0) {
      await page.waitForTimeout(waitFor);
    }
    await page.screenshot({ path: targetPath, fullPage: true });
    return targetPath;
  } finally {
    await browser.close();
  }
};

const requestJson = async (url, { method = "GET", headers = {}, body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${url} failed with ${response.status}: ${text}`);
  }
  return payload;
};

const writeFetchedBinary = async (url, relativePath, headers = {}) => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return writeBinary(relativePath, buffer);
};

const fixtures = await createFixtures();
const reportProofMarker = `dashboard-marker-${runId.slice(-12)}`;

const transcriptionEngine = new TranscriptionExtractionEngine({ storageDir: transcriptionRoot });
const transcriptionRequest = {
  schema_namespace: transcriptionSchemaNamespace,
  schema_version: transcriptionSchemaVersion,
  request_id: `request-cross-engine-${Date.now()}`,
  tenant_ref: "tenant-report-cross-engine",
  workspace_id: "workspace-report-cross-engine",
  project_id: "project-report-cross-engine",
  created_by: "user-report-cross-engine",
  mode: "advanced",
  attachments: [
    toAttachment(fixtures.audioPath, "audio_file"),
    toAttachment(fixtures.videoPath, "video_file"),
    toAttachment(fixtures.scannedPdfPath, "pdf"),
    toAttachment(fixtures.workbookPath, "spreadsheet_file")
  ],
  options: {
    language_hint: "en",
    enable_ocr: true,
    enable_table_extraction: true,
    enable_qa_seeds: true,
    enable_comparisons: true
  },
  requested_at: new Date().toISOString()
};

const transcriptionWorkflow = await transcriptionEngine.ingestAndExtract(transcriptionRequest);
const reportEngine = new ReportEngine({ storageDir: reportRoot });
const reportCreate = reportEngine.createReport({
  tenant_ref: transcriptionRequest.tenant_ref,
  workspace_id: transcriptionRequest.workspace_id,
  project_id: transcriptionRequest.project_id,
  created_by: "report-author-cross-engine",
  title: `Cross-Engine Report from ${transcriptionWorkflow.bundle.bundle_id}`,
  description: "Editable report created from live transcription handoff and converted to a native presentation.",
  report_type: "transcription_report",
  mode: "advanced",
  language: "en-US",
  source_refs: [
    transcriptionWorkflow.bundle.bundle_id,
    transcriptionWorkflow.bundleArtifact.artifact_id,
    transcriptionWorkflow.transcriptArtifact.artifact_id,
    transcriptionWorkflow.extractionArtifact.artifact_id,
    transcriptionWorkflow.summaryArtifact.artifact_id
  ],
  sections: buildReportSections(transcriptionWorkflow).concat([
    {
      section_kind: "appendix",
      title: "Cross-Engine Dashboard Marker",
      blocks: [
        {
          block_type: "commentary",
          title: `Dashboard marker ${reportProofMarker}`,
          body: `Current live report state marker ${reportProofMarker} proves downstream dashboard consumption from this exact report run.`,
          citations: [transcriptionWorkflow.bundle.bundle_id],
          source_metadata: {
            source: "report-cross-engine-flow-regression",
            proof_marker: reportProofMarker,
            report_run_id: runId
          },
          source_lineage_refs: transcriptionWorkflow.lineageEdges.slice(0, 3).map((edge) => edge.edge_id)
        }
      ]
    }
  ])
});

const reviewed = reportEngine.reviewReport({
  report_id: reportCreate.report.report_id,
  actor_ref: "reviewer-report-cross-engine",
  reviewer_refs: ["qa-report-cross-engine"],
  decision: "reviewed",
  comment: "Live transcription handoff reviewed for deck generation."
});

const approved = reportEngine.approveReport({
  report_id: reportCreate.report.report_id,
  actor_ref: "approver-report-cross-engine",
  decision: "approved",
  comment: "Approved for cross-engine presentation generation."
});

const reportPlatform = await startReportPlatformServer({
  host: "127.0.0.1",
  port: 0,
  engine: reportEngine
});

const conversion = await reportEngine.convertReportToPresentation({
  report_id: reportCreate.report.report_id,
  actor_ref: "presenter-report-cross-engine",
  target_ref: "workspace://presentations/report-cross-engine-flow"
});

const stateAfterConversion = reportEngine.store.loadState(reportCreate.report.report_id);
const backSyncRecord = conversion.backSyncRecord ?? reportEngine.store.listBackSyncRecords(reportCreate.report.report_id).at(-1) ?? null;
const presentationBundle = conversion.nativePresentationBundle;
const presentationPublication = conversion.nativePresentationPublication;

if (!presentationBundle || !presentationPublication) {
  throw new Error("Native presentation conversion did not complete.");
}

const finalHtml = presentationBundle.exportArtifacts.find((entry) => entry.target === "html");
const finalPdf = presentationBundle.exportArtifacts.find((entry) => entry.target === "pdf");
const finalPptx = presentationBundle.exportArtifacts.find((entry) => entry.target === "pptx");

if (!finalHtml || !finalPdf || !finalPptx) {
  throw new Error("Final presentation outputs are incomplete.");
}

const finalHtmlPath = writeText("export/final-presentation.html", typeof finalHtml.content === "string" ? finalHtml.content : Buffer.from(finalHtml.content).toString("utf8"));
const finalPdfPath = writeBinary("export/final-presentation.pdf", finalPdf.content);
const finalPptxPath = writeBinary("export/final-presentation.pptx", finalPptx.content);
const previewHtmlPath =
  presentationBundle.previewArtifact?.html && typeof presentationBundle.previewArtifact.html === "string"
    ? writeText("export/final-preview.html", presentationBundle.previewArtifact.html)
    : null;
const finalScreenshotPath = await maybeCaptureHtmlScreenshot(finalHtmlPath, path.join(outputRoot, "browser", "final-presentation.png"));

const transcriptionJobRoot = path.join(transcriptionRoot, "jobs", transcriptionWorkflow.job.job_id);
const transcriptionBundleRoot = path.join(transcriptionRoot, "bundles", transcriptionWorkflow.bundle.bundle_id);
const reportRuntimeRoot = path.join(reportRoot, "reports", reportCreate.report.report_id);
const presentationRuntimeRoot = path.join(root, ".runtime", "presentations-engine", "decks", presentationBundle.deck.deck_id);

const reportHandoffPath = path.join(transcriptionJobRoot, "artifacts", "report-handoff.json");
const reportEditablePath = path.join(reportRuntimeRoot, "state", "editable-report.json");
const reportCurrentPath = path.join(reportRuntimeRoot, "state", "current.json");

copyFileIntoProof(reportHandoffPath, "intermediate/transcription-report-handoff.json");
copyFileIntoProof(reportEditablePath, "intermediate/report-editable-report.json");
copyFileIntoProof(reportCurrentPath, "intermediate/report-current-state.json");

const loginResponse = await requestJson(`${reportPlatform.origin}/api/v1/governance/auth/login`, {
  method: "POST",
  body: {
    email: "admin",
    password: "1500",
    tenantRef: transcriptionRequest.tenant_ref
  }
});
const accessToken = loginResponse.data.accessToken;
const tenantRef = loginResponse.data.tenantRef;
const authHeaders = {
  authorization: `Bearer ${accessToken}`,
  "x-tenant-id": tenantRef
};
const reportDetailBefore = await requestJson(`${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}`, {
  headers: authHeaders
});
const dashboardConversionRoute = await requestJson(
  `${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}/convert/dashboard`,
  {
    method: "POST",
    headers: authHeaders,
    body: {
      target_ref: `platform://dashboards/${reportCreate.report.report_id}`
    }
  }
);
const reportPublishRoute = await requestJson(
  `${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}/publish`,
  {
    method: "POST",
    headers: authHeaders,
    body: {
      target_ref: `platform://reports/published/${reportCreate.report.report_id}`
    }
  }
);
const exportHtmlRoute = await requestJson(
  `${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}/export/html`,
  {
    method: "POST",
    headers: authHeaders,
    body: {}
  }
);
const exportPdfRoute = await requestJson(
  `${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}/export/pdf`,
  {
    method: "POST",
    headers: authHeaders,
    body: {}
  }
);
const exportDocxRoute = await requestJson(
  `${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}/export/docx`,
  {
    method: "POST",
    headers: authHeaders,
    body: {}
  }
);
const reportDetailAfter = await requestJson(`${reportPlatform.origin}/api/v1/reports/reports/${encodeURIComponent(reportCreate.report.report_id)}`, {
  headers: authHeaders
});

const dashboardPlatformResult = dashboardConversionRoute.data;
const nativeDashboardWorkflow = dashboardPlatformResult.nativeDashboardWorkflow;
const nativeDashboardPublication = dashboardPlatformResult.nativeDashboardPublication;
if (!nativeDashboardWorkflow || !nativeDashboardPublication) {
  throw new Error("Report platform dashboard conversion did not produce a native dashboard publication.");
}
const dashboardWidgetTitles = nativeDashboardWorkflow.dashboard.widgets.map((widget) => widget.title);
const dashboardMarkerVisible = dashboardWidgetTitles.some((title) => `${title}`.includes(reportProofMarker));
if (!dashboardMarkerVisible) {
  throw new Error(`Dashboard publication did not include live report marker ${reportProofMarker}.`);
}

const dashboardManifestUrl = nativeDashboardPublication.transport.served_manifest_url;
const dashboardStateUrl = nativeDashboardPublication.transport.served_publish_state_url;
const dashboardEmbedPayloadUrl = nativeDashboardPublication.transport.served_embed_payload_url;
const dashboardEmbedUrl = nativeDashboardPublication.transport.served_embed_html_url;
if (!dashboardEmbedPayloadUrl || !dashboardEmbedUrl) {
  throw new Error("Dashboard publication did not expose served embed URLs.");
}
const dashboardManifest = await requestJson(dashboardManifestUrl);
const dashboardState = await requestJson(dashboardStateUrl);
const dashboardEmbedPayload = await requestJson(dashboardEmbedPayloadUrl);
const dashboardEmbedMarkerVisible = Array.isArray(dashboardEmbedPayload.widgets)
  && dashboardEmbedPayload.widgets.some((widget) => `${widget.title}`.includes(reportProofMarker));
if (!dashboardEmbedMarkerVisible) {
  throw new Error(`Dashboard embed payload did not include live report marker ${reportProofMarker}.`);
}

const reportPublicationResult = reportPublishRoute.data;
const reportPublicationTransport = reportPublicationResult.transport;
if (!reportPublicationTransport?.served_export_html_url || !reportPublicationTransport?.served_manifest_url) {
  throw new Error("Report publish route did not return a live transport bundle.");
}
const reportManifest = await requestJson(reportPublicationTransport.served_manifest_url);
const reportPublishState = await requestJson(reportPublicationTransport.served_publish_state_url);
const reportEmbedPayload = reportPublicationTransport.served_embed_payload_url
  ? await requestJson(reportPublicationTransport.served_embed_payload_url)
  : null;
const reportPublicPageUrl = `${reportPlatform.origin}/published/reports/${reportPublicationResult.publication.publication_id}`;
const reportDetailPageUrl = `${reportPlatform.origin}/reports/${reportCreate.report.report_id}`;
const reportExportHtmlUrl = `${reportPlatform.origin}${exportHtmlRoute.data.url}`;
const reportExportPdfUrl = `${reportPlatform.origin}${exportPdfRoute.data.url}`;
const reportExportDocxUrl = `${reportPlatform.origin}${exportDocxRoute.data.url}`;
const reportExportHtmlSourcePath = filePathFromArtifact(exportHtmlRoute.data.exportArtifact);
const reportExportPdfSourcePath = filePathFromArtifact(exportPdfRoute.data.exportArtifact);
const reportExportDocxSourcePath = filePathFromArtifact(exportDocxRoute.data.exportArtifact);
if (!reportExportHtmlSourcePath || !reportExportPdfSourcePath || !reportExportDocxSourcePath) {
  throw new Error("One or more report export artifacts did not resolve to a local file path.");
}

const finalReportHtmlPath = copyFileIntoProof(reportExportHtmlSourcePath, "export/final-report.html");
const finalReportPdfPath = copyFileIntoProof(reportExportPdfSourcePath, "export/final-report.pdf");
const finalReportDocxPath = copyFileIntoProof(reportExportDocxSourcePath, "export/final-report.docx");
const reportDetailScreenshotPath = await maybeCaptureUrlScreenshot(
  reportDetailPageUrl,
  path.join(outputRoot, "browser", "report-platform-detail.png")
);
const dashboardScreenshotPath = await maybeCaptureUrlScreenshot(
  dashboardEmbedUrl,
  path.join(outputRoot, "browser", "dashboard-from-report.png"),
  1800
);
const reportPublicationScreenshotPath = await maybeCaptureUrlScreenshot(
  reportPublicPageUrl,
  path.join(outputRoot, "browser", "published-report.png"),
  1800
);

writeJson("records/transcription-summary.json", {
  request_id: transcriptionRequest.request_id,
  job_id: transcriptionWorkflow.job.job_id,
  bundle_id: transcriptionWorkflow.bundle.bundle_id,
  bundle_artifact_ref: transcriptionWorkflow.bundleArtifact.artifact_id,
  report_handoff_title: transcriptionWorkflow.reportHandoff.title,
  section_count: Array.isArray(transcriptionWorkflow.reportHandoff.sections) ? transcriptionWorkflow.reportHandoff.sections.length : 0,
  table_count: Array.isArray(transcriptionWorkflow.reportHandoff.tables) ? transcriptionWorkflow.reportHandoff.tables.length : 0,
  verification_gate: transcriptionWorkflow.bundle.verification_gate,
  report_proof_marker: reportProofMarker
});

writeJson("records/report-create.json", {
  report_id: reportCreate.report.report_id,
  report_artifact_ref: reportCreate.reportArtifact.artifact_id,
  version_ref: reportCreate.version.version_ref.version_id,
  section_count: reportCreate.sections.length,
  source_refs: reportCreate.reportArtifact.source_refs,
  editable_state_path: reportEditablePath
});

writeJson("records/report-review.json", {
  report_id: reviewed.report.report_id,
  review_state: reviewed.reviewState,
  report_status: reviewed.report.status
});

writeJson("records/report-approve.json", {
  report_id: approved.report.report_id,
  approval_state: approved.approvalState,
  report_status: approved.report.status
});

writeJson("records/report-to-presentation.json", {
  report_id: conversion.state.report.report_id,
  presentation_artifact_ref: conversion.artifact.artifact_id,
  payload: conversion.payload,
  back_sync_record: backSyncRecord,
  post_conversion_section_count: stateAfterConversion.sections.length
});

writeJson("records/presentation-publication.json", {
  deck_id: presentationBundle.deck.deck_id,
  deck_artifact_ref: presentationBundle.deckArtifact.artifact_id,
  publication_id: presentationPublication.publication.publication_id,
  publication_target_ref: presentationPublication.publication.target_ref,
  export_artifact_refs: presentationBundle.exportArtifacts.map((entry) => entry.artifact.artifact_id),
  final_output: {
    html: finalHtmlPath,
    pdf: finalPdfPath,
    pptx: finalPptxPath,
    preview_html: previewHtmlPath,
    screenshot: finalScreenshotPath
  }
});

writeJson("records/report-platform-login.json", loginResponse);
writeJson("records/report-platform-detail-before.json", reportDetailBefore);
writeJson("records/report-platform-detail-after.json", reportDetailAfter);
writeJson("records/report-to-dashboard-platform.json", dashboardConversionRoute);
writeJson("records/dashboard-publication-manifest.json", dashboardManifest);
writeJson("records/dashboard-publication-state.json", dashboardState);
writeJson("records/dashboard-publication-embed-payload.json", dashboardEmbedPayload);
writeJson("records/report-publish-platform.json", reportPublishRoute);
writeJson("records/report-publication-manifest.json", reportManifest);
writeJson("records/report-publication-state.json", reportPublishState);
writeJson("records/report-publication-embed-payload.json", reportEmbedPayload);
writeJson("records/report-export-html.json", exportHtmlRoute);
writeJson("records/report-export-pdf.json", exportPdfRoute);
writeJson("records/report-export-docx.json", exportDocxRoute);

const flowProof = {
  entrypoint: {
    script: path.join(root, "scripts", "report-cross-engine-flow-regression.mjs"),
    transcription_request_id: transcriptionRequest.request_id,
    flow: ["transcription-extraction-engine", "report-engine", "presentations-engine", "dashboard-engine", "report-platform"]
  },
  runtime_paths: {
    transcription_job_root: transcriptionJobRoot,
    transcription_bundle_root: transcriptionBundleRoot,
    report_root: reportRuntimeRoot,
    presentation_root: presentationRuntimeRoot,
    report_platform_origin: reportPlatform.origin,
    dashboard_publication_url: dashboardEmbedUrl,
    report_publication_url: reportPublicPageUrl
  },
  artifacts: {
    transcription_report_handoff: reportHandoffPath,
    editable_report_state: reportEditablePath,
    report_current_state: reportCurrentPath,
    final_html: finalHtmlPath,
    final_pdf: finalPdfPath,
    final_pptx: finalPptxPath,
    final_preview_html: previewHtmlPath,
    final_screenshot: finalScreenshotPath,
    final_report_html: finalReportHtmlPath,
    final_report_pdf: finalReportPdfPath,
    final_report_docx: finalReportDocxPath,
    report_platform_detail_screenshot: reportDetailScreenshotPath,
    dashboard_publication_screenshot: dashboardScreenshotPath,
    report_publication_screenshot: reportPublicationScreenshotPath
  },
  final_output: {
    publication_id: presentationPublication.publication.publication_id,
    publication_target_ref: presentationPublication.publication.target_ref,
    html_path: finalHtmlPath,
    pdf_path: finalPdfPath,
    pptx_path: finalPptxPath,
    dashboard_publication_id: nativeDashboardPublication.publication.publication_id,
    report_publication_id: reportPublicationResult.publication.publication_id
  },
  assertions: {
    report_engine_is_live_loop: Boolean(backSyncRecord) && stateAfterConversion.sections.some((section) => section.title.some((entry) => `${entry.value}`.includes("Back-Sync"))),
    transcription_to_report_source_refs: reportCreate.reportArtifact.source_refs.includes(transcriptionWorkflow.bundleArtifact.artifact_id),
    presentation_export_count: presentationBundle.exportArtifacts.length,
    evidence_pack_count: (presentationBundle.evidencePacks?.length ?? 0) + 7,
    dashboard_marker_roundtrip: dashboardMarkerVisible && dashboardEmbedMarkerVisible,
    report_publish_live_transport: Boolean(reportPublicationTransport.served_export_html_url && reportPublicationTransport.served_manifest_url),
    report_export_routes_live: [finalReportHtmlPath, finalReportPdfPath, finalReportDocxPath].every(Boolean)
  }
};

if (!flowProof.assertions.report_engine_is_live_loop) {
  throw new Error("Report back-sync loop was not materialized.");
}
if (!flowProof.assertions.transcription_to_report_source_refs) {
  throw new Error("Report source refs do not include the transcription bundle artifact.");
}

writeJson("records/flow-proof.json", flowProof);

writeJson("evidence/transcription.json", transcriptionWorkflow.evidencePack);
writeJson("evidence/report-create.json", reportCreate.evidencePack);
writeJson("evidence/report-review.json", reviewed.evidencePack);
writeJson("evidence/report-approve.json", approved.evidencePack);
writeJson("evidence/report-convert-presentation.json", conversion.evidencePack);
writeJson("evidence/report-back-sync.json", conversion.backSyncStage?.evidencePack ?? null);
writeJson("evidence/presentation-native.json", presentationBundle.evidencePacks);
writeJson("evidence/report-convert-dashboard.json", dashboardPlatformResult.evidencePack);
writeJson("evidence/dashboard-native.json", nativeDashboardWorkflow.evidencePack);
writeJson("evidence/dashboard-publication-native.json", nativeDashboardPublication.evidencePack);
writeJson("evidence/report-publish.json", reportPublicationResult.evidencePack);

writeJson("audit/transcription.json", transcriptionWorkflow.auditEvents);
writeJson("audit/report-create.json", reportCreate.auditEvents);
writeJson("audit/report-review.json", reviewed.auditEvents);
writeJson("audit/report-approve.json", approved.auditEvents);
writeJson("audit/report-convert-presentation.json", conversion.auditEvents);
writeJson("audit/report-back-sync.json", conversion.backSyncStage?.auditEvents ?? []);
writeJson("audit/presentation-native.json", presentationBundle.auditEvents);
writeJson("audit/report-convert-dashboard.json", dashboardPlatformResult.auditEvents);
writeJson("audit/dashboard-native.json", nativeDashboardWorkflow.auditEvents);
writeJson("audit/dashboard-publication-native.json", nativeDashboardPublication.auditEvents);
writeJson("audit/report-publish.json", reportPublicationResult.auditEvents);

writeJson("lineage/transcription.json", transcriptionWorkflow.lineageEdges);
writeJson("lineage/report-create.json", reportCreate.lineageEdges);
writeJson("lineage/report-review.json", reviewed.lineageEdges);
writeJson("lineage/report-approve.json", approved.lineageEdges);
writeJson("lineage/report-convert-presentation.json", conversion.lineageEdges);
writeJson("lineage/report-back-sync.json", conversion.backSyncStage?.lineageEdges ?? []);
writeJson("lineage/presentation-native.json", presentationBundle.lineageEdges);
writeJson("lineage/report-convert-dashboard.json", dashboardPlatformResult.lineageEdges);
writeJson("lineage/dashboard-native.json", nativeDashboardWorkflow.lineageEdges);
writeJson("lineage/dashboard-publication-native.json", nativeDashboardPublication.lineageEdges);
writeJson("lineage/report-publish.json", reportPublicationResult.lineageEdges);

writeJson("records/evidence-pack.json", {
  flow: "transcription -> reports -> presentations / dashboards / publish / export",
  stages: [
    transcriptionWorkflow.evidencePack.evidence_pack_id,
    reportCreate.evidencePack.evidence_pack_id,
    reviewed.evidencePack.evidence_pack_id,
    approved.evidencePack.evidence_pack_id,
    conversion.evidencePack.evidence_pack_id,
    conversion.backSyncStage?.evidencePack?.evidence_pack_id ?? null,
    dashboardPlatformResult.evidencePack?.evidence_pack_id ?? null,
    nativeDashboardWorkflow.evidencePack?.evidence_pack_id ?? null,
    nativeDashboardPublication.evidencePack?.evidence_pack_id ?? null,
    reportPublicationResult.evidencePack?.evidence_pack_id ?? null
  ],
  native_presentation_evidence_pack_ids: presentationBundle.evidencePacks.map((entry) => entry.evidence_pack_id)
});

try {
  console.log(JSON.stringify({
    runId,
    outputRoot,
    runtimeRoot,
    flowProof: path.join(outputRoot, "records", "flow-proof.json"),
    finalOutput: {
      html: finalHtmlPath,
      pdf: finalPdfPath,
      pptx: finalPptxPath,
      report_html: finalReportHtmlPath,
      report_pdf: finalReportPdfPath,
      report_docx: finalReportDocxPath,
      dashboard_publication_url: dashboardEmbedUrl,
      report_publication_url: reportPublicPageUrl
    }
  }, null, 2));
} finally {
  await reportPlatform.close();
}
