// ─── Evidence Pack Generator (Section 11) ─────────────────────────────
// Complete evidence collection for STRICT 1:1 verification
// Every STRICT run MUST store full evidence chain

import { createHash } from "crypto";

// ─── Types ─────────────────────────────────────────────────────────────

export interface RenderSnapshot {
  readonly page_index: number;
  readonly render_type: "source" | "target" | "overlay" | "diff";
  readonly width: number;
  readonly height: number;
  readonly rgba_hash: string;
  readonly dpi: number;
  readonly color_space: "sRGB";
  readonly timestamp: string;
  readonly buffer_ref: string;
}

export interface PixelDiffReport {
  readonly page_index: number;
  readonly diff_count: number;
  readonly diff_ratio: number;
  readonly heatmap_ref: string;
  readonly hotspot_regions: ReadonlyArray<{
    readonly region_id: string;
    readonly bbox: { x: number; y: number; w: number; h: number };
    readonly pixel_count: number;
    readonly severity: "critical" | "major" | "minor";
  }>;
  readonly passed: boolean;
}

export interface StructuralReport {
  readonly page_index: number;
  readonly total_elements: number;
  readonly editable_elements: number;
  readonly rasterized_elements: number;
  readonly editable_ratio: number;
  readonly text_as_textrun: boolean;
  readonly tables_as_cells: boolean;
  readonly charts_data_bound: boolean;
  readonly violations: ReadonlyArray<{
    readonly element_id: string;
    readonly violation_type: string;
    readonly detail: string;
  }>;
  readonly passed: boolean;
}

export interface DeterminismReport {
  readonly run_count: number;
  readonly engine_fingerprints: string[];
  readonly pixel_hashes: string[];
  readonly render_config_hashes: string[];
  readonly all_identical: boolean;
  readonly anti_aliasing_locked: boolean;
  readonly float_normalization_locked: boolean;
  readonly random_seed_locked: boolean;
  readonly gpu_cpu_parity: boolean;
}

export interface DriftReport {
  readonly svm_results_consistent: boolean;
  readonly max_float_deviation: number;
  readonly tolerance: number;
  readonly excel_recalc_deterministic: boolean;
  readonly affected_cells: ReadonlyArray<{
    readonly cell_ref: string;
    readonly expected: number;
    readonly actual: number;
    readonly deviation: number;
  }>;
}

export interface RepairLogEntry {
  readonly iteration: number;
  readonly repair_type: string;
  readonly target_elements: string[];
  readonly before_diff: number;
  readonly after_diff: number;
  readonly improvement: number;
  readonly duration_ms: number;
  readonly successful: boolean;
}

export interface ReproducibilityPack {
  readonly tool_versions: ReadonlyArray<{ tool: string; version: string; hash: string }>;
  readonly farm_image_id: string;
  readonly farm_image_hash: string;
  readonly fonts_snapshot_id: string;
  readonly fonts_snapshot_hash: string;
  readonly os_image: string;
  readonly renderer_versions: ReadonlyArray<{ renderer: string; version: string }>;
  readonly policy_hash: string;
  readonly execution_seed: string;
  readonly environment_stamp: string;
}

export interface EvidencePackComplete {
  readonly evidence_pack_id: string;
  readonly run_id: string;
  readonly timestamp: string;
  readonly verification_status: "strict_verified" | "degraded" | "failed";

  // Section 11: MUST store
  readonly source_renders: RenderSnapshot[];
  readonly target_renders: RenderSnapshot[];
  readonly pixel_diff_reports: PixelDiffReport[];
  readonly structural_reports: StructuralReport[];
  readonly determinism_report: DeterminismReport;
  readonly drift_report: DriftReport | null;
  readonly repair_log: RepairLogEntry[];
  readonly repro_pack: ReproducibilityPack;

  // Additional evidence
  readonly action_graph_snapshot: string;
  readonly cdr_snapshot_ref: string;
  readonly total_pages: number;
  readonly total_elements: number;
  readonly all_pixel_gates_passed: boolean;
  readonly all_structural_gates_passed: boolean;
  readonly all_determinism_gates_passed: boolean;
  readonly integrity_hash: string;
}

// ─── Evidence Pack Builder ─────────────────────────────────────────────

