import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const reportEngine = await load("packages/report-engine/dist/index.js");

const result = await reportEngine.runReportRegressionSuite();
const outputRoot = path.join(root, "packages", "report-engine", "artifacts", "latest-run", result.runId);

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
fs.mkdirSync(path.join(outputRoot, "records"), { recursive: true });

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

const cliProofRoot = path.join(root, ".runtime", "report-cli-proof");
fs.rmSync(cliProofRoot, { recursive: true, force: true });
fs.mkdirSync(cliProofRoot, { recursive: true });

const writeCliPayload = (fileName, payload) => {
  const target = path.join(cliProofRoot, fileName);
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
};

const runCli = (args) => {
  const child = spawnSync(process.execPath, [path.join(root, "apps", "contracts-cli", "dist", "index.js"), ...args], {
    cwd: root,
    encoding: "utf8"
  });
  if (child.status !== 0) {
    throw new Error(`CLI command failed: ${args.join(" ")}\n${child.stderr}`);
  }
  return JSON.parse(child.stdout);
};

const waitForJsonLine = (child) =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out waiting for service startup.\n${stderr}`));
    }, 15000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const trimmed = stdout.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed);
        clearTimeout(timer);
        resolve(parsed);
      } catch {
        // wait for the full JSON payload
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`Service exited before startup: ${stderr}`));
      }
    });
  });

const fetchWithRetry = async (url, parseAs = "json") => {
  let lastError = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return parseAs === "text" ? response.text() : response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
};

writeText("export/report.html", result.exports.find((entry) => entry.fileName.endsWith(".html"))?.payload ?? "");
writeBinary("export/report.pdf", result.exports.find((entry) => entry.fileName.endsWith(".pdf"))?.payload ?? new Uint8Array());
writeBinary("export/report.docx", result.exports.find((entry) => entry.fileName.endsWith(".docx"))?.payload ?? new Uint8Array());

writeJson("records/report.json", result.scheduledRuns[0]?.state.report ?? result.approved.report);
writeJson("records/report-version.json", result.scheduledRuns[0]?.state.version ?? result.approved.version);
writeJson("records/report-layout.json", result.scheduledRuns[0]?.state.layout ?? result.approved.layout);
writeJson("records/report-sections.json", result.scheduledRuns[0]?.state.sections ?? result.approved.sections);
writeJson("records/report-content-blocks.json", result.scheduledRuns[0]?.state.contentBlocks ?? result.approved.contentBlocks);
writeJson("records/report-binding-set.json", result.scheduledRuns[0]?.state.bindingSet ?? result.approved.bindingSet);
writeJson("records/report-review-state.json", result.reviewed.reviewState);
writeJson("records/report-approval-state.json", result.approved.approvalState);
writeJson("records/report-diff.json", result.compared.diff);
writeJson("records/shared-schedule.json", result.scheduled.schedule);
writeJson("records/scheduled-runs.json", result.scheduledRuns);
writeJson("records/schedule-dispatches.json", result.scheduledRuns.map((entry) => entry.dispatch));
writeJson("records/schedule-orchestrations.json", result.scheduledRuns.map((entry) => entry.orchestration));
writeJson(
  "records/schedule-transport-deliveries.json",
  result.scheduledRuns.flatMap((entry) => entry.transportDeliveries)
);
writeJson(
  "records/scheduled-degraded-publications.json",
  result.scheduledRuns
    .map((entry) => entry.degradedPublicationResult?.publication ?? null)
    .filter(Boolean)
);
writeJson("records/publication.json", result.published.publication);
writeJson("records/publication-transport.json", result.published.transport);
writeJson("records/degraded-publication.json", result.degradedPublication.publication);
writeJson("records/presentation-conversion.json", result.presentationConversion.payload);
writeJson("records/presentation-reconciled-conversion.json", result.presentationReconciledConversion.payload);
writeJson("records/dashboard-conversion.json", result.dashboardConversion.payload);
writeJson("records/dashboard-reconciled-conversion.json", result.dashboardReconciledConversion.payload);
writeJson("records/presentation-back-sync.json", result.presentationConversion.backSyncRecord ?? null);
writeJson("records/presentation-reconciled-back-sync.json", result.presentationReconciledConversion.backSyncRecord ?? null);
writeJson("records/dashboard-back-sync.json", result.dashboardConversion.backSyncRecord ?? null);
writeJson("records/dashboard-reconciled-back-sync.json", result.dashboardReconciledConversion.backSyncRecord ?? null);
writeJson("records/ingested-docx.json", result.ingestedDocx.payload);
writeJson("records/ingested-pdf.json", result.ingestedPdf.payload);
writeJson("records/ingest-records.json", [result.ingestedDocx.ingestRecord, result.ingestedPdf.ingestRecord]);
writeJson("records/native-presentation-publication.json", result.presentationConversion.nativePresentationPublication?.publication ?? null);
writeJson("records/native-dashboard-publication.json", result.dashboardConversion.nativeDashboardPublication?.publication ?? null);
writeJson("records/publication-backend-bundle.json", {
  backend_publication_ref: result.published.transport.backend_publication_ref,
  backend_manifest_path: result.published.transport.backend_manifest_path,
  backend_access_state_path: result.published.transport.backend_access_state_path,
  backend_bundle_index_path: result.published.transport.backend_bundle_index_path,
  backend_delivery_state_path: result.published.transport.backend_delivery_state_path,
  gateway_bundle_ref: result.published.transport.gateway_bundle_ref,
  gateway_manifest_path: result.published.transport.gateway_manifest_path,
  gateway_consumable_ref: result.published.transport.gateway_consumable_ref,
  access_lifecycle_path: result.published.transport.access_lifecycle_path,
  delivery_receipt_path: result.published.transport.delivery_receipt_path
});

const cliCreatePayloadPath = writeCliPayload("create-action.json", {
  action_id: "reports.create_report.v1",
  storage_dir: cliProofRoot,
  payload: {
    report_id: "report-cli-proof",
    tenant_ref: "tenant-cli",
    workspace_id: "workspace-cli",
    project_id: "project-cli",
    created_by: "cli-user",
    title: "CLI Report Proof",
    report_type: "ops_report",
    source_refs: ["dataset://cli-proof"],
    sections: [
      {
        section_kind: "cover",
        title: "CLI Cover",
        blocks: [
          {
            block_type: "narrative",
            title: "CLI Intro",
            body: "Created through the report action runtime."
          }
        ]
      }
    ]
  }
});
const cliCreateOutput = runCli(["report-dispatch-action", cliCreatePayloadPath]);
const cliApprovePayloadPath = writeCliPayload("approve-action.json", {
  action_id: "reports.approve_report.v1",
  storage_dir: cliProofRoot,
  payload: {
    report_id: "report-cli-proof",
    actor_ref: "cli-approver",
    decision: "approved",
    comment: "CLI publish proof approval."
  }
});
const cliApproveOutput = runCli(["report-dispatch-action", cliApprovePayloadPath]);
const cliPublishPayloadPath = writeCliPayload("publish-action.json", {
  action_id: "reports.publish_report.v1",
  storage_dir: cliProofRoot,
  payload: {
    report_id: "report-cli-proof",
    actor_ref: "cli-user",
    target_ref: "workspace://reports/cli-proof"
  }
});
const cliPublishOutput = runCli(["report-dispatch-action", cliPublishPayloadPath]);
const cliExportPayloadPath = writeCliPayload("export-tool.json", {
  tool_id: "registry.reports.export_report_html",
  storage_dir: cliProofRoot,
  payload: {
    report_id: "report-cli-proof",
    actor_ref: "cli-user",
    target: "html"
  }
});
const cliExportOutput = runCli(["report-dispatch-tool", cliExportPayloadPath]);
const cliServePayloadPath = writeCliPayload("serve-publications.json", {
  storage_dir: cliProofRoot
});
const cliService = spawn(process.execPath, [path.join(root, "apps", "contracts-cli", "dist", "index.js"), "report-serve-publications", cliServePayloadPath], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"]
});
const cliServiceStatus = await waitForJsonLine(cliService);
const cliPublishedRoute = cliServiceStatus.publications.find((entry) => entry.publication_id === cliPublishOutput.publication.publication_id);
if (!cliPublishedRoute?.served_manifest_url || !cliPublishedRoute?.served_embed_html_url) {
  cliService.kill("SIGTERM");
  throw new Error("Report CLI service did not expose the published report route.");
}
const cliFetchedManifest = await fetchWithRetry(cliPublishedRoute.served_manifest_url, "json");
const cliFetchedEmbedHtml = await fetchWithRetry(cliPublishedRoute.served_embed_html_url, "text");
cliService.kill("SIGTERM");

writeJson("records/cli-create-output.json", cliCreateOutput);
writeJson("records/cli-approve-output.json", cliApproveOutput);
writeJson("records/cli-publish-output.json", cliPublishOutput);
writeJson("records/cli-export-output.json", cliExportOutput);
writeJson("records/cli-service-output.json", cliServiceStatus);
writeJson("records/cli-fetched-manifest.json", cliFetchedManifest);
writeText("records/cli-fetched-embed.html", cliFetchedEmbedHtml);
writeJson(
  "records/evidence-packs.json",
  [
    result.ingestedDocx.evidencePack,
    result.ingestedPdf.evidencePack,
    result.created.evidencePack,
    result.updated.evidencePack,
    result.refreshed.evidencePack,
    result.compared.evidencePack,
    result.reviewed.evidencePack,
    result.approved.evidencePack,
    ...result.exports.map((entry) => entry.evidencePack),
    result.presentationConversion.evidencePack,
    result.presentationReconciledConversion.evidencePack,
    result.dashboardConversion.evidencePack,
    result.dashboardReconciledConversion.evidencePack,
    result.published.evidencePack,
    result.scheduled.evidencePack,
    ...result.scheduledRuns.map((entry) => entry.runnerStage.evidencePack),
    result.degradedPublication.evidencePack
  ]
);
writeJson(
  "records/audit-events.json",
  [
    ...result.ingestedDocx.auditEvents,
    ...result.ingestedPdf.auditEvents,
    ...result.created.auditEvents,
    ...result.updated.auditEvents,
    ...result.refreshed.auditEvents,
    ...result.compared.auditEvents,
    ...result.reviewed.auditEvents,
    ...result.approved.auditEvents,
    ...result.exports.flatMap((entry) => entry.auditEvents),
    ...result.presentationConversion.auditEvents,
    ...result.presentationReconciledConversion.auditEvents,
    ...result.dashboardConversion.auditEvents,
    ...result.dashboardReconciledConversion.auditEvents,
    ...result.published.auditEvents,
    ...result.scheduled.auditEvents,
    ...result.scheduledRuns.flatMap((entry) => entry.runnerStage.auditEvents),
    ...result.degradedPublication.auditEvents
  ]
);
writeJson(
  "records/lineage-edges.json",
  [
    ...result.ingestedDocx.lineageEdges,
    ...result.ingestedPdf.lineageEdges,
    ...result.created.lineageEdges,
    ...result.updated.lineageEdges,
    ...result.refreshed.lineageEdges,
    ...result.compared.lineageEdges,
    ...result.reviewed.lineageEdges,
    ...result.approved.lineageEdges,
    ...result.exports.flatMap((entry) => entry.lineageEdges),
    ...result.presentationConversion.lineageEdges,
    ...result.presentationReconciledConversion.lineageEdges,
    ...result.dashboardConversion.lineageEdges,
    ...result.dashboardReconciledConversion.lineageEdges,
    ...result.published.lineageEdges,
    ...result.scheduled.lineageEdges,
    ...result.scheduledRuns.flatMap((entry) => entry.runnerStage.lineageEdges),
    ...result.degradedPublication.lineageEdges
  ]
);
writeJson("records/summary.json", {
  runId: result.runId,
  reportId: result.approved.report.report_id,
  latestVersion: result.scheduledRuns[0]?.state.version.version_ref.version_id ?? result.approved.version.version_ref.version_id,
  exportTargets: result.exports.map((entry) => entry.fileName),
  presentationBackSyncs: [
    result.presentationConversion.backSyncRecord?.sync_id ?? null,
    result.presentationReconciledConversion.backSyncRecord?.sync_id ?? null
  ],
  dashboardBackSyncs: [
    result.dashboardConversion.backSyncRecord?.sync_id ?? null,
    result.dashboardReconciledConversion.backSyncRecord?.sync_id ?? null
  ],
  publicationId: result.published.publication.publication_id,
  publicationTransportTarget: result.published.transport?.served_embed_html_url ?? null,
  degradedPublicationId: result.degradedPublication.publication.publication_id,
  scheduleId: result.scheduled.schedule.schedule_id,
  scheduledRunCount: result.scheduledRuns.length,
  ingestedReports: [result.ingestedDocx.state.report.report_id, result.ingestedPdf.state.report.report_id]
});

console.log(outputRoot);
process.exit(0);
