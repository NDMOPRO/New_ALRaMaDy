import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright-core";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const { ReportEngine } = await load("packages/report-engine/dist/index.js");
const { startReportPlatformServer } = await load("packages/report-engine/dist/platform.js");
const { ArabicLocalizationLctEngine } = await load("packages/arabic-localization-lct-engine/dist/index.js");
const { startDashboardWebApp, stopDashboardWebApp } = await load("apps/contracts-cli/dist/dashboard-web.js");

const compactTimestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const runId = `report-dashboard-localization-platform-flow-${compactTimestamp}`;
const proofRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", runId);
const runtimeRoot = path.join(root, ".runtime", "report-dashboard-localization-platform-flow", runId);
const reportStorageDir = path.join(runtimeRoot, "report-engine");
const localizationOutputRoot = path.join(proofRoot, "localization-run");
const findFreePort = async () =>
  await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
const dashboardPort = await findFreePort();
const reportPort = await findFreePort();
const dashboardBaseUrl = `http://127.0.0.1:${dashboardPort}`;
const reportBaseUrl = `http://127.0.0.1:${reportPort}`;
const dashboardRuntimeRoot = path.join(root, ".runtime", "dashboard-web");
const reportId = `report-localization-platform-${Date.now()}`;
const marker = `FLOWMARK-${Date.now()}`;

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserExecutablePath) {
  throw new Error("No browser executable available for live platform localization proof.");
}

for (const directory of [
  proofRoot,
  runtimeRoot,
  path.join(proofRoot, "api"),
  path.join(proofRoot, "audit"),
  path.join(proofRoot, "browser"),
  path.join(proofRoot, "evidence"),
  path.join(proofRoot, "export"),
  path.join(proofRoot, "intermediate"),
  path.join(proofRoot, "lineage"),
  path.join(proofRoot, "records")
]) {
  fs.mkdirSync(directory, { recursive: true });
}

