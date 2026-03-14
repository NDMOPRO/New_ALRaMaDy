import { z } from "zod";
import {
  ContractEnvelopeSchema,
  PermissionScopeSchema,
  PlatformModeSchema,
  RecordListSchema,
  SemverSchema,
  StringListSchema,
  TimestampSchema,
  contractEnvelope
} from "./common";

export const DASHBOARD_SCHEMA_NAMESPACE = "rasid.shared.dashboard.v1" as const;
export const DASHBOARD_SCHEMA_VERSION = "1.0.0" as const;

const dashboardEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(DASHBOARD_SCHEMA_NAMESPACE),
      schema_version: z.literal(DASHBOARD_SCHEMA_VERSION)
    })
    .extend(shape);

export const DashboardWidgetTypeSchema = z.enum([
  "kpi_card",
  "table",
  "bar_chart",
  "line_chart",
  "pie_chart",
  "area_chart",
  "combo_chart",
  "filter",
  "selector",
  "text",
  "image",
  "section"
]);

export const DashboardWidgetDegradeStateSchema = z.enum(["none", "partial", "blocked"]);
export const DashboardBindingRefreshStateSchema = z.enum(["fresh", "stale", "broken"]);
export const DashboardFilterScopeSchema = z.enum(["global", "page", "widget"]);
export const DashboardFilterControlTypeSchema = z.enum(["select", "multi_select", "date_range", "number_range", "search"]);
export const DashboardInteractionTriggerSchema = z.enum([
  "selection",
  "drill_down",
  "drill_across",
  "filter_change",
  "compare_toggle"
]);
export const DashboardInteractionEffectSchema = z.enum(["filter", "highlight", "navigate", "compare"]);
export const DashboardScheduleKindSchema = z.enum(["manual", "hourly", "daily", "weekly", "monthly"]);
export const DashboardRefreshModeSchema = z.enum(["manual", "scheduled", "hybrid"]);
export const DashboardStatusSchema = z.enum(["draft", "active", "published", "archived"]);
export const DashboardPublicationStateSchema = z.enum(["draft", "ready", "published"]);
export const DashboardVersionOriginSchema = z.enum([
  "create",
  "manual_edit",
  "refresh",
  "publish",
  "compare",
  "rollback",
  "duplicate"
]);

export const DashboardGridDefinitionSchema = dashboardEntity({
  columns: z.number().int().positive(),
  row_height: z.number().int().positive(),
  gap: z.number().int().nonnegative()
});

export const DashboardPageSchema = dashboardEntity({
  page_id: z.string(),
  title: z.string(),
  tab_order: z.number().int().nonnegative(),
  default_page: z.boolean(),
  layout_grid: DashboardGridDefinitionSchema,
  widget_refs: StringListSchema,
  filter_refs: StringListSchema
});

export const DashboardLayoutItemSchema = dashboardEntity({
  item_id: z.string(),
  page_id: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  z_index: z.number().int().nonnegative(),
  min_width: z.number().int().positive(),
  min_height: z.number().int().positive(),
  max_width: z.number().int().positive(),
  max_height: z.number().int().positive(),
  container_item_ref: z.string().nullable(),
  locked: z.boolean(),
  responsive_behavior: z.enum(["fixed", "stretch", "content_fit"])
});

export const DashboardBindingSchema = dashboardEntity({
  binding_id: z.string(),
  dataset_ref: z.string(),
  query_ref: z.string(),
  target_widget_ref: z.string(),
  field_mappings: RecordListSchema,
  calculation_refs: StringListSchema,
  refresh_state: DashboardBindingRefreshStateSchema,
  last_refresh_at: TimestampSchema.nullable(),
  warning_codes: StringListSchema
});

export const DashboardWidgetSchema = dashboardEntity({
  widget_id: z.string(),
  page_id: z.string(),
  widget_type: DashboardWidgetTypeSchema,
  title: z.string(),
  subtitle: z.string(),
  binding_refs: StringListSchema,
  layout_item_ref: z.string(),
  style_config: z.record(z.unknown()),
  interaction_refs: StringListSchema,
  editable: z.boolean(),
  warning_codes: StringListSchema,
  degrade_state: DashboardWidgetDegradeStateSchema,
  lineage_ref: z.string()
});

export const DashboardFilterSetSchema = dashboardEntity({
  filter_id: z.string(),
  filter_scope: DashboardFilterScopeSchema,
  title: z.string(),
  control_type: DashboardFilterControlTypeSchema,
  dataset_ref: z.string(),
  field_ref: z.string(),
  default_values: StringListSchema,
  current_values: StringListSchema,
  target_widget_refs: StringListSchema
});

export const DashboardInteractionRuleSchema = dashboardEntity({
  rule_id: z.string(),
  source_widget_ref: z.string(),
  trigger: DashboardInteractionTriggerSchema,
  target_widget_refs: StringListSchema,
  effect: DashboardInteractionEffectSchema,
  payload: z.record(z.unknown()),
  enabled: z.boolean()
});

