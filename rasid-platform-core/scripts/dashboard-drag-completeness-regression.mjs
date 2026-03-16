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
        server.close(() => reject(new Error("failed to allocate dashboard drag completeness proof port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });
const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-drag-complete-proof");
const proofFile = path.join(proofRoot, "dashboard-drag-completeness-proof.json");
const desktopScreenshot = path.join(proofRoot, "dashboard-drag-completeness-proof.png");
const mobileScreenshot = path.join(proofRoot, "dashboard-drag-mobile-long-press-proof.png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-drag-complete-${runRef}`;
const workspaceId = `workspace-dashboard-drag-complete-${runRef}`;
const projectId = `project-dashboard-drag-complete-${runRef}`;

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
    return { status: response.status, payload: await response.json() };
  };

  const { payload: datasetPayload } = await api("/api/v1/data/register", "POST", {
    title: "Drag Completeness Metrics",
    rows: [
      { date: "2026-03-01", department: "Sales", status: "Open", region: "Riyadh", revenue: 120, count: 8 },
      { date: "2026-03-02", department: "Support", status: "Closed", region: "Jeddah", revenue: 95, count: 5 },
      { date: "2026-03-03", department: "Finance", status: "Open", region: "Dammam", revenue: 140, count: 7 }
    ]
  });

  const { payload: createdPayload } = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetPayload.dataset.dataset_id,
    title: "Drag Completeness Dashboard",
    description: "Dashboard drag completeness proof",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI chart table and filters."
  });
  const dashboardId = createdPayload.snapshot.dashboard.dashboard_id;
  const savedFilterResponse = await api("/api/v1/dashboards/save-filter-preset", "POST", {
    dashboard_id: dashboardId,
    field_ref: "status",
    values: ["Open"]
  });
  const savedFilterId = savedFilterResponse.payload.filters.at(-1)?.filter_id;
  const widgetRef = createdPayload.snapshot.dashboard.widgets[0]?.widget_id;
  if (!savedFilterId || !widgetRef) {
    throw new Error("drag completeness setup did not yield saved filter id or widget ref");
  }

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await safeGoto(page, `${baseUrl}/login`);
  await page.fill("#email", "admin");
  await page.fill("#password", "1500");
  await page.fill("#tenant", tenantRef);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/data", { timeout: 15000 }),
    page.getByRole("button", { name: "Login" }).click()
  ]);
  await safeGoto(page, `${baseUrl}/dashboards?dashboard_id=${dashboardId}`);

  await page.waitForSelector(".saved-filter-item");
  const savedFilterTransfer = await page.evaluateHandle((filterId) => {
    const transfer = new DataTransfer();
    transfer.setData("text/saved-filter-id", filterId);
    return transfer;
  }, savedFilterId);
  await page.dispatchEvent(".saved-filter-item", "dragstart", { dataTransfer: savedFilterTransfer });
  await page.dispatchEvent("#canvas", "dragover", { dataTransfer: savedFilterTransfer });
  await page.dispatchEvent("#canvas", "drop", { dataTransfer: savedFilterTransfer });
  await page.waitForLoadState("networkidle");

  const widgetTransfer = await page.evaluateHandle((currentWidgetRef) => {
    const transfer = new DataTransfer();
    transfer.setData("text/widget-ref", currentWidgetRef);
    return transfer;
  }, widgetRef);
  await page.dispatchEvent(".widget", "dragstart", { dataTransfer: widgetTransfer });
  await page.dispatchEvent("#slide-target", "dragover", { dataTransfer: widgetTransfer });
  await page.dispatchEvent("#slide-target", "drop", { dataTransfer: widgetTransfer });
  await page.dispatchEvent(".widget", "dragstart", { dataTransfer: widgetTransfer });
  await page.dispatchEvent("#live-target", "dragover", { dataTransfer: widgetTransfer });
  await page.dispatchEvent("#live-target", "drop", { dataTransfer: widgetTransfer });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: desktopScreenshot, fullPage: true });

  await api("/api/v1/dashboards/apply-saved-filter", "POST", { dashboard_id: dashboardId, filter_id: savedFilterId });
  await api("/api/v1/dashboards/export-widget-target", "POST", { dashboard_id: dashboardId, widget_ref: widgetRef, target_kind: "slide" });
  await api("/api/v1/dashboards/export-widget-target", "POST", { dashboard_id: dashboardId, widget_ref: widgetRef, target_kind: "live_external" });

  const { payload: statePayload } = await api(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const { payload: libraryPayload } = await api(`/api/v1/dashboards/library?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const { payload: savedFiltersPayload } = await api(`/api/v1/dashboards/saved-filters?dashboard_id=${encodeURIComponent(dashboardId)}`);

  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  await safeGoto(mobilePage, `${baseUrl}/login`);
  await mobilePage.fill("#email", "admin");
  await mobilePage.fill("#password", "1500");
  await mobilePage.fill("#tenant", tenantRef);
  await Promise.all([
    mobilePage.waitForURL((url) => url.pathname === "/data", { timeout: 15000 }),
    mobilePage.getByRole("button", { name: "Login" }).click()
  ]);
  await safeGoto(mobilePage, `${baseUrl}/dashboards?dashboard_id=${dashboardId}`);
  await mobilePage.locator(".field-pill").first().dispatchEvent("touchstart");
  await wait(700);
  const longPressIndicator = await mobilePage.locator("#drag-indicator").textContent();
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });
  await mobilePage.locator(".field-pill").first().dispatchEvent("touchend");
  await browser.close();

  const proof = {
    login_status: loginResponse.status,
    dashboard_id: dashboardId,
    saved_filter_count: savedFiltersPayload.filters.length,
    saved_filter_drag_query_refs: statePayload.dashboard.bindings
      .filter((entry) => entry.query_ref.includes("|filter:status=Open"))
      .map((entry) => entry.query_ref),
    widget_target_transfers: libraryPayload.widget_targets ?? [],
    slide_target_path: (libraryPayload.widget_targets ?? []).find((entry) => entry.target_kind === "slide")?.open_path ?? null,
    live_target_path: (libraryPayload.widget_targets ?? []).find((entry) => entry.target_kind === "live_external")?.open_path ?? null,
    long_press_indicator: longPressIndicator,
    desktop_screenshot: desktopScreenshot,
    mobile_screenshot: mobileScreenshot
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  server.kill();
}
