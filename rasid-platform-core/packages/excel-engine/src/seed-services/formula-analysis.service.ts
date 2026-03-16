/**
 * Formula Analysis Service — Adapted from Seed
 *
 * Excel formula parsing, validation, dependency tracking,
 * and execution with Arabic function name support.
 *
 * Original: 05_excel_core/services/excel-service/src/services/formula-analysis.service.ts
 */

import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormulaParseResult {
  original: string;
  normalized: string;
  tokens: FormulaToken[];
  ast: FormulaAST;
  references: CellReference[];
  functions: FunctionCall[];
  isValid: boolean;
  errors: FormulaError[];
}

export interface FormulaToken {
  type: "function" | "operator" | "reference" | "literal" | "string" | "paren" | "separator" | "whitespace";
  value: string;
  position: number;
  length: number;
}

export interface FormulaAST {
  type: "expression" | "function" | "reference" | "literal" | "operator" | "error";
  value?: string;
  children?: FormulaAST[];
  dataType?: "number" | "string" | "boolean" | "date" | "error";
}

export interface CellReference {
  cell: string;
  sheet?: string;
  row: number;
  col: number;
  isAbsoluteRow: boolean;
  isAbsoluteCol: boolean;
  isRange: boolean;
  endRow?: number;
  endCol?: number;
}

export interface FunctionCall {
  name: string;
  arabicName?: string;
  argCount: number;
  category: string;
}

export interface FormulaError {
  code: string;
  message: string;
  position: number;
  suggestion?: string;
}

export interface DependencyGraph {
  cells: Map<string, Set<string>>;
  order: string[];
  hasCycle: boolean;
  cycleNodes: string[];
}

export interface FormulaEvalResult {
  value: unknown;
  type: "number" | "string" | "boolean" | "date" | "error";
  formatted: string;
  dependencies: string[];
}

// ---------------------------------------------------------------------------
// Arabic function mapping
// ---------------------------------------------------------------------------

const ARABIC_FUNCTIONS: Record<string, string> = {
  "مجموع": "SUM",
  "متوسط": "AVERAGE",
  "عدد": "COUNT",
  "أقصى": "MAX",
  "أدنى": "MIN",
  "إذا": "IF",
  "بحث": "VLOOKUP",
  "بحث_أفقي": "HLOOKUP",
  "فهرس": "INDEX",
  "مطابقة": "MATCH",
  "تقريب": "ROUND",
  "صحيح": "INT",
  "باقي": "MOD",
  "قوة": "POWER",
  "جذر": "SQRT",
  "مطلق": "ABS",
  "نص": "TEXT",
  "قيمة": "VALUE",
  "يسار": "LEFT",
  "يمين": "RIGHT",
  "وسط": "MID",
  "طول": "LEN",
  "دمج": "CONCATENATE",
  "بحث_نص": "FIND",
  "استبدال": "SUBSTITUTE",
  "اليوم": "TODAY",
  "الآن": "NOW",
  "سنة": "YEAR",
  "شهر": "MONTH",
  "يوم": "DAY",
  "عدد_إذا": "COUNTIF",
  "مجموع_إذا": "SUMIF",
  "متوسط_إذا": "AVERAGEIF",
  "عدد_إذا_متعدد": "COUNTIFS",
  "مجموع_إذا_متعدد": "SUMIFS",
  "و": "AND",
  "أو": "OR",
  "ليس": "NOT",
  "صحيح_منطقي": "TRUE",
  "خطأ_منطقي": "FALSE",
  "خطأ_إذا": "IFERROR",
  "فارغ": "ISBLANK",
  "رقم": "ISNUMBER",
  "نص_تحقق": "ISTEXT",
};

const FUNCTION_CATEGORIES: Record<string, string[]> = {
  "Math": ["SUM", "AVERAGE", "ROUND", "INT", "MOD", "POWER", "SQRT", "ABS", "MIN", "MAX"],
  "Lookup": ["VLOOKUP", "HLOOKUP", "INDEX", "MATCH"],
  "Text": ["TEXT", "VALUE", "LEFT", "RIGHT", "MID", "LEN", "CONCATENATE", "FIND", "SUBSTITUTE"],
  "Date": ["TODAY", "NOW", "YEAR", "MONTH", "DAY"],
  "Logical": ["IF", "AND", "OR", "NOT", "TRUE", "FALSE", "IFERROR", "ISBLANK", "ISNUMBER", "ISTEXT"],
  "Statistical": ["COUNT", "COUNTIF", "COUNTIFS", "SUMIF", "SUMIFS", "AVERAGEIF"],
};

