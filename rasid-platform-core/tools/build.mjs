import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredPackages = [
  "common", "contracts", "runtime", "artifacts", "jobs", "evidence", "audit-lineage",
  "library", "brand-template", "canvas-contract", "permissions", "connectors",
  "output-publication", "capability-registry"
];

for (const pkg of requiredPackages) {
  const base = path.join(root, "packages", pkg, "src");
  if (!fs.existsSync(path.join(base, "index.mjs"))) throw new Error(`missing ${pkg}/src/index.mjs`);
  if (!fs.existsSync(path.join(base, "index.d.ts"))) throw new Error(`missing ${pkg}/src/index.d.ts`);
}

await import(path.join(root, "packages/capability-registry/src/index.mjs"));
console.log("build: baseline packages are present and loadable");
