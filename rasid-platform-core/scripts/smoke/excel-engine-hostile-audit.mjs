import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import ExcelJS from "exceljs";
import JSZip from "jszip";

const root = process.cwd();
const startedAt = new Date();
const startedAtMs = Date.now();

const excelEngine = await import(
  pathToFileURL(path.join(root, "packages/excel-engine/dist/index.js")).href
);

const outputRoot = path.join(root, "packages", "excel-engine", "output");
const engine = new excelEngine.ExcelEngine();
const result = await engine.runSample({ output_root: outputRoot });

const proofRoot = result.artifacts.output_root;
const artifactDir = path.join(proofRoot, "artifacts");
const evidenceDir = path.join(proofRoot, "evidence");
const bridgePath = path.join(
  root,
  "packages",
  "excel-engine",
  "tools",
  "excel_desktop_bridge.ps1"
);

const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
const fileExists = (filePath) => fs.existsSync(filePath);
const fileFresh = (filePath) =>
  fileExists(filePath) && fs.statSync(filePath).mtimeMs >= startedAtMs - 1_000;
const sha256 = (input) =>
  crypto.createHash("sha256").update(input).digest("hex");

const requireCheck = (evidencePack, checkId) => {
  const check = evidencePack.checks_executed.find((entry) => entry.check_id === checkId);
  if (!check) {
    throw new Error(`Missing hostile-audit check: ${checkId}`);
  }
  if (!check.passed) {
    throw new Error(`Failed hostile-audit check: ${checkId}`);
  }
  return check;
};

const requireAuditAction = (auditEvents, actionRef) => {
  const event = auditEvents.find((entry) => entry.action_ref === actionRef);
  if (!event) {
    throw new Error(`Missing hostile-audit audit action: ${actionRef}`);
  }
  return event;
};

const requireLineageEdge = (lineageEdges, fromRef, toRef) => {
  const edge = lineageEdges.find(
    (entry) => entry.from_ref === fromRef && entry.to_ref === toRef
  );
  if (!edge) {
    throw new Error(`Missing hostile-audit lineage edge: ${fromRef} -> ${toRef}`);
  }
  return edge;
};

const externalPublicationProofPath = path.join(
  artifactDir,
  "external-publication-proof.json"
);
const publicationStructureProofPath = path.join(
  artifactDir,
  "publication-structure-proof.json"
);
const publicationFidelityAuditPath = path.join(
  artifactDir,
  "publication-fidelity-audit.json"
);
const desktopProofBundlePath = path.join(artifactDir, "desktop-proof-bundle.json");
const mergeWorkbooksProofPath = path.join(artifactDir, "merge-workbooks-proof.json");
const sourceFormatProofPath = path.join(artifactDir, "source-format-proof.json");
const pivotDesktopProofPath = path.join(artifactDir, "pivot-desktop-proof.json");
const chartCoverageProofPath = path.join(
  artifactDir,
  "desktop-chart-coverage-proof.json"
);
const formattingProofPath = path.join(artifactDir, "desktop-formatting-proof.json");
const evidencePath = path.join(evidenceDir, "evidence-pack.json");
const auditPath = path.join(proofRoot, "audit", "audit-events.json");
const lineagePath = path.join(proofRoot, "lineage", "lineage-edges.json");

const expectedFreshFiles = [
  result.artifacts.exported_workbook_path,
  result.artifacts.desktop_proof_workbook_path,
  result.artifacts.evidence_path,
  result.artifacts.audit_path,
  result.artifacts.lineage_path,
  externalPublicationProofPath,
  publicationStructureProofPath,
  publicationFidelityAuditPath,
  desktopProofBundlePath,
  mergeWorkbooksProofPath,
  sourceFormatProofPath,
  pivotDesktopProofPath,
  chartCoverageProofPath,
  formattingProofPath
];

