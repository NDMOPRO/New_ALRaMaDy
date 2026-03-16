import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { pathToFileURL } from "node:url";
import {
  ensureDir,
  now,
  root,
  stamp,
  writeJson
} from "./requirement-matrix-helpers.mjs";

const contracts = await import(pathToFileURL(path.join(root, "packages", "contracts", "dist", "index.js")).href);
const excelEngineModule = await import(pathToFileURL(path.join(root, "packages", "excel-engine", "dist", "index.js")).href);

const proofRoot = path.join(root, "packages", "excel-engine", "output", `merge-50-proof-${stamp()}`);
const inputDir = path.join(proofRoot, "inputs");
const artifactsDir = path.join(proofRoot, "artifacts");
const evidenceDir = path.join(proofRoot, "evidence");
const auditDir = path.join(proofRoot, "audit");
const lineageDir = path.join(proofRoot, "lineage");
[proofRoot, inputDir, artifactsDir, evidenceDir, auditDir, lineageDir].forEach(ensureDir);

const createSourceWorkbook = async (filePath, index) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");
  worksheet.addRow(["CaseId", "Amount", "Owner", "Proof"]);
  worksheet.addRow([`INV-${String(index).padStart(3, "0")}`, index * 10, `Owner ${index}`, { formula: "AmountCell*2", result: index * 20 }]);
  worksheet.addRow([`INV-${String(index).padStart(3, "0")}-B`, index * 10 + 5, `Owner ${index}B`, { formula: "AmountCell+5", result: index * 10 + 5 }]);
  worksheet.getColumn(1).width = 18;
  worksheet.getColumn(2).width = 14;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 14;
  workbook.definedNames.add("Data!$B$2", "AmountCell");
  await workbook.xlsx.writeFile(filePath);
};

const createBaseWorkbook = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Base");
  worksheet.addRow(["Baseline", "Value"]);
  worksheet.addRow(["Seed", 1]);
  await workbook.xlsx.writeFile(filePath);
};

const baseWorkbookPath = path.join(inputDir, "base.xlsx");
await createBaseWorkbook(baseWorkbookPath);

const sourceWorkbookPaths = [];
for (let index = 1; index <= 50; index += 1) {
  const sourceWorkbookPath = path.join(inputDir, `source-${String(index).padStart(2, "0")}.xlsx`);
  await createSourceWorkbook(sourceWorkbookPath, index);
  sourceWorkbookPaths.push(sourceWorkbookPath);
}

const engine = new excelEngineModule.ExcelEngine();
const state = await engine.importWorkbook({
  run_id: "excel-merge-50-proof",
  tenant_ref: "tenant-excel-merge-50",
  workspace_id: "workspace-excel-merge-50",
  project_id: "project-excel-merge-50",
  created_by: "codex",
  requested_mode: "advanced",
  media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  input_path: baseWorkbookPath,
  output_root: proofRoot
});

const mergePlan = {
  contract: contracts.EXCEL_CONTRACT,
  schema_namespace: contracts.EXCEL_SCHEMA_NAMESPACE,
  schema_version: contracts.EXCEL_SCHEMA_VERSION,
  plan_id: "plan-excel-merge-50-proof",
  workbook_ref: state.workbookRecord.workbook_id,
  requested_mode: state.mode,
  action_sequence: [
    {
      schema_namespace: contracts.EXCEL_SCHEMA_NAMESPACE,
      schema_version: contracts.EXCEL_SCHEMA_VERSION,
      step_id: "step-merge-workbooks-50",
      operation: "merge_workbooks",
      input_refs: sourceWorkbookPaths,
      output_target_refs: [],
      config: {
        sourceWorkbookPath: sourceWorkbookPaths[0],
        sourceWorkbookPaths: sourceWorkbookPaths.slice(1).join(","),
        sheetPrefix: "FiftyMerge",
        styleConflictPolicy: "merge",
        namedRangeConflictPolicy: "rename_source"
      },
      preview_required: true,
      approval_required: false
    }
  ],
  execution_strategy: "serial",
  created_by: "codex",
  created_at: now()
};

