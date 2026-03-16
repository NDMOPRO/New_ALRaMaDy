import { z } from "zod";
import {
  ApprovalStateSchema,
  ContractEnvelopeSchema,
  LocalizedTextSchema,
  PlatformModeSchema,
  RecordListSchema,
  StringListSchema,
  TimestampSchema,
  VersionRefSchema,
  contractEnvelope
} from "./common";

export const REPORT_SCHEMA_NAMESPACE = "rasid.shared.report.v1" as const;
export const REPORT_SCHEMA_VERSION = "1.0.0" as const;
export const REPORT_CAPABILITY_ID = "reports" as const;

export const reportSchemaRef = (schemaId: string) => ({
  schema_id: schemaId,
  schema_version: REPORT_SCHEMA_VERSION,
  uri: `schema://${schemaId}/${REPORT_SCHEMA_VERSION}`
});

const reportEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(REPORT_SCHEMA_NAMESPACE),
      schema_version: z.literal(REPORT_SCHEMA_VERSION)
    })
    .extend(shape);

export const ReportStatusSchema = z.enum([
  "draft",
  "binding",
  "review",
  "approved",
  "published",
  "archived",
  "degraded"
]);

export const ReportDraftStateSchema = z.enum(["draft", "ready_for_review", "changes_requested", "finalized"]);
export const ReportSectionKindSchema = z.enum([
  "cover",
  "executive_summary",
  "table_of_contents",
  "body",
  "appendix",
  "footnotes"
]);
export const ReportBlockTypeSchema = z.enum([
  "cover",
  "executive_summary",
  "narrative",
  "table",
  "chart",
  "metric_card",
  "commentary",
  "infographic_plan",
  "appendix",
  "toc"
]);
export const ReportStalenessStatusSchema = z.enum(["live", "partially_live", "snapshot", "stale", "broken"]);
export const ReportReviewStatusSchema = z.enum(["draft", "in_review", "changes_requested", "reviewed"]);
export const ReportCompareKindSchema = z.enum(["version_to_version", "period_to_period", "dataset_to_dataset"]);
export const ReportVersionSourceSchema = z.enum([
  "manual_edit",
  "dataset_refresh",
  "template_rebuild",
  "period_compare",
  "external_pattern_rebuild"
]);

export const ReportLayoutRegionSchema = reportEntity({
  region_id: z.string(),
  region_name: z.string(),
  anchor_ref: z.string(),
  placement_rules: RecordListSchema,
  lock_policy: z.enum(["editable", "soft_lock", "strict_lock"])
});

export const ReportLayoutSchema = reportEntity({
  layout_id: z.string(),
  report_ref: z.string(),
  version_ref: z.string(),
  template_ref: z.string(),
  brand_preset_ref: z.string(),
  page_size: z.enum(["a4", "a3", "letter", "legal", "custom"]),
  orientation: z.enum(["portrait", "landscape"]),
  page_margin_profile: z.string(),
  toc_enabled: z.boolean(),
  appendix_enabled: z.boolean(),
  region_refs: z.array(z.string()),
  regions: z.array(ReportLayoutRegionSchema),
  layout_metadata: RecordListSchema
});

export const ReportContentBlockSchema = reportEntity({
  block_id: z.string(),
  report_ref: z.string(),
  version_ref: z.string(),
  section_ref: z.string(),
  block_type: ReportBlockTypeSchema,
  order_index: z.number().int().nonnegative(),
  title: z.array(LocalizedTextSchema),
  canonical_node_ref: z.string().nullable(),
  binding_refs: StringListSchema,
  citation_refs: StringListSchema,
  lineage_refs: StringListSchema,
  content_payload: z.record(z.unknown()),
  editability: z.enum(["editable", "template_locked", "approval_locked"]),
  generated_by: z.enum(["manual", "template", "ai_assisted", "data_bound"])
});

export const ReportSectionSchema = reportEntity({
  section_id: z.string(),
  report_ref: z.string(),
  version_ref: z.string(),
  parent_section_ref: z.string().nullable(),
  section_kind: ReportSectionKindSchema,
  title: z.array(LocalizedTextSchema),
  order_index: z.number().int().nonnegative(),
  block_refs: StringListSchema,
  child_section_refs: StringListSchema,
  layout_ref: z.string(),
  page_anchor_ref: z.string().nullable(),
  citation_refs: StringListSchema,
  visibility_state: z.enum(["visible", "hidden"]),
  lock_policy: z.enum(["editable", "soft_lock", "strict_lock"])
});

export const ReportDataBindingSchema = reportEntity({
  binding_id: z.string(),
  dataset_ref: z.string(),
  query_ref: z.string(),
  target_node_ref: z.string(),
  target_block_ref: z.string(),
  field_mappings: RecordListSchema,
  snapshot_version_ref: z.string().nullable(),
  last_refresh_at: TimestampSchema.nullable()
});

export const ReportBindingSetSchema = reportEntity({
  binding_set_id: z.string(),
  report_ref: z.string(),
  version_ref: z.string(),
  source_artifact_refs: StringListSchema,
  dataset_binding_refs: StringListSchema,
  bindings: z.array(ReportDataBindingSchema),
  staleness_status: ReportStalenessStatusSchema,
  refresh_policy: z.object({
    refresh_mode: z.enum(["manual", "scheduled", "event_driven"]),
    selective_regeneration_enabled: z.boolean(),
    stale_after_minutes: z.number().int().nonnegative().nullable()
  }),
  selective_regeneration_refs: StringListSchema,
  broken_binding_refs: StringListSchema,
  last_refresh_at: TimestampSchema.nullable()
});

