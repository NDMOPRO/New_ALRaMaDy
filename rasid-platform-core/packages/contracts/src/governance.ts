import { z } from "zod";
import {
  ApprovalPolicySchema,
  ContractEnvelopeSchema,
  JsonSchemaRefSchema,
  PermissionScopeSchema,
  PlatformModeSchema,
  TimestampSchema,
  VersionRefSchema,
  contractEnvelope
} from "./common";

export const GOVERNANCE_CONTRACT = contractEnvelope("governance");
export const GOVERNANCE_SCHEMA_NAMESPACE = "rasid.shared.governance.v1" as const;
export const GOVERNANCE_SCHEMA_VERSION = "1.0.0" as const;
export const GOVERNANCE_CAPABILITY_ID = "governance" as const;

const governanceEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      contract: ContractEnvelopeSchema,
      schema_namespace: z.literal(GOVERNANCE_SCHEMA_NAMESPACE),
      schema_version: z.literal(GOVERNANCE_SCHEMA_VERSION)
    })
    .extend(shape);

export const governanceSchemaRef = (schemaId: string) =>
  JsonSchemaRefSchema.parse({
    schema_id: schemaId,
    schema_version: GOVERNANCE_SCHEMA_VERSION,
    uri: `schema://governance/${schemaId}/${GOVERNANCE_SCHEMA_VERSION}`
  });

export const GovernanceResourceKindSchema = z.enum([
  "dataset",
  "excel",
  "dashboard",
  "report",
  "presentation",
  "replication",
  "localization",
  "ai",
  "library_asset",
  "template",
  "publication",
  "artifact",
  "kpi_definition",
  "role",
  "policy_rule",
  "approval_request",
  "schedule",
  "governance_surface"
]);

export const GovernanceActionKindSchema = z.enum([
  "view",
  "edit",
  "approve",
  "publish",
  "share",
  "delete",
  "schedule",
  "run_ai",
  "run_strict_replication",
  "manage_templates",
  "manage_library",
  "manage_governance",
  "review",
  "create",
  "update"
]);

export const GovernanceSensitivitySchema = z.enum(["public", "internal", "confidential", "restricted"]);
export const GovernanceDecisionSchema = z.enum(["allowed", "denied", "approval_required"]);
export const GovernancePriorityClassSchema = z.enum(["P0", "P1", "P2", "P3", "P4"]);
export const GovernanceApprovalStatusSchema = z.enum(["pending", "in_review", "approved", "rejected"]);

export const GovernancePermissionDefinitionSchema = governanceEntity({
  permission_id: z.string(),
  label: z.string(),
  description: z.string(),
  action: GovernanceActionKindSchema,
  resource_kind: GovernanceResourceKindSchema,
  built_in: z.boolean().default(true)
});

export const GovernanceRoleDefinitionSchema = governanceEntity({
  role_id: z.string(),
  tenant_ref: z.string(),
  name: z.string(),
  description: z.string(),
  built_in: z.boolean().default(false),
  permission_ids: z.array(z.string()),
  permission_scope: PermissionScopeSchema,
  group_refs: z.array(z.string()).default([])
});

export const GovernanceRoleAssignmentSchema = governanceEntity({
  assignment_id: z.string(),
  tenant_ref: z.string(),
  principal_ref: z.string(),
  role_id: z.string(),
  workspace_id: z.string().nullable().default(null),
  asset_ref: z.string().nullable().default(null),
  granted_by: z.string(),
  granted_at: TimestampSchema,
  attributes: z
    .object({
      department: z.string().optional(),
      owner_ref: z.string().optional(),
      sensitivity: GovernanceSensitivitySchema.optional(),
      asset_type: z.string().optional(),
      tenant_ref: z.string().optional()
    })
    .default({})
});

export const GovernancePolicyConditionsSchema = z.object({
  tenant_ref: z.string().optional(),
  workspace_id: z.string().optional(),
  department: z.string().optional(),
  data_sensitivity: GovernanceSensitivitySchema.optional(),
  resource_kind: GovernanceResourceKindSchema.optional(),
  action: GovernanceActionKindSchema.optional(),
  owner_ref: z.string().optional(),
  asset_type: z.string().optional(),
  require_2fa: z.boolean().optional(),
  ip_prefix: z.string().optional()
});

