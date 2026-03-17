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
  "replication",
  "conversational_query",
  "forecast",
  "scenario",
  "recipe",
  "knowledge_graph",
  "classification",
  "guided_questions"
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
    "risk_gap",
    "join_suggestion",
    "kpi_suggestion",
    "comparison_suggestion",
    "data_warning",
    "forecast",
    "scenario",
    "recipe"
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
    "summary",
    "guided_questions",
    "data_classification",
    "proactive_analysis",
    "rag_retrieval",
    "conversational_query",
    "predictive_analysis",
    "recipe_operation"
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

/* ───────────────────────────── RAG Schemas ───────────────────────────── */

export const RagQueryResultSchema = aiEntity({
  query: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  retrieved_chunks: z.array(z.object({
    chunk_id: z.string(),
    document_ref: z.string(),
    content: z.string(),
    similarity_score: z.number(),
    metadata: z.record(z.unknown())
  })),
  context_window: z.string(),
  total_tokens: z.number()
});

/* ───────────────────── Data Classification Schemas ───────────────────── */

export const FileDomainClassificationSchema = aiEntity({
  file_ref: z.string(),
  detected_domain: z.string(),
  confidence: z.number().min(0).max(1),
  secondary_domains: z.array(z.object({ domain: z.string(), confidence: z.number() })),
  evidence: z.array(z.string())
});

export const EntityKeyDetectionSchema = aiEntity({
  file_ref: z.string(),
  entity_keys: z.array(z.object({
    column: z.string(),
    key_type: z.enum(["primary", "foreign", "composite", "natural"]),
    confidence: z.number(),
    referenced_entity: z.string().optional(),
    evidence: z.string()
  }))
});

export const TimeDimensionDetectionSchema = aiEntity({
  file_ref: z.string(),
  time_columns: z.array(z.object({
    column: z.string(),
    granularity: z.enum(["year", "quarter", "month", "week", "day", "hour", "minute", "timestamp"]),
    format_detected: z.string(),
    coverage_pct: z.number(),
    confidence: z.number()
  }))
});

export const SensitiveColumnDetectionSchema = aiEntity({
  file_ref: z.string(),
  sensitive_columns: z.array(z.object({
    column: z.string(),
    sensitivity_type: z.enum(["pii", "financial", "health", "credential", "location", "contact"]),
    pattern_matched: z.string(),
    confidence: z.number(),
    recommendation: z.string()
  }))
});

export const KnowledgeGraphSchema = aiEntity({
  file_ref: z.string(),
  nodes: z.array(z.object({
    node_id: z.string(),
    node_type: z.enum(["entity", "attribute", "metric", "dimension", "relationship"]),
    label: z.string(),
    properties: z.record(z.unknown())
  })),
  edges: z.array(z.object({
    edge_id: z.string(),
    from_node: z.string(),
    to_node: z.string(),
    relationship: z.string(),
    weight: z.number()
  })),
  entity_count: z.number(),
  relationship_count: z.number()
});

export const ExecutiveSummarySchema = aiEntity({
  file_ref: z.string(),
  domain: z.string(),
  row_count: z.number(),
  column_count: z.number(),
  key_findings: z.array(z.string()),
  data_quality_score: z.number().min(0).max(1),
  completeness_pct: z.number(),
  primary_metrics: z.array(z.object({
    name: z.string(),
    value: z.number(),
    interpretation: z.string()
  })),
  risk_flags: z.array(z.string()),
  recommended_actions: z.array(z.string())
});

/* ───────────────────── Proactive AI Schemas ───────────────────── */

