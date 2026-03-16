// ─── CDR-Design 7-Layer Schema (Section 5) ────────────────────────────
// Canonical Design Representation with full 7-layer structural model
// EMU-based absolute coordinate system

import { createHash } from "node:crypto";

// ─── Layer 1: EMU Canonical Units ──────────────────────────────────────

/** English Metric Units: 914400 EMU per inch (OOXML/CDR standard). */
export const EMU_PER_INCH = 914400;
export const EMU_PER_CM = 360000;
export const EMU_PER_PT = 12700;
export const EMU_PER_PX_96DPI = 9525; // 914400 / 96

export function inchesToEmu(inches: number): number {
  return Math.round(inches * EMU_PER_INCH);
}
export function emuToInches(emu: number): number {
  return emu / EMU_PER_INCH;
}
export function cmToEmu(cm: number): number {
  return Math.round(cm * EMU_PER_CM);
}
export function emuToCm(emu: number): number {
  return emu / EMU_PER_CM;
}
export function ptToEmu(pt: number): number {
  return Math.round(pt * EMU_PER_PT);
}
export function emuToPt(emu: number): number {
  return emu / EMU_PER_PT;
}
export function pxToEmu(px: number, dpi = 96): number {
  return Math.round((px * EMU_PER_INCH) / dpi);
}
export function emuToPx(emu: number, dpi = 96): number {
  return (emu * dpi) / EMU_PER_INCH;
}

// ─── Layer 2: Core Geometry Primitives ─────────────────────────────────

/** 2×3 affine transform matrix operating in EMU space. */
export interface Transform2D {
  /** scale-x */
  a: number;
  /** skew-y */
  b: number;
  /** skew-x */
  c: number;
  /** scale-y */
  d: number;
  /** translate-x (EMU) */
  tx: number;
  /** translate-y (EMU) */
  ty: number;
}

export function identityTransform(): Transform2D {
  return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

export function composeTransforms(outer: Transform2D, inner: Transform2D): Transform2D {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    tx: outer.a * inner.tx + outer.c * inner.ty + outer.tx,
    ty: outer.b * inner.tx + outer.d * inner.ty + outer.ty,
  };
}

export function applyTransform(t: Transform2D, x: number, y: number): [number, number] {
  return [t.a * x + t.c * y + t.tx, t.b * x + t.d * y + t.ty];
}

export function rotationTransform(angleDeg: number, cx = 0, cy = 0): Transform2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    tx: cx - cos * cx + sin * cy,
    ty: cy - sin * cx - cos * cy,
  };
}

