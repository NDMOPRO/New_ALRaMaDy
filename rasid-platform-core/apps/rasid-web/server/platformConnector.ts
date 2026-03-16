/**
 * Platform Connector — Multi-Engine HTTP client for ALRaMaDy Backend
 * 
 * ALL operations execute EXCLUSIVELY on Railway engines.
 * NO local DB, NO SQLite, NO local logic.
 * 
 * Each engine runs as a separate service with its own URL:
 * - Report Engine (report-start-platform)
 * - Presentations Engine (presentations-serve-app)
 * - Dashboard Publications (dashboard-serve-publications)
 * - Transcription Engine (transcription-serve-web)
 * - Central Backend (New_ALRaMaDy) — unified gateway
 */

// ─── Engine URLs ────────────────────────────────────────────────

/** Central backend (unified gateway) — fallback for all engines */
const PLATFORM_URL = process.env.RASID_PLATFORM_URL || "http://localhost:4310";

/** Individual engine URLs on Railway */
const ENGINE_URLS = {
  /** Report engine — handles report CRUD, publish, export */
  report: process.env.RASID_REPORT_ENGINE_URL || PLATFORM_URL,
  /** Presentations engine — handles deck CRUD, slides, export */
  presentations: process.env.RASID_PRESENTATIONS_ENGINE_URL || PLATFORM_URL,
  /** Dashboard publications — serves published dashboard assets */
  dashboardPublications: process.env.RASID_DASHBOARD_PUB_URL || PLATFORM_URL,
  /** Transcription engine — audio/video transcription */
  transcription: process.env.RASID_TRANSCRIPTION_ENGINE_URL || PLATFORM_URL,
  /** Central backend — AI, governance, data, canvas, auth, users */
  central: PLATFORM_URL,
} as const;

/** Engine type for routing */
type EngineKey = keyof typeof ENGINE_URLS;

/** Map API path prefixes to their engine */
function resolveEngine(path: string): { url: string; engine: EngineKey } {
  if (path.startsWith("/api/v1/reports/") || path.startsWith("/api/v1/reports")) {
    return { url: ENGINE_URLS.report, engine: "report" };
  }
  if (path.startsWith("/api/v1/presentations/") || path.startsWith("/api/v1/presentations")) {
    return { url: ENGINE_URLS.presentations, engine: "presentations" };
  }
  if (path.startsWith("/api/v1/transcription/") || path.startsWith("/api/v1/transcription")) {
    return { url: ENGINE_URLS.transcription, engine: "transcription" };
  }
  if (path.startsWith("/publications/")) {
    return { url: ENGINE_URLS.dashboardPublications, engine: "dashboardPublications" };
  }
  // Everything else goes to central backend
  return { url: ENGINE_URLS.central, engine: "central" };
}

/** Auth credentials for the unified gateway */
const PLATFORM_EMAIL = process.env.RASID_PLATFORM_EMAIL || "admin";
const PLATFORM_PASSWORD = process.env.RASID_PLATFORM_PASSWORD || "1500";

/** Default tenant/workspace/project for gateway auth */
const DEFAULT_TENANT = process.env.RASID_TENANT_REF || "tenant-dashboard-web";
const DEFAULT_WORKSPACE = process.env.RASID_WORKSPACE_ID || "workspace-dashboard-web";
const DEFAULT_PROJECT = process.env.RASID_PROJECT_ID || "project-dashboard-web";
const DEFAULT_ACTOR = process.env.RASID_ACTOR_REF || "admin";

// ─── Types ───────────────────────────────────────────────────────

export interface PlatformAuth {
  token: string;
  tenantRef: string;
  workspaceId: string;
  projectId: string;
  actorRef: string;
}

export interface PlatformResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  governance?: Record<string, unknown>;
  error?: string;
}

export interface PlatformError {
  ok: false;
  status: number;
  error: string;
  details?: unknown;
}

// ─── Per-Engine Auth Cache ──────────────────────────────────────

interface CachedEngineAuth {
  auth: PlatformAuth;
  expiry: number;
}

/** Each engine has its own auth session */
const authCache = new Map<string, CachedEngineAuth>();

/**
 * Authenticate with a specific engine and cache the token.
 * Each engine maintains its own session independently.
 */
