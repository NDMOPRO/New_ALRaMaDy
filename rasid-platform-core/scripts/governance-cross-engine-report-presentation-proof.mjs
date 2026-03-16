import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const host = "127.0.0.1";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const proofRoot = path.join(root, ".runtime", "governance-cross-engine-proof");
const proofDir = path.join(proofRoot, `report-presentation-flow-${stamp}`);
const proofFile = path.join(proofRoot, "governance-cross-engine-report-presentation-proof.json");
const detailedProofFile = path.join(proofDir, "proof.json");
const serverOutFile = path.join(proofDir, "server-out.log");
const serverErrFile = path.join(proofDir, "server-err.log");
const screenshotBoundary = path.join(proofDir, "report-presentation-boundary.png");
const screenshotPresentation = path.join(proofDir, "report-presentation-approved.png");
const screenshotDashboard = path.join(proofDir, "presentation-dashboard-approved.png");
const screenshotPublished = path.join(proofDir, "presentation-dashboard-published.png");
const screenshotShared = path.join(proofDir, "presentation-dashboard-shared.png");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const allocatePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate port")));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });

const requestJson = (port, targetPath, { method = "GET", headers = {}, body } = {}) =>
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
          let parsed = null;
          try {
            parsed = text.length > 0 ? JSON.parse(text) : null;
          } catch {
            parsed = { raw: text };
          }
          resolve({ status: response.statusCode ?? 0, payload: parsed });
        });
      }
    );
    request.setTimeout(180000, () => request.destroy(new Error(`timeout ${method} ${targetPath}`)));
    request.on("error", reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });

const waitForServer = async (port) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await requestJson(port, "/login");
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {}
    await wait(250);
  }
  throw new Error("dashboard web server did not start");
};

const latestBy = (items, predicate) => [...items].reverse().find(predicate) ?? null;
const requireStatus = (response, expected, label) => {
  if (response.status !== expected) {
    throw new Error(`${label} failed: expected ${expected}, got ${response.status} payload=${JSON.stringify(response.payload)}`);
  }
};

const authHeaders = (token, tenantRef, actorRef) => ({
  authorization: `Bearer ${token}`,
  "x-tenant-ref": tenantRef,
  "x-actor-ref": actorRef
});

const login = async (port, tenantRef, workspaceId, projectId, actorRef) => {
  const response = await requestJson(port, "/api/v1/governance/auth/login", {
    method: "POST",
    body: {
      email: "admin",
      password: "1500",
      tenant_ref: tenantRef,
      workspace_id: workspaceId,
      project_id: projectId,
      actor_ref: actorRef
    }
  });
  requireStatus(response, 200, `login:${actorRef}`);
  return response.payload.data.accessToken;
};

const approveBoundary = async (api, approvalId, label) => {
  const review = await api(`/api/v1/governance/approvals/${encodeURIComponent(approvalId)}/review`, "POST", {
    note: `${label} review`
  });
  const approve = await api(`/api/v1/governance/approvals/${encodeURIComponent(approvalId)}/approve`, "POST", {
    note: `${label} approve`
  });
  requireStatus(review, 200, `${label} review`);
  requireStatus(approve, 200, `${label} approve`);
};

const { ReportEngine } = await import(pathToFileURL(path.join(root, "packages", "report-engine", "dist", "index.js")).href);

const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const suffix = Date.now();
const tenantRef = `tenant-governance-report-presentation-${suffix}`;
const workspaceId = `workspace-governance-report-presentation-${suffix}`;
const projectId = `project-governance-report-presentation-${suffix}`;
const reportStorageDir = path.join(root, ".runtime", "report-engine");
const reportId = `report-governance-presentation-${suffix}`;

ensureDir(proofDir);

