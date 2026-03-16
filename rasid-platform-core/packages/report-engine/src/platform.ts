import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import { z } from "zod";
import {
  ReportEngine,
  createSampleDocxFixture,
  createSamplePdfFixture,
  startReportPublicationService,
  type ReportPublicationServiceStatus
} from "./index";

export type ReportPlatformServerHandle = {
  origin: string;
  port: number;
  close: () => Promise<void>;
};

type SessionRecord = {
  accessToken: string;
  userId: string;
  email: string;
  tenantRef: string;
  createdAt: string;
};

const LoginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  tenantRef: z.string().default("tenant-default")
});

const CreateReportApiRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  report_type: z.string().default("ops_report"),
  language: z.string().default("ar-SA")
});

const CreateFromTranscriptionApiRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().default(""),
  language: z.string().default("en-US"),
  workflow: z.object({
    job: z.object({ job_id: z.string() }),
    bundle: z.record(z.unknown()),
    report_handoff: z.record(z.unknown()),
    query_dataset: z.record(z.unknown())
  }),
  transcription_artifact_refs: z.array(z.string()).default([]),
  transcription_runtime_refs: z
    .object({
      report_handoff_path: z.string().optional(),
      query_dataset_path: z.string().optional(),
      verification_artifact_path: z.string().optional(),
      alignment_artifact_path: z.string().optional()
    })
    .default({})
});

const CreateFromExcelApiRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().default(""),
  language: z.string().default("ar-SA"),
  workbook_path: z.string(),
  workbook_label: z.string().optional(),
  excel_artifact_refs: z.array(z.string()).default([]),
  excel_runtime_refs: z
    .object({
      sample_run_root: z.string().optional(),
      workbook_package_path: z.string().optional(),
      evidence_path: z.string().optional(),
      audit_path: z.string().optional(),
      lineage_path: z.string().optional()
    })
    .default({})
});

const ImportReportApiRequestSchema = z.object({
  parser_hint: z.enum(["docx", "pdf"]),
  title: z.string().optional(),
  sample_profile: z.enum(["basic", "complex"]).default("complex")
});

const UpdateReportApiRequestSchema = z.object({
  block_ref: z.string().optional(),
  body: z.string().default("Updated from /reports platform.")
});

const ReviewApiRequestSchema = z.object({
  decision: z.enum(["in_review", "changes_requested", "reviewed"]).default("reviewed"),
  comment: z.string().default("Reviewed from /reports.")
});

const ApproveApiRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]).default("approved"),
  comment: z.string().default("Approved from /reports.")
});

const PublishApiRequestSchema = z.object({
  target_ref: z.string().default("platform://reports/published")
});

const ScheduleApiRequestSchema = z.object({
  next_run_at: z.string().default("2026-03-16T06:00:00.000Z")
});

const ScheduleControlApiRequestSchema = z.object({
  next_run_at: z.string().optional()
});

const ScheduleUpdateApiRequestSchema = z.object({
  next_run_at: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  publication_target_refs: z.array(z.string()).optional(),
  export_profile_refs: z.array(z.string()).optional(),
  visibility_scope_ref: z.string().nullable().optional(),
  selective_regeneration_refs: z.array(z.string()).optional()
});

const ConvertApiRequestSchema = z.object({
  target_ref: z.string().default("platform://derived")
});

const PublishDegradedApiRequestSchema = z.object({
  reason: z.string().default("Explicit degraded publication requested from /reports."),
  export_target: z.enum(["docx", "pdf", "html"]).default("html")
});

const REPORT_TEMPLATE = {
  sections: [
    {
      section_kind: "cover" as const,
      title: "Executive Cover",
      blocks: [
        {
          block_type: "narrative" as const,
          title: "Cover Narrative",
          body: "Internal editable report artifact with rich downstream conversions and orchestration."
        }
      ]
    },
    {
      section_kind: "executive_summary" as const,
      title: "Executive Summary",
      blocks: [
        {
          block_type: "metric_card" as const,
          title: "Coverage KPI",
          body: "Main KPI carried into dashboard and presentation outputs.",
          dataset_ref: "dataset://report-platform",
          query_ref: "query://report-platform/coverage",
          metric_value: 92,
          field_mappings: [{ role: "metric", field: "coverage" }]
        },
        {
          block_type: "chart" as const,
          title: "Trend Chart",
          body: "Trend semantics preserved across downstream conversions.",
          dataset_ref: "dataset://report-platform",
          query_ref: "query://report-platform/trend",
          chart_series: [
            { label: "Jan", value: 72 },
            { label: "Feb", value: 81 },
            { label: "Mar", value: 92 }
          ],
          caption: "Chart 1: Coverage trend"
        }
      ]
    },
    {
      section_kind: "body" as const,
      title: "Operational Detail",
      blocks: [
        {
          block_type: "table" as const,
          title: "Risk Table",
          body: "Structured table preserved from source to editable report and downstream conversions.",
          table_rows: [
            ["Risk", "Owner", "Status"],
            ["Supplier delay", "Ops", "Mitigating"],
            ["Integration drift", "Platform", "Monitoring"]
          ],
          caption: "Table 1: Operational risk status"
        },
        {
          block_type: "commentary" as const,
          title: "Narrative Detail",
          body: "Reconciliation evidence is preserved across round-trip report, presentation, and dashboard flows."
        }
      ]
    }
  ]
};

type ReportPlatformBlockInput = {
  block_type: "narrative" | "metric_card" | "chart" | "table" | "commentary";
  title: string;
  body?: string;
  dataset_ref?: string | null;
  query_ref?: string | null;
  field_mappings?: Array<Record<string, unknown>>;
  citations?: string[];
  metric_value?: number;
  table_rows?: string[][];
  chart_series?: Array<Record<string, string | number>>;
  caption?: string;
  source_metadata?: Record<string, unknown>;
  source_lineage_refs?: string[];
};

