import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const importViolations = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") {
        continue;
      }
      walk(full);
      continue;
    }
    if (!entry.name.endsWith(".ts")) {
      continue;
    }
    const content = fs.readFileSync(full, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const isImportOrRequire = /^\s*(import\s|export\s.*from\s|.*require\s*\()/.test(trimmed);
      if (!isImportOrRequire) return;
      if (trimmed.includes("/src/") || trimmed.includes("../contracts/") || trimmed.includes("../shared-contracts/")) {
        importViolations.push(`${full}:${index + 1}`);
      }
    });
  }
};

walk(path.join(root, "packages"));
walk(path.join(root, "apps"));

if (importViolations.length > 0) {
  throw new Error(`Workspace import rule violated:\n${importViolations.join("\n")}`);
}

console.log("Workspace import checks passed.");
