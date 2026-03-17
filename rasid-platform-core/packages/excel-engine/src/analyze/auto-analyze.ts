/**
 * Auto-Analyze — Dataset → Summary + Issues + Recommended Recipes + Recommended Outputs
 * Namespace: rasid.excel.analyze
 *
 * Analyzes a dataset to produce a comprehensive summary, detect data quality issues,
 * recommend transformation recipes, and suggest output formats.
 */

import crypto from 'node:crypto';
import type { SVMWorkbook, SVMSheet, CellRef } from '../svm/types';

// ─── Analysis Result Types ──────────────────────────────────────────────────

export interface AutoAnalyzeResult {
  analysisId: string;
  workbookId: string;
  summary: DatasetSummary;
  issues: DataIssue[];
  recommendedRecipes: Recipe[];
  recommendedOutputs: RecommendedOutput[];
  columnProfiles: ColumnProfile[];
  correlations: Correlation[];
  timestamp: string;
}

export interface DatasetSummary {
  sheetCount: number;
  totalRows: number;
  totalColumns: number;
  totalCells: number;
  formulaCount: number;
  blankCellCount: number;
  blankCellPercentage: number;
  numericColumnCount: number;
  textColumnCount: number;
  dateColumnCount: number;
  booleanColumnCount: number;
  mixedTypeColumnCount: number;
  duplicateRowCount: number;
  estimatedDataQualityScore: number;
  sheets: SheetSummary[];
}

export interface SheetSummary {
  name: string;
  rowCount: number;
  columnCount: number;
  formulaCount: number;
  blankPercentage: number;
  hasHeaders: boolean;
  hasMergedCells: boolean;
  hasPivotTables: boolean;
  hasCharts: boolean;
  hasConditionalFormatting: boolean;
  hasFreezePane: boolean;
}

export interface ColumnProfile {
  sheetName: string;
  columnName: string;
  columnIndex: number;
  inferredType: 'number' | 'string' | 'date' | 'boolean' | 'mixed' | 'blank';
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  duplicateCount: number;
  isKeyCandidate: boolean;
  stats: NumericStats | null;
  topValues: Array<{ value: string; count: number }>;
  format: string | null;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  sum: number;
  zeroCount: number;
  negativeCount: number;
}

export interface DataIssue {
  issueId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: IssueCategory;
  description: string;
  descriptionAr: string;
  affectedSheet: string;
  affectedColumns: string[];
  affectedRowCount: number;
  suggestedFix: string;
  autoFixable: boolean;
}

export type IssueCategory =
  | 'missing_values' | 'duplicate_rows' | 'inconsistent_types'
  | 'outliers' | 'formatting_issues' | 'invalid_dates'
  | 'empty_columns' | 'merged_cells_data_loss' | 'circular_references'
  | 'broken_formulas' | 'encoding_issues' | 'trailing_whitespace'
  | 'hidden_data' | 'inconsistent_casing' | 'numeric_as_text';

export interface Recipe {
  recipeId: string;
  name: string;
  nameAr: string;
  description: string;
  category: 'cleaning' | 'transformation' | 'enrichment' | 'analysis' | 'visualization';
  steps: RecipeStep[];
  applicability: number; // 0-1
  estimatedImpact: 'low' | 'medium' | 'high';
  requiredColumns: string[];
}

export interface RecipeStep {
  stepId: string;
  action: string;
  parameters: Record<string, unknown>;
  description: string;
}

export interface RecommendedOutput {
  outputId: string;
  type: 'pivot_table' | 'chart' | 'summary_sheet' | 'kpi_dashboard' | 'report' | 'filtered_view';
  name: string;
  nameAr: string;
  description: string;
  applicability: number;
  suggestedConfig: Record<string, unknown>;
}

export interface Correlation {
  fieldA: string;
  fieldB: string;
  coefficient: number;
  strength: 'weak' | 'moderate' | 'strong';
}

// ─── Auto-Analyze Engine ────────────────────────────────────────────────────

