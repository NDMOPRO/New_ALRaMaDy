import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredPackages = [
  "common", "contracts", "runtime", "artifacts", "jobs", "evidence", "audit-lineage",
  "library", "brand-template", "canvas-contract", "permissions", "connectors",
  "output-publication", "capability-registry"
];

for (const pkg of requiredPackages) {
  const dts = path.join(root, "packages", pkg, "src", "index.d.ts");
  if (!fs.existsSync(dts)) throw new Error(`typecheck: missing declaration file ${dts}`);
  const content = fs.readFileSync(dts, "utf8");
  if (!content.includes("declare")) throw new Error(`typecheck: invalid declaration file ${dts}`);
}
console.log("typecheck: declaration contracts exist for required shared packages");