export async function platformLogin(engineUrl?: string): Promise<PlatformAuth> {
  const url = engineUrl || PLATFORM_URL;
  const cached = authCache.get(url);
  
  // Return cached auth if still valid (1 hour TTL)
  if (cached && Date.now() < cached.expiry) {
    return cached.auth;
  }

  try {
    const response = await fetch(`${url}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: PLATFORM_EMAIL,
        username: PLATFORM_EMAIL,
        password: PLATFORM_PASSWORD,
        tenant_ref: DEFAULT_TENANT,
        workspace_id: DEFAULT_WORKSPACE,
        project_id: DEFAULT_PROJECT,
        actor_ref: DEFAULT_ACTOR,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Platform login failed (${url}): ${response.status} — ${text}`);
    }

    const result = await response.json();
    
    const cookies = response.headers.getSetCookie?.() || [];
    const cookieString = cookies.join("; ");

    const auth: PlatformAuth = {
      token: result.data?.accessToken || cookieString || "platform-token",
      tenantRef: result.data?.tenantRef || DEFAULT_TENANT,
      workspaceId: DEFAULT_WORKSPACE,
      projectId: DEFAULT_PROJECT,
      actorRef: result.data?.actorRef || DEFAULT_ACTOR,
    };
    
    authCache.set(url, { auth, expiry: Date.now() + 60 * 60 * 1000 });
    
    console.log(`[PlatformConnector] ✅ Authenticated with ${url}`);
    return auth;
  } catch (error) {
    console.error(`[PlatformConnector] ❌ Login failed (${url}):`, error);
    const fallback: PlatformAuth = {
      token: "dev-fallback-token",
      tenantRef: DEFAULT_TENANT,
      workspaceId: DEFAULT_WORKSPACE,
      projectId: DEFAULT_PROJECT,
      actorRef: DEFAULT_ACTOR,
    };
    authCache.set(url, { auth: fallback, expiry: Date.now() + 5 * 60 * 1000 });
    return fallback;
  }
}

/**
 * Clear cached auth for a specific engine or all engines
 */
export function clearPlatformAuth(engineUrl?: string): void {
  if (engineUrl) {
    authCache.delete(engineUrl);
  } else {
    authCache.clear();
  }
}

// ─── HTTP Client ─────────────────────────────────────────────────

/**
 * Build request headers with auth tokens.
 * Uses both Cookie and Authorization header for maximum compatibility.
 */
function buildHeaders(auth: PlatformAuth, extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${auth.token}`,
    "Cookie": [
      `rasid_access_token=${auth.token}`,
      `rasid_auth=${auth.token}`,
      `rasid_tenant=${auth.tenantRef}`,
      `rasid_tenant_ref=${auth.tenantRef}`,
      `rasid_workspace=${auth.workspaceId}`,
      `rasid_project=${auth.projectId}`,
      `rasid_actor=${auth.actorRef}`,
    ].join("; "),
    "x-tenant-id": auth.tenantRef,
    "x-tenant-ref": auth.tenantRef,
    ...extra,
  };
}

/**
 * Make an authenticated GET request to the platform API.
 * Automatically routes to the correct engine based on path prefix.
 */
export async function platformGet<T = unknown>(
  path: string,
  params?: Record<string, string>,
  retryCount = 0
): Promise<PlatformResponse<T>> {
  const { url: engineUrl, engine } = resolveEngine(path);
  
  try {
    const auth = await platformLogin(engineUrl);
    const url = new URL(`${engineUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: buildHeaders(auth),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      if (response.status === 401 && retryCount < 1) {
        clearPlatformAuth(engineUrl);
        return platformGet<T>(path, params, retryCount + 1);
      }
      if (response.status === 429 && retryCount < 2) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        console.warn(`[PlatformConnector] Rate limited on ${engine}. Retrying after ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return platformGet<T>(path, params, retryCount + 1);
      }
      if (response.status >= 500 && retryCount < 2) {
        const backoff = Math.pow(2, retryCount) * 1000;
        console.warn(`[PlatformConnector] ${engine} error ${response.status}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        return platformGet<T>(path, params, retryCount + 1);
      }
      return {
        ok: false,
        status: response.status,
        data: data as T,
        governance: data.governance,
        error: data.message || data.error || `HTTP ${response.status} ${response.statusText}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: data as T,
      governance: data.governance,
    };
  } catch (err: any) {
    if (retryCount < 2) {
      const backoff = Math.pow(2, retryCount) * 1000;
      console.warn(`[PlatformConnector] GET ${engine}${path} failed: ${err.message}. Retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      return platformGet<T>(path, params, retryCount + 1);
    }
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: err.name === 'AbortError' ? 'Request timed out' : err.message,
    };
  }
}

