/**
 * Failure Reporting — Required outputs on failure
 *
 * Every failed STRICT run MUST produce:
 * - diff report
 * - root-cause classification
 * - repair attempt plan or hard-fail
 */

import type { DiffRef, Warning } from '../cdr/types';

// ─── Root Cause Classification ────────────────────────────────────────
export type RootCauseClassification =
  | 'FONT_DIVERGENCE'
  | 'GEOMETRY_DRIFT'
  | 'TEXT_BASELINE_SHIFT'
  | 'TABLE_GRID_MISMATCH'
  | 'CHART_DATA_MISMATCH'
  | 'RENDER_NONDETERMINISM'
  | 'EXPORT_CORRUPTION'
  | 'HIERARCHY_CORRUPTION'
  | 'CLIPPING_OVERFLOW_DIVERGENCE'
  | 'COLOR_SPACE_MISMATCH'
  | 'ARABIC_SHAPING_DIVERGENCE'
  | 'SMART_ART_GEOMETRY_LOSS'
  | 'CONDITIONAL_FORMAT_LOSS'
  | 'FREEZE_PANE_MISMATCH'
  | 'PIVOT_GEOMETRY_LOSS'
  | 'UNKNOWN';

// ─── Repair Step ──────────────────────────────────────────────────────
export interface RepairStep {
  fix_type: string;
  target_elements: string[];
  description: string;
  params: Record<string, unknown>;
  estimated_impact: 'high' | 'medium' | 'low';
}

// ─── Repair Plan ──────────────────────────────────────────────────────
export interface RepairAttemptPlan {
  steps: RepairStep[];
  estimated_iterations: number;
  confidence: number;
  is_hard_fail: boolean;
}

// ─── Failure Report ───────────────────────────────────────────────────
export interface FailureReport {
  run_id: string;
  timestamp: string;
  stage: string;
  diff_report?: DiffRef;
  root_cause_classification: RootCauseClassification;
  repair_attempt_plan: RepairAttemptPlan;
  repair_result?: 'success' | 'exhausted' | 'hard_fail';
  action_graph_snapshot?: string;
  violations: string[];
  evidence_refs: string[];
}

// ─── Root Cause Analyzer ──────────────────────────────────────────────

interface AnalysisContext {
  violations: string[];
  diffReport?: DiffRef;
  stage: string;
}

function analyzeViolationPatterns(ctx: AnalysisContext): RootCauseClassification {
  const combined = ctx.violations.join(' ').toLowerCase();

  // Pattern matching against known root causes — ordered by specificity
  if (combined.includes('font') && (combined.includes('missing') || combined.includes('substitut') || combined.includes('diverge'))) {
    return 'FONT_DIVERGENCE';
  }
  if (combined.includes('arabic') && (combined.includes('shaping') || combined.includes('bidi') || combined.includes('rtl'))) {
    return 'ARABIC_SHAPING_DIVERGENCE';
  }
  if (combined.includes('baseline') || combined.includes('line-height') || combined.includes('line_height')) {
    return 'TEXT_BASELINE_SHIFT';
  }
  if (combined.includes('table') && (combined.includes('grid') || combined.includes('cell') || combined.includes('column'))) {
    return 'TABLE_GRID_MISMATCH';
  }
  if (combined.includes('chart') && (combined.includes('data') || combined.includes('axis') || combined.includes('legend'))) {
    return 'CHART_DATA_MISMATCH';
  }
  if (combined.includes('determinism') || combined.includes('nondetermin') || combined.includes('rerun')) {
    return 'RENDER_NONDETERMINISM';
  }
  if (combined.includes('hierarchy') || combined.includes('nesting') || combined.includes('grouping')) {
    return 'HIERARCHY_CORRUPTION';
  }
  if (combined.includes('geometry') || combined.includes('position') || combined.includes('bbox') || combined.includes('emu')) {
    return 'GEOMETRY_DRIFT';
  }
  if (combined.includes('clipping') || combined.includes('overflow') || combined.includes('mask')) {
    return 'CLIPPING_OVERFLOW_DIVERGENCE';
  }
  if (combined.includes('color') && (combined.includes('space') || combined.includes('profile'))) {
    return 'COLOR_SPACE_MISMATCH';
  }
  if (combined.includes('smart') && combined.includes('art')) {
    return 'SMART_ART_GEOMETRY_LOSS';
  }
  if (combined.includes('conditional') && combined.includes('format')) {
    return 'CONDITIONAL_FORMAT_LOSS';
  }
  if (combined.includes('freeze') && combined.includes('pane')) {
    return 'FREEZE_PANE_MISMATCH';
  }
  if (combined.includes('pivot')) {
    return 'PIVOT_GEOMETRY_LOSS';
  }
  if (combined.includes('export') || combined.includes('corrupt')) {
    return 'EXPORT_CORRUPTION';
  }

  // If diff report has high pixel divergence, likely geometry drift
  if (ctx.diffReport && ctx.diffReport.pixel_diff > 0.1) {
    return 'GEOMETRY_DRIFT';
  }

  return 'UNKNOWN';
}

