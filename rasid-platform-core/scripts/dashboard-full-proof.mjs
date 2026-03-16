import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const proofRoot = path.join(root, ".runtime", "dashboard-full-proof", `run-${stamp}`);
const artifactsRoot = path.join(proofRoot, "artifacts");
const evidenceRoot = path.join(proofRoot, "evidence");
const auditRoot = path.join(proofRoot, "audit");
const lineageRoot = path.join(proofRoot, "lineage");

fs.mkdirSync(artifactsRoot, { recursive: true });
fs.mkdirSync(evidenceRoot, { recursive: true });
fs.mkdirSync(auditRoot, { recursive: true });
fs.mkdirSync(lineageRoot, { recursive: true });

const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const exists = (filePath) => fs.existsSync(filePath);
const latestDirectory = (directoryPath) => {
  if (!exists(directoryPath)) return null;
  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directoryPath, entry.name));
  if (entries.length === 0) return null;
  return entries.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
};
const latestMatchingDirectory = (directoryPath, prefix) => {
  if (!exists(directoryPath)) return null;
  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(directoryPath, entry.name));
  if (entries.length === 0) return null;
  return entries.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
};
const latestCompleteDirectory = (directoryPath, prefix, requiredRelativePath) => {
  if (!exists(directoryPath)) return null;
  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(directoryPath, entry.name))
    .filter((entry) => exists(path.join(entry, requiredRelativePath)));
  if (entries.length === 0) return null;
  return entries.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
};

