import { ActionDefinitionSchema } from "./action";
import { AI_CAPABILITY_ID, aiSchemaRef } from "./ai";
import { contractEnvelope } from "./common";
import { ExcelActionRegistry, ExcelToolRegistry } from "./excel";
import { GOVERNANCE_CAPABILITY_ID, governanceSchemaRef } from "./governance";
import { LOCALIZATION_CAPABILITY_ID } from "./localization";
import { REPORT_CAPABILITY_ID, reportSchemaRef } from "./report";
import { strictSchemaRef } from "./strict";
import { TRANSCRIPTION_CAPABILITY_ID, transcriptionSchemaRef } from "./transcription";
import { ToolRegistrationSchema } from "./tool-registry";

const sharedStrictEvidenceRequirements = [
  "strict_evidence_pack",
  "strict_audit_event",
  "strict_lineage_edge"
] as const;

const strictDegradePolicyRef = "rasid.shared.strict.policy.default@1.0.0";
const localizationDegradePolicyRef = "rasid.shared.localization.policy.default@1.0.0";
const sharedLocalizationEvidenceRequirements = [
  "localization_evidence_pack",
  "localization_audit_event",
  "localization_lineage_edge"
] as const;
const sharedReportEvidenceRequirements = ["report_evidence_pack", "report_audit_event", "report_lineage_edge"] as const;
const sharedTranscriptionEvidenceRequirements = [
  "transcription_evidence_pack",
  "transcription_audit_event",
  "transcription_lineage_edge"
] as const;

const localizationSchemaRef = (schemaId: string) => ({
  schema_id: schemaId,
  schema_version: "1.0.0",
  uri: `schema://${schemaId}/1.0.0`
});

