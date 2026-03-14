import { z } from "zod";
import {
  ApprovalPolicySchema,
  ApprovalStateSchema,
  ContractEnvelopeSchema,
  IdempotencySchema,
  JsonSchemaRefSchema,
  MutabilitySchema,
  PlatformModeSchema,
  TimestampSchema,
  contractEnvelope
} from "./common";

export const ActionDefinitionSchema = z.object({
  contract: ContractEnvelopeSchema,
  action_id: z.string(),
  action_name: z.string(),
  capability: z.string(),
  input_schema: JsonSchemaRefSchema,
  output_schema: JsonSchemaRefSchema,
  required_permissions: z.array(z.string()),
  mode_support: z.object({
    easy: z.boolean(),
    advanced: z.boolean()
  }),
  approval_policy: ApprovalPolicySchema,
  preview_support: z.boolean(),
  mutability: MutabilitySchema,
  idempotency: IdempotencySchema,
  side_effects: z.array(z.string()),
  evidence_requirements: z.array(z.string()),
  degrade_policy_ref: z.string()
});

export const ActionExecutionSchema = z.object({
  execution_id: z.string(),
  action_id: z.string(),
  execution_source: z.enum(["manual_invocation", "ai_proposal", "approved_ai_apply", "system_replay"]),
  approval_state: ApprovalStateSchema,
  actor_ref: z.string(),
  input_payload_hash: z.string(),
  output_refs: z.array(z.string()),
  job_ref: z.string(),
  mode_context: PlatformModeSchema,
  deterministic_log_ref: z.string(),
  replay_token: z.string(),
  started_at: TimestampSchema,
  finished_at: TimestampSchema.nullable()
});

export const ACTION_CONTRACT = contractEnvelope("action");

export type ActionDefinition = z.infer<typeof ActionDefinitionSchema>;
export type ActionExecution = z.infer<typeof ActionExecutionSchema>;
