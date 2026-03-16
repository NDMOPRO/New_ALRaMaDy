import { z } from "zod";
import {
  ContractEnvelopeSchema,
  ExecutionOutcomeSchema,
  ExportRefSchema,
  LocalizedTextSchema,
  PlatformModeSchema,
  RecordListSchema,
  StringListSchema,
  TimestampSchema,
  VerificationStatusSchema,
  VersionRefSchema,
  contractEnvelope
} from "./common";

export const PRESENTATION_SCHEMA_NAMESPACE = "rasid.shared.presentations.v1" as const;
export const PRESENTATION_SCHEMA_VERSION = "1.0.0" as const;

const presentationEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(PRESENTATION_SCHEMA_NAMESPACE),
      schema_version: z.literal(PRESENTATION_SCHEMA_VERSION)
    })
    .extend(shape);

export const PresentationStatusSchema = z.enum([
  "draft",
  "outlining",
  "storyboarding",
  "binding",
  "review",
  "approved",
  "published",
  "archived",
  "degraded"
]);
export const PresentationRequestTypeSchema = z.enum([
  "prompt_to_deck",
  "source_to_deck",
  "theme_match",
  "report_to_deck",
  "dashboard_to_deck",
  "infographic_only"
]);
export const PresentationSourcePolicySchema = z.enum([
  "use_all_sources",
  "prefer_structured_sources",
  "prefer_uploaded_assets",
  "strict_explicit_sources"
]);
export const PresentationExportTargetSchema = z.enum(["reader", "pptx", "pdf", "html"]);
export const DeckVersionSourceSchema = z.enum([
  "manual_edit",
  "ai_generate",
  "slide_regeneration",
  "data_refresh",
  "template_retheme",
  "source_rebuild"
]);
export const PresentationStalenessStatusSchema = z.enum(["live", "partially_live", "snapshot", "stale", "broken"]);
export const SlideBlockKindSchema = z.enum([
  "title",
  "body",
  "chart",
  "table",
  "metric_card",
  "infographic",
  "grouped_infographic",
  "image",
  "icon",
  "video",
  "callout",
  "quote",
  "agenda"
]);
export const TemplateLockModeSchema = z.enum(["unlocked", "soft_lock", "strict_lock"]);
export const MotionLevelSchema = z.enum(["none", "subtle", "moderate", "high"]);
export const MotionEffectKindSchema = z.enum(["entrance", "emphasis", "exit", "path", "transition"]);
export const MediaBlockKindSchema = z.enum(["image", "icon", "video", "audio"]);
export const InfographicLayoutKindSchema = z.enum([
  "timeline",
  "process",
  "comparison",
  "hierarchy",
  "pyramid",
  "cycle",
  "flow",
  "matrix",
  "roadmap",
  "statistic_panel"
]);
export const GroupedInfographicKindSchema = z.enum(["comparison_set", "process_flow", "mixed_story", "stat_cluster"]);
export const RtlPolicySchema = z.enum(["auto", "rtl", "ltr"]);
export const SpeakerNotesFormatSchema = z.enum(["plain_text", "structured_brief", "presenter_cues"]);
export const ValidationCheckTypeSchema = z.enum([
  "text_editability",
  "chart_editability",
  "table_editability",
  "overflow",
  "clipping",
  "rtl",
  "template_lock",
  "layout_parity",
  "notes_presence",
  "media_reference_integrity"
]);
export const PresentationDegradeSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const DeckOutlineNodeSchema = presentationEntity({
  outline_node_id: z.string(),
  parent_node_ref: z.string().nullable(),
  title: z.array(LocalizedTextSchema),
  narrative_role: z.string(),
  source_refs: StringListSchema,
  target_slide_count: z.number().int().nonnegative(),
  strict_insert: z.boolean(),
  child_node_refs: StringListSchema
});

