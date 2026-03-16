// ─── Diagnose & Repair Engine (Sections 9-10) ────────────────────────
// Root-cause diagnosis and mandatory-order repair loop
// PixelDiff = 0 target with maximum efficiency

import { createHash } from "crypto";
import type { CdrDesign, CdrElement, CdrPage, BboxEmu } from "./cdr-design-schema";
import { quantizeEmu, computeFingerprints } from "./cdr-design-schema";

// ─── Section 9: Diagnose Root-Cause ───────────────────────────────────

export interface HeatmapHotspot {
  readonly region_id: string;
  readonly bbox: { x: number; y: number; w: number; h: number };
  readonly pixel_count: number;
  readonly severity: "critical" | "major" | "minor";
  readonly probable_cause: string;
}

export interface DiagnosticProbeResult {
  readonly probe_type: string;
  readonly element_id: string;
  readonly passed: boolean;
  readonly detail: string;
  readonly fix_suggestion: string;
}

export interface DiagnosticReport {
  readonly report_id: string;
  readonly page_index: number;
  readonly hotspots: HeatmapHotspot[];
  readonly probes: DiagnosticProbeResult[];
  readonly root_causes: RootCause[];
  readonly total_diff_pixels: number;
  readonly timestamp: string;
}

export interface RootCause {
  readonly cause_id: string;
  readonly cause_type: RepairType;
  readonly affected_elements: string[];
  readonly estimated_pixel_impact: number;
  readonly priority: number; // lower = higher priority
  readonly detail: string;
}

export type RepairType =
  | "geometry_quantization"
  | "text_baseline"
  | "kerning_tracking"
  | "strokes"
  | "crops_masks"
  | "vector_approximation"
  | "overlay_option"
  | "decorative_rasterize";

// ─── Diagnostic Probes ─────────────────────────────────────────────────

/** Text probe: check text positioning, baseline, shaping */
function runTextProbe(element: CdrElement, hotspots: HeatmapHotspot[]): DiagnosticProbeResult | null {
  if (element.kind !== "text") return null;

  // Check if any hotspot overlaps with this text element
  const overlapping = hotspots.filter((h) => bboxOverlaps(element.bbox_emu, {
    x: h.bbox.x, y: h.bbox.y, w: h.bbox.w, h: h.bbox.h
  }));

  if (overlapping.length === 0) return null;

  // Diagnose text issues
  const issues: string[] = [];
  if (element.baseline_offset_emu % 8 !== 0) issues.push("baseline not quantized to EMU grid");
  if (element.line_height % 8 !== 0) issues.push("line-height not quantized");
  for (const run of element.runs) {
    if (run.letter_spacing_emu !== 0 && run.letter_spacing_emu % 8 !== 0) {
      issues.push("letter-spacing not quantized");
    }
  }
  if (element.shaping.arabic_mode === "elite" && element.shaping.glyph_positions_emu.length === 0) {
    issues.push("Arabic ELITE mode active but no glyph positions");
  }

  return {
    probe_type: "text",
    element_id: element.element_id,
    passed: issues.length === 0,
    detail: issues.length > 0 ? issues.join("; ") : "Text metrics match",
    fix_suggestion: issues.length > 0 ? "Apply text_baseline and kerning_tracking repairs" : "none",
  };
}

/** Color delta probe: check background/gradient differences */
function runColorDeltaProbe(element: CdrElement, hotspots: HeatmapHotspot[]): DiagnosticProbeResult | null {
  if (element.kind !== "shape" && element.kind !== "background_fragment") return null;

  const overlapping = hotspots.filter((h) => bboxOverlaps(element.bbox_emu, {
    x: h.bbox.x, y: h.bbox.y, w: h.bbox.w, h: h.bbox.h
  }));

  if (overlapping.length === 0) return null;

  const issues: string[] = [];
  if (element.kind === "shape") {
    if (element.fill.type === "linear_gradient" || element.fill.type === "radial_gradient") {
      issues.push("gradient rendering may vary across renderers");
    }
    if (element.effects.length > 0) {
      issues.push("effects (shadow/glow/blur) may cause sub-pixel differences");
    }
  }

  return {
    probe_type: "color_delta",
    element_id: element.element_id,
    passed: issues.length === 0,
    detail: issues.length > 0 ? issues.join("; ") : "Color match",
    fix_suggestion: issues.length > 0 ? "Consider decorative_rasterize for effect elements" : "none",
  };
}