export const GovernancePolicyRuleSchema = governanceEntity({
  policy_id: z.string(),
  tenant_ref: z.string(),
  name: z.string(),
  description: z.string(),
  priority: z.number().int().nonnegative(),
  effect: z.enum(["allow", "deny", "require_approval"]),
  enabled: z.boolean().default(true),
  conditions: GovernancePolicyConditionsSchema,
  reason_template: z.string()
});

export const GovernancePolicyDecisionSchema = governanceEntity({
  decision_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  actor_ref: z.string(),
  action_id: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  resource_ref: z.string(),
  decision: GovernanceDecisionSchema,
  matched_role_ids: z.array(z.string()),
  matched_policy_ids: z.array(z.string()),
  missing_permissions: z.array(z.string()),
  reasons: z.array(z.string()),
  evaluated_at: TimestampSchema,
  priority_class: GovernancePriorityClassSchema,
  mode: PlatformModeSchema,
  evidence_required: z.boolean().default(true)
});

export const GovernanceApprovalStageSchema = z.object({
  stage_id: z.string(),
  label: z.string(),
  approver_role_ids: z.array(z.string()),
  minimum_approvals: z.number().int().positive()
});

export const GovernanceApprovalWorkflowSchema = governanceEntity({
  workflow_id: z.string(),
  tenant_ref: z.string(),
  name: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  action_id: z.string(),
  stages: z.array(GovernanceApprovalStageSchema).min(1),
  active: z.boolean().default(true)
});

export const GovernanceApprovalDecisionEntrySchema = z.object({
  actor_ref: z.string(),
  decision: z.enum(["reviewed", "approved", "rejected"]),
  note: z.string(),
  timestamp: TimestampSchema
});

export const GovernanceApprovalRecordSchema = governanceEntity({
  approval_id: z.string(),
  tenant_ref: z.string(),
  workflow_id: z.string(),
  action_id: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  resource_ref: z.string(),
  requested_by: z.string(),
  requested_at: TimestampSchema,
  status: GovernanceApprovalStatusSchema,
  stage_index: z.number().int().nonnegative(),
  decisions: z.array(GovernanceApprovalDecisionEntrySchema),
  boundary_label: z.string()
});

export const GovernanceVersionRecordSchema = governanceEntity({
  version_record_id: z.string(),
  tenant_ref: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  resource_ref: z.string(),
  version_ref: VersionRefSchema,
  previous_version_id: z.string().nullable(),
  change_summary: z.string(),
  downstream_refs: z.array(z.string()),
  protected_downstream: z.boolean().default(false),
  created_at: TimestampSchema
});

export const GovernanceDiffArtifactSchema = governanceEntity({
  diff_id: z.string(),
  tenant_ref: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  left_ref: z.string(),
  right_ref: z.string(),
  summary: z.string(),
  changed_fields: z.array(z.string()),
  generated_at: TimestampSchema
});

export const GovernanceReplayBundleSchema = governanceEntity({
  replay_id: z.string(),
  tenant_ref: z.string(),
  action_id: z.string(),
  execution_id: z.string(),
  input_hash: z.string(),
  output_refs: z.array(z.string()),
  evidence_refs: z.array(z.string()),
  artifact_refs: z.array(z.string()),
  bundle_ref: z.string(),
  generated_at: TimestampSchema
});

export const GovernanceSemanticDimensionSchema = z.object({
  dimension_id: z.string(),
  label: z.string(),
  hierarchy_levels: z.array(z.string()),
  modeling_rule: z.string()
});

export const GovernanceKpiTargetSchema = z.object({
  label: z.string(),
  target_value: z.number(),
  unit: z.string()
});

export const GovernanceKpiChangeEntrySchema = z.object({
  changed_at: TimestampSchema,
  changed_by: z.string(),
  summary: z.string(),
  version_id: z.string()
});