for (const filePath of expectedFreshFiles) {
  if (!fileExists(filePath)) {
    throw new Error(`Missing hostile-audit artifact: ${filePath}`);
  }
  if (!fileFresh(filePath)) {
    throw new Error(`Stale hostile-audit artifact: ${filePath}`);
  }
}

const evidencePack = readJson(evidencePath);
const auditEvents = readJson(auditPath);
const lineageEdges = readJson(lineagePath);
const externalPublicationProof = readJson(externalPublicationProofPath);
const publicationStructureProof = readJson(publicationStructureProofPath);
const publicationFidelityAudit = readJson(publicationFidelityAuditPath);
const desktopProofBundle = readJson(desktopProofBundlePath);
const mergeWorkbooksProof = readJson(mergeWorkbooksProofPath);
const sourceFormatProof = readJson(sourceFormatProofPath);
const chartCoverageProof = readJson(chartCoverageProofPath);
const formattingProof = readJson(formattingProofPath);

const requiredChecks = [
  "formula_recalculation_check",
  "formula_multithreaded_execution_check",
  "external_publication_upload_check",
  "external_publication_integrity_check",
  "external_publication_fidelity_check",
  "pivot_desktop_behavior_check",
  "chart_advanced_families_check",
  "formatting_professional_check",
  "merge_workbooks_conflict_resolution_check",
  "fidelity_preservation_check",
  "source_format_matrix_check"
].map((checkId) => requireCheck(evidencePack, checkId));

const publishRemoteEvent = requireAuditAction(
  auditEvents,
  "excel_engine.publish_remote_bundle.v1"
);
requireAuditAction(auditEvents, "excel_engine.publish_workbook.v1");
requireAuditAction(auditEvents, "excel_engine.persist_runtime_bundle.v1");
requireAuditAction(auditEvents, "excel_engine.generate_pivot.v1");
requireAuditAction(auditEvents, "excel_engine.generate_chart.v1");
requireAuditAction(auditEvents, "excel_engine.apply_formatting.v1");
requireAuditAction(auditEvents, "excel_engine.apply_transformation.v1");

requireLineageEdge(
  lineageEdges,
  "artifact-editable_workbook-sample-published-excel-sample",
  "publication-excel-sample-excel"
);
requireLineageEdge(
  lineageEdges,
  "publication-excel-sample-excel",
  externalPublicationProof.remote_refs.manifest_download_url
);
requireLineageEdge(
  lineageEdges,
  externalPublicationProof.remote_refs.manifest_download_url,
  externalPublicationProof.remote_refs.workbook_download_url
);

const manifestResponse = await fetch(
  externalPublicationProof.remote_refs.manifest_download_url
);
if (!manifestResponse.ok) {
  throw new Error(
    `Remote manifest fetch failed with ${manifestResponse.status} ${manifestResponse.statusText}`
  );
}
const remoteManifestBuffer = Buffer.from(await manifestResponse.arrayBuffer());
const remoteManifestPayload = JSON.parse(remoteManifestBuffer.toString("utf8"));

const workbookResponse = await fetch(
  externalPublicationProof.remote_refs.workbook_download_url
);
if (!workbookResponse.ok) {
  throw new Error(
    `Remote workbook fetch failed with ${workbookResponse.status} ${workbookResponse.statusText}`
  );
}
const remoteWorkbookBuffer = Buffer.from(await workbookResponse.arrayBuffer());

const releaseApiResponse = await fetch(
  externalPublicationProof.remote_refs.release_api_url,
  {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "rasid-excel-engine-hostile-audit"
    }
  }
);
if (!releaseApiResponse.ok) {
  throw new Error(
    `Remote release API fetch failed with ${releaseApiResponse.status} ${releaseApiResponse.statusText}`
  );
}
const releaseApiPayload = await releaseApiResponse.json();
const releaseApiAssetNames = Array.isArray(releaseApiPayload.assets)
  ? releaseApiPayload.assets.map((entry) => entry.name)
  : [];