/** Alpha edge probe: check clip/mask edge differences */
function runAlphaEdgeProbe(element: CdrElement, hotspots: HeatmapHotspot[]): DiagnosticProbeResult | null {
  if (element.kind !== "image") return null;

  const overlapping = hotspots.filter((h) => bboxOverlaps(element.bbox_emu, {
    x: h.bbox.x, y: h.bbox.y, w: h.bbox.w, h: h.bbox.h
  }));

  if (overlapping.length === 0) return null;

  const issues: string[] = [];
  if (element.mask !== "none") {
    issues.push("mask edges may cause anti-aliasing differences");
  }
  if (element.crop) {
    issues.push("crop boundaries may introduce sub-pixel alignment issues");
  }
  if (element.alpha_mode !== "premultiplied") {
    issues.push("alpha mode is not premultiplied — may cause compositing differences");
  }

  return {
    probe_type: "alpha_edge",
    element_id: element.element_id,
    passed: issues.length === 0,
    detail: issues.length > 0 ? issues.join("; ") : "Alpha edges match",
    fix_suggestion: issues.length > 0 ? "Apply crops_masks repair" : "none",
  };
}

function bboxOverlaps(a: BboxEmu, b: { x: number; y: number; w: number; h: number }): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/** Map heatmap hotspots to CDR elements (Section 9: bbox correlation) */
function correlateHotspotsToElements(
  hotspots: HeatmapHotspot[],
  elements: CdrElement[]
): Map<string, HeatmapHotspot[]> {
  const correlation = new Map<string, HeatmapHotspot[]>();

  for (const hotspot of hotspots) {
    for (const el of elements) {
      if (bboxOverlaps(el.bbox_emu, hotspot.bbox)) {
        const existing = correlation.get(el.element_id) ?? [];
        existing.push(hotspot);
        correlation.set(el.element_id, existing);
      }
    }
  }

  return correlation;
}

