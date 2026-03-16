import { z } from "zod";
import { ActionDefinitionSchema } from "./action";
import { FormulaRefSchema } from "./canonical";
import {
  ContractEnvelopeSchema,
  ExecutionOutcomeSchema,
  JsonSchemaRefSchema,
  PlatformModeSchema,
  RecordListSchema,
  StringListSchema,
  TimestampSchema,
  VersionRefSchema,
  WarningSchema,
  contractEnvelope
} from "./common";
import { ToolRegistrationSchema } from "./tool-registry";

export const EXCEL_SCHEMA_NAMESPACE = "rasid.shared.excel.v1" as const;
export const EXCEL_SCHEMA_VERSION = "1.0.0" as const;

const excelEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
      schema_version: z.literal(EXCEL_SCHEMA_VERSION)
    })
    .extend(shape);

const excelSchemaRef = (schemaId: string) =>
  JsonSchemaRefSchema.parse({
    schema_id: schemaId,
    schema_version: EXCEL_SCHEMA_VERSION,
    uri: `schema://excel_engine/${schemaId}/${EXCEL_SCHEMA_VERSION}`
  });

const createExcelActionDefinition = (input: {
  actionId: string;
  actionName: string;
  inputSchemaId: string;
  outputSchemaId: string;
  requiredPermissions: string[];
  previewSupport: boolean;
  mutability: "read_only" | "mutating";
  idempotency: "idempotent" | "non_idempotent" | "conditionally_idempotent";
  sideEffects: string[];
  evidenceRequirements: string[];
  approvalPolicy: "never" | "conditional" | "always";
}) =>
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: input.actionId,
    action_name: input.actionName,
    capability: "excel_engine",
    input_schema: excelSchemaRef(input.inputSchemaId),
    output_schema: excelSchemaRef(input.outputSchemaId),
    required_permissions: input.requiredPermissions,
    mode_support: { easy: true, advanced: true },
    approval_policy: input.approvalPolicy,
    preview_support: input.previewSupport,
    mutability: input.mutability,
    idempotency: input.idempotency,
    side_effects: input.sideEffects,
    evidence_requirements: input.evidenceRequirements,
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  });

const createExcelToolRegistration = (input: {
  toolId: string;
  actionId: string;
  inputSchemaId: string;
  outputSchemaId: string;
  verificationHooks: string[];
  runtimeDependencies: string[];
  scaleProfile: string;
}) =>
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: input.toolId,
    owner_capability: "excel_engine",
    version: EXCEL_SCHEMA_VERSION,
    input_contract: excelSchemaRef(input.inputSchemaId),
    output_contract: excelSchemaRef(input.outputSchemaId),
    runtime_dependencies: input.runtimeDependencies,
    performance_profile: {
      expected_latency_ms_p50: 450,
      expected_latency_ms_p95: 4000,
      peak_memory_mb: 1024,
      scale_profile: input.scaleProfile
    },
    verification_hooks: input.verificationHooks,
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: input.actionId,
      degrade_reason_codes: ["excel_engine_partial_execution"]
    },
    registration_status: "active"
  });

export const ExcelCellValueTypeSchema = z.enum([
  "blank",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "time",
  "currency",
  "percentage",
  "error",
  "formula"
]);
export const WorksheetVisibilitySchema = z.enum(["visible", "hidden", "very_hidden"]);
export const ExcelRangeKindSchema = z.enum([
  "grid",
  "table",
  "selection",
  "pivot_source",
  "filter_result",
  "formula_spill",
  "header_band"
]);
export const WorkbookStatusSchema = z.enum(["draft", "profiled", "ready", "mutated", "exported", "degraded"]);
export const ExcelStyleScopeSchema = z.enum(["cell", "row", "column", "worksheet", "table", "pivot", "workbook"]);
export const TransformationExecutionStrategySchema = z.enum(["serial", "parallel_stages"]);
export const WorkbookChangeKindSchema = z.enum([
  "import",
  "analysis",
  "transformation",
  "recalculation",
  "pivot_generation",
  "formatting",
  "export"
]);
export const FormulaGraphRecalculationStateSchema = z.enum([
  "idle",
  "dirty",
  "planned",
  "executing",
  "completed",
  "degraded",
  "failed"
]);

export const CellAddressSchema = excelEntity({
  worksheet_ref: z.string(),
  row_index: z.number().int().nonnegative(),
  column_index: z.number().int().nonnegative(),
  a1_ref: z.string()
});

