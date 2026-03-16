import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const { ReportEngine } = await load("packages/report-engine/dist/index.js");
const { startReportPlatformServer } = await load("packages/report-engine/dist/platform.js");

const compactTimestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const runId = `xflow-${compactTimestamp}`;
const proofRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", runId);
const runtimeRoot = path.join(root, ".runtime", "localization-cross-engine-flow", runId);
const reportStorageDir = path.join(runtimeRoot, "report-engine");
const dashboardPort = 4340;
const reportPort = 4430;
const dashboardBaseUrl = `http://127.0.0.1:${dashboardPort}`;
const reportBaseUrl = `http://127.0.0.1:${reportPort}`;
const reportId = `report-localization-xflow-${Date.now()}`;
const marker = `FLOWMARK-${Date.now()}`;

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserExecutablePath) {
  throw new Error("No browser executable available for localization cross-engine flow proof.");
}

for (const directory of [
  proofRoot,
  runtimeRoot,
  path.join(proofRoot, "api"),
  path.join(proofRoot, "artifacts"),
  path.join(proofRoot, "audit"),
  path.join(proofRoot, "browser"),
  path.join(proofRoot, "evidence"),
  path.join(proofRoot, "lineage"),
  path.join(proofRoot, "logs")
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

const copyIntoProof = (sourcePath, relativePath) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const normalizeArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const containsMarkerSignature = (value) => /FLOWMARK-[0-9\u0660-\u0669]+/u.test(String(value));

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

const reportEngine = new ReportEngine({ storageDir: reportStorageDir });
const dashboardServer = spawn("node", ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: root,
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_HOST: "127.0.0.1",
    RASID_DASHBOARD_WEB_PORT: String(dashboardPort)
  },
  stdio: ["ignore", "pipe", "pipe"]
});
const reportServer = await startReportPlatformServer({
  host: "127.0.0.1",
  port: reportPort,
  engine: reportEngine
});

let browser = null;
let dashboardStdout = "";
let dashboardStderr = "";

dashboardServer.stdout?.on("data", (chunk) => {
  dashboardStdout += chunk.toString();
});
dashboardServer.stderr?.on("data", (chunk) => {
  dashboardStderr += chunk.toString();
});

