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
        server.close(() => reject(new Error("failed to allocate dashboard open proof port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });
const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-open-proof");
const proofFile = path.join(proofRoot, "dashboard-open-items-proof.json");
const mobileScreenshot = path.join(proofRoot, "dashboard-mobile-behavior-proof.png");
const tvScreenshot = path.join(proofRoot, "dashboard-tv-behavior-proof.png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-open-proof-${runRef}`;
const workspaceId = `workspace-dashboard-open-proof-${runRef}`;
const projectId = `project-dashboard-open-proof-${runRef}`;

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
      // keep retrying
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
    title: "Coverage Metrics",
    rows: [
      { date: "2026-03-01", department: "Sales", status: "Open", region: "Riyadh", revenue: 120, margin: 30, count: 8, latitude: 24.7136, longitude: 46.6753 },
      { date: "2026-03-01", department: "Support", status: "Closed", region: "Jeddah", revenue: 95, margin: 21, count: 5, latitude: 21.5433, longitude: 39.1728 },
      { date: "2026-03-02", department: "Sales", status: "Open", region: "Dammam", revenue: 70, margin: 12, count: 4, latitude: 26.4207, longitude: 50.0888 },
      { date: "2026-03-02", department: "Finance", status: "Delayed", region: "Riyadh", revenue: 140, margin: 35, count: 7, latitude: 24.7136, longitude: 46.6753 },
      { date: "2026-03-03", department: "Support", status: "Open", region: "Jeddah", revenue: 110, margin: 27, count: 6, latitude: 21.5433, longitude: 39.1728 },
      { date: "2026-03-03", department: "Finance", status: "Closed", region: "Dammam", revenue: 88, margin: 17, count: 3, latitude: 26.4207, longitude: 50.0888 }
    ]
  });
  const datasetRef = dataset.dataset?.dataset_id ?? dataset.dataset_id;

  const created = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetRef,
    title: "Open Items Dashboard",
    description: "Strict open items regression",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI, chart, table, interactive filter, compare and anomaly coverage."
  });
  const dashboardId = created.snapshot.dashboard.dashboard_id;

  const widgetTypes = ["map", "scatter_3d", "heatmap", "compare_chart", "top_bottom", "growth_indicator", "anomaly_alert"];
  for (const [index, widgetType] of widgetTypes.entries()) {
    await api("/api/v1/dashboards/add-widget", "POST", {
      dashboard_id: dashboardId,
      widget_type: widgetType,
      x: (index % 3) * 4,
      y: 6 + Math.floor(index / 3) * 3
    });
  }

  const stateAfterWidgets = await api(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const chartWidget = stateAfterWidgets.dashboard.widgets.find((widget) => widget.widget_type === "bar_chart");
  await api("/api/v1/dashboards/rebind-widget", "POST", {
    dashboard_id: dashboardId,
    widget_ref: chartWidget.widget_id,
    field_ref: "date"
  });

  await api("/api/v1/dashboards/interactions/filter", "POST", {
    dashboard_id: dashboardId,
    field_ref: "status",
    values: ["Open"]
  });

  await api("/api/v1/dashboards/interactions/drill", "POST", {
    dashboard_id: dashboardId,
    field_ref: "department",
    values: ["Sales"]
  });

  const finalState = await api(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const published = await api("/api/v1/dashboards/publish", "POST", { dashboard_id: dashboardId, approval_granted: true });

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobileContext.addCookies([
    { name: "rasid_auth", value: encodeURIComponent(token), domain: host, path: "/" },
    { name: "rasid_tenant", value: encodeURIComponent(tenantRef), domain: host, path: "/" },
    { name: "rasid_workspace", value: encodeURIComponent(workspaceId), domain: host, path: "/" },
    { name: "rasid_project", value: encodeURIComponent(projectId), domain: host, path: "/" }
  ]);
  await mobileContext.addInitScript(
    ([tenant, workspace, project]) => {
      localStorage.setItem("rasid_tenant", tenant);
      localStorage.setItem("rasid_workspace", workspace);
      localStorage.setItem("rasid_project", project);
      localStorage.setItem("rasid_actor", "admin");
    },
    [tenantRef, workspaceId, projectId]
  );
  const page = await mobileContext.newPage();
  await safeGoto(page, `${baseUrl}/dashboards?dashboard_id=${dashboardId}`);
  const mobileStatus = await page.locator("#status").textContent();
  await page.screenshot({ path: mobileScreenshot, fullPage: true });

  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await tvContext.addCookies([
    { name: "rasid_auth", value: encodeURIComponent(token), domain: host, path: "/" },
    { name: "rasid_tenant", value: encodeURIComponent(tenantRef), domain: host, path: "/" },
    { name: "rasid_workspace", value: encodeURIComponent(workspaceId), domain: host, path: "/" },
    { name: "rasid_project", value: encodeURIComponent(projectId), domain: host, path: "/" }
  ]);
  await tvContext.addInitScript(
    ([tenant, workspace, project]) => {
      localStorage.setItem("rasid_tenant", tenant);
      localStorage.setItem("rasid_workspace", workspace);
      localStorage.setItem("rasid_project", project);
      localStorage.setItem("rasid_actor", "admin");
    },
    [tenantRef, workspaceId, projectId]
  );
  const tvPage = await tvContext.newPage();
  await safeGoto(tvPage, `${baseUrl}/dashboards?dashboard_id=${dashboardId}&display=tv`);
  await tvPage.getByRole("button", { name: "Refresh" }).click();
  await tvPage.waitForLoadState("networkidle");
  const tvStatus = await tvPage.locator("#status").textContent();
  await tvPage.screenshot({ path: tvScreenshot, fullPage: true });
  await tvContext.close();
  await mobileContext.close();
  await browser.close();

  const proof = {
    login_status: loginResponse.status,
    dashboard_id: dashboardId,
    widget_types_rendered: finalState.rendered.map((entry) => entry.widget_type),
    filter_fields: finalState.dashboard.filter_sets.map((entry) => entry.field_ref),
    chart_query_ref_after_rebind:
      finalState.dashboard.bindings.find((entry) => entry.target_widget_ref === chartWidget.widget_id)?.query_ref ?? null,
    cross_filter_query_refs: finalState.dashboard.bindings
      .filter((entry) => entry.query_ref.includes("|filter:status=Open"))
      .map((entry) => ({ target_widget_ref: entry.target_widget_ref, query_ref: entry.query_ref })),
    drill_detail_pages: finalState.dashboard.pages.map((page) => page.page_id),
    drill_detail_widgets: finalState.dashboard.widgets
      .filter((entry) => entry.page_id === "page-detail")
      .map((entry) => ({
        widget_id: entry.widget_id,
        title: entry.title,
        binding_query_ref: finalState.dashboard.bindings.find((binding) => binding.target_widget_ref === entry.widget_id)?.query_ref ?? null
      })),
    publication_id: published.publication.publication_id,
    served_embed_url: published.transport.served_embed_html_url,
    mobile_status: mobileStatus,
    tv_status: tvStatus,
    mobile_screenshot: mobileScreenshot,
    tv_screenshot: tvScreenshot
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  server.kill();
}
