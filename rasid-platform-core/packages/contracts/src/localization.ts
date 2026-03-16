import { z } from "zod";
import {
  ContractEnvelopeSchema,
  EditableStatusSchema,
  PlatformModeSchema,
  RecordListSchema,
  StringListSchema,
  TimestampSchema,
  VerificationStatusSchema,
  WarningSchema,
  contractEnvelope
} from "./common";

export const LOCALIZATION_SCHEMA_NAMESPACE = "rasid.shared.localization.v1" as const;
export const LOCALIZATION_SCHEMA_VERSION = "1.0.0" as const;
export const LOCALIZATION_CAPABILITY_ID = "arabic_localization_lct" as const;

const localizationEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(LOCALIZATION_SCHEMA_NAMESPACE),
      schema_version: z.literal(LOCALIZATION_SCHEMA_VERSION)
    })
    .extend(shape);

export const LocalizableArtifactTypeSchema = z.enum(["report", "presentation", "dashboard", "spreadsheet"]);
export const LocalizationRequestStatusSchema = z.enum([
  "requested",
  "language_detected",
  "planning",
  "preview_ready",
  "awaiting_approval",
  "approved",
  "applied",
  "degraded",
  "failed",
  "cancelled"
]);
export const LocalizationPolicyModeSchema = z.enum([
  "strict_localization",
  "smart_localization",
  "pro_localization"
]);
export const LocalizationScopeTypeSchema = z.enum([
  "artifact",
  "page",
  "slide",
  "sheet",
  "section",
  "block",
  "widget",
  "range",
  "selection"
]);
export const SourceLanguageDetectionStrategySchema = z.enum(["auto_detect", "explicit", "mixed_bilingual"]);
export const LayoutDirectionSchema = z.enum(["ltr", "rtl", "mixed", "preserve"]);
export const DirectionTransformationStrategySchema = z.enum([
  "ltr_to_rtl",
  "rtl_to_ltr",
  "preserve_mixed",
  "context_aware"
]);
export const TypographyNumericShapingPolicySchema = z.enum([
  "preserve_source",
  "arabic_indic",
  "latin",
  "context_aware"
]);
export const TypographyLineHeightStrategySchema = z.enum([
  "preserve",
  "expand_for_arabic",
  "compress_for_english",
  "adaptive"
]);
export const BaselineMixingStrategySchema = z.enum(["preserve", "align_to_arabic", "align_to_latin", "adaptive"]);
export const LocalizationPreviewStatusSchema = z.enum(["ready", "ready_with_warnings", "blocked"]);
export const QualityCheckStatusSchema = z.enum(["passed", "passed_with_warnings", "failed"]);
export const BindingIntegrityStatusSchema = z.enum(["preserved", "partially_preserved", "broken"]);
export const LocalizationStageSchema = z.enum([
  "detect_source_language",
  "resolve_terminology_profile",
  "build_localization_plan",
  "transform_language",
  "transform_direction",
  "refine_typography",
  "apply_cultural_formatting",
  "run_quality_gates",
  "publish_output"
]);

export const LocalizationScopeSchema = localizationEntity({
  localization_scope_id: z.string(),
  source_artifact_ref: z.string(),
  source_canonical_ref: z.string(),
  target_artifact_type: LocalizableArtifactTypeSchema,
  scope_type: LocalizationScopeTypeSchema,
  included_node_refs: StringListSchema,
  excluded_node_refs: StringListSchema,
  included_binding_refs: StringListSchema,
  include_layout_transformation: z.boolean(),
  include_typography_refinement: z.boolean(),
  include_cultural_formatting: z.boolean(),
  include_asset_direction_adaptation: z.boolean(),
  preserve_editability: z.boolean()
});

export const TerminologyRuleSchema = localizationEntity({
  terminology_rule_id: z.string(),
  profile_ref: z.string(),
  source_locale: z.string(),
  target_locale: z.string(),
  source_term: z.string(),
  preferred_translation: z.string(),
  banned_translations: StringListSchema,
  rule_class: z.enum([
    "preferred_translation",
    "banned_translation",
    "protected_term",
    "non_translatable",
    "acronym",
    "title",
    "caption"
  ]),
  case_sensitive: z.boolean(),
  applies_to_scope_refs: StringListSchema,
  context_notes: z.string().nullable(),
  priority: z.number().int().nonnegative()
});

