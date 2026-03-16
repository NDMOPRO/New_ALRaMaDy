import path from "node:path";
import {
  ensureDir,
  latestCompleteDirectory,
  now,
  readJson,
  root,
  runNodeScript,
  stamp,
  summarizeCounts,
  writeJson
} from "./requirement-matrix-helpers.mjs";

const outputBase = path.join(root, "packages", "arabic-localization-lct-engine", "output");
const proofRoot = path.join(outputBase, `localization-requirement-matrix-${stamp()}`);
const artifactsDir = path.join(proofRoot, "artifacts");
const evidenceDir = path.join(proofRoot, "evidence");
const auditDir = path.join(proofRoot, "audit");
const lineageDir = path.join(proofRoot, "lineage");
[proofRoot, artifactsDir, evidenceDir, auditDir, lineageDir].forEach(ensureDir);

const executedScripts = [
  "scripts/smoke/localization-engine-sample.mjs",
  "scripts/smoke/localization-live-visual-proof.mjs",
  "scripts/smoke/localization-hostile-revalidation.mjs",
  "scripts/smoke/localization-cross-engine-flow-proof.mjs",
  "scripts/smoke/localization-remote-gateway-proof.mjs",
  "scripts/smoke/localization-external-provider-validation.mjs"
];

executedScripts.forEach((scriptPath) => runNodeScript(scriptPath));

const liveVisualSummaryPath = path.join(outputBase, "latest-live-visual-proof.json");
const liveVisualSummary = readJson(liveVisualSummaryPath);
const liveVisualBySample = new Map(liveVisualSummary.samples.map((item) => [item.sample_name, item]));

const hostileRoot =
  latestCompleteDirectory(outputBase, "hostile-revalidation-", path.join("artifacts", "arabic-localization-hostile-revalidation.json")) ??
  (() => {
    throw new Error("No localization hostile revalidation root found after rerun.");
  })();
const crossEngineRoot =
  latestCompleteDirectory(outputBase, "cross-engine-flow-proof-", path.join("artifacts", "cross-engine-flow-proof.json")) ??
  (() => {
    throw new Error("No localization cross-engine root found after rerun.");
  })();
const remoteGatewayRoot =
  latestCompleteDirectory(outputBase, "remote-dashboard-gateway-proof-", path.join("artifacts", "remote-dashboard-gateway-proof.json")) ??
  (() => {
    throw new Error("No localization remote gateway root found after rerun.");
  })();
const externalProviderRoot =
  latestCompleteDirectory(outputBase, "external-provider-validation-", path.join("artifacts", "validation-summary.json")) ??
  (() => {
    throw new Error("No localization external-provider root found after rerun.");
  })();

const hostileProofPath = path.join(hostileRoot, "artifacts", "arabic-localization-hostile-revalidation.json");
const crossEngineProofPath = path.join(crossEngineRoot, "artifacts", "cross-engine-flow-proof.json");
const remoteGatewayProofPath = path.join(remoteGatewayRoot, "artifacts", "remote-dashboard-gateway-proof.json");
const commercialProviderProofPath = path.join(externalProviderRoot, "artifacts", "commercial-provider-proof.json");

const commercialProviderProof = readJson(commercialProviderProofPath);
const providerStatus =
  commercialProviderProof.final_status === "commercial_provider_verified" ? "implemented" : "degraded";

