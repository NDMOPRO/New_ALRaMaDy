/**
 * Spreadsheet Virtual Machine (SVM) — Main Engine
 * Namespace: rasid.excel.svm
 *
 * Orchestrates: DAG build → recalc → pivot reconstruct → CF eval → drift gate → snapshot.
 * All operations are deterministic with full evidence chain.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  DriftPolicy,
  FormulaDAG,
  LambdaDefinition,
  RecalcRequest,
  RecalcResult,
  RoundingPolicy,
  SVMCell,
  SVMCellStyle,
  SVMCellValue,
  SVMSheet,
  SVMSheetDimensions,
  SVMSnapshot,
  SVMWorkbook,
  SVMWorkbookMetadata,
} from './types';
import { buildFormulaDAG, hashFormulaDAG } from './formula-dag';
import { recalculate } from './recalc-engine';
import { reconstructAllPivots, type PivotReconstructResult } from './pivot-reconstruct';
import { evaluateAllConditionalFormats, type ConditionalFormatResult } from './conditional-format';
import { runDriftGate, enforceDriftPolicy, type DriftGateInput } from './drift-gate';
import { captureSnapshot, compareSnapshots, type SnapshotDiff } from './snapshot';

// ─── SVM Engine ─────────────────────────────────────────────────────────────

export class SVMEngine {
  private workbook: SVMWorkbook;
  private snapshots: SVMSnapshot[] = [];
  private recalcHistory: RecalcResult[] = [];

  constructor(config: SVMEngineConfig) {
    this.workbook = {
      workbookId: config.workbookId ?? `wb-${crypto.randomUUID()}`,
      sheets: new Map(),
      formulaDAG: emptyDAG(),
      namedRanges: new Map(Object.entries(config.namedRanges ?? {})),
      lambdaRegistry: new Map(),
      roundingPolicy: config.roundingPolicy ?? DEFAULT_ROUNDING_POLICY,
      driftPolicy: config.driftPolicy ?? 'FAIL_STRICT',
      metadata: {
        sourceFormat: config.sourceFormat ?? 'xlsx',
        originalFileName: config.originalFileName ?? '',
        createdAt: new Date().toISOString(),
        lastRecalcAt: null,
        lastRecalcHash: null,
        totalCells: 0,
        formulaCells: 0,
        sheetCount: 0,
      },
    };
  }

  // ─── Sheet Management ───────────────────────────────────────────────────

  addSheet(name: string, config?: Partial<SVMSheet>): SVMSheet {
    const sheet: SVMSheet = {
      name,
      index: this.workbook.sheets.size,
      cells: new Map(),
      dimensions: { rowCount: 0, colCount: 0, columnWidths: new Map(), rowHeights: new Map() },
      mergedCells: [],
      freezePane: config?.freezePane ?? null,
      autoFilter: config?.autoFilter ?? null,
      conditionalFormats: config?.conditionalFormats ?? [],
      pivotTables: config?.pivotTables ?? [],
      charts: config?.charts ?? [],
      isRtl: config?.isRtl ?? false,
      tabColor: config?.tabColor ?? null,
      hidden: config?.hidden ?? false,
      protection: config?.protection ?? null,
    };
    this.workbook.sheets.set(name, sheet);
    this.workbook.metadata.sheetCount = this.workbook.sheets.size;
    return sheet;
  }

  getSheet(name: string): SVMSheet | undefined {
    return this.workbook.sheets.get(name);
  }

  // ─── Cell Operations ────────────────────────────────────────────────────

  setCell(
    sheetName: string,
    row: number,
    col: number,
    value: unknown,
    options?: {
      formula?: string;
      format?: string;
      style?: SVMCellStyle;
    }
  ): SVMCell {
    const sheet = this.workbook.sheets.get(sheetName);
    if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

    const colLetter = colNumToLetter(col);
    const ref: CellRef = `${sheetName}!${colLetter}${row}`;
    const valueHash = hashValue(value);

    const cell: SVMCell = {
      ref,
      sheetName,
      row,
      col,
      value: {
        value,
        type: detectType(value),
        formula: options?.formula ?? null,
        format: options?.format ?? null,
        valueHash,
      },
      style: options?.style ?? null,
      merge: null,
      conditionalFormats: [],
    };

    sheet.cells.set(ref, cell);
    this.updateDimensions(sheet, row, col);
    this.workbook.metadata.totalCells = this.countTotalCells();
    this.workbook.metadata.formulaCells = this.countFormulaCells();

    return cell;
  }

  getCell(sheetName: string, row: number, col: number): SVMCell | undefined {
    const sheet = this.workbook.sheets.get(sheetName);
    if (!sheet) return undefined;
    const colLetter = colNumToLetter(col);
    return sheet.cells.get(`${sheetName}!${colLetter}${row}`);
  }

  getCellByRef(ref: CellRef): SVMCell | undefined {
    for (const [, sheet] of this.workbook.sheets) {
      const cell = sheet.cells.get(ref);
      if (cell) return cell;
    }
    return undefined;
  }

  // ─── Freeze Pane Preservation ───────────────────────────────────────────

  setFreezePane(sheetName: string, row: number, col: number): void {
    const sheet = this.workbook.sheets.get(sheetName);
    if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
    sheet.freezePane = { row, col };
  }

  getFreezePane(sheetName: string): { row: number; col: number } | null {
    return this.workbook.sheets.get(sheetName)?.freezePane ?? null;
  }

  // ─── Formula DAG ───────────────────────────────────────────────────────

  buildDAG(): FormulaDAG {
    this.workbook.formulaDAG = buildFormulaDAG(this.workbook);
    return this.workbook.formulaDAG;
  }

  getDAG(): FormulaDAG {
    return this.workbook.formulaDAG;
  }

  // ─── Recalculation ──────────────────────────────────────────────────────

  recalculate(mode: RecalcRequest['mode'] = 'full', dirtyCells: CellRef[] = []): RecalcResult {
    // Ensure DAG is built
    if (this.workbook.formulaDAG.nodeCount === 0) {
      this.buildDAG();
    }

    const request: RecalcRequest = {
      mode,
      dirtyCells,
      forceVolatile: mode === 'full',
      executionSeed: crypto.randomUUID(),
    };

    const result = recalculate(this.workbook, request);
    this.recalcHistory.push(result);
    this.workbook.metadata.lastRecalcAt = new Date().toISOString();
    this.workbook.metadata.lastRecalcHash = result.resultHash;

    return result;
  }

  // ─── Pivot Reconstruction ───────────────────────────────────────────────

  reconstructPivots(): PivotReconstructResult[] {
    return reconstructAllPivots(this.workbook);
  }

  // ─── Conditional Formatting ─────────────────────────────────────────────

  evaluateConditionalFormats(): Map<string, ConditionalFormatResult> {
    return evaluateAllConditionalFormats(this.workbook);
  }

  // ─── Drift Gate ─────────────────────────────────────────────────────────

  checkDrift(
    renderedCells: Map<CellRef, unknown>,
    exportedCells?: Map<CellRef, unknown>,
    dashboardMeasures?: Map<string, unknown>
  ): { passed: boolean; details: string } {
    const input: DriftGateInput = {
      workbook: this.workbook,
      renderedCells,
      exportedCells: exportedCells ?? null,
      dashboardMeasures: dashboardMeasures ?? null,
    };

    const result = runDriftGate(input);

    // Enforce policy (throws on FAIL_STRICT with drift)
    enforceDriftPolicy(result);

    return {
      passed: result.passed,
      details: result.passed
        ? 'No drift detected'
        : `${result.driftDetails.length} drift(s) detected: ${result.driftDetails.map(d => d.cellRef).join(', ')}`,
    };
  }

  // ─── Snapshot & Evidence ────────────────────────────────────────────────

  captureSnapshot(): SVMSnapshot {
    const snapshot = captureSnapshot(this.workbook);
    this.snapshots.push(snapshot);
    return snapshot;
  }

  compareWithLastSnapshot(): SnapshotDiff | null {
    if (this.snapshots.length < 2) return null;
    const before = this.snapshots[this.snapshots.length - 2];
    const after = this.snapshots[this.snapshots.length - 1];
    return compareSnapshots(before, after);
  }

  // ─── Full Pipeline ──────────────────────────────────────────────────────

  /**
   * Execute the full SVM pipeline:
   * 1. Build formula DAG
   * 2. Recalculate all formulas
   * 3. Reconstruct pivot tables
   * 4. Evaluate conditional formatting
   * 5. Capture snapshot for evidence
   *
   * Returns evidence of deterministic execution.
   */
  executePipeline(): SVMPipelineResult {
    const startTime = Date.now();

    // Step 1: Build DAG
    const dag = this.buildDAG();

    // Step 2: Recalculate
    const recalcResult = this.recalculate('full');

    // Step 3: Pivot reconstruction
    const pivotResults = this.reconstructPivots();

    // Step 4: Conditional formatting
    const cfResults = this.evaluateConditionalFormats();

    // Step 5: Capture snapshot
    const snapshot = this.captureSnapshot();

    const durationMs = Date.now() - startTime;

    return {
      workbookId: this.workbook.workbookId,
      dagNodeCount: dag.nodeCount,
      dagEdgeCount: dag.edgeCount,
      circularRefCount: dag.circularRefs.length,
      recalcResult: {
        cellsEvaluated: recalcResult.cellsEvaluated,
        cellsSkipped: recalcResult.cellsSkipped,
        errors: recalcResult.errors.length,
        deterministic: recalcResult.deterministic,
        resultHash: recalcResult.resultHash,
      },
      pivotResults: pivotResults.map(p => ({
        pivotId: p.pivotId,
        cellsWritten: p.cellsWritten,
        cacheHash: p.cacheHash,
        deterministic: p.deterministic,
      })),
      conditionalFormatResults: [...cfResults.entries()].map(([sheet, r]) => ({
        sheet,
        rulesEvaluated: r.rulesEvaluated,
        cellsAffected: r.cellsAffected,
        deterministic: r.deterministic,
        resultHash: r.resultHash,
      })),
      snapshotId: snapshot.snapshotId,
      formulaDAGHash: snapshot.formulaDAGHash,
      letCoverage: dag.letCells.size,
      lambdaCoverage: dag.lambdaCells.size,
      volatileCellCount: dag.volatileCells.size,
      driftPolicy: this.workbook.driftPolicy,
      roundingPolicy: this.workbook.roundingPolicy,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Lambda Registry ────────────────────────────────────────────────────

  registerLambda(def: LambdaDefinition): void {
    this.workbook.lambdaRegistry.set(def.name, def);
  }

  getLambda(name: string): LambdaDefinition | undefined {
    return this.workbook.lambdaRegistry.get(name);
  }

  // ─── Accessors ──────────────────────────────────────────────────────────

  getWorkbook(): SVMWorkbook {
    return this.workbook;
  }

  getMetadata(): SVMWorkbookMetadata {
    return this.workbook.metadata;
  }

  getRecalcHistory(): RecalcResult[] {
    return [...this.recalcHistory];
  }

  getSnapshots(): SVMSnapshot[] {
    return [...this.snapshots];
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private updateDimensions(sheet: SVMSheet, row: number, col: number): void {
    if (row > sheet.dimensions.rowCount) sheet.dimensions.rowCount = row;
    if (col > sheet.dimensions.colCount) sheet.dimensions.colCount = col;
  }

  private countTotalCells(): number {
    let count = 0;
    for (const [, sheet] of this.workbook.sheets) {
      count += sheet.cells.size;
    }
    return count;
  }

  private countFormulaCells(): number {
    let count = 0;
    for (const [, sheet] of this.workbook.sheets) {
      for (const [, cell] of sheet.cells) {
        if (cell.value.formula) count++;
      }
    }
    return count;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SVMEngineConfig {
  workbookId?: string;
  sourceFormat?: string;
  originalFileName?: string;
  roundingPolicy?: RoundingPolicy;
  driftPolicy?: DriftPolicy;
  namedRanges?: Record<string, string>;
}

export interface SVMPipelineResult {
  workbookId: string;
  dagNodeCount: number;
  dagEdgeCount: number;
  circularRefCount: number;
  recalcResult: {
    cellsEvaluated: number;
    cellsSkipped: number;
    errors: number;
    deterministic: boolean;
    resultHash: string;
  };
  pivotResults: Array<{
    pivotId: string;
    cellsWritten: number;
    cacheHash: string;
    deterministic: boolean;
  }>;
  conditionalFormatResults: Array<{
    sheet: string;
    rulesEvaluated: number;
    cellsAffected: number;
    deterministic: boolean;
    resultHash: string;
  }>;
  snapshotId: string;
  formulaDAGHash: string;
  letCoverage: number;
  lambdaCoverage: number;
  volatileCellCount: number;
  driftPolicy: DriftPolicy;
  roundingPolicy: RoundingPolicy;
  durationMs: number;
  timestamp: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_ROUNDING_POLICY: RoundingPolicy = {
  mode: 'half_up',
  maxDecimalPlaces: 15,
  integerExact: true,
};

function emptyDAG(): FormulaDAG {
  return {
    nodes: new Map(),
    topologicalOrder: [],
    volatileCells: new Set(),
    letCells: new Set(),
    lambdaCells: new Set(),
    circularRefs: [],
    buildTimestamp: new Date().toISOString(),
    nodeCount: 0,
    edgeCount: 0,
  };
}

function detectType(value: unknown): SVMCellValue['type'] {
  if (value === null || value === undefined || value === '') return 'blank';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string' && /^#(DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|NULL!|ERROR!)$/.test(value)) return 'error';
  return 'string';
}

function hashValue(value: unknown): string {
  const str = value instanceof Date ? value.toISOString() : JSON.stringify(value);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

function colNumToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c > 0) {
    c--;
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26);
  }
  return result || 'A';
}
