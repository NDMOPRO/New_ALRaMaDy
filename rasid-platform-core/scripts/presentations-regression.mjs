import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const ensureBuilt = (label, args) => {
  const result =
    process.platform === "win32"
      ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npx tsc ${args.join(" ")}`], { cwd: root, encoding: "utf8" })
      : spawnSync("npx", ["tsc", ...args], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
  }
};

ensureBuilt("presentations-engine-build", ["-p", "packages/presentations-engine/tsconfig.json"]);
ensureBuilt("contracts-cli-build", ["-p", "apps/contracts-cli/tsconfig.json"]);

const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const presentationsEngine = await load("packages/presentations-engine/dist/index.js");
const platformModule = await load("packages/presentations-engine/dist/platform.js");
const dashboardWebModule = await load("apps/contracts-cli/dist/dashboard-web.js");
const { chromium } = await import("playwright-core");
const commandStartedAt = new Date().toISOString();

const result = await presentationsEngine.runPresentationRegressionSuite();
const outputRoot = path.join(root, "packages", "presentations-engine", "artifacts", "latest-run", result.runId);
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outputRoot, "records"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "browser"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "api"), { recursive: true });

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
const writeBinary = (relativePath, payload) => {
  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(payload));
};
const writeCommandResult = (payload) => writeJson("records/command-result.json", payload);
const browserProgress = [];
const checkpoint = (step, extra = {}) => {
  const entry = { at: new Date().toISOString(), step, ...extra };
  browserProgress.push(entry);
  writeJson("records/browser-progress.json", browserProgress);
};
const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Non-JSON response for ${url}: ${raw.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  return payload;
};
const fetchJsonAllowError = async (url, options = {}) => {
  const response = await fetch(url, options);
  const raw = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }
  return { status: response.status, ok: response.ok, payload };
};
const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const tempServer = net.createServer();
    tempServer.unref();
    tempServer.on("error", reject);
    tempServer.listen(0, "127.0.0.1", () => {
      const address = tempServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("no free port"));
        return;
      }
      tempServer.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
const waitForServer = async (baseUrl) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {}
    await wait(400);
  }
  throw new Error(`server did not start: ${baseUrl}`);
};
const closeWithTimeout = async (label, callback, timeoutMs = 10000) => {
  try {
    await Promise.race([
      Promise.resolve().then(callback),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs))
    ]);
  } catch (error) {
    writeJson(`records/${label.replace(/[^a-z0-9_-]+/gi, "-")}-close-error.json`, {
      label,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
const pageJson = (pageHandle, target, method = "GET", body = undefined) =>
  pageHandle.evaluate(
    async ({ target: pathTarget, method: requestMethod, body: requestBody }) => {
      const response = await fetch(pathTarget, {
        method: requestMethod,
        headers: requestBody ? { "content-type": "application/json" } : {},
        body: requestBody ? JSON.stringify(requestBody) : undefined
      });
      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
      return { status: response.status, ok: response.ok, body: parsed };
    },
    { target, method, body }
  );

writeText("reader.html", result.artifacts.readerHtml);
writeText("export.html", result.artifacts.exportHtml);
writeBinary("export.pdf", result.artifacts.exportPdf);
writeBinary("export.pptx", result.artifacts.exportPptx);
writeJson("records/summary.json", {
  runId: result.runId,
  slideCount: result.mutatedBundle.storyboard.length,
  exportTargets: result.exports.map((item) => item.target),
  publicationId: result.publication.publication_id,
  publishReady: result.parityValidation.publish_ready
});
writeJson("records/parity-validation.json", result.parityValidation);
writeJson("records/evidence-packs.json", result.mutatedBundle.evidencePacks);
writeJson("records/audit-events.json", result.mutatedBundle.auditEvents);
writeJson("records/lineage-edges.json", result.mutatedBundle.lineageEdges);

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

const runtimeInputRoot = path.join(root, ".runtime", "presentations-engine", "regression-inputs");
const latestInputRoot = fs
  .readdirSync(runtimeInputRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(runtimeInputRoot, entry.name))
  .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];

const pdfPath = path.join(latestInputRoot, "source.pdf");
const wordPath = path.join(latestInputRoot, "source.docx");
const imagePath = path.join(latestInputRoot, "reference-image.png");
const pptxPath = path.join(latestInputRoot, "reference-deck.pptx");
const canvaPath = path.join(latestInputRoot, "canva-design.json");
const localSyncRoot = path.join(root, ".runtime", "presentations-engine", "cloud-sync", result.runId);
const oneDriveRoot = path.join(localSyncRoot, "onedrive-style");
const googleDriveRoot = path.join(localSyncRoot, "google-drive-style");
const tenantRef = `tenant-presentations-${Date.now()}`;
fs.mkdirSync(oneDriveRoot, { recursive: true });
fs.mkdirSync(googleDriveRoot, { recursive: true });
if (!fs.existsSync(canvaPath)) {
  fs.writeFileSync(
    canvaPath,
    `${JSON.stringify({
      name: "Canva Premium Import",
      description: "Imported Canva design for /presentations proof",
      primary_color: "7C3AED",
      secondary_color: "0F172A",
      accent_color: "F97316",
      neutral_color: "F8FAFC",
      font_face: "Tajawal",
      layout_archetypes: ["premium-cover", "premium-compare", "premium-closing"],
      component_styles: ["canva-card", "hero-panel"],
      pages: [
        { title: "غلاف", bullets: ["Canva import proof", "Brand-ready theme"] },
        { title: "مقارنة", bullets: ["Imported palette", "Imported hierarchy"] }
      ]
    }, null, 2)}\n`,
    "utf8"
  );
}

let server;
let browser;
let context;
let page;
let collabPage;
let presenterPage;
let remotePage;
let publicPage;
let dashboardPage;
let dashboardPublishedPage;
let dashboardSharedPage;
let dashboardExportPage;
let failureMessage = null;
try {
  server = await platformModule.startPresentationPlatformServer();
  const dashboardPort = await getFreePort();
  const dashboardWeb = dashboardWebModule.startDashboardWebApp({ host: "127.0.0.1", port: dashboardPort });
  const dashboardBaseUrl = dashboardWeb.base_url;
  await waitForServer(dashboardBaseUrl);
  const loginPayload = await fetchJson(`${server.origin}/api/v1/governance/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin", password: "1500", tenantRef })
  });
  const token = loginPayload.data.accessToken;
  writeJson("api/login.json", loginPayload);

  const createPayload = {
    title: "تدقيق /presentations التنفيذي",
    prompt: "ابن عرضًا عربيًا تنفيذيًا يثبت إنشاء العروض من مصادر متعددة داخل /presentations.",
    text: "أثبت التوليد، التعديل، التصدير، التعاون، والتحليلات.",
    pdf_path: pdfPath,
    word_path: wordPath,
    pptx_path: pptxPath,
    canva_path: canvaPath,
    url: "https://example.com",
    email_subject: "Weekly steering update",
    email_body: "Need a deck that summarizes current delivery and export readiness.",
    team_chat: "PM: نحتاج عرضًا اليوم\\nDesigner: أضف infographic\\nOps: أثبت parity والنشر",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    image_paths: [imagePath],
    json_payload: JSON.stringify([{ segment: "North", revenue: 12 }, { segment: "South", revenue: 18 }]),
    template_name: "Vinyl",
    theme_mode: "light",
    language: "ar",
    tone: "direct",
    include_data_sample: true,
    include_report_sample: true,
    include_dashboard_sample: true,
    auto_validate: false
  };
  const apiHeaders = {
    authorization: `Bearer ${token}`,
    "x-tenant-id": tenantRef,
    "content-type": "application/json"
  };
  const authQuery = `?access_token=${encodeURIComponent(token)}&tenant_ref=${encodeURIComponent(tenantRef)}`;
  const authUrl = (pathname) => `${server.origin}${pathname}${pathname.includes("?") ? `&${authQuery.slice(1)}` : authQuery}`;
  const createResponse = await fetchJson(`${server.origin}/api/v1/presentations/decks/create`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(createPayload)
  });
  writeJson("api/create.json", createResponse);
  checkpoint("api-create");

  const routeChecks = {
    login: true,
    create: true
  };
  browser = await chromium.launch(browserExecutablePath ? { executablePath: browserExecutablePath, headless: true } : { channel: "msedge", headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  page = await context.newPage();
  const browserConsole = [];
  page.on("console", (message) => browserConsole.push({ type: message.type(), text: message.text() }));
  page.on("pageerror", (error) => browserConsole.push({ type: "pageerror", text: error.message }));

  const runtimeCapabilities = await fetchJson(`${server.origin}/api/v1/presentations/capabilities`, { headers: apiHeaders });
  writeJson("api/capabilities.json", runtimeCapabilities);
  routeChecks.capabilities = true;
  writeJson("records/integration-status.json", runtimeCapabilities.data);
  const unsupportedSurfaces = {
    external_integrations: Object.fromEntries(
      Object.entries(runtimeCapabilities.data.external_integrations ?? {}).filter(([, value]) => value && value.implemented === false)
    ),
    downstream_flows: Object.fromEntries(
      Object.entries(runtimeCapabilities.data.downstream_flows ?? {}).filter(([, value]) => value && value.implemented === false)
    )
  };
  writeJson("records/unsupported-surfaces.json", {
    ...unsupportedSurfaces
  });

  await page.goto(authUrl("/presentations"), { waitUntil: "domcontentloaded" });
  await page.locator("#createForm").waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-home.png"), fullPage: true });
  checkpoint("presentations-home");
  await page.locator(".source-card").filter({ hasText: "PDF" }).click();
  await page.locator(".source-card").filter({ hasText: "PowerPoint" }).click();
  await page.locator(".source-card").filter({ hasText: "YouTube" }).click();
  await page.locator(".source-card").filter({ hasText: "JSON" }).click();
  await page.locator(".source-card").filter({ hasText: "Canva" }).click();
  await page.locator(".source-card").filter({ hasText: "Data / Reports / Dashboards" }).click();
  await page.locator("input[name='title']").fill("إثبات حي من /presentations");
  await page.locator("textarea[name='prompt']").fill("أنشئ عرضًا عربيًا تنفيذيًا يثبت مسار /presentations من مصادر متعددة مع إنفوجرافيك وتصدير وتعاون وتحليلات.");
  await page.locator("textarea[name='text']").fill("هذا الإنشاء يتم من واجهة المستخدم مباشرة ويجب أن يبقى editable وقابلًا لإعادة الفتح.");
  await page.locator("input[name='pdf_path']").fill(pdfPath);
  await page.locator("input[name='word_path']").fill(wordPath);
  await page.locator("input[name='pptx_path']").fill(pptxPath);
  await page.locator("input[name='url']").fill("https://example.com");
  await page.locator("input[name='youtube_url']").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.locator("input[name='canva_path']").fill(canvaPath);
  await page.locator("input[name='image_paths']").fill(imagePath);
  await page.locator("input[name='email_subject']").fill("Weekly steering update");
  await page.locator("textarea[name='email_body']").fill("Need a deck that summarizes current delivery and export readiness.");
  await page.locator("textarea[name='team_chat']").fill("PM: نحتاج عرضًا اليوم\nDesigner: أضف infographic\nOps: أثبت parity والنشر");
  await page.locator("textarea[name='json_payload']").fill(JSON.stringify([{ segment: "North", revenue: 12 }, { segment: "South", revenue: 18 }]));
  await page.locator("input[name='template_name']").fill("Chromatic");
  await page.locator("select[name='theme_mode']").selectOption("high-contrast");
  await page.locator("input[name='tone']").fill("executive");
  await page.locator("input[name='include_data_sample']").check();
  await page.locator("input[name='include_report_sample']").check();
  await page.locator("input[name='include_dashboard_sample']").check();
  await page.locator("input[name='auto_validate']").uncheck();
  await page.locator(".template-card").filter({ hasText: "Diorama" }).first().click();
  await page.locator("#importTemplatePath").fill(pptxPath);
  await page.locator("#importTemplateName").fill("Imported Board Template");
  await page.locator("#importTemplateBtn").click();
  await page.locator("#templateLibraryCards").getByRole("button", { name: /Imported Board Template/ }).first().waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-template-library.png"), fullPage: true });
  checkpoint("template-library-import");
  await page.locator(".infographic-card").filter({ hasText: "إحصائي" }).click();
  await page.locator("#createForm button.primary").click();
  await Promise.race([
    page.waitForURL(/\/presentations\/[^?]+/, { timeout: 180000 }),
    page.locator("#slideList").waitFor({ timeout: 180000 })
  ]);
  await page.locator("#slideList").waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-detail-before.png"), fullPage: true });
  checkpoint("ui-create-finished");
  const deckId = decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);

  const uiCreateProof = {
    url: page.url(),
    deckId
  };
  writeJson("browser/ui-create.json", uiCreateProof);
  const waitForLogUpdate = async (needle, action, { responsePath = null, responseTimeout = 180000, step = needle } = {}) => {
    const previousLog = await page.locator("#activityLog").textContent();
    if (responsePath) {
      const responseWatcher = page
        .waitForResponse(
          (response) => response.url().includes(responsePath) && response.request().method() === "POST" && response.status() === 200,
          { timeout: responseTimeout }
        )
        .catch(() => null);
      await action();
      await responseWatcher;
    } else {
      await action();
    }
    await page.waitForFunction(
      ([expected, previous]) => {
        const text = document.getElementById("activityLog")?.textContent ?? "";
        return text.includes(expected) && text !== previous;
      },
      [needle, previousLog ?? ""],
      { timeout: responseTimeout }
    );
    await page.waitForTimeout(500);
    checkpoint(step);
  };

  const apiCalls = {
    templates: await fetchJson(`${server.origin}/api/v1/presentations/templates`, { headers: apiHeaders }),
    templateLibrary: await fetchJson(`${server.origin}/api/v1/presentations/template-library`, { headers: apiHeaders }),
    listDecks: await fetchJson(`${server.origin}/api/v1/presentations/decks`, { headers: apiHeaders }),
    deck: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}`, { headers: apiHeaders }),
    mutate: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/mutate`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ mutation_kind: "add_slide", title: "شريحة من API", bullets: ["API proof"], summary: "Added via API" }) }),
    bind: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/bind`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ source_refs: ["dashboard-sample", "report-sample"] }) }),
    theme: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/theme`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ template_name: "Vinyl", theme_mode: "dark", primary_color: "8C2F39", secondary_color: "111827", accent_color: "F97316", neutral_color: "020617", font_face: "Aptos", lock_mode: "soft_lock" }) }),
    translate: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/translate`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ language: "en" }) }),
    notes: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/speaker-notes`, { method: "POST", headers: apiHeaders, body: "{}" }),
    aiImage: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/ai-image`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ prompt: "Executive AI illustration" }) }),
    voiceover: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/voiceover`, { method: "POST", headers: apiHeaders, body: "{}" }),
    parity: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/parity`, { method: "POST", headers: apiHeaders, body: "{}" }),
    publish: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/publish`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ password: "1234" }) }),
    comment: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/comments`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ body: "Review comment from API" }) }),
    analytics: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/analytics`, { headers: apiHeaders }),
    mediaSearch: await fetchJson(`${server.origin}/api/v1/media/search?q=saudi%20business`, { headers: apiHeaders }),
    saveTemplate: await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/save-template`, { method: "POST", headers: apiHeaders, body: JSON.stringify({ template_name: "API Saved Theme", description: "Saved from API regression", scope: "tenant" }) })
  };
  const importedTemplate = await fetchJson(`${server.origin}/api/v1/presentations/template-library/import`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ file_path: pptxPath, template_name: "API Imported Template", scope: "tenant" })
  });
  apiCalls.importTemplate = importedTemplate;
  apiCalls.templateLibraryAfterImport = await fetchJson(`${server.origin}/api/v1/presentations/template-library`, { headers: apiHeaders });
  apiCalls.deleteTemplate = await fetchJson(`${server.origin}/api/v1/presentations/template-library/${encodeURIComponent(importedTemplate.data.template_id)}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantRef
    }
  });
  for (const [key, value] of Object.entries(apiCalls)) {
    writeJson(`api/${key}.json`, value);
    routeChecks[key] = true;
  }
  checkpoint("api-routes-checked", { routes: Object.keys(routeChecks).length });

  const exportTargets = ["pptx", "pdf", "jpeg", "video", "html", "word", "google-slides", "canva"];
  for (const target of exportTargets) {
    const exportResponse = await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/export/${target}`, {
      method: "POST",
      headers: apiHeaders,
      body: "{}"
    });
    writeJson(`api/export-${target}.json`, exportResponse);
    routeChecks[`export-${target}`] = true;
  }
  const oneDriveExport = await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/export/onedrive`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ export_target: "pptx", folder_path: oneDriveRoot })
  });
  writeJson("api/export-onedrive.json", oneDriveExport);
  routeChecks["export-onedrive"] = true;
  const googleDriveExport = await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}/export/google-drive`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ export_target: "pptx", folder_path: googleDriveRoot })
  });
  writeJson("api/export-google-drive.json", googleDriveExport);
  routeChecks["export-google-drive"] = true;
  checkpoint("api-exports-checked", { targets: exportTargets });

  await page.goto(authUrl("/data"), { waitUntil: "domcontentloaded" });
  await page.locator("#dataToPresentation").waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "data-page.png"), fullPage: true });
  checkpoint("data-page");
  await page.click("#dataToPresentation");
  await page.waitForURL(/\/presentations\?prefill=data-sample/);
  await page.screenshot({ path: path.join(outputRoot, "browser", "data-prefill.png"), fullPage: true });
  await page.goto(authUrl("/reports"), { waitUntil: "domcontentloaded" });
  await page.locator("#reportToPresentation").waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "reports-page.png"), fullPage: true });
  checkpoint("reports-page");
  await page.click("#reportToPresentation");
  await page.waitForURL(/\/presentations\?prefill=report-sample/);
  await page.screenshot({ path: path.join(outputRoot, "browser", "reports-prefill.png"), fullPage: true });
  await page.goto(authUrl(`/presentations/${deckId}`), { waitUntil: "domcontentloaded" });
  await page.locator("#slideList").waitFor();
  checkpoint("detail-page-reopen");

  collabPage = await context.newPage();
  await collabPage.goto(authUrl(`/presentations/${deckId}`), { waitUntil: "domcontentloaded" });
  await collabPage.locator("#slideList").waitFor();
  await collabPage.locator(".tab[data-panel='collabPanel']").click();
  await collabPage.locator("#commentList").waitFor({ state: "visible" });

  await page.locator(".slide-card").nth(1).dragTo(page.locator(".slide-card").first());
  await page.locator(".tab[data-panel='mediaPanel']").click();
  await page.locator("#searchMedia").click();
  await page.locator("#mediaResults .media-result").first().waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-media.png"), fullPage: true });
  checkpoint("media-panel");
  await page.locator(".tab[data-panel='interactivePanel']").click();
  await page.locator("#publishProtected").click();
  await page.locator("#sendQuiz").click();
  await page.locator("#sendPoll").click();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-interaction.png"), fullPage: true });
  checkpoint("interactive-panel");
  await page.locator(".tab[data-panel='themePanel']").click();
  await page.locator(".template-card").filter({ hasText: "Whiteboard" }).first().click();
  await page.locator(".brand-pack-card").first().click();
  await page.locator("#savedTemplateName").fill("Browser Saved Theme");
  await page.locator("#saveCurrentTemplate").click();
  await page.locator("#detailTemplateLibrary").getByRole("button", { name: /Browser Saved Theme/ }).first().waitFor();
  await page.locator("#detailImportTemplatePath").fill(pptxPath);
  await page.locator("#savedTemplateName").fill("Browser Imported Theme");
  await page.locator("#importDetailTemplate").click();
  await page.locator("#detailTemplateLibrary").getByRole("button", { name: /Browser Imported Theme/ }).first().waitFor();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-theme-premium.png"), fullPage: true });
  await page.locator("#applyTheme").click();
  checkpoint("theme-applied");
  await page.locator(".tab[data-panel='editPanel']").click();
  await waitForLogUpdate("AI image generated", () => page.getByRole("button", { name: "Generate AI image" }).click(), {
    responsePath: `/api/v1/presentations/decks/${deckId}/ai-image`,
    step: "edit-ai-image"
  });
  await waitForLogUpdate("speaker notes regenerated", () => page.getByRole("button", { name: "Generate speaker notes" }).click(), {
    responsePath: `/api/v1/presentations/decks/${deckId}/speaker-notes`,
    step: "edit-speaker-notes"
  });
  await waitForLogUpdate("voiceover generated", () => page.getByRole("button", { name: "AI voiceover" }).click(), {
    responsePath: `/api/v1/presentations/decks/${deckId}/voiceover`,
    step: "edit-voiceover"
  });
  await waitForLogUpdate("bindings refreshed", () => page.getByRole("button", { name: "Bind data" }).click(), {
    responsePath: `/api/v1/presentations/decks/${deckId}/bind`,
    step: "edit-bind"
  });
  checkpoint("api-backed-edit-export-coverage", {
    covered_by_api: ["translate", "parity", "publish", "export-html", "export-pptx", "export-pdf", "export-canva", "export-onedrive", "export-google-drive"]
  });
  await page.getByRole("button", { name: "Collab" }).click();
  await page.locator("#commentBody").fill("Live browser collaboration comment");
  await page.getByRole("button", { name: "Post comment" }).click();
  await collabPage.waitForTimeout(2000);
  await collabPage.screenshot({ path: path.join(outputRoot, "browser", "presentations-collab-live.png"), fullPage: true });
  checkpoint("collab-live");
  await page.getByRole("button", { name: "Analytics" }).click();
  await page.screenshot({ path: path.join(outputRoot, "browser", "presentations-detail-after.png"), fullPage: true });
  checkpoint("analytics-panel");

  presenterPage = await context.newPage();
  await presenterPage.goto(authUrl(`/presentations/${deckId}/presenter`), { waitUntil: "domcontentloaded" });
  await presenterPage.locator("text=وضع مقدم العرض").waitFor();
  await presenterPage.screenshot({ path: path.join(outputRoot, "browser", "presenter-mode.png"), fullPage: true });
  checkpoint("presenter-mode");
  remotePage = await context.newPage();
  await remotePage.goto(authUrl(`/presentations/${deckId}/remote`), { waitUntil: "domcontentloaded" });
  await remotePage.locator("text=التحكم عن بعد").waitFor();
  await remotePage.getByRole("button", { name: "Next" }).click();
  await remotePage.screenshot({ path: path.join(outputRoot, "browser", "remote-mode.png"), fullPage: true });
  checkpoint("remote-mode");

  const publishResponse = await fetchJson(`${server.origin}/api/v1/presentations/decks/${deckId}`, { headers: apiHeaders });
  const publicUrl = new URL(publishResponse.data.publicUrl, server.origin).toString();
  publicPage = await context.newPage();
  await publicPage.goto(publicUrl, { waitUntil: "domcontentloaded" });
  await publicPage.locator("#viewerPassword").waitFor();
  await publicPage.fill("#viewerPassword", "1234");
  await publicPage.getByRole("button", { name: "Unlock" }).click();
  await publicPage.getByRole("button", { name: "Submit quiz" }).click();
  await publicPage.getByRole("button", { name: "Submit poll" }).click();
  await publicPage.screenshot({ path: path.join(outputRoot, "browser", "published-viewer.png"), fullPage: true });
  checkpoint("published-viewer");

  const shareToken = new URL(publicUrl).searchParams.get("share_token");
  const publicHeaders = { "content-type": "application/json" };
  const publicUnlock = await fetchJson(`${server.origin}/api/v1/presentations/public/${deckId}/unlock?share_token=${shareToken}`, { method: "POST", headers: publicHeaders, body: JSON.stringify({ password: "1234" }) });
  const publicTrack = await fetchJson(`${server.origin}/api/v1/presentations/public/${deckId}/track?share_token=${shareToken}`, { method: "POST", headers: publicHeaders, body: JSON.stringify({ kind: "view", detail: "fetch proof" }) });
  const publicQuiz = await fetchJson(`${server.origin}/api/v1/presentations/public/${deckId}/quiz?share_token=${shareToken}`, { method: "POST", headers: publicHeaders, body: JSON.stringify({ answer: "intent" }) });
  const publicPoll = await fetchJson(`${server.origin}/api/v1/presentations/public/${deckId}/poll?share_token=${shareToken}`, { method: "POST", headers: publicHeaders, body: JSON.stringify({ answer: "pptx" }) });
  writeJson("api/public-unlock.json", publicUnlock);
  writeJson("api/public-track.json", publicTrack);
  writeJson("api/public-quiz.json", publicQuiz);
  writeJson("api/public-poll.json", publicPoll);
  routeChecks.publicUnlock = true;
  routeChecks.publicTrack = true;
  routeChecks.publicQuiz = true;
  routeChecks.publicPoll = true;

  dashboardPage = await context.newPage();
  await dashboardPage.goto(`${dashboardBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  await dashboardPage.fill("#email", "admin");
  await dashboardPage.fill("#password", "1500");
  await dashboardPage.fill("#tenant", tenantRef);
  await dashboardPage.fill("#workspace", "workspace-dashboard-web");
  await dashboardPage.fill("#project", "project-dashboard-web");
  await dashboardPage.fill("#actor", "admin");
  await Promise.all([dashboardPage.waitForLoadState("networkidle"), dashboardPage.click("#login")]);
  await dashboardPage.goto(`${dashboardBaseUrl}/presentations?deck_id=${encodeURIComponent(deckId)}`, { waitUntil: "networkidle" });
  await dashboardPage.locator("#canvas-presentation-to-dashboard").waitFor({ timeout: 120000 });
  await dashboardPage.evaluate(() => {
    const checkbox = document.getElementById("canvas-approval-granted");
    if (checkbox) checkbox.checked = true;
  });
  await dashboardPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-presentations-surface.png"), fullPage: true });
  checkpoint("dashboard-presentations-surface");
  const dashboardConversion = await pageJson(dashboardPage, "/api/v1/presentations/convert-to-dashboard", "POST", {
    deck_id: deckId,
    target_ref: "workspace://dashboards/from-presentation",
    approval_granted: true
  });
  if (dashboardConversion.status !== 200) {
    throw new Error(JSON.stringify(dashboardConversion.body));
  }
  writeJson("api/presentation-to-dashboard.json", dashboardConversion.body);
  routeChecks.presentationsToDashboards = true;
  const downstreamDashboardId =
    dashboardConversion.body.presentation_bridge?.dashboard_id ??
    dashboardConversion.body.snapshot?.dashboard?.dashboard_id ??
    null;
  if (!downstreamDashboardId) {
    throw new Error("dashboard id missing after presentation conversion");
  }
  const presentationBridgeRoot = path.join(root, ".runtime", "dashboard-web", "presentation-bridges", deckId);
  const bridgeRunDirectory =
    fs
      .readdirSync(presentationBridgeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${downstreamDashboardId}-`))
      .map((entry) => path.join(presentationBridgeRoot, entry.name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
  if (!bridgeRunDirectory) {
    throw new Error("presentation bridge runtime directory missing after conversion");
  }
  const bridgeManifestPath = path.join(bridgeRunDirectory, "bridge-manifest.json");
  const bridgeArtifactPath = path.join(bridgeRunDirectory, `bridge-${deckId}-${downstreamDashboardId}.artifact.json`);
  const bridgeEvidencePath = path.join(bridgeRunDirectory, `bridge-${deckId}-${downstreamDashboardId}.evidence.json`);
  const bridgeAuditPath = path.join(bridgeRunDirectory, `bridge-${deckId}-${downstreamDashboardId}.audit.json`);
  const bridgeLineagePath = path.join(bridgeRunDirectory, `bridge-${deckId}-${downstreamDashboardId}.lineage.json`);
  if (!fs.existsSync(bridgeManifestPath)) {
    throw new Error("presentation bridge manifest missing after conversion");
  }
  await dashboardPage.goto(`${dashboardBaseUrl}/dashboards?dashboard_id=${encodeURIComponent(downstreamDashboardId)}`, { waitUntil: "networkidle" });
  await dashboardPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-from-presentation.png"), fullPage: true });
  checkpoint("dashboard-from-presentation");
  const dashboardState = await pageJson(
    dashboardPage,
    `/api/v1/dashboards/state?dashboard_id=${encodeURIComponent(downstreamDashboardId)}`
  );
  if (dashboardState.status !== 200) {
    throw new Error(JSON.stringify(dashboardState.body));
  }
  writeJson("api/dashboard-state.json", dashboardState.body);
  const dashboardPublish = await pageJson(dashboardPage, "/api/v1/dashboards/publish", "POST", {
    dashboard_id: downstreamDashboardId,
    approval_granted: true
  });
  if (dashboardPublish.status !== 200) {
    throw new Error(JSON.stringify(dashboardPublish.body));
  }
  writeJson("api/dashboard-publish.json", dashboardPublish.body);
  routeChecks.dashboardPublish = true;
  const dashboardShare = await pageJson(dashboardPage, "/api/v1/dashboards/share", "POST", {
    dashboard_id: downstreamDashboardId,
    approval_granted: true
  });
  if (dashboardShare.status !== 200) {
    throw new Error(JSON.stringify(dashboardShare.body));
  }
  writeJson("api/dashboard-share.json", dashboardShare.body);
  routeChecks.dashboardShare = true;
  const dashboardExportTarget = await pageJson(dashboardPage, "/api/v1/dashboards/export-widget-target", "POST", {
    dashboard_id: downstreamDashboardId,
    widget_ref: String(dashboardState.body.dashboard?.widgets?.[0]?.widget_id ?? ""),
    target_kind: "live_external",
    title: "Presentation downstream widget target",
    approval_granted: true
  });
  if (dashboardExportTarget.status !== 200) {
    throw new Error(JSON.stringify(dashboardExportTarget.body));
  }
  writeJson("api/dashboard-export-target.json", dashboardExportTarget.body);
  routeChecks.dashboardExportTarget = true;
  dashboardPublishedPage = await context.newPage();
  await dashboardPublishedPage.goto(dashboardPublish.body.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await dashboardPublishedPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-published-embed.png"), fullPage: true });
  dashboardSharedPage = await context.newPage();
  await dashboardSharedPage.goto(dashboardShare.body.transport.served_embed_html_url, { waitUntil: "networkidle" });
  await dashboardSharedPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-shared-embed.png"), fullPage: true });
  dashboardExportPage = await context.newPage();
  await dashboardExportPage.goto(`${dashboardBaseUrl}${dashboardExportTarget.body.transfer.open_path}`, { waitUntil: "networkidle" });
  await dashboardExportPage.screenshot({ path: path.join(outputRoot, "browser", "dashboard-export-target.png"), fullPage: true });
  checkpoint("dashboard-downstream-publish-share-export");

  const deckRoot = path.join(root, ".runtime", "presentations-engine", "decks", deckId);
  if (fs.existsSync(deckRoot)) {
    fs.cpSync(deckRoot, path.join(outputRoot, "persistent-store"), { recursive: true });
  }
  const dashboardRoot = path.join(root, ".runtime", "dashboard-web", "dashboard-engine", "dashboards", downstreamDashboardId);
  if (fs.existsSync(dashboardRoot)) {
    fs.cpSync(dashboardRoot, path.join(outputRoot, "dashboard-runtime-store"), { recursive: true });
  }
  writeJson("records/presentation-dashboard-bridge.json", {
    deck_id: deckId,
    dashboard_id: downstreamDashboardId,
    bridge_manifest_path: bridgeManifestPath,
    bridge_artifact_path: bridgeArtifactPath,
    bridge_evidence_path: bridgeEvidencePath,
    bridge_audit_path: bridgeAuditPath,
    bridge_lineage_path: bridgeLineagePath
  });
  writeJson("records/browser-console.json", browserConsole);
  writeJson("records/route-checks.json", routeChecks);
  writeJson("records/summary.json", {
    runId: result.runId,
    deckId,
    slideCount: result.mutatedBundle.storyboard.length,
    exportTargets: result.exports.map((item) => item.target),
    publicationId: result.publication.publication_id,
    publishReady: result.parityValidation.publish_ready,
    command_exit_clean: true,
    repo_local_only_artifacts: true,
    cloud_sync_roots: {
      oneDriveStyle: oneDriveRoot,
      googleDriveStyle: googleDriveRoot
    },
    unsupported_integrations_marked: true,
    presentations_to_dashboards_supported: true,
    downstream_dashboard_id: downstreamDashboardId,
    presentation_dashboard_bridge_ref: "records/presentation-dashboard-bridge.json",
    capabilities_ref: "records/integration-status.json",
    unsupported_ref: "records/unsupported-surfaces.json"
  });
  writeJson("records/browser-proof.json", {
    serverOrigin: server.origin,
    dashboardBaseUrl,
    deckId,
    screenshots: [
      "browser/presentations-home.png",
      "browser/data-page.png",
      "browser/data-prefill.png",
      "browser/reports-page.png",
      "browser/reports-prefill.png",
      "browser/presentations-detail-before.png",
      "browser/presentations-media.png",
      "browser/presentations-interaction.png",
      "browser/presentations-theme-premium.png",
      "browser/presentations-detail-after.png",
      "browser/presentations-collab-live.png",
      "browser/presenter-mode.png",
      "browser/remote-mode.png",
      "browser/published-viewer.png",
      "browser/dashboard-presentations-surface.png",
      "browser/dashboard-from-presentation.png",
      "browser/dashboard-published-embed.png",
      "browser/dashboard-shared-embed.png",
      "browser/dashboard-export-target.png"
    ],
    publicUrl,
    capabilitiesRef: "records/integration-status.json",
    unsupportedRef: "records/unsupported-surfaces.json",
    dashboardHandoffRef: "api/presentation-to-dashboard.json",
    dashboardBridgeRef: "records/presentation-dashboard-bridge.json",
    activityLog: await page.locator("#activityLog").textContent(),
    interactionState: await page.locator("#interactionState").textContent()
  });
  writeCommandResult({
    started_at: commandStartedAt,
    finished_at: new Date().toISOString(),
    exit_code: 0,
    status: "passed",
    output_root: outputRoot
  });
} catch (error) {
  failureMessage = error instanceof Error ? error.message : String(error);
  writeCommandResult({
    started_at: commandStartedAt,
    finished_at: new Date().toISOString(),
    exit_code: 1,
    status: "failed",
    output_root: outputRoot,
    error: failureMessage
  });
  throw error;
} finally {
  if (dashboardExportPage) await closeWithTimeout("dashboard-export-page", () => dashboardExportPage.close());
  if (dashboardSharedPage) await closeWithTimeout("dashboard-shared-page", () => dashboardSharedPage.close());
  if (dashboardPublishedPage) await closeWithTimeout("dashboard-published-page", () => dashboardPublishedPage.close());
  if (dashboardPage) await closeWithTimeout("dashboard-page", () => dashboardPage.close());
  if (publicPage) await closeWithTimeout("public-page", () => publicPage.close());
  if (remotePage) await closeWithTimeout("remote-page", () => remotePage.close());
  if (presenterPage) await closeWithTimeout("presenter-page", () => presenterPage.close());
  if (collabPage) await closeWithTimeout("collab-page", () => collabPage.close());
  if (page) await closeWithTimeout("main-page", () => page.close());
  if (context) await closeWithTimeout("browser-context", () => context.close());
  if (browser) await closeWithTimeout("browser", () => browser.close());
  if (server) await closeWithTimeout("presentation-server", () => server.close());
}

process.stdout.write(`${outputRoot}\n`);
process.exit(failureMessage ? 1 : 0);
