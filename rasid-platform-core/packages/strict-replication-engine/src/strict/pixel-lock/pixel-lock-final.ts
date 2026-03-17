/**
 * STRICT_PIXEL_LOCK_FINAL — Section 4 Mandatory Mode
 * ANY_FORMAT → CDR_ABSOLUTE → TARGET_FORMAT editable & functional
 *
 * Enforcements:
 *   - disable beautification
 *   - disable layout adaptation
 *   - lock CDR to absolute coordinates
 *   - DUAL FIDELITY GATE = STRUCTURAL_EQ + PIXEL_LOCK_EQ
 *   - mandatory preservation manifest (all 17 properties)
 *   - zero runtime mutation
 *   - hard failure on fidelity breach
 *   - deterministic build artifact hashing
 */

import { createHash } from 'crypto';
import type {
  CdrDesign,
  CdrDesignRef,
  CdrElement,
  CdrPage,
  CdrLayer,
  HashBundle,
  ArtifactRef,
  ActionContext,
  ExportKind,
  Warning,
  DiffRef,
} from '../cdr/types';
import type { CdrStore } from '../cdr/store';

// ─── Mandatory Preservation Manifest (all 17 properties) ────────────

export interface PreservationManifest {
  font_embedding_or_glyph_vectorization: boolean;
  pivot_geometry: boolean;
  conditional_formatting: boolean;
  freeze_pane: boolean;
  column_pixel_width: boolean;
  smart_art_geometry: boolean;
  chart_axis_spacing_and_density: boolean;
  legend_offset: boolean;
  kpi_block_alignment: boolean;
  clipping_overflow: boolean;
  container_padding_ratios: boolean;
  margin_ratios: boolean;
  nested_hierarchy: boolean;
  grouping_hierarchy: boolean;
  layout_hash_equality: boolean;
  structural_hash_equality: boolean;
  deterministic_build_artifact_hash_equality: boolean;
}

export const PRESERVATION_PROPERTY_KEYS: ReadonlyArray<keyof PreservationManifest> = [
  'font_embedding_or_glyph_vectorization',
  'pivot_geometry',
  'conditional_formatting',
  'freeze_pane',
  'column_pixel_width',
  'smart_art_geometry',
  'chart_axis_spacing_and_density',
  'legend_offset',
  'kpi_block_alignment',
  'clipping_overflow',
  'container_padding_ratios',
  'margin_ratios',
  'nested_hierarchy',
  'grouping_hierarchy',
  'layout_hash_equality',
  'structural_hash_equality',
  'deterministic_build_artifact_hash_equality',
] as const;

// ─── PixelLockConfig ─────────────────────────────────────────────────

export interface PixelLockConfig {
  beautification_disabled: true;
  layout_adaptation_disabled: true;
  cdr_absolute_coordinates: true;
  zero_runtime_mutation: true;
  hard_failure_on_breach: true;
}

export const PIXEL_LOCK_CONFIG: PixelLockConfig = Object.freeze({
  beautification_disabled: true,
  layout_adaptation_disabled: true,
  cdr_absolute_coordinates: true,
  zero_runtime_mutation: true,
  hard_failure_on_breach: true,
});

// ─── Dual Fidelity Gate ─────────────────────────────────────────────

export interface StructuralEqResult {
  layout_hash_match: boolean;
  structural_hash_match: boolean;
  text_editable: boolean;
  tables_structured: boolean;
  charts_bound: boolean;
  element_count_match: boolean;
  hierarchy_preserved: boolean;
}

export interface PixelLockEqResult {
  pixel_diff: number;
  differing_pixels: number;
  total_pixels: number;
  determinism_verified: boolean;
  build_artifact_hash_match: boolean;
}

export interface DualFidelityGateResult {
  structural_eq: StructuralEqResult;
  pixel_lock_eq: PixelLockEqResult;
  structural_pass: boolean;
  pixel_lock_pass: boolean;
  combined_pass: boolean;
}

/**
 * Evaluates the dual fidelity gate: STRUCTURAL_EQ + PIXEL_LOCK_EQ.
 * Both gates must pass for the combined result to pass.
 */