type ReportPlatformSectionInput = {
  section_kind: "cover" | "executive_summary" | "body" | "appendix";
  title: string;
  blocks: ReportPlatformBlockInput[];
  lock_policy?: "editable" | "soft_lock" | "strict_lock";
};

const now = (): string => new Date().toISOString();
const uid = (...parts: Array<string | number>) => parts.join("-").replace(/[^a-zA-Z0-9_-]+/g, "-");

const html = (response: http.ServerResponse, body: string) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
};

const json = (response: http.ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const redirect = (response: http.ServerResponse, location: string) => {
  response.writeHead(302, { location });
  response.end();
};

const parseCookies = (header: string): Record<string, string> =>
  header
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const [key, ...rest] = entry.split("=");
      accumulator[key] = decodeURIComponent(rest.join("="));
      return accumulator;
    }, {});

const readJsonBody = async (request: http.IncomingMessage): Promise<unknown> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length > 0 ? JSON.parse(text) : {};
};

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

const sendFile = (response: http.ServerResponse, filePath: string) => {
  if (!fs.existsSync(filePath)) {
    json(response, 404, { error: "File not found" });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".json"
        ? "application/json; charset=utf-8"
        : ext === ".pdf"
          ? "application/pdf"
          : ext === ".docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/octet-stream";
  response.writeHead(200, { "content-type": contentType });
  response.end(fs.readFileSync(filePath));
};

const shellPage = (title: string, body: string, script = "") => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #f2ede4; color: #172026; }
    .shell { max-width: 1400px; margin: 0 auto; padding: 28px; }
    .hero { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; margin-bottom:24px; }
    .card { background: #fffdf7; border: 1px solid #eadfc8; border-radius: 18px; padding: 18px; box-shadow: 0 8px 26px rgba(23,32,38,0.08); }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
    .stack { display:flex; flex-wrap:wrap; gap:10px; }
    button, .button-link { background:#0d5b56; color:#fff; border:0; border-radius:12px; padding:10px 14px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:8px; }
    button.secondary, .button-link.secondary { background:#926f34; }
    button.ghost { background:#e8dfcf; color:#172026; }
    input, textarea, select { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:12px; border:1px solid #d6cab4; background:#fff; }
    textarea { min-height: 90px; }
    code, pre { background:#f7f3ea; border-radius:12px; }
    pre { padding:14px; overflow:auto; max-height:420px; }
    .muted { color:#6b7280; }
    .badge { display:inline-flex; padding:4px 10px; border-radius:999px; background:#efe6d5; color:#6b4f1d; font-size:12px; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
    table { width:100%; border-collapse:collapse; }
    td, th { border:1px solid #e3dac8; padding:8px 10px; text-align:start; }
  </style>
</head>
<body>
  <div class="shell">${body}</div>
  <script>${script}</script>
</body>
</html>`;

const loginPage = () =>
  shellPage(
    "Rasid /reports Login",
    `<div class="hero"><div><h1>تسجيل الدخول إلى /reports</h1><p class="muted">المسار محمي فعليًا بـ auth + tenant.</p></div></div>
     <div class="card" style="max-width:420px;">
       <label>Username<input id="email" value="admin" /></label>
       <label style="margin-top:12px;">Password<input id="password" type="password" value="1500" /></label>
       <label style="margin-top:12px;">Tenant<input id="tenantRef" value="tenant-default" /></label>
       <div class="stack" style="margin-top:16px;"><button id="loginBtn">Login</button><span id="state" class="muted"></span></div>
     </div>`,
    `document.getElementById("loginBtn").addEventListener("click", async () => {
       const response = await fetch("/api/v1/governance/auth/login", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ email: email.value, password: password.value, tenantRef: tenantRef.value }) });
       const payload = await response.json();
       if (!response.ok) { state.textContent = payload.error || "login failed"; return; }
       document.cookie = "rasid_access_token=" + payload.data.accessToken + "; path=/";
       document.cookie = "rasid_tenant_ref=" + payload.data.tenantRef + "; path=/";
       window.location.href = "/reports";
     });`
  );

const homePage = () =>
  shellPage(
    "Rasid /reports",
    `<div class="hero">
       <div><h1>/reports</h1><p class="muted">إدارة التقرير الداخلي القابل للتحرير مع ingest، reconcile، review، approve، publish، schedule، export، وconvert.</p></div>
       <div class="stack"><button id="refreshList" class="ghost" type="button">Refresh</button></div>
     </div>
     <div class="grid">
       <div class="card">
         <h2>Create Report</h2>
         <label>Title<input id="reportTitle" value="Platform Report Proof" /></label>
         <label style="margin-top:10px;">Description<textarea id="reportDescription">Created from /reports live route for Phase 6 proof.</textarea></label>
         <div class="stack" style="margin-top:12px;"><button id="createReport">Create</button><span id="createState" class="muted"></span></div>
       </div>
       <div class="card">
         <h2>Import Samples</h2>
         <p class="muted">DOCX/PDF ingest with deeper fidelity and preserved tables/sections/layout metadata.</p>
         <label>Sample profile
           <select id="sampleProfile">
             <option value="complex" selected>Complex layout proof</option>
             <option value="basic">Basic sample</option>
           </select>
         </label>
         <div class="stack">
           <button id="importDocx" class="secondary">Import DOCX sample</button>
           <button id="importPdf" class="secondary">Import PDF sample</button>
         </div>
         <div id="importState" class="muted" style="margin-top:10px;"></div>
       </div>
     </div>
     <div class="card" style="margin-top:18px;">
       <h2>Reports</h2>
       <ul id="reportList" style="list-style:none; padding:0; margin:0;"></ul>
     </div>`,
    `async function api(path, method="GET", body) {
       const response = await fetch(path, { method, headers:{ "content-type":"application/json", "x-tenant-id": document.cookie.split("; ").find(v => v.startsWith("rasid_tenant_ref="))?.split("=")[1] || "tenant-default" }, body: body ? JSON.stringify(body) : undefined });
       const payload = await response.json();
       if (!response.ok) throw new Error(payload.error || "request failed");
       return payload.data;
     }
     async function loadReports() {
       const data = await api("/api/v1/reports/reports");
       reportList.innerHTML = data.map((entry) => "<li class='card' style='margin-bottom:12px;'><div class='hero'><div><strong>" + entry.report.title[0]?.value + "</strong><div class='muted'>" + entry.report.report_id + " · " + entry.version.version_ref.semantic_version + "</div></div><div class='stack'><span class='badge'>" + entry.report.status + "</span><a class='button-link' href='/reports/" + entry.report.report_id + "'>Open</a></div></div><div class='muted'>Sections: " + entry.section_count + " · Blocks: " + entry.block_count + " · Ingests: " + entry.ingest_count + " · Schedules: " + entry.schedule_count + "</div></li>").join("");
     }
     createReport.onclick = async () => { try { const result = await api("/api/v1/reports/reports/create", "POST", { title: reportTitle.value, description: reportDescription.value }); createState.textContent = result.report_id; window.location.href = "/reports/" + result.report_id; } catch (error) { createState.textContent = error.message; } };
     importDocx.onclick = async () => { try { const result = await api("/api/v1/reports/reports/import", "POST", { parser_hint:"docx", title:"Imported DOCX Proof", sample_profile: sampleProfile.value }); importState.textContent = result.report_id + " imported (" + sampleProfile.value + ")"; await loadReports(); } catch (error) { importState.textContent = error.message; } };
     importPdf.onclick = async () => { try { const result = await api("/api/v1/reports/reports/import", "POST", { parser_hint:"pdf", title:"Imported PDF Proof", sample_profile: sampleProfile.value }); importState.textContent = result.report_id + " imported (" + sampleProfile.value + ")"; await loadReports(); } catch (error) { importState.textContent = error.message; } };
     refreshList.onclick = loadReports;
     loadReports();`
  );

const detailPage = (reportId: string) =>
  shellPage(
    `Report ${reportId}`,
    `<div class="hero">
       <div><h1 id="reportTitle">Report</h1><p id="reportMeta" class="muted">${reportId}</p></div>
       <div class="stack"><a class="button-link secondary" href="/reports">Back</a><span id="detailState" class="muted"></span></div>
     </div>
     <div class="toolbar">
       <button id="refreshReport">Refresh</button>
       <button id="updateReport" class="secondary">Update</button>
       <button id="compareReport" class="ghost">Compare Latest</button>
       <button id="reviewReport">Review</button>
       <button id="approveReport">Approve</button>
       <button id="publishReport">Publish</button>
       <button id="publishDegraded" class="secondary">Publish degraded</button>
       <button id="scheduleReport">Schedule</button>
       <button id="updateSchedule" class="secondary">Update schedule</button>
       <button id="runSchedule" class="secondary">Run schedule</button>
       <button id="cancelSchedule" class="ghost">Cancel schedule</button>
       <button id="resumeSchedule" class="ghost">Resume schedule</button>
       <button id="exportHtml">Export HTML</button>
       <button id="exportPdf">Export PDF</button>
       <button id="exportDocx">Export DOCX</button>
       <button id="convertPresentation">To presentation</button>
       <button id="convertDashboard">To dashboard</button>
     </div>
     <div class="grid">
       <div class="card"><h2>Summary</h2><div id="summaryGrid" class="grid"></div></div>
       <div class="card"><h2>Versions</h2><pre id="versions"></pre></div>
       <div class="card"><h2>Schedules</h2><pre id="schedules"></pre></div>
       <div class="card"><h2>Ingest</h2><pre id="ingests"></pre></div>
       <div class="card"><h2>Back-Sync</h2><pre id="backSync"></pre></div>
       <div class="card"><h2>Transport</h2><pre id="transport"></pre></div>
     </div>
     <div class="card" style="margin-top:18px;"><h2>Activity JSON</h2><pre id="detailJson"></pre></div>`,
    `const reportId = ${JSON.stringify(reportId)};
     async function api(path, method="GET", body) {
       const response = await fetch(path, { method, headers:{ "content-type":"application/json", "x-tenant-id": document.cookie.split("; ").find(v => v.startsWith("rasid_tenant_ref="))?.split("=")[1] || "tenant-default" }, body: body ? JSON.stringify(body) : undefined });
       const payload = await response.json();
       if (!response.ok) throw new Error(payload.error || "request failed");
       return payload.data;
     }
     async function loadDetail() {
       const data = await api("/api/v1/reports/reports/" + reportId);
       reportTitle.textContent = data.state.report.title[0]?.value || data.state.report.report_id;
       reportMeta.textContent = data.state.report.report_id + " · " + data.state.report.status + " · " + data.state.version.version_ref.semantic_version;
       summaryGrid.innerHTML = [
         ["Sections", data.state.sections.length],
         ["Blocks", data.state.contentBlocks.length],
         ["Schedules", data.records.schedules.length],
         ["Back-sync", data.records.backSyncs.length],
         ["Dispatches", data.records.dispatches.length],
         ["Orchestrations", data.records.orchestrations.length],
         ["Deliveries", data.records.transportDeliveries.length],
         ["Publications", data.state.publications.length]
       ].map((row) => "<div class='card'><strong>" + row[0] + "</strong><div>" + row[1] + "</div></div>").join("");
       versions.textContent = JSON.stringify(data.records.versions, null, 2);
       schedules.textContent = JSON.stringify(data.records.schedules, null, 2);
       ingests.textContent = JSON.stringify(data.records.ingests, null, 2);
       backSync.textContent = JSON.stringify(data.records.backSyncs, null, 2);
       transport.textContent = JSON.stringify({ publications: data.state.publications, dispatches: data.records.dispatches, orchestrations: data.records.orchestrations, transportDeliveries: data.records.transportDeliveries }, null, 2);
       detailJson.textContent = JSON.stringify(data, null, 2);
       window.__reportDetail = data;
       return data;
     }
     async function act(label, path, method="POST", body) { try { const data = await api(path, method, body); detailState.textContent = label + " ok"; await loadDetail(); return data; } catch (error) { detailState.textContent = error.message; throw error; } }
     refreshReport.onclick = () => act("refresh", "/api/v1/reports/reports/" + reportId + "/refresh", "POST", {});
     updateReport.onclick = async () => { const detail = window.__reportDetail || await loadDetail(); const firstBlock = detail.state.contentBlocks[0]; await act("update", "/api/v1/reports/reports/" + reportId + "/update", "POST", { block_ref: firstBlock?.block_id, body: "Updated from /reports browser at " + new Date().toISOString() }); };
     compareReport.onclick = () => act("compare", "/api/v1/reports/reports/" + reportId + "/compare", "POST", {});
     reviewReport.onclick = () => act("review", "/api/v1/reports/reports/" + reportId + "/review", "POST", {});
     approveReport.onclick = () => act("approve", "/api/v1/reports/reports/" + reportId + "/approve", "POST", {});
     publishReport.onclick = async () => { const result = await act("publish", "/api/v1/reports/reports/" + reportId + "/publish", "POST", {}); if (result.publicUrl) window.open(result.publicUrl, "_blank"); };
     publishDegraded.onclick = () => act("publish-degraded", "/api/v1/reports/reports/" + reportId + "/publish-degraded", "POST", {});
     scheduleReport.onclick = () => act("schedule", "/api/v1/reports/reports/" + reportId + "/schedules", "POST", {});
     updateSchedule.onclick = async () => { const detail = window.__reportDetail || await loadDetail(); const schedule = detail.records.schedules[0]; if (!schedule) throw new Error("No schedule found"); await act("update-schedule", "/api/v1/reports/schedules/" + schedule.schedule_id + "/update", "POST", { next_run_at: new Date(Date.now() + 3600000).toISOString(), publication_target_refs: ["platform://reports/" + reportId + "/scheduled-updated"] }); };
     runSchedule.onclick = async () => { const detail = window.__reportDetail || await loadDetail(); const schedule = detail.records.schedules[0]; if (!schedule) throw new Error("No schedule found"); await act("run-schedule", "/api/v1/reports/schedules/" + schedule.schedule_id + "/run", "POST", {}); };
     cancelSchedule.onclick = async () => { const detail = window.__reportDetail || await loadDetail(); const schedule = detail.records.schedules[0]; if (!schedule) throw new Error("No schedule found"); await act("cancel-schedule", "/api/v1/reports/schedules/" + schedule.schedule_id + "/cancel", "POST", {}); };
     resumeSchedule.onclick = async () => { const detail = window.__reportDetail || await loadDetail(); const schedule = detail.records.schedules[0]; if (!schedule) throw new Error("No schedule found"); await act("resume-schedule", "/api/v1/reports/schedules/" + schedule.schedule_id + "/resume", "POST", {}); };
     exportHtml.onclick = async () => { const result = await act("export-html", "/api/v1/reports/reports/" + reportId + "/export/html", "POST", {}); window.open(result.url, "_blank"); };
     exportPdf.onclick = async () => { const result = await act("export-pdf", "/api/v1/reports/reports/" + reportId + "/export/pdf", "POST", {}); window.open(result.url, "_blank"); };
     exportDocx.onclick = async () => { const result = await act("export-docx", "/api/v1/reports/reports/" + reportId + "/export/docx", "POST", {}); window.open(result.url, "_blank"); };
     convertPresentation.onclick = () => act("convert-presentation", "/api/v1/reports/reports/" + reportId + "/convert/presentation", "POST", { target_ref: "platform://presentations/" + reportId });
     convertDashboard.onclick = () => act("convert-dashboard", "/api/v1/reports/reports/" + reportId + "/convert/dashboard", "POST", { target_ref: "platform://dashboards/" + reportId });
     loadDetail();`
  );

const publicPage = (publicationId: string, renderUrl: string | null) =>
  shellPage(
    `Published Report ${publicationId}`,
    `<div class="hero"><div><h1>Published report</h1><p class="muted">${publicationId}</p></div><div class="badge">public route</div></div>
     ${renderUrl ? `<iframe src="${renderUrl}" title="published-report" style="width:100%;height:900px;border:0;border-radius:18px;background:#fff;"></iframe>` : `<div class="card"><p>No publication render route available.</p></div>`}`
  );

const reportSummary = (engine: ReportEngine, reportId: string) => {
  const state = engine.store.loadState(reportId);
  return {
    report: state.report,
    version: state.version,
    section_count: state.sections.length,
    block_count: state.contentBlocks.length,
    ingest_count: engine.store.listIngestRecords(reportId).length,
    schedule_count: state.schedules.length
  };
};

const reportDetail = (engine: ReportEngine, reportId: string) => {
  const state = engine.store.loadState(reportId);
  const versions = engine.store.listVersionSnapshots(reportId);
  return {
    state,
    records: {
      versions,
      ingests: engine.store.listIngestRecords(reportId),
      backSyncs: engine.store.listBackSyncRecords(reportId),
      schedules: engine.listReportSchedules({ report_id: reportId }).schedules,
      dispatches: engine.store.listDispatchRecords(reportId),
      orchestrations: engine.store.listOrchestrationRecords(reportId),
      transportDeliveries: engine.store.listTransportDeliveryRecords(reportId)
    }
  };
};

const resolveLatestExportPath = (engine: ReportEngine, reportId: string, target: "html" | "pdf" | "docx"): URL | null => {
  const state = engine.store.loadState(reportId);
  const matches = state.derivedArtifacts
    .filter((artifact) => artifact.artifact_subtype === `report_${target}`)
    .sort((left, right) => `${right.created_at}`.localeCompare(`${left.created_at}`));
  if (matches.length > 0) {
    const uri = matches[0].storage_ref.uri;
    if (uri.startsWith("file:")) {
      return new URL(uri);
    }
  }
  const reportArtifactUrl = new URL(state.reportArtifact.storage_ref.uri);
  const reportRoot = path.dirname(path.dirname(reportArtifactUrl.pathname));
  const exportDirectory = path.join(reportRoot, "artifacts-data", "exports", target);
  if (!fs.existsSync(exportDirectory)) {
    return null;
  }
  const extension = target === "html" ? ".html" : target === "pdf" ? ".pdf" : ".docx";
  const fallbackFile = fs
    .readdirSync(exportDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .sort((left, right) => right.name.localeCompare(left.name))[0];
  return fallbackFile ? pathToFileURL(path.join(exportDirectory, fallbackFile.name)) : null;
};

const createImportSampleFile = async (
  runtimeRoot: string,
  parserHint: "docx" | "pdf",
  sampleProfile: "basic" | "complex"
): Promise<{ filePath: string; fixtureMetadata: Record<string, unknown> }> => {
  const importRoot = path.join(runtimeRoot, "platform-imports");
  fs.mkdirSync(importRoot, { recursive: true });
  const targetPath = path.join(importRoot, `sample-import-${sampleProfile}.${parserHint}`);
  if (parserHint === "docx") {
    const fixture = await createSampleDocxFixture(sampleProfile);
    fs.writeFileSync(targetPath, Buffer.from(fixture.bytes));
    return { filePath: targetPath, fixtureMetadata: fixture.metadata };
  } else {
    const fixture = createSamplePdfFixture(sampleProfile);
    fs.writeFileSync(targetPath, Buffer.from(fixture.bytes));
    return { filePath: targetPath, fixtureMetadata: fixture.metadata };
  }
};

const worksheetSampleRows = (worksheet: ExcelJS.Worksheet, rowLimit = 6, columnLimit = 8): string[][] => {
  const rows: string[][] = [];
  const maxColumn = Math.min(columnLimit, worksheet.columnCount || columnLimit);
  for (let rowNumber = 1; rowNumber <= Math.min(rowLimit, worksheet.rowCount || rowLimit); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = Array.from({ length: maxColumn }, (_, index) => {
      const cell = row.getCell(index + 1);
      if (cell.value === null || cell.value === undefined) {
        return "";
      }
      if (typeof cell.value === "object" && "formula" in cell.value) {
        return cell.text || `=${cell.value.formula}`;
      }
      return cell.text || `${cell.value}`;
    });
    if (values.some((value) => value.length > 0)) {
      rows.push(values);
    }
  }
  return rows;
};

const worksheetFormulaCount = (worksheet: ExcelJS.Worksheet): number => {
  let count = 0;
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        count += 1;
      }
    });
  });
  return count;
};

const definedNamesCount = (workbook: ExcelJS.Workbook): number => {
  const model = (workbook.definedNames as unknown as { model?: unknown[] }).model;
  return Array.isArray(model) ? model.length : 0;
};

const buildReportSectionsFromExcelWorkbook = async (
  workbookPath: string,
  workbookLabel?: string
): Promise<{
  sections: ReportPlatformSectionInput[];
  summary: Record<string, unknown>;
}> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheetSummaries = workbook.worksheets.map((worksheet) => {
    const sampleRows = worksheetSampleRows(worksheet);
    return {
      worksheet_name: worksheet.name,
      row_count: worksheet.rowCount,
      column_count: worksheet.columnCount,
      formula_count: worksheetFormulaCount(worksheet),
      sample_rows: sampleRows,
      merged_range_count: worksheet.model.merges?.length ?? 0,
      view_count: worksheet.views?.length ?? 0
    };
  });
  const formulaCount = worksheetSummaries.reduce((sum, sheet) => sum + sheet.formula_count, 0);
  const namedRangeCount = definedNamesCount(workbook);
  const label = workbookLabel ?? path.basename(workbookPath);
  const visibleWorksheetNames = new Set(
    workbook.worksheets
      .filter((worksheet) => worksheet.state === "visible" && !worksheet.name.startsWith("__"))
      .map((worksheet) => worksheet.name)
  );
  const worksheetPriority = new Map([
    ["Summary", 0],
    ["Joined", 1],
    ["Pivot_Profit_By_Country", 2],
    ["ArabicSummary", 3]
  ]);
  const consumableWorksheetSummaries = worksheetSummaries
    .filter((sheetSummary) => visibleWorksheetNames.has(sheetSummary.worksheet_name))
    .sort((left, right) => {
      const leftPriority = worksheetPriority.get(left.worksheet_name) ?? 100;
      const rightPriority = worksheetPriority.get(right.worksheet_name) ?? 100;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.worksheet_name.localeCompare(right.worksheet_name);
    })
    .slice(0, 4);
  const sections: ReportPlatformSectionInput[] = [
    {
      section_kind: "cover",
      title: `Excel Workbook Intake: ${label}`,
      blocks: [
        {
          block_type: "narrative",
          title: "Workbook Intake",
          body: `Report created from Excel workbook ${label} and persisted as an editable report artifact.`,
          citations: [workbookPath],
          source_metadata: {
            source: "excel-workbook",
            workbook_path: workbookPath,
            worksheet_count: workbook.worksheets.length,
            named_range_count: namedRangeCount,
            formula_count: formulaCount
          }
        } satisfies ReportPlatformBlockInput
      ]
    },
    {
      section_kind: "executive_summary",
      title: "Workbook Summary",
      blocks: [
        {
          block_type: "metric_card",
          title: "Worksheet Count",
          body: "Total worksheets consumed from the Excel workbook.",
          dataset_ref: `dataset://excel/${label}/workbook-summary`,
          query_ref: `query://excel/${label}/worksheet-count`,
          metric_value: workbook.worksheets.length,
          field_mappings: [{ role: "metric", field: "worksheet_count" }],
          source_metadata: { workbook_path: workbookPath, workbook_label: label }
        } satisfies ReportPlatformBlockInput,
        {
          block_type: "metric_card",
          title: "Formula Count",
          body: "Total formulas detected in the consumed workbook.",
          dataset_ref: `dataset://excel/${label}/workbook-summary`,
          query_ref: `query://excel/${label}/formula-count`,
          metric_value: formulaCount,
          field_mappings: [{ role: "metric", field: "formula_count" }],
          source_metadata: { workbook_path: workbookPath, workbook_label: label }
        } satisfies ReportPlatformBlockInput,
        {
          block_type: "commentary",
          title: "Named Ranges",
          body: `Workbook defined names detected: ${namedRangeCount}.`,
          citations: [workbookPath],
          source_metadata: { workbook_path: workbookPath, named_range_count: namedRangeCount }
        } satisfies ReportPlatformBlockInput
      ]
    }
  ];

  consumableWorksheetSummaries.forEach((sheetSummary) => {
    const headers = sheetSummary.sample_rows[0] ?? [];
    const tableRows = sheetSummary.sample_rows.length > 1 ? sheetSummary.sample_rows : [headers];
    sections.push({
      section_kind: "body",
      title: sheetSummary.worksheet_name,
      blocks: [
        {
          block_type: "narrative",
          title: `${sheetSummary.worksheet_name} Structure`,
          body: `Rows: ${sheetSummary.row_count}, Columns: ${sheetSummary.column_count}, Formulas: ${sheetSummary.formula_count}, Merged ranges: ${sheetSummary.merged_range_count}.`,
          citations: [workbookPath],
          source_metadata: {
            workbook_path: workbookPath,
            worksheet_name: sheetSummary.worksheet_name,
            row_count: sheetSummary.row_count,
            column_count: sheetSummary.column_count,
            formula_count: sheetSummary.formula_count
          }
        } satisfies ReportPlatformBlockInput,
        {
          block_type: "table",
          title: `${sheetSummary.worksheet_name} Sample`,
          body: `Sample rows consumed from worksheet ${sheetSummary.worksheet_name}.`,
          dataset_ref: `dataset://excel/${label}/${sheetSummary.worksheet_name}`,
          query_ref: `query://excel/${label}/${sheetSummary.worksheet_name}/sample`,
          table_rows: tableRows,
          caption: `Worksheet ${sheetSummary.worksheet_name} sample`,
          citations: [workbookPath],
          source_metadata: {
            workbook_path: workbookPath,
            worksheet_name: sheetSummary.worksheet_name,
            headers
          }
        } satisfies ReportPlatformBlockInput
      ]
    });
  });

  sections.push({
    section_kind: "appendix",
    title: "Workbook Provenance",
    blocks: [
      {
        block_type: "commentary",
        title: "Excel Source Provenance",
        body: "This report keeps the workbook path and sheet-level summaries in source metadata for downstream audit and lineage continuity.",
        citations: [workbookPath],
        source_metadata: {
          workbook_path: workbookPath,
          workbook_label: label,
          worksheet_summaries: worksheetSummaries
        }
      } satisfies ReportPlatformBlockInput
    ]
  });

  return {
    sections,
    summary: {
      workbook_path: workbookPath,
      workbook_label: label,
      worksheet_count: workbook.worksheets.length,
      formula_count: formulaCount,
      named_range_count: namedRangeCount,
      worksheets: worksheetSummaries
    }
  };
};

export const startReportPlatformServer = async (
  options: { port?: number; host?: string; engine?: ReportEngine } = {}
): Promise<ReportPlatformServerHandle> => {
  const host = options.host ?? "127.0.0.1";
  const engine = options.engine ?? new ReportEngine();
  const runtimeRoot = path.join(engine.store.rootDir, "platform");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const sessionsPath = path.join(runtimeRoot, "sessions.json");
  const loadSessions = (): SessionRecord[] => (fs.existsSync(sessionsPath) ? JSON.parse(fs.readFileSync(sessionsPath, "utf8")) as SessionRecord[] : []);
  const saveSessions = (sessions: SessionRecord[]) => fs.writeFileSync(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
  let publicationService: ReportPublicationServiceStatus = startReportPublicationService({ storageDir: engine.store.rootDir });
  const refreshPublicationService = () => {
    publicationService = startReportPublicationService({ storageDir: engine.store.rootDir });
    return publicationService;
  };
  const authenticate = (request: http.IncomingMessage): SessionRecord | null => {
    const cookies = parseCookies(request.headers.cookie ?? "");
    const authorization = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? cookies.rasid_access_token;
    if (!authorization) return null;
    return loadSessions().find((session) => session.accessToken === authorization) ?? null;
  };
  const assertTenant = (request: http.IncomingMessage, session: SessionRecord): string => {
    const cookies = parseCookies(request.headers.cookie ?? "");
    const tenantRef = `${request.headers["x-tenant-id"] ?? cookies.rasid_tenant_ref ?? "tenant-default"}`;
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
        const session: SessionRecord = {
          accessToken: hashToken(`${payload.email}-${payload.tenantRef}-${Date.now()}`),
          userId: "admin-user",
          email: payload.email,
          tenantRef: payload.tenantRef,
          createdAt: now()
        };
        const sessions = loadSessions().filter((entry) => !(entry.email === session.email && entry.tenantRef === session.tenantRef));
        sessions.push(session);
        saveSessions(sessions);
        json(response, 200, { data: session });
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/reports") {
        const session = authenticate(request);
        if (!session) return redirect(response, "/login");
        assertTenant(request, session);
        html(response, homePage());
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/reports\/[^/]+$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return redirect(response, "/login");
        assertTenant(request, session);
        html(response, detailPage(decodeURIComponent(pathname.split("/")[2] ?? "")));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/published\/reports\/[^/]+$/.test(pathname)) {
        const publicationId = decodeURIComponent(pathname.split("/")[3] ?? "");
        refreshPublicationService();
        const publication = publicationService.publications.find((entry) => entry.publication_id === publicationId) ?? null;
        html(response, publicPage(publicationId, publication?.served_export_html_url ?? publication?.served_embed_html_url ?? null));
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/files\/reports\/[^/]+\/(html|pdf|docx)$/.test(pathname)) {
        const [, , , reportId, target] = pathname.split("/");
        const fileUrl = resolveLatestExportPath(engine, decodeURIComponent(reportId), target as "html" | "pdf" | "docx");
        if (!fileUrl) {
          json(response, 404, { error: "Export not found" });
          return;
        }
        sendFile(response, fileURLToPath(fileUrl));
        return;
      }
      if ((request.method ?? "GET") === "GET" && pathname === "/api/v1/reports/reports") {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        json(response, 200, { data: engine.store.listReportIds().map((reportId) => reportSummary(engine, reportId)) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/reports/reports/create") {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        const tenantRef = assertTenant(request, session);
        const payload = CreateReportApiRequestSchema.parse(await readJsonBody(request));
        const reportId = uid("report-platform", Date.now());
        const created = engine.createReport({
          report_id: reportId,
          tenant_ref: tenantRef,
          workspace_id: "workspace-reports",
          project_id: "project-reports",
          created_by: session.userId,
          title: payload.title,
          description: payload.description,
          report_type: payload.report_type,
          language: payload.language,
          sections: REPORT_TEMPLATE.sections
        });
        json(response, 200, { data: { report_id: created.report.report_id } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/reports/reports/create-from-transcription") {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        const tenantRef = assertTenant(request, session);
        const payload = CreateFromTranscriptionApiRequestSchema.parse(await readJsonBody(request));
        const reportId = uid("report-transcription", Date.now());
        const created = engine.createReportFromTranscription({
          report_id: reportId,
          tenant_ref: tenantRef,
          workspace_id: "workspace-reports",
          project_id: "project-reports",
          created_by: session.userId,
          title: payload.title ?? `Transcription Report ${String(payload.workflow.bundle["bundle_id"] ?? reportId)}`,
          description: payload.description,
          language: payload.language,
          bundle: payload.workflow.bundle as Parameters<ReportEngine["createReportFromTranscription"]>[0]["bundle"],
          report_handoff: payload.workflow.report_handoff,
          query_dataset: payload.workflow.query_dataset,
          transcription_artifact_refs: payload.transcription_artifact_refs,
          transcription_runtime_refs: payload.transcription_runtime_refs
        });
        json(response, 200, { data: created });
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/reports/reports/create-from-excel") {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        const tenantRef = assertTenant(request, session);
        const payload = CreateFromExcelApiRequestSchema.parse(await readJsonBody(request));
        const reportId = uid("report-excel", Date.now());
        const workbookDraft = await buildReportSectionsFromExcelWorkbook(payload.workbook_path, payload.workbook_label);
        const created = engine.createReport({
          report_id: reportId,
          tenant_ref: tenantRef,
          workspace_id: "workspace-reports",
          project_id: "project-reports",
          created_by: session.userId,
          title: payload.title ?? `Excel Report ${path.basename(payload.workbook_path)}`,
          description: payload.description,
          language: payload.language,
          report_type: "excel_report",
          source_refs: [
            payload.workbook_path,
            ...payload.excel_artifact_refs,
            ...Object.values(payload.excel_runtime_refs).filter((value): value is string => Boolean(value))
          ],
          sections: workbookDraft.sections
        });
        json(response, 200, {
          data: {
            created,
            workbook_summary: workbookDraft.summary,
            report_route: `/reports/${created.report.report_id}`
          }
        });
        return;
      }
      if ((request.method ?? "POST") === "POST" && pathname === "/api/v1/reports/reports/import") {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        const tenantRef = assertTenant(request, session);
        const payload = ImportReportApiRequestSchema.parse(await readJsonBody(request));
        const fixture = await createImportSampleFile(runtimeRoot, payload.parser_hint, payload.sample_profile);
        const imported = await engine.ingestExternalReport({
          report_id: uid(`report-import-${payload.parser_hint}`, Date.now()),
          tenant_ref: tenantRef,
          workspace_id: "workspace-reports",
          project_id: "project-reports",
          created_by: session.userId,
          title: payload.title ?? `Imported ${payload.parser_hint.toUpperCase()} Proof`,
          language: "ar-SA",
          file_path: fixture.filePath,
          parser_hint: payload.parser_hint
        });
        json(response, 200, { data: { report_id: imported.state.report.report_id, ingest_id: imported.ingestRecord.ingest_id, payload: imported.payload, fixture_metadata: fixture.fixtureMetadata, sample_profile: payload.sample_profile } });
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/api\/v1\/reports\/reports\/[^/]+$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const detail = reportDetail(engine, reportId);
        const latestPublication = detail.state.publications[detail.state.publications.length - 1] ?? null;
        refreshPublicationService();
        json(response, 200, { data: { ...detail, publicUrl: latestPublication ? `/published/reports/${latestPublication.publication_id}` : null, publicationService } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/update$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = UpdateReportApiRequestSchema.parse(await readJsonBody(request));
        const current = engine.store.loadState(reportId);
        const blockRef = payload.block_ref ?? current.contentBlocks[0]?.block_id;
        if (!blockRef) throw new Error("No block available for update.");
        json(response, 200, { data: engine.updateReport({ report_id: reportId, actor_ref: session.userId, mutation: { mutation_kind: "replace_block_content", block_ref: blockRef, body: payload.body } }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/refresh$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        json(response, 200, { data: engine.refreshReport({ report_id: reportId, actor_ref: session.userId }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/compare$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const current = engine.store.loadState(reportId);
        const versions = engine.store.listVersionSnapshots(reportId);
        if (versions.length < 2) throw new Error("At least two versions are required for compare.");
        json(response, 200, { data: engine.compareReports({ report_id: reportId, actor_ref: session.userId, base_version_ref: versions[versions.length - 2].version.version_ref.version_id, target_version_ref: versions[versions.length - 1].version.version_ref.version_id }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/review$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ReviewApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, { data: engine.reviewReport({ report_id: reportId, actor_ref: session.userId, reviewer_refs: [], decision: payload.decision, comment: payload.comment }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/approve$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ApproveApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, { data: engine.approveReport({ report_id: reportId, actor_ref: session.userId, decision: payload.decision, comment: payload.comment }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/publish$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = PublishApiRequestSchema.parse(await readJsonBody(request));
        const result = await engine.publishReport({ report_id: reportId, actor_ref: session.userId, target_ref: payload.target_ref, publish_to_library: true });
        refreshPublicationService();
        json(response, 200, { data: { ...result, publicUrl: `/published/reports/${result.publication.publication_id}` } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/publish-degraded$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = PublishDegradedApiRequestSchema.parse(await readJsonBody(request));
        const result = await engine.publishDegradedReportOutput({
          report_id: reportId,
          actor_ref: session.userId,
          target_ref: `platform://reports/${reportId}/degraded`,
          reason: payload.reason,
          export_target: payload.export_target
        });
        refreshPublicationService();
        json(response, 200, { data: { ...result, publicUrl: `/published/reports/${result.publication.publication_id}` } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/schedules$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ScheduleApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, { data: engine.scheduleReport({ report_id: reportId, actor_ref: session.userId, next_run_at: payload.next_run_at, trigger_policy: { trigger_mode: "calendar", misfire_policy: "run_next", require_fresh_inputs: true, require_approval_before_run: false, freshness_window_minutes: 120 }, publication_policy: { publish_mode: "on_success", publication_target_refs: [`platform://reports/${reportId}/scheduled`], export_profile_refs: ["export-profile://reports/html"], visibility_scope_ref: "workspace" } }) });
        return;
      }
      if ((request.method ?? "GET") === "GET" && /^\/api\/v1\/reports\/reports\/[^/]+\/schedules$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        json(response, 200, { data: engine.listReportSchedules({ report_id: reportId }).schedules });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/schedules\/[^/]+\/run$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const scheduleId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const result = await engine.runReportSchedule({ schedule_id: scheduleId, actor_ref: session.userId });
        refreshPublicationService();
        json(response, 200, { data: result });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/schedules\/[^/]+\/update$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const scheduleId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ScheduleUpdateApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, {
          data: engine.updateReportSchedule({
            schedule_id: scheduleId,
            actor_ref: session.userId,
            next_run_at: payload.next_run_at,
            enabled: payload.enabled,
            publication_target_refs: payload.publication_target_refs,
            export_profile_refs: payload.export_profile_refs,
            visibility_scope_ref: payload.visibility_scope_ref,
            selective_regeneration_refs: payload.selective_regeneration_refs
          })
        });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/schedules\/[^/]+\/cancel$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const scheduleId = decodeURIComponent(pathname.split("/")[5] ?? "");
        json(response, 200, { data: engine.cancelReportSchedule({ schedule_id: scheduleId, actor_ref: session.userId }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/schedules\/[^/]+\/resume$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const scheduleId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ScheduleControlApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, { data: engine.resumeReportSchedule({ schedule_id: scheduleId, actor_ref: session.userId, next_run_at: payload.next_run_at }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/export\/(html|pdf|docx)$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const segments = pathname.split("/");
        const reportId = decodeURIComponent(segments[5] ?? "");
        const target = decodeURIComponent(segments[7] ?? "") as "html" | "pdf" | "docx";
        const result =
          target === "html"
            ? await engine.exportReportHtml({ report_id: reportId, actor_ref: session.userId })
            : target === "pdf"
              ? await engine.exportReportPdf({ report_id: reportId, actor_ref: session.userId })
              : await engine.exportReportDocx({ report_id: reportId, actor_ref: session.userId });
        json(response, 200, { data: { ...result, url: `/files/reports/${reportId}/${target}` } });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/convert\/presentation$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ConvertApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, { data: await engine.convertReportToPresentation({ report_id: reportId, actor_ref: session.userId, target_ref: payload.target_ref }) });
        return;
      }
      if ((request.method ?? "POST") === "POST" && /^\/api\/v1\/reports\/reports\/[^/]+\/convert\/dashboard$/.test(pathname)) {
        const session = authenticate(request);
        if (!session) return json(response, 401, { error: "Unauthorized" });
        assertTenant(request, session);
        const reportId = decodeURIComponent(pathname.split("/")[5] ?? "");
        const payload = ConvertApiRequestSchema.parse(await readJsonBody(request));
        json(response, 200, { data: await engine.convertReportToDashboard({ report_id: reportId, actor_ref: session.userId, target_ref: payload.target_ref }) });
        return;
      }
      json(response, 404, { error: "Not found" });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 0;
  return {
    origin: `http://${host}:${port}`,
    port,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  };
};
