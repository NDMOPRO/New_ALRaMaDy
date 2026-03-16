import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { RasidAiEngine } from "@rasid/ai-engine";
import {
  TranscriptionExtractionEngine,
  TranscriptionExtractionStore,
  type TranscriptionCompareBundle,
  type TranscriptionWorkflowResult
} from "@rasid/transcription-extraction-engine";

type AuthContext = {
  token: string;
  tenantRef: string;
  workspaceId: string;
  projectId: string;
};

type TranscriptionWebServerOptions = {
  host?: string;
  port?: number;
  storageDir?: string;
};

const IS_MANAGED_RUNTIME = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.PORT);
const HOST = process.env.RASID_TRANSCRIPTION_WEB_HOST ?? (IS_MANAGED_RUNTIME ? "0.0.0.0" : "127.0.0.1");
const PORT = Number(process.env.RASID_TRANSCRIPTION_WEB_PORT ?? process.env.PORT ?? "4320");
const ROOT = path.join(process.cwd(), ".runtime", "transcription-web");
const ENGINE_ROOT = path.join(ROOT, "transcription-engine");
const AI_ROOT = path.join(ROOT, "ai-engine");
const TOKEN = createHash("sha256").update("rasid-transcription-web").digest("hex");
const LOGIN_EMAIL = "admin";
const LOGIN_PASSWORD = "1500";
const COOKIE_TOKEN = "rasid_auth";
const COOKIE_TENANT = "rasid_tenant";
const COOKIE_WORKSPACE = "rasid_workspace";
const COOKIE_PROJECT = "rasid_project";

let server: Server | null = null;

const inferInputKind = (fileName: string, mediaType?: string): string => {
  const lowerName = fileName.toLowerCase();
  const extension = path.extname(lowerName);
  if ((mediaType ?? "").startsWith("audio/") || [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"].includes(extension)) return "audio_file";
  if ((mediaType ?? "").startsWith("video/") || [".mp4", ".mov", ".avi", ".webm", ".mkv"].includes(extension)) return "video_file";
  if (extension === ".pdf") return lowerName.includes("scan") ? "scanned_document" : "pdf";
  if ([".xlsx", ".xlsm", ".csv"].includes(extension)) return "spreadsheet_file";
  if ((mediaType ?? "").startsWith("image/") || [".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"].includes(extension)) {
    if (lowerName.includes("table") || lowerName.includes("grid") || lowerName.includes("sheet")) return "image_table";
    return "image_text";
  }
  return "mixed_attachment";
};

const ensureDir = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const parseCookies = (request: IncomingMessage): Record<string, string> =>
  (request.headers.cookie ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, pair) => {
      const [name, ...rest] = pair.split("=");
      accumulator[name] = decodeURIComponent(rest.join("="));
      return accumulator;
    }, {});

const requestUrl = (request: IncomingMessage): URL => new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

const parseBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body.length > 0 ? (JSON.parse(body) as unknown) : {};
};

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const sendHtml = (response: ServerResponse, html: string): void => {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
};

const setCookie = (response: ServerResponse, name: string, value: string): void => {
  const current = response.getHeader("set-cookie");
  const next = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  response.setHeader("set-cookie", [...(Array.isArray(current) ? current : current ? [String(current)] : []), next]);
};

const authenticate = (request: IncomingMessage): AuthContext | null => {
  const cookies = parseCookies(request);
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? cookies[COOKIE_TOKEN] ?? "";
  const tenantRef = String(request.headers["x-tenant-ref"] ?? cookies[COOKIE_TENANT] ?? "");
  if (token !== TOKEN || tenantRef.length === 0) {
    return null;
  }
  return {
    token,
    tenantRef,
    workspaceId: cookies[COOKIE_WORKSPACE] ?? "workspace-transcription-web",
    projectId: cookies[COOKIE_PROJECT] ?? "project-transcription-web"
  };
};

const authMiddleware = (request: IncomingMessage, response: ServerResponse): AuthContext | null => {
  const auth = authenticate(request);
  if (!auth) {
    sendJson(response, 401, { error: "unauthorized", login_path: "/login" });
    return null;
  }
  return auth;
};

const engine = () => new TranscriptionExtractionEngine({ storageDir: ENGINE_ROOT });
const store = () => new TranscriptionExtractionStore(ENGINE_ROOT);
const aiEngine = () => new RasidAiEngine({ storageDir: AI_ROOT });