const dashboardSchemaRef = (schemaId: string) => ({
  schema_id: schemaId,
  schema_version: "1.0.0",
  uri: `schema://${schemaId}/1.0.0`
});

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
      schema_id: "dashboard_compare_result",
      schema_version: "1.0.0",
      uri: "schema://dashboard_compare_result/1.0.0"
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
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.interaction.filter.v1",
    action_name: "Execute Dashboard Filter Interaction",
    capability: "dashboards",
    input_schema: dashboardSchemaRef("dashboard-interaction-filter-input"),
    output_schema: dashboardSchemaRef("dashboard-engine-output"),
    required_permissions: ["dashboard:write", "artifact:write", "source:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["interaction_filter_check", "binding_integrity_check", "refresh_path_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.interaction.selection.v1",
    action_name: "Execute Dashboard Selection Interaction",
    capability: "dashboards",
    input_schema: dashboardSchemaRef("dashboard-interaction-selection-input"),
    output_schema: dashboardSchemaRef("dashboard-engine-output"),
    required_permissions: ["dashboard:write", "artifact:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["interaction_selection_check", "interaction_state_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.interaction.drill.v1",
    action_name: "Execute Dashboard Drill Interaction",
    capability: "dashboards",
    input_schema: dashboardSchemaRef("dashboard-interaction-drill-input"),
    output_schema: dashboardSchemaRef("dashboard-engine-output"),
    required_permissions: ["dashboard:write", "artifact:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["interaction_drill_check", "navigation_target_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.interaction.refresh.v1",
    action_name: "Execute Dashboard Refresh Interaction",
    capability: "dashboards",
    input_schema: dashboardSchemaRef("dashboard-interaction-refresh-input"),
    output_schema: dashboardSchemaRef("dashboard-engine-output"),
    required_permissions: ["dashboard:write", "artifact:write", "source:read"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["interaction_refresh_check", "refresh_path_check", "binding_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  }),
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: "dashboard.interaction.compare.v1",
    action_name: "Execute Dashboard Compare Interaction",
    capability: "dashboards",
    input_schema: dashboardSchemaRef("dashboard-interaction-compare-input"),
    output_schema: dashboardSchemaRef("dashboard_compare_result"),
    required_permissions: ["dashboard:read", "artifact:write"],
    mode_support: { easy: true, advanced: true },
    approval_policy: "never",
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    side_effects: ["artifact_update", "artifact_create", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["interaction_compare_check", "version_compare_check", "diff_integrity_check"],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  })
];

const reportAction = (
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
    capability: REPORT_CAPABILITY_ID,
    input_schema: reportSchemaRef(inputSchemaId),
    output_schema: reportSchemaRef(outputSchemaId),
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
    evidence_requirements: [...sharedReportEvidenceRequirements, ...options.evidence_requirements],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  });

export const ReportActionRegistry = [
  reportAction("reports.create_report.v1", "Create Report", "report-create-input", "report", {
    required_permissions: ["artifact:write", "source:read", "template:read", "report:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_create", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["report_structure_check", "template_resolution_check", "binding_integrity_check"]
  }),
  reportAction("reports.update_report.v1", "Update Report", "report-update-input", "report_version", {
    required_permissions: ["artifact:write", "report:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_update", "report_version_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["report_mutation_check", "section_integrity_check", "version_chain_check"]
  }),
  reportAction("reports.refresh_report.v1", "Refresh Report", "report-refresh-input", "report_version", {
    required_permissions: ["artifact:write", "source:read", "report:write"],
    preview_support: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["artifact_update", "job_create", "report_version_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["refresh_path_check", "staleness_check", "selective_regeneration_check"]
  }),
  reportAction("reports.compare_reports.v1", "Compare Reports", "report-compare-input", "report_diff_metadata", {
    required_permissions: ["report:read", "artifact:write"],
    preview_support: false,
    mutability: "mutating",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["version_compare_check", "diff_integrity_check", "change_highlight_check"]
  }),
  reportAction("reports.review_report.v1", "Review Report", "report-review-input", "report_review_state", {
    required_permissions: ["report:read", "report:review"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["review_state_transition_check", "review_comment_trace_check"]
  }),
  reportAction("reports.approve_report.v1", "Approve Report", "report-approve-input", "report_approval_state", {
    required_permissions: ["report:approve", "publication:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "always",
    side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["approval_state_transition_check", "approval_actor_check"]
  }),
  reportAction("reports.publish_report.v1", "Publish Report", "report-publish-input", "output_publication", {
    required_permissions: ["report:write", "publication:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "always",
    side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["publication_ready_check", "visibility_scope_check", "publish_trace_check"]
  }),
  reportAction("reports.schedule_report.v1", "Schedule Report", "report-schedule-input", "shared_schedule", {
    required_permissions: ["report:write", "schedule:write", "publication:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["schedule_create", "job_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["schedule_contract_check", "timezone_policy_check", "publication_policy_check"]
  }),
  reportAction("reports.export_report_docx.v1", "Export Report DOCX", "report-export-input", "artifact", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["export_bundle_update", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["docx_editability_check", "export_bundle_check"]
  }),
  reportAction("reports.export_report_pdf.v1", "Export Report PDF", "report-export-input", "artifact", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["export_bundle_update", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["pdf_render_check", "export_bundle_check"]
  }),
  reportAction("reports.export_report_html.v1", "Export Report HTML", "report-export-input", "artifact", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["export_bundle_update", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["html_render_check", "export_bundle_check"]
  }),
  reportAction(
    "reports.convert_report_to_presentation.v1",
    "Convert Report To Presentation",
    "report-convert-presentation-input",
    "deck_aggregate",
    {
      required_permissions: ["artifact:read", "artifact:write", "presentation:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["presentation_conversion_check", "derived_output_lineage_check"]
    }
  ),
  reportAction("reports.convert_report_to_dashboard.v1", "Convert Report To Dashboard", "report-convert-dashboard-input", "dashboard", {
    required_permissions: ["artifact:read", "artifact:write", "dashboard:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["dashboard_conversion_check", "derived_output_lineage_check"]
  }),
  reportAction(
    "reports.publish_degraded_report_output.v1",
    "Publish Degraded Report Output",
    "report-degraded-publish-input",
    "output_publication",
    {
      required_permissions: ["artifact:write", "publication:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "always",
      side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: ["degraded_publish_check", "degrade_reason_capture_check"],
      easy: false,
      advanced: true
    }
  )
];

const transcriptionAction = (
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
    capability: TRANSCRIPTION_CAPABILITY_ID,
    input_schema: transcriptionSchemaRef(inputSchemaId),
    output_schema: transcriptionSchemaRef(outputSchemaId),
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
    evidence_requirements: [...sharedTranscriptionEvidenceRequirements, ...options.evidence_requirements],
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  });

export const TranscriptionActionRegistry = [
  transcriptionAction(
    "transcription.ingest_and_extract.v1",
    "Ingest And Extract Multimodal Content",
    "transcription_job_request",
    "unified_content_bundle",
    {
      required_permissions: ["source:read", "artifact:write", "evidence:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_create", "job_create", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [
        "ingest_integrity_check",
        "transcript_generation_check",
        "ocr_extraction_check",
        "structured_extraction_check"
      ]
    }
  ),
  transcriptionAction("transcription.compare.v1", "Compare Extracted Bundles", "transcription-compare-input", "transcription_compare_result", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["compare_diff_check", "comparison_lineage_check"]
  }),
  transcriptionAction("transcription.answer_question.v1", "Answer Question Across Bundles", "transcription-question-request", "transcription_question_answer", {
    required_permissions: ["artifact:read"],
    preview_support: true,
    mutability: "read_only",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["question_grounding_check", "citation_integrity_check"]
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
      schema_id: "dashboard_compare_result",
      schema_version: "1.0.0",
      uri: "schema://dashboard_compare_result/1.0.0"
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
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.interaction.filter",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: dashboardSchemaRef("dashboard-interaction-filter-input"),
    output_contract: dashboardSchemaRef("dashboard-engine-output"),
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/jobs", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 420,
      expected_latency_ms_p95: 2100,
      peak_memory_mb: 320,
      scale_profile: "interactive"
    },
    verification_hooks: ["interaction_filter_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.interaction.filter.v1",
      degrade_reason_codes: ["dashboard_interaction_filter_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.interaction.selection",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: dashboardSchemaRef("dashboard-interaction-selection-input"),
    output_contract: dashboardSchemaRef("dashboard-engine-output"),
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 260,
      expected_latency_ms_p95: 1200,
      peak_memory_mb: 256,
      scale_profile: "interactive"
    },
    verification_hooks: ["interaction_selection_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.interaction.selection.v1",
      degrade_reason_codes: ["dashboard_interaction_selection_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.interaction.drill",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: dashboardSchemaRef("dashboard-interaction-drill-input"),
    output_contract: dashboardSchemaRef("dashboard-engine-output"),
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 280,
      expected_latency_ms_p95: 1400,
      peak_memory_mb: 256,
      scale_profile: "interactive"
    },
    verification_hooks: ["interaction_drill_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.interaction.drill.v1",
      degrade_reason_codes: ["dashboard_interaction_drill_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.interaction.refresh",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: dashboardSchemaRef("dashboard-interaction-refresh-input"),
    output_contract: dashboardSchemaRef("dashboard-engine-output"),
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/jobs", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 700,
      expected_latency_ms_p95: 3000,
      peak_memory_mb: 384,
      scale_profile: "interactive"
    },
    verification_hooks: ["interaction_refresh_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.interaction.refresh.v1",
      degrade_reason_codes: ["dashboard_interaction_refresh_partial"]
    },
    registration_status: "active"
  }),
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: "registry.dashboard.interaction.compare",
    owner_capability: "dashboards",
    version: "1.0.0",
    input_contract: dashboardSchemaRef("dashboard-interaction-compare-input"),
    output_contract: dashboardSchemaRef("dashboard_compare_result"),
    runtime_dependencies: ["@rasid/dashboard-engine", "@rasid/artifacts", "@rasid/evidence"],
    performance_profile: {
      expected_latency_ms_p50: 360,
      expected_latency_ms_p95: 1600,
      peak_memory_mb: 256,
      scale_profile: "interactive"
    },
    verification_hooks: ["interaction_compare_check"],
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: "dashboard.interaction.compare.v1",
      degrade_reason_codes: ["dashboard_interaction_compare_partial"]
    },
    registration_status: "active"
  })
];

const reportTool = (
  toolId: string,
  actionId: string,
  inputSchemaId: string,
  outputSchemaId: string,
  verificationHooks: string[],
  degradeReasonCodes: string[],
  performanceProfile: {
    expected_latency_ms_p50: number;
    expected_latency_ms_p95: number;
    peak_memory_mb: number;
    scale_profile: string;
  },
  runtimeDependencies: string[]
) =>
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: toolId,
    owner_capability: REPORT_CAPABILITY_ID,
    version: "1.0.0",
    input_contract: reportSchemaRef(inputSchemaId),
    output_contract: reportSchemaRef(outputSchemaId),
    runtime_dependencies: runtimeDependencies,
    performance_profile: performanceProfile,
    verification_hooks: verificationHooks,
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: actionId,
      degrade_reason_codes: degradeReasonCodes
    },
    registration_status: "active"
  });

export const ReportToolRegistry = [
  reportTool(
    "registry.reports.create_report",
    "reports.create_report.v1",
    "report-create-input",
    "report",
    ["report_structure_check"],
    ["report_create_partial"],
    { expected_latency_ms_p50: 650, expected_latency_ms_p95: 3200, peak_memory_mb: 512, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.update_report",
    "reports.update_report.v1",
    "report-update-input",
    "report_version",
    ["report_mutation_check"],
    ["report_update_partial"],
    { expected_latency_ms_p50: 420, expected_latency_ms_p95: 2100, peak_memory_mb: 384, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.refresh_report",
    "reports.refresh_report.v1",
    "report-refresh-input",
    "report_version",
    ["refresh_path_check"],
    ["report_refresh_partial"],
    { expected_latency_ms_p50: 900, expected_latency_ms_p95: 4600, peak_memory_mb: 640, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/jobs", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.compare_reports",
    "reports.compare_reports.v1",
    "report-compare-input",
    "report_diff_metadata",
    ["version_compare_check"],
    ["report_compare_partial"],
    { expected_latency_ms_p50: 340, expected_latency_ms_p95: 1600, peak_memory_mb: 256, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.review_report",
    "reports.review_report.v1",
    "report-review-input",
    "report_review_state",
    ["review_state_transition_check"],
    ["report_review_partial"],
    { expected_latency_ms_p50: 280, expected_latency_ms_p95: 1200, peak_memory_mb: 192, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.approve_report",
    "reports.approve_report.v1",
    "report-approve-input",
    "report_approval_state",
    ["approval_state_transition_check"],
    ["report_approval_partial"],
    { expected_latency_ms_p50: 260, expected_latency_ms_p95: 1100, peak_memory_mb: 192, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.publish_report",
    "reports.publish_report.v1",
    "report-publish-input",
    "output_publication",
    ["publication_ready_check"],
    ["report_publish_partial"],
    { expected_latency_ms_p50: 300, expected_latency_ms_p95: 1300, peak_memory_mb: 192, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/output-publication", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.schedule_report",
    "reports.schedule_report.v1",
    "report-schedule-input",
    "shared_schedule",
    ["schedule_contract_check"],
    ["report_schedule_partial"],
    { expected_latency_ms_p50: 240, expected_latency_ms_p95: 1000, peak_memory_mb: 160, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/jobs", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.export_report_docx",
    "reports.export_report_docx.v1",
    "report-export-input",
    "artifact",
    ["docx_editability_check"],
    ["report_export_docx_partial"],
    { expected_latency_ms_p50: 520, expected_latency_ms_p95: 2400, peak_memory_mb: 384, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.export_report_pdf",
    "reports.export_report_pdf.v1",
    "report-export-input",
    "artifact",
    ["pdf_render_check"],
    ["report_export_pdf_partial"],
    { expected_latency_ms_p50: 520, expected_latency_ms_p95: 2400, peak_memory_mb: 384, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.export_report_html",
    "reports.export_report_html.v1",
    "report-export-input",
    "artifact",
    ["html_render_check"],
    ["report_export_html_partial"],
    { expected_latency_ms_p50: 460, expected_latency_ms_p95: 2100, peak_memory_mb: 320, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.convert_report_to_presentation",
    "reports.convert_report_to_presentation.v1",
    "report-convert-presentation-input",
    "deck_aggregate",
    ["presentation_conversion_check"],
    ["report_to_presentation_partial"],
    { expected_latency_ms_p50: 700, expected_latency_ms_p95: 3400, peak_memory_mb: 512, scale_profile: "cpu_intensive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.convert_report_to_dashboard",
    "reports.convert_report_to_dashboard.v1",
    "report-convert-dashboard-input",
    "dashboard",
    ["dashboard_conversion_check"],
    ["report_to_dashboard_partial"],
    { expected_latency_ms_p50: 680, expected_latency_ms_p95: 3200, peak_memory_mb: 512, scale_profile: "cpu_intensive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  reportTool(
    "registry.reports.publish_degraded_report_output",
    "reports.publish_degraded_report_output.v1",
    "report-degraded-publish-input",
    "output_publication",
    ["degraded_publish_check"],
    ["degraded_report_publish_partial"],
    { expected_latency_ms_p50: 280, expected_latency_ms_p95: 1200, peak_memory_mb: 160, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/output-publication", "@rasid/evidence"]
  )
];

const transcriptionTool = (
  toolId: string,
  actionId: string,
  inputSchemaId: string,
  outputSchemaId: string,
  verificationHooks: string[],
  degradeReasonCodes: string[],
  performanceProfile: {
    expected_latency_ms_p50: number;
    expected_latency_ms_p95: number;
    peak_memory_mb: number;
    scale_profile: string;
  },
  runtimeDependencies: string[]
) =>
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: toolId,
    owner_capability: TRANSCRIPTION_CAPABILITY_ID,
    version: "1.0.0",
    input_contract: transcriptionSchemaRef(inputSchemaId),
    output_contract: transcriptionSchemaRef(outputSchemaId),
    runtime_dependencies: runtimeDependencies,
    performance_profile: performanceProfile,
    verification_hooks: verificationHooks,
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: actionId,
      degrade_reason_codes: degradeReasonCodes
    },
    registration_status: "active"
  });

export const TranscriptionToolRegistry = [
  transcriptionTool(
    "registry.transcription.ingest_and_extract",
    "transcription.ingest_and_extract.v1",
    "transcription_job_request",
    "unified_content_bundle",
    ["ingest_integrity_check", "transcript_generation_check", "ocr_extraction_check"],
    ["transcription_ingest_partial"],
    { expected_latency_ms_p50: 1400, expected_latency_ms_p95: 12000, peak_memory_mb: 1024, scale_profile: "batch_safe" },
    ["@rasid/transcription-extraction-engine", "@rasid/evidence"]
  ),
  transcriptionTool(
    "registry.transcription.compare",
    "transcription.compare.v1",
    "transcription-compare-input",
    "transcription_compare_result",
    ["compare_diff_check"],
    ["transcription_compare_partial"],
    { expected_latency_ms_p50: 280, expected_latency_ms_p95: 1800, peak_memory_mb: 256, scale_profile: "interactive" },
    ["@rasid/transcription-extraction-engine"]
  ),
  transcriptionTool(
    "registry.transcription.answer_question",
    "transcription.answer_question.v1",
    "transcription-question-request",
    "transcription_question_answer",
    ["question_grounding_check", "citation_integrity_check"],
    ["transcription_question_partial"],
    { expected_latency_ms_p50: 220, expected_latency_ms_p95: 1400, peak_memory_mb: 192, scale_profile: "interactive" },
    ["@rasid/transcription-extraction-engine"]
  )
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

const localizationAction = (
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
    capability: LOCALIZATION_CAPABILITY_ID,
    input_schema: localizationSchemaRef(inputSchemaId),
    output_schema: localizationSchemaRef(outputSchemaId),
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
    degrade_policy_ref: localizationDegradePolicyRef
  });

const localizationTool = (
  toolId: string,
  fallbackActionRef: string,
  inputSchemaId: string,
  outputSchemaId: string,
  verificationHooks: string[],
  degradeReasonCodes: string[],
  performanceProfile: {
    expected_latency_ms_p50: number;
    expected_latency_ms_p95: number;
    peak_memory_mb: number;
    scale_profile: string;
  }
) =>
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: toolId,
    owner_capability: LOCALIZATION_CAPABILITY_ID,
    version: "1.0.0",
    input_contract: localizationSchemaRef(inputSchemaId),
    output_contract: localizationSchemaRef(outputSchemaId),
    runtime_dependencies: ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence", "@rasid/audit-lineage"],
    performance_profile: performanceProfile,
    verification_hooks: verificationHooks,
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: fallbackActionRef,
      degrade_reason_codes: degradeReasonCodes
    },
    registration_status: "active"
  });

export const LocalizationActionRegistry = [
  localizationAction(
    "arabic_localization_lct.detect_source_language.v1",
    "Detect Source Language",
    "localization_request",
    "localization_request",
    {
      required_permissions: ["artifact:read"],
      preview_support: false,
      mutability: "mutating",
      idempotency: "idempotent",
      approval_policy: "never",
      side_effects: ["localization_request_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "source_language_detection_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.resolve_terminology_profile.v1",
    "Resolve Terminology Profile",
    "localization_request",
    "terminology_profile",
    {
      required_permissions: ["artifact:read", "library:read"],
      preview_support: false,
      mutability: "read_only",
      idempotency: "idempotent",
      approval_policy: "never",
      side_effects: ["audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "terminology_profile_resolution_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.build_localization_plan.v1",
    "Build Localization Plan",
    "localization_request",
    "localization_request",
    {
      required_permissions: ["artifact:read", "template:read"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["localization_request_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "localization_plan_integrity_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.transform_language.v1",
    "Transform Language",
    "localization_request",
    "localized_output_metadata",
    {
      required_permissions: ["artifact:read", "artifact:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_update", "canonical_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "language_transformation_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.transform_rtl_ltr_layout.v1",
    "Transform RTL LTR Layout",
    "direction_transformation_plan",
    "localized_output_metadata",
    {
      required_permissions: ["artifact:read", "artifact:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_update", "canonical_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "direction_layout_transformation_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.refine_typography.v1",
    "Refine Typography",
    "typography_refinement_plan",
    "localized_output_metadata",
    {
      required_permissions: ["artifact:read", "artifact:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "typography_refinement_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.apply_cultural_formatting.v1",
    "Apply Cultural Formatting",
    "cultural_formatting_plan",
    "localized_output_metadata",
    {
      required_permissions: ["artifact:read", "artifact:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "conditional",
      side_effects: ["artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "cultural_formatting_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.run_localization_quality_gates.v1",
    "Run Localization Quality Gates",
    "localized_output_metadata",
    "localization_quality_result",
    {
      required_permissions: ["artifact:read", "evidence:write"],
      preview_support: false,
      mutability: "mutating",
      idempotency: "idempotent",
      approval_policy: "never",
      side_effects: ["evidence_write", "audit_write", "lineage_write"],
      evidence_requirements: [
        ...sharedLocalizationEvidenceRequirements,
        "language_quality_check",
        "layout_quality_check",
        "editability_quality_check",
        "cultural_quality_check"
      ]
    }
  ),
  localizationAction(
    "arabic_localization_lct.publish_localized_output.v1",
    "Publish Localized Output",
    "localized_output_metadata",
    "localized_output_metadata",
    {
      required_permissions: ["artifact:write", "publication:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "always",
      side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "localized_publish_check"]
    }
  ),
  localizationAction(
    "arabic_localization_lct.publish_degraded_localized_output.v1",
    "Publish Degraded Localized Output",
    "localization_degrade_reason",
    "localized_output_metadata",
    {
      required_permissions: ["artifact:write", "publication:write"],
      preview_support: true,
      mutability: "mutating",
      idempotency: "conditionally_idempotent",
      approval_policy: "always",
      side_effects: ["publication_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
      evidence_requirements: [...sharedLocalizationEvidenceRequirements, "degraded_localized_publish_check"],
      easy: false,
      advanced: true
    }
  )
];

export const LocalizationToolRegistry = [
  localizationTool(
    "registry.localization.detect_source_language",
    "arabic_localization_lct.detect_source_language.v1",
    "localization_request",
    "localization_request",
    ["source_language_detection_check"],
    ["source_language_ambiguous"],
    { expected_latency_ms_p50: 120, expected_latency_ms_p95: 700, peak_memory_mb: 128, scale_profile: "batch_safe" }
  ),
  localizationTool(
    "registry.localization.resolve_terminology_profile",
    "arabic_localization_lct.resolve_terminology_profile.v1",
    "localization_request",
    "terminology_profile",
    ["terminology_profile_resolution_check"],
    ["terminology_profile_not_found"],
    { expected_latency_ms_p50: 140, expected_latency_ms_p95: 850, peak_memory_mb: 128, scale_profile: "interactive" }
  ),
  localizationTool(
    "registry.localization.build_localization_plan",
    "arabic_localization_lct.build_localization_plan.v1",
    "localization_request",
    "localization_request",
    ["localization_plan_integrity_check"],
    ["localization_plan_partial"],
    { expected_latency_ms_p50: 240, expected_latency_ms_p95: 1200, peak_memory_mb: 192, scale_profile: "interactive" }
  ),
  localizationTool(
    "registry.localization.transform_language",
    "arabic_localization_lct.transform_language.v1",
    "localization_request",
    "localized_output_metadata",
    ["language_transformation_check"],
    ["language_transform_partial"],
    { expected_latency_ms_p50: 600, expected_latency_ms_p95: 2600, peak_memory_mb: 512, scale_profile: "cpu_intensive" }
  ),
  localizationTool(
    "registry.localization.transform_rtl_ltr_layout",
    "arabic_localization_lct.transform_rtl_ltr_layout.v1",
    "direction_transformation_plan",
    "localized_output_metadata",
    ["direction_layout_transformation_check"],
    ["layout_transform_partial"],
    { expected_latency_ms_p50: 500, expected_latency_ms_p95: 2200, peak_memory_mb: 384, scale_profile: "interactive" }
  ),
  localizationTool(
    "registry.localization.refine_typography",
    "arabic_localization_lct.refine_typography.v1",
    "typography_refinement_plan",
    "localized_output_metadata",
    ["typography_refinement_check"],
    ["typography_refinement_partial"],
    { expected_latency_ms_p50: 450, expected_latency_ms_p95: 1900, peak_memory_mb: 320, scale_profile: "interactive" }
  ),
  localizationTool(
    "registry.localization.apply_cultural_formatting",
    "arabic_localization_lct.apply_cultural_formatting.v1",
    "cultural_formatting_plan",
    "localized_output_metadata",
    ["cultural_formatting_check"],
    ["cultural_formatting_partial"],
    { expected_latency_ms_p50: 280, expected_latency_ms_p95: 1400, peak_memory_mb: 192, scale_profile: "interactive" }
  ),
  localizationTool(
    "registry.localization.run_localization_quality_gates",
    "arabic_localization_lct.run_localization_quality_gates.v1",
    "localized_output_metadata",
    "localization_quality_result",
    ["language_quality_check", "layout_quality_check", "editability_quality_check", "cultural_quality_check"],
    ["quality_gates_degraded"],
    { expected_latency_ms_p50: 320, expected_latency_ms_p95: 1600, peak_memory_mb: 256, scale_profile: "batch_safe" }
  ),
  localizationTool(
    "registry.localization.publish_localized_output",
    "arabic_localization_lct.publish_localized_output.v1",
    "localized_output_metadata",
    "localized_output_metadata",
    ["localized_publish_check"],
    ["localized_publish_partial"],
    { expected_latency_ms_p50: 220, expected_latency_ms_p95: 1000, peak_memory_mb: 160, scale_profile: "batch_safe" }
  ),
  localizationTool(
    "registry.localization.publish_degraded_localized_output",
    "arabic_localization_lct.publish_degraded_localized_output.v1",
    "localization_degrade_reason",
    "localized_output_metadata",
    ["degraded_localized_publish_check"],
    ["degraded_localized_publish_partial"],
    { expected_latency_ms_p50: 220, expected_latency_ms_p95: 1000, peak_memory_mb: 160, scale_profile: "batch_safe" }
  )
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

const presentationTool = (
  toolId: string,
  actionId: string,
  inputSchemaId: string,
  outputSchemaId: string,
  verificationHooks: string[],
  degradeReasonCodes: string[],
  performanceProfile: {
    expected_latency_ms_p50: number;
    expected_latency_ms_p95: number;
    peak_memory_mb: number;
    scale_profile: string;
  },
  runtimeDependencies: string[]
) =>
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: toolId,
    owner_capability: "presentations",
    version: "1.0.0",
    input_contract: presentationSchemaRef(inputSchemaId),
    output_contract: presentationSchemaRef(outputSchemaId),
    runtime_dependencies: runtimeDependencies,
    performance_profile: performanceProfile,
    verification_hooks: verificationHooks,
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: actionId,
      degrade_reason_codes: degradeReasonCodes
    },
    registration_status: "active"
  });

export const PresentationToolRegistry = [
  presentationTool(
    "registry.presentations.build_intent_manifest",
    "presentations.build_intent_manifest.v1",
    "presentation-intent-build-input",
    "presentation_intent_manifest",
    ["intent_manifest_integrity_check"],
    ["presentation_intent_partial"],
    { expected_latency_ms_p50: 260, expected_latency_ms_p95: 1200, peak_memory_mb: 192, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.build_deck_outline",
    "presentations.build_deck_outline.v1",
    "presentation_intent_manifest",
    "deck_outline",
    ["outline_structure_check"],
    ["presentation_outline_partial"],
    { expected_latency_ms_p50: 320, expected_latency_ms_p95: 1500, peak_memory_mb: 256, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.build_storyboard",
    "presentations.build_storyboard.v1",
    "deck_outline",
    "storyboard_slide_plan",
    ["storyboard_layout_check"],
    ["presentation_storyboard_partial"],
    { expected_latency_ms_p50: 420, expected_latency_ms_p95: 2200, peak_memory_mb: 320, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.generate_deck",
    "presentations.generate_deck.v1",
    "storyboard_slide_plan",
    "deck_aggregate",
    ["deck_generation_check"],
    ["presentation_generate_partial"],
    { expected_latency_ms_p50: 850, expected_latency_ms_p95: 4200, peak_memory_mb: 640, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.regenerate_slide",
    "presentations.regenerate_slide.v1",
    "presentation-slide-regeneration-input",
    "storyboard_slide_plan",
    ["slide_regeneration_check"],
    ["presentation_regenerate_partial"],
    { expected_latency_ms_p50: 650, expected_latency_ms_p95: 3200, peak_memory_mb: 512, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.bind_deck_to_data",
    "presentations.bind_deck_to_data.v1",
    "presentation-binding-set-input",
    "presentation_binding_set",
    ["binding_integrity_check"],
    ["presentation_binding_partial"],
    { expected_latency_ms_p50: 440, expected_latency_ms_p95: 2100, peak_memory_mb: 320, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.apply_template_lock",
    "presentations.apply_template_lock.v1",
    "template-lock-state-input",
    "template_lock_state",
    ["template_lock_check"],
    ["presentation_template_lock_partial"],
    { expected_latency_ms_p50: 300, expected_latency_ms_p95: 1400, peak_memory_mb: 256, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.render_preview",
    "presentations.render_preview.v1",
    "presentation-render-preview-input",
    "presentation_output_metadata",
    ["preview_render_check"],
    ["presentation_preview_partial"],
    { expected_latency_ms_p50: 550, expected_latency_ms_p95: 2600, peak_memory_mb: 384, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.export_pptx",
    "presentations.export_pptx.v1",
    "presentation-export-input",
    "export_validation_result",
    ["pptx_editability_check"],
    ["presentation_export_pptx_partial"],
    { expected_latency_ms_p50: 900, expected_latency_ms_p95: 4600, peak_memory_mb: 768, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.export_pdf",
    "presentations.export_pdf.v1",
    "presentation-export-input",
    "export_validation_result",
    ["pdf_render_check"],
    ["presentation_export_pdf_partial"],
    { expected_latency_ms_p50: 780, expected_latency_ms_p95: 3900, peak_memory_mb: 640, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.export_html",
    "presentations.export_html.v1",
    "presentation-export-input",
    "export_validation_result",
    ["html_render_check"],
    ["presentation_export_html_partial"],
    { expected_latency_ms_p50: 620, expected_latency_ms_p95: 2800, peak_memory_mb: 384, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.run_render_parity_validation",
    "presentations.run_render_parity_validation.v1",
    "render-parity-validation-input",
    "render_parity_validation",
    ["render_parity_check"],
    ["presentation_parity_partial"],
    { expected_latency_ms_p50: 950, expected_latency_ms_p95: 5200, peak_memory_mb: 768, scale_profile: "batch_safe" },
    ["@rasid/runtime", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.publish_presentation_artifact",
    "presentations.publish_presentation_artifact.v1",
    "presentation-publish-input",
    "presentation_output_metadata",
    ["publication_ready_check"],
    ["presentation_publish_partial"],
    { expected_latency_ms_p50: 520, expected_latency_ms_p95: 2400, peak_memory_mb: 320, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  ),
  presentationTool(
    "registry.presentations.publish_degraded_presentation_artifact",
    "presentations.publish_degraded_presentation_artifact.v1",
    "presentation-degraded-publish-input",
    "presentation_output_metadata",
    ["degraded_publish_check"],
    ["presentation_publish_degraded_partial"],
    { expected_latency_ms_p50: 520, expected_latency_ms_p95: 2400, peak_memory_mb: 320, scale_profile: "interactive" },
    ["@rasid/runtime", "@rasid/artifacts", "@rasid/evidence"]
  )
];

const aiAction = (
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
  }
) =>
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: actionId,
    action_name: actionName,
    capability: AI_CAPABILITY_ID,
    input_schema: aiSchemaRef(inputSchemaId),
    output_schema: aiSchemaRef(outputSchemaId),
    required_permissions: options.required_permissions,
    mode_support: { easy: true, advanced: true },
    approval_policy: options.approval_policy,
    preview_support: options.preview_support,
    mutability: options.mutability,
    idempotency: options.idempotency,
    side_effects: options.side_effects,
    evidence_requirements: options.evidence_requirements,
    degrade_policy_ref: "rasid.shared.degrade@1.0.0"
  });

const aiTool = (
  toolId: string,
  actionId: string,
  inputSchemaId: string,
  outputSchemaId: string,
  verificationHooks: string[],
  degradeReasonCodes: string[],
  scaleProfile: string
) =>
  ToolRegistrationSchema.parse({
    contract: contractEnvelope("tool_registry"),
    tool_id: toolId,
    owner_capability: AI_CAPABILITY_ID,
    version: "1.0.0",
    input_contract: aiSchemaRef(inputSchemaId),
    output_contract: aiSchemaRef(outputSchemaId),
    runtime_dependencies: ["session_context", "registry", "audit", "lineage", "evidence"],
    performance_profile: {
      expected_latency_ms_p50: 180,
      expected_latency_ms_p95: 2200,
      peak_memory_mb: 256,
      scale_profile: scaleProfile
    },
    verification_hooks: verificationHooks,
    safe_failure_behavior: {
      retryable: true,
      fallback_action_ref: actionId,
      degrade_reason_codes: degradeReasonCodes
    },
    registration_status: "active"
  });

export const IntelligentOperatorActionRegistry = [
  aiAction("intelligent_operator.resolve_context.v1", "Resolve AI Page Context", "ai_page_context", "ai_page_context", {
    required_permissions: ["artifact:read", "audit:write"],
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["context_resolution_check", "permission_scope_check", "governance_scope_check"]
  }),
  aiAction("intelligent_operator.route_request.v1", "Route AI Request", "ai_execution_request", "ai_execution_plan", {
    required_permissions: ["artifact:read", "audit:write"],
    preview_support: false,
    mutability: "read_only",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["agent_router_check", "capability_selection_check", "tool_selection_check"]
  }),
  aiAction("intelligent_operator.build_execution_plan.v1", "Build AI Execution Plan", "ai_execution_request", "ai_execution_plan", {
    required_permissions: ["artifact:read", "audit:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["phase_plan_check", "approval_boundary_check", "context_retention_check"]
  }),
  aiAction("intelligent_operator.generate_assistive_output.v1", "Generate Assistive Output", "ai_execution_plan", "ai_execution_summary", {
    required_permissions: ["artifact:read", "artifact:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["assistive_output_check", "summary_emission_check", "evidence_link_check"]
  }),
  aiAction("intelligent_operator.execute_approved_plan.v1", "Execute Approved AI Plan", "ai_execution_plan", "ai_execution_summary", {
    required_permissions: ["artifact:write", "publication:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "always",
    side_effects: ["artifact_create", "artifact_update", "audit_write", "lineage_write", "evidence_write"],
    evidence_requirements: ["approved_apply_check", "no_auto_apply_check", "cross_engine_execution_check"]
  }),
  aiAction("intelligent_operator.summarize_execution.v1", "Summarize AI Execution", "ai_execution_summary", "ai_execution_summary", {
    required_permissions: ["artifact:read", "audit:write"],
    preview_support: true,
    mutability: "read_only",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["audit_write", "evidence_write"],
    evidence_requirements: ["summary_emission_check", "audit_link_check", "lineage_link_check"]
  })
];

export const IntelligentOperatorToolRegistry = [
  aiTool(
    "registry.ai.resolve_context",
    "intelligent_operator.resolve_context.v1",
    "ai_page_context",
    "ai_page_context",
    ["context_resolution_check", "permission_scope_check"],
    ["context_resolution_partial"],
    "interactive"
  ),
  aiTool(
    "registry.ai.route_request",
    "intelligent_operator.route_request.v1",
    "ai_execution_request",
    "ai_execution_plan",
    ["agent_router_check", "capability_selection_check", "tool_selection_check"],
    ["routing_partial"],
    "interactive"
  ),
  aiTool(
    "registry.ai.build_plan",
    "intelligent_operator.build_execution_plan.v1",
    "ai_execution_request",
    "ai_execution_plan",
    ["phase_plan_check", "approval_boundary_check"],
    ["plan_partial"],
    "interactive"
  ),
  aiTool(
    "registry.ai.generate_output",
    "intelligent_operator.generate_assistive_output.v1",
    "ai_execution_plan",
    "ai_execution_summary",
    ["assistive_output_check", "summary_emission_check"],
    ["assistive_output_partial"],
    "interactive"
  ),
  aiTool(
    "registry.ai.execute_approved_plan",
    "intelligent_operator.execute_approved_plan.v1",
    "ai_execution_plan",
    "ai_execution_summary",
    ["approved_apply_check", "cross_engine_execution_check"],
    ["approved_apply_partial"],
    "interactive"
  )
];

const governanceAction = (
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
  }
) =>
  ActionDefinitionSchema.parse({
    contract: contractEnvelope("action"),
    action_id: actionId,
    action_name: actionName,
    capability: GOVERNANCE_CAPABILITY_ID,
    input_schema: governanceSchemaRef(inputSchemaId),
    output_schema: governanceSchemaRef(outputSchemaId),
    required_permissions: options.required_permissions,
    mode_support: { easy: true, advanced: true },
    approval_policy: options.approval_policy,
    preview_support: options.preview_support,
    mutability: options.mutability,
    idempotency: options.idempotency,
    side_effects: options.side_effects,
    evidence_requirements: options.evidence_requirements,
    degrade_policy_ref: "rasid.shared.governance.policy.default@1.0.0"
  });

export const GovernanceActionRegistry = [
  governanceAction("governance.roles.upsert.v1", "Upsert Role Definition", "governance-role-definition", "governance-role-definition", {
    required_permissions: ["governance:manage", "permission:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["role_write", "audit_write", "policy_decision_write"],
    evidence_requirements: ["role_scope_check", "permission_group_check"]
  }),
  governanceAction("governance.policies.upsert.v1", "Upsert Policy Rule", "governance-policy-rule", "governance-policy-rule", {
    required_permissions: ["governance:manage", "policy:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["policy_write", "audit_write", "policy_decision_write"],
    evidence_requirements: ["policy_scope_check", "abac_rule_validation"]
  }),
  governanceAction("governance.approvals.review.v1", "Review Approval Boundary", "governance-approval-record", "governance-approval-record", {
    required_permissions: ["approval:review"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["approval_review", "audit_write"],
    evidence_requirements: ["approval_boundary_check", "review_actor_check"]
  }),
  governanceAction("governance.approvals.decide.v1", "Approve Or Reject Boundary", "governance-approval-record", "governance-approval-record", {
    required_permissions: ["approval:approve"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "always",
    side_effects: ["approval_state_change", "audit_write"],
    evidence_requirements: ["approval_boundary_check", "approval_actor_check"]
  }),
  governanceAction("governance.kpi.upsert.v1", "Upsert KPI Definition", "governance-kpi-definition", "governance-kpi-definition", {
    required_permissions: ["kpi:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["kpi_write", "version_write", "audit_write", "lineage_write"],
    evidence_requirements: ["semantic_layer_check", "kpi_impact_preview_check"]
  }),
  governanceAction("governance.library.upsert.v1", "Upsert Library Governance Record", "governance-library-record", "governance-library-record", {
    required_permissions: ["library:write", "template:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["library_write", "version_write", "audit_write"],
    evidence_requirements: ["library_dependency_check", "downstream_breakage_check"]
  }),
  governanceAction("governance.diff.generate.v1", "Generate Governance Diff", "governance-diff-artifact", "governance-diff-artifact", {
    required_permissions: ["artifact:write", "audit:read"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "idempotent",
    approval_policy: "never",
    side_effects: ["diff_artifact_create", "audit_write"],
    evidence_requirements: ["diff_integrity_check"]
  }),
  governanceAction("governance.data.register.v1", "Register Dataset", "governance-execution-envelope", "governance-execution-envelope", {
    required_permissions: ["dataset:write", "artifact:write"],
    preview_support: false,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "never",
    side_effects: ["dataset_create", "audit_write", "lineage_write"],
    evidence_requirements: ["dataset_registration_check"]
  }),
  governanceAction("governance.publication.schedule.v1", "Schedule Publication", "governance-execution-envelope", "governance-execution-envelope", {
    required_permissions: ["publication:schedule", "schedule:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["schedule_create", "audit_write", "lineage_write"],
    evidence_requirements: ["schedule_policy_check", "approval_boundary_check"]
  }),
  governanceAction("governance.publication.share.v1", "Share Publication", "governance-execution-envelope", "governance-execution-envelope", {
    required_permissions: ["publication:share"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["share_create", "audit_write", "lineage_write"],
    evidence_requirements: ["share_policy_check", "approval_boundary_check", "tenant_isolation_check"]
  }),
  governanceAction("governance.ai.execute.v1", "Execute AI Action", "governance-execution-envelope", "governance-execution-envelope", {
    required_permissions: ["ai:execute"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["ai_job_create", "audit_write", "lineage_write", "approval_boundary"],
    evidence_requirements: ["ai_execution_trace_check", "approval_boundary_check"]
  }),
  governanceAction("governance.strict.execute.v1", "Execute Strict Replication Action", "governance-execution-envelope", "governance-execution-envelope", {
    required_permissions: ["strict:execute"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["strict_job_create", "audit_write", "lineage_write"],
    evidence_requirements: ["strict_execution_trace_check", "pressure_policy_check"]
  }),
  governanceAction("governance.external.consume.v1", "Consume External Engine Output", "governance-execution-envelope", "governance-execution-envelope", {
    required_permissions: ["artifact:write", "library:write"],
    preview_support: true,
    mutability: "mutating",
    idempotency: "conditionally_idempotent",
    approval_policy: "conditional",
    side_effects: ["artifact_create", "audit_write", "lineage_write", "version_write"],
    evidence_requirements: ["external_consumption_check", "tenant_isolation_check"]
  })
];

export const GovernanceToolRegistry = [] as const;

export const ActionRegistry = [
  ...CanvasActionRegistry,
  ...GovernanceActionRegistry,
  ...IntelligentOperatorActionRegistry,
  ...ExcelDataActionRegistry,
  ...ExcelActionRegistry,
  ...LocalizationActionRegistry,
  ...ReportActionRegistry,
  ...TranscriptionActionRegistry,
  ...PresentationActionRegistry,
  ...StrictActionRegistry
];
export const ToolRegistry = [
  ...CanvasToolRegistry,
  ...GovernanceToolRegistry,
  ...IntelligentOperatorToolRegistry,
  ...ExcelToolRegistry,
  ...LocalizationToolRegistry,
  ...ReportToolRegistry,
  ...TranscriptionToolRegistry,
  ...PresentationToolRegistry,
  ...StrictToolRegistry
];

export const listActionsForCapability = (capabilityId: string) =>
  ActionRegistry.filter((action) => action.capability === capabilityId);

export const listToolsForCapability = (capabilityId: string) =>
  ToolRegistry.filter((tool) => tool.owner_capability === capabilityId);
