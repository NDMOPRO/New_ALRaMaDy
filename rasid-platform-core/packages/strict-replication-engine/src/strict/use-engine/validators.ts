/**
 * USE Engine — Universal Strict Equivalence Validators
 * Cross-format validation ensuring pixel-perfect fidelity across all conversions.
 *
 * Validators:
 *   1. ImageToDashboardValidator   — image → dashboard
 *   2. ScreenshotToPptValidator    — screenshot → PPT
 *   3. PdfToBiValidator            — PDF → BI/dashboard
 *   4. ExcelToDashboardValidator   — Excel → dashboard
 *   5. DashboardToPptValidator     — dashboard → PPT
 *   6. CrossFormatRoundTripValidator — round-trip fidelity (A→B→A)
 *
 * USEEngine orchestrates validator selection and execution.
 */

import type {
  ArtifactRef,
  ExportKind,
  Warning,
  DiffRef,
  HashBundle,
  CdrDesign,
  CdrData,
  CdrElement,
  CdrPage,
  RenderRef,
} from '../cdr/types';

// ─── Format Types ───────────────────────────────────────────────────

export type SourceFormat =
  | 'image'
  | 'screenshot'
  | 'pdf'
  | 'xlsx'
  | 'dashboard'
  | 'pptx'
  | 'docx'
  | 'png'
  | 'json';

export type TargetFormat =
  | 'dashboard'
  | 'pptx'
  | 'xlsx'
  | 'pdf'
  | 'docx'
  | 'png'
  | 'json';

export type FormatPair = {
  source: SourceFormat;
  target: TargetFormat;
};

// ─── Structural Checks ─────────────────────────────────────────────

export interface StructuralChecks {
  /** All text elements remain editable (not rasterized). */
  text_editable: boolean;
  /** Tables are structured with rows/columns (not images). */
  tables_structured: boolean;
  /** Charts are data-bound (not static images). */
  charts_bound: boolean;
  /** Element hierarchy (layers, groups, z-order) preserved. */
  hierarchy_preserved: boolean;
  /** All elements remain editable in the target format. */
  editability_preserved: boolean;
}

// ─── Visual Checks ──────────────────────────────────────────────────

export interface VisualChecks {
  /** Reference to the pixel diff report between source and target renders. */
  pixel_diff_ref: DiffRef | null;
  /** Whether deterministic rendering was verified (same input -> same output). */
  determinism_verified: boolean;
  /** Whether the rendered output matches the source within tolerance. */
  render_match: boolean;
}

// ─── USEValidationResult ────────────────────────────────────────────

export interface USEValidationResult {
  pass: boolean;
  validator_name: string;
  source_format: SourceFormat;
  target_format: TargetFormat;
  structural_checks: StructuralChecks;
  visual_checks: VisualChecks;
  violations: string[];
  warnings: Warning[];
}

// ─── Validator Context ──────────────────────────────────────────────

export interface ValidatorContext {
  sourceRef: ArtifactRef;
  targetRef: ArtifactRef;
  sourceCdr?: CdrDesign;
  targetCdr?: CdrDesign;
  sourceCdrData?: CdrData;
  targetCdrData?: CdrData;
  sourceRender?: RenderRef;
  targetRender?: RenderRef;
  pixelDiff?: DiffRef;
  sourceHashes?: HashBundle;
  targetHashes?: HashBundle;
}

// ─── Abstract Validator ─────────────────────────────────────────────

export abstract class USEValidator {
  abstract readonly name: string;
  abstract readonly formatPair: FormatPair;

  abstract validate(ctx: ValidatorContext): Promise<USEValidationResult>;

  /** Check whether every text element in the CDR is truly text (not image). */
  protected checkTextEditable(design: CdrDesign): boolean {
    const textElements = this.collectElementsByKind(design, 'text');
    if (textElements.length === 0) {
      return true; // no text to validate — vacuously true
    }
    for (const el of textElements) {
      if (!el.text || el.text.text.length === 0) {
        return false;
      }
      if (el.text.runs.length === 0) {
        return false; // text without runs is not properly editable
      }
    }
    return true;
  }

