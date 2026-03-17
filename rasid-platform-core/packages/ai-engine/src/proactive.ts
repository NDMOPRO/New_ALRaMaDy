/**
 * Proactive AI module:
 *  - suggest joins between datasets
 *  - suggest data cleaning operations
 *  - suggest KPIs
 *  - suggest comparisons
 *  - warn about data issues
 */

type RowData = Record<string, unknown>;

export type JoinSuggestion = {
  suggestion_id: string;
  left_file_ref: string;
  right_file_ref: string;
  left_column: string;
  right_column: string;
  join_type: "inner" | "left" | "right" | "full";
  confidence: number;
  rationale: string;
};

export type CleaningSuggestion = {
  suggestion_id: string;
  file_ref: string;
  column: string;
  issue_type: "missing_values" | "duplicates" | "outliers" | "inconsistent_format" | "whitespace" | "mixed_types" | "encoding";
  severity: "low" | "medium" | "high" | "critical";
  affected_count: number;
  affected_pct: number;
  recommended_action: string;
  rationale: string;
};

export type KpiSuggestion = {
  suggestion_id: string;
  file_ref: string;
  kpi_name: string;
  formula: string;
  columns_involved: string[];
  business_context: string;
  confidence: number;
};

export type ComparisonSuggestion = {
  suggestion_id: string;
  file_ref: string;
  comparison_type: "time_period" | "category" | "benchmark" | "yoy" | "mom" | "target_vs_actual";
  dimension_column: string;
  metric_column: string;
  description: string;
  confidence: number;
};

export type DataWarning = {
  warning_id: string;
  file_ref: string;
  warning_type: "data_quality" | "schema_issue" | "volume_concern" | "consistency" | "freshness" | "bias_risk";
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  affected_columns: string[];
  recommended_fix: string;
};

export type ProactiveAnalysisResult = {
  file_ref: string;
  join_suggestions: JoinSuggestion[];
  cleaning_suggestions: CleaningSuggestion[];
  kpi_suggestions: KpiSuggestion[];
  comparison_suggestions: ComparisonSuggestion[];
  data_warnings: DataWarning[];
  analysis_timestamp: string;
};

let suggestionCounter = 0;
const nextId = (prefix: string): string => `${prefix}-${++suggestionCounter}-${Date.now()}`;