export const GovernanceKpiDefinitionSchema = governanceEntity({
  kpi_id: z.string(),
  tenant_ref: z.string(),
  name: z.string(),
  formula: z.string(),
  owner_ref: z.string(),
  scope_ref: z.string(),
  targets: z.array(GovernanceKpiTargetSchema),
  sensitivity: GovernanceSensitivitySchema,
  semantic_definition: z.object({
    aggregation_rule: z.string(),
    hierarchy_levels: z.array(z.string()),
    dimensions: z.array(GovernanceSemanticDimensionSchema)
  }),
  change_history: z.array(GovernanceKpiChangeEntrySchema),
  approval_workflow_id: z.string().nullable(),
  current_version_id: z.string()
});

export const GovernanceLibraryRecordSchema = governanceEntity({
  asset_id: z.string(),
  tenant_ref: z.string(),
  library_kind: z.enum(["shared", "tenant"]),
  owner_ref: z.string(),
  asset_type: z.string(),
  version_id: z.string(),
  dependency_refs: z.array(z.string()),
  downstream_refs: z.array(z.string()),
  approval_required: z.boolean(),
  notifications: z.array(z.string()),
  branding_policy_ref: z.string().nullable(),
  theme_policy_ref: z.string().nullable()
});

export const GovernanceEvidenceAttachmentSchema = z.object({
  attachment_id: z.string(),
  attached_at: TimestampSchema,
  kind: z.string(),
  ref: z.string(),
  summary: z.record(z.unknown())
});

export const GovernanceEvidenceRecordSchema = governanceEntity({
  evidence_id: z.string(),
  tenant_ref: z.string(),
  action_id: z.string(),
  resource_ref: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: TimestampSchema,
  closed_at: TimestampSchema.nullable(),
  context: z.record(z.unknown()),
  summary: z.record(z.unknown()),
  attachments: z.array(GovernanceEvidenceAttachmentSchema),
  closure: z.record(z.unknown()).nullable()
});

export const GovernanceRegistryEntrySchema = governanceEntity({
  registry_id: z.string(),
  capability_id: z.string(),
  action_id: z.string(),
  tool_id: z.string().nullable(),
  route_path: z.string().nullable(),
  required_permissions: z.array(z.string()),
  evidence_required: z.boolean(),
  async_mode: z.enum(["sync", "async"]),
  strict_profile: z.string(),
  mutating: z.boolean(),
  resource_kind: GovernanceResourceKindSchema
});