  /** Check whether tables are structured (rows, cols, cells) not rasterized. */
  protected checkTablesStructured(design: CdrDesign): boolean {
    const tableElements = this.collectElementsByKind(design, 'table');
    for (const el of tableElements) {
      if (!el.table) return false;
      if (el.table.grid.rows === 0 || el.table.grid.cols === 0) return false;
      if (el.table.cells.length === 0) return false;
      if (el.table.grid.row_heights_emu.length !== el.table.grid.rows) return false;
      if (el.table.grid.col_widths_emu.length !== el.table.grid.cols) return false;
    }
    return true;
  }

  /** Check whether charts are bound to data tables. */
  protected checkChartsBound(design: CdrDesign, data?: CdrData): boolean {
    const chartElements = this.collectElementsByKind(design, 'chart');
    if (chartElements.length === 0) return true;

    const tableIds = new Set(data?.tables.map(t => t.table_id) ?? []);

    for (const el of chartElements) {
      if (!el.chart) return false;
      if (!el.chart.data_binding) return false;
      if (!el.chart.data_binding.table_id) return false;
      // Verify the binding references an actual table if data is present
      if (data && !tableIds.has(el.chart.data_binding.table_id)) {
        return false;
      }
    }
    return true;
  }

  /** Check whether element hierarchy (z-order, layers, groups) is preserved. */
  protected checkHierarchyPreserved(source: CdrDesign | undefined, target: CdrDesign): boolean {
    if (!source) return true; // no source CDR to compare against

    // Verify page count matches
    if (source.pages.length !== target.pages.length) return false;

    for (let i = 0; i < source.pages.length; i++) {
      const srcPage = source.pages[i];
      const tgtPage = target.pages[i];

      // Verify layer count matches
      if (srcPage.layers.length !== tgtPage.layers.length) return false;

      for (let j = 0; j < srcPage.layers.length; j++) {
        const srcLayer = srcPage.layers[j];
        const tgtLayer = tgtPage.layers[j];

        // Verify z-index ordering preserved
        if (srcLayer.z_index !== tgtLayer.z_index) return false;

        // Verify element count at top level matches
        if (srcLayer.elements.length !== tgtLayer.elements.length) return false;

        // Verify z-order of elements is preserved
        for (let k = 0; k < srcLayer.elements.length; k++) {
          if (srcLayer.elements[k].z_index !== tgtLayer.elements[k].z_index) return false;
        }
      }
    }
    return true;
  }

  /** Check editability — no full-page rasterization. */
  protected checkEditabilityPreserved(design: CdrDesign): boolean {
    for (const page of design.pages) {
      const elements = this.flattenPageElements(page);
      // A single full-page image means the content was rasterized
      if (elements.length === 1 && elements[0].kind === 'image') {
        const el = elements[0];
        const wRatio = el.bbox_emu.w / page.size_emu.w;
        const hRatio = el.bbox_emu.h / page.size_emu.h;
        if (wRatio > 0.95 && hRatio > 0.95) {
          return false;
        }
      }
    }
    return true;
  }

  /** Validate visual checks from a pixel diff. */
  protected buildVisualChecks(pixelDiff?: DiffRef, sourceHashes?: HashBundle, targetHashes?: HashBundle): VisualChecks {
    const renderMatch = pixelDiff ? (pixelDiff.pass && pixelDiff.pixel_diff === 0) : false;

    let determinismVerified = false;
    if (sourceHashes && targetHashes) {
      // Determinism: structural + layout hashes must be consistent
      determinismVerified =
        sourceHashes.structural_hash === targetHashes.structural_hash &&
        sourceHashes.layout_hash === targetHashes.layout_hash;
    }

    return {
      pixel_diff_ref: pixelDiff ?? null,
      determinism_verified: determinismVerified,
      render_match: renderMatch,
    };
  }

