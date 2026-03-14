import { z } from "zod";

export const ActionDefinitionSchema = z.object({
  action_id: z.string(),
  action_name: z.string(),
  capability: z.string(),
  input_schema: z.object({ schema_id: z.string(), version: z.string(), uri: z.string() }),
  output_schema: z.object({ schema_id: z.string(), version: z.string(), uri: z.string() }),
  required_permissions: z.array(z.string()),
  mode_support: z.object({ easy: z.boolean(), advanced: z.boolean() }),
  approval_policy: z.enum(["never", "conditional", "always"]),
  preview_support: z.boolean(),
  mutability: z.enum(["read_only", "mutating"]),
  idempotency: z.enum(["idempotent", "non_idempotent"]),
  side_effects: z.array(z.string()),
  evidence_requirements: z.array(z.string()),
  degrade_policy: z.string()
});

export const ActionExecutionSchema = z.object({
  execution_id: z.string(),
  action_id: z.string(),
  invoke_type: z.enum(["manual", "ai_proposal", "system"]),
  approval_state: z.enum(["not_required", "pending", "approved", "rejected"]),
  actor_ref: z.string(),
  inputs_hash: z.string(),
  output_ref: z.string(),
  deterministic_log_ref: z.string(),
  replay_token: z.string(),
  started_at: z.string(),
  finished_at: z.string().optional()
});
