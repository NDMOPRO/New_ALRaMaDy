import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();
const smokeRunId = `smoke-${Date.now()}`;
const dashboardStorageRoot = path.join(root, ".runtime", `dashboard-engine-${smokeRunId}`);
const reportStorageRoot = path.join(root, ".runtime", `report-engine-${smokeRunId}`);

fs.rmSync(dashboardStorageRoot, { recursive: true, force: true });

const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const requestText = (url) =>
  new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const request = client.request(
      target,
      { method: "GET" },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
            status: response.statusCode ?? 0,
            text: async () => text,
            json: async () => JSON.parse(text)
          });
        });
      }
    );
    request.on("error", (error) => reject(new Error(`${url} :: ${error.message}`)));
    request.end();
  });
const fetchWithRetry = async (url, attempts = 5, delayMs = 100) => {
  let lastResponse = null;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await requestText(url);
      if (response.ok) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs * (attempt + 1));
    }
  }
  if (!lastResponse && lastError) {
    throw lastError;
  }
  return lastResponse;
};
const fetchTextUntil = async (url, predicate, attempts = 6, delayMs = 120) => {
  let lastText = "";
  let lastResponse = null;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await requestText(url);
      const text = await response.text();
      if (response.ok && predicate(text)) {
        return { response, text };
      }
      lastResponse = response;
      lastText = text;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs * (attempt + 1));
    }
  }
  if (!lastResponse && lastError) {
    throw lastError;
  }
  return { response: lastResponse, text: lastText };
};
const retry = async (action, attempts = 6, delayMs = 120) => {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(delayMs * (attempt + 1));
      }
    }
  }
  throw lastError;
};

const common = await load("packages/common/dist/index.js");
const contracts = await load("packages/contracts/dist/index.js");
const localizationEngine = await load("packages/arabic-localization-lct-engine/dist/index.js");
const dashboardEngine = await load("packages/dashboard-engine/dist/index.js");
const presentationsEngine = await load("packages/presentations-engine/dist/index.js");
const reportEngine = await load("packages/report-engine/dist/index.js");
const strictEngine = await load("packages/strict-replication-engine/dist/index.js");
const runtime = await load("packages/runtime/dist/index.js");
const artifacts = await load("packages/artifacts/dist/index.js");
const jobs = await load("packages/jobs/dist/index.js");
const evidence = await load("packages/evidence/dist/index.js");
const audit = await load("packages/audit-lineage/dist/index.js");
const library = await load("packages/library/dist/index.js");
const brand = await load("packages/brand-template/dist/index.js");
const canvas = await load("packages/canvas-contract/dist/index.js");
const permissions = await load("packages/permissions/dist/index.js");
const connectors = await load("packages/connectors/dist/index.js");
const publication = await load("packages/output-publication/dist/index.js");
const capabilityRegistry = await load("packages/capability-registry/dist/index.js");

if (common.CONTRACT_PACK_VERSION !== "1.0.0") {
  throw new Error("Unexpected contract pack version");
}

contracts.ArtifactSchema.parse({
  contract: contracts.contractEnvelope("artifact"),
  artifact_id: "artifact-1",
  artifact_type: "report",
  artifact_subtype: "standard",
  project_id: "project-1",
  workspace_id: "workspace-1",
  source_refs: ["source-1"],
  parent_artifact_refs: [],
  canonical_ref: "canonical-1",
  created_by: "user-1",
  created_at: "2026-03-15T00:00:00Z",
  mode: "easy",
  editable_status: "editable",
  template_status: "applied",
  lineage_ref: "lineage-1",
  evidence_ref: "evidence-1",
  verification_status: "verified",
  storage_ref: {
    storage_id: "storage-1",
    storage_class: "object",
    uri: "file://artifact",
    checksum: "sha256:abc",
    region: "local"
  },
  preview_ref: {
    preview_id: "preview-1",
    preview_type: "html_canvas",
    storage_ref: "storage-1"
  },
  export_refs: [],
  version_ref: {
    version_id: "version-1",
    parent_version_id: null,
    version_number: 1,
    semantic_version: "1.0.0"
  },
  tenant_ref: "tenant-1",
  permission_scope: {
    visibility: "workspace",
    allow_read: true,
    allow_write: true,
    allow_share: false,
    allow_publish: true,
    allow_audit_view: true
  }
});

contracts.StrictPolicySchema.parse({
  contract: contracts.contractEnvelope("strict"),
  schema_namespace: contracts.STRICT_SCHEMA_NAMESPACE,
  schema_version: contracts.STRICT_SCHEMA_VERSION,
  policy_id: "strict-policy-1",
  policy_name: "Default Strict Policy",
  require_structural_gate: true,
  require_pixel_gate: true,
  require_round_trip_validation: true,
  require_editable_output: true,
  prohibit_silent_degradation: true,
  allow_degraded_publish: false,
  max_repair_iterations: 2,
  font_fallback_policy: "forbidden",
  binding_policy: "preserve_or_fail",
  accepted_target_kinds: ["docx", "pptx", "xlsx"],
  renderer_profile_ref: "render-profile-1",
  created_at: "2026-03-15T00:00:00Z",
  updated_at: "2026-03-15T00:00:00Z"
});

