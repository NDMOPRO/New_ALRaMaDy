import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "packages/shared-contracts/schemas/v1/schema-registry.manifest.json");
const registryPath = path.join(root, "packages/shared-contracts/src/registry/actionRegistry.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

console.log("rasid-platform-core baseline is runnable");
console.log(`schema-version=${manifest.version}`);
console.log(`registered-contracts=${manifest.contracts.length}`);
console.log(`registered-actions=${registry.actions.length}`);
console.log("modes=easy,advanced");
