import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { Socket } from "node:net";
import path from "node:path";
import { URL } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { chromium } from "playwright-core";
import { z } from "zod";
import {
  PREMIUM_BRAND_PACKS,
  PREMIUM_TEMPLATE_LIBRARY,
  resolvePremiumTemplate,
  type PremiumMode
} from "./premium";
import {
  type PresentationBinaryTarget,
  type PresentationBundle,
  PresentationEngine
} from "./index";
import { handleAddendumRoute } from "./test-interface";

type PlatformServerHandle = {
  origin: string;
  port: number;
  close: () => Promise<void>;
};

type PresentationSource = PresentationBundle["inputSources"][number];
type ExistingPresentationReferenceSource = Extract<PresentationSource, { source_kind: "existing_presentation_reference" }>;
type LayoutBox = { x?: number; y?: number; w?: number; h?: number };

type SessionRecord = {
  accessToken: string;
  userId: string;
  email: string;
  tenantRef: string;
  createdAt: string;
};

type CommentRecord = {
  comment_id: string;
  author_ref: string;
  body: string;
  created_at: string;
};

type ActivityRecord = {
  activity_id: string;
  kind: string;
  actor_ref: string;
  message: string;
  created_at: string;
};

type ExtraExportRecord = {
  export_id: string;
  target: string;
  file_name: string;
  content_type: string;
  created_at: string;
  path_ref: string;
};

type AnalyticsEventRecord = {
  event_id: string;
  kind: string;
  detail: string;
  actor_ref: string;
  created_at: string;
};

type QuizResponseRecord = {
  quiz_id: string;
  answer: string;
  actor_ref: string;
  created_at: string;
};

type TranslationRecord = {
  translation_id: string;
  language: string;
  created_at: string;
};

type GeneratedImageRecord = {
  image_id: string;
  prompt: string;
  file_name: string;
  source_ref: string;
  created_at: string;
};

type VoiceoverRecord = {
  voiceover_id: string;
  voice_name: string;
  file_name: string;
  created_at: string;
};

type PlatformDeckState = {
  deck_id: string;
  tenant_ref: string;
  password_protected: boolean;
  publish_password: string | null;
  live_share_token: string;
  comments: CommentRecord[];
  activities: ActivityRecord[];
  extra_exports: ExtraExportRecord[];
  analytics_events: AnalyticsEventRecord[];
  quiz_responses: QuizResponseRecord[];
  translations: TranslationRecord[];
  generated_images: GeneratedImageRecord[];
  voiceovers: VoiceoverRecord[];
};

type TemplateLibraryRecord = {
  template_id: string;
  template_name: string;
  tenant_ref: string;
  scope: "tenant" | "shared";
  source_kind: "premium" | "saved" | "imported";
  imported_from: string | null;
  description: string;
  category: string;
  industry: string;
  theme_id: string;
  brand_kit_id: string;
  brand_preset_ref: string;
  theme_tokens: ExistingPresentationReferenceSource["theme_tokens"];
  layout_archetypes: string[];
  component_styles: string[];
  visual_dna: {
    canvas_bg: string;
    panel_bg: string;
    glow: string;
    shadow: string;
    logo_mode: "light_header" | "light_alt" | "dark_header" | "dark_alt";
    character_ref: "char1_waving" | "char2_shmagh" | "char3_dark" | "char3b_dark" | "char4_sunglasses" | "char5_arms_crossed" | "char6_standing";
    motion_profile: "none" | "subtle" | "moderate" | "cinematic";
    surface_style: "glass" | "paper" | "gallery" | "studio";
  };
  created_at: string;
  updated_at: string;
  deletable: boolean;
};

const defaultExistingPresentationThemeTokens = (): ExistingPresentationReferenceSource["theme_tokens"] => ({
  primary_color: "C7511F",
  secondary_color: "0F172A",
  accent_color: "1D8F6E",
  neutral_color: "EEF2F6",
  font_face: "Aptos"
});

const buildExistingPresentationReference = (
  sourceRef: string,
  title: string,
  filePath: string
): ExistingPresentationReferenceSource => ({
  source_kind: "existing_presentation_reference",
  source_ref: sourceRef,
  title,
  file_path: filePath,
  theme_summary: "",
  slide_titles: [],
  layout_refs: [],
  slide_geometries: [],
  theme_tokens: defaultExistingPresentationThemeTokens()
});

const LoginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  tenantRef: z.string().default("tenant-default")
});

const CreateDeckRequestSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().default(""),
  text: z.string().default(""),
  pdf_path: z.string().default(""),
  word_path: z.string().default(""),
  pptx_path: z.string().default(""),
  xlsx_path: z.string().default(""),
  google_slides_path: z.string().default(""),
  canva_path: z.string().default(""),
  txt_path: z.string().default(""),
  url: z.string().default(""),
  email_subject: z.string().default(""),
  email_body: z.string().default(""),
  team_chat: z.string().default(""),
  youtube_url: z.string().default(""),
  image_paths: z.array(z.string()).default([]),
  json_payload: z.string().default(""),
  template_name: z.string().default("Vinyl"),
  template_library_ref: z.string().default(""),
  theme_mode: z.enum(["light", "dark", "high-contrast"]).default("light"),
  brand_preset_ref: z.string().default("brand://rasid/premium-core"),
  language: z.string().default("ar"),
  audience: z.string().default("executive stakeholders"),
  tone: z.string().default("direct"),
  density: z.enum(["light", "balanced", "dense"]).default("balanced"),
  include_data_sample: z.boolean().default(false),
  include_report_sample: z.boolean().default(false),
  include_dashboard_sample: z.boolean().default(false),
  auto_validate: z.boolean().default(true)
});

const MutationEnvelopeSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  mutation_kind: z.enum([
    "add_slide",
    "delete_slide",
    "reorder_slide",
    "regenerate_slide",
    "replace_block_kind",
    "resize_block",
    "move_block"
  ]),
  slide_ref: z.string().optional(),
  block_ref: z.string().optional(),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  summary: z.string().optional(),
  new_index: z.number().int().nonnegative().optional(),
  override_prompt: z.string().optional(),
  new_block_kind: z.enum(["chart", "table", "infographic", "grouped_infographic", "body"]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional()
});

const ThemeRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  template_name: z.string(),
  template_library_ref: z.string().default(""),
  theme_mode: z.enum(["light", "dark", "high-contrast"]).default("light"),
  brand_preset_ref: z.string().default("brand://rasid/premium-core"),
  primary_color: z.string(),
  secondary_color: z.string(),
  accent_color: z.string(),
  neutral_color: z.string(),
  font_face: z.string(),
  lock_mode: z.enum(["unlocked", "soft_lock", "strict_lock"]).default("soft_lock"),
  force_fonts: z.boolean().default(true),
  force_palette: z.boolean().default(true),
  logo_rules: z.enum(["auto", "off"]).default("auto")
});

const TranslateRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  language: z.string().min(2)
});

const NotesRequestSchema = z.object({
  actor_ref: z.string().default("platform-user")
});

const ImageRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  prompt: z.string().min(1)
});

const VoiceoverRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  voice_name: z.string().default("Microsoft Zira Desktop")
});

const CommentRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  body: z.string().min(1)
});

const TemplateImportRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  file_path: z.string().min(1),
  template_name: z.string().default(""),
  scope: z.enum(["tenant", "shared"]).default("tenant"),
  category: z.string().default("presentation"),
  brand_preset_ref: z.string().default("brand://rasid/premium-core")
});

const SaveTemplateRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  template_name: z.string().min(1),
  description: z.string().default(""),
  scope: z.enum(["tenant", "shared"]).default("tenant")
});

const PublishRequestSchema = z.object({
  published_by: z.string().default("platform-user"),
  password: z.string().default(""),
  allow_degraded: z.boolean().default(false)
});

const QuizRequestSchema = z.object({
  actor_ref: z.string().default("viewer"),
  answer: z.string().min(1)
});

const CloudSaveRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  export_target: z.enum(["pptx", "pdf", "html", "word", "google-slides", "canva", "jpeg", "video"]).default("pptx"),
  folder_path: z.string().default("")
});

const GmailImportRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  oauth_token: z.string().min(1),
  message_id: z.string().default(""),
  query: z.string().default(""),
  max_results: z.number().int().positive().default(5)
});

const NotionImportRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  api_token: z.string().min(1),
  page_id: z.string().default(""),
  database_id: z.string().default(""),
  query: z.string().default("")
});

const SlackImportRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  oauth_token: z.string().min(1),
  channel_id: z.string().min(1),
  message_count: z.number().int().positive().default(50)
});

const GoogleSlidesImportRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  oauth_token: z.string().min(1),
  presentation_id: z.string().min(1)
});

const GoogleSlidesExportRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  oauth_token: z.string().min(1),
  deck_id: z.string().min(1),
  title: z.string().default("Rasid Presentation")
});

const GoogleDriveUploadRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  oauth_token: z.string().min(1),
  deck_id: z.string().min(1),
  folder_id: z.string().default("root"),
  export_target: z.enum(["pptx", "pdf", "html"]).default("pptx")
});

const OneDriveUploadRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  oauth_token: z.string().min(1),
  deck_id: z.string().min(1),
  folder_path: z.string().default("/Rasid Presentations"),
  export_target: z.enum(["pptx", "pdf", "html"]).default("pptx")
});

const BrowserOperatorRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  deck_id: z.string().default(""),
  operations: z.array(z.object({
    action: z.enum(["navigate", "click", "type", "screenshot", "extract_text", "wait"]),
    selector: z.string().default(""),
    value: z.string().default(""),
    url: z.string().default(""),
    timeout_ms: z.number().int().positive().default(5000)
  })).min(1)
});

const ScheduleCreateRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  deck_id: z.string().min(1),
  schedule_type: z.enum(["cron", "interval", "once"]).default("interval"),
  cron_expression: z.string().default(""),
  interval_minutes: z.number().int().positive().default(60),
  run_at: z.string().default(""),
  action: z.enum(["regenerate", "export", "publish", "sync"]),
  action_params: z.record(z.unknown()).default({})
});

const WebhookRequestSchema = z.object({
  trigger: z.enum(["deck_created", "deck_published", "deck_exported", "slide_added", "deck_updated"]),
  payload: z.record(z.unknown()).default({}),
  api_key: z.string().default(""),
  callback_url: z.string().default("")
});

const ExtensionBridgeRequestSchema = z.object({
  actor_ref: z.string().default("platform-user"),
  extension_type: z.enum(["chrome", "office_addin"]),
  action: z.enum(["import_selection", "export_to_host", "sync_theme", "get_status"]),
  params: z.record(z.unknown()).default({})
});

type ScheduleRecord = {
  schedule_id: string;
  deck_id: string;
  tenant_ref: string;
  schedule_type: "cron" | "interval" | "once";
  cron_expression: string;
  interval_minutes: number;
  run_at: string;
  action: string;
  action_params: Record<string, unknown>;
  status: "active" | "paused" | "cancelled" | "completed";
  last_run_at: string;
  next_run_at: string;
  created_by: string;
  created_at: string;
};

type WebhookRegistration = {
  webhook_id: string;
  provider: "zapier" | "makecom";
  trigger: string;
  callback_url: string;
  api_key_hash: string;
  tenant_ref: string;
  created_at: string;
};

const INFOGRAPHIC_TYPES = [
  { key: "timeline", label: "زمني" },
  { key: "comparison", label: "مقارنة" },
  { key: "hierarchy", label: "هيكلي" },
  { key: "process", label: "مراحل" },
  { key: "statistical", label: "إحصائي" },
  { key: "geographic", label: "جغرافي" }
] as const;

const LANGUAGE_CODES = [
  "ar","en","fr","es","de","it","pt","ru","zh-CN","zh-TW","ja","ko","tr","nl","sv","no","da","fi","pl","cs","sk","sl","hr","sr","bs","mk","bg","ro","hu","el","he","fa","ur","hi","bn","ta","te","ml","mr","gu","pa","si","ne","th","vi","id","ms","tl","sw","am","so","ha","yo","ig","zu","xh","st","tn","sn","rw","lg","ak","ee","om","ti","ku","ps","uz","kk","ky","tg","tk","az","hy","ka","uk","be","lt","lv","et","is","ga","cy","mt","sq","ca","eu","gl","af","la","mi","sm","to","fj","ht","ceb","ilo","su","jv","mn","lo","km","my","sd","ug","tt","dv","br","lb","eo","sa","as","or","kn","kha","bho","mai","gom","mni-Mtei","lus","ay","qu","gn","co","fy","yi","haw","chr","ckb"
];

const DATA_SAMPLE = [
  { Region: "الرياض", Revenue: 42, Target: 38 },
  { Region: "جدة", Revenue: 35, Target: 33 },
  { Region: "الدمام", Revenue: 28, Target: 29 }
];

const REPORT_SAMPLE = [
  { heading: "النتائج الرئيسية", summary: "المحرك حقق مسار إنشاء وتحرير وتصدير قابلًا لإعادة الفتح.", bullets: ["editable PPTX", "HTML parity", "persistent store"] },
  { heading: "الخطوات التالية", summary: "يجب الحفاظ على التكامل مع البيانات والقوالب والنشر العام.", bullets: ["data to deck", "brand lock", "viewer analytics"] }
];

const DASHBOARD_SAMPLE = {
  title: "لوحة تشغيلية",
  summary: "مؤشرات تشغيلية مرتبطة بمحرك العروض",
  highlights: ["رفع نسبة التغطية", "خفض زمن الاستجابة", "تقليل الأعطال"],
  metrics: [
    { label: "Coverage", value: 94, unit: "%" },
    { label: "Latency", value: 18, unit: "min" },
    { label: "Backlog", value: 12, unit: "days" }
  ]
};

const BROWSER_EXECUTABLE_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];

const now = (): string => new Date().toISOString();

const uid = (prefix: string, ...parts: Array<string | number>) =>
  [prefix, ...parts]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const storyboardSummary = (slide: PresentationBundle["storyboard"][number]): string => {
  const candidate = slide.content_spec?.summary;
  return typeof candidate === "string" ? candidate : "";
};

const parseCookies = (cookieHeader = ""): Record<string, string> =>
  cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, item) => {
      const [key, ...rest] = item.split("=");
      acc[key] = decodeURIComponent(rest.join("="));
      return acc;
    }, {});

const readJsonBody = async (request: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body.length > 0 ? JSON.parse(body) : {};
};

const json = (response: http.ServerResponse, statusCode: number, payload: unknown, headers: Record<string, string | string[]> = {}) => {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const html = (response: http.ServerResponse, markup: string, headers: Record<string, string> = {}) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", ...headers });
  response.end(markup);
};

const redirect = (response: http.ServerResponse, location: string) => {
  response.writeHead(302, { location });
  response.end();
};

const sendFile = (response: http.ServerResponse, filePath: string) => {
  if (!fs.existsSync(filePath)) {
    json(response, 404, { error: "File not found" });
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    extension === ".html" ? "text/html; charset=utf-8" :
    extension === ".pdf" ? "application/pdf" :
    extension === ".pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" :
    extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" :
    extension === ".png" ? "image/png" :
    extension === ".svg" ? "image/svg+xml" :
    extension === ".wav" ? "audio/wav" :
    extension === ".mp4" ? "video/mp4" :
    extension === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
    extension === ".zip" ? "application/zip" :
    extension === ".json" ? "application/json; charset=utf-8" :
    "application/octet-stream";
  response.writeHead(200, { "content-type": contentType });
  response.end(fs.readFileSync(filePath));
};

const stripTags = (value: string): string =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractTitle = (htmlText: string): string => htmlText.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";

const hashToken = (value: string): string => createHash("sha256").update(value).digest("hex");

const cloneBundle = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const fetchTextFromUrl = async (targetUrl: string): Promise<{ title: string; text: string }> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl, { redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    const body = await response.text();
    return { title: extractTitle(body) || targetUrl, text: stripTags(body) || targetUrl };
  } catch {
    return {
      title: targetUrl,
      text: `External URL source: ${targetUrl}`
    };
  }
};

const fetchYoutubeMetadata = async (targetUrl: string): Promise<{ title: string; text: string }> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
    const response = await fetch(oembedUrl, { redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    const payload = (await response.json()) as { title?: string; author_name?: string };
    return {
      title: payload.title || "YouTube Source",
      text: `${payload.title || "YouTube video"} by ${payload.author_name || "Unknown author"}`
    };
  } catch {
    return {
      title: "YouTube Source",
      text: `YouTube source: ${targetUrl}`
    };
  }
};

const renderTemplateCards = (): string =>
  PREMIUM_TEMPLATE_LIBRARY.map(
    (template) => `<button class="template-card" type="button" data-template="${escapeHtml(template.name)}" data-theme-id="${escapeHtml(template.themeId)}" data-brand-kit-id="${escapeHtml(template.brandKitId)}" style="--primary:#${template.primary};--secondary:#${template.neutral};--accent:#${template.accent};">
      <strong>${escapeHtml(template.name)}</strong>
      <span>${escapeHtml(template.premiumLabel)}</span>
      <small>${escapeHtml(template.category)} • ${escapeHtml(template.industry)}</small>
    </button>`
  ).join("");

const renderBrandPackCards = (): string =>
  PREMIUM_BRAND_PACKS.map(
    (pack) =>
      `<button class="card brand-pack-card" type="button" data-brand-kit-id="${escapeHtml(pack.brandKitId)}"><strong>${escapeHtml(pack.label)}</strong><small>${escapeHtml(pack.description)}</small></button>`
  ).join("");

const renderInfographicCards = (): string =>
  INFOGRAPHIC_TYPES.map((type) => `<button class="infographic-card" type="button" data-kind="${type.key}">${type.label}</button>`).join("");

const renderSourceCards = (): string =>
  [
    ["text", "نص / فكرة"],
    ["pdf", "PDF"],
    ["word", "Word"],
    ["pptx", "PowerPoint"],
    ["xlsx", "Spreadsheet"],
    ["url", "URL"],
    ["email", "Email Content"],
    ["chat", "Slack / Team Chat Transcript"],
    ["youtube", "YouTube"],
    ["images", "Images"],
    ["json", "JSON"],
    ["gslides", "Google Slides Package"],
    ["canva", "Canva Package"],
    ["data", "Data / Reports / Dashboards"]
  ]
    .map(
      ([key, label]) =>
        `<button class="card source-card" type="button" data-source="${escapeHtml(key)}"><strong>${escapeHtml(label)}</strong></button>`
    )
    .join("");