const bootstrap = new capabilityRegistry.RegistryBootstrap();
bootstrap.registerCapability({
  capability_id: "excel_engine",
  display_name: "Excel Engine",
  package_name: "@rasid/contracts",
  contract_version: "1.0.0",
  supported_action_refs: contracts.ExcelActionRegistry.map((action) => action.action_id),
  supported_tool_refs: contracts.ExcelToolRegistry.map((tool) => tool.tool_id)
});
bootstrap.registerManifest(
  capabilityRegistry.createActionManifest("excel_engine", "1.0.0", contracts.ExcelActionRegistry, ["approval"], ["evidence"])
);
bootstrap.registerTool(contracts.ExcelToolRegistry[0]);
bootstrap.registerApprovalHook("approval", async () => ({ approval_state: "approved", reasons: ["smoke"] }));
bootstrap.registerEvidenceHook("evidence", async (pack) => pack);

await bootstrap.evaluateApproval("approval", contracts.ExcelActionRegistry[0], null);
localizationEngine.registerArabicLocalizationLctCapability(bootstrap);
await bootstrap.evaluateApproval("approval.localization", contracts.LocalizationActionRegistry[0], null);
dashboardEngine.registerDashboardCapability(bootstrap);
presentationsEngine.registerPresentationsCapability(bootstrap);
reportEngine.registerReportCapability(bootstrap);

const engine = new dashboardEngine.DashboardEngine({ storageDir: dashboardStorageRoot });
const created = engine.createDashboard({
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "user-1",
  title: "Operational Dashboard",
  description: "Smoke dashboard",
  mode: "easy",
  dataset_profiles: [
    {
      dataset_ref: "dataset-1",
      display_name: "Dataset 1",
      dimension_fields: ["region"],
      measure_fields: ["revenue"],
      available_filter_fields: ["region"]
    }
  ]
});
contracts.DashboardSchema.parse(created.dashboard);
contracts.DashboardVersionSchema.parse(created.version);

const updated = engine.updateDashboard({
  dashboard: created.dashboard,
  base_version: created.version,
  actor_ref: "user-1",
  mutation: {
    mutation_kind: "add_widget",
    widget: {
      widget_type: "text",
      title: "Narrative",
      subtitle: "Smoke note",
      page_id: "page-overview",
      layout: { page_id: "page-overview", x: 0, y: 10, width: 4, height: 2 }
    }
  }
});

engine.scheduleDashboardRefresh({
  dashboard_id: updated.dashboard.dashboard_id,
  actor_ref: "scheduler-1",
  due_at: "2026-03-15T00:10:00Z"
});

const scheduledRefreshes = engine.runDueRefreshes("2026-03-15T00:10:00Z");
const refreshed = scheduledRefreshes[0];

if (!refreshed) {
  throw new Error("Scheduled dashboard refresh runner did not execute");
}

const filterInteraction = engine.executeInteraction({
  dashboard: refreshed.dashboard,
  base_version: refreshed.version,
  actor_ref: "user-1",
  source_widget_ref: refreshed.dashboard.widgets[0].widget_id,
  trigger: "filter_change",
  effect: "filter",
  target_widget_refs: refreshed.dashboard.widgets.slice(1).map((widget) => widget.widget_id),
  payload: {
    dataset_ref: "dataset-1",
    field_ref: "region",
    values: ["EMEA"],
    run_refresh: true,
    action: "refresh"
  }
});

const afterFilterDashboard = filterInteraction.refreshResult?.dashboard ?? filterInteraction.workflow.dashboard;
const afterFilterVersion = filterInteraction.refreshResult?.version ?? filterInteraction.workflow.version;

const selectionInteraction = engine.executeInteraction({
  dashboard: afterFilterDashboard,
  base_version: afterFilterVersion,
  actor_ref: "user-1",
  source_widget_ref: afterFilterDashboard.widgets[1].widget_id,
  trigger: "selection",
  effect: "highlight",
  target_widget_refs: [afterFilterDashboard.widgets[2].widget_id],
  payload: { selected_values: ["EMEA"] }
});

const drillInteraction = engine.executeInteraction({
  dashboard: selectionInteraction.workflow.dashboard,
  base_version: selectionInteraction.workflow.version,
  actor_ref: "user-1",
  source_widget_ref: selectionInteraction.workflow.dashboard.widgets[1].widget_id,
  trigger: "drill_down",
  effect: "navigate",
  target_widget_refs: [selectionInteraction.workflow.dashboard.widgets[2].widget_id],
  payload: { destination_page_id: "page-overview-detail", context: { region: "EMEA" } }
});

const compareInteraction = engine.executeInteraction({
  dashboard: drillInteraction.workflow.dashboard,
  base_version: drillInteraction.workflow.version,
  actor_ref: "user-1",
  source_widget_ref: drillInteraction.workflow.dashboard.widgets[0].widget_id,
  trigger: "compare_toggle",
  effect: "compare",
  target_widget_refs: drillInteraction.workflow.dashboard.widgets.slice(1).map((widget) => widget.widget_id),
  payload: { compare_base_version_ref: created.version.version_id, action: "compare" }
});

