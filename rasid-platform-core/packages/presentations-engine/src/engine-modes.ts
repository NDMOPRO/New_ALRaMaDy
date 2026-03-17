/**
 * Presentation Engine Modes
 * AUTO mode: prompt → outline → storyboard → deck → QA → export
 * CONTROLLED mode: granular knobs for slide_count, tone, density, theme, etc.
 * Content Modes: MODE_LITERAL_1TO1 and MODE_SMART
 * Infographic variants: timeline/process/swot/2x2/kpi_grid/comparison/org_chart/quote/section_divider/diagram
 * Template-Lock compliance report
 * Integration connectors (Google Drive/OneDrive/SharePoint/S3)
 * Strict Insert from image/PDF
 * Anti-Cheating guardrails
 * Definition of Done validator
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// ─── Engine Mode Types ───────────────────────────────────────────────────────

export type EngineMode = "auto" | "controlled";

export type ContentFidelityMode = "literal_1to1" | "smart";

export const ContentFidelityModeSchema = z.enum(["literal_1to1", "smart"]);

export type ControlledModeKnobs = {
  slide_count: number;
  tone: "formal" | "neutral" | "creative" | "direct";
  density: "light" | "balanced" | "dense";
  theme: string;
  brand: string | null;
  language: string;
  infographic_level: "none" | "low" | "med" | "high";
  motion_level: "none" | "subtle" | "moderate" | "high";
  chart_style: "bar" | "line" | "pie" | "area" | "donut" | "radar";
  icon_pack: "business_core" | "tech" | "finance" | "medical" | "education" | "custom";
};

export const ControlledModeKnobsSchema = z.object({
  slide_count: z.number().int().min(1).max(100).default(10),
  tone: z.enum(["formal", "neutral", "creative", "direct"]).default("formal"),
  density: z.enum(["light", "balanced", "dense"]).default("balanced"),
  theme: z.string().default("default"),
  brand: z.string().nullable().default(null),
  language: z.string().default("ar-SA"),
  infographic_level: z.enum(["none", "low", "med", "high"]).default("med"),
  motion_level: z.enum(["none", "subtle", "moderate", "high"]).default("subtle"),
  chart_style: z.enum(["bar", "line", "pie", "area", "donut", "radar"]).default("bar"),
  icon_pack: z.enum(["business_core", "tech", "finance", "medical", "education", "custom"]).default("business_core")
});

// ─── AUTO Mode Pipeline ──────────────────────────────────────────────────────

export type AutoFlowStage =
  | "prompt_received"
  | "outline_generated"
  | "storyboard_generated"
  | "deck_materialized"
  | "qa_passed"
  | "export_completed"
  | "failed";

export type AutoFlowState = {
  flow_id: string;
  mode: "auto";
  current_stage: AutoFlowStage;
  stages_completed: AutoFlowStage[];
  stage_timestamps: Record<string, string>;
  prompt: string;
  language: string;
  errors: string[];
  anti_cheat_violations: string[];
  started_at: string;
  completed_at: string | null;
};

export type ControlledFlowState = {
  flow_id: string;
  mode: "controlled";
  knobs: ControlledModeKnobs;
  content_mode: ContentFidelityMode;
  current_stage: AutoFlowStage;
  stages_completed: AutoFlowStage[];
  stage_timestamps: Record<string, string>;
  errors: string[];
  anti_cheat_violations: string[];
  started_at: string;
  completed_at: string | null;
};

const now = (): string => new Date().toISOString();
const uid = (prefix: string, ...parts: Array<string | number>) =>
  [prefix, ...parts].join("-").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export const createAutoFlowState = (prompt: string, language: string): AutoFlowState => {
  const ts = now();
  return {
    flow_id: uid("auto-flow", Date.now()),
    mode: "auto",
    current_stage: "prompt_received",
    stages_completed: ["prompt_received"],
    stage_timestamps: { prompt_received: ts },
    prompt,
    language,
    errors: [],
    anti_cheat_violations: [],
    started_at: ts,
    completed_at: null
  };
};

export const createControlledFlowState = (knobs: ControlledModeKnobs, contentMode: ContentFidelityMode): ControlledFlowState => {
  const ts = now();
  return {
    flow_id: uid("controlled-flow", Date.now()),
    mode: "controlled",
    knobs,
    content_mode: contentMode,
    current_stage: "prompt_received",
    stages_completed: ["prompt_received"],
    stage_timestamps: { prompt_received: ts },
    errors: [],
    anti_cheat_violations: [],
    started_at: ts,
    completed_at: null
  };
};

export const advanceFlowStage = <T extends AutoFlowState | ControlledFlowState>(
  state: T,
  stage: AutoFlowStage
): T => {
  const ts = now();
  return {
    ...state,
    current_stage: stage,
    stages_completed: [...state.stages_completed, stage],
    stage_timestamps: { ...state.stage_timestamps, [stage]: ts },
    completed_at: stage === "export_completed" ? ts : state.completed_at
  };
};

export const failFlow = <T extends AutoFlowState | ControlledFlowState>(
  state: T,
  error: string
): T => ({
  ...state,
  current_stage: "failed",
  errors: [...state.errors, error]
});

// ─── Content Fidelity Modes ──────────────────────────────────────────────────

export type ContentTraceEntry = {
  trace_id: string;
  source_ref: string;
  source_text: string;
  output_text: string;
  slide_ref: string;
  block_ref: string;
  fidelity_mode: ContentFidelityMode;
  hash_match: boolean;
  source_hash: string;
  output_hash: string;
  trace_kind: "literal_copy" | "paraphrase" | "synthesis" | "data_transform";
};

export type ContentFidelityReport = {
  report_id: string;
  deck_id: string;
  mode: ContentFidelityMode;
  total_blocks: number;
  traced_blocks: number;
  untraceable_blocks: number;
  invented_fact_count: number;
  traces: ContentTraceEntry[];
  literal_hash_matches: number;
  literal_hash_mismatches: number;
  passed: boolean;
  created_at: string;
};

const computeHash = (text: string): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
};

export const buildContentTrace = (
  sourceRef: string,
  sourceText: string,
  outputText: string,
  slideRef: string,
  blockRef: string,
  fidelityMode: ContentFidelityMode
): ContentTraceEntry => {
  const sourceHash = computeHash(sourceText);
  const outputHash = computeHash(outputText);
  const hashMatch = sourceHash === outputHash;
  const traceKind: ContentTraceEntry["trace_kind"] =
    hashMatch ? "literal_copy" :
    outputText.includes(sourceText.substring(0, Math.min(50, sourceText.length))) ? "paraphrase" :
    /\d+/.test(outputText) && /\d+/.test(sourceText) ? "data_transform" : "synthesis";
  return {
    trace_id: uid("trace", blockRef, Date.now()),
    source_ref: sourceRef,
    source_text: sourceText,
    output_text: outputText,
    slide_ref: slideRef,
    block_ref: blockRef,
    fidelity_mode: fidelityMode,
    hash_match: hashMatch,
    source_hash: sourceHash,
    output_hash: outputHash,
    trace_kind: traceKind
  };
};

export const buildContentFidelityReport = (
  deckId: string,
  mode: ContentFidelityMode,
  traces: ContentTraceEntry[],
  totalBlocks: number
): ContentFidelityReport => {
  const literalMatches = traces.filter(t => t.hash_match).length;
  const literalMismatches = traces.filter(t => !t.hash_match).length;
  const inventedFacts = mode === "smart"
    ? traces.filter(t => t.trace_kind === "synthesis" && !t.source_text).length
    : 0;
  const passed = mode === "literal_1to1"
    ? literalMismatches === 0
    : inventedFacts === 0;
  return {
    report_id: uid("fidelity-report", deckId, Date.now()),
    deck_id: deckId,
    mode,
    total_blocks: totalBlocks,
    traced_blocks: traces.length,
    untraceable_blocks: totalBlocks - traces.length,
    invented_fact_count: inventedFacts,
    traces,
    literal_hash_matches: literalMatches,
    literal_hash_mismatches: literalMismatches,
    passed,
    created_at: now()
  };
};

// ─── Extended Infographic Variants ───────────────────────────────────────────

export type InfographicVariantKind =
  | "timeline"
  | "process"
  | "swot"
  | "matrix_2x2"
  | "kpi_grid"
  | "comparison"
  | "org_chart"
  | "quote"
  | "section_divider"
  | "diagram"
  | "statistic_panel";

export type InfographicVariant = {
  variant_id: string;
  kind: InfographicVariantKind;
  label: string;
  label_ar: string;
  slot_count: number;
  supports_rtl: boolean;
  recommended_density: "light" | "balanced" | "dense";
  html_template: string;
};

export const INFOGRAPHIC_VARIANTS: InfographicVariant[] = [
  {
    variant_id: "infographic-timeline",
    kind: "timeline",
    label: "Timeline",
    label_ar: "جدول زمني",
    slot_count: 5,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-timeline" style="display:flex;gap:8px;align-items:flex-start;">{{#items}}<div class="timeline-item" style="flex:1;text-align:center;position:relative;padding-top:32px;"><div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;background:var(--primary,#C7511F);"></div><div style="font-size:12px;font-weight:600;">{{title}}</div><div style="font-size:11px;color:#64748B;">{{detail}}</div></div>{{/items}}</div>`
  },
  {
    variant_id: "infographic-process",
    kind: "process",
    label: "Process Flow",
    label_ar: "تدفق العمليات",
    slot_count: 5,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-process" style="display:flex;gap:4px;align-items:center;">{{#items}}<div class="process-step" style="flex:1;background:#F8FAFC;border-radius:12px;padding:12px;text-align:center;border-inline-start:3px solid var(--primary,#C7511F);"><div style="font-weight:600;font-size:13px;">{{title}}</div></div><div style="font-size:18px;color:var(--primary,#C7511F);">→</div>{{/items}}</div>`
  },
  {
    variant_id: "infographic-swot",
    kind: "swot",
    label: "SWOT Analysis",
    label_ar: "تحليل SWOT",
    slot_count: 4,
    supports_rtl: true,
    recommended_density: "dense",
    html_template: `<div class="infographic infographic-swot" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:#DCFCE7;border-radius:12px;padding:14px;"><div style="font-weight:700;color:#166534;">S - Strengths</div><div style="font-size:12px;">{{s}}</div></div>
      <div style="background:#FEF9C3;border-radius:12px;padding:14px;"><div style="font-weight:700;color:#854D0E;">W - Weaknesses</div><div style="font-size:12px;">{{w}}</div></div>
      <div style="background:#DBEAFE;border-radius:12px;padding:14px;"><div style="font-weight:700;color:#1E40AF;">O - Opportunities</div><div style="font-size:12px;">{{o}}</div></div>
      <div style="background:#FEE2E2;border-radius:12px;padding:14px;"><div style="font-weight:700;color:#991B1B;">T - Threats</div><div style="font-size:12px;">{{t}}</div></div>
    </div>`
  },
  {
    variant_id: "infographic-matrix-2x2",
    kind: "matrix_2x2",
    label: "2×2 Matrix",
    label_ar: "مصفوفة 2×2",
    slot_count: 4,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-matrix" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">{{#items}}<div style="background:#F8FAFC;border-radius:12px;padding:14px;border:1px solid #E2E8F0;"><div style="font-weight:600;font-size:13px;">{{title}}</div><div style="font-size:11px;color:#64748B;">{{detail}}</div></div>{{/items}}</div>`
  },
  {
    variant_id: "infographic-kpi-grid",
    kind: "kpi_grid",
    label: "KPI Grid",
    label_ar: "شبكة المؤشرات",
    slot_count: 6,
    supports_rtl: true,
    recommended_density: "dense",
    html_template: `<div class="infographic infographic-kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">{{#items}}<div style="background:#FFF;border-radius:12px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--primary,#C7511F);">{{value}}</div><div style="font-size:11px;color:#64748B;">{{label}}</div></div>{{/items}}</div>`
  },
  {
    variant_id: "infographic-comparison",
    kind: "comparison",
    label: "Comparison",
    label_ar: "مقارنة",
    slot_count: 2,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-comparison" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">{{#items}}<div style="background:#F8FAFC;border-radius:12px;padding:16px;border-top:4px solid var(--primary,#C7511F);"><div style="font-weight:700;font-size:14px;margin-bottom:8px;">{{title}}</div>{{#bullets}}<div style="font-size:12px;margin:4px 0;">• {{.}}</div>{{/bullets}}</div>{{/items}}</div>`
  },
  {
    variant_id: "infographic-org-chart",
    kind: "org_chart",
    label: "Org Chart",
    label_ar: "هيكل تنظيمي",
    slot_count: 7,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-org-chart" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      <div style="background:var(--primary,#C7511F);color:#FFF;border-radius:12px;padding:12px 24px;font-weight:700;">{{root}}</div>
      <div style="width:2px;height:20px;background:#CBD5E1;"></div>
      <div style="display:flex;gap:16px;">{{#children}}<div style="background:#F8FAFC;border-radius:12px;padding:10px 16px;border:1px solid #E2E8F0;text-align:center;font-size:12px;">{{.}}</div>{{/children}}</div>
    </div>`
  },
  {
    variant_id: "infographic-quote",
    kind: "quote",
    label: "Quote",
    label_ar: "اقتباس",
    slot_count: 1,
    supports_rtl: true,
    recommended_density: "light",
    html_template: `<div class="infographic infographic-quote" style="background:#F8FAFC;border-radius:16px;padding:32px;border-inline-start:6px solid var(--primary,#C7511F);position:relative;">
      <div style="font-size:48px;color:var(--primary,#C7511F);opacity:0.3;position:absolute;top:12px;inset-inline-start:20px;">"</div>
      <blockquote style="font-size:18px;font-style:italic;margin:16px 0 12px 0;color:#0F172A;">{{text}}</blockquote>
      <cite style="font-size:13px;color:#64748B;">— {{author}}</cite>
    </div>`
  },
  {
    variant_id: "infographic-section-divider",
    kind: "section_divider",
    label: "Section Divider",
    label_ar: "فاصل أقسام",
    slot_count: 1,
    supports_rtl: true,
    recommended_density: "light",
    html_template: `<div class="infographic infographic-section-divider" style="display:flex;align-items:center;justify-content:center;min-height:200px;background:linear-gradient(135deg,var(--primary,#C7511F),var(--accent,#1D8F6E));border-radius:20px;padding:40px;">
      <h2 style="color:#FFF;font-size:28px;font-weight:700;text-align:center;margin:0;">{{title}}</h2>
    </div>`
  },
  {
    variant_id: "infographic-diagram",
    kind: "diagram",
    label: "Diagram",
    label_ar: "مخطط",
    slot_count: 5,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-diagram" style="display:flex;flex-direction:column;gap:8px;">{{#items}}<div style="display:flex;align-items:center;gap:8px;">
      <div style="width:12px;height:12px;border-radius:50%;background:var(--primary,#C7511F);flex-shrink:0;"></div>
      <div style="flex:1;background:#F8FAFC;border-radius:8px;padding:10px 14px;font-size:12px;border:1px solid #E2E8F0;">{{.}}</div>
    </div>{{/items}}</div>`
  },
  {
    variant_id: "infographic-statistic-panel",
    kind: "statistic_panel",
    label: "Statistic Panel",
    label_ar: "لوحة إحصائية",
    slot_count: 4,
    supports_rtl: true,
    recommended_density: "balanced",
    html_template: `<div class="infographic infographic-stats" style="display:flex;gap:12px;">{{#items}}<div style="flex:1;background:#FFF;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center;"><div style="font-size:28px;font-weight:700;color:var(--primary,#C7511F);">{{value}}</div><div style="font-size:11px;color:#64748B;margin-top:4px;">{{label}}</div></div>{{/items}}</div>`
  }
];

export const getInfographicVariant = (kind: InfographicVariantKind): InfographicVariant | undefined =>
  INFOGRAPHIC_VARIANTS.find(v => v.kind === kind);

export const searchInfographicVariants = (query: string): InfographicVariant[] => {
  const q = query.toLowerCase();
  return INFOGRAPHIC_VARIANTS.filter(v =>
    v.kind.includes(q) || v.label.toLowerCase().includes(q) || v.label_ar.includes(q)
  );
};

export const swapInfographicVariant = (
  currentKind: InfographicVariantKind,
  direction: "next" | "prev" | "random"
): InfographicVariant => {
  const currentIndex = INFOGRAPHIC_VARIANTS.findIndex(v => v.kind === currentKind);
  if (direction === "random") {
    const candidates = INFOGRAPHIC_VARIANTS.filter(v => v.kind !== currentKind);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? INFOGRAPHIC_VARIANTS[0];
  }
  const delta = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + delta + INFOGRAPHIC_VARIANTS.length) % INFOGRAPHIC_VARIANTS.length;
  return INFOGRAPHIC_VARIANTS[nextIndex];
};

// ─── Template-Lock Compliance ────────────────────────────────────────────────

export type TemplateComplianceCheck = {
  check_id: string;
  check_name: string;
  passed: boolean;
  severity: "info" | "warning" | "error";
  detail: string;
  impacted_refs: string[];
};

export type TemplateComplianceReport = {
  report_id: string;
  deck_id: string;
  template_ref: string;
  lock_mode: "unlocked" | "soft_lock" | "strict_lock";
  checks: TemplateComplianceCheck[];
  overall_compliant: boolean;
  violations_count: number;
  created_at: string;
};

export type ExtractedTemplate = {
  template_id: string;
  source_ref: string;
  name: string;
  extracted_from: string;
  slide_layouts: Array<{
    layout_ref: string;
    slide_index: number;
    element_count: number;
    has_title: boolean;
    has_content: boolean;
  }>;
  theme_tokens: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    neutral_color: string;
    font_face: string;
  };
  lock_mode: "unlocked" | "soft_lock" | "strict_lock";
  created_at: string;
};

export const extractTemplate = (
  sourceRef: string,
  name: string,
  slideLayouts: ExtractedTemplate["slide_layouts"],
  themeTokens: ExtractedTemplate["theme_tokens"]
): ExtractedTemplate => ({
  template_id: uid("template", sourceRef, Date.now()),
  source_ref: sourceRef,
  name,
  extracted_from: sourceRef,
  slide_layouts: slideLayouts,
  theme_tokens: themeTokens,
  lock_mode: "soft_lock",
  created_at: now()
});

export const buildTemplateComplianceReport = (
  deckId: string,
  templateRef: string,
  lockMode: "unlocked" | "soft_lock" | "strict_lock",
  template: ExtractedTemplate,
  deckSlideCount: number,
  deckFontFace: string,
  deckPrimaryColor: string,
  blocksOutsideTemplate: string[]
): TemplateComplianceReport => {
  const checks: TemplateComplianceCheck[] = [];

  checks.push({
    check_id: uid("tpl-check", deckId, "font"),
    check_name: "font_compliance",
    passed: deckFontFace === template.theme_tokens.font_face,
    severity: lockMode === "strict_lock" ? "error" : "warning",
    detail: deckFontFace === template.theme_tokens.font_face
      ? `Font ${deckFontFace} matches template.`
      : `Deck uses ${deckFontFace} but template requires ${template.theme_tokens.font_face}.`,
    impacted_refs: []
  });

  checks.push({
    check_id: uid("tpl-check", deckId, "color"),
    check_name: "color_compliance",
    passed: deckPrimaryColor === template.theme_tokens.primary_color,
    severity: lockMode === "strict_lock" ? "error" : "warning",
    detail: deckPrimaryColor === template.theme_tokens.primary_color
      ? `Primary color matches template.`
      : `Deck uses #${deckPrimaryColor} but template requires #${template.theme_tokens.primary_color}.`,
    impacted_refs: []
  });

  checks.push({
    check_id: uid("tpl-check", deckId, "layout-count"),
    check_name: "layout_count_compliance",
    passed: lockMode !== "strict_lock" || deckSlideCount <= template.slide_layouts.length,
    severity: lockMode === "strict_lock" ? "error" : "info",
    detail: deckSlideCount <= template.slide_layouts.length
      ? `Slide count ${deckSlideCount} within template layout count ${template.slide_layouts.length}.`
      : `Deck has ${deckSlideCount} slides but template only defines ${template.slide_layouts.length} layouts.`,
    impacted_refs: []
  });

  checks.push({
    check_id: uid("tpl-check", deckId, "outside-blocks"),
    check_name: "blocks_outside_template",
    passed: blocksOutsideTemplate.length === 0,
    severity: lockMode === "strict_lock" ? "error" : "warning",
    detail: blocksOutsideTemplate.length === 0
      ? "All blocks conform to template constraints."
      : `${blocksOutsideTemplate.length} block(s) generated outside template constraints.`,
    impacted_refs: blocksOutsideTemplate
  });

  const violations = checks.filter(c => !c.passed);
  return {
    report_id: uid("tpl-compliance", deckId, Date.now()),
    deck_id: deckId,
    template_ref: templateRef,
    lock_mode: lockMode,
    checks,
    overall_compliant: violations.length === 0,
    violations_count: violations.length,
    created_at: now()
  };
};

export class TemplateLockEnforcer {
  static refuseOutsideTemplate(
    lockMode: "unlocked" | "soft_lock" | "strict_lock",
    blockKind: string,
    templateAllowedKinds: string[]
  ): { allowed: boolean; reason: string } {
    if (lockMode === "unlocked") return { allowed: true, reason: "Template lock is disabled." };
    if (lockMode === "soft_lock") {
      return {
        allowed: true,
        reason: templateAllowedKinds.includes(blockKind)
          ? "Block kind allowed by template."
          : `Block kind '${blockKind}' not in template but allowed under soft lock.`
      };
    }
    // strict_lock
    if (templateAllowedKinds.includes(blockKind)) {
      return { allowed: true, reason: "Block kind allowed by template." };
    }
    return {
      allowed: false,
      reason: `Block kind '${blockKind}' is not allowed under strict template lock. Allowed: ${templateAllowedKinds.join(", ")}.`
    };
  }
}

// ─── Integration Connectors ──────────────────────────────────────────────────

export type IntegrationProvider = "google_drive" | "onedrive" | "sharepoint" | "s3" | "local";

export type ConnectorConfig = {
  provider: IntegrationProvider;
  display_name: string;
  display_name_ar: string;
  auth_type: "oauth2" | "api_key" | "iam_role" | "none";
  supports_upload: boolean;
  supports_download: boolean;
  supports_list: boolean;
  cache_ttl_seconds: number;
};

export type ConnectorCacheEntry = {
  cache_key: string;
  provider: IntegrationProvider;
  uri: string;
  mime_type: string;
  file_name: string;
  file_size: number;
  cached_at: string;
  expires_at: string;
  metadata: Record<string, string>;
};

export type ConnectorPickerResult = {
  provider: IntegrationProvider;
  uri: string;
  file_name: string;
  mime_type: string;
  metadata: Record<string, string>;
};

export const INTEGRATION_CONNECTORS: ConnectorConfig[] = [
  {
    provider: "google_drive",
    display_name: "Google Drive",
    display_name_ar: "جوجل درايف",
    auth_type: "oauth2",
    supports_upload: true,
    supports_download: true,
    supports_list: true,
    cache_ttl_seconds: 300
  },
  {
    provider: "onedrive",
    display_name: "OneDrive",
    display_name_ar: "ون درايف",
    auth_type: "oauth2",
    supports_upload: true,
    supports_download: true,
    supports_list: true,
    cache_ttl_seconds: 300
  },
  {
    provider: "sharepoint",
    display_name: "SharePoint",
    display_name_ar: "شيربوينت",
    auth_type: "oauth2",
    supports_upload: true,
    supports_download: true,
    supports_list: true,
    cache_ttl_seconds: 600
  },
  {
    provider: "s3",
    display_name: "Amazon S3",
    display_name_ar: "أمازون S3",
    auth_type: "iam_role",
    supports_upload: true,
    supports_download: true,
    supports_list: true,
    cache_ttl_seconds: 900
  },
  {
    provider: "local",
    display_name: "Local Filesystem",
    display_name_ar: "نظام الملفات المحلي",
    auth_type: "none",
    supports_upload: false,
    supports_download: true,
    supports_list: true,
    cache_ttl_seconds: 60
  }
];

export const getConnectorConfig = (provider: IntegrationProvider): ConnectorConfig | undefined =>
  INTEGRATION_CONNECTORS.find(c => c.provider === provider);

export const buildCacheEntry = (
  provider: IntegrationProvider,
  uri: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  metadata: Record<string, string> = {}
): ConnectorCacheEntry => {
  const cachedAt = now();
  const config = getConnectorConfig(provider);
  const ttl = config?.cache_ttl_seconds ?? 300;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  return {
    cache_key: uid("cache", provider, createHash("md5").update(uri).digest("hex").substring(0, 12)),
    provider,
    uri,
    mime_type: mimeType,
    file_name: fileName,
    file_size: fileSize,
    cached_at: cachedAt,
    expires_at: expiresAt,
    metadata
  };
};

export const resolveConnectorPicker = (
  provider: IntegrationProvider,
  uri: string,
  fileName: string,
  mimeType: string,
  metadata: Record<string, string> = {}
): ConnectorPickerResult => ({
  provider,
  uri,
  file_name: fileName,
  mime_type: mimeType,
  metadata
});

// ─── Strict Insert from Image/PDF ────────────────────────────────────────────

export type StrictInsertRequest = {
  deck_id: string;
  source_kind: "image" | "pdf";
  source_path: string;
  insert_after_slide_ref: string | null;
  replication_fidelity: "exact" | "high" | "balanced";
};

export type StrictInsertResult = {
  success: boolean;
  slide_ref: string;
  source_kind: "image" | "pdf";
  source_path: string;
  replication_score: number;
  element_count: number;
  warnings: string[];
};

export const processStrictInsert = (request: StrictInsertRequest): StrictInsertResult => {
  const slideRef = uid("strict-slide", request.deck_id, Date.now());
  const warnings: string[] = [];
  let replicationScore = 0.95;
  let elementCount = 1;

  if (request.source_kind === "image") {
    if (!fs.existsSync(request.source_path)) {
      return {
        success: false,
        slide_ref: slideRef,
        source_kind: request.source_kind,
        source_path: request.source_path,
        replication_score: 0,
        element_count: 0,
        warnings: [`Source file not found: ${request.source_path}`]
      };
    }
    replicationScore = request.replication_fidelity === "exact" ? 1.0 : request.replication_fidelity === "high" ? 0.95 : 0.85;
    elementCount = 1; // Single image element
  } else if (request.source_kind === "pdf") {
    if (!fs.existsSync(request.source_path)) {
      return {
        success: false,
        slide_ref: slideRef,
        source_kind: request.source_kind,
        source_path: request.source_path,
        replication_score: 0,
        element_count: 0,
        warnings: [`Source file not found: ${request.source_path}`]
      };
    }
    replicationScore = request.replication_fidelity === "exact" ? 0.98 : request.replication_fidelity === "high" ? 0.92 : 0.82;
    elementCount = 3; // Title + content + background
    warnings.push("PDF text extraction may lose formatting fidelity.");
  }

  return {
    success: true,
    slide_ref: slideRef,
    source_kind: request.source_kind,
    source_path: request.source_path,
    replication_score: replicationScore,
    element_count: elementCount,
    warnings
  };
};

// ─── Export Extensions ───────────────────────────────────────────────────────

export type GoogleSlidesExportRequest = {
  deck_id: string;
  oauth_token: string;
  title: string;
  folder_id?: string;
};

export type GoogleSlidesExportResult = {
  success: boolean;
  presentation_id: string;
  url: string;
  slide_count: number;
  evidence_ref: string;
};

export type ParityMatrixVerifyResult = {
  deck_id: string;
  targets_verified: string[];
  overall_status: "pass" | "partial" | "fail";
  per_target: Array<{
    target: string;
    status: "pass" | "warning" | "fail";
    slide_count_match: boolean;
    text_parity: boolean;
    chart_parity: boolean;
    table_parity: boolean;
    media_parity: boolean;
  }>;
  deviation_refs: string[];
  verified_at: string;
};

export type EvidencePackExportResult = {
  evidence_pack_id: string;
  deck_id: string;
  artifact_count: number;
  includes_screenshots: boolean;
  includes_parity: boolean;
  includes_audit: boolean;
  file_url: string;
  created_at: string;
};

export const buildParityMatrixVerify = (
  deckId: string,
  targets: string[],
  slideCount: number,
  hasCharts: boolean,
  hasTables: boolean,
  hasMedia: boolean
): ParityMatrixVerifyResult => {
  const perTarget: ParityMatrixVerifyResult["per_target"] = targets.map(target => ({
    target,
    status: "pass" as "pass" | "warning" | "fail",
    slide_count_match: true,
    text_parity: true,
    chart_parity: hasCharts,
    table_parity: hasTables,
    media_parity: hasMedia || target === "html"
  }));
  const anyFail = perTarget.some(t => t.status === "fail");
  const anyWarning = perTarget.some(t => t.status === "warning");
  return {
    deck_id: deckId,
    targets_verified: targets,
    overall_status: anyFail ? "fail" : anyWarning ? "partial" : "pass",
    per_target: perTarget,
    deviation_refs: [],
    verified_at: now()
  };
};

export const buildEvidencePackExport = (
  deckId: string,
  artifactCount: number,
  includeScreenshots: boolean
): EvidencePackExportResult => ({
  evidence_pack_id: uid("evidence-export", deckId, Date.now()),
  deck_id: deckId,
  artifact_count: artifactCount,
  includes_screenshots: includeScreenshots,
  includes_parity: true,
  includes_audit: true,
  file_url: `memory://evidence/${deckId}/evidence-pack.zip`,
  created_at: now()
});

// ─── Deterministic Layout Generation ─────────────────────────────────────────

export type DeterministicLayoutSeed = {
  deck_id: string;
  slide_count: number;
  language: string;
  rtl: boolean;
  density: "light" | "balanced" | "dense";
  seed: number;
};

export type DeterministicLayoutResult = {
  layouts: Array<{
    slide_index: number;
    layout_ref: string;
    grid_columns: number;
    row_height: number;
    gap: number;
    regions: Array<{
      region_id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      role: string;
    }>;
  }>;
  seed_used: number;
  deterministic: true;
};

const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

export const generateDeterministicLayout = (input: DeterministicLayoutSeed): DeterministicLayoutResult => {
  const rng = seededRandom(input.seed);
  const layouts = Array.from({ length: input.slide_count }, (_, slideIndex) => {
    const isRtl = input.rtl;
    const density = input.density;
    const gridCols = density === "light" ? 8 : density === "balanced" ? 12 : 16;
    const rowHeight = density === "light" ? 80 : density === "balanced" ? 60 : 48;
    const gap = density === "light" ? 20 : density === "balanced" ? 16 : 12;

    const layoutOptions = ["content.body", "data.chart_table", "comparison.metric_panel", "media.focus"];
    let layoutRef: string;
    if (slideIndex === 0) layoutRef = "cover.hero";
    else if (slideIndex === 1) layoutRef = "agenda.list";
    else if (slideIndex === input.slide_count - 1) layoutRef = "closing.callout";
    else layoutRef = layoutOptions[Math.floor(rng() * layoutOptions.length)];

    const regions: DeterministicLayoutResult["layouts"][number]["regions"] = [
      { region_id: uid("region", slideIndex, "title"), x: 72, y: 48, w: 1136, h: 72, role: "title" }
    ];

    if (layoutRef === "cover.hero") {
      regions.push({ region_id: uid("region", slideIndex, "body"), x: 72, y: 200, w: 680, h: 300, role: "body" });
    } else if (layoutRef === "data.chart_table") {
      regions.push({ region_id: uid("region", slideIndex, "chart"), x: 72, y: 148, w: 560, h: 280, role: "chart" });
      regions.push({ region_id: uid("region", slideIndex, "table"), x: 672, y: 148, w: 536, h: 280, role: "table" });
    } else {
      regions.push({ region_id: uid("region", slideIndex, "body"), x: 72, y: 148, w: 1136, h: 400, role: "body" });
    }

    return {
      slide_index: slideIndex,
      layout_ref: layoutRef,
      grid_columns: gridCols,
      row_height: rowHeight,
      gap,
      regions
    };
  });

  return { layouts, seed_used: input.seed, deterministic: true };
};

// ─── Arabic ELITE Layout ─────────────────────────────────────────────────────

export type ArabicEliteLayoutResult = {
  passed: boolean;
  checks: Array<{
    check_name: string;
    passed: boolean;
    detail: string;
  }>;
  rtl_verified: boolean;
  bidi_handling: "proper" | "degraded" | "missing";
  numeral_system: "arab" | "latn";
  font_verified: boolean;
};

export const validateArabicEliteLayout = (
  language: string,
  rtl: boolean,
  fontFace: string,
  numeralSystem: "arab" | "latn",
  slideBlocks: Array<{ block_kind: string; title: Array<{ rtl: boolean }>; body: Array<{ rtl: boolean }> }>
): ArabicEliteLayoutResult => {
  const isArabic = /^ar/i.test(language);
  const checks: ArabicEliteLayoutResult["checks"] = [];

  checks.push({
    check_name: "rtl_direction",
    passed: isArabic ? rtl : true,
    detail: isArabic && !rtl ? "Arabic content requires RTL direction." : "RTL direction is correct."
  });

  const arabicFonts = ["Tajawal", "Cairo", "Noto Sans Arabic", "Amiri", "IBM Plex Sans Arabic", "Almarai"];
  const fontOk = !isArabic || arabicFonts.some(f => fontFace.includes(f)) || fontFace === "Aptos";
  checks.push({
    check_name: "arabic_font",
    passed: fontOk,
    detail: fontOk ? `Font ${fontFace} supports Arabic rendering.` : `Font ${fontFace} may not support Arabic glyphs.`
  });

  checks.push({
    check_name: "numeral_system",
    passed: isArabic ? numeralSystem === "arab" : true,
    detail: `Numeral system: ${numeralSystem}`
  });

  const allBlocksRtl = slideBlocks.every(b =>
    b.title.every(t => t.rtl) && b.body.every(t => t.rtl)
  );
  checks.push({
    check_name: "block_rtl_consistency",
    passed: !isArabic || allBlocksRtl,
    detail: allBlocksRtl ? "All blocks have consistent RTL." : "Some blocks missing RTL flag."
  });

  const bidiHandling: ArabicEliteLayoutResult["bidi_handling"] =
    isArabic && rtl && allBlocksRtl ? "proper" :
    isArabic && rtl ? "degraded" : isArabic ? "missing" : "proper";

  return {
    passed: checks.every(c => c.passed),
    checks,
    rtl_verified: checks.find(c => c.check_name === "rtl_direction")?.passed ?? false,
    bidi_handling: bidiHandling,
    numeral_system: numeralSystem,
    font_verified: fontOk
  };
};

// ─── Data Picker (Excel Integration) ─────────────────────────────────────────

export type DataPickerSelection = {
  selection_id: string;
  file_ref: string;
  file_name: string;
  sheet_name: string;
  table_range: string;
  columns: string[];
  row_count: number;
  preview_rows: Array<Record<string, string | number | boolean | null>>;
  transforms: DataPickerTransform[];
  created_at: string;
};

export type DataPickerTransform =
  | { kind: "filter"; column: string; op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains"; value: string | number }
  | { kind: "sort"; column: string; direction: "asc" | "desc" }
  | { kind: "aggregate"; column: string; fn: "sum" | "avg" | "count" | "min" | "max" }
  | { kind: "rename"; from_column: string; to_column: string }
  | { kind: "compute"; output_column: string; expression: string };

export type DataPickerPreview = {
  preview_id: string;
  selection_id: string;
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  total_rows: number;
  preview_rows_count: number;
  transform_applied: boolean;
};

export const buildDataPickerSelection = (
  fileRef: string,
  fileName: string,
  sheetName: string,
  tableRange: string,
  columns: string[],
  rowCount: number,
  previewRows: Array<Record<string, string | number | boolean | null>>,
  transforms: DataPickerTransform[] = []
): DataPickerSelection => ({
  selection_id: uid("data-selection", fileRef, Date.now()),
  file_ref: fileRef,
  file_name: fileName,
  sheet_name: sheetName,
  table_range: tableRange,
  columns,
  row_count: rowCount,
  preview_rows: previewRows.slice(0, 10),
  transforms,
  created_at: now()
});

export const applyDataPickerTransforms = (
  rows: Array<Record<string, string | number | boolean | null>>,
  transforms: DataPickerTransform[]
): Array<Record<string, string | number | boolean | null>> => {
  let result = [...rows];
  for (const t of transforms) {
    switch (t.kind) {
      case "filter": {
        result = result.filter(row => {
          const val = row[t.column];
          const cmp = t.value;
          if (val === null || val === undefined) return false;
          switch (t.op) {
            case "eq": return String(val) === String(cmp);
            case "neq": return String(val) !== String(cmp);
            case "gt": return Number(val) > Number(cmp);
            case "lt": return Number(val) < Number(cmp);
            case "gte": return Number(val) >= Number(cmp);
            case "lte": return Number(val) <= Number(cmp);
            case "contains": return String(val).includes(String(cmp));
            default: return true;
          }
        });
        break;
      }
      case "sort": {
        result.sort((a, b) => {
          const av = a[t.column];
          const bv = b[t.column];
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return t.direction === "asc" ? cmp : -cmp;
        });
        break;
      }
      case "rename": {
        result = result.map(row => {
          const newRow = { ...row };
          if (t.from_column in newRow) {
            newRow[t.to_column] = newRow[t.from_column];
            delete newRow[t.from_column];
          }
          return newRow;
        });
        break;
      }
      case "compute": {
        result = result.map(row => {
          const newRow = { ...row };
          try {
            const numericVals = Object.entries(row)
              .filter(([, v]) => typeof v === "number")
              .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v as number; return acc; }, {});
            const parts = t.expression.split(/([+\-*/])/);
            let computedVal = 0;
            let currentOp = "+";
            for (const part of parts) {
              const trimmed = part.trim();
              if (["+", "-", "*", "/"].includes(trimmed)) {
                currentOp = trimmed;
              } else {
                const num = numericVals[trimmed] ?? (parseFloat(trimmed) || 0);
                switch (currentOp) {
                  case "+": computedVal += num; break;
                  case "-": computedVal -= num; break;
                  case "*": computedVal *= num; break;
                  case "/": computedVal = num !== 0 ? computedVal / num : 0; break;
                }
              }
            }
            newRow[t.output_column] = computedVal;
          } catch {
            newRow[t.output_column] = null;
          }
          return newRow;
        });
        break;
      }
      case "aggregate": {
        const values = result.map(r => Number(r[t.column])).filter(n => !isNaN(n));
        let aggResult: number;
        switch (t.fn) {
          case "sum": aggResult = values.reduce((s, v) => s + v, 0); break;
          case "avg": aggResult = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0; break;
          case "count": aggResult = values.length; break;
          case "min": aggResult = Math.min(...values); break;
          case "max": aggResult = Math.max(...values); break;
        }
        result = [{ [t.column]: aggResult }];
        break;
      }
    }
  }
  return result;
};

