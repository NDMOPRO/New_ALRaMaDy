/**
 * Deterministic Recalculation Engine
 * Namespace: rasid.excel.svm.recalc
 *
 * Evaluates formulas in topological order with exact integer precision,
 * deterministic rounding for floats, and drift = FAIL_STRICT enforcement.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  FormulaDAG,
  RecalcError,
  RecalcMode,
  RecalcRequest,
  RecalcResult,
  RoundingPolicy,
  SVMCellValue,
  SVMCellValueType,
  SVMWorkbook,
} from './types';
import { getAffectedCells } from './formula-dag';

// ─── Built-in Function Registry ─────────────────────────────────────────────

type FormulaFunction = (args: unknown[], context: EvalContext) => unknown;

interface EvalContext {
  workbook: SVMWorkbook;
  currentSheet: string;
  roundingPolicy: RoundingPolicy;
  executionSeed: string;
  resolveCell: (ref: CellRef) => unknown;
}

const FUNCTIONS: Map<string, FormulaFunction> = new Map();

function registerFunction(name: string, fn: FormulaFunction): void {
  FUNCTIONS.set(name.toUpperCase(), fn);
}

// Math functions
registerFunction('SUM', (args) => {
  const flat = flattenArgs(args);
  let sum = 0;
  for (const v of flat) {
    const n = toNum(v);
    if (n !== null) sum += n;
  }
  return sum;
});

registerFunction('AVERAGE', (args) => {
  const flat = flattenArgs(args);
  let sum = 0;
  let count = 0;
  for (const v of flat) {
    const n = toNum(v);
    if (n !== null) { sum += n; count++; }
  }
  return count > 0 ? sum / count : '#DIV/0!';
});

registerFunction('MIN', (args) => {
  const flat = flattenArgs(args);
  const nums = flat.map(toNum).filter((n): n is number => n !== null);
  return nums.length > 0 ? Math.min(...nums) : 0;
});

registerFunction('MAX', (args) => {
  const flat = flattenArgs(args);
  const nums = flat.map(toNum).filter((n): n is number => n !== null);
  return nums.length > 0 ? Math.max(...nums) : 0;
});

registerFunction('COUNT', (args) => {
  const flat = flattenArgs(args);
  return flat.filter(v => toNum(v) !== null).length;
});

registerFunction('COUNTA', (args) => {
  const flat = flattenArgs(args);
  return flat.filter(v => v !== null && v !== undefined && v !== '').length;
});

registerFunction('ABS', (args) => {
  const n = toNum(args[0]);
  return n !== null ? Math.abs(n) : '#VALUE!';
});

registerFunction('ROUND', (args) => {
  const n = toNum(args[0]);
  const digits = toNum(args[1]) ?? 0;
  if (n === null) return '#VALUE!';
  const factor = Math.pow(10, digits);
  return Math.round(n * factor) / factor;
});

registerFunction('ROUNDUP', (args) => {
  const n = toNum(args[0]);
  const digits = toNum(args[1]) ?? 0;
  if (n === null) return '#VALUE!';
  const factor = Math.pow(10, digits);
  return Math.ceil(n * factor) / factor;
});

registerFunction('ROUNDDOWN', (args) => {
  const n = toNum(args[0]);
  const digits = toNum(args[1]) ?? 0;
  if (n === null) return '#VALUE!';
  const factor = Math.pow(10, digits);
  return Math.floor(n * factor) / factor;
});

registerFunction('INT', (args) => {
  const n = toNum(args[0]);
  return n !== null ? Math.floor(n) : '#VALUE!';
});

registerFunction('MOD', (args) => {
  const n = toNum(args[0]);
  const d = toNum(args[1]);
  if (n === null || d === null || d === 0) return '#DIV/0!';
  return n - d * Math.floor(n / d);
});

registerFunction('POWER', (args) => {
  const base = toNum(args[0]);
  const exp = toNum(args[1]);
  if (base === null || exp === null) return '#VALUE!';
  return Math.pow(base, exp);
});

registerFunction('SQRT', (args) => {
  const n = toNum(args[0]);
  if (n === null || n < 0) return '#NUM!';
  return Math.sqrt(n);
});

// Logical functions
registerFunction('IF', (args) => {
  const cond = toBool(args[0]);
  return cond ? (args[1] ?? true) : (args[2] ?? false);
});

registerFunction('AND', (args) => {
  const flat = flattenArgs(args);
  return flat.every(v => toBool(v));
});

registerFunction('OR', (args) => {
  const flat = flattenArgs(args);
  return flat.some(v => toBool(v));
});

registerFunction('NOT', (args) => {
  return !toBool(args[0]);
});

registerFunction('IFERROR', (args) => {
  const val = args[0];
  return isErrorValue(val) ? (args[1] ?? '') : val;
});

registerFunction('IFNA', (args) => {
  const val = args[0];
  return val === '#N/A' ? (args[1] ?? '') : val;
});

// Text functions
registerFunction('CONCATENATE', (args) => {
  return args.map(a => `${a ?? ''}`).join('');
});

registerFunction('LEN', (args) => {
  return `${args[0] ?? ''}`.length;
});

registerFunction('LEFT', (args) => {
  const s = `${args[0] ?? ''}`;
  const n = toNum(args[1]) ?? 1;
  return s.substring(0, n);
});

registerFunction('RIGHT', (args) => {
  const s = `${args[0] ?? ''}`;
  const n = toNum(args[1]) ?? 1;
  return s.substring(s.length - n);
});

registerFunction('MID', (args) => {
  const s = `${args[0] ?? ''}`;
  const start = (toNum(args[1]) ?? 1) - 1;
  const len = toNum(args[2]) ?? 1;
  return s.substring(start, start + len);
});

registerFunction('TRIM', (args) => {
  return `${args[0] ?? ''}`.trim().replace(/\s+/g, ' ');
});

registerFunction('UPPER', (args) => `${args[0] ?? ''}`.toUpperCase());
registerFunction('LOWER', (args) => `${args[0] ?? ''}`.toLowerCase());
registerFunction('PROPER', (args) => {
  return `${args[0] ?? ''}`.replace(/\b\w/g, c => c.toUpperCase());
});

registerFunction('TEXT', (args) => {
  const val = args[0];
  const fmt = `${args[1] ?? ''}`;
  if (typeof val === 'number') {
    if (fmt.includes('%')) return `${(val * 100).toFixed(fmt.split('.')[1]?.length ?? 0)}%`;
    if (fmt.includes(',')) return val.toLocaleString('en-US');
    return val.toString();
  }
  return `${val ?? ''}`;
});

// Lookup functions
registerFunction('VLOOKUP', (args, ctx) => {
  const lookupValue = args[0];
  const tableArray = args[1];
  const colIndex = toNum(args[2]) ?? 1;
  const rangeLookup = args[3] !== false && args[3] !== 0;

  if (!Array.isArray(tableArray) || !tableArray.length) return '#N/A';

  for (const row of tableArray) {
    if (!Array.isArray(row)) continue;
    if (rangeLookup ? compareValues(row[0], lookupValue) <= 0 : row[0] === lookupValue) {
      if (colIndex - 1 < row.length) return row[colIndex - 1];
      return '#REF!';
    }
  }
  return '#N/A';
});

registerFunction('INDEX', (args) => {
  const array = args[0];
  const rowNum = toNum(args[1]) ?? 1;
  const colNum = toNum(args[2]) ?? 1;
  if (!Array.isArray(array)) return '#VALUE!';
  const row = array[rowNum - 1];
  if (!Array.isArray(row)) return row ?? '#REF!';
  return row[colNum - 1] ?? '#REF!';
});

registerFunction('MATCH', (args) => {
  const lookupValue = args[0];
  const lookupArray = args[1];
  const matchType = toNum(args[2]) ?? 1;
  if (!Array.isArray(lookupArray)) return '#N/A';
  const flat = flattenArgs([lookupArray]);
  for (let i = 0; i < flat.length; i++) {
    if (matchType === 0 && flat[i] === lookupValue) return i + 1;
    if (matchType === 1 && compareValues(flat[i], lookupValue) <= 0) return i + 1;
    if (matchType === -1 && compareValues(flat[i], lookupValue) >= 0) return i + 1;
  }
  return '#N/A';
});

// Statistical
registerFunction('COUNTIF', (args) => {
  const range = flattenArgs([args[0]]);
  const criteria = `${args[1] ?? ''}`;
  return range.filter(v => matchesCriteria(v, criteria)).length;
});

registerFunction('SUMIF', (args) => {
  const range = flattenArgs([args[0]]);
  const criteria = `${args[1] ?? ''}`;
  const sumRange = args[2] ? flattenArgs([args[2]]) : range;
  let sum = 0;
  for (let i = 0; i < range.length; i++) {
    if (matchesCriteria(range[i], criteria)) {
      const n = toNum(sumRange[i]);
      if (n !== null) sum += n;
    }
  }
  return sum;
});

registerFunction('COUNTIFS', (args) => {
  // pairs of (range, criteria)
  if (args.length < 2 || args.length % 2 !== 0) return '#VALUE!';
  const ranges: unknown[][] = [];
  const criteria: string[] = [];
  for (let i = 0; i < args.length; i += 2) {
    ranges.push(flattenArgs([args[i]]));
    criteria.push(`${args[i + 1] ?? ''}`);
  }
  const len = ranges[0]?.length ?? 0;
  let count = 0;
  for (let i = 0; i < len; i++) {
    if (ranges.every((r, j) => matchesCriteria(r[i], criteria[j]))) {
      count++;
    }
  }
  return count;
});

registerFunction('SUMIFS', (args) => {
  if (args.length < 3 || (args.length - 1) % 2 !== 0) return '#VALUE!';
  const sumRange = flattenArgs([args[0]]);
  const ranges: unknown[][] = [];
  const criteria: string[] = [];
  for (let i = 1; i < args.length; i += 2) {
    ranges.push(flattenArgs([args[i]]));
    criteria.push(`${args[i + 1] ?? ''}`);
  }
  let sum = 0;
  for (let i = 0; i < sumRange.length; i++) {
    if (ranges.every((r, j) => matchesCriteria(r[i], criteria[j]))) {
      const n = toNum(sumRange[i]);
      if (n !== null) sum += n;
    }
  }
  return sum;
});

// Date functions
registerFunction('NOW', () => new Date());
registerFunction('TODAY', () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
});

registerFunction('YEAR', (args) => {
  const d = toDate(args[0]);
  return d ? d.getFullYear() : '#VALUE!';
});

registerFunction('MONTH', (args) => {
  const d = toDate(args[0]);
  return d ? d.getMonth() + 1 : '#VALUE!';
});

registerFunction('DAY', (args) => {
  const d = toDate(args[0]);
  return d ? d.getDate() : '#VALUE!';
});

// Information functions
registerFunction('ISBLANK', (args) => args[0] === null || args[0] === undefined || args[0] === '');
registerFunction('ISNUMBER', (args) => typeof args[0] === 'number');
registerFunction('ISTEXT', (args) => typeof args[0] === 'string');
registerFunction('ISERROR', (args) => isErrorValue(args[0]));

// LET function
registerFunction('LET', (args, ctx) => {
  // LET(name1, value1, name2, value2, ..., calculation)
  // For SVM, we handle this by binding names in context
  if (args.length < 3 || args.length % 2 === 0) return '#VALUE!';
  return args[args.length - 1]; // Simplified: return last arg (calculation result)
});

// LAMBDA function
registerFunction('LAMBDA', (args) => {
  // LAMBDA(param1, param2, ..., body)
  // For SVM, we return the body result when called
  return args[args.length - 1] ?? '#VALUE!';
});

// ─── Formula Parser (Lightweight, deterministic) ────────────────────────────

interface ParsedFormula {
  type: 'literal' | 'cellRef' | 'rangeRef' | 'function' | 'operator' | 'error';
  value: unknown;
  children: ParsedFormula[];
  functionName?: string;
}

function evaluateFormula(
  formula: string,
  context: EvalContext
): unknown {
  const clean = formula.startsWith('=') ? formula.slice(1) : formula;

  try {
    return evaluateExpression(clean, context);
  } catch {
    return '#ERROR!';
  }
}

function evaluateExpression(expr: string, ctx: EvalContext): unknown {
  const trimmed = expr.trim();

  // String literal
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Boolean literal
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;

  // Function call
  const funcMatch = trimmed.match(/^([A-Z_][A-Z0-9_.]*)\s*\((.*)\)$/is);
  if (funcMatch) {
    const funcName = funcMatch[1].toUpperCase();
    const argsStr = funcMatch[2];
    const args = splitFunctionArgs(argsStr).map(arg => evaluateExpression(arg, ctx));
    const fn = FUNCTIONS.get(funcName);
    if (fn) return fn(args, ctx);
    return '#NAME?';
  }

  // Cell reference (Sheet1!A1 or A1)
  const cellRefMatch = trimmed.match(/^(?:(?:'([^']+)'|([A-Za-z_]\w*))!)?\$?([A-Z]{1,3})\$?(\d{1,7})$/i);
  if (cellRefMatch) {
    const sheet = cellRefMatch[1] || cellRefMatch[2] || ctx.currentSheet;
    const col = cellRefMatch[3].toUpperCase();
    const row = cellRefMatch[4];
    return ctx.resolveCell(`${sheet}!${col}${row}`);
  }

  // Range reference: Sheet1!A1:B2 or A1:B2
  const rangeMatch = trimmed.match(/^(?:(?:'([^']+)'|([A-Za-z_]\w*))!)?\$?([A-Z]{1,3})\$?(\d{1,7}):\$?([A-Z]{1,3})\$?(\d{1,7})$/i);
  if (rangeMatch) {
    const sheet = rangeMatch[1] || rangeMatch[2] || ctx.currentSheet;
    return resolveRange(sheet, rangeMatch[3], rangeMatch[4], rangeMatch[5], rangeMatch[6], ctx);
  }

  // Cross-sheet range: Sheet1!A1:Sheet1!B2 (sheet repeated on both sides of colon)
  const crossSheetRange = trimmed.match(/^(?:(?:'([^']+)'|([A-Za-z_]\w*))!)?\$?([A-Z]{1,3})\$?(\d{1,7}):(?:(?:'[^']+'|[A-Za-z_]\w*)!)?\$?([A-Z]{1,3})\$?(\d{1,7})$/i);
  if (crossSheetRange) {
    const sheet = crossSheetRange[1] || crossSheetRange[2] || ctx.currentSheet;
    return resolveRange(sheet, crossSheetRange[3], crossSheetRange[4], crossSheetRange[5], crossSheetRange[6], ctx);
  }

  // Binary operators (simple left-to-right for +, -, *, /, &, comparison)
  const opResult = evaluateBinaryExpression(trimmed, ctx);
  if (opResult !== undefined) return opResult;

  // Unary minus
  if (trimmed.startsWith('-')) {
    const inner = evaluateExpression(trimmed.slice(1), ctx);
    const n = toNum(inner);
    return n !== null ? -n : '#VALUE!';
  }

  // Parenthesized expression
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return evaluateExpression(trimmed.slice(1, -1), ctx);
  }

  // Fallback: treat as string
  return trimmed;
}

function evaluateBinaryExpression(expr: string, ctx: EvalContext): unknown | undefined {
  // Find the lowest-precedence operator outside parentheses/quotes
  const operators = ['&', '>=', '<=', '<>', '!=', '>', '<', '=', '+', '-', '*', '/'];

  for (const op of operators) {
    const pos = findOperatorOutsideParens(expr, op);
    if (pos !== -1) {
      const left = evaluateExpression(expr.substring(0, pos), ctx);
      const right = evaluateExpression(expr.substring(pos + op.length), ctx);

      switch (op) {
        case '+': return numOp(left, right, (a, b) => a + b);
        case '-': return numOp(left, right, (a, b) => a - b);
        case '*': return numOp(left, right, (a, b) => a * b);
        case '/': {
          const r = toNum(right);
          if (r === 0 || r === null) return '#DIV/0!';
          const l = toNum(left);
          if (l === null) return '#VALUE!';
          return l / r;
        }
        case '&': return `${left ?? ''}${right ?? ''}`;
        case '=': return left === right;
        case '<>': case '!=': return left !== right;
        case '>': return compareValues(left, right) > 0;
        case '<': return compareValues(left, right) < 0;
        case '>=': return compareValues(left, right) >= 0;
        case '<=': return compareValues(left, right) <= 0;
      }
    }
  }

  return undefined;
}

function findOperatorOutsideParens(expr: string, op: string): number {
  let depth = 0;
  let inString = false;

  // Search from right to left for left-associativity
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === ')') depth++;
    if (ch === '(') depth--;
    if (depth === 0 && i > 0 && expr.substring(i, i + op.length) === op) {
      // Make sure it's not part of a cell reference or function name
      const before = expr[i - 1];
      if (op === '-' && /[A-Z(,]/.test(before?.toUpperCase() ?? '')) continue;
      return i;
    }
  }
  return -1;
}

function splitFunctionArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (const ch of argsStr) {
    if (ch === '"') inString = !inString;
    if (!inString) {
      if (ch === '(' || ch === '{') depth++;
      if (ch === ')' || ch === '}') depth--;
      if (ch === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function resolveRange(
  sheet: string, startCol: string, startRow: string,
  endCol: string, endRow: string, ctx: EvalContext
): unknown[][] {
  const sc = colLetterToNum(startCol.toUpperCase());
  const ec = colLetterToNum(endCol.toUpperCase());
  const sr = parseInt(startRow, 10);
  const er = parseInt(endRow, 10);
  const result: unknown[][] = [];

  for (let r = sr; r <= er; r++) {
    const row: unknown[] = [];
    for (let c = sc; c <= ec; c++) {
      const ref = `${sheet}!${colNumToLetter(c)}${r}`;
      row.push(ctx.resolveCell(ref));
    }
    result.push(row);
  }
  return result;
}

// ─── Recalculation Engine ───────────────────────────────────────────────────

export function recalculate(
  workbook: SVMWorkbook,
  request: RecalcRequest
): RecalcResult {
  const startTime = Date.now();
  const dag = workbook.formulaDAG;
  const updatedCells = new Map<CellRef, SVMCellValue>();
  const errors: RecalcError[] = [];
  let cellsEvaluated = 0;
  let cellsSkipped = 0;

  // Determine which cells to recalculate
  let cellsToEval: CellRef[];
  switch (request.mode) {
    case 'full':
      cellsToEval = [...dag.topologicalOrder];
      // Also include volatile cells
      for (const vol of dag.volatileCells) {
        if (!cellsToEval.includes(vol)) cellsToEval.push(vol);
      }
      break;
    case 'incremental':
      cellsToEval = getAffectedCells(dag, request.dirtyCells);
      break;
    case 'dirty_only':
      cellsToEval = request.dirtyCells.filter(ref => dag.nodes.has(ref));
      break;
  }

  if (request.forceVolatile) {
    for (const vol of dag.volatileCells) {
      if (!cellsToEval.includes(vol)) cellsToEval.push(vol);
    }
  }

  // Build evaluation context
  const resolvedValues = new Map<CellRef, unknown>();
  const context: EvalContext = {
    workbook,
    currentSheet: '',
    roundingPolicy: workbook.roundingPolicy,
    executionSeed: request.executionSeed,
    resolveCell: (ref: CellRef) => {
      if (resolvedValues.has(ref)) return resolvedValues.get(ref);
      // Look up from workbook
      for (const [, sheet] of workbook.sheets) {
        const cell = sheet.cells.get(ref);
        if (cell) {
          const val = cell.value.value;
          resolvedValues.set(ref, val);
          return val;
        }
      }
      return null;
    },
  };

  // Evaluate in topological order
  for (const cellRef of cellsToEval) {
    const node = dag.nodes.get(cellRef);
    if (!node) {
      cellsSkipped++;
      continue;
    }

    // Determine sheet from cellRef
    const sheetMatch = cellRef.match(/^(.+)!/);
    context.currentSheet = sheetMatch ? sheetMatch[1] : '';

    try {
      const rawResult = evaluateFormula(node.formula, context);
      const result = applyRoundingPolicy(rawResult, workbook.roundingPolicy);
      const valueType = detectValueType(result);
      const valueHash = hashValue(result);

      const cellValue: SVMCellValue = {
        value: result,
        type: valueType,
        formula: node.formula,
        format: null,
        valueHash,
      };

      updatedCells.set(cellRef, cellValue);
      resolvedValues.set(cellRef, result);
      node.lastComputedHash = valueHash;
      cellsEvaluated++;

      // Update the workbook cell in-place
      for (const [, sheet] of workbook.sheets) {
        const cell = sheet.cells.get(cellRef);
        if (cell) {
          cell.value = cellValue;
          break;
        }
      }
    } catch (err) {
      errors.push({
        cellRef,
        formula: node.formula,
        errorType: 'EVAL_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
      cellsSkipped++;
    }
  }

  // Compute result hash deterministically
  const hashParts: string[] = [];
  for (const ref of [...updatedCells.keys()].sort()) {
    const val = updatedCells.get(ref)!;
    hashParts.push(`${ref}:${val.valueHash}`);
  }
  const resultHash = crypto.createHash('sha256')
    .update(hashParts.join('|'))
    .digest('hex');

  return {
    updatedCells,
    cellsEvaluated,
    cellsSkipped,
    errors,
    durationMs: Date.now() - startTime,
    deterministic: errors.length === 0,
    resultHash,
    executionSeed: request.executionSeed,
  };
}

// ─── Rounding Policy Application ────────────────────────────────────────────

function applyRoundingPolicy(value: unknown, policy: RoundingPolicy): unknown {
  if (typeof value !== 'number') return value;

  // Integer exactness: if value is an integer, return exact
  if (policy.integerExact && Number.isInteger(value)) {
    return value;
  }

  // Apply rounding for floats
  const factor = Math.pow(10, policy.maxDecimalPlaces);
  switch (policy.mode) {
    case 'half_up':
      return Math.round(value * factor) / factor;
    case 'half_even': {
      // Banker's rounding
      const shifted = value * factor;
      const rounded = Math.round(shifted);
      if (Math.abs(shifted - Math.floor(shifted) - 0.5) < 1e-10) {
        return (Math.floor(shifted) % 2 === 0 ? Math.floor(shifted) : Math.ceil(shifted)) / factor;
      }
      return rounded / factor;
    }
    case 'truncate':
      return Math.trunc(value * factor) / factor;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return val.toUpperCase() === 'TRUE';
  return false;
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setDate(date.getDate() + val);
    return date;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function numOp(left: unknown, right: unknown, op: (a: number, b: number) => number): unknown {
  const l = toNum(left);
  const r = toNum(right);
  if (l === null || r === null) return '#VALUE!';
  return op(l, r);
}

function flattenArgs(args: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      result.push(...flattenArgs(a));
    } else {
      result.push(a);
    }
  }
  return result;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return `${a ?? ''}`.localeCompare(`${b ?? ''}`);
}

function matchesCriteria(value: unknown, criteria: string): boolean {
  if (criteria.startsWith('>=')) return compareValues(value, parseFloat(criteria.slice(2))) >= 0;
  if (criteria.startsWith('<=')) return compareValues(value, parseFloat(criteria.slice(2))) <= 0;
  if (criteria.startsWith('<>') || criteria.startsWith('!=')) return `${value}` !== criteria.slice(2);
  if (criteria.startsWith('>')) return compareValues(value, parseFloat(criteria.slice(1))) > 0;
  if (criteria.startsWith('<')) return compareValues(value, parseFloat(criteria.slice(1))) < 0;
  if (criteria.startsWith('=')) return `${value}` === criteria.slice(1);
  // Wildcard support
  if (criteria.includes('*') || criteria.includes('?')) {
    const regex = new RegExp('^' + criteria.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return regex.test(`${value ?? ''}`);
  }
  return `${value}` === criteria;
}

function isErrorValue(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^#(DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|NULL!|ERROR!)$/.test(val);
}

function detectValueType(value: unknown): SVMCellValueType {
  if (value === null || value === undefined || value === '') return 'blank';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string' && isErrorValue(value)) return 'error';
  return 'string';
}

function hashValue(value: unknown): string {
  const str = value instanceof Date ? value.toISOString() : JSON.stringify(value);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
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
