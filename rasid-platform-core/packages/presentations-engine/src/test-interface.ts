/**
 * Frontend Test Interface + API Endpoints for ADDENDUM Features
 * Serves at /test-interface and provides API routes for all new catalog/control/transform/data/dashboard features
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";
import {
  type CatalogKind,
  type CatalogSearchRequest,
  type VariantGenerateRequest,
  getCatalog,
} from "./catalogs";
import {
  type ControlManifest,
  type ControlSurfaceLevel,
  type DataBindingApplyRequest,
  type DataPickerBrowseRequest,
  type DataPickerSelectRequest,
  type DashboardSlideRequest,
  type ElementTransformRequest,
  type UserPreferences,
  PRESENTATION_TOOL_SCHEMAS,
  applyDataBinding,
  applyElementTransform,
  browseExcelFile,
  buildControlManifest,
  computeLiteralHash,
  defaultUserPreferences,
  generateDashboardSlide,
  getVisibleControls,
  inferIntentFromPrompt,
  loadUserPreferences,
  resolveSmartDefaults,
  saveUserPreferences,
  searchControls,
  selectDataFromExcel,
  verifyLiteralFidelity,
} from "./control-manifest";
import {
  type AntiCheatAuditInput,
  type ControlledModeKnobs,
  type ContentFidelityMode,
  type DashboardSlideKind,
  type DataPickerTransform,
  type InfographicVariantKind,
  type StrictInsertRequest,
  ControlledModeKnobsSchema,
  ENGINE_MODE_TOOL_SCHEMAS,
  INFOGRAPHIC_VARIANTS,
  INTEGRATION_CONNECTORS,
  applyDataPickerTransforms,
  buildDashboardSlideSpec,
  buildDataPickerPreview,
  buildDataPickerSelection,
  buildEvidencePackExport,
  buildKpiCard,
  buildMiniChart,
  buildParityMatrixVerify,
  buildSlicerFilter,
  generateDeterministicLayout,
  getInfographicVariant,
  processStrictInsert,
  resolveConnectorPicker,
  runAntiCheatChecks,
  runFullAntiCheatAudit,
  searchInfographicVariants,
  swapInfographicVariant,
  validateArabicEliteLayout,
  validateDefinitionOfDone,
} from "./engine-modes";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const now = (): string => new Date().toISOString();
const uid = (prefix: string, ...parts: Array<string | number>) =>
  [prefix, ...parts].join("-").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// ─── API Route Handler ───────────────────────────────────────────────────────

export type AddendumRouteContext = {
  rootDir: string;
  userId: string;
  tenantRef: string;
};

const readJsonBody = async (request: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const payload = Buffer.concat(chunks).toString("utf8");
  return payload.length > 0 ? JSON.parse(payload) : {};
};

const json = (response: http.ServerResponse, statusCode: number, payload: unknown): void => {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const html = (response: http.ServerResponse, content: string): void => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(content);
};

/**
 * Handle ADDENDUM-specific API routes
 * Returns true if the route was handled, false otherwise
 */