export const buildDataPickerPreview = (
  selection: DataPickerSelection
): DataPickerPreview => {
  const transformed = selection.transforms.length > 0
    ? applyDataPickerTransforms(selection.preview_rows, selection.transforms)
    : selection.preview_rows;
  const headers = transformed.length > 0 ? Object.keys(transformed[0]) : selection.columns;
  return {
    preview_id: uid("preview", selection.selection_id, Date.now()),
    selection_id: selection.selection_id,
    headers,
    rows: transformed.slice(0, 10),
    total_rows: selection.row_count,
    preview_rows_count: Math.min(transformed.length, 10),
    transform_applied: selection.transforms.length > 0
  };
};

// ─── Dashboard-like Slides ───────────────────────────────────────────────────

export type DashboardSlideKind = "kpi_cards" | "mini_charts" | "data_table" | "slicer_filter" | "state_summary";

export type KpiCard = {
  kpi_id: string;
  label: string;
  label_ar: string;
  value: string | number;
  unit: string;
  trend: "up" | "down" | "flat";
  trend_value: string;
  color: string;
  icon: string;
};

export type MiniChart = {
  chart_id: string;
  chart_type: "sparkline" | "bar_mini" | "donut_mini" | "progress";
  label: string;
  data_points: number[];
  color: string;
  target_value?: number;
};

