import { z } from "zod";

export const ContractEnvelopeSchema = z.object({
  contract_name: z.string(),
  contract_version: z.string(),
  schema_version: z.string(),
  status: z.enum(["draft", "active", "deprecated"]),
  owner: z.string(),
  compatibility: z.object({ backward: z.boolean(), forward: z.boolean() }),
  extensions_allowed: z.boolean()
});

export const ModeSchema = z.enum(["easy", "advanced"]);

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  ref: z.string().optional()
});

export const PermissionScopeSchema = z.object({
  visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
  allow_read: z.boolean(),
  allow_write: z.boolean(),
  allow_share: z.boolean(),
  allow_publish: z.boolean(),
  allow_audit_view: z.boolean()
});

export const VerificationStatusSchema = z.enum([
  "unverified",
  "verified",
  "success_with_warnings",
  "degraded",
  "failed"
]);

export type Mode = z.infer<typeof ModeSchema>;
