import {
  PERMISSION_CONTRACT,
  RoleBindingSchema,
  TenantPermissionSchema,
  TenantSchema,
  WorkspaceSchema,
  type RoleBinding,
  type Tenant,
  type Workspace,
  assertContractVersion
} from "@rasid/contracts";

export {
  PERMISSION_CONTRACT,
  RoleBindingSchema,
  TenantPermissionSchema,
  TenantSchema,
  WorkspaceSchema,
  assertContractVersion
};
export type { RoleBinding, Tenant, Workspace };

export const assertPermissionContractVersion = (version: string): void => {
  assertContractVersion("permission", version);
};
