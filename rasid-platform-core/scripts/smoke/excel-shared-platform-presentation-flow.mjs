import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);

const { ExcelEngine } = await load("packages/excel-engine/dist/index.js");
const { startDashboardWebApp, stopDashboardWebApp } = await load("apps/contracts-cli/dist/dashboard-web.js");
const { startPresentationPlatformServer } = await load("packages/presentations-engine/dist/platform.js");

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

if (!browserExecutablePath) {
  throw new Error("No Chromium-compatible browser executable found for excel shared platform presentation flow proof.");
}

const host = "127.0.0.1";
const startedAt = new Date();
const startedAtIso = startedAt.toISOString();
const runId = `excel-shared-platform-presentation-flow-${startedAtIso.replace(/[^0-9]/g, "")}`;
const proofRoot = path.join(root, "packages", "excel-engine", "output", runId);
const stepLogPath = path.join(proofRoot, "artifacts", "step-log.txt");

for (const folder of ["artifacts", "evidence", "audit", "lineage", "browser", "records"]) {
  fs.mkdirSync(path.join(proofRoot, folder), { recursive: true });
}

const now = () => new Date().toISOString();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const writeJson = (relativePath, payload) => {
  const target = path.join(proofRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};

const step = (message, extra = {}) => {
  fs.appendFileSync(stepLogPath, `[${now()}] ${message} ${JSON.stringify(extra)}\n`, "utf8");
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No free port available."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const waitForServer = async (url, attempts = 80, delayMs = 250) => {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    await wait(delayMs);
  }
  throw lastError ?? new Error(`Server did not become ready: ${url}`);
};

const waitForFetchOk = async (url, options = {}, attempts = 40, delayMs = 250) => {
  let lastResponse = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    lastResponse = response;
    await wait(delayMs);
  }
  return lastResponse;
};

const loginDashboardWeb = async (origin) => {
  const response = await fetch(`${origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin",
      password: "1500",
      tenant_ref: "tenant-default",
      workspace_id: "workspace-dashboard-web",
      project_id: "project-dashboard-web",
      actor_ref: "admin"
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Dashboard web login failed: ${response.status}`);
  }
  return payload;
};

const loginPresentationPlatform = async (origin) => {
  const response = await fetch(`${origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin",
      password: "1500",
      tenantRef: "tenant-default"
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Presentation platform login failed: ${response.status}`);
  }
  return payload;
};

const dashboardApi = async (origin, token, pathname, method = "GET", body) => {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-ref": "tenant-default",
      "x-actor-ref": "admin",
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${payload.error ?? ""}`.trim());
  }
  return payload;
};

const presentationsApi = async (origin, token, pathname, method = "GET", body) => {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": "tenant-default",
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${payload.error ?? ""}`.trim());
  }
  return payload;
};

const openBrowser = async () =>
  chromium.launch({
    executablePath: browserExecutablePath,
    headless: true
  });

