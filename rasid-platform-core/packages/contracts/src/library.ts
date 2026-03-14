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
  tenant_scope: z.enum(["tenant", "workspace", "user"]),
  permission_scope: PermissionScopeSchema,
  reuse_policy: z.enum(["free", "restricted", "approval_required"]),
  dependency_refs: z.array(z.string()),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const LIBRARY_CONTRACT = contractEnvelope("library");

export type LibraryAsset = z.infer<typeof LibraryAssetSchema>;