export interface BoundingBoxEmu {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Layer 3: Color & Paint ────────────────────────────────────────────

export type ColorSpace = "srgb" | "display-p3" | "adobe-rgb" | "cmyk" | "spot" | "indexed";

export interface SolidColor {
  kind: "solid";
  color_space: ColorSpace;
  /** Channels: [r,g,b], [c,m,y,k], or [index]. Values 0-1 for floats, 0-255 for bytes. */
  channels: number[];
  alpha: number;
}

export interface GradientStop {
  position: number; // 0..1
  color: SolidColor;
}

export interface GradientFill {
  kind: "gradient";
  gradient_type: "linear" | "radial" | "angular" | "diamond";
  stops: GradientStop[];
  angle_deg: number;
  scale: number;
}

export interface PatternFill {
  kind: "pattern";
  pattern_ref: string;
  tile_width_emu: number;
  tile_height_emu: number;
  transform: Transform2D;
}

export interface ImageFill {
  kind: "image_fill";
  image_ref: string;
  stretch: boolean;
  tile: boolean;
  crop: CropRect | null;
}

export type FillSpec = SolidColor | GradientFill | PatternFill | ImageFill | null;

export interface StrokeSpec {
  color: SolidColor;
  width_emu: number;
  dash_pattern: number[];
  line_cap: "flat" | "round" | "square";
  line_join: "miter" | "round" | "bevel";
  miter_limit: number;
}

export interface ShadowEffect {
  kind: "shadow";
  color: SolidColor;
  offset_x_emu: number;
  offset_y_emu: number;
  blur_radius_emu: number;
}

export interface GlowEffect {
  kind: "glow";
  color: SolidColor;
  radius_emu: number;
}

export interface BlurEffect {
  kind: "blur";
  radius_emu: number;
}

export interface ReflectionEffect {
  kind: "reflection";
  blur_radius_emu: number;
  direction_deg: number;
  distance_emu: number;
  fade_start: number;
  fade_end: number;
}

export type EffectSpec = ShadowEffect | GlowEffect | BlurEffect | ReflectionEffect;

// ─── Layer 4: Text Model ───────────────────────────────────────────────

export type TextDirection = "ltr" | "rtl" | "ttb" | "btt";
export type TextAlignment = "left" | "center" | "right" | "justify" | "start" | "end";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type ArabicMode = "standard" | "traditional" | "simplified" | "kufi" | "naskh" | "ruqaa";

export interface GlyphPositionEmu {
  glyph_id: number;
  x_advance: number;
  y_advance: number;
  x_offset: number;
  y_offset: number;
}

export interface BidiRun {
  start: number;
  length: number;
  level: number;
  direction: "ltr" | "rtl";
  script: string;
}

export interface TextShaping {
  arabic_mode: ArabicMode | null;
  bidi_runs: BidiRun[];
  glyph_positions_emu: GlyphPositionEmu[];
  shaping_engine: string;
  script_tag: string;
  language_tag: string;
}

export interface TextRun {
  run_id: string;
  text: string;
  font_family: string;
  font_size_emu: number;
  font_weight: number;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: SolidColor;
  letter_spacing_emu: number;
  line_height_factor: number;
  baseline_shift_emu: number;
  shaping: TextShaping | null;
}

export interface TextParagraph {
  paragraph_id: string;
  runs: TextRun[];
  direction: TextDirection;
  alignment: TextAlignment;
  indent_first_line_emu: number;
  indent_left_emu: number;
  indent_right_emu: number;
  space_before_emu: number;
  space_after_emu: number;
  bullet: string | null;
  bullet_font: string | null;
  bullet_color: SolidColor | null;
}

export interface TextElement {
  element_type: "text";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  paragraphs: TextParagraph[];
  direction: TextDirection;
  alignment: TextAlignment;
  vertical_alignment: VerticalAlignment;
  auto_fit: boolean;
  wrap: boolean;
  columns: number;
  column_gap_emu: number;
  margins: { top: number; right: number; bottom: number; left: number };
  fill: FillSpec;
  stroke: StrokeSpec | null;
  effects: EffectSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

// ─── Layer 4: Shape / Path Model ───────────────────────────────────────

export type PathCommandType = "M" | "L" | "C" | "Q" | "A" | "Z";

export interface PathCommand {
  type: PathCommandType;
  /** Coordinate values in EMU. Count depends on command type. */
  values: number[];
}

export interface GeometrySpec {
  path_commands: PathCommand[];
  view_box: BoundingBoxEmu;
  winding_rule: "nonzero" | "evenodd";
}

export interface ShapeElement {
  element_type: "shape";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  geometry: GeometrySpec;
  preset_shape: string | null;
  fill: FillSpec;
  stroke: StrokeSpec | null;
  effects: EffectSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

export interface PathElement {
  element_type: "path";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  geometry: GeometrySpec;
  fill: FillSpec;
  stroke: StrokeSpec | null;
  effects: EffectSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

// ─── Layer 4: Image Model ──────────────────────────────────────────────

export interface CropRect {
  left: number;   // fraction 0..1
  top: number;
  right: number;
  bottom: number;
}

export type AlphaMode = "straight" | "premultiplied" | "none";

export interface ImageSampling {
  filter: "bilinear" | "bicubic" | "lanczos" | "nearest";
  mip_map: boolean;
}

export interface ImageElement {
  element_type: "image";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  image_ref: string;
  original_width_px: number;
  original_height_px: number;
  crop: CropRect | null;
  mask_ref: string | null;
  sampling: ImageSampling;
  color_profile: string;
  alpha_mode: AlphaMode;
  fill: FillSpec;
  stroke: StrokeSpec | null;
  effects: EffectSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

// ─── Layer 4: Table Model ──────────────────────────────────────────────

export interface TableGridDef {
  column_widths_emu: number[];
  row_heights_emu: number[];
}

export interface TableCellSpan {
  row: number;
  col: number;
  row_span: number;
  col_span: number;
}

export interface TableCell {
  cell_id: string;
  span: TableCellSpan;
  text: TextParagraph[];
  fill: FillSpec;
  borders: {
    top: StrokeSpec | null;
    right: StrokeSpec | null;
    bottom: StrokeSpec | null;
    left: StrokeSpec | null;
  };
  vertical_alignment: VerticalAlignment;
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface TableDataBinding {
  source_table: string;
  column_map: Record<string, string>;
  row_filter: string | null;
  sort_order: { column: string; direction: "asc" | "desc" }[];
}

export interface TableElement {
  element_type: "table";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  grid: TableGridDef;
  cells: TableCell[];
  binding: TableDataBinding | null;
  rtl: boolean;
  header_rows: number;
  banded_rows: boolean;
  banded_columns: boolean;
  fill: FillSpec;
  stroke: StrokeSpec | null;
  effects: EffectSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

// ─── Layer 4: Chart Model ──────────────────────────────────────────────

export type ChartKind =
  | "bar" | "column" | "line" | "area" | "pie" | "donut"
  | "scatter" | "bubble" | "radar" | "treemap" | "waterfall"
  | "funnel" | "combo" | "histogram" | "box_whisker";

export interface ChartAxisEncoding {
  field: string;
  axis_title: string;
  scale_type: "linear" | "log" | "time" | "band" | "ordinal";
  min: number | null;
  max: number | null;
  format: string;
}

export interface ChartSeriesEncoding {
  series_id: string;
  field: string;
  label: string;
  color: SolidColor;
  chart_kind_override: ChartKind | null;
}

export interface ChartEncoding {
  x: ChartAxisEncoding | null;
  y: ChartAxisEncoding | null;
  series: ChartSeriesEncoding[];
  legend_position: "top" | "bottom" | "left" | "right" | "none";
}

export interface ChartDataBinding {
  source_table: string;
  category_field: string;
  value_fields: string[];
  filter: string | null;
}

export interface ChartElement {
  element_type: "chart";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  chart_kind: ChartKind;
  encoding: ChartEncoding;
  data_binding: ChartDataBinding | null;
  inline_data: Record<string, unknown>[] | null;
  title: string;
  subtitle: string;
  fill: FillSpec;
  stroke: StrokeSpec | null;
  effects: EffectSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

// ─── Layer 4: Group / ClipGroup ────────────────────────────────────────

export interface GroupElement {
  element_type: "group";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  children: ElementSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

export interface ClipGroupElement {
  element_type: "clip_group";
  element_id: string;
  bbox: BoundingBoxEmu;
  transform: Transform2D;
  clip_path: GeometrySpec;
  children: ElementSpec[];
  opacity: number;
  locked: boolean;
  z_index: number;
  name: string;
  metadata: Record<string, string>;
}

// ─── Element Union ─────────────────────────────────────────────────────

export type ElementSpec =
  | TextElement
  | ShapeElement
  | PathElement
  | ImageElement
  | TableElement
  | ChartElement
  | GroupElement
  | ClipGroupElement;

// ─── Layer 5: Background ───────────────────────────────────────────────

export interface BackgroundSpec {
  fill: FillSpec;
  image_ref: string | null;
  bleed_emu: number;
}

// ─── Layer 6: Page & Layer ─────────────────────────────────────────────

export interface LayerSpec {
  layer_id: string;
  name: string;
  visible: boolean;
  printable: boolean;
  locked: boolean;
  opacity: number;
  blend_mode: string;
  elements: ElementSpec[];
}

export interface CdrPage {
  page_id: string;
  page_index: number;
  width_emu: number;
  height_emu: number;
  background: BackgroundSpec;
  layers: LayerSpec[];
  master_page_ref: string | null;
  transition: string | null;
  notes: string;
}

// ─── Layer 7: CDR-Data Linkage ─────────────────────────────────────────

export interface CdrDataTable {
  table_id: string;
  name: string;
  columns: { name: string; data_type: string }[];
  rows: Record<string, unknown>[];
}

export interface SemanticModelRef {
  model_id: string;
  model_name: string;
  endpoint: string;
  version: string;
}

export interface CdrDataLinkage {
  tables: CdrDataTable[];
  semantic_model_ref: SemanticModelRef | null;
  refresh_policy: "manual" | "on_open" | "periodic";
  refresh_interval_ms: number | null;
  last_refresh_at: string | null;
}

// ─── Fingerprint ───────────────────────────────────────────────────────

export interface CdrFingerprint {
  layout_hash: string;
  typography_hash: string;
  structural_hash: string;
  computed_at: string;
}

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

/**
 * Compute the layout hash: captures page dimensions, element bounding boxes,
 * transforms, and z-ordering across all pages/layers.
 */
export function computeLayoutHash(pages: CdrPage[]): string {
  const parts: string[] = [];
  for (const page of pages) {
    parts.push(`page:${page.page_id}:${page.width_emu}x${page.height_emu}`);
    for (const layer of page.layers) {
      for (const el of layer.elements) {
        parts.push(
          `el:${el.element_id}:${el.bbox.x},${el.bbox.y},${el.bbox.width},${el.bbox.height}:` +
          `t[${el.transform.a},${el.transform.b},${el.transform.c},${el.transform.d},${el.transform.tx},${el.transform.ty}]:` +
          `z${el.z_index}`
        );
        if (el.element_type === "group" || el.element_type === "clip_group") {
          parts.push(`children:${el.children.length}`);
          collectChildLayoutParts(el.children, parts);
        }
      }
    }
  }
  return sha256(parts.join("|"));
}

function collectChildLayoutParts(elements: ElementSpec[], parts: string[]): void {
  for (const el of elements) {
    parts.push(
      `child:${el.element_id}:${el.bbox.x},${el.bbox.y},${el.bbox.width},${el.bbox.height}:z${el.z_index}`
    );
    if (el.element_type === "group" || el.element_type === "clip_group") {
      collectChildLayoutParts(el.children, parts);
    }
  }
}

/**
 * Compute the typography hash: captures all text content, font metrics,
 * shaping data, and bidi information.
 */
export function computeTypographyHash(pages: CdrPage[]): string {
  const parts: string[] = [];
  for (const page of pages) {
    for (const layer of page.layers) {
      collectTypographyParts(layer.elements, parts);
    }
  }
  return sha256(parts.join("|"));
}

function collectTypographyParts(elements: ElementSpec[], parts: string[]): void {
  for (const el of elements) {
    if (el.element_type === "text") {
      for (const para of el.paragraphs) {
        parts.push(`para:${para.paragraph_id}:${para.direction}:${para.alignment}`);
        for (const run of para.runs) {
          parts.push(
            `run:${run.run_id}:${run.font_family}:${run.font_size_emu}:${run.font_weight}:` +
            `${run.italic}:${run.text.length}:${sha256(run.text).slice(0, 16)}`
          );
          if (run.shaping) {
            parts.push(
              `shaping:${run.shaping.arabic_mode ?? "none"}:${run.shaping.script_tag}:` +
              `bidi_runs:${run.shaping.bidi_runs.length}:glyphs:${run.shaping.glyph_positions_emu.length}`
            );
          }
        }
      }
    } else if (el.element_type === "table") {
      for (const cell of el.cells) {
        for (const para of cell.text) {
          parts.push(`tcell_para:${para.paragraph_id}:${para.direction}`);
          for (const run of para.runs) {
            parts.push(`tcell_run:${run.run_id}:${run.font_family}:${run.font_size_emu}`);
          }
        }
      }
    } else if (el.element_type === "group" || el.element_type === "clip_group") {
      collectTypographyParts(el.children, parts);
    }
  }
}

/**
 * Compute the structural hash: captures the full structural skeleton —
 * element types, hierarchy, IDs, and layer structure.
 */
export function computeStructuralHash(pages: CdrPage[]): string {
  const skeleton: unknown[] = pages.map((page) => ({
    id: page.page_id,
    idx: page.page_index,
    w: page.width_emu,
    h: page.height_emu,
    layers: page.layers.map((layer) => ({
      id: layer.layer_id,
      elements: buildElementSkeleton(layer.elements),
    })),
  }));
  return sha256(canonicalJson(skeleton));
}

function buildElementSkeleton(elements: ElementSpec[]): unknown[] {
  return elements.map((el) => {
    const base: Record<string, unknown> = {
      type: el.element_type,
      id: el.element_id,
    };
    if (el.element_type === "group" || el.element_type === "clip_group") {
      base.children = buildElementSkeleton(el.children);
    }
    if (el.element_type === "table") {
      base.grid = {
        cols: el.grid.column_widths_emu.length,
        rows: el.grid.row_heights_emu.length,
      };
      base.cell_count = el.cells.length;
    }
    if (el.element_type === "chart") {
      base.chart_kind = el.chart_kind;
      base.series_count = el.encoding.series.length;
    }
    return base;
  });
}

export function computeFingerprint(pages: CdrPage[]): CdrFingerprint {
  return {
    layout_hash: computeLayoutHash(pages),
    typography_hash: computeTypographyHash(pages),
    structural_hash: computeStructuralHash(pages),
    computed_at: new Date().toISOString(),
  };
}

// ─── CdrDesign Root ────────────────────────────────────────────────────

export interface CdrDesign {
  design_id: string;
  schema_version: string;
  source_ref: string;
  source_kind: "pdf" | "image" | "office" | "svg" | "cdr_native";
  unit_system: "emu";
  pages: CdrPage[];
  data_linkage: CdrDataLinkage;
  fingerprint: CdrFingerprint;
  created_at: string;
  updated_at: string;
  metadata: Record<string, string>;
}

// ─── Defaults / Factories ──────────────────────────────────────────────

export function defaultSolidColor(r = 0, g = 0, b = 0, alpha = 1): SolidColor {
  return { kind: "solid", color_space: "srgb", channels: [r, g, b], alpha };
}

export function defaultStroke(): StrokeSpec {
  return {
    color: defaultSolidColor(0, 0, 0, 1),
    width_emu: ptToEmu(1),
    dash_pattern: [],
    line_cap: "flat",
    line_join: "miter",
    miter_limit: 8,
  };
}

export function defaultBackground(): BackgroundSpec {
  return { fill: defaultSolidColor(255, 255, 255, 1), image_ref: null, bleed_emu: 0 };
}

export function defaultDataLinkage(): CdrDataLinkage {
  return {
    tables: [],
    semantic_model_ref: null,
    refresh_policy: "manual",
    refresh_interval_ms: null,
    last_refresh_at: null,
  };
}

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

// ─── Builder: buildCdrDesignFromPdfDom ─────────────────────────────────

export interface PdfDomPage {
  width_pt: number;
  height_pt: number;
  text_blocks: {
    text: string;
    x_pt: number;
    y_pt: number;
    width_pt: number;
    height_pt: number;
    font_family: string;
    font_size_pt: number;
    font_weight: number;
    italic: boolean;
    color_rgb: [number, number, number];
    direction: TextDirection;
    alignment: TextAlignment;
    bidi_runs?: BidiRun[];
    arabic_mode?: ArabicMode;
  }[];
  images: {
    image_ref: string;
    x_pt: number;
    y_pt: number;
    width_pt: number;
    height_pt: number;
    original_width_px: number;
    original_height_px: number;
  }[];
  vectors: {
    path_data: string;
    x_pt: number;
    y_pt: number;
    width_pt: number;
    height_pt: number;
    fill_rgb: [number, number, number] | null;
    stroke_rgb: [number, number, number] | null;
    stroke_width_pt: number;
  }[];
  tables: {
    x_pt: number;
    y_pt: number;
    width_pt: number;
    height_pt: number;
    column_widths_pt: number[];
    row_heights_pt: number[];
    cells: {
      row: number;
      col: number;
      row_span: number;
      col_span: number;
      text: string;
      font_family: string;
      font_size_pt: number;
    }[];
    rtl: boolean;
  }[];
}

export interface PdfDom {
  source_ref: string;
  pages: PdfDomPage[];
}

function parseSvgPathToCommands(pathData: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const regex = /([MLCQAZ])\s*([\d\s,.\-e+]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pathData)) !== null) {
    const type = match[1].toUpperCase() as PathCommandType;
    const rawValues = match[2].trim();
    const values = rawValues.length > 0
      ? rawValues.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
      : [];
    commands.push({ type, values: values.map((v) => ptToEmu(v)) });
  }
  if (commands.length === 0) {
    commands.push({ type: "M", values: [0, 0] });
  }
  return commands;
}

export function buildCdrDesignFromPdfDom(pdf: PdfDom): CdrDesign {
  const designId = generateId("cdr");
  const now = new Date().toISOString();
  const pages: CdrPage[] = pdf.pages.map((pdfPage, pageIdx) => {
    const pageId = generateId("page");
    let zCounter = 0;

    const elements: ElementSpec[] = [];

    // Text blocks
    for (const block of pdfPage.text_blocks) {
      const runId = generateId("run");
      const paraId = generateId("para");
      const elId = generateId("text");

      const shaping: TextShaping | null =
        block.bidi_runs || block.arabic_mode
          ? {
              arabic_mode: block.arabic_mode ?? null,
              bidi_runs: block.bidi_runs ?? [],
              glyph_positions_emu: [],
              shaping_engine: "harfbuzz",
              script_tag: block.arabic_mode ? "arab" : "latn",
              language_tag: block.arabic_mode ? "ar" : "en",
            }
          : null;

      const run: TextRun = {
        run_id: runId,
        text: block.text,
        font_family: block.font_family,
        font_size_emu: ptToEmu(block.font_size_pt),
        font_weight: block.font_weight,
        italic: block.italic,
        underline: false,
        strikethrough: false,
        color: defaultSolidColor(block.color_rgb[0], block.color_rgb[1], block.color_rgb[2]),
        letter_spacing_emu: 0,
        line_height_factor: 1.2,
        baseline_shift_emu: 0,
        shaping,
      };

      const paragraph: TextParagraph = {
        paragraph_id: paraId,
        runs: [run],
        direction: block.direction,
        alignment: block.alignment,
        indent_first_line_emu: 0,
        indent_left_emu: 0,
        indent_right_emu: 0,
        space_before_emu: 0,
        space_after_emu: 0,
        bullet: null,
        bullet_font: null,
        bullet_color: null,
      };

      const textEl: TextElement = {
        element_type: "text",
        element_id: elId,
        bbox: {
          x: ptToEmu(block.x_pt),
          y: ptToEmu(block.y_pt),
          width: ptToEmu(block.width_pt),
          height: ptToEmu(block.height_pt),
        },
        transform: identityTransform(),
        paragraphs: [paragraph],
        direction: block.direction,
        alignment: block.alignment,
        vertical_alignment: "top",
        auto_fit: false,
        wrap: true,
        columns: 1,
        column_gap_emu: 0,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        fill: null,
        stroke: null,
        effects: [],
        opacity: 1,
        locked: false,
        z_index: zCounter++,
        name: "",
        metadata: {},
      };
      elements.push(textEl);
    }

    // Images
    for (const img of pdfPage.images) {
      const elId = generateId("img");
      const imageEl: ImageElement = {
        element_type: "image",
        element_id: elId,
        bbox: {
          x: ptToEmu(img.x_pt),
          y: ptToEmu(img.y_pt),
          width: ptToEmu(img.width_pt),
          height: ptToEmu(img.height_pt),
        },
        transform: identityTransform(),
        image_ref: img.image_ref,
        original_width_px: img.original_width_px,
        original_height_px: img.original_height_px,
        crop: null,
        mask_ref: null,
        sampling: { filter: "bicubic", mip_map: false },
        color_profile: "srgb",
        alpha_mode: "straight",
        fill: null,
        stroke: null,
        effects: [],
        opacity: 1,
        locked: false,
        z_index: zCounter++,
        name: "",
        metadata: {},
      };
      elements.push(imageEl);
    }

    // Vector paths
    for (const vec of pdfPage.vectors) {
      const elId = generateId("path");
      const pathCommands = parseSvgPathToCommands(vec.path_data);
      const pathEl: PathElement = {
        element_type: "path",
        element_id: elId,
        bbox: {
          x: ptToEmu(vec.x_pt),
          y: ptToEmu(vec.y_pt),
          width: ptToEmu(vec.width_pt),
          height: ptToEmu(vec.height_pt),
        },
        transform: identityTransform(),
        geometry: {
          path_commands: pathCommands,
          view_box: {
            x: 0,
            y: 0,
            width: ptToEmu(vec.width_pt),
            height: ptToEmu(vec.height_pt),
          },
          winding_rule: "nonzero",
        },
        fill: vec.fill_rgb
          ? defaultSolidColor(vec.fill_rgb[0], vec.fill_rgb[1], vec.fill_rgb[2])
          : null,
        stroke: vec.stroke_rgb
          ? {
              color: defaultSolidColor(vec.stroke_rgb[0], vec.stroke_rgb[1], vec.stroke_rgb[2]),
              width_emu: ptToEmu(vec.stroke_width_pt),
              dash_pattern: [],
              line_cap: "flat",
              line_join: "miter",
              miter_limit: 8,
            }
          : null,
        effects: [],
        opacity: 1,
        locked: false,
        z_index: zCounter++,
        name: "",
        metadata: {},
      };
      elements.push(pathEl);
    }

    // Tables
    for (const tbl of pdfPage.tables) {
      const elId = generateId("tbl");
      const cells: TableCell[] = tbl.cells.map((c) => ({
        cell_id: generateId("cell"),
        span: { row: c.row, col: c.col, row_span: c.row_span, col_span: c.col_span },
        text: [
          {
            paragraph_id: generateId("para"),
            runs: [
              {
                run_id: generateId("run"),
                text: c.text,
                font_family: c.font_family,
                font_size_emu: ptToEmu(c.font_size_pt),
                font_weight: 400,
                italic: false,
                underline: false,
                strikethrough: false,
                color: defaultSolidColor(0, 0, 0),
                letter_spacing_emu: 0,
                line_height_factor: 1.2,
                baseline_shift_emu: 0,
                shaping: null,
              },
            ],
            direction: tbl.rtl ? "rtl" as TextDirection : "ltr" as TextDirection,
            alignment: tbl.rtl ? "right" as TextAlignment : "left" as TextAlignment,
            indent_first_line_emu: 0,
            indent_left_emu: 0,
            indent_right_emu: 0,
            space_before_emu: 0,
            space_after_emu: 0,
            bullet: null,
            bullet_font: null,
            bullet_color: null,
          },
        ],
        fill: null,
        borders: { top: null, right: null, bottom: null, left: null },
        vertical_alignment: "top" as VerticalAlignment,
        margins: { top: ptToEmu(2), right: ptToEmu(4), bottom: ptToEmu(2), left: ptToEmu(4) },
      }));

      const tableEl: TableElement = {
        element_type: "table",
        element_id: elId,
        bbox: {
          x: ptToEmu(tbl.x_pt),
          y: ptToEmu(tbl.y_pt),
          width: ptToEmu(tbl.width_pt),
          height: ptToEmu(tbl.height_pt),
        },
        transform: identityTransform(),
        grid: {
          column_widths_emu: tbl.column_widths_pt.map(ptToEmu),
          row_heights_emu: tbl.row_heights_pt.map(ptToEmu),
        },
        cells,
        binding: null,
        rtl: tbl.rtl,
        header_rows: 1,
        banded_rows: false,
        banded_columns: false,
        fill: null,
        stroke: null,
        effects: [],
        opacity: 1,
        locked: false,
        z_index: zCounter++,
        name: "",
        metadata: {},
      };
      elements.push(tableEl);
    }

    const layer: LayerSpec = {
      layer_id: generateId("layer"),
      name: "Default",
      visible: true,
      printable: true,
      locked: false,
      opacity: 1,
      blend_mode: "normal",
      elements,
    };

    return {
      page_id: pageId,
      page_index: pageIdx,
      width_emu: ptToEmu(pdfPage.width_pt),
      height_emu: ptToEmu(pdfPage.height_pt),
      background: defaultBackground(),
      layers: [layer],
      master_page_ref: null,
      transition: null,
      notes: "",
    };
  });

  const fingerprint = computeFingerprint(pages);

  return {
    design_id: designId,
    schema_version: "5.0.0",
    source_ref: pdf.source_ref,
    source_kind: "pdf",
    unit_system: "emu",
    pages,
    data_linkage: defaultDataLinkage(),
    fingerprint,
    created_at: now,
    updated_at: now,
    metadata: {},
  };
}

// ─── Builder: buildCdrDesignFromImage ──────────────────────────────────

export interface ImageSource {
  source_ref: string;
  image_ref: string;
  width_px: number;
  height_px: number;
  dpi: number;
  color_profile?: string;
  alpha_mode?: AlphaMode;
}

export function buildCdrDesignFromImage(src: ImageSource): CdrDesign {
  const designId = generateId("cdr");
  const now = new Date().toISOString();
  const widthEmu = pxToEmu(src.width_px, src.dpi);
  const heightEmu = pxToEmu(src.height_px, src.dpi);

  const imageEl: ImageElement = {
    element_type: "image",
    element_id: generateId("img"),
    bbox: { x: 0, y: 0, width: widthEmu, height: heightEmu },
    transform: identityTransform(),
    image_ref: src.image_ref,
    original_width_px: src.width_px,
    original_height_px: src.height_px,
    crop: null,
    mask_ref: null,
    sampling: { filter: "bicubic", mip_map: false },
    color_profile: src.color_profile ?? "srgb",
    alpha_mode: src.alpha_mode ?? "straight",
    fill: null,
    stroke: null,
    effects: [],
    opacity: 1,
    locked: false,
    z_index: 0,
    name: "Background Image",
    metadata: {},
  };

  const layer: LayerSpec = {
    layer_id: generateId("layer"),
    name: "Image",
    visible: true,
    printable: true,
    locked: false,
    opacity: 1,
    blend_mode: "normal",
    elements: [imageEl],
  };

  const page: CdrPage = {
    page_id: generateId("page"),
    page_index: 0,
    width_emu: widthEmu,
    height_emu: heightEmu,
    background: defaultBackground(),
    layers: [layer],
    master_page_ref: null,
    transition: null,
    notes: "",
  };

  const fingerprint = computeFingerprint([page]);

  return {
    design_id: designId,
    schema_version: "5.0.0",
    source_ref: src.source_ref,
    source_kind: "image",
    unit_system: "emu",
    pages: [page],
    data_linkage: defaultDataLinkage(),
    fingerprint,
    created_at: now,
    updated_at: now,
    metadata: {},
  };
}

// ─── Builder: buildCdrDesignFromOffice ─────────────────────────────────

export interface OfficeSlide {
  width_emu: number;
  height_emu: number;
  elements: ElementSpec[];
  background?: BackgroundSpec;
  notes?: string;
}

export interface OfficeSource {
  source_ref: string;
  source_kind: "office";
  slides: OfficeSlide[];
  data_tables?: CdrDataTable[];
  semantic_model_ref?: SemanticModelRef;
}

export function buildCdrDesignFromOffice(src: OfficeSource): CdrDesign {
  const designId = generateId("cdr");
  const now = new Date().toISOString();

  const pages: CdrPage[] = src.slides.map((slide, idx) => {
    const layer: LayerSpec = {
      layer_id: generateId("layer"),
      name: "Content",
      visible: true,
      printable: true,
      locked: false,
      opacity: 1,
      blend_mode: "normal",
      elements: slide.elements,
    };

    return {
      page_id: generateId("page"),
      page_index: idx,
      width_emu: slide.width_emu,
      height_emu: slide.height_emu,
      background: slide.background ?? defaultBackground(),
      layers: [layer],
      master_page_ref: null,
      transition: null,
      notes: slide.notes ?? "",
    };
  });

  const fingerprint = computeFingerprint(pages);

  const dataLinkage: CdrDataLinkage = {
    tables: src.data_tables ?? [],
    semantic_model_ref: src.semantic_model_ref ?? null,
    refresh_policy: "manual",
    refresh_interval_ms: null,
    last_refresh_at: null,
  };

  return {
    design_id: designId,
    schema_version: "5.0.0",
    source_ref: src.source_ref,
    source_kind: "office",
    unit_system: "emu",
    pages,
    data_linkage: dataLinkage,
    fingerprint,
    created_at: now,
    updated_at: now,
    metadata: {},
  };
}

// ─── CdrStore ──────────────────────────────────────────────────────────

export interface CdrSnapshot {
  snapshot_id: string;
  design_id: string;
  version: number;
  design: CdrDesign;
  stored_at: string;
  tags: string[];
}

/**
 * In-memory CDR snapshot store supporting versioned storage, retrieval,
 * diffing, and tag-based queries.
 */
export class CdrStore {
  private readonly snapshots = new Map<string, CdrSnapshot[]>();
  private readonly bySnapshotId = new Map<string, CdrSnapshot>();
  private readonly tagIndex = new Map<string, Set<string>>();

