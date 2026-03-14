import { assertRequired, assertOneOf, assertVersioned, Modes, DegradeOutcomes } from "../../common/src/index.mjs";

export const CanonicalContract = { contract: "canonical", version: "1.0.0" };
export const ActionRuntimeContract = { contract: "action_runtime", version: "1.0.0" };
export const ModeContract = { contract: "mode", version: "1.0.0", allowed: [Modes.EASY, Modes.ADVANCED] };
export const DegradeWarningContract = {
  contract: "degrade_warning",
  version: "1.0.0",
  allowed_outcomes: Object.values(DegradeOutcomes)
};

export function validateCanonical(model) {
  assertVersioned("canonical", model);
  assertRequired(model, [
    "source_descriptors", "entities", "layout_metadata", "data_binding_refs", "formula_refs",
    "semantic_labels", "lineage_refs", "template_refs", "localization", "editability_flags",
    "strictness_mode", "evidence_refs"
  ], "canonical");
  return true;
}

export function validateActionDefinition(action) {
  assertVersioned("action_runtime", action);
  assertRequired(action, [
    "action_id", "action_name", "capability", "input_schema", "output_schema",
    "required_permissions", "mode_support", "approval_policy", "preview_support",
    "mutability", "idempotency", "side_effects", "evidence_requirements", "degrade_policy"
  ], "action_runtime");
  return true;
}

export function validateMode(mode) {
  assertOneOf(mode, ModeContract.allowed, "mode");
  return true;
}

export function validateDegrade(outcome) {
  assertOneOf(outcome.outcome, DegradeWarningContract.allowed_outcomes, "outcome");
  assertRequired(outcome, ["warnings", "degraded_items", "failed_items", "editability_after_run", "rerun_repair"], "degrade_warning");
  return true;
}
