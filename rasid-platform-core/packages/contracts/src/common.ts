import { z } from "zod";

export const CONTRACT_FAMILY_NAMESPACE = "rasid.shared";
export const CONTRACT_PACK_VERSION = "1.0.0" as const;

export const ContractNameSchema = z.enum([
  "canonical",
  "dashboard",
  "artifact",
  "job",
  "action",
  "excel",
  "tool_registry",
  "evidence",
  "audit",
  "library",
  "mode",
  "degrade",
  "strict",
  "localization",
  "template_brand",
  "permission",
  "source",
  "publication",
  "canvas",
  "report",
  "presentation",
  "schedule",
  "ai",
  "transcription",
  "governance"
]);

export const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
export const TimestampSchema = z.string().min(1);
export const IdentifierSchema = z.string().min(1);
export const StringListSchema = z.array(z.string());
export const RecordListSchema = z.array(z.record(z.unknown()));

export const ContractEnvelopeSchema = z.object({
  namespace: z.string().min(1),
  contract_name: ContractNameSchema,
  contract_version: SemverSchema,
  schema_version: SemverSchema,
  status: z.enum(["draft", "active", "deprecated", "superseded"]),
  owner_ref: z.string().min(1),
  compatibility: z.object({
    backward_compatible: z.boolean(),
    forward_compatible: z.boolean()
  }),
  extension_policy: z.object({
    namespaced_extensions_only: z.boolean(),
    mandatory_field_override_forbidden: z.boolean()
  })
});

export const PlatformModeSchema = z.enum(["easy", "advanced"]);
export const StrictnessModeSchema = z.enum(["strict", "smart", "flex"]);
export const EditableStatusSchema = z.enum(["editable", "partially_editable", "non_editable"]);
export const VerificationStatusSchema = z.enum([
  "unverified",
  "verified",
  "success_with_warnings",
  "degraded",
  "failed"
]);
export const ExecutionOutcomeSchema = z.enum(["success", "success_with_warnings", "degraded", "failed"]);
export const JobStateSchema = z.enum([
  "created",
  "queued",
  "parsing",
  "profiling",
  "planning",
  "awaiting_approval",
  "executing",
  "verifying",
  "completed",
  "degraded",
  "failed",
  "cancelled",
  "partially_completed"
]);
export const ApprovalPolicySchema = z.enum(["never", "conditional", "always"]);
export const ApprovalStateSchema = z.enum(["not_required", "pending", "approved", "rejected"]);
export const MutabilitySchema = z.enum(["read_only", "mutating"]);
export const IdempotencySchema = z.enum(["idempotent", "non_idempotent", "conditionally_idempotent"]);

export const LocalizedTextSchema = z.object({
  value: z.string(),
  locale: z.string(),
  rtl: z.boolean()
});

export const WarningSchema = z.object({
  warning_code: z.string(),
  summary: z.string(),
  detail: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  impacted_refs: StringListSchema
});

export const FailureReasonSchema = z.object({
  reason_code: z.string(),
  summary: z.string(),
  detail: z.string(),
  impacted_refs: StringListSchema,
  retryable: z.boolean()
});

export const MetricSchema = z.object({
  metric_name: z.string(),
  metric_value: z.number(),
  metric_unit: z.string()
});

export const VersionRefSchema = z.object({
  version_id: IdentifierSchema,
  parent_version_id: IdentifierSchema.nullable(),
  version_number: z.number().int().nonnegative(),
  semantic_version: SemverSchema
});

export const StorageRefSchema = z.object({
  storage_id: IdentifierSchema,
  storage_class: z.string(),
  uri: z.string(),
  checksum: z.string(),
  region: z.string()
});

export const PreviewRefSchema = z.object({
  preview_id: IdentifierSchema,
  preview_type: z.enum(["thumbnail", "html_canvas", "image_render", "pdf_preview"]),
  storage_ref: z.string()
});

