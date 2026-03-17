/**
 * Conversational Query module:
 *  - Transform natural-language queries into T-IR (Tabular Intermediate Representation) steps
 *  - Generate result tables
 *  - Generate optional charts
 *  - Produce textual explanations with confidence + lineage
 *
 * T-IR is a deterministic, auditable intermediate representation that
 * describes data transformations as a sequence of typed steps.
 */

type RowData = Record<string, unknown>;

export type TirStepKind =
  | "select_columns"
  | "filter_rows"
  | "group_by"
  | "aggregate"
  | "sort"
  | "limit"
  | "compute_column"
  | "join"
  | "pivot"
  | "unpivot"
  | "rename"
  | "deduplicate";

export type TirStep = {
  step_id: string;
  step_index: number;
  kind: TirStepKind;
  description: string;
  params: Record<string, unknown>;
  input_columns: string[];
  output_columns: string[];
};

export type TirPlan = {
  plan_id: string;
  query: string;
  normalized_query: string;
  steps: TirStep[];
  source_refs: string[];
  created_at: string;
};

export type ResultTable = {
  columns: string[];
  rows: RowData[];
  row_count: number;
  truncated: boolean;
  max_rows_returned: number;
};

export type ChartSpec = {
  chart_type: "bar" | "line" | "pie" | "scatter" | "area" | "heatmap" | "kpi_card";
  title: string;
  x_axis?: string;
  y_axis?: string;
  series: Array<{ field: string; label: string; aggregation?: string }>;
  dimension_field?: string;
};

export type QueryExplanation = {
  summary: string;
  confidence: number;
  confidence_rationale: string;
  lineage_refs: string[];
  assumptions: string[];
  caveats: string[];
};

export type ConversationalQueryResult = {
  query_id: string;
  original_query: string;
  tir_plan: TirPlan;
  result_table: ResultTable;
  chart?: ChartSpec;
  explanation: QueryExplanation;
  executed_at: string;
};

let queryCounter = 0;
const nextQueryId = (): string => `cq-${++queryCounter}-${Date.now()}`;
const nextStepId = (planId: string, idx: number): string => `${planId}-step-${idx}`;

/**
 * Parse a natural-language query into T-IR steps.
 * This is a deterministic, rule-based parser for common query patterns.
 * It does NOT invent data or fabricate results.
 */