export class AutoAnalyzer {
  /**
   * Analyze a workbook and produce comprehensive analysis results.
   */
  analyze(workbook: SVMWorkbook): AutoAnalyzeResult {
    const analysisId = `analysis-${crypto.randomUUID()}`;

    // Profile all columns
    const columnProfiles = this.profileColumns(workbook);

    // Build summary
    const summary = this.buildSummary(workbook, columnProfiles);

    // Detect issues
    const issues = this.detectIssues(workbook, columnProfiles);

    // Generate recipes
    const recommendedRecipes = this.generateRecipes(workbook, columnProfiles, issues);

    // Generate output recommendations
    const recommendedOutputs = this.generateOutputRecommendations(workbook, columnProfiles);

    // Compute correlations
    const correlations = this.computeCorrelations(workbook, columnProfiles);

    return {
      analysisId,
      workbookId: workbook.workbookId,
      summary,
      issues,
      recommendedRecipes,
      recommendedOutputs,
      columnProfiles,
      correlations,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Column Profiling ─────────────────────────────────────────────────

  private profileColumns(workbook: SVMWorkbook): ColumnProfile[] {
    const profiles: ColumnProfile[] = [];

    for (const [sheetName, sheet] of workbook.sheets) {
      // Detect headers from row 1
      const headers = this.extractHeaders(sheet, sheetName);

      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const header = headers[colIdx];
        const values = this.extractColumnValues(sheet, sheetName, colIdx + 1);
        const profile = this.profileSingleColumn(sheetName, header, colIdx + 1, values);
        profiles.push(profile);
      }
    }

    return profiles;
  }

  private extractHeaders(sheet: SVMSheet, sheetName: string): string[] {
    const headers: string[] = [];
    for (let c = 1; c <= sheet.dimensions.colCount; c++) {
      const ref: CellRef = `${sheetName}!${colNumToLetter(c)}1`;
      const cell = sheet.cells.get(ref);
      headers.push(cell?.value.value ? `${cell.value.value}` : `Column_${c}`);
    }
    return headers;
  }

  private extractColumnValues(sheet: SVMSheet, sheetName: string, col: number): unknown[] {
    const values: unknown[] = [];
    const colLetter = colNumToLetter(col);
    for (let r = 2; r <= sheet.dimensions.rowCount; r++) {
      const ref: CellRef = `${sheetName}!${colLetter}${r}`;
      const cell = sheet.cells.get(ref);
      values.push(cell?.value.value ?? null);
    }
    return values;
  }

  private profileSingleColumn(
    sheetName: string,
    columnName: string,
    columnIndex: number,
    values: unknown[]
  ): ColumnProfile {
    const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const uniqueValues = new Set(nonNull.map(v => JSON.stringify(v)));
    const uniqueCount = uniqueValues.size;
    const inferredType = this.inferType(nonNull);

    // Top values
    const valueCounts = new Map<string, number>();
    for (const v of nonNull) {
      const key = `${v}`;
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    }
    const topValues = [...valueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    // Numeric stats
    let stats: NumericStats | null = null;
    if (inferredType === 'number') {
      const nums = nonNull.map(v => typeof v === 'number' ? v : parseFloat(`${v}`)).filter(n => !isNaN(n));
      if (nums.length > 0) {
        const sorted = [...nums].sort((a, b) => a - b);
        const sum = nums.reduce((a, b) => a + b, 0);
        const mean = sum / nums.length;
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        const variance = nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / nums.length;

        stats = {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          mean,
          median,
          stddev: Math.sqrt(variance),
          sum,
          zeroCount: nums.filter(n => n === 0).length,
          negativeCount: nums.filter(n => n < 0).length,
        };
      }
    }

    return {
      sheetName,
      columnName,
      columnIndex,
      inferredType,
      nullCount,
      nullPercentage: values.length > 0 ? (nullCount / values.length) * 100 : 0,
      uniqueCount,
      uniquePercentage: nonNull.length > 0 ? (uniqueCount / nonNull.length) * 100 : 0,
      duplicateCount: nonNull.length - uniqueCount,
      isKeyCandidate: uniqueCount === nonNull.length && nullCount === 0 && nonNull.length > 0,
      stats,
      topValues,
      format: null,
    };
  }

  private inferType(values: unknown[]): ColumnProfile['inferredType'] {
    if (values.length === 0) return 'blank';

    const types = new Set<string>();
    for (const v of values) {
      if (typeof v === 'number') types.add('number');
      else if (typeof v === 'boolean') types.add('boolean');
      else if (v instanceof Date) types.add('date');
      else if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) types.add('date');
        else if (/^-?\d+(\.\d+)?$/.test(v)) types.add('number');
        else types.add('string');
      }
    }

    if (types.size === 1) return [...types][0] as ColumnProfile['inferredType'];
    if (types.size === 2 && types.has('number') && types.has('string')) {
      // Check if most are numbers
      const numCount = values.filter(v => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(`${v}`)).length;
      if (numCount > values.length * 0.8) return 'number';
    }
    return 'mixed';
  }