const reportEngine = new ReportEngine({ storageDir: reportStorageDir });
const reportWorkflow = reportEngine.createReport({
  report_id: reportId,
  tenant_ref: tenantRef,
  workspace_id: workspaceId,
  project_id: projectId,
  created_by: "governance-cross-engine-report-presentation",
  title: "Governed Report To Presentation Flow",
  description: "Fresh report artifact for governed report -> presentation -> dashboard proof.",
  mode: "advanced",
  sections: [
    {
      section_kind: "executive_summary",
      title: "Executive Summary",
      blocks: [
        {
          block_type: "metric_card",
          title: "Revenue",
          body: "Revenue reached 1250 SAR in the governed reporting window.",
          metric_value: 1250,
          caption: "Primary KPI that must survive presentation conversion."
        },
        {
          block_type: "narrative",
          title: "Narrative",
          body: "The presentation bridge should preserve narrative context and downstream governance."
        }
      ]
    },
    {
      section_kind: "body",
      title: "Regional Detail",
      blocks: [
        {
          block_type: "table",
          title: "Regional Table",
          body: "Regional operations table.",
          table_rows: [
            ["Region", "Revenue", "Status"],
            ["Riyadh", "1250", "Green"],
            ["Jeddah", "980", "Amber"]
          ]
        }
      ]
    }
  ]
});

const server = spawn("node", ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: root,
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_PORT: String(port),
    RASID_DASHBOARD_TRANSPORT_PORT: String(transportPort)
  },
  stdio: [
    "ignore",
    fs.openSync(serverOutFile, "a"),
    fs.openSync(serverErrFile, "a")
  ]
});

let browser = null;

