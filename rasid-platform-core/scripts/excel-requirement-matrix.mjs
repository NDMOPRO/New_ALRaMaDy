import path from "node:path";
import {
  ensureDir,
  exists,
  latestCompleteDirectory,
  now,
  readJson,
  root,
  runNodeScript,
  stamp,
  summarizeCounts,
  writeJson
} from "./requirement-matrix-helpers.mjs";

const outputBase = path.join(root, "packages", "excel-engine", "output");
const localizationOutputBase = path.join(root, "packages", "arabic-localization-lct-engine", "output");
const proofRoot = path.join(outputBase, `requirement-matrix-${stamp()}`);
const artifactsDir = path.join(proofRoot, "artifacts");
const evidenceDir = path.join(proofRoot, "evidence");
const auditDir = path.join(proofRoot, "audit");
const lineageDir = path.join(proofRoot, "lineage");
[proofRoot, artifactsDir, evidenceDir, auditDir, lineageDir].forEach(ensureDir);

const executedScripts = [
  "scripts/smoke/excel-engine-sample.mjs",
  "scripts/excel-merge-50-proof.mjs",
  "scripts/smoke/excel-engine-hostile-audit.mjs",
  "scripts/smoke/excel-cross-engine-consumability.mjs",
  "scripts/smoke/excel-dashboard-cross-engine.mjs",
  "scripts/excel-report-dashboard-localization-platform-flow.mjs"
];

executedScripts.forEach((scriptPath) => runNodeScript(scriptPath));

const sampleRoot =
  latestCompleteDirectory(outputBase, "sample-run-", path.join("evidence", "evidence-pack.json")) ??
  (() => {
    throw new Error("No excel sample root found after rerun.");
  })();
const merge50Root =
  latestCompleteDirectory(outputBase, "merge-50-proof-", path.join("artifacts", "merge-50-proof.json")) ??
  (() => {
    throw new Error("No excel merge-50 proof root found after rerun.");
  })();
const crossEngineRoot =
  latestCompleteDirectory(outputBase, "cross-engine-consumability-", path.join("artifacts", "cross-engine-proof.json")) ??
  (() => {
    throw new Error("No excel cross-engine proof root found after rerun.");
  })();
const dashboardRoot =
  latestCompleteDirectory(outputBase, "excel-dashboard-cross-engine-", path.join("artifacts", "cross-engine-proof.json")) ??
  (() => {
    throw new Error("No excel dashboard proof root found after rerun.");
  })();
const localizationFlowRoot =
  latestCompleteDirectory(
    localizationOutputBase,
    "excel-report-dashboard-localization-platform-flow-",
    path.join("records", "flow-proof.json")
  ) ??
  (() => {
    throw new Error("No excel localization flow root found after rerun.");
  })();

const sampleEvidencePath = path.join(sampleRoot, "evidence", "evidence-pack.json");
const hostileAuditPath = path.join(sampleRoot, "artifacts", "hostile-audit-report.json");
const formulaProofPath = path.join(sampleRoot, "artifacts", "formula-engine-proof.json");
const easyAdvancedProofPath = path.join(sampleRoot, "artifacts", "easy-advanced-proof.json");
const transformationPath = path.join(sampleRoot, "artifacts", "transformation-result.json");
const mergeWorkbooksProofPath = path.join(sampleRoot, "artifacts", "merge-workbooks-proof.json");
const merge50ProofPath = path.join(merge50Root, "artifacts", "merge-50-proof.json");
const dashboardProofPath = path.join(dashboardRoot, "artifacts", "cross-engine-proof.json");
const presentationProofPath = path.join(crossEngineRoot, "artifacts", "cross-engine-proof.json");
const localizationFlowPath = path.join(localizationFlowRoot, "records", "flow-proof.json");

