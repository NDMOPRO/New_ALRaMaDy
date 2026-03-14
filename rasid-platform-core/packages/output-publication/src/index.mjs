import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const OutputPublicationContract = { contract: "output_publication", version: "1.0.0" };

export function validatePublication(model) {
  assertVersioned("output_publication", model);
  assertRequired(model, [
    "publication_id", "artifact_ref", "publication_type", "editable_default",
    "explicit_non_editable_export", "target_ref", "published_by", "published_at",
    "permission_scope", "evidence_ref"
  ], "output_publication");
  return true;
}
