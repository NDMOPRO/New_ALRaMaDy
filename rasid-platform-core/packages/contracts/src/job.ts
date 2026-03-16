import { z } from "zod";
import {
  ContractEnvelopeSchema,
  FailureReasonSchema,
  JobStateSchema,
  PlatformModeSchema,
  ResourceProfileSchema,
  RetryPolicySchema,
  TimestampSchema,
  WarningSchema,
  contractEnvelope
} from "./common";

export const JobSchema = z.object({
  contract: ContractEnvelopeSchema,
  job_id: z.string(),
  capability: z.enum([
    "governance",
    "strict_replication",
    "presentations",
    "excel_engine",
    "dashboards",
    "reports",
    "arabic_localization_lct",
    "transcription_extraction",
    "rasid_intelligent_operator",
    "unified_canvas"
  ]),
  requested_mode: PlatformModeSchema,
  capability_submode: z.string().default("default"),
  source_refs: z.array(z.string()),
  artifact_refs: z.array(z.string()),
  progress: z.number().min(0).max(100),
  stage: z.string(),
  state: JobStateSchema,
  warnings: z.array(WarningSchema),
  failure_reason: FailureReasonSchema.nullable(),
  retry_policy: RetryPolicySchema,
  evidence_ref: z.string(),
  started_at: TimestampSchema.nullable(),
  finished_at: TimestampSchema.nullable(),
  resource_profile: ResourceProfileSchema
});

export const AllowedJobTransitions: Record<z.infer<typeof JobStateSchema>, z.infer<typeof JobStateSchema>[]> = {
  created: ["queued"],
  queued: ["parsing", "planning", "cancelled"],
  parsing: ["profiling", "failed", "cancelled"],
  profiling: ["planning", "degraded", "failed"],
  planning: ["awaiting_approval", "executing", "failed"],
  awaiting_approval: ["executing", "cancelled"],
  executing: ["verifying", "degraded", "failed", "partially_completed", "cancelled"],
  verifying: ["completed", "degraded", "failed", "partially_completed"],
  completed: [],
  degraded: [],
  failed: [],
  cancelled: [],
  partially_completed: []
};

export const JOB_CONTRACT = contractEnvelope("job");

export type Job = z.infer<typeof JobSchema>;