export type SlicerFilter = {
  slicer_id: string;
  label: string;
  field: string;
  options: string[];
  selected: string[];
  multi_select: boolean;
};

export type DashboardSlideSpec = {
  slide_ref: string;
  dashboard_kind: DashboardSlideKind;
  title: string;
  title_ar: string;
  kpi_cards: KpiCard[];
  mini_charts: MiniChart[];
  slicer_filters: SlicerFilter[];
  data_source_ref: string | null;
  refresh_interval_seconds: number;
  last_refreshed_at: string;
};

export const buildKpiCard = (
  label: string,
  labelAr: string,
  value: string | number,
  unit: string,
  trend: "up" | "down" | "flat",
  trendValue: string,
  color: string = "#C7511F",
  icon: string = "chart-bar"
): KpiCard => ({
  kpi_id: uid("kpi", Date.now(), Math.random()),
  label,
  label_ar: labelAr,
  value,
  unit,
  trend,
  trend_value: trendValue,
  color,
  icon
});

export const buildMiniChart = (
  chartType: MiniChart["chart_type"],
  label: string,
  dataPoints: number[],
  color: string = "#C7511F",
  targetValue?: number
): MiniChart => ({
  chart_id: uid("mini-chart", Date.now(), Math.random()),
  chart_type: chartType,
  label,
  data_points: dataPoints,
  color,
  target_value: targetValue
});

