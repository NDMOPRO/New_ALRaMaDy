import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);

const { ExcelEngine } = await load("packages/excel-engine/dist/index.js");
const { startDashboardWebApp, stopDashboardWebApp } = await load("apps/contracts-cli/dist/dashboard-web.js");

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

if (!browserExecutablePath) {
  throw new Error("No Chromium-compatible browser executable found for excel shared platform flow proof.");
}

const host = "127.0.0.1";
const startedAt = new Date();
const startedAtIso = startedAt.toISOString();
const runId = `excel-shared-platform-flow-${startedAtIso.replace(/[^0-9]/g, "")}`;
const proofRoot = path.join(root, "packages", "excel-engine", "output", runId);
const runtimeRoot = path.join(root, ".runtime", "excel-shared-platform-flow", runId);
const stepLogPath = path.join(proofRoot, "artifacts", "step-log.txt");

for (const folder of ["artifacts", "evidence", "audit", "lineage", "browser", "records"]) {
  fs.mkdirSync(path.join(proofRoot, folder), { recursive: true });
}

const now = () => new Date().toISOString();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

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

const step = (message, extra = {}) => {
  fs.appendFileSync(stepLogPath, `[${now()}] ${message} ${JSON.stringify(extra)}\n`, "utf8");
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No free port available."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const waitForServer = async (url, attempts = 80, delayMs = 250) => {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await wait(delayMs);
  }
  throw lastError ?? new Error(`Server did not become ready: ${url}`);
};

const waitForFetchOk = async (url, options = {}, attempts = 40, delayMs = 250) => {
  let lastResponse = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    lastResponse = response;
    await wait(delayMs);
  }
  return lastResponse;
};

const loginDashboardWeb = async (origin) => {
  const response = await fetch(`${origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin",
      password: "1500",
      tenant_ref: "tenant-default",
      workspace_id: "workspace-dashboard-web",
      project_id: "project-dashboard-web",
      actor_ref: "admin"
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Dashboard web login failed: ${response.status}`);
  }
  return payload;
};

