import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const EvidenceContract = { contract: "evidence", version: "1.0.0" };

export function validateEvidenceStatus(model) {
  assertVersioned("evidence", model);
  assertRequired(model, [
    "verification_status", "evidence_pack_ref", "warnings", "validation_checks_executed",
    "failure_reasons", "degraded_reasons", "reproducibility_metadata"
  ], "evidence");
  return true;
}