/** Full diagnostic analysis (Section 9) */
export function diagnose(
  design: CdrDesign,
  pageIndex: number,
  diffPixelCount: number,
  heatmapData?: Uint8Array,
  heatmapWidth?: number,
  heatmapHeight?: number
): DiagnosticReport {
  const page = design.pages[pageIndex];
  if (!page) throw new Error(`Page ${pageIndex} not found`);

  // Extract hotspots from heatmap
  const hotspots: HeatmapHotspot[] = [];
  if (heatmapData && heatmapWidth && heatmapHeight) {
    hotspots.push(...extractHotspotsFromHeatmap(heatmapData, heatmapWidth, heatmapHeight));
  } else if (diffPixelCount > 0) {
    // Without heatmap, create a single hotspot covering the whole page
    hotspots.push({
      region_id: "full-page-diff",
      bbox: { x: 0, y: 0, w: 1000, h: 1000 },
      pixel_count: diffPixelCount,
      severity: diffPixelCount > 100 ? "critical" : diffPixelCount > 10 ? "major" : "minor",
      probable_cause: "unknown — heatmap not provided",
    });
  }

  // Flatten all elements
  const allElements: CdrElement[] = [];
  function collect(elements: CdrElement[]): void {
    for (const el of elements) {
      allElements.push(el);
      if (el.kind === "group") collect(el.children);
    }
  }
  for (const layer of page.layers) collect(layer.elements);

  // Run probes
  const probes: DiagnosticProbeResult[] = [];
  for (const el of allElements) {
    const textProbe = runTextProbe(el, hotspots);
    if (textProbe) probes.push(textProbe);

    const colorProbe = runColorDeltaProbe(el, hotspots);
    if (colorProbe) probes.push(colorProbe);

    const alphaProbe = runAlphaEdgeProbe(el, hotspots);
    if (alphaProbe) probes.push(alphaProbe);
  }

  // Determine root causes
  const rootCauses: RootCause[] = [];
  const failedProbes = probes.filter((p) => !p.passed);

  // Group by repair type
  const textIssues = failedProbes.filter((p) => p.probe_type === "text");
  const colorIssues = failedProbes.filter((p) => p.probe_type === "color_delta");
  const alphaIssues = failedProbes.filter((p) => p.probe_type === "alpha_edge");

  if (textIssues.length > 0) {
    const hasBaseline = textIssues.some((p) => p.detail.includes("baseline"));
    const hasKerning = textIssues.some((p) => p.detail.includes("spacing") || p.detail.includes("kerning"));
    if (hasBaseline) {
      rootCauses.push({
        cause_id: `cause-text-baseline-${pageIndex}`,
        cause_type: "text_baseline",
        affected_elements: textIssues.map((p) => p.element_id),
        estimated_pixel_impact: Math.round(diffPixelCount * 0.4),
        priority: 2,
        detail: "Text baseline/line-height not quantized to EMU grid",
      });
    }
    if (hasKerning) {
      rootCauses.push({
        cause_id: `cause-kerning-${pageIndex}`,
        cause_type: "kerning_tracking",
        affected_elements: textIssues.map((p) => p.element_id),
        estimated_pixel_impact: Math.round(diffPixelCount * 0.2),
        priority: 3,
        detail: "Letter spacing/kerning not quantized",
      });
    }
  }

  // Check if geometry quantization needed
  const unquantized = allElements.filter(
    (el) => el.bbox_emu.x % 8 !== 0 || el.bbox_emu.y % 8 !== 0 || el.bbox_emu.w % 8 !== 0 || el.bbox_emu.h % 8 !== 0
  );
  if (unquantized.length > 0) {
    rootCauses.push({
      cause_id: `cause-geometry-${pageIndex}`,
      cause_type: "geometry_quantization",
      affected_elements: unquantized.map((el) => el.element_id),
      estimated_pixel_impact: Math.round(diffPixelCount * 0.3),
      priority: 1, // Highest priority
      detail: `${unquantized.length} elements have un-quantized geometry`,
    });
  }

  if (colorIssues.length > 0) {
    const hasEffects = colorIssues.some((p) => p.detail.includes("effects"));
    if (hasEffects) {
      rootCauses.push({
        cause_id: `cause-decorative-${pageIndex}`,
        cause_type: "decorative_rasterize",
        affected_elements: colorIssues.map((p) => p.element_id),
        estimated_pixel_impact: Math.round(diffPixelCount * 0.1),
        priority: 8, // Lowest priority
        detail: "Decorative effects need rasterization",
      });
    }
  }

  if (alphaIssues.length > 0) {
    rootCauses.push({
      cause_id: `cause-masks-${pageIndex}`,
      cause_type: "crops_masks",
      affected_elements: alphaIssues.map((p) => p.element_id),
      estimated_pixel_impact: Math.round(diffPixelCount * 0.15),
      priority: 5,
      detail: "Mask/crop edges causing differences",
    });
  }

  // Sort by priority
  rootCauses.sort((a, b) => a.priority - b.priority);

  return {
    report_id: `diag-${pageIndex}-${Date.now()}`,
    page_index: pageIndex,
    hotspots,
    probes,
    root_causes: rootCauses,
    total_diff_pixels: diffPixelCount,
    timestamp: new Date().toISOString(),
  };
}