const merge50Proof = readJson(merge50ProofPath);
const matrix = [
  {
    requirement_id: "canvas_excel_real",
    requirement:
      "Canvas Excel with blank grid, column drag/drop, column map, and smart join suggestions.",
    status: "partial",
    proof_refs: [transformationPath, easyAdvancedProofPath],
    notes: [
      "The current tree proves transformation previews and workbook-driven downstream creation.",
      "A dedicated live blank-grid canvas with column drag/drop and isolated smart-join UX proof is still absent."
    ],
    remaining_gaps: [
      "blank-grid canvas proof is missing",
      "column drag/drop proof is missing",
      "column map proof is limited to mapping previews, not a dedicated canvas flow",
      "smart join suggestions are not isolated as a separate fresh artifact"
    ]
  },
  {
    requirement_id: "smart_mode_pro_mode",
    requirement:
      "Smart Mode and Pro Mode with full analysis, KPIs, summary tables, suggested charts, and suggested dashboards/reports/slides.",
    status: "partial",
    proof_refs: [easyAdvancedProofPath, formulaProofPath, presentationProofPath, dashboardProofPath],
    notes: [
      "The sample root includes easy/advanced mode proof, generated charts, downstream slide generation, and dashboard/report continuation.",
      "The current proof does not isolate the requested Smart/Pro naming or a complete suggestions bundle for dashboards/reports/slides from one run artifact."
    ],
    remaining_gaps: [
      "no dedicated smart-mode proof artifact",
      "no dedicated pro-mode proof artifact",
      "suggested dashboards/reports/slides are not emitted under one Excel-owned recommendation file"
    ]
  },
  {
    requirement_id: "universal_intake",
    requirement:
      "Universal intake for CSV, TXT, PDF, images, Google Sheets, databases, and ZIP/folder upload.",
    status: "partial",
    proof_refs: [sampleEvidencePath, transformationPath],
    notes: [
      "Current-tree Excel import handles XLSX/XLS/XLSM/CSV/TSV and normalizes CSV/TSV into editable XLSX output."
    ],
    remaining_gaps: [
      "TXT intake is not isolated in a fresh proof",
      "PDF/image table intake is not implemented in excel-engine",
      "Google Sheets intake is not implemented",
      "database intake is not implemented",
      "ZIP/folder upload intake is not implemented"
    ]
  },
  {
    requirement_id: "pdf_image_table_extraction",
    requirement: "Real table extraction from PDF/images inside excel-engine.",
    status: "pending",
    proof_refs: [path.join(root, "packages", "excel-engine", "src", "engine.ts")],
    notes: [
      "Fresh Excel proofs do not produce PDF/image table extraction artifacts from excel-engine itself."
    ],
    remaining_gaps: ["no current-tree Excel-owned PDF/image extraction flow"]
  },
  {
    requirement_id: "data_architecture",
    requirement: "Arrow in-memory, Parquet on-disk, catalog, and semantic graph.",
    status: "partial",
    proof_refs: [path.join(root, "packages", "excel-engine", "src", "engine.ts"), sampleEvidencePath],
    notes: [
      "The current runtime emits workbook package, lineage, evidence, and semantic labels in workbook/canonical structures."
    ],
    remaining_gaps: [
      "Arrow in-memory is not implemented",
      "Parquet on-disk is not implemented",
      "catalog is not isolated as a current-tree runtime artifact",
      "semantic graph is partial through canonical/lineage only"
    ]
  },
  {
    requirement_id: "transform_engine",
    requirement:
      "Expression builder, Power Query-like transforms, Power Query M export when possible, and non-exportable marking.",
    status: "partial",
    proof_refs: [transformationPath, mergeWorkbooksProofPath, sampleEvidencePath],
    notes: [
      "The sample transformation plan proves rename/split/join/derive/append/group/unpivot/normalize/merge_sheets/merge_workbooks/filter/sort with mapping previews."
    ],
    remaining_gaps: [
      "Power Query M export is not implemented",
      "non-exportable step marking is not isolated as a dedicated artifact"
    ]
  },
  {
    requirement_id: "formula_engine",
    requirement:
      "Formula DAG, deterministic recalc, circular refs detection, LET/LAMBDA subset, pivot, conditional formatting, and chart support.",
    status: "implemented",
    proof_refs: [formulaProofPath, hostileAuditPath, sampleEvidencePath],
    notes: [
      "The current sample and hostile audit prove formula graph execution, circular-reference warnings, LET/LAMBDA lifecycle, pivot semantics, chart coverage, and conditional-formatting fidelity."
    ],
    remaining_gaps: []
  },
  {
    requirement_id: "data_cleaning",
    requirement:
      "Dedupe, fuzzy match, outlier detection, imputation, normalization, and quality report.",
    status: "partial",
    proof_refs: [transformationPath, sampleEvidencePath],
    notes: [
      "Normalization is present through `normalize_sheet`; duplicate/null profiling is present in workbook analysis."
    ],
    remaining_gaps: [
      "fuzzy match is not implemented",
      "outlier detection is not implemented",
      "imputation is not implemented",
      "quality report is not isolated as a dedicated artifact"
    ]
  },
  {
    requirement_id: "comparison_diff",
    requirement: "File-vs-file, table-vs-table, column-vs-column, and dataset-across-time diff.",
    status: "pending",
    proof_refs: [path.join(sampleRoot, "artifacts", "fidelity-comparison-proof.json")],
    notes: [
      "Current proofs only cover workbook fidelity comparison after export/reload, not business-level dataset diff modes."
    ],
    remaining_gaps: [
      "file-vs-file diff flow is not isolated",
      "table-vs-table diff flow is not isolated",
      "column-vs-column diff flow is not isolated",
      "dataset-across-time diff flow is not isolated"
    ]
  },
  {
    requirement_id: "outputs",
    requirement:
      "XLSX, CSV, Parquet, PDF report, slides deck, web dashboard, and lineage metadata outputs.",
    status: "partial",
    proof_refs: [sampleEvidencePath, presentationProofPath, dashboardProofPath, localizationFlowPath],
    notes: [
      "Fresh proofs cover editable XLSX, downstream report/dashboard generation, slide deck creation, localized published dashboard, and lineage metadata."
    ],
    remaining_gaps: [
      "CSV export is not isolated as an output artifact",
      "Parquet export is not implemented",
      "PDF report is only available through downstream report-engine, not an Excel-owned export slice"
    ]
  },
  {
    requirement_id: "recipes_operation_memory",
    requirement: "Save, version, replay, and monthly folder application for recipes/operation memory.",
    status: "pending",
    proof_refs: [sampleEvidencePath],
    notes: [
      "Workbook versions exist, but recipe save/version/replay/monthly-folder automation is not isolated as an Excel-owned capability."
    ],
    remaining_gaps: [
      "recipe save is not implemented",
      "recipe replay is not implemented",
      "apply-to-folder monthly flow is not implemented"
    ]
  },
  {
    requirement_id: "ai_for_excel",
    requirement: "NLQ, auto analyze, predictive, and what-if.",
    status: "partial",
    proof_refs: [easyAdvancedProofPath, sampleEvidencePath],
    notes: [
      "The current sample proves automated analysis and mode-specific transformation planning."
    ],
    remaining_gaps: [
      "NLQ is not implemented",
      "predictive analysis is not implemented",
      "what-if modeling is not implemented"
    ]
  },
  {
    requirement_id: "test_guards",
    requirement:
      "No hardcoded demo data, no fake success, 50 files merge proof, diff correctness, no UI freeze, and evidence mandatory.",
    status: "partial",
    proof_refs: [hostileAuditPath, merge50ProofPath, sampleEvidencePath],
    notes: [
      "A fresh repository-local `50 files merge proof` now exists and evidence/audit/lineage remain mandatory on current roots.",
      "The built-in sample still uses hardcoded fixture data."
    ],
    remaining_gaps: [
      "hardcoded demo/sample data remains in the built-in sample flow",
      "diff correctness proof is not implemented",
      "no-UI-freeze proof is not implemented"
    ]
  }
];

