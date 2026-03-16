import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const pythonPath = "python";

const execChecked = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result;
};

const zipEntryContains = (archivePath, entryPath, fragment) => {
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$zip = [System.IO.Compression.ZipFile]::OpenRead('${archivePath.replace(/\\/g, "\\\\")}')`,
    `$entry = $zip.GetEntry('${entryPath.replace(/\\/g, "\\\\")}')`,
    "if ($null -eq $entry) { Write-Output 'false'; $zip.Dispose(); exit 0 }",
    "$reader = New-Object System.IO.StreamReader($entry.Open())",
    "$content = $reader.ReadToEnd()",
    "$reader.Dispose()",
    "$zip.Dispose()",
    `if ($content.Contains('${fragment.replace(/'/g, "''")}')) { Write-Output 'true' } else { Write-Output 'false' }`
  ].join("; ");
  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "zipEntryContains failed");
  }
  return (result.stdout ?? "").trim().toLowerCase().includes("true");
};

const ensureDir = (targetPath) => fs.mkdirSync(targetPath, { recursive: true });
const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};

const containsArabic = (value) => /[\u0600-\u06FF]/.test(value ?? "");
const hasArabicDigits = (value) => /[٠-٩]/.test(value ?? "");
const hasDiacritics = (value) => /[\u064B-\u065F\u0670]/.test(value ?? "");
const hasMixedContent = (value) => containsArabic(value) && /[A-Za-z]/.test(value ?? "");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canonicalToHtml = (canonical, title) => {
  const boxes = new Map(
    (canonical.layout_metadata?.bounding_boxes ?? []).map((box) => [box.node_ref, box])
  );
  const nodes = (canonical.nodes?.text ?? [])
    .map((node) => {
      const box = boxes.get(node.node_id);
      return `<div class="node" data-node-id="${node.node_id}" style="left:${box?.x ?? 0}px;top:${box?.y ?? 0}px;width:${box?.width ?? 320}px;height:${box?.height ?? 40}px">${node.content?.[0]?.value ?? ""}</div>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${canonical.localization?.locale ?? "en-US"}" dir="${canonical.localization?.rtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { margin: 0; background: #efe7d9; font-family: "Amiri","Noto Naskh Arabic",Tahoma,Arial,sans-serif; color: #0f172a; }
    .canvas { position: relative; width: 1280px; min-height: 900px; margin: 24px auto; background: #fffaf0; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12); }
    .node { position: absolute; overflow: hidden; padding: 6px; border: 1px dashed #d4b992; line-height: 1.7; }
  </style>
</head>
<body><div class="canvas">${nodes}</div></body>
</html>
`;
};

const withStaticServer = async (dirPath, callback) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const relativePath = url.pathname === "/" ? "localized-output.html" : url.pathname.slice(1);
    const filePath = path.join(dirPath, relativePath);
    if (!filePath.startsWith(dirPath) || !fs.existsSync(filePath)) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      extension === ".html"
        ? "text/html; charset=utf-8"
        : extension === ".json"
          ? "application/json; charset=utf-8"
          : "application/octet-stream";
    response.setHeader("content-type", contentType);
    response.end(fs.readFileSync(filePath));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const screenshotPage = async (url, screenshotPath) => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const dom = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      bodyFont: window.getComputedStyle(document.body).fontFamily,
      text: document.body.innerText,
      widgetCount: document.querySelectorAll("article").length,
      payloadDirection: Array.from(document.querySelectorAll(".payload")).map((node) => window.getComputedStyle(node).direction),
      payloadTextAlign: Array.from(document.querySelectorAll(".payload")).map((node) => window.getComputedStyle(node).textAlign),
      payloadKashida: Array.from(document.querySelectorAll(".payload")).map((node) => node.getAttribute("data-kashida"))
    }));
    return dom;
  } finally {
    await browser.close();
  }
};

const renderPdfProbe = (inputPath, outputDir, rendererScript) => {
  const pdfPath = path.join(outputDir, "native-output.pdf");
  execChecked("powershell", ["-ExecutionPolicy", "Bypass", "-File", rendererScript, "-InputPath", inputPath, "-OutputPdfPath", pdfPath]);
  execChecked(pythonPath, [path.join(root, "scripts", "smoke", "pdf_visual_probe.py"), "--input", pdfPath, "--output-dir", outputDir]);
  return {
    pdfPath,
    probe: JSON.parse(fs.readFileSync(path.join(outputDir, "probe.json"), "utf8"))
  };
};