  /** Build full structural checks for the target. */
  protected buildStructuralChecks(
    targetCdr: CdrDesign,
    targetData?: CdrData,
    sourceCdr?: CdrDesign,
  ): StructuralChecks {
    return {
      text_editable: this.checkTextEditable(targetCdr),
      tables_structured: this.checkTablesStructured(targetCdr),
      charts_bound: this.checkChartsBound(targetCdr, targetData),
      hierarchy_preserved: this.checkHierarchyPreserved(sourceCdr, targetCdr),
      editability_preserved: this.checkEditabilityPreserved(targetCdr),
    };
  }

  /** Create a result shell pre-populated with the validator metadata. */
  protected createResult(
    pass: boolean,
    structural: StructuralChecks,
    visual: VisualChecks,
    violations: string[],
    warnings: Warning[],
  ): USEValidationResult {
    return {
      pass,
      validator_name: this.name,
      source_format: this.formatPair.source,
      target_format: this.formatPair.target,
      structural_checks: structural,
      visual_checks: visual,
      violations,
      warnings,
    };
  }

  // ─── CDR traversal helpers ──────────────────────────────────────

  protected collectElementsByKind(design: CdrDesign, kind: string): CdrElement[] {
    const result: CdrElement[] = [];
    for (const page of design.pages) {
      for (const layer of page.layers) {
        this.gatherByKind(layer.elements, kind, result);
      }
    }
    return result;
  }

  private gatherByKind(elements: CdrElement[], kind: string, out: CdrElement[]): void {
    for (const el of elements) {
      if (el.kind === kind) out.push(el);
      if (el.children) this.gatherByKind(el.children, kind, out);
    }
  }

  protected flattenPageElements(page: CdrPage): CdrElement[] {
    const result: CdrElement[] = [];
    for (const layer of page.layers) {
      for (const el of layer.elements) {
        result.push(el);
        if (el.children) this.flattenChildren(el.children, result);
      }
    }
    return result;
  }

  private flattenChildren(children: CdrElement[], out: CdrElement[]): void {
    for (const el of children) {
      out.push(el);
      if (el.children) this.flattenChildren(el.children, out);
    }
  }