export class EvidencePackGenerator {
  private run_id: string;
  private source_renders: RenderSnapshot[] = [];
  private target_renders: RenderSnapshot[] = [];
  private pixel_diff_reports: PixelDiffReport[] = [];
  private structural_reports: StructuralReport[] = [];
  private determinism_report: DeterminismReport | null = null;
  private drift_report: DriftReport | null = null;
  private repair_log: RepairLogEntry[] = [];
  private repro_pack: ReproducibilityPack | null = null;
  private action_graph_snapshot: string = "";
  private cdr_snapshot_ref: string = "";
  private total_pages: number = 0;
  private total_elements: number = 0;

  constructor(run_id: string) {
    this.run_id = run_id;
  }

  addSourceRender(snapshot: RenderSnapshot): this {
    this.source_renders.push(snapshot);
    return this;
  }

  addTargetRender(snapshot: RenderSnapshot): this {
    this.target_renders.push(snapshot);
    return this;
  }

  addPixelDiffReport(report: PixelDiffReport): this {
    this.pixel_diff_reports.push(report);
    return this;
  }

  addStructuralReport(report: StructuralReport): this {
    this.structural_reports.push(report);
    return this;
  }

  setDeterminismReport(report: DeterminismReport): this {
    this.determinism_report = report;
    return this;
  }

  setDriftReport(report: DriftReport): this {
    this.drift_report = report;
    return this;
  }

  addRepairLogEntry(entry: RepairLogEntry): this {
    this.repair_log.push(entry);
    return this;
  }

  setReproPack(pack: ReproducibilityPack): this {
    this.repro_pack = pack;
    return this;
  }

  setActionGraphSnapshot(snapshot: string): this {
    this.action_graph_snapshot = snapshot;
    return this;
  }

  setCdrSnapshotRef(ref: string): this {
    this.cdr_snapshot_ref = ref;
    return this;
  }

  setPageStats(total_pages: number, total_elements: number): this {
    this.total_pages = total_pages;
    this.total_elements = total_elements;
    return this;
  }

  // ─── Validation ────────────────────────────────────────────────────

  private validateCompleteness(): string[] {
    const errors: string[] = [];
    if (this.source_renders.length === 0) errors.push("MUST have source renders");
    if (this.target_renders.length === 0) errors.push("MUST have target renders");
    if (this.pixel_diff_reports.length === 0) errors.push("MUST have pixel diff reports");
    if (this.structural_reports.length === 0) errors.push("MUST have structural reports");
    if (!this.determinism_report) errors.push("MUST have determinism report");
    if (!this.repro_pack) errors.push("MUST have reproducibility pack");
    if (!this.action_graph_snapshot) errors.push("MUST have action graph snapshot");
    if (!this.cdr_snapshot_ref) errors.push("MUST have CDR snapshot ref");
    if (this.source_renders.length !== this.target_renders.length) {
      errors.push("Source and target render counts MUST match");
    }
    return errors;
  }

  // ─── Integrity Hash ───────────────────────────────────────────────

  private computeIntegrityHash(pack: Omit<EvidencePackComplete, "integrity_hash">): string {
    const serialized = JSON.stringify({
      run_id: pack.run_id,
      source_hashes: pack.source_renders.map((r) => r.rgba_hash),
      target_hashes: pack.target_renders.map((r) => r.rgba_hash),
      pixel_diffs: pack.pixel_diff_reports.map((r) => r.diff_count),
      structural_passed: pack.structural_reports.map((r) => r.passed),
      determinism: pack.determinism_report.all_identical,
      repro_hash: pack.repro_pack.policy_hash,
    });
    return createHash("sha256").update(serialized).digest("hex");
  }

  // ─── Build ─────────────────────────────────────────────────────────

  build(): EvidencePackComplete {
    const errors = this.validateCompleteness();
    if (errors.length > 0) {
      throw new Error(`Evidence Pack incomplete: ${errors.join("; ")}`);
    }

    const all_pixel_passed = this.pixel_diff_reports.every((r) => r.passed);
    const all_structural_passed = this.structural_reports.every((r) => r.passed);
    const all_determinism_passed = this.determinism_report!.all_identical;

    const verification_status: EvidencePackComplete["verification_status"] =
      all_pixel_passed && all_structural_passed && all_determinism_passed
        ? "strict_verified"
        : all_structural_passed
          ? "degraded"
          : "failed";

    const partial: Omit<EvidencePackComplete, "integrity_hash"> = {
      evidence_pack_id: `evidence-pack-${this.run_id}`,
      run_id: this.run_id,
      timestamp: new Date().toISOString(),
      verification_status,
      source_renders: this.source_renders,
      target_renders: this.target_renders,
      pixel_diff_reports: this.pixel_diff_reports,
      structural_reports: this.structural_reports,
      determinism_report: this.determinism_report!,
      drift_report: this.drift_report,
      repair_log: this.repair_log,
      repro_pack: this.repro_pack!,
      action_graph_snapshot: this.action_graph_snapshot,
      cdr_snapshot_ref: this.cdr_snapshot_ref,
      total_pages: this.total_pages,
      total_elements: this.total_elements,
      all_pixel_gates_passed: all_pixel_passed,
      all_structural_gates_passed: all_structural_passed,
      all_determinism_gates_passed: all_determinism_passed,
    };

    return {
      ...partial,
      integrity_hash: this.computeIntegrityHash(partial),
    };
  }

