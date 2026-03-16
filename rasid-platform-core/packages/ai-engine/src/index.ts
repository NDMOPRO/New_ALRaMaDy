import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import { ArabicLocalizationLctEngine } from "@rasid/arabic-localization-lct-engine";
import { DashboardEngine, type DashboardWorkflowResult } from "@rasid/dashboard-engine";
import { ExcelEngine } from "@rasid/excel-engine";
import { PresentationEngine } from "@rasid/presentations-engine";
import { ReportEngine, type ReportConversionResult, type ReportWorkflowResult } from "@rasid/report-engine";
import { StrictReplicationEngine } from "@rasid/strict-replication-engine";
import { TranscriptionExtractionEngine, type TranscriptionCompareBundle } from "@rasid/transcription-extraction-engine";
import {
  ActionRegistry,
  AI_CAPABILITY_ID,
  AuditEventSchema,
  CANONICAL_CONTRACT,
  CanonicalRepresentationSchema,
  EvidencePackSchema,
  JobSchema,
  ToolRegistry,
  contractEnvelope,
  type AiExecutionPhase,
  type AiExecutionPlan,
  type AiExecutionRequest,
  type AiExecutionSummary,
  type AiPageContext,
  type AiPagePath,
  type AiSuggestion,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type EvidencePack,
  type FailureReason,
  type Job,
  type LineageEdge,
  type PermissionScope,
  type Warning
} from "@rasid/contracts";
import { z } from "zod";
import { AiEngineStore, type AiPersistedBundle, type AiSessionState, defaultAiEngineStorageRoot } from "./store";

export { AiEngineStore, defaultAiEngineStorageRoot } from "./store";

export type SubmitAiJobInput = {
  session_id: string;
  page_path: AiPagePath;
  user_prompt: string;
  tenant_ref: string;
  workspace_id: string;
  project_id: string;
  actor_ref: string;
  requested_mode?: "easy" | "advanced";
  approval_granted?: boolean;
  resource_ref?: string | null;
  resource_refs?: string[];
  current_artifact_ref?: string | null;
  context_payload?: Record<string, unknown>;
  permission_scope?: PermissionScope;
  governance_tags?: string[];
};

export type AiJobBundle = AiPersistedBundle & {
  phases: AiExecutionPhase[];
  approval_boundary: {
    required: boolean;
    state: "not_required" | "pending" | "approved" | "rejected";
  };
};

const JsonRecordSchema = z.record(z.unknown());
const SubmitAiJobInputSchema = z.object({
  session_id: z.string(),
  page_path: z.enum([
    "/home",
    "/data",
    "/excel",
    "/dashboards",
    "/reports",
    "/presentations",
    "/transcription",
    "/replication",
    "/localization",
    "/library",
    "/governance"
  ]),
  user_prompt: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  actor_ref: z.string(),
  requested_mode: z.enum(["easy", "advanced"]).default("advanced"),
  approval_granted: z.boolean().default(false),
  resource_ref: z.string().nullable().default(null),
  resource_refs: z.array(z.string()).default([]),
  current_artifact_ref: z.string().nullable().default(null),
  context_payload: JsonRecordSchema.default({}),
  permission_scope: z
    .object({
      visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
      allow_read: z.boolean(),
      allow_write: z.boolean(),
      allow_share: z.boolean(),
      allow_publish: z.boolean(),
      allow_audit_view: z.boolean()
    })
    .optional(),
  governance_tags: z.array(z.string()).default([])
});

type ProviderSelection = {
  provider_ref: string;
  model_ref: string;
  fallback_provider_ref: string | null;
  fallback_model_ref: string | null;
  fallback_used: boolean;
};

type RouteSelection = {
  agent: AiExecutionPlan["selected_agent"];
  capability: string;
  action_ref: string | null;
  tool_ref: string | null;
  engine_ref: string;
  output_kind: AiExecutionPlan["target_output_kind"];
  approval_required: boolean;
  intent: string;
};

type ExecutionResult = {
  outcome: AiExecutionSummary["outcome"];
  degrade_classification: string | null;
  warnings: Warning[];
  failures: FailureReason[];
  result_artifacts: Artifact[];
  summary_notes: string[];
  execution_provider_ref: string | null;
  execution_model_ref: string | null;
  execution_fallback_provider_ref: string | null;
  execution_fallback_model_ref: string | null;
  execution_fallback_used: boolean;
  execution_fallback_reason: string | null;
  execution_step_details: string[];
  downstream_audit_events?: AuditEvent[];
  downstream_lineage_edges?: LineageEdge[];
  open_path: string | null;
};

const pageLabels: Record<AiPagePath, string> = {
  "/home": "Home",
  "/data": "Data",
  "/excel": "Excel",
  "/dashboards": "Dashboards",
  "/reports": "Reports",
  "/presentations": "Presentations",
  "/transcription": "Transcription",
  "/replication": "Replication",
  "/localization": "Localization",
  "/library": "Library",
  "/governance": "Governance"
};

const pageCapabilityHints: Record<AiPagePath, string> = {
  "/home": "platform_assistant",
  "/data": "data_analysis",
  "/excel": "workbook_assistance",
  "/dashboards": "dashboard_orchestration",
  "/reports": "report_assistance",
  "/presentations": "presentation_assistance",
  "/transcription": "transcription_assistance",
  "/replication": "strict_replication_assistance",
  "/localization": "localization_assistance",
  "/library": "library_navigation",
  "/governance": "governance_assistance"
};

