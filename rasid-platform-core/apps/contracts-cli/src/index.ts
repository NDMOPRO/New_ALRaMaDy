import { ArtifactSchema } from "@rasid/artifacts";
import { AuditEventSchema } from "@rasid/audit-lineage";
import { TemplateBrandPresetSchema } from "@rasid/brand-template";
import { CONTRACT_PACK_VERSION, CONTRACT_VERSIONS } from "@rasid/common";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import { CanvasSessionStateSchema } from "@rasid/canvas-contract";
import { SourceSchema } from "@rasid/connectors";
import { ActionRegistry, contractEnvelope, EvidencePackSchema, JobSchema, LibraryAssetSchema, ToolRegistry } from "@rasid/contracts";
import { TenantPermissionSchema } from "@rasid/permissions";
import { PublicationSchema } from "@rasid/output-publication";

const runtime = new RegistryBootstrap();

runtime.registerCapability({
  capability_id: "unified_canvas",
  display_name: "Unified Canvas",
  package_name: "@rasid/canvas-contract",
  contract_version: CONTRACT_PACK_VERSION,
  supported_action_refs: ActionRegistry.map((action) => action.action_id),
  supported_tool_refs: ["registry.canvas-template.apply"]
});

const manifest = createActionManifest(
  "unified_canvas",
  "1.0.0",
  ActionRegistry,
  ["approval.default"],
  ["evidence.default"]
);

runtime.registerManifest(manifest);
ToolRegistry.forEach((tool) => runtime.registerTool(tool));
runtime.registerApprovalHook("approval.default", async () => ({
  approval_state: "approved",
  reasons: ["bootstrap_default"]
}));
runtime.registerEvidenceHook("evidence.default", async (pack) => EvidencePackSchema.parse(pack));

const checks = [
  ["artifact", ArtifactSchema],
  ["audit", AuditEventSchema],
  ["brand", TemplateBrandPresetSchema],
  ["canvas", CanvasSessionStateSchema],
  ["connector", SourceSchema],
  ["evidence", EvidencePackSchema],
  ["job", JobSchema],
  ["library", LibraryAssetSchema],
  ["permissions", TenantPermissionSchema],
  ["publication", PublicationSchema]
] as const;

console.log("rasid shared executable foundation");
console.log(`contracts=${Object.keys(CONTRACT_VERSIONS).length}`);
console.log(`actions=${runtime.listActions().length}`);
console.log(`capabilities=${runtime.listCapabilities().length}`);
console.log(`tool-registry-bootstrap=${runtime.listTools().length}`);
console.log(`schemas-loaded=${checks.length}`);
console.log(`contract-envelope=${contractEnvelope("artifact").namespace}`);