export function evaluateDualFidelityGate(
  sourceDesign: CdrDesign,
  targetDesign: CdrDesign,
  sourceBuildHash: string,
  targetBuildHash: string,
  pixelDiffReport: DiffRef,
  totalPixels: number,
  determinismVerified: boolean,
): DualFidelityGateResult {
  const sourceFingerprints = sourceDesign.fingerprints;
  const targetFingerprints = targetDesign.fingerprints;

  const sourceElementCount = countElements(sourceDesign);
  const targetElementCount = countElements(targetDesign);

  const sourceHierarchyHash = hashHierarchy(sourceDesign);
  const targetHierarchyHash = hashHierarchy(targetDesign);

  const textEditable = verifyTextEditable(targetDesign);
  const tablesStructured = verifyTablesStructured(targetDesign);
  const chartsBound = verifyChartsBound(targetDesign);

  const structuralEq: StructuralEqResult = {
    layout_hash_match: sourceFingerprints.layout_hash === targetFingerprints.layout_hash,
    structural_hash_match: sourceFingerprints.structural_hash === targetFingerprints.structural_hash,
    text_editable: textEditable,
    tables_structured: tablesStructured,
    charts_bound: chartsBound,
    element_count_match: sourceElementCount === targetElementCount,
    hierarchy_preserved: sourceHierarchyHash === targetHierarchyHash,
  };

  const structuralPass =
    structuralEq.layout_hash_match &&
    structuralEq.structural_hash_match &&
    structuralEq.text_editable &&
    structuralEq.tables_structured &&
    structuralEq.charts_bound &&
    structuralEq.element_count_match &&
    structuralEq.hierarchy_preserved;

  const pixelLockEq: PixelLockEqResult = {
    pixel_diff: pixelDiffReport.pixel_diff,
    differing_pixels: pixelDiffReport.pixel_diff,
    total_pixels: totalPixels,
    determinism_verified: determinismVerified,
    build_artifact_hash_match: sourceBuildHash === targetBuildHash,
  };

  const pixelLockPass =
    pixelLockEq.pixel_diff === 0 &&
    pixelLockEq.determinism_verified &&
    pixelLockEq.build_artifact_hash_match;

  return {
    structural_eq: structuralEq,
    pixel_lock_eq: pixelLockEq,
    structural_pass: structuralPass,
    pixel_lock_pass: pixelLockPass,
    combined_pass: structuralPass && pixelLockPass,
  };
}

// ─── lockCdrAbsolute ─────────────────────────────────────────────────

/**
 * Enforces absolute coordinates on a CDR design:
 * - Sets immutable_layout_lock_flag to true
 * - Forces no_reflow=true on every element
 * - Forces auto_fit=false on every text element
 * Returns list of warnings for any fields that had to be corrected.
 */
export function lockCdrAbsolute(design: CdrDesign): Warning[] {
  const warnings: Warning[] = [];

  if (!design.immutable_layout_lock_flag) {
    (design as { immutable_layout_lock_flag: boolean }).immutable_layout_lock_flag = true;
    warnings.push({
      code: 'PIXEL_LOCK_FORCE_IMMUTABLE_FLAG',
      message: 'Forced immutable_layout_lock_flag to true for CDR absolute lock',
      severity: 'warning',
    });
  }

  for (const page of design.pages) {
    for (const layer of page.layers) {
      lockElementsAbsolute(layer.elements, warnings, `page[${page.index}]`);
    }
  }

  return warnings;
}

function lockElementsAbsolute(
  elements: CdrElement[],
  warnings: Warning[],
  path: string,
): void {
  for (const el of elements) {
    const elPath = `${path}.${el.kind}[${el.element_id.slice(0, 8)}]`;

    if (!el.constraints.no_reflow) {
      (el.constraints as { no_reflow: boolean }).no_reflow = true;
      warnings.push({
        code: 'PIXEL_LOCK_FORCE_NO_REFLOW',
        message: `${elPath}: forced no_reflow=true`,
        severity: 'warning',
      });
    }

    if (el.text && el.text.auto_fit !== false) {
      (el.text as { auto_fit: boolean }).auto_fit = false;
      warnings.push({
        code: 'PIXEL_LOCK_FORCE_AUTO_FIT_FALSE',
        message: `${elPath}: forced text.auto_fit=false`,
        severity: 'warning',
      });
    }

    if (el.children) {
      lockElementsAbsolute(el.children, warnings, elPath);
    }
  }
}

// ─── verifyPreservation ──────────────────────────────────────────────

export interface PreservationViolation {
  property: keyof PreservationManifest;
  message: string;
  element_path?: string;
}

export interface PreservationCheckResult {
  manifest: PreservationManifest;
  pass: boolean;
  violations: PreservationViolation[];
}

/**
 * Checks all 17 preservation properties between source and target CDR.
 * Uses CdrStore to retrieve designs from refs, then compares hierarchy hashes,
 * padding ratios, margin ratios, clipping rules, and hash equalities.
 */