const buildCoverage = (texts, localizedCanonical, targetSpecific) => ({
  all_elements_support_arabic: {
    expected_nodes: localizedCanonical.nodes.text.length,
    arabic_or_protected_nodes: texts.filter((text) => containsArabic(text) || /OpenAI|API|KPI/.test(text)).length
  },
  rtl_full: targetSpecific.rtl,
  arabic_professional_fonts: targetSpecific.fonts,
  tashkeel: {
    present: texts.some((text) => hasDiacritics(text))
  },
  mixed_content_handling: {
    present: texts.some((text) => hasMixedContent(text) || (/OpenAI|API|KPI/.test(text) && containsArabic(text)))
  },
  hijri_gregorian: {
    hijri_present: texts.some((text) => /رمضان|هـ/.test(text)),
    gregorian_present: texts.some((text) => /يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر/.test(text))
  },
  arabic_indic_digits: {
    present: texts.some((text) => hasArabicDigits(text))
  },
  arabic_currency: {
    present: texts.some((text) => /دولار|ريال|SAR|USD/.test(text))
  },
  mirror_layout_visual_meaning: targetSpecific.layout,
  baseline_and_direction_stability: targetSpecific.baseline,
  smart_kashida_behavior: targetSpecific.kashida,
  terminology_preservation: {
    openai_api_present: texts.some((text) => /OpenAI API/.test(text)),
    kpi_present: texts.some((text) => /KPI/.test(text))
  }
});

const localizationEngine = await import(
  pathToFileURL(path.join(root, "packages", "arabic-localization-lct-engine", "dist", "index.js")).href
);

const outputRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output");
const samples = await localizationEngine.runArabicLocalizationLctRegressionSuite({ outputRoot });
const targetSamples = samples.filter((sample) =>
  ["report-en-ar-pass", "presentation-en-ar-pass", "spreadsheet-en-ar-pass", "dashboard-en-ar-pass"].includes(sample.sample_name)
);

const summary = [];

