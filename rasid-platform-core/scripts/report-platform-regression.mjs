import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const platformModule = await load("packages/report-engine/dist/platform.js");
const reportEngine = await load("packages/report-engine/dist/index.js");
const { chromium } = await import("playwright-core");

const runId = `report-platform-regression-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "report-engine", "artifacts", "latest-run", runId);
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outputRoot, "api"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "browser"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "records"), { recursive: true });

const writeJson = (relativePath, payload) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};
const writeText = (relativePath, payload) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, payload, "utf8");
};
const curlJson = async (args) => {
  const result = spawnSync("curl.exe", ["-f", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `curl failed for ${args.join(" ")}`);
  }
  return JSON.parse(result.stdout);
};
const fetchText = async (url) => {
  const result = spawnSync("curl.exe", ["-f", "-s", url], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `curl failed for ${url}`);
  }
  return result.stdout;
};
const fetchWithRetry = async (url, mode = "json", attempts = 10, delayMs = 1500) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return mode === "text" ? await fetchText(url) : await curlJson(["-s", url]);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
};
const withTimeout = async (promise, label, timeoutMs = 5000) => {
  let timeoutHandle;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

const server = await platformModule.startReportPlatformServer();
let browser;
try {
  const loginPayload = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/governance/auth/login`,
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ email: "admin", password: "1500", tenantRef: "tenant-default" })
  ]);
  const token = loginPayload.data.accessToken;
  writeJson("api/login.json", loginPayload);

  const importedDocx = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/import`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ parser_hint: "docx", title: "Imported DOCX Route Proof", sample_profile: "complex" })
  ]);
  const importedPdf = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/import`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ parser_hint: "pdf", title: "Imported PDF Route Proof", sample_profile: "complex" })
  ]);
  writeJson("api/import-docx.json", importedDocx);
  writeJson("api/import-pdf.json", importedPdf);
  const importedDocxDetail = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${importedDocx.data.report_id}`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  const importedPdfDetail = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${importedPdf.data.report_id}`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  writeJson("api/import-docx-detail.json", importedDocxDetail);
  writeJson("api/import-pdf-detail.json", importedPdfDetail);

  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  await context.addCookies([
    { name: "rasid_access_token", value: token, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: "127.0.0.1", path: "/" }
  ]);

  const page = await context.newPage();
  page.on("popup", async (popup) => {
    await popup.waitForLoadState("domcontentloaded");
    await popup.close();
  });

  await page.goto(`${server.origin}/reports`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "reports-home.png"), fullPage: true });
  await page.locator("#reportTitle").fill("Live Route Report Proof");
  await page.locator("#createReport").click();
  await page.waitForURL(/\/reports\/report-platform-/);
  const reportId = page.url().split("/").at(-1);
  if (!reportId) {
    throw new Error("Failed to determine created report id from /reports route.");
  }
  await page.screenshot({ path: path.join(outputRoot, "browser", "report-detail-before.png"), fullPage: true });

  await page.goto(`${server.origin}/reports/${importedDocx.data.report_id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "imported-docx-detail.png"), fullPage: true });
  await page.goto(`${server.origin}/reports/${importedPdf.data.report_id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "imported-pdf-detail.png"), fullPage: true });
  await page.goto(`${server.origin}/reports/${reportId}`, { waitUntil: "networkidle" });

  const createdDetail = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${reportId}`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  writeJson("api/report-detail-initial.json", createdDetail);

  const updateResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/update`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ body: "Updated from report platform regression." })
  ]);
  const refreshResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/refresh`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const reviewResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/review`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const approveResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/approve`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const publishResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/publish`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const scheduleResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/schedules`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const scheduleId = scheduleResponse.data.schedule.schedule_id;
  const updateScheduleResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/schedules/${scheduleId}/update`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({
      next_run_at: "2026-03-15T06:00:00.000Z",
      publication_target_refs: [`unstable+gateway://reports/${reportId}/scheduled`],
      export_profile_refs: ["export-profile://reports/html", "export-profile://reports/pdf"],
      visibility_scope_ref: "workspace"
    })
  ]);
  const runScheduleResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/schedules/${scheduleId}/run`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const cancelScheduleResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/schedules/${scheduleId}/cancel`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const resumeScheduleResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/schedules/${scheduleId}/resume`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const exportHtml = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/export/html`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const convertPresentationResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/convert/presentation`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ target_ref: `platform://presentations/${reportId}` })
  ]);
  const convertDashboardResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/convert/dashboard`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ target_ref: `platform://dashboards/${reportId}` })
  ]);
  writeJson("api/update.json", updateResponse);
  writeJson("api/refresh.json", refreshResponse);
  writeJson("api/review.json", reviewResponse);
  writeJson("api/approve.json", approveResponse);
  writeJson("api/publish.json", publishResponse);
  writeJson("api/schedule.json", scheduleResponse);
  writeJson("api/update-schedule.json", updateScheduleResponse);
  writeJson("api/run-schedule.json", runScheduleResponse);
  writeJson("api/cancel-schedule.json", cancelScheduleResponse);
  writeJson("api/resume-schedule.json", resumeScheduleResponse);
  writeJson("api/export-html.json", exportHtml);
  writeJson("api/convert-presentation.json", convertPresentationResponse);
  writeJson("api/convert-dashboard.json", convertDashboardResponse);

  const presentationBackSync = createdDetail.data.records.backSyncs.find((entry) => entry.downstream_capability === "presentations");
  const dashboardBackSync = createdDetail.data.records.backSyncs.find((entry) => entry.downstream_capability === "dashboards");
  const refreshedDetail = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${reportId}`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  const firstPresentationBackSync = refreshedDetail.data.records.backSyncs.find((entry) => entry.downstream_capability === "presentations");
  const firstDashboardBackSync = refreshedDetail.data.records.backSyncs.find((entry) => entry.downstream_capability === "dashboards");
  if (!firstPresentationBackSync || !firstDashboardBackSync) {
    throw new Error("Initial downstream conversions did not persist back-sync records.");
  }

  const presentationManualMerge = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/update`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ block_ref: firstPresentationBackSync.synced_block_refs[0], body: "Manual merge override for presentation reconciliation." })
  ]);
  const presentationReconcile = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/convert/presentation`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ target_ref: `platform://presentations/${reportId}` })
  ]);
  const dashboardManualMerge = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/update`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ block_ref: firstDashboardBackSync.synced_block_refs[0], body: "Manual merge override for dashboard reconciliation." })
  ]);
  const dashboardReconcile = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/convert/dashboard`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ target_ref: `platform://dashboards/${reportId}` })
  ]);
  writeJson("api/presentation-manual-merge.json", presentationManualMerge);
  writeJson("api/presentation-reconcile.json", presentationReconcile);
  writeJson("api/dashboard-manual-merge.json", dashboardManualMerge);
  writeJson("api/dashboard-reconcile.json", dashboardReconcile);

  const compareResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/compare`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const publishDegraded = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/publish-degraded`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const exportPdf = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/export/pdf`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const exportDocx = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${reportId}/export/docx`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const schedulesList = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${reportId}/schedules`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  writeJson("api/compare.json", compareResponse);
  writeJson("api/publish-degraded.json", publishDegraded);
  writeJson("api/export-pdf.json", exportPdf);
  writeJson("api/export-docx.json", exportDocx);
  writeJson("api/schedules-list.json", schedulesList);
  const importedPdfSchedule = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/${importedPdf.data.report_id}/schedules`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ next_run_at: "2026-03-15T06:00:00.000Z" })
  ]);
  const importedPdfRunSchedule = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/schedules/${importedPdfSchedule.data.schedule.schedule_id}/run`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
  const importedPdfFinalDetail = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${importedPdf.data.report_id}`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  writeJson("api/imported-pdf-schedule.json", importedPdfSchedule);
  writeJson("api/imported-pdf-run-schedule.json", importedPdfRunSchedule);
  writeJson("api/imported-pdf-detail-final.json", importedPdfFinalDetail);

  const finalDetail = await curlJson([
    "-s",
    `${server.origin}/api/v1/reports/reports/${reportId}`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default"
  ]);
  writeJson("api/report-detail-final.json", finalDetail);
  await page.goto(`${server.origin}/reports/${reportId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "report-detail-after.png"), fullPage: true });

  const publicUrl = new URL(finalDetail.data.publicUrl, server.origin).toString();
  const publicPage = await context.newPage();
  await publicPage.goto(publicUrl, { waitUntil: "networkidle" });
  await publicPage.screenshot({ path: path.join(outputRoot, "browser", "published-report.png"), fullPage: true });

  const publicationInfo = finalDetail.data.publicationService.publications.find(
    (entry) => entry.report_id === reportId
  );
  if (!publicationInfo?.served_manifest_url || !publicationInfo.served_embed_html_url) {
    throw new Error("Publication service did not expose served report URLs.");
  }
  const servedManifest = await curlJson(["-s", publicationInfo.served_manifest_url]);
  const servedPublishState = await curlJson(["-s", publicationInfo.served_publish_state_url]);
  const servedEmbedPayload = publicationInfo.served_embed_payload_url ? await curlJson(["-s", publicationInfo.served_embed_payload_url]) : null;
  const servedExportHtml = await fetchText(publicationInfo.served_export_html_url);
  const remoteTransport = publishResponse.data.transport ?? {};
  const remoteManifest = remoteTransport.remote_manifest_url ? await fetchWithRetry(remoteTransport.remote_manifest_url) : null;
  const remotePublishState = remoteTransport.remote_publish_state_url ? await fetchWithRetry(remoteTransport.remote_publish_state_url) : null;
  const remoteEmbedPayload = remoteTransport.remote_embed_payload_url ? await fetchWithRetry(remoteTransport.remote_embed_payload_url) : null;
  const remoteEmbedHtml = remoteTransport.remote_embed_html_url ? await fetchWithRetry(remoteTransport.remote_embed_html_url, "text") : null;
  const remoteExportHtml = remoteTransport.remote_export_html_url ? await fetchWithRetry(remoteTransport.remote_export_html_url, "text") : null;
  const remoteGatewayManifest = remoteTransport.remote_gateway_manifest_url ? await fetchWithRetry(remoteTransport.remote_gateway_manifest_url) : null;
  const remoteAccessLifecycle = remoteTransport.remote_access_lifecycle_url ? await fetchWithRetry(remoteTransport.remote_access_lifecycle_url) : null;
  const remoteDeliveryReceipt = remoteTransport.remote_delivery_receipt_url ? await fetchWithRetry(remoteTransport.remote_delivery_receipt_url) : null;
  const retriedSchedulerQueue = retriedRun?.orchestration?.queue_ref ? await fetchWithRetry(retriedRun.orchestration.queue_ref) : null;
  const retriedSchedulerDispatch = retriedRun?.orchestration?.remote_dispatch_ref ? await fetchWithRetry(retriedRun.orchestration.remote_dispatch_ref) : null;
  const degradedRemoteManifest = degradedRun?.degradedPublicationResult?.transport?.remote_manifest_url
    ? await fetchWithRetry(degradedRun.degradedPublicationResult.transport.remote_manifest_url)
    : null;
  writeJson("api/served-manifest.json", servedManifest);
  writeJson("api/served-publish-state.json", servedPublishState);
  writeJson("api/served-embed-payload.json", servedEmbedPayload);
  writeText("api/served-export.html", servedExportHtml);
  writeJson("api/remote-manifest.json", remoteManifest);
  writeJson("api/remote-publish-state.json", remotePublishState);
  writeJson("api/remote-embed-payload.json", remoteEmbedPayload);
  writeText("api/remote-embed.html", remoteEmbedHtml ?? "");
  writeText("api/remote-export.html", remoteExportHtml ?? "");
  writeJson("api/remote-gateway-manifest.json", remoteGatewayManifest);
  writeJson("api/remote-access-lifecycle.json", remoteAccessLifecycle);
  writeJson("api/remote-delivery-receipt.json", remoteDeliveryReceipt);
  writeJson("api/remote-scheduler-queue.json", retriedSchedulerQueue);
  writeJson("api/remote-scheduler-dispatch.json", retriedSchedulerDispatch);
  writeJson("api/remote-degraded-manifest.json", degradedRemoteManifest);

  if ((importedDocx.data.payload.table_count ?? 0) < 2 || (importedPdf.data.payload.page_structure?.length ?? 0) < 2) {
    throw new Error("Deeper ingest fidelity proof is incomplete.");
  }
  if ((importedDocx.data.payload.hyperlinks?.length ?? 0) < 2 || (importedPdf.data.payload.hyperlinks?.length ?? 0) < 1 || (importedPdf.data.payload.embedded_assets?.length ?? 0) < 1) {
    throw new Error("Complex source metadata was not preserved with sufficient fidelity.");
  }
  if ((importedDocxDetail.data.state.sections.length ?? 0) < 3 || (importedPdfDetail.data.state.contentBlocks.length ?? 0) < 4) {
    throw new Error("Imported report state was not reconstructed with sufficient fidelity.");
  }
  const finalBackSyncs = finalDetail.data.records.backSyncs;
  const reconciledPresentation = finalBackSyncs.filter((entry) => entry.downstream_capability === "presentations").at(-1);
  const reconciledDashboard = finalBackSyncs.filter((entry) => entry.downstream_capability === "dashboards").at(-1);
  if (!reconciledPresentation?.matched_section_ref || !reconciledDashboard?.matched_section_ref) {
    throw new Error("Bidirectional reconciliation proof is incomplete.");
  }
  if (finalDetail.data.records.orchestrations.length === 0 || finalDetail.data.records.dispatches.length === 0 || finalDetail.data.records.transportDeliveries.length === 0) {
    throw new Error("Scheduling/orchestration proof is incomplete.");
  }
  const retriedRun = runScheduleResponse.data[0];
  if (!retriedRun?.dispatch?.failure_history?.length || retriedRun.dispatch.state !== "completed" || retriedRun.orchestration.retry_count < 1) {
    throw new Error("Retry orchestration proof is incomplete.");
  }
  const degradedRun = importedPdfRunSchedule.data[0];
  if (!degradedRun?.degradedPublicationResult?.publication || degradedRun.dispatch.state !== "degraded") {
    throw new Error("Degraded scheduled publish proof is incomplete.");
  }
  if ((finalDetail.data.state.publications.length ?? 0) < 2 || !finalDetail.data.publicationService.publications.length) {
    throw new Error("Publish externalization proof is incomplete.");
  }
  if (!remoteManifest || !remotePublishState || !remoteGatewayManifest || !remoteAccessLifecycle || !remoteDeliveryReceipt) {
    throw new Error("Remote publication infrastructure proof is incomplete.");
  }
  if (!retriedSchedulerQueue || !retriedSchedulerDispatch) {
    throw new Error("Remote orchestration infrastructure proof is incomplete.");
  }

  writeJson("records/ingest-fidelity-regression.json", {
    docx: {
      report_id: importedDocx.data.report_id,
      sample_profile: importedDocx.data.sample_profile,
      fixture_expected: importedDocx.data.fixture_metadata?.expected ?? null,
      parsed_pages: importedDocx.data.payload.page_structure?.length ?? 0,
      parsed_tables: importedDocx.data.payload.table_count ?? 0,
      parsed_sections: importedDocx.data.payload.section_hierarchy?.length ?? 0,
      parsed_hyperlinks: importedDocx.data.payload.hyperlinks?.length ?? 0,
      parsed_embedded_assets: importedDocx.data.payload.embedded_assets?.length ?? 0,
      editable_sections: importedDocxDetail.data.state.sections.length,
      editable_blocks: importedDocxDetail.data.state.contentBlocks.length,
      before_after: {
        expected_tables: importedDocx.data.fixture_metadata?.expected?.table_count ?? null,
        actual_tables: importedDocx.data.payload.table_count ?? 0,
        expected_sections: importedDocx.data.fixture_metadata?.expected?.section_count ?? null,
        actual_sections: importedDocx.data.payload.section_hierarchy?.length ?? 0
      }
    },
    pdf: {
      report_id: importedPdf.data.report_id,
      sample_profile: importedPdf.data.sample_profile,
      fixture_expected: importedPdf.data.fixture_metadata?.expected ?? null,
      parsed_pages: importedPdf.data.payload.page_structure?.length ?? 0,
      parsed_tables: importedPdf.data.payload.table_count ?? 0,
      parsed_sections: importedPdf.data.payload.section_hierarchy?.length ?? 0,
      parsed_hyperlinks: importedPdf.data.payload.hyperlinks?.length ?? 0,
      parsed_embedded_assets: importedPdf.data.payload.embedded_assets?.length ?? 0,
      editable_sections: importedPdfDetail.data.state.sections.length,
      editable_blocks: importedPdfDetail.data.state.contentBlocks.length,
      before_after: {
        expected_vectors: importedPdf.data.fixture_metadata?.expected?.vector_region_count ?? null,
        actual_vectors: (importedPdf.data.payload.embedded_assets ?? []).filter((entry) => entry.asset_kind === "vector_region").length,
        expected_tables: importedPdf.data.fixture_metadata?.expected?.table_count ?? null,
        actual_tables: importedPdf.data.payload.table_count ?? 0
      }
    }
  });
  writeJson("records/reconciliation-cycle.json", {
    report_id: reportId,
    compare_diff_id: compareResponse.data.diff.diff_id,
    presentation: {
      initial_sync_id: firstPresentationBackSync.sync_id,
      reconciled_sync_id: reconciledPresentation.sync_id,
      matched_section_ref: reconciledPresentation.matched_section_ref,
      conflict_refs: reconciledPresentation.conflict_refs,
      removed_block_refs: reconciledPresentation.removed_block_refs
    },
    dashboard: {
      initial_sync_id: firstDashboardBackSync.sync_id,
      reconciled_sync_id: reconciledDashboard.sync_id,
      matched_section_ref: reconciledDashboard.matched_section_ref,
      conflict_refs: reconciledDashboard.conflict_refs,
      removed_block_refs: reconciledDashboard.removed_block_refs
    }
  });
  writeJson("records/downstream-fidelity.json", {
    report_id: reportId,
    presentation_conversion: convertPresentationResponse.data.payload,
    dashboard_conversion: convertDashboardResponse.data.payload,
    presentation_reconcile: presentationReconcile.data.payload,
    dashboard_reconcile: dashboardReconcile.data.payload
  });
  writeJson("records/scheduling-proof.json", {
    updated_schedule: updateScheduleResponse.data.schedule,
    list_response: schedulesList.data,
    retried_run: retriedRun,
    degraded_run: degradedRun,
    imported_pdf_schedule: importedPdfSchedule.data.schedule,
    remote_queue: retriedSchedulerQueue,
    remote_dispatch: retriedSchedulerDispatch
  });
  writeJson("records/publish-externalization-proof.json", {
    public_url: publicUrl,
    publication_service_route: publicationInfo,
    served_manifest: servedManifest,
    served_publish_state: servedPublishState,
    served_embed_payload: servedEmbedPayload,
    remote_manifest: remoteManifest,
    remote_publish_state: remotePublishState,
    remote_embed_payload: remoteEmbedPayload,
    remote_embed_html_url: remoteTransport.remote_embed_html_url ?? null,
    remote_export_html_url: remoteTransport.remote_export_html_url ?? null,
    remote_gateway_manifest: remoteGatewayManifest,
    remote_access_lifecycle: remoteAccessLifecycle,
    remote_delivery_receipt: remoteDeliveryReceipt,
    remote_scheduler_queue_url: retriedRun?.orchestration?.queue_ref ?? null,
    remote_scheduler_dispatch_url: retriedRun?.orchestration?.remote_dispatch_ref ?? null,
    degraded_publication: publishDegraded.data.publication ?? publishDegraded.data,
    degraded_remote_manifest: degradedRemoteManifest
  });
  writeJson("records/reports-ui-proof.json", {
    origin: server.origin,
    created_report_id: reportId,
    imported_docx_report_id: importedDocx.data.report_id,
    imported_pdf_report_id: importedPdf.data.report_id,
    imported_profiles: {
      docx: importedDocx.data.sample_profile,
      pdf: importedPdf.data.sample_profile
    },
    screenshots: [
      path.join(outputRoot, "browser", "reports-home.png"),
      path.join(outputRoot, "browser", "report-detail-before.png"),
      path.join(outputRoot, "browser", "report-detail-after.png"),
      path.join(outputRoot, "browser", "imported-docx-detail.png"),
      path.join(outputRoot, "browser", "imported-pdf-detail.png"),
      path.join(outputRoot, "browser", "published-report.png")
    ]
  });

  writeJson("records/summary.json", {
    runId,
    origin: server.origin,
    reportId,
    importedDocxReportId: importedDocx.data.report_id,
    importedPdfReportId: importedPdf.data.report_id,
    publicUrl,
    screenshots: [
      "browser/reports-home.png",
      "browser/report-detail-before.png",
      "browser/report-detail-after.png",
      "browser/imported-docx-detail.png",
      "browser/imported-pdf-detail.png",
      "browser/published-report.png"
    ]
  });
  writeJson("records/route-surface.json", {
    uiRoutes: ["/login", "/reports", `/reports/${reportId}`, `/published/reports/${finalDetail.data.state.publications.at(-1)?.publication_id ?? ""}`],
    apiRoutes: [
      "/api/v1/governance/auth/login",
      "/api/v1/reports/reports",
      "/api/v1/reports/reports/create",
      "/api/v1/reports/reports/import",
      `/api/v1/reports/reports/${reportId}`,
      `/api/v1/reports/reports/${reportId}/update`,
      `/api/v1/reports/reports/${reportId}/refresh`,
      `/api/v1/reports/reports/${reportId}/compare`,
      `/api/v1/reports/reports/${reportId}/review`,
      `/api/v1/reports/reports/${reportId}/approve`,
      `/api/v1/reports/reports/${reportId}/publish`,
      `/api/v1/reports/reports/${reportId}/publish-degraded`,
      `/api/v1/reports/reports/${reportId}/schedules`,
      `/api/v1/reports/schedules/${schedulesList.data[0]?.schedule_id ?? ""}/run`,
      `/api/v1/reports/schedules/${schedulesList.data[0]?.schedule_id ?? ""}/update`,
      `/api/v1/reports/schedules/${schedulesList.data[0]?.schedule_id ?? ""}/cancel`,
      `/api/v1/reports/schedules/${schedulesList.data[0]?.schedule_id ?? ""}/resume`,
      `/api/v1/reports/reports/${reportId}/export/html`,
      `/api/v1/reports/reports/${reportId}/export/pdf`,
      `/api/v1/reports/reports/${reportId}/export/docx`,
      `/api/v1/reports/reports/${reportId}/convert/presentation`,
      `/api/v1/reports/reports/${reportId}/convert/dashboard`
    ],
    cliCommands: ["report-dispatch-action", "report-dispatch-tool", "report-serve-publications", "report-start-platform"],
    runtimeSurface: ["dispatchReportAction", "dispatchReportTool", "startReportPublicationService", "startReportPlatformServer"]
  });
  writeJson("records/evidence-surface.json", {
    evidence: finalDetail.data.state ? true : false,
    auditEventCount: finalDetail.data.records.versions.length,
    backSyncCount: finalDetail.data.records.backSyncs.length
  });
} finally {
  if (browser) {
    await withTimeout(browser.close().catch(() => null), "browser.close").catch(() => null);
  }
  await withTimeout(server.close().catch(() => null), "server.close").catch(() => null);
}

console.log(outputRoot);
process.exit(0);
