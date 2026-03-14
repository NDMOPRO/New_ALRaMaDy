import { z } from "zod";
import { ContractEnvelopeSchema, PlatformModeSchema, contractEnvelope } from "./common";

export const ModeContextSchema = z.object({
  contract: ContractEnvelopeSchema,
  top_level_mode: PlatformModeSchema,
  capability_submode: z.string(),
  guidance_level: z.enum(["guided", "balanced", "fully_explicit"]),
  automation_level: z.enum(["safe_defaults", "operator_assisted", "manual_control"])
});

export const ActionSuggestionSchema = z.object({
  suggestion_id: z.string(),
  action_ref: z.string(),
  origin: z.enum(["user_context", "rule_engine", "ai"]),
  requires_approval: z.boolean()
});

export const ActionExecutionStateSchema = z.object({
  execution_ref: z.string(),
  state: z.enum(["idle", "pending", "running", "verifying", "completed", "degraded", "failed"]),
  warning_refs: z.array(z.string())
});

export const DragDropPayloadSchema = z.object({
  payload_id: z.string(),
  payload_type: z.enum(["source_ref", "artifact_ref", "asset_ref", "template_ref", "data_binding"]),
  refs: z.array(z.string()),
  origin_surface: z.string(),
  target_surface: z.string(),
  timestamp: z.string()
});

export const CanvasSessionStateSchema = z.object({
  contract: ContractEnvelopeSchema,
  session_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  mode_state: ModeContextSchema,
  selected_sources: z.array(z.string()),
  selected_artifacts: z.array(z.string()),
  action_suggestions: z.array(ActionSuggestionSchema),
  action_execution_state: z.array(ActionExecutionStateSchema),
  inspector_state: z.record(z.unknown()),
  evidence_drawer_state: z.record(z.unknown()),
  compare_state: z.record(z.unknown()),
  library_state: z.record(z.unknown()),
  drag_drop_payloads: z.array(DragDropPayloadSchema)
});

export const MODE_CONTRACT = contractEnvelope("mode");
export const CANVAS_CONTRACT = contractEnvelope("canvas");

export type ModeContext = z.infer<typeof ModeContextSchema>;
export type CanvasSessionState = z.infer<typeof CanvasSessionStateSchema>;