export const GovernancePromptThreatSchema = z.object({
  type: z.enum(["injection", "jailbreak", "data_extraction", "role_manipulation"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  pattern: z.string(),
  position: z.number().int().nonnegative()
});

export const GovernancePromptScanSchema = governanceEntity({
  scan_id: z.string(),
  tenant_ref: z.string(),
  action_id: z.string(),
  actor_ref: z.string(),
  prompt_excerpt: z.string(),
  sanitized_excerpt: z.string(),
  safe: z.boolean(),
  risk_score: z.number().min(0).max(100),
  requires_human_review: z.boolean(),
  threats: z.array(GovernancePromptThreatSchema),
  scanned_at: TimestampSchema
});

export const GovernanceComplianceIssueSchema = z.object({
  issue_id: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.string(),
  field_refs: z.array(z.string()),
  rule_ref: z.string(),
  description: z.string(),
  suggested_action: z.string()
});

export const GovernanceComplianceRecordSchema = governanceEntity({
  check_id: z.string(),
  tenant_ref: z.string(),
  action_id: z.string(),
  actor_ref: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  resource_ref: z.string(),
  status: z.enum(["compliant", "needs_review", "blocked"]),
  score: z.number().int().min(0).max(100),
  regulations: z.array(z.string()),
  issue_count: z.number().int().nonnegative(),
  issues: z.array(GovernanceComplianceIssueSchema),
  checked_at: TimestampSchema,
  summary: z.record(z.unknown())
});

export const GovernanceQueueControlSchema = governanceEntity({
  queue_id: z.string(),
  tenant_ref: z.string(),
  action_id: z.string(),
  priority_class: GovernancePriorityClassSchema,
  concurrent_limit: z.number().int().positive(),
  fallback_policy: z.string(),
  pressure_state: z.enum(["normal", "constrained", "degraded"]),
  last_updated_at: TimestampSchema
});

export const GovernanceSecuritySurfaceSchema = governanceEntity({
  surface_id: z.string(),
  tenant_ref: z.string(),
  auth_mode: z.string(),
  password_policy: z.object({
    minimum_length: z.number().int().positive(),
    require_uppercase: z.boolean(),
    require_numeric: z.boolean()
  }),
  session_policy: z.object({
    max_idle_minutes: z.number().int().positive(),
    ip_pinning: z.boolean(),
    require_2fa_for_sensitive_actions: z.boolean()
  }),
  rate_limit: z.object({
    window_seconds: z.number().int().positive(),
    max_requests: z.number().int().positive()
  }),
  backup_policy: z.object({
    enabled: z.boolean(),
    cadence: z.string(),
    disaster_recovery_tier: z.string()
  })
});

export const GovernanceExecutionEnvelopeSchema = governanceEntity({
  execution_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  actor_ref: z.string(),
  page_path: z.string(),
  action_id: z.string(),
  resource_kind: GovernanceResourceKindSchema,
  resource_ref: z.string(),
  requested_mode: PlatformModeSchema,
  approval_policy: ApprovalPolicySchema,
  priority_class: GovernancePriorityClassSchema,
  source_refs: z.array(z.string()),
  target_refs: z.array(z.string()),
  started_at: TimestampSchema,
  finished_at: TimestampSchema.nullable()
});

export type GovernancePermissionDefinition = z.infer<typeof GovernancePermissionDefinitionSchema>;
export type GovernanceResourceKind = z.infer<typeof GovernanceResourceKindSchema>;
export type GovernancePriorityClass = z.infer<typeof GovernancePriorityClassSchema>;
export type GovernanceRoleDefinition = z.infer<typeof GovernanceRoleDefinitionSchema>;
export type GovernanceRoleAssignment = z.infer<typeof GovernanceRoleAssignmentSchema>;
export type GovernancePolicyRule = z.infer<typeof GovernancePolicyRuleSchema>;
export type GovernancePolicyDecision = z.infer<typeof GovernancePolicyDecisionSchema>;
export type GovernanceApprovalWorkflow = z.infer<typeof GovernanceApprovalWorkflowSchema>;
export type GovernanceApprovalRecord = z.infer<typeof GovernanceApprovalRecordSchema>;
export type GovernanceVersionRecord = z.infer<typeof GovernanceVersionRecordSchema>;
export type GovernanceDiffArtifact = z.infer<typeof GovernanceDiffArtifactSchema>;
export type GovernanceReplayBundle = z.infer<typeof GovernanceReplayBundleSchema>;
export type GovernanceKpiDefinition = z.infer<typeof GovernanceKpiDefinitionSchema>;
export type GovernanceLibraryRecord = z.infer<typeof GovernanceLibraryRecordSchema>;
export type GovernanceEvidenceAttachment = z.infer<typeof GovernanceEvidenceAttachmentSchema>;
export type GovernanceEvidenceRecord = z.infer<typeof GovernanceEvidenceRecordSchema>;
export type GovernanceRegistryEntry = z.infer<typeof GovernanceRegistryEntrySchema>;
export type GovernancePromptThreat = z.infer<typeof GovernancePromptThreatSchema>;
export type GovernancePromptScan = z.infer<typeof GovernancePromptScanSchema>;
export type GovernanceComplianceIssue = z.infer<typeof GovernanceComplianceIssueSchema>;
export type GovernanceComplianceRecord = z.infer<typeof GovernanceComplianceRecordSchema>;
export type GovernanceQueueControl = z.infer<typeof GovernanceQueueControlSchema>;
export type GovernanceSecuritySurface = z.infer<typeof GovernanceSecuritySurfaceSchema>;
export type GovernanceExecutionEnvelope = z.infer<typeof GovernanceExecutionEnvelopeSchema>;
