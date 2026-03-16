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
        server.close(() => reject(new Error("failed to allocate dashboard drag proof port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });
const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-drag-proof");
const proofFile = path.join(proofRoot, "dashboard-drag-binding-proof.json");
const screenshotFile = path.join(proofRoot, "dashboard-drag-binding-proof.png");
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-drag-proof-${runRef}`;
const workspaceId = `workspace-dashboard-drag-proof-${runRef}`;
const projectId = `project-dashboard-drag-proof-${runRef}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeGoto = async (page, targetUrl) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle" });
      return;
    } catch (error) {
      if (!`${error?.message ?? ""}`.includes("ERR_ABORTED") || attempt === 2) {
        throw error;
      }
      await wait(400 * (attempt + 1));
    }
  }
};

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
    return response.json();
  };

  const dataset = await api("/api/v1/data/register", "POST", {
    title: "Drag Metrics",
    rows: [
      { date: "2026-03-01", department: "Sales", status: "Open", region: "Riyadh", revenue: 120, count: 8 },
      { date: "2026-03-02", department: "Support", status: "Closed", region: "Jeddah", revenue: 95, count: 5 },
      { date: "2026-03-03", department: "Finance", status: "Open", region: "Dammam", revenue: 70, count: 4 }
    ]
  });
  const datasetRef = dataset.dataset?.dataset_id ?? dataset.dataset_id;

  const created = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetRef,
    title: "Drag Binding Dashboard",
    description: "Browser drag binding proof",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI, chart, table, and filter."
  });
  const dashboardId = created.snapshot.dashboard.dashboard_id;

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await safeGoto(page, `${baseUrl}/login`);
  await page.fill("#email", "admin");
  await page.fill("#password", "1500");
  await page.fill("#tenant", tenantRef);
  await Promise.all([
    page.waitForURL((url) => /\/(data|dashboards)/.test(url.pathname), { timeout: 30000 }),
    page.getByRole("button", { name: "Login" }).click()
  ]);
  await safeGoto(page, `${baseUrl}/dashboards?dashboard_id=${dashboardId}`);

  const metricField = page.locator('.field-pill[data-field-ref="count"]').first();
  const kpiWidget = page.locator('.widget[data-widget-type="kpi_card"]').first();
  await metricField.dragTo(kpiWidget);
  await page.waitForTimeout(500);

  const dimensionField = page.locator('.field-pill[data-field-ref="date"]').first();
  const chartWidget = page.locator('.widget[data-widget-type="bar_chart"]').first();
  await dimensionField.dragTo(chartWidget);
  await page.waitForTimeout(500);

  await page.fill("#filter-field", "status");
  await page.fill("#filter-values", "Open");
  await page.getByRole("button", { name: "Filter Interaction" }).click();
  await page.waitForTimeout(500);
  await page.fill("#filter-field", "department");
  await page.fill("#filter-values", "Sales");
  await page.getByRole("button", { name: "Drill Interaction" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotFile, fullPage: true });
  const statusText = await page.locator("#status").textContent();
  await browser.close();

  const finalState = await api(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const kpi = finalState.dashboard.widgets.find((entry) => entry.widget_type === "kpi_card");
  const chart = finalState.dashboard.widgets.find((entry) => entry.widget_type === "bar_chart");
  const proof = {
    login_status: loginResponse.status,
    dashboard_id: dashboardId,
    status: statusText,
    kpi_query_ref_after_metric_drag:
      finalState.dashboard.bindings.find((entry) => entry.target_widget_ref === kpi?.widget_id)?.query_ref ?? null,
    chart_query_ref_after_dimension_drag:
      finalState.dashboard.bindings.find((entry) => entry.target_widget_ref === chart?.widget_id)?.query_ref ?? null,
    cross_filter_query_refs: finalState.dashboard.bindings
      .filter((entry) => entry.query_ref.includes("|filter:status=Open"))
      .map((entry) => entry.query_ref),
    drill_query_refs: finalState.dashboard.bindings
      .filter((entry) => entry.query_ref.includes("|drill:department=Sales"))
      .map((entry) => entry.query_ref),
    screenshot_path: screenshotFile
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  server.kill();
}
