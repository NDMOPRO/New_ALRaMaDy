/**
 * Degrade Policy — Section 4 Enforcement for STRICT Mode
 *
 * ALLOWED degradations (must be explicitly tracked):
 *   1. Font Substitution — only as labeled degradation, never silently
 *   2. Selective Decorative Rasterization — decorative-only (shadows, complex gradients),
 *      NEVER text/tables/charts
 *   3. Synthetic Data Binding for Dashboard — when extracted binding fails,
 *      use synthetic binding labeled as such
 *
 * PROHIBITED (hard fail):
 *   1. Full slide/page as single image (ممنوع slide كلها صورة تلقائيًا)
 *   2. Disabling/bypassing STRICT gates (ممنوع إسقاط/تعطيل بوابات STRICT)
 *   3. Silent font substitution without tracking
 *   4. Rasterizing text, tables, or charts
 *   5. Dropping editability
 */

import type { Warning, CdrElement, CdrDesign, CdrPage, ElementKind } from '../cdr/types';

// ─── Allowed Degrade Kinds ──────────────────────────────────────────

export enum DegradeKind {
  FONT_SUBSTITUTION = 'FONT_SUBSTITUTION',
  DECORATIVE_RASTERIZATION = 'DECORATIVE_RASTERIZATION',
  SYNTHETIC_DATA_BINDING = 'SYNTHETIC_DATA_BINDING',
}

// ─── Prohibited Degrade Kinds ───────────────────────────────────────

export enum ProhibitedDegradeKind {
  /** ممنوع slide كلها صورة تلقائيًا */
  FULL_SLIDE_AS_IMAGE = 'FULL_SLIDE_AS_IMAGE',
  /** ممنوع إسقاط/تعطيل بوابات STRICT */
  DISABLE_STRICT_GATES = 'DISABLE_STRICT_GATES',
  /** Silent font substitution without tracking */
  SILENT_FONT_SUBSTITUTION = 'SILENT_FONT_SUBSTITUTION',
  /** Rasterizing text, tables, or charts */
  RASTERIZE_CORE_CONTENT = 'RASTERIZE_CORE_CONTENT',
  /** Dropping editability */
  DROP_EDITABILITY = 'DROP_EDITABILITY',
}

// ─── Degrade Record ─────────────────────────────────────────────────

export interface DegradeRecord {
  kind: DegradeKind;
  element_ids: string[];
  original_state: string;
  degraded_state: string;
  reason: string;
  timestamp: string;
}

// ─── Policy Validation Result ───────────────────────────────────────

export interface PolicyValidationResult {
  compliant: boolean;
  violations: PolicyViolation[];
  records: DegradeRecord[];
  warnings: Warning[];
}

export interface PolicyViolation {
  prohibited_kind: ProhibitedDegradeKind;
  description: string;
  element_ids: string[];
  page_index?: number;
}

// ─── Element kinds that are CORE (must never be rasterized) ─────────

const CORE_ELEMENT_KINDS: ReadonlySet<ElementKind> = new Set<ElementKind>([
  'text',
  'table',
  'chart',
]);

// ─── Decorative element kinds (safe to rasterize) ───────────────────

const DECORATIVE_ELEMENT_KINDS: ReadonlySet<ElementKind> = new Set<ElementKind>([
  'shape',
  'path',
  'background_fragment',
]);

// ─── DegradePolicy Class ────────────────────────────────────────────

export class DegradePolicy {
  public readonly allowedDegradations: Set<DegradeKind>;
  public readonly records: DegradeRecord[];

  constructor() {
    this.allowedDegradations = new Set([
      DegradeKind.FONT_SUBSTITUTION,
      DegradeKind.DECORATIVE_RASTERIZATION,
      DegradeKind.SYNTHETIC_DATA_BINDING,
    ]);
    this.records = [];
  }

