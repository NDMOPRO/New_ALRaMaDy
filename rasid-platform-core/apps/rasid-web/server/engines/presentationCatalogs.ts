/**
 * Catalog System with Parametric Generator
 * Implements Section 5 of ADDENDUM: Infinite Options System
 *
 * Architecture:
 * - Each catalog holds base "assets" (templates/presets)
 * - Parametric Generator produces real variants by mutating parameters
 * - Search via tags + scoring
 * - "More like this" / "Different direction" via parametric neighbors or cluster jump
 */

import { createHash } from "node:crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CatalogKind =
  | "layout"
  | "infographic"
  | "chart_skin"
  | "table_style"
  | "icon_pack"
  | "motion_preset"
  | "header_footer"
  | "background";

export type ParametricParams = {
  spacing_scale: number;       // 0.5..2.0
  corner_radius: number;       // 0..32
  stroke_width: number;        // 0..6
  shadow_depth: number;        // 0..4
  palette_mapping: string;     // e.g. "primary:accent", "accent:secondary"
  typography_scale: number;    // 0.75..1.5
  rtl_mirroring: boolean;
};

export type CatalogAsset = {
  asset_id: string;
  catalog_kind: CatalogKind;
  name: string;
  name_ar: string;
  family: string;
  cluster: string;
  tags: string[];
  density: "sparse" | "standard" | "dense";
  tone: "formal" | "neutral" | "creative";
  rtl_ready: boolean;
  brand_compatible: boolean;
  base_params: ParametricParams;
  svg_template: string;
  css_template: string;
  layout_spec: Record<string, unknown>;
  version: number;
  created_at: string;
};

export type CatalogVariant = {
  variant_id: string;
  base_asset_id: string;
  catalog_kind: CatalogKind;
  params: ParametricParams;
  name: string;
  preview_css: string;
  preview_svg: string;
  score: number;
};

export type CatalogSearchRequest = {
  catalog_kind: CatalogKind;
  query?: string;
  tags?: string[];
  density?: "sparse" | "standard" | "dense";
  tone?: "formal" | "neutral" | "creative";
  rtl_ready?: boolean;
  brand_compatible?: boolean;
  family?: string;
  limit?: number;
  offset?: number;
};

export type CatalogSearchResult = {
  assets: CatalogAsset[];
  total: number;
  has_more: boolean;
};

export type VariantGenerateRequest = {
  base_asset_id: string;
  catalog_kind: CatalogKind;
  direction: "more_like_this" | "different_direction" | "simpler" | "more_complex";
  count?: number;
  seed?: number;
};

export type VariantGenerateResult = {
  variants: CatalogVariant[];
  base_asset_id: string;
  direction: string;
};

// ─── Deterministic Seed RNG ──────────────────────────────────────────────────

class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hash = (input: string): string => createHash("sha256").update(input).digest("hex").slice(0, 12);
const now = (): string => new Date().toISOString();

const DEFAULT_PARAMS: ParametricParams = {
  spacing_scale: 1.0,
  corner_radius: 8,
  stroke_width: 1,
  shadow_depth: 1,
  palette_mapping: "primary:secondary",
  typography_scale: 1.0,
  rtl_mirroring: false,
};

const PALETTE_MAPPINGS = [
  "primary:secondary", "primary:accent", "accent:secondary",
  "secondary:primary", "accent:primary", "neutral:primary",
  "primary:neutral", "secondary:accent", "neutral:accent"
];

const LAYOUT_FAMILIES = [
  "title_hero", "title_subtitle", "content_split", "content_full",
  "two_column", "three_column", "grid_2x2", "grid_3x2",
  "media_left", "media_right", "media_center", "media_split",
  "chart_main", "chart_side", "table_full", "table_compact",
  "kpi_row", "kpi_grid", "comparison_side", "comparison_stack",
  "timeline_horizontal", "timeline_vertical", "process_steps",
  "agenda_list", "section_header", "quote_block", "closing_cta",
  "dashboard_quad", "infographic_flow", "blank_canvas"
];

const INFOGRAPHIC_FAMILIES = [
  "timeline_linear", "timeline_circular", "timeline_zigzag", "timeline_milestone",
  "process_arrows", "process_chevron", "process_pipeline", "process_funnel",
  "hierarchy_tree", "hierarchy_org", "hierarchy_pyramid", "hierarchy_nested",
  "comparison_side", "comparison_venn", "comparison_matrix", "comparison_radar",
  "statistical_bar", "statistical_donut", "statistical_gauge", "statistical_treemap",
  "geographic_map", "geographic_pins", "cycle_loop", "cycle_wheel",
  "flow_swimlane", "flow_decision"
];

const TABLE_FAMILIES = [
  "minimal", "bordered", "striped", "hover_highlight",
  "compact_dense", "spacious", "card_style", "gradient_header",
  "dark_header", "colored_rows", "alternating_accent",
  "rounded_cells", "flat_modern", "glass_effect",
  "kpi_table", "matrix_table", "comparison_table", "pivot_table",
  "timeline_table", "status_table"
];

const CHART_FAMILIES = [
  "bar_standard", "bar_stacked", "bar_grouped", "bar_horizontal",
  "line_standard", "line_area", "line_smooth", "line_step",
  "pie_standard", "pie_donut", "pie_semi", "pie_exploded",
  "combo_bar_line", "combo_area_line",
  "scatter_basic", "bubble_chart"
];

const ICON_FAMILIES = [
  "business_core", "technology", "finance", "healthcare",
  "education", "marketing", "logistics", "human_resources",
  "legal_compliance", "customer_service", "data_analytics",
  "project_management", "communication", "innovation",
  "sustainability", "real_estate", "government", "media",
  "retail", "manufacturing", "energy", "agriculture",
  "security", "quality", "research"
];

const MOTION_FAMILIES = [
  "fade_in", "fade_out", "slide_left", "slide_right", "slide_up", "slide_down",
  "zoom_in", "zoom_out", "rotate_in", "flip_horizontal", "flip_vertical",
  "bounce_in", "elastic_in", "back_in",
  "stagger_fade", "stagger_slide", "stagger_scale",
  "morph_transform", "path_draw", "typewriter"
];

const HEADER_FOOTER_FAMILIES = [
  "minimal_line", "full_bar", "logo_left", "logo_right", "logo_center",
  "page_number_only", "section_based", "date_based",
  "brand_stripe", "gradient_bar", "glass_bar",
  "slide_x_of_y", "custom_text", "title_repeat",
  "confidential_notice", "chapter_indicator"
];

