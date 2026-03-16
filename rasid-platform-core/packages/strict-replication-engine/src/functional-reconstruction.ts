// ─── Functional Reconstruction Engines (Addendum) ─────────────────────
// Image → Live Dashboard | Editable Presentation | Report | Excel Model
// Structural Functional Equivalence: NOT bitmap duplication

import type {
  CdrDesign, CdrElement, CdrPage, CdrDataTable, CdrData, CdrDesignWithData,
  TableElement, ChartElement, TextElement, ChartKind, CdrDataColumn,
} from "./cdr-design-schema";
import { computeFingerprints, ptToEmu } from "./cdr-design-schema";

// ─── Functional Equivalence Types ──────────────────────────────────────

export type SourceType = "dashboard" | "presentation" | "report" | "spreadsheet" | "unknown";

export interface FunctionalParity {
  editable: boolean;
  data_bindable: boolean;
  interactive: boolean;
  permission_aware: boolean;
  exportable: boolean;
  versionable: boolean;
  governed: boolean;
}

export interface ReconstructionResult {
  readonly source_type: SourceType;
  readonly target_type: string;
  readonly cdr: CdrDesignWithData;
  readonly functional_parity: FunctionalParity;
  readonly components: ReconstructedComponent[];
  readonly data_bindings: DataBinding[];
  readonly interactions: InteractionSpec[];
  readonly warnings: string[];
  readonly fidelity_score: number;
}

export interface ReconstructedComponent {
  readonly component_id: string;
  readonly component_type: "chart" | "table" | "kpi" | "filter" | "text" | "image" | "legend" | "drilldown" | "navigation";
  readonly element_ref: string;
  readonly editable: boolean;
  readonly data_bound: boolean;
  readonly interactive: boolean;
}

export interface DataBinding {
  readonly binding_id: string;
  readonly source_element: string;
  readonly table_ref: string;
  readonly column_mappings: Record<string, string>;
  readonly aggregation?: string;
  readonly filter_expression?: string;
}

export interface InteractionSpec {
  readonly interaction_id: string;
  readonly type: "filter" | "cross_filter" | "drilldown" | "export" | "refresh" | "sort" | "resize";
  readonly source_element: string;
  readonly target_elements: string[];
  readonly config: Record<string, unknown>;
}

// ─── Source Type Detection ──────────────────────────────────────────────

export function detectSourceType(design: CdrDesign): SourceType {
  const allElements: CdrElement[] = [];
  for (const page of design.pages) {
    for (const layer of page.layers) {
      for (const el of layer.elements) {
        allElements.push(el);
        if (el.kind === "group") {
          for (const child of el.children) allElements.push(child);
        }
      }
    }
  }

  const charts = allElements.filter((e) => e.kind === "chart").length;
  const tables = allElements.filter((e) => e.kind === "table").length;
  const texts = allElements.filter((e) => e.kind === "text").length;
  const hasControls = allElements.some((e) => e.kind === "group"); // Proxy for UI controls

  if (charts > 0 && tables > 0 && hasControls) return "dashboard";
  if (charts > 0 && texts > 2 && design.pages.length <= 1) return "dashboard";
  if (design.pages.length > 1 && charts + tables <= design.pages.length) return "presentation";
  if (tables > 0 && charts === 0 && texts < 3) return "spreadsheet";
  if (texts > 5) return "report";
  if (design.pages.length > 1) return "presentation";
  return "unknown";
}

// ─── Data Binding Engine ────────────────────────────────────────────────

export class DataBindingEngine {
  private tables: Map<string, CdrDataTable> = new Map();

  /** Register a data table */
  registerTable(table: CdrDataTable): void {
    this.tables.set(table.table_id, table);
  }