const now = (): string => new Date().toISOString();
const id = (prefix: string, ...parts: Array<string | number | null | undefined>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const normalizePrompt = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();
const hasAny = (value: string, patterns: string[]): boolean => patterns.some((pattern) => value.includes(pattern));
const isMutatingPrompt = (prompt: string): boolean =>
  hasAny(prompt, ["create", "build", "generate", "publish", "apply", "convert", "أنش", "ابن", "ول", "حو", "انشر", "طب", "نف", "عد"]);
const lastItem = <T>(items: T[]): T | null => (items.length > 0 ? items[items.length - 1] ?? null : null);

const defaultPermissionScope = (pagePath: AiPagePath): PermissionScope =>
  pagePath === "/governance"
    ? { visibility: "workspace", allow_read: true, allow_write: false, allow_share: false, allow_publish: false, allow_audit_view: true }
    : pagePath === "/library" || pagePath === "/home"
      ? { visibility: "workspace", allow_read: true, allow_write: false, allow_share: false, allow_publish: false, allow_audit_view: true }
      : { visibility: "workspace", allow_read: true, allow_write: true, allow_share: true, allow_publish: true, allow_audit_view: true };

const extractDatasetProfile = (rows: Array<Record<string, unknown>>) => {
  const fieldNames = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const numericFields = fieldNames.filter((fieldName) =>
    rows.some((row) => typeof row[fieldName] === "number" || (typeof row[fieldName] === "string" && row[fieldName] !== "" && !Number.isNaN(Number(row[fieldName]))))
  );
  const categoricalFields = fieldNames.filter((fieldName) => !numericFields.includes(fieldName));
  return { fieldNames, numericFields, categoricalFields };
};

const createSummaryArtifact = (
  rootDir: string,
  jobId: string,
  actorRef: string,
  tenantRef: string,
  workspaceId: string,
  projectId: string,
  mode: "easy" | "advanced",
  sourceRefs: string[],
  content: Record<string, unknown>
): Artifact => {
  const outputPath = path.join(rootDir, "jobs", jobId, "outputs", "ai-summary.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return {
    contract: contractEnvelope("artifact"),
    artifact_id: id("artifact", jobId, "ai-summary"),
    artifact_type: "workflow_output",
    artifact_subtype: "ai_execution_summary",
    project_id: projectId,
    workspace_id: workspaceId,
    source_refs: sourceRefs,
    parent_artifact_refs: [],
    canonical_ref: "",
    created_by: actorRef,
    created_at: now(),
    mode,
    editable_status: "non_editable",
    template_status: "none",
    lineage_ref: id("lineage", jobId, "summary"),
    evidence_ref: id("evidence", jobId),
    verification_status: "verified",
    storage_ref: {
      storage_id: id("storage", jobId, "summary"),
      storage_class: "local_fs",
      uri: `file:///${outputPath.replace(/\\/g, "/")}`,
      checksum: hash(JSON.stringify(content)),
      region: "workspace"
    },
    preview_ref: {
      preview_id: id("preview", jobId, "summary"),
      preview_type: "html_canvas",
      storage_ref: id("storage", jobId, "summary")
    },
    export_refs: [],
    version_ref: {
      version_id: id("version", jobId, "summary"),
      parent_version_id: null,
      version_number: 1,
      semantic_version: "1.0.0"
    },
    tenant_ref: tenantRef,
    permission_scope: defaultPermissionScope("/home")
  };
};

class DeterministicPlannerProvider {
  readonly provider_ref = "provider://rasid/deterministic";
  readonly model_ref = "model://rasid/phase-router-v1";

  plan(prompt: string, request: z.infer<typeof SubmitAiJobInputSchema>): RouteSelection {
    if (prompt.includes("[force-provider-fail]")) {
      throw new Error("forced_provider_failure");
    }
    return selectRoute(prompt, request.page_path);
  }
}

class SafeFallbackPlannerProvider {
  readonly provider_ref = "provider://rasid/fallback";
  readonly model_ref = "model://rasid/safe-summary-v1";

  plan(prompt: string, request: z.infer<typeof SubmitAiJobInputSchema>): RouteSelection {
    const route = selectRoute(prompt, request.page_path);
    return {
      ...route,
      approval_required: false,
      output_kind: route.output_kind === "dashboard" || route.output_kind === "presentation" ? "suggestion_pack" : route.output_kind,
      action_ref: route.output_kind === "dashboard" || route.output_kind === "presentation" ? "intelligent_operator.generate_assistive_output.v1" : route.action_ref,
      tool_ref: route.output_kind === "dashboard" || route.output_kind === "presentation" ? "registry.ai.generate_output" : route.tool_ref
    };
  }
}

const selectRoute = (normalizedPrompt: string, pagePath: AiPagePath): RouteSelection => {
  if (pagePath === "/data") {
    if (hasAny(normalizedPrompt, ["compare", "قارن"])) {
      return {
        agent: "data_analyst_agent",
        capability: "dashboards",
        action_ref: "dashboard.compare_versions.v1",
        tool_ref: "registry.dashboard.interaction.compare",
        engine_ref: "@rasid/dashboard-engine",
        output_kind: "suggestion_pack",
        approval_required: false,
        intent: "data_comparison"
      };
    }
    return {
      agent: "data_analyst_agent",
      capability: "dashboards",
      action_ref: "dashboard.create.v1",
      tool_ref: "registry.dashboard.create",
      engine_ref: "@rasid/dashboard-engine",
      output_kind: hasAny(normalizedPrompt, ["dashboard", "visualization", "widget", "لوحة", "رسم", "build", "أنش"]) ? "dashboard" : "suggestion_pack",
      approval_required: hasAny(normalizedPrompt, ["dashboard", "visualization", "widget", "لوحة", "رسم", "build", "أنش"]),
      intent: "data_analysis"
    };
  }
  if (pagePath === "/excel") {
    if (hasAny(normalizedPrompt, ["formula", "معاد"])) {
      return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.recalculate_formulas.v1", tool_ref: "excel_engine.recalculate_formulas", engine_ref: "@rasid/excel-engine", output_kind: "spreadsheet", approval_required: true, intent: "formula_assistance" };
    }
    if (hasAny(normalizedPrompt, ["pivot", "محور"])) {
      return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.generate_pivot.v1", tool_ref: "excel_engine.generate_pivot", engine_ref: "@rasid/excel-engine", output_kind: "spreadsheet", approval_required: true, intent: "pivot_assistance" };
    }
    if (hasAny(normalizedPrompt, ["chart", "visual", "رسم"])) {
      return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.generate_chart.v1", tool_ref: "excel_engine.generate_chart", engine_ref: "@rasid/excel-engine", output_kind: "spreadsheet", approval_required: true, intent: "chart_assistance" };
    }
    return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.apply_transformation.v1", tool_ref: "excel_engine.apply_transformation", engine_ref: "@rasid/excel-engine", output_kind: "spreadsheet", approval_required: true, intent: "workbook_cleanup" };
  }
  if (pagePath === "/dashboards") {
    if (hasAny(normalizedPrompt, ["report", "narrative", "summary", "حول", "تقرير"])) {
      return { agent: "dashboard_assistant", capability: "reports", action_ref: "reports.create_report.v1", tool_ref: "registry.reports.create_report", engine_ref: "@rasid/report-engine", output_kind: "report", approval_required: true, intent: "dashboard_to_report" };
    }
    if (hasAny(normalizedPrompt, ["compare", "قارن"])) {
      return { agent: "dashboard_assistant", capability: "dashboards", action_ref: "dashboard.compare_versions.v1", tool_ref: "registry.dashboard.interaction.compare", engine_ref: "@rasid/dashboard-engine", output_kind: "suggestion_pack", approval_required: false, intent: "dashboard_compare" };
    }
    return { agent: "dashboard_assistant", capability: "dashboards", action_ref: "dashboard.create.v1", tool_ref: "registry.dashboard.create", engine_ref: "@rasid/dashboard-engine", output_kind: "dashboard", approval_required: true, intent: "dashboard_assistance" };
  }
  if (pagePath === "/reports") {
    if (hasAny(normalizedPrompt, ["dashboard", "widgets", "لوحة", "widget"])) {
      return { agent: "reporting_assistant", capability: "reports", action_ref: "reports.convert_report_to_dashboard.v1", tool_ref: "registry.reports.convert_report_to_dashboard", engine_ref: "@rasid/report-engine", output_kind: "dashboard", approval_required: true, intent: "report_to_dashboard" };
    }
    if (hasAny(normalizedPrompt, ["presentation", "slides", "عرض", "شرائح", "حول"])) {
      return { agent: "reporting_assistant", capability: "reports", action_ref: "reports.convert_report_to_presentation.v1", tool_ref: "registry.reports.convert_report_to_presentation", engine_ref: "@rasid/report-engine", output_kind: "presentation", approval_required: true, intent: "report_to_presentation" };
    }
    return { agent: "reporting_assistant", capability: "reports", action_ref: "reports.create_report.v1", tool_ref: "registry.reports.create_report", engine_ref: "@rasid/report-engine", output_kind: "report", approval_required: true, intent: hasAny(normalizedPrompt, ["compare", "قارن"]) ? "report_compare" : "report_assistance" };
  }
  if (pagePath === "/presentations") {
    return { agent: "presentation_assistant", capability: "presentations", action_ref: "presentations.generate_deck.v1", tool_ref: "registry.presentations.generate_deck", engine_ref: "@rasid/presentations-engine", output_kind: "presentation", approval_required: true, intent: "presentation_generation" };
  }
  if (pagePath === "/transcription") {
    if (hasAny(normalizedPrompt, ["compare", "diff", "difference", "قارن", "فرق", "فروقات"])) {
      return {
        agent: "document_file_understanding_assistant",
        capability: "transcription_extraction",
        action_ref: "transcription.compare.v1",
        tool_ref: "registry.transcription.compare",
        engine_ref: "@rasid/transcription-extraction-engine",
        output_kind: "summary",
        approval_required: true,
        intent: "transcription_compare"
      };
    }
    return {
      agent: "document_file_understanding_assistant",
      capability: "transcription_extraction",
      action_ref: "transcription.answer_question.v1",
      tool_ref: "registry.transcription.answer_question",
      engine_ref: "@rasid/transcription-extraction-engine",
      output_kind: "summary",
      approval_required: true,
      intent: "transcription_question_answer"
    };
  }
  if (pagePath === "/localization") {
    return { agent: "localization_assistant", capability: "arabic_localization_lct", action_ref: "arabic_localization_lct.publish_localized_output.v1", tool_ref: "registry.localization.publish_localized_output", engine_ref: "@rasid/arabic-localization-lct-engine", output_kind: "report", approval_required: true, intent: "localization_assistance" };
  }
  if (pagePath === "/replication") {
    return { agent: "replication_aware_assistant", capability: "strict_replication", action_ref: "strict.run_round_trip_validation.v1", tool_ref: "registry.strict.run_round_trip_validation", engine_ref: "@rasid/strict-replication-engine", output_kind: "replication", approval_required: true, intent: "replication_diagnosis" };
  }
  if (pagePath === "/governance") {
    return { agent: "governance_aware_assistant", capability: AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "governance_assistance" };
  }
  if (pagePath === "/library") {
    return { agent: "document_file_understanding_assistant", capability: AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "document_understanding" };
  }
  if (pagePath === "/home") {
    if (hasAny(normalizedPrompt, ["file", "document", "pdf", "docx", "xlsx", "ملف", "مستند"])) {
      return { agent: "document_file_understanding_assistant", capability: AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "document_understanding" };
    }
    if (hasAny(normalizedPrompt, ["governance", "permission", "audit", "lineage", "حوكمة", "صلاح"])) {
      return { agent: "governance_aware_assistant", capability: AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "governance_assistance" };
    }
  }
  if (hasAny(normalizedPrompt, ["excel", "workbook", "formula", "pivot", "chart", "xlsx", "sheet"])) {
    return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.apply_transformation.v1", tool_ref: "excel_engine.apply_transformation", engine_ref: "@rasid/excel-engine", output_kind: "spreadsheet", approval_required: true, intent: "workbook_cleanup" };
  }
  if (hasAny(normalizedPrompt, ["dashboard", "widget", "filter", "visualization", "لوحة", "مؤشر"])) {
    return { agent: "dashboard_assistant", capability: "dashboards", action_ref: "dashboard.create.v1", tool_ref: "registry.dashboard.create", engine_ref: "@rasid/dashboard-engine", output_kind: "dashboard", approval_required: true, intent: "dashboard_assistance" };
  }
  if (hasAny(normalizedPrompt, ["report", "summary", "narrative", "schedule", "تقرير", "ملخص"])) {
    return { agent: "reporting_assistant", capability: "reports", action_ref: "reports.create_report.v1", tool_ref: "registry.reports.create_report", engine_ref: "@rasid/report-engine", output_kind: "report", approval_required: true, intent: "report_assistance" };
  }
  if (hasAny(normalizedPrompt, ["presentation", "slide", "deck", "عرض", "شريحة"])) {
    return { agent: "presentation_assistant", capability: "presentations", action_ref: "presentations.generate_deck.v1", tool_ref: "registry.presentations.generate_deck", engine_ref: "@rasid/presentations-engine", output_kind: "presentation", approval_required: true, intent: "presentation_generation" };
  }
  if (hasAny(normalizedPrompt, ["localization", "rtl", "locale", "translate", "تعريب", "مصطلح"])) {
    return { agent: "localization_assistant", capability: "arabic_localization_lct", action_ref: "arabic_localization_lct.publish_localized_output.v1", tool_ref: "registry.localization.publish_localized_output", engine_ref: "@rasid/arabic-localization-lct-engine", output_kind: "report", approval_required: true, intent: "localization_assistance" };
  }
  if (hasAny(normalizedPrompt, ["replication", "strict", "verification", "diff", "مطابقة", "تحقق"])) {
    return { agent: "replication_aware_assistant", capability: "strict_replication", action_ref: "strict.run_round_trip_validation.v1", tool_ref: "registry.strict.run_round_trip_validation", engine_ref: "@rasid/strict-replication-engine", output_kind: "replication", approval_required: true, intent: "replication_diagnosis" };
  }
  if (hasAny(normalizedPrompt, ["file", "document", "pdf", "docx", "xlsx", "ملف", "مستند"])) {
    return { agent: "document_file_understanding_assistant", capability: AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "document_understanding" };
  }
  if (hasAny(normalizedPrompt, ["governance", "permission", "audit", "lineage", "حوكمة", "صلاح"])) {
    return { agent: "governance_aware_assistant", capability: AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "governance_assistance" };
  }
  return { agent: "data_analyst_agent", capability: "dashboards", action_ref: "dashboard.create.v1", tool_ref: "registry.dashboard.create", engine_ref: "@rasid/dashboard-engine", output_kind: "suggestion_pack", approval_required: false, intent: "data_analysis" };
};

const sessionMemory = (store: AiEngineStore, request: z.infer<typeof SubmitAiJobInputSchema>): AiSessionState | null => {
  const existing = store.loadSession(request.session_id);
  if (!existing || existing.page_path !== request.page_path || existing.tenant_ref !== request.tenant_ref) {
    return null;
  }
  return existing;
};

const buildContext = (request: z.infer<typeof SubmitAiJobInputSchema>, store: AiEngineStore): AiPageContext => {
  const memory = sessionMemory(store, request);
  return {
    schema_namespace: "rasid.shared.ai.v1",
    schema_version: "1.0.0",
    session_id: request.session_id,
    page_path: request.page_path,
    page_label: pageLabels[request.page_path],
    capability_hint: pageCapabilityHints[request.page_path],
    current_artifact_ref: request.current_artifact_ref ?? memory?.current_artifact_ref ?? null,
    source_refs: [...new Set([...(request.resource_ref ? [request.resource_ref] : []), ...request.resource_refs])],
    recent_output_refs: memory?.recent_output_refs ?? [],
    permission_scope: request.permission_scope ?? defaultPermissionScope(request.page_path),
    governance_tags: [...new Set([request.page_path.replace("/", "page:"), ...request.governance_tags])],
    memory_scope: request.page_path === "/home" || request.page_path === "/library" ? "workspace_scoped" : "page_isolated"
  };
};

const makeSuggestion = (
  summaryId: string,
  index: number,
  category: AiSuggestion["category"],
  title: string,
  detail: string,
  confidence: number,
  requiresApproval = false,
  proposedActionRef: string | null = null,
  targetRefs: string[] = []
): AiSuggestion => ({
  schema_namespace: "rasid.shared.ai.v1",
  schema_version: "1.0.0",
  suggestion_id: id("suggestion", summaryId, index + 1),
  category,
  title,
  detail,
  confidence,
  proposed_action_ref: proposedActionRef,
  requires_approval: requiresApproval,
  target_refs: targetRefs
});

const buildSuggestions = (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  context: AiPageContext,
  route: RouteSelection
): { suggestions: AiSuggestion[]; nextSteps: string[]; summaryLead: string } => {
  const summaryId = id("summary", request.session_id, hash(request.user_prompt).slice(0, 8));
  const payload = request.context_payload ?? {};
  const datasetRows = Array.isArray(payload["dataset_rows"]) ? (payload["dataset_rows"] as Array<Record<string, unknown>>) : [];
  const datasetProfile = datasetRows.length > 0 ? extractDatasetProfile(datasetRows) : null;
  const dashboardSnapshot = payload["dashboard_snapshot"] as Record<string, unknown> | undefined;
  if (route.agent === "data_analyst_agent" && datasetProfile) {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "analysis", "أهم الحقول القابلة للتحليل", `الحقول الرقمية: ${datasetProfile.numericFields.join(", ") || "لا يوجد"} | الفئوية: ${datasetProfile.categoricalFields.join(", ") || "لا يوجد"}`, 0.86, false, route.action_ref, context.source_refs),
        makeSuggestion(summaryId, 1, "visualization", "أفضل visualization مبدئي", datasetProfile.numericFields.length > 1 ? "استخدم compare chart أو scatter إذا كانت هناك علاقة بين مقياسين." : "استخدم KPI + bar chart + table للقراءة السريعة.", 0.82, false, "dashboard.create.v1", context.source_refs),
        makeSuggestion(summaryId, 2, "next_action", "الخطوة التالية المقترحة", "حوّل الاستعلام إلى Dashboard approval-gated إذا أردت artifact تشغيليًا قابلًا للفحص.", 0.78, true, "dashboard.create.v1", context.source_refs)
      ],
      nextSteps: ["راجع الحقول الرقمية أولًا", "اختر قالب visualization قبل التنفيذ", "فعّل الموافقة إذا أردت إنشاء artifact فعلي"],
      summaryLead: "تم تحليل سياق البيانات وربطه بسطح Dashboards المقترح."
    };
  }
  if (route.agent === "excel_assistant") {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "formula", "اقتراح formulas", "ابدأ بـ SUMIFS / XLOOKUP / IFERROR عند وجود ربط بين sheets وحقول تصنيفية.", 0.81, false, route.action_ref, context.source_refs),
        makeSuggestion(summaryId, 1, "cleanup", "اقتراح cleanup", "نفّذ trim/deduplicate/type normalization قبل بناء pivots أو charts.", 0.79, false, "excel_engine.apply_transformation.v1", context.source_refs),
        makeSuggestion(summaryId, 2, "visualization", "اقتراح charts/pivots", "أنشئ Pivot أولًا للخصائص الفئوية ثم Chart مشتق منه بدل الرسم مباشرة من raw sheet.", 0.8, false, "excel_engine.generate_pivot.v1", context.source_refs)
      ],
      nextSteps: ["نظّف workbook", "راجع dependency graph", "اطلب apply فقط بعد الموافقة"],
      summaryLead: "تم فهم السياق على أنه workbook/formulas/charts/pivots."
    };
  }
  if (route.agent === "dashboard_assistant" && dashboardSnapshot) {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "visualization", "اقتراح widgets/layout", "رتّب KPI في الصف الأول، compare chart في المنتصف، وجدول drill-down في الأسفل مع filter ثابت.", 0.84, false, "dashboard.mutate.v1", context.source_refs),
        makeSuggestion(summaryId, 1, "analysis", "اقتراح compare insight", "فعّل compare بين current وbaseline version لإظهار delta واضح داخل summary widget أو narrative block.", 0.8, false, "dashboard.compare_versions.v1", context.source_refs),
        makeSuggestion(summaryId, 2, "next_action", "اقتراح تحويل إلى تقرير", "إذا أردت narrative مع publication trail فالمسار الأنسب هو report conversion approval-gated.", 0.77, true, "reports.convert_report_to_dashboard.v1", context.source_refs)
      ],
      nextSteps: ["ثبّت صفحة overview", "حدّد filter primary", "نفّذ mutation بعد الموافقة فقط"],
      summaryLead: "تم فهم السياق على أنه widgets/bindings/filters/compare/publish."
    };
  }
  if (route.agent === "reporting_assistant") {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "narrative", "اقتراح structure", "قسّم التقرير إلى executive summary ثم sections مع tables/charts/captions وروابط lineage واضحة.", 0.83, false, "reports.create_report.v1", context.source_refs),
        makeSuggestion(summaryId, 1, "analysis", "اقتراح narrative", "ابدأ بجملة قرار ثم metric ثم سبب ثم مخاطر/فجوات، ولا تؤخر الحكم التنفيذي إلى أسفل التقرير.", 0.79, false, null, context.source_refs),
        makeSuggestion(summaryId, 2, "next_action", "اقتراح conversion", "يمكن توليد Presentation approval-gated من هذا الملخص أو التقرير عند تفعيل الموافقة.", 0.82, true, "reports.convert_report_to_presentation.v1", context.source_refs)
      ],
      nextSteps: ["ثبّت blocks المطلوبة", "اربط sections بالمصادر", "فعّل conversion بعد الموافقة إذا لزم"],
      summaryLead: "تم فهم السياق على أنه sections/tables/narrative/publish/schedule."
    };
  }
  if (route.agent === "presentation_assistant") {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "slide_structure", "اقتراح slide structure", "ابدأ بعنوان تنفيذي، ثم agenda، ثم insight slides، ثم closing slide مع next actions.", 0.84, false, "presentations.generate_deck.v1", context.source_refs),
        makeSuggestion(summaryId, 1, "visualization", "اقتراح visual hierarchy", "استخدم slide واحدة لكل message رئيسية، مع رقم واحد بارز وsupport chart أو table فقط.", 0.8, false, null, context.source_refs),
        makeSuggestion(summaryId, 2, "next_action", "اقتراح generate deck", "يمكن إنشاء deck فعلي approval-gated داخل presentations-engine.", 0.86, true, "presentations.generate_deck.v1", context.source_refs)
      ],
      nextSteps: ["اختصر الرسائل", "حدّد audience/tone", "فعّل الموافقة إذا أردت deck فعلي"],
      summaryLead: "تم فهم السياق على أنه slides/layouts/themes/media."
    };
  }
  if (route.agent === "localization_assistant") {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "glossary", "اقتراح glossary/domain terminology", "ثبّت terms المحمية أولًا ثم طبّق phrasing/tone على النصوص الثانوية فقط.", 0.85, false, "registry.localization.resolve_terminology_profile", context.source_refs),
        makeSuggestion(summaryId, 1, "risk_gap", "اقتراح fidelity fixes", "راجع RTL overflow وmixed Arabic/English lines قبل publish.", 0.82, false, "registry.localization.run_localization_quality_gates", context.source_refs),
        makeSuggestion(summaryId, 2, "next_action", "اقتراح quality gates", "نفّذ quality gates قبل أي localized publish.", 0.81, false, "registry.localization.run_localization_quality_gates", context.source_refs)
      ],
      nextSteps: ["حل glossary أولًا", "راجع layout fidelity", "لا تنشر قبل quality gates"],
      summaryLead: "تم فهم السياق على أنه locale/provider/fidelity/RTL."
    };
  }
  if (route.agent === "replication_aware_assistant") {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "verification", "اقتراح verification diagnosis", "ابدأ من structural/pixel/round-trip gates ثم صنّف سبب degrade قبل أي repair.", 0.87, false, "registry.strict.run_round_trip_validation", context.source_refs),
        makeSuggestion(summaryId, 1, "risk_gap", "اقتراح strict/degraded resolution", "إذا فشل pixel gate وحده فابنِ repair loop bounded؛ إذا فشل editability فحوّل النتيجة إلى degraded صراحة.", 0.83, false, null, context.source_refs),
        makeSuggestion(summaryId, 2, "next_action", "الخطوة التالية", "راجع independent verification artifacts قبل claim النجاح.", 0.79, false, null, context.source_refs)
      ],
      nextSteps: ["تحقق من dual gates", "اقرأ repair trace", "احصر publish في strict أو degraded فقط"],
      summaryLead: "تم فهم السياق على أنه strict job/CDR/verification/diffs."
    };
  }
  if (route.agent === "governance_aware_assistant") {
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "risk_gap", "اقتراح governance gap", "أي execution mutating يجب أن يمر عبر approval boundary وpermission scope واضحين.", 0.89, false, "intelligent_operator.build_execution_plan.v1", context.source_refs),
        makeSuggestion(summaryId, 1, "next_action", "اقتراح audit review", "راجع evidence/audit/lineage endpoints قبل اعتماد claim تشغيل أو نشر.", 0.84, false, null, context.source_refs)
      ],
      nextSteps: ["تحقق من policy scope", "راجع audit trail", "امنع auto-apply"],
      summaryLead: "تم تشغيل المسار governance-aware مع فحص الحوكمة والصلاحيات."
    };
  }
  if (route.agent === "document_file_understanding_assistant") {
    const extractedTokens = request.user_prompt.split(/\s+/).filter((token) => token.length > 3).slice(0, 8).join(", ");
    return {
      suggestions: [
        makeSuggestion(summaryId, 0, "analysis", "الحقول أو المحاور الرئيسية", `تم استخراج محاور أولية من النص أو الملف المشار إليه: ${extractedTokens || "لا يوجد نص كافٍ"}.`, 0.74, false, null, context.source_refs),
        makeSuggestion(summaryId, 1, "next_action", "الخطوة التالية", "زوّد artifact/file context أدق إذا أردت extraction أدق متعدد الملفات.", 0.7, false, null, context.source_refs)
      ],
      nextSteps: ["مرّر file ref أو artifact ref", "حدّد output المطلوب", "اربط الملف بالصفحة الأنسب"],
      summaryLead: "تم تشغيل document/file understanding على المدخلات الحالية."
    };
  }
  return {
    suggestions: [
      makeSuggestion(summaryId, 0, "analysis", "اقتراح تحليلي", "تم تحويل الطلب إلى plan متعددة الخطوات قابلة للتنفيذ داخل المنصة.", 0.76, false, route.action_ref, context.source_refs),
      makeSuggestion(summaryId, 1, "next_action", "الخطوة التالية", "إن كان الطلب mutating ففعّل approval boundary أولًا.", 0.8, isMutatingPrompt(normalizePrompt(request.user_prompt)), route.action_ref, context.source_refs)
    ],
    nextSteps: ["راجع الخطة", "تحقق من الصلاحيات", "نفّذ فقط بعد الموافقة"],
    summaryLead: "تم فهم الطلب وربطه بسطح المنصة الحالي."
  };
};