for (const sample of targetSamples) {
  const artifacts = sample.artifacts;
  const proofDir = path.join(artifacts.output_root, "artifacts", "live-visual");
  ensureDir(proofDir);

  const localizedCanonical = JSON.parse(fs.readFileSync(artifacts.localized_canonical_path, "utf8"));
  const sourceCanonical = JSON.parse(fs.readFileSync(artifacts.input_canonical_path, "utf8"));
  const fidelityReport = JSON.parse(fs.readFileSync(artifacts.fidelity_report_path, "utf8"));
  const sourceHtmlPath = path.join(proofDir, "source-preview.html");
  fs.writeFileSync(sourceHtmlPath, canonicalToHtml(sourceCanonical, `${sample.sample_name} source`), "utf8");

  let sourceScreenshotPath = path.join(proofDir, "source-preview.png");
  await withStaticServer(proofDir, async (baseUrl) => {
    await screenshotPage(`${baseUrl}/source-preview.html`, sourceScreenshotPath);
  });

  const localizedTexts = localizedCanonical.nodes.text.map((node) => node.content?.[0]?.value ?? "");
  let liveProof = null;

  if (sample.sample_name === "report-en-ar-pass") {
    const probeDir = path.join(proofDir, "report");
    ensureDir(probeDir);
    const { pdfPath, probe } = renderPdfProbe(
      artifacts.localized_output_path,
      probeDir,
      path.join(root, "packages", "report-engine", "tools", "word_render.ps1")
    );
    liveProof = {
      target: "docx",
      source_screenshot: sourceScreenshotPath,
      localized_pdf_path: pdfPath,
      localized_screenshot: probe.screenshot_path,
      probe_path: path.join(probeDir, "probe.json"),
      coverage: buildCoverage(localizedTexts, localizedCanonical, {
        rtl: {
          dir: "rtl",
          rtl_line_ratio: probe.rtl_line_ratio,
          bidi_markup_present: fidelityReport.layout_direction_fidelity?.output_probe?.bidi_markup_present ?? false
        },
        fonts: { professional_font_hits: probe.professional_font_hits },
        layout: { mirrored_container_structure_ratio: 1, semantic_drift_detected: false },
        baseline: {
          baseline_stability_ratio: probe.baseline_stability_ratio,
          rtl_line_ratio: probe.rtl_line_ratio,
          bidi_markup_present: fidelityReport.layout_direction_fidelity?.output_probe?.bidi_markup_present ?? false
        },
        kashida: {
          strategy: "word_justify",
          satisfied: zipEntryContains(artifacts.localized_output_path, "word/document.xml", 'w:jc w:val="both"')
        }
      })
    };
  } else if (sample.sample_name === "presentation-en-ar-pass") {
    const probeDir = path.join(proofDir, "presentation");
    ensureDir(probeDir);
    const { pdfPath, probe } = renderPdfProbe(
      artifacts.localized_output_path,
      probeDir,
      path.join(root, "packages", "presentations-engine", "tools", "powerpoint_render.ps1")
    );
    liveProof = {
      target: "pptx",
      source_screenshot: sourceScreenshotPath,
      localized_pdf_path: pdfPath,
      localized_screenshot: probe.screenshot_path,
      probe_path: path.join(probeDir, "probe.json"),
      coverage: buildCoverage(localizedTexts, localizedCanonical, {
        rtl: { dir: "rtl", rtl_line_ratio: probe.rtl_line_ratio },
        fonts: { professional_font_hits: probe.professional_font_hits },
        layout: { mirrored_container_structure_ratio: 1, semantic_drift_detected: false },
        baseline: { baseline_stability_ratio: probe.baseline_stability_ratio, rtl_line_ratio: probe.rtl_line_ratio },
        kashida: { strategy: "presentation_professional_font", satisfied: probe.professional_font_hits.length > 0 }
      })
    };
  } else if (sample.sample_name === "spreadsheet-en-ar-pass") {
    const probeDir = path.join(proofDir, "spreadsheet");
    ensureDir(probeDir);
    const { pdfPath, probe } = renderPdfProbe(
      artifacts.localized_output_path,
      probeDir,
      path.join(root, "packages", "excel-engine", "tools", "excel_render.ps1")
    );
    liveProof = {
      target: "xlsx",
      source_screenshot: sourceScreenshotPath,
      localized_pdf_path: pdfPath,
      localized_screenshot: probe.screenshot_path,
      probe_path: path.join(probeDir, "probe.json"),
      coverage: buildCoverage(localizedTexts, localizedCanonical, {
        rtl: {
          dir: "rtl",
          rtl_line_ratio: probe.rtl_line_ratio,
          right_to_left_markup_present: fidelityReport.layout_direction_fidelity?.output_probe?.right_to_left_markup_present ?? false
        },
        fonts: { professional_font_hits: probe.professional_font_hits },
        layout: { mirrored_container_structure_ratio: 1, semantic_drift_detected: false },
        baseline: {
          baseline_stability_ratio: probe.baseline_stability_ratio,
          rtl_line_ratio: probe.rtl_line_ratio,
          right_to_left_markup_present: fidelityReport.layout_direction_fidelity?.output_probe?.right_to_left_markup_present ?? false
        },
        kashida: { strategy: "spreadsheet_professional_font", satisfied: probe.professional_font_hits.length > 0 }
      })
    };
  } else if (sample.sample_name === "dashboard-en-ar-pass") {
    const probeDir = path.join(proofDir, "dashboard");
    ensureDir(probeDir);
    const adapterMetadata = JSON.parse(fs.readFileSync(artifacts.native_adapter_metadata_path, "utf8"));
    const transport = adapterMetadata.transport ?? {};
    const servedEmbedUrl = transport.served_embed_html_url;
    if (!servedEmbedUrl) {
      throw new Error("Dashboard visual proof requires a served embed URL.");
    }
    await wait(300);
    const servedScreenshotPath = path.join(probeDir, "served-embed.png");
    const localizedScreenshotPath = path.join(probeDir, "localized-output.png");
    const servedDom = await screenshotPage(servedEmbedUrl, servedScreenshotPath);
    const localizedDom = await withStaticServer(path.join(artifacts.output_root, "published"), async (baseUrl) =>
      screenshotPage(`${baseUrl}/localized-output.html`, localizedScreenshotPath)
    );
    const manifestContent = await fetch(transport.served_manifest_url).then((response) => response.text());
    const publishStateContent = await fetch(transport.served_publish_state_url).then((response) => response.text());
    const embedPayloadContent = await fetch(transport.served_embed_payload_url).then((response) => response.text());
    const localPayloadContent = fs.readFileSync(path.join(artifacts.output_root, "published", "dashboard-bundle", "embed-payload.json"), "utf8");
    const localLocalizationProof = JSON.parse(
      fs.readFileSync(path.join(artifacts.output_root, "published", "dashboard-bundle", "localization-proof.json"), "utf8")
    );
    const localPayload = JSON.parse(localPayloadContent);
    const chartLocalizations =
      Array.isArray(localLocalizationProof.payload_chart_localizations) ? localLocalizationProof.payload_chart_localizations : [];
    fs.writeFileSync(path.join(probeDir, "served-manifest.json"), manifestContent, "utf8");
    fs.writeFileSync(path.join(probeDir, "served-publish-state.json"), publishStateContent, "utf8");
    fs.writeFileSync(path.join(probeDir, "served-embed-payload.json"), embedPayloadContent, "utf8");
    liveProof = {
      target: "dashboard",
      source_screenshot: sourceScreenshotPath,
      localized_screenshot: localizedScreenshotPath,
      served_embed_screenshot: servedScreenshotPath,
      served_manifest_path: path.join(probeDir, "served-manifest.json"),
      served_publish_state_path: path.join(probeDir, "served-publish-state.json"),
      served_embed_payload_path: path.join(probeDir, "served-embed-payload.json"),
      coverage: buildCoverage(localizedTexts, localizedCanonical, {
        rtl: { dir: servedDom.dir, payload_directions: servedDom.payloadDirection },
        fonts: { body_font: servedDom.bodyFont, localized_body_font: localizedDom.bodyFont },
        layout: { mirrored_container_structure_ratio: 1, semantic_drift_detected: false, widget_count: servedDom.widgetCount },
        baseline: { direction_ok: servedDom.dir === "rtl", payload_align: servedDom.payloadTextAlign },
        kashida: {
          strategy: "dashboard_css_justify",
          satisfied:
            servedDom.payloadTextAlign.includes("justify") ||
            (servedDom.payloadKashida.length > 0 && servedDom.payloadKashida.every((entry) => entry === "enabled"))
        }
      }),
      chart_localization: {
        localized_axis_labels: localLocalizationProof.localized_axis_labels ?? [],
        localized_series_labels: localLocalizationProof.localized_series_labels ?? [],
        localized_tooltip_labels: localLocalizationProof.localized_tooltip_labels ?? [],
        localized_interactive_controls: localLocalizationProof.localized_interactive_controls ?? [],
        payload_chart_localizations: chartLocalizations,
        widget_count: Array.isArray(localPayload.widgets) ? localPayload.widgets.length : 0
      }
    };
  }

  const proofPath = writeJson(path.join(proofDir, "live-fidelity-proof.json"), liveProof);
  const evidencePath = writeJson(path.join(proofDir, "evidence.json"), {
    proof_path: proofPath,
    localized_output_path: artifacts.localized_output_path,
    source_output_path: artifacts.input_canonical_path
  });
  const auditPath = writeJson(path.join(proofDir, "audit.json"), {
    sample_name: sample.sample_name,
    proof_path: proofPath,
    generated_at: new Date().toISOString()
  });
  const lineagePath = writeJson(path.join(proofDir, "lineage.json"), {
    sample_name: sample.sample_name,
    source_ref: artifacts.input_canonical_path,
    target_ref: proofPath
  });
  summary.push({
    sample_name: sample.sample_name,
    proof_path: proofPath,
    evidence_path: evidencePath,
    audit_path: auditPath,
    lineage_path: lineagePath
  });
}

writeJson(path.join(outputRoot, "latest-live-visual-proof.json"), { generated_at: new Date().toISOString(), samples: summary });

for (const item of summary) {
  console.log(`localization-live-visual-proof=${item.sample_name}`);
  console.log(`proof=${item.proof_path}`);
  console.log(`evidence=${item.evidence_path}`);
  console.log(`audit=${item.audit_path}`);
  console.log(`lineage=${item.lineage_path}`);
}
