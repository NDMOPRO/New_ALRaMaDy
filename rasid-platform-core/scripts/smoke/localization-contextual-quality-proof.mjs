import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const distRoot = path.join(root, "packages", "arabic-localization-lct-engine", "dist", "index.js");
const { runArabicLocalizationLctRegressionSuite } = await import(pathToFileURL(distRoot).href);

const outputRoot = path.join(
  root,
  "packages",
  "arabic-localization-lct-engine",
  "output",
  "runtime-contextual-translation-proof"
);

await runArabicLocalizationLctRegressionSuite({ outputRoot });

const proofRoots = fs
  .readdirSync(outputRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("contextual-translation-quality-proof-"))
  .map((entry) => path.join(outputRoot, entry.name))
  .sort((left, right) => fs.statSync(left).mtimeMs - fs.statSync(right).mtimeMs);

const proofRoot = proofRoots.at(-1);
if (!proofRoot) {
  throw new Error("No contextual translation quality proof root was produced.");
}

const proofJson = path.join(proofRoot, "contextual-translation-quality-proof.json");
const evidence = path.join(proofRoot, "evidence.json");
const audit = path.join(proofRoot, "audit.json");
const lineage = path.join(proofRoot, "lineage.json");

console.log(`localization-contextual-quality-proof-root=${proofRoot}`);
console.log(`localization-contextual-quality-proof-json=${proofJson}`);
console.log(`localization-contextual-quality-evidence=${evidence}`);
console.log(`localization-contextual-quality-audit=${audit}`);
console.log(`localization-contextual-quality-lineage=${lineage}`);
