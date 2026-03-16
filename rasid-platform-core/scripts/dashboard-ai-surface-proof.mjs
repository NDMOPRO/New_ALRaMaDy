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
        server.close(() => reject(new Error("failed to allocate dashboard ai proof port")));
        return;
      }
      const allocatedPort = address.port;
      server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
    });
  });

const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const proofRoot = path.join(process.cwd(), ".runtime", "dashboard-ai-proof", `run-${stamp}`);
const proofFile = path.join(proofRoot, "dashboard-ai-surface-proof.json");
const latestProofFile = path.join(process.cwd(), ".runtime", "dashboard-ai-proof", "dashboard-ai-surface-proof.json");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const aiJobsRoot = path.join(process.cwd(), ".runtime", "dashboard-web", "ai-engine", "jobs");
const tenantRef = `tenant-dashboard-ai-proof-${Date.now()}`;
const workspaceId = `workspace-dashboard-ai-proof-${Date.now()}`;
const projectId = `project-dashboard-ai-proof-${Date.now()}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};
const slug = (value) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

const requestJson = (targetPath, method = "GET", headers = {}, body = undefined, attempt = 0) =>
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
          const statusCode = response.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`API ${method} ${targetPath} failed with ${statusCode}: ${text.slice(0, 400)}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(new Error(`Invalid JSON response from ${targetPath}: ${error.message}`));
          }
        });
      }
    );
    request.setTimeout(180000, () => request.destroy(new Error(`Request timed out for ${method} ${targetPath}`)));
    request.on("error", async (error) => {
      if (attempt < 2 && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"].includes(error.code ?? "")) {
        await wait(400 * (attempt + 1));
        resolve(await requestJson(targetPath, method, headers, body, attempt + 1));
        return;
      }
      reject(error);
    });
    if (payload) request.write(payload);
    request.end();
  });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const status = await new Promise((resolve, reject) => {
        const request = http.request({ host, port, path: "/login", method: "GET" }, (response) => resolve(response.statusCode ?? 0));
        request.setTimeout(10000, () => request.destroy(new Error("waitForServer timeout")));
        request.on("error", reject);
        request.end();
      });
      if (status >= 200 && status < 500) return;
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error("dashboard AI web server did not start");
};

const responseJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${response.url()}: ${text.slice(0, 300)}`);
  }
};

const runtimePaths = (jobId) => {
  const root = path.join(aiJobsRoot, jobId);
  return {
    root,
    request: path.join(root, "request.json"),
    context: path.join(root, "context.json"),
    plan: path.join(root, "plan.json"),
    phases: path.join(root, "phases.json"),
    summary: path.join(root, "summary.json"),
    result: path.join(root, "result.json"),
    artifacts: path.join(root, "artifacts.json"),
    evidence: path.join(root, "evidence", `evidence-${jobId}.json`),
    audit: path.join(root, "audit", "audit-events.json"),
    lineage: path.join(root, "lineage", "lineage-edges.json")
  };
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const collectJob = async (api, jobId, ui) => {
  const detail = await api(`/api/v1/ai/jobs/${jobId}`);
  const status = await api(`/api/v1/ai/jobs/${jobId}/status`);
  const result = await api(`/api/v1/ai/jobs/${jobId}/result`);
  const evidence = await api(`/api/v1/ai/jobs/${jobId}/evidence`);
  const audit = await api(`/api/v1/ai/jobs/${jobId}/audit`);
  const lineage = await api(`/api/v1/ai/jobs/${jobId}/lineage`);
  const paths = runtimePaths(jobId);
  const planFile = readJson(paths.plan);
  const phasesFile = readJson(paths.phases);
  const evidenceFile = readJson(paths.evidence);
  const summaryFile = readJson(paths.summary);
  const resultFile = readJson(paths.result);
  const artifactsFile = readJson(paths.artifacts);
  return {
    job_id: jobId,
    ui,
    detail,
    status,
    result,
    evidence,
    audit,
    lineage,
    runtime_paths: paths,
    plan_file: {
      selected_agent: planFile.selected_agent,
      selected_capability: planFile.selected_capability,
      selected_action_ref: planFile.selected_action_ref,
      selected_tool_ref: planFile.selected_tool_ref,
      step_refs: planFile.step_refs
    },
    phases_file: phasesFile.map((phase) => ({
      phase_kind: phase.phase_kind,
      status: phase.status,
      selected_action_ref: phase.selected_action_ref,
      selected_tool_ref: phase.selected_tool_ref
    })),
    evidence_file: {
      evidence_pack_id: evidenceFile.evidence_pack_id,
      verification_status: evidenceFile.verification_status,
      generated_artifact_refs: evidenceFile.generated_artifact_refs,
      tool_versions: evidenceFile.reproducibility_metadata?.tool_versions ?? []
    },
    summary_file: {
      summary_id: summaryFile.summary_id,
      selected_action_ref: summaryFile.selected_action_ref,
      selected_tool_ref: summaryFile.selected_tool_ref,
      evidence_refs: summaryFile.evidence_refs,
      audit_refs: summaryFile.audit_refs,
      lineage_refs: summaryFile.lineage_refs
    },
    result_file: resultFile,
    artifacts_file: artifactsFile
  };
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

let browser;
try {
  ensureDir(proofRoot);
  await waitForServer();

  const loginPayload = await requestJson("/api/v1/governance/auth/login", "POST", {}, {
      email: "admin",
      password: "1500",
      tenant_ref: tenantRef,
      workspace_id: workspaceId,
      project_id: projectId
  });
  const token = loginPayload.data.accessToken;

  const api = (url, method = "GET", body = undefined) =>
    requestJson(
      url,
      method,
      {
        authorization: `Bearer ${token}`,
        "x-tenant-ref": tenantRef
      },
      body
    );

  const dataset = await api("/api/v1/data/register", "POST", {
    title: `Dashboard AI proof ${stamp}`,
    rows: [
      { period: "2026-Q1", region: "Riyadh", revenue: 120, margin: 30, units: 8 },
      { period: "2026-Q2", region: "Riyadh", revenue: 140, margin: 35, units: 9 },
      { period: "2026-Q1", region: "Jeddah", revenue: 95, margin: 24, units: 5 },
      { period: "2026-Q2", region: "Jeddah", revenue: 110, margin: 27, units: 6 }
    ]
  });
  const datasetRef = dataset.dataset?.dataset_id ?? dataset.dataset_id;

  browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin");
  await page.fill("#password", "1500");
  await page.fill("#tenant", tenantRef);
  await page.click("#login");
  await page.waitForURL(`${baseUrl}/data`);

  const runAiCase = async ({ name, pagePath, prompt, resourceRef = "", approval = true, query = {} }) => {
    const sessionId = `session-${slug(name)}-${Date.now()}`;
    const url = new URL(`${baseUrl}${pagePath}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        url.searchParams.set(key, `${value}`);
      }
    }
    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await page.fill("#ai-session-id", sessionId);
    await page.fill("#ai-prompt", prompt);
    await page.fill("#ai-resource-ref", resourceRef);
    const checked = await page.locator("#ai-approval").isChecked();
    if (checked !== approval) {
      await page.click("#ai-approval");
    }
    const entryScreenshot = path.join(proofRoot, `${slug(name)}-entry.png`);
    await page.screenshot({ path: entryScreenshot, fullPage: true });
    const responsePromise = page.waitForResponse(
      (response) => response.url() === `${baseUrl}/api/v1/ai/jobs` && response.request().method() === "POST",
      { timeout: 180000 }
    );
    await page.click("#ai-run");
    const response = await responsePromise;
    const payload = await responseJson(response);
    if (!response.ok()) {
      throw new Error(`AI case ${name} failed: ${JSON.stringify(payload).slice(0, 400)}`);
    }
    let detail = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const listed = await api(`/api/v1/ai/jobs?session_id=${encodeURIComponent(sessionId)}`);
      detail = Array.isArray(listed.jobs) ? listed.jobs[0] : null;
      if (detail?.job_id) break;
      await wait(250);
    }
    if (!detail?.job_id) throw new Error(`No AI job persisted for ${name}`);
    if (payload.open_path) {
      await page.goto(`${baseUrl}${payload.open_path}`, { waitUntil: "networkidle" }).catch(() => null);
    }
    await page.waitForTimeout(750);
    const resultText = await page.locator("#ai-result").textContent().catch(() => "");
    const resultScreenshot = path.join(proofRoot, `${slug(name)}-result.png`);
    await page.screenshot({ path: resultScreenshot, fullPage: true });
    return {
      session_id: sessionId,
      job_id: detail.job_id,
      open_path: payload.open_path ?? null,
      current_url: page.url(),
      result_text: resultText ?? "",
      screenshots: {
        entry: entryScreenshot,
        result: resultScreenshot
      }
    };
  };

  const autoDashboardUi = await runAiCase({
    name: "dashboard-auto-generate",
    pagePath: "/data",
    prompt: "حلل هذه البيانات وأنشئ dashboard تنفيذي كامل دون حوار طويل مع KPI وchart وtable وfilter",
    approval: true,
    resourceRef: datasetRef,
    query: { dataset_ref: datasetRef }
  });
  const autoDashboardId = new URL(`${baseUrl}${autoDashboardUi.open_path ?? ""}`).searchParams.get("dashboard_id");
  if (!autoDashboardId) {
    throw new Error("AI dashboard generation did not open a dashboard_id");
  }
  const autoDashboardJob = await collectJob(api, autoDashboardUi.job_id, autoDashboardUi);

  const localDashboard = await api("/api/v1/dashboards/create", "POST", {
    dataset_ref: datasetRef,
    title: `Dashboard AI Local ${stamp.slice(11, 19)}`,
    description: "Server-local dashboard for /dashboards AI proof",
    mode: "advanced",
    prompt_text: "Create an executive dashboard with KPI, chart, table, and filter."
  });
  const localDashboardId = localDashboard.snapshot.dashboard.dashboard_id;

  const dashboardToReportUi = await runAiCase({
    name: "dashboard-to-report-approved",
    pagePath: "/dashboards",
    prompt: "حول هذه اللوحة إلى تقرير تنفيذي مع narrative وexport-ready sections",
    approval: true,
    resourceRef: localDashboardId,
    query: { dashboard_id: localDashboardId }
  });
  const dashboardToReportJob = await collectJob(api, dashboardToReportUi.job_id, dashboardToReportUi);

  const dashboardState = await api(`/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(localDashboardId)}`);
  const proof = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    dataset_ref: datasetRef,
    dashboard_id: localDashboardId,
    auto_generated_dashboard_id: autoDashboardId,
    dashboard_ai_auto_mode: {
      ui: autoDashboardUi,
      job: autoDashboardJob
    },
    dashboard_ai_conversion_mode: {
      ui: dashboardToReportUi,
      job: dashboardToReportJob
    },
    dashboard_state: {
      widget_count: dashboardState.dashboard.widgets.length,
      page_count: dashboardState.dashboard.pages.length,
      filter_count: dashboardState.dashboard.filter_sets.length,
      binding_count: dashboardState.dashboard.bindings.length
    },
    decisions: {
      auto_governance_decision_id: autoDashboardJob.detail.governance?.decision?.decision_id ?? null,
      conversion_governance_decision_id: dashboardToReportJob.detail.governance?.decision?.decision_id ?? null,
      auto_plan_id: autoDashboardJob.detail.plan.plan_id,
      conversion_plan_id: dashboardToReportJob.detail.plan.plan_id,
      auto_summary_id: autoDashboardJob.detail.summary.summary_id,
      conversion_summary_id: dashboardToReportJob.detail.summary.summary_id
    }
  };

  if (autoDashboardJob.plan_file.selected_action_ref !== "dashboard.create.v1") {
    throw new Error("Dashboard AI auto mode did not execute dashboard.create.v1");
  }
  if (autoDashboardJob.plan_file.selected_tool_ref !== "registry.dashboard.create") {
    throw new Error("Dashboard AI auto mode did not execute registry.dashboard.create");
  }
  if (dashboardToReportJob.plan_file.selected_action_ref !== "reports.create_report.v1") {
    throw new Error("Dashboard AI conversion mode did not route into reports.create_report.v1");
  }
  if (autoDashboardJob.evidence_file.generated_artifact_refs.length < 3) {
    throw new Error("Dashboard AI auto mode evidence pack is incomplete");
  }
  if ((autoDashboardJob.evidence_file.tool_versions ?? []).length === 0) {
    throw new Error("Dashboard AI auto mode did not persist tool_versions");
  }
  if ((autoDashboardJob.audit ?? []).length === 0 || (autoDashboardJob.lineage ?? []).length === 0) {
    throw new Error("Dashboard AI auto mode did not persist audit/lineage");
  }
  if ((dashboardToReportJob.audit ?? []).length === 0 || (dashboardToReportJob.lineage ?? []).length === 0) {
    throw new Error("Dashboard AI conversion mode did not persist audit/lineage");
  }

  writeJson(proofFile, proof);
  writeJson(latestProofFile, proof);
  console.log(JSON.stringify(proof, null, 2));
} finally {
  if (browser) {
    await browser.close().catch(() => null);
  }
  server.kill();
}