/**
 * Make an authenticated POST request to the platform API.
 * Automatically routes to the correct engine based on path prefix.
 */
export async function platformPost<T = unknown>(
  path: string,
  body: unknown,
  retryCount = 0
): Promise<PlatformResponse<T>> {
  const { url: engineUrl, engine } = resolveEngine(path);
  
  try {
    const auth = await platformLogin(engineUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${engineUrl}${path}`, {
      method: "POST",
      headers: buildHeaders(auth),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && retryCount < 1) {
        clearPlatformAuth(engineUrl);
        return platformPost<T>(path, body, retryCount + 1);
      }
      if (response.status === 429 && retryCount < 2) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        console.warn(`[PlatformConnector] Rate limited on POST ${engine}${path}. Retrying after ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return platformPost<T>(path, body, retryCount + 1);
      }
      if (response.status >= 500 && retryCount < 1) {
        const backoff = Math.pow(2, retryCount) * 1000;
        console.warn(`[PlatformConnector] ${engine} error ${response.status} on POST ${path}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        return platformPost<T>(path, body, retryCount + 1);
      }
      return {
        ok: false,
        status: response.status,
        data: data as T,
        governance: data.governance,
        error: data.message || data.error || `HTTP ${response.status} ${response.statusText}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: data as T,
      governance: data.governance,
    };
  } catch (err: any) {
    if (retryCount < 1) {
      const backoff = Math.pow(2, retryCount) * 1000;
      console.warn(`[PlatformConnector] POST ${engine}${path} failed: ${err.message}. Retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      return platformPost<T>(path, body, retryCount + 1);
    }
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: err.name === 'AbortError' ? 'Request timed out' : err.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// USER AUTH — via Central Engine (governance/auth)
// ═══════════════════════════════════════════════════════════════════

export interface EngineUser {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  department: string | null;
  avatar: string | null;
  status: string;
  permissions: string[];
  createdAt: string;
  lastSignedIn: string;
}

/** Login a user via the central engine */
export async function engineLogin(userId: string, password: string): Promise<PlatformResponse<{
  user: EngineUser;
  token: string;
}>> {
  return platformPost("/api/v1/governance/auth/login", {
    email: userId,
    username: userId,
    password,
    tenant_ref: DEFAULT_TENANT,
    workspace_id: DEFAULT_WORKSPACE,
    project_id: DEFAULT_PROJECT,
    actor_ref: userId,
  });
}

/** Register a user via the central engine */
export async function engineRegister(data: {
  userId: string;
  password: string;
  displayName: string;
  email?: string;
  mobile?: string;
  department?: string;
}): Promise<PlatformResponse<{ user: EngineUser; token: string }>> {
  return platformPost("/api/v1/governance/auth/register", {
    username: data.userId,
    email: data.email || `${data.userId}@rasid.local`,
    password: data.password,
    display_name: data.displayName,
    mobile: data.mobile,
    department: data.department,
    tenant_ref: DEFAULT_TENANT,
    workspace_id: DEFAULT_WORKSPACE,
    project_id: DEFAULT_PROJECT,
    actor_ref: data.userId,
    role: "user",
    permissions: ["view_analytics", "create_reports"],
  });
}

/** Get current user profile from engine token */
export async function engineGetProfile(token: string): Promise<PlatformResponse<EngineUser>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${ENGINE_URLS.central}/api/v1/governance/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Cookie": `rasid_access_token=${token}; rasid_auth=${token}`,
        "x-tenant-ref": DEFAULT_TENANT,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data: data as EngineUser };
  } catch (err: any) {
    clearTimeout(timeout);
    return { ok: false, status: 0, data: {} as EngineUser, error: err.message };
  }
}

/** List all users from the engine (admin) */
export async function engineListUsers(): Promise<PlatformResponse<EngineUser[]>> {
  return platformGet("/api/v1/governance/users");
}

// ═══════════════════════════════════════════════════════════════════
// FILE MANAGEMENT — via Central Engine (data)
// ═══════════════════════════════════════════════════════════════════

/** Upload file metadata to engine */
export async function engineCreateFile(data: {
  title: string;
  type?: string;
  category?: string;
  status?: string;
  icon?: string;
  size?: string;
  filePath?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  actorRef?: string;
}): Promise<PlatformResponse> {
  return platformPost("/api/v1/data/register", {
    title: data.title,
    source_kind: data.type || "file",
    category: data.category,
    status: data.status || "ready",
    icon: data.icon,
    size: data.size,
    file_path: data.filePath,
    mime_type: data.mimeType,
    metadata: data.metadata,
    tags: data.tags,
    actor_ref: data.actorRef,
  });
}

/** List files from engine */
export async function engineListFiles(actorRef?: string): Promise<PlatformResponse> {
  const params = actorRef ? { actor_ref: actorRef } : undefined;
  return platformGet("/api/v1/data/list", params);
}

/** Delete file from engine */
export async function engineDeleteFile(fileId: string): Promise<PlatformResponse> {
  return platformPost("/api/v1/data/delete", { id: fileId });
}

// ═══════════════════════════════════════════════════════════════════
// CHAT — via Central Engine (AI)
// ═══════════════════════════════════════════════════════════════════

/** Send chat message via AI engine */
export async function engineChat(sessionId: string, message: string, context?: string): Promise<PlatformResponse> {
  return platformPost("/api/v1/ai/jobs", {
    page_path: "/chat",
    session_id: sessionId,
    prompt: message,
    context,
  });
}

/** Get chat history from AI engine */
export async function engineChatHistory(sessionId: string): Promise<PlatformResponse> {
  return platformGet("/api/v1/ai/jobs", { session_id: sessionId });
}

// ═══════════════════════════════════════════════════════════════════
// AI Engine
// ═══════════════════════════════════════════════════════════════════

export interface AIJobRequest {
  page_path: string;
  session_id: string;
  prompt: string;
  resource_ref?: string;
  approval_granted?: boolean;
}

export interface AIJobResult {
  job: {
    job_id: string;
    status: string;
    outcome?: string;
    result?: unknown;
  };
  summary?: {
    outcome: string;
    approval_state: string;
    result_artifact_refs?: string[];
  };
  governance?: Record<string, unknown>;
}

export async function submitAIJob(request: AIJobRequest): Promise<PlatformResponse<AIJobResult>> {
  return platformPost<AIJobResult>("/api/v1/ai/jobs", request);
}

export async function listAIJobs(sessionId?: string): Promise<PlatformResponse<{ jobs: AIJobResult[] }>> {
  const params = sessionId ? { session_id: sessionId } : undefined;
  return platformGet<{ jobs: AIJobResult[] }>("/api/v1/ai/jobs", params);
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard Engine
// ═══════════════════════════════════════════════════════════════════

export interface DashboardCreateRequest {
  title: string;
  mode?: "easy" | "advanced";
  dataset_refs?: string[];
  template_id?: string;
}

export async function createDashboard(request: DashboardCreateRequest) {
  return platformPost("/api/v1/dashboards/create", request);
}

export async function createDashboardFromTemplate(templateId: string, datasetRefs: string[]) {
  return platformPost("/api/v1/dashboards/create-from-template", {
    template_id: templateId,
    dataset_refs: datasetRefs,
  });
}

export async function getDashboardState(dashboardId?: string) {
  const params = dashboardId ? { dashboard_id: dashboardId } : undefined;
  return platformGet("/api/v1/dashboards/state", params);
}

export async function getDashboardVersions(dashboardId: string) {
  return platformGet("/api/v1/dashboards/versions", { dashboard_id: dashboardId });
}

export async function addDashboardWidget(dashboardId: string, widget: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/add-widget", { dashboard_id: dashboardId, ...widget });
}

export async function moveDashboardWidget(dashboardId: string, widgetRef: string, position: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/move-widget", { dashboard_id: dashboardId, widget_ref: widgetRef, ...position });
}

export async function configDashboardWidget(dashboardId: string, widgetRef: string, config: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/widget-config", { dashboard_id: dashboardId, widget_ref: widgetRef, ...config });
}

export async function rebindDashboardWidget(dashboardId: string, widgetRef: string, datasetRef: string) {
  return platformPost("/api/v1/dashboards/rebind-widget", { dashboard_id: dashboardId, widget_ref: widgetRef, dataset_ref: datasetRef });
}

export async function refreshDashboard(dashboardId: string) {
  return platformPost("/api/v1/dashboards/refresh", { dashboard_id: dashboardId });
}

export async function compareDashboards(dashboardId: string, versionA?: string, versionB?: string) {
  return platformPost("/api/v1/dashboards/compare", { dashboard_id: dashboardId, version_a: versionA, version_b: versionB });
}

export async function compareDashboardsAdvanced(dashboardId: string, options: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/compare-advanced", { dashboard_id: dashboardId, ...options });
}

export async function publishDashboard(dashboardId: string) {
  return platformPost("/api/v1/dashboards/publish", { dashboard_id: dashboardId });
}

export async function shareDashboard(dashboardId: string, options?: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/share", { dashboard_id: dashboardId, ...options });
}

export async function scheduleDashboard(dashboardId: string, schedule: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/schedule", { dashboard_id: dashboardId, ...schedule });
}

export async function saveDashboardTemplate(dashboardId: string, name: string) {
  return platformPost("/api/v1/dashboards/save-template", { dashboard_id: dashboardId, name });
}

export async function getDashboardTemplates() {
  return platformGet("/api/v1/dashboards/templates");
}

export async function getDashboardLibrary() {
  return platformGet("/api/v1/dashboards/library");
}

export async function exportDashboardWidget(dashboardId: string, widgetRef: string, targetKind: string) {
  return platformPost("/api/v1/dashboards/export-widget-target", { dashboard_id: dashboardId, widget_ref: widgetRef, target_kind: targetKind });
}

export async function simulateDashboardDesign(dashboardId: string, designParams: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/simulate-design", { dashboard_id: dashboardId, ...designParams });
}

export async function saveDashboardFilterPreset(dashboardId: string, preset: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/save-filter-preset", { dashboard_id: dashboardId, ...preset });
}

export async function applySavedFilter(dashboardId: string, filterId: string) {
  return platformPost("/api/v1/dashboards/apply-saved-filter", { dashboard_id: dashboardId, filter_id: filterId });
}

export async function getSavedFilters(dashboardId: string) {
  return platformGet("/api/v1/dashboards/saved-filters", { dashboard_id: dashboardId });
}

export async function addDashboardPage(dashboardId: string, page: Record<string, unknown>) {
  return platformPost("/api/v1/dashboards/add-page", { dashboard_id: dashboardId, ...page });
}

// ═══════════════════════════════════════════════════════════════════
// Report Engine
// ═══════════════════════════════════════════════════════════════════

export async function listReports() {
  return platformGet("/api/v1/reports/reports");
}

export async function createReport(request: Record<string, unknown>) {
  return platformPost("/api/v1/reports/reports/create", request);
}

export async function createReportFromExcel(request: Record<string, unknown>) {
  return platformPost("/api/v1/reports/reports/create-from-excel", request);
}

export async function createReportFromTranscription(transcriptionJobId: string, options?: Record<string, unknown>) {
  return platformPost("/api/v1/reports/reports/create-from-transcription", { transcription_job_id: transcriptionJobId, ...options });
}

export async function importReport(request: Record<string, unknown>) {
  return platformPost("/api/v1/reports/reports/import", request);
}

export async function getReportDetail(reportId: string) {
  return platformGet(`/api/v1/reports/reports/${reportId}`);
}

export async function refreshReport(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/refresh`, {});
}

export async function updateReport(reportId: string, blockRef: string, body: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/update`, { block_ref: blockRef, body });
}

export async function compareReport(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/compare`, {});
}

export async function reviewReport(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/review`, {});
}

export async function approveReport(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/approve`, {});
}

export async function publishReport(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/publish`, {});
}

export async function publishReportDegraded(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/publish-degraded`, {});
}