export const ProactiveAnalysisSchema = aiEntity({
  file_ref: z.string(),
  join_suggestions: z.array(z.object({
    suggestion_id: z.string(),
    left_file_ref: z.string(),
    right_file_ref: z.string(),
    left_column: z.string(),
    right_column: z.string(),
    join_type: z.enum(["inner", "left", "right", "full"]),
    confidence: z.number(),
    rationale: z.string()
  })),
  cleaning_suggestions: z.array(z.object({
    suggestion_id: z.string(),
    column: z.string(),
    issue_type: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    affected_count: z.number(),
    recommended_action: z.string()
  })),
  kpi_suggestions: z.array(z.object({
    suggestion_id: z.string(),
    kpi_name: z.string(),
    formula: z.string(),
    columns_involved: z.array(z.string()),
    confidence: z.number()
  })),
  comparison_suggestions: z.array(z.object({
    suggestion_id: z.string(),
    comparison_type: z.string(),
    dimension_column: z.string(),
    metric_column: z.string(),
    confidence: z.number()
  })),
  data_warnings: z.array(z.object({
    warning_id: z.string(),
    warning_type: z.string(),
    severity: z.enum(["info", "low", "medium", "high", "critical"]),
    title: z.string(),
    detail: z.string(),
    recommended_fix: z.string()
  }))
});

/* ───────────────────── Conversational Query Schemas ───────────────────── */

export const TirStepSchema = z.object({
  step_id: z.string(),
  step_index: z.number(),
  kind: z.enum([
    "select_columns", "filter_rows", "group_by", "aggregate", "sort",
    "limit", "compute_column", "join", "pivot", "unpivot", "rename", "deduplicate"
  ]),
  description: z.string(),
  params: z.record(z.unknown()),
  input_columns: z.array(z.string()),
  output_columns: z.array(z.string())
});

export const ConversationalQueryResultSchema = aiEntity({
  query_id: z.string(),
  original_query: z.string(),
  tir_plan: z.object({
    plan_id: z.string(),
    query: z.string(),
    normalized_query: z.string(),
    steps: z.array(TirStepSchema),
    source_refs: z.array(z.string()),
    created_at: TimestampSchema
  }),
  result_table: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.record(z.unknown())),
    row_count: z.number(),
    truncated: z.boolean()
  }),
  chart: z.object({
    chart_type: z.enum(["bar", "line", "pie", "scatter", "area", "heatmap", "kpi_card"]),
    title: z.string(),
    x_axis: z.string().optional(),
    y_axis: z.string().optional(),
    series: z.array(z.object({ field: z.string(), label: z.string() })),
    dimension_field: z.string().optional()
  }).optional(),
  explanation: z.object({
    summary: z.string(),
    confidence: z.number().min(0).max(1),
    confidence_rationale: z.string(),
    lineage_refs: z.array(z.string()),
    assumptions: z.array(z.string()),
    caveats: z.array(z.string())
  }),
  executed_at: TimestampSchema
});

/* ───────────────────── Predictive & What-If Schemas ───────────────────── */

export const ForecastResultSchema = aiEntity({
  forecast_id: z.string(),
  file_ref: z.string(),
  metric_column: z.string(),
  time_column: z.string(),
  method: z.enum(["linear_trend", "moving_average", "exponential_smoothing"]),
  historical_points: z.number(),
  forecast_horizon: z.number(),
  forecasted_points: z.array(z.object({
    period_index: z.number(),
    period_label: z.string(),
    predicted_value: z.number(),
    lower_bound: z.number(),
    upper_bound: z.number(),
    confidence: z.number()
  })),
  model_confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  source_refs: z.array(z.string()),
  created_at: TimestampSchema
});

export const ScenarioResultSchema = aiEntity({
  scenario_id: z.string(),
  file_ref: z.string(),
  scenario_name: z.string(),
  parameters: z.array(z.object({
    column: z.string(),
    adjustment_type: z.enum(["absolute", "percentage", "replace"]),
    adjustment_value: z.number(),
    description: z.string()
  })),
  baseline_metrics: z.record(z.number()),
  scenario_metrics: z.record(z.number()),
  delta_metrics: z.record(z.object({ absolute: z.number(), percentage: z.number() })),
  impact_summary: z.string(),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  source_refs: z.array(z.string()),
  created_at: TimestampSchema
});

/* ───────────────────── Recipe / Operation Memory Schemas ───────────────────── */

