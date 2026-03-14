import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const AuditLineageContract = { contract: "audit_lineage", version: "1.0.0" };

export function validateAuditEvent(model) {
  assertVersioned("audit_lineage", model);
  assertRequired(model, [
    "event_id", "timestamp", "actor_ref", "actor_type", "action_ref", "object_refs",
    "workspace_id", "tenant_ref", "metadata"
  ], "audit_lineage");
  return true;
}