export const ProtectedTermSchema = localizationEntity({
  protected_term_id: z.string(),
  profile_ref: z.string(),
  locale: z.string(),
  term: z.string(),
  required_output_term: z.string().nullable(),
  match_strategy: z.enum(["exact", "normalized", "regex"]),
  applies_to_scope_refs: StringListSchema,
  rationale: z.string().nullable()
});

export const NonTranslatableTermSchema = localizationEntity({
  non_translatable_term_id: z.string(),
  profile_ref: z.string(),
  locale: z.string(),
  term: z.string(),
  match_strategy: z.enum(["exact", "normalized", "regex"]),
  preserve_original: z.boolean(),
  applies_to_scope_refs: StringListSchema,
  rationale: z.string().nullable()
});

export const TerminologyProfileSchema = localizationEntity({
  terminology_profile_id: z.string(),
  profile_name: z.string(),
  scope: z.enum(["org", "workspace", "domain", "user", "artifact_override"]),
  source_locale: z.string(),
  target_locale: z.string(),
  default_style: z.enum(["executive", "formal", "government", "technical"]),
  rule_refs: StringListSchema,
  protected_term_refs: StringListSchema,
  non_translatable_term_refs: StringListSchema,
  parent_profile_refs: StringListSchema,
  brand_preset_ref: z.string().nullable(),
  acronym_policy: z.enum(["preserve", "expand_once", "localize_if_defined"]),
  title_policy: z.enum(["localize", "preserve", "conditional"]),
  caption_policy: z.enum(["localize", "preserve", "conditional"])
});

export const LocalizationPolicySchema = localizationEntity({
  localization_policy_id: z.string(),
  policy_name: z.string(),
  capability_id: z.literal(LOCALIZATION_CAPABILITY_ID),
  mode: LocalizationPolicyModeSchema,
  source_language_detection: SourceLanguageDetectionStrategySchema,
  preview_before_apply: z.boolean(),
  approval_required_for_apply: z.boolean(),
  auto_resolve_terminology_profile: z.boolean(),
  apply_direction_transform: z.boolean(),
  apply_typography_refinement: z.boolean(),
  apply_cultural_formatting: z.boolean(),
  preserve_editability: z.boolean(),
  allow_degraded_apply: z.boolean(),
  blocked_on_binding_break: z.boolean(),
  date_policy: z.string(),
  number_policy: z.string(),
  currency_policy: z.string(),
  locale_phrase_policy: z.enum(["literal", "culturally_adapted", "brand_constrained"]),
  numeric_shaping_policy: TypographyNumericShapingPolicySchema
});

export const DirectionTransformationPlanSchema = localizationEntity({
  direction_transformation_plan_id: z.string(),
  request_ref: z.string(),
  source_direction: LayoutDirectionSchema,
  target_direction: LayoutDirectionSchema,
  transformation_strategy: DirectionTransformationStrategySchema,
  target_node_refs: StringListSchema,
  table_transform_rules: RecordListSchema,
  chart_transform_rules: RecordListSchema,
  widget_transform_rules: RecordListSchema,
  asset_transform_rules: RecordListSchema,
  preserved_binding_refs: StringListSchema,
  overflow_risk_refs: StringListSchema,
  manual_review_required: z.boolean()
});

export const TypographyRefinementPlanSchema = localizationEntity({
  typography_refinement_plan_id: z.string(),
  request_ref: z.string(),
  target_node_refs: StringListSchema,
  font_family_priority_refs: StringListSchema,
  fallback_font_refs: StringListSchema,
  line_height_strategy: TypographyLineHeightStrategySchema,
  baseline_mixing_strategy: BaselineMixingStrategySchema,
  numeric_shaping_policy: TypographyNumericShapingPolicySchema,
  clipping_repair_strategy: z.enum(["none", "reflow", "resize", "manual"]),
  preserve_brand_typography: z.boolean(),
  manual_review_required: z.boolean()
});

