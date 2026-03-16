/**
 * Excel Ultra Engine Service — Adapted from Seed
 *
 * Advanced Excel processing: tool execution, dataset management,
 * table operations, recipes, and Arabic data handling.
 *
 * Original: 05_excel_core/services/excel-service/src/services/excel-ultra-engine.service.ts (1916 lines)
 */

import { createHash, randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EngineMode = "SMART" | "PRO";
export type ArabicMode = "BASIC" | "PROFESSIONAL" | "ELITE";
export type ColumnDType = "string" | "int" | "float" | "bool" | "date" | "datetime" | "currency" | "percent" | "json" | "unknown";
export type RecipeKind = "TIR" | "COMPARE" | "CLEAN" | "FORMAT";

export interface ExcelActionContext {
  userId: string;
  tenantId?: string;
  mode: EngineMode;
  arabicMode: ArabicMode;
  locale: string;
  timezone: string;
}

export interface ExcelAssetRef {
  assetId: string;
  type: "dataset" | "table" | "recipe" | "artifact";
  name: string;
  createdAt: string;
}

export interface DatasetRef { datasetId: string; name: string; rowCount: number; columnCount: number; }
export interface TableRef { tableId: string; datasetId: string; name: string; rowCount: number; }
export interface ColumnRef { columnId: string; tableId: string; name: string; dtype: ColumnDType; nullable: boolean; }
export interface RecipeRef { recipeId: string; name: string; kind: RecipeKind; }
export interface ArtifactRef { artifactId: string; name: string; format: string; size: number; }

export interface ToolWarning {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
}

export interface ExcelToolRequest<TInputs = Record<string, unknown>, TParams = Record<string, unknown>> {
  tool: string;
  inputs: TInputs;
  params: TParams;
  context: ExcelActionContext;
}

export interface ExcelToolResponse<TRefs = Record<string, unknown>> {
  success: boolean;
  toolName: string;
  message: string;
  refs: TRefs;
  warnings: ToolWarning[];
  executionTime: number;
}

// Internal models
export interface DatasetModel {
  dataset_id: string;
  name: string;
  columns: ColumnModel[];
  tables: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ColumnModel {
  column_id: string;
  name: string;
  dtype: ColumnDType;
  nullable: boolean;
  stats?: ColumnStats;
}

export interface ColumnStats {
  count: number;
  unique: number;
  nullCount: number;
  min?: unknown;
  max?: unknown;
  mean?: number;
  median?: number;
}

export interface TableModel {
  table_id: string;
  dataset_id: string;
  name: string;
  headers: string[];
  rows: TableRow[];
  dtypes: ColumnDType[];
}

export interface TableRow {
  _idx: number;
  cells: unknown[];
}

export interface RecipeModel {
  recipe_id: string;
  name: string;
  kind: RecipeKind;
  steps: RecipeStep[];
  created_at: string;
}

export interface RecipeStep {
  operation: string;
  params: Record<string, unknown>;
  column?: string;
}

export interface ArtifactModel {
  artifact_id: string;
  name: string;
  format: string;
  data: Buffer | string;
  size: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const datasetStore = new Map<string, DatasetModel>();
const tableStore = new Map<string, TableModel>();
const recipeStore = new Map<string, RecipeModel>();
const artifactStore = new Map<string, ArtifactModel>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u0600-\u06FF]+/g, (m) => m) // Keep Arabic
    .replace(/[^a-z0-9\u0600-\u06FF_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseScalar(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  const n = Number(s);
  if (!isNaN(n) && s !== "") return n;
  return s;
}

function toNumeric(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function inferColumnType(samples: unknown[]): ColumnDType {
  const nonNull = samples.filter((s) => s !== null && s !== undefined && s !== "");
  if (nonNull.length === 0) return "unknown";

  let ints = 0, floats = 0, bools = 0, dates = 0;
  for (const s of nonNull) {
    const str = String(s).trim();
    if (str === "true" || str === "false") { bools++; continue; }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) { dates++; continue; }
    const n = Number(str);
    if (!isNaN(n)) {
      if (Number.isInteger(n)) ints++;
      else floats++;
    }
  }

  const total = nonNull.length;
  if (bools / total > 0.8) return "bool";
  if (dates / total > 0.8) return "date";
  if (floats / total > 0.5) return "float";
  if (ints / total > 0.8) return "int";
  if ((ints + floats) / total > 0.8) return "float";
  return "string";
}

function computeColumnStats(values: unknown[], dtype: ColumnDType): ColumnStats {
  const count = values.length;
  const unique = new Set(values.map(String)).size;
  const nullCount = values.filter((v) => v === null || v === undefined || v === "").length;

  const stats: ColumnStats = { count, unique, nullCount };

  if (dtype === "int" || dtype === "float" || dtype === "currency" || dtype === "percent") {
    const nums = values.map(toNumeric).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      stats.min = Math.min(...nums);
      stats.max = Math.max(...nums);
      stats.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const sorted = [...nums].sort((a, b) => a - b);
      stats.median = sorted[Math.floor(sorted.length / 2)];
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

type ToolHandler = (request: ExcelToolRequest) => Promise<ExcelToolResponse>;

const toolRegistry = new Map<string, { handler: ToolHandler; description: string }>();

function registerTool(name: string, description: string, handler: ToolHandler): void {
  toolRegistry.set(name, { handler, description });
}

// ---------------------------------------------------------------------------
// Tool: create_dataset
// ---------------------------------------------------------------------------

registerTool("create_dataset", "Create a new dataset from raw data", async (req) => {
  const startTime = Date.now();
  const { name, headers, rows, source } = req.inputs as {
    name: string;
    headers: string[];
    rows: unknown[][];
    source?: string;
  };

  const datasetId = createId("ds");
  const columns: ColumnModel[] = headers.map((h, idx) => {
    const samples = rows.map((r) => r[idx]).slice(0, 100);
    const dtype = inferColumnType(samples);
    const colValues = rows.map((r) => r[idx]);
    return {
      column_id: createId("col"),
      name: h,
      dtype,
      nullable: colValues.some((v) => v === null || v === undefined || v === ""),
      stats: computeColumnStats(colValues, dtype),
    };
  });

  const tableId = createId("tbl");
  const tableRows: TableRow[] = rows.map((r, idx) => ({ _idx: idx, cells: r }));

  const table: TableModel = {
    table_id: tableId,
    dataset_id: datasetId,
    name: normalizeToken(name),
    headers,
    rows: tableRows,
    dtypes: columns.map((c) => c.dtype),
  };

  const dataset: DatasetModel = {
    dataset_id: datasetId,
    name,
    columns,
    tables: [tableId],
    metadata: { source: source || "manual", rowCount: rows.length, columnCount: headers.length },
    created_at: new Date().toISOString(),
  };

  datasetStore.set(datasetId, dataset);
  tableStore.set(tableId, table);

  return {
    success: true,
    toolName: "create_dataset",
    message: `Dataset "${name}" created with ${rows.length} rows and ${headers.length} columns`,
    refs: { dataset: { datasetId, name, rowCount: rows.length, columnCount: headers.length } as DatasetRef },
    warnings: [],
    executionTime: Date.now() - startTime,
  };
});

// ---------------------------------------------------------------------------
// Tool: filter_table
// ---------------------------------------------------------------------------

registerTool("filter_table", "Filter table rows by condition", async (req) => {
  const startTime = Date.now();
  const { tableId, column, operator, value } = req.inputs as {
    tableId: string;
    column: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith";
    value: unknown;
  };

  const table = tableStore.get(tableId);
  if (!table) {
    return { success: false, toolName: "filter_table", message: `Table ${tableId} not found`, refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const colIdx = table.headers.indexOf(column);
  if (colIdx === -1) {
    return { success: false, toolName: "filter_table", message: `Column "${column}" not found`, refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const filteredRows = table.rows.filter((row) => {
    const cellValue = row.cells[colIdx];
    switch (operator) {
      case "eq": return cellValue == value;
      case "neq": return cellValue != value;
      case "gt": return toNumeric(cellValue) > toNumeric(value);
      case "gte": return toNumeric(cellValue) >= toNumeric(value);
      case "lt": return toNumeric(cellValue) < toNumeric(value);
      case "lte": return toNumeric(cellValue) <= toNumeric(value);
      case "contains": return valueToText(cellValue).includes(valueToText(value));
      case "startsWith": return valueToText(cellValue).startsWith(valueToText(value));
      case "endsWith": return valueToText(cellValue).endsWith(valueToText(value));
      default: return true;
    }
  });

  const newTableId = createId("tbl");
  const newTable: TableModel = {
    ...table,
    table_id: newTableId,
    name: `${table.name}_filtered`,
    rows: filteredRows.map((r, idx) => ({ ...r, _idx: idx })),
  };
  tableStore.set(newTableId, newTable);

  return {
    success: true,
    toolName: "filter_table",
    message: `Filtered ${table.rows.length} → ${filteredRows.length} rows`,
    refs: { table: { tableId: newTableId, datasetId: table.dataset_id, name: newTable.name, rowCount: filteredRows.length } as TableRef },
    warnings: [],
    executionTime: Date.now() - startTime,
  };
});

// ---------------------------------------------------------------------------
// Tool: sort_table
// ---------------------------------------------------------------------------

registerTool("sort_table", "Sort table by column", async (req) => {
  const startTime = Date.now();
  const { tableId, column, direction } = req.inputs as {
    tableId: string;
    column: string;
    direction: "asc" | "desc";
  };

  const table = tableStore.get(tableId);
  if (!table) {
    return { success: false, toolName: "sort_table", message: `Table ${tableId} not found`, refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const colIdx = table.headers.indexOf(column);
  if (colIdx === -1) {
    return { success: false, toolName: "sort_table", message: `Column "${column}" not found`, refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const sortedRows = [...table.rows].sort((a, b) => {
    const va = a.cells[colIdx];
    const vb = b.cells[colIdx];
    const na = toNumeric(va);
    const nb = toNumeric(vb);
    const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : valueToText(va).localeCompare(valueToText(vb), "ar");
    return direction === "desc" ? -cmp : cmp;
  });

  const newTableId = createId("tbl");
  const newTable: TableModel = { ...table, table_id: newTableId, name: `${table.name}_sorted`, rows: sortedRows };
  tableStore.set(newTableId, newTable);

  return {
    success: true,
    toolName: "sort_table",
    message: `Sorted by ${column} ${direction}`,
    refs: { table: { tableId: newTableId, datasetId: table.dataset_id, name: newTable.name, rowCount: sortedRows.length } as TableRef },
    warnings: [],
    executionTime: Date.now() - startTime,
  };
});

// ---------------------------------------------------------------------------
// Tool: aggregate_table
// ---------------------------------------------------------------------------

registerTool("aggregate_table", "Aggregate table data", async (req) => {
  const startTime = Date.now();
  const { tableId, groupBy, aggregations } = req.inputs as {
    tableId: string;
    groupBy: string[];
    aggregations: { column: string; operation: "sum" | "avg" | "count" | "min" | "max" }[];
  };

  const table = tableStore.get(tableId);
  if (!table) {
    return { success: false, toolName: "aggregate_table", message: `Table ${tableId} not found`, refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const groupIndices = groupBy.map((g) => table.headers.indexOf(g));
  const groups = new Map<string, TableRow[]>();

  for (const row of table.rows) {
    const key = groupIndices.map((i) => valueToText(row.cells[i])).join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const resultHeaders = [...groupBy, ...aggregations.map((a) => `${a.operation}_${a.column}`)];
  const resultRows: TableRow[] = [];

  let idx = 0;
  for (const [key, rows] of groups) {
    const groupValues = key.split("|");
    const aggValues = aggregations.map((agg) => {
      const colIdx = table.headers.indexOf(agg.column);
      const values = rows.map((r) => toNumeric(r.cells[colIdx]));
      switch (agg.operation) {
        case "sum": return values.reduce((a, b) => a + b, 0);
        case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
        case "count": return values.length;
        case "min": return Math.min(...values);
        case "max": return Math.max(...values);
      }
    });

    resultRows.push({ _idx: idx++, cells: [...groupValues, ...aggValues] });
  }

  const newTableId = createId("tbl");
  const newTable: TableModel = {
    table_id: newTableId,
    dataset_id: table.dataset_id,
    name: `${table.name}_aggregated`,
    headers: resultHeaders,
    rows: resultRows,
    dtypes: resultHeaders.map(() => "float" as ColumnDType),
  };
  tableStore.set(newTableId, newTable);

  return {
    success: true,
    toolName: "aggregate_table",
    message: `Aggregated ${table.rows.length} rows into ${resultRows.length} groups`,
    refs: { table: { tableId: newTableId, datasetId: table.dataset_id, name: newTable.name, rowCount: resultRows.length } as TableRef },
    warnings: [],
    executionTime: Date.now() - startTime,
  };
});

// ---------------------------------------------------------------------------
// Tool: add_computed_column
// ---------------------------------------------------------------------------

registerTool("add_computed_column", "Add a computed column to a table", async (req) => {
  const startTime = Date.now();
  const { tableId, columnName, formula } = req.inputs as {
    tableId: string;
    columnName: string;
    formula: string; // e.g., "col_a + col_b" or "col_a * 0.15"
  };

  const table = tableStore.get(tableId);
  if (!table) {
    return { success: false, toolName: "add_computed_column", message: `Table ${tableId} not found`, refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const warnings: ToolWarning[] = [];
  const newRows = table.rows.map((row) => {
    const context: Record<string, unknown> = {};
    table.headers.forEach((h, i) => {
      context[normalizeToken(h)] = row.cells[i];
    });

    let computed: unknown;
    try {
      // Simple formula evaluation
      let expr = formula;
      for (const [key, val] of Object.entries(context)) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), String(toNumeric(val)));
      }
      computed = Function(`"use strict"; return (${expr});`)();
    } catch {
      computed = null;
      warnings.push({ code: "EVAL_FAIL", message: `Formula evaluation failed for row ${row._idx}`, severity: "warn" });
    }

    return { ...row, cells: [...row.cells, computed] };
  });

  const newTableId = createId("tbl");
  const newTable: TableModel = {
    ...table,
    table_id: newTableId,
    name: table.name,
    headers: [...table.headers, columnName],
    rows: newRows,
    dtypes: [...table.dtypes, "float"],
  };
  tableStore.set(newTableId, newTable);

  return {
    success: true,
    toolName: "add_computed_column",
    message: `Added computed column "${columnName}"`,
    refs: { table: { tableId: newTableId, datasetId: table.dataset_id, name: newTable.name, rowCount: newRows.length } as TableRef },
    warnings,
    executionTime: Date.now() - startTime,
  };
});

// ---------------------------------------------------------------------------
// Tool: compare_tables
// ---------------------------------------------------------------------------

registerTool("compare_tables", "Compare two tables and find differences", async (req) => {
  const startTime = Date.now();
  const { leftTableId, rightTableId, keyColumns } = req.inputs as {
    leftTableId: string;
    rightTableId: string;
    keyColumns: string[];
  };

  const left = tableStore.get(leftTableId);
  const right = tableStore.get(rightTableId);
  if (!left || !right) {
    return { success: false, toolName: "compare_tables", message: "Table not found", refs: {}, warnings: [], executionTime: Date.now() - startTime };
  }

  const leftKeyIndices = keyColumns.map((k) => left.headers.indexOf(k));
  const rightKeyIndices = keyColumns.map((k) => right.headers.indexOf(k));

  const rightMap = new Map<string, TableRow>();
  for (const row of right.rows) {
    const key = rightKeyIndices.map((i) => valueToText(row.cells[i])).join("|");
    rightMap.set(key, row);
  }

  const diffHeaders = ["_status", ...left.headers];
  const diffRows: TableRow[] = [];
  let idx = 0;

  for (const row of left.rows) {
    const key = leftKeyIndices.map((i) => valueToText(row.cells[i])).join("|");
    const rightRow = rightMap.get(key);

    if (!rightRow) {
      diffRows.push({ _idx: idx++, cells: ["REMOVED", ...row.cells] });
    } else {
      const changed = row.cells.some((c, i) => valueToText(c) !== valueToText(rightRow.cells[i]));
      if (changed) {
        diffRows.push({ _idx: idx++, cells: ["MODIFIED", ...row.cells] });
      }
      rightMap.delete(key);
    }
  }

  for (const [, row] of rightMap) {
    diffRows.push({ _idx: idx++, cells: ["ADDED", ...row.cells] });
  }

  const newTableId = createId("tbl");
  const diffTable: TableModel = {
    table_id: newTableId,
    dataset_id: left.dataset_id,
    name: `${left.name}_diff`,
    headers: diffHeaders,
    rows: diffRows,
    dtypes: ["string", ...left.dtypes],
  };
  tableStore.set(newTableId, diffTable);

  return {
    success: true,
    toolName: "compare_tables",
    message: `Found ${diffRows.length} differences`,
    refs: { table: { tableId: newTableId, datasetId: left.dataset_id, name: diffTable.name, rowCount: diffRows.length } as TableRef },
    warnings: [],
    executionTime: Date.now() - startTime,
  };
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute an Excel tool by name.
 */
export async function executeExcelTool<TRefs = Record<string, unknown>>(
  request: ExcelToolRequest
): Promise<ExcelToolResponse<TRefs>> {
  const tool = toolRegistry.get(request.tool);
  if (!tool) {
    return {
      success: false,
      toolName: request.tool,
      message: `Unknown tool: ${request.tool}`,
      refs: {} as TRefs,
      warnings: [{ code: "UNKNOWN_TOOL", message: `Tool "${request.tool}" not found`, severity: "error" }],
      executionTime: 0,
    };
  }

  try {
    const result = await tool.handler(request);
    return result as ExcelToolResponse<TRefs>;
  } catch (error) {
    return {
      success: false,
      toolName: request.tool,
      message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
      refs: {} as TRefs,
      warnings: [{ code: "EXEC_FAIL", message: String(error), severity: "error" }],
      executionTime: 0,
    };
  }
}

/**
 * List all available Excel tools.
 */
export function listExcelTools(): { name: string; description: string }[] {
  return Array.from(toolRegistry.entries()).map(([name, { description }]) => ({ name, description }));
}

/**
 * Get a dataset by ID.
 */
export function getDataset(datasetId: string): DatasetModel | undefined {
  return datasetStore.get(datasetId);
}

/**
 * Get a table by ID.
 */
export function getTable(tableId: string): TableModel | undefined {
  return tableStore.get(tableId);
}

/**
 * Get a recipe by ID.
 */
export function getRecipe(recipeId: string): RecipeModel | undefined {
  return recipeStore.get(recipeId);
}