  // ─── Summary Builder ──────────────────────────────────────────────────

  private buildSummary(workbook: SVMWorkbook, profiles: ColumnProfile[]): DatasetSummary {
    let totalRows = 0;
    let totalCells = 0;
    let formulaCount = 0;
    let blankCellCount = 0;
    const sheets: SheetSummary[] = [];

    for (const [sheetName, sheet] of workbook.sheets) {
      let sheetFormulas = 0;
      let sheetBlanks = 0;

      for (const [, cell] of sheet.cells) {
        totalCells++;
        if (cell.value.formula) { formulaCount++; sheetFormulas++; }
        if (cell.value.type === 'blank') { blankCellCount++; sheetBlanks++; }
      }

      totalRows += sheet.dimensions.rowCount;

      sheets.push({
        name: sheetName,
        rowCount: sheet.dimensions.rowCount,
        columnCount: sheet.dimensions.colCount,
        formulaCount: sheetFormulas,
        blankPercentage: totalCells > 0 ? (sheetBlanks / Math.max(sheet.cells.size, 1)) * 100 : 0,
        hasHeaders: sheet.dimensions.rowCount > 0,
        hasMergedCells: sheet.mergedCells.length > 0,
        hasPivotTables: sheet.pivotTables.length > 0,
        hasCharts: sheet.charts.length > 0,
        hasConditionalFormatting: sheet.conditionalFormats.length > 0,
        hasFreezePane: sheet.freezePane !== null,
      });
    }

    const numericCols = profiles.filter(p => p.inferredType === 'number').length;
    const textCols = profiles.filter(p => p.inferredType === 'string').length;
    const dateCols = profiles.filter(p => p.inferredType === 'date').length;
    const boolCols = profiles.filter(p => p.inferredType === 'boolean').length;
    const mixedCols = profiles.filter(p => p.inferredType === 'mixed').length;

    // Estimate data quality score
    const qualityScore = this.calculateQualityScore(profiles, blankCellCount, totalCells);

    return {
      sheetCount: workbook.sheets.size,
      totalRows,
      totalColumns: profiles.length,
      totalCells,
      formulaCount,
      blankCellCount,
      blankCellPercentage: totalCells > 0 ? (blankCellCount / totalCells) * 100 : 0,
      numericColumnCount: numericCols,
      textColumnCount: textCols,
      dateColumnCount: dateCols,
      booleanColumnCount: boolCols,
      mixedTypeColumnCount: mixedCols,
      duplicateRowCount: 0, // Computed separately
      estimatedDataQualityScore: qualityScore,
      sheets,
    };
  }

