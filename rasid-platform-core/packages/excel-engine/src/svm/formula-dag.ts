/**
 * Formula Dependency DAG — Deterministic construction & topological sort.
 * Namespace: rasid.excel.svm.formula_dag
 *
 * Builds a directed acyclic graph of formula dependencies,
 * detects circular references, and produces a deterministic
 * topological evaluation order.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  FormulaDAG,
  FormulaDAGNode,
  SVMSheet,
  SVMWorkbook,
} from './types';

// ─── Cell reference extraction from formulas ────────────────────────────────

const CELL_REF_PATTERN = /(?:(?:'([^']+)'|([A-Za-z_]\w*))!)?\$?([A-Z]{1,3})\$?(\d{1,7})(?::\$?([A-Z]{1,3})\$?(\d{1,7}))?/g;

const LET_PATTERN = /\bLET\s*\(/i;
const LAMBDA_PATTERN = /\bLAMBDA\s*\(/i;
const VOLATILE_FUNCTIONS = new Set([
  'NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'OFFSET', 'INDIRECT',
]);
const VOLATILE_PATTERN = new RegExp(`\\b(${[...VOLATILE_FUNCTIONS].join('|')})\\s*\\(`, 'i');

// Cross-sheet range pattern: Sheet1!A1:Sheet1!B2
const CROSS_SHEET_RANGE = /(?:(?:'([^']+)'|([A-Za-z_]\w*))!)?\$?([A-Z]{1,3})\$?(\d{1,7}):(?:(?:'[^']+'|[A-Za-z_]\w*)!)?\$?([A-Z]{1,3})\$?(\d{1,7})/gi;

export function extractCellReferences(formula: string, currentSheet: string): CellRef[] {
  const refs: CellRef[] = [];
  const clean = formula.startsWith('=') ? formula.slice(1) : formula;

  // First pass: extract cross-sheet ranges (Sheet1!B2:Sheet1!B6)
  let match: RegExpExecArray | null;
  const crossRegex = new RegExp(CROSS_SHEET_RANGE.source, 'gi');
  const processedRanges = new Set<string>();

  while ((match = crossRegex.exec(clean)) !== null) {
    const sheetName = match[1] || match[2] || currentSheet;
    const startCol = match[3].toUpperCase();
    const startRow = parseInt(match[4], 10);
    const endCol = match[5].toUpperCase();
    const endRow = parseInt(match[6], 10);

    // Expand range to individual cells
    const sc = colLetterToNumber(startCol);
    const ec = colLetterToNumber(endCol);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = sc; c <= ec; c++) {
        const ref = `${sheetName}!${colNumberToLetter(c)}${r}`;
        if (!refs.includes(ref)) refs.push(ref);
      }
    }
    processedRanges.add(match[0]);
  }

  // Second pass: extract single cell references not already covered by ranges
  const singleCellRegex = /(?:(?:'([^']+)'|([A-Za-z_]\w*))!)?\$?([A-Z]{1,3})\$?(\d{1,7})(?![:\dA-Z])/gi;
  while ((match = singleCellRegex.exec(clean)) !== null) {
    const sheetName = match[1] || match[2] || currentSheet;
    const col = match[3].toUpperCase();
    const row = match[4];
    const ref = `${sheetName}!${col}${row}`;
    if (!refs.includes(ref)) refs.push(ref);
  }

  return refs;
}

export function isVolatileFormula(formula: string): boolean {
  return VOLATILE_PATTERN.test(formula);
}

export function isLetFormula(formula: string): boolean {
  return LET_PATTERN.test(formula);
}

export function isLambdaFormula(formula: string): boolean {
  return LAMBDA_PATTERN.test(formula);
}

// ─── DAG Construction ───────────────────────────────────────────────────────

export function buildFormulaDAG(workbook: SVMWorkbook): FormulaDAG {
  const nodes = new Map<CellRef, FormulaDAGNode>();
  const volatileCells = new Set<CellRef>();
  const letCells = new Set<CellRef>();
  const lambdaCells = new Set<CellRef>();
  let edgeCount = 0;

  // Phase 1: Collect all formula cells and their dependencies
  for (const [sheetName, sheet] of workbook.sheets) {
    for (const [cellRef, cell] of sheet.cells) {
      if (!cell.value.formula) continue;

      const formula = cell.value.formula;
      const dependsOn = new Set(extractCellReferences(formula, sheetName));
      const isVol = isVolatileFormula(formula);
      const isL = isLetFormula(formula);
      const isLam = isLambdaFormula(formula);

      nodes.set(cellRef, {
        cellRef,
        formula,
        dependsOn,
        dependedBy: new Set(),
        lastComputedHash: cell.value.valueHash,
        evaluationOrder: -1,
        isVolatile: isVol,
        isLet: isL,
        isLambda: isLam,
      });

      if (isVol) volatileCells.add(cellRef);
      if (isL) letCells.add(cellRef);
      if (isLam) lambdaCells.add(cellRef);
      edgeCount += dependsOn.size;
    }
  }

  // Phase 2: Build reverse dependency edges (dependedBy)
  for (const [cellRef, node] of nodes) {
    for (const dep of node.dependsOn) {
      const depNode = nodes.get(dep);
      if (depNode) {
        depNode.dependedBy.add(cellRef);
      }
    }
  }

  // Phase 3: Topological sort (Kahn's algorithm for determinism)
  const circularRefs = detectCircularReferences(nodes);
  const topologicalOrder = topologicalSort(nodes);

  // Phase 4: Assign evaluation order
  for (let i = 0; i < topologicalOrder.length; i++) {
    const node = nodes.get(topologicalOrder[i]);
    if (node) {
      node.evaluationOrder = i;
    }
  }

  return {
    nodes,
    topologicalOrder,
    volatileCells,
    letCells,
    lambdaCells,
    circularRefs,
    buildTimestamp: new Date().toISOString(),
    nodeCount: nodes.size,
    edgeCount,
  };
}

// ─── Topological Sort (Kahn's Algorithm) ────────────────────────────────────

function topologicalSort(nodes: Map<CellRef, FormulaDAGNode>): CellRef[] {
  const inDegree = new Map<CellRef, number>();
  const result: CellRef[] = [];

  // Initialize in-degrees
  for (const [ref, node] of nodes) {
    let degree = 0;
    for (const dep of node.dependsOn) {
      if (nodes.has(dep)) degree++;
    }
    inDegree.set(ref, degree);
  }

  // Collect nodes with zero in-degree, sorted for determinism
  const queue: CellRef[] = [];
  for (const [ref, degree] of inDegree) {
    if (degree === 0) queue.push(ref);
  }
  queue.sort(); // Deterministic ordering

  while (queue.length > 0) {
    // Sort to maintain deterministic order at each step
    queue.sort();
    const current = queue.shift()!;
    result.push(current);

    const node = nodes.get(current);
    if (!node) continue;

    for (const dependent of [...node.dependedBy].sort()) {
      const deg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, deg);
      if (deg === 0) {
        queue.push(dependent);
      }
    }
  }

  return result;
}

// ─── Circular Reference Detection ──────────────────────────────────────────

function detectCircularReferences(nodes: Map<CellRef, FormulaDAGNode>): CellRef[][] {
  const visited = new Set<CellRef>();
  const inStack = new Set<CellRef>();
  const cycles: CellRef[][] = [];

  function dfs(ref: CellRef, path: CellRef[]): void {
    if (inStack.has(ref)) {
      const cycleStart = path.indexOf(ref);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(ref)) return;

    visited.add(ref);
    inStack.add(ref);
    path.push(ref);

    const node = nodes.get(ref);
    if (node) {
      for (const dep of [...node.dependsOn].sort()) {
        if (nodes.has(dep)) {
          dfs(dep, [...path]);
        }
      }
    }

    inStack.delete(ref);
  }

  for (const ref of [...nodes.keys()].sort()) {
    if (!visited.has(ref)) {
      dfs(ref, []);
    }
  }

  return cycles;
}

// ─── Incremental DAG Update ─────────────────────────────────────────────────

export function getAffectedCells(dag: FormulaDAG, changedCells: CellRef[]): CellRef[] {
  const affected = new Set<CellRef>();
  const queue = [...changedCells];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (affected.has(current)) continue;
    affected.add(current);

    const node = dag.nodes.get(current);
    if (node) {
      for (const dep of node.dependedBy) {
        if (!affected.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  // Return in topological order
  return dag.topologicalOrder.filter(ref => affected.has(ref));
}

// ─── DAG Hashing (for drift detection) ──────────────────────────────────────

export function hashFormulaDAG(dag: FormulaDAG): string {
  const parts: string[] = [];
  for (const ref of dag.topologicalOrder) {
    const node = dag.nodes.get(ref);
    if (node) {
      parts.push(`${ref}:${node.formula}:${node.lastComputedHash}`);
    }
  }
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function colLetterToNumber(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col;
}

function colNumberToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c > 0) {
    c--;
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26);
  }
  return result || 'A';
}
