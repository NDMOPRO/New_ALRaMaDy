import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const JobContract = { contract: "job_lifecycle", version: "1.0.0" };

export function validateJob(model) {
  assertVersioned("job_lifecycle", model);
  assertRequired(model, [
    "job_id", "capability", "requested_mode", "source_refs", "artifact_refs", "state", "progress",
    "stage", "warnings", "retry_policy", "evidence_ref", "resource_profile"
  ], "job_lifecycle");
  return true;
}
