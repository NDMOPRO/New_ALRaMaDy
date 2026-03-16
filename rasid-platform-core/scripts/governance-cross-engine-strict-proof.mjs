import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright-core";

const host = "127.0.0.1";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const token = createHash("sha256").update("rasid-dashboard-web").digest("hex");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const proofRoot = path.join(process.cwd(), ".runtime", "governance-cross-engine-proof");
const proofDir = path.join(proofRoot, `strict-platform-flow-${stamp}`);
const proofFile = path.join(proofRoot, "governance-cross-engine-strict-proof.json");
const detailedProofFile = path.join(proofDir, "proof.json");
const evidenceFile = path.join(proofDir, "evidence.json");
const auditFile = path.join(proofDir, "audit.json");
const lineageFile = path.join(proofDir, "lineage.json");
const serverOutFile = path.join(proofDir, "server-out.log");
const serverErrFile = path.join(proofDir, "server-err.log");
const screenshotBoundary = path.join(proofDir, "replication-boundary.png");
const screenshotConsumed = path.join(proofDir, "consumed-dashboard.png");
const screenshotPublished = path.join(proofDir, "published-served-embed.png");
const screenshotShared = path.join(proofDir, "shared-served-embed.png");
const screenshotExport = path.join(proofDir, "exported-widget-target.png");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const step = (message) => console.log(`[governance-cross-engine-strict] ${message}`);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

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
      const port = address.port;
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
      const result = await requestJson(port, "/login");
      if (result.status >= 200 && result.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error("dashboard web server did not start");
};

const authHeaders = (tenantRef, actorRef) => ({
  authorization: `Bearer ${token}`,
  "x-tenant-ref": tenantRef,
  "x-actor-ref": actorRef
});

const parseResultPanel = async (page) =>
  page.evaluate(() => {
    const raw = document.getElementById("result")?.textContent ?? "";
    return raw.length > 0 ? JSON.parse(raw) : null;
  });

const parseCanvasActionResult = async (page) =>
  page.evaluate(() => {
    const raw = document.getElementById("canvas-action-result")?.textContent ?? "";
    return raw.length > 0 ? JSON.parse(raw) : null;
  });

const latestBy = (items, predicate) => [...items].reverse().find(predicate) ?? null;

const requireStatus = (response, expected, label) => {
  if (response.status !== expected) {
    throw new Error(`${label} failed: expected ${expected}, got ${response.status} payload=${JSON.stringify(response.payload)}`);
  }
};

const approveBoundary = async (port, tenantRef, approvalId, note) => {
  const reviewResponse = await requestJson(port, `/api/v1/governance/approvals/${encodeURIComponent(approvalId)}/review`, {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { note: `${note} review` }
  });
  const approveResponse = await requestJson(port, `/api/v1/governance/approvals/${encodeURIComponent(approvalId)}/approve`, {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { note: `${note} approve` }
  });
  requireStatus(reviewResponse, 200, `${note} review`);
  requireStatus(approveResponse, 200, `${note} approve`);
  return { reviewResponse, approveResponse };
};

const publicationAssetPath = (transport, asset) => {
  if (asset === "manifest") return transport.served_manifest_url;
  if (asset === "state") return transport.served_publish_state_url;
  if (asset === "embed-payload") return transport.served_embed_payload_url;
  return transport.served_embed_html_url;
};

const port = await allocatePort();
const transportPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const tenantRef = `tenant-governance-cross-engine-${Date.now()}`;

ensureDir(proofDir);
const server = spawn("node", ["apps/contracts-cli/dist/index.js", "dashboard-serve-web"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    RASID_DASHBOARD_WEB_PORT: String(port),
    RASID_DASHBOARD_TRANSPORT_PORT: String(transportPort),
    RASID_DEBUG_STACKS: "1"
  },
  stdio: [
    "ignore",
    fs.openSync(serverOutFile, "a"),
    fs.openSync(serverErrFile, "a")
  ]
});

let browser;

