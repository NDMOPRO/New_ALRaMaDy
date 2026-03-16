import { z } from "zod";
import {
  ApprovalStateSchema,
  ContractEnvelopeSchema,
  ExecutionOutcomeSchema,
  JsonSchemaRefSchema,
  PermissionScopeSchema,
  PlatformModeSchema,
  TimestampSchema,
  contractEnvelope
} from "./common";

export const AI_SCHEMA_NAMESPACE = "rasid.shared.ai.v1" as const;
export const AI_SCHEMA_VERSION = "1.0.0" as const;
export const AI_CAPABILITY_ID = "rasid_intelligent_operator" as const;

const aiEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(AI_SCHEMA_NAMESPACE),
      schema_version: z.literal(AI_SCHEMA_VERSION)
    })
    .extend(shape);

export const aiSchemaRef = (schemaId: string) =>
  JsonSchemaRefSchema.parse({
    schema_id: schemaId,
    schema_version: AI_SCHEMA_VERSION,
    uri: `schema://ai/${schemaId}/${AI_SCHEMA_VERSION}`
  });

export const AiPagePathSchema = z.enum([
  "/home",
  "/data",
  "/excel",
  "/dashboards",
  "/reports",
  "/presentations",
  "/transcription",
  "/replication",
  "/localization",
  "/library",
  "/governance"
]);

export const AiAgentSchema = z.enum([
  "data_analyst_agent",
  "excel_assistant",
  "dashboard_assistant",
  "reporting_assistant",
  "presentation_assistant",
  "localization_assistant",
  "governance_aware_assistant",
  "document_file_understanding_assistant",
  "replication_aware_assistant"
]);

export const AiOutputKindSchema = z.enum([
  "summary",
  "suggestion_pack",
  "dashboard",
  "report",
  "presentation",
  "spreadsheet",
  "localization",
  "replication"
]);

export const AiPhaseStatusSchema = z.enum(["pending", "running", "completed", "awaiting_approval", "failed", "skipped"]);

export const AiSuggestionSchema = aiEntity({
  suggestion_id: z.string(),
  category: z.enum([
    "analysis",
    "visualization",
    "formula",
    "cleanup",
    "narrative",
    "slide_structure",
    "glossary",
    "verification",
    "next_action",
    "risk_gap"
  ]),
  title: z.string(),
  detail: z.string(),
  confidence: z.number().min(0).max(1),
  proposed_action_ref: z.string().nullable(),
  requires_approval: z.boolean(),
  target_refs: z.array(z.string())
});

export const AiPageContextSchema = aiEntity({
  session_id: z.string(),
  page_path: AiPagePathSchema,
  page_label: z.string(),
  capability_hint: z.string(),
  current_artifact_ref: z.string().nullable(),
  source_refs: z.array(z.string()),
  recent_output_refs: z.array(z.string()),
  permission_scope: PermissionScopeSchema,
  governance_tags: z.array(z.string()),
  memory_scope: z.enum(["page_isolated", "workspace_scoped"])
});

export const AiExecutionRequestSchema = aiEntity({
  request_id: z.string(),
  session_id: z.string(),
  page_path: AiPagePathSchema,
  user_prompt: z.string(),
  requested_mode: PlatformModeSchema.default("advanced"),
  approval_granted: z.boolean().default(false),
  resource_ref: z.string().nullable().default(null),
  resource_refs: z.array(z.string()).default([]),
  context_payload: z.record(z.unknown()).default({})
});

export const AiExecutionPhaseSchema = aiEntity({
  phase_id: z.string(),
  phase_kind: z.enum([
    "context_resolution",
    "intent_analysis",
    "routing",
    "planning",
    "approval_boundary",
    "execution",
    "summary"
  ]),
  status: AiPhaseStatusSchema,
  detail: z.string(),
  selected_capability: z.string().nullable(),
  selected_action_ref: z.string().nullable(),
  selected_tool_ref: z.string().nullable(),
  selected_engine_ref: z.string().nullable(),
  selected_provider_ref: z.string().nullable(),
  selected_model_ref: z.string().nullable(),
  output_refs: z.array(z.string())
});

export const AiExecutionPlanSchema = aiEntity({
  plan_id: z.string(),
  session_id: z.string(),
  page_path: AiPagePathSchema,
  intent: z.string(),
  normalized_prompt: z.string(),
  selected_agent: AiAgentSchema,
  selected_capability: z.string(),
  selected_action_ref: z.string().nullable(),
  selected_tool_ref: z.string().nullable(),
  selected_engine_ref: z.string(),
  selected_provider_ref: z.string(),
  selected_model_ref: z.string(),
  fallback_provider_ref: z.string().nullable(),
  fallback_model_ref: z.string().nullable(),
  approval_required: z.boolean(),
  execution_mode: z.enum(["assistive", "approved_apply"]),
  target_output_kind: AiOutputKindSchema,
  confidence: z.number().min(0).max(1),
  step_refs: z.array(z.string()),
  source_refs: z.array(z.string())
});

export const AiExecutionSummarySchema = aiEntity({
  summary_id: z.string(),
  plan_ref: z.string(),
  job_ref: z.string(),
  outcome: ExecutionOutcomeSchema,
  degrade_classification: z.string().nullable(),
  fallback_used: z.boolean(),
  approval_state: ApprovalStateSchema,
  selected_capability: z.string(),
  selected_action_ref: z.string().nullable(),
  selected_tool_ref: z.string().nullable(),
  selected_engine_ref: z.string().nullable(),
  selected_provider_ref: z.string().nullable(),
  selected_model_ref: z.string().nullable(),
  execution_step_details: z.array(z.string()),
  failure_summaries: z.array(z.string()),
  fallback_reason: z.string().nullable(),
  summary_text: z.string(),
  evidence_refs: z.array(z.string()),
  audit_refs: z.array(z.string()),
  lineage_refs: z.array(z.string()),
  result_artifact_refs: z.array(z.string()),
  suggestions: z.array(AiSuggestionSchema),
  next_action_suggestions: z.array(z.string()),
  generated_at: TimestampSchema
});

export const AI_CONTRACT = contractEnvelope("ai");

export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;
export type AiPagePath = z.infer<typeof AiPagePathSchema>;
export type AiPageContext = z.infer<typeof AiPageContextSchema>;
export type AiExecutionRequest = z.infer<typeof AiExecutionRequestSchema>;
export type AiExecutionPhase = z.infer<typeof AiExecutionPhaseSchema>;
export type AiExecutionPlan = z.infer<typeof AiExecutionPlanSchema>;
export type AiExecutionSummary = z.infer<typeof AiExecutionSummarySchema>;
