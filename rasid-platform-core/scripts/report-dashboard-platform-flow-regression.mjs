import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const { ReportEngine } = await load("packages/report-engine/dist/index.js");
const { startReportPlatformServer } = await load("packages/report-engine/dist/platform.js");

const runId = `report-dashboard-platform-flow-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "report-engine", "artifacts", "latest-run", runId);
const runtimeRoot = path.join(root, ".runtime", "report-dashboard-platform-flow", runId);
const reportStorageDir = path.join(runtimeRoot, "report-engine");
const dashboardWebRoot = path.join(root, ".runtime", "dashboard-web");
const dashboardPort = 4336;
const dashboardBaseUrl = `http://127.0.0.1:${dashboardPort}`;
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserExecutablePath) {
  throw new Error("No browser executable available for live cross-engine flow proof.");
}

fs.rmSync(outputRoot, { recursive: true, force: true });
for (const directory of ["api", "browser", "records", "evidence", "audit", "lineage", "intermediate", "export"]) {
  fs.mkdirSync(path.join(outputRoot, directory), { recursive: true });
}
fs.mkdirSync(runtimeRoot, { recursive: true });

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

const copyFileIntoProof = (sourcePath, relativePath) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async (url) => {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw lastError ?? new Error(`Server did not become ready: ${url}`);
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

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }
  return JSON.parse(text);
};

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }
  return text;
};

const reportEngine = new ReportEngine({ storageDir: reportStorageDir });
const reportId = `report-platform-flow-${Date.now()}`;
const created = reportEngine.createReport({
  report_id: reportId,
  tenant_ref: "tenant-report-dashboard-platform-flow",
  workspace_id: "workspace-report-dashboard-platform-flow",
  project_id: "project-report-dashboard-platform-flow",
  created_by: "report-dashboard-platform-flow",
  title: "Cross Engine Report Dashboard Proof",
  description: "A live report that must continue into dashboard publish/share/export.",
  mode: "advanced",
  sections: [
    {
      section_kind: "executive_summary",
      title: "Executive Summary",
      blocks: [
        {
          block_type: "metric_card",
          title: "Revenue",
          body: "Revenue reached 125 USD for the active reporting window.",
          metric_value: 125,
          caption: "Primary KPI from report-engine source of truth.",
          source_metadata: { metric_unit: "USD", owner: "Noura", source_system: "report-engine" }
        },
        {
          block_type: "narrative",
          title: "Narrative",
          body: "Riyadh leads performance while Jeddah remains the main open-risk cluster.",
          caption: "Narrative block preserved from report current state."
        }
      ]
    },
    {
      section_kind: "body",
      title: "Regional Detail",
      blocks: [
        {
          block_type: "table",
          title: "Regional Table",
          body: "Regional operations table.",
          table_rows: [
            ["Region", "Revenue", "Cases"],
            ["Riyadh", "125", "8"],
            ["Jeddah", "90", "3"],
            ["Dammam", "65", "2"]
          ],
          caption: "Tabular structure preserved for dashboard table consumption."
        },
        {
          block_type: "chart",
          title: "Revenue Trend",
          body: "Quarterly trend carried into dashboard charting.",
          chart_series: [
            { label: "Jan", value: 80 },
            { label: "Feb", value: 102 },
            { label: "Mar", value: 125 }
          ],
          caption: "Chart points preserved for downstream widgets."
        }
      ]
    }
  ]
});

const reportServer = await startReportPlatformServer({ host: "127.0.0.1", port: 4426, engine: reportEngine });
const dashboardServer = spawn("node", ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: root,
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_HOST: "127.0.0.1",
    RASID_DASHBOARD_WEB_PORT: String(dashboardPort)
  },
  stdio: "ignore"
});

