import { CapabilityRegistry } from "../../packages/capability-registry/src/index.mjs";

console.log("rasid-platform-core baseline/core usable immediately");
console.log(`registry-version=${CapabilityRegistry.version}`);
console.log(`capabilities=${CapabilityRegistry.capabilities.length}`);
console.log("modes=easy,advanced");