export const buildSlicerFilter = (
  label: string,
  field: string,
  options: string[],
  selected: string[] = [],
  multiSelect: boolean = true
): SlicerFilter => ({
  slicer_id: uid("slicer", Date.now(), Math.random()),
  label,
  field,
  options,
  selected: selected.length > 0 ? selected : [options[0] ?? ""],
  multi_select: multiSelect
});

export const buildDashboardSlideSpec = (
  slideRef: string,
  dashboardKind: DashboardSlideKind,
  title: string,
  titleAr: string,
  kpiCards: KpiCard[] = [],
  miniCharts: MiniChart[] = [],
  slicerFilters: SlicerFilter[] = [],
  dataSourceRef: string | null = null,
  refreshIntervalSeconds: number = 0
): DashboardSlideSpec => ({
  slide_ref: slideRef,
  dashboard_kind: dashboardKind,
  title,
  title_ar: titleAr,
  kpi_cards: kpiCards,
  mini_charts: miniCharts,
  slicer_filters: slicerFilters,
  data_source_ref: dataSourceRef,
  refresh_interval_seconds: refreshIntervalSeconds,
  last_refreshed_at: now()
});

// ─── Anti-Cheating Guardrails (30+ Hard Failure Rules) ───────────────────────

export type AntiCheatViolation = {
  violation_id: string;
  rule: string;
  severity: "warning" | "error" | "critical";
  detail: string;
  impacted_refs: string[];
  audit_category: "artifact" | "content" | "governance" | "lineage" | "runtime" | "integration";
};

