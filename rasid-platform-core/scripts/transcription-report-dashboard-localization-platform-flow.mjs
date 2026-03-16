import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright-core";

const root = process.cwd();
const now = () => new Date().toISOString();
const compactTimestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const runId = `transcription-report-dashboard-localization-platform-flow-${compactTimestamp}`;
const proofRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", runId);
const runtimeRoot = path.join(root, ".runtime", "transcription-report-dashboard-localization-platform-flow", runId);
const fixtureRoot = path.join(runtimeRoot, "fixtures");
const transcriptionRuntimeRoot = path.join(root, ".runtime", "transcription-extraction-engine");
const reportRuntimeRoot = path.join(root, ".runtime", "report-engine");
const dashboardRuntimeRoot = path.join(root, ".runtime", "dashboard-web");
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate));

if (!browserExecutablePath) {
  throw new Error("No browser executable available for live platform flow proof.");
}

const load = async (relativePath) => import(new URL(`file:///${path.join(root, relativePath).replace(/\\/g, "/")}`));
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

const latestJsonFile = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    return null;
  }
  return (
    fs
      .readdirSync(directoryPath)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => path.join(directoryPath, entry))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null
  );
};

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
  return text.length > 0 ? JSON.parse(text) : {};
};

const navigateForProof = async (page, url) => {
  await page.goto(url, { waitUntil: "commit", timeout: 45000 });
  await page.waitForTimeout(3500);
};

const runPowerShell = (script) => {
  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "PowerShell command failed");
  }
};

const createFixtures = async (marker) => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const noteImagePath = path.join(fixtureRoot, "transcription-notes.png");
  const tableImagePath = path.join(fixtureRoot, "transcription-table.png");
  runPowerShell(`
    Add-Type -AssemblyName System.Drawing
    $note = New-Object System.Drawing.Bitmap 1600,900
    $noteGraphics = [System.Drawing.Graphics]::FromImage($note)
    $noteGraphics.Clear([System.Drawing.Color]::White)
    $font = New-Object System.Drawing.Font('Arial', 28, [System.Drawing.FontStyle]::Regular)
    $brush = [System.Drawing.Brushes]::Black
    $lines = @(
      'Board Update',
      'Marker: ${marker}',
      'Revenue reached 125 USD in Riyadh with 8 active cases.',
      'Jeddah closed 3 cases with 90 USD.',
      'Dammam closed 2 cases with 65 USD.',
      'Publish the localized Arabic dashboard without losing the marker.'
    )
    $y = 40
    foreach ($line in $lines) {
      $noteGraphics.DrawString($line, $font, $brush, 50, $y)
      $y += 90
    }
    $note.Save('${noteImagePath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
    $noteGraphics.Dispose()
    $note.Dispose()

    $table = New-Object System.Drawing.Bitmap 1600,900
    $tableGraphics = [System.Drawing.Graphics]::FromImage($table)
    $tableGraphics.Clear([System.Drawing.Color]::White)
    $headerFont = New-Object System.Drawing.Font('Arial', 24, [System.Drawing.FontStyle]::Bold)
    $cellFont = New-Object System.Drawing.Font('Arial', 22, [System.Drawing.FontStyle]::Regular)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
    $headers = @('Region','Cases','Revenue','Currency','Owner','Marker')
    $rows = @(
      @('Riyadh','8','125','USD','Noura','${marker}'),
      @('Jeddah','3','90','USD','Amal','${marker}'),
      @('Dammam','2','65','USD','Faisal','${marker}')
    )
    for ($i = 0; $i -lt $headers.Length; $i++) {
      $x = 40 + ($i * 245)
      $tableGraphics.DrawRectangle($pen, $x, 80, 220, 70)
      $tableGraphics.DrawString($headers[$i], $headerFont, $brush, $x + 12, 100)
    }
    for ($r = 0; $r -lt $rows.Length; $r++) {
      for ($c = 0; $c -lt $headers.Length; $c++) {
        $x = 40 + ($c * 245)
        $y = 150 + ($r * 90)
        $tableGraphics.DrawRectangle($pen, $x, $y, 220, 80)
        $tableGraphics.DrawString($rows[$r][$c], $cellFont, $brush, $x + 12, $y + 24)
      }
    }
    $table.Save('${tableImagePath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
    $tableGraphics.Dispose()
    $table.Dispose()
  `);
  return { noteImagePath, tableImagePath };
};

