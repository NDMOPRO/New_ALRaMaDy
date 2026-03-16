import { z } from "zod";
import {
  ContractEnvelopeSchema,
  CONTRACT_PACK_VERSION,
  EditableStatusSchema,
  JsonSchemaRefSchema,
  LocalizedTextSchema,
  RecordListSchema,
  StringListSchema,
  TimestampSchema,
  VerificationStatusSchema,
  VersionRefSchema,
  contractEnvelope
} from "./common";

export const STRICT_SCHEMA_NAMESPACE = "rasid.shared.strict.v1" as const;
export const STRICT_SCHEMA_VERSION = CONTRACT_PACK_VERSION;

const strictEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
      schema_version: z.literal(STRICT_SCHEMA_VERSION)
    })
    .extend(shape);

export const StrictSchemaNameSchema = z.enum([
  "cdr_absolute",
  "source_fingerprint",
  "extraction_manifest",
  "deterministic_render_profile",
  "structural_equivalence_result",
  "pixel_equivalence_result",
  "dual_gate_result",
  "repair_trace",
  "round_trip_validation",
  "strict_policy",
  "degrade_reason",
  "strict_output_metadata"
]);

export const StrictSourceKindSchema = z.enum([
  "pdf",
  "document",
  "presentation",
  "spreadsheet",
  "image",
  "screenshot",
  "infographic_image",
  "dashboard_image",
  "report_image",
  "table_image",
  "unknown"
]);

export const StrictTargetKindSchema = z.enum(["docx", "pptx", "xlsx", "dashboard"]);
export const StrictStageSchema = z.enum([
  "classify_source",
  "extract_source",
  "build_cdr_absolute",
  "deterministic_render",
  "structural_gate",
  "pixel_gate",
  "repair_loop",
  "round_trip_validation",
  "publish_strict_output",
  "publish_degraded_output"
]);
export const StrictMismatchClassSchema = z.enum([
  "layout_graph",
  "text_metrics",
  "text_content",
  "font_mapping",
  "vector_shape",
  "image_crop",
  "table_structure",
  "chart_structure",
  "binding_recovery",
  "formula_behavior",
  "pixel_render",
  "unknown"
]);
export const StrictRepairActionTypeSchema = z.enum([
  "adjust_font_mapping",
  "adjust_text_wrapping",
  "normalize_coordinates",
  "normalize_vector_geometry",
  "rebuild_table_grid",
  "rebuild_chart_layout",
  "rebind_live_data",
  "rerender"
]);
export const StrictRepairOutcomeSchema = z.enum(["applied", "rejected", "not_needed"]);
export const StrictTraceStatusSchema = z.enum(["passed", "failed", "degraded", "exhausted"]);
export const StrictPublishStateSchema = z.enum(["blocked", "strict_published", "degraded_published"]);
export const StrictFontFallbackPolicySchema = z.enum(["forbidden", "approved_override_only"]);
export const StrictBindingPolicySchema = z.enum(["preserve_or_fail", "preserve_or_degrade"]);

export const StrictDegradeReasonCodeSchema = z.enum([
  "unsupported_source_type",
  "unsupported_target_type",
  "classification_ambiguous",
  "source_corrupted",
  "ocr_not_reliable",
  "font_metrics_missing",
  "font_substitution_required",
  "vector_structure_missing",
  "table_structure_missing",
  "chart_structure_missing",
  "binding_recovery_failed",
  "formula_recovery_failed",
  "layout_graph_mismatch",
  "structural_gate_failed",
  "pixel_gate_failed",
  "round_trip_failed",
  "editability_not_preserved",
  "deterministic_environment_violation",
  "repair_budget_exhausted"
]);

export const StrictDetectionHintSchema = strictEntity({
  hint_id: z.string(),
  hint_type: z.string(),
  hint_value: z.string(),
  confidence: z.number().min(0).max(1)
});