export async function exportReportHtml(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/export/html`, {});
}

export async function exportReportPdf(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/export/pdf`, {});
}

export async function exportReportDocx(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/export/docx`, {});
}

export async function convertReportToPresentation(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/convert/presentation`, { target_ref: `platform://presentations/${reportId}` });
}

export async function convertReportToDashboard(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/convert/dashboard`, { target_ref: `platform://dashboards/${reportId}` });
}

export async function scheduleReport(reportId: string) {
  return platformPost(`/api/v1/reports/reports/${reportId}/schedules`, {});
}

// ═══════════════════════════════════════════════════════════════════
// Presentation Engine
// ═══════════════════════════════════════════════════════════════════

export async function listPresentations() {
  return platformGet("/api/v1/presentations/decks");
}

export async function createPresentation(request: Record<string, unknown>) {
  return platformPost("/api/v1/presentations/decks/create", request);
}

export async function getPresentationDetail(deckId: string) {
  return platformGet(`/api/v1/presentations/decks/${deckId}`);
}

export async function createPresentationFromCanvas(canvasData: Record<string, unknown>) {
  return platformPost("/api/v1/presentations/create-from-canvas", canvasData);
}

export async function convertPresentationToDashboard(deckId: string) {
  return platformPost("/api/v1/presentations/convert-to-dashboard", { deck_id: deckId });
}

