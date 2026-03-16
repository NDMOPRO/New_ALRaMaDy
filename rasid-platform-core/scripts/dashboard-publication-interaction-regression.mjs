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
        server.close(() => reject(new Error("failed to allocate dashboard publication proof port")));
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
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-publication-proof");
const proofFile = path.join(proofRoot, "dashboard-publication-interaction-proof.json");
const screenshotFile = path.join(proofRoot, "dashboard-publication-interaction-proof.png");
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-publication-proof-${runRef}`;
const workspaceId = `workspace-dashboard-publication-proof-${runRef}`;
const projectId = `project-dashboard-publication-proof-${runRef}`;

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
    return response.json();
  };

  const dataset = await api("/api/v1/data/register", "POST", {
    title: "Publication Metrics",
    rows: [
      { date: "2026-03-01", department: "Sales", status: "Open", region: "Riyadh", revenue: 120, count: 8 },
      { date: "2026-03-01", department: "Support", status: "Closed", region: "Jeddah", revenue: 95, count: 5 },
      { date: "2026-03-02", department: "Sales", status: "Open", region: "Dammam", revenue: 70, count: 4 },
      { date: "2026-03-02", department: "Finance", status: "Delayed", region: "Riyadh", revenue: 140, count: 7 }
    ]
  });
  const datasetRef = dataset.dataset?.dataset_id ?? dataset.dataset_id;

  const created = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetRef,
    title: "External Publication Dashboard",
    description: "Published interaction regression",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI, chart, table, and filter."
  });
  const dashboardId = created.snapshot.dashboard.dashboard_id;
  const published = await api("/api/v1/dashboards/publish", "POST", { dashboard_id: dashboardId, approval_granted: true });
  const publicationUrl = published.transport.served_embed_html_url;
  const publicationBaseUrl = published.transport.served_base_url;
  const accessToken = published.transport.served_access_token;

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto(publicationUrl, { waitUntil: "networkidle" });
  await page.fill("#field", "status");
  await page.fill("#values", "Open");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.waitForTimeout(500);
  await page.fill("#field", "department");
  await page.fill("#values", "Sales");
  await page.getByRole("button", { name: "Drill" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Compare" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotFile, fullPage: true });
  const statusText = await page.locator("#status").textContent();
  const traceText = await page.locator("#trace").textContent();
  await browser.close();

  const servedFetch = async (suffix, method = "GET", body = undefined) => {
    const response = await fetch(`${publicationBaseUrl}/${suffix}?access_token=${accessToken}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  };

  const runtimeState = await servedFetch("runtime-state");
  const evidence = await servedFetch("evidence");
  const audit = await servedFetch("audit");
  const lineage = await servedFetch("lineage");

  const proof = {
    login_status: loginResponse.status,
    dashboard_id: dashboardId,
    publication_id: published.publication.publication_id,
    publication_url: publicationUrl,
    runtime_status: statusText,
    trace_text: traceText,
    compare_id: runtimeState.compare_results.at(-1)?.compare_id ?? null,
    filter_query_refs: runtimeState.bindings
      .filter((entry) => entry.query_ref.includes("|filter:status=Open"))
      .map((entry) => entry.query_ref),
    drill_query_refs: runtimeState.bindings
      .filter((entry) => entry.query_ref.includes("|drill:department=Sales"))
      .map((entry) => entry.query_ref),
    latest_evidence: evidence.at(-1)?.evidence_pack_id ?? null,
    latest_audit: audit.at(-1)?.event_id ?? null,
    latest_lineage: lineage.at(-1)?.edge_id ?? null,
    screenshot_path: screenshotFile
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  server.kill();
}