function generateRepairSteps(rootCause: RootCauseClassification): RepairStep[] {
  switch (rootCause) {
    case 'FONT_DIVERGENCE':
      return [
        { fix_type: 'font_re_embed', target_elements: ['*'], description: 'Re-embed all fonts with full glyph vectorization', params: { embed_all_glyphs: true }, estimated_impact: 'high' },
        { fix_type: 'glyph_outline_reconstruct', target_elements: ['*'], description: 'Reconstruct glyph outlines from source renders', params: {}, estimated_impact: 'high' },
      ];
    case 'GEOMETRY_DRIFT':
      return [
        { fix_type: 'quantize_geometry', target_elements: ['*'], description: 'Snap all positions to EMU grid (snap=8)', params: { emu_snap: 8 }, estimated_impact: 'high' },
        { fix_type: 'bbox_recalculate', target_elements: ['*'], description: 'Recalculate bounding boxes from content', params: {}, estimated_impact: 'medium' },
      ];
    case 'TEXT_BASELINE_SHIFT':
      return [
        { fix_type: 'adjust_text_metrics', target_elements: ['text'], description: 'Snap baselines to DPI pixel grid', params: { dpi: 300 }, estimated_impact: 'high' },
        { fix_type: 'line_height_absolute', target_elements: ['text'], description: 'Convert relative line-height to absolute EMU', params: {}, estimated_impact: 'medium' },
        { fix_type: 'kerning_refine', target_elements: ['text'], description: 'Refine kerning and letter-spacing', params: {}, estimated_impact: 'low' },
      ];
    case 'TABLE_GRID_MISMATCH':
      return [
        { fix_type: 'table_grid_refine', target_elements: ['table'], description: 'Recalculate row heights and column widths from cell content', params: {}, estimated_impact: 'high' },
        { fix_type: 'cell_style_sync', target_elements: ['table'], description: 'Synchronize cell styles with CDR', params: {}, estimated_impact: 'medium' },
      ];
    case 'CHART_DATA_MISMATCH':
      return [
        { fix_type: 'chart_inverse_reconstruct', target_elements: ['chart'], description: 'Inverse-reconstruct chart data from rendered pixels', params: {}, estimated_impact: 'high' },
        { fix_type: 'axis_spacing_fix', target_elements: ['chart'], description: 'Fix axis spacing, tick marks, and grid lines', params: {}, estimated_impact: 'medium' },
        { fix_type: 'legend_offset_fix', target_elements: ['chart'], description: 'Fix legend position and offset', params: {}, estimated_impact: 'low' },
      ];
    case 'RENDER_NONDETERMINISM':
      return []; // Hard fail — no repair possible
    case 'HIERARCHY_CORRUPTION':
      return [
        { fix_type: 'rebuild_hierarchy', target_elements: ['*'], description: 'Rebuild element tree from source extraction', params: {}, estimated_impact: 'high' },
      ];
    case 'CLIPPING_OVERFLOW_DIVERGENCE':
      return [
        { fix_type: 'clip_path_recalculate', target_elements: ['*'], description: 'Recalculate clipping paths from source', params: {}, estimated_impact: 'medium' },
      ];
    case 'ARABIC_SHAPING_DIVERGENCE':
      return [
        { fix_type: 'reshaping_elite', target_elements: ['text'], description: 'Rerun Arabic ELITE shaping with pinned HarfBuzz', params: { mode: 'ELITE' }, estimated_impact: 'high' },
        { fix_type: 'bidi_reorder', target_elements: ['text'], description: 'Reorder bidi runs', params: {}, estimated_impact: 'medium' },
      ];
    case 'SMART_ART_GEOMETRY_LOSS':
      return [
        { fix_type: 'smart_art_decompose', target_elements: ['*'], description: 'Decompose SmartArt to primitive shapes with exact geometry', params: {}, estimated_impact: 'high' },
      ];
    case 'CONDITIONAL_FORMAT_LOSS':
      return [
        { fix_type: 'conditional_format_rebuild', target_elements: ['*'], description: 'Rebuild conditional formatting rules from source', params: {}, estimated_impact: 'medium' },
      ];
    case 'FREEZE_PANE_MISMATCH':
      return [
        { fix_type: 'freeze_pane_restore', target_elements: ['*'], description: 'Restore freeze pane settings from source', params: {}, estimated_impact: 'low' },
      ];
    case 'PIVOT_GEOMETRY_LOSS':
      return [
        { fix_type: 'pivot_geometry_restore', target_elements: ['*'], description: 'Restore pivot table geometry from source', params: {}, estimated_impact: 'medium' },
      ];
    default:
      return [
        { fix_type: 'full_repair_loop', target_elements: ['*'], description: 'Run full repair loop: quantize → text → kerning → stroke → crop → path → table → chart', params: { max_iterations: 50 }, estimated_impact: 'high' },
      ];
  }
}