export const ReportReviewStateSchema = reportEntity({
  review_state_id: z.string(),
  report_ref: z.string(),
  version_ref: z.string(),
  state: ReportReviewStatusSchema,
  reviewer_refs: StringListSchema,
  review_comment_refs: StringListSchema,
  latest_comment: z.string().nullable(),
  last_reviewed_at: TimestampSchema.nullable()
});

export const ReportApprovalStateSchema = reportEntity({
  approval_state_id: z.string(),
  report_ref: z.string(),
  version_ref: z.string(),
  state: ApprovalStateSchema,
  approver_ref: z.string().nullable(),
  decision_comment: z.string().nullable(),
  decided_at: TimestampSchema.nullable()
});

export const ReportDiffMetadataSchema = reportEntity({
  diff_id: z.string(),
  report_ref: z.string(),
  base_version_ref: z.string(),
  target_version_ref: z.string(),
  compare_kind: ReportCompareKindSchema,
  changed_section_refs: StringListSchema,
  changed_table_refs: StringListSchema,
  changed_chart_refs: StringListSchema,
  changed_metric_refs: StringListSchema,
  added_refs: StringListSchema,
  removed_refs: StringListSchema,
  summary: z.string(),
  diff_artifact_ref: z.string().nullable()
});

export const ReportVersionSchema = reportEntity({
  report_version_id: z.string(),
  report_ref: z.string(),
  version_ref: VersionRefSchema,
  change_reason: z.string(),
  created_from: ReportVersionSourceSchema,
  draft_state: ReportDraftStateSchema,
  review_state_ref: z.string(),
  approval_state_ref: z.string(),
  diff_base_version_ref: z.string().nullable(),
  section_refs: StringListSchema,
  layout_ref: z.string(),
  content_block_refs: StringListSchema,
  binding_set_ref: z.string(),
  created_by: z.string(),
  created_at: TimestampSchema
});

export const ReportSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(REPORT_SCHEMA_NAMESPACE),
  schema_version: z.literal(REPORT_SCHEMA_VERSION),
  report_id: z.string(),
  artifact_ref: z.string(),
  canonical_ref: z.string(),
  current_version_ref: z.string(),
  report_type: z.string(),
  mode: PlatformModeSchema,
  status: ReportStatusSchema,
  template_ref: z.string(),
  brand_preset_ref: z.string(),
  binding_set_ref: z.string(),
  review_state_ref: z.string(),
  approval_state_ref: z.string(),
  layout_ref: z.string(),
  section_refs: StringListSchema,
  schedule_refs: StringListSchema,
  publication_refs: StringListSchema,
  owner_ref: z.string(),
  created_by: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const REPORT_CONTRACT = contractEnvelope("report");

export const validateReport = (input: unknown): Report => ReportSchema.parse(input);
export const validateReportVersion = (input: unknown): ReportVersion => ReportVersionSchema.parse(input);
export const validateReportSection = (input: unknown): ReportSection => ReportSectionSchema.parse(input);
export const validateReportLayout = (input: unknown): ReportLayout => ReportLayoutSchema.parse(input);
export const validateReportContentBlock = (input: unknown): ReportContentBlock =>
  ReportContentBlockSchema.parse(input);
export const validateReportBindingSet = (input: unknown): ReportBindingSet => ReportBindingSetSchema.parse(input);
export const validateReportReviewState = (input: unknown): ReportReviewState => ReportReviewStateSchema.parse(input);
export const validateReportApprovalState = (input: unknown): ReportApprovalState =>
  ReportApprovalStateSchema.parse(input);
export const validateReportDiffMetadata = (input: unknown): ReportDiffMetadata =>
  ReportDiffMetadataSchema.parse(input);

export const ReportValidators = {
  report: validateReport,
  report_version: validateReportVersion,
  report_section: validateReportSection,
  report_layout: validateReportLayout,
  report_content_block: validateReportContentBlock,
  report_binding_set: validateReportBindingSet,
  report_review_state: validateReportReviewState,
  report_approval_state: validateReportApprovalState,
  report_diff_metadata: validateReportDiffMetadata
} as const;

export type Report = z.infer<typeof ReportSchema>;
export type ReportVersion = z.infer<typeof ReportVersionSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportLayout = z.infer<typeof ReportLayoutSchema>;
export type ReportLayoutRegion = z.infer<typeof ReportLayoutRegionSchema>;
export type ReportContentBlock = z.infer<typeof ReportContentBlockSchema>;
export type ReportDataBinding = z.infer<typeof ReportDataBindingSchema>;
export type ReportBindingSet = z.infer<typeof ReportBindingSetSchema>;
export type ReportReviewState = z.infer<typeof ReportReviewStateSchema>;
export type ReportApprovalState = z.infer<typeof ReportApprovalStateSchema>;
export type ReportDiffMetadata = z.infer<typeof ReportDiffMetadataSchema>;