const parseQueryToTir = (query: string, columns: string[], planId: string): TirStep[] => {
  const steps: TirStep[] = [];
  const q = query.toLowerCase().trim();
  let stepIdx = 0;

  // Detect column references in the query
  const referencedColumns = columns.filter((col) =>
    q.includes(col.toLowerCase()) || q.includes(col.toLowerCase().replace(/_/g, " "))
  );

  // Detect numeric columns from names (will be refined during execution)
  const numericKeywords = ["total", "sum", "average", "avg", "count", "max", "min", "mean", "median"];
  const hasAggregation = numericKeywords.some((kw) => q.includes(kw));
  const groupByKeywords = ["by", "per", "for each", "grouped by", "حسب", "لكل"];
  const hasGroupBy = groupByKeywords.some((kw) => q.includes(kw));
  const filterKeywords = ["where", "filter", "only", "حيث", "فقط", "أكبر", "أصغر", "greater", "less", "equal", "between"];
  const hasFilter = filterKeywords.some((kw) => q.includes(kw));
  const sortKeywords = ["sort", "order", "top", "bottom", "highest", "lowest", "ترتيب", "أعلى", "أدنى"];
  const hasSort = sortKeywords.some((kw) => q.includes(kw));
  const limitKeywords = ["top", "first", "last", "limit", "أول", "آخر"];
  const hasLimit = limitKeywords.some((kw) => q.includes(kw));

  // Step 1: Select columns
  const selectedCols = referencedColumns.length > 0 ? referencedColumns : columns.slice(0, 10);
  steps.push({
    step_id: nextStepId(planId, stepIdx++),
    step_index: stepIdx,
    kind: "select_columns",
    description: `Select columns: ${selectedCols.join(", ")}`,
    params: { columns: selectedCols },
    input_columns: columns,
    output_columns: selectedCols
  });

  // Step 2: Filter (if detected)
  if (hasFilter) {
    const filterColumn = referencedColumns[0] ?? columns[0] ?? "unknown";
    steps.push({
      step_id: nextStepId(planId, stepIdx++),
      step_index: stepIdx,
      kind: "filter_rows",
      description: `Apply filter conditions from query on "${filterColumn}".`,
      params: { column: filterColumn, condition: "extracted_from_query", raw_query: query },
      input_columns: selectedCols,
      output_columns: selectedCols
    });
  }

  // Step 3: Group by (if detected)
  if (hasGroupBy) {
    const groupCol = referencedColumns.find((c) => {
      const idx = q.indexOf(c.toLowerCase());
      const byIdx = Math.max(q.indexOf("by"), q.indexOf("per"), q.indexOf("حسب"), q.indexOf("لكل"));
      return byIdx >= 0 && idx > byIdx;
    }) ?? referencedColumns[referencedColumns.length - 1] ?? columns[0] ?? "unknown";

    steps.push({
      step_id: nextStepId(planId, stepIdx++),
      step_index: stepIdx,
      kind: "group_by",
      description: `Group by "${groupCol}".`,
      params: { group_columns: [groupCol] },
      input_columns: selectedCols,
      output_columns: selectedCols
    });
  }

  // Step 4: Aggregate (if detected)
  if (hasAggregation) {
    const aggType = q.includes("count") ? "count"
      : q.includes("avg") || q.includes("average") || q.includes("mean") ? "avg"
      : q.includes("max") || q.includes("highest") ? "max"
      : q.includes("min") || q.includes("lowest") ? "min"
      : "sum";

    const aggCol = referencedColumns[0] ?? columns[0] ?? "unknown";
    const outputCol = `${aggType}_${aggCol}`;

    steps.push({
      step_id: nextStepId(planId, stepIdx++),
      step_index: stepIdx,
      kind: "aggregate",
      description: `Compute ${aggType.toUpperCase()}(${aggCol}).`,
      params: { aggregation: aggType, column: aggCol, output_column: outputCol },
      input_columns: selectedCols,
      output_columns: [...selectedCols, outputCol]
    });
  }

  // Step 5: Sort (if detected)
  if (hasSort) {
    const sortCol = referencedColumns[0] ?? columns[0] ?? "unknown";
    const descending = q.includes("top") || q.includes("highest") || q.includes("أعلى") || q.includes("desc");
    steps.push({
      step_id: nextStepId(planId, stepIdx++),
      step_index: stepIdx,
      kind: "sort",
      description: `Sort by "${sortCol}" ${descending ? "descending" : "ascending"}.`,
      params: { column: sortCol, direction: descending ? "desc" : "asc" },
      input_columns: selectedCols,
      output_columns: selectedCols
    });
  }

  // Step 6: Limit (if detected)
  if (hasLimit) {
    const limitMatch = q.match(/(?:top|first|last|limit)\s*(\d+)/);
    const limitN = limitMatch ? parseInt(limitMatch[1]!, 10) : 10;
    steps.push({
      step_id: nextStepId(planId, stepIdx++),
      step_index: stepIdx,
      kind: "limit",
      description: `Limit to ${limitN} rows.`,
      params: { limit: limitN },
      input_columns: selectedCols,
      output_columns: selectedCols
    });
  }

  return steps;
};

/**
 * Execute T-IR steps against actual data. Operates only on real platform data.
 */