const BACKGROUND_FAMILIES = [
  "solid_light", "solid_dark", "solid_neutral",
  "gradient_linear", "gradient_radial", "gradient_diagonal", "gradient_mesh",
  "pattern_dots", "pattern_lines", "pattern_grid", "pattern_chevron",
  "pattern_wave", "pattern_hexagon", "pattern_diamond",
  "geometric_abstract", "organic_shapes", "minimal_accent",
  "photo_overlay_dark", "photo_overlay_light", "noise_texture"
];

// ─── SVG Generator (real parametric SVG, not placeholders) ────────────────────

const generateLayoutSvg = (family: string, params: ParametricParams): string => {
  const w = 1280;
  const h = 720;
  const r = params.corner_radius;
  const s = params.spacing_scale;
  const sw = params.stroke_width;
  const gap = Math.round(24 * s);
  const pad = Math.round(48 * s);

  const bgRect = `<rect width="${w}" height="${h}" rx="${r}" fill="#F8FAFC"/>`;
  const stroke = sw > 0 ? `stroke="#CBD5E1" stroke-width="${sw}"` : "";

  const layouts: Record<string, string> = {
    title_hero: `${bgRect}<rect x="${pad}" y="${Math.round(h * 0.3)}" width="${w - pad * 2}" height="${Math.round(72 * params.typography_scale)}" rx="${r}" fill="#0F172A" ${stroke}/><rect x="${pad}" y="${Math.round(h * 0.3 + 80 * params.typography_scale)}" width="${Math.round((w - pad * 2) * 0.6)}" height="${Math.round(24 * params.typography_scale)}" rx="${r / 2}" fill="#64748B"/>`,
    content_split: `${bgRect}<rect x="${pad}" y="${pad}" width="${Math.round((w - pad * 2 - gap) / 2)}" height="${h - pad * 2}" rx="${r}" fill="#FFFFFF" ${stroke}/><rect x="${pad + Math.round((w - pad * 2 - gap) / 2) + gap}" y="${pad}" width="${Math.round((w - pad * 2 - gap) / 2)}" height="${h - pad * 2}" rx="${r}" fill="#FFFFFF" ${stroke}/>`,
    two_column: `${bgRect}<rect x="${pad}" y="${Math.round(pad + 60 * params.typography_scale)}" width="${Math.round((w - pad * 2 - gap) / 2)}" height="${Math.round(h - pad * 2 - 60 * params.typography_scale)}" rx="${r}" fill="#FFF" ${stroke}/><rect x="${pad + Math.round((w - pad * 2 - gap) / 2) + gap}" y="${Math.round(pad + 60 * params.typography_scale)}" width="${Math.round((w - pad * 2 - gap) / 2)}" height="${Math.round(h - pad * 2 - 60 * params.typography_scale)}" rx="${r}" fill="#FFF" ${stroke}/><rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${Math.round(48 * params.typography_scale)}" rx="${r}" fill="#0F172A"/>`,
    grid_2x2: `${bgRect}${[0, 1, 2, 3].map(i => { const col = i % 2; const row = Math.floor(i / 2); const cw = Math.round((w - pad * 2 - gap) / 2); const ch = Math.round((h - pad * 2 - gap - 60 * params.typography_scale) / 2); return `<rect x="${pad + col * (cw + gap)}" y="${Math.round(pad + 60 * params.typography_scale + row * (ch + gap))}" width="${cw}" height="${ch}" rx="${r}" fill="#FFF" ${stroke}/>`; }).join("")}<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${Math.round(48 * params.typography_scale)}" rx="${r}" fill="#0F172A"/>`,
    kpi_row: `${bgRect}<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${Math.round(48 * params.typography_scale)}" rx="${r}" fill="#0F172A"/>${[0, 1, 2, 3].map(i => { const cw = Math.round((w - pad * 2 - gap * 3) / 4); return `<rect x="${pad + i * (cw + gap)}" y="${Math.round(pad + 72 * params.typography_scale)}" width="${cw}" height="${Math.round(120 * s)}" rx="${r}" fill="#FFF" ${stroke}/><circle cx="${pad + i * (cw + gap) + cw / 2}" cy="${Math.round(pad + 72 * params.typography_scale + 220 * s)}" r="${Math.round(40 * s)}" fill="#C7511F" opacity="0.15"/>`; }).join("")}`,
    chart_main: `${bgRect}<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${Math.round(48 * params.typography_scale)}" rx="${r}" fill="#0F172A"/><rect x="${pad}" y="${Math.round(pad + 64 * params.typography_scale)}" width="${Math.round((w - pad * 2) * 0.65)}" height="${Math.round(h - pad * 2 - 64 * params.typography_scale)}" rx="${r}" fill="#FFF" ${stroke}/><rect x="${Math.round(pad + (w - pad * 2) * 0.65 + gap)}" y="${Math.round(pad + 64 * params.typography_scale)}" width="${Math.round((w - pad * 2) * 0.35 - gap)}" height="${Math.round(h - pad * 2 - 64 * params.typography_scale)}" rx="${r}" fill="#FFF" ${stroke}/>`,
    media_left: `${bgRect}<rect x="${pad}" y="${pad}" width="${Math.round((w - pad * 2 - gap) * 0.45)}" height="${h - pad * 2}" rx="${r}" fill="#E2E8F0"/><rect x="${Math.round(pad + (w - pad * 2 - gap) * 0.45 + gap)}" y="${pad}" width="${Math.round((w - pad * 2 - gap) * 0.55)}" height="${h - pad * 2}" rx="${r}" fill="#FFF" ${stroke}/>`,
    media_right: `${bgRect}<rect x="${pad}" y="${pad}" width="${Math.round((w - pad * 2 - gap) * 0.55)}" height="${h - pad * 2}" rx="${r}" fill="#FFF" ${stroke}/><rect x="${Math.round(pad + (w - pad * 2 - gap) * 0.55 + gap)}" y="${pad}" width="${Math.round((w - pad * 2 - gap) * 0.45)}" height="${h - pad * 2}" rx="${r}" fill="#E2E8F0"/>`,
    timeline_horizontal: `${bgRect}<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${Math.round(48 * params.typography_scale)}" rx="${r}" fill="#0F172A"/><line x1="${pad}" y1="${Math.round(h / 2)}" x2="${w - pad}" y2="${Math.round(h / 2)}" stroke="#C7511F" stroke-width="${sw + 2}"/>${[0, 1, 2, 3, 4].map(i => `<circle cx="${Math.round(pad + i * ((w - pad * 2) / 4))}" cy="${Math.round(h / 2)}" r="${Math.round(8 * s)}" fill="#C7511F"/><rect x="${Math.round(pad + i * ((w - pad * 2) / 4) - 50 * s)}" y="${Math.round(h / 2 + 24 * s)}" width="${Math.round(100 * s)}" height="${Math.round(60 * s)}" rx="${r}" fill="#FFF" ${stroke}/>`).join("")}`,
    dashboard_quad: `${bgRect}<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${Math.round(36 * params.typography_scale)}" rx="${r}" fill="#0F172A"/>${[0, 1, 2, 3].map(i => { const col = i % 2; const row = Math.floor(i / 2); const cw = Math.round((w - pad * 2 - gap) / 2); const ch = Math.round((h - pad * 2 - gap - 48 * params.typography_scale) / 2); return `<rect x="${pad + col * (cw + gap)}" y="${Math.round(pad + 48 * params.typography_scale + row * (ch + gap))}" width="${cw}" height="${ch}" rx="${r}" fill="#FFF" ${stroke}/>`; }).join("")}`,
  };

  const body = layouts[family] ?? layouts.title_hero ?? bgRect;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
};