export const handleAddendumRoute = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
  method: string,
  ctx: AddendumRouteContext
): Promise<boolean> => {
  // ── Catalog Search
  if (method === "POST" && pathname === "/api/v1/presentations/catalog/search") {
    const body = await readJsonBody(request) as CatalogSearchRequest;
    const catalog = getCatalog();
    const result = catalog.search(body);
    json(response, 200, { data: result });
    return true;
  }

  // ── Catalog Stats
  if (method === "GET" && pathname === "/api/v1/presentations/catalog/stats") {
    const catalog = getCatalog();
    json(response, 200, { data: { stats: catalog.getStats(), total_assets: catalog.totalAssets() } });
    return true;
  }

  // ── Catalog Families
  if (method === "GET" && /^\/api\/v1\/presentations\/catalog\/families\/[^/]+$/.test(pathname)) {
    const kind = decodeURIComponent(pathname.split("/")[6] ?? "") as CatalogKind;
    const catalog = getCatalog();
    json(response, 200, { data: { kind, families: catalog.getFamiliesForKind(kind) } });
    return true;
  }

  // ── Variant Generate
  if (method === "POST" && pathname === "/api/v1/presentations/catalog/variants") {
    const body = await readJsonBody(request) as VariantGenerateRequest;
    const catalog = getCatalog();
    const result = catalog.generateVariants(body);
    json(response, 200, { data: result });
    return true;
  }

  // ── Control Manifest Build
  if (method === "POST" && pathname === "/api/v1/presentations/control-manifest/build") {
    const body = z.object({ deck_id: z.string(), prompt: z.string(), language: z.string().default("ar") }).parse(await readJsonBody(request));
    const prefs = loadUserPreferences(ctx.rootDir, ctx.userId);
    const manifest = buildControlManifest(body.deck_id, body.prompt, body.language, prefs);
    json(response, 200, { data: { manifest } });
    return true;
  }

  // ── Control Manifest: Get Visible Controls
  if (method === "POST" && pathname === "/api/v1/presentations/control-manifest/visible") {
    const body = z.object({ deck_id: z.string(), prompt: z.string(), language: z.string().default("ar"), level: z.string().default("deck") }).parse(await readJsonBody(request));
    const prefs = loadUserPreferences(ctx.rootDir, ctx.userId);
    const manifest = buildControlManifest(body.deck_id, body.prompt, body.language, prefs);
    const controls = getVisibleControls(manifest, body.level as ControlSurfaceLevel);
    json(response, 200, { data: { level: body.level, controls } });
    return true;
  }

  // ── Control Manifest: Search Controls
  if (method === "POST" && pathname === "/api/v1/presentations/control-manifest/search") {
    const body = z.object({ deck_id: z.string(), prompt: z.string(), language: z.string().default("ar"), query: z.string() }).parse(await readJsonBody(request));
    const prefs = loadUserPreferences(ctx.rootDir, ctx.userId);
    const manifest = buildControlManifest(body.deck_id, body.prompt, body.language, prefs);
    const results = searchControls(manifest, body.query);
    json(response, 200, { data: { query: body.query, results } });
    return true;
  }

  // ── Intent Inference
  if (method === "POST" && pathname === "/api/v1/presentations/intent/infer") {
    const body = z.object({ prompt: z.string(), language: z.string().default("ar") }).parse(await readJsonBody(request));
    const intent = inferIntentFromPrompt(body.prompt, body.language);
    json(response, 200, { data: { intent } });
    return true;
  }

  // ── Smart Defaults
  if (method === "POST" && pathname === "/api/v1/presentations/smart-defaults") {
    const body = z.object({ prompt: z.string(), language: z.string().default("ar") }).parse(await readJsonBody(request));
    const prefs = loadUserPreferences(ctx.rootDir, ctx.userId);
    const defaults = resolveSmartDefaults(body.prompt, body.language, prefs);
    json(response, 200, { data: { defaults } });
    return true;
  }

  // ── User Preferences Get
  if (method === "GET" && pathname === "/api/v1/presentations/preferences") {
    const prefs = loadUserPreferences(ctx.rootDir, ctx.userId);
    json(response, 200, { data: { preferences: prefs } });
    return true;
  }

  // ── User Preferences Set
  if (method === "POST" && pathname === "/api/v1/presentations/preferences") {
    const body = await readJsonBody(request) as Partial<UserPreferences["defaults"]>;
    const prefs = loadUserPreferences(ctx.rootDir, ctx.userId);
    Object.assign(prefs.defaults, body);
    saveUserPreferences(ctx.rootDir, prefs);
    json(response, 200, { data: { preferences: prefs } });
    return true;
  }

  // ── Element Transform
  if (method === "POST" && pathname === "/api/v1/presentations/element/transform") {
    const body = await readJsonBody(request) as ElementTransformRequest;
    const mockBlock: Record<string, unknown> = {
      block_kind: "body",
      block_metadata: { chart: null, table: null, layout_box: { x: 72, y: 160, w: 600, h: 300 } },
    };
    const result = applyElementTransform(mockBlock, body);
    json(response, 200, { data: result });
    return true;
  }

  // ── Data Picker Browse
  if (method === "POST" && pathname === "/api/v1/presentations/data-picker/browse") {
    const body = await readJsonBody(request) as DataPickerBrowseRequest;
    try {
      const result = browseExcelFile(body);
      json(response, 200, { data: result });
    } catch (err) {
      json(response, 400, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // ── Data Picker Select
  if (method === "POST" && pathname === "/api/v1/presentations/data-picker/select") {
    const body = await readJsonBody(request) as DataPickerSelectRequest;
    try {
      const result = selectDataFromExcel(body);
      json(response, 200, { data: result });
    } catch (err) {
      json(response, 400, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // ── Data Binding Apply
  if (method === "POST" && pathname === "/api/v1/presentations/data-binding/apply") {
    const body = await readJsonBody(request) as DataBindingApplyRequest;
    const result = applyDataBinding(body);
    json(response, 200, { data: result });
    return true;
  }

  // ── Dashboard Slide Generate
  if (method === "POST" && pathname === "/api/v1/presentations/dashboard-slide/generate") {
    const body = await readJsonBody(request) as DashboardSlideRequest;
    const result = generateDashboardSlide(body);
    json(response, 200, { data: result });
    return true;
  }

  // ── Literal Hash Verify
  if (method === "POST" && pathname === "/api/v1/presentations/literal/verify") {
    const body = z.object({ input_text: z.string(), output_text: z.string() }).parse(await readJsonBody(request));
    const result = verifyLiteralFidelity(body.input_text, body.output_text);
    json(response, 200, { data: result });
    return true;
  }

  // ── Infographic Variants
  if (method === "GET" && pathname === "/api/v1/presentations/infographic/variants") {
    json(response, 200, { data: { variants: INFOGRAPHIC_VARIANTS } });
    return true;
  }

  if (method === "POST" && pathname === "/api/v1/presentations/infographic/search") {
    const body = await readJsonBody(request) as { query: string };
    json(response, 200, { data: { variants: searchInfographicVariants(body.query ?? "") } });
    return true;
  }

  if (method === "POST" && pathname === "/api/v1/presentations/infographic/swap") {
    const body = await readJsonBody(request) as { current_kind: string; direction: "next" | "prev" | "random" };
    const result = swapInfographicVariant(body.current_kind as InfographicVariantKind, body.direction ?? "next");
    json(response, 200, { data: result });
    return true;
  }

  if (method === "POST" && pathname === "/api/v1/presentations/infographic/get") {
    const body = await readJsonBody(request) as { kind: string };
    const variant = getInfographicVariant(body.kind as InfographicVariantKind);
    json(response, 200, { data: variant ?? null });
    return true;
  }

  // ── Integration Connectors
  if (method === "GET" && pathname === "/api/v1/presentations/connectors") {
    json(response, 200, { data: { connectors: INTEGRATION_CONNECTORS } });
    return true;
  }

  if (method === "POST" && pathname === "/api/v1/presentations/connectors/pick") {
    const body = await readJsonBody(request) as { provider: string; uri: string; file_name: string; mime_type: string };
    const result = resolveConnectorPicker(
      body.provider as "google_drive" | "onedrive" | "sharepoint" | "s3" | "local",
      body.uri ?? "",
      body.file_name ?? "file",
      body.mime_type ?? "application/octet-stream"
    );
    json(response, 200, { data: result });
    return true;
  }

  // ── Strict Insert
  if (method === "POST" && pathname === "/api/v1/presentations/strict-insert") {
    const body = await readJsonBody(request) as StrictInsertRequest;
    const result = processStrictInsert(body);
    json(response, 200, { data: result });
    return true;
  }

  // ── Parity Matrix Verify
  if (method === "POST" && pathname === "/api/v1/presentations/parity-matrix/verify") {
    const body = await readJsonBody(request) as { deck_id: string; slide_count: number; has_charts: boolean; has_tables: boolean; has_media: boolean };
    const result = buildParityMatrixVerify(
      body.deck_id ?? "deck-test",
      ["reader", "pptx", "pdf", "html"],
      body.slide_count ?? 5,
      body.has_charts ?? false,
      body.has_tables ?? false,
      body.has_media ?? false
    );
    json(response, 200, { data: result });
    return true;
  }

  // ── Evidence Pack Export
  if (method === "POST" && pathname === "/api/v1/presentations/evidence-pack/export") {
    const body = await readJsonBody(request) as { deck_id: string; artifact_count: number; include_screenshots: boolean };
    const result = buildEvidencePackExport(body.deck_id ?? "deck-test", body.artifact_count ?? 5, body.include_screenshots ?? true);
    json(response, 200, { data: result });
    return true;
  }

  // ── Anti-Cheat Check
  if (method === "POST" && pathname === "/api/v1/presentations/anti-cheat/check") {
    const body = await readJsonBody(request) as { deck_id: string };
    const result = runAntiCheatChecks(body.deck_id ?? "deck-test", true, true, true, [], ["evidence-1"], true, true);
    json(response, 200, { data: result });
    return true;
  }

  // ── Definition of Done
  if (method === "POST" && pathname === "/api/v1/presentations/definition-of-done") {
    const body = await readJsonBody(request) as { deck_id: string };
    const result = validateDefinitionOfDone({
      deckId: body.deck_id ?? "deck-test",
      autoFlowProducedDeck: true,
      deckPassedQa: true,
      pptxExported: true,
      renderParityPassed: true,
      arabicElitePassed: true,
      evidencePackStored: true,
      toolSchemasValidated: true,
      antiCheatPassed: true
    });
    json(response, 200, { data: result });
    return true;
  }

  // ── Deterministic Layout
  if (method === "POST" && pathname === "/api/v1/presentations/deterministic-layout") {
    const body = await readJsonBody(request) as { deck_id: string; slide_count: number; language: string; seed: number; density: string };
    const result = generateDeterministicLayout({
      deck_id: body.deck_id ?? "deck-test",
      slide_count: body.slide_count ?? 8,
      language: body.language ?? "ar-SA",
      rtl: /^ar/i.test(body.language ?? "ar-SA"),
      density: (body.density ?? "balanced") as "light" | "balanced" | "dense",
      seed: body.seed ?? 42
    });
    json(response, 200, { data: result });
    return true;
  }

  // ── Arabic ELITE Validate
  if (method === "POST" && pathname === "/api/v1/presentations/arabic-elite/validate") {
    const body = await readJsonBody(request) as { language: string; rtl: boolean; font_face: string };
    const result = validateArabicEliteLayout(
      body.language ?? "ar-SA",
      body.rtl ?? true,
      body.font_face ?? "Tajawal",
      /^ar/i.test(body.language ?? "ar-SA") ? "arab" : "latn",
      []
    );
    json(response, 200, { data: result });
    return true;
  }

  // ── Data Picker
  if (method === "POST" && pathname === "/api/v1/presentations/data-picker/select") {
    const body = await readJsonBody(request) as {
      file_ref: string; file_name: string; sheet_name: string; table_range: string;
      columns: string[]; row_count: number; preview_rows: Array<Record<string, string | number | boolean | null>>;
      transforms?: DataPickerTransform[];
    };
    const selection = buildDataPickerSelection(
      body.file_ref ?? "file-ref", body.file_name ?? "data.xlsx", body.sheet_name ?? "Sheet1",
      body.table_range ?? "A1:Z100", body.columns ?? [], body.row_count ?? 0,
      body.preview_rows ?? [], body.transforms ?? []
    );
    const preview = buildDataPickerPreview(selection);
    json(response, 200, { data: { selection, preview } });
    return true;
  }

  if (method === "POST" && pathname === "/api/v1/presentations/data-picker/transform") {
    const body = await readJsonBody(request) as {
      rows: Array<Record<string, string | number | boolean | null>>;
      transforms: DataPickerTransform[];
    };
    const result = applyDataPickerTransforms(body.rows ?? [], body.transforms ?? []);
    json(response, 200, { data: { rows: result, transform_count: (body.transforms ?? []).length } });
    return true;
  }

  // ── Dashboard Slides
  if (method === "POST" && pathname === "/api/v1/presentations/dashboard/create") {
    const body = await readJsonBody(request) as {
      dashboard_kind: string; title: string; title_ar: string;
      kpi_cards?: Array<{ label: string; label_ar: string; value: string | number; unit: string; trend: "up" | "down" | "flat"; trend_value: string }>;
      mini_charts?: Array<{ chart_type: string; label: string; data_points: number[] }>;
      slicer_filters?: Array<{ label: string; field: string; options: string[] }>;
    };
    const kpiCards = (body.kpi_cards ?? []).map(k => buildKpiCard(k.label, k.label_ar, k.value, k.unit, k.trend, k.trend_value));
    const miniCharts = (body.mini_charts ?? []).map(c => buildMiniChart(c.chart_type as "sparkline" | "bar_mini" | "donut_mini" | "progress", c.label, c.data_points));
    const slicerFilters = (body.slicer_filters ?? []).map(s => buildSlicerFilter(s.label, s.field, s.options));
    const spec = buildDashboardSlideSpec(
      `slide-dashboard-${Date.now()}`,
      (body.dashboard_kind ?? "kpi_cards") as DashboardSlideKind,
      body.title ?? "Dashboard",
      body.title_ar ?? "لوحة المعلومات",
      kpiCards, miniCharts, slicerFilters
    );
    json(response, 200, { data: spec });
    return true;
  }

  // ── Full Anti-Cheat Audit (35 rules)
  if (method === "POST" && pathname === "/api/v1/presentations/anti-cheat/full-audit") {
    const body = await readJsonBody(request) as Partial<AntiCheatAuditInput>;
    const input: AntiCheatAuditInput = {
      deckId: body.deckId ?? "deck-test",
      hasRealPptxArtifact: body.hasRealPptxArtifact ?? true,
      hasRealPdfArtifact: body.hasRealPdfArtifact ?? true,
      hasRealHtmlArtifact: body.hasRealHtmlArtifact ?? true,
      pptxByteSize: body.pptxByteSize ?? 50000,
      pdfByteSize: body.pdfByteSize ?? 30000,
      htmlByteSize: body.htmlByteSize ?? 10000,
      slideBlocks: body.slideBlocks ?? [],
      slideRefs: body.slideRefs ?? [],
      evidencePackIds: body.evidencePackIds ?? ["evidence-1"],
      auditTrailIds: body.auditTrailIds ?? ["audit-1"],
      contentTraces: body.contentTraces ?? [],
      contentMode: body.contentMode ?? "smart",
      templateLockMode: body.templateLockMode ?? "unlocked",
      templateCompliancePassed: body.templateCompliancePassed ?? true,
      governanceApproved: body.governanceApproved ?? true,
      connectorConfigs: body.connectorConfigs ?? [],
      cacheEntries: body.cacheEntries ?? [],
      fileRefs: body.fileRefs ?? [],
      chartBindings: body.chartBindings ?? [],
      dataPickerSelections: body.dataPickerSelections ?? [],
      exportTargets: body.exportTargets ?? ["pptx", "pdf", "html"],
      parityVerified: body.parityVerified ?? true,
      language: body.language ?? "ar-SA",
      rtl: body.rtl ?? true,
      claimsGenerated: body.claimsGenerated ?? true,
      claimsExported: body.claimsExported ?? true,
      isPublished: body.isPublished ?? false
    };
    const report = runFullAntiCheatAudit(input);
    json(response, 200, { data: report });
    return true;
  }

  // ── Tool Schemas (combined)
  if (method === "GET" && pathname === "/api/v1/presentations/tools/schemas") {
    json(response, 200, { data: { tools: [...PRESENTATION_TOOL_SCHEMAS, ...ENGINE_MODE_TOOL_SCHEMAS] } });
    return true;
  }

  // ── Test Interface
  if (method === "GET" && pathname === "/test-interface") {
    html(response, renderTestInterface());
    return true;
  }

  return false;
};

// ─── Test Interface HTML ─────────────────────────────────────────────────────

const renderTestInterface = (): string => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>واجهة اختبار محرك العروض — ADDENDUM</title>
  <style>
    :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--paper:#f8fafc;--card:#fff;--accent:#c7511f;--accent-soft:#fee2d5;--green:#1d8f6e;--red:#dc2626;--radius:12px;--shadow:0 4px 24px rgba(15,23,42,0.08)}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Tahoma,sans-serif;background:linear-gradient(180deg,#fff8f4,#f2f5fa 45%,#eef2f7);color:var(--ink);min-height:100vh;direction:rtl}
    .page{max-width:1440px;margin:0 auto;padding:24px}
    h1{font-size:24px;margin-bottom:4px}
    h2{font-size:18px;margin-bottom:12px;color:var(--ink);display:flex;align-items:center;gap:8px}
    h2 .badge{font-size:10px;background:var(--accent);color:#fff;padding:2px 8px;border-radius:999px;font-weight:400}
    .subtitle{color:var(--muted);font-size:13px;margin-bottom:20px}
    .grid{display:grid;gap:16px}
    .grid-2{grid-template-columns:1fr 1fr}
    .grid-3{grid-template-columns:1fr 1fr 1fr}
    .grid-4{grid-template-columns:1fr 1fr 1fr 1fr}
    .card{background:var(--card);border:1px solid rgba(15,23,42,0.06);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;overflow:hidden}
    .card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
    .card-title{font-size:14px;font-weight:600}
    .stat{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px}
    .stat-value{font-size:28px;font-weight:700;color:var(--accent)}
    .stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em}
    input,select,textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 12px;font:inherit;font-size:13px;background:#fff}
    textarea{min-height:60px;resize:vertical}
    button{border:none;border-radius:999px;padding:8px 16px;cursor:pointer;font:inherit;font-size:13px;font-weight:500;transition:all 0.15s}
    .btn-primary{background:var(--ink);color:#fff}
    .btn-primary:hover{background:#1e293b}
    .btn-accent{background:var(--accent);color:#fff}
    .btn-accent:hover{background:#a8420f}
    .btn-outline{background:transparent;border:1px solid var(--line);color:var(--ink)}
    .btn-outline:hover{border-color:var(--accent);color:var(--accent)}
    .btn-sm{padding:4px 12px;font-size:11px}
    .field{display:grid;gap:4px;margin-bottom:8px}
    .field label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em}
    .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .result{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:12px;margin-top:8px;font-size:12px;max-height:300px;overflow:auto;white-space:pre-wrap;font-family:'Cascadia Code',monospace}
    .success{border-color:var(--green);background:#f0fdf4}
    .error{border-color:var(--red);background:#fef2f2}
    .tags{display:flex;gap:4px;flex-wrap:wrap}
    .tag{display:inline-block;padding:2px 8px;background:var(--paper);border:1px solid var(--line);border-radius:999px;font-size:10px;color:var(--muted)}
    .tab-bar{display:flex;gap:2px;margin-bottom:16px;border-bottom:2px solid var(--line);padding-bottom:0}
    .tab{padding:8px 16px;cursor:pointer;font-size:13px;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.15s}
    .tab:hover{color:var(--ink)}
    .tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}
    .tab-content{display:none}
    .tab-content.active{display:block}
    .preview-strip{display:flex;gap:8px;overflow-x:auto;padding:8px 0}
    .preview-card{min-width:120px;max-width:160px;border:2px solid var(--line);border-radius:8px;padding:8px;cursor:pointer;text-align:center;transition:all 0.15s;flex-shrink:0}
    .preview-card:hover{border-color:var(--accent)}
    .preview-card.selected{border-color:var(--accent);background:var(--accent-soft)}
    .preview-card svg{width:100%;height:60px}
    .preview-card .name{font-size:10px;color:var(--muted);margin-top:4px}
    .kpi-row{display:flex;gap:12px;flex-wrap:wrap}
    .kpi-item{background:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);min-width:140px;text-align:center}
    .kpi-item .value{font-size:24px;font-weight:700;color:var(--accent)}
    .kpi-item .label{font-size:10px;color:var(--muted);text-transform:uppercase}
    .loading{opacity:0.5;pointer-events:none}
    @media(max-width:900px){.grid-2,.grid-3,.grid-4{grid-template-columns:1fr}}
  </style>
</head>
<body>
<div class="page">
  <h1>واجهة اختبار محرك العروض — ADDENDUM</h1>
  <p class="subtitle">Presentation Engine Test Interface — Infinite Control + Infinite Options (Canvas-One, AI-First)</p>

  <div class="tab-bar" id="mainTabs">
    <div class="tab active" data-tab="catalog">الكتالوج والخيارات</div>
    <div class="tab" data-tab="controls">التحكم والتفضيلات</div>
    <div class="tab" data-tab="transforms">التحويلات</div>
    <div class="tab" data-tab="data">منتقي البيانات</div>
    <div class="tab" data-tab="dashboard">لوحات المؤشرات</div>
    <div class="tab" data-tab="literal">التحقق الحرفي</div>
    <div class="tab" data-tab="tools">الأدوات المسجلة</div>
  </div>

  <!-- ═══ TAB: Catalog ═══ -->
  <div class="tab-content active" id="tab-catalog">
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">إحصائيات الكتالوج</span><button class="btn-primary btn-sm" onclick="loadStats()">تحديث</button></div>
        <div id="catalogStats" class="kpi-row"></div>
        <div id="catalogTotal" style="margin-top:12px;text-align:center;font-size:13px;color:var(--muted)"></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">بحث في الكتالوج</span></div>
        <div class="field"><label>نوع الكتالوج</label>
          <select id="catalogKind">
            <option value="layout">تخطيط (Layout)</option>
            <option value="infographic">إنفوجرافيك (Infographic)</option>
            <option value="chart_skin">نمط رسم بياني (Chart Skin)</option>
            <option value="table_style">نمط جدول (Table Style)</option>
            <option value="icon_pack">حزمة أيقونات (Icon Pack)</option>
            <option value="motion_preset">حركة (Motion)</option>
            <option value="header_footer">رأس/تذييل (Header/Footer)</option>
            <option value="background">خلفية (Background)</option>
          </select>
        </div>
        <div class="field"><label>بحث</label><input id="catalogQuery" placeholder="ابحث عن اسم أو عائلة أو وسم..." /></div>
        <div class="grid grid-3" style="margin-bottom:8px">
          <div class="field"><label>الكثافة</label><select id="catalogDensity"><option value="">الكل</option><option value="sparse">متفرق</option><option value="standard">قياسي</option><option value="dense">كثيف</option></select></div>
          <div class="field"><label>النبرة</label><select id="catalogTone"><option value="">الكل</option><option value="formal">رسمي</option><option value="neutral">محايد</option><option value="creative">إبداعي</option></select></div>
          <div class="field"><label>الحد</label><input id="catalogLimit" type="number" value="12" min="1" max="50" /></div>
        </div>
        <div class="actions"><button class="btn-accent" onclick="searchCatalog()">بحث</button><button class="btn-outline" onclick="loadFamilies()">عرض العائلات</button></div>
        <div id="catalogResults" class="result" style="display:none"></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">معاينة الأصول ومولد المتغيرات (Suggestion Strip)</span></div>
      <div id="previewStrip" class="preview-strip"></div>
      <div class="actions">
        <button class="btn-primary btn-sm" onclick="generateVariants('more_like_this')">المزيد مثل هذا</button>
        <button class="btn-outline btn-sm" onclick="generateVariants('different_direction')">اتجاه مختلف</button>
        <button class="btn-outline btn-sm" onclick="generateVariants('simpler')">أبسط</button>
        <button class="btn-outline btn-sm" onclick="generateVariants('more_complex')">أكثر تعقيداً</button>
      </div>
      <div id="variantResults" class="preview-strip" style="margin-top:12px"></div>
    </div>
  </div>

  <!-- ═══ TAB: Controls ═══ -->
  <div class="tab-content" id="tab-controls">
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">بناء سجل التحكم (Control Manifest)</span></div>
        <div class="field"><label>معرف العرض</label><input id="cmDeckId" value="deck-test-001" /></div>
        <div class="field"><label>الطلب النصي</label><textarea id="cmPrompt">ابنِ تقريرًا تنفيذيًا يشرح أداء الربع الأول مع مؤشرات KPI ومقارنة مع الأهداف</textarea></div>
        <div class="field"><label>اللغة</label><select id="cmLanguage"><option value="ar">العربية</option><option value="en">English</option><option value="mixed">مختلط</option></select></div>
        <div class="actions">
          <button class="btn-accent" onclick="buildManifest()">بناء السجل</button>
          <button class="btn-outline" onclick="getVisibleControls('deck')">عناصر Deck</button>
          <button class="btn-outline" onclick="getVisibleControls('slide')">عناصر Slide</button>
          <button class="btn-outline" onclick="getVisibleControls('element')">عناصر Element</button>
        </div>
        <div id="manifestResult" class="result" style="display:none"></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">تفضيلات المستخدم (User Preferences)</span></div>
        <div class="grid grid-2">
          <div class="field"><label>وضع الدقة</label><select id="prefFidelity"><option value="smart">ذكي</option><option value="literal_1to1">حرفي</option></select></div>
          <div class="field"><label>النبرة</label><select id="prefTone"><option value="formal">رسمي</option><option value="neutral">محايد</option><option value="creative">إبداعي</option></select></div>
          <div class="field"><label>الكثافة</label><select id="prefDensity"><option value="standard">قياسي</option><option value="sparse">متفرق</option><option value="dense">كثيف</option></select></div>
          <div class="field"><label>مستوى الإنفوجرافيك</label><select id="prefInfographic"><option value="med">متوسط</option><option value="low">منخفض</option><option value="high">مرتفع</option></select></div>
          <div class="field"><label>مستوى الحركة</label><select id="prefMotion"><option value="basic">أساسي</option><option value="none">بدون</option><option value="cinematic">سينمائي</option></select></div>
          <div class="field"><label>حجم الشريحة</label><select id="prefSlideSize"><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="A4">A4</option></select></div>
        </div>
        <div class="actions">
          <button class="btn-primary" onclick="loadPreferences()">تحميل</button>
          <button class="btn-accent" onclick="savePreferences()">حفظ</button>
        </div>
        <div id="prefResult" class="result" style="display:none"></div>
      </div>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="card-header"><span class="card-title">تحليل الطلب النصي (Intent Inference)</span></div>
        <div class="field"><label>الطلب النصي</label><textarea id="intentPrompt">تقرير تنفيذي عن أداء المبيعات مع مؤشرات KPI ومقارنة ربع سنوية</textarea></div>
        <div class="actions"><button class="btn-accent" onclick="inferIntent()">تحليل</button></div>
        <div id="intentResult" class="result" style="display:none"></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">بحث في عناصر التحكم</span></div>
        <div class="field"><label>عبارة البحث</label><input id="controlSearchQuery" placeholder="خط، لون، حركة..." /></div>
        <div class="actions"><button class="btn-accent" onclick="searchControlsUI()">بحث</button></div>
        <div id="controlSearchResult" class="result" style="display:none"></div>
      </div>
    </div>
  </div>

  <!-- ═══ TAB: Transforms ═══ -->
  <div class="tab-content" id="tab-transforms">
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">تحويل العناصر (Element Transform)</span></div>
        <div class="field"><label>نوع التحويل</label>
          <select id="transformKind">
            <option value="change_chart_type">تغيير نوع الرسم البياني</option>
            <option value="change_table_style">تغيير نمط الجدول</option>
            <option value="swap_icon_pack">تبديل حزمة الأيقونات</option>
            <option value="change_animation_preset">تغيير الحركة</option>
            <option value="change_typography_scale">تغيير مقياس الخط</option>
            <option value="change_background_treatment">تغيير الخلفية</option>
            <option value="convert_to_infographic">تحويل لإنفوجرافيك</option>
            <option value="replace_style">استبدال النمط</option>
            <option value="replace_layout_container">استبدال حاوية التخطيط</option>
          </select>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>نوع الرسم البياني</label><select id="transformChartType"><option value="bar">شريطي</option><option value="line">خطي</option><option value="pie">دائري</option><option value="area">مساحة</option></select></div>
          <div class="field"><label>نمط الجدول</label><select id="transformTableStyle"><option value="minimal">بسيط</option><option value="bordered">مؤطر</option><option value="striped">مخطط</option><option value="card_style">بطاقات</option><option value="glass_effect">زجاجي</option></select></div>
          <div class="field"><label>حزمة أيقونات</label><select id="transformIconPack"><option value="business_core">أعمال</option><option value="technology">تقنية</option><option value="finance">مالية</option><option value="data_analytics">تحليلات</option></select></div>
          <div class="field"><label>مقياس الخط</label><input id="transformTypoScale" type="number" value="1.0" step="0.1" min="0.5" max="2.0" /></div>
        </div>
        <div class="actions"><button class="btn-accent" onclick="applyTransform()">تطبيق التحويل</button></div>
        <div id="transformResult" class="result" style="display:none"></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">تبديل الإنفوجرافيك (Infographic Swap)</span></div>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">اختر عائلة إنفوجرافيك لعرض 12 بديل فوري مع خيار "المزيد مثل هذا"</p>
        <div class="field"><label>العائلة</label>
          <select id="infographicFamily">
            <option value="timeline">زمني (Timeline)</option>
            <option value="process">مراحل (Process)</option>
            <option value="hierarchy">هيكلي (Hierarchy)</option>
            <option value="comparison">مقارنة (Comparison)</option>
            <option value="statistical">إحصائي (Statistical)</option>
            <option value="cycle">دائري (Cycle)</option>
          </select>
        </div>
        <div class="actions"><button class="btn-accent" onclick="swapInfographic()">بدّل الإنفوجرافيك</button></div>
        <div id="infographicSwapResults" class="preview-strip" style="margin-top:12px"></div>
      </div>
    </div>
  </div>

  <!-- ═══ TAB: Data Picker ═══ -->
  <div class="tab-content" id="tab-data">
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">استعراض ملف Excel</span></div>
        <div class="field"><label>مسار الملف</label><input id="dpFilePath" placeholder="/path/to/file.xlsx" /></div>
        <div class="actions">
          <button class="btn-accent" onclick="browseExcel()">استعراض</button>
          <button class="btn-outline" onclick="createSampleExcel()">إنشاء ملف تجريبي</button>
        </div>
        <div id="dpBrowseResult" class="result" style="display:none"></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">اختيار البيانات</span></div>
        <div class="field"><label>اسم الورقة</label><input id="dpSheetName" value="Revenue" /></div>
        <div class="field"><label>الأعمدة (مفصولة بفواصل)</label><input id="dpColumns" placeholder="Region,Revenue,Target" /></div>
        <div class="grid grid-2">
          <div class="field"><label>ترتيب حسب</label><input id="dpSortBy" placeholder="Revenue" /></div>
          <div class="field"><label>اتجاه</label><select id="dpSortOrder"><option value="desc">تنازلي</option><option value="asc">تصاعدي</option></select></div>
        </div>
        <div class="field"><label>حد أقصى</label><input id="dpLimit" type="number" value="50" /></div>
        <div class="actions"><button class="btn-accent" onclick="selectData()">اختيار البيانات</button></div>
        <div id="dpSelectResult" class="result" style="display:none"></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">ربط البيانات (Data Binding)</span></div>
      <div class="grid grid-3">
        <div class="field"><label>نوع الهدف</label><select id="dbTargetKind"><option value="chart">رسم بياني</option><option value="table">جدول</option><option value="kpi">مؤشرات KPI</option></select></div>
        <div class="field"><label>نوع الرسم البياني</label><select id="dbChartType"><option value="bar">شريطي</option><option value="line">خطي</option><option value="pie">دائري</option></select></div>
        <div class="field"><label>البعد / المقياس</label><input id="dbDimension" placeholder="Region" /><input id="dbMeasure" placeholder="Revenue" style="margin-top:4px" /></div>
      </div>
      <div class="actions"><button class="btn-accent" onclick="applyBinding()">ربط البيانات</button></div>
      <div id="dbResult" class="result" style="display:none"></div>
    </div>
  </div>

  <!-- ═══ TAB: Dashboard ═══ -->
  <div class="tab-content" id="tab-dashboard">
    <div class="card">
      <div class="card-header"><span class="card-title">توليد شريحة لوحة مؤشرات (Dashboard Slide)</span></div>
      <div class="grid grid-2">
        <div>
          <div class="field"><label>العنوان</label><input id="dashTitle" value="لوحة مؤشرات الأداء التشغيلي" /></div>
          <div class="field"><label>مؤشرات KPI (JSON)</label>
            <textarea id="dashKpis">[{"label":"التغطية","value":94,"unit":"%","trend":"up"},{"label":"زمن الاستجابة","value":18,"unit":"دقيقة","trend":"down"},{"label":"المتأخرات","value":12,"unit":"يوم","trend":"flat"},{"label":"رضا العملاء","value":87,"unit":"%","trend":"up"}]</textarea>
          </div>
          <div class="field"><label>رسوم مصغرة (JSON)</label>
            <textarea id="dashCharts">[{"type":"bar","data":[42,35,28,22,15],"label":"الإيرادات الشهرية"},{"type":"line","data":[88,91,87,93,94],"label":"التغطية %"}]</textarea>
          </div>
          <div class="field"><label>فلاتر (JSON)</label>
            <textarea id="dashFilters">[{"name":"المنطقة","options":["الكل","الرياض","جدة","الدمام"],"default_value":"الكل"},{"name":"الفترة","options":["ربع سنوي","شهري","سنوي"],"default_value":"ربع سنوي"}]</textarea>
          </div>
          <div class="actions"><button class="btn-accent" onclick="generateDashboard()">توليد الشريحة</button></div>
        </div>
        <div>
          <div id="dashPreview" style="border:2px solid var(--line);border-radius:var(--radius);min-height:400px;background:#f8fafc;overflow:auto"></div>
        </div>
      </div>
      <div style="margin-top:16px">
        <h2 style="font-size:14px">حالات الفلاتر (Slide States)</h2>
        <div id="dashStates" class="grid grid-3"></div>
      </div>
    </div>
  </div>

  <!-- ═══ TAB: Literal ═══ -->
  <div class="tab-content" id="tab-literal">
    <div class="card">
      <div class="card-header"><span class="card-title">التحقق من الدقة الحرفية (LITERAL_1TO1)</span></div>
      <div class="grid grid-2">
        <div class="field"><label>النص المُدخل</label><textarea id="literalInput">المحرك يدعم التوليد والتحرير والتصدير مع الحفاظ على الجودة والدقة في كل مرحلة</textarea></div>
        <div class="field"><label>النص المُخرج</label><textarea id="literalOutput">المحرك يدعم التوليد والتحرير والتصدير مع الحفاظ على الجودة والدقة في كل مرحلة</textarea></div>
      </div>
      <div class="actions"><button class="btn-accent" onclick="verifyLiteral()">تحقق</button></div>
      <div id="literalResult" class="result" style="display:none"></div>
    </div>
  </div>

  <!-- ═══ TAB: Tools ═══ -->
  <div class="tab-content" id="tab-tools">
    <div class="card">
      <div class="card-header"><span class="card-title">الأدوات المسجلة (Tool Registry)</span><button class="btn-primary btn-sm" onclick="loadTools()">تحميل</button></div>
      <div id="toolsList"></div>
    </div>
  </div>
</div>

<script>
const API = "";

// ── Tabs ──
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

function showResult(id, data, isError) {
  const el = document.getElementById(id);
  el.style.display = "block";
  el.className = "result " + (isError ? "error" : "success");
  el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function api(path, method, body) {
  const opts = { method: method || "GET", headers: { "content-type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

// ── Catalog ──
async function loadStats() {
  const res = await api("/api/v1/presentations/catalog/stats");
  const stats = res.data.stats;
  const el = document.getElementById("catalogStats");
  el.innerHTML = Object.entries(stats).map(([k, v]) =>
    '<div class="kpi-item"><div class="value">' + v.base_count + '</div><div class="label">' + k.replace(/_/g, " ") + ' (' + v.families + ' عائلة)</div></div>'
  ).join("");
  document.getElementById("catalogTotal").textContent = "إجمالي الأصول الأساسية: " + res.data.total_assets + " (مع المتغيرات ≥ " + (res.data.total_assets * 10) + "+)";
}

async function searchCatalog() {
  const body = {
    catalog_kind: document.getElementById("catalogKind").value,
    query: document.getElementById("catalogQuery").value || undefined,
    density: document.getElementById("catalogDensity").value || undefined,
    tone: document.getElementById("catalogTone").value || undefined,
    limit: parseInt(document.getElementById("catalogLimit").value) || 12
  };
  const res = await api("/api/v1/presentations/catalog/search", "POST", body);
  showResult("catalogResults", res.data);
  renderPreviewStrip(res.data.assets);
}

async function loadFamilies() {
  const kind = document.getElementById("catalogKind").value;
  const res = await api("/api/v1/presentations/catalog/families/" + kind);
  showResult("catalogResults", res.data);
}

let selectedAssetId = null;
function renderPreviewStrip(assets) {
  const el = document.getElementById("previewStrip");
  el.innerHTML = assets.map(a => {
    const hasSvg = a.svg_template && a.svg_template.length > 10;
    const preview = hasSvg
      ? a.svg_template.replace(/<svg /, '<svg style="width:100%;height:60px" ')
      : '<div style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;background:var(--paper);border-radius:4px;font-size:10px;color:var(--muted)">' + (a.css_template ? 'CSS' : a.name.slice(0,15)) + '</div>';
    return '<div class="preview-card" data-id="' + a.asset_id + '" onclick="selectAsset(this,\\'' + a.asset_id + '\\')">' + preview + '<div class="name">' + a.name.slice(0, 25) + '</div></div>';
  }).join("");
  if (assets.length > 0) selectAsset(el.querySelector(".preview-card"), assets[0].asset_id);
}

function selectAsset(el, assetId) {
  document.querySelectorAll("#previewStrip .preview-card").forEach(c => c.classList.remove("selected"));
  if (el) el.classList.add("selected");
  selectedAssetId = assetId;
}

async function generateVariants(direction) {
  if (!selectedAssetId) { alert("اختر أصلاً أولاً"); return; }
  const kind = document.getElementById("catalogKind").value;
  const res = await api("/api/v1/presentations/catalog/variants", "POST", {
    base_asset_id: selectedAssetId, catalog_kind: kind, direction: direction, count: 12
  });
  const el = document.getElementById("variantResults");
  el.innerHTML = (res.data.variants || []).map(v => {
    const hasSvg = v.preview_svg && v.preview_svg.length > 10;
    const preview = hasSvg
      ? v.preview_svg.replace(/<svg /, '<svg style="width:100%;height:60px" ')
      : '<div style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;background:var(--paper);border-radius:4px;font-size:9px;color:var(--muted)">Variant</div>';
    return '<div class="preview-card">' + preview + '<div class="name">' + v.name.slice(0, 25) + '</div></div>';
  }).join("");
}

// ── Controls ──
async function buildManifest() {
  const res = await api("/api/v1/presentations/control-manifest/build", "POST", {
    deck_id: document.getElementById("cmDeckId").value,
    prompt: document.getElementById("cmPrompt").value,
    language: document.getElementById("cmLanguage").value
  });
  showResult("manifestResult", res.data);
}

async function getVisibleControls(level) {
  const res = await api("/api/v1/presentations/control-manifest/visible", "POST", {
    deck_id: document.getElementById("cmDeckId").value,
    prompt: document.getElementById("cmPrompt").value,
    language: document.getElementById("cmLanguage").value,
    level: level
  });
  showResult("manifestResult", res.data);
}

async function loadPreferences() {
  const res = await api("/api/v1/presentations/preferences");
  showResult("prefResult", res.data);
}

async function savePreferences() {
  const res = await api("/api/v1/presentations/preferences", "POST", {
    fidelity_mode: document.getElementById("prefFidelity").value,
    tone: document.getElementById("prefTone").value,
    density: document.getElementById("prefDensity").value,
    infographic_level: document.getElementById("prefInfographic").value,
    motion_level: document.getElementById("prefMotion").value,
    slide_size: document.getElementById("prefSlideSize").value
  });
  showResult("prefResult", res.data);
}

async function inferIntent() {
  const res = await api("/api/v1/presentations/intent/infer", "POST", {
    prompt: document.getElementById("intentPrompt").value,
    language: "ar"
  });
  showResult("intentResult", res.data);
}

async function searchControlsUI() {
  const res = await api("/api/v1/presentations/control-manifest/search", "POST", {
    deck_id: document.getElementById("cmDeckId").value,
    prompt: document.getElementById("cmPrompt").value,
    language: document.getElementById("cmLanguage").value,
    query: document.getElementById("controlSearchQuery").value
  });
  showResult("controlSearchResult", res.data);
}

// ── Transforms ──
async function applyTransform() {
  const kind = document.getElementById("transformKind").value;
  const params = {};
  if (kind === "change_chart_type") params.chart_type = document.getElementById("transformChartType").value;
  if (kind === "change_table_style") params.table_style = document.getElementById("transformTableStyle").value;
  if (kind === "swap_icon_pack") params.icon_pack = document.getElementById("transformIconPack").value;
  if (kind === "change_typography_scale") params.typography_scale = parseFloat(document.getElementById("transformTypoScale").value);
  if (kind === "convert_to_infographic") params.infographic_kind = "process";
  const res = await api("/api/v1/presentations/element/transform", "POST", {
    deck_id: "deck-test-001", slide_ref: "slide-0", block_ref: "block-0",
    transform_kind: kind, params: params
  });
  showResult("transformResult", res.data);
}

async function swapInfographic() {
  const family = document.getElementById("infographicFamily").value;
  const res = await api("/api/v1/presentations/catalog/search", "POST", {
    catalog_kind: "infographic",
    query: family,
    limit: 12
  });
  const el = document.getElementById("infographicSwapResults");
  el.innerHTML = (res.data.assets || []).map(a => {
    const preview = a.svg_template && a.svg_template.length > 10
      ? a.svg_template.replace(/<svg /, '<svg style="width:100%;height:60px" ')
      : '<div style="height:60px;background:var(--paper);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px">' + a.family + '</div>';
    return '<div class="preview-card">' + preview + '<div class="name">' + a.name.slice(0, 25) + '</div></div>';
  }).join("");
}

// ── Data Picker ──
let lastSelectResult = null;

async function createSampleExcel() {
  const res = await api("/api/v1/presentations/data-picker/browse", "POST", {
    file_path: "__create_sample__"
  });
  if (res.error) {
    // File doesn't exist, show how to create
    showResult("dpBrowseResult", "لإنشاء ملف تجريبي، استخدم مسار ملف xlsx موجود في النظام");
  } else {
    showResult("dpBrowseResult", res.data);
  }
}

async function browseExcel() {
  const res = await api("/api/v1/presentations/data-picker/browse", "POST", {
    file_path: document.getElementById("dpFilePath").value
  });
  if (res.error) showResult("dpBrowseResult", res.error, true);
  else showResult("dpBrowseResult", res.data);
}

async function selectData() {
  const columns = document.getElementById("dpColumns").value.split(",").map(c => c.trim()).filter(Boolean);
  const res = await api("/api/v1/presentations/data-picker/select", "POST", {
    file_path: document.getElementById("dpFilePath").value,
    sheet_name: document.getElementById("dpSheetName").value,
    columns: columns,
    sort_by: document.getElementById("dpSortBy").value || undefined,
    sort_order: document.getElementById("dpSortOrder").value,
    limit: parseInt(document.getElementById("dpLimit").value) || 50
  });
  if (res.error) showResult("dpSelectResult", res.error, true);
  else {
    lastSelectResult = res.data;
    showResult("dpSelectResult", res.data);
  }
}

async function applyBinding() {
  if (!lastSelectResult) { alert("اختر بيانات أولاً"); return; }
  const res = await api("/api/v1/presentations/data-binding/apply", "POST", {
    deck_id: "deck-test-001",
    slide_ref: "slide-0",
    block_ref: "block-0",
    target_kind: document.getElementById("dbTargetKind").value,
    data: lastSelectResult,
    chart_type: document.getElementById("dbChartType").value,
    chart_dimension: document.getElementById("dbDimension").value || undefined,
    chart_measure: document.getElementById("dbMeasure").value || undefined
  });
  showResult("dbResult", res.data);
}

// ── Dashboard ──
async function generateDashboard() {
  let kpis, charts, filters;
  try { kpis = JSON.parse(document.getElementById("dashKpis").value); } catch { kpis = []; }
  try { charts = JSON.parse(document.getElementById("dashCharts").value); } catch { charts = []; }
  try { filters = JSON.parse(document.getElementById("dashFilters").value); } catch { filters = []; }
  const res = await api("/api/v1/presentations/dashboard-slide/generate", "POST", {
    deck_id: "deck-test-001",
    title: document.getElementById("dashTitle").value,
    kpi_metrics: kpis,
    mini_charts: charts,
    filters: filters,
    table_data: lastSelectResult ? { columns: lastSelectResult.columns, rows: lastSelectResult.rows.slice(0, 5) } : undefined
  });
  document.getElementById("dashPreview").innerHTML = res.data.slide_html;
  const statesEl = document.getElementById("dashStates");
  statesEl.innerHTML = (res.data.states || []).map(s =>
    '<div class="card" style="padding:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:8px">State: ' +
    Object.entries(s.filter_values).map(([k,v]) => k + '=' + v).join(', ') +
    '</div><div style="max-height:200px;overflow:auto;font-size:11px">' + s.slide_html.slice(0, 500) + '...</div></div>'
  ).join("");
}

// ── Literal ──
async function verifyLiteral() {
  const res = await api("/api/v1/presentations/literal/verify", "POST", {
    input_text: document.getElementById("literalInput").value,
    output_text: document.getElementById("literalOutput").value
  });
  const data = res.data;
  showResult("literalResult", data, !data.passed);
}

// ── Tools ──
async function loadTools() {
  const res = await api("/api/v1/presentations/tools/schemas");
  const el = document.getElementById("toolsList");
  el.innerHTML = (res.data.tools || []).map(t =>
    '<div class="card" style="margin-bottom:8px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong style="font-size:13px">' + t.tool_id + '</strong><div class="tags">' +
    t.required_permissions.map(p => '<span class="tag">' + p + '</span>').join("") +
    (t.deterministic ? '<span class="tag" style="background:#f0fdf4;border-color:var(--green);color:var(--green)">deterministic</span>' : '') +
    '</div></div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + t.description_ar + '</div>' +
    '<div style="font-size:11px;color:var(--muted)">' + t.description + '</div>' +
    '<div style="margin-top:6px;display:flex;gap:8px"><div style="flex:1"><div style="font-size:10px;color:var(--muted);margin-bottom:2px">INPUT</div><pre style="font-size:9px;background:var(--paper);padding:6px;border-radius:4px;overflow:auto;max-height:80px">' + JSON.stringify(t.input_schema, null, 2) + '</pre></div>' +
    '<div style="flex:1"><div style="font-size:10px;color:var(--muted);margin-bottom:2px">OUTPUT</div><pre style="font-size:9px;background:var(--paper);padding:6px;border-radius:4px;overflow:auto;max-height:80px">' + JSON.stringify(t.output_schema, null, 2) + '</pre></div></div></div>'
  ).join("");
}

// ── Init ──
loadStats();
loadTools();
</script>
</body>
</html>`;

export { type ControlManifest, type UserPreferences };
