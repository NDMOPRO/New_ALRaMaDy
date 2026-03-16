import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const platformModule = await load("packages/report-engine/dist/platform.js");
const { chromium } = await import("playwright-core");

const runId = `report-complex-layout-proof-${new Date().toISOString().replace(/[^0-9]/g, "")}`;
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
  return fetch(url, { method, headers, body }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`${method} ${url} failed with HTTP ${response.status}`);
    }
    return response.json();
  });
};

const browserExecutableCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const browserExecutablePath = browserExecutableCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

const compareCounts = (label, actual, expected, fields) => {
  const comparison = Object.fromEntries(
    fields.map((field) => [
      field,
      {
        expected: expected?.[field] ?? null,
        actual: actual?.[field] ?? null,
        matched: expected?.[field] == null ? true : actual?.[field] === expected[field]
      }
    ])
  );
  const failed = Object.entries(comparison).filter(([, value]) => !value.matched);
  if (failed.length > 0) {
    throw new Error(`${label} complex layout fidelity mismatch: ${failed.map(([field]) => field).join(", ")}`);
  }
  return comparison;
};

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

  const importReport = async (parser_hint, title) =>
    curlJson([
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
      JSON.stringify({ parser_hint, sample_profile: "complex", title })
    ]);

  const importedDocx = await importReport("docx", "Complex DOCX Layout Proof");
  const importedPdf = await importReport("pdf", "Complex PDF Layout Proof");
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

  const buildActual = (response) => ({
    page_count: response.data.payload.page_count,
    section_count: response.data.payload.section_count,
    table_count: response.data.payload.table_count,
    chart_count: response.data.payload.chart_count,
    caption_count: response.data.payload.caption_count,
    hyperlink_count: response.data.payload.hyperlinks?.length ?? 0
  });
  const buildDetailState = (detail) => ({
    editable_sections: detail.data.state.sections.length,
    editable_blocks: detail.data.state.contentBlocks.length,
    latest_version_ref: detail.data.state.report.current_version_ref
  });

  const docxActual = buildActual(importedDocx);
  const pdfActual = buildActual(importedPdf);
  const docxComparison = compareCounts("docx", docxActual, importedDocx.data.fixture_metadata?.expected, [
    "page_count",
    "section_count",
    "table_count",
    "chart_count",
    "caption_count",
    "hyperlink_count"
  ]);
  const pdfComparison = compareCounts("pdf", pdfActual, importedPdf.data.fixture_metadata?.expected, [
    "page_count",
    "section_count",
    "table_count",
    "chart_count",
    "caption_count",
    "hyperlink_count"
  ]);

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

  writeJson("records/complex-layout-comparison.json", {
    docx: {
      report_id: importedDocx.data.report_id,
      expected: importedDocx.data.fixture_metadata?.expected ?? null,
      actual: docxActual,
      comparison: docxComparison,
      detail_state: buildDetailState(importedDocxDetail)
    },
    pdf: {
      report_id: importedPdf.data.report_id,
      expected: importedPdf.data.fixture_metadata?.expected ?? null,
      actual: pdfActual,
      comparison: pdfComparison,
      detail_state: buildDetailState(importedPdfDetail)
    }
  });
  writeJson("records/summary.json", {
    runId,
    origin: server.origin,
    reports: {
      docx: importedDocx.data.report_id,
      pdf: importedPdf.data.report_id
    },
    screenshots: [
      "browser/reports-home.png",
      "browser/complex-docx-detail.png",
      "browser/complex-pdf-detail.png"
    ]
  });
} finally {
  if (browser) await browser.close();
  await server.close();
}

console.log(outputRoot);
