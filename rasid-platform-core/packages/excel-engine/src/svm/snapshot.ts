/**
 * SVM Snapshot — Captures deterministic state for evidence & drift detection.
 * Namespace: rasid.excel.svm.snapshot
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  SVMFreezePane,
  SVMSnapshot,
  SVMWorkbook,
} from './types';
import { hashFormulaDAG } from './formula-dag';

/**
 * Capture a full snapshot of the SVM workbook state.
 * Used for evidence packs and drift gate comparisons.
 */
export function captureSnapshot(workbook: SVMWorkbook): SVMSnapshot {
  const cellHashes = new Map<CellRef, string>();
  const pivotHashes = new Map<string, string>();
  const chartHashes = new Map<string, string>();
  const conditionalFormatHashes = new Map<string, string>();
  const freezePaneState = new Map<string, SVMFreezePane | null>();

  for (const [sheetName, sheet] of workbook.sheets) {
    // Cell hashes
    for (const [ref, cell] of sheet.cells) {
      cellHashes.set(ref, cell.value.valueHash);
    }

    // Pivot hashes
    for (const pivot of sheet.pivotTables) {
      const pivotStr = JSON.stringify({
        id: pivot.pivotId,
        rowFields: pivot.rowFields,
        columnFields: pivot.columnFields,
        valueFields: pivot.valueFields,
        data: pivot.data,
      });
      pivotHashes.set(pivot.pivotId, hashStr(pivotStr));
    }

    // Chart hashes
    for (const chart of sheet.charts) {
      const chartStr = JSON.stringify({
        id: chart.chartId,
        type: chart.chartType,
        series: chart.series,
        sourceSheet: chart.sourceSheet,
      });
      chartHashes.set(chart.chartId, hashStr(chartStr));
    }

    // Conditional format hash per sheet
    if (sheet.conditionalFormats.length > 0) {
      const cfStr = JSON.stringify(sheet.conditionalFormats);
      conditionalFormatHashes.set(sheetName, hashStr(cfStr));
    }

    // Freeze pane state
    freezePaneState.set(sheetName, sheet.freezePane);
  }

  const dagHash = hashFormulaDAG(workbook.formulaDAG);

  return {
    snapshotId: `snap-${crypto.randomUUID()}`,
    workbookId: workbook.workbookId,
    timestamp: new Date().toISOString(),
    cellHashes,
    formulaDAGHash: dagHash,
    recalcResultHash: workbook.metadata.lastRecalcHash,
    pivotHashes,
    chartHashes,
    conditionalFormatHashes,
    freezePaneState,
  };
}

/**
 * Compare two snapshots and return drift details.
 */
export function compareSnapshots(before: SVMSnapshot, after: SVMSnapshot): SnapshotDiff {
  const changedCells: CellRef[] = [];
  const addedCells: CellRef[] = [];
  const removedCells: CellRef[] = [];

  // Find changed and removed cells
  for (const [ref, hash] of before.cellHashes) {
    const afterHash = after.cellHashes.get(ref);
    if (afterHash === undefined) {
      removedCells.push(ref);
    } else if (afterHash !== hash) {
      changedCells.push(ref);
    }
  }

  // Find added cells
  for (const [ref] of after.cellHashes) {
    if (!before.cellHashes.has(ref)) {
      addedCells.push(ref);
    }
  }

  return {
    beforeSnapshotId: before.snapshotId,
    afterSnapshotId: after.snapshotId,
    changedCells: changedCells.sort(),
    addedCells: addedCells.sort(),
    removedCells: removedCells.sort(),
    formulaDAGChanged: before.formulaDAGHash !== after.formulaDAGHash,
    pivotChanged: !mapsEqual(before.pivotHashes, after.pivotHashes),
    chartChanged: !mapsEqual(before.chartHashes, after.chartHashes),
    conditionalFormatChanged: !mapsEqual(before.conditionalFormatHashes, after.conditionalFormatHashes),
    freezePaneChanged: !mapsEqual(
      new Map([...before.freezePaneState].map(([k, v]) => [k, JSON.stringify(v)])),
      new Map([...after.freezePaneState].map(([k, v]) => [k, JSON.stringify(v)]))
    ),
    totalChanges: changedCells.length + addedCells.length + removedCells.length,
  };
}

export interface SnapshotDiff {
  beforeSnapshotId: string;
  afterSnapshotId: string;
  changedCells: CellRef[];
  addedCells: CellRef[];
  removedCells: CellRef[];
  formulaDAGChanged: boolean;
  pivotChanged: boolean;
  chartChanged: boolean;
  conditionalFormatChanged: boolean;
  freezePaneChanged: boolean;
  totalChanges: number;
}

function mapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, val] of a) {
    if (b.get(key) !== val) return false;
  }
  return true;
}

function hashStr(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