try {
  await waitForServer(port);

  const adminToken = await login(port, tenantRef, workspaceId, projectId, "admin");
  const viewerToken = await login(port, tenantRef, workspaceId, projectId, "viewer.actor");
  const editorToken = await login(port, tenantRef, workspaceId, projectId, "editor.actor");

  const apiFor = (token, actorRef) => async (endpoint, method = "GET", body = undefined) =>
    requestJson(port, endpoint, {
      method,
      headers: authHeaders(token, tenantRef, actorRef),
      body
    });

  const adminApi = apiFor(adminToken, "admin");
  const viewerApi = apiFor(viewerToken, "viewer.actor");
  const editorApi = apiFor(editorToken, "editor.actor");

  await adminApi("/api/v1/governance/assignments", "POST", {
    principal_ref: "viewer.actor",
    role_id: "viewer",
    workspace_id: workspaceId
  });
  await adminApi("/api/v1/governance/assignments", "POST", {
    principal_ref: "editor.actor",
    role_id: "editor",
    workspace_id: workspaceId
  });
  const approvalPolicy = await adminApi("/api/v1/governance/policies", "POST", {
    policy_id: "policy-report-presentation-approval",
    name: "Report presentation conversion requires approval",
    action_ids: ["governance.external.consume.v1"],
    effect: "require_approval",
    conditions: {
      tenant_ref: tenantRef,
      resource_kind: "presentation"
    },
    reason_template: "Presentation bridging requires approval."
  });
  const editorDenyPolicy = await adminApi("/api/v1/governance/policies", "POST", {
    policy_id: "policy-editor-deny-report-presentation",
    name: "Editor denied on report/presentation bridge",
    action_ids: ["governance.external.consume.v1"],
    effect: "deny",
    conditions: {
      tenant_ref: tenantRef,
      owner_ref: "editor.actor"
    },
    reason_template: "Editor bridge mutation is denied."
  });

  const reportPresentationBoundary = await adminApi("/api/v1/reports/convert-to-presentation", "POST", {
    report_id: reportId
  });
  requireStatus(reportPresentationBoundary, 202, "report->presentation boundary");
  const reportApprovalId = reportPresentationBoundary.payload?.governance?.approval;
  if (!reportApprovalId) {
    throw new Error("report->presentation boundary missing approval id");
  }
  await approveBoundary(adminApi, reportApprovalId, "report->presentation");
  const reportPresentationApproved = await adminApi("/api/v1/reports/convert-to-presentation", "POST", {
    report_id: reportId,
    approval_granted: true
  });
  requireStatus(reportPresentationApproved, 200, "report->presentation approved");
  const deckId = reportPresentationApproved.payload?.deck_id;
  if (!deckId) {
    throw new Error("report->presentation approved response missing deck_id");
  }

  const presentationDashboardBoundary = await adminApi("/api/v1/presentations/convert-to-dashboard", "POST", {
    deck_id: deckId
  });
  requireStatus(presentationDashboardBoundary, 202, "presentation->dashboard boundary");
  const deckApprovalId = presentationDashboardBoundary.payload?.governance?.approval;
  if (!deckApprovalId) {
    throw new Error("presentation->dashboard boundary missing approval id");
  }
  await approveBoundary(adminApi, deckApprovalId, "presentation->dashboard");
  const presentationDashboardApproved = await adminApi("/api/v1/presentations/convert-to-dashboard", "POST", {
    deck_id: deckId,
    approval_granted: true
  });
  requireStatus(presentationDashboardApproved, 200, "presentation->dashboard approved");
  const dashboardId = presentationDashboardApproved.payload?.presentation_bridge?.dashboard_id;
  if (!dashboardId) {
    throw new Error("presentation->dashboard approved response missing dashboard_id");
  }

  const publishBoundary = await adminApi("/api/v1/dashboards/publish", "POST", { dashboard_id: dashboardId });
  requireStatus(publishBoundary, 202, "publish boundary");
  await approveBoundary(adminApi, publishBoundary.payload?.governance?.approval, "publish");
  const publishApproved = await adminApi("/api/v1/dashboards/publish", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  requireStatus(publishApproved, 200, "publish approved");

  const shareBoundary = await adminApi("/api/v1/dashboards/share", "POST", { dashboard_id: dashboardId });
  requireStatus(shareBoundary, 202, "share boundary");
  await approveBoundary(adminApi, shareBoundary.payload?.governance?.approval, "share");
  const shareApproved = await adminApi("/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  requireStatus(shareApproved, 200, "share approved");

  const dashboardGovernance = await adminApi(`/api/v1/dashboards/governance?dashboard_id=${encodeURIComponent(dashboardId)}`);
  const widgetRef = dashboardGovernance.payload?.policy_checks?.[0]?.widget_ref ?? `widget-${dashboardId}-0`;
  const exportApproved = await adminApi("/api/v1/dashboards/export-widget-target", "POST", {
    dashboard_id: dashboardId,
    widget_ref: widgetRef,
    target_kind: "live_external"
  });
  requireStatus(exportApproved, 200, "export approved");

  const lineageBefore = await adminApi("/api/v1/governance/lineage");
  const viewerReportDenied = await viewerApi("/api/v1/reports/convert-to-presentation", "POST", {
    report_id: reportId
  });
  const viewerPresentationDenied = await viewerApi("/api/v1/presentations/convert-to-dashboard", "POST", {
    deck_id: deckId
  });
  const editorReportDenied = await editorApi("/api/v1/reports/convert-to-presentation", "POST", {
    report_id: reportId
  });
  const editorPresentationDenied = await editorApi("/api/v1/presentations/convert-to-dashboard", "POST", {
    deck_id: deckId
  });
  const lineageAfter = await adminApi("/api/v1/governance/lineage");

  browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.addCookies([
    { name: "rasid_access_token", value: adminToken, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant_ref", value: tenantRef, domain: "127.0.0.1", path: "/" },
    { name: "rasid_workspace", value: workspaceId, domain: "127.0.0.1", path: "/" },
    { name: "rasid_project", value: projectId, domain: "127.0.0.1", path: "/" },
    { name: "rasid_actor", value: "admin", domain: "127.0.0.1", path: "/" }
  ]);

  const boundaryPage = await context.newPage();
  await boundaryPage.goto(`${baseUrl}/reports?report_id=${encodeURIComponent(reportId)}`, { waitUntil: "networkidle" });
  await boundaryPage.screenshot({ path: screenshotBoundary, fullPage: true });
  await boundaryPage.close();

  const presentationPage = await context.newPage();
  await presentationPage.goto(`${baseUrl}${reportPresentationApproved.payload.open_path}`, { waitUntil: "networkidle" });
  await presentationPage.screenshot({ path: screenshotPresentation, fullPage: true });
  await presentationPage.close();

  const dashboardPage = await context.newPage();
  await dashboardPage.goto(`${baseUrl}${presentationDashboardApproved.payload.open_path}`, { waitUntil: "networkidle" });
  await dashboardPage.screenshot({ path: screenshotDashboard, fullPage: true });
  await dashboardPage.close();

  const publishedPage = await context.newPage();
  const publishedUrl = publishApproved.payload?.transport?.served_embed_html_url;
  if (!publishedUrl) {
    throw new Error("publish approved response missing served embed url");
  }
  await publishedPage.goto(publishedUrl, { waitUntil: "networkidle" });
  await publishedPage.screenshot({ path: screenshotPublished, fullPage: true });
  await publishedPage.close();

  const sharedPage = await context.newPage();
  const sharedUrl = shareApproved.payload?.transport?.served_embed_html_url;
  if (!sharedUrl) {
    throw new Error("share approved response missing served embed url");
  }
  await sharedPage.goto(sharedUrl, { waitUntil: "networkidle" });
  await sharedPage.screenshot({ path: screenshotShared, fullPage: true });
  await sharedPage.close();

  await browser.close();
  browser = null;

  const approvals = await adminApi("/api/v1/governance/approvals");
  const audit = await adminApi("/api/v1/governance/audit");
  const lineage = lineageAfter;
  const reportApproval = latestBy(
    approvals.payload?.approvals ?? [],
    (entry) => entry.action_id === "governance.external.consume.v1" && entry.resource_ref === reportId
  );
  const deckApproval = latestBy(
    approvals.payload?.approvals ?? [],
    (entry) => entry.action_id === "governance.external.consume.v1" && entry.resource_ref === deckId
  );
  const reportBoundaryAudit = latestBy(
    audit.payload?.audit ?? [],
    (entry) =>
      entry.action_id === "governance.external.consume.v1" &&
      entry.target_ref === reportId &&
      entry.metadata?.result_status === "approval_required"
  );
  const reportApprovedAudit = latestBy(
    audit.payload?.audit ?? [],
    (entry) =>
      entry.action_id === "governance.external.consume.v1" &&
      entry.target_ref === reportId &&
      entry.metadata?.result_status === "succeeded"
  );
  const deckBoundaryAudit = latestBy(
    audit.payload?.audit ?? [],
    (entry) =>
      entry.action_id === "governance.external.consume.v1" &&
      entry.target_ref === deckId &&
      entry.metadata?.result_status === "approval_required"
  );
  const deckApprovedAudit = latestBy(
    audit.payload?.audit ?? [],
    (entry) =>
      entry.action_id === "governance.external.consume.v1" &&
      entry.target_ref === deckId &&
      entry.metadata?.result_status === "succeeded"
  );
  const publishAudit = latestBy(
    audit.payload?.audit ?? [],
    (entry) => entry.action_id === "dashboard.publish.v1" && entry.target_ref === dashboardId && entry.metadata?.result_status === "succeeded"
  );
  const shareAudit = latestBy(
    audit.payload?.audit ?? [],
    (entry) =>
      entry.action_id === "governance.publication.share.v1" &&
      entry.target_ref === dashboardId &&
      entry.metadata?.result_status === "succeeded"
  );
  const deniedAudits = (audit.payload?.audit ?? []).filter(
    (entry) =>
      entry.action_id === "governance.external.consume.v1" &&
      entry.metadata?.result_status === "denied" &&
      [reportId, deckId].includes(entry.target_ref)
  );

  const allowedReportLineage = latestBy(
    lineage.payload?.lineage ?? [],
    (entry) => entry.action_ref === "governance.external.consume.v1" && entry.from_ref === reportId
  );
  const allowedPresentationLineage = latestBy(
    lineage.payload?.lineage ?? [],
    (entry) => entry.action_ref === "governance.external.consume.v1" && entry.from_ref === deckId
  );

  const proof = {
    created_at: new Date().toISOString(),
    phase_requirement: "governance coverage across all shared paths",
    base_url: baseUrl,
    tenant_ref: tenantRef,
    report_id: reportId,
    report_workflow: {
      report_id: reportWorkflow.report.report_id,
      version_ref: reportWorkflow.version.version_ref,
      state_path: path.join(reportStorageDir, "reports", reportId, "state", "current.json")
    },
    routes: {
      report_to_presentation: "/api/v1/reports/convert-to-presentation",
      presentation_to_dashboard: "/api/v1/presentations/convert-to-dashboard",
      dashboard_publish: "/api/v1/dashboards/publish",
      dashboard_share: "/api/v1/dashboards/share",
      dashboard_export: "/api/v1/dashboards/export-widget-target"
    },
    policies: {
      approval_policy_id: approvalPolicy.payload?.policy?.policy_id ?? null,
      editor_deny_policy_id: editorDenyPolicy.payload?.policy?.policy_id ?? null
    },
    report_to_presentation: {
      boundary: reportPresentationBoundary,
      approval: reportApproval,
      approved: reportPresentationApproved.payload
    },
    presentation_to_dashboard: {
      boundary: presentationDashboardBoundary,
      approval: deckApproval,
      approved: presentationDashboardApproved.payload
    },
    publish: {
      boundary: publishBoundary.payload,
      approved: publishApproved.payload
    },
    share: {
      boundary: shareBoundary.payload,
      approved: shareApproved.payload
    },
    export: exportApproved.payload,
    unauthorized: {
      viewer_report_to_presentation: viewerReportDenied,
      viewer_presentation_to_dashboard: viewerPresentationDenied,
      editor_report_to_presentation: editorReportDenied,
      editor_presentation_to_dashboard: editorPresentationDenied
    },
    lineage: {
      before_denied_count: lineageBefore.payload?.lineage?.length ?? 0,
      after_denied_count: lineageAfter.payload?.lineage?.length ?? 0,
      report_allowed: allowedReportLineage,
      presentation_allowed: allowedPresentationLineage
    },
    audit: {
      report_boundary: reportBoundaryAudit,
      report_approved: reportApprovedAudit,
      deck_boundary: deckBoundaryAudit,
      deck_approved: deckApprovedAudit,
      publish: publishAudit,
      share: shareAudit,
      denied: deniedAudits.slice(-8)
    },
    screenshots: {
      boundary: screenshotBoundary,
      presentation: screenshotPresentation,
      dashboard: screenshotDashboard,
      published: screenshotPublished,
      shared: screenshotShared
    }
  };

  if (proof.report_to_presentation.boundary.payload?.error !== "approval_required") {
    throw new Error(`report->presentation boundary did not require approval: ${JSON.stringify(proof.report_to_presentation.boundary)}`);
  }
  if (proof.presentation_to_dashboard.boundary.payload?.error !== "approval_required") {
    throw new Error(`presentation->dashboard boundary did not require approval: ${JSON.stringify(proof.presentation_to_dashboard.boundary)}`);
  }
  for (const [label, denied] of Object.entries(proof.unauthorized)) {
    if (denied.status !== 403 || denied.payload?.error !== "governance_denied") {
      throw new Error(`${label} did not deny before execute: ${JSON.stringify(denied)}`);
    }
  }
  if (proof.lineage.before_denied_count !== proof.lineage.after_denied_count) {
    throw new Error(`denied probes emitted lineage: ${proof.lineage.before_denied_count} -> ${proof.lineage.after_denied_count}`);
  }

  writeJson(detailedProofFile, proof);
  writeJson(proofFile, proof);
  console.log(JSON.stringify(proof, null, 2));
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  if (server.exitCode === null && !server.killed) {
    if (process.platform === "win32") {
      server.kill();
      try {
        spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {}
    } else {
      server.kill("SIGTERM");
    }
  }
}