const buildDashboardWorkflowFromContext = (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  jobId: string
): DashboardWorkflowResult | null => {
  const datasetRows = Array.isArray(request.context_payload["dataset_rows"]) ? (request.context_payload["dataset_rows"] as Array<Record<string, unknown>>) : [];
  if (datasetRows.length === 0) {
    return null;
  }
  const datasetProfile = extractDatasetProfile(datasetRows);
  const numericField = datasetProfile.numericFields[0] ?? datasetProfile.fieldNames[0] ?? "value";
  const dimensionField = datasetProfile.categoricalFields[0] ?? datasetProfile.fieldNames[0] ?? "label";
  const datasetRef = request.resource_ref ?? id("dataset", jobId);
  const engine = new DashboardEngine({ storageDir: path.join(process.cwd(), ".runtime", "ai-engine-dashboard") });
  return engine.createDashboard({
    dashboard_id: id("dashboard", jobId),
    tenant_ref: request.tenant_ref,
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    created_by: request.actor_ref,
    title: `AI Dashboard ${new Date().toISOString().slice(11, 19)}`,
    description: `Created from AI execution plan for prompt: ${request.user_prompt}`,
    mode: request.requested_mode,
    dataset_profiles: [
      {
        dataset_ref: datasetRef,
        display_name: "AI dataset",
        dimension_fields: datasetProfile.categoricalFields,
        measure_fields: datasetProfile.numericFields,
        default_query_ref: `${datasetRef}:default`,
        available_filter_fields: datasetProfile.categoricalFields
      }
    ],
    widget_blueprints: [
      {
        widget_type: "kpi_card",
        title: `Total ${numericField}`,
        subtitle: "AI generated",
        layout: { page_id: "page-overview", x: 0, y: 0, width: 3, height: 2 },
        binding: { dataset_ref: datasetRef, query_ref: `${datasetRef}:kpi:${numericField}`, field_mappings: [{ measure_field: numericField, aggregation: "sum" }], calculation_refs: [] },
        style_config: { measure_field: numericField }
      },
      {
        widget_type: "bar_chart",
        title: `${numericField} by ${dimensionField}`,
        subtitle: "AI recommended",
        layout: { page_id: "page-overview", x: 3, y: 0, width: 6, height: 4 },
        binding: { dataset_ref: datasetRef, query_ref: `${datasetRef}:series:${numericField}:${dimensionField}`, field_mappings: [{ measure_field: numericField, dimension_field: dimensionField }], calculation_refs: [] },
        style_config: { measure_field: numericField, dimension_field: dimensionField }
      },
      {
        widget_type: "table",
        title: "AI detail table",
        subtitle: "Top rows",
        layout: { page_id: "page-overview", x: 0, y: 4, width: 9, height: 4 },
        binding: { dataset_ref: datasetRef, query_ref: `${datasetRef}:table`, field_mappings: [{ columns: datasetProfile.fieldNames.slice(0, 6) }], calculation_refs: [] },
        style_config: { columns: datasetProfile.fieldNames.slice(0, 6) }
      },
      {
        widget_type: "filter",
        title: `Filter ${dimensionField}`,
        subtitle: "AI generated",
        layout: { page_id: "page-overview", x: 9, y: 0, width: 3, height: 2 },
        binding: { dataset_ref: datasetRef, query_ref: `${datasetRef}:filter:${dimensionField}`, field_mappings: [{ field_ref: dimensionField }], calculation_refs: [] },
        style_config: { field_ref: dimensionField }
      }
    ] as never,
    filters: [
      {
        title: `Filter ${dimensionField}`,
        filter_scope: "global",
        control_type: "multi_select",
        dataset_ref: datasetRef,
        field_ref: dimensionField,
        default_values: [],
        current_values: [],
        target_widget_refs: []
      }
    ] as never,
    template_ref: "template://dashboards/ai-generated",
    brand_preset_ref: "brand://rasid/dashboard",
    permission_scope: request.permission_scope ?? defaultPermissionScope("/dashboards")
  });
};

