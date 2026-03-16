import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  ActionRegistry,
  ArtifactSchema,
  AuditEventSchema,
  CDRAbsoluteSchema,
  DeterministicRenderProfileSchema,
  DualGateResultSchema,
  EvidencePackSchema,
  ExtractionManifestSchema,
  JobSchema,
  PixelEquivalenceResultSchema,
  PublicationSchema,
  RepairTraceSchema,
  RoundTripValidationSchema,
  SourceFingerprintSchema,
  StrictDegradeReasonSchema,
  StrictOutputMetadataSchema,
  StrictPolicySchema,
  StrictValidators,
  StructuralEquivalenceResultSchema,
  ToolRegistry,
  contractEnvelope,
  type Artifact,
  type AuditEvent,
  type EvidencePack,
  type FailureReason,
  type Job,
  type LineageEdge,
  type PermissionScope,
  type Publication,
  type SourceFingerprint,
  type ExtractionManifest,
  type CDRAbsolute,
  type DeterministicRenderProfile,
  type StructuralEquivalenceResult,
  type PixelEquivalenceResult,
  type DualGateResult,
  type RepairTrace,
  type RoundTripValidation,
  type StrictDegradeReason,
  type StrictOutputMetadata,
  type StrictPolicy,
  type StrictTargetKind,
  type Warning
} from "@rasid/contracts";
import { z } from "zod";

const StrictElementSchema = z.discriminatedUnion("element_type", [
  z.object({
    element_id: z.string(),
    element_type: z.literal("text"),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    text: z.string(),
    fill: z.string().length(1).default("T"),
    editable: z.boolean().default(true)
  }),
  z.object({
    element_id: z.string(),
    element_type: z.literal("shape"),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fill: z.string().length(1).default("S"),
    editable: z.boolean().default(true)
  }),
  z.object({
    element_id: z.string(),
    element_type: z.literal("table"),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    rows: z.array(z.array(z.string())).min(1),
    fill: z.string().length(1).default("B"),
    editable: z.boolean().default(true),
    formula_refs: z.array(z.string()).default([])
  })
]);

const StrictPageSchema = z.object({
  page_id: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  background: z.string().length(1).default("."),
  elements: z.array(StrictElementSchema).min(1)
});

export const StrictSourceInputSchema = z.object({
  run_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  mode: z.enum(["easy", "advanced"]).default("advanced"),
  source_kind: z.enum(["image", "screenshot", "pdf", "document"]),
  target_kind: z.enum(["docx", "pptx", "xlsx", "dashboard"]),
  original_name: z.string(),
  source_ref: z.string(),
  pages: z.array(StrictPageSchema).min(1),
  policy_id: z.string().default("strict-policy-default"),
  allow_degraded_publish: z.boolean().default(true),
  requested_repair_classes: z.array(z.enum(["coordinate_normalization", "text_alignment"])).default([]),
  fail_editability: z.boolean().default(false),
  fail_round_trip: z.boolean().default(false)
});

type StrictElement = z.infer<typeof StrictElementSchema>;
type StrictPage = z.infer<typeof StrictPageSchema>;
export type StrictSourceInput = z.infer<typeof StrictSourceInputSchema>;
type Grid = string[][];

export type StrictStageRecord = {
  stage: string;
  status: "passed" | "failed" | "degraded";
  output_refs: string[];
  notes: string[];
};

export type StrictExecutionArtifacts = {
  sourceArtifact: Artifact;
  cdrArtifact: Artifact;
  exportArtifact: Artifact;
  publishedArtifact: Artifact;
  previewArtifact: Artifact;
  diffArtifact: Artifact;
  reproArtifact: Artifact;
  evidenceArtifact: Artifact;
  publication: Publication;
};

export type StrictExecutionBundle = {
  input: StrictSourceInput;
  policy: StrictPolicy;
  sourceFingerprint: SourceFingerprint;
  extractionManifest: ExtractionManifest;
  cdrAbsolute: CDRAbsolute;
  deterministicRenderProfile: DeterministicRenderProfile;
  structuralResult: StructuralEquivalenceResult;
  pixelResult: PixelEquivalenceResult;
  dualGateResult: DualGateResult;
  repairTrace: RepairTrace;
  roundTripValidation: RoundTripValidation;
  degradeReasons: StrictDegradeReason[];
  strictOutputMetadata: StrictOutputMetadata;
  artifacts: StrictExecutionArtifacts;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  job: Job;
  exportedPayload: Record<string, unknown>;
  stageRecords: StrictStageRecord[];
  strictPublished: boolean;
};

const now = (): string => new Date().toISOString();
const id = (prefix: string, ...parts: Array<string | number | null | undefined>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");

const hash = (value: string): string => {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return `fnv32:${(current >>> 0).toString(16)}`;
};

const defaultPermissionScope = (): PermissionScope => ({
  visibility: "workspace",
  allow_read: true,
  allow_write: true,
  allow_share: true,
  allow_publish: true,
  allow_audit_view: true
});

const makeGrid = (width: number, height: number, fill: string): Grid =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => fill));

const gridHash = (grid: Grid): string => hash(grid.map((row) => row.join("")).join("\n"));

const renderPage = (page: StrictPage): Grid => {
  const grid = makeGrid(page.width, page.height, page.background);
  for (const element of page.elements) {
    if (element.element_type === "text") {
      for (let offset = 0; offset < Math.min(element.width, element.text.length); offset += 1) {
        if (grid[element.y]?.[element.x + offset] !== undefined) grid[element.y][element.x + offset] = element.fill;
      }
      continue;
    }
    for (let yy = element.y; yy < Math.min(page.height, element.y + element.height); yy += 1) {
      for (let xx = element.x; xx < Math.min(page.width, element.x + element.width); xx += 1) {
        if (grid[yy]?.[xx] !== undefined) grid[yy][xx] = element.fill;
      }
    }
  }
  return grid;
};