export const RangeAddressSchema = excelEntity({
  start_row_index: z.number().int().nonnegative(),
  end_row_index: z.number().int().nonnegative(),
  start_column_index: z.number().int().nonnegative(),
  end_column_index: z.number().int().nonnegative(),
  a1_ref: z.string()
});

export const WorksheetSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  worksheet_id: z.string(),
  workbook_ref: z.string(),
  name: z.string(),
  sheet_index: z.number().int().nonnegative(),
  visibility: WorksheetVisibilitySchema,
  bounds: z.object({
    row_count: z.number().int().nonnegative(),
    column_count: z.number().int().nonnegative()
  }),
  frozen_pane: z
    .object({
      top_row_count: z.number().int().nonnegative(),
      left_column_count: z.number().int().nonnegative()
    })
    .nullable(),
  hidden_gridlines: z.boolean(),
  table_refs: StringListSchema,
  pivot_refs: StringListSchema,
  merged_cells_refs: StringListSchema,
  named_range_refs: StringListSchema,
  filter_view_refs: StringListSchema,
  row_metadata_refs: StringListSchema,
  column_metadata_refs: StringListSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const RangeSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  range_id: z.string(),
  workbook_ref: z.string(),
  worksheet_ref: z.string(),
  kind: ExcelRangeKindSchema,
  address: RangeAddressSchema,
  cell_refs: StringListSchema,
  semantic_labels: StringListSchema,
  named_range_ref: z.string().nullable(),
  lineage_refs: StringListSchema
});

export const CellMetadataSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  cell_id: z.string(),
  workbook_ref: z.string(),
  worksheet_ref: z.string(),
  address: CellAddressSchema,
  value_type: ExcelCellValueTypeSchema,
  raw_input: z.string().nullable(),
  display_value: z.string().nullable(),
  formula_ref: z.string().nullable(),
  style_ref: z.string().nullable(),
  merged_cells_ref: z.string().nullable(),
  data_validation_ref: z.string().nullable(),
  comment_ref: z.string().nullable(),
  error_code: z.string().nullable(),
  semantic_labels: StringListSchema,
  lineage_refs: StringListSchema,
  last_calculated_at: TimestampSchema.nullable()
});

export const MergedCellsSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  merged_cells_id: z.string(),
  workbook_ref: z.string(),
  worksheet_ref: z.string(),
  anchor_cell_ref: z.string(),
  covered_cell_refs: StringListSchema,
  range_ref: z.string()
});

export const NamedRangeSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  named_range_id: z.string(),
  workbook_ref: z.string(),
  worksheet_ref: z.string().nullable(),
  name: z.string(),
  scope: z.enum(["workbook", "worksheet"]),
  hidden: z.boolean(),
  range_ref: z.string(),
  formula_ref: z.string().nullable()
});

export const PivotValueFieldSchema = excelEntity({
  field_ref: z.string(),
  aggregation: z.enum(["sum", "count", "average", "min", "max", "distinct_count"]),
  number_format_code: z.string().nullable()
});

export const PivotMetadataSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  pivot_id: z.string(),
  workbook_ref: z.string(),
  worksheet_ref: z.string(),
  source_range_ref: z.string(),
  target_range_ref: z.string(),
  cache_ref: z.string(),
  row_field_refs: StringListSchema,
  column_field_refs: StringListSchema,
  filter_field_refs: StringListSchema,
  value_fields: z.array(PivotValueFieldSchema),
  refresh_policy: z.enum(["manual", "on_import", "on_export", "scheduled"]),
  last_refreshed_at: TimestampSchema.nullable()
});

export const StyleMetadataSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  style_id: z.string(),
  workbook_ref: z.string(),
  scope: ExcelStyleScopeSchema,
  target_refs: StringListSchema,
  rtl: z.boolean(),
  number_format_code: z.string().nullable(),
  date_format_code: z.string().nullable(),
  currency_code: z.string().nullable(),
  font: z.record(z.unknown()),
  fill: z.record(z.unknown()),
  border: z.record(z.unknown()),
  alignment: z.record(z.unknown()),
  conditional_rules: RecordListSchema,
  auto_width_strategy: z.enum(["none", "content_based", "header_based", "fixed"]),
  template_asset_ref: z.string().nullable(),
  brand_preset_ref: z.string().nullable(),
  frozen_pane: z
    .object({
      top_row_count: z.number().int().nonnegative(),
      left_column_count: z.number().int().nonnegative()
    })
    .nullable()
});