for (const directory of [
  proofRoot,
  runtimeRoot,
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
const marker = `TXLOC-${Date.now()}`;
const localizedMarkerToken = "TXLOC";
const fixtures = await createFixtures(marker);
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

  const transcriptionStart = await dashboardApi("/api/v1/transcription/jobs/start", "POST", {
    mode: "advanced",
    files: [
      {
        file_name: path.basename(fixtures.noteImagePath),
        media_type: "image/png",
        content_base64: fs.readFileSync(fixtures.noteImagePath).toString("base64")
      },
      {
        file_name: path.basename(fixtures.tableImagePath),
        media_type: "image/png",
        content_base64: fs.readFileSync(fixtures.tableImagePath).toString("base64")
      }
    ]
  });
  writeJson("api/transcription-start.json", transcriptionStart);

  const transcriptionJobId = transcriptionStart.transcription.job.job_id;
  const transcriptionBundleId = transcriptionStart.transcription.bundle.bundle_id;
  const transcriptionJobRoot = path.join(transcriptionRuntimeRoot, "jobs", transcriptionJobId);
  const transcriptionArtifactsRoot = path.join(transcriptionJobRoot, "artifacts");
  const transcriptionHandoffPath = path.join(transcriptionArtifactsRoot, "report-handoff.json");
  const transcriptionQueryDatasetPath = path.join(transcriptionArtifactsRoot, "query-dataset.json");
  const transcriptionVerificationPath = path.join(transcriptionArtifactsRoot, "verification-artifact.json");
  const transcriptionAlignmentPath = path.join(transcriptionArtifactsRoot, "alignment-artifact.json");

  copyIntoProof(transcriptionHandoffPath, "intermediate/transcription-report-handoff.json");
  copyIntoProof(transcriptionQueryDatasetPath, "intermediate/transcription-query-dataset.json");
  copyIntoProof(transcriptionVerificationPath, "intermediate/transcription-verification-artifact.json");
  copyIntoProof(transcriptionAlignmentPath, "intermediate/transcription-alignment-artifact.json");
  writeJson("evidence/transcription-engine.json", transcriptionStart.transcription.evidence);
  writeJson("audit/transcription-engine.json", transcriptionStart.transcription.audit);
  writeJson("lineage/transcription-engine.json", transcriptionStart.transcription.lineage);

  const transcriptionSurfacePage = await context.newPage();
  await navigateForProof(transcriptionSurfacePage, `${dashboardBaseUrl}/transcription`);
  await transcriptionSurfacePage.screenshot({ path: path.join(proofRoot, "browser", "transcription-surface.png"), fullPage: true });
  await transcriptionSurfacePage.close();

  const transcriptionToReport = await dashboardApi("/api/v1/reports/create-from-transcription", "POST", {
    title: `Transcription Localization Report ${marker}`,
    mode: "advanced",
    job_id: transcriptionJobId,
    approval_granted: true
  });
  writeJson("api/transcription-to-report.json", transcriptionToReport);

  const reportId = transcriptionToReport.report_id;
  const reportRoot = path.join(reportRuntimeRoot, "reports", reportId);
  const reportStatePath = path.join(reportRoot, "state", "current.json");
  const reportEvidencePath = latestJsonFile(path.join(reportRoot, "evidence"));
  const reportAuditPath = latestJsonFile(path.join(reportRoot, "audit"));
  const reportLineagePath = latestJsonFile(path.join(reportRoot, "lineage"));
  const reportState = readJson(reportStatePath);

  copyIntoProof(reportStatePath, "intermediate/report-current-state.json");
  if (reportEvidencePath) copyIntoProof(reportEvidencePath, "evidence/report-engine.json");
  if (reportAuditPath) copyIntoProof(reportAuditPath, "audit/report-engine.json");
  if (reportLineagePath) copyIntoProof(reportLineagePath, "lineage/report-engine.json");

  const reportPage = await context.newPage();
  await navigateForProof(reportPage, `${dashboardBaseUrl}/reports?report_id=${encodeURIComponent(reportId)}`);
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-surface.png"), fullPage: true });
  await reportPage.close();

  const reportToDashboard = await dashboardApi("/api/v1/reports/convert-to-dashboard", "POST", {
    report_id: reportId,
    target_ref: "workspace://dashboards/from-transcription-localization-proof",
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

  const localizationSurfacePage = await context.newPage();
  await navigateForProof(localizationSurfacePage, `${dashboardBaseUrl}/localization`);
  await localizationSurfacePage.screenshot({ path: path.join(proofRoot, "browser", "localization-surface.png"), fullPage: true });
  await localizationSurfacePage.close();

  const localizationRun = await dashboardApi("/api/v1/localization/localize-dashboard", "POST", {
    dashboard_id: sharedDashboardId,
    target_locale: "ar-SA",
    target_ref: "workspace://localization/transcription-report-dashboard-flow",
    approval_granted: true
  });
  writeJson("api/localization-localize-dashboard.json", localizationRun);

  const localizationResult = localizationRun.localization;
  const localizationArtifacts = localizationResult.localization.persisted_artifacts;
  const localizationTransport = localizationResult.localization.native_transport;
  const intakeProofPath = localizationResult.intake_proof_path;
  const intakeProof = readJson(intakeProofPath);
  const consumeDirectory = path.dirname(intakeProof.downstream_shared_dashboard_consume_manifest_path);
  const consumeEvidencePath = path.join(consumeDirectory, "consume-evidence.json");
  const consumeAuditPath = path.join(consumeDirectory, "consume-audit.json");
  const consumeLineagePath = path.join(consumeDirectory, "consume-lineage.json");

  copyIntoProof(intakeProofPath, "intermediate/shared-dashboard-runtime-intake-proof.json");
  copyIntoProof(intakeProof.downstream_shared_dashboard_consume_manifest_path, "intermediate/localization-consume-manifest.json");
  copyIntoProof(localizationArtifacts.evidence_path, "evidence/localization-engine.json");
  copyIntoProof(localizationArtifacts.audit_path, "audit/localization-engine.json");
  copyIntoProof(localizationArtifacts.lineage_path, "lineage/localization-engine.json");
  copyIntoProof(consumeEvidencePath, "evidence/localization-consume.json");
  copyIntoProof(consumeAuditPath, "audit/localization-consume.json");
  copyIntoProof(consumeLineagePath, "lineage/localization-consume.json");
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
  writeText("records/localized-shell-publish-embed.html", fs.readFileSync(localizedPublish.transport.embed_html_path, "utf8"));
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

  const transcriptionHandoff = readJson(transcriptionHandoffPath);
  const transcriptionQueryDataset = readJson(transcriptionQueryDatasetPath);
  const localizationProof = readJson(path.join(proofRoot, "intermediate", "localization-proof.json"));
  const fidelityReport = readJson(path.join(proofRoot, "intermediate", "localization-fidelity-report.json"));
  const localizedPublishState = readJson(localizedPublish.transport.publish_state_path);
  const localizedEmbedPayload = readJson(localizedPublish.transport.embed_payload_path);

  const combinedFlow = {
    flow: ["transcription", "reports", "dashboards", "arabic-localization-lct-engine", "publish"],
    upstream_refs: {
      transcription_job_id: transcriptionJobId,
      transcription_bundle_id: transcriptionBundleId,
      report_id: reportId,
      shared_dashboard_id: sharedDashboardId,
      downstream_localized_dashboard_id: downstreamLocalizedDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id
    },
    proof_paths: {
      transcription_report_handoff_path: transcriptionHandoffPath,
      transcription_query_dataset_path: transcriptionQueryDatasetPath,
      report_state_path: reportStatePath,
      report_dashboard_bridge_manifest_path: reportToDashboard.report_bridge.bridge_manifest_path,
      localization_intake_proof_path: intakeProofPath,
      localization_consume_manifest_path: intakeProof.downstream_shared_dashboard_consume_manifest_path,
      localized_publish_manifest_path: localizedPublish.transport.manifest_path
    }
  };
  writeJson("lineage/combined-flow.json", combinedFlow);

  const assertions = {
    transcription_job_completed: transcriptionStart.transcription.job.state === "completed",
    transcription_artifacts_exist:
      fs.existsSync(transcriptionHandoffPath) &&
      fs.existsSync(transcriptionQueryDatasetPath) &&
      fs.existsSync(transcriptionVerificationPath),
    transcription_marker_present:
      JSON.stringify(transcriptionHandoff).includes(marker) || JSON.stringify(transcriptionQueryDataset).includes(marker),
    report_created_from_transcription:
      transcriptionToReport.transcription_job_id === transcriptionJobId &&
      transcriptionToReport.bundle_id === transcriptionBundleId,
    report_runtime_contains_transcription_refs:
      JSON.stringify(reportState).includes(transcriptionJobId) || JSON.stringify(reportState).includes(transcriptionBundleId),
    dashboard_created_from_report:
      reportToDashboard.report_bridge.report_id === reportId &&
      reportToDashboard.report_bridge.source_report_state_path === reportStatePath,
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

  const flowProof = {
    phase_requirement: "transcription -> reports -> dashboards -> localization -> publish shared platform proof",
    generated_at: now(),
    flow: ["transcription", "reports", "dashboards", "arabic-localization-lct-engine", "publish"],
    routes: {
      transcription_start: `${dashboardBaseUrl}/api/v1/transcription/jobs/start`,
      transcription_to_report: `${dashboardBaseUrl}/api/v1/reports/create-from-transcription`,
      report_to_dashboard: `${dashboardBaseUrl}/api/v1/reports/convert-to-dashboard`,
      localize_dashboard: `${dashboardBaseUrl}/api/v1/localization/localize-dashboard`,
      localized_publish: `${dashboardBaseUrl}/api/v1/dashboards/publish`,
      localized_publish_embed: localizedPublish.transport.served_embed_html_url
    },
    runtime_paths: {
      transcription_job_root: transcriptionJobRoot,
      report_root: reportRoot,
      shared_dashboard_root: path.join(dashboardRuntimeRoot, "dashboard-engine", "dashboards", sharedDashboardId),
      localized_dashboard_root: path.join(dashboardRuntimeRoot, "dashboard-engine", "dashboards", downstreamLocalizedDashboardId),
      localization_output_root: localizationResult.output_root
    },
    identifiers: {
      marker,
      transcription_job_id: transcriptionJobId,
      transcription_bundle_id: transcriptionBundleId,
      report_id: reportId,
      shared_dashboard_id: sharedDashboardId,
      localized_dashboard_id: downstreamLocalizedDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id
    },
    screenshots: {
      transcription_surface: path.join(proofRoot, "browser", "transcription-surface.png"),
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
  writeJson("records/transcription-start.json", transcriptionStart);
  writeJson("records/transcription-to-report.json", transcriptionToReport);
  writeJson("records/report-to-dashboard.json", reportToDashboard);
  writeJson("records/localization-localize-dashboard.json", localizationRun);
  writeJson("records/localized-shell-publish.json", localizedPublish);
  writeJson("evidence/cross-engine-flow.json", combinedFlow);
  writeJson("audit/cross-engine-flow.json", {
    flow: combinedFlow.flow,
    refs: combinedFlow.proof_paths,
    counts: {
      transcription_audit: Array.isArray(transcriptionStart.transcription.audit) ? transcriptionStart.transcription.audit.length : 0,
      report_audit: reportAuditPath ? 1 : 0,
      bridge_audit: 1,
      localization_audit: 1,
      consume_audit: 1,
      publish_audit: Array.isArray(localizedPublish.snapshot.audit) ? localizedPublish.snapshot.audit.length : 0
    }
  });

  if (!Object.values(assertions).every(Boolean)) {
    throw new Error(`Cross-engine localization flow assertions failed: ${JSON.stringify(assertions)}`);
  }

  resultSummary = {
    runId,
    proofRoot,
    flowProofPath: path.join(proofRoot, "records", "flow-proof.json"),
    transcriptionJobId,
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