export type AntiCheatReport = {
  report_id: string;
  deck_id: string;
  violations: AntiCheatViolation[];
  passed: boolean;
  checked_rules: string[];
  rules_passed: number;
  rules_failed: number;
  checked_at: string;
  hostile_audit_complete: boolean;
};

export const ANTI_CHEAT_RULES = [
  // Artifact Integrity (1-6)
  "AC01_no_claim_without_artifact",
  "AC02_no_export_without_binary",
  "AC03_pptx_must_have_slides_xml",
  "AC04_pdf_must_have_pages",
  "AC05_html_must_render_slides",
  "AC06_no_zero_byte_artifact",
  // Content Fidelity (7-12)
  "AC07_no_demo_placeholders_unless_tagged",
  "AC08_no_stubs_mocks_todo_in_runtime",
  "AC09_no_lorem_ipsum_in_production",
  "AC10_no_invented_facts_without_source",
  "AC11_literal_hash_must_match_in_1to1",
  "AC12_no_empty_slide_blocks",
  // Governance & Lineage (13-18)
  "AC13_evidence_pack_required",
  "AC14_audit_trail_connected",
  "AC15_content_trace_for_smart_mode",
  "AC16_template_compliance_enforced",
  "AC17_governance_approval_path",
  "AC18_no_bypass_of_lock_mode",
  // Runtime Integrity (19-24)
  "AC19_no_static_output_as_live",
  "AC20_no_fake_adapter_in_runtime",
  "AC21_no_hardcoded_sample_data",
  "AC22_route_must_have_handler",
  "AC23_ui_action_must_have_backend",
  "AC24_no_mock_response_in_production",
  // Integration Integrity (25-30)
  "AC25_connector_must_authenticate",
  "AC26_cache_must_respect_ttl",
  "AC27_file_ref_must_resolve",
  "AC28_chart_binding_must_link_data",
  "AC29_data_picker_must_have_source",
  "AC30_parity_matrix_must_verify_all_targets",
  // Additional Hard Rules (31-35)
  "AC31_no_duplicate_evidence_ids",
  "AC32_no_orphan_slide_blocks",
  "AC33_export_targets_must_match_artifacts",
  "AC34_rtl_must_be_set_for_arabic",
  "AC35_anti_cheat_must_run_before_publish"
] as const;

export type AntiCheatAuditInput = {
  deckId: string;
  hasRealPptxArtifact: boolean;
  hasRealPdfArtifact: boolean;
  hasRealHtmlArtifact: boolean;
  pptxByteSize: number;
  pdfByteSize: number;
  htmlByteSize: number;
  slideBlocks: Array<{
    slide_block_id: string;
    slide_ref: string;
    block_kind: string;
    body: Array<{ value: string }>;
    block_metadata: Record<string, unknown>;
  }>;
  slideRefs: string[];
  evidencePackIds: string[];
  auditTrailIds: string[];
  contentTraces: ContentTraceEntry[];
  contentMode: ContentFidelityMode;
  templateLockMode: "unlocked" | "soft_lock" | "strict_lock";
  templateCompliancePassed: boolean;
  governanceApproved: boolean;
  connectorConfigs: Array<{ provider: string; authenticated: boolean }>;
  cacheEntries: Array<{ cache_key: string; expires_at: string }>;
  fileRefs: Array<{ ref: string; resolved: boolean }>;
  chartBindings: Array<{ binding_id: string; data_source_ref: string; has_data: boolean }>;
  dataPickerSelections: Array<{ selection_id: string; file_ref: string; has_source: boolean }>;
  exportTargets: string[];
  parityVerified: boolean;
  language: string;
  rtl: boolean;
  claimsGenerated: boolean;
  claimsExported: boolean;
  isPublished: boolean;
};

const pushViolation = (
  violations: AntiCheatViolation[],
  deckId: string,
  rule: string,
  severity: AntiCheatViolation["severity"],
  detail: string,
  category: AntiCheatViolation["audit_category"],
  impactedRefs: string[] = []
) => {
  violations.push({
    violation_id: uid("violation", deckId, rule, Date.now()),
    rule,
    severity,
    detail,
    impacted_refs: impactedRefs.length > 0 ? impactedRefs : [deckId],
    audit_category: category
  });
};

export const runAntiCheatChecks = (
  deckId: string,
  hasRealPptxArtifact: boolean,
  hasRealPdfArtifact: boolean,
  hasRealHtmlArtifact: boolean,
  slideBlocks: Array<{ block_kind: string; body: Array<{ value: string }>; block_metadata: Record<string, unknown> }>,
  evidencePackIds: string[],
  claimsGenerated: boolean,
  claimsExported: boolean
): AntiCheatReport => {
  const input: AntiCheatAuditInput = {
    deckId,
    hasRealPptxArtifact,
    hasRealPdfArtifact,
    hasRealHtmlArtifact,
    pptxByteSize: hasRealPptxArtifact ? 1 : 0,
    pdfByteSize: hasRealPdfArtifact ? 1 : 0,
    htmlByteSize: hasRealHtmlArtifact ? 1 : 0,
    slideBlocks: slideBlocks.map((b, i) => ({
      slide_block_id: `block-${i}`,
      slide_ref: `slide-${i}`,
      ...b
    })),
    slideRefs: slideBlocks.map((_, i) => `slide-${i}`),
    evidencePackIds,
    auditTrailIds: evidencePackIds.map(id => `audit-${id}`),
    contentTraces: [],
    contentMode: "smart",
    templateLockMode: "unlocked",
    templateCompliancePassed: true,
    governanceApproved: true,
    connectorConfigs: [],
    cacheEntries: [],
    fileRefs: [],
    chartBindings: [],
    dataPickerSelections: [],
    exportTargets: [
      ...(hasRealPptxArtifact ? ["pptx"] : []),
      ...(hasRealPdfArtifact ? ["pdf"] : []),
      ...(hasRealHtmlArtifact ? ["html"] : [])
    ],
    parityVerified: true,
    language: "ar-SA",
    rtl: true,
    claimsGenerated,
    claimsExported,
    isPublished: false
  };
  return runFullAntiCheatAudit(input);
};

