import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedRoots = new Set([
  path.join(root, "packages/common"),
  path.join(root, "packages/contracts"),
  path.join(root, "packages/runtime"),
  path.join(root, "packages/artifacts"),
  path.join(root, "packages/jobs"),
  path.join(root, "packages/evidence"),
  path.join(root, "packages/audit-lineage"),
  path.join(root, "packages/library"),
  path.join(root, "packages/brand-template"),
  path.join(root, "packages/canvas-contract"),
  path.join(root, "packages/permissions"),
  path.join(root, "packages/connectors"),
  path.join(root, "packages/output-publication"),
  path.join(root, "packages/capability-registry")
]);

const forbiddenPatterns = [
  /export\s+(const|type|interface)\s+Artifact(Schema)?/m,
  /export\s+(const|type|interface)\s+Job(Schema)?/m,
  /export\s+(const|type|interface)\s+EvidencePack(Schema)?/m,
  /export\s+(const|type|interface)\s+CanonicalRepresentation(Schema)?/m
];

const violations = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      continue;
    }
    const isAllowed = [...allowedRoots].some((allowedRoot) => full.startsWith(allowedRoot));
    if (isAllowed) {
      continue;
    }
    const content = fs.readFileSync(full, "utf8");
    if (forbiddenPatterns.some((pattern) => pattern.test(content))) {
      violations.push(full);
    }
  }
};

walk(path.join(root, "packages"));
walk(path.join(root, "apps"));

if (fs.existsSync(path.join(root, "packages/shared-contracts"))) {
  violations.push(path.join(root, "packages/shared-contracts"));
}

if (violations.length > 0) {
  throw new Error(`Guardrail violation: private duplicate shared models found in\n${violations.join("\n")}`);
}

console.log("Shared model guardrails passed.");