export const CulturalFormattingPlanSchema = localizationEntity({
  cultural_formatting_plan_id: z.string(),
  request_ref: z.string(),
  target_locale: z.string(),
  target_node_refs: StringListSchema,
  date_format_style: z.string(),
  time_format_style: z.string(),
  number_format_style: z.string(),
  currency_format_style: z.string(),
  decimal_separator: z.string(),
  thousands_separator: z.string(),
  locale_phrase_policy: z.enum(["literal", "culturally_adapted", "brand_constrained"]),
  asset_direction_policy: z.enum([
    "preserve",
    "flip_directional_assets",
    "replace_with_locale_specific_assets"
  ]),
  manual_review_required: z.boolean()
});

export const LocalizationDegradeReasonSchema = localizationEntity({
  localization_degrade_reason_id: z.string(),
  request_ref: z.string(),
  stage: LocalizationStageSchema,
  reason_code: z.string(),
  summary: z.string(),
  detail: z.string(),
  impacted_refs: StringListSchema,
  retryable: z.boolean(),
  repairable: z.boolean(),
  blocks_apply: z.boolean()
});

export const LocalizedOutputMetadataSchema = localizationEntity({
  localized_output_metadata_id: z.string(),
  request_ref: z.string(),
  source_artifact_ref: z.string(),
  localized_artifact_ref: z.string(),
  source_canonical_ref: z.string(),
  localized_canonical_ref: z.string(),
  output_artifact_type: LocalizableArtifactTypeSchema,
  target_locale: z.string(),
  preview_artifact_ref: z.string().nullable(),
  diff_artifact_ref: z.string().nullable(),
  export_artifact_refs: StringListSchema,
  editable_status: EditableStatusSchema,
  binding_integrity_status: BindingIntegrityStatusSchema,
  applied_policy_ref: z.string(),
  applied_terminology_profile_ref: z.string(),
  generated_at: TimestampSchema
});

export const LanguageQualityResultSchema = localizationEntity({
  language_quality_result_id: z.string(),
  request_ref: z.string(),
  status: QualityCheckStatusSchema,
  score: z.number().min(0).max(100),
  untranslated_critical_refs: StringListSchema,
  protected_term_violation_refs: StringListSchema,
  banned_translation_refs: StringListSchema,
  consistency_issue_refs: StringListSchema,
  warning_count: z.number().int().nonnegative()
});

export const LayoutQualityResultSchema = localizationEntity({
  layout_quality_result_id: z.string(),
  request_ref: z.string(),
  status: QualityCheckStatusSchema,
  score: z.number().min(0).max(100),
  clipping_refs: StringListSchema,
  overflow_refs: StringListSchema,
  alignment_issue_refs: StringListSchema,
  hierarchy_issue_refs: StringListSchema,
  mixed_direction_issue_refs: StringListSchema,
  warning_count: z.number().int().nonnegative()
});

export const EditabilityQualityResultSchema = localizationEntity({
  editability_quality_result_id: z.string(),
  request_ref: z.string(),
  status: QualityCheckStatusSchema,
  score: z.number().min(0).max(100),
  non_editable_refs: StringListSchema,
  binding_break_refs: StringListSchema,
  flattened_text_refs: StringListSchema,
  hierarchy_break_refs: StringListSchema,
  repairable_issue_refs: StringListSchema,
  warning_count: z.number().int().nonnegative()
});

export const CulturalQualityResultSchema = localizationEntity({
  cultural_quality_result_id: z.string(),
  request_ref: z.string(),
  status: QualityCheckStatusSchema,
  score: z.number().min(0).max(100),
  date_inconsistency_refs: StringListSchema,
  number_inconsistency_refs: StringListSchema,
  currency_inconsistency_refs: StringListSchema,
  profile_mismatch_refs: StringListSchema,
  asset_direction_issue_refs: StringListSchema,
  warning_count: z.number().int().nonnegative()
});

export const LocalizationQualityResultSchema = localizationEntity({
  localization_quality_result_id: z.string(),
  request_ref: z.string(),
  output_metadata_ref: z.string().nullable(),
  language_quality: LanguageQualityResultSchema,
  layout_quality: LayoutQualityResultSchema,
  editability_quality: EditabilityQualityResultSchema,
  cultural_quality: CulturalQualityResultSchema,
  overall_status: VerificationStatusSchema,
  recommended_action: z.enum(["apply", "apply_with_warnings", "repair_and_recheck", "block_apply"]),
  degrade_reason_refs: StringListSchema
});