function isHardFail(rootCause: RootCauseClassification): boolean {
  const hardFailCauses: RootCauseClassification[] = [
    'RENDER_NONDETERMINISM',
    'EXPORT_CORRUPTION',
  ];
  return hardFailCauses.includes(rootCause);
}

// ─── Failure Report Builder ───────────────────────────────────────────

export class FailureReportBuilder {
  private runId: string = '';
  private stage: string = '';
  private diffReport?: DiffRef;
  private violations: string[] = [];
  private evidenceRefs: string[] = [];
  private actionGraphSnapshot?: string;

  setRunId(id: string): this {
    this.runId = id;
    return this;
  }

  setStage(stage: string): this {
    this.stage = stage;
    return this;
  }

  setDiffReport(diff: DiffRef): this {
    this.diffReport = diff;
    return this;
  }

  addViolations(violations: string[]): this {
    this.violations.push(...violations);
    return this;
  }

  addEvidenceRef(ref: string): this {
    this.evidenceRefs.push(ref);
    return this;
  }

  setActionGraphSnapshot(snapshot: string): this {
    this.actionGraphSnapshot = snapshot;
    return this;
  }

  classifyRootCause(): RootCauseClassification {
    return analyzeViolationPatterns({
      violations: this.violations,
      diffReport: this.diffReport,
      stage: this.stage,
    });
  }

  generateRepairPlan(rootCause: RootCauseClassification): RepairAttemptPlan {
    const hardFail = isHardFail(rootCause);
    const steps = hardFail ? [] : generateRepairSteps(rootCause);
    const estimatedIterations = hardFail ? 0 : Math.min(50, steps.length * 10);
    const confidence = hardFail ? 0 : (rootCause === 'UNKNOWN' ? 0.3 : 0.7);

    return {
      steps,
      estimated_iterations: estimatedIterations,
      confidence,
      is_hard_fail: hardFail,
    };
  }

  build(): FailureReport {
    const rootCause = this.classifyRootCause();
    const repairPlan = this.generateRepairPlan(rootCause);

    return {
      run_id: this.runId,
      timestamp: new Date().toISOString(),
      stage: this.stage,
      diff_report: this.diffReport,
      root_cause_classification: rootCause,
      repair_attempt_plan: repairPlan,
      violations: this.violations,
      evidence_refs: this.evidenceRefs,
      action_graph_snapshot: this.actionGraphSnapshot,
    };
  }

  /**
   * Build a minimal failure report for a specific breach.
   */
  static fromBreach(
    runId: string,
    stage: string,
    violations: string[],
    diffReport?: DiffRef,
  ): FailureReport {
    return new FailureReportBuilder()
      .setRunId(runId)
      .setStage(stage)
      .addViolations(violations)
      .setDiffReport(diffReport ?? { diff_id: 'none', pixel_diff: -1, pass: false })
      .build();
  }
}