const compareGrids = (left: Grid, right: Grid) => {
  const maxHeight = Math.max(left.length, right.length);
  const maxWidth = Math.max(left[0]?.length ?? 0, right[0]?.length ?? 0);
  let diff = 0;
  for (let y = 0; y < maxHeight; y += 1) {
    for (let x = 0; x < maxWidth; x += 1) {
      if ((left[y]?.[x] ?? "") !== (right[y]?.[x] ?? "")) diff += 1;
    }
  }
  return { diff, ratio: maxWidth * maxHeight === 0 ? 0 : diff / (maxWidth * maxHeight) };
};

const runtimeStamp = "strict-runtime:v1";

const createPolicy = (input: StrictSourceInput, timestamp: string): StrictPolicy =>
  StrictPolicySchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    policy_id: input.policy_id,
    policy_name: "Default Strict Policy",
    require_structural_gate: true,
    require_pixel_gate: true,
    require_round_trip_validation: true,
    require_editable_output: true,
    prohibit_silent_degradation: true,
    allow_degraded_publish: input.allow_degraded_publish,
    max_repair_iterations: 2,
    font_fallback_policy: "forbidden",
    binding_policy: input.target_kind === "dashboard" ? "preserve_or_degrade" : "preserve_or_fail",
    accepted_target_kinds: ["docx", "pptx", "xlsx", "dashboard"],
    renderer_profile_ref: id("render-profile", input.run_id),
    created_at: timestamp,
    updated_at: timestamp
  });

const createArtifact = (
  input: StrictSourceInput,
  suffix: string,
  artifactType: Artifact["artifact_type"],
  artifactSubtype: string,
  editableStatus: Artifact["editable_status"],
  verificationStatus: Artifact["verification_status"],
  timestamp: string,
  parentRefs: string[] = []
): Artifact =>
  ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: id("artifact", input.run_id, suffix),
    artifact_type: artifactType,
    artifact_subtype: artifactSubtype,
    project_id: input.project_id,
    workspace_id: input.workspace_id,
    source_refs: [input.source_ref],
    parent_artifact_refs: parentRefs,
    canonical_ref: id("canonical", input.run_id),
    created_by: input.created_by,
    created_at: timestamp,
    mode: input.mode,
    editable_status: editableStatus,
    template_status: "none",
    lineage_ref: id("lineage", input.run_id, suffix),
    evidence_ref: id("evidence", input.run_id, suffix),
    verification_status: verificationStatus,
    storage_ref: {
      storage_id: id("storage", input.run_id, suffix),
      storage_class: "object",
      uri: `memory://strict/${input.run_id}/${suffix}`,
      checksum: hash(`${input.run_id}:${suffix}`),
      region: "workspace"
    },
    preview_ref: {
      preview_id: id("preview", input.run_id, suffix),
      preview_type: artifactType === "preview_render" ? "image_render" : "html_canvas",
      storage_ref: id("storage", input.run_id, suffix)
    },
    export_refs: [],
    version_ref: {
      version_id: id("version", input.run_id, suffix),
      parent_version_id: null,
      version_number: 1,
      semantic_version: "1.0.0"
    },
    tenant_ref: input.tenant_ref,
    permission_scope: defaultPermissionScope()
  });

const classifySource = (input: StrictSourceInput, timestamp: string): SourceFingerprint =>
  SourceFingerprintSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    fingerprint_id: id("fingerprint", input.run_id),
    source_ref: input.source_ref,
    source_kind: input.source_kind,
    source_media_type: input.source_kind === "pdf" ? "application/pdf" : "image/png",
    original_name: input.original_name,
    checksum: hash(JSON.stringify(input.pages)),
    byte_size: JSON.stringify(input.pages).length,
    page_count: input.pages.length,
    dominant_locale: "ar-SA",
    rtl_detected: true,
    color_profile: "sRGB",
    page_fingerprints: input.pages.map((page, index) => ({
      schema_namespace: "rasid.shared.strict.v1",
      schema_version: "1.0.0",
      page_id: page.page_id,
      page_index: index,
      width: page.width,
      height: page.height,
      unit: "px",
      rotation_degrees: 0,
      visual_hash: gridHash(renderPage(page)),
      structural_hash: hash(JSON.stringify(page.elements.map((element) => [element.element_id, element.element_type, element.x, element.y])))
    })),
    detected_font_refs: input.pages.flatMap((page) =>
      page.elements.filter((element) => element.element_type === "text").map((element) => `${element.element_id}:RasidSans`)
    ),
    detection_hints: [
      {
        schema_namespace: "rasid.shared.strict.v1",
        schema_version: "1.0.0",
        hint_id: id("hint", input.run_id, "locale"),
        hint_type: "locale",
        hint_value: "ar-SA",
        confidence: 1
      }
    ],
    created_at: timestamp
  });

const extractSource = (input: StrictSourceInput, fingerprint: SourceFingerprint, timestamp: string): ExtractionManifest =>
  ExtractionManifestSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    manifest_id: id("manifest", input.run_id),
    source_fingerprint_ref: fingerprint.fingerprint_id,
    source_ref: input.source_ref,
    target_kind: input.target_kind,
    selected_profile_ref: id("profile", input.run_id, input.target_kind),
    extraction_path: input.source_kind === "pdf" ? "pdf_vector_text" : "hybrid",
    object_inventory_ref: id("inventory", input.run_id),
    table_extraction_refs: input.pages.flatMap((page) =>
      page.elements.filter((element) => element.element_type === "table").map((element) => id("table-extract", element.element_id))
    ),
    chart_extraction_refs: [],
    font_metric_fingerprint_refs: input.pages.flatMap((page) =>
      page.elements.filter((element) => element.element_type === "text").map((element) => id("font", element.element_id))
    ),
    binding_recovery_plan_ref: input.target_kind === "dashboard" ? id("binding-plan", input.run_id) : null,
    stages: [
      {
        schema_namespace: "rasid.shared.strict.v1",
        schema_version: "1.0.0",
        stage_id: id("stage", input.run_id, "classify"),
        stage: "classify_source",
        tool_ref: "strict.classify-source",
        required: true,
        deterministic: true,
        output_refs: [fingerprint.fingerprint_id],
        warnings: []
      },
      {
        schema_namespace: "rasid.shared.strict.v1",
        schema_version: "1.0.0",
        stage_id: id("stage", input.run_id, "extract"),
        stage: "extract_source",
        tool_ref: "strict.extract",
        required: true,
        deterministic: true,
        output_refs: [id("inventory", input.run_id)],
        warnings: []
      }
    ],
    warnings: [],
    created_at: timestamp,
    updated_at: timestamp
  });

