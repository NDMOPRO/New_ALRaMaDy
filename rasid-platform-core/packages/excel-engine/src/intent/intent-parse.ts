/**
 * Intent Parse — Prompt → T-IR Plan + Join Plan + KPI Plan
 * Namespace: rasid.excel.intent
 *
 * Transforms a natural language prompt into a structured execution plan
 * containing transformation instructions (T-IR), join specifications,
 * and KPI definitions for the SVM to execute.
 */

import crypto from 'node:crypto';

// ─── T-IR (Transformation Intermediate Representation) ──────────────────────

export interface TIRPlan {
  planId: string;
  sourceDescription: string;
  transformations: TIRTransformation[];
  outputSchema: TIROutputSchema;
  executionOrder: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface TIRTransformation {
  transformId: string;
  type: TIRTransformType;
  sourceFields: string[];
  targetField: string;
  parameters: Record<string, unknown>;
  dependsOn: string[];
  description: string;
}

export type TIRTransformType =
  | 'select' | 'filter' | 'aggregate' | 'sort' | 'group_by'
  | 'pivot' | 'unpivot' | 'join' | 'union' | 'distinct'
  | 'calculate' | 'rename' | 'cast' | 'fill_null' | 'split'
  | 'merge_columns' | 'date_extract' | 'text_transform'
  | 'conditional' | 'lookup' | 'rank' | 'window'
  | 'cumulative' | 'percentage' | 'normalize' | 'deduplicate';

export interface TIROutputSchema {
  fields: TIRField[];
  sortOrder: Array<{ field: string; direction: 'asc' | 'desc' }>;
  groupBy: string[];
}

export interface TIRField {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean' | 'percentage' | 'currency';
  format: string | null;
  source: string;
  computed: boolean;
}

// ─── Join Plan ──────────────────────────────────────────────────────────────

export interface JoinPlan {
  planId: string;
  joins: JoinSpec[];
  sourceSheets: string[];
  resultSchema: TIRField[];
  timestamp: string;
}

export interface JoinSpec {
  joinId: string;
  joinType: 'inner' | 'left' | 'right' | 'full' | 'cross';
  leftSource: string;
  rightSource: string;
  leftKey: string[];
  rightKey: string[];
  outputFields: string[];
  conflictResolution: 'left_wins' | 'right_wins' | 'coalesce' | 'suffix';
}

// ─── KPI Plan ───────────────────────────────────────────────────────────────

export interface KPIPlan {
  planId: string;
  kpis: KPIDefinition[];
  dashboardBindings: KPIDashboardBinding[];
  timestamp: string;
}

export interface KPIDefinition {
  kpiId: string;
  name: string;
  nameAr: string;
  formula: string;
  sourceFields: string[];
  aggregation: 'sum' | 'count' | 'average' | 'min' | 'max' | 'median' | 'custom';
  unit: string;
  format: string;
  target: number | null;
  thresholds: KPIThreshold[];
  category: string;
}

export interface KPIThreshold {
  label: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'between';
  value: number | [number, number];
  color: string;
  status: 'good' | 'warning' | 'critical';
}

export interface KPIDashboardBinding {
  kpiId: string;
  widgetType: 'card' | 'gauge' | 'chart' | 'table' | 'sparkline';
  position: { row: number; col: number; width: number; height: number };
  refreshPolicy: 'live' | 'on_demand' | 'scheduled';
}

// ─── Intent Parse Result ────────────────────────────────────────────────────

export interface IntentParseResult {
  parseId: string;
  originalPrompt: string;
  detectedIntent: DetectedIntent;
  tirPlan: TIRPlan;
  joinPlan: JoinPlan | null;
  kpiPlan: KPIPlan | null;
  confidence: number;
  warnings: string[];
  timestamp: string;
}

export type DetectedIntent =
  | 'summarize' | 'analyze' | 'transform' | 'pivot' | 'join'
  | 'calculate_kpi' | 'create_report' | 'create_dashboard'
  | 'filter' | 'sort' | 'group' | 'deduplicate' | 'format'
  | 'compare' | 'forecast' | 'validate' | 'custom';

// ─── Intent Parser Engine ───────────────────────────────────────────────────

export class IntentParser {
  /**
   * Parse a natural language prompt into a structured plan.
   * Uses keyword extraction and pattern matching for deterministic output.
   */
  parse(prompt: string, datasetContext: DatasetContext): IntentParseResult {
    const parseId = `intent-${crypto.randomUUID()}`;
    const normalizedPrompt = prompt.trim().toLowerCase();

    // Detect intent from keywords
    const detectedIntent = this.detectIntent(normalizedPrompt);
    const warnings: string[] = [];

    // Build T-IR plan
    const tirPlan = this.buildTIRPlan(normalizedPrompt, detectedIntent, datasetContext);

    // Build join plan if multiple sources detected
    const joinPlan = datasetContext.sheets.length > 1
      ? this.buildJoinPlan(normalizedPrompt, datasetContext)
      : null;

    // Build KPI plan if metrics/KPIs detected
    const kpiPlan = this.needsKPIPlan(normalizedPrompt)
      ? this.buildKPIPlan(normalizedPrompt, datasetContext)
      : null;

    // Calculate confidence
    const confidence = this.calculateConfidence(detectedIntent, tirPlan, datasetContext);

    if (confidence < 0.5) {
      warnings.push('Low confidence in intent detection. Review the generated plan carefully.');
    }

    return {
      parseId,
      originalPrompt: prompt,
      detectedIntent,
      tirPlan,
      joinPlan,
      kpiPlan,
      confidence,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Intent Detection ─────────────────────────────────────────────────

  private detectIntent(prompt: string): DetectedIntent {
    const intentKeywords: Array<[DetectedIntent, string[]]> = [
      ['summarize', ['summarize', 'summary', 'overview', 'ملخص', 'تلخيص']],
      ['analyze', ['analyze', 'analysis', 'تحليل', 'حلل']],
      ['pivot', ['pivot', 'pivot table', 'جدول محوري', 'محوري']],
      ['join', ['join', 'merge', 'combine', 'link', 'ربط', 'دمج']],
      ['calculate_kpi', ['kpi', 'metric', 'indicator', 'مؤشر', 'مقياس']],
      ['create_dashboard', ['dashboard', 'لوحة', 'داشبورد']],
      ['create_report', ['report', 'تقرير']],
      ['filter', ['filter', 'where', 'تصفية', 'فلتر']],
      ['sort', ['sort', 'order', 'rank', 'ترتيب', 'فرز']],
      ['group', ['group', 'group by', 'تجميع']],
      ['deduplicate', ['deduplicate', 'unique', 'distinct', 'إزالة التكرار']],
      ['format', ['format', 'style', 'تنسيق']],
      ['compare', ['compare', 'diff', 'مقارنة']],
      ['forecast', ['forecast', 'predict', 'trend', 'توقع', 'تنبؤ']],
      ['validate', ['validate', 'check', 'verify', 'تحقق']],
      ['transform', ['transform', 'convert', 'calculate', 'compute', 'تحويل', 'حساب']],
    ];

    for (const [intent, keywords] of intentKeywords) {
      if (keywords.some(kw => prompt.includes(kw))) {
        return intent;
      }
    }

    return 'custom';
  }

  // ─── T-IR Plan Builder ────────────────────────────────────────────────

  private buildTIRPlan(
    prompt: string,
    intent: DetectedIntent,
    context: DatasetContext
  ): TIRPlan {
    const planId = `tir-${crypto.randomUUID()}`;
    const transformations: TIRTransformation[] = [];
    const outputFields: TIRField[] = [];

    // Extract referenced fields from prompt
    const referencedFields = this.extractFieldReferences(prompt, context);

    // Generate transformations based on intent
    switch (intent) {
      case 'summarize':
      case 'analyze': {
        // Add aggregation transforms for numeric fields
        const numericFields = context.columns.filter(c => c.type === 'number');
        for (const field of numericFields) {
          transformations.push({
            transformId: `t-${crypto.randomUUID().slice(0, 8)}`,
            type: 'aggregate',
            sourceFields: [field.name],
            targetField: `${field.name}_summary`,
            parameters: { aggregations: ['sum', 'average', 'min', 'max', 'count'] },
            dependsOn: [],
            description: `Aggregate ${field.name}`,
          });
          outputFields.push({
            name: `${field.name}_summary`,
            type: 'number',
            format: field.format,
            source: field.name,
            computed: true,
          });
        }
        break;
      }

      case 'pivot': {
        const rowField = referencedFields[0] ?? context.columns.find(c => c.type === 'string')?.name ?? '';
        const valueField = referencedFields[1] ?? context.columns.find(c => c.type === 'number')?.name ?? '';
        transformations.push({
          transformId: `t-${crypto.randomUUID().slice(0, 8)}`,
          type: 'pivot',
          sourceFields: [rowField, valueField],
          targetField: 'pivot_result',
          parameters: { rowField, valueField, aggregation: 'sum' },
          dependsOn: [],
          description: `Pivot by ${rowField} with ${valueField}`,
        });
        break;
      }

      case 'filter': {
        const filterField = referencedFields[0] ?? context.columns[0]?.name ?? '';
        transformations.push({
          transformId: `t-${crypto.randomUUID().slice(0, 8)}`,
          type: 'filter',
          sourceFields: [filterField],
          targetField: filterField,
          parameters: { condition: 'not_null' },
          dependsOn: [],
          description: `Filter on ${filterField}`,
        });
        break;
      }

      case 'sort': {
        const sortField = referencedFields[0] ?? context.columns[0]?.name ?? '';
        transformations.push({
          transformId: `t-${crypto.randomUUID().slice(0, 8)}`,
          type: 'sort',
          sourceFields: [sortField],
          targetField: sortField,
          parameters: { direction: 'desc' },
          dependsOn: [],
          description: `Sort by ${sortField}`,
        });
        break;
      }

      case 'calculate_kpi': {
        // Generate calculation transforms for KPIs
        const numFields = context.columns.filter(c => c.type === 'number');
        for (const field of numFields.slice(0, 5)) {
          transformations.push({
            transformId: `t-${crypto.randomUUID().slice(0, 8)}`,
            type: 'calculate',
            sourceFields: [field.name],
            targetField: `kpi_${field.name}`,
            parameters: { formula: `SUM(${field.name})`, aggregation: 'sum' },
            dependsOn: [],
            description: `Calculate KPI for ${field.name}`,
          });
        }
        break;
      }

      default: {
        // Pass-through with select
        for (const col of context.columns) {
          transformations.push({
            transformId: `t-${crypto.randomUUID().slice(0, 8)}`,
            type: 'select',
            sourceFields: [col.name],
            targetField: col.name,
            parameters: {},
            dependsOn: [],
            description: `Select ${col.name}`,
          });
          outputFields.push({
            name: col.name,
            type: col.type as TIRField['type'],
            format: col.format,
            source: col.name,
            computed: false,
          });
        }
      }
    }

    return {
      planId,
      sourceDescription: `${context.sheets.length} sheet(s), ${context.totalRows} row(s), ${context.columns.length} column(s)`,
      transformations,
      outputSchema: {
        fields: outputFields,
        sortOrder: [],
        groupBy: [],
      },
      executionOrder: transformations.map(t => t.transformId),
      estimatedComplexity: transformations.length > 10 ? 'high' : transformations.length > 3 ? 'medium' : 'low',
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Join Plan Builder ────────────────────────────────────────────────

  private buildJoinPlan(prompt: string, context: DatasetContext): JoinPlan {
    const joins: JoinSpec[] = [];
    const sheets = context.sheets;

    // Detect common key fields between sheets
    for (let i = 0; i < sheets.length - 1; i++) {
      for (let j = i + 1; j < sheets.length; j++) {
        const commonKeys = this.findCommonKeys(sheets[i], sheets[j], context);
        if (commonKeys.length > 0) {
          joins.push({
            joinId: `join-${crypto.randomUUID().slice(0, 8)}`,
            joinType: 'left',
            leftSource: sheets[i],
            rightSource: sheets[j],
            leftKey: commonKeys,
            rightKey: commonKeys,
            outputFields: [], // All fields
            conflictResolution: 'coalesce',
          });
        }
      }
    }

    return {
      planId: `join-${crypto.randomUUID()}`,
      joins,
      sourceSheets: sheets,
      resultSchema: context.columns.map(c => ({
        name: c.name,
        type: c.type as TIRField['type'],
        format: c.format,
        source: c.sheet,
        computed: false,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  // ─── KPI Plan Builder ─────────────────────────────────────────────────

  private buildKPIPlan(prompt: string, context: DatasetContext): KPIPlan {
    const kpis: KPIDefinition[] = [];
    const bindings: KPIDashboardBinding[] = [];

    const numericCols = context.columns.filter(c => c.type === 'number');

    for (let i = 0; i < numericCols.length && i < 8; i++) {
      const col = numericCols[i];
      const kpiId = `kpi-${crypto.randomUUID().slice(0, 8)}`;

      kpis.push({
        kpiId,
        name: `Total ${col.name}`,
        nameAr: `إجمالي ${col.name}`,
        formula: `SUM(${col.name})`,
        sourceFields: [col.name],
        aggregation: 'sum',
        unit: col.format?.includes('%') ? '%' : col.format?.includes('$') ? 'USD' : '',
        format: col.format ?? '#,##0',
        target: null,
        thresholds: [
          { label: 'Good', operator: 'gte', value: 0, color: '#22c55e', status: 'good' },
          { label: 'Warning', operator: 'lt', value: 0, color: '#f59e0b', status: 'warning' },
        ],
        category: 'auto',
      });

      bindings.push({
        kpiId,
        widgetType: i < 4 ? 'card' : 'chart',
        position: { row: Math.floor(i / 4), col: i % 4, width: 1, height: 1 },
        refreshPolicy: 'on_demand',
      });
    }

    return {
      planId: `kpi-${crypto.randomUUID()}`,
      kpis,
      dashboardBindings: bindings,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private extractFieldReferences(prompt: string, context: DatasetContext): string[] {
    const fields: string[] = [];
    for (const col of context.columns) {
      if (prompt.includes(col.name.toLowerCase())) {
        fields.push(col.name);
      }
    }
    return fields;
  }

  private findCommonKeys(sheetA: string, sheetB: string, context: DatasetContext): string[] {
    const colsA = context.columns.filter(c => c.sheet === sheetA).map(c => c.name.toLowerCase());
    const colsB = context.columns.filter(c => c.sheet === sheetB).map(c => c.name.toLowerCase());
    const common = colsA.filter(c => colsB.includes(c));

    // Heuristic: ID fields are likely join keys
    return common.filter(c =>
      c.includes('id') || c.includes('code') || c.includes('key') ||
      c.includes('رقم') || c.includes('كود')
    );
  }

  private needsKPIPlan(prompt: string): boolean {
    const kpiKeywords = ['kpi', 'metric', 'indicator', 'dashboard', 'مؤشر', 'مقياس', 'لوحة'];
    return kpiKeywords.some(kw => prompt.includes(kw));
  }

  private calculateConfidence(
    intent: DetectedIntent,
    plan: TIRPlan,
    context: DatasetContext
  ): number {
    let confidence = 0.5;
    if (intent !== 'custom') confidence += 0.2;
    if (plan.transformations.length > 0) confidence += 0.1;
    if (context.columns.length > 0) confidence += 0.1;
    if (context.totalRows > 0) confidence += 0.1;
    return Math.min(confidence, 1.0);
  }
}

// ─── Context Types ──────────────────────────────────────────────────────────

export interface DatasetContext {
  sheets: string[];
  columns: DatasetColumn[];
  totalRows: number;
  sampleData: Array<Record<string, unknown>>;
}

export interface DatasetColumn {
  name: string;
  type: string;
  sheet: string;
  nullCount: number;
  uniqueCount: number;
  format: string | null;
}
