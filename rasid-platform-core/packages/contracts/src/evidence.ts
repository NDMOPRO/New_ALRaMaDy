import { z } from "zod";
import {
  ContractEnvelopeSchema,
  FailureReasonSchema,
  MetricSchema,
  VerificationStatusSchema,
  WarningSchema,
  contractEnvelope
} from "./common";

export const ValidationCheckResultSchema = z.object({
  check_id: z.string(),
  check_name: z.string(),
  check_type: z.string(),
  passed: z.boolean(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  details: z.string(),
  impacted_refs: z.array(z.string())
});

export const EvidencePackSchema = z.object({
  contract: ContractEnvelopeSchema,
  evidence_pack_id: z.string(),
  verification_status: VerificationStatusSchema,
  source_refs: z.array(z.string()),
  generated_artifact_refs: z.array(z.string()),
  checks_executed: z.array(ValidationCheckResultSchema),
  before_refs: z.array(z.string()),
  after_refs: z.array(z.string()),
  metrics: z.array(MetricSchema),
  warnings: z.array(WarningSchema),
  failure_reasons: z.array(FailureReasonSchema),
  degraded_reasons: z.array(FailureReasonSchema),
  replay_context: z.record(z.unknown()),
  reproducibility_metadata: z.object({
    replay_token: z.string(),
    execution_seed: z.string(),
    environment_stamp: z.string(),
    tool_versions: z.array(z.record(z.unknown()))
  }),
  strict_evidence_level: z.enum(["standard", "strong"])
});

export const EVIDENCE_CONTRACT = contractEnvelope("evidence");

export type ValidationCheckResult = z.infer<typeof ValidationCheckResultSchema>;
export type EvidencePack = z.infer<typeof EvidencePackSchema>;
