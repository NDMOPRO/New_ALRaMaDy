import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const localizationEngine = await import(
  pathToFileURL(path.join(root, "packages", "arabic-localization-lct-engine", "dist", "index.js")).href
);

const outputRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output", "runtime-generated-narrative-proof");
fs.mkdirSync(outputRoot, { recursive: true });

const samples = await localizationEngine.runArabicLocalizationLctRegressionSuite({ outputRoot });
const generatedProofRoots = fs
  .readdirSync(outputRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("generated-narrative-localization-proof-"))
  .map((entry) => path.join(outputRoot, entry.name))
  .sort();

if (generatedProofRoots.length === 0) {
  throw new Error("No generated narrative proof root was produced.");
}

const latestProofRoot = generatedProofRoots[generatedProofRoots.length - 1];
const dashboardSample = samples.find((sample) => sample.sample_name === "dashboard-en-ar-pass");
const formalSample = samples.find((sample) => sample.sample_name === "report-en-ar-formal-pass");
const executiveSample = samples.find((sample) => sample.sample_name === "report-en-ar-executive-pass");
const governmentSample = samples.find((sample) => sample.sample_name === "report-en-ar-government-pass");
const technicalSample = samples.find((sample) => sample.sample_name === "report-en-ar-technical-pass");

console.log(`generated-narrative-proof-root=${latestProofRoot}`);
console.log(`generated-narrative-proof=${path.join(latestProofRoot, "generated-narrative-localization-proof.json")}`);
console.log(`generated-narrative-evidence=${path.join(latestProofRoot, "evidence.json")}`);
console.log(`generated-narrative-audit=${path.join(latestProofRoot, "audit.json")}`);
console.log(`generated-narrative-lineage=${path.join(latestProofRoot, "lineage.json")}`);

if (dashboardSample) {
  console.log(`dashboard-localized-output=${dashboardSample.artifacts.localized_output_path}`);
  console.log(
    `dashboard-embed-payload=${path.join(dashboardSample.artifacts.output_root, "published", "dashboard-bundle", "embed-payload.json")}`
  );
}
if (formalSample) console.log(`formal-localized-output=${formalSample.artifacts.localized_output_path}`);
if (executiveSample) console.log(`executive-localized-output=${executiveSample.artifacts.localized_output_path}`);
if (governmentSample) console.log(`government-localized-output=${governmentSample.artifacts.localized_output_path}`);
if (technicalSample) console.log(`technical-localized-output=${technicalSample.artifacts.localized_output_path}`);