// ═══════════════════════════════════════════════════════════════════
// Transcription Engine
// ═══════════════════════════════════════════════════════════════════

export interface TranscriptionJobRequest {
  file_path?: string;
  file_url?: string;
  file_name: string;
  language?: string;
}

export async function startTranscriptionJob(request: TranscriptionJobRequest) {
  return platformPost("/api/v1/transcription/jobs/start", request);
}

export async function listTranscriptionJobs() {
  return platformGet("/api/v1/transcription/jobs");
}

// ═══════════════════════════════════════════════════════════════════
// Data Management
// ═══════════════════════════════════════════════════════════════════

export interface DatasetRegistration {
  title: string;
  source_kind: string;
  file_path?: string;
  rows?: Array<Record<string, unknown>>;
  field_names?: string[];
}

export async function registerDataset(dataset: DatasetRegistration) {
  return platformPost("/api/v1/data/register", dataset);
}

export async function listDatasets() {
  return platformGet("/api/v1/data/list");
}

export async function getCanvasState() {
  return platformGet("/api/v1/canvas/state");
}

// ═══════════════════════════════════════════════════════════════════
// Governance Engine
// ═══════════════════════════════════════════════════════════════════

export async function getGovernanceState() {
  return platformGet("/api/v1/governance/state");
}