const generateInfographicSvg = (family: string, params: ParametricParams): string => {
  const w = 600;
  const h = 400;
  const r = params.corner_radius;
  const s = params.spacing_scale;
  const sw = params.stroke_width;
  const bg = `<rect width="${w}" height="${h}" rx="${r}" fill="#FAFBFC"/>`;
  const stroke = sw > 0 ? `stroke="#CBD5E1" stroke-width="${sw}"` : "";

  if (family.startsWith("timeline")) {
    const steps = 5;
    const stepW = Math.round((w - 80 * s) / steps);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}<line x1="${Math.round(40 * s)}" y1="${h / 2}" x2="${w - Math.round(40 * s)}" y2="${h / 2}" stroke="#C7511F" stroke-width="${sw + 1}"/>${Array.from({ length: steps }, (_, i) => `<circle cx="${Math.round(40 * s + i * stepW + stepW / 2)}" cy="${h / 2}" r="${Math.round(12 * s)}" fill="#C7511F"/><rect x="${Math.round(40 * s + i * stepW + stepW / 2 - 30 * s)}" y="${Math.round(h / 2 + 20 * s)}" width="${Math.round(60 * s)}" height="${Math.round(40 * s)}" rx="${r}" fill="#FFF" ${stroke}/>`).join("")}</svg>`;
  }
  if (family.startsWith("process")) {
    const steps = 4;
    const stepW = Math.round((w - 60 * s) / steps);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}${Array.from({ length: steps }, (_, i) => `<polygon points="${Math.round(30 * s + i * stepW)},${Math.round(h * 0.3)} ${Math.round(30 * s + (i + 1) * stepW - 10 * s)},${Math.round(h * 0.3)} ${Math.round(30 * s + (i + 1) * stepW)},${h / 2} ${Math.round(30 * s + (i + 1) * stepW - 10 * s)},${Math.round(h * 0.7)} ${Math.round(30 * s + i * stepW)},${Math.round(h * 0.7)} ${Math.round(30 * s + i * stepW + 10 * s)},${h / 2}" fill="#C7511F" opacity="${0.3 + i * 0.15}" ${stroke}/>`).join("")}</svg>`;
  }
  if (family.startsWith("hierarchy")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}<rect x="${Math.round(w / 2 - 50 * s)}" y="${Math.round(30 * s)}" width="${Math.round(100 * s)}" height="${Math.round(40 * s)}" rx="${r}" fill="#C7511F"/><line x1="${w / 2}" y1="${Math.round(70 * s)}" x2="${w / 2}" y2="${Math.round(110 * s)}" stroke="#64748B" stroke-width="${sw}"/><line x1="${Math.round(w * 0.2)}" y1="${Math.round(110 * s)}" x2="${Math.round(w * 0.8)}" y2="${Math.round(110 * s)}" stroke="#64748B" stroke-width="${sw}"/>${[0.2, 0.5, 0.8].map(x => `<line x1="${Math.round(w * x)}" y1="${Math.round(110 * s)}" x2="${Math.round(w * x)}" y2="${Math.round(140 * s)}" stroke="#64748B" stroke-width="${sw}"/><rect x="${Math.round(w * x - 40 * s)}" y="${Math.round(140 * s)}" width="${Math.round(80 * s)}" height="${Math.round(35 * s)}" rx="${r}" fill="#0F172A" opacity="0.8"/>`).join("")}${[0.1, 0.3, 0.4, 0.6, 0.7, 0.9].map(x => `<rect x="${Math.round(w * x - 25 * s)}" y="${Math.round(210 * s)}" width="${Math.round(50 * s)}" height="${Math.round(25 * s)}" rx="${r / 2}" fill="#FFF" ${stroke}/>`).join("")}</svg>`;
  }
  if (family.startsWith("comparison")) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}<rect x="${Math.round(30 * s)}" y="${Math.round(30 * s)}" width="${Math.round(w / 2 - 40 * s)}" height="${h - Math.round(60 * s)}" rx="${r}" fill="#FFF" ${stroke}/><rect x="${Math.round(w / 2 + 10 * s)}" y="${Math.round(30 * s)}" width="${Math.round(w / 2 - 40 * s)}" height="${h - Math.round(60 * s)}" rx="${r}" fill="#FFF" ${stroke}/><rect x="${Math.round(30 * s)}" y="${Math.round(30 * s)}" width="${Math.round(w / 2 - 40 * s)}" height="${Math.round(36 * params.typography_scale)}" rx="${r} ${r} 0 0" fill="#C7511F"/><rect x="${Math.round(w / 2 + 10 * s)}" y="${Math.round(30 * s)}" width="${Math.round(w / 2 - 40 * s)}" height="${Math.round(36 * params.typography_scale)}" rx="${r} ${r} 0 0" fill="#0F172A"/></svg>`;
  }
  if (family.startsWith("statistical")) {
    const bars = 6;
    const barW = Math.round((w - 80 * s) / bars - 8 * s);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}${Array.from({ length: bars }, (_, i) => { const bh = Math.round(50 + (i * 37 % 200)); return `<rect x="${Math.round(40 * s + i * (barW + 8 * s))}" y="${h - Math.round(40 * s) - bh}" width="${barW}" height="${bh}" rx="${r / 2}" fill="#C7511F" opacity="${0.5 + (i % 3) * 0.2}"/>`; }).join("")}<line x1="${Math.round(40 * s)}" y1="${h - Math.round(40 * s)}" x2="${w - Math.round(40 * s)}" y2="${h - Math.round(40 * s)}" stroke="#94A3B8" stroke-width="${sw}"/></svg>`;
  }
  if (family.startsWith("cycle")) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.round(120 * s);
    const steps = 6;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#C7511F" stroke-width="${sw + 1}" stroke-dasharray="8 4"/>${Array.from({ length: steps }, (_, i) => { const angle = (i / steps) * Math.PI * 2 - Math.PI / 2; const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle) * radius; return `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${Math.round(18 * s)}" fill="#C7511F" opacity="${0.6 + (i % 2) * 0.3}"/>`; }).join("")}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${bg}<rect x="${Math.round(30 * s)}" y="${Math.round(30 * s)}" width="${w - Math.round(60 * s)}" height="${h - Math.round(60 * s)}" rx="${r}" fill="#FFF" ${stroke}/></svg>`;
};

