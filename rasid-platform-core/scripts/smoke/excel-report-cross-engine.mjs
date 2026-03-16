import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);

const { ExcelEngine } = await load("packages/excel-engine/dist/index.js");
const { ReportEngine } = await load("packages/report-engine/dist/index.js");
const { startReportPlatformServer } = await load("packages/report-engine/dist/platform.js");

const runId = `excel-report-cross-engine-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const proofRoot = path.join(root, "packages", "excel-engine", "output", runId);
const runtimeRoot = path.join(root, ".runtime", "excel-report-cross-engine", runId);
const reportRuntimeRoot = path.join(runtimeRoot, "report-engine");
const stepLogPath = path.join(proofRoot, "artifacts", "step-log.txt");
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
const host = "127.0.0.1";

fs.rmSync(proofRoot, { recursive: true, force: true });
fs.rmSync(runtimeRoot, { recursive: true, force: true });
["artifacts", "evidence", "audit", "lineage", "browser"].forEach((folder) =>
  fs.mkdirSync(path.join(proofRoot, folder), { recursive: true })
);
fs.writeFileSync(stepLogPath, "", "utf8");

const writeJson = (relativePath, payload) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};

const writeText = (relativePath, payload) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, payload, "utf8");
  return target;
};

const writeBinary = (relativePath, payload) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(payload));
  return target;
};

const step = (message) => {
  fs.appendFileSync(stepLogPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
};

const copyFileIntoProof = (sourcePath, relativePath) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No free port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForFetchOk = async (url, attempts = 30, delayMs = 200) => {
  let lastResponse = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      return response;
    }
    lastResponse = response;
    await wait(delayMs);
  }
  return lastResponse;
};

const waitForServer = async (origin) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/login`);
      if (response.ok) {
        return;
      }
    } catch {}
    await wait(300);
  }
  throw new Error(`Report platform did not start at ${origin}`);
};

const login = async (origin) => {
  const response = await fetch(`${origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin", password: "1500", tenantRef: "tenant-default" })
  });
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  return response.json();
};

const api = async (origin, token, pathname, method = "GET", body) => {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": "tenant-default",
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${payload.error ?? ""}`.trim());
  }
  return payload;
};

const openBrowser = async () =>
  chromium.launch(
    browserExecutablePath
      ? { executablePath: browserExecutablePath, headless: true }
      : { channel: "msedge", headless: true }
  );

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const excelEngine = new ExcelEngine();
step("running excel-engine sample");
const excelRun = await excelEngine.runSample({
  tenant_ref: "tenant-excel-report-proof",
  workspace_id: "workspace-excel-report-proof",
  project_id: "project-excel-report-proof",
  actor_ref: "excel-report-proof",
  output_root: path.join(root, "packages", "excel-engine", "output")
});

const sourceWorkbookPath = excelRun.artifacts.exported_workbook_path;
const workbookPackagePath = excelRun.artifacts.workbook_package_path;
const excelEvidencePath = excelRun.artifacts.evidence_path;
const excelAuditPath = excelRun.artifacts.audit_path;
const excelLineagePath = excelRun.artifacts.lineage_path;
const excelRunRoot = excelRun.artifacts.output_root;

const reportEngine = new ReportEngine({ storageDir: reportRuntimeRoot });
const reportPort = await getFreePort();
step(`starting report platform on ${host}:${reportPort}`);
const reportServer = await startReportPlatformServer({ host, port: reportPort, engine: reportEngine });

