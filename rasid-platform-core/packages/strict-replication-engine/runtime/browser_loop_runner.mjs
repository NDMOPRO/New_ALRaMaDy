import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

const findBrowserPath = () => browserCandidates.find((candidate) => fs.existsSync(candidate));
const [url, outputDir, region = "UAE", period = "2026-Q1", permissionState = "analyst"] = process.argv.slice(2);

const permissionProfiles = {
  viewer: { filter: true, drill: false, refresh: false, compare: true, export: false },
  executive: { filter: true, drill: true, refresh: false, compare: true, export: true },
  operator: { filter: true, drill: true, refresh: true, compare: true, export: true },
  admin: { filter: true, drill: true, refresh: true, compare: true, export: true },
  analyst: { filter: true, drill: true, refresh: true, compare: true, export: true }
};

if (!url || !outputDir) {
  console.error("Usage: node browser_loop_runner.mjs <url> <outputDir> [region] [period] [permissionState]");
  process.exit(1);
}

const executablePath = findBrowserPath();
if (!executablePath) {
  console.error("No Chromium-class browser found for browser loop");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const screenshots = {
  overview: path.join(outputDir, "browser-overview.png"),
  filter: path.join(outputDir, "browser-filter.png"),
  drill: path.join(outputDir, "browser-drill.png"),
  refresh: path.join(outputDir, "browser-refresh.png"),
  compare: path.join(outputDir, "browser-compare.png"),
  export: path.join(outputDir, "browser-export.png")
};

const requests = [];
const consoleMessages = [];
const expectedPermissions = permissionProfiles[permissionState] ?? permissionProfiles.analyst;

const waitForState = async (page, predicate) => {
  await page.waitForFunction(
    ({ expression }) => {
      const text = document.querySelector("#state-json")?.textContent ?? "{}";
      const state = JSON.parse(text);
      return Function("state", `return (${expression});`)(state);
    },
    { expression: predicate }
  );
};

const readState = async (page) => JSON.parse(await page.locator("#state-json").textContent());
const readControls = async (page) => {
  const read = async (selector) => !(await page.locator(selector).isDisabled());
  return {
    filter: await read("#apply-filter"),
    drill: await read("#drill-sales"),
    refresh: await read("#refresh-button"),
    compare: await read("#compare-button"),
    export: await read("#export-button")
  };
};

const main = async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("response", (response) => {
    if (!response.url().includes("/api/session/")) return;
    requests.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method()
    });
  });
  page.on("console", (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await waitForState(page, "state.session && state.rows && state.rows.length > 1");
  const overviewState = await readState(page);
  const overviewControls = await readControls(page);
  await page.screenshot({ path: screenshots.overview });

  let filterState = overviewState;
  if (expectedPermissions.filter) {
    await page.selectOption("#region-filter", region);
    await page.selectOption("#period-filter", period);
    await page.click("#apply-filter");
    await waitForState(page, `state.session.region === ${JSON.stringify(region)} && state.session.period === ${JSON.stringify(period)}`);
    filterState = await readState(page);
  }
  await page.screenshot({ path: screenshots.filter });

  let drillState = filterState;
  let drillExecuted = false;
  if (expectedPermissions.drill && !(await page.locator("#drill-sales").isDisabled())) {
    await page.click("#drill-sales");
    await waitForState(page, "state.drill_metric === 'Sales'");
    drillState = await readState(page);
    drillExecuted = true;
  }
  await page.screenshot({ path: screenshots.drill });

  let refreshState = drillState;
  let refreshExecuted = false;
  if (expectedPermissions.refresh && !(await page.locator("#refresh-button").isDisabled())) {
    const refreshBefore = drillState.session.refresh_count;
    await page.click("#refresh-button");
    await waitForState(page, `state.session.refresh_count > ${refreshBefore}`);
    refreshState = await readState(page);
    refreshExecuted = true;
  }
  await page.screenshot({ path: screenshots.refresh });

  let compareState = refreshState;
  let compareExecuted = false;
  if (expectedPermissions.compare && !(await page.locator("#compare-button").isDisabled())) {
    await page.click("#compare-button");
    await waitForState(page, "state.compare && state.compare.deltas && state.compare.deltas.length > 0");
    compareState = await readState(page);
    compareExecuted = true;
  }
  await page.screenshot({ path: screenshots.compare });

  let exportState = compareState;
  let exportExecuted = false;
  if (expectedPermissions.export && !(await page.locator("#export-button").isDisabled())) {
    const exportBefore = compareState.session.export_count ?? 0;
    await page.click("#export-button");
    await waitForState(page, `state.session.export_count > ${exportBefore}`);
    exportState = await readState(page);
    exportExecuted = true;
  }
  await page.screenshot({ path: screenshots.export });

  const finalControls = await readControls(page);

  const payload = {
    url,
    executablePath,
    permissionState,
    expectedPermissions,
    overviewControls,
    finalControls,
    steps: [
      { event: "overview", state: overviewState, screenshot: screenshots.overview },
      { event: "filter", state: filterState, screenshot: screenshots.filter, executed: expectedPermissions.filter },
      { event: "drill", state: drillState, screenshot: screenshots.drill, executed: drillExecuted },
      { event: "refresh", state: refreshState, screenshot: screenshots.refresh, executed: refreshExecuted },
      { event: "compare", state: compareState, screenshot: screenshots.compare, executed: compareExecuted },
      { event: "export", state: exportState, screenshot: screenshots.export, executed: exportExecuted }
    ],
    actionResults: {
      filter: { allowed: expectedPermissions.filter, executed: expectedPermissions.filter },
      drill: { allowed: expectedPermissions.drill, executed: drillExecuted },
      refresh: { allowed: expectedPermissions.refresh, executed: refreshExecuted },
      compare: { allowed: expectedPermissions.compare, executed: compareExecuted },
      export: { allowed: expectedPermissions.export, executed: exportExecuted }
    },
    requests,
    consoleMessages
  };
  fs.writeFileSync(path.join(outputDir, "browser-loop.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