export const RecipeSchema = aiEntity({
  recipe_id: z.string(),
  current_version: z.number(),
  versions: z.array(z.object({
    version_id: z.string(),
    version_number: z.number(),
    steps: z.array(TirStepSchema),
    metadata: z.object({
      name: z.string(),
      description: z.string(),
      domain: z.string().optional(),
      tags: z.array(z.string()),
      created_by: z.string(),
      tenant_ref: z.string(),
      workspace_id: z.string()
    }),
    created_at: TimestampSchema,
    change_summary: z.string()
  })),
  replay_count: z.number(),
  last_replayed_at: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const RecipeReplayResultSchema = aiEntity({
  replay_id: z.string(),
  recipe_id: z.string(),
  version_used: z.number(),
  file_ref: z.string(),
  steps_executed: z.number(),
  steps_skipped: z.number(),
  skipped_reasons: z.array(z.string()),
  output_columns: z.array(z.string()),
  output_row_count: z.number(),
  replayed_at: TimestampSchema,
  lineage_ref: z.string()
});

/* ───────────────────── Guided Questions Schemas ───────────────────── */

export const GuidedQuestionSetSchema = aiEntity({
  set_id: z.string(),
  trigger_reason: z.string(),
  confidence_before: z.number().min(0).max(1),
  questions: z.array(z.object({
    question_id: z.string(),
    question_text: z.string(),
    question_text_ar: z.string(),
    category: z.enum(["intent_clarification", "scope_selection", "parameter_missing", "ambiguity_resolution", "confirmation"]),
    options: z.array(z.object({ value: z.string(), label: z.string(), label_ar: z.string() })).optional(),
    required: z.boolean(),
    default_value: z.string().optional()
  })),
  context: z.object({
    page_path: z.string(),
    detected_intent: z.string(),
    ambiguous_elements: z.array(z.string())
  }),
  created_at: TimestampSchema
});

export const GuidedResolutionSchema = aiEntity({
  set_id: z.string(),
  resolved_intent: z.string(),
  resolved_params: z.record(z.unknown()),
  confidence_after: z.number().min(0).max(1),
  ready_to_execute: z.boolean()
});

/* ───────────────────── Type Exports ───────────────────── */

export type AiSuggestion = z.infer<typeof AiSuggestionSchema>;
export type AiPagePath = z.infer<typeof AiPagePathSchema>;
export type AiPageContext = z.infer<typeof AiPageContextSchema>;
export type AiExecutionRequest = z.infer<typeof AiExecutionRequestSchema>;
export type AiExecutionPhase = z.infer<typeof AiExecutionPhaseSchema>;
export type AiExecutionPlan = z.infer<typeof AiExecutionPlanSchema>;
export type AiExecutionSummary = z.infer<typeof AiExecutionSummarySchema>;
export type RagQueryResult = z.infer<typeof RagQueryResultSchema>;
export type FileDomainClassification = z.infer<typeof FileDomainClassificationSchema>;
export type EntityKeyDetection = z.infer<typeof EntityKeyDetectionSchema>;
export type TimeDimensionDetection = z.infer<typeof TimeDimensionDetectionSchema>;
export type SensitiveColumnDetection = z.infer<typeof SensitiveColumnDetectionSchema>;
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;
export type ExecutiveSummaryResult = z.infer<typeof ExecutiveSummarySchema>;
export type ProactiveAnalysis = z.infer<typeof ProactiveAnalysisSchema>;
export type ConversationalQueryResult = z.infer<typeof ConversationalQueryResultSchema>;
export type ForecastResult = z.infer<typeof ForecastResultSchema>;
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;
export type RecipeContract = z.infer<typeof RecipeSchema>;
export type RecipeReplayResult = z.infer<typeof RecipeReplayResultSchema>;
export type GuidedQuestionSet = z.infer<typeof GuidedQuestionSetSchema>;
export type GuidedResolution = z.infer<typeof GuidedResolutionSchema>;