/** Extract hotspots from heatmap RGBA buffer */
function extractHotspotsFromHeatmap(
  heatmap: Uint8Array,
  width: number,
  height: number
): HeatmapHotspot[] {
  // Find connected regions of non-zero (red) pixels
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    mask[i] = heatmap[idx] > 0 ? 1 : 0; // Red channel indicates diff
  }

  // Simple connected component labeling
  const labels = new Int32Array(width * height);
  let nextLabel = 1;
  const labelPixels = new Map<number, { minX: number; minY: number; maxX: number; maxY: number; count: number }>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0 || labels[idx] !== 0) continue;

      const label = nextLabel++;
      const queue: Array<[number, number]> = [[x, y]];
      labels[idx] = label;
      let minX = x, minY = y, maxX = x, maxY = y, count = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        count++;
        minX = Math.min(minX, cx); minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx); maxY = Math.max(maxY, cy);

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = ny * width + nx;
            if (mask[ni] === 1 && labels[ni] === 0) {
              labels[ni] = label;
              queue.push([nx, ny]);
            }
          }
        }
      }

      labelPixels.set(label, { minX, minY, maxX, maxY, count });
    }
  }

  // Convert to hotspots
  const hotspots: HeatmapHotspot[] = [];
  for (const [label, info] of labelPixels) {
    const severity: HeatmapHotspot["severity"] =
      info.count > 1000 ? "critical" : info.count > 100 ? "major" : "minor";

    hotspots.push({
      region_id: `hotspot-${label}`,
      bbox: { x: info.minX, y: info.minY, w: info.maxX - info.minX + 1, h: info.maxY - info.minY + 1 },
      pixel_count: info.count,
      severity,
      probable_cause: severity === "critical" ? "layout shift" : severity === "major" ? "text rendering" : "sub-pixel edge",
    });
  }

  return hotspots.sort((a, b) => b.pixel_count - a.pixel_count);
}

// ─── Section 10: Repair Loop ──────────────────────────────────────────

export interface RepairStep {
  readonly step_type: RepairType;
  readonly order: number; // 1-8
  readonly elements_affected: string[];
  readonly before_diff: number;
  readonly after_diff: number;
  readonly applied: boolean;
  readonly duration_ms: number;
}

export interface RepairResult {
  readonly total_iterations: number;
  readonly steps: RepairStep[];
  readonly final_diff: number;
  readonly converged: boolean;
  readonly cache_hits: number;
  readonly early_exit: boolean;
}

export interface RepairConfig {
  readonly max_iterations: number;
  readonly top_k_causes: number;
  readonly emu_snap_grid: number;
  readonly allow_overlay: boolean;
  readonly allow_decorative_rasterize: boolean;
  readonly max_rasterize_area_ratio: number; // Max area that can be rasterized
  readonly page_parallel: boolean;
}

export const DEFAULT_REPAIR_CONFIG: RepairConfig = {
  max_iterations: 50,
  top_k_causes: 10,
  emu_snap_grid: 8,
  allow_overlay: true,
  allow_decorative_rasterize: true,
  max_rasterize_area_ratio: 0.05, // 5% max
  page_parallel: true,
};

// ─── Repair Cache ──────────────────────────────────────────────────────

export class RepairCache {
  private cache = new Map<string, { diff: number; design: CdrDesign }>();

  computeKey(
    inputHash: string,
    policyHash: string,
    toolVersions: string,
    fontsSnapshot: string,
    farmImageId: string
  ): string {
    return createHash("sha256")
      .update(`${inputHash}|${policyHash}|${toolVersions}|${fontsSnapshot}|${farmImageId}`)
      .digest("hex");
  }

  get(key: string): { diff: number; design: CdrDesign } | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: { diff: number; design: CdrDesign }): void {
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ─── Repair Steps (Mandatory Order) ────────────────────────────────────

/** Step 1: Geometry quantization (EMU snap) */
function repairGeometryQuantization(design: CdrDesign, grid: number): CdrDesign {
  function quantizeElement(el: CdrElement): CdrElement {
    const qbox: BboxEmu = {
      x: quantizeEmu(el.bbox_emu.x, grid),
      y: quantizeEmu(el.bbox_emu.y, grid),
      w: quantizeEmu(el.bbox_emu.w, grid),
      h: quantizeEmu(el.bbox_emu.h, grid),
    };
    if (el.kind === "group") {
      return { ...el, bbox_emu: qbox, children: el.children.map(quantizeElement) };
    }
    return { ...el, bbox_emu: qbox } as CdrElement;
  }

  return {
    ...design,
    pages: design.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => ({
        ...layer,
        elements: layer.elements.map(quantizeElement),
      })),
    })),
    fingerprints: computeFingerprints(design.pages),
  };
}