export const ExportRefSchema = z.object({
  export_id: IdentifierSchema,
  export_type: z.enum(["pdf", "docx", "html", "pptx", "xlsx", "xls", "xlsm", "csv", "png", "json", "zip", "other"]),
  explicit_non_editable: z.boolean(),
  storage_ref: z.string()
});

export const PermissionScopeSchema = z.object({
  visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
  allow_read: z.boolean(),
  allow_write: z.boolean(),
  allow_share: z.boolean(),
  allow_publish: z.boolean(),
  allow_audit_view: z.boolean()
});

export const RetryPolicySchema = z.object({
  max_attempts: z.number().int().positive(),
  strategy: z.enum(["fixed", "exponential"]),
  backoff_ms: z.number().int().nonnegative()
});

export const ResourceProfileSchema = z.object({
  cpu_class: z.string(),
  memory_class: z.string(),
  io_class: z.string(),
  expected_parallelism: z.number().int().positive()
});

export const JsonSchemaRefSchema = z.object({
  schema_id: z.string(),
  schema_version: SemverSchema,
  uri: z.string()
});

export const contractEnvelope = (contractName: z.infer<typeof ContractNameSchema>) =>
  ContractEnvelopeSchema.parse({
    namespace: `${CONTRACT_FAMILY_NAMESPACE}.${contractName}`,
    contract_name: contractName,
    contract_version: CONTRACT_PACK_VERSION,
    schema_version: CONTRACT_PACK_VERSION,
    status: "active",
    owner_ref: "rasid.foundation",
    compatibility: {
      backward_compatible: true,
      forward_compatible: false
    },
    extension_policy: {
      namespaced_extensions_only: true,
      mandatory_field_override_forbidden: true
    }
  });

export const CONTRACT_VERSIONS = {
  canonical: CONTRACT_PACK_VERSION,
  dashboard: CONTRACT_PACK_VERSION,
  artifact: CONTRACT_PACK_VERSION,
  job: CONTRACT_PACK_VERSION,
  action: CONTRACT_PACK_VERSION,
  excel: CONTRACT_PACK_VERSION,
  tool_registry: CONTRACT_PACK_VERSION,
  evidence: CONTRACT_PACK_VERSION,
  audit: CONTRACT_PACK_VERSION,
  library: CONTRACT_PACK_VERSION,
  mode: CONTRACT_PACK_VERSION,
  degrade: CONTRACT_PACK_VERSION,
  strict: CONTRACT_PACK_VERSION,
  localization: CONTRACT_PACK_VERSION,
  template_brand: CONTRACT_PACK_VERSION,
  permission: CONTRACT_PACK_VERSION,
  source: CONTRACT_PACK_VERSION,
  publication: CONTRACT_PACK_VERSION,
  canvas: CONTRACT_PACK_VERSION,
  report: CONTRACT_PACK_VERSION,
  presentation: CONTRACT_PACK_VERSION,
  schedule: CONTRACT_PACK_VERSION,
  ai: CONTRACT_PACK_VERSION,
  transcription: CONTRACT_PACK_VERSION,
  governance: CONTRACT_PACK_VERSION
} as const;

export const assertContractVersion = (contractName: keyof typeof CONTRACT_VERSIONS, version: string): void => {
  if (CONTRACT_VERSIONS[contractName] !== version) {
    throw new Error(
      `Contract version mismatch for ${contractName}: expected ${CONTRACT_VERSIONS[contractName]}, received ${version}`
    );
  }
};

export type ContractEnvelope = z.infer<typeof ContractEnvelopeSchema>;
export type PlatformMode = z.infer<typeof PlatformModeSchema>;
export type Warning = z.infer<typeof WarningSchema>;
export type FailureReason = z.infer<typeof FailureReasonSchema>;
export type PermissionScope = z.infer<typeof PermissionScopeSchema>;
export type JsonSchemaRef = z.infer<typeof JsonSchemaRefSchema>;
export type ExportRef = z.infer<typeof ExportRefSchema>;
export type VersionRef = z.infer<typeof VersionRefSchema>;