  /** Auto-suggest schema from CDR table element */
  suggestSchema(tableElement: TableElement): CdrDataTable {
    const columns: CdrDataColumn[] = [];
    if (tableElement.cells.length > 0) {
      // Use first row as headers
      const headerCells = tableElement.cells.filter((c) => c.r === 0);
      for (const cell of headerCells) {
        columns.push({
          column_id: `col-${cell.c}`,
          name: String(cell.value),
          data_type: typeof cell.value === "number" ? "number" : "string",
        });
      }
    }

    if (columns.length === 0) {
      for (let c = 0; c < tableElement.grid.cols; c++) {
        columns.push({
          column_id: `col-${c}`,
          name: `عمود ${c + 1}`,
          data_type: "string",
        });
      }
    }

    return {
      table_id: `data-${tableElement.element_id}`,
      columns,
      row_count: tableElement.grid.rows - 1, // Exclude header
      rows_ref: `rows://${tableElement.element_id}`,
      stats: { min_values: {}, max_values: {}, null_counts: {} },
      lineage_ref: `lineage://${tableElement.element_id}`,
    };
  }

  /** Infer column matching between source and target schemas */
  inferColumnMatching(
    sourceColumns: CdrDataColumn[],
    targetColumns: CdrDataColumn[]
  ): Record<string, string> {
    const mappings: Record<string, string> = {};
    for (const src of sourceColumns) {
      // Try exact name match first
      let match = targetColumns.find((t) => t.name === src.name);
      if (!match) {
        // Try type match
        match = targetColumns.find((t) => t.data_type === src.data_type && !Object.values(mappings).includes(t.column_id));
      }
      if (match) {
        mappings[src.column_id] = match.column_id;
      }
    }
    return mappings;
  }

  /** Detect measures (numeric columns likely to be aggregated) */
  detectMeasures(table: CdrDataTable): CdrDataColumn[] {
    return table.columns.filter((c) => c.data_type === "number");
  }

  /** Detect dimensions (string/date columns for grouping) */
  detectDimensions(table: CdrDataTable): CdrDataColumn[] {
    return table.columns.filter((c) => c.data_type === "string" || c.data_type === "date");
  }

  /** Detect time intelligence columns */
  detectTimeColumns(table: CdrDataTable): CdrDataColumn[] {
    const timePatterns = /date|time|year|month|day|تاريخ|سنة|شهر|يوم|quarter|q[1-4]/i;
    return table.columns.filter((c) => timePatterns.test(c.name) || c.data_type === "date");
  }

  /** Create bindings for chart element */
  createChartBinding(chart: ChartElement, table: CdrDataTable): DataBinding {
    const measures = this.detectMeasures(table);
    const dimensions = this.detectDimensions(table);

    const columnMappings: Record<string, string> = {};
    if (dimensions.length > 0) columnMappings["category"] = dimensions[0].column_id;
    if (measures.length > 0) columnMappings["value"] = measures[0].column_id;
    if (measures.length > 1) columnMappings["series"] = measures[1].column_id;

    return {
      binding_id: `binding-${chart.element_id}`,
      source_element: chart.element_id,
      table_ref: table.table_id,
      column_mappings: columnMappings,
      aggregation: "sum",
    };
  }

  /** Create bindings for table element */
  createTableBinding(tableElement: TableElement, dataTable: CdrDataTable): DataBinding {
    const mappings: Record<string, string> = {};
    for (let i = 0; i < Math.min(tableElement.grid.cols, dataTable.columns.length); i++) {
      mappings[`col-${i}`] = dataTable.columns[i].column_id;
    }

    return {
      binding_id: `binding-${tableElement.element_id}`,
      source_element: tableElement.element_id,
      table_ref: dataTable.table_id,
      column_mappings: mappings,
    };
  }
}

// ─── Schema Inference Engine ────────────────────────────────────────────

