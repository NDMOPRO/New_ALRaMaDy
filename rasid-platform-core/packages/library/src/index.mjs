import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const LibraryContract = { contract: "library_asset", version: "1.0.0" };

export function validateLibraryAsset(model) {
  assertVersioned("library_asset", model);
  assertRequired(model, ["asset_id", "asset_type", "source", "tags", "version", "tenant_scope", "permission_scope", "reuse_policy", "dependency_refs"], "library_asset");
  return true;
}