const FUNCTION_TO_CATEGORY = new Map<string, string>();
for (const [cat, fns] of Object.entries(FUNCTION_CATEGORIES)) {
  for (const fn of fns) FUNCTION_TO_CATEGORY.set(fn, cat);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FormulaAnalysisService {

  /**
   * Parse a formula string into tokens, AST, and metadata.
   */
  parse(formula: string): FormulaParseResult {
    const normalized = this.normalizeFormula(formula);
    const tokens = this.tokenize(normalized);
    const errors: FormulaError[] = [];
    const references = this.extractReferences(tokens);
    const functions = this.extractFunctions(tokens);

    // Validate
    this.validateParentheses(tokens, errors);
    this.validateFunctions(functions, errors);

    const ast = this.buildAST(tokens);

    return {
      original: formula,
      normalized,
      tokens,
      ast,
      references,
      functions,
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build a dependency graph from multiple formulas.
   */
  buildDependencyGraph(formulas: Map<string, string>): DependencyGraph {
    const cells = new Map<string, Set<string>>();

    for (const [cell, formula] of formulas) {
      const parsed = this.parse(formula);
      const deps = new Set(parsed.references.map((r) => r.cell));
      cells.set(cell, deps);
    }

    // Topological sort
    const order: string[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycleNodes: string[] = [];
    let hasCycle = false;

    const visit = (node: string) => {
      if (inStack.has(node)) {
        hasCycle = true;
        cycleNodes.push(node);
        return;
      }
      if (visited.has(node)) return;

      inStack.add(node);
      const deps = cells.get(node);
      if (deps) {
        for (const dep of deps) visit(dep);
      }
      inStack.delete(node);
      visited.add(node);
      order.push(node);
    };

    for (const cell of cells.keys()) visit(cell);

    return { cells, order, hasCycle, cycleNodes };
  }

  /**
   * Evaluate a formula given cell values.
   */
  evaluate(formula: string, cellValues: Map<string, unknown>): FormulaEvalResult {
    const parsed = this.parse(formula);
    const dependencies = parsed.references.map((r) => r.cell);

    if (!parsed.isValid) {
      return {
        value: "#ERROR!",
        type: "error",
        formatted: "#ERROR!",
        dependencies,
      };
    }

    try {
      const value = this.evaluateAST(parsed.ast, cellValues);
      const type = this.inferType(value);
      return {
        value,
        type,
        formatted: this.formatValue(value, type),
        dependencies,
      };
    } catch (error) {
      return {
        value: "#ERROR!",
        type: "error",
        formatted: `#ERROR! ${error instanceof Error ? error.message : ""}`,
        dependencies,
      };
    }
  }

  /**
   * Translate Arabic formula to English.
   */
  translateArabicFormula(formula: string): string {
    let result = formula;
    for (const [arabic, english] of Object.entries(ARABIC_FUNCTIONS)) {
      result = result.replace(new RegExp(arabic, "g"), english);
    }
    // Replace Arabic semicolons with commas
    result = result.replace(/؛/g, ",");
    return result;
  }

  /**
   * Translate English formula to Arabic.
   */
  translateToArabic(formula: string): string {
    let result = formula;
    const reverseMap = Object.fromEntries(
      Object.entries(ARABIC_FUNCTIONS).map(([ar, en]) => [en, ar])
    );
    for (const [english, arabic] of Object.entries(reverseMap)) {
      result = result.replace(new RegExp(`\\b${english}\\b`, "gi"), arabic);
    }
    result = result.replace(/,/g, "؛");
    return result;
  }

  /**
   * Suggest formula completions.
   */
  suggest(partial: string): { name: string; arabicName: string; category: string; syntax: string }[] {
    const upper = partial.toUpperCase();
    const suggestions: { name: string; arabicName: string; category: string; syntax: string }[] = [];

    const reverseMap = Object.fromEntries(
      Object.entries(ARABIC_FUNCTIONS).map(([ar, en]) => [en, ar])
    );

    for (const [cat, fns] of Object.entries(FUNCTION_CATEGORIES)) {
      for (const fn of fns) {
        const arabicName = reverseMap[fn] || "";
        if (fn.startsWith(upper) || arabicName.includes(partial)) {
          suggestions.push({
            name: fn,
            arabicName,
            category: cat,
            syntax: this.getFunctionSyntax(fn),
          });
        }
      }
    }

    return suggestions.slice(0, 10);
  }

  // ─── Private methods ────────────────────────────────────────

  private normalizeFormula(formula: string): string {
    let f = formula.trim();
    if (f.startsWith("=")) f = f.slice(1);
    f = this.translateArabicFormula(f);
    return f;
  }

  private tokenize(formula: string): FormulaToken[] {
    const tokens: FormulaToken[] = [];
    let pos = 0;

    while (pos < formula.length) {
      const ch = formula[pos];

      // Whitespace
      if (/\s/.test(ch)) {
        const start = pos;
        while (pos < formula.length && /\s/.test(formula[pos])) pos++;
        tokens.push({ type: "whitespace", value: formula.slice(start, pos), position: start, length: pos - start });
        continue;
      }

      // String literal
      if (ch === '"') {
        const start = pos;
        pos++;
        while (pos < formula.length && formula[pos] !== '"') pos++;
        pos++;
        tokens.push({ type: "string", value: formula.slice(start, pos), position: start, length: pos - start });
        continue;
      }

      // Parentheses
      if (ch === "(" || ch === ")") {
        tokens.push({ type: "paren", value: ch, position: pos, length: 1 });
        pos++;
        continue;
      }

      // Separator
      if (ch === "," || ch === ";") {
        tokens.push({ type: "separator", value: ch, position: pos, length: 1 });
        pos++;
        continue;
      }

      // Operators
      if (/[+\-*\/^%<>=&]/.test(ch)) {
        let op = ch;
        if (pos + 1 < formula.length && (formula.slice(pos, pos + 2) === "<>" || formula.slice(pos, pos + 2) === "<=" || formula.slice(pos, pos + 2) === ">=")) {
          op = formula.slice(pos, pos + 2);
        }
        tokens.push({ type: "operator", value: op, position: pos, length: op.length });
        pos += op.length;
        continue;
      }

      // Number literal
      if (/[0-9.]/.test(ch)) {
        const start = pos;
        while (pos < formula.length && /[0-9.eE+\-]/.test(formula[pos])) pos++;
        tokens.push({ type: "literal", value: formula.slice(start, pos), position: start, length: pos - start });
        continue;
      }

      // Function or reference
      if (/[A-Za-z_$]/.test(ch)) {
        const start = pos;
        while (pos < formula.length && /[A-Za-z0-9_$:]/.test(formula[pos])) pos++;
        const value = formula.slice(start, pos);

        // Check if followed by ( → function
        if (pos < formula.length && formula[pos] === "(") {
          tokens.push({ type: "function", value: value.toUpperCase(), position: start, length: pos - start });
        } else if (/^[A-Z]+\d+$/i.test(value) || /^[A-Z]+\d+:[A-Z]+\d+$/i.test(value)) {
          tokens.push({ type: "reference", value: value.toUpperCase(), position: start, length: pos - start });
        } else {
          tokens.push({ type: "literal", value, position: start, length: pos - start });
        }
        continue;
      }

      // Skip unknown
      pos++;
    }

    return tokens;
  }

  private extractReferences(tokens: FormulaToken[]): CellReference[] {
    return tokens
      .filter((t) => t.type === "reference")
      .map((t) => this.parseCellReference(t.value));
  }

  private parseCellReference(ref: string): CellReference {
    const isRange = ref.includes(":");
    const parts = ref.split(":");
    const first = parts[0];

    const colMatch = first.match(/^\$?([A-Z]+)/i);
    const rowMatch = first.match(/\$?(\d+)$/);

    const col = colMatch ? this.colToIndex(colMatch[1]) : 0;
    const row = rowMatch ? parseInt(rowMatch[1]) : 0;

    const result: CellReference = {
      cell: ref,
      row,
      col,
      isAbsoluteRow: first.includes("$") && /\$\d/.test(first),
      isAbsoluteCol: first.startsWith("$"),
      isRange,
    };

    if (isRange && parts[1]) {
      const endColMatch = parts[1].match(/^\$?([A-Z]+)/i);
      const endRowMatch = parts[1].match(/\$?(\d+)$/);
      result.endCol = endColMatch ? this.colToIndex(endColMatch[1]) : col;
      result.endRow = endRowMatch ? parseInt(endRowMatch[1]) : row;
    }

    return result;
  }

  private colToIndex(col: string): number {
    let result = 0;
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 64);
    }
    return result;
  }

  private extractFunctions(tokens: FormulaToken[]): FunctionCall[] {
    const reverseMap = Object.fromEntries(
      Object.entries(ARABIC_FUNCTIONS).map(([ar, en]) => [en, ar])
    );

    return tokens
      .filter((t) => t.type === "function")
      .map((t) => ({
        name: t.value,
        arabicName: reverseMap[t.value],
        argCount: 0,
        category: FUNCTION_TO_CATEGORY.get(t.value) || "Other",
      }));
  }

  private validateParentheses(tokens: FormulaToken[], errors: FormulaError[]): void {
    let depth = 0;
    for (const token of tokens) {
      if (token.value === "(") depth++;
      else if (token.value === ")") depth--;
      if (depth < 0) {
        errors.push({ code: "UNMATCHED_PAREN", message: "Unmatched closing parenthesis", position: token.position });
        return;
      }
    }
    if (depth !== 0) {
      errors.push({ code: "UNMATCHED_PAREN", message: "Unmatched opening parenthesis", position: 0 });
    }
  }

  private validateFunctions(functions: FunctionCall[], errors: FormulaError[]): void {
    const allKnown = new Set([
      ...Object.values(ARABIC_FUNCTIONS),
      ...Object.values(FUNCTION_CATEGORIES).flat(),
    ]);

    for (const fn of functions) {
      if (!allKnown.has(fn.name)) {
        errors.push({
          code: "UNKNOWN_FUNCTION",
          message: `Unknown function: ${fn.name}`,
          position: 0,
          suggestion: `Did you mean one of: ${this.suggest(fn.name).map((s) => s.name).join(", ")}?`,
        });
      }
    }
  }

  private buildAST(tokens: FormulaToken[]): FormulaAST {
    const nonWhitespace = tokens.filter((t) => t.type !== "whitespace");
    if (nonWhitespace.length === 0) return { type: "literal", value: "" };
    if (nonWhitespace.length === 1) {
      const t = nonWhitespace[0];
      return { type: t.type === "reference" ? "reference" : "literal", value: t.value };
    }
    return { type: "expression", children: nonWhitespace.map((t) => ({ type: t.type as any, value: t.value })) };
  }

  private evaluateAST(ast: FormulaAST, cellValues: Map<string, unknown>): unknown {
    if (ast.type === "literal") {
      const n = Number(ast.value);
      return isNaN(n) ? ast.value : n;
    }
    if (ast.type === "reference") {
      return cellValues.get(ast.value || "") ?? 0;
    }
    return ast.value || 0;
  }

  private inferType(value: unknown): "number" | "string" | "boolean" | "date" | "error" {
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value instanceof Date) return "date";
    if (typeof value === "string" && value.startsWith("#")) return "error";
    return "string";
  }

  private formatValue(value: unknown, type: string): string {
    if (value === null || value === undefined) return "";
    if (type === "number") return Number(value).toLocaleString("ar-SA");
    return String(value);
  }

  private getFunctionSyntax(fn: string): string {
    const syntaxMap: Record<string, string> = {
      SUM: "SUM(number1, [number2], ...)",
      AVERAGE: "AVERAGE(number1, [number2], ...)",
      IF: "IF(condition, value_if_true, value_if_false)",
      VLOOKUP: "VLOOKUP(lookup_value, table_array, col_index, [range_lookup])",
      COUNT: "COUNT(value1, [value2], ...)",
      CONCATENATE: "CONCATENATE(text1, [text2], ...)",
      INDEX: "INDEX(array, row_num, [col_num])",
      MATCH: "MATCH(lookup_value, lookup_array, [match_type])",
    };
    return syntaxMap[fn] || `${fn}(...)`;
  }
}

export default FormulaAnalysisService;