const run = (name, command, args) => {
  const startedAt = new Date().toISOString();
  const resolvedCommand = process.platform === "win32" ? "cmd.exe" : command;
  const resolvedArgs = process.platform === "win32" ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args;
  const result = spawnSync(resolvedCommand, resolvedArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const finishedAt = new Date().toISOString();
  const payload = {
    name,
    command: [command, ...args].join(" "),
    started_at: startedAt,
    finished_at: finishedAt,
    status: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error ? { message: result.error.message, stack: result.error.stack ?? null } : null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
  writeJson(path.join(artifactsRoot, `${name}.command.json`), payload);
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${name} failed with status ${result.status ?? 1}`);
  }
  return payload;
};

const npmCommand = "npm";
const commands = [
  ["lint", npmCommand, ["run", "lint"]],
  ["typecheck", npmCommand, ["run", "typecheck"]],
  ["dashboard-web", npmCommand, ["run", "test:dashboard-web"]],
  ["dashboard-publication", npmCommand, ["run", "test:dashboard-publication"]],
  ["dashboard-ai-surface", npmCommand, ["run", "test:dashboard-ai-surface"]]
];

const commandResults = commands.map(([name, command, args]) => run(name, command, args));

const dashboardWebProofPath = path.join(root, ".runtime", "dashboard-web-proof", "dashboard-web-regression.json");
const dashboardPublicationProofPath = path.join(root, ".runtime", "dashboard-publication-proof", "dashboard-publication-interaction-proof.json");
const dashboardOpenItemsProofPath = path.join(root, ".runtime", "dashboard-open-proof", "dashboard-open-items-proof.json");
const dashboardDragProofPath = path.join(root, ".runtime", "dashboard-drag-proof", "dashboard-drag-binding-proof.json");
const dashboardDragCompleteProofPath = path.join(root, ".runtime", "dashboard-drag-complete-proof", "dashboard-drag-completeness-proof.json");
const dashboardCompareGovernanceProofPath = path.join(root, ".runtime", "dashboard-compare-governance-proof", "dashboard-compare-governance-proof.json");
const dashboardAiProofPath = path.join(root, ".runtime", "dashboard-ai-proof", "dashboard-ai-surface-proof.json");
const governanceProofPath = path.join(root, ".runtime", "governance-proof", "governance-engine-regression.json");
const governanceHostileProofPath = path.join(root, ".runtime", "governance-hostile-proof", "governance-hostile-revalidation.json");

const livePerformanceRoot = latestCompleteDirectory(path.join(root, "packages", "dashboard-engine", "output"), "live-performance-", path.join("artifacts", "dashboard-load-proof.json"));
const reportEngineRoot = latestCompleteDirectory(path.join(root, "packages", "report-engine", "artifacts", "latest-run"), "report-regression-", path.join("records", "summary.json"));
const presentationsRoot = latestCompleteDirectory(path.join(root, "packages", "presentations-engine", "artifacts", "latest-run"), "presentation-regression-", path.join("records", "summary.json"));
const excelRoot = latestCompleteDirectory(path.join(root, "packages", "excel-engine", "output"), "sample-run-", path.join("evidence", "evidence-pack.json"));

const strictRoot = path.join(root, "packages", "strict-replication-engine", "runtime", "outputs");
const strictSummaryPath = path.join(strictRoot, "phase8-summary.json");
const strictBrowserEvidencePath = path.join(strictRoot, "browser-matrix", "evidence.json");
const strictBrowserAuditPath = path.join(strictRoot, "browser-matrix", "audit.json");
const strictBrowserLineagePath = path.join(strictRoot, "browser-matrix", "lineage.json");
const strictImageDashboardGatePath = path.join(strictRoot, "real-image-to-dashboard", "editable-core-gate.json");
const strictPdfDashboardGatePath = path.join(strictRoot, "real-pdf-to-bi-dashboard", "editable-core-gate.json");
const strictDeterminismPath = path.join(strictRoot, "real-image-to-dashboard", "determinism-report.json");
const strictPixelPath = path.join(strictRoot, "real-image-to-dashboard", "pixel-diff-report.json");
const strictCdrPath = path.join(strictRoot, "real-image-to-dashboard", "cdr-snapshot.json");

const proof = {
  generated_at: new Date().toISOString(),
  proof_root: proofRoot,
  executed_commands: commandResults.map((entry) => ({
    name: entry.name,
    command: entry.command,
    status: entry.status,
    started_at: entry.started_at,
    finished_at: entry.finished_at
  })),
  fresh_roots: {
    dashboard_web: dashboardWebProofPath,
    dashboard_publication: dashboardPublicationProofPath,
    dashboard_open_items: dashboardOpenItemsProofPath,
    dashboard_drag: dashboardDragProofPath,
    dashboard_drag_completeness: dashboardDragCompleteProofPath,
    dashboard_compare_governance: dashboardCompareGovernanceProofPath,
    dashboard_ai_surface: dashboardAiProofPath,
    governance: governanceProofPath,
    governance_hostile: governanceHostileProofPath,
    report_engine: reportEngineRoot,
    presentations: presentationsRoot,
    excel_engine: excelRoot,
    live_performance: livePerformanceRoot,
    strict_outputs: strictRoot
  },
  claim_index: {
    live_workspace_and_runtime: {
      runtime_paths: [
        "npm run test:dashboard-web",
        "npm run test:dashboard-publication",
        "npm run test:dashboard-open-items"
      ],
      proofs: [
        dashboardWebProofPath,
        dashboardPublicationProofPath,
        dashboardOpenItemsProofPath
      ],
      highlights: {
        dashboard_web: readJson(dashboardWebProofPath),
        publication: readJson(dashboardPublicationProofPath),
        open_items: readJson(dashboardOpenItemsProofPath)
      }
    },
    interactive_dashboard_behavior: {
      runtime_paths: [
        "npm run test:dashboard-open-items",
        "npm run test:dashboard-drag",
        "npm run test:dashboard-drag-completeness",
        "npm run test:dashboard-publication"
      ],
      proofs: [
        dashboardOpenItemsProofPath,
        dashboardDragProofPath,
        dashboardDragCompleteProofPath,
        dashboardPublicationProofPath
      ],
      highlights: {
        open_items: readJson(dashboardOpenItemsProofPath),
        drag_binding: readJson(dashboardDragProofPath),
        drag_completeness: readJson(dashboardDragCompleteProofPath),
        publication: readJson(dashboardPublicationProofPath)
      }
    },
    governance_permissions_versioning_library: {
      runtime_paths: [
        "npm run test:dashboard-compare-governance",
        "npm run test:governance-engine",
        "npm run test:governance-hostile"
      ],
      proofs: [
        dashboardCompareGovernanceProofPath,
        governanceProofPath,
        governanceHostileProofPath
      ],
      highlights: {
        dashboard_governance: readJson(dashboardCompareGovernanceProofPath),
        governance_engine: readJson(governanceProofPath),
        governance_hostile: readJson(governanceHostileProofPath)
      }
    },
    ai_first_and_action_runtime: {
      runtime_paths: [
        "npm run test:dashboard-ai-surface"
      ],
      proofs: [dashboardAiProofPath],
      highlights: readJson(dashboardAiProofPath)
    },
    outputs_and_exports: {
      runtime_paths: [
        "npm run test:report-engine",
        "npm run test:presentations-engine",
        "npm run test:excel-engine"
      ],
      proofs: [
        reportEngineRoot,
        presentationsRoot,
        excelRoot,
        strictRoot
      ],
      highlights: {
        report_engine_summary: reportEngineRoot ? readJson(path.join(reportEngineRoot, "records", "summary.json")) : null,
        report_engine_evidence: reportEngineRoot ? readJson(path.join(reportEngineRoot, "records", "evidence-packs.json")) : null,
        presentations_summary: presentationsRoot ? readJson(path.join(presentationsRoot, "records", "summary.json")) : null,
        presentations_parity: presentationsRoot ? readJson(path.join(presentationsRoot, "records", "parity-validation.json")) : null,
        excel_evidence: excelRoot ? readJson(path.join(excelRoot, "evidence", "evidence-pack.json")) : null,
        strict_summary: readJson(strictSummaryPath),
        strict_image_dashboard_gate: readJson(strictImageDashboardGatePath),
        strict_pdf_dashboard_gate: readJson(strictPdfDashboardGatePath)
      }
    },
    strict_import_and_reconstruction: {
      runtime_paths: [
        "npm run test:strict-regression"
      ],
      proofs: [
        strictSummaryPath,
        strictImageDashboardGatePath,
        strictPdfDashboardGatePath,
        strictDeterminismPath,
        strictPixelPath,
        strictCdrPath
      ],
      highlights: {
        summary: readJson(strictSummaryPath),
        pixel: readJson(strictPixelPath),
        determinism: readJson(strictDeterminismPath),
        image_dashboard_gate: readJson(strictImageDashboardGatePath),
        pdf_dashboard_gate: readJson(strictPdfDashboardGatePath),
        cdr_snapshot_path: strictCdrPath
      }
    },
    observability_and_performance: {
      runtime_paths: [
        "npm run test:dashboard-live-performance"
      ],
      proofs: livePerformanceRoot
        ? [
            path.join(livePerformanceRoot, "artifacts", "dashboard-load-proof.json"),
            path.join(livePerformanceRoot, "artifacts", "concurrent-50k-proof.json"),
            path.join(livePerformanceRoot, "artifacts", "websocket-scaleout-proof.json"),
            path.join(livePerformanceRoot, "artifacts", "fallback-cache-proof.json"),
            path.join(livePerformanceRoot, "artifacts", "live-stream-pressure-proof.json")
          ]
        : [],
      highlights: livePerformanceRoot
        ? {
            load: readJson(path.join(livePerformanceRoot, "artifacts", "dashboard-load-proof.json")),
            concurrent: readJson(path.join(livePerformanceRoot, "artifacts", "concurrent-50k-proof.json")),
            scaleout: readJson(path.join(livePerformanceRoot, "artifacts", "websocket-scaleout-proof.json")),
            fallback: readJson(path.join(livePerformanceRoot, "artifacts", "fallback-cache-proof.json")),
            stream: readJson(path.join(livePerformanceRoot, "artifacts", "live-stream-pressure-proof.json"))
          }
        : null
    }
  }
};

const evidence = {
  proof_root: proofRoot,
  fresh_roots: proof.fresh_roots,
  evidence_files: {
    dashboard_publication: path.join(root, ".runtime", "dashboard-web", "dashboard-engine"),
    report_engine: reportEngineRoot ? path.join(reportEngineRoot, "records", "evidence-packs.json") : null,
    presentations_evidence_packs: presentationsRoot ? path.join(presentationsRoot, "records", "evidence-packs.json") : null,
    excel_evidence_pack: excelRoot ? path.join(excelRoot, "evidence", "evidence-pack.json") : null,
    strict_browser_matrix: strictBrowserEvidencePath,
    live_performance: livePerformanceRoot ? path.join(livePerformanceRoot, "evidence", "evidence.json") : null,
    dashboard_ai_surface: dashboardAiProofPath
  },
  command_count: proof.executed_commands.length
};

const audit = {
  generated_at: new Date().toISOString(),
  executed_commands: proof.executed_commands,
  fresh_runtime_paths: {
    dashboard_routes: [
      "/dashboards",
      "/api/v1/dashboards/create",
      "/api/v1/dashboards/refresh",
      "/api/v1/dashboards/compare",
      "/api/v1/dashboards/publish",
      "/api/v1/dashboards/export-widget-target",
      "/api/v1/dashboards/rebind-widget",
      "/api/v1/dashboards/interactions/filter",
      "/api/v1/dashboards/interactions/drill",
      "/api/v1/dashboards/interactions/refresh",
      "/api/v1/dashboards/interactions/compare",
      "/publications/<id>/runtime-state",
      "/publications/<id>/interactions/*"
    ],
    integration_routes: [
      "/api/v1/reports/reports/:id/export/pdf",
      "/api/v1/reports/reports/:id/export/docx",
      "/api/v1/presentations/decks/:id/export/pptx",
      "/api/v1/presentations/decks/:id/export/pdf",
      "/api/v1/presentations/decks/:id/export/html"
    ]
  }
};

const lineage = {
  generated_at: new Date().toISOString(),
  source_proof_roots: [
    dashboardWebProofPath,
    dashboardPublicationProofPath,
    dashboardOpenItemsProofPath,
    dashboardDragProofPath,
    dashboardDragCompleteProofPath,
    dashboardCompareGovernanceProofPath,
    dashboardAiProofPath,
    governanceProofPath,
    governanceHostileProofPath,
    reportEngineRoot,
    presentationsRoot,
    excelRoot,
    livePerformanceRoot,
    strictSummaryPath,
    strictBrowserAuditPath,
    strictBrowserLineagePath
  ].filter(Boolean),
  downstream_links: {
    report_engine_dashboard_conversion: reportEngineRoot ? path.join(reportEngineRoot, "records", "dashboard-conversion.json") : null,
    report_engine_exports: reportEngineRoot
      ? [
          path.join(reportEngineRoot, "records", "cli-export-output.json"),
          path.join(reportEngineRoot, "records", "publication-transport.json"),
          path.join(reportEngineRoot, "records", "native-dashboard-publication.json")
        ]
      : [],
    presentations_exports: presentationsRoot
      ? [
          path.join(presentationsRoot, "export.pptx"),
          path.join(presentationsRoot, "export.pdf"),
          path.join(presentationsRoot, "export.html")
        ]
      : [],
    excel_exports: excelRoot
      ? [
          path.join(excelRoot, "artifacts", "sample-output.xlsx"),
          path.join(excelRoot, "artifacts", "easy-mode-output.xlsx"),
          path.join(excelRoot, "artifacts", "desktop-proof-output.xlsx")
        ]
      : []
  }
};

writeJson(path.join(artifactsRoot, "dashboard-full-proof.json"), proof);
writeJson(path.join(evidenceRoot, "evidence.json"), evidence);
writeJson(path.join(auditRoot, "audit.json"), audit);
writeJson(path.join(lineageRoot, "lineage.json"), lineage);

console.log(JSON.stringify(proof, null, 2));