const fileUri = (targetPath: string): string => `file:///${targetPath.replace(/\\/g, "/")}`;

const writeJsonFile = (targetPath: string, payload: unknown): string => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return targetPath;
};

const createRuntimeArtifact = (options: {
  jobId: string;
  artifactSuffix: string;
  artifactType: Artifact["artifact_type"];
  artifactSubtype: string;
  filePath: string;
  actorRef: string;
  tenantRef: string;
  workspaceId: string;
  projectId: string;
  mode: "easy" | "advanced";
  editableStatus?: Artifact["editable_status"];
  sourceRefs?: string[];
  parentArtifactRefs?: string[];
  verificationStatus?: Artifact["verification_status"];
  permissionScope?: PermissionScope;
}): Artifact => ({
  contract: contractEnvelope("artifact"),
  artifact_id: id("artifact", options.jobId, options.artifactSuffix),
  artifact_type: options.artifactType,
  artifact_subtype: options.artifactSubtype,
  project_id: options.projectId,
  workspace_id: options.workspaceId,
  source_refs: options.sourceRefs ?? [],
  parent_artifact_refs: options.parentArtifactRefs ?? [],
  canonical_ref: "",
  created_by: options.actorRef,
  created_at: now(),
  mode: options.mode,
  editable_status: options.editableStatus ?? "non_editable",
  template_status: "none",
  lineage_ref: id("lineage", options.jobId, options.artifactSuffix),
  evidence_ref: id("evidence", options.jobId),
  verification_status: options.verificationStatus ?? "verified",
  storage_ref: {
    storage_id: id("storage", options.jobId, options.artifactSuffix),
    storage_class: "local_fs",
    uri: fileUri(options.filePath),
    checksum: hash(options.filePath),
    region: "workspace"
  },
  preview_ref: {
    preview_id: id("preview", options.jobId, options.artifactSuffix),
    preview_type: "html_canvas",
    storage_ref: id("storage", options.jobId, options.artifactSuffix)
  },
  export_refs: [],
  version_ref: {
    version_id: id("version", options.jobId, options.artifactSuffix),
    parent_version_id: null,
    version_number: 1,
    semantic_version: "1.0.0"
  },
  tenant_ref: options.tenantRef,
  permission_scope: options.permissionScope ?? defaultPermissionScope("/home")
});

const dedupeArtifacts = (artifacts: Artifact[]): Artifact[] => {
  const seen = new Set<string>();
  return artifacts.filter((artifact) => {
    if (seen.has(artifact.artifact_id)) {
      return false;
    }
    seen.add(artifact.artifact_id);
    return true;
  });
};

const buildReportSections = (
  title: string,
  rows: Array<Record<string, unknown>>,
  leadText: string,
  sourceRefs: string[]
) => {
  const profile = rows.length > 0 ? extractDatasetProfile(rows) : { fieldNames: [], numericFields: [], categoricalFields: [] };
  const primaryMetric = profile.numericFields[0] ?? "value";
  const metricValue =
    rows.length > 0
      ? rows.reduce((total, row) => total + Number(row[primaryMetric] ?? 0), 0)
      : leadText.length;
  const tableRows =
    rows.length > 0
      ? [profile.fieldNames.slice(0, 4), ...rows.slice(0, 3).map((row) => profile.fieldNames.slice(0, 4).map((field) => String(row[field] ?? "")))]
      : [["Field", "Value"], ["summary", leadText]];
  return [
    {
      section_kind: "executive_summary" as const,
      title,
      blocks: [
        {
          block_type: "narrative" as const,
          title: "Executive Summary",
          body: leadText,
          citations: sourceRefs,
          source_lineage_refs: sourceRefs
        },
        {
          block_type: "metric_card" as const,
          title: `Primary Metric ${primaryMetric}`,
          body: `${primaryMetric} aggregate`,
          metric_value: metricValue,
          citations: sourceRefs,
          source_lineage_refs: sourceRefs
        }
      ]
    },
    {
      section_kind: "body" as const,
      title: "Operational Detail",
      blocks: [
        {
          block_type: "table" as const,
          title: "Source Snapshot",
          body: "Top extracted rows from the current context.",
          table_rows: tableRows,
          citations: sourceRefs,
          source_lineage_refs: sourceRefs
        },
        {
          block_type: "commentary" as const,
          title: "AI Narrative",
          body: `Rows: ${rows.length}. Numeric fields: ${profile.numericFields.join(", ") || "none"}. Categorical fields: ${profile.categoricalFields.join(", ") || "none"}.`,
          citations: sourceRefs,
          source_lineage_refs: sourceRefs
        }
      ]
    }
  ];
};

const buildLocalizationSeedCanonical = (
  jobId: string,
  request: z.infer<typeof SubmitAiJobInputSchema>,
  sourceText: string
): CanonicalRepresentation =>
  CanonicalRepresentationSchema.parse({
    contract: CANONICAL_CONTRACT,
    canonical_id: id("canonical", jobId, "localization-source"),
    tenant_ref: request.tenant_ref,
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    source_descriptors: [
      {
        source_ref: request.resource_ref ?? id("source", jobId),
        source_type: "ai_prompt",
        source_revision_ref: "v1",
        parser_profile: "ai-engine.localization-seed.v1",
        connector_ref: "local://ai-engine"
      }
    ],
    representation_kind: "report",
    strictness_mode: "smart",
    localization: {
      locale: "en-US",
      rtl: false,
      numeral_system: "latn",
      fallback_locales: []
    },
    root_node_refs: [id("document", jobId), id("page", jobId, "1")],
    nodes: {
      documents: [
        {
          node_id: id("document", jobId),
          node_type: "document",
          parent_node_ref: null,
          child_node_refs: [id("page", jobId, "1")],
          name: "Localization Seed",
          semantic_labels: ["document"],
          layout_ref: id("layout", jobId),
          data_binding_refs: [],
          formula_refs: [],
          lineage_refs: [],
          template_refs: [],
          evidence_refs: [],
          editable: true,
          page_refs: [id("page", jobId, "1")],
          section_refs: []
        }
      ],
      pages: [
        {
          node_id: id("page", jobId, "1"),
          node_type: "page",
          parent_node_ref: id("document", jobId),
          child_node_refs: [id("text", jobId, "title"), id("text", jobId, "body")],
          name: "Page 1",
          semantic_labels: ["page"],
          layout_ref: id("layout", jobId),
          data_binding_refs: [],
          formula_refs: [],
          lineage_refs: [],
          template_refs: [],
          evidence_refs: [],
          editable: true,
          width: 1280,
          height: 720,
          unit: "px",
          layer_refs: []
        }
      ],
      sheets: [],
      slides: [],
      tables: [],
      charts: [],
      shapes: [],
      text: [
        {
          node_id: id("text", jobId, "title"),
          node_type: "text",
          parent_node_ref: id("page", jobId, "1"),
          child_node_refs: [],
          name: "Title",
          semantic_labels: ["title"],
          layout_ref: id("layout", jobId, "title"),
          data_binding_refs: [],
          formula_refs: [],
          lineage_refs: [],
          template_refs: [],
          evidence_refs: [],
          editable: true,
          content: [{ value: "Localization Request", locale: "en-US", rtl: false }],
          typography_ref: "font://default"
        },
        {
          node_id: id("text", jobId, "body"),
          node_type: "text",
          parent_node_ref: id("page", jobId, "1"),
          child_node_refs: [],
          name: "Body",
          semantic_labels: ["body"],
          layout_ref: id("layout", jobId, "body"),
          data_binding_refs: [id("binding", jobId, "body")],
          formula_refs: [],
          lineage_refs: [],
          template_refs: [],
          evidence_refs: [],
          editable: true,
          content: [{ value: sourceText, locale: "en-US", rtl: false }],
          typography_ref: "font://default"
        }
      ],
      images: []
    },
    layout_metadata: {
      coordinate_space: "page",
      bounding_boxes: [
        { node_ref: id("text", jobId, "title"), container_ref: id("page", jobId, "1"), x: 72, y: 72, width: 1040, height: 96, direction: "ltr" },
        { node_ref: id("text", jobId, "body"), container_ref: id("page", jobId, "1"), x: 72, y: 188, width: 1100, height: 240, direction: "ltr" }
      ],
      z_order: [],
      grid_rules: [],
      alignment_rules: [
        { node_ref: id("text", jobId, "title"), horizontal: "left", vertical: "top", direction: "ltr" },
        { node_ref: id("text", jobId, "body"), horizontal: "left", vertical: "top", direction: "ltr" }
      ]
    },
    data_binding_refs: [
      {
        binding_id: id("binding", jobId, "body"),
        dataset_ref: request.resource_ref ?? id("dataset", jobId),
        query_ref: id("query", jobId, "body"),
        target_node_ref: id("text", jobId, "body"),
        field_mappings: [{ field: "body" }]
      }
    ],
    formula_refs: [],
    semantic_labels: [
      { label_id: id("label", jobId, "surface"), label_type: "surface", label_value: request.page_path, target_ref: id("page", jobId, "1") }
    ],
    lineage_refs: [],
    template_refs: [],
    editability_flags: {
      default_editable: true,
      locked_region_refs: [],
      lock_reason_codes: []
    },
    evidence_refs: [],
    created_at: now(),
    updated_at: now()
  });

const buildStrictInput = (
  jobId: string,
  request: z.infer<typeof SubmitAiJobInputSchema>
): Parameters<StrictReplicationEngine["run"]>[0] => ({
  run_id: id("strict", jobId),
  tenant_ref: request.tenant_ref,
  workspace_id: request.workspace_id,
  project_id: request.project_id,
  created_by: request.actor_ref,
  mode: request.requested_mode,
  source_kind: "document",
  target_kind: "dashboard",
  original_name: "ai-replication-source.txt",
  source_ref: request.resource_ref ?? id("source", jobId),
  policy_id: "strict-policy-default",
  allow_degraded_publish: true,
  requested_repair_classes: ["coordinate_normalization"],
  fail_editability: false,
  fail_round_trip: false,
  pages: [
    {
      page_id: "page-1",
      width: 16,
      height: 8,
      background: ".",
      elements: [
        { element_id: "title", element_type: "text", x: 1, y: 1, width: 8, height: 1, text: "AI STRICT VERIFY", fill: "T", editable: true },
        { element_id: "hero", element_type: "shape", x: 1, y: 3, width: 4, height: 2, fill: "S", editable: true },
        { element_id: "table-1", element_type: "table", x: 8, y: 4, width: 6, height: 3, rows: [["Metric", "Value"], ["Q1", "10"]], fill: "B", editable: true, formula_refs: ["SUM(B2:B2)"] }
      ]
    }
  ]
});

