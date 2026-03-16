/**
 * Control Manifest + User Preferences + Element Transform + Data Picker + Dashboard Slides + Tool Schemas
 * Implements Sections 1, 2, 4, 6, 7, 8, 14 of ADDENDUM
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";

// ─── Control Manifest (Section 1) ────────────────────────────────────────────

export type ControlMode = "auto" | "fixed";

export type ControlSetting<T> = {
  mode: ControlMode;
  value: T;
  default_value: T;
  label: string;
  label_ar: string;
  category: "deck" | "slide" | "element";
  group: string;
  visible_priority: number; // 1-9, lower = more important = shown first
};

export type ControlManifest = {
  manifest_id: string;
  deck_id: string;
  settings: Record<string, ControlSetting<unknown>>;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  prefs_id: string;
  user_id: string;
  prefs_enabled: boolean;
  defaults: {
    fidelity_mode: "literal_1to1" | "smart";
    language: string;
    slide_size: "16:9" | "4:3" | "A4" | "custom";
    custom_width?: number;
    custom_height?: number;
    tone: "formal" | "neutral" | "creative";
    density: "sparse" | "standard" | "dense";
    infographic_level: "low" | "med" | "high";
    motion_level: "none" | "basic" | "cinematic";
    fonts: { ar_font: string; latin_font: string; mono_font: string };
    palette: string;
    background_style: "auto" | "solid" | "gradient" | "image" | "pattern";
    numbering_style: "off" | "slide_x_of_y" | "section_based" | "custom";
    toc_index: boolean;
    toc_style: string;
    header_footer_rules: string;
    citations: "off" | "on";
    citation_style: string;
    export_targets: string[];
    slide_resolution_hint: "standard" | "hi_dpi";
  };
  created_at: string;
  updated_at: string;
};

const now = (): string => new Date().toISOString();
const uid = (prefix: string, ...parts: Array<string | number>) =>
  [prefix, ...parts].join("-").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// ─── Intent Manifest (Section 4) ─────────────────────────────────────────────

export type IntentManifestExtended = {
  objective: "report" | "pitch" | "training" | "executive_update" | "general";
  audience: "exec" | "technical" | "sales" | "general";
  required_slides: Array<{ type: string; must_include: boolean }>;
  constraints: {
    fidelity: "literal_1to1" | "smart";
    template_lock: boolean;
    brand_active: boolean;
  };
  data_needs: {
    metrics: boolean;
    tables: boolean;
    charts: boolean;
  };
  language_rules: {
    primary: string;
    mixed: boolean;
    arabic_mode: "standard" | "elite";
  };
  export_targets: string[];
};

export const inferIntentFromPrompt = (prompt: string, language: string): IntentManifestExtended => {
  const lower = prompt.toLowerCase();
  const isArabic = /[\u0600-\u06FF]/.test(prompt);

  // Disambiguate objective without asking questions (Section 4.2)
  let objective: IntentManifestExtended["objective"] = "general";
  if (/تقرير|report|summary|ملخص/.test(lower)) objective = "report";
  else if (/pitch|عرض.*مستثمر|investor|startup/.test(lower)) objective = "pitch";
  else if (/تدريب|training|workshop|ورش/.test(lower)) objective = "training";
  else if (/تنفيذي|executive|steering|لجنة/.test(lower)) objective = "executive_update";

  let audience: IntentManifestExtended["audience"] = "general";
  if (/تنفيذي|executive|ceo|cfo|board|مجلس/.test(lower)) audience = "exec";
  else if (/تقني|technical|developer|مهندس/.test(lower)) audience = "technical";
  else if (/مبيعات|sales|marketing|تسويق/.test(lower)) audience = "sales";

  const requiredSlides: IntentManifestExtended["required_slides"] = [
    { type: "title", must_include: true },
    { type: "agenda", must_include: true },
  ];
  if (/kpi|مؤشر|أداء|metric/.test(lower)) requiredSlides.push({ type: "kpi", must_include: true });
  if (/مقارنة|comparison|versus|ضد/.test(lower)) requiredSlides.push({ type: "comparison", must_include: true });
  if (/جدول.*زمني|timeline|roadmap|خارطة/.test(lower)) requiredSlides.push({ type: "timeline", must_include: true });
  if (/chart|رسم.*بياني|graph/.test(lower)) requiredSlides.push({ type: "chart", must_include: true });
  requiredSlides.push({ type: "closing", must_include: true });

  const dataNeeds = {
    metrics: /kpi|metric|مؤشر|أداء|نسبة|percentage/.test(lower),
    tables: /جدول|table|data|بيانات/.test(lower),
    charts: /chart|رسم|graph|مخطط/.test(lower),
  };

  return {
    objective,
    audience,
    required_slides: requiredSlides,
    constraints: {
      fidelity: /حرفي|literal|1to1|exact/.test(lower) ? "literal_1to1" : "smart",
      template_lock: /template|قالب/.test(lower),
      brand_active: /brand|علامة|هوية/.test(lower),
    },
    data_needs: dataNeeds,
    language_rules: {
      primary: isArabic ? "ar" : language.startsWith("ar") ? "ar" : "en",
      mixed: /mixed|مختلط|bilingual/.test(lower),
      arabic_mode: isArabic ? "elite" : "standard",
    },
    export_targets: ["pptx", "pdf", "html"],
  };
};

// ─── Smart Defaults (Section 2.3) ────────────────────────────────────────────

export const resolveSmartDefaults = (
  prompt: string,
  language: string,
  userPrefs: UserPreferences | null
): Record<string, unknown> => {
  const isArabic = /[\u0600-\u06FF]/.test(prompt) || language.startsWith("ar");
  const isBusiness = /business|تجاري|مؤسس|enterprise/.test(prompt.toLowerCase());

  const defaults: Record<string, unknown> = {
    tone: isBusiness ? "formal" : "neutral",
    arabic_mode: isArabic ? "elite" : "standard",
    slide_count: 10,
    rtl_policy: isArabic ? "rtl" : "auto",
    template_lock: false,
    density: "standard",
    infographic_level: "med",
    motion_level: "basic",
    numbering_style: "slide_x_of_y",
    toc_index: true,
    slide_size: "16:9",
    slide_resolution_hint: "standard",
    background_style: "auto",
    export_targets: ["pptx", "pdf", "html"],
  };

  // Apply user preferences if enabled
  if (userPrefs?.prefs_enabled) {
    if (userPrefs.defaults.tone) defaults.tone = userPrefs.defaults.tone;
    if (userPrefs.defaults.density) defaults.density = userPrefs.defaults.density;
    if (userPrefs.defaults.infographic_level) defaults.infographic_level = userPrefs.defaults.infographic_level;
    if (userPrefs.defaults.motion_level) defaults.motion_level = userPrefs.defaults.motion_level;
    if (userPrefs.defaults.numbering_style) defaults.numbering_style = userPrefs.defaults.numbering_style;
    if (userPrefs.defaults.toc_index !== undefined) defaults.toc_index = userPrefs.defaults.toc_index;
    if (userPrefs.defaults.slide_size) defaults.slide_size = userPrefs.defaults.slide_size;
    if (userPrefs.defaults.slide_resolution_hint) defaults.slide_resolution_hint = userPrefs.defaults.slide_resolution_hint;
    if (userPrefs.defaults.background_style) defaults.background_style = userPrefs.defaults.background_style;
    if (userPrefs.defaults.export_targets?.length) defaults.export_targets = userPrefs.defaults.export_targets;
  }

  return defaults;
};

// ─── Build Control Manifest (Section 1.2) ────────────────────────────────────

export const buildControlManifest = (
  deckId: string,
  prompt: string,
  language: string,
  userPrefs: UserPreferences | null
): ControlManifest => {
  const smartDefaults = resolveSmartDefaults(prompt, language, userPrefs);
  const ts = now();

  const setting = <T>(
    key: string,
    label: string,
    labelAr: string,
    category: ControlSetting<T>["category"],
    group: string,
    defaultValue: T,
    priority: number
  ): ControlSetting<T> => ({
    mode: "auto",
    value: defaultValue,
    default_value: defaultValue,
    label,
    label_ar: labelAr,
    category,
    group,
    visible_priority: priority,
  });

  const settings: Record<string, ControlSetting<unknown>> = {
    // Deck-level (Section 1.2)
    fidelity_mode: setting("fidelity_mode", "Fidelity Mode", "وضع الدقة", "deck", "content", "smart", 1),
    language: setting("language", "Language", "اللغة", "deck", "content", language, 1),
    slide_count: setting("slide_count", "Slide Count", "عدد الشرائح", "deck", "content", smartDefaults.slide_count, 2),
    slide_size: setting("slide_size", "Slide Size", "حجم الشريحة", "deck", "layout", smartDefaults.slide_size, 2),
    slide_resolution_hint: setting("slide_resolution_hint", "Resolution", "الدقة", "deck", "layout", smartDefaults.slide_resolution_hint, 5),
    theme_source: setting("theme_source", "Theme Source", "مصدر السمة", "deck", "theme", "auto", 3),
    palette: setting("palette", "Color Palette", "لوحة الألوان", "deck", "theme", "auto", 3),
    fonts: setting("fonts", "Fonts", "الخطوط", "deck", "theme", "auto", 4),
    background_style: setting("background_style", "Background", "الخلفية", "deck", "theme", smartDefaults.background_style, 4),
    tone: setting("tone", "Tone", "النبرة", "deck", "content", smartDefaults.tone, 2),
    density: setting("density", "Density", "الكثافة", "deck", "content", smartDefaults.density, 3),
    infographic_level: setting("infographic_level", "Infographic Level", "مستوى الإنفوجرافيك", "deck", "content", smartDefaults.infographic_level, 4),
    motion_level: setting("motion_level", "Motion Level", "مستوى الحركة", "deck", "animation", smartDefaults.motion_level, 5),
    numbering_style: setting("numbering_style", "Numbering", "الترقيم", "deck", "layout", smartDefaults.numbering_style, 6),
    toc_index: setting("toc_index", "Table of Contents", "فهرس المحتويات", "deck", "layout", smartDefaults.toc_index, 6),
    header_footer_rules: setting("header_footer_rules", "Header/Footer", "الرأس/التذييل", "deck", "layout", "auto", 7),
    citations: setting("citations", "Citations", "الاستشهادات", "deck", "content", "off", 8),
    export_targets: setting("export_targets", "Export Targets", "أهداف التصدير", "deck", "export", smartDefaults.export_targets, 5),
    // Slide-level
    layout_variant: setting("layout_variant", "Layout", "التخطيط", "slide", "layout", "auto", 1),
    infographic_variant: setting("infographic_variant", "Infographic Style", "نمط الإنفوجرافيك", "slide", "content", "auto", 2),
    table_style_variant: setting("table_style_variant", "Table Style", "نمط الجدول", "slide", "content", "auto", 3),
    chart_style_variant: setting("chart_style_variant", "Chart Style", "نمط الرسم البياني", "slide", "content", "auto", 3),
    icon_style_variant: setting("icon_style_variant", "Icon Style", "نمط الأيقونات", "slide", "content", "auto", 4),
    slide_rtl_policy: setting("slide_rtl_policy", "RTL Policy", "سياسة الاتجاه", "slide", "layout", "auto", 5),
    // Element-level
    image_treatment: setting("image_treatment", "Image Treatment", "معالجة الصورة", "element", "media", "auto", 1),
    element_animation: setting("element_animation", "Animation", "الحركة", "element", "animation", "auto", 2),
    element_typography_scale: setting("element_typography_scale", "Typography Scale", "مقياس الخط", "element", "typography", 1.0, 3),
  };

  return {
    manifest_id: uid("manifest", deckId, Date.now()),
    deck_id: deckId,
    settings,
    created_at: ts,
    updated_at: ts,
  };
};

// ─── Control Surfacing Policy (Section 2.2) ───────────────────────────────────

export type ControlSurfaceLevel = "deck" | "slide" | "element" | "none";

export const getVisibleControls = (
  manifest: ControlManifest,
  level: ControlSurfaceLevel,
  maxVisible: number = 9
): Array<{ key: string; setting: ControlSetting<unknown> }> => {
  if (level === "none") return [];
  const entries = Object.entries(manifest.settings)
    .filter(([_, s]) => s.category === level)
    .sort((a, b) => a[1].visible_priority - b[1].visible_priority);
  return entries.slice(0, maxVisible).map(([key, setting]) => ({ key, setting }));
};

export const searchControls = (
  manifest: ControlManifest,
  query: string
): Array<{ key: string; setting: ControlSetting<unknown> }> => {
  const q = query.toLowerCase();
  return Object.entries(manifest.settings)
    .filter(([key, s]) =>
      key.includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.label_ar.includes(q) ||
      s.group.includes(q)
    )
    .map(([key, setting]) => ({ key, setting }));
};

// ─── User Preferences Storage ────────────────────────────────────────────────

export const defaultUserPreferences = (userId: string): UserPreferences => ({
  prefs_id: uid("prefs", userId),
  user_id: userId,
  prefs_enabled: true,
  defaults: {
    fidelity_mode: "smart",
    language: "ar",
    slide_size: "16:9",
    tone: "formal",
    density: "standard",
    infographic_level: "med",
    motion_level: "basic",
    fonts: { ar_font: "Tajawal", latin_font: "Aptos", mono_font: "Cascadia Code" },
    palette: "auto",
    background_style: "auto",
    numbering_style: "slide_x_of_y",
    toc_index: true,
    toc_style: "numbered_list",
    header_footer_rules: "auto",
    citations: "off",
    citation_style: "apa",
    export_targets: ["pptx", "pdf", "html"],
    slide_resolution_hint: "standard",
  },
  created_at: now(),
  updated_at: now(),
});

export const loadUserPreferences = (rootDir: string, userId: string): UserPreferences => {
  const filePath = path.join(rootDir, "platform", "user-prefs", `${userId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as UserPreferences;
  }
  return defaultUserPreferences(userId);
};

export const saveUserPreferences = (rootDir: string, prefs: UserPreferences): void => {
  const filePath = path.join(rootDir, "platform", "user-prefs", `${prefs.user_id}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  prefs.updated_at = now();
  fs.writeFileSync(filePath, JSON.stringify(prefs, null, 2), "utf8");
};

// ─── Element Transform (Section 6) ──────────────────────────────────────────

export type ElementTransformKind =
  | "replace_style"
  | "replace_layout_container"
  | "convert_to_infographic"
  | "swap_icon_pack"
  | "change_chart_type"
  | "change_table_style"
  | "change_background_treatment"
  | "change_animation_preset"
  | "change_typography_scale";

export type ElementTransformRequest = {
  deck_id: string;
  slide_ref: string;
  block_ref: string;
  transform_kind: ElementTransformKind;
  target_asset_id?: string;
  target_variant_id?: string;
  params?: Partial<{
    chart_type: string;
    table_style: string;
    icon_pack: string;
    animation_preset: string;
    typography_scale: number;
    background_treatment: string;
    infographic_kind: string;
  }>;
};

export type ElementTransformResult = {
  success: boolean;
  transform_kind: ElementTransformKind;
  block_ref: string;
  applied_params: Record<string, unknown>;
  preview_html: string;
  undo_snapshot: Record<string, unknown>;
};

export const applyElementTransform = (
  block: Record<string, unknown>,
  request: ElementTransformRequest
): ElementTransformResult => {
  const undoSnapshot = JSON.parse(JSON.stringify(block));
  const metadata = (block.block_metadata ?? {}) as Record<string, unknown>;
  let previewHtml = "";
  const appliedParams: Record<string, unknown> = {};

  switch (request.transform_kind) {
    case "change_chart_type": {
      const newType = request.params?.chart_type ?? "bar";
      const chart = metadata.chart as Record<string, unknown> | undefined;
      if (chart) {
        chart.chart_type = newType;
        appliedParams.chart_type = newType;
        previewHtml = `<div class="chart-preview" data-type="${newType}">Chart type changed to ${newType}</div>`;
      }
      break;
    }
    case "change_table_style": {
      const newStyle = request.params?.table_style ?? "minimal";
      metadata.table_style = newStyle;
      appliedParams.table_style = newStyle;
      previewHtml = `<div class="table-preview" data-style="${newStyle}">Table style: ${newStyle}</div>`;
      break;
    }
    case "swap_icon_pack": {
      const newPack = request.params?.icon_pack ?? "business_core";
      metadata.icon_pack = newPack;
      appliedParams.icon_pack = newPack;
      previewHtml = `<div class="icon-preview" data-pack="${newPack}">Icon pack: ${newPack}</div>`;
      break;
    }
    case "change_animation_preset": {
      const newPreset = request.params?.animation_preset ?? "fade_in";
      metadata.animation_preset = newPreset;
      appliedParams.animation_preset = newPreset;
      previewHtml = `<div class="motion-preview" data-preset="${newPreset}">Animation: ${newPreset}</div>`;
      break;
    }
    case "change_typography_scale": {
      const scale = request.params?.typography_scale ?? 1.0;
      metadata.typography_scale = scale;
      appliedParams.typography_scale = scale;
      previewHtml = `<div class="typography-preview" style="font-size:${Math.round(16 * scale)}px">Typography scale: ${scale}</div>`;
      break;
    }
    case "change_background_treatment": {
      const treatment = request.params?.background_treatment ?? "solid";
      metadata.background_treatment = treatment;
      appliedParams.background_treatment = treatment;
      previewHtml = `<div class="bg-preview" data-treatment="${treatment}">Background: ${treatment}</div>`;
      break;
    }
    case "convert_to_infographic": {
      const infographicKind = request.params?.infographic_kind ?? "process";
      block.block_kind = "infographic";
      metadata.infographic_kind = infographicKind;
      appliedParams.infographic_kind = infographicKind;
      previewHtml = `<div class="infographic-preview" data-kind="${infographicKind}">Converted to infographic: ${infographicKind}</div>`;
      break;
    }
    case "replace_style": {
      if (request.target_asset_id) {
        metadata.style_asset_id = request.target_asset_id;
        appliedParams.style_asset_id = request.target_asset_id;
      }
      previewHtml = `<div class="style-preview">Style replaced</div>`;
      break;
    }
    case "replace_layout_container": {
      if (request.target_asset_id) {
        metadata.layout_asset_id = request.target_asset_id;
        appliedParams.layout_asset_id = request.target_asset_id;
      }
      previewHtml = `<div class="layout-preview">Layout container replaced</div>`;
      break;
    }
  }

  block.block_metadata = metadata;

  return {
    success: true,
    transform_kind: request.transform_kind,
    block_ref: request.block_ref,
    applied_params: appliedParams,
    preview_html: previewHtml,
    undo_snapshot: undoSnapshot,
  };
};

// ─── Data Picker (Section 7) ─────────────────────────────────────────────────

export type DataPickerBrowseRequest = {
  file_path: string;
  sheet_name?: string;
};

export type DataPickerBrowseResult = {
  file_path: string;
  sheets: Array<{
    name: string;
    row_count: number;
    column_count: number;
    columns: string[];
    named_tables: string[];
    preview_rows: Array<Record<string, unknown>>;
  }>;
};

export type DataPickerSelectRequest = {
  file_path: string;
  sheet_name: string;
  columns: string[];
  range?: string; // e.g., "A1:D10"
  filters?: Array<{
    column: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "starts_with";
    value: string | number;
  }>;
  group_by?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  limit?: number;
};

export type DataPickerSelectResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_rows: number;
  filtered_rows: number;
  summary: {
    numeric_columns: Array<{ column: string; min: number; max: number; avg: number; sum: number }>;
    text_columns: Array<{ column: string; unique_count: number }>;
  };
};

export const browseExcelFile = (request: DataPickerBrowseRequest): DataPickerBrowseResult => {
  if (!fs.existsSync(request.file_path)) {
    throw new Error(`File not found: ${request.file_path}`);
  }
  const workbook = XLSX.readFile(request.file_path);
  const sheets = workbook.SheetNames.map((name: string) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return null;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
    const namedTables: string[] = [];
    if (sheet["!autofilter"]) namedTables.push("AutoFilter");
    return {
      name,
      row_count: data.length,
      column_count: columns.length,
      columns,
      named_tables: namedTables,
      preview_rows: data.slice(0, 5),
    };
  }).filter((s: { name: string; row_count: number; column_count: number; columns: string[]; named_tables: string[]; preview_rows: Record<string, unknown>[] } | null): s is NonNullable<typeof s> => s !== null);

  if (request.sheet_name) {
    const filtered = sheets.filter((s: { name: string }) => s.name === request.sheet_name);
    return { file_path: request.file_path, sheets: filtered.length > 0 ? filtered : sheets };
  }
  return { file_path: request.file_path, sheets };
};

export const selectDataFromExcel = (request: DataPickerSelectRequest): DataPickerSelectResult => {
  if (!fs.existsSync(request.file_path)) {
    throw new Error(`File not found: ${request.file_path}`);
  }
  const workbook = XLSX.readFile(request.file_path);
  const sheet = workbook.Sheets[request.sheet_name];
  if (!sheet) throw new Error(`Sheet not found: ${request.sheet_name}`);

  let data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const totalRows = data.length;

  // Apply range filter if specified
  if (request.range) {
    const rangeRef = XLSX.utils.decode_range(request.range);
    const rangeSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      sheet,
      { defval: "", range: rangeRef }
    );
    data = rangeSheet;
  }

  // Apply column selection
  if (request.columns.length > 0) {
    data = data.map((row: Record<string, unknown>) => {
      const filtered: Record<string, unknown> = {};
      for (const col of request.columns) {
        if (col in row) filtered[col] = row[col];
      }
      return filtered;
    });
  }

  // Apply filters
  if (request.filters && request.filters.length > 0) {
    for (const filter of request.filters) {
      data = data.filter((row: Record<string, unknown>) => {
        const val = row[filter.column];
        const numVal = typeof val === "number" ? val : Number(val);
        const strVal = String(val ?? "");
        switch (filter.operator) {
          case "eq": return val == filter.value;
          case "neq": return val != filter.value;
          case "gt": return numVal > Number(filter.value);
          case "lt": return numVal < Number(filter.value);
          case "gte": return numVal >= Number(filter.value);
          case "lte": return numVal <= Number(filter.value);
          case "contains": return strVal.toLowerCase().includes(String(filter.value).toLowerCase());
          case "starts_with": return strVal.toLowerCase().startsWith(String(filter.value).toLowerCase());
          default: return true;
        }
      });
    }
  }

  // Apply grouping
  if (request.group_by) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of data) {
      const key = String(row[request.group_by] ?? "");
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    // Aggregate: take first row per group, add count
    data = [...groups.entries()].map(([key, rows]) => {
      const first = { ...rows[0] };
      first.__group_count = rows.length;
      return first;
    });
  }

  // Apply sorting
  if (request.sort_by) {
    const sortCol = request.sort_by;
    const order = request.sort_order === "desc" ? -1 : 1;
    data.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * order;
      return String(va ?? "").localeCompare(String(vb ?? "")) * order;
    });
  }

  // Apply limit
  if (request.limit && request.limit > 0) {
    data = data.slice(0, request.limit);
  }

  // Build summary
  const columns = data.length > 0 ? Object.keys(data[0]) : request.columns;
  const numericColumns: DataPickerSelectResult["summary"]["numeric_columns"] = [];
  const textColumns: DataPickerSelectResult["summary"]["text_columns"] = [];

  for (const col of columns) {
    if (col.startsWith("__")) continue;
    const values = data.map((r: Record<string, unknown>) => r[col]);
    const numValues = values.filter((v: unknown) => typeof v === "number").map((v: unknown) => v as number);
    if (numValues.length > values.length / 2) {
      numericColumns.push({
        column: col,
        min: Math.min(...numValues),
        max: Math.max(...numValues),
        avg: numValues.reduce((a: number, b: number) => a + b, 0) / numValues.length,
        sum: numValues.reduce((a: number, b: number) => a + b, 0),
      });
    } else {
      const unique = new Set(values.map((v: unknown) => String(v)));
      textColumns.push({ column: col, unique_count: unique.size });
    }
  }

  return {
    columns,
    rows: data,
    total_rows: totalRows,
    filtered_rows: data.length,
    summary: { numeric_columns: numericColumns, text_columns: textColumns },
  };
};

// ─── Data Binding Apply (Section 7.3) ────────────────────────────────────────

export type DataBindingApplyRequest = {
  deck_id: string;
  slide_ref: string;
  block_ref: string;
  target_kind: "table" | "chart" | "kpi";
  data: DataPickerSelectResult;
  chart_type?: string;
  chart_dimension?: string;
  chart_measure?: string;
};

export type DataBindingApplyResult = {
  success: boolean;
  block_ref: string;
  target_kind: string;
  binding_id: string;
  embedded_data: Record<string, unknown>;
};

export const applyDataBinding = (request: DataBindingApplyRequest): DataBindingApplyResult => {
  const bindingId = uid("binding", request.deck_id, request.block_ref, Date.now());
  let embeddedData: Record<string, unknown> = {};

  if (request.target_kind === "table") {
    embeddedData = {
      columns: request.data.columns,
      rows: request.data.rows.map(row => request.data.columns.map(col => row[col])),
      field_mappings: request.data.columns.map(col => ({ column: col, type: "auto" })),
    };
  } else if (request.target_kind === "chart") {
    const dimension = request.chart_dimension ?? request.data.summary.text_columns[0]?.column ?? request.data.columns[0];
    const measure = request.chart_measure ?? request.data.summary.numeric_columns[0]?.column ?? request.data.columns[1];
    const categories = request.data.rows.map(r => String(r[dimension] ?? ""));
    const values = request.data.rows.map(r => Number(r[measure] ?? 0));
    embeddedData = {
      chart_type: request.chart_type ?? "bar",
      categories,
      series: [{ name: measure, values }],
      dataset_ref: bindingId,
      field_mappings: [
        { column: dimension, role: "dimension" },
        { column: measure, role: "measure" },
      ],
    };
  } else if (request.target_kind === "kpi") {
    const metrics = request.data.summary.numeric_columns.slice(0, 4).map(col => ({
      label: col.column,
      value: col.avg,
      unit: "",
      trend: col.avg > col.min ? "up" : "flat",
    }));
    embeddedData = { metrics, source_binding: bindingId };
  }

  return {
    success: true,
    block_ref: request.block_ref,
    target_kind: request.target_kind,
    binding_id: bindingId,
    embedded_data: embeddedData,
  };
};

// ─── Dashboard Slides (Section 8) ────────────────────────────────────────────

export type DashboardSlideRequest = {
  deck_id: string;
  title: string;
  kpi_metrics: Array<{ label: string; value: number; unit: string; trend?: string }>;
  mini_charts?: Array<{ type: string; data: number[]; label: string }>;
  table_data?: { columns: string[]; rows: Array<Record<string, unknown>> };
  filters?: Array<{ name: string; options: string[]; default_value: string }>;
};

export type DashboardSlideResult = {
  slide_html: string;
  states: Array<{
    state_id: string;
    filter_values: Record<string, string>;
    slide_html: string;
  }>;
  kpi_cards_html: string;
  mini_charts_html: string;
  table_html: string;
  filter_controls_html: string;
};

export const generateDashboardSlide = (request: DashboardSlideRequest): DashboardSlideResult => {
  // KPI Cards
  const kpiCardsHtml = request.kpi_metrics.map((m, i) => {
    const trendIcon = m.trend === "up" ? "▲" : m.trend === "down" ? "▼" : "●";
    const trendColor = m.trend === "up" ? "#1D8F6E" : m.trend === "down" ? "#DC2626" : "#94A3B8";
    return `<div class="kpi-card" style="background:#FFF;border-radius:12px;padding:16px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:flex;flex-direction:column;gap:4px;min-width:160px;">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(m.label)}</div>
      <div style="font-size:28px;font-weight:700;color:#0F172A;">${m.value}${m.unit ? `<span style="font-size:14px;color:#64748B;margin-inline-start:4px;">${escapeHtml(m.unit)}</span>` : ""}</div>
      <div style="font-size:12px;color:${trendColor};">${trendIcon} ${m.trend ?? "flat"}</div>
    </div>`;
  }).join("");

  // Mini Charts
  const miniChartsHtml = (request.mini_charts ?? []).map(chart => {
    const max = Math.max(...chart.data, 1);
    const barWidth = Math.round(100 / chart.data.length);
    const bars = chart.data.map((v, i) => {
      const height = Math.round((v / max) * 60);
      return `<rect x="${i * barWidth + 2}%" y="${60 - height}" width="${barWidth - 4}%" height="${height}" rx="2" fill="#C7511F" opacity="${0.5 + (v / max) * 0.5}"/>`;
    }).join("");
    return `<div style="background:#FFF;border-radius:12px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="font-size:11px;color:#64748B;margin-bottom:8px;">${escapeHtml(chart.label)}</div>
      <svg viewBox="0 0 100 60" width="100%" height="60" preserveAspectRatio="none">${bars}</svg>
    </div>`;
  }).join("");

  // Table
  let tableHtml = "";
  if (request.table_data) {
    const headerCells = request.table_data.columns.map(c => `<th style="padding:8px 12px;text-align:start;font-size:11px;color:#64748B;border-bottom:2px solid #C7511F;font-weight:600;">${escapeHtml(c)}</th>`).join("");
    const bodyRows = request.table_data.rows.slice(0, 8).map(row =>
      `<tr>${request.table_data!.columns.map(c => `<td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #F1F5F9;">${escapeHtml(String(row[c] ?? ""))}</td>`).join("")}</tr>`
    ).join("");
    tableHtml = `<table style="width:100%;border-collapse:collapse;background:#FFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  // Filter Controls
  const filterControlsHtml = (request.filters ?? []).map(f => {
    const options = f.options.map(o => `<option value="${escapeHtml(o)}" ${o === f.default_value ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
    return `<div class="filter-control" style="display:inline-flex;align-items:center;gap:6px;background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:4px 10px;">
      <label style="font-size:11px;color:#64748B;">${escapeHtml(f.name)}</label>
      <select class="dashboard-filter" data-filter="${escapeHtml(f.name)}" style="border:none;font-size:12px;color:#0F172A;background:none;outline:none;">${options}</select>
    </div>`;
  }).join("");

  // Full slide HTML
  const slideHtml = `<div class="dashboard-slide" style="padding:24px;background:linear-gradient(135deg,#F8FAFC,#EEF2F7);min-height:100%;display:flex;flex-direction:column;gap:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;font-size:20px;color:#0F172A;">${escapeHtml(request.title)}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${filterControlsHtml}</div>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">${kpiCardsHtml}</div>
    ${miniChartsHtml ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">${miniChartsHtml}</div>` : ""}
    ${tableHtml ? `<div style="overflow-x:auto;">${tableHtml}</div>` : ""}
  </div>`;

  // Generate filter states (Section 8.2)
  const states: DashboardSlideResult["states"] = [];
  if (request.filters && request.filters.length > 0) {
    // Generate one state per unique filter option combination (limited to first filter for practicality)
    const primaryFilter = request.filters[0];
    for (const option of primaryFilter.options) {
      const filterValues: Record<string, string> = {};
      filterValues[primaryFilter.name] = option;
      for (const f of request.filters.slice(1)) {
        filterValues[f.name] = f.default_value;
      }
      const stateId = uid("state", request.deck_id, option, Date.now());
      const stateHtml = slideHtml.replace(
        `<h2 style="margin:0;font-size:20px;color:#0F172A;">${escapeHtml(request.title)}</h2>`,
        `<h2 style="margin:0;font-size:20px;color:#0F172A;">${escapeHtml(request.title)} — ${escapeHtml(option)}</h2>`
      );
      states.push({ state_id: stateId, filter_values: filterValues, slide_html: stateHtml });
    }
  }

  return {
    slide_html: slideHtml,
    states,
    kpi_cards_html: kpiCardsHtml,
    mini_charts_html: miniChartsHtml,
    table_html: tableHtml,
    filter_controls_html: filterControlsHtml,
  };
};

// ─── Tool Schemas (Section 14) ───────────────────────────────────────────────

export type ToolSchema = {
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

export const PRESENTATION_TOOL_SCHEMAS: ToolSchema[] = [
  {
    tool_id: "slides.control_manifest_build",
    tool_name: "Build Control Manifest",
    description: "Build a control manifest from deck ID, prompt, language, and user preferences",
    description_ar: "بناء سجل التحكم من معرف العرض والنص واللغة وتفضيلات المستخدم",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, prompt: { type: "string" }, language: { type: "string" }, user_id: { type: "string" } }, required: ["deck_id", "prompt", "language"] },
    output_schema: { type: "object", properties: { manifest: { type: "object" } } },
    required_permissions: ["presentations.read", "presentations.write"],
    deterministic: true,
    evidence_hooks: ["audit.control_manifest_built"],
  },
  {
    tool_id: "slides.preferences_get",
    tool_name: "Get User Preferences",
    description: "Retrieve user preferences for presentation defaults",
    description_ar: "استرجاع تفضيلات المستخدم لإعدادات العروض الافتراضية",
    input_schema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] },
    output_schema: { type: "object", properties: { preferences: { type: "object" } } },
    required_permissions: ["preferences.read"],
    deterministic: true,
    evidence_hooks: [],
  },
  {
    tool_id: "slides.preferences_set",
    tool_name: "Set User Preferences",
    description: "Update user preferences for presentation defaults",
    description_ar: "تحديث تفضيلات المستخدم لإعدادات العروض الافتراضية",
    input_schema: { type: "object", properties: { user_id: { type: "string" }, preferences: { type: "object" } }, required: ["user_id", "preferences"] },
    output_schema: { type: "object", properties: { preferences: { type: "object" } } },
    required_permissions: ["preferences.write"],
    deterministic: true,
    evidence_hooks: ["audit.preferences_updated"],
  },
  {
    tool_id: "slides.catalog_search",
    tool_name: "Search Catalog",
    description: "Search catalogs for layouts, infographics, tables, charts, icons, motion, headers, backgrounds",
    description_ar: "البحث في الكتالوجات عن التخطيطات والإنفوجرافيك والجداول والرسوم البيانية والأيقونات والحركة والرؤوس والخلفيات",
    input_schema: { type: "object", properties: { catalog_kind: { type: "string", enum: ["layout", "infographic", "chart_skin", "table_style", "icon_pack", "motion_preset", "header_footer", "background"] }, query: { type: "string" }, tags: { type: "array", items: { type: "string" } }, density: { type: "string" }, tone: { type: "string" }, limit: { type: "number" } }, required: ["catalog_kind"] },
    output_schema: { type: "object", properties: { assets: { type: "array" }, total: { type: "number" }, has_more: { type: "boolean" } } },
    required_permissions: ["catalog.read"],
    deterministic: true,
    evidence_hooks: [],
  },
  {
    tool_id: "slides.variant_generate",
    tool_name: "Generate Variants",
    description: "Generate parametric variants from a base catalog asset (more like this / different direction)",
    description_ar: "توليد متغيرات بارامترية من أصل كتالوج أساسي (مشابه / اتجاه مختلف)",
    input_schema: { type: "object", properties: { base_asset_id: { type: "string" }, catalog_kind: { type: "string" }, direction: { type: "string", enum: ["more_like_this", "different_direction", "simpler", "more_complex"] }, count: { type: "number" }, seed: { type: "number" } }, required: ["base_asset_id", "catalog_kind", "direction"] },
    output_schema: { type: "object", properties: { variants: { type: "array" }, base_asset_id: { type: "string" }, direction: { type: "string" } } },
    required_permissions: ["catalog.read"],
    deterministic: true,
    evidence_hooks: [],
  },
  {
    tool_id: "slides.element_transform",
    tool_name: "Element Transform",
    description: "Apply a transformation to a slide element (change chart type, table style, icon pack, etc.)",
    description_ar: "تطبيق تحويل على عنصر شريحة (تغيير نوع الرسم البياني، نمط الجدول، حزمة الأيقونات، إلخ)",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, slide_ref: { type: "string" }, block_ref: { type: "string" }, transform_kind: { type: "string" }, params: { type: "object" } }, required: ["deck_id", "slide_ref", "block_ref", "transform_kind"] },
    output_schema: { type: "object", properties: { success: { type: "boolean" }, applied_params: { type: "object" }, preview_html: { type: "string" } } },
    required_permissions: ["presentations.write"],
    deterministic: true,
    evidence_hooks: ["audit.element_transformed"],
  },
  {
    tool_id: "slides.data_picker_browse",
    tool_name: "Browse Data Source",
    description: "Browse an Excel file to discover sheets, columns, tables, and preview rows",
    description_ar: "استعراض ملف Excel لاكتشاف الأوراق والأعمدة والجداول ومعاينة الصفوف",
    input_schema: { type: "object", properties: { file_path: { type: "string" }, sheet_name: { type: "string" } }, required: ["file_path"] },
    output_schema: { type: "object", properties: { file_path: { type: "string" }, sheets: { type: "array" } } },
    required_permissions: ["data.read"],
    deterministic: true,
    evidence_hooks: [],
  },
  {
    tool_id: "slides.data_binding_apply",
    tool_name: "Apply Data Binding",
    description: "Bind selected data to a table, chart, or KPI block",
    description_ar: "ربط البيانات المحددة بجدول أو رسم بياني أو بطاقة مؤشرات",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, slide_ref: { type: "string" }, block_ref: { type: "string" }, target_kind: { type: "string" }, data: { type: "object" } }, required: ["deck_id", "slide_ref", "block_ref", "target_kind", "data"] },
    output_schema: { type: "object", properties: { success: { type: "boolean" }, binding_id: { type: "string" }, embedded_data: { type: "object" } } },
    required_permissions: ["presentations.write", "data.read"],
    deterministic: true,
    evidence_hooks: ["audit.data_binding_applied"],
  },
  {
    tool_id: "slides.media_import",
    tool_name: "Import Media",
    description: "Import media from Drive, OneDrive, S3, or local filesystem",
    description_ar: "استيراد الوسائط من Drive أو OneDrive أو S3 أو نظام الملفات المحلي",
    input_schema: { type: "object", properties: { source: { type: "string", enum: ["local", "google_drive", "onedrive", "s3"] }, file_path: { type: "string" }, uri: { type: "string" }, mime_type: { type: "string" } }, required: ["source"] },
    output_schema: { type: "object", properties: { media_ref: { type: "string" }, file_name: { type: "string" }, mime_type: { type: "string" } } },
    required_permissions: ["media.import"],
    deterministic: true,
    evidence_hooks: ["audit.media_imported"],
  },
  {
    tool_id: "slides.video_embed",
    tool_name: "Embed Video",
    description: "Embed a video in a presentation slide with poster frame and playback settings",
    description_ar: "تضمين فيديو في شريحة عرض مع صورة معاينة وإعدادات التشغيل",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, slide_ref: { type: "string" }, video_path: { type: "string" }, poster_frame_path: { type: "string" }, start_time: { type: "number" }, playback: { type: "string", enum: ["on_click", "auto"] }, embed_mode: { type: "string", enum: ["embed", "link"] } }, required: ["deck_id", "slide_ref", "video_path"] },
    output_schema: { type: "object", properties: { success: { type: "boolean" }, video_ref: { type: "string" } } },
    required_permissions: ["presentations.write", "media.import"],
    deterministic: true,
    evidence_hooks: ["audit.video_embedded"],
  },
  {
    tool_id: "slides.preview_render",
    tool_name: "Preview Render",
    description: "Render preview frames for the presentation reader",
    description_ar: "عرض إطارات المعاينة لقارئ العرض",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, slide_refs: { type: "array", items: { type: "string" } } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { frames: { type: "array" }, reader_url: { type: "string" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: [],
  },
  {
    tool_id: "slides.reader_launch",
    tool_name: "Launch Reader",
    description: "Open the presentation reader as an overlay or new window",
    description_ar: "فتح قارئ العرض كطبقة علوية أو نافذة جديدة",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, mode: { type: "string", enum: ["overlay", "window"] }, start_slide: { type: "number" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { reader_url: { type: "string" }, session_id: { type: "string" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: ["audit.reader_launched"],
  },
  {
    tool_id: "slides.export_google_slides",
    tool_name: "Export to Google Slides",
    description: "Export a deck to Google Slides via API",
    description_ar: "تصدير عرض إلى Google Slides عبر API",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, oauth_token: { type: "string" }, title: { type: "string" } }, required: ["deck_id", "oauth_token"] },
    output_schema: { type: "object", properties: { presentation_id: { type: "string" }, url: { type: "string" }, evidence: { type: "object" } } },
    required_permissions: ["presentations.export", "google.slides"],
    deterministic: false,
    evidence_hooks: ["audit.exported_google_slides"],
  },
  {
    tool_id: "slides.export_pdf",
    tool_name: "Export to PDF",
    description: "Export a deck to PDF with RTL and parity validation",
    description_ar: "تصدير عرض إلى PDF مع دعم RTL والتحقق من التطابق",
    input_schema: { type: "object", properties: { deck_id: { type: "string" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { file_url: { type: "string" }, file_name: { type: "string" }, evidence: { type: "object" } } },
    required_permissions: ["presentations.export"],
    deterministic: true,
    evidence_hooks: ["audit.exported_pdf"],
  },
  {
    tool_id: "slides.export_html",
    tool_name: "Export to HTML",
    description: "Export a deck to a self-contained HTML player with animations and video playback",
    description_ar: "تصدير عرض إلى مشغل HTML مستقل مع حركات وتشغيل الفيديو",
    input_schema: { type: "object", properties: { deck_id: { type: "string" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { file_url: { type: "string" }, file_name: { type: "string" }, evidence: { type: "object" } } },
    required_permissions: ["presentations.export"],
    deterministic: true,
    evidence_hooks: ["audit.exported_html"],
  },
  {
    tool_id: "slides.parity_matrix_verify",
    tool_name: "Verify Parity Matrix",
    description: "Compare reader, PPTX, PDF, and HTML renders for visual parity",
    description_ar: "مقارنة عرض القارئ وPPTX وPDF وHTML للتطابق المرئي",
    input_schema: { type: "object", properties: { deck_id: { type: "string" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { overall_status: { type: "string" }, checks: { type: "array" }, deviations: { type: "array" } } },
    required_permissions: ["presentations.read"],
    deterministic: true,
    evidence_hooks: ["audit.parity_verified"],
  },
  {
    tool_id: "slides.evidence_pack_export",
    tool_name: "Export Evidence Pack",
    description: "Export a comprehensive evidence pack with all artifacts, validations, and audit records",
    description_ar: "تصدير حزمة أدلة شاملة مع جميع المنتجات والتحققات وسجلات التدقيق",
    input_schema: { type: "object", properties: { deck_id: { type: "string" }, include_screenshots: { type: "boolean" } }, required: ["deck_id"] },
    output_schema: { type: "object", properties: { evidence_pack_id: { type: "string" }, artifact_refs: { type: "array" }, file_url: { type: "string" } } },
    required_permissions: ["presentations.read", "evidence.export"],
    deterministic: true,
    evidence_hooks: ["audit.evidence_exported"],
  },
];

// ─── Literal Hash Verification (Section 3.1) ─────────────────────────────────

export const computeLiteralHash = (text: string): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
};

export const verifyLiteralFidelity = (inputText: string, outputText: string): { passed: boolean; hash_in: string; hash_out: string } => {
  const hashIn = computeLiteralHash(inputText);
  const hashOut = computeLiteralHash(outputText);
  return { passed: hashIn === hashOut, hash_in: hashIn, hash_out: hashOut };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