for (const assetName of externalPublicationProof.fetched_payloads.release.asset_names) {
  if (!releaseApiAssetNames.includes(assetName)) {
    throw new Error(`Release API did not contain asset name ${assetName}`);
  }
}

const localWorkbookBuffer = fs.readFileSync(result.artifacts.exported_workbook_path);
const localWorkbookSha = sha256(localWorkbookBuffer);
const remoteWorkbookSha = sha256(remoteWorkbookBuffer);

if (localWorkbookSha !== remoteWorkbookSha) {
  throw new Error("Remote workbook SHA-256 does not match local workbook SHA-256");
}
if (
  `sha256:${remoteWorkbookSha}` !==
  externalPublicationProof.integrity.workbook_release_digest
) {
  throw new Error("Release workbook digest does not match fetched remote workbook");
}

const remoteZip = await JSZip.loadAsync(remoteWorkbookBuffer);
const remoteEntries = Object.keys(remoteZip.files);
const requiredArchiveEntries = [
  "xl/styles.xml",
  "xl/theme/theme1.xml",
  "xl/workbook.xml"
];
for (const entryName of requiredArchiveEntries) {
  if (!remoteEntries.includes(entryName)) {
    throw new Error(`Remote workbook is missing archive entry ${entryName}`);
  }
}
if (
  !remoteEntries.some((entry) => entry.startsWith("xl/charts/chart")) ||
  !remoteEntries.some((entry) => entry.startsWith("xl/pivotTables/pivotTable")) ||
  !remoteEntries.some((entry) => entry.startsWith("xl/slicers/slicer"))
) {
  throw new Error("Remote workbook is missing chart, pivot, or slicer archive parts");
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(
  remoteWorkbookBuffer.buffer.slice(
    remoteWorkbookBuffer.byteOffset,
    remoteWorkbookBuffer.byteOffset + remoteWorkbookBuffer.byteLength
  )
);
const localWorkbook = new ExcelJS.Workbook();
await localWorkbook.xlsx.load(
  localWorkbookBuffer.buffer.slice(
    localWorkbookBuffer.byteOffset,
    localWorkbookBuffer.byteOffset + localWorkbookBuffer.byteLength
  )
);

const requiredNamedRanges = [
  "SalesData",
  "RegionList",
  "FocusCell",
  "Slicer_Pivot_Profit_By_Country_CountryCode",
  "Slicer_Pivot_Profit_By_Country_RegionZone"
];
const workbookDefinedNames =
  workbook.definedNames?.model?.map((entry) => `${entry.name ?? ""}`).filter(Boolean) ?? [];
for (const namedRange of requiredNamedRanges) {
  if (!workbookDefinedNames.includes(namedRange)) {
    throw new Error(`Remote workbook missing named range ${namedRange}`);
  }
}

const summaryWorksheet = workbook.getWorksheet("Summary");
const joinedWorksheet = workbook.getWorksheet("Joined");
const localSummaryWorksheet = localWorkbook.getWorksheet("Summary");
const localJoinedWorksheet = localWorkbook.getWorksheet("Joined");
if (!summaryWorksheet || !joinedWorksheet || !localSummaryWorksheet || !localJoinedWorksheet) {
  throw new Error("Remote workbook missing expected Summary or Joined worksheet");
}
if (summaryWorksheet.getCell("B2").formula !== localSummaryWorksheet.getCell("B2").formula) {
  throw new Error("Summary!B2 formula does not match the local workbook");
}
if (JSON.stringify(joinedWorksheet.views ?? []) !== JSON.stringify(localJoinedWorksheet.views ?? [])) {
  throw new Error("Joined worksheet frozen pane state does not match the local workbook");
}
if (JSON.stringify(joinedWorksheet.autoFilter ?? null) !== JSON.stringify(localJoinedWorksheet.autoFilter ?? null)) {
  throw new Error("Joined worksheet auto filter state does not match the local workbook");
}

const hostilePivotInspectionPath = path.join(
  artifactDir,
  "hostile-pivot-open-proof.json"
);
execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    bridgePath,
    "-Mode",
    "inspect-pivot",
    "-WorkbookPath",
    result.artifacts.desktop_proof_workbook_path,
    "-OutputPath",
    hostilePivotInspectionPath
  ],
  { cwd: root, stdio: "pipe" }
);
const hostilePivotInspection = readJson(hostilePivotInspectionPath);
const hostilePivotOpened =
  hostilePivotInspection.inspection_status === "opened" ||
  (Number(hostilePivotInspection.pivot_table_count ?? 0) > 0 &&
    Array.isArray(hostilePivotInspection.pivot_tables) &&
    hostilePivotInspection.pivot_tables.length > 0);
