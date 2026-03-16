"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAiCapability = exports.RasidAiEngine = exports.defaultAiEngineStorageRoot = exports.AiEngineStore = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const capability_registry_1 = require("@rasid/capability-registry");
const dashboard_engine_1 = require("@rasid/dashboard-engine");
const presentations_engine_1 = require("@rasid/presentations-engine");
const contracts_1 = require("@rasid/contracts");
const zod_1 = require("zod");
const store_1 = require("./store");
var store_2 = require("./store");
Object.defineProperty(exports, "AiEngineStore", { enumerable: true, get: function () { return store_2.AiEngineStore; } });
Object.defineProperty(exports, "defaultAiEngineStorageRoot", { enumerable: true, get: function () { return store_2.defaultAiEngineStorageRoot; } });
const JsonRecordSchema = zod_1.z.record(zod_1.z.unknown());
const SubmitAiJobInputSchema = zod_1.z.object({
    session_id: zod_1.z.string(),
    page_path: zod_1.z.enum([
        "/home",
        "/data",
        "/excel",
        "/dashboards",
        "/reports",
        "/presentations",
        "/replication",
        "/localization",
        "/library",
        "/governance"
    ]),
    user_prompt: zod_1.z.string(),
    tenant_ref: zod_1.z.string(),
    workspace_id: zod_1.z.string(),
    project_id: zod_1.z.string(),
    actor_ref: zod_1.z.string(),
    requested_mode: zod_1.z.enum(["easy", "advanced"]).default("advanced"),
    approval_granted: zod_1.z.boolean().default(false),
    resource_ref: zod_1.z.string().nullable().default(null),
    resource_refs: zod_1.z.array(zod_1.z.string()).default([]),
    current_artifact_ref: zod_1.z.string().nullable().default(null),
    context_payload: JsonRecordSchema.default({}),
    permission_scope: zod_1.z
        .object({
        visibility: zod_1.z.enum(["private", "workspace", "tenant", "shared_link"]),
        allow_read: zod_1.z.boolean(),
        allow_write: zod_1.z.boolean(),
        allow_share: zod_1.z.boolean(),
        allow_publish: zod_1.z.boolean(),
        allow_audit_view: zod_1.z.boolean()
    })
        .optional(),
    governance_tags: zod_1.z.array(zod_1.z.string()).default([])
});
const pageLabels = {
    "/home": "Home",
    "/data": "Data",
    "/excel": "Excel",
    "/dashboards": "Dashboards",
    "/reports": "Reports",
    "/presentations": "Presentations",
    "/replication": "Replication",
    "/localization": "Localization",
    "/library": "Library",
    "/governance": "Governance"
};
const pageCapabilityHints = {
    "/home": "platform_assistant",
    "/data": "data_analysis",
    "/excel": "workbook_assistance",
    "/dashboards": "dashboard_orchestration",
    "/reports": "report_assistance",
    "/presentations": "presentation_assistance",
    "/replication": "strict_replication_assistance",
    "/localization": "localization_assistance",
    "/library": "library_navigation",
    "/governance": "governance_assistance"
};
const now = () => new Date().toISOString();
const id = (prefix, ...parts) => [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
const hash = (value) => (0, node_crypto_1.createHash)("sha256").update(value).digest("hex");
const normalizePrompt = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
const hasAny = (value, patterns) => patterns.some((pattern) => value.includes(pattern));
const isMutatingPrompt = (prompt) => hasAny(prompt, ["create", "build", "generate", "publish", "apply", "convert", "أنش", "ابن", "ول", "حو", "انشر", "طب", "نف", "عد"]);
const defaultPermissionScope = (pagePath) => pagePath === "/governance"
    ? { visibility: "workspace", allow_read: true, allow_write: false, allow_share: false, allow_publish: false, allow_audit_view: true }
    : pagePath === "/library" || pagePath === "/home"
        ? { visibility: "workspace", allow_read: true, allow_write: false, allow_share: false, allow_publish: false, allow_audit_view: true }
        : { visibility: "workspace", allow_read: true, allow_write: true, allow_share: true, allow_publish: true, allow_audit_view: true };
const extractDatasetProfile = (rows) => {
    const fieldNames = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const numericFields = fieldNames.filter((fieldName) => rows.some((row) => typeof row[fieldName] === "number" || (typeof row[fieldName] === "string" && row[fieldName] !== "" && !Number.isNaN(Number(row[fieldName])))));
    const categoricalFields = fieldNames.filter((fieldName) => !numericFields.includes(fieldName));
    return { fieldNames, numericFields, categoricalFields };
};
const createSummaryArtifact = (rootDir, jobId, actorRef, tenantRef, workspaceId, projectId, mode, sourceRefs, content) => {
    const outputPath = node_path_1.default.join(rootDir, "jobs", jobId, "outputs", "ai-summary.json");
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(outputPath), { recursive: true });
    node_fs_1.default.writeFileSync(outputPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
    return {
        contract: (0, contracts_1.contractEnvelope)("artifact"),
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
    constructor() {
        this.provider_ref = "provider://rasid/deterministic";
        this.model_ref = "model://rasid/phase-router-v1";
    }
    plan(prompt, request) {
        if (prompt.includes("[force-provider-fail]")) {
            throw new Error("forced_provider_failure");
        }
        return selectRoute(prompt, request.page_path);
    }
}
class SafeFallbackPlannerProvider {
    constructor() {
        this.provider_ref = "provider://rasid/fallback";
        this.model_ref = "model://rasid/safe-summary-v1";
    }
    plan(prompt, request) {
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
const selectRoute = (normalizedPrompt, pagePath) => {
    if (pagePath === "/excel" || hasAny(normalizedPrompt, ["excel", "workbook", "formula", "pivot", "chart", "xlsx", "sheet"])) {
        if (hasAny(normalizedPrompt, ["formula", "معاد"])) {
            return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.recalculate_formulas.v1", tool_ref: "excel_engine.recalculate_formulas", engine_ref: "@rasid/excel-engine", output_kind: "suggestion_pack", approval_required: false, intent: "formula_assistance" };
        }
        if (hasAny(normalizedPrompt, ["pivot", "محور"])) {
            return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.generate_pivot.v1", tool_ref: "excel_engine.generate_pivot", engine_ref: "@rasid/excel-engine", output_kind: "suggestion_pack", approval_required: false, intent: "pivot_assistance" };
        }
        if (hasAny(normalizedPrompt, ["chart", "visual", "رسم"])) {
            return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.generate_chart.v1", tool_ref: "excel_engine.generate_chart", engine_ref: "@rasid/excel-engine", output_kind: "suggestion_pack", approval_required: false, intent: "chart_assistance" };
        }
        return { agent: "excel_assistant", capability: "excel_engine", action_ref: "excel_engine.apply_transformation.v1", tool_ref: "excel_engine.apply_transformation", engine_ref: "@rasid/excel-engine", output_kind: "suggestion_pack", approval_required: isMutatingPrompt(normalizedPrompt), intent: "workbook_cleanup" };
    }
    if (pagePath === "/dashboards" || hasAny(normalizedPrompt, ["dashboard", "widget", "filter", "visualization", "لوحة", "مؤشر"])) {
        if (hasAny(normalizedPrompt, ["compare", "قارن"])) {
            return { agent: "dashboard_assistant", capability: "dashboards", action_ref: "dashboard.compare_versions.v1", tool_ref: "registry.dashboard.interaction.compare", engine_ref: "@rasid/dashboard-engine", output_kind: "suggestion_pack", approval_required: false, intent: "dashboard_compare" };
        }
        return { agent: "dashboard_assistant", capability: "dashboards", action_ref: "dashboard.create.v1", tool_ref: "registry.dashboard.create", engine_ref: "@rasid/dashboard-engine", output_kind: "dashboard", approval_required: true, intent: "dashboard_assistance" };
    }
    if (pagePath === "/reports" || hasAny(normalizedPrompt, ["report", "summary", "narrative", "schedule", "تقرير", "ملخص"])) {
        if (hasAny(normalizedPrompt, ["presentation", "slides", "عرض", "شرائح", "حول"])) {
            return { agent: "reporting_assistant", capability: "reports", action_ref: "reports.convert_report_to_presentation.v1", tool_ref: "registry.reports.convert_report_to_presentation", engine_ref: "@rasid/report-engine", output_kind: "presentation", approval_required: true, intent: "report_to_presentation" };
        }
        return { agent: "reporting_assistant", capability: "reports", action_ref: "reports.create_report.v1", tool_ref: "registry.reports.create_report", engine_ref: "@rasid/report-engine", output_kind: "suggestion_pack", approval_required: false, intent: "report_assistance" };
    }
    if (pagePath === "/presentations" || hasAny(normalizedPrompt, ["presentation", "slide", "deck", "عرض", "شريحة"])) {
        return { agent: "presentation_assistant", capability: "presentations", action_ref: "presentations.generate_deck.v1", tool_ref: null, engine_ref: "@rasid/presentations-engine", output_kind: "presentation", approval_required: true, intent: "presentation_generation" };
    }
    if (pagePath === "/localization" || hasAny(normalizedPrompt, ["localization", "rtl", "locale", "translate", "تعريب", "مصطلح"])) {
        return { agent: "localization_assistant", capability: "arabic_localization_lct", action_ref: "arabic_localization_lct.build_localization_plan.v1", tool_ref: "registry.localization.build_localization_plan", engine_ref: "@rasid/arabic-localization-lct-engine", output_kind: "suggestion_pack", approval_required: false, intent: "localization_assistance" };
    }
    if (pagePath === "/replication" || hasAny(normalizedPrompt, ["replication", "strict", "verification", "diff", "مطابقة", "تحقق"])) {
        return { agent: "replication_aware_assistant", capability: "strict_replication", action_ref: "strict.run_round_trip_validation.v1", tool_ref: "registry.strict.run_round_trip_validation", engine_ref: "@rasid/strict-replication-engine", output_kind: "suggestion_pack", approval_required: false, intent: "replication_diagnosis" };
    }
    if (pagePath === "/governance" || hasAny(normalizedPrompt, ["governance", "permission", "audit", "lineage", "حوكمة", "صلاح"])) {
        return { agent: "governance_aware_assistant", capability: contracts_1.AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "governance_assistance" };
    }
    if (hasAny(normalizedPrompt, ["file", "document", "pdf", "docx", "xlsx", "ملف", "مستند"])) {
        return { agent: "document_file_understanding_assistant", capability: contracts_1.AI_CAPABILITY_ID, action_ref: "intelligent_operator.generate_assistive_output.v1", tool_ref: "registry.ai.generate_output", engine_ref: "@rasid/ai-engine", output_kind: "suggestion_pack", approval_required: false, intent: "document_understanding" };
    }
    return { agent: "data_analyst_agent", capability: "dashboards", action_ref: "dashboard.create.v1", tool_ref: "registry.dashboard.create", engine_ref: "@rasid/dashboard-engine", output_kind: "suggestion_pack", approval_required: false, intent: "data_analysis" };
};
const sessionMemory = (store, request) => {
    const existing = store.loadSession(request.session_id);
    if (!existing || existing.page_path !== request.page_path || existing.tenant_ref !== request.tenant_ref) {
        return null;
    }
    return existing;
};
const buildContext = (request, store) => {
    const memory = sessionMemory(store, request);
    return {
        contract: contracts_1.AI_CONTRACT,
        schema_namespace: "rasid.shared.ai.v1",
        schema_version: "1.0.0",
        session_id: request.session_id,
        page_path: request.page_path,
        page_label: pageLabels[request.page_path],
        capability_hint: pageCapabilityHints[request.page_path],
        current_artifact_ref: request.current_artifact_ref,
        source_refs: [...new Set([...(request.resource_ref ? [request.resource_ref] : []), ...request.resource_refs])],
        recent_output_refs: memory?.recent_output_refs ?? [],
        permission_scope: request.permission_scope ?? defaultPermissionScope(request.page_path),
        governance_tags: [...new Set([request.page_path.replace("/", "page:"), ...request.governance_tags])],
        memory_scope: request.page_path === "/home" || request.page_path === "/library" ? "workspace_scoped" : "page_isolated"
    };
};
const makeSuggestion = (summaryId, index, category, title, detail, confidence, requiresApproval = false, proposedActionRef = null, targetRefs = []) => ({
    contract: contracts_1.AI_CONTRACT,
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
const buildSuggestions = (request, context, route) => {
    const summaryId = id("summary", request.session_id, hash(request.user_prompt).slice(0, 8));
    const payload = request.context_payload ?? {};
    const datasetRows = Array.isArray(payload["dataset_rows"]) ? payload["dataset_rows"] : [];
    const datasetProfile = datasetRows.length > 0 ? extractDatasetProfile(datasetRows) : null;
    const dashboardSnapshot = payload["dashboard_snapshot"];
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
const buildDashboardWorkflowFromContext = (request, jobId) => {
    const datasetRows = Array.isArray(request.context_payload["dataset_rows"]) ? request.context_payload["dataset_rows"] : [];
    if (datasetRows.length === 0) {
        return null;
    }
    const datasetProfile = extractDatasetProfile(datasetRows);
    const numericField = datasetProfile.numericFields[0] ?? datasetProfile.fieldNames[0] ?? "value";
    const dimensionField = datasetProfile.categoricalFields[0] ?? datasetProfile.fieldNames[0] ?? "label";
    const datasetRef = request.resource_ref ?? id("dataset", jobId);
    const engine = new dashboard_engine_1.DashboardEngine({ storageDir: node_path_1.default.join(process.cwd(), ".runtime", "ai-engine-dashboard") });
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
        ],
        filters: [
            {
                schema_namespace: "rasid.shared.dashboard.v1",
                schema_version: "1.0.0",
                dataset_ref: datasetRef,
                field_ref: dimensionField,
                filter_kind: "categorical",
                filter_scope: "global",
                current_values: [],
                target_widget_refs: []
            }
        ],
        template_ref: "template://dashboards/ai-generated",
        brand_preset_ref: "brand://rasid/dashboard",
        permission_scope: request.permission_scope ?? defaultPermissionScope("/dashboards")
    });
};
const executePlan = async (request, plan, summaryArtifact, jobId) => {
    if (plan.execution_mode !== "approved_apply") {
        return { outcome: "success", degrade_classification: null, warnings: [], failures: [], result_artifacts: [summaryArtifact], summary_notes: ["Assistive path only; no editable artifact was changed."], open_path: null };
    }
    if (!(request.permission_scope ?? defaultPermissionScope(request.page_path)).allow_write && plan.target_output_kind !== "suggestion_pack") {
        return {
            outcome: "failed",
            degrade_classification: "permission_denied",
            warnings: [],
            failures: [{ reason_code: "permission_denied", summary: "Execution blocked by permission scope.", detail: "The current page context does not allow write operations.", impacted_refs: [jobId], retryable: false }],
            result_artifacts: [summaryArtifact],
            summary_notes: ["The plan required write permission but the current surface is read-only."],
            open_path: null
        };
    }
    if (plan.selected_capability === "presentations" || plan.action_ref === "reports.convert_report_to_presentation.v1") {
        const engine = new presentations_engine_1.PresentationEngine();
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
        return { outcome: "success", degrade_classification: null, warnings: [], failures: [], result_artifacts: [summaryArtifact, bundle.deckArtifact, bundle.versionArtifact], summary_notes: ["An editable presentation bundle was generated through presentations-engine."], open_path: `/presentations?artifact_ref=${encodeURIComponent(bundle.deckArtifact.artifact_id)}&ai_job_id=${encodeURIComponent(jobId)}` };
    }
    if (plan.selected_capability === "dashboards") {
        const workflow = buildDashboardWorkflowFromContext(request, jobId);
        if (!workflow) {
            return { outcome: "degraded", degrade_classification: "missing_dataset_context", warnings: [{ warning_code: "missing_dataset_context", summary: "Dashboard apply downgraded to assistive output.", detail: "No dataset rows were available in the current AI context.", severity: "medium", impacted_refs: [jobId] }], failures: [], result_artifacts: [summaryArtifact], summary_notes: ["No dataset context was provided, so no dashboard artifact was created."], open_path: null };
        }
        return { outcome: "success", degrade_classification: null, warnings: [], failures: [], result_artifacts: [summaryArtifact, workflow.dashboardArtifact, workflow.versionArtifact], summary_notes: ["A dashboard artifact was created from the current data context through dashboard-engine."], open_path: `/dashboards?dashboard_id=${encodeURIComponent(workflow.dashboard.dashboard_id)}&ai_job_id=${encodeURIComponent(jobId)}` };
    }
    return {
        outcome: "success_with_warnings",
        degrade_classification: "assistive_only_execution_path",
        warnings: [{ warning_code: "assistive_only_execution_path", summary: "No direct apply runtime was available for the requested plan.", detail: "The plan was preserved with approval but executed as assistive output only.", severity: "medium", impacted_refs: [jobId] }],
        failures: [],
        result_artifacts: [summaryArtifact],
        summary_notes: ["This request currently resolves to assistive output only in the available runtime path."],
        open_path: null
    };
};
class RasidAiEngine {
    constructor(options) {
        this.store = new store_1.AiEngineStore(options?.storageDir);
    }
    async submitJob(input) {
        const requestInput = SubmitAiJobInputSchema.parse(input);
        const requestId = id("ai-request", requestInput.session_id, Date.now());
        const request = {
            contract: contracts_1.AI_CONTRACT,
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
        let route;
        let providerSelection;
        try {
            route = planner.plan(normalizedPrompt, requestInput);
            providerSelection = { provider_ref: planner.provider_ref, model_ref: planner.model_ref, fallback_provider_ref: fallbackPlanner.provider_ref, fallback_model_ref: fallbackPlanner.model_ref, fallback_used: false };
        }
        catch {
            route = fallbackPlanner.plan(normalizedPrompt, requestInput);
            providerSelection = { provider_ref: fallbackPlanner.provider_ref, model_ref: fallbackPlanner.model_ref, fallback_provider_ref: planner.provider_ref, fallback_model_ref: planner.model_ref, fallback_used: true };
        }
        const planId = id("ai-plan", requestInput.session_id, Date.now());
        const executionMode = request.approval_granted && route.approval_required ? "approved_apply" : "assistive";
        const plan = {
            contract: contracts_1.AI_CONTRACT,
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
        const approvalState = route.approval_required ? (request.approval_granted ? "approved" : "pending") : "not_required";
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
    finalizePhases(jobId, plan, providerSelection, route, sourceRefs, approvalState, execution) {
        return [
            {
                contract: contracts_1.AI_CONTRACT,
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
                contract: contracts_1.AI_CONTRACT,
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
                contract: contracts_1.AI_CONTRACT,
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
                contract: contracts_1.AI_CONTRACT,
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
                contract: contracts_1.AI_CONTRACT,
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
                contract: contracts_1.AI_CONTRACT,
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
                selected_provider_ref: providerSelection.provider_ref,
                selected_model_ref: providerSelection.model_ref,
                output_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id)
            }
        ];
    }
    persistRun(jobId, requestInput, request, context, plan, phases, providerSelection, suggestionsPack, approvalState, execution) {
        const outcome = approvalState === "pending" ? "success_with_warnings" : execution.outcome;
        const evidencePack = {
            contract: (0, contracts_1.contractEnvelope)("evidence"),
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
                { metric_name: "fallback_used", metric_value: providerSelection.fallback_used ? 1 : 0, metric_unit: "boolean" }
            ],
            warnings: execution.warnings,
            failure_reasons: execution.failures,
            degraded_reasons: execution.outcome === "degraded" ? execution.failures : [],
            replay_context: { session_id: request.session_id, page_path: request.page_path, approval_state: approvalState, selected_agent: plan.selected_agent, selected_capability: plan.selected_capability },
            reproducibility_metadata: { replay_token: id("replay", jobId), execution_seed: hash(`${request.session_id}:${request.user_prompt}`), environment_stamp: "rasid-ai-engine", tool_versions: [{ tool: "ai-engine", version: "1.0.0" }, { tool: "provider", version: providerSelection.model_ref }] },
            strict_evidence_level: "standard"
        };
        const job = {
            contract: (0, contracts_1.contractEnvelope)("job"),
            job_id: jobId,
            capability: contracts_1.AI_CAPABILITY_ID,
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
        const auditEvents = [
            contracts_1.AuditEventSchema.parse({
                contract: (0, contracts_1.contractEnvelope)("audit"),
                event_id: id("audit", jobId, "request"),
                timestamp: now(),
                actor_ref: requestInput.actor_ref,
                actor_type: "ai",
                action_ref: "intelligent_operator.route_request.v1",
                job_ref: job.job_id,
                object_refs: [request.request_id, plan.plan_id],
                workspace_id: requestInput.workspace_id,
                tenant_ref: requestInput.tenant_ref,
                metadata: { page_path: request.page_path, agent: plan.selected_agent, capability: plan.selected_capability, action_ref: plan.selected_action_ref, tool_ref: plan.selected_tool_ref, provider_ref: plan.selected_provider_ref, model_ref: plan.selected_model_ref }
            }),
            contracts_1.AuditEventSchema.parse({
                contract: (0, contracts_1.contractEnvelope)("audit"),
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
            contracts_1.AuditEventSchema.parse({
                contract: (0, contracts_1.contractEnvelope)("audit"),
                event_id: id("audit", jobId, "summary"),
                timestamp: now(),
                actor_ref: requestInput.actor_ref,
                actor_type: "ai",
                action_ref: "intelligent_operator.summarize_execution.v1",
                job_ref: job.job_id,
                object_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
                workspace_id: requestInput.workspace_id,
                tenant_ref: requestInput.tenant_ref,
                metadata: { outcome, degrade_classification: execution.degrade_classification, fallback_used: providerSelection.fallback_used }
            })
        ];
        const lineageEdges = [
            ...context.source_refs.map((sourceRef) => ({ edge_id: id("edge", sourceRef, execution.result_artifacts[0]?.artifact_id ?? jobId), from_ref: sourceRef, to_ref: execution.result_artifacts[0]?.artifact_id ?? jobId, transform_ref: "intelligent_operator.generate_assistive_output", ai_suggestion_ref: suggestionsPack.suggestions[0]?.suggestion_id ?? "", ai_decision: "accepted", template_ref: "", dataset_binding_ref: "", version_diff_ref: "" })),
            ...execution.result_artifacts.slice(1).map((artifact) => ({ edge_id: id("edge", execution.result_artifacts[0]?.artifact_id ?? jobId, artifact.artifact_id), from_ref: execution.result_artifacts[0]?.artifact_id ?? jobId, to_ref: artifact.artifact_id, transform_ref: "intelligent_operator.execute_approved_plan", ai_suggestion_ref: suggestionsPack.suggestions.find((suggestion) => suggestion.requires_approval)?.suggestion_id ?? "", ai_decision: approvalState === "approved" ? "accepted" : "not_applicable", template_ref: "", dataset_binding_ref: "", version_diff_ref: "" }))
        ];
        const summary = {
            contract: contracts_1.AI_CONTRACT,
            schema_namespace: "rasid.shared.ai.v1",
            schema_version: "1.0.0",
            summary_id: id("summary", jobId),
            plan_ref: plan.plan_id,
            job_ref: job.job_id,
            outcome,
            degrade_classification: execution.degrade_classification,
            fallback_used: providerSelection.fallback_used,
            approval_state: approvalState,
            summary_text: [suggestionsPack.summaryLead, `Agent: ${plan.selected_agent}`, `Capability: ${plan.selected_capability}`, `Action: ${plan.selected_action_ref ?? "assistive_only"}`, `Tool: ${plan.selected_tool_ref ?? "none"}`, `Provider/Model: ${plan.selected_provider_ref} / ${plan.selected_model_ref}`, providerSelection.fallback_used ? "Fallback path was used." : "Primary provider path succeeded.", ...execution.summary_notes].join(" | "),
            evidence_refs: [evidencePack.evidence_pack_id],
            audit_refs: auditEvents.map((event) => event.event_id),
            lineage_refs: lineageEdges.map((edge) => edge.edge_id),
            result_artifact_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id),
            suggestions: suggestionsPack.suggestions,
            next_action_suggestions: suggestionsPack.nextSteps,
            generated_at: now()
        };
        const bundle = { request, context, plan, summary, phases: [...phases, { contract: contracts_1.AI_CONTRACT, schema_namespace: "rasid.shared.ai.v1", schema_version: "1.0.0", phase_id: id("phase", jobId, "summary"), phase_kind: "summary", status: "completed", detail: "Execution summary emitted with evidence/audit/lineage links.", selected_capability: plan.selected_capability, selected_action_ref: "intelligent_operator.summarize_execution.v1", selected_tool_ref: "registry.ai.generate_output", selected_engine_ref: "@rasid/ai-engine", selected_provider_ref: plan.selected_provider_ref, selected_model_ref: plan.selected_model_ref, output_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id) }], job, artifacts: execution.result_artifacts, evidencePack, auditEvents, lineageEdges, open_path: execution.open_path };
        this.store.persistBundle(bundle);
        this.store.persistSession({
            session_id: request.session_id,
            page_path: request.page_path,
            tenant_ref: requestInput.tenant_ref,
            workspace_id: requestInput.workspace_id,
            project_id: requestInput.project_id,
            current_artifact_ref: execution.result_artifacts.at(-1)?.artifact_id ?? request.current_artifact_ref,
            recent_job_refs: [job.job_id, ...(this.store.loadSession(request.session_id)?.recent_job_refs ?? [])].slice(0, 10),
            recent_output_refs: execution.result_artifacts.map((artifact) => artifact.artifact_id).slice(-10),
            updated_at: now()
        });
        return { ...bundle, phases: bundle.phases, approval_boundary: { required: plan.approval_required, state: approvalState } };
    }
    async approveJob(jobId, actorRef = "ai-approval") {
        const previous = this.store.loadBundle(jobId);
        return this.submitJob({
            session_id: previous.request.session_id,
            page_path: previous.request.page_path,
            user_prompt: previous.request.user_prompt,
            tenant_ref: previous.auditEvents[0]?.tenant_ref ?? "tenant-default",
            workspace_id: previous.auditEvents[0]?.workspace_id ?? "workspace-default",
            project_id: previous.context.current_artifact_ref ?? "project-default",
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
    getJob(jobId) {
        const bundle = this.store.loadBundle(jobId);
        return { ...bundle, phases: bundle.phases, approval_boundary: { required: bundle.plan.approval_required, state: bundle.summary.approval_state } };
    }
    listJobs(sessionId) {
        return this.store.listJobIds(sessionId).map((jobId) => {
            const bundle = this.store.loadBundle(jobId);
            return { job_id: jobId, summary: bundle.summary, job: bundle.job };
        });
    }
}
exports.RasidAiEngine = RasidAiEngine;
const registerAiCapability = (runtime) => {
    const actions = contracts_1.ActionRegistry.filter((action) => action.capability === contracts_1.AI_CAPABILITY_ID);
    const tools = contracts_1.ToolRegistry.filter((tool) => tool.owner_capability === contracts_1.AI_CAPABILITY_ID);
    runtime.registerCapability({ capability_id: contracts_1.AI_CAPABILITY_ID, display_name: "Rasid Intelligent Operator", package_name: "@rasid/ai-engine", contract_version: "1.0.0", supported_action_refs: actions.map((action) => action.action_id), supported_tool_refs: tools.map((tool) => tool.tool_id) });
    runtime.registerManifest((0, capability_registry_1.createActionManifest)(contracts_1.AI_CAPABILITY_ID, "1.0.0", actions, ["approval.ai"], ["evidence.ai"]));
    tools.forEach((tool) => runtime.registerTool(tool));
    runtime.registerApprovalHook("approval.ai", async (action) => ({ approval_state: action.action_id === "intelligent_operator.execute_approved_plan.v1" ? "pending" : "approved", reasons: action.action_id === "intelligent_operator.execute_approved_plan.v1" ? ["ai_apply_requires_explicit_approval"] : ["ai_default"] }));
    runtime.registerEvidenceHook("evidence.ai", async (pack) => contracts_1.EvidencePackSchema.parse(pack));
};
exports.registerAiCapability = registerAiCapability;
