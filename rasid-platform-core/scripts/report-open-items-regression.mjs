import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const platformModule = await load("packages/report-engine/dist/platform.js");
const { chromium } = await import("playwright-core");

const runId = `report-open-items-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
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
const curlJson = (args) => {
  let method = "GET";
  let url = "";
  let body;
  const headers = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "-s") continue;
    if (value === "-X") {
      method = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "-H") {
      const header = args[index + 1];
      index += 1;
      const separator = header.indexOf(":");
      if (separator > -1) headers[header.slice(0, separator).trim()] = header.slice(separator + 1).trim();
      continue;
    }
    if (value === "-d") {
      body = args[index + 1];
      index += 1;
      continue;
    }
    if (!value.startsWith("-")) url = value;
  }
  if (url.startsWith("http://127.0.0.1")) {
    return fetch(url, { method, headers, body }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${method} ${url} failed with HTTP ${response.status}`);
      }
      return response.json();
    });
  }
  const result = spawnSync("curl.exe", ["-f", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `curl failed: ${args.join(" ")}`);
  }
  return JSON.parse(result.stdout);
};
const fetchText = (url) => {
  const result = spawnSync("curl.exe", ["-f", "-s", url], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `curl failed: ${url}`);
  }
  return result.stdout;
};
const fetchWithRetry = async (url, mode = "json", attempts = 10, delayMs = 1500) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return mode === "text" ? fetchText(url) : curlJson(["-s", url]);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
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
    JSON.stringify({ parser_hint: "docx", sample_profile: "complex", title: "Complex DOCX Proof" })
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
    JSON.stringify({ parser_hint: "pdf", sample_profile: "complex", title: "Complex PDF Proof" })
  ]);
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
  writeJson("api/import-docx.json", importedDocx);
  writeJson("api/import-pdf.json", importedPdf);
  writeJson("api/import-docx-detail.json", importedDocxDetail);
  writeJson("api/import-pdf-detail.json", importedPdfDetail);

  const createResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/reports/create`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify({ title: "Open Items Externalization Proof", description: "Focused regression for complex fidelity and remote publication." })
  ]);
  const reportId = createResponse.data.report_id;
  await curlJson(["-s","-X","POST",`${server.origin}/api/v1/reports/reports/${reportId}/review`,"-H",`Authorization: Bearer ${token}`,"-H","x-tenant-id: tenant-default","-H","Content-Type: application/json","-d","{}"]);
  await curlJson(["-s","-X","POST",`${server.origin}/api/v1/reports/reports/${reportId}/approve`,"-H",`Authorization: Bearer ${token}`,"-H","x-tenant-id: tenant-default","-H","Content-Type: application/json","-d","{}"]);
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
    JSON.stringify({ next_run_at: "2026-03-15T06:00:00.000Z" })
  ]);
  const runScheduleResponse = await curlJson([
    "-s",
    "-X",
    "POST",
    `${server.origin}/api/v1/reports/schedules/${scheduleResponse.data.schedule.schedule_id}/run`,
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    "x-tenant-id: tenant-default",
    "-H",
    "Content-Type: application/json",
    "-d",
    "{}"
  ]);
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

  writeJson("api/create.json", createResponse);
  writeJson("api/publish.json", publishResponse);
  writeJson("api/schedule.json", scheduleResponse);
  writeJson("api/run-schedule.json", runScheduleResponse);
  writeJson("api/imported-pdf-schedule.json", importedPdfSchedule);
  writeJson("api/imported-pdf-run-schedule.json", importedPdfRunSchedule);

  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  await context.addCookies([
    { name: "rasid_access_token", value: token, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: "127.0.0.1", path: "/" }
  ]);
  const page = await context.newPage();
  await page.goto(`${server.origin}/reports`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "reports-home.png"), fullPage: true });
  await page.goto(`${server.origin}/reports/${importedDocx.data.report_id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "complex-docx-detail.png"), fullPage: true });
  await page.goto(`${server.origin}/reports/${importedPdf.data.report_id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "complex-pdf-detail.png"), fullPage: true });
  await page.goto(`${server.origin}/reports/${reportId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "report-detail.png"), fullPage: true });
  const publicUrl = new URL(publishResponse.data.publicUrl, server.origin).toString();
  await page.goto(publicUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "published-report.png"), fullPage: true });

  const publishTransport = publishResponse.data.transport;
  const remoteManifest = await fetchWithRetry(publishTransport.remote_manifest_url);
  const remotePublishState = await fetchWithRetry(publishTransport.remote_publish_state_url);
  const remoteEmbedPayload = publishTransport.remote_embed_payload_url ? await fetchWithRetry(publishTransport.remote_embed_payload_url) : null;
  const remoteEmbedHtml = publishTransport.remote_embed_html_url ? await fetchWithRetry(publishTransport.remote_embed_html_url, "text") : null;
  const remoteExportHtml = publishTransport.remote_export_html_url ? await fetchWithRetry(publishTransport.remote_export_html_url, "text") : null;
  const remoteGatewayManifest = publishTransport.remote_gateway_manifest_url ? await fetchWithRetry(publishTransport.remote_gateway_manifest_url) : null;
  const remoteAccessLifecycle = publishTransport.remote_access_lifecycle_url ? await fetchWithRetry(publishTransport.remote_access_lifecycle_url) : null;
  const remoteDeliveryReceipt = publishTransport.remote_delivery_receipt_url ? await fetchWithRetry(publishTransport.remote_delivery_receipt_url) : null;
  const scheduleRun = runScheduleResponse.data[0];
  const remoteQueue = scheduleRun?.orchestration?.queue_ref ? await fetchWithRetry(scheduleRun.orchestration.queue_ref) : null;
  const remoteDispatch = scheduleRun?.orchestration?.remote_dispatch_ref ? await fetchWithRetry(scheduleRun.orchestration.remote_dispatch_ref) : null;
  const degradedRun = importedPdfRunSchedule.data[0];
  const degradedRemoteManifest = degradedRun?.degradedPublicationResult?.transport?.remote_manifest_url
    ? await fetchWithRetry(degradedRun.degradedPublicationResult.transport.remote_manifest_url)
    : null;

  if ((importedDocx.data.payload.table_count ?? 0) < 2 || (importedDocx.data.payload.chart_count ?? 0) < 2 || (importedDocx.data.payload.hyperlinks?.length ?? 0) < 2) {
    throw new Error("Complex DOCX fidelity proof is incomplete.");
  }
  if ((importedPdf.data.payload.table_count ?? 0) < 2 || (importedPdf.data.payload.chart_count ?? 0) < 1 || (importedPdf.data.payload.embedded_assets?.length ?? 0) < 2) {
    throw new Error("Complex PDF fidelity proof is incomplete.");
  }
  if (!remoteManifest || !remotePublishState || !remoteGatewayManifest || !remoteAccessLifecycle || !remoteDeliveryReceipt || !remoteQueue || !remoteDispatch || !degradedRemoteManifest) {
    throw new Error("Remote externalization proof is incomplete.");
  }

  writeJson("api/remote-manifest.json", remoteManifest);
  writeJson("api/remote-publish-state.json", remotePublishState);
  writeJson("api/remote-embed-payload.json", remoteEmbedPayload);
  writeText("api/remote-embed.html", remoteEmbedHtml ?? "");
  writeText("api/remote-export.html", remoteExportHtml ?? "");
  writeJson("api/remote-gateway-manifest.json", remoteGatewayManifest);
  writeJson("api/remote-access-lifecycle.json", remoteAccessLifecycle);
  writeJson("api/remote-delivery-receipt.json", remoteDeliveryReceipt);
  writeJson("api/remote-scheduler-queue.json", remoteQueue);
  writeJson("api/remote-scheduler-dispatch.json", remoteDispatch);
  writeJson("api/remote-degraded-manifest.json", degradedRemoteManifest);

  writeJson("records/complex-layout-comparison.json", {
    docx: {
      report_id: importedDocx.data.report_id,
      fixture_expected: importedDocx.data.fixture_metadata?.expected ?? null,
      actual: {
        pages: importedDocx.data.payload.page_count,
        sections: importedDocx.data.payload.section_count,
        tables: importedDocx.data.payload.table_count,
        charts: importedDocx.data.payload.chart_count,
        captions: importedDocx.data.payload.caption_count,
        hyperlinks: importedDocx.data.payload.hyperlinks?.length ?? 0,
        embedded_assets: importedDocx.data.payload.embedded_assets?.length ?? 0,
        editable_sections: importedDocxDetail.data.state.sections.length,
        editable_blocks: importedDocxDetail.data.state.contentBlocks.length
      }
    },
    pdf: {
      report_id: importedPdf.data.report_id,
      fixture_expected: importedPdf.data.fixture_metadata?.expected ?? null,
      actual: {
        pages: importedPdf.data.payload.page_count,
        sections: importedPdf.data.payload.section_count,
        tables: importedPdf.data.payload.table_count,
        charts: importedPdf.data.payload.chart_count,
        captions: importedPdf.data.payload.caption_count,
        hyperlinks: importedPdf.data.payload.hyperlinks?.length ?? 0,
        embedded_assets: importedPdf.data.payload.embedded_assets?.length ?? 0,
        editable_sections: importedPdfDetail.data.state.sections.length,
        editable_blocks: importedPdfDetail.data.state.contentBlocks.length
      }
    }
  });
  writeJson("records/remote-externalization-proof.json", {
    publication_id: publishResponse.data.publication.publication_id,
    remote_transport: publishTransport,
    remote_manifest: remoteManifest,
    remote_publish_state: remotePublishState,
    remote_embed_payload: remoteEmbedPayload,
    remote_gateway_manifest: remoteGatewayManifest,
    remote_access_lifecycle: remoteAccessLifecycle,
    remote_delivery_receipt: remoteDeliveryReceipt,
    remote_scheduler_queue: remoteQueue,
    remote_scheduler_dispatch: remoteDispatch,
    degraded_remote_manifest: degradedRemoteManifest
  });
  writeJson("records/summary.json", {
    runId,
    origin: server.origin,
    reportId,
    importedDocxReportId: importedDocx.data.report_id,
    importedPdfReportId: importedPdf.data.report_id,
    screenshots: [
      "browser/reports-home.png",
      "browser/complex-docx-detail.png",
      "browser/complex-pdf-detail.png",
      "browser/report-detail.png",
      "browser/published-report.png"
    ]
  });
} finally {
  if (browser) await browser.close();
  await server.close();
}

console.log(outputRoot);
