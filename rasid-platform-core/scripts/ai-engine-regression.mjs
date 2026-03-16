import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright-core";
import { RasidAiEngine } from "@rasid/ai-engine";
import { DashboardEngine } from "@rasid/dashboard-engine";

const host = "127.0.0.1";
const allocatePort = () =>
  new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.on("error", reject);
  server.listen(0, host, () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close(() => reject(new Error("failed to allocate ai-engine proof port")));
      return;
    }
    const allocatedPort = address.port;
    server.close((error) => (error ? reject(error) : resolve(allocatedPort)));
  });
});
const port = await allocatePort();
const transportPort = await allocatePort();
const transcriptionPort = await allocatePort();
const presentationsPort = await allocatePort();
const baseUrl = `http://${host}:${port}`;
const transcriptionBaseUrl = `http://${host}:${transcriptionPort}`;
const presentationsBaseUrl = `http://${host}:${presentationsPort}`;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const proofRoot = path.join(process.cwd(), ".runtime", "ai-engine-proof", `run-${stamp}`);
const proofFile = path.join(proofRoot, "ai-engine-regression.json");
const latestProofFile = path.join(process.cwd(), ".runtime", "ai-engine-proof", "ai-engine-regression.json");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const aiStoreRoot = path.join(process.cwd(), ".runtime", "dashboard-web", "ai-engine");
const dashboardRuntimeJobsRoot = path.join(process.cwd(), ".runtime", "dashboard-web", "ai-engine", "jobs");
const transcriptionRuntimeJobsRoot = path.join(process.cwd(), ".runtime", "transcription-web", "ai-engine", "jobs");
const transcriptionFixturesRoot = path.join(process.cwd(), ".runtime", "transcription-web-proof", "fixtures");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};
const slug = (value) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
const step = (message) => console.log(`[ai-engine-regression] ${message}`);

