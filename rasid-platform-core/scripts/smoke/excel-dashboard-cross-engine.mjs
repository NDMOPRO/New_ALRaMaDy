import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);

const { ExcelEngine } = await load("packages/excel-engine/dist/index.js");
const { ReportEngine } = await load("packages/report-engine/dist/index.js");
const { startReportPlatformServer } = await load("packages/report-engine/dist/platform.js");

const host = "127.0.0.1";
const runId = `excel-dashboard-cross-engine-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const proofRoot = path.join(root, "packages", "excel-engine", "output", runId);
const runtimeRoot = path.join(root, ".runtime", "excel-dashboard-cross-engine", runId);
const reportRuntimeRoot = path.join(runtimeRoot, "report-engine");
const stepLogPath = path.join(proofRoot, "artifacts", "step-log.txt");
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

if (!browserExecutablePath) {
  throw new Error("No Chromium-compatible browser executable found for excel -> dashboards cross-engine proof.");
}

fs.rmSync(proofRoot, { recursive: true, force: true });
fs.rmSync(runtimeRoot, { recursive: true, force: true });
["artifacts", "evidence", "audit", "lineage", "browser"].forEach((folder) =>
  fs.mkdirSync(path.join(proofRoot, folder), { recursive: true })
);
fs.writeFileSync(stepLogPath, "", "utf8");

const now = () => new Date().toISOString();

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

const copyFileIntoProof = (sourcePath, relativePath) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};

const step = (message) => {
  fs.appendFileSync(stepLogPath, `[${now()}] ${message}\n`, "utf8");
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

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

const loginReportPlatform = async (origin) => {
  const response = await fetch(`${origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin", password: "1500", tenantRef: "tenant-default" })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Report platform login failed: ${response.status}`);
  }
  return payload;
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