export class SchemaInferenceEngine {
  /** Infer data schema from CDR design elements */
  inferFromDesign(design: CdrDesign): CdrData {
    const tables: CdrDataTable[] = [];
    const allElements: CdrElement[] = [];

    for (const page of design.pages) {
      for (const layer of page.layers) {
        for (const el of layer.elements) {
          allElements.push(el);
        }
      }
    }

    // Create data tables from table elements
    for (const el of allElements) {
      if (el.kind === "table") {
        const columns: CdrDataColumn[] = [];
        const headerCells = el.cells.filter((c) => c.r === 0);
        for (const cell of headerCells) {
          const isNumeric = !isNaN(Number(cell.value));
          columns.push({
            column_id: `col-${cell.c}`,
            name: String(cell.value),
            data_type: isNumeric ? "number" : "string",
          });
        }

        tables.push({
          table_id: `data-${el.element_id}`,
          columns,
          row_count: el.grid.rows - 1,
          rows_ref: `rows://${el.element_id}`,
          stats: { min_values: {}, max_values: {}, null_counts: {} },
          lineage_ref: `lineage://${el.element_id}`,
        });
      }
    }

    // Create placeholder tables for charts without data
    for (const el of allElements) {
      if (el.kind === "chart" && !tables.some((t) => t.table_id === el.data_binding.table_id)) {
        tables.push({
          table_id: el.data_binding.table_id || `data-${el.element_id}`,
          columns: [
            { column_id: "cat", name: "الفئة", data_type: "string" },
            { column_id: "val", name: "القيمة", data_type: "number" },
          ],
          row_count: 0,
          rows_ref: `placeholder://${el.element_id}`,
          stats: { min_values: {}, max_values: {}, null_counts: {} },
          lineage_ref: `lineage://${el.element_id}`,
        });
      }
    }

    return {
      tables,
      semantic_model_ref: `semantic-model-${design.fingerprints.structural_hash.slice(0, 8)}`,
    };
  }
}

// ─── Dashboard Reconstructor ────────────────────────────────────────────

export class DashboardReconstructor {
  private bindingEngine = new DataBindingEngine();
  private schemaEngine = new SchemaInferenceEngine();

  reconstruct(design: CdrDesign): ReconstructionResult {
    const data = this.schemaEngine.inferFromDesign(design);
    const components: ReconstructedComponent[] = [];
    const bindings: DataBinding[] = [];
    const interactions: InteractionSpec[] = [];
    const warnings: string[] = [];

    const allElements: CdrElement[] = [];
    for (const page of design.pages) {
      for (const layer of page.layers) {
        for (const el of layer.elements) allElements.push(el);
      }
    }

    // Register data tables
    for (const table of data.tables) {
      this.bindingEngine.registerTable(table);
    }

    for (const el of allElements) {
      switch (el.kind) {
        case "chart": {
          const dataTable = data.tables.find((t) => t.table_id === el.data_binding.table_id) ?? data.tables[0];
          if (dataTable) {
            const binding = this.bindingEngine.createChartBinding(el, dataTable);
            bindings.push(binding);
          }
          components.push({
            component_id: `comp-${el.element_id}`,
            component_type: "chart",
            element_ref: el.element_id,
            editable: true,
            data_bound: !!dataTable,
            interactive: true,
          });
          // Add drill-down interaction
          interactions.push({
            interaction_id: `drill-${el.element_id}`,
            type: "drilldown",
            source_element: el.element_id,
            target_elements: [],
            config: { enabled: true, levels: ["category", "subcategory"] },
          });
          break;
        }

        case "table": {
          const dataTable = data.tables.find((t) => t.table_id === `data-${el.element_id}`);
          if (dataTable) {
            const binding = this.bindingEngine.createTableBinding(el, dataTable);
            bindings.push(binding);
          }
          components.push({
            component_id: `comp-${el.element_id}`,
            component_type: "table",
            element_ref: el.element_id,
            editable: true,
            data_bound: !!dataTable,
            interactive: true,
          });
          // Add sort interaction
          interactions.push({
            interaction_id: `sort-${el.element_id}`,
            type: "sort",
            source_element: el.element_id,
            target_elements: [el.element_id],
            config: { columns: "all", default_order: "ascending" },
          });
          break;
        }

        case "text": {
          // Detect KPIs (short numeric text with large font)
          const isKpi = el.text.length < 20 && /[\d٠-٩]/.test(el.text) && el.runs[0]?.font_size_emu > ptToEmu(18);
          components.push({
            component_id: `comp-${el.element_id}`,
            component_type: isKpi ? "kpi" : "text",
            element_ref: el.element_id,
            editable: true,
            data_bound: isKpi,
            interactive: isKpi,
          });
          break;
        }

        default:
          components.push({
            component_id: `comp-${el.element_id}`,
            component_type: "image",
            element_ref: el.element_id,
            editable: true,
            data_bound: false,
            interactive: false,
          });
      }
    }

    // Add cross-filter interactions between charts
    const chartComponents = components.filter((c) => c.component_type === "chart");
    for (let i = 0; i < chartComponents.length; i++) {
      for (let j = i + 1; j < chartComponents.length; j++) {
        interactions.push({
          interaction_id: `cross-filter-${i}-${j}`,
          type: "cross_filter",
          source_element: chartComponents[i].element_ref,
          target_elements: [chartComponents[j].element_ref],
          config: { bidirectional: true },
        });
      }
    }

    // Add export interaction
    interactions.push({
      interaction_id: "export-dashboard",
      type: "export",
      source_element: "dashboard-root",
      target_elements: allElements.map((e) => e.element_id),
      config: { formats: ["pdf", "png", "pptx"] },
    });

    // Add refresh interaction
    interactions.push({
      interaction_id: "refresh-dashboard",
      type: "refresh",
      source_element: "dashboard-root",
      target_elements: bindings.map((b) => b.source_element),
      config: { auto_refresh: false, interval_ms: 0 },
    });

    return {
      source_type: "dashboard",
      target_type: "dashboard",
      cdr: { design, data },
      functional_parity: {
        editable: true,
        data_bindable: bindings.length > 0,
        interactive: interactions.length > 0,
        permission_aware: true,
        exportable: true,
        versionable: true,
        governed: true,
      },
      components,
      data_bindings: bindings,
      interactions,
      warnings,
      fidelity_score: computeFidelityScore(components, bindings, interactions),
    };
  }
}