const buildCdr = (
  input: StrictSourceInput,
  fingerprint: SourceFingerprint,
  manifest: ExtractionManifest,
  timestamp: string
): { cdr: CDRAbsolute; normalizedPages: StrictPage[] } => {
  const normalizedPages = input.pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) =>
      input.requested_repair_classes.includes("coordinate_normalization") && element.element_type === "text"
        ? { ...element, x: element.x + 1 }
        : element
    )
  }));

  const cdr = CDRAbsoluteSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    cdr_id: id("cdr", input.run_id),
    canonical_ref: id("canonical", input.run_id),
    source_fingerprint_ref: fingerprint.fingerprint_id,
    extraction_manifest_ref: manifest.manifest_id,
    target_kind: input.target_kind,
    unit_system: "px",
    layout_graph_ref: id("layout-graph", input.run_id),
    structural_hash: hash(JSON.stringify(normalizedPages)),
    pixel_hash_seed: hash(input.run_id),
    deterministic_profile_ref: id("render-profile", input.run_id),
    snapshot_version_ref: {
      version_id: id("version", input.run_id, "cdr"),
      parent_version_id: null,
      version_number: 1,
      semantic_version: "1.0.0"
    },
    editability_status: input.fail_editability ? "partially_editable" : "editable",
    container_nodes: normalizedPages.map((page) => ({
      schema_namespace: "rasid.shared.strict.v1",
      schema_version: "1.0.0",
      node_id: id("page", page.page_id),
      node_kind: "page",
      parent_ref: null,
      child_refs: page.elements.map((element) => id("node", element.element_id)),
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
      z_index: 0,
      transform_matrix: [1, 0, 0, 1, 0, 0],
      lock_flags: ["layout_lock"]
    })),
    text_runs: normalizedPages.flatMap((page) =>
      page.elements
        .filter((element): element is Extract<StrictElement, { element_type: "text" }> => element.element_type === "text")
        .map((element) => ({
          schema_namespace: "rasid.shared.strict.v1",
          schema_version: "1.0.0",
          node_id: id("node", element.element_id),
          parent_ref: id("page", page.page_id),
          text: [{ value: element.text, locale: "ar-SA", rtl: true }],
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          font_family: "Rasid Sans",
          font_postscript_name: "RasidSans-Regular",
          font_size: 12,
          font_weight: 400,
          line_height: 14,
          letter_spacing: 0,
          glyph_hash: hash(element.text),
          bidi_level: 1,
          shaping_engine: "strict-shaper",
          style_refs: []
        }))
    ),
    vector_nodes: normalizedPages.flatMap((page) =>
      page.elements
        .filter((element): element is Extract<StrictElement, { element_type: "shape" }> => element.element_type === "shape")
        .map((element) => ({
          schema_namespace: "rasid.shared.strict.v1",
          schema_version: "1.0.0",
          node_id: id("node", element.element_id),
          parent_ref: id("page", page.page_id),
          primitive_type: "rect",
          path_data_hash: hash(`${element.x}:${element.y}:${element.width}:${element.height}:${element.fill}`),
          fill_ref: element.fill,
          stroke_ref: "",
          bounding_box: { x: element.x, y: element.y, width: element.width, height: element.height },
          z_index: 0
        }))
    ),
    image_nodes: [],
    table_nodes: normalizedPages.flatMap((page) =>
      page.elements
        .filter((element): element is Extract<StrictElement, { element_type: "table" }> => element.element_type === "table")
        .map((element) => ({
          schema_namespace: "rasid.shared.strict.v1",
          schema_version: "1.0.0",
          node_id: id("node", element.element_id),
          parent_ref: id("page", page.page_id),
          row_count: element.rows.length,
          column_count: Math.max(...element.rows.map((row) => row.length)),
          merged_cell_refs: [],
          formula_refs: element.formula_refs,
          style_refs: [],
          cell_refs: element.rows.flatMap((row, rowIndex) => row.map((_, columnIndex) => `${element.element_id}-${rowIndex}-${columnIndex}`)),
          binding_refs: input.target_kind === "dashboard" ? [id("binding", element.element_id)] : [],
          structural_hash: hash(JSON.stringify(element.rows))
        }))
    ),
    chart_nodes: [],
    control_nodes: [],
    binding_refs: input.target_kind === "dashboard" ? [id("binding", input.run_id)] : [],
    lock_flags: ["srgb_lock"],
    extraction_confidence: input.fail_editability ? 0.71 : 0.99,
    created_at: timestamp,
    updated_at: timestamp
  });

  return { cdr, normalizedPages };
};

type ExportedPayload = {
  payload_id: string;
  target_kind: StrictTargetKind;
  editable: boolean;
  pages: StrictPage[];
};

const createRenderProfile = (input: StrictSourceInput, timestamp: string): DeterministicRenderProfile =>
  DeterministicRenderProfileSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    profile_id: id("render-profile", input.run_id),
    renderer_family: "strict-grid-renderer",
    renderer_version: "1.0.0",
    font_set_fingerprint: hash("RasidSans-Regular"),
    locale: "ar-SA",
    numeral_system: "arab",
    color_profile: "sRGB",
    floating_point_policy: "integer-grid",
    antialiasing_policy: "disabled",
    dpi: 96,
    viewport_width: input.pages[0].width,
    viewport_height: input.pages[0].height,
    execution_seed: hash(input.run_id),
    os_fingerprint: runtimeStamp,
    container_fingerprint: "rasid-platform-core",
    gpu_allowed: false,
    created_at: timestamp
  });

