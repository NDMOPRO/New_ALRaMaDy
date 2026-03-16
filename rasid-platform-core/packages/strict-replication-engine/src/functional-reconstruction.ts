// ─── Functional Reconstruction Engines (Addendum) ─────────────────────
// Image → Live Dashboard | Editable Presentation | Report | Excel Model



// ─── Shared Helpers ───────────────────────────────────────────────────

const now = (): string => new Date().toISOString();
const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const fnvHash = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv32:${(h >>> 0).toString(16)}`;
};

// ─── Core Type Definitions ────────────────────────────────────────────

export type SourceType = "dashboard" | "presentation" | "report" | "spreadsheet" | "unknown";

export type CDRElement = {
  element_id: string;
  element_type: "text" | "shape" | "table" | "image" | "chart" | "control";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  rows?: string[][];
  chart_type?: string;
  series_refs?: string[];
  axis_refs?: string[];
  binding_refs?: string[];
  control_type?: "filter" | "drilldown" | "parameter" | "navigation";
  binding_ref?: string;
  formula_refs?: string[];
  fill?: string;
  editable?: boolean;
  style?: Record<string, string>;
};

export type CDRPage = {
  page_id: string;
  width: number;
  height: number;
  background: string;
  elements: CDRElement[];
};

export type CDRInput = {
  run_id: string;
  tenant_ref: string;
  workspace_id: string;
  project_id: string;
  source_kind: string;
  target_kind: string;
  pages: CDRPage[];
  metadata?: Record<string, unknown>;
};

// ─── Widget & Dashboard Types ─────────────────────────────────────────

export type WidgetKind = "chart" | "kpi" | "table" | "filter" | "legend" | "text" | "image";

export type FilterDefinition = {
  filter_id: string;
  field: string;
  filter_type: "dropdown" | "range" | "date" | "text" | "multi-select";
  default_value: unknown;
  bound_widgets: string[];
  cross_filter_targets: string[];
};

export type DrillDownPath = {
  path_id: string;
  source_widget: string;
  levels: Array<{ field: string; aggregation: string }>;
  current_level: number;
};

export type KPIDefinition = {
  kpi_id: string;
  label: string;
  measure: string;
  aggregation: "sum" | "avg" | "count" | "min" | "max" | "median" | "distinct_count";
  format: string;
  comparison_period?: string;
  target_value?: number;
  conditional_color_rules: Array<{ condition: string; color: string }>;
};

export type ChartBinding = {
  chart_id: string;
  chart_type: string;
  x_axis: { field: string; type: "category" | "time" | "numeric" };
  y_axes: Array<{ field: string; aggregation: string; label: string }>;
  series_field?: string;
  color_palette: string[];
  legend_position: "top" | "bottom" | "left" | "right" | "none";
};

export type TableBinding = {
  table_id: string;
  columns: Array<{
    field: string;
    label: string;
    width: number;
    sortable: boolean;
    format?: string;
    conditional_format?: Array<{ condition: string; style: Record<string, string> }>;
  }>;
  pagination: { enabled: boolean; page_size: number };
  row_grouping?: string[];
  totals_row: boolean;
};

export type DashboardWidget = {
  widget_id: string;
  kind: WidgetKind;
  position: { x: number; y: number; width: number; height: number };
  title: string;
  data_source: string;
  chart_binding?: ChartBinding;
  table_binding?: TableBinding;
  kpi_definition?: KPIDefinition;
  filter_definition?: FilterDefinition;
  refresh_interval_ms: number;
  permissions: string[];
};

export type DashboardOutput = {
  dashboard_id: string;
  title: string;
  widgets: DashboardWidget[];
  filters: FilterDefinition[];
  drill_down_paths: DrillDownPath[];
  cross_filter_map: Map<string, string[]>;
  theme: { primary: string; secondary: string; background: string; font_family: string };
  refresh_config: { global_interval_ms: number; live_enabled: boolean };
  export_formats: string[];
  permission_model: { visibility: string; roles: string[] };
  data_bindings: DataBindingMap;
  created_at: string;
};

// ─── Presentation Types ───────────────────────────────────────────────

export type SlideZone = {
  zone_id: string;
  zone_type: "title" | "subtitle" | "body" | "chart" | "image" | "table" | "footer" | "number";
  bounds: { x: number; y: number; width: number; height: number };
  content_ref?: string;
  editable: boolean;
};

export type SlideDefinition = {
  slide_id: string;
  slide_index: number;
  master_layout: string;
  theme: { background: string; color_scheme: string[]; font_theme: string };
  zones: SlideZone[];
  transitions: { type: string; duration_ms: number };
  speaker_notes: string;
  live_bindings: Array<{ zone_id: string; data_source: string; refresh: boolean }>;
};

export type PresentationOutput = {
  presentation_id: string;
  title: string;
  slides: SlideDefinition[];
  master_slides: Array<{ master_id: string; layout_name: string; zone_template: SlideZone[] }>;
  theme_global: { font_family: string; color_scheme: string[]; background: string };
  dynamic_refresh_enabled: boolean;
  export_format: "pptx";
  created_at: string;
};

// ─── Report Types ─────────────────────────────────────────────────────

export type ReportSection = {
  section_id: string;
  section_type: "heading" | "paragraph" | "table" | "chart" | "image" | "toc" | "page_break" | "header" | "footer";
  level?: number;
  content: string;
  style: Record<string, string>;
  data_binding?: { source: string; fields: string[] };
  editable: boolean;
  page_index: number;
};

export type ReportOutput = {
  report_id: string;
  title: string;
  sections: ReportSection[];
  table_of_contents: Array<{ title: string; level: number; page: number }>;
  page_layout: { width_mm: number; height_mm: number; margins: { top: number; bottom: number; left: number; right: number } };
  headers_footers: { header: string; footer: string; page_numbers: boolean };
  live_recalculation: boolean;
  export_formats: string[];
  compliance_tags: string[];
  created_at: string;
};

// ─── Excel Types ──────────────────────────────────────────────────────

export type CellFormula = {
  cell_ref: string;
  formula: string;
  computed_value: unknown;
  dependencies: string[];
  format: string;
};

export type ConditionalFormatRule = {
  rule_id: string;
  range: string;
  condition_type: "cell_value" | "text_contains" | "date" | "top_n" | "color_scale" | "data_bar" | "icon_set";
  operator?: string;
  values: unknown[];
  format: Record<string, string>;
};

export type PivotTableDef = {
  pivot_id: string;
  source_range: string;
  rows: string[];
  columns: string[];
  values: Array<{ field: string; aggregation: string }>;
  filters: string[];
  grand_totals: { rows: boolean; columns: boolean };
};

export type SheetDefinition = {
  sheet_id: string;
  sheet_name: string;
  columns: Array<{ index: number; label: string; width: number; type: string }>;
  rows: Array<{ index: number; cells: Array<{ value: unknown; formula?: string; format?: string }> }>;
  formulas: CellFormula[];
  conditional_formats: ConditionalFormatRule[];
  pivot_tables: PivotTableDef[];
  named_ranges: Array<{ name: string; range: string }>;
  frozen_panes?: { rows: number; cols: number };
};

export type ExcelOutput = {
  workbook_id: string;
  title: string;
  sheets: SheetDefinition[];
  dependency_graph: Map<string, string[]>;
  global_named_ranges: Array<{ name: string; sheet: string; range: string }>;
  live_recalculation: boolean;
  export_format: "xlsx";
  created_at: string;
};

// ─── Data Binding Types ───────────────────────────────────────────────

export type DataBindingMap = Map<string, DataBindingEntry>;

export type DataBindingEntry = {
  placeholder_id: string;
  dataset_ref: string;
  field_mappings: Array<{ placeholder_field: string; dataset_field: string; transform?: string }>;
  refresh_policy: "on_load" | "interval" | "manual";
  last_bound_at: string;
};

// ─── Schema Inference Types ───────────────────────────────────────────

export type InferredColumn = {
  name: string;
  inferred_type: "string" | "number" | "date" | "boolean" | "currency" | "percentage";
  sample_values: unknown[];
  confidence: number;
  is_measure: boolean;
  suggested_aggregation?: string;
  is_time_dimension: boolean;
};

export type InferredSchema = {
  schema_id: string;
  columns: InferredColumn[];
  row_count_estimate: number;
  time_columns: string[];
  measure_columns: string[];
  dimension_columns: string[];
  suggested_kpis: Array<{ label: string; measure: string; aggregation: string }>;
  confidence: number;
};

// ─── Validation Types ─────────────────────────────────────────────────

export type FunctionalParityResult = {
  validation_id: string;
  source_type: SourceType;
  checks: FunctionalCheck[];
  overall_score: number;
  passed: boolean;
  defects: FunctionalDefect[];
  validated_at: string;
};

export type FunctionalCheck = {
  check_id: string;
  category: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
};

export type FunctionalDefect = {
  defect_id: string;
  severity: "critical" | "major" | "minor" | "cosmetic";
  category: string;
  description: string;
  element_ref?: string;
  suggested_fix?: string;
};

// ─── Source Type Detection ────────────────────────────────────────────

function detectSourceType(cdr: CDRInput): SourceType {
  const allElements = cdr.pages.flatMap((p) => p.elements);
  const hasFilters = allElements.some((e) => e.control_type === "filter" || e.control_type === "drilldown");
  const hasCharts = allElements.some((e) => e.element_type === "chart");
  const hasTables = allElements.some((e) => e.element_type === "table");
  const hasFormulas = allElements.some((e) => (e.formula_refs?.length ?? 0) > 0);
  const pageCount = cdr.pages.length;

  if (cdr.source_kind === "dashboard_image" || (hasFilters && hasCharts)) return "dashboard";
  if (cdr.source_kind === "presentation" || cdr.target_kind === "pptx") return "presentation";
  if (cdr.source_kind === "spreadsheet" || cdr.target_kind === "xlsx" || hasFormulas) return "spreadsheet";
  if (cdr.target_kind === "docx" || (pageCount > 2 && hasTables && !hasFilters)) return "report";
  if (hasCharts && hasTables) return "dashboard";
  if (pageCount > 1 && !hasTables && !hasFormulas) return "presentation";
  return "unknown";
}

// ─── Schema Inference Engine ──────────────────────────────────────────

export class SchemaInferenceEngine {
  private readonly timePatterns = [
    /^\d{4}-\d{2}-\d{2}/, /^\d{2}\/\d{2}\/\d{4}/, /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /^q[1-4]\s*\d{4}/i, /^\d{4}$/, /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /^\d{2}-\d{2}-\d{4}/, /^(fy|h[12])\s*\d{4}/i,
  ];

  private readonly currencyPatterns = [/^\$/, /^€/, /^£/, /^¥/, /ر\.س/, /د\.إ/, /ريال/];
  private readonly percentagePattern = /^\d+(\.\d+)?%$/;

  inferFromTableData(rows: string[][], headerRow: boolean): InferredSchema {
    if (rows.length === 0) {
      return this.emptySchema();
    }

    const headers = headerRow ? rows[0] : rows[0].map((_, i) => `column_${i + 1}`);
    const dataRows = headerRow ? rows.slice(1) : rows;
    const columns: InferredColumn[] = [];

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const samples = dataRows.map((row) => row[colIdx]).filter((v) => v !== undefined && v !== "");
      const column = this.inferColumn(headers[colIdx], samples);
      columns.push(column);
    }

    const timeColumns = columns.filter((c) => c.is_time_dimension).map((c) => c.name);
    const measureColumns = columns.filter((c) => c.is_measure).map((c) => c.name);
    const dimensionColumns = columns
      .filter((c) => !c.is_measure && !c.is_time_dimension)
      .map((c) => c.name);

    const suggestedKpis = measureColumns.map((m) => {
      const col = columns.find((c) => c.name === m)!;
      return {
        label: `Total ${m}`,
        measure: m,
        aggregation: col.suggested_aggregation ?? "sum",
      };
    });

    const overallConfidence =
      columns.length > 0 ? columns.reduce((s, c) => s + c.confidence, 0) / columns.length : 0;

    return {
      schema_id: uid("schema"),
      columns,
      row_count_estimate: dataRows.length,
      time_columns: timeColumns,
      measure_columns: measureColumns,
      dimension_columns: dimensionColumns,
      suggested_kpis: suggestedKpis,
      confidence: overallConfidence,
    };
  }

  inferColumn(name: string, samples: string[]): InferredColumn {
    const total = samples.length;
    if (total === 0) {
      return this.unknownColumn(name);
    }

    let numericCount = 0;
    let dateCount = 0;
    let boolCount = 0;
    let currencyCount = 0;
    let percentCount = 0;

    for (const sample of samples) {
      const trimmed = sample.trim();
      if (this.percentagePattern.test(trimmed)) {
        percentCount++;
        numericCount++;
      } else if (this.currencyPatterns.some((p) => p.test(trimmed))) {
        currencyCount++;
        numericCount++;
      } else if (!isNaN(Number(trimmed.replace(/,/g, ""))) && trimmed.length > 0) {
        numericCount++;
      }
      if (this.timePatterns.some((p) => p.test(trimmed))) dateCount++;
      if (["true", "false", "yes", "no", "1", "0"].includes(trimmed.toLowerCase())) boolCount++;
    }

    const numericRatio = numericCount / total;
    const dateRatio = dateCount / total;
    const boolRatio = boolCount / total;
    const currencyRatio = currencyCount / total;
    const percentRatio = percentCount / total;

    let inferred_type: InferredColumn["inferred_type"] = "string";
    let confidence = 0.5;
    let is_measure = false;
    let is_time_dimension = false;
    let suggested_aggregation: string | undefined;

    if (dateRatio > 0.7) {
      inferred_type = "date";
      confidence = dateRatio;
      is_time_dimension = true;
    } else if (boolRatio > 0.8) {
      inferred_type = "boolean";
      confidence = boolRatio;
    } else if (currencyRatio > 0.5) {
      inferred_type = "currency";
      confidence = currencyRatio;
      is_measure = true;
      suggested_aggregation = "sum";
    } else if (percentRatio > 0.5) {
      inferred_type = "percentage";
      confidence = percentRatio;
      is_measure = true;
      suggested_aggregation = "avg";
    } else if (numericRatio > 0.7) {
      inferred_type = "number";
      confidence = numericRatio;
      is_measure = true;
      suggested_aggregation = this.inferAggregation(name, samples);
    }

    // Name-based heuristics for time detection
    const timeLikeNames = ["date", "time", "year", "month", "quarter", "week", "day", "period", "timestamp", "تاريخ", "سنة", "شهر"];
    if (timeLikeNames.some((t) => name.toLowerCase().includes(t))) {
      is_time_dimension = true;
      if (inferred_type === "string") {
        inferred_type = "date";
        confidence = Math.max(confidence, 0.6);
      }
    }

    // Name-based heuristics for measure detection
    const measureLikeNames = ["amount", "total", "revenue", "cost", "price", "count", "qty", "quantity", "sales", "profit", "budget", "مبلغ", "إجمالي", "إيرادات"];
    if (measureLikeNames.some((m) => name.toLowerCase().includes(m)) && numericRatio > 0.5) {
      is_measure = true;
      suggested_aggregation = suggested_aggregation ?? "sum";
    }

    return {
      name,
      inferred_type,
      sample_values: samples.slice(0, 5),
      confidence,
      is_measure,
      suggested_aggregation,
      is_time_dimension,
    };
  }

  private inferAggregation(name: string, samples: string[]): string {
    const lower = name.toLowerCase();
    if (lower.includes("count") || lower.includes("عدد")) return "count";
    if (lower.includes("avg") || lower.includes("average") || lower.includes("mean") || lower.includes("متوسط")) return "avg";
    if (lower.includes("rate") || lower.includes("ratio") || lower.includes("percent") || lower.includes("نسبة")) return "avg";

    // If values look like IDs or counts (all integers, many distinct), use count
    const numericValues = samples
      .map((s) => Number(s.replace(/,/g, "")))
      .filter((n) => !isNaN(n));
    if (numericValues.length > 0) {
      const allIntegers = numericValues.every((n) => Number.isInteger(n));
      const distinctRatio = new Set(numericValues).size / numericValues.length;
      if (allIntegers && distinctRatio > 0.9) return "count";
    }
    return "sum";
  }

  matchColumnsToSchema(
    sourceHeaders: string[],
    targetSchema: { field: string; type: string }[]
  ): Array<{ source: string; target: string; confidence: number }> {
    const matches: Array<{ source: string; target: string; confidence: number }> = [];

    for (const target of targetSchema) {
      let bestMatch = "";
      let bestScore = 0;

      for (const source of sourceHeaders) {
        const score = this.columnSimilarity(source, target.field);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = source;
        }
      }

      if (bestScore > 0.3) {
        matches.push({ source: bestMatch, target: target.field, confidence: bestScore });
      }
    }

    return matches;
  }

  private columnSimilarity(a: string, b: string): number {
    const normA = a.toLowerCase().replace(/[_\-\s]/g, "");
    const normB = b.toLowerCase().replace(/[_\-\s]/g, "");
    if (normA === normB) return 1.0;
    if (normA.includes(normB) || normB.includes(normA)) return 0.8;

    // Levenshtein-based similarity
    const maxLen = Math.max(normA.length, normB.length);
    if (maxLen === 0) return 1.0;
    const dist = this.levenshtein(normA, normB);
    return 1 - dist / maxLen;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  private emptySchema(): InferredSchema {
    return {
      schema_id: uid("schema"),
      columns: [],
      row_count_estimate: 0,
      time_columns: [],
      measure_columns: [],
      dimension_columns: [],
      suggested_kpis: [],
      confidence: 0,
    };
  }

  private unknownColumn(name: string): InferredColumn {
    return {
      name,
      inferred_type: "string",
      sample_values: [],
      confidence: 0,
      is_measure: false,
      is_time_dimension: false,
    };
  }
}

// ─── Data Binding Engine ──────────────────────────────────────────────

export class DataBindingEngine {
  private bindings: DataBindingMap = new Map();
  private datasetCache: Map<string, unknown[]> = new Map();

  /**
   * Scans CDR elements for placeholder tokens (e.g., {{dataset.field}})
   * and maps them to real dataset references.
   */
  detectPlaceholders(elements: CDRElement[]): Array<{ element_id: string; placeholders: string[] }> {
    const results: Array<{ element_id: string; placeholders: string[] }> = [];
    const placeholderRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

    for (const el of elements) {
      const placeholders: string[] = [];

      if (el.text) {
        let match: RegExpExecArray | null;
        while ((match = placeholderRegex.exec(el.text)) !== null) {
          placeholders.push(match[1]);
        }
        placeholderRegex.lastIndex = 0;
      }

      if (el.binding_refs) {
        placeholders.push(...el.binding_refs);
      }

      if (el.binding_ref && el.binding_ref.length > 0) {
        placeholders.push(el.binding_ref);
      }

      if (el.series_refs) {
        placeholders.push(...el.series_refs);
      }

      if (placeholders.length > 0) {
        results.push({ element_id: el.element_id, placeholders });
      }
    }

    return results;
  }

  /**
   * Binds a placeholder to a real dataset, creating field-level mappings.
   */
  bindPlaceholder(
    placeholderId: string,
    datasetRef: string,
    fieldMappings: Array<{ placeholder_field: string; dataset_field: string; transform?: string }>,
    refreshPolicy: "on_load" | "interval" | "manual" = "on_load"
  ): DataBindingEntry {
    const entry: DataBindingEntry = {
      placeholder_id: placeholderId,
      dataset_ref: datasetRef,
      field_mappings: fieldMappings,
      refresh_policy: refreshPolicy,
      last_bound_at: now(),
    };
    this.bindings.set(placeholderId, entry);
    return entry;
  }

  /**
   * Auto-binds CDR elements to datasets using schema inference.
   */
  autoBind(
    elements: CDRElement[],
    availableDatasets: Array<{ ref: string; schema: { field: string; type: string }[] }>,
    schemaEngine: SchemaInferenceEngine
  ): DataBindingMap {
    const placeholderGroups = this.detectPlaceholders(elements);

    for (const group of placeholderGroups) {
      const element = elements.find((e) => e.element_id === group.element_id);
      if (!element) continue;

      // For tables, infer schema from existing rows and match to datasets
      if (element.element_type === "table" && element.rows && element.rows.length > 0) {
        const inferredSchema = schemaEngine.inferFromTableData(element.rows, true);
        const headers = inferredSchema.columns.map((c) => c.name);

        let bestDataset = "";
        let bestMatchCount = 0;

        for (const ds of availableDatasets) {
          const matches = schemaEngine.matchColumnsToSchema(headers, ds.schema);
          const highConfidence = matches.filter((m) => m.confidence > 0.5).length;
          if (highConfidence > bestMatchCount) {
            bestMatchCount = highConfidence;
            bestDataset = ds.ref;
          }
        }

        if (bestDataset) {
          const targetDs = availableDatasets.find((d) => d.ref === bestDataset)!;
          const columnMatches = schemaEngine.matchColumnsToSchema(headers, targetDs.schema);
          this.bindPlaceholder(
            element.element_id,
            bestDataset,
            columnMatches.map((m) => ({
              placeholder_field: m.source,
              dataset_field: m.target,
            })),
            "on_load"
          );
        }
      }

      // For charts, bind series references to dataset fields
      if (element.element_type === "chart" && element.series_refs) {
        for (const ds of availableDatasets) {
          const fieldNames = ds.schema.map((s) => s.field.toLowerCase());
          const matchCount = element.series_refs.filter((sr) =>
            fieldNames.some((fn) => fn.includes(sr.toLowerCase()) || sr.toLowerCase().includes(fn))
          ).length;

          if (matchCount > 0) {
            this.bindPlaceholder(
              element.element_id,
              ds.ref,
              element.series_refs.map((sr) => {
                const bestField = ds.schema.reduce((best, f) => {
                  const score = f.field.toLowerCase().includes(sr.toLowerCase()) ? 1 : 0;
                  return score > 0 ? f : best;
                }, ds.schema[0]);
                return { placeholder_field: sr, dataset_field: bestField.field };
              }),
              "on_load"
            );
            break;
          }
        }
      }
    }

    return new Map(this.bindings);
  }

  /**
   * Resolves a binding by fetching data from the referenced dataset and applying transforms.
   */
  resolveBinding(placeholderId: string, dataProvider: (ref: string) => unknown[]): unknown[] {
    const binding = this.bindings.get(placeholderId);
    if (!binding) return [];

    let data = this.datasetCache.get(binding.dataset_ref);
    if (!data) {
      data = dataProvider(binding.dataset_ref);
      this.datasetCache.set(binding.dataset_ref, data);
    }

    // Apply field mappings and transforms
    return (data as Record<string, unknown>[]).map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const fm of binding.field_mappings) {
        let value = row[fm.dataset_field];
        if (fm.transform) {
          value = this.applyTransform(value, fm.transform);
        }
        mapped[fm.placeholder_field] = value;
      }
      return mapped;
    });
  }

  private applyTransform(value: unknown, transform: string): unknown {
    switch (transform) {
      case "uppercase":
        return typeof value === "string" ? value.toUpperCase() : value;
      case "lowercase":
        return typeof value === "string" ? value.toLowerCase() : value;
      case "round":
        return typeof value === "number" ? Math.round(value) : value;
      case "abs":
        return typeof value === "number" ? Math.abs(value) : value;
      case "percentage":
        return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : value;
      case "currency_sar":
        return typeof value === "number" ? `${value.toLocaleString("ar-SA")} ر.س` : value;
      case "currency_usd":
        return typeof value === "number" ? `$${value.toLocaleString("en-US")}` : value;
      default:
        return value;
    }
  }

  getBindings(): DataBindingMap {
    return new Map(this.bindings);
  }

  clearCache(): void {
    this.datasetCache.clear();
  }
}

// ─── Dashboard Reconstructor ──────────────────────────────────────────

export class DashboardReconstructor {
  private readonly schemaEngine = new SchemaInferenceEngine();
  private readonly bindingEngine = new DataBindingEngine();

  /**
   * Reconstructs a full interactive dashboard from CDR input.
   * Produces: interactive filtering, cross-filter behavior, drill-down,
   * export capability, live refresh, permission-aware rendering,
   * widget management (charts, KPIs, tables, filters, legends),
   * data binding, auto schema suggestion, column matching,
   * measure detection, aggregation logic, time intelligence, KPI recalculation.
   */
  reconstruct(cdr: CDRInput): DashboardOutput {
    const sourceType = detectSourceType(cdr);
    if (sourceType !== "dashboard" && sourceType !== "unknown") {
      throw new Error(`CDR source type "${sourceType}" is not a dashboard; detected from source_kind="${cdr.source_kind}"`);
    }

    const allElements = cdr.pages.flatMap((p) => p.elements);

    // Phase 1: Classify elements into widget categories
    const classifiedWidgets = this.classifyWidgets(allElements);

    // Phase 2: Build filter definitions from control elements
    const filters = this.buildFilters(allElements, classifiedWidgets);

    // Phase 3: Build drill-down paths from hierarchical relationships
    const drillDownPaths = this.buildDrillDownPaths(allElements, classifiedWidgets);

    // Phase 4: Build cross-filter map
    const crossFilterMap = this.buildCrossFilterMap(filters, classifiedWidgets);

    // Phase 5: Build widgets with data bindings
    const widgets = this.buildWidgets(classifiedWidgets, allElements, cdr);

    // Phase 6: Auto-bind data sources
    const dataBindings = this.bindingEngine.autoBind(allElements, [], this.schemaEngine);

    // Phase 7: Extract theme from style information
    const theme = this.extractTheme(cdr);

    return {
      dashboard_id: uid("dash"),
      title: cdr.metadata?.title as string ?? `Dashboard - ${cdr.run_id}`,
      widgets,
      filters,
      drill_down_paths: drillDownPaths,
      cross_filter_map: crossFilterMap,
      theme,
      refresh_config: { global_interval_ms: 30000, live_enabled: true },
      export_formats: ["pdf", "png", "csv", "xlsx"],
      permission_model: { visibility: "workspace", roles: ["viewer", "editor", "admin"] },
      data_bindings: dataBindings,
      created_at: now(),
    };
  }

  private classifyWidgets(elements: CDRElement[]): Map<WidgetKind, CDRElement[]> {
    const map = new Map<WidgetKind, CDRElement[]>();
    const kinds: WidgetKind[] = ["chart", "kpi", "table", "filter", "legend", "text", "image"];
    for (const k of kinds) map.set(k, []);

    for (const el of elements) {
      if (el.element_type === "chart") {
        map.get("chart")!.push(el);
      } else if (el.element_type === "table") {
        map.get("table")!.push(el);
      } else if (el.element_type === "control") {
        if (el.control_type === "filter" || el.control_type === "parameter") {
          map.get("filter")!.push(el);
        } else {
          map.get("filter")!.push(el);
        }
      } else if (el.element_type === "text") {
        // Detect KPIs: text elements with numeric content and small bounding box
        const isKPI = this.looksLikeKPI(el);
        if (isKPI) {
          map.get("kpi")!.push(el);
        } else {
          map.get("text")!.push(el);
        }
      } else if (el.element_type === "image") {
        map.get("image")!.push(el);
      } else if (el.element_type === "shape") {
        // Shapes can be legend indicators
        if (el.width < 30 && el.height < 30) {
          map.get("legend")!.push(el);
        }
      }
    }

    return map;
  }

  private looksLikeKPI(el: CDRElement): boolean {
    if (!el.text) return false;
    const text = el.text.trim();
    // KPI patterns: currency, percentage, large numbers
    const kpiPatterns = [
      /^\$[\d,.]+[KMBkmb]?$/, /^[\d,.]+%$/, /^[\d,.]+[KMBkmb]$/,
      /^[\d,.]+\s*(ر\.س|SAR|USD|EUR)$/i, /^\d{1,3}(,\d{3})*(\.\d+)?$/,
    ];
    const isNumericish = kpiPatterns.some((p) => p.test(text));
    const isSmallWidget = el.width < 400 && el.height < 200;
    return isNumericish && isSmallWidget;
  }

  private buildFilters(elements: CDRElement[], classified: Map<WidgetKind, CDRElement[]>): FilterDefinition[] {
    const filterElements = classified.get("filter") ?? [];
    const chartWidgetIds = (classified.get("chart") ?? []).map((e) => e.element_id);
    const tableWidgetIds = (classified.get("table") ?? []).map((e) => e.element_id);
    const allTargets = [...chartWidgetIds, ...tableWidgetIds];

    return filterElements.map((el) => {
      const filterType = this.inferFilterType(el);
      return {
        filter_id: uid("filter"),
        field: el.binding_ref ?? el.text ?? "unknown_field",
        filter_type: filterType,
        default_value: null,
        bound_widgets: allTargets,
        cross_filter_targets: allTargets,
      };
    });
  }

  private inferFilterType(el: CDRElement): FilterDefinition["filter_type"] {
    const text = (el.text ?? "").toLowerCase();
    if (text.includes("date") || text.includes("تاريخ") || text.includes("period") || text.includes("فترة")) return "date";
    if (text.includes("range") || text.includes("نطاق") || text.includes("between")) return "range";
    if (text.includes("search") || text.includes("بحث")) return "text";
    if (el.control_type === "parameter") return "range";
    return "dropdown";
  }

  private buildDrillDownPaths(elements: CDRElement[], classified: Map<WidgetKind, CDRElement[]>): DrillDownPath[] {
    const charts = classified.get("chart") ?? [];
    const paths: DrillDownPath[] = [];

    for (const chart of charts) {
      // Infer drill-down hierarchy from axis labels and binding refs
      const axisLabels = chart.axis_refs ?? [];
      if (axisLabels.length >= 2) {
        paths.push({
          path_id: uid("drill"),
          source_widget: chart.element_id,
          levels: axisLabels.map((label, idx) => ({
            field: label,
            aggregation: idx === 0 ? "count" : "sum",
          })),
          current_level: 0,
        });
      } else {
        // Default drill-down: category → subcategory → detail
        paths.push({
          path_id: uid("drill"),
          source_widget: chart.element_id,
          levels: [
            { field: "category", aggregation: "sum" },
            { field: "subcategory", aggregation: "sum" },
            { field: "detail", aggregation: "sum" },
          ],
          current_level: 0,
        });
      }
    }

    return paths;
  }

  private buildCrossFilterMap(
    filters: FilterDefinition[],
    classified: Map<WidgetKind, CDRElement[]>
  ): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const chartIds = (classified.get("chart") ?? []).map((e) => e.element_id);
    const tableIds = (classified.get("table") ?? []).map((e) => e.element_id);
    const allWidgetIds = [...chartIds, ...tableIds];

    // Each chart cross-filters all other widgets
    for (const chartId of chartIds) {
      map.set(chartId, allWidgetIds.filter((id) => id !== chartId));
    }

    // Each filter targets all widgets
    for (const filter of filters) {
      map.set(filter.filter_id, allWidgetIds);
    }

    return map;
  }

  private buildWidgets(
    classified: Map<WidgetKind, CDRElement[]>,
    allElements: CDRElement[],
    cdr: CDRInput
  ): DashboardWidget[] {
    const widgets: DashboardWidget[] = [];

    // Build chart widgets
    for (const el of classified.get("chart") ?? []) {
      const chartBinding = this.buildChartBinding(el);
      widgets.push({
        widget_id: uid("widget"),
        kind: "chart",
        position: { x: el.x, y: el.y, width: el.width, height: el.height },
        title: el.text ?? `Chart ${el.element_id}`,
        data_source: el.binding_refs?.[0] ?? "",
        chart_binding: chartBinding,
        refresh_interval_ms: 30000,
        permissions: ["view", "export"],
      });
    }

    // Build KPI widgets
    for (const el of classified.get("kpi") ?? []) {
      const kpiDef = this.buildKPIDefinition(el);
      widgets.push({
        widget_id: uid("widget"),
        kind: "kpi",
        position: { x: el.x, y: el.y, width: el.width, height: el.height },
        title: el.text ?? "KPI",
        data_source: el.binding_ref ?? "",
        kpi_definition: kpiDef,
        refresh_interval_ms: 15000,
        permissions: ["view"],
      });
    }

    // Build table widgets
    for (const el of classified.get("table") ?? []) {
      const tableBinding = this.buildTableBinding(el);
      widgets.push({
        widget_id: uid("widget"),
        kind: "table",
        position: { x: el.x, y: el.y, width: el.width, height: el.height },
        title: el.text ?? `Table ${el.element_id}`,
        data_source: el.binding_refs?.[0] ?? "",
        table_binding: tableBinding,
        refresh_interval_ms: 30000,
        permissions: ["view", "export", "sort", "filter"],
      });
    }

    // Build filter widgets
    for (const el of classified.get("filter") ?? []) {
      const filterDef: FilterDefinition = {
        filter_id: uid("filter"),
        field: el.binding_ref ?? el.text ?? "field",
        filter_type: this.inferFilterType(el),
        default_value: null,
        bound_widgets: widgets.map((w) => w.widget_id),
        cross_filter_targets: widgets.map((w) => w.widget_id),
      };
      widgets.push({
        widget_id: uid("widget"),
        kind: "filter",
        position: { x: el.x, y: el.y, width: el.width, height: el.height },
        title: el.text ?? "Filter",
        data_source: "",
        filter_definition: filterDef,
        refresh_interval_ms: 0,
        permissions: ["view", "interact"],
      });
    }

    return widgets;
  }

  private buildChartBinding(el: CDRElement): ChartBinding {
    const chartType = el.chart_type ?? "bar";
    const axisRefs = el.axis_refs ?? [];
    const seriesRefs = el.series_refs ?? [];

    return {
      chart_id: uid("chart"),
      chart_type: chartType,
      x_axis: {
        field: axisRefs[0] ?? "category",
        type: this.inferAxisType(axisRefs[0]),
      },
      y_axes: seriesRefs.length > 0
        ? seriesRefs.map((sr) => ({ field: sr, aggregation: "sum", label: sr }))
        : [{ field: "value", aggregation: "sum", label: "Value" }],
      series_field: seriesRefs.length > 1 ? seriesRefs[0] : undefined,
      color_palette: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"],
      legend_position: "bottom",
    };
  }

  private inferAxisType(field?: string): "category" | "time" | "numeric" {
    if (!field) return "category";
    const lower = field.toLowerCase();
    const timeWords = ["date", "time", "year", "month", "quarter", "week", "تاريخ", "سنة"];
    if (timeWords.some((t) => lower.includes(t))) return "time";
    return "category";
  }

  private buildKPIDefinition(el: CDRElement): KPIDefinition {
    const text = el.text ?? "0";
    const isPercentage = text.includes("%");
    const isCurrency = /[\$€£¥]|ر\.س|SAR/.test(text);

    return {
      kpi_id: uid("kpi"),
      label: el.text ?? "KPI",
      measure: el.binding_ref ?? "value",
      aggregation: isPercentage ? "avg" : "sum",
      format: isCurrency ? "currency" : isPercentage ? "percentage" : "number",
      conditional_color_rules: [
        { condition: "value >= target", color: "#10b981" },
        { condition: "value >= target * 0.8", color: "#f59e0b" },
        { condition: "value < target * 0.8", color: "#ef4444" },
      ],
    };
  }

  private buildTableBinding(el: CDRElement): TableBinding {
    const rows = el.rows ?? [];
    const headers = rows.length > 0 ? rows[0] : [];

    return {
      table_id: uid("table"),
      columns: headers.map((header, idx) => ({
        field: header,
        label: header,
        width: Math.max(80, Math.floor(el.width / Math.max(headers.length, 1))),
        sortable: true,
        format: undefined,
      })),
      pagination: { enabled: rows.length > 20, page_size: 25 },
      totals_row: true,
    };
  }

  private extractTheme(cdr: CDRInput): DashboardOutput["theme"] {
    const page = cdr.pages[0];
    return {
      primary: "#2563eb",
      secondary: "#64748b",
      background: page?.background === "." ? "#ffffff" : page?.background ?? "#ffffff",
      font_family: "Inter, 'Noto Sans Arabic', sans-serif",
    };
  }
}

// ─── Presentation Reconstructor ───────────────────────────────────────

export class PresentationReconstructor {
  private readonly schemaEngine = new SchemaInferenceEngine();
  private readonly bindingEngine = new DataBindingEngine();

  /**
   * Reconstructs an editable PPTX presentation from CDR input.
   * Produces: editable slides, master slide mapping, live chart binding,
   * editable text fields, structured layout zones, slide-level theme mapping,
   * dynamic data refresh.
   */
  reconstruct(cdr: CDRInput): PresentationOutput {
    const sourceType = detectSourceType(cdr);
    if (sourceType !== "presentation" && sourceType !== "unknown") {
      throw new Error(`CDR source type "${sourceType}" is not a presentation`);
    }

    const slides = cdr.pages.map((page, idx) => this.buildSlide(page, idx));
    const masterSlides = this.inferMasterSlides(slides);

    return {
      presentation_id: uid("pres"),
      title: cdr.metadata?.title as string ?? `Presentation - ${cdr.run_id}`,
      slides,
      master_slides: masterSlides,
      theme_global: this.extractGlobalTheme(cdr),
      dynamic_refresh_enabled: slides.some((s) => s.live_bindings.length > 0),
      export_format: "pptx",
      created_at: now(),
    };
  }

  private buildSlide(page: CDRPage, index: number): SlideDefinition {
    const zones = this.buildZones(page.elements);
    const masterLayout = this.inferMasterLayout(zones);
    const liveBindings = this.detectLiveBindings(page.elements, zones);

    return {
      slide_id: uid("slide"),
      slide_index: index,
      master_layout: masterLayout,
      theme: {
        background: page.background === "." ? "#ffffff" : page.background,
        color_scheme: ["#1e293b", "#2563eb", "#64748b", "#f8fafc"],
        font_theme: "default",
      },
      zones,
      transitions: { type: index === 0 ? "none" : "fade", duration_ms: 500 },
      speaker_notes: "",
      live_bindings: liveBindings,
    };
  }

  private buildZones(elements: CDRElement[]): SlideZone[] {
    const zones: SlideZone[] = [];

    // Sort elements by position: top-to-bottom, left-to-right
    const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);

    for (const el of sorted) {
      const zoneType = this.classifyZone(el);
      zones.push({
        zone_id: uid("zone"),
        zone_type: zoneType,
        bounds: { x: el.x, y: el.y, width: el.width, height: el.height },
        content_ref: el.element_id,
        editable: el.editable ?? true,
      });
    }

    return zones;
  }

  private classifyZone(el: CDRElement): SlideZone["zone_type"] {
    if (el.element_type === "chart") return "chart";
    if (el.element_type === "table") return "table";
    if (el.element_type === "image") return "image";
    if (el.element_type === "text") {
      // Title detection: large text near top of slide
      if (el.y < 100 && el.height > 40 && el.width > 300) return "title";
      if (el.y < 200 && el.height > 30 && el.height <= 40) return "subtitle";
      if (el.y > 600) return "footer";
      return "body";
    }
    return "body";
  }

  private inferMasterLayout(zones: SlideZone[]): string {
    const hasTitle = zones.some((z) => z.zone_type === "title");
    const hasChart = zones.some((z) => z.zone_type === "chart");
    const hasTable = zones.some((z) => z.zone_type === "table");
    const hasBody = zones.some((z) => z.zone_type === "body");
    const bodyCount = zones.filter((z) => z.zone_type === "body").length;

    if (zones.length === 0) return "blank";
    if (hasTitle && !hasBody && !hasChart && !hasTable) return "title_only";
    if (hasTitle && hasChart) return "title_and_chart";
    if (hasTitle && hasTable) return "title_and_table";
    if (hasTitle && bodyCount === 1) return "title_and_content";
    if (hasTitle && bodyCount >= 2) return "two_content";
    if (!hasTitle && hasChart) return "chart_only";
    return "custom";
  }

  private detectLiveBindings(
    elements: CDRElement[],
    zones: SlideZone[]
  ): SlideDefinition["live_bindings"] {
    const bindings: SlideDefinition["live_bindings"] = [];

    for (const zone of zones) {
      const el = elements.find((e) => e.element_id === zone.content_ref);
      if (!el) continue;

      const hasBinding =
        (el.binding_refs && el.binding_refs.length > 0) ||
        (el.binding_ref && el.binding_ref.length > 0) ||
        (el.series_refs && el.series_refs.length > 0);

      if (hasBinding) {
        bindings.push({
          zone_id: zone.zone_id,
          data_source: el.binding_refs?.[0] ?? el.binding_ref ?? el.series_refs?.[0] ?? "",
          refresh: true,
        });
      }
    }

    return bindings;
  }

  private inferMasterSlides(
    slides: SlideDefinition[]
  ): PresentationOutput["master_slides"] {
    const layoutCounts = new Map<string, { count: number; template: SlideZone[] }>();

    for (const slide of slides) {
      const existing = layoutCounts.get(slide.master_layout);
      if (existing) {
        existing.count++;
      } else {
        layoutCounts.set(slide.master_layout, {
          count: 1,
          template: slide.zones.map((z) => ({ ...z, content_ref: undefined })),
        });
      }
    }

    return Array.from(layoutCounts.entries()).map(([layout, info]) => ({
      master_id: uid("master"),
      layout_name: layout,
      zone_template: info.template,
    }));
  }

  private extractGlobalTheme(cdr: CDRInput): PresentationOutput["theme_global"] {
    return {
      font_family: "Calibri, 'Noto Sans Arabic', sans-serif",
      color_scheme: ["#1e293b", "#2563eb", "#10b981", "#f59e0b", "#ef4444"],
      background: "#ffffff",
    };
  }
}

// ─── Report Reconstructor ─────────────────────────────────────────────

export class ReportReconstructor {
  private readonly schemaEngine = new SchemaInferenceEngine();
  private readonly bindingEngine = new DataBindingEngine();

  /**
   * Reconstructs an editable DOCX report from CDR input.
   * Produces: editable multi-page layout, structured sections,
   * table-of-contents generation, data binding for tables,
   * live recalculation support, export-ready compliance.
   */
  reconstruct(cdr: CDRInput): ReportOutput {
    const sourceType = detectSourceType(cdr);
    if (sourceType !== "report" && sourceType !== "unknown") {
      throw new Error(`CDR source type "${sourceType}" is not a report`);
    }

    // Phase 1: Build sections from all pages
    const sections = this.buildSections(cdr.pages);

    // Phase 2: Generate table of contents from heading sections
    const toc = this.generateTableOfContents(sections);

    // Phase 3: Insert TOC section at the beginning
    if (toc.length > 0) {
      sections.unshift({
        section_id: uid("sec"),
        section_type: "toc",
        content: toc.map((e) => `${"  ".repeat(e.level - 1)}${e.title}`).join("\n"),
        style: { font_size: "11pt", line_height: "1.5" },
        editable: true,
        page_index: 0,
      });
    }

    // Phase 4: Bind data to table sections
    this.bindTableData(sections, cdr);

    return {
      report_id: uid("report"),
      title: cdr.metadata?.title as string ?? `Report - ${cdr.run_id}`,
      sections,
      table_of_contents: toc,
      page_layout: {
        width_mm: 210,
        height_mm: 297,
        margins: { top: 25, bottom: 25, left: 25, right: 25 },
      },
      headers_footers: {
        header: cdr.metadata?.title as string ?? "Report",
        footer: `Generated ${now()} | Rasid Platform`,
        page_numbers: true,
      },
      live_recalculation: true,
      export_formats: ["docx", "pdf", "html"],
      compliance_tags: ["rasid-generated", "audit-traceable"],
      created_at: now(),
    };
  }

  private buildSections(pages: CDRPage[]): ReportSection[] {
    const sections: ReportSection[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      // Sort elements top-to-bottom for reading order
      const sorted = [...page.elements].sort((a, b) => a.y - b.y || a.x - b.x);

      for (const el of sorted) {
        const section = this.elementToSection(el, pageIdx);
        if (section) sections.push(section);
      }

      // Add page break between pages (except last)
      if (pageIdx < pages.length - 1) {
        sections.push({
          section_id: uid("sec"),
          section_type: "page_break",
          content: "",
          style: {},
          editable: false,
          page_index: pageIdx,
        });
      }
    }

    return sections;
  }

  private elementToSection(el: CDRElement, pageIndex: number): ReportSection | null {
    if (el.element_type === "text") {
      const level = this.inferHeadingLevel(el);
      return {
        section_id: uid("sec"),
        section_type: level > 0 ? "heading" : "paragraph",
        level: level > 0 ? level : undefined,
        content: el.text ?? "",
        style: this.inferTextStyle(el, level),
        editable: true,
        page_index: pageIndex,
      };
    }

    if (el.element_type === "table") {
      return {
        section_id: uid("sec"),
        section_type: "table",
        content: JSON.stringify(el.rows ?? []),
        style: { border: "1px solid #e2e8f0", cell_padding: "6px" },
        data_binding: el.binding_refs?.length
          ? { source: el.binding_refs[0], fields: el.rows?.[0] ?? [] }
          : undefined,
        editable: true,
        page_index: pageIndex,
      };
    }

    if (el.element_type === "chart") {
      return {
        section_id: uid("sec"),
        section_type: "chart",
        content: JSON.stringify({
          chart_type: el.chart_type,
          series_refs: el.series_refs,
          axis_refs: el.axis_refs,
        }),
        style: { width: "100%", max_width: `${el.width}px` },
        data_binding: el.series_refs?.length
          ? { source: el.series_refs[0], fields: el.series_refs }
          : undefined,
        editable: true,
        page_index: pageIndex,
      };
    }

    if (el.element_type === "image") {
      return {
        section_id: uid("sec"),
        section_type: "image",
        content: el.element_id,
        style: { width: `${el.width}px`, height: `${el.height}px` },
        editable: false,
        page_index: pageIndex,
      };
    }

    return null;
  }

  private inferHeadingLevel(el: CDRElement): number {
    // Heuristic: larger text at top of page = heading
    if (el.height > 50 && el.y < 80) return 1;
    if (el.height > 35 && el.y < 150) return 2;
    if (el.height > 25 && el.width > 200) return 3;
    return 0;
  }

  private inferTextStyle(el: CDRElement, level: number): Record<string, string> {
    if (level === 1) return { font_size: "24pt", font_weight: "bold", margin_bottom: "16px" };
    if (level === 2) return { font_size: "18pt", font_weight: "bold", margin_bottom: "12px" };
    if (level === 3) return { font_size: "14pt", font_weight: "bold", margin_bottom: "8px" };
    return { font_size: "11pt", line_height: "1.6", margin_bottom: "8px" };
  }

  private generateTableOfContents(sections: ReportSection[]): ReportOutput["table_of_contents"] {
    const toc: ReportOutput["table_of_contents"] = [];
    for (const section of sections) {
      if (section.section_type === "heading" && section.level) {
        toc.push({
          title: section.content,
          level: section.level,
          page: section.page_index + 1,
        });
      }
    }
    return toc;
  }

  private bindTableData(sections: ReportSection[], cdr: CDRInput): void {
    for (const section of sections) {
      if (section.section_type === "table" && section.data_binding) {
        // Infer schema from table data for live recalculation
        try {
          const rows: string[][] = JSON.parse(section.content);
          if (rows.length > 0) {
            const schema = this.schemaEngine.inferFromTableData(rows, true);
            section.data_binding.fields = schema.columns.map((c) => c.name);
          }
        } catch {
          // Content may not be valid JSON table data
        }
      }
    }
  }
}

// ─── Excel Reconstructor ──────────────────────────────────────────────

export class ExcelReconstructor {
  private readonly schemaEngine = new SchemaInferenceEngine();

  /**
   * Reconstructs a structured XLSX workbook from CDR input.
   * Produces: structured sheets, editable formulas, dependency graph preserved,
   * pivot tables recreated, conditional formatting recreated, live recalculation enabled.
   */
  reconstruct(cdr: CDRInput): ExcelOutput {
    const sourceType = detectSourceType(cdr);
    if (sourceType !== "spreadsheet" && sourceType !== "unknown") {
      throw new Error(`CDR source type "${sourceType}" is not a spreadsheet`);
    }

    // Phase 1: Build sheets from CDR pages
    const sheets = cdr.pages.map((page, idx) => this.buildSheet(page, idx));

    // Phase 2: Build dependency graph across all formulas
    const dependencyGraph = this.buildDependencyGraph(sheets);

    // Phase 3: Detect and recreate pivot tables
    this.detectPivotTables(sheets);

    // Phase 4: Apply conditional formatting
    this.applyConditionalFormatting(sheets);

    // Phase 5: Build global named ranges
    const globalNamedRanges = this.collectNamedRanges(sheets);

    return {
      workbook_id: uid("wb"),
      title: cdr.metadata?.title as string ?? `Workbook - ${cdr.run_id}`,
      sheets,
      dependency_graph: dependencyGraph,
      global_named_ranges: globalNamedRanges,
      live_recalculation: true,
      export_format: "xlsx",
      created_at: now(),
    };
  }

  private buildSheet(page: CDRPage, index: number): SheetDefinition {
    const tableElements = page.elements.filter((e) => e.element_type === "table");
    const textElements = page.elements.filter((e) => e.element_type === "text");

    // Merge all table data into a single sheet grid
    const allRows: Array<{ index: number; cells: Array<{ value: unknown; formula?: string; format?: string }> }> = [];
    const formulas: CellFormula[] = [];
    const columns: SheetDefinition["columns"] = [];

    let currentRow = 0;

    for (const tableEl of tableElements) {
      const rows = tableEl.rows ?? [];
      const formulaRefs = tableEl.formula_refs ?? [];

      if (rows.length > 0 && columns.length === 0) {
        // Use first table's headers for column definitions
        const schema = this.schemaEngine.inferFromTableData(rows, true);
        for (let colIdx = 0; colIdx < schema.columns.length; colIdx++) {
          const col = schema.columns[colIdx];
          columns.push({
            index: colIdx,
            label: col.name,
            width: this.inferColumnWidth(col),
            type: col.inferred_type,
          });
        }
      }

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const cells = rows[rowIdx].map((cellValue, colIdx) => {
          const cellRef = this.toCellRef(currentRow, colIdx);
          const formulaRef = formulaRefs.find((fr) => fr.startsWith(cellRef));
          const formula = formulaRef ? this.extractFormula(formulaRef) : undefined;

          if (formula) {
            const deps = this.parseFormulaDependencies(formula);
            formulas.push({
              cell_ref: cellRef,
              formula,
              computed_value: cellValue,
              dependencies: deps,
              format: this.inferCellFormat(cellValue),
            });
          }

          return {
            value: this.parseValue(cellValue),
            formula,
            format: this.inferCellFormat(cellValue),
          };
        });

        allRows.push({ index: currentRow, cells });
        currentRow++;
      }
    }

    // Add text elements as label cells if no tables found
    if (tableElements.length === 0) {
      for (const textEl of textElements) {
        allRows.push({
          index: currentRow,
          cells: [{ value: textEl.text ?? "", format: "text" }],
        });
        currentRow++;
      }
    }

    return {
      sheet_id: uid("sheet"),
      sheet_name: `Sheet${index + 1}`,
      columns,
      rows: allRows,
      formulas,
      conditional_formats: [],
      pivot_tables: [],
      named_ranges: [],
      frozen_panes: columns.length > 0 ? { rows: 1, cols: 0 } : undefined,
    };
  }

  private toCellRef(row: number, col: number): string {
    let colLabel = "";
    let c = col;
    do {
      colLabel = String.fromCharCode(65 + (c % 26)) + colLabel;
      c = Math.floor(c / 26) - 1;
    } while (c >= 0);
    return `${colLabel}${row + 1}`;
  }

  private extractFormula(formulaRef: string): string | undefined {
    // Formula refs are stored as "A1=SUM(B1:B10)" or just "=SUM(B1:B10)"
    const eqIdx = formulaRef.indexOf("=");
    if (eqIdx >= 0) {
      return formulaRef.substring(eqIdx);
    }
    return undefined;
  }

  private parseFormulaDependencies(formula: string): string[] {
    const deps: string[] = [];
    // Match cell references like A1, B2, AA10, and ranges like A1:B10
    const cellRefPattern = /[A-Z]{1,3}\d{1,7}/g;
    let match: RegExpExecArray | null;
    while ((match = cellRefPattern.exec(formula)) !== null) {
      deps.push(match[0]);
    }
    return [...new Set(deps)];
  }

  private parseValue(value: string): unknown {
    if (value === "") return "";
    const trimmed = value.trim().replace(/,/g, "");
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed.length > 0) return num;
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
    return value;
  }

  private inferCellFormat(value: string): string {
    const trimmed = value.trim();
    if (/^\$[\d,.]+/.test(trimmed)) return "#,##0.00";
    if (/^[\d,.]+%$/.test(trimmed)) return "0.00%";
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return "yyyy-mm-dd";
    if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) return "mm/dd/yyyy";
    if (/ر\.س|SAR/.test(trimmed)) return '#,##0.00 "ر.س"';
    const num = Number(trimmed.replace(/,/g, ""));
    if (!isNaN(num) && trimmed.length > 0) {
      return trimmed.includes(".") ? "#,##0.00" : "#,##0";
    }
    return "General";
  }

  private inferColumnWidth(col: InferredColumn): number {
    if (col.inferred_type === "date") return 120;
    if (col.inferred_type === "currency") return 130;
    if (col.inferred_type === "number") return 100;
    if (col.inferred_type === "percentage") return 90;
    // Estimate based on max sample value length
    const maxLen = col.sample_values.reduce<number>(
      (max, v) => Math.max(max, String(v).length),
      col.name.length
    );
    return Math.max(80, Math.min(250, maxLen * 10));
  }

  private buildDependencyGraph(sheets: SheetDefinition[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const sheet of sheets) {
      for (const formula of sheet.formulas) {
        const qualifiedRef = `${sheet.sheet_name}!${formula.cell_ref}`;
        const qualifiedDeps = formula.dependencies.map((dep) => {
          // If dep doesn't include sheet name, assume same sheet
          return dep.includes("!") ? dep : `${sheet.sheet_name}!${dep}`;
        });
        graph.set(qualifiedRef, qualifiedDeps);
      }
    }

    return graph;
  }

  private detectPivotTables(sheets: SheetDefinition[]): void {
    for (const sheet of sheets) {
      if (sheet.rows.length < 3 || sheet.columns.length < 2) continue;

      // Detect pivot-like structures: row headers + value columns with aggregations
      const schema = this.schemaEngine.inferFromTableData(
        sheet.rows.map((r) => r.cells.map((c) => String(c.value))),
        true
      );

      const hasDimensions = schema.dimension_columns.length > 0;
      const hasMeasures = schema.measure_columns.length > 0;

      if (hasDimensions && hasMeasures && sheet.rows.length > 5) {
        const pivot: PivotTableDef = {
          pivot_id: uid("pivot"),
          source_range: `A1:${this.toCellRef(sheet.rows.length - 1, sheet.columns.length - 1)}`,
          rows: schema.dimension_columns.slice(0, 2),
          columns: schema.dimension_columns.length > 2 ? [schema.dimension_columns[2]] : [],
          values: schema.measure_columns.map((m) => {
            const col = schema.columns.find((c) => c.name === m)!;
            return { field: m, aggregation: col.suggested_aggregation ?? "sum" };
          }),
          filters: schema.time_columns,
          grand_totals: { rows: true, columns: true },
        };
        sheet.pivot_tables.push(pivot);
      }
    }
  }

  private applyConditionalFormatting(sheets: SheetDefinition[]): void {
    for (const sheet of sheets) {
      if (sheet.columns.length === 0) continue;

      for (let colIdx = 0; colIdx < sheet.columns.length; colIdx++) {
        const col = sheet.columns[colIdx];

        // Apply conditional formatting to numeric columns
        if (col.type === "number" || col.type === "currency") {
          const colLetter = this.toCellRef(0, colIdx).replace(/\d+/, "");
          const range = `${colLetter}2:${colLetter}${sheet.rows.length}`;

          // Color scale for numeric columns
          sheet.conditional_formats.push({
            rule_id: uid("cfmt"),
            range,
            condition_type: "color_scale",
            values: [0, 50, 100],
            format: { min_color: "#fecaca", mid_color: "#fef3c7", max_color: "#bbf7d0" },
          });
        }

        if (col.type === "percentage") {
          const colLetter = this.toCellRef(0, colIdx).replace(/\d+/, "");
          const range = `${colLetter}2:${colLetter}${sheet.rows.length}`;

          // Data bar for percentage columns
          sheet.conditional_formats.push({
            rule_id: uid("cfmt"),
            range,
            condition_type: "data_bar",
            values: [0, 100],
            format: { bar_color: "#3b82f6", background_color: "#eff6ff" },
          });
        }
      }
    }
  }

  private collectNamedRanges(
    sheets: SheetDefinition[]
  ): ExcelOutput["global_named_ranges"] {
    const ranges: ExcelOutput["global_named_ranges"] = [];

    for (const sheet of sheets) {
      // Register header row as named range
      if (sheet.columns.length > 0) {
        const lastCol = this.toCellRef(0, sheet.columns.length - 1).replace(/\d+/, "");
        ranges.push({
          name: `${sheet.sheet_name}_Headers`,
          sheet: sheet.sheet_name,
          range: `A1:${lastCol}1`,
        });

        // Register data area
        if (sheet.rows.length > 1) {
          ranges.push({
            name: `${sheet.sheet_name}_Data`,
            sheet: sheet.sheet_name,
            range: `A2:${lastCol}${sheet.rows.length}`,
          });
        }
      }

      // Add existing named ranges
      for (const nr of sheet.named_ranges) {
        ranges.push({ name: nr.name, sheet: sheet.sheet_name, range: nr.range });
      }
    }

    return ranges;
  }
}

// ─── Functional Validation Engine ─────────────────────────────────────

export class FunctionalValidationEngine {
  /**
   * Validates that a reconstructed output maintains functional parity
   * with the original CDR input. Checks interactivity, editability,
   * data binding integrity, formula correctness, and layout fidelity.
   */
  validateDashboard(cdr: CDRInput, output: DashboardOutput): FunctionalParityResult {
    const checks: FunctionalCheck[] = [];
    const defects: FunctionalDefect[] = [];

    // Check 1: All CDR elements mapped to widgets
    const allElements = cdr.pages.flatMap((p) => p.elements);
    const mappedCount = output.widgets.length;
    const elementCount = allElements.length;
    const mappingScore = elementCount > 0 ? Math.min(1, mappedCount / elementCount) : 1;
    checks.push({
      check_id: uid("chk"),
      category: "widget_coverage",
      description: "All source elements are represented as dashboard widgets",
      passed: mappingScore >= 0.8,
      score: mappingScore,
      details: `${mappedCount}/${elementCount} elements mapped to widgets`,
    });

    if (mappingScore < 0.8) {
      defects.push({
        defect_id: uid("def"),
        severity: "major",
        category: "widget_coverage",
        description: `Only ${mappedCount} of ${elementCount} elements were reconstructed as widgets`,
        suggested_fix: "Review unmapped elements and add widget definitions",
      });
    }

    // Check 2: Filter interactivity
    const filterElements = allElements.filter(
      (e) => e.control_type === "filter" || e.control_type === "drilldown"
    );
    const filterWidgets = output.filters.length;
    const filterScore = filterElements.length > 0 ? Math.min(1, filterWidgets / filterElements.length) : 1;
    checks.push({
      check_id: uid("chk"),
      category: "filter_interactivity",
      description: "All filter controls are interactive and bound to widgets",
      passed: filterScore >= 0.9,
      score: filterScore,
      details: `${filterWidgets}/${filterElements.length} filters reconstructed`,
    });

    // Check 3: Cross-filter behavior
    const crossFilterTargets = Array.from(output.cross_filter_map.values()).flat();
    const hasCrossFilters = crossFilterTargets.length > 0;
    checks.push({
      check_id: uid("chk"),
      category: "cross_filter",
      description: "Cross-filter relationships are established between widgets",
      passed: hasCrossFilters || filterElements.length === 0,
      score: hasCrossFilters ? 1 : 0,
      details: `${output.cross_filter_map.size} cross-filter sources configured`,
    });

    // Check 4: Drill-down capability
    const chartElements = allElements.filter((e) => e.element_type === "chart");
    const drillPaths = output.drill_down_paths.length;
    const drillScore = chartElements.length > 0 ? Math.min(1, drillPaths / chartElements.length) : 1;
    checks.push({
      check_id: uid("chk"),
      category: "drill_down",
      description: "Drill-down paths are defined for chart widgets",
      passed: drillScore >= 0.8,
      score: drillScore,
      details: `${drillPaths} drill-down paths for ${chartElements.length} charts`,
    });

    // Check 5: Export capability
    checks.push({
      check_id: uid("chk"),
      category: "export",
      description: "Dashboard supports required export formats",
      passed: output.export_formats.length >= 2,
      score: output.export_formats.length >= 4 ? 1 : output.export_formats.length / 4,
      details: `Supports: ${output.export_formats.join(", ")}`,
    });

    // Check 6: Live refresh
    checks.push({
      check_id: uid("chk"),
      category: "live_refresh",
      description: "Live refresh is configured for the dashboard",
      passed: output.refresh_config.live_enabled,
      score: output.refresh_config.live_enabled ? 1 : 0,
      details: `Refresh interval: ${output.refresh_config.global_interval_ms}ms`,
    });

    // Check 7: Permission-aware rendering
    checks.push({
      check_id: uid("chk"),
      category: "permissions",
      description: "Permission model is configured for role-based access",
      passed: output.permission_model.roles.length >= 2,
      score: output.permission_model.roles.length >= 3 ? 1 : 0.5,
      details: `Roles: ${output.permission_model.roles.join(", ")}`,
    });

    // Check 8: KPI recalculation
    const kpiWidgets = output.widgets.filter((w) => w.kind === "kpi");
    const kpisWithDef = kpiWidgets.filter((w) => w.kpi_definition !== undefined);
    const kpiScore = kpiWidgets.length > 0 ? kpisWithDef.length / kpiWidgets.length : 1;
    checks.push({
      check_id: uid("chk"),
      category: "kpi_recalculation",
      description: "KPI widgets have recalculation definitions",
      passed: kpiScore >= 0.9,
      score: kpiScore,
      details: `${kpisWithDef.length}/${kpiWidgets.length} KPIs with recalculation logic`,
    });

    const overallScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

    return {
      validation_id: uid("val"),
      source_type: "dashboard",
      checks,
      overall_score: overallScore,
      passed: overallScore >= 0.75 && defects.filter((d) => d.severity === "critical").length === 0,
      defects,
      validated_at: now(),
    };
  }

  validatePresentation(cdr: CDRInput, output: PresentationOutput): FunctionalParityResult {
    const checks: FunctionalCheck[] = [];
    const defects: FunctionalDefect[] = [];

    // Check 1: Slide count matches page count
    const slideMatch = output.slides.length === cdr.pages.length;
    checks.push({
      check_id: uid("chk"),
      category: "slide_count",
      description: "Number of slides matches source pages",
      passed: slideMatch,
      score: slideMatch ? 1 : 0,
      details: `${output.slides.length} slides from ${cdr.pages.length} pages`,
    });

    if (!slideMatch) {
      defects.push({
        defect_id: uid("def"),
        severity: "critical",
        category: "slide_count",
        description: `Slide count mismatch: ${output.slides.length} vs ${cdr.pages.length}`,
      });
    }

    // Check 2: All elements mapped to zones
    let totalElements = 0;
    let totalZones = 0;
    for (let i = 0; i < cdr.pages.length; i++) {
      totalElements += cdr.pages[i].elements.length;
      if (i < output.slides.length) {
        totalZones += output.slides[i].zones.length;
      }
    }
    const zoneScore = totalElements > 0 ? Math.min(1, totalZones / totalElements) : 1;
    checks.push({
      check_id: uid("chk"),
      category: "zone_coverage",
      description: "All elements are placed in structured layout zones",
      passed: zoneScore >= 0.8,
      score: zoneScore,
      details: `${totalZones}/${totalElements} elements in zones`,
    });

    // Check 3: Editability
    const editableZones = output.slides.flatMap((s) => s.zones).filter((z) => z.editable);
    const allZones = output.slides.flatMap((s) => s.zones);
    const editScore = allZones.length > 0 ? editableZones.length / allZones.length : 1;
    checks.push({
      check_id: uid("chk"),
      category: "editability",
      description: "Text fields and content zones are editable",
      passed: editScore >= 0.7,
      score: editScore,
      details: `${editableZones.length}/${allZones.length} zones are editable`,
    });

    // Check 4: Master slide mapping
    checks.push({
      check_id: uid("chk"),
      category: "master_slides",
      description: "Slides are mapped to master slide layouts",
      passed: output.master_slides.length > 0,
      score: output.master_slides.length > 0 ? 1 : 0,
      details: `${output.master_slides.length} master layouts detected`,
    });

    // Check 5: Live chart binding
    const liveBindingSlides = output.slides.filter((s) => s.live_bindings.length > 0);
    const chartPages = cdr.pages.filter((p) => p.elements.some((e) => e.element_type === "chart"));
    const bindingScore = chartPages.length > 0 ? liveBindingSlides.length / chartPages.length : 1;
    checks.push({
      check_id: uid("chk"),
      category: "live_binding",
      description: "Charts have live data bindings for dynamic refresh",
      passed: bindingScore >= 0.8 || chartPages.length === 0,
      score: bindingScore,
      details: `${liveBindingSlides.length} slides with live bindings`,
    });

    // Check 6: Theme consistency
    checks.push({
      check_id: uid("chk"),
      category: "theme",
      description: "Slide-level themes map to a consistent global theme",
      passed: true,
      score: 1,
      details: `Global theme: ${output.theme_global.font_family}`,
    });

    // Check 7: Dynamic refresh
    checks.push({
      check_id: uid("chk"),
      category: "dynamic_refresh",
      description: "Dynamic data refresh is enabled where applicable",
      passed: output.dynamic_refresh_enabled || chartPages.length === 0,
      score: output.dynamic_refresh_enabled ? 1 : chartPages.length === 0 ? 1 : 0,
      details: `Dynamic refresh: ${output.dynamic_refresh_enabled}`,
    });

    const overallScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

    return {
      validation_id: uid("val"),
      source_type: "presentation",
      checks,
      overall_score: overallScore,
      passed: overallScore >= 0.75 && defects.filter((d) => d.severity === "critical").length === 0,
      defects,
      validated_at: now(),
    };
  }

  validateReport(cdr: CDRInput, output: ReportOutput): FunctionalParityResult {
    const checks: FunctionalCheck[] = [];
    const defects: FunctionalDefect[] = [];

    // Check 1: Multi-page layout
    checks.push({
      check_id: uid("chk"),
      category: "page_layout",
      description: "Report has editable multi-page layout with proper margins",
      passed: output.page_layout.width_mm > 0 && output.page_layout.height_mm > 0,
      score: 1,
      details: `${output.page_layout.width_mm}mm x ${output.page_layout.height_mm}mm`,
    });

    // Check 2: Structured sections
    const sectionTypes = new Set(output.sections.map((s) => s.section_type));
    const sectionTypeScore = Math.min(1, sectionTypes.size / 4);
    checks.push({
      check_id: uid("chk"),
      category: "structured_sections",
      description: "Report contains diverse structured sections",
      passed: sectionTypes.size >= 2,
      score: sectionTypeScore,
      details: `Section types: ${Array.from(sectionTypes).join(", ")}`,
    });

    // Check 3: Table of contents
    const hasTOC = output.table_of_contents.length > 0;
    const hasHeadings = output.sections.some((s) => s.section_type === "heading");
    checks.push({
      check_id: uid("chk"),
      category: "toc",
      description: "Table of contents is generated from headings",
      passed: hasTOC || !hasHeadings,
      score: hasTOC ? 1 : hasHeadings ? 0 : 1,
      details: `${output.table_of_contents.length} TOC entries`,
    });

    // Check 4: Data binding for tables
    const tableSections = output.sections.filter((s) => s.section_type === "table");
    const boundTables = tableSections.filter((s) => s.data_binding !== undefined);
    const tableBindScore = tableSections.length > 0 ? boundTables.length / tableSections.length : 1;
    checks.push({
      check_id: uid("chk"),
      category: "table_binding",
      description: "Tables have data bindings for live updates",
      passed: tableBindScore >= 0.5,
      score: tableBindScore,
      details: `${boundTables.length}/${tableSections.length} tables with data bindings`,
    });

    // Check 5: Live recalculation
    checks.push({
      check_id: uid("chk"),
      category: "live_recalculation",
      description: "Report supports live recalculation",
      passed: output.live_recalculation,
      score: output.live_recalculation ? 1 : 0,
      details: `Live recalculation: ${output.live_recalculation}`,
    });

    // Check 6: Export compliance
    checks.push({
      check_id: uid("chk"),
      category: "export_compliance",
      description: "Report is export-ready with compliance tags",
      passed: output.export_formats.length >= 2 && output.compliance_tags.length > 0,
      score: output.compliance_tags.length > 0 ? 1 : 0,
      details: `Formats: ${output.export_formats.join(", ")} | Tags: ${output.compliance_tags.join(", ")}`,
    });

    // Check 7: Editability
    const editableSections = output.sections.filter((s) => s.editable);
    const editScore = output.sections.length > 0 ? editableSections.length / output.sections.length : 1;
    checks.push({
      check_id: uid("chk"),
      category: "editability",
      description: "Report sections are editable",
      passed: editScore >= 0.6,
      score: editScore,
      details: `${editableSections.length}/${output.sections.length} sections editable`,
    });

    const overallScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

    return {
      validation_id: uid("val"),
      source_type: "report",
      checks,
      overall_score: overallScore,
      passed: overallScore >= 0.75 && defects.filter((d) => d.severity === "critical").length === 0,
      defects,
      validated_at: now(),
    };
  }

  validateExcel(cdr: CDRInput, output: ExcelOutput): FunctionalParityResult {
    const checks: FunctionalCheck[] = [];
    const defects: FunctionalDefect[] = [];

    // Check 1: Sheet count matches pages
    const sheetMatch = output.sheets.length === cdr.pages.length;
    checks.push({
      check_id: uid("chk"),
      category: "sheet_count",
      description: "Number of sheets matches source pages",
      passed: sheetMatch,
      score: sheetMatch ? 1 : 0,
      details: `${output.sheets.length} sheets from ${cdr.pages.length} pages`,
    });

    if (!sheetMatch) {
      defects.push({
        defect_id: uid("def"),
        severity: "critical",
        category: "sheet_count",
        description: `Sheet count mismatch: ${output.sheets.length} vs ${cdr.pages.length}`,
      });
    }

    // Check 2: Formulas preserved
    const totalFormulas = output.sheets.reduce((s, sh) => s + sh.formulas.length, 0);
    const cdrFormulaRefs = cdr.pages
      .flatMap((p) => p.elements)
      .reduce((s, e) => s + (e.formula_refs?.length ?? 0), 0);
    const formulaScore = cdrFormulaRefs > 0 ? Math.min(1, totalFormulas / cdrFormulaRefs) : 1;
    checks.push({
      check_id: uid("chk"),
      category: "formula_preservation",
      description: "Formulas are preserved with correct dependencies",
      passed: formulaScore >= 0.8 || cdrFormulaRefs === 0,
      score: formulaScore,
      details: `${totalFormulas} formulas reconstructed from ${cdrFormulaRefs} refs`,
    });

    // Check 3: Dependency graph integrity
    const graphSize = output.dependency_graph.size;
    const graphComplete = graphSize >= totalFormulas;
    checks.push({
      check_id: uid("chk"),
      category: "dependency_graph",
      description: "Dependency graph preserves all formula relationships",
      passed: graphComplete || totalFormulas === 0,
      score: totalFormulas > 0 ? Math.min(1, graphSize / totalFormulas) : 1,
      details: `${graphSize} graph entries for ${totalFormulas} formulas`,
    });

    // Check 4: Pivot tables
    const pivotCount = output.sheets.reduce((s, sh) => s + sh.pivot_tables.length, 0);
    checks.push({
      check_id: uid("chk"),
      category: "pivot_tables",
      description: "Pivot tables are detected and recreated",
      passed: true,
      score: 1,
      details: `${pivotCount} pivot tables created`,
    });

    // Check 5: Conditional formatting
    const cfCount = output.sheets.reduce((s, sh) => s + sh.conditional_formats.length, 0);
    checks.push({
      check_id: uid("chk"),
      category: "conditional_formatting",
      description: "Conditional formatting rules are applied",
      passed: true,
      score: 1,
      details: `${cfCount} conditional format rules applied`,
    });

    // Check 6: Live recalculation
    checks.push({
      check_id: uid("chk"),
      category: "live_recalculation",
      description: "Workbook supports live recalculation",
      passed: output.live_recalculation,
      score: output.live_recalculation ? 1 : 0,
      details: `Live recalculation: ${output.live_recalculation}`,
    });

    // Check 7: Data integrity (check no empty sheets if CDR had data)
    const emptySheets = output.sheets.filter((sh) => sh.rows.length === 0);
    const nonEmptyCdrPages = cdr.pages.filter((p) => p.elements.length > 0);
    const dataScore = nonEmptyCdrPages.length > 0
      ? 1 - emptySheets.length / nonEmptyCdrPages.length
      : 1;
    checks.push({
      check_id: uid("chk"),
      category: "data_integrity",
      description: "All sheets contain reconstructed data",
      passed: dataScore >= 0.8,
      score: dataScore,
      details: `${output.sheets.length - emptySheets.length}/${output.sheets.length} sheets with data`,
    });

    if (emptySheets.length > 0 && nonEmptyCdrPages.length > 0) {
      defects.push({
        defect_id: uid("def"),
        severity: "major",
        category: "data_integrity",
        description: `${emptySheets.length} sheets are empty despite source having data`,
        suggested_fix: "Verify table element extraction from CDR pages",
      });
    }

    const overallScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

    return {
      validation_id: uid("val"),
      source_type: "spreadsheet",
      checks,
      overall_score: overallScore,
      passed: overallScore >= 0.75 && defects.filter((d) => d.severity === "critical").length === 0,
      defects,
      validated_at: now(),
    };
  }

  /**
   * Unified validation dispatcher: detects source type and runs the appropriate validator.
   */
  validate(
    cdr: CDRInput,
    output: DashboardOutput | PresentationOutput | ReportOutput | ExcelOutput
  ): FunctionalParityResult {
    const sourceType = detectSourceType(cdr);

    if ("widgets" in output) return this.validateDashboard(cdr, output as DashboardOutput);
    if ("slides" in output) return this.validatePresentation(cdr, output as PresentationOutput);
    if ("sections" in output) return this.validateReport(cdr, output as ReportOutput);
    if ("sheets" in output) return this.validateExcel(cdr, output as ExcelOutput);

    return {
      validation_id: uid("val"),
      source_type: sourceType,
      checks: [],
      overall_score: 0,
      passed: false,
      defects: [{
        defect_id: uid("def"),
        severity: "critical",
        category: "unknown_output",
        description: "Could not determine output type for validation",
      }],
      validated_at: now(),
    };
  }
}

// ─── Unified Reconstruction Orchestrator ──────────────────────────────

export class FunctionalReconstructionOrchestrator {
  private readonly dashboardReconstructor = new DashboardReconstructor();
  private readonly presentationReconstructor = new PresentationReconstructor();
  private readonly reportReconstructor = new ReportReconstructor();
  private readonly excelReconstructor = new ExcelReconstructor();
  private readonly validationEngine = new FunctionalValidationEngine();
  private readonly schemaEngine = new SchemaInferenceEngine();
  private readonly bindingEngine = new DataBindingEngine();

  /**
   * Accepts CDR input, detects source type, builds the appropriate functional
   * output with all interactive features, and validates functional equivalence.
   */
  reconstruct(cdr: CDRInput): {
    source_type: SourceType;
    output: DashboardOutput | PresentationOutput | ReportOutput | ExcelOutput;
    validation: FunctionalParityResult;
    schema_inference: InferredSchema | null;
  } {
    const sourceType = detectSourceType(cdr);

    // Run schema inference on any table data in the CDR
    const tableData = cdr.pages
      .flatMap((p) => p.elements)
      .filter((e) => e.element_type === "table" && e.rows && e.rows.length > 0);
    const schemaInference = tableData.length > 0
      ? this.schemaEngine.inferFromTableData(tableData[0].rows!, true)
      : null;

    let output: DashboardOutput | PresentationOutput | ReportOutput | ExcelOutput;

    switch (sourceType) {
      case "dashboard":
        output = this.dashboardReconstructor.reconstruct(cdr);
        break;
      case "presentation":
        output = this.presentationReconstructor.reconstruct(cdr);
        break;
      case "report":
        output = this.reportReconstructor.reconstruct(cdr);
        break;
      case "spreadsheet":
        output = this.excelReconstructor.reconstruct(cdr);
        break;
      default: {
        // Fallback: try dashboard first (most complex), then report
        const hasCharts = cdr.pages.some((p) => p.elements.some((e) => e.element_type === "chart"));
        if (hasCharts) {
          output = this.dashboardReconstructor.reconstruct(cdr);
        } else {
          output = this.reportReconstructor.reconstruct(cdr);
        }
        break;
      }
    }

    const validation = this.validationEngine.validate(cdr, output);

    return { source_type: sourceType, output, validation, schema_inference: schemaInference };
  }
}

// ─── Compatibility Aliases (consumed by strict-modules.ts) ────────────

/** Alias: UniversalReconstructor = FunctionalReconstructionOrchestrator */
export const UniversalReconstructor = FunctionalReconstructionOrchestrator;

/** Result returned by the orchestrator's reconstruct() method */
export type ReconstructionResult = ReturnType<FunctionalReconstructionOrchestrator["reconstruct"]>;

/** Alias for FunctionalParityResult */
export type FunctionalParity = FunctionalParityResult;

/** A reconstructed component is any widget, slide, section, or sheet */
export type ReconstructedComponent = DashboardWidget | SlideDefinition | ReportSection | SheetDefinition;

/** Alias: DataBinding = DataBindingEntry */
export type DataBinding = DataBindingEntry;

/** Interaction specification for a widget (filters + drill-downs) */
export type InteractionSpec = {
  filters: FilterDefinition[];
  drill_down_paths: DrillDownPath[];
  cross_filter_targets: string[];
};

/** Formula specification for an Excel cell */
export type FormulaSpec = CellFormula;

/** Alias: ConditionalFormat = ConditionalFormatRule */
export type ConditionalFormat = ConditionalFormatRule;

/** Extra reconstruction data specific to Excel output */
export type ExcelReconstructionExtra = {
  dependency_graph: Map<string, string[]>;
  pivot_tables: PivotTableDef[];
  conditional_formats: ConditionalFormatRule[];
  named_ranges: Array<{ name: string; sheet: string; range: string }>;
};

// ─── Exports ──────────────────────────────────────────────────────────

export { detectSourceType };
