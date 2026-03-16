import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const startedAt = Date.now();
const root = process.cwd();
const proofRoot = path.join(root, ".runtime", "governance-cross-engine-proof");
const proofFile = path.join(proofRoot, "governance-cross-engine-coverage-proof.json");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const fileFresh = (filePath) => fs.statSync(filePath).mtimeMs >= startedAt;

const runNodeScript = (scriptPath) =>
  new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      cwd: root,
      stdio: "inherit",
      env: process.env
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`script failed: ${scriptPath} (${code ?? "null"})`));
    });
  });

const requireTrue = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

ensureDir(proofRoot);

await runNodeScript(path.join("scripts", "governance-engine-regression.mjs"));
await runNodeScript(path.join("scripts", "governance-unauthorized-write-regression.mjs"));
await runNodeScript(path.join("scripts", "governance-cross-engine-strict-proof.mjs"));
await runNodeScript(path.join("scripts", "governance-cross-engine-report-presentation-proof.mjs"));
await runNodeScript(path.join("scripts", "ai-engine-regression.mjs"));

const governanceProofPath = path.join(root, ".runtime", "governance-proof", "governance-engine-regression.json");
const unauthorizedProofPath = path.join(root, ".runtime", "governance-proof", "governance-unauthorized-write-matrix.json");
const strictProofPath = path.join(root, ".runtime", "governance-cross-engine-proof", "governance-cross-engine-strict-proof.json");
const reportPresentationProofPath = path.join(root, ".runtime", "governance-cross-engine-proof", "governance-cross-engine-report-presentation-proof.json");
const aiProofPath = path.join(root, ".runtime", "ai-engine-proof", "ai-engine-regression.json");

for (const filePath of [governanceProofPath, unauthorizedProofPath, strictProofPath, reportPresentationProofPath, aiProofPath]) {
  requireTrue(fs.existsSync(filePath), `missing proof file: ${filePath}`);
  requireTrue(fileFresh(filePath), `stale proof file: ${filePath}`);
}

const governanceProof = readJson(governanceProofPath);
const unauthorizedProof = readJson(unauthorizedProofPath);
const strictProof = readJson(strictProofPath);
const reportPresentationProof = readJson(reportPresentationProofPath);
const aiProof = readJson(aiProofPath);

const writePathRoutes = new Set((governanceProof.governed_write_paths ?? []).map((entry) => entry.route));
for (const route of [
  "/api/v1/dashboards/publish",
  "/api/v1/dashboards/share",
  "/api/v1/dashboards/export-widget-target",
  "/api/v1/reports/convert-to-dashboard",
  "/api/v1/reports/convert-to-presentation",
  "/api/v1/presentations/convert-to-dashboard",
  "/api/v1/replication/consume-dashboard-output",
  "/api/v1/localization/consume-dashboard-output",
  "/api/v1/ai/jobs"
]) {
  requireTrue(writePathRoutes.has(route), `missing governed write path: ${route}`);
}

requireTrue(governanceProof.publish_boundary?.status === 202, "publish boundary did not return approval_required");
requireTrue(typeof governanceProof.publish_publication?.publication_id === "string", "publish finalize did not materialize publication");
requireTrue(typeof governanceProof.publish_governance?.audit === "string", "publish finalize missing governance audit");
requireTrue(governanceProof.share_boundary?.status === 202, "share boundary did not return approval_required");
requireTrue(typeof governanceProof.share_publication?.publication_id === "string", "share finalize did not materialize publication");
requireTrue(typeof governanceProof.share_governance?.audit === "string", "share finalize missing governance audit");
requireTrue(governanceProof.schedule_boundary?.status === 202, "schedule boundary did not return approval_required");
requireTrue(typeof governanceProof.schedule_payload?.schedule_id === "string", "schedule finalize did not materialize schedule");
requireTrue(typeof governanceProof.schedule_governance?.audit === "string", "schedule finalize missing governance audit");
requireTrue(governanceProof.export_result?.governance?.decision?.decision === "allowed", "export mutation missing governed allow decision");
requireTrue(governanceProof.report_conversion?.governance?.decision?.decision === "allowed", "report conversion missing governed allow decision");
requireTrue(governanceProof.localization_consume?.governance?.decision?.decision === "allowed", "localization consume missing governed allow decision");
requireTrue(typeof governanceProof.export_result?.transfer?.transfer_id === "string", "export mutation missing transfer artifact");
requireTrue(typeof governanceProof.report_conversion?.open_path === "string", "report conversion missing governed open_path");
requireTrue(typeof governanceProof.localization_consume?.open_path === "string", "localization consume missing governed open_path");

