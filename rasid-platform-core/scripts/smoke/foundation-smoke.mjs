import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();

const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);

const common = await load("packages/common/dist/index.js");
const contracts = await load("packages/contracts/dist/index.js");
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

const bootstrap = new capabilityRegistry.RegistryBootstrap();
bootstrap.registerCapability({
  capability_id: "test-capability",
  display_name: "Test Capability",
  package_name: "@rasid/contracts",
  contract_version: "1.0.0",
  supported_action_refs: contracts.ActionRegistry.map((action) => action.action_id),
  supported_tool_refs: contracts.ToolRegistry.map((tool) => tool.tool_id)
});
bootstrap.registerManifest(
  capabilityRegistry.createActionManifest("test-capability", "1.0.0", contracts.ActionRegistry, ["approval"], ["evidence"])
);
bootstrap.registerTool(contracts.ToolRegistry[0]);
bootstrap.registerApprovalHook("approval", async () => ({ approval_state: "approved", reasons: ["smoke"] }));
bootstrap.registerEvidenceHook("evidence", async (pack) => pack);

await bootstrap.evaluateApproval("approval", contracts.ActionRegistry[0], null);

const modulesLoaded = [
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

console.log("Shared foundation smoke test passed.");
