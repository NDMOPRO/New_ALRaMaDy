import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

const findBrowserPath = () => browserCandidates.find((candidate) => fs.existsSync(candidate));
const [url, outputPath, waitText = ""] = process.argv.slice(2);

if (!url || !outputPath) {
  console.error("Usage: node remote_publication_capture.mjs <url> <outputPath> [waitText]");
  process.exit(1);
}

const executablePath = findBrowserPath();
if (!executablePath) {
  console.error("No Chromium-class browser found for remote publication capture");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const main = async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  if (waitText.length > 0) {
    try {
      await page.getByText(waitText, { exact: false }).waitFor({ timeout: 20000 });
    } catch {
      await page.waitForTimeout(2500);
    }
  } else {
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: outputPath, fullPage: true });
  await browser.close();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : `${error}`);
  process.exit(1);
});
