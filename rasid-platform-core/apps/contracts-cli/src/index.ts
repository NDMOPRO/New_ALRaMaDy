import { ArtifactSchema } from "@rasid/artifacts";
import { AuditEventSchema } from "@rasid/audit-lineage";
import { TemplateBrandPresetSchema } from "@rasid/brand-template";
import { CONTRACT_PACK_VERSION, CONTRACT_VERSIONS } from "@rasid/common";
import { registerDashboardCapability } from "@rasid/dashboard-engine";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import { CanvasSessionStateSchema } from "@rasid/canvas-contract";
import { SourceSchema } from "@rasid/connectors";
import {
  CanvasActionRegistry,
  CanvasToolRegistry,
  DashboardSchema,
  DashboardVersionSchema,
  contractEnvelope,
  EvidencePackSchema,
  ExcelActionRegistry,
  ExcelToolRegistry,
  FormulaGraphStateSchema,
  JobSchema,
  LibraryAssetSchema,
  PresentationActionRegistry,
  StrictActionRegistry,
  StrictToolRegistry,
  WorkbookSchema
} from "@rasid/contracts";
import { TenantPermissionSchema } from "@rasid/permissions";
import { PublicationSchema } from "@rasid/output-publication";

const runtime = new RegistryBootstrap();

runtime.registerCapability({
  capability_id: "unified_canvas",
  display_name: "Unified Canvas",
  package_name: "@rasid/canvas-contract",
  contract_version: CONTRACT_PACK_VERSION,
  supported_action_refs: CanvasActionRegistry.map((action) => action.action_id),
  supported_tool_refs: CanvasToolRegistry.map((tool) => tool.tool_id)
});

runtime.registerCapability({
  capability_id: "excel_engine",
  display_name: "Excel Engine",
  package_name: "@rasid/contracts",
  contract_version: CONTRACT_PACK_VERSION,
  supported_action_refs: ExcelActionRegistry.map((action) => action.action_id),
  supported_tool_refs: ExcelToolRegistry.map((tool) => tool.tool_id)
});

runtime.registerCapability({
  capability_id: "strict_replication",
  display_name: "Strict Replication",
  package_name: "@rasid/contracts",
  contract_version: CONTRACT_PACK_VERSION,
  supported_action_refs: StrictActionRegistry.map((action) => action.action_id),
  supported_tool_refs: StrictToolRegistry.map((tool) => tool.tool_id)
});

runtime.registerCapability({
  capability_id: "presentations",
  display_name: "Presentations",
  package_name: "@rasid/contracts",
  contract_version: CONTRACT_PACK_VERSION,
  supported_action_refs: PresentationActionRegistry.map((action) => action.action_id),
  supported_tool_refs: []
});

const canvasManifest = createActionManifest(
  "unified_canvas",
  "1.0.0",
  CanvasActionRegistry,
  ["approval.default"],
  ["evidence.default"]
);
const excelManifest = createActionManifest("excel_engine", "1.0.0", ExcelActionRegistry, ["approval.default"], [
  "evidence.default"
]);
const strictManifest = createActionManifest(
  "strict_replication",
  "1.0.0",
  StrictActionRegistry,
  ["approval.default"],
  ["evidence.default"]
);
const presentationsManifest = createActionManifest(
  "presentations",
  "1.0.0",
  PresentationActionRegistry,
  ["approval.default"],
  ["evidence.default"]
);

runtime.registerManifest(canvasManifest);
runtime.registerManifest(excelManifest);
runtime.registerManifest(strictManifest);
runtime.registerManifest(presentationsManifest);
CanvasToolRegistry.forEach((tool) => runtime.registerTool(tool));
ExcelToolRegistry.forEach((tool) => runtime.registerTool(tool));
StrictToolRegistry.forEach((tool) => runtime.registerTool(tool));
runtime.registerApprovalHook("approval.default", async () => ({
  approval_state: "approved",
  reasons: ["bootstrap_default"]
}));
runtime.registerEvidenceHook("evidence.default", async (pack) => EvidencePackSchema.parse(pack));
registerDashboardCapability(runtime);

const checks = [
  ["artifact", ArtifactSchema],
  ["audit", AuditEventSchema],
  ["brand", TemplateBrandPresetSchema],
  ["canvas", CanvasSessionStateSchema],
  ["connector", SourceSchema],
  ["dashboard", DashboardSchema],
  ["dashboard_version", DashboardVersionSchema],
  ["evidence", EvidencePackSchema],
  ["excel_formula_graph", FormulaGraphStateSchema],
  ["excel_workbook", WorkbookSchema],
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