export const LocalizationPreviewSchema = localizationEntity({
  localization_preview_id: z.string(),
  request_ref: z.string(),
  preview_artifact_ref: z.string(),
  diff_artifact_ref: z.string().nullable(),
  output_metadata_ref: z.string().nullable(),
  quality_result_ref: z.string().nullable(),
  status: LocalizationPreviewStatusSchema,
  warnings: z.array(WarningSchema),
  degrade_reason_refs: StringListSchema,
  expires_at: TimestampSchema.nullable()
});

export const LocalizationRequestSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(LOCALIZATION_SCHEMA_NAMESPACE),
  schema_version: z.literal(LOCALIZATION_SCHEMA_VERSION),
  localization_request_id: z.string(),
  capability_id: z.literal(LOCALIZATION_CAPABILITY_ID),
  mode: PlatformModeSchema,
  status: LocalizationRequestStatusSchema,
  source_artifact_ref: z.string(),
  source_canonical_ref: z.string(),
  target_artifact_type: LocalizableArtifactTypeSchema,
  target_artifact_ref: z.string().nullable(),
  source_locale: z.string().nullable(),
  target_locale: z.string(),
  source_language_detection: SourceLanguageDetectionStrategySchema,
  localization_scope_ref: z.string(),
  localization_policy_ref: z.string(),
  terminology_profile_ref: z.string(),
  direction_transformation_plan_ref: z.string(),
  typography_refinement_plan_ref: z.string(),
  cultural_formatting_plan_ref: z.string(),
  preview_ref: z.string().nullable(),
  quality_result_ref: z.string().nullable(),
  localized_output_metadata_ref: z.string().nullable(),
  requested_by: z.string(),
  requested_at: TimestampSchema,
  approved_by: z.string().nullable(),
  applied_at: TimestampSchema.nullable()
});

export const LOCALIZATION_CONTRACT = contractEnvelope("localization");

export const validateLocalizationRequest = (input: unknown): LocalizationRequest =>
  LocalizationRequestSchema.parse(input);
export const validateLocalizationPolicy = (input: unknown): LocalizationPolicy =>
  LocalizationPolicySchema.parse(input);
export const validateTerminologyProfile = (input: unknown): TerminologyProfile =>
  TerminologyProfileSchema.parse(input);
export const validateTerminologyRule = (input: unknown): TerminologyRule => TerminologyRuleSchema.parse(input);
export const validateProtectedTerm = (input: unknown): ProtectedTerm => ProtectedTermSchema.parse(input);
export const validateNonTranslatableTerm = (input: unknown): NonTranslatableTerm =>
  NonTranslatableTermSchema.parse(input);
export const validateDirectionTransformationPlan = (input: unknown): DirectionTransformationPlan =>
  DirectionTransformationPlanSchema.parse(input);
export const validateTypographyRefinementPlan = (input: unknown): TypographyRefinementPlan =>
  TypographyRefinementPlanSchema.parse(input);
export const validateCulturalFormattingPlan = (input: unknown): CulturalFormattingPlan =>
  CulturalFormattingPlanSchema.parse(input);
export const validateLocalizationScope = (input: unknown): LocalizationScope => LocalizationScopeSchema.parse(input);
export const validateLocalizationPreview = (input: unknown): LocalizationPreview =>
  LocalizationPreviewSchema.parse(input);
export const validateLocalizationQualityResult = (input: unknown): LocalizationQualityResult =>
  LocalizationQualityResultSchema.parse(input);
export const validateLanguageQualityResult = (input: unknown): LanguageQualityResult =>
  LanguageQualityResultSchema.parse(input);
export const validateLayoutQualityResult = (input: unknown): LayoutQualityResult =>
  LayoutQualityResultSchema.parse(input);
export const validateEditabilityQualityResult = (input: unknown): EditabilityQualityResult =>
  EditabilityQualityResultSchema.parse(input);
export const validateCulturalQualityResult = (input: unknown): CulturalQualityResult =>
  CulturalQualityResultSchema.parse(input);
export const validateLocalizationDegradeReason = (input: unknown): LocalizationDegradeReason =>
  LocalizationDegradeReasonSchema.parse(input);
