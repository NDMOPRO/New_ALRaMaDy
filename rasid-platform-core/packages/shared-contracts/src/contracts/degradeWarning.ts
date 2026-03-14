import { z } from "zod";
import { WarningSchema } from "../common";

export const ExecutionOutcomeSchema = z.object({
  outcome: z.enum(["success", "success_with_warnings", "degraded", "failed"]),
  warnings: z.array(WarningSchema),
  degraded_items: z.array(z.object({ ref: z.string(), reason_code: z.string(), reason: z.string() })),
  failed_items: z.array(z.object({ ref: z.string(), reason_code: z.string(), reason: z.string() })),
  editability_after_run: z.object({ editable_parts: z.array(z.string()), non_editable_parts: z.array(z.string()) }),
  rerun_repair: z.object({ rerun_possible: z.boolean(), repair_possible: z.boolean(), suggested_actions: z.array(z.string()) })
});