if (!filterInteraction.refreshResult) {
  throw new Error("Filter interaction did not trigger the refresh runtime path");
}

if (!compareInteraction.compareBundle) {
  throw new Error("Compare interaction did not trigger the compare runtime path");
}

const published = engine.publishDashboard({
  dashboard: compareInteraction.workflow.dashboard,
  version: compareInteraction.workflow.version,
  published_by: "user-1",
  target_ref: "workspace://dashboards/operational"
});

const compared = compareInteraction.compareBundle;

const presentationEngine = new presentationsEngine.PresentationEngine();
const presentationCreated = await presentationEngine.createPresentation({
  presentation_id: "presentation-smoke-1",
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "user-1",
  title: "Presentation Smoke",
  description: "Smoke presentation",
  mode: "easy",
  language: "ar-SA",
  audience: "operators",
  tone: "direct",
  sources: [
    { source_kind: "prompt_topic", source_ref: "prompt-1", prompt: "Build a short smoke deck about parity.", topic: "parity" },
    {
      source_kind: "dataset",
      source_ref: "dataset-1",
      title: "Regions",
      dataset_name: "Regions",
      columns: ["Region", "Revenue"],
      rows: [
        { Region: "Riyadh", Revenue: 42 },
        { Region: "Jeddah", Revenue: 35 }
      ]
    }
  ]
});

const presentationParity = await presentationEngine.runRenderParityValidation(presentationCreated);

if (!presentationParity.parityValidation.publish_ready) {
  throw new Error("Presentation parity validation did not pass in smoke");
}

const reportRuntime = new reportEngine.ReportEngine({
  storageDir: reportStorageRoot
});
const reportImportRoot = path.join(reportStorageRoot, "import-sources");
fs.rmSync(reportImportRoot, { recursive: true, force: true });
fs.mkdirSync(reportImportRoot, { recursive: true });
const smokeDocxPath = path.join(reportImportRoot, "smoke-import.docx");
const smokePdfPath = path.join(reportImportRoot, "smoke-import.pdf");
fs.writeFileSync(
  smokeDocxPath,
  Buffer.from(
    await reportEngine.createSampleDocx("Smoke Imported Report", [
      "Smoke Imported Report",
      "Imported summary paragraph one.",
      "Imported summary paragraph two."
    ])
  )
);
fs.writeFileSync(
  smokePdfPath,
  Buffer.from(
    reportEngine.createSamplePdf([
      "Smoke PDF Report",
      "Imported pdf summary paragraph.",
      "Exports remain derived."
    ])
  )
);
const importedReport = await reportRuntime.ingestExternalReport({
  report_id: "report-smoke-imported",
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "importer-1",
  title: "Smoke Imported Report",
  language: "en-US",
  file_path: smokeDocxPath,
  parser_hint: "docx"
});
await reportRuntime.ingestExternalReport({
  report_id: "report-smoke-imported-pdf",
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "importer-1",
  title: "Smoke Imported PDF Report",
  language: "en-US",
  file_path: smokePdfPath,
  parser_hint: "pdf"
});
const createdReport = reportRuntime.createReport({
  report_id: "report-smoke-1",
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "user-1",
  title: "Smoke Report",
  report_type: "ops_report",
  source_refs: ["dataset://smoke"],
  sections: [
    {
      section_kind: "cover",
      title: "Smoke Cover",
      blocks: [{ block_type: "narrative", title: "Intro", body: "Smoke source of truth." }]
    },
    {
      section_kind: "executive_summary",
      title: "Metrics",
      blocks: [
        {
          block_type: "metric_card",
          title: "Coverage",
          body: "Current metric",
          dataset_ref: "dataset://smoke",
          query_ref: "query://smoke/coverage",
          metric_value: 91
        }
      ]
    }
  ]
});
const refreshedReport = reportRuntime.refreshReport({
  report_id: createdReport.report.report_id,
  actor_ref: "scheduler-1"
});
const reviewedReport = reportRuntime.reviewReport({
  report_id: refreshedReport.report.report_id,
  actor_ref: "reviewer-1",
  decision: "reviewed",
  comment: "Smoke review"
});
const approvedReport = reportRuntime.approveReport({
  report_id: reviewedReport.report.report_id,
  actor_ref: "approver-1",
  decision: "approved",
  comment: "Smoke approve"
});
const reportHtml = await reportRuntime.exportReportHtml({
  report_id: approvedReport.report.report_id,
  actor_ref: "publisher-1"
});
const dispatchedReport = await reportEngine.dispatchReportAction({
  action_id: "reports.create_report.v1",
  storage_dir: reportStorageRoot,
  payload: {
    report_id: "report-smoke-dispatch",
    tenant_ref: "tenant-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    created_by: "dispatcher-1",
    title: "Smoke Report Dispatch",
    report_type: "ops_report",
    source_refs: ["dataset://smoke-dispatch"],
    sections: [
      {
        section_kind: "cover",
        title: "Dispatch Cover",
        blocks: [{ block_type: "narrative", title: "Dispatch Intro", body: "Dispatched through runtime action." }]
      }
    ]
  }
});
const dispatchedExport = await reportEngine.dispatchReportTool({
  tool_id: "registry.reports.export_report_html",
  storage_dir: reportStorageRoot,
  payload: {
    report_id: "report-smoke-dispatch",
    actor_ref: "dispatcher-1",
    target: "html"
  }
});
const reportPublished = await reportRuntime.publishReport({
  report_id: approvedReport.report.report_id,
  actor_ref: "publisher-1",
  target_ref: "workspace://reports/smoke"
});
const reportPublicationService = reportEngine.startReportPublicationService({
  storageDir: reportStorageRoot
});
const reportPresentation = await reportRuntime.convertReportToPresentation({
  report_id: approvedReport.report.report_id,
  actor_ref: "publisher-1",
  target_ref: "workspace://reports/smoke/presentation"
});
const presentationSyncedBlock = reportPresentation.state.contentBlocks.find(
  (block) => block.content_payload?.source_metadata?.downstream_capability === "presentations"
);
if (presentationSyncedBlock) {
  reportRuntime.updateReport({
    report_id: approvedReport.report.report_id,
    actor_ref: "editor-smoke-1",
    mutation: {
      mutation_kind: "replace_block_content",
      block_ref: presentationSyncedBlock.block_id,
      body: "Manual smoke reconciliation override for presentation."
    }
  });
}
const reportPresentationReconciled = await reportRuntime.convertReportToPresentation({
  report_id: approvedReport.report.report_id,
  actor_ref: "publisher-1",
  target_ref: "workspace://reports/smoke/presentation"
});
const reportDashboard = await reportRuntime.convertReportToDashboard({
  report_id: approvedReport.report.report_id,
  actor_ref: "publisher-1",
  target_ref: "workspace://reports/smoke/dashboard"
});
const dashboardSyncedBlock = reportDashboard.state.contentBlocks.find(
  (block) => block.content_payload?.source_metadata?.downstream_capability === "dashboards"
);
if (dashboardSyncedBlock) {
  reportRuntime.updateReport({
    report_id: approvedReport.report.report_id,
    actor_ref: "editor-smoke-2",
    mutation: {
      mutation_kind: "replace_block_content",
      block_ref: dashboardSyncedBlock.block_id,
      body: "Manual smoke reconciliation override for dashboard."
    }
  });
}
const reportDashboardReconciled = await reportRuntime.convertReportToDashboard({
  report_id: approvedReport.report.report_id,
  actor_ref: "publisher-1",
  target_ref: "workspace://reports/smoke/dashboard"
});
const reportSchedule = reportRuntime.scheduleReport({
  report_id: approvedReport.report.report_id,
  actor_ref: "scheduler-1",
  next_run_at: "2026-03-15T06:00:00.000Z",
  trigger_policy: {
    trigger_mode: "calendar",
    misfire_policy: "run_next",
    require_fresh_inputs: true,
    require_approval_before_run: false,
    freshness_window_minutes: 120
  },
  publication_policy: {
    publish_mode: "on_success",
    publication_target_refs: ["workspace://reports/smoke/scheduled"],
    export_profile_refs: [],
    visibility_scope_ref: "workspace"
  }
});
const reportScheduledRuns = await reportRuntime.runDueSchedules("2026-03-15T06:00:00.000Z");