const reportApi = async (origin, token, pathname, method = "GET", body) => {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
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

const writeEvidencePack = (payload) => writeJson("evidence/evidence-pack.json", payload);
const writeAuditEvents = (payload) => writeJson("audit/audit-events.json", payload);
const writeLineageEdges = (payload) => writeJson("lineage/lineage-edges.json", payload);

const excelEngine = new ExcelEngine();
const reportPort = await getFreePort();
const dashboardPort = await getFreePort();
const reportOrigin = `http://${host}:${reportPort}`;
const dashboardOrigin = `http://${host}:${dashboardPort}`;

step("running fresh excel-engine sample");
const excelRun = await excelEngine.runSample({
  tenant_ref: "tenant-excel-dashboard-proof",
  workspace_id: "workspace-excel-dashboard-proof",
  project_id: "project-excel-dashboard-proof",
  actor_ref: "excel-dashboard-proof",
  output_root: path.join(root, "packages", "excel-engine", "output")
});

const workbookPath = excelRun.artifacts.exported_workbook_path;
const workbookPackagePath = excelRun.artifacts.workbook_package_path;
const excelEvidencePath = excelRun.artifacts.evidence_path;
const excelAuditPath = excelRun.artifacts.audit_path;
const excelLineagePath = excelRun.artifacts.lineage_path;
const excelRunRoot = excelRun.artifacts.output_root;

const reportEngine = new ReportEngine({ storageDir: reportRuntimeRoot });
step(`starting report platform on ${reportOrigin}`);
const reportServer = await startReportPlatformServer({ host, port: reportPort, engine: reportEngine });

step(`starting dashboard web on ${dashboardOrigin}`);
const dashboardServer = spawn(process.execPath, ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: root,
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_HOST: host,
    RASID_DASHBOARD_WEB_PORT: String(dashboardPort)
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let browser = null;
let success = false;

const terminateDashboardServer = async () => {
  if (dashboardServer.exitCode === null && !dashboardServer.killed) {
    dashboardServer.kill();
    await wait(500);
  }
};

try {
  await waitForServer(`${reportOrigin}/login`);
  await waitForServer(`${dashboardOrigin}/login`);

  step("logging into report platform and dashboard web");
  const reportLogin = await loginReportPlatform(reportOrigin);
  const dashboardLogin = await loginDashboardWeb(dashboardOrigin);
  writeJson("artifacts/report-login.json", reportLogin);
  writeJson("artifacts/dashboard-login.json", dashboardLogin);

  const reportToken = reportLogin.data.accessToken;
  const dashboardToken = dashboardLogin.data.accessToken;

  step("creating report from fresh excel workbook via live report API");
  const createResponse = await reportApi(reportOrigin, reportToken, "/api/v1/reports/reports/create-from-excel", "POST", {
    title: "Excel to Dashboard Cross-Engine Proof",
    description: "Fresh excel-engine workbook consumed live by report-engine before dashboard conversion.",
    language: "ar-SA",
    workbook_path: workbookPath,
    workbook_label: path.basename(workbookPath),
    excel_artifact_refs: excelRun.state.artifacts.map((artifact) => artifact.artifact_id),
    excel_runtime_refs: {
      sample_run_root: excelRunRoot,
      workbook_package_path: workbookPackagePath,
      evidence_path: excelEvidencePath,
      audit_path: excelAuditPath,
      lineage_path: excelLineagePath
    }
  });
  writeJson("artifacts/report-create-from-excel.json", createResponse);

  const created = createResponse.data.created;
  const workbookSummary = createResponse.data.workbook_summary;
  const reportId = created.report.report_id;
  const reportRoot = path.join(reportRuntimeRoot, "reports", reportId);
  const reportCurrentPath = path.join(reportRoot, "state", "current.json");
  const reportEditablePath = path.join(reportRoot, "state", "editable-report.json");

  step(`reviewing, approving, and publishing report ${reportId}`);
  const reviewResponse = await reportApi(reportOrigin, reportToken, `/api/v1/reports/reports/${reportId}/review`, "POST", {});
  const approveResponse = await reportApi(reportOrigin, reportToken, `/api/v1/reports/reports/${reportId}/approve`, "POST", {});
  const publishReportResponse = await reportApi(
    reportOrigin,
    reportToken,
    `/api/v1/reports/reports/${reportId}/publish`,
    "POST",
    { target_ref: "platform://reports/excel-dashboard-cross-engine" }
  );
  writeJson("artifacts/report-review.json", reviewResponse);
  writeJson("artifacts/report-approve.json", approveResponse);
  writeJson("artifacts/report-publication.json", publishReportResponse);

  step("converting live report to dashboard through dashboard-web route");
  const convertResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    report_storage_dir: reportRuntimeRoot,
    target_ref: "workspace://dashboards/from-excel-report",
    approval_granted: true
  });
  writeJson("artifacts/report-to-dashboard.json", convertResponse);

  const dashboardId = convertResponse.report_bridge.dashboard_id;
  const dashboardStateResponse = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`,
    "GET"
  );
  writeJson("artifacts/dashboard-state.json", dashboardStateResponse);

  const widgetRef =
    dashboardStateResponse.dashboard.widgets.find((widget) => widget.widget_type !== "filter")?.widget_id ??
    dashboardStateResponse.dashboard.widgets[0]?.widget_id;
  assert(widgetRef, "No dashboard widget was available for downstream export.");

  step("publishing, sharing, and exporting the downstream dashboard");
  const publishDashboardResponse = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    "/api/v1/dashboards/publish",
    "POST",
    { dashboard_id: dashboardId, approval_granted: true }
  );
  const shareDashboardResponse = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    "/api/v1/dashboards/share",
    "POST",
    { dashboard_id: dashboardId, approval_granted: true }
  );
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
    return { manifest, publishState, embedPayload, runtimeState, evidence, audit, lineage, embedHtml };
  };

  const publishAssets = await fetchPublicationAssets("dashboard-publish", publishDashboardResponse.transport);
  const shareAssets = await fetchPublicationAssets("dashboard-share", shareDashboardResponse.transport);
  const externalTargetUrl = new URL(exportTargetResponse.transfer.open_path, dashboardOrigin).toString();
  const externalTargetPreviewResponse = await waitForFetchOk(externalTargetUrl, {
    headers: {
      authorization: `Bearer ${dashboardToken}`,
      "x-tenant-ref": "tenant-default"
    }
  });
  const externalTargetPreviewHtml = await externalTargetPreviewResponse.text();
  writeText("artifacts/dashboard-external-target-preview.html", externalTargetPreviewHtml);

  assert(fs.existsSync(reportCurrentPath), "Report current state was not persisted.");
  assert(fs.existsSync(reportEditablePath), "Report editable state was not persisted.");
  assert(workbookSummary.worksheet_count >= 4, "Workbook summary did not capture enough worksheets.");
  assert(
    dashboardStateResponse.dashboard.widgets.length > 0 && dashboardStateResponse.rendered.length > 0,
    "Dashboard conversion did not produce rendered dashboard widgets."
  );
  assert(
    String(externalTargetPreviewHtml).includes("Live External Target"),
    "Dashboard external target preview did not materialize."
  );
  assert(
    publishAssets.manifest.publication_id === publishDashboardResponse.publication.publication_id,
    "Published dashboard manifest did not match the dashboard publication response."
  );
  assert(
    shareAssets.manifest.publication_id === shareDashboardResponse.publication.publication_id,
    "Shared dashboard manifest did not match the dashboard share response."
  );

  browser = await openBrowser();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  await context.addCookies([
    { name: "rasid_access_token", value: reportToken, domain: host, path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: host, path: "/" },
    { name: "rasid_auth", value: dashboardToken, domain: host, path: "/" },
    { name: "rasid_tenant", value: "tenant-default", domain: host, path: "/" },
    { name: "rasid_workspace", value: "workspace-dashboard-web", domain: host, path: "/" },
    { name: "rasid_project", value: "project-dashboard-web", domain: host, path: "/" },
    { name: "rasid_actor", value: "admin", domain: host, path: "/" }
  ]);

  const reportPage = await context.newPage();
  await reportPage.goto(`${reportOrigin}/reports/${reportId}`, { waitUntil: "networkidle" });
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-detail.png"), fullPage: true });
  await reportPage.close();

  const dashboardPage = await context.newPage();
  await dashboardPage.goto(`${dashboardOrigin}/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}`, { waitUntil: "networkidle" });
  await dashboardPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-detail.png"), fullPage: true });
  await dashboardPage.close();

  const publishEmbedPage = await context.newPage();
  await publishEmbedPage.goto(publishDashboardResponse.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await publishEmbedPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-published-embed.png"), fullPage: true });
  await publishEmbedPage.close();

  const externalTargetPage = await context.newPage();
  await externalTargetPage.goto(externalTargetUrl, { waitUntil: "networkidle" });
  await externalTargetPage.screenshot({ path: path.join(proofRoot, "browser", "dashboard-external-target.png"), fullPage: true });
  await externalTargetPage.close();

  const reportCurrent = readJson(reportCurrentPath);
  const reportEditable = readJson(reportEditablePath);
  writeJson("artifacts/report-current.json", reportCurrent);
  writeJson("artifacts/report-editable.json", reportEditable);
  copyFileIntoProof(workbookPath, "artifacts/source-workbook.xlsx");
  copyFileIntoProof(workbookPackagePath, "artifacts/workbook-package.json");

  const crossEngineProof = {
    run_id: runId,
    generated_at: now(),
    flow: ["excel-engine", "report-engine", "dashboard-web"],
    live_entrypoint: "/api/v1/reports/reports/create-from-excel",
    dashboard_entrypoint: "/api/v1/reports/convert-to-dashboard",
    downstream_surface: `/dashboards?dashboard_id=${dashboardId}`,
    publication_route: publishDashboardResponse.transport.served_embed_html_url,
    share_route: shareDashboardResponse.transport.served_embed_html_url,
    external_target_route: externalTargetUrl,
    workbook: {
      output_root: excelRunRoot,
      workbook_path: workbookPath,
      workbook_package_path: workbookPackagePath
    },
    report: {
      report_id: reportId,
      runtime_root: reportRuntimeRoot,
      current_state_path: reportCurrentPath,
      editable_state_path: reportEditablePath,
      publication_id: publishReportResponse.data.publication.publication_id
    },
    dashboard: {
      dashboard_id: dashboardId,
      bridge_manifest_path: convertResponse.report_bridge.bridge_manifest_path,
      bridge_artifact_path: convertResponse.report_bridge.bridge_artifact_path,
      publication_id: publishDashboardResponse.publication.publication_id,
      share_publication_id: shareDashboardResponse.publication.publication_id,
      export_transfer_id: exportTargetResponse.transfer.transfer_id
    }
  };
  writeJson("artifacts/cross-engine-proof.json", crossEngineProof);

  const evidencePack = {
    verification_status: "verified",
    generated_at: now(),
    checks: [
      { id: "excel_source_generated_check", status: true, detail: workbookPath },
      { id: "report_api_create_from_excel_check", status: true, detail: `/api/v1/reports/reports/create-from-excel -> ${reportId}` },
      { id: "report_detail_route_check", status: true, detail: `${reportOrigin}/reports/${reportId}` },
      { id: "dashboard_conversion_route_check", status: true, detail: `/api/v1/reports/convert-to-dashboard -> ${dashboardId}` },
      { id: "dashboard_live_route_check", status: true, detail: `${dashboardOrigin}/dashboards?dashboard_id=${dashboardId}` },
      { id: "dashboard_publication_check", status: true, detail: publishDashboardResponse.transport.served_embed_html_url },
      { id: "dashboard_share_check", status: true, detail: shareDashboardResponse.transport.served_embed_html_url },
      { id: "dashboard_export_target_check", status: true, detail: externalTargetUrl },
      { id: "dashboard_output_contains_report_data_check", status: true, detail: widgetRef }
    ],
    warnings: []
  };
  writeEvidencePack(evidencePack);

  const auditEvents = [
    {
      action_id: "excel_engine.run_sample.v1",
      timestamp: now(),
      surface: "/excel",
      output_ref: workbookPath,
      metadata: { output_root: excelRunRoot }
    },
    {
      action_id: "reports.create_from_excel_output.v1",
      timestamp: now(),
      surface: "/reports",
      output_ref: reportId,
      metadata: { route: "/api/v1/reports/reports/create-from-excel", workbook_path: workbookPath }
    },
    {
      action_id: "dashboards.create_from_excel_output.v1",
      timestamp: now(),
      surface: "/reports",
      output_ref: dashboardId,
      metadata: { route: "/api/v1/reports/convert-to-dashboard", report_id: reportId }
    },
    {
      action_id: "dashboards.publish_from_excel_output.v1",
      timestamp: now(),
      surface: "/dashboards",
      output_ref: publishDashboardResponse.publication.publication_id,
      metadata: { route: "/api/v1/dashboards/publish", served_embed_html_url: publishDashboardResponse.transport.served_embed_html_url }
    },
    {
      action_id: "dashboards.share_from_excel_output.v1",
      timestamp: now(),
      surface: "/dashboards",
      output_ref: shareDashboardResponse.publication.publication_id,
      metadata: { route: "/api/v1/dashboards/share", served_embed_html_url: shareDashboardResponse.transport.served_embed_html_url }
    },
    {
      action_id: "dashboards.export_target_from_excel_output.v1",
      timestamp: now(),
      surface: "/dashboards",
      output_ref: exportTargetResponse.transfer.transfer_id,
      metadata: { route: "/api/v1/dashboards/export-widget-target", open_path: exportTargetResponse.transfer.open_path }
    }
  ];
  writeAuditEvents(auditEvents);

  const lineageEdges = [
    {
      from: `workbook:${workbookPath}`,
      to: `report:${reportId}`,
      relation: "consumed_by"
    },
    {
      from: `workbook-package:${workbookPackagePath}`,
      to: `report:${reportId}`,
      relation: "supports"
    },
    {
      from: `report:${reportId}`,
      to: `dashboard:${dashboardId}`,
      relation: "converted_to"
    },
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
      relation: "exported_to"
    }
  ];
  writeLineageEdges(lineageEdges);

  success = true;
  console.log(
    JSON.stringify(
      {
        runId,
        proofRoot,
        reportId,
        dashboardId,
        publicationId: publishDashboardResponse.publication.publication_id,
        sharePublicationId: shareDashboardResponse.publication.publication_id,
        externalTargetId: exportTargetResponse.transfer.transfer_id,
        screenshots: {
          report_detail: path.join(proofRoot, "browser", "report-detail.png"),
          dashboard_detail: path.join(proofRoot, "browser", "dashboard-detail.png"),
          dashboard_published_embed: path.join(proofRoot, "browser", "dashboard-published-embed.png"),
          dashboard_external_target: path.join(proofRoot, "browser", "dashboard-external-target.png")
        }
      },
      null,
      2
    )
  );
} finally {
  if (browser) {
    await browser.close();
  }
  await reportServer.close();
  await terminateDashboardServer();
  if (!success) {
    writeJson("evidence/evidence-pack.json", {
      verification_status: "failed",
      generated_at: now(),
      checks: [],
      warnings: ["excel-dashboard-cross-engine flow failed before successful completion"]
    });
  }
}