const unauthorizedByLabel = new Map((unauthorizedProof.results ?? []).map((entry) => [entry.label, entry]));
for (const label of [
  "dashboard_publish",
  "dashboard_share",
  "dashboard_export",
  "report_convert",
  "report_convert_presentation",
  "presentation_convert_dashboard",
  "ai_jobs",
  "strict_route",
  "localization_route"
]) {
  const entry = unauthorizedByLabel.get(label);
  requireTrue(Boolean(entry), `missing unauthorized probe: ${label}`);
  requireTrue(entry.denied === true && entry.status === 403 && entry.error === "governance_denied", `unauthorized probe not denied: ${label}`);
}
requireTrue(unauthorizedProof.all_denied === true, "unauthorized matrix is not fully denied");

requireTrue(strictProof.boundary?.status === 202 && strictProof.boundary?.error === "approval_required", "strict boundary is not enforcing approval_required");
requireTrue(strictProof.approved_mutation?.status === 200, "strict approved mutation failed");
requireTrue(strictProof.unauthorized?.viewer?.status === 403 && strictProof.unauthorized?.editor?.status === 403, "strict unauthorized probes did not deny");
requireTrue(strictProof.lineage?.before_denied_count === strictProof.lineage?.after_denied_count, "strict denied probes emitted lineage");

requireTrue(reportPresentationProof.report_to_presentation?.boundary?.status === 202, "report->presentation boundary did not return approval_required");
requireTrue(reportPresentationProof.report_to_presentation?.boundary?.payload?.error === "approval_required", "report->presentation boundary missing approval_required error");
requireTrue(typeof reportPresentationProof.report_to_presentation?.approved?.deck_id === "string", "report->presentation approved mutation missing deck_id");
requireTrue(reportPresentationProof.presentation_to_dashboard?.boundary?.status === 202, "presentation->dashboard boundary did not return approval_required");
requireTrue(reportPresentationProof.presentation_to_dashboard?.boundary?.payload?.error === "approval_required", "presentation->dashboard boundary missing approval_required error");
requireTrue(typeof reportPresentationProof.presentation_to_dashboard?.approved?.presentation_bridge?.dashboard_id === "string", "presentation->dashboard approved mutation missing dashboard");
requireTrue(reportPresentationProof.publish?.boundary?.status === 202, "report-presentation publish boundary missing");
requireTrue(reportPresentationProof.share?.boundary?.status === 202, "report-presentation share boundary missing");
requireTrue(reportPresentationProof.export?.governance?.decision?.decision === "allowed", "report-presentation export not governed");
for (const key of [
  "viewer_report_to_presentation",
  "viewer_presentation_to_dashboard",
  "editor_report_to_presentation",
  "editor_presentation_to_dashboard"
]) {
  const entry = reportPresentationProof.unauthorized?.[key];
  requireTrue(entry?.status === 403 && entry?.payload?.error === "governance_denied", `report-presentation unauthorized probe not denied: ${key}`);
}
requireTrue(
  reportPresentationProof.lineage?.before_denied_count === reportPresentationProof.lineage?.after_denied_count,
  "report-presentation denied probes emitted lineage"
);

const pageChecks = new Map((aiProof.live_environment?.pages_checked ?? []).map((entry) => [entry.page, entry]));
for (const pagePath of ["/excel", "/reports", "/presentations", "/replication", "/localization", "/governance"]) {
  const entry = pageChecks.get(pagePath);
  requireTrue(entry?.status === 200 && entry?.has_ai_surface === true, `ai surface missing on ${pagePath}`);
}

const excelPending = aiProof.no_auto_apply_boundary?.excel_engine;
const reportsPending = aiProof.no_auto_apply_boundary?.report_engine;
const localizationPending = aiProof.no_auto_apply_boundary?.arabic_localization_lct_engine;
const strictPending = aiProof.no_auto_apply_boundary?.strict_replication_engine;
for (const [label, payload] of [
  ["excel", excelPending],
  ["reports", reportsPending],
  ["localization", localizationPending],
  ["strict", strictPending]
]) {
  requireTrue(payload?.status?.state === "awaiting_approval", `ai no-auto-apply boundary missing for ${label}`);
  requireTrue(Array.isArray(payload?.audit?.event_types) && payload.audit.event_types.length > 0, `ai audit missing for ${label}`);
  requireTrue(Array.isArray(payload?.lineage?.relations) && payload.lineage.relations.length > 0, `ai lineage missing for ${label}`);
}