const executeTirPlan = (steps: TirStep[], rows: RowData[], maxRows = 1000): ResultTable => {
  let currentRows = [...rows];
  let currentColumns: string[] = steps[0]?.input_columns ?? Object.keys(rows[0] ?? {});

  for (const step of steps) {
    switch (step.kind) {
      case "select_columns": {
        const cols = (step.params["columns"] as string[]) ?? currentColumns;
        currentRows = currentRows.map((r) => {
          const filtered: RowData = {};
          for (const c of cols) {
            if (c in r) filtered[c] = r[c];
          }
          return filtered;
        });
        currentColumns = cols.filter((c) => rows.length === 0 || c in (rows[0] ?? {}));
        break;
      }
      case "filter_rows": {
        const col = step.params["column"] as string;
        const condition = step.params["condition"] as string;
        if (condition === "extracted_from_query" && col && currentRows.length > 0) {
          // Keep all rows when condition is ambiguous - do not invent filters
          // This preserves data integrity
        }
        break;
      }
      case "group_by": {
        const groupCols = (step.params["group_columns"] as string[]) ?? [];
        if (groupCols.length > 0) {
          const groups = new Map<string, RowData[]>();
          for (const row of currentRows) {
            const key = groupCols.map((c) => String(row[c] ?? "")).join("||");
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(row);
          }
          currentRows = [...groups.entries()].map(([, groupRows]) => {
            const representative = { ...groupRows[0]! };
            representative["_group_count"] = groupRows.length;
            return representative;
          });
        }
        break;
      }
      case "aggregate": {
        const aggType = step.params["aggregation"] as string;
        const aggCol = step.params["column"] as string;
        const outputCol = (step.params["output_column"] as string) ?? `${aggType}_${aggCol}`;
        for (const row of currentRows) {
          const val = Number(row[aggCol]);
          if (!Number.isNaN(val)) {
            row[outputCol] = val;
          }
        }
        if (aggType === "sum") {
          const total = currentRows.reduce((s, r) => s + Number(r[aggCol] ?? 0), 0);
          if (currentRows.length > 0) {
            currentRows[0]![outputCol] = Math.round(total * 100) / 100;
          }
        } else if (aggType === "count") {
          if (currentRows.length > 0) {
            currentRows[0]![outputCol] = currentRows.length;
          }
        } else if (aggType === "avg") {
          const vals = currentRows.map((r) => Number(r[aggCol])).filter((v) => !Number.isNaN(v));
          const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          if (currentRows.length > 0) {
            currentRows[0]![outputCol] = Math.round(avg * 100) / 100;
          }
        } else if (aggType === "max") {
          const vals = currentRows.map((r) => Number(r[aggCol])).filter((v) => !Number.isNaN(v));
          if (vals.length > 0 && currentRows.length > 0) {
            currentRows[0]![outputCol] = Math.max(...vals);
          }
        } else if (aggType === "min") {
          const vals = currentRows.map((r) => Number(r[aggCol])).filter((v) => !Number.isNaN(v));
          if (vals.length > 0 && currentRows.length > 0) {
            currentRows[0]![outputCol] = Math.min(...vals);
          }
        }
        if (!currentColumns.includes(outputCol)) {
          currentColumns.push(outputCol);
        }
        break;
      }
      case "sort": {
        const sortCol = step.params["column"] as string;
        const dir = step.params["direction"] as string;
        currentRows.sort((a, b) => {
          const va = a[sortCol];
          const vb = b[sortCol];
          const na = Number(va);
          const nb = Number(vb);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) {
            return dir === "desc" ? nb - na : na - nb;
          }
          return dir === "desc" ? String(vb ?? "").localeCompare(String(va ?? "")) : String(va ?? "").localeCompare(String(vb ?? ""));
        });
        break;
      }
      case "limit": {
        const lim = (step.params["limit"] as number) ?? maxRows;
        currentRows = currentRows.slice(0, lim);
        break;
      }
      case "deduplicate": {
        const seen = new Set<string>();
        currentRows = currentRows.filter((r) => {
          const key = JSON.stringify(r);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        break;
      }
      default:
        break;
    }
  }

  const truncated = currentRows.length > maxRows;
  const finalRows = currentRows.slice(0, maxRows);
  const finalColumns = finalRows.length > 0 ? Object.keys(finalRows[0]!) : currentColumns;

  return {
    columns: finalColumns,
    rows: finalRows,
    row_count: finalRows.length,
    truncated,
    max_rows_returned: maxRows
  };
};

/**
 * Suggest a chart type based on the query and result structure.
 */
const suggestChart = (query: string, resultTable: ResultTable, columns: string[]): ChartSpec | undefined => {
  const q = query.toLowerCase();
  const numericCols = resultTable.columns.filter((col) =>
    resultTable.rows.some((r) => typeof r[col] === "number" || (typeof r[col] === "string" && !Number.isNaN(Number(r[col]))))
  );
  const categoricalCols = resultTable.columns.filter((c) => !numericCols.includes(c));

  if (resultTable.rows.length === 0) return undefined;

  // Single aggregate → KPI card
  if (resultTable.rows.length === 1 && numericCols.length >= 1) {
    return {
      chart_type: "kpi_card",
      title: `${numericCols[0]}`,
      series: numericCols.map((f) => ({ field: f, label: f }))
    };
  }

  // Time series → line chart
  const timeCol = resultTable.columns.find((c) => /date|time|year|month|quarter|تاريخ|سنة|شهر/i.test(c));
  if (timeCol && numericCols.length > 0) {
    return {
      chart_type: "line",
      title: `${numericCols[0]} over ${timeCol}`,
      x_axis: timeCol,
      y_axis: numericCols[0],
      series: numericCols.slice(0, 3).map((f) => ({ field: f, label: f })),
      dimension_field: timeCol
    };
  }

  // Distribution → pie (few categories)
  if (categoricalCols.length > 0 && numericCols.length > 0 && resultTable.rows.length <= 10) {
    if (q.includes("distribution") || q.includes("share") || q.includes("proportion") || q.includes("نسبة") || q.includes("توزيع")) {
      return {
        chart_type: "pie",
        title: `${numericCols[0]} distribution by ${categoricalCols[0]}`,
        series: [{ field: numericCols[0]!, label: numericCols[0]! }],
        dimension_field: categoricalCols[0]
      };
    }
  }

  // Default → bar chart
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    return {
      chart_type: "bar",
      title: `${numericCols[0]} by ${categoricalCols[0]}`,
      x_axis: categoricalCols[0],
      y_axis: numericCols[0],
      series: numericCols.slice(0, 3).map((f) => ({ field: f, label: f })),
      dimension_field: categoricalCols[0]
    };
  }

  // Scatter for two numeric columns
  if (numericCols.length >= 2) {
    return {
      chart_type: "scatter",
      title: `${numericCols[0]} vs ${numericCols[1]}`,
      x_axis: numericCols[0],
      y_axis: numericCols[1],
      series: [{ field: numericCols[1]!, label: numericCols[1]! }]
    };
  }

  return undefined;
};

