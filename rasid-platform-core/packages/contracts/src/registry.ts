import { ActionDefinitionSchema } from "./action";
import { contractEnvelope } from "./common";
import { ToolRegistrationSchema } from "./tool-registry";

export const ActionRegistry = [
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "canvas.apply_template.v1",
    action_name: "Apply Template",
    capability: "unified_canvas",
    input_schema: {
      schema_id: "template-apply-input",
      schema_version: "1.0.0",
      uri: "schema://template-apply-input/1.0.0"
    },
    output_schema: {
      schema_id: "artifact-output",
      schema_version: "1.0.0",
      uri: "schema://artifact-output/1.0.0"
    },
    required_permissions: ["artifact:write", "template:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "idempotent",
    side_effects: ["artifact_update"],
    evidence_requirements: ["template_application_check", "layout_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dataset.profile.v1",
    action_name: "Profile Dataset",
    capability: "excel_data",
    input_schema: {
      schema_id: "dataset-profile-input",
      schema_version: "1.0.0",
      uri: "schema://dataset-profile-input/1.0.0"
    },
    output_schema: {
      schema_id: "dataset-profile-output",
      schema_version: "1.0.0",
      uri: "schema://dataset-profile-output/1.0.0"
    },
    required_permissions: ["source:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    side_effects: [],
    evidence_requirements: ["schema_profile_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  })
];

export const ToolRegistry = [
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.canvas-template.apply",
    owner_capability: "unified_canvas",
    version: "1.0.0",
    input_contract: {
      schema_id: "template-apply-input",
      schema_version: "1.0.0",
      uri: "schema://template-apply-input/1.0.0"
    },
    output_contract: {
      schema_id: "artifact-output",
      schema_version: "1.0.0",
      uri: "schema://artifact-output/1.0.0"
    },
    runtime_dependencies: ["@rasid/runtime", "@rasid/artifacts"],
    performance_profile: {
      expected_latency_ms_p50: 250,
      expected_latency_ms_p95: 1200,
      peak_memory_mb: 256,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["template_application_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "canvas.apply_template.v1",
      degrade_reason_codes: ["template_apply_partial"]
    },
    registration_status: "active"
  })
];