const transformationResult = await engine.applyTransformation(state, mergePlan, "codex");
const mergedWorkbookPath = path.join(artifactsDir, "merged-50-workbooks.xlsx");
await state.workbook.xlsx.writeFile(mergedWorkbookPath);

const mergedWorksheetNames = state.workbook.worksheets.map((worksheet) => worksheet.name);
const copiedWorksheetNames = mergedWorksheetNames.filter((name) => name.startsWith("FiftyMerge_"));
const definedNamesModel = Array.isArray(state.workbook.definedNames.model) ? state.workbook.definedNames.model : [];
const definedNameNames = definedNamesModel.map((entry) => `${entry.name ?? ""}`);
const sampleFormulaChecks = copiedWorksheetNames.slice(0, 3).map((worksheetName) => {
  const worksheet = state.workbook.getWorksheet(worksheetName);
  const formulaValue = worksheet?.getCell("D2").value;
  return {
    worksheet_name: worksheetName,
    formula:
      typeof formulaValue === "object" && formulaValue && "formula" in formulaValue ? `${formulaValue.formula ?? ""}` : null,
    result:
      typeof formulaValue === "object" && formulaValue && "result" in formulaValue ? formulaValue.result ?? null : null
  };
});

const proof = {
  phase_requirement: "excel-engine 50 files merge proof",
  generated_at: now(),
  proof_root: proofRoot,
  input_root: inputDir,
  workbook_ref: state.workbookRecord.workbook_id,
  source_workbook_count: sourceWorkbookPaths.length,
  merged_workbook_path: mergedWorkbookPath,
  copied_worksheet_count: copiedWorksheetNames.length,
  total_worksheet_count: mergedWorksheetNames.length,
  transformation_result_id: transformationResult.result_id,
  transformed_worksheet_refs: transformationResult.affected_worksheet_refs,
  named_range_count: definedNameNames.length,
  sample_defined_names: definedNameNames.slice(0, 10),
  sample_formula_checks: sampleFormulaChecks,
  assertions: {
    source_workbook_count_is_50: sourceWorkbookPaths.length === 50,
    copied_worksheet_count_is_50: copiedWorksheetNames.length === 50,
    merged_workbook_exists: fs.existsSync(mergedWorkbookPath),
    worksheet_names_unique: new Set(mergedWorksheetNames).size === mergedWorksheetNames.length,
    transformation_outcome_succeeded: transformationResult.outcome === "success",
    rename_source_policy_preserved_named_ranges: definedNameNames.length >= 50
  }
};
proof.status = Object.values(proof.assertions).every(Boolean) ? "verified_flow" : "reopen";

const evidence = {
  proof_root: proofRoot,
  input_workbooks: sourceWorkbookPaths,
  merged_workbook_path: mergedWorkbookPath,
  transformation_result_path: writeJson(path.join(artifactsDir, "transformation-result.json"), transformationResult),
  workbook_package_path: writeJson(path.join(artifactsDir, "workbook-package.json"), state.workbookPackage),
  sample_formula_checks: sampleFormulaChecks
};

const audit = {
  generated_at: now(),
  executed_actions: state.auditEvents.map((event) => event.action_ref),
  audit_event_count: state.auditEvents.length,
  affected_worksheet_refs: transformationResult.affected_worksheet_refs
};

const lineage = {
  generated_at: now(),
  lineage_edge_count: state.lineageEdges.length,
  recent_edges: state.lineageEdges.slice(-10)
};

writeJson(path.join(artifactsDir, "merge-50-proof.json"), proof);
writeJson(path.join(evidenceDir, "evidence.json"), evidence);
writeJson(path.join(auditDir, "audit.json"), audit);
writeJson(path.join(lineageDir, "lineage.json"), lineage);
writeJson(path.join(auditDir, "audit-events.json"), state.auditEvents);
writeJson(path.join(lineageDir, "lineage-edges.json"), state.lineageEdges);

console.log(
  JSON.stringify(
    {
      proof_root: proofRoot,
      proof_path: path.join(artifactsDir, "merge-50-proof.json"),
      merged_workbook_path: mergedWorkbookPath,
      copied_worksheet_count: copiedWorksheetNames.length,
      status: proof.status
    },
    null,
    2
  )
);