export const StrictPageFingerprintSchema = strictEntity({
  page_id: z.string(),
  page_index: z.number().int().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.string(),
  rotation_degrees: z.number(),
  visual_hash: z.string(),
  structural_hash: z.string()
});

export const SourceFingerprintSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  fingerprint_id: z.string(),
  source_ref: z.string(),
  source_kind: StrictSourceKindSchema,
  source_media_type: z.string(),
  original_name: z.string(),
  checksum: z.string(),
  byte_size: z.number().int().nonnegative(),
  page_count: z.number().int().nonnegative(),
  dominant_locale: z.string(),
  rtl_detected: z.boolean(),
  color_profile: z.string(),
  page_fingerprints: z.array(StrictPageFingerprintSchema),
  detected_font_refs: StringListSchema,
  detection_hints: z.array(StrictDetectionHintSchema),
  created_at: TimestampSchema
});

export const ExtractionStageSchema = strictEntity({
  stage_id: z.string(),
  stage: StrictStageSchema,
  tool_ref: z.string(),
  required: z.boolean(),
  deterministic: z.boolean(),
  output_refs: StringListSchema,
  warnings: RecordListSchema
});

export const ExtractionManifestSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  manifest_id: z.string(),
  source_fingerprint_ref: z.string(),
  source_ref: z.string(),
  target_kind: StrictTargetKindSchema,
  selected_profile_ref: z.string(),
  extraction_path: z.enum(["native_structural", "pdf_vector_text", "ocr_bitmap", "hybrid"]),
  object_inventory_ref: z.string(),
  table_extraction_refs: StringListSchema,
  chart_extraction_refs: StringListSchema,
  font_metric_fingerprint_refs: StringListSchema,
  binding_recovery_plan_ref: z.string().nullable(),
  stages: z.array(ExtractionStageSchema),
  warnings: StringListSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const DeterministicRenderProfileSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  profile_id: z.string(),
  renderer_family: z.string(),
  renderer_version: z.string(),
  font_set_fingerprint: z.string(),
  locale: z.string(),
  numeral_system: z.string(),
  color_profile: z.literal("sRGB"),
  floating_point_policy: z.string(),
  antialiasing_policy: z.string(),
  dpi: z.number().int().positive(),
  viewport_width: z.number().int().positive(),
  viewport_height: z.number().int().positive(),
  execution_seed: z.string(),
  os_fingerprint: z.string(),
  container_fingerprint: z.string(),
  gpu_allowed: z.boolean(),
  created_at: TimestampSchema
});

export const CDRContainerNodeSchema = strictEntity({
  node_id: z.string(),
  node_kind: z.enum(["container", "group", "frame", "page", "sheet", "slide"]),
  parent_ref: z.string().nullable(),
  child_refs: StringListSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  z_index: z.number().int(),
  transform_matrix: z.array(z.number()),
  lock_flags: StringListSchema
});

export const CDRTextRunNodeSchema = strictEntity({
  node_id: z.string(),
  parent_ref: z.string(),
  text: z.array(LocalizedTextSchema),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  font_family: z.string(),
  font_postscript_name: z.string(),
  font_size: z.number().positive(),
  font_weight: z.number().int().positive(),
  line_height: z.number().positive(),
  letter_spacing: z.number(),
  glyph_hash: z.string(),
  bidi_level: z.number().int().nonnegative(),
  shaping_engine: z.string(),
  style_refs: StringListSchema
});

export const CDRVectorNodeSchema = strictEntity({
  node_id: z.string(),
  parent_ref: z.string(),
  primitive_type: z.enum(["path", "line", "ellipse", "rect", "polygon", "icon"]),
  path_data_hash: z.string(),
  fill_ref: z.string(),
  stroke_ref: z.string(),
  bounding_box: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive()
  }),
  z_index: z.number().int()
});

export const CDRImageNodeSchema = strictEntity({
  node_id: z.string(),
  parent_ref: z.string(),
  image_asset_ref: z.string(),
  checksum: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  crop_ref: z.string().nullable(),
  mask_ref: z.string().nullable(),
  z_index: z.number().int()
});