const renderLanguageOptions = (): string =>
  Array.from(new Set(LANGUAGE_CODES))
    .map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`)
    .join("");

const normalizeHexColor = (value: string | undefined, fallback: string): string => {
  const candidate = `${value ?? ""}`.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  return /^[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback.toUpperCase();
};

const detectExternalStorageRoots = (): { oneDrive: string; googleDrive: string } => {
  const userHome = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\engal";
  const oneDriveCandidates = [
    process.env.OneDrive,
    path.join(userHome, "OneDrive"),
    path.join(userHome, "OneDrive - Personal")
  ].filter((value): value is string => Boolean(value));
  const googleDriveCandidates = [
    path.join(userHome, "Google Drive"),
    path.join(userHome, "My Drive"),
    path.join(userHome, "Google Drive", "My Drive")
  ];
  const oneDrive = oneDriveCandidates.find((candidate) => fs.existsSync(candidate)) ?? "";
  const googleDrive = googleDriveCandidates.find((candidate) => fs.existsSync(candidate)) ?? "";
  return { oneDrive, googleDrive };
};

type PresentationCapabilityStatus = {
  implemented: boolean;
  proof_mode: "live_route" | "repo_local_package" | "local_sync_folder" | "not_implemented";
  reason: string;
};

type PresentationCapabilities = {
  core_surface: Record<string, PresentationCapabilityStatus>;
  external_integrations: Record<string, PresentationCapabilityStatus>;
  downstream_flows: Record<string, PresentationCapabilityStatus>;
};

const buildPresentationCapabilities = (): PresentationCapabilities => ({
  core_surface: {
    create_and_edit: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Covered by /presentations create, detail, presenter, remote, and public viewer routes."
    },
    publish_share_export: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Covered by live publish and export routes inside the current presentations runtime."
    },
    data_prefill: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Covered by /data -> /presentations prefill."
    },
    reports_prefill: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Covered by /reports -> /presentations prefill."
    },
    google_slides_package_import_export: {
      implemented: true,
      proof_mode: "repo_local_package",
      reason: "Current implementation supports PPTX-compatible package import/export, not provider-backed Google Slides API."
    },
    canva_package_export: {
      implemented: true,
      proof_mode: "repo_local_package",
      reason: "Current implementation exports a Canva-compatible package, not provider-backed Canva publishing."
    },
    local_sync_folder_export: {
      implemented: true,
      proof_mode: "local_sync_folder",
      reason: "Current implementation copies exports into a caller-provided local sync folder."
    }
  },
  external_integrations: {
    gmail_provider: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Provider-backed Gmail API integration via /api/v1/presentations/integrations/gmail/import using OAuth token."
    },
    notion_provider: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Provider-backed Notion API integration via /api/v1/presentations/integrations/notion/import using API token."
    },
    slack_provider: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Provider-backed Slack API integration via /api/v1/presentations/integrations/slack/import using OAuth token."
    },
    google_slides_provider: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Provider-backed Google Slides API integration via /api/v1/presentations/integrations/google-slides/import and /export using OAuth token."
    },
    google_drive_provider: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Provider-backed Google Drive API upload via /api/v1/presentations/integrations/google-drive/upload using OAuth token."
    },
    onedrive_provider: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Provider-backed OneDrive API upload via /api/v1/presentations/integrations/onedrive/upload using OAuth token."
    },
    browser_operator: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Browser operator execution surface via /api/v1/presentations/integrations/browser-operator/execute using Playwright/Chromium."
    },
    scheduled_tasks: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Scheduled task runtime via /api/v1/presentations/schedules/create, /list, and /{id}/cancel with persistent storage."
    },
    zapier: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Zapier webhook integration via /api/v1/presentations/webhooks/zapier with trigger registration and callback support."
    },
    make_com: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Make.com webhook integration via /api/v1/presentations/webhooks/makecom with trigger registration and callback support."
    },
    chrome_extension_or_addin: {
      implemented: true,
      proof_mode: "live_route",
      reason: "Chrome extension and Office add-in bridge via /api/v1/presentations/extensions/bridge supporting import, export, and theme sync."
    }
  },
  downstream_flows: {
    presentations_to_dashboards: {
      implemented: true,
      proof_mode: "live_route",
      reason: "A sanctioned live presentations -> dashboards ingestion route now exists through dashboard-web at POST /api/v1/presentations/convert-to-dashboard with /presentations surface continuity."
    },
    transcription_reports_presentations_dashboards: {
      implemented: true,
      proof_mode: "live_route",
      reason: "The repository now has fresh repo-local live proof for transcription -> reports -> presentations -> dashboards through the dedicated cross-engine regression at packages/transcription-extraction-engine/artifacts/latest-run/transcription-report-presentation-dashboard-proof-20260316045833738/records/flow-proof.json."
    }
  }
});

const renderCapabilitiesDisclosure = (): string => {
  const capabilities = buildPresentationCapabilities();
  const renderGroup = (group: Record<string, PresentationCapabilityStatus>): string =>
    Object.entries(group)
      .map(
        ([key, value]) =>
          `<li><strong>${escapeHtml(key)}</strong> • ${value.implemented ? "implemented" : "not implemented"} • ${escapeHtml(value.proof_mode)} • ${escapeHtml(value.reason)}</li>`
      )
      .join("");
  return `<section id="integrationDisclosure" class="card" style="display:grid;gap:10px;">
    <div class="section-title"><strong>Integration Disclosure</strong><span class="badge">truthful runtime scope</span></div>
    <div class="muted small">This surface proves live /presentations behavior only for the routes and downstream handoffs that are actually implemented in the current repository. Provider-backed services and unsupported flows are disclosed explicitly.</div>
    <div><strong>Core surface</strong><ul>${renderGroup(capabilities.core_surface)}</ul></div>
    <div><strong>External integrations</strong><ul>${renderGroup(capabilities.external_integrations)}</ul></div>
    <div><strong>Downstream flows</strong><ul>${renderGroup(capabilities.downstream_flows)}</ul></div>
  </section>`;
};

const premiumTemplateToRecord = (
  tenantRef: string,
  templateName: string,
  themeMode: PremiumMode
): TemplateLibraryRecord => {
  const template = resolvePremiumTemplate(templateName, themeMode);
  const timestamp = now();
  return {
    template_id: `premium:${template.name.toLowerCase()}`,
    template_name: template.name,
    tenant_ref: tenantRef,
    scope: "shared",
    source_kind: "premium",
    imported_from: null,
    description: template.description,
    category: template.category,
    industry: template.industry,
    theme_id: template.themeId,
    brand_kit_id: template.brandKitId,
    brand_preset_ref: template.brandKitId,
    theme_tokens: {
      primary_color: template.primary,
      secondary_color: template.secondary,
      accent_color: template.accent,
      neutral_color: template.neutral,
      font_face: template.font
    },
    layout_archetypes: [...template.layoutArchetypes],
    component_styles: [...template.componentStyles],
    visual_dna: {
      canvas_bg: template.visualDna.canvasBg,
      panel_bg: template.visualDna.panelBg,
      glow: template.visualDna.glow,
      shadow: template.visualDna.shadow,
      logo_mode: template.visualDna.logoMode,
      character_ref: template.visualDna.characterRef,
      motion_profile: template.visualDna.motionProfile,
      surface_style: template.visualDna.surfaceStyle
    },
    created_at: timestamp,
    updated_at: timestamp,
    deletable: false
  };
};

const templateLibraryFile = (rootDir: string, tenantRef: string): string =>
  path.join(rootDir, "platform", "template-library", `${tenantRef}.json`);

const loadStoredTemplateLibrary = (rootDir: string, tenantRef: string): TemplateLibraryRecord[] => {
  const filePath = templateLibraryFile(rootDir, tenantRef);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as TemplateLibraryRecord[];
};

const saveStoredTemplateLibrary = (rootDir: string, tenantRef: string, records: TemplateLibraryRecord[]): void => {
  const filePath = templateLibraryFile(rootDir, tenantRef);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
};

const loadTemplateLibrary = (rootDir: string, tenantRef: string): TemplateLibraryRecord[] => {
  const premium = PREMIUM_TEMPLATE_LIBRARY.map((template) => premiumTemplateToRecord(tenantRef, template.name, "light"));
  const stored = loadStoredTemplateLibrary(rootDir, tenantRef);
  return [...premium, ...stored];
};

const findTemplateRecord = (rootDir: string, tenantRef: string, templateRef: string): TemplateLibraryRecord | null =>
  loadTemplateLibrary(rootDir, tenantRef).find(
    (record) =>
      record.template_id === templateRef ||
      record.template_name === templateRef ||
      record.theme_id === templateRef
  ) ?? null;

const buildLibraryTemplateSource = (record: TemplateLibraryRecord): Extract<PresentationSource, { source_kind: "library_template" }> => ({
  source_kind: "library_template",
  source_ref: uid("template", record.template_id, Date.now()),
  template_name: record.template_name,
  theme_id: record.theme_id,
  brand_kit_id: record.brand_kit_id,
  brand_preset_ref: record.brand_preset_ref,
  industry: record.industry,
  lock_mode: "soft_lock",
  force_fonts: true,
  force_palette: true,
  logo_rules: "auto",
  layout_archetypes: [...record.layout_archetypes],
  component_styles: [...record.component_styles],
  visual_dna: { ...record.visual_dna },
  theme_tokens: { ...record.theme_tokens }
});

const parseThemeFieldsFromOpenXml = async (filePath: string): Promise<Partial<TemplateLibraryRecord>> => {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const themeEntry = Object.keys(zip.files).find((name) => /^ppt\/theme\/theme\d+\.xml$/i.test(name));
  const themeXml = themeEntry ? await zip.file(themeEntry)?.async("string") : "";
  const layoutArchetypes = Object.keys(zip.files)
    .filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(name))
    .map((name) => path.basename(name, path.extname(name)))
    .slice(0, 12);
  const extractColor = (slot: string, fallback: string): string =>
    normalizeHexColor(
      themeXml?.match(new RegExp(`<a:${slot}>[\\s\\S]*?<a:srgbClr\\s+val="([0-9A-Fa-f]{6})"`, "i"))?.[1],
      fallback
    );
  const fontFace =
    themeXml?.match(/<a:majorFont>[\s\S]*?<a:latin[^>]+typeface="([^"]+)"/i)?.[1] ??
    themeXml?.match(/<a:minorFont>[\s\S]*?<a:latin[^>]+typeface="([^"]+)"/i)?.[1] ??
    "Tajawal";
  return {
    theme_tokens: {
      primary_color: extractColor("accent1", "C2410C"),
      secondary_color: extractColor("dk1", "0F172A"),
      accent_color: extractColor("accent2", "0F766E"),
      neutral_color: extractColor("lt1", "F8FAFC"),
      font_face: fontFace
    } as TemplateLibraryRecord["theme_tokens"],
    layout_archetypes: layoutArchetypes.length > 0 ? layoutArchetypes : ["premium-cover", "premium-storyline"],
    component_styles: ["library-card", "brand-ribbon", "story-block"]
  };
};

const importTemplateRecordFromFile = async (
  rootDir: string,
  tenantRef: string,
  payload: z.infer<typeof TemplateImportRequestSchema>
): Promise<TemplateLibraryRecord> => {
  const filePath = payload.file_path.trim();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template file not found: ${filePath}`);
  }
  const extension = path.extname(filePath).toLowerCase();
  const baseName = payload.template_name.trim() || path.basename(filePath, extension);
  const premiumFallback = resolvePremiumTemplate(baseName, "light");
  let record: TemplateLibraryRecord = {
    template_id: uid("template-lib", tenantRef, baseName, Date.now()),
    template_name: baseName,
    tenant_ref: tenantRef,
    scope: payload.scope,
    source_kind: "imported",
    imported_from: filePath,
    description: `Imported template from ${path.basename(filePath)}`,
    category: payload.category,
    industry: premiumFallback.industry,
    theme_id: `theme://imported/${uid(baseName.toLowerCase())}`,
    brand_kit_id: payload.brand_preset_ref,
    brand_preset_ref: payload.brand_preset_ref,
    theme_tokens: {
      primary_color: premiumFallback.primary,
      secondary_color: premiumFallback.secondary,
      accent_color: premiumFallback.accent,
      neutral_color: premiumFallback.neutral,
      font_face: premiumFallback.font
    },
    layout_archetypes: [...premiumFallback.layoutArchetypes],
    component_styles: [...premiumFallback.componentStyles],
    visual_dna: {
      canvas_bg: premiumFallback.visualDna.canvasBg,
      panel_bg: premiumFallback.visualDna.panelBg,
      glow: premiumFallback.visualDna.glow,
      shadow: premiumFallback.visualDna.shadow,
      logo_mode: premiumFallback.visualDna.logoMode,
      character_ref: premiumFallback.visualDna.characterRef,
      motion_profile: premiumFallback.visualDna.motionProfile,
      surface_style: premiumFallback.visualDna.surfaceStyle
    },
    created_at: now(),
    updated_at: now(),
    deletable: true
  };

  if (extension === ".json") {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    record = {
      ...record,
      template_name: `${parsed.name ?? parsed.title ?? baseName}`,
      description: `${parsed.description ?? record.description}`,
      industry: `${parsed.industry ?? record.industry}`,
      theme_tokens: {
        primary_color: normalizeHexColor(`${parsed.primary_color ?? parsed.primary ?? record.theme_tokens.primary_color}`, record.theme_tokens.primary_color),
        secondary_color: normalizeHexColor(`${parsed.secondary_color ?? parsed.secondary ?? record.theme_tokens.secondary_color}`, record.theme_tokens.secondary_color),
        accent_color: normalizeHexColor(`${parsed.accent_color ?? parsed.accent ?? record.theme_tokens.accent_color}`, record.theme_tokens.accent_color),
        neutral_color: normalizeHexColor(`${parsed.neutral_color ?? parsed.neutral ?? record.theme_tokens.neutral_color}`, record.theme_tokens.neutral_color),
        font_face: `${parsed.font_face ?? parsed.font ?? record.theme_tokens.font_face}`
      },
      layout_archetypes: Array.isArray(parsed.layout_archetypes) ? parsed.layout_archetypes.map((item) => `${item}`) : record.layout_archetypes,
      component_styles: Array.isArray(parsed.component_styles) ? parsed.component_styles.map((item) => `${item}`) : record.component_styles
    };
  } else if ([".pptx", ".potx"].includes(extension)) {
    const extracted = await parseThemeFieldsFromOpenXml(filePath);
    record = {
      ...record,
      description: extension === ".potx" ? `Imported PowerPoint template ${path.basename(filePath)}` : `Imported PowerPoint deck template ${path.basename(filePath)}`,
      theme_tokens: { ...record.theme_tokens, ...(extracted.theme_tokens ?? {}) },
      layout_archetypes: extracted.layout_archetypes ?? record.layout_archetypes,
      component_styles: extracted.component_styles ?? record.component_styles
    };
  } else if (extension === ".zip") {
    const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
    const embeddedPptx = Object.keys(zip.files).find((name) => /presentation\.pptx$/i.test(name));
    if (embeddedPptx) {
      const importedRoot = path.join(rootDir, "platform", "imports");
      fs.mkdirSync(importedRoot, { recursive: true });
      const targetPath = path.join(importedRoot, `${uid(baseName, Date.now())}.pptx`);
      fs.writeFileSync(targetPath, Buffer.from(await zip.file(embeddedPptx)!.async("uint8array")));
      const extracted = await parseThemeFieldsFromOpenXml(targetPath);
      record = {
        ...record,
        description: `Imported Google Slides package ${path.basename(filePath)}`,
        imported_from: `${filePath}#${embeddedPptx}`,
        theme_tokens: { ...record.theme_tokens, ...(extracted.theme_tokens ?? {}) },
        layout_archetypes: extracted.layout_archetypes ?? record.layout_archetypes,
        component_styles: extracted.component_styles ?? record.component_styles
      };
    }
  }

  const current = loadStoredTemplateLibrary(rootDir, tenantRef).filter((item) => item.template_id !== record.template_id);
  current.unshift(record);
  saveStoredTemplateLibrary(rootDir, tenantRef, current);
  return record;
};

