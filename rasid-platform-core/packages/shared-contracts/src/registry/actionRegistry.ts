import { ActionDefinitionSchema } from "../contracts/actionRuntime";

export const ActionRegistry = [
  {
    action_id: "canvas.apply_template.v1",
    action_name: "Apply Template",
    capability: "unified_canvas",
    input_schema: { schema_id: "template-apply-input", version: "1.0.0", uri: "schema://template-apply-input/1.0.0" },
    output_schema: { schema_id: "artifact-output", version: "1.0.0", uri: "schema://artifact-output/1.0.0" },
    required_permissions: ["artifact:write", "template:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "idempotent",
    side_effects: ["artifact_update"],
    evidence_requirements: ["template_application_check", "layout_integrity_check"],
    degrade_policy: "degrade-policy-v1"
  },
  {
    action_id: "dataset.profile.v1",
    action_name: "Profile Dataset",
    capability: "excel_data",
    input_schema: { schema_id: "dataset-profile-input", version: "1.0.0", uri: "schema://dataset-profile-input/1.0.0" },
    output_schema: { schema_id: "dataset-profile-output", version: "1.0.0", uri: "schema://dataset-profile-output/1.0.0" },
    required_permissions: ["source:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    side_effects: [],
    evidence_requirements: ["schema_profile_check"],
    degrade_policy: "degrade-policy-v1"
  }
] as const;

ActionRegistry.forEach((action) => ActionDefinitionSchema.parse(action));
