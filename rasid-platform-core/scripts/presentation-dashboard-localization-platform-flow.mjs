import fs from "node:fs";
import path from "node:path";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright-core";

const root = process.cwd();
const now = () => new Date().toISOString();
const compactTimestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const runId = `presentation-dashboard-localization-platform-flow-${compactTimestamp}`;
const proofRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", runId);
const dashboardRuntimeRoot = path.join(root, ".runtime", "dashboard-web");
const presentationsRuntimeRoot = path.join(root, ".runtime", "presentations-engine", "decks");
const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate));
if (!browserExecutablePath) {
  throw new Error("No browser executable available for live presentation localization proof.");
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
] ) {
  fs.mkdirSync(directory, { recursive: true });
}

const dashboardPort = await findFreePort();
const dashboardBaseUrl = `http://127.0.0.1:${dashboardPort}`;
const marker = `PRESLOC-${Date.now()}`;
const localizedMarkerToken = "PRESLOC";
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

  const datasetRegister = await dashboardApi("/api/v1/data/register", "POST", {
    title: `Presentation Localization Dataset ${marker}`,
    rows: [
      { region: "Riyadh", cases: 8, revenue: 125, currency: "USD", owner: "Noura", marker, action: "Publish localized dashboard" },
      { region: "Jeddah", cases: 3, revenue: 90, currency: "USD", owner: "Amal", marker, action: "Keep executive clarity" },
      { region: "Dammam", cases: 2, revenue: 65, currency: "USD", owner: "Faisal", marker, action: "Preserve Arabic fidelity" }
    ]
  });
  writeJson("api/data-register.json", datasetRegister);

  const datasetId = datasetRegister.dataset.dataset_id;
  const presentationCreate = await dashboardApi("/api/v1/presentations/create-from-canvas", "POST", {
    title: `Presentation Localization Flow ${marker}`,
    dataset_id: datasetId,
    mode: "advanced"
  });
  writeJson("api/presentation-create.json", presentationCreate);

  const deckId = presentationCreate.deck_id;
  const presentationRoot = path.join(presentationsRuntimeRoot, deckId);
  const presentationBundlePath = path.join(presentationRoot, "state", "bundle-snapshot.json");
  const presentationStatePath = path.join(presentationRoot, "state", "current.json");
  const presentationEvidencePath = latestJsonFile(path.join(presentationRoot, "evidence"));
  const presentationAuditPath = path.join(presentationRoot, "audit", "events.json");
  const presentationLineagePath = path.join(presentationRoot, "lineage", "edges.json");

  copyIntoProof(presentationBundlePath, "intermediate/presentation-bundle-snapshot.json");
  copyIntoProof(presentationStatePath, "intermediate/presentation-current-state.json");
  if (presentationEvidencePath) copyIntoProof(presentationEvidencePath, "evidence/presentations-engine.json");
  if (fs.existsSync(presentationAuditPath)) copyIntoProof(presentationAuditPath, "audit/presentations-engine.json");
  if (fs.existsSync(presentationLineagePath)) copyIntoProof(presentationLineagePath, "lineage/presentations-engine.json");

  const presentationsPage = await context.newPage();
  await navigateForProof(presentationsPage, `${dashboardBaseUrl}/presentations?deck_id=${encodeURIComponent(deckId)}`);
  await presentationsPage.screenshot({ path: path.join(proofRoot, "browser", "presentations-surface.png"), fullPage: true });
  await presentationsPage.close();

  const presentationToDashboard = await dashboardApi("/api/v1/presentations/convert-to-dashboard", "POST", {
    deck_id: deckId,
    target_ref: "workspace://dashboards/from-presentation-localization-proof",
    approval_granted: true
  });
  writeJson("api/presentation-to-dashboard.json", presentationToDashboard);

  const sharedDashboardId = presentationToDashboard.presentation_bridge.dashboard_id;
  copyIntoProof(presentationToDashboard.presentation_bridge.bridge_manifest_path, "intermediate/presentation-dashboard-bridge-manifest.json");
  copyIntoProof(presentationToDashboard.presentation_bridge.bridge_artifact_path, "intermediate/presentation-dashboard-bridge-artifact.json");
  copyIntoProof(presentationToDashboard.presentation_bridge.bridge_evidence_path, "evidence/presentation-dashboard-bridge.json");
  copyIntoProof(presentationToDashboard.presentation_bridge.bridge_audit_path, "audit/presentation-dashboard-bridge.json");
  copyIntoProof(presentationToDashboard.presentation_bridge.bridge_lineage_path, "lineage/presentation-dashboard-bridge.json");

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
    target_ref: "workspace://localization/presentation-dashboard-flow",
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

  const presentationBundle = readJson(presentationBundlePath);
  const fidelityReport = readJson(path.join(proofRoot, "intermediate", "localization-fidelity-report.json"));
  const localizationProof = readJson(path.join(proofRoot, "intermediate", "localization-proof.json"));
  const localizedPublishState = readJson(localizedPublish.transport.publish_state_path);
  const localizedEmbedPayload = readJson(localizedPublish.transport.embed_payload_path);

  const assertions = {
    presentation_created: deckId.length > 0,
    presentation_runtime_persisted:
      fs.existsSync(presentationBundlePath) &&
      fs.existsSync(presentationStatePath),
    presentation_contains_marker: JSON.stringify(presentationBundle).includes(marker),
    dashboard_created_from_presentation:
      presentationToDashboard.presentation_bridge.deck_id === deckId,
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
    flow: ["presentations", "dashboards", "arabic-localization-lct-engine", "publish"],
    upstream_refs: {
      deck_id: deckId,
      shared_dashboard_id: sharedDashboardId,
      downstream_localized_dashboard_id: downstreamLocalizedDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id
    },
    proof_paths: {
      presentation_bundle_path: presentationBundlePath,
      presentation_state_path: presentationStatePath,
      presentation_dashboard_bridge_manifest_path: presentationToDashboard.presentation_bridge.bridge_manifest_path,
      localization_intake_proof_path: intakeProofPath,
      localization_consume_manifest_path: intakeProof.downstream_shared_dashboard_consume_manifest_path,
      localized_publish_manifest_path: localizedPublish.transport.manifest_path
    }
  };
  writeJson("lineage/combined-flow.json", combinedFlow);

  const flowProof = {
    phase_requirement: "presentations -> dashboards -> localization -> publish shared platform proof",
    generated_at: now(),
    flow: ["presentations", "dashboards", "arabic-localization-lct-engine", "publish"],
    routes: {
      presentation_create: `${dashboardBaseUrl}/api/v1/presentations/create-from-canvas`,
      presentation_to_dashboard: `${dashboardBaseUrl}/api/v1/presentations/convert-to-dashboard`,
      localize_dashboard: `${dashboardBaseUrl}/api/v1/localization/localize-dashboard`,
      localized_publish: `${dashboardBaseUrl}/api/v1/dashboards/publish`,
      localized_publish_embed: localizedPublish.transport.served_embed_html_url
    },
    runtime_paths: {
      presentation_root: presentationRoot,
      shared_dashboard_root: path.join(dashboardRuntimeRoot, "dashboard-engine", "dashboards", sharedDashboardId),
      localized_dashboard_root: path.join(dashboardRuntimeRoot, "dashboard-engine", "dashboards", downstreamLocalizedDashboardId),
      localization_output_root: localizationResult.output_root
    },
    identifiers: {
      marker,
      deck_id: deckId,
      shared_dashboard_id: sharedDashboardId,
      localized_dashboard_id: downstreamLocalizedDashboardId,
      localized_publication_id: localizedPublish.publication.publication_id
    },
    screenshots: {
      presentations_surface: path.join(proofRoot, "browser", "presentations-surface.png"),
      shared_dashboard: path.join(proofRoot, "browser", "shared-dashboard.png"),
      localization_surface: path.join(proofRoot, "browser", "localization-surface.png"),
      localized_shell_dashboard: path.join(proofRoot, "browser", "localized-shell-dashboard.png"),
      localized_shell_published: path.join(proofRoot, "browser", "localized-shell-published.png")
    },
    assertions,
    status: Object.values(assertions).every(Boolean) ? "pass" : "contradiction"
  };
  writeJson("records/flow-proof.json", flowProof);
  writeJson("records/presentation-create.json", presentationCreate);
  writeJson("records/presentation-to-dashboard.json", presentationToDashboard);
  writeJson("records/localization-localize-dashboard.json", localizationRun);
  writeJson("records/localized-shell-publish.json", localizedPublish);
  writeJson("evidence/cross-engine-flow.json", combinedFlow);
  writeJson("audit/cross-engine-flow.json", {
    flow: combinedFlow.flow,
    refs: combinedFlow.proof_paths,
    counts: {
      presentations_evidence: presentationEvidencePath ? 1 : 0,
      bridge_evidence: 1,
      localization_evidence: 1,
      consume_evidence: 1,
      publish_evidence: Array.isArray(localizedPublish.snapshot.evidence) ? localizedPublish.snapshot.evidence.length : 0
    }
  });

  if (!Object.values(assertions).every(Boolean)) {
    throw new Error(`Presentation localization flow assertions failed: ${JSON.stringify(assertions)}`);
  }

  resultSummary = {
    runId,
    proofRoot,
    flowProofPath: path.join(proofRoot, "records", "flow-proof.json"),
    deckId,
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
