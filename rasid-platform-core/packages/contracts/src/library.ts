import { z } from "zod";
import { ContractEnvelopeSchema, PermissionScopeSchema, TimestampSchema, contractEnvelope } from "./common";

export const LibraryAssetSchema = z.object({
  contract: ContractEnvelopeSchema,
  asset_id: z.string(),
  asset_type: z.enum([
    "file",
    "template",
    "theme",
    "logo",
    "icon",
    "presentation",
    "report",
    "dashboard",
    "dataset",
    "workflow_template",
    "brand_pack"
  ]),
  source: z.string(),
  tags: z.array(z.string()),
  version: z.string(),
  owner_ref: z.string().optional(),
  library_kind: z.enum(["shared", "tenant", "workspace"]).default("tenant"),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  tenant_scope: z.enum(["tenant", "workspace", "user"]),
  permission_scope: PermissionScopeSchema,
  reuse_policy: z.enum(["free", "restricted", "approval_required"]),
  dependency_refs: z.array(z.string()),
  downstream_dependency_refs: z.array(z.string()).default([]),
  version_history_refs: z.array(z.string()).default([]),
  notification_refs: z.array(z.string()).default([]),
  approval_state: z.enum(["draft", "in_review", "approved", "rejected"]).default("approved"),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const LIBRARY_CONTRACT = contractEnvelope("library");

export type LibraryAsset = z.infer<typeof LibraryAssetSchema>;