const latestDirectoryByPrefix = (prefix) => {
  const base = path.join(root, "packages", "excel-engine", "output");
  if (!fs.existsSync(base)) {
    return null;
  }
  return (
    fs
      .readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => path.join(base, entry.name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null
  );
};

const resolveWorkbookSource = async () => {
  const latestSharedRoot = latestDirectoryByPrefix("excel-shared-platform-flow-");
  if (latestSharedRoot) {
    const sharedProof = path.join(latestSharedRoot, "records", "excel-source.json");
    if (fs.existsSync(sharedProof)) {
      const payload = readJson(sharedProof);
      if (payload.workbook_path && fs.existsSync(payload.workbook_path)) {
        return {
          source_kind: "latest_excel_shared_platform_dashboard_flow",
          workbook_path: payload.workbook_path,
          workbook_package_path: payload.workbook_package_path,
          evidence_path: payload.evidence_path,
          audit_path: payload.audit_path,
          lineage_path: payload.lineage_path,
          output_root: payload.output_root
        };
      }
    }
  }
  const latestSampleRoot = latestDirectoryByPrefix("sample-run-");
  if (latestSampleRoot) {
    const workbookPath = path.join(latestSampleRoot, "artifacts", "sample-output.xlsx");
    if (fs.existsSync(workbookPath)) {
      return {
        source_kind: "latest_sample_run",
        workbook_path: workbookPath,
        workbook_package_path: path.join(latestSampleRoot, "artifacts", "workbook-package.json"),
        evidence_path: path.join(latestSampleRoot, "evidence", "evidence-pack.json"),
        audit_path: path.join(latestSampleRoot, "audit", "audit-events.json"),
        lineage_path: path.join(latestSampleRoot, "lineage", "lineage-edges.json"),
        output_root: latestSampleRoot
      };
    }
  }
  step("running fallback fresh excel-engine sample");
  const excelRun = await new ExcelEngine().runSample({
    tenant_ref: "tenant-excel-shared-platform-presentation",
    workspace_id: "workspace-excel-shared-platform-presentation",
    project_id: "project-excel-shared-platform-presentation",
    actor_ref: "excel-shared-platform-presentation",
    output_root: path.join(root, "packages", "excel-engine", "output")
  });
  return {
    source_kind: "fresh_run_sample",
    workbook_path: excelRun.artifacts.exported_workbook_path,
    workbook_package_path: excelRun.artifacts.workbook_package_path,
    evidence_path: excelRun.artifacts.evidence_path,
    audit_path: excelRun.artifacts.audit_path,
    lineage_path: excelRun.artifacts.lineage_path,
    output_root: excelRun.artifacts.output_root
  };
};

const workbookSource = await resolveWorkbookSource();
const workbookPath = workbookSource.workbook_path;
const workbookPackagePath = workbookSource.workbook_package_path;
const excelEvidencePath = workbookSource.evidence_path;
const excelAuditPath = workbookSource.audit_path;
const excelLineagePath = workbookSource.lineage_path;
const excelRunRoot = workbookSource.output_root;

writeJson("records/excel-source.json", {
  source_kind: workbookSource.source_kind,
  workbook_path: workbookPath,
  workbook_package_path: workbookPackagePath,
  evidence_path: excelEvidencePath,
  audit_path: excelAuditPath,
  lineage_path: excelLineagePath,
  output_root: excelRunRoot
});

const dashboardPort = await getFreePort();
const dashboardOrigin = `http://${host}:${dashboardPort}`;
const presentationsPort = await getFreePort();

step("starting shared dashboard-web and presentations platform");
startDashboardWebApp({ host, port: dashboardPort });
const presentationsServer = await startPresentationPlatformServer({ host, port: presentationsPort });

let browser;
let context;

try {
  await waitForServer(`${dashboardOrigin}/login`);
  await waitForServer(`${presentationsServer.origin}/login`);

  step("logging into shared dashboard-web and presentations platform");
  const dashboardLogin = await loginDashboardWeb(dashboardOrigin);
  const presentationsLogin = await loginPresentationPlatform(presentationsServer.origin);
  writeJson("artifacts/dashboard-login.json", dashboardLogin);
  writeJson("artifacts/presentations-login.json", presentationsLogin);

  const dashboardToken = dashboardLogin.data.accessToken;
  const presentationsToken = presentationsLogin.data.accessToken;

  step("creating report from workbook through shared /excel");
  const createReportResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/excel/create-report", "POST", {
    title: "Excel Shared Platform Presentation Report",
    workbook_path: workbookPath,
    workbook_label: path.basename(workbookPath),
    approval_granted: true
  });
  writeJson("artifacts/excel-create-report.json", createReportResponse);
  const reportId = createReportResponse.report_id;
  const excelConsume = createReportResponse.excel_consume;
  const reportCurrent = readJson(excelConsume.report_state_path);
  writeJson("artifacts/report-current.json", reportCurrent);

  step("converting shared report to presentation");
  const convertPresentationResponse = await dashboardApi(dashboardOrigin, dashboardToken, "/api/v1/reports/convert-to-presentation", "POST", {
    report_id: reportId,
    approval_granted: true
  });
  writeJson("artifacts/report-to-presentation.json", convertPresentationResponse);
  const deckId = convertPresentationResponse.deck_id;

  const sharedPresentationState = await dashboardApi(
    dashboardOrigin,
    dashboardToken,
    `/api/v1/canvas/state?surface=${encodeURIComponent("/presentations")}&deck_id=${encodeURIComponent(deckId)}&report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`,
    "GET"
  );
  writeJson("artifacts/presentations-canvas-state.json", sharedPresentationState);

  step("loading detail and publishing through presentations platform");
  const deckDetail = await presentationsApi(presentationsServer.origin, presentationsToken, `/api/v1/presentations/decks/${encodeURIComponent(deckId)}`, "GET");
  writeJson("artifacts/presentations-deck-detail.json", deckDetail);

  const publishResponse = await presentationsApi(
    presentationsServer.origin,
    presentationsToken,
    `/api/v1/presentations/decks/${encodeURIComponent(deckId)}/publish`,
    "POST",
    { password: "1234" }
  );
  writeJson("artifacts/presentation-publication.json", publishResponse);

  const exportPptxResponse = await presentationsApi(
    presentationsServer.origin,
    presentationsToken,
    `/api/v1/presentations/decks/${encodeURIComponent(deckId)}/export/pptx`,
    "POST",
    {}
  );
  writeJson("artifacts/presentation-export-pptx.json", exportPptxResponse);

  const publishedViewerUrl = new URL(publishResponse.publicUrl ?? deckDetail.data.publicUrl, presentationsServer.origin).toString();
  const exportUrl = new URL(exportPptxResponse.data.url, presentationsServer.origin).toString();
  const exportResponse = await waitForFetchOk(exportUrl, {
    headers: { authorization: `Bearer ${presentationsToken}`, "x-tenant-id": "tenant-default" }
  });
  const exportBuffer = Buffer.from(await exportResponse.arrayBuffer());
  const pptxPath = path.join(proofRoot, "artifacts", "presentation.pptx");
  fs.writeFileSync(pptxPath, exportBuffer);

  browser = await openBrowser();
  context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem("rasid_tenant", "tenant-default");
    window.localStorage.setItem("rasid_actor", "admin");
  });

  const excelPage = await context.newPage();
  await excelPage.goto(`${dashboardOrigin}/excel?session_id=${encodeURIComponent(runId)}`, { waitUntil: "networkidle" });
  await excelPage.screenshot({ path: path.join(proofRoot, "browser", "excel-surface.png"), fullPage: true });
  await excelPage.close();

  const reportPage = await context.newPage();
  await reportPage.goto(`${dashboardOrigin}/reports?report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`, {
    waitUntil: "networkidle"
  });
  await reportPage.screenshot({ path: path.join(proofRoot, "browser", "report-surface.png"), fullPage: true });
  await reportPage.close();

  const sharedPresentationsPage = await context.newPage();
  await sharedPresentationsPage.goto(
    `${dashboardOrigin}/presentations?deck_id=${encodeURIComponent(deckId)}&report_id=${encodeURIComponent(reportId)}&session_id=${encodeURIComponent(runId)}`,
    { waitUntil: "networkidle" }
  );
  await sharedPresentationsPage.screenshot({ path: path.join(proofRoot, "browser", "shared-presentations-surface.png"), fullPage: true });
  await sharedPresentationsPage.close();

  const presentationDetailPage = await context.newPage();
  let presentationDetailStatus = "captured";
  try {
    await presentationDetailPage.goto(
      `${presentationsServer.origin}/presentations/${encodeURIComponent(deckId)}?access_token=${encodeURIComponent(presentationsToken)}&tenant_ref=tenant-default`,
      { waitUntil: "domcontentloaded" }
    );
    await presentationDetailPage.waitForTimeout(3000);
    await presentationDetailPage.screenshot({ path: path.join(proofRoot, "browser", "presentations-detail.png"), fullPage: true });
  } catch (error) {
    presentationDetailStatus = error instanceof Error ? error.message : String(error);
    writeJson("artifacts/presentations-detail-best-effort.json", {
      status: "best_effort_failed",
      error: presentationDetailStatus
    });
  } finally {
    await presentationDetailPage.close();
  }

  const publishedViewerPage = await context.newPage();
  await publishedViewerPage.goto(publishedViewerUrl, { waitUntil: "domcontentloaded" });
  await publishedViewerPage.waitForSelector("#viewerState", { timeout: 30000 });
  await publishedViewerPage.screenshot({ path: path.join(proofRoot, "browser", "presentations-published-viewer.png"), fullPage: true });
  await publishedViewerPage.close();

  const reportText = JSON.stringify(reportCurrent);
  const deckText = JSON.stringify(deckDetail.data.bundle);
  assert(reportText.includes(path.basename(workbookPath)), "Shared report did not retain workbook identity.");
  assert(deckText.includes("PivotDesktop") || deckText.includes(path.basename(workbookPath)), "Presentation bundle did not retain workbook-derived content.");
  assert(fs.existsSync(pptxPath) && fs.statSync(pptxPath).size > 0, "PPTX export was not materialized.");

  const evidencePack = {
    generated_at: now(),
    phase_requirement: "excel-engine shared shell continuity proof to presentations",
    checks: [
      { id: "excel_source_generated_check", status: true, detail: workbookPath },
      { id: "excel_shared_shell_surface_check", status: true, detail: `${dashboardOrigin}/excel` },
      { id: "excel_shared_shell_create_report_check", status: true, detail: createReportResponse.open_path },
      { id: "shared_shell_report_to_presentation_check", status: true, detail: deckId },
      { id: "shared_presentations_surface_check", status: true, detail: `${dashboardOrigin}/presentations?deck_id=${deckId}` },
      { id: "presentations_publication_check", status: true, detail: publishedViewerUrl },
      { id: "presentations_export_pptx_check", status: true, detail: pptxPath },
      { id: "shared_shell_presentation_continuity_check", status: true, detail: "PivotDesktop" },
      { id: "presentations_detail_best_effort_check", status: presentationDetailStatus === "captured", detail: presentationDetailStatus }
    ]
  };

  const auditEvents = {
    generated_at: now(),
    events: [
      {
        action_id: "excel_engine.resolve_workbook_source.v1",
        output_ref: workbookPath,
        metadata: { output_root: excelRunRoot, source_kind: workbookSource.source_kind }
      },
      {
        action_id: "excel.shared_shell.create_report.v1",
        output_ref: reportId,
        metadata: { route: "/api/v1/excel/create-report", workbook_path: workbookPath, consume_manifest_path: excelConsume.consume_manifest_path }
      },
      {
        action_id: "shared_shell.report_to_presentation.v1",
        output_ref: deckId,
        metadata: { route: "/api/v1/reports/convert-to-presentation", report_id: reportId }
      },
      {
        action_id: "presentations.detail_best_effort.v1",
        output_ref: deckId,
        metadata: { route: `/presentations/${deckId}`, status: presentationDetailStatus }
      },
      {
        action_id: "presentations.publish_from_shared_excel_flow.v1",
        output_ref: publishResponse.data.publication.publication_id,
        metadata: { route: `/api/v1/presentations/decks/${deckId}/publish`, public_url: publishedViewerUrl }
      },
      {
        action_id: "presentations.export_pptx_from_shared_excel_flow.v1",
        output_ref: pptxPath,
        metadata: { route: `/api/v1/presentations/decks/${deckId}/export/pptx`, export_url: exportUrl }
      }
    ]
  };

  const lineageEdges = {
    generated_at: now(),
    edges: [
      { from: `workbook:${workbookPath}`, to: `report:${reportId}`, relation: "consumed_by_shared_excel_route" },
      { from: `report:${reportId}`, to: `deck:${deckId}`, relation: "converted_to_presentation" },
      { from: `deck:${deckId}`, to: `publication:${publishResponse.data.publication.publication_id}`, relation: "published_as" },
      { from: `deck:${deckId}`, to: `export:${pptxPath}`, relation: "exported_as_pptx" }
    ]
  };

  writeJson("evidence/evidence-pack.json", evidencePack);
  writeJson("audit/audit-events.json", auditEvents);
  writeJson("lineage/lineage-edges.json", lineageEdges);
  writeJson("artifacts/cross-engine-proof.json", {
    phase_requirement: "excel-engine shared shell continuity proof to presentations",
    generated_at: now(),
    workbook: {
      workbook_path: workbookPath,
      workbook_package_path: workbookPackagePath,
      output_root: excelRunRoot
    },
    shared_shell: {
      entry_route: `${dashboardOrigin}/excel`,
      create_report_route: "/api/v1/excel/create-report",
      report_route: `${dashboardOrigin}/reports?report_id=${reportId}`,
      presentations_route: `${dashboardOrigin}/presentations?deck_id=${deckId}`,
      runtime_root: "C:\\ALRaMaDy\\rasid-platform-core\\.runtime\\dashboard-web"
    },
    report: {
      report_id: reportId,
      consume_manifest_path: excelConsume.consume_manifest_path,
      report_state_path: excelConsume.report_state_path
    },
    presentation: {
      deck_id: deckId,
      detail_route: `${presentationsServer.origin}/presentations/${deckId}`,
      publication_route: publishedViewerUrl,
      export_pptx_path: pptxPath
    },
      screenshots: {
        excel_surface: path.join(proofRoot, "browser", "excel-surface.png"),
        report_surface: path.join(proofRoot, "browser", "report-surface.png"),
        shared_presentations_surface: path.join(proofRoot, "browser", "shared-presentations-surface.png"),
        presentations_detail: path.join(proofRoot, "browser", "presentations-detail.png"),
        presentations_published_viewer: path.join(proofRoot, "browser", "presentations-published-viewer.png")
      }
  });
} finally {
  if (context) {
    try {
      await context.close();
    } catch {}
  }
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  try {
    await presentationsServer?.close?.();
  } catch {}
  await stopDashboardWebApp();
}