const generateBackgroundCss = (family: string, params: ParametricParams): string => {
  const r = params.corner_radius;
  if (family.startsWith("solid")) {
    const colors: Record<string, string> = { solid_light: "#FFFFFF", solid_dark: "#0F172A", solid_neutral: "#F1F5F9" };
    return `background:${colors[family] ?? "#FFFFFF"};border-radius:${r}px;`;
  }
  if (family.startsWith("gradient")) {
    const gradients: Record<string, string> = {
      gradient_linear: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      gradient_radial: "radial-gradient(circle at 30% 40%, #ffecd2 0%, #fcb69f 100%)",
      gradient_diagonal: "linear-gradient(45deg, #0F172A 0%, #1E3A5F 50%, #C7511F 100%)",
      gradient_mesh: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    };
    return `background:${gradients[family] ?? gradients.gradient_linear};border-radius:${r}px;`;
  }
  if (family.startsWith("pattern")) {
    const size = Math.round(20 * params.spacing_scale);
    const patterns: Record<string, string> = {
      pattern_dots: `background:radial-gradient(circle,#CBD5E1 1px,transparent 1px);background-size:${size}px ${size}px;`,
      pattern_lines: `background:repeating-linear-gradient(0deg,transparent,transparent ${size - 1}px,#E2E8F0 ${size - 1}px,#E2E8F0 ${size}px);`,
      pattern_grid: `background:linear-gradient(#E2E8F0 1px,transparent 1px),linear-gradient(90deg,#E2E8F0 1px,transparent 1px);background-size:${size}px ${size}px;`,
      pattern_chevron: `background:linear-gradient(135deg,#F1F5F9 25%,transparent 25%) -${size / 2}px 0,linear-gradient(225deg,#F1F5F9 25%,transparent 25%) -${size / 2}px 0,linear-gradient(315deg,#F1F5F9 25%,transparent 25%),linear-gradient(45deg,#F1F5F9 25%,transparent 25%);background-size:${size}px ${size}px;background-color:#FAFBFC;`,
      pattern_wave: `background:repeating-linear-gradient(45deg,transparent,transparent ${size / 2}px,#E2E8F0 ${size / 2}px,#E2E8F0 ${size / 2 + 1}px);`,
      pattern_hexagon: `background:#F8FAFC;background-image:radial-gradient(circle farthest-side at 0% 50%,#E2E8F0 24%,transparent 26%),radial-gradient(circle farthest-side at 0% 50%,#F1F5F9 24%,transparent 25%);background-size:${size * 2}px ${size}px;`,
      pattern_diamond: `background:linear-gradient(45deg,#F1F5F9 25%,transparent 25%,transparent 75%,#F1F5F9 75%),linear-gradient(45deg,#F1F5F9 25%,transparent 25%,transparent 75%,#F1F5F9 75%);background-size:${size}px ${size}px;background-position:0 0,${size / 2}px ${size / 2}px;background-color:#FAFBFC;`,
    };
    return `${patterns[family] ?? patterns.pattern_dots}border-radius:${r}px;`;
  }
  return `background:#FFFFFF;border-radius:${r}px;`;
};

const generateIconSvg = (family: string, index: number, params: ParametricParams): string => {
  const size = 48;
  const sw = params.stroke_width || 1.5;
  const r = params.corner_radius;
  const icons: Record<string, string[]> = {
    business_core: [
      `<rect x="8" y="14" width="32" height="26" rx="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"/><line x1="8" y1="22" x2="40" y2="22" stroke="currentColor" stroke-width="${sw}"/>`,
      `<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="${sw}"/><path d="M24 16v8l6 4" fill="none" stroke="currentColor" stroke-width="${sw}"/>`,
      `<path d="M12 36V20l12-8 12 8v16" fill="none" stroke="currentColor" stroke-width="${sw}"/><rect x="20" y="26" width="8" height="10" fill="none" stroke="currentColor" stroke-width="${sw}"/>`,
      `<rect x="6" y="10" width="14" height="28" rx="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"/><rect x="28" y="10" width="14" height="28" rx="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"/>`,
    ],
    technology: [
      `<rect x="8" y="12" width="32" height="20" rx="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"/><line x1="24" y1="32" x2="24" y2="38" stroke="currentColor" stroke-width="${sw}"/><line x1="16" y1="38" x2="32" y2="38" stroke="currentColor" stroke-width="${sw}"/>`,
      `<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="${sw}"/><path d="M18 24h12M24 18v12" stroke="currentColor" stroke-width="${sw}"/>`,
      `<path d="M16 8h16l8 8v24H8V16z" fill="none" stroke="currentColor" stroke-width="${sw}"/><path d="M32 8v8h8" fill="none" stroke="currentColor" stroke-width="${sw}"/>`,
    ],
    finance: [
      `<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="${sw}"/><text x="24" y="30" text-anchor="middle" font-size="18" fill="currentColor">$</text>`,
      `<path d="M8 36L16 24 24 28 32 16 40 20" fill="none" stroke="currentColor" stroke-width="${sw}"/><circle cx="8" cy="36" r="2" fill="currentColor"/><circle cx="40" cy="20" r="2" fill="currentColor"/>`,
    ],
    data_analytics: [
      `<rect x="8" y="28" width="8" height="12" rx="${r / 2}" fill="currentColor" opacity="0.6"/><rect x="20" y="18" width="8" height="22" rx="${r / 2}" fill="currentColor" opacity="0.8"/><rect x="32" y="8" width="8" height="32" rx="${r / 2}" fill="currentColor"/>`,
      `<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="${sw}"/><path d="M24 24L24 10A14 14 0 0 1 37.8 28.5Z" fill="currentColor" opacity="0.3"/>`,
    ],
  };
  const familyIcons = icons[family] ?? icons.business_core ?? [];
  const iconBody = familyIcons[index % familyIcons.length] ?? familyIcons[0] ?? `<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="${sw}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none" color="#0F172A">${iconBody}</svg>`;
};