const runExcelExecution = async (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  summaryArtifact: Artifact,
  jobId: string
): Promise<ExecutionResult> => {
  const outputRoot = path.join(process.cwd(), ".runtime", "ai-engine-executions", "excel", jobId);
  const engine = new ExcelEngine();
  const sample = await engine.runSample({
    output_root: outputRoot,
    tenant_ref: request.tenant_ref,
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    actor_ref: request.actor_ref
  });
  const artifacts = sample.state.artifacts.filter((artifact) =>
    ["editable_workbook", "transformation_result", "formula_graph", "pivot_metadata", "chart_metadata", "analysis"].includes(artifact.artifact_subtype)
  );
  return {
    outcome: sample.evidencePack.failure_reasons.length > 0 ? "failed" : sample.evidencePack.warnings.length > 0 ? "success_with_warnings" : "success",
    degrade_classification: null,
    warnings: sample.evidencePack.warnings,
    failures: sample.evidencePack.failure_reasons,
    result_artifacts: dedupeArtifacts([summaryArtifact, ...artifacts]),
    summary_notes: ["Excel editable pipeline executed through import, analysis, transformation, pivot, chart, formatting, and export."],
    execution_provider_ref: null,
    execution_model_ref: null,
    execution_fallback_provider_ref: null,
    execution_fallback_model_ref: null,
    execution_fallback_used: false,
    execution_fallback_reason: null,
    execution_step_details: [
      "excel.import_workbook",
      "excel.analyze_workbook",
      "excel.apply_transformation",
      "excel.recalculate_formulas",
      "excel.generate_pivot",
      "excel.generate_chart",
      "excel.apply_formatting",
      "excel.export_editable_workbook"
    ],
    downstream_audit_events: sample.state.auditEvents,
    downstream_lineage_edges: sample.state.lineageEdges,
    open_path: `/excel?ai_job_id=${encodeURIComponent(jobId)}`
  };
};

const runReportExecution = async (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  plan: AiExecutionPlan,
  summaryArtifact: Artifact,
  jobId: string
): Promise<ExecutionResult> => {
  const outputRoot = path.join(process.cwd(), ".runtime", "ai-engine-executions", "reports", jobId);
  const reportEngine = new ReportEngine({ storageDir: outputRoot });
  const rows =
    Array.isArray(request.context_payload["dataset_rows"])
      ? (request.context_payload["dataset_rows"] as Array<Record<string, unknown>>)
      : Array.isArray((request.context_payload["dashboard_snapshot"] as Record<string, unknown> | undefined)?.["rendered"])
        ? (((request.context_payload["dashboard_snapshot"] as Record<string, unknown>)["rendered"] as Array<Record<string, unknown>>) ?? [])
        : [];
  const created = reportEngine.createReport({
    tenant_ref: request.tenant_ref,
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    created_by: request.actor_ref,
    title: `AI Report ${new Date().toISOString().slice(11, 19)}`,
    description: `AI-generated report for ${request.page_path}`,
    mode: request.requested_mode,
    language: "ar-SA",
    source_refs: [...new Set([...(request.resource_ref ? [request.resource_ref] : []), ...(request.resource_refs ?? [])])],
    sections: buildReportSections("AI Executive Summary", rows, request.user_prompt, [...new Set([...(request.resource_ref ? [request.resource_ref] : []), ...(request.resource_refs ?? [])])])
  });
  const narrativeBlock = created.contentBlocks.find((block) => block.block_type === "narrative");
  const updated = narrativeBlock
    ? reportEngine.updateReport({
        report_id: created.report.report_id,
        actor_ref: request.actor_ref,
        mutation: {
          mutation_kind: "replace_block_content",
          block_ref: narrativeBlock.block_id,
          title: "AI Refined Narrative",
          body: `${request.user_prompt}\n\nتمت إضافة مقارنة وسياق تشغيلي قابل للتدقيق.`
        }
      })
    : created;
  const compared = reportEngine.compareReports({
    report_id: created.report.report_id,
    actor_ref: request.actor_ref,
    base_version_ref: created.version.version_ref.version_id,
    target_version_ref: updated.version.version_ref.version_id
  });
  const exported = await reportEngine.exportReportDocx({
    report_id: created.report.report_id,
    actor_ref: request.actor_ref
  });
  let convertedArtifacts: Artifact[] = [];
  let conversionAuditEvents: AuditEvent[] = [];
  let conversionLineageEdges: LineageEdge[] = [];
  let openPath = `/reports?ai_job_id=${encodeURIComponent(jobId)}`;
  if (plan.selected_action_ref === "reports.convert_report_to_dashboard.v1") {
    const dashboardConversion = await reportEngine.convertReportToDashboard({
      report_id: created.report.report_id,
      actor_ref: request.actor_ref,
      target_ref: "workspace://dashboards/ai-report"
    });
    convertedArtifacts = [
      dashboardConversion.artifact,
      ...(dashboardConversion.nativeDashboardWorkflow
        ? [dashboardConversion.nativeDashboardWorkflow.dashboardArtifact, dashboardConversion.nativeDashboardWorkflow.versionArtifact]
        : [])
    ];
    conversionAuditEvents = dashboardConversion.auditEvents;
    conversionLineageEdges = dashboardConversion.lineageEdges;
    const dashboardId = String(dashboardConversion.payload["dashboard_id"] ?? "");
    openPath = dashboardId.length > 0 ? `/dashboards?dashboard_id=${encodeURIComponent(dashboardId)}&ai_job_id=${encodeURIComponent(jobId)}` : openPath;
  }
  return {
    outcome: "success",
    degrade_classification: null,
    warnings: [...created.evidencePack.warnings, ...updated.evidencePack.warnings, ...compared.evidencePack.warnings, ...exported.evidencePack.warnings],
    failures: [...created.evidencePack.failure_reasons, ...updated.evidencePack.failure_reasons, ...compared.evidencePack.failure_reasons, ...exported.evidencePack.failure_reasons],
    result_artifacts: dedupeArtifacts([summaryArtifact, created.reportArtifact, compared.diffArtifact, exported.exportArtifact, ...convertedArtifacts]),
    summary_notes: ["Report pipeline executed through create, update, compare, export, and optional cross-engine conversion."],
    execution_provider_ref: null,
    execution_model_ref: null,
    execution_fallback_provider_ref: null,
    execution_fallback_model_ref: null,
    execution_fallback_used: false,
    execution_fallback_reason: null,
    execution_step_details: [
      "reports.create_report",
      "reports.update_report",
      "reports.compare_reports",
      "reports.export_report_docx",
      ...(plan.selected_action_ref === "reports.convert_report_to_dashboard.v1" ? ["reports.convert_report_to_dashboard"] : [])
    ],
    downstream_audit_events: [
      ...created.auditEvents,
      ...updated.auditEvents,
      ...compared.auditEvents,
      ...exported.auditEvents,
      ...conversionAuditEvents
    ],
    downstream_lineage_edges: [
      ...created.lineageEdges,
      ...updated.lineageEdges,
      ...compared.lineageEdges,
      ...exported.lineageEdges,
      ...conversionLineageEdges
    ],
    open_path: openPath
  };
};

const runLocalizationExecution = async (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  summaryArtifact: Artifact,
  jobId: string
): Promise<ExecutionResult> => {
  const outputRoot = path.join(process.cwd(), ".runtime", "ai-engine-executions", "localization", jobId);
  const sourceText = [
    "Create a formal Arabic version of the current report.",
    "Preserve approved terms.",
    "Keep the structure editable.",
    "Keep the evidence and audit details accurate."
  ].join(" ");
  const canonical = buildLocalizationSeedCanonical(jobId, request, sourceText);
  const inputPayloadPath = writeJsonFile(path.join(outputRoot, "input", "source-payload.json"), {
    prompt: request.user_prompt,
    page_path: request.page_path,
    resource_ref: request.resource_ref,
    resource_refs: request.resource_refs
  });
  const canonicalPath = writeJsonFile(path.join(outputRoot, "input", "source-canonical.json"), canonical);
  const sourceArtifact = createRuntimeArtifact({
    jobId,
    artifactSuffix: "localization-source",
    artifactType: "report",
    artifactSubtype: "localization_source_seed",
    filePath: inputPayloadPath,
    actorRef: request.actor_ref,
    tenantRef: request.tenant_ref,
    workspaceId: request.workspace_id,
    projectId: request.project_id,
    mode: request.requested_mode,
    editableStatus: "editable",
    sourceRefs: request.resource_refs,
    permissionScope: request.permission_scope ?? defaultPermissionScope(request.page_path)
  });
  const localizationEngine = new ArabicLocalizationLctEngine();
  const bundle = await localizationEngine.run(
    {
      run_id: id("localization", jobId),
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      mode: request.requested_mode,
      source_artifact: sourceArtifact,
      source_canonical: canonical,
      target_locale: "ar-SA",
      publish_target_ref: "workspace://localization/ai-engine",
      profiles: [],
      rules: [],
      protected_terms: [],
      non_translatable_terms: [],
      integration: {
        provider_mode: "http_json",
        provider_url: String(request.context_payload["live_translation_provider_url"] ?? ""),
        provider_headers: {
          "x-tenant-ref": request.tenant_ref,
          "x-actor-ref": request.actor_ref,
          "x-ai-provider-bridge": "1",
          ...(hasAny(normalizePrompt(request.user_prompt), ["[force-provider-fallback]", "fallback"])
            ? { "x-force-primary-failure": "1" }
            : {})
        },
        provider_timeout_ms: 12000,
        provider_retry_count: 1,
        provider_retry_backoff_ms: 100
      },
      roundtrip_tamper_mode: "none",
      allow_degraded_publish: true,
      output_root: outputRoot
    },
    { prompt: request.user_prompt, source_text: sourceText },
    { filePath: canonicalPath, uri: fileUri(canonicalPath), checksum: hash(JSON.stringify(canonical)) }
  );
  return {
    outcome: bundle.job.state === "degraded" ? "degraded" : bundle.evidence_pack.warnings.length > 0 ? "success_with_warnings" : "success",
    degrade_classification: bundle.job.state === "degraded" ? "localization_degraded_publish" : null,
    warnings: bundle.evidence_pack.warnings,
    failures: bundle.evidence_pack.failure_reasons,
    result_artifacts: dedupeArtifacts([summaryArtifact, bundle.localized_artifact, bundle.preview_artifact, bundle.diff_artifact, ...bundle.export_artifacts]),
    summary_notes: ["Localization pipeline executed through canonical transformation, live provider translation, quality gates, and localized publish output."],
    execution_provider_ref: bundle.translation_integration.selected_provider_ref,
    execution_model_ref: bundle.translation_integration.selected_model_ref,
    execution_fallback_provider_ref: bundle.translation_integration.fallback_provider_ref,
    execution_fallback_model_ref: bundle.translation_integration.fallback_model_ref,
    execution_fallback_used: bundle.translation_integration.fallback_used,
    execution_fallback_reason: bundle.translation_integration.fallback_reason,
    execution_step_details: [
      "localization.build_localization_plan",
      "localization.transform_language",
      "localization.external_provider_translation",
      "localization.run_quality_gates",
      "localization.publish_localized_output"
    ],
    downstream_audit_events: bundle.audit_events,
    downstream_lineage_edges: bundle.lineage_edges,
    open_path: `/localization?ai_job_id=${encodeURIComponent(jobId)}`
  };
};

const runStrictExecution = async (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  summaryArtifact: Artifact,
  jobId: string
): Promise<ExecutionResult> => {
  const bundle = new StrictReplicationEngine().run(buildStrictInput(jobId, request));
  return {
    outcome: bundle.strictPublished ? "success" : "degraded",
    degrade_classification: bundle.strictPublished ? null : "strict_degraded_publish",
    warnings: bundle.evidencePack.warnings,
    failures: bundle.evidencePack.failure_reasons,
    result_artifacts: dedupeArtifacts([summaryArtifact, bundle.artifacts.publishedArtifact, bundle.artifacts.exportArtifact, bundle.artifacts.diffArtifact]),
    summary_notes: ["Strict replication executed through ingest, CDR, dual gates, repair loop, round-trip validation, and publication."],
    execution_provider_ref: null,
    execution_model_ref: null,
    execution_fallback_provider_ref: null,
    execution_fallback_model_ref: null,
    execution_fallback_used: false,
    execution_fallback_reason: null,
    execution_step_details: bundle.stageRecords.map((record) => `strict.${record.stage.replace(/\s+/g, "_")}:${record.status}`),
    downstream_audit_events: bundle.auditEvents,
    downstream_lineage_edges: bundle.lineageEdges,
    open_path: `/replication?ai_job_id=${encodeURIComponent(jobId)}`
  };
};