export const DashboardRefreshPolicySchema = dashboardEntity({
  policy_id: z.string(),
  refresh_mode: DashboardRefreshModeSchema,
  schedule_kind: DashboardScheduleKindSchema,
  schedule_ref: z.string(),
  stale_after_minutes: z.number().int().nonnegative(),
  allow_selective_refresh: z.boolean(),
  last_refresh_at: TimestampSchema.nullable()
});

export const DashboardPublicationMetadataSchema = dashboardEntity({
  publication_state: DashboardPublicationStateSchema,
  visibility_scope: PermissionScopeSchema.shape.visibility,
  publication_refs: StringListSchema,
  embed_enabled: z.boolean(),
  preview_ref: z.string(),
  library_asset_refs: StringListSchema,
  last_published_version_ref: z.string()
});

export const DashboardEditabilitySchema = dashboardEntity({
  allow_widget_add_remove: z.boolean(),
  allow_widget_resize: z.boolean(),
  allow_rebind: z.boolean(),
  soft_lock_refs: StringListSchema,
  hard_lock_refs: StringListSchema
});

export const DashboardSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(DASHBOARD_SCHEMA_NAMESPACE),
  schema_version: z.literal(DASHBOARD_SCHEMA_VERSION),
  dashboard_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  artifact_ref: z.string(),
  canonical_ref: z.string(),
  current_version_ref: z.string(),
  title: z.string(),
  description: z.string(),
  mode: PlatformModeSchema,
  status: DashboardStatusSchema,
  template_ref: z.string(),
  brand_preset_ref: z.string(),
  permission_scope: PermissionScopeSchema,
  source_dataset_refs: StringListSchema,
  pages: z.array(DashboardPageSchema),
  layout_items: z.array(DashboardLayoutItemSchema),
  widgets: z.array(DashboardWidgetSchema),
  bindings: z.array(DashboardBindingSchema),
  filter_sets: z.array(DashboardFilterSetSchema),
  interaction_rules: z.array(DashboardInteractionRuleSchema),
  refresh_policy: DashboardRefreshPolicySchema,
  publication_metadata: DashboardPublicationMetadataSchema,
  version_refs: StringListSchema,
  compare_refs: StringListSchema,
  editability: DashboardEditabilitySchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const DashboardVersionSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(DASHBOARD_SCHEMA_NAMESPACE),
  schema_version: z.literal(DASHBOARD_SCHEMA_VERSION),
  version_id: z.string(),
  dashboard_ref: z.string(),
  parent_version_id: z.string().nullable(),
  version_number: z.number().int().positive(),
  semantic_version: SemverSchema,
  change_summary: z.string(),
  created_from: DashboardVersionOriginSchema,
  created_at: TimestampSchema,
  created_by: z.string(),
  compare_base_version_ref: z.string().nullable(),
  refresh_job_ref: z.string().nullable(),
  publication_state: DashboardPublicationStateSchema,
  stale_binding_count: z.number().int().nonnegative(),
  snapshot_artifact_ref: z.string(),
  snapshot_canonical_ref: z.string()
});

export const DashboardCompareResultSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(DASHBOARD_SCHEMA_NAMESPACE),
  schema_version: z.literal(DASHBOARD_SCHEMA_VERSION),
  compare_id: z.string(),
  dashboard_ref: z.string(),
  base_version_ref: z.string(),
  target_version_ref: z.string(),
  changed_widget_refs: StringListSchema,
  changed_layout_item_refs: StringListSchema,
  changed_filter_refs: StringListSchema,
  summary: z.string(),
  diff_artifact_ref: z.string(),
  created_at: TimestampSchema,
  created_by: z.string()
});

export const DASHBOARD_CONTRACT = contractEnvelope("dashboard");

export const validateDashboard = (input: unknown): Dashboard => DashboardSchema.parse(input);
export const validateDashboardVersion = (input: unknown): DashboardVersion => DashboardVersionSchema.parse(input);
export const validateDashboardCompareResult = (input: unknown): DashboardCompareResult =>
  DashboardCompareResultSchema.parse(input);

export const DashboardValidators = {
  dashboard: validateDashboard,
  dashboard_version: validateDashboardVersion,
  dashboard_compare_result: validateDashboardCompareResult
} as const;

export type Dashboard = z.infer<typeof DashboardSchema>;
export type DashboardPage = z.infer<typeof DashboardPageSchema>;
export type DashboardLayoutItem = z.infer<typeof DashboardLayoutItemSchema>;
export type DashboardBinding = z.infer<typeof DashboardBindingSchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type DashboardFilterSet = z.infer<typeof DashboardFilterSetSchema>;
export type DashboardInteractionRule = z.infer<typeof DashboardInteractionRuleSchema>;
export type DashboardRefreshPolicy = z.infer<typeof DashboardRefreshPolicySchema>;
export type DashboardPublicationMetadata = z.infer<typeof DashboardPublicationMetadataSchema>;
export type DashboardVersion = z.infer<typeof DashboardVersionSchema>;
export type DashboardCompareResult = z.infer<typeof DashboardCompareResultSchema>;