export function verifyPreservation(
  store: CdrStore,
  sourceRef: CdrDesignRef,
  targetRef: CdrDesignRef,
  sourceBuildArtifactHash: string,
  targetBuildArtifactHash: string,
): PreservationCheckResult {
  const sourceDesign = store.getDesign(sourceRef);
  const targetDesign = store.getDesign(targetRef);

  if (!sourceDesign || !targetDesign) {
    const violations: PreservationViolation[] = [];
    const manifest = createFailedManifest();
    if (!sourceDesign) {
      violations.push({ property: 'layout_hash_equality', message: 'Source design not found in store' });
    }
    if (!targetDesign) {
      violations.push({ property: 'layout_hash_equality', message: 'Target design not found in store' });
    }
    return { manifest, pass: false, violations };
  }

  const violations: PreservationViolation[] = [];

  // 1. font_embedding_or_glyph_vectorization
  const fontOk = checkFontPreservation(sourceDesign, targetDesign, violations);

  // 2. pivot_geometry
  const pivotOk = checkPivotGeometry(sourceDesign, targetDesign, violations);

  // 3. conditional_formatting
  const condFmtOk = checkConditionalFormatting(sourceDesign, targetDesign, violations);

  // 4. freeze_pane
  const freezeOk = checkFreezePane(sourceDesign, targetDesign, violations);

  // 5. column_pixel_width
  const colWidthOk = checkColumnPixelWidth(sourceDesign, targetDesign, violations);

  // 6. smart_art_geometry
  const smartArtOk = checkSmartArtGeometry(sourceDesign, targetDesign, violations);

  // 7. chart_axis_spacing_and_density
  const chartAxisOk = checkChartAxisSpacing(sourceDesign, targetDesign, violations);

  // 8. legend_offset
  const legendOk = checkLegendOffset(sourceDesign, targetDesign, violations);

  // 9. kpi_block_alignment
  const kpiOk = checkKpiBlockAlignment(sourceDesign, targetDesign, violations);

  // 10. clipping_overflow
  const clipOk = checkClippingOverflow(sourceDesign, targetDesign, violations);

  // 11. container_padding_ratios
  const padOk = checkContainerPaddingRatios(sourceDesign, targetDesign, violations);

  // 12. margin_ratios
  const marginOk = checkMarginRatios(sourceDesign, targetDesign, violations);

  // 13. nested_hierarchy
  const nestedOk = checkNestedHierarchy(sourceDesign, targetDesign, violations);

  // 14. grouping_hierarchy
  const groupOk = checkGroupingHierarchy(sourceDesign, targetDesign, violations);

  // 15. layout_hash_equality
  const layoutHashOk =
    sourceDesign.fingerprints.layout_hash === targetDesign.fingerprints.layout_hash;
  if (!layoutHashOk) {
    violations.push({
      property: 'layout_hash_equality',
      message: `Layout hash mismatch: source=${sourceDesign.fingerprints.layout_hash.slice(0, 16)} target=${targetDesign.fingerprints.layout_hash.slice(0, 16)}`,
    });
  }

  // 16. structural_hash_equality
  const structHashOk =
    sourceDesign.fingerprints.structural_hash === targetDesign.fingerprints.structural_hash;
  if (!structHashOk) {
    violations.push({
      property: 'structural_hash_equality',
      message: `Structural hash mismatch: source=${sourceDesign.fingerprints.structural_hash.slice(0, 16)} target=${targetDesign.fingerprints.structural_hash.slice(0, 16)}`,
    });
  }

  // 17. deterministic_build_artifact_hash_equality
  const buildHashOk = sourceBuildArtifactHash === targetBuildArtifactHash;
  if (!buildHashOk) {
    violations.push({
      property: 'deterministic_build_artifact_hash_equality',
      message: `Build artifact hash mismatch: source=${sourceBuildArtifactHash.slice(0, 16)} target=${targetBuildArtifactHash.slice(0, 16)}`,
    });
  }

  const manifest: PreservationManifest = {
    font_embedding_or_glyph_vectorization: fontOk,
    pivot_geometry: pivotOk,
    conditional_formatting: condFmtOk,
    freeze_pane: freezeOk,
    column_pixel_width: colWidthOk,
    smart_art_geometry: smartArtOk,
    chart_axis_spacing_and_density: chartAxisOk,
    legend_offset: legendOk,
    kpi_block_alignment: kpiOk,
    clipping_overflow: clipOk,
    container_padding_ratios: padOk,
    margin_ratios: marginOk,
    nested_hierarchy: nestedOk,
    grouping_hierarchy: groupOk,
    layout_hash_equality: layoutHashOk,
    structural_hash_equality: structHashOk,
    deterministic_build_artifact_hash_equality: buildHashOk,
  };

  return {
    manifest,
    pass: violations.length === 0,
    violations,
  };
}

// ─── Preservation check helpers ──────────────────────────────────────