export const CDRTableNodeSchema = strictEntity({
  node_id: z.string(),
  parent_ref: z.string(),
  row_count: z.number().int().nonnegative(),
  column_count: z.number().int().nonnegative(),
  merged_cell_refs: StringListSchema,
  formula_refs: StringListSchema,
  style_refs: StringListSchema,
  cell_refs: StringListSchema,
  binding_refs: StringListSchema,
  structural_hash: z.string()
});

export const CDRChartNodeSchema = strictEntity({
  node_id: z.string(),
  parent_ref: z.string(),
  chart_type: z.string(),
  series_refs: StringListSchema,
  axis_refs: StringListSchema,
  legend_ref: z.string().nullable(),
  binding_refs: StringListSchema,
  style_refs: StringListSchema,
  structural_hash: z.string()
});

export const CDRControlNodeSchema = strictEntity({
  node_id: z.string(),
  parent_ref: z.string(),
  control_type: z.enum(["filter", "drilldown", "parameter", "navigation"]),
  binding_ref: z.string().nullable(),
  interaction_ref: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const CDRAbsoluteSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  cdr_id: z.string(),
  canonical_ref: z.string(),
  source_fingerprint_ref: z.string(),
  extraction_manifest_ref: z.string(),
  target_kind: StrictTargetKindSchema,
  unit_system: z.string(),
  layout_graph_ref: z.string(),
  structural_hash: z.string(),
  pixel_hash_seed: z.string(),
  deterministic_profile_ref: z.string(),
  snapshot_version_ref: VersionRefSchema,
  editability_status: EditableStatusSchema,
  container_nodes: z.array(CDRContainerNodeSchema),
  text_runs: z.array(CDRTextRunNodeSchema),
  vector_nodes: z.array(CDRVectorNodeSchema),
  image_nodes: z.array(CDRImageNodeSchema),
  table_nodes: z.array(CDRTableNodeSchema),
  chart_nodes: z.array(CDRChartNodeSchema),
  control_nodes: z.array(CDRControlNodeSchema),
  binding_refs: StringListSchema,
  lock_flags: StringListSchema,
  extraction_confidence: z.number().min(0).max(1),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const StructuralCheckResultSchema = strictEntity({
  check_id: z.string(),
  check_name: z.string(),
  passed: z.boolean(),
  details: z.string(),
  impacted_refs: StringListSchema
});

export const StructuralEquivalenceResultSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  result_id: z.string(),
  source_fingerprint_ref: z.string(),
  cdr_ref: z.string(),
  target_artifact_ref: z.string(),
  passed: z.boolean(),
  equivalence_score: z.number().min(0).max(1),
  layout_graph_equal: z.boolean(),
  inventory_equal: z.boolean(),
  hierarchy_equal: z.boolean(),
  text_metrics_equal: z.boolean(),
  table_structure_equal: z.boolean(),
  chart_structure_equal: z.boolean(),
  data_binding_equal: z.boolean(),
  formula_behavior_equal: z.boolean(),
  checks: z.array(StructuralCheckResultSchema),
  mismatch_refs: StringListSchema,
  generated_at: TimestampSchema
});

export const PixelEquivalenceResultSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  result_id: z.string(),
  source_render_ref: z.string(),
  target_render_ref: z.string(),
  deterministic_profile_ref: z.string(),
  passed: z.boolean(),
  pixel_diff_ratio: z.number().min(0),
  diff_pixel_count: z.number().int().nonnegative(),
  mismatch_bbox_count: z.number().int().nonnegative(),
  identical_render_fingerprint: z.boolean(),
  source_pixel_hash: z.string(),
  target_pixel_hash: z.string(),
  diff_artifact_ref: z.string().nullable(),
  generated_at: TimestampSchema
});