export const PresentationIntentManifestSchema = presentationEntity({
  intent_id: z.string(),
  request_type: PresentationRequestTypeSchema,
  source_refs: StringListSchema,
  template_ref: z.string().nullable(),
  audience: z.string(),
  tone: z.string(),
  language: z.string(),
  target_slide_count: z.number().int().positive(),
  density: z.enum(["light", "balanced", "dense"]),
  strict_insert_requests: StringListSchema,
  data_binding_intent: z.string(),
  export_targets: z.array(PresentationExportTargetSchema),
  source_policy: PresentationSourcePolicySchema,
  rtl_policy: RtlPolicySchema,
  motion_level: MotionLevelSchema,
  notes_policy: z.enum(["auto_generate", "manual_only", "disabled"]),
  mode: PlatformModeSchema,
  workspace_preset_ref: z.string().nullable(),
  brand_preset_ref: z.string().nullable(),
  created_at: TimestampSchema
});

export const DeckOutlineSchema = presentationEntity({
  outline_id: z.string(),
  deck_ref: z.string().nullable(),
  intent_ref: z.string(),
  outline_nodes: z.array(DeckOutlineNodeSchema),
  narrative_arc: z.string(),
  must_include_refs: StringListSchema,
  estimated_slide_count: z.number().int().positive(),
  source_refs: StringListSchema
});

export const TemplateLockStateSchema = presentationEntity({
  template_lock_state_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  template_ref: z.string(),
  lock_mode: TemplateLockModeSchema,
  locked_slide_refs: StringListSchema,
  locked_block_refs: StringListSchema,
  locked_style_refs: StringListSchema,
  override_allowed: z.boolean(),
  override_actor_refs: StringListSchema,
  last_applied_at: TimestampSchema.nullable()
});

export const InfographicBlockPlanSchema = presentationEntity({
  infographic_block_plan_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  block_ref: z.string(),
  layout_kind: InfographicLayoutKindSchema,
  narrative_goal: z.string(),
  metric_refs: StringListSchema,
  source_refs: StringListSchema,
  icon_refs: StringListSchema,
  chart_binding_refs: StringListSchema,
  step_refs: StringListSchema,
  canonical_node_ref: z.string().nullable(),
  editable_region_refs: StringListSchema
});

export const MediaBlockPlanSchema = presentationEntity({
  media_block_plan_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  block_ref: z.string(),
  media_kind: MediaBlockKindSchema,
  asset_ref: z.string(),
  source_ref: z.string().nullable(),
  fit_policy: z.enum(["contain", "cover", "original", "stretch"]),
  start_at_ms: z.number().int().nonnegative().nullable(),
  end_at_ms: z.number().int().nonnegative().nullable(),
  autoplay: z.boolean(),
  loop: z.boolean(),
  caption: z.string().nullable(),
  canonical_node_ref: z.string().nullable()
});

export const GroupedInfographicPlanSchema = presentationEntity({
  grouped_infographic_plan_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  block_ref: z.string(),
  group_kind: GroupedInfographicKindSchema,
  item_refs: StringListSchema,
  layout_rules: RecordListSchema,
  source_refs: StringListSchema,
  canonical_node_ref: z.string().nullable()
});

export const SlideBlockSchema = presentationEntity({
  slide_block_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  block_kind: SlideBlockKindSchema,
  order_index: z.number().int().nonnegative(),
  title: z.array(LocalizedTextSchema),
  body: z.array(LocalizedTextSchema),
  canonical_node_ref: z.string().nullable(),
  binding_refs: StringListSchema,
  infographic_block_plan_ref: z.string().nullable(),
  media_block_plan_ref: z.string().nullable(),
  grouped_infographic_plan_ref: z.string().nullable(),
  template_lock_state_ref: z.string().nullable(),
  editability: z.enum(["editable", "template_locked", "approval_locked"]),
  generated_by: z.enum(["manual", "template", "ai_assisted", "data_bound"]),
  block_metadata: z.record(z.unknown())
});

export const SpeakerNotesSchema = presentationEntity({
  speaker_notes_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  format: SpeakerNotesFormatSchema,
  content: z.array(LocalizedTextSchema),
  note_refs: StringListSchema,
  source_refs: StringListSchema,
  ai_generated: z.boolean(),
  presenter_duration_seconds: z.number().int().nonnegative().nullable()
});