function createFailedManifest(): PreservationManifest {
  return {
    font_embedding_or_glyph_vectorization: false,
    pivot_geometry: false,
    conditional_formatting: false,
    freeze_pane: false,
    column_pixel_width: false,
    smart_art_geometry: false,
    chart_axis_spacing_and_density: false,
    legend_offset: false,
    kpi_block_alignment: false,
    clipping_overflow: false,
    container_padding_ratios: false,
    margin_ratios: false,
    nested_hierarchy: false,
    grouping_hierarchy: false,
    layout_hash_equality: false,
    structural_hash_equality: false,
    deterministic_build_artifact_hash_equality: false,
  };
}

function collectElementsFlat(design: CdrDesign): CdrElement[] {
  const result: CdrElement[] = [];
  for (const page of design.pages) {
    for (const layer of page.layers) {
      collectElementsRecursive(layer.elements, result);
    }
  }
  return result;
}

function collectElementsRecursive(elements: CdrElement[], target: CdrElement[]): void {
  for (const el of elements) {
    target.push(el);
    if (el.children) {
      collectElementsRecursive(el.children, target);
    }
  }
}

function buildElementMap(design: CdrDesign): Map<string, CdrElement> {
  const map = new Map<string, CdrElement>();
  const elements = collectElementsFlat(design);
  for (const el of elements) {
    map.set(el.element_id, el);
  }
  return map;
}

function checkFontPreservation(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'text' || !srcEl.text) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.text) {
      violations.push({
        property: 'font_embedding_or_glyph_vectorization',
        message: `Text element ${id} missing in target`,
        element_path: id,
      });
      ok = false;
      continue;
    }
    for (let i = 0; i < srcEl.text.runs.length; i++) {
      const srcRun = srcEl.text.runs[i];
      const tgtRun = tgtEl.text.runs[i];
      if (!tgtRun) {
        violations.push({
          property: 'font_embedding_or_glyph_vectorization',
          message: `Text run ${i} missing in target element ${id}`,
          element_path: id,
        });
        ok = false;
        continue;
      }
      if (srcRun.font_family !== tgtRun.font_family) {
        violations.push({
          property: 'font_embedding_or_glyph_vectorization',
          message: `Font family changed: "${srcRun.font_family}" -> "${tgtRun.font_family}" in element ${id} run ${i}`,
          element_path: id,
        });
        ok = false;
      }
      if (srcRun.font_size_emu !== tgtRun.font_size_emu) {
        violations.push({
          property: 'font_embedding_or_glyph_vectorization',
          message: `Font size changed: ${srcRun.font_size_emu} -> ${tgtRun.font_size_emu} in element ${id} run ${i}`,
          element_path: id,
        });
        ok = false;
      }
    }
  }
  return ok;
}

function checkPivotGeometry(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'table' || !srcEl.table) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.table) {
      violations.push({
        property: 'pivot_geometry',
        message: `Table element ${id} missing in target`,
        element_path: id,
      });
      ok = false;
      continue;
    }
    if (
      srcEl.table.grid.rows !== tgtEl.table.grid.rows ||
      srcEl.table.grid.cols !== tgtEl.table.grid.cols
    ) {
      violations.push({
        property: 'pivot_geometry',
        message: `Table grid dimensions changed in element ${id}: ${srcEl.table.grid.rows}x${srcEl.table.grid.cols} -> ${tgtEl.table.grid.rows}x${tgtEl.table.grid.cols}`,
        element_path: id,
      });
      ok = false;
    }
    if (
      JSON.stringify(srcEl.table.grid.row_heights_emu) !==
      JSON.stringify(tgtEl.table.grid.row_heights_emu)
    ) {
      violations.push({
        property: 'pivot_geometry',
        message: `Table row heights changed in element ${id}`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkConditionalFormatting(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'table' || !srcEl.table) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.table) continue;

    for (const srcCell of srcEl.table.cells) {
      if (!srcCell.inline_style && !srcCell.style_ref) continue;
      const tgtCell = tgtEl.table.cells.find(
        c => c.r === srcCell.r && c.c === srcCell.c,
      );
      if (!tgtCell) {
        violations.push({
          property: 'conditional_formatting',
          message: `Cell [${srcCell.r},${srcCell.c}] with formatting missing in target element ${id}`,
          element_path: id,
        });
        ok = false;
        continue;
      }
      if (srcCell.style_ref && srcCell.style_ref !== tgtCell.style_ref) {
        violations.push({
          property: 'conditional_formatting',
          message: `Cell [${srcCell.r},${srcCell.c}] style_ref changed in element ${id}`,
          element_path: id,
        });
        ok = false;
      }
      if (
        srcCell.inline_style &&
        JSON.stringify(srcCell.inline_style) !== JSON.stringify(tgtCell.inline_style)
      ) {
        violations.push({
          property: 'conditional_formatting',
          message: `Cell [${srcCell.r},${srcCell.c}] inline_style changed in element ${id}`,
          element_path: id,
        });
        ok = false;
      }
    }
  }
  return ok;
}