export const TransformationStepSchema = excelEntity({
  step_id: z.string(),
  operation: z.enum([
    "merge_columns",
    "split_column",
    "rename_column",
    "derive_column",
    "reorder_columns",
    "append_table",
    "join_tables",
    "filter_rows",
    "sort_range",
    "group_aggregate",
    "pivot_generate",
    "unpivot_range",
    "normalize_sheet",
    "split_sheet",
    "merge_sheets",
    "merge_workbooks"
  ]),
  input_refs: StringListSchema,
  output_target_refs: StringListSchema,
  config: z.record(z.unknown()),
  preview_required: z.boolean(),
  approval_required: z.boolean()
});

export const TransformationPlanSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  plan_id: z.string(),
  workbook_ref: z.string(),
  requested_mode: PlatformModeSchema,
  action_sequence: z.array(TransformationStepSchema),
  execution_strategy: TransformationExecutionStrategySchema,
  created_by: z.string(),
  created_at: TimestampSchema
});

export const TransformationResultSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  result_id: z.string(),
  plan_ref: z.string(),
  workbook_ref: z.string(),
  action_execution_refs: StringListSchema,
  output_range_refs: StringListSchema,
  created_artifact_refs: StringListSchema,
  affected_cell_refs: StringListSchema,
  affected_worksheet_refs: StringListSchema,
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema,
  outcome: ExecutionOutcomeSchema,
  warnings: z.array(WarningSchema),
  completed_at: TimestampSchema.nullable()
});

export const FormulaGraphEdgeSchema = excelEntity({
  edge_id: z.string(),
  precedent_ref: z.string(),
  dependent_ref: z.string(),
  edge_kind: z.enum(["cell", "range", "cross_sheet", "named_range", "dynamic_array"])
});

export const FormulaGraphStateSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  graph_id: z.string(),
  workbook_ref: z.string(),
  formula_refs: z.array(FormulaRefSchema),
  dependency_edges: z.array(FormulaGraphEdgeSchema),
  dirty_cell_refs: StringListSchema,
  circular_reference_groups: z.array(StringListSchema),
  volatile_function_refs: StringListSchema,
  function_registry_ref: z.string(),
  recalculation_state: FormulaGraphRecalculationStateSchema,
  last_recalculated_at: TimestampSchema.nullable()
});

export const WorkbookVersionSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  workbook_version_id: z.string(),
  workbook_ref: z.string(),
  version_ref: VersionRefSchema,
  change_kind: WorkbookChangeKindSchema,
  change_reason: z.string(),
  based_on_artifact_ref: z.string().nullable(),
  created_at: TimestampSchema
});

export const WorkbookSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  workbook_id: z.string(),
  artifact_ref: z.string(),
  canonical_ref: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  source_refs: StringListSchema,
  worksheet_refs: StringListSchema,
  named_range_refs: StringListSchema,
  style_refs: StringListSchema,
  pivot_refs: StringListSchema,
  current_formula_graph_ref: z.string(),
  current_version_ref: z.string(),
  workbook_properties: z.object({
    uses_1904_dates: z.boolean(),
    auto_recalculate: z.boolean(),
    rtl: z.boolean(),
    locale: z.string()
  }),
  status: WorkbookStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const WorkbookPackageSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(EXCEL_SCHEMA_NAMESPACE),
  schema_version: z.literal(EXCEL_SCHEMA_VERSION),
  workbook: WorkbookSchema,
  worksheets: z.array(WorksheetSchema),
  ranges: z.array(RangeSchema),
  cells: z.array(CellMetadataSchema),
  merged_cells: z.array(MergedCellsSchema),
  named_ranges: z.array(NamedRangeSchema),
  pivots: z.array(PivotMetadataSchema),
  styles: z.array(StyleMetadataSchema),
  workbook_versions: z.array(WorkbookVersionSchema),
  transformation_plans: z.array(TransformationPlanSchema),
  transformation_results: z.array(TransformationResultSchema),
  formula_graphs: z.array(FormulaGraphStateSchema)
});

export const ImportWorkbookInputSchema = z.object({
  workbook_source_ref: z.string(),
  media_type: z.enum([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "text/csv",
    "text/tab-separated-values"
  ]),
  requested_mode: PlatformModeSchema,
  parse_options: z.record(z.unknown())
});

