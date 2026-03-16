import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { chromium } from "playwright-core";

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
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const proofRoot = path.join(process.cwd(), ".runtime", "governance-hostile-proof");
const proofFile = path.join(proofRoot, "governance-hostile-revalidation.json");
const screenshotFile = path.join(proofRoot, "governance-hostile-revalidation.png");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // retry
    }
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
const tenantRef = `tenant-governance-hostile-${runId}`;
const workspaceId = `workspace-governance-hostile-${runId}`;
const projectId = `project-governance-hostile-${runId}`;

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
  let proof = null;

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
    return { status: response.status, payload, token: payload.data.accessToken };
  };

  const adminLogin = await login("admin");
  const viewerLogin = await login("viewer.actor");
  const editorLogin = await login("editor.actor");

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
  const waitForApprovalStatus = async (resourceRef, status, actionId) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const approvals = await api(adminLogin.token, "admin", "/api/v1/governance/approvals");
      const match = [...(approvals.payload.approvals ?? [])]
        .reverse()
        .find((entry) => entry.resource_ref === resourceRef && entry.status === status && (!actionId || entry.action_id === actionId));
      if (match) {
        return match;
      }
      await wait(300);
    }
    throw new Error(`approval status not reached:${resourceRef}:${status}`);
  };

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.fill("#tenant", tenantRef);
  await page.fill("#workspace", workspaceId);
  await page.fill("#project", projectId);
  await page.fill("#actor", "admin");
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(`${baseUrl}/data`);
  await page.goto(`${baseUrl}/governance`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Upsert Role" }).click();
  await page.waitForFunction(() => document.querySelector("#role-result")?.textContent?.includes('"role_id": "sector-analyst"'));
  await page.getByRole("button", { name: "Assign Role" }).click();
  await page.waitForFunction(() => document.querySelector("#assignment-result")?.textContent?.includes('"principal_ref": "sector.lead"'));
  await page.getByRole("button", { name: "Upsert Policy" }).click();
  await page.waitForFunction(() => document.querySelector("#policy-result")?.textContent?.includes('"policy_id": "policy-sector-publish"'));
  await page.getByRole("button", { name: "Request KPI Upsert" }).click();
  await page.waitForFunction(() => document.querySelector("#kpi-result")?.textContent?.includes('"approval_required"'));
  await page.getByRole("button", { name: "Review + Approve Latest" }).click();
  const approvedKpi = await waitForApprovalStatus("kpi-sector-revenue", "approved", "governance.kpi.upsert.v1");
  await page.getByRole("button", { name: "Finalize KPI" }).click();
  await page.waitForFunction(() => document.querySelector("#kpi-result")?.textContent?.includes('"kpi_id": "kpi-sector-revenue"'));
  await page.getByRole("button", { name: "Register Governed Dataset" }).click();
  await page.waitForFunction(() => Boolean(document.querySelector("#dataset-id")?.value));
  const datasetId = await page.locator("#dataset-id").inputValue();
  await page.getByRole("button", { name: "Create Dashboard" }).click();
  await page.waitForFunction(() => Boolean(document.querySelector("#dashboard-id")?.value));
  const dashboardId = await page.locator("#dashboard-id").inputValue();
  await page.getByRole("button", { name: "Request Publish" }).click();
  await page.waitForFunction(() => document.querySelector("#publish-result")?.textContent?.includes('"approval"'));
  const pendingPublish = await waitForApprovalStatus(dashboardId, "pending", "dashboard.publish.v1");
  await api(adminLogin.token, "admin", `/api/v1/governance/approvals/${encodeURIComponent(pendingPublish.approval_id)}/review`, "POST", { note: "hostile-review-publish" });
  await api(adminLogin.token, "admin", `/api/v1/governance/approvals/${encodeURIComponent(pendingPublish.approval_id)}/approve`, "POST", { note: "hostile-approve-publish" });
  const approvedPublish = await waitForApprovalStatus(dashboardId, "approved", "dashboard.publish.v1");
  const finalizedPublish = await api(adminLogin.token, "admin", "/api/v1/dashboards/publish", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  await page.getByRole("button", { name: "Request Share" }).click();
  await page.waitForFunction(() => document.querySelector("#publish-result")?.textContent?.includes('"approval"'));
  const pendingShare = await waitForApprovalStatus(dashboardId, "pending", "governance.publication.share.v1");
  await api(adminLogin.token, "admin", `/api/v1/governance/approvals/${encodeURIComponent(pendingShare.approval_id)}/review`, "POST", { note: "hostile-review-share" });
  await api(adminLogin.token, "admin", `/api/v1/governance/approvals/${encodeURIComponent(pendingShare.approval_id)}/approve`, "POST", { note: "hostile-approve-share" });
  const approvedShare = await waitForApprovalStatus(dashboardId, "approved", "governance.publication.share.v1");
  const finalizedShare = await api(adminLogin.token, "admin", "/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  await page.getByRole("button", { name: "Request Schedule" }).click();
  await page.waitForFunction(() => document.querySelector("#publish-result")?.textContent?.includes('"approval"'));
  const pendingSchedule = await waitForApprovalStatus(dashboardId, "pending", "governance.publication.schedule.v1");
  await api(adminLogin.token, "admin", `/api/v1/governance/approvals/${encodeURIComponent(pendingSchedule.approval_id)}/review`, "POST", { note: "hostile-review-schedule" });
  await api(adminLogin.token, "admin", `/api/v1/governance/approvals/${encodeURIComponent(pendingSchedule.approval_id)}/approve`, "POST", { note: "hostile-approve-schedule" });
  const approvedSchedule = await waitForApprovalStatus(dashboardId, "approved", "governance.publication.schedule.v1");
  const finalizedSchedule = await api(adminLogin.token, "admin", "/api/v1/dashboards/schedule", "POST", {
    dashboard_id: dashboardId,
    approval_granted: true
  });
  await page.screenshot({ path: screenshotFile, fullPage: true });
  await browser.close();

  await api(adminLogin.token, "admin", "/api/v1/governance/assignments", "POST", {
    principal_ref: "editor.actor",
    role_id: "editor"
  });
  const lineagesBeforeDenied = await api(adminLogin.token, "admin", "/api/v1/governance/lineage");
  const publishWithoutApproval = await api(adminLogin.token, "admin", "/api/v1/dashboards/publish", "POST", {
    dashboard_id: dashboardId
  });
  const shareWithoutApproval = await api(adminLogin.token, "admin", "/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId
  });
  const scheduleWithoutApproval = await api(adminLogin.token, "admin", "/api/v1/dashboards/schedule", "POST", {
    dashboard_id: dashboardId
  });
  const viewerPublish = await api(viewerLogin.token, "viewer.actor", "/api/v1/dashboards/publish", "POST", {
    dashboard_id: dashboardId
  });
  const viewerShare = await api(viewerLogin.token, "viewer.actor", "/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId
  });
  const editorPublish = await api(editorLogin.token, "editor.actor", "/api/v1/dashboards/publish", "POST", {
    dashboard_id: dashboardId
  });
  const editorShare = await api(editorLogin.token, "editor.actor", "/api/v1/dashboards/share", "POST", {
    dashboard_id: dashboardId
  });
  const viewerEvidence = await api(viewerLogin.token, "viewer.actor", "/api/v1/governance/evidence/create", "POST", {
    action_id: "governance.manual.evidence.v1",
    resource_ref: dashboardId
  });
  const viewerStrict = await api(viewerLogin.token, "viewer.actor", "/api/v1/replication/consume-dashboard-output", "POST", {});
  const lineagesAfterDenied = await api(adminLogin.token, "admin", "/api/v1/governance/lineage");
  const unauthorizedMatrix = await api(adminLogin.token, "admin", "/api/v1/governance/audit");
  const state = await api(adminLogin.token, "admin", "/api/v1/governance/state");
  const writePaths = await api(adminLogin.token, "admin", "/api/v1/governance/write-paths");

  const latestAudits = unauthorizedMatrix.payload.audit ?? [];
  const publishBoundaryAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "dashboard.publish.v1" && entry.metadata?.result_status === "approval_required");
  const scheduleBoundaryAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "governance.publication.schedule.v1" && entry.metadata?.result_status === "approval_required");
  const shareBoundaryAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "governance.publication.share.v1" && entry.metadata?.result_status === "approval_required");
  const kpiApprovedAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "governance.kpi.upsert.v1" && entry.target_ref === "kpi-sector-revenue" && entry.result_status === "success");
  const publishApprovedAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "dashboard.publish.v1" && entry.target_ref === dashboardId && entry.result_status === "success");
  const scheduleApprovedAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "governance.publication.schedule.v1" && entry.target_ref === dashboardId && entry.result_status === "success");
  const shareApprovedAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.action_ref === "governance.publication.share.v1" && entry.target_ref === dashboardId && entry.result_status === "success");
  const viewerEvidenceAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.target_ref === dashboardId && entry.action_ref === "governance.library.upsert.v1" && entry.metadata?.actor === "viewer.actor");
  const editorPublishAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.target_ref === dashboardId && entry.action_ref === "dashboard.publish.v1" && entry.actor_ref === "editor.actor" && entry.result_status === "failed");
  const editorShareAudit = [...latestAudits]
    .reverse()
    .find((entry) => entry.target_ref === dashboardId && entry.action_ref === "governance.publication.share.v1" && entry.actor_ref === "editor.actor" && entry.result_status === "failed");
  const governedWriteRoutes = (writePaths.payload.write_paths ?? []).map((entry) => entry.route);
  const boundaryCoverage = {
    publish: governedWriteRoutes.includes("/api/v1/dashboards/publish"),
    schedule: governedWriteRoutes.includes("/api/v1/dashboards/schedule"),
    export: governedWriteRoutes.includes("/api/v1/dashboards/export-widget-target"),
    share: governedWriteRoutes.some((route) => /\/share($|\/)/.test(route))
  };
  const contradictions = [];
  if (!boundaryCoverage.publish) contradictions.push("publish_boundary_missing");
  if (!boundaryCoverage.schedule) contradictions.push("schedule_boundary_missing");
  if (!boundaryCoverage.export) contradictions.push("export_boundary_missing");
  if (!boundaryCoverage.share) contradictions.push("share_boundary_missing");
  if ((lineagesAfterDenied.payload.lineage ?? []).length !== (lineagesBeforeDenied.payload.lineage ?? []).length) {
    contradictions.push("denied_probes_emitted_lineage");
  }

  proof = {
    created_at: new Date().toISOString(),
    base_url: baseUrl,
    screenshot: screenshotFile,
    tenant_ref: tenantRef,
    dataset_id: datasetId,
    dashboard_id: dashboardId,
    kpi_id: "kpi-sector-revenue",
    governed_write_path_count: (writePaths.payload.write_paths ?? []).length,
    boundary_coverage: boundaryCoverage,
    contradictions,
    approvals: {
      kpi: approvedKpi,
      publish: approvedPublish,
      share: approvedShare,
      schedule: approvedSchedule
    },
    finalized: {
      publish_status: finalizedPublish.status,
      publish_publication_id: finalizedPublish.payload.publication?.publication_id ?? null,
      share_status: finalizedShare.status,
      share_publication_id: finalizedShare.payload.publication?.publication_id ?? null,
      schedule_status: finalizedSchedule.status,
      schedule_id: finalizedSchedule.payload.schedule?.schedule_id ?? null
    },
    publish_without_approval: {
      status: publishWithoutApproval.status,
      error: publishWithoutApproval.payload.error ?? null,
      governance: publishWithoutApproval.payload.governance ?? null,
      approval: publishWithoutApproval.payload.approval ?? null
    },
    share_without_approval: {
      status: shareWithoutApproval.status,
      error: shareWithoutApproval.payload.error ?? null,
      governance: shareWithoutApproval.payload.governance ?? null,
      approval: shareWithoutApproval.payload.approval ?? null
    },
    schedule_without_approval: {
      status: scheduleWithoutApproval.status,
      error: scheduleWithoutApproval.payload.error ?? null,
      governance: scheduleWithoutApproval.payload.governance ?? null,
      approval: scheduleWithoutApproval.payload.approval ?? null
    },
    viewer_publish: {
      status: viewerPublish.status,
      error: viewerPublish.payload.error ?? null,
      governance: viewerPublish.payload.governance ?? null
    },
    viewer_share: {
      status: viewerShare.status,
      error: viewerShare.payload.error ?? null,
      governance: viewerShare.payload.governance ?? null
    },
    editor_publish: {
      status: editorPublish.status,
      error: editorPublish.payload.error ?? null,
      governance: editorPublish.payload.governance ?? null
    },
    editor_share: {
      status: editorShare.status,
      error: editorShare.payload.error ?? null,
      governance: editorShare.payload.governance ?? null
    },
    viewer_evidence_create: {
      status: viewerEvidence.status,
      error: viewerEvidence.payload.error ?? null,
      governance: viewerEvidence.payload.governance ?? null
    },
    viewer_strict_route: {
      status: viewerStrict.status,
      error: viewerStrict.payload.error ?? null,
      governance: viewerStrict.payload.governance ?? null
    },
    boundary_audits: {
      kpi_approved: kpiApprovedAudit ?? null,
      publish: publishBoundaryAudit ?? null,
      publish_approved: publishApprovedAudit ?? null,
      share: shareBoundaryAudit ?? null,
      share_approved: shareApprovedAudit ?? null,
      schedule: scheduleBoundaryAudit ?? null,
      schedule_approved: scheduleApprovedAudit ?? null,
      viewer_evidence: viewerEvidenceAudit ?? null
    },
    denied_audits: {
      editor_publish: editorPublishAudit ?? null,
      editor_share: editorShareAudit ?? null,
      viewer_evidence: viewerEvidenceAudit ?? null
    },
    state_counts: {
      roles: (state.payload.roles ?? []).length,
      approvals: (state.payload.approvals ?? []).length,
      audits: (state.payload.audits ?? []).length,
      lineages: (state.payload.lineages ?? []).length
    },
    denied_lineage_check: {
      before_count: (lineagesBeforeDenied.payload.lineage ?? []).length,
      after_count: (lineagesAfterDenied.payload.lineage ?? []).length
    }
  };

  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");

  if (proof.governed_write_path_count < 40) throw new Error("governed write-path matrix regressed");
  if (publishWithoutApproval.status !== 202 || publishWithoutApproval.payload.error !== "approval_required") {
    throw new Error("publish approval boundary regressed");
  }
  if (scheduleWithoutApproval.status !== 202 || scheduleWithoutApproval.payload.error !== "approval_required") {
    throw new Error("schedule approval boundary regressed");
  }
  if (shareWithoutApproval.status !== 202 || shareWithoutApproval.payload.error !== "approval_required") {
    throw new Error("share approval boundary regressed");
  }
  if (finalizedPublish.status !== 200 || !finalizedPublish.payload.publication?.publication_id) {
    throw new Error("publish finalize regressed");
  }
  if (finalizedShare.status !== 200 || !finalizedShare.payload.publication?.publication_id) {
    throw new Error("share finalize regressed");
  }
  if (finalizedSchedule.status !== 200 || !finalizedSchedule.payload.schedule?.schedule_id) {
    throw new Error("schedule finalize regressed");
  }
  if (viewerPublish.status !== 403 || viewerPublish.payload.error !== "governance_denied") {
    throw new Error("viewer publish denial regressed");
  }
  if (viewerShare.status !== 403 || viewerShare.payload.error !== "governance_denied") {
    throw new Error("viewer share denial regressed");
  }
  if (editorPublish.status !== 403 || editorPublish.payload.error !== "governance_denied") {
    throw new Error("editor publish denial regressed");
  }
  if (editorShare.status !== 403 || editorShare.payload.error !== "governance_denied") {
    throw new Error("editor share denial regressed");
  }
  if (viewerEvidence.status !== 403 || viewerEvidence.payload.error !== "governance_denied") {
    throw new Error("viewer evidence denial regressed");
  }
  if (viewerStrict.status !== 403 || viewerStrict.payload.error !== "governance_denied") {
    throw new Error("viewer strict-route denial regressed");
  }
  if (!kpiApprovedAudit || !publishBoundaryAudit || !publishApprovedAudit || !shareBoundaryAudit || !shareApprovedAudit || !scheduleBoundaryAudit || !scheduleApprovedAudit || !viewerEvidenceAudit || !editorPublishAudit || !editorShareAudit) {
    throw new Error("hostile audit trail missing");
  }
  if (contradictions.length > 0) {
    throw new Error(contradictions.join(","));
  }
  console.log(JSON.stringify(proof, null, 2));
} finally {
  stopServer();
}