let browser = null;
try {
  await waitForServer(`${reportServer.origin}/login`);
  await waitForServer(`${dashboardBaseUrl}/login`);

  const reportLogin = await fetchJson(`${reportServer.origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin", password: "1500", tenantRef: "tenant-default" })
  });
  const reportToken = reportLogin.data.accessToken;
  writeJson("api/report-login.json", reportLogin);

  const dashboardLogin = await fetchJson(`${dashboardBaseUrl}/api/v1/governance/auth/login`, {
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
  const dashboardToken = dashboardLogin.data.accessToken;
  writeJson("api/dashboard-login.json", dashboardLogin);

  const reportApi = async (endpoint, method = "GET", body = undefined) =>
    fetchJson(`${reportServer.origin}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${reportToken}`,
        "x-tenant-id": "tenant-default",
        ...(body ? { "content-type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

  const dashboardApi = async (endpoint, method = "GET", body = undefined) =>
    fetchJson(`${dashboardBaseUrl}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${dashboardToken}`,
        "x-tenant-ref": "tenant-default",
        ...(body ? { "content-type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

  const reportDetail = await reportApi(`/api/v1/reports/reports/${reportId}`);
  const reportReview = await reportApi(`/api/v1/reports/reports/${reportId}/review`, "POST", {});
  const reportApprove = await reportApi(`/api/v1/reports/reports/${reportId}/approve`, "POST", {});
  const reportDetailAfterApproval = await reportApi(`/api/v1/reports/reports/${reportId}`);
  writeJson("api/report-detail.json", reportDetail);
  writeJson("api/report-review.json", reportReview);
  writeJson("api/report-approve.json", reportApprove);
  writeJson("api/report-detail-after-approval.json", reportDetailAfterApproval);

  browser = await chromium.launch({ headless: true, executablePath: browserExecutablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await context.addCookies([
    { name: "rasid_access_token", value: reportToken, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: "127.0.0.1", path: "/" },
    { name: "rasid_auth", value: dashboardToken, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant", value: "tenant-default", domain: "127.0.0.1", path: "/" },
    { name: "rasid_workspace", value: "workspace-dashboard-web", domain: "127.0.0.1", path: "/" },
    { name: "rasid_project", value: "project-dashboard-web", domain: "127.0.0.1", path: "/" },
    { name: "rasid_actor", value: "admin", domain: "127.0.0.1", path: "/" }
  ]);

  const reportPage = await context.newPage();
  await reportPage.goto(`${reportServer.origin}/reports/${reportId}`, { waitUntil: "networkidle" });
  await reportPage.screenshot({ path: path.join(outputRoot, "browser", "report-detail.png"), fullPage: true });
  await reportPage.close();

  const dashboardSurfacePage = await context.newPage();
  await dashboardSurfacePage.goto(`${dashboardBaseUrl}/reports?report_id=${encodeURIComponent(reportId)}`, { waitUntil: "networkidle" });
  await dashboardSurfacePage.screenshot({ path: path.join(outputRoot, "browser", "report-bridge-surface.png"), fullPage: true });
  await dashboardSurfacePage.close();

  const conversion = await dashboardApi("/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    report_storage_dir: reportStorageDir,
    target_ref: "workspace://dashboards/report-platform-flow",
    approval_granted: true
  });
  writeJson("api/report-to-dashboard.json", conversion);

  const dashboardId = conversion.report_bridge.dashboard_id;
  const dashboardState = await dashboardApi(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`);
  writeJson("api/dashboard-state.json", dashboardState);

  const dashboardPage = await context.newPage();
  await dashboardPage.goto(`${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}`, { waitUntil: "networkidle" });
  await dashboardPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-detail.png"), fullPage: true });
  await dashboardPage.close();

  const publish = await dashboardApi("/api/v1/dashboards/publish", "POST", { dashboard_id: dashboardId, approval_granted: true });
  const share = await dashboardApi("/api/v1/dashboards/share", "POST", { dashboard_id: dashboardId, approval_granted: true });
  writeJson("api/dashboard-publish.json", publish);
  writeJson("api/dashboard-share.json", share);

  const exportWidgetRef =
    dashboardState.dashboard.widgets.find((widget) => widget.widget_type !== "filter")?.widget_id ??
    dashboardState.dashboard.widgets[0]?.widget_id;
  if (!exportWidgetRef) {
    throw new Error("No exportable widget found in dashboard flow.");
  }
  const exportTarget = await dashboardApi("/api/v1/dashboards/export-widget-target", "POST", {
    dashboard_id: dashboardId,
    widget_ref: exportWidgetRef,
    target_kind: "live_external"
  });
  writeJson("api/dashboard-export-target.json", exportTarget);

  const fetchPublicationAssets = async (prefix, transport) => {
    const manifest = await fetchJson(transport.served_manifest_url);
    const publishState = await fetchJson(transport.served_publish_state_url);
    const embedPayload = await fetchJson(transport.served_embed_payload_url);
    const embedHtml = await fetchText(transport.served_embed_html_url);
    const runtimeState = await fetchJson(`${transport.served_base_url}/runtime-state?access_token=${encodeURIComponent(transport.served_access_token)}`);
    const evidence = await fetchJson(`${transport.served_base_url}/evidence?access_token=${encodeURIComponent(transport.served_access_token)}`);
    const audit = await fetchJson(`${transport.served_base_url}/audit?access_token=${encodeURIComponent(transport.served_access_token)}`);
    const lineage = await fetchJson(`${transport.served_base_url}/lineage?access_token=${encodeURIComponent(transport.served_access_token)}`);
    writeJson(`api/${prefix}-manifest.json`, manifest);
    writeJson(`api/${prefix}-publish-state.json`, publishState);
    writeJson(`api/${prefix}-embed-payload.json`, embedPayload);
    writeJson(`api/${prefix}-runtime-state.json`, runtimeState);
    writeJson(`evidence/${prefix}.json`, evidence);
    writeJson(`audit/${prefix}.json`, audit);
    writeJson(`lineage/${prefix}.json`, lineage);
    writeText(`export/${prefix}-embed.html`, embedHtml);
    return { manifest, publishState, embedPayload, runtimeState, evidence, audit, lineage, embedHtmlPath: path.join(outputRoot, "export", `${prefix}-embed.html`) };
  };

  const publishAssets = await fetchPublicationAssets("dashboard-publish", publish.transport);
  const shareAssets = await fetchPublicationAssets("dashboard-share", share.transport);

  const publishedPage = await context.newPage();
  await publishedPage.goto(publish.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await publishedPage.screenshot({ path: path.join(outputRoot, "browser", "published-embed.png"), fullPage: true });
  await publishedPage.close();

  const sharedPage = await context.newPage();
  await sharedPage.goto(share.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await sharedPage.screenshot({ path: path.join(outputRoot, "browser", "shared-embed.png"), fullPage: true });
  await sharedPage.close();
  await context.close();
  await browser.close();
  browser = null;

  const reportCurrentStatePath = path.join(reportStorageDir, "reports", reportId, "state", "current.json");
  const dashboardCurrentStatePath = path.join(dashboardWebRoot, "dashboard-engine", "dashboards", dashboardId, "state", "current.json");
  const convertEvidencePath = latestMatchingFile(path.join(reportStorageDir, "reports", reportId, "evidence"), "report_convert_dashboard");
  const convertAuditPath = latestMatchingFile(path.join(reportStorageDir, "reports", reportId, "audit"), "report_convert_dashboard");
  const convertLineagePath = latestMatchingFile(path.join(reportStorageDir, "reports", reportId, "lineage"), "dashboard");

  copyFileIntoProof(reportCurrentStatePath, "intermediate/report-current-state.json");
  copyFileIntoProof(conversion.report_bridge.bridge_manifest_path, "intermediate/report-dashboard-bridge-manifest.json");
  copyFileIntoProof(dashboardCurrentStatePath, "intermediate/dashboard-current-state.json");
  copyFileIntoProof(exportTarget.transfer.preview_path, "export/widget-live-external-preview.html");
  copyFileIntoProof(exportTarget.transfer.artifact_path, "export/widget-live-external-artifact.json");
  copyFileIntoProof(exportTarget.transfer.evidence_path, "evidence/dashboard-export-target.json");
  copyFileIntoProof(exportTarget.transfer.audit_path, "audit/dashboard-export-target.json");
  copyFileIntoProof(exportTarget.transfer.lineage_path, "lineage/dashboard-export-target.json");
  if (convertEvidencePath) {
    copyFileIntoProof(convertEvidencePath, "evidence/report-convert-dashboard.json");
  }
  if (convertAuditPath) {
    copyFileIntoProof(convertAuditPath, "audit/report-convert-dashboard.json");
  }
  if (convertLineagePath) {
    copyFileIntoProof(convertLineagePath, "lineage/report-convert-dashboard.json");
  }
  copyFileIntoProof(conversion.report_bridge.bridge_evidence_path, "evidence/report-dashboard-bridge.json");
  copyFileIntoProof(conversion.report_bridge.bridge_audit_path, "audit/report-dashboard-bridge.json");
  copyFileIntoProof(conversion.report_bridge.bridge_lineage_path, "lineage/report-dashboard-bridge.json");

  const flowProof = {
    phase_requirement: "report-engine cross-engine end-to-end flow proof",
    entrypoint: {
      report_platform_route: `/api/v1/reports/reports/${reportId}`,
      dashboard_route: "/api/v1/reports/convert-to-dashboard"
    },
    runtime_paths: {
      report_platform_origin: reportServer.origin,
      dashboard_base_url: dashboardBaseUrl,
      report_storage_dir: reportStorageDir,
      report_runtime_root: path.join(reportStorageDir, "reports", reportId),
      dashboard_runtime_root: path.join(dashboardWebRoot, "dashboard-engine", "dashboards", dashboardId)
    },
    final_output: {
      report_id: reportId,
      dashboard_id: dashboardId,
      publish_publication_id: publish.publication.publication_id,
      share_publication_id: share.publication.publication_id,
      export_transfer_id: exportTarget.transfer.transfer_id,
      publish_embed_url: publish.transport.served_embed_html_url,
      share_embed_url: share.transport.served_embed_html_url,
      export_open_path: exportTarget.transfer.open_path
    },
    bridge: conversion.report_bridge,
    publish_transport: publish.transport,
    share_transport: share.transport,
    publish_assets: {
      manifest_path: path.join(outputRoot, "api", "dashboard-publish-manifest.json"),
      runtime_state_path: path.join(outputRoot, "api", "dashboard-publish-runtime-state.json"),
      embed_html_path: path.join(outputRoot, "export", "dashboard-publish-embed.html")
    },
    share_assets: {
      manifest_path: path.join(outputRoot, "api", "dashboard-share-manifest.json"),
      runtime_state_path: path.join(outputRoot, "api", "dashboard-share-runtime-state.json"),
      embed_html_path: path.join(outputRoot, "export", "dashboard-share-embed.html")
    },
    assertions: {
      report_engine_live_loop: conversion.report_bridge.report_id === reportId,
      dashboard_consumes_report_runtime: dashboardState.dashboard.source_dataset_refs.every((datasetRef) =>
        conversion.report_bridge.dataset_mappings.some((mapping) => mapping.local_dataset_id === datasetRef)
      ),
      dashboard_rendered_rows_present: Array.isArray(dashboardState.rendered) && dashboardState.rendered.length > 0,
      publish_share_export_continuity:
        publish.snapshot.dashboard.dashboard_id === dashboardId &&
        share.snapshot.dashboard.dashboard_id === dashboardId &&
        exportTarget.transfer.dashboard_id === dashboardId
    }
  };
  writeJson("records/flow-proof.json", flowProof);
  writeJson("records/report-create.json", created.payload);
  writeJson("records/report-review.json", reportReview);
  writeJson("records/report-approve.json", reportApprove);
  writeJson("records/report-to-dashboard.json", conversion);
  writeJson("records/dashboard-publish.json", publish);
  writeJson("records/dashboard-share.json", share);
  writeJson("records/dashboard-export-target.json", exportTarget);

  console.log(outputRoot);
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  dashboardServer.kill();
  await reportServer.close();
}