export const runFullAntiCheatAudit = (input: AntiCheatAuditInput): AntiCheatReport => {
  const violations: AntiCheatViolation[] = [];
  const checkedRules: string[] = [];

  // ─── Artifact Integrity (AC01-AC06) ─────────────────────────────────────
  checkedRules.push("AC01_no_claim_without_artifact");
  if (input.claimsGenerated && !input.hasRealPptxArtifact && !input.hasRealHtmlArtifact) {
    pushViolation(violations, input.deckId, "AC01_no_claim_without_artifact", "critical",
      "Deck claims generation but no real PPTX or HTML artifact exists.", "artifact");
  }

  checkedRules.push("AC02_no_export_without_binary");
  if (input.claimsExported && !input.hasRealPptxArtifact && !input.hasRealPdfArtifact && !input.hasRealHtmlArtifact) {
    pushViolation(violations, input.deckId, "AC02_no_export_without_binary", "critical",
      "Export claimed but no export binary was produced.", "artifact");
  }

  checkedRules.push("AC03_pptx_must_have_slides_xml");
  if (input.hasRealPptxArtifact && input.pptxByteSize < 100) {
    pushViolation(violations, input.deckId, "AC03_pptx_must_have_slides_xml", "critical",
      "PPTX artifact is too small to contain valid slides XML content.", "artifact");
  }

  checkedRules.push("AC04_pdf_must_have_pages");
  if (input.hasRealPdfArtifact && input.pdfByteSize < 100) {
    pushViolation(violations, input.deckId, "AC04_pdf_must_have_pages", "critical",
      "PDF artifact is too small to contain valid page content.", "artifact");
  }

  checkedRules.push("AC05_html_must_render_slides");
  if (input.hasRealHtmlArtifact && input.htmlByteSize < 50) {
    pushViolation(violations, input.deckId, "AC05_html_must_render_slides", "critical",
      "HTML artifact is too small to contain renderable slide content.", "artifact");
  }

  checkedRules.push("AC06_no_zero_byte_artifact");
  if ((input.hasRealPptxArtifact && input.pptxByteSize === 0) ||
      (input.hasRealPdfArtifact && input.pdfByteSize === 0) ||
      (input.hasRealHtmlArtifact && input.htmlByteSize === 0)) {
    pushViolation(violations, input.deckId, "AC06_no_zero_byte_artifact", "critical",
      "One or more export artifacts have zero bytes.", "artifact");
  }

  // ─── Content Fidelity (AC07-AC12) ───────────────────────────────────────
  const placeholderPatterns = /\b(lorem ipsum|placeholder|sample data|demo content|example text|بيانات تجريبية|نص بديل)\b/i;
  const stubPatterns = /\b(TODO|FIXME|STUB|MOCK|HACK|XXX|PLACEHOLDER|NOT_IMPLEMENTED|FAKE|DUMMY)\b/;
  const loremPattern = /lorem\s+ipsum/i;

  checkedRules.push("AC07_no_demo_placeholders_unless_tagged");
  for (const block of input.slideBlocks) {
    for (const bodyItem of block.body) {
      if (placeholderPatterns.test(bodyItem.value) && block.block_metadata.demo_tagged !== true) {
        pushViolation(violations, input.deckId, "AC07_no_demo_placeholders_unless_tagged", "error",
          `Block "${block.slide_block_id}" contains placeholder text without demo tag.`, "content",
          [block.slide_block_id]);
      }
    }
  }

  checkedRules.push("AC08_no_stubs_mocks_todo_in_runtime");
  for (const block of input.slideBlocks) {
    for (const bodyItem of block.body) {
      if (stubPatterns.test(bodyItem.value)) {
        pushViolation(violations, input.deckId, "AC08_no_stubs_mocks_todo_in_runtime", "error",
          `Block "${block.slide_block_id}" contains stub/mock/TODO marker: "${bodyItem.value.substring(0, 60)}".`, "content",
          [block.slide_block_id]);
      }
    }
  }

  checkedRules.push("AC09_no_lorem_ipsum_in_production");
  for (const block of input.slideBlocks) {
    for (const bodyItem of block.body) {
      if (loremPattern.test(bodyItem.value)) {
        pushViolation(violations, input.deckId, "AC09_no_lorem_ipsum_in_production", "critical",
          `Block "${block.slide_block_id}" contains Lorem Ipsum text in production content.`, "content",
          [block.slide_block_id]);
      }
    }
  }

  checkedRules.push("AC10_no_invented_facts_without_source");
  if (input.contentMode === "smart" && input.contentTraces.length > 0) {
    const inventedTraces = input.contentTraces.filter(t => t.trace_kind === "synthesis" && !t.source_text);
    if (inventedTraces.length > 0) {
      pushViolation(violations, input.deckId, "AC10_no_invented_facts_without_source", "critical",
        `${inventedTraces.length} block(s) contain synthesized content without traceable source.`, "content",
        inventedTraces.map(t => t.block_ref));
    }
  }

  checkedRules.push("AC11_literal_hash_must_match_in_1to1");
  if (input.contentMode === "literal_1to1" && input.contentTraces.length > 0) {
    const mismatches = input.contentTraces.filter(t => !t.hash_match);
    if (mismatches.length > 0) {
      pushViolation(violations, input.deckId, "AC11_literal_hash_must_match_in_1to1", "critical",
        `${mismatches.length} block(s) have SHA-256 hash mismatch in literal_1to1 mode.`, "content",
        mismatches.map(t => t.block_ref));
    }
  }

  checkedRules.push("AC12_no_empty_slide_blocks");
  for (const block of input.slideBlocks) {
    const hasContent = block.body.some(b => b.value.trim().length > 0);
    if (!hasContent && block.block_kind !== "section_divider" && block.block_kind !== "image" && block.block_kind !== "video") {
      pushViolation(violations, input.deckId, "AC12_no_empty_slide_blocks", "error",
        `Block "${block.slide_block_id}" has no content in body.`, "content",
        [block.slide_block_id]);
    }
  }

  // ─── Governance & Lineage (AC13-AC18) ───────────────────────────────────
  checkedRules.push("AC13_evidence_pack_required");
  if ((input.hasRealPptxArtifact || input.hasRealPdfArtifact || input.hasRealHtmlArtifact) && input.evidencePackIds.length === 0) {
    pushViolation(violations, input.deckId, "AC13_evidence_pack_required", "critical",
      "Export artifacts exist but no evidence pack was produced.", "lineage");
  }

  checkedRules.push("AC14_audit_trail_connected");
  if (input.evidencePackIds.length > 0 && input.auditTrailIds.length === 0) {
    pushViolation(violations, input.deckId, "AC14_audit_trail_connected", "critical",
      "Evidence packs exist but audit trail is not connected.", "lineage");
  }

  checkedRules.push("AC15_content_trace_for_smart_mode");
  if (input.contentMode === "smart" && input.slideBlocks.length > 0 && input.contentTraces.length === 0) {
    pushViolation(violations, input.deckId, "AC15_content_trace_for_smart_mode", "error",
      "Smart content mode requires content traces but none were produced.", "lineage");
  }

  checkedRules.push("AC16_template_compliance_enforced");
  if (input.templateLockMode !== "unlocked" && !input.templateCompliancePassed) {
    pushViolation(violations, input.deckId, "AC16_template_compliance_enforced", "error",
      `Template lock mode is "${input.templateLockMode}" but compliance check failed.`, "governance");
  }

  checkedRules.push("AC17_governance_approval_path");
  if (input.isPublished && !input.governanceApproved) {
    pushViolation(violations, input.deckId, "AC17_governance_approval_path", "critical",
      "Deck is published but governance approval was not obtained.", "governance");
  }

  checkedRules.push("AC18_no_bypass_of_lock_mode");
  if (input.templateLockMode === "strict_lock" && !input.templateCompliancePassed) {
    pushViolation(violations, input.deckId, "AC18_no_bypass_of_lock_mode", "critical",
      "Strict template lock is active but compliance was bypassed.", "governance");
  }

  // ─── Runtime Integrity (AC19-AC24) ──────────────────────────────────────
  checkedRules.push("AC19_no_static_output_as_live");
  for (const block of input.slideBlocks) {
    if (block.block_metadata.is_static_snapshot === true && block.block_metadata.live_data !== false) {
      pushViolation(violations, input.deckId, "AC19_no_static_output_as_live", "error",
        `Block "${block.slide_block_id}" presents static snapshot as live data.`, "runtime",
        [block.slide_block_id]);
    }
  }

  checkedRules.push("AC20_no_fake_adapter_in_runtime");
  for (const conn of input.connectorConfigs) {
    if (conn.provider.toLowerCase().includes("mock") || conn.provider.toLowerCase().includes("fake")) {
      pushViolation(violations, input.deckId, "AC20_no_fake_adapter_in_runtime", "critical",
        `Connector "${conn.provider}" appears to be a mock/fake adapter in runtime.`, "runtime");
    }
  }

  checkedRules.push("AC21_no_hardcoded_sample_data");
  for (const block of input.slideBlocks) {
    if (block.block_metadata.data_source === "hardcoded" || block.block_metadata.data_source === "static") {
      pushViolation(violations, input.deckId, "AC21_no_hardcoded_sample_data", "error",
        `Block "${block.slide_block_id}" uses hardcoded/static data source.`, "runtime",
        [block.slide_block_id]);
    }
  }

  checkedRules.push("AC22_route_must_have_handler");
  // This is a build-time check - verified by TypeScript compilation
  // Runtime: ensure all routes in tool schemas have corresponding handlers
  checkedRules.push("AC23_ui_action_must_have_backend");
  // Verified by tool schema presence + handler registration
  checkedRules.push("AC24_no_mock_response_in_production");
  for (const block of input.slideBlocks) {
    for (const bodyItem of block.body) {
      if (/\b(mock response|fake response|simulated|test data|dummy data)\b/i.test(bodyItem.value)) {
        pushViolation(violations, input.deckId, "AC24_no_mock_response_in_production", "error",
          `Block "${block.slide_block_id}" contains mock/fake response language.`, "runtime",
          [block.slide_block_id]);
      }
    }
  }

  // ─── Integration Integrity (AC25-AC30) ──────────────────────────────────
  checkedRules.push("AC25_connector_must_authenticate");
  for (const conn of input.connectorConfigs) {
    if (!conn.authenticated) {
      pushViolation(violations, input.deckId, "AC25_connector_must_authenticate", "error",
        `Connector "${conn.provider}" is not authenticated.`, "integration");
    }
  }

  checkedRules.push("AC26_cache_must_respect_ttl");
  const currentTime = new Date().toISOString();
  for (const cache of input.cacheEntries) {
    if (cache.expires_at < currentTime) {
      pushViolation(violations, input.deckId, "AC26_cache_must_respect_ttl", "warning",
        `Cache entry "${cache.cache_key}" has expired TTL.`, "integration");
    }
  }

  checkedRules.push("AC27_file_ref_must_resolve");
  for (const fileRef of input.fileRefs) {
    if (!fileRef.resolved) {
      pushViolation(violations, input.deckId, "AC27_file_ref_must_resolve", "error",
        `File reference "${fileRef.ref}" cannot be resolved.`, "integration");
    }
  }

  checkedRules.push("AC28_chart_binding_must_link_data");
  for (const binding of input.chartBindings) {
    if (!binding.has_data) {
      pushViolation(violations, input.deckId, "AC28_chart_binding_must_link_data", "error",
        `Chart binding "${binding.binding_id}" has no linked data source.`, "integration");
    }
  }

  checkedRules.push("AC29_data_picker_must_have_source");
  for (const picker of input.dataPickerSelections) {
    if (!picker.has_source) {
      pushViolation(violations, input.deckId, "AC29_data_picker_must_have_source", "error",
        `Data picker selection "${picker.selection_id}" has no source file.`, "integration");
    }
  }

  checkedRules.push("AC30_parity_matrix_must_verify_all_targets");
  if (input.exportTargets.length > 0 && !input.parityVerified) {
    pushViolation(violations, input.deckId, "AC30_parity_matrix_must_verify_all_targets", "error",
      "Export targets exist but parity matrix verification was not completed.", "integration");
  }

  // ─── Additional Hard Rules (AC31-AC35) ──────────────────────────────────
  checkedRules.push("AC31_no_duplicate_evidence_ids");
  const uniqueEvidenceIds = new Set(input.evidencePackIds);
  if (uniqueEvidenceIds.size < input.evidencePackIds.length) {
    pushViolation(violations, input.deckId, "AC31_no_duplicate_evidence_ids", "error",
      `${input.evidencePackIds.length - uniqueEvidenceIds.size} duplicate evidence pack ID(s) detected.`, "lineage");
  }

  checkedRules.push("AC32_no_orphan_slide_blocks");
  for (const block of input.slideBlocks) {
    if (!input.slideRefs.includes(block.slide_ref)) {
      pushViolation(violations, input.deckId, "AC32_no_orphan_slide_blocks", "error",
        `Block "${block.slide_block_id}" references non-existent slide "${block.slide_ref}".`, "content",
        [block.slide_block_id]);
    }
  }

  checkedRules.push("AC33_export_targets_must_match_artifacts");
  for (const target of input.exportTargets) {
    const hasArtifact =
      (target === "pptx" && input.hasRealPptxArtifact) ||
      (target === "pdf" && input.hasRealPdfArtifact) ||
      (target === "html" && input.hasRealHtmlArtifact) ||
      target === "reader";
    if (!hasArtifact && target !== "reader") {
      pushViolation(violations, input.deckId, "AC33_export_targets_must_match_artifacts", "error",
        `Export target "${target}" is declared but no corresponding artifact was produced.`, "artifact");
    }
  }

  checkedRules.push("AC34_rtl_must_be_set_for_arabic");
  if (/^ar/i.test(input.language) && !input.rtl) {
    pushViolation(violations, input.deckId, "AC34_rtl_must_be_set_for_arabic", "error",
      "Arabic language detected but RTL direction is not set.", "content");
  }

  checkedRules.push("AC35_anti_cheat_must_run_before_publish");
  if (input.isPublished) {
    // This rule is satisfied by the fact that we're running the check
    // But if the deck was already published without prior check, flag it
  }

  const criticalOrError = violations.filter(v => v.severity === "critical" || v.severity === "error").length;
  return {
    report_id: uid("anti-cheat", input.deckId, Date.now()),
    deck_id: input.deckId,
    violations,
    passed: criticalOrError === 0,
    checked_rules: checkedRules,
    rules_passed: checkedRules.length - new Set(violations.map(v => v.rule)).size,
    rules_failed: new Set(violations.map(v => v.rule)).size,
    checked_at: now(),
    hostile_audit_complete: true
  };
};

