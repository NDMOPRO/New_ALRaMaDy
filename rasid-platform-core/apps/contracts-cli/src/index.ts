import {
  ActionRegistry,
  ArtifactSchema,
  JobLifecycleSchema,
  EvidenceStatusSchema,
  AuditEventSchema,
  LibraryAssetSchema,
  TemplateBrandPresetSchema,
  CanvasSessionStateSchema,
  SourceSchema,
  ExecutionOutcomeSchema,
  TenantPermissionContractSchema,
  PublicationSchema
} from "@rasid/shared-contracts";

const checks = [
  ["artifact", ArtifactSchema],
  ["job", JobLifecycleSchema],
  ["evidence", EvidenceStatusSchema],
  ["audit", AuditEventSchema],
  ["library", LibraryAssetSchema],
  ["template", TemplateBrandPresetSchema],
  ["canvas", CanvasSessionStateSchema],
  ["source", SourceSchema],
  ["degrade", ExecutionOutcomeSchema],
  ["tenant_permission", TenantPermissionContractSchema],
  ["publication", PublicationSchema]
] as const;

console.log("rasid-platform-core contracts bootstrap");
console.log(`action registry size=${ActionRegistry.length}`);
console.log(`contracts loaded=${checks.length}`);
