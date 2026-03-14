import { z } from "zod";
import { ModeSchema, WarningSchema } from "../common";

export const JobLifecycleSchema = z.object({
  job_id: z.string(),
  capability: z.enum([
    "strict_replication",
    "presentations",
    "excel_data",
    "dashboards",
    "reports",
    "lct",
    "rasid_operator",
    "unified_canvas"
  ]),
  requested_mode: ModeSchema,
  source_refs: z.array(z.string()),
  artifact_refs: z.array(z.string()),
  state: z.enum([
    "created",
    "queued",
    "parsing",
    "profiling",
    "planning",
    "awaiting_approval",
    "executing",
    "verifying",
    "completed",
    "degraded",
    "failed",
    "cancelled",
    "partially_completed"
  ]),
  progress: z.number().min(0).max(100),
  stage: z.string(),
  warnings: z.array(WarningSchema),
  failure_reason: z.string().optional(),
  retry_policy: z.object({ max_retries: z.number(), backoff_ms: z.number(), strategy: z.enum(["fixed", "exponential"]) }),
  evidence_ref: z.string(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  resource_profile: z.object({ cpu_class: z.string(), memory_class: z.string(), io_class: z.string() })
});