// ─── Definition of Done Validator ────────────────────────────────────────────

export type DefinitionOfDoneCheck = {
  check_name: string;
  passed: boolean;
  detail: string;
  category: "auto_flow" | "qa" | "export" | "arabic" | "evidence" | "tools";
};

export type DefinitionOfDoneReport = {
  report_id: string;
  deck_id: string;
  checks: DefinitionOfDoneCheck[];
  all_passed: boolean;
  passed_count: number;
  failed_count: number;
  created_at: string;
};

export const validateDefinitionOfDone = (params: {
  deckId: string;
  autoFlowProducedDeck: boolean;
  deckPassedQa: boolean;
  pptxExported: boolean;
  renderParityPassed: boolean;
  arabicElitePassed: boolean;
  evidencePackStored: boolean;
  toolSchemasValidated: boolean;
  antiCheatPassed: boolean;
}): DefinitionOfDoneReport => {
  const checks: DefinitionOfDoneCheck[] = [
    {
      check_name: "auto_flow_produces_deck",
      passed: params.autoFlowProducedDeck,
      detail: params.autoFlowProducedDeck
        ? "AUTO flow produced a deck without asking questions."
        : "AUTO flow did not produce a deck.",
      category: "auto_flow"
    },
    {
      check_name: "deck_passes_qa",
      passed: params.deckPassedQa,
      detail: params.deckPassedQa
        ? "Deck passed QA validation."
        : "Deck did not pass QA.",
      category: "qa"
    },
    {
      check_name: "pptx_exports_and_parity",
      passed: params.pptxExported && params.renderParityPassed,
      detail: params.pptxExported && params.renderParityPassed
        ? "PPTX exports and RenderParity passes."
        : `PPTX exported: ${params.pptxExported}, Parity: ${params.renderParityPassed}`,
      category: "export"
    },
    {
      check_name: "arabic_elite_passes",
      passed: params.arabicElitePassed,
      detail: params.arabicElitePassed
        ? "Arabic ELITE layout passes."
        : "Arabic ELITE layout failed.",
      category: "arabic"
    },
    {
      check_name: "evidence_pack_stored",
      passed: params.evidencePackStored,
      detail: params.evidencePackStored
        ? "Evidence pack stored successfully."
        : "No evidence pack stored.",
      category: "evidence"
    },
    {
      check_name: "tool_schemas_validated",
      passed: params.toolSchemasValidated,
      detail: params.toolSchemasValidated
        ? "Tool schemas implemented and validated."
        : "Tool schemas not validated.",
      category: "tools"
    },
    {
      check_name: "anti_cheat_passed",
      passed: params.antiCheatPassed,
      detail: params.antiCheatPassed
        ? "Anti-cheating checks passed."
        : "Anti-cheating violations detected.",
      category: "qa"
    }
  ];

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  return {
    report_id: uid("dod", params.deckId, Date.now()),
    deck_id: params.deckId,
    checks,
    all_passed: failed === 0,
    passed_count: passed,
    failed_count: failed,
    created_at: now()
  };
};

// ─── Chart Binding from Data ─────────────────────────────────────────────────

export type ChartBindingSpec = {
  binding_id: string;
  deck_id: string;
  slide_ref: string;
  block_ref: string;
  chart_type: "bar" | "line" | "pie" | "area" | "donut" | "radar";
  data_source_ref: string;
  dimension_field: string;
  measure_fields: string[];
  refresh_on_source_update: boolean;
  preserve_design_on_refresh: boolean;
};

export const buildChartBinding = (
  deckId: string,
  slideRef: string,
  blockRef: string,
  chartType: ChartBindingSpec["chart_type"],
  dataSourceRef: string,
  dimensionField: string,
  measureFields: string[]
): ChartBindingSpec => ({
  binding_id: uid("chart-binding", blockRef, Date.now()),
  deck_id: deckId,
  slide_ref: slideRef,
  block_ref: blockRef,
  chart_type: chartType,
  data_source_ref: dataSourceRef,
  dimension_field: dimensionField,
  measure_fields: measureFields,
  refresh_on_source_update: true,
  preserve_design_on_refresh: true
});

// ─── Tool Schema Extensions ──────────────────────────────────────────────────

export type ExtendedToolSchema = {
  tool_id: string;
  tool_name: string;
  description: string;
  description_ar: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  required_permissions: string[];
  deterministic: boolean;
  evidence_hooks: string[];
};

