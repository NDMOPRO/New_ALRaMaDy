/**
 * Deterministic Pivot Table Reconstruction
 * Namespace: rasid.excel.svm.pivot
 *
 * Rebuilds pivot tables from source data deterministically,
 * preserving cache, slicers, and calculated fields.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  SVMPivotData,
  SVMPivotTable,
  SVMPivotValueField,
  SVMSheet,
  SVMWorkbook,
} from './types';

export interface PivotReconstructRequest {
  pivotId: string;
  forceRebuild: boolean;
}

export interface PivotReconstructResult {
  pivotId: string;
  data: SVMPivotData;
  cellsWritten: number;
  cacheHash: string;
  deterministic: boolean;
  timestamp: string;
}

/**
 * Reconstruct a pivot table deterministically from source data.
 * All aggregations are computed in a fixed, sorted order to guarantee
 * identical output for identical input.
 */
export function reconstructPivot(
  workbook: SVMWorkbook,
  request: PivotReconstructRequest
): PivotReconstructResult {
  // Find the pivot table
  let pivot: SVMPivotTable | null = null;
  let sourceSheet: SVMSheet | null = null;

  for (const [, sheet] of workbook.sheets) {
    for (const pt of sheet.pivotTables) {
      if (pt.pivotId === request.pivotId) {
        pivot = pt;
        sourceSheet = workbook.sheets.get(pt.sourceSheet) ?? null;
        break;
      }
    }
    if (pivot) break;
  }

  if (!pivot || !sourceSheet) {
    throw new Error(`Pivot table ${request.pivotId} not found or source sheet missing`);
  }

  // Extract source data as array of records
  const sourceData = extractSourceData(sourceSheet, pivot.sourceRange);

  // Apply filters
  const filteredData = applyPivotFilters(sourceData, pivot.filterFields);

  // Sort deterministically by row fields then column fields
  const sortedData = [...filteredData].sort((a, b) => {
    for (const field of pivot!.rowFields) {
      const cmp = compareValues(a[field], b[field]);
      if (cmp !== 0) return cmp;
    }
    for (const field of pivot!.columnFields) {
      const cmp = compareValues(a[field], b[field]);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  // Group by row fields
  const groups = groupByFields(sortedData, pivot.rowFields);

  // Compute aggregations
  const resultRows: Array<Record<string, unknown>> = [];
  const grandTotals: Record<string, number> = {};

  // Initialize grand totals
  for (const vf of pivot.valueFields) {
    grandTotals[vf.alias ?? vf.field] = 0;
  }

  // Process each group deterministically (sorted keys)
  const sortedGroupKeys = [...groups.keys()].sort();
  for (const key of sortedGroupKeys) {
    const groupRows = groups.get(key)!;
    const row: Record<string, unknown> = {};

    // Set row field values from the first record in the group
    const firstRecord = groupRows[0];
    for (const field of pivot.rowFields) {
      row[field] = firstRecord[field];
    }

    // If column fields exist, create sub-groups
    if (pivot.columnFields.length > 0) {
      const subGroups = groupByFields(groupRows, pivot.columnFields);
      const sortedSubKeys = [...subGroups.keys()].sort();

      for (const subKey of sortedSubKeys) {
        const subRows = subGroups.get(subKey)!;
        for (const vf of pivot.valueFields) {
          const colLabel = `${subKey}_${vf.alias ?? vf.field}`;
          row[colLabel] = computeAggregation(subRows, vf);
        }
      }
    }

    // Compute aggregate values for this row
    for (const vf of pivot.valueFields) {
      const fieldName = vf.alias ?? vf.field;
      const value = computeAggregation(groupRows, vf);
      row[fieldName] = value;

      // Update grand totals
      if (typeof value === 'number') {
        grandTotals[fieldName] = (grandTotals[fieldName] ?? 0) + value;
      }
    }

    resultRows.push(row);
  }

  // Fix grand totals for count/average
  for (const vf of pivot.valueFields) {
    const fieldName = vf.alias ?? vf.field;
    if (vf.aggregation === 'average') {
      grandTotals[fieldName] = computeAggregation(sortedData, vf) as number;
    }
    if (vf.aggregation === 'count' || vf.aggregation === 'count_distinct') {
      grandTotals[fieldName] = computeAggregation(sortedData, vf) as number;
    }
    if (vf.aggregation === 'min') {
      grandTotals[fieldName] = computeAggregation(sortedData, vf) as number;
    }
    if (vf.aggregation === 'max') {
      grandTotals[fieldName] = computeAggregation(sortedData, vf) as number;
    }
  }

  // Build headers
  const headers = [
    ...pivot.rowFields,
    ...pivot.valueFields.map(vf => vf.alias ?? vf.field),
  ];

  const pivotData: SVMPivotData = {
    headers,
    rows: resultRows,
    grandTotals,
  };

  // Write pivot data to target sheet cells
  const cellsWritten = writePivotToSheet(workbook, pivot, pivotData);

  // Compute deterministic cache hash
  const cacheHash = crypto.createHash('sha256')
    .update(JSON.stringify({ headers, rows: resultRows, grandTotals }))
    .digest('hex');

  // Update pivot data reference
  pivot.data = pivotData;

  return {
    pivotId: pivot.pivotId,
    data: pivotData,
    cellsWritten,
    cacheHash,
    deterministic: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reconstruct all pivot tables in the workbook.
 */
export function reconstructAllPivots(workbook: SVMWorkbook): PivotReconstructResult[] {
  const results: PivotReconstructResult[] = [];

  for (const [, sheet] of workbook.sheets) {
    for (const pivot of sheet.pivotTables) {
      const result = reconstructPivot(workbook, {
        pivotId: pivot.pivotId,
        forceRebuild: true,
      });
      results.push(result);
    }
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractSourceData(sheet: SVMSheet, _range: string): Array<Record<string, unknown>> {
  // Extract all data from the sheet as records
  const headers: string[] = [];
  const data: Array<Record<string, unknown>> = [];

  // Find header row (row 1)
  for (const [ref, cell] of sheet.cells) {
    const match = ref.match(/!([A-Z]+)1$/);
    if (match && cell.value.value !== null && cell.value.value !== '') {
      const colIndex = colLetterToNum(match[1]);
      headers[colIndex - 1] = `${cell.value.value}`;
    }
  }

  // Find max row
  let maxRow = 0;
  for (const [ref] of sheet.cells) {
    const rowMatch = ref.match(/(\d+)$/);
    if (rowMatch) {
      maxRow = Math.max(maxRow, parseInt(rowMatch[1], 10));
    }
  }

  // Extract data rows
  for (let r = 2; r <= maxRow; r++) {
    const record: Record<string, unknown> = {};
    let hasData = false;
    for (let c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      const colLetter = colNumToLetter(c + 1);
      const cellRef = `${sheet.name}!${colLetter}${r}`;
      const cell = sheet.cells.get(cellRef);
      if (cell && cell.value.value !== null) {
        record[headers[c]] = cell.value.value;
        hasData = true;
      }
    }
    if (hasData) data.push(record);
  }

  return data;
}

function applyPivotFilters(
  data: Array<Record<string, unknown>>,
  filterFields: string[]
): Array<Record<string, unknown>> {
  if (filterFields.length === 0) return data;
  // Filter out records with null values in filter fields
  return data.filter(record =>
    filterFields.every(field => record[field] !== null && record[field] !== undefined)
  );
}

function groupByFields(
  data: Array<Record<string, unknown>>,
  fields: string[]
): Map<string, Array<Record<string, unknown>>> {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const record of data) {
    const key = fields.map(f => `${record[f] ?? ''}`).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  }
  return groups;
}

function computeAggregation(
  rows: Array<Record<string, unknown>>,
  valueField: SVMPivotValueField
): number {
  const values = rows
    .map(r => r[valueField.field])
    .filter(v => v !== null && v !== undefined)
    .map(v => typeof v === 'number' ? v : parseFloat(`${v}`))
    .filter(v => !isNaN(v));

  switch (valueField.aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
    case 'average':
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'min':
      return values.length > 0 ? Math.min(...values) : 0;
    case 'max':
      return values.length > 0 ? Math.max(...values) : 0;
    case 'count_distinct':
      return new Set(values).size;
    case 'median': {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }
  }
}

function writePivotToSheet(
  workbook: SVMWorkbook,
  pivot: SVMPivotTable,
  data: SVMPivotData
): number {
  const targetSheet = workbook.sheets.get(pivot.targetSheet);
  if (!targetSheet) return 0;

  let cellsWritten = 0;
  const startRow = 1;

  // Write headers
  for (let c = 0; c < data.headers.length; c++) {
    const ref: CellRef = `${pivot.targetSheet}!${colNumToLetter(c + 1)}${startRow}`;
    targetSheet.cells.set(ref, {
      ref,
      sheetName: pivot.targetSheet,
      row: startRow,
      col: c + 1,
      value: {
        value: data.headers[c],
        type: 'string',
        formula: null,
        format: null,
        valueHash: hashStr(data.headers[c]),
      },
      style: null,
      merge: null,
      conditionalFormats: [],
    });
    cellsWritten++;
  }

  // Write data rows
  for (let r = 0; r < data.rows.length; r++) {
    const row = data.rows[r];
    for (let c = 0; c < data.headers.length; c++) {
      const field = data.headers[c];
      const value = row[field] ?? null;
      const rowNum = startRow + r + 1;
      const ref: CellRef = `${pivot.targetSheet}!${colNumToLetter(c + 1)}${rowNum}`;
      targetSheet.cells.set(ref, {
        ref,
        sheetName: pivot.targetSheet,
        row: rowNum,
        col: c + 1,
        value: {
          value,
          type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : value === null ? 'blank' : 'string',
          formula: null,
          format: null,
          valueHash: hashStr(JSON.stringify(value)),
        },
        style: null,
        merge: null,
        conditionalFormats: [],
      });
      cellsWritten++;
    }
  }

  // Write grand totals row
  if (Object.keys(data.grandTotals).length > 0) {
    const totalRow = startRow + data.rows.length + 1;
    for (let c = 0; c < data.headers.length; c++) {
      const field = data.headers[c];
      const value = data.grandTotals[field] ?? (c === 0 ? 'Grand Total' : null);
      const ref: CellRef = `${pivot.targetSheet}!${colNumToLetter(c + 1)}${totalRow}`;
      targetSheet.cells.set(ref, {
        ref,
        sheetName: pivot.targetSheet,
        row: totalRow,
        col: c + 1,
        value: {
          value,
          type: typeof value === 'number' ? 'number' : 'string',
          formula: null,
          format: null,
          valueHash: hashStr(JSON.stringify(value)),
        },
        style: null,
        merge: null,
        conditionalFormats: [],
      });
      cellsWritten++;
    }
  }

  return cellsWritten;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return `${a ?? ''}`.localeCompare(`${b ?? ''}`);
}

function colLetterToNum(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col;
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

function hashStr(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}