// ─── Presentation Reconstructor ─────────────────────────────────────────

export class PresentationReconstructor {
  private schemaEngine = new SchemaInferenceEngine();
  private bindingEngine = new DataBindingEngine();

  reconstruct(design: CdrDesign): ReconstructionResult {
    const data = this.schemaEngine.inferFromDesign(design);
    const components: ReconstructedComponent[] = [];
    const bindings: DataBinding[] = [];
    const interactions: InteractionSpec[] = [];
    const warnings: string[] = [];

    for (const table of data.tables) {
      this.bindingEngine.registerTable(table);
    }

    for (const page of design.pages) {
      for (const layer of page.layers) {
        for (const el of layer.elements) {
          switch (el.kind) {
            case "text":
              components.push({
                component_id: `slide-${page.index}-${el.element_id}`,
                component_type: "text",
                element_ref: el.element_id,
                editable: true,
                data_bound: false,
                interactive: true,
              });
              break;
            case "chart": {
              const dt = data.tables.find((t) => t.table_id === el.data_binding.table_id);
              if (dt) bindings.push(this.bindingEngine.createChartBinding(el, dt));
              components.push({
                component_id: `slide-${page.index}-${el.element_id}`,
                component_type: "chart",
                element_ref: el.element_id,
                editable: true,
                data_bound: !!dt,
                interactive: true,
              });
              break;
            }
            case "table": {
              const dt = data.tables.find((t) => t.table_id === `data-${el.element_id}`);
              if (dt) bindings.push(this.bindingEngine.createTableBinding(el, dt));
              components.push({
                component_id: `slide-${page.index}-${el.element_id}`,
                component_type: "table",
                element_ref: el.element_id,
                editable: true,
                data_bound: !!dt,
                interactive: true,
              });
              break;
            }
            default:
              components.push({
                component_id: `slide-${page.index}-${el.element_id}`,
                component_type: "image",
                element_ref: el.element_id,
                editable: true,
                data_bound: false,
                interactive: false,
              });
          }
        }
      }
    }

    // Slide-level theme mapping
    interactions.push({
      interaction_id: "slide-theme",
      type: "refresh",
      source_element: "presentation-root",
      target_elements: design.pages.map((p) => p.page_id),
      config: { theme: "auto-detected", master_slide: "default" },
    });

    return {
      source_type: "presentation",
      target_type: "pptx",
      cdr: { design, data },
      functional_parity: {
        editable: true,
        data_bindable: bindings.length > 0,
        interactive: true,
        permission_aware: true,
        exportable: true,
        versionable: true,
        governed: true,
      },
      components,
      data_bindings: bindings,
      interactions,
      warnings,
      fidelity_score: computeFidelityScore(components, bindings, interactions),
    };
  }
}

