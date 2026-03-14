import { z } from "zod";

export const ToolRegistrationSchema = z.object({
  tool_id: z.string(),
  owner_capability: z.string(),
  version: z.string(),
  input_contract: z.object({ schema_id: z.string(), version: z.string(), uri: z.string() }),
  output_contract: z.object({ schema_id: z.string(), version: z.string(), uri: z.string() }),
  runtime_dependencies: z.array(z.string()),
  performance_profile: z.object({
    expected_latency_ms_p50: z.number(),
    expected_latency_ms_p95: z.number(),
    memory_mb: z.number()
  }),
  verification_hooks: z.array(z.string()),
  safe_failure_behavior: z.object({
    retryable: z.boolean(),
    fallback_action: z.string(),
    degrade_reason_code: z.string()
  }),
  status: z.enum(["active", "deprecated", "blocked"])
});