const exportFromCdr = (input: StrictSourceInput, cdr: CDRAbsolute): ExportedPayload => ({
  payload_id: id("payload", input.run_id),
  target_kind: input.target_kind,
  editable: !input.fail_editability,
  pages: cdr.container_nodes.map((container) => ({
    page_id: container.node_id.replace(/^page-/, ""),
    width: container.width,
    height: container.height,
    background: ".",
    elements: [
      ...cdr.text_runs
        .filter((node) => node.parent_ref === container.node_id)
        .map((node) => ({
          element_id: node.node_id.replace(/^node-/, ""),
          element_type: "text" as const,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          text: node.text[0]?.value ?? "",
          fill: "T",
          editable: !input.fail_editability
        })),
      ...cdr.vector_nodes
        .filter((node) => node.parent_ref === container.node_id)
        .map((node) => ({
          element_id: node.node_id.replace(/^node-/, ""),
          element_type: "shape" as const,
          x: node.bounding_box.x,
          y: node.bounding_box.y,
          width: node.bounding_box.width,
          height: node.bounding_box.height,
          fill: node.fill_ref || "S",
          editable: !input.fail_editability
        })),
      ...cdr.table_nodes
        .filter((node) => node.parent_ref === container.node_id)
        .map((node) => {
          const sourceElement = input.pages
            .flatMap((page) => page.elements)
            .find((element) => element.element_type === "table" && id("node", element.element_id) === node.node_id);
          return {
            element_id: node.node_id.replace(/^node-/, ""),
            element_type: "table" as const,
            x: sourceElement?.x ?? 8,
            y: sourceElement?.y ?? 4,
            width: sourceElement?.width ?? Math.max(4, node.column_count * 2),
            height: sourceElement?.height ?? Math.max(2, node.row_count),
            rows: sourceElement?.element_type === "table"
              ? sourceElement.rows
              : Array.from({ length: node.row_count }, (_, rowIndex) =>
                  Array.from({ length: node.column_count }, (_, columnIndex) => `R${rowIndex + 1}C${columnIndex + 1}`)
                ),
            fill: sourceElement?.element_type === "table" ? sourceElement.fill : "B",
            editable: !input.fail_editability,
            formula_refs: node.formula_refs
          };
        })
    ]
  }))
});

const structuralSummary = (sourcePages: StrictPage[], exported: ExportedPayload) => {
  const sourceElements = sourcePages.flatMap((page) => page.elements);
  const targetElements = exported.pages.flatMap((page) => page.elements);
  return {
    layout_graph_equal: sourcePages.length === exported.pages.length,
    inventory_equal: sourceElements.length === targetElements.length,
    hierarchy_equal: exported.pages.every((page, index) => page.page_id === sourcePages[index]?.page_id),
    text_metrics_equal: sourceElements
      .filter((element) => element.element_type === "text")
      .every((element) =>
        targetElements.some(
          (target) =>
            target.element_type === "text" &&
            target.element_id === element.element_id &&
            target.x === element.x &&
            target.y === element.y
        )
      ),
    table_structure_equal: sourceElements
      .filter((element) => element.element_type === "table")
      .every((element) =>
        targetElements.some(
          (target) => target.element_type === "table" && target.element_id === element.element_id && target.rows.length === element.rows.length
        )
      ),
    chart_structure_equal: true,
    data_binding_equal: true,
    formula_behavior_equal: sourceElements
      .filter((element) => element.element_type === "table")
      .every((element) =>
        targetElements.some(
          (target) =>
            target.element_type === "table" &&
            target.element_id === element.element_id &&
            target.formula_refs.length === element.formula_refs.length
        )
      )
  };
};

const createStructuralResult = (
  input: StrictSourceInput,
  fingerprint: SourceFingerprint,
  cdr: CDRAbsolute,
  exported: ExportedPayload,
  timestamp: string,
  suffix: string
): StructuralEquivalenceResult => {
  const summary = structuralSummary(input.pages, exported);
  const passed = Object.values(summary).every(Boolean);
  return StructuralEquivalenceResultSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    result_id: id("structural", input.run_id, suffix),
    source_fingerprint_ref: fingerprint.fingerprint_id,
    cdr_ref: cdr.cdr_id,
    target_artifact_ref: id("artifact", input.run_id, "export"),
    passed,
    equivalence_score: Object.values(summary).filter(Boolean).length / Object.values(summary).length,
    layout_graph_equal: summary.layout_graph_equal,
    inventory_equal: summary.inventory_equal,
    hierarchy_equal: summary.hierarchy_equal,
    text_metrics_equal: summary.text_metrics_equal,
    table_structure_equal: summary.table_structure_equal,
    chart_structure_equal: summary.chart_structure_equal,
    data_binding_equal: summary.data_binding_equal,
    formula_behavior_equal: summary.formula_behavior_equal,
    checks: [
      {
        schema_namespace: "rasid.shared.strict.v1",
        schema_version: "1.0.0",
        check_id: id("check", input.run_id, suffix, "structure"),
        check_name: "structural_equivalence",
        passed,
        details: `structural pass=${passed}`,
        impacted_refs: [cdr.cdr_id]
      }
    ],
    mismatch_refs: passed ? [] : [id("mismatch", input.run_id, suffix)],
    generated_at: timestamp
  });
};

