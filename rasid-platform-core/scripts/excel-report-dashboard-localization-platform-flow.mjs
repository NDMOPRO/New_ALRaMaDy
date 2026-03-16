import fs from "node:fs";
import path from "node:path";
import { createServer as createNetServer } from "node:net";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const now = () => new Date().toISOString();
const compactTimestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const runId = `excel-report-dashboard-localization-platform-flow-${compactTimestamp}`;
const proofRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", runId);
const dashboardRuntimeRoot = path.join(root, ".runtime", "dashboard-web");
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserExecutablePath) {
  throw new Error("No browser executable available for live excel localization proof.");
}

const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const { ExcelEngine } = await load("packages/excel-engine/dist/index.js");
const { startDashboardWebApp, stopDashboardWebApp } = await load("apps/contracts-cli/dist/dashboard-web.js");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
};

const navigateForProof = async (page, url) => {
  await page.goto(url, { waitUntil: "commit", timeout: 45000 });
  await page.waitForTimeout(3500);
};

for (const directory of [
  proofRoot,
  path.join(proofRoot, "api"),
  path.join(proofRoot, "audit"),
  path.join(proofRoot, "browser"),
  path.join(proofRoot, "evidence"),
  path.join(proofRoot, "intermediate"),
  path.join(proofRoot, "lineage"),
  path.join(proofRoot, "records")
]) {
  fs.mkdirSync(directory, { recursive: true });
}

const dashboardPort = await findFreePort();
const dashboardBaseUrl = `http://127.0.0.1:${dashboardPort}`;
const marker = `EXLOC-${Date.now()}`;
const localizedMarkerToken = "EXLOC";

const excelSample = await new ExcelEngine().runSample({
  tenant_ref: "tenant-excel-localization-flow",
  workspace_id: "workspace-excel-localization-flow",
  project_id: "project-excel-localization-flow",
  actor_ref: "excel-localization-flow",
  output_root: path.join(root, "packages", "excel-engine", "output")
});

const workbookPath = excelSample.artifacts.exported_workbook_path;
const workbookPackagePath = excelSample.artifacts.workbook_package_path;
const excelEvidencePath = excelSample.artifacts.evidence_path;
const excelAuditPath = excelSample.artifacts.audit_path;
const excelLineagePath = excelSample.artifacts.lineage_path;
const excelOutputRoot = excelSample.artifacts.output_root;

writeJson("api/excel-source.json", {
  marker,
  workbook_path: workbookPath,
  workbook_package_path: workbookPackagePath,
  excel_output_root: excelOutputRoot,
  evidence_path: excelEvidencePath,
  audit_path: excelAuditPath,
  lineage_path: excelLineagePath
});

copyIntoProof(workbookPath, "intermediate/sample-output.xlsx");
copyIntoProof(workbookPackagePath, "intermediate/workbook-package.json");
copyIntoProof(excelEvidencePath, "evidence/excel-engine.json");
copyIntoProof(excelAuditPath, "audit/excel-engine.json");
copyIntoProof(excelLineagePath, "lineage/excel-engine.json");

const dashboardServer = startDashboardWebApp({
  host: "127.0.0.1",
  port: dashboardPort
});

let browser = null;
let resultSummary = null;
let scriptError = null;

