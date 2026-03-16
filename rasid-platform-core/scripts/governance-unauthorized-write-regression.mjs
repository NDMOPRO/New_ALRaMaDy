import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

const host = "127.0.0.1";
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate free port")));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
const port = await getFreePort();
const transportPort = await getFreePort();
const baseUrl = `http://${host}:${port}`;
const proofRoot = path.join(process.cwd(), ".runtime", "governance-proof");
const proofFile = path.join(proofRoot, "governance-unauthorized-write-matrix.json");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error("governance web server did not start");
};
const stopServer = () => {
  if (server.exitCode !== null || server.killed) return;
  if (process.platform === "win32") {
    server.kill();
    try {
      spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
    return;
  }
  server.kill("SIGTERM");
};

const runId = Date.now();
const tenantRef = `tenant-governance-denied-${runId}`;
const workspaceId = `workspace-governance-denied-${runId}`;
const projectId = `project-governance-denied-${runId}`;

const server = spawn("node", ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_PORT: String(port),
    RASID_DASHBOARD_TRANSPORT_PORT: String(transportPort)
  },
  stdio: "ignore"
});

try {
  fs.mkdirSync(proofRoot, { recursive: true });
  await waitForServer();

  const login = async (actorRef) => {
    const response = await fetch(`${baseUrl}/api/v1/governance/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin",
        password: "1500",
        tenant_ref: tenantRef,
        workspace_id: workspaceId,
        project_id: projectId,
        actor_ref: actorRef
      })
    });
    const payload = await response.json();
    return payload.data.accessToken;
  };

  const adminToken = await login("admin");
  const viewerToken = await login("viewer.actor");

  const api = async (token, actorRef, endpoint, method = "GET", body = undefined) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-ref": tenantRef,
        "x-actor-ref": actorRef,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, payload: await response.json() };
  };

  const dataset = await api(adminToken, "admin", "/api/v1/data/register", "POST", {
    title: "Unauthorized Matrix Dataset",
    rows: [{ date: "2026-03-15", region: "Riyadh", revenue: 100, status: "Open" }]
  });
  const datasetId = dataset.payload.dataset.dataset_id;
  const dashboard = await api(adminToken, "admin", "/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetId,
    title: "Unauthorized Matrix Dashboard",
    mode: "advanced"
  });
  const dashboardId = dashboard.payload.snapshot.dashboard.dashboard_id;
  const widgetRef = dashboard.payload.snapshot.dashboard.widgets?.[0]?.widget_id ?? `widget-${dashboardId}-0`;
  await api(adminToken, "admin", "/api/v1/governance/assignments", "POST", {
    principal_ref: "viewer.actor",
    role_id: "viewer",
    workspace_id: workspaceId
  });

  const deniedCases = [
    { label: "roles", endpoint: "/api/v1/governance/roles", body: { role_id: "blocked-role", name: "Blocked Role", permission_ids: ["dashboard:read"] } },
    { label: "kpis", endpoint: "/api/v1/governance/kpis", body: { kpi_id: "blocked-kpi", name: "Blocked KPI", formula: "SUM(revenue)" } },
    { label: "evidence", endpoint: "/api/v1/governance/evidence/create", body: { action_id: "manual.denied", resource_ref: "blocked-resource" } },
    { label: "compliance", endpoint: "/api/v1/governance/compliance/check", body: { resource_kind: "artifact", resource_ref: dashboardId, values: { email: "ops@example.com" } } },
    { label: "data_register", endpoint: "/api/v1/data/register", body: { title: "Blocked Dataset", rows: [{ value: 1 }] } },
    { label: "dashboard_create", endpoint: "/api/v1/dashboards/create", body: { dataset_ref: datasetId, title: "Blocked Dashboard", mode: "advanced" } },
    { label: "dashboard_add_page", endpoint: "/api/v1/dashboards/add-page", body: { dashboard_id: dashboardId, page_id: "page-denied", title: "Denied" } },
    { label: "dashboard_publish", endpoint: "/api/v1/dashboards/publish", body: { dashboard_id: dashboardId } },
    { label: "dashboard_share", endpoint: "/api/v1/dashboards/share", body: { dashboard_id: dashboardId } },
    { label: "dashboard_export", endpoint: "/api/v1/dashboards/export-widget-target", body: { dashboard_id: dashboardId, widget_ref: widgetRef, target_kind: "live_external" } },
    { label: "dashboard_schedule", endpoint: "/api/v1/dashboards/schedule", body: { dashboard_id: dashboardId } },
    { label: "dashboard_template", endpoint: "/api/v1/dashboards/save-template", body: { dashboard_id: dashboardId } },
    { label: "report_convert", endpoint: "/api/v1/reports/convert-to-dashboard", body: {} },
    { label: "report_convert_presentation", endpoint: "/api/v1/reports/convert-to-presentation", body: {} },
    { label: "presentation_convert_dashboard", endpoint: "/api/v1/presentations/convert-to-dashboard", body: {} },
    { label: "ai_jobs", endpoint: "/api/v1/ai/jobs", body: { page_path: "/governance", session_id: "denied-session", prompt: "Summarize revenue", resource_ref: dashboardId } },
    { label: "strict_route", endpoint: "/api/v1/replication/consume-dashboard-output", body: {} },
    { label: "localization_route", endpoint: "/api/v1/localization/consume-dashboard-output", body: {} }
  ];

  const results = [];
  for (const testCase of deniedCases) {
    const result = await api(viewerToken, "viewer.actor", testCase.endpoint, "POST", testCase.body);
    results.push({
      label: testCase.label,
      endpoint: testCase.endpoint,
      status: result.status,
      error: result.payload.error ?? null,
      governance: result.payload.governance ?? null,
      denied: result.status === 403 && result.payload.error === "governance_denied"
    });
  }

  const audit = await api(adminToken, "admin", "/api/v1/governance/audit");
  const deniedAuditEvents = (audit.payload.audit ?? []).filter((entry) => entry.metadata?.result_status === "denied" || entry.result_status === "failed");
  const proof = {
    tenant_ref: tenantRef,
    dataset_id: datasetId,
    dashboard_id: dashboardId,
    widget_ref: widgetRef,
    results,
    denied_count: results.filter((entry) => entry.denied).length,
    all_denied: results.every((entry) => entry.denied),
    denied_audit_count: deniedAuditEvents.length,
    denied_audit_events: deniedAuditEvents.slice(-20)
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  stopServer();
}