export const validateLocalizedOutputMetadata = (input: unknown): LocalizedOutputMetadata =>
  LocalizedOutputMetadataSchema.parse(input);

export const LocalizationValidators = {
  localization_request: validateLocalizationRequest,
  localization_policy: validateLocalizationPolicy,
  terminology_profile: validateTerminologyProfile,
  terminology_rule: validateTerminologyRule,
  protected_term: validateProtectedTerm,
  non_translatable_term: validateNonTranslatableTerm,
  direction_transformation_plan: validateDirectionTransformationPlan,
  typography_refinement_plan: validateTypographyRefinementPlan,
  cultural_formatting_plan: validateCulturalFormattingPlan,
  localization_scope: validateLocalizationScope,
  localization_preview: validateLocalizationPreview,
  localization_quality_result: validateLocalizationQualityResult,
  language_quality_result: validateLanguageQualityResult,
  layout_quality_result: validateLayoutQualityResult,
  editability_quality_result: validateEditabilityQualityResult,
  cultural_quality_result: validateCulturalQualityResult,
  localization_degrade_reason: validateLocalizationDegradeReason,
  localized_output_metadata: validateLocalizedOutputMetadata
} as const;

export type LocalizableArtifactType = z.infer<typeof LocalizableArtifactTypeSchema>;
export type LocalizationRequestStatus = z.infer<typeof LocalizationRequestStatusSchema>;
export type LocalizationPolicyMode = z.infer<typeof LocalizationPolicyModeSchema>;
export type LocalizationScopeType = z.infer<typeof LocalizationScopeTypeSchema>;
export type SourceLanguageDetectionStrategy = z.infer<typeof SourceLanguageDetectionStrategySchema>;
export type LayoutDirection = z.infer<typeof LayoutDirectionSchema>;
export type DirectionTransformationStrategy = z.infer<typeof DirectionTransformationStrategySchema>;
export type TypographyNumericShapingPolicy = z.infer<typeof TypographyNumericShapingPolicySchema>;
export type TypographyLineHeightStrategy = z.infer<typeof TypographyLineHeightStrategySchema>;
export type BaselineMixingStrategy = z.infer<typeof BaselineMixingStrategySchema>;
export type LocalizationPreviewStatus = z.infer<typeof LocalizationPreviewStatusSchema>;
export type QualityCheckStatus = z.infer<typeof QualityCheckStatusSchema>;
export type BindingIntegrityStatus = z.infer<typeof BindingIntegrityStatusSchema>;
export type LocalizationStage = z.infer<typeof LocalizationStageSchema>;
export type LocalizationScope = z.infer<typeof LocalizationScopeSchema>;
export type TerminologyRule = z.infer<typeof TerminologyRuleSchema>;
export type ProtectedTerm = z.infer<typeof ProtectedTermSchema>;
export type NonTranslatableTerm = z.infer<typeof NonTranslatableTermSchema>;
export type TerminologyProfile = z.infer<typeof TerminologyProfileSchema>;
export type LocalizationPolicy = z.infer<typeof LocalizationPolicySchema>;
export type DirectionTransformationPlan = z.infer<typeof DirectionTransformationPlanSchema>;
export type TypographyRefinementPlan = z.infer<typeof TypographyRefinementPlanSchema>;
export type CulturalFormattingPlan = z.infer<typeof CulturalFormattingPlanSchema>;
export type LocalizationDegradeReason = z.infer<typeof LocalizationDegradeReasonSchema>;
export type LocalizedOutputMetadata = z.infer<typeof LocalizedOutputMetadataSchema>;
export type LanguageQualityResult = z.infer<typeof LanguageQualityResultSchema>;
export type LayoutQualityResult = z.infer<typeof LayoutQualityResultSchema>;
export type EditabilityQualityResult = z.infer<typeof EditabilityQualityResultSchema>;
export type CulturalQualityResult = z.infer<typeof CulturalQualityResultSchema>;
export type LocalizationQualityResult = z.infer<typeof LocalizationQualityResultSchema>;
export type LocalizationPreview = z.infer<typeof LocalizationPreviewSchema>;
export type LocalizationRequest = z.infer<typeof LocalizationRequestSchema>;