  /**
   * Apply a font substitution degradation.
   * The substitution is TRACKED — silent substitution is prohibited.
   */
  applyFontSubstitution(
    elementId: string,
    originalFont: string,
    substitutedFont: string,
    reason: string,
  ): DegradeRecord {
    if (!originalFont || !substitutedFont) {
      throw new Error(
        'Font substitution requires both originalFont and substitutedFont to be specified. ' +
        'Silent substitution without tracking is PROHIBITED.',
      );
    }

    if (originalFont === substitutedFont) {
      throw new Error(
        `Font substitution is a no-op: originalFont and substitutedFont are both '${originalFont}'. ` +
        'Do not record unnecessary degradations.',
      );
    }

    const record: DegradeRecord = {
      kind: DegradeKind.FONT_SUBSTITUTION,
      element_ids: [elementId],
      original_state: `font:${originalFont}`,
      degraded_state: `font:${substitutedFont}`,
      reason,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Apply decorative rasterization.
   * REJECTS if element is text, table, or chart — only decorative elements
   * (shapes, paths, background fragments with shadows/gradients) may be rasterized.
   */
  applyDecorativeRasterization(
    elementId: string,
    elementKind: ElementKind,
    reason: string,
  ): DegradeRecord {
    if (CORE_ELEMENT_KINDS.has(elementKind)) {
      throw new Error(
        `PROHIBITED: Cannot rasterize element '${elementId}' of kind '${elementKind}'. ` +
        `Rasterizing text, tables, or charts is forbidden. ` +
        `Only decorative elements (shadows, complex gradients, shapes, paths) may be rasterized.`,
      );
    }

    if (!DECORATIVE_ELEMENT_KINDS.has(elementKind)) {
      // For element kinds like 'image', 'group', 'container', 'clip_group' — warn but allow
      // since they are not core content. Groups/containers may contain decorative sub-elements.
      // However, if they contain core content children, the caller must decompose first.
    }

    const record: DegradeRecord = {
      kind: DegradeKind.DECORATIVE_RASTERIZATION,
      element_ids: [elementId],
      original_state: `editable:${elementKind}`,
      degraded_state: `rasterized:${elementKind}`,
      reason,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Apply synthetic data binding for a dashboard element.
   * Used when extracted binding fails and we fall back to reconstructed synthetic binding.
   */
  applySyntheticBinding(
    elementId: string,
    originalBindingRef: string,
    reason: string,
  ): DegradeRecord {
    const record: DegradeRecord = {
      kind: DegradeKind.SYNTHETIC_DATA_BINDING,
      element_ids: [elementId],
      original_state: `binding:${originalBindingRef || 'none'}`,
      degraded_state: 'binding:reconstructed_synthetic',
      reason,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Validate that an action is not prohibited. Throws if the action matches
   * any of the 5 prohibited degradation kinds.
   */
  validateNotProhibited(action: string): void {
    const prohibitedMap: Record<string, { kind: ProhibitedDegradeKind; message: string }> = {
      full_slide_as_image: {
        kind: ProhibitedDegradeKind.FULL_SLIDE_AS_IMAGE,
        message: 'PROHIBITED: Full slide/page as single image is forbidden (ممنوع slide كلها صورة تلقائيًا)',
      },
      disable_strict_gates: {
        kind: ProhibitedDegradeKind.DISABLE_STRICT_GATES,
        message: 'PROHIBITED: Disabling/bypassing STRICT gates is forbidden (ممنوع إسقاط/تعطيل بوابات STRICT)',
      },
      bypass_strict_gates: {
        kind: ProhibitedDegradeKind.DISABLE_STRICT_GATES,
        message: 'PROHIBITED: Bypassing STRICT gates is forbidden (ممنوع إسقاط/تعطيل بوابات STRICT)',
      },
      silent_font_substitution: {
        kind: ProhibitedDegradeKind.SILENT_FONT_SUBSTITUTION,
        message: 'PROHIBITED: Silent font substitution without tracking is forbidden. All substitutions must be recorded.',
      },
      rasterize_text: {
        kind: ProhibitedDegradeKind.RASTERIZE_CORE_CONTENT,
        message: 'PROHIBITED: Rasterizing text is forbidden. Text must remain editable.',
      },
      rasterize_table: {
        kind: ProhibitedDegradeKind.RASTERIZE_CORE_CONTENT,
        message: 'PROHIBITED: Rasterizing tables is forbidden. Tables must remain editable.',
      },
      rasterize_chart: {
        kind: ProhibitedDegradeKind.RASTERIZE_CORE_CONTENT,
        message: 'PROHIBITED: Rasterizing charts is forbidden. Charts must remain editable.',
      },
      rasterize_core_content: {
        kind: ProhibitedDegradeKind.RASTERIZE_CORE_CONTENT,
        message: 'PROHIBITED: Rasterizing core content (text/tables/charts) is forbidden.',
      },
      drop_editability: {
        kind: ProhibitedDegradeKind.DROP_EDITABILITY,
        message: 'PROHIBITED: Dropping editability is forbidden. All elements must remain editable.',
      },
    };

    const normalized = action.toLowerCase().replace(/[\s-]/g, '_');
    const match = prohibitedMap[normalized];

    if (match) {
      throw new Error(`[${match.kind}] ${match.message}`);
    }

    // Also check against ProhibitedDegradeKind enum values directly
    const enumValues = Object.values(ProhibitedDegradeKind) as string[];
    if (enumValues.includes(action)) {
      throw new Error(
        `[${action}] PROHIBITED: Action '${action}' is explicitly forbidden by STRICT degrade policy.`,
      );
    }
  }

  /**
   * Check if an entire page is a single image element — this is PROHIBITED.
   * Returns true if the page violates the rule (entire page is one image).
   */
  checkFullSlideAsImage(page: CdrPage): boolean {
    const allElements: CdrElement[] = [];

    for (const layer of page.layers) {
      for (const element of layer.elements) {
        allElements.push(element);
      }
    }

    // A page is considered a full-slide-as-image if:
    // 1. It has exactly one element
    // 2. That element is an image
    // 3. The image covers >= 95% of the page area
    if (allElements.length !== 1) {
      return false;
    }

    const singleElement = allElements[0];
    if (singleElement.kind !== 'image') {
      return false;
    }

    const pageSizeW = page.size_emu.w;
    const pageSizeH = page.size_emu.h;

    if (pageSizeW <= 0 || pageSizeH <= 0) {
      return false;
    }

    const coverageW = singleElement.bbox_emu.w / pageSizeW;
    const coverageH = singleElement.bbox_emu.h / pageSizeH;

    // If the single image covers 95% or more of the page, it is a prohibited full-slide-as-image
    return coverageW >= 0.95 && coverageH >= 0.95;
  }

  /**
   * Get all degrade records.
   */
  getRecords(): DegradeRecord[] {
    return [...this.records];
  }

  /**
   * Convert degrade records to Warning objects for the evidence pack.
   */
  toWarnings(): Warning[] {
    return this.records.map((record) => {
      switch (record.kind) {
        case DegradeKind.FONT_SUBSTITUTION:
          return {
            code: 'DEGRADE_FONT_SUBSTITUTION',
            message:
              `Font substitution on [${record.element_ids.join(', ')}]: ` +
              `${record.original_state} → ${record.degraded_state}. ` +
              `Reason: ${record.reason}`,
            severity: 'warning' as const,
          };

        case DegradeKind.DECORATIVE_RASTERIZATION:
          return {
            code: 'DEGRADE_DECORATIVE_RASTER',
            message:
              `Decorative element [${record.element_ids.join(', ')}] rasterized: ` +
              `${record.original_state} → ${record.degraded_state}. ` +
              `Core content (text/table/chart) remains editable. Reason: ${record.reason}`,
            severity: 'warning' as const,
          };

        case DegradeKind.SYNTHETIC_DATA_BINDING:
          return {
            code: 'DEGRADE_SYNTHETIC_BINDING',
            message:
              `Synthetic data binding applied on [${record.element_ids.join(', ')}]: ` +
              `${record.original_state} → ${record.degraded_state}. ` +
              `Dashboard visuals use reconstructed bindings. Reason: ${record.reason}`,
            severity: 'warning' as const,
          };

        default: {
          const _exhaustive: never = record.kind;
          throw new Error(`Unknown degrade kind: ${_exhaustive}`);
        }
      }
    });
  }

  /**
   * Validate a full CdrDesign against the degrade policy.
   * Scans the design for any prohibited patterns:
   *   - Full slide/page as single image
   *   - Core content elements that were rasterized
   *   - Elements that lost editability
   */
  validatePolicy(design: CdrDesign): PolicyValidationResult {
    const violations: PolicyViolation[] = [];

    // 1. Check each page for full-slide-as-image prohibition
    for (const page of design.pages) {
      if (this.checkFullSlideAsImage(page)) {
        const elementIds = page.layers.flatMap((l) => l.elements.map((e) => e.element_id));
        violations.push({
          prohibited_kind: ProhibitedDegradeKind.FULL_SLIDE_AS_IMAGE,
          description:
            `Page ${page.index}: Entire page is a single image element. ` +
            `This is PROHIBITED — content MUST remain editable. ` +
            `(ممنوع slide كلها صورة تلقائيًا)`,
          element_ids: elementIds,
          page_index: page.index,
        });
      }
    }

    // 2. Check for rasterized core content by scanning recorded degradations
    const rasterizedCoreElements = this.records.filter((record) => {
      if (record.kind !== DegradeKind.DECORATIVE_RASTERIZATION) {
        return false;
      }
      // Check if the degraded_state mentions a core kind — should not happen
      // if applyDecorativeRasterization works correctly, but defense-in-depth
      return (
        record.degraded_state.includes(':text') ||
        record.degraded_state.includes(':table') ||
        record.degraded_state.includes(':chart')
      );
    });

    for (const record of rasterizedCoreElements) {
      violations.push({
        prohibited_kind: ProhibitedDegradeKind.RASTERIZE_CORE_CONTENT,
        description:
          `Elements [${record.element_ids.join(', ')}] are core content but were rasterized: ` +
          `${record.degraded_state}. Text, tables, and charts MUST NOT be rasterized.`,
        element_ids: record.element_ids,
      });
    }

    // 3. Scan design elements for editability violations:
    //    Find image elements that look like rasterized pages (large images with no siblings)
    //    Also check for elements whose kind suggests they should be editable but aren't
    for (const page of design.pages) {
      this.scanElementsForViolations(page, violations);
    }

    // 4. Cross-reference font substitution records — ensure none are silent (untracked)
    //    The records array IS the tracking, so if a substitution is in records, it is tracked.
    //    This check validates that font_substitution records have non-empty original/degraded states.
    for (const record of this.records) {
      if (record.kind === DegradeKind.FONT_SUBSTITUTION) {
        if (!record.original_state || !record.degraded_state) {
          violations.push({
            prohibited_kind: ProhibitedDegradeKind.SILENT_FONT_SUBSTITUTION,
            description:
              `Font substitution on [${record.element_ids.join(', ')}] is missing ` +
              `original or degraded state. All font substitutions must be fully tracked.`,
            element_ids: record.element_ids,
          });
        }
      }
    }

    const warnings = this.toWarnings();

    return {
      compliant: violations.length === 0,
      violations,
      records: this.getRecords(),
      warnings,
    };
  }

  /**
   * Recursively scan elements on a page for editability violations.
   */
  private scanElementsForViolations(
    page: CdrPage,
    violations: PolicyViolation[],
  ): void {
    const checkElement = (el: CdrElement): void => {
      // Check if a group/container has been collapsed into a single image
      // (indication of dropped editability)
      if (el.kind === 'group' || el.kind === 'container') {
        if (el.children && el.children.length === 1 && el.children[0].kind === 'image') {
          const child = el.children[0];
          const parentArea = el.bbox_emu.w * el.bbox_emu.h;
          const childArea = child.bbox_emu.w * child.bbox_emu.h;

          // If the single image child covers most of the group, it might be
          // a rasterized group (editability dropped)
          if (parentArea > 0 && childArea / parentArea >= 0.95) {
            violations.push({
              prohibited_kind: ProhibitedDegradeKind.DROP_EDITABILITY,
              description:
                `Element '${el.element_id}' (${el.kind}) contains a single image child ` +
                `'${child.element_id}' covering >=95% of its area. ` +
                `This suggests the group was rasterized, dropping editability.`,
              element_ids: [el.element_id, child.element_id],
              page_index: page.index,
            });
          }
        }
      }

      // Recurse into children
      if (el.children) {
        for (const child of el.children) {
          checkElement(child);
        }
      }
    };

    for (const layer of page.layers) {
      for (const el of layer.elements) {
        checkElement(el);
      }
    }
  }
}