  // ─── Serialization ────────────────────────────────────────────────

  static serialize(pack: EvidencePackComplete): string {
    return JSON.stringify(pack, null, 2);
  }

  static deserialize(json: string): EvidencePackComplete {
    const parsed = JSON.parse(json) as EvidencePackComplete;
    // Re-verify integrity
    const generator = new EvidencePackGenerator(parsed.run_id);
    const recomputed = createHash("sha256")
      .update(
        JSON.stringify({
          run_id: parsed.run_id,
          source_hashes: parsed.source_renders.map((r) => r.rgba_hash),
          target_hashes: parsed.target_renders.map((r) => r.rgba_hash),
          pixel_diffs: parsed.pixel_diff_reports.map((r) => r.diff_count),
          structural_passed: parsed.structural_reports.map((r) => r.passed),
          determinism: parsed.determinism_report.all_identical,
          repro_hash: parsed.repro_pack.policy_hash,
        })
      )
      .digest("hex");
    if (recomputed !== parsed.integrity_hash) {
      throw new Error("Evidence Pack integrity check failed — data may have been tampered with");
    }
    return parsed;
  }

  // ─── Validate existing pack ───────────────────────────────────────

  static validate(pack: EvidencePackComplete): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Completeness checks
    if (pack.source_renders.length === 0) errors.push("No source renders");
    if (pack.target_renders.length === 0) errors.push("No target renders");
    if (pack.pixel_diff_reports.length === 0) errors.push("No pixel diff reports");
    if (pack.structural_reports.length === 0) errors.push("No structural reports");

    // Consistency checks
    if (pack.source_renders.length !== pack.target_renders.length) {
      errors.push("Source/target render count mismatch");
    }

    // STRICT gate checks
    if (pack.verification_status === "strict_verified") {
      if (!pack.all_pixel_gates_passed) errors.push("Claimed STRICT but pixel gates failed");
      if (!pack.all_structural_gates_passed) errors.push("Claimed STRICT but structural gates failed");
      if (!pack.all_determinism_gates_passed) errors.push("Claimed STRICT but determinism gates failed");
    }

    // Determinism checks
    if (!pack.determinism_report.anti_aliasing_locked) warnings.push("Anti-aliasing not locked");
    if (!pack.determinism_report.float_normalization_locked) warnings.push("Float normalization not locked");
    if (!pack.determinism_report.random_seed_locked) warnings.push("Random seed not locked");

    // Anti-cheating: verify no pixel diff was skipped
    const reported_pages = new Set(pack.pixel_diff_reports.map((r) => r.page_index));
    for (let i = 0; i < pack.total_pages; i++) {
      if (!reported_pages.has(i)) {
        errors.push(`Page ${i} missing pixel diff report — anti-cheating gate failed`);
      }
    }