  protected hasElementKind(design: CdrDesign, kind: string): boolean {
    return this.collectElementsByKind(design, kind).length > 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1. ImageToDashboardValidator
// ═══════════════════════════════════════════════════════════════════

export class ImageToDashboardValidator extends USEValidator {
  readonly name = 'ImageToDashboardValidator';
  readonly formatPair: FormatPair = { source: 'image', target: 'dashboard' };

  async validate(ctx: ValidatorContext): Promise<USEValidationResult> {
    const violations: string[] = [];
    const warnings: Warning[] = [];

    if (!ctx.targetCdr) {
      violations.push('Target CDR design is required for image-to-dashboard validation');
      return this.createResult(
        false,
        { text_editable: false, tables_structured: false, charts_bound: false, hierarchy_preserved: false, editability_preserved: false },
        this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes),
        violations,
        warnings,
      );
    }

    const structural = this.buildStructuralChecks(ctx.targetCdr, ctx.targetCdrData);
    const visual = this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes);

    // Dashboard must have at least one chart or table
    const hasCharts = this.hasElementKind(ctx.targetCdr, 'chart');
    const hasTables = this.hasElementKind(ctx.targetCdr, 'table');
    if (!hasCharts && !hasTables) {
      violations.push('Dashboard must contain at least one chart or table element');
    }

    // Data binding check
    if (!ctx.targetCdrData || ctx.targetCdrData.tables.length === 0) {
      warnings.push({
        code: 'USE_NO_DATA_BINDING',
        message: 'Dashboard has no data tables — synthetic binding applied',
        severity: 'warning',
      });
    }

    if (!visual.render_match) {
      violations.push(
        `Pixel diff failed: diff=${ctx.pixelDiff?.pixel_diff ?? 'N/A'}, required=0`,
      );
    }

    if (!structural.text_editable) {
      violations.push('Text elements are not editable in the dashboard output');
    }

    if (!structural.charts_bound) {
      violations.push('One or more charts are not data-bound');
    }

    const pass = violations.length === 0 && visual.render_match;
    return this.createResult(pass, structural, visual, violations, warnings);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. ScreenshotToPptValidator
// ═══════════════════════════════════════════════════════════════════

export class ScreenshotToPptValidator extends USEValidator {
  readonly name = 'ScreenshotToPptValidator';
  readonly formatPair: FormatPair = { source: 'screenshot', target: 'pptx' };

  async validate(ctx: ValidatorContext): Promise<USEValidationResult> {
    const violations: string[] = [];
    const warnings: Warning[] = [];

    if (!ctx.targetCdr) {
      violations.push('Target CDR design is required for screenshot-to-PPT validation');
      return this.createResult(
        false,
        { text_editable: false, tables_structured: false, charts_bound: false, hierarchy_preserved: false, editability_preserved: false },
        this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes),
        violations,
        warnings,
      );
    }

    const structural = this.buildStructuralChecks(ctx.targetCdr, ctx.targetCdrData, ctx.sourceCdr);
    const visual = this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes);

    // PPT must have editable text
    if (!structural.text_editable) {
      warnings.push({
        code: 'USE_NO_EDITABLE_TEXT',
        message: 'PPT output has no editable text elements — may be fully rasterized',
        severity: 'warning',
      });
    }

    // Reject full-page rasterization
    if (!structural.editability_preserved) {
      violations.push('Page contains a single full-page image — violates editability requirement');
    }

    if (!visual.render_match) {
      violations.push(
        `Pixel diff failed: diff=${ctx.pixelDiff?.pixel_diff ?? 'N/A'}, required=0`,
      );
    }

    // Tables should be structured, not image snapshots
    if (!structural.tables_structured) {
      violations.push('Tables in PPT output are not properly structured');
    }

    const pass = violations.length === 0 && visual.render_match;
    return this.createResult(pass, structural, visual, violations, warnings);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. PdfToBiValidator
// ═══════════════════════════════════════════════════════════════════

export class PdfToBiValidator extends USEValidator {
  readonly name = 'PdfToBiValidator';
  readonly formatPair: FormatPair = { source: 'pdf', target: 'dashboard' };

  async validate(ctx: ValidatorContext): Promise<USEValidationResult> {
    const violations: string[] = [];
    const warnings: Warning[] = [];

    if (!ctx.targetCdr) {
      violations.push('Target CDR design is required for PDF-to-BI validation');
      return this.createResult(
        false,
        { text_editable: false, tables_structured: false, charts_bound: false, hierarchy_preserved: false, editability_preserved: false },
        this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes),
        violations,
        warnings,
      );
    }

    const structural = this.buildStructuralChecks(ctx.targetCdr, ctx.targetCdrData, ctx.sourceCdr);
    const visual = this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes);

    // BI output must have extractable data
    if (!ctx.targetCdrData || ctx.targetCdrData.tables.length === 0) {
      violations.push('BI output must have extractable data tables from PDF');
    } else {
      // Verify each extracted table has columns
      for (const table of ctx.targetCdrData.tables) {
        if (table.columns.length === 0) {
          violations.push(`Table ${table.table_id} has no columns — data extraction incomplete`);
        }
        // Verify column fingerprints are present for integrity
        for (const col of table.columns) {
          if (!col.fingerprint) {
            warnings.push({
              code: 'USE_MISSING_COL_FINGERPRINT',
              message: `Column "${col.name}" in table ${table.table_id} is missing fingerprint`,
              severity: 'warning',
            });
          }
        }
      }
    }

    // Charts must be data-bound
    if (!structural.charts_bound) {
      violations.push('Charts in BI output must be bound to extracted data tables');
    }

    if (!visual.render_match) {
      violations.push(
        `Pixel diff failed: diff=${ctx.pixelDiff?.pixel_diff ?? 'N/A'}, required=0`,
      );
    }

    // Text must remain editable (not just a PDF screenshot)
    if (!structural.text_editable) {
      violations.push('Text extracted from PDF is not editable in BI output');
    }

    const pass = violations.length === 0 && visual.render_match;
    return this.createResult(pass, structural, visual, violations, warnings);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. ExcelToDashboardValidator
// ═══════════════════════════════════════════════════════════════════

export class ExcelToDashboardValidator extends USEValidator {
  readonly name = 'ExcelToDashboardValidator';
  readonly formatPair: FormatPair = { source: 'xlsx', target: 'dashboard' };

  async validate(ctx: ValidatorContext): Promise<USEValidationResult> {
    const violations: string[] = [];
    const warnings: Warning[] = [];

    if (!ctx.targetCdr) {
      violations.push('Target CDR design is required for Excel-to-dashboard validation');
      return this.createResult(
        false,
        { text_editable: false, tables_structured: false, charts_bound: false, hierarchy_preserved: false, editability_preserved: false },
        this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes),
        violations,
        warnings,
      );
    }

    const structural = this.buildStructuralChecks(ctx.targetCdr, ctx.targetCdrData, ctx.sourceCdr);
    const visual = this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes);

    // Dashboard must preserve Excel data tables
    if (!ctx.targetCdrData || ctx.targetCdrData.tables.length === 0) {
      violations.push('Dashboard must preserve Excel data tables');
    } else {
      // Verify lineage reference is maintained
      if (!ctx.targetCdrData.lineage_ref) {
        warnings.push({
          code: 'USE_MISSING_LINEAGE',
          message: 'Dashboard CDR data is missing lineage reference to source Excel',
          severity: 'warning',
        });
      }
    }

    // Charts must be data-bound to actual tables
    if (!structural.charts_bound) {
      const unboundCharts = this.collectElementsByKind(ctx.targetCdr, 'chart')
        .filter(el => !el.chart?.data_binding?.table_id);
      for (const chart of unboundCharts) {
        violations.push(`Chart ${chart.element_id} is not data-bound to a table`);
      }
    }

    // Tables must be structured
    if (!structural.tables_structured) {
      violations.push('Excel tables were not preserved as structured tables in the dashboard');
    }

    if (!visual.render_match) {
      violations.push(
        `Pixel diff failed: diff=${ctx.pixelDiff?.pixel_diff ?? 'N/A'}, required=0`,
      );
    }

    const pass = violations.length === 0 && visual.render_match;
    return this.createResult(pass, structural, visual, violations, warnings);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. DashboardToPptValidator
// ═══════════════════════════════════════════════════════════════════

export class DashboardToPptValidator extends USEValidator {
  readonly name = 'DashboardToPptValidator';
  readonly formatPair: FormatPair = { source: 'dashboard', target: 'pptx' };

  async validate(ctx: ValidatorContext): Promise<USEValidationResult> {
    const violations: string[] = [];
    const warnings: Warning[] = [];

    if (!ctx.targetCdr) {
      violations.push('Target CDR design is required for dashboard-to-PPT validation');
      return this.createResult(
        false,
        { text_editable: false, tables_structured: false, charts_bound: false, hierarchy_preserved: false, editability_preserved: false },
        this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes),
        violations,
        warnings,
      );
    }

    const structural = this.buildStructuralChecks(ctx.targetCdr, ctx.targetCdrData, ctx.sourceCdr);
    const visual = this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes);

    // PPT must preserve charts as editable chart objects (not rasterized)
    const chartElements = this.collectElementsByKind(ctx.targetCdr, 'chart');
    if (chartElements.length === 0 && ctx.sourceCdr && this.hasElementKind(ctx.sourceCdr, 'chart')) {
      warnings.push({
        code: 'USE_NO_CHARTS_IN_PPT',
        message: 'PPT has no chart objects — dashboard charts may have been rasterized',
        severity: 'warning',
      });
    }

    // Each chart must retain its data binding
    for (const chart of chartElements) {
      if (!chart.chart?.data_binding) {
        violations.push(`Chart ${chart.element_id} lost data binding during conversion`);
      }
    }

    // Editability must be preserved
    if (!structural.editability_preserved) {
      violations.push('PPT output contains rasterized full-page images — editability lost');
    }

    // Hierarchy must be preserved
    if (!structural.hierarchy_preserved) {
      warnings.push({
        code: 'USE_HIERARCHY_DRIFT',
        message: 'Element hierarchy differs between source dashboard and target PPT',
        severity: 'warning',
      });
    }

    if (!visual.render_match) {
      violations.push(
        `Pixel diff failed: diff=${ctx.pixelDiff?.pixel_diff ?? 'N/A'}, required=0`,
      );
    }

    const pass = violations.length === 0 && visual.render_match;
    return this.createResult(pass, structural, visual, violations, warnings);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. CrossFormatRoundTripValidator
// ═══════════════════════════════════════════════════════════════════

export interface RoundTripContext {
  /** The original artifact before any conversion. */
  originalRef: ArtifactRef;
  /** The artifact after A→B→A round-trip. */
  roundTripRef: ArtifactRef;
  /** Format of the original artifact. */
  format1: SourceFormat;
  /** Intermediate format used in the round-trip. */
  format2: TargetFormat;
  /** Hashes of the original artifact render. */
  originalHashes: HashBundle;
  /** Hashes of the round-tripped artifact render. */
  roundTripHashes: HashBundle;
  /** Optional pixel diff between original and round-tripped renders. */
  pixelDiff?: DiffRef;
  /** CDR of the original. */
  originalCdr?: CdrDesign;
  /** CDR of the round-tripped output. */
  roundTripCdr?: CdrDesign;
  /** CDR data of the original. */
  originalCdrData?: CdrData;
  /** CDR data of the round-tripped output. */
  roundTripCdrData?: CdrData;
}

export class CrossFormatRoundTripValidator extends USEValidator {
  readonly name = 'CrossFormatRoundTripValidator';
  readonly formatPair: FormatPair = { source: 'image', target: 'image' }; // placeholder; actual formats are per-call

  async validate(ctx: ValidatorContext): Promise<USEValidationResult> {
    // For the generic validate interface, delegate to validateRoundTrip with defaults
    const violations: string[] = [];
    const warnings: Warning[] = [];

    if (!ctx.sourceHashes || !ctx.targetHashes) {
      violations.push('Round-trip validation requires source and target hash bundles');
      return this.createResult(
        false,
        { text_editable: false, tables_structured: false, charts_bound: false, hierarchy_preserved: false, editability_preserved: false },
        this.buildVisualChecks(ctx.pixelDiff, ctx.sourceHashes, ctx.targetHashes),
        violations,
        warnings,
      );
    }

    return this.performRoundTripValidation(
      ctx.sourceRef,
      ctx.targetRef,
      this.formatPair.source,
      this.formatPair.target,
      ctx.sourceHashes,
      ctx.targetHashes,
      ctx.pixelDiff,
      ctx.sourceCdr,
      ctx.targetCdr,
      ctx.sourceCdrData,
      ctx.targetCdrData,
    );
  }

  /** Full round-trip validation with explicit context. */
  async validateRoundTrip(rtCtx: RoundTripContext): Promise<USEValidationResult> {
    return this.performRoundTripValidation(
      rtCtx.originalRef,
      rtCtx.roundTripRef,
      rtCtx.format1,
      rtCtx.format2,
      rtCtx.originalHashes,
      rtCtx.roundTripHashes,
      rtCtx.pixelDiff,
      rtCtx.originalCdr,
      rtCtx.roundTripCdr,
      rtCtx.originalCdrData,
      rtCtx.roundTripCdrData,
    );
  }

  private async performRoundTripValidation(
    sourceRef: ArtifactRef,
    targetRef: ArtifactRef,
    format1: SourceFormat,
    format2: TargetFormat,
    originalHashes: HashBundle,
    roundTripHashes: HashBundle,
    pixelDiff?: DiffRef,
    originalCdr?: CdrDesign,
    roundTripCdr?: CdrDesign,
    originalCdrData?: CdrData,
    roundTripCdrData?: CdrData,
  ): Promise<USEValidationResult> {
    const violations: string[] = [];
    const warnings: Warning[] = [];

    // Compare all hash dimensions
    if (originalHashes.layout_hash !== roundTripHashes.layout_hash) {
      violations.push(
        `Layout hash diverged: original=${originalHashes.layout_hash}, round-trip=${roundTripHashes.layout_hash}`,
      );
    }

    if (originalHashes.structural_hash !== roundTripHashes.structural_hash) {
      violations.push(
        `Structural hash diverged: original=${originalHashes.structural_hash}, round-trip=${roundTripHashes.structural_hash}`,
      );
    }

    if (originalHashes.typography_hash !== roundTripHashes.typography_hash) {
      violations.push(
        `Typography hash diverged: original=${originalHashes.typography_hash}, round-trip=${roundTripHashes.typography_hash}`,
      );
    }

    if (originalHashes.pixel_hash !== roundTripHashes.pixel_hash) {
      violations.push(
        `Pixel hash diverged: original=${originalHashes.pixel_hash}, round-trip=${roundTripHashes.pixel_hash}`,
      );
    }

    // Perceptual hash check (non-blocking warning)
    if (
      originalHashes.perceptual_hash &&
      roundTripHashes.perceptual_hash &&
      originalHashes.perceptual_hash !== roundTripHashes.perceptual_hash
    ) {
      warnings.push({
        code: 'USE_PERCEPTUAL_HASH_DRIFT',
        message: `Perceptual hash diverged during ${format1}→${format2}→${format1} round-trip`,
        severity: 'warning',
      });
    }

    // Visual checks via pixel diff
    const visual = this.buildVisualChecks(pixelDiff, originalHashes, roundTripHashes);

    if (pixelDiff && !visual.render_match) {
      violations.push(
        `Pixel diff after round-trip: diff=${pixelDiff.pixel_diff}, required=0`,
      );
    }

    // Structural checks if CDRs available
    let structural: StructuralChecks = {
      text_editable: true,
      tables_structured: true,
      charts_bound: true,
      hierarchy_preserved: true,
      editability_preserved: true,
    };

    if (roundTripCdr) {
      structural = this.buildStructuralChecks(roundTripCdr, roundTripCdrData, originalCdr);

      if (!structural.text_editable) {
        violations.push('Text editability lost during round-trip conversion');
      }
      if (!structural.tables_structured) {
        violations.push('Table structure degraded during round-trip conversion');
      }
      if (!structural.charts_bound) {
        violations.push('Chart data bindings lost during round-trip conversion');
      }
      if (!structural.hierarchy_preserved) {
        violations.push('Element hierarchy changed during round-trip conversion');
      }
      if (!structural.editability_preserved) {
        violations.push('Editability lost during round-trip — content was rasterized');
      }
    }

    const pass = violations.length === 0;

    return {
      pass,
      validator_name: this.name,
      source_format: format1,
      target_format: format2,
      structural_checks: structural,
      visual_checks: visual,
      violations,
      warnings,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// USEEngine — orchestrator
// ═══════════════════════════════════════════════════════════════════

export class USEEngine {
  private validators: Map<string, USEValidator> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /** Build a canonical key for a format pair. */
  private static pairKey(source: SourceFormat, target: TargetFormat): string {
    return `${source}::${target}`;
  }

  /** Register all built-in validators. */
  private registerDefaults(): void {
    this.register(new ImageToDashboardValidator());
    this.register(new ScreenshotToPptValidator());
    this.register(new PdfToBiValidator());
    this.register(new ExcelToDashboardValidator());
    this.register(new DashboardToPptValidator());
    this.register(new CrossFormatRoundTripValidator());
  }

  /** Register a validator for its declared format pair. */
  register(validator: USEValidator): void {
    const key = USEEngine.pairKey(validator.formatPair.source, validator.formatPair.target);
    this.validators.set(key, validator);
  }

  /** Select the appropriate validator for a given source→target pair. */
  selectValidator(sourceFormat: SourceFormat, targetFormat: TargetFormat): USEValidator | null {
    const key = USEEngine.pairKey(sourceFormat, targetFormat);
    return this.validators.get(key) ?? null;
  }

  /** Run the correct validator for source→target. */
  async validate(
    sourceRef: ArtifactRef,
    targetRef: ArtifactRef,
    sourceFormat: SourceFormat,
    targetFormat: TargetFormat,
    options?: {
      sourceCdr?: CdrDesign;
      targetCdr?: CdrDesign;
      sourceCdrData?: CdrData;
      targetCdrData?: CdrData;
      sourceRender?: RenderRef;
      targetRender?: RenderRef;
      pixelDiff?: DiffRef;
      sourceHashes?: HashBundle;
      targetHashes?: HashBundle;
    },
  ): Promise<USEValidationResult> {
    const validator = this.selectValidator(sourceFormat, targetFormat);

    if (!validator) {
      return {
        pass: false,
        validator_name: 'none',
        source_format: sourceFormat,
        target_format: targetFormat,
        structural_checks: {
          text_editable: false,
          tables_structured: false,
          charts_bound: false,
          hierarchy_preserved: false,
          editability_preserved: false,
        },
        visual_checks: {
          pixel_diff_ref: null,
          determinism_verified: false,
          render_match: false,
        },
        violations: [
          `No validator registered for format pair ${sourceFormat} → ${targetFormat}`,
        ],
        warnings: [],
      };
    }

    const ctx: ValidatorContext = {
      sourceRef,
      targetRef,
      sourceCdr: options?.sourceCdr,
      targetCdr: options?.targetCdr,
      sourceCdrData: options?.sourceCdrData,
      targetCdrData: options?.targetCdrData,
      sourceRender: options?.sourceRender,
      targetRender: options?.targetRender,
      pixelDiff: options?.pixelDiff,
      sourceHashes: options?.sourceHashes,
      targetHashes: options?.targetHashes,
    };

    return validator.validate(ctx);
  }

  /** Validate round-trip fidelity: A → B → A. */
  async validateRoundTrip(
    artifactRef: ArtifactRef,
    format1: SourceFormat,
    format2: TargetFormat,
    roundTripRef: ArtifactRef,
    originalHashes: HashBundle,
    roundTripHashes: HashBundle,
    options?: {
      pixelDiff?: DiffRef;
      originalCdr?: CdrDesign;
      roundTripCdr?: CdrDesign;
      originalCdrData?: CdrData;
      roundTripCdrData?: CdrData;
    },
  ): Promise<USEValidationResult> {
    const rtValidator = new CrossFormatRoundTripValidator();

    return rtValidator.validateRoundTrip({
      originalRef: artifactRef,
      roundTripRef,
      format1,
      format2,
      originalHashes,
      roundTripHashes,
      pixelDiff: options?.pixelDiff,
      originalCdr: options?.originalCdr,
      roundTripCdr: options?.roundTripCdr,
      originalCdrData: options?.originalCdrData,
      roundTripCdrData: options?.roundTripCdrData,
    });
  }

  /** List all registered format pairs. */
  listRegisteredPairs(): FormatPair[] {
    const pairs: FormatPair[] = [];
    for (const validator of this.validators.values()) {
      pairs.push({ ...validator.formatPair });
    }
    return pairs;
  }

  /** Check whether a validator exists for the given pair. */
  hasValidator(sourceFormat: SourceFormat, targetFormat: TargetFormat): boolean {
    return this.selectValidator(sourceFormat, targetFormat) !== null;
  }
}