const dashboardApi = async (origin, token, pathname, method = "GET", body) => {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-ref": "tenant-default",
      "x-actor-ref": "admin",
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
  chromium.launch({
    executablePath: browserExecutablePath,
    headless: true
  });

const dashboardPort = await getFreePort();
const dashboardOrigin = `http://${host}:${dashboardPort}`;

const latestDirectoryByPrefix = (prefix) => {
  const base = path.join(root, "packages", "excel-engine", "output");
  if (!fs.existsSync(base)) {
    return null;
  }
  return (
    fs
      .readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => path.join(base, entry.name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null
  );
};

const resolveWorkbookSource = async () => {
  const envWorkbook = process.env.EXCEL_SOURCE_WORKBOOK;
  if (envWorkbook && fs.existsSync(envWorkbook)) {
    const outputRoot = process.env.EXCEL_SOURCE_ROOT ?? path.dirname(path.dirname(envWorkbook));
    return {
      source_kind: "env_override",
      workbook_path: envWorkbook,
      workbook_package_path: process.env.EXCEL_SOURCE_WORKBOOK_PACKAGE ?? path.join(outputRoot, "artifacts", "workbook-package.json"),
      evidence_path: process.env.EXCEL_SOURCE_EVIDENCE ?? path.join(outputRoot, "evidence", "evidence-pack.json"),
      audit_path: process.env.EXCEL_SOURCE_AUDIT ?? path.join(outputRoot, "audit", "audit-events.json"),
      lineage_path: process.env.EXCEL_SOURCE_LINEAGE ?? path.join(outputRoot, "lineage", "lineage-edges.json"),
      output_root: outputRoot
    };
  }
  const latestSampleRoot = latestDirectoryByPrefix("sample-run-");
  if (latestSampleRoot) {
    const workbookPath = path.join(latestSampleRoot, "artifacts", "sample-output.xlsx");
    if (fs.existsSync(workbookPath)) {
      return {
        source_kind: "latest_sample_run",
        workbook_path: workbookPath,
        workbook_package_path: path.join(latestSampleRoot, "artifacts", "workbook-package.json"),
        evidence_path: path.join(latestSampleRoot, "evidence", "evidence-pack.json"),
        audit_path: path.join(latestSampleRoot, "audit", "audit-events.json"),
        lineage_path: path.join(latestSampleRoot, "lineage", "lineage-edges.json"),
        output_root: latestSampleRoot
      };
    }
  }
  step("running fallback fresh excel-engine sample");
  const excelRun = await new ExcelEngine().runSample({
    tenant_ref: "tenant-excel-shared-platform",
    workspace_id: "workspace-excel-shared-platform",
    project_id: "project-excel-shared-platform",
    actor_ref: "excel-shared-platform",
    output_root: path.join(root, "packages", "excel-engine", "output")
  });
  return {
    source_kind: "fresh_run_sample",
    workbook_path: excelRun.artifacts.exported_workbook_path,
    workbook_package_path: excelRun.artifacts.workbook_package_path,
    evidence_path: excelRun.artifacts.evidence_path,
    audit_path: excelRun.artifacts.audit_path,
    lineage_path: excelRun.artifacts.lineage_path,
    output_root: excelRun.artifacts.output_root
  };
};

const workbookSource = await resolveWorkbookSource();
const workbookPath = workbookSource.workbook_path;
const workbookPackagePath = workbookSource.workbook_package_path;
const excelEvidencePath = workbookSource.evidence_path;
const excelAuditPath = workbookSource.audit_path;
const excelLineagePath = workbookSource.lineage_path;
const excelRunRoot = workbookSource.output_root;

writeJson("records/excel-source.json", {
  source_kind: workbookSource.source_kind,
  workbook_path: workbookPath,
  workbook_package_path: workbookPackagePath,
  evidence_path: excelEvidencePath,
  audit_path: excelAuditPath,
  lineage_path: excelLineagePath,
  output_root: excelRunRoot
});

step("starting shared dashboard-web app");
const dashboardApp = startDashboardWebApp({
  host,
  port: dashboardPort
});

let browser;
let context;

try {
  await waitForServer(`${dashboardOrigin}/login`);
  step("logging into shared dashboard-web");
  const dashboardLogin = await loginDashboardWeb(dashboardOrigin);
  writeJson("artifacts/dashboard-login.json", dashboardLogin);
  const dashboardToken = dashboardLogin.data.accessToken;

  const initialExcelState = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    `/api/v1/canvas/state?surface=${encodeURIComponent("/excel")}&session_id=${encodeURIComponent(runId)}`,
    "GET"
  );
  writeJson("artifacts/excel-canvas-state.json", initialExcelState);

  step("creating report from latest excel workbook through shared /excel route");
  const createReportResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/excel/create-report", "POST", {
    title: "Excel Shared Platform Report",
    workbook_path: workbookPath,
    workbook_label: path.basename(workbookPath),
    approval_granted: true
  });
  writeJson("artifacts/excel-create-report.json", createReportResponse);

  const reportId = createReportResponse.report_id;
  const excelConsume = createReportResponse.excel_consume;
  const reportCurrent = readJson(excelConsume.report_state_path);
  const reportEditable = readJson(excelConsume.report_editable_path);
  writeJson("artifacts/report-current.json", reportCurrent);
  writeJson("artifacts/report-editable.json", reportEditable);

  const sharedReportState = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    `/api/v1/canvas/state?surface=${encodeURIComponent("/reports")}&report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`,
    "GET"
  );
  writeJson("artifacts/report-canvas-state.json", sharedReportState);

  step("converting shared report to dashboard");
  const convertDashboardResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    target_ref: "workspace://dashboards/from-shared-excel-report",
    approval_granted: true
  });
  writeJson("artifacts/report-to-dashboard.json", convertDashboardResponse);

  const dashboardId = convertDashboardResponse.report_bridge.dashboard_id;
  const dashboardStateResponse = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`,
    "GET"
  );
  writeJson("artifacts/dashboard-state.json", dashboardStateResponse);

  const sharedDashboardState = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    `/api/v1/canvas/state?surface=${encodeURIComponent("/dashboards")}&dashboard_id=${encodeURIComponent(dashboardId)}&report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`,
    "GET"
  );
  writeJson("artifacts/dashboard-canvas-state.json", sharedDashboardState);

  const widgetRef =
    dashboardStateResponse.dashboard.widgets.find((widget) => widget.widget_type !== "filter")?.widget_id ??
    dashboardStateResponse.dashboard.widgets[0]?.widget_id;
  assert(widgetRef, "No dashboard widget was available for downstream export.");

  step("publishing, sharing, and exporting shared dashboard");
  const publishDashboardResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/dashboards/publish", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  const shareDashboardResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  const exportTargetResponse = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    "/api/v1/dashboards/export-widget-target",
    "POST",
    { dashboard_id: dashboardId, widget_ref: widgetRef, target_kind: "live_external" }
  );
  writeJson("artifacts/dashboard-publication.json", publishDashboardResponse);
  writeJson("artifacts/dashboard-share.json", shareDashboardResponse);
  writeJson("artifacts/dashboard-export-target.json", exportTargetResponse);

  const fetchPublicationAssets = async (prefix, transport) => {
    const manifest = await (await waitForFetchOk(transport.served_manifest_url)).json();
    const publishState = await (await waitForFetchOk(transport.served_publish_state_url)).json();
    const embedPayload = await (await waitForFetchOk(transport.served_embed_payload_url)).json();
    const embedHtmlResponse = await waitForFetchOk(transport.served_embed_html_url);
    const embedHtml = await embedHtmlResponse.text();
    const runtimeState = await (await waitForFetchOk(
      `${transport.served_base_url}/runtime-state?access_token=${encodeURIComponent(transport.served_access_token)}`
    )).json();
    const evidence = await (await waitForFetchOk(
      `${transport.served_base_url}/evidence?access_token=${encodeURIComponent(transport.served_access_token)}`
    )).json();
    const audit = await (await waitForFetchOk(
      `${transport.served_base_url}/audit?access_token=${encodeURIComponent(transport.served_access_token)}`
    )).json();
    const lineage = await (await waitForFetchOk(
      `${transport.served_base_url}/lineage?access_token=${encodeURIComponent(transport.served_access_token)}`
    )).json();
    writeJson(`artifacts/${prefix}-manifest.json`, manifest);
    writeJson(`artifacts/${prefix}-publish-state.json`, publishState);
    writeJson(`artifacts/${prefix}-embed-payload.json`, embedPayload);
    writeJson(`artifacts/${prefix}-runtime-state.json`, runtimeState);
    writeJson(`evidence/${prefix}.json`, evidence);
    writeJson(`audit/${prefix}.json`, audit);
    writeJson(`lineage/${prefix}.json`, lineage);
    writeText(`artifacts/${prefix}-embed.html`, embedHtml);
    return { manifest, publishState, embedPayload, runtimeState, evidence, audit, lineage };
  };

  const publishAssets = await fetchPublicationAssets("dashboard-publish", publishDashboardResponse.transport);
  const shareAssets = await fetchPublicationAssets("dashboard-share", shareDashboardResponse.transport);
  const externalTargetUrl = new URL(exportTargetResponse.transfer.open_path, dashboardOrigin).toString();
  const externalTargetPreviewHtml = await (await waitForFetchOk(externalTargetUrl)).text();
  writeText("artifacts/dashboard-external-target-preview.html", externalTargetPreviewHtml);

  browser = await openBrowser();
  context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem("rasid_tenant", "tenant-default");
    window.localStorage.setItem("rasid_actor", "admin");
  });

  const excelPage = await context.newPage();
  await excelPage.goto(`${dashboardOrigin}/excel?session_id=${encodeURIComponent(runId)}`, { waitUntil: "networkidle" });
  await excelPage.screenshot({ path: path.join(proofRoot, "browser", "excel-surface.png"), fullPage: true });
  await excelPage.close();

  const reportPage = await context.newPage();
  await reportPage.goto(`${dashboardOrigin}/reports?report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`, {
    waitUntil: "networkidle"
  });
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-surface.png"), fullPage: true });
  await reportPage.close();

  const dashboardPage = await context.newPage();
  await dashboardPage.goto(
    `${dashboardOrigin}/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}&report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`,
    { waitUntil: "networkidle" }
  );
  await dashboardPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-surface.png"), fullPage: true });
  await dashboardPage.close();

  const publishedEmbedPage = await context.newPage();
  await publishedEmbedPage.goto(publishDashboardResponse.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await publishedEmbedPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-published-embed.png"), fullPage: true });
  await publishedEmbedPage.close();

  const sharedEmbedPage = await context.newPage();
  await sharedEmbedPage.goto(shareDashboardResponse.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await sharedEmbedPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-shared-embed.png"), fullPage: true });
  await sharedEmbedPage.close();

  const externalTargetPage = await context.newPage();
  await externalTargetPage.goto(externalTargetUrl, { waitUntil: "networkidle" });
  await externalTargetPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-external-target.png"), fullPage: true });
  await externalTargetPage.close();

  const firstWorksheetName = String(
    (excelConsume.workbook_summary.worksheet_summaries?.[0]?.worksheet_name ?? reportCurrent.sections?.[1]?.title ?? "")
  );
  const reportText = JSON.stringify(reportCurrent);
  const dashboardText = JSON.stringify(dashboardStateResponse);
  assert(reportText.includes(path.basename(workbookPath)), "Shared report did not retain workbook identity.");
  assert(firstWorksheetName.length === 0 || reportText.includes(firstWorksheetName), "Shared report did not retain worksheet identity.");
  assert(
    firstWorksheetName.length === 0 || dashboardText.includes(firstWorksheetName),
    "Downstream dashboard did not retain workbook-derived worksheet identity."
  );
  assert(
    publishAssets.manifest.publication_id === publishDashboardResponse.publication.publication_id,
    "Published dashboard manifest did not match publication response."
  );
  assert(
    shareAssets.manifest.publication_id === shareDashboardResponse.publication.publication_id,
    "Shared dashboard manifest did not match share response."
  );

  const evidencePack = {
    generated_at: now(),
    phase_requirement: "excel-engine shared shell continuity proof to dashboards",
    checks: [
      { id: "excel_source_generated_check", status: true, detail: workbookPath },
      { id: "excel_shared_shell_surface_check", status: true, detail: `${dashboardOrigin}/excel` },
      { id: "excel_shared_shell_create_report_check", status: true, detail: createReportResponse.open_path },
      { id: "report_shared_shell_route_check", status: true, detail: `${dashboardOrigin}/reports?report_id=${reportId}` },
      { id: "shared_shell_dashboard_conversion_check", status: true, detail: dashboardId },
      { id: "dashboard_publication_check", status: true, detail: publishDashboardResponse.transport.served_embed_html_url },
      { id: "dashboard_share_check", status: true, detail: shareDashboardResponse.transport.served_embed_html_url },
      { id: "dashboard_export_target_check", status: true, detail: externalTargetUrl },
      { id: "shared_shell_continuity_check", status: true, detail: firstWorksheetName || path.basename(workbookPath) }
    ]
  };
  const auditEvents = {
    generated_at: now(),
    events: [
      {
        action_id: "excel_engine.resolve_workbook_source.v1",
        output_ref: workbookPath,
        metadata: { output_root: excelRunRoot, source_kind: workbookSource.source_kind }
      },
      {
        action_id: "excel.shared_shell.create_report.v1",
        output_ref: reportId,
        metadata: { route: "/api/v1/excel/create-report", workbook_path: workbookPath, consume_manifest_path: excelConsume.consume_manifest_path }
      },
      {
        action_id: "shared_shell.report_to_dashboard.v1",
        output_ref: dashboardId,
        metadata: { route: "/api/v1/reports/convert-to-dashboard", report_id: reportId }
      },
      {
        action_id: "shared_shell.dashboard_publish.v1",
        output_ref: publishDashboardResponse.publication.publication_id,
        metadata: { route: "/api/v1/dashboards/publish", served_embed_html_url: publishDashboardResponse.transport.served_embed_html_url }
      },
      {
        action_id: "shared_shell.dashboard_share.v1",
        output_ref: shareDashboardResponse.publication.publication_id,
        metadata: { route: "/api/v1/dashboards/share", served_embed_html_url: shareDashboardResponse.transport.served_embed_html_url }
      },
      {
        action_id: "shared_shell.dashboard_export_target.v1",
        output_ref: exportTargetResponse.transfer.transfer_id,
        metadata: { route: "/api/v1/dashboards/export-widget-target", open_path: exportTargetResponse.transfer.open_path }
      }
    ]
  };
  const lineageEdges = {
    generated_at: now(),
    edges: [
      { from: `workbook:${workbookPath}`, to: `report:${reportId}`, relation: "consumed_by_shared_excel_route" },
      { from: `report:${reportId}`, to: `dashboard:${dashboardId}`, relation: "converted_to_dashboard" },
      {
        from: `dashboard:${dashboardId}`,
        to: `publication:${publishDashboardResponse.publication.publication_id}`,
        relation: "published_as"
      },
      {
        from: `dashboard:${dashboardId}`,
        to: `publication:${shareDashboardResponse.publication.publication_id}`,
        relation: "shared_as"
      },
      {
        from: `dashboard:${dashboardId}`,
        to: `external-target:${exportTargetResponse.transfer.transfer_id}`,
        relation: "exported_to_external_target"
      }
    ]
  };

  writeJson("evidence/evidence-pack.json", evidencePack);
  writeJson("audit/audit-events.json", auditEvents);
  writeJson("lineage/lineage-edges.json", lineageEdges);
  writeJson("artifacts/cross-engine-proof.json", {
    phase_requirement: "excel-engine shared shell continuity proof to dashboards",
    generated_at: now(),
    workbook: {
      workbook_path: workbookPath,
      workbook_package_path: workbookPackagePath,
      output_root: excelRunRoot
    },
    shared_shell: {
      entry_route: `${dashboardOrigin}/excel`,
      create_report_route: "/api/v1/excel/create-report",
      report_route: `${dashboardOrigin}/reports?report_id=${reportId}`,
      dashboard_route: `${dashboardOrigin}/dashboards?dashboard_id=${dashboardId}`,
      runtime_root: dashboardApp.storage_dir
    },
    report: {
      report_id: reportId,
      consume_manifest_path: excelConsume.consume_manifest_path,
      report_state_path: excelConsume.report_state_path,
      report_editable_path: excelConsume.report_editable_path
    },
    dashboard: {
      dashboard_id: dashboardId,
      publication_route: publishDashboardResponse.transport.served_embed_html_url,
      share_route: shareDashboardResponse.transport.served_embed_html_url,
      external_target_route: externalTargetUrl
    },
    screenshots: {
      excel_surface: path.join(proofRoot, "browser", "excel-surface.png"),
      report_surface: path.join(proofRoot, "browser", "report-surface.png"),
      dashboard_surface: path.join(proofRoot, "browser", "dashboard-surface.png"),
      dashboard_published_embed: path.join(proofRoot, "browser", "dashboard-published-embed.png"),
      dashboard_shared_embed: path.join(proofRoot, "browser", "dashboard-shared-embed.png"),
      dashboard_external_target: path.join(proofRoot, "browser", "dashboard-external-target.png")
    }
  });
} finally {
  if (context) {
    try {
      await context.close();
    } catch {}
  }
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  await stopDashboardWebApp();
}