if (!reportHtml.exportArtifact.storage_ref.uri.startsWith("file:")) {
  throw new Error("Report export artifact was not persisted to disk");
}

if (dispatchedReport.report.report_id !== "report-smoke-dispatch") {
  throw new Error("Report dispatch action did not create the runtime report");
}

if (!dispatchedExport.fileName.endsWith(".html")) {
  throw new Error("Report dispatch tool did not execute the mapped export action");
}

if (
  !reportPublished.publication.target_ref.startsWith("transport://report-engine/gateway/") &&
  !reportPublished.transport.served_embed_html_url &&
  !reportPublished.transport.served_manifest_url
) {
  throw new Error("Report publish transport did not expose a backend or served publication target");
}

if (reportSchedule.schedule.schedule_id.length === 0 || reportScheduledRuns.length === 0) {
  throw new Error("Report schedule runner did not execute");
}

if (!reportScheduledRuns[0]?.dispatch || !["completed", "degraded"].includes(reportScheduledRuns[0].dispatch.state)) {
  throw new Error("Report schedule dispatch orchestration did not persist");
}

if (!importedReport.sourceArtifact.storage_ref.uri.startsWith("file:")) {
  throw new Error("External report ingest did not persist the imported source artifact");
}

if ((importedReport.payload.table_count ?? 0) < 1 || (importedReport.payload.page_count ?? 0) < 1) {
  throw new Error("External report ingest did not preserve richer layout/table/page fidelity");
}

if (!importedReport.payload.parsed_structure_artifact_ref || (importedReport.payload.page_structure?.length ?? 0) === 0) {
  throw new Error("External report ingest did not persist parsed structure fidelity artifacts");
}

if (!reportPresentation.nativePresentationPublication?.publication.publication_id) {
  throw new Error("Native report-to-presentation conversion did not publish through presentations-engine");
}

if (!reportDashboard.nativeDashboardPublication?.transport?.served_embed_html_url) {
  throw new Error("Native report-to-dashboard conversion did not publish through dashboard-engine");
}

