import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();

const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);

const common = await load("packages/common/dist/index.js");
const contracts = await load("packages/contracts/dist/index.js");
const dashboardEngine = await load("packages/dashboard-engine/dist/index.js");
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
dashboardEngine.registerDashboardCapability(bootstrap);

const engine = new dashboardEngine.DashboardEngine();
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

const refreshed = engine.refreshDashboard({
  dashboard: updated.dashboard,
  base_version: updated.version,
  actor_ref: "user-1"
});

const published = engine.publishDashboard({
  dashboard: refreshed.dashboard,
  version: refreshed.version,
  published_by: "user-1",
  target_ref: "workspace://dashboards/operational"
});

const compared = engine.compareDashboardVersions({
  dashboard_id: refreshed.dashboard.dashboard_id,
  tenant_ref: refreshed.dashboard.tenant_ref,
  workspace_id: refreshed.dashboard.workspace_id,
  actor_ref: "user-1",
  base_version: created.version,
  target_version: refreshed.version,
  base_snapshot: created.dashboard,
  target_snapshot: refreshed.dashboard
});

const modulesLoaded = [
  dashboardEngine,
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

if (published.publication.publication_type !== "internal_publish") {
  throw new Error("Dashboard publication flow did not execute");
}

if (compared.compareResult.changed_widget_refs.length === 0) {
  throw new Error("Dashboard compare flow did not detect changes");
}

console.log("Shared foundation smoke test passed.");