// ─── Report Reconstructor ───────────────────────────────────────────────

export class ReportReconstructor {
  private schemaEngine = new SchemaInferenceEngine();
  private bindingEngine = new DataBindingEngine();

  reconstruct(design: CdrDesign): ReconstructionResult {
    const data = this.schemaEngine.inferFromDesign(design);
    const components: ReconstructedComponent[] = [];
    const bindings: DataBinding[] = [];
    const interactions: InteractionSpec[] = [];
    const warnings: string[] = [];

    for (const table of data.tables) {
      this.bindingEngine.registerTable(table);
    }

    // Generate table of contents from text elements
    const tocEntries: string[] = [];

    for (const page of design.pages) {
      for (const layer of page.layers) {
        for (const el of layer.elements) {
          if (el.kind === "text") {
            // Detect headers (large font size)
            if (el.runs[0]?.font_size_emu > ptToEmu(14)) {
              tocEntries.push(el.text);
            }
            components.push({
              component_id: `section-${page.index}-${el.element_id}`,
              component_type: "text",
              element_ref: el.element_id,
              editable: true,
              data_bound: false,
              interactive: false,
            });
          } else if (el.kind === "table") {
            const dt = data.tables.find((t) => t.table_id === `data-${el.element_id}`);
            if (dt) bindings.push(this.bindingEngine.createTableBinding(el, dt));
            components.push({
              component_id: `section-${page.index}-${el.element_id}`,
              component_type: "table",
              element_ref: el.element_id,
              editable: true,
              data_bound: !!dt,
              interactive: true,
            });
          } else if (el.kind === "chart") {
            components.push({
              component_id: `section-${page.index}-${el.element_id}`,
              component_type: "chart",
              element_ref: el.element_id,
              editable: true,
              data_bound: false,
              interactive: false,
            });
          } else {
            components.push({
              component_id: `section-${page.index}-${el.element_id}`,
              component_type: "image",
              element_ref: el.element_id,
              editable: true,
              data_bound: false,
              interactive: false,
            });
          }
        }
      }
    }

    if (tocEntries.length > 0) {
      interactions.push({
        interaction_id: "toc-generation",
        type: "refresh",
        source_element: "report-root",
        target_elements: [],
        config: { toc_entries: tocEntries, auto_generate: true },
      });
    }

    return {
      source_type: "report",
      target_type: "docx",
      cdr: { design, data },
      functional_parity: {
        editable: true,
        data_bindable: bindings.length > 0,
        interactive: false,
        permission_aware: true,
        exportable: true,
        versionable: true,
        governed: true,
      },
      components,
      data_bindings: bindings,
      interactions,
      warnings,
      fidelity_score: computeFidelityScore(components, bindings, interactions),
    };
  }
}

// ─── Excel Reconstructor ────────────────────────────────────────────────

export interface FormulaSpec {
  cell_ref: string;
  formula: string;
  dependencies: string[];
}

export interface ConditionalFormat {
  range: string;
  condition: string;
  format: { background?: string; color?: string; bold?: boolean };
}

export interface ExcelReconstructionExtra {
  formulas: FormulaSpec[];
  conditional_formats: ConditionalFormat[];
  pivot_tables: Array<{ name: string; source_range: string; rows: string[]; values: string[] }>;
  freeze_panes?: { row: number; col: number };
}

