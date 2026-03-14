import { validateActionDefinition } from "../../contracts/src/index.mjs";

export const ActionRegistry = {
  contract: "action_runtime",
  version: "1.0.0",
  actions: [
    {
      contract: "action_runtime",
      version: "1.0.0",
      action_id: "dataset.profile.v1",
      action_name: "Profile Dataset",
      capability: "excel_data",
      input_schema: { id: "dataset_input", version: "1.0.0" },
      output_schema: { id: "dataset_profile", version: "1.0.0" },
      required_permissions: ["source:read"],
      mode_support: ["easy", "advanced"],
      approval_policy: "never",
      preview_support: false,
      mutability: "read_only",
      idempotency: "idempotent",
      side_effects: [],
      evidence_requirements: ["schema_profile_check"],
      degrade_policy: "degrade_warning@1.0.0"
    }
  ]
};

ActionRegistry.actions.forEach(validateActionDefinition);
