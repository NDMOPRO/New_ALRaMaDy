import { z } from "zod";
import { ContractEnvelopeSchema, PermissionScopeSchema, TimestampSchema, contractEnvelope } from "./common";

export const PublicationSchema = z.object({
  contract: ContractEnvelopeSchema,
  publication_id: z.string(),
  artifact_ref: z.string(),
  publication_type: z.enum(["preview", "internal_publish", "external_export", "bundle"]),
  editable_default: z.boolean(),
  explicit_non_editable_export: z.boolean(),
  target_ref: z.string(),
  published_by: z.string(),
  published_at: TimestampSchema,
  permission_scope: PermissionScopeSchema,
  evidence_ref: z.string()
});

export const PUBLICATION_CONTRACT = contractEnvelope("publication");

export type Publication = z.infer<typeof PublicationSchema>;
