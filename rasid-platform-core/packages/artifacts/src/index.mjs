import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const ArtifactContract = { contract: "artifact", version: "1.0.0" };

export function validateArtifact(model) {
  assertVersioned("artifact", model);
  assertRequired(model, [
    "artifact_id", "artifact_type", "artifact_subtype", "project_id", "workspace_id", "source_refs",
    "parent_artifact_refs", "created_by", "created_at", "mode", "editable_status", "template_status",
    "lineage_ref", "evidence_ref", "verification_status", "storage_ref", "preview_ref", "export_refs",
    "version_ref", "tenant_ref", "permission_scope"
  ], "artifact");
  return true;
}
