import { validateActionDefinition } from "../../contracts/src/index.mjs";
import { ActionRegistry } from "./action-registry.mjs";

export { ActionRegistry };

export function executeAction(action, payload) {
  validateActionDefinition(action);
  return {
    execution_id: `exec_${Date.now()}`,
    action_id: action.action_id,
    status: "accepted",
    payload
  };
}