const now = () => new Date().toISOString();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const copyIntoProof = (sourcePath, relativePath) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const waitForServer = async (url) => {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw lastError ?? new Error(`Server did not become ready: ${url}`);
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

const navigateForProof = async (page, url) => {
  await page.goto(url, { waitUntil: "commit", timeout: 45000 });
  await page.waitForTimeout(4000);
};

const reportEngine = new ReportEngine({ storageDir: reportStorageDir });
const dashboardServer = startDashboardWebApp({
  host: "127.0.0.1",
  port: dashboardPort
});
const reportServer = await startReportPlatformServer({
  host: "127.0.0.1",
  port: reportPort,
  engine: reportEngine
});

let browser = null;
let resultSummary = null;
let scriptError = null;

try {
  reportEngine.createReport({
    report_id: reportId,
    tenant_ref: "tenant-platform-localization-flow",
    workspace_id: "workspace-platform-localization-flow",
    project_id: "project-platform-localization-flow",
    created_by: "report-dashboard-localization-platform-flow",
    title: `Platform Localization Proof ${marker}`,
    description: `Shared platform proof marker ${marker}.`,
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
            source_metadata: { metric_unit: "USD", owner: "Noura", marker }
          },
          {
            block_type: "narrative",
            title: `Marker ${marker}`,
            body: `Shared platform localization continuity must preserve ${marker} from report to dashboard to localization publish.`,
            caption: "Marker block used to detect data loss across engines."
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
              ["Region", "Revenue", "Cases", "Marker"],
              ["Riyadh", "125", "8", marker],
              ["Jeddah", "90", "3", marker],
              ["Dammam", "65", "2", marker]
            ],
            caption: "Tabular structure preserved for dashboard table consumption."
          },
          {
            block_type: "chart",
            title: "Revenue Trend",
            body: `Quarterly trend carried into dashboard charting for ${marker}.`,
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

  await waitForServer(`${reportBaseUrl}/login`);
  await waitForServer(`${dashboardServer.base_url}/login`);

  const reportLogin = await fetchJson(`${reportBaseUrl}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin", password: "1500", tenantRef: "tenant-default" })
  });
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
  writeJson("api/report-login.json", reportLogin);
  writeJson("api/dashboard-login.json", dashboardLogin);

  const reportToken = reportLogin.data.accessToken;
  const dashboardToken = dashboardLogin.data.accessToken;

  const reportApi = async (endpoint, method = "GET", body = undefined) =>
    fetchJson(`${reportBaseUrl}${endpoint}`, {
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
  const reportState = await reportApi(`/api/v1/reports/reports/${reportId}`);
  writeJson("api/report-detail.json", reportDetail);
  writeJson("api/report-review.json", reportReview);
  writeJson("api/report-approve.json", reportApprove);
  writeJson("api/report-state.json", reportState);

  browser = await chromium.launch({ headless: true, executablePath: browserExecutablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  context.setDefaultNavigationTimeout(120000);
  context.setDefaultTimeout(120000);
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
  await navigateForProof(reportPage, `${reportBaseUrl}/reports/${reportId}`);
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-detail.png"), fullPage: true });
  await reportPage.close();

  const localizationSurfacePage = await context.newPage();
  await navigateForProof(localizationSurfacePage, `${dashboardBaseUrl}/localization`);
  await localizationSurfacePage.screenshot({ path: path.join(proofRoot, "browser", "localization-surface.png"), fullPage: true });
  await localizationSurfacePage.close();

  const reportToDashboard = await dashboardApi("/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    report_storage_dir: reportStorageDir,
    target_ref: "workspace://dashboards/platform-localization-flow",
    approval_granted: true
  });
  writeJson("api/report-to-dashboard.json", reportToDashboard);

  const sharedDashboardId = reportToDashboard.report_bridge.dashboard_id;
  const sharedDashboardState = await dashboardApi(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(sharedDashboardId)}`);
  writeJson("api/shared-dashboard-state.json", sharedDashboardState);

  const sharedDashboardPage = await context.newPage();
  await navigateForProof(sharedDashboardPage, `${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(sharedDashboardId)}`);
  await sharedDashboardPage.screenshot({ path: path.join(proofRoot, "browser", "shared-dashboard.png"), fullPage: true });
  await sharedDashboardPage.close();

  const sourceDashboardRoot = path.dirname(path.dirname(reportToDashboard.report_bridge.source_dashboard_state_path));
  const sourceDashboardCurrent = readJson(reportToDashboard.report_bridge.source_dashboard_state_path);
  const sourceArtifactPath = path.join(sourceDashboardRoot, "artifacts", `${sourceDashboardCurrent.dashboard.artifact_ref}.json`);
  const sourceCanonicalPath = path.join(sourceDashboardRoot, "canonical", `${sourceDashboardCurrent.dashboard.canonical_ref}.json`);
  const sourceArtifact = readJson(sourceArtifactPath);
  const sourceCanonical = readJson(sourceCanonicalPath);
  copyIntoProof(reportToDashboard.report_bridge.source_dashboard_state_path, "intermediate/source-dashboard-current.json");
  copyIntoProof(sourceArtifactPath, "intermediate/source-dashboard-artifact.json");
  copyIntoProof(sourceCanonicalPath, "intermediate/source-dashboard-canonical.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_manifest_path, "intermediate/report-dashboard-bridge-manifest.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_artifact_path, "intermediate/report-dashboard-bridge-artifact.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_evidence_path, "evidence/report-dashboard-bridge.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_audit_path, "audit/report-dashboard-bridge.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_lineage_path, "lineage/report-dashboard-bridge.json");

  const localizationInput = {
    run_id: `platform-localization-${String(Date.now()).slice(-8)}`,
    tenant_ref: String(sourceDashboardCurrent.dashboard.tenant_ref ?? "tenant-default"),
    workspace_id: String(sourceDashboardCurrent.dashboard.workspace_id ?? "workspace-dashboard-web"),
    project_id: String(sourceDashboardCurrent.dashboard.project_id ?? "project-dashboard-web"),
    created_by: "report-dashboard-localization-platform-flow",
    mode: "advanced",
    source_artifact: sourceArtifact,
    source_canonical: sourceCanonical,
    target_locale: "ar-SA",
    publish_target_ref: "workspace://localization/platform-report-dashboard",
    profiles: [],
    rules: [],
    protected_terms: [],
    non_translatable_terms: [],
    allow_degraded_publish: true,
    output_root: localizationOutputRoot
  };

  const localizationInputPayload = {
    flow: ["report-engine", "dashboard-web", "arabic-localization-lct-engine", "dashboard-web", "publish"],
    upstream: {
      report_id: reportId,
      report_storage_dir: reportStorageDir,
      shared_dashboard_id: sharedDashboardId,
      shared_dashboard_state_path: reportToDashboard.report_bridge.source_dashboard_state_path,
      shared_dashboard_publication_target_ref: reportToDashboard.report_bridge.native_publication_target_ref,
      proof_marker: marker
    }
  };

  const localizationInputCanonicalPath = path.join(localizationOutputRoot, "input", "source-dashboard-canonical.json");
  fs.mkdirSync(path.dirname(localizationInputCanonicalPath), { recursive: true });
  fs.writeFileSync(localizationInputCanonicalPath, `${JSON.stringify(sourceCanonical, null, 2)}\n`, "utf8");

  const localizationEngine = new ArabicLocalizationLctEngine();
  const localizationBundle = await localizationEngine.run(
    localizationInput,
    localizationInputPayload,
    {
      filePath: localizationInputCanonicalPath,
      uri: pathToFileURL(localizationInputCanonicalPath).href,
      checksum: ""
    }
  );

  const localizationEvidence = readJson(localizationBundle.persisted_artifacts.evidence_path);
  const localizationAudit = readJson(localizationBundle.persisted_artifacts.audit_path);
  const localizationLineage = readJson(localizationBundle.persisted_artifacts.lineage_path);
  const localizationClosure = readJson(localizationBundle.persisted_artifacts.dashboard_artifact_closure_path);
  const localizationFidelity = readJson(localizationBundle.persisted_artifacts.fidelity_report_path);
  const localizationAdapterMetadata = readJson(localizationBundle.persisted_artifacts.native_adapter_metadata_path);
  const localizedEmbedPayload = readJson(localizationAdapterMetadata.transport.embed_payload_path);
  writeJson("api/localization-adapter-metadata.json", localizationAdapterMetadata);
  copyIntoProof(localizationBundle.persisted_artifacts.evidence_path, "evidence/localization-engine.json");
  copyIntoProof(localizationBundle.persisted_artifacts.audit_path, "audit/localization-engine.json");
  copyIntoProof(localizationBundle.persisted_artifacts.lineage_path, "lineage/localization-engine.json");
  copyIntoProof(localizationBundle.persisted_artifacts.dashboard_artifact_closure_path, "intermediate/localization-dashboard-artifact-closure.json");
  copyIntoProof(localizationBundle.persisted_artifacts.fidelity_report_path, "intermediate/localization-fidelity-report.json");
  copyIntoProof(localizationAdapterMetadata.transport.embed_payload_path, "intermediate/localized-dashboard-embed-payload.json");
  copyIntoProof(localizationAdapterMetadata.transport.manifest_path, "intermediate/localized-dashboard-manifest.json");
  copyIntoProof(localizationAdapterMetadata.transport.publish_state_path, "intermediate/localized-dashboard-publish-state.json");

  const shellLocalizationConsume = await dashboardApi("/api/v1/localization/consume-dashboard-output", "POST", {
    payload_path: localizationAdapterMetadata.transport.embed_payload_path,
    publish_state_path: localizationAdapterMetadata.transport.publish_state_path,
    localization_proof_path: path.join(path.dirname(localizationBundle.persisted_artifacts.localized_output_path), "dashboard-bundle", "localization-proof.json"),
    source_kind: "shared_runtime_localized_dashboard_bundle",
    source_refs: [
      localizationBundle.persisted_artifacts.localized_output_path,
      localizationBundle.persisted_artifacts.dashboard_artifact_closure_path,
      localizationBundle.persisted_artifacts.fidelity_report_path
    ],
    description: "Consumed from the fresh shared-runtime localized dashboard bundle.",
    approval_granted: true
  });
  writeJson("api/shell-localization-consume.json", shellLocalizationConsume);
  copyIntoProof(shellLocalizationConsume.localization_consume.consume_manifest_path, "intermediate/localization-consume-manifest.json");
  copyIntoProof(shellLocalizationConsume.localization_consume.consume_evidence_path, "evidence/localization-consume.json");
  copyIntoProof(shellLocalizationConsume.localization_consume.consume_audit_path, "audit/localization-consume.json");
  copyIntoProof(shellLocalizationConsume.localization_consume.consume_lineage_path, "lineage/localization-consume.json");

  const localizedShellDashboardId = shellLocalizationConsume.localization_consume.dashboard_id;
  const localizedShellDashboardState = await dashboardApi(
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(localizedShellDashboardId)}`
  );
  writeJson("api/localized-shell-dashboard-state.json", localizedShellDashboardState);

  const localizedShellDashboardPage = await context.newPage();
  await navigateForProof(localizedShellDashboardPage, `${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(localizedShellDashboardId)}`);
  await localizedShellDashboardPage.screenshot({ path: path.join(proofRoot, "browser", "localized-shell-dashboard.png"), fullPage: true });
  await localizedShellDashboardPage.close();

  const localizedPublish = await dashboardApi("/api/v1/dashboards/publish", "POST", {
    dashboard_id: localizedShellDashboardId,
    approval_granted: true
  });
  writeJson("api/localized-shell-publish.json", localizedPublish);

  const publishManifest = readJson(localizedPublish.transport.manifest_path);
  const publishState = readJson(localizedPublish.transport.publish_state_path);
  const publishEmbedPayload = readJson(localizedPublish.transport.embed_payload_path);
  const publishEmbedHtml = fs.readFileSync(localizedPublish.transport.embed_html_path, "utf8");
  const publishEvidence = Array.isArray(localizedPublish.snapshot?.evidence) ? localizedPublish.snapshot.evidence : [];
  const publishAudit = Array.isArray(localizedPublish.snapshot?.audit) ? localizedPublish.snapshot.audit : [];
  const publishLineage = Array.isArray(localizedPublish.snapshot?.lineage) ? localizedPublish.snapshot.lineage : [];
  writeJson("api/localized-shell-publish-manifest.json", publishManifest);
  writeJson("api/localized-shell-publish-state.json", publishState);
  writeJson("api/localized-shell-publish-embed-payload.json", publishEmbedPayload);
  writeText("export/localized-shell-publish-embed.html", publishEmbedHtml);
  writeJson("evidence/localized-shell-publish.json", publishEvidence);
  writeJson("audit/localized-shell-publish.json", publishAudit);
  writeJson("lineage/localized-shell-publish.json", publishLineage);

  const localizedPublishedPage = await context.newPage();
  await navigateForProof(localizedPublishedPage, localizedPublish.transport.served_embed_html_url);
  await localizedPublishedPage.screenshot({ path: path.join(proofRoot, "browser", "localized-shell-published.png"), fullPage: true });
  await localizedPublishedPage.close();

  await context.close();
  await browser.close();
  browser = null;

  const localizedShellStatePath = path.join(
    dashboardRuntimeRoot,
    "dashboard-engine",
    "dashboards",
    localizedShellDashboardId,
    "state",
    "current.json"
  );
  copyIntoProof(localizedShellStatePath, "intermediate/localized-shell-dashboard-current.json");

  const combinedLineage = [
    ...localizationLineage,
    ...(Array.isArray(publishLineage) ? publishLineage : []),
    {
      edge_id: `edge-shared-platform-${Date.now()}`,
      from_ref: sourceArtifact.artifact_id,
      to_ref: localizationBundle.localized_artifact.artifact_id,
      transform_ref: "arabic_localization_lct.platform_localize",
      ai_suggestion_ref: "",
      ai_decision: "accepted",
      template_ref: String(sourceDashboardCurrent.dashboard.template_ref ?? ""),
      dataset_binding_ref: "",
      version_diff_ref: String(localizationBundle.localized_artifact.version_ref?.version_id ?? "")
    }
  ];
  writeJson("lineage/combined-flow.json", combinedLineage);

  const assertions = {
    report_review_approved: reportApprove.data?.report?.status === "approved",
    shared_shell_dashboard_created_from_report: reportToDashboard.report_bridge.report_id === reportId,
    shared_shell_dashboard_contains_marker: JSON.stringify(sharedDashboardState).includes(marker),
    localization_engine_consumed_shared_dashboard_artifact:
      localizationBundle.input.source_artifact.artifact_id === sourceArtifact.artifact_id,
    localization_engine_consumed_shared_dashboard_canonical:
      localizationBundle.input.source_canonical.canonical_id === sourceCanonical.canonical_id,
    localized_bundle_contains_marker: JSON.stringify(localizedEmbedPayload).includes(marker),
    shell_localization_consumed_explicit_bundle:
      shellLocalizationConsume.localization_consume.source_kind === "shared_runtime_localized_dashboard_bundle" &&
      shellLocalizationConsume.localization_consume.source_payload_path === localizationAdapterMetadata.transport.embed_payload_path &&
      shellLocalizationConsume.localization_consume.source_publish_state_path === localizationAdapterMetadata.transport.publish_state_path,
    shell_localization_route_contains_marker: JSON.stringify(localizedShellDashboardState).includes(marker),
    shell_localization_governed:
      shellLocalizationConsume.governance?.decision?.action_id === "governance.external.consume.v1",
    localized_shell_publish_governed:
      localizedPublish.governance?.decision?.action_id === "dashboard.publish.v1",
    localized_publish_transport_live:
      typeof localizedPublish.transport?.served_embed_html_url === "string" &&
      localizedPublish.transport.served_embed_html_url.length > 0 &&
      JSON.stringify(publishManifest).includes(localizedPublish.publication.publication_id),
    localized_publish_embed_contains_marker: JSON.stringify(publishEmbedPayload).includes(marker),
    localization_closure_production_ready: localizationClosure.production_readiness === "stable",
    localization_fidelity_verified: localizationFidelity.status === "verified"
  };

  const flowProof = {
    phase_requirement: "reports -> dashboards -> localization -> publish shared platform proof",
    generated_at: now(),
    flow: ["report-engine", "dashboard-web", "arabic-localization-lct-engine", "dashboard-web", "publish"],
    runtime_paths: {
      report_origin: reportBaseUrl,
      dashboard_origin: dashboardBaseUrl,
      report_storage_dir: reportStorageDir,
      localization_output_root: localizationOutputRoot,
      localized_shell_dashboard_runtime_root: path.join(
        dashboardRuntimeRoot,
        "dashboard-engine",
        "dashboards",
        localizedShellDashboardId
      )
    },
    identifiers: {
      report_id: reportId,
      shared_dashboard_id: sharedDashboardId,
      localized_shell_dashboard_id: localizedShellDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id,
      proof_marker: marker
    },
    sources: {
      shared_dashboard_state_path: reportToDashboard.report_bridge.source_dashboard_state_path,
      shared_dashboard_artifact_path: sourceArtifactPath,
      shared_dashboard_canonical_path: sourceCanonicalPath,
      localization_adapter_metadata_path: localizationBundle.persisted_artifacts.native_adapter_metadata_path,
      localization_consume_manifest_path: shellLocalizationConsume.localization_consume.consume_manifest_path
    },
    routes: {
      report_to_dashboard: `${dashboardBaseUrl}/api/v1/reports/convert-to-dashboard`,
      localization_consume: `${dashboardBaseUrl}/api/v1/localization/consume-dashboard-output`,
      localized_publish: `${dashboardBaseUrl}/api/v1/dashboards/publish`,
      localized_publish_embed: localizedPublish.transport.served_embed_html_url
    },
    observed_behavior: {
      shell_localization_dashboard_title: localizedShellDashboardState.dashboard.title,
      shell_localization_dashboard_description: localizedShellDashboardState.dashboard.description,
      shell_localization_report_ids:
        localizedShellDashboardState.rendered?.find((entry) => entry.widget_type === "table")?.rows?.map((row) => row.report_id) ?? [],
      localization_bundle_widget_titles: localizedEmbedPayload.widgets.map((widget) => widget.title),
      contradiction_if_marker_missing:
        JSON.stringify(localizedShellDashboardState).includes(marker) === false &&
        JSON.stringify(localizedEmbedPayload).includes(marker) === true
    },
    screenshots: {
      report_detail: path.join(proofRoot, "browser", "report-detail.png")
    },
    assertions,
    status: Object.values(assertions).every(Boolean) ? "pass" : "contradiction"
  };
  writeJson("records/flow-proof.json", flowProof);
  writeJson("records/report-detail.json", reportDetail);
  writeJson("records/report-review.json", reportReview);
  writeJson("records/report-approve.json", reportApprove);
  writeJson("records/report-to-dashboard.json", reportToDashboard);
  writeJson("records/shell-localization-consume.json", shellLocalizationConsume);
  writeJson("records/localized-shell-publish.json", localizedPublish);

  if (!Object.values(assertions).every(Boolean)) {
    throw new Error(`Platform localization proof assertions failed: ${JSON.stringify(assertions)}`);
  }

  resultSummary = {
    runId,
    proofRoot,
    flowProofPath: path.join(proofRoot, "records", "flow-proof.json"),
    marker,
    reportId,
    sharedDashboardId,
    localizedShellDashboardId,
    localizedPublicationId: localizedPublish.publication.publication_id
  };
} catch (error) {
  scriptError = error;
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  await Promise.race([stopDashboardWebApp().catch(() => undefined), wait(2000)]);
  await Promise.race([reportServer.close(), wait(2000)]);
}

if (scriptError) {
  throw scriptError;
}

console.log(JSON.stringify(resultSummary, null, 2));
process.exit(0);