export async function getGovernanceRoles() {
  return platformGet("/api/v1/governance/roles");
}

export async function createGovernanceRole(role: Record<string, unknown>) {
  return platformPost("/api/v1/governance/roles", role);
}

export async function getGovernanceAssignments() {
  return platformGet("/api/v1/governance/assignments");
}

export async function getGovernancePolicies() {
  return platformGet("/api/v1/governance/policies");
}

export async function getGovernanceApprovals() {
  return platformGet("/api/v1/governance/approvals");
}

export async function getGovernanceEvidence() {
  return platformGet("/api/v1/governance/evidence");
}

export async function createGovernanceEvidence(evidence: Record<string, unknown>) {
  return platformPost("/api/v1/governance/evidence/create", evidence);
}

export async function getGovernanceAudit() {
  return platformGet("/api/v1/governance/audit");
}

export async function getGovernanceLineage() {
  return platformGet("/api/v1/governance/lineage");
}

export async function getGovernanceKpis() {
  return platformGet("/api/v1/governance/kpis");
}

export async function getGovernanceLibrary() {
  return platformGet("/api/v1/governance/library");
}

export async function getGovernanceCompliance() {
  return platformGet("/api/v1/governance/compliance");
}

export async function checkGovernanceCompliance(payload: Record<string, unknown>) {
  return platformPost("/api/v1/governance/compliance/check", payload);
}

export async function scanGovernancePrompt(prompt: string, context?: string) {
  return platformPost("/api/v1/governance/prompts/scan", { text: prompt, context });
}

export async function getGovernancePermissions() {
  return platformGet("/api/v1/governance/permissions");
}

export async function getGovernanceSecurity() {
  return platformGet("/api/v1/governance/security");
}

export async function getGovernanceVersions() {
  return platformGet("/api/v1/governance/versions");
}

export async function getGovernanceDiffs() {
  return platformGet("/api/v1/governance/diffs");
}

export async function getGovernanceReplays() {
  return platformGet("/api/v1/governance/replays");
}

export async function getGovernanceWritePaths() {
  return platformGet("/api/v1/governance/write-paths");
}

export async function getGovernanceActionRegistry() {
  return platformGet("/api/v1/governance/registry/actions");
}

