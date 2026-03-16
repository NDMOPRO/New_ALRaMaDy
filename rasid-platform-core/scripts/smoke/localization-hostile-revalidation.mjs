import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outputBase = path.join(root, "packages", "arabic-localization-lct-engine", "output");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const proofRoot = path.join(outputBase, `hostile-revalidation-${timestamp}`);
const artifactsDir = path.join(proofRoot, "artifacts");
const evidenceDir = path.join(proofRoot, "evidence");
const auditDir = path.join(proofRoot, "audit");
const lineageDir = path.join(proofRoot, "lineage");

[proofRoot, artifactsDir, evidenceDir, auditDir, lineageDir].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true })
);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const now = () => new Date().toISOString();
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};
const existingPath = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} missing: ${filePath}`);
  }
  return filePath;
};
const findLatestDirectory = (baseDir, prefix, afterMs) => {
  const matches = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(baseDir, entry.name))
    .filter((dirPath) => fs.statSync(dirPath).mtimeMs >= afterMs)
    .sort((left, right) => fs.statSync(left).mtimeMs - fs.statSync(right).mtimeMs);
  if (matches.length === 0) {
    throw new Error(`No fresh proof root found for prefix ${prefix}`);
  }
  return matches.at(-1);
};
const runChecked = (command, args, label) => {
  const startedAt = Date.now();
  const run = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32"
  });
  const completedAt = Date.now();
  const record = {
    label,
    command,
    args,
    started_at: new Date(startedAt).toISOString(),
    completed_at: new Date(completedAt).toISOString(),
    duration_ms: completedAt - startedAt,
    exit_status: run.status,
    signal: run.signal,
    stdout_path: writeJson(path.join(artifactsDir, `${label}.stdout.json`), {
      stdout: run.stdout ?? ""
    }),
    stderr_path: writeJson(path.join(artifactsDir, `${label}.stderr.json`), {
      stderr: run.stderr ?? ""
    })
  };
  if (run.status !== 0) {
    throw new Error(`${label} failed:\n${run.stdout ?? ""}\n${run.stderr ?? ""}`);
  }
  return record;
};
const treeInfo = {
  recorded_at: now(),
  cwd: root,
  git_head:
    spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() ?? null,
  git_status:
    spawnSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).stdout
      ?.trim()
      .split(/\r?\n/)
      .filter(Boolean) ?? []
};

const suiteStartedAt = Date.now();
const commandResults = [
  runChecked(npxCommand, ["tsc", "-p", "packages/arabic-localization-lct-engine/tsconfig.json"], "localization-package-tsc"),
  runChecked(npmCommand, ["run", "test:localization-engine"], "localization-engine"),
  runChecked(npmCommand, ["run", "test:localization-live-proof"], "localization-live-proof"),
  runChecked(npmCommand, ["run", "test:localization-ui-strings"], "localization-ui-strings"),
  runChecked(npmCommand, ["run", "test:localization-generated-narrative"], "localization-generated-narrative"),
  runChecked(npmCommand, ["run", "test:localization-contextual-quality"], "localization-contextual-quality"),
  runChecked(npmCommand, ["run", "test:localization-remote-gateway"], "localization-remote-gateway"),
  runChecked("node", ["scripts/smoke/localization-external-provider-validation.mjs"], "localization-commercial-provider")
];

const commercialRoot = findLatestDirectory(outputBase, "external-provider-validation-", suiteStartedAt);
const remoteRoot = findLatestDirectory(outputBase, "remote-dashboard-gateway-proof-", suiteStartedAt);
const toneMatrixRoot = findLatestDirectory(outputBase, "professional-tone-matrix-", suiteStartedAt);
const domainMatrixRoot = findLatestDirectory(outputBase, "domain-glossary-matrix-", suiteStartedAt);
const contextualParent = path.join(outputBase, "runtime-contextual-translation-proof");
const contextualRoot = findLatestDirectory(contextualParent, "contextual-translation-quality-proof-", suiteStartedAt);
const uiParent = path.join(outputBase, "runtime-ui-string-proof");
const uiRoot = findLatestDirectory(uiParent, "ui-string-localization-proof-", suiteStartedAt);
const generatedParent = path.join(outputBase, "runtime-generated-narrative-proof");
const generatedRoot = findLatestDirectory(generatedParent, "generated-narrative-localization-proof-", suiteStartedAt);

const reportSampleRoot = findLatestDirectory(outputBase, "sample-run-report-en-ar-pass-", suiteStartedAt);
const presentationSampleRoot = findLatestDirectory(outputBase, "sample-run-presentation-en-ar-pass-", suiteStartedAt);
const spreadsheetSampleRoot = findLatestDirectory(outputBase, "sample-run-spreadsheet-en-ar-pass-", suiteStartedAt);
const dashboardSampleRoot = findLatestDirectory(outputBase, "sample-run-dashboard-en-ar-pass-", suiteStartedAt);
const degradedDashboardSampleRoot = findLatestDirectory(outputBase, "sample-run-dashboard-en-ar-degraded-", suiteStartedAt);

const commercialProof = readJson(existingPath(path.join(commercialRoot, "artifacts", "commercial-provider-proof.json"), "commercial provider proof"));
const commercialEvidence = existingPath(path.join(commercialRoot, "evidence", "evidence-pack.json"), "commercial provider evidence");
const commercialAudit = existingPath(path.join(commercialRoot, "audit", "audit-events.json"), "commercial provider audit");
const commercialLineage = existingPath(path.join(commercialRoot, "lineage", "lineage-edges.json"), "commercial provider lineage");

const remoteProof = readJson(existingPath(path.join(remoteRoot, "artifacts", "remote-dashboard-gateway-proof.json"), "remote gateway proof"));
const remoteEvidence = existingPath(path.join(remoteRoot, "evidence", "evidence.json"), "remote gateway evidence");
const remoteAudit = existingPath(path.join(remoteRoot, "audit", "audit.json"), "remote gateway audit");
const remoteLineage = existingPath(path.join(remoteRoot, "lineage", "lineage.json"), "remote gateway lineage");

const toneMatrixProof = readJson(existingPath(path.join(toneMatrixRoot, "professional-tone-matrix.json"), "professional tone matrix"));
const toneMatrixEvidence = existingPath(path.join(toneMatrixRoot, "evidence.json"), "professional tone matrix evidence");
const toneMatrixAudit = existingPath(path.join(toneMatrixRoot, "audit.json"), "professional tone matrix audit");
const toneMatrixLineage = existingPath(path.join(toneMatrixRoot, "lineage.json"), "professional tone matrix lineage");

const domainMatrixProof = readJson(existingPath(path.join(domainMatrixRoot, "domain-glossary-matrix.json"), "domain glossary matrix"));
const domainMatrixEvidence = existingPath(path.join(domainMatrixRoot, "evidence.json"), "domain glossary matrix evidence");
const domainMatrixAudit = existingPath(path.join(domainMatrixRoot, "audit.json"), "domain glossary matrix audit");
const domainMatrixLineage = existingPath(path.join(domainMatrixRoot, "lineage.json"), "domain glossary matrix lineage");

const contextualProof = readJson(existingPath(path.join(contextualRoot, "contextual-translation-quality-proof.json"), "contextual proof"));
const contextualEvidence = existingPath(path.join(contextualRoot, "evidence.json"), "contextual evidence");
const contextualAudit = existingPath(path.join(contextualRoot, "audit.json"), "contextual audit");
const contextualLineage = existingPath(path.join(contextualRoot, "lineage.json"), "contextual lineage");

const uiProof = readJson(existingPath(path.join(uiRoot, "ui-string-localization-proof.json"), "ui proof"));
const uiEvidence = existingPath(path.join(uiRoot, "evidence.json"), "ui evidence");
const uiAudit = existingPath(path.join(uiRoot, "audit.json"), "ui audit");
const uiLineage = existingPath(path.join(uiRoot, "lineage.json"), "ui lineage");

const generatedProof = readJson(existingPath(path.join(generatedRoot, "generated-narrative-localization-proof.json"), "generated narrative proof"));
const generatedEvidence = existingPath(path.join(generatedRoot, "evidence.json"), "generated narrative evidence");
const generatedAudit = existingPath(path.join(generatedRoot, "audit.json"), "generated narrative audit");
const generatedLineage = existingPath(path.join(generatedRoot, "lineage.json"), "generated narrative lineage");

const liveProofs = {
  report: readJson(existingPath(path.join(reportSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"), "report live proof")),
  presentation: readJson(existingPath(path.join(presentationSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"), "presentation live proof")),
  spreadsheet: readJson(existingPath(path.join(spreadsheetSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"), "spreadsheet live proof")),
  dashboard: readJson(existingPath(path.join(dashboardSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"), "dashboard live proof"))
};

const checks = [];
const assertCheck = (checkId, passed, detail, refs = []) => {
  const record = { check_id: checkId, passed, detail, refs };
  checks.push(record);
  if (!passed) {
    throw new Error(`${checkId} failed: ${detail}`);
  }
};

assertCheck(
  "commercial-provider-auth-success",
  commercialProof.final_status === "commercial_provider_verified" &&
    commercialProof.auth_success?.classification === "commercial_auth_success",
  "Commercial provider auth-success path must remain verified.",
  [path.join(commercialRoot, "artifacts", "commercial_auth_success-response.json")]
);
assertCheck(
  "commercial-provider-error-taxonomy",
  fs.existsSync(path.join(commercialRoot, "artifacts", "commercial-rate-limit-taxonomy.json")) &&
    fs.existsSync(path.join(commercialRoot, "artifacts", "commercial-error-taxonomy.json")),
  "Commercial provider rate-limit and error taxonomy artifacts must exist.",
  [
    path.join(commercialRoot, "artifacts", "commercial-rate-limit-taxonomy.json"),
    path.join(commercialRoot, "artifacts", "commercial-error-taxonomy.json")
  ]
);
assertCheck(
  "remote-dashboard-pass-lifecycle",
  remoteProof.pass?.manifest_status === 200 &&
    remoteProof.pass?.state_status === 200 &&
    remoteProof.degraded?.manifest_status === 200 &&
    remoteProof.degraded?.state_status === 200,
  "Remote dashboard pass/degraded lifecycle must remain reachable.",
  [path.join(remoteRoot, "artifacts", "remote-dashboard-gateway-proof.json")]
);
assertCheck(
  "remote-dashboard-tenant-isolation",
  remoteProof.tenant_isolation?.invalid_signature_status === 403,
  "Remote dashboard tenant isolation must still reject invalid signatures.",
  [path.join(remoteRoot, "artifacts", "remote-dashboard-gateway-proof.json")]
);
assertCheck(
  "professional-tone-matrix-coverage",
  toneMatrixProof.requirement === "professional_translation_tone_adaptation" &&
    Array.isArray(toneMatrixProof.tones) &&
    toneMatrixProof.tones.length === 4 &&
    ["formal", "executive", "government", "technical"].every((tone) =>
      toneMatrixProof.tones.some((entry) => entry.tone === tone)
    ),
  "Professional tone matrix must retain all four tone outputs on the current tree.",
  [path.join(toneMatrixRoot, "professional-tone-matrix.json")]
);
assertCheck(
  "professional-tone-non-literal-register-integrity",
  toneMatrixProof.tones.every(
    (entry) =>
      typeof entry.register_label === "string" &&
      entry.register_label.length > 0 &&
      typeof entry.non_literal_strategy === "string" &&
      entry.non_literal_strategy.length > 0 &&
      entry.marker_alignment_pass === true &&
      entry.arabic_script_pass === true &&
      Array.isArray(entry.localized_excerpt) &&
      entry.localized_excerpt.length > 0 &&
      (entry.tone === "formal" || (entry.localized_excerpt_diff_vs_formal ?? []).length > 0)
  ),
  "Professional tone outputs must remain non-literal, register-aware, and Arabic-valid.",
  [path.join(toneMatrixRoot, "professional-tone-matrix.json")]
);
assertCheck(
  "domain-glossary-matrix-coverage",
  domainMatrixProof.requirement === "sector_glossary_terminology_control_by_domain" &&
    Array.isArray(domainMatrixProof.domains) &&
    domainMatrixProof.domains.length === 4 &&
    ["finance", "healthcare", "government", "telecom"].every((domain) =>
      domainMatrixProof.domains.some((entry) => entry.domain === domain)
    ),
  "Domain glossary matrix must retain all required sector outputs on the current tree.",
  [path.join(domainMatrixRoot, "domain-glossary-matrix.json")]
);
assertCheck(
  "domain-glossary-injection-semantic-map-registry",
  domainMatrixProof.domains.every(
    (entry) =>
      Array.isArray(entry.glossary_used) &&
      entry.glossary_used.length >= 3 &&
      typeof entry.business_terminology_registry === "string" &&
      entry.business_terminology_registry.startsWith("registry.") &&
      typeof entry.domain_semantic_map === "object" &&
      entry.domain_semantic_map !== null &&
      Object.keys(entry.domain_semantic_map).length >= 3 &&
      Array.isArray(entry.overridden_terms) &&
      entry.overridden_terms.length >= 3 &&
      Array.isArray(entry.localized_excerpt) &&
      entry.localized_excerpt.length >= 3
  ),
  "Each domain output must preserve glossary injection, business terminology registry, and semantic map coverage.",
  [path.join(domainMatrixRoot, "domain-glossary-matrix.json")]
);
assertCheck(
  "contextual-quality-upgrades",
  contextualProof.requirement_status === "verified" &&
    contextualProof.coverage?.entry_count >= 12 &&
    contextualProof.coverage?.contextual_upgrade_count >= 12 &&
    Array.isArray(contextualProof.english_residuals) &&
    contextualProof.english_residuals.length === 0,
  "Contextual translation quality must preserve verified upgrade coverage.",
  [path.join(contextualRoot, "contextual-translation-quality-proof.json")]
);
assertCheck(
  "ui-string-localization",
  uiProof.requirement_status === "verified" &&
    (uiProof.coverage?.dashboard_published_ui_string_count ?? 0) >= 9 &&
    Array.isArray(uiProof.english_residuals) &&
    uiProof.english_residuals.length === 0,
  "UI string localization must retain published dashboard coverage without English residuals.",
  [path.join(uiRoot, "ui-string-localization-proof.json")]
);
assertCheck(
  "generated-narrative-localization",
  generatedProof.requirement_status === "verified" &&
    (generatedProof.coverage?.localized_narrative_count ?? 0) >= 9 &&
    Array.isArray(generatedProof.english_residuals) &&
    generatedProof.english_residuals.length === 0,
  "Generated narrative localization must remain verified without English residuals.",
  [path.join(generatedRoot, "generated-narrative-localization-proof.json")]
);

for (const [target, liveProof] of Object.entries(liveProofs)) {
  const coverage = liveProof.coverage ?? {};
  assertCheck(
    `live-visual-${target}-arabic-elements`,
    (coverage.all_elements_support_arabic?.arabic_or_protected_nodes ?? 0) >=
      (coverage.all_elements_support_arabic?.expected_nodes ?? 0),
    `${target} must preserve Arabic support across all elements.`,
    [liveProof.localized_screenshot ?? liveProof.localized_pdf_path ?? ""].filter(Boolean)
  );
  assertCheck(
    `live-visual-${target}-rtl`,
    coverage.rtl_full?.dir === "rtl" ||
      coverage.rtl_full?.direction_ok === true ||
      (Array.isArray(coverage.rtl_full?.payload_directions) && coverage.rtl_full.payload_directions.every((direction) => direction === "rtl")),
    `${target} must preserve RTL correctness.`,
    [liveProof.probe_path ?? liveProof.served_embed_payload_path ?? ""].filter(Boolean)
  );
  assertCheck(
    `live-visual-${target}-kashida`,
    coverage.smart_kashida_behavior?.satisfied === true,
    `${target} must preserve smart kashida or equivalent Arabic justification behavior.`,
    [liveProof.probe_path ?? liveProof.served_embed_payload_path ?? ""].filter(Boolean)
  );
  assertCheck(
    `live-visual-${target}-semantic-visual-parity`,
    coverage.mirror_layout_visual_meaning?.semantic_drift_detected === false,
    `${target} must preserve mirrored layout semantics without drift.`,
    [liveProof.source_screenshot ?? "", liveProof.localized_screenshot ?? liveProof.served_embed_screenshot ?? ""].filter(Boolean)
  );
  assertCheck(
    `live-visual-${target}-locale-details`,
    coverage.tashkeel?.present === true &&
      coverage.mixed_content_handling?.present === true &&
      coverage.hijri_gregorian?.hijri_present === true &&
      coverage.hijri_gregorian?.gregorian_present === true &&
      coverage.arabic_indic_digits?.present === true &&
      coverage.arabic_currency?.present === true,
    `${target} must preserve diacritics, mixed content, Hijri/Gregorian, Arabic-Indic digits, and Arabic currency semantics.`,
    [liveProof.probe_path ?? liveProof.served_embed_payload_path ?? ""].filter(Boolean)
  );
}

assertCheck(
  "dashboard-chart-data-localization",
  (liveProofs.dashboard.chart_localization?.localized_axis_labels ?? []).length >= 2 &&
    (liveProofs.dashboard.chart_localization?.localized_series_labels ?? []).length >= 2 &&
    (liveProofs.dashboard.chart_localization?.localized_tooltip_labels ?? []).length >= 4 &&
    (liveProofs.dashboard.chart_localization?.localized_interactive_controls ?? []).length >= 5,
  "Dashboard chart/data localization must preserve axes, series, tooltips, and interactive controls.",
  [path.join(dashboardSampleRoot, "published", "dashboard-bundle", "localization-proof.json")]
);
assertCheck(
  "dashboard-remote-degraded-closure",
  fs.existsSync(path.join(degradedDashboardSampleRoot, "artifacts", "dashboard-artifact-closure.json")),
  "Degraded dashboard artifact closure must still be emitted for the current tree.",
  [path.join(degradedDashboardSampleRoot, "artifacts", "dashboard-artifact-closure.json")]
);

const proof = {
  generated_at: now(),
  phase_requirement: "arabic-localization-lct-engine hostile revalidation on current tree",
  tree: treeInfo,
  commands: commandResults,
  proof_roots: {
    commercial_provider: commercialRoot,
    remote_dashboard_gateway: remoteRoot,
    contextual_quality: contextualRoot,
    ui_strings: uiRoot,
    generated_narrative: generatedRoot,
    professional_tones: toneMatrixRoot,
    domain_glossary_matrix: domainMatrixRoot,
    live_visual: {
      report: path.join(reportSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"),
      presentation: path.join(presentationSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"),
      spreadsheet: path.join(spreadsheetSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"),
      dashboard: path.join(dashboardSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json")
    }
  },
  checked_items: checks,
  status: "verified",
  contradictions: []
};

const proofPath = writeJson(path.join(artifactsDir, "arabic-localization-hostile-revalidation.json"), proof);
const evidencePath = writeJson(path.join(evidenceDir, "evidence.json"), {
  proof_path: proofPath,
  referenced_artifacts: {
    commercial_provider: [
      path.join(commercialRoot, "artifacts", "commercial_auth_success-response.json"),
      path.join(commercialRoot, "artifacts", "commercial-rate-limit-taxonomy.json"),
      path.join(commercialRoot, "artifacts", "commercial-error-taxonomy.json")
    ],
    remote_dashboard_gateway: [
      path.join(remoteRoot, "browser", "remote-pass-embed.png"),
      path.join(remoteRoot, "browser", "remote-degraded-embed.png"),
      path.join(remoteRoot, "artifacts", "remote-dashboard-gateway-proof.json")
    ],
    professional_tones: [
      path.join(toneMatrixRoot, "professional-tone-matrix.json"),
      toneMatrixEvidence,
      toneMatrixAudit,
      toneMatrixLineage
    ],
    domain_glossary_matrix: [
      path.join(domainMatrixRoot, "domain-glossary-matrix.json"),
      domainMatrixEvidence,
      domainMatrixAudit,
      domainMatrixLineage
    ],
    live_visual: [
      liveProofs.report.source_screenshot,
      liveProofs.report.localized_screenshot,
      liveProofs.presentation.localized_screenshot,
      liveProofs.spreadsheet.localized_screenshot,
      liveProofs.dashboard.served_embed_screenshot
    ],
    localized_runtime_outputs: [
      path.join(reportSampleRoot, "published", "localized-output.docx"),
      path.join(presentationSampleRoot, "published", "localized-output.pptx"),
      path.join(spreadsheetSampleRoot, "published", "localized-output.xlsx"),
      path.join(dashboardSampleRoot, "published", "localized-output.html")
    ]
  }
});
const auditPath = writeJson(path.join(auditDir, "audit.json"), {
  generated_at: now(),
  phase_requirement: "arabic-localization-lct-engine hostile revalidation on current tree",
  checks_executed: checks.map((check) => ({
    check_id: check.check_id,
    passed: check.passed,
    detail: check.detail
  })),
  commands: commandResults.map((command) => ({
    label: command.label,
    completed_at: command.completed_at,
    exit_status: command.exit_status
  }))
});
const lineagePath = writeJson(path.join(lineageDir, "lineage.json"), {
  generated_at: now(),
  edges: [
    {
      from_ref: treeInfo.git_head,
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.current_tree"
    },
    {
      from_ref: path.join(commercialRoot, "artifacts", "commercial-provider-proof.json"),
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.commercial_provider"
    },
    {
      from_ref: path.join(remoteRoot, "artifacts", "remote-dashboard-gateway-proof.json"),
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.remote_dashboard"
    },
    {
      from_ref: path.join(toneMatrixRoot, "professional-tone-matrix.json"),
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.professional_tones"
    },
    {
      from_ref: path.join(domainMatrixRoot, "domain-glossary-matrix.json"),
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.domain_glossary_matrix"
    },
    {
      from_ref: path.join(contextualRoot, "contextual-translation-quality-proof.json"),
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.contextual_quality"
    },
    {
      from_ref: path.join(dashboardSampleRoot, "artifacts", "live-visual", "live-fidelity-proof.json"),
      to_ref: proofPath,
      transform_ref: "arabic_localization_lct.hostile_revalidation.live_visual_dashboard"
    }
  ]
});

console.log(`localization-hostile-revalidation-root=${proofRoot}`);
console.log(`localization-hostile-revalidation-proof=${proofPath}`);
console.log(`localization-hostile-revalidation-evidence=${evidencePath}`);
console.log(`localization-hostile-revalidation-audit=${auditPath}`);
console.log(`localization-hostile-revalidation-lineage=${lineagePath}`);