const defaultAiPermissionScope = () => ({
  visibility: "workspace" as const,
  allow_read: true,
  allow_write: true,
  allow_share: false,
  allow_publish: false,
  allow_audit_view: true
});

const mapWorkflow = (workflow: TranscriptionWorkflowResult) => ({
  job: workflow.job,
  bundle: workflow.bundle,
  evidence: workflow.evidencePack,
  audit: workflow.auditEvents,
  lineage: workflow.lineageEdges,
  report_handoff: workflow.reportHandoff,
  query_dataset: workflow.queryDataset
});

const loadJobSnapshot = (jobId: string) => {
  const currentStore = store();
  const job = currentStore.loadJob(jobId);
  const bundle = currentStore.loadBundleByJob(jobId);
  return {
    job,
    bundle,
    audit: currentStore.listAuditEvents(jobId),
    lineage: currentStore.listLineageEdges(jobId),
    questions: currentStore.listQuestions(jobId)
  };
};

const latestJobRecords = () =>
  store()
    .listJobs()
    .sort((left, right) => String(right.finished_at ?? right.started_at ?? "").localeCompare(String(left.finished_at ?? left.started_at ?? "")));

const latestBundleRefs = (limit = 2): string[] =>
  latestJobRecords()
    .slice(0, limit)
    .flatMap((job) => {
      try {
        return [String(store().loadBundleByJob(job.job_id).bundle_id ?? "")];
      } catch {
        return [];
      }
    })
    .filter((value) => value.length > 0);

const latestTranscriptionSummary = (): Record<string, unknown> => {
  const latestJob = latestJobRecords()[0];
  if (!latestJob) {
    return { available: false };
  }
  const bundle = store().loadBundleByJob(latestJob.job_id);
  return {
    available: true,
    job_id: latestJob.job_id,
    bundle_id: bundle.bundle_id,
    state: latestJob.state,
    finished_at: latestJob.finished_at,
    source_count: Array.isArray(bundle.sources) ? bundle.sources.length : 0,
    segment_count: Array.isArray(bundle.segments) ? bundle.segments.length : 0,
    field_count: Array.isArray(bundle.fields) ? bundle.fields.length : 0,
    table_count: Array.isArray(bundle.tables) ? bundle.tables.length : 0,
    disagreement_count: Array.isArray(bundle.disagreements) ? bundle.disagreements.length : 0,
    verification_status:
      bundle.verification_gate?.exact === true
        ? "exact"
        : bundle.verification_gate
          ? "inexact"
          : "unknown",
    bundle_refs: latestBundleRefs(2)
  };
};

const resolveAiContextPayload = (resourceRef?: string | null) => {
  const bundleRefs = latestBundleRefs(2);
  const currentArtifactRef = resourceRef && resourceRef.length > 0 ? resourceRef : bundleRefs[0] ?? null;
  return {
    currentArtifactRef,
    sourceRefs: currentArtifactRef ? [currentArtifactRef] : [],
    contextPayload: {
      transcription_summary: latestTranscriptionSummary(),
      transcription_storage_dir: ENGINE_ROOT,
      bundle_refs: bundleRefs,
      transcription_domain: "bundle/extraction/report-handoff/query-dataset/compare"
    },
    permissionScope: defaultAiPermissionScope(),
    governanceTags: ["transcription_surface", "approval_required_for_apply", "audit_aware"]
  };
};

const aiApiPayload = (bundle: Awaited<ReturnType<RasidAiEngine["submitJob"]>> | ReturnType<RasidAiEngine["getJob"]>) => ({
  job_id: bundle.job.job_id,
  state: bundle.job.state,
  approval_boundary: bundle.approval_boundary,
  plan: bundle.plan,
  context: bundle.context,
  summary: bundle.summary,
  open_path: bundle.open_path,
  endpoints: {
    status: `/api/v1/ai/jobs/${bundle.job.job_id}/status`,
    result: `/api/v1/ai/jobs/${bundle.job.job_id}/result`,
    evidence: `/api/v1/ai/jobs/${bundle.job.job_id}/evidence`,
    audit: `/api/v1/ai/jobs/${bundle.job.job_id}/audit`,
    lineage: `/api/v1/ai/jobs/${bundle.job.job_id}/lineage`
  }
});