  private calculateQualityScore(profiles: ColumnProfile[], blanks: number, total: number): number {
    let score = 100;

    // Penalize blank cells
    if (total > 0) score -= (blanks / total) * 30;

    // Penalize mixed types
    const mixedRatio = profiles.filter(p => p.inferredType === 'mixed').length / Math.max(profiles.length, 1);
    score -= mixedRatio * 20;

    // Penalize high null percentages
    const avgNullPct = profiles.reduce((acc, p) => acc + p.nullPercentage, 0) / Math.max(profiles.length, 1);
    score -= (avgNullPct / 100) * 20;

    // Penalize low uniqueness (possible data quality issues)
    const lowUnique = profiles.filter(p => p.uniquePercentage < 10 && p.inferredType !== 'boolean').length;
    score -= (lowUnique / Math.max(profiles.length, 1)) * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ─── Issue Detection ──────────────────────────────────────────────────

  private detectIssues(workbook: SVMWorkbook, profiles: ColumnProfile[]): DataIssue[] {
    const issues: DataIssue[] = [];

    for (const profile of profiles) {
      // Missing values
      if (profile.nullPercentage > 5) {
        issues.push({
          issueId: `issue-${crypto.randomUUID().slice(0, 8)}`,
          severity: profile.nullPercentage > 50 ? 'error' : profile.nullPercentage > 20 ? 'warning' : 'info',
          category: 'missing_values',
          description: `Column "${profile.columnName}" has ${profile.nullPercentage.toFixed(1)}% missing values (${profile.nullCount} cells)`,
          descriptionAr: `العمود "${profile.columnName}" يحتوي على ${profile.nullPercentage.toFixed(1)}% قيم مفقودة (${profile.nullCount} خلية)`,
          affectedSheet: profile.sheetName,
          affectedColumns: [profile.columnName],
          affectedRowCount: profile.nullCount,
          suggestedFix: 'Fill with default value, forward-fill, or remove rows',
          autoFixable: true,
        });
      }

      // Mixed types
      if (profile.inferredType === 'mixed') {
        issues.push({
          issueId: `issue-${crypto.randomUUID().slice(0, 8)}`,
          severity: 'warning',
          category: 'inconsistent_types',
          description: `Column "${profile.columnName}" contains mixed data types`,
          descriptionAr: `العمود "${profile.columnName}" يحتوي على أنواع بيانات مختلطة`,
          affectedSheet: profile.sheetName,
          affectedColumns: [profile.columnName],
          affectedRowCount: 0,
          suggestedFix: 'Cast to a consistent type or split into separate columns',
          autoFixable: false,
        });
      }

      // Empty columns
      if (profile.nullPercentage === 100) {
        issues.push({
          issueId: `issue-${crypto.randomUUID().slice(0, 8)}`,
          severity: 'info',
          category: 'empty_columns',
          description: `Column "${profile.columnName}" is completely empty`,
          descriptionAr: `العمود "${profile.columnName}" فارغ تماماً`,
          affectedSheet: profile.sheetName,
          affectedColumns: [profile.columnName],
          affectedRowCount: profile.nullCount,
          suggestedFix: 'Remove the column',
          autoFixable: true,
        });
      }

      // Outliers (for numeric columns)
      if (profile.stats && profile.stats.stddev > 0) {
        const threshold = profile.stats.mean + 3 * profile.stats.stddev;
        if (profile.stats.max > threshold) {
          issues.push({
            issueId: `issue-${crypto.randomUUID().slice(0, 8)}`,
            severity: 'info',
            category: 'outliers',
            description: `Column "${profile.columnName}" may contain outliers (max=${profile.stats.max}, 3σ threshold=${threshold.toFixed(2)})`,
            descriptionAr: `العمود "${profile.columnName}" قد يحتوي على قيم شاذة`,
            affectedSheet: profile.sheetName,
            affectedColumns: [profile.columnName],
            affectedRowCount: 0,
            suggestedFix: 'Review and validate extreme values',
            autoFixable: false,
          });
        }
      }
    }

    // Check for merged cells
    for (const [sheetName, sheet] of workbook.sheets) {
      if (sheet.mergedCells.length > 0) {
        issues.push({
          issueId: `issue-${crypto.randomUUID().slice(0, 8)}`,
          severity: 'warning',
          category: 'merged_cells_data_loss',
          description: `Sheet "${sheetName}" has ${sheet.mergedCells.length} merged cell region(s) which may cause data loss during transformation`,
          descriptionAr: `الورقة "${sheetName}" تحتوي على ${sheet.mergedCells.length} منطقة(مناطق) خلايا مدمجة`,
          affectedSheet: sheetName,
          affectedColumns: [],
          affectedRowCount: 0,
          suggestedFix: 'Unmerge cells and fill values before processing',
          autoFixable: true,
        });
      }

      // Circular references
      if (workbook.formulaDAG.circularRefs.length > 0) {
        issues.push({
          issueId: `issue-${crypto.randomUUID().slice(0, 8)}`,
          severity: 'error',
          category: 'circular_references',
          description: `${workbook.formulaDAG.circularRefs.length} circular reference chain(s) detected`,
          descriptionAr: `تم اكتشاف ${workbook.formulaDAG.circularRefs.length} سلسلة(سلاسل) مرجعية دائرية`,
          affectedSheet: sheetName,
          affectedColumns: [],
          affectedRowCount: 0,
          suggestedFix: 'Break circular references by restructuring formulas',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  // ─── Recipe Generation ────────────────────────────────────────────────

  private generateRecipes(
    workbook: SVMWorkbook,
    profiles: ColumnProfile[],
    issues: DataIssue[]
  ): Recipe[] {
    const recipes: Recipe[] = [];

    // Cleaning recipe based on issues
    const hasNulls = issues.some(i => i.category === 'missing_values');
    if (hasNulls) {
      recipes.push({
        recipeId: `recipe-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Data Cleaning - Handle Missing Values',
        nameAr: 'تنظيف البيانات - معالجة القيم المفقودة',
        description: 'Fill or remove missing values based on column type',
        category: 'cleaning',
        steps: [
          { stepId: 's1', action: 'identify_nulls', parameters: {}, description: 'Identify null/blank cells' },
          { stepId: 's2', action: 'fill_numeric', parameters: { strategy: 'median' }, description: 'Fill numeric nulls with median' },
          { stepId: 's3', action: 'fill_text', parameters: { strategy: 'mode' }, description: 'Fill text nulls with most common value' },
          { stepId: 's4', action: 'drop_rows', parameters: { threshold: 0.5 }, description: 'Drop rows with >50% missing' },
        ],
        applicability: 0.9,
        estimatedImpact: 'high',
        requiredColumns: issues.filter(i => i.category === 'missing_values').flatMap(i => i.affectedColumns),
      });
    }

    // Deduplication recipe
    const hasDupes = profiles.some(p => p.duplicateCount > 0 && p.isKeyCandidate);
    if (hasDupes) {
      recipes.push({
        recipeId: `recipe-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Remove Duplicate Rows',
        nameAr: 'إزالة الصفوف المكررة',
        description: 'Remove exact duplicate rows keeping the first occurrence',
        category: 'cleaning',
        steps: [
          { stepId: 's1', action: 'sort_by_key', parameters: {}, description: 'Sort by key columns' },
          { stepId: 's2', action: 'mark_duplicates', parameters: {}, description: 'Mark duplicate rows' },
          { stepId: 's3', action: 'remove_duplicates', parameters: { keep: 'first' }, description: 'Remove duplicates' },
        ],
        applicability: 0.8,
        estimatedImpact: 'medium',
        requiredColumns: profiles.filter(p => p.isKeyCandidate).map(p => p.columnName),
      });
    }

    // Pivot table recipe (if categorical + numeric columns exist)
    const categoricalCols = profiles.filter(p => p.inferredType === 'string' && p.uniqueCount < 50);
    const numericCols = profiles.filter(p => p.inferredType === 'number');
    if (categoricalCols.length > 0 && numericCols.length > 0) {
      recipes.push({
        recipeId: `recipe-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Create Pivot Summary',
        nameAr: 'إنشاء ملخص محوري',
        description: `Pivot by ${categoricalCols[0].columnName} with ${numericCols[0].columnName} aggregation`,
        category: 'analysis',
        steps: [
          { stepId: 's1', action: 'create_pivot', parameters: { row: categoricalCols[0].columnName, value: numericCols[0].columnName, agg: 'sum' }, description: 'Create pivot table' },
          { stepId: 's2', action: 'add_subtotals', parameters: {}, description: 'Add subtotals' },
          { stepId: 's3', action: 'format_pivot', parameters: {}, description: 'Apply formatting' },
        ],
        applicability: 0.85,
        estimatedImpact: 'high',
        requiredColumns: [categoricalCols[0].columnName, numericCols[0].columnName],
      });
    }

    // Type casting recipe
    const hasMixed = issues.some(i => i.category === 'inconsistent_types');
    if (hasMixed) {
      recipes.push({
        recipeId: `recipe-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Standardize Column Types',
        nameAr: 'توحيد أنواع الأعمدة',
        description: 'Cast mixed-type columns to their dominant type',
        category: 'cleaning',
        steps: [
          { stepId: 's1', action: 'detect_dominant_type', parameters: {}, description: 'Detect dominant type per column' },
          { stepId: 's2', action: 'cast_values', parameters: {}, description: 'Cast values to dominant type' },
          { stepId: 's3', action: 'log_failures', parameters: {}, description: 'Log values that could not be cast' },
        ],
        applicability: 0.75,
        estimatedImpact: 'medium',
        requiredColumns: profiles.filter(p => p.inferredType === 'mixed').map(p => p.columnName),
      });
    }

    return recipes;
  }

  // ─── Output Recommendations ───────────────────────────────────────────

  private generateOutputRecommendations(
    workbook: SVMWorkbook,
    profiles: ColumnProfile[]
  ): RecommendedOutput[] {
    const outputs: RecommendedOutput[] = [];

    const numericCols = profiles.filter(p => p.inferredType === 'number');
    const categoricalCols = profiles.filter(p => p.inferredType === 'string' && p.uniqueCount < 50);
    const dateCols = profiles.filter(p => p.inferredType === 'date');

    // Summary sheet
    outputs.push({
      outputId: `out-${crypto.randomUUID().slice(0, 8)}`,
      type: 'summary_sheet',
      name: 'Data Summary Sheet',
      nameAr: 'ورقة ملخص البيانات',
      description: 'Auto-generated summary with column statistics and data quality metrics',
      applicability: 1.0,
      suggestedConfig: { includeCharts: true, includeStats: true },
    });

    // Pivot table (if applicable)
    if (categoricalCols.length > 0 && numericCols.length > 0) {
      outputs.push({
        outputId: `out-${crypto.randomUUID().slice(0, 8)}`,
        type: 'pivot_table',
        name: `Pivot: ${categoricalCols[0].columnName} × ${numericCols[0].columnName}`,
        nameAr: `محوري: ${categoricalCols[0].columnName} × ${numericCols[0].columnName}`,
        description: 'Pivot table summarizing numeric data by category',
        applicability: 0.9,
        suggestedConfig: {
          rowField: categoricalCols[0].columnName,
          valueField: numericCols[0].columnName,
          aggregation: 'sum',
        },
      });
    }

    // Chart (if numeric + categorical)
    if (numericCols.length > 0) {
      outputs.push({
        outputId: `out-${crypto.randomUUID().slice(0, 8)}`,
        type: 'chart',
        name: 'Distribution Chart',
        nameAr: 'مخطط التوزيع',
        description: 'Bar/line chart showing data distribution',
        applicability: 0.85,
        suggestedConfig: {
          chartType: categoricalCols.length > 0 ? 'bar' : 'line',
          categoryField: categoricalCols[0]?.columnName ?? dateCols[0]?.columnName,
          valueField: numericCols[0].columnName,
        },
      });
    }

    // KPI Dashboard
    if (numericCols.length >= 2) {
      outputs.push({
        outputId: `out-${crypto.randomUUID().slice(0, 8)}`,
        type: 'kpi_dashboard',
        name: 'KPI Dashboard',
        nameAr: 'لوحة المؤشرات',
        description: 'Dashboard with key numeric KPIs',
        applicability: 0.8,
        suggestedConfig: {
          kpis: numericCols.slice(0, 6).map(c => ({
            field: c.columnName,
            aggregation: 'sum',
          })),
        },
      });
    }

    // Time series (if date column exists)
    if (dateCols.length > 0 && numericCols.length > 0) {
      outputs.push({
        outputId: `out-${crypto.randomUUID().slice(0, 8)}`,
        type: 'chart',
        name: 'Time Series Analysis',
        nameAr: 'تحليل السلاسل الزمنية',
        description: 'Line chart showing trends over time',
        applicability: 0.85,
        suggestedConfig: {
          chartType: 'line',
          categoryField: dateCols[0].columnName,
          valueField: numericCols[0].columnName,
        },
      });
    }

    return outputs;
  }

  // ─── Correlation Analysis ─────────────────────────────────────────────

  private computeCorrelations(
    workbook: SVMWorkbook,
    profiles: ColumnProfile[]
  ): Correlation[] {
    const correlations: Correlation[] = [];
    const numericProfiles = profiles.filter(p => p.inferredType === 'number' && p.stats);

    // Compute pairwise Pearson correlation for numeric columns (same sheet)
    for (let i = 0; i < numericProfiles.length; i++) {
      for (let j = i + 1; j < numericProfiles.length; j++) {
        const a = numericProfiles[i];
        const b = numericProfiles[j];
        if (a.sheetName !== b.sheetName) continue;

        const sheet = workbook.sheets.get(a.sheetName);
        if (!sheet) continue;

        const valsA = this.extractColumnValues(sheet, a.sheetName, a.columnIndex);
        const valsB = this.extractColumnValues(sheet, b.sheetName, b.columnIndex);

        const coeff = pearsonCorrelation(
          valsA.map(v => typeof v === 'number' ? v : 0),
          valsB.map(v => typeof v === 'number' ? v : 0)
        );

        if (!isNaN(coeff)) {
          correlations.push({
            fieldA: a.columnName,
            fieldB: b.columnName,
            coefficient: Math.round(coeff * 1000) / 1000,
            strength: Math.abs(coeff) > 0.7 ? 'strong' : Math.abs(coeff) > 0.3 ? 'moderate' : 'weak',
          });
        }
      }
    }

    return correlations;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
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
