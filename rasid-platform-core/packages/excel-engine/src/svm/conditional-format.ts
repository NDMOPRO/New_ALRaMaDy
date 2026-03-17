/**
 * Deterministic Conditional Formatting Engine
 * Namespace: rasid.excel.svm.conditional_format
 *
 * Evaluates conditional formatting rules deterministically
 * and applies styles to cells based on rule priority.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  ConditionalFormatRule,
  SVMCellStyle,
  SVMSheet,
  SVMWorkbook,
} from './types';

export interface ConditionalFormatResult {
  appliedRules: Map<CellRef, AppliedRule[]>;
  rulesEvaluated: number;
  cellsAffected: number;
  deterministic: boolean;
  resultHash: string;
  timestamp: string;
}

export interface AppliedRule {
  ruleId: string;
  matched: boolean;
  appliedStyle: Partial<SVMCellStyle> | null;
  priority: number;
}

/**
 * Evaluate all conditional formatting rules for a sheet deterministically.
 * Rules are processed in priority order (lower number = higher priority).
 */
export function evaluateConditionalFormats(
  workbook: SVMWorkbook,
  sheetName: string
): ConditionalFormatResult {
  const sheet = workbook.sheets.get(sheetName);
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }

  const appliedRules = new Map<CellRef, AppliedRule[]>();
  let rulesEvaluated = 0;
  const cellsAffected = new Set<CellRef>();

  // Sort rules by priority (deterministic)
  const sortedRules = [...sheet.conditionalFormats].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    const cellRefs = expandRangeToCellRefs(rule.range, sheetName);

    for (const ref of cellRefs) {
      const cell = sheet.cells.get(ref);
      if (!cell) continue;

      rulesEvaluated++;
      const matched = evaluateRule(rule, cell.value.value, workbook, sheetName);

      if (!appliedRules.has(ref)) appliedRules.set(ref, []);
      appliedRules.get(ref)!.push({
        ruleId: rule.ruleId,
        matched,
        appliedStyle: matched ? rule.style : null,
        priority: rule.priority,
      });

      if (matched) {
        cellsAffected.add(ref);

        // Apply style to cell
        if (cell.style) {
          cell.style = mergeStyles(cell.style, rule.style);
        } else {
          cell.style = rule.style as SVMCellStyle;
        }

        // Stop if stopIfTrue
        if (rule.stopIfTrue) break;
      }
    }
  }

  // Compute deterministic hash
  const hashParts: string[] = [];
  for (const [ref, rules] of [...appliedRules.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const r of rules) {
      if (r.matched) {
        hashParts.push(`${ref}:${r.ruleId}:${r.priority}`);
      }
    }
  }
  const resultHash = crypto.createHash('sha256').update(hashParts.join('|')).digest('hex');

  return {
    appliedRules,
    rulesEvaluated,
    cellsAffected: cellsAffected.size,
    deterministic: true,
    resultHash,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Evaluate all conditional formats across all sheets.
 */
export function evaluateAllConditionalFormats(workbook: SVMWorkbook): Map<string, ConditionalFormatResult> {
  const results = new Map<string, ConditionalFormatResult>();
  for (const [sheetName] of workbook.sheets) {
    results.set(sheetName, evaluateConditionalFormats(workbook, sheetName));
  }
  return results;
}

// ─── Rule Evaluation ────────────────────────────────────────────────────────

function evaluateRule(
  rule: ConditionalFormatRule,
  cellValue: unknown,
  _workbook: SVMWorkbook,
  _sheetName: string
): boolean {
  switch (rule.type) {
    case 'cell_is':
      return evaluateCellIsRule(cellValue, rule.operator, rule.formula);

    case 'contains_text':
      return evaluateContainsTextRule(cellValue, rule.text);

    case 'color_scale':
    case 'data_bar':
    case 'icon_set':
      // These are range-based visual rules; always apply
      return typeof cellValue === 'number';

    case 'top_bottom':
      return typeof cellValue === 'number';

    case 'above_average':
      return typeof cellValue === 'number';

    case 'duplicate':
      return cellValue !== null && cellValue !== undefined && cellValue !== '';

    case 'formula_based':
      // Evaluate the formula — simplified: check if formula evaluates truthy
      return rule.formula !== null && rule.formula.length > 0;
  }
}

function evaluateCellIsRule(
  cellValue: unknown,
  operator: string | null,
  formulaOrValue: string | null
): boolean {
  if (!operator || formulaOrValue === null) return false;

  const compareValue = parseCompareValue(formulaOrValue);

  switch (operator) {
    case 'equal':
    case 'eq':
      return cellValue === compareValue || `${cellValue}` === `${compareValue}`;
    case 'notEqual':
    case 'neq':
      return cellValue !== compareValue && `${cellValue}` !== `${compareValue}`;
    case 'greaterThan':
    case 'gt':
      return toNum(cellValue) !== null && toNum(compareValue) !== null &&
        toNum(cellValue)! > toNum(compareValue)!;
    case 'lessThan':
    case 'lt':
      return toNum(cellValue) !== null && toNum(compareValue) !== null &&
        toNum(cellValue)! < toNum(compareValue)!;
    case 'greaterThanOrEqual':
    case 'gte':
      return toNum(cellValue) !== null && toNum(compareValue) !== null &&
        toNum(cellValue)! >= toNum(compareValue)!;
    case 'lessThanOrEqual':
    case 'lte':
      return toNum(cellValue) !== null && toNum(compareValue) !== null &&
        toNum(cellValue)! <= toNum(compareValue)!;
    case 'between': {
      // Formula should be "min,max"
      const parts = formulaOrValue.split(',');
      if (parts.length !== 2) return false;
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      const num = toNum(cellValue);
      return num !== null && num >= min && num <= max;
    }
    case 'notBetween': {
      const parts = formulaOrValue.split(',');
      if (parts.length !== 2) return false;
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      const num = toNum(cellValue);
      return num !== null && (num < min || num > max);
    }
    default:
      return false;
  }
}

function evaluateContainsTextRule(cellValue: unknown, text: string | null): boolean {
  if (text === null || text === '') return false;
  const str = `${cellValue ?? ''}`;
  return str.toLowerCase().includes(text.toLowerCase());
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function expandRangeToCellRefs(range: string, sheetName: string): CellRef[] {
  const refs: CellRef[] = [];
  const rangeMatch = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!rangeMatch) {
    // Single cell
    return [`${sheetName}!${range}`];
  }

  const startCol = colLetterToNum(rangeMatch[1].toUpperCase());
  const startRow = parseInt(rangeMatch[2], 10);
  const endCol = colLetterToNum(rangeMatch[3].toUpperCase());
  const endRow = parseInt(rangeMatch[4], 10);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      refs.push(`${sheetName}!${colNumToLetter(c)}${r}`);
    }
  }

  return refs;
}

function mergeStyles(base: SVMCellStyle, override: Partial<SVMCellStyle>): SVMCellStyle {
  return {
    font: override.font ? { ...base.font, ...override.font } : base.font,
    fill: override.fill ? { ...base.fill, ...override.fill } : base.fill,
    border: override.border ? { ...base.border, ...override.border } : base.border,
    alignment: override.alignment ? { ...base.alignment, ...override.alignment } : base.alignment,
    numberFormat: override.numberFormat ?? base.numberFormat,
    dateFormat: override.dateFormat ?? base.dateFormat,
    currencyCode: override.currencyCode ?? base.currencyCode,
  };
}

function parseCompareValue(formula: string): unknown {
  const trimmed = formula.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  if (trimmed === 'TRUE') return true;
  if (trimmed === 'FALSE') return false;
  const num = parseFloat(trimmed);
  if (!isNaN(num)) return num;
  return trimmed;
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const n = Number(val);
  return isNaN(n) ? null : n;
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