const requestJson = (targetHost, targetPort, targetPath, method = "GET", headers = {}, body = undefined, attempt = 0) =>
  new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request(
      {
        host: targetHost,
        port: targetPort,
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
            reject(new Error(`API ${method} ${targetPath} failed with ${statusCode}: ${text.slice(0, 500)}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(new Error(`Invalid JSON response from ${targetPath}: ${text.slice(0, 500)} (${error.message})`));
          }
        });
      }
    );
    request.setTimeout(900000, () => {
      request.destroy(new Error(`Request timed out for ${method} ${targetPath}`));
    });
    request.on("error", async (error) => {
      if (attempt < 2 && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"].includes(error.code ?? "")) {
        await wait(500 * (attempt + 1));
        resolve(await requestJson(targetHost, targetPort, targetPath, method, headers, body, attempt + 1));
        return;
      }
      reject(error);
    });
    if (payload) {
      request.write(payload);
    }
    request.end();
  });

const waitForServer = async (targetHost, targetPort, targetPath = "/login") => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await new Promise((resolve, reject) => {
        const request = http.request({ host: targetHost, port: targetPort, path: targetPath, method: "GET" }, (result) => resolve(result.statusCode ?? 0));
        request.setTimeout(10000, () => request.destroy(new Error("waitForServer timeout")));
        request.on("error", reject);
        request.end();
      });
      if (response >= 200 && response < 500) {
        return;
      }
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error("ai engine web server did not start");
};

const runtimePaths = (jobsRoot, jobId) => {
  const root = path.join(jobsRoot, jobId);
  return {
    root,
    summary: path.join(root, "summary.json"),
    result: path.join(root, "result.json"),
    artifacts: path.join(root, "artifacts.json"),
    evidence: path.join(root, "evidence", `evidence-${jobId}.json`),
    audit: path.join(root, "audit", "audit-events.json"),
    lineage: path.join(root, "lineage", "lineage-edges.json")
  };
};

const filePresence = (paths) =>
  Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, key === "root" ? fs.existsSync(filePath) : fs.existsSync(filePath)]));

ensureDir(proofRoot);
let browser;
let presentationsHandle = null;
let dashboardHandle = null;
let transcriptionHandle = null;

try {
  step(`starting live proof on ${baseUrl}`);
  process.env.RASID_DASHBOARD_WEB_PORT = String(port);
  process.env.RASID_DASHBOARD_TRANSPORT_PORT = String(transportPort);
  process.env.RASID_DEBUG_STACKS = "1";
  process.env.RASID_TRANSCRIPTION_WEB_PORT = String(transcriptionPort);
  const { startDashboardWebApp } = await import("../apps/contracts-cli/dist/dashboard-web.js");
  const { startTranscriptionWebApp } = await import("../apps/contracts-cli/dist/transcription-web.js");
  dashboardHandle = startDashboardWebApp({ host, port });
  transcriptionHandle = startTranscriptionWebApp({ host, port: transcriptionPort });
  await waitForServer(host, port, "/login");
  await waitForServer(host, transcriptionPort, "/login");
  const { startPresentationPlatformServer } = await import("../packages/presentations-engine/dist/platform.js");
  presentationsHandle = await startPresentationPlatformServer({ host, port: presentationsPort });

  browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const transcriptionPage = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const presentationsPage = await browser.newPage({ viewport: { width: 1440, height: 1080 } });

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", "admin");
  await page.fill("#password", "1500");
  await page.fill("#tenant", "tenant-dashboard-web");
  await page.click("#login");
  await page.waitForURL(`${baseUrl}/data`, { timeout: 120000, waitUntil: "domcontentloaded" });

  await transcriptionPage.goto(`${transcriptionBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  await transcriptionPage.fill('input[name="email"]', "admin");
  await transcriptionPage.fill('input[name="password"]', "1500");
  await transcriptionPage.fill('input[name="tenant_ref"]', "tenant-transcription-web");
  await transcriptionPage.click("button");
  await transcriptionPage.waitForURL(`${transcriptionBaseUrl}/transcription`, { timeout: 120000, waitUntil: "domcontentloaded" });

  await presentationsPage.goto(`${presentationsBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  await presentationsPage.fill('input[name="email"]', "admin");
  await presentationsPage.fill('input[name="password"]', "1500");
  await presentationsPage.fill('input[name="tenantRef"]', "tenant-dashboard-web");
  await presentationsPage.click('button[type="submit"]');
  await presentationsPage.waitForURL((currentUrl) => currentUrl.toString().startsWith(`${presentationsBaseUrl}/presentations`), { timeout: 120000 });
  const presentationsAuthQuery = new URL(presentationsPage.url()).search;

  const createBrowserJson = (activePage, origin, defaultHeaders = {}) => async (method, url, body = undefined, extraHeaders = {}) => {
    const response = await activePage.context().request.fetch(`${origin}${url}`, {
      method,
      timeout: 900000,
      headers: {
        "content-type": "application/json",
        ...defaultHeaders,
        ...extraHeaders
      },
      data: body
    });
    const json = await response.json();
    if (!response.ok()) {
      throw new Error(JSON.stringify(json));
    }
    return json;
  };

  const browserJson = createBrowserJson(page, baseUrl);
  const transcriptionBrowserJson = createBrowserJson(transcriptionPage, transcriptionBaseUrl);

  const createBrowserText = (activePage, origin) => async (url) => {
    const response = await activePage.context().request.fetch(`${origin}${url}`, { method: "GET", timeout: 120000 });
    return { status: response.status(), text: await response.text() };
  };
  const browserText = createBrowserText(page, baseUrl);

  const pages = [
    "/data",
    "/transcription",
    "/excel",
    "/dashboards",
    "/reports",
    "/presentations",
    "/replication",
    "/localization",
    "/library",
    "/governance"
  ];

  const pageSurfaceChecks = [];
  for (const pagePath of pages) {
    const html = await browserText(pagePath);
    pageSurfaceChecks.push({
      page: pagePath,
      status: html.status,
      has_ai_surface: html.text.includes(`data-ai-page="${pagePath}"`),
      has_ai_result_panel: html.text.includes('id="ai-result"'),
      has_ai_jobs_panel: html.text.includes('id="ai-jobs"')
    });
  }

  const bridgeSuccess = await browserJson("POST", "/api/v1/ai/providers/live-translation", {
    source_locale: "en",
    target_locale: "ar",
    items: [{ node_id: "bridge-success", text: "Monthly revenue grew steadily." }]
  });
  const bridgeFallback = await browserJson(
    "POST",
    "/api/v1/ai/providers/live-translation",
    {
      source_locale: "en",
      target_locale: "ar",
      items: [{ node_id: "bridge-fallback", text: "Fallback path must remain auditable." }],
      force_primary_failure: true
    },
    { "x-force-primary-failure": "1" }
  );

  const readAiResult = async (timeoutMs = 8000) => {
    try {
      await page.waitForFunction(
        () => {
          const node = document.getElementById("ai-result");
          return Boolean(node && node.textContent && node.textContent.includes("capability:"));
        },
        { timeout: timeoutMs }
      );
    } catch {
      // leave best-effort text extraction in place
    }
    return page.evaluate(() => document.getElementById("ai-result")?.textContent ?? "");
  };

  const runUiCase = async ({
    name,
    pagePath,
    prompt,
    approval = false,
    resourceRef = null,
    extraQuery = {}
  }) => {
    step(`ui case ${name} -> ${pagePath}`);
    const sessionId = `session-${slug(name)}-${Date.now()}`;
    const url = new URL(`${baseUrl}${pagePath}`);
    for (const [key, value] of Object.entries(extraQuery)) {
      if (value !== null && value !== undefined && String(value).length > 0) {
        url.searchParams.set(key, String(value));
      }
    }
    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await page.fill("#ai-session-id", sessionId);
    await page.fill("#ai-prompt", prompt);
    await page.fill("#ai-resource-ref", resourceRef ?? "");
    const checked = await page.locator("#ai-approval").isChecked();
    if (checked !== approval) {
      await page.click("#ai-approval");
    }
    const entryScreenshot = path.join(proofRoot, `${slug(name)}-entry.png`);
    await page.screenshot({ path: entryScreenshot, fullPage: true });
    const postPromise = page.waitForResponse(
      (response) => {
        const request = response.request();
        return response.url() === `${baseUrl}/api/v1/ai/jobs` && request.method() === "POST";
      },
      { timeout: 180000 }
    );
    await page.click("#ai-run");
    const postResponse = await postPromise;
    if (!postResponse.ok()) {
      throw new Error(`UI case ${name} failed with ${postResponse.status()}: ${await postResponse.text()}`);
    }
    let latestJob = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const listed = await browserJson("GET", `/api/v1/ai/jobs?session_id=${encodeURIComponent(sessionId)}`);
      latestJob = Array.isArray(listed.jobs) ? listed.jobs[0] : null;
      if (latestJob?.job_id) {
        break;
      }
      await wait(250);
    }
    if (!latestJob?.job_id) {
      throw new Error(`No AI job was persisted for session ${sessionId}.`);
    }
    const payload = await browserJson("GET", `/api/v1/ai/jobs/${latestJob.job_id}`);
    if (payload.open_path) {
      const redirectTarget = `${baseUrl}${payload.open_path}`;
      await page.waitForURL(
        (currentUrl) => currentUrl.toString().startsWith(redirectTarget.split("?ai_job_id=")[0]),
        { timeout: 10000 }
      ).catch(() => wait(1000));
      await page.goto(redirectTarget, { waitUntil: "networkidle" }).catch(() => null);
    }
    const resultText = await readAiResult();
    const resultScreenshot = path.join(proofRoot, `${slug(name)}-result.png`);
    await page.screenshot({ path: resultScreenshot, fullPage: true });
    return {
      sessionId,
      payload,
      currentUrl: page.url(),
      resultText,
      screenshots: {
        entry: entryScreenshot,
        result: resultScreenshot
      }
    };
  };

  const captureApprovedPath = async (name, openPath) => {
    step(`capture approved path ${name}`);
    await page.goto(`${baseUrl}${openPath}`, { waitUntil: "networkidle" });
    const resultText = await readAiResult();
    const screenshot = path.join(proofRoot, `${slug(name)}-approved.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return { url: page.url(), resultText, screenshot };
  };

  const transcriptionFixtures = {
    audio: path.join(transcriptionFixturesRoot, "meeting-audio.wav"),
    video: path.join(transcriptionFixturesRoot, "meeting-video.mp4"),
    scannedPdf: path.join(transcriptionFixturesRoot, "scanned-document.pdf"),
    revisedPdf: path.join(transcriptionFixturesRoot, "revised-document.pdf"),
    tableImage: path.join(transcriptionFixturesRoot, "table-image.png"),
    workbook: path.join(transcriptionFixturesRoot, "evidence-workbook.xlsx"),
    revisedWorkbook: path.join(transcriptionFixturesRoot, "revised-workbook.xlsx")
  };

  Object.values(transcriptionFixtures).forEach((filePath) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing transcription fixture required for hostile revalidation: ${filePath}`);
    }
  });

  const toTranscriptionUpload = (filePaths) =>
    filePaths.map((filePath) => ({
      file_name: path.basename(filePath),
      media_type:
        filePath.endsWith(".wav")
          ? "audio/wav"
          : filePath.endsWith(".mp4")
            ? "video/mp4"
            : filePath.endsWith(".pdf")
              ? "application/pdf"
              : filePath.endsWith(".xlsx")
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "image/png",
      content_base64: fs.readFileSync(filePath).toString("base64")
    }));

  const runTranscriptionAiCase = async () => {
    step("ui case transcription-independent-compare");
    const firstJob = await transcriptionBrowserJson("POST", "/api/v1/transcription/jobs/start", {
      mode: "advanced",
      files: toTranscriptionUpload([
        transcriptionFixtures.audio,
        transcriptionFixtures.video,
        transcriptionFixtures.scannedPdf,
        transcriptionFixtures.tableImage,
        transcriptionFixtures.workbook
      ])
    });
    const secondJob = await transcriptionBrowserJson("POST", "/api/v1/transcription/jobs/start", {
      mode: "advanced",
      files: toTranscriptionUpload([
        transcriptionFixtures.audio,
        transcriptionFixtures.revisedPdf,
        transcriptionFixtures.tableImage,
        transcriptionFixtures.revisedWorkbook
      ])
    });
    const firstJobId = firstJob.job.job_id;
    const secondJobId = secondJob.job.job_id;
    await transcriptionPage.goto(`${transcriptionBaseUrl}/transcription`, { waitUntil: "networkidle" }).catch(() => null);
    await transcriptionPage.fill("#ai-session-id", `session-transcription-${Date.now()}`);
    await transcriptionPage.fill("#ai-resource-ref", String(firstJob.bundle.bundle_id ?? ""));
    await transcriptionPage.fill("#ai-prompt", "قارن بين آخر ملفين واستخرج الاختلافات الجوهرية");
    const aiChecked = await transcriptionPage.locator("#ai-approval").isChecked();
    if (!aiChecked) {
      await transcriptionPage.click("#ai-approval");
    }
    const entryScreenshot = path.join(proofRoot, "transcription-independent-entry.png");
    await transcriptionPage.screenshot({ path: entryScreenshot, fullPage: true });
    const responsePromise = transcriptionPage.waitForResponse(
      (response) => response.url() === `${transcriptionBaseUrl}/api/v1/ai/jobs` && response.request().method() === "POST",
      { timeout: 180000 }
    );
    await transcriptionPage.click("#ai-run");
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`Transcription AI case failed with ${response.status()}: ${await response.text()}`);
    }
    const payload = await response.json();
    if (payload.open_path) {
      await transcriptionPage
        .waitForURL((currentUrl) => currentUrl.toString().startsWith(`${transcriptionBaseUrl}/transcription`), { timeout: 10000 })
        .catch(() => wait(1000));
      await transcriptionPage.goto(`${transcriptionBaseUrl}${payload.open_path}`, { waitUntil: "domcontentloaded" }).catch(() => null);
      await wait(1000);
    }
    await transcriptionPage.waitForFunction(
      () => {
        const node = document.getElementById("ai-result");
        return Boolean(node && node.textContent && node.textContent.includes("capability:"));
      },
      { timeout: 120000 }
    );
    const resultText = await transcriptionPage.evaluate(() => document.getElementById("ai-result")?.textContent ?? "");
    const resultScreenshot = path.join(proofRoot, "transcription-independent-result.png");
    await transcriptionPage.screenshot({ path: resultScreenshot, fullPage: true });
    const job = await collectJob(
      "transcription-independent-compare",
      payload,
      {
        currentUrl: transcriptionPage.url(),
        resultText,
        screenshots: { entry: entryScreenshot, result: resultScreenshot },
        source_jobs: [firstJobId, secondJobId],
        bundle_refs: [firstJob.bundle.bundle_id, secondJob.bundle.bundle_id]
      },
      { browserJson: transcriptionBrowserJson, jobsRoot: transcriptionRuntimeJobsRoot }
    );
    return { firstJobId, secondJobId, job };
  };

  const collectJob = async (label, payload, ui = null, options = {}) => {
    step(`collect job ${label} (${payload.job_id})`);
    const jobId = payload.job_id;
    const fetchJson = options.browserJson ?? browserJson;
    const jobsRoot = options.jobsRoot ?? dashboardRuntimeJobsRoot;
    const detail = await fetchJson("GET", `/api/v1/ai/jobs/${jobId}`);
    const status = await fetchJson("GET", `/api/v1/ai/jobs/${jobId}/status`);
    const result = await fetchJson("GET", `/api/v1/ai/jobs/${jobId}/result`);
    const evidence = await fetchJson("GET", `/api/v1/ai/jobs/${jobId}/evidence`);
    const audit = await fetchJson("GET", `/api/v1/ai/jobs/${jobId}/audit`);
    const lineage = await fetchJson("GET", `/api/v1/ai/jobs/${jobId}/lineage`);
    const paths = runtimePaths(jobsRoot, jobId);
    const artifacts = fs.existsSync(paths.artifacts) ? JSON.parse(fs.readFileSync(paths.artifacts, "utf8")) : [];
    return {
      label,
      job_id: jobId,
      source_page: detail.page_path,
      session_id: detail.context.session_id,
      ui,
      plan: {
        agent: detail.plan.selected_agent,
        capability: detail.plan.selected_capability,
        action: detail.plan.selected_action_ref,
        tool: detail.plan.selected_tool_ref,
        engine: detail.plan.selected_engine_ref
      },
      summary: {
        approval_state: detail.summary.approval_state,
        outcome: detail.summary.outcome,
        degrade_classification: detail.summary.degrade_classification,
        provider_ref: detail.summary.selected_provider_ref,
        model_ref: detail.summary.selected_model_ref,
        fallback_used: detail.summary.fallback_used,
        fallback_reason: detail.summary.fallback_reason,
        failure_summaries: detail.summary.failure_summaries,
        execution_steps: detail.summary.execution_step_details,
        artifact_refs: detail.summary.result_artifact_refs,
        audit_refs: detail.summary.audit_refs,
        lineage_refs: detail.summary.lineage_refs
      },
      output: {
        artifact_count: Array.isArray(artifacts) ? artifacts.length : 0,
        artifact_refs: Array.isArray(artifacts) ? artifacts.map((artifact) => artifact.artifact_id) : [],
        artifact_subtypes: Array.isArray(artifacts) ? artifacts.map((artifact) => artifact.artifact_subtype) : [],
        artifact_storage_uris: Array.isArray(artifacts) ? artifacts.map((artifact) => artifact.storage_ref?.uri ?? null) : [],
        path: paths.artifacts
      },
      evidence: {
        verification_status: evidence.verification_status,
        checks_executed: evidence.checks_executed.map((check) => ({
          check_name: check.check_name,
          passed: check.passed,
          details: check.details
        })),
        failure_reasons: evidence.failure_reasons,
        warnings: evidence.warnings,
        path: paths.evidence
      },
      audit: {
        count: audit.length,
        event_types: audit.map((event) => event.event_type),
        path: paths.audit
      },
      lineage: {
        count: lineage.length,
        relations: lineage.map((edge) => edge.relationship_type),
        path: paths.lineage
      },
      status: {
        state: status.state,
        stage: status.stage
      },
      endpoints: detail.endpoints,
      runtime: {
        ...paths,
        exists: filePresence(paths)
      }
    };
  };

  const dataCase = await runUiCase({
    name: "data-dashboard-apply",
    pagePath: "/data",
    prompt: "حلل هذه البيانات وأنشئ dashboard تنفيذي لأهم المؤشرات",
    approval: true
  });
  const dataJob = await collectJob("data-dashboard-apply", dataCase.payload, dataCase);
  const dashboardId = new URL(`${baseUrl}${dataCase.payload.open_path}`).searchParams.get("dashboard_id");

  const excelPendingCase = await runUiCase({
    name: "excel-pending-apply",
    pagePath: "/excel",
    prompt: "أنشئ pivot chart لهذا workbook ونظف البيانات",
    approval: false
  });
  const excelPendingJob = await collectJob("excel-pending-apply", excelPendingCase.payload, excelPendingCase);
  step(`approve job ${excelPendingCase.payload.job_id}`);
  const excelApprovedPayload = await browserJson("POST", `/api/v1/ai/jobs/${excelPendingCase.payload.job_id}/approve`, {});
  const excelApprovedUi = await captureApprovedPath("excel-pending-apply", excelApprovedPayload.open_path);
  const excelApprovedJob = await collectJob("excel-approved-apply", excelApprovedPayload, excelApprovedUi);

  const dashboardCase = await runUiCase({
    name: "dashboards-report-apply",
    pagePath: "/dashboards",
    prompt: "حول هذه اللوحة إلى تقرير يلخص المقارنة بين المناطق والفترات",
    approval: true,
    resourceRef: dashboardId,
    extraQuery: { dashboard_id: dashboardId }
  });
  const dashboardJob = await collectJob("dashboards-report-apply", dashboardCase.payload, dashboardCase);

  const reportsPendingCase = await runUiCase({
    name: "reports-pending-dashboard-conversion",
    pagePath: "/reports",
    prompt: "حوّل هذا التقرير إلى dashboard للمقارنة بين الفترات",
    approval: false
  });
  const reportsPendingJob = await collectJob("reports-pending-dashboard-conversion", reportsPendingCase.payload, reportsPendingCase);
  step(`approve job ${reportsPendingCase.payload.job_id}`);
  const reportsApprovedPayload = await browserJson("POST", `/api/v1/ai/jobs/${reportsPendingCase.payload.job_id}/approve`, {});
  const reportsApprovedUi = await captureApprovedPath("reports-pending-dashboard-conversion", reportsApprovedPayload.open_path);
  const reportsApprovedJob = await collectJob("reports-approved-dashboard-conversion", reportsApprovedPayload, reportsApprovedUi);

  const presentationCase = await runUiCase({
    name: "presentations-deck-apply",
    pagePath: "/presentations",
    prompt: "أنشئ عرضًا تنفيذيًا من خمس شرائح لهذا الملخص",
    approval: true
  });
  const presentationJob = await collectJob("presentations-deck-apply", presentationCase.payload, presentationCase);
  const presentationDeckId = new URL(`${baseUrl}${presentationCase.payload.open_path}`).searchParams.get("deck_id");
  if (!presentationDeckId) {
    throw new Error("Presentation AI flow did not return a deck_id.");
  }
  await presentationsPage.goto(`${presentationsBaseUrl}/presentations/${encodeURIComponent(presentationDeckId)}${presentationsAuthQuery}`, { waitUntil: "domcontentloaded" }).catch(() => null);
  await wait(5000);
  const presentationDetailScreenshot = path.join(proofRoot, "presentations-platform-detail.png");
  await presentationsPage.screenshot({ path: presentationDetailScreenshot, fullPage: true });
  const presentationPlatformStatePath = path.join(process.cwd(), ".runtime", "presentations-engine", "decks", presentationDeckId, "platform", "state.json");
  if (!fs.existsSync(presentationPlatformStatePath)) {
    throw new Error(`Presentation platform state was not materialized for ${presentationDeckId}.`);
  }
  const presentationPlatformState = JSON.parse(fs.readFileSync(presentationPlatformStatePath, "utf8"));
  const publicViewerPath = `/published/${presentationDeckId}?share_token=${encodeURIComponent(presentationPlatformState.live_share_token)}`;
  await presentationsPage.goto(`${presentationsBaseUrl}${publicViewerPath}`, { waitUntil: "networkidle" });
  await presentationsPage.waitForSelector("#viewerFrame", { timeout: 120000 });
  const presentationPublicScreenshot = path.join(proofRoot, "presentations-platform-public-viewer.png");
  await presentationsPage.screenshot({ path: presentationPublicScreenshot, fullPage: true });

  const replicationPendingCase = await runUiCase({
    name: "replication-pending-strict-apply",
    pagePath: "/replication",
    prompt: "شخّص فروقات strict replication ثم نفذ مسار التحقق الكامل",
    approval: false
  });
  const replicationPendingJob = await collectJob("replication-pending-strict-apply", replicationPendingCase.payload, replicationPendingCase);
  step(`approve job ${replicationPendingCase.payload.job_id}`);
  const replicationApprovedPayload = await browserJson("POST", `/api/v1/ai/jobs/${replicationPendingCase.payload.job_id}/approve`, {});
  const replicationApprovedUi = await captureApprovedPath("replication-pending-strict-apply", replicationApprovedPayload.open_path);
  const replicationApprovedJob = await collectJob("replication-approved-strict-apply", replicationApprovedPayload, replicationApprovedUi);

  const localizationPendingCase = await runUiCase({
    name: "localization-pending-publish",
    pagePath: "/localization",
    prompt: "عرّب هذا التقرير إلى العربية الرسمية مع حماية المصطلحات",
    approval: false
  });
  const localizationPendingJob = await collectJob("localization-pending-publish", localizationPendingCase.payload, localizationPendingCase);
  step(`approve job ${localizationPendingCase.payload.job_id}`);
  const localizationApprovedPayload = await browserJson("POST", `/api/v1/ai/jobs/${localizationPendingCase.payload.job_id}/approve`, {});
  const localizationApprovedUi = await captureApprovedPath("localization-pending-publish", localizationApprovedPayload.open_path);
  const localizationApprovedJob = await collectJob("localization-approved-publish", localizationApprovedPayload, localizationApprovedUi);

  const localizationFallbackCase = await runUiCase({
    name: "localization-provider-fallback",
    pagePath: "/localization",
    prompt: "[force-provider-fallback] عرّب هذا التقرير إلى العربية الرسمية مع حماية المصطلحات",
    approval: true
  });
  const localizationFallbackJob = await collectJob("localization-provider-fallback", localizationFallbackCase.payload, localizationFallbackCase);

  const transcriptionIndependent = await runTranscriptionAiCase();

  const libraryCase = await runUiCase({
    name: "library-document-understanding",
    pagePath: "/library",
    prompt: "استخرج الحقول الرئيسية من هذا الملف PDF ولخص الأقسام الرئيسية",
    approval: false
  });
  const libraryJob = await collectJob("library-document-understanding", libraryCase.payload, libraryCase);

  const governanceAssistiveCase = await runUiCase({
    name: "governance-assistive-review",
    pagePath: "/governance",
    prompt: "راجع الحوكمة والصلاحيات وفسر evidence وaudit وlineage",
    approval: false
  });
  const governanceAssistiveJob = await collectJob("governance-assistive-review", governanceAssistiveCase.payload, governanceAssistiveCase);
  const permissionFailureBundle = await new RasidAiEngine({ storageDir: aiStoreRoot }).submitJob({
    session_id: `session-permission-denied-${Date.now()}`,
    page_path: "/reports",
    user_prompt: "حوّل هذا التقرير إلى dashboard للمقارنة بين الفترات",
    tenant_ref: "tenant-dashboard-web",
    workspace_id: "workspace-dashboard-web",
    project_id: "project-dashboard-web",
    actor_ref: "ai-engine-regression-failure",
    requested_mode: "advanced",
    approval_granted: true,
    resource_ref: null,
    resource_refs: [],
    current_artifact_ref: null,
    context_payload: { report_summary: { seeded: true } },
    permission_scope: {
      visibility: "workspace",
      allow_read: true,
      allow_write: false,
      allow_share: false,
      allow_publish: false,
      allow_audit_view: true
    },
    governance_tags: ["failure_proof", "permission_denied"]
  });
  const permissionFailureUi = await captureApprovedPath(
    "reports-permission-denied",
    `/reports?ai_job_id=${encodeURIComponent(permissionFailureBundle.job.job_id)}`
  );
  const permissionFailureJob = await collectJob(
    "reports-permission-denied",
    { job_id: permissionFailureBundle.job.job_id },
    permissionFailureUi
  );

  const proof = {
    generated_at: new Date().toISOString(),
    live_environment: {
      base_url: baseUrl,
      proof_root: proofRoot,
      pages_checked: pageSurfaceChecks
    },
    live_provider_architecture: {
      bridge_success: {
        selected_provider_ref: bridgeSuccess.selected_provider_ref,
        selected_model_ref: bridgeSuccess.selected_model_ref,
        fallback_used: bridgeSuccess.fallback_used,
        fallback_reason: bridgeSuccess.fallback_reason,
        provider_trace: bridgeSuccess.provider_trace
      },
      bridge_fallback: {
        selected_provider_ref: bridgeFallback.selected_provider_ref,
        selected_model_ref: bridgeFallback.selected_model_ref,
        fallback_used: bridgeFallback.fallback_used,
        fallback_reason: bridgeFallback.fallback_reason,
        provider_trace: bridgeFallback.provider_trace
      },
      localization_success_job: localizationApprovedJob,
      localization_fallback_job: localizationFallbackJob
    },
    editable_apply_remaining_engines: {
      excel_engine: {
        pending: excelPendingJob,
        approved: excelApprovedJob
      },
      report_engine: {
        pending: reportsPendingJob,
        approved: reportsApprovedJob
      },
      arabic_localization_lct_engine: {
        pending: localizationPendingJob,
        approved: localizationApprovedJob,
        fallback: localizationFallbackJob
      },
      strict_replication_engine: {
        pending: replicationPendingJob,
        approved: replicationApprovedJob
      }
    },
    nlq_multi_step_execution_depth: {
      excel: excelApprovedJob,
      dashboards: dashboardJob,
      reports: reportsApprovedJob,
      localization: localizationApprovedJob
    },
    agent_coverage: {
      data_analyst_agent: dataJob,
      excel_assistant: excelApprovedJob,
      dashboard_assistant: dashboardJob,
      reporting_assistant: reportsApprovedJob,
      presentation_assistant: presentationJob,
      localization_assistant: localizationApprovedJob,
      governance_aware_assistant: governanceAssistiveJob,
      document_file_understanding_assistant: libraryJob,
      replication_aware_assistant: replicationApprovedJob
    },
    key_surface_behavior: {
      "/data": dataJob,
      "/transcription": transcriptionIndependent.job,
      "/excel": excelApprovedJob,
      "/dashboards": dashboardJob,
      "/reports": reportsApprovedJob,
      "/presentations": presentationJob,
      "/replication": replicationApprovedJob,
      "/localization": localizationApprovedJob,
      "/library": libraryJob,
      "/governance": governanceAssistiveJob
    },
    explainability: {
      transcription_ui_excerpt: transcriptionIndependent.job.ui.resultText,
      localization_success_ui_excerpt: localizationApprovedUi.resultText,
      localization_fallback_ui_excerpt: localizationFallbackCase.resultText,
      permission_failure_ui_excerpt: permissionFailureUi.resultText
    },
    independent_runtime_flows: {
      transcription: transcriptionIndependent,
      presentations_platform: {
        deck_id: presentationDeckId,
        detail_url: `${presentationsBaseUrl}/presentations/${encodeURIComponent(presentationDeckId)}`,
        public_url: `${presentationsBaseUrl}${publicViewerPath}`,
        detail_screenshot: presentationDetailScreenshot,
        public_screenshot: presentationPublicScreenshot,
        platform_state_path: presentationPlatformStatePath,
        platform_state: presentationPlatformState
      }
    },
    no_auto_apply_boundary: {
      excel_engine: excelPendingJob,
      report_engine: reportsPendingJob,
      arabic_localization_lct_engine: localizationPendingJob,
      strict_replication_engine: replicationPendingJob
    },
    permission_failure: permissionFailureJob
  };

  const requireTrue = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
  };

  requireTrue(pageSurfaceChecks.every((check) => check.status === 200 && check.has_ai_surface && check.has_ai_result_panel), "One or more AI surfaces are missing from the required pages.");

  requireTrue(dataJob.plan.agent === "data_analyst_agent" && dataJob.plan.capability === "dashboards" && dataJob.plan.tool === "registry.dashboard.create", "Data analyst agent routing is incorrect.");
  requireTrue(transcriptionIndependent.job.plan.agent === "document_file_understanding_assistant" && transcriptionIndependent.job.plan.capability === "transcription_extraction" && transcriptionIndependent.job.plan.tool === "registry.transcription.compare", "Independent transcription AI routing is incorrect.");
  requireTrue(excelApprovedJob.plan.agent === "excel_assistant" && excelApprovedJob.plan.capability === "excel_engine" && excelApprovedJob.output.artifact_count > 1, "Excel assistant apply path did not produce editable outputs.");
  requireTrue(dashboardJob.plan.agent === "dashboard_assistant" && dashboardJob.plan.capability === "reports" && dashboardJob.output.artifact_count > 1, "Dashboard assistant did not orchestrate into report-engine.");
  requireTrue(reportsApprovedJob.plan.agent === "reporting_assistant" && reportsApprovedJob.summary.execution_steps.includes("reports.convert_report_to_dashboard"), "Reporting assistant did not convert a report into a dashboard path.");
  requireTrue(presentationJob.plan.agent === "presentation_assistant" && presentationJob.plan.tool === "registry.presentations.generate_deck", "Presentation assistant tool selection is incomplete.");
  requireTrue(
    typeof presentationPlatformState.live_share_token === "string" &&
      presentationPlatformState.live_share_token.length > 0 &&
      publicViewerPath.includes(`/published/${presentationDeckId}`),
    "Presentation publish/share path was not verifiable through the live presentations platform."
  );
  requireTrue(localizationApprovedJob.plan.agent === "localization_assistant" && localizationApprovedJob.summary.provider_ref, "Localization assistant did not record a live provider/model.");
  requireTrue(governanceAssistiveJob.plan.agent === "governance_aware_assistant", "Governance-aware assistant route was not exercised.");
  requireTrue(libraryJob.plan.agent === "document_file_understanding_assistant", "Document/file understanding assistant route was not exercised.");
  requireTrue(replicationApprovedJob.plan.agent === "replication_aware_assistant" && replicationApprovedJob.output.artifact_count > 1, "Replication-aware assistant did not execute strict-replication output.");

  requireTrue(excelPendingJob.status.state === "awaiting_approval" && excelPendingJob.summary.artifact_refs.length === 1, "Excel no-auto-apply boundary failed.");
  requireTrue(reportsPendingJob.status.state === "awaiting_approval" && reportsPendingJob.summary.artifact_refs.length === 1, "Report no-auto-apply boundary failed.");
  requireTrue(localizationPendingJob.status.state === "awaiting_approval" && localizationPendingJob.summary.artifact_refs.length === 1, "Localization no-auto-apply boundary failed.");
  requireTrue(replicationPendingJob.status.state === "awaiting_approval" && replicationPendingJob.summary.artifact_refs.length === 1, "Replication no-auto-apply boundary failed.");

  requireTrue(localizationApprovedJob.summary.provider_ref && localizationApprovedJob.summary.model_ref, "Localization live provider metadata is missing from execution summary.");
  requireTrue(localizationFallbackJob.summary.fallback_used && localizationFallbackJob.summary.fallback_reason, "Localization fallback metadata was not captured.");
  requireTrue(bridgeFallback.fallback_used === true && Array.isArray(bridgeFallback.provider_trace) && bridgeFallback.provider_trace.length >= 2, "Live provider fallback bridge was not exercised.");

  requireTrue(excelApprovedJob.summary.execution_steps.length >= 5, "Excel multi-step execution depth is insufficient.");
  requireTrue(transcriptionIndependent.job.summary.execution_steps.includes("transcription.compare_bundles"), "Independent transcription AI did not execute the live compare path.");
  requireTrue(dashboardJob.summary.execution_steps.includes("reports.create_report"), "Dashboards multi-step orchestration into reports is missing.");
  requireTrue(reportsApprovedJob.output.artifact_count > 3, "Reports orchestration output set is too shallow.");
  requireTrue(localizationApprovedJob.summary.execution_steps.includes("localization.external_provider_translation"), "Localization external-provider execution step is missing.");

  requireTrue(localizationFallbackCase.resultText.includes("provider/model:") && localizationFallbackCase.resultText.includes("capability:") && localizationFallbackCase.resultText.includes("action:") && localizationFallbackCase.resultText.includes("tool:") && localizationFallbackCase.resultText.includes("fallback:"), "Explainability summary is not visible on the localization surface.");
  requireTrue(permissionFailureUi.resultText.includes("failure:") && permissionFailureJob.summary.failure_summaries.length > 0, "Failure summaries are not visible on the reports surface.");

  for (const job of [
    dataJob,
    transcriptionIndependent.job,
    excelApprovedJob,
    dashboardJob,
    reportsApprovedJob,
    presentationJob,
    replicationApprovedJob,
    localizationApprovedJob,
    localizationFallbackJob,
    libraryJob,
    governanceAssistiveJob,
    permissionFailureJob
  ]) {
    requireTrue(job.evidence.checks_executed.length > 0, `Evidence was not emitted for ${job.label}.`);
    requireTrue(job.audit.count > 0, `Audit was not emitted for ${job.label}.`);
    requireTrue(job.lineage.count > 0, `Lineage was not emitted for ${job.label}.`);
    requireTrue(job.runtime.exists.summary && job.runtime.exists.result && job.runtime.exists.evidence && job.runtime.exists.audit && job.runtime.exists.lineage, `Runtime files are missing for ${job.label}.`);
  }

  writeJson(proofFile, proof);
  writeJson(latestProofFile, proof);
  console.log(JSON.stringify(proof, null, 2));
} finally {
  if (browser) {
    await browser.close().catch(() => null);
  }
  if (presentationsHandle) {
    await presentationsHandle.close().catch(() => null);
  }
  if (transcriptionHandle?.server) {
    await new Promise((resolve) => transcriptionHandle.server.close(() => resolve(null))).catch(() => null);
  }
  if (dashboardHandle?.server) {
    await new Promise((resolve) => dashboardHandle.server.close(() => resolve(null))).catch(() => null);
  }
}
