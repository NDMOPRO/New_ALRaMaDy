import { z } from "zod";
import { VerificationStatusSchema, WarningSchema } from "../common";

const ValidationCheckResultSchema = z.object({ check_id: z.string(), check_name: z.string(), passed: z.boolean(), details: z.string() });

export const EvidenceStatusSchema = z.object({
  verification_status: VerificationStatusSchema,
  evidence_pack_ref: z.string(),
  warnings: z.array(WarningSchema),
  validation_checks_executed: z.array(ValidationCheckResultSchema),
  failure_reasons: z.array(z.string()),
  degraded_reasons: z.array(z.string()),
  reproducibility_metadata: z.object({ replay_token: z.string(), seed: z.string(), environment_stamp: z.string() })
});

export const EvidencePackSchema = z.object({
  evidence_pack_id: z.string(),
  source_refs: z.array(z.string()),
  generated_artifact_refs: z.array(z.string()),
  checks_executed: z.array(ValidationCheckResultSchema),
  before_refs: z.array(z.string()),
  after_refs: z.array(z.string()),
  metrics: z.array(z.object({ name: z.string(), value: z.number(), unit: z.string() })),
  warnings_errors: z.array(z.object({ level: z.enum(["warning", "error"]), message: z.string() })),
  replay_context: z.record(z.any()),
  environment_stamp: z.string(),
  strict_evidence_level: z.enum(["standard", "strong"])
});
