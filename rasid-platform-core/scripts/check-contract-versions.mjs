import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/schemas/v1/contract-manifest.json"), "utf8")
);
const { CONTRACT_VERSIONS } = await import(pathToFileURL(path.join(root, "packages/contracts/dist/index.js")).href);

const manifestContracts = manifest.contracts;
const versionEntries = Object.entries(CONTRACT_VERSIONS);

if (versionEntries.length !== Object.keys(manifestContracts).length) {
  throw new Error("Contract version manifest size mismatch");
}

for (const [contractName, version] of versionEntries) {
  if (manifestContracts[contractName] !== version) {
    throw new Error(`Contract version mismatch for ${contractName}`);
  }
}

console.log("Contract version checks passed.");