export const StrictDegradeReasonSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  reason_id: z.string(),
  reason_code: StrictDegradeReasonCodeSchema,
  stage: StrictStageSchema,
  summary: z.string(),
  detail: z.string(),
  impacted_refs: StringListSchema,
  strict_claim_permitted: z.boolean(),
  retryable: z.boolean(),
  suggested_action_refs: StringListSchema,
  created_at: TimestampSchema
});

export const DualGateResultSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  result_id: z.string(),
  structural_result_ref: z.string(),
  pixel_result_ref: z.string(),
  passed: z.boolean(),
  strict_claim_granted: z.boolean(),
  verification_status: VerificationStatusSchema,
  degrade_reason_refs: StringListSchema,
  checked_at: TimestampSchema
});

export const RepairActionSchema = strictEntity({
  action_id: z.string(),
  action_type: StrictRepairActionTypeSchema,
  target_ref: z.string(),
  parameters: z.record(z.unknown()),
  outcome: StrictRepairOutcomeSchema
});

export const RepairIterationSchema = strictEntity({
  iteration_id: z.string(),
  iteration_index: z.number().int().nonnegative(),
  mismatch_classification: StrictMismatchClassSchema,
  before_structural_result_ref: z.string().nullable(),
  before_pixel_result_ref: z.string().nullable(),
  actions: z.array(RepairActionSchema),
  after_structural_result_ref: z.string().nullable(),
  after_pixel_result_ref: z.string().nullable(),
  completed_at: TimestampSchema
});

export const RepairTraceSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  repair_trace_id: z.string(),
  cdr_ref: z.string(),
  deterministic_profile_ref: z.string(),
  iteration_budget: z.number().int().positive(),
  final_status: StrictTraceStatusSchema,
  iterations: z.array(RepairIterationSchema),
  final_dual_gate_result_ref: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const FunctionalCheckSchema = strictEntity({
  check_id: z.string(),
  check_type: z.enum(["editability", "formula_behavior", "bindings", "filters", "drill_actions", "theme_mapping"]),
  passed: z.boolean(),
  detail: z.string(),
  impacted_refs: StringListSchema
});

export const RoundTripValidationSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  validation_id: z.string(),
  target_artifact_ref: z.string(),
  export_artifact_ref: z.string(),
  rerender_artifact_ref: z.string(),
  deterministic_profile_ref: z.string(),
  structural_result_ref: z.string(),
  pixel_result_ref: z.string(),
  functional_checks: z.array(FunctionalCheckSchema),
  regression_diff_refs: StringListSchema,
  editable_output_verified: z.boolean(),
  passed: z.boolean(),
  validated_at: TimestampSchema
});

export const StrictPolicySchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  policy_id: z.string(),
  policy_name: z.string(),
  require_structural_gate: z.literal(true),
  require_pixel_gate: z.literal(true),
  require_round_trip_validation: z.literal(true),
  require_editable_output: z.literal(true),
  prohibit_silent_degradation: z.literal(true),
  allow_degraded_publish: z.boolean(),
  max_repair_iterations: z.number().int().nonnegative(),
  font_fallback_policy: StrictFontFallbackPolicySchema,
  binding_policy: StrictBindingPolicySchema,
  accepted_target_kinds: z.array(StrictTargetKindSchema),
  renderer_profile_ref: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const StrictOutputMetadataSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(STRICT_SCHEMA_NAMESPACE),
  schema_version: z.literal(STRICT_SCHEMA_VERSION),
  metadata_id: z.string(),
  artifact_ref: z.string(),
  source_fingerprint_ref: z.string(),
  cdr_ref: z.string(),
  target_kind: StrictTargetKindSchema,
  strict_policy_ref: z.string(),
  structural_result_ref: z.string(),
  pixel_result_ref: z.string(),
  dual_gate_result_ref: z.string(),
  repair_trace_ref: z.string().nullable(),
  round_trip_validation_ref: z.string(),
  publish_state: StrictPublishStateSchema,
  degrade_reason_refs: StringListSchema,
  generated_at: TimestampSchema
});

export const STRICT_CONTRACT = contractEnvelope("strict");