const handleApi = async (request: IncomingMessage, response: ServerResponse, auth: AuthContext): Promise<boolean> => {
  const url = requestUrl(request);
  if (request.method === "GET" && url.pathname === "/api/v1/ai/jobs") {
    sendJson(response, 200, { jobs: aiEngine().listJobs(url.searchParams.get("session_id") ?? undefined) });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/ai/jobs") {
    const body = (await parseBody(request)) as {
      page_path: "/transcription";
      session_id: string;
      prompt: string;
      resource_ref?: string | null;
      approval_granted?: boolean;
    };
    const resolved = resolveAiContextPayload(body.resource_ref ?? null);
    const bundle = await aiEngine().submitJob({
      session_id: body.session_id,
      page_path: "/transcription",
      user_prompt: body.prompt,
      tenant_ref: auth.tenantRef,
      workspace_id: auth.workspaceId,
      project_id: auth.projectId,
      actor_ref: "transcription-web",
      requested_mode: "advanced",
      approval_granted: body.approval_granted ?? false,
      resource_ref: body.resource_ref ?? null,
      resource_refs: resolved.sourceRefs,
      current_artifact_ref: resolved.currentArtifactRef,
      context_payload: resolved.contextPayload,
      permission_scope: resolved.permissionScope,
      governance_tags: resolved.governanceTags
    });
    sendJson(response, 200, aiApiPayload(bundle));
    return true;
  }
  if (request.method === "POST" && /^\/api\/v1\/ai\/jobs\/[^/]+\/approve$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    sendJson(response, 200, aiApiPayload(await aiEngine().approveJob(jobId, "transcription-web-approval")));
    return true;
  }
  if (request.method === "GET" && /^\/api\/v1\/ai\/jobs\/[^/]+$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    sendJson(response, 200, aiApiPayload(aiEngine().getJob(jobId)));
    return true;
  }
  if (request.method === "GET" && /^\/api\/v1\/ai\/jobs\/[^/]+\/status$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    const bundle = aiEngine().getJob(jobId);
    sendJson(response, 200, { job_id: bundle.job.job_id, state: bundle.job.state, approval_boundary: bundle.approval_boundary, outcome: bundle.summary.outcome });
    return true;
  }
  if (request.method === "GET" && /^\/api\/v1\/ai\/jobs\/[^/]+\/result$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    sendJson(response, 200, aiApiPayload(aiEngine().getJob(jobId)));
    return true;
  }
  if (request.method === "GET" && /^\/api\/v1\/ai\/jobs\/[^/]+\/evidence$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    sendJson(response, 200, aiEngine().getJob(jobId).evidencePack);
    return true;
  }
  if (request.method === "GET" && /^\/api\/v1\/ai\/jobs\/[^/]+\/audit$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    sendJson(response, 200, aiEngine().getJob(jobId).auditEvents);
    return true;
  }
  if (request.method === "GET" && /^\/api\/v1\/ai\/jobs\/[^/]+\/lineage$/.test(url.pathname)) {
    const jobId = url.pathname.split("/")[5] ?? "";
    sendJson(response, 200, aiEngine().getJob(jobId).lineageEdges);
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/v1/transcription/jobs") {
    const jobs = store()
      .listJobs()
      .sort((left, right) => (right.finished_at ?? "").localeCompare(left.finished_at ?? ""));
    sendJson(response, 200, { jobs });
    return true;
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/v1/transcription/jobs/")) {
    const jobId = url.pathname.split("/").pop() ?? "";
    sendJson(response, 200, loadJobSnapshot(jobId));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/transcription/jobs/start") {
    const body = (await parseBody(request)) as {
      files: Array<{ file_name: string; content_base64: string; media_type?: string; input_kind?: string }>;
      mode?: "easy" | "advanced";
    };
    const workflow = await engine().ingestAndExtract({
      schema_namespace: "rasid.shared.transcription.v1",
      schema_version: "1.0.0",
      request_id: `web-${Date.now()}`,
      tenant_ref: auth.tenantRef,
      workspace_id: auth.workspaceId,
      project_id: auth.projectId,
      created_by: "transcription-web",
      mode: body.mode ?? "advanced",
      attachments: body.files.map((file, index) => ({
        schema_namespace: "rasid.shared.transcription.v1",
        schema_version: "1.0.0",
        attachment_id: `attachment-${Date.now()}-${index + 1}`,
        file_name: file.file_name,
        file_path: null,
        content_base64: file.content_base64,
        media_type: file.media_type ?? "application/octet-stream",
        input_kind: (file.input_kind as any) ?? inferInputKind(file.file_name, file.media_type),
        external_ref: null,
        batch_ref: null
      })),
      options: {
        language_hint: null,
        enable_ocr: true,
        enable_table_extraction: true,
        enable_qa_seeds: true,
        enable_comparisons: true
      },
      requested_at: new Date().toISOString()
    });
    sendJson(response, 200, mapWorkflow(workflow));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/transcription/compare") {
    const body = (await parseBody(request)) as { left_bundle_ref: string; right_bundle_ref: string };
    const compare = engine().compareBundles({
      left_bundle_ref: body.left_bundle_ref,
      right_bundle_ref: body.right_bundle_ref,
      actor_ref: "transcription-web",
      workspace_id: auth.workspaceId,
      tenant_ref: auth.tenantRef
    });
    sendJson(response, 200, compare);
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/v1/transcription/question") {
    const body = (await parseBody(request)) as { bundle_refs: string[]; question: string; compare_mode?: boolean };
    const answer = engine().answerQuestion({
      schema_namespace: "rasid.shared.transcription.v1",
      schema_version: "1.0.0",
      question_id: `question-${Date.now()}`,
      workspace_id: auth.workspaceId,
      actor_ref: "transcription-web",
      bundle_refs: body.bundle_refs,
      question: body.question,
      compare_mode: body.compare_mode ?? false,
      requested_at: new Date().toISOString()
    });
    sendJson(response, 200, { answer });
    return true;
  }
  return false;
};