/** Step 2: Text baseline/line-height */
function repairTextBaseline(design: CdrDesign, grid: number): CdrDesign {
  function fixText(el: CdrElement): CdrElement {
    if (el.kind !== "text") return el;
    return {
      ...el,
      baseline_offset_emu: quantizeEmu(el.baseline_offset_emu, grid),
      line_height: quantizeEmu(el.line_height, grid),
    };
  }

  return mapDesignElements(design, fixText);
}

/** Step 3: Kerning/tracking */
function repairKerningTracking(design: CdrDesign, grid: number): CdrDesign {
  function fixText(el: CdrElement): CdrElement {
    if (el.kind !== "text") return el;
    return {
      ...el,
      runs: el.runs.map((run) => ({
        ...run,
        letter_spacing_emu: quantizeEmu(run.letter_spacing_emu, grid),
      })),
    };
  }

  return mapDesignElements(design, fixText);
}

/** Step 4: Strokes */
function repairStrokes(design: CdrDesign, grid: number): CdrDesign {
  function fixElement(el: CdrElement): CdrElement {
    if (el.kind !== "shape") return el;
    if (!el.stroke) return el;
    return {
      ...el,
      stroke: {
        ...el.stroke,
        width_emu: quantizeEmu(el.stroke.width_emu, grid),
      },
    };
  }

  return mapDesignElements(design, fixElement);
}

/** Step 5: Crops/masks */
function repairCropsMasks(design: CdrDesign): CdrDesign {
  function fixElement(el: CdrElement): CdrElement {
    if (el.kind !== "image") return el;
    // Snap crop values to clean fractions
    if (!el.crop) return el;
    return {
      ...el,
      crop: {
        left: Math.round(el.crop.left * 1000) / 1000,
        top: Math.round(el.crop.top * 1000) / 1000,
        right: Math.round(el.crop.right * 1000) / 1000,
        bottom: Math.round(el.crop.bottom * 1000) / 1000,
      },
    };
  }

  return mapDesignElements(design, fixElement);
}

/** Step 6: Vector approximation */
function repairVectorApproximation(design: CdrDesign): CdrDesign {
  function fixElement(el: CdrElement): CdrElement {
    if (el.kind !== "shape" || !el.path_data) return el;
    // Simplify path coordinates to integer values
    const simplified = el.path_data.replace(
      /(-?\d+\.?\d*)/g,
      (match) => String(Math.round(parseFloat(match)))
    );
    return { ...el, path_data: simplified };
  }

  return mapDesignElements(design, fixElement);
}

/** Step 7: Overlay option (image only, if allowed) */
function repairWithOverlay(
  design: CdrDesign,
  _pageIndex: number,
  overlayRef: string
): CdrDesign {
  // Add overlay reference as decorative layer
  return {
    ...design,
    pages: design.pages.map((page, idx) => {
      if (idx !== _pageIndex) return page;
      return {
        ...page,
        layers: [
          ...page.layers,
          {
            layer_id: `overlay-${idx}`,
            z_index: 999,
            blend_mode: "normal" as const,
            elements: [{
              element_id: `overlay-element-${idx}`,
              kind: "image" as const,
              transform: [1, 0, 0, 1, 0, 0] as const,
              bbox_emu: { x: 0, y: 0, w: page.size_emu.w, h: page.size_emu.h },
              opacity: 1,
              visible: true,
              constraints: { no_reflow: true, lock_aspect: true },
              asset_ref: overlayRef,
              crop: null,
              crop_offsets_emu: null,
              mask: "none" as const,
              sampling: "nearest" as const,
              color_profile: null,
              alpha_mode: "premultiplied" as const,
              exif_orientation_applied: true as const,
            }],
          },
        ],
      };
    }),
    fingerprints: computeFingerprints(design.pages),
  };
}