if (!reportPresentation.backSyncRecord?.created_version_ref || !reportDashboard.backSyncRecord?.created_version_ref) {
  throw new Error("Downstream conversions did not persist back-sync records into report state");
}

if (
  !reportPresentationReconciled.backSyncRecord?.matched_section_ref ||
  (reportPresentationReconciled.backSyncRecord?.reconciliation_mode ?? "") === "append_only" ||
  !reportDashboardReconciled.backSyncRecord?.matched_section_ref
) {
  throw new Error("Bidirectional reconciliation did not structurally merge downstream outputs back into report state");
}

if (!reportScheduledRuns[0]?.orchestration || reportScheduledRuns[0].orchestration.dispatch_refs.length === 0) {
  throw new Error("Report schedule orchestration record did not persist");
}

if (reportScheduledRuns[0].transportDeliveries.length === 0) {
  throw new Error("Report schedule transport deliveries did not persist");
}

if (!reportPublished.transport.backend_manifest_uri || !fs.existsSync(new URL(reportPublished.transport.backend_manifest_uri))) {
  throw new Error("Report backend publication manifest was not written");
}

if (!reportPublished.transport.backend_access_state_uri || !fs.existsSync(new URL(reportPublished.transport.backend_access_state_uri))) {
  throw new Error("Report backend publication access state was not written");
}

if (!reportPublished.transport.gateway_manifest_uri || !fs.existsSync(new URL(reportPublished.transport.gateway_manifest_uri))) {
  throw new Error("Report transport gateway manifest was not written");
}

if (!reportPublished.transport.delivery_receipt_uri || !fs.existsSync(new URL(reportPublished.transport.delivery_receipt_uri))) {
  throw new Error("Report transport delivery receipt was not written");
}

const rehydratedPublication = reportPublicationService.publications.find(
  (entry) => entry.publication_id === reportPublished.publication.publication_id
);

if (!rehydratedPublication?.served_embed_html_url || !rehydratedPublication.served_manifest_url) {
  throw new Error("Report publication service did not rehydrate persisted served routes");
}

await new Promise((resolve) => setTimeout(resolve, 50));
const servedReportEmbedResult = await fetchTextUntil(
  rehydratedPublication.served_embed_html_url,
  (text) => text.includes('id="report-embed"')
);
const servedReportEmbed = servedReportEmbedResult.response;
const servedReportEmbedHtml = servedReportEmbedResult.text;
const servedReportPayload = await fetchWithRetry(rehydratedPublication.served_embed_payload_url);
const servedReportPayloadText = await servedReportPayload.text();

if (!servedReportEmbed.ok || !servedReportEmbedHtml.includes('id="report-embed"')) {
  throw new Error("Report publish transport served embed did not return the publication");
}

if (!servedReportPayload.ok) {
  throw new Error(`Report publish transport served payload returned ${servedReportPayload.status}: ${servedReportPayloadText}`);
}

const servedReportPayloadJson = JSON.parse(servedReportPayloadText);

if (servedReportPayloadJson.publication_id !== reportPublished.publication.publication_id) {
  throw new Error("Report publish transport served payload did not return the publication");
}

const persistedState = await retry(() => Promise.resolve(engine.loadPersistedDashboardState(compareInteraction.workflow.dashboard.dashboard_id)));
const persistedSchedules = engine.listScheduledRefreshes();
const runnerJobs = engine.listScheduleRunnerJobs(compareInteraction.workflow.dashboard.dashboard_id);
const comparePayload = JSON.parse(fs.readFileSync(new URL(compared.diffArtifact.storage_ref.uri), "utf8"));
const interactionAudit = filterInteraction.workflow.auditEvents[0];
const interactionLineage = filterInteraction.workflow.lineageEdges.find((edge) => edge.transform_ref === "dashboard.binding");

if (persistedState.version.version_id !== compareInteraction.workflow.version.version_id) {
  throw new Error("Persisted dashboard state did not advance to the refreshed version");
}

if (!created.dashboardArtifact.storage_ref.uri.startsWith("file:")) {
  throw new Error("Dashboard artifact storage did not switch to filesystem persistence");
}

if (!fs.existsSync(new URL(created.dashboardArtifact.storage_ref.uri))) {
  throw new Error("Persisted dashboard artifact state file is missing");
}

if (!persistedSchedules.some((schedule) => schedule.dashboard_id === compareInteraction.workflow.dashboard.dashboard_id)) {
  throw new Error("Dashboard refresh schedule was not persisted");
}

if (!runnerJobs.some((job) => job.state === "completed" && job.refresh_job_ref === refreshed.job.job_id)) {
  throw new Error("Scheduled runner job evidence was not persisted");
}

if (published.publication.target_ref !== published.transport.served_embed_html_url) {
  throw new Error("Publish transport did not expose a consumable embed target");
}

if (!published.transport.embed_payload_uri || !fs.existsSync(new URL(published.transport.embed_payload_uri))) {
  throw new Error("Embed payload transport output was not written");
}