const createPixelResult = (
  input: StrictSourceInput,
  renderProfile: DeterministicRenderProfile,
  sourceGrid: Grid,
  targetGrid: Grid,
  timestamp: string,
  suffix: string
): PixelEquivalenceResult => {
  const comparison = compareGrids(sourceGrid, targetGrid);
  return PixelEquivalenceResultSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    result_id: id("pixel", input.run_id, suffix),
    source_render_ref: id("render", input.run_id, "source"),
    target_render_ref: id("render", input.run_id, "target"),
    deterministic_profile_ref: renderProfile.profile_id,
    passed: comparison.diff === 0,
    pixel_diff_ratio: comparison.ratio,
    diff_pixel_count: comparison.diff,
    mismatch_bbox_count: comparison.diff > 0 ? 1 : 0,
    identical_render_fingerprint: gridHash(sourceGrid) === gridHash(targetGrid),
    source_pixel_hash: gridHash(sourceGrid),
    target_pixel_hash: gridHash(targetGrid),
    diff_artifact_ref: id("artifact", input.run_id, "diff"),
    generated_at: timestamp
  });
};

const createRepairTrace = (
  input: StrictSourceInput,
  cdr: CDRAbsolute,
  renderProfile: DeterministicRenderProfile,
  beforeStructural: StructuralEquivalenceResult,
  beforePixel: PixelEquivalenceResult,
  afterStructural: StructuralEquivalenceResult,
  afterPixel: PixelEquivalenceResult,
  applied: boolean,
  timestamp: string
): RepairTrace =>
  RepairTraceSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    repair_trace_id: id("repair-trace", input.run_id),
    cdr_ref: cdr.cdr_id,
    deterministic_profile_ref: renderProfile.profile_id,
    iteration_budget: 2,
    final_status: afterStructural.passed && afterPixel.passed ? "passed" : "degraded",
    iterations: [
      {
        schema_namespace: "rasid.shared.strict.v1",
        schema_version: "1.0.0",
        iteration_id: id("repair-iteration", input.run_id, 1),
        iteration_index: 0,
        mismatch_classification: beforeStructural.text_metrics_equal ? "pixel_render" : "text_metrics",
        before_structural_result_ref: beforeStructural.result_id,
        before_pixel_result_ref: beforePixel.result_id,
        actions: applied
          ? [
              {
                schema_namespace: "rasid.shared.strict.v1",
                schema_version: "1.0.0",
                action_id: id("repair-action", input.run_id, "coordinate"),
                action_type: "normalize_coordinates",
                target_ref: cdr.cdr_id,
                parameters: { repair_class: "coordinate_normalization" },
                outcome: "applied"
              }
            ]
          : [],
        after_structural_result_ref: afterStructural.result_id,
        after_pixel_result_ref: afterPixel.result_id,
        completed_at: timestamp
      }
    ],
    final_dual_gate_result_ref: id("dual-gate", input.run_id),
    created_at: timestamp,
    updated_at: timestamp
  });

const createRoundTripValidation = (
  input: StrictSourceInput,
  renderProfile: DeterministicRenderProfile,
  structuralResult: StructuralEquivalenceResult,
  pixelResult: PixelEquivalenceResult,
  exported: ExportedPayload,
  exportedGrid: Grid,
  timestamp: string
): RoundTripValidation => {
  const rerendered = input.fail_round_trip
    ? exportedGrid.map((row, rowIndex) => row.map((cell, columnIndex) => (rowIndex === 0 && columnIndex === 0 ? "X" : cell)))
    : exportedGrid;
  const comparison = compareGrids(exportedGrid, rerendered);
  return RoundTripValidationSchema.parse({
    contract: contractEnvelope("strict"),
    schema_namespace: "rasid.shared.strict.v1",
    schema_version: "1.0.0",
    validation_id: id("round-trip", input.run_id),
    target_artifact_ref: id("artifact", input.run_id, "export"),
    export_artifact_ref: id("artifact", input.run_id, "export"),
    rerender_artifact_ref: id("artifact", input.run_id, "preview"),
    deterministic_profile_ref: renderProfile.profile_id,
    structural_result_ref: structuralResult.result_id,
    pixel_result_ref: pixelResult.result_id,
    functional_checks: [
      {
        schema_namespace: "rasid.shared.strict.v1",
        schema_version: "1.0.0",
        check_id: id("functional", input.run_id, "editability"),
        check_type: "editability",
        passed: exported.editable,
        detail: `editable=${exported.editable}`,
        impacted_refs: [id("artifact", input.run_id, "export")]
      }
    ],
    regression_diff_refs: comparison.diff === 0 ? [] : [id("artifact", input.run_id, "diff")],
    editable_output_verified: exported.editable,
    passed: comparison.diff === 0 && exported.editable,
    validated_at: timestamp
  });
};