const generateMotionCss = (family: string, params: ParametricParams): string => {
  const duration = Math.round(400 * params.spacing_scale);
  const motions: Record<string, string> = {
    fade_in: `@keyframes fadeIn{from{opacity:0}to{opacity:1}}.motion{animation:fadeIn ${duration}ms ease-out}`,
    fade_out: `@keyframes fadeOut{from{opacity:1}to{opacity:0}}.motion{animation:fadeOut ${duration}ms ease-in}`,
    slide_left: `@keyframes slideLeft{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}.motion{animation:slideLeft ${duration}ms ease-out}`,
    slide_right: `@keyframes slideRight{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}.motion{animation:slideRight ${duration}ms ease-out}`,
    slide_up: `@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}.motion{animation:slideUp ${duration}ms ease-out}`,
    slide_down: `@keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}.motion{animation:slideDown ${duration}ms ease-out}`,
    zoom_in: `@keyframes zoomIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}.motion{animation:zoomIn ${duration}ms ease-out}`,
    zoom_out: `@keyframes zoomOut{from{transform:scale(1.5);opacity:0}to{transform:scale(1);opacity:1}}.motion{animation:zoomOut ${duration}ms ease-out}`,
    bounce_in: `@keyframes bounceIn{0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.05)}70%{transform:scale(0.9)}100%{transform:scale(1);opacity:1}}.motion{animation:bounceIn ${duration * 1.5}ms ease-out}`,
    stagger_fade: `@keyframes staggerFade{from{opacity:0;transform:translateY(${Math.round(20 * params.spacing_scale)}px)}to{opacity:1;transform:translateY(0)}}.motion>*{animation:staggerFade ${duration}ms ease-out backwards}.motion>*:nth-child(1){animation-delay:0ms}.motion>*:nth-child(2){animation-delay:${Math.round(duration * 0.15)}ms}.motion>*:nth-child(3){animation-delay:${Math.round(duration * 0.3)}ms}`,
    typewriter: `@keyframes typewriter{from{width:0}to{width:100%}}.motion{overflow:hidden;white-space:nowrap;animation:typewriter ${duration * 3}ms steps(40) forwards}`,
  };
  return motions[family] ?? motions.fade_in ?? "";
};

const generateHeaderFooterCss = (family: string, params: ParametricParams): string => {
  const h = Math.round(36 * params.typography_scale);
  const r = params.corner_radius;
  const presets: Record<string, string> = {
    minimal_line: `.hf{height:${h}px;border-top:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:${Math.round(11 * params.typography_scale)}px;color:#94A3B8;}`,
    full_bar: `.hf{height:${h}px;background:#0F172A;color:#FFF;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:${Math.round(11 * params.typography_scale)}px;border-radius:0 0 ${r}px ${r}px;}`,
    logo_left: `.hf{height:${h}px;display:flex;align-items:center;gap:12px;padding:0 24px;font-size:${Math.round(11 * params.typography_scale)}px;color:#64748B;}.hf::before{content:'';width:${Math.round(24 * params.spacing_scale)}px;height:${Math.round(24 * params.spacing_scale)}px;background:#C7511F;border-radius:4px;}`,
    gradient_bar: `.hf{height:${h}px;background:linear-gradient(90deg,#0F172A,#1E3A5F);color:#FFF;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:${Math.round(11 * params.typography_scale)}px;}`,
    slide_x_of_y: `.hf{height:${h}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(12 * params.typography_scale)}px;color:#94A3B8;}.hf::after{content:'X / Y';}`,
    confidential_notice: `.hf{height:${h}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(10 * params.typography_scale)}px;color:#DC2626;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;}.hf::after{content:'CONFIDENTIAL';}`,
  };
  return presets[family] ?? presets.minimal_line ?? "";
};

// ─── Catalog Builder ─────────────────────────────────────────────────────────

const buildAsset = (
  kind: CatalogKind,
  family: string,
  index: number,
  density: "sparse" | "standard" | "dense",
  tone: "formal" | "neutral" | "creative",
  tags: string[],
  cluster: string,
  params: ParametricParams
): CatalogAsset => {
  const id = `${kind}-${family}-${index}`;
  const nameMap: Record<CatalogKind, string> = {
    layout: "Layout",
    infographic: "Infographic",
    chart_skin: "Chart Skin",
    table_style: "Table Style",
    icon_pack: "Icon Pack",
    motion_preset: "Motion",
    header_footer: "Header/Footer",
    background: "Background",
  };
  const nameArMap: Record<CatalogKind, string> = {
    layout: "تخطيط",
    infographic: "إنفوجرافيك",
    chart_skin: "نمط رسم بياني",
    table_style: "نمط جدول",
    icon_pack: "حزمة أيقونات",
    motion_preset: "حركة",
    header_footer: "رأس/تذييل",
    background: "خلفية",
  };
  return {
    asset_id: id,
    catalog_kind: kind,
    name: `${nameMap[kind]} ${family.replace(/_/g, " ")} #${index + 1}`,
    name_ar: `${nameArMap[kind]} ${family.replace(/_/g, " ")} #${index + 1}`,
    family,
    cluster,
    tags: [kind, family, density, tone, ...tags],
    density,
    tone,
    rtl_ready: true,
    brand_compatible: true,
    base_params: { ...params },
    svg_template: kind === "layout" ? generateLayoutSvg(family, params)
      : kind === "infographic" ? generateInfographicSvg(family, params)
      : kind === "icon_pack" ? generateIconSvg(family, index, params)
      : "",
    css_template: kind === "background" ? generateBackgroundCss(family, params)
      : kind === "motion_preset" ? generateMotionCss(family, params)
      : kind === "header_footer" ? generateHeaderFooterCss(family, params)
      : kind === "table_style" ? generateTableCss(family, params)
      : kind === "chart_skin" ? generateChartCss(family, params)
      : "",
    layout_spec: kind === "layout" ? buildLayoutSpec(family, params) : {},
    version: 1,
    created_at: now(),
  };
};