  /** Store a new snapshot of a design. Returns the snapshot ID. */
  store(design: CdrDesign, tags: string[] = []): string {
    const designId = design.design_id;
    const existing = this.snapshots.get(designId) ?? [];
    const version = existing.length + 1;
    const snapshotId = `${designId}_v${version}_${Date.now().toString(36)}`;

    const snapshot: CdrSnapshot = {
      snapshot_id: snapshotId,
      design_id: designId,
      version,
      design: structuredClone(design),
      stored_at: new Date().toISOString(),
      tags: [...tags],
    };

    existing.push(snapshot);
    this.snapshots.set(designId, existing);
    this.bySnapshotId.set(snapshotId, snapshot);

    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(snapshotId);
    }

    return snapshotId;
  }

  /** Retrieve a snapshot by its ID. */
  getSnapshot(snapshotId: string): CdrSnapshot | null {
    return this.bySnapshotId.get(snapshotId) ?? null;
  }

  /** Retrieve the latest snapshot for a design. */
  getLatest(designId: string): CdrSnapshot | null {
    const versions = this.snapshots.get(designId);
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  /** Retrieve a specific version of a design. */
  getVersion(designId: string, version: number): CdrSnapshot | null {
    const versions = this.snapshots.get(designId);
    if (!versions) return null;
    return versions.find((s) => s.version === version) ?? null;
  }

  /** List all versions for a design. */
  listVersions(designId: string): CdrSnapshot[] {
    return [...(this.snapshots.get(designId) ?? [])];
  }

  /** Find snapshots by tag. */
  findByTag(tag: string): CdrSnapshot[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];
    const results: CdrSnapshot[] = [];
    for (const id of ids) {
      const snap = this.bySnapshotId.get(id);
      if (snap) results.push(snap);
    }
    return results;
  }