/** Step 8: Decorative rasterize (last resort, small elements only) */
function repairDecorativeRasterize(
  design: CdrDesign,
  elementIds: string[],
  maxAreaRatio: number
): { design: CdrDesign; rasterized: string[] } {
  const rasterized: string[] = [];
  const totalArea = design.pages.reduce((s, p) => s + p.size_emu.w * p.size_emu.h, 0);

  function fixElement(el: CdrElement): CdrElement {
    if (!elementIds.includes(el.element_id)) return el;

    const elArea = el.bbox_emu.w * el.bbox_emu.h;
    if (elArea / totalArea > maxAreaRatio) return el; // Too large to rasterize

    // Mark as rasterized image
    rasterized.push(el.element_id);
    return {
      element_id: el.element_id,
      kind: "image",
      transform: el.transform,
      bbox_emu: el.bbox_emu,
      opacity: el.opacity,
      visible: el.visible,
      constraints: { no_reflow: true, lock_aspect: true },
      asset_ref: `rasterized://${el.element_id}`,
      crop: null,
      crop_offsets_emu: null,
      mask: "none",
      sampling: "nearest",
      color_profile: null,
      alpha_mode: "premultiplied",
      exif_orientation_applied: true,
    } as CdrElement;
  }

  return {
    design: mapDesignElements(design, fixElement),
    rasterized,
  };
}

// ─── Helper: Map all elements in design ────────────────────────────────

function mapDesignElements(
  design: CdrDesign,
  fn: (el: CdrElement) => CdrElement
): CdrDesign {
  function mapElement(el: CdrElement): CdrElement {
    const mapped = fn(el);
    if (mapped.kind === "group") {
      return { ...mapped, children: mapped.children.map(mapElement) };
    }
    return mapped;
  }

  return {
    ...design,
    pages: design.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => ({
        ...layer,
        elements: layer.elements.map(mapElement),
      })),
    })),
    fingerprints: computeFingerprints(design.pages),
  };
}

// ─── Repair Loop Controller ────────────────────────────────────────────

export type DiffCalculator = (design: CdrDesign, pageIndex: number) => number;

