import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const CapabilityRegistryContract = { contract: "capability_registry", version: "1.0.0" };

export const Capabilities = Object.freeze([
  "strict_replication", "presentations", "excel_data", "dashboards", "reports", "lct", "rasid_operator", "unified_canvas"
]);

export const CapabilityRegistry = {
  contract: "capability_registry",
  version: "1.0.0",
  capabilities: Capabilities.map((capability) => ({
    capability_id: capability,
    owner: "platform",
    status: "enabled",
    contracts: ["canonical", "artifact", "job_lifecycle", "action_runtime", "evidence", "audit_lineage"]
  }))
};

export function validateCapabilityEntry(entry) {
  assertRequired(entry, ["capability_id", "owner", "status", "contracts"], "capability_registry.entry");
  return true;
}

assertVersioned("capability_registry", CapabilityRegistry);
CapabilityRegistry.capabilities.forEach(validateCapabilityEntry);
