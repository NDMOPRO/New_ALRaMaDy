import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const localizationEngine = await import(
  pathToFileURL(path.join(root, "packages", "arabic-localization-lct-engine", "dist", "index.js")).href
);

const outputRoot = path.join(root, "packages", "arabic-localization-lct-engine", "output");
const samples = await localizationEngine.runArabicLocalizationLctRegressionSuite({ outputRoot });

for (const sample of samples) {
  console.log(`localization-sample=${sample.sample_name}`);
  console.log(`localization-output-root=${sample.artifacts.output_root}`);
  console.log(`localization-output-file=${sample.artifacts.localized_output_path}`);
  console.log(`localization-roundtrip=${sample.artifacts.roundtrip_manifest_path}`);
  console.log(`localization-roundtrip-preservation=${sample.artifacts.roundtrip_preservation_path}`);
  console.log(`localization-integration=${sample.artifacts.translation_integration_path}`);
  console.log(`localization-evidence=${sample.artifacts.evidence_path}`);
  console.log(`localization-audit=${sample.artifacts.audit_path}`);
  console.log(`localization-lineage=${sample.artifacts.lineage_path}`);
}

process.exit(0);