export const MotionStepSchema = presentationEntity({
  motion_step_id: z.string(),
  target_ref: z.string(),
  effect_kind: MotionEffectKindSchema,
  preset_ref: z.string(),
  duration_ms: z.number().int().nonnegative(),
  delay_ms: z.number().int().nonnegative(),
  trigger: z.enum(["on_click", "with_previous", "after_previous"]),
  direction: z.string().nullable()
});

export const MotionMetadataSchema = presentationEntity({
  motion_metadata_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  motion_level: MotionLevelSchema,
  transition_style: z.string(),
  transition_duration_ms: z.number().int().nonnegative(),
  respects_template_lock: z.boolean(),
  steps: z.array(MotionStepSchema)
});

export const PresentationDataBindingSchema = presentationEntity({
  binding_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  slide_ref: z.string(),
  target_block_ref: z.string(),
  target_node_ref: z.string(),
  dataset_ref: z.string(),
  query_ref: z.string(),
  field_mappings: RecordListSchema,
  snapshot_version_ref: z.string().nullable(),
  last_refresh_at: TimestampSchema.nullable()
});

export const PresentationBindingSetSchema = presentationEntity({
  presentation_binding_set_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  source_artifact_refs: StringListSchema,
  dataset_binding_refs: StringListSchema,
  bindings: z.array(PresentationDataBindingSchema),
  staleness_status: PresentationStalenessStatusSchema,
  refresh_policy: z.object({
    refresh_mode: z.enum(["manual", "scheduled", "event_driven"]),
    selective_regeneration_enabled: z.boolean(),
    stale_after_minutes: z.number().int().nonnegative().nullable()
  }),
  selective_regeneration_refs: StringListSchema,
  broken_binding_refs: StringListSchema,
  last_refresh_at: TimestampSchema.nullable()
});

export const StoryboardSlidePlanSchema = presentationEntity({
  storyboard_slide_plan_id: z.string(),
  deck_ref: z.string().nullable(),
  intent_ref: z.string(),
  outline_node_ref: z.string().nullable(),
  slide_order: z.number().int().nonnegative(),
  slide_title: z.array(LocalizedTextSchema),
  layout_ref: z.string(),
  content_spec: z.record(z.unknown()),
  block_plan_refs: StringListSchema,
  source_refs: StringListSchema,
  binding_refs: StringListSchema,
  speaker_notes_intent: z.string(),
  rtl_policy: RtlPolicySchema,
  editability_flags: z.object({
    default_editable: z.boolean(),
    locked_block_refs: StringListSchema
  }),
  parity_expectations: StringListSchema
});

export const ExportValidationCheckSchema = presentationEntity({
  validation_check_id: z.string(),
  check_type: ValidationCheckTypeSchema,
  target: PresentationExportTargetSchema,
  passed: z.boolean(),
  severity: PresentationDegradeSeveritySchema,
  detail: z.string(),
  impacted_refs: StringListSchema
});

export const ExportValidationResultSchema = presentationEntity({
  export_validation_result_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  export_target: PresentationExportTargetSchema,
  export_ref: z.string().nullable(),
  verification_status: VerificationStatusSchema,
  checks: z.array(ExportValidationCheckSchema),
  text_remains_text: z.boolean(),
  charts_remain_charts: z.boolean(),
  tables_remain_editable: z.boolean(),
  overflow_detected: z.boolean(),
  clipping_detected: z.boolean(),
  rtl_verified: z.boolean(),
  template_lock_verified: z.boolean(),
  validated_at: TimestampSchema
});

export const PresentationDegradeReasonSchema = presentationEntity({
  presentation_degrade_reason_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  reason_code: z.string(),
  summary: z.string(),
  detail: z.string(),
  severity: PresentationDegradeSeveritySchema,
  affected_targets: z.array(PresentationExportTargetSchema),
  impacted_refs: StringListSchema,
  editable_path_impacted: z.boolean(),
  publish_allowed: z.boolean()
});

