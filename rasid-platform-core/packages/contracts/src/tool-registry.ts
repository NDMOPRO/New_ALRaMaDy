import { z } from "zod";
import { ContractEnvelopeSchema, JsonSchemaRefSchema, contractEnvelope } from "./common";

export const ToolRegistrationSchema = z.object({
  contract: ContractEnvelopeSchema,
  tool_id: z.string(),
  owner_capability: z.string(),
  version: z.string(),
  input_contract: JsonSchemaRefSchema,
  output_contract: JsonSchemaRefSchema,
  runtime_dependencies: z.array(z.string()),
  performance_profile: z.object({
    expected_latency_ms_p50: z.number(),
    expected_latency_ms_p95: z.number(),
    peak_memory_mb: z.number(),
    scale_profile: z.string()
  }),
  verification_hooks: z.array(z.string()),
  safe_failure_behavior: z.object({
    retryable: z.boolean(),
    fallback_action_ref: z.string(),
    degrade_reason_codes: z.array(z.string())
  }),
  registration_status: z.enum(["active", "blocked", "deprecated"])
});

export const TOOL_REGISTRY_CONTRACT = contractEnvelope("tool_registry");

export type ToolRegistration = z.infer<typeof ToolRegistrationSchema>;