await new Promise((resolve) => setTimeout(resolve, 50));
const servedEmbedResult = await fetchTextUntil(
  published.publication.target_ref,
  (text) => text.includes(published.publication.publication_id)
);
const servedEmbedResponse = servedEmbedResult.response;
const servedEmbedHtml = servedEmbedResult.text;
const servedPayloadResponse = await fetchWithRetry(published.transport.served_embed_payload_url);
const servedPayload = await servedPayloadResponse.json();

if (!servedEmbedResponse.ok || !servedEmbedHtml.includes(published.publication.publication_id)) {
  throw new Error("Served embed transport endpoint did not return the published dashboard");
}

if (!servedPayloadResponse.ok || servedPayload.publication_id !== published.publication.publication_id) {
  throw new Error("Served embed payload endpoint did not return the published payload");
}

if (!compared.compareResult.binding_diffs || compared.compareResult.binding_diffs.length === 0) {
  throw new Error("Deeper compare payload did not include binding diffs");
}

if (!compared.compareResult.refresh_result_diffs) {
  throw new Error("Deeper compare payload did not include refresh result diffs");
}

if (filterInteraction.workflow.job.stage !== "dashboard_interaction") {
  throw new Error("Interaction execution did not emit an interaction runtime job");
}

if (interactionAudit.action_ref !== "dashboard.interaction.refresh.v1") {
  throw new Error("Interaction execution did not emit interaction audit evidence");
}

if (!interactionLineage) {
  throw new Error("Interaction execution did not preserve lineage output");
}

const modulesLoaded = [
  localizationEngine,
  dashboardEngine,
  presentationsEngine,
  reportEngine,
  strictEngine,
  runtime,
  artifacts,
  jobs,
  evidence,
  audit,
  library,
  brand,
  canvas,
  permissions,
  connectors,
  publication
].every(Boolean);

if (!modulesLoaded) {
  throw new Error("One or more shared packages failed to load");
}

if (bootstrap.listCapabilities().findIndex((capability) => capability.capability_id === "dashboards") === -1) {
  throw new Error("Dashboard capability bootstrap was not registered");
}

if (bootstrap.listCapabilities().findIndex((capability) => capability.capability_id === "arabic_localization_lct") === -1) {
  throw new Error("Localization capability bootstrap was not registered");
}

if (bootstrap.listCapabilities().findIndex((capability) => capability.capability_id === "reports") === -1) {
  throw new Error("Report capability bootstrap was not registered");
}

if (bootstrap.listCapabilities().findIndex((capability) => capability.capability_id === "presentations") === -1) {
  throw new Error("Presentations capability bootstrap was not registered");
}

[
  "dashboard.interaction.filter.v1",
  "dashboard.interaction.selection.v1",
  "dashboard.interaction.drill.v1",
  "dashboard.interaction.refresh.v1",
  "dashboard.interaction.compare.v1"
].forEach((actionId) => {
  if (bootstrap.listActions().findIndex((action) => action.action_id === actionId) === -1) {
    throw new Error(`Dashboard interaction action ${actionId} was not registered`);
  }
});

[
  "registry.dashboard.interaction.filter",
  "registry.dashboard.interaction.selection",
  "registry.dashboard.interaction.drill",
  "registry.dashboard.interaction.refresh",
  "registry.dashboard.interaction.compare"
].forEach((toolId) => {
  if (bootstrap.listTools().findIndex((tool) => tool.tool_id === toolId) === -1) {
    throw new Error(`Dashboard interaction tool ${toolId} was not registered`);
  }
});

if (published.publication.publication_type !== "internal_publish") {
  throw new Error("Dashboard publication flow did not execute");
}

if (compared.compareResult.changed_widget_refs.length === 0) {
  throw new Error("Dashboard compare flow did not detect changes");
}

const strictRegression = strictEngine.runStrictReplicationRegressionSuite();
if (strictRegression.length !== 2) {
  throw new Error("Strict replication regression bundle count mismatch");
}
if (!strictRegression.some((bundle) => bundle.strictPublished) || !strictRegression.some((bundle) => !bundle.strictPublished)) {
  throw new Error("Strict replication regression coverage mismatch");
}

