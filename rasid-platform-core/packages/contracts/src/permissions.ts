import { z } from "zod";
import { ContractEnvelopeSchema, PermissionScopeSchema, contractEnvelope } from "./common";

export const TenantSchema = z.object({
  contract: ContractEnvelopeSchema,
  tenant_ref: z.string(),
  isolation_boundary: z.string()
});

export const WorkspaceSchema = z.object({
  workspace_id: z.string(),
  tenant_ref: z.string(),
  project_refs: z.array(z.string())
});

export const RoleBindingSchema = z.object({
  principal_ref: z.string(),
  role: z.string().min(1),
  scope: z.enum(["tenant", "workspace", "asset", "source", "artifact", "audit", "publication", "library", "template", "kpi", "governance"]),
  scope_ref: z.string(),
  granted_by: z.string().optional(),
  granted_at: z.string().optional(),
  attributes: z
    .object({
      department: z.string().optional(),
      owner_ref: z.string().optional(),
      sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
      asset_type: z.string().optional(),
      action_type: z.string().optional(),
      tenant_ref: z.string().optional()
    })
    .optional()
});

export const TenantPermissionSchema = z.object({
  tenant: TenantSchema,
  workspace: WorkspaceSchema,
  role_bindings: z.array(RoleBindingSchema),
  permission_scope: PermissionScopeSchema
});

export const PERMISSION_CONTRACT = contractEnvelope("permission");

export type Tenant = z.infer<typeof TenantSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type RoleBinding = z.infer<typeof RoleBindingSchema>;
