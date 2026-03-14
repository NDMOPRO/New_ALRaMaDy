import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const PermissionsContract = { contract: "tenant_permission", version: "1.0.0" };

export function validateTenantPermission(model) {
  assertVersioned("tenant_permission", model);
  assertRequired(model, ["tenant", "workspace", "role_binding", "permission_scope"], "tenant_permission");
  return true;
}