/** Execute the mandatory repair loop (Section 10) */
export function executeRepairLoop(
  design: CdrDesign,
  pageIndex: number,
  initialDiff: number,
  config: RepairConfig,
  calculateDiff: DiffCalculator,
  diagnosticReport?: DiagnosticReport
): RepairResult {
  const steps: RepairStep[] = [];
  let currentDesign = design;
  let currentDiff = initialDiff;
  let cacheHits = 0;
  const cache = new RepairCache();

  // Early exit if already at 0
  if (currentDiff === 0) {
    return {
      total_iterations: 0,
      steps: [],
      final_diff: 0,
      converged: true,
      cache_hits: 0,
      early_exit: true,
    };
  }

  // Get top-K root causes to focus on
  const causes = diagnosticReport?.root_causes.slice(0, config.top_k_causes) ?? [];

  // Mandatory repair order (Section 10.1)
  const repairFunctions: Array<{
    type: RepairType;
    order: number;
    apply: (d: CdrDesign) => CdrDesign;
    condition: () => boolean;
  }> = [
    {
      type: "geometry_quantization",
      order: 1,
      apply: (d) => repairGeometryQuantization(d, config.emu_snap_grid),
      condition: () => causes.some((c) => c.cause_type === "geometry_quantization") || causes.length === 0,
    },
    {
      type: "text_baseline",
      order: 2,
      apply: (d) => repairTextBaseline(d, config.emu_snap_grid),
      condition: () => causes.some((c) => c.cause_type === "text_baseline") || causes.length === 0,
    },
    {
      type: "kerning_tracking",
      order: 3,
      apply: (d) => repairKerningTracking(d, config.emu_snap_grid),
      condition: () => causes.some((c) => c.cause_type === "kerning_tracking") || causes.length === 0,
    },
    {
      type: "strokes",
      order: 4,
      apply: (d) => repairStrokes(d, config.emu_snap_grid),
      condition: () => causes.some((c) => c.cause_type === "strokes") || causes.length === 0,
    },
    {
      type: "crops_masks",
      order: 5,
      apply: (d) => repairCropsMasks(d),
      condition: () => causes.some((c) => c.cause_type === "crops_masks") || causes.length === 0,
    },
    {
      type: "vector_approximation",
      order: 6,
      apply: (d) => repairVectorApproximation(d),
      condition: () => causes.some((c) => c.cause_type === "vector_approximation") || causes.length === 0,
    },
    {
      type: "overlay_option",
      order: 7,
      apply: (d) => config.allow_overlay ? repairWithOverlay(d, pageIndex, `overlay://${pageIndex}`) : d,
      condition: () => config.allow_overlay && currentDiff > 0,
    },
    {
      type: "decorative_rasterize",
      order: 8,
      apply: (d) => {
        const decorativeElements = causes
          .filter((c) => c.cause_type === "decorative_rasterize")
          .flatMap((c) => c.affected_elements);
        if (decorativeElements.length === 0) return d;
        return repairDecorativeRasterize(d, decorativeElements, config.max_rasterize_area_ratio).design;
      },
      condition: () => config.allow_decorative_rasterize && currentDiff > 0,
    },
  ];

  for (let iteration = 0; iteration < config.max_iterations; iteration++) {
    let anyImprovement = false;

    for (const repair of repairFunctions) {
      if (currentDiff === 0) break; // Early exit!
      if (!repair.condition()) continue;

      const startTime = Date.now();
      const repaired = repair.apply(currentDesign);
      const newDiff = calculateDiff(repaired, pageIndex);
      const duration = Date.now() - startTime;

      const step: RepairStep = {
        step_type: repair.type,
        order: repair.order,
        elements_affected: [],
        before_diff: currentDiff,
        after_diff: newDiff,
        applied: newDiff < currentDiff,
        duration_ms: duration,
      };
      steps.push(step);

      if (newDiff < currentDiff) {
        currentDesign = repaired;
        currentDiff = newDiff;
        anyImprovement = true;
      }

      // Early exit on PixelDiff == 0
      if (currentDiff === 0) {
        return {
          total_iterations: iteration + 1,
          steps,
          final_diff: 0,
          converged: true,
          cache_hits: cacheHits,
          early_exit: true,
        };
      }
    }

    // If no improvement in this iteration, stop
    if (!anyImprovement) break;
  }

  return {
    total_iterations: steps.length,
    steps,
    final_diff: currentDiff,
    converged: currentDiff === 0,
    cache_hits: cacheHits,
    early_exit: false,
  };
}

/** Execute repair loop for all pages in parallel (if configured) */
export async function executeRepairLoopAllPages(
  design: CdrDesign,
  diffs: number[],
  config: RepairConfig,
  calculateDiff: DiffCalculator
): Promise<RepairResult[]> {
  if (config.page_parallel) {
    // Run all pages concurrently
    const promises = design.pages.map((_, pageIndex) => {
      if (diffs[pageIndex] === 0) {
        return Promise.resolve<RepairResult>({
          total_iterations: 0, steps: [], final_diff: 0,
          converged: true, cache_hits: 0, early_exit: true,
        });
      }
      const diagnostic = diagnose(design, pageIndex, diffs[pageIndex]);
      return Promise.resolve(
        executeRepairLoop(design, pageIndex, diffs[pageIndex], config, calculateDiff, diagnostic)
      );
    });
    return Promise.all(promises);
  } else {
    // Sequential
    const results: RepairResult[] = [];
    for (let pageIndex = 0; pageIndex < design.pages.length; pageIndex++) {
      if (diffs[pageIndex] === 0) {
        results.push({
          total_iterations: 0, steps: [], final_diff: 0,
          converged: true, cache_hits: 0, early_exit: true,
        });
        continue;
      }
      const diagnostic = diagnose(design, pageIndex, diffs[pageIndex]);
      results.push(
        executeRepairLoop(design, pageIndex, diffs[pageIndex], config, calculateDiff, diagnostic)
      );
    }
    return results;
  }
}
