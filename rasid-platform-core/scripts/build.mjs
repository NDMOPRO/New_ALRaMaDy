import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractsDir = path.join(root, "packages/shared-contracts/src/contracts");
const schemasManifest = path.join(root, "packages/shared-contracts/schemas/v1/schema-registry.manifest.json");
const actionRegistry = path.join(root, "packages/shared-contracts/src/registry/actionRegistry.json");

const requiredContractFiles = [
  "canonicalRepresentation.ts",
  "artifact.ts",
  "jobLifecycle.ts",
  "actionRuntime.ts",
  "toolRegistry.ts",
  "evidence.ts",
  "auditLineage.ts",
  "libraryAsset.ts",
  "templateBrand.ts",
  "canvasIntegration.ts",
  "sourceConnector.ts",
  "degradeWarning.ts",
  "tenantPermission.ts",
  "outputPublication.ts"
];

for (const file of requiredContractFiles) {
  const full = path.join(contractsDir, file);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing contract file: ${file}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(schemasManifest, "utf8"));
if (!manifest.contracts || manifest.contracts.length < 14) {
  throw new Error("Schema manifest does not contain all required contracts");
}

const registry = JSON.parse(fs.readFileSync(actionRegistry, "utf8"));
if (!registry.actions || registry.actions.length === 0) {
  throw new Error("Action registry has no actions");
}

console.log("Build checks passed: contracts, schemas, registry are present.");