export class ProactiveAiEngine {
  /**
   * Suggest potential joins between two datasets based on column name and value overlap.
   */
  suggestJoins(
    leftFileRef: string,
    leftColumns: string[],
    leftRows: RowData[],
    rightFileRef: string,
    rightColumns: string[],
    rightRows: RowData[]
  ): JoinSuggestion[] {
    const suggestions: JoinSuggestion[] = [];

    for (const lCol of leftColumns) {
      for (const rCol of rightColumns) {
        // Name similarity check
        const lNorm = lCol.toLowerCase().replace(/[_\s-]/g, "");
        const rNorm = rCol.toLowerCase().replace(/[_\s-]/g, "");
        const nameMatch = lNorm === rNorm || lNorm.includes(rNorm) || rNorm.includes(lNorm);

        if (!nameMatch) continue;

        // Value overlap check
        const lValues = new Set(leftRows.map((r) => String(r[lCol] ?? "")).filter((v) => v.length > 0));
        const rValues = new Set(rightRows.map((r) => String(r[rCol] ?? "")).filter((v) => v.length > 0));
        let overlapCount = 0;
        for (const v of lValues) {
          if (rValues.has(v)) overlapCount++;
        }
        const overlapRatio = Math.min(lValues.size, rValues.size) > 0
          ? overlapCount / Math.min(lValues.size, rValues.size)
          : 0;

        if (overlapRatio > 0.1 || nameMatch) {
          const confidence = Math.min(0.95, (nameMatch ? 0.4 : 0) + overlapRatio * 0.55);
          suggestions.push({
            suggestion_id: nextId("join-suggest"),
            left_file_ref: leftFileRef,
            right_file_ref: rightFileRef,
            left_column: lCol,
            right_column: rCol,
            join_type: overlapRatio > 0.8 ? "inner" : "left",
            confidence: Math.round(confidence * 100) / 100,
            rationale: `Column names match (${lCol} ↔ ${rCol}). Value overlap: ${Math.round(overlapRatio * 100)}% of ${Math.min(lValues.size, rValues.size)} unique values.`
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  /**
   * Suggest data cleaning operations based on data quality analysis.
   */
  suggestCleaning(fileRef: string, columns: string[], rows: RowData[]): CleaningSuggestion[] {
    const suggestions: CleaningSuggestion[] = [];
    const totalRows = rows.length;
    if (totalRows === 0) return suggestions;

    for (const col of columns) {
      const values = rows.map((r) => r[col]);
      const stringValues = values.map((v) => String(v ?? ""));

      // Missing values
      const missingCount = values.filter((v) => v === null || v === undefined || v === "").length;
      const missingPct = missingCount / totalRows;
      if (missingPct > 0.01) {
        suggestions.push({
          suggestion_id: nextId("clean-suggest"),
          file_ref: fileRef,
          column: col,
          issue_type: "missing_values",
          severity: missingPct > 0.3 ? "high" : missingPct > 0.1 ? "medium" : "low",
          affected_count: missingCount,
          affected_pct: Math.round(missingPct * 100),
          recommended_action: missingPct > 0.5 ? "Consider dropping column or imputing with domain-appropriate defaults." : "Impute missing values using median (numeric) or mode (categorical).",
          rationale: `${missingCount} of ${totalRows} values are missing (${Math.round(missingPct * 100)}%).`
        });
      }

      // Whitespace issues
      const whitespaceCount = stringValues.filter((v) => v !== v.trim()).length;
      if (whitespaceCount > 0) {
        suggestions.push({
          suggestion_id: nextId("clean-suggest"),
          file_ref: fileRef,
          column: col,
          issue_type: "whitespace",
          severity: "low",
          affected_count: whitespaceCount,
          affected_pct: Math.round((whitespaceCount / totalRows) * 100),
          recommended_action: "Apply TRIM to all values in this column.",
          rationale: `${whitespaceCount} value(s) have leading/trailing whitespace.`
        });
      }

      // Mixed types
      const numericValues = values.filter((v) => typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))));
      const nonNumericValues = values.filter((v) => v !== null && v !== undefined && v !== "" && (typeof v !== "number" && (typeof v !== "string" || Number.isNaN(Number(v)))));
      if (numericValues.length > 0 && nonNumericValues.length > 0) {
        const mixRatio = Math.min(numericValues.length, nonNumericValues.length) / totalRows;
        if (mixRatio > 0.05) {
          suggestions.push({
            suggestion_id: nextId("clean-suggest"),
            file_ref: fileRef,
            column: col,
            issue_type: "mixed_types",
            severity: "medium",
            affected_count: nonNumericValues.length,
            affected_pct: Math.round((nonNumericValues.length / totalRows) * 100),
            recommended_action: "Standardize column to a single type. Convert text-numbers to numeric or split into separate columns.",
            rationale: `Column has ${numericValues.length} numeric and ${nonNumericValues.length} non-numeric values.`
          });
        }
      }

      // Inconsistent format (for string columns)
      const nonEmpty = stringValues.filter((v) => v.length > 0);
      if (nonEmpty.length > 5) {
        const hasUpper = nonEmpty.some((v) => v !== v.toLowerCase() && v !== v.toUpperCase());
        const casePatterns = new Set(nonEmpty.map((v) => v === v.toLowerCase() ? "lower" : v === v.toUpperCase() ? "upper" : "mixed"));
        if (casePatterns.size > 1 && hasUpper) {
          suggestions.push({
            suggestion_id: nextId("clean-suggest"),
            file_ref: fileRef,
            column: col,
            issue_type: "inconsistent_format",
            severity: "low",
            affected_count: nonEmpty.length,
            affected_pct: 100,
            recommended_action: "Normalize casing (e.g., all lowercase or title case).",
            rationale: `Mixed casing patterns detected: ${[...casePatterns].join(", ")}.`
          });
        }
      }
    }

    // Global duplicate check
    const rowHashes = rows.map((r) => JSON.stringify(r));
    const uniqueHashes = new Set(rowHashes);
    const dupeCount = totalRows - uniqueHashes.size;
    if (dupeCount > 0) {
      suggestions.push({
        suggestion_id: nextId("clean-suggest"),
        file_ref: fileRef,
        column: "*",
        issue_type: "duplicates",
        severity: dupeCount > totalRows * 0.1 ? "high" : "medium",
        affected_count: dupeCount,
        affected_pct: Math.round((dupeCount / totalRows) * 100),
        recommended_action: "Deduplicate rows. Identify the key columns to determine which duplicates to keep.",
        rationale: `${dupeCount} duplicate row(s) found out of ${totalRows}.`
      });
    }

    return suggestions.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Suggest KPIs based on dataset structure and domain.
   */
  suggestKpis(fileRef: string, columns: string[], rows: RowData[], domain?: string): KpiSuggestion[] {
    const suggestions: KpiSuggestion[] = [];
    const numericCols = columns.filter((col) =>
      rows.some((r) => typeof r[col] === "number" || (typeof r[col] === "string" && r[col] !== "" && !Number.isNaN(Number(r[col]))))
    );
    const categoricalCols = columns.filter((c) => !numericCols.includes(c));

    // Basic aggregation KPIs
    for (const col of numericCols.slice(0, 6)) {
      suggestions.push({
        suggestion_id: nextId("kpi-suggest"),
        file_ref: fileRef,
        kpi_name: `Total ${col}`,
        formula: `SUM(${col})`,
        columns_involved: [col],
        business_context: `Aggregate total of ${col} across all records.`,
        confidence: 0.85
      });

      suggestions.push({
        suggestion_id: nextId("kpi-suggest"),
        file_ref: fileRef,
        kpi_name: `Average ${col}`,
        formula: `AVG(${col})`,
        columns_involved: [col],
        business_context: `Mean value of ${col}. Useful for trend baseline.`,
        confidence: 0.82
      });
    }

    // Ratio KPIs (if two numeric columns exist)
    if (numericCols.length >= 2) {
      const [a, b] = numericCols;
      suggestions.push({
        suggestion_id: nextId("kpi-suggest"),
        file_ref: fileRef,
        kpi_name: `${a} to ${b} Ratio`,
        formula: `SUM(${a}) / SUM(${b})`,
        columns_involved: [a!, b!],
        business_context: `Ratio between ${a} and ${b}. Tracks relative performance.`,
        confidence: 0.72
      });
    }

    // Domain-specific KPIs
    if (domain === "finance" || columns.some((c) => /revenue|sales|income/i.test(c))) {
      const revenueCol = numericCols.find((c) => /revenue|sales|income|إيراد|مبيعات/i.test(c));
      const costCol = numericCols.find((c) => /cost|expense|مصروف/i.test(c));
      if (revenueCol && costCol) {
        suggestions.push({
          suggestion_id: nextId("kpi-suggest"),
          file_ref: fileRef,
          kpi_name: "Profit Margin",
          formula: `(SUM(${revenueCol}) - SUM(${costCol})) / SUM(${revenueCol}) * 100`,
          columns_involved: [revenueCol, costCol],
          business_context: "Net profit as percentage of revenue. Key financial health indicator.",
          confidence: 0.91
        });
      }
    }

    // Group-by KPIs
    for (const dim of categoricalCols.slice(0, 3)) {
      for (const metric of numericCols.slice(0, 2)) {
        suggestions.push({
          suggestion_id: nextId("kpi-suggest"),
          file_ref: fileRef,
          kpi_name: `${metric} by ${dim}`,
          formula: `SUM(${metric}) GROUP BY ${dim}`,
          columns_involved: [metric, dim],
          business_context: `Breakdown of ${metric} across ${dim} categories.`,
          confidence: 0.78
        });
      }
    }

    return suggestions;
  }

  /**
   * Suggest meaningful comparisons based on dataset structure.
   */
  suggestComparisons(fileRef: string, columns: string[], rows: RowData[]): ComparisonSuggestion[] {
    const suggestions: ComparisonSuggestion[] = [];
    const numericCols = columns.filter((col) =>
      rows.some((r) => typeof r[col] === "number" || (typeof r[col] === "string" && r[col] !== "" && !Number.isNaN(Number(r[col]))))
    );
    const categoricalCols = columns.filter((c) => !numericCols.includes(c));

    // Time-based comparisons
    const timeCols = columns.filter((c) => /date|time|year|month|quarter|period|تاريخ|سنة|شهر|فترة/i.test(c));
    for (const timeCol of timeCols) {
      for (const metric of numericCols.slice(0, 3)) {
        suggestions.push({
          suggestion_id: nextId("compare-suggest"),
          file_ref: fileRef,
          comparison_type: /year|سنة/i.test(timeCol) ? "yoy" : /month|شهر/i.test(timeCol) ? "mom" : "time_period",
          dimension_column: timeCol,
          metric_column: metric,
          description: `Compare ${metric} across different ${timeCol} periods.`,
          confidence: 0.85
        });
      }
    }

    // Category comparisons
    for (const dim of categoricalCols.slice(0, 3)) {
      const uniqueValues = new Set(rows.map((r) => String(r[dim] ?? "")));
      if (uniqueValues.size >= 2 && uniqueValues.size <= 50) {
        for (const metric of numericCols.slice(0, 2)) {
          suggestions.push({
            suggestion_id: nextId("compare-suggest"),
            file_ref: fileRef,
            comparison_type: "category",
            dimension_column: dim,
            metric_column: metric,
            description: `Compare ${metric} across ${uniqueValues.size} categories in ${dim}.`,
            confidence: 0.8
          });
        }
      }
    }

    // Target vs actual (detect columns with "target", "actual", "plan", "budget")
    const targetCol = columns.find((c) => /target|plan|budget|هدف|خطة|ميزانية/i.test(c));
    const actualCol = columns.find((c) => /actual|real|فعلي|حقيقي/i.test(c));
    if (targetCol && actualCol) {
      suggestions.push({
        suggestion_id: nextId("compare-suggest"),
        file_ref: fileRef,
        comparison_type: "target_vs_actual",
        dimension_column: targetCol,
        metric_column: actualCol,
        description: `Compare planned (${targetCol}) vs actual (${actualCol}) performance.`,
        confidence: 0.92
      });
    }

    return suggestions;
  }

  /**
   * Warn about data issues found in the dataset.
   */
  warnAboutDataIssues(fileRef: string, columns: string[], rows: RowData[]): DataWarning[] {
    const warnings: DataWarning[] = [];
    const totalRows = rows.length;

    if (totalRows === 0) {
      warnings.push({
        warning_id: nextId("warn"),
        file_ref: fileRef,
        warning_type: "volume_concern",
        severity: "critical",
        title: "Empty dataset",
        detail: "The dataset contains zero rows. No analysis can be performed.",
        affected_columns: [],
        recommended_fix: "Verify the data source and re-import."
      });
      return warnings;
    }

    // Completeness warnings
    for (const col of columns) {
      const missingCount = rows.filter((r) => r[col] === null || r[col] === undefined || r[col] === "").length;
      const missingPct = missingCount / totalRows;
      if (missingPct > 0.5) {
        warnings.push({
          warning_id: nextId("warn"),
          file_ref: fileRef,
          warning_type: "data_quality",
          severity: "high",
          title: `Column "${col}" is mostly empty`,
          detail: `${Math.round(missingPct * 100)}% of values are missing (${missingCount}/${totalRows}).`,
          affected_columns: [col],
          recommended_fix: "Impute values, drop column, or verify data source."
        });
      }
    }

    // Constant columns
    for (const col of columns) {
      const unique = new Set(rows.map((r) => String(r[col] ?? "")));
      if (unique.size === 1 && totalRows > 1) {
        warnings.push({
          warning_id: nextId("warn"),
          file_ref: fileRef,
          warning_type: "schema_issue",
          severity: "medium",
          title: `Column "${col}" has constant value`,
          detail: `All ${totalRows} rows have the same value. This column adds no analytical value.`,
          affected_columns: [col],
          recommended_fix: "Remove constant column or verify if this is expected."
        });
      }
    }

    // Small dataset warning
    if (totalRows < 10) {
      warnings.push({
        warning_id: nextId("warn"),
        file_ref: fileRef,
        warning_type: "volume_concern",
        severity: "medium",
        title: "Very small dataset",
        detail: `Only ${totalRows} rows. Statistical analysis and aggregations may be unreliable.`,
        affected_columns: [],
        recommended_fix: "Ensure this represents the full dataset, not a partial extract."
      });
    }

    // High cardinality warning (potential ID column used as dimension)
    for (const col of columns) {
      const unique = new Set(rows.map((r) => String(r[col] ?? "")));
      if (unique.size > totalRows * 0.9 && totalRows > 20 && !/id$|_id$|^pk$|^key$/i.test(col)) {
        warnings.push({
          warning_id: nextId("warn"),
          file_ref: fileRef,
          warning_type: "schema_issue",
          severity: "info",
          title: `Column "${col}" has very high cardinality`,
          detail: `${unique.size}/${totalRows} unique values. This may be an ID column disguised as a dimension.`,
          affected_columns: [col],
          recommended_fix: "Verify if this should be treated as a key/identifier rather than a dimension."
        });
      }
    }

    // Outlier detection for numeric columns
    const numericCols = columns.filter((col) =>
      rows.some((r) => typeof r[col] === "number" || (typeof r[col] === "string" && r[col] !== "" && !Number.isNaN(Number(r[col]))))
    );
    for (const col of numericCols) {
      const values = rows.map((r) => Number(r[col])).filter((v) => !Number.isNaN(v));
      if (values.length < 5) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
      const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      const outlierCount = values.filter((v) => v < lowerBound || v > upperBound).length;
      if (outlierCount > 0) {
        warnings.push({
          warning_id: nextId("warn"),
          file_ref: fileRef,
          warning_type: "data_quality",
          severity: outlierCount > totalRows * 0.1 ? "high" : "low",
          title: `Outliers detected in "${col}"`,
          detail: `${outlierCount} value(s) outside IQR bounds [${Math.round(lowerBound * 100) / 100}, ${Math.round(upperBound * 100) / 100}].`,
          affected_columns: [col],
          recommended_fix: "Review outliers. Cap, remove, or flag depending on domain context."
        });
      }
    }

    return warnings.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity];
    });
  }

  /**
   * Run full proactive analysis on a dataset.
   */
  analyzeDataset(fileRef: string, columns: string[], rows: RowData[], domain?: string): ProactiveAnalysisResult {
    return {
      file_ref: fileRef,
      join_suggestions: [],
      cleaning_suggestions: this.suggestCleaning(fileRef, columns, rows),
      kpi_suggestions: this.suggestKpis(fileRef, columns, rows, domain),
      comparison_suggestions: this.suggestComparisons(fileRef, columns, rows),
      data_warnings: this.warnAboutDataIssues(fileRef, columns, rows),
      analysis_timestamp: new Date().toISOString()
    };
  }
}