const generateTableCss = (family: string, params: ParametricParams): string => {
  const r = params.corner_radius;
  const fs = Math.round(13 * params.typography_scale);
  const pad = Math.round(10 * params.spacing_scale);
  const styles: Record<string, string> = {
    minimal: `table{border-collapse:collapse;width:100%;font-size:${fs}px}td,th{padding:${pad}px;text-align:start}th{font-weight:600;border-bottom:2px solid #0F172A}td{border-bottom:1px solid #E2E8F0}`,
    bordered: `table{border-collapse:collapse;width:100%;font-size:${fs}px;border:1px solid #CBD5E1;border-radius:${r}px}td,th{padding:${pad}px;border:1px solid #CBD5E1;text-align:start}th{background:#F8FAFC;font-weight:600}`,
    striped: `table{border-collapse:collapse;width:100%;font-size:${fs}px}td,th{padding:${pad}px;text-align:start}th{background:#0F172A;color:#FFF;font-weight:600}tr:nth-child(even) td{background:#F8FAFC}`,
    hover_highlight: `table{border-collapse:collapse;width:100%;font-size:${fs}px}td,th{padding:${pad}px;text-align:start}th{font-weight:600;border-bottom:2px solid #C7511F}tr:hover td{background:#FEF3CD}`,
    compact_dense: `table{border-collapse:collapse;width:100%;font-size:${Math.round(11 * params.typography_scale)}px}td,th{padding:${Math.round(4 * params.spacing_scale)}px ${Math.round(8 * params.spacing_scale)}px;text-align:start}th{font-weight:600;background:#F1F5F9;border-bottom:1px solid #CBD5E1}td{border-bottom:1px solid #F1F5F9}`,
    card_style: `table{border-collapse:separate;border-spacing:0 ${Math.round(6 * params.spacing_scale)}px;width:100%;font-size:${fs}px}td,th{padding:${pad}px}th{font-weight:600}tr td{background:#FFF;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-radius:${r}px}tr td:first-child{border-radius:${r}px 0 0 ${r}px}tr td:last-child{border-radius:0 ${r}px ${r}px 0}`,
    gradient_header: `table{border-collapse:collapse;width:100%;font-size:${fs}px}td,th{padding:${pad}px;text-align:start}th{background:linear-gradient(135deg,#0F172A,#1E3A5F);color:#FFF;font-weight:600}td{border-bottom:1px solid #E2E8F0}`,
    dark_header: `table{border-collapse:collapse;width:100%;font-size:${fs}px}td,th{padding:${pad}px;text-align:start}th{background:#0F172A;color:#FFF;font-weight:600}td{border-bottom:1px solid #E2E8F0}`,
    glass_effect: `table{border-collapse:collapse;width:100%;font-size:${fs}px;backdrop-filter:blur(8px)}td,th{padding:${pad}px;text-align:start}th{background:rgba(15,23,42,0.7);color:#FFF;font-weight:600;backdrop-filter:blur(4px)}td{background:rgba(255,255,255,0.6);border-bottom:1px solid rgba(226,232,240,0.5)}`,
    kpi_table: `table{border-collapse:collapse;width:100%;font-size:${fs}px}td,th{padding:${pad}px;text-align:center}th{font-weight:600;color:#64748B;border-bottom:2px solid #C7511F}td{font-size:${Math.round(20 * params.typography_scale)}px;font-weight:700;color:#0F172A}`,
  };
  return styles[family] ?? styles.minimal ?? "";
};

const generateChartCss = (family: string, params: ParametricParams): string => {
  const r = params.corner_radius;
  const skins: Record<string, string> = {
    bar_standard: `.chart-bar{fill:#C7511F;rx:${r / 2}}.chart-axis{stroke:#94A3B8;stroke-width:${params.stroke_width}}.chart-grid{stroke:#F1F5F9;stroke-width:0.5}`,
    bar_stacked: `.chart-bar{rx:${r / 2}}.chart-bar.s0{fill:#C7511F}.chart-bar.s1{fill:#1D8F6E}.chart-bar.s2{fill:#0F172A}.chart-axis{stroke:#94A3B8}`,
    line_standard: `.chart-line{stroke:#C7511F;stroke-width:2;fill:none}.chart-dot{fill:#C7511F;r:4}.chart-area{fill:#C7511F;opacity:0.08}`,
    line_smooth: `.chart-line{stroke:#C7511F;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round}.chart-dot{fill:#FFF;stroke:#C7511F;stroke-width:2;r:5}`,
    pie_standard: `.chart-slice.s0{fill:#C7511F}.chart-slice.s1{fill:#1D8F6E}.chart-slice.s2{fill:#0F172A}.chart-slice.s3{fill:#64748B}.chart-label{font-size:12px;fill:#0F172A}`,
    pie_donut: `.chart-slice.s0{fill:#C7511F}.chart-slice.s1{fill:#1D8F6E}.chart-slice.s2{fill:#0F172A}.chart-center{fill:#FFF;r:40%}`,
    combo_bar_line: `.chart-bar{fill:#C7511F;rx:${r / 2}}.chart-line{stroke:#1D8F6E;stroke-width:2.5;fill:none}.chart-dot{fill:#1D8F6E;r:4}`,
    scatter_basic: `.chart-dot{fill:#C7511F;opacity:0.7;r:${Math.round(4 * params.spacing_scale)}}.chart-axis{stroke:#94A3B8;stroke-width:${params.stroke_width}}`,
  };
  return skins[family] ?? skins.bar_standard ?? "";
};