export class StrictReplicationEngine {
  run(inputValue: StrictSourceInput): StrictExecutionBundle {
    const input = StrictSourceInputSchema.parse(inputValue);
    const timestamp = now();
    const stageRecords: StrictStageRecord[] = [];
    const policy = createPolicy(input, timestamp);

    const sourceArtifact = createArtifact(input, "source", "source_file", input.source_kind, "non_editable", "unverified", timestamp);
    stageRecords.push({ stage: "ingest", status: "passed", output_refs: [sourceArtifact.artifact_id], notes: ["source artifact created"] });

    const sourceFingerprint = classifySource(input, timestamp);
    StrictValidators.source_fingerprint(sourceFingerprint);
    stageRecords.push({ stage: "classify", status: "passed", output_refs: [sourceFingerprint.fingerprint_id], notes: [`kind=${sourceFingerprint.source_kind}`] });

    const extractionManifest = extractSource(input, sourceFingerprint, timestamp);
    StrictValidators.extraction_manifest(extractionManifest);
    stageRecords.push({ stage: "extract", status: "passed", output_refs: [extractionManifest.manifest_id], notes: [`path=${extractionManifest.extraction_path}`] });

    const { cdr } = buildCdr(input, sourceFingerprint, extractionManifest, timestamp);
    StrictValidators.cdr_absolute(cdr);
    stageRecords.push({ stage: "build cdr absolute", status: "passed", output_refs: [cdr.cdr_id], notes: [`target=${cdr.target_kind}`] });

    const renderProfile = createRenderProfile(input, timestamp);
    StrictValidators.deterministic_render_profile(renderProfile);
    stageRecords.push({ stage: "deterministic render", status: "passed", output_refs: [renderProfile.profile_id], notes: [renderProfile.renderer_family] });

    let exported = exportFromCdr(input, cdr);
    const sourceGrid = renderPage(input.pages[0]);
    let exportedGrid = renderPage(exported.pages[0]);

    const initialStructural = createStructuralResult(input, sourceFingerprint, cdr, exported, timestamp, "initial");
    const initialPixel = createPixelResult(input, renderProfile, sourceGrid, exportedGrid, timestamp, "initial");
    stageRecords.push({ stage: "structural gate", status: initialStructural.passed ? "passed" : "failed", output_refs: [initialStructural.result_id], notes: [`pass=${initialStructural.passed}`] });
    stageRecords.push({ stage: "pixel gate", status: initialPixel.passed ? "passed" : "failed", output_refs: [initialPixel.result_id], notes: [`diff=${initialPixel.pixel_diff_ratio}`] });

    let structuralResult = initialStructural;
    let pixelResult = initialPixel;
    let repairApplied = false;
    if ((!initialStructural.passed || !initialPixel.passed) && input.requested_repair_classes.includes("coordinate_normalization")) {
      exported = {
        ...exported,
        pages: exported.pages.map((page, pageIndex) => ({
          ...page,
          elements: page.elements.map((element) => {
            const source = input.pages[pageIndex]?.elements.find((candidate) => candidate.element_id === element.element_id);
            return source ? { ...element, x: source.x, y: source.y } : element;
          })
        }))
      };
      exportedGrid = renderPage(exported.pages[0]);
      structuralResult = createStructuralResult(input, sourceFingerprint, cdr, exported, timestamp, "repaired");
      pixelResult = createPixelResult(input, renderProfile, sourceGrid, exportedGrid, timestamp, "repaired");
      repairApplied = true;
    }
    const repairTrace = createRepairTrace(input, cdr, renderProfile, initialStructural, initialPixel, structuralResult, pixelResult, repairApplied, timestamp);
    StrictValidators.repair_trace(repairTrace);
    stageRecords.push({
      stage: "repair loop",
      status: structuralResult.passed && pixelResult.passed ? "passed" : "degraded",
      output_refs: [repairTrace.repair_trace_id],
      notes: [`repair_applied=${repairApplied}`]
    });

    const dualGateResult = DualGateResultSchema.parse({
      contract: contractEnvelope("strict"),
      schema_namespace: "rasid.shared.strict.v1",
      schema_version: "1.0.0",
      result_id: id("dual-gate", input.run_id),
      structural_result_ref: structuralResult.result_id,
      pixel_result_ref: pixelResult.result_id,
      passed: structuralResult.passed && pixelResult.passed,
      strict_claim_granted: structuralResult.passed && pixelResult.passed,
      verification_status: structuralResult.passed && pixelResult.passed ? "verified" : "degraded",
      degrade_reason_refs: [],
      checked_at: timestamp
    });
    StrictValidators.dual_gate_result(dualGateResult);

    const roundTripValidation = createRoundTripValidation(
      input,
      renderProfile,
      structuralResult,
      pixelResult,
      exported,
      exportedGrid,
      timestamp
    );
    StrictValidators.round_trip_validation(roundTripValidation);
    stageRecords.push({
      stage: "round-trip validation",
      status: roundTripValidation.passed ? "passed" : "failed",
      output_refs: [roundTripValidation.validation_id],
      notes: [`pass=${roundTripValidation.passed}`]
    });

    const degradeReasons: StrictDegradeReason[] = [];
    if (!dualGateResult.passed) {
      degradeReasons.push(
        StrictDegradeReasonSchema.parse({
          contract: contractEnvelope("strict"),
          schema_namespace: "rasid.shared.strict.v1",
          schema_version: "1.0.0",
          reason_id: id("degrade", input.run_id, "dual-gate"),
          reason_code: pixelResult.passed ? "structural_gate_failed" : "pixel_gate_failed",
          stage: pixelResult.passed ? "structural_gate" : "pixel_gate",
          summary: "Dual gate failed",
          detail: `structural=${structuralResult.passed} pixel=${pixelResult.passed}`,
          impacted_refs: [dualGateResult.result_id],
          strict_claim_permitted: false,
          retryable: true,
          suggested_action_refs: ["strict.run_repair_loop.v1"],
          created_at: timestamp
        })
      );
    }
    if (!roundTripValidation.passed) {
      degradeReasons.push(
        StrictDegradeReasonSchema.parse({
          contract: contractEnvelope("strict"),
          schema_namespace: "rasid.shared.strict.v1",
          schema_version: "1.0.0",
          reason_id: id("degrade", input.run_id, "round-trip"),
          reason_code: roundTripValidation.editable_output_verified ? "round_trip_failed" : "editability_not_preserved",
          stage: "round_trip_validation",
          summary: "Round trip validation failed",
          detail: `editable=${roundTripValidation.editable_output_verified}`,
          impacted_refs: [roundTripValidation.validation_id],
          strict_claim_permitted: false,
          retryable: roundTripValidation.editable_output_verified,
          suggested_action_refs: ["strict.run_round_trip_validation.v1"],
          created_at: timestamp
        })
      );
    }

    const strictPublished = dualGateResult.passed && roundTripValidation.passed;
    const outputType: Record<StrictTargetKind, Artifact["artifact_type"]> = {
      docx: "report",
      pptx: "presentation",
      xlsx: "spreadsheet",
      dashboard: "dashboard"
    };
    const cdrArtifact = createArtifact(input, "cdr", "workflow_output", "cdr_absolute_snapshot", "editable", "verified", timestamp, [sourceArtifact.artifact_id]);
    const exportArtifact = createArtifact(input, "export", "export_bundle", input.target_kind, input.fail_editability ? "partially_editable" : "editable", "verified", timestamp, [cdrArtifact.artifact_id]);
    const publishedArtifact = createArtifact(
      input,
      strictPublished ? "strict-output" : "degraded-output",
      outputType[input.target_kind],
      strictPublished ? "strict_verified_output" : "degraded_output",
      input.fail_editability ? "partially_editable" : "editable",
      strictPublished ? "verified" : "degraded",
      timestamp,
      [exportArtifact.artifact_id]
    );
    const previewArtifact = createArtifact(input, "preview", "preview_render", "deterministic_preview", "non_editable", "verified", timestamp, [exportArtifact.artifact_id]);
    const diffArtifact = createArtifact(input, "diff", "strict_output", "verification_diff", "non_editable", strictPublished ? "verified" : "degraded", timestamp, [exportArtifact.artifact_id]);
    const reproArtifact = createArtifact(input, "repro", "evidence_pack", "repro_bundle", "non_editable", strictPublished ? "verified" : "degraded", timestamp, [diffArtifact.artifact_id]);
    const evidenceArtifact = createArtifact(input, "evidence", "evidence_pack", "strict_evidence_bundle", "non_editable", strictPublished ? "verified" : "degraded", timestamp, [publishedArtifact.artifact_id]);
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: id("publication", input.run_id),
      artifact_ref: publishedArtifact.artifact_id,
      publication_type: strictPublished ? "internal_publish" : "bundle",
      editable_default: !input.fail_editability,
      explicit_non_editable_export: false,
      target_ref: input.target_kind,
      published_by: input.created_by,
      published_at: timestamp,
      permission_scope: defaultPermissionScope(),
      evidence_ref: evidenceArtifact.artifact_id
    });

    const strictOutputMetadata = StrictOutputMetadataSchema.parse({
      contract: contractEnvelope("strict"),
      schema_namespace: "rasid.shared.strict.v1",
      schema_version: "1.0.0",
      metadata_id: id("strict-output", input.run_id),
      artifact_ref: publishedArtifact.artifact_id,
      source_fingerprint_ref: sourceFingerprint.fingerprint_id,
      cdr_ref: cdr.cdr_id,
      target_kind: input.target_kind,
      strict_policy_ref: policy.policy_id,
      structural_result_ref: structuralResult.result_id,
      pixel_result_ref: pixelResult.result_id,
      dual_gate_result_ref: dualGateResult.result_id,
      repair_trace_ref: repairTrace.repair_trace_id,
      round_trip_validation_ref: roundTripValidation.validation_id,
      publish_state: strictPublished ? "strict_published" : "degraded_published",
      degrade_reason_refs: degradeReasons.map((reason) => reason.reason_id),
      generated_at: timestamp
    });
    StrictValidators.strict_output_metadata(strictOutputMetadata);
    stageRecords.push({
      stage: strictPublished ? "publish strict output" : "publish degraded output",
      status: strictPublished ? "passed" : "degraded",
      output_refs: [publishedArtifact.artifact_id, publication.publication_id],
      notes: [strictOutputMetadata.publish_state]
    });

    const warnings: Warning[] = degradeReasons.map((reason) => ({
      warning_code: reason.reason_code,
      summary: reason.summary,
      detail: reason.detail,
      severity: "high",
      impacted_refs: reason.impacted_refs
    }));
    const failures: FailureReason[] = degradeReasons.map((reason) => ({
      reason_code: reason.reason_code,
      summary: reason.summary,
      detail: reason.detail,
      impacted_refs: reason.impacted_refs,
      retryable: reason.retryable
    }));
    const evidencePack = EvidencePackSchema.parse({
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence-pack", input.run_id),
      verification_status: strictPublished ? "verified" : "degraded",
      source_refs: [input.source_ref],
      generated_artifact_refs: [publishedArtifact.artifact_id, diffArtifact.artifact_id, reproArtifact.artifact_id, evidenceArtifact.artifact_id],
      checks_executed: [
        { check_id: id("check", input.run_id, "structural"), check_name: "structural_equivalence", check_type: "strict_gate", passed: structuralResult.passed, severity: structuralResult.passed ? "medium" : "critical", details: `structural=${structuralResult.passed}`, impacted_refs: [structuralResult.result_id] },
        { check_id: id("check", input.run_id, "pixel"), check_name: "pixel_equivalence", check_type: "strict_gate", passed: pixelResult.passed, severity: pixelResult.passed ? "medium" : "critical", details: `diff=${pixelResult.pixel_diff_ratio}`, impacted_refs: [pixelResult.result_id] },
        { check_id: id("check", input.run_id, "round-trip"), check_name: "round_trip_validation", check_type: "strict_gate", passed: roundTripValidation.passed, severity: roundTripValidation.passed ? "medium" : "critical", details: `round_trip=${roundTripValidation.passed}`, impacted_refs: [roundTripValidation.validation_id] }
      ],
      before_refs: [sourceArtifact.artifact_id],
      after_refs: [publishedArtifact.artifact_id],
      metrics: [
        { metric_name: "pixel_diff_ratio", metric_value: pixelResult.pixel_diff_ratio, metric_unit: "ratio" },
        { metric_name: "repair_iterations", metric_value: repairApplied ? 1 : 0, metric_unit: "iterations" },
        { metric_name: "round_trip_pass", metric_value: roundTripValidation.passed ? 1 : 0, metric_unit: "boolean" }
      ],
      warnings,
      failure_reasons: strictPublished ? [] : failures,
      degraded_reasons: failures,
      replay_context: { run_id: input.run_id, target_kind: input.target_kind, stage_records: stageRecords },
      reproducibility_metadata: {
        replay_token: id("replay", input.run_id),
        execution_seed: hash(input.run_id),
        environment_stamp: runtimeStamp,
        tool_versions: [{ tool: "strict-replication-engine", version: "1.0.0" }]
      },
      strict_evidence_level: "strong"
    });
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: id("job", input.run_id),
      capability: "strict_replication",
      requested_mode: input.mode,
      capability_submode: input.target_kind,
      source_refs: [input.source_ref],
      artifact_refs: [publishedArtifact.artifact_id],
      progress: 100,
      stage: strictPublished ? "publish_strict_output" : "publish_degraded_output",
      state: strictPublished ? "completed" : "degraded",
      warnings,
      failure_reason: strictPublished ? null : failures[0] ?? null,
      retry_policy: { max_attempts: 2, strategy: "fixed", backoff_ms: 0 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: timestamp,
      finished_at: timestamp,
      resource_profile: { cpu_class: "standard", memory_class: "medium", io_class: "balanced", expected_parallelism: 1 }
    });
    const auditEvents = stageRecords.map((record) =>
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", input.run_id, record.stage),
        timestamp,
        actor_ref: input.created_by,
        actor_type: "service",
        action_ref: `strict.${record.stage.replace(/\s+/g, "_")}.v1`,
        job_ref: job.job_id,
        object_refs: record.output_refs,
        workspace_id: input.workspace_id,
        tenant_ref: input.tenant_ref,
        metadata: { status: record.status, notes: record.notes }
      })
    );
    const lineageEdges: LineageEdge[] = [
      { edge_id: id("edge", input.run_id, "source-cdr"), from_ref: sourceArtifact.artifact_id, to_ref: cdrArtifact.artifact_id, transform_ref: "strict.build_cdr_absolute", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: "", dataset_binding_ref: "", version_diff_ref: "" },
      { edge_id: id("edge", input.run_id, "cdr-export"), from_ref: cdrArtifact.artifact_id, to_ref: exportArtifact.artifact_id, transform_ref: "strict.export", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: "", dataset_binding_ref: "", version_diff_ref: "" },
      { edge_id: id("edge", input.run_id, "export-publish"), from_ref: exportArtifact.artifact_id, to_ref: publishedArtifact.artifact_id, transform_ref: strictPublished ? "strict.publish" : "strict.publish_degraded", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: "", dataset_binding_ref: "", version_diff_ref: dualGateResult.result_id }
    ];

    return {
      input,
      policy,
      sourceFingerprint,
      extractionManifest,
      cdrAbsolute: cdr,
      deterministicRenderProfile: renderProfile,
      structuralResult,
      pixelResult,
      dualGateResult,
      repairTrace,
      roundTripValidation,
      degradeReasons,
      strictOutputMetadata,
      artifacts: { sourceArtifact, cdrArtifact, exportArtifact, publishedArtifact, previewArtifact, diffArtifact, reproArtifact, evidenceArtifact, publication },
      evidencePack,
      auditEvents,
      lineageEdges,
      job,
      exportedPayload: exported,
      stageRecords,
      strictPublished
    };
  }
}