export const STRICT_SCHEMA_REFS = {
  cdr_absolute: {
    schema_id: "strict.cdr_absolute",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/cdr_absolute/${STRICT_SCHEMA_VERSION}`
  },
  source_fingerprint: {
    schema_id: "strict.source_fingerprint",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/source_fingerprint/${STRICT_SCHEMA_VERSION}`
  },
  extraction_manifest: {
    schema_id: "strict.extraction_manifest",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/extraction_manifest/${STRICT_SCHEMA_VERSION}`
  },
  deterministic_render_profile: {
    schema_id: "strict.deterministic_render_profile",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/deterministic_render_profile/${STRICT_SCHEMA_VERSION}`
  },
  structural_equivalence_result: {
    schema_id: "strict.structural_equivalence_result",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/structural_equivalence_result/${STRICT_SCHEMA_VERSION}`
  },
  pixel_equivalence_result: {
    schema_id: "strict.pixel_equivalence_result",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/pixel_equivalence_result/${STRICT_SCHEMA_VERSION}`
  },
  dual_gate_result: {
    schema_id: "strict.dual_gate_result",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/dual_gate_result/${STRICT_SCHEMA_VERSION}`
  },
  repair_trace: {
    schema_id: "strict.repair_trace",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/repair_trace/${STRICT_SCHEMA_VERSION}`
  },
  round_trip_validation: {
    schema_id: "strict.round_trip_validation",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/round_trip_validation/${STRICT_SCHEMA_VERSION}`
  },
  strict_policy: {
    schema_id: "strict.strict_policy",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/strict_policy/${STRICT_SCHEMA_VERSION}`
  },
  degrade_reason: {
    schema_id: "strict.degrade_reason",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/degrade_reason/${STRICT_SCHEMA_VERSION}`
  },
  strict_output_metadata: {
    schema_id: "strict.strict_output_metadata",
    schema_version: STRICT_SCHEMA_VERSION,
    uri: `schema://strict/strict_output_metadata/${STRICT_SCHEMA_VERSION}`
  }
} as const satisfies Record<z.infer<typeof StrictSchemaNameSchema>, z.infer<typeof JsonSchemaRefSchema>>;

export const strictSchemaRef = (schemaName: z.infer<typeof StrictSchemaNameSchema>) =>
  JsonSchemaRefSchema.parse(STRICT_SCHEMA_REFS[schemaName]);

export const validateCDRAbsolute = (input: unknown): CDRAbsolute => CDRAbsoluteSchema.parse(input);
export const validateSourceFingerprint = (input: unknown): SourceFingerprint => SourceFingerprintSchema.parse(input);
export const validateExtractionManifest = (input: unknown): ExtractionManifest =>
  ExtractionManifestSchema.parse(input);
export const validateDeterministicRenderProfile = (input: unknown): DeterministicRenderProfile =>
  DeterministicRenderProfileSchema.parse(input);
export const validateStructuralEquivalenceResult = (input: unknown): StructuralEquivalenceResult =>
  StructuralEquivalenceResultSchema.parse(input);
export const validatePixelEquivalenceResult = (input: unknown): PixelEquivalenceResult =>
  PixelEquivalenceResultSchema.parse(input);
export const validateDualGateResult = (input: unknown): DualGateResult => DualGateResultSchema.parse(input);
export const validateRepairTrace = (input: unknown): RepairTrace => RepairTraceSchema.parse(input);
export const validateRoundTripValidation = (input: unknown): RoundTripValidation =>
  RoundTripValidationSchema.parse(input);
export const validateStrictPolicy = (input: unknown): StrictPolicy => StrictPolicySchema.parse(input);
export const validateStrictDegradeReason = (input: unknown): StrictDegradeReason =>
  StrictDegradeReasonSchema.parse(input);
export const validateStrictOutputMetadata = (input: unknown): StrictOutputMetadata =>
  StrictOutputMetadataSchema.parse(input);