const aiApproved = aiProof.editable_apply_remaining_engines ?? {};
requireTrue(aiApproved.excel_engine?.approved?.status?.state === "completed", "approved AI excel path did not complete");
requireTrue(aiApproved.report_engine?.approved?.status?.state === "completed", "approved AI report path did not complete");
requireTrue(aiApproved.strict_replication_engine?.approved?.status?.state === "completed", "approved AI strict path did not complete");
requireTrue(
  ["completed", "degraded"].includes(aiApproved.arabic_localization_lct_engine?.approved?.status?.state ?? ""),
  "approved AI localization path did not execute"
);
requireTrue(
  Array.isArray(aiApproved.arabic_localization_lct_engine?.approved?.audit?.event_types) &&
    aiApproved.arabic_localization_lct_engine.approved.audit.event_types.length > 0,
  "approved AI localization path missing audit"
);
requireTrue(
  Array.isArray(aiApproved.arabic_localization_lct_engine?.approved?.lineage?.relations) &&
    aiApproved.arabic_localization_lct_engine.approved.lineage.relations.length > 0,
  "approved AI localization path missing lineage"
);
requireTrue(Array.isArray(aiProof.permission_failure?.summary?.failure_summaries) && aiProof.permission_failure.summary.failure_summaries.length > 0, "AI permission failure summary missing");

