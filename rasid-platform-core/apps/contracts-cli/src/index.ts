import fs from "node:fs";
import { startDashboardWebApp } from "./dashboard-web";
import { startTranscriptionWebApp } from "./transcription-web";
import { registerAiCapability } from "@rasid/ai-engine";
import { ArtifactSchema } from "@rasid/artifacts";
import { registerArabicLocalizationLctCapability } from "@rasid/arabic-localization-lct-engine";
import { AuditEventSchema } from "@rasid/audit-lineage";
import { TemplateBrandPresetSchema } from "@rasid/brand-template";
import { CONTRACT_PACK_VERSION, CONTRACT_VERSIONS } from "@rasid/common";
import { registerGovernanceCapability } from "@rasid/governance-engine";
import {
  dispatchDashboardAction,
  dispatchDashboardTool,
  registerDashboardCapability,
  startDashboardPublicationService
} from "@rasid/dashboard-engine";
import { registerPresentationsCapability } from "@rasid/presentations-engine";
import {
  dispatchReportAction,
  dispatchReportTool,
  registerReportCapability,
  startReportPublicationService
} from "@rasid/report-engine";
import {
  dispatchTranscriptionAction,
  dispatchTranscriptionTool,
  registerTranscriptionCapability
} from "@rasid/transcription-extraction-engine";
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
  StrictActionRegistry,
  StrictToolRegistry,
  UnifiedContentBundleSchema,
  WorkbookSchema
} from "@rasid/contracts";
import { TenantPermissionSchema } from "@rasid/permissions";
import { PublicationSchema } from "@rasid/output-publication";

const runtime = new RegistryBootstrap();

const readCommandPayload = (source?: string): unknown => {
  if (source && source !== "-") {
    return JSON.parse(fs.readFileSync(source, "utf8"));
  }
  if (!process.stdin.isTTY) {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  }
  throw new Error("Command payload must be provided via file path or stdin.");
};

const command = process.argv[2];
const runCommand = async (): Promise<boolean> => {
  if (command === "dashboard-dispatch-action") {
    const envelope = readCommandPayload(process.argv[3]) as { action_id: string; payload: unknown; storage_dir?: string };
    console.log(JSON.stringify(dispatchDashboardAction(envelope), null, 2));
    return true;
  }
  if (command === "dashboard-dispatch-tool") {
    const envelope = readCommandPayload(process.argv[3]) as { tool_id: string; payload: unknown; storage_dir?: string };
    console.log(JSON.stringify(dispatchDashboardTool(envelope), null, 2));
    return true;
  }
  if (command === "dashboard-serve-publications") {
    console.log(JSON.stringify(startDashboardPublicationService(), null, 2));
    setInterval(() => undefined, 60_000);
    return true;
  }
  if (command === "dashboard-serve-web") {
    console.log(JSON.stringify(startDashboardWebApp(), null, 2));
    setInterval(() => undefined, 60_000);
    return true;
  }
  if (command === "report-dispatch-action") {
    const envelope = readCommandPayload(process.argv[3]) as { action_id: string; payload: unknown; storage_dir?: string };
    console.log(JSON.stringify(await dispatchReportAction(envelope), null, 2));
    return true;
  }
  if (command === "report-dispatch-tool") {
    const envelope = readCommandPayload(process.argv[3]) as { tool_id: string; payload: unknown; storage_dir?: string };
    console.log(JSON.stringify(await dispatchReportTool(envelope), null, 2));
    return true;
  }
  if (command === "report-serve-publications") {
    const payload = process.argv[3] ? (readCommandPayload(process.argv[3]) as { storage_dir?: string }) : {};
    console.log(JSON.stringify(startReportPublicationService({ storageDir: payload.storage_dir }), null, 2));
    setInterval(() => undefined, 60_000);
    return true;
  }
  if (command === "report-start-platform") {
    const payload = process.argv[3] ? (readCommandPayload(process.argv[3]) as { port?: number; host?: string }) : {};
    const { startReportPlatformServer } = await import("../../../packages/report-engine/dist/platform.js");
    console.log(JSON.stringify(await startReportPlatformServer(payload), null, 2));
    setInterval(() => undefined, 60_000);
    return true;
  }
  if (command === "presentations-serve-app") {
    const payload = process.argv[3] ? (readCommandPayload(process.argv[3]) as { port?: number; host?: string }) : {};
    const { startPresentationPlatformServer } = await import("../../../packages/presentations-engine/dist/platform.js");
    console.log(JSON.stringify(await startPresentationPlatformServer(payload), null, 2));
    setInterval(() => undefined, 60_000);
    return true;
  }
  if (command === "transcription-dispatch-action") {
    const envelope = readCommandPayload(process.argv[3]) as { action_id: string; payload: unknown; storage_dir?: string };
    console.log(JSON.stringify(await dispatchTranscriptionAction(envelope), null, 2));
    return true;
  }
  if (command === "transcription-dispatch-tool") {
    const envelope = readCommandPayload(process.argv[3]) as { tool_id: string; payload: unknown; storage_dir?: string };
    console.log(JSON.stringify(await dispatchTranscriptionTool(envelope), null, 2));
    return true;
  }
  if (command === "transcription-serve-web") {
    const payload = process.argv[3] ? (readCommandPayload(process.argv[3]) as { port?: number; host?: string; storage_dir?: string }) : {};
    console.log(JSON.stringify(startTranscriptionWebApp(payload), null, 2));
    setInterval(() => undefined, 60_000);
    return true;
  }
  return false;
};

const bootstrapRuntime = (): void => {
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
  runtime.registerManifest(canvasManifest);
  runtime.registerManifest(excelManifest);
  runtime.registerManifest(strictManifest);
  CanvasToolRegistry.forEach((tool) => runtime.registerTool(tool));
  ExcelToolRegistry.forEach((tool) => runtime.registerTool(tool));
  StrictToolRegistry.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.default", async () => ({
    approval_state: "approved",
    reasons: ["bootstrap_default"]
  }));
  runtime.registerEvidenceHook("evidence.default", async (pack) => EvidencePackSchema.parse(pack));
  registerGovernanceCapability(runtime);
  registerAiCapability(runtime);
  registerArabicLocalizationLctCapability(runtime);
  registerDashboardCapability(runtime);
  registerPresentationsCapability(runtime);
  registerReportCapability(runtime);
  registerTranscriptionCapability(runtime);

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
    ["publication", PublicationSchema],
    ["transcription_bundle", UnifiedContentBundleSchema]
  ] as const;

  console.log("rasid shared executable foundation");
  console.log(`contracts=${Object.keys(CONTRACT_VERSIONS).length}`);
  console.log(`actions=${runtime.listActions().length}`);
  console.log(`capabilities=${runtime.listCapabilities().length}`);
  console.log(`tool-registry-bootstrap=${runtime.listTools().length}`);
  console.log(`schemas-loaded=${checks.length}`);
  console.log(`contract-envelope=${contractEnvelope("artifact").namespace}`);
};

void runCommand()
  .then((handled) => {
    if (!handled) {
      bootstrapRuntime();
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
