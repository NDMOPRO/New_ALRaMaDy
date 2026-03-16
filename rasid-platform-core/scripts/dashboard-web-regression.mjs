import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
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
        server.close(() => reject(new Error("failed to allocate dashboard web proof port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });

const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-web-proof");
const proofFile = path.join(proofRoot, "dashboard-web-regression.json");
const screenshotFile = path.join(proofRoot, "dashboard-web-regression.png");
const manifestFile = path.join(proofRoot, "dashboard-web-manifest.json");
const publishStateFile = path.join(proofRoot, "dashboard-web-publish-state.json");
const payloadFile = path.join(proofRoot, "dashboard-web-embed-payload.json");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const runRef = Date.now().toString();
const tenantRef = `tenant-dashboard-web-${runRef}`;
const workspaceId = `workspace-dashboard-web-${runRef}`;
const projectId = `project-dashboard-web-${runRef}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const unwrap = (payload) => payload?.payload ?? payload;
const requestJson = (targetPath, method = "GET", headers = {}, body = undefined) =>
  new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request(
      {
        host,
        port,
        path: targetPath,
        method,
        headers: payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
              ...headers
            }
          : headers
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (error) {
            reject(new Error(`Invalid JSON from ${targetPath}: ${error.message}: ${text.slice(0, 400)}`));
            return;
          }
          const statusCode = response.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`API ${method} ${targetPath} failed with ${statusCode}: ${JSON.stringify(parsed).slice(0, 600)}`));
            return;
          }
          resolve(parsed);
        });
      }
    );
    request.setTimeout(30000, () => request.destroy(new Error(`Request timed out for ${method} ${targetPath}`)));
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
  env: { ...process.env, RASID_DASHBOARD_WEB_PORT: String(port), RASID_DASHBOARD_TRANSPORT_PORT: String(transportPort) },
  stdio: "ignore"
});

try {
  fs.mkdirSync(proofRoot, { recursive: true });
  await waitForServer();

  const loginPayload = await requestJson("/api/v1/governance/auth/login", "POST", {}, {
      email: "admin",
      password: "1500",
      tenant_ref: tenantRef,
      workspace_id: workspaceId,
      project_id: projectId
  });
  const token = loginPayload.data.accessToken;

  const api = async (path, method, body) => {
    return requestJson(
      path,
      method,
      {
        authorization: `Bearer ${token}`,
        "x-tenant-ref": tenantRef,
      },
      body
    );
  };

  const dataset = unwrap(await api("/api/v1/data/register", "POST", {
    title: "Regression Metrics",
    rows: [
      { region: "Riyadh", status: "Open", revenue: 120, count: 8 },
      { region: "Jeddah", status: "Closed", revenue: 95, count: 5 },
      { region: "Dammam", status: "Open", revenue: 70, count: 4 }
    ]
  }));
  const datasetRef = dataset.dataset?.dataset_id ?? dataset.dataset_id;

  const created = unwrap(await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetRef,
    title: "Regression Dashboard",
    description: "Dashboard web regression",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI, chart, table, and filter."
  }));

  const dashboardId = created.snapshot?.dashboard?.dashboard_id;
  if (!dashboardId) {
    throw new Error(`dashboard create did not return snapshot: ${JSON.stringify(created).slice(0, 800)}`);
  }
  await api("/api/v1/dashboards/interactions/filter", "POST", {
    dashboard_id: dashboardId,
    field_ref: "region",
    values: ["Riyadh"]
  });
  const compared = unwrap(await api("/api/v1/dashboards/compare", "POST", { dashboard_id: dashboardId }));
  const templates = unwrap(await api("/api/v1/dashboards/save-template", "POST", { dashboard_id: dashboardId, name: "Regression Template" }));
  const templateId = templates.templates.at(-1)?.template_id ?? dashboardId;
  const clone = unwrap(await api("/api/v1/dashboards/create-from-template", "POST", {
    template_id: templateId,
    dataset_ref: datasetRef,
    mode: "advanced",
    title: "Regression Template Clone"
  }));
  const simulated = unwrap(await api("/api/v1/dashboards/simulate-design", "POST", {
    dataset_ref: datasetRef,
    title: "Simulated Design Dashboard",
    design_prompt: "Create a map-first executive dashboard with filter and table.",
    mode: "advanced"
  }));
  const published = unwrap(await api("/api/v1/dashboards/publish", "POST", { dashboard_id: dashboardId, approval_granted: true }));

  const embedResponse = await fetch(published.transport.served_embed_html_url);
  const embedHtml = await embedResponse.text();

  if (!embedResponse.ok || !embedHtml.includes("publication")) {
    throw new Error("served embed did not return the publication HTML");
  }

  fs.writeFileSync(manifestFile, await fetch(published.transport.served_manifest_url).then((response) => response.text()), "utf8");
  fs.writeFileSync(publishStateFile, await fetch(published.transport.served_publish_state_url).then((response) => response.text()), "utf8");
  fs.writeFileSync(payloadFile, await fetch(published.transport.served_embed_payload_url).then((response) => response.text()), "utf8");

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto(published.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await page.screenshot({ path: screenshotFile, fullPage: true });
  const domProof = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    bodyFont: window.getComputedStyle(document.body).fontFamily,
    cardCount: document.querySelectorAll("article").length,
    payloadAlignments: Array.from(document.querySelectorAll(".payload")).map((node) => window.getComputedStyle(node).textAlign)
  }));
  await browser.close();

  const proof = {
    login_status: 200,
    dataset_id: datasetRef,
    dashboard_id: dashboardId,
    compare_id: compared.snapshot.compare_results.at(-1)?.compare_id ?? null,
    template_count: templates.templates.length,
    template_id: templateId,
    cloned_dashboard_id: clone.snapshot?.dashboard?.dashboard_id ?? null,
    clone_error: clone.error ?? null,
    simulated_dashboard_id: simulated.snapshot?.dashboard?.dashboard_id ?? null,
    simulated_error: simulated.error ?? null,
    publication_id: published.publication.publication_id,
    served_embed_url: published.transport.served_embed_html_url,
    served_manifest_url: published.transport.served_manifest_url,
    served_publish_state_url: published.transport.served_publish_state_url,
    served_embed_payload_url: published.transport.served_embed_payload_url,
    embed_status: embedResponse.status,
    screenshot_path: screenshotFile,
    manifest_path: manifestFile,
    publish_state_path: publishStateFile,
    embed_payload_path: payloadFile,
    dom_proof: domProof
  };
  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(proof, null, 2));
} finally {
  server.kill();
}