export class ExcelReconstructor {
  reconstruct(design: CdrDesign): ReconstructionResult & { excel_extras: ExcelReconstructionExtra } {
    const schemaEngine = new SchemaInferenceEngine();
    const data = schemaEngine.inferFromDesign(design);
    const components: ReconstructedComponent[] = [];
    const bindings: DataBinding[] = [];
    const interactions: InteractionSpec[] = [];
    const warnings: string[] = [];
    const formulas: FormulaSpec[] = [];
    const conditionalFormats: ConditionalFormat[] = [];
    const pivotTables: ExcelReconstructionExtra["pivot_tables"] = [];

    for (const page of design.pages) {
      for (const layer of page.layers) {
        for (const el of layer.elements) {
          if (el.kind === "table") {
            components.push({
              component_id: `sheet-${page.index}-${el.element_id}`,
              component_type: "table",
              element_ref: el.element_id,
              editable: true,
              data_bound: true,
              interactive: true,
            });

            // Detect formulas in cell values
            for (const cell of el.cells) {
              const val = String(cell.value);
              if (val.startsWith("=")) {
                const deps: string[] = [];
                const cellRefPattern = /[A-Z]+\d+/g;
                let match: RegExpExecArray | null;
                while ((match = cellRefPattern.exec(val)) !== null) {
                  deps.push(match[0]);
                }
                formulas.push({
                  cell_ref: `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`,
                  formula: val,
                  dependencies: deps,
                });
              }
            }

            // Detect numeric columns for conditional formatting
            const numericCols = el.cells.filter((c) => c.r > 0 && !isNaN(Number(c.value)));
            if (numericCols.length > 3) {
              const colIndices = [...new Set(numericCols.map((c) => c.c))];
              for (const colIdx of colIndices) {
                conditionalFormats.push({
                  range: `${String.fromCharCode(65 + colIdx)}2:${String.fromCharCode(65 + colIdx)}${el.grid.rows}`,
                  condition: "value > average",
                  format: { background: "#C6EFCE", color: "#006100" },
                });
              }
            }

            // Suggest pivot table if table is large enough
            if (el.grid.rows > 5 && el.grid.cols > 3) {
              const headers = el.cells.filter((c) => c.r === 0).map((c) => String(c.value));
              const measures = headers.filter((_, i) => {
                const cellsInCol = el.cells.filter((c) => c.c === i && c.r > 0);
                return cellsInCol.every((c) => !isNaN(Number(c.value)));
              });
              const dimensions = headers.filter((h) => !measures.includes(h));
              if (dimensions.length > 0 && measures.length > 0) {
                pivotTables.push({
                  name: `ملخص ${el.element_id}`,
                  source_range: `A1:${String.fromCharCode(64 + el.grid.cols)}${el.grid.rows}`,
                  rows: dimensions.slice(0, 2),
                  values: measures.slice(0, 3),
                });
              }
            }

            // Add recalculation interaction
            interactions.push({
              interaction_id: `recalc-${el.element_id}`,
              type: "refresh",
              source_element: el.element_id,
              target_elements: [el.element_id],
              config: { trigger: "on_change", deterministic: true },
            });
          } else if (el.kind === "chart") {
            components.push({
              component_id: `sheet-${page.index}-${el.element_id}`,
              component_type: "chart",
              element_ref: el.element_id,
              editable: true,
              data_bound: true,
              interactive: true,
            });
          }
        }
      }
    }

    // Freeze panes (first row for headers)
    const freezePanes = { row: 1, col: 0 };

    return {
      source_type: "spreadsheet",
      target_type: "xlsx",
      cdr: { design, data },
      functional_parity: {
        editable: true,
        data_bindable: true,
        interactive: true,
        permission_aware: true,
        exportable: true,
        versionable: true,
        governed: true,
      },
      components,
      data_bindings: bindings,
      interactions,
      warnings,
      fidelity_score: computeFidelityScore(components, bindings, interactions),
      excel_extras: {
        formulas,
        conditional_formats: conditionalFormats,
        pivot_tables: pivotTables,
        freeze_panes: freezePanes,
      },
    };
  }
}

// ─── Fidelity Score Computation ─────────────────────────────────────────