const summary = {
  generated_at: now(),
  proof_root: proofRoot,
  fresh_roots: {
    sample: sampleRoot,
    merge_50: merge50Root,
    cross_engine_presentation: crossEngineRoot,
    cross_engine_dashboard: dashboardRoot,
    localization_flow: localizationFlowRoot
  },
  totals: {
    requirement_count: matrix.length,
    ...summarizeCounts(matrix, ["implemented", "partial", "pending", "unsupported"])
  },
  merge_50_status: merge50Proof.status,
  overall_status: matrix.every((entry) => entry.status === "implemented") ? "verified_flow" : "partial"
};

const evidence = {
  proof_root: proofRoot,
  fresh_roots: summary.fresh_roots,
  executed_scripts: executedScripts,
  merge_50_assertions: merge50Proof.assertions,
  partial_requirements: matrix
    .filter((entry) => entry.status !== "implemented")
    .map((entry) => ({ requirement_id: entry.requirement_id, status: entry.status, remaining_gaps: entry.remaining_gaps }))
};

const audit = {
  generated_at: now(),
  executed_scripts,
  runtime_paths: [
    sampleRoot,
    merge50Root,
    crossEngineRoot,
    dashboardRoot,
    localizationFlowRoot
  ]
};

const lineage = {
  generated_at: now(),
  matrix_links: matrix.map((entry) => ({
    requirement_id: entry.requirement_id,
    status: entry.status,
    proof_refs: entry.proof_refs
  }))
};

writeJson(path.join(artifactsDir, "excel-requirement-matrix.json"), { summary, matrix });
writeJson(path.join(evidenceDir, "evidence.json"), evidence);
writeJson(path.join(auditDir, "audit.json"), audit);
writeJson(path.join(lineageDir, "lineage.json"), lineage);

console.log(
  JSON.stringify(
    {
      proof_root: proofRoot,
      matrix_path: path.join(artifactsDir, "excel-requirement-matrix.json"),
      overall_status: summary.overall_status,
      totals: summary.totals,
      fresh_roots: summary.fresh_roots
    },
    null,
    2
  )
);
