import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright-core";

const host = "127.0.0.1";
const allocatePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate dashboard compare proof port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });
const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-compare-governance-proof");
const proofFile = path.join(proofRoot, "dashboard-compare-governance-proof.json");
const screenshotFile = path.join(proofRoot, "dashboard-compare-governance-proof.png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-compare-governance-${runRef}`;
const workspaceId = `workspace-dashboard-compare-governance-${runRef}`;
const projectId = `project-dashboard-compare-governance-${runRef}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error("dashboard web server did not start");
};

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

  const loginResponse = await fetch(`${baseUrl}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin",
      password: "1500",
      tenant_ref: tenantRef,
      workspace_id: workspaceId,
      project_id: projectId
    })
  });
  const loginPayload = await loginResponse.json();
  const token = loginPayload.data.accessToken;

  const api = async (endpoint, method = "GET", body = undefined) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-ref": tenantRef,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, payload: await response.json() };
  };

  const { payload: datasetPayload } = await api("/api/v1/data/register", "POST", {
    title: "Compare Governance Metrics",
    rows: [
      { date: "2026-03-01", department: "Sales", status: "Open", region: "Riyadh", revenue: 120, count: 8 },
      { date: "2026-03-02", department: "Support", status: "Closed", region: "Jeddah", revenue: 95, count: 5 },
      { date: "2026-03-03", department: "Finance", status: "Open", region: "Dammam", revenue: 140, count: 7 },
      { date: "2026-03-04", department: "Sales", status: "Closed", region: "Riyadh", revenue: 160, count: 9 }
    ]
  });

  const { payload: createdPayload } = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetPayload.dataset.dataset_id,
    title: "Compare Governance Dashboard",
    description: "Advanced compare and governance proof",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI chart table and filters."
  });
  const dashboardId = createdPayload.snapshot.dashboard.dashboard_id;

  await api("/api/v1/dashboards/refresh", "POST", { dashboard_id: dashboardId });
  await api("/api/v1/dashboards/publish", "POST", { dashboard_id: dashboardId, approval_granted: true });
  await api("/api/v1/dashboards/save-template", "POST", { dashboard_id: dashboardId, name: "Governance Template" });
  const { payload: statePayload } = await api(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const kpiWidget = statePayload.dashboard.widgets.find((entry) => entry.widget_type === "kpi_card");
  await api("/api/v1/dashboards/export-widget-target", "POST", {
    dashboard_id: dashboardId,
    widget_ref: kpiWidget.widget_id,
    target_kind: "live_external"
  });

  const { payload: periodCompare } = await api("/api/v1/dashboards/compare-advanced", "POST", {
    dashboard_id: dashboardId,
    source_kind: "dashboard",
    compare_mode: "period",
    compare_field: "date",
    base_value: "2026-03-01",
    target_value: "2026-03-04"
  });
  const { payload: groupCompare } = await api("/api/v1/dashboards/compare-advanced", "POST", {
    dashboard_id: dashboardId,
    source_kind: "dashboard",
    compare_mode: "group",
    compare_field: "department",
    base_value: "Sales",
    target_value: "Support"
  });
  const { payload: reportCompare } = await api("/api/v1/dashboards/compare-advanced", "POST", {
    dashboard_id: dashboardId,
    source_kind: "report",
    compare_mode: "version"
  });
  const { payload: presentationCompare } = await api("/api/v1/dashboards/compare-advanced", "POST", {
    dashboard_id: dashboardId,
    source_kind: "presentation",
    compare_mode: "version"
  });
  const { payload: fileCompare } = await api("/api/v1/dashboards/compare-advanced", "POST", {
    dashboard_id: dashboardId,
    source_kind: "file",
    compare_mode: "version",
    file_rows: [
      { date: "2026-03-01", department: "Sales", status: "Open", revenue: 130, count: 8 },
      { date: "2026-03-02", department: "Support", status: "Closed", revenue: 80, count: 5 }
    ]
  });
  const { payload: versionList } = await api(`/api/v1/dashboards/versions?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const { payload: dashboardVersionCompare } = await api("/api/v1/dashboards/compare-advanced", "POST", {
    dashboard_id: dashboardId,
    source_kind: "dashboard",
    compare_mode: "version",
    base_value: versionList.versions.at(-1)?.version_id
  });
  const { status: violationStatus, payload: governanceViolation } = await api("/api/v1/dashboards/rebind-widget", "POST", {
    dashboard_id: dashboardId,
    widget_ref: kpiWidget.widget_id,
    field_ref: "status",
    enforce_semantic_layer: true
  });
  const { payload: governancePayload } = await api(`/api/v1/dashboards/governance?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const { payload: libraryPayload } = await api(`/api/v1/dashboards/library?dashboard_id=${encodeURIComponent(dashboardId)}`);

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin");
  await page.fill("#password", "1500");
  await page.fill("#tenant", tenantRef);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/data", { timeout: 15000 }),
    page.getByRole("button", { name: "Login" }).click()
  ]);
  await page.goto(`${baseUrl}/dashboards?dashboard_id=${dashboardId}`, { waitUntil: "networkidle" });
  await page.selectOption("#compare-source-kind", "dashboard");
  await page.selectOption("#compare-mode", "period");
  await page.fill("#compare-field", "date");
  await page.fill("#compare-base", "2026-03-01");
  await page.fill("#compare-target", "2026-03-04");
  await page.getByRole("button", { name: "Run Advanced Compare" }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: screenshotFile, fullPage: true });
  const compareCardCount = await page.locator(".compare-card").count();
  await browser.close();

  const proof = {
    login_status: loginResponse.status,
    dashboard_id: dashboardId,
    compare_views: {
      dashboard_version: dashboardVersionCompare.compare_view,
      period: periodCompare.compare_view,
      group: groupCompare.compare_view,
      report: reportCompare.compare_view,
      presentation: presentationCompare.compare_view,
      file: fileCompare.compare_view
    },
    library: libraryPayload,
    governance: governancePayload,
    governance_violation_status: violationStatus,
    governance_violation: governanceViolation,
    screenshot_path: screenshotFile,
    compare_card_count: compareCardCount
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  server.kill();
}