const proof = {
  created_at: new Date().toISOString(),
  phase_requirement: "governance coverage across all shared paths",
  proof_roots: {
    governance: governanceProofPath,
    unauthorized: unauthorizedProofPath,
    strict: strictProofPath,
    report_presentation: reportPresentationProofPath,
    ai: aiProofPath
  },
  real_runtime_paths: {
    governance: {
      base_url: governanceProof.base_url,
      governance_page: `${governanceProof.base_url}/governance`,
      dashboards_publish_route: "/api/v1/dashboards/publish",
      dashboards_share_route: "/api/v1/dashboards/share",
      dashboards_export_route: "/api/v1/dashboards/export-widget-target",
      reports_route: "/api/v1/reports/convert-to-dashboard",
      reports_presentation_route: "/api/v1/reports/convert-to-presentation",
      presentations_route: "/api/v1/presentations/convert-to-dashboard",
      localization_route: "/api/v1/localization/consume-dashboard-output"
    },
    strict: strictProof.real_runtime_path,
    report_presentation: {
      base_url: reportPresentationProof.base_url,
      report_route: "/api/v1/reports/convert-to-presentation",
      presentation_route: "/api/v1/presentations/convert-to-dashboard",
      publish_route: "/api/v1/dashboards/publish",
      share_route: "/api/v1/dashboards/share",
      export_route: "/api/v1/dashboards/export-widget-target"
    },
    ai: {
      base_url: aiProof.live_environment?.base_url ?? null,
      pages: (aiProof.live_environment?.pages_checked ?? []).map((entry) => entry.page)
    }
  },
  cross_engine_coverage: {
    governed_write_path_count: governanceProof.governed_write_paths?.length ?? 0,
    dashboard_publication: {
      publish: {
        boundary_status: governanceProof.publish_boundary?.status ?? null,
        decision: governanceProof.publish_governance?.decision?.decision ?? null,
        audit: governanceProof.publish_governance?.audit ?? null,
        publication_id: governanceProof.publish_publication?.publication_id ?? null
      },
      share: {
        boundary_status: governanceProof.share_boundary?.status ?? null,
        decision: governanceProof.share_governance?.decision?.decision ?? null,
        audit: governanceProof.share_governance?.audit ?? null,
        publication_id: governanceProof.share_publication?.publication_id ?? null
      },
      export: {
        decision: governanceProof.export_result?.governance?.decision?.decision ?? null,
        audit: governanceProof.export_result?.governance?.audit ?? null,
        transfer_id: governanceProof.export_result?.transfer?.transfer_id ?? null
      }
    },
    shared_write_routes: {
      reports: {
        route: "/api/v1/reports/convert-to-dashboard",
        open_path: governanceProof.report_conversion?.open_path ?? null,
        audit: governanceProof.report_conversion?.governance?.audit ?? null
      },
      report_to_presentation: {
        route: "/api/v1/reports/convert-to-presentation",
        boundary_status: reportPresentationProof.report_to_presentation?.boundary?.status ?? null,
        deck_id: reportPresentationProof.report_to_presentation?.approved?.deck_id ?? null,
        audit: reportPresentationProof.audit?.report_approved ?? null
      },
      presentation_to_dashboard: {
        route: "/api/v1/presentations/convert-to-dashboard",
        boundary_status: reportPresentationProof.presentation_to_dashboard?.boundary?.status ?? null,
        dashboard_id: reportPresentationProof.presentation_to_dashboard?.approved?.presentation_bridge?.dashboard_id ?? null,
        audit: reportPresentationProof.audit?.deck_approved ?? null
      },
      localization: {
        route: "/api/v1/localization/consume-dashboard-output",
        open_path: governanceProof.localization_consume?.open_path ?? null,
        audit: governanceProof.localization_consume?.governance?.audit ?? null
      },
      strict: {
        route: strictProof.strict_route,
        boundary: strictProof.boundary,
        approved_mutation: strictProof.approved_mutation
      },
      schedule: {
        route: "/api/v1/dashboards/schedule",
        boundary_status: governanceProof.schedule_boundary?.status ?? null,
        schedule_id: governanceProof.schedule_payload?.schedule_id ?? null,
        audit: governanceProof.schedule_governance?.audit ?? null
      }
    },
    ai_paths: {
      pages_checked: aiProof.live_environment?.pages_checked ?? [],
      no_auto_apply_boundary: {
        excel: excelPending?.status?.state ?? null,
        reports: reportsPending?.status?.state ?? null,
        localization: localizationPending?.status?.state ?? null,
        strict: strictPending?.status?.state ?? null
      },
      approved_paths: {
        excel: aiApproved.excel_engine?.approved?.status?.state ?? null,
        reports: aiApproved.report_engine?.approved?.status?.state ?? null,
        localization: aiApproved.arabic_localization_lct_engine?.approved?.status?.state ?? null,
        strict: aiApproved.strict_replication_engine?.approved?.status?.state ?? null
      },
      permission_failure: aiProof.permission_failure?.summary?.failure_summaries ?? []
    },
    unauthorized_matrix: {
      result_count: unauthorizedProof.results?.length ?? 0,
      denied_count: unauthorizedProof.denied_count ?? 0,
      all_denied: unauthorizedProof.all_denied ?? false,
      covered_labels: (unauthorizedProof.results ?? []).map((entry) => entry.label)
    },
    report_presentation_flow: {
      report_boundary_status: reportPresentationProof.report_to_presentation?.boundary?.status ?? null,
      deck_boundary_status: reportPresentationProof.presentation_to_dashboard?.boundary?.status ?? null,
      publish_boundary_status: reportPresentationProof.publish?.boundary?.status ?? null,
      share_boundary_status: reportPresentationProof.share?.boundary?.status ?? null,
      denied_lineage_stable:
        reportPresentationProof.lineage?.before_denied_count === reportPresentationProof.lineage?.after_denied_count
    }
  },
  evidence: {
    dashboard_governance: {
      dashboard_id: governanceProof.dashboard_id,
      widget_ref: governanceProof.widget_ref,
      export_transfer_path: governanceProof.export_result?.transfer?.preview_path ?? null
    },
    strict_evidence: strictProof.evidence,
    report_presentation: {
      report_id: reportPresentationProof.report_id,
      deck_id: reportPresentationProof.report_to_presentation?.approved?.deck_id ?? null,
      dashboard_id: reportPresentationProof.presentation_to_dashboard?.approved?.presentation_bridge?.dashboard_id ?? null
    },
    ai_proof_root: aiProof.live_environment?.proof_root ?? null
  },
  audit: {
    publish: governanceProof.publish_governance?.audit ?? null,
    share: governanceProof.share_governance?.audit ?? null,
    export: governanceProof.export_result?.governance?.audit ?? null,
    reports: governanceProof.report_conversion?.governance?.audit ?? null,
    report_to_presentation: reportPresentationProof.audit?.report_approved ?? null,
    presentation_to_dashboard: reportPresentationProof.audit?.deck_approved ?? null,
    localization: governanceProof.localization_consume?.governance?.audit ?? null,
    strict: strictProof.audit,
    ai: {
      excel_pending: excelPending?.audit?.path ?? null,
      reports_pending: reportsPending?.audit?.path ?? null,
      localization_pending: localizationPending?.audit?.path ?? null,
      strict_pending: strictPending?.audit?.path ?? null,
      permission_failure: aiProof.permission_failure?.audit?.path ?? null
    }
  },
  lineage: {
    report_to_presentation: reportPresentationProof.lineage?.report_allowed ?? null,
    presentation_to_dashboard: reportPresentationProof.lineage?.presentation_allowed ?? null,
    strict: strictProof.lineage,
    ai: {
      excel_pending: excelPending?.lineage?.path ?? null,
      reports_pending: reportsPending?.lineage?.path ?? null,
      localization_pending: localizationPending?.lineage?.path ?? null,
      strict_pending: strictPending?.lineage?.path ?? null
    }
  },
  assertions: {
    contradictions: [],
    status: "verified_flow"
  }
};

fs.writeFileSync(proofFile, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
console.log(JSON.stringify(proof, null, 2));