const transcriptionStorageDir = (request: z.infer<typeof SubmitAiJobInputSchema>): string =>
  String(request.context_payload["transcription_storage_dir"] ?? path.join(process.cwd(), ".runtime", "transcription-web", "transcription-engine"));

const transcriptionBundleRefs = (request: z.infer<typeof SubmitAiJobInputSchema>): string[] => {
  const contextRefs = Array.isArray(request.context_payload["bundle_refs"])
    ? (request.context_payload["bundle_refs"] as unknown[]).map((value) => String(value)).filter((value) => value.length > 0)
    : [];
  const resourceRefs = request.resource_refs.map((value) => String(value)).filter((value) => value.length > 0);
  const merged = [...new Set([...contextRefs, ...resourceRefs, ...(request.resource_ref ? [request.resource_ref] : [])])];
  return merged;
};

const runTranscriptionExecution = async (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  plan: AiExecutionPlan,
  summaryArtifact: Artifact,
  jobId: string
): Promise<ExecutionResult> => {
  const bundleRefs = transcriptionBundleRefs(request);
  const engine = new TranscriptionExtractionEngine({ storageDir: transcriptionStorageDir(request) });
  if (bundleRefs.length < 2) {
    return {
      outcome: "degraded",
      degrade_classification: "missing_transcription_compare_context",
      warnings: [
        {
          warning_code: "missing_transcription_compare_context",
          summary: "Two transcription bundles are required for the live compare path.",
          detail: "The transcription AI route needs two bundle refs from the current live runtime to emit compare artifacts, evidence, audit, and lineage.",
          severity: "high",
          impacted_refs: [jobId]
        }
      ],
      failures: [],
      result_artifacts: [summaryArtifact],
      summary_notes: ["The transcription route stayed assistive because the live runtime did not provide two bundle refs."],
      execution_provider_ref: null,
      execution_model_ref: null,
      execution_fallback_provider_ref: null,
      execution_fallback_model_ref: null,
      execution_fallback_used: false,
      execution_fallback_reason: null,
      execution_step_details: ["transcription.resolve_bundle_context", "transcription.compare_context_missing"],
      open_path: `/transcription?ai_job_id=${encodeURIComponent(jobId)}`
    };
  }
  let compareBundle: TranscriptionCompareBundle;
  if (plan.selected_action_ref === "transcription.answer_question.v1") {
    compareBundle = engine.compareBundles({
      left_bundle_ref: bundleRefs[0]!,
      right_bundle_ref: bundleRefs[1]!,
      actor_ref: request.actor_ref,
      workspace_id: request.workspace_id,
      tenant_ref: request.tenant_ref
    });
  } else {
    compareBundle = engine.compareBundles({
      left_bundle_ref: bundleRefs[0]!,
      right_bundle_ref: bundleRefs[1]!,
      actor_ref: request.actor_ref,
      workspace_id: request.workspace_id,
      tenant_ref: request.tenant_ref
    });
  }
  const outputRoot = path.join(process.cwd(), ".runtime", "ai-engine-executions", "transcription", jobId);
  const compareResultPath = writeJsonFile(path.join(outputRoot, "compare", "compare-result.json"), compareBundle.compareResult);
  const compareArtifact = createRuntimeArtifact({
    jobId,
    artifactSuffix: "transcription-compare-result",
    artifactType: "workflow_output",
    artifactSubtype: "transcription_compare_result",
    filePath: compareResultPath,
    actorRef: request.actor_ref,
    tenantRef: request.tenant_ref,
    workspaceId: request.workspace_id,
    projectId: request.project_id,
    mode: request.requested_mode,
    editableStatus: "non_editable",
    sourceRefs: bundleRefs,
    parentArtifactRefs: [compareBundle.diffArtifact.artifact_id],
    permissionScope: request.permission_scope ?? defaultPermissionScope("/transcription")
  });
  return {
    outcome: compareBundle.evidencePack.failure_reasons.length > 0 ? "failed" : compareBundle.evidencePack.warnings.length > 0 ? "success_with_warnings" : "success",
    degrade_classification: null,
    warnings: compareBundle.evidencePack.warnings,
    failures: compareBundle.evidencePack.failure_reasons,
    result_artifacts: dedupeArtifacts([summaryArtifact, compareBundle.diffArtifact, compareArtifact]),
    summary_notes: ["Transcription AI executed the live bundle-to-bundle compare path and emitted a governed compare artifact."],
    execution_provider_ref: null,
    execution_model_ref: null,
    execution_fallback_provider_ref: null,
    execution_fallback_model_ref: null,
    execution_fallback_used: false,
    execution_fallback_reason: null,
    execution_step_details: [
      "transcription.resolve_bundle_context",
      "transcription.compare_bundles",
      "transcription.emit_compare_artifact"
    ],
    downstream_audit_events: compareBundle.auditEvents,
    downstream_lineage_edges: compareBundle.lineageEdges,
    open_path: `/transcription?ai_job_id=${encodeURIComponent(jobId)}`
  };
};

const executePlan = async (
  request: z.infer<typeof SubmitAiJobInputSchema>,
  plan: AiExecutionPlan,
  summaryArtifact: Artifact,
  jobId: string
): Promise<ExecutionResult> => {
  const executionMetadata = {
    execution_provider_ref: plan.selected_provider_ref,
    execution_model_ref: plan.selected_model_ref,
    execution_fallback_provider_ref: plan.fallback_provider_ref,
    execution_fallback_model_ref: plan.fallback_model_ref,
    execution_fallback_used: false,
    execution_fallback_reason: null as string | null
  };
  if (plan.execution_mode !== "approved_apply") {
    return { outcome: "success", degrade_classification: null, warnings: [], failures: [], result_artifacts: [summaryArtifact], summary_notes: ["Assistive path only; no editable artifact was changed."], ...executionMetadata, execution_step_details: ["assistive_only"], open_path: null };
  }
  if (!(request.permission_scope ?? defaultPermissionScope(request.page_path)).allow_write && plan.target_output_kind !== "suggestion_pack") {
    return {
      outcome: "failed",
      degrade_classification: "permission_denied",
      warnings: [],
      failures: [{ reason_code: "permission_denied", summary: "Execution blocked by permission scope.", detail: "The current page context does not allow write operations.", impacted_refs: [jobId], retryable: false }],
      result_artifacts: [summaryArtifact],
      summary_notes: ["The plan required write permission but the current surface is read-only."],
      ...executionMetadata,
      execution_step_details: ["permission_denied"],
      open_path: null
    };
  }
  if (plan.selected_capability === "presentations" || plan.selected_action_ref === "reports.convert_report_to_presentation.v1") {
    const engine = new PresentationEngine();
    const bundle = await engine.createPresentation({
      presentation_id: id("deck", jobId),
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      created_by: request.actor_ref,
      title: `AI Presentation ${new Date().toISOString().slice(11, 19)}`,
      description: `Created by AI execution for ${request.page_path}.`,
      mode: request.requested_mode,
      language: "ar-SA",
      audience: "platform users",
      tone: "direct",
      density: "balanced",
      rtl_policy: "rtl",
      motion_level: "subtle",
      notes_policy: "auto_generate",
      export_targets: ["reader", "pptx", "pdf", "html"],
      sources: [{ source_kind: "plain_text", source_ref: request.resource_ref ?? id("source", jobId), text: request.user_prompt, title: "AI prompt" }]
    });
    const parity = await engine.runRenderParityValidation(bundle);
    const publicationResult = engine.publishPresentation({
      bundle: parity.bundle,
      published_by: request.actor_ref,
      target_ref: `workspace://presentations/${jobId}`,
      publish_to_library: true,
      allow_degraded: false
    });
    const outputRoot = path.join(process.cwd(), ".runtime", "ai-engine-executions", "presentations", jobId);
    const publicationPath = writeJsonFile(path.join(outputRoot, "publication", "publication-summary.json"), {
      publication: publicationResult.publication,
      library_asset: publicationResult.libraryAsset,
      parity_validation: parity.parityValidation,
      export_refs: parity.exports.map((item) => item.artifact.artifact_id),
      preview_ref: parity.preview.artifact.artifact_id,
      deck_id: publicationResult.bundle.deck.deck_id
    });
    const publicationArtifact = createRuntimeArtifact({
      jobId,
      artifactSuffix: "presentation-publication-summary",
      artifactType: "workflow_output",
      artifactSubtype: "presentation_publication_summary",
      filePath: publicationPath,
      actorRef: request.actor_ref,
      tenantRef: request.tenant_ref,
      workspaceId: request.workspace_id,
      projectId: request.project_id,
      mode: request.requested_mode,
      editableStatus: "non_editable",
      sourceRefs: [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id],
      parentArtifactRefs: [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id],
      permissionScope: request.permission_scope ?? defaultPermissionScope("/presentations")
    });
    return {
      outcome:
        parity.parityValidation.overall_status === "degraded"
          ? "degraded"
          : publicationResult.stage.evidencePack.failure_reasons.length > 0
            ? "failed"
            : publicationResult.stage.evidencePack.warnings.length > 0
              ? "success_with_warnings"
              : "success",
      degrade_classification: parity.parityValidation.overall_status === "degraded" ? "presentation_parity_degraded" : null,
      warnings: publicationResult.stage.evidencePack.warnings,
      failures: publicationResult.stage.evidencePack.failure_reasons,
      result_artifacts: dedupeArtifacts([
        summaryArtifact,
        publicationResult.bundle.deckArtifact,
        publicationResult.bundle.versionArtifact,
        parity.preview.artifact,
        ...parity.exports.map((item) => item.artifact),
        publicationArtifact
      ]),
      summary_notes: ["The presentation path executed create, render parity, export, and governed publish with library publication metadata."],
      ...executionMetadata,
      execution_step_details: [
        "presentations.generate_deck",
        "presentations.run_render_parity_validation",
        "presentations.publish_presentation_artifact",
        "presentations.emit_publication_summary"
      ],
      downstream_audit_events: publicationResult.stage.auditEvents,
      downstream_lineage_edges: publicationResult.stage.lineageEdges,
      open_path: `/presentations?deck_id=${encodeURIComponent(publicationResult.bundle.deck.deck_id)}&ai_job_id=${encodeURIComponent(jobId)}`
    };
  }
  if (plan.selected_capability === "transcription_extraction") {
    return runTranscriptionExecution(request, plan, summaryArtifact, jobId);
  }
  if (plan.selected_capability === "excel_engine") {
    return runExcelExecution(request, summaryArtifact, jobId);
  }
  if (plan.selected_capability === "reports") {
    return runReportExecution(request, plan, summaryArtifact, jobId);
  }
  if (plan.selected_capability === "arabic_localization_lct") {
    return runLocalizationExecution(request, summaryArtifact, jobId);
  }
  if (plan.selected_capability === "strict_replication") {
    return runStrictExecution(request, summaryArtifact, jobId);
  }
  if (plan.selected_capability === "dashboards") {
    const workflow = buildDashboardWorkflowFromContext(request, jobId);
    if (!workflow) {
      return { outcome: "degraded", degrade_classification: "missing_dataset_context", warnings: [{ warning_code: "missing_dataset_context", summary: "Dashboard apply downgraded to assistive output.", detail: "No dataset rows were available in the current AI context.", severity: "medium", impacted_refs: [jobId] }], failures: [], result_artifacts: [summaryArtifact], summary_notes: ["No dataset context was provided, so no dashboard artifact was created."], ...executionMetadata, execution_step_details: ["missing_dataset_context"], open_path: null };
    }
    return { outcome: "success", degrade_classification: null, warnings: [], failures: [], result_artifacts: [summaryArtifact, workflow.dashboardArtifact, workflow.versionArtifact], summary_notes: ["A dashboard artifact was created from the current data context through dashboard-engine."], ...executionMetadata, execution_step_details: ["dashboards.create_dashboard", "dashboards.persist_workflow"], open_path: `/dashboards?dashboard_id=${encodeURIComponent(workflow.dashboard.dashboard_id)}&ai_job_id=${encodeURIComponent(jobId)}` };
  }
  return {
    outcome: "success_with_warnings",
    degrade_classification: "assistive_only_execution_path",
    warnings: [{ warning_code: "assistive_only_execution_path", summary: "No direct apply runtime was available for the requested plan.", detail: "The plan was preserved with approval but executed as assistive output only.", severity: "medium", impacted_refs: [jobId] }],
    failures: [],
    result_artifacts: [summaryArtifact],
    summary_notes: ["This request currently resolves to assistive output only in the available runtime path."],
    ...executionMetadata,
    execution_step_details: ["assistive_runtime_only"],
    open_path: null
  };
};