const loginPage = () => `<!doctype html>
<html lang="ar"><head><meta charset="utf-8" /><title>Rasid Login</title>
<style>
body{font-family:Segoe UI,Tahoma,sans-serif;background:linear-gradient(135deg,#f4efe6,#dfe8f1);display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;padding:24px;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.12);width:min(360px,92vw);display:grid;gap:12px}
input,button{padding:12px 14px;border-radius:12px;border:1px solid #cfd6df;font:inherit}
button{background:#1d4ed8;color:#fff;border:none;cursor:pointer}
</style></head>
<body><form id="login-form"><h1 style="margin:0">Rasid Platform</h1><input name="email" value="admin" /><input name="password" type="password" value="1500" /><input name="tenant_ref" value="tenant-transcription-web" /><button>Login</button></form>
<script>
document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const response = await fetch('/api/v1/governance/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password'),tenant_ref:form.get('tenant_ref')})});
  if(response.ok){ location.href='/transcription'; return; }
  alert('Login failed');
});
</script></body></html>`;

const transcriptionPage = () => `<!doctype html>
<html lang="ar"><head><meta charset="utf-8" /><title>Transcription Engine</title>
<style>
:root{--bg:#f6f1e8;--card:#fffdfa;--line:#d8cfbf;--ink:#152238;--accent:#0f766e;--muted:#6b7280}
body{margin:0;font-family:Segoe UI,Tahoma,sans-serif;background:radial-gradient(circle at top,#efe3cf 0,#f7f4ee 45%,#edf3f8 100%);color:var(--ink)}
.shell{padding:24px;display:grid;gap:18px}
.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
.hero h1{margin:0;font-size:34px}
.hero p{margin:4px 0 0;color:var(--muted);max-width:720px}
.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 12px 30px rgba(21,34,56,.06)}
input,textarea,select,button{font:inherit}
input,textarea,select{width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--line);box-sizing:border-box;background:#fff}
button{padding:11px 14px;border:none;border-radius:12px;background:var(--accent);color:#fff;cursor:pointer}
.row{display:flex;gap:10px;flex-wrap:wrap}
.mono{font-family:Consolas,monospace;white-space:pre-wrap;background:#f6f8fb;border-radius:14px;padding:12px;max-height:260px;overflow:auto}
.list{display:grid;gap:10px;max-height:260px;overflow:auto}
.job{padding:12px;border:1px solid var(--line);border-radius:14px;cursor:pointer;background:#fff}
.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ai-card textarea{min-height:120px}
@media (max-width: 980px){.grid,.split{grid-template-columns:1fr}.hero{display:block}}
</style></head>
<body><div class="shell">
  <section class="hero"><div><h1>Transcription & Extraction</h1><p>Upload audio, video, PDFs, scanned images, table images, and mixed batches. Inspect transcript, fields, entities, summaries, compare results, and question answers on the same platform surface.</p></div><button id="refresh-jobs">Refresh Jobs</button></section>
  <section class="grid">
    <div class="card"><h2>Upload / Start Job</h2><div class="row"><input id="file-input" type="file" multiple /><select id="mode"><option value="advanced">Advanced</option><option value="easy">Easy</option></select><button id="start-job">Start Job</button></div><p id="upload-status"></p></div>
    <div class="card"><h2>Jobs</h2><div id="jobs" class="list"></div></div>
  </section>
  <section class="grid">
    <div class="card"><h2>Transcript</h2><div id="transcript" class="mono"></div></div>
    <div class="card"><h2>Extracted Fields / Entities</h2><div id="fields" class="mono"></div></div>
  </section>
  <section class="grid">
    <div class="card"><h2>Summary / Q&A Seeds</h2><div id="summary" class="mono"></div></div>
    <div class="card"><h2>Audit / Lineage</h2><div id="audit" class="mono"></div></div>
  </section>
  <section class="grid">
    <div class="card"><h2>Verification / Alignment</h2><div id="verification" class="mono"></div></div>
    <div class="card"><h2>On-screen OCR / Disagreements</h2><div id="visual-proof" class="mono"></div></div>
  </section>
  <section class="split">
    <div class="card"><h2>Compare View</h2><div class="row"><select id="compare-left"></select><select id="compare-right"></select><button id="run-compare">Compare</button></div><div id="compare-output" class="mono"></div></div>
    <div class="card"><h2>Ask Across Files</h2><textarea id="question" rows="4" placeholder="What appeared in the PDF and not in the Excel?"></textarea><div class="row"><button id="ask-question">Ask</button></div><div id="answer-output" class="mono"></div></div>
  </section>
  <section class="card ai-card" id="ai-surface" data-ai-page="/transcription">
    <h2>AI Engine</h2>
    <div class="row">
      <input id="ai-session-id" value="session-transcription" />
      <input id="ai-resource-ref" placeholder="bundle_ref (optional)" />
      <label style="display:flex;align-items:center;gap:8px;"><input id="ai-approval" type="checkbox" />approval granted</label>
    </div>
    <textarea id="ai-prompt" rows="4" placeholder="قارن بين آخر ملفين واستخرج الاختلافات الجوهرية">قارن بين آخر ملفين واستخرج الاختلافات الجوهرية</textarea>
    <div class="row"><button id="ai-run">Run AI</button><button id="ai-refresh-list">Refresh AI Jobs</button></div>
    <div id="ai-result" class="mono"></div>
    <div id="ai-jobs" class="mono"></div>
  </section>
</div>
<script>
let selectedJob = null;
let selectedBundle = null;
const fileToBase64 = (file) => new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); });
const aiRequest = async (method, url, body) => {
  const response = await fetch(url, { method, headers:{'content-type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if(!response.ok){ throw new Error(payload.error || 'ai_request_failed'); }
  return payload;
};
const renderAiPayload = (payload) => {
  const summary = payload?.summary ? [
    'outcome: ' + (payload.summary.outcome || 'n/a'),
    'approval: ' + (payload.summary.approval_state || 'n/a'),
    'agent: ' + (payload.summary.selected_agent || payload.plan?.selected_agent || 'n/a'),
    'capability: ' + (payload.summary.selected_capability || 'n/a'),
    'action: ' + (payload.summary.selected_action_ref || 'n/a'),
    'tool: ' + (payload.summary.selected_tool_ref || 'n/a'),
    'engine: ' + (payload.summary.selected_engine_ref || 'n/a'),
    'provider/model: ' + (payload.summary.selected_provider_ref || 'n/a') + ' / ' + (payload.summary.selected_model_ref || 'n/a'),
    'fallback: ' + (payload.summary.fallback_used ? (payload.summary.fallback_reason || 'used') : 'not_used'),
    'failure: ' + ((payload.summary.failure_summaries || []).join(' | ') || 'none'),
    'steps: ' + ((payload.summary.execution_step_details || []).join(' -> ') || 'n/a'),
    'artifacts: ' + ((payload.summary.result_artifact_refs || []).join(', ') || 'none')
  ].join('\\n') : '';
  document.getElementById('ai-result').textContent = [summary, JSON.stringify(payload, null, 2)].filter(Boolean).join('\\n\\n');
};
async function loadAiJobs(){
  const payload = await aiRequest('GET', '/api/v1/ai/jobs?session_id=' + encodeURIComponent(document.getElementById('ai-session-id').value));
  document.getElementById('ai-jobs').textContent = JSON.stringify(payload, null, 2);
}
async function loadJobs(){
  const response = await fetch('/api/v1/transcription/jobs');
  const payload = await response.json();
  const root = document.getElementById('jobs');
  root.innerHTML = '';
  const compareLeft = document.getElementById('compare-left');
  const compareRight = document.getElementById('compare-right');
  compareLeft.innerHTML = '';
  compareRight.innerHTML = '';
  for(const job of payload.jobs){
    const card = document.createElement('button');
    card.className = 'job';
    card.innerHTML = '<strong>'+job.job_id+'</strong><br />'+job.state+' / '+job.capability_submode;
    card.onclick = () => loadJob(job.job_id);
    root.appendChild(card);
    const opt1 = document.createElement('option'); opt1.value = job.job_id; opt1.textContent = job.job_id; compareLeft.appendChild(opt1);
    const opt2 = document.createElement('option'); opt2.value = job.job_id; opt2.textContent = job.job_id; compareRight.appendChild(opt2);
  }
}
async function loadJob(jobId){
  const response = await fetch('/api/v1/transcription/jobs/' + encodeURIComponent(jobId));
  const payload = await response.json();
  selectedJob = payload.job.job_id;
  selectedBundle = payload.bundle.bundle_id;
  document.getElementById('transcript').textContent = payload.bundle.segments.map((segment)=>segment.text).join('\\n');
  document.getElementById('fields').textContent = JSON.stringify({fields:payload.bundle.fields,entities:payload.bundle.entities,tables:payload.bundle.tables}, null, 2);
  document.getElementById('summary').textContent = JSON.stringify({summaries:payload.bundle.summaries,qa_seeds:payload.bundle.qa_seeds,action_items:payload.bundle.action_items}, null, 2);
  document.getElementById('audit').textContent = JSON.stringify({audit:payload.audit,lineage:payload.lineage,questions:payload.questions}, null, 2);
  document.getElementById('verification').textContent = JSON.stringify({verification_gate:payload.bundle.verification_gate,aligned_words:payload.bundle.aligned_words.slice(0,20)}, null, 2);
  document.getElementById('visual-proof').textContent = JSON.stringify({on_screen_text:payload.bundle.on_screen_text,disagreements:payload.bundle.disagreements}, null, 2);
}
document.getElementById('start-job').onclick = async () => {
  const input = document.getElementById('file-input');
  const files = [...input.files];
  if(!files.length){ alert('Select files first'); return; }
  document.getElementById('upload-status').textContent = 'Uploading and processing...';
  const payload = { mode: document.getElementById('mode').value, files: await Promise.all(files.map(async (file)=>({ file_name:file.name, media_type:file.type || 'application/octet-stream', content_base64: await fileToBase64(file) }))) };
  const response = await fetch('/api/v1/transcription/jobs/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const data = await response.json();
  document.getElementById('upload-status').textContent = response.ok ? 'Job created: ' + data.job.job_id : 'Failed';
  await loadJobs();
  if(response.ok){ await loadJob(data.job.job_id); }
};
document.getElementById('run-compare').onclick = async () => {
  const leftJob = document.getElementById('compare-left').value;
  const rightJob = document.getElementById('compare-right').value;
  const left = await (await fetch('/api/v1/transcription/jobs/' + encodeURIComponent(leftJob))).json();
  const right = await (await fetch('/api/v1/transcription/jobs/' + encodeURIComponent(rightJob))).json();
  const response = await fetch('/api/v1/transcription/compare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({left_bundle_ref:left.bundle.bundle_id,right_bundle_ref:right.bundle.bundle_id})});
  const data = await response.json();
  document.getElementById('compare-output').textContent = JSON.stringify(data.compareResult ?? data, null, 2);
};
document.getElementById('ask-question').onclick = async () => {
  const question = document.getElementById('question').value;
  if(!question.trim()){ return; }
  const bundleRefs = selectedBundle ? [selectedBundle] : [];
  if(!bundleRefs.length){ alert('Open a job first'); return; }
  const response = await fetch('/api/v1/transcription/question',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bundle_refs:bundleRefs,question,compare_mode:/compare|difference|diff|فروقات|فرق/.test(question)})});
  const data = await response.json();
  document.getElementById('answer-output').textContent = JSON.stringify(data.answer, null, 2);
};
document.getElementById('ai-run').onclick = async () => {
  const payload = await aiRequest('POST', '/api/v1/ai/jobs', {
    page_path: '/transcription',
    session_id: document.getElementById('ai-session-id').value,
    prompt: document.getElementById('ai-prompt').value,
    resource_ref: document.getElementById('ai-resource-ref').value || null,
    approval_granted: document.getElementById('ai-approval').checked
  });
  renderAiPayload(payload);
  await loadAiJobs();
  if (payload.open_path) {
    location.href = payload.open_path;
  }
};
document.getElementById('ai-refresh-list').onclick = loadAiJobs;
document.getElementById('refresh-jobs').onclick = loadJobs;
loadJobs();
loadAiJobs();
const currentAiJobId = new URLSearchParams(location.search).get('ai_job_id');
if(currentAiJobId){
  aiRequest('GET', '/api/v1/ai/jobs/' + encodeURIComponent(currentAiJobId)).then((payload) => renderAiPayload(payload)).catch(() => null);
}
</script></body></html>`;