const localizationRegression = await localizationEngine.runArabicLocalizationLctRegressionSuite({
  outputRoot: path.join(root, "packages", "arabic-localization-lct-engine", "output")
});
if (localizationRegression.length !== 18) {
  throw new Error("Localization regression bundle coverage mismatch");
}
if (!localizationRegression.some((sample) => sample.bundle.publish_mode === "localized")) {
  throw new Error("Localization regression missing successful publish coverage");
}
if (!localizationRegression.some((sample) => sample.bundle.publish_mode === "degraded")) {
  throw new Error("Localization regression missing degraded publish coverage");
}
if (!localizationRegression.every((sample) => fs.existsSync(sample.artifacts.localized_output_path))) {
  throw new Error("Localization regression did not write localized output files");
}
if (!localizationRegression.every((sample) => fs.existsSync(sample.artifacts.evidence_path))) {
  throw new Error("Localization regression did not write evidence files");
}
if (!localizationRegression.every((sample) => fs.existsSync(sample.artifacts.roundtrip_manifest_path))) {
  throw new Error("Localization regression did not write round-trip manifests");
}
if (!localizationRegression.every((sample) => fs.existsSync(sample.artifacts.roundtrip_evidence_path))) {
  throw new Error("Localization regression did not write round-trip evidence files");
}
if (!localizationRegression.every((sample) => fs.existsSync(sample.artifacts.roundtrip_preservation_path))) {
  throw new Error("Localization regression did not write round-trip preservation reports");
}
if (!localizationRegression.every((sample) => fs.existsSync(sample.artifacts.fidelity_report_path))) {
  throw new Error("Localization regression did not write fidelity reports");
}
if (!localizationRegression.some((sample) => sample.sample_name === "report-en-ar-pass" && sample.artifacts.localized_output_path.endsWith(".docx"))) {
  throw new Error("Localization regression missing native report output coverage");
}
if (!localizationRegression.some((sample) => sample.sample_name === "presentation-en-ar-pass" && sample.artifacts.localized_output_path.endsWith(".pptx"))) {
  throw new Error("Localization regression missing native presentation output coverage");
}
if (!localizationRegression.some((sample) => sample.sample_name === "spreadsheet-en-ar-pass" && sample.artifacts.localized_output_path.endsWith(".xlsx"))) {
  throw new Error("Localization regression missing native spreadsheet output coverage");
}
if (!localizationRegression.some((sample) => sample.sample_name === "dashboard-en-ar-pass" && sample.artifacts.localized_output_path.endsWith(".html") && sample.artifacts.published_sidecar_paths.some((entry) => entry.endsWith("dashboard-bundle\\embed-payload.json")) && sample.artifacts.dashboard_package_path && sample.artifacts.dashboard_package_path.endsWith(".zip"))) {
  throw new Error("Localization regression missing native dashboard bundle coverage");
}
const dashboardPass = localizationRegression.find((sample) => sample.sample_name === "dashboard-en-ar-pass");
const formalTone = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-formal-pass");
const executiveTone = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-executive-pass");
const governmentTone = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-government-pass");
const technicalTone = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-technical-pass");
const financeDomain = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-domain-finance-pass");
const healthcareDomain = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-domain-healthcare-pass");
const governmentDomain = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-domain-government-pass");
const telecomDomain = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-domain-telecom-pass");
const providerSuccess = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-provider-success");
const providerError = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-provider-error-degraded");
const providerTimeout = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-provider-timeout-degraded");
const providerMalformed = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-provider-malformed-degraded");
const glossaryConflict = localizationRegression.find((sample) => sample.sample_name === "report-en-ar-glossary-conflict-degraded");
const dashboardDegraded = localizationRegression.find((sample) => sample.sample_name === "dashboard-en-ar-degraded");
if (!dashboardPass || !formalTone || !executiveTone || !governmentTone || !technicalTone || !financeDomain || !healthcareDomain || !governmentDomain || !telecomDomain || !providerSuccess || !providerError || !providerTimeout || !providerMalformed || !glossaryConflict || !dashboardDegraded) {
  throw new Error("Localization regression is missing one or more advanced localization samples");
}
const dashboardPassRoundTrip = JSON.parse(fs.readFileSync(dashboardPass.artifacts.roundtrip_manifest_path, "utf8"));
const formalToneCanonical = JSON.parse(fs.readFileSync(formalTone.artifacts.localized_canonical_path, "utf8"));
const executiveToneCanonical = JSON.parse(fs.readFileSync(executiveTone.artifacts.localized_canonical_path, "utf8"));
const governmentToneCanonical = JSON.parse(fs.readFileSync(governmentTone.artifacts.localized_canonical_path, "utf8"));
const technicalToneCanonical = JSON.parse(fs.readFileSync(technicalTone.artifacts.localized_canonical_path, "utf8"));
const financeDomainCanonical = JSON.parse(fs.readFileSync(financeDomain.artifacts.localized_canonical_path, "utf8"));
const healthcareDomainCanonical = JSON.parse(fs.readFileSync(healthcareDomain.artifacts.localized_canonical_path, "utf8"));
const governmentDomainCanonical = JSON.parse(fs.readFileSync(governmentDomain.artifacts.localized_canonical_path, "utf8"));
const telecomDomainCanonical = JSON.parse(fs.readFileSync(telecomDomain.artifacts.localized_canonical_path, "utf8"));
const providerSuccessIntegration = JSON.parse(fs.readFileSync(providerSuccess.artifacts.translation_integration_path, "utf8"));
const providerErrorIntegration = JSON.parse(fs.readFileSync(providerError.artifacts.translation_integration_path, "utf8"));
const providerTimeoutIntegration = JSON.parse(fs.readFileSync(providerTimeout.artifacts.translation_integration_path, "utf8"));
const providerMalformedIntegration = JSON.parse(fs.readFileSync(providerMalformed.artifacts.translation_integration_path, "utf8"));
const glossaryConflictIntegration = JSON.parse(fs.readFileSync(glossaryConflict.artifacts.translation_integration_path, "utf8"));
const dashboardRoundTrip = JSON.parse(fs.readFileSync(dashboardDegraded.artifacts.roundtrip_manifest_path, "utf8"));
const latestToneMatrix = fs
  .readdirSync(path.join(root, "packages", "arabic-localization-lct-engine", "output"))
  .filter((entry) => entry.startsWith("professional-tone-matrix-"))
  .sort()
  .at(-1);