export const RenderParityValidationSchema = presentationEntity({
  render_parity_validation_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  reader_ref: z.string().nullable(),
  export_validation_refs: StringListSchema,
  results: z.array(ExportValidationResultSchema),
  checks: z.array(ExportValidationCheckSchema),
  overall_status: VerificationStatusSchema,
  publish_ready: z.boolean(),
  degrade_reason_refs: StringListSchema,
  degrade_reasons: z.array(PresentationDegradeReasonSchema),
  validated_at: TimestampSchema
});

export const PresentationOutputMetadataSchema = presentationEntity({
  presentation_output_metadata_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  preview_ref: z.string().nullable(),
  export_refs: z.array(ExportRefSchema),
  publication_refs: StringListSchema,
  parity_validation_ref: z.string().nullable(),
  latest_reader_publication_ref: z.string().nullable(),
  delivered_targets: z.array(PresentationExportTargetSchema),
  editable_export_default: z.boolean(),
  explicit_non_editable_targets: z.array(PresentationExportTargetSchema),
  last_validated_at: TimestampSchema.nullable()
});

export const DeckVersionSchema = presentationEntity({
  deck_version_id: z.string(),
  deck_ref: z.string(),
  version_ref: VersionRefSchema,
  change_reason: z.string(),
  created_from: DeckVersionSourceSchema,
  slide_refs: StringListSchema,
  speaker_notes_refs: StringListSchema,
  motion_metadata_refs: StringListSchema,
  binding_set_ref: z.string(),
  template_lock_state_ref: z.string(),
  outline_ref: z.string(),
  storyboard_refs: StringListSchema,
  parity_validation_ref: z.string().nullable(),
  output_metadata_ref: z.string().nullable(),
  created_by: z.string(),
  created_at: TimestampSchema
});

export const DeckAggregateSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(PRESENTATION_SCHEMA_NAMESPACE),
  schema_version: z.literal(PRESENTATION_SCHEMA_VERSION),
  deck_id: z.string(),
  artifact_ref: z.string(),
  canonical_ref: z.string(),
  current_version_ref: z.string(),
  intent_ref: z.string(),
  outline_ref: z.string(),
  current_storyboard_refs: StringListSchema,
  binding_set_ref: z.string(),
  template_lock_state_ref: z.string(),
  current_output_metadata_ref: z.string().nullable(),
  current_parity_validation_ref: z.string().nullable(),
  mode: PlatformModeSchema,
  deck_kind: z.string(),
  audience: z.string(),
  language: z.string(),
  rtl: z.boolean(),
  status: PresentationStatusSchema,
  template_ref: z.string().nullable(),
  brand_preset_ref: z.string().nullable(),
  publication_refs: StringListSchema,
  owner_ref: z.string(),
  created_by: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const PresentationOutputStatusSchema = presentationEntity({
  output_status_id: z.string(),
  deck_ref: z.string(),
  version_ref: z.string(),
  target: PresentationExportTargetSchema,
  outcome: ExecutionOutcomeSchema,
  export_validation_result_ref: z.string().nullable(),
  degrade_reason_ref: z.string().nullable(),
  updated_at: TimestampSchema
});

export const PRESENTATION_CONTRACT = contractEnvelope("presentation");

export const validatePresentationIntentManifest = (input: unknown): PresentationIntentManifest =>
  PresentationIntentManifestSchema.parse(input);
export const validateDeckOutline = (input: unknown): DeckOutline => DeckOutlineSchema.parse(input);
export const validateStoryboardSlidePlan = (input: unknown): StoryboardSlidePlan =>
  StoryboardSlidePlanSchema.parse(input);
export const validateDeckAggregate = (input: unknown): DeckAggregate => DeckAggregateSchema.parse(input);
export const validateDeckVersion = (input: unknown): DeckVersion => DeckVersionSchema.parse(input);
export const validatePresentationBindingSet = (input: unknown): PresentationBindingSet =>
  PresentationBindingSetSchema.parse(input);
export const validateSpeakerNotes = (input: unknown): SpeakerNotes => SpeakerNotesSchema.parse(input);
export const validateMotionMetadata = (input: unknown): MotionMetadata => MotionMetadataSchema.parse(input);
export const validateInfographicBlockPlan = (input: unknown): InfographicBlockPlan =>
  InfographicBlockPlanSchema.parse(input);