export const startTranscriptionWebApp = (options?: TranscriptionWebServerOptions): { host: string; port: number; base_url: string; storage_dir: string } => {
  ensureDir(ROOT);
  ensureDir(ENGINE_ROOT);
  ensureDir(AI_ROOT);
  const host = options?.host ?? HOST;
  const port = options?.port ?? PORT;
  void options?.storageDir;
  if (!server) {
    server = createServer(async (request, response) => {
      try {
        const url = requestUrl(request);
        if (request.method === "POST" && url.pathname === "/api/v1/governance/auth/login") {
          const body = (await parseBody(request)) as { email: string; password: string; tenant_ref?: string; workspace_id?: string; project_id?: string };
          if (body.email !== LOGIN_EMAIL || body.password !== LOGIN_PASSWORD) {
            sendJson(response, 401, { error: "unauthorized" });
            return;
          }
          setCookie(response, COOKIE_TOKEN, TOKEN);
          setCookie(response, COOKIE_TENANT, body.tenant_ref ?? "tenant-transcription-web");
          setCookie(response, COOKIE_WORKSPACE, body.workspace_id ?? "workspace-transcription-web");
          setCookie(response, COOKIE_PROJECT, body.project_id ?? "project-transcription-web");
          sendJson(response, 200, { data: { accessToken: TOKEN, tenantRef: body.tenant_ref ?? "tenant-transcription-web" } });
          return;
        }
        if (url.pathname.startsWith("/api/")) {
          const auth = authMiddleware(request, response);
          if (!auth) return;
          if (await handleApi(request, response, auth)) return;
          sendJson(response, 404, { error: "api_not_found" });
          return;
        }
        if (url.pathname === "/login") {
          sendHtml(response, loginPage());
          return;
        }
        const auth = authenticate(request);
        if (!auth) {
          response.statusCode = 302;
          response.setHeader("location", "/login");
          response.end();
          return;
        }
        if (url.pathname === "/" || url.pathname === "/home") {
          response.statusCode = 302;
          response.setHeader("location", "/transcription");
          response.end();
          return;
        }
        if (url.pathname === "/transcription") {
          sendHtml(response, transcriptionPage());
          return;
        }
        response.statusCode = 404;
        response.end("not_found");
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    });
    server.listen(port, host);
  }
  return { host, port, base_url: `http://${host}:${port}`, storage_dir: ENGINE_ROOT };
};

export const stopTranscriptionWebApp = async (): Promise<void> => {
  if (!server) return;
  const current = server;
  server = null;
  await new Promise<void>((resolve) => {
    current.close(() => resolve());
  });
};
