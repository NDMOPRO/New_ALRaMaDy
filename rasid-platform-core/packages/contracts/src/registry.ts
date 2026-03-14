import { ActionDefinitionSchema } from "./action";
import { contractEnvelope } from "./common";
import { ExcelActionRegistry, ExcelToolRegistry } from "./excel";
import { strictSchemaRef } from "./strict";
import { ToolRegistrationSchema } from "./tool-registry";

const sharedStrictEvidenceRequirements = [
  "strict_evidence_pack",
  "strict_audit_event",
  "strict_lineage_edge"
] as const;

const strictDegradePolicyRef = "rasid.shared.strict.policy.default@1.0.0";

export const CanvasActionRegistry = [
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
  })
];

export const ExcelDataActionRegistry = [
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dataset.profile.v1",
    action_name: "Profile Dataset",
    capability: "excel_engine",
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
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.create.v1",
    action_name: "Create Dashboard",
    capability: "dashboards",
    input_schema: {
      schema_id: "dashboard-create-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-create-input/1.0.0"
    },
    output_schema: {
      schema_id: "dashboard-engine-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-engine-output/1.0.0"
    },
    required_permissions: ["artifact:write", "source:read", "dashboard:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_create", "dashboard_version_create"],
    evidence_requirements: ["dashboard_structure_check", "binding_integrity_check", "layout_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.mutate.v1",
    action_name: "Mutate Dashboard",
    capability: "dashboards",
    input_schema: {
      schema_id: "dashboard-mutation-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-mutation-input/1.0.0"
    },
    output_schema: {
      schema_id: "dashboard-engine-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-engine-output/1.0.0"
    },
    required_permissions: ["artifact:write", "dashboard:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "dashboard_version_create"],
    evidence_requirements: ["widget_mutation_check", "binding_integrity_check", "layout_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.refresh.v1",
    action_name: "Refresh Dashboard",
    capability: "dashboards",
    input_schema: {
      schema_id: "dashboard-refresh-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-refresh-input/1.0.0"
    },
    output_schema: {
      schema_id: "dashboard-engine-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-engine-output/1.0.0"
    },
    required_permissions: ["source:read", "artifact:write", "dashboard:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "job_create", "dashboard_version_create"],
    evidence_requirements: ["refresh_path_check", "staleness_check", "binding_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.publish.v1",
    action_name: "Publish Dashboard",
    capability: "dashboards",
    input_schema: {
      schema_id: "dashboard-publication-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-publication-input/1.0.0"
    },
    output_schema: {
      schema_id: "dashboard-publication-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-publication-output/1.0.0"
    },
    required_permissions: ["dashboard:write", "publication:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["publication_create", "library_publish"],
    evidence_requirements: ["publication_ready_check", "visibility_scope_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.compare_versions.v1",
    action_name: "Compare Dashboard Versions",
    capability: "dashboards",
    input_schema: {
      schema_id: "dashboard-compare-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-compare-input/1.0.0"
    },
    output_schema: {
      schema_id: "dashboard-compare-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-compare-output/1.0.0"
    },
    required_permissions: ["dashboard:read", "artifact:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "mutating",
    idempotency: "idempotent",
    side_effects: ["artifact_create"],
    evidence_requirements: ["version_compare_check", "diff_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  })
];

export const StrictActionRegistry = [
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.classify_source.v1",
    action_name: "Classify Strict Source",
    capability: "strict_replication",
    input_schema: {
      schema_id: "strict.source_input",
      schema_version: "1.0.0",
      uri: "schema://strict/source_input/1.0.0"
    },
    output_schema: strictSchemaRef("source_fingerprint"),
    required_permissions: ["source:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    side_effects: [],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "source_fingerprint_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.build_cdr_absolute.v1",
    action_name: "Build CDR Absolute",
    capability: "strict_replication",
    input_schema: strictSchemaRef("extraction_manifest"),
    output_schema: strictSchemaRef("cdr_absolute"),
    required_permissions: ["source:read", "artifact:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_create", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "cdr_absolute_integrity_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.deterministic_render.v1",
    action_name: "Deterministic Render",
    capability: "strict_replication",
    input_schema: strictSchemaRef("cdr_absolute"),
    output_schema: strictSchemaRef("deterministic_render_profile"),
    required_permissions: ["artifact:read", "artifact:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["preview_render_create", "evidence_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "deterministic_environment_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.run_structural_gate.v1",
    action_name: "Run Structural Gate",
    capability: "strict_replication",
    input_schema: strictSchemaRef("cdr_absolute"),
    output_schema: strictSchemaRef("structural_equivalence_result"),
    required_permissions: ["artifact:read", "evidence:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    side_effects: ["evidence_write", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "structural_equivalence_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.run_pixel_gate.v1",
    action_name: "Run Pixel Gate",
    capability: "strict_replication",
    input_schema: strictSchemaRef("deterministic_render_profile"),
    output_schema: strictSchemaRef("pixel_equivalence_result"),
    required_permissions: ["artifact:read", "evidence:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    side_effects: ["evidence_write", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "pixel_equivalence_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.run_repair_loop.v1",
    action_name: "Run Repair Loop",
    capability: "strict_replication",
    input_schema: strictSchemaRef("dual_gate_result"),
    output_schema: strictSchemaRef("repair_trace"),
    required_permissions: ["artifact:read", "artifact:write", "evidence:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "conditional",
    preview_support: true,
    mutability: "mutating",
    idempotency: "non_idempotent",
    side_effects: ["artifact_update", "evidence_write", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "repair_iteration_trace"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.run_round_trip_validation.v1",
    action_name: "Run Round Trip Validation",
    capability: "strict_replication",
    input_schema: strictSchemaRef("strict_output_metadata"),
    output_schema: strictSchemaRef("round_trip_validation"),
    required_permissions: ["artifact:read", "evidence:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    side_effects: ["evidence_write", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "round_trip_validation_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.publish_strict_output.v1",
    action_name: "Publish Strict Output",
    capability: "strict_replication",
    input_schema: strictSchemaRef("dual_gate_result"),
    output_schema: strictSchemaRef("strict_output_metadata"),
    required_permissions: ["artifact:write", "publication:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "always",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "strict_publish_check"],
    degrade_policy_ref: strictDegradePolicyRef
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "strict.publish_degraded_output.v1",
    action_name: "Publish Degraded Output",
    capability: "strict_replication",
    input_schema: strictSchemaRef("degrade_reason"),
    output_schema: strictSchemaRef("strict_output_metadata"),
    required_permissions: ["artifact:write", "publication:write"],
    mode_support: { easy: false, advanced: true },
    approval_policy: "always",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write"],
    evidence_requirements: [...sharedStrictEvidenceRequirements, "degraded_publish_check"],
    degrade_policy_ref: strictDegradePolicyRef
  })
];

export const CanvasToolRegistry = [
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
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.create",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: {
      schema_id: "dashboard-create-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-create-input/1.0.0"
    },
    output_contract: {
      schema_id: "dashboard-engine-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-engine-output/1.0.0"
    },
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/artifacts", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 450,
      expected_latency_ms_p95: 2200,
      peak_memory_mb: 384,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["dashboard_structure_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.create.v1",
      degrade_reason_codes: ["dashboard_create_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.mutate",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: {
      schema_id: "dashboard-mutation-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-mutation-input/1.0.0"
    },
    output_contract: {
      schema_id: "dashboard-engine-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-engine-output/1.0.0"
    },
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/artifacts", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 400,
      expected_latency_ms_p95: 1800,
      peak_memory_mb: 320,
      scale_profile: "interactive"
    },
    verification_hooks: ["widget_mutation_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.mutate.v1",
      degrade_reason_codes: ["dashboard_mutation_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.refresh",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: {
      schema_id: "dashboard-refresh-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-refresh-input/1.0.0"
    },
    output_contract: {
      schema_id: "dashboard-engine-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-engine-output/1.0.0"
    },
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/jobs", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 900,
      expected_latency_ms_p95: 4200,
      peak_memory_mb: 512,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["refresh_path_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.refresh.v1",
      degrade_reason_codes: ["dashboard_refresh_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.publish",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: {
      schema_id: "dashboard-publication-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-publication-input/1.0.0"
    },
    output_contract: {
      schema_id: "dashboard-publication-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-publication-output/1.0.0"
    },
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/output-publication", "@rasid/library"],
    performance_profile: {
      expected_latency_ms_p50: 550,
      expected_latency_ms_p95: 2600,
      peak_memory_mb: 256,
      scale_profile: "interactive"
    },
    verification_hooks: ["publication_ready_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.publish.v1",
      degrade_reason_codes: ["dashboard_publish_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.compare_versions",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: {
      schema_id: "dashboard-compare-input",
      schema_version: "1.0.0",
      uri: "schema://dashboard-compare-input/1.0.0"
    },
    output_contract: {
      schema_id: "dashboard-compare-output",
      schema_version: "1.0.0",
      uri: "schema://dashboard-compare-output/1.0.0"
    },
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/artifacts", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 300,
      expected_latency_ms_p95: 1400,
      peak_memory_mb: 256,
      scale_profile: "interactive"
    },
    verification_hooks: ["version_compare_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.compare_versions.v1",
      degrade_reason_codes: ["dashboard_compare_partial"]
    },
    registration_status: "active"
  })
];

export const StrictToolRegistry = [
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.classify-source",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: {
      schema_id: "strict.source_input",
      schema_version: "1.0.0",
      uri: "schema://strict/source_input/1.0.0"
    },
    output_contract: strictSchemaRef("source_fingerprint"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/connectors"],
    performance_profile: {
      expected_latency_ms_p50: 150,
      expected_latency_ms_p95: 900,
      peak_memory_mb: 128,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["source_fingerprint_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "strict.classify_source.v1",
      degrade_reason_codes: ["classification_ambiguous"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.build-cdr-absolute",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("extraction_manifest"),
    output_contract: strictSchemaRef("cdr_absolute"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/artifacts"],
    performance_profile: {
      expected_latency_ms_p50: 600,
      expected_latency_ms_p95: 2500,
      peak_memory_mb: 768,
      scale_profile: "cpu_intensive"
    },
    verification_hooks: ["cdr_absolute_integrity_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "strict.build_cdr_absolute.v1",
      degrade_reason_codes: ["vector_structure_missing", "table_structure_missing"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.deterministic-render",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("cdr_absolute"),
    output_contract: strictSchemaRef("deterministic_render_profile"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/artifacts"],
    performance_profile: {
      expected_latency_ms_p50: 900,
      expected_latency_ms_p95: 4000,
      peak_memory_mb: 1024,
      scale_profile: "gpu_optional"
    },
    verification_hooks: ["deterministic_environment_check"],
    safe_failure_behavior: {
      retryable: false,
      fallback_action_ref: "strict.deterministic_render.v1",
      degrade_reason_codes: ["deterministic_environment_violation"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.run-structural-gate",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("cdr_absolute"),
    output_contract: strictSchemaRef("structural_equivalence_result"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 300,
      expected_latency_ms_p95: 1500,
      peak_memory_mb: 256,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["structural_equivalence_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "strict.run_structural_gate.v1",
      degrade_reason_codes: ["structural_gate_failed"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.run-pixel-gate",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("deterministic_render_profile"),
    output_contract: strictSchemaRef("pixel_equivalence_result"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 500,
      expected_latency_ms_p95: 2400,
      peak_memory_mb: 512,
      scale_profile: "cpu_intensive"
    },
    verification_hooks: ["pixel_equivalence_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "strict.run_pixel_gate.v1",
      degrade_reason_codes: ["pixel_gate_failed"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.run-repair-loop",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("dual_gate_result"),
    output_contract: strictSchemaRef("repair_trace"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 1200,
      expected_latency_ms_p95: 6000,
      peak_memory_mb: 1024,
      scale_profile: "cpu_intensive"
    },
    verification_hooks: ["repair_iteration_trace"],
    safe_failure_behavior: {
      retryable: false,
      fallback_action_ref: "strict.run_repair_loop.v1",
      degrade_reason_codes: ["repair_budget_exhausted"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.run-round-trip-validation",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("strict_output_metadata"),
    output_contract: strictSchemaRef("round_trip_validation"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 650,
      expected_latency_ms_p95: 3200,
      peak_memory_mb: 512,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["round_trip_validation_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "strict.run_round_trip_validation.v1",
      degrade_reason_codes: ["round_trip_failed"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "strict.publish-output",
    owner_capability: "strict_replication",
    version: "1.0.0",
    input_contract: strictSchemaRef("dual_gate_result"),
    output_contract: strictSchemaRef("strict_output_metadata"),
    runtime_dependencies: ["@rasid/runtime", "@rasid/output-publication", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 250,
      expected_latency_ms_p95: 1000,
      peak_memory_mb: 128,
      scale_profile: "batch_safe"
    },
    verification_hooks: ["strict_publish_check", "degraded_publish_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "strict.publish_degraded_output.v1",
      degrade_reason_codes: ["editability_not_preserved", "pixel_gate_failed"]
    },
    registration_status: "active"
  })
];

const presentationSchemaRef = (schemaId: string) => ({
  schema_id: schemaId,
  schema_version: "1.0.0",
  uri: `schema://${schemaId}/1.0.0`
});

const presentationAction = (
  actionId: string,
  actionName: string,
  inputSchemaId: string,
  outputSchemaId: string,
  options: {
    required_permissions: string[];
    preview_support: boolean;
    mutability: "read_only" | "mutating";
    idempotency: "idempotent" | "non_idempotent" | "conditionally_idempotent";
    approval_policy: "never" | "conditional" | "always";
    side_effects: string[];
    evidence_requirements: string[];
    easy?: boolean;
    advanced?: boolean;
  }
) =>
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: actionId,
    action_name: actionName,
    capability: "presentations",
    input_schema: presentationSchemaRef(inputSchemaId),
    output_schema: presentationSchemaRef(outputSchemaId),
    required_permissions: options.required_permissions,
    mode_support: {
      easy: options.easy ?? true,
      advanced: options.advanced ?? true
    },
    approval_policy: options.approval_policy,
    preview_support: options.preview_support,
    mutability: options.mutability,
    idempotency: options.idempotency,
    side_effects: options.side_effects,
    evidence_requirements: options.evidence_requirements,
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  });

export const PresentationActionRegistry = [
  presentationAction(
    "presentations.build_intent_manifest.v1",
    "Build Presentation Intent Manifest",
    "presentation-intent-build-input",
    "presentation_intent_manifest",
    {
      required_permissions: ["source:read"],
      preview_support: false,
      mutability: "read_only",
      idempotency: "idempotent",
      approval_policy: "never",
      side_effects: ["audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["intent_manifest_integrity_check", "source_policy_check"]
    }
  ),
  presentationAction("presentations.build_deck_outline.v1", "Build Deck Outline", "presentation_intent_manifest", "deck_outline", {
    required_permissions: ["source:read"],
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["outline_structure_check", "story_arc_check"]
  }),
  presentationAction("presentations.build_storyboard.v1", "Build Storyboard", "deck_outline", "storyboard_slide_plan", {
    required_permissions: ["source:read", "template:read"],
    preview_support: true,
    mutability: "read_only",
    idempotency: "idempotent",
    approval_policy: "conditional",
    side_effects: ["audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["storyboard_layout_check", "rtl_storyboard_check"]
  }),
  presentationAction("presentations.generate_deck.v1", "Generate Deck", "storyboard_slide_plan", "deck_aggregate", {
    required_permissions: ["artifact:write", "template:read", "source:read"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["deck_generation_check", "editable_path_check", "canonical_binding_check"]
  }),
  presentationAction(
    "presentations.regenerate_slide.v1",
    "Regenerate Slide",
    "presentation-slide-regeneration-input",
    "storyboard_slide_plan",
    {
      required_permissions: ["artifact:write", "source:read"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["slide_regeneration_check", "binding_preservation_check"]
    }
  ),
  presentationAction(
    "presentations.bind_deck_to_data.v1",
    "Bind Deck To Data",
    "presentation-binding-set-input",
    "presentation_binding_set",
    {
      required_permissions: ["artifact:write", "source:read"],
      preview_support: false,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "never",
      side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["binding_integrity_check", "staleness_check"]
    }
  ),
  presentationAction(
    "presentations.apply_template_lock.v1",
    "Apply Template Lock",
    "template-lock-state-input",
    "template_lock_state",
    {
      required_permissions: ["artifact:write", "template:read"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["template_lock_check", "lock_scope_check"]
    }
  ),
  presentationAction("presentations.render_preview.v1", "Render Preview", "presentation-render-preview-input", "presentation_output_metadata", {
    required_permissions: ["artifact:read"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["preview_render_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["preview_render_check", "reader_render_check"]
  }),
  presentationAction("presentations.export_pptx.v1", "Export PPTX", "presentation-export-input", "export_validation_result", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["export_bundle_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["pptx_editability_check", "text_stays_text_check", "chart_editability_check", "table_editability_check"]
  }),
  presentationAction("presentations.export_pdf.v1", "Export PDF", "presentation-export-input", "export_validation_result", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["export_bundle_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["pdf_render_check", "overflow_check", "clipping_check", "rtl_layout_check"]
  }),
  presentationAction("presentations.export_html.v1", "Export HTML", "presentation-export-input", "export_validation_result", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["export_bundle_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["html_render_check", "reader_parity_check", "rtl_layout_check"]
  }),
  presentationAction(
    "presentations.run_render_parity_validation.v1",
    "Run Render Parity Validation",
    "render-parity-validation-input",
    "render_parity_validation",
    {
      required_permissions: ["artifact:read", "evidence:write"],
      preview_support: false,
      mutability: "mutating",
      idempotency: "idempotent",
      approval_policy: "never",
      side_effects: ["evidence_write", "audit_write", "lineage_write"],
      evidence_requirements: ["render_parity_check", "template_lock_check", "rtl_layout_check", "overflow_check", "clipping_check"]
    }
  ),
  presentationAction(
    "presentations.publish_presentation_artifact.v1",
    "Publish Presentation Artifact",
    "presentation-publish-input",
    "presentation_output_metadata",
    {
      required_permissions: ["artifact:write", "publication:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "always",
      side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["publication_ready_check", "render_parity_check", "evidence_pack_check"]
    }
  ),
  presentationAction(
    "presentations.publish_degraded_presentation_artifact.v1",
    "Publish Degraded Presentation Artifact",
    "presentation-degraded-publish-input",
    "presentation_output_metadata",
    {
      required_permissions: ["artifact:write", "publication:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "always",
      side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["degraded_publish_check", "render_parity_check", "evidence_pack_check"],
      easy: false,
      advanced: true
    }
  )
];

export const ActionRegistry = [
  ...CanvasActionRegistry,
  ...ExcelDataActionRegistry,
  ...ExcelActionRegistry,
  ...PresentationActionRegistry,
  ...StrictActionRegistry
];
export const ToolRegistry = [...CanvasToolRegistry, ...ExcelToolRegistry, ...StrictToolRegistry];

export const listActionsForCapability = (capabilityId: string) =>
  ActionRegistry.filter((action) => action.capability === capabilityId);

export const listToolsForCapability = (capabilityId: string) =>
  ToolRegistry.filter((tool) => tool.owner_capability === capabilityId);