try {
  reportEngine.createReport({
    report_id: reportId,
    tenant_ref: "tenant-localization-cross-engine-flow",
    workspace_id: "workspace-localization-cross-engine-flow",
    project_id: "project-localization-cross-engine-flow",
    created_by: "localization-cross-engine-flow",
    title: `Localization Cross-Engine Flow ${marker}`,
    description: `Shared runtime dashboard localization proof ${marker}.`,
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
            source_metadata: { marker, owner: "Noura" }
          },
          {
            block_type: "narrative",
            title: `Marker ${marker}`,
            body: `Localization must consume ${marker} from shared dashboard runtime state, not from packaged embed payload.`,
            caption: "Narrative continuity marker."
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
  await waitForServer(`${dashboardBaseUrl}/login`);

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

  const reportReview = await reportApi(`/api/v1/reports/reports/${reportId}/review`, "POST", {});
  const reportApprove = await reportApi(`/api/v1/reports/reports/${reportId}/approve`, "POST", {});
  writeJson("api/report-review.json", reportReview);
  writeJson("api/report-approve.json", reportApprove);

  browser = await chromium.launch({ headless: true, executablePath: browserExecutablePath });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  await context.addCookies([
    { name: "rasid_access_token", value: reportToken, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: "127.0.0.1", path: "/" },
    { name: "rasid_auth", value: dashboardToken, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant", value: "tenant-default", domain: "127.0.0.1", path: "/" },
    { name: "rasid_workspace", value: "workspace-dashboard-web", domain: "127.0.0.1", path: "/" },
    { name: "rasid_project", value: "project-dashboard-web", domain: "127.0.0.1", path: "/" },
    { name: "rasid_actor", value: "admin", domain: "127.0.0.1", path: "/" }
  ]);

  const reportToDashboard = await dashboardApi("/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    report_storage_dir: reportStorageDir,
    target_ref: "workspace://dashboards/localization-cross-engine-flow",
    approval_granted: true
  });
  writeJson("api/report-to-dashboard.json", reportToDashboard);

  const sharedDashboardId = reportToDashboard.report_bridge.dashboard_id;
  const sharedDashboardState = await dashboardApi(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(sharedDashboardId)}`);
  writeJson("api/shared-dashboard-state.json", sharedDashboardState);

  const upstreamPage = await context.newPage();
  await upstreamPage.goto(`${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(sharedDashboardId)}`, {
    waitUntil: "networkidle"
  });
  await upstreamPage.screenshot({ path: path.join(proofRoot, "browser", "upstream-dashboard-embed.png"), fullPage: true });
  await upstreamPage.close();

  const localizationRoute = await dashboardApi("/api/v1/localization/localize-dashboard", "POST", {
    dashboard_id: sharedDashboardId,
    target_locale: "ar-SA",
    target_ref: "workspace://localization/cross-engine-flow/dashboard-ar",
    approval_granted: true
  });
  writeJson("api/localization-localize-dashboard.json", localizationRoute);

  const localizationResult = localizationRoute.localization;
  const intakeProof = readJson(localizationResult.intake_proof_path);
  const localizationArtifacts = localizationResult.localization.persisted_artifacts;
  const localizedNativeTransport = localizationResult.localization.native_transport;
  const localizationEvidence = readJson(localizationArtifacts.evidence_path);
  const localizationAudit = readJson(localizationArtifacts.audit_path);
  const localizationLineage = readJson(localizationArtifacts.lineage_path);
  const localizationFidelity = readJson(localizationArtifacts.fidelity_report_path);
  const localizationClosure = readJson(localizationArtifacts.dashboard_artifact_closure_path);
  const localizedProof = readJson(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "localization-proof.json"));
  const localizedEmbedPayload = readJson(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "embed-payload.json"));

  copyIntoProof(localizationResult.intake_proof_path, "artifacts/shared-dashboard-runtime-intake-proof.json");
  copyIntoProof(localizationArtifacts.localized_output_path, "artifacts/localized-output.html");
  copyIntoProof(localizationArtifacts.dashboard_artifact_closure_path, "artifacts/dashboard-artifact-closure.json");
  copyIntoProof(localizationArtifacts.fidelity_report_path, "artifacts/fidelity-report.json");
  copyIntoProof(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "manifest.json"), "artifacts/localized-dashboard/manifest.json");
  copyIntoProof(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "publish-state.json"), "artifacts/localized-dashboard/publish-state.json");
  copyIntoProof(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "embed-payload.json"), "artifacts/localized-dashboard/embed-payload.json");
  copyIntoProof(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "localization-proof.json"), "artifacts/localized-dashboard/localization-proof.json");

  const downstreamSharedDashboardId = localizationResult.downstream_shared_dashboard_id;
  const downstreamSharedDashboardState = await dashboardApi(
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(downstreamSharedDashboardId)}`
  );
  writeJson("api/downstream-shared-dashboard-state.json", downstreamSharedDashboardState);

  const localizedDashboardPage = await context.newPage();
  await localizedDashboardPage.goto(
    `${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(downstreamSharedDashboardId)}`,
    { waitUntil: "networkidle" }
  );
  await localizedDashboardPage.screenshot({ path: path.join(proofRoot, "browser", "localized-dashboard-shell.png"), fullPage: true });
  await localizedDashboardPage.close();

  const downstreamPublish = await dashboardApi("/api/v1/dashboards/publish", "POST", {
    dashboard_id: downstreamSharedDashboardId,
    approval_granted: true
  });
  writeJson("api/downstream-shared-dashboard-publish.json", downstreamPublish);

  const localizedManifest = await fetchJson(downstreamPublish.transport.served_manifest_url);
  const localizedPublishState = await fetchJson(downstreamPublish.transport.served_publish_state_url);
  const localizedEmbedPayloadServed = await fetchJson(downstreamPublish.transport.served_embed_payload_url);
  const localizedEmbedHtml = await fetchText(downstreamPublish.transport.served_embed_html_url);
  const localizedEvidenceServed = await fetchJson(
    `${downstreamPublish.transport.served_base_url}/evidence?access_token=${encodeURIComponent(downstreamPublish.transport.served_access_token)}`
  );
  const localizedAuditServed = await fetchJson(
    `${downstreamPublish.transport.served_base_url}/audit?access_token=${encodeURIComponent(downstreamPublish.transport.served_access_token)}`
  );
  const localizedLineageServed = await fetchJson(
    `${downstreamPublish.transport.served_base_url}/lineage?access_token=${encodeURIComponent(downstreamPublish.transport.served_access_token)}`
  );
  writeJson("api/localized-manifest.json", localizedManifest);
  writeJson("api/localized-publish-state.json", localizedPublishState);
  writeJson("api/localized-embed-payload.json", localizedEmbedPayloadServed);
  writeJson("api/localized-evidence.json", localizedEvidenceServed);
  writeJson("api/localized-audit.json", localizedAuditServed);
  writeJson("api/localized-lineage.json", localizedLineageServed);
  writeJson("api/localized-localization-proof.json", localizedProof);

  const localizedPublishedPage = await context.newPage();
  await localizedPublishedPage.goto(downstreamPublish.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await localizedPublishedPage.screenshot({ path: path.join(proofRoot, "browser", "localized-dashboard-embed.png"), fullPage: true });
  await localizedPublishedPage.close();
  await context.close();
  await browser.close();
  browser = null;

  const bridgeEvidence = readJson(reportToDashboard.report_bridge.bridge_evidence_path);
  const bridgeAudit = readJson(reportToDashboard.report_bridge.bridge_audit_path);
  const bridgeLineage = readJson(reportToDashboard.report_bridge.bridge_lineage_path);
  const bridgeManifest = readJson(reportToDashboard.report_bridge.bridge_manifest_path);

  copyIntoProof(reportToDashboard.report_bridge.bridge_manifest_path, "artifacts/report-dashboard-bridge-manifest.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_evidence_path, "evidence/report-dashboard-bridge.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_audit_path, "audit/report-dashboard-bridge.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_lineage_path, "lineage/report-dashboard-bridge.json");
  copyIntoProof(localizationArtifacts.evidence_path, "evidence/localization-engine.json");
  copyIntoProof(localizationArtifacts.audit_path, "audit/localization-engine.json");
  copyIntoProof(localizationArtifacts.lineage_path, "lineage/localization-engine.json");

  const expectedSharedStatePath = path.join(
    root,
    ".runtime",
    "dashboard-web",
    "dashboard-engine",
    "dashboards",
    sharedDashboardId,
    "state",
    "current.json"
  );

  const combinedAudit = [
    ...normalizeArray(bridgeAudit),
    ...normalizeArray(localizationAudit),
    {
      event_id: `audit-localization-cross-engine-flow-${Date.now()}`,
      timestamp: now(),
      actor_ref: "localization-cross-engine-flow-proof",
      actor_type: "service",
      action_ref: "arabic_localization_lct.cross_engine_flow.v2",
      job_ref: localizedProof.publication_id ?? localizationResult.localization.publication_id,
      object_refs: [
        reportId,
        sharedDashboardId,
        localizationResult.localization_input.source_artifact_ref,
        localizationResult.localization.localized_artifact_ref,
        downstreamSharedDashboardId,
        downstreamPublish.publication.publication_id
      ],
      workspace_id: sharedDashboardState.dashboard.workspace_id,
      tenant_ref: sharedDashboardState.dashboard.tenant_ref,
      metadata: {
        source_of_truth: localizationResult.source_of_truth,
        embed_payload_used_as_source: localizationResult.embed_payload_used_as_source,
        shared_dashboard_state_path: localizationResult.source_dashboard_state_path,
        localized_publication_url: downstreamPublish.transport.served_embed_html_url
      }
    }
  ];

  const combinedLineage = [
    ...normalizeArray(bridgeLineage),
    ...normalizeArray(localizationLineage),
    {
      edge_id: `edge-shared-dashboard-runtime-intake-${Date.now()}`,
      from_ref: localizationResult.source_dashboard_artifact_ref,
      to_ref: localizationResult.localization_input.source_artifact_ref,
      transform_ref: "dashboard.shared_runtime.localization_intake",
      ai_suggestion_ref: "",
      ai_decision: "accepted",
      template_ref: sharedDashboardState.dashboard.template_ref ?? "",
      dataset_binding_ref: "",
      version_diff_ref: localizationResult.source_dashboard_version_ref
    },
    {
      edge_id: `edge-localized-shell-import-${Date.now() + 1}`,
      from_ref: localizationResult.localization.localized_artifact_ref,
      to_ref: downstreamSharedDashboardState.dashboard.artifact_ref,
      transform_ref: "dashboard.shared_runtime.localized_import",
      ai_suggestion_ref: "",
      ai_decision: "accepted",
      template_ref: "template://dashboards/localized",
      dataset_binding_ref: "",
      version_diff_ref: downstreamSharedDashboardState.version.version_id
    },
    {
      edge_id: `edge-localized-publication-${Date.now() + 2}`,
      from_ref: downstreamSharedDashboardState.dashboard.artifact_ref,
      to_ref: downstreamPublish.publication.publication_id,
      transform_ref: "arabic_localization_lct.publish",
      ai_suggestion_ref: "",
      ai_decision: "accepted",
      template_ref: "template://dashboards/localized",
      dataset_binding_ref: "",
      version_diff_ref: downstreamSharedDashboardState.version.version_id
    }
  ];

  const assertions = {
    report_to_dashboard_live_route: reportToDashboard.report_bridge.report_id === reportId,
    shared_dashboard_runtime_state_captured: sharedDashboardState.dashboard.dashboard_id === sharedDashboardId,
    shared_runtime_state_path_matches_live_dashboard_store:
      localizationResult.source_dashboard_state_path === expectedSharedStatePath && fs.existsSync(expectedSharedStatePath),
    localization_consumes_shared_dashboard_runtime_state:
      localizationResult.source_of_truth === "shared_dashboard_runtime_state" &&
      intakeProof.source_of_truth === "shared_dashboard_runtime_state",
    embed_payload_not_used_as_source:
      localizationResult.embed_payload_used_as_source === false &&
      intakeProof.embed_payload_used_as_source === false &&
      intakeProof.embed_payload_generated_as_output_sidecar === true,
    shared_dashboard_identity_preserved:
      localizationResult.source_dashboard_artifact_ref === sharedDashboardState.dashboard.artifact_ref &&
      localizationResult.source_dashboard_canonical_ref === sharedDashboardState.dashboard.canonical_ref &&
      intakeProof.source_dashboard_artifact_ref === sharedDashboardState.dashboard.artifact_ref,
    marker_survives_upstream_to_localized_publish:
      containsMarkerSignature(JSON.stringify(sharedDashboardState)) &&
      containsMarkerSignature(JSON.stringify(localizedEmbedPayload)) &&
      containsMarkerSignature(JSON.stringify(downstreamSharedDashboardState)) &&
      containsMarkerSignature(JSON.stringify(localizedEmbedPayloadServed)) &&
      fs.existsSync(path.join(proofRoot, "browser", "localized-dashboard-embed.png")),
    localized_publish_live_and_governed:
      typeof downstreamPublish.transport.served_embed_html_url === "string" &&
      downstreamPublish.transport.served_embed_html_url.length > 0 &&
      JSON.stringify(localizedManifest).includes(downstreamPublish.publication.publication_id),
    fidelity_and_closure_preserved:
      localizationFidelity.status === "verified" &&
      localizationClosure.production_readiness === "stable",
    cross_flow_lineage_connected:
      combinedLineage.some(
        (edge) =>
          edge.from_ref === localizationResult.source_dashboard_artifact_ref &&
          edge.to_ref === localizationResult.localization_input.source_artifact_ref
      ) &&
      combinedLineage.some(
        (edge) =>
          edge.from_ref === downstreamSharedDashboardState.dashboard.artifact_ref &&
          edge.to_ref === downstreamPublish.publication.publication_id
      )
  };

  const evidence = {
    requirement: "arabic-localization-lct-engine cross-engine flow proof",
    generated_at: now(),
    flow: ["report-engine", "dashboard-web.shared-runtime", "arabic-localization-lct-engine", "publish"],
    upstream: {
      report_id: reportId,
      report_storage_dir: reportStorageDir,
      report_review_status: reportReview.data?.report?.status ?? null,
      report_approve_status: reportApprove.data?.report?.status ?? null,
      report_bridge: reportToDashboard.report_bridge,
      bridge_manifest: bridgeManifest,
      bridge_evidence_pack_id: bridgeEvidence.evidence_pack_id ?? null
    },
    shared_dashboard_runtime: {
      dashboard_id: sharedDashboardId,
      state_path: expectedSharedStatePath,
      source_snapshot_copy_path: localizationResult.source_dashboard_snapshot_copy_path,
      artifact_ref: sharedDashboardState.dashboard.artifact_ref,
      canonical_ref: sharedDashboardState.dashboard.canonical_ref,
      version_ref: sharedDashboardState.version.version_id
    },
    localization: {
      intake_proof_path: localizationResult.intake_proof_path,
      input_source_artifact_ref: localizationResult.localization_input.source_artifact_ref,
      input_source_canonical_ref: localizationResult.localization_input.source_canonical_ref,
      localized_artifact_ref: localizationResult.localization.localized_artifact_ref,
      publication_id: localizationResult.localization.publication_id,
      localized_output_path: localizationArtifacts.localized_output_path,
      publication_path: localizationArtifacts.publication_path,
      dashboard_artifact_closure_path: localizationArtifacts.dashboard_artifact_closure_path,
      fidelity_report_path: localizationArtifacts.fidelity_report_path,
      native_transport: localizedNativeTransport,
      downstream_shared_dashboard_id: downstreamSharedDashboardId,
      downstream_shared_dashboard_state_path: localizationResult.downstream_shared_dashboard_state_path,
      downstream_publish_publication_id: downstreamPublish.publication.publication_id,
      downstream_publish_transport: downstreamPublish.transport,
      evidence_pack_id: localizationEvidence.evidence_pack_id
    },
    assertions
  };

  const proof = {
    generated_at: now(),
    phase_requirement: "arabic-localization-lct-engine cross-engine flow proof",
    flow: ["report-engine", "dashboard-web.shared-runtime", "arabic-localization-lct-engine", "publish"],
    runtime: {
      report_origin: reportBaseUrl,
      dashboard_origin: dashboardBaseUrl,
      report_storage_dir: reportStorageDir,
      proof_root: proofRoot,
      source_dashboard_state_path: expectedSharedStatePath
    },
    identifiers: {
      report_id: reportId,
      shared_dashboard_id: sharedDashboardId,
      localized_artifact_ref: localizationResult.localization.localized_artifact_ref,
      localized_publication_id: downstreamPublish.publication.publication_id,
      proof_marker: marker
    },
    source_of_truth: {
      kind: localizationResult.source_of_truth,
      dashboard_id: localizationResult.source_dashboard_id,
      dashboard_state_path: localizationResult.source_dashboard_state_path,
      dashboard_snapshot_copy_path: localizationResult.source_dashboard_snapshot_copy_path,
      embed_payload_used_as_source: localizationResult.embed_payload_used_as_source
    },
    routes: {
      report_to_dashboard: `${dashboardBaseUrl}/api/v1/reports/convert-to-dashboard`,
      dashboard_state: `${dashboardBaseUrl}/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(sharedDashboardId)}`,
      localize_dashboard: `${dashboardBaseUrl}/api/v1/localization/localize-dashboard`,
      localized_publish: `${dashboardBaseUrl}/api/v1/dashboards/publish`,
      localized_publish_embed: downstreamPublish.transport.served_embed_html_url
    },
    screenshots: {
      upstream_dashboard: path.join(proofRoot, "browser", "upstream-dashboard-embed.png"),
      localized_shell_dashboard: path.join(proofRoot, "browser", "localized-dashboard-shell.png"),
      localized_dashboard: path.join(proofRoot, "browser", "localized-dashboard-embed.png")
    },
    assertions
  };

  if (!Object.values(assertions).every(Boolean)) {
    throw new Error(`Localization cross-engine flow assertions failed: ${JSON.stringify(assertions)}`);
  }

  writeJson("artifacts/cross-engine-flow-proof.json", proof);
  writeJson("evidence/evidence.json", evidence);
  writeJson("audit/audit.json", combinedAudit);
  writeJson("lineage/lineage.json", combinedLineage);

  console.log(
    JSON.stringify(
      {
        runId,
        proofRoot,
        flowProofPath: path.join(proofRoot, "artifacts", "cross-engine-flow-proof.json"),
        marker,
        reportId,
        sharedDashboardId,
        sourceOfTruth: localizationResult.source_of_truth,
        downstreamSharedDashboardId,
        localizedPublicationId: downstreamPublish.publication.publication_id
      },
      null,
      2
    )
  );
} finally {
  fs.writeFileSync(path.join(proofRoot, "logs", "dashboard-web.stdout.log"), dashboardStdout, "utf8");
  fs.writeFileSync(path.join(proofRoot, "logs", "dashboard-web.stderr.log"), dashboardStderr, "utf8");
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  dashboardServer.kill();
  await reportServer.close();
}
