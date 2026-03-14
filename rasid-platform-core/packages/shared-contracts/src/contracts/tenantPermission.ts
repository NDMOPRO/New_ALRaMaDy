import { z } from "zod";
import { PermissionScopeSchema } from "../common";

export const TenantSchema = z.object({
  tenant_ref: z.string(),
  isolation_boundary: z.string()
});

export const WorkspaceSchema = z.object({
  workspace_id: z.string(),
  tenant_ref: z.string()
});

export const RoleBindingSchema = z.object({
  principal_ref: z.string(),
  role: z.enum(["owner", "admin", "editor", "analyst", "viewer", "auditor", "service"]),
  scope: z.enum(["tenant", "workspace", "asset", "source", "artifact", "audit"]),
  scope_ref: z.string()
});

export const TenantPermissionContractSchema = z.object({
  tenant: TenantSchema,
  workspace: WorkspaceSchema,
  role_binding: RoleBindingSchema,
  permission_scope: PermissionScopeSchema
});
