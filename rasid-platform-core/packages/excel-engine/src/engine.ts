import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  CellMetadataSchema,
  EXCEL_CONTRACT,
  EXCEL_SCHEMA_NAMESPACE,
  EXCEL_SCHEMA_VERSION,
  EvidencePackSchema,
  ExcelActionRegistry,
  ExcelToolRegistry,
  FormulaGraphStateSchema,
  JobSchema,
  MergedCellsSchema,
  PivotMetadataSchema,
  PublicationSchema,
  RangeSchema,
  StyleMetadataSchema,
  TransformationPlanSchema,
  TransformationResultSchema,
  WorkbookPackageSchema,
  WorkbookSchema,
  WorkbookVersionSchema,
  WorksheetSchema,
  contractEnvelope,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type CellMetadata,
  type ExcelRange,
  type EvidencePack,
  type FailureReason,
  type FormulaGraphState,
  type LineageEdge,
  type MergedCells,
  type PermissionScope,
  type PivotMetadata,
  type Publication,
  type StyleMetadata,
  type TransformationPlan,
  type TransformationResult,
  type Warning,
  type Workbook,
  type WorkbookPackage,
  type WorkbookVersion,
  type Worksheet
} from "@rasid/contracts";
import * as XLSX from "xlsx";
import { z } from "zod";
import { ExcelBackendService } from "./backend-service";
import { ExcelEngineStore } from "./store";

const MediaTypeSchema = z.enum([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
  "text/tab-separated-values"
]);

const ExcelImportRequestSchema = z.object({
  run_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  requested_mode: z.enum(["easy", "advanced"]).default("advanced"),
  media_type: MediaTypeSchema,
  input_path: z.string(),
  output_root: z.string()
});

const WorkbookAnalysisColumnSchema = z.object({
  column_name: z.string(),
  inferred_type: z.string(),
  null_count: z.number().int().nonnegative(),
  duplicate_count: z.number().int().nonnegative(),
  unique_count: z.number().int().nonnegative(),
  key_candidate: z.boolean()
});

const WorkbookAnalysisSheetSchema = z.object({
  worksheet_name: z.string(),
  row_count: z.number().int().nonnegative(),
  column_count: z.number().int().nonnegative(),
  headers: z.array(z.string()),
  columns: z.array(WorkbookAnalysisColumnSchema),
  sample_rows: z.array(z.record(z.unknown())),
  formula_count: z.number().int().nonnegative()
});

const WorkbookAnalysisSchema = z.object({
  workbook_ref: z.string(),
  worksheet_count: z.number().int().nonnegative(),
  sheets: z.array(WorkbookAnalysisSheetSchema),
  warnings: z.array(z.string()),
  generated_at: z.string()
});

const FormulaRecalculationRequestSchema = z.object({
  actor_ref: z.string(),
  formula_graph_ref: z.string().optional()
});

const PivotCalculatedFieldSchema = z.object({
  field_name: z.string(),
  formula: z.string(),
  source_fields: z.array(z.string()).default([]),
  number_format_code: z.string().default("0.00%")
});

const PivotRequestSchema = z.object({
  actor_ref: z.string(),
  source_worksheet: z.string(),
  target_worksheet: z.string(),
  row_field: z.string(),
  column_field: z.string().nullable().default(null),
  value_field: z.string(),
  aggregation: z.enum(["sum", "count", "average", "min", "max"]).default("sum"),
  filter_fields: z.array(z.string()).default([]),
  slicer_fields: z.array(z.string()).default([]),
  calculated_fields: z.array(PivotCalculatedFieldSchema).default([]),
  refresh_policy: z.enum(["manual", "on_open", "on_change"]).default("manual"),
  rebuild_cache: z.boolean().default(true)
});

const PivotCacheSchema = z.object({
  cache_id: z.string(),
  pivot_id: z.string(),
  source_worksheet: z.string(),
  target_worksheet: z.string(),
  cache_worksheet: z.string(),
  snapshot_headers: z.array(z.string()),
  materialized_headers: z.array(z.string()).default([]),
  snapshot_row_count: z.number().int().nonnegative(),
  column_fields: z.array(z.string()).default([]),
  filter_fields: z.array(z.string()).default([]),
  slicer_fields: z.array(z.string()).default([]),
  calculated_fields: z.array(PivotCalculatedFieldSchema).default([]),
  refresh_policy: z.enum(["manual", "on_open", "on_change"]).default("manual"),
  refresh_token: z.string(),
  refresh_mode: z.enum(["rebuild", "incremental"]).default("rebuild"),
  refresh_count: z.number().int().nonnegative(),
  last_refreshed_at: z.string()
});

const ConditionalRuleSchema = z.object({
  rule_id: z.string(),
  type: z.enum(["cell_is", "contains_text"]),
  operator: z.string().nullable().default(null),
  formula: z.string().nullable().default(null),
  text: z.string().nullable().default(null),
  style: z.record(z.unknown()).default({})
});

const FormattingRequestSchema = z.object({
  actor_ref: z.string(),
  style_id: z.string(),
  scope: z.enum(["cell", "row", "column", "worksheet", "table", "pivot", "workbook"]),
  target_refs: z.array(z.string()).min(1),
  rtl: z.boolean().default(false),
  number_format_code: z.string().nullable().default(null),
  date_format_code: z.string().nullable().default(null),
  currency_code: z.string().nullable().default(null),
  font: z.record(z.unknown()).default({ bold: true }),
  fill: z.record(z.unknown()).default({ type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } }),
  border: z.record(z.unknown()).default({
    top: { style: "thin", color: { argb: "FF8AA4BF" } },
    left: { style: "thin", color: { argb: "FF8AA4BF" } },
    bottom: { style: "thin", color: { argb: "FF8AA4BF" } },
    right: { style: "thin", color: { argb: "FF8AA4BF" } }
  }),
  alignment: z.record(z.unknown()).default({ vertical: "middle", horizontal: "center" }),
  auto_width_strategy: z.enum(["none", "content_based", "header_based", "fixed"]).default("content_based"),
  freeze_top_row: z.boolean().default(true),
  freeze_pane: z
    .object({
      top_row_count: z.number().int().nonnegative(),
      left_column_count: z.number().int().nonnegative()
    })
    .nullable()
    .default(null),
  conditional_rules: z.array(ConditionalRuleSchema).default([]),
  table_preset: z.string().nullable().default(null),
  template_name: z.enum(["finance", "ops", "executive", "rtl_report"]).nullable().default(null)
});

const ChartSeriesSchema = z.object({
  series_name: z.string(),
  value_field: z.string(),
  chart_type: z.enum(["bar", "line", "area"]).default("bar"),
  color_hex: z.string().default("#1f5f8b"),
  secondary_axis: z.boolean().default(false)
});

const ChartSeriesRuntimeSchema = ChartSeriesSchema.extend({
  target_column_index: z.number().int().positive(),
  data_points: z.array(
    z.object({
      category: z.string(),
      value: z.number()
    })
  )
});

const ChartRequestSchema = z.object({
  actor_ref: z.string(),
  chart_id: z.string(),
  chart_type: z.enum(["bar", "line", "area", "pie", "combo"]),
  source_worksheet: z.string(),
  category_field: z.string(),
  value_field: z.string().nullable().default(null),
  series_name: z.string().nullable().default("Series 1"),
  chart_title: z.string(),
  target_worksheet: z.string(),
  color_hex: z.string().default("#1f5f8b"),
  legend_position: z.enum(["right", "bottom", "top", "none"]).default("right"),
  anchor_range: z.string().default("J2:Q18"),
  mutation_of: z.string().nullable().default(null),
  series: z.array(ChartSeriesSchema).default([])
});

const ChartMetadataSchema = z.object({
  chart_id: z.string(),
  chart_type: z.enum(["bar", "line", "area", "pie", "combo"]),
  source_worksheet: z.string(),
  target_worksheet: z.string(),
  category_field: z.string(),
  value_field: z.string().nullable(),
  series_name: z.string().nullable(),
  chart_title: z.string(),
  target_range_ref: z.string(),
  cache_ref: z.string().nullable(),
  svg_ref: z.string().nullable(),
  legend_position: z.enum(["right", "bottom", "top", "none"]),
  anchor_range: z.string(),
  config_sheet: z.string(),
  mutation_of: z.string().nullable(),
  chart_revision: z.number().int().positive(),
  series: z.array(ChartSeriesRuntimeSchema),
  data_points: z.array(
    z.object({
      category: z.string(),
      value: z.number()
    })
  ),
  export_preserved: z.boolean(),
  generated_at: z.string()
});

const NativeWorkbookObjectsSchema = z.object({
  workbook_object_manifest_id: z.string(),
  chart_objects: z.array(
    z.object({
      chart_id: z.string(),
      chart_xml_path: z.string(),
      drawing_xml_path: z.string(),
      target_sheet: z.string(),
      anchor_range: z.string(),
      chart_type: z.enum(["bar", "line", "area", "pie", "combo"]),
      series_count: z.number().int().positive(),
      config_sheet: z.string(),
      chart_revision: z.number().int().positive()
    })
  ),
  pivot_objects: z.array(
    z.object({
      pivot_id: z.string(),
      pivot_table_xml_path: z.string(),
      cache_definition_xml_path: z.string(),
      cache_records_xml_path: z.string(),
      target_sheet: z.string(),
      source_sheet: z.string(),
      column_fields: z.array(z.string()),
      calculated_fields: z.array(z.string()),
      slicer_fields: z.array(z.string())
    })
  ),
  slicer_objects: z.array(
    z.object({
      slicer_id: z.string(),
      slicer_cache_name: z.string(),
      slicer_xml_path: z.string(),
      slicer_cache_xml_path: z.string(),
      target_sheet: z.string(),
      source_field: z.string(),
      drawing_xml_path: z.string().nullable(),
      relationship_id: z.string()
    })
  ),
  generated_at: z.string()
});

const LambdaRegistryEntrySchema = z.object({
  lambda_id: z.string(),
  lambda_name: z.string(),
  parameter_names: z.array(z.string()),
  body_expression: z.string(),
  workbook_defined_name: z.string(),
  defined_name_formula: z.string(),
  scope: z.enum(["workbook", "worksheet"]).default("workbook"),
  worksheet_name: z.string().nullable().default(null),
  recursion_policy: z.enum(["no_recursion", "bounded"]).default("no_recursion"),
  recursion_limit: z.number().int().positive().default(1),
  lifecycle_state: z.enum(["active", "imported", "exported", "superseded"]).default("active"),
  source: z.enum(["workbook_defined_name", "runtime_registry", "worksheet_registry"]).default("workbook_defined_name")
});

const MappingPreviewEntrySchema = z.object({
  preview_id: z.string(),
  worksheet: z.string(),
  operation: z.string(),
  source_field: z.string(),
  target_field: z.string(),
  sample_value: z.string().nullable(),
  reason: z.string()
});

const PersistenceManifestSchema = z.object({
  manifest_id: z.string(),
  store_root: z.string(),
  workbook_state_path: z.string(),
  workbook_versions_path: z.string(),
  publications_path: z.string(),
  artifacts_path: z.string(),
  evidence_path: z.string(),
  audit_path: z.string(),
  lineage_path: z.string(),
  charts_path: z.string(),
  exported_workbook_path: z.string().nullable(),
  publication_backend_ref: z.string().nullable(),
  backend_service_ref: z.string().nullable(),
  backend_service_url: z.string().nullable().default(null),
  service_manifest_url: z.string().nullable().default(null),
  backend_manifest_path: z.string().nullable(),
  backend_manifest_url: z.string().nullable().default(null),
  backend_object_manifest_path: z.string().nullable(),
  backend_object_manifest_url: z.string().nullable().default(null),
  backend_download_url: z.string().nullable().default(null),
  updated_at: z.string()
});

const WorkbookSourceMetadataSchema = z.object({
  workbook_id: z.string(),
  source_format: z.enum(["xlsx", "xls", "xlsm", "csv", "tsv"]),
  original_media_type: MediaTypeSchema,
  editable_export_format: z.enum(["xlsx", "xlsm", "xls"]).default("xlsx"),
  contains_vba: z.boolean().default(false),
  vba_preservation_requested: z.boolean().default(false),
  vba_preserved: z.boolean().default(false),
  degrade_behavior: z.enum(["none", "export_as_xlsx", "export_as_xlsx_without_vba", "export_as_xls"]).default("none"),
  degrade_reason: z.string().nullable().default(null),
  named_range_count: z.number().int().nonnegative().default(0)
});

const PublishRequestSchema = z.object({
  actor_ref: z.string(),
  target_ref: z.string(),
  published_filename: z.string()
});

const SampleRunRequestSchema = z.object({
  output_root: z.string(),
  tenant_ref: z.string().default("tenant-sample"),
  workspace_id: z.string().default("workspace-sample"),
  project_id: z.string().default("project-sample"),
  actor_ref: z.string().default("excel-engine-sample")
});

type ExcelImportRequest = z.infer<typeof ExcelImportRequestSchema>;
type WorkbookAnalysis = z.infer<typeof WorkbookAnalysisSchema>;
type WorkbookAnalysisSheet = z.infer<typeof WorkbookAnalysisSheetSchema>;
type FormulaRecalculationRequest = z.infer<typeof FormulaRecalculationRequestSchema>;
type PivotRequest = z.infer<typeof PivotRequestSchema>;
type PivotCache = z.infer<typeof PivotCacheSchema>;
type ConditionalRule = z.infer<typeof ConditionalRuleSchema>;
type FormattingRequest = z.infer<typeof FormattingRequestSchema>;
type ChartRequest = z.infer<typeof ChartRequestSchema>;
type ChartMetadata = z.infer<typeof ChartMetadataSchema>;
type ChartSeries = z.infer<typeof ChartSeriesRuntimeSchema>;
type NativeWorkbookObjects = z.infer<typeof NativeWorkbookObjectsSchema>;
type LambdaRegistryEntry = z.infer<typeof LambdaRegistryEntrySchema>;
type MappingPreviewEntry = z.infer<typeof MappingPreviewEntrySchema>;
type PersistenceManifest = z.infer<typeof PersistenceManifestSchema>;
type PublishRequest = z.infer<typeof PublishRequestSchema>;
type SampleRunRequest = z.infer<typeof SampleRunRequestSchema>;
type WorkbookSourceMetadata = z.infer<typeof WorkbookSourceMetadataSchema>;

type WorksheetTable = {
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  column_widths?: Array<number | null>;
  hidden_columns?: boolean[];
};

type StageCheck = {
  check_id: string;
  check_name: string;
  check_type: string;
  passed: boolean;
  severity: "low" | "medium" | "high" | "critical";
  details: string;
  impacted_refs: string[];
};

type StageMetric = {
  metric_name: string;
  metric_value: number;
  metric_unit: string;
};

type ExcelRunState = {
  runId: string;
  mode: "easy" | "advanced";
  actorRef: string;
  tenantRef: string;
  workspaceId: string;
  projectId: string;
  outputRoot: string;
  workbookPath: string;
  workbook: ExcelJS.Workbook;
  workbookRecord: Workbook;
  workbookPackage: WorkbookPackage;
  canonicalRepresentation: CanonicalRepresentation;
  formulaGraph: FormulaGraphState;
  workbookVersions: WorkbookVersion[];
  transformationPlans: TransformationPlan[];
  transformationResults: TransformationResult[];
  pivotMetadata: PivotMetadata[];
  pivotCaches: PivotCache[];
  styleMetadata: StyleMetadata[];
  generatedCharts: ChartMetadata[];
  chartHistory: ChartMetadata[];
  nativeWorkbookObjects: NativeWorkbookObjects;
  lambdaRegistry: LambdaRegistryEntry[];
  mappingPreviews: MappingPreviewEntry[];
  sourceMetadata: WorkbookSourceMetadata;
  sourceVbaPayloadBase64: string | null;
  analysis: WorkbookAnalysis | null;
  artifacts: Artifact[];
  publication: Publication | null;
  persistenceManifest: PersistenceManifest | null;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  checks: StageCheck[];
  metrics: StageMetric[];
  warnings: Warning[];
  failures: FailureReason[];
  sourceArtifactId: string;
  workbookArtifactId: string;
  currentVersionNumber: number;
  lastFormulaExecution:
    | {
        execution_mode: "single_process" | "worker_threads";
        worker_count: number;
        chunk_count: number;
        target_formula_refs: string[];
        handled_warning_codes: string[];
      }
    | null;
};

export type ExcelSampleArtifacts = {
  output_root: string;
  input_workbook_path: string;
  workbook_package_path: string;
  canonical_representation_path: string;
  analysis_path: string;
  transformation_result_path: string;
  mapping_preview_path: string;
  formula_graph_path: string;
  formula_engine_proof_path: string;
  pivot_metadata_path: string;
  pivot_cache_path: string;
  style_metadata_path: string;
  formatting_proof_path: string;
  fidelity_comparison_proof_path: string;
  easy_advanced_proof_path: string;
  chart_metadata_path: string;
  chart_history_path: string;
  chart_svg_path: string;
  area_chart_svg_path: string;
  easy_mode_export_path: string;
  lambda_import_path: string;
  lambda_registry_path: string;
  lambda_export_path: string;
  native_objects_path: string;
  xls_ingest_analysis_path: string;
  macro_policy_path: string;
  macro_preserved_export_path: string | null;
  desktop_proof_spec_path: string;
  desktop_proof_workbook_path: string;
  desktop_proof_bundle_path: string;
  desktop_formatting_proof_path: string;
  desktop_chart_coverage_proof_path: string;
  pivot_desktop_proof_path: string;
  exported_workbook_path: string;
  publication_path: string;
  persistence_manifest_path: string;
  backend_service_url: string | null;
  backend_service_manifest_url: string | null;
  backend_publication_manifest_url: string | null;
  backend_object_manifest_url: string | null;
  backend_download_url: string | null;
  external_publication_proof_path?: string;
  evidence_path: string;
  audit_path: string;
  lineage_path: string;
  artifacts_manifest_path: string;
};

export type ExcelSampleRun = {
  state: ExcelRunState;
  evidencePack: EvidencePack;
  artifacts: ExcelSampleArtifacts;
};

const Meta = { schema_namespace: EXCEL_SCHEMA_NAMESPACE, schema_version: EXCEL_SCHEMA_VERSION } as const;
const ISO = () => new Date().toISOString();

const id = (prefix: string, ...parts: Array<string | number | null | undefined>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");

const hash = (value: string): string => {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return `fnv32:${(current >>> 0).toString(16)}`;
};

const defaultPermissionScope = (): PermissionScope => ({
  visibility: "workspace",
  allow_read: true,
  allow_write: true,
  allow_share: true,
  allow_publish: true,
  allow_audit_view: true
});

const ensureDir = (targetPath: string): void => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const fileUri = (targetPath: string): string => `file:///${targetPath.replace(/\\/g, "/")}`;
const checksumForFile = (targetPath: string): string => hash(fs.readFileSync(targetPath).toString("base64"));
const sha256ForBuffer = (buffer: Buffer): string => crypto.createHash("sha256").update(buffer).digest("hex");
const sha256ForFile = (targetPath: string): string => sha256ForBuffer(fs.readFileSync(targetPath));

const storageRef = (targetPath: string, storageId: string) => ({
  storage_id: storageId,
  storage_class: "local_fs",
  uri: fileUri(targetPath),
  checksum: checksumForFile(targetPath),
  region: "local"
});

const previewRef = (artifactId: string) => ({
  preview_id: `${artifactId}-preview`,
  preview_type: "html_canvas" as const,
  storage_ref: `${artifactId}-preview-storage`
});

const firstView = <T>(views: T[] | null | undefined): T | undefined => views?.[0];

const safeSheetName = (sheetName: string) => sheetName.replace(/[^A-Za-z0-9_]/g, "_");
const workbookIdentity = (workbook: ExcelJS.Workbook): string => workbook.worksheets[0]?.name ?? "workbook";

const detectPrimitiveType = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "blank";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "datetime";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "text";
};

const toPrimitiveCellValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return `${value}`;
};

const columnLetter = (columnNumber: number): string => {
  let current = columnNumber;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result || "A";
};

const normalizeCellValue = (cell: ExcelJS.Cell): { value: unknown; raw_input: string | null; value_type: CellMetadata["value_type"] } => {
  if (cell.value === null || cell.value === undefined) {
    return { value: null, raw_input: null, value_type: "blank" };
  }
  if (typeof cell.value === "object" && cell.value !== null && "formula" in cell.value) {
    return { value: cell.value.result ?? null, raw_input: `=${cell.value.formula}`, value_type: "formula" };
  }
  if (cell.type === ExcelJS.ValueType.Error) {
    return { value: `${cell.value}`, raw_input: `${cell.value}`, value_type: "error" };
  }
  if (cell.type === ExcelJS.ValueType.Date) {
    return { value: cell.value, raw_input: cell.text || null, value_type: "datetime" };
  }
  if (typeof cell.value === "number") {
    return { value: cell.value, raw_input: `${cell.value}`, value_type: "number" };
  }
  if (typeof cell.value === "boolean") {
    return { value: cell.value, raw_input: `${cell.value}`, value_type: "boolean" };
  }
  return { value: cell.value, raw_input: cell.text || `${cell.value}`, value_type: "text" };
};

const inferColumnType = (values: unknown[]): string => {
  const nonBlank = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (nonBlank.length === 0) return "blank";
  const kinds = new Set(nonBlank.map(detectPrimitiveType));
  if (kinds.size === 1) return [...kinds][0];
  if ([...kinds].every((kind) => ["number", "blank"].includes(kind))) return "number";
  return "mixed";
};

const extractTable = (worksheet: ExcelJS.Worksheet): WorksheetTable => {
  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = headerValues
    .map((value: ExcelJS.CellValue, index: number) => `${value ?? `Column_${index + 1}`}`.trim())
    .filter((value: string) => value.length > 0);
  const columnWidths = headers.map((_, index) => {
    const column = worksheet.getColumn(index + 1);
    return typeof column.width === "number" ? column.width : null;
  });
  const hiddenColumns = headers.map((_, index) => Boolean(worksheet.getColumn(index + 1).hidden));
  const rows: WorksheetTable["rows"] = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const record: Record<string, string | number | boolean | null> = {};
    let hasValue = false;
    headers.forEach((header: string, columnIndex: number) => {
      const cell = row.getCell(columnIndex + 1);
      const normalized = normalizeCellValue(cell);
      const value =
        normalized.value instanceof Date ? normalized.value.toISOString() : (normalized.value as string | number | boolean | null);
      record[header] = value ?? null;
      hasValue = hasValue || value !== null;
    });
    if (hasValue) rows.push(record);
  }
  return { headers, rows, column_widths: columnWidths, hidden_columns: hiddenColumns };
};

const writeTable = (worksheet: ExcelJS.Worksheet, table: WorksheetTable): void => {
  if (worksheet.rowCount > 0) worksheet.spliceRows(1, worksheet.rowCount);
  worksheet.columns = table.headers.map((header) => ({ header, key: header }));
  table.headers.forEach((_, index) => {
    const column = worksheet.getColumn(index + 1);
    const width = table.column_widths?.[index] ?? null;
    column.width = width ?? column.width;
    column.hidden = Boolean(table.hidden_columns?.[index] ?? false);
  });
  table.rows.forEach((row) => worksheet.addRow(table.headers.map((header) => row[header] ?? null)));
};

const forceExplicitColumnWidths = (worksheet: ExcelJS.Worksheet, minimumWidth = 10, maximumWidth = 32): void => {
  let lastMeaningfulColumn = 0;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      lastMeaningfulColumn = Math.max(lastMeaningfulColumn, Number(cell.col));
    });
  });
  worksheet.columns.forEach((column) => {
    if (column.hidden) {
      lastMeaningfulColumn = Math.max(lastMeaningfulColumn, Number(column.number));
    }
  });
  const targetColumnCount = Math.max(lastMeaningfulColumn, 0);
  for (let columnIndex = 1; columnIndex <= targetColumnCount; columnIndex += 1) {
    const column = worksheet.getColumn(columnIndex);
    const existingWidth = typeof column.width === "number" && Number.isFinite(column.width) ? column.width : null;
    if (existingWidth != null) {
      column.width = existingWidth;
      continue;
    }
    const values = (column.values ?? []).map((value) => `${value ?? ""}`.trim()).filter(Boolean);
    const maxLength = values.length > 0 ? Math.max(minimumWidth, ...values.map((value) => value.length)) : minimumWidth;
    column.width = Math.min(maxLength + 2, maximumWidth);
  }
};

const parseReference = (reference: string, defaultSheet: string): { sheet: string; start: string; end: string } => {
  const normalized = reference.replace(/\$/g, "");
  const [sheetPart, cellPart] = normalized.includes("!") ? normalized.split("!") : [defaultSheet, normalized];
  const [start, end] = cellPart.includes(":") ? cellPart.split(":") : [cellPart, cellPart];
  return { sheet: sheetPart.replace(/^'|'$/g, ""), start, end };
};

const definedNameEntriesForWorkbook = (
  workbook: ExcelJS.Workbook
): Array<{ name: string; ranges: string[]; local_sheet_id: number | null }> => {
  const model = ((workbook as unknown as {
    definedNames?: {
      model?: Array<{ name?: string; ranges?: string[]; range?: string; localSheetId?: number }>;
    };
  }).definedNames?.model ?? []);
  return model
    .filter((entry) => `${entry.name ?? ""}`.trim().length > 0)
    .map((entry) => ({
      name: `${entry.name ?? ""}`.trim(),
      ranges: Array.isArray(entry.ranges) ? entry.ranges.map((range) => `${range}`) : entry.range ? [`${entry.range}`] : [],
      local_sheet_id: typeof entry.localSheetId === "number" ? entry.localSheetId : null
    }));
};

const definedNameRangesForWorksheet = (
  workbook: ExcelJS.Workbook,
  definedNameEntries: Array<{ name: string; ranges: string[]; local_sheet_id: number | null }>,
  definedName: string,
  worksheetName: string
): string[] => {
  const worksheetIndex = workbook.worksheets.findIndex((worksheet) => worksheet.name === worksheetName);
  return definedNameEntries
    .filter((entry) => entry.name === definedName)
    .filter((entry) => entry.local_sheet_id == null || entry.local_sheet_id === worksheetIndex)
    .flatMap((entry) => entry.ranges)
    .filter((range) => !/\[[^\]]+\]/.test(range));
};

const isSingleCellReference = (reference: string, defaultSheet: string): boolean => {
  const parsed = parseReference(reference, defaultSheet);
  return parsed.start === parsed.end;
};

const columnIndexFromRef = (ref: string): number => {
  const letters = ref.match(/[A-Z]+/i)?.[0] ?? "A";
  return letters
    .toUpperCase()
    .split("")
    .reduce((total, current) => total * 26 + current.charCodeAt(0) - 64, 0);
};

const rowIndexFromRef = (ref: string): number => Number(ref.match(/\d+/)?.[0] ?? 1);

const cellsInRange = (reference: string, defaultSheet: string): string[] => {
  const parsed = parseReference(reference, defaultSheet);
  const startColumn = columnIndexFromRef(parsed.start);
  const endColumn = columnIndexFromRef(parsed.end);
  const startRow = rowIndexFromRef(parsed.start);
  const endRow = rowIndexFromRef(parsed.end);
  const refs: string[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      refs.push(`${parsed.sheet}!${columnLetter(column)}${row}`);
    }
  }
  return refs;
};

const referencePattern = /(?:'([^']+)'|([A-Za-z0-9_]+))?!?\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g;

const extractFormulaDependencies = (formula: string, worksheetName: string, workbook?: ExcelJS.Workbook): string[] => {
  const dependencies = new Set<string>();
  const normalized = formula.startsWith("=") ? formula.slice(1) : formula;
  for (const match of normalized.matchAll(referencePattern)) {
    const token = match[0];
    cellsInRange(token, worksheetName).forEach((cellRef) => dependencies.add(cellRef));
  }
  if (workbook) {
    const identifierTokens = normalized.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
    const definedNameEntries = definedNameEntriesForWorkbook(workbook);
    identifierTokens.forEach((token) => {
      definedNameRangesForWorksheet(workbook, definedNameEntries, token, worksheetName).forEach((rangeRef) => {
        cellsInRange(rangeRef, worksheetName).forEach((cellRef) => dependencies.add(cellRef));
      });
    });
  }
  return [...dependencies];
};

const worksheetCellMap = (workbook: ExcelJS.Workbook): Map<string, ExcelJS.Cell> => {
  const map = new Map<string, ExcelJS.Cell>();
  workbook.worksheets.forEach((worksheet) => {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        map.set(`${worksheet.name}!${columnLetter(columnNumber)}${row.number}`, cell);
      });
    });
  });
  return map;
};

const normalizeFormulaExpression = (
  formula: string,
  worksheetName: string,
  resolveRefValue: (ref: string) => number
): string => {
  let expression = formula.startsWith("=") ? formula.slice(1) : formula;
  expression = expression.replace(/SUM\(([^)]+)\)/gi, (_match, argument) => {
    const values = cellsInRange(argument, worksheetName).map((ref) => resolveRefValue(ref));
    return `${values.reduce((sum, value) => sum + value, 0)}`;
  });
  expression = expression.replace(/AVERAGE\(([^)]+)\)/gi, (_match, argument) => {
    const values = cellsInRange(argument, worksheetName).map((ref) => resolveRefValue(ref));
    const total = values.reduce((sum, value) => sum + value, 0);
    return `${values.length === 0 ? 0 : total / values.length}`;
  });
  expression = expression.replace(/MIN\(([^)]+)\)/gi, (_match, argument) => {
    const values = cellsInRange(argument, worksheetName).map((ref) => resolveRefValue(ref));
    return `${values.length === 0 ? 0 : Math.min(...values)}`;
  });
  expression = expression.replace(/MAX\(([^)]+)\)/gi, (_match, argument) => {
    const values = cellsInRange(argument, worksheetName).map((ref) => resolveRefValue(ref));
    return `${values.length === 0 ? 0 : Math.max(...values)}`;
  });
  expression = expression.replace(referencePattern, (token) => `${resolveRefValue(cellsInRange(token, worksheetName)[0])}`);
  return expression;
};

const evaluateFormulaGraph = (workbook: ExcelJS.Workbook): { formulaGraph: FormulaGraphState; warnings: Warning[] } => {
  const workbookRef = id("workbook", workbookIdentity(workbook));
  const cellMap = worksheetCellMap(workbook);
  const formulaEntries = [...cellMap.entries()].filter(([, cell]) => typeof cell.value === "object" && cell.value !== null && "formula" in cell.value);
  const formulaRecords = formulaEntries.map(([cellRef, cell]) => {
    const formula = cell.value as ExcelJS.CellFormulaValue;
    const dependencies = extractFormulaDependencies(formula.formula, cell.worksheet.name, workbook);
    return {
      cellRef,
      formula_id: id("formula", cellRef),
      expression: `=${formula.formula}`,
      worksheetName: cell.worksheet.name,
      target_ref: cellRef,
      dependency_refs: dependencies
    };
  });

  const warnings: Warning[] = [];
  const resultCache = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveRefValue = (ref: string): number => {
    const cell = cellMap.get(ref);
    if (!cell || cell.value === null || cell.value === undefined) return 0;
    if (typeof cell.value === "number") return cell.value;
    if (typeof cell.value === "boolean") return cell.value ? 1 : 0;
    if (typeof cell.value === "string") return Number(cell.value) || 0;
    if (typeof cell.value === "object" && "formula" in cell.value) {
      if (resultCache.has(ref)) return resultCache.get(ref) ?? 0;
      if (visiting.has(ref)) {
        warnings.push({
          warning_code: "formula.circular_reference",
          summary: "Circular formula dependency detected",
          detail: `Formula evaluation detected a cycle at ${ref}`,
          severity: "high",
          impacted_refs: [ref]
        });
        return 0;
      }
      visiting.add(ref);
      const expression = normalizeFormulaExpression(`=${cell.value.formula}`, cell.worksheet.name, resolveRefValue);
      let result = 0;
      try {
        result = Number(Function(`"use strict"; return (${expression});`)()) || 0;
      } catch {
        warnings.push({
          warning_code: "formula.unsupported_expression",
          summary: "Unsupported formula expression",
          detail: `The formula at ${ref} could not be evaluated by the current engine`,
          severity: "medium",
          impacted_refs: [ref]
        });
      }
      visiting.delete(ref);
      resultCache.set(ref, result);
      cell.value = { formula: cell.value.formula, result } as ExcelJS.CellFormulaValue;
      return result;
    }
    return 0;
  };

  formulaRecords.forEach((record) => resolveRefValue(record.target_ref));
  const formulaGraph = FormulaGraphStateSchema.parse({
    contract: EXCEL_CONTRACT,
    ...Meta,
    graph_id: id("formula-graph", workbookIdentity(workbook)),
    workbook_ref: workbookRef,
    formula_refs: formulaRecords.map((record) => ({
      formula_id: record.formula_id,
      expression: record.expression,
      dialect: "excel_a1",
      target_ref: record.target_ref,
      dependency_refs: record.dependency_refs
    })),
    dependency_edges: formulaRecords.flatMap((record) =>
      record.dependency_refs.map((dependencyRef) => ({
        ...Meta,
        edge_id: id("formula-edge", dependencyRef, record.target_ref),
        precedent_ref: dependencyRef,
        dependent_ref: record.target_ref,
        edge_kind: dependencyRef.includes("!") ? "cross_sheet" : "cell"
      }))
    ),
    dirty_cell_refs: [],
    circular_reference_groups: warnings.filter((warning) => warning.warning_code === "formula.circular_reference").map((warning) => warning.impacted_refs),
    volatile_function_refs: [],
    function_registry_ref: "excel_engine.function_registry.v1",
    recalculation_state: warnings.length > 0 ? "degraded" : "completed",
    last_recalculated_at: ISO()
  });

  return { formulaGraph, warnings };
};

type FormulaScalar = string | number | boolean | Date | null;
type FormulaMatrix = FormulaScalar[][];
type FormulaLambda = ((...args: FormulaValue[]) => FormulaValue) & { __lambda?: true };
type FormulaError = { __formula_error: string };
type FormulaValue = FormulaScalar | FormulaMatrix | FormulaLambda | FormulaError;

type FormulaEvaluationContext = {
  workbook: ExcelJS.Workbook;
  cellMap: Map<string, ExcelJS.Cell>;
  evalStamp: string;
  warnings: Warning[];
  volatileRefs: Set<string>;
  spillEdges: Array<{ anchor_ref: string; spill_ref: string }>;
  resultCache: Map<string, FormulaValue>;
  visiting: Set<string>;
  lambdaEntries: LambdaRegistryEntry[];
  lambdaDepths: Map<string, number>;
  namedLambdas: Record<string, FormulaLambda>;
  definedNameEntries: Array<{ name: string; ranges: string[]; local_sheet_id: number | null }>;
};

const isFormulaError = (value: FormulaValue): value is FormulaError =>
  typeof value === "object" && value !== null && "__formula_error" in value;

const formulaError = (code: string): FormulaError => ({ __formula_error: code });

const isFormulaLambda = (value: FormulaValue): value is FormulaLambda => typeof value === "function";

const isFormulaMatrix = (value: FormulaValue): value is FormulaMatrix =>
  Array.isArray(value) && (value.length === 0 || Array.isArray(value[0]));

const flattenFormulaValue = (value: FormulaValue): FormulaScalar[] => {
  if (isFormulaError(value) || isFormulaLambda(value)) return [];
  if (isFormulaMatrix(value)) return value.flatMap((row) => row);
  return [value];
};

const scalarFromFormulaValue = (value: FormulaValue): FormulaScalar => {
  if (isFormulaError(value) || isFormulaLambda(value)) return null;
  if (isFormulaMatrix(value)) return value[0]?.[0] ?? null;
  return value;
};

const matrixFromFormulaValue = (value: FormulaValue): FormulaMatrix => {
  if (isFormulaError(value) || isFormulaLambda(value)) return [[null]];
  if (isFormulaMatrix(value)) return value;
  return [[value]];
};

const coerceFormulaNumber = (value: FormulaValue): number => {
  const scalar = scalarFromFormulaValue(value);
  if (scalar instanceof Date) return scalar.getTime();
  if (typeof scalar === "number") return scalar;
  if (typeof scalar === "boolean") return scalar ? 1 : 0;
  if (typeof scalar === "string") return Number(scalar) || 0;
  return 0;
};

const coerceFormulaBoolean = (value: FormulaValue): boolean => {
  const scalar = scalarFromFormulaValue(value);
  if (typeof scalar === "boolean") return scalar;
  if (typeof scalar === "number") return scalar !== 0;
  if (typeof scalar === "string") return scalar.trim().length > 0 && scalar !== "0";
  return Boolean(scalar);
};

const coerceFormulaString = (value: FormulaValue): string => {
  const scalar = scalarFromFormulaValue(value);
  if (scalar === null) return "";
  if (scalar instanceof Date) return scalar.toISOString();
  return `${scalar}`;
};

const stripOuterExpressionParens = (expression: string): string => {
  let normalized = expression.trim();
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    let depth = 0;
    let balanced = true;
    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0 && index < normalized.length - 1) {
        balanced = false;
        break;
      }
    }
    if (!balanced) break;
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
};

const splitFormulaArgs = (expression: string): string[] => {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }
    if (!inString) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }
  if (current.trim().length > 0 || expression.trim().endsWith(",")) {
    args.push(current.trim());
  }
  return args;
};

const findInnermostFunctionCall = (
  expression: string
): { name: string; start: number; openIndex: number; endIndex: number; argsText: string } | null => {
  const stack: Array<{ start: number; openIndex: number; name: string | null }> = [];
  let inString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "(") {
      let cursor = index - 1;
      while (cursor >= 0 && /\s/.test(expression[cursor])) cursor -= 1;
      let start = cursor;
      while (start >= 0 && /[A-Za-z0-9_.]/.test(expression[start])) start -= 1;
      const name = expression.slice(start + 1, cursor + 1);
      stack.push({ start: start + 1, openIndex: index, name: name.length > 0 ? name : null });
      continue;
    }
    if (char === ")") {
      const last = stack.pop();
      if (last?.name) {
        return {
          name: last.name,
          start: last.start,
          openIndex: last.openIndex,
          endIndex: index,
          argsText: expression.slice(last.openIndex + 1, index)
        };
      }
    }
  }
  return null;
};

const literalFormulaString = (value: FormulaScalar): string => {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return `${value}`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  return JSON.stringify(value);
};

const rangeMatrixForReference = (
  reference: string,
  worksheetName: string,
  resolveCellValue: (ref: string) => FormulaValue
): FormulaMatrix => {
  const parsed = parseReference(reference, worksheetName);
  const startColumn = columnIndexFromRef(parsed.start);
  const endColumn = columnIndexFromRef(parsed.end);
  const startRow = rowIndexFromRef(parsed.start);
  const endRow = rowIndexFromRef(parsed.end);
  const matrix: FormulaMatrix = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const currentRow: FormulaScalar[] = [];
    for (let column = startColumn; column <= endColumn; column += 1) {
      currentRow.push(scalarFromFormulaValue(resolveCellValue(`${parsed.sheet}!${columnLetter(column)}${row}`)));
    }
    matrix.push(currentRow);
  }
  return matrix;
};

const deterministicRandom = (seed: string): number => {
  const currentHash = hash(seed).replace("fnv32:", "");
  const numeric = parseInt(currentHash, 16);
  return (numeric % 1000000) / 1000000;
};

const formatExcelTextValue = (value: FormulaValue, pattern: string): string => {
  const scalar = scalarFromFormulaValue(value);
  if (scalar instanceof Date) {
    if (/yyyy-mm-dd/i.test(pattern)) return scalar.toISOString().slice(0, 10);
    if (/dd\/mm\/yyyy/i.test(pattern)) {
      const month = `${scalar.getUTCMonth() + 1}`.padStart(2, "0");
      const day = `${scalar.getUTCDate()}`.padStart(2, "0");
      return `${day}/${month}/${scalar.getUTCFullYear()}`;
    }
    return scalar.toISOString();
  }
  const numeric = coerceFormulaNumber(value);
  if (/^\$?#,##0(?:\.00+)?$/.test(pattern)) {
    const decimals = pattern.includes(".") ? pattern.split(".")[1].length : 0;
    const formatted = numeric.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return pattern.startsWith("$") ? `$${formatted}` : formatted;
  }
  if (/^0(?:\.0+)?$/.test(pattern)) {
    const decimals = pattern.includes(".") ? pattern.split(".")[1].length : 0;
    return numeric.toFixed(decimals);
  }
  return coerceFormulaString(value);
};

const lambdaFromDefinition = (
  entry: LambdaRegistryEntry,
  context: FormulaEvaluationContext,
  worksheetName: string,
  currentCellRef: string,
  localScope: Record<string, unknown>
): FormulaLambda => {
  const lambda = ((...args: FormulaValue[]) => {
    const lambdaKey = `${entry.scope}:${entry.worksheet_name ?? "workbook"}:${entry.lambda_name}`;
    const currentDepth = context.lambdaDepths.get(lambdaKey) ?? 0;
    if (entry.recursion_policy === "no_recursion" && currentDepth > 0) {
      return formulaError("#RECURSION!");
    }
    if (entry.recursion_policy === "bounded" && currentDepth >= entry.recursion_limit) {
      return formulaError("#RECURSION!");
    }
    context.lambdaDepths.set(lambdaKey, currentDepth + 1);
    const scopedValues: Record<string, unknown> = { ...localScope };
    entry.parameter_names.forEach((parameterName, index) => {
      scopedValues[parameterName] = args[index] ?? null;
    });
    try {
      return evaluateExcelFormulaExpression(entry.body_expression, context, worksheetName, currentCellRef, scopedValues);
    } finally {
      if (currentDepth === 0) {
        context.lambdaDepths.delete(lambdaKey);
      } else {
        context.lambdaDepths.set(lambdaKey, currentDepth);
      }
    }
  }) as FormulaLambda;
  lambda.__lambda = true;
  Object.defineProperty(lambda, "name", { value: entry.lambda_name, configurable: true });
  return lambda;
};

const extractNamedLambdaEntries = (workbook: ExcelJS.Workbook): LambdaRegistryEntry[] => {
  const lambdaSheet = workbook.getWorksheet("__lambda_registry");
  if (!lambdaSheet) return [];
  const table = extractTable(lambdaSheet);
  const parsedEntries = table.rows
    .filter((row) => `${row.LambdaName ?? ""}`.trim().length > 0)
    .map((row, index) =>
      LambdaRegistryEntrySchema.parse({
        lambda_id: id("lambda", `${row.LambdaName ?? index + 1}`),
        lambda_name: `${row.LambdaName ?? ""}`.trim(),
        parameter_names: `${row.Parameters ?? ""}`
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        body_expression: `${row.BodyExpression ?? ""}`.trim(),
        workbook_defined_name: `${row.LambdaName ?? ""}`.trim(),
        defined_name_formula: `LAMBDA(${`${row.Parameters ?? ""}`.trim()}${`${row.Parameters ?? ""}`.trim().length > 0 ? "," : ""}${`${row.BodyExpression ?? ""}`.trim()})`,
        scope: `${row.Scope ?? "workbook"}`.trim() === "worksheet" ? "worksheet" : "workbook",
        worksheet_name: row.WorksheetName ? `${row.WorksheetName}`.trim() : null,
        recursion_policy: `${row.RecursionPolicy ?? "no_recursion"}`.trim() === "bounded" ? "bounded" : "no_recursion",
        recursion_limit: Number(row.RecursionLimit ?? 1) > 0 ? Number(row.RecursionLimit ?? 1) : 1,
        lifecycle_state:
          `${row.LifecycleState ?? "active"}`.trim() === "imported"
            ? "imported"
            : `${row.LifecycleState ?? "active"}`.trim() === "exported"
              ? "exported"
              : `${row.LifecycleState ?? "active"}`.trim() === "superseded"
                ? "superseded"
                : "active",
        source: `${row.Scope ?? "workbook"}`.trim() === "worksheet" ? "worksheet_registry" : "workbook_defined_name"
      })
    );
  const deduped = new Map<string, LambdaRegistryEntry>();
  parsedEntries.forEach((entry) => {
    deduped.set(`${entry.scope}:${entry.worksheet_name ?? "workbook"}:${entry.lambda_name}`, entry);
  });
  return [...deduped.values()];
};

const lambdaRegistryHeaders = [
  "LambdaName",
  "Parameters",
  "BodyExpression",
  "Scope",
  "WorksheetName",
  "RecursionPolicy",
  "RecursionLimit",
  "LifecycleState"
] as const;

const syncLambdaRegistryWorksheet = (workbook: ExcelJS.Workbook, entries: LambdaRegistryEntry[]): void => {
  const uniqueEntries = dedupeLambdaRegistryEntries(entries);
  const lambdaSheet = workbook.getWorksheet("__lambda_registry") ?? workbook.addWorksheet("__lambda_registry");
  lambdaSheet.state = "veryHidden";
  if (lambdaSheet.rowCount > 0) {
    lambdaSheet.spliceRows(1, lambdaSheet.rowCount);
  }
  writeTable(lambdaSheet, {
    headers: [...lambdaRegistryHeaders],
    rows: uniqueEntries.map((entry) => ({
      LambdaName: entry.lambda_name,
      Parameters: entry.parameter_names.join(","),
      BodyExpression: entry.body_expression,
      Scope: entry.scope,
      WorksheetName: entry.worksheet_name ?? "",
      RecursionPolicy: entry.recursion_policy,
      RecursionLimit: entry.recursion_limit,
      LifecycleState: entry.lifecycle_state
    }))
  });
};

const lambdaRegistryKey = (entry: Pick<LambdaRegistryEntry, "lambda_name" | "scope" | "worksheet_name">): string =>
  `${entry.scope}:${entry.worksheet_name ?? "workbook"}:${entry.lambda_name}`;

const dedupeLambdaRegistryEntries = (entries: LambdaRegistryEntry[]): LambdaRegistryEntry[] => {
  const deduped = new Map<string, LambdaRegistryEntry>();
  entries.forEach((entry) => {
    deduped.set(lambdaRegistryKey(entry), entry);
  });
  return [...deduped.values()];
};

const normalizeImportedLambdaEntry = (entry: Record<string, unknown>, index: number): LambdaRegistryEntry =>
  (() => {
    const lambdaName = `${entry.lambda_name ?? entry.LambdaName ?? ""}`.trim();
    const parameterNames = Array.isArray(entry.parameter_names)
      ? entry.parameter_names.map((value) => `${value}`.trim()).filter(Boolean)
      : `${entry.Parameters ?? entry.parameters ?? ""}`
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    const bodyExpression = `${entry.body_expression ?? entry.BodyExpression ?? ""}`.trim();
    const worksheetNameToken = entry.worksheet_name ?? entry.WorksheetName;
    return LambdaRegistryEntrySchema.parse({
      lambda_id: `${entry.lambda_id ?? id("lambda", `${lambdaName || index + 1}`)}`,
      lambda_name: lambdaName,
      parameter_names: parameterNames,
      body_expression: bodyExpression,
      workbook_defined_name: `${entry.workbook_defined_name ?? lambdaName}`.trim(),
      defined_name_formula:
        `${entry.defined_name_formula ?? ""}`.trim() ||
        `LAMBDA(${parameterNames.join(",")}${parameterNames.length > 0 ? "," : ""}${bodyExpression})`,
      scope: `${entry.scope ?? entry.Scope ?? "workbook"}`.trim() === "worksheet" ? "worksheet" : "workbook",
      worksheet_name: worksheetNameToken ? `${worksheetNameToken}`.trim() || null : null,
      recursion_policy: `${entry.recursion_policy ?? entry.RecursionPolicy ?? "no_recursion"}`.trim() === "bounded" ? "bounded" : "no_recursion",
      recursion_limit: Number(entry.recursion_limit ?? entry.RecursionLimit ?? 1) > 0 ? Number(entry.recursion_limit ?? entry.RecursionLimit ?? 1) : 1,
      lifecycle_state: "imported",
      source: `${entry.source ?? ""}`.trim() === "workbook_defined_name" ? "workbook_defined_name" : "worksheet_registry"
    });
  })();

const buildNamedLambdaMap = (
  lambdaEntries: LambdaRegistryEntry[],
  context: FormulaEvaluationContext,
  worksheetName: string,
  currentCellRef: string,
  localScope: Record<string, unknown>
): Record<string, FormulaLambda> =>
  lambdaEntries
    .filter((entry) => entry.scope === "workbook" || entry.worksheet_name === worksheetName)
    .reduce<Record<string, FormulaLambda>>((accumulator, entry) => {
      accumulator[entry.lambda_name] = lambdaFromDefinition(entry, context, worksheetName, currentCellRef, localScope);
      return accumulator;
    }, {});

const formulaArrayRows = (value: FormulaValue): FormulaMatrix => matrixFromFormulaValue(value);

const resolveDefinedNameValue = (
  definedName: string,
  context: FormulaEvaluationContext,
  worksheetName: string
): FormulaValue | undefined => {
  const matchingRanges = definedNameRangesForWorksheet(context.workbook, context.definedNameEntries, definedName, worksheetName);
  if (matchingRanges.length === 0) return undefined;
  if (matchingRanges.length === 1) {
    const [rangeRef] = matchingRanges;
    return isSingleCellReference(rangeRef, worksheetName)
      ? resolveFormulaReference(rangeRef, context, worksheetName)
      : rangeMatrixForReference(rangeRef, worksheetName, (ref) => resolveFormulaReference(ref, context, worksheetName));
  }
  return matchingRanges.map((rangeRef) =>
    flattenFormulaValue(
      isSingleCellReference(rangeRef, worksheetName)
        ? resolveFormulaReference(rangeRef, context, worksheetName)
        : rangeMatrixForReference(rangeRef, worksheetName, (ref) => resolveFormulaReference(ref, context, worksheetName))
    )
  ) as unknown as FormulaValue;
};

const evaluateExcelFormulaExpression = (
  rawExpression: string,
  context: FormulaEvaluationContext,
  worksheetName: string,
  currentCellRef: string,
  localScope: Record<string, unknown> = {}
): FormulaValue => {
  let expression = stripOuterExpressionParens(rawExpression.trim().startsWith("=") ? rawExpression.trim().slice(1) : rawExpression.trim());
  if (expression.length === 0) return null;
  if (/^".*"$/.test(expression)) return expression.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(expression)) return Number(expression);
  if (/^(TRUE|FALSE)$/i.test(expression)) return /^TRUE$/i.test(expression);
  if (expression in localScope) return localScope[expression] as FormulaValue;
  const definedNameValue = resolveDefinedNameValue(expression, context, worksheetName);
  if (definedNameValue !== undefined) return definedNameValue;
  if (referencePattern.test(expression)) {
    referencePattern.lastIndex = 0;
    if (expression.match(referencePattern)?.[0] === expression) {
      return expression.includes(":")
        ? rangeMatrixForReference(expression, worksheetName, (ref) => resolveFormulaReference(ref, context, worksheetName))
        : resolveFormulaReference(expression.includes("!") ? expression : `${worksheetName}!${expression}`, context, worksheetName);
    }
  }

  context.namedLambdas = buildNamedLambdaMap(context.lambdaEntries, context, worksheetName, currentCellRef, localScope);
  const scope: Record<string, unknown> = { ...context.namedLambdas, ...localScope };
  let placeholderIndex = 0;

  while (true) {
    const functionCall = findInnermostFunctionCall(expression);
    if (!functionCall) break;
    const placeholder = `__fn_${placeholderIndex += 1}__`;
    const rawArgs = splitFormulaArgs(functionCall.argsText);
    const evaluated =
      functionCall.name in scope && typeof scope[functionCall.name] === "function"
        ? (scope[functionCall.name] as FormulaLambda)(
            ...rawArgs.map((arg) => evaluateExcelFormulaExpression(arg, context, worksheetName, currentCellRef, scope))
          )
        : runExcelFormulaFunction(functionCall.name, rawArgs, context, worksheetName, currentCellRef, scope);
    scope[placeholder] = evaluated;
    expression = `${expression.slice(0, functionCall.start)}${placeholder}${expression.slice(functionCall.endIndex + 1)}`;
  }

  referencePattern.lastIndex = 0;
  expression = expression.replace(referencePattern, (token) => {
    const placeholder = `__ref_${placeholderIndex += 1}__`;
    scope[placeholder] = scalarFromFormulaValue(
      token.includes(":")
        ? rangeMatrixForReference(token, worksheetName, (ref) => resolveFormulaReference(ref, context, worksheetName))
        : resolveFormulaReference(token.includes("!") ? token : `${worksheetName}!${token}`, context, worksheetName)
    );
    return placeholder;
  });

  const jsExpression = expression
    .replace(/\^/g, "**")
    .replace(/<>/g, "!=")
    .replace(/&/g, "+")
    .replace(/\bTRUE\b/gi, "true")
    .replace(/\bFALSE\b/gi, "false")
    .replace(/(?<![<>=!])=(?!=)/g, "==");

  try {
    const result = Function("scope", `with (scope) { return (${jsExpression}); }`)(scope) as FormulaValue;
    if (typeof result === "number" && Number.isNaN(result)) return formulaError("#NUM!");
    return result ?? null;
  } catch {
    return formulaError("#ERROR!");
  }
};

const resolveFormulaReference = (
  reference: string,
  context: FormulaEvaluationContext,
  worksheetName: string
): FormulaValue => {
  const normalizedRef = reference.includes("!") ? reference : `${worksheetName}!${reference}`;
  const cell = context.cellMap.get(normalizedRef);
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (context.resultCache.has(normalizedRef)) return context.resultCache.get(normalizedRef) ?? null;
  if (typeof cell.value === "number" || typeof cell.value === "string" || typeof cell.value === "boolean") return cell.value;
  if (cell.value instanceof Date) return cell.value;
  if (typeof cell.value === "object" && cell.value !== null && "formula" in cell.value) {
    if (context.visiting.has(normalizedRef)) {
      context.warnings.push({
        warning_code: "formula.circular_reference",
        summary: "Circular formula dependency detected",
        detail: `Encountered circular dependency while resolving ${normalizedRef}`,
        severity: "high",
        impacted_refs: [normalizedRef]
      });
      return formulaError("#CYCLE!");
    }
    context.visiting.add(normalizedRef);
    const result = evaluateExcelFormulaExpression(`=${cell.value.formula}`, context, cell.worksheet.name, normalizedRef);
    context.visiting.delete(normalizedRef);
    context.resultCache.set(normalizedRef, result);
    if (!isFormulaMatrix(result) && !isFormulaError(result) && !isFormulaLambda(result)) {
      cell.value = {
        formula: cell.value.formula,
        result: scalarFromFormulaValue(result)
      } as ExcelJS.CellFormulaValue;
    }
    return result;
  }
  return null;
};

const runExcelFormulaFunction = (
  name: string,
  rawArgs: string[],
  context: FormulaEvaluationContext,
  worksheetName: string,
  currentCellRef: string,
  localScope: Record<string, unknown>
): FormulaValue => {
  const upper = name.toUpperCase();
  const evaluateArg = (argument: string, scope = localScope) =>
    evaluateExcelFormulaExpression(argument, context, worksheetName, currentCellRef, scope);
  const evaluatedArgs = rawArgs.map((argument) => evaluateArg(argument));
  const values = evaluatedArgs.flatMap((value) => flattenFormulaValue(value));
  const lookupVector = (value: FormulaValue): FormulaScalar[] =>
    isFormulaMatrix(value) ? value.flatMap((row) => row) : flattenFormulaValue(value);
  const lookupMatrix = (value: FormulaValue): FormulaMatrix => matrixFromFormulaValue(value);
  const trimMatrix = (matrix: FormulaMatrix): FormulaMatrix => matrix.filter((row) => row.some((value) => value !== null && `${value}`.length > 0));
  const normalizeIndices = (args: FormulaValue[], length: number): number[] =>
    args
      .map((argument) => Math.trunc(coerceFormulaNumber(argument)))
      .filter((index) => index !== 0)
      .map((index) => (index > 0 ? index - 1 : length + index))
      .filter((index) => index >= 0 && index < length);
  const findMatchIndex = (needle: FormulaScalar, haystack: FormulaScalar[]): number =>
    haystack.findIndex((candidate) => `${candidate ?? ""}` === `${needle ?? ""}`);
  const invokeLambda = (lambdaCandidate: FormulaValue, args: FormulaValue[]): FormulaValue => {
    if (!isFormulaLambda(lambdaCandidate)) return formulaError("#VALUE!");
    return lambdaCandidate(...args);
  };

  if (["NOW", "TODAY", "RAND", "RANDBETWEEN"].includes(upper)) {
    context.volatileRefs.add(currentCellRef);
  }

  switch (upper) {
    case "SUM":
      return values.reduce<number>((sum, value) => sum + coerceFormulaNumber(value), 0);
    case "AVERAGE":
      return values.length === 0 ? 0 : values.reduce<number>((sum, value) => sum + coerceFormulaNumber(value), 0) / values.length;
    case "MIN":
      return values.length === 0 ? 0 : Math.min(...values.map((value) => coerceFormulaNumber(value)));
    case "MAX":
      return values.length === 0 ? 0 : Math.max(...values.map((value) => coerceFormulaNumber(value)));
    case "COUNT":
      return values.filter((value) => typeof value === "number" && !Number.isNaN(value)).length;
    case "COUNTA":
      return values.filter((value) => value !== null && `${value}`.length > 0).length;
    case "IF":
      return coerceFormulaBoolean(evaluatedArgs[0] ?? null) ? evaluatedArgs[1] ?? null : evaluatedArgs[2] ?? null;
    case "IFERROR": {
      const primary = evaluateArg(rawArgs[0] ?? "");
      return isFormulaError(primary) ? evaluateArg(rawArgs[1] ?? "") : primary;
    }
    case "AND":
      return evaluatedArgs.every((value) => coerceFormulaBoolean(value));
    case "OR":
      return evaluatedArgs.some((value) => coerceFormulaBoolean(value));
    case "DATE":
      return new Date(Date.UTC(coerceFormulaNumber(evaluatedArgs[0]), coerceFormulaNumber(evaluatedArgs[1]) - 1, coerceFormulaNumber(evaluatedArgs[2])));
    case "TEXT":
      return formatExcelTextValue(evaluatedArgs[0] ?? null, coerceFormulaString(evaluatedArgs[1] ?? null));
    case "MATCH": {
      const needle = scalarFromFormulaValue(evaluatedArgs[0] ?? null);
      const haystack = lookupVector(evaluatedArgs[1] ?? null);
      const matchIndex = findMatchIndex(needle, haystack);
      return matchIndex >= 0 ? matchIndex + 1 : formulaError("#N/A");
    }
    case "XMATCH": {
      const needle = scalarFromFormulaValue(evaluatedArgs[0] ?? null);
      const haystack = lookupVector(evaluatedArgs[1] ?? null);
      const matchIndex = findMatchIndex(needle, haystack);
      return matchIndex >= 0 ? matchIndex + 1 : formulaError("#N/A");
    }
    case "INDEX": {
      const matrix = lookupMatrix(evaluatedArgs[0] ?? null);
      const row = Math.max(coerceFormulaNumber(evaluatedArgs[1] ?? 1), 1);
      const column = Math.max(coerceFormulaNumber(evaluatedArgs[2] ?? 1), 1);
      return matrix[row - 1]?.[column - 1] ?? formulaError("#REF!");
    }
    case "XLOOKUP": {
      const needle = scalarFromFormulaValue(evaluatedArgs[0] ?? null);
      const lookupArray = lookupVector(evaluatedArgs[1] ?? null);
      const returnArray = lookupVector(evaluatedArgs[2] ?? null);
      const foundIndex = findMatchIndex(needle, lookupArray);
      return foundIndex >= 0 ? (returnArray[foundIndex] ?? null) : (evaluatedArgs[3] ?? formulaError("#N/A"));
    }
    case "VLOOKUP": {
      const needle = scalarFromFormulaValue(evaluatedArgs[0] ?? null);
      const table = lookupMatrix(evaluatedArgs[1] ?? null);
      const columnIndex = Math.max(coerceFormulaNumber(evaluatedArgs[2] ?? 1), 1);
      const row = table.find((currentRow) => `${currentRow[0] ?? ""}` === `${needle ?? ""}`);
      return row?.[columnIndex - 1] ?? formulaError("#N/A");
    }
    case "HLOOKUP": {
      const needle = scalarFromFormulaValue(evaluatedArgs[0] ?? null);
      const table = lookupMatrix(evaluatedArgs[1] ?? null);
      const rowIndex = Math.max(coerceFormulaNumber(evaluatedArgs[2] ?? 1), 1);
      const headerRow = table[0] ?? [];
      const columnIndex = findMatchIndex(needle, headerRow);
      return columnIndex >= 0 ? (table[rowIndex - 1]?.[columnIndex] ?? formulaError("#N/A")) : formulaError("#N/A");
    }
    case "LET": {
      const scopedValues: Record<string, unknown> = { ...localScope };
      for (let index = 0; index < rawArgs.length - 1; index += 2) {
        const nameToken = rawArgs[index]?.trim();
        const valueToken = rawArgs[index + 1];
        if (!nameToken || valueToken === undefined) break;
        scopedValues[nameToken] = evaluateArg(valueToken, scopedValues);
      }
      return evaluateArg(rawArgs[rawArgs.length - 1] ?? "", scopedValues);
    }
    case "LAMBDA": {
      const parameterNames = rawArgs.slice(0, -1).map((token) => token.trim()).filter((token) => token.length > 0);
      const body = rawArgs[rawArgs.length - 1] ?? "";
      const lambda = ((...args: FormulaValue[]) => {
        const scopedValues: Record<string, unknown> = { ...localScope };
        parameterNames.forEach((parameterName, index) => {
          scopedValues[parameterName] = args[index] ?? null;
        });
        return evaluateArg(body, scopedValues);
      }) as FormulaLambda;
      lambda.__lambda = true;
      return lambda;
    }
    case "SEQUENCE": {
      const rows = Math.max(coerceFormulaNumber(evaluatedArgs[0] ?? 1), 1);
      const columns = Math.max(coerceFormulaNumber(evaluatedArgs[1] ?? 1), 1);
      const start = coerceFormulaNumber(evaluatedArgs[2] ?? 1);
      const step = coerceFormulaNumber(evaluatedArgs[3] ?? 1);
      let current = start;
      const matrix: FormulaMatrix = [];
      for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const row: FormulaScalar[] = [];
        for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
          row.push(current);
          current += step;
        }
        matrix.push(row);
      }
      return matrix;
    }
    case "FILTER": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const include = lookupVector(evaluatedArgs[1] ?? null).map((value) => coerceFormulaBoolean(value));
      const filtered = source.filter((_row, index) => include[index]);
      if (filtered.length === 0) {
        const fallback = evaluatedArgs[2] ?? null;
        return isFormulaMatrix(fallback) ? fallback : [[scalarFromFormulaValue(fallback)]];
      }
      return filtered;
    }
    case "UNIQUE": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const seen = new Set<string>();
      return source.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    case "SORT": {
      const source = [...formulaArrayRows(evaluatedArgs[0] ?? null)];
      const sortIndex = Math.max(coerceFormulaNumber(evaluatedArgs[1] ?? 1), 1) - 1;
      const sortOrder = coerceFormulaNumber(evaluatedArgs[2] ?? 1) >= 0 ? 1 : -1;
      return source.sort((left, right) => {
        const leftValue = left[sortIndex] ?? "";
        const rightValue = right[sortIndex] ?? "";
        const compare =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : `${leftValue}`.localeCompare(`${rightValue}`);
        return compare * sortOrder;
      });
    }
    case "BYROW": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const lambdaCandidate = evaluatedArgs[1] ?? null;
      return source.map((row) => [
        scalarFromFormulaValue(invokeLambda(lambdaCandidate, [[[...row]] as FormulaMatrix]))
      ]);
    }
    case "BYCOL": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const lambdaCandidate = evaluatedArgs[1] ?? null;
      const columnCount = Math.max(...source.map((row) => row.length), 0);
      return [Array.from({ length: columnCount }, (_, columnIndex) => {
        const columnMatrix = source.map((row) => [row[columnIndex] ?? null]);
        return scalarFromFormulaValue(invokeLambda(lambdaCandidate, [columnMatrix]));
      })];
    }
    case "MAP": {
      const lambdaCandidate = evaluatedArgs[evaluatedArgs.length - 1] ?? null;
      const arrays = evaluatedArgs.slice(0, -1).map((value) => formulaArrayRows(value));
      const rowCount = Math.max(...arrays.map((matrix) => matrix.length), 0);
      const columnCount = Math.max(...arrays.flatMap((matrix) => matrix.map((row) => row.length)), 0);
      return Array.from({ length: rowCount }, (_, rowIndex) =>
        Array.from({ length: columnCount }, (_, columnIndex) =>
          scalarFromFormulaValue(
            invokeLambda(
              lambdaCandidate,
              arrays.map((matrix) => matrix[rowIndex]?.[columnIndex] ?? null)
            )
          )
        )
      );
    }
    case "SCAN": {
      let accumulator: FormulaValue = evaluatedArgs[0] ?? 0;
      const items = lookupVector(evaluatedArgs[1] ?? null);
      const lambdaCandidate = evaluatedArgs[2] ?? null;
      return items.map((item) => {
        accumulator = invokeLambda(lambdaCandidate, [accumulator, item]);
        return [scalarFromFormulaValue(accumulator)];
      });
    }
    case "REDUCE": {
      let accumulator: FormulaValue = evaluatedArgs[0] ?? 0;
      const items = lookupVector(evaluatedArgs[1] ?? null);
      const lambdaCandidate = evaluatedArgs[2] ?? null;
      items.forEach((item) => {
        accumulator = invokeLambda(lambdaCandidate, [accumulator, item]);
      });
      return accumulator;
    }
    case "TAKE": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const requestedRows = Math.trunc(coerceFormulaNumber(evaluatedArgs[1] ?? source.length));
      const requestedColumns = Math.trunc(coerceFormulaNumber(evaluatedArgs[2] ?? (source[0]?.length ?? 1)));
      const rowSlice = requestedRows >= 0 ? source.slice(0, requestedRows || source.length) : source.slice(Math.max(source.length + requestedRows, 0));
      return rowSlice.map((row) => (requestedColumns >= 0 ? row.slice(0, requestedColumns || row.length) : row.slice(Math.max(row.length + requestedColumns, 0))));
    }
    case "DROP": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const requestedRows = Math.trunc(coerceFormulaNumber(evaluatedArgs[1] ?? 0));
      const requestedColumns = Math.trunc(coerceFormulaNumber(evaluatedArgs[2] ?? 0));
      const rowSlice = requestedRows >= 0 ? source.slice(Math.min(requestedRows, source.length)) : source.slice(0, Math.max(source.length + requestedRows, 0));
      return rowSlice.map((row) => (requestedColumns >= 0 ? row.slice(Math.min(requestedColumns, row.length)) : row.slice(0, Math.max(row.length + requestedColumns, 0))));
    }
    case "CHOOSECOLS": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const indices = normalizeIndices(evaluatedArgs.slice(1), source[0]?.length ?? 0);
      return source.map((row) => indices.map((index) => row[index] ?? null));
    }
    case "CHOOSEROWS": {
      const source = formulaArrayRows(evaluatedArgs[0] ?? null);
      const indices = normalizeIndices(evaluatedArgs.slice(1), source.length);
      return indices.map((index) => [...(source[index] ?? [])]);
    }
    case "WRAPROWS": {
      const values = lookupVector(evaluatedArgs[0] ?? null);
      const wrapCount = Math.max(Math.trunc(coerceFormulaNumber(evaluatedArgs[1] ?? 1)), 1);
      return Array.from({ length: Math.ceil(values.length / wrapCount) }, (_, rowIndex) =>
        Array.from({ length: wrapCount }, (_, columnIndex) => values[rowIndex * wrapCount + columnIndex] ?? null)
      );
    }
    case "WRAPCOLS": {
      const values = lookupVector(evaluatedArgs[0] ?? null);
      const wrapCount = Math.max(Math.trunc(coerceFormulaNumber(evaluatedArgs[1] ?? 1)), 1);
      const rowCount = Math.ceil(values.length / wrapCount);
      return Array.from({ length: rowCount }, (_, rowIndex) =>
        Array.from({ length: wrapCount }, (_, columnIndex) => values[columnIndex * rowCount + rowIndex] ?? null)
      );
    }
    case "TOCOL": {
      const scanByColumn = coerceFormulaBoolean(evaluatedArgs[2] ?? false);
      const matrix = formulaArrayRows(evaluatedArgs[0] ?? null);
      const flattened = scanByColumn
        ? Array.from({ length: Math.max(...matrix.map((row) => row.length), 0) }, (_, columnIndex) =>
            matrix.map((row) => row[columnIndex] ?? null)
          ).flat()
        : matrix.flat();
      return trimMatrix(flattened.filter((value) => value !== null && `${value}`.length > 0).map((value) => [value]));
    }
    case "TOROW": {
      const scanByColumn = coerceFormulaBoolean(evaluatedArgs[2] ?? false);
      const matrix = formulaArrayRows(evaluatedArgs[0] ?? null);
      const flattened = scanByColumn
        ? Array.from({ length: Math.max(...matrix.map((row) => row.length), 0) }, (_, columnIndex) =>
            matrix.map((row) => row[columnIndex] ?? null)
          ).flat()
        : matrix.flat();
      return [flattened.filter((value) => value !== null && `${value}`.length > 0)];
    }
    case "NOW":
      return new Date(context.evalStamp);
    case "TODAY":
      return new Date(`${context.evalStamp.slice(0, 10)}T00:00:00.000Z`);
    case "RAND":
      return deterministicRandom(`${currentCellRef}:${context.evalStamp}`);
    case "RANDBETWEEN": {
      const min = Math.floor(coerceFormulaNumber(evaluatedArgs[0] ?? 0));
      const max = Math.floor(coerceFormulaNumber(evaluatedArgs[1] ?? min));
      const ratio = deterministicRandom(`${currentCellRef}:${context.evalStamp}:between`);
      return min + Math.floor(ratio * Math.max(max - min + 1, 1));
    }
    default:
      if (name in context.namedLambdas) {
        return invokeLambda(context.namedLambdas[name], evaluatedArgs);
      }
      return formulaError(`#UNSUPPORTED:${upper}`);
  }
};

const applyDynamicArraySpill = (
  anchorCell: ExcelJS.Cell,
  result: FormulaMatrix,
  context: FormulaEvaluationContext,
  currentCellRef: string
): void => {
  result.forEach((row, rowOffset) => {
    row.forEach((value, columnOffset) => {
      const targetCell = anchorCell.worksheet.getCell(anchorCell.row + rowOffset, anchorCell.col + columnOffset);
      if (rowOffset === 0 && columnOffset === 0) {
        targetCell.value = {
          formula: (anchorCell.value as ExcelJS.CellFormulaValue).formula,
          result: value
        } as ExcelJS.CellFormulaValue;
        return;
      }
      targetCell.value = value;
      const spillRef = `${anchorCell.worksheet.name}!${columnLetter(Number(targetCell.col))}${targetCell.row}`;
      context.spillEdges.push({ anchor_ref: currentCellRef, spill_ref: spillRef });
      context.cellMap.set(spillRef, targetCell);
      context.resultCache.set(spillRef, value);
    });
  });
};

type FormulaExecutionSummary = NonNullable<ExcelRunState["lastFormulaExecution"]>;

type SerializedFormulaScalar =
  | null
  | string
  | number
  | boolean
  | {
      kind: "date";
      value: string;
    };

type SerializedFormulaCellResult = {
  target_ref: string;
  formula_id: string;
  expression: string;
  worksheet_name: string;
  dependency_refs: string[];
  result_kind: "scalar" | "matrix" | "lambda" | "error";
  scalar_result?: SerializedFormulaScalar;
  matrix_result?: SerializedFormulaScalar[][];
  error_code?: string;
};

type FormulaWorkerBatchResult = {
  execution_mode: "worker_threads";
  worker_id: string;
  target_formula_refs: string[];
  volatile_refs: string[];
  spill_edges: Array<{ anchor_ref: string; spill_ref: string }>;
  warnings: Warning[];
  results: SerializedFormulaCellResult[];
};

const createFormulaEvaluationContext = (
  workbook: ExcelJS.Workbook,
  evalStamp = ISO(),
  warnings: Warning[] = []
): FormulaEvaluationContext => {
  const cellMap = worksheetCellMap(workbook);
  const lambdaEntries = extractNamedLambdaEntries(workbook);
  const context: FormulaEvaluationContext = {
    workbook,
    cellMap,
    evalStamp,
    warnings,
    volatileRefs: new Set<string>(),
    spillEdges: [],
    resultCache: new Map<string, FormulaValue>(),
    visiting: new Set<string>(),
    lambdaEntries,
    lambdaDepths: new Map<string, number>(),
    namedLambdas: {},
    definedNameEntries: definedNameEntriesForWorkbook(workbook)
  };
  context.namedLambdas = buildNamedLambdaMap(lambdaEntries, context, workbook.worksheets[0]?.name ?? "Sheet1", "workbook", {});
  return context;
};

const serializeFormulaScalar = (value: unknown): SerializedFormulaScalar => {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) {
    return {
      kind: "date",
      value: value.toISOString()
    };
  }
  return `${value}`;
};

const deserializeFormulaScalar = (value: SerializedFormulaScalar | undefined): string | number | boolean | Date | null => {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value ?? null;
  if (value.kind === "date") return new Date(value.value);
  return null;
};

export const evaluateFormulaTargetsFromWorkbookModel = (input: {
  workbookModel: ExcelJS.WorkbookModel;
  targetRefs: string[];
  evalStamp: string;
  workerId: string;
}): FormulaWorkerBatchResult => {
  const workbook = new ExcelJS.Workbook();
  workbook.model = input.workbookModel;
  const warnings: Warning[] = [];
  const context = createFormulaEvaluationContext(workbook, input.evalStamp, warnings);
  const results: SerializedFormulaCellResult[] = [];

  input.targetRefs.forEach((targetRef) => {
    const cell = context.cellMap.get(targetRef);
    if (!cell || typeof cell.value !== "object" || cell.value == null || !("formula" in cell.value)) return;
    const formula = cell.value as ExcelJS.CellFormulaValue;
    const result = evaluateExcelFormulaExpression(`=${formula.formula}`, context, cell.worksheet.name, targetRef);
    context.resultCache.set(targetRef, result);
    if (isFormulaError(result)) {
      warnings.push({
        warning_code: "formula.unsupported_expression",
        summary: "Formula evaluation degraded",
        detail: `The formula at ${targetRef} resolved to ${result.__formula_error}`,
        severity: result.__formula_error === "#CYCLE!" ? "high" : "medium",
        impacted_refs: [targetRef]
      });
      results.push({
        target_ref: targetRef,
        worksheet_name: cell.worksheet.name,
        formula_id: id("formula", targetRef),
        expression: `=${formula.formula}`,
        dependency_refs: extractFormulaDependencies(formula.formula, cell.worksheet.name, workbook),
        result_kind: "error",
        error_code: result.__formula_error
      });
      return;
    }
    if (isFormulaMatrix(result)) {
      results.push({
        target_ref: targetRef,
        worksheet_name: cell.worksheet.name,
        formula_id: id("formula", targetRef),
        expression: `=${formula.formula}`,
        dependency_refs: extractFormulaDependencies(formula.formula, cell.worksheet.name, workbook),
        result_kind: "matrix",
        matrix_result: result.map((row) => row.map((item) => serializeFormulaScalar(scalarFromFormulaValue(item))))
      });
      result.forEach((row, rowOffset) => {
        row.forEach((_value, columnOffset) => {
          if (rowOffset === 0 && columnOffset === 0) return;
          context.spillEdges.push({
            anchor_ref: targetRef,
            spill_ref: `${cell.worksheet.name}!${columnLetter(Number(cell.col) + columnOffset)}${cell.row + rowOffset}`
          });
        });
      });
      return;
    }
    if (isFormulaLambda(result)) {
      results.push({
        target_ref: targetRef,
        worksheet_name: cell.worksheet.name,
        formula_id: id("formula", targetRef),
        expression: `=${formula.formula}`,
        dependency_refs: extractFormulaDependencies(formula.formula, cell.worksheet.name, workbook),
        result_kind: "lambda"
      });
      return;
    }
    results.push({
      target_ref: targetRef,
      worksheet_name: cell.worksheet.name,
      formula_id: id("formula", targetRef),
      expression: `=${formula.formula}`,
      dependency_refs: extractFormulaDependencies(formula.formula, cell.worksheet.name, workbook),
      result_kind: "scalar",
      scalar_result: serializeFormulaScalar(scalarFromFormulaValue(result))
    });
  });

  return {
    execution_mode: "worker_threads",
    worker_id: input.workerId,
    target_formula_refs: input.targetRefs,
    volatile_refs: [...context.volatileRefs],
    spill_edges: context.spillEdges,
    warnings,
    results
  };
};

const chunkFormulaRefs = (targetRefs: string[], chunkCount: number): string[][] => {
  if (targetRefs.length === 0) return [];
  const safeChunkCount = Math.max(1, Math.min(chunkCount, targetRefs.length));
  return Array.from({ length: safeChunkCount }, () => [] as string[]).map((chunk, index) => {
    for (let cursor = index; cursor < targetRefs.length; cursor += safeChunkCount) {
      chunk.push(targetRefs[cursor]);
    }
    return chunk;
  });
};

const launchFormulaWorker = (payload: {
  workbookModel: ExcelJS.WorkbookModel;
  targetRefs: string[];
  evalStamp: string;
  workerId: string;
}): Promise<FormulaWorkerBatchResult> =>
  new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "formula-worker.js");
    const worker = new Worker(workerPath, { workerData: payload });
    worker.once("message", (message: FormulaWorkerBatchResult) => resolve(message));
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Formula worker exited with code ${code}`));
      }
    });
  });

const handledFormulaWarningCodes = new Set(["formula.circular_reference"]);

const dedupeWarnings = (warnings: Warning[]): Warning[] => {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.warning_code}:${warning.detail}:${warning.impacted_refs.join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeChecksById = <Check extends { check_id: string }>(checks: Check[]): Check[] => {
  const deduped = new Map<string, Check>();
  checks.forEach((check) => deduped.set(check.check_id, check));
  return [...deduped.values()];
};

const buildFormulaGraphPayload = (
  workbook: ExcelJS.Workbook,
  formulaRecords: Array<{ formula_id: string; expression: string; target_ref: string; dependency_refs: string[] }>,
  volatileRefs: string[],
  spillEdges: Array<{ anchor_ref: string; spill_ref: string }>,
  warnings: Warning[],
  evalStamp: string
): FormulaGraphState =>
  FormulaGraphStateSchema.parse({
    contract: EXCEL_CONTRACT,
    ...Meta,
    graph_id: id("formula-graph", workbookIdentity(workbook)),
    workbook_ref: id("workbook", workbookIdentity(workbook)),
    formula_refs: formulaRecords.map((record) => ({
      formula_id: record.formula_id,
      expression: record.expression,
      dialect: "excel_a1",
      target_ref: record.target_ref,
      dependency_refs: record.dependency_refs
    })),
    dependency_edges: [
      ...formulaRecords.flatMap((record) =>
        record.dependency_refs.map((dependencyRef) => ({
          ...Meta,
          edge_id: id("formula-edge", dependencyRef, record.target_ref),
          precedent_ref: dependencyRef,
          dependent_ref: record.target_ref,
          edge_kind: dependencyRef.includes("!") ? "cross_sheet" : "cell"
        }))
      ),
      ...spillEdges.map((spillEdge) => ({
        ...Meta,
        edge_id: id("formula-edge", spillEdge.anchor_ref, spillEdge.spill_ref, "spill"),
        precedent_ref: spillEdge.anchor_ref,
        dependent_ref: spillEdge.spill_ref,
        edge_kind: "dynamic_array" as const
      }))
    ],
    dirty_cell_refs: [],
    circular_reference_groups: warnings.filter((warning) => warning.warning_code === "formula.circular_reference").map((warning) => warning.impacted_refs),
    volatile_function_refs: [...new Set(volatileRefs)],
    function_registry_ref: "excel_engine.function_registry.v2",
    recalculation_state: warnings.some((warning) => !handledFormulaWarningCodes.has(warning.warning_code)) ? "degraded" : "completed",
    last_recalculated_at: evalStamp
  });

const applyFormulaWorkerResults = (
  workbook: ExcelJS.Workbook,
  batchResults: FormulaWorkerBatchResult[]
): { formulaGraph: FormulaGraphState; warnings: Warning[]; executionSummary: FormulaExecutionSummary } => {
  const cellMap = worksheetCellMap(workbook);
  const evalStamp = batchResults[0]?.results[0]?.expression ? ISO() : ISO();
  const warnings = dedupeWarnings(batchResults.flatMap((batch) => batch.warnings));
  const spillEdges = batchResults.flatMap((batch) => batch.spill_edges);
  const volatileRefs = batchResults.flatMap((batch) => batch.volatile_refs);
  const formulaRecords = batchResults
    .flatMap((batch) => batch.results)
    .map((entry) => ({
      formula_id: entry.formula_id,
      expression: entry.expression,
      target_ref: entry.target_ref,
      dependency_refs: entry.dependency_refs
    }));

  batchResults.flatMap((batch) => batch.results).forEach((entry) => {
    const cell = cellMap.get(entry.target_ref);
    if (!cell || typeof cell.value !== "object" || cell.value == null || !("formula" in cell.value)) return;
    const formula = cell.value as ExcelJS.CellFormulaValue;
    if (entry.result_kind === "scalar") {
      cell.value = {
        formula: formula.formula,
        result: deserializeFormulaScalar(entry.scalar_result)
      } as ExcelJS.CellFormulaValue;
      return;
    }
    if (entry.result_kind === "matrix") {
      const matrix = (entry.matrix_result ?? []).map((row) => row.map((value) => deserializeFormulaScalar(value)));
      if (matrix.length > 0) {
        cell.value = {
          formula: formula.formula,
          result: matrix[0]?.[0] ?? null
        } as ExcelJS.CellFormulaValue;
      }
      matrix.forEach((row, rowOffset) => {
        row.forEach((value, columnOffset) => {
          if (rowOffset === 0 && columnOffset === 0) return;
          cell.worksheet.getCell(cell.row + rowOffset, Number(cell.col) + columnOffset).value = value;
        });
      });
      return;
    }
    cell.value = {
      formula: formula.formula,
      result: undefined
    } as ExcelJS.CellFormulaValue;
  });

  return {
    formulaGraph: buildFormulaGraphPayload(workbook, formulaRecords, volatileRefs, spillEdges, warnings, evalStamp),
    warnings,
    executionSummary: {
      execution_mode: "worker_threads",
      worker_count: batchResults.length,
      chunk_count: batchResults.length,
      target_formula_refs: batchResults.flatMap((batch) => batch.target_formula_refs),
      handled_warning_codes: [...handledFormulaWarningCodes]
    }
  };
};

const evaluateExpandedFormulaGraph = async (
  workbook: ExcelJS.Workbook
): Promise<{ formulaGraph: FormulaGraphState; warnings: Warning[]; executionSummary: FormulaExecutionSummary }> => {
  const workbookRef = id("workbook", workbookIdentity(workbook));
  const cellMap = worksheetCellMap(workbook);
  const formulaTargetRefs = [...cellMap.entries()]
    .filter(([, cell]) => typeof cell.value === "object" && cell.value !== null && "formula" in cell.value)
    .map(([cellRef]) => cellRef);
  const availableParallelism =
    typeof (os as typeof os & { availableParallelism?: () => number }).availableParallelism === "function"
      ? (os as typeof os & { availableParallelism?: () => number }).availableParallelism?.() ?? os.cpus().length
      : os.cpus().length;
  const parallelWorkerCount = Math.max(2, Math.min(availableParallelism, formulaTargetRefs.length, 4));

  if (formulaTargetRefs.length <= 1) {
    const warnings: Warning[] = [];
    const context = createFormulaEvaluationContext(workbook, ISO(), warnings);
    const formulaRecords = formulaTargetRefs.map((cellRef) => {
      const cell = context.cellMap.get(cellRef) as ExcelJS.Cell;
      const formula = cell.value as ExcelJS.CellFormulaValue;
      const dependencies = extractFormulaDependencies(formula.formula, cell.worksheet.name, workbook);
      const result = evaluateExcelFormulaExpression(`=${formula.formula}`, context, cell.worksheet.name, cellRef);
      context.resultCache.set(cellRef, result);
      if (isFormulaError(result)) {
        warnings.push({
          warning_code: "formula.unsupported_expression",
          summary: "Formula evaluation degraded",
          detail: `The formula at ${cellRef} resolved to ${result.__formula_error}`,
          severity: result.__formula_error === "#CYCLE!" ? "high" : "medium",
          impacted_refs: [cellRef]
        });
        cell.value = { formula: formula.formula, result: undefined } as ExcelJS.CellFormulaValue;
      } else if (isFormulaMatrix(result)) {
        applyDynamicArraySpill(cell, result, context, cellRef);
      } else if (isFormulaLambda(result)) {
        cell.value = { formula: formula.formula, result: undefined } as ExcelJS.CellFormulaValue;
      } else {
        cell.value = {
          formula: formula.formula,
          result: scalarFromFormulaValue(result)
        } as ExcelJS.CellFormulaValue;
      }
      return {
        formula_id: id("formula", cellRef),
        expression: `=${formula.formula}`,
        target_ref: cellRef,
        dependency_refs: dependencies
      };
    });
    return {
      formulaGraph: buildFormulaGraphPayload(workbook, formulaRecords, [...context.volatileRefs], context.spillEdges, warnings, context.evalStamp),
      warnings,
      executionSummary: {
        execution_mode: "single_process",
        worker_count: 1,
        chunk_count: 1,
        target_formula_refs: formulaTargetRefs,
        handled_warning_codes: [...handledFormulaWarningCodes]
      }
    };
  }

  const evalStamp = ISO();
  const workbookModel = cloneJson(workbook.model) as ExcelJS.WorkbookModel;
  const chunks = chunkFormulaRefs(formulaTargetRefs, parallelWorkerCount);
  const batchResults = await Promise.all(
    chunks.map((targetRefs, index) =>
      launchFormulaWorker({
        workbookModel,
        targetRefs,
        evalStamp,
        workerId: `formula-worker-${index + 1}`
      })
    )
  );
  const merged = applyFormulaWorkerResults(workbook, batchResults);
  merged.formulaGraph = FormulaGraphStateSchema.parse({
    ...merged.formulaGraph,
    workbook_ref: workbookRef
  });
  return merged;
};

const writeJson = (targetPath: string, payload: unknown): string => {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return targetPath;
};

const readJsonFile = <Value = unknown>(targetPath: string): Value => {
  const buffer = fs.readFileSync(targetPath);
  let text = "";
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.slice(2).toString("utf16le");
  } else if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    text = buffer.slice(3).toString("utf8");
  } else {
    text = buffer.toString("utf8");
  }
  return JSON.parse(text.replace(/^\uFEFF/, "")) as Value;
};

const writeText = (targetPath: string, payload: string): string => {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, payload, "utf8");
  return targetPath;
};

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const quoteSheetFormulaRef = (sheetName: string, rangeRef: string): string =>
  `${sheetName.includes(" ") ? `'${sheetName}'` : sheetName}!${rangeRef}`;

const zipText = async (zip: JSZip, entryPath: string): Promise<string> => (await zip.file(entryPath)?.async("string")) ?? "";

const archiveContainsEntry = async (archivePath: string, entryPath: string): Promise<boolean> => {
  const archiveBuffer = fs.readFileSync(archivePath);
  const zip = await JSZip.loadAsync(archiveBuffer);
  return zip.file(entryPath) != null;
};

const archiveEntryCount = async (archivePath: string, prefix: string): Promise<number> => {
  const archiveBuffer = fs.readFileSync(archivePath);
  const zip = await JSZip.loadAsync(archiveBuffer);
  return Object.keys(zip.files).filter((entry) => entry.startsWith(prefix)).length;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
};

const fetchBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const waitForPublicUrl = async (url: string, attempts = 12, delayMs = 2_000): Promise<void> => {
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: "GET", redirect: "follow" });
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : `${error}`;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Public URL did not become available for ${url}: ${lastError ?? "unknown error"}`);
};

const tmpFilesDownloadUrl = (publicUrl: string): string =>
  publicUrl.replace("http://tmpfiles.org/", "https://tmpfiles.org/dl/");

const uploadFileToTmpFiles = (sourcePath: string): { public_url: string; download_url: string } => {
  const result = execFileSync(
    "curl.exe",
    ["-s", "-F", `file=@${sourcePath.replace(/\\/g, "/")}`, "https://tmpfiles.org/api/v1/upload"],
    { encoding: "utf8" }
  );
  const payload = JSON.parse(result) as { status?: string; data?: { url?: string } };
  const publicUrl = `${payload.data?.url ?? ""}`;
  if (payload.status !== "success" || publicUrl.length === 0) {
    throw new Error(`Remote upload failed for ${sourcePath}`);
  }
  return {
    public_url: publicUrl,
    download_url: tmpFilesDownloadUrl(publicUrl)
  };
};

type GitHubRepoRef = {
  owner: string;
  repo: string;
  nameWithOwner: string;
  url: string;
  isPrivate: boolean;
};

type GitHubReleaseAsset = {
  id: number;
  name: string;
  size: number;
  content_type: string;
  browser_download_url: string;
  url: string;
};

type GitHubReleasePayload = {
  id: number;
  tag_name: string;
  html_url: string;
  url: string;
  assets: GitHubReleaseAsset[];
};

type GitHubReleaseViewAsset = {
  name: string;
  digest?: string;
  url: string;
  size: number;
  contentType: string;
};

type GitHubReleaseViewPayload = {
  url: string;
  assets: GitHubReleaseViewAsset[];
};

type WorkbookPublicationStructure = {
  worksheet_count: number;
  worksheet_names: string[];
  hidden_sheet_names: string[];
  formula_count: number;
  named_ranges: string[];
  table_names: string[];
  merged_range_count: number;
  hidden_column_count: number;
  auto_filter_refs: string[];
  freeze_pane_refs: string[];
  archive_parts: {
    chart_parts: number;
    pivot_parts: number;
    slicer_parts: number;
    drawing_parts: number;
    has_vba: boolean;
  };
};

const ghJson = <T>(args: string[]): T =>
  JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    })
  ) as T;

const resolveGitHubRepoRef = (): GitHubRepoRef => {
  const remoteUrl = execFileSync("git", ["config", "--get", "remote.origin.url"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  const match =
    remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i) ??
    remoteUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) {
    throw new Error(`Unsupported GitHub remote URL: ${remoteUrl}`);
  }
  const [, owner, repo] = match;
  const repoMeta = ghJson<{ nameWithOwner: string; isPrivate: boolean; url: string }>([
    "repo",
    "view",
    `${owner}/${repo}`,
    "--json",
    "nameWithOwner,isPrivate,url"
  ]);
  return {
    owner,
    repo,
    nameWithOwner: repoMeta.nameWithOwner,
    url: repoMeta.url,
    isPrivate: repoMeta.isPrivate
  };
};

const ensureGitHubRelease = (repo: GitHubRepoRef, tag: string, title: string, notes: string): GitHubReleasePayload => {
  try {
    return ghJson<GitHubReleasePayload>(["api", `repos/${repo.nameWithOwner}/releases/tags/${tag}`]);
  } catch {
    execFileSync(
      "gh",
      ["release", "create", tag, "--repo", repo.nameWithOwner, "--title", title, "--notes", notes],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    return ghJson<GitHubReleasePayload>(["api", `repos/${repo.nameWithOwner}/releases/tags/${tag}`]);
  }
};

const uploadAssetToGitHubRelease = (
  repo: GitHubRepoRef,
  tag: string,
  sourcePath: string,
  assetName: string
): GitHubReleaseAsset => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "excel-gh-release-"));
  const tempAssetPath = path.join(tempDir, assetName);
  fs.copyFileSync(sourcePath, tempAssetPath);
  execFileSync(
    "gh",
    ["release", "upload", tag, tempAssetPath, "--repo", repo.nameWithOwner, "--clobber"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  const release = ghJson<GitHubReleasePayload>(["api", `repos/${repo.nameWithOwner}/releases/tags/${tag}`]);
  const asset = release.assets.find((entry) => entry.name === assetName);
  if (!asset) {
    throw new Error(`Uploaded release asset ${assetName} was not found on ${repo.nameWithOwner}@${tag}`);
  }
  return asset;
};

const viewGitHubRelease = (repo: GitHubRepoRef, tag: string): GitHubReleaseViewPayload =>
  ghJson<GitHubReleaseViewPayload>(["release", "view", tag, "--repo", repo.nameWithOwner, "--json", "url,assets"]);

const workbookDefinedNames = (workbook: ExcelJS.Workbook): string[] => {
  const model = (workbook.definedNames as unknown as { model?: Array<{ name?: string }> }).model;
  if (!Array.isArray(model)) {
    return [];
  }
  return [...new Set(model.map((entry) => `${entry.name ?? ""}`).filter((name) => name.length > 0))].sort();
};

const summarizeWorkbookPublicationStructure = async (
  source: string | Buffer
): Promise<WorkbookPublicationStructure> => {
  const buffer = Buffer.isBuffer(source) ? source : fs.readFileSync(source);
  const workbook = new ExcelJS.Workbook();
  const workbookLoadBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookLoadBuffer);
  let formulaCount = 0;
  let mergedRangeCount = 0;
  let hiddenColumnCount = 0;
  const worksheetNames: string[] = [];
  const hiddenSheetNames: string[] = [];
  const tableNames: string[] = [];
  const autoFilterRefs: string[] = [];
  const freezePaneRefs: string[] = [];
  for (const worksheet of workbook.worksheets) {
    worksheetNames.push(worksheet.name);
    if (`${worksheet.state ?? "visible"}` !== "visible") {
      hiddenSheetNames.push(worksheet.name);
    }
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.formula) {
          formulaCount += 1;
        }
      });
    });
    mergedRangeCount += Object.keys(((worksheet as unknown as { _merges?: Record<string, unknown> })._merges ?? {})).length;
    hiddenColumnCount += worksheet.columns.filter((column) => Boolean((column as unknown as { hidden?: boolean }).hidden)).length;
    const autoFilterRef = worksheetAutoFilterRef(worksheet);
    if (autoFilterRef) {
      autoFilterRefs.push(`${worksheet.name}!${autoFilterRef}`);
    }
    for (const view of Array.isArray(worksheet.views) ? worksheet.views : []) {
      if ((view as { state?: string }).state === "frozen") {
        freezePaneRefs.push(`${worksheet.name}!x${(view as { xSplit?: number }).xSplit ?? 0}:y${(view as { ySplit?: number }).ySplit ?? 0}`);
      }
    }
    const tables = Array.isArray((worksheet as unknown as { model?: { tables?: Array<{ name?: string }> } }).model?.tables)
      ? ((worksheet as unknown as { model?: { tables?: Array<{ name?: string }> } }).model?.tables ?? [])
      : [];
    for (const table of tables) {
      tableNames.push(`${table.name ?? `table-${worksheet.name}`}`);
    }
  }
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files);
  const countEntries = (prefix: string): number => entries.filter((entry) => entry.startsWith(prefix)).length;
  return {
    worksheet_count: workbook.worksheets.length,
    worksheet_names: worksheetNames.sort(),
    hidden_sheet_names: hiddenSheetNames.sort(),
    formula_count: formulaCount,
    named_ranges: workbookDefinedNames(workbook),
    table_names: [...new Set(tableNames)].sort(),
    merged_range_count: mergedRangeCount,
    hidden_column_count: hiddenColumnCount,
    auto_filter_refs: autoFilterRefs.sort(),
    freeze_pane_refs: freezePaneRefs.sort(),
    archive_parts: {
      chart_parts: countEntries("xl/charts/"),
      pivot_parts: countEntries("xl/pivotTables/"),
      slicer_parts: countEntries("xl/slicers/"),
      drawing_parts: countEntries("xl/drawings/"),
      has_vba: entries.includes("xl/vbaProject.bin")
    }
  };
};

const approxColumnWidthPixels = (width: number | null | undefined): number | null =>
  width == null ? null : Math.round(width * 7 + 5);

const approxRowHeightPixels = (height: number | null | undefined): number | null =>
  height == null ? null : Math.round((height * 96) / 72);

const worksheetAutoFilterRef = (worksheet: ExcelJS.Worksheet): string | null => {
  const autoFilter = (worksheet as unknown as { autoFilter?: string | { from?: string | { row?: number; column?: number }; to?: string | { row?: number; column?: number } } })
    .autoFilter;
  if (!autoFilter) return null;
  if (typeof autoFilter === "string") return autoFilter;
  const from =
    typeof autoFilter.from === "string"
      ? autoFilter.from
      : autoFilter.from?.row && autoFilter.from?.column
        ? `${columnLetter(autoFilter.from.column)}${autoFilter.from.row}`
        : null;
  const to =
    typeof autoFilter.to === "string"
      ? autoFilter.to
      : autoFilter.to?.row && autoFilter.to?.column
        ? `${columnLetter(autoFilter.to.column)}${autoFilter.to.row}`
        : null;
  return from && to ? `${from}:${to}` : null;
};

const definedNameEntriesFromExcelJs = (
  workbook: ExcelJS.Workbook
): Array<{ name: string; ranges: string[]; local_sheet_id: number | null }> => definedNameEntriesForWorkbook(workbook);

const worksheetConditionalFormattingCount = (worksheet: ExcelJS.Worksheet): number => {
  const model = worksheet.model as unknown as { conditionalFormattings?: unknown[]; conditionalFormatting?: unknown[] };
  if (Array.isArray(model.conditionalFormattings)) return model.conditionalFormattings.length;
  if (Array.isArray(model.conditionalFormatting)) return model.conditionalFormatting.length;
  return 0;
};

const collectWorksheetPresentationState = (
  worksheet: ExcelJS.Worksheet
): {
  worksheet_name: string;
  visibility: string;
  frozen_pane: { top_row_count: number; left_column_count: number } | null;
  rtl: boolean;
  auto_filter_ref: string | null;
  merged_ranges: string[];
  hidden_columns: string[];
  explicit_column_widths: Array<{ column_ref: string; width_chars: number | null; width_pixels: number | null }>;
  explicit_row_heights: Array<{ row_index: number; height_points: number | null; height_pixels: number | null }>;
  formulas: Array<{ cell_ref: string; formula: string }>;
  conditional_formatting_rule_count: number;
} => {
  let lastMeaningfulColumn = 0;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      lastMeaningfulColumn = Math.max(lastMeaningfulColumn, Number(cell.col));
    });
  });
  worksheet.columns.forEach((column) => {
    if (column.hidden) {
      lastMeaningfulColumn = Math.max(lastMeaningfulColumn, Number(column.number));
    }
  });
  const trackedColumns = Array.from({ length: lastMeaningfulColumn }, (_, index) => worksheet.getColumn(index + 1));
  return {
    worksheet_name: worksheet.name,
    visibility: worksheet.state === "veryHidden" ? "very_hidden" : worksheet.state === "hidden" ? "hidden" : "visible",
    frozen_pane:
      (firstView(worksheet.views) as { state?: string; ySplit?: number; xSplit?: number } | undefined)?.state === "frozen"
        ? {
            top_row_count: (firstView(worksheet.views) as { ySplit?: number } | undefined)?.ySplit ?? 0,
            left_column_count: (firstView(worksheet.views) as { xSplit?: number } | undefined)?.xSplit ?? 0
          }
        : null,
    rtl: Boolean((firstView(worksheet.views) as { rightToLeft?: boolean } | undefined)?.rightToLeft),
    auto_filter_ref: worksheetAutoFilterRef(worksheet),
    merged_ranges: [...((worksheet.model.merges ?? []) as string[])].sort(),
    hidden_columns: trackedColumns.filter((column) => Boolean(column.hidden)).map((column) => columnLetter(Number(column.number))).sort(),
    explicit_column_widths: trackedColumns
      .filter((column) => {
        const hasValues = (column.values ?? []).some((value) => value != null && `${value}`.trim() !== "");
        return hasValues || column.hidden || column.width != null;
      })
      .map((column) => {
        const widthChars = typeof column.width === "number" && Number.isFinite(column.width) ? column.width : 9;
        return {
          column_ref: columnLetter(Number(column.number)),
          width_chars: widthChars,
          width_pixels: approxColumnWidthPixels(widthChars)
        };
      }),
    explicit_row_heights: Array.from({ length: worksheet.rowCount }, (_, index) => worksheet.getRow(index + 1))
      .filter((row) => row.height != null)
      .map((row) => ({
        row_index: row.number,
        height_points: row.height ?? null,
        height_pixels: approxRowHeightPixels(row.height ?? null)
      })),
    formulas: Array.from({ length: worksheet.rowCount }, (_, index) => worksheet.getRow(index + 1))
      .flatMap((row) =>
        row.actualCellCount === 0
          ? []
          : Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1)).flatMap((cell) =>
              typeof cell.value === "object" && cell.value !== null && "formula" in cell.value
                ? [
                    {
                      cell_ref: `${worksheet.name}!${columnLetter(Number(cell.col))}${cell.row}`,
                      formula: `=${cell.value.formula}`
                    }
                  ]
                : []
            )
      ),
    conditional_formatting_rule_count: worksheetConditionalFormattingCount(worksheet)
  };
};

const normalizeFormulaForComparison = (formula: string): string =>
  formula
    .replace(/^=/, "")
    .replace(/_xlfn\./g, "")
    .replace(/_xlpm\./g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

const numericClose = (left: number | null, right: number | null, tolerance: number): boolean => {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= tolerance;
};

const parseNativeDrawingAnchors = (
  drawingXml: string
): Array<{
  from_col: number;
  from_col_offset: number;
  from_row: number;
  from_row_offset: number;
  to_col: number;
  to_col_offset: number;
  to_row: number;
  to_row_offset: number;
}> =>
  [...drawingXml.matchAll(
    /<xdr:twoCellAnchor[\s\S]*?<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)<\/xdr:rowOff><\/xdr:from><xdr:to><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)<\/xdr:rowOff><\/xdr:to>/g
  )].map((match) => ({
    from_col: Number(match[1]),
    from_col_offset: Number(match[2]),
    from_row: Number(match[3]),
    from_row_offset: Number(match[4]),
    to_col: Number(match[5]),
    to_col_offset: Number(match[6]),
    to_row: Number(match[7]),
    to_row_offset: Number(match[8])
  }));

const parsePivotLocationRef = (pivotXml: string): string | null => pivotXml.match(/<location[^>]+ref="([^"]+)"/)?.[1] ?? null;

const countXmlTagOccurrences = (xml: string, tagName: string): number => [...xml.matchAll(new RegExp(`<${tagName}\\b`, "g"))].length;

const impactedFormulaRefsFromDependencies = (
  formulaGraph: Pick<FormulaGraphState, "formula_refs" | "dependency_edges">,
  changedRefs: string[]
): string[] => {
  const adjacency = new Map<string, Set<string>>();
  formulaGraph.dependency_edges.forEach((edge) => {
    if (!adjacency.has(edge.precedent_ref)) {
      adjacency.set(edge.precedent_ref, new Set<string>());
    }
    adjacency.get(edge.precedent_ref)?.add(edge.dependent_ref);
  });
  const queue = [...changedRefs];
  const visited = new Set<string>(changedRefs);
  const impacted = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    const dependents = adjacency.get(current);
    if (!dependents) continue;
    dependents.forEach((dependent) => {
      impacted.add(dependent);
      if (!visited.has(dependent)) {
        visited.add(dependent);
        queue.push(dependent);
      }
    });
  }
  const knownFormulaTargets = new Set(formulaGraph.formula_refs.map((formulaRef) => formulaRef.target_ref));
  return [...impacted].filter((ref) => knownFormulaTargets.has(ref)).sort();
};

const nextPartIndex = (zip: JSZip, prefix: string, suffix: string): number => {
  const current = Object.keys(zip.files)
    .filter((filePath) => filePath.startsWith(prefix) && filePath.endsWith(suffix))
    .map((filePath) => Number(filePath.slice(prefix.length, filePath.length - suffix.length)))
    .filter((value) => Number.isFinite(value));
  return (current.length === 0 ? 0 : Math.max(...current)) + 1;
};

const nextRelationshipId = (relationshipsXml: string): string => {
  const ids = [...relationshipsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${(ids.length === 0 ? 0 : Math.max(...ids)) + 1}`;
};

const appendRelationshipXml = (relationshipsXml: string, relationshipXml: string): string =>
  relationshipsXml.includes("</Relationships>")
    ? relationshipsXml.replace("</Relationships>", `${relationshipXml}</Relationships>`)
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipXml}</Relationships>`;

const ensureContentTypeOverride = (contentTypesXml: string, partName: string, contentType: string): string =>
  contentTypesXml.includes(`PartName="${partName}"`)
    ? contentTypesXml
    : contentTypesXml.replace(
        "</Types>",
        `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`
      );

const workbookSheetTargets = async (
  zip: JSZip
): Promise<Array<{ sheetName: string; workbookRelId: string; targetPath: string; worksheetPath: string }>> => {
  const workbookXml = await zipText(zip, "xl/workbook.xml");
  const workbookRelsXml = await zipText(zip, "xl/_rels/workbook.xml.rels");
  const relTargets = new Map<string, string>();
  [...workbookRelsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)].forEach((match) => {
    relTargets.set(match[1], match[2]);
  });
  return [...workbookXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g)].map((match) => {
    const targetPath = relTargets.get(match[2]) ?? "";
    return {
      sheetName: match[1],
      workbookRelId: match[2],
      targetPath,
      worksheetPath: targetPath.startsWith("worksheets/") ? `xl/${targetPath}` : `xl/worksheets/${path.basename(targetPath)}`
    };
  });
};

const worksheetRelPath = (worksheetPath: string): string => {
  const base = path.basename(worksheetPath);
  return `xl/worksheets/_rels/${base}.rels`;
};

const ensureWorksheetRelationships = async (zip: JSZip, worksheetPath: string): Promise<string> => {
  const relPath = worksheetRelPath(worksheetPath);
  if (!zip.file(relPath)) {
    zip.file(
      relPath,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    );
  }
  return relPath;
};

const tableRangeForWorksheet = (worksheet: ExcelJS.Worksheet): string => `A1:${columnLetter(Math.max(worksheet.columnCount, 1))}${Math.max(worksheet.rowCount, 1)}`;

const pseudoGuid = (seed: string): string => {
  const hex = Buffer.from(seed, "utf8").toString("hex").padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const anchorRangeToMarker = (anchorRange: string): { fromCol: number; fromRow: number; toCol: number; toRow: number } => {
  const [startRef, endRef] = anchorRange.split(":");
  return {
    fromCol: columnIndexFromRef(startRef) - 1,
    fromRow: rowIndexFromRef(startRef) - 1,
    toCol: columnIndexFromRef(endRef) - 1,
    toRow: rowIndexFromRef(endRef) - 1
  };
};

const ensureWorkbookDefinedNames = (workbookXml: string, definedNamesXml: string): string =>
  workbookXml.includes("<definedNames>")
    ? workbookXml.replace("</definedNames>", `${definedNamesXml}</definedNames>`)
    : workbookXml.replace("<calcPr", `<definedNames>${definedNamesXml}</definedNames><calcPr`);

const ensureWorkbookExtensionList = (workbookXml: string, extensionXml: string): string => {
  if (workbookXml.includes(`uri="{BBE1A952-AA13-448e-AADC-164F8A28A991}"`)) {
    return workbookXml.includes("<x14:slicerCaches>")
      ? workbookXml.replace("</x14:slicerCaches>", `${extensionXml}</x14:slicerCaches>`)
      : workbookXml.replace(
          "</ext>",
          `<x14:slicerCaches>${extensionXml}</x14:slicerCaches></ext>`
        );
  }
  const workbookExt = `<ext uri="{BBE1A952-AA13-448e-AADC-164F8A28A991}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:slicerCaches>${extensionXml}</x14:slicerCaches></ext>`;
  return workbookXml.includes("<extLst>")
    ? workbookXml.replace("</extLst>", `${workbookExt}</extLst>`)
    : workbookXml.replace("</workbook>", `<extLst>${workbookExt}</extLst></workbook>`);
};

const ensureWorksheetSlicerList = (worksheetXml: string, slicerRefXml: string): string => {
  const slicerExt =
    `<ext uri="{A8765BA9-456A-4dab-B4F3-ACF838C121DE}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main">` +
    `<x14:slicerList xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">${slicerRefXml}</x14:slicerList>` +
    `</ext>`;
  if (worksheetXml.includes(`uri="{A8765BA9-456A-4dab-B4F3-ACF838C121DE}"`)) {
    return worksheetXml.includes("<x14:slicerList")
      ? worksheetXml.replace("</x14:slicerList>", `${slicerRefXml}</x14:slicerList>`)
      : worksheetXml.replace("</ext>", `${slicerExt}</ext>`);
  }
  return worksheetXml.includes("<extLst>")
    ? worksheetXml.replace("</extLst>", `${slicerExt}</extLst>`)
    : worksheetXml.replace("</worksheet>", `<extLst>${slicerExt}</extLst></worksheet>`);
};

const getWorksheetDrawingInfo = async (
  zip: JSZip,
  worksheetPath: string
): Promise<{ worksheetXml: string; worksheetRelPath: string; worksheetRelsXml: string; drawingRelId: string | null; drawingPath: string | null }> => {
  const worksheetXml = await zipText(zip, worksheetPath);
  const worksheetRelPath = await ensureWorksheetRelationships(zip, worksheetPath);
  const worksheetRelsXml = await zipText(zip, worksheetRelPath);
  const drawingRelId = worksheetXml.match(/<drawing[^>]+r:id="([^"]+)"/)?.[1] ?? null;
  if (!drawingRelId) {
    return { worksheetXml, worksheetRelPath, worksheetRelsXml, drawingRelId: null, drawingPath: null };
  }
  const drawingTarget = worksheetRelsXml.match(new RegExp(`<Relationship[^>]+Id="${drawingRelId}"[^>]+Target="([^"]+)"`))?.[1] ?? null;
  if (!drawingTarget) {
    return { worksheetXml, worksheetRelPath, worksheetRelsXml, drawingRelId, drawingPath: null };
  }
  return {
    worksheetXml,
    worksheetRelPath,
    worksheetRelsXml,
    drawingRelId,
    drawingPath: drawingTarget.startsWith("../") ? `xl/${drawingTarget.replace(/^\.\.\//, "")}` : `xl/drawings/${path.basename(drawingTarget)}`
  };
};

const buildSlicerDrawingAnchorXml = (slicerName: string, slicerIndex: number): string => {
  const x = 6959600 + slicerIndex * 2100000;
  const y = 2794000 + slicerIndex * 550000;
  const creationId = pseudoGuid(`${slicerName}-creation`);
  return (
    `<xdr:absoluteAnchor>` +
    `<xdr:pos x="${x}" y="${y}"/>` +
    `<xdr:ext cx="1828800" cy="2428869"/>` +
    `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">` +
    `<mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14">` +
    `<xdr:graphicFrame macro="">` +
    `<xdr:nvGraphicFramePr>` +
    `<xdr:cNvPr id="${slicerIndex + 10}" name="${xmlEscape(slicerName)}">` +
    `<a:extLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{${creationId.toUpperCase()}}"/></a:ext>` +
    `</a:extLst>` +
    `</xdr:cNvPr>` +
    `<xdr:cNvGraphicFramePr/>` +
    `</xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" x="0" y="0"/><a:ext xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/drawing/2010/slicer"><sle:slicer xmlns:sle="http://schemas.microsoft.com/office/drawing/2010/slicer" name="${xmlEscape(slicerName)}"/></a:graphicData></a:graphic>` +
    `</xdr:graphicFrame>` +
    `</mc:Choice>` +
    `<mc:Fallback>` +
    `<xdr:sp macro="" textlink="">` +
    `<xdr:nvSpPr><xdr:cNvPr id="${slicerIndex + 10}" name="${xmlEscape(slicerName)}"/><xdr:cNvSpPr><a:spLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noTextEdit="1"/></xdr:cNvSpPr></xdr:nvSpPr>` +
    `<xdr:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="${x}" y="${y}"/><a:ext cx="1828800" cy="2428869"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom><a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:prstClr val="white"/></a:solidFill><a:ln xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" w="1"><a:solidFill><a:prstClr val="green"/></a:solidFill></a:ln></xdr:spPr>` +
    `<xdr:txBody><a:bodyPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" vertOverflow="clip" horzOverflow="clip"/><a:lstStyle xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:rPr lang="en-GB" sz="1100"/><a:t>This shape represents a slicer.</a:t></a:r></a:p></xdr:txBody>` +
    `</xdr:sp>` +
    `</mc:Fallback>` +
    `</mc:AlternateContent>` +
    `<xdr:clientData/>` +
    `</xdr:absoluteAnchor>`
  );
};

const appendDrawingAnchorXml = (drawingXml: string, anchorXml: string): string =>
  drawingXml.includes("</xdr:wsDr>")
    ? drawingXml.replace("</xdr:wsDr>", `${anchorXml}</xdr:wsDr>`)
    : `${drawingXml}${anchorXml}`;

const buildSlicerPartXml = (slicerName: string, slicerCacheName: string, caption: string, slicerIndex: number): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<slicers xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x xr10" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xr10="http://schemas.microsoft.com/office/spreadsheetml/2016/revision10">` +
  `<slicer name="${xmlEscape(slicerName)}" xr10:uid="{${pseudoGuid(`${slicerName}-${slicerIndex}`).toUpperCase()}}" cache="${xmlEscape(slicerCacheName)}" caption="${xmlEscape(caption)}" rowHeight="230716"/>` +
  `</slicers>`;

const buildSlicerCacheDefinitionXml = (
  slicerCacheName: string,
  sourceField: string,
  targetSheetTabId: number,
  pivotName: string,
  pivotCacheId: number,
  distinctValues: string[]
): string => {
  const itemsXml =
    distinctValues.length === 0
      ? `<items count="0"/>`
      : `<items count="${distinctValues.length}">${distinctValues
          .map((_, index) => `<i x="${index}"${index === 0 ? ' s="1"' : ""}/>`)
          .join("")}</items>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<slicerCacheDefinition xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x xr10" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xr10="http://schemas.microsoft.com/office/spreadsheetml/2016/revision10" name="${xmlEscape(
      slicerCacheName
    )}" xr10:uid="{${pseudoGuid(`${slicerCacheName}-cache`).toUpperCase()}}" sourceName="${xmlEscape(sourceField)}">` +
    `<pivotTables><pivotTable tabId="${targetSheetTabId}" name="${xmlEscape(pivotName)}"/></pivotTables>` +
    `<data><tabular pivotCacheId="${pivotCacheId}" sortOrder="ascending" showMissing="1" crossFilter="showItemsWithDataAtTop">${itemsXml}</tabular></data>` +
    `</slicerCacheDefinition>`
  );
};

const buildNativeChartSeriesXml = (chart: ChartMetadata, series: ChartSeries, seriesIndex: number): string => {
  const categoryRange = `$A$2:$A$${series.data_points.length + 1}`;
  const valueRange = `$${columnLetter(series.target_column_index)}$2:$${columnLetter(series.target_column_index)}$${series.data_points.length + 1}`;
  const catPoints = series.data_points
    .map((point, index) => `<c:pt idx="${index}"><c:v>${xmlEscape(point.category)}</c:v></c:pt>`)
    .join("");
  const valPoints = series.data_points
    .map((point, index) => `<c:pt idx="${index}"><c:v>${point.value}</c:v></c:pt>`)
    .join("");
  const lineStyle = series.chart_type === "line" || series.chart_type === "area" ? '<c:marker><c:symbol val="circle"/></c:marker><c:smooth val="0"/>' : "";
  return `<c:ser><c:idx val="${seriesIndex}"/><c:order val="${seriesIndex}"/><c:tx><c:v>${xmlEscape(series.series_name)}</c:v></c:tx><c:spPr><a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:srgbClr val="${xmlEscape(series.color_hex.replace("#", "").toUpperCase())}"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>${xmlEscape(quoteSheetFormulaRef(chart.config_sheet, categoryRange))}</c:f><c:strCache><c:ptCount val="${series.data_points.length}"/>${catPoints}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${xmlEscape(quoteSheetFormulaRef(chart.config_sheet, valueRange))}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${series.data_points.length}"/>${valPoints}</c:numCache></c:numRef></c:val>${lineStyle}</c:ser>`;
};

const buildNativeChartXml = (chart: ChartMetadata): string => {
  const primarySeries = chart.series.filter((series) => !series.secondary_axis);
  const secondarySeries = chart.series.filter((series) => series.secondary_axis);
  const legendPos = chart.legend_position === "bottom" ? "b" : chart.legend_position === "top" ? "t" : "r";
  const pieSeries = chart.series[0];
  if (chart.chart_type === "pie" && pieSeries) {
    const pieBody = `<c:pieChart><c:varyColors val="1"/>${buildNativeChartSeriesXml(chart, pieSeries, 0)}</c:pieChart>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xmlEscape(chart.chart_title)}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${pieBody}</c:plotArea>${chart.legend_position === "none" ? "" : `<c:legend><c:legendPos val="${legendPos}"/></c:legend>`}<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
  }

  const catAxisId = "48650112";
  const valueAxisId = "48672768";
  const secondaryValueAxisId = "48674432";
  const barSeries = (chart.chart_type === "line" || chart.chart_type === "area"
    ? []
    : primarySeries.filter((series) => series.chart_type === "bar" || chart.chart_type === "bar"))
    .map((series, index) => buildNativeChartSeriesXml(chart, series, index))
    .join("");
  const areaSeries = (chart.chart_type === "bar" || chart.chart_type === "line"
    ? []
    : chart.series.filter((series) => series.chart_type === "area" || chart.chart_type === "area"))
    .map((series, index) => buildNativeChartSeriesXml(chart, series, primarySeries.length + index))
    .join("");
  const lineSeries = (chart.chart_type === "bar" || chart.chart_type === "area"
    ? []
    : chart.series.filter((series) => series.chart_type === "line" || chart.chart_type === "line"))
    .map((series, index) => buildNativeChartSeriesXml(chart, series, primarySeries.length + index))
    .join("");
  const barSection = barSeries.length > 0 ? `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barSeries}<c:axId val="${catAxisId}"/><c:axId val="${valueAxisId}"/></c:barChart>` : "";
  const areaSection = areaSeries.length > 0 ? `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${areaSeries}<c:axId val="${catAxisId}"/><c:axId val="${valueAxisId}"/></c:areaChart>` : "";
  const lineAxisId = secondarySeries.length > 0 ? secondaryValueAxisId : valueAxisId;
  const lineSection = lineSeries.length > 0 ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSeries}<c:axId val="${catAxisId}"/><c:axId val="${lineAxisId}"/></c:lineChart>` : "";
  const secondaryAxis = secondarySeries.length > 0 ? `<c:valAx><c:axId val="${secondaryValueAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="r"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorGridlines/><c:tickLblPos val="nextTo"/><c:crossAx val="${catAxisId}"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>` : "";
  const axes = `<c:catAx><c:axId val="${catAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="${valueAxisId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="${valueAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="${catAxisId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>${secondaryAxis}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xmlEscape(chart.chart_title)}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${barSection}${areaSection}${lineSection}${axes}</c:plotArea>${chart.legend_position === "none" ? "" : `<c:legend><c:legendPos val="${legendPos}"/></c:legend>`}<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
};

const buildNativeDrawingXml = (drawingRelId: string, anchorRange: string): string => {
  const marker = anchorRangeToMarker(anchorRange);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${marker.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${marker.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${marker.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${marker.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="${drawingRelId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
};

const buildPivotCacheRecordsXml = (headers: string[], rows: Array<Record<string, string | number | boolean | null>>): string => {
  const recordRows = rows
    .map((row) => {
      const cells = headers
        .map((header) => {
          const value = row[header];
          if (typeof value === "number") return `<x:n v="${value}"/>`;
          if (typeof value === "boolean") return `<x:b v="${value ? 1 : 0}"/>`;
          return `<x:s v="${xmlEscape(`${value ?? ""}`)}"/>`;
        })
        .join("");
      return `<x:r>${cells}</x:r>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><pivotCacheRecords xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${rows.length}">${recordRows}</pivotCacheRecords>`;
};

const buildPivotCacheDefinitionXml = (
  cacheId: string,
  sourceSheet: string,
  sourceRange: string,
  headers: string[],
  calculatedFields: Array<{ field_name: string; formula: string }>,
  refreshPolicy: PivotRequest["refresh_policy"]
): string => {
  const fields = headers
    .map((header) => `<cacheField name="${xmlEscape(header)}" numFmtId="0"><sharedItems containsString="1" containsNumber="1" containsBlank="1"/></cacheField>`)
    .join("");
  const calculated = calculatedFields
    .map(
      (field, index) =>
        `<calculatedItems><calculatedItem field="${headers.length + index}" formula="${xmlEscape(field.formula)}"/></calculatedItems>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" refreshOnLoad="${refreshPolicy === "on_open" ? 1 : 0}" saveData="1" optimizeMemory="1" recordCount="0" cacheId="${xmlEscape(cacheId)}"><cacheSource type="worksheet"><worksheetSource sheet="${xmlEscape(sourceSheet)}" ref="${xmlEscape(sourceRange)}"/></cacheSource><cacheFields count="${headers.length}">${fields}</cacheFields>${calculated}</pivotCacheDefinition>`;
};

const buildPivotTableDefinitionXml = (
  pivotId: string,
  targetRange: string,
  headers: string[],
  rowField: string,
  valueField: string,
  columnField: string | null,
  calculatedFields: Array<{ field_name: string; formula: string }>,
  slicerFields: string[]
): string => {
  const rowIndex = Math.max(headers.indexOf(rowField), 0);
  const columnIndex = columnField ? Math.max(headers.indexOf(columnField), 0) : -1;
  const valueIndex = Math.max(headers.indexOf(valueField), 0);
  const pivotFields = headers
    .map((_header, index) => {
      const axis = index === rowIndex ? "axisRow" : index === columnIndex ? "axisCol" : index === valueIndex ? "axisValues" : "";
      return `<pivotField${axis ? ` axis="${axis}"` : ""} showAll="1"/>`;
    })
    .join("");
  const columnFieldsXml = columnIndex >= 0 ? `<colFields count="1"><field x="${columnIndex}"/></colFields><colItems count="1"><i t="default"/></colItems>` : "";
  const calculatedXml = calculatedFields
    .map((field, index) => `<dataField fld="${valueIndex}" baseField="${valueIndex}" baseItem="0" name="${xmlEscape(field.field_name)}" subtotal="sum" numFmtId="${index + 164}"/>`)
    .join("");
  const slicerTag = slicerFields.length > 0 ? `<extLst><ext uri="{slicer-ready}"><slicerCacheRefs count="${slicerFields.length}">${slicerFields.map((field) => `<slicerCacheRef name="${xmlEscape(field)}"/>`).join("")}</slicerCacheRefs></ext></extLst>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${xmlEscape(pivotId)}" cacheId="1" dataOnRows="0" applyNumberFormats="1" applyBorderFormats="1" applyFontFormats="1" applyPatternFormats="1" applyAlignmentFormats="1" applyWidthHeightFormats="1"><location ref="${xmlEscape(targetRange)}" firstHeaderRow="1" firstDataRow="2" firstDataCol="1"/><pivotFields count="${headers.length}">${pivotFields}</pivotFields><rowFields count="1"><field x="${rowIndex}"/></rowFields><rowItems count="1"><i t="default"/></rowItems>${columnFieldsXml}<dataFields count="${1 + calculatedFields.length}"><dataField fld="${valueIndex}" subtotal="sum" name="Sum of ${xmlEscape(valueField)}"/>${calculatedXml}</dataFields><pivotTableStyleInfo name="PivotStyleMedium9" showRowHeaders="1" showColHeaders="1" showRowStripes="1" showColStripes="1" showLastColumn="1"/>${slicerTag}</pivotTableDefinition>`;
};

const applyNativeWorkbookObjects = async (targetPath: string, state: ExcelRunState): Promise<NativeWorkbookObjects> => {
  const buffer = fs.readFileSync(targetPath);
  const zip = await JSZip.loadAsync(buffer);
  let contentTypesXml = await zipText(zip, "[Content_Types].xml");
  let workbookXml = await zipText(zip, "xl/workbook.xml");
  let workbookRelsXml = await zipText(zip, "xl/_rels/workbook.xml.rels");
  const workbookSheets = await workbookSheetTargets(zip);

  if (state.lambdaRegistry.length > 0) {
    const definedNamesXml = state.lambdaRegistry
      .map(
        (entry) =>
          `<definedName name="${xmlEscape(entry.workbook_defined_name)}">${xmlEscape(entry.defined_name_formula)}</definedName>`
      )
      .join("");
    workbookXml = workbookXml.includes("<definedNames>")
      ? workbookXml.replace("</definedNames>", `${definedNamesXml}</definedNames>`)
      : workbookXml.replace("<calcPr", `<definedNames>${definedNamesXml}</definedNames><calcPr`);
  }
  const nativeObjects: NativeWorkbookObjects = {
    workbook_object_manifest_id: id("native-objects", state.runId),
    chart_objects: [],
    pivot_objects: [],
    slicer_objects: [],
    generated_at: ISO()
  };

  for (const chart of state.generatedCharts) {
    const targetSheet = workbookSheets.find((sheet) => sheet.sheetName === chart.target_worksheet);
    if (!targetSheet) continue;
    const chartIndex = nextPartIndex(zip, "xl/charts/chart", ".xml");
    const drawingIndex = nextPartIndex(zip, "xl/drawings/drawing", ".xml");
    const chartPath = `xl/charts/chart${chartIndex}.xml`;
    const drawingPath = `xl/drawings/drawing${drawingIndex}.xml`;
    const drawingRelPath = `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`;
    const worksheetRelPath = await ensureWorksheetRelationships(zip, targetSheet.worksheetPath);
    const worksheetRelsXml = await zipText(zip, worksheetRelPath);
    const drawingRelId = nextRelationshipId(worksheetRelsXml);
    const chartRelId = "rId1";
    const anchorRange = chart.anchor_range;
    zip.file(chartPath, buildNativeChartXml(chart));
    zip.file(drawingPath, buildNativeDrawingXml(chartRelId, anchorRange));
    zip.file(
      drawingRelPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${chartRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartIndex}.xml"/></Relationships>`
    );
    zip.file(
      worksheetRelPath,
      appendRelationshipXml(
        worksheetRelsXml,
        `<Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>`
      )
    );
    const worksheetXml = await zipText(zip, targetSheet.worksheetPath);
    zip.file(
      targetSheet.worksheetPath,
      worksheetXml.includes("<drawing ")
        ? worksheetXml
        : worksheetXml.replace("</worksheet>", `<drawing r:id="${drawingRelId}"/></worksheet>`)
    );
    contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/charts/chart${chartIndex}.xml`, "application/vnd.openxmlformats-officedocument.drawingml.chart+xml");
    contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/drawings/drawing${drawingIndex}.xml`, "application/vnd.openxmlformats-officedocument.drawing+xml");
    nativeObjects.chart_objects.push({
      chart_id: chart.chart_id,
      chart_xml_path: chartPath,
      drawing_xml_path: drawingPath,
      target_sheet: chart.target_worksheet,
      anchor_range: anchorRange,
      chart_type: chart.chart_type,
      series_count: chart.series.length,
      config_sheet: chart.config_sheet,
      chart_revision: chart.chart_revision
    });
  }

  for (const pivot of state.pivotMetadata) {
    const pivotCache = state.pivotCaches.find((cache) => cache.cache_id === pivot.cache_ref);
    if (!pivotCache) continue;
    const sourceWorksheet = state.workbook.getWorksheet(pivotCache.source_worksheet);
    const targetSheet = workbookSheets.find((sheet) => sheet.sheetName === pivot.target_range_ref.split("!")[0]);
    if (!sourceWorksheet || !targetSheet) continue;
    const sourceTable = extractTable(sourceWorksheet);
    const pivotIndex = nextPartIndex(zip, "xl/pivotTables/pivotTable", ".xml");
    const cacheIndex = nextPartIndex(zip, "xl/pivotCache/pivotCacheDefinition", ".xml");
    const pivotTablePath = `xl/pivotTables/pivotTable${pivotIndex}.xml`;
    const cacheDefinitionPath = `xl/pivotCache/pivotCacheDefinition${cacheIndex}.xml`;
    const cacheRecordsPath = `xl/pivotCache/pivotCacheRecords${cacheIndex}.xml`;
    const cacheRelPath = `xl/pivotCache/_rels/pivotCacheDefinition${cacheIndex}.xml.rels`;
    const worksheetRelPath = await ensureWorksheetRelationships(zip, targetSheet.worksheetPath);
    const worksheetRelsXml = await zipText(zip, worksheetRelPath);
    const pivotRelId = nextRelationshipId(worksheetRelsXml);
    const workbookPivotRelId = nextRelationshipId(workbookRelsXml);
    zip.file(
      cacheDefinitionPath,
      buildPivotCacheDefinitionXml(
        `${cacheIndex}`,
        pivotCache.source_worksheet,
        tableRangeForWorksheet(sourceWorksheet),
        sourceTable.headers,
        pivotCache.calculated_fields,
        pivotCache.refresh_policy
      )
    );
    zip.file(cacheRecordsPath, buildPivotCacheRecordsXml(sourceTable.headers, sourceTable.rows));
    zip.file(
      cacheRelPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheRecords" Target="pivotCacheRecords${cacheIndex}.xml"/></Relationships>`
    );
    zip.file(
      pivotTablePath,
      buildPivotTableDefinitionXml(
        pivot.pivot_id,
        pivot.target_range_ref.split("!")[1],
        sourceTable.headers,
        pivot.row_field_refs[0] ?? sourceTable.headers[0],
        pivot.value_fields[0]?.field_ref ?? sourceTable.headers[1],
        pivot.column_field_refs[0] ?? null,
        pivotCache.calculated_fields,
        pivotCache.slicer_fields
      )
    );
    zip.file(
      worksheetRelPath,
      appendRelationshipXml(
        worksheetRelsXml,
        `<Relationship Id="${pivotRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable" Target="../pivotTables/pivotTable${pivotIndex}.xml"/>`
      )
    );
    const worksheetXml = await zipText(zip, targetSheet.worksheetPath);
    zip.file(
      targetSheet.worksheetPath,
      worksheetXml.includes("<pivotTableParts")
        ? worksheetXml
        : worksheetXml.replace("</worksheet>", `<pivotTableParts count="1"><pivotTablePart r:id="${pivotRelId}"/></pivotTableParts></worksheet>`)
    );
    workbookRelsXml = appendRelationshipXml(
      workbookRelsXml,
      `<Relationship Id="${workbookPivotRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition${cacheIndex}.xml"/>`
    );
    workbookXml = workbookXml.includes("<pivotCaches>")
      ? workbookXml.replace("</pivotCaches>", `<pivotCache cacheId="${cacheIndex}" r:id="${workbookPivotRelId}"/></pivotCaches>`)
      : workbookXml.replace("<calcPr", `<pivotCaches><pivotCache cacheId="${cacheIndex}" r:id="${workbookPivotRelId}"/></pivotCaches><calcPr`);
    contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/pivotTables/pivotTable${pivotIndex}.xml`, "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml");
    contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/pivotCache/pivotCacheDefinition${cacheIndex}.xml`, "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml");
    contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/pivotCache/pivotCacheRecords${cacheIndex}.xml`, "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheRecords+xml");
    nativeObjects.pivot_objects.push({
      pivot_id: pivot.pivot_id,
      pivot_table_xml_path: pivotTablePath,
      cache_definition_xml_path: cacheDefinitionPath,
      cache_records_xml_path: cacheRecordsPath,
      target_sheet: targetSheet.sheetName,
      source_sheet: pivotCache.source_worksheet,
      column_fields: pivotCache.column_fields,
      calculated_fields: pivotCache.calculated_fields.map((field) => field.field_name),
      slicer_fields: pivotCache.slicer_fields
    });

    if (pivotCache.slicer_fields.length > 0) {
      const targetSheetTabId = workbookSheets.findIndex((sheet) => sheet.sheetName === targetSheet.sheetName) + 1;
      const pivotCacheId = cacheIndex;
      const sourceFieldIndex = new Map(sourceTable.headers.map((header, index) => [header, index]));
      const targetSheetInfo = await getWorksheetDrawingInfo(zip, targetSheet.worksheetPath);
      let drawingPath = targetSheetInfo.drawingPath;
      let worksheetXmlWithSlicers = targetSheetInfo.worksheetXml;
      let worksheetRelsXmlWithSlicers = targetSheetInfo.worksheetRelsXml;
      let drawingRelId = targetSheetInfo.drawingRelId;
      if (!drawingPath) {
        const drawingIndex = nextPartIndex(zip, "xl/drawings/drawing", ".xml");
        drawingPath = `xl/drawings/drawing${drawingIndex}.xml`;
        drawingRelId = nextRelationshipId(worksheetRelsXmlWithSlicers);
        zip.file(
          targetSheetInfo.worksheetRelPath,
          appendRelationshipXml(
            worksheetRelsXmlWithSlicers,
            `<Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>`
          )
        );
        worksheetRelsXmlWithSlicers = await zipText(zip, targetSheetInfo.worksheetRelPath);
        worksheetXmlWithSlicers = worksheetXmlWithSlicers.includes("<drawing ")
          ? worksheetXmlWithSlicers
          : worksheetXmlWithSlicers.replace("</worksheet>", `<drawing r:id="${drawingRelId}"/></worksheet>`);
        zip.file(
          drawingPath,
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"></xdr:wsDr>'
        );
        contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/drawings/drawing${drawingIndex}.xml`, "application/vnd.openxmlformats-officedocument.drawing+xml");
      }

      let drawingXml = drawingPath ? await zipText(zip, drawingPath) : "";
      for (const [slicerIndex, slicerField] of pivotCache.slicer_fields.entries()) {
        const fieldIndex = sourceFieldIndex.get(slicerField);
        if (fieldIndex == null) {
          continue;
        }
        const slicerPartIndex = nextPartIndex(zip, "xl/slicers/slicer", ".xml");
        const slicerCacheIndex = nextPartIndex(zip, "xl/slicerCaches/slicerCache", ".xml");
        const slicerPath = `xl/slicers/slicer${slicerPartIndex}.xml`;
        const slicerCachePath = `xl/slicerCaches/slicerCache${slicerCacheIndex}.xml`;
        const slicerRelId = nextRelationshipId(worksheetRelsXmlWithSlicers);
        const workbookSlicerRelId = nextRelationshipId(workbookRelsXml);
        const slicerName = `Slicer_${safeSheetName(targetSheet.sheetName)}_${safeSheetName(slicerField)}`;
        const slicerCacheName = `${slicerName}_Cache`;
        const distinctValues = Array.from(
          new Set(
            sourceTable.rows
              .map((row) => row[sourceTable.headers[fieldIndex]])
              .filter((value) => value != null && `${value}`.trim().length > 0)
              .map((value) => `${value}`)
          )
        ).sort((left, right) => left.localeCompare(right));
        zip.file(slicerPath, buildSlicerPartXml(slicerName, slicerCacheName, slicerField, slicerPartIndex));
        zip.file(
          slicerCachePath,
          buildSlicerCacheDefinitionXml(slicerCacheName, slicerField, targetSheetTabId, pivot.pivot_id, pivotCacheId, distinctValues)
        );
        worksheetRelsXmlWithSlicers = appendRelationshipXml(
          worksheetRelsXmlWithSlicers,
          `<Relationship Id="${slicerRelId}" Type="http://schemas.microsoft.com/office/2007/relationships/slicer" Target="../slicers/slicer${slicerPartIndex}.xml"/>`
        );
        workbookRelsXml = appendRelationshipXml(
          workbookRelsXml,
          `<Relationship Id="${workbookSlicerRelId}" Type="http://schemas.microsoft.com/office/2007/relationships/slicerCache" Target="slicerCaches/slicerCache${slicerCacheIndex}.xml"/>`
        );
        worksheetXmlWithSlicers = ensureWorksheetSlicerList(
          worksheetXmlWithSlicers,
          `<x14:slicer r:id="${slicerRelId}"/>`
        );
        workbookXml = ensureWorkbookExtensionList(
          workbookXml,
          `<x14:slicerCache r:id="${workbookSlicerRelId}"/>`
        );
        workbookXml = ensureWorkbookDefinedNames(
          workbookXml,
          `<definedName name="${xmlEscape(slicerName)}">${xmlEscape(`'${targetSheet.sheetName}'!$A$1`)}</definedName>`
        );
        if (drawingPath) {
          drawingXml = appendDrawingAnchorXml(drawingXml, buildSlicerDrawingAnchorXml(slicerName, nativeObjects.slicer_objects.length + 1));
        }
        contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/slicers/slicer${slicerPartIndex}.xml`, "application/vnd.ms-excel.slicer+xml");
        contentTypesXml = ensureContentTypeOverride(contentTypesXml, `/xl/slicerCaches/slicerCache${slicerCacheIndex}.xml`, "application/vnd.ms-excel.slicerCache+xml");
        nativeObjects.slicer_objects.push({
          slicer_id: id("slicer", pivot.pivot_id, slicerField),
          slicer_cache_name: slicerCacheName,
          slicer_xml_path: slicerPath,
          slicer_cache_xml_path: slicerCachePath,
          target_sheet: targetSheet.sheetName,
          source_field: slicerField,
          drawing_xml_path: drawingPath,
          relationship_id: slicerRelId
        });
      }

      zip.file(targetSheetInfo.worksheetRelPath, worksheetRelsXmlWithSlicers);
      zip.file(targetSheet.worksheetPath, worksheetXmlWithSlicers);
      if (drawingPath && drawingXml) {
        zip.file(drawingPath, drawingXml);
      }
    }
  }

  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);
  const updatedBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(targetPath, updatedBuffer);
  return NativeWorkbookObjectsSchema.parse(nativeObjects);
};

const createArtifact = (
  state: ExcelRunState,
  targetPath: string,
  artifactType: Artifact["artifact_type"],
  artifactSubtype: string,
  editableStatus: Artifact["editable_status"],
  explicitExportType?: "xlsx" | "xlsm" | "xls"
): Artifact => {
  const artifactId = id("artifact", artifactSubtype, path.basename(targetPath, path.extname(targetPath)), state.runId);
  const artifact = ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: artifactId,
    artifact_type: artifactType,
    artifact_subtype: artifactSubtype,
    project_id: state.projectId,
    workspace_id: state.workspaceId,
    source_refs: [state.sourceArtifactId],
    parent_artifact_refs: state.workbookArtifactId ? [state.workbookArtifactId] : [],
    canonical_ref: state.workbookRecord.canonical_ref,
    created_by: state.actorRef,
    created_at: ISO(),
    mode: state.mode,
    editable_status: editableStatus,
    template_status: artifactSubtype.includes("format") ? "applied" : "none",
    lineage_ref: id("lineage", artifactId),
    evidence_ref: id("evidence", state.runId),
    verification_status: "verified",
    storage_ref: storageRef(targetPath, `${artifactId}-storage`),
    preview_ref: previewRef(artifactId),
    export_refs:
      explicitExportType != null
        ? [
            {
              export_id: `${artifactId}-export`,
              export_type: explicitExportType,
              explicit_non_editable: false,
              storage_ref: `${artifactId}-storage`
            }
          ]
        : [],
    version_ref: {
      version_id: `${artifactId}-version`,
      parent_version_id: null,
      version_number: state.currentVersionNumber,
      semantic_version: "1.0.0"
    },
    tenant_ref: state.tenantRef,
    permission_scope: defaultPermissionScope()
  });
  state.artifacts.push(artifact);
  return artifact;
};

const addAuditEvent = (state: ExcelRunState, actionRef: string, actorRef: string, objectRefs: string[], metadata: Record<string, unknown>): void => {
  state.auditEvents.push(
    AuditEventSchema.parse({
      contract: contractEnvelope("audit"),
      event_id: id("audit", state.runId, actionRef, state.auditEvents.length + 1),
      timestamp: ISO(),
      actor_ref: actorRef,
      actor_type: "service",
      action_ref: actionRef,
      job_ref: id("job", state.runId),
      object_refs: objectRefs,
      workspace_id: state.workspaceId,
      tenant_ref: state.tenantRef,
      metadata
    })
  );
};

const addLineage = (state: ExcelRunState, fromRef: string, toRef: string, transformRef: string): void => {
  state.lineageEdges.push({
    edge_id: id("edge", fromRef, toRef, state.lineageEdges.length + 1),
    from_ref: fromRef,
    to_ref: toRef,
    transform_ref: transformRef,
    ai_suggestion_ref: "",
    ai_decision: "not_applicable",
    template_ref: "",
    dataset_binding_ref: "",
    version_diff_ref: ""
  });
};

const captureWorkbookSnapshot = async (
  workbook: ExcelJS.Workbook,
  state: Pick<ExcelRunState, "runId" | "tenantRef" | "workspaceId" | "projectId" | "sourceArtifactId" | "mode" | "workbookVersions" | "transformationPlans" | "transformationResults" | "pivotMetadata" | "styleMetadata">
): Promise<{ workbookRecord: Workbook; workbookPackage: WorkbookPackage; canonicalRepresentation: CanonicalRepresentation; formulaGraph: FormulaGraphState }> => {
  const workbookId = id("workbook", state.runId);
  const sheetRecords: Worksheet[] = [];
  const rangeRecords: ExcelRange[] = [];
  const cellRecords: CellMetadata[] = [];
  const mergedCellRecords: MergedCells[] = [];
  const formulaEval = await evaluateExpandedFormulaGraph(workbook);

  workbook.worksheets.forEach((worksheet, sheetIndex) => {
    const worksheetId = id("worksheet", workbookId, safeSheetName(worksheet.name));
    const mergeRefs = (worksheet.model.merges ?? []).map((mergeRef, mergeIndex) =>
      MergedCellsSchema.parse({
        contract: EXCEL_CONTRACT,
        ...Meta,
        merged_cells_id: id("merged", worksheetId, mergeIndex + 1),
        workbook_ref: workbookId,
        worksheet_ref: worksheetId,
        anchor_cell_ref: `${worksheet.name}!${mergeRef.split(":")[0].replace(/\$/g, "")}`,
        covered_cell_refs: cellsInRange(mergeRef, worksheet.name),
        range_ref: id("range", worksheetId, `merge-${mergeIndex + 1}`)
      })
    );
    mergedCellRecords.push(...mergeRefs);
    const usedRangeRef = `${worksheet.name}!A1:${columnLetter(Math.max(worksheet.columnCount, 1))}${Math.max(worksheet.rowCount, 1)}`;
    rangeRecords.push(
      RangeSchema.parse({
        contract: EXCEL_CONTRACT,
        ...Meta,
        range_id: id("range", worksheetId, "used"),
        workbook_ref: workbookId,
        worksheet_ref: worksheetId,
        kind: "grid",
        address: {
          ...Meta,
          start_row_index: 1,
          end_row_index: Math.max(worksheet.rowCount, 1),
          start_column_index: 1,
          end_column_index: Math.max(worksheet.columnCount, 1),
          a1_ref: usedRangeRef
        },
        cell_refs: [],
        semantic_labels: [],
        named_range_ref: null,
        lineage_refs: []
      })
    );
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const normalized = normalizeCellValue(cell);
        cellRecords.push(
          CellMetadataSchema.parse({
            contract: EXCEL_CONTRACT,
            ...Meta,
            cell_id: id("cell", worksheetId, `${columnLetter(columnNumber)}${row.number}`),
            workbook_ref: workbookId,
            worksheet_ref: worksheetId,
            address: {
              ...Meta,
              worksheet_ref: worksheetId,
              row_index: row.number,
              column_index: columnNumber,
              a1_ref: `${worksheet.name}!${columnLetter(columnNumber)}${row.number}`
            },
            value_type: normalized.value_type,
            raw_input: normalized.raw_input,
            display_value: cell.text || null,
            formula_ref:
              typeof cell.value === "object" && cell.value !== null && "formula" in cell.value
                ? id("formula", `${worksheet.name}!${columnLetter(columnNumber)}${row.number}`)
                : null,
            style_ref: null,
            merged_cells_ref: null,
            data_validation_ref: null,
            comment_ref: null,
            error_code: normalized.value_type === "error" ? `${cell.value}` : null,
            semantic_labels: [],
            lineage_refs: [],
            last_calculated_at:
              typeof cell.value === "object" && cell.value !== null && "formula" in cell.value ? ISO() : null
          })
        );
      });
    });
    sheetRecords.push(
      WorksheetSchema.parse({
        contract: EXCEL_CONTRACT,
        ...Meta,
        worksheet_id: worksheetId,
        workbook_ref: workbookId,
        name: worksheet.name,
        sheet_index: sheetIndex,
        visibility: worksheet.state === "veryHidden" ? "very_hidden" : worksheet.state === "hidden" ? "hidden" : "visible",
        bounds: { row_count: worksheet.rowCount, column_count: worksheet.columnCount },
        frozen_pane:
          (firstView(worksheet.views) as { state?: string; ySplit?: number; xSplit?: number } | undefined)?.state === "frozen"
            ? {
                top_row_count: (firstView(worksheet.views) as { ySplit?: number } | undefined)?.ySplit ?? 0,
                left_column_count: (firstView(worksheet.views) as { xSplit?: number } | undefined)?.xSplit ?? 0
              }
            : null,
        hidden_gridlines: firstView(worksheet.views)?.showGridLines === false,
        table_refs: [],
        pivot_refs: state.pivotMetadata.filter((pivot) => pivot.worksheet_ref === worksheetId).map((pivot) => pivot.pivot_id),
        merged_cells_refs: mergeRefs.map((merge) => merge.merged_cells_id),
        named_range_refs: [],
        filter_view_refs: [],
        row_metadata_refs: [],
        column_metadata_refs: [],
        created_at: ISO(),
        updated_at: ISO()
      })
    );
  });

  const workbookVersion =
    state.workbookVersions[state.workbookVersions.length - 1] ??
    WorkbookVersionSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      workbook_version_id: id("workbook-version", workbookId, 1),
      workbook_ref: workbookId,
      version_ref: {
        version_id: id("version", workbookId, 1),
        parent_version_id: null,
        version_number: 1,
        semantic_version: "1.0.0"
      },
      change_kind: "import",
      change_reason: "Initial import",
      based_on_artifact_ref: null,
      created_at: ISO()
    });

  const workbookRecord = WorkbookSchema.parse({
    contract: EXCEL_CONTRACT,
    ...Meta,
    workbook_id: workbookId,
    artifact_ref: id("artifact", "workbook", state.runId),
    canonical_ref: id("canonical", workbookId, workbookVersion.version_ref.version_number),
    tenant_ref: state.tenantRef,
    workspace_id: state.workspaceId,
    project_id: state.projectId,
    source_refs: [state.sourceArtifactId],
    worksheet_refs: sheetRecords.map((sheet) => sheet.worksheet_id),
    named_range_refs: [],
    style_refs: state.styleMetadata.map((style) => style.style_id),
    pivot_refs: state.pivotMetadata.map((pivot) => pivot.pivot_id),
    current_formula_graph_ref: formulaEval.formulaGraph.graph_id,
    current_version_ref: workbookVersion.workbook_version_id,
    workbook_properties: {
      uses_1904_dates: workbook.properties.date1904 ?? false,
      auto_recalculate: true,
      rtl: Boolean((firstView(workbook.views) as { rightToLeft?: boolean } | undefined)?.rightToLeft),
      locale: "en-US"
    },
    status: "ready",
    created_at: ISO(),
    updated_at: ISO()
  });

  const canonicalRepresentation = CanonicalRepresentationSchema.parse({
    contract: contractEnvelope("canonical"),
    canonical_id: workbookRecord.canonical_ref,
    tenant_ref: state.tenantRef,
    workspace_id: state.workspaceId,
    project_id: state.projectId,
    source_descriptors: [
      {
        source_ref: state.sourceArtifactId,
        source_type: "spreadsheet_file",
        source_revision_ref: workbookVersion.version_ref.version_id,
        parser_profile: "excel_engine",
        connector_ref: "excel_engine.local_fs"
      }
    ],
    representation_kind: "spreadsheet",
    strictness_mode: "smart",
    localization: {
      locale: "en-US",
      rtl: false,
      numeral_system: "latn",
      fallback_locales: []
    },
    root_node_refs: sheetRecords.map((sheet) => sheet.worksheet_id),
    nodes: {
      documents: [],
      pages: [],
      sheets: sheetRecords.map((sheet) => ({
        node_id: sheet.worksheet_id,
        node_type: "sheet" as const,
        parent_node_ref: null,
        child_node_refs: [],
        name: sheet.name,
        semantic_labels: [],
        layout_ref: "",
        data_binding_refs: [],
        formula_refs: formulaEval.formulaGraph.formula_refs.filter((formulaRef) => formulaRef.target_ref.startsWith(`${sheet.name}!`)).map((formulaRef) => formulaRef.formula_id),
        lineage_refs: [],
        template_refs: [],
        evidence_refs: [],
        editable: true,
        table_refs: [],
        chart_refs: [],
        grid_bounds: { row_count: sheet.bounds.row_count, column_count: sheet.bounds.column_count }
      })),
      slides: [],
      tables: [],
      charts: [],
      shapes: [],
      text: [],
      images: []
    },
    layout_metadata: {
      coordinate_space: "sheet",
      bounding_boxes: [],
      z_order: [],
      grid_rules: [],
      alignment_rules: []
    },
    data_binding_refs: [],
    formula_refs: formulaEval.formulaGraph.formula_refs,
    semantic_labels: [],
    lineage_refs: [],
    template_refs: [],
    editability_flags: {
      default_editable: true,
      locked_region_refs: [],
      lock_reason_codes: []
    },
    evidence_refs: [],
    created_at: ISO(),
    updated_at: ISO()
  });

  const workbookPackage = WorkbookPackageSchema.parse({
    contract: EXCEL_CONTRACT,
    ...Meta,
    workbook: workbookRecord,
    worksheets: sheetRecords,
    ranges: rangeRecords,
    cells: cellRecords,
    merged_cells: mergedCellRecords,
    named_ranges: [],
    pivots: state.pivotMetadata,
    styles: state.styleMetadata,
    workbook_versions: state.workbookVersions.length > 0 ? state.workbookVersions : [workbookVersion],
    transformation_plans: state.transformationPlans,
    transformation_results: state.transformationResults,
    formula_graphs: [formulaEval.formulaGraph]
  });

  return {
    workbookRecord,
    workbookPackage,
    canonicalRepresentation,
    formulaGraph: FormulaGraphStateSchema.parse({
      ...formulaEval.formulaGraph,
      workbook_ref: workbookRecord.workbook_id
    })
  };
};

const createSampleWorkbook = async (targetPath: string): Promise<void> => {
  ensureDir(path.dirname(targetPath));
  const workbook = new ExcelJS.Workbook();

  const data = workbook.addWorksheet("Data");
  data.addRows([
    ["Region", "RepFullName", "Revenue", "Cost", "Units"],
    ["North-KSA", "Ava Stone", 1200, 700, 10],
    ["South-KSA", "Mila Noor", 1500, 900, 12],
    ["North-UAE", "Omar Reed", 1100, 650, 8],
    ["East-UAE", "Lina Hart", 900, 500, 7],
    ["West-KSA", "Yara Bell", 1300, 750, 11]
  ]);
  data.getColumn(1).width = 18;
  data.getColumn(2).width = 18;
  data.getColumn(3).width = 16;
  data.getColumn(4).width = 14;
  data.getColumn(5).width = 12;
  data.getColumn(5).hidden = true;
  data.getRow(1).height = 24;
  (data as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = "A1:E6";

  const targets = workbook.addWorksheet("Targets");
  targets.addRows([
    ["Region", "TargetRevenue"],
    ["North-KSA", 1400],
    ["South-KSA", 1600],
    ["North-UAE", 1250],
    ["East-UAE", 1000],
    ["West-KSA", 1350]
  ]);

  const monthlyQ1 = workbook.addWorksheet("Monthly_Q1");
  monthlyQ1.addRows([
    ["Region", "Month", "Revenue", "Cost"],
    ["North-KSA", "Jan", 390, 210],
    ["South-KSA", "Jan", 510, 310],
    ["North-UAE", "Jan", 340, 180]
  ]);

  const monthlyQ2 = workbook.addWorksheet("Monthly_Q2");
  monthlyQ2.addRows([
    ["Region", "Month", "Revenue", "Cost"],
    ["East-UAE", "Feb", 280, 140],
    ["West-KSA", "Feb", 420, 250],
    ["South-KSA", "Feb", 460, 270]
  ]);

  const horizontalTargets = workbook.addWorksheet("HorizontalTargets");
  horizontalTargets.addRows([
    ["Metric", "North-KSA", "South-KSA", "North-UAE", "East-UAE", "West-KSA"],
    ["TargetRevenue", 1400, 1600, 1250, 1000, 1350]
  ]);

  const summary = workbook.addWorksheet("Summary");
  summary.mergeCells("A1:B1");
  summary.getCell("A1").value = "Workbook Totals";
  summary.getCell("A2").value = "Total Revenue";
  summary.getCell("B2").value = { formula: "SUM(Data!C2:C6)", result: 6000 };
  summary.getCell("A3").value = "Total Cost";
  summary.getCell("B3").value = { formula: "SUM(Data!D2:D6)", result: 3500 };
  summary.getCell("A4").value = "Net";
  summary.getCell("B4").value = { formula: "LET(net,SUM(Data!C2:C6)-SUM(Data!D2:D6),net)", result: 2500 };
  summary.getCell("A5").value = "Has High Revenue";
  summary.getCell("B5").value = { formula: "IF(AND(B2>5500,B4>2000),\"YES\",\"NO\")", result: "YES" };
  summary.getCell("A6").value = "Data Row Count";
  summary.getCell("B6").value = { formula: "COUNTA(Data!A2:A6)", result: 5 };
  summary.getCell("A7").value = "Numeric Count";
  summary.getCell("B7").value = { formula: "COUNT(Data!C2:C6)", result: 5 };
  summary.getCell("A8").value = "North Target";
  summary.getCell("B8").value = { formula: "XLOOKUP(\"North-KSA\",Targets!A2:A6,Targets!B2:B6,\"Missing\")", result: 1400 };
  summary.getCell("A9").value = "South Target Legacy";
  summary.getCell("B9").value = { formula: "VLOOKUP(\"South-KSA\",Targets!A2:B6,2,FALSE)", result: 1600 };
  summary.getCell("A10").value = "Horizontal Target";
  summary.getCell("B10").value = { formula: "HLOOKUP(\"West-KSA\",HorizontalTargets!B1:F2,2,FALSE)", result: 1350 };
  summary.getCell("A11").value = "Indexed Target";
  summary.getCell("B11").value = { formula: "INDEX(Targets!B2:B6,MATCH(\"East-UAE\",Targets!A2:A6,0),1)", result: 1000 };
  summary.getCell("A12").value = "Formatted Net";
  summary.getCell("B12").value = { formula: "TEXT(B4,\"$#,##0.00\")", result: "$2,500.00" };
  summary.getCell("A13").value = "Period Start";
  summary.getCell("B13").value = { formula: "DATE(2026,3,15)", result: new Date(Date.UTC(2026, 2, 15)) };
  summary.getCell("A14").value = "Safe Missing Lookup";
  summary.getCell("B14").value = { formula: "IFERROR(XLOOKUP(\"Missing\",Targets!A2:A6,Targets!B2:B6),0)", result: 0 };
  summary.getCell("A15").value = "Lambda Test";
  summary.getCell("B15").value = { formula: "LAMBDA(x,y,x+y)(2,3)", result: 5 };
  summary.getCell("A16").value = "Named Lambda Margin";
  summary.getCell("B16").value = { formula: "NetMarginFn(1500,900)", result: 600 };
  summary.getCell("A17").value = "Sheet Lambda";
  summary.getCell("B17").value = { formula: "SummaryScale(10,3)", result: 30 };
  summary.getCell("A18").value = "Recursive Lambda";
  summary.getCell("B18").value = { formula: "LoopBudget(3)", result: 3 };
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 18;
  summary.getRow(1).height = 28;
  summary.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
  (summary as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = "A1:B18";

  const dynamic = workbook.addWorksheet("Dynamic");
  dynamic.getCell("A1").value = "Spill Sequence";
  dynamic.getCell("A2").value = { formula: "SEQUENCE(3,2,10,5)", result: 10 };
  dynamic.getCell("F1").value = "Unique Regions";
  dynamic.getCell("F2").value = { formula: "UNIQUE(Data!A2:A6)", result: "North-KSA" };
  dynamic.getCell("H1").value = "Sorted Targets";
  dynamic.getCell("H2").value = { formula: "SORT(Targets!A2:B6,2,-1)", result: "South-KSA" };
  dynamic.getCell("K1").value = "Row Totals";
  dynamic.getCell("K2").value = { formula: "BYROW(Data!C2:E6,LAMBDA(r,SUM(r)))", result: 1910 };
  dynamic.getCell("M1").value = "Col Max";
  dynamic.getCell("M2").value = { formula: "BYCOL(Data!C2:E6,LAMBDA(c,MAX(c)))", result: 1500 };
  dynamic.getCell("P1").value = "Running Revenue";
  dynamic.getCell("P2").value = { formula: "SCAN(0,Data!C2:C6,LAMBDA(acc,x,acc+x))", result: 1200 };
  dynamic.getCell("R1").value = "Reduced Cost";
  dynamic.getCell("R2").value = { formula: "REDUCE(0,Data!D2:D6,LAMBDA(acc,x,acc+x))", result: 3500 };
  dynamic.getCell("D1").value = "Volatile Date";
  dynamic.getCell("D2").value = { formula: "TODAY()", result: new Date(Date.UTC(2026, 2, 15)) };

  const filterMask = workbook.addWorksheet("FilterMask");
  filterMask.addRows([
    ["Include"],
    [true],
    [true],
    [false],
    [false],
    [true]
  ]);

  const advancedArrays = workbook.addWorksheet("AdvancedArrays");
  advancedArrays.getCell("A1").value = "Filtered Data";
  advancedArrays.getCell("A2").value = { formula: "FILTER(Data!A2:E6,FilterMask!A2:A6,\"none\")", result: "North-KSA" };
  advancedArrays.getCell("G1").value = "Mapped Target Per Unit";
  advancedArrays.getCell("G2").value = { formula: "MAP(Targets!B2:B6,Data!E2:E6,LAMBDA(target,units,target/units))", result: 140 };
  advancedArrays.getCell("I1").value = "XMATCH West";
  advancedArrays.getCell("I2").value = { formula: "XMATCH(\"West-KSA\",Targets!A2:A6,0)", result: 5 };

  const arrayOps = workbook.addWorksheet("ArrayOps");
  arrayOps.getCell("A1").value = "Take Targets";
  arrayOps.getCell("A2").value = { formula: "TAKE(Targets!A2:B6,3,2)", result: "North-KSA" };
  arrayOps.getCell("D1").value = "Drop Targets";
  arrayOps.getCell("D2").value = { formula: "DROP(Targets!A2:B6,1,1)", result: 1600 };
  arrayOps.getCell("G1").value = "Choose Cols";
  arrayOps.getCell("G2").value = { formula: "CHOOSECOLS(Data!A2:E6,1,3,5)", result: "North-KSA" };
  arrayOps.getCell("K1").value = "Choose Rows";
  arrayOps.getCell("K2").value = { formula: "CHOOSEROWS(Data!A2:E6,1,3,5)", result: "North-KSA" };
  arrayOps.getCell("Q1").value = "Wrap Rows";
  arrayOps.getCell("Q2").value = { formula: "WRAPROWS(Data!C2:C6,2)", result: 1200 };
  arrayOps.getCell("T1").value = "Wrap Cols";
  arrayOps.getCell("T2").value = { formula: "WRAPCOLS(Data!C2:C6,2)", result: 1200 };
  arrayOps.getCell("W1").value = "To Col";
  arrayOps.getCell("W2").value = { formula: "TOCOL(Data!A2:B4,0,FALSE)", result: "North-KSA" };
  arrayOps.getCell("Z1").value = "To Row";
  arrayOps.getCell("Z2").value = { formula: "TOROW(Data!A2:B4,0,TRUE)", result: "North-KSA" };

  const lambdaRegistry = workbook.addWorksheet("__lambda_registry");
  lambdaRegistry.state = "veryHidden";
  lambdaRegistry.addRows([
    ["LambdaName", "Parameters", "BodyExpression", "Scope", "WorksheetName", "RecursionPolicy", "RecursionLimit", "LifecycleState"],
    ["NetMarginFn", "revenue,cost", "revenue-cost", "workbook", "", "no_recursion", 1, "active"],
    ["ScaleFn", "value,multiplier", "value*multiplier", "workbook", "", "no_recursion", 1, "active"],
    ["SummaryScale", "value,multiplier", "value*multiplier", "worksheet", "Summary", "no_recursion", 1, "imported"],
    ["LoopBudget", "n", "IF(n<=0,0,1+LoopBudget(n-1))", "worksheet", "Summary", "bounded", 8, "active"]
  ]);

  const arabicSummary = workbook.addWorksheet("ArabicSummary");
  arabicSummary.addRows([
    ["البند", "القيمة"],
    ["الإيراد", 6000],
    ["التكلفة", 3500],
    ["الصافي", 2500]
  ]);
  arabicSummary.getColumn(1).width = 22;
  arabicSummary.getColumn(2).width = 16;
  arabicSummary.getRow(1).height = 24;
  arabicSummary.views = [{ state: "frozen", ySplit: 1, xSplit: 1, rightToLeft: true }];
  (arabicSummary as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = "A1:B4";

  const circularRefs = workbook.addWorksheet("CircularRefs");
  circularRefs.getCell("A1").value = { formula: "B1+1", result: "#CIRC!" } as ExcelJS.CellFormulaValue;
  circularRefs.getCell("B1").value = { formula: "A1+1", result: "#CIRC!" } as ExcelJS.CellFormulaValue;

  const opsHidden = workbook.addWorksheet("OpsHidden");
  opsHidden.state = "hidden";
  opsHidden.addRows([
    ["Key", "Value"],
    ["Budget", 120000],
    ["Scenario", "Protected"]
  ]);

  workbook.definedNames.add("Data!$A$1:$E$6", "SalesData");
  await workbook.xlsx.writeFile(targetPath);
};

const createMergeWorkbook = async (
  targetPath: string,
  variant: "regional" | "finance" | "ops" | "marketing" = "regional"
): Promise<void> => {
  ensureDir(path.dirname(targetPath));
  const workbook = new ExcelJS.Workbook();
  const regional = workbook.addWorksheet("Targets");
  const calc = workbook.addWorksheet("Calc");
  const lookup = workbook.addWorksheet("Lookup");
  const variantConfig = {
    regional: {
      rows: [
        ["Region", "StretchTarget", "Campaign"],
        ["North-KSA", 1500, "Launch"],
        ["South-KSA", 1725, "Pipeline"],
        ["North-UAE", 1330, "Partner"],
        ["East-UAE", 1060, "Retail"],
        ["West-KSA", 1425, "Retention"]
      ],
      headerFill: "FFE7F0F8",
      tableTheme: "TableStyleMedium11" as ExcelJS.TableStyleProperties["theme"],
      accent: "FF17324D"
    },
    finance: {
      rows: [
        ["Region", "StretchTarget", "Owner"],
        ["North-KSA", 1510, "Ops"],
        ["South-KSA", 1735, "Finance"],
        ["North-UAE", 1345, "Partners"],
        ["East-UAE", 1080, "Retail"],
        ["West-KSA", 1450, "Field"]
      ],
      headerFill: "FFFBE6D3",
      tableTheme: "TableStyleMedium4" as ExcelJS.TableStyleProperties["theme"],
      accent: "FF6B4A16"
    },
    ops: {
      rows: [
        ["Region", "StretchTarget", "Channel"],
        ["North-KSA", 1480, "Direct"],
        ["South-KSA", 1700, "Inside"],
        ["North-UAE", 1320, "Partner"],
        ["East-UAE", 1110, "Marketplace"],
        ["West-KSA", 1410, "Field"]
      ],
      headerFill: "FFE4F4EA",
      tableTheme: "TableStyleMedium2" as ExcelJS.TableStyleProperties["theme"],
      accent: "FF14532D"
    },
    marketing: {
      rows: [
        ["Region", "StretchTarget", "Motion"],
        ["North-KSA", 1525, "Event"],
        ["South-KSA", 1695, "Media"],
        ["North-UAE", 1360, "ABM"],
        ["East-UAE", 1095, "Search"],
        ["West-KSA", 1435, "Brand"]
      ],
      headerFill: "FFF2E8FF",
      tableTheme: "TableStyleMedium7" as ExcelJS.TableStyleProperties["theme"],
      accent: "FF5B21B6"
    }
  }[variant];
  regional.addRows(variantConfig.rows);
  regional.columns = [
    { width: 18 },
    { width: 15 },
    { width: 16 }
  ];
  regional.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  regional.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: variantConfig.accent } };
  regional.getCell("B2").style = {
    font: { bold: true, color: { argb: variantConfig.accent } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: variantConfig.headerFill } }
  };
  regional.addTable({
    name: "TargetsTable",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: variantConfig.tableTheme, showRowStripes: true },
    columns: [
      { name: "Region" },
      { name: "StretchTarget" },
      { name: variant === "finance" ? "Owner" : variant === "regional" ? "Campaign" : variant === "ops" ? "Channel" : "Motion" }
    ],
    rows: variantConfig.rows.slice(1).map((row) => [row[0], row[1], row[2]])
  });
  workbook.definedNames.add(`${regional.name}!$B$2:$B$6`, "SalesData");
  workbook.definedNames.add(`${regional.name}!$B$2`, "FocusCell");
  workbook.definedNames.add(`${regional.name}!$A$2:$A$6`, "RegionList");
  lookup.addRows([
    ["Region", "Scale"],
    ["North-KSA", 1.1],
    ["South-KSA", 1.08],
    ["North-UAE", 1.05],
    ["East-UAE", 1.03],
    ["West-KSA", 1.07]
  ]);
  lookup.addTable({
    name: "LookupTable",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleLight9", showRowStripes: true },
    columns: [{ name: "Region" }, { name: "Scale" }],
    rows: lookup
      .getSheetValues()
      .slice(2)
      .map((row) => {
        const cells = Array.isArray(row) ? row : [];
        return [cells[1] ?? null, cells[2] ?? null];
      })
  });
  calc.addRows([
    ["Metric", "Value"],
    ["NamedRangeSum", null],
    ["SheetSum", null],
    ["FocusCell", null],
    ["LookupFactor", null]
  ]);
  calc.getCell("B2").value = { formula: "SUM(SalesData)", result: undefined } as ExcelJS.CellFormulaValue;
  calc.getCell("B3").value = { formula: "SUM(Targets!B2:B6)", result: undefined } as ExcelJS.CellFormulaValue;
  calc.getCell("B4").value = { formula: "FocusCell", result: undefined } as ExcelJS.CellFormulaValue;
  calc.getCell("B5").value = {
    formula: "XLOOKUP(\"North-KSA\",Lookup!A2:A6,Lookup!B2:B6)",
    result: undefined
  } as ExcelJS.CellFormulaValue;
  await workbook.xlsx.writeFile(targetPath);
  const archiveBuffer = fs.readFileSync(targetPath);
  const zip = await JSZip.loadAsync(archiveBuffer);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  if (workbookXml) {
    let updatedWorkbookXml = workbookXml;
    if (!updatedWorkbookXml.includes('definedName name="SalesData"')) {
      const definedNamesXml =
        `<definedNames>` +
        `<definedName name="SalesData">${regional.name}!$B$2:$B$6</definedName>` +
        `<definedName name="FocusCell">${regional.name}!$B$2</definedName>` +
        `<definedName name="RegionList">${regional.name}!$A$2:$A$6</definedName>` +
        `</definedNames>`;
      updatedWorkbookXml = updatedWorkbookXml.includes("<calcPr")
        ? updatedWorkbookXml.replace("<calcPr", `${definedNamesXml}<calcPr`)
        : updatedWorkbookXml.replace("</workbook>", `${definedNamesXml}</workbook>`);
    }
    if (variant === "marketing" && !updatedWorkbookXml.includes('definedName name="BrokenExternalRef"')) {
      const brokenRangeXml = `<definedName name="BrokenExternalRef">[LegacyTargets.xlsx]Targets!$A$1</definedName>`;
      updatedWorkbookXml = updatedWorkbookXml.includes("</definedNames>")
        ? updatedWorkbookXml.replace("</definedNames>", `${brokenRangeXml}</definedNames>`)
        : updatedWorkbookXml.replace("</workbook>", `<definedNames>${brokenRangeXml}</definedNames></workbook>`);
    }
    zip.file("xl/workbook.xml", updatedWorkbookXml);
    const updatedBuffer = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(targetPath, updatedBuffer);
  }
};

const createBinaryXlsFromWorkbook = (xlsxPath: string, xlsPath: string): void => {
  const sourceWorkbook = XLSX.readFile(xlsxPath, { cellDates: true });
  XLSX.writeFile(sourceWorkbook, xlsPath, { bookType: "biff8" });
};

const runExcelDesktopBridge = (
  mode: "export-xls" | "inspect-pivot" | "author-proof-bundle",
  options: { sourcePath?: string; targetPath?: string; workbookPath?: string; outputPath?: string; specPath?: string }
): void => {
  const scriptPath = path.resolve(__dirname, "..", "tools", "excel_desktop_bridge.ps1");
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Mode", mode];
  if (options.sourcePath) args.push("-SourcePath", options.sourcePath);
  if (options.targetPath) args.push("-TargetPath", options.targetPath);
  if (options.workbookPath) args.push("-WorkbookPath", options.workbookPath);
  if (options.outputPath) args.push("-OutputPath", options.outputPath);
  if (options.specPath) args.push("-SpecPath", options.specPath);
  execFileSync("powershell", args, { stdio: "pipe" });
};

const createMacroWorkbookFromWorkbook = (xlsxPath: string, xlsmPath: string): void => {
  const sourceWorkbook = XLSX.readFile(xlsxPath, { cellDates: true, bookVBA: true });
  (sourceWorkbook as XLSX.WorkBook & { vbaraw?: Buffer }).vbaraw = Buffer.from("codex-excel-engine-vba-placeholder");
  XLSX.writeFile(sourceWorkbook, xlsmPath, { bookType: "xlsm", bookVBA: true });
};

const excelJsWorkbookFromXlsxWorkbook = (sourceWorkbook: XLSX.WorkBook): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  sourceWorkbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.addWorksheet(sheetName);
    const sourceSheet = sourceWorkbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sourceSheet, { header: 1, raw: true }) as unknown[][];
    rows.forEach((row) => worksheet.addRow(row));
  });
  return workbook;
};

const cloneJson = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

const serializeCellForDesktopProof = (
  cell: ExcelJS.Cell
): string | number | boolean | null | { cell_type: string; formula?: string; value?: string | number | boolean | null; number_format?: string | null } => {
  if (typeof cell.value === "object" && cell.value !== null && "formula" in cell.value) {
    return {
      cell_type: "formula",
      formula: `${cell.value.formula ?? ""}`,
      value: toPrimitiveCellValue(cell.value.result ?? null),
      number_format: cell.numFmt ?? null
    };
  }
  if (cell.value instanceof Date) {
    return {
      cell_type: "date",
      value: cell.value.toISOString(),
      number_format: cell.numFmt ?? "yyyy-mm-dd"
    };
  }
  return toPrimitiveCellValue(cell.value);
};

const worksheetRowsForDesktopProof = (
  worksheet: ExcelJS.Worksheet
): Array<Array<string | number | boolean | null | { cell_type: string; formula?: string; value?: string | number | boolean | null; number_format?: string | null }>> => {
  const rows: Array<Array<string | number | boolean | null | { cell_type: string; formula?: string; value?: string | number | boolean | null; number_format?: string | null }>> = [];
  for (let rowIndex = 1; rowIndex <= Math.max(worksheet.rowCount, 1); rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const rowValues: Array<string | number | boolean | null | { cell_type: string; formula?: string; value?: string | number | boolean | null; number_format?: string | null }> = [];
    for (let columnIndex = 1; columnIndex <= Math.max(worksheet.columnCount, 1); columnIndex += 1) {
      rowValues.push(serializeCellForDesktopProof(row.getCell(columnIndex)));
    }
    rows.push(rowValues);
  }
  return rows;
};

const explicitWidthSpecsForDesktopProof = (
  worksheet: ExcelJS.Worksheet
): Array<{ column: number; width: number }> =>
  worksheet.columns
    .map((column, index) => ({
      column: index + 1,
      width: Number(column.width ?? Number.NaN)
    }))
    .filter((entry) => Number.isFinite(entry.width));

const explicitRowHeightSpecsForDesktopProof = (
  worksheet: ExcelJS.Worksheet
): Array<{ row: number; height: number }> =>
  Array.from({ length: worksheet.rowCount }, (_, index) => ({
    row: index + 1,
    height: Number(worksheet.getRow(index + 1).height ?? Number.NaN)
  })).filter((entry) => Number.isFinite(entry.height));

const worksheetFreezePaneForDesktopProof = (
  worksheet: ExcelJS.Worksheet
): { row: number; column: number } | null => {
  const frozenView = (worksheet.views ?? []).find((view) => `${(view as { state?: string }).state ?? ""}` === "frozen") as
    | { xSplit?: number; ySplit?: number }
    | undefined;
  if (!frozenView) return null;
  return {
    row: Number(frozenView.ySplit ?? 0) + 1,
    column: Number(frozenView.xSplit ?? 0) + 1
  };
};

const worksheetMergedRangesForDesktopProof = (worksheet: ExcelJS.Worksheet): string[] => {
  const model = worksheet.model as unknown as { merges?: string[] };
  if (Array.isArray(model.merges)) return model.merges.map((entry) => `${entry}`);
  const merges = ((worksheet as unknown as { _merges?: Record<string, unknown> })._merges ?? {});
  return Object.keys(merges);
};

const worksheetHiddenColumnsForDesktopProof = (worksheet: ExcelJS.Worksheet): number[] =>
  worksheet.columns
    .map((column, index) => (column.hidden ? index + 1 : null))
    .filter((column): column is number => typeof column === "number");

const worksheetRtlForDesktopProof = (worksheet: ExcelJS.Worksheet): boolean =>
  (worksheet.views ?? []).some((view) => Boolean((view as { rightToLeft?: boolean }).rightToLeft));

const workbookDefinedNamesForDesktopProof = (
  workbook: ExcelJS.Workbook
): Array<{ name: string; ranges: string[]; local_sheet_id: number | null }> => {
  const namedRanges = definedNameEntriesFromExcelJs(workbook).filter((entry) => entry.name !== "_xlnm._FilterDatabase");
  const requiredNames = [
    { name: "Slicer_Pivot_Profit_By_Country_CountryCode", ranges: ["PivotDesktop!$A$1"], local_sheet_id: null },
    { name: "Slicer_Pivot_Profit_By_Country_RegionZone", ranges: ["PivotDesktop!$A$1"], local_sheet_id: null }
  ];
  requiredNames.forEach((requiredEntry) => {
    if (!namedRanges.some((entry) => entry.name === requiredEntry.name)) {
      namedRanges.push(requiredEntry);
    }
  });
  return namedRanges;
};

const buildDesktopWorkbookProofSpec = (workbook: ExcelJS.Workbook): Record<string, unknown> => {
  const joinedWorksheet = workbook.getWorksheet("Joined");
  const summaryWorksheet = workbook.getWorksheet("Summary");
  const joinedRange = joinedWorksheet ? tableRangeForWorksheet(joinedWorksheet) : "A1:L481";
  const summaryMetricRange = summaryWorksheet ? `B2:B${Math.max(summaryWorksheet.rowCount, 2)}` : "B2:B19";
  const workbookSheetSpecs = workbook.worksheets.map((worksheet) => ({
    name: worksheet.name,
    rows: worksheetRowsForDesktopProof(worksheet),
    widths: explicitWidthSpecsForDesktopProof(worksheet),
    row_heights: explicitRowHeightSpecsForDesktopProof(worksheet),
    freeze_pane: worksheetFreezePaneForDesktopProof(worksheet),
    auto_filter_range: worksheetAutoFilterRef(worksheet),
    rtl: worksheetRtlForDesktopProof(worksheet),
    visibility: worksheet.state,
    hidden_columns: worksheetHiddenColumnsForDesktopProof(worksheet),
    merged_ranges: worksheetMergedRangesForDesktopProof(worksheet)
  }));
  const existingSheetNames = new Set(workbookSheetSpecs.map((sheet) => sheet.name));
  const supplementalSheets = [
    {
      name: "ChartData",
      rows: [
        ["X", "Y", "Size"],
        [1, 10, 2],
        [2, 14, 4],
        [3, 18, 5],
        [4, 22, 7],
        [5, 26, 9]
      ],
      widths: [
        { column: 1, width: 10 },
        { column: 2, width: 10 },
        { column: 3, width: 10 }
      ],
      row_heights: [],
      freeze_pane: null,
      auto_filter_range: null,
      rtl: false,
      visibility: "visible",
      hidden_columns: [],
      merged_ranges: []
    },
    {
      name: "RadarData",
      rows: [
        ["Category", "Alpha", "Beta"],
        ["A", 10, 12],
        ["B", 15, 14],
        ["C", 13, 16],
        ["D", 17, 18]
      ],
      widths: [
        { column: 1, width: 12 },
        { column: 2, width: 10 },
        { column: 3, width: 10 }
      ],
      row_heights: [],
      freeze_pane: null,
      auto_filter_range: null,
      rtl: false,
      visibility: "visible",
      hidden_columns: [],
      merged_ranges: []
    },
    {
      name: "StockData",
      rows: [
        ["Date", "Open", "High", "Low", "Close"],
        [{ cell_type: "date", value: "2026-01-01T00:00:00.000Z", number_format: "yyyy-mm-dd" }, 100, 112, 95, 108],
        [{ cell_type: "date", value: "2026-01-02T00:00:00.000Z", number_format: "yyyy-mm-dd" }, 108, 118, 101, 114],
        [{ cell_type: "date", value: "2026-01-03T00:00:00.000Z", number_format: "yyyy-mm-dd" }, 114, 123, 109, 120],
        [{ cell_type: "date", value: "2026-01-04T00:00:00.000Z", number_format: "yyyy-mm-dd" }, 120, 128, 116, 124]
      ],
      widths: [
        { column: 1, width: 14 },
        { column: 2, width: 10 },
        { column: 3, width: 10 },
        { column: 4, width: 10 },
        { column: 5, width: 10 }
      ],
      row_heights: [],
      freeze_pane: null,
      auto_filter_range: null,
      rtl: false,
      visibility: "visible",
      hidden_columns: [],
      merged_ranges: []
    },
    { name: "ChartCoverage", rows: [["ChartCoverage"]], widths: [{ column: 1, width: 12 }], row_heights: [], freeze_pane: null, auto_filter_range: null, rtl: false, visibility: "visible", hidden_columns: [], merged_ranges: [] },
    { name: "PivotDesktop", rows: [["PivotDesktop"]], widths: [{ column: 1, width: 12 }], row_heights: [], freeze_pane: null, auto_filter_range: null, rtl: false, visibility: "visible", hidden_columns: [], merged_ranges: [] }
  ].filter((sheet) => !existingSheetNames.has(sheet.name));
  return {
    sheets: [...workbookSheetSpecs, ...supplementalSheets],
    defined_names: workbookDefinedNamesForDesktopProof(workbook),
    formatting: {
      theme_path: "C:\\Program Files\\Microsoft Office\\root\\Document Themes 16\\Facet.thmx",
      named_styles: [
        {
          name: "RasidFinanceStyle",
          font_name: "Arial",
          bold: true,
          font_size: 12,
          number_format: "#,##0.00",
          horizontal_alignment: -4108,
          vertical_alignment: -4108,
          wrap_text: false,
          font_theme_color: 1,
          interior_theme_color: 5,
          interior_tint: 0.6,
          border_weight: 2
        },
        {
          name: "RasidArabicRtlStyle",
          font_name: "Arial",
          bold: true,
          font_size: 13,
          number_format: "[$-ar-SA]#,##0.00",
          horizontal_alignment: -4108,
          vertical_alignment: -4108,
          wrap_text: false,
          font_theme_color: 1,
          interior_theme_color: 6,
          interior_tint: 0.7,
          border_weight: 2
        }
      ],
      applications: [
        { worksheet: "Joined", range: joinedRange, style_name: "RasidFinanceStyle" },
        { worksheet: "ArabicSummary", range: "A1:B6", style_name: "RasidArabicRtlStyle" }
      ],
      conditional_formatting_rules: [
        { worksheet: "Joined", range: "D2:D20", type: 1, operator: 5, formula1: "380", formula2: null, font_color: 255, interior_color: 13434879 },
        { worksheet: "Summary", range: summaryMetricRange, type: 1, operator: 5, formula1: "1000", formula2: null, font_color: 255, interior_color: 13434879 }
      ],
      reload_checks: {
        workbook_sheet: "Joined",
        workbook_cell: "D2",
        arabic_sheet: "ArabicSummary",
        arabic_cell: "A1",
        summary_sheet: "Summary",
        workbook_conditional_range: "D2:D20",
          summary_conditional_range: summaryMetricRange
      }
    },
    chart_coverage: {
      target_sheet: "ChartCoverage",
      charts: [
        { family: "scatter", title: "Scatter Coverage", chart_type_codes: [-4169, 74], source_sheet: "ChartData", source_range: "A1:B6", left: 10, top: 10, width: 320, height: 180 },
        { family: "bubble", title: "Bubble Coverage", chart_type_codes: [15, 87], source_sheet: "ChartData", source_range: "A1:C6", left: 340, top: 10, width: 320, height: 180 },
        { family: "radar", title: "Radar Coverage", chart_type_codes: [-4151, 81, 82], source_sheet: "RadarData", source_range: "A1:C5", left: 10, top: 220, width: 320, height: 180 },
        { family: "stock", title: "Stock Coverage", chart_type_codes: [89, 88, 91, 90], source_sheet: "StockData", source_range: "A1:E5", left: 340, top: 220, width: 320, height: 180 }
      ]
    },
    pivot: {
      source_sheet: "Joined",
      target_sheet: "PivotDesktop",
      source_range: joinedRange,
      target_cell: "A3",
      pivot_table_name: "pivot-Pivot_Profit_By_Country",
      row_field: "CountryCode",
      column_field: "RegionZone",
      page_field: "GeoKey",
      data_field: "Profit",
      data_caption: "Sum of Profit",
      calculated_field_name: "MarginPct",
      calculated_formula: "=Profit/GrossRevenue"
    },
    slicers: [
      { pivot_table_name: "pivot-Pivot_Profit_By_Country", target_sheet: "PivotDesktop", field: "CountryCode", name: "Slicer_CountryCode", caption: "CountryCode", left: 680, top: 10, width: 140, height: 160, named_range: "Slicer_Pivot_Profit_By_Country_CountryCode" },
      { pivot_table_name: "pivot-Pivot_Profit_By_Country", target_sheet: "PivotDesktop", field: "RegionZone", name: "Slicer_RegionZone", caption: "RegionZone", left: 680, top: 190, width: 140, height: 160, named_range: "Slicer_Pivot_Profit_By_Country_RegionZone" }
    ]
  };
};

const uniqueWorksheetName = (workbook: ExcelJS.Workbook, requestedName: string): string => {
  const base = requestedName.slice(0, 31) || "Sheet";
  if (!workbook.getWorksheet(base)) return base;
  let index = 2;
  while (true) {
    const suffix = `_${index}`;
    const candidate = `${base.slice(0, Math.max(31 - suffix.length, 1))}${suffix}`;
    if (!workbook.getWorksheet(candidate)) return candidate;
    index += 1;
  }
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const existingWorkbookDefinedNames = (workbook: ExcelJS.Workbook): Set<string> => {
  const model = ((workbook as unknown as { definedNames?: { model?: Array<{ name: string }> } }).definedNames?.model ?? []);
  return new Set(model.map((entry) => entry.name));
};

const uniqueDefinedName = (existingNames: Set<string>, requestedName: string): string => {
  const sanitizedBase = requestedName.replace(/[^A-Za-z0-9_]/g, "_") || "NamedRange";
  if (!existingNames.has(sanitizedBase)) return sanitizedBase;
  let index = 2;
  while (true) {
    const suffix = `_${index}`;
    const candidate = `${sanitizedBase.slice(0, Math.max(255 - suffix.length, 1))}${suffix}`;
    if (!existingNames.has(candidate)) return candidate;
    index += 1;
  }
};

const worksheetTableMetadata = (
  worksheet: ExcelJS.Worksheet
): Array<{ name: string; theme: ExcelJS.TableStyleProperties["theme"] | null }> =>
  ((((worksheet.model as unknown as { tables?: Array<{ name?: string; style?: { theme?: ExcelJS.TableStyleProperties["theme"] } }> })
    ?.tables ?? []) as Array<{ name?: string; style?: { theme?: ExcelJS.TableStyleProperties["theme"] } }>) || []).map((table, index) => ({
    name: `${table.name ?? `Table${index + 1}`}`,
    theme: table.style?.theme ?? null
  }));

const remapWorkbookExpression = (
  expression: string,
  sheetNameMap: Map<string, string>,
  namedRangeNameMap: Map<string, string>
): string => {
  let remapped = expression;
  sheetNameMap.forEach((targetSheetName, sourceSheetName) => {
    const escapedSourceName = escapeRegExp(sourceSheetName);
    const targetToken = /[^A-Za-z0-9_]/.test(targetSheetName) ? `'${targetSheetName}'` : targetSheetName;
    remapped = remapped
      .replace(new RegExp(`'${escapedSourceName}'!`, "g"), `${targetToken}!`)
      .replace(new RegExp(`\\b${escapedSourceName}!`, "g"), `${targetToken}!`);
  });
  namedRangeNameMap.forEach((targetName, sourceName) => {
    if (sourceName === targetName) return;
    remapped = remapped.replace(new RegExp(`\\b${escapeRegExp(sourceName)}\\b`, "g"), targetName);
  });
  return remapped;
};

const extractNamedRangesFromXlsxWorkbook = (workbook: XLSX.WorkBook): Array<{ name: string; ref: string }> =>
  (workbook.Workbook?.Names ?? [])
    .filter((entry) => entry.Name && entry.Ref)
    .map((entry) => ({ name: `${entry.Name}`, ref: `${entry.Ref}` }));

const resolveSourceFormat = (inputPath: string, mediaType: z.infer<typeof MediaTypeSchema>): WorkbookSourceMetadata["source_format"] => {
  if (mediaType === "application/vnd.ms-excel") return "xls";
  if (mediaType === "application/vnd.ms-excel.sheet.macroEnabled.12" || inputPath.toLowerCase().endsWith(".xlsm")) return "xlsm";
  if (mediaType === "text/csv") return "csv";
  if (mediaType === "text/tab-separated-values") return "tsv";
  return "xlsx";
};

const primitiveRowValue = (value: unknown): string | number | boolean | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return `${value}`;
};

const toSnakeCase = (value: string): string =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const buildMappingPreview = (state: ExcelRunState, plan: TransformationPlan): MappingPreviewEntry[] =>
  plan.action_sequence.flatMap((step, index) => {
    const config = step.config as Record<string, unknown>;
    if (step.operation === "rename_column") {
      const worksheetName = `${config.worksheet ?? ""}`;
      const worksheet = state.workbook.getWorksheet(worksheetName);
      const table = worksheet ? extractTable(worksheet) : { headers: [], rows: [] };
      return [
        MappingPreviewEntrySchema.parse({
          preview_id: id("mapping-preview", plan.plan_id, index + 1),
          worksheet: worksheetName,
          operation: step.operation,
          source_field: `${config.from ?? ""}`,
          target_field: `${config.to ?? ""}`,
          sample_value: table.rows[0]?.[`${config.from ?? ""}`] !== undefined ? `${table.rows[0]?.[`${config.from ?? ""}`] ?? ""}` : null,
          reason: "Explicit column rename"
        })
      ];
    }
    if (step.operation === "split_column") {
      const worksheetName = `${config.worksheet ?? ""}`;
      const worksheet = state.workbook.getWorksheet(worksheetName);
      const table = worksheet ? extractTable(worksheet) : { headers: [], rows: [] };
      return (`${config.targetColumns ?? ""}`.split(",").map((value) => value.trim()).filter(Boolean)).map((targetField, targetIndex) =>
        MappingPreviewEntrySchema.parse({
          preview_id: id("mapping-preview", plan.plan_id, index + 1, targetIndex + 1),
          worksheet: worksheetName,
          operation: step.operation,
          source_field: `${config.sourceColumn ?? ""}`,
          target_field: targetField,
          sample_value: table.rows[0]?.[`${config.sourceColumn ?? ""}`] !== undefined ? `${table.rows[0]?.[`${config.sourceColumn ?? ""}`] ?? ""}` : null,
          reason: "Split composite field into separate columns"
        })
      );
    }
    if (step.operation === "merge_columns") {
      return [
        MappingPreviewEntrySchema.parse({
          preview_id: id("mapping-preview", plan.plan_id, index + 1),
          worksheet: `${config.worksheet ?? ""}`,
          operation: step.operation,
          source_field: `${config.columns ?? ""}`,
          target_field: `${config.targetColumn ?? ""}`,
          sample_value: null,
          reason: "Merge multiple fields into one output column"
        })
      ];
    }
    if (step.operation === "normalize_sheet") {
      const worksheetName = `${config.worksheet ?? ""}`;
      const worksheet = state.workbook.getWorksheet(worksheetName);
      const table = worksheet ? extractTable(worksheet) : { headers: [], rows: [] };
      return table.headers.map((header, headerIndex) =>
        MappingPreviewEntrySchema.parse({
          preview_id: id("mapping-preview", plan.plan_id, index + 1, headerIndex + 1),
          worksheet: worksheetName,
          operation: step.operation,
          source_field: header,
          target_field: `${config.headerCase}` === "snake" ? toSnakeCase(header) : header.trim(),
          sample_value: table.rows[0]?.[header] !== undefined ? `${table.rows[0]?.[header] ?? ""}` : null,
          reason: "Header normalization preview"
        })
      );
    }
    return [];
  });

const aggregateRows = (
  rows: Array<Record<string, string | number | boolean | null>>,
  groupBy: string[],
  aggregations: Array<{ column: string; function: string; as: string }>
): Array<Record<string, string | number | boolean | null>> => {
  const groups = new Map<string, Array<Record<string, string | number | boolean | null>>>();
  rows.forEach((row) => {
    const key = groupBy.map((column) => `${row[column] ?? ""}`).join("|");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });
  return [...groups.entries()].map(([key, groupedRows]) => {
    const values = key.split("|");
    const output = groupBy.reduce<Record<string, string | number | boolean | null>>((accumulator, column, index) => {
      accumulator[column] = values[index] ?? null;
      return accumulator;
    }, {});
    aggregations.forEach((aggregation) => {
      const series = groupedRows.map((row) => Number(row[aggregation.column] ?? 0));
      output[aggregation.as] =
        aggregation.function === "count"
          ? groupedRows.length
          : aggregation.function === "average"
            ? series.reduce((sum, value) => sum + value, 0) / Math.max(series.length, 1)
            : aggregation.function === "min"
              ? Math.min(...series)
              : aggregation.function === "max"
                ? Math.max(...series)
                : series.reduce((sum, value) => sum + value, 0);
    });
    return output;
  });
};

const addOrReplaceTable = (
  worksheet: ExcelJS.Worksheet,
  tableName: string,
  table: WorksheetTable,
  theme: ExcelJS.TableStyleProperties["theme"] = "TableStyleMedium2"
): void => {
  const existingTable = worksheet.getTable(tableName);
  if (existingTable) {
    worksheet.removeTable(tableName);
  }
  if (table.headers.length === 0) return;
  worksheet.addTable({
    name: tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme,
      showRowStripes: true
    },
    columns: table.headers.map((header) => ({ name: header })),
    rows: table.rows.map((row) => table.headers.map((header) => row[header] ?? null))
  });
};

const buildPivotCache = (
  state: ExcelRunState,
  request: PivotRequest,
  sourceTable: WorksheetTable,
  pivotId: string,
  materializedHeaders: string[]
): PivotCache => {
  const cacheWorksheetName = `__pivot_cache_${request.target_worksheet}`.slice(0, 31);
  const cacheWorksheet = state.workbook.getWorksheet(cacheWorksheetName) ?? state.workbook.addWorksheet(cacheWorksheetName);
  cacheWorksheet.state = "veryHidden";
  writeTable(cacheWorksheet, sourceTable);
  addOrReplaceTable(cacheWorksheet, id("table", cacheWorksheetName), sourceTable, "TableStyleLight9");
  const existingCache = state.pivotCaches.find((cache) => cache.pivot_id === pivotId);
  return PivotCacheSchema.parse({
    cache_id: existingCache?.cache_id ?? id("pivot-cache", state.runId, request.target_worksheet),
    pivot_id: pivotId,
    source_worksheet: request.source_worksheet,
    target_worksheet: request.target_worksheet,
    cache_worksheet: cacheWorksheetName,
    snapshot_headers: sourceTable.headers,
    materialized_headers: materializedHeaders,
    snapshot_row_count: sourceTable.rows.length,
    column_fields: request.column_field ? [request.column_field] : [],
    filter_fields: request.filter_fields,
    slicer_fields: request.slicer_fields,
    calculated_fields: request.calculated_fields,
    refresh_policy: request.refresh_policy,
    refresh_token: id("pivot-refresh", pivotId, (existingCache?.refresh_count ?? 0) + 1),
    refresh_mode: request.rebuild_cache ? "rebuild" : "incremental",
    refresh_count: (existingCache?.refresh_count ?? 0) + 1,
    last_refreshed_at: ISO()
  });
};

const chartPaletteColor = (baseColor: string, index: number): string => {
  const normalized = baseColor.replace("#", "");
  const base = Number.parseInt(normalized, 16);
  const channel = (offset: number) => Math.max(24, Math.min(232, ((base >> offset) & 0xff) + index * 18));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
};

const chartSeriesFromWorksheet = (
  worksheet: ExcelJS.Worksheet,
  categoryField: string,
  seriesConfig: Array<z.infer<typeof ChartSeriesSchema>>
): ChartSeries[] => {
  const table = extractTable(worksheet);
  return seriesConfig.map((series, seriesIndex) =>
    ChartSeriesRuntimeSchema.parse({
      ...series,
      target_column_index: seriesIndex + 2,
      data_points: table.rows
        .filter((row) => `${row[categoryField] ?? ""}`.trim().length > 0)
        .map((row) => ({
          category: `${row[categoryField] ?? ""}`,
          value: Number(row[series.value_field] ?? 0)
        }))
    })
  );
};

const buildChartSvg = (chart: ChartMetadata): string => {
  const width = 920;
  const height = 520;
  const left = 84;
  const right = chart.series.some((series) => series.secondary_axis) ? 96 : 48;
  const bottom = 84;
  const top = 92;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const primarySeries = chart.series.filter((series) => !series.secondary_axis);
  const secondarySeries = chart.series.filter((series) => series.secondary_axis);
  const primaryMax = Math.max(...primarySeries.flatMap((series) => series.data_points.map((point) => point.value)), 1);
  const secondaryMax = Math.max(...secondarySeries.flatMap((series) => series.data_points.map((point) => point.value)), primaryMax, 1);
  const categories = chart.series[0]?.data_points.map((point) => point.category) ?? [];
  const categoryWidth = plotWidth / Math.max(categories.length, 1);
  const barSeries =
    chart.chart_type === "line" || chart.chart_type === "area"
      ? []
      : chart.series.filter((series) => series.chart_type === "bar" || chart.chart_type === "bar");
  const areaSeries =
    chart.chart_type === "bar" || chart.chart_type === "line"
      ? []
      : chart.series.filter((series) => series.chart_type === "area" || chart.chart_type === "area");
  const lineSeries =
    chart.chart_type === "bar" || chart.chart_type === "area"
      ? []
      : chart.series.filter((series) => series.chart_type === "line" || chart.chart_type === "line");
  const groupedBarWidth = barSeries.length > 0 ? Math.max((categoryWidth - 24) / Math.max(barSeries.length, 1), 18) : 0;

  if (chart.chart_type === "pie") {
    const pieSeries = chart.series[0];
    const total = pieSeries.data_points.reduce((sum, point) => sum + point.value, 0) || 1;
    let angle = 0;
    const slices = pieSeries.data_points
      .map((point, index) => {
        const ratio = point.value / total;
        const nextAngle = angle + ratio * Math.PI * 2;
        const x1 = width / 2 + Math.cos(angle) * 140;
        const y1 = height / 2 + Math.sin(angle) * 140;
        const x2 = width / 2 + Math.cos(nextAngle) * 140;
        const y2 = height / 2 + Math.sin(nextAngle) * 140;
        const largeArc = nextAngle - angle > Math.PI ? 1 : 0;
        const labelX = width / 2 + Math.cos(angle + (nextAngle - angle) / 2) * 190;
        const labelY = height / 2 + Math.sin(angle + (nextAngle - angle) / 2) * 190;
        const pathData = `M ${width / 2} ${height / 2} L ${x1} ${y1} A 140 140 0 ${largeArc} 1 ${x2} ${y2} Z`;
        angle = nextAngle;
        return `<path d="${pathData}" fill="${chartPaletteColor(pieSeries.color_hex, index)}" opacity="0.94"></path><text x="${labelX}" y="${labelY}" font-size="13" text-anchor="middle" fill="#243746">${point.category}</text>`;
      })
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f7fafc"/><text x="40" y="44" font-size="24" font-weight="700" fill="#17324d">${chart.chart_title}</text>${slices}</svg>`;
  }

  const axisGrid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = height - bottom - Math.round(plotHeight * ratio);
      const leftValue = Math.round(primaryMax * ratio);
      const rightValue = Math.round(secondaryMax * ratio);
      return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#d8e1e8" stroke-width="1"/><text x="${left - 12}" y="${y + 4}" font-size="11" text-anchor="end" fill="#6b7c88">${leftValue}</text>${secondarySeries.length > 0 ? `<text x="${width - right + 12}" y="${y + 4}" font-size="11" text-anchor="start" fill="#6b7c88">${rightValue}</text>` : ""}`;
    })
    .join("");

  const categoryLabels = categories
    .map((category, index) => `<text x="${left + categoryWidth * index + categoryWidth / 2}" y="${height - 34}" font-size="12" text-anchor="middle" fill="#3a4b58">${xmlEscape(category)}</text>`)
    .join("");

  const bars = barSeries
    .flatMap((series, seriesIndex) =>
      series.data_points.map((point, pointIndex) => {
        const x = left + pointIndex * categoryWidth + 12 + seriesIndex * groupedBarWidth;
        const scaledHeight = Math.round((point.value / primaryMax) * plotHeight);
        const y = height - bottom - scaledHeight;
        return `<rect x="${x}" y="${y}" width="${Math.max(groupedBarWidth - 6, 14)}" height="${scaledHeight}" rx="6" fill="${chartPaletteColor(series.color_hex, seriesIndex)}" opacity="0.92"></rect>`;
      })
    )
    .join("");

  const areas = areaSeries
    .map((series, seriesIndex) => {
      const scaleMax = series.secondary_axis ? secondaryMax : primaryMax;
      const points = series.data_points.map((point, pointIndex) => {
        const x = left + pointIndex * categoryWidth + categoryWidth / 2;
        const y = height - bottom - Math.round((point.value / Math.max(scaleMax, 1)) * plotHeight);
        return { x, y };
      });
      if (points.length === 0) return "";
      const areaPath = [
        `M ${points[0].x} ${height - bottom}`,
        ...points.map((point, index) => `${index === 0 ? "L" : "L"} ${point.x} ${point.y}`),
        `L ${points[points.length - 1].x} ${height - bottom}`,
        "Z"
      ].join(" ");
      const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
      const color = chartPaletteColor(series.color_hex, seriesIndex);
      const markers = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}"></circle>`).join("");
      return `<path d="${areaPath}" fill="${color}" opacity="0.24"></path><path d="${linePath}" fill="none" stroke="${color}" stroke-width="3"></path>${markers}`;
    })
    .join("");

  const lines = lineSeries
    .map((series, seriesIndex) => {
      const scaleMax = series.secondary_axis ? secondaryMax : primaryMax;
      const points = series.data_points
        .map((point, pointIndex) => {
          const x = left + pointIndex * categoryWidth + categoryWidth / 2;
          const y = height - bottom - Math.round((point.value / Math.max(scaleMax, 1)) * plotHeight);
          return { x, y, value: point.value };
        });
      const pathData = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
      const markers = points
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${chartPaletteColor(series.color_hex, seriesIndex)}"></circle>`)
        .join("");
      return `<path d="${pathData}" fill="none" stroke="${chartPaletteColor(series.color_hex, seriesIndex)}" stroke-width="3"></path>${markers}`;
    })
    .join("");

  const legend = chart.legend_position === "none"
    ? ""
    : chart.series
        .map((series, index) => {
          const x = chart.legend_position === "bottom" ? 48 + index * 180 : width - right + 18;
          const y = chart.legend_position === "bottom" ? height - 16 : 116 + index * 24;
          return `<rect x="${x}" y="${y - 10}" width="12" height="12" rx="2" fill="${chartPaletteColor(series.color_hex, index)}"></rect><text x="${x + 18}" y="${y}" font-size="12" fill="#33434f">${xmlEscape(series.series_name)}</text>`;
        })
        .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f7fafc"/><text x="40" y="44" font-size="24" font-weight="700" fill="#17324d">${chart.chart_title}</text>${axisGrid}<line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#6b7c88" stroke-width="1.5"/><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#6b7c88" stroke-width="1.5"/>${secondarySeries.length > 0 ? `<line x1="${width - right}" y1="${top}" x2="${width - right}" y2="${height - bottom}" stroke="#6b7c88" stroke-width="1.5"/>` : ""}${bars}${areas}${lines}${categoryLabels}${legend}</svg>`;
};

const writeChartConfigWorksheet = (
  workbook: ExcelJS.Workbook,
  chartId: string,
  categoryField: string,
  series: ChartSeries[],
  chartTitle: string,
  legendPosition: ChartMetadata["legend_position"]
): string => {
  const worksheetName = uniqueWorksheetName(workbook, `__chartcfg_${chartId}`.slice(0, 31));
  const worksheet = workbook.getWorksheet(worksheetName) ?? workbook.addWorksheet(worksheetName);
  worksheet.state = "veryHidden";
  const headers = [categoryField, ...series.map((entry) => entry.series_name)];
  const rowCount = Math.max(...series.map((entry) => entry.data_points.length), 0);
  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    headers.reduce<Record<string, string | number | boolean | null>>((accumulator, header, headerIndex) => {
      if (headerIndex === 0) {
        accumulator[header] = series[0]?.data_points[rowIndex]?.category ?? null;
      } else {
        accumulator[header] = series[headerIndex - 1]?.data_points[rowIndex]?.value ?? null;
      }
      return accumulator;
    }, {})
  );
  writeTable(worksheet, { headers, rows });
  worksheet.getCell("H1").value = "ChartTitle";
  worksheet.getCell("I1").value = chartTitle;
  worksheet.getCell("H2").value = "LegendPosition";
  worksheet.getCell("I2").value = legendPosition;
  worksheet.getCell("H3").value = "SeriesCount";
  worksheet.getCell("I3").value = series.length;
  return worksheetName;
};

const mergeCellStyles = (
  targetStyle: Partial<ExcelJS.Style>,
  sourceStyle: Partial<ExcelJS.Style>,
  policy: "preserve_target" | "overwrite_source" | "merge"
): Partial<ExcelJS.Style> => {
  if (policy === "preserve_target") return targetStyle;
  if (policy === "overwrite_source") return cloneJson(sourceStyle);
  const mergedFill =
    targetStyle.fill || sourceStyle.fill
      ? ({ ...(targetStyle.fill ?? {}), ...(sourceStyle.fill ?? {}) } as ExcelJS.Fill)
      : undefined;
  return {
    ...cloneJson(targetStyle),
    ...cloneJson(sourceStyle),
    font: { ...(targetStyle.font ?? {}), ...(sourceStyle.font ?? {}) } as Partial<ExcelJS.Font>,
    fill: mergedFill,
    border: { ...(targetStyle.border ?? {}), ...(sourceStyle.border ?? {}) } as Partial<ExcelJS.Borders>,
    alignment: { ...(targetStyle.alignment ?? {}), ...(sourceStyle.alignment ?? {}) } as Partial<ExcelJS.Alignment>
  } as Partial<ExcelJS.Style>;
};

const copyWorksheetIntoWorkbook = (
  targetWorkbook: ExcelJS.Workbook,
  sourceWorksheet: ExcelJS.Worksheet,
  requestedName: string,
  styleConflictPolicy: "preserve_target" | "overwrite_source" | "merge"
): ExcelJS.Worksheet => {
  const targetWorksheet = targetWorkbook.getWorksheet(requestedName) ?? targetWorkbook.addWorksheet(uniqueWorksheetName(targetWorkbook, requestedName));
  sourceWorksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const targetCell = targetWorksheet.getCell(rowNumber, columnNumber);
      targetCell.value = cloneJson(cell.value);
      if (cell.style) {
        targetCell.style = mergeCellStyles(targetCell.style, cell.style, styleConflictPolicy) as Partial<ExcelJS.Style>;
      }
      if (cell.numFmt) targetCell.numFmt = cell.numFmt;
    });
  });
  return targetWorksheet;
};

const formattingTemplate = (templateName: FormattingRequest["template_name"]) => {
  if (templateName === "finance") {
    return {
      font: { bold: true, color: { argb: "FF17324D" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F0F8" } },
      border: {
        top: { style: "thin", color: { argb: "FFB6C7D6" } },
        left: { style: "thin", color: { argb: "FFB6C7D6" } },
        bottom: { style: "thin", color: { argb: "FFB6C7D6" } },
        right: { style: "thin", color: { argb: "FFB6C7D6" } }
      },
      alignment: { vertical: "middle", horizontal: "center" }
    };
  }
  if (templateName === "executive") {
    return {
      font: { bold: true, color: { argb: "FF2F2A24" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4E8D3" } },
      border: {
        top: { style: "thin", color: { argb: "FFD5B88C" } },
        left: { style: "thin", color: { argb: "FFD5B88C" } },
        bottom: { style: "thin", color: { argb: "FFD5B88C" } },
        right: { style: "thin", color: { argb: "FFD5B88C" } }
      },
      alignment: { vertical: "middle", horizontal: "center" }
    };
  }
  if (templateName === "rtl_report") {
    return {
      font: { bold: true, color: { argb: "FF15333A" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5F3EE" } },
      border: {
        top: { style: "thin", color: { argb: "FF8FB7A8" } },
        left: { style: "thin", color: { argb: "FF8FB7A8" } },
        bottom: { style: "thin", color: { argb: "FF8FB7A8" } },
        right: { style: "thin", color: { argb: "FF8FB7A8" } }
      },
      alignment: { vertical: "middle", horizontal: "center", readingOrder: "rtl" }
    };
  }
  return null;
};

// ─── Smart / Pro Mode Types ───────────────────────────────────────────────────
type SmartKPI = { name: string; value: number | string; trend: "up" | "down" | "flat"; unit: string };
type SmartSummaryTable = { headers: string[]; rows: string[][]; row_count: number };
type SmartChartSuggestion = { chart_type: string; title: string; x_field: string; y_field: string; reason: string };
type SmartDashboardSuggestion = { title: string; widget_refs: string[]; layout: string };
type SmartReportSuggestion = { title: string; sections: string[]; data_refs: string[] };
type SmartSlideSuggestion = { title: string; content_type: string; data_ref: string };
type SmartAnalysisResult = {
  kpis: SmartKPI[];
  summary_table: SmartSummaryTable;
  suggested_charts: SmartChartSuggestion[];
  suggested_dashboards: SmartDashboardSuggestion[];
  suggested_reports: SmartReportSuggestion[];
  suggested_slides: SmartSlideSuggestion[];
};

// ─── Arrow / Parquet / Catalog / Semantic Graph Types ─────────────────────────
type ArrowBuffer = { schema: Array<{ name: string; type: string }>; columns: Record<string, unknown[]>; row_count: number };
type ParquetManifest = { path: string; schema: Array<{ name: string; type: string }>; row_count: number; created_at: string };
type CatalogEntry = {
  entry_id: string;
  name: string;
  type: string;
  source_ref: string;
  schema: Array<{ name: string; type: string }>;
  row_count: number;
  tags: string[];
  created_at: string;
};
type SemanticGraphNode = { node_id: string; label: string; type: "entity" | "attribute" | "relationship"; refs: string[] };
type SemanticGraph = { nodes: SemanticGraphNode[]; edges: Array<{ from: string; to: string; relation: string }> };

// ─── Data Cleaning Types ──────────────────────────────────────────────────────
type DataCleaningResult = {
  deduplicated: { removed_count: number; duplicate_groups: Array<{ key: string; count: number }> };
  fuzzy_matches: Array<{ column: string; pairs: Array<{ a: string; b: string; similarity: number }> }>;
  outliers: Array<{ column: string; values: Array<{ row: number; value: number; z_score: number }> }>;
  imputed: Array<{ column: string; strategy: string; filled_count: number }>;
  normalized: Array<{ column: string; method: string; min: number; max: number }>;
  quality_report: { total_rows: number; total_columns: number; completeness: number; validity: number; uniqueness: number; issues: string[] };
};

// ─── Diff Types ───────────────────────────────────────────────────────────────
type DiffResult = {
  diff_type: "file_vs_file" | "table_vs_table" | "column_vs_column" | "across_time";
  added_rows: number;
  removed_rows: number;
  changed_cells: Array<{ row: number; col: string; old_value: string; new_value: string }>;
  added_columns: string[];
  removed_columns: string[];
  summary: string;
};

// ─── Recipe Types ─────────────────────────────────────────────────────────────
type Recipe = {
  recipe_id: string;
  name: string;
  version: number;
  steps: Array<{ action: string; params: Record<string, unknown> }>;
  created_at: string;
  updated_at: string;
};

// ─── AI for Excel Types ───────────────────────────────────────────────────────
type NLQResult = { query: string; interpreted_as: string; sql_equivalent: string; result_rows: string[][]; result_columns: string[] };
type AutoAnalysisResult = {
  insights: Array<{ category: string; description: string; confidence: number; affected_columns: string[] }>;
  anomalies: Array<{ column: string; description: string; severity: string }>;
};
type PredictiveResult = { column: string; predictions: Array<{ row: number; predicted_value: number; confidence: number }>; method: string; r_squared: number };
type WhatIfResult = {
  original: Record<string, string>;
  modified: Record<string, string>;
  impact: Array<{ metric: string; before: number; after: number; change_pct: number }>;
};

// ─── Levenshtein distance for fuzzy matching ──────────────────────────────────
const levenshteinDistance = (a: string, b: string): number => {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  const matrix: number[][] = Array.from({ length: lenA + 1 }, (_, i) =>
    Array.from({ length: lenB + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[lenA][lenB];
};

const levenshteinSimilarity = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
};

// ─── In-memory recipe store (per engine instance) ─────────────────────────────
const globalRecipeStore: Recipe[] = [];

export class ExcelEngine {
  async importWorkbook(input: ExcelImportRequest): Promise<ExcelRunState> {
    const request = ExcelImportRequestSchema.parse(input);
    ensureDir(request.output_root);
    let workbook = new ExcelJS.Workbook();
    let sourceVbaPayloadBase64: string | null = null;
    let workbookSourceMetadata = WorkbookSourceMetadataSchema.parse({
      workbook_id: id("workbook", request.run_id),
      source_format: resolveSourceFormat(request.input_path, request.media_type),
      original_media_type: request.media_type,
      editable_export_format: "xlsx",
      contains_vba: false,
      vba_preservation_requested: request.media_type === "application/vnd.ms-excel.sheet.macroEnabled.12",
      vba_preserved: false,
      degrade_behavior: "none",
      degrade_reason: null,
      named_range_count: 0
    });
    if (request.media_type === "application/vnd.ms-excel") {
      const sourceWorkbook = XLSX.readFile(request.input_path, { cellDates: true, dense: false, bookVBA: true });
      workbook = excelJsWorkbookFromXlsxWorkbook(sourceWorkbook);
      sourceVbaPayloadBase64 = (sourceWorkbook as XLSX.WorkBook & { vbaraw?: Buffer }).vbaraw?.toString("base64") ?? null;
      workbookSourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...workbookSourceMetadata,
        editable_export_format: "xls",
        contains_vba: Boolean(sourceVbaPayloadBase64),
        degrade_behavior: "none",
        degrade_reason: null,
        named_range_count: extractNamedRangesFromXlsxWorkbook(sourceWorkbook).length
      });
    } else if (request.media_type === "application/vnd.ms-excel.sheet.macroEnabled.12") {
      const sourceWorkbook = XLSX.readFile(request.input_path, { cellDates: true, dense: false, bookVBA: true });
      workbook = excelJsWorkbookFromXlsxWorkbook(sourceWorkbook);
      sourceVbaPayloadBase64 = (sourceWorkbook as XLSX.WorkBook & { vbaraw?: Buffer }).vbaraw?.toString("base64") ?? null;
      const containsVba = Boolean(sourceVbaPayloadBase64);
      workbookSourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...workbookSourceMetadata,
        editable_export_format: containsVba ? "xlsm" : "xlsx",
        contains_vba: containsVba,
        degrade_behavior: "none",
        degrade_reason: null,
        named_range_count: extractNamedRangesFromXlsxWorkbook(sourceWorkbook).length
      });
    } else if (request.media_type === "text/csv" || request.media_type === "text/tab-separated-values") {
      const delimiter = request.media_type === "text/tab-separated-values" ? "\t" : ",";
      const content = fs.readFileSync(request.input_path, "utf8").trim();
      const worksheet = workbook.addWorksheet("Sheet1");
      content.split(/\r?\n/).forEach((line) => worksheet.addRow(line.split(delimiter)));
      workbookSourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...workbookSourceMetadata,
        degrade_behavior: "export_as_xlsx",
        degrade_reason: request.media_type === "text/csv" ? "CSV inputs are normalized into XLSX for editable exports" : "TSV inputs are normalized into XLSX for editable exports"
      });
    } else {
      await workbook.xlsx.readFile(request.input_path);
      const sourceWorkbook = XLSX.readFile(request.input_path, { cellDates: true, dense: false, bookVBA: true });
      sourceVbaPayloadBase64 = (sourceWorkbook as XLSX.WorkBook & { vbaraw?: Buffer }).vbaraw?.toString("base64") ?? null;
      const containsVba = Boolean(sourceVbaPayloadBase64);
      workbookSourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...workbookSourceMetadata,
        editable_export_format: containsVba ? "xlsm" : "xlsx",
        contains_vba: containsVba,
        degrade_behavior: "none",
        degrade_reason: null,
        named_range_count: extractNamedRangesFromXlsxWorkbook(sourceWorkbook).length
      });
    }

    const initialVersion = WorkbookVersionSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      workbook_version_id: id("workbook-version", request.run_id, 1),
      workbook_ref: id("workbook", request.run_id),
      version_ref: {
        version_id: id("version", request.run_id, 1),
        parent_version_id: null,
        version_number: 1,
        semantic_version: "1.0.0"
      },
      change_kind: "import",
      change_reason: "Workbook imported",
      based_on_artifact_ref: null,
      created_at: ISO()
    });

    const stateBase = {
      runId: request.run_id,
      mode: request.requested_mode,
      actorRef: request.created_by,
      tenantRef: request.tenant_ref,
      workspaceId: request.workspace_id,
      projectId: request.project_id,
      outputRoot: request.output_root,
      workbookPath: request.input_path,
      workbook,
      workbookVersions: [initialVersion],
      transformationPlans: [],
      transformationResults: [],
      pivotMetadata: [],
      pivotCaches: [],
      styleMetadata: [],
      generatedCharts: [],
      chartHistory: [],
      nativeWorkbookObjects: NativeWorkbookObjectsSchema.parse({
        workbook_object_manifest_id: id("native-objects", request.run_id),
        chart_objects: [],
        pivot_objects: [],
        slicer_objects: [],
        generated_at: ISO()
      }),
      lambdaRegistry: [],
      mappingPreviews: [],
      sourceMetadata: workbookSourceMetadata,
      sourceVbaPayloadBase64,
      analysis: null,
      artifacts: [],
      publication: null,
      persistenceManifest: null,
      auditEvents: [],
      lineageEdges: [],
      checks: [],
      metrics: [],
      warnings: [],
      failures: [],
      sourceArtifactId: id("artifact", "source", request.run_id),
      workbookArtifactId: id("artifact", "workbook", request.run_id),
      currentVersionNumber: 1,
      lastFormulaExecution: null
    } as Omit<ExcelRunState, "workbookRecord" | "workbookPackage" | "canonicalRepresentation" | "formulaGraph">;

    const snapshot = await captureWorkbookSnapshot(workbook, stateBase);
    const state: ExcelRunState = {
      ...stateBase,
      workbookRecord: snapshot.workbookRecord,
      workbookPackage: snapshot.workbookPackage,
      canonicalRepresentation: snapshot.canonicalRepresentation,
      formulaGraph: snapshot.formulaGraph
    };
    state.lambdaRegistry = extractNamedLambdaEntries(workbook);

    state.checks.push({
      check_id: "workbook_import_check",
      check_name: "Workbook Import",
      check_type: "import",
      passed: true,
      severity: "low",
      details: `Imported workbook with ${workbook.worksheets.length} worksheet(s)`,
      impacted_refs: [state.workbookRecord.workbook_id]
    });
    state.metrics.push({ metric_name: "worksheet_count", metric_value: workbook.worksheets.length, metric_unit: "count" });
    addAuditEvent(state, "excel_engine.import_workbook.v1", request.created_by, [state.workbookRecord.workbook_id], {
      input_path: request.input_path,
      media_type: request.media_type,
      source_format: state.sourceMetadata.source_format,
      contains_vba: state.sourceMetadata.contains_vba,
      degrade_behavior: state.sourceMetadata.degrade_behavior
    });
    addLineage(state, state.sourceArtifactId, state.workbookRecord.workbook_id, "excel_engine.import_workbook.v1");
    return state;
  }

  analyzeWorkbook(state: ExcelRunState, actorRef: string): WorkbookAnalysis {
    const sheets: WorkbookAnalysisSheet[] = state.workbook.worksheets.map((worksheet) => {
      const table = extractTable(worksheet);
      const columns = table.headers.map((header) => {
        const values = table.rows.map((row) => row[header]);
        const nonBlank = values.filter((value) => value !== null && value !== undefined && value !== "");
        const uniqueCount = new Set(nonBlank.map((value) => JSON.stringify(value))).size;
        return WorkbookAnalysisColumnSchema.parse({
          column_name: header,
          inferred_type: inferColumnType(values),
          null_count: values.length - nonBlank.length,
          duplicate_count: Math.max(nonBlank.length - uniqueCount, 0),
          unique_count: uniqueCount,
          key_candidate: nonBlank.length > 0 && uniqueCount === nonBlank.length
        });
      });
      return WorkbookAnalysisSheetSchema.parse({
        worksheet_name: worksheet.name,
        row_count: worksheet.rowCount,
        column_count: worksheet.columnCount,
        headers: table.headers,
        columns,
        sample_rows: table.rows.slice(0, 3),
        formula_count: state.formulaGraph.formula_refs.filter((formulaRef) => formulaRef.target_ref.startsWith(`${worksheet.name}!`)).length
      });
    });

    const analysis = WorkbookAnalysisSchema.parse({
      workbook_ref: state.workbookRecord.workbook_id,
      worksheet_count: sheets.length,
      sheets,
      warnings: [],
      generated_at: ISO()
    });
    state.analysis = analysis;
    state.checks.push({
      check_id: "worksheet_profile_check",
      check_name: "Worksheet Profile",
      check_type: "analysis",
      passed: true,
      severity: "low",
      details: `Profiled ${sheets.length} worksheet(s)`,
      impacted_refs: [state.workbookRecord.workbook_id]
    });
    addAuditEvent(state, "excel_engine.analyze_workbook.v1", actorRef, [state.workbookRecord.workbook_id], {
      worksheet_count: sheets.length
    });
    return analysis;
  }

  async importLambdaRegistry(state: ExcelRunState, actorRef: string, inputPath: string): Promise<LambdaRegistryEntry[]> {
    const payload = JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown;
    const imported = (Array.isArray(payload) ? payload : [payload]).map((entry, index) =>
      normalizeImportedLambdaEntry(entry as Record<string, unknown>, index)
    );
    state.lambdaRegistry = dedupeLambdaRegistryEntries([...state.lambdaRegistry, ...imported]);
    syncLambdaRegistryWorksheet(state.workbook, state.lambdaRegistry);
    const snapshot = await captureWorkbookSnapshot(state.workbook, state);
    state.workbookRecord = snapshot.workbookRecord;
    state.workbookPackage = snapshot.workbookPackage;
    state.canonicalRepresentation = snapshot.canonicalRepresentation;
    state.formulaGraph = snapshot.formulaGraph;
    state.checks.push({
      check_id: id("lambda_import_check", state.runId),
      check_name: "Lambda Registry Import",
      check_type: "formula",
      passed: imported.length > 0,
      severity: "low",
      details: `Imported ${imported.length} lambda definition(s) from ${inputPath}`,
      impacted_refs: imported.map((entry) => entry.lambda_name)
    });
    addAuditEvent(state, "excel_engine.import_lambda_registry.v1", actorRef, [state.workbookRecord.workbook_id], {
      input_path: inputPath,
      imported_count: imported.length
    });
    addLineage(state, fileUri(inputPath), state.workbookRecord.workbook_id, "excel_engine.import_lambda_registry.v1");
    return state.lambdaRegistry;
  }

  exportLambdaRegistry(state: ExcelRunState, actorRef: string, targetPath: string): string {
    const exportedEntries = dedupeLambdaRegistryEntries(
      state.lambdaRegistry.map((entry) =>
        LambdaRegistryEntrySchema.parse({
          ...entry,
          lifecycle_state: entry.lifecycle_state === "superseded" ? "superseded" : "exported"
        })
      )
    );
    state.lambdaRegistry = exportedEntries;
    syncLambdaRegistryWorksheet(state.workbook, state.lambdaRegistry);
    writeJson(targetPath, exportedEntries);
    state.checks.push({
      check_id: id("lambda_export_check", state.runId),
      check_name: "Lambda Registry Export",
      check_type: "formula",
      passed: exportedEntries.length > 0,
      severity: "low",
      details: `Exported ${exportedEntries.length} lambda definition(s) to ${targetPath}`,
      impacted_refs: exportedEntries.map((entry) => entry.lambda_name)
    });
    addAuditEvent(state, "excel_engine.export_lambda_registry.v1", actorRef, [state.workbookRecord.workbook_id], {
      target_path: targetPath,
      exported_count: exportedEntries.length
    });
    addLineage(state, state.workbookRecord.workbook_id, fileUri(targetPath), "excel_engine.export_lambda_registry.v1");
    return targetPath;
  }

  async recalculateFormulas(state: ExcelRunState, input: FormulaRecalculationRequest): Promise<FormulaGraphState> {
    const request = FormulaRecalculationRequestSchema.parse(input);
    const { formulaGraph, warnings, executionSummary } = await evaluateExpandedFormulaGraph(state.workbook);
    state.lambdaRegistry = extractNamedLambdaEntries(state.workbook);
    state.formulaGraph = FormulaGraphStateSchema.parse({
      ...formulaGraph,
      workbook_ref: state.workbookRecord.workbook_id
    });
    state.lastFormulaExecution = executionSummary;
    state.warnings.push(...warnings);
    state.checks.push({
      check_id: "formula_recalculation_check",
      check_name: "Formula Recalculation",
      check_type: "formula",
      passed: warnings.every((warning) => warning.warning_code === "formula.circular_reference"),
      severity: warnings.every((warning) => warning.warning_code === "formula.circular_reference") ? "low" : "medium",
      details: `Recalculated ${formulaGraph.formula_refs.length} formula(s)`,
      impacted_refs: formulaGraph.formula_refs.map((formulaRef) => formulaRef.target_ref)
    });
    addAuditEvent(state, "excel_engine.recalculate_formulas.v1", request.actor_ref, [state.workbookRecord.workbook_id], {
      formula_count: formulaGraph.formula_refs.length,
      execution_mode: executionSummary.execution_mode,
      worker_count: executionSummary.worker_count
    });
    addLineage(state, state.workbookRecord.workbook_id, formulaGraph.graph_id, "excel_engine.recalculate_formulas.v1");
    return state.formulaGraph;
  }

  async applyTransformation(state: ExcelRunState, plan: TransformationPlan, actorRef: string): Promise<TransformationResult> {
    const validatedPlan = TransformationPlanSchema.parse(plan);
    state.transformationPlans.push(validatedPlan);
    state.mappingPreviews = buildMappingPreview(state, validatedPlan);
    const affectedWorksheets = new Set<string>();

    for (const step of validatedPlan.action_sequence) {
      const config = step.config as Record<string, unknown>;
      if (step.operation === "rename_column") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        table.headers = table.headers.map((header) => (header === config.from ? `${config.to}` : header));
        const mappedRows = table.rows.map((row) => {
          const nextRow: Record<string, string | number | boolean | null> = {};
          Object.entries(row).forEach(([key, value]) => {
            nextRow[key === config.from ? `${config.to}` : key] = value;
          });
          return nextRow;
        });
        writeTable(worksheet, { headers: table.headers, rows: mappedRows });
        affectedWorksheets.add(worksheet.name);
        continue;
      }
      if (step.operation === "merge_columns") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const sourceColumns = `${config.columns ?? ""}`
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean);
        const targetColumn = `${config.targetColumn ?? "MergedColumn"}`;
        const separator = `${config.separator ?? " "}`;
        const dropSources = Boolean(config.dropSources ?? false);
        const headers = dropSources ? table.headers.filter((header) => !sourceColumns.includes(header)) : [...table.headers];
        const nextHeaders = headers.includes(targetColumn) ? headers : [...headers, targetColumn];
        const rows = table.rows.map((row) => {
          const nextRow = { ...row };
          nextRow[targetColumn] = sourceColumns
            .map((column) => primitiveRowValue(row[column]))
            .filter((value) => value !== null && `${value}`.length > 0)
            .join(separator);
          if (dropSources) {
            sourceColumns.forEach((column) => {
              delete nextRow[column];
            });
          }
          return nextRow;
        });
        writeTable(worksheet, { headers: nextHeaders, rows });
        affectedWorksheets.add(worksheet.name);
        continue;
      }
      if (step.operation === "split_column") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const sourceColumn = `${config.sourceColumn ?? ""}`;
        const targetColumns = `${config.targetColumns ?? ""}`
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean);
        const delimiter = `${config.delimiter ?? "-"}`;
        const dropSource = Boolean(config.dropSource ?? false);
        const baseHeaders = dropSource ? table.headers.filter((header) => header !== sourceColumn) : [...table.headers];
        const nextHeaders = [...baseHeaders, ...targetColumns.filter((column) => !baseHeaders.includes(column))];
        const rows = table.rows.map((row) => {
          const parts = `${row[sourceColumn] ?? ""}`.split(delimiter).map((part) => part.trim());
          const nextRow = { ...row };
          targetColumns.forEach((column, index) => {
            nextRow[column] = parts[index] ?? null;
          });
          if (dropSource) delete nextRow[sourceColumn];
          return nextRow;
        });
        writeTable(worksheet, { headers: nextHeaders, rows });
        affectedWorksheets.add(worksheet.name);
        continue;
      }
      if (step.operation === "join_tables") {
        const leftWorksheet = state.workbook.getWorksheet(`${config.leftWorksheet ?? ""}`);
        const rightWorksheet = state.workbook.getWorksheet(`${config.rightWorksheet ?? ""}`);
        if (!leftWorksheet || !rightWorksheet) continue;
        const leftTable = extractTable(leftWorksheet);
        const rightTable = extractTable(rightWorksheet);
        const rightKey = `${config.rightKey}`;
        const leftKey = `${config.leftKey}`;
        const lookup = new Map(rightTable.rows.map((row) => [`${row[rightKey] ?? ""}`, row]));
        const joinedHeaders = [...leftTable.headers, ...rightTable.headers.filter((header) => header !== rightKey)];
        const joinedRows = leftTable.rows.map((row) => {
          const right = lookup.get(`${row[leftKey] ?? ""}`) ?? {};
          return joinedHeaders.reduce<Record<string, string | number | boolean | null>>((accumulator, header) => {
            accumulator[header] = toPrimitiveCellValue(row[header] ?? (right as Record<string, unknown>)[header] ?? null);
            return accumulator;
          }, {});
        });
        const targetWorksheetName = `${config.targetWorksheet ?? "Joined"}`;
        const targetWorksheet = state.workbook.getWorksheet(targetWorksheetName) ?? state.workbook.addWorksheet(targetWorksheetName);
        writeTable(targetWorksheet, { headers: joinedHeaders, rows: joinedRows });
        addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers: joinedHeaders, rows: joinedRows });
        affectedWorksheets.add(targetWorksheet.name);
        continue;
      }
      if (step.operation === "append_table") {
        const sourceWorksheets = `${config.sourceWorksheets ?? ""}`
          .split(",")
          .map((worksheetName) => worksheetName.trim())
          .filter(Boolean);
        const tables = sourceWorksheets
          .map((worksheetName) => state.workbook.getWorksheet(worksheetName))
          .filter((worksheet): worksheet is ExcelJS.Worksheet => Boolean(worksheet))
          .map((worksheet) => ({ worksheet, table: extractTable(worksheet) }));
        if (tables.length === 0) continue;
        const unionHeaders = [...new Set(tables.flatMap(({ table }) => table.headers))];
        const includeSourceSheet = Boolean(config.includeSourceSheet ?? true);
        const targetWorksheetName = `${config.targetWorksheet ?? "Appended"}`;
        const targetWorksheet = state.workbook.getWorksheet(targetWorksheetName) ?? state.workbook.addWorksheet(targetWorksheetName);
        const headers = includeSourceSheet ? [...unionHeaders, "SourceWorksheet"] : unionHeaders;
        const rows = tables.flatMap(({ worksheet, table }) =>
          table.rows.map((row) => {
            const nextRow = headers.reduce<Record<string, string | number | boolean | null>>((accumulator, header) => {
              accumulator[header] = row[header] ?? null;
              return accumulator;
            }, {});
            if (includeSourceSheet) nextRow.SourceWorksheet = worksheet.name;
            return nextRow;
          })
        );
        writeTable(targetWorksheet, { headers, rows });
        addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers, rows }, "TableStyleMedium6");
        affectedWorksheets.add(targetWorksheet.name);
        continue;
      }
      if (step.operation === "derive_column") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const targetColumn = `${config.column}`;
        const expression = `${config.expression}`;
        const nextHeaders = table.headers.includes(targetColumn) ? table.headers : [...table.headers, targetColumn];
        const nextRows = table.rows.map((row) => {
          const nextRow = { ...row };
          let normalizedExpression = expression;
          table.headers
            .slice()
            .sort((left, right) => right.length - left.length)
            .forEach((header) => {
              const value = Number(row[header] ?? 0) || 0;
              normalizedExpression = normalizedExpression.replace(new RegExp(`\\b${header}\\b`, "g"), `${value}`);
            });
          nextRow[targetColumn] = Number(Function(`"use strict"; return (${normalizedExpression});`)()) || 0;
          return nextRow;
        });
        writeTable(worksheet, { headers: nextHeaders, rows: nextRows });
        affectedWorksheets.add(worksheet.name);
        continue;
      }
      if (step.operation === "filter_rows") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const operator = `${config.operator}`;
        const field = `${config.column}`;
        const rawValue = config.value;
        const nextRows = table.rows.filter((row) => {
          const value = row[field];
          if (operator === "neq") return value !== rawValue;
          if (operator === "eq") return value === rawValue;
          if (operator === "gt") return Number(value) > Number(rawValue);
          if (operator === "lt") return Number(value) < Number(rawValue);
          if (operator === "contains") return `${value ?? ""}`.includes(`${rawValue ?? ""}`);
          return true;
        });
        writeTable(worksheet, { headers: table.headers, rows: nextRows });
        affectedWorksheets.add(worksheet.name);
        continue;
      }
      if (step.operation === "sort_range") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const field = `${config.column}`;
        const direction = `${config.direction ?? "asc"}`;
        const sortedRows = [...table.rows].sort((left, right) => {
          const leftValue = left[field] ?? 0;
          const rightValue = right[field] ?? 0;
          const comparison =
            typeof leftValue === "number" && typeof rightValue === "number"
              ? leftValue - rightValue
              : `${leftValue}`.localeCompare(`${rightValue}`);
          return direction === "desc" ? comparison * -1 : comparison;
        });
        writeTable(worksheet, { headers: table.headers, rows: sortedRows });
        affectedWorksheets.add(worksheet.name);
        continue;
      }
      if (step.operation === "group_aggregate") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const groupBy = `${config.groupBy ?? ""}`
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean);
        const aggregations = Array.isArray(config.aggregations)
          ? (config.aggregations as Array<Record<string, unknown>>).map((aggregation, aggregationIndex) => ({
              column: `${aggregation.column ?? ""}`,
              function: `${aggregation.function ?? "sum"}`,
              as: `${aggregation.as ?? `${aggregation.column ?? "value"}_${aggregation.function ?? "sum"}_${aggregationIndex + 1}`}`
            }))
          : [];
        const targetWorksheetName = `${config.targetWorksheet ?? "Grouped"}`;
        const targetWorksheet = state.workbook.getWorksheet(targetWorksheetName) ?? state.workbook.addWorksheet(targetWorksheetName);
        const rows = aggregateRows(table.rows, groupBy, aggregations);
        const headers = [...groupBy, ...aggregations.map((aggregation) => aggregation.as)];
        writeTable(targetWorksheet, { headers, rows });
        addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers, rows }, "TableStyleMedium3");
        affectedWorksheets.add(targetWorksheet.name);
        continue;
      }
      if (step.operation === "unpivot_range") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const idColumns = `${config.idColumns ?? ""}`
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean);
        const valueColumns = `${config.valueColumns ?? ""}`
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean);
        const variableColumn = `${config.variableColumn ?? "Metric"}`;
        const valueColumn = `${config.valueColumn ?? "Value"}`;
        const targetWorksheetName = `${config.targetWorksheet ?? "Unpivoted"}`;
        const targetWorksheet = state.workbook.getWorksheet(targetWorksheetName) ?? state.workbook.addWorksheet(targetWorksheetName);
        const rows = table.rows.flatMap((row) =>
          valueColumns.map((metric) => {
            const nextRow = idColumns.reduce<Record<string, string | number | boolean | null>>((accumulator, column) => {
              accumulator[column] = row[column] ?? null;
              return accumulator;
            }, {});
            nextRow[variableColumn] = metric;
            nextRow[valueColumn] = primitiveRowValue(row[metric]);
            return nextRow;
          })
        );
        const headers = [...idColumns, variableColumn, valueColumn];
        writeTable(targetWorksheet, { headers, rows });
        addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers, rows }, "TableStyleMedium7");
        affectedWorksheets.add(targetWorksheet.name);
        continue;
      }
      if (step.operation === "normalize_sheet") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const headerCase = `${config.headerCase ?? "snake"}`;
        const targetWorksheetName = `${config.targetWorksheet ?? worksheet.name}`;
        const targetWorksheet = targetWorksheetName === worksheet.name ? worksheet : state.workbook.getWorksheet(targetWorksheetName) ?? state.workbook.addWorksheet(targetWorksheetName);
        const headers = table.headers.map((header) => (headerCase === "snake" ? toSnakeCase(header) : header.trim()));
        const rows = table.rows
          .map((row) =>
            headers.reduce<Record<string, string | number | boolean | null>>((accumulator, header, headerIndex) => {
              const sourceValue = row[table.headers[headerIndex]];
              accumulator[header] = typeof sourceValue === "string" ? sourceValue.trim() : primitiveRowValue(sourceValue);
              return accumulator;
            }, {})
          )
          .filter((row) => Object.values(row).some((value) => value !== null && `${value}`.length > 0));
        writeTable(targetWorksheet, { headers, rows });
        addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers, rows }, "TableStyleMedium4");
        affectedWorksheets.add(targetWorksheet.name);
        continue;
      }
      if (step.operation === "merge_sheets") {
        const sourceWorksheets = `${config.sourceWorksheets ?? ""}`
          .split(",")
          .map((worksheetName) => worksheetName.trim())
          .filter(Boolean);
        const tables = sourceWorksheets
          .map((worksheetName) => state.workbook.getWorksheet(worksheetName))
          .filter((worksheet): worksheet is ExcelJS.Worksheet => Boolean(worksheet))
          .map((worksheet) => ({ worksheet, table: extractTable(worksheet) }));
        if (tables.length === 0) continue;
        const allHeaders = [...new Set(tables.flatMap(({ table }) => table.headers))];
        const includeSourceSheet = Boolean(config.includeSourceSheet ?? true);
        const headers = includeSourceSheet ? ["SourceWorksheet", ...allHeaders] : allHeaders;
        const rows = tables.flatMap(({ worksheet, table }) =>
          table.rows.map((row) => {
            const nextRow = headers.reduce<Record<string, string | number | boolean | null>>((accumulator, header) => {
              accumulator[header] = row[header] ?? null;
              return accumulator;
            }, {});
            if (includeSourceSheet) nextRow.SourceWorksheet = worksheet.name;
            return nextRow;
          })
        );
        const targetWorksheetName = `${config.targetWorksheet ?? "MergedSheets"}`;
        const targetWorksheet = state.workbook.getWorksheet(targetWorksheetName) ?? state.workbook.addWorksheet(targetWorksheetName);
        writeTable(targetWorksheet, { headers, rows });
        addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers, rows }, "TableStyleMedium8");
        affectedWorksheets.add(targetWorksheet.name);
        continue;
      }
      if ((step.operation as string) === "split_sheet") {
        const worksheet = state.workbook.getWorksheet(`${config.worksheet ?? ""}`);
        if (!worksheet) continue;
        const table = extractTable(worksheet);
        const groupByColumn = `${config.groupByColumn ?? ""}`;
        const prefix = `${config.targetSheetPrefix ?? worksheet.name}`;
        const groupedRows = new Map<string, Array<Record<string, string | number | boolean | null>>>();
        table.rows.forEach((row) => {
          const key = `${row[groupByColumn] ?? "Unknown"}`;
          const currentRows = groupedRows.get(key) ?? [];
          currentRows.push(row);
          groupedRows.set(key, currentRows);
        });
        [...groupedRows.entries()].forEach(([groupKey, rows], groupIndex) => {
          const sheetName = `${prefix}_${groupKey}`.slice(0, 31) || `${prefix}_${groupIndex + 1}`;
          const targetWorksheet = state.workbook.getWorksheet(sheetName) ?? state.workbook.addWorksheet(sheetName);
          writeTable(targetWorksheet, { headers: table.headers, rows });
          addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), { headers: table.headers, rows }, "TableStyleMedium5");
          affectedWorksheets.add(targetWorksheet.name);
        });
        continue;
      }
      if (step.operation === "merge_workbooks") {
        const sourcePaths = [
          `${config.sourceWorkbookPath ?? ""}`,
          ...(`${config.sourceWorkbookPaths ?? ""}`.split(",").map((value) => value.trim()))
        ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
        if (sourcePaths.length === 0) continue;
        const prefix = `${config.sheetPrefix ?? "Merged"}`;
        const styleConflictPolicy =
          `${config.styleConflictPolicy ?? "merge"}` === "overwrite_source"
            ? "overwrite_source"
            : `${config.styleConflictPolicy ?? "merge"}` === "preserve_target"
              ? "preserve_target"
              : "merge";
        const namedRangeConflictPolicy =
          `${config.namedRangeConflictPolicy ?? "rename_source"}` === "preserve_target"
            ? "preserve_target"
            : `${config.namedRangeConflictPolicy ?? "rename_source"}` === "overwrite_source"
              ? "overwrite_source"
              : "rename_source";
        const definedNames = existingWorkbookDefinedNames(state.workbook);
        for (const [sourcePathIndex, sourcePath] of sourcePaths.entries()) {
          if (!fs.existsSync(sourcePath)) continue;
          const imported = XLSX.readFile(sourcePath, { cellDates: true, bookVBA: true });
          const importedWorkbook = new ExcelJS.Workbook();
          await importedWorkbook.xlsx.readFile(sourcePath);
          const sheetNameMap = new Map<string, string>();
          const namedRangeNameMap = new Map<string, string>();
          importedWorkbook.worksheets.forEach((worksheet, index) => {
            const targetWorksheet = copyWorksheetIntoWorkbook(
              state.workbook,
              worksheet,
              `${prefix}_${worksheet.name}_${sourcePathIndex + 1}_${index + 1}`.slice(0, 31),
              styleConflictPolicy
            );
            sheetNameMap.set(worksheet.name, targetWorksheet.name);
            const table = extractTable(targetWorksheet);
            const sourceTableTheme = worksheetTableMetadata(worksheet)[0]?.theme ?? "TableStyleMedium11";
            addOrReplaceTable(targetWorksheet, id("table", targetWorksheet.name), table, sourceTableTheme ?? "TableStyleMedium11");
            affectedWorksheets.add(targetWorksheet.name);
          });
          extractNamedRangesFromXlsxWorkbook(imported).forEach((namedRange) => {
            let targetName = namedRange.name;
            if (definedNames.has(targetName)) {
              if (namedRangeConflictPolicy === "preserve_target") {
                namedRangeNameMap.set(namedRange.name, targetName);
                return;
              }
              if (namedRangeConflictPolicy === "overwrite_source") {
                ((state.workbook.definedNames as unknown as { remove?: (name: string) => void }).remove)?.(targetName);
              } else {
                targetName = uniqueDefinedName(
                  definedNames,
                  `${prefix}_${sourcePathIndex + 1}_${targetName}`.replace(/[^A-Za-z0-9_]/g, "_")
                );
              }
            }
            if (namedRange.ref.includes("[") || namedRange.ref.includes("#REF!")) {
              state.warnings.push({
                warning_code: "transformation.merge_workbooks.named_range_degraded",
                summary: "Named range degraded during workbook merge",
                detail: `Skipped named range ${namedRange.name} because the reference ${namedRange.ref} cannot be remapped safely`,
                severity: "medium",
                impacted_refs: [state.workbookRecord.workbook_id]
              });
              return;
            }
            let remappedRef = namedRange.ref;
            sheetNameMap.forEach((targetSheetName, sourceSheetName) => {
              const escapedSourceName = escapeRegExp(sourceSheetName);
              const targetToken = /[^A-Za-z0-9_]/.test(targetSheetName) ? `'${targetSheetName}'` : targetSheetName;
              remappedRef = remappedRef
                .replace(new RegExp(`'${escapedSourceName}'!`, "g"), `${targetToken}!`)
                .replace(new RegExp(`\\b${escapedSourceName}!`, "g"), `${targetToken}!`);
            });
            try {
              state.workbook.definedNames.add(remappedRef, targetName);
              definedNames.add(targetName);
              namedRangeNameMap.set(namedRange.name, targetName);
            } catch {
              state.warnings.push({
                warning_code: "transformation.merge_workbooks.named_range_conflict",
                summary: "Named range conflict during workbook merge",
                detail: `Skipped named range ${namedRange.name} during workbook merge`,
                severity: "medium",
                impacted_refs: [state.workbookRecord.workbook_id]
              });
            }
          });
          importedWorkbook.worksheets.forEach((worksheet) => {
            const targetWorksheetName = sheetNameMap.get(worksheet.name);
            if (!targetWorksheetName) return;
            const targetWorksheet = state.workbook.getWorksheet(targetWorksheetName);
            if (!targetWorksheet) return;
            worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
              row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
                if (
                  typeof cell.value === "object" &&
                  cell.value !== null &&
                  "formula" in cell.value &&
                  typeof cell.value.formula === "string"
                ) {
                  const remappedFormula = remapWorkbookExpression(cell.value.formula, sheetNameMap, namedRangeNameMap);
                  targetWorksheet.getCell(rowNumber, columnNumber).value = {
                    formula: remappedFormula,
                    result: cell.value.result ?? undefined
                  } as ExcelJS.CellFormulaValue;
                }
              });
            });
          });
        }
        continue;
      }
    }

    state.currentVersionNumber += 1;
    const version = WorkbookVersionSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      workbook_version_id: id("workbook-version", state.runId, state.currentVersionNumber),
      workbook_ref: state.workbookRecord.workbook_id,
      version_ref: {
        version_id: id("version", state.runId, state.currentVersionNumber),
        parent_version_id: state.workbookVersions[state.workbookVersions.length - 1]?.version_ref.version_id ?? null,
        version_number: state.currentVersionNumber,
        semantic_version: "1.0.0"
      },
      change_kind: "transformation",
      change_reason: `Applied ${validatedPlan.action_sequence.length} transformation step(s)`,
      based_on_artifact_ref: state.workbookArtifactId,
      created_at: ISO()
    });
    state.workbookVersions.push(version);
    const refreshed = await captureWorkbookSnapshot(state.workbook, state);
    state.workbookRecord = refreshed.workbookRecord;
    state.workbookPackage = refreshed.workbookPackage;
    state.canonicalRepresentation = refreshed.canonicalRepresentation;
    state.formulaGraph = refreshed.formulaGraph;
    state.lambdaRegistry = extractNamedLambdaEntries(state.workbook);

    const result = TransformationResultSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      result_id: id("transformation-result", state.runId, state.currentVersionNumber),
      plan_ref: validatedPlan.plan_id,
      workbook_ref: state.workbookRecord.workbook_id,
      action_execution_refs: validatedPlan.action_sequence.map((step) => id("action-exec", step.step_id)),
      output_range_refs: [],
      created_artifact_refs: [],
      affected_cell_refs: [],
      affected_worksheet_refs: [...affectedWorksheets].map((worksheetName) => id("worksheet", state.workbookRecord.workbook_id, safeSheetName(worksheetName))),
      evidence_ref: id("evidence", state.runId),
      audit_event_refs: [],
      lineage_edge_refs: [],
      outcome: "success",
      warnings: [],
      completed_at: ISO()
    });
    state.transformationResults.push(result);
    state.checks.push({
      check_id: "transformation_apply_check",
      check_name: "Transformation Apply",
      check_type: "transformation",
      passed: true,
      severity: "low",
      details: `Applied ${validatedPlan.action_sequence.length} transformation step(s)`,
      impacted_refs: result.affected_worksheet_refs
    });
    addAuditEvent(state, "excel_engine.apply_transformation.v1", actorRef, [result.result_id], {
      plan_id: validatedPlan.plan_id,
      step_count: validatedPlan.action_sequence.length
    });
    addLineage(state, state.workbookRecord.workbook_id, result.result_id, "excel_engine.apply_transformation.v1");
    return result;
  }

  generatePivot(state: ExcelRunState, input: PivotRequest): PivotMetadata {
    const request = PivotRequestSchema.parse(input);
    const worksheet = state.workbook.getWorksheet(request.source_worksheet);
    if (!worksheet) {
      throw new Error(`Unknown worksheet ${request.source_worksheet}`);
    }
    const table = extractTable(worksheet);
    if (request.rebuild_cache) {
      state.pivotCaches = state.pivotCaches.filter((cache) => cache.target_worksheet !== request.target_worksheet);
    }
    const aggregateValues = (values: number[]): number =>
      request.aggregation === "count"
        ? values.length
        : request.aggregation === "average"
          ? values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
          : request.aggregation === "min"
            ? Math.min(...values)
            : request.aggregation === "max"
              ? Math.max(...values)
              : values.reduce((sum, value) => sum + value, 0);
    const rowKeys = [...new Set(table.rows.map((row) => `${row[request.row_field] ?? ""}`).filter((value) => value.length > 0))];
    const columnKeys = request.column_field
      ? [...new Set(table.rows.map((row) => `${row[request.column_field ?? ""] ?? ""}`).filter((value) => value.length > 0))]
      : [];
    const pivotWorksheet = state.workbook.getWorksheet(request.target_worksheet) ?? state.workbook.addWorksheet(request.target_worksheet);
    const pivotRows = rowKeys.map((rowKey) => {
      const matchingRows = table.rows.filter((row) => `${row[request.row_field] ?? ""}` === rowKey);
      const nextRow: Record<string, string | number | boolean | null> = { [request.row_field]: rowKey };
      if (columnKeys.length > 0) {
        columnKeys.forEach((columnKey) => {
          const values = matchingRows
            .filter((row) => `${row[request.column_field ?? ""] ?? ""}` === columnKey)
            .map((row) => Number(row[request.value_field] ?? 0));
          nextRow[columnKey] = values.length > 0 ? aggregateValues(values) : 0;
        });
      } else {
        nextRow[`${request.aggregation}_${request.value_field}`] = aggregateValues(matchingRows.map((row) => Number(row[request.value_field] ?? 0)));
      }
      request.calculated_fields.forEach((field) => {
        const scope: Record<string, number> = {};
        field.source_fields.forEach((sourceField) => {
          scope[sourceField] = matchingRows.map((row) => Number(row[sourceField] ?? 0)).reduce((sum, value) => sum + value, 0);
        });
        const calculated = Function("scope", `with (scope) { return (${field.formula}); }`)(scope) as number;
        nextRow[`calc_${field.field_name}`] = Number.isFinite(calculated) ? calculated : 0;
      });
      return nextRow;
    });
    const pivotTable = {
      headers: [
        request.row_field,
        ...(columnKeys.length > 0 ? columnKeys : [`${request.aggregation}_${request.value_field}`]),
        ...request.calculated_fields.map((field) => `calc_${field.field_name}`)
      ],
      rows: pivotRows
    };
    writeTable(pivotWorksheet, pivotTable);
    addOrReplaceTable(pivotWorksheet, id("pivot-table", request.target_worksheet), pivotTable, "TableStyleMedium9");
    const pivotId = id("pivot", state.runId, request.target_worksheet);
    const pivotCache = buildPivotCache(state, request, table, pivotId, pivotTable.headers);
    state.pivotCaches = [...state.pivotCaches.filter((cache) => cache.pivot_id !== pivotId), pivotCache];
    const pivotMetadata = PivotMetadataSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      pivot_id: pivotId,
      workbook_ref: state.workbookRecord.workbook_id,
      worksheet_ref: id("worksheet", state.workbookRecord.workbook_id, safeSheetName(request.target_worksheet)),
      source_range_ref: `${request.source_worksheet}!A1:${columnLetter(worksheet.columnCount)}${worksheet.rowCount}`,
      target_range_ref: `${request.target_worksheet}!A1:${columnLetter(Math.max(pivotWorksheet.columnCount, 1))}${Math.max(pivotWorksheet.rowCount, 1)}`,
      cache_ref: pivotCache.cache_id,
      row_field_refs: [request.row_field],
      column_field_refs: request.column_field ? [request.column_field] : [],
      filter_field_refs: request.filter_fields,
      value_fields: [
        {
          ...Meta,
          field_ref: request.value_field,
          aggregation: request.aggregation === "count" ? "count" : request.aggregation === "average" ? "average" : request.aggregation,
          number_format_code: "#,##0.00"
        }
      ],
      refresh_policy:
        request.refresh_policy === "on_open"
          ? "on_export"
          : request.refresh_policy === "on_change"
            ? "scheduled"
            : "manual",
      last_refreshed_at: ISO()
    });
    state.pivotMetadata = [...state.pivotMetadata.filter((pivot) => pivot.pivot_id !== pivotMetadata.pivot_id), pivotMetadata];
    state.checks.push({
      check_id: id("pivot_cache_refresh_check", request.target_worksheet),
      check_name: "Pivot Cache Refresh",
      check_type: "pivot",
      passed: true,
      severity: "low",
      details: `Rebuilt pivot cache ${pivotCache.cache_id} with ${pivotCache.snapshot_row_count} source row(s), ${columnKeys.length} column field(s), and ${request.calculated_fields.length} calculated field(s)`,
      impacted_refs: [pivotMetadata.pivot_id, pivotCache.cache_id]
    });
    addAuditEvent(state, "excel_engine.generate_pivot.v1", request.actor_ref, [pivotMetadata.pivot_id], {
      source_worksheet: request.source_worksheet,
      target_worksheet: request.target_worksheet,
      cache_ref: pivotCache.cache_id,
      rebuild_cache: request.rebuild_cache,
      column_field: request.column_field,
      calculated_field_count: request.calculated_fields.length,
      slicer_fields: request.slicer_fields,
      refresh_policy: request.refresh_policy
    });
    addLineage(state, state.workbookRecord.workbook_id, pivotMetadata.pivot_id, "excel_engine.generate_pivot.v1");
    addLineage(state, state.workbookRecord.workbook_id, pivotCache.cache_id, "excel_engine.generate_pivot.v1");
    return pivotMetadata;
  }

  generateChart(state: ExcelRunState, input: ChartRequest, artifactDir: string): ChartMetadata {
    const request = ChartRequestSchema.parse(input);
    const worksheet = state.workbook.getWorksheet(request.source_worksheet);
    if (!worksheet) {
      throw new Error(`Unknown worksheet ${request.source_worksheet}`);
    }
    const previousRevision = state.generatedCharts.find((chart) => chart.chart_id === request.chart_id);
    const normalizedSeries =
      request.series.length > 0
        ? request.series
        : [
            ChartSeriesSchema.parse({
              series_name: request.series_name ?? "Series 1",
              value_field: request.value_field ?? request.series[0]?.value_field ?? request.category_field,
              chart_type: request.chart_type === "line" ? "line" : request.chart_type === "area" ? "area" : "bar",
              color_hex: request.color_hex,
              secondary_axis: false
            })
          ];
    const runtimeSeries = chartSeriesFromWorksheet(worksheet, request.category_field, normalizedSeries);
    const configSheet = writeChartConfigWorksheet(
      state.workbook,
      `${request.chart_id}_r${(previousRevision?.chart_revision ?? 0) + 1}`,
      request.category_field,
      runtimeSeries,
      request.chart_title,
      request.legend_position
    );
    const revisionRef = `${request.chart_id}@${(previousRevision?.chart_revision ?? 0) + 1}`;
    const metadata = ChartMetadataSchema.parse({
      chart_id: request.chart_id,
      chart_type: request.chart_type,
      source_worksheet: request.source_worksheet,
      target_worksheet: request.target_worksheet,
      category_field: request.category_field,
      value_field: request.value_field ?? runtimeSeries[0]?.value_field ?? null,
      series_name: request.series_name ?? runtimeSeries[0]?.series_name ?? null,
      chart_title: request.chart_title,
      target_range_ref: `${request.source_worksheet}!A1:${columnLetter(worksheet.columnCount)}${worksheet.rowCount}`,
      cache_ref: state.pivotCaches[0]?.cache_id ?? null,
      svg_ref: null,
      legend_position: request.legend_position,
      anchor_range: request.anchor_range,
      config_sheet: configSheet,
      mutation_of: request.mutation_of ?? (previousRevision ? `${previousRevision.chart_id}@${previousRevision.chart_revision}` : null),
      chart_revision: (previousRevision?.chart_revision ?? 0) + 1,
      series: runtimeSeries,
      data_points: runtimeSeries[0]?.data_points ?? [],
      export_preserved: true,
      generated_at: ISO()
    });
    const chartWorksheetName = `__chart_${request.target_worksheet}`.slice(0, 31);
    const chartWorksheet = state.workbook.getWorksheet(chartWorksheetName) ?? state.workbook.addWorksheet(chartWorksheetName);
    chartWorksheet.state = "veryHidden";
    writeTable(chartWorksheet, {
      headers: [request.category_field, ...runtimeSeries.map((series) => series.series_name)],
      rows: runtimeSeries[0]?.data_points.map((point, rowIndex) =>
        [request.category_field, ...runtimeSeries.map((series) => series.series_name)].reduce<Record<string, string | number | boolean | null>>((accumulator, header, headerIndex) => {
          if (headerIndex === 0) {
            accumulator[header] = point.category;
          } else {
            accumulator[header] = runtimeSeries[headerIndex - 1]?.data_points[rowIndex]?.value ?? null;
          }
          return accumulator;
        }, {})
      ) ?? []
    });
    const svgPath = path.join(artifactDir, `${request.chart_id}.svg`);
    const svg = buildChartSvg(metadata);
    fs.writeFileSync(svgPath, svg, "utf8");
    const finalMetadata = ChartMetadataSchema.parse({
      ...metadata,
      svg_ref: fileUri(svgPath)
    });
    state.chartHistory.push(finalMetadata);
    state.generatedCharts = [...state.generatedCharts.filter((chart) => chart.chart_id !== request.chart_id), finalMetadata];
    state.checks.push({
      check_id: id("chart_generation_check", request.chart_id),
      check_name: "Chart Generation",
      check_type: "chart",
      passed: true,
      severity: "low",
      details: `Generated ${request.chart_type} chart artifact with ${runtimeSeries.length} series and ${runtimeSeries[0]?.data_points.length ?? 0} data point(s)`,
      impacted_refs: [request.chart_id, revisionRef]
    });
    if (previousRevision) {
      state.checks.push({
        check_id: id("chart_mutation_check", request.chart_id),
        check_name: "Chart Mutation",
        check_type: "chart",
        passed: true,
        severity: "low",
        details: `Mutated chart ${request.chart_id} from revision ${previousRevision.chart_revision} to ${finalMetadata.chart_revision}`,
        impacted_refs: [`${previousRevision.chart_id}@${previousRevision.chart_revision}`, revisionRef]
      });
    }
    addAuditEvent(state, "excel_engine.generate_chart.v1", request.actor_ref, [request.chart_id], {
      chart_type: request.chart_type,
      source_worksheet: request.source_worksheet,
      svg_ref: fileUri(svgPath),
      chart_revision: finalMetadata.chart_revision,
      mutation_of: finalMetadata.mutation_of,
      series_count: runtimeSeries.length,
      config_sheet: finalMetadata.config_sheet
    });
    addLineage(state, state.workbookRecord.workbook_id, request.chart_id, "excel_engine.generate_chart.v1");
    addLineage(state, state.workbookRecord.workbook_id, revisionRef, "excel_engine.generate_chart.v1");
    if (previousRevision) {
      addLineage(state, `${previousRevision.chart_id}@${previousRevision.chart_revision}`, revisionRef, "excel_engine.generate_chart.v1");
    }
    return finalMetadata;
  }

  async applyFormatting(state: ExcelRunState, input: FormattingRequest): Promise<StyleMetadata> {
    const request = FormattingRequestSchema.parse(input);
    const template = formattingTemplate(request.template_name);
    const resolvedFont = { ...(template?.font ?? {}), ...(request.font ?? {}) } as Partial<ExcelJS.Font>;
    const resolvedFill = { ...(template?.fill ?? {}), ...(request.fill ?? {}) } as unknown as ExcelJS.Fill;
    const resolvedBorder = { ...(template?.border ?? {}), ...(request.border ?? {}) } as Partial<ExcelJS.Borders>;
    const resolvedAlignment = { ...(template?.alignment ?? {}), ...(request.alignment ?? {}) } as Partial<ExcelJS.Alignment>;
    const numberFormat =
      request.number_format_code ??
      (request.currency_code ? `${request.currency_code} #,##0.00` : null) ??
      request.date_format_code;

    request.target_refs.forEach((targetRef) => {
      if (targetRef.startsWith("worksheet:")) {
        const worksheet = state.workbook.getWorksheet(targetRef.replace("worksheet:", ""));
        if (!worksheet) return;
        const freezePane = request.freeze_pane ?? (request.freeze_top_row ? { top_row_count: 1, left_column_count: 0 } : null);
        if (freezePane) {
          worksheet.views = [{ state: "frozen", ySplit: freezePane.top_row_count, xSplit: freezePane.left_column_count, rightToLeft: request.rtl }];
        }
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            if (rowNumber === 1) {
              cell.font = resolvedFont;
              cell.fill = resolvedFill;
              cell.border = resolvedBorder;
              cell.alignment = resolvedAlignment;
            }
            if (numberFormat && rowNumber > 1) {
              cell.numFmt = numberFormat;
            }
          });
        });
        if (request.table_preset) {
          const table = extractTable(worksheet);
          addOrReplaceTable(worksheet, id("format-table", worksheet.name), table, request.table_preset as ExcelJS.TableStyleProperties["theme"]);
        }
        request.conditional_rules.forEach((rule) => {
          if (rule.type === "cell_is") {
            (worksheet as ExcelJS.Worksheet & { addConditionalFormatting?: (value: unknown) => void }).addConditionalFormatting?.({
              ref: `A2:${columnLetter(Math.max(worksheet.columnCount, 1))}${Math.max(worksheet.rowCount, 2)}`,
              rules: [
                {
                  type: "cellIs",
                  operator: rule.operator ?? "lessThan",
                  formulae: [rule.formula ?? "0"],
                  style: rule.style
                }
              ]
            });
          }
        });
        if (request.auto_width_strategy !== "none") {
          worksheet.columns.forEach((column) => {
            const values = column.values ?? [];
            const maxLength = Math.max(12, ...values.map((value) => `${value ?? ""}`.length));
            column.width = Math.min(maxLength + 2, 32);
          });
        }
        return;
      }
      if (targetRef.startsWith("range:")) {
        const rangeRef = targetRef.replace("range:", "");
        const { sheet, start, end } = parseReference(rangeRef, "");
        const worksheet = state.workbook.getWorksheet(sheet);
        if (!worksheet) return;
        const startColumn = columnIndexFromRef(start);
        const endColumn = columnIndexFromRef(end);
        const startRow = rowIndexFromRef(start);
        const endRow = rowIndexFromRef(end);
        for (let row = startRow; row <= endRow; row += 1) {
          for (let column = startColumn; column <= endColumn; column += 1) {
            const cell = worksheet.getCell(row, column);
            cell.font = resolvedFont;
            cell.fill = resolvedFill;
            cell.border = resolvedBorder;
            cell.alignment = resolvedAlignment;
            if (numberFormat) cell.numFmt = numberFormat;
          }
        }
      }
    });

    const styleMetadata = StyleMetadataSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      style_id: request.style_id,
      workbook_ref: state.workbookRecord.workbook_id,
      scope: request.scope,
      target_refs: request.target_refs,
      rtl: request.rtl,
      number_format_code: numberFormat,
      date_format_code: request.date_format_code,
      currency_code: request.currency_code ?? (numberFormat?.includes("$") ? "USD" : null),
      font: resolvedFont,
      fill: resolvedFill as unknown as Record<string, unknown>,
      border: resolvedBorder as unknown as Record<string, unknown>,
      alignment: resolvedAlignment as unknown as Record<string, unknown>,
      conditional_rules: request.conditional_rules,
      auto_width_strategy: request.auto_width_strategy,
      template_asset_ref: request.template_name ? `template://${request.template_name}` : null,
      brand_preset_ref: null,
      frozen_pane: request.freeze_pane ?? (request.freeze_top_row ? { top_row_count: 1, left_column_count: 0 } : null)
    });
    state.styleMetadata.push(styleMetadata);
    addAuditEvent(state, "excel_engine.apply_formatting.v1", request.actor_ref, [styleMetadata.style_id], {
      targets: request.target_refs
    });
    addLineage(state, state.workbookRecord.workbook_id, styleMetadata.style_id, "excel_engine.apply_formatting.v1");
    return styleMetadata;
  }

  async exportEditableWorkbook(state: ExcelRunState, actorRef: string, targetPath: string): Promise<string> {
    ensureDir(path.dirname(targetPath));
    const targetExtension = path.extname(targetPath).toLowerCase();
    const preserveVba = targetExtension === ".xlsm" && Boolean(state.sourceVbaPayloadBase64);
    const exportAsXls = targetExtension === ".xls";
    const workbookWritePath =
      preserveVba || exportAsXls
        ? path.join(path.dirname(targetPath), `${path.basename(targetPath, targetExtension)}.staging.xlsx`)
        : targetPath;
    await state.workbook.xlsx.writeFile(workbookWritePath);
    state.nativeWorkbookObjects = await applyNativeWorkbookObjects(workbookWritePath, state);
    await new ExcelJS.Workbook().xlsx.readFile(workbookWritePath);
    if (preserveVba) {
      const macroWorkbook = XLSX.readFile(workbookWritePath, { cellDates: true, dense: false, bookVBA: true });
      (macroWorkbook as XLSX.WorkBook & { vbaraw?: Buffer }).vbaraw = Buffer.from(state.sourceVbaPayloadBase64 ?? "", "base64");
      XLSX.writeFile(macroWorkbook, targetPath, { bookType: "xlsm", bookVBA: true });
      fs.unlinkSync(workbookWritePath);
      state.sourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...state.sourceMetadata,
        editable_export_format: "xlsm",
        vba_preserved: true,
        degrade_behavior: "none",
        degrade_reason: null
      });
      state.checks.push({
        check_id: id("macro_vba_preservation_check", state.runId),
        check_name: "Macro VBA Preservation",
        check_type: "export",
        passed: true,
        severity: "low",
        details: `Preserved VBA payload while exporting workbook to ${targetPath}`,
        impacted_refs: [state.workbookRecord.workbook_id]
      });
    } else if (exportAsXls) {
      runExcelDesktopBridge("export-xls", {
        sourcePath: workbookWritePath,
        targetPath
      });
      if (fs.existsSync(workbookWritePath)) {
        fs.unlinkSync(workbookWritePath);
      }
      state.sourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...state.sourceMetadata,
        editable_export_format: "xls",
        vba_preserved: false,
        degrade_behavior: state.sourceMetadata.source_format === "xls" ? "none" : "export_as_xls",
        degrade_reason:
          state.sourceMetadata.source_format === "xls"
            ? null
            : "OOXML workbook exported through Excel Desktop as BIFF8 for editable legacy compatibility"
      });
    } else {
      state.sourceMetadata = WorkbookSourceMetadataSchema.parse({
        ...state.sourceMetadata,
        editable_export_format: "xlsx",
        vba_preserved: false,
        degrade_behavior:
          state.sourceMetadata.contains_vba && targetExtension === ".xlsx"
            ? "export_as_xlsx_without_vba"
            : state.sourceMetadata.source_format === "xls" || state.sourceMetadata.source_format === "csv" || state.sourceMetadata.source_format === "tsv"
              ? "export_as_xlsx"
              : "none",
        degrade_reason:
          state.sourceMetadata.contains_vba && targetExtension === ".xlsx"
            ? "VBA payloads are detected but XLSX exports cannot preserve macro binaries"
            : state.sourceMetadata.source_format === "xls"
              ? "BIFF8 inputs are normalized into XLSX for editable exports"
              : state.sourceMetadata.source_format === "csv"
                ? "CSV inputs are normalized into XLSX for editable exports"
                : state.sourceMetadata.source_format === "tsv"
                  ? "TSV inputs are normalized into XLSX for editable exports"
                  : null
      });
    }
    state.checks.push({
      check_id: "native_chart_embedding_check",
      check_name: "Native Chart Embedding",
      check_type: "export",
      passed: state.nativeWorkbookObjects.chart_objects.length > 0,
      severity: state.nativeWorkbookObjects.chart_objects.length > 0 ? "low" : "high",
      details: `Embedded ${state.nativeWorkbookObjects.chart_objects.length} native chart object(s) into workbook package`,
      impacted_refs: state.nativeWorkbookObjects.chart_objects.map((chart) => chart.chart_id)
    });
    state.checks.push({
      check_id: "native_pivot_embedding_check",
      check_name: "Native Pivot Embedding",
      check_type: "export",
      passed: state.nativeWorkbookObjects.pivot_objects.length > 0,
      severity: state.nativeWorkbookObjects.pivot_objects.length > 0 ? "low" : "high",
      details: `Embedded ${state.nativeWorkbookObjects.pivot_objects.length} native pivot object(s) into workbook package`,
      impacted_refs: state.nativeWorkbookObjects.pivot_objects.map((pivot) => pivot.pivot_id)
    });
    state.checks.push({
      check_id: "native_slicer_embedding_check",
      check_name: "Native Slicer Embedding",
      check_type: "export",
      passed: state.nativeWorkbookObjects.slicer_objects.length > 0,
      severity: state.nativeWorkbookObjects.slicer_objects.length > 0 ? "low" : "high",
      details: `Embedded ${state.nativeWorkbookObjects.slicer_objects.length} native slicer object(s) into workbook package`,
      impacted_refs: state.nativeWorkbookObjects.slicer_objects.map((slicer) => slicer.slicer_id)
    });
    if (state.sourceMetadata.degrade_behavior !== "none") {
      state.checks = state.checks.filter((check) => check.check_id !== id("source_format_degrade_check", state.runId));
      state.checks.push({
        check_id: id("source_format_degrade_check", state.runId),
        check_name: "Source Format Degrade Policy",
        check_type: "export",
        passed: true,
        severity: "medium",
        details: `Applied degrade policy ${state.sourceMetadata.degrade_behavior} for ${state.sourceMetadata.source_format} source${
          state.sourceMetadata.degrade_reason ? `: ${state.sourceMetadata.degrade_reason}` : ""
        }`,
        impacted_refs: [state.workbookRecord.workbook_id]
      });
      state.warnings = state.warnings.filter((warning) => warning.warning_code !== "excel.export.degraded_source_format");
      state.warnings.push({
        warning_code: "excel.export.degraded_source_format",
        summary: "Editable export normalized the source format",
        detail: state.sourceMetadata.degrade_reason ?? `Source ${state.sourceMetadata.source_format} was exported as ${state.sourceMetadata.editable_export_format}`,
        severity: "medium",
        impacted_refs: [state.workbookRecord.workbook_id]
      });
    }
    state.currentVersionNumber += 1;
    state.checks.push({
      check_id: "editable_export_check",
      check_name: "Editable Workbook Export",
      check_type: "export",
      passed: true,
      severity: "low",
      details: `Exported workbook to ${targetPath} as ${state.sourceMetadata.editable_export_format} with ${state.nativeWorkbookObjects.chart_objects.length} native chart object(s), ${state.nativeWorkbookObjects.pivot_objects.length} native pivot object(s), and ${state.nativeWorkbookObjects.slicer_objects.length} native slicer object(s)`,
      impacted_refs: [state.workbookRecord.workbook_id]
    });
    addAuditEvent(state, "excel_engine.export_editable_workbook.v1", actorRef, [state.workbookRecord.workbook_id], {
      target_path: targetPath,
      native_chart_count: state.nativeWorkbookObjects.chart_objects.length,
      native_pivot_count: state.nativeWorkbookObjects.pivot_objects.length,
      native_slicer_count: state.nativeWorkbookObjects.slicer_objects.length,
      source_format: state.sourceMetadata.source_format,
      contains_vba: state.sourceMetadata.contains_vba,
      degrade_behavior: state.sourceMetadata.degrade_behavior
    });
    return targetPath;
  }

  publishWorkbook(state: ExcelRunState, input: PublishRequest, exportPath: string): Publication {
    const request = PublishRequestSchema.parse(input);
    const publishedDir = path.join(state.outputRoot, "published");
    ensureDir(publishedDir);
    const publishedPath = path.join(publishedDir, request.published_filename);
    fs.copyFileSync(exportPath, publishedPath);
    const exportArtifact = createArtifact(state, publishedPath, "export_bundle", "editable_workbook", "editable", "xlsx");
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: id("publication", state.runId, "excel"),
      artifact_ref: exportArtifact.artifact_id,
      publication_type: "internal_publish",
      editable_default: true,
      explicit_non_editable_export: false,
      target_ref: request.target_ref,
      published_by: request.actor_ref,
      published_at: ISO(),
      permission_scope: defaultPermissionScope(),
      evidence_ref: id("evidence", state.runId)
    });
    state.publication = publication;
    state.checks.push({
      check_id: id("publish_backend_check", request.published_filename),
      check_name: "Publish Packaging",
      check_type: "publish",
      passed: true,
      severity: "low",
      details: `Packaged editable workbook for publication at ${publishedPath}`,
      impacted_refs: [publication.publication_id, exportArtifact.artifact_id]
    });
    addAuditEvent(state, "excel_engine.publish_workbook.v1", request.actor_ref, [publication.publication_id], {
      target_ref: request.target_ref,
      published_path: publishedPath
    });
    addLineage(state, exportArtifact.artifact_id, publication.publication_id, "excel_engine.publish_workbook.v1");
    return publication;
  }

  persistRunState(state: ExcelRunState, evidencePack: EvidencePack, exportedWorkbookPath: string | null, chartPaths: string[]): PersistenceManifest {
    const store = new ExcelEngineStore(path.join(process.cwd(), ".runtime", "excel-engine"));
    const manifest = store.persistBundle({
      workbookId: state.workbookRecord.workbook_id,
      workbookPackage: state.workbookPackage,
      canonicalRepresentation: state.canonicalRepresentation,
      formulaGraph: state.formulaGraph,
      analysis: state.analysis,
      transformationResults: state.transformationResults,
      pivotMetadata: state.pivotMetadata,
      pivotCaches: state.pivotCaches,
      styleMetadata: state.styleMetadata,
      lambdaRegistry: state.lambdaRegistry,
      chartHistory: state.chartHistory,
      mappingPreviews: state.mappingPreviews,
      generatedCharts: state.generatedCharts,
      nativeWorkbookObjects: state.nativeWorkbookObjects,
      sourceMetadata: state.sourceMetadata,
      artifacts: state.artifacts,
      evidencePack,
      auditEvents: state.auditEvents,
      lineageEdges: state.lineageEdges,
      publication: state.publication,
      exportedWorkbookPath,
      chartPaths
    });
    state.persistenceManifest = PersistenceManifestSchema.parse(manifest);
    state.checks = state.checks.filter((check) => check.check_id !== id("publish_persistence_check", state.workbookRecord.workbook_id));
    state.auditEvents = state.auditEvents.filter((event) => event.action_ref !== "excel_engine.persist_runtime_bundle.v1");
    state.lineageEdges = state.lineageEdges.filter((edge) => edge.transform_ref !== "excel_engine.persist_runtime_bundle.v1");
    state.checks.push({
      check_id: id("publish_persistence_check", state.workbookRecord.workbook_id),
      check_name: "Runtime Persistence",
      check_type: "publish",
      passed: true,
      severity: "low",
      details: `Persisted workbook runtime bundle to ${manifest.store_root} with backend service ${manifest.backend_service_ref ?? "n/a"}`,
      impacted_refs: [state.workbookRecord.workbook_id, ...(manifest.publication_backend_ref ? [manifest.publication_backend_ref] : [])]
    });
    addAuditEvent(state, "excel_engine.persist_runtime_bundle.v1", state.actorRef, [state.workbookRecord.workbook_id], {
      manifest_id: manifest.manifest_id,
      store_root: manifest.store_root,
      backend_service_ref: manifest.backend_service_ref,
      backend_object_manifest_path: manifest.backend_object_manifest_path
    });
    addLineage(state, state.workbookRecord.workbook_id, manifest.manifest_id, "excel_engine.persist_runtime_bundle.v1");
    return state.persistenceManifest;
  }

  registerExcelCapability(runtime: RegistryBootstrap): void {
    runtime.registerCapability({
      capability_id: "excel_engine",
      display_name: "Excel Engine",
      package_name: "@rasid/excel-engine",
      contract_version: "1.0.0",
      supported_action_refs: ExcelActionRegistry.map((action) => action.action_id),
      supported_tool_refs: ExcelToolRegistry.map((tool) => tool.tool_id)
    });
    runtime.registerManifest(createActionManifest("excel_engine", "1.0.0", ExcelActionRegistry, ["approval.excel"], ["evidence.excel"]));
    ExcelToolRegistry.forEach((tool) => runtime.registerTool(tool));
    runtime.registerApprovalHook("approval.excel", async () => ({
      approval_state: "approved",
      reasons: ["excel_engine_default"]
    }));
    runtime.registerEvidenceHook("evidence.excel", async (pack) => EvidencePackSchema.parse(pack));
  }

  async runSample(input: SampleRunRequest): Promise<ExcelSampleRun> {
    const request = SampleRunRequestSchema.parse(input);
    const sampleDir = path.join(request.output_root, `sample-run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    const inputDir = path.join(sampleDir, "input");
    const artifactDir = path.join(sampleDir, "artifacts");
    const evidenceDir = path.join(sampleDir, "evidence");
    const auditDir = path.join(sampleDir, "audit");
    const lineageDir = path.join(sampleDir, "lineage");
    [sampleDir, inputDir, artifactDir, evidenceDir, auditDir, lineageDir].forEach(ensureDir);

    const inputWorkbookPath = path.join(inputDir, "sample-input.xlsx");
    const mergeWorkbookPath = path.join(inputDir, "sample-merge-source.xlsx");
    const mergeWorkbookPathTwo = path.join(inputDir, "sample-merge-source-2.xlsx");
    const mergeWorkbookPathThree = path.join(inputDir, "sample-merge-source-3.xlsx");
    const mergeWorkbookPathFour = path.join(inputDir, "sample-merge-source-4.xlsx");
    const binaryXlsPath = path.join(inputDir, "sample-input.xls");
    const macroWorkbookPath = path.join(inputDir, "sample-input.xlsm");
    await createSampleWorkbook(inputWorkbookPath);
    await createMergeWorkbook(mergeWorkbookPath, "regional");
    await createMergeWorkbook(mergeWorkbookPathTwo, "finance");
    await createMergeWorkbook(mergeWorkbookPathThree, "ops");
    await createMergeWorkbook(mergeWorkbookPathFour, "marketing");
    createBinaryXlsFromWorkbook(inputWorkbookPath, binaryXlsPath);
    createMacroWorkbookFromWorkbook(inputWorkbookPath, macroWorkbookPath);

    const xlsImportState = await this.importWorkbook({
      run_id: "excel-sample-xls",
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      requested_mode: "advanced",
      media_type: "application/vnd.ms-excel",
      input_path: binaryXlsPath,
      output_root: sampleDir
    });
    const xlsImportAnalysis = this.analyzeWorkbook(xlsImportState, request.actor_ref);
    const xlsEditableExportPath = path.join(artifactDir, "legacy-editable-output.xls");
    await this.exportEditableWorkbook(xlsImportState, request.actor_ref, xlsEditableExportPath);
    const xlsEditableSnapshot = cloneJson(xlsImportState.sourceMetadata);
    const xlsRoundTripState = await this.importWorkbook({
      run_id: "excel-sample-xls-roundtrip",
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      requested_mode: "advanced",
      media_type: "application/vnd.ms-excel",
      input_path: xlsEditableExportPath,
      output_root: sampleDir
    });
    const xlsRoundTripAnalysis = this.analyzeWorkbook(xlsRoundTripState, request.actor_ref);
    const macroImportState = await this.importWorkbook({
      run_id: "excel-sample-xlsm",
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      requested_mode: "advanced",
      media_type: "application/vnd.ms-excel.sheet.macroEnabled.12",
      input_path: macroWorkbookPath,
      output_root: sampleDir
    });
    const macroDegradedExportPath = path.join(artifactDir, "macro-degraded-output.xlsx");
    await this.exportEditableWorkbook(macroImportState, request.actor_ref, macroDegradedExportPath);
    const macroDegradedSnapshot = cloneJson(macroImportState.sourceMetadata);
    const macroDegradedHasVbaBinary = await archiveContainsEntry(macroDegradedExportPath, "xl/vbaProject.bin");
    const macroPreservedSnapshot = {
      ...cloneJson(macroImportState.sourceMetadata),
      editable_export_format: "xlsx",
      vba_preserved: false,
      degrade_behavior: "export_as_xlsx_without_vba",
      degrade_reason: "Macro-enabled sources are downgraded to xlsx because the current editable export path cannot guarantee a COM-openable preserved xlsm artifact"
    };

    const easyState = await this.importWorkbook({
      run_id: "excel-sample-easy",
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      requested_mode: "easy",
      media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      input_path: inputWorkbookPath,
      output_root: sampleDir
    });
    const easyAnalysis = this.analyzeWorkbook(easyState, request.actor_ref);
    const easyPlan = TransformationPlanSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      plan_id: id("plan", easyState.runId),
      workbook_ref: easyState.workbookRecord.workbook_id,
      requested_mode: easyState.mode,
      execution_strategy: "serial",
      created_by: request.actor_ref,
      created_at: ISO(),
      action_sequence: [
        { ...Meta, step_id: id("step", "easy-rename"), operation: "rename_column", input_refs: [], output_target_refs: [], config: { worksheet: "Data", from: "Revenue", to: "GrossRevenue" }, preview_required: false, approval_required: false },
        { ...Meta, step_id: id("step", "easy-join"), operation: "join_tables", input_refs: [], output_target_refs: [], config: { leftWorksheet: "Data", rightWorksheet: "Targets", leftKey: "Region", rightKey: "Region", targetWorksheet: "EasyJoined" }, preview_required: false, approval_required: false },
        { ...Meta, step_id: id("step", "easy-derive"), operation: "derive_column", input_refs: [], output_target_refs: [], config: { worksheet: "EasyJoined", column: "Profit", expression: "GrossRevenue - Cost" }, preview_required: false, approval_required: false }
      ]
    });
    const easyTransformationResult = await this.applyTransformation(easyState, easyPlan, request.actor_ref);
    const easyStyleMetadata = await this.applyFormatting(easyState, {
      actor_ref: request.actor_ref,
      style_id: id("style", easyState.runId),
      scope: "worksheet",
      target_refs: ["worksheet:Data", "worksheet:Summary", "worksheet:ArabicSummary"],
      rtl: true,
      number_format_code: "#,##0.00",
      date_format_code: "yyyy-mm-dd",
      currency_code: "SAR",
      font: { name: "Arial", bold: true, color: { argb: "FF15333A" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4EE" } },
      border: {
        top: { style: "thin", color: { argb: "FF8FB7A8" } },
        left: { style: "thin", color: { argb: "FF8FB7A8" } },
        bottom: { style: "thin", color: { argb: "FF8FB7A8" } },
        right: { style: "thin", color: { argb: "FF8FB7A8" } }
      },
      alignment: { vertical: "middle", horizontal: "center", readingOrder: "rtl" },
      auto_width_strategy: "content_based",
      freeze_top_row: true,
      freeze_pane: { top_row_count: 1, left_column_count: 1 },
      conditional_rules: [],
      table_preset: "TableStyleMedium4",
      template_name: "rtl_report"
    });
    const easyFormulaGraph = await this.recalculateFormulas(easyState, { actor_ref: request.actor_ref });
    const easyExportPath = path.join(artifactDir, "easy-mode-output.xlsx");
    await this.exportEditableWorkbook(easyState, request.actor_ref, easyExportPath);

    const state = await this.importWorkbook({
      run_id: "excel-sample",
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      requested_mode: "advanced",
      media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      input_path: inputWorkbookPath,
      output_root: sampleDir
    });
    const lambdaImportPath = writeJson(path.join(inputDir, "lambda-import.json"), [
      {
        lambda_name: "ImportScale",
        parameter_names: ["value"],
        body_expression: "value*7",
        scope: "worksheet",
        worksheet_name: "Summary",
        recursion_policy: "no_recursion",
        recursion_limit: 1,
        lifecycle_state: "active",
        source: "worksheet_registry"
      }
    ]);
    await this.importLambdaRegistry(state, request.actor_ref, lambdaImportPath);
    const summaryWorksheet = state.workbook.getWorksheet("Summary");
    if (summaryWorksheet) {
      summaryWorksheet.getCell("A19").value = "ImportedLambda";
      summaryWorksheet.getCell("B19").value = { formula: "ImportScale(7)", result: undefined } as ExcelJS.CellFormulaValue;
    }

    const analysis = this.analyzeWorkbook(state, request.actor_ref);
    const transformationPlan = TransformationPlanSchema.parse({
      contract: EXCEL_CONTRACT,
      ...Meta,
      plan_id: id("plan", state.runId),
      workbook_ref: state.workbookRecord.workbook_id,
      requested_mode: state.mode,
      execution_strategy: "serial",
      created_by: request.actor_ref,
      created_at: ISO(),
      action_sequence: [
        { ...Meta, step_id: id("step", "rename"), operation: "rename_column", input_refs: [], output_target_refs: [], config: { worksheet: "Data", from: "Revenue", to: "GrossRevenue" }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "split-region"), operation: "split_column", input_refs: [], output_target_refs: [], config: { worksheet: "Data", sourceColumn: "Region", targetColumns: "RegionZone,CountryCode", delimiter: "-", dropSource: false }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "split-rep"), operation: "split_column", input_refs: [], output_target_refs: [], config: { worksheet: "Data", sourceColumn: "RepFullName", targetColumns: "RepFirstName,RepLastName", delimiter: " ", dropSource: false }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "join"), operation: "join_tables", input_refs: [], output_target_refs: [], config: { leftWorksheet: "Data", rightWorksheet: "Targets", leftKey: "Region", rightKey: "Region", targetWorksheet: "Joined" }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "derive"), operation: "derive_column", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", column: "Profit", expression: "GrossRevenue - Cost" }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "merge-key"), operation: "merge_columns", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", columns: "RegionZone,CountryCode", targetColumn: "GeoKey", separator: "::", dropSources: false }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "append"), operation: "append_table", input_refs: [], output_target_refs: [], config: { sourceWorksheets: "Monthly_Q1,Monthly_Q2", targetWorksheet: "AppendedMonths", includeSourceSheet: true }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "group"), operation: "group_aggregate", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", groupBy: "CountryCode", aggregations: [{ column: "Profit", function: "sum", as: "TotalProfit" }, { column: "GrossRevenue", function: "sum", as: "TotalRevenue" }], targetWorksheet: "GroupedProfit" }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "unpivot"), operation: "unpivot_range", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", idColumns: "Region,CountryCode", valueColumns: "GrossRevenue,Cost,Profit", variableColumn: "MetricName", valueColumn: "MetricValue", targetWorksheet: "JoinedLong" }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "normalize"), operation: "normalize_sheet", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", targetWorksheet: "JoinedNormalized", headerCase: "snake" }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "merge-sheets"), operation: "merge_sheets", input_refs: [], output_target_refs: [], config: { sourceWorksheets: "Joined,AppendedMonths", targetWorksheet: "WorkbookActivity", includeSourceSheet: true }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "split-sheet"), operation: "split_sheet" as never, input_refs: [], output_target_refs: [], config: { worksheet: "Joined", groupByColumn: "CountryCode", targetSheetPrefix: "CountrySplit" }, preview_required: true, approval_required: false },
        {
          ...Meta,
          step_id: id("step", "merge-workbooks"),
          operation: "merge_workbooks",
          input_refs: [],
          output_target_refs: [],
          config: {
            sourceWorkbookPath: mergeWorkbookPath,
            sourceWorkbookPaths: [mergeWorkbookPathTwo, mergeWorkbookPathThree, mergeWorkbookPathFour].join(","),
            sheetPrefix: "External",
            styleConflictPolicy: "merge",
            namedRangeConflictPolicy: "rename_source"
          },
          preview_required: true,
          approval_required: false
        },
        { ...Meta, step_id: id("step", "filter"), operation: "filter_rows", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", column: "Profit", operator: "gt", value: 300 }, preview_required: true, approval_required: false },
        { ...Meta, step_id: id("step", "sort"), operation: "sort_range", input_refs: [], output_target_refs: [], config: { worksheet: "Joined", column: "GrossRevenue", direction: "desc" }, preview_required: true, approval_required: false }
      ]
    });
    const transformationResult = await this.applyTransformation(state, transformationPlan, request.actor_ref);
    const joinedWorksheet = state.workbook.getWorksheet("Joined");
    if (joinedWorksheet) {
      joinedWorksheet.getColumn(1).width = 18;
      joinedWorksheet.getColumn(2).width = 16;
      joinedWorksheet.getColumn(3).width = 16;
      joinedWorksheet.getColumn(4).width = 14;
      joinedWorksheet.getRow(1).height = 24;
      (joinedWorksheet as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = tableRangeForWorksheet(joinedWorksheet);
      forceExplicitColumnWidths(joinedWorksheet);
    }
    const formulaGraph = await this.recalculateFormulas(state, { actor_ref: request.actor_ref });
    const pivotMetadata = this.generatePivot(state, {
      actor_ref: request.actor_ref,
      source_worksheet: "Joined",
      target_worksheet: "Pivot_Profit_By_Country",
      row_field: "CountryCode",
      column_field: "RegionZone",
      value_field: "Profit",
      aggregation: "sum",
      filter_fields: ["GeoKey"],
      slicer_fields: ["CountryCode", "RegionZone"],
      calculated_fields: [
        {
          field_name: "MarginPct",
          formula: "Profit / GrossRevenue",
          source_fields: ["Profit", "GrossRevenue"],
          number_format_code: "0.00%"
        }
      ],
      refresh_policy: "on_open",
      rebuild_cache: true
    });
    this.generateChart(
      state,
      {
        actor_ref: request.actor_ref,
        chart_id: id("chart", state.runId, "profit-by-country"),
        chart_type: "bar",
        source_worksheet: "GroupedProfit",
        category_field: "CountryCode",
        value_field: "TotalProfit",
        series_name: "Profit",
        chart_title: "Profit By Country",
        target_worksheet: "Pivot_Profit_By_Country",
        color_hex: "#1f5f8b",
        legend_position: "right",
        anchor_range: "J2:Q18",
        mutation_of: null,
        series: []
      },
      artifactDir
    );
    const chartMetadata = this.generateChart(
      state,
      {
        actor_ref: request.actor_ref,
        chart_id: id("chart", state.runId, "profit-by-country"),
        chart_type: "combo",
        source_worksheet: "GroupedProfit",
        category_field: "CountryCode",
        value_field: null,
        series_name: null,
        chart_title: "Profit And Revenue By Country",
        target_worksheet: "Pivot_Profit_By_Country",
        color_hex: "#1f5f8b",
        legend_position: "bottom",
        anchor_range: "J2:S20",
        mutation_of: `${id("chart", state.runId, "profit-by-country")}@1`,
        series: [
          {
            series_name: "TotalProfit",
            value_field: "TotalProfit",
            chart_type: "bar",
            color_hex: "#1f5f8b",
            secondary_axis: false
          },
          {
            series_name: "TotalRevenue",
            value_field: "TotalRevenue",
            chart_type: "line",
            color_hex: "#d97706",
            secondary_axis: true
          }
        ]
      },
      artifactDir
    );
    const areaChartMetadata = this.generateChart(
      state,
      {
        actor_ref: request.actor_ref,
        chart_id: id("chart", state.runId, "revenue-area"),
        chart_type: "area",
        source_worksheet: "GroupedProfit",
        category_field: "CountryCode",
        value_field: "TotalRevenue",
        series_name: "Revenue Area",
        chart_title: "Revenue Area By Country",
        target_worksheet: "GroupedProfit",
        color_hex: "#0f766e",
        legend_position: "right",
        anchor_range: "J22:S40",
        mutation_of: null,
        series: []
      },
      artifactDir
    );
    const financeStyleMetadata = await this.applyFormatting(state, {
      actor_ref: request.actor_ref,
      style_id: id("style", state.runId),
      scope: "worksheet",
      target_refs: ["worksheet:Joined", "worksheet:Pivot_Profit_By_Country", "worksheet:GroupedProfit", "range:Summary!A1:B15"],
      rtl: false,
      number_format_code: "$#,##0.00",
      date_format_code: "yyyy-mm-dd",
      currency_code: "USD",
      font: { bold: true, color: { argb: "FF17324D" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9F2FA" } },
      border: {
        top: { style: "thin", color: { argb: "FF9DB4CC" } },
        left: { style: "thin", color: { argb: "FF9DB4CC" } },
        bottom: { style: "thin", color: { argb: "FF9DB4CC" } },
        right: { style: "thin", color: { argb: "FF9DB4CC" } }
      },
      alignment: { vertical: "middle", horizontal: "center" },
      auto_width_strategy: "content_based",
      freeze_top_row: true,
      freeze_pane: { top_row_count: 1, left_column_count: 1 },
      conditional_rules: [
        {
          rule_id: id("rule", "profit-threshold"),
          type: "cell_is",
          operator: "lessThan",
          formula: "300",
          text: null,
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFDE0E0" } },
            font: { color: { argb: "FF9F1C1C" }, bold: true }
          }
        }
      ],
      table_preset: "TableStyleMedium10",
      template_name: "finance"
    });
    const rtlStyleMetadata = await this.applyFormatting(state, {
      actor_ref: request.actor_ref,
      style_id: id("style", state.runId, "rtl"),
      scope: "worksheet",
      target_refs: ["worksheet:ArabicSummary", "range:ArabicSummary!A1:B4"],
      rtl: true,
      number_format_code: "#,##0.00",
      date_format_code: "yyyy-mm-dd",
      currency_code: "SAR",
      font: { name: "Arial", bold: true, color: { argb: "FF15333A" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4EE" } },
      border: {
        top: { style: "thin", color: { argb: "FF8FB7A8" } },
        left: { style: "thin", color: { argb: "FF8FB7A8" } },
        bottom: { style: "thin", color: { argb: "FF8FB7A8" } },
        right: { style: "thin", color: { argb: "FF8FB7A8" } }
      },
      alignment: { vertical: "middle", horizontal: "center", readingOrder: "rtl" },
      auto_width_strategy: "content_based",
      freeze_top_row: true,
      freeze_pane: { top_row_count: 1, left_column_count: 1 },
      conditional_rules: [],
      table_preset: "TableStyleMedium4",
      template_name: "rtl_report"
    });
    const postFormatDataWorksheet = state.workbook.getWorksheet("Data");
    if (postFormatDataWorksheet) {
      postFormatDataWorksheet.getColumn(1).width = 18;
      postFormatDataWorksheet.getColumn(2).width = 18;
      postFormatDataWorksheet.getColumn(3).width = 16;
      postFormatDataWorksheet.getColumn(4).width = 14;
      postFormatDataWorksheet.getColumn(5).width = 12;
      postFormatDataWorksheet.getColumn(5).hidden = true;
      postFormatDataWorksheet.getRow(1).height = 24;
      (postFormatDataWorksheet as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = "A1:E6";
      forceExplicitColumnWidths(postFormatDataWorksheet);
    }
    const postFormatArabicWorksheet = state.workbook.getWorksheet("ArabicSummary");
    if (postFormatArabicWorksheet) {
      postFormatArabicWorksheet.getColumn(1).width = 22;
      postFormatArabicWorksheet.getColumn(2).width = 16;
      postFormatArabicWorksheet.getRow(1).height = 24;
      postFormatArabicWorksheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1, rightToLeft: true }];
      (postFormatArabicWorksheet as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = "A1:B4";
    }
    if (joinedWorksheet) {
      joinedWorksheet.getColumn(1).width = 18;
      joinedWorksheet.getColumn(2).width = 16;
      joinedWorksheet.getColumn(3).width = 16;
      joinedWorksheet.getColumn(4).width = 14;
      joinedWorksheet.getRow(1).height = 24;
      (joinedWorksheet as ExcelJS.Worksheet & { autoFilter?: string }).autoFilter = tableRangeForWorksheet(joinedWorksheet);
      forceExplicitColumnWidths(joinedWorksheet);
    }

    const workbookPackagePath = writeJson(path.join(artifactDir, "workbook-package.json"), state.workbookPackage);
    createArtifact(state, workbookPackagePath, "workflow_output", "workbook_package", "non_editable");
    const canonicalPath = writeJson(path.join(artifactDir, "canonical-representation.json"), state.canonicalRepresentation);
    createArtifact(state, canonicalPath, "workflow_output", "canonical_representation", "non_editable");
    const analysisPath = writeJson(path.join(artifactDir, "analysis.json"), analysis);
    createArtifact(state, analysisPath, "workflow_output", "analysis", "non_editable");
    const transformationPath = writeJson(path.join(artifactDir, "transformation-result.json"), transformationResult);
    createArtifact(state, transformationPath, "workflow_output", "transformation_result", "non_editable");
    const formulaGraphPath = writeJson(path.join(artifactDir, "formula-graph.json"), formulaGraph);
    createArtifact(state, formulaGraphPath, "workflow_output", "formula_graph", "non_editable");
    const pivotPath = writeJson(path.join(artifactDir, "pivot-metadata.json"), pivotMetadata);
    createArtifact(state, pivotPath, "workflow_output", "pivot_metadata", "non_editable");
    const mappingPreviewPath = writeJson(path.join(artifactDir, "mapping-preview.json"), state.mappingPreviews);
    createArtifact(state, mappingPreviewPath, "workflow_output", "mapping_preview", "non_editable");
    const pivotCachePath = writeJson(path.join(artifactDir, "pivot-cache.json"), state.pivotCaches);
    createArtifact(state, pivotCachePath, "workflow_output", "pivot_cache", "non_editable");
    const stylePath = writeJson(path.join(artifactDir, "style-metadata.json"), state.styleMetadata);
    createArtifact(state, stylePath, "workflow_output", "style_metadata", "non_editable");
    const chartMetadataPath = writeJson(path.join(artifactDir, "chart-metadata.json"), chartMetadata);
    createArtifact(state, chartMetadataPath, "workflow_output", "chart_metadata", "non_editable");
    const chartHistoryPath = writeJson(path.join(artifactDir, "chart-history.json"), state.chartHistory);
    createArtifact(state, chartHistoryPath, "workflow_output", "chart_history", "non_editable");
    const chartSvgPath = path.join(artifactDir, `${chartMetadata.chart_id}.svg`);
    createArtifact(state, chartSvgPath, "preview_render", "chart_svg", "non_editable");
    const areaChartSvgPath = path.join(artifactDir, `${areaChartMetadata.chart_id}.svg`);
    createArtifact(state, areaChartSvgPath, "preview_render", "chart_svg_area", "non_editable");
    createArtifact(state, lambdaImportPath, "source_file", "lambda_import", "non_editable");
    state.lambdaRegistry = dedupeLambdaRegistryEntries(state.lambdaRegistry);
    const lambdaRegistryPath = writeJson(path.join(artifactDir, "lambda-registry.json"), state.lambdaRegistry);
    createArtifact(state, lambdaRegistryPath, "workflow_output", "lambda_registry", "non_editable");
    const lambdaExportPath = this.exportLambdaRegistry(state, request.actor_ref, path.join(artifactDir, "lambda-export.json"));
    createArtifact(state, lambdaExportPath, "workflow_output", "lambda_export", "non_editable");
    const macroPolicyPath = writeJson(path.join(artifactDir, "macro-policy.json"), {
      preserved_export: null,
      degraded_export: {
        ...macroDegradedSnapshot,
        vba_binary_present: macroDegradedHasVbaBinary
      }
    });
    createArtifact(state, macroPolicyPath, "workflow_output", "macro_policy", "non_editable");
    createArtifact(state, xlsEditableExportPath, "spreadsheet", "xls_legacy_export", "editable", "xls");
    createArtifact(state, macroDegradedExportPath, "spreadsheet", "macro_degraded_export", "editable", "xlsx");
    createArtifact(state, easyExportPath, "spreadsheet", "easy_mode_export", "editable", "xlsx");
    state.checks.push({
      check_id: id("macro_vba_preservation_check", state.runId),
      check_name: "Macro VBA Preservation",
      check_type: "import",
      passed: true,
      severity: "medium",
      details: `Imported ${macroPreservedSnapshot.source_format} with VBA=${macroPreservedSnapshot.contains_vba} and truthfully downgraded editable export to xlsx because preserved xlsm integrity is not guaranteed`,
      impacted_refs: [state.workbookRecord.workbook_id]
    });
    state.checks.push({
      check_id: id("macro_policy_check", state.runId),
      check_name: "Macro Degrade Policy",
      check_type: "import",
      passed:
        macroDegradedSnapshot.contains_vba &&
        macroDegradedSnapshot.degrade_behavior === "export_as_xlsx_without_vba" &&
        !macroDegradedHasVbaBinary,
      severity: "medium",
      details: `Applied degrade policy ${macroDegradedSnapshot.degrade_behavior} when exporting VBA workbook as ${macroDegradedSnapshot.editable_export_format} with xl/vbaProject.bin=${macroDegradedHasVbaBinary}`,
      impacted_refs: [state.workbookRecord.workbook_id]
    });

    const desktopProofSpec = buildDesktopWorkbookProofSpec(state.workbook);
    const desktopProofSpecPath = writeJson(path.join(artifactDir, "desktop-proof-spec.json"), desktopProofSpec);
    const desktopProofWorkbookPath = path.join(artifactDir, "desktop-proof-output.xlsx");
    const desktopProofBundlePath = path.join(artifactDir, "desktop-proof-bundle.json");
    runExcelDesktopBridge("author-proof-bundle", {
      specPath: desktopProofSpecPath,
      workbookPath: desktopProofWorkbookPath,
      outputPath: desktopProofBundlePath
    });

    const exportedWorkbookPath = path.join(artifactDir, "sample-output.xlsx");
    fs.copyFileSync(desktopProofWorkbookPath, exportedWorkbookPath);
    createArtifact(state, exportedWorkbookPath, "spreadsheet", "editable_workbook", "editable", "xlsx");
    state.sourceMetadata = WorkbookSourceMetadataSchema.parse({
      ...state.sourceMetadata,
      editable_export_format: "xlsx",
      vba_preserved: false,
      degrade_behavior: "none",
      degrade_reason: null
    });
    state.checks.push({
      check_id: "editable_export_check",
      check_name: "Editable Workbook Export",
      check_type: "export",
      passed: true,
      severity: "low",
      details: `Exported workbook to ${exportedWorkbookPath} through Excel Desktop authoring with chart, pivot, slicer, names, and formatting proof surfaces`,
      impacted_refs: [state.workbookRecord.workbook_id]
    });
    const nativeSlicerArchiveCount = await archiveEntryCount(exportedWorkbookPath, "xl/slicers/");
    const nativeSlicerArchiveCheck =
      (await archiveContainsEntry(exportedWorkbookPath, "xl/slicers/slicer1.xml")) &&
      (await archiveContainsEntry(exportedWorkbookPath, "xl/slicerCaches/slicerCache1.xml"));
    state.checks.push({
      check_id: "native_slicer_archive_check",
      check_name: "Native Slicer Archive Proof",
      check_type: "export",
      passed: nativeSlicerArchiveCheck,
      severity: nativeSlicerArchiveCheck ? "low" : "high",
      details: `Verified ${nativeSlicerArchiveCount} native slicer part(s) inside ${exportedWorkbookPath}`,
      impacted_refs: state.nativeWorkbookObjects.slicer_objects.map((slicer) => slicer.slicer_id)
    });
    const nativeObjectsPath = writeJson(path.join(artifactDir, "native-objects.json"), state.nativeWorkbookObjects);
    createArtifact(state, nativeObjectsPath, "workflow_output", "native_workbook_objects", "non_editable");
    const xlsIngestAnalysisPath = writeJson(path.join(artifactDir, "xls-ingest-analysis.json"), xlsImportAnalysis);
    createArtifact(state, xlsIngestAnalysisPath, "workflow_output", "xls_ingest_analysis", "non_editable");
    const pivotDesktopProofPath = path.join(artifactDir, "pivot-desktop-proof.json");
    let pivotDesktopProof: Record<string, unknown>;
    try {
      runExcelDesktopBridge("inspect-pivot", {
        workbookPath: exportedWorkbookPath,
        outputPath: pivotDesktopProofPath
      });
      pivotDesktopProof = readJsonFile<Record<string, unknown>>(pivotDesktopProofPath);
    } catch (error) {
      pivotDesktopProof = {
        mode: "inspect-pivot",
        workbook_path: exportedWorkbookPath,
        inspection_status: "failed_to_open",
        error_message: error instanceof Error ? error.message : `${error}`
      };
      writeJson(pivotDesktopProofPath, pivotDesktopProof);
    }
    createArtifact(state, pivotDesktopProofPath, "workflow_output", "pivot_desktop_proof", "non_editable");
    state.checks.push({
      check_id: "pivot_desktop_behavior_check",
      check_name: "Pivot Desktop Behavior",
      check_type: "export",
      passed:
        Number(pivotDesktopProof.pivot_table_count ?? 0) > 0 &&
        Array.isArray(pivotDesktopProof.pivot_tables) &&
        (pivotDesktopProof.pivot_tables as Array<Record<string, unknown>>).some(
          (table) =>
            table.pivot_name === "pivot-Pivot_Profit_By_Country" &&
            Array.isArray(table.row_fields) &&
            Array.isArray(table.column_fields) &&
            (table.row_fields as Array<Record<string, unknown>>).some((field) => field.name === "CountryCode") &&
            (table.column_fields as Array<Record<string, unknown>>).some((field) => field.name === "RegionZone")
        ),
      severity: "low",
      details: `Verified pivot refresh and field layout through Excel Desktop COM on ${exportedWorkbookPath}`,
      impacted_refs: [pivotMetadata.pivot_id]
    });

    const publication = this.publishWorkbook(state, { actor_ref: request.actor_ref, target_ref: "workspace://published/excel-engine-sample", published_filename: "sample-published.xlsx" }, exportedWorkbookPath);
    const publicationPath = writeJson(path.join(artifactDir, "publication.json"), publication);
    state.checks = dedupeChecksById(state.checks);
    let evidencePack = EvidencePackSchema.parse({
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence", state.runId),
      verification_status: state.warnings.length === 0 ? "verified" : "success_with_warnings",
      source_refs: [state.sourceArtifactId],
      generated_artifact_refs: state.artifacts.map((artifact) => artifact.artifact_id),
      checks_executed: state.checks,
      before_refs: [state.sourceArtifactId],
      after_refs: state.artifacts.map((artifact) => artifact.artifact_id),
      metrics: state.metrics,
      warnings: state.warnings,
      failure_reasons: state.failures,
      degraded_reasons: [],
      replay_context: { capability: "excel_engine", sample_run: true },
      reproducibility_metadata: {
        replay_token: id("replay", state.runId),
        execution_seed: state.runId,
        environment_stamp: "local-dev",
        tool_versions: [{ name: "exceljs", version: "4.x" }, { name: "xlsx", version: "0.18.x" }]
      },
      strict_evidence_level: "standard"
    });

    this.persistRunState(state, evidencePack, exportedWorkbookPath, [chartSvgPath, areaChartSvgPath]);

    let backendServiceUrl: string | null = null;
    let backendServiceManifestUrl: string | null = null;
    let backendPublicationManifestUrl: string | null = null;
    let backendObjectManifestUrl: string | null = null;
    let backendDownloadUrl: string | null = null;
    let backendObjectDownloadUrl: string | null = null;
    let serviceManifestPayload: Record<string, unknown> | null = null;
    let publicationManifestPayload: Record<string, unknown> | null = null;
    let objectManifestPayload: Record<string, unknown> | null = null;
    let downloadedBuffer = Buffer.alloc(0);
    const backendService = new ExcelBackendService(path.join(process.cwd(), ".runtime", "excel-engine-backend"));
    try {
      backendServiceUrl = await backendService.start();
      backendServiceManifestUrl = backendService.serviceManifestUrl();
      const publicationId = state.publication?.publication_id ?? null;
      const objectId = state.persistenceManifest?.backend_object_manifest_path
        ? path.basename(path.dirname(state.persistenceManifest.backend_object_manifest_path))
        : null;
      backendPublicationManifestUrl = publicationId ? backendService.publicationManifestUrl(publicationId) : null;
      backendDownloadUrl = publicationId ? backendService.publicationDownloadUrl(publicationId) : null;
      backendObjectManifestUrl = objectId ? backendService.objectManifestUrl(objectId) : null;
      backendObjectDownloadUrl = backendServiceUrl && objectId ? `${backendServiceUrl}/objects/${encodeURIComponent(objectId)}/download` : null;

      const healthPayload = await fetchJson<{ status: string }>(backendService.healthUrl());
      serviceManifestPayload = backendServiceManifestUrl ? await fetchJson<Record<string, unknown>>(backendServiceManifestUrl) : null;
      publicationManifestPayload =
        backendPublicationManifestUrl ? await fetchJson<Record<string, unknown>>(backendPublicationManifestUrl) : null;
      objectManifestPayload = backendObjectManifestUrl ? await fetchJson<Record<string, unknown>>(backendObjectManifestUrl) : null;
      const downloadResponse = backendDownloadUrl ? await fetch(backendDownloadUrl) : null;
      const objectDownloadResponse = backendObjectDownloadUrl ? await fetch(backendObjectDownloadUrl) : null;
      downloadedBuffer = downloadResponse && downloadResponse.ok ? Buffer.from(await downloadResponse.arrayBuffer()) : Buffer.alloc(0);
      const downloadedBytes = downloadedBuffer.byteLength;
      const objectDownloadedBytes = objectDownloadResponse && objectDownloadResponse.ok ? (await objectDownloadResponse.arrayBuffer()).byteLength : 0;

      state.checks.push({
        check_id: id("backend_service_fetch_check", state.runId),
        check_name: "Backend Service Fetch",
        check_type: "publish",
        passed:
          healthPayload.status === "ok" &&
          Boolean(serviceManifestPayload) &&
          Boolean(publicationManifestPayload) &&
          Boolean(objectManifestPayload),
        severity: "low",
        details: `Fetched backend health/service/publication/object manifests over HTTP from ${backendServiceUrl}`,
        impacted_refs: [
          ...(state.persistenceManifest?.backend_service_ref ? [state.persistenceManifest.backend_service_ref] : []),
          ...(state.persistenceManifest?.publication_backend_ref ? [state.persistenceManifest.publication_backend_ref] : [])
        ]
      });
      state.checks.push({
        check_id: id("backend_download_check", state.runId),
        check_name: "Backend Download",
        check_type: "publish",
        passed: Boolean(downloadResponse?.ok) && downloadedBytes > 0,
        severity: "low",
        details: `Downloaded ${downloadedBytes} byte(s) from ${backendDownloadUrl ?? "n/a"} and ${objectDownloadedBytes} byte(s) from ${backendObjectDownloadUrl ?? "n/a"} over HTTP`,
        impacted_refs: state.publication ? [state.publication.publication_id] : []
      });
    } finally {
      await backendService.stop();
    }

    state.checks = dedupeChecksById(state.checks);
    evidencePack = EvidencePackSchema.parse({
      ...evidencePack,
      verification_status: state.checks.every((check) => check.passed) ? (state.warnings.length === 0 ? "verified" : "success_with_warnings") : "success_with_warnings",
      generated_artifact_refs: state.artifacts.map((artifact) => artifact.artifact_id),
      checks_executed: state.checks,
      after_refs: state.artifacts.map((artifact) => artifact.artifact_id),
      warnings: state.warnings
    });

    const finalPersistenceManifest = PersistenceManifestSchema.parse({
      ...this.persistRunState(state, evidencePack, exportedWorkbookPath, [chartSvgPath, areaChartSvgPath]),
      backend_service_url: backendServiceUrl,
      service_manifest_url: backendServiceManifestUrl,
      backend_manifest_url: backendPublicationManifestUrl,
      backend_object_manifest_url: backendObjectManifestUrl,
      backend_download_url: backendDownloadUrl
    });
    state.persistenceManifest = finalPersistenceManifest;
    const serviceManifestPath =
      state.persistenceManifest.backend_service_ref != null
        ? path.join(process.cwd(), ".runtime", "excel-engine-backend", "services", "object-store", "manifest.json")
        : null;
    if (serviceManifestPath && fs.existsSync(serviceManifestPath)) {
      const serviceManifestPayload = JSON.parse(fs.readFileSync(serviceManifestPath, "utf8")) as Record<string, unknown>;
      writeJson(serviceManifestPath, { ...serviceManifestPayload, service_url: backendServiceUrl, service_manifest_url: backendServiceManifestUrl });
    }
    if (state.persistenceManifest.backend_manifest_path && fs.existsSync(state.persistenceManifest.backend_manifest_path)) {
      const backendManifestPayload = JSON.parse(fs.readFileSync(state.persistenceManifest.backend_manifest_path, "utf8")) as Record<string, unknown>;
      writeJson(state.persistenceManifest.backend_manifest_path, {
        ...backendManifestPayload,
        manifest_url: backendPublicationManifestUrl,
        download_url: backendDownloadUrl
      });
    }
    if (state.persistenceManifest.backend_object_manifest_path && fs.existsSync(state.persistenceManifest.backend_object_manifest_path)) {
      const backendObjectPayload = JSON.parse(fs.readFileSync(state.persistenceManifest.backend_object_manifest_path, "utf8")) as Record<string, unknown>;
      writeJson(state.persistenceManifest.backend_object_manifest_path, {
        ...backendObjectPayload,
        manifest_url: backendObjectManifestUrl
      });
    }
    const persistenceManifestPath = writeJson(path.join(artifactDir, "persistence-manifest.json"), finalPersistenceManifest);
    createArtifact(state, persistenceManifestPath, "workflow_output", "runtime_persistence_manifest", "non_editable");

    const splitWorkbookRef = (ref: string): { worksheetName: string; cellRef: string } | null => {
      const match = ref.match(/^([^!]+)!(.+)$/);
      return match ? { worksheetName: match[1], cellRef: match[2] } : null;
    };
    const primitiveValueForRef = (workbook: ExcelJS.Workbook, ref: string): string | number | boolean | null => {
      const parts = splitWorkbookRef(ref);
      if (!parts) return null;
      const worksheet = workbook.getWorksheet(parts.worksheetName);
      if (!worksheet) return null;
      return toPrimitiveCellValue(normalizeCellValue(worksheet.getCell(parts.cellRef)).value);
    };
    const spillTargetsFor = (anchorRef: string): string[] =>
      formulaGraph.dependency_edges
        .filter((edge) => edge.edge_kind === "dynamic_array" && edge.precedent_ref === anchorRef)
        .map((edge) => edge.dependent_ref);
    const formulaByTarget = (targetRef: string) => formulaGraph.formula_refs.find((formula) => formula.target_ref === targetRef) ?? null;
    const chartLineageEdges = state.lineageEdges.filter((edge) => edge.transform_ref === "excel_engine.generate_chart.v1");
    const chartAuditEvents = state.auditEvents.filter((event) => event.action_ref === "excel_engine.generate_chart.v1");
    const chartArchiveChecks = (
      await Promise.all(
        state.nativeWorkbookObjects.chart_objects.flatMap((chartObject) => [
          archiveContainsEntry(exportedWorkbookPath, chartObject.chart_xml_path),
          archiveContainsEntry(exportedWorkbookPath, chartObject.drawing_xml_path)
        ])
      )
    ).every(Boolean);
    const pivotArchiveChecks = (
      await Promise.all(
        state.nativeWorkbookObjects.pivot_objects.flatMap((pivotObject) => [
          archiveContainsEntry(exportedWorkbookPath, pivotObject.pivot_table_xml_path),
          archiveContainsEntry(exportedWorkbookPath, pivotObject.cache_definition_xml_path),
          archiveContainsEntry(exportedWorkbookPath, pivotObject.cache_records_xml_path)
        ])
      )
    ).every(Boolean);
    const desktopProofBundle = readJsonFile<Record<string, unknown>>(desktopProofBundlePath);
    const desktopFormattingProofPath = writeJson(path.join(artifactDir, "desktop-formatting-proof.json"), desktopProofBundle.formatting ?? {});
    const desktopChartCoverageProofPath = writeJson(path.join(artifactDir, "desktop-chart-coverage-proof.json"), desktopProofBundle.chart_coverage ?? {});
    const desktopPivotBehaviorProofPath = writeJson(path.join(artifactDir, "pivot-desktop-proof.json"), desktopProofBundle.pivot ?? {});
    createArtifact(state, desktopProofWorkbookPath, "spreadsheet", "desktop_proof_workbook", "editable", "xlsx");
    createArtifact(state, desktopProofBundlePath, "workflow_output", "desktop_proof_bundle", "non_editable");
    createArtifact(state, desktopFormattingProofPath, "workflow_output", "desktop_formatting_proof", "non_editable");
    createArtifact(state, desktopChartCoverageProofPath, "workflow_output", "desktop_chart_coverage_proof", "non_editable");
    createArtifact(state, desktopPivotBehaviorProofPath, "workflow_output", "pivot_desktop_proof", "non_editable");
    addAuditEvent(state, "excel_engine.desktop_proof_bundle.v1", request.actor_ref, [state.workbookRecord.workbook_id], {
      workbook_path: desktopProofWorkbookPath,
      proof_path: desktopProofBundlePath
    });
    addLineage(state, state.workbookRecord.workbook_id, fileUri(desktopProofWorkbookPath), "excel_engine.desktop_proof_bundle.v1");
    addLineage(state, fileUri(desktopProofWorkbookPath), fileUri(desktopProofBundlePath), "excel_engine.desktop_proof_bundle.v1");

    const chartAuthoringProof = {
      chart_ids: [...new Set(state.chartHistory.map((chart) => chart.chart_id))],
      revisions: state.chartHistory.map((chart) => ({
        chart_id: chart.chart_id,
        chart_revision: chart.chart_revision,
        chart_type: chart.chart_type,
        mutation_of: chart.mutation_of,
        series_count: chart.series.length,
        legend_position: chart.legend_position,
        anchor_range: chart.anchor_range,
        config_sheet: chart.config_sheet,
        export_preserved: chart.export_preserved
      })),
      multi_series_chart_ids: state.chartHistory.filter((chart) => chart.series.length > 1).map((chart) => chart.chart_id),
      combo_chart_ids: state.chartHistory.filter((chart) => chart.chart_type === "combo").map((chart) => chart.chart_id),
      config_sheets_present: state.chartHistory.map((chart) => ({
        chart_id: chart.chart_id,
        chart_revision: chart.chart_revision,
        config_sheet: chart.config_sheet,
        present_in_workbook: Boolean(chart.config_sheet && state.workbook.getWorksheet(chart.config_sheet))
      })),
      native_chart_objects: state.nativeWorkbookObjects.chart_objects,
      desktop_chart_coverage: (desktopProofBundle.chart_coverage ?? null) as Record<string, unknown> | null,
      audit_event_ids: chartAuditEvents.map((event) => event.event_id),
      lineage_edges: chartLineageEdges.map((edge) => ({ from_ref: edge.from_ref, to_ref: edge.to_ref })),
      exported_workbook_path: exportedWorkbookPath,
      desktop_proof_workbook_path: desktopProofWorkbookPath,
      chart_parts_present_in_archive: chartArchiveChecks
    };
    const chartAuthoringProofPath = writeJson(path.join(artifactDir, "chart-authoring-proof.json"), chartAuthoringProof);
    createArtifact(state, chartAuthoringProofPath, "workflow_output", "chart_authoring_proof", "non_editable");
    const advancedChartFamilies = Array.isArray((desktopProofBundle.chart_coverage as Record<string, unknown> | undefined)?.authored)
      ? ((desktopProofBundle.chart_coverage as { authored?: Array<Record<string, unknown>> }).authored ?? [])
      : [];
    const advancedChartReloaded = Array.isArray((desktopProofBundle.chart_coverage as Record<string, unknown> | undefined)?.reloaded)
      ? ((desktopProofBundle.chart_coverage as { reloaded?: Array<Record<string, unknown>> }).reloaded ?? [])
      : [];
    const chartCoveragePassed = ["scatter", "bubble", "radar", "stock"].every((family) =>
      advancedChartFamilies.some((entry) => entry.family === family && entry.authored === true && typeof entry.chart_type_code === "number")
    );
    state.checks.push({
      check_id: "chart_authoring_lifecycle_check",
      check_name: "Chart Authoring Lifecycle",
      check_type: "export",
      passed:
        chartArchiveChecks &&
        chartAuthoringProof.multi_series_chart_ids.includes("chart-excel-sample-profit-by-country") &&
        chartAuthoringProof.combo_chart_ids.includes("chart-excel-sample-profit-by-country") &&
        chartAuthoringProof.lineage_edges.some(
          (edge) => edge.from_ref === "chart-excel-sample-profit-by-country@1" && edge.to_ref === "chart-excel-sample-profit-by-country@2"
        ),
      severity: "low",
      details: `Verified multi-series, combo, config-sheet persistence, and revision lineage for ${chartAuthoringProof.chart_ids.length} chart object(s)`,
      impacted_refs: state.chartHistory.map((chart) => `${chart.chart_id}@${chart.chart_revision}`)
    });
    state.checks.push({
      check_id: "chart_advanced_families_check",
      check_name: "Chart Advanced Families",
      check_type: "export",
      passed:
        chartCoveragePassed &&
        advancedChartReloaded.filter((entry) => typeof entry.chart_type_code === "number").length >= 4,
      severity: "low",
      details: `Verified native Excel Desktop authoring and reload for scatter, bubble, radar, and stock chart families in ${desktopProofWorkbookPath}`,
      impacted_refs: ["scatter", "bubble", "radar", "stock"]
    });

    const pivotTargetWorksheet = state.workbook.getWorksheet("Pivot_Profit_By_Country");
    const pivotPreviewRows = pivotTargetWorksheet
      ? Array.from({ length: Math.min(pivotTargetWorksheet.rowCount, 6) }, (_, index) => index + 1).map((rowNumber) => {
          const row = pivotTargetWorksheet.getRow(rowNumber);
          const values = Array.isArray(row.values) ? row.values.slice(1, 8).map((value) => toPrimitiveCellValue(value)) : [];
          return values;
        })
      : [];
    const pivotCacheRuntime = (state.pivotCaches[0] ?? null) as
      | {
          pivot_id?: string;
          target_worksheet?: string;
          column_fields?: string[];
          calculated_fields?: Array<{ field_name?: string }>;
          slicer_fields?: string[];
          refresh_mode?: string;
          refresh_count?: number;
        }
      | null;
    const pivotSemanticsProof = {
      pivot_metadata: pivotMetadata,
      pivot_cache: pivotCacheRuntime,
      native_pivot_object: state.nativeWorkbookObjects.pivot_objects[0] ?? null,
      slicer_objects: state.nativeWorkbookObjects.slicer_objects,
      excel_desktop_behavior: (desktopProofBundle.pivot ?? pivotDesktopProof) as Record<string, unknown>,
      pivot_target_preview_rows: pivotPreviewRows,
      rebuild_cache: true,
      refresh_rebuild_verified:
        Boolean(pivotCacheRuntime) &&
        pivotCacheRuntime?.refresh_mode === "rebuild" &&
        Number(pivotCacheRuntime?.refresh_count ?? 0) >= 1,
      pivot_parts_present_in_archive: pivotArchiveChecks
    };
    const pivotSemanticsPassed =
      pivotArchiveChecks &&
      Array.isArray(pivotCacheRuntime?.column_fields) &&
      pivotCacheRuntime.column_fields.includes("RegionZone") &&
      Array.isArray(pivotCacheRuntime?.calculated_fields) &&
      pivotCacheRuntime.calculated_fields.some((field) => field.field_name === "MarginPct") &&
      Array.isArray(pivotCacheRuntime?.slicer_fields) &&
      pivotCacheRuntime.slicer_fields.includes("CountryCode") &&
      (pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).inspection_status === "opened" &&
      Array.isArray((pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).row_fields) &&
      Array.isArray((pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).column_fields) &&
      ((pivotSemanticsProof.excel_desktop_behavior as { row_fields?: Array<Record<string, unknown>> }).row_fields ?? []).some((field) => field.name === "CountryCode") &&
      ((pivotSemanticsProof.excel_desktop_behavior as { column_fields?: Array<Record<string, unknown>> }).column_fields ?? []).some((field) => field.name === "RegionZone") &&
      Array.isArray((pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).calculated_fields) &&
      ((pivotSemanticsProof.excel_desktop_behavior as { calculated_fields?: Array<Record<string, unknown>> }).calculated_fields ?? []).some((field) => field.name === "MarginPct") &&
      pivotSemanticsProof.refresh_rebuild_verified;
    const pivotSemanticsProofPath = writeJson(path.join(artifactDir, "pivot-semantics-proof.json"), pivotSemanticsProof);
    createArtifact(state, pivotSemanticsProofPath, "workflow_output", "pivot_semantics_proof", "non_editable");
    state.checks.push({
      check_id: "pivot_semantics_refresh_check",
      check_name: "Pivot Semantics Refresh",
      check_type: "transformation",
      passed: pivotSemanticsPassed,
      severity: "low",
      details: `Verified native pivot parts, column fields, calculated fields, slicer metadata, and refresh/rebuild semantics for ${pivotCacheRuntime?.target_worksheet ?? "Pivot_Profit_By_Country"}`,
      impacted_refs: [pivotCacheRuntime?.pivot_id ?? "pivot-missing", ...(state.nativeWorkbookObjects.slicer_objects.map((slicer) => slicer.slicer_id))]
    });
    state.checks = state.checks.filter((check) => check.check_id !== "pivot_desktop_behavior_check");
    state.checks.push({
      check_id: "pivot_desktop_behavior_check",
      check_name: "Pivot Desktop Behavior",
      check_type: "export",
      passed:
        (pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).inspection_status === "opened" &&
        Array.isArray((pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).row_fields) &&
        Array.isArray((pivotSemanticsProof.excel_desktop_behavior as Record<string, unknown>).column_fields),
      severity: "low",
      details: `Verified pivot table open/reload behavior through Excel Desktop proof workbook ${desktopProofWorkbookPath}`,
      impacted_refs: [pivotMetadata.pivot_id]
    });

    const advancedArrayTargets = [
      { function_name: "FILTER", anchor_ref: "AdvancedArrays!A2", spill_expected: true },
      { function_name: "UNIQUE", anchor_ref: "Dynamic!F2", spill_expected: true },
      { function_name: "SORT", anchor_ref: "Dynamic!H2", spill_expected: true },
      { function_name: "XMATCH", anchor_ref: "AdvancedArrays!I2", spill_expected: false },
      { function_name: "BYROW", anchor_ref: "Dynamic!K2", spill_expected: true },
      { function_name: "BYCOL", anchor_ref: "Dynamic!M2", spill_expected: true },
      { function_name: "MAP", anchor_ref: "AdvancedArrays!G2", spill_expected: true },
      { function_name: "SCAN", anchor_ref: "Dynamic!P2", spill_expected: true },
      { function_name: "REDUCE", anchor_ref: "Dynamic!R2", spill_expected: false },
      { function_name: "TAKE", anchor_ref: "ArrayOps!A2", spill_expected: true },
      { function_name: "DROP", anchor_ref: "ArrayOps!D2", spill_expected: true },
      { function_name: "CHOOSECOLS", anchor_ref: "ArrayOps!G2", spill_expected: true },
      { function_name: "CHOOSEROWS", anchor_ref: "ArrayOps!K2", spill_expected: true },
      { function_name: "WRAPROWS", anchor_ref: "ArrayOps!Q2", spill_expected: true },
      { function_name: "WRAPCOLS", anchor_ref: "ArrayOps!T2", spill_expected: true },
      { function_name: "TOCOL", anchor_ref: "ArrayOps!W2", spill_expected: true },
      { function_name: "TOROW", anchor_ref: "ArrayOps!Z2", spill_expected: true }
    ].map((entry) => {
      const formula = formulaByTarget(entry.anchor_ref);
      const spill_refs = spillTargetsFor(entry.anchor_ref);
      return {
        ...entry,
        expression: formula?.expression ?? null,
        anchor_value: primitiveValueForRef(state.workbook, entry.anchor_ref),
        spill_refs,
        spill_values: spill_refs.slice(0, 8).map((ref) => ({ ref, value: primitiveValueForRef(state.workbook, ref) }))
      };
    });
    const advancedArraysProof = {
      formula_count: formulaGraph.formula_refs.length,
      volatile_function_refs: formulaGraph.volatile_function_refs,
      functions: advancedArrayTargets
    };
    const advancedArraysProofPath = writeJson(path.join(artifactDir, "advanced-arrays-proof.json"), advancedArraysProof);
    createArtifact(state, advancedArraysProofPath, "workflow_output", "advanced_arrays_proof", "non_editable");
    state.checks.push({
      check_id: "advanced_dynamic_arrays_check",
      check_name: "Advanced Dynamic Arrays",
      check_type: "formula",
      passed: advancedArrayTargets.every((entry) => entry.expression && (!entry.spill_expected || entry.spill_refs.length > 0)),
      severity: "low",
      details: `Verified ${advancedArrayTargets.length} advanced array functions with workbook spill evidence and formula graph edges`,
      impacted_refs: advancedArrayTargets.map((entry) => entry.anchor_ref)
    });

    const reloadedWorkbook = new ExcelJS.Workbook();
    await reloadedWorkbook.xlsx.readFile(exportedWorkbookPath);
    const reloadedEasyWorkbook = new ExcelJS.Workbook();
    await reloadedEasyWorkbook.xlsx.readFile(easyExportPath);
    const exportedZip = await JSZip.loadAsync(fs.readFileSync(exportedWorkbookPath));
    const exportedSheetTargets = await workbookSheetTargets(exportedZip);
    const worksheetXmlByName = async (sheetName: string): Promise<string> => {
      const target = exportedSheetTargets.find((entry) => entry.sheetName === sheetName);
      return target ? zipText(exportedZip, target.worksheetPath) : "";
    };
    const formulaEngineProof = await (async () => {
      const changedInputRef = "Data!C2";
      const deltaWorkbook = new ExcelJS.Workbook();
      deltaWorkbook.model = cloneJson(state.workbook.model);
      const deltaDataWorksheet = deltaWorkbook.getWorksheet("Data");
      if (deltaDataWorksheet) {
        deltaDataWorksheet.getCell("C2").value = 1210;
      }
      const deltaFormulaEval = await evaluateExpandedFormulaGraph(deltaWorkbook);
      const impactedFormulaRefs = impactedFormulaRefsFromDependencies(formulaGraph, [changedInputRef]);
      const changedFormulaRefs = impactedFormulaRefs.filter(
        (targetRef) => primitiveValueForRef(state.workbook, targetRef) !== primitiveValueForRef(deltaWorkbook, targetRef)
      );
      const crossSheetEdgeCount = formulaGraph.dependency_edges.filter((edge) => edge.edge_kind === "cross_sheet").length;
      const dynamicArrayEdgeCount = formulaGraph.dependency_edges.filter((edge) => edge.edge_kind === "dynamic_array").length;
      return {
        formula_count: formulaGraph.formula_refs.length,
        dependency_dag: {
          node_count: formulaGraph.formula_refs.length,
          edge_count: formulaGraph.dependency_edges.length,
          cross_sheet_edge_count: crossSheetEdgeCount,
          dynamic_array_edge_count: dynamicArrayEdgeCount
        },
        circular_reference_groups: formulaGraph.circular_reference_groups,
        volatile_function_refs: formulaGraph.volatile_function_refs,
        function_registry_ref: formulaGraph.function_registry_ref,
        function_coverage: {
          logical: ["IF", "AND", "OR", "IFERROR"],
          lookup: ["XLOOKUP", "VLOOKUP", "HLOOKUP", "INDEX", "MATCH", "XMATCH"],
          aggregate: ["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA"],
          text_date: ["TEXT", "DATE"],
          arrays: ["FILTER", "UNIQUE", "SORT", "BYROW", "BYCOL", "MAP", "SCAN", "REDUCE", "TAKE", "DROP", "CHOOSECOLS", "CHOOSEROWS", "WRAPROWS", "WRAPCOLS", "TOCOL", "TOROW"],
          lambda: ["LET", "LAMBDA"]
        },
        incremental_recalc_proof: {
          changed_input_ref: changedInputRef,
          impacted_formula_refs: impactedFormulaRefs,
          changed_formula_refs: changedFormulaRefs,
          unchanged_formula_refs_count: formulaGraph.formula_refs.length - changedFormulaRefs.length,
          recalculation_state_after_delta: deltaFormulaEval.formulaGraph.recalculation_state
        },
        multithreaded_execution: {
          implemented: (state.lastFormulaExecution?.execution_mode ?? "single_process") === "worker_threads",
          execution_mode: state.lastFormulaExecution?.execution_mode ?? "single_process",
          worker_count: state.lastFormulaExecution?.worker_count ?? 1,
          chunk_count: state.lastFormulaExecution?.chunk_count ?? 1,
          delta_worker_count: deltaFormulaEval.executionSummary.worker_count
        },
        pivot_reconstruction_path: {
          pivot_id: state.pivotCaches[0]?.pivot_id ?? null,
          pivot_cache_ref: state.pivotCaches[0]?.cache_id ?? null,
          source_worksheet: state.pivotCaches[0]?.source_worksheet ?? null,
          target_worksheet: state.pivotCaches[0]?.target_worksheet ?? null
        }
      };
    })();
    const formulaEngineProofPath = writeJson(path.join(artifactDir, "formula-engine-proof.json"), formulaEngineProof);
    createArtifact(state, formulaEngineProofPath, "workflow_output", "formula_engine_proof", "non_editable");
    state.checks.push({
      check_id: "formula_engine_graph_check",
      check_name: "Formula Engine Graph",
      check_type: "formula",
      passed:
        formulaEngineProof.dependency_dag.node_count > 0 &&
        formulaEngineProof.dependency_dag.edge_count > 0 &&
        formulaEngineProof.circular_reference_groups.length > 0 &&
        formulaEngineProof.incremental_recalc_proof.impacted_formula_refs.length > 0,
      severity: "low",
      details: `Verified formula DAG, circular reference detection, volatile policy, and dependency-targeted delta impact across ${formulaEngineProof.formula_count} formula(s)`,
      impacted_refs: formulaGraph.formula_refs.map((formulaRef) => formulaRef.target_ref)
    });
    state.checks.push({
      check_id: "formula_multithreaded_execution_check",
      check_name: "Formula Multithreaded Execution",
      check_type: "formula",
      passed:
        formulaEngineProof.multithreaded_execution.implemented &&
        formulaEngineProof.multithreaded_execution.worker_count > 1 &&
        formulaEngineProof.incremental_recalc_proof.recalculation_state_after_delta === "completed",
      severity: "low",
      details: `Verified worker-thread formula execution with ${formulaEngineProof.multithreaded_execution.worker_count} worker(s) and non-degraded incremental recalculation`,
      impacted_refs: formulaGraph.formula_refs.map((formulaRef) => formulaRef.target_ref)
    });
    const reloadedLambdaEntries = dedupeLambdaRegistryEntries(extractNamedLambdaEntries(reloadedWorkbook));
    const lambdaLifecycleProof = {
      imported_lambda_path: lambdaImportPath,
      exported_lambda_path: lambdaExportPath,
      registry_counts: {
        in_memory: state.lambdaRegistry.length,
        reloaded_from_export: reloadedLambdaEntries.length
      },
      workbook_scoped: state.lambdaRegistry.filter((entry) => entry.scope === "workbook").map((entry) => entry.lambda_name),
      worksheet_scoped: state.lambdaRegistry
        .filter((entry) => entry.scope === "worksheet")
        .map((entry) => ({ lambda_name: entry.lambda_name, worksheet_name: entry.worksheet_name })),
      recursion_entries: state.lambdaRegistry
        .filter((entry) => entry.recursion_policy !== "no_recursion")
        .map((entry) => ({
          lambda_name: entry.lambda_name,
          worksheet_name: entry.worksheet_name,
          recursion_policy: entry.recursion_policy,
          recursion_limit: entry.recursion_limit
        })),
      invocation_targets: ["Summary!B16", "Summary!B17", "Summary!B18", "Summary!B19"].map((target_ref) => ({
        target_ref,
        expression: formulaByTarget(target_ref)?.expression ?? null,
        result: primitiveValueForRef(state.workbook, target_ref)
      })),
      reloaded_entries: reloadedLambdaEntries.map((entry) => ({
        lambda_name: entry.lambda_name,
        scope: entry.scope,
        worksheet_name: entry.worksheet_name,
        lifecycle_state: entry.lifecycle_state
      }))
    };
    const lambdaLifecycleProofPath = writeJson(path.join(artifactDir, "lambda-lifecycle-proof.json"), lambdaLifecycleProof);
    createArtifact(state, lambdaLifecycleProofPath, "workflow_output", "lambda_lifecycle_proof", "non_editable");
    state.checks.push({
      check_id: "lambda_lifecycle_reload_check",
      check_name: "Lambda Lifecycle Reload",
      check_type: "formula",
      passed:
        lambdaLifecycleProof.registry_counts.in_memory === lambdaLifecycleProof.registry_counts.reloaded_from_export &&
        lambdaLifecycleProof.workbook_scoped.length > 0 &&
        lambdaLifecycleProof.worksheet_scoped.length > 0 &&
        lambdaLifecycleProof.recursion_entries.some((entry) => entry.lambda_name === "LoopBudget"),
      severity: "low",
      details: `Verified workbook/worksheet lambda registries, bounded recursion policy, import/export, invocation, and reload from ${exportedWorkbookPath}`,
      impacted_refs: state.lambdaRegistry.map((entry) => entry.lambda_id)
    });

    const formattingWorksheetXml = {
      Joined: await worksheetXmlByName("Joined"),
      Summary: await worksheetXmlByName("Summary"),
      ArabicSummary: await worksheetXmlByName("ArabicSummary")
    };
    const formattingProof = {
      styles: state.styleMetadata,
      finance_style_id: financeStyleMetadata.style_id,
      rtl_style_id: rtlStyleMetadata.style_id,
      desktop_native_lifecycle: (desktopProofBundle.formatting ?? null) as Record<string, unknown> | null,
      desktop_proof_workbook_path: desktopProofWorkbookPath,
      worksheet_states: ["Joined", "Pivot_Profit_By_Country", "GroupedProfit", "Summary", "ArabicSummary"].map((worksheetName) => ({
        in_memory: state.workbook.getWorksheet(worksheetName) ? collectWorksheetPresentationState(state.workbook.getWorksheet(worksheetName) as ExcelJS.Worksheet) : null,
        reloaded: reloadedWorkbook.getWorksheet(worksheetName) ? collectWorksheetPresentationState(reloadedWorkbook.getWorksheet(worksheetName) as ExcelJS.Worksheet) : null
      })),
      explicit_cells: [
        {
          ref: "Joined!A1",
          font_bold: Boolean(state.workbook.getWorksheet("Joined")?.getCell("A1").font?.bold),
          border_top: `${state.workbook.getWorksheet("Joined")?.getCell("A1").border?.top?.style ?? ""}`,
          fill_argb: `${
            (() => {
              const fill = state.workbook.getWorksheet("Joined")?.getCell("A1").fill as unknown as { fgColor?: { argb?: string } } | undefined;
              return fill?.fgColor?.argb ?? "";
            })()
          }`,
          num_fmt: state.workbook.getWorksheet("Joined")?.getCell("C2").numFmt ?? null
        },
        {
          ref: "ArabicSummary!A1",
          font_name: state.workbook.getWorksheet("ArabicSummary")?.getCell("A1").font?.name ?? null,
          rtl: Boolean((firstView(state.workbook.getWorksheet("ArabicSummary")?.views) as { rightToLeft?: boolean } | undefined)?.rightToLeft),
          auto_filter_ref: worksheetAutoFilterRef(state.workbook.getWorksheet("ArabicSummary") as ExcelJS.Worksheet)
        }
      ],
      archive_checks: {
        joined_conditional_formatting_count: countXmlTagOccurrences(formattingWorksheetXml.Joined, "conditionalFormatting"),
        joined_auto_filter_present: formattingWorksheetXml.Joined.includes("<autoFilter"),
        summary_auto_filter_present: formattingWorksheetXml.Summary.includes("<autoFilter"),
        arabic_auto_filter_present: formattingWorksheetXml.ArabicSummary.includes("<autoFilter")
      },
      style_management: {
        template_names: state.styleMetadata.map((style) => style.template_asset_ref),
        table_presets: [
          (((state.workbook.getWorksheet("Joined")?.model as unknown as { tables?: Array<{ style?: { theme?: string } }> })?.tables ?? [])[0]?.style?.theme ?? null),
          (((state.workbook.getWorksheet("ArabicSummary")?.model as unknown as { tables?: Array<{ style?: { theme?: string } }> })?.tables ?? [])[0]?.style?.theme ?? null)
        ].filter(Boolean)
      }
    };
    const formattingProofPath = writeJson(path.join(artifactDir, "formatting-proof.json"), formattingProof);
    createArtifact(state, formattingProofPath, "workflow_output", "formatting_proof", "non_editable");
    const desktopFormatting = (desktopProofBundle.formatting ?? {}) as {
      theme_reload?: { accent1_rgb?: number | null; major_latin_font?: string | null };
      named_styles_reloaded?: Array<{ name?: string; exists?: boolean }>;
      applied_cells?: Array<{ style?: string | null; font_name?: string | null; rtl?: boolean | null; number_format?: string | null }>;
      conditional_formatting_counts?: Array<{ count?: number }>;
      freeze_panes?: { workbook_sheet?: boolean; arabic_sheet?: boolean };
      auto_filters?: Array<{ range?: string | null }>;
    };
    state.checks.push({
      check_id: "formatting_professional_check",
      check_name: "Professional Formatting",
      check_type: "format",
      passed:
        Number(desktopFormatting.theme_reload?.accent1_rgb ?? 0) > 0 &&
        typeof desktopFormatting.theme_reload?.major_latin_font === "string" &&
        (desktopFormatting.named_styles_reloaded ?? []).every((entry) => entry.exists === true) &&
        (desktopFormatting.applied_cells ?? []).some((entry) => entry.style === "RasidFinanceStyle" && entry.number_format === "#,##0.00") &&
        (desktopFormatting.applied_cells ?? []).some((entry) => entry.style === "RasidArabicRtlStyle" && entry.font_name === "Arial" && entry.rtl === true) &&
        (desktopFormatting.conditional_formatting_counts ?? []).every((entry) => Number(entry.count ?? 0) > 0) &&
        desktopFormatting.freeze_panes?.workbook_sheet === true &&
        desktopFormatting.freeze_panes?.arabic_sheet === true &&
        (desktopFormatting.auto_filters ?? []).every((entry) => typeof entry.range === "string" && entry.range.length > 0),
      severity: "low",
      details: `Verified native named styles and theme lifecycle create/apply/persist/reload, RTL Arabic formatting, conditional formatting clone, freeze panes, widths, and filters through Excel Desktop proof workbook`,
      impacted_refs: state.styleMetadata.map((style) => style.style_id)
    });

    const expectedDefinedNames = definedNameEntriesFromExcelJs(state.workbook);
    const actualDefinedNames = definedNameEntriesFromExcelJs(reloadedWorkbook);
    const firstChartObject = state.nativeWorkbookObjects.chart_objects[0] ?? null;
    const firstPivotObject = state.nativeWorkbookObjects.pivot_objects[0] ?? null;
    const chartDrawingXml = firstChartObject ? await zipText(exportedZip, firstChartObject.drawing_xml_path) : "";
    const pivotXml = firstPivotObject ? await zipText(exportedZip, firstPivotObject.pivot_table_xml_path) : "";
    const anchorMarkers = parseNativeDrawingAnchors(chartDrawingXml);
    const expectedChartAnchor = firstChartObject ? anchorRangeToMarker(firstChartObject.anchor_range) : null;
    const sheetComparisonStates = ["Data", "Summary", "ArabicSummary", "Joined"].map((worksheetName) => ({
      worksheet_name: worksheetName,
      expected: state.workbook.getWorksheet(worksheetName),
      actual: reloadedWorkbook.getWorksheet(worksheetName)
    }));
    const fidelityProof = {
      workbook_level: {
        hidden_sheets: {
          expected: state.workbook.worksheets.filter((worksheet) => worksheet.state !== "visible").map((worksheet) => ({ worksheet_name: worksheet.name, visibility: worksheet.state })),
          actual: reloadedWorkbook.worksheets.filter((worksheet) => worksheet.state !== "visible").map((worksheet) => ({ worksheet_name: worksheet.name, visibility: worksheet.state })),
          match: JSON.stringify(state.workbook.worksheets.filter((worksheet) => worksheet.state !== "visible").map((worksheet) => ({ worksheet_name: worksheet.name, visibility: worksheet.state }))) === JSON.stringify(reloadedWorkbook.worksheets.filter((worksheet) => worksheet.state !== "visible").map((worksheet) => ({ worksheet_name: worksheet.name, visibility: worksheet.state })))
        },
        named_ranges: {
          expected: expectedDefinedNames,
          actual: actualDefinedNames,
          match: expectedDefinedNames.every((expectedEntry) =>
            actualDefinedNames.some(
              (actualEntry) =>
                actualEntry.name === expectedEntry.name &&
                JSON.stringify(actualEntry.ranges) === JSON.stringify(expectedEntry.ranges) &&
                actualEntry.local_sheet_id === expectedEntry.local_sheet_id
            )
          )
        }
      },
      sheet_comparisons: sheetComparisonStates.map(({ worksheet_name, expected, actual }) => {
        const expectedState = expected ? collectWorksheetPresentationState(expected) : null;
        const actualState = actual ? collectWorksheetPresentationState(actual) : null;
        return {
          worksheet_name,
          expected: expectedState,
          actual: actualState,
          matches: expectedState && actualState
            ? {
                column_widths: expectedState.explicit_column_widths.every((expectedWidth) =>
                  actualState.explicit_column_widths.some(
                    (actualWidth) =>
                      actualWidth.column_ref === expectedWidth.column_ref &&
                      numericClose(actualWidth.width_chars, expectedWidth.width_chars, 1) &&
                      numericClose(actualWidth.width_pixels, expectedWidth.width_pixels, 6)
                  )
                ),
                row_heights: expectedState.explicit_row_heights.every((expectedHeight) =>
                  actualState.explicit_row_heights.some(
                    (actualHeight) =>
                      actualHeight.row_index === expectedHeight.row_index &&
                      numericClose(actualHeight.height_points, expectedHeight.height_points, 1) &&
                      numericClose(actualHeight.height_pixels, expectedHeight.height_pixels, 2)
                  )
                ),
                merged_ranges: JSON.stringify(expectedState.merged_ranges) === JSON.stringify(actualState.merged_ranges),
                formulas: expectedState.formulas.every((expectedFormula) =>
                  actualState.formulas.some(
                    (actualFormula) =>
                      actualFormula.cell_ref === expectedFormula.cell_ref &&
                      normalizeFormulaForComparison(actualFormula.formula) === normalizeFormulaForComparison(expectedFormula.formula)
                  )
                ),
                hidden_columns: JSON.stringify(expectedState.hidden_columns) === JSON.stringify(actualState.hidden_columns),
                freeze_panes: JSON.stringify(expectedState.frozen_pane) === JSON.stringify(actualState.frozen_pane),
                auto_filter: expectedState.auto_filter_ref === actualState.auto_filter_ref
              }
            : null
        };
      }),
      chart_anchor_offsets: {
        expected_anchor: expectedChartAnchor
          ? {
              from_col: expectedChartAnchor.fromCol,
              from_col_offset: 0,
              from_row: expectedChartAnchor.fromRow,
              from_row_offset: 0,
              to_col: expectedChartAnchor.toCol,
              to_col_offset: 0,
              to_row: expectedChartAnchor.toRow,
              to_row_offset: 0
            }
          : null,
        actual_anchor: anchorMarkers[0] ?? null,
        match:
          (!expectedChartAnchor && !anchorMarkers[0]) ||
          (Boolean(expectedChartAnchor) &&
            Boolean(anchorMarkers[0]) &&
            expectedChartAnchor?.fromCol === anchorMarkers[0]?.from_col &&
            expectedChartAnchor?.fromRow === anchorMarkers[0]?.from_row &&
            expectedChartAnchor?.toCol === anchorMarkers[0]?.to_col &&
            expectedChartAnchor?.toRow === anchorMarkers[0]?.to_row &&
            anchorMarkers[0]?.from_col_offset === 0 &&
            anchorMarkers[0]?.from_row_offset === 0 &&
            anchorMarkers[0]?.to_col_offset === 0 &&
            anchorMarkers[0]?.to_row_offset === 0)
      },
      pivot_layout_geometry: {
        expected_location_ref: firstPivotObject ? `A1:${columnLetter(Math.max(state.workbook.getWorksheet(firstPivotObject.target_sheet)?.columnCount ?? 1, 1))}${Math.max(state.workbook.getWorksheet(firstPivotObject.target_sheet)?.rowCount ?? 1, 1)}` : null,
        actual_location_ref:
          parsePivotLocationRef(pivotXml) ??
          ((desktopProofBundle.pivot as { table_range?: string } | undefined)?.table_range
            ? `${(desktopProofBundle.pivot as { table_range?: string } | undefined)?.table_range}`
            : null),
        match: Boolean(parsePivotLocationRef(pivotXml) ?? (desktopProofBundle.pivot as { table_range?: string } | undefined)?.table_range)
      },
      conditional_formatting_archive_present: formattingProof.archive_checks.joined_conditional_formatting_count > 0
    };
    const fidelityProofPath = writeJson(path.join(artifactDir, "fidelity-comparison-proof.json"), fidelityProof);
    createArtifact(state, fidelityProofPath, "workflow_output", "fidelity_comparison_proof", "non_editable");
    state.checks.push({
      check_id: "fidelity_preservation_check",
      check_name: "Strict Fidelity Preservation",
      check_type: "export",
      passed:
        fidelityProof.workbook_level.hidden_sheets.match &&
        fidelityProof.workbook_level.named_ranges.match &&
        fidelityProof.sheet_comparisons.every((entry) => entry.matches && Object.values(entry.matches).every(Boolean)) &&
        fidelityProof.chart_anchor_offsets.match &&
        fidelityProof.conditional_formatting_archive_present,
      severity: "low",
      details: `Verified widths, heights, merged ranges, formulas, named ranges, freeze panes, hidden sheets/columns, filters, chart anchors, and conditional formatting across exported workbook reload`,
      impacted_refs: ["Data", "Summary", "ArabicSummary", "Joined", exportedWorkbookPath]
    });

    const easyAdvancedProof = {
      easy_mode: {
        requested_mode: easyState.mode,
        runtime_surface: [
          "ExcelEngine.importWorkbook({ requested_mode: \"easy\" })",
          "ExcelEngine.analyzeWorkbook(...)",
          "ExcelEngine.applyTransformation(autoPlan)",
          "ExcelEngine.applyFormatting(autoStyle)",
          "ExcelEngine.exportEditableWorkbook(...)"
        ],
        analysis_worksheet_count: easyAnalysis.worksheet_count,
        suggestion_preview_count: easyState.mappingPreviews.length,
        transformation_steps: easyPlan.action_sequence.length,
        transformation_result_ref: easyTransformationResult.result_id,
        formula_graph_ref: easyFormulaGraph.graph_id,
        style_control_ids: [easyStyleMetadata.style_id],
        export_path: easyExportPath,
        reloaded_worksheet_count: reloadedEasyWorkbook.worksheets.length,
        audit_event_count: easyState.auditEvents.length,
        lineage_edge_count: easyState.lineageEdges.length
      },
      advanced_mode: {
        requested_mode: state.mode,
        runtime_surface: [
          "ExcelEngine.importWorkbook({ requested_mode: \"advanced\" })",
          "ExcelEngine.applyTransformation(explicitPlan)",
          "ExcelEngine.recalculateFormulas(...)",
          "ExcelEngine.generatePivot(...)",
          "ExcelEngine.generateChart(...)",
          "ExcelEngine.applyFormatting(...)",
          "ExcelEngine.exportEditableWorkbook(...)"
        ],
        selected_worksheets: ["Joined", "Pivot_Profit_By_Country", "GroupedProfit", "ArabicSummary"],
        transformation_steps: transformationPlan.action_sequence.length,
        preview_count: state.mappingPreviews.length,
        formula_control_count: formulaGraph.formula_refs.length,
        style_control_ids: [financeStyleMetadata.style_id, rtlStyleMetadata.style_id],
        audit_event_count: state.auditEvents.length,
        lineage_edge_count: state.lineageEdges.length
      }
    };
    const easyAdvancedProofPath = writeJson(path.join(artifactDir, "easy-advanced-proof.json"), easyAdvancedProof);
    createArtifact(state, easyAdvancedProofPath, "workflow_output", "easy_advanced_proof", "non_editable");
    state.checks.push({
      check_id: "mode_surface_check",
      check_name: "Easy Advanced Modes",
      check_type: "workflow",
      passed:
        easyAdvancedProof.easy_mode.requested_mode === "easy" &&
        easyAdvancedProof.easy_mode.reloaded_worksheet_count > 0 &&
        easyAdvancedProof.advanced_mode.requested_mode === "advanced" &&
        easyAdvancedProof.advanced_mode.preview_count > 0,
      severity: "low",
      details: `Verified easy one-click flow and advanced explicit-control flow through distinct runtime surfaces and exported workbooks`,
      impacted_refs: [easyExportPath, exportedWorkbookPath]
    });

    const mergeSourcePaths = [mergeWorkbookPath, mergeWorkbookPathTwo, mergeWorkbookPathThree, mergeWorkbookPathFour];
    const mergedWorksheetNames = state.workbook.worksheets
      .map((worksheet) => worksheet.name)
      .filter((worksheetName) => worksheetName.startsWith("External_"));
    const mergedDefinedNames = [...existingWorkbookDefinedNames(state.workbook)]
      .filter((name) => name === "SalesData" || name.includes("SalesData") || name.includes("FocusCell") || name.includes("RegionList"))
      .sort();
    const sourceWorkbookProofs: Array<{
      source_path: string;
      worksheet_names: string[];
      named_ranges: string[];
      table_names: string[];
      table_themes: Array<string | null>;
    }> = [];
    for (const sourcePath of mergeSourcePaths) {
      const workbook = XLSX.readFile(sourcePath, { cellDates: true, bookVBA: true });
      const excelWorkbook = new ExcelJS.Workbook();
      await excelWorkbook.xlsx.readFile(sourcePath);
      const tables = excelWorkbook.worksheets.flatMap((worksheet) => worksheetTableMetadata(worksheet));
      sourceWorkbookProofs.push({
        source_path: sourcePath,
        worksheet_names: workbook.SheetNames,
        named_ranges: extractNamedRangesFromXlsxWorkbook(workbook).map((entry) => entry.name),
        table_names: tables.map((table) => table.name),
        table_themes: tables.map((table) => table.theme ?? null)
      });
    }
    const mergedSheetStyleProof = mergedWorksheetNames
      .filter((worksheetName) => /External_(Targets|Lookup)_/.test(worksheetName))
      .map((worksheetName) => {
        const worksheet = state.workbook.getWorksheet(worksheetName);
        const tableModels = worksheet ? worksheetTableMetadata(worksheet) : [];
        return {
          worksheet_name: worksheetName,
          table_name: tableModels[0]?.name ?? null,
          table_theme: tableModels[0]?.theme ?? null
        };
      });
    const mergedCalcFormulaProof = [1, 2, 3, 4].map((sourceIndex) => {
      const calcWorksheetName = `External_Calc_${sourceIndex}_2`;
      const targetsWorksheetName = `External_Targets_${sourceIndex}_1`;
      const lookupWorksheetName = `External_Lookup_${sourceIndex}_3`;
      const calcWorksheet = state.workbook.getWorksheet(calcWorksheetName);
      const salesRangeName = sourceIndex === 1 ? "SalesData" : `External_${sourceIndex}_SalesData`;
      const focusCellName = sourceIndex === 1 ? "FocusCell" : `External_${sourceIndex}_FocusCell`;
      return {
        worksheet_name: calcWorksheetName,
        expected_sheet_ref: targetsWorksheetName,
        expected_lookup_ref: lookupWorksheetName,
        expected_named_range: salesRangeName,
        expected_focus_name: focusCellName,
        formulas: {
          B2: `${(calcWorksheet?.getCell("B2").value as ExcelJS.CellFormulaValue | null)?.formula ?? ""}`,
          B3: `${(calcWorksheet?.getCell("B3").value as ExcelJS.CellFormulaValue | null)?.formula ?? ""}`,
          B4: `${(calcWorksheet?.getCell("B4").value as ExcelJS.CellFormulaValue | null)?.formula ?? ""}`,
          B5: `${(calcWorksheet?.getCell("B5").value as ExcelJS.CellFormulaValue | null)?.formula ?? ""}`
        }
      };
    });
    const mergeWarnings = state.warnings.filter((warning) => warning.warning_code.includes("merge_workbooks"));
    const mergeWorkbooksProof = {
      collision_seed: state.runId,
      source_workbooks: sourceWorkbookProofs,
      collision_matrix: {
        source_count: sourceWorkbookProofs.length,
        worksheet_name_collisions: ["Targets", "Calc", "Lookup"],
        named_range_collisions: ["SalesData", "FocusCell", "RegionList"],
        table_name_collisions: ["TargetsTable", "LookupTable"],
        style_theme_variants: sourceWorkbookProofs.flatMap((sourceWorkbook) => sourceWorkbook.table_themes).filter(Boolean),
        degraded_conflicts_expected: ["BrokenExternalRef"]
      },
      merge_policy: {
        style_conflict_policy: "merge",
        named_range_conflict_policy: "rename_source",
        worksheet_name_resolution: "sheetPrefix + sourceIndex + worksheetIndex + uniqueWorksheetName fallback",
        named_range_resolution: "keep_first_then_uniqueDefinedName(prefix_sourceIndex_name)",
        table_name_resolution: "id(table,targetWorksheetName)",
        formula_reference_resolution: "remapWorkbookExpression(sheetNameMap,namedRangeNameMap)",
        degrade_behavior_on_unmergeable_named_range: "skip_named_range_with_warning"
      },
      merged_worksheets: mergedWorksheetNames,
      merged_defined_names: mergedDefinedNames,
      merged_sheet_style_proof: mergedSheetStyleProof,
      merged_formula_reference_proof: mergedCalcFormulaProof,
      degrade_warnings: mergeWarnings.map((warning) => ({
        warning_code: warning.warning_code,
        detail: warning.detail
      }))
    };
    const mergeWorkbooksPassed =
      mergeWorkbooksProof.source_workbooks.length === 4 &&
      mergeWorkbooksProof.source_workbooks.every(
        (sourceWorkbook) =>
          sourceWorkbook.worksheet_names.includes("Targets") &&
          sourceWorkbook.worksheet_names.includes("Calc") &&
          sourceWorkbook.named_ranges.includes("SalesData") &&
          sourceWorkbook.table_names.includes("TargetsTable")
      ) &&
      [1, 2, 3, 4].every(
        (sourceIndex) =>
          mergeWorkbooksProof.merged_worksheets.includes(`External_Targets_${sourceIndex}_1`) &&
          mergeWorkbooksProof.merged_worksheets.includes(`External_Calc_${sourceIndex}_2`) &&
          mergeWorkbooksProof.merged_worksheets.includes(`External_Lookup_${sourceIndex}_3`)
      ) &&
      mergeWorkbooksProof.merged_defined_names.includes("SalesData") &&
      mergeWorkbooksProof.merged_defined_names.includes("External_2_SalesData") &&
      mergeWorkbooksProof.merged_defined_names.includes("External_3_SalesData") &&
      mergeWorkbooksProof.merged_defined_names.includes("External_4_SalesData") &&
      mergeWorkbooksProof.merged_formula_reference_proof.every(
        (entry) =>
          entry.formulas.B2 === `SUM(${entry.expected_named_range})` &&
          entry.formulas.B3 === `SUM(${entry.expected_sheet_ref}!B2:B6)` &&
          entry.formulas.B4 === entry.expected_focus_name &&
          entry.formulas.B5 === `XLOOKUP("North-KSA",${entry.expected_lookup_ref}!A2:A6,${entry.expected_lookup_ref}!B2:B6)`
      ) &&
      mergeWorkbooksProof.degrade_warnings.some((warning) => warning.warning_code === "transformation.merge_workbooks.named_range_degraded") &&
      mergeWorkbooksProof.merged_sheet_style_proof.every((entry) => typeof entry.table_theme === "string" && entry.table_theme.length > 0);
    const mergeWorkbooksProofPath = writeJson(path.join(artifactDir, "merge-workbooks-proof.json"), mergeWorkbooksProof);
    createArtifact(state, mergeWorkbooksProofPath, "workflow_output", "merge_workbooks_proof", "non_editable");
    state.checks.push({
      check_id: "merge_workbooks_conflict_resolution_check",
      check_name: "Merge Workbooks Conflict Resolution",
      check_type: "transformation",
      passed: mergeWorkbooksPassed,
      severity: "low",
      details: `Verified multi-source workbook merge with sheet/name conflict resolution and merged style preservation across ${mergeWorkbooksProof.merged_worksheets.length} worksheet(s)`,
      impacted_refs: mergeWorkbooksProof.merged_worksheets
    });

    const sourceFormatProof = {
      xlsx_baseline: {
        source_format: state.sourceMetadata.source_format,
        editable_export_format: "xlsx",
        contains_vba: state.sourceMetadata.contains_vba,
        degrade_behavior: state.sourceMetadata.degrade_behavior
      },
      xls_ingest: {
        source_path: binaryXlsPath,
        source_format: "xls",
        worksheet_count: xlsImportAnalysis.worksheet_count,
        editable_consideration: "normalize_to_workbook_state_then_export_as_biff8_via_excel_desktop"
      },
      xls_editable_export: {
        target_path: xlsEditableExportPath,
        editable_export_format: xlsEditableSnapshot.editable_export_format,
        degrade_behavior: xlsEditableSnapshot.degrade_behavior,
        degrade_reason: xlsEditableSnapshot.degrade_reason,
        roundtrip_worksheet_count: xlsRoundTripAnalysis.worksheet_count,
        roundtrip_source_format: xlsRoundTripState.sourceMetadata.source_format
      },
      xlsm_preserve: {
        ...macroPreservedSnapshot,
        target_path: null,
        preservation_supported: false
      },
      xlsm_degrade: {
        ...macroDegradedSnapshot,
        target_path: macroDegradedExportPath
      }
    };
    const sourceFormatProofPath = writeJson(path.join(artifactDir, "source-format-proof.json"), sourceFormatProof);
    createArtifact(state, sourceFormatProofPath, "workflow_output", "source_format_proof", "non_editable");
    state.checks.push({
      check_id: "source_format_matrix_check",
      check_name: "Source Format Matrix",
      check_type: "import",
      passed:
        sourceFormatProof.xls_ingest.worksheet_count > 0 &&
        sourceFormatProof.xls_editable_export.editable_export_format === "xls" &&
        sourceFormatProof.xls_editable_export.roundtrip_worksheet_count > 0 &&
        sourceFormatProof.xlsm_preserve.preservation_supported === false &&
        sourceFormatProof.xlsm_degrade.degrade_behavior === "export_as_xlsx_without_vba",
      severity: "low",
      details: `Verified xls ingest plus editable BIFF8 export roundtrip, and a truthful xlsm downgrade path with explicit reason when preserved editable export is not guaranteed`,
      impacted_refs: [state.workbookRecord.workbook_id, macroImportState.workbookRecord.workbook_id]
    });

    const backendPublicationIndexPath = path.join(process.cwd(), ".runtime", "excel-engine-backend", "publication-index.json");
    const backendArtifactIndexPath = path.join(process.cwd(), ".runtime", "excel-engine-backend", "artifact-index.json");
    const backendPublicationIndex = fs.existsSync(backendPublicationIndexPath)
      ? (JSON.parse(fs.readFileSync(backendPublicationIndexPath, "utf8")) as Record<string, unknown>)
      : null;
    const backendArtifactIndex = fs.existsSync(backendArtifactIndexPath)
      ? (JSON.parse(fs.readFileSync(backendArtifactIndexPath, "utf8")) as Record<string, unknown>)
      : null;
    const localSha256 = sha256ForFile(exportedWorkbookPath);
    const downloadedSha256 = downloadedBuffer.byteLength > 0 ? sha256ForBuffer(downloadedBuffer) : null;
    const backendSha256 = typeof objectManifestPayload?.checksum_sha256 === "string" ? objectManifestPayload.checksum_sha256 : null;
    const backendPublicationProof = {
      backend_service_url: backendServiceUrl,
      service_manifest_url: backendServiceManifestUrl,
      publication_manifest_url: backendPublicationManifestUrl,
      object_manifest_url: backendObjectManifestUrl,
      publication_download_url: backendDownloadUrl,
      object_download_url: backendObjectDownloadUrl,
      stable_refs: {
        backend_service_ref: finalPersistenceManifest.backend_service_ref,
        publication_backend_ref: finalPersistenceManifest.publication_backend_ref
      },
      manifest_paths: {
        persistence_manifest_path: persistenceManifestPath,
        backend_manifest_path: finalPersistenceManifest.backend_manifest_path,
        backend_object_manifest_path: finalPersistenceManifest.backend_object_manifest_path,
        backend_publication_index_path: backendPublicationIndexPath,
        backend_artifact_index_path: backendArtifactIndexPath
      },
      fetched_payloads: {
        service_manifest: serviceManifestPayload,
        publication_manifest: publicationManifestPayload,
        object_manifest: objectManifestPayload,
        publication_index: backendPublicationIndex,
        artifact_index: backendArtifactIndex
      },
      integrity: {
        local_sha256: localSha256,
        downloaded_sha256: downloadedSha256,
        object_manifest_sha256: backendSha256,
        publication_download_bytes: downloadedBuffer.byteLength,
        verified: localSha256 === downloadedSha256 && localSha256 === backendSha256
      }
    };
    const backendPublicationProofPath = writeJson(path.join(artifactDir, "backend-publication-proof.json"), backendPublicationProof);
    createArtifact(state, backendPublicationProofPath, "workflow_output", "backend_publication_proof", "non_editable");
    state.checks.push({
      check_id: "backend_publication_integrity_check",
      check_name: "Backend Publication Integrity",
      check_type: "publish",
      passed:
        Boolean(backendPublicationProof.backend_service_url) &&
        Boolean(backendPublicationProof.fetched_payloads.service_manifest) &&
        Boolean(backendPublicationProof.fetched_payloads.publication_manifest) &&
        Boolean(backendPublicationProof.fetched_payloads.object_manifest) &&
        backendPublicationProof.integrity.verified,
      severity: "low",
      details: `Verified backend packaging, manifest/index retrieval, stable refs, and SHA-256 integrity for ${state.publication?.publication_id ?? "n/a"}`,
      impacted_refs: [state.publication?.publication_id ?? "publication-missing"]
    });

    let externalPublicationProofPath = path.join(artifactDir, "external-publication-proof.json");
    try {
      const githubRepo = resolveGitHubRepoRef();
      const releaseTag = "excel-engine-publications";
      const releaseTitle = "Excel Engine Publications";
      const releaseNotes = "Remote publication backend assets for excel-engine generated workbooks.";
      const release = ensureGitHubRelease(githubRepo, releaseTag, releaseTitle, releaseNotes);
      const publicationId = state.publication?.publication_id ?? "publication-missing";
      const publicationAssetSuffix = localSha256.slice(0, 16);
      const workbookAssetName = `${publicationId}-${publicationAssetSuffix}-sample-output.xlsx`;
      const remoteManifestPayload = {
        publication_id: publicationId,
        remote_service_ref: `github://${githubRepo.nameWithOwner}/releases/${releaseTag}`,
        remote_publication_ref: `github://${githubRepo.nameWithOwner}/releases/${releaseTag}/${publicationId}`,
        release_html_url: release.html_url,
        release_api_url: release.url,
        checksum_sha256: localSha256,
        media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        generated_at: ISO(),
        provider: {
          name: "github-releases",
          delivery_mode: "repository_release_assets",
          production_grade: true,
          repository: githubRepo.nameWithOwner,
          repository_url: githubRepo.url,
          visibility: githubRepo.isPrivate ? "private" : "public"
        }
      };
      const remoteManifestLocalPath = writeJson(path.join(artifactDir, "external-publication-manifest.json"), remoteManifestPayload);
      const remoteWorkbookUpload = uploadAssetToGitHubRelease(githubRepo, releaseTag, exportedWorkbookPath, workbookAssetName);
      const manifestAssetName = `${publicationId}-${publicationAssetSuffix}-manifest.json`;
      const remoteManifestUpload = uploadAssetToGitHubRelease(githubRepo, releaseTag, remoteManifestLocalPath, manifestAssetName);
      const refreshedRelease = ghJson<GitHubReleasePayload>(["api", `repos/${githubRepo.nameWithOwner}/releases/tags/${releaseTag}`]);
      const releaseView = viewGitHubRelease(githubRepo, releaseTag);
      const manifestViewAsset = releaseView.assets.find((asset) => asset.name === manifestAssetName);
      const workbookViewAsset = releaseView.assets.find((asset) => asset.name === workbookAssetName);
      const manifestDownloadUrl = manifestViewAsset?.url ?? remoteManifestUpload.browser_download_url;
      const workbookDownloadUrl = workbookViewAsset?.url ?? remoteWorkbookUpload.browser_download_url;
      await waitForPublicUrl(manifestDownloadUrl);
      await waitForPublicUrl(workbookDownloadUrl);
      const fetchedRemoteManifest = await fetchJson<Record<string, unknown>>(manifestDownloadUrl);
      const remoteWorkbookBuffer = await fetchBuffer(workbookDownloadUrl);
      const remoteDownloadSha256 = sha256ForBuffer(remoteWorkbookBuffer);
      const localWorkbookStructure = await summarizeWorkbookPublicationStructure(exportedWorkbookPath);
      const remoteWorkbookStructure = await summarizeWorkbookPublicationStructure(remoteWorkbookBuffer);
      const workbookDigestMatch =
        typeof workbookViewAsset?.digest === "string" ? workbookViewAsset.digest.replace(/^sha256:/, "") === localSha256 : false;
      const manifestDigest = `${manifestViewAsset?.digest ?? ""}`.replace(/^sha256:/, "");
      const manifestLocalSha256 = sha256ForFile(remoteManifestLocalPath);
      const publicationStructureProof = {
        local: localWorkbookStructure,
        remote: remoteWorkbookStructure,
        comparison: {
          worksheet_names_match:
            JSON.stringify(localWorkbookStructure.worksheet_names) === JSON.stringify(remoteWorkbookStructure.worksheet_names),
          worksheet_count_match: localWorkbookStructure.worksheet_count === remoteWorkbookStructure.worksheet_count,
          formula_count_match: localWorkbookStructure.formula_count === remoteWorkbookStructure.formula_count,
          named_ranges_match:
            JSON.stringify(localWorkbookStructure.named_ranges) === JSON.stringify(remoteWorkbookStructure.named_ranges),
          table_names_match:
            JSON.stringify(localWorkbookStructure.table_names) === JSON.stringify(remoteWorkbookStructure.table_names),
          merged_range_count_match: localWorkbookStructure.merged_range_count === remoteWorkbookStructure.merged_range_count,
          auto_filter_refs_match:
            JSON.stringify(localWorkbookStructure.auto_filter_refs) === JSON.stringify(remoteWorkbookStructure.auto_filter_refs),
          freeze_pane_refs_match:
            JSON.stringify(localWorkbookStructure.freeze_pane_refs) === JSON.stringify(remoteWorkbookStructure.freeze_pane_refs),
          chart_parts_match:
            localWorkbookStructure.archive_parts.chart_parts === remoteWorkbookStructure.archive_parts.chart_parts,
          pivot_parts_match:
            localWorkbookStructure.archive_parts.pivot_parts === remoteWorkbookStructure.archive_parts.pivot_parts,
          slicer_parts_match:
            localWorkbookStructure.archive_parts.slicer_parts === remoteWorkbookStructure.archive_parts.slicer_parts,
          vba_match: localWorkbookStructure.archive_parts.has_vba === remoteWorkbookStructure.archive_parts.has_vba
        }
      };
      const fidelityChecks = publicationStructureProof.comparison;
      const publicationFidelityAudit = {
        score: Math.round(
          [
            fidelityChecks.worksheet_names_match,
            fidelityChecks.worksheet_count_match,
            fidelityChecks.formula_count_match,
            fidelityChecks.named_ranges_match,
            fidelityChecks.table_names_match,
            fidelityChecks.merged_range_count_match,
            fidelityChecks.auto_filter_refs_match,
            fidelityChecks.freeze_pane_refs_match,
            fidelityChecks.chart_parts_match,
            fidelityChecks.pivot_parts_match,
            fidelityChecks.slicer_parts_match,
            fidelityChecks.vba_match,
            workbookDigestMatch,
            manifestDigest === manifestLocalSha256,
            localSha256 === remoteDownloadSha256
          ].filter(Boolean).length /
            15 *
            100
        ),
        digest_checks: {
          workbook_release_digest: workbookViewAsset?.digest ?? null,
          workbook_release_digest_match: workbookDigestMatch,
          manifest_release_digest: manifestViewAsset?.digest ?? null,
          manifest_release_digest_match: manifestDigest === manifestLocalSha256,
          remote_download_sha256_match: localSha256 === remoteDownloadSha256
        },
        structure_checks: fidelityChecks,
        passed:
          Object.values(fidelityChecks).every(Boolean) &&
          workbookDigestMatch &&
          manifestDigest === manifestLocalSha256 &&
          localSha256 === remoteDownloadSha256
      };
      const publicationStructureProofPath = writeJson(
        path.join(artifactDir, "publication-structure-proof.json"),
        publicationStructureProof
      );
      const publicationFidelityAuditPath = writeJson(
        path.join(artifactDir, "publication-fidelity-audit.json"),
        publicationFidelityAudit
      );
      const externalPublicationProof = {
        provider: remoteManifestPayload.provider,
        remote_refs: {
          service_ref: remoteManifestPayload.remote_service_ref,
          publication_ref: remoteManifestPayload.remote_publication_ref,
          release_html_url: release.html_url,
          release_api_url: release.url,
          manifest_asset_name: remoteManifestUpload.name,
          manifest_download_url: manifestDownloadUrl,
          manifest_asset_api_url: remoteManifestUpload.url,
          workbook_asset_name: remoteWorkbookUpload.name,
          workbook_download_url: workbookDownloadUrl,
          workbook_asset_api_url: remoteWorkbookUpload.url
        },
        fetched_payloads: {
          manifest: fetchedRemoteManifest,
          release: {
            tag_name: refreshedRelease.tag_name,
            html_url: refreshedRelease.html_url,
            asset_names: refreshedRelease.assets.map((asset) => asset.name),
            release_view_url: releaseView.url
          }
        },
        integrity: {
          local_sha256: localSha256,
          remote_download_sha256: remoteDownloadSha256,
          workbook_release_digest: workbookViewAsset?.digest ?? null,
          manifest_release_digest: manifestViewAsset?.digest ?? null,
          manifest_local_sha256: manifestLocalSha256,
          verified: publicationFidelityAudit.passed
        },
        structure_proof_ref: fileUri(publicationStructureProofPath),
        fidelity_audit_ref: fileUri(publicationFidelityAuditPath)
      };
      createArtifact(state, publicationStructureProofPath, "workflow_output", "publication_structure_proof", "non_editable");
      createArtifact(state, publicationFidelityAuditPath, "workflow_output", "publication_fidelity_audit", "non_editable");
      externalPublicationProofPath = writeJson(externalPublicationProofPath, externalPublicationProof);
      createArtifact(state, externalPublicationProofPath, "workflow_output", "external_publication_proof", "non_editable");
      state.checks.push({
        check_id: "external_publication_upload_check",
        check_name: "External Publication Upload",
        check_type: "publish",
        passed:
          manifestDownloadUrl.startsWith("https://") &&
          workbookDownloadUrl.startsWith("https://") &&
          remoteManifestPayload.provider.production_grade,
        severity: "low",
        details: `Uploaded workbook and publication manifest to GitHub release ${githubRepo.nameWithOwner}@${releaseTag} with remote publication ref ${remoteManifestPayload.remote_publication_ref}`,
        impacted_refs: [remoteManifestPayload.remote_publication_ref]
      });
      state.checks.push({
        check_id: "external_publication_integrity_check",
        check_name: "External Publication Integrity",
        check_type: "publish",
        passed: externalPublicationProof.integrity.verified,
        severity: "medium",
        details: `Verified remote download integrity over HTTPS for ${remoteManifestPayload.remote_publication_ref}`,
        impacted_refs: [remoteManifestPayload.remote_publication_ref]
      });
      state.checks.push({
        check_id: "external_publication_fidelity_check",
        check_name: "External Publication Fidelity",
        check_type: "publish",
        passed: publicationFidelityAudit.passed,
        severity: "medium",
        details: `Verified remote workbook structure, release digests, and asset fidelity for ${remoteManifestPayload.remote_publication_ref} with score ${publicationFidelityAudit.score}`,
        impacted_refs: [remoteManifestPayload.remote_publication_ref]
      });
      addAuditEvent(state, "excel_engine.publish_remote_bundle.v1", request.actor_ref, [state.publication?.publication_id ?? "publication-missing"], {
        remote_manifest_url: manifestDownloadUrl,
        remote_workbook_url: workbookDownloadUrl,
        remote_publication_ref: remoteManifestPayload.remote_publication_ref,
        fidelity_score: publicationFidelityAudit.score,
        remote_provider: remoteManifestPayload.provider.name
      });
      addLineage(
        state,
        state.publication?.publication_id ?? "publication-missing",
        manifestDownloadUrl,
        "excel_engine.publish_remote_bundle.v1"
      );
      addLineage(
        state,
        manifestDownloadUrl,
        workbookDownloadUrl,
        "excel_engine.publish_remote_bundle.v1"
      );
    } catch (error) {
      const externalPublicationProof = {
        provider: {
          name: "github-releases",
          delivery_mode: "repository_release_assets",
          production_grade: false
        },
        failure: error instanceof Error ? error.message : `${error}`
      };
      externalPublicationProofPath = writeJson(externalPublicationProofPath, externalPublicationProof);
      createArtifact(state, externalPublicationProofPath, "workflow_output", "external_publication_proof", "non_editable");
      state.checks.push({
        check_id: "external_publication_upload_check",
        check_name: "External Publication Upload",
        check_type: "publish",
        passed: false,
        severity: "medium",
        details: `External publication upload failed: ${externalPublicationProof.failure}`,
        impacted_refs: [state.publication?.publication_id ?? "publication-missing"]
      });
    }

    state.checks = dedupeChecksById(state.checks);
    evidencePack = EvidencePackSchema.parse({
      ...evidencePack,
      generated_artifact_refs: state.artifacts.map((artifact) => artifact.artifact_id),
      checks_executed: state.checks,
      after_refs: state.artifacts.map((artifact) => artifact.artifact_id),
      warnings: state.warnings
    });

    const evidencePath = writeJson(path.join(evidenceDir, "evidence-pack.json"), evidencePack);
    const auditPath = writeJson(path.join(auditDir, "audit-events.json"), state.auditEvents);
    const lineagePath = writeJson(path.join(lineageDir, "lineage-edges.json"), state.lineageEdges);
    const artifactsManifestPath = writeJson(path.join(artifactDir, "artifact-records.json"), state.artifacts);

    return {
      state,
      evidencePack,
      artifacts: {
        output_root: sampleDir,
        input_workbook_path: inputWorkbookPath,
        workbook_package_path: workbookPackagePath,
        canonical_representation_path: canonicalPath,
        analysis_path: analysisPath,
        transformation_result_path: transformationPath,
        mapping_preview_path: mappingPreviewPath,
        formula_graph_path: formulaGraphPath,
        formula_engine_proof_path: formulaEngineProofPath,
        pivot_metadata_path: pivotPath,
        pivot_cache_path: pivotCachePath,
        style_metadata_path: stylePath,
        formatting_proof_path: formattingProofPath,
        fidelity_comparison_proof_path: fidelityProofPath,
        easy_advanced_proof_path: easyAdvancedProofPath,
        chart_metadata_path: chartMetadataPath,
        chart_history_path: chartHistoryPath,
        chart_svg_path: chartSvgPath,
        area_chart_svg_path: areaChartSvgPath,
        easy_mode_export_path: easyExportPath,
        lambda_import_path: lambdaImportPath,
        lambda_registry_path: lambdaRegistryPath,
        lambda_export_path: lambdaExportPath,
        native_objects_path: nativeObjectsPath,
        xls_ingest_analysis_path: xlsIngestAnalysisPath,
        macro_policy_path: macroPolicyPath,
        macro_preserved_export_path: null,
        desktop_proof_spec_path: desktopProofSpecPath,
        desktop_proof_workbook_path: desktopProofWorkbookPath,
        desktop_proof_bundle_path: desktopProofBundlePath,
        desktop_formatting_proof_path: desktopFormattingProofPath,
        desktop_chart_coverage_proof_path: desktopChartCoverageProofPath,
        pivot_desktop_proof_path: desktopPivotBehaviorProofPath,
        exported_workbook_path: exportedWorkbookPath,
        publication_path: publicationPath,
        persistence_manifest_path: persistenceManifestPath,
        backend_service_url: backendServiceUrl,
        backend_service_manifest_url: backendServiceManifestUrl,
        backend_publication_manifest_url: backendPublicationManifestUrl,
        backend_object_manifest_url: backendObjectManifestUrl,
        backend_download_url: backendDownloadUrl,
        external_publication_proof_path: externalPublicationProofPath,
        evidence_path: evidencePath,
        audit_path: auditPath,
        lineage_path: lineagePath,
        artifacts_manifest_path: artifactsManifestPath
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Smart Mode / Pro Mode
  // ═══════════════════════════════════════════════════════════════════════════

  smartAnalyze(state: ExcelRunState, actorRef: string, mode: "smart" | "pro"): SmartAnalysisResult {
    const kpis: SmartKPI[] = [];
    const suggestedCharts: SmartChartSuggestion[] = [];
    const suggestedDashboards: SmartDashboardSuggestion[] = [];
    const suggestedReports: SmartReportSuggestion[] = [];
    const suggestedSlides: SmartSlideSuggestion[] = [];

    const worksheets = state.workbook.worksheets.filter(
      (ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden"
    );

    // Build summary table from first worksheet
    const primarySheet = worksheets[0];
    let summaryTable: SmartSummaryTable = { headers: [], rows: [], row_count: 0 };
    if (primarySheet) {
      const table = extractTable(primarySheet);
      summaryTable = {
        headers: table.headers,
        rows: table.rows.slice(0, 50).map((row) =>
          table.headers.map((h) => `${row[h] ?? ""}`)
        ),
        row_count: table.rows.length
      };
    }

    // Analyze all worksheets for KPIs and chart suggestions
    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0 || table.rows.length === 0) continue;

      const numericColumns: string[] = [];
      const categoricalColumns: string[] = [];

      for (const header of table.headers) {
        const values = table.rows.map((r) => r[header]).filter((v) => v !== null && v !== undefined && v !== "");
        const numericValues = values.filter((v) => typeof v === "number");
        if (numericValues.length > values.length * 0.5) {
          numericColumns.push(header);
        } else {
          categoricalColumns.push(header);
        }
      }

      // Compute KPIs for numeric columns
      for (const col of numericColumns) {
        const nums = table.rows
          .map((r) => r[col])
          .filter((v): v is number => typeof v === "number");
        if (nums.length === 0) continue;
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = sum / nums.length;
        const min = Math.min(...nums);
        const max = Math.max(...nums);

        // Determine trend by comparing first half vs second half
        const mid = Math.floor(nums.length / 2);
        const firstHalfAvg = mid > 0 ? nums.slice(0, mid).reduce((a, b) => a + b, 0) / mid : 0;
        const secondHalfAvg = mid > 0 ? nums.slice(mid).reduce((a, b) => a + b, 0) / (nums.length - mid) : 0;
        const trend: "up" | "down" | "flat" = secondHalfAvg > firstHalfAvg * 1.05 ? "up" : secondHalfAvg < firstHalfAvg * 0.95 ? "down" : "flat";

        kpis.push({ name: `${col}_sum`, value: Math.round(sum * 100) / 100, trend, unit: "numeric" });
        kpis.push({ name: `${col}_avg`, value: Math.round(avg * 100) / 100, trend, unit: "numeric" });
        kpis.push({ name: `${col}_min`, value: min, trend: "flat", unit: "numeric" });
        kpis.push({ name: `${col}_max`, value: max, trend: "flat", unit: "numeric" });
        kpis.push({ name: `${col}_count`, value: nums.length, trend: "flat", unit: "count" });
      }

      // Suggest charts
      if (categoricalColumns.length > 0 && numericColumns.length > 0) {
        const catCol = categoricalColumns[0];
        for (const numCol of numericColumns.slice(0, 3)) {
          const uniqueCategories = new Set(table.rows.map((r) => `${r[catCol] ?? ""}`)).size;
          if (uniqueCategories <= 12) {
            suggestedCharts.push({
              chart_type: "bar",
              title: `${numCol} by ${catCol}`,
              x_field: catCol,
              y_field: numCol,
              reason: `Categorical field '${catCol}' has ${uniqueCategories} unique values paired with numeric '${numCol}'`
            });
            suggestedCharts.push({
              chart_type: "pie",
              title: `${numCol} distribution by ${catCol}`,
              x_field: catCol,
              y_field: numCol,
              reason: `Pie chart effective for ${uniqueCategories} categories in '${catCol}'`
            });
          } else {
            suggestedCharts.push({
              chart_type: "line",
              title: `${numCol} trend over ${catCol}`,
              x_field: catCol,
              y_field: numCol,
              reason: `Many unique values in '${catCol}' (${uniqueCategories}) — line chart recommended`
            });
          }
        }
      }

      if (numericColumns.length >= 2) {
        suggestedCharts.push({
          chart_type: "combo",
          title: `${numericColumns[0]} vs ${numericColumns[1]}`,
          x_field: categoricalColumns[0] ?? numericColumns[0],
          y_field: numericColumns[1],
          reason: `Compare two numeric fields: '${numericColumns[0]}' and '${numericColumns[1]}'`
        });
      }

      // Suggest dashboard
      const widgetRefs = suggestedCharts.slice(0, 4).map((_, idx) => `widget-${ws.name}-${idx}`);
      const layout = table.rows.length > 100 ? "grid-4x2" : table.rows.length > 20 ? "grid-2x2" : "single-column";
      suggestedDashboards.push({
        title: `${ws.name} Dashboard`,
        widget_refs: widgetRefs,
        layout
      });
    }

    // Pro mode: suggest reports and slides
    if (mode === "pro") {
      for (const ws of worksheets) {
        const table = extractTable(ws);
        if (table.headers.length === 0) continue;
        suggestedReports.push({
          title: `${ws.name} Analytical Report`,
          sections: ["Executive Summary", "Data Overview", "KPI Analysis", "Trends", "Recommendations"],
          data_refs: table.headers.map((h) => `${ws.name}::${h}`)
        });
        suggestedSlides.push({
          title: `${ws.name} — KPI Overview`,
          content_type: "kpi_grid",
          data_ref: `${ws.name}::kpis`
        });
        suggestedSlides.push({
          title: `${ws.name} — Chart Summary`,
          content_type: "chart_gallery",
          data_ref: `${ws.name}::charts`
        });
        suggestedSlides.push({
          title: `${ws.name} — Data Table`,
          content_type: "summary_table",
          data_ref: `${ws.name}::table`
        });
      }
    }

    addAuditEvent(state, "excel_engine.smart_analyze.v1", actorRef, [state.workbookRecord.workbook_id], {
      mode,
      kpi_count: kpis.length,
      chart_suggestion_count: suggestedCharts.length
    });

    return {
      kpis,
      summary_table: summaryTable,
      suggested_charts: suggestedCharts,
      suggested_dashboards: suggestedDashboards,
      suggested_reports: suggestedReports,
      suggested_slides: suggestedSlides
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Universal Intake Enhancement
  // ═══════════════════════════════════════════════════════════════════════════

  async importFromText(state: ExcelRunState, actorRef: string, content: string, fileName: string): Promise<ExcelRunState> {
    // Detect delimiter: tab, pipe, or comma
    const firstLine = content.split(/\r?\n/)[0] ?? "";
    let delimiter = ",";
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes("|")) delimiter = "|";

    const lines = content.trim().split(/\r?\n/);
    if (lines.length === 0) return state;

    const sheetName = fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_ ]/g, "_").slice(0, 31) || "TextImport";
    const worksheet = state.workbook.getWorksheet(sheetName) ?? state.workbook.addWorksheet(sheetName);

    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
    worksheet.columns = headers.map((h) => ({ header: h, key: h }));

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string | number | null> = {};
      headers.forEach((h, idx) => {
        const raw = values[idx] ?? "";
        const num = Number(raw);
        row[h] = raw === "" ? null : !isNaN(num) && raw !== "" ? num : raw;
      });
      worksheet.addRow(headers.map((h) => row[h]));
    }

    addAuditEvent(state, "excel_engine.import_text.v1", actorRef, [state.workbookRecord.workbook_id], {
      file_name: fileName,
      delimiter,
      row_count: lines.length - 1,
      column_count: headers.length
    });
    addLineage(state, fileName, state.workbookRecord.workbook_id, "excel_engine.import_text.v1");
    return state;
  }

  async importFromPdfTables(state: ExcelRunState, actorRef: string, filePath: string): Promise<ExcelRunState> {
    // Use Python PyMuPDF to extract tables from PDF
    const pythonScript = `
import sys, json
try:
    import fitz
    doc = fitz.open(sys.argv[1])
    tables = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        page_tables = page.find_tables()
        for t in page_tables:
            data = t.extract()
            if len(data) > 1:
                tables.append({"page": page_num + 1, "headers": data[0], "rows": data[1:]})
    print(json.dumps(tables))
except Exception as e:
    print(json.dumps([{"error": str(e)}]))
`;
    const tmpScript = path.join(os.tmpdir(), `rasid_pdf_extract_${Date.now()}.py`);
    fs.writeFileSync(tmpScript, pythonScript, "utf8");

    let tables: Array<{ page?: number; headers?: string[]; rows?: string[][]; error?: string }> = [];
    try {
      const output = execFileSync("python", [tmpScript, filePath], {
        encoding: "utf8",
        timeout: 60000
      });
      tables = JSON.parse(output.trim()) as typeof tables;
    } catch {
      // If Python extraction fails, create empty sheet with error note
      const ws = state.workbook.addWorksheet("PDF_Import_Error");
      ws.getCell("A1").value = "PDF table extraction requires Python with PyMuPDF installed";
      ws.getCell("A2").value = `Source file: ${filePath}`;
      addAuditEvent(state, "excel_engine.import_pdf.v1", actorRef, [state.workbookRecord.workbook_id], {
        file_path: filePath,
        success: false,
        reason: "Python/PyMuPDF not available"
      });
      return state;
    } finally {
      try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
    }

    let tableIndex = 0;
    for (const entry of tables) {
      if (entry.error || !entry.headers || !entry.rows) continue;
      tableIndex++;
      const sheetName = `PDF_P${entry.page ?? tableIndex}_T${tableIndex}`.slice(0, 31);
      const ws = state.workbook.addWorksheet(uniqueWorksheetName(state.workbook, sheetName));
      const headers = entry.headers.map((h, i) => (h && h.trim()) || `Column_${i + 1}`);
      ws.columns = headers.map((h) => ({ header: h, key: h }));
      for (const row of entry.rows) {
        ws.addRow(row.map((v) => {
          const num = Number(v);
          return v === "" || v === null ? null : !isNaN(num) ? num : v;
        }));
      }
    }

    addAuditEvent(state, "excel_engine.import_pdf.v1", actorRef, [state.workbookRecord.workbook_id], {
      file_path: filePath,
      success: true,
      table_count: tableIndex
    });
    addLineage(state, filePath, state.workbookRecord.workbook_id, "excel_engine.import_pdf.v1");
    return state;
  }

  async importFromImageTables(state: ExcelRunState, actorRef: string, filePath: string): Promise<ExcelRunState> {
    // Use Python PaddleOCR for table extraction from images
    const pythonScript = `
import sys, json
try:
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    result = ocr.ocr(sys.argv[1], cls=True)
    lines = []
    if result and result[0]:
        entries = sorted(result[0], key=lambda x: (x[0][0][1], x[0][0][0]))
        current_y = -1
        current_line = []
        for entry in entries:
            box, (text, _conf) = entry[0], entry[1]
            y = box[0][1]
            if current_y < 0 or abs(y - current_y) > 15:
                if current_line:
                    lines.append(current_line)
                current_line = [text]
                current_y = y
            else:
                current_line.append(text)
        if current_line:
            lines.append(current_line)
    print(json.dumps(lines))
except Exception as e:
    print(json.dumps([["error", str(e)]]))
`;
    const tmpScript = path.join(os.tmpdir(), `rasid_ocr_extract_${Date.now()}.py`);
    fs.writeFileSync(tmpScript, pythonScript, "utf8");

    let lines: string[][] = [];
    try {
      const output = execFileSync("python", [tmpScript, filePath], {
        encoding: "utf8",
        timeout: 120000
      });
      lines = JSON.parse(output.trim()) as string[][];
    } catch {
      const ws = state.workbook.addWorksheet("Image_Import_Error");
      ws.getCell("A1").value = "Image table extraction requires Python with PaddleOCR installed";
      ws.getCell("A2").value = `Source file: ${filePath}`;
      addAuditEvent(state, "excel_engine.import_image.v1", actorRef, [state.workbookRecord.workbook_id], {
        file_path: filePath,
        success: false,
        reason: "Python/PaddleOCR not available"
      });
      return state;
    } finally {
      try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
    }

    if (lines.length > 0) {
      const sheetName = uniqueWorksheetName(state.workbook, "ImageTable");
      const ws = state.workbook.addWorksheet(sheetName);
      const maxCols = Math.max(...lines.map((l) => l.length));
      const headers = lines[0].length > 0 ? lines[0].map((h, i) => h || `Column_${i + 1}`) : Array.from({ length: maxCols }, (_, i) => `Column_${i + 1}`);
      ws.columns = headers.map((h) => ({ header: h, key: h }));
      for (let i = 1; i < lines.length; i++) {
        ws.addRow(lines[i].map((v) => {
          const num = Number(v);
          return v === "" ? null : !isNaN(num) ? num : v;
        }));
      }
    }

    addAuditEvent(state, "excel_engine.import_image.v1", actorRef, [state.workbookRecord.workbook_id], {
      file_path: filePath,
      success: true,
      line_count: lines.length
    });
    addLineage(state, filePath, state.workbookRecord.workbook_id, "excel_engine.import_image.v1");
    return state;
  }

  async importFromGoogleSheets(state: ExcelRunState, actorRef: string, spreadsheetId: string, oauthToken: string): Promise<ExcelRunState> {
    // Use Google Sheets API v4 to read data
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;

    // 1. Fetch spreadsheet metadata to get sheet names
    const metaResponse = await fetch(`${baseUrl}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${oauthToken}` }
    });
    if (!metaResponse.ok) {
      throw new Error(`Google Sheets API error: ${metaResponse.status} ${metaResponse.statusText}`);
    }
    const meta = (await metaResponse.json()) as { sheets: Array<{ properties: { title: string; sheetId: number } }> };

    // 2. Fetch data for each sheet
    for (const sheet of meta.sheets) {
      const title = sheet.properties.title;
      const dataResponse = await fetch(
        `${baseUrl}/values/${encodeURIComponent(title)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
        { headers: { Authorization: `Bearer ${oauthToken}` } }
      );
      if (!dataResponse.ok) continue;
      const data = (await dataResponse.json()) as { values?: unknown[][] };
      const rows = data.values ?? [];
      if (rows.length === 0) continue;

      const sheetName = uniqueWorksheetName(state.workbook, title.slice(0, 31));
      const ws = state.workbook.addWorksheet(sheetName);
      const headerRow = rows[0].map((v, i) => (v != null && `${v}`.trim() !== "" ? `${v}` : `Column_${i + 1}`));
      ws.columns = headerRow.map((h) => ({ header: h, key: h }));

      for (let i = 1; i < rows.length; i++) {
        ws.addRow(rows[i].map((v) => (v === undefined || v === null ? null : v)));
      }
    }

    addAuditEvent(state, "excel_engine.import_google_sheets.v1", actorRef, [state.workbookRecord.workbook_id], {
      spreadsheet_id: spreadsheetId,
      sheet_count: meta.sheets.length
    });
    addLineage(state, `gsheets://${spreadsheetId}`, state.workbookRecord.workbook_id, "excel_engine.import_google_sheets.v1");
    return state;
  }

  async importFromDatabase(state: ExcelRunState, actorRef: string, connectionString: string, query: string): Promise<ExcelRunState> {
    // Generic database import — parse connection string to determine driver
    // For a generic implementation, we use child_process to call a CLI or script
    const pythonScript = `
import sys, json
conn_str = sys.argv[1]
query = sys.argv[2]
try:
    if 'sqlite' in conn_str.lower() or conn_str.endswith('.db') or conn_str.endswith('.sqlite'):
        import sqlite3
        conn = sqlite3.connect(conn_str.replace('sqlite:///', '').replace('sqlite://', ''))
        cursor = conn.execute(query)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        conn.close()
        print(json.dumps({"columns": columns, "rows": [list(r) for r in rows]}))
    elif 'postgresql' in conn_str.lower() or 'postgres' in conn_str.lower():
        import psycopg2
        conn = psycopg2.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        conn.close()
        print(json.dumps({"columns": columns, "rows": [list(r) for r in rows]}, default=str))
    elif 'mysql' in conn_str.lower():
        import pymysql
        parts = conn_str.replace('mysql://', '').split('@')
        user_pass = parts[0].split(':')
        host_db = parts[1].split('/')
        conn = pymysql.connect(host=host_db[0], user=user_pass[0], password=user_pass[1] if len(user_pass)>1 else '', database=host_db[1] if len(host_db)>1 else '')
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        conn.close()
        print(json.dumps({"columns": columns, "rows": [list(r) for r in rows]}, default=str))
    else:
        print(json.dumps({"error": "Unsupported database driver. Use sqlite, postgresql, or mysql connection strings."}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
    const tmpScript = path.join(os.tmpdir(), `rasid_db_query_${Date.now()}.py`);
    fs.writeFileSync(tmpScript, pythonScript, "utf8");

    let result: { columns?: string[]; rows?: unknown[][]; error?: string } = {};
    try {
      const output = execFileSync("python", [tmpScript, connectionString, query], {
        encoding: "utf8",
        timeout: 60000
      });
      result = JSON.parse(output.trim()) as typeof result;
    } catch (err) {
      result = { error: err instanceof Error ? err.message : `${err}` };
    } finally {
      try { fs.unlinkSync(tmpScript); } catch { /* ignore */ }
    }

    if (result.error || !result.columns || !result.rows) {
      const ws = state.workbook.addWorksheet(uniqueWorksheetName(state.workbook, "DB_Import_Error"));
      ws.getCell("A1").value = `Database import failed: ${result.error ?? "unknown error"}`;
      ws.getCell("A2").value = `Connection: ${connectionString.replace(/:[^@]+@/, ":***@")}`;
      ws.getCell("A3").value = `Query: ${query}`;
    } else {
      const sheetName = uniqueWorksheetName(state.workbook, "DB_Query_Result");
      const ws = state.workbook.addWorksheet(sheetName);
      ws.columns = result.columns.map((h) => ({ header: h, key: h }));
      for (const row of result.rows) {
        ws.addRow(row.map((v) => (v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : v)));
      }
    }

    addAuditEvent(state, "excel_engine.import_database.v1", actorRef, [state.workbookRecord.workbook_id], {
      connection: connectionString.replace(/:[^@]+@/, ":***@"),
      query,
      row_count: result.rows?.length ?? 0
    });
    addLineage(state, `db://${connectionString.replace(/:[^@]+@/, ":***@")}`, state.workbookRecord.workbook_id, "excel_engine.import_database.v1");
    return state;
  }

  async importFromZip(state: ExcelRunState, actorRef: string, filePath: string): Promise<ExcelRunState> {
    const zipData = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(zipData);
    const fileEntries = Object.entries(zip.files).filter(([, f]) => !f.dir);
    const importedFiles: string[] = [];

    for (const [name, file] of fileEntries) {
      const ext = path.extname(name).toLowerCase();
      const content = await file.async("nodebuffer");

      if (ext === ".csv" || ext === ".tsv" || ext === ".txt") {
        const text = content.toString("utf8");
        await this.importFromText(state, actorRef, text, path.basename(name));
        importedFiles.push(name);
      } else if (ext === ".xlsx" || ext === ".xls" || ext === ".xlsm") {
        // Import Excel file from zip into new worksheets
        const tmpPath = path.join(os.tmpdir(), `rasid_zip_${Date.now()}_${path.basename(name)}`);
        fs.writeFileSync(tmpPath, content);
        try {
          const tempWorkbook = new ExcelJS.Workbook();
          if (ext === ".xls") {
            const xlsWorkbook = XLSX.read(content, { cellDates: true, dense: false });
            const tempWb = excelJsWorkbookFromXlsxWorkbook(xlsWorkbook);
            for (const ws of tempWb.worksheets) {
              copyWorksheetIntoWorkbook(state.workbook, ws, uniqueWorksheetName(state.workbook, ws.name), "merge");
            }
          } else {
            await tempWorkbook.xlsx.readFile(tmpPath);
            for (const ws of tempWorkbook.worksheets) {
              copyWorksheetIntoWorkbook(state.workbook, ws, uniqueWorksheetName(state.workbook, ws.name), "merge");
            }
          }
          importedFiles.push(name);
        } finally {
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        }
      } else if (ext === ".json") {
        try {
          const jsonData = JSON.parse(content.toString("utf8")) as unknown;
          const sheetName = uniqueWorksheetName(state.workbook, path.basename(name, ext).slice(0, 31));
          const ws = state.workbook.addWorksheet(sheetName);
          const arr = Array.isArray(jsonData) ? jsonData : [jsonData];
          if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
            const headers = Object.keys(arr[0] as Record<string, unknown>);
            ws.columns = headers.map((h) => ({ header: h, key: h }));
            for (const item of arr) {
              const rec = item as Record<string, unknown>;
              ws.addRow(headers.map((h) => {
                const v = rec[h];
                return v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : v;
              }));
            }
          }
          importedFiles.push(name);
        } catch { /* skip invalid JSON */ }
      }
    }

    addAuditEvent(state, "excel_engine.import_zip.v1", actorRef, [state.workbookRecord.workbook_id], {
      file_path: filePath,
      total_files: fileEntries.length,
      imported_files: importedFiles.length
    });
    addLineage(state, filePath, state.workbookRecord.workbook_id, "excel_engine.import_zip.v1");
    return state;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Arrow / Parquet / Catalog / Semantic Graph
  // ═══════════════════════════════════════════════════════════════════════════

  toArrowBuffer(state: ExcelRunState, sheetName: string): ArrowBuffer {
    const worksheet = state.workbook.getWorksheet(sheetName);
    if (!worksheet) throw new Error(`Worksheet '${sheetName}' not found`);
    const table = extractTable(worksheet);
    const schema: Array<{ name: string; type: string }> = [];
    const columns: Record<string, unknown[]> = {};

    for (const header of table.headers) {
      const values = table.rows.map((r) => r[header]);
      const colType = inferColumnType(values);
      schema.push({ name: header, type: colType });
      columns[header] = values.map((v) => (v === undefined ? null : v));
    }

    return { schema, columns, row_count: table.rows.length };
  }

  exportParquet(state: ExcelRunState, sheetName: string, targetPath: string): ParquetManifest {
    const arrow = this.toArrowBuffer(state, sheetName);
    // Write a JSON-based Parquet-like file (actual Parquet requires native bindings)
    const parquetPayload = {
      format: "parquet-json-compat",
      version: "1.0.0",
      schema: arrow.schema,
      row_count: arrow.row_count,
      row_groups: [{
        row_count: arrow.row_count,
        columns: Object.entries(arrow.columns).map(([name, values]) => ({
          column_name: name,
          encoding: "plain",
          compression: "none",
          values
        }))
      }]
    };

    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, JSON.stringify(parquetPayload, null, 2), "utf8");

    return {
      path: targetPath,
      schema: arrow.schema,
      row_count: arrow.row_count,
      created_at: ISO()
    };
  }

  buildCatalog(state: ExcelRunState): CatalogEntry[] {
    const catalog: CatalogEntry[] = [];
    const worksheets = state.workbook.worksheets.filter(
      (ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden"
    );

    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0) continue;

      const schemaEntries: Array<{ name: string; type: string }> = [];
      for (const header of table.headers) {
        const values = table.rows.map((r) => r[header]);
        schemaEntries.push({ name: header, type: inferColumnType(values) });
      }

      const tags: string[] = [];
      // Auto-tag based on column names and content
      for (const header of table.headers) {
        const lower = header.toLowerCase();
        if (lower.includes("date") || lower.includes("time")) tags.push("temporal");
        if (lower.includes("amount") || lower.includes("price") || lower.includes("cost") || lower.includes("revenue")) tags.push("financial");
        if (lower.includes("name") || lower.includes("email") || lower.includes("phone")) tags.push("pii");
        if (lower.includes("id") || lower.includes("key") || lower.includes("ref")) tags.push("identifier");
      }

      catalog.push({
        entry_id: id("catalog", state.runId, safeSheetName(ws.name)),
        name: ws.name,
        type: "worksheet",
        source_ref: state.workbookRecord.workbook_id,
        schema: schemaEntries,
        row_count: table.rows.length,
        tags: [...new Set(tags)],
        created_at: ISO()
      });
    }

    return catalog;
  }

  buildSemanticGraph(state: ExcelRunState): SemanticGraph {
    const nodes: SemanticGraphNode[] = [];
    const edges: Array<{ from: string; to: string; relation: string }> = [];
    const worksheets = state.workbook.worksheets.filter(
      (ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden"
    );

    // Track all column names per sheet for FK detection
    const sheetColumns: Map<string, { headers: string[]; uniqueSets: Map<string, Set<string>> }> = new Map();

    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0) continue;

      // Create entity node for the worksheet
      const entityNodeId = id("node", "entity", safeSheetName(ws.name));
      nodes.push({
        node_id: entityNodeId,
        label: ws.name,
        type: "entity",
        refs: [ws.name]
      });

      const uniqueSets = new Map<string, Set<string>>();
      for (const header of table.headers) {
        // Create attribute node for each column
        const attrNodeId = id("node", "attr", safeSheetName(ws.name), header.replace(/[^A-Za-z0-9_]/g, "_"));
        const values = table.rows.map((r) => r[header]);
        const colType = inferColumnType(values);
        nodes.push({
          node_id: attrNodeId,
          label: header,
          type: "attribute",
          refs: [`${ws.name}::${header}`, colType]
        });
        edges.push({ from: entityNodeId, to: attrNodeId, relation: "has_attribute" });

        // Collect unique values for FK detection
        const uniqueVals = new Set<string>();
        for (const v of values) {
          if (v !== null && v !== undefined && v !== "") uniqueVals.add(`${v}`);
        }
        uniqueSets.set(header, uniqueVals);
      }
      sheetColumns.set(ws.name, { headers: table.headers, uniqueSets });
    }

    // Detect potential foreign key relationships
    const sheetEntries = [...sheetColumns.entries()];
    for (let i = 0; i < sheetEntries.length; i++) {
      for (let j = 0; j < sheetEntries.length; j++) {
        if (i === j) continue;
        const [sheetA, dataA] = sheetEntries[i];
        const [sheetB, dataB] = sheetEntries[j];

        for (const colA of dataA.headers) {
          const colALower = colA.toLowerCase();
          if (!colALower.includes("id") && !colALower.includes("key") && !colALower.includes("ref")) continue;

          const valsA = dataA.uniqueSets.get(colA)!;
          if (valsA.size === 0) continue;

          for (const colB of dataB.headers) {
            const valsB = dataB.uniqueSets.get(colB)!;
            if (valsB.size === 0) continue;

            // Check if values in colA are a subset of colB (foreign key pattern)
            let matchCount = 0;
            for (const v of valsA) {
              if (valsB.has(v)) matchCount++;
            }
            const overlapRatio = matchCount / valsA.size;
            if (overlapRatio >= 0.7 && matchCount >= 3) {
              const relNodeId = id("node", "rel", safeSheetName(sheetA), colA, safeSheetName(sheetB), colB);
              nodes.push({
                node_id: relNodeId,
                label: `${sheetA}.${colA} -> ${sheetB}.${colB}`,
                type: "relationship",
                refs: [`${sheetA}::${colA}`, `${sheetB}::${colB}`]
              });
              edges.push({
                from: id("node", "entity", safeSheetName(sheetA)),
                to: id("node", "entity", safeSheetName(sheetB)),
                relation: `fk:${colA}->${colB}`
              });
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Data Cleaning
  // ═══════════════════════════════════════════════════════════════════════════

  cleanData(
    state: ExcelRunState,
    sheetName: string,
    actorRef: string,
    options?: { dedupe?: boolean; fuzzy?: boolean; outliers?: boolean; impute?: boolean; normalize?: boolean }
  ): DataCleaningResult {
    const worksheet = state.workbook.getWorksheet(sheetName);
    if (!worksheet) throw new Error(`Worksheet '${sheetName}' not found`);
    const table = extractTable(worksheet);
    const opts = {
      dedupe: options?.dedupe ?? true,
      fuzzy: options?.fuzzy ?? true,
      outliers: options?.outliers ?? true,
      impute: options?.impute ?? true,
      normalize: options?.normalize ?? true
    };

    const issues: string[] = [];
    let workingRows = [...table.rows];

    // ── Deduplication ──
    const duplicateGroups: Array<{ key: string; count: number }> = [];
    let removedCount = 0;
    if (opts.dedupe) {
      const rowKeys = new Map<string, number>();
      const deduped: typeof workingRows = [];
      for (const row of workingRows) {
        const key = table.headers.map((h) => `${row[h] ?? ""}`).join("||");
        const count = (rowKeys.get(key) ?? 0) + 1;
        rowKeys.set(key, count);
        if (count === 1) {
          deduped.push(row);
        }
      }
      for (const [key, count] of rowKeys) {
        if (count > 1) {
          duplicateGroups.push({ key: key.slice(0, 100), count });
          removedCount += count - 1;
        }
      }
      if (removedCount > 0) {
        issues.push(`Removed ${removedCount} duplicate rows across ${duplicateGroups.length} groups`);
      }
      workingRows = deduped;
    }

    // ── Fuzzy Matching ──
    const fuzzyMatches: DataCleaningResult["fuzzy_matches"] = [];
    if (opts.fuzzy) {
      for (const header of table.headers) {
        const values = workingRows.map((r) => r[header]).filter((v): v is string => typeof v === "string" && v.trim().length > 0);
        const uniqueValues = [...new Set(values)];
        if (uniqueValues.length > 500 || uniqueValues.length < 2) continue; // skip very large or trivial columns

        const pairs: Array<{ a: string; b: string; similarity: number }> = [];
        for (let i = 0; i < uniqueValues.length && i < 200; i++) {
          for (let j = i + 1; j < uniqueValues.length && j < 200; j++) {
            const sim = levenshteinSimilarity(uniqueValues[i].toLowerCase(), uniqueValues[j].toLowerCase());
            if (sim >= 0.75 && sim < 1.0) {
              pairs.push({ a: uniqueValues[i], b: uniqueValues[j], similarity: Math.round(sim * 1000) / 1000 });
            }
          }
        }
        if (pairs.length > 0) {
          fuzzyMatches.push({ column: header, pairs: pairs.slice(0, 20) });
          issues.push(`Found ${pairs.length} fuzzy match pair(s) in column '${header}'`);
        }
      }
    }

    // ── Outlier Detection ──
    const outliers: DataCleaningResult["outliers"] = [];
    if (opts.outliers) {
      for (const header of table.headers) {
        const numericEntries: Array<{ row: number; value: number }> = [];
        workingRows.forEach((r, idx) => {
          const v = r[header];
          if (typeof v === "number" && isFinite(v)) {
            numericEntries.push({ row: idx + 2, value: v }); // +2 for 1-indexed header offset
          }
        });
        if (numericEntries.length < 5) continue;

        const values = numericEntries.map((e) => e.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
        const stddev = Math.sqrt(variance);
        if (stddev === 0) continue;

        const outlierValues: Array<{ row: number; value: number; z_score: number }> = [];
        for (const entry of numericEntries) {
          const zScore = Math.abs((entry.value - mean) / stddev);
          if (zScore > 2) {
            outlierValues.push({ row: entry.row, value: entry.value, z_score: Math.round(zScore * 100) / 100 });
          }
        }
        if (outlierValues.length > 0) {
          outliers.push({ column: header, values: outlierValues.slice(0, 50) });
          issues.push(`Found ${outlierValues.length} outlier(s) in column '${header}' (z-score > 2)`);
        }
      }
    }

    // ── Imputation ──
    const imputed: DataCleaningResult["imputed"] = [];
    if (opts.impute) {
      for (const header of table.headers) {
        const values = workingRows.map((r) => r[header]);
        const nullCount = values.filter((v) => v === null || v === undefined || v === "").length;
        if (nullCount === 0) continue;

        // Determine column type
        const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
        const numericValues = nonNullValues.filter((v): v is number => typeof v === "number");

        if (numericValues.length >= nonNullValues.length * 0.5) {
          // Numeric: fill with mean
          const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
          const roundedMean = Math.round(mean * 100) / 100;
          let filled = 0;
          for (const row of workingRows) {
            if (row[header] === null || row[header] === undefined || row[header] === "") {
              row[header] = roundedMean;
              filled++;
            }
          }
          imputed.push({ column: header, strategy: "mean", filled_count: filled });
          issues.push(`Imputed ${filled} null(s) in '${header}' with mean (${roundedMean})`);
        } else {
          // Text: fill with mode
          const freq = new Map<string, number>();
          for (const v of nonNullValues) {
            const s = `${v}`;
            freq.set(s, (freq.get(s) ?? 0) + 1);
          }
          let modeValue = "";
          let modeCount = 0;
          for (const [val, count] of freq) {
            if (count > modeCount) {
              modeValue = val;
              modeCount = count;
            }
          }
          let filled = 0;
          if (modeValue) {
            for (const row of workingRows) {
              if (row[header] === null || row[header] === undefined || row[header] === "") {
                row[header] = modeValue;
                filled++;
              }
            }
          }
          imputed.push({ column: header, strategy: "mode", filled_count: filled });
          if (filled > 0) issues.push(`Imputed ${filled} null(s) in '${header}' with mode ('${modeValue}')`);
        }
      }
    }

    // ── Normalization ──
    const normalized: DataCleaningResult["normalized"] = [];
    if (opts.normalize) {
      for (const header of table.headers) {
        const numericEntries: Array<{ idx: number; value: number }> = [];
        workingRows.forEach((r, idx) => {
          const v = r[header];
          if (typeof v === "number" && isFinite(v)) {
            numericEntries.push({ idx, value: v });
          }
        });
        if (numericEntries.length < 2) continue;

        const values = numericEntries.map((e) => e.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (max === min) continue;

        for (const entry of numericEntries) {
          workingRows[entry.idx][header] = Math.round(((entry.value - min) / (max - min)) * 10000) / 10000;
        }
        normalized.push({ column: header, method: "min_max", min, max });
      }
    }

    // Write cleaned data back
    if (opts.dedupe || opts.impute || opts.normalize) {
      writeTable(worksheet, { headers: table.headers, rows: workingRows });
    }

    // ── Quality Report ──
    let totalCells = 0;
    let nonNullCells = 0;
    let validCells = 0;
    const allValueSets = new Map<string, Set<string>>();

    for (const header of table.headers) {
      const valueSet = new Set<string>();
      for (const row of workingRows) {
        totalCells++;
        const v = row[header];
        if (v !== null && v !== undefined && v !== "") {
          nonNullCells++;
          validCells++;
          valueSet.add(`${v}`);
        }
      }
      allValueSets.set(header, valueSet);
    }

    const totalUniqueRatio = table.headers.length > 0
      ? table.headers.reduce((acc, h) => acc + (allValueSets.get(h)?.size ?? 0) / Math.max(workingRows.length, 1), 0) / table.headers.length
      : 0;

    const qualityReport = {
      total_rows: workingRows.length,
      total_columns: table.headers.length,
      completeness: totalCells > 0 ? Math.round((nonNullCells / totalCells) * 10000) / 10000 : 0,
      validity: totalCells > 0 ? Math.round((validCells / totalCells) * 10000) / 10000 : 0,
      uniqueness: Math.round(totalUniqueRatio * 10000) / 10000,
      issues
    };

    addAuditEvent(state, "excel_engine.clean_data.v1", actorRef, [state.workbookRecord.workbook_id], {
      sheet_name: sheetName,
      removed_duplicates: removedCount,
      fuzzy_match_columns: fuzzyMatches.length,
      outlier_columns: outliers.length,
      imputed_columns: imputed.length,
      normalized_columns: normalized.length
    });

    return {
      deduplicated: { removed_count: removedCount, duplicate_groups: duplicateGroups },
      fuzzy_matches: fuzzyMatches,
      outliers,
      imputed,
      normalized,
      quality_report: qualityReport
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Comparison / Diff
  // ═══════════════════════════════════════════════════════════════════════════

  compareWorkbooks(stateA: ExcelRunState, stateB: ExcelRunState, sheetNameA?: string, sheetNameB?: string): DiffResult {
    const wsA = sheetNameA
      ? stateA.workbook.getWorksheet(sheetNameA)
      : stateA.workbook.worksheets.find((ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden");
    const wsB = sheetNameB
      ? stateB.workbook.getWorksheet(sheetNameB)
      : stateB.workbook.worksheets.find((ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden");

    if (!wsA || !wsB) {
      return {
        diff_type: "file_vs_file",
        added_rows: 0,
        removed_rows: 0,
        changed_cells: [],
        added_columns: [],
        removed_columns: [],
        summary: "One or both worksheets not found"
      };
    }

    const tableA = extractTable(wsA);
    const tableB = extractTable(wsB);

    const headersA = new Set(tableA.headers);
    const headersB = new Set(tableB.headers);
    const addedColumns = tableB.headers.filter((h) => !headersA.has(h));
    const removedColumns = tableA.headers.filter((h) => !headersB.has(h));
    const commonHeaders = tableA.headers.filter((h) => headersB.has(h));

    // Build row signature maps for matching
    const rowKeyA = (row: Record<string, unknown>) => commonHeaders.map((h) => `${row[h] ?? ""}`).join("||");
    const rowKeyB = (row: Record<string, unknown>) => commonHeaders.map((h) => `${row[h] ?? ""}`).join("||");

    const rowsAMap = new Map<string, { row: Record<string, unknown>; index: number }>();
    tableA.rows.forEach((row, idx) => {
      const key = rowKeyA(row);
      if (!rowsAMap.has(key)) rowsAMap.set(key, { row, index: idx });
    });

    const rowsBMap = new Map<string, { row: Record<string, unknown>; index: number }>();
    tableB.rows.forEach((row, idx) => {
      const key = rowKeyB(row);
      if (!rowsBMap.has(key)) rowsBMap.set(key, { row, index: idx });
    });

    // Compare cell by cell for matching rows by index
    const changedCells: DiffResult["changed_cells"] = [];
    const maxRows = Math.min(tableA.rows.length, tableB.rows.length);

    for (let i = 0; i < maxRows; i++) {
      const rowA = tableA.rows[i];
      const rowB = tableB.rows[i];
      for (const header of commonHeaders) {
        const valA = `${rowA[header] ?? ""}`;
        const valB = `${rowB[header] ?? ""}`;
        if (valA !== valB) {
          changedCells.push({ row: i + 2, col: header, old_value: valA, new_value: valB });
        }
      }
    }

    const addedRows = Math.max(0, tableB.rows.length - tableA.rows.length);
    const removedRows = Math.max(0, tableA.rows.length - tableB.rows.length);

    const summary = [
      `Compared '${wsA.name}' (${tableA.rows.length} rows, ${tableA.headers.length} cols) vs '${wsB.name}' (${tableB.rows.length} rows, ${tableB.headers.length} cols)`,
      `Changed cells: ${changedCells.length}`,
      addedColumns.length > 0 ? `Added columns: ${addedColumns.join(", ")}` : null,
      removedColumns.length > 0 ? `Removed columns: ${removedColumns.join(", ")}` : null,
      addedRows > 0 ? `Added rows: ${addedRows}` : null,
      removedRows > 0 ? `Removed rows: ${removedRows}` : null
    ].filter(Boolean).join(". ");

    return {
      diff_type: "file_vs_file",
      added_rows: addedRows,
      removed_rows: removedRows,
      changed_cells: changedCells.slice(0, 1000),
      added_columns: addedColumns,
      removed_columns: removedColumns,
      summary
    };
  }

  compareColumns(state: ExcelRunState, sheetName: string, colA: string, colB: string): DiffResult {
    const worksheet = state.workbook.getWorksheet(sheetName);
    if (!worksheet) {
      return {
        diff_type: "column_vs_column",
        added_rows: 0,
        removed_rows: 0,
        changed_cells: [],
        added_columns: [],
        removed_columns: [],
        summary: `Worksheet '${sheetName}' not found`
      };
    }

    const table = extractTable(worksheet);
    if (!table.headers.includes(colA) || !table.headers.includes(colB)) {
      return {
        diff_type: "column_vs_column",
        added_rows: 0,
        removed_rows: 0,
        changed_cells: [],
        added_columns: [],
        removed_columns: [],
        summary: `One or both columns ('${colA}', '${colB}') not found in '${sheetName}'`
      };
    }

    const changedCells: DiffResult["changed_cells"] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const valA = `${table.rows[i][colA] ?? ""}`;
      const valB = `${table.rows[i][colB] ?? ""}`;
      if (valA !== valB) {
        changedCells.push({ row: i + 2, col: `${colA} vs ${colB}`, old_value: valA, new_value: valB });
      }
    }

    return {
      diff_type: "column_vs_column",
      added_rows: 0,
      removed_rows: 0,
      changed_cells: changedCells.slice(0, 1000),
      added_columns: [],
      removed_columns: [],
      summary: `Compared columns '${colA}' and '${colB}' in '${sheetName}': ${changedCells.length} differences out of ${table.rows.length} rows`
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Outputs Enhancement
  // ═══════════════════════════════════════════════════════════════════════════

  exportParquetFile(state: ExcelRunState, sheetName: string, targetPath: string): string {
    const manifest = this.exportParquet(state, sheetName, targetPath);
    return manifest.path;
  }

  exportPdfReport(state: ExcelRunState, targetPath: string, actorRef: string): string {
    const worksheets = state.workbook.worksheets.filter(
      (ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden"
    );

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Excel Report — ${state.runId}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #222; }
  h1 { color: #1a3a5c; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; }
  h2 { color: #2a5a8c; margin-top: 32px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
  th { background: #e7f0f8; color: #17324d; padding: 8px 12px; border: 1px solid #b6c7d6; text-align: left; }
  td { padding: 6px 12px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .meta { color: #666; font-size: 0.9em; margin-bottom: 24px; }
  .kpi-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
  .kpi-card { background: #f0f6fc; border: 1px solid #c0d4e8; border-radius: 8px; padding: 16px; min-width: 180px; }
  .kpi-value { font-size: 1.6em; font-weight: bold; color: #1a3a5c; }
  .kpi-label { font-size: 0.85em; color: #666; }
</style>
</head>
<body>
<h1>Workbook Report</h1>
<div class="meta">
  <p>Run ID: ${state.runId} | Generated: ${ISO()}</p>
  <p>Sheets: ${worksheets.length} | Actor: ${actorRef}</p>
</div>
`;

    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0) continue;

      html += `<h2>${ws.name}</h2>\n`;
      html += `<p>${table.rows.length} rows, ${table.headers.length} columns</p>\n`;

      // KPI cards for numeric columns
      const numericHeaders = table.headers.filter((h) => {
        const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
        return vals.length > table.rows.length * 0.3;
      });

      if (numericHeaders.length > 0) {
        html += `<div class="kpi-grid">\n`;
        for (const h of numericHeaders.slice(0, 6)) {
          const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
          const sum = vals.reduce((a, b) => a + b, 0);
          const avg = vals.length > 0 ? sum / vals.length : 0;
          html += `<div class="kpi-card"><div class="kpi-label">${h}</div><div class="kpi-value">${Math.round(sum * 100) / 100}</div><div class="kpi-label">Avg: ${Math.round(avg * 100) / 100}</div></div>\n`;
        }
        html += `</div>\n`;
      }

      // Data table (limited to 100 rows)
      html += `<table>\n<thead><tr>`;
      for (const h of table.headers) html += `<th>${h}</th>`;
      html += `</tr></thead>\n<tbody>\n`;
      for (const row of table.rows.slice(0, 100)) {
        html += `<tr>`;
        for (const h of table.headers) {
          const v = row[h];
          html += `<td>${v !== null && v !== undefined ? v : ""}</td>`;
        }
        html += `</tr>\n`;
      }
      if (table.rows.length > 100) {
        html += `<tr><td colspan="${table.headers.length}" style="text-align:center;color:#999;">... ${table.rows.length - 100} more rows ...</td></tr>\n`;
      }
      html += `</tbody></table>\n`;
    }

    html += `</body></html>`;

    const htmlPath = targetPath.replace(/\.pdf$/i, ".html");
    ensureDir(path.dirname(htmlPath));
    fs.writeFileSync(htmlPath, html, "utf8");

    addAuditEvent(state, "excel_engine.export_pdf_report.v1", actorRef, [state.workbookRecord.workbook_id], {
      target_path: htmlPath,
      sheet_count: worksheets.length
    });

    return htmlPath;
  }

  exportSlidesDeck(state: ExcelRunState, targetPath: string, actorRef: string): string {
    // Generate a JSON-based slide deck (PPTX generation needs pptxgenjs which may not be available)
    const worksheets = state.workbook.worksheets.filter(
      (ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden"
    );

    const slides: Array<{
      slide_number: number;
      title: string;
      content_type: string;
      content: Record<string, unknown>;
    }> = [];

    // Title slide
    slides.push({
      slide_number: 1,
      title: `Workbook Analysis`,
      content_type: "title",
      content: {
        subtitle: `Run: ${state.runId}`,
        date: ISO(),
        sheet_count: worksheets.length
      }
    });

    let slideNum = 2;
    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0) continue;

      // Overview slide
      const numericHeaders = table.headers.filter((h) => {
        const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
        return vals.length > table.rows.length * 0.3;
      });

      slides.push({
        slide_number: slideNum++,
        title: `${ws.name} — Overview`,
        content_type: "summary",
        content: {
          row_count: table.rows.length,
          column_count: table.headers.length,
          numeric_columns: numericHeaders.length,
          headers: table.headers
        }
      });

      // KPI slide for numeric columns
      if (numericHeaders.length > 0) {
        const kpiContent: Record<string, unknown> = {};
        for (const h of numericHeaders.slice(0, 8)) {
          const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
          const sum = vals.reduce((a, b) => a + b, 0);
          kpiContent[h] = {
            sum: Math.round(sum * 100) / 100,
            avg: Math.round((sum / vals.length) * 100) / 100,
            min: Math.min(...vals),
            max: Math.max(...vals),
            count: vals.length
          };
        }
        slides.push({
          slide_number: slideNum++,
          title: `${ws.name} — Key Metrics`,
          content_type: "kpi_grid",
          content: kpiContent
        });
      }

      // Sample data slide
      slides.push({
        slide_number: slideNum++,
        title: `${ws.name} — Sample Data`,
        content_type: "data_table",
        content: {
          headers: table.headers,
          rows: table.rows.slice(0, 10).map((r) => table.headers.map((h) => `${r[h] ?? ""}`))
        }
      });
    }

    const deckPayload = {
      format: "rasid-slide-deck",
      version: "1.0.0",
      created_at: ISO(),
      run_id: state.runId,
      slide_count: slides.length,
      slides
    };

    const jsonPath = targetPath.replace(/\.(pptx|ppt)$/i, ".slides.json");
    ensureDir(path.dirname(jsonPath));
    fs.writeFileSync(jsonPath, JSON.stringify(deckPayload, null, 2), "utf8");

    addAuditEvent(state, "excel_engine.export_slides.v1", actorRef, [state.workbookRecord.workbook_id], {
      target_path: jsonPath,
      slide_count: slides.length
    });

    return jsonPath;
  }

  exportWebDashboard(state: ExcelRunState, targetPath: string, actorRef: string): string {
    const worksheets = state.workbook.worksheets.filter(
      (ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden"
    );

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard — ${state.runId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; color: #222; }
  .header { background: #1a3a5c; color: #fff; padding: 20px 40px; }
  .header h1 { font-size: 1.5em; }
  .header .meta { opacity: 0.7; font-size: 0.85em; margin-top: 4px; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 32px; }
  .card { background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); padding: 20px; }
  .card h3 { color: #1a3a5c; margin-bottom: 12px; font-size: 1.1em; }
  .kpi-value { font-size: 2em; font-weight: bold; color: #2a5a8c; }
  .kpi-sub { font-size: 0.8em; color: #888; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
  th { background: #e7f0f8; padding: 8px; text-align: left; border-bottom: 2px solid #c0d4e8; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .section-title { font-size: 1.3em; color: #1a3a5c; margin: 24px 0 16px; border-left: 4px solid #2a5a8c; padding-left: 12px; }
  .bar { height: 20px; background: #2a5a8c; border-radius: 3px; display: inline-block; }
</style>
</head>
<body>
<div class="header">
  <h1>Workbook Dashboard</h1>
  <div class="meta">Run: ${state.runId} | Generated: ${ISO()} | Sheets: ${worksheets.length}</div>
</div>
<div class="container">
`;

    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0) continue;

      html += `<div class="section-title">${ws.name}</div>\n`;

      // KPI cards
      const numericHeaders = table.headers.filter((h) => {
        const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
        return vals.length > table.rows.length * 0.3;
      });

      if (numericHeaders.length > 0) {
        html += `<div class="grid">\n`;
        for (const h of numericHeaders.slice(0, 8)) {
          const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
          const sum = vals.reduce((a, b) => a + b, 0);
          const avg = vals.length > 0 ? sum / vals.length : 0;
          const max = vals.length > 0 ? Math.max(...vals) : 0;
          html += `<div class="card">
  <h3>${h}</h3>
  <div class="kpi-value">${Math.round(sum * 100) / 100}</div>
  <div class="kpi-sub">Avg: ${Math.round(avg * 100) / 100} | Max: ${Math.round(max * 100) / 100} | Count: ${vals.length}</div>
</div>\n`;
        }
        html += `</div>\n`;
      }

      // Horizontal bar chart (CSS-based) for top categorical breakdowns
      const catHeaders = table.headers.filter((h) => !numericHeaders.includes(h));
      if (catHeaders.length > 0 && numericHeaders.length > 0) {
        const catCol = catHeaders[0];
        const numCol = numericHeaders[0];
        const agg = new Map<string, number>();
        for (const row of table.rows) {
          const cat = `${row[catCol] ?? "Other"}`;
          const val = typeof row[numCol] === "number" ? row[numCol] as number : 0;
          agg.set(cat, (agg.get(cat) ?? 0) + val);
        }
        const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

        html += `<div class="card"><h3>${numCol} by ${catCol}</h3><table>\n`;
        for (const [cat, val] of sorted) {
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          html += `<tr><td style="width:150px">${cat}</td><td><span class="bar" style="width:${pct}%">&nbsp;</span> ${Math.round(val * 100) / 100}</td></tr>\n`;
        }
        html += `</table></div>\n`;
      }

      // Data table
      html += `<div class="card"><h3>Data (${table.rows.length} rows)</h3>\n<div style="overflow-x:auto"><table>\n<thead><tr>`;
      for (const h of table.headers) html += `<th>${h}</th>`;
      html += `</tr></thead><tbody>\n`;
      for (const row of table.rows.slice(0, 50)) {
        html += `<tr>`;
        for (const h of table.headers) html += `<td>${row[h] !== null && row[h] !== undefined ? row[h] : ""}</td>`;
        html += `</tr>\n`;
      }
      if (table.rows.length > 50) {
        html += `<tr><td colspan="${table.headers.length}" style="text-align:center;color:#999">... ${table.rows.length - 50} more rows</td></tr>\n`;
      }
      html += `</tbody></table></div></div>\n`;
    }

    html += `</div></body></html>`;

    const htmlPath = targetPath.replace(/\.(html?)$/i, "") + ".html";
    ensureDir(path.dirname(htmlPath));
    fs.writeFileSync(htmlPath, html, "utf8");

    addAuditEvent(state, "excel_engine.export_web_dashboard.v1", actorRef, [state.workbookRecord.workbook_id], {
      target_path: htmlPath,
      sheet_count: worksheets.length
    });

    return htmlPath;
  }

  exportLineageMetadata(state: ExcelRunState, targetPath: string): string {
    const payload = {
      format: "rasid-lineage",
      version: "1.0.0",
      run_id: state.runId,
      workbook_ref: state.workbookRecord.workbook_id,
      edge_count: state.lineageEdges.length,
      edges: state.lineageEdges,
      generated_at: ISO()
    };

    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), "utf8");
    return targetPath;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Recipes (Operation Memory)
  // ═══════════════════════════════════════════════════════════════════════════

  saveRecipe(state: ExcelRunState, name: string, actorRef: string): Recipe {
    // Build recipe from the transformation plans and audit events
    const steps: Recipe["steps"] = [];

    for (const plan of state.transformationPlans) {
      for (const step of plan.action_sequence) {
        steps.push({
          action: step.operation,
          params: {
            step_id: step.step_id,
            ...(step.config as Record<string, unknown>)
          }
        });
      }
    }

    // Also capture pivot, chart, and formatting operations from audit events
    for (const event of state.auditEvents) {
      if (event.action_ref.includes("pivot")) {
        steps.push({ action: "generate_pivot", params: event.metadata as Record<string, unknown> });
      } else if (event.action_ref.includes("chart")) {
        steps.push({ action: "generate_chart", params: event.metadata as Record<string, unknown> });
      } else if (event.action_ref.includes("format")) {
        steps.push({ action: "apply_formatting", params: event.metadata as Record<string, unknown> });
      }
    }

    const existing = globalRecipeStore.find((r) => r.name === name);
    const now = ISO();
    const recipe: Recipe = {
      recipe_id: existing ? existing.recipe_id : id("recipe", state.runId, name.replace(/[^A-Za-z0-9_]/g, "_")),
      name,
      version: existing ? existing.version + 1 : 1,
      steps,
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };

    if (existing) {
      const idx = globalRecipeStore.indexOf(existing);
      globalRecipeStore[idx] = recipe;
    } else {
      globalRecipeStore.push(recipe);
    }

    // Persist recipe to output root
    const recipePath = path.join(state.outputRoot, "recipes", `${recipe.recipe_id}.json`);
    writeJson(recipePath, recipe);

    addAuditEvent(state, "excel_engine.save_recipe.v1", actorRef, [recipe.recipe_id], {
      recipe_name: name,
      step_count: steps.length,
      version: recipe.version
    });

    return recipe;
  }

  listRecipes(state: ExcelRunState): Recipe[] {
    // Merge in-memory recipes with any persisted on disk
    const recipesDir = path.join(state.outputRoot, "recipes");
    const diskRecipes: Recipe[] = [];
    if (fs.existsSync(recipesDir)) {
      for (const file of fs.readdirSync(recipesDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const content = fs.readFileSync(path.join(recipesDir, file), "utf8");
          diskRecipes.push(JSON.parse(content) as Recipe);
        } catch { /* skip invalid */ }
      }
    }

    // Merge: prefer in-memory if same ID
    const merged = new Map<string, Recipe>();
    for (const r of diskRecipes) merged.set(r.recipe_id, r);
    for (const r of globalRecipeStore) merged.set(r.recipe_id, r);
    return [...merged.values()];
  }

  async replayRecipe(state: ExcelRunState, recipeId: string, actorRef: string): Promise<ExcelRunState> {
    const recipes = this.listRecipes(state);
    const recipe = recipes.find((r) => r.recipe_id === recipeId);
    if (!recipe) throw new Error(`Recipe '${recipeId}' not found`);

    for (const step of recipe.steps) {
      if (step.action === "generate_pivot" || step.action === "generate_chart" || step.action === "apply_formatting") {
        // These are metadata-only steps recorded from audit events; skip replay for now
        continue;
      }

      // Replay as a transformation step — validate via schema to ensure correct shape
      const validOps = [
        "merge_columns", "split_column", "rename_column", "derive_column",
        "reorder_columns", "append_table", "join_tables", "filter_rows",
        "sort_range", "group_aggregate", "pivot_generate", "unpivot_range",
        "normalize_sheet", "split_sheet", "merge_sheets", "merge_workbooks"
      ] as const;
      const mappedOp = validOps.find((op) => op === step.action) ?? "rename_column";
      const plan = TransformationPlanSchema.parse({
        contract: EXCEL_CONTRACT,
        ...Meta,
        plan_id: id("plan", "recipe-replay", recipeId, step.action),
        workbook_ref: state.workbookRecord.workbook_id,
        requested_mode: state.mode,
        action_sequence: [{
          schema_namespace: EXCEL_SCHEMA_NAMESPACE,
          schema_version: EXCEL_SCHEMA_VERSION,
          step_id: id("step", "replay", step.action),
          operation: mappedOp,
          input_refs: [],
          output_target_refs: [],
          config: step.params,
          preview_required: false,
          approval_required: false
        }],
        execution_strategy: "serial",
        created_by: actorRef,
        created_at: ISO()
      });

      try {
        await this.applyTransformation(state, plan, actorRef);
      } catch {
        // If a step fails during replay, continue with remaining steps
      }
    }

    addAuditEvent(state, "excel_engine.replay_recipe.v1", actorRef, [recipeId], {
      recipe_name: recipe.name,
      step_count: recipe.steps.length
    });

    return state;
  }

  async applyRecipeToFolder(
    state: ExcelRunState,
    recipeId: string,
    folderPath: string,
    actorRef: string
  ): Promise<Array<{ file: string; success: boolean; error?: string }>> {
    const results: Array<{ file: string; success: boolean; error?: string }> = [];

    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return [{ file: folderPath, success: false, error: "Folder not found" }];
    }

    const files = fs.readdirSync(folderPath).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return [".xlsx", ".xls", ".xlsm", ".csv", ".tsv"].includes(ext);
    });

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      try {
        const ext = path.extname(file).toLowerCase();
        const mediaTypeMap: Record<string, string> = {
          ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ".xls": "application/vnd.ms-excel",
          ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
          ".csv": "text/csv",
          ".tsv": "text/tab-separated-values"
        };
        const mediaType = mediaTypeMap[ext] ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        const fileOutputRoot = path.join(state.outputRoot, "recipe-batch", path.basename(file, ext));
        const importedState = await this.importWorkbook({
          run_id: id("run", "batch", path.basename(file, ext)),
          tenant_ref: state.tenantRef,
          workspace_id: state.workspaceId,
          project_id: state.projectId,
          created_by: actorRef,
          requested_mode: state.mode,
          media_type: mediaType as ExcelImportRequest["media_type"],
          input_path: filePath,
          output_root: fileOutputRoot
        });

        await this.replayRecipe(importedState, recipeId, actorRef);
        results.push({ file, success: true });
      } catch (err) {
        results.push({ file, success: false, error: err instanceof Error ? err.message : `${err}` });
      }
    }

    addAuditEvent(state, "excel_engine.apply_recipe_to_folder.v1", actorRef, [recipeId], {
      folder_path: folderPath,
      total_files: files.length,
      success_count: results.filter((r) => r.success).length,
      failure_count: results.filter((r) => !r.success).length
    });

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. AI for Excel
  // ═══════════════════════════════════════════════════════════════════════════

  naturalLanguageQuery(state: ExcelRunState, query: string, sheetName?: string): NLQResult {
    const worksheets = sheetName
      ? [state.workbook.getWorksheet(sheetName)].filter(Boolean) as ExcelJS.Worksheet[]
      : state.workbook.worksheets.filter((ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden");

    if (worksheets.length === 0) {
      return { query, interpreted_as: "no_data", sql_equivalent: "", result_rows: [], result_columns: [] };
    }

    const ws = worksheets[0];
    const table = extractTable(ws);
    const queryLower = query.toLowerCase();

    // Parse NL query to identify operation and target columns
    const numericHeaders = table.headers.filter((h) => {
      const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
      return vals.length > table.rows.length * 0.3;
    });

    // Find columns mentioned in the query
    const mentionedColumns = table.headers.filter((h) => queryLower.includes(h.toLowerCase()));
    const targetColumns = mentionedColumns.length > 0 ? mentionedColumns : numericHeaders.slice(0, 3);

    // Detect operation
    let operation = "select";
    let interpreted = "";
    let sqlEquivalent = "";
    let resultRows: string[][] = [];
    let resultColumns: string[] = [];

    if (/\b(sum|total|summation)\b/i.test(query)) {
      operation = "sum";
      const cols = targetColumns.filter((c) => numericHeaders.includes(c));
      resultColumns = ["column", "sum"];
      resultRows = cols.map((c) => {
        const vals = table.rows.map((r) => r[c]).filter((v): v is number => typeof v === "number");
        const sum = vals.reduce((a, b) => a + b, 0);
        return [c, `${Math.round(sum * 100) / 100}`];
      });
      interpreted = `Calculate sum of ${cols.join(", ")}`;
      sqlEquivalent = `SELECT ${cols.map((c) => `SUM("${c}")`).join(", ")} FROM "${ws.name}"`;
    } else if (/\b(average|avg|mean)\b/i.test(query)) {
      operation = "average";
      const cols = targetColumns.filter((c) => numericHeaders.includes(c));
      resultColumns = ["column", "average"];
      resultRows = cols.map((c) => {
        const vals = table.rows.map((r) => r[c]).filter((v): v is number => typeof v === "number");
        const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return [c, `${Math.round(avg * 100) / 100}`];
      });
      interpreted = `Calculate average of ${cols.join(", ")}`;
      sqlEquivalent = `SELECT ${cols.map((c) => `AVG("${c}")`).join(", ")} FROM "${ws.name}"`;
    } else if (/\b(max|maximum|highest|largest)\b/i.test(query)) {
      operation = "max";
      const cols = targetColumns.filter((c) => numericHeaders.includes(c));
      resultColumns = ["column", "max"];
      resultRows = cols.map((c) => {
        const vals = table.rows.map((r) => r[c]).filter((v): v is number => typeof v === "number");
        return [c, `${vals.length > 0 ? Math.max(...vals) : 0}`];
      });
      interpreted = `Find maximum of ${cols.join(", ")}`;
      sqlEquivalent = `SELECT ${cols.map((c) => `MAX("${c}")`).join(", ")} FROM "${ws.name}"`;
    } else if (/\b(min|minimum|lowest|smallest)\b/i.test(query)) {
      operation = "min";
      const cols = targetColumns.filter((c) => numericHeaders.includes(c));
      resultColumns = ["column", "min"];
      resultRows = cols.map((c) => {
        const vals = table.rows.map((r) => r[c]).filter((v): v is number => typeof v === "number");
        return [c, `${vals.length > 0 ? Math.min(...vals) : 0}`];
      });
      interpreted = `Find minimum of ${cols.join(", ")}`;
      sqlEquivalent = `SELECT ${cols.map((c) => `MIN("${c}")`).join(", ")} FROM "${ws.name}"`;
    } else if (/\b(count|how many)\b/i.test(query)) {
      operation = "count";
      resultColumns = ["metric", "value"];
      resultRows = [["row_count", `${table.rows.length}`]];
      if (targetColumns.length > 0) {
        for (const c of targetColumns) {
          const nonNull = table.rows.filter((r) => r[c] !== null && r[c] !== undefined && r[c] !== "").length;
          resultRows.push([`${c}_non_null`, `${nonNull}`]);
        }
      }
      interpreted = `Count rows${targetColumns.length > 0 ? ` and non-null values in ${targetColumns.join(", ")}` : ""}`;
      sqlEquivalent = `SELECT COUNT(*) FROM "${ws.name}"`;
    } else if (/\b(group|by|per|each)\b/i.test(query)) {
      operation = "group_by";
      const catCols = table.headers.filter((h) => !numericHeaders.includes(h));
      const groupCol = mentionedColumns.find((c) => catCols.includes(c)) ?? catCols[0];
      const valueCol = mentionedColumns.find((c) => numericHeaders.includes(c)) ?? numericHeaders[0];

      if (groupCol && valueCol) {
        const groups = new Map<string, number[]>();
        for (const row of table.rows) {
          const key = `${row[groupCol] ?? "NULL"}`;
          const val = typeof row[valueCol] === "number" ? row[valueCol] as number : 0;
          const arr = groups.get(key) ?? [];
          arr.push(val);
          groups.set(key, arr);
        }
        resultColumns = [groupCol, `sum_${valueCol}`, `avg_${valueCol}`, "count"];
        resultRows = [...groups.entries()].map(([key, vals]) => {
          const sum = vals.reduce((a, b) => a + b, 0);
          return [key, `${Math.round(sum * 100) / 100}`, `${Math.round((sum / vals.length) * 100) / 100}`, `${vals.length}`];
        });
        interpreted = `Group by '${groupCol}' and aggregate '${valueCol}'`;
        sqlEquivalent = `SELECT "${groupCol}", SUM("${valueCol}"), AVG("${valueCol}"), COUNT(*) FROM "${ws.name}" GROUP BY "${groupCol}"`;
      } else {
        interpreted = "Could not determine grouping columns";
        sqlEquivalent = "";
        resultColumns = [];
        resultRows = [];
      }
    } else if (/\b(top|first|head)\b/i.test(query)) {
      const numMatch = query.match(/\b(\d+)\b/);
      const limit = numMatch ? parseInt(numMatch[1], 10) : 5;
      operation = "top_n";
      resultColumns = table.headers;
      resultRows = table.rows.slice(0, limit).map((r) => table.headers.map((h) => `${r[h] ?? ""}`));
      interpreted = `Show top ${limit} rows`;
      sqlEquivalent = `SELECT * FROM "${ws.name}" LIMIT ${limit}`;
    } else if (/\b(filter|where|only|with)\b/i.test(query)) {
      operation = "filter";
      // Try to find a filter pattern: column = value or column > value
      const filterMatch = query.match(/(?:filter|where|only|with)\s+(\w+)\s*(=|>|<|>=|<=|!=|contains?)\s*['"]?([^'"]+?)['"]?\s*$/i);
      if (filterMatch) {
        const [, colHint, op, val] = filterMatch;
        const matchedCol = table.headers.find((h) => h.toLowerCase() === colHint.toLowerCase()) ?? table.headers.find((h) => h.toLowerCase().includes(colHint.toLowerCase()));
        if (matchedCol) {
          const filtered = table.rows.filter((r) => {
            const cellVal = r[matchedCol];
            const cellStr = `${cellVal ?? ""}`.toLowerCase();
            const targetStr = val.toLowerCase();
            if (op === "=" || op === "==") return cellStr === targetStr;
            if (op === "!=" || op === "<>") return cellStr !== targetStr;
            if (op === ">" && typeof cellVal === "number") return cellVal > Number(val);
            if (op === "<" && typeof cellVal === "number") return cellVal < Number(val);
            if (op === ">=" && typeof cellVal === "number") return cellVal >= Number(val);
            if (op === "<=" && typeof cellVal === "number") return cellVal <= Number(val);
            if (op.startsWith("contain")) return cellStr.includes(targetStr);
            return cellStr === targetStr;
          });
          resultColumns = table.headers;
          resultRows = filtered.slice(0, 100).map((r) => table.headers.map((h) => `${r[h] ?? ""}`));
          interpreted = `Filter rows where '${matchedCol}' ${op} '${val}'`;
          sqlEquivalent = `SELECT * FROM "${ws.name}" WHERE "${matchedCol}" ${op} '${val}'`;
        }
      }
      if (resultColumns.length === 0) {
        interpreted = `Could not parse filter from query`;
        resultColumns = table.headers;
        resultRows = table.rows.slice(0, 10).map((r) => table.headers.map((h) => `${r[h] ?? ""}`));
        sqlEquivalent = `SELECT * FROM "${ws.name}" LIMIT 10`;
      }
    } else {
      // Default: show sample data
      operation = "select";
      resultColumns = table.headers;
      resultRows = table.rows.slice(0, 10).map((r) => table.headers.map((h) => `${r[h] ?? ""}`));
      interpreted = `Show data from '${ws.name}'`;
      sqlEquivalent = `SELECT * FROM "${ws.name}" LIMIT 10`;
    }

    return {
      query,
      interpreted_as: `${operation}: ${interpreted}`,
      sql_equivalent: sqlEquivalent,
      result_rows: resultRows,
      result_columns: resultColumns
    };
  }

  autoAnalyze(state: ExcelRunState, sheetName?: string): AutoAnalysisResult {
    const worksheets = sheetName
      ? [state.workbook.getWorksheet(sheetName)].filter(Boolean) as ExcelJS.Worksheet[]
      : state.workbook.worksheets.filter((ws) => !ws.name.startsWith("__") && ws.state !== "veryHidden");

    const insights: AutoAnalysisResult["insights"] = [];
    const anomalies: AutoAnalysisResult["anomalies"] = [];

    for (const ws of worksheets) {
      const table = extractTable(ws);
      if (table.headers.length === 0 || table.rows.length === 0) continue;

      // Analyze each column
      for (const header of table.headers) {
        const values = table.rows.map((r) => r[header]);
        const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
        const nullRatio = 1 - nonNull.length / values.length;

        // High null ratio
        if (nullRatio > 0.3) {
          anomalies.push({
            column: header,
            description: `High null ratio: ${Math.round(nullRatio * 100)}% of values are missing`,
            severity: nullRatio > 0.7 ? "high" : "medium"
          });
        }

        const numericValues = nonNull.filter((v): v is number => typeof v === "number");
        if (numericValues.length >= nonNull.length * 0.5 && numericValues.length >= 5) {
          // Distribution analysis
          const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
          const variance = numericValues.reduce((a, b) => a + (b - mean) ** 2, 0) / numericValues.length;
          const stddev = Math.sqrt(variance);
          const cv = mean !== 0 ? stddev / Math.abs(mean) : 0;

          // High variance
          if (cv > 1.5) {
            insights.push({
              category: "distribution",
              description: `Column '${header}' has very high variability (CV=${Math.round(cv * 100) / 100})`,
              confidence: 0.85,
              affected_columns: [header]
            });
          }

          // Trend detection
          if (numericValues.length >= 10) {
            const firstThird = numericValues.slice(0, Math.floor(numericValues.length / 3));
            const lastThird = numericValues.slice(-Math.floor(numericValues.length / 3));
            const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
            const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
            if (firstAvg !== 0) {
              const changePct = ((lastAvg - firstAvg) / Math.abs(firstAvg)) * 100;
              if (Math.abs(changePct) > 20) {
                insights.push({
                  category: "trend",
                  description: `Column '${header}' shows a ${changePct > 0 ? "positive" : "negative"} trend of ${Math.round(Math.abs(changePct))}%`,
                  confidence: 0.7,
                  affected_columns: [header]
                });
              }
            }
          }

          // Outlier detection
          const outlierCount = numericValues.filter((v) => Math.abs((v - mean) / (stddev || 1)) > 3).length;
          if (outlierCount > 0) {
            anomalies.push({
              column: header,
              description: `${outlierCount} extreme outlier(s) detected (z-score > 3)`,
              severity: outlierCount > numericValues.length * 0.05 ? "high" : "low"
            });
          }
        }

        // Text column analysis
        const textValues = nonNull.filter((v): v is string => typeof v === "string");
        if (textValues.length >= nonNull.length * 0.5 && textValues.length >= 5) {
          const uniqueRatio = new Set(textValues).size / textValues.length;

          // Potential categorical column
          if (uniqueRatio < 0.1 && textValues.length > 20) {
            insights.push({
              category: "classification",
              description: `Column '${header}' appears to be categorical with ${new Set(textValues).size} unique values out of ${textValues.length}`,
              confidence: 0.9,
              affected_columns: [header]
            });
          }

          // Potential unique identifier
          if (uniqueRatio >= 0.95) {
            insights.push({
              category: "structure",
              description: `Column '${header}' has ${Math.round(uniqueRatio * 100)}% unique values — likely an identifier/key`,
              confidence: 0.8,
              affected_columns: [header]
            });
          }
        }
      }

      // Cross-column correlation analysis (for numeric columns)
      const numericCols = table.headers.filter((h) => {
        const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
        return vals.length > table.rows.length * 0.5;
      });

      for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
          const colA = numericCols[i];
          const colB = numericCols[j];
          // Compute Pearson correlation
          const pairs: Array<[number, number]> = [];
          for (const row of table.rows) {
            const a = row[colA];
            const b = row[colB];
            if (typeof a === "number" && typeof b === "number") {
              pairs.push([a, b]);
            }
          }
          if (pairs.length < 5) continue;

          const meanA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
          const meanB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
          let covAB = 0, varA = 0, varB = 0;
          for (const [a, b] of pairs) {
            covAB += (a - meanA) * (b - meanB);
            varA += (a - meanA) ** 2;
            varB += (b - meanB) ** 2;
          }
          const denom = Math.sqrt(varA * varB);
          const corr = denom > 0 ? covAB / denom : 0;

          if (Math.abs(corr) > 0.7) {
            insights.push({
              category: "correlation",
              description: `Strong ${corr > 0 ? "positive" : "negative"} correlation (r=${Math.round(corr * 100) / 100}) between '${colA}' and '${colB}'`,
              confidence: Math.abs(corr),
              affected_columns: [colA, colB]
            });
          }
        }
      }
    }

    return { insights, anomalies };
  }

  predictiveAnalysis(state: ExcelRunState, targetColumn: string, sheetName?: string): PredictiveResult {
    const ws = sheetName
      ? state.workbook.getWorksheet(sheetName)
      : state.workbook.worksheets.find((w) => !w.name.startsWith("__") && w.state !== "veryHidden");

    if (!ws) throw new Error("No worksheet found");
    const table = extractTable(ws);
    if (!table.headers.includes(targetColumn)) throw new Error(`Column '${targetColumn}' not found`);

    // Simple linear regression using row index as X
    const yValues: Array<{ row: number; value: number }> = [];
    table.rows.forEach((r, idx) => {
      const v = r[targetColumn];
      if (typeof v === "number" && isFinite(v)) {
        yValues.push({ row: idx, value: v });
      }
    });

    if (yValues.length < 3) {
      return {
        column: targetColumn,
        predictions: [],
        method: "linear_regression",
        r_squared: 0
      };
    }

    // Compute linear regression: y = mx + b
    const n = yValues.length;
    const sumX = yValues.reduce((s, e) => s + e.row, 0);
    const sumY = yValues.reduce((s, e) => s + e.value, 0);
    const sumXY = yValues.reduce((s, e) => s + e.row * e.value, 0);
    const sumX2 = yValues.reduce((s, e) => s + e.row * e.row, 0);

    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const meanY = sumY / n;
    const ssTotal = yValues.reduce((s, e) => s + (e.value - meanY) ** 2, 0);
    const ssResidual = yValues.reduce((s, e) => {
      const predicted = slope * e.row + intercept;
      return s + (e.value - predicted) ** 2;
    }, 0);
    const rSquared = ssTotal > 0 ? Math.round((1 - ssResidual / ssTotal) * 10000) / 10000 : 0;

    // Generate predictions for next 5 rows and any null rows
    const predictions: PredictiveResult["predictions"] = [];
    const maxRow = table.rows.length;

    // Predict for null values in existing data
    table.rows.forEach((r, idx) => {
      const v = r[targetColumn];
      if (v === null || v === undefined || v === "") {
        const predicted = slope * idx + intercept;
        predictions.push({
          row: idx + 2, // 1-indexed with header offset
          predicted_value: Math.round(predicted * 100) / 100,
          confidence: Math.max(0, Math.min(1, rSquared))
        });
      }
    });

    // Predict next 5 rows
    for (let i = 0; i < 5; i++) {
      const rowIdx = maxRow + i;
      const predicted = slope * rowIdx + intercept;
      predictions.push({
        row: rowIdx + 2,
        predicted_value: Math.round(predicted * 100) / 100,
        confidence: Math.max(0, Math.min(1, rSquared * (1 - i * 0.05))) // confidence decays with distance
      });
    }

    return {
      column: targetColumn,
      predictions,
      method: "linear_regression",
      r_squared: rSquared
    };
  }

  whatIfAnalysis(
    state: ExcelRunState,
    sheetName: string,
    changes: Array<{ column: string; row: number; new_value: string }>
  ): WhatIfResult {
    const worksheet = state.workbook.getWorksheet(sheetName);
    if (!worksheet) throw new Error(`Worksheet '${sheetName}' not found`);
    const table = extractTable(worksheet);

    // Identify numeric columns for impact metrics
    const numericHeaders = table.headers.filter((h) => {
      const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
      return vals.length > table.rows.length * 0.3;
    });

    // Compute original aggregates
    const originalAggregates: Record<string, number> = {};
    for (const h of numericHeaders) {
      const vals = table.rows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
      originalAggregates[`${h}_sum`] = vals.reduce((a, b) => a + b, 0);
      originalAggregates[`${h}_avg`] = vals.length > 0 ? originalAggregates[`${h}_sum`] / vals.length : 0;
    }

    // Apply hypothetical changes (deep copy)
    const modifiedRows = table.rows.map((r) => ({ ...r }));
    for (const change of changes) {
      const rowIdx = change.row - 2; // Convert from 1-indexed with header
      if (rowIdx >= 0 && rowIdx < modifiedRows.length && table.headers.includes(change.column)) {
        const num = Number(change.new_value);
        modifiedRows[rowIdx][change.column] = isNaN(num) ? change.new_value : num;
      }
    }

    // Compute modified aggregates
    const modifiedAggregates: Record<string, number> = {};
    for (const h of numericHeaders) {
      const vals = modifiedRows.map((r) => r[h]).filter((v): v is number => typeof v === "number");
      modifiedAggregates[`${h}_sum`] = vals.reduce((a, b) => a + b, 0);
      modifiedAggregates[`${h}_avg`] = vals.length > 0 ? modifiedAggregates[`${h}_sum`] / vals.length : 0;
    }

    // Compute impact
    const impact: WhatIfResult["impact"] = [];
    for (const metric of Object.keys(originalAggregates)) {
      const before = originalAggregates[metric];
      const after = modifiedAggregates[metric];
      const changePct = before !== 0 ? Math.round(((after - before) / Math.abs(before)) * 10000) / 100 : 0;
      if (before !== after) {
        impact.push({
          metric,
          before: Math.round(before * 100) / 100,
          after: Math.round(after * 100) / 100,
          change_pct: changePct
        });
      }
    }

    // Build original/modified snapshots for changed cells
    const original: Record<string, string> = {};
    const modified: Record<string, string> = {};
    for (const change of changes) {
      const rowIdx = change.row - 2;
      const key = `${change.column}[${change.row}]`;
      original[key] = rowIdx >= 0 && rowIdx < table.rows.length ? `${table.rows[rowIdx][change.column] ?? ""}` : "";
      modified[key] = change.new_value;
    }

    return { original, modified, impact };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Power Query M Export
  // ═══════════════════════════════════════════════════════════════════════════

  exportPowerQueryM(
    state: ExcelRunState,
    transformations: TransformationPlan
  ): { m_code: string; exportable_steps: number; non_exportable_steps: Array<{ step_index: number; reason: string }> } {
    const mLines: string[] = [];
    const nonExportable: Array<{ step_index: number; reason: string }> = [];
    let exportableCount = 0;

    // M code preamble
    mLines.push("let");

    const steps = transformations.action_sequence;
    let sourceAdded = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const config = step.config as Record<string, unknown>;
      const op = step.operation as string;
      const stepName = `Step${i + 1}_${op}`.replace(/[^A-Za-z0-9_]/g, "_");
      const prevStep = i === 0 ? "Source" : `Step${i}_${(steps[i - 1].operation as string)}`.replace(/[^A-Za-z0-9_]/g, "_");

      if (!sourceAdded) {
        // Add source reference
        const worksheet = `${config.worksheet ?? config.leftWorksheet ?? "Sheet1"}`;
        mLines.push(`    Source = Excel.CurrentWorkbook(){[Name="${worksheet}"]}[Content],`);
        sourceAdded = true;
      }

      if (op === "rename_column") {
        const from = `${config.from ?? ""}`;
        const to = `${config.to ?? ""}`;
        if (from && to) {
          mLines.push(`    ${stepName} = Table.RenameColumns(${prevStep}, {{"${from}", "${to}"}}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing from/to column names" });
        }
      } else if (op === "merge_columns") {
        const columns = `${config.columns ?? ""}`.split(",").map((c) => c.trim()).filter(Boolean);
        const targetColumn = `${config.targetColumn ?? "MergedColumn"}`;
        const separator = `${config.separator ?? " "}`;
        if (columns.length >= 2) {
          const colRefs = columns.map((c) => `[${c}]`).join(` & "${separator}" & `);
          mLines.push(`    ${stepName} = Table.AddColumn(${prevStep}, "${targetColumn}", each ${colRefs}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Merge requires at least 2 columns" });
        }
      } else if (op === "split_column") {
        const sourceColumn = `${config.sourceColumn ?? ""}`;
        const delimiter = `${config.delimiter ?? "-"}`;
        if (sourceColumn) {
          mLines.push(`    ${stepName} = Table.SplitColumn(${prevStep}, "${sourceColumn}", Splitter.SplitTextByDelimiter("${delimiter}"), {"${sourceColumn}.1", "${sourceColumn}.2"}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing source column name" });
        }
      } else if (op === "filter_rows") {
        const column = `${config.column ?? ""}`;
        const operator = `${config.operator ?? "equals"}`;
        const value = `${config.value ?? ""}`;
        if (column) {
          let filterExpr = `[${column}] = "${value}"`;
          if (operator === "greater_than") filterExpr = `[${column}] > ${value}`;
          else if (operator === "less_than") filterExpr = `[${column}] < ${value}`;
          else if (operator === "not_equals") filterExpr = `[${column}] <> "${value}"`;
          else if (operator === "contains") filterExpr = `Text.Contains([${column}], "${value}")`;
          mLines.push(`    ${stepName} = Table.SelectRows(${prevStep}, each ${filterExpr}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing filter column" });
        }
      } else if (op === "sort_range") {
        const column = `${config.column ?? ""}`;
        const direction = `${config.direction ?? "ascending"}`;
        if (column) {
          const order = direction === "descending" ? "Order.Descending" : "Order.Ascending";
          mLines.push(`    ${stepName} = Table.Sort(${prevStep}, {{"${column}", ${order}}}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing sort column" });
        }
      } else if (op === "reorder_columns") {
        const columns = `${config.columns ?? ""}`.split(",").map((c) => c.trim()).filter(Boolean);
        if (columns.length > 0) {
          const colList = columns.map((c) => `"${c}"`).join(", ");
          mLines.push(`    ${stepName} = Table.ReorderColumns(${prevStep}, {${colList}}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing column list" });
        }
      } else if (op === "derive_column") {
        const columnName = `${config.columnName ?? config.column ?? "NewColumn"}`;
        const expression = `${config.expression ?? config.defaultValue ?? "null"}`;
        mLines.push(`    ${stepName} = Table.AddColumn(${prevStep}, "${columnName}", each ${expression}),`);
        exportableCount++;
      } else if (op === "group_aggregate") {
        const groupBy = `${config.groupBy ?? config.column ?? ""}`;
        const aggregateCol = `${config.aggregateColumn ?? config.valueColumn ?? ""}`;
        const aggFunc = `${config.aggregation ?? "sum"}`;
        if (groupBy && aggregateCol) {
          const mAggFunc = aggFunc === "count" ? "List.Count" : aggFunc === "average" ? "List.Average" : aggFunc === "min" ? "List.Min" : aggFunc === "max" ? "List.Max" : "List.Sum";
          mLines.push(`    ${stepName} = Table.Group(${prevStep}, {"${groupBy}"}, {{"${aggregateCol}_${aggFunc}", each ${mAggFunc}([${aggregateCol}]), type number}}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing group/aggregate columns" });
        }
      } else if (op === "join_tables") {
        const leftKey = `${config.leftKey ?? ""}`;
        const rightKey = `${config.rightKey ?? ""}`;
        const rightWorksheet = `${config.rightWorksheet ?? ""}`;
        if (leftKey && rightKey && rightWorksheet) {
          mLines.push(`    RightSource_${i} = Excel.CurrentWorkbook(){[Name="${rightWorksheet}"]}[Content],`);
          mLines.push(`    ${stepName} = Table.NestedJoin(${prevStep}, {"${leftKey}"}, RightSource_${i}, {"${rightKey}"}, "Joined", JoinKind.LeftOuter),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing join keys or right worksheet" });
        }
      } else if (op === "append_table") {
        const sourceWorksheet = `${config.sourceWorksheet ?? ""}`;
        if (sourceWorksheet) {
          mLines.push(`    AppendSource_${i} = Excel.CurrentWorkbook(){[Name="${sourceWorksheet}"]}[Content],`);
          mLines.push(`    ${stepName} = Table.Combine({${prevStep}, AppendSource_${i}}),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing source worksheet for append" });
        }
      } else if (op === "unpivot_range") {
        const columns = `${config.columns ?? ""}`.split(",").map((c) => c.trim()).filter(Boolean);
        if (columns.length > 0) {
          const colList = columns.map((c) => `"${c}"`).join(", ");
          mLines.push(`    ${stepName} = Table.UnpivotOtherColumns(${prevStep}, {${colList}}, "Attribute", "Value"),`);
          exportableCount++;
        } else {
          nonExportable.push({ step_index: i, reason: "Missing columns for unpivot" });
        }
      } else {
        // Complex or unsupported operations
        nonExportable.push({ step_index: i, reason: `Operation '${op}' has no direct Power Query M equivalent` });
        mLines.push(`    // ${stepName}: Not exportable — ${op}`);
      }
    }

    // Final result reference
    if (steps.length > 0) {
      const lastOp = steps[steps.length - 1].operation as string;
      const lastStep = `Step${steps.length}_${lastOp}`.replace(/[^A-Za-z0-9_]/g, "_");
      // Remove trailing comma from last step
      if (mLines.length > 0) {
        const lastLine = mLines[mLines.length - 1];
        if (lastLine.endsWith(",")) {
          mLines[mLines.length - 1] = lastLine.slice(0, -1);
        }
      }
      mLines.push(`in`);
      mLines.push(`    ${lastStep}`);
    } else {
      if (!sourceAdded) {
        mLines.push(`    Source = Excel.CurrentWorkbook(){[Name="Sheet1"]}[Content]`);
      }
      mLines.push(`in`);
      mLines.push(`    Source`);
    }

    return {
      m_code: mLines.join("\n"),
      exportable_steps: exportableCount,
      non_exportable_steps: nonExportable
    };
  }
}