    // Integrity hash
    try {
      EvidencePackGenerator.deserialize(JSON.stringify(pack));
    } catch {
      errors.push("Integrity hash verification failed");
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ─── Golden Corpus Manager (Section 12) ───────────────────────────────

export interface GoldenCorpusItem {
  readonly corpus_item_id: string;
  readonly category: "pdf_arabic" | "pdf_english" | "pdf_mixed" | "image_table" | "image_dashboard" | "image_infographic" | "image_screenshot" | "gradient" | "mask" | "icon" | "scan";
  readonly source_ref: string;
  readonly source_kind: string;
  readonly target_kind: string;
  readonly expected_structural_hash: string;
  readonly expected_pixel_hash: string;
  readonly expected_fingerprints: {
    layout_hash: string;
    typography_hash: string;
    structural_hash: string;
  };
  readonly tolerance: { pixel_diff_max: 0; structural_score_min: 1.0 };
  readonly evidence_pack_ref: string;
  readonly created_at: string;
  readonly metadata: Record<string, string>;
}

export interface CIGateCheckResult {
  readonly gate_id: string;
  readonly corpus_item_id: string;
  readonly timestamp: string;
  readonly pixel_match: boolean;
  readonly structural_match: boolean;
  readonly determinism_match: boolean;
  readonly drift_match: boolean;
  readonly anti_cheating_passed: boolean;
  readonly overall_passed: boolean;
  readonly failure_reasons: string[];
}

export class GoldenCorpusManager {
  private items: Map<string, GoldenCorpusItem> = new Map();

  addItem(item: GoldenCorpusItem): void {
    this.items.set(item.corpus_item_id, item);
  }

  removeItem(corpus_item_id: string): boolean {
    return this.items.delete(corpus_item_id);
  }

  getItem(corpus_item_id: string): GoldenCorpusItem | undefined {
    return this.items.get(corpus_item_id);
  }

  getAllItems(): GoldenCorpusItem[] {
    return Array.from(this.items.values());
  }

  getItemsByCategory(category: GoldenCorpusItem["category"]): GoldenCorpusItem[] {
    return this.getAllItems().filter((item) => item.category === category);
  }

  // Run CI gate check against a single corpus item
  checkGate(
    item: GoldenCorpusItem,
    actual: {
      structural_hash: string;
      pixel_hash: string;
      determinism_identical: boolean;
      drift_within_tolerance: boolean;
      evidence_complete: boolean;
    }
  ): CIGateCheckResult {
    const pixel_match = actual.pixel_hash === item.expected_pixel_hash;
    const structural_match = actual.structural_hash === item.expected_structural_hash;
    const determinism_match = actual.determinism_identical;
    const drift_match = actual.drift_within_tolerance;
    const anti_cheating_passed = actual.evidence_complete;

    const failure_reasons: string[] = [];
    if (!pixel_match) failure_reasons.push(`PixelDiff != 0 (expected ${item.expected_pixel_hash}, got ${actual.pixel_hash})`);
    if (!structural_match) failure_reasons.push("Structural hash mismatch");
    if (!determinism_match) failure_reasons.push("Determinism check failed");
    if (!drift_match) failure_reasons.push("Drift check failed");
    if (!anti_cheating_passed) failure_reasons.push("Anti-cheating gate: incomplete evidence");

    return {
      gate_id: `ci-gate-${item.corpus_item_id}-${Date.now()}`,
      corpus_item_id: item.corpus_item_id,
      timestamp: new Date().toISOString(),
      pixel_match,
      structural_match,
      determinism_match,
      drift_match,
      anti_cheating_passed,
      overall_passed: pixel_match && structural_match && determinism_match && drift_match && anti_cheating_passed,
      failure_reasons,
    };
  }

  // Run full CI gate suite — blocks merge if ANY fail
  runFullCIGateSuite(
    actuals: Map<
      string,
      {
        structural_hash: string;
        pixel_hash: string;
        determinism_identical: boolean;
        drift_within_tolerance: boolean;
        evidence_complete: boolean;
      }
    >
  ): { passed: boolean; results: CIGateCheckResult[]; summary: string } {
    const results: CIGateCheckResult[] = [];
    for (const item of this.items.values()) {
      const actual = actuals.get(item.corpus_item_id);
      if (!actual) {
        results.push({
          gate_id: `ci-gate-${item.corpus_item_id}-missing`,
          corpus_item_id: item.corpus_item_id,
          timestamp: new Date().toISOString(),
          pixel_match: false,
          structural_match: false,
          determinism_match: false,
          drift_match: false,
          anti_cheating_passed: false,
          overall_passed: false,
          failure_reasons: ["No test results provided for this corpus item"],
        });
        continue;
      }
      results.push(this.checkGate(item, actual));
    }

    const passed = results.every((r) => r.overall_passed);
    const failed_count = results.filter((r) => !r.overall_passed).length;
    const summary = passed
      ? `All ${results.length} CI gates passed — merge allowed`
      : `${failed_count}/${results.length} CI gates FAILED — merge BLOCKED`;

    return { passed, results, summary };
  }

  // Serialization
  serialize(): string {
    return JSON.stringify(this.getAllItems(), null, 2);
  }

  static deserialize(json: string): GoldenCorpusManager {
    const manager = new GoldenCorpusManager();
    const items = JSON.parse(json) as GoldenCorpusItem[];
    for (const item of items) {
      manager.addItem(item);
    }
    return manager;
  }
}