const buildLayoutSpec = (family: string, params: ParametricParams): Record<string, unknown> => {
  const s = params.spacing_scale;
  const specs: Record<string, Record<string, unknown>> = {
    title_hero: { regions: ["title", "subtitle"], title_box: { x: 48 * s, y: 216, w: 1184, h: 72 }, subtitle_box: { x: 48 * s, y: 300, w: 710, h: 24 } },
    content_split: { regions: ["left", "right"], left_box: { x: 48 * s, y: 48 * s, w: 580, h: 624 }, right_box: { x: 652, y: 48 * s, w: 580, h: 624 } },
    two_column: { regions: ["title", "left", "right"], title_box: { x: 48 * s, y: 48 * s, w: 1184, h: 48 }, left_box: { x: 48 * s, y: 108, w: 580, h: 564 }, right_box: { x: 652, y: 108, w: 580, h: 564 } },
    grid_2x2: { regions: ["title", "q1", "q2", "q3", "q4"], title_box: { x: 48 * s, y: 48 * s, w: 1184, h: 48 } },
    kpi_row: { regions: ["title", "kpi1", "kpi2", "kpi3", "kpi4", "detail"], title_box: { x: 48 * s, y: 48 * s, w: 1184, h: 48 } },
    chart_main: { regions: ["title", "chart", "legend"], title_box: { x: 48 * s, y: 48 * s, w: 1184, h: 48 } },
    media_left: { regions: ["media", "content"], media_box: { x: 48 * s, y: 48 * s, w: 530, h: 624 }, content_box: { x: 602, y: 48 * s, w: 630, h: 624 } },
    dashboard_quad: { regions: ["title", "tl", "tr", "bl", "br"], title_box: { x: 48 * s, y: 48 * s, w: 1184, h: 36 } },
  };
  return specs[family] ?? { regions: ["content"] };
};

// ─── Catalog Class ───────────────────────────────────────────────────────────

export class PresentationCatalog {
  private assets: Map<string, CatalogAsset> = new Map();
  private byKind: Map<CatalogKind, CatalogAsset[]> = new Map();
  private byFamily: Map<string, CatalogAsset[]> = new Map();

  constructor() {
    this.buildAll();
  }

  private buildAll(): void {
    const densities: Array<"sparse" | "standard" | "dense"> = ["sparse", "standard", "dense"];
    const tones: Array<"formal" | "neutral" | "creative"> = ["formal", "neutral", "creative"];

    // Layouts: 30 families × ~10 variants each = 300+
    this.buildCatalogKind("layout", LAYOUT_FAMILIES, densities, tones, 10);
    // Infographics: 26 families × ~10 = 260+
    this.buildCatalogKind("infographic", INFOGRAPHIC_FAMILIES, densities, tones, 10);
    // Table styles: 20 families × 10 = 200+
    this.buildCatalogKind("table_style", TABLE_FAMILIES, densities, tones, 10);
    // Chart skins: 16 families × 10 = 160+
    this.buildCatalogKind("chart_skin", CHART_FAMILIES, densities, tones, 10);
    // Icon packs: 25 families × 2 = 50+
    this.buildCatalogKind("icon_pack", ICON_FAMILIES, densities, tones, 2);
    // Motion presets: 20 families × 4 = 80+
    this.buildCatalogKind("motion_preset", MOTION_FAMILIES, densities, tones, 4);
    // Header/footer: 16 families × 8 = 128+
    this.buildCatalogKind("header_footer", HEADER_FOOTER_FAMILIES, densities, tones, 8);
    // Backgrounds: 20 families × 10 = 200+
    this.buildCatalogKind("background", BACKGROUND_FAMILIES, densities, tones, 10);
  }

  private buildCatalogKind(
    kind: CatalogKind,
    families: readonly string[],
    densities: Array<"sparse" | "standard" | "dense">,
    tones: Array<"formal" | "neutral" | "creative">,
    perFamily: number
  ): void {
    for (const family of families) {
      for (let i = 0; i < perFamily; i++) {
        const di = i % densities.length;
        const ti = Math.floor(i / densities.length) % tones.length;
        const params: ParametricParams = {
          spacing_scale: 0.8 + (i % 5) * 0.1,
          corner_radius: [0, 4, 8, 12, 16][i % 5],
          stroke_width: [0, 0.5, 1, 1.5, 2][i % 5],
          shadow_depth: i % 4,
          palette_mapping: PALETTE_MAPPINGS[i % PALETTE_MAPPINGS.length],
          typography_scale: 0.85 + (i % 4) * 0.1,
          rtl_mirroring: i % 3 === 0,
        };
        const cluster = `${kind}_${family.split("_")[0]}`;
        const asset = buildAsset(kind, family, i, densities[di], tones[ti], [family.split("_")[0]], cluster, params);
        this.assets.set(asset.asset_id, asset);
        const kindList = this.byKind.get(kind) ?? [];
        kindList.push(asset);
        this.byKind.set(kind, kindList);
        const familyKey = `${kind}:${family}`;
        const familyList = this.byFamily.get(familyKey) ?? [];
        familyList.push(asset);
        this.byFamily.set(familyKey, familyList);
      }
    }
  }

