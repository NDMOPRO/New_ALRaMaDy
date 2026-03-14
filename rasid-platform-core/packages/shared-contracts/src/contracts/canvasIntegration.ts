import { z } from "zod";
import { ModeSchema } from "../common";

export const DragDropPayloadSchema = z.object({
  payload_id: z.string(),
  payload_type: z.enum(["source_ref", "artifact_ref", "asset_ref", "template_ref", "data_binding"]),
  refs: z.array(z.string()),
  origin: z.string(),
  target: z.string(),
  timestamp: z.string()
});

export const CanvasSessionStateSchema = z.object({
  session_id: z.string(),
  workspace_id: z.string(),
  tenant_ref: z.string(),
  mode_state: ModeSchema,
  selected_sources: z.array(z.string()),
  selected_artifacts: z.array(z.string()),
  action_suggestions: z.array(z.record(z.any())),
  action_execution_state: z.array(z.record(z.any())),
  inspector_state: z.record(z.any()),
  evidence_drawer_state: z.record(z.any()),
  compare_state: z.record(z.any()),
  library_state: z.record(z.any()),
  drag_drop_payloads: z.array(DragDropPayloadSchema)
});