function checkFreezePane(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  // Freeze pane state is preserved in the CDR constraint_matrix.
  // If the source has constraint_matrix data, the target must match.
  if (source.constraint_matrix !== target.constraint_matrix) {
    const srcHash = sha256(source.constraint_matrix);
    const tgtHash = sha256(target.constraint_matrix);
    if (srcHash !== tgtHash) {
      violations.push({
        property: 'freeze_pane',
        message: `Constraint matrix (freeze pane state) diverged: source=${srcHash.slice(0, 16)} target=${tgtHash.slice(0, 16)}`,
      });
      return false;
    }
  }
  return true;
}

function checkColumnPixelWidth(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'table' || !srcEl.table) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.table) continue;

    const srcWidths = srcEl.table.grid.col_widths_emu;
    const tgtWidths = tgtEl.table.grid.col_widths_emu;

    if (srcWidths.length !== tgtWidths.length) {
      violations.push({
        property: 'column_pixel_width',
        message: `Column count changed in element ${id}: ${srcWidths.length} -> ${tgtWidths.length}`,
        element_path: id,
      });
      ok = false;
      continue;
    }

    for (let c = 0; c < srcWidths.length; c++) {
      if (srcWidths[c] !== tgtWidths[c]) {
        violations.push({
          property: 'column_pixel_width',
          message: `Column ${c} width changed in element ${id}: ${srcWidths[c]} -> ${tgtWidths[c]} EMU`,
          element_path: id,
        });
        ok = false;
      }
    }
  }
  return ok;
}

function checkSmartArtGeometry(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'group' || !srcEl.children) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.children) {
      violations.push({
        property: 'smart_art_geometry',
        message: `SmartArt group element ${id} missing or has no children in target`,
        element_path: id,
      });
      ok = false;
      continue;
    }
    if (srcEl.children.length !== tgtEl.children.length) {
      violations.push({
        property: 'smart_art_geometry',
        message: `SmartArt child count changed in element ${id}: ${srcEl.children.length} -> ${tgtEl.children.length}`,
        element_path: id,
      });
      ok = false;
    }
    // Verify each child bbox matches
    for (let i = 0; i < Math.min(srcEl.children.length, tgtEl.children.length); i++) {
      const srcChild = srcEl.children[i];
      const tgtChild = tgtEl.children[i];
      if (JSON.stringify(srcChild.bbox_emu) !== JSON.stringify(tgtChild.bbox_emu)) {
        violations.push({
          property: 'smart_art_geometry',
          message: `SmartArt child ${i} bbox changed in element ${id}`,
          element_path: id,
        });
        ok = false;
      }
    }
  }
  return ok;
}