try {
  await waitForServer(`${dashboardBaseUrl}/login`);

  const loginPayload = await fetchJson(`${dashboardBaseUrl}/api/v1/governance/auth/login`, {
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
  writeJson("api/dashboard-login.json", loginPayload);
  const dashboardToken = loginPayload.data.accessToken;

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

  browser = await chromium.launch({ headless: true, executablePath: browserExecutablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  context.setDefaultNavigationTimeout(120000);
  context.setDefaultTimeout(120000);
  await context.addCookies([
    { name: "rasid_auth", value: dashboardToken, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant", value: "tenant-default", domain: "127.0.0.1", path: "/" },
    { name: "rasid_workspace", value: "workspace-dashboard-web", domain: "127.0.0.1", path: "/" },
    { name: "rasid_project", value: "project-dashboard-web", domain: "127.0.0.1", path: "/" },
    { name: "rasid_actor", value: "admin", domain: "127.0.0.1", path: "/" }
  ]);

  const excelPage = await context.newPage();
  await navigateForProof(excelPage, `${dashboardBaseUrl}/excel`);
  await excelPage.screenshot({ path: path.join(proofRoot, "browser", "excel-surface.png"), fullPage: true });
  await excelPage.close();

  const excelToReport = await dashboardApi("/api/v1/excel/create-report", "POST", {
    title: `Excel Localization Flow ${marker}`,
    description: `Localization continuity for ${marker} from workbook to publish.`,
    workbook_path: workbookPath,
    workbook_label: path.basename(workbookPath),
    approval_granted: true
  });
  writeJson("api/excel-create-report.json", excelToReport);

  const reportId = excelToReport.report_id;
  const excelConsume = excelToReport.excel_consume;
  copyIntoProof(excelConsume.consume_manifest_path, "intermediate/excel-consume-manifest.json");
  copyIntoProof(excelConsume.report_state_path, "intermediate/report-current-state.json");
  copyIntoProof(excelConsume.report_editable_path, "intermediate/report-editable.json");

  const reportState = readJson(excelConsume.report_state_path);

  const reportPage = await context.newPage();
  await navigateForProof(reportPage, `${dashboardBaseUrl}/reports?report_id=${encodeURIComponent(reportId)}`);
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-surface.png"), fullPage: true });
  await reportPage.close();

  const reportToDashboard = await dashboardApi("/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    target_ref: "workspace://dashboards/from-excel-localization-proof",
    approval_granted: true
  });
  writeJson("api/report-to-dashboard.json", reportToDashboard);

  const sharedDashboardId = reportToDashboard.report_bridge.dashboard_id;
  copyIntoProof(reportToDashboard.report_bridge.bridge_manifest_path, "intermediate/report-dashboard-bridge-manifest.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_artifact_path, "intermediate/report-dashboard-bridge-artifact.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_evidence_path, "evidence/report-dashboard-bridge.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_audit_path, "audit/report-dashboard-bridge.json");
  copyIntoProof(reportToDashboard.report_bridge.bridge_lineage_path, "lineage/report-dashboard-bridge.json");

  const sharedDashboardState = await dashboardApi(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(sharedDashboardId)}`);
  writeJson("api/shared-dashboard-state.json", sharedDashboardState);

  const sharedDashboardPage = await context.newPage();
  await navigateForProof(sharedDashboardPage, `${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(sharedDashboardId)}`);
  await sharedDashboardPage.screenshot({ path: path.join(proofRoot, "browser", "shared-dashboard.png"), fullPage: true });
  await sharedDashboardPage.close();

  const localizationPage = await context.newPage();
  await navigateForProof(localizationPage, `${dashboardBaseUrl}/localization`);
  await localizationPage.screenshot({ path: path.join(proofRoot, "browser", "localization-surface.png"), fullPage: true });
  await localizationPage.close();

  const localizationRun = await dashboardApi("/api/v1/localization/localize-dashboard", "POST", {
    dashboard_id: sharedDashboardId,
    target_locale: "ar-SA",
    target_ref: "workspace://localization/excel-report-dashboard-flow",
    approval_granted: true
  });
  writeJson("api/localization-localize-dashboard.json", localizationRun);

  const localizationResult = localizationRun.localization;
  const localizationArtifacts = localizationResult.localization.persisted_artifacts;
  const localizationTransport = localizationResult.localization.native_transport;
  const intakeProofPath = localizationResult.intake_proof_path;
  const intakeProof = readJson(intakeProofPath);
  const consumeDirectory = path.dirname(intakeProof.downstream_shared_dashboard_consume_manifest_path);

  copyIntoProof(intakeProofPath, "intermediate/shared-dashboard-runtime-intake-proof.json");
  copyIntoProof(intakeProof.downstream_shared_dashboard_consume_manifest_path, "intermediate/localization-consume-manifest.json");
  copyIntoProof(localizationArtifacts.evidence_path, "evidence/localization-engine.json");
  copyIntoProof(localizationArtifacts.audit_path, "audit/localization-engine.json");
  copyIntoProof(localizationArtifacts.lineage_path, "lineage/localization-engine.json");
  copyIntoProof(path.join(consumeDirectory, "consume-evidence.json"), "evidence/localization-consume.json");
  copyIntoProof(path.join(consumeDirectory, "consume-audit.json"), "audit/localization-consume.json");
  copyIntoProof(path.join(consumeDirectory, "consume-lineage.json"), "lineage/localization-consume.json");
  copyIntoProof(localizationArtifacts.dashboard_artifact_closure_path, "intermediate/localization-dashboard-artifact-closure.json");
  copyIntoProof(localizationArtifacts.fidelity_report_path, "intermediate/localization-fidelity-report.json");
  copyIntoProof(path.join(path.dirname(localizationArtifacts.localized_output_path), "dashboard-bundle", "localization-proof.json"), "intermediate/localization-proof.json");
  copyIntoProof(localizationTransport.embed_payload_path, "intermediate/localized-dashboard-embed-payload.json");
  copyIntoProof(localizationTransport.publish_state_path, "intermediate/localized-dashboard-publish-state.json");
  copyIntoProof(localizationTransport.manifest_path, "intermediate/localized-dashboard-manifest.json");

  const downstreamLocalizedDashboardId = localizationResult.downstream_shared_dashboard_id;
  const localizedShellDashboardState = await dashboardApi(
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(downstreamLocalizedDashboardId)}`
  );
  writeJson("api/localized-shell-dashboard-state.json", localizedShellDashboardState);

  const localizedShellPage = await context.newPage();
  await navigateForProof(localizedShellPage, `${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(downstreamLocalizedDashboardId)}`);
  await localizedShellPage.screenshot({ path: path.join(proofRoot, "browser", "localized-shell-dashboard.png"), fullPage: true });
  await localizedShellPage.close();

  const localizedPublish = await dashboardApi("/api/v1/dashboards/publish", "POST", {
    dashboard_id: downstreamLocalizedDashboardId,
    approval_granted: true
  });
  writeJson("api/localized-shell-publish.json", localizedPublish);
  writeJson("api/localized-shell-publish-manifest.json", readJson(localizedPublish.transport.manifest_path));
  writeJson("api/localized-shell-publish-state.json", readJson(localizedPublish.transport.publish_state_path));
  writeJson("api/localized-shell-publish-embed-payload.json", readJson(localizedPublish.transport.embed_payload_path));
  writeJson("evidence/localized-shell-publish.json", localizedPublish.snapshot.evidence ?? []);
  writeJson("audit/localized-shell-publish.json", localizedPublish.snapshot.audit ?? []);
  writeJson("lineage/localized-shell-publish.json", localizedPublish.snapshot.lineage ?? []);

  const localizedPublishedPage = await context.newPage();
  await navigateForProof(localizedPublishedPage, localizedPublish.transport.served_embed_html_url);
  await localizedPublishedPage.screenshot({ path: path.join(proofRoot, "browser", "localized-shell-published.png"), fullPage: true });
  await localizedPublishedPage.close();

  await context.close();
  await browser.close();
  browser = null;

  const fidelityReport = readJson(path.join(proofRoot, "intermediate", "localization-fidelity-report.json"));
  const localizationProof = readJson(path.join(proofRoot, "intermediate", "localization-proof.json"));
  const localizedPublishState = readJson(localizedPublish.transport.publish_state_path);
  const localizedEmbedPayload = readJson(localizedPublish.transport.embed_payload_path);

  const assertions = {
    fresh_excel_generated: fs.existsSync(workbookPath) && fs.existsSync(excelEvidencePath) && fs.existsSync(excelAuditPath) && fs.existsSync(excelLineagePath),
    excel_route_consumed_fresh_workbook: excelConsume.workbook_path === workbookPath,
    report_contains_marker: JSON.stringify(reportState).includes(marker),
    dashboard_created_from_report: reportToDashboard.report_bridge.report_id === reportId,
    shared_dashboard_contains_marker: JSON.stringify(sharedDashboardState).includes(marker),
    localization_consumed_shared_runtime:
      localizationResult.source_of_truth === "shared_dashboard_runtime_state" &&
      localizationResult.embed_payload_used_as_source === false,
    localization_intake_proves_shared_runtime:
      intakeProof.source_of_truth === "shared_dashboard_runtime_state" &&
      intakeProof.embed_payload_used_as_source === false &&
      intakeProof.source_dashboard_id === sharedDashboardId,
    localization_downstream_consume_manifest_connected:
      fs.existsSync(intakeProof.downstream_shared_dashboard_consume_manifest_path) &&
      readJson(intakeProof.downstream_shared_dashboard_consume_manifest_path).source_kind === "shared_dashboard_runtime_localization_output",
    localized_shell_contains_marker: JSON.stringify(localizedShellDashboardState).includes(localizedMarkerToken),
    localization_fidelity_verified: fidelityReport.status === "verified",
    localization_proof_present: typeof localizationProof === "object" && localizationProof !== null,
    localized_publish_governed:
      localizedPublish.governance?.decision?.action_id === "dashboard.publish.v1" &&
      typeof localizedPublish.transport?.served_embed_html_url === "string" &&
      localizedPublish.transport.served_embed_html_url.length > 0,
    localized_publish_contains_marker:
      JSON.stringify(localizedPublishState).includes(localizedMarkerToken) || JSON.stringify(localizedEmbedPayload).includes(localizedMarkerToken)
  };

  const combinedFlow = {
    flow: ["excel", "reports", "dashboards", "arabic-localization-lct-engine", "publish"],
    upstream_refs: {
      workbook_path: workbookPath,
      excel_output_root: excelOutputRoot,
      report_id: reportId,
      shared_dashboard_id: sharedDashboardId,
      downstream_localized_dashboard_id: downstreamLocalizedDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id
    },
    proof_paths: {
      workbook_package_path: workbookPackagePath,
      excel_consume_manifest_path: excelConsume.consume_manifest_path,
      report_dashboard_bridge_manifest_path: reportToDashboard.report_bridge.bridge_manifest_path,
      localization_intake_proof_path: intakeProofPath,
      localization_consume_manifest_path: intakeProof.downstream_shared_dashboard_consume_manifest_path,
      localized_publish_manifest_path: localizedPublish.transport.manifest_path
    }
  };
  writeJson("lineage/combined-flow.json", combinedFlow);

  const flowProof = {
    phase_requirement: "excel -> reports -> dashboards -> localization -> publish shared platform proof",
    generated_at: now(),
    flow: ["excel", "reports", "dashboards", "arabic-localization-lct-engine", "publish"],
    routes: {
      excel_create_report: `${dashboardBaseUrl}/api/v1/excel/create-report`,
      report_to_dashboard: `${dashboardBaseUrl}/api/v1/reports/convert-to-dashboard`,
      localize_dashboard: `${dashboardBaseUrl}/api/v1/localization/localize-dashboard`,
      localized_publish: `${dashboardBaseUrl}/api/v1/dashboards/publish`,
      localized_publish_embed: localizedPublish.transport.served_embed_html_url
    },
    runtime_paths: {
      excel_output_root: excelOutputRoot,
      shared_dashboard_root: path.join(dashboardRuntimeRoot, "dashboard-engine", "dashboards", sharedDashboardId),
      localized_dashboard_root: path.join(dashboardRuntimeRoot, "dashboard-engine", "dashboards", downstreamLocalizedDashboardId),
      localization_output_root: localizationResult.output_root
    },
    identifiers: {
      marker,
      report_id: reportId,
      shared_dashboard_id: sharedDashboardId,
      localized_dashboard_id: downstreamLocalizedDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id
    },
    screenshots: {
      excel_surface: path.join(proofRoot, "browser", "excel-surface.png"),
      report_surface: path.join(proofRoot, "browser", "report-surface.png"),
      shared_dashboard: path.join(proofRoot, "browser", "shared-dashboard.png"),
      localization_surface: path.join(proofRoot, "browser", "localization-surface.png"),
      localized_shell_dashboard: path.join(proofRoot, "browser", "localized-shell-dashboard.png"),
      localized_shell_published: path.join(proofRoot, "browser", "localized-shell-published.png")
    },
    assertions,
    status: Object.values(assertions).every(Boolean) ? "pass" : "contradiction"
  };
  writeJson("records/flow-proof.json", flowProof);
  writeJson("records/excel-create-report.json", excelToReport);
  writeJson("records/report-to-dashboard.json", reportToDashboard);
  writeJson("records/localization-localize-dashboard.json", localizationRun);
  writeJson("records/localized-shell-publish.json", localizedPublish);
  writeJson("evidence/cross-engine-flow.json", combinedFlow);
  writeJson("audit/cross-engine-flow.json", {
    flow: combinedFlow.flow,
    refs: combinedFlow.proof_paths,
    counts: {
      excel_evidence: 1,
      bridge_evidence: 1,
      localization_evidence: 1,
      consume_evidence: 1,
      publish_evidence: Array.isArray(localizedPublish.snapshot.evidence) ? localizedPublish.snapshot.evidence.length : 0
    }
  });

  if (!Object.values(assertions).every(Boolean)) {
    throw new Error(`Excel localization flow assertions failed: ${JSON.stringify(assertions)}`);
  }

  resultSummary = {
    runId,
    proofRoot,
    flowProofPath: path.join(proofRoot, "records", "flow-proof.json"),
    reportId,
    sharedDashboardId,
    downstreamLocalizedDashboardId,
    localizedPublicationId: localizedPublish.publication.publication_id
  };
} catch (error) {
  scriptError = error;
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  await Promise.race([stopDashboardWebApp().catch(() => undefined), wait(2000)]);
}

if (scriptError) {
  throw scriptError;
}

console.log(JSON.stringify(resultSummary, null, 2));