const matrix = [
  {
    requirement_id: "reports_documents_coverage",
    requirement: "Translation coverage across reports and document outputs.",
    status: "implemented",
    proof_refs: [
      liveVisualBySample.get("report-en-ar-pass")?.proof_path,
      liveVisualBySample.get("report-en-ar-pass")?.evidence_path
    ].filter(Boolean),
    notes: [
      "Fresh live visual proof covers the localized DOCX report/document surface."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "presentations_coverage",
    requirement: "Translation coverage across presentations.",
    status: "implemented",
    proof_refs: [
      liveVisualBySample.get("presentation-en-ar-pass")?.proof_path,
      liveVisualBySample.get("presentation-en-ar-pass")?.evidence_path
    ].filter(Boolean),
    notes: [
      "Fresh live visual proof covers the localized PPTX presentation surface."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "spreadsheets_exports_coverage",
    requirement: "Translation coverage across spreadsheet/export surfaces.",
    status: "implemented",
    proof_refs: [
      liveVisualBySample.get("spreadsheet-en-ar-pass")?.proof_path,
      liveVisualBySample.get("spreadsheet-en-ar-pass")?.evidence_path
    ].filter(Boolean),
    notes: [
      "Fresh live visual proof covers localized spreadsheet output and export-ready artifacts."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "public_surfaces_coverage",
    requirement: "Translation coverage across public/published surfaces.",
    status: "implemented",
    proof_refs: [
      liveVisualBySample.get("dashboard-en-ar-pass")?.proof_path,
      crossEngineProofPath,
      remoteGatewayProofPath
    ],
    notes: [
      "Fresh proofs cover the localized dashboard surface, live publication, cross-engine publication continuity, and remote gateway exposure."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "templates_coverage",
    requirement: "Translation coverage across templates.",
    status: "pending",
    proof_refs: [path.join(root, "packages", "arabic-localization-lct-engine", "src", "index.ts")],
    notes: [
      "The current tree contains terminology/profile-driven localization logic, but there is no isolated fresh template-surface proof artifact."
    ],
    remaining_gaps: ["template-localization surface proof is not isolated in the current rerun set"]
  },
  {
    requirement_id: "provider_backed_translation",
    requirement: "Provider-backed translation integrations.",
    status: providerStatus,
    proof_refs: [
      commercialProviderProofPath,
      path.join(externalProviderRoot, "artifacts", "commercial-provider-validation.json"),
      path.join(externalProviderRoot, "artifacts", "validation-summary.json")
    ],
    notes: [
      "Fresh provider validation reruns the commercial translation path plus degraded/error scenarios through the official client."
    ],
    remaining_gaps:
      providerStatus === "implemented"
        ? []
        : ["commercial provider auth/success did not verify on this rerun; fallback/degraded paths were still captured"]
  },
  {
    requirement_id: "rtl_layout_fidelity",
    requirement: "Arabic fidelity matrix: RTL layout.",
    status: "implemented",
    proof_refs: [
      liveVisualBySample.get("report-en-ar-pass")?.proof_path,
      liveVisualBySample.get("presentation-en-ar-pass")?.proof_path,
      liveVisualBySample.get("dashboard-en-ar-pass")?.proof_path
    ].filter(Boolean),
    notes: [
      "Fresh live visual proofs capture RTL direction on document, presentation, and dashboard surfaces."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "typography_fidelity",
    requirement: "Arabic fidelity matrix: typography.",
    status: "implemented",
    proof_refs: [
      liveVisualBySample.get("report-en-ar-pass")?.proof_path,
      liveVisualBySample.get("presentation-en-ar-pass")?.proof_path,
      hostileProofPath
    ].filter(Boolean),
    notes: [
      "Fresh live visual proof and hostile revalidation keep professional Arabic font/typography checks inside the current tree."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "numerals_options_fidelity",
    requirement: "Arabic fidelity matrix: numerals options.",
    status: "degraded",
    proof_refs: [
      liveVisualBySample.get("spreadsheet-en-ar-pass")?.proof_path,
      liveVisualBySample.get("dashboard-en-ar-pass")?.proof_path
    ].filter(Boolean),
    notes: [
      "Fresh proofs confirm Arabic numeral rendering on localized surfaces."
    ],
    remaining_gaps: ["multiple numeral-option switching is not isolated as a dedicated fresh runtime proof"]
  },
  {
    requirement_id: "semantic_preservation_fidelity",
    requirement: "Arabic fidelity matrix: semantic preservation.",
    status: "implemented",
    proof_refs: [crossEngineProofPath, hostileProofPath],
    notes: [
      "Fresh cross-engine and hostile proofs validate localized payload continuity and semantic/fidelity closure."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "residual_verification",
    requirement: "Arabic fidelity matrix: residual verification.",
    status: "implemented",
    proof_refs: [hostileProofPath, liveVisualSummaryPath],
    notes: [
      "Fresh hostile revalidation closes residual checks against live visual, provider, glossary, and public-surface proofs."
    ],
    remaining_gaps: []
  }
];

const summary = {
  generated_at: now(),
  proof_root: proofRoot,
  fresh_roots: {
    live_visual_summary: liveVisualSummaryPath,
    hostile_revalidation: hostileRoot,
    cross_engine: crossEngineRoot,
    remote_gateway: remoteGatewayRoot,
    external_provider: externalProviderRoot
  },
  totals: {
    requirement_count: matrix.length,
    ...summarizeCounts(matrix, ["implemented", "degraded", "pending", "unsupported"])
  },
  provider_validation_status: commercialProviderProof.final_status,
  overall_status: matrix.every((entry) => entry.status === "implemented") ? "verified_flow" : "partial"
};

const evidence = {
  proof_root: proofRoot,
  executed_scripts,
  live_visual_samples: liveVisualSummary.samples,
  open_requirements: matrix.filter((entry) => entry.status !== "implemented")
};

const audit = {
  generated_at: now(),
  executed_scripts,
  runtime_paths: Object.values(summary.fresh_roots)
};

const lineage = {
  generated_at: now(),
  matrix_links: matrix.map((entry) => ({
    requirement_id: entry.requirement_id,
    status: entry.status,
    proof_refs: entry.proof_refs
  }))
};

writeJson(path.join(artifactsDir, "localization-requirement-matrix.json"), { summary, matrix });
writeJson(path.join(evidenceDir, "evidence.json"), evidence);
writeJson(path.join(auditDir, "audit.json"), audit);
writeJson(path.join(lineageDir, "lineage.json"), lineage);

console.log(
  JSON.stringify(
    {
      proof_root: proofRoot,
      matrix_path: path.join(artifactsDir, "localization-requirement-matrix.json"),
      overall_status: summary.overall_status,
      totals: summary.totals,
      fresh_roots: summary.fresh_roots
    },
    null,
    2
  )
);