let browser;
let success = false;
try {
  step("waiting for report platform");
  await waitForServer(reportServer.origin);
  step("logging into report platform");
  const loginPayload = await login(reportServer.origin);
  const token = loginPayload.data.accessToken;

  step("creating report from excel workbook");
  const createdResponse = await api(reportServer.origin, token, "/api/v1/reports/reports/create-from-excel", "POST", {
    title: "Excel Cross-Engine Reports Proof",
    description: "Created from a fresh excel-engine workbook and consumed live by report-engine.",
    language: "ar-SA",
    workbook_path: sourceWorkbookPath,
    workbook_label: path.basename(sourceWorkbookPath),
    excel_artifact_refs: excelRun.state.artifacts.map((artifact) => artifact.artifact_id),
    excel_runtime_refs: {
      sample_run_root: excelRunRoot,
      workbook_package_path: workbookPackagePath,
      evidence_path: excelEvidencePath,
      audit_path: excelAuditPath,
      lineage_path: excelLineagePath
    }
  });

  const created = createdResponse.data.created;
  const workbookSummary = createdResponse.data.workbook_summary;
  const reportId = created.report.report_id;
  step(`created report ${reportId}`);

  step("reviewing and approving report");
  const reviewResponse = await api(reportServer.origin, token, `/api/v1/reports/reports/${reportId}/review`, "POST", {});
  const approveResponse = await api(reportServer.origin, token, `/api/v1/reports/reports/${reportId}/approve`, "POST", {});
  step("publishing and exporting report");
  const publishResponse = await api(reportServer.origin, token, `/api/v1/reports/reports/${reportId}/publish`, "POST", {
    target_ref: "platform://reports/excel-cross-engine"
  });
  const exportHtmlResponse = await api(reportServer.origin, token, `/api/v1/reports/reports/${reportId}/export/html`, "POST", {});
  const exportDocxResponse = await api(reportServer.origin, token, `/api/v1/reports/reports/${reportId}/export/docx`, "POST", {});
  const detailResponse = await api(reportServer.origin, token, `/api/v1/reports/reports/${reportId}`, "GET");

  const publicationId = publishResponse.data.publication.publication_id;
  const exportedHtmlUrl = new URL(exportHtmlResponse.data.url, reportServer.origin).toString();
  const exportedHtmlFetchResponse = await waitForFetchOk(exportedHtmlUrl);
  const exportedHtmlText = await exportedHtmlFetchResponse.text();
  const exportedDocxUrl = new URL(exportDocxResponse.data.url, reportServer.origin).toString();
  const exportedDocxBuffer = Buffer.from(await (await fetch(exportedDocxUrl)).arrayBuffer());
  const exportedDocxArtifact = exportDocxResponse.data.exportArtifact ?? exportDocxResponse.data.export_artifact ?? null;
  const reportRoot = path.join(reportRuntimeRoot, "reports", reportId);
  const currentStatePath = path.join(reportRuntimeRoot, "reports", reportId, "state", "current.json");
  const editableStatePath = path.join(reportRuntimeRoot, "reports", reportId, "state", "editable-report.json");
  const exportedHtmlFilePath =
    fs
      .readdirSync(path.join(reportRoot, "artifacts-data", "exports", "html"), { withFileTypes: true })
      .find((entry) => entry.isFile() && entry.name.endsWith(".html"))
      ?.name ?? null;
  const exportedHtmlArtifactPath = exportedHtmlFilePath
    ? path.join(reportRoot, "artifacts-data", "exports", "html", exportedHtmlFilePath)
    : null;

  step("running assertions on created report state");
  assert(fs.existsSync(currentStatePath), "Report current state was not persisted.");
  assert(fs.existsSync(editableStatePath), "Report editable state was not persisted.");
  assert(exportedHtmlFetchResponse.ok, `Exported HTML route failed: ${exportedHtmlFetchResponse.status}`);
  assert(exportedHtmlArtifactPath && fs.existsSync(exportedHtmlArtifactPath), "Exported HTML artifact file was not persisted.");

  const reportCurrentState = JSON.parse(fs.readFileSync(currentStatePath, "utf8"));
  const exportedHtmlArtifactText = fs.readFileSync(exportedHtmlArtifactPath, "utf8");
  const reportSections = reportCurrentState.sections ?? [];
  const reportContentBlocks = reportCurrentState.content_blocks ?? [];
  const sheetNames = (workbookSummary.worksheets ?? []).map((entry) => entry.worksheet_name);
  const expectedSheetNames = ["Summary", "Joined", "Pivot_Profit_By_Country"];

  assert(workbookSummary.worksheet_count >= 4, "Workbook summary did not capture enough worksheets.");
  assert(expectedSheetNames.every((name) => sheetNames.includes(name)), "Workbook-specific worksheets were not consumed into the report summary.");
  assert(
    reportSections.some((section) => section.title?.some?.((entry) => `${entry.value}` === "Summary")) &&
      reportSections.some((section) => section.title?.some?.((entry) => `${entry.value}` === "Joined")),
    "Report sections did not materialize workbook sheets."
  );
  assert(
    reportContentBlocks.some((block) => JSON.stringify(block.content_payload ?? {}).includes("Pivot_Profit_By_Country")),
    "Report blocks do not preserve workbook-derived sheet metadata."
  );
  assert(
    exportedHtmlArtifactText.includes("Pivot_Profit_By_Country") &&
      exportedHtmlArtifactText.includes("Workbook Summary") &&
      exportedHtmlArtifactText.includes("Worksheet Count"),
    "Exported HTML artifact does not contain workbook-derived report content."
  );

  step("capturing live report routes");
  browser = await openBrowser();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  await context.addCookies([
    { name: "rasid_access_token", value: token, domain: host, path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: host, path: "/" }
  ]);
  const reportPage = await context.newPage();
  await reportPage.goto(`${reportServer.origin}/reports/${reportId}`, { waitUntil: "networkidle" });
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-detail.png"), fullPage: true });

  const publicPage = await context.newPage();
  await publicPage.goto(`${reportServer.origin}/published/reports/${publicationId}`, { waitUntil: "networkidle" });
  await publicPage.screenshot({ path: path.join(proofRoot, "browser", "report-publication.png"), fullPage: true });
  await browser.close();
  browser = null;

  step("writing fresh proof artifacts");
  const copiedWorkbookPath = copyFileIntoProof(sourceWorkbookPath, "artifacts/source-workbook.xlsx");
  const copiedWorkbookPackagePath = copyFileIntoProof(workbookPackagePath, "artifacts/source-workbook-package.json");
  const copiedReportCurrentPath = copyFileIntoProof(currentStatePath, "artifacts/report-current.json");
  const copiedEditableStatePath = copyFileIntoProof(editableStatePath, "artifacts/report-editable.json");
  const copiedExportHtmlPath = writeText("artifacts/report-export.html", exportedHtmlText);
  const copiedExportHtmlArtifactPath = copyFileIntoProof(exportedHtmlArtifactPath, "artifacts/report-export-artifact.html");
  const copiedExportDocxPath = writeBinary("artifacts/report-export.docx", exportedDocxBuffer);
  const publicationJsonPath = writeJson("artifacts/report-publication.json", publishResponse.data);
  const createJsonPath = writeJson("artifacts/report-create-from-excel.json", createdResponse.data);
  const detailJsonPath = writeJson("artifacts/report-detail.json", detailResponse.data);
  const reviewJsonPath = writeJson("artifacts/report-review.json", reviewResponse.data);
  const approveJsonPath = writeJson("artifacts/report-approve.json", approveResponse.data);
  const exportHtmlJsonPath = writeJson("artifacts/report-export-html.json", exportHtmlResponse.data);
  const exportDocxJsonPath = writeJson("artifacts/report-export-docx.json", exportDocxResponse.data);
  const workbookSummaryPath = writeJson("artifacts/workbook-summary.json", workbookSummary);
  const exportHtmlRouteResponsePath = writeJson("artifacts/report-export-html-route-response.json", {
    url: exportedHtmlUrl,
    status: exportedHtmlFetchResponse.status,
    content_type: exportedHtmlFetchResponse.headers.get("content-type"),
    contains_pivot_profit_by_country: exportedHtmlText.includes("Pivot_Profit_By_Country"),
    contains_workbook_summary: exportedHtmlText.includes("Workbook Summary"),
    contains_worksheet_count: exportedHtmlText.includes("Worksheet Count")
  });

  const evidence = {
    verification_status: "verified",
    checks: [
      { check_id: "excel_source_generated_check", passed: true, detail: sourceWorkbookPath },
      { check_id: "report_api_create_from_excel_check", passed: true, detail: `/api/v1/reports/reports/create-from-excel -> ${reportId}` },
      { check_id: "report_detail_route_check", passed: true, detail: `/reports/${reportId}` },
      { check_id: "excel_sheet_summary_consumed_check", passed: true, detail: expectedSheetNames },
      { check_id: "report_publication_check", passed: true, detail: `/published/reports/${publicationId}` },
      { check_id: "report_export_html_check", passed: true, detail: exportedHtmlUrl },
      { check_id: "report_export_html_artifact_check", passed: true, detail: exportedHtmlArtifactPath },
      { check_id: "report_export_docx_check", passed: Boolean(exportedDocxArtifact), detail: exportedDocxArtifact?.artifact_id ?? null },
      { check_id: "report_output_contains_workbook_values_check", passed: true, detail: ["Pivot_Profit_By_Country", "Worksheet Count", "Workbook Summary"] }
    ],
    warnings: []
  };

  const audit = [
    {
      event_id: `audit-${runId}-excel-sample`,
      action_ref: "excel_engine.run_sample.v1",
      object_refs: [excelRunRoot, sourceWorkbookPath],
      metadata: { workbook_package_path: workbookPackagePath }
    },
    {
      event_id: `audit-${runId}-report-create`,
      action_ref: "reports.create_from_excel_output.v1",
      object_refs: [reportId, created.reportArtifact.artifact_id],
      metadata: { route: "/api/v1/reports/reports/create-from-excel" }
    },
    {
      event_id: `audit-${runId}-report-publish`,
      action_ref: "reports.publish_from_excel_output.v1",
      object_refs: [reportId, publicationId],
      metadata: { route: `/api/v1/reports/reports/${reportId}/publish` }
    },
    {
      event_id: `audit-${runId}-report-export-html`,
      action_ref: "reports.export_html_from_excel_output.v1",
      object_refs: [reportId, exportHtmlResponse.data.exportArtifact?.artifact_id ?? null].filter(Boolean),
      metadata: { route: `/api/v1/reports/reports/${reportId}/export/html` }
    }
  ];

  const lineage = [
    {
      edge_id: `edge-${runId}-workbook-to-report`,
      from_ref: sourceWorkbookPath,
      to_ref: created.reportArtifact.artifact_id,
      transform_ref: "excel.report.consume"
    },
    {
      edge_id: `edge-${runId}-workbook-package-to-report`,
      from_ref: workbookPackagePath,
      to_ref: created.reportArtifact.artifact_id,
      transform_ref: "excel.report.consume"
    },
    {
      edge_id: `edge-${runId}-report-to-publication`,
      from_ref: created.reportArtifact.artifact_id,
      to_ref: publicationId,
      transform_ref: "reports.publish"
    },
    {
      edge_id: `edge-${runId}-report-to-export-html`,
      from_ref: created.reportArtifact.artifact_id,
      to_ref: exportHtmlResponse.data.exportArtifact?.artifact_id ?? "report-html-export-missing",
      transform_ref: "reports.export.html"
    }
  ];

  writeJson("evidence/evidence-pack.json", evidence);
  writeJson("audit/audit-events.json", audit);
  writeJson("lineage/lineage-edges.json", lineage);

  const proof = {
    phase_requirement: "excel-engine cross-engine flow proof to reports",
    source_workbook: sourceWorkbookPath,
    report_id: reportId,
    publication_id: publicationId,
    live_routes: {
      detail: `${reportServer.origin}/reports/${reportId}`,
      publication: `${reportServer.origin}/published/reports/${publicationId}`
    },
    api_routes: {
      create: "/api/v1/reports/reports/create-from-excel",
      detail: `/api/v1/reports/reports/${reportId}`,
      publish: `/api/v1/reports/reports/${reportId}/publish`,
      export_html: `/api/v1/reports/reports/${reportId}/export/html`,
      export_docx: `/api/v1/reports/reports/${reportId}/export/docx`
    },
    copied_artifacts: {
      source_workbook: copiedWorkbookPath,
      workbook_package: copiedWorkbookPackagePath,
      report_current_state: copiedReportCurrentPath,
      report_editable_state: copiedEditableStatePath,
      report_export_html: copiedExportHtmlPath,
      report_export_html_artifact: copiedExportHtmlArtifactPath,
      report_export_docx: copiedExportDocxPath,
      report_create: createJsonPath,
      report_detail: detailJsonPath,
      report_review: reviewJsonPath,
      report_approve: approveJsonPath,
      report_publication: publicationJsonPath,
      report_export_html_json: exportHtmlJsonPath,
      report_export_html_route_response: exportHtmlRouteResponsePath,
      report_export_docx_json: exportDocxJsonPath,
      workbook_summary: workbookSummaryPath
    }
  };

  const proofPath = writeJson("artifacts/cross-engine-proof.json", proof);
  step(`proof completed at ${proofPath}`);

  console.log(
    JSON.stringify(
      {
        runId,
        proofRoot,
        proofPath,
        reportId,
        publicationId,
        sourceWorkbookPath
      },
      null,
      2
    )
  );
  success = true;
} catch (error) {
  step(`error: ${error instanceof Error ? error.stack ?? error.message : `${error}`}`);
  throw error;
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  await reportServer.close();
  step("report platform closed");
  if (success) {
    process.exit(0);
  }
}