export const validateMediaBlockPlan = (input: unknown): MediaBlockPlan => MediaBlockPlanSchema.parse(input);
export const validateGroupedInfographicPlan = (input: unknown): GroupedInfographicPlan =>
  GroupedInfographicPlanSchema.parse(input);
export const validateSlideBlock = (input: unknown): SlideBlock => SlideBlockSchema.parse(input);
export const validateTemplateLockState = (input: unknown): TemplateLockState => TemplateLockStateSchema.parse(input);
export const validateRenderParityValidation = (input: unknown): RenderParityValidation =>
  RenderParityValidationSchema.parse(input);
export const validateExportValidationResult = (input: unknown): ExportValidationResult =>
  ExportValidationResultSchema.parse(input);
export const validatePresentationDegradeReason = (input: unknown): PresentationDegradeReason =>
  PresentationDegradeReasonSchema.parse(input);
export const validatePresentationOutputMetadata = (input: unknown): PresentationOutputMetadata =>
  PresentationOutputMetadataSchema.parse(input);

export const PresentationValidators = {
  presentation_intent_manifest: validatePresentationIntentManifest,
  deck_outline: validateDeckOutline,
  storyboard_slide_plan: validateStoryboardSlidePlan,
  deck_aggregate: validateDeckAggregate,
  deck_version: validateDeckVersion,
  presentation_binding_set: validatePresentationBindingSet,
  speaker_notes: validateSpeakerNotes,
  motion_metadata: validateMotionMetadata,
  infographic_block_plan: validateInfographicBlockPlan,
  media_block_plan: validateMediaBlockPlan,
  grouped_infographic_plan: validateGroupedInfographicPlan,
  slide_block: validateSlideBlock,
  template_lock_state: validateTemplateLockState,
  render_parity_validation: validateRenderParityValidation,
  export_validation_result: validateExportValidationResult,
  presentation_degrade_reason: validatePresentationDegradeReason,
  presentation_output_metadata: validatePresentationOutputMetadata
} as const;

export type DeckOutlineNode = z.infer<typeof DeckOutlineNodeSchema>;
export type PresentationIntentManifest = z.infer<typeof PresentationIntentManifestSchema>;
export type DeckOutline = z.infer<typeof DeckOutlineSchema>;
export type TemplateLockState = z.infer<typeof TemplateLockStateSchema>;
export type InfographicBlockPlan = z.infer<typeof InfographicBlockPlanSchema>;
export type MediaBlockPlan = z.infer<typeof MediaBlockPlanSchema>;
export type GroupedInfographicPlan = z.infer<typeof GroupedInfographicPlanSchema>;
export type SlideBlock = z.infer<typeof SlideBlockSchema>;
export type SpeakerNotes = z.infer<typeof SpeakerNotesSchema>;
export type MotionStep = z.infer<typeof MotionStepSchema>;
export type MotionMetadata = z.infer<typeof MotionMetadataSchema>;
export type PresentationDataBinding = z.infer<typeof PresentationDataBindingSchema>;
export type PresentationBindingSet = z.infer<typeof PresentationBindingSetSchema>;
export type StoryboardSlidePlan = z.infer<typeof StoryboardSlidePlanSchema>;
export type ExportValidationCheck = z.infer<typeof ExportValidationCheckSchema>;
export type ExportValidationResult = z.infer<typeof ExportValidationResultSchema>;
export type PresentationDegradeReason = z.infer<typeof PresentationDegradeReasonSchema>;
export type RenderParityValidation = z.infer<typeof RenderParityValidationSchema>;
export type PresentationOutputMetadata = z.infer<typeof PresentationOutputMetadataSchema>;
export type DeckVersion = z.infer<typeof DeckVersionSchema>;
export type DeckAggregate = z.infer<typeof DeckAggregateSchema>;
export type PresentationOutputStatus = z.infer<typeof PresentationOutputStatusSchema>;