export async function getGovernanceToolRegistry() {
  return platformGet("/api/v1/governance/registry/tools");
}

export async function getGovernancePromptScans() {
  return platformGet("/api/v1/governance/prompt-scans");
}

// ═══════════════════════════════════════════════════════════════════
// Localization
// ═══════════════════════════════════════════════════════════════════

export interface LocalizationRequest {
  source_locale: string;
  target_locale: string;
  items: Array<{ node_id: string; text: string }>;
}

export async function localizeDashboard(dashboardId: string, targetLocale: string) {
  return platformPost("/api/v1/localization/localize-dashboard", { dashboard_id: dashboardId, target_locale: targetLocale });
}

export async function liveTranslation(request: LocalizationRequest) {
  const auth = await platformLogin(ENGINE_URLS.central);
  const response = await fetch(`${ENGINE_URLS.central}/api/v1/ai/providers/live-translation`, {
    method: "POST",
    headers: {
      ...buildHeaders(auth),
      "x-ai-provider-bridge": "1",
      "x-tenant-ref": auth.tenantRef,
      "x-actor-ref": auth.actorRef,
    },
    body: JSON.stringify(request),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export async function consumeLocalizationOutput(payload: Record<string, unknown>) {
  return platformPost("/api/v1/localization/consume-dashboard-output", payload);
}

// ═══════════════════════════════════════════════════════════════════
// Strict Replication
// ═══════════════════════════════════════════════════════════════════

export async function consumeReplicationOutput(payload: Record<string, unknown>) {
  return platformPost("/api/v1/replication/consume-dashboard-output", payload);
}

// ═══════════════════════════════════════════════════════════════════
// GraphQL
// ═══════════════════════════════════════════════════════════════════

export async function graphqlQuery(query: string, variables?: Record<string, unknown>) {
  return platformPost("/api/v1/graphql", { query, variables });
}

// ═══════════════════════════════════════════════════════════════════
// Admin — via Governance Engine
// ═══════════════════════════════════════════════════════════════════

export async function engineGetAdminStats(): Promise<PlatformResponse> {
  // Aggregate stats from governance
  const [state, kpis, compliance] = await Promise.all([
    getGovernanceState(),
    getGovernanceKpis(),
    getGovernanceCompliance(),
  ]);
  return {
    ok: true,
    status: 200,
    data: {
      governance: state.data,
      kpis: kpis.data,
      compliance: compliance.data,
    },
  };
}

export async function engineGetRecentActivity(): Promise<PlatformResponse> {
  return getGovernanceAudit();
}

export async function engineGetAllContent(): Promise<PlatformResponse> {
  // Aggregate content from all engines
  const [reports, presentations, dashboards, datasets] = await Promise.all([
    listReports(),
    listPresentations(),
    getDashboardState(),
    listDatasets(),
  ]);
  return {
    ok: true,
    status: 200,
    data: {
      reports: reports.data,
      presentations: presentations.data,
      dashboards: dashboards.data,
      datasets: datasets.data,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════

export async function platformHealthCheck(): Promise<{
  connected: boolean;
  engines: Record<string, { connected: boolean; url: string; error?: string }>;
}> {
  const results: Record<string, { connected: boolean; url: string; error?: string }> = {};
  
  for (const [name, url] of Object.entries(ENGINE_URLS)) {
    try {
      const testPath = name === "dashboardPublications" 
        ? "/" 
        : "/api/v1/governance/auth/login";
      
      const response = await fetch(`${url}${testPath}`, {
        method: name === "dashboardPublications" ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: name === "dashboardPublications" ? undefined : JSON.stringify({ email: "test" }),
        signal: AbortSignal.timeout(5000),
      });
      
      results[name] = {
        connected: true,
        url,
      };
    } catch (error) {
      results[name] = {
        connected: false,
        url,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    connected: Object.values(results).some(r => r.connected),
    engines: results,
  };
}

// ═══════════════════════════════════════════════════════════════════
// WebSocket Connection
// ═══════════════════════════════════════════════════════════════════

export function getPlatformWebSocketUrl(): string {
  const wsUrl = PLATFORM_URL.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsUrl}/ws/dashboards`;
}

// ═══════════════════════════════════════════════════════════════════
// Engine Info (for debugging)
// ═══════════════════════════════════════════════════════════════════

export function getEngineUrls() {
  return { ...ENGINE_URLS };
}
