import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packages = fs.readdirSync(path.join(root, "packages"));
for (const pkg of packages) {
  const file = path.join(root, "packages", pkg, "src", "index.mjs");
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  if (pkg !== "common" && content.includes("const Modes =")) {
    throw new Error(`boundary: package '${pkg}' must not redefine Modes; import from common`);
  }
  if (pkg !== "contracts" && content.includes("validateCanonical(")) {
    throw new Error(`boundary: package '${pkg}' must not duplicate canonical validator`);
  }
}
console.log("boundaries: shared model duplication guards passed");
