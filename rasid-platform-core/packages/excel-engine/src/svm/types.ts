/**
 * Spreadsheet Virtual Machine (SVM) — Type Definitions
 * Namespace: rasid.excel.svm
 *
 * Deterministic formula DAG, recalculation engine, and drift gate types.
 */

export type CellRef = string; // e.g. "Sheet1!A1"

export type SVMCellValueType = 'number' | 'string' | 'boolean' | 'date' | 'error' | 'blank';

export interface SVMCellValue {
  value: unknown;
  type: SVMCellValueType;
  formula: string | null;
  format: string | null;
  /** Hash of the computed value for drift detection */
  valueHash: string;
}

export interface SVMCell {
  ref: CellRef;
  sheetName: string;
  row: number;
  col: number;
  value: SVMCellValue;
  style: SVMCellStyle | null;
  merge: SVMMerge | null;
  conditionalFormats: ConditionalFormatRule[];
}

export interface SVMCellStyle {
  font: Partial<SVMFont> | null;
  fill: Partial<SVMFill> | null;
  border: Partial<SVMBorder> | null;
  alignment: Partial<SVMAlignment> | null;
  numberFormat: string | null;
  dateFormat: string | null;
  currencyCode: string | null;
}

export interface SVMFont {
  name: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

export interface SVMFill {
  type: 'pattern' | 'gradient';
  pattern: string;
  fgColor: string;
  bgColor: string;
}

export interface SVMBorder {
  top: SVMBorderEdge | null;
  bottom: SVMBorderEdge | null;
  left: SVMBorderEdge | null;
  right: SVMBorderEdge | null;
}

export interface SVMBorderEdge {
  style: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';
  color: string;
}

export interface SVMAlignment {
  horizontal: 'left' | 'center' | 'right' | 'justify';
  vertical: 'top' | 'middle' | 'bottom';
  wrapText: boolean;
  textRotation: number;
  readingOrder: 'ltr' | 'rtl';
}

export interface SVMMerge {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ConditionalFormatRule {
  ruleId: string;
  type: 'cell_is' | 'contains_text' | 'color_scale' | 'data_bar' | 'icon_set' | 'top_bottom' | 'above_average' | 'duplicate' | 'formula_based';
  operator: string | null;
  formula: string | null;
  text: string | null;
  priority: number;
  stopIfTrue: boolean;
  style: Partial<SVMCellStyle>;
  range: string;
}

export interface SVMSheet {
  name: string;
  index: number;
  cells: Map<CellRef, SVMCell>;
  dimensions: SVMSheetDimensions;
  mergedCells: SVMMerge[];
  freezePane: SVMFreezePane | null;
  autoFilter: SVMAutoFilter | null;
  conditionalFormats: ConditionalFormatRule[];
  pivotTables: SVMPivotTable[];
  charts: SVMChartAnchor[];
  isRtl: boolean;
  tabColor: string | null;
  hidden: boolean;
  protection: SVMSheetProtection | null;
}

export interface SVMSheetDimensions {
  rowCount: number;
  colCount: number;
  columnWidths: Map<number, number>;
  rowHeights: Map<number, number>;
}

export interface SVMFreezePane {
  row: number;
  col: number;
}

export interface SVMAutoFilter {
  range: string;
  columns: SVMAutoFilterColumn[];
}

export interface SVMAutoFilterColumn {
  colIndex: number;
  filterType: 'values' | 'custom' | 'dynamic' | 'top10';
  values: unknown[];
}

export interface SVMSheetProtection {
  password: string | null;
  allowSelectLockedCells: boolean;
  allowSelectUnlockedCells: boolean;
  allowFormatCells: boolean;
  allowInsertRows: boolean;
  allowDeleteRows: boolean;
  allowSort: boolean;
  allowAutoFilter: boolean;
}

export interface SVMPivotTable {
  pivotId: string;
  name: string;
  sourceSheet: string;
  sourceRange: string;
  targetSheet: string;
  targetRange: string;
  rowFields: string[];
  columnFields: string[];
  valueFields: SVMPivotValueField[];
  filterFields: string[];
  slicerFields: string[];
  showGrandTotalRows: boolean;
  showGrandTotalColumns: boolean;
  showSubtotals: boolean;
  cacheId: string;
  data: SVMPivotData | null;
}

export interface SVMPivotValueField {
  field: string;
  aggregation: 'sum' | 'count' | 'average' | 'min' | 'max' | 'count_distinct' | 'median';
  alias: string | null;
  numberFormat: string | null;
}

export interface SVMPivotData {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  grandTotals: Record<string, number>;
}

export interface SVMChartAnchor {
  chartId: string;
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'combo' | 'scatter' | 'radar';
  title: string;
  anchorRange: string;
  sourceSheet: string;
  categoryField: string;
  series: SVMChartSeries[];
  legendPosition: 'right' | 'bottom' | 'top' | 'none';
}

export interface SVMChartSeries {
  name: string;
  valueField: string;
  chartType: string;
  color: string;
  secondaryAxis: boolean;
}

// ─── Formula DAG Types ──────────────────────────────────────────────────────

export interface FormulaDAGNode {
  cellRef: CellRef;
  formula: string;
  dependsOn: Set<CellRef>;
  dependedBy: Set<CellRef>;
  lastComputedHash: string;
  evaluationOrder: number;
  isVolatile: boolean;
  isLet: boolean;
  isLambda: boolean;
}

export interface FormulaDAG {
  nodes: Map<CellRef, FormulaDAGNode>;
  topologicalOrder: CellRef[];
  volatileCells: Set<CellRef>;
  letCells: Set<CellRef>;
  lambdaCells: Set<CellRef>;
  circularRefs: CellRef[][];
  buildTimestamp: string;
  nodeCount: number;
  edgeCount: number;
}

// ─── Recalculation Types ────────────────────────────────────────────────────

export type RecalcMode = 'full' | 'incremental' | 'dirty_only';

export interface RecalcRequest {
  mode: RecalcMode;
  dirtyCells: CellRef[];
  forceVolatile: boolean;
  executionSeed: string;
}

export interface RecalcResult {
  updatedCells: Map<CellRef, SVMCellValue>;
  cellsEvaluated: number;
  cellsSkipped: number;
  errors: RecalcError[];
  durationMs: number;
  deterministic: boolean;
  resultHash: string;
  executionSeed: string;
}

export interface RecalcError {
  cellRef: CellRef;
  formula: string;
  errorType: string;
  message: string;
}

// ─── Drift Gate Types ───────────────────────────────────────────────────────

export type DriftPolicy = 'FAIL_STRICT' | 'WARN' | 'IGNORE';

export interface DriftCheckResult {
  passed: boolean;
  policy: DriftPolicy;
  svmHash: string;
  renderedHash: string;
  exportedHash: string | null;
  dashboardHash: string | null;
  driftDetails: DriftDetail[];
  timestamp: string;
}

export interface DriftDetail {
  cellRef: CellRef;
  svmValue: unknown;
  renderedValue: unknown;
  exportedValue: unknown | null;
  driftType: 'value_mismatch' | 'type_mismatch' | 'format_mismatch' | 'missing_cell';
}

// ─── Rounding Policy ────────────────────────────────────────────────────────

export interface RoundingPolicy {
  mode: 'half_up' | 'half_even' | 'truncate';
  maxDecimalPlaces: number;
  integerExact: boolean;
}

// ─── LET/LAMBDA Definitions ─────────────────────────────────────────────────

export interface LetBinding {
  name: string;
  valueExpression: string;
  scope: 'formula' | 'worksheet' | 'workbook';
}

export interface LambdaDefinition {
  lambdaId: string;
  name: string;
  parameters: string[];
  bodyExpression: string;
  scope: 'workbook' | 'worksheet';
  worksheetName: string | null;
  recursionPolicy: 'no_recursion' | 'bounded';
  recursionLimit: number;
}

// ─── SVM Workbook (top-level) ───────────────────────────────────────────────

export interface SVMWorkbook {
  workbookId: string;
  sheets: Map<string, SVMSheet>;
  formulaDAG: FormulaDAG;
  namedRanges: Map<string, string>;
  lambdaRegistry: Map<string, LambdaDefinition>;
  roundingPolicy: RoundingPolicy;
  driftPolicy: DriftPolicy;
  metadata: SVMWorkbookMetadata;
}

export interface SVMWorkbookMetadata {
  sourceFormat: string;
  originalFileName: string;
  createdAt: string;
  lastRecalcAt: string | null;
  lastRecalcHash: string | null;
  totalCells: number;
  formulaCells: number;
  sheetCount: number;
}

// ─── SVM Snapshot for evidence ──────────────────────────────────────────────

export interface SVMSnapshot {
  snapshotId: string;
  workbookId: string;
  timestamp: string;
  cellHashes: Map<CellRef, string>;
  formulaDAGHash: string;
  recalcResultHash: string | null;
  pivotHashes: Map<string, string>;
  chartHashes: Map<string, string>;
  conditionalFormatHashes: Map<string, string>;
  freezePaneState: Map<string, SVMFreezePane | null>;
}
