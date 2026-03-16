import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const excelEngine = await import(pathToFileURL(path.join(root, "packages/excel-engine/dist/index.js")).href);

const outputRoot = path.join(root, "packages", "excel-engine", "output");
const engine = new excelEngine.ExcelEngine();
const result = await engine.runSample({ output_root: outputRoot });

console.log(`excel-engine-sample-output=${result.artifacts.output_root}`);
console.log(`excel-engine-sample-export=${result.artifacts.exported_workbook_path}`);
console.log(`excel-engine-sample-evidence=${result.artifacts.evidence_path}`);