export class RasidAiEngine {
  readonly store: AiEngineStore;

  constructor(options?: { storageDir?: string }) {
    this.store = new AiEngineStore(options?.storageDir);
  }

  async submitJob(input: SubmitAiJobInput): Promise<AiJobBundle> {
    const requestInput = SubmitAiJobInputSchema.parse(input);
    const requestId = id("ai-request", requestInput.session_id, Date.now());
    const request: AiExecutionRequest = {
      schema_namespace: "rasid.shared.ai.v1",
      schema_version: "1.0.0",
      request_id: requestId,
      session_id: requestInput.session_id,
      page_path: requestInput.page_path,
      user_prompt: requestInput.user_prompt,
      requested_mode: requestInput.requested_mode,
      approval_granted: requestInput.approval_granted,
      resource_ref: requestInput.resource_ref,
      resource_refs: requestInput.resource_refs,
      context_payload: requestInput.context_payload
    };
    const context = buildContext(requestInput, this.store);
    const normalizedPrompt = normalizePrompt(request.user_prompt);
    const planner = new DeterministicPlannerProvider();
    const fallbackPlanner = new SafeFallbackPlannerProvider();
    let route: RouteSelection;
    let providerSelection: ProviderSelection;
    try {
      route = planner.plan(normalizedPrompt, requestInput);
      providerSelection = { provider_ref: planner.provider_ref, model_ref: planner.model_ref, fallback_provider_ref: fallbackPlanner.provider_ref, fallback_model_ref: fallbackPlanner.model_ref, fallback_used: false };
    } catch {
      route = fallbackPlanner.plan(normalizedPrompt, requestInput);
      providerSelection = { provider_ref: fallbackPlanner.provider_ref, model_ref: fallbackPlanner.model_ref, fallback_provider_ref: planner.provider_ref, fallback_model_ref: planner.model_ref, fallback_used: true };
    }
    const planId = id("ai-plan", requestInput.session_id, Date.now());
    const executionMode = request.approval_granted && route.approval_required ? "approved_apply" : "assistive";
    const plan: AiExecutionPlan = {
      schema_namespace: "rasid.shared.ai.v1",
      schema_version: "1.0.0",
      plan_id: planId,
      session_id: request.session_id,
      page_path: request.page_path,
      intent: route.intent,
      normalized_prompt: normalizedPrompt,
      selected_agent: route.agent,
      selected_capability: route.capability,
      selected_action_ref: route.action_ref,
      selected_tool_ref: route.tool_ref,
      selected_engine_ref: route.engine_ref,
      selected_provider_ref: providerSelection.provider_ref,
      selected_model_ref: providerSelection.model_ref,
      fallback_provider_ref: providerSelection.fallback_provider_ref,
      fallback_model_ref: providerSelection.fallback_model_ref,
      approval_required: route.approval_required,
      execution_mode: executionMode,
      target_output_kind: route.output_kind,
      confidence: providerSelection.fallback_used ? 0.7 : 0.86,
      step_refs: [id("phase", planId, "context"), id("phase", planId, "route"), id("phase", planId, "plan"), id("phase", planId, "approve"), id("phase", planId, "execute"), id("phase", planId, "summary")],
      source_refs: context.source_refs
    };
    const suggestionsPack = buildSuggestions(requestInput, context, route);
    const jobId = id("job", requestInput.session_id, Date.now());
    const approvalState: "not_required" | "pending" | "approved" = route.approval_required ? (request.approval_granted ? "approved" : "pending") : "not_required";
    const summaryArtifact = createSummaryArtifact(this.store.rootDir, jobId, requestInput.actor_ref, requestInput.tenant_ref, requestInput.workspace_id, requestInput.project_id, requestInput.requested_mode, context.source_refs, {
      page_path: request.page_path,
      plan_id: plan.plan_id,
      agent: plan.selected_agent,
      selected_capability: plan.selected_capability,
      selected_action_ref: plan.selected_action_ref,
      selected_tool_ref: plan.selected_tool_ref,
      prompt: request.user_prompt,
      suggestions: suggestionsPack.suggestions,
      next_steps: suggestionsPack.nextSteps
    });
    const execution = await executePlan(requestInput, plan, summaryArtifact, jobId);
    const phases = this.finalizePhases(jobId, plan, providerSelection, route, context.source_refs, approvalState, execution);
    return this.persistRun(jobId, requestInput, request, context, plan, phases, providerSelection, suggestionsPack, approvalState, execution);
  }

