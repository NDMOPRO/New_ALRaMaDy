import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const CanvasContract = { contract: "canvas_integration", version: "1.0.0" };

export function validateCanvasState(model) {
  assertVersioned("canvas_integration", model);
  assertRequired(model, [
    "session_id", "workspace_id", "tenant_ref", "mode_state", "selected_sources",
    "selected_artifacts", "action_suggestions", "action_execution_state", "inspector_state",
    "evidence_drawer_state", "compare_state", "library_state", "drag_drop_payloads"
  ], "canvas_integration");
  return true;
}
