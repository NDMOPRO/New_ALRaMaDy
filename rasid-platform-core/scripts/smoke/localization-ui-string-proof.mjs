import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const localizationEngine = await import(
  pathToFileURL(path.join(root, "packages", "arabic-localization-lct-engine", "dist", "index.js")).href
);

const outputRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", "runtime-ui-string-proof");
fs.mkdirSync(outputRoot, { recursive: true });

const samples = await localizationEngine.runArabicLocalizationLctRegressionSuite({ outputRoot });
const proofRoots = fs
  .readdirSync(outputRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("ui-string-localization-proof-"))
  .map((entry) => path.join(outputRoot, entry.name))
  .sort();

if (proofRoots.length === 0) {
  throw new Error("No UI string localization proof root was produced.");
}

const latestProofRoot = proofRoots[proofRoots.length - 1];
const dashboardSample = samples.find((sample) => sample.sample_name === "dashboard-en-ar-pass");
const financeSample = samples.find((sample) => sample.sample_name === "report-en-ar-domain-finance-pass");
const healthcareSample = samples.find((sample) => sample.sample_name === "report-en-ar-domain-healthcare-pass");
const governmentSample = samples.find((sample) => sample.sample_name === "report-en-ar-domain-government-pass");
const telecomSample = samples.find((sample) => sample.sample_name === "report-en-ar-domain-telecom-pass");

console.log(`ui-string-proof-root=${latestProofRoot}`);
console.log(`ui-string-proof=${path.join(latestProofRoot, "ui-string-localization-proof.json")}`);
console.log(`ui-string-evidence=${path.join(latestProofRoot, "evidence.json")}`);
console.log(`ui-string-audit=${path.join(latestProofRoot, "audit.json")}`);
console.log(`ui-string-lineage=${path.join(latestProofRoot, "lineage.json")}`);
if (dashboardSample) {
  console.log(`dashboard-localized-output=${dashboardSample.artifacts.localized_output_path}`);
  console.log(`dashboard-embed-payload=${path.join(dashboardSample.artifacts.output_root, "published", "dashboard-bundle", "embed-payload.json")}`);
}
if (financeSample) console.log(`finance-localized-output=${financeSample.artifacts.localized_output_path}`);
if (healthcareSample) console.log(`healthcare-localized-output=${healthcareSample.artifacts.localized_output_path}`);
if (governmentSample) console.log(`government-localized-output=${governmentSample.artifacts.localized_output_path}`);
if (telecomSample) console.log(`telecom-localized-output=${telecomSample.artifacts.localized_output_path}`);