export const ImportWorkbookOutputSchema = z.object({
  workbook: WorkbookSchema,
  workbook_package: WorkbookPackageSchema,
  artifact_ref: z.string(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const AnalyzeWorkbookInputSchema = z.object({
  workbook_ref: z.string(),
  workbook_package_ref: z.string(),
  requested_mode: PlatformModeSchema,
  profiling_depth: z.enum(["fast", "standard", "deep"])
});

export const AnalyzeWorkbookOutputSchema = z.object({
  workbook_ref: z.string(),
  workbook_package: WorkbookPackageSchema,
  inferred_labels: StringListSchema,
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const ApplyTransformationInputSchema = z.object({
  workbook_ref: z.string(),
  transformation_plan: TransformationPlanSchema,
  preview_only: z.boolean(),
  requested_by: z.string()
});

export const ApplyTransformationOutputSchema = z.object({
  workbook_ref: z.string(),
  transformation_result: TransformationResultSchema,
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const RecalculateFormulasInputSchema = z.object({
  workbook_ref: z.string(),
  formula_graph_ref: z.string(),
  dirty_cell_refs: StringListSchema,
  requested_at: TimestampSchema
});

export const RecalculateFormulasOutputSchema = z.object({
  workbook_ref: z.string(),
  formula_graph_state: FormulaGraphStateSchema,
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const GeneratePivotInputSchema = z.object({
  workbook_ref: z.string(),
  pivot_metadata: PivotMetadataSchema,
  preview_only: z.boolean()
});

export const GeneratePivotOutputSchema = z.object({
  workbook_ref: z.string(),
  pivot_metadata: PivotMetadataSchema,
  transformation_result: TransformationResultSchema,
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const ApplyFormattingInputSchema = z.object({
  workbook_ref: z.string(),
  style_metadata: StyleMetadataSchema,
  preview_only: z.boolean()
});

export const ApplyFormattingOutputSchema = z.object({
  workbook_ref: z.string(),
  style_metadata: StyleMetadataSchema,
  transformation_result: TransformationResultSchema,
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const ExportEditableWorkbookInputSchema = z.object({
  workbook_ref: z.string(),
  export_profile: z.object({
    include_hidden_sheets: z.boolean(),
    preserve_pivots: z.boolean(),
    preserve_formulas: z.boolean(),
    target_media_type: z.enum([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.ms-excel.sheet.macroEnabled.12"
    ])
  })
});

export const ExportEditableWorkbookOutputSchema = z.object({
  workbook_ref: z.string(),
  export_artifact_ref: z.string(),
  export_storage_ref: z.string(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema,
  publication_ref: z.string().nullable()
});

export const LambdaRegistryEntryContractSchema = z.object({
  lambda_name: z.string(),
  parameter_names: StringListSchema,
  body_expression: z.string(),
  scope: z.enum(["workbook", "worksheet"]),
  worksheet_name: z.string().nullable(),
  recursion_policy: z.enum(["no_recursion", "bounded"]),
  recursion_limit: z.number().int().positive(),
  lifecycle_state: z.enum(["active", "imported", "exported", "superseded"]),
  source: z.string()
});

export const ImportLambdaRegistryInputSchema = z.object({
  workbook_ref: z.string(),
  lambda_entries: z.array(LambdaRegistryEntryContractSchema).min(1),
  merge_strategy: z.enum(["merge", "replace"]).default("merge"),
  source_ref: z.string()
});

export const ImportLambdaRegistryOutputSchema = z.object({
  workbook_ref: z.string(),
  imported_count: z.number().int().nonnegative(),
  lambda_registry_ref: z.string(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const ExportLambdaRegistryInputSchema = z.object({
  workbook_ref: z.string(),
  target_format: z.enum(["json"]).default("json"),
  include_superseded: z.boolean().default(false)
});

export const ExportLambdaRegistryOutputSchema = z.object({
  workbook_ref: z.string(),
  lambda_export_ref: z.string(),
  exported_count: z.number().int().nonnegative(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const ChartSeriesContractSchema = z.object({
  series_name: z.string(),
  value_range_ref: z.string(),
  category_range_ref: z.string().nullable(),
  chart_type: z.enum(["bar", "line", "area", "column", "combo", "pie", "scatter"]).default("bar"),
  axis_binding: z.enum(["primary", "secondary"]).default("primary")
});

export const ChartRequestSchema = z.object({
  chart_id: z.string(),
  chart_name: z.string(),
  chart_type: z.enum(["bar", "line", "area", "column", "combo", "pie", "scatter"]),
  source_worksheet: z.string(),
  target_worksheet: z.string(),
  anchor_range: z.string(),
  category_range_ref: z.string(),
  title: z.string().nullable(),
  mutation_of: z.string().nullable(),
  series: z.array(ChartSeriesContractSchema).min(1)
});

export const GenerateChartInputSchema = z.object({
  workbook_ref: z.string(),
  chart_request: ChartRequestSchema,
  preview_only: z.boolean()
});

export const GenerateChartOutputSchema = z.object({
  workbook_ref: z.string(),
  chart_ref: z.string(),
  chart_artifact_ref: z.string(),
  chart_revision: z.number().int().positive(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const PublishWorkbookInputSchema = z.object({
  workbook_ref: z.string(),
  export_artifact_ref: z.string(),
  target_ref: z.string(),
  publication_backend: z.enum(["filesystem", "object_store"]).default("object_store"),
  published_filename: z.string()
});

export const PublishWorkbookOutputSchema = z.object({
  workbook_ref: z.string(),
  publication_ref: z.string(),
  publication_storage_ref: z.string(),
  backend_ref: z.string(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const PersistRuntimeBundleInputSchema = z.object({
  workbook_ref: z.string(),
  publication_ref: z.string().nullable(),
  backend_service_ref: z.string(),
  requested_at: TimestampSchema
});

export const PersistRuntimeBundleOutputSchema = z.object({
  workbook_ref: z.string(),
  manifest_ref: z.string(),
  backend_manifest_ref: z.string().nullable(),
  backend_object_ref: z.string().nullable(),
  evidence_ref: z.string(),
  audit_event_refs: StringListSchema,
  lineage_edge_refs: StringListSchema
});

export const ExcelActionRegistry = [
  createExcelActionDefinition({
    actionId: "excel_engine.import_workbook.v1",
    actionName: "Import Workbook",
    inputSchemaId: "excel-import-workbook-input",
    outputSchemaId: "excel-import-workbook-output",
    requiredPermissions: ["source:read", "artifact:write"],
    previewSupport: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_create", "job_create", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["workbook_import_check", "source_profile_check", "lineage_link_check"],
    approvalPolicy: "never"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.analyze_workbook.v1",
    actionName: "Analyze Workbook",
    inputSchemaId: "excel-analyze-workbook-input",
    outputSchemaId: "excel-analyze-workbook-output",
    requiredPermissions: ["artifact:read"],
    previewSupport: true,
    mutability: "read_only",
    idempotency: "idempotent",
    sideEffects: ["evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["worksheet_profile_check", "type_inference_check", "formula_inventory_check"],
    approvalPolicy: "never"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.apply_transformation.v1",
    actionName: "Apply Transformation",
    inputSchemaId: "excel-apply-transformation-input",
    outputSchemaId: "excel-apply-transformation-output",
    requiredPermissions: ["artifact:read", "artifact:write"],
    previewSupport: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["transformation_preview_check", "transformation_apply_check", "lineage_delta_check"],
    approvalPolicy: "conditional"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.recalculate_formulas.v1",
    actionName: "Recalculate Formulas",
    inputSchemaId: "excel-recalculate-formulas-input",
    outputSchemaId: "excel-recalculate-formulas-output",
    requiredPermissions: ["artifact:read", "artifact:write"],
    previewSupport: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["formula_parse_check", "formula_recalculation_check", "dependency_graph_check"],
    approvalPolicy: "never"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.generate_pivot.v1",
    actionName: "Generate Pivot",
    inputSchemaId: "excel-generate-pivot-input",
    outputSchemaId: "excel-generate-pivot-output",
    requiredPermissions: ["artifact:read", "artifact:write"],
    previewSupport: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["pivot_generation_check", "pivot_cache_check", "pivot_lineage_check"],
    approvalPolicy: "conditional"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.generate_chart.v1",
    actionName: "Generate Chart",
    inputSchemaId: "excel-generate-chart-input",
    outputSchemaId: "excel-generate-chart-output",
    requiredPermissions: ["artifact:read", "artifact:write"],
    previewSupport: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["chart_generation_check", "chart_mutation_check", "chart_lineage_check"],
    approvalPolicy: "conditional"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.apply_formatting.v1",
    actionName: "Apply Formatting",
    inputSchemaId: "excel-apply-formatting-input",
    outputSchemaId: "excel-apply-formatting-output",
    requiredPermissions: ["artifact:read", "artifact:write", "template:read"],
    previewSupport: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["formatting_preview_check", "style_application_check", "rtl_layout_check"],
    approvalPolicy: "conditional"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.export_editable_workbook.v1",
    actionName: "Export Editable Workbook",
    inputSchemaId: "excel-export-editable-workbook-input",
    outputSchemaId: "excel-export-editable-workbook-output",
    requiredPermissions: ["artifact:read", "artifact:publish"],
    previewSupport: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_create", "publication_create", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["editable_export_check", "workbook_integrity_check", "publication_link_check"],
    approvalPolicy: "conditional"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.import_lambda_registry.v1",
    actionName: "Import Lambda Registry",
    inputSchemaId: "excel-import-lambda-registry-input",
    outputSchemaId: "excel-import-lambda-registry-output",
    requiredPermissions: ["artifact:read", "artifact:write"],
    previewSupport: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["lambda_import_check", "lambda_registry_sync_check", "lineage_link_check"],
    approvalPolicy: "never"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.export_lambda_registry.v1",
    actionName: "Export Lambda Registry",
    inputSchemaId: "excel-export-lambda-registry-input",
    outputSchemaId: "excel-export-lambda-registry-output",
    requiredPermissions: ["artifact:read", "artifact:write"],
    previewSupport: false,
    mutability: "read_only",
    idempotency: "idempotent",
    sideEffects: ["artifact_create", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["lambda_export_check", "lambda_registry_sync_check", "lineage_link_check"],
    approvalPolicy: "never"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.publish_workbook.v1",
    actionName: "Publish Workbook",
    inputSchemaId: "excel-publish-workbook-input",
    outputSchemaId: "excel-publish-workbook-output",
    requiredPermissions: ["artifact:publish"],
    previewSupport: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["publication_create", "artifact_create", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["publish_backend_check", "publish_persistence_check", "publication_link_check"],
    approvalPolicy: "conditional"
  }),
  createExcelActionDefinition({
    actionId: "excel_engine.persist_runtime_bundle.v1",
    actionName: "Persist Runtime Bundle",
    inputSchemaId: "excel-persist-runtime-bundle-input",
    outputSchemaId: "excel-persist-runtime-bundle-output",
    requiredPermissions: ["artifact:write", "artifact:publish"],
    previewSupport: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    sideEffects: ["artifact_update", "evidence_emit", "audit_emit", "lineage_emit"],
    evidenceRequirements: ["publish_persistence_check", "backend_manifest_check", "lineage_link_check"],
    approvalPolicy: "never"
  })
];

export const ExcelToolRegistry = [
  createExcelToolRegistration({
    toolId: "excel_engine.import_workbook",
    actionId: "excel_engine.import_workbook.v1",
    inputSchemaId: "excel-import-workbook-input",
    outputSchemaId: "excel-import-workbook-output",
    verificationHooks: ["workbook_import_check", "lineage_link_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/artifacts", "@rasid/jobs", "@rasid/evidence"],
    scaleProfile: "batch_safe"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.analyze_workbook",
    actionId: "excel_engine.analyze_workbook.v1",
    inputSchemaId: "excel-analyze-workbook-input",
    outputSchemaId: "excel-analyze-workbook-output",
    verificationHooks: ["worksheet_profile_check", "formula_inventory_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/evidence"],
    scaleProfile: "read_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.apply_transformation",
    actionId: "excel_engine.apply_transformation.v1",
    inputSchemaId: "excel-apply-transformation-input",
    outputSchemaId: "excel-apply-transformation-output",
    verificationHooks: ["transformation_apply_check", "lineage_delta_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/artifacts", "@rasid/evidence"],
    scaleProfile: "mutation_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.recalculate_formulas",
    actionId: "excel_engine.recalculate_formulas.v1",
    inputSchemaId: "excel-recalculate-formulas-input",
    outputSchemaId: "excel-recalculate-formulas-output",
    verificationHooks: ["formula_recalculation_check", "dependency_graph_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/evidence"],
    scaleProfile: "compute_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.generate_pivot",
    actionId: "excel_engine.generate_pivot.v1",
    inputSchemaId: "excel-generate-pivot-input",
    outputSchemaId: "excel-generate-pivot-output",
    verificationHooks: ["pivot_generation_check", "pivot_lineage_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/evidence"],
    scaleProfile: "compute_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.generate_chart",
    actionId: "excel_engine.generate_chart.v1",
    inputSchemaId: "excel-generate-chart-input",
    outputSchemaId: "excel-generate-chart-output",
    verificationHooks: ["chart_generation_check", "chart_mutation_check", "chart_lineage_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/evidence"],
    scaleProfile: "compute_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.apply_formatting",
    actionId: "excel_engine.apply_formatting.v1",
    inputSchemaId: "excel-apply-formatting-input",
    outputSchemaId: "excel-apply-formatting-output",
    verificationHooks: ["style_application_check", "rtl_layout_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/evidence", "@rasid/library", "@rasid/brand-template"],
    scaleProfile: "mutation_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.export_editable_workbook",
    actionId: "excel_engine.export_editable_workbook.v1",
    inputSchemaId: "excel-export-editable-workbook-input",
    outputSchemaId: "excel-export-editable-workbook-output",
    verificationHooks: ["editable_export_check", "workbook_integrity_check", "publication_link_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/artifacts", "@rasid/output-publication", "@rasid/evidence"],
    scaleProfile: "io_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.import_lambda_registry",
    actionId: "excel_engine.import_lambda_registry.v1",
    inputSchemaId: "excel-import-lambda-registry-input",
    outputSchemaId: "excel-import-lambda-registry-output",
    verificationHooks: ["lambda_import_check", "lambda_registry_sync_check", "lineage_link_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/evidence"],
    scaleProfile: "mutation_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.export_lambda_registry",
    actionId: "excel_engine.export_lambda_registry.v1",
    inputSchemaId: "excel-export-lambda-registry-input",
    outputSchemaId: "excel-export-lambda-registry-output",
    verificationHooks: ["lambda_export_check", "lineage_link_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/artifacts", "@rasid/evidence"],
    scaleProfile: "io_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.publish_workbook",
    actionId: "excel_engine.publish_workbook.v1",
    inputSchemaId: "excel-publish-workbook-input",
    outputSchemaId: "excel-publish-workbook-output",
    verificationHooks: ["publish_backend_check", "publish_persistence_check", "publication_link_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/output-publication", "@rasid/evidence"],
    scaleProfile: "io_heavy"
  }),
  createExcelToolRegistration({
    toolId: "excel_engine.persist_runtime_bundle",
    actionId: "excel_engine.persist_runtime_bundle.v1",
    inputSchemaId: "excel-persist-runtime-bundle-input",
    outputSchemaId: "excel-persist-runtime-bundle-output",
    verificationHooks: ["publish_persistence_check", "backend_manifest_check", "lineage_link_check"],
    runtimeDependencies: ["@rasid/runtime", "@rasid/contracts", "@rasid/artifacts", "@rasid/evidence"],
    scaleProfile: "io_heavy"
  })
];

export const EXCEL_CONTRACT = contractEnvelope("excel");

export const validateWorkbook = (input: unknown): Workbook => WorkbookSchema.parse(input);
export const validateWorksheet = (input: unknown): Worksheet => WorksheetSchema.parse(input);
export const validateRange = (input: unknown): ExcelRange => RangeSchema.parse(input);
export const validateCellMetadata = (input: unknown): CellMetadata => CellMetadataSchema.parse(input);
export const validateMergedCells = (input: unknown): MergedCells => MergedCellsSchema.parse(input);
export const validateNamedRange = (input: unknown): NamedRange => NamedRangeSchema.parse(input);
export const validatePivotMetadata = (input: unknown): PivotMetadata => PivotMetadataSchema.parse(input);
export const validateStyleMetadata = (input: unknown): StyleMetadata => StyleMetadataSchema.parse(input);
export const validateTransformationPlan = (input: unknown): TransformationPlan => TransformationPlanSchema.parse(input);
export const validateTransformationResult = (input: unknown): TransformationResult =>
  TransformationResultSchema.parse(input);
export const validateFormulaGraphState = (input: unknown): FormulaGraphState => FormulaGraphStateSchema.parse(input);
export const validateWorkbookVersion = (input: unknown): WorkbookVersion => WorkbookVersionSchema.parse(input);
export const validateWorkbookPackage = (input: unknown): WorkbookPackage => WorkbookPackageSchema.parse(input);

export const ExcelValidators = {
  workbook: validateWorkbook,
  worksheet: validateWorksheet,
  range: validateRange,
  cell_metadata: validateCellMetadata,
  merged_cells: validateMergedCells,
  named_range: validateNamedRange,
  pivot_metadata: validatePivotMetadata,
  style_metadata: validateStyleMetadata,
  transformation_plan: validateTransformationPlan,
  transformation_result: validateTransformationResult,
  formula_graph_state: validateFormulaGraphState,
  workbook_version: validateWorkbookVersion,
  workbook_package: validateWorkbookPackage
} as const;

export type CellAddress = z.infer<typeof CellAddressSchema>;
export type RangeAddress = z.infer<typeof RangeAddressSchema>;
export type Workbook = z.infer<typeof WorkbookSchema>;
export type Worksheet = z.infer<typeof WorksheetSchema>;
export type ExcelRange = z.infer<typeof RangeSchema>;
export type CellMetadata = z.infer<typeof CellMetadataSchema>;
export type MergedCells = z.infer<typeof MergedCellsSchema>;
export type NamedRange = z.infer<typeof NamedRangeSchema>;
export type PivotValueField = z.infer<typeof PivotValueFieldSchema>;
export type PivotMetadata = z.infer<typeof PivotMetadataSchema>;
export type StyleMetadata = z.infer<typeof StyleMetadataSchema>;
export type TransformationStep = z.infer<typeof TransformationStepSchema>;
export type TransformationPlan = z.infer<typeof TransformationPlanSchema>;
export type TransformationResult = z.infer<typeof TransformationResultSchema>;
export type FormulaGraphEdge = z.infer<typeof FormulaGraphEdgeSchema>;
export type FormulaGraphState = z.infer<typeof FormulaGraphStateSchema>;
export type WorkbookVersion = z.infer<typeof WorkbookVersionSchema>;
export type WorkbookPackage = z.infer<typeof WorkbookPackageSchema>;
export type ImportWorkbookInput = z.infer<typeof ImportWorkbookInputSchema>;
export type ImportWorkbookOutput = z.infer<typeof ImportWorkbookOutputSchema>;
export type AnalyzeWorkbookInput = z.infer<typeof AnalyzeWorkbookInputSchema>;
export type AnalyzeWorkbookOutput = z.infer<typeof AnalyzeWorkbookOutputSchema>;
export type ApplyTransformationInput = z.infer<typeof ApplyTransformationInputSchema>;
export type ApplyTransformationOutput = z.infer<typeof ApplyTransformationOutputSchema>;
export type RecalculateFormulasInput = z.infer<typeof RecalculateFormulasInputSchema>;
export type RecalculateFormulasOutput = z.infer<typeof RecalculateFormulasOutputSchema>;
export type GeneratePivotInput = z.infer<typeof GeneratePivotInputSchema>;
export type GeneratePivotOutput = z.infer<typeof GeneratePivotOutputSchema>;
export type GenerateChartInput = z.infer<typeof GenerateChartInputSchema>;
export type GenerateChartOutput = z.infer<typeof GenerateChartOutputSchema>;
export type ApplyFormattingInput = z.infer<typeof ApplyFormattingInputSchema>;
export type ApplyFormattingOutput = z.infer<typeof ApplyFormattingOutputSchema>;
export type ExportEditableWorkbookInput = z.infer<typeof ExportEditableWorkbookInputSchema>;
export type ExportEditableWorkbookOutput = z.infer<typeof ExportEditableWorkbookOutputSchema>;
export type ImportLambdaRegistryInput = z.infer<typeof ImportLambdaRegistryInputSchema>;
export type ImportLambdaRegistryOutput = z.infer<typeof ImportLambdaRegistryOutputSchema>;
export type ExportLambdaRegistryInput = z.infer<typeof ExportLambdaRegistryInputSchema>;
export type ExportLambdaRegistryOutput = z.infer<typeof ExportLambdaRegistryOutputSchema>;
export type PublishWorkbookInput = z.infer<typeof PublishWorkbookInputSchema>;
export type PublishWorkbookOutput = z.infer<typeof PublishWorkbookOutputSchema>;
export type PersistRuntimeBundleInput = z.infer<typeof PersistRuntimeBundleInputSchema>;
export type PersistRuntimeBundleOutput = z.infer<typeof PersistRuntimeBundleOutputSchema>;