  /** Add tags to an existing snapshot. */
  addTags(snapshotId: string, tags: string[]): boolean {
    const snap = this.bySnapshotId.get(snapshotId);
    if (!snap) return false;
    for (const tag of tags) {
      if (!snap.tags.includes(tag)) {
        snap.tags.push(tag);
      }
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(snapshotId);
    }
    return true;
  }

  /** Compare fingerprints between two snapshots. */
  compareFingerprints(
    snapshotIdA: string,
    snapshotIdB: string,
  ): {
    layout_match: boolean;
    typography_match: boolean;
    structural_match: boolean;
    a: CdrFingerprint;
    b: CdrFingerprint;
  } | null {
    const a = this.bySnapshotId.get(snapshotIdA);
    const b = this.bySnapshotId.get(snapshotIdB);
    if (!a || !b) return null;
    return {
      layout_match: a.design.fingerprint.layout_hash === b.design.fingerprint.layout_hash,
      typography_match: a.design.fingerprint.typography_hash === b.design.fingerprint.typography_hash,
      structural_match: a.design.fingerprint.structural_hash === b.design.fingerprint.structural_hash,
      a: a.design.fingerprint,
      b: b.design.fingerprint,
    };
  }

  /** Recompute and update the fingerprint for the latest snapshot of a design. */
  recomputeFingerprint(designId: string): CdrFingerprint | null {
    const latest = this.getLatest(designId);
    if (!latest) return null;
    const fp = computeFingerprint(latest.design.pages);
    latest.design.fingerprint = fp;
    latest.design.updated_at = new Date().toISOString();
    return fp;
  }