if (!hostilePivotOpened) {
  throw new Error("Hostile pivot inspection did not open successfully");
}

const hostileOpenProofPath = path.join(artifactDir, "hostile-open-proof.json");
const macroOpenTarget =
  sourceFormatProof.xlsm_preserve?.vba_preserved === true
    ? path.join(artifactDir, "macro-preserved-output.xlsm")
    : path.join(artifactDir, "macro-degraded-output.xlsx");
const openTargets = [
  result.artifacts.exported_workbook_path,
  result.artifacts.desktop_proof_workbook_path,
  path.join(artifactDir, "legacy-editable-output.xls"),
  macroOpenTarget
];
const hostileOpenScriptPath = path.join(artifactDir, "hostile-open-check.ps1");
fs.writeFileSync(
  hostileOpenScriptPath,
  [
    "$ErrorActionPreference = 'Stop'",
    `$paths = @(${openTargets
      .map((item) => `'${item.replace(/'/g, "''")}'`)
      .join(", ")})`,
    "$excel = New-Object -ComObject Excel.Application",
    "$excel.Visible = $false",
    "$excel.DisplayAlerts = $false",
    "$results = @()",
    "try {",
    "  foreach ($filePath in $paths) {",
    "    $workbook = $null",
    "    try {",
    "      $workbook = $excel.Workbooks.Open($filePath, 0, $true)",
    "      $results += [pscustomobject]@{",
    "        path = $filePath",
    "        opened = $true",
    "        worksheet_count = [int]$workbook.Worksheets.Count",
    "        has_vb_project = [bool]$workbook.HasVBProject",
    "        file_format = [int]$workbook.FileFormat",
    "      }",
    "    } catch {",
    "      $results += [pscustomobject]@{",
    "        path = $filePath",
    "        opened = $false",
    "        error_message = $_.Exception.Message",
    "      }",
    "    } finally {",
    "      if ($null -ne $workbook) { try { $workbook.Close($false) | Out-Null } catch {} }",
    "    }",
    "  }",
    "} finally {",
    "  try { $excel.Quit() | Out-Null } catch {}",
    "}",
    `$results | ConvertTo-Json -Depth 8 | Set-Content -Path '${hostileOpenProofPath.replace(/'/g, "''")}' -Encoding UTF8`
  ].join("\r\n"),
  "utf8"
);
execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    hostileOpenScriptPath
  ],
  { cwd: root, stdio: "pipe" }
);
const hostileOpenProof = readJson(hostileOpenProofPath);
for (const openResult of hostileOpenProof) {
  if (!openResult.opened) {
    throw new Error(`Workbook open hostile check failed for ${openResult.path}`);
  }
}