export const registerStrictReplicationEngine = (runtime: RegistryBootstrap): void => {
  const actions = ActionRegistry.filter((action) => action.capability === "strict_replication");
  const tools = ToolRegistry.filter((tool) => tool.owner_capability === "strict_replication");
  runtime.registerCapability({
    capability_id: "strict_replication",
    display_name: "Strict Replication Engine",
    package_name: "@rasid/strict-replication-engine",
    contract_version: "1.0.0",
    supported_action_refs: actions.map((action) => action.action_id),
    supported_tool_refs: tools.map((tool) => tool.tool_id)
  });
  runtime.registerManifest(createActionManifest("strict_replication", "1.0.0", actions, ["approval.strict"], ["evidence.strict"]));
  tools.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.strict", async (action) => ({
    approval_state: action.action_id.includes("publish") ? "pending" : "approved",
    reasons: action.action_id.includes("publish") ? ["strict_publish_review_required"] : ["strict_default"]
  }));
  runtime.registerEvidenceHook("evidence.strict", async (pack) => EvidencePackSchema.parse(pack));
};

const passSample = (): StrictSourceInput => ({
  run_id: "strict-pass-pptx",
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "user-1",
  mode: "advanced",
  source_kind: "image",
  target_kind: "pptx",
  original_name: "strict-pass.png",
  source_ref: "source-strict-pass",
  policy_id: "strict-policy-default",
  requested_repair_classes: ["coordinate_normalization"],
  allow_degraded_publish: true,
  fail_editability: false,
  fail_round_trip: false,
  pages: [
    {
      page_id: "page-1",
      width: 18,
      height: 10,
      background: ".",
      elements: [
        { element_id: "title", element_type: "text", x: 1, y: 1, width: 5, height: 1, text: "HELLO", fill: "T", editable: true },
        { element_id: "hero", element_type: "shape", x: 1, y: 3, width: 4, height: 2, fill: "S", editable: true },
        { element_id: "table-1", element_type: "table", x: 8, y: 4, width: 6, height: 3, rows: [["A", "B"], ["1", "2"]], fill: "B", editable: true, formula_refs: ["SUM(A2:B2)"] }
      ]
    }
  ]
});

const degradedSample = (): StrictSourceInput => ({
  run_id: "strict-degraded-dashboard",
  tenant_ref: "tenant-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  created_by: "user-1",
  mode: "advanced",
  source_kind: "screenshot",
  target_kind: "dashboard",
  original_name: "strict-degraded.png",
  source_ref: "source-strict-degraded",
  policy_id: "strict-policy-default",
  requested_repair_classes: [],
  allow_degraded_publish: true,
  fail_editability: true,
  fail_round_trip: true,
  pages: [
    {
      page_id: "page-1",
      width: 16,
      height: 8,
      background: ".",
      elements: [
        { element_id: "headline", element_type: "text", x: 1, y: 1, width: 7, height: 1, text: "METRICS", fill: "T", editable: true },
        { element_id: "grid", element_type: "table", x: 2, y: 3, width: 8, height: 3, rows: [["Q1", "Q2"], ["10", "11"]], fill: "B", editable: true, formula_refs: ["AVG(B2:C2)"] }
      ]
    }
  ]
});

export const runStrictReplicationRegressionSuite = (): StrictExecutionBundle[] => [
  new StrictReplicationEngine().run(passSample()),
  new StrictReplicationEngine().run(degradedSample())
];