  /** Count total snapshots in the store. */
  get totalSnapshots(): number {
    return this.bySnapshotId.size;
  }

  /** List all design IDs in the store. */
  listDesignIds(): string[] {
    return [...this.snapshots.keys()];
  }

  /** Delete all versions of a design. */
  deleteDesign(designId: string): boolean {
    const versions = this.snapshots.get(designId);
    if (!versions) return false;
    for (const snap of versions) {
      this.bySnapshotId.delete(snap.snapshot_id);
      for (const tag of snap.tags) {
        this.tagIndex.get(tag)?.delete(snap.snapshot_id);
      }
    }
    this.snapshots.delete(designId);
    return true;
  }

  /** Clear the entire store. */
  clear(): void {
    this.snapshots.clear();
    this.bySnapshotId.clear();
    this.tagIndex.clear();
  }
}

// ─── Missing Type Aliases ──────────────────────────────────────────────

/** Column descriptor for data tables */
export interface CdrDataColumn {
  name: string;
  data_type: string;
  role?: "dimension" | "measure" | "time" | "label" | "unknown";
}

/** Data collection: tables extracted from a design */
export interface CdrData {
  tables: CdrDataTable[];
  semantic_model?: any;
}

/** CdrDesign with embedded data linkage */
export type CdrDesignWithData = CdrDesign & { data?: CdrData };

// ─── Compatibility Aliases & Utility Functions ─────────────────────────

/** Type alias: BboxEmu = BoundingBoxEmu */
export type BboxEmu = BoundingBoxEmu;

/** Quantize an EMU value to nearest grid multiple */
export function quantizeEmu(value: number, grid: number = EMU_PER_PT): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

/** Safe computeFingerprints — handles both schema formats */
export function computeFingerprints(input: CdrDesign | CdrPage[]): CdrFingerprint {
  try {
    const pages = Array.isArray(input) ? input : input.pages;
    return computeFingerprint(pages);
  } catch {
    // Fallback: compute hash from serialized design structure
    const data = JSON.stringify(input, (_k, v) => v instanceof Uint8Array ? `[Uint8Array:${v.length}]` : v);
    const hash = createHash("sha256").update(data).digest("hex");
    return {
      layout_hash: hash.substring(0, 64),
      typography_hash: createHash("sha256").update(hash + ":typo").digest("hex"),
      structural_hash: createHash("sha256").update(hash + ":struct").digest("hex"),
      computed_at: new Date().toISOString(),
    };
  }
}

/** Flatten all elements from a CdrDesign (recursing into groups) */
export function flattenAllElements(design: CdrDesign): ElementSpec[] {
  const result: ElementSpec[] = [];
  function walk(el: ElementSpec) {
    result.push(el);
    if (el.kind === "group" && el.children) {
      for (const child of el.children) walk(child);
    }
  }
  for (const page of design.pages) {
    for (const layer of page.layers) {
      for (const el of layer.elements) walk(el);
    }
  }
  return result;
}

/** Count elements by kind in a CdrDesign */
export function countElementsByKind(design: CdrDesign): Record<string, number> {
  const counts: Record<string, number> = {};
  const all = flattenAllElements(design);
  for (const el of all) {
    counts[el.kind] = (counts[el.kind] || 0) + 1;
  }
  return counts;
}

/** Validate that a CdrDesign has editable (non-raster) content */
export function validateEditableCore(design: CdrDesign): { valid: boolean; editableRatio: number; issues: string[] } {
  const all = flattenAllElements(design);
  const total = all.length;
  if (total === 0) return { valid: false, editableRatio: 0, issues: ["No elements found"] };
  const imageOnly = all.filter((e) => e.kind === "image").length;
  const editableRatio = total > 0 ? (total - imageOnly) / total : 0;
  const issues: string[] = [];
  if (editableRatio < 0.3) issues.push("Too many raster-only elements — output may not be editable");
  if (!design.pages.length) issues.push("No pages defined");
  return { valid: issues.length === 0, editableRatio, issues };
}

/** Quantize all geometry in a CdrDesign to the nearest EMU grid */
export function quantizeDesignGeometry(design: CdrDesign, grid: number = EMU_PER_PT): CdrDesign {
  function qBox(b: BoundingBoxEmu): BoundingBoxEmu {
    return { x: quantizeEmu(b.x, grid), y: quantizeEmu(b.y, grid), w: quantizeEmu(b.w, grid), h: quantizeEmu(b.h, grid) };
  }
  function qEl(el: ElementSpec): ElementSpec {
    const rawBox = (el as any).bbox || (el as any).bbox_emu || { x: 0, y: 0, w: 0, h: 0 };
    const qb = qBox(rawBox);
    const base = { ...el, bbox: qb, bbox_emu: qb };
    if (el.kind === "group" && (el as any).children) {
      return { ...base, children: (el as any).children.map(qEl) } as any;
    }
    return base as ElementSpec;
  }
  return {
    ...design,
    pages: design.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => ({
        ...layer,
        elements: layer.elements.map(qEl),
      })),
    })),
  };
}