try {
  await waitForServer(port);
  browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });

  step(`login ${baseUrl}/login`);
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin");
  await page.fill("#password", "1500");
  await page.fill("#tenant", tenantRef);
  await page.fill("#actor", "admin");
  await page.click("#login");
  await page.waitForURL(`${baseUrl}/data`);

  step("open /replication canvas surface and trigger approval boundary");
  await page.goto(`${baseUrl}/replication`, { waitUntil: "networkidle" });
  await page.click("#canvas-replication-to-dashboard");
  await page.waitForFunction(() => {
    const raw = document.getElementById("canvas-action-result")?.textContent ?? "";
    return raw.includes("\"approval_required\"") && raw.includes("\"approval\"");
  });
  const boundaryPayload = await parseCanvasActionResult(page);
  await page.screenshot({ path: screenshotBoundary, fullPage: true });
  if (boundaryPayload?.error !== "approval_required") {
    throw new Error(`strict boundary did not return approval_required: payload=${JSON.stringify(boundaryPayload)}`);
  }

  const pendingApprovalId = boundaryPayload?.governance?.approval ?? null;
  if (!pendingApprovalId) {
    throw new Error("strict boundary did not return approval id");
  }
  step("approve latest pending from the unified canvas");
  await page.click("#canvas-approve-latest");
  await page.waitForFunction(
    (approvalId) => {
      const raw = document.getElementById("canvas-action-result")?.textContent ?? "";
      return raw.includes(String(approvalId)) && raw.includes("\"status\": \"approved\"");
    },
    pendingApprovalId
  );
  const canvasApprovalPayload = await parseCanvasActionResult(page);
  if (canvasApprovalPayload?.approval?.status !== "approved") {
    throw new Error(`canvas approval did not finalize the strict boundary: ${JSON.stringify(canvasApprovalPayload)}`);
  }

  step("rerun strict route with approval_granted from the same live browser session");
  await page.check("#canvas-approval-granted");
  const approvedResponse = await page.evaluate(async () => {
    const response = await fetch("/api/v1/replication/consume-dashboard-output", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approval_granted: true })
    });
    return { status: response.status, payload: await response.json() };
  });
  const consumed = approvedResponse.payload?.strict_consume ?? null;
  const dashboardId = consumed?.dashboard_id ?? null;
  if (approvedResponse.status !== 200 || !dashboardId) {
    throw new Error(`strict approved execution failed: ${JSON.stringify(approvedResponse)}`);
  }
  await page.goto(`${baseUrl}${approvedResponse.payload.open_path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: screenshotConsumed, fullPage: true });

  for (const filePath of [
    consumed.consume_manifest_path,
    consumed.consume_evidence_path,
    consumed.consume_audit_path,
    consumed.consume_lineage_path
  ]) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`missing strict consume proof file: ${filePath}`);
    }
  }

  const consumeManifest = readJson(consumed.consume_manifest_path);
  const consumeEvidence = readJson(consumed.consume_evidence_path);
  const consumeAudit = readJson(consumed.consume_audit_path);
  const consumeLineage = readJson(consumed.consume_lineage_path);
  const consumedSnapshot = approvedResponse.payload.snapshot;

  if (consumeManifest.strict_run_id !== "real-live-dashboard-strict") {
    throw new Error(`strict consume manifest is not pinned to live strict run: ${consumeManifest.strict_run_id}`);
  }
  if (consumedSnapshot?.dashboard?.description?.includes(consumed.strict_run_id) !== true) {
    throw new Error("consumed dashboard description is not linked to the strict run id");
  }
  if (consumedSnapshot?.dashboard?.source_dataset_refs?.[0] !== consumed.dataset_id) {
    throw new Error("consumed dashboard did not keep the strict downstream dataset ref");
  }

  const publishBoundary = await requestJson(port, "/api/v1/dashboards/publish", {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { dashboard_id: dashboardId }
  });
  requireStatus(publishBoundary, 202, "publish boundary");
  await approveBoundary(port, tenantRef, publishBoundary.payload?.governance?.approval ?? "", "publish");
  const publishApproved = await requestJson(port, "/api/v1/dashboards/publish", {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { dashboard_id: dashboardId, approval_granted: true }
  });
  requireStatus(publishApproved, 200, "publish approved");
  const publishTransport = publishApproved.payload?.transport ?? null;
  if (!publishTransport?.served_embed_html_url) {
    throw new Error("publish transport missing served embed url");
  }
  await page.goto(publishTransport.served_embed_html_url, { waitUntil: "networkidle" });
  await page.screenshot({ path: screenshotPublished, fullPage: true });

  const shareBoundary = await requestJson(port, "/api/v1/dashboards/share", {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { dashboard_id: dashboardId }
  });
  requireStatus(shareBoundary, 202, "share boundary");
  await approveBoundary(port, tenantRef, shareBoundary.payload?.governance?.approval ?? "", "share");
  const shareApproved = await requestJson(port, "/api/v1/dashboards/share", {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { dashboard_id: dashboardId, approval_granted: true }
  });
  requireStatus(shareApproved, 200, "share approved");
  const shareTransport = shareApproved.payload?.transport ?? null;
  if (!shareTransport?.served_embed_html_url) {
    throw new Error("share transport missing served embed url");
  }
  await page.goto(shareTransport.served_embed_html_url, { waitUntil: "networkidle" });
  await page.screenshot({ path: screenshotShared, fullPage: true });

  const widgetRef = consumedSnapshot?.dashboard?.widgets?.[0]?.widget_id ?? null;
  if (!widgetRef) {
    throw new Error("consumed dashboard missing widget ref for export proof");
  }
  const exportApproved = await requestJson(port, "/api/v1/dashboards/export-widget-target", {
    method: "POST",
    headers: authHeaders(tenantRef, "admin"),
    body: { dashboard_id: dashboardId, widget_ref: widgetRef, target_kind: "live_external" }
  });
  requireStatus(exportApproved, 200, "export approved");
  const exportTransfer = exportApproved.payload?.transfer ?? null;
  const exportOpenPath = exportTransfer?.open_path ?? null;
  if (!exportOpenPath) {
    throw new Error("export transfer missing open_path");
  }
  await page.goto(exportOpenPath.startsWith("http") ? exportOpenPath : `${baseUrl}${exportOpenPath}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: screenshotExport, fullPage: true });

  step("probe unauthorized strict denial");
  const viewerDenied = await requestJson(port, "/api/v1/replication/consume-dashboard-output", {
    method: "POST",
    headers: authHeaders(tenantRef, "viewer.actor"),
    body: {}
  });
  const editorDenied = await requestJson(port, "/api/v1/replication/consume-dashboard-output", {
    method: "POST",
    headers: authHeaders(tenantRef, "editor.actor"),
    body: {}
  });
  if (viewerDenied.status !== 403 || viewerDenied.payload?.error !== "governance_denied") {
    throw new Error(`viewer strict denial failed: ${viewerDenied.status} ${JSON.stringify(viewerDenied.payload)}`);
  }
  if (editorDenied.status !== 403 || editorDenied.payload?.error !== "governance_denied") {
    throw new Error(`editor strict denial failed: ${editorDenied.status} ${JSON.stringify(editorDenied.payload)}`);
  }

  const approvals = await requestJson(port, "/api/v1/governance/approvals", { headers: authHeaders(tenantRef, "admin") });
  const audits = await requestJson(port, "/api/v1/governance/audit", { headers: authHeaders(tenantRef, "admin") });
  const lineages = await requestJson(port, "/api/v1/governance/lineage", { headers: authHeaders(tenantRef, "admin") });
  const dashboardGovernance = await requestJson(port, `/api/v1/dashboards/governance?dashboard_id=${encodeURIComponent(dashboardId)}`, {
    headers: authHeaders(tenantRef, "admin")
  });

  const strictBoundaryAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "governance.strict.execute.v1" && entry.metadata?.result_status === "approval_required"
  );
  const strictApprovedAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "governance.strict.execute.v1" && entry.result_status === "success"
  );
  const publishApprovedAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "dashboard.publish.v1" && entry.result_status === "success" && entry.target_ref === dashboardId
  );
  const shareApprovedAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "governance.publication.share.v1" && entry.result_status === "success" && entry.target_ref === dashboardId
  );
  const exportApprovedAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "governance.external.consume.v1" && entry.result_status === "success" && entry.target_ref === dashboardId
  );
  const viewerDeniedAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "governance.strict.execute.v1" && entry.actor_ref === "viewer.actor" && entry.result_status === "failed"
  );
  const editorDeniedAudit = latestBy(
    audits.payload?.audit ?? [],
    (entry) => entry.action_ref === "governance.strict.execute.v1" && entry.actor_ref === "editor.actor" && entry.result_status === "failed"
  );
  const strictExecutionEdge = latestBy(
    lineages.payload?.lineage ?? [],
    (entry) => entry.action_ref === "governance.strict.execute.v1" && entry.to_ref === dashboardId
  );
  const publishEdge = latestBy(
    lineages.payload?.lineage ?? [],
    (entry) => entry.action_ref === "dashboard.publish.v1" && entry.from_ref === dashboardId
  );
  const shareEdge = latestBy(
    lineages.payload?.lineage ?? [],
    (entry) => entry.action_ref === "governance.publication.share.v1" && entry.from_ref === dashboardId
  );
  const exportEdge = latestBy(
    lineages.payload?.lineage ?? [],
    (entry) => entry.action_ref === "governance.external.consume.v1" && entry.from_ref === dashboardId
  );
  const boundaryApproval = latestBy(
    approvals.payload?.approvals ?? [],
    (entry) => entry.approval_id === pendingApprovalId && entry.action_id === "governance.strict.execute.v1"
  );
  const publishApproval = latestBy(
    approvals.payload?.approvals ?? [],
    (entry) => entry.approval_id === publishBoundary.payload?.governance?.approval
  );
  const shareApproval = latestBy(
    approvals.payload?.approvals ?? [],
    (entry) => entry.approval_id === shareBoundary.payload?.governance?.approval
  );

  for (const ref of [strictBoundaryAudit, strictApprovedAudit, publishApprovedAudit, shareApprovedAudit, exportApprovedAudit, viewerDeniedAudit, editorDeniedAudit]) {
    if (!ref?.event_id) {
      throw new Error("missing required governance audit ref on strict platform flow");
    }
  }
  for (const ref of [strictExecutionEdge, publishEdge, shareEdge, exportEdge]) {
    if (!ref?.edge_id) {
      throw new Error("missing required lineage ref on strict platform flow");
    }
  }

  const evidence = {
    strict_consume: {
      dashboard_id: dashboardId,
      dataset_id: consumed.dataset_id,
      strict_run_id: consumed.strict_run_id,
      strict_run_root: consumed.strict_run_root,
      manifest_path: consumed.consume_manifest_path,
      evidence_path: consumed.consume_evidence_path,
      audit_path: consumed.consume_audit_path,
      lineage_path: consumed.consume_lineage_path,
      manifest: consumeManifest,
      evidence: consumeEvidence,
      audit: consumeAudit,
      lineage: consumeLineage,
      dashboard_description: consumedSnapshot?.dashboard?.description ?? null,
      dashboard_source_dataset_ref: consumedSnapshot?.dashboard?.source_dataset_refs?.[0] ?? null,
      governance_surface: dashboardGovernance.payload ?? null
    },
    continuation: {
      publish: {
        publication_id: publishApproved.payload?.publication?.publication_id ?? null,
        transport: publishTransport,
        served_manifest_url: publicationAssetPath(publishTransport, "manifest"),
        served_state_url: publicationAssetPath(publishTransport, "state"),
        served_embed_url: publicationAssetPath(publishTransport, "embed")
      },
      share: {
        publication_id: shareApproved.payload?.publication?.publication_id ?? null,
        transport: shareTransport,
        served_manifest_url: publicationAssetPath(shareTransport, "manifest"),
        served_state_url: publicationAssetPath(shareTransport, "state"),
        served_embed_url: publicationAssetPath(shareTransport, "embed")
      },
      export: {
        transfer_id: exportTransfer.transfer_id,
        open_path: exportTransfer.open_path,
        evidence_path: exportTransfer.evidence_path,
        audit_path: exportTransfer.audit_path,
        lineage_path: exportTransfer.lineage_path
      }
    },
    screenshots: {
      boundary: screenshotBoundary,
      consumed: screenshotConsumed,
      published: screenshotPublished,
      shared: screenshotShared,
      export: screenshotExport
    }
  };

  const audit = {
    strict_boundary_audit: strictBoundaryAudit.event_id,
    strict_approved_audit: strictApprovedAudit.event_id,
    publish_approved_audit: publishApprovedAudit.event_id,
    share_approved_audit: shareApprovedAudit.event_id,
    export_approved_audit: exportApprovedAudit.event_id,
    viewer_denied_audit: viewerDeniedAudit.event_id,
    editor_denied_audit: editorDeniedAudit.event_id,
    strict_consume_audit_file: consumed.consume_audit_path
  };

  const lineage = {
    strict_execution_edge: strictExecutionEdge.edge_id,
    publish_edge: publishEdge.edge_id,
    share_edge: shareEdge.edge_id,
    export_edge: exportEdge.edge_id,
    strict_consume_lineage_file: consumed.consume_lineage_path,
    strict_source_refs: consumed.source_refs
  };

  const proof = {
    created_at: new Date().toISOString(),
    base_url: baseUrl,
    proof_root: proofDir,
    real_runtime_path: {
      login: `${baseUrl}/login`,
      replication: `${baseUrl}/replication`,
      shell_replication_entry: `${baseUrl}/replication`,
      approved_dashboard: `${baseUrl}${approvedResponse.payload.open_path}`,
      publish_route: "/api/v1/dashboards/publish",
      share_route: "/api/v1/dashboards/share",
      export_route: "/api/v1/dashboards/export-widget-target"
    },
    strict_route: "/api/v1/replication/consume-dashboard-output",
    boundary: {
      status: 202,
      error: boundaryPayload?.error ?? null,
      approval_id: pendingApprovalId,
      workflow_id: boundaryApproval?.workflow_id ?? null,
      boundary_label: boundaryApproval?.boundary_label ?? null
    },
    approved_mutation: {
      status: approvedResponse.status,
      open_path: approvedResponse.payload?.open_path ?? null,
      dashboard_id: dashboardId,
      dashboard_title: consumedSnapshot?.dashboard?.title ?? null,
      dashboard_description: consumedSnapshot?.dashboard?.description ?? null,
      consume_proof: consumed,
      strict_consume_evidence: consumeEvidence,
      strict_consume_manifest: consumeManifest,
      publish_share_export_ready: true
    },
    downstream_continuation: evidence.continuation,
    unauthorized: {
      viewer: { status: viewerDenied.status, error: viewerDenied.payload?.error ?? null, governance: viewerDenied.payload?.governance ?? null },
      editor: { status: editorDenied.status, error: editorDenied.payload?.error ?? null, governance: editorDenied.payload?.governance ?? null }
    },
    evidence,
    audit,
    lineage,
    approvals: {
      strict: boundaryApproval,
      strict_canvas_approval: canvasApprovalPayload,
      publish: publishApproval,
      share: shareApproval
    }
  };

  writeJson(evidenceFile, evidence);
  writeJson(auditFile, audit);
  writeJson(lineageFile, lineage);
  fs.writeFileSync(detailedProofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  step(`proof written to ${proofFile}`);
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  server.kill("SIGTERM");
  await wait(500);
}
