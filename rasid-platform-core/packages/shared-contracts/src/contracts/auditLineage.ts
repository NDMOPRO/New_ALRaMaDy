import { z } from "zod";

export const AuditEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  actor_ref: z.string(),
  actor_type: z.enum(["user", "service", "ai"]),
  action_ref: z.string(),
  object_refs: z.array(z.string()),
  workspace_id: z.string(),
  tenant_ref: z.string(),
  metadata: z.record(z.any())
});

export const LineageEdgeSchema = z.object({
  edge_id: z.string(),
  from_ref: z.string(),
  to_ref: z.string(),
  transform_ref: z.string(),
  ai_suggestion_ref: z.string().optional(),
  ai_decision: z.enum(["accepted", "rejected", "not_applicable"]),
  template_ref: z.string().optional(),
  dataset_binding_ref: z.string().optional(),
  version_diff_ref: z.string().optional()
});