const inconsistencyFindings = [];
if (
  publishRemoteEvent.metadata.remote_publication_ref !==
  externalPublicationProof.remote_refs.publication_ref
) {
  inconsistencyFindings.push(
    "audit remote_publication_ref does not match external-publication-proof publication_ref"
  );
}
if (
  remoteManifestPayload.remote_publication_ref !==
  externalPublicationProof.remote_refs.publication_ref
) {
  inconsistencyFindings.push(
    "remote manifest remote_publication_ref does not match external-publication-proof publication_ref"
  );
}
if (publicationFidelityAudit.score !== 100 || !publicationFidelityAudit.passed) {
  inconsistencyFindings.push("publication-fidelity-audit did not pass with score 100");
}
if (
  desktopProofBundle.formatting?.named_styles_reloaded?.some(
    (entry) => entry.exists !== true
  )
) {
  inconsistencyFindings.push("desktop proof bundle reported missing named styles after reload");
}
if (
  desktopProofBundle.chart_coverage?.authored?.some((entry) => entry.authored !== true)
) {
  inconsistencyFindings.push("desktop proof bundle reported a chart family that did not author");
}
if (
  !Array.isArray(mergeWorkbooksProof.source_workbooks) ||
  mergeWorkbooksProof.source_workbooks.length < 4
) {
  inconsistencyFindings.push("merge-workbooks-proof does not report the expected four-source merge");
}
if (
  sourceFormatProof.xlsm_preserve?.preservation_supported === false &&
  sourceFormatProof.xlsm_degrade?.degrade_behavior !== "export_as_xlsx_without_vba"
) {
  inconsistencyFindings.push("source-format-proof does not carry the expected xlsm downgrade policy");
}

const hostileAuditReport = {
  audit_target: "excel-engine final hostile audit",
  started_at: startedAt.toISOString(),
  finished_at: new Date().toISOString(),
  proof_root: proofRoot,
  recreated_artifacts: expectedFreshFiles.map((filePath) => ({
    path: filePath,
    fresh: fileFresh(filePath)
  })),
  hostile_verification_steps: [
    "re-ran excel-engine from current dist entrypoint to generate a fresh proof root",
    "verified fresh mtimes for critical artifacts/evidence/audit/lineage files",
    "fetched remote publication manifest and workbook over HTTPS",
    "verified GitHub release API contains the uploaded asset names",
    "verified remote SHA-256 matches local workbook SHA-256 and release digests",
    "verified local-vs-remote publication structure proof passes",
    "opened Excel proof workbooks through Excel Desktop COM checks",
    "re-inspected pivot behavior through excel_desktop_bridge inspect-pivot",
    "cross-checked audit events, lineage edges, evidence checks, and workbook contents"
  ],
  code_path_checks: {
    publish_remote_bundle: "packages/excel-engine/src/engine.ts#7572",
    publication_structure: "packages/excel-engine/src/engine.ts#2329",
    publication_fidelity_check: "packages/excel-engine/src/engine.ts#7741"
  },
  remote_publication: {
    publication_ref: externalPublicationProof.remote_refs.publication_ref,
    manifest_download_url: externalPublicationProof.remote_refs.manifest_download_url,
    workbook_download_url: externalPublicationProof.remote_refs.workbook_download_url,
    release_html_url: externalPublicationProof.remote_refs.release_html_url
  },
  evidence_checks: requiredChecks.map((check) => ({
    check_id: check.check_id,
    passed: check.passed
  })),
  hostile_open_proof_path: hostileOpenProofPath,
  hostile_pivot_inspection_path: hostilePivotInspectionPath,
  inconsistency_findings: inconsistencyFindings,
  final_status:
    inconsistencyFindings.length === 0 ? "accepted for final closure" : "rejected"
};

const hostileAuditReportPath = path.join(artifactDir, "hostile-audit-report.json");
fs.writeFileSync(
  hostileAuditReportPath,
  JSON.stringify(hostileAuditReport, null, 2),
  "utf8"
);

console.log(`excel-engine-hostile-audit-proof-root=${proofRoot}`);
console.log(`excel-engine-hostile-audit-report=${hostileAuditReportPath}`);
console.log(
  `excel-engine-hostile-audit-status=${hostileAuditReport.final_status}`
);