export class ConversationalQueryEngine {
  /**
   * Process a natural-language query against real data.
   * Returns T-IR plan, executed result table, optional chart, and explanation.
   * Must NOT invent data or fabricate results.
   */
  executeQuery(params: {
    query: string;
    file_ref: string;
    columns: string[];
    rows: RowData[];
    source_refs?: string[];
    max_rows?: number;
  }): ConversationalQueryResult {
    const queryId = nextQueryId();
    const planId = `tir-plan-${queryId}`;
    const normalizedQuery = params.query.trim().replace(/\s+/g, " ").toLowerCase();

    // Step 1: Parse query into T-IR steps
    const steps = parseQueryToTir(params.query, params.columns, planId);

    const tirPlan: TirPlan = {
      plan_id: planId,
      query: params.query,
      normalized_query: normalizedQuery,
      steps,
      source_refs: params.source_refs ?? [params.file_ref],
      created_at: new Date().toISOString()
    };

    // Step 2: Execute T-IR plan against real data
    const resultTable = executeTirPlan(steps, params.rows, params.max_rows ?? 1000);

    // Step 3: Suggest chart
    const chart = suggestChart(params.query, resultTable, params.columns);

    // Step 4: Build explanation with confidence and lineage
    const confidence = this.computeConfidence(steps, params.columns, params.rows, resultTable);
    const explanation = this.buildExplanation(params.query, steps, resultTable, confidence, params.source_refs ?? [params.file_ref]);

    return {
      query_id: queryId,
      original_query: params.query,
      tir_plan: tirPlan,
      result_table: resultTable,
      chart,
      explanation,
      executed_at: new Date().toISOString()
    };
  }

  private computeConfidence(steps: TirStep[], columns: string[], rows: RowData[], result: ResultTable): number {
    let confidence = 0.5;

    // Boost if we matched actual columns
    const matchedCols = steps.flatMap((s) => s.output_columns).filter((c) => columns.includes(c));
    if (matchedCols.length > 0) confidence += 0.15;

    // Boost if result has data
    if (result.row_count > 0) confidence += 0.1;

    // Boost if multiple T-IR steps (more structured query)
    if (steps.length > 2) confidence += 0.1;

    // Penalize if no columns matched
    if (matchedCols.length === 0) confidence -= 0.2;

    // Penalize if result is empty but source had data
    if (result.row_count === 0 && rows.length > 0) confidence -= 0.15;

    return Math.round(Math.min(0.95, Math.max(0.1, confidence)) * 100) / 100;
  }

  private buildExplanation(
    query: string,
    steps: TirStep[],
    result: ResultTable,
    confidence: number,
    sourceRefs: string[]
  ): QueryExplanation {
    const stepSummaries = steps.map((s) => s.description);
    const assumptions: string[] = [];
    const caveats: string[] = [];

    // Check for ambiguity
    if (steps.some((s) => s.kind === "filter_rows" && s.params["condition"] === "extracted_from_query")) {
      assumptions.push("Filter condition was inferred from query text; no rows were excluded to preserve data integrity.");
    }

    if (result.truncated) {
      caveats.push(`Result was truncated to ${result.max_rows_returned} rows.`);
    }

    if (result.row_count === 0) {
      caveats.push("Query returned zero rows. Verify filter conditions or data availability.");
    }

    if (confidence < 0.5) {
      caveats.push("Low confidence: the query may not have matched specific columns in the dataset.");
    }

    const confidenceRationale = confidence >= 0.8
      ? "High confidence: query matched specific columns and produced structured results."
      : confidence >= 0.6
        ? "Moderate confidence: some query elements matched but interpretation may be partial."
        : "Low confidence: query terms did not clearly map to dataset columns.";

    return {
      summary: `Executed ${steps.length} T-IR step(s): ${stepSummaries.join(" → ")}. Result: ${result.row_count} row(s).`,
      confidence,
      confidence_rationale: confidenceRationale,
      lineage_refs: sourceRefs,
      assumptions,
      caveats
    };
  }
}