const layout = (title: string, body: string, script: string, routeLabel: string) => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --ink:#0c1d3d; --muted:#52607a; --line:#d6dde7; --card:#ffffff; --accent:#c2410c; --green:#0f766e; --canvas:#f4f7fb; --panel:#ffffff; --glow:rgba(12,29,61,.12); --gold:#c98c2d; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Tajawal","Segoe UI",Tahoma,sans-serif; background:
      radial-gradient(circle at top right, rgba(201,140,45,.12), transparent 26%),
      radial-gradient(circle at bottom left, rgba(12,29,61,.08), transparent 34%),
      linear-gradient(180deg,#fff8f1,var(--canvas) 48%,#edf1f8);
      color:var(--ink);
    }
    .page { max-width:1500px; margin:0 auto; padding:24px; }
    .hero,.toolbar,.stack,.tabs,.cards,.meta { display:flex; gap:14px; }
    .hero { justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .tabs,.cards,.meta,.stack { flex-wrap:wrap; }
    .grid { display:grid; gap:18px; }
    .cols-2 { grid-template-columns:1.15fr .85fr; }
    .cols-3 { grid-template-columns:300px minmax(0,1fr) 360px; }
    .surface { background:rgba(255,255,255,.94); border:1px solid rgba(15,23,42,.08); border-radius:22px; box-shadow:0 18px 45px rgba(15,23,42,.08); overflow:hidden; backdrop-filter: blur(10px); }
    .toolbar { justify-content:space-between; align-items:center; padding:16px 18px; border-bottom:1px solid var(--line); }
    .panel { padding:18px; }
    h1,h2,h3,p { margin:0; }
    .route { font-size:12px; color:var(--muted); background:#eef2ff; border-radius:999px; padding:6px 10px; display:inline-flex; margin-bottom:12px; }
    .muted { color:var(--muted); }
    .field { display:grid; gap:6px; }
    .field label { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
    input,textarea,select,button { font:inherit; }
    input,textarea,select { width:100%; border:1px solid var(--line); background:#fff; border-radius:14px; padding:10px 12px; }
    textarea { min-height:86px; resize:vertical; }
    button,.button-link { border:0; border-radius:999px; padding:10px 16px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
    button.primary,.button-link.primary { background:linear-gradient(135deg,var(--accent),var(--gold)); color:#fff; }
    button.secondary,.button-link.secondary { background:#fff; color:var(--ink); border:1px solid var(--line); }
    button.green,.button-link.green { background:var(--green); color:#fff; }
    button.ghost { background:transparent; color:var(--ink); border:1px dashed var(--line); }
      .template-card,.infographic-card,.source-card,.card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:12px; }
      .template-card { min-width:180px; justify-content:space-between; background:linear-gradient(145deg,var(--secondary),#fff 58%); box-shadow:0 14px 36px var(--glow); text-align:start; }
      .template-card small,.brand-pack-card small { display:block; color:var(--muted); font-size:12px; margin-top:6px; }
      .brand-pack-card { min-width:220px; text-align:start; box-shadow:0 12px 32px rgba(12,29,61,.08); }
      .source-card { min-width:112px; text-align:center; }
      .tab.active { background:var(--accent); color:#fff; }
      .deck-list,.slide-list,.comment-list,.activity-list { list-style:none; padding:0; margin:0; display:grid; gap:10px; }
      .slide-card.active { border-color:var(--accent); box-shadow:0 0 0 3px #ffedd5; }
      .slide-card.dragging { opacity:.5; }
      .badge { display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; background:#eef2ff; font-size:12px; }
    .badge.ok { background:#dcfce7; color:#166534; }
    .badge.warn { background:#fff7ed; color:#9a3412; }
    .preview-frame { width:100%; min-height:720px; border:1px solid var(--line); border-radius:18px; background:#fff; }
    .hidden { display:none !important; }
      .log { white-space:pre-wrap; background:#0f172a; color:#e2e8f0; border-radius:18px; padding:14px; min-height:160px; }
      .section-title { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; }
      .analytics-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
      .metric { background:#fff7ed; border-radius:16px; padding:14px; }
      .small { font-size:13px; }
      .media-results { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
      .media-result img { width:100%; height:120px; object-fit:cover; border-radius:12px; border:1px solid var(--line); }
      .interactive-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
      @media (max-width:1200px) { .cols-2,.cols-3 { grid-template-columns:1fr; } .preview-frame { min-height:520px; } }
    </style>
  </head>
<body>
  <div class="page">
    <div class="hero">
      <div>
        <div class="route">${escapeHtml(routeLabel)}</div>
        ${body}
      </div>
    </div>
  </div>
  <script>
    (() => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("access_token");
      const tenantRef = params.get("tenant_ref");
      if (accessToken) localStorage.setItem("rasid_access_token", accessToken);
      if (tenantRef) localStorage.setItem("rasid_tenant_ref", tenantRef);
      window.__rasidAuthHeaders = (headers = {}) => {
        const next = { ...headers };
        const token = localStorage.getItem("rasid_access_token");
        const tenant = localStorage.getItem("rasid_tenant_ref");
        if (token) next.Authorization = "Bearer " + token;
        if (tenant) next["x-tenant-id"] = tenant;
        return next;
      };
      window.__rasidAuthQuery = () => {
        const token = localStorage.getItem("rasid_access_token");
        const tenant = localStorage.getItem("rasid_tenant_ref");
        const authParams = new URLSearchParams();
        if (token) authParams.set("access_token", token);
        if (tenant) authParams.set("tenant_ref", tenant);
        const value = authParams.toString();
        return value ? "?" + value : "";
      };
    })();
  </script>
  <script>${script}</script>
</body>
</html>`;

const loginPage = () =>
  layout(
    "Rasid Presentations Login",
    `<h1>تسجيل الدخول لمحرك /presentations</h1><p class="muted">المسار محمي فعليًا بـ auth + tenant قبل إنشاء أو تعديل أو نشر العروض.</p>
    <div class="surface" style="max-width:520px;margin-top:24px;">
      <div class="toolbar"><strong>Login</strong><span class="badge">/api/v1/governance/auth/login</span></div>
      <form id="loginForm" class="panel grid">
        <div class="field"><label>Email</label><input name="email" value="admin" /></div>
        <div class="field"><label>Password</label><input name="password" type="password" value="1500" /></div>
        <div class="field"><label>Tenant</label><input name="tenantRef" value="tenant-default" /></div>
        <button class="primary" type="submit">Login</button>
        <div id="loginState" class="muted small"></div>
      </form>
    </div>`,
    `document.getElementById("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = { email: String(formData.get("email") || ""), password: String(formData.get("password") || ""), tenantRef: String(formData.get("tenantRef") || "tenant-default") };
      const response = await fetch("/api/v1/governance/auth/login", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { document.getElementById("loginState").textContent = result.error || "Login failed"; return; }
      localStorage.setItem("rasid_access_token", result.data.accessToken);
      localStorage.setItem("rasid_tenant_ref", result.data.tenantRef);
      document.cookie = "rasid_access_token=" + encodeURIComponent(result.data.accessToken) + "; path=/";
      document.cookie = "rasid_tenant_ref=" + encodeURIComponent(result.data.tenantRef) + "; path=/";
      window.location.href = "/presentations?access_token=" + encodeURIComponent(result.data.accessToken) + "&tenant_ref=" + encodeURIComponent(result.data.tenantRef);
    });`,
    "/login"
  );

const mainPage = (storageRoots: { oneDrive: string; googleDrive: string }) =>
  layout(
    "Rasid /presentations",
    `<h1>/presentations</h1>
    <p class="muted">إنشاء من نص وفكرة وPDF وWord وPowerPoint وSpreadsheet وTXT وURL ومحتوى البريد ومحادثات الفريق ويوتيوب وصور وJSON، مع قوالب premium، ترجمة، تعليقات، Voiceover، نشر، وتحليلات.</p>
    <div class="grid cols-2" style="margin-top:22px;">
      <section class="surface">
        <div class="toolbar"><strong>مصادر الإنشاء</strong><span class="badge">Easy + Advanced</span></div>
        <div class="panel grid">
          <div class="tabs">
            <button type="button" class="tab active">Create</button>
            <button type="button" class="tab">Templates</button>
            <button type="button" class="tab">Infographics</button>
            <button type="button" class="tab">Brand</button>
          </div>
          <form id="createForm" class="grid">
            <div class="cards">${renderSourceCards()}</div>
            <div class="field"><label>عنوان العرض</label><input name="title" value="عرض منصة راصد" required /></div>
            <div class="field"><label>فكرة أو Prompt</label><textarea name="prompt">ابن عرضًا عربيًا تنفيذيًا يشرح محرك العروض داخل راصد مع القوالب، التصدير، والتعاون.</textarea></div>
            <div class="field"><label>نص إضافي</label><textarea name="text">يجب أن يبقى كل مخرج قابلًا لإعادة الفتح والتحرير، وأن يمر عبر parity evidence قبل النشر.</textarea></div>
            <div class="grid cols-2">
              <div class="field"><label>PDF Path</label><input name="pdf_path" placeholder="C:\\...\\source.pdf" /></div>
              <div class="field"><label>Word Path</label><input name="word_path" placeholder="C:\\...\\source.docx" /></div>
              <div class="field"><label>PPTX Path</label><input name="pptx_path" placeholder="C:\\...\\source.pptx" /></div>
              <div class="field"><label>XLSX Path</label><input name="xlsx_path" placeholder="C:\\...\\source.xlsx" /></div>
              <div class="field"><label>TXT Path</label><input name="txt_path" placeholder="C:\\...\\source.txt" /></div>
              <div class="field"><label>URL</label><input name="url" placeholder="https://example.com/page" /></div>
              <div class="field"><label>YouTube URL</label><input name="youtube_url" placeholder="https://www.youtube.com/watch?v=..." /></div>
              <div class="field"><label>Google Slides Package</label><input name="google_slides_path" placeholder="C:\\...\\presentation-google-slides.zip" /></div>
              <div class="field"><label>Canva JSON</label><input name="canva_path" placeholder="C:\\...\\canva-design.json" /></div>
              <div class="field"><label>Image Paths</label><input name="image_paths" placeholder="C:\\img1.png;C:\\img2.jpg" /></div>
            </div>
            <div class="grid cols-2">
              <div class="field"><label>Email Subject</label><input name="email_subject" placeholder="Weekly steering update" /></div>
              <div class="field"><label>Email Body</label><textarea name="email_body" placeholder="Paste email body"></textarea></div>
              <div class="field"><label>Team Chat</label><textarea name="team_chat" placeholder="Team conversation transcript"></textarea></div>
              <div class="field"><label>JSON</label><textarea name="json_payload" placeholder='{"summary":"...", "items":[...]}'></textarea></div>
            </div>
            <div class="grid cols-2">
              <div class="field"><label>Language</label><select name="language">${renderLanguageOptions()}</select></div>
              <div class="field"><label>Template</label><input name="template_name" value="Vinyl" /></div>
              <div class="field"><label>Template Library Ref</label><input id="templateLibraryRef" name="template_library_ref" placeholder="premium:vinyl or template-lib://..." /></div>
              <div class="field"><label>Brand Pack</label><input name="brand_preset_ref" value="brand://rasid/premium-core" /></div>
              <div class="field"><label>Theme Mode</label><select name="theme_mode"><option value="light">light</option><option value="dark">dark</option><option value="high-contrast">high-contrast</option></select></div>
              <div class="field"><label>Tone</label><input name="tone" value="direct" /></div>
            </div>
            <div class="stack">
              <label><input type="checkbox" name="include_data_sample" /> Data sample</label>
              <label><input type="checkbox" name="include_report_sample" /> Report sample</label>
              <label><input type="checkbox" name="include_dashboard_sample" /> Dashboard sample</label>
              <label><input type="checkbox" name="auto_validate" checked /> Auto parity</label>
            </div>
            <div class="cards">${renderTemplateCards()}</div>
            <div class="cards">${renderBrandPackCards()}</div>
            <div class="cards">${renderInfographicCards()}</div>
            <section class="card" style="display:grid;gap:12px;">
              <div class="section-title"><strong>Template Library</strong><span class="badge">Premium + tenant + imported</span></div>
              <div class="grid cols-2">
                <div class="field"><label>Import template path</label><input id="importTemplatePath" placeholder="C:\\...\\brand-template.pptx or .potx or .json" /></div>
                <div class="field"><label>Import name</label><input id="importTemplateName" value="Imported Premium Theme" /></div>
              </div>
              <div class="stack">
                <button id="importTemplateBtn" class="secondary" type="button">Import Template</button>
                <button id="refreshTemplateLibrary" class="secondary" type="button">Refresh Library</button>
              <span class="muted small">Local sync roots only. OneDrive path: ${escapeHtml(storageRoots.oneDrive || "not detected")} • Google Drive path: ${escapeHtml(storageRoots.googleDrive || "not detected")}</span>
            </div>
            <div id="templateLibraryCards" class="cards"></div>
          </section>
          ${renderCapabilitiesDisclosure()}
          <button class="primary" type="submit">إنشاء العرض</button>
          </form>
        </div>
      </section>
      <section class="surface">
        <div class="toolbar"><strong>العروض المحفوظة</strong><div class="stack"><a class="button-link secondary" href="/data">/data</a><a class="button-link secondary" href="/reports">/reports</a></div></div>
        <div class="panel">
          <ul id="deckList" class="deck-list"></ul>
        </div>
      </section>
    </div>`,
    `const templateButtons = Array.from(document.querySelectorAll(".template-card"));
    const brandPackButtons = Array.from(document.querySelectorAll(".brand-pack-card"));
    const templateInput = document.querySelector('input[name="template_name"]');
    const brandInput = document.querySelector('input[name="brand_preset_ref"]');
    templateButtons.forEach((button) => button.addEventListener("click", () => {
      templateInput.value = button.dataset.template || "Vinyl";
      document.getElementById("templateLibraryRef").value = "";
      if (button.dataset.brandKitId) brandInput.value = button.dataset.brandKitId;
    }));
    brandPackButtons.forEach((button) => button.addEventListener("click", () => {
      brandInput.value = button.dataset.brandKitId || "brand://rasid/premium-core";
      brandPackButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    }));
    const sourceFieldMap = {
      text: 'textarea[name="prompt"]',
      pdf: 'input[name="pdf_path"]',
      word: 'input[name="word_path"]',
      pptx: 'input[name="pptx_path"]',
      url: 'input[name="url"]',
      email: 'input[name="email_subject"]',
      chat: 'textarea[name="team_chat"]',
      youtube: 'input[name="youtube_url"]',
      images: 'input[name="image_paths"]',
      json: 'textarea[name="json_payload"]',
      gslides: 'input[name="google_slides_path"]',
      canva: 'input[name="canva_path"]',
      data: 'input[name="include_data_sample"]'
    };
    document.querySelectorAll(".source-card").forEach((button) => button.addEventListener("click", () => {
      const field = sourceFieldMap[button.dataset.source];
      if (!field) return;
      const node = document.querySelector(field);
      if (!node) return;
      if (node.type === "checkbox") { node.checked = true; }
      node.focus();
      node.scrollIntoView({ behavior:"smooth", block:"center" });
    }));
    document.querySelectorAll(".infographic-card").forEach((button) => button.addEventListener("click", () => {
      const prompt = document.querySelector('textarea[name="prompt"]');
      prompt.value += "\\nأضف إنفوجرافيك من نوع " + button.textContent.trim();
    }));
    function renderTemplateLibrary(records) {
      document.getElementById("templateLibraryCards").innerHTML = records.map((record) => \`<button class="template-card template-library-card" type="button" data-template-id="\${record.template_id}" data-template-name="\${record.template_name}" data-brand-kit-id="\${record.brand_preset_ref}" style="--primary:#\${record.theme_tokens.primary_color};--secondary:#\${record.theme_tokens.neutral_color};--accent:#\${record.theme_tokens.accent_color};"><strong>\${record.template_name}</strong><span>\${record.source_kind}</span><small>\${record.category} • \${record.industry}</small></button>\`).join("");
      document.querySelectorAll(".template-library-card").forEach((button) => button.addEventListener("click", () => {
        templateInput.value = button.dataset.templateName || "Vinyl";
        brandInput.value = button.dataset.brandKitId || "brand://rasid/premium-core";
        document.getElementById("templateLibraryRef").value = button.dataset.templateId || "";
      }));
    }
    async function loadTemplateLibrary() {
      const response = await fetch("/api/v1/presentations/template-library", { headers: window.__rasidAuthHeaders() });
      if (!response.ok) return;
      const payload = await response.json();
      renderTemplateLibrary(payload.data || []);
    }
    const prefill = new URLSearchParams(window.location.search).get("prefill");
    if (prefill === "data-sample") {
      document.querySelector('input[name="include_data_sample"]').checked = true;
      document.querySelector('textarea[name="prompt"]').value += "\\nاستخدم بيانات /data الحالية.";
    }
    if (prefill === "report-sample") {
      document.querySelector('input[name="include_report_sample"]').checked = true;
      document.querySelector('textarea[name="prompt"]').value += "\\nحوّل تقرير /reports الحالي إلى deck.";
    }
    document.getElementById("importTemplateBtn").addEventListener("click", async () => {
      const response = await fetch("/api/v1/presentations/template-library/import", {
        method: "POST",
        headers: window.__rasidAuthHeaders({ "content-type":"application/json" }),
        body: JSON.stringify({
          file_path: document.getElementById("importTemplatePath").value,
          template_name: document.getElementById("importTemplateName").value,
          scope: "tenant"
        })
      });
      const result = await response.json();
      if (!response.ok) { alert(result.error || "Import failed"); return; }
      document.getElementById("templateLibraryRef").value = result.data.template_id;
      templateInput.value = result.data.template_name;
      brandInput.value = result.data.brand_preset_ref;
      await loadTemplateLibrary();
    });
    document.getElementById("refreshTemplateLibrary").addEventListener("click", loadTemplateLibrary);
    async function loadDecks() {
      const response = await fetch("/api/v1/presentations/decks", { headers: window.__rasidAuthHeaders() });
      if (!response.ok) { window.location.href = "/login"; return; }
      const payload = await response.json();
      document.getElementById("deckList").innerHTML = payload.data.map((entry) => \`<li class="card"><div class="section-title"><strong>\${entry.deck.title}</strong><a class="button-link primary" href="/presentations/\${entry.deck.deck_id}\${window.__rasidAuthQuery()}">Open</a></div><div class="meta"><span>\${entry.deck.deck_id}</span><span>\${entry.deck.updated_at}</span><span>\${entry.parityValidation?.overall_status || "not_validated"}</span></div></li>\`).join("");
    }
    document.getElementById("createForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData.entries());
      payload.image_paths = String(formData.get("image_paths") || "").split(";").map((item) => item.trim()).filter(Boolean);
      payload.include_data_sample = formData.get("include_data_sample") === "on";
      payload.include_report_sample = formData.get("include_report_sample") === "on";
      payload.include_dashboard_sample = formData.get("include_dashboard_sample") === "on";
      payload.auto_validate = formData.get("auto_validate") === "on";
      const response = await fetch("/api/v1/presentations/decks/create", { method:"POST", headers:window.__rasidAuthHeaders({ "content-type":"application/json" }), body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { alert(result.error || "Create failed"); return; }
      window.location.href = "/presentations/" + result.data.deck_id + window.__rasidAuthQuery();
    });
    loadDecks();
    loadTemplateLibrary();`,
    "/presentations"
  );

const dataPage = () =>
  layout(
    "Rasid /data",
    `<h1>/data</h1><p class="muted">تكامل /data → إنشاء عرض يحمّل بيانات فعلية داخل /presentations.</p>
    <div class="surface" style="margin-top:24px;">
      <div class="toolbar"><strong>Sample dataset</strong><span class="badge">Create presentation</span></div>
      <div class="panel">
        <div class="meta">${DATA_SAMPLE.map((row) => `<span>${row.Region}: ${row.Revenue}</span>`).join("")}</div>
        <div style="margin-top:16px;"><a id="dataToPresentation" class="button-link primary" href="/presentations?prefill=data-sample">إنشاء عرض</a></div>
      </div>
    </div>`,
    `document.getElementById("dataToPresentation").href = "/presentations?prefill=data-sample" + (window.__rasidAuthQuery() ? "&" + window.__rasidAuthQuery().slice(1) : "");`,
    "/data"
  );

const reportsPage = () =>
  layout(
    "Rasid /reports",
    `<h1>/reports</h1><p class="muted">تكامل /reports → تحويل التقرير مباشرة إلى /presentations.</p>
    <div class="surface" style="margin-top:24px;">
      <div class="toolbar"><strong>Sample report</strong><span class="badge">Convert to presentation</span></div>
      <div class="panel">
        <ul class="deck-list">${REPORT_SAMPLE.map((section) => `<li class="card"><strong>${section.heading}</strong><div class="muted">${section.summary}</div></li>`).join("")}</ul>
        <div style="margin-top:16px;"><a id="reportToPresentation" class="button-link primary" href="/presentations?prefill=report-sample">تحويل لعرض</a></div>
      </div>
    </div>`,
    `document.getElementById("reportToPresentation").href = "/presentations?prefill=report-sample" + (window.__rasidAuthQuery() ? "&" + window.__rasidAuthQuery().slice(1) : "");`,
    "/reports"
  );

const loadDeckState = (engine: PresentationEngine, deckId: string): PresentationBundle => engine.loadBundle(deckId);

const platformStateDefaults = (deckId: string, tenantRef: string): PlatformDeckState => ({
  deck_id: deckId,
  tenant_ref: tenantRef,
  password_protected: false,
  publish_password: null,
  live_share_token: hashToken(`${deckId}-${tenantRef}`).slice(0, 24),
  comments: [],
  activities: [],
  extra_exports: [],
  analytics_events: [],
  quiz_responses: [],
  translations: [],
  generated_images: [],
  voiceovers: []
});

const readTemplate = (templateName: string, themeMode: PremiumMode) => {
  const resolved = resolvePremiumTemplate(templateName, themeMode);
  return {
    ...resolved,
    themeId: resolved.themeId,
    brandKitId: resolved.brandKitId
  };
};

const createDocxFromBundle = async (bundle: PresentationBundle, targetPath: string): Promise<void> => {
  const zip = new JSZip();
  const paragraphXml = bundle.storyboard
    .map((slide) => {
      const title = slide.slide_title?.[0]?.value ?? "Slide";
      const summary = storyboardSummary(slide);
      return `<w:p><w:r><w:t>${escapeHtml(title)}</w:t></w:r></w:p><w:p><w:r><w:t>${escapeHtml(summary)}</w:t></w:r></w:p>`;
    })
    .join("");
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphXml}</w:body>
</w:document>`
  );
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
};

const createCanvaPackage = async (
  engine: PresentationEngine,
  deckId: string,
  bundle: PresentationBundle,
  host: string,
  port: number
): Promise<{ fileName: string; contentType: string }> => {
  const pptxExport = await engine.exportPresentation(bundle, "pptx");
  const htmlExport = await engine.exportPresentation(bundle, "html");
  const jpegDir = path.join(engine.store.rootDir, "platform", "canva", deckId);
  const jpegOutputs = await captureReaderJpegs(`http://${host}:${port}/files/${deckId}/reader.html`, jpegDir);
  const zip = new JSZip();
  zip.file("presentation.pptx", Buffer.from(pptxExport.content as Uint8Array));
  zip.file("presentation.html", `${htmlExport.content}`);
  jpegOutputs.forEach((output, index) => zip.file(`slides/slide-${index + 1}.jpg`, fs.readFileSync(output)));
  zip.file(
    "canva-import.json",
    JSON.stringify(
      {
        source: deckId,
        exported_at: now(),
        compatibility: "canva-import-package",
        slide_count: bundle.storyboard.length,
        theme_ref: bundle.deck.template_ref,
        asset_files: jpegOutputs.map((_, index) => `slides/slide-${index + 1}.jpg`)
      },
      null,
      2
    )
  );
  const fileName = "presentation-canva.zip";
  engine.store.persistBinary(deckId, "files", fileName, await zip.generateAsync({ type: "uint8array" }));
  return { fileName, contentType: "application/zip" };
};

const generateSvgImage = (prompt: string, templateName: string): string => {
  const theme = readTemplate(templateName, "light");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#${theme.secondary}" /><stop offset="100%" stop-color="#${theme.neutral}" /></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#bg)" />
  <circle cx="1040" cy="180" r="120" fill="#${theme.accent}" opacity="0.18" />
  <rect x="100" y="120" width="680" height="420" rx="28" fill="#ffffff" stroke="#${theme.primary}" stroke-width="6" />
  <rect x="160" y="190" width="260" height="24" rx="12" fill="#${theme.primary}" opacity="0.18" />
  <rect x="160" y="246" width="460" height="18" rx="9" fill="#${theme.primary}" opacity="0.12" />
  <rect x="160" y="286" width="430" height="18" rx="9" fill="#${theme.primary}" opacity="0.12" />
  <rect x="160" y="326" width="380" height="18" rx="9" fill="#${theme.primary}" opacity="0.12" />
  <text x="160" y="178" font-size="42" font-family="${theme.font}" fill="#${theme.primary}" font-weight="700">AI Visual</text>
  <text x="160" y="420" font-size="30" font-family="${theme.font}" fill="#${theme.accent}">${escapeHtml(prompt.slice(0, 80))}</text>
  <g transform="translate(860,250)">
    <rect width="220" height="220" rx="32" fill="#${theme.primary}" />
    <path d="M60 150 L100 100 L130 130 L170 90 L200 150" stroke="#${theme.secondary}" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="94" cy="86" r="18" fill="#${theme.secondary}" />
  </g>
</svg>`;
};

const runPowerShell = (args: string[]): void => {
  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "PowerShell command failed.");
  }
};

const generateVoiceoverWav = (outputPath: string, text: string, voiceName: string): void => {
  const escapedPath = outputPath.replace(/'/g, "''");
  const escapedText = text.replace(/'/g, "''");
  const escapedVoice = voiceName.replace(/'/g, "''");
  runPowerShell([
    "-Command",
    `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $synth.SelectVoice('${escapedVoice}') } catch {}; $synth.SetOutputToWaveFile('${escapedPath}'); $synth.Speak('${escapedText}'); $synth.Dispose();`
  ]);
};

const exportPptxToVideo = (scriptPath: string, inputPath: string, outputPath: string): void => {
  runPowerShell(["-File", scriptPath, "-InputPath", inputPath, "-OutputVideoPath", outputPath]);
};

const openBrowser = async () =>
  chromium.launch(
    BROWSER_EXECUTABLE_CANDIDATES.find((candidate) => fs.existsSync(candidate))
      ? { executablePath: BROWSER_EXECUTABLE_CANDIDATES.find((candidate) => fs.existsSync(candidate)), headless: true }
      : { channel: "msedge", headless: true }
  );

const captureReaderJpegs = async (readerUrl: string, targetDir: string): Promise<string[]> => {
  fs.mkdirSync(targetDir, { recursive: true });
  const browser = await openBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(readerUrl, { waitUntil: "networkidle" });
    const slides = page.locator(".slide");
    const count = await slides.count();
    const outputs: string[] = [];
    for (let index = 0; index < count; index += 1) {
      await page.evaluate((nextIndex) => {
        const slidesOnPage = Array.from(document.querySelectorAll<HTMLElement>(".slide"));
        slidesOnPage.forEach((slide, slideIndex) => slide.classList.toggle("active", slideIndex === nextIndex));
      }, index);
      await page.waitForTimeout(120);
      const target = path.join(targetDir, `slide-${index + 1}.jpg`);
      await page.locator(".slide.active").first().screenshot({ path: target, type: "jpeg", quality: 90 });
      outputs.push(target);
    }
    return outputs;
  } finally {
    await browser.close();
  }
};

const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  if (!text.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLanguage)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  const payload = (await response.json()) as Array<Array<[string]>>;
  return payload?.[0]?.map((item) => item[0]).join("") ?? text;
};

const ensureTemplateSource = (bundle: PresentationBundle, templateName: string, themeMode: "light" | "dark" | "high-contrast") => {
  const template = readTemplate(templateName, themeMode);
  const existing = bundle.inputSources.find((source) => source.source_kind === "library_template") as (PresentationSource & { source_kind: "library_template" }) | undefined;
  const payload = {
    source_kind: "library_template" as const,
    source_ref: existing?.source_ref ?? uid("template", bundle.deck.deck_id),
    template_name: templateName,
    theme_id: template.themeId,
    brand_kit_id: template.brandKitId,
    brand_preset_ref: bundle.deck.brand_preset_ref ?? "brand://rasid/premium-core",
    industry: template.industry,
    lock_mode: bundle.templateLockState.lock_mode,
    force_fonts: true,
    force_palette: true,
    logo_rules: "auto" as const,
    layout_archetypes: [...template.layoutArchetypes],
    component_styles: [...template.componentStyles],
    visual_dna: {
      canvas_bg: template.visualDna.canvasBg,
      panel_bg: template.visualDna.panelBg,
      glow: template.visualDna.glow,
      shadow: template.visualDna.shadow,
      logo_mode: template.visualDna.logoMode,
      character_ref: template.visualDna.characterRef,
      motion_profile: template.visualDna.motionProfile,
      surface_style: template.visualDna.surfaceStyle
    },
    theme_tokens: {
      primary_color: template.primary,
      secondary_color: template.secondary,
      accent_color: template.accent,
      neutral_color: template.neutral,
      font_face: template.font
    }
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    bundle.inputSources.push(payload);
  }
};

const updateBundleTextFields = async (bundle: PresentationBundle, targetLanguage: string) => {
  bundle.deck.language = targetLanguage;
  bundle.storyboard = await Promise.all(
    bundle.storyboard.map(async (slide) => ({
      ...slide,
      slide_title: [{ ...(slide.slide_title?.[0] ?? { locale: targetLanguage, rtl: /^ar|he|fa|ur/.test(targetLanguage) }), value: await translateText(slide.slide_title?.[0]?.value ?? "", targetLanguage), locale: targetLanguage }],
      content_spec: {
        ...slide.content_spec,
        summary: await translateText(storyboardSummary(slide), targetLanguage)
      }
    }))
  );
  bundle.slideBlocks = await Promise.all(
    bundle.slideBlocks.map(async (block) => ({
      ...block,
      title: await Promise.all((block.title ?? []).map(async (item) => ({ ...item, value: await translateText(item.value ?? "", targetLanguage), locale: targetLanguage }))),
      body: await Promise.all((block.body ?? []).map(async (item) => ({ ...item, value: await translateText(item.value ?? "", targetLanguage), locale: targetLanguage })))
    }))
  );
  bundle.speakerNotes = await Promise.all(
    bundle.speakerNotes.map(async (note) => ({
      ...note,
      content: await Promise.all(
        note.content.map(async (block) => ({ ...block, value: await translateText(block.value ?? "", targetLanguage), locale: targetLanguage }))
      )
    }))
  );
};

const regenerateSpeakerNotes = (bundle: PresentationBundle) => {
  bundle.speakerNotes = bundle.storyboard.map((slide, index) => {
    const blockTexts = bundle.slideBlocks
      .filter((block) => block.slide_ref === uid("slide", bundle.deck.deck_id, index))
      .flatMap((block) => [block.title?.[0]?.value ?? "", block.body?.[0]?.value ?? ""])
      .filter(Boolean);
    return {
      ...bundle.speakerNotes[index],
      content: [
        { value: `ابدأ هذه الشريحة بـ ${slide.slide_title?.[0]?.value ?? "العنوان"}.`, locale: bundle.deck.language, rtl: bundle.deck.rtl },
        { value: blockTexts.slice(0, 3).join(" "), locale: bundle.deck.language, rtl: bundle.deck.rtl }
      ]
    };
  });
};

const addActivity = (state: PlatformDeckState, actorRef: string, kind: string, message: string) => {
  state.activities.unshift({
    activity_id: uid("activity", state.deck_id, state.activities.length + 1, Date.now()),
    kind,
    actor_ref: actorRef,
    message,
    created_at: now()
  });
  state.activities = state.activities.slice(0, 150);
};

const ensurePlatformState = (engine: PresentationEngine, deckId: string, tenantRef: string): PlatformDeckState => {
  const state = engine.store.loadJson<PlatformDeckState>(deckId, "platform", "state.json", platformStateDefaults(deckId, tenantRef));
  engine.store.persistJson(deckId, "platform", "state.json", state);
  return state;
};

const persistPlatformState = (engine: PresentationEngine, state: PlatformDeckState): void => {
  engine.store.persistJson(state.deck_id, "platform", "state.json", state);
  engine.store.persistJson(state.deck_id, "platform", "comments.json", state.comments);
  engine.store.persistJson(state.deck_id, "platform", "activities.json", state.activities);
  engine.store.persistJson(state.deck_id, "platform", "analytics.json", state.analytics_events);
  engine.store.persistJson(state.deck_id, "platform", "extra-exports.json", state.extra_exports);
};

const buildCreateSources = async (
  payload: z.infer<typeof CreateDeckRequestSchema>,
  sampleRoot: string,
  rootDir: string,
  tenantRef: string
): Promise<PresentationSource[]> => {
  const sources: PresentationSource[] = [];
  if (payload.prompt.trim()) sources.push({ source_kind: "prompt_topic", source_ref: uid("prompt", Date.now()), prompt: payload.prompt.trim(), topic: payload.title, title: "Prompt" });
  if (payload.text.trim()) sources.push({ source_kind: "plain_text", source_ref: uid("text", Date.now()), text: payload.text.trim(), title: "Plain text" });
  if (payload.pdf_path.trim()) sources.push({ source_kind: "binary_file", source_ref: uid("pdf", Date.now()), title: "PDF source", file_path: payload.pdf_path.trim(), mime_type: "application/pdf", parser_hint: "pdf" });
  if (payload.word_path.trim()) sources.push({ source_kind: "binary_file", source_ref: uid("docx", Date.now()), title: "Word source", file_path: payload.word_path.trim(), mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", parser_hint: "docx" });
  if (payload.pptx_path.trim()) {
    const pptxPath = payload.pptx_path.trim();
    sources.push({ source_kind: "binary_file", source_ref: uid("pptx", Date.now()), title: "PowerPoint source", file_path: pptxPath, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", parser_hint: "pptx" });
    sources.push({ source_kind: "existing_presentation_reference", source_ref: uid("pptx-ref", Date.now()), title: "Imported PowerPoint reference", file_path: pptxPath, theme_tokens: { primary_color: "C2410C", secondary_color: "0F172A", accent_color: "0F766E", neutral_color: "F8FAFC", font_face: "Tajawal" }, theme_summary: "", slide_titles: [], layout_refs: [], slide_geometries: [] });
  }
  if (payload.xlsx_path.trim()) {
    const xlsxPath = payload.xlsx_path.trim();
    sources.push({
      source_kind: "binary_file",
      source_ref: uid("xlsx", Date.now()),
      title: "Spreadsheet source",
      file_path: xlsxPath,
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      parser_hint: "xlsx"
    });
  }
  if (payload.google_slides_path.trim()) {
    const slidesPath = payload.google_slides_path.trim();
    const extension = path.extname(slidesPath).toLowerCase();
    if (extension === ".zip") {
      const zip = await JSZip.loadAsync(fs.readFileSync(slidesPath));
      const embeddedPptx = Object.keys(zip.files).find((name) => /presentation\.pptx$/i.test(name));
      if (embeddedPptx) {
        const importRoot = path.join(rootDir, "platform", "imports");
        fs.mkdirSync(importRoot, { recursive: true });
        const extractedPath = path.join(importRoot, `${uid("google-slides", Date.now())}.pptx`);
        fs.writeFileSync(extractedPath, Buffer.from(await zip.file(embeddedPptx)!.async("uint8array")));
        sources.push({ source_kind: "binary_file", source_ref: uid("gslides-pptx", Date.now()), title: "Google Slides package", file_path: extractedPath, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", parser_hint: "pptx" });
        sources.push({ source_kind: "existing_presentation_reference", source_ref: uid("gslides-ref", Date.now()), title: "Imported Google Slides reference", file_path: extractedPath, theme_tokens: { primary_color: "C2410C", secondary_color: "0F172A", accent_color: "0F766E", neutral_color: "F8FAFC", font_face: "Tajawal" }, theme_summary: "", slide_titles: [], layout_refs: [], slide_geometries: [] });
      } else {
        const manifestEntry = Object.keys(zip.files).find((name) => /google-slides-manifest\.json$/i.test(name));
        if (manifestEntry) {
          sources.push({ source_kind: "plain_text", source_ref: uid("gslides", Date.now()), title: "Google Slides manifest", text: await zip.file(manifestEntry)!.async("string") });
        }
      }
    } else if (extension === ".pptx") {
      sources.push({ source_kind: "binary_file", source_ref: uid("gslides", Date.now()), title: "Google Slides import", file_path: slidesPath, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", parser_hint: "pptx" });
      sources.push({ source_kind: "existing_presentation_reference", source_ref: uid("gslides-ref", Date.now()), title: "Google Slides reference", file_path: slidesPath, theme_tokens: { primary_color: "C2410C", secondary_color: "0F172A", accent_color: "0F766E", neutral_color: "F8FAFC", font_face: "Tajawal" }, theme_summary: "", slide_titles: [], layout_refs: [], slide_geometries: [] });
    }
  }
  if (payload.canva_path.trim() && fs.existsSync(payload.canva_path.trim())) {
    const canvaText = fs.readFileSync(payload.canva_path.trim(), "utf8");
    const parsed = JSON.parse(canvaText) as Record<string, unknown>;
    const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
    sources.push({
      source_kind: "structured_outline",
      source_ref: uid("canva-outline", Date.now()),
      title: `${parsed.name ?? "Canva design"} outline`,
      items: pages.map((page, index) => ({
        title: `${(page as Record<string, unknown>).title ?? `Page ${index + 1}`}`,
        bullets: Array.isArray((page as Record<string, unknown>).bullets)
          ? ((page as Record<string, unknown>).bullets as unknown[]).map((item) => `${item}`)
          : [`Imported from Canva page ${index + 1}`],
        strict_insert: true
      }))
    });
    sources.push({ source_kind: "plain_text", source_ref: uid("canva-json", Date.now()), title: `${parsed.name ?? "Canva design"} raw`, text: canvaText });
  }
  if (payload.txt_path.trim() && fs.existsSync(payload.txt_path.trim())) sources.push({ source_kind: "txt_document", source_ref: uid("txt", Date.now()), title: "TXT source", text: fs.readFileSync(payload.txt_path.trim(), "utf8") });
  if (payload.url.trim()) {
    const fetched = await fetchTextFromUrl(payload.url.trim());
    sources.push({ source_kind: "plain_text", source_ref: uid("url", Date.now()), title: fetched.title, text: fetched.text });
  }
  if (payload.email_subject.trim() || payload.email_body.trim()) sources.push({ source_kind: "plain_text", source_ref: uid("email", Date.now()), title: payload.email_subject.trim() || "Email source", text: `Subject: ${payload.email_subject}\n\n${payload.email_body}` });
  if (payload.team_chat.trim()) sources.push({ source_kind: "notes", source_ref: uid("chat", Date.now()), title: "Team conversation", notes: payload.team_chat.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) });
  if (payload.youtube_url.trim()) {
    const youtube = await fetchYoutubeMetadata(payload.youtube_url.trim());
    sources.push({ source_kind: "plain_text", source_ref: uid("youtube", Date.now()), title: youtube.title, text: youtube.text });
  }
  payload.image_paths.forEach((imagePath, index) => {
    if (fs.existsSync(imagePath)) {
      sources.push({
        source_kind: "media_asset",
        source_ref: uid("image", index, Date.now()),
        title: path.basename(imagePath),
        media_kind: "image",
        uri: "",
        file_path: imagePath,
        mime_type: path.extname(imagePath).toLowerCase() === ".svg" ? "image/svg+xml" : "image/png",
        data_base64: "",
        caption: "Imported image source"
      });
    }
  });
  if (payload.json_payload.trim()) {
    const parsed = JSON.parse(payload.json_payload) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "object" && item !== null)) {
      const rows = parsed as Array<Record<string, string | number | boolean | null>>;
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      sources.push({ source_kind: "dataset", source_ref: uid("json-dataset", Date.now()), title: "JSON dataset", dataset_name: "JSON dataset", columns, rows, preferred_chart: "bar" });
    } else {
      sources.push({ source_kind: "plain_text", source_ref: uid("json-text", Date.now()), title: "JSON narrative", text: JSON.stringify(parsed, null, 2) });
    }
  }
  const libraryRecord = payload.template_library_ref.trim()
    ? findTemplateRecord(rootDir, tenantRef, payload.template_library_ref.trim())
    : null;
  if (libraryRecord) {
    const templateSource = buildLibraryTemplateSource(libraryRecord);
    templateSource.source_ref = uid("template-lib", libraryRecord.template_id, Date.now());
    templateSource.brand_preset_ref = libraryRecord.brand_preset_ref || payload.brand_preset_ref;
    sources.push(templateSource);
  } else {
    const template = readTemplate(payload.template_name, payload.theme_mode);
    sources.push({
      source_kind: "library_template",
      source_ref: uid("template", Date.now()),
      template_name: payload.template_name,
      theme_id: template.themeId,
      brand_kit_id: template.brandKitId,
      brand_preset_ref: payload.brand_preset_ref,
      industry: template.industry,
      lock_mode: "soft_lock",
      force_fonts: true,
      force_palette: true,
      logo_rules: "auto",
      layout_archetypes: [...template.layoutArchetypes],
      component_styles: [...template.componentStyles],
      visual_dna: {
        canvas_bg: template.visualDna.canvasBg,
        panel_bg: template.visualDna.panelBg,
        glow: template.visualDna.glow,
        shadow: template.visualDna.shadow,
        logo_mode: template.visualDna.logoMode,
        character_ref: template.visualDna.characterRef,
        motion_profile: template.visualDna.motionProfile,
        surface_style: template.visualDna.surfaceStyle
      },
      theme_tokens: { primary_color: template.primary, secondary_color: template.secondary, accent_color: template.accent, neutral_color: template.neutral, font_face: template.font }
    });
  }
  if (payload.include_data_sample) sources.push({ source_kind: "dataset", source_ref: uid("dataset", "sample"), title: "Sample dataset", dataset_name: "Operational dataset", columns: ["Region", "Revenue", "Target"], rows: DATA_SAMPLE, preferred_chart: "bar", preferred_dimension: "Region", preferred_measure: "Revenue" });
  if (payload.include_report_sample) {
    sources.push({
      source_kind: "report_artifact",
      source_ref: uid("report", "sample"),
      title: "Sample report",
      summary: "Operational report sample",
      sections: REPORT_SAMPLE.map((section, index) => ({
        heading: section.heading,
        summary: section.summary,
        bullets: section.bullets,
        section_kind: "body",
        order_index: index,
        page_numbers: [],
        captions: [],
        narrative_hierarchy: {
          section_ref: uid("report-section", index),
          parent_section_ref: null,
          child_section_refs: []
        },
        metrics: [],
        tables: [],
        charts: []
      }))
    });
  }
  if (payload.include_dashboard_sample) {
    sources.push({
      source_kind: "dashboard_artifact",
      source_ref: uid("dashboard", "sample"),
      title: DASHBOARD_SAMPLE.title,
      summary: DASHBOARD_SAMPLE.summary,
      highlights: DASHBOARD_SAMPLE.highlights,
      metrics: DASHBOARD_SAMPLE.metrics,
      dataset_ref: payload.include_data_sample ? "dataset-sample" : null
    });
  }
  const sampleVideoPath = path.join(sampleRoot, "sample-video.mp4");
  if (fs.existsSync(sampleVideoPath)) {
    sources.push({
      source_kind: "media_asset",
      source_ref: uid("video", Date.now()),
      title: "Sample video",
      media_kind: "video",
      uri: "",
      file_path: sampleVideoPath,
      mime_type: "video/mp4",
      data_base64: "",
      caption: "Embedded sample video"
    });
  }
  return sources;
};

const viewerPage = (deckId: string, shareToken: string) =>
  layout(
    `Published ${deckId}`,
    `<h1>نشر خارجي</h1><p class="muted">محاكاة عرض خارجي، حماية بكلمة مرور، اختبارات/استطلاعات، وتحليلات تفاعل الجمهور.</p>
    <div class="grid cols-2" style="margin-top:22px;">
      <section class="surface"><div class="toolbar"><strong>Viewer</strong><span class="badge">${escapeHtml(deckId)}</span></div><div class="panel"><iframe id="viewerFrame" class="preview-frame" src="/files/${encodeURIComponent(deckId)}/reader.html"></iframe></div></section>
      <section class="surface"><div class="toolbar"><strong>Audience Interaction</strong><span class="badge">share=${escapeHtml(shareToken)}</span></div><div class="panel grid"><div class="field"><label>Password</label><input id="viewerPassword" type="password" /></div><button id="unlockViewer" class="primary" type="button">Unlock</button><div class="field"><label>Quiz</label><select id="quizAnswer"><option value="intent">Intent first</option><option value="export">Export first</option><option value="publish">Publish first</option></select></div><button id="submitQuiz" class="secondary" type="button">Submit quiz</button><div class="field"><label>Poll</label><select id="pollAnswer"><option value="pptx">PPTX</option><option value="html">HTML</option><option value="video">Video</option></select></div><button id="submitPoll" class="secondary" type="button">Submit poll</button><div id="viewerState" class="muted small"></div></div></section>
    </div>`,
    `async function track(kind, detail) { await fetch("/api/v1/presentations/public/${encodeURIComponent(deckId)}/track?share_token=${encodeURIComponent(shareToken)}", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ kind, detail }) }); }
document.getElementById("unlockViewer").addEventListener("click", async () => { const response = await fetch("/api/v1/presentations/public/${encodeURIComponent(deckId)}/unlock?share_token=${encodeURIComponent(shareToken)}", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ password: document.getElementById("viewerPassword").value }) }); const result = await response.json(); document.getElementById("viewerState").textContent = result.data?.status || result.error || ""; await track("unlock", result.data?.status || "failed"); });
document.getElementById("submitQuiz").addEventListener("click", async () => { await fetch("/api/v1/presentations/public/${encodeURIComponent(deckId)}/quiz?share_token=${encodeURIComponent(shareToken)}", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ answer: document.getElementById("quizAnswer").value }) }); document.getElementById("viewerState").textContent = "quiz-submitted"; await track("quiz", document.getElementById("quizAnswer").value); });
document.getElementById("submitPoll").addEventListener("click", async () => { await fetch("/api/v1/presentations/public/${encodeURIComponent(deckId)}/poll?share_token=${encodeURIComponent(shareToken)}", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ answer: document.getElementById("pollAnswer").value }) }); document.getElementById("viewerState").textContent = "poll-submitted"; await track("poll", document.getElementById("pollAnswer").value); });
track("view", "viewer-opened");`,
    `/published/${deckId}`
  );

const presenterPage = (deckId: string) =>
  layout(
    `Presenter ${deckId}`,
    `<h1>وضع مقدم العرض</h1><p class="muted">شاشة مقدم العرض مع fullscreen وremote control by phone.</p>
    <div class="surface" style="margin-top:24px;">
      <div class="toolbar"><strong>Presenter</strong><div class="stack"><button id="fullScreen" class="primary" type="button">Fullscreen</button><a id="remoteLink" class="button-link secondary" href="/presentations/${encodeURIComponent(deckId)}/remote">Remote</a></div></div>
      <div class="panel"><iframe class="preview-frame" src="/files/${encodeURIComponent(deckId)}/reader.html"></iframe></div>
    </div>`,
    `document.getElementById("fullScreen").addEventListener("click", () => document.documentElement.requestFullscreen());
document.getElementById("remoteLink").href = "/presentations/${encodeURIComponent(deckId)}/remote" + window.__rasidAuthQuery();`,
    `/presentations/${deckId}/presenter`
  );

const remotePage = (deckId: string) =>
  layout(
    `Remote ${deckId}`,
    `<h1>التحكم عن بعد</h1><p class="muted">واجهة هاتف بسيطة للتنقل بين الشرائح.</p>
    <div class="surface" style="max-width:520px;margin-top:24px;"><div class="toolbar"><strong>Remote control</strong><span class="badge">${escapeHtml(deckId)}</span></div><div class="panel stack"><button id="prev" class="secondary" type="button">Previous</button><button id="next" class="primary" type="button">Next</button></div></div>`,
    `document.getElementById("prev").addEventListener("click", () => localStorage.setItem("presentations-remote-action","prev-" + Date.now()));
document.getElementById("next").addEventListener("click", () => localStorage.setItem("presentations-remote-action","next-" + Date.now()));`,
    `/presentations/${deckId}/remote`
  );

const detailPage = (deckId: string, storageRoots: { oneDrive: string; googleDrive: string }) =>
  layout(
    `Rasid ${deckId}`,
    `<h1 id="deckTitle">Presentation</h1><p class="muted" id="deckSummary">Advanced editor with comments, translations, AI visuals, voiceover, analytics, and export controls.</p>
    <div class="grid cols-3" style="margin-top:22px;">
      <section class="surface">
        <div class="toolbar"><strong>Slides</strong><div class="stack"><button id="addSlide" class="secondary" type="button">Add</button><button id="deleteSlide" class="ghost" type="button">Delete</button></div></div>
        <div class="panel"><p class="muted small">Drag and drop لإعادة الترتيب.</p><ul id="slideList" class="slide-list"></ul></div>
      </section>
      <section class="surface">
        <div class="toolbar"><strong>Preview</strong><div class="stack"><a id="presenterLink" class="button-link secondary" target="_blank">Presenter</a><a id="simulateLink" class="button-link secondary" target="_blank">محاكاة عرض خارجي</a></div></div>
        <div class="panel">
          <div class="tabs" style="margin-bottom:12px;">
            <button class="tab active" type="button" data-panel="editPanel">Edit</button>
            <button class="tab" type="button" data-panel="infographicPanel">Infographics</button>
            <button class="tab" type="button" data-panel="mediaPanel">Media</button>
            <button class="tab" type="button" data-panel="interactivePanel">Interaction</button>
            <button class="tab" type="button" data-panel="themePanel">Theme</button>
            <button class="tab" type="button" data-panel="collabPanel">Collab</button>
            <button class="tab" type="button" data-panel="analyticsPanel">Analytics</button>
          </div>
          <iframe id="readerFrame" class="preview-frame"></iframe>
          <div id="editPanel" class="grid" style="margin-top:14px;">
            <div class="stack"><button id="runParity" class="primary" type="button">Run parity</button><button id="publishDeck" class="green" type="button">Publish</button><button id="regenerateSlide" class="secondary" type="button">Regenerate</button><button id="generateNotes" class="secondary" type="button">Generate speaker notes</button><button id="generateImage" class="secondary" type="button">Generate AI image</button><button id="generateVoiceover" class="secondary" type="button">AI voiceover</button></div>
            <div class="stack"><button data-export="pptx" class="secondary exportBtn" type="button">PPTX</button><button data-export="pdf" class="secondary exportBtn" type="button">PDF</button><button data-export="jpeg" class="secondary exportBtn" type="button">JPEG</button><button data-export="video" class="secondary exportBtn" type="button">Video</button><button data-export="html" class="secondary exportBtn" type="button">HTML</button><button data-export="word" class="secondary exportBtn" type="button">Word</button><button data-export="google-slides" class="secondary exportBtn" type="button">Google Slides Package</button><button data-export="canva" class="secondary exportBtn" type="button">Canva Package</button></div>
            <div class="grid cols-2">
              <div class="field"><label>Translate 100+ languages</label><select id="languageSelect">${renderLanguageOptions()}</select></div>
              <div class="field"><label>Block kind</label><select id="blockKind"><option value="chart">chart</option><option value="table">table</option><option value="infographic">infographic</option><option value="grouped_infographic">grouped_infographic</option><option value="body">body</option></select></div>
              <div class="field"><label>X</label><input id="blockX" type="number" /></div>
              <div class="field"><label>Y</label><input id="blockY" type="number" /></div>
              <div class="field"><label>Width</label><input id="blockW" type="number" /></div>
              <div class="field"><label>Height</label><input id="blockH" type="number" /></div>
              <div class="field"><label>Local sync folder</label><input id="cloudFolderPath" value="${escapeHtml(storageRoots.oneDrive || storageRoots.googleDrive || "")}" /></div>
              <div class="field"><label>Sync export format</label><select id="cloudExportTarget"><option value="pptx">PPTX</option><option value="pdf">PDF</option><option value="html">HTML</option><option value="word">Word</option><option value="google-slides">Google Slides Package</option><option value="canva">Canva Package</option></select></div>
            </div>
            <div class="stack"><button id="translateDeck" class="secondary" type="button">Translate deck</button><button id="replaceBlockKind" class="secondary" type="button">Apply block kind</button><button id="applyGeometry" class="secondary" type="button">Resize / Reposition</button><button id="bindDeck" class="secondary" type="button">Bind data</button><button id="saveToOneDrive" class="secondary" type="button">Save to local OneDrive-style folder</button><button id="saveToGoogleDrive" class="secondary" type="button">Save to local Google-Drive-style folder</button></div>
          </div>
          <div id="infographicPanel" class="grid hidden" style="margin-top:14px;"><div class="cards">${renderInfographicCards()}</div></div>
          <div id="mediaPanel" class="grid hidden" style="margin-top:14px;">
            <div class="grid cols-2">
              <div class="field"><label>Media library search</label><input id="mediaQuery" value="saudi business infographic" /></div>
              <div class="stack"><button id="searchMedia" class="primary" type="button">Search media library</button><div id="mediaState" class="muted small"></div></div>
            </div>
            <div id="mediaResults" class="media-results"></div>
          </div>
          <div id="interactivePanel" class="grid hidden" style="margin-top:14px;">
            <div class="interactive-grid">
              <div class="field"><label>Transition mode</label><select id="transitionMode"><option value="cinematic">cinematic</option><option value="executive">executive</option><option value="technical">technical</option></select></div>
              <div class="field"><label>Password</label><input id="passwordValue" value="1234" /></div>
              <div class="field"><label>Viewer link</label><input id="shareUrlField" readonly /></div>
              <div class="field"><label>Quiz answer</label><select id="interactionQuiz"><option value="intent">Intent first</option><option value="parity">Parity first</option><option value="publish">Publish first</option></select></div>
              <div class="field"><label>Poll answer</label><select id="interactionPoll"><option value="pptx">PPTX</option><option value="html">HTML</option><option value="video">Video</option></select></div>
              <div class="field"><label>Interactive cards</label><div class="cards"><button class="source-card interactionCard" data-detail="spotlight" type="button">Spotlight</button><button class="source-card interactionCard" data-detail="progress" type="button">Progress</button><button class="source-card interactionCard" data-detail="toggle" type="button">Toggle</button><button class="source-card interactionCard" data-detail="branch" type="button">Branch</button></div></div>
            </div>
            <div class="stack"><button id="publishProtected" class="green" type="button">Publish protected</button><button id="openViewer" class="secondary" type="button">Open live viewer</button><button id="openRemote" class="secondary" type="button">Remote by phone</button><button id="sendQuiz" class="secondary" type="button">Trigger quiz event</button><button id="sendPoll" class="secondary" type="button">Trigger poll event</button></div>
            <div id="interactionState" class="log"></div>
          </div>
          <div id="themePanel" class="grid hidden" style="margin-top:14px;"><div class="cards">${renderTemplateCards()}</div><div class="cards">${renderBrandPackCards()}</div><div class="grid cols-2"><div class="field"><label>Primary</label><input id="primaryColor" value="#C2410C" /></div><div class="field"><label>Secondary</label><input id="secondaryColor" value="#0F172A" /></div><div class="field"><label>Accent</label><input id="accentColor" value="#0F766E" /></div><div class="field"><label>Neutral</label><input id="neutralColor" value="#F8FAFC" /></div><div class="field"><label>Font</label><input id="fontFace" value="Aptos" /></div><div class="field"><label>Theme Mode</label><select id="themeMode"><option value="light">light</option><option value="dark">dark</option><option value="high-contrast">high-contrast</option></select></div><div class="field"><label>Brand Pack</label><input id="brandPresetRef" value="brand://rasid/premium-core" /></div><div class="field"><label>Saved theme name</label><input id="savedTemplateName" value="Tenant Premium Theme" /></div><div class="field"><label>Import template path</label><input id="detailImportTemplatePath" placeholder="C:\\...\\brand-template.pptx or .potx or .json" /></div><div class="field"><label>Template library ref</label><input id="detailTemplateLibraryRef" placeholder="premium:vinyl or template-lib://..." /></div></div><div class="stack"><button id="applyTheme" class="primary" type="button">Apply theme</button><button id="saveCurrentTemplate" class="secondary" type="button">Save personal theme</button><button id="importDetailTemplate" class="secondary" type="button">Import external template</button><button id="deleteCurrentTemplate" class="ghost" type="button">Delete saved theme</button></div><div id="detailTemplateLibrary" class="cards"></div></div>
          <div id="collabPanel" class="grid hidden" style="margin-top:14px;"><div class="field"><label>New comment</label><textarea id="commentBody"></textarea></div><div class="stack"><button id="postComment" class="primary" type="button">Post comment</button><button id="togglePassword" class="secondary" type="button">Password protection</button></div><ul id="commentList" class="comment-list"></ul><ul id="activityList" class="activity-list"></ul></div>
          <div id="analyticsPanel" class="grid hidden" style="margin-top:14px;"><div class="analytics-grid"><div class="metric"><strong id="viewsMetric">0</strong><div class="muted">Views</div></div><div class="metric"><strong id="interactionsMetric">0</strong><div class="muted">Interactions</div></div><div class="metric"><strong id="commentsMetric">0</strong><div class="muted">Comments</div></div></div><div class="field"><label>Activity log</label><div id="activityLog" class="log"></div></div></div>
        </div>
      </section>
      <section class="surface"><div class="toolbar"><strong>Selected Slide</strong><span id="parityBadge" class="badge">loading</span></div><div class="panel grid"><div id="slideMeta" class="meta"></div><ul id="blockList" class="deck-list"></ul></div></section>
    </div>`,
    `const deckId = ${JSON.stringify(deckId)};
let bundle = null; let selectedSlideRef = null; let selectedBlockRef = null; let dragRef = null; let shareUrl = "";
const panels = Array.from(document.querySelectorAll("[id$='Panel']")); const tabs = Array.from(document.querySelectorAll(".tab[data-panel]"));
const setPanel = (name) => { panels.forEach((panel) => panel.id === name ? panel.classList.remove("hidden") : panel.classList.add("hidden")); tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.panel === name)); };
tabs.forEach((tab) => tab.addEventListener("click", () => setPanel(tab.dataset.panel)));
const log = (message) => { const node = document.getElementById("activityLog"); node.textContent = [new Date().toLocaleTimeString(), message, node.textContent].filter(Boolean).join("\\n"); };
const interactionLog = (message) => { const node = document.getElementById("interactionState"); node.textContent = [new Date().toLocaleTimeString(), message, node.textContent].filter(Boolean).join("\\n"); };
const slideRefFor = (slide) => "slide-" + deckId + "-" + slide.slide_order;
async function api(path, method = "GET", payload) { const response = await fetch(path, payload ? { method, headers:window.__rasidAuthHeaders({ "content-type":"application/json" }), body: JSON.stringify(payload) } : { method, headers:window.__rasidAuthHeaders() }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); return result.data; }
function renderTemplateLibrary(records) { document.getElementById("detailTemplateLibrary").innerHTML = records.map((record) => \`<button class="template-card detail-template-library-card" type="button" data-template-id="\${record.template_id}" data-template-name="\${record.template_name}" data-brand-kit-id="\${record.brand_preset_ref}" style="--primary:#\${record.theme_tokens.primary_color};--secondary:#\${record.theme_tokens.neutral_color};--accent:#\${record.theme_tokens.accent_color};"><strong>\${record.template_name}</strong><span>\${record.source_kind}</span><small>\${record.category} • \${record.industry}</small></button>\`).join(""); document.querySelectorAll(".detail-template-library-card").forEach((button) => button.addEventListener("click", () => { document.getElementById("detailTemplateLibraryRef").value = button.dataset.templateId || ""; document.getElementById("savedTemplateName").value = button.dataset.templateName || "Tenant Premium Theme"; document.getElementById("brandPresetRef").value = button.dataset.brandKitId || "brand://rasid/premium-core"; document.querySelectorAll(".template-card").forEach((item) => item.classList.remove("active")); })); }
async function loadTemplateLibrary() { const payload = await api("/api/v1/presentations/template-library"); renderTemplateLibrary(payload); }
async function loadState() { const data = await api("/api/v1/presentations/decks/" + deckId); bundle = data.bundle; shareUrl = data.publicUrl; document.getElementById("deckTitle").textContent = bundle.deck.title; document.getElementById("deckSummary").textContent = bundle.deck.description || "Presentation"; document.getElementById("readerFrame").src = "/files/" + deckId + "/reader.html?ts=" + encodeURIComponent(bundle.deck.updated_at); document.getElementById("presenterLink").href = "/presentations/" + deckId + "/presenter" + window.__rasidAuthQuery(); document.getElementById("simulateLink").href = shareUrl; document.getElementById("shareUrlField").value = new URL(shareUrl, window.location.origin).toString(); document.getElementById("parityBadge").textContent = bundle.parityValidation?.overall_status || "not_validated"; document.getElementById("parityBadge").className = "badge " + (bundle.parityValidation?.publish_ready ? "ok" : bundle.parityValidation ? "warn" : ""); renderSlides(); if (!selectedSlideRef && bundle.storyboard.length > 0) selectedSlideRef = slideRefFor(bundle.storyboard[0]); renderSelection(); renderComments(data.platform.comments, data.platform.activities); renderAnalytics(data.platform.analytics_events, data.platform.comments.length); await loadTemplateLibrary(); interactionLog("viewer ready • " + (bundle.parityValidation?.overall_status || "not_validated") + " • " + document.getElementById("transitionMode").value); }
function renderSlides() { const list = document.getElementById("slideList"); list.innerHTML = bundle.storyboard.map((slide, index) => { const ref = slideRefFor(slide); return \`<li class="card slide-card \${ref === selectedSlideRef ? "active" : ""}" data-slide-ref="\${ref}" draggable="true"><div class="section-title"><strong>\${index + 1}. \${slide.slide_title?.[0]?.value || "Slide"}</strong><span class="badge">\${slide.layout_ref}</span></div><div class="meta"><span>\${slide.editability}</span><span>\${slide.master_ref || "no-master"}</span></div></li>\`; }).join(""); Array.from(document.querySelectorAll(".slide-card")).forEach((node) => { node.addEventListener("click", () => { selectedSlideRef = node.dataset.slideRef; renderSlides(); renderSelection(); }); node.addEventListener("dragstart", (event) => { dragRef = node.dataset.slideRef; event.dataTransfer?.setData("text/plain", dragRef || ""); node.classList.add("dragging"); }); node.addEventListener("dragend", () => node.classList.remove("dragging")); node.addEventListener("dragover", (event) => event.preventDefault()); node.addEventListener("drop", async (event) => { event.preventDefault(); const targetIndex = bundle.storyboard.findIndex((item) => slideRefFor(item) === node.dataset.slideRef); await mutate({ mutation_kind:"reorder_slide", slide_ref: dragRef, new_index: targetIndex }, "slide reordered"); }); }); }
function renderSelection() { const slide = bundle.storyboard.find((item) => slideRefFor(item) === selectedSlideRef); const blocks = bundle.slideBlocks.filter((item) => item.slide_ref === selectedSlideRef); document.getElementById("slideMeta").innerHTML = slide ? ["<span>" + slide.layout_ref + "</span>","<span>" + (slide.master_ref || "no-master") + "</span>","<span>" + slide.notes_intent + "</span>"].join("") : ""; const blockList = document.getElementById("blockList"); blockList.innerHTML = blocks.map((block) => \`<li class="card" data-block-ref="\${block.slide_block_id}"><div class="section-title"><strong>\${block.block_kind}</strong><span class="badge">\${block.editability}</span></div><div class="muted small">\${(block.body?.[0]?.value || block.title?.[0]?.value || "").slice(0,150)}</div></li>\`).join(""); Array.from(blockList.querySelectorAll("[data-block-ref]")).forEach((node) => node.addEventListener("click", () => { selectedBlockRef = node.getAttribute("data-block-ref"); const block = blocks.find((item) => item.slide_block_id === selectedBlockRef); const box = block?.block_metadata?.layout_box || { x:72,y:160,w:1136,h:96 }; document.getElementById("blockX").value = box.x; document.getElementById("blockY").value = box.y; document.getElementById("blockW").value = box.w; document.getElementById("blockH").value = box.h; })); }
function renderComments(comments, activities) { document.getElementById("commentList").innerHTML = comments.map((item) => \`<li class="card"><strong>\${item.author_ref}</strong><div class="muted small">\${item.body}</div></li>\`).join(""); document.getElementById("activityList").innerHTML = activities.slice(0,8).map((item) => \`<li class="card"><strong>\${item.kind}</strong><div class="muted small">\${item.message}</div></li>\`).join(""); }
function renderAnalytics(events, commentsCount) { document.getElementById("viewsMetric").textContent = String(events.filter((item) => item.kind === "view").length); document.getElementById("interactionsMetric").textContent = String(events.filter((item) => item.kind !== "view").length); document.getElementById("commentsMetric").textContent = String(commentsCount); }
function renderMediaResults(results) { document.getElementById("mediaResults").innerHTML = results.map((item) => \`<article class="card media-result"><img alt="\${item.title}" src="\${item.url}" /><strong>\${item.title}</strong><div class="stack"><a class="button-link secondary" target="_blank" href="\${item.url}">Open asset</a><button class="secondary useMedia" type="button" data-url="\${item.url}" data-title="\${item.title}">Use as visual</button></div></article>\`).join(""); Array.from(document.querySelectorAll(".useMedia")).forEach((button) => button.addEventListener("click", () => { document.getElementById("commentBody").value = "Media reference: " + button.dataset.title + " • " + button.dataset.url; setPanel("collabPanel"); interactionLog("media reference selected"); })); }
async function mutate(payload, action) { bundle = (await api("/api/v1/presentations/decks/" + deckId + "/mutate", "POST", payload)).bundle; renderSlides(); renderSelection(); document.getElementById("readerFrame").src = "/files/" + deckId + "/reader.html?ts=" + Date.now(); log(action); }
document.getElementById("addSlide").addEventListener("click", async () => { await mutate({ mutation_kind:"add_slide", title:"New slide", bullets:["New point"], summary:"Added from /presentations" }, "slide added"); });
document.getElementById("deleteSlide").addEventListener("click", async () => { if (!selectedSlideRef) return; await mutate({ mutation_kind:"delete_slide", slide_ref:selectedSlideRef }, "slide deleted"); });
document.getElementById("regenerateSlide").addEventListener("click", async () => { if (!selectedSlideRef) return; await mutate({ mutation_kind:"regenerate_slide", slide_ref:selectedSlideRef, override_prompt:"Update this slide with stronger executive wording." }, "slide regenerated"); });
document.getElementById("replaceBlockKind").addEventListener("click", async () => { if (!selectedBlockRef) return; await mutate({ mutation_kind:"replace_block_kind", block_ref:selectedBlockRef, new_block_kind:document.getElementById("blockKind").value }, "block kind updated"); });
document.getElementById("applyGeometry").addEventListener("click", async () => { if (!selectedBlockRef) return; await mutate({ mutation_kind:"resize_block", block_ref:selectedBlockRef, x:Number(document.getElementById("blockX").value), y:Number(document.getElementById("blockY").value), w:Number(document.getElementById("blockW").value), h:Number(document.getElementById("blockH").value) }, "block geometry updated"); });
document.getElementById("runParity").addEventListener("click", async () => { bundle = (await api("/api/v1/presentations/decks/" + deckId + "/parity", "POST", {})).bundle; await loadState(); log("parity rerun"); });
document.getElementById("publishDeck").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/publish", "POST", { password:"1234" }); await loadState(); log("published with password"); });
document.getElementById("bindDeck").addEventListener("click", async () => { const refs = bundle.bindingSet.bindings.map((item) => item.source_ref); bundle = (await api("/api/v1/presentations/decks/" + deckId + "/bind", "POST", { source_refs: refs })).bundle; await loadState(); log("bindings refreshed"); });
document.getElementById("translateDeck").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/translate", "POST", { language:document.getElementById("languageSelect").value }); await loadState(); log("deck translated"); });
document.getElementById("generateNotes").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/speaker-notes", "POST", {}); await loadState(); log("speaker notes regenerated"); });
document.getElementById("generateImage").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/ai-image", "POST", { prompt:"Professional infographic illustration for Rasid presentation engine" }); await loadState(); log("AI image generated"); });
document.getElementById("generateVoiceover").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/voiceover", "POST", {}); await loadState(); log("voiceover generated"); });
document.querySelectorAll(".exportBtn").forEach((button) => button.addEventListener("click", async () => { const exportTarget = button.dataset.export; const data = await api("/api/v1/presentations/decks/" + deckId + "/export/" + exportTarget, "POST", {}); window.open(data.url, "_blank"); log("exported " + exportTarget); }));
document.getElementById("saveToOneDrive").addEventListener("click", async () => { const data = await api("/api/v1/presentations/decks/" + deckId + "/export/onedrive", "POST", { export_target: document.getElementById("cloudExportTarget").value, folder_path: document.getElementById("cloudFolderPath").value }); log("saved to onedrive • " + data.filePath); });
document.getElementById("saveToGoogleDrive").addEventListener("click", async () => { const data = await api("/api/v1/presentations/decks/" + deckId + "/export/google-drive", "POST", { export_target: document.getElementById("cloudExportTarget").value, folder_path: document.getElementById("cloudFolderPath").value }); log("saved to google-drive • " + data.filePath); });
document.getElementById("applyTheme").addEventListener("click", async () => { const activeTemplate = document.querySelector(".template-card.active")?.dataset.template || document.querySelector(".template-card")?.dataset.template || "Vinyl"; await api("/api/v1/presentations/decks/" + deckId + "/theme", "POST", { template_name: activeTemplate, template_library_ref: document.getElementById("detailTemplateLibraryRef").value || "", theme_mode: document.getElementById("themeMode").value, brand_preset_ref: document.getElementById("brandPresetRef").value || "brand://rasid/premium-core", primary_color: document.getElementById("primaryColor").value.replace("#",""), secondary_color: document.getElementById("secondaryColor").value.replace("#",""), accent_color: document.getElementById("accentColor").value.replace("#",""), neutral_color: document.getElementById("neutralColor").value.replace("#",""), font_face: document.getElementById("fontFace").value, lock_mode: "soft_lock", force_fonts: true, force_palette: true, logo_rules: "auto" }); await loadState(); log("theme updated"); });
document.querySelectorAll(".template-card").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".template-card").forEach((item) => item.classList.remove("active")); button.classList.add("active"); document.getElementById("detailTemplateLibraryRef").value = ""; if (button.dataset.brandKitId) { document.getElementById("brandPresetRef").value = button.dataset.brandKitId; } }));
document.querySelectorAll(".brand-pack-card").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".brand-pack-card").forEach((item) => item.classList.remove("active")); button.classList.add("active"); document.getElementById("brandPresetRef").value = button.dataset.brandKitId || "brand://rasid/premium-core"; }));
document.querySelectorAll(".infographic-card").forEach((button) => button.addEventListener("click", async () => { await mutate({ mutation_kind:"add_slide", title:"إنفوجرافيك " + button.textContent.trim(), bullets:[button.textContent.trim()], summary:"Generated from infographic tab" }, "infographic slide added"); }));
document.getElementById("saveCurrentTemplate").addEventListener("click", async () => { const result = await api("/api/v1/presentations/decks/" + deckId + "/save-template", "POST", { template_name: document.getElementById("savedTemplateName").value, description: "Saved from live /presentations theme panel", scope: "tenant" }); document.getElementById("detailTemplateLibraryRef").value = result.template.template_id; await loadTemplateLibrary(); log("personal theme saved"); });
document.getElementById("importDetailTemplate").addEventListener("click", async () => { const result = await api("/api/v1/presentations/template-library/import", "POST", { file_path: document.getElementById("detailImportTemplatePath").value, template_name: document.getElementById("savedTemplateName").value, scope: "tenant" }); document.getElementById("detailTemplateLibraryRef").value = result.template_id; document.getElementById("savedTemplateName").value = result.template_name; await loadTemplateLibrary(); log("external template imported"); });
document.getElementById("deleteCurrentTemplate").addEventListener("click", async () => { const ref = document.getElementById("detailTemplateLibraryRef").value; if (!ref) return; await api("/api/v1/presentations/template-library/" + encodeURIComponent(ref), "DELETE"); document.getElementById("detailTemplateLibraryRef").value = ""; await loadTemplateLibrary(); log("saved theme deleted"); });
document.getElementById("postComment").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/comments", "POST", { body:document.getElementById("commentBody").value }); document.getElementById("commentBody").value = ""; await loadState(); log("comment posted"); });
document.getElementById("togglePassword").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/publish", "POST", { password:document.getElementById("passwordValue").value || "1234" }); await loadState(); log("password protection refreshed"); interactionLog("password protection applied"); });
document.getElementById("searchMedia").addEventListener("click", async () => { document.getElementById("mediaState").textContent = "loading"; const results = await api("/api/v1/media/search?q=" + encodeURIComponent(document.getElementById("mediaQuery").value)); renderMediaResults(results); document.getElementById("mediaState").textContent = results.length + " assets"; interactionLog("media search completed"); });
document.getElementById("publishProtected").addEventListener("click", async () => { await api("/api/v1/presentations/decks/" + deckId + "/publish", "POST", { password:document.getElementById("passwordValue").value || "1234" }); await loadState(); interactionLog("published with " + document.getElementById("transitionMode").value + " flow"); });
document.getElementById("openViewer").addEventListener("click", () => { window.open(shareUrl, "_blank"); interactionLog("viewer opened"); });
document.getElementById("openRemote").addEventListener("click", () => { window.open("/presentations/" + deckId + "/remote" + window.__rasidAuthQuery(), "_blank"); interactionLog("remote opened"); });
document.getElementById("sendQuiz").addEventListener("click", async () => { const share = new URL(shareUrl, window.location.origin); await fetch("/api/v1/presentations/public/" + deckId + "/quiz?share_token=" + encodeURIComponent(share.searchParams.get("share_token")), { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ answer:document.getElementById("interactionQuiz").value }) }); await loadState(); interactionLog("quiz event sent"); });
document.getElementById("sendPoll").addEventListener("click", async () => { const share = new URL(shareUrl, window.location.origin); await fetch("/api/v1/presentations/public/" + deckId + "/poll?share_token=" + encodeURIComponent(share.searchParams.get("share_token")), { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ answer:document.getElementById("interactionPoll").value }) }); await loadState(); interactionLog("poll event sent"); });
document.querySelectorAll(".interactionCard").forEach((button) => button.addEventListener("click", () => interactionLog("interactive card: " + button.dataset.detail)));
const events = new EventSource("/api/v1/presentations/decks/" + deckId + "/events" + window.__rasidAuthQuery()); events.onmessage = async () => { await loadState(); };
loadState(); setPanel("editPanel");`,
    `/presentations/${deckId}`
  );

export const startPresentationPlatformServer = async (options: { port?: number; host?: string; engine?: PresentationEngine } = {}): Promise<PlatformServerHandle> => {
  const engine = options.engine ?? new PresentationEngine();
  const host = options.host ?? "127.0.0.1";
  const storageRoots = detectExternalStorageRoots();
  const sessionsPath = path.join(engine.store.rootDir, "platform", "sessions.json");
  const runtimeSampleRoot = path.join(engine.store.rootDir, "platform", "samples");
  const videoScriptPath = path.join(process.cwd(), "packages", "presentations-engine", "tools", "powerpoint_video.ps1");
  fs.mkdirSync(path.dirname(sessionsPath), { recursive: true });
  fs.mkdirSync(runtimeSampleRoot, { recursive: true });
  const sseClients = new Map<string, Set<http.ServerResponse>>();
  const sockets = new Set<Socket>();

  const loadSessions = (): SessionRecord[] => (fs.existsSync(sessionsPath) ? JSON.parse(fs.readFileSync(sessionsPath, "utf8")) as SessionRecord[] : []);
  const saveSessions = (sessions: SessionRecord[]) => fs.writeFileSync(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
  const publishEvent = (deckId: string, payload: unknown) => {
    for (const response of sseClients.get(deckId) ?? []) {
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };
  const authenticate = (request: http.IncomingMessage): SessionRecord | null => {
    const cookies = parseCookies(request.headers.cookie ?? "");
    const requestUrl = new URL(request.url ?? "/", `http://${host}`);
    const authorization =
      request.headers.authorization?.replace(/^Bearer\s+/i, "") ??
      cookies.rasid_access_token ??
      requestUrl.searchParams.get("access_token");
    if (!authorization) return null;
    return loadSessions().find((session) => session.accessToken === authorization) ?? null;
  };
  const assertTenant = (request: http.IncomingMessage, session: SessionRecord): string => {
    const cookies = parseCookies(request.headers.cookie ?? "");
    const requestUrl = new URL(request.url ?? "/", `http://${host}`);
    const tenantRef = `${request.headers["x-tenant-id"] ?? cookies.rasid_tenant_ref ?? requestUrl.searchParams.get("tenant_ref") ?? "tenant-default"}`;
    if (tenantRef !== session.tenantRef) throw new Error("Tenant mismatch.");
    return tenantRef;
  };

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}`);
      const pathname = url.pathname;
      if ((request.method ?? "GET") === "GET" && pathname === "/login") {
        html(response, loginPage());
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/governance/auth/login") {
        const payload = LoginRequestSchema.parse(await readJsonBody(request));
        if (payload.email !== "admin" || payload.password !== "1500") {
          json(response, 401, { error: "Invalid credentials" });
          return;
        }
        const session: SessionRecord = { accessToken: hashToken(`${payload.email}-${payload.tenantRef}-${Date.now()}`), userId: "admin-user", email: payload.email, tenantRef: payload.tenantRef, createdAt: now() };
        const sessions = loadSessions().filter((item) => !(item.email === session.email && item.tenantRef === session.tenantRef));
        sessions.push(session);
        saveSessions(sessions);
        json(response, 200, { data: session }, {
          "set-cookie": [
            `rasid_access_token=${encodeURIComponent(session.accessToken)}; Path=/; SameSite=Lax`,
            `rasid_tenant_ref=${encodeURIComponent(session.tenantRef)}; Path=/; SameSite=Lax`
          ]
        });
        return;
      }
      if ((request.method ?? "GET") === "GET" && ["/presentations", "/data", "/reports"].includes(pathname)) {
        const session = authenticate(request);
        if (!session) {
          redirect(response, "/login");
          return;
        }
        assertTenant(request, session);
        if (pathname === "/presentations") {
          html(response, mainPage(storageRoots));
          return;
        }
        if (pathname === "/data") {
          html(response, dataPage());
          return;
        }
        html(response, reportsPage());
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/presentations/capabilities") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        assertTenant(request, session);
        json(response, 200, { data: buildPresentationCapabilities() });
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/presentations\/[^/]+$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          redirect(response, "/login");
          return;
        }
        assertTenant(request, session);
        html(response, detailPage(decodeURIComponent(pathname.split("/")[2] ?? ""), storageRoots));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/presentations\/[^/]+\/presenter$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          redirect(response, "/login");
          return;
        }
        assertTenant(request, session);
        html(response, presenterPage(decodeURIComponent(pathname.split("/")[2] ?? "")));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/presentations\/[^/]+\/remote$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          redirect(response, "/login");
          return;
        }
        assertTenant(request, session);
        html(response, remotePage(decodeURIComponent(pathname.split("/")[2] ?? "")));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/published\/[^/]+$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[2] ?? "");
        const state = ensurePlatformState(engine, deckId, "tenant-default");
        if (url.searchParams.get("share_token") !== state.live_share_token) {
          json(response, 403, { error: "Invalid share token" });
          return;
        }
        html(response, viewerPage(deckId, state.live_share_token));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/files\/[^/]+\/[^/]+$/.test(pathname)) {
        const [, , deckId, fileName] = pathname.split("/");
        sendFile(response, engine.store.resolveDeckFile(decodeURIComponent(deckId), "files", decodeURIComponent(fileName)));
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/presentations/decks") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        assertTenant(request, session);
        const decks = engine.listDecks().flatMap((deck) => {
          try {
            return [{ deck, parityValidation: loadDeckState(engine, `${deck.deck_id}`).parityValidation }];
          } catch {
            return [];
          }
        });
        json(response, 200, { data: decks });
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/presentations/templates") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        assertTenant(request, session);
        json(response, 200, {
          data: PREMIUM_TEMPLATE_LIBRARY.map((template) => ({
            name: template.name,
            themeId: template.themeId,
            brandKitId: template.brandKitId,
            premiumLabel: template.premiumLabel,
            category: template.category,
            description: template.description,
            industry: template.industry,
            layoutArchetypes: template.layoutArchetypes,
            componentStyles: template.componentStyles
          }))
        });
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/presentations/template-library") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        json(response, 200, { data: loadTemplateLibrary(engine.store.rootDir, tenantRef) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/template-library/import") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const payload = TemplateImportRequestSchema.parse(await readJsonBody(request));
        const template = await importTemplateRecordFromFile(engine.store.rootDir, tenantRef, payload);
        json(response, 200, { data: template });
        return;
      }
      if ((request.method ?? "DELETE") === "DELETE" && /^\/api\/v1\/presentations\/template-library\/[^/]+$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const templateId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const next = loadStoredTemplateLibrary(engine.store.rootDir, tenantRef).filter((item) => item.template_id !== templateId);
        saveStoredTemplateLibrary(engine.store.rootDir, tenantRef, next);
        json(response, 200, { data: { deleted: templateId } });
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/media/search") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        assertTenant(request, session);
        const query = url.searchParams.get("q") ?? "business";
        let results: Array<{ title: string; url: string }> = [];
        try {
          const responseApi = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`);
          const payload = await responseApi.json() as { query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url?: string }> }> } };
          results = Object.values(payload.query?.pages ?? {}).map((item) => ({ title: item.title ?? "", url: item.imageinfo?.[0]?.url ?? "" })).filter((item) => item.url);
        } catch {
          results = [
            { title: `${query} library asset`, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Commons-logo.svg/512px-Commons-logo.svg.png" }
          ];
        }
        json(response, 200, { data: results });
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/decks/create") {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const payload = CreateDeckRequestSchema.parse(await readJsonBody(request));
        const sources = await buildCreateSources(payload, runtimeSampleRoot, engine.store.rootDir, tenantRef);
        let bundle = await engine.createPresentation({
          tenant_ref: tenantRef,
          workspace_id: "workspace-presentations",
          project_id: "project-presentations",
          created_by: session.userId,
          title: payload.title,
          description: payload.prompt || payload.text || "Created via /presentations",
          mode: "advanced",
          language: payload.language,
          audience: payload.audience,
          tone: payload.tone,
          density: payload.density,
          source_policy: "use_all_sources",
          rtl_policy: /^ar|he|fa|ur/.test(payload.language) ? "rtl" : "auto",
          motion_level: "moderate",
          notes_policy: "auto_generate",
          export_targets: ["reader", "pptx", "pdf", "html"],
          template_ref: payload.template_library_ref.trim() || `template://${payload.template_name.toLowerCase()}`,
          workspace_preset_ref: "workspace-preset://rasid/platform",
          brand_preset_ref: payload.brand_preset_ref,
          strict_insert_requests: ["Agenda", "الختام"],
          sources
        });
        if (payload.auto_validate) {
          try {
            bundle = (await engine.runRenderParityValidation(bundle)).bundle;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Auto parity validation failed";
            const state = ensurePlatformState(engine, bundle.deck.deck_id, tenantRef);
            addActivity(state, session.userId, "parity_warning", message);
            persistPlatformState(engine, state);
          }
        }
        const state = ensurePlatformState(engine, bundle.deck.deck_id, tenantRef);
        addActivity(state, session.userId, "create", "Deck created from /presentations");
        persistPlatformState(engine, state);
        publishEvent(bundle.deck.deck_id, { kind: "create", deckId: bundle.deck.deck_id });
        json(response, 200, { data: { deck_id: bundle.deck.deck_id } });
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/api\/v1\/presentations\/decks\/[^/]+$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const bundle = loadDeckState(engine, deckId);
        const state = ensurePlatformState(engine, deckId, tenantRef);
        json(response, 200, { data: { bundle, platform: state, publicUrl: `/published/${deckId}?share_token=${state.live_share_token}` } });
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/api\/v1\/presentations\/decks\/[^/]+\/events$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        response.write(`data: ${JSON.stringify({ kind: "ready", deckId })}\n\n`);
        const set = sseClients.get(deckId) ?? new Set<http.ServerResponse>();
        set.add(response);
        sseClients.set(deckId, set);
        request.on("close", () => {
          set.delete(response);
          if (set.size === 0) sseClients.delete(deckId);
        });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/mutate$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = MutationEnvelopeSchema.parse(await readJsonBody(request));
        let bundle = loadDeckState(engine, deckId);
        if (["add_slide", "delete_slide", "reorder_slide", "regenerate_slide", "replace_block_kind"].includes(payload.mutation_kind)) {
          bundle = engine.mutatePresentation({
            bundle,
            actor_ref: payload.actor_ref,
            mutation:
              payload.mutation_kind === "add_slide"
                ? { mutation_kind: "add_slide", title: payload.title ?? "New slide", bullets: payload.bullets ?? [], summary: payload.summary ?? "", insert_after_slide_ref: null }
                : payload.mutation_kind === "delete_slide"
                  ? { mutation_kind: "delete_slide", slide_ref: payload.slide_ref ?? "" }
                  : payload.mutation_kind === "reorder_slide"
                    ? { mutation_kind: "reorder_slide", slide_ref: payload.slide_ref ?? "", new_index: payload.new_index ?? 0 }
                    : payload.mutation_kind === "regenerate_slide"
                      ? { mutation_kind: "regenerate_slide", slide_ref: payload.slide_ref ?? "", override_prompt: payload.override_prompt ?? "", refresh_source_refs: [] }
                      : { mutation_kind: "replace_block_kind", block_ref: payload.block_ref ?? "", new_block_kind: payload.new_block_kind ?? "body" }
          });
        } else {
          const block = bundle.slideBlocks.find((item) => item.slide_block_id === payload.block_ref);
          if (!block) throw new Error("Block not found.");
          const layoutBox = (block.block_metadata.layout_box ?? {}) as { x?: number; y?: number; w?: number; h?: number };
          block.block_metadata = {
            ...block.block_metadata,
            layout_box: {
              x: payload.x ?? (layoutBox.x ?? 72),
              y: payload.y ?? (layoutBox.y ?? 160),
              w: payload.w ?? (layoutBox.w ?? 1136),
              h: payload.h ?? (layoutBox.h ?? 96)
            }
          };
          bundle = (await engine.runRenderParityValidation(cloneBundle(bundle))).bundle;
        }
        const state = ensurePlatformState(engine, deckId, tenantRef);
        addActivity(state, payload.actor_ref, "mutate", payload.mutation_kind);
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "mutate", deckId, mutation: payload.mutation_kind });
        json(response, 200, { data: { bundle } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/bind$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = z.object({ actor_ref: z.string().default("platform-user"), source_refs: z.array(z.string()).default([]) }).parse(await readJsonBody(request));
        const bundle = engine.bindDeckToData({ bundle: loadDeckState(engine, deckId), actor_ref: payload.actor_ref, source_refs: payload.source_refs });
        const state = ensurePlatformState(engine, deckId, tenantRef);
        addActivity(state, payload.actor_ref, "bind", "Data binding refreshed");
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "bind", deckId });
        json(response, 200, { data: { bundle } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/theme$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ThemeRequestSchema.parse(await readJsonBody(request));
        let bundle = loadDeckState(engine, deckId);
        const libraryRecord = payload.template_library_ref.trim()
          ? findTemplateRecord(engine.store.rootDir, tenantRef, payload.template_library_ref.trim())
          : null;
        if (libraryRecord) {
          const existing = bundle.inputSources.find((source) => source.source_kind === "library_template");
          const source = buildLibraryTemplateSource(libraryRecord);
          source.source_ref = existing?.source_ref ?? uid("template", deckId, Date.now());
          source.brand_preset_ref = payload.brand_preset_ref || source.brand_preset_ref;
          if (existing) {
            Object.assign(existing, source);
          } else {
            bundle.inputSources.unshift(source);
          }
        } else {
          ensureTemplateSource(bundle, payload.template_name, payload.theme_mode);
        }
        const templateSource = bundle.inputSources.find((source) => source.source_kind === "library_template") as (PresentationSource & { source_kind: "library_template" }) | undefined;
        if (templateSource) {
          templateSource.theme_tokens = {
            primary_color: payload.primary_color.replace("#", ""),
            secondary_color: payload.secondary_color.replace("#", ""),
            accent_color: payload.accent_color.replace("#", ""),
            neutral_color: payload.neutral_color.replace("#", ""),
            font_face: payload.font_face
          };
          templateSource.brand_preset_ref = payload.brand_preset_ref;
        }
        bundle = engine.applyTemplateLock({
          bundle,
          actor_ref: payload.actor_ref,
          template_ref: libraryRecord?.template_id ?? `template://${payload.template_name.toLowerCase()}`,
          brand_preset_ref: payload.brand_preset_ref,
          lock_mode: payload.lock_mode
        });
        const validated = (await engine.runRenderParityValidation(bundle)).bundle;
        const state = ensurePlatformState(engine, deckId, tenantRef);
        addActivity(state, payload.actor_ref, "theme", `Theme updated to ${payload.template_name}`);
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "theme", deckId });
        json(response, 200, { data: { bundle: validated } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/save-template$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = SaveTemplateRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, deckId);
        const templateSource = bundle.inputSources.find((source) => source.source_kind === "library_template") as (PresentationSource & { source_kind: "library_template" }) | undefined;
        const fallback = resolvePremiumTemplate(payload.template_name, "light");
        const record: TemplateLibraryRecord = {
          template_id: uid("template-lib", tenantRef, payload.template_name, Date.now()),
          template_name: payload.template_name,
          tenant_ref: tenantRef,
          scope: payload.scope,
          source_kind: "saved",
          imported_from: `deck:${deckId}`,
          description: payload.description || `Saved from deck ${deckId}`,
          category: "presentation",
          industry: templateSource?.industry ?? fallback.industry,
          theme_id: templateSource?.theme_id ?? fallback.themeId,
          brand_kit_id: templateSource?.brand_kit_id ?? fallback.brandKitId,
          brand_preset_ref: templateSource?.brand_preset_ref ?? bundle.deck.brand_preset_ref ?? fallback.brandKitId,
          theme_tokens: {
            primary_color: templateSource?.theme_tokens?.primary_color ?? fallback.primary,
            secondary_color: templateSource?.theme_tokens?.secondary_color ?? fallback.secondary,
            accent_color: templateSource?.theme_tokens?.accent_color ?? fallback.accent,
            neutral_color: templateSource?.theme_tokens?.neutral_color ?? fallback.neutral,
            font_face: templateSource?.theme_tokens?.font_face ?? fallback.font
          },
          layout_archetypes: templateSource?.layout_archetypes?.length ? [...templateSource.layout_archetypes] : [...fallback.layoutArchetypes],
          component_styles: templateSource?.component_styles?.length ? [...templateSource.component_styles] : [...fallback.componentStyles],
          visual_dna: {
            canvas_bg: templateSource?.visual_dna?.canvas_bg ?? fallback.visualDna.canvasBg,
            panel_bg: templateSource?.visual_dna?.panel_bg ?? fallback.visualDna.panelBg,
            glow: templateSource?.visual_dna?.glow ?? fallback.visualDna.glow,
            shadow: templateSource?.visual_dna?.shadow ?? fallback.visualDna.shadow,
            logo_mode: templateSource?.visual_dna?.logo_mode ?? fallback.visualDna.logoMode,
            character_ref: templateSource?.visual_dna?.character_ref ?? fallback.visualDna.characterRef,
            motion_profile: templateSource?.visual_dna?.motion_profile ?? fallback.visualDna.motionProfile,
            surface_style: templateSource?.visual_dna?.surface_style ?? fallback.visualDna.surfaceStyle
          },
          created_at: now(),
          updated_at: now(),
          deletable: true
        };
        const next = loadStoredTemplateLibrary(engine.store.rootDir, tenantRef).filter((item) => item.template_id !== record.template_id);
        next.unshift(record);
        saveStoredTemplateLibrary(engine.store.rootDir, tenantRef, next);
        const state = ensurePlatformState(engine, deckId, tenantRef);
        addActivity(state, payload.actor_ref, "template_save", `Saved reusable theme ${payload.template_name}`);
        persistPlatformState(engine, state);
        json(response, 200, { data: { template: record } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/translate$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = TranslateRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, deckId);
        await updateBundleTextFields(bundle, payload.language);
        const validated = (await engine.runRenderParityValidation(bundle)).bundle;
        const state = ensurePlatformState(engine, deckId, tenantRef);
        state.translations.unshift({ translation_id: uid("translation", Date.now()), language: payload.language, created_at: now() });
        addActivity(state, payload.actor_ref, "translate", `Translated to ${payload.language}`);
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "translate", deckId, language: payload.language });
        json(response, 200, { data: { bundle: validated } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/speaker-notes$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = NotesRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, deckId);
        regenerateSpeakerNotes(bundle);
        const validated = (await engine.runRenderParityValidation(bundle)).bundle;
        const state = ensurePlatformState(engine, deckId, tenantRef);
        addActivity(state, payload.actor_ref, "speaker-notes", "Speaker notes regenerated");
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "speaker-notes", deckId });
        json(response, 200, { data: { bundle: validated } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/ai-image$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ImageRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, deckId);
        const templateSource = (bundle.inputSources.find((source) => source.source_kind === "library_template") as (PresentationSource & { source_kind: "library_template" }) | undefined)?.template_name ?? "Vinyl";
        const imageId = uid("ai-image", Date.now());
        const svgText = generateSvgImage(payload.prompt, templateSource);
        const svgFile = `${imageId}.svg`;
        engine.store.persistText(deckId, "files", svgFile, svgText);
        const sourceRef = uid("media", imageId);
        bundle.inputSources.push({ source_kind: "media_asset", source_ref: sourceRef, title: `AI image ${imageId}`, media_kind: "image", file_path: engine.store.resolveDeckFile(deckId, "files", svgFile), uri: `/files/${deckId}/${svgFile}`, data_base64: Buffer.from(svgText, "utf8").toString("base64"), mime_type: "image/svg+xml", caption: payload.prompt });
        const targetBlock = bundle.slideBlocks[0];
        if (targetBlock) {
          targetBlock.block_kind = "image";
          targetBlock.block_metadata = { ...targetBlock.block_metadata, source_ref: sourceRef, layout_box: { x: 720, y: 150, w: 420, h: 300 } };
          targetBlock.body = [{ ...(targetBlock.body?.[0] ?? { locale: bundle.deck.language, rtl: bundle.deck.rtl }), value: payload.prompt, locale: bundle.deck.language, rtl: bundle.deck.rtl }];
        }
        const validated = (await engine.runRenderParityValidation(bundle)).bundle;
        const state = ensurePlatformState(engine, deckId, tenantRef);
        state.generated_images.unshift({ image_id: imageId, prompt: payload.prompt, file_name: svgFile, source_ref: sourceRef, created_at: now() });
        addActivity(state, payload.actor_ref, "ai-image", "Generated AI image");
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "ai-image", deckId });
        json(response, 200, { data: { bundle: validated, file: `/files/${deckId}/${svgFile}` } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/voiceover$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = VoiceoverRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, deckId);
        const text = bundle.speakerNotes.flatMap((item) => item.content.map((block) => block.value ?? "")).join(". ");
        const voiceoverId = uid("voiceover", Date.now());
        const fileName = `${voiceoverId}.wav`;
        generateVoiceoverWav(engine.store.resolveDeckFile(deckId, "files", fileName), text.slice(0, 2000), payload.voice_name);
        const state = ensurePlatformState(engine, deckId, tenantRef);
        state.voiceovers.unshift({ voiceover_id: voiceoverId, voice_name: payload.voice_name, file_name: fileName, created_at: now() });
        addActivity(state, payload.actor_ref, "voiceover", "Generated AI voiceover");
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "voiceover", deckId });
        json(response, 200, { data: { url: `/files/${deckId}/${fileName}` } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/parity$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const { bundle, parityValidation } = await engine.runRenderParityValidation(loadDeckState(engine, deckId));
        const state = ensurePlatformState(engine, deckId, tenantRef);
        addActivity(state, session.userId, "parity", "Parity rerun");
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "parity", deckId });
        json(response, 200, { data: { bundle, parityValidation } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/publish$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = PublishRequestSchema.parse(await readJsonBody(request));
        const result = engine.publishPresentation({ bundle: loadDeckState(engine, deckId), published_by: payload.published_by, target_ref: `platform://presentations/${deckId}`, publish_to_library: true, allow_degraded: payload.allow_degraded });
        const state = ensurePlatformState(engine, deckId, tenantRef);
        state.password_protected = payload.password.trim().length > 0;
        state.publish_password = payload.password.trim() || null;
        addActivity(state, payload.published_by, "publish", "Deck published");
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "publish", deckId });
        json(response, 200, { data: { bundle: result.bundle, publication: result.publication, publicUrl: `/published/${deckId}?share_token=${state.live_share_token}` } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/comments$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = CommentRequestSchema.parse(await readJsonBody(request));
        const state = ensurePlatformState(engine, deckId, tenantRef);
        state.comments.unshift({ comment_id: uid("comment", Date.now()), author_ref: payload.actor_ref, body: payload.body, created_at: now() });
        addActivity(state, payload.actor_ref, "comment", payload.body);
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "comment", deckId });
        json(response, 200, { data: { comments: state.comments } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/decks\/[^/]+\/export\/[^/]+$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const segments = pathname.split("/");
        const deckId = decodeURIComponent(segments[5] ?? "");
        const target = decodeURIComponent(segments[7] ?? "");
        const bundle = loadDeckState(engine, deckId);
        const requestBody = await readJsonBody(request);
        let fileName = "";
        let contentType = "application/octet-stream";
        if (["pptx", "pdf", "html"].includes(target)) {
          const artifact = await engine.exportPresentation(bundle, target as Exclude<PresentationBinaryTarget, "reader">);
          fileName = artifact.fileName;
          contentType = artifact.contentType;
          if (artifact.content instanceof Uint8Array) {
            engine.store.persistBinary(deckId, "files", fileName, artifact.content);
          } else {
            engine.store.persistText(deckId, "files", fileName, artifact.content);
          }
        } else if (target === "jpeg") {
          const tempDir = path.join(runtimeSampleRoot, deckId, "jpeg");
          const outputs = await captureReaderJpegs(`http://${host}:${(server.address() as { port: number }).port}/files/${deckId}/reader.html`, tempDir);
          outputs.forEach((output, index) => fs.copyFileSync(output, engine.store.resolveDeckFile(deckId, "files", `presentation-slide-${index + 1}.jpg`)));
          fileName = "presentation-slide-1.jpg";
          contentType = "image/jpeg";
        } else if (target === "word") {
          fileName = "presentation.docx";
          contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          await createDocxFromBundle(bundle, engine.store.resolveDeckFile(deckId, "files", fileName));
        } else if (target === "google-slides") {
          const pptx = await engine.exportPresentation(bundle, "pptx");
          const zip = new JSZip();
          zip.file("presentation.pptx", Buffer.from(pptx.content as Uint8Array));
          zip.file("google-slides-manifest.json", JSON.stringify({ compatibility: "google-slides-import", source: bundle.deck.deck_id, exported_at: now() }, null, 2));
          fileName = "presentation-google-slides.zip";
          contentType = "application/zip";
          engine.store.persistBinary(deckId, "files", fileName, await zip.generateAsync({ type: "uint8array" }));
        } else if (target === "canva") {
          const canvaPackage = await createCanvaPackage(engine, deckId, bundle, host, (server.address() as { port: number }).port);
          fileName = canvaPackage.fileName;
          contentType = canvaPackage.contentType;
        } else if (target === "onedrive" || target === "google-drive") {
          const payload = CloudSaveRequestSchema.parse(requestBody);
          const exportTarget = payload.export_target;
          const baseFolder =
            payload.folder_path.trim() ||
            (target === "onedrive" ? storageRoots.oneDrive : storageRoots.googleDrive);
          if (!baseFolder) {
            json(response, 409, { error: `${target} local sync folder is not configured on this machine.` });
            return;
          }
          fs.mkdirSync(baseFolder, { recursive: true });
          const exportResponse =
            exportTarget === "pptx" || exportTarget === "pdf" || exportTarget === "html"
              ? await engine.exportPresentation(bundle, exportTarget as Exclude<PresentationBinaryTarget, "reader">)
              : exportTarget === "word"
                ? null
                : exportTarget === "google-slides"
                  ? null
                  : exportTarget === "canva"
                    ? null
                    : null;
          if (exportTarget === "word") {
            fileName = "presentation.docx";
            contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            await createDocxFromBundle(bundle, engine.store.resolveDeckFile(deckId, "files", fileName));
          } else if (exportTarget === "google-slides") {
            const pptx = await engine.exportPresentation(bundle, "pptx");
            const zip = new JSZip();
            zip.file("presentation.pptx", Buffer.from(pptx.content as Uint8Array));
            zip.file("google-slides-manifest.json", JSON.stringify({ compatibility: "google-slides-import", source: bundle.deck.deck_id, exported_at: now() }, null, 2));
            fileName = "presentation-google-slides.zip";
            contentType = "application/zip";
            engine.store.persistBinary(deckId, "files", fileName, await zip.generateAsync({ type: "uint8array" }));
          } else if (exportTarget === "canva") {
            const canvaPackage = await createCanvaPackage(engine, deckId, bundle, host, (server.address() as { port: number }).port);
            fileName = canvaPackage.fileName;
            contentType = canvaPackage.contentType;
          } else if (exportTarget === "jpeg") {
            const tempDir = path.join(runtimeSampleRoot, deckId, "jpeg-cloud");
            const outputs = await captureReaderJpegs(`http://${host}:${(server.address() as { port: number }).port}/files/${deckId}/reader.html`, tempDir);
            outputs.forEach((output, index) => fs.copyFileSync(output, engine.store.resolveDeckFile(deckId, "files", `presentation-slide-${index + 1}.jpg`)));
            fileName = "presentation-slide-1.jpg";
            contentType = "image/jpeg";
          } else if (exportTarget === "video") {
            const pptxExport = await engine.exportPresentation(bundle, "pptx");
            const pptxPath = engine.store.resolveDeckFile(deckId, "files", "presentation.pptx");
            engine.store.persistBinary(deckId, "files", "presentation.pptx", pptxExport.content as Uint8Array);
            fileName = "presentation.mp4";
            contentType = "video/mp4";
            exportPptxToVideo(videoScriptPath, pptxPath, engine.store.resolveDeckFile(deckId, "files", fileName));
          } else if (exportResponse) {
            fileName = exportResponse.fileName;
            contentType = exportResponse.contentType;
            if (exportResponse.content instanceof Uint8Array) {
              engine.store.persistBinary(deckId, "files", fileName, exportResponse.content);
            } else {
              engine.store.persistText(deckId, "files", fileName, exportResponse.content);
            }
          }
          const sourcePath = engine.store.resolveDeckFile(deckId, "files", fileName);
          const destinationPath = path.join(baseFolder, "Rasid Presentations", deckId, fileName);
          fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
          fs.copyFileSync(sourcePath, destinationPath);
          const state = ensurePlatformState(engine, deckId, tenantRef);
          state.extra_exports.unshift({ export_id: uid("extra-export", target, Date.now()), target, file_name: fileName, content_type: contentType, created_at: now(), path_ref: destinationPath });
          addActivity(state, session.userId, "cloud_export", `Saved ${exportTarget} to ${target}`);
          persistPlatformState(engine, state);
          publishEvent(deckId, { kind: "cloud_export", deckId, target, exportTarget });
          json(response, 200, { data: { url: `/files/${deckId}/${fileName}`, fileName, contentType, filePath: destinationPath } });
          return;
        } else if (target === "video") {
          const pptxExport = await engine.exportPresentation(bundle, "pptx");
          const pptxPath = engine.store.resolveDeckFile(deckId, "files", "presentation.pptx");
          engine.store.persistBinary(deckId, "files", "presentation.pptx", pptxExport.content as Uint8Array);
          fileName = "presentation.mp4";
          contentType = "video/mp4";
          exportPptxToVideo(videoScriptPath, pptxPath, engine.store.resolveDeckFile(deckId, "files", fileName));
        } else {
          throw new Error(`Unsupported export target: ${target}`);
        }
        const state = ensurePlatformState(engine, deckId, tenantRef);
        state.extra_exports.unshift({ export_id: uid("extra-export", target, Date.now()), target, file_name: fileName, content_type: contentType, created_at: now(), path_ref: `/files/${deckId}/${fileName}` });
        addActivity(state, session.userId, "export", `Exported ${target}`);
        persistPlatformState(engine, state);
        publishEvent(deckId, { kind: "export", deckId, target });
        json(response, 200, { data: { url: `/files/${deckId}/${fileName}`, fileName, contentType } });
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/api\/v1\/presentations\/decks\/[^/]+\/analytics$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) {
          json(response, 401, { error: "Unauthorized" });
          return;
        }
        const tenantRef = assertTenant(request, session);
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        json(response, 200, { data: ensurePlatformState(engine, deckId, tenantRef).analytics_events });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/public\/[^/]+\/unlock$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const state = ensurePlatformState(engine, deckId, "tenant-default");
        if (url.searchParams.get("share_token") !== state.live_share_token) {
          json(response, 403, { error: "Invalid share token" });
          return;
        }
        const payload = z.object({ password: z.string().default("") }).parse(await readJsonBody(request));
        const status = !state.password_protected || state.publish_password === payload.password ? "unlocked" : "denied";
        if (status === "unlocked") {
          state.analytics_events.push({ event_id: uid("analytics", "unlock", Date.now()), kind: "unlock", detail: "password accepted", actor_ref: "viewer", created_at: now() });
          persistPlatformState(engine, state);
        }
        json(response, 200, { data: { status } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/public\/[^/]+\/track$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const state = ensurePlatformState(engine, deckId, "tenant-default");
        if (url.searchParams.get("share_token") !== state.live_share_token) {
          json(response, 403, { error: "Invalid share token" });
          return;
        }
        const payload = z.object({ kind: z.string(), detail: z.string().default("") }).parse(await readJsonBody(request));
        state.analytics_events.push({ event_id: uid("analytics", Date.now()), kind: payload.kind, detail: payload.detail, actor_ref: "viewer", created_at: now() });
        persistPlatformState(engine, state);
        json(response, 200, { data: { tracked: true } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/public\/[^/]+\/quiz$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const state = ensurePlatformState(engine, deckId, "tenant-default");
        if (url.searchParams.get("share_token") !== state.live_share_token) {
          json(response, 403, { error: "Invalid share token" });
          return;
        }
        const payload = QuizRequestSchema.parse(await readJsonBody(request));
        state.quiz_responses.push({ quiz_id: "viewer-quiz", answer: payload.answer, actor_ref: payload.actor_ref, created_at: now() });
        state.analytics_events.push({ event_id: uid("analytics", "quiz", Date.now()), kind: "quiz", detail: payload.answer, actor_ref: payload.actor_ref, created_at: now() });
        persistPlatformState(engine, state);
        json(response, 200, { data: { accepted: true } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/public\/[^/]+\/poll$/.test(pathname)) {
        const deckId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const state = ensurePlatformState(engine, deckId, "tenant-default");
        if (url.searchParams.get("share_token") !== state.live_share_token) {
          json(response, 403, { error: "Invalid share token" });
          return;
        }
        const payload = QuizRequestSchema.parse(await readJsonBody(request));
        state.quiz_responses.push({ quiz_id: "viewer-poll", answer: payload.answer, actor_ref: payload.actor_ref, created_at: now() });
        state.analytics_events.push({ event_id: uid("analytics", "poll", Date.now()), kind: "poll", detail: payload.answer, actor_ref: payload.actor_ref, created_at: now() });
        persistPlatformState(engine, state);
        json(response, 200, { data: { accepted: true } });
        return;
      }
      // ═══════════════════════════════════════════════════════════════
      // Provider-backed integrations
      // ═══════════════════════════════════════════════════════════════

      // Gmail import
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/gmail/import") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = GmailImportRequestSchema.parse(await readJsonBody(request));
        const headers = { Authorization: `Bearer ${payload.oauth_token}`, "Content-Type": "application/json" };
        let messages: Array<{ id: string; subject: string; body: string }> = [];
        try {
          if (payload.message_id) {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(payload.message_id)}?format=full`, { headers });
            if (!msgRes.ok) throw new Error(`Gmail API error: ${msgRes.status} ${await msgRes.text()}`);
            const msg = (await msgRes.json()) as { id: string; payload: { headers: Array<{ name: string; value: string }>; body?: { data?: string }; parts?: Array<{ mimeType: string; body?: { data?: string } }> } };
            const subjectHeader = msg.payload.headers.find((h: { name: string }) => h.name.toLowerCase() === "subject");
            const bodyPart = msg.payload.parts?.find((p: { mimeType: string }) => p.mimeType === "text/plain") ?? msg.payload;
            const bodyData = (bodyPart as { body?: { data?: string } }).body?.data ?? "";
            const decodedBody = Buffer.from(bodyData.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
            messages = [{ id: msg.id, subject: subjectHeader?.value ?? "", body: decodedBody }];
          } else {
            const q = payload.query || "is:inbox";
            const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${payload.max_results}`, { headers });
            if (!listRes.ok) throw new Error(`Gmail API error: ${listRes.status} ${await listRes.text()}`);
            const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
            for (const ref of (list.messages ?? []).slice(0, payload.max_results)) {
              const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`, { headers });
              if (!msgRes.ok) continue;
              const msg = (await msgRes.json()) as { id: string; payload: { headers: Array<{ name: string; value: string }>; body?: { data?: string }; parts?: Array<{ mimeType: string; body?: { data?: string } }> } };
              const subjectHeader = msg.payload.headers.find((h: { name: string }) => h.name.toLowerCase() === "subject");
              const bodyPart = msg.payload.parts?.find((p: { mimeType: string }) => p.mimeType === "text/plain") ?? msg.payload;
              const bodyData = (bodyPart as { body?: { data?: string } }).body?.data ?? "";
              const decodedBody = Buffer.from(bodyData.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
              messages.push({ id: msg.id, subject: subjectHeader?.value ?? "", body: decodedBody });
            }
          }
        } catch (err) {
          json(response, 502, { error: `Gmail provider error: ${err instanceof Error ? err.message : String(err)}` });
          return;
        }
        const combined = messages.map((m) => `Subject: ${m.subject}\n\n${m.body}`).join("\n\n---\n\n");
        json(response, 200, { data: { provider: "gmail", messages_imported: messages.length, content: combined, message_ids: messages.map((m) => m.id) } });
        return;
      }

      // Notion import
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/notion/import") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = NotionImportRequestSchema.parse(await readJsonBody(request));
        const notionHeaders = { Authorization: `Bearer ${payload.api_token}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" };
        let content = "";
        let title = "Notion Import";
        try {
          if (payload.page_id) {
            const pageRes = await fetch(`https://api.notion.com/v1/pages/${payload.page_id}`, { headers: notionHeaders });
            if (!pageRes.ok) throw new Error(`Notion API error: ${pageRes.status} ${await pageRes.text()}`);
            const page = (await pageRes.json()) as { properties?: Record<string, { title?: Array<{ plain_text: string }>; rich_text?: Array<{ plain_text: string }> }> };
            const titleProp = Object.values(page.properties ?? {}).find((p) => p.title);
            title = titleProp?.title?.map((t) => t.plain_text).join("") || "Notion Page";
            const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${payload.page_id}/children?page_size=100`, { headers: notionHeaders });
            if (blocksRes.ok) {
              const blocks = (await blocksRes.json()) as { results: Array<{ type: string; [key: string]: unknown }> };
              content = blocks.results.map((block) => {
                const blockContent = block[block.type] as { rich_text?: Array<{ plain_text: string }>; text?: { content: string } } | undefined;
                return blockContent?.rich_text?.map((rt) => rt.plain_text).join("") ?? blockContent?.text?.content ?? "";
              }).filter(Boolean).join("\n\n");
            }
          } else if (payload.database_id) {
            const queryBody = payload.query ? { filter: { property: "title", title: { contains: payload.query } } } : {};
            const dbRes = await fetch(`https://api.notion.com/v1/databases/${payload.database_id}/query`, { method: "POST", headers: notionHeaders, body: JSON.stringify(queryBody) });
            if (!dbRes.ok) throw new Error(`Notion API error: ${dbRes.status} ${await dbRes.text()}`);
            const db = (await dbRes.json()) as { results: Array<{ properties: Record<string, { title?: Array<{ plain_text: string }>; rich_text?: Array<{ plain_text: string }> }> }> };
            title = "Notion Database Query";
            content = db.results.map((row) => Object.entries(row.properties).map(([key, val]) => `${key}: ${(val.title ?? val.rich_text ?? []).map((t) => t.plain_text).join("")}`).join(" | ")).join("\n");
          } else if (payload.query) {
            const searchRes = await fetch("https://api.notion.com/v1/search", { method: "POST", headers: notionHeaders, body: JSON.stringify({ query: payload.query, page_size: 10 }) });
            if (!searchRes.ok) throw new Error(`Notion API error: ${searchRes.status} ${await searchRes.text()}`);
            const results = (await searchRes.json()) as { results: Array<{ id: string; properties?: Record<string, { title?: Array<{ plain_text: string }> }> }> };
            title = `Notion Search: ${payload.query}`;
            content = results.results.map((item) => {
              const tp = Object.values(item.properties ?? {}).find((p) => p.title);
              return tp?.title?.map((t) => t.plain_text).join("") ?? item.id;
            }).join("\n");
          }
        } catch (err) {
          json(response, 502, { error: `Notion provider error: ${err instanceof Error ? err.message : String(err)}` });
          return;
        }
        json(response, 200, { data: { provider: "notion", title, content } });
        return;
      }

      // Slack import
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/slack/import") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = SlackImportRequestSchema.parse(await readJsonBody(request));
        let messages: Array<{ user: string; text: string; ts: string }> = [];
        let channelName = payload.channel_id;
        try {
          const historyRes = await fetch(`https://slack.com/api/conversations.history?channel=${encodeURIComponent(payload.channel_id)}&limit=${payload.message_count}`, { headers: { Authorization: `Bearer ${payload.oauth_token}` } });
          if (!historyRes.ok) throw new Error(`Slack API HTTP error: ${historyRes.status}`);
          const history = (await historyRes.json()) as { ok: boolean; error?: string; messages?: Array<{ user?: string; text?: string; ts?: string }> };
          if (!history.ok) throw new Error(`Slack API error: ${history.error ?? "unknown"}`);
          messages = (history.messages ?? []).map((m) => ({ user: m.user ?? "unknown", text: m.text ?? "", ts: m.ts ?? "" }));
          const infoRes = await fetch(`https://slack.com/api/conversations.info?channel=${encodeURIComponent(payload.channel_id)}`, { headers: { Authorization: `Bearer ${payload.oauth_token}` } });
          if (infoRes.ok) {
            const info = (await infoRes.json()) as { ok: boolean; channel?: { name?: string } };
            if (info.ok && info.channel?.name) channelName = info.channel.name;
          }
        } catch (err) {
          json(response, 502, { error: `Slack provider error: ${err instanceof Error ? err.message : String(err)}` });
          return;
        }
        const content = messages.map((m) => `[${m.user}]: ${m.text}`).join("\n");
        json(response, 200, { data: { provider: "slack", channel: channelName, messages_imported: messages.length, content } });
        return;
      }

      // Google Slides import
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/google-slides/import") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = GoogleSlidesImportRequestSchema.parse(await readJsonBody(request));
        try {
          const presRes = await fetch(`https://slides.googleapis.com/v1/presentations/${encodeURIComponent(payload.presentation_id)}`, { headers: { Authorization: `Bearer ${payload.oauth_token}` } });
          if (!presRes.ok) throw new Error(`Google Slides API error: ${presRes.status} ${await presRes.text()}`);
          const pres = (await presRes.json()) as { title?: string; slides?: Array<{ objectId: string; pageElements?: Array<{ objectId: string; shape?: { shapeType?: string; text?: { textElements?: Array<{ textRun?: { content?: string } }> } }; size?: { width?: { magnitude: number }; height?: { magnitude: number } }; transform?: { translateX?: number; translateY?: number } }> }> };
          const slides = (pres.slides ?? []).map((slide, idx) => ({
            slide_id: slide.objectId,
            index: idx,
            elements: (slide.pageElements ?? []).map((el) => ({
              element_id: el.objectId,
              type: el.shape?.shapeType ?? "unknown",
              text: el.shape?.text?.textElements?.map((te) => te.textRun?.content ?? "").join("") ?? "",
              width: el.size?.width?.magnitude ?? 0,
              height: el.size?.height?.magnitude ?? 0,
              x: el.transform?.translateX ?? 0,
              y: el.transform?.translateY ?? 0
            }))
          }));
          const textContent = slides.map((s) => s.elements.map((e) => e.text).filter(Boolean).join("\n")).join("\n\n");
          json(response, 200, { data: { provider: "google-slides", title: pres.title ?? "Untitled", slide_count: slides.length, slides, text_content: textContent } });
        } catch (err) {
          json(response, 502, { error: `Google Slides provider error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      // Google Slides export
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/google-slides/export") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = GoogleSlidesExportRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, payload.deck_id);
        try {
          const createRes = await fetch("https://slides.googleapis.com/v1/presentations", {
            method: "POST",
            headers: { Authorization: `Bearer ${payload.oauth_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ title: payload.title })
          });
          if (!createRes.ok) throw new Error(`Google Slides API error: ${createRes.status} ${await createRes.text()}`);
          const created = (await createRes.json()) as { presentationId: string };
          const requests: Array<Record<string, unknown>> = [];
          for (const slide of bundle.storyboard) {
            requests.push({ createSlide: { slideLayoutReference: { predefinedLayout: "BLANK" } } });
          }
          if (requests.length > 0) {
            await fetch(`https://slides.googleapis.com/v1/presentations/${created.presentationId}:batchUpdate`, {
              method: "POST",
              headers: { Authorization: `Bearer ${payload.oauth_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ requests })
            });
          }
          json(response, 200, { data: { provider: "google-slides", presentation_id: created.presentationId, slide_count: bundle.storyboard.length, url: `https://docs.google.com/presentation/d/${created.presentationId}` } });
        } catch (err) {
          json(response, 502, { error: `Google Slides export error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      // Google Drive upload
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/google-drive/upload") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = GoogleDriveUploadRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, payload.deck_id);
        try {
          const exported = await engine.exportPresentation(bundle, payload.export_target as Exclude<PresentationBinaryTarget, "reader">);
          const fileContent = exported.content instanceof Uint8Array ? exported.content : Buffer.from(exported.content, "utf8");
          const metadata = JSON.stringify({ name: exported.fileName, parents: [payload.folder_id] });
          const boundary = `rasid_boundary_${Date.now()}`;
          const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${exported.contentType}\r\n\r\n`),
            fileContent instanceof Buffer ? fileContent : Buffer.from(fileContent),
            Buffer.from(`\r\n--${boundary}--`)
          ]);
          const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
            method: "POST",
            headers: { Authorization: `Bearer ${payload.oauth_token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
            body
          });
          if (!uploadRes.ok) throw new Error(`Google Drive API error: ${uploadRes.status} ${await uploadRes.text()}`);
          const file = (await uploadRes.json()) as { id: string; name: string; webViewLink?: string };
          json(response, 200, { data: { provider: "google-drive", file_id: file.id, file_name: file.name, url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}` } });
        } catch (err) {
          json(response, 502, { error: `Google Drive upload error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      // OneDrive upload
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/onedrive/upload") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = OneDriveUploadRequestSchema.parse(await readJsonBody(request));
        const bundle = loadDeckState(engine, payload.deck_id);
        try {
          const exported = await engine.exportPresentation(bundle, payload.export_target as Exclude<PresentationBinaryTarget, "reader">);
          const fileContent = exported.content instanceof Uint8Array ? Buffer.from(exported.content) : Buffer.from(exported.content, "utf8");
          const uploadPath = `${payload.folder_path}/${exported.fileName}`.replace(/\/+/g, "/");
          const uploadRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(uploadPath)}:/content`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${payload.oauth_token}`, "Content-Type": exported.contentType },
            body: fileContent
          });
          if (!uploadRes.ok) throw new Error(`OneDrive API error: ${uploadRes.status} ${await uploadRes.text()}`);
          const file = (await uploadRes.json()) as { id: string; name: string; webUrl?: string };
          json(response, 200, { data: { provider: "onedrive", file_id: file.id, file_name: file.name, url: file.webUrl ?? "" } });
        } catch (err) {
          json(response, 502, { error: `OneDrive upload error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      // Browser Operator
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/integrations/browser-operator/execute") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const payload = BrowserOperatorRequestSchema.parse(await readJsonBody(request));
        const results: Array<{ action: string; success: boolean; result: string }> = [];
        let browser = null;
        let page = null;
        try {
          const executablePath = BROWSER_EXECUTABLE_CANDIDATES.find((c) => fs.existsSync(c));
          browser = await chromium.launch({ executablePath: executablePath || undefined, headless: true });
          const context = await browser.newContext();
          page = await context.newPage();
          for (const op of payload.operations) {
            try {
              if (op.action === "navigate") {
                await page.goto(op.url || op.value, { timeout: op.timeout_ms });
                results.push({ action: "navigate", success: true, result: page.url() });
              } else if (op.action === "click") {
                await page.click(op.selector, { timeout: op.timeout_ms });
                results.push({ action: "click", success: true, result: `clicked ${op.selector}` });
              } else if (op.action === "type") {
                await page.fill(op.selector, op.value, { timeout: op.timeout_ms });
                results.push({ action: "type", success: true, result: `typed into ${op.selector}` });
              } else if (op.action === "screenshot") {
                const screenshotBuffer = await page.screenshot({ fullPage: true, timeout: op.timeout_ms });
                const screenshotId = uid("browser-screenshot", Date.now());
                const screenshotFile = `${screenshotId}.png`;
                if (payload.deck_id) {
                  engine.store.persistBinary(payload.deck_id, "files", screenshotFile, screenshotBuffer);
                }
                results.push({ action: "screenshot", success: true, result: payload.deck_id ? `/files/${payload.deck_id}/${screenshotFile}` : `screenshot:${screenshotBuffer.length}bytes` });
              } else if (op.action === "extract_text") {
                const text = op.selector ? await page.textContent(op.selector, { timeout: op.timeout_ms }) ?? "" : await page.evaluate(() => document.body.innerText);
                results.push({ action: "extract_text", success: true, result: text.slice(0, 10000) });
              } else if (op.action === "wait") {
                if (op.selector) {
                  await page.waitForSelector(op.selector, { timeout: op.timeout_ms });
                } else {
                  await page.waitForTimeout(Math.min(op.timeout_ms, 10000));
                }
                results.push({ action: "wait", success: true, result: `waited${op.selector ? ` for ${op.selector}` : ""}` });
              }
            } catch (opErr) {
              results.push({ action: op.action, success: false, result: opErr instanceof Error ? opErr.message : String(opErr) });
            }
          }
        } catch (err) {
          json(response, 502, { error: `Browser operator error: ${err instanceof Error ? err.message : String(err)}` });
          return;
        } finally {
          if (browser) await browser.close().catch(() => {});
        }
        json(response, 200, { data: { provider: "browser-operator", operations_executed: results.length, results } });
        return;
      }

      // Scheduled Tasks - Create
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/schedules/create") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = ScheduleCreateRequestSchema.parse(await readJsonBody(request));
        const scheduleId = uid("schedule", payload.deck_id, Date.now());
        const nextRun = payload.schedule_type === "once" && payload.run_at ? payload.run_at :
          new Date(Date.now() + (payload.interval_minutes * 60000)).toISOString();
        const record: ScheduleRecord = {
          schedule_id: scheduleId,
          deck_id: payload.deck_id,
          tenant_ref: tenantRef,
          schedule_type: payload.schedule_type,
          cron_expression: payload.cron_expression,
          interval_minutes: payload.interval_minutes,
          run_at: payload.run_at,
          action: payload.action,
          action_params: payload.action_params,
          status: "active",
          last_run_at: "",
          next_run_at: nextRun,
          created_by: payload.actor_ref,
          created_at: now()
        };
        const schedulesFile = path.join(runtimeSampleRoot, "platform", "schedules", `${tenantRef}.json`);
        fs.mkdirSync(path.dirname(schedulesFile), { recursive: true });
        const existing: ScheduleRecord[] = fs.existsSync(schedulesFile) ? JSON.parse(fs.readFileSync(schedulesFile, "utf8")) : [];
        existing.push(record);
        fs.writeFileSync(schedulesFile, JSON.stringify(existing, null, 2), "utf8");
        json(response, 201, { data: { schedule: record } });
        return;
      }

      // Scheduled Tasks - List
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/presentations/schedules/list") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const schedulesFile = path.join(runtimeSampleRoot, "platform", "schedules", `${tenantRef}.json`);
        const schedules: ScheduleRecord[] = fs.existsSync(schedulesFile) ? JSON.parse(fs.readFileSync(schedulesFile, "utf8")) : [];
        json(response, 200, { data: { schedules } });
        return;
      }

      // Scheduled Tasks - Cancel
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/presentations\/schedules\/[^/]+\/cancel$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const scheduleId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const schedulesFile = path.join(runtimeSampleRoot, "platform", "schedules", `${tenantRef}.json`);
        const schedules: ScheduleRecord[] = fs.existsSync(schedulesFile) ? JSON.parse(fs.readFileSync(schedulesFile, "utf8")) : [];
        const target = schedules.find((s) => s.schedule_id === scheduleId);
        if (!target) { json(response, 404, { error: "Schedule not found" }); return; }
        target.status = "cancelled";
        fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2), "utf8");
        json(response, 200, { data: { schedule: target } });
        return;
      }

      // Zapier webhook
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/webhooks/zapier") {
        const payload = WebhookRequestSchema.parse(await readJsonBody(request));
        const apiKey = payload.api_key || request.headers["x-api-key"] as string || "";
        if (!apiKey) { json(response, 401, { error: "API key required" }); return; }
        const webhooksFile = path.join(runtimeSampleRoot, "platform", "webhooks", "zapier.json");
        fs.mkdirSync(path.dirname(webhooksFile), { recursive: true });
        const registrations: WebhookRegistration[] = fs.existsSync(webhooksFile) ? JSON.parse(fs.readFileSync(webhooksFile, "utf8")) : [];
        if (payload.callback_url) {
          registrations.push({
            webhook_id: uid("webhook-zapier", Date.now()),
            provider: "zapier",
            trigger: payload.trigger,
            callback_url: payload.callback_url,
            api_key_hash: hashToken(apiKey),
            tenant_ref: "tenant-default",
            created_at: now()
          });
          fs.writeFileSync(webhooksFile, JSON.stringify(registrations, null, 2), "utf8");
        }
        json(response, 200, { data: { provider: "zapier", trigger: payload.trigger, registered: Boolean(payload.callback_url), active_webhooks: registrations.length, payload: payload.payload } });
        return;
      }

      // Make.com webhook
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/webhooks/makecom") {
        const payload = WebhookRequestSchema.parse(await readJsonBody(request));
        const apiKey = payload.api_key || request.headers["x-api-key"] as string || "";
        if (!apiKey) { json(response, 401, { error: "API key required" }); return; }
        const webhooksFile = path.join(runtimeSampleRoot, "platform", "webhooks", "makecom.json");
        fs.mkdirSync(path.dirname(webhooksFile), { recursive: true });
        const registrations: WebhookRegistration[] = fs.existsSync(webhooksFile) ? JSON.parse(fs.readFileSync(webhooksFile, "utf8")) : [];
        if (payload.callback_url) {
          registrations.push({
            webhook_id: uid("webhook-makecom", Date.now()),
            provider: "makecom",
            trigger: payload.trigger,
            callback_url: payload.callback_url,
            api_key_hash: hashToken(apiKey),
            tenant_ref: "tenant-default",
            created_at: now()
          });
          fs.writeFileSync(webhooksFile, JSON.stringify(registrations, null, 2), "utf8");
        }
        json(response, 200, { data: { provider: "makecom", trigger: payload.trigger, registered: Boolean(payload.callback_url), active_webhooks: registrations.length, payload: payload.payload } });
        return;
      }

      // Chrome Extension / Office Add-in Bridge
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/presentations/extensions/bridge") {
        const session = authenticate(request);
        if (!session) { json(response, 401, { error: "Unauthorized" }); return; }
        const tenantRef = assertTenant(request, session);
        const payload = ExtensionBridgeRequestSchema.parse(await readJsonBody(request));
        let result: Record<string, unknown> = {};
        if (payload.action === "get_status") {
          result = { extension_type: payload.extension_type, status: "connected", capabilities: ["import_selection", "export_to_host", "sync_theme"], version: "1.0.0" };
        } else if (payload.action === "import_selection") {
          const content = (payload.params as { content?: string }).content ?? "";
          const title = (payload.params as { title?: string }).title ?? "Extension Import";
          result = { imported: true, title, content_length: content.length, source: payload.extension_type };
        } else if (payload.action === "export_to_host") {
          const deckId = (payload.params as { deck_id?: string }).deck_id ?? "";
          const format = (payload.params as { format?: string }).format ?? "pptx";
          if (deckId) {
            const bundle = loadDeckState(engine, deckId);
            const exported = await engine.exportPresentation(bundle, (["pptx", "pdf", "html"].includes(format) ? format : "pptx") as Exclude<PresentationBinaryTarget, "reader">);
            engine.store.persistBinary(deckId, "files", exported.fileName, exported.content instanceof Uint8Array ? exported.content : Buffer.from(exported.content, "utf8"));
            result = { exported: true, file_name: exported.fileName, content_type: exported.contentType, url: `/files/${deckId}/${exported.fileName}` };
          } else {
            result = { exported: false, error: "deck_id required" };
          }
        } else if (payload.action === "sync_theme") {
          const deckId = (payload.params as { deck_id?: string }).deck_id ?? "";
          const themeTokens = (payload.params as { theme_tokens?: Record<string, string> }).theme_tokens ?? {};
          result = { synced: true, deck_id: deckId, theme_tokens: themeTokens, source: payload.extension_type };
        }
        json(response, 200, { data: { provider: payload.extension_type, action: payload.action, result } });
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // ADDENDUM routes (catalog, control manifest, transforms, data picker, dashboard, tools, test interface)
      // ═══════════════════════════════════════════════════════════════
      const session4 = authenticate(request);
      const addendumCtx = {
        rootDir: engine.store.rootDir,
        userId: session4?.userId ?? "anonymous",
        tenantRef: session4?.tenantRef ?? "tenant-default",
      };
      const handled = await handleAddendumRoute(request, response, pathname, (request.method ?? "GET").toUpperCase(), addendumCtx);
      if (handled) return;

      json(response, 404, { error: "Not found" });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 0;
  return {
    origin: `http://${host}:${port}`,
    port,
    close: async () => {
      for (const clients of sseClients.values()) {
        for (const client of clients) client.end();
      }
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  };
};

export { type PlatformServerHandle };