function checkChartAxisSpacing(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'chart' || !srcEl.chart) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.chart) {
      violations.push({
        property: 'chart_axis_spacing_and_density',
        message: `Chart element ${id} missing in target`,
        element_path: id,
      });
      ok = false;
      continue;
    }
    const srcAxes = JSON.stringify(srcEl.chart.encoding.axes ?? {});
    const tgtAxes = JSON.stringify(tgtEl.chart.encoding.axes ?? {});
    if (srcAxes !== tgtAxes) {
      violations.push({
        property: 'chart_axis_spacing_and_density',
        message: `Chart axis encoding changed in element ${id}`,
        element_path: id,
      });
      ok = false;
    }
    const srcTicks = JSON.stringify(srcEl.chart.encoding.ticks ?? {});
    const tgtTicks = JSON.stringify(tgtEl.chart.encoding.ticks ?? {});
    if (srcTicks !== tgtTicks) {
      violations.push({
        property: 'chart_axis_spacing_and_density',
        message: `Chart tick encoding changed in element ${id}`,
        element_path: id,
      });
      ok = false;
    }
    const srcGrid = JSON.stringify(srcEl.chart.encoding.gridlines ?? {});
    const tgtGrid = JSON.stringify(tgtEl.chart.encoding.gridlines ?? {});
    if (srcGrid !== tgtGrid) {
      violations.push({
        property: 'chart_axis_spacing_and_density',
        message: `Chart gridline encoding changed in element ${id}`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkLegendOffset(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'chart' || !srcEl.chart) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl || !tgtEl.chart) continue;

    const srcLegend = JSON.stringify(srcEl.chart.encoding.legend ?? {});
    const tgtLegend = JSON.stringify(tgtEl.chart.encoding.legend ?? {});
    if (srcLegend !== tgtLegend) {
      violations.push({
        property: 'legend_offset',
        message: `Chart legend offset changed in element ${id}`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkKpiBlockAlignment(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (srcEl.kind !== 'container') continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl) {
      violations.push({
        property: 'kpi_block_alignment',
        message: `Container/KPI block element ${id} missing in target`,
        element_path: id,
      });
      ok = false;
      continue;
    }
    if (
      srcEl.bbox_emu.x !== tgtEl.bbox_emu.x ||
      srcEl.bbox_emu.y !== tgtEl.bbox_emu.y ||
      srcEl.bbox_emu.w !== tgtEl.bbox_emu.w ||
      srcEl.bbox_emu.h !== tgtEl.bbox_emu.h
    ) {
      violations.push({
        property: 'kpi_block_alignment',
        message: `KPI block bbox changed in element ${id}: (${srcEl.bbox_emu.x},${srcEl.bbox_emu.y},${srcEl.bbox_emu.w},${srcEl.bbox_emu.h}) -> (${tgtEl.bbox_emu.x},${tgtEl.bbox_emu.y},${tgtEl.bbox_emu.w},${tgtEl.bbox_emu.h})`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkClippingOverflow(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    if (!srcEl.clipping_overflow_rules) continue;
    const tgtEl = targetMap.get(id);
    if (!tgtEl) {
      violations.push({
        property: 'clipping_overflow',
        message: `Element ${id} with clipping rules missing in target`,
        element_path: id,
      });
      ok = false;
      continue;
    }
    if (srcEl.clipping_overflow_rules !== tgtEl.clipping_overflow_rules) {
      violations.push({
        property: 'clipping_overflow',
        message: `Clipping overflow rules changed in element ${id}: "${srcEl.clipping_overflow_rules}" -> "${tgtEl.clipping_overflow_rules ?? 'undefined'}"`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkContainerPaddingRatios(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    const tgtEl = targetMap.get(id);
    if (!tgtEl) continue;
    if (srcEl.ratios.padding_ratio !== tgtEl.ratios.padding_ratio) {
      violations.push({
        property: 'container_padding_ratios',
        message: `Padding ratio changed in element ${id}: ${srcEl.ratios.padding_ratio} -> ${tgtEl.ratios.padding_ratio}`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkMarginRatios(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const sourceMap = buildElementMap(source);
  const targetMap = buildElementMap(target);
  let ok = true;

  for (const [id, srcEl] of sourceMap) {
    const tgtEl = targetMap.get(id);
    if (!tgtEl) continue;
    if (srcEl.ratios.margin_ratio !== tgtEl.ratios.margin_ratio) {
      violations.push({
        property: 'margin_ratios',
        message: `Margin ratio changed in element ${id}: ${srcEl.ratios.margin_ratio} -> ${tgtEl.ratios.margin_ratio}`,
        element_path: id,
      });
      ok = false;
    }
  }
  return ok;
}

function checkNestedHierarchy(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const srcHash = hashHierarchy(source);
  const tgtHash = hashHierarchy(target);
  if (srcHash !== tgtHash) {
    violations.push({
      property: 'nested_hierarchy',
      message: `Nested hierarchy hash mismatch: source=${srcHash.slice(0, 16)} target=${tgtHash.slice(0, 16)}`,
    });
    return false;
  }
  return true;
}

function checkGroupingHierarchy(
  source: CdrDesign,
  target: CdrDesign,
  violations: PreservationViolation[],
): boolean {
  const srcGroupHash = hashGroupingHierarchy(source);
  const tgtGroupHash = hashGroupingHierarchy(target);
  if (srcGroupHash !== tgtGroupHash) {
    violations.push({
      property: 'grouping_hierarchy',
      message: `Grouping hierarchy hash mismatch: source=${srcGroupHash.slice(0, 16)} target=${tgtGroupHash.slice(0, 16)}`,
    });
    return false;
  }
  return true;
}

// ─── Runtime Mutation Guard ──────────────────────────────────────────

/**
 * Produces a SHA-256 hash of the serialized CDR design for snapshot comparison.
 */
export function snapshotCdrHash(design: CdrDesign): string {
  const serialized = JSON.stringify(design, null, 0);
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Compares a before-snapshot hash with a current CDR hash. If they differ,
 * a runtime mutation occurred, which is a hard failure in STRICT_PIXEL_LOCK_FINAL.
 */
export function verifyZeroMutation(
  beforeHash: string,
  design: CdrDesign,
): { pass: boolean; before_hash: string; after_hash: string } {
  const afterHash = snapshotCdrHash(design);
  return {
    pass: beforeHash === afterHash,
    before_hash: beforeHash,
    after_hash: afterHash,
  };
}

// ─── Deterministic Build Artifact Hash ───────────────────────────────

export interface BuildEnvironment {
  tool_versions: Record<string, string>;
  farm_image_id: string;
  font_snapshot_id: string;
}

/**
 * Computes a deterministic hash of the CDR design combined with tool versions,
 * farm image, and font snapshot. This ensures that identical inputs on identical
 * infrastructure always produce identical output artifacts.
 */
export function computeBuildArtifactHash(
  design: CdrDesign,
  env: BuildEnvironment,
): string {
  const hashInput = {
    cdr_fingerprints: design.fingerprints,
    cdr_layout_graph: design.layout_graph,
    cdr_constraint_matrix: design.constraint_matrix,
    cdr_version: design.version,
    cdr_page_count: design.pages.length,
    cdr_asset_hashes: design.assets
      .map(a => a.sha256)
      .sort()
      .join(':'),
    tool_versions: Object.entries(env.tool_versions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(';'),
    farm_image_id: env.farm_image_id,
    font_snapshot_id: env.font_snapshot_id,
  };

  return createHash('sha256')
    .update(JSON.stringify(hashInput, null, 0))
    .digest('hex');
}

// ─── Fidelity Breach Report ─────────────────────────────────────────

export type BreachType =
  | 'structural_mismatch'
  | 'pixel_diff_nonzero'
  | 'preservation_violation'
  | 'runtime_mutation'
  | 'build_artifact_mismatch'
  | 'dual_gate_failure';

export type RootCauseClassification =
  | 'font_substitution'
  | 'layout_reflow'
  | 'rounding_error'
  | 'missing_asset'
  | 'element_drift'
  | 'hierarchy_corruption'
  | 'clipping_rule_change'
  | 'unknown';

export interface FidelityBreachReport {
  breach_type: BreachType;
  severity: 'hard_fail';
  timestamp: string;
  diff_report: DiffRef | null;
  root_cause_classification: RootCauseClassification;
  repair_attempt_plan: string;
  violations: PreservationViolation[];
}

/**
 * Creates a FidelityBreachReport with root cause classification and repair plan.
 */
export function createBreachReport(
  breachType: BreachType,
  violations: PreservationViolation[],
  diffReport: DiffRef | null,
): FidelityBreachReport {
  const rootCause = classifyRootCause(breachType, violations);
  const repairPlan = determineRepairPlan(rootCause, breachType);

  return {
    breach_type: breachType,
    severity: 'hard_fail',
    timestamp: new Date().toISOString(),
    diff_report: diffReport,
    root_cause_classification: rootCause,
    repair_attempt_plan: repairPlan,
    violations,
  };
}

/**
 * Classifies the root cause of a fidelity breach based on the breach type
 * and the specific violations encountered.
 */
function classifyRootCause(
  breachType: BreachType,
  violations: PreservationViolation[],
): RootCauseClassification {
  if (breachType === 'runtime_mutation') {
    return 'element_drift';
  }

  if (breachType === 'build_artifact_mismatch') {
    return 'rounding_error';
  }

  const violationProperties = new Set(violations.map(v => v.property));

  if (violationProperties.has('font_embedding_or_glyph_vectorization')) {
    return 'font_substitution';
  }

  if (
    violationProperties.has('layout_hash_equality') ||
    violationProperties.has('container_padding_ratios') ||
    violationProperties.has('margin_ratios') ||
    violationProperties.has('column_pixel_width')
  ) {
    return 'layout_reflow';
  }

  if (
    violationProperties.has('nested_hierarchy') ||
    violationProperties.has('grouping_hierarchy') ||
    violationProperties.has('structural_hash_equality')
  ) {
    return 'hierarchy_corruption';
  }

  if (violationProperties.has('clipping_overflow')) {
    return 'clipping_rule_change';
  }

  if (violations.some(v => v.message.includes('missing'))) {
    return 'missing_asset';
  }

  if (breachType === 'pixel_diff_nonzero') {
    return 'rounding_error';
  }

  return 'unknown';
}

/**
 * Determines a repair plan based on the root cause. In STRICT_PIXEL_LOCK_FINAL
 * mode, the default is 'hard-fail' — no automatic repair is attempted unless
 * the cause is clearly remediable without affecting fidelity.
 */
function determineRepairPlan(
  rootCause: RootCauseClassification,
  breachType: BreachType,
): string {
  switch (rootCause) {
    case 'font_substitution':
      return 'hard-fail';
    case 'layout_reflow':
      return 'hard-fail';
    case 'rounding_error':
      return 'hard-fail';
    case 'missing_asset':
      return 'hard-fail';
    case 'element_drift':
      return 'hard-fail';
    case 'hierarchy_corruption':
      return 'hard-fail';
    case 'clipping_rule_change':
      return 'hard-fail';
    case 'unknown':
      return 'hard-fail';
    default:
      return 'hard-fail';
  }
}

// ─── Assert PIXEL_LOCK mode ─────────────────────────────────────────

/**
 * Asserts that the ActionContext is compatible with STRICT_PIXEL_LOCK_FINAL.
 * Throws on any misconfiguration.
 */
export function assertPixelLockMode(context: ActionContext): void {
  if (!context.strict_visual) {
    throw new Error('STRICT_PIXEL_LOCK_FINAL requires strict_visual=true');
  }
  if (context.font_policy === 'FALLBACK_ALLOWED') {
    throw new Error(
      'STRICT_PIXEL_LOCK_FINAL prohibits FALLBACK_ALLOWED font_policy; use PROVIDED or ALLOW_UPLOAD',
    );
  }
}

// ─── Internal Utility Functions ─────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function countElements(design: CdrDesign): number {
  let count = 0;
  for (const page of design.pages) {
    for (const layer of page.layers) {
      count += countElementsRecursive(layer.elements);
    }
  }
  return count;
}

function countElementsRecursive(elements: CdrElement[]): number {
  let count = 0;
  for (const el of elements) {
    count += 1;
    if (el.children) {
      count += countElementsRecursive(el.children);
    }
  }
  return count;
}

/**
 * Hashes the full element hierarchy (element kinds, IDs, z-indices, child
 * structure) to detect any structural drift in nested/grouped elements.
 */
function hashHierarchy(design: CdrDesign): string {
  const tree: unknown[] = [];
  for (const page of design.pages) {
    const pageLayers: unknown[] = [];
    for (const layer of page.layers) {
      pageLayers.push({
        layer_id: layer.layer_id,
        z_index: layer.z_index,
        elements: buildHierarchyTree(layer.elements),
      });
    }
    tree.push({
      page_id: page.page_id,
      index: page.index,
      layers: pageLayers,
    });
  }
  return sha256(JSON.stringify(tree));
}

function buildHierarchyTree(elements: CdrElement[]): unknown[] {
  return elements.map(el => ({
    element_id: el.element_id,
    kind: el.kind,
    z_index: el.z_index,
    children: el.children ? buildHierarchyTree(el.children) : [],
  }));
}

/**
 * Hashes grouping hierarchy specifically — only considers group and clip_group
 * elements and their descendant structure.
 */
function hashGroupingHierarchy(design: CdrDesign): string {
  const groups: unknown[] = [];
  for (const page of design.pages) {
    for (const layer of page.layers) {
      collectGroupHierarchy(layer.elements, groups);
    }
  }
  return sha256(JSON.stringify(groups));
}

function collectGroupHierarchy(elements: CdrElement[], target: unknown[]): void {
  for (const el of elements) {
    if (el.kind === 'group' || el.kind === 'clip_group') {
      target.push({
        element_id: el.element_id,
        kind: el.kind,
        child_count: el.children?.length ?? 0,
        child_kinds: el.children?.map(c => c.kind) ?? [],
        nested: (() => {
          const nested: unknown[] = [];
          if (el.children) collectGroupHierarchy(el.children, nested);
          return nested;
        })(),
      });
    }
    if (el.children) {
      collectGroupHierarchy(el.children, target);
    }
  }
}

/**
 * Verifies all text elements in the target are editable (have text data with runs).
 */
function verifyTextEditable(design: CdrDesign): boolean {
  const elements = collectElementsFlat(design);
  for (const el of elements) {
    if (el.kind === 'text') {
      if (!el.text || !el.text.runs || el.text.runs.length === 0) {
        return false;
      }
      if (typeof el.text.text !== 'string') {
        return false;
      }
    }
  }
  return true;
}

/**
 * Verifies all table elements retain structured data (grid + cells).
 */
function verifyTablesStructured(design: CdrDesign): boolean {
  const elements = collectElementsFlat(design);
  for (const el of elements) {
    if (el.kind === 'table') {
      if (!el.table) return false;
      if (!el.table.grid || !Array.isArray(el.table.cells)) return false;
      if (el.table.grid.rows < 0 || el.table.grid.cols < 0) return false;
      if (el.table.grid.row_heights_emu.length !== el.table.grid.rows) return false;
      if (el.table.grid.col_widths_emu.length !== el.table.grid.cols) return false;
    }
  }
  return true;
}

/**
 * Verifies all chart elements have valid data bindings.
 */
function verifyChartsBound(design: CdrDesign): boolean {
  const elements = collectElementsFlat(design);
  for (const el of elements) {
    if (el.kind === 'chart') {
      if (!el.chart) return false;
      if (!el.chart.data_binding || !el.chart.data_binding.table_id) return false;
      if (!el.chart.encoding) return false;
    }
  }
  return true;
}