export const StrictValidators = {
  cdr_absolute: validateCDRAbsolute,
  source_fingerprint: validateSourceFingerprint,
  extraction_manifest: validateExtractionManifest,
  deterministic_render_profile: validateDeterministicRenderProfile,
  structural_equivalence_result: validateStructuralEquivalenceResult,
  pixel_equivalence_result: validatePixelEquivalenceResult,
  dual_gate_result: validateDualGateResult,
  repair_trace: validateRepairTrace,
  round_trip_validation: validateRoundTripValidation,
  strict_policy: validateStrictPolicy,
  degrade_reason: validateStrictDegradeReason,
  strict_output_metadata: validateStrictOutputMetadata
} as const;

export type StrictSchemaName = z.infer<typeof StrictSchemaNameSchema>;
export type StrictSourceKind = z.infer<typeof StrictSourceKindSchema>;
export type StrictTargetKind = z.infer<typeof StrictTargetKindSchema>;
export type StrictStage = z.infer<typeof StrictStageSchema>;
export type StrictMismatchClass = z.infer<typeof StrictMismatchClassSchema>;
export type StrictRepairActionType = z.infer<typeof StrictRepairActionTypeSchema>;
export type StrictRepairOutcome = z.infer<typeof StrictRepairOutcomeSchema>;
export type StrictTraceStatus = z.infer<typeof StrictTraceStatusSchema>;
export type StrictPublishState = z.infer<typeof StrictPublishStateSchema>;
export type StrictFontFallbackPolicy = z.infer<typeof StrictFontFallbackPolicySchema>;
export type StrictBindingPolicy = z.infer<typeof StrictBindingPolicySchema>;
export type StrictDegradeReasonCode = z.infer<typeof StrictDegradeReasonCodeSchema>;
export type StrictDetectionHint = z.infer<typeof StrictDetectionHintSchema>;
export type StrictPageFingerprint = z.infer<typeof StrictPageFingerprintSchema>;
export type SourceFingerprint = z.infer<typeof SourceFingerprintSchema>;
export type ExtractionStage = z.infer<typeof ExtractionStageSchema>;
export type ExtractionManifest = z.infer<typeof ExtractionManifestSchema>;
export type DeterministicRenderProfile = z.infer<typeof DeterministicRenderProfileSchema>;
export type CDRContainerNode = z.infer<typeof CDRContainerNodeSchema>;
export type CDRTextRunNode = z.infer<typeof CDRTextRunNodeSchema>;
export type CDRVectorNode = z.infer<typeof CDRVectorNodeSchema>;
export type CDRImageNode = z.infer<typeof CDRImageNodeSchema>;
export type CDRTableNode = z.infer<typeof CDRTableNodeSchema>;
export type CDRChartNode = z.infer<typeof CDRChartNodeSchema>;
export type CDRControlNode = z.infer<typeof CDRControlNodeSchema>;
export type CDRAbsolute = z.infer<typeof CDRAbsoluteSchema>;
export type StructuralCheckResult = z.infer<typeof StructuralCheckResultSchema>;
export type StructuralEquivalenceResult = z.infer<typeof StructuralEquivalenceResultSchema>;
export type PixelEquivalenceResult = z.infer<typeof PixelEquivalenceResultSchema>;
export type StrictDegradeReason = z.infer<typeof StrictDegradeReasonSchema>;
export type DualGateResult = z.infer<typeof DualGateResultSchema>;
export type RepairAction = z.infer<typeof RepairActionSchema>;
export type RepairIteration = z.infer<typeof RepairIterationSchema>;
export type RepairTrace = z.infer<typeof RepairTraceSchema>;
export type FunctionalCheck = z.infer<typeof FunctionalCheckSchema>;
export type RoundTripValidation = z.infer<typeof RoundTripValidationSchema>;
export type StrictPolicy = z.infer<typeof StrictPolicySchema>;
export type StrictOutputMetadata = z.infer<typeof StrictOutputMetadataSchema>;