const latestDomainMatrix = fs
  .readdirSync(path.join(root, "packages", "arabic-localization-lct-engine", "output"))
  .filter((entry) => entry.startsWith("domain-glossary-matrix-"))
  .sort()
  .at(-1);
const latestDashboardChartProof = fs
  .readdirSync(path.join(root, "packages", "arabic-localization-lct-engine", "output"))
  .filter((entry) => entry.startsWith("dashboard-chart-localization-proof-"))
  .sort()
  .at(-1);

if (!dashboardPass.artifacts.dashboard_package_path || !fs.existsSync(dashboardPass.artifacts.dashboard_package_path)) {
  throw new Error("Localization regression missing persisted dashboard package artifact");
}
if (!dashboardPass.artifacts.dashboard_artifact_closure_path || !fs.existsSync(dashboardPass.artifacts.dashboard_artifact_closure_path)) {
  throw new Error("Localization regression missing dashboard artifact closure report");
}
if (!dashboardDegraded.artifacts.dashboard_artifact_closure_path || !fs.existsSync(dashboardDegraded.artifacts.dashboard_artifact_closure_path)) {
  throw new Error("Localization regression missing degraded dashboard artifact closure report");
}
if (dashboardPassRoundTrip.status !== "verified" || dashboardPassRoundTrip.parser_kind !== "dashboard_bundle") {
  throw new Error("Localization regression missing successful hardened dashboard round-trip verification");
}
if (providerSuccessIntegration.provider_final_outcome !== "success" || providerSuccessIntegration.provider_used !== true) {
  throw new Error("Localization regression missing successful external provider validation");
}
if (providerErrorIntegration.provider_final_outcome !== "fallback_local" || providerErrorIntegration.provider_trace.every((entry) => entry.outcome !== "http_error")) {
  throw new Error("Localization regression missing external provider HTTP failure fallback coverage");
}
if (providerTimeoutIntegration.provider_timeout_hit !== true || providerTimeoutIntegration.provider_trace.every((entry) => entry.timeout_hit !== true)) {
  throw new Error("Localization regression missing external provider timeout fallback coverage");
}
if (providerMalformedIntegration.provider_final_outcome !== "fallback_local" || providerMalformedIntegration.provider_trace.every((entry) => entry.outcome !== "malformed_response")) {
  throw new Error("Localization regression missing external provider malformed-response fallback coverage");
}
if (!formalToneCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("تتطلب قائمة المتابعة التنفيذية متابعة في اليوم نفسه"))) {
  throw new Error("Localization regression missing formal tone adaptation output");
}
if (!executiveToneCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("تستلزم قائمة المتابعة التنفيذية إجراءً في اليوم نفسه"))) {
  throw new Error("Localization regression missing executive tone adaptation output");
}
if (!governmentToneCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("اتخاذ الإجراء النظامي"))) {
  throw new Error("Localization regression missing government tone adaptation output");
}
if (!technicalToneCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("استجابة تشغيلية"))) {
  throw new Error("Localization regression missing technical tone adaptation output");
}
if (!financeDomainCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("غرفة متابعة السيولة"))) {
  throw new Error("Localization regression missing finance domain glossary output");
}
if (!healthcareDomainCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("السعة السريرية"))) {
  throw new Error("Localization regression missing healthcare domain glossary output");
}
if (!governmentDomainCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("مركز المتابعة الميدانية"))) {
  throw new Error("Localization regression missing government domain glossary output");
}
if (!telecomDomainCanonical.nodes.text.some((node) => (node.content?.[0]?.value ?? "").includes("مركز قيادة الشبكة"))) {
  throw new Error("Localization regression missing telecom domain glossary output");
}
if (!latestToneMatrix || !fs.existsSync(path.join(root, "packages", "arabic-localization-lct-engine", "output", latestToneMatrix, "professional-tone-matrix.json"))) {
  throw new Error("Localization regression missing professional tone matrix proof");
}
if (!latestDomainMatrix || !fs.existsSync(path.join(root, "packages", "arabic-localization-lct-engine", "output", latestDomainMatrix, "domain-glossary-matrix.json"))) {
  throw new Error("Localization regression missing domain glossary matrix proof");
}
if (!latestDashboardChartProof || !fs.existsSync(path.join(root, "packages", "arabic-localization-lct-engine", "output", latestDashboardChartProof, "dashboard-chart-localization-proof.json"))) {
  throw new Error("Localization regression missing dashboard chart localization proof");
}
if (!providerMalformed.artifacts.provider_malformed_proof_path || !fs.existsSync(providerMalformed.artifacts.provider_malformed_proof_path)) {
  throw new Error("Localization regression missing persisted malformed-provider proof");
}
if (!Array.isArray(glossaryConflictIntegration.glossary_conflicts) || glossaryConflictIntegration.glossary_conflicts.length === 0) {
  throw new Error("Localization regression missing glossary conflict coverage");
}
if (dashboardRoundTrip.status !== "failed" || dashboardRoundTrip.parser_kind !== "dashboard_bundle") {
  throw new Error("Localization regression missing hardened dashboard round-trip failure coverage");
}

console.log("Shared foundation smoke test passed.");
process.exit(0);
