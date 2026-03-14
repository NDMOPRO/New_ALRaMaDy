import { z } from "zod";
import { ContractEnvelopeSchema, ExecutionOutcomeSchema, FailureReasonSchema, WarningSchema, contractEnvelope } from "./common";

export const DegradeReportSchema = z.object({
  contract: ContractEnvelopeSchema,
  outcome: ExecutionOutcomeSchema,
  warnings: z.array(WarningSchema),
  degraded_reasons: z.array(FailureReasonSchema),
  what_degraded: z.array(z.string()),
  remaining_editable_refs: z.array(z.string()),
  non_editable_refs: z.array(z.string()),
  rerun_possible: z.boolean(),
  repair_possible: z.boolean(),
  suggested_repair_actions: z.array(z.string())
});

export const DEGRADE_CONTRACT = contractEnvelope("degrade");

export type DegradeReport = z.infer<typeof DegradeReportSchema>;
