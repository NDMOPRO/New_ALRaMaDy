import { z } from "zod";
import { ContractEnvelopeSchema, StringListSchema, TimestampSchema, contractEnvelope } from "./common";

export const SCHEDULE_SCHEMA_NAMESPACE = "rasid.shared.schedule.v1" as const;
export const SCHEDULE_SCHEMA_VERSION = "1.0.0" as const;

export const ScheduleCadenceSchema = z.enum(["weekly", "monthly", "on_demand", "custom"]);
export const ScheduleStateSchema = z.enum(["enabled", "disabled"]);

export const ScheduleTriggerPolicySchema = z.object({
  trigger_mode: z.enum(["calendar", "manual", "event"]),
  misfire_policy: z.enum(["skip", "run_next", "run_immediately"]),
  require_fresh_inputs: z.boolean(),
  require_approval_before_run: z.boolean(),
  freshness_window_minutes: z.number().int().nonnegative().nullable()
});

export const SchedulePublicationPolicySchema = z.object({
  publish_mode: z.enum(["never", "on_success", "on_approval", "always"]),
  publication_target_refs: StringListSchema,
  export_profile_refs: StringListSchema,
  visibility_scope_ref: z.string().nullable()
});

export const SharedScheduleSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(SCHEDULE_SCHEMA_NAMESPACE),
  schema_version: z.literal(SCHEDULE_SCHEMA_VERSION),
  schedule_id: z.string(),
  schedule_type: z.string().min(1),
  capability: z.string().min(1),
  subject_refs: StringListSchema,
  cadence: ScheduleCadenceSchema,
  timezone: z.string().min(1),
  trigger_policy: ScheduleTriggerPolicySchema,
  next_run_at: TimestampSchema.nullable(),
  publication_policy: SchedulePublicationPolicySchema,
  state: ScheduleStateSchema,
  last_run_ref: z.string().nullable(),
  execution_template_ref: z.string().nullable(),
  extension_refs: StringListSchema,
  created_by: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const SCHEDULE_CONTRACT = contractEnvelope("schedule");

export const validateSharedSchedule = (input: unknown): SharedSchedule => SharedScheduleSchema.parse(input);

export const ScheduleValidators = {
  shared_schedule: validateSharedSchedule
} as const;

export type ScheduleCadence = z.infer<typeof ScheduleCadenceSchema>;
export type ScheduleState = z.infer<typeof ScheduleStateSchema>;
export type ScheduleTriggerPolicy = z.infer<typeof ScheduleTriggerPolicySchema>;
export type SchedulePublicationPolicy = z.infer<typeof SchedulePublicationPolicySchema>;
export type SharedSchedule = z.infer<typeof SharedScheduleSchema>;