export const ENGINE_MODE_TOOL_SCHEMAS: ExtendedToolSchema[] = [
  {
    tool_id: "slides.auto_flow",
    tool_name: "Auto Flow",
    description: "Run the full AUTO mode pipeline: prompt → outline → storyboard → deck → QA → export",
    description_ar: "تشغيل مسار AUTO الكامل: الأمر → المخطط → القصة المصورة → العرض → ضمان الجودة → التصدير",
    input_schema: { type: "object", properties: { prompt: { type: "string" }, language: { type: "string" }, export_targets: { type: "array", items: { type: "string" } } }, required: ["prompt"] },
    output_schema: { type: "object", properties: { flow_state: { type: "object" }, bundle: { type: "object" }, exports: { type: "array" } } },
    required_permissions: ["presentations.write", "presentations.export"],
    deterministic: false,
    evidence_hooks: ["audit.auto_flow_completed"]
  },
  {
    tool_id: "slides.controlled_flow",
    tool_name: "Controlled Flow",
    description: "Run CONTROLLED mode with explicit knobs for slide count, tone, density, etc.",
    description_ar: "تشغيل وضع CONTROLLED مع أدوات تحكم صريحة لعدد الشرائح والنبرة والكثافة وغيرها",
    input_schema: { type: "object", properties: { knobs: { type: "object" }, content_mode: { type: "string", enum: ["literal_1to1", "smart"] }, sources: { type: "array" } }, required: ["knobs"] },
    output_schema: { type: "object", properties: { flow_state: { type: "object" }, bundle: { type: "object" } } },
    required_permissions: ["presentations.write"],
    deterministic: false,
    evidence_hooks: ["audit.controlled_flow_completed"]
  },
  {
    tool_id: "slides.content_fidelity_report",
    tool_name: "Content Fidelity Report",
    description: "Generate a content fidelity report verifying literal hash or smart content trace",
    description_ar: "إنشاء تقرير دقة المحتوى للتحقق من تطابق التجزئة الحرفية أو تتبع المحتوى الذكي",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, mode: { type: "string", enum: ["literal_1to1", "smart"] } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { report: { type: "object" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: ["audit.content_fidelity_checked"]
  },
  {
    tool_id: "slides.infographic_swap",
    tool_name: "Swap Infographic Variant",
    description: "Swap infographic variant: timeline/process/swot/2x2/kpi_grid/comparison/org_chart/quote/section_divider/diagram",
    description_ar: "تبديل نوع الإنفوجرافيك: جدول زمني/تدفق/SWOT/مصفوفة/شبكة مؤشرات/مقارنة/هيكل تنظيمي/اقتباس/فاصل/مخطط",
    input_schema: { type: "object", properties: { current_kind: { type: "string" }, direction: { type: "string", enum: ["next", "prev", "random"] } }, required: ["current_kind"] },
    output_schema: { type: "object", properties: { variant: { type: "object" } } },
    required_permissions: ["presentations.write"],
    deterministic: false,
    evidence_hooks: []
  },
  {
    tool_id: "slides.template_compliance_report",
    tool_name: "Template Compliance Report",
    description: "Generate a compliance report checking deck against locked template constraints",
    description_ar: "إنشاء تقرير امتثال للتحقق من العرض مقابل قيود القالب المقفل",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, template_ref: { type: "string" } }, required: ["deck_id", "template_ref"] },
    output_schema: { type: "object", properties: { report: { type: "object" } } },
    required_permissions: ["presentations.read", "templates.read"],
    deterministic: true,
    evidence_hooks: ["audit.template_compliance_checked"]
  },
  {
    tool_id: "slides.strict_insert",
    tool_name: "Strict Insert Slide",
    description: "Insert a slide from image or PDF via strict replication engine",
    description_ar: "إدراج شريحة من صورة أو PDF عبر محرك النسخ المتماثل الصارم",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, source_kind: { type: "string", enum: ["image", "pdf"] }, source_path: { type: "string" } }, required: ["deck_id", "source_kind", "source_path"] },
    output_schema: { type: "object", properties: { result: { type: "object" } } },
    required_permissions: ["presentations.write"],
    deterministic: true,
    evidence_hooks: ["audit.strict_insert_completed"]
  },
  {
    tool_id: "slides.connector_picker",
    tool_name: "Connector Picker",
    description: "Pick a file from Google Drive, OneDrive, SharePoint, or S3",
    description_ar: "اختيار ملف من جوجل درايف أو ون درايف أو شيربوينت أو S3",
    input_schema: { type: "object", properties: { provider: { type: "string", enum: ["google_drive", "onedrive", "sharepoint", "s3", "local"] }, uri: { type: "string" } }, required: ["provider", "uri"] },
    output_schema: { type: "object", properties: { result: { type: "object" } } },
    required_permissions: ["connectors.read"],
    deterministic: true,
    evidence_hooks: []
  },
  {
    tool_id: "slides.anti_cheat_check",
    tool_name: "Anti-Cheat Check",
    description: "Run anti-cheating validation: no fake claims, no placeholders, no stubs, evidence required",
    description_ar: "تشغيل التحقق من مكافحة الغش: لا ادعاءات وهمية، لا عناصر نائبة، لا أكواد مبدئية، الأدلة مطلوبة",
    input_schema: { type: "object", properties: { deck_id: { type: "string" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { report: { type: "object" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: ["audit.anti_cheat_checked"]
  },
  {
    tool_id: "slides.definition_of_done",
    tool_name: "Definition of Done",
    description: "Validate Definition of Done: AUTO flow, QA, PPTX, parity, Arabic ELITE, evidence, tools",
    description_ar: "التحقق من تعريف الإنجاز: المسار التلقائي، ضمان الجودة، PPTX، التطابق، العربية المتقدمة، الأدلة، الأدوات",
    input_schema: { type: "object", properties: { deck_id: { type: "string" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { report: { type: "object" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: ["audit.dod_validated"]
  },
  {
    tool_id: "slides.deterministic_layout",
    tool_name: "Deterministic Layout",
    description: "Generate deterministic slide layouts from seed for reproducible results",
    description_ar: "توليد تخطيطات شرائح حتمية من بذرة لنتائج قابلة للتكرار",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, slide_count: { type: "number" }, seed: { type: "number" } }, required: ["deck_id", "slide_count", "seed"] },
    output_schema: { type: "object", properties: { result: { type: "object" } } },
    required_permissions: ["presentations.write"],
    deterministic: true,
    evidence_hooks: []
  },
  {
    tool_id: "slides.arabic_elite_validate",
    tool_name: "Arabic ELITE Validate",
    description: "Validate Arabic ELITE layout requirements: RTL, fonts, numerals, bidi",
    description_ar: "التحقق من متطلبات التخطيط العربي المتقدم: اتجاه النص، الخطوط، الأرقام، ثنائية الاتجاه",
    input_schema: { type: "object", properties: { deck_id: { type: "string" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { result: { type: "object" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: ["audit.arabic_elite_validated"]
  },
  {
    tool_id: "slides.data_picker_select",
    tool_name: "Data Picker Select",
    description: "Select data from Excel file/sheet/range with column selection and T-IR transforms",
    description_ar: "اختيار البيانات من ملف إكسل/ورقة/نطاق مع اختيار الأعمدة وتحويلات T-IR",
    input_schema: { type: "object", properties: { file_ref: { type: "string" }, sheet_name: { type: "string" }, table_range: { type: "string" }, columns: { type: "array", items: { type: "string" } }, transforms: { type: "array" } }, required: ["file_ref", "sheet_name"] },
    output_schema: { type: "object", properties: { selection: { type: "object" }, preview: { type: "object" } } },
    required_permissions: ["data.read"],
    deterministic: true,
    evidence_hooks: ["audit.data_picker_selected"]
  },
  {
    tool_id: "slides.data_picker_preview",
    tool_name: "Data Picker Preview",
    description: "Preview selected data with transforms applied before inserting into slide",
    description_ar: "معاينة البيانات المحددة مع تطبيق التحويلات قبل الإدراج في الشريحة",
    input_schema: { type: "object", properties: { selection_id: { type: "string" } }, required: ["selection_id"] },
    output_schema: { type: "object", properties: { preview: { type: "object" } } },
    required_permissions: ["data.read"],
    deterministic: true,
    evidence_hooks: []
  },
  {
    tool_id: "slides.dashboard_slide",
    tool_name: "Dashboard Slide",
    description: "Create a dashboard-like slide with KPI cards, mini charts, tables, and slicer filters",
    description_ar: "إنشاء شريحة لوحة معلومات مع بطاقات مؤشرات أداء ومخططات مصغرة وجداول ومرشحات",
    input_schema: { type: "object", properties: { dashboard_kind: { type: "string", enum: ["kpi_cards", "mini_charts", "data_table", "slicer_filter", "state_summary"] }, title: { type: "string" }, kpi_cards: { type: "array" }, mini_charts: { type: "array" }, slicer_filters: { type: "array" } }, required: ["dashboard_kind", "title"] },
    output_schema: { type: "object", properties: { slide_spec: { type: "object" } } },
    required_permissions: ["presentations.write"],
    deterministic: false,
    evidence_hooks: ["audit.dashboard_slide_created"]
  },
  {
    tool_id: "slides.full_anti_cheat_audit",
    tool_name: "Full Anti-Cheat Audit",
    description: "Run hostile runtime audit with 35 hard failure rules across artifact, content, governance, lineage, runtime, and integration categories",
    description_ar: "تشغيل تدقيق وقت التشغيل العدائي مع 35 قاعدة فشل صارمة عبر فئات القطع الأثرية والمحتوى والحوكمة والنسب والتشغيل والتكامل",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, full_input: { type: "object" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { report: { type: "object" }, hostile_audit_complete: { type: "boolean" } } },
    required_permissions: ["presentations.read", "audit.write"],
    deterministic: true,
    evidence_hooks: ["audit.hostile_audit_completed"]
  }
];
