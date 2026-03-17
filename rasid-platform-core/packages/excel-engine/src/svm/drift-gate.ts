/**
 * Drift Gate — Deterministic comparison between SVM result,
 * rendered spreadsheet, and exported dashboard measures.
 *
 * Policy: FAIL_STRICT — any drift = hard failure.
 * No silent degradation allowed.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  DriftCheckResult,
  DriftDetail,
  DriftPolicy,
  SVMCellValue,
  SVMWorkbook,
} from './types';

export interface DriftGateInput {
  workbook: SVMWorkbook;
  renderedCells: Map<CellRef, unknown>;
  exportedCells: Map<CellRef, unknown> | null;
  dashboardMeasures: Map<string, unknown> | null;
}

export function runDriftGate(input: DriftGateInput): DriftCheckResult {
  const { workbook, renderedCells, exportedCells, dashboardMeasures } = input;
  const policy = workbook.driftPolicy;
  const details: DriftDetail[] = [];

  // Compute SVM hash from all cells
  const svmParts: string[] = [];
  for (const [, sheet] of workbook.sheets) {
    for (const [ref, cell] of sheet.cells) {
      svmParts.push(`${ref}:${cell.value.valueHash}`);
    }
  }
  svmParts.sort();
  const svmHash = crypto.createHash('sha256').update(svmParts.join('|')).digest('hex');

  // Compute rendered hash
  const renderedParts: string[] = [];
  for (const [ref, value] of [...renderedCells.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    renderedParts.push(`${ref}:${hashVal(value)}`);
  }
  const renderedHash = crypto.createHash('sha256').update(renderedParts.join('|')).digest('hex');

  // Check SVM vs rendered
  for (const [ref, svmCell] of iterateAllCells(workbook)) {
    const rendered = renderedCells.get(ref);
    if (rendered === undefined) {
      // Missing in rendered output
      if (svmCell.value !== null && svmCell.value !== '') {
        details.push({
          cellRef: ref,
          svmValue: svmCell.value,
          renderedValue: undefined,
          exportedValue: null,
          driftType: 'missing_cell',
        });
      }
      continue;
    }

    if (!valuesMatch(svmCell.value, rendered)) {
      details.push({
        cellRef: ref,
        svmValue: svmCell.value,
        renderedValue: rendered,
        exportedValue: exportedCells?.get(ref) ?? null,
        driftType: detectDriftType(svmCell.value, rendered),
      });
    }
  }

  // Check exported if provided
  let exportedHash: string | null = null;
  if (exportedCells) {
    const exportParts: string[] = [];
    for (const [ref, value] of [...exportedCells.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      exportParts.push(`${ref}:${hashVal(value)}`);
    }
    exportedHash = crypto.createHash('sha256').update(exportParts.join('|')).digest('hex');

    for (const [ref, svmCell] of iterateAllCells(workbook)) {
      const exported = exportedCells.get(ref);
      if (exported === undefined) continue;
      if (!valuesMatch(svmCell.value, exported)) {
        // Avoid duplicate entries
        if (!details.some(d => d.cellRef === ref)) {
          details.push({
            cellRef: ref,
            svmValue: svmCell.value,
            renderedValue: renderedCells.get(ref) ?? null,
            exportedValue: exported,
            driftType: detectDriftType(svmCell.value, exported),
          });
        }
      }
    }
  }

  // Check dashboard measures if bound
  let dashboardHash: string | null = null;
  if (dashboardMeasures) {
    const dashParts: string[] = [];
    for (const [key, value] of [...dashboardMeasures.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      dashParts.push(`${key}:${hashVal(value)}`);
    }
    dashboardHash = crypto.createHash('sha256').update(dashParts.join('|')).digest('hex');
  }

  const passed = details.length === 0;

  return {
    passed,
    policy,
    svmHash,
    renderedHash,
    exportedHash,
    dashboardHash,
    driftDetails: details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Enforce drift policy. Returns true if execution should continue,
 * throws on FAIL_STRICT with drift detected.
 */
export function enforceDriftPolicy(result: DriftCheckResult): boolean {
  if (result.passed) return true;

  switch (result.policy) {
    case 'FAIL_STRICT':
      throw new DriftFailureError(result);
    case 'WARN':
      return true; // Continue but caller must log warning
    case 'IGNORE':
      return true;
  }
}

export class DriftFailureError extends Error {
  readonly driftResult: DriftCheckResult;

  constructor(result: DriftCheckResult) {
    const count = result.driftDetails.length;
    const firstDrift = result.driftDetails[0];
    const detail = firstDrift
      ? ` First: ${firstDrift.cellRef} SVM=${JSON.stringify(firstDrift.svmValue)} vs rendered=${JSON.stringify(firstDrift.renderedValue)}`
      : '';
    super(`DRIFT_GATE_FAIL_STRICT: ${count} cell(s) drifted between SVM and rendered output.${detail}`);
    this.name = 'DriftFailureError';
    this.driftResult = result;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function* iterateAllCells(workbook: SVMWorkbook): Generator<[CellRef, SVMCellValue]> {
  for (const [, sheet] of workbook.sheets) {
    for (const [ref, cell] of sheet.cells) {
      yield [ref, cell.value];
    }
  }
}

function valuesMatch(svmValue: unknown, renderedValue: unknown): boolean {
  // Exact match for integers
  if (typeof svmValue === 'number' && typeof renderedValue === 'number') {
    if (Number.isInteger(svmValue) && Number.isInteger(renderedValue)) {
      return svmValue === renderedValue;
    }
    // Float comparison with epsilon
    return Math.abs(svmValue - renderedValue) < 1e-10;
  }

  // Date comparison
  if (svmValue instanceof Date && renderedValue instanceof Date) {
    return svmValue.getTime() === renderedValue.getTime();
  }

  // Boolean
  if (typeof svmValue === 'boolean' && typeof renderedValue === 'boolean') {
    return svmValue === renderedValue;
  }

  // Null/blank equivalence
  if ((svmValue === null || svmValue === undefined || svmValue === '') &&
      (renderedValue === null || renderedValue === undefined || renderedValue === '')) {
    return true;
  }

  // String comparison (case-sensitive)
  return `${svmValue}` === `${renderedValue}`;
}

function detectDriftType(svmValue: unknown, otherValue: unknown): 'value_mismatch' | 'type_mismatch' | 'format_mismatch' | 'missing_cell' {
  if (otherValue === undefined || otherValue === null) return 'missing_cell';
  if (typeof svmValue !== typeof otherValue) return 'type_mismatch';
  return 'value_mismatch';
}

function hashVal(value: unknown): string {
  const str = value instanceof Date ? value.toISOString() : JSON.stringify(value);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}
