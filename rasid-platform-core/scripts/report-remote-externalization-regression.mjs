import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const platformModule = await load("packages/report-engine/dist/platform.js");
const { chromium } = await import("playwright-core");

const runId = `report-remote-externalization-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
const outputRoot = path.join(root, "packages", "report-engine", "artifacts", "latest-run", runId);
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outputRoot, "api"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "browser"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "records"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "evidence"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "audit"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "lineage"), { recursive: true });

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

const fetchWithRetry = async (url, mode = "json", attempts = 20, delayMs = 3000) => {
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

const writeStage = (prefix, stage) => {
  writeJson(`evidence/${prefix}.json`, stage.evidencePack);
  writeJson(`audit/${prefix}.json`, stage.auditEvents);
  writeJson(`lineage/${prefix}.json`, stage.lineageEdges);
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
    JSON.stringify({
      title: "Remote Externalization Proof",
      description: "Fresh proof for external orchestration, transport, and publication."
    })
  ]);
  const reportId = createResponse.data.report_id;
  writeJson("api/create.json", createResponse);

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
    JSON.stringify({ comment: "Fresh remote externalization proof review." })
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
    JSON.stringify({ comment: "Approval for remote externalization proof." })
  ]);
  writeJson("api/review.json", reviewResponse);
  writeJson("api/approve.json", approveResponse);

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
    JSON.stringify({ target_ref: "workspace://reports/remote-externalized" })
  ]);
  writeJson("api/publish.json", publishResponse);
  writeStage("publish", publishResponse.data);

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
    JSON.stringify({ next_run_at: "2026-03-16T06:00:00.000Z" })
  ]);
  writeJson("api/schedule.json", scheduleResponse);
  writeStage("schedule", scheduleResponse.data);

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
      next_run_at: "2026-03-16T06:00:00.000Z",
      publication_target_refs: ["unstable+gateway://reports/remote-externalized-scheduled"],
      export_profile_refs: ["export-profile://reports/html"],
      visibility_scope_ref: "workspace"
    })
  ]);
  writeJson("api/update-schedule.json", updateScheduleResponse);

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
  writeJson("api/run-schedule.json", runScheduleResponse);
  writeStage("schedule-runner", runScheduleResponse.data[0].runnerStage);

  const degradedPublishResponse = await curlJson([
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
    JSON.stringify({ reason: "Fresh degraded remote publication proof.", export_target: "html" })
  ]);
  writeJson("api/publish-degraded.json", degradedPublishResponse);
  writeStage("publish-degraded", degradedPublishResponse.data);

  const passTransport = publishResponse.data.transport;
  const degradedTransport = degradedPublishResponse.data.transport;
  const scheduleRun = runScheduleResponse.data[0];

  const passRemoteManifest = await fetchWithRetry(passTransport.remote_manifest_url);
  const passRemotePublishState = await fetchWithRetry(passTransport.remote_publish_state_url);
  const passRemoteEmbedPayload = await fetchWithRetry(passTransport.remote_embed_payload_url);
  const passRemoteGatewayManifest = await fetchWithRetry(passTransport.remote_gateway_manifest_url);
  const passRemoteAccessLifecycle = await fetchWithRetry(passTransport.remote_access_lifecycle_url);
  const passRemoteDeliveryReceipt = await fetchWithRetry(passTransport.remote_delivery_receipt_url);
  const passRemoteEmbedHtml = await fetchWithRetry(passTransport.remote_embed_html_url, "text");
  const passRemoteExportHtml = await fetchWithRetry(passTransport.remote_export_html_url, "text");

  const degradedRemoteManifest = await fetchWithRetry(degradedTransport.remote_manifest_url);
  const degradedRemotePublishState = await fetchWithRetry(degradedTransport.remote_publish_state_url);
  const degradedRemoteEmbedPayload = await fetchWithRetry(degradedTransport.remote_embed_payload_url);
  const degradedRemoteGatewayManifest = await fetchWithRetry(degradedTransport.remote_gateway_manifest_url);
  const degradedRemoteAccessLifecycle = await fetchWithRetry(degradedTransport.remote_access_lifecycle_url);
  const degradedRemoteDeliveryReceipt = await fetchWithRetry(degradedTransport.remote_delivery_receipt_url);
  const degradedRemoteEmbedHtml = await fetchWithRetry(degradedTransport.remote_embed_html_url, "text");
  const degradedRemoteExportHtml = await fetchWithRetry(degradedTransport.remote_export_html_url, "text");

  const remoteSchedulerQueue = await fetchWithRetry(scheduleRun.orchestration.queue_ref);
  const remoteSchedulerDispatch = await fetchWithRetry(scheduleRun.orchestration.remote_dispatch_ref);

  writeJson("api/remote-pass-manifest.json", passRemoteManifest);
  writeJson("api/remote-pass-publish-state.json", passRemotePublishState);
  writeJson("api/remote-pass-embed-payload.json", passRemoteEmbedPayload);
  writeJson("api/remote-pass-gateway-manifest.json", passRemoteGatewayManifest);
  writeJson("api/remote-pass-access-lifecycle.json", passRemoteAccessLifecycle);
  writeJson("api/remote-pass-delivery-receipt.json", passRemoteDeliveryReceipt);
  writeText("api/remote-pass-embed.html", passRemoteEmbedHtml);
  writeText("api/remote-pass-export.html", passRemoteExportHtml);
  writeJson("api/remote-degraded-manifest.json", degradedRemoteManifest);
  writeJson("api/remote-degraded-publish-state.json", degradedRemotePublishState);
  writeJson("api/remote-degraded-embed-payload.json", degradedRemoteEmbedPayload);
  writeJson("api/remote-degraded-gateway-manifest.json", degradedRemoteGatewayManifest);
  writeJson("api/remote-degraded-access-lifecycle.json", degradedRemoteAccessLifecycle);
  writeJson("api/remote-degraded-delivery-receipt.json", degradedRemoteDeliveryReceipt);
  writeText("api/remote-degraded-embed.html", degradedRemoteEmbedHtml);
  writeText("api/remote-degraded-export.html", degradedRemoteExportHtml);
  writeJson("api/remote-scheduler-queue.json", remoteSchedulerQueue);
  writeJson("api/remote-scheduler-dispatch.json", remoteSchedulerDispatch);

  if (!passTransport.remote_manifest_url || !passTransport.remote_embed_html_url || !passTransport.remote_export_html_url) {
    throw new Error("Pass remote transport URLs were not produced.");
  }
  if (!degradedTransport.remote_manifest_url || !degradedTransport.remote_embed_html_url || !degradedTransport.remote_export_html_url) {
    throw new Error("Degraded remote transport URLs were not produced.");
  }
  if ((scheduleRun.orchestration.retry_count ?? 0) < 1) {
    throw new Error("Remote scheduler proof did not capture a retry path.");
  }

  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  await context.addCookies([
    { name: "rasid_access_token", value: token, domain: "127.0.0.1", path: "/" },
    { name: "rasid_tenant_ref", value: "tenant-default", domain: "127.0.0.1", path: "/" }
  ]);
  const page = await context.newPage();
  await page.goto(`${server.origin}/reports/${reportId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "report-detail.png"), fullPage: true });
  await page.goto(new URL(publishResponse.data.publicUrl, server.origin).toString(), { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "published-report.png"), fullPage: true });
  await page.goto(passTransport.remote_embed_html_url, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "remote-pass-embed.png"), fullPage: true });
  await page.goto(degradedTransport.remote_embed_html_url, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputRoot, "browser", "remote-degraded-embed.png"), fullPage: true });

  writeJson("records/remote-externalization-proof.json", {
    report_id: reportId,
    local_publication: {
      publication_id: publishResponse.data.publication.publication_id,
      public_url: new URL(publishResponse.data.publicUrl, server.origin).toString(),
      runtime_path: path.join(root, ".runtime", "report-engine", "reports", reportId),
      backend_publication_root: passTransport.backend_publication_root,
      remote_bundle_ref: passTransport.remote_bundle_ref,
      remote_repository_ref: passTransport.remote_repository_ref,
      remote_urls: {
        manifest: passTransport.remote_manifest_url,
        publish_state: passTransport.remote_publish_state_url,
        embed_payload: passTransport.remote_embed_payload_url,
        embed_html: passTransport.remote_embed_html_url,
        export_html: passTransport.remote_export_html_url,
        gateway_manifest: passTransport.remote_gateway_manifest_url,
        access_lifecycle: passTransport.remote_access_lifecycle_url,
        delivery_receipt: passTransport.remote_delivery_receipt_url
      }
    },
    degraded_publication: {
      publication_id: degradedPublishResponse.data.publication.publication_id,
      public_url: new URL(degradedPublishResponse.data.publicUrl, server.origin).toString(),
      backend_publication_root: degradedTransport.backend_publication_root,
      remote_bundle_ref: degradedTransport.remote_bundle_ref,
      remote_repository_ref: degradedTransport.remote_repository_ref,
      remote_urls: {
        manifest: degradedTransport.remote_manifest_url,
        publish_state: degradedTransport.remote_publish_state_url,
        embed_payload: degradedTransport.remote_embed_payload_url,
        embed_html: degradedTransport.remote_embed_html_url,
        export_html: degradedTransport.remote_export_html_url,
        gateway_manifest: degradedTransport.remote_gateway_manifest_url,
        access_lifecycle: degradedTransport.remote_access_lifecycle_url,
        delivery_receipt: degradedTransport.remote_delivery_receipt_url
      }
    },
    remote_scheduler: {
      schedule_id: scheduleId,
      orchestration_id: scheduleRun.orchestration.orchestration_id,
      retry_count: scheduleRun.orchestration.retry_count,
      queue_ref: scheduleRun.orchestration.queue_ref,
      remote_dispatch_ref: scheduleRun.orchestration.remote_dispatch_ref,
      backend_scheduler_root: path.join(root, ".runtime", "report-engine-backend", "scheduler", scheduleRun.orchestration.orchestration_id.replace(/[^a-zA-Z0-9_-]+/g, "-"))
    }
  });
  writeJson("records/summary.json", {
    runId,
    origin: server.origin,
    reportId,
    publicationId: publishResponse.data.publication.publication_id,
    degradedPublicationId: degradedPublishResponse.data.publication.publication_id,
    scheduleId,
    orchestrationId: scheduleRun.orchestration.orchestration_id,
    screenshots: [
      "browser/report-detail.png",
      "browser/published-report.png",
      "browser/remote-pass-embed.png",
      "browser/remote-degraded-embed.png"
    ]
  });
} finally {
  if (browser) await browser.close();
  await server.close();
}

console.log(outputRoot);