  search(request: CatalogSearchRequest): CatalogSearchResult {
    let candidates = this.byKind.get(request.catalog_kind) ?? [];
    if (request.density) candidates = candidates.filter(a => a.density === request.density);
    if (request.tone) candidates = candidates.filter(a => a.tone === request.tone);
    if (request.rtl_ready !== undefined) candidates = candidates.filter(a => a.rtl_ready === request.rtl_ready);
    if (request.brand_compatible !== undefined) candidates = candidates.filter(a => a.brand_compatible === request.brand_compatible);
    if (request.family) candidates = candidates.filter(a => a.family === request.family);
    if (request.tags && request.tags.length > 0) {
      const tagSet = new Set(request.tags.map(t => t.toLowerCase()));
      candidates = candidates.filter(a => a.tags.some(t => tagSet.has(t.toLowerCase())));
    }
    if (request.query) {
      const q = request.query.toLowerCase();
      candidates = candidates.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.name_ar.includes(q) ||
        a.family.includes(q) ||
        a.tags.some(t => t.includes(q))
      );
    }
    // Score by relevance
    candidates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      if (request.query) {
        const q = request.query.toLowerCase();
        if (a.name.toLowerCase().startsWith(q)) scoreA += 10;
        if (b.name.toLowerCase().startsWith(q)) scoreB += 10;
        if (a.family === q) scoreA += 5;
        if (b.family === q) scoreB += 5;
      }
      return scoreB - scoreA;
    });
    const offset = request.offset ?? 0;
    const limit = request.limit ?? 12;
    const sliced = candidates.slice(offset, offset + limit);
    return { assets: sliced, total: candidates.length, has_more: offset + limit < candidates.length };
  }

  getAsset(assetId: string): CatalogAsset | null {
    return this.assets.get(assetId) ?? null;
  }

  generateVariants(request: VariantGenerateRequest): VariantGenerateResult {
    const base = this.assets.get(request.base_asset_id);
    if (!base) return { variants: [], base_asset_id: request.base_asset_id, direction: request.direction };

    const count = request.count ?? 12;
    const seed = request.seed ?? hashToNumber(request.base_asset_id + request.direction);
    const rng = new SeededRandom(seed);
    const variants: CatalogVariant[] = [];

    for (let i = 0; i < count; i++) {
      let params: ParametricParams;
      if (request.direction === "more_like_this") {
        params = {
          spacing_scale: clamp(base.base_params.spacing_scale + rng.range(-0.15, 0.15), 0.5, 2.0),
          corner_radius: clamp(Math.round(base.base_params.corner_radius + rng.range(-4, 4)), 0, 32),
          stroke_width: clamp(Number((base.base_params.stroke_width + rng.range(-0.5, 0.5)).toFixed(1)), 0, 6),
          shadow_depth: clamp(Math.round(base.base_params.shadow_depth + rng.range(-1, 1)), 0, 4),
          palette_mapping: rng.next() > 0.7 ? rng.pick(PALETTE_MAPPINGS) : base.base_params.palette_mapping,
          typography_scale: clamp(Number((base.base_params.typography_scale + rng.range(-0.1, 0.1)).toFixed(2)), 0.75, 1.5),
          rtl_mirroring: rng.next() > 0.8 ? !base.base_params.rtl_mirroring : base.base_params.rtl_mirroring,
        };
      } else if (request.direction === "different_direction") {
        // Jump to a different cluster
        const allFamilies = this.getFamiliesForKind(base.catalog_kind);
        const otherFamilies = allFamilies.filter(f => f !== base.family);
        const targetFamily = rng.pick(otherFamilies.length > 0 ? otherFamilies : allFamilies);
        const familyAssets = this.byFamily.get(`${base.catalog_kind}:${targetFamily}`) ?? [];
        const templateAsset = familyAssets.length > 0 ? rng.pick(familyAssets) : base;
        params = {
          spacing_scale: clamp(templateAsset.base_params.spacing_scale + rng.range(-0.2, 0.2), 0.5, 2.0),
          corner_radius: clamp(Math.round(templateAsset.base_params.corner_radius + rng.range(-6, 6)), 0, 32),
          stroke_width: clamp(Number((templateAsset.base_params.stroke_width + rng.range(-1, 1)).toFixed(1)), 0, 6),
          shadow_depth: clamp(Math.round(rng.range(0, 4)), 0, 4),
          palette_mapping: rng.pick(PALETTE_MAPPINGS),
          typography_scale: clamp(Number((rng.range(0.8, 1.3)).toFixed(2)), 0.75, 1.5),
          rtl_mirroring: rng.next() > 0.5,
        };
      } else if (request.direction === "simpler") {
        params = {
          spacing_scale: clamp(base.base_params.spacing_scale * 0.9 + rng.range(-0.05, 0.05), 0.5, 2.0),
          corner_radius: Math.max(0, Math.round(base.base_params.corner_radius * 0.7)),
          stroke_width: Math.max(0, Number((base.base_params.stroke_width * 0.6).toFixed(1))),
          shadow_depth: Math.max(0, base.base_params.shadow_depth - 1),
          palette_mapping: "primary:secondary",
          typography_scale: 1.0,
          rtl_mirroring: base.base_params.rtl_mirroring,
        };
      } else {
        // more_complex
        params = {
          spacing_scale: clamp(base.base_params.spacing_scale * 1.1 + rng.range(-0.05, 0.1), 0.5, 2.0),
          corner_radius: Math.min(32, Math.round(base.base_params.corner_radius * 1.3)),
          stroke_width: Math.min(6, Number((base.base_params.stroke_width * 1.4).toFixed(1))),
          shadow_depth: Math.min(4, base.base_params.shadow_depth + 1),
          palette_mapping: rng.pick(PALETTE_MAPPINGS),
          typography_scale: clamp(Number((base.base_params.typography_scale * 1.1).toFixed(2)), 0.75, 1.5),
          rtl_mirroring: base.base_params.rtl_mirroring,
        };
      }

      const variantId = `${base.asset_id}-var-${i}-${hash(`${seed}${i}`).slice(0, 6)}`;
      const previewSvg = base.catalog_kind === "layout" ? generateLayoutSvg(base.family, params)
        : base.catalog_kind === "infographic" ? generateInfographicSvg(base.family, params)
        : base.catalog_kind === "icon_pack" ? generateIconSvg(base.family, i, params)
        : "";
      const previewCss = base.catalog_kind === "background" ? generateBackgroundCss(base.family, params)
        : base.catalog_kind === "motion_preset" ? generateMotionCss(base.family, params)
        : base.catalog_kind === "header_footer" ? generateHeaderFooterCss(base.family, params)
        : base.catalog_kind === "table_style" ? generateTableCss(base.family, params)
        : base.catalog_kind === "chart_skin" ? generateChartCss(base.family, params)
        : "";

      variants.push({
        variant_id: variantId,
        base_asset_id: base.asset_id,
        catalog_kind: base.catalog_kind,
        params,
        name: `${base.name} Variant #${i + 1}`,
        preview_css: previewCss,
        preview_svg: previewSvg,
        score: 1 - i * 0.05,
      });
    }

    return { variants, base_asset_id: request.base_asset_id, direction: request.direction };
  }

  /** Get available families for a catalog kind */
  getFamiliesForKind(kind: CatalogKind): string[] {
    const seen = new Set<string>();
    for (const asset of this.byKind.get(kind) ?? []) {
      seen.add(asset.family);
    }
    return [...seen];
  }

  /** Get catalog stats */
  getStats(): Record<CatalogKind, { base_count: number; families: number }> {
    const result = {} as Record<CatalogKind, { base_count: number; families: number }>;
    for (const [kind, assets] of this.byKind) {
      const families = new Set(assets.map(a => a.family));
      result[kind] = { base_count: assets.length, families: families.size };
    }
    return result;
  }

  /** Total base assets across all catalogs */
  totalAssets(): number {
    return this.assets.size;
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hashToNumber(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Singleton instance
let _catalogInstance: PresentationCatalog | null = null;
export const getCatalog = (): PresentationCatalog => {
  if (!_catalogInstance) _catalogInstance = new PresentationCatalog();
  return _catalogInstance;
};