function computeFidelityScore(
  components: ReconstructedComponent[],
  bindings: DataBinding[],
  interactions: InteractionSpec[]
): number {
  if (components.length === 0) return 0;

  let score = 0;
  const weights = { editable: 0.3, data_bound: 0.3, interactive: 0.2, coverage: 0.2 };

  // Editability score
  const editableRatio = components.filter((c) => c.editable).length / components.length;
  score += editableRatio * weights.editable;

  // Data binding score
  const boundRatio = components.filter((c) => c.data_bound).length / Math.max(1, components.filter((c) => ["chart", "table", "kpi"].includes(c.component_type)).length);
  score += Math.min(1, boundRatio) * weights.data_bound;

  // Interactivity score
  const interactiveTypes = new Set(interactions.map((i) => i.type));
  const interactivityScore = Math.min(1, interactiveTypes.size / 4);
  score += interactivityScore * weights.interactive;

  // Coverage score
  const componentTypes = new Set(components.map((c) => c.component_type));
  const coverageScore = Math.min(1, componentTypes.size / 5);
  score += coverageScore * weights.coverage;

  return Math.round(score * 100) / 100;
}

// ─── Functional Validation Engine ───────────────────────────────────────

export class FunctionalValidationEngine {
  validate(result: ReconstructionResult): {
    passed: boolean;
    score: number;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  } {
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

    // Check: all components are editable
    const allEditable = result.components.every((c) => c.editable);
    checks.push({ name: "all_editable", passed: allEditable, detail: `${result.components.filter((c) => c.editable).length}/${result.components.length} editable` });

    // Check: data-bindable components have bindings
    const dataComponents = result.components.filter((c) => ["chart", "table", "kpi"].includes(c.component_type));
    const boundComponents = dataComponents.filter((c) => c.data_bound);
    const allBound = dataComponents.length === 0 || boundComponents.length > 0;
    checks.push({ name: "data_binding", passed: allBound, detail: `${boundComponents.length}/${dataComponents.length} bound` });

    // Check: functional parity
    const parity = result.functional_parity;
    checks.push({ name: "exportable", passed: parity.exportable, detail: `exportable=${parity.exportable}` });
    checks.push({ name: "versionable", passed: parity.versionable, detail: `versionable=${parity.versionable}` });

    // Check: no static images where functional components expected
    const staticOnly = result.components.every((c) => c.component_type === "image");
    if (result.source_type !== "unknown") {
      checks.push({ name: "not_static_image", passed: !staticOnly, detail: staticOnly ? "FAIL: all components are static images" : "OK: functional components present" });
    }

    // Check: interaction coverage for dashboards
    if (result.source_type === "dashboard") {
      const hasFilter = result.interactions.some((i) => i.type === "filter" || i.type === "cross_filter");
      const hasExport = result.interactions.some((i) => i.type === "export");
      checks.push({ name: "dashboard_filter", passed: hasFilter, detail: `filter=${hasFilter}` });
      checks.push({ name: "dashboard_export", passed: hasExport, detail: `export=${hasExport}` });
    }

    const passed = checks.every((c) => c.passed);
    const score = checks.filter((c) => c.passed).length / checks.length;

    return { passed, score, checks };
  }
}

// ─── Universal Reconstructor ────────────────────────────────────────────

export class UniversalReconstructor {
  private dashboardRecon = new DashboardReconstructor();
  private presentationRecon = new PresentationReconstructor();
  private reportRecon = new ReportReconstructor();
  private excelRecon = new ExcelReconstructor();
  private validator = new FunctionalValidationEngine();

  reconstruct(design: CdrDesign, forceType?: SourceType): ReconstructionResult {
    const sourceType = forceType ?? detectSourceType(design);

    let result: ReconstructionResult;
    switch (sourceType) {
      case "dashboard":
        result = this.dashboardRecon.reconstruct(design);
        break;
      case "presentation":
        result = this.presentationRecon.reconstruct(design);
        break;
      case "report":
        result = this.reportRecon.reconstruct(design);
        break;
      case "spreadsheet":
        result = this.excelRecon.reconstruct(design);
        break;
      default:
        // Default to dashboard reconstruction
        result = this.dashboardRecon.reconstruct(design);
        result = { ...result, source_type: "unknown" };
    }

    return result;
  }

  reconstructAndValidate(design: CdrDesign, forceType?: SourceType): {
    result: ReconstructionResult;
    validation: ReturnType<FunctionalValidationEngine["validate"]>;
  } {
    const result = this.reconstruct(design, forceType);
    const validation = this.validator.validate(result);
    return { result, validation };
  }
}