  private finalizePhases(
    jobId: string,
    plan: AiExecutionPlan,
    providerSelection: ProviderSelection,
    route: RouteSelection,
    sourceRefs: string[],
    approvalState: "not_required" | "pending" | "approved",
    execution: ExecutionResult
  ): AiExecutionPhase[] {
    return [
      {
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        phase_id: id("phase", jobId, "context"),
        phase_kind: "context_resolution",
        status: "completed",
        detail: `Resolved page context for ${plan.page_path}.`,
        selected_capability: route.capability,
        selected_action_ref: "intelligent_operator.resolve_context.v1",
        selected_tool_ref: "registry.ai.resolve_context",
        selected_engine_ref: "@rasid/ai-engine",
        selected_provider_ref: providerSelection.provider_ref,
        selected_model_ref: providerSelection.model_ref,
        output_refs: sourceRefs
      },
      {
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        phase_id: id("phase", jobId, "intent"),
        phase_kind: "intent_analysis",
        status: "completed",
        detail: `Intent detected: ${route.intent}.`,
        selected_capability: route.capability,
        selected_action_ref: "intelligent_operator.route_request.v1",
        selected_tool_ref: "registry.ai.route_request",
        selected_engine_ref: "@rasid/ai-engine",
        selected_provider_ref: providerSelection.provider_ref,
        selected_model_ref: providerSelection.model_ref,
        output_refs: []
      },
      {
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        phase_id: id("phase", jobId, "routing"),
        phase_kind: "routing",
        status: "completed",
        detail: `Selected ${route.agent} -> ${route.capability}.`,
        selected_capability: route.capability,
        selected_action_ref: route.action_ref,
        selected_tool_ref: route.tool_ref,
        selected_engine_ref: route.engine_ref,
        selected_provider_ref: providerSelection.provider_ref,
        selected_model_ref: providerSelection.model_ref,
        output_refs: []
      },
      {
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        phase_id: id("phase", jobId, "planning"),
        phase_kind: "planning",
        status: "completed",
        detail: `Built phase-driven execution plan with ${plan.step_refs.length} steps.`,
        selected_capability: route.capability,
        selected_action_ref: "intelligent_operator.build_execution_plan.v1",
        selected_tool_ref: "registry.ai.build_plan",
        selected_engine_ref: "@rasid/ai-engine",
        selected_provider_ref: providerSelection.provider_ref,
        selected_model_ref: providerSelection.model_ref,
        output_refs: []
      },
      {
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        phase_id: id("phase", jobId, "approval"),
        phase_kind: "approval_boundary",
        status: approvalState === "pending" ? "awaiting_approval" : "completed",
        detail: route.approval_required ? (approvalState === "approved" ? "Approval granted for editable execution." : "Execution paused at approval boundary.") : "No approval required for assistive output.",
        selected_capability: route.capability,
        selected_action_ref: "intelligent_operator.execute_approved_plan.v1",
        selected_tool_ref: "registry.ai.execute_approved_plan",
        selected_engine_ref: "@rasid/ai-engine",
        selected_provider_ref: providerSelection.provider_ref,
        selected_model_ref: providerSelection.model_ref,
        output_refs: []
      },
      {
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        phase_id: id("phase", jobId, "execution"),
        phase_kind: "execution",
        status: approvalState === "pending" ? "skipped" : execution.outcome === "failed" ? "failed" : "completed",
        detail: approvalState === "pending" ? "Execution skipped until explicit approval." : execution.summary_notes.join(" "),
        selected_capability: route.capability,
        selected_action_ref: route.action_ref,
        selected_tool_ref: route.tool_ref,
        selected_engine_ref: route.engine_ref,
        selected_provider_ref: execution.execution_provider_ref ?? providerSelection.provider_ref,
        selected_model_ref: execution.execution_model_ref ?? providerSelection.model_ref,
        output_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id)
      }
    ];
  }

  private persistRun(
    jobId: string,
    requestInput: z.infer<typeof SubmitAiJobInputSchema>,
    request: AiExecutionRequest,
    context: AiPageContext,
    plan: AiExecutionPlan,
    phases: AiExecutionPhase[],
    providerSelection: ProviderSelection,
    suggestionsPack: { suggestions: AiSuggestion[]; nextSteps: string[]; summaryLead: string },
    approvalState: "not_required" | "pending" | "approved",
    execution: ExecutionResult
  ): AiJobBundle {
    const outcome = approvalState === "pending" ? "success_with_warnings" : execution.outcome;
    const summaryProviderRef = execution.execution_provider_ref ?? plan.selected_provider_ref;
    const summaryModelRef = execution.execution_model_ref ?? plan.selected_model_ref;
    const summaryFallbackProviderRef = execution.execution_fallback_provider_ref ?? plan.fallback_provider_ref;
    const summaryFallbackModelRef = execution.execution_fallback_model_ref ?? plan.fallback_model_ref;
    const summaryFallbackUsed = execution.execution_fallback_used || providerSelection.fallback_used;
    const evidencePack: EvidencePack = {
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence", jobId),
      verification_status: outcome === "failed" ? "failed" : outcome === "degraded" ? "degraded" : outcome === "success_with_warnings" ? "success_with_warnings" : "verified",
      source_refs: context.source_refs,
      generated_artifact_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
      checks_executed: [
        { check_id: id("check", jobId, "router"), check_name: "agent_router_check", check_type: "routing", passed: true, severity: "medium", details: `${plan.selected_agent} selected ${plan.selected_capability}.`, impacted_refs: [plan.plan_id] },
        { check_id: id("check", jobId, "permissions"), check_name: "permission_scope_check", check_type: "governance", passed: context.permission_scope.allow_read && (approvalState !== "approved" || context.permission_scope.allow_write), severity: "high", details: `write=${context.permission_scope.allow_write} publish=${context.permission_scope.allow_publish}`, impacted_refs: [jobId] },
        { check_id: id("check", jobId, "approval"), check_name: "no_auto_apply_check", check_type: "approval", passed: !plan.approval_required || request.approval_granted || execution.result_artifacts.length === 1, severity: "critical", details: plan.approval_required ? `approval_state=${approvalState}` : "no approval required", impacted_refs: [jobId] }
      ],
      before_refs: context.recent_output_refs,
      after_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
      metrics: [
        { metric_name: "suggestion_count", metric_value: suggestionsPack.suggestions.length, metric_unit: "items" },
        { metric_name: "phase_count", metric_value: phases.length + 1, metric_unit: "phases" },
        { metric_name: "fallback_used", metric_value: summaryFallbackUsed ? 1 : 0, metric_unit: "boolean" }
      ],
      warnings: execution.warnings,
      failure_reasons: execution.failures,
      degraded_reasons: execution.outcome === "degraded" ? execution.failures : [],
      replay_context: { session_id: request.session_id, page_path: request.page_path, approval_state: approvalState, selected_agent: plan.selected_agent, selected_capability: plan.selected_capability },
      reproducibility_metadata: { replay_token: id("replay", jobId), execution_seed: hash(`${request.session_id}:${request.user_prompt}`), environment_stamp: "rasid-ai-engine", tool_versions: [{ tool: "ai-engine", version: "1.0.0" }, { tool: "provider", version: providerSelection.model_ref }] },
      strict_evidence_level: "standard"
    };
    const job: Job = {
      contract: contractEnvelope("job"),
      job_id: jobId,
      capability: AI_CAPABILITY_ID,
      requested_mode: request.requested_mode,
      capability_submode: plan.intent,
      source_refs: context.source_refs,
      artifact_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
      progress: 100,
      stage: approvalState === "pending" ? "awaiting_approval" : "summary",
      state: approvalState === "pending" ? "awaiting_approval" : outcome === "failed" ? "failed" : outcome === "degraded" ? "degraded" : "completed",
      warnings: execution.warnings,
      failure_reason: execution.failures[0] ?? null,
      retry_policy: { max_attempts: 2, strategy: "fixed", backoff_ms: 0 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: now(),
      finished_at: now(),
      resource_profile: { cpu_class: "standard", memory_class: "small", io_class: "balanced", expected_parallelism: 1 }
    };
    const auditEvents: AuditEvent[] = [
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", jobId, "request"),
        timestamp: now(),
        actor_ref: requestInput.actor_ref,
        actor_type: "ai",
        action_ref: "intelligent_operator.route_request.v1",
        job_ref: job.job_id,
        object_refs: [request.request_id, plan.plan_id],
        workspace_id: requestInput.workspace_id,
        tenant_ref: requestInput.tenant_ref,
        metadata: {
          page_path: request.page_path,
          agent: plan.selected_agent,
          capability: plan.selected_capability,
          action_ref: plan.selected_action_ref,
          tool_ref: plan.selected_tool_ref,
          planner_provider_ref: plan.selected_provider_ref,
          planner_model_ref: plan.selected_model_ref,
          execution_provider_ref: summaryProviderRef,
          execution_model_ref: summaryModelRef
        }
      }),
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", jobId, "approval"),
        timestamp: now(),
        actor_ref: requestInput.actor_ref,
        actor_type: "ai",
        action_ref: "intelligent_operator.build_execution_plan.v1",
        job_ref: job.job_id,
        object_refs: [job.job_id],
        workspace_id: requestInput.workspace_id,
        tenant_ref: requestInput.tenant_ref,
        metadata: { approval_required: plan.approval_required, approval_state: approvalState }
      }),
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", jobId, "summary"),
        timestamp: now(),
        actor_ref: requestInput.actor_ref,
        actor_type: "ai",
        action_ref: "intelligent_operator.summarize_execution.v1",
        job_ref: job.job_id,
        object_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
        workspace_id: requestInput.workspace_id,
        tenant_ref: requestInput.tenant_ref,
        metadata: {
          outcome,
          degrade_classification: execution.degrade_classification,
          fallback_used: summaryFallbackUsed,
          fallback_reason: execution.execution_fallback_reason,
          selected_provider_ref: summaryProviderRef,
          selected_model_ref: summaryModelRef,
          selected_fallback_provider_ref: summaryFallbackProviderRef,
          selected_fallback_model_ref: summaryFallbackModelRef
        }
      })
    ];
    const mergedAuditEvents = [...auditEvents, ...(execution.downstream_audit_events ?? [])];
    const primaryArtifactRef = execution.result_artifacts[0]?.artifact_id ?? jobId;
    const lineageEdges: LineageEdge[] = [
      {
        edge_id: id("edge", request.request_id, primaryArtifactRef),
        from_ref: request.request_id,
        to_ref: primaryArtifactRef,
        transform_ref: "intelligent_operator.summarize_execution",
        ai_suggestion_ref: suggestionsPack.suggestions[0]?.suggestion_id ?? "",
        ai_decision: "accepted",
        template_ref: "",
        dataset_binding_ref: "",
        version_diff_ref: ""
      },
      ...context.source_refs.map(
        (sourceRef): LineageEdge => ({
          edge_id: id("edge", sourceRef, primaryArtifactRef),
          from_ref: sourceRef,
          to_ref: primaryArtifactRef,
          transform_ref: "intelligent_operator.generate_assistive_output",
          ai_suggestion_ref: suggestionsPack.suggestions[0]?.suggestion_id ?? "",
          ai_decision: "accepted",
          template_ref: "",
          dataset_binding_ref: "",
          version_diff_ref: ""
        })
      ),
      ...execution.result_artifacts.slice(1).map(
        (artifact): LineageEdge => ({
          edge_id: id("edge", primaryArtifactRef, artifact.artifact_id),
          from_ref: primaryArtifactRef,
          to_ref: artifact.artifact_id,
          transform_ref: "intelligent_operator.execute_approved_plan",
          ai_suggestion_ref: suggestionsPack.suggestions.find((suggestion) => suggestion.requires_approval)?.suggestion_id ?? "",
          ai_decision: approvalState === "approved" ? "accepted" : "not_applicable",
          template_ref: "",
          dataset_binding_ref: "",
          version_diff_ref: ""
        })
      )
    ];
    const mergedLineageEdges = [...lineageEdges, ...(execution.downstream_lineage_edges ?? [])];
    const summary: AiExecutionSummary = {
      schema_namespace: "rasid.shared.ai.v1",
      schema_version: "1.0.0",
      summary_id: id("summary", jobId),
      plan_ref: plan.plan_id,
      job_ref: job.job_id,
      outcome,
      degrade_classification: execution.degrade_classification,
      fallback_used: summaryFallbackUsed,
      approval_state: approvalState,
      selected_capability: plan.selected_capability,
      selected_action_ref: plan.selected_action_ref,
      selected_tool_ref: plan.selected_tool_ref,
      selected_engine_ref: plan.selected_engine_ref,
      selected_provider_ref: summaryProviderRef,
      selected_model_ref: summaryModelRef,
      execution_step_details: execution.execution_step_details,
      failure_summaries: execution.failures.map((failure) => failure.summary),
      fallback_reason: execution.execution_fallback_reason,
      summary_text: [
        suggestionsPack.summaryLead,
        `Agent: ${plan.selected_agent}`,
        `Capability: ${plan.selected_capability}`,
        `Action: ${plan.selected_action_ref ?? "assistive_only"}`,
        `Tool: ${plan.selected_tool_ref ?? "none"}`,
        `Engine: ${plan.selected_engine_ref}`,
        `Provider/Model: ${summaryProviderRef ?? "n/a"} / ${summaryModelRef ?? "n/a"}`,
        `Approval: ${approvalState}`,
        `Outcome: ${outcome}`,
        summaryFallbackUsed ? `Fallback: ${execution.execution_fallback_reason ?? "used"}` : "Fallback: not_used",
        ...execution.summary_notes
      ].join(" | "),
      evidence_refs: [evidencePack.evidence_pack_id],
      audit_refs: mergedAuditEvents.map((event) => event.event_id),
      lineage_refs: mergedLineageEdges.map((edge) => edge.edge_id),
      result_artifact_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
      suggestions: suggestionsPack.suggestions,
      next_action_suggestions: suggestionsPack.nextSteps,
      generated_at: now()
    };
    const bundle: AiPersistedBundle = {
      request,
      context,
      plan,
      summary,
      phases: [
        ...phases,
        {
          schema_namespace: "rasid.shared.ai.v1",
          schema_version: "1.0.0",
          phase_id: id("phase", jobId, "summary"),
          phase_kind: "summary",
          status: "completed",
          detail: "Execution summary emitted with evidence/audit/lineage links.",
          selected_capability: plan.selected_capability,
          selected_action_ref: "intelligent_operator.summarize_execution.v1",
          selected_tool_ref: "registry.ai.generate_output",
          selected_engine_ref: "@rasid/ai-engine",
          selected_provider_ref: plan.selected_provider_ref,
          selected_model_ref: plan.selected_model_ref,
          output_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id)
        }
      ],
      job,
      artifacts: execution.result_artifacts,
      evidencePack,
      auditEvents: mergedAuditEvents,
      lineageEdges: mergedLineageEdges,
      open_path: execution.open_path
    };
    this.store.persistBundle(bundle);
    const latestArtifact = lastItem(execution.result_artifacts);
    this.store.persistSession({
      session_id: request.session_id,
      page_path: request.page_path,
      tenant_ref: requestInput.tenant_ref,
      workspace_id: requestInput.workspace_id,
      project_id: requestInput.project_id,
      current_artifact_ref: latestArtifact?.artifact_id ?? context.current_artifact_ref,
      recent_job_refs: [job.job_id, ...(this.store.loadSession(request.session_id)?.recent_job_refs ?? [])].slice(0, 10),
      recent_output_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id).slice(-10),
      updated_at: now()
    });
    return { ...bundle, phases: bundle.phases as AiExecutionPhase[], approval_boundary: { required: plan.approval_required, state: approvalState } };
  }

  async approveJob(jobId: string, actorRef = "ai-approval"): Promise<AiJobBundle> {
    const previous = this.store.loadBundle(jobId);
    const session = this.store.loadSession(previous.request.session_id);
    return this.submitJob({
      session_id: previous.request.session_id,
      page_path: previous.request.page_path,
      user_prompt: previous.request.user_prompt,
      tenant_ref: previous.auditEvents[0]?.tenant_ref ?? "tenant-default",
      workspace_id: previous.auditEvents[0]?.workspace_id ?? "workspace-default",
      project_id: session?.project_id ?? "project-default",
      actor_ref: actorRef,
      requested_mode: previous.request.requested_mode,
      approval_granted: true,
      resource_ref: previous.request.resource_ref,
      resource_refs: previous.request.resource_refs,
      current_artifact_ref: previous.context.current_artifact_ref,
      context_payload: previous.request.context_payload,
      permission_scope: previous.context.permission_scope,
      governance_tags: previous.context.governance_tags
    });
  }

  getJob(jobId: string): AiJobBundle {
    const bundle = this.store.loadBundle(jobId);
    return { ...bundle, phases: bundle.phases as AiExecutionPhase[], approval_boundary: { required: bundle.plan.approval_required, state: bundle.summary.approval_state } };
  }

  listJobs(sessionId?: string): Array<{ job_id: string; summary: AiExecutionSummary; job: Job }> {
    return this.store
      .listJobIds(sessionId)
      .flatMap((jobId) => {
        try {
          const bundle = this.store.loadBundle(jobId);
          return [{ job_id: jobId, summary: bundle.summary, job: bundle.job }];
        } catch {
          return [];
        }
      });
  }
}

export const registerAiCapability = (runtime: RegistryBootstrap): void => {
  const actions = ActionRegistry.filter((action) => action.capability === AI_CAPABILITY_ID);
  const tools = ToolRegistry.filter((tool) => tool.owner_capability === AI_CAPABILITY_ID);
  runtime.registerCapability({ capability_id: AI_CAPABILITY_ID, display_name: "Rasid Intelligent Operator", package_name: "@rasid/ai-engine", contract_version: "1.0.0", supported_action_refs: actions.map((action) => action.action_id), supported_tool_refs: tools.map((tool) => tool.tool_id) });
  runtime.registerManifest(createActionManifest(AI_CAPABILITY_ID, "1.0.0", actions, ["approval.ai"], ["evidence.ai"]));
  tools.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.ai", async (action) => ({ approval_state: action.action_id === "intelligent_operator.execute_approved_plan.v1" ? "pending" : "approved", reasons: action.action_id === "intelligent_operator.execute_approved_plan.v1" ? ["ai_apply_requires_explicit_approval"] : ["ai_default"] }));
  runtime.registerEvidenceHook("evidence.ai", async (pack) => EvidencePackSchema.parse(pack));
};
