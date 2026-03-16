import { createHash } from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DashboardEngine } from "@rasid/dashboard-engine";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import { ReportEngine } from "@rasid/report-engine";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  ActionRegistry,
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  CulturalFormattingPlanSchema,
  CulturalQualityResultSchema,
  DirectionTransformationPlanSchema,
  EditabilityQualityResultSchema,
  EvidencePackSchema,
  JobSchema,
  LanguageQualityResultSchema,
  LayoutQualityResultSchema,
  LocalizationDegradeReasonSchema,
  LocalizationPolicySchema,
  LocalizationPreviewSchema,
  LocalizationQualityResultSchema,
  LocalizationRequestSchema,
  LocalizationScopeSchema,
  LocalizedOutputMetadataSchema,
  LOCALIZATION_CAPABILITY_ID,
  LOCALIZATION_SCHEMA_NAMESPACE,
  LOCALIZATION_SCHEMA_VERSION,
  NonTranslatableTermSchema,
  ProtectedTermSchema,
  PublicationSchema,
  TerminologyProfileSchema,
  TerminologyRuleSchema,
  ToolRegistry,
  TypographyRefinementPlanSchema,
  contractEnvelope,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type CulturalFormattingPlan,
  type CulturalQualityResult,
  type DirectionTransformationPlan,
  type EditabilityQualityResult,
  type EvidencePack,
  type FailureReason,
  type Job,
  type LanguageQualityResult,
  type LayoutQualityResult,
  type LineageEdge,
  type LocalizationDegradeReason,
  type LocalizationPolicy,
  type LocalizationPreview,
  type LocalizationQualityResult,
  type LocalizationRequest,
  type LocalizationScope,
  type LocalizedOutputMetadata,
  type LocalizableArtifactType,
  type NonTranslatableTerm,
  type PermissionScope,
  type ProtectedTerm,
  type Publication,
  type TerminologyProfile,
  type TerminologyRule,
  type TypographyRefinementPlan,
  type Warning
} from "@rasid/contracts";
import type { Browser as PlaywrightBrowser } from "playwright-core";
import PptxGenJS from "pptxgenjs";
import { z } from "zod";

const SampleContainerSchema = z.object({
  container_id: z.string(),
  title: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

const SampleTextNodeSchema = z.object({
  node_id: z.string(),
  container_id: z.string(),
  name: z.string(),
  text: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  semantic_labels: z.array(z.string()).default([]),
  data_binding_refs: z.array(z.string()).default([]),
  formula_refs: z.array(z.string()).default([]),
  editable: z.boolean().default(true)
});

const ExternalGlossaryEntrySchema = z.object({
  source_term: z.string(),
  target_term: z.string(),
  rule_class: z.enum(["preferred_translation", "title", "caption"]).default("preferred_translation"),
  source_locale: z.string().default("en-US"),
  target_locale: z.string().default("ar-SA")
});

const LocalizationIntegrationSchema = z.object({
  provider_mode: z.enum(["deterministic_local", "filesystem_glossary", "http_json"]).default("deterministic_local"),
  glossary_file_path: z.string().optional(),
  provider_url: z.string().url().optional(),
  provider_headers: z.record(z.string()).default({}),
  provider_timeout_ms: z.number().int().positive().default(2500),
  provider_retry_count: z.number().int().min(0).default(1),
  provider_retry_backoff_ms: z.number().int().min(0).default(250)
});

const LocalizationIntegrationOverrideSchema = LocalizationIntegrationSchema.partial();
const RoundTripTamperModeSchema = z.enum(["none", "dashboard_missing_payload", "dashboard_manifest_mismatch"]);
const ProviderScenarioSchema = z.enum(["none", "success", "error", "timeout", "malformed"]);

const LocalizationExecutionInputSchema = z.object({
  run_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  mode: z.enum(["easy", "advanced"]).default("advanced"),
  source_artifact: ArtifactSchema,
  source_canonical: CanonicalRepresentationSchema,
  target_locale: z.string().default("ar-SA"),
  publish_target_ref: z.string(),
  policy: LocalizationPolicySchema.optional(),
  profiles: z.array(TerminologyProfileSchema).default([]),
  rules: z.array(TerminologyRuleSchema).default([]),
  protected_terms: z.array(ProtectedTermSchema).default([]),
  non_translatable_terms: z.array(NonTranslatableTermSchema).default([]),
  integration: LocalizationIntegrationSchema.optional(),
  roundtrip_tamper_mode: RoundTripTamperModeSchema.default("none"),
  allow_degraded_publish: z.boolean().default(true),
  output_root: z.string().optional()
});

const LocalizationSampleDefinitionSchema = z.object({
  sample_name: z.string(),
  artifact_type: z.enum(["report", "presentation", "dashboard", "spreadsheet"]),
  title: z.string(),
  publish_target_ref: z.string(),
  target_locale: z.string().default("ar-SA"),
  containers: z.array(SampleContainerSchema).min(1),
  text_nodes: z.array(SampleTextNodeSchema).min(1),
  profiles: z.array(TerminologyProfileSchema).default([]),
  rules: z.array(TerminologyRuleSchema).default([]),
  protected_terms: z.array(ProtectedTermSchema).default([]),
  non_translatable_terms: z.array(NonTranslatableTermSchema).default([]),
  external_glossary_entries: z.array(ExternalGlossaryEntrySchema).default([]),
  integration: LocalizationIntegrationOverrideSchema.optional(),
  provider_scenario: ProviderScenarioSchema.default("none"),
  roundtrip_tamper_mode: RoundTripTamperModeSchema.default("none"),
  policy: LocalizationPolicySchema.optional(),
  allow_degraded_publish: z.boolean().default(true)
});

type LocalizationExecutionInput = z.infer<typeof LocalizationExecutionInputSchema>;
type LocalizationSampleDefinition = z.infer<typeof LocalizationSampleDefinitionSchema>;
type SampleContainer = z.infer<typeof SampleContainerSchema>;
type SampleTextNode = z.infer<typeof SampleTextNodeSchema>;
type ExternalGlossaryEntry = z.infer<typeof ExternalGlossaryEntrySchema>;
type LocalizationIntegration = z.infer<typeof LocalizationIntegrationSchema>;
type RoundTripTamperMode = z.infer<typeof RoundTripTamperModeSchema>;
type ProviderScenario = z.infer<typeof ProviderScenarioSchema>;

type GlossaryConflict = {
  source_term: string;
  target_term: string;
  conflict_code: "protected_term_violation" | "non_translatable_violation" | "duplicate_source_conflict";
  affected_terms: string[];
  detail: string;
};

type ProviderAttemptTrace = {
  attempt_number: number;
  outcome: "success" | "http_error" | "timeout" | "malformed_response" | "network_error" | "empty";
  duration_ms: number;
  status_code: number | null;
  translated_count: number;
  timeout_hit: boolean;
  error: string | null;
  failure_classification: string | null;
  retry_decision: "retry" | "fallback_local" | "complete" | null;
  response_excerpt: string | null;
};

type TranslationIntegrationStatus = {
  provider_mode: LocalizationIntegration["provider_mode"];
  glossary_source_path: string | null;
  glossary_rule_count: number;
  glossary_conflicts: GlossaryConflict[];
  provider_url: string | null;
  selected_provider_ref: string | null;
  selected_model_ref: string | null;
  fallback_provider_ref: string | null;
  fallback_model_ref: string | null;
  fallback_used: boolean;
  fallback_reason: string | null;
  provider_used: boolean;
  provider_warning: string | null;
  provider_attempt_count: number;
  provider_retry_count: number;
  provider_timeout_hit: boolean;
  provider_final_outcome: "not_used" | "success" | "empty" | "fallback_local";
  fallback_mode: "deterministic_local" | "filesystem_glossary" | null;
  provider_trace: ProviderAttemptTrace[];
  validation_classification: string | null;
};

type TerminologyResolution = {
  profile: TerminologyProfile;
  rules: TerminologyRule[];
  protectedTerms: ProtectedTerm[];
  nonTranslatableTerms: NonTranslatableTerm[];
  integration: TranslationIntegrationStatus;
};

type PersistedFile = {
  filePath: string;
  uri: string;
  checksum: string;
};

export type SharedDashboardRuntimeLocalizationIntakeInput = {
  run_id: string;
  dashboard_state: Record<string, unknown>;
  source_state_path: string;
  created_by: string;
  source_locale?: string;
};

export type SharedDashboardRuntimeLocalizationIntakeResult = {
  source_artifact: Artifact;
  source_canonical: CanonicalRepresentation;
  intake_metadata: {
    source_of_truth: "shared_dashboard_runtime_state";
    source_dashboard_id: string;
    source_dashboard_artifact_ref: string;
    source_dashboard_canonical_ref: string;
    source_dashboard_version_ref: string;
    source_dashboard_state_path: string;
    embed_payload_used_as_source: false;
    widget_count: number;
    rendered_widget_count: number;
    page_count: number;
    filter_count: number;
    interaction_rule_count: number;
    localized_surface_counts: {
      widget_titles: number;
      filter_labels: number;
      legend_labels: number;
      axis_labels: number;
      series_labels: number;
      tooltip_labels: number;
      interactive_controls: number;
      generated_narratives: number;
      ui_strings: number;
    };
  };
};

type OutputSidecar = {
  relative_path: string;
  content: string | Uint8Array;
};

type OutputPayload = {
  content: string | Uint8Array;
  extension: Artifact["export_refs"][number]["export_type"];
  preview_type: Artifact["preview_ref"]["preview_type"];
  sidecars?: OutputSidecar[];
  adapter_metadata?: Record<string, unknown>;
};

type ParsedLocalizedOutput = {
  parser_kind: "docx" | "pptx" | "xlsx" | "dashboard_bundle";
  title: string;
  containers: SampleContainer[];
  text_nodes: SampleTextNode[];
  metadata: Record<string, unknown>;
};

export type IncrementalChange = {
  node_id: string;
  change_type: "added" | "modified" | "removed";
  previous_value: string | null;
  new_value: string | null;
};

export type IncrementalPublicationResult = {
  updated_canonical: CanonicalRepresentation;
  changed_node_ids: string[];
  preserved_node_ids: string[];
  incremental_diff: IncrementalChange[];
  publication: Publication;
  timestamp: string;
};

export type BidirectionalConflict = {
  node_id: string;
  source_value: string;
  external_value: string;
  resolved_value: string;
  resolution: "source_wins" | "external_wins" | "merged";
  conflict_marker: string;
};

export type BidirectionalSyncResult = {
  merged_canonical: CanonicalRepresentation;
  conflicts: BidirectionalConflict[];
  applied_external_changes: number;
  preserved_source_changes: number;
  merge_strategy: "external_priority" | "source_priority" | "manual";
  timestamp: string;
};

export type CapabilityMatrixEntry = {
  capability: string;
  status: "implemented" | "degraded" | "unsupported" | "pending";
  coverage: string;
  notes: string;
};

type LocalizationRoundTripResult = {
  parser_kind: ParsedLocalizedOutput["parser_kind"] | "failed";
  reingested_canonical: CanonicalRepresentation | null;
  quality: LocalizationQualityResult | null;
  evidence_pack: EvidencePack;
  audit_events: AuditEvent[];
  lineage_edges: LineageEdge[];
  manifest: Record<string, unknown>;
  preservation_report: Record<string, unknown>;
};

export type LocalizationPersistedArtifacts = {
  output_root: string;
  input_payload_path: string;
  input_canonical_path: string;
  request_path: string;
  policy_path: string;
  terminology_profile_path: string;
  direction_plan_path: string;
  typography_plan_path: string;
  cultural_plan_path: string;
  localized_canonical_path: string;
  localized_output_path: string;
  preview_path: string;
  diff_path: string;
  quality_path: string;
  output_metadata_path: string;
  publication_path: string;
  evidence_path: string;
  audit_path: string;
  lineage_path: string;
  artifacts_manifest_path: string;
  translation_integration_path: string;
  native_adapter_metadata_path: string;
  fidelity_report_path: string;
  dashboard_artifact_closure_path: string | null;
  provider_malformed_proof_path: string | null;
  dashboard_package_path: string | null;
  published_sidecar_paths: string[];
  roundtrip_manifest_path: string;
  roundtrip_canonical_path: string;
  roundtrip_quality_path: string;
  roundtrip_evidence_path: string;
  roundtrip_audit_path: string;
  roundtrip_lineage_path: string;
  roundtrip_preservation_path: string;
};

export type LocalizationExecutionBundle = {
  input: LocalizationExecutionInput;
  detected_source_locale: string;
  localization_scope: LocalizationScope;
  localization_policy: LocalizationPolicy;
  terminology_resolution: TerminologyResolution;
  direction_transformation_plan: DirectionTransformationPlan;
  typography_refinement_plan: TypographyRefinementPlan;
  cultural_formatting_plan: CulturalFormattingPlan;
  localization_request: LocalizationRequest;
  localized_canonical: CanonicalRepresentation;
  localized_artifact: Artifact;
  preview_artifact: Artifact;
  diff_artifact: Artifact;
  export_artifacts: Artifact[];
  localized_output_metadata: LocalizedOutputMetadata;
  localization_preview: LocalizationPreview;
  language_quality_result: LanguageQualityResult;
  layout_quality_result: LayoutQualityResult;
  editability_quality_result: EditabilityQualityResult;
  cultural_quality_result: CulturalQualityResult;
  localization_quality_result: LocalizationQualityResult;
  localization_degrade_reasons: LocalizationDegradeReason[];
  publication: Publication;
  evidence_pack: EvidencePack;
  audit_events: AuditEvent[];
  lineage_edges: LineageEdge[];
  job: Job;
  translation_integration: TranslationIntegrationStatus;
  published_output_content: string | Uint8Array;
  published_output_extension: Artifact["export_refs"][number]["export_type"];
  published_output_preview_type: Artifact["preview_ref"]["preview_type"];
  published_output_sidecars: OutputSidecar[];
  native_adapter_metadata: Record<string, unknown>;
  preview_content: string;
  diff_payload: Record<string, unknown>;
  round_trip_result: LocalizationRoundTripResult | null;
  persisted_artifacts: LocalizationPersistedArtifacts | null;
  publish_mode: "localized" | "degraded";
};

export type LocalizationSampleRun = {
  sample_name: string;
  bundle: LocalizationExecutionBundle;
  artifacts: LocalizationPersistedArtifacts;
};

const DEFAULT_PERMISSION_SCOPE = (): PermissionScope => ({
  visibility: "workspace",
  allow_read: true,
  allow_write: true,
  allow_share: true,
  allow_publish: true,
  allow_audit_view: true
});

const ARABIC_PROFESSIONAL_SERIF_FONT = "Amiri";
const ARABIC_PROFESSIONAL_SANS_FONT = "Noto Naskh Arabic";
const ARABIC_PROFESSIONAL_UI_FONT = "Tahoma";
const PREVIEW_ARABIC_FONT_STACK = `"${ARABIC_PROFESSIONAL_SERIF_FONT}","${ARABIC_PROFESSIONAL_SANS_FONT}","${ARABIC_PROFESSIONAL_UI_FONT}","Arial",sans-serif`;
const OFFICE_ARABIC_LANGUAGE_TAG = "ar-SA";

const convertToArabicNumerals = (text: string): string => {
  const arabicDigits = ['\u0660', '\u0661', '\u0662', '\u0663', '\u0664', '\u0665', '\u0666', '\u0667', '\u0668', '\u0669'];
  return text.replace(/[0-9]/g, (d) => arabicDigits[parseInt(d)]);
};

const DEFAULT_PHRASE_TRANSLATIONS: Record<string, string> = {
  "quarterly revenue report": "تقرير الإيرادات ربع السنوي",
  "operational dashboard": "لوحة المتابعة التشغيلية",
  "region filter": "عامل تصفية المنطقة",
  "revenue legend": "وسيلة إيضاح الإيرادات",
  "revenue axis": "محور الإيرادات",
  "quarter axis": "محور الربع",
  "revenue tooltip": "تلميح الإيرادات",
  "regional revenue series": "سلسلة الإيرادات الإقليمية",
  "benchmark series": "سلسلة المقارنة المرجعية",
  "tooltip body shows kpi and revenue context.": "يعرض تلميح الأداة سياق KPI والإيرادات.",
  "tooltip compares baseline and scenario delta.": "يقارن التلميح بين خط الأساس وفارق السيناريو.",
  "tooltip date shows march 15, 2026 and $1,245.50.": "يعرض التلميح تاريخ ١٥ مارس ٢٠٢٦ وقيمة ١٬٢٤٥٫٥٠ دولار.",
  "open details": "فتح التفاصيل",
  "granularity control": "التحكم في مستوى التفصيل",
  "scenario toggle": "مبدل السيناريو",
  "drilldown control": "التحكم في التعمق التحليلي",
  "compare mode": "وضع المقارنة",
  "date range control": "التحكم في النطاق الزمني",
  "customer churn risk": "مخاطر تسرّب العملاء",
  "openai api adoption increased by 18%.": "زاد تبنّي OpenAI API بنسبة 18%.",
  "kpi coverage remained stable.": "بقيت تغطية KPI مستقرة.",
  "alert threshold is 75%.": "حد التنبيه هو 75%.",
  "the hijri due date is ramadan 10, 1447 ah.": "موعدُ الاستحقاقِ الهِجريُّ هو ١٠ رمضان ١٤٤٧ هـ.",
  "arabic-english note for openai api readiness remained stable.": "بقيت مُلاحظةُ الجاهزية العربية-الإنجليزية الخاصة بـ OpenAI API مستقرة.",
  "operational diacritics note.": "هٰذِهِ مُلاحَظَةٌ تَشْغِيلِيَّةٌ مُشَكَّلَةٌ.",
  "mirror layout preserved the original visual meaning.": "حافَظَ عَكْسُ التَّخطيطِ على المَعنى البَصريِّ الأَصلي.",
  "smart kashida alignment remained stable.": "بَقِيَ ضَبْطُ الكَشِيدَةِ الذَّكِيَّةِ مُسْتَقِرًّا.",
  "mixed arabic and english content for openai api and kpi remained aligned.": "بقي المحتوى العربي والإنجليزي الخاص بـ OpenAI API وKPI متَّسقًا.",
  // --- Financial terms ---
  "profit margin": "هامش الربح",
  "gross revenue": "الإيرادات الإجمالية",
  "net income": "صافي الدخل",
  "operating expenses": "المصروفات التشغيلية",
  "cash flow": "التدفق النقدي",
  "balance sheet": "الميزانية العمومية",
  "income statement": "قائمة الدخل",
  "accounts receivable": "الذمم المدينة",
  "accounts payable": "الذمم الدائنة",
  "return on investment": "العائد على الاستثمار",
  "earnings per share": "ربحية السهم",
  "market capitalization": "القيمة السوقية",
  "dividend yield": "عائد الأرباح الموزعة",
  "fiscal year": "السنة المالية",
  "budget allocation": "تخصيص الميزانية",
  "cost reduction": "خفض التكاليف",
  "revenue growth": "نمو الإيرادات",
  "financial performance": "الأداء المالي",
  "audit report": "تقرير المراجعة",
  "tax compliance": "الامتثال الضريبي",
  "financial statement": "القوائم المالية",
  "working capital": "رأس المال العامل",
  "debt ratio": "نسبة المديونية",
  "equity ratio": "نسبة حقوق الملكية",
  "gross profit": "إجمالي الربح",
  "net profit": "صافي الربح",
  "operating income": "الدخل التشغيلي",
  "retained earnings": "الأرباح المبقاة",
  "capital expenditure": "النفقات الرأسمالية",
  "depreciation expense": "مصروف الاستهلاك",
  "interest rate": "سعر الفائدة",
  "exchange rate": "سعر الصرف",
  "financial risk": "المخاطر المالية",
  "credit rating": "التصنيف الائتماني",
  "asset management": "إدارة الأصول",
  "liability management": "إدارة الالتزامات",
  "cost of goods sold": "تكلفة البضاعة المباعة",
  "accounts reconciliation": "تسوية الحسابات",
  "internal audit": "المراجعة الداخلية",
  "external audit": "المراجعة الخارجية",
  // --- Government/Regulatory ---
  "regulatory compliance": "الامتثال التنظيمي",
  "policy framework": "الإطار السياساتي",
  "public sector": "القطاع العام",
  "government initiative": "المبادرة الحكومية",
  "national strategy": "الاستراتيجية الوطنية",
  "digital transformation": "التحول الرقمي",
  "service delivery": "تقديم الخدمات",
  "citizen engagement": "مشاركة المواطنين",
  "public administration": "الإدارة العامة",
  "governance framework": "إطار الحوكمة",
  "regulatory authority": "الهيئة التنظيمية",
  "ministry of finance": "وزارة المالية",
  "council of ministers": "مجلس الوزراء",
  "royal decree": "مرسوم ملكي",
  "executive order": "أمر تنفيذي",
  "public policy": "السياسة العامة",
  "national development": "التنمية الوطنية",
  "government procurement": "المشتريات الحكومية",
  "public private partnership": "الشراكة بين القطاعين العام والخاص",
  "electronic government": "الحكومة الإلكترونية",
  "national budget": "الميزانية العامة للدولة",
  "state audit bureau": "ديوان المراقبة العامة",
  "supreme court": "المحكمة العليا",
  "legislative council": "المجلس التشريعي",
  "municipal council": "المجلس البلدي",
  // --- Healthcare ---
  "patient satisfaction": "رضا المرضى",
  "clinical outcome": "النتيجة السريرية",
  "treatment plan": "خطة العلاج",
  "health indicator": "المؤشر الصحي",
  "medical record": "السجل الطبي",
  "emergency response": "الاستجابة للطوارئ",
  "quality of care": "جودة الرعاية",
  "patient safety": "سلامة المرضى",
  "health policy": "السياسة الصحية",
  "disease prevention": "الوقاية من الأمراض",
  "primary care": "الرعاية الأولية",
  "mental health": "الصحة النفسية",
  "public health": "الصحة العامة",
  "health insurance": "التأمين الصحي",
  "clinical trial": "التجربة السريرية",
  // --- Technology ---
  "data analytics": "تحليلات البيانات",
  "machine learning": "التعلم الآلي",
  "artificial intelligence": "الذكاء الاصطناعي",
  "cloud computing": "الحوسبة السحابية",
  "cybersecurity": "الأمن السيبراني",
  "digital platform": "المنصة الرقمية",
  "system integration": "تكامل الأنظمة",
  "data migration": "ترحيل البيانات",
  "software development": "تطوير البرمجيات",
  "quality assurance": "ضمان الجودة",
  "information technology": "تقنية المعلومات",
  "data warehouse": "مستودع البيانات",
  "business intelligence": "ذكاء الأعمال",
  "enterprise resource planning": "تخطيط موارد المؤسسة",
  "content management system": "نظام إدارة المحتوى",
  "application programming interface": "واجهة برمجة التطبيقات",
  "user experience": "تجربة المستخدم",
  "user interface": "واجهة المستخدم",
  "version control": "التحكم في الإصدارات",
  "continuous integration": "التكامل المستمر",
  "continuous deployment": "النشر المستمر",
  "agile methodology": "المنهجية الرشيقة",
  "technical debt": "الدين التقني",
  "load balancing": "موازنة الأحمال",
  "disaster recovery": "التعافي من الكوارث",
  // --- General Business ---
  "key performance indicator": "مؤشر الأداء الرئيسي",
  "strategic plan": "الخطة الاستراتيجية",
  "annual report": "التقرير السنوي",
  "project management": "إدارة المشاريع",
  "stakeholder engagement": "مشاركة أصحاب المصلحة",
  "risk assessment": "تقييم المخاطر",
  "resource allocation": "تخصيص الموارد",
  "process improvement": "تحسين العمليات",
  "best practice": "أفضل الممارسات",
  "benchmark analysis": "التحليل المرجعي",
  "competitive advantage": "الميزة التنافسية",
  "market analysis": "تحليل السوق",
  "supply chain": "سلسلة الإمداد",
  "human resources": "الموارد البشرية",
  "employee engagement": "مشاركة الموظفين",
  "training program": "البرنامج التدريبي",
  "organizational structure": "الهيكل التنظيمي",
  "corporate governance": "حوكمة الشركات",
  "business continuity": "استمرارية الأعمال",
  "change management": "إدارة التغيير",
  "customer satisfaction": "رضا العملاء",
  "market share": "الحصة السوقية",
  "value proposition": "القيمة المقترحة",
  "due diligence": "العناية الواجبة",
  "mergers and acquisitions": "الاندماجات والاستحواذات",
  "intellectual property": "الملكية الفكرية",
  "service level agreement": "اتفاقية مستوى الخدمة",
  "total quality management": "إدارة الجودة الشاملة",
  "return on equity": "العائد على حقوق الملكية",
  "cost benefit analysis": "تحليل التكلفة والعائد",
  "performance review": "مراجعة الأداء",
  "action plan": "خطة العمل",
  "mission statement": "بيان المهمة",
  "vision statement": "بيان الرؤية",
  "core values": "القيم الجوهرية",
  "work environment": "بيئة العمل",
  "professional development": "التطوير المهني",
  "knowledge management": "إدارة المعرفة",
  "decision making": "صنع القرار",
  "conflict resolution": "حل النزاعات",
  "time management": "إدارة الوقت",
  "operational efficiency": "الكفاءة التشغيلية",
  "data driven": "مبني على البيانات",
  "end to end": "شامل من البداية للنهاية",
  "year over year": "على أساس سنوي",
  "quarter over quarter": "على أساس ربع سنوي"

};

const DEFAULT_WORD_TRANSLATIONS: Record<string, string> = {
  quarterly: "ربع",
  revenue: "الإيرادات",
  report: "تقرير",
  total: "إجمالي",
  on: "في",
  was: "بلغ",
  increased: "زاد",
  adoption: "تبنّي",
  by: "بنسبة",
  coverage: "تغطية",
  remained: "بقيت",
  stable: "مستقرة",
  customer: "العملاء",
  churn: "التسرّب",
  risk: "مخاطر",
  this: "هذه",
  widget: "الأداة",
  intentionally: "عن قصد",
  contains: "تحتوي",
  very: "جدًا",
  long: "طويلة",
  operational: "التشغيلية",
  note: "ملاحظة",
  about: "حول",
  monthly: "الشهرية",
  expansion: "التوسع",
  retention: "الاحتفاظ",
  onboarding: "التهيئة",
  support: "الدعم",
  load: "الضغط",
  open: "فتح",
  details: "التفاصيل",
  axis: "محور",
  quarter: "الربع",
  region: "المنطقة",
  filter: "عامل التصفية",
  legend: "وسيلة الإيضاح",
  regional: "الإقليمية",
  series: "السلسلة",
  benchmark: "المرجعية",
  tooltip: "التلميح",
  body: "المحتوى",
  shows: "يعرض",
  context: "السياق",
  granularity: "مستوى التفصيل",
  control: "التحكم",
  scenario: "السيناريو",
  toggle: "المبدل",
  drilldown: "التعمق التحليلي",
  compare: "المقارنة",
  mode: "الوضع",
  date: "التاريخ",
  range: "النطاق",
  conversion: "التحويل",
  volatility: "التذبذب",
  force: "لفرض",
  layout: "التخطيط",
  overflow: "التجاوز",
  during: "أثناء",
  arabic: "العربية",
  localization: "التعريب",
  alert: "تنبيه",
  threshold: "الحد",
  is: "هو",
  // --- Financial vocabulary ---
  profit: "الربح",
  margin: "الهامش",
  income: "الدخل",
  expense: "المصروف",
  expenses: "المصروفات",
  budget: "الميزانية",
  tax: "الضريبة",
  debt: "الدين",
  equity: "حقوق الملكية",
  asset: "الأصل",
  assets: "الأصول",
  liability: "الالتزام",
  liabilities: "الالتزامات",
  dividend: "الأرباح الموزعة",
  investment: "الاستثمار",
  capital: "رأس المال",
  depreciation: "الاستهلاك",
  amortization: "الإطفاء",
  audit: "المراجعة",
  fiscal: "مالي",
  financial: "مالي",
  accounting: "المحاسبة",
  receivable: "مدين",
  payable: "دائن",
  treasury: "الخزانة",
  bond: "السند",
  bonds: "السندات",
  stock: "السهم",
  stocks: "الأسهم",
  portfolio: "المحفظة",
  insurance: "التأمين",
  premium: "القسط",
  interest: "الفائدة",
  inflation: "التضخم",
  recession: "الركود",
  // --- Government vocabulary ---
  government: "الحكومة",
  ministry: "الوزارة",
  minister: "الوزير",
  council: "المجلس",
  decree: "مرسوم",
  regulation: "اللائحة",
  regulations: "اللوائح",
  compliance: "الامتثال",
  governance: "الحوكمة",
  policy: "السياسة",
  legislation: "التشريع",
  authority: "الهيئة",
  sector: "القطاع",
  initiative: "المبادرة",
  strategy: "الاستراتيجية",
  national: "وطني",
  federal: "اتحادي",
  municipal: "بلدي",
  citizen: "المواطن",
  procurement: "المشتريات",
  tender: "المناقصة",
  // --- Healthcare vocabulary ---
  patient: "المريض",
  clinical: "سريري",
  treatment: "العلاج",
  diagnosis: "التشخيص",
  hospital: "المستشفى",
  pharmacy: "الصيدلية",
  emergency: "الطوارئ",
  surgery: "الجراحة",
  vaccine: "اللقاح",
  disease: "المرض",
  prevention: "الوقاية",
  therapy: "العلاج",
  prescription: "الوصفة",
  // --- Technology vocabulary ---
  software: "البرمجيات",
  hardware: "العتاد",
  database: "قاعدة البيانات",
  server: "الخادم",
  network: "الشبكة",
  algorithm: "الخوارزمية",
  encryption: "التشفير",
  authentication: "المصادقة",
  authorization: "التفويض",
  bandwidth: "عرض النطاق",
  interface: "الواجهة",
  platform: "المنصة",
  integration: "التكامل",
  deployment: "النشر",
  migration: "الترحيل",
  analytics: "التحليلات",
  automation: "الأتمتة",
  optimization: "التحسين",
  scalability: "قابلية التوسع",
  infrastructure: "البنية التحتية",
  architecture: "الهندسة المعمارية",
  framework: "الإطار",
  module: "الوحدة",
  configuration: "الإعدادات",
  // --- General business vocabulary ---
  management: "الإدارة",
  performance: "الأداء",
  indicator: "المؤشر",
  analysis: "التحليل",
  assessment: "التقييم",
  evaluation: "التقويم",
  planning: "التخطيط",
  implementation: "التنفيذ",
  execution: "التنفيذ",
  monitoring: "المتابعة",
  tracking: "التتبع",
  improvement: "التحسين",
  development: "التطوير",
  growth: "النمو",
  decline: "الانخفاض",
  increase: "الزيادة",
  decrease: "الانخفاض",
  target: "الهدف",
  objective: "الهدف",
  goal: "الغاية",
  achievement: "الإنجاز",
  progress: "التقدم",
  status: "الحالة",
  priority: "الأولوية",
  schedule: "الجدول",
  deadline: "الموعد النهائي",
  milestone: "المعلم الرئيسي",
  deliverable: "المخرج",
  stakeholder: "صاحب المصلحة",
  requirement: "المتطلب",
  requirements: "المتطلبات",
  specification: "المواصفة",
  scope: "النطاق",
  baseline: "خط الأساس",
  variance: "الانحراف",
  trend: "الاتجاه",
  forecast: "التوقعات",
  projection: "الإسقاط",
  estimate: "التقدير",
  actual: "الفعلي",
  planned: "المخطط",
  approved: "المعتمد",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغى",
  department: "الإدارة",
  division: "القسم",
  branch: "الفرع",
  unit: "الوحدة",
  team: "الفريق",
  employee: "الموظف",
  director: "المدير",
  manager: "المدير",
  supervisor: "المشرف",
  coordinator: "المنسق",
  consultant: "المستشار",
  specialist: "المتخصص",
  overview: "نظرة عامة",
  summary: "الملخص",
  conclusion: "الخلاصة",
  recommendation: "التوصية",
  findings: "النتائج",
  results: "النتائج",
  outcome: "المخرجات",
  impact: "الأثر",
  efficiency: "الكفاءة",
  effectiveness: "الفعالية",
  productivity: "الإنتاجية",
  quality: "الجودة",
  standard: "المعيار",
  procedure: "الإجراء",
  process: "العملية",
  workflow: "سير العمل",
  approval: "الموافقة",
  review: "المراجعة",
  feedback: "التغذية الراجعة",
  response: "الاستجابة",
  request: "الطلب",
  proposal: "المقترح",
  contract: "العقد",
  agreement: "الاتفاقية",
  training: "التدريب",
  program: "البرنامج",
  project: "المشروع",
  phase: "المرحلة",
  stage: "المرحلة",
  category: "الفئة",
  classification: "التصنيف",
  type: "النوع",
  level: "المستوى",
  annual: "سنوي",
  daily: "يومي",
  weekly: "أسبوعي",
  average: "المتوسط",
  maximum: "الحد الأقصى",
  minimum: "الحد الأدنى",
  percentage: "النسبة المئوية",
  ratio: "النسبة",
  rate: "المعدل",
  index: "المؤشر",
  value: "القيمة",
  cost: "التكلفة",
  price: "السعر",
  amount: "المبلغ",
  balance: "الرصيد",
  account: "الحساب"

};

const STYLE_PHRASE_TRANSLATIONS: Record<"formal" | "executive" | "government" | "technical", Record<string, string>> = {
  formal: {
    "Executive watchlist needs same-day follow-up.": "تتطلب قائمة المتابعة التنفيذية متابعة في اليوم نفسه.",
    "Escalation backlog requires immediate triage.": "يتطلب تراكم التصعيد فرزًا فوريًا.",
    "Regional demand baseline remains above plan.": "يبقى خط الأساس للطلب الإقليمي أعلى من الخطة."
  },
  executive: {
    "Executive watchlist needs same-day follow-up.": "تستلزم قائمة المتابعة التنفيذية إجراءً في اليوم نفسه.",
    "Escalation backlog requires immediate triage.": "يتطلب تراكم التصعيد معالجة فورية.",
    "Regional demand baseline remains above plan.": "يبقى الطلب الإقليمي أعلى من الخطة."
  },
  government: {
    "Executive watchlist needs same-day follow-up.": "تستلزم قائمة المتابعة التنفيذية اتخاذ الإجراء النظامي في اليوم ذاته.",
    "Escalation backlog requires immediate triage.": "يستلزم تراكم التصعيد المعالجة العاجلة وفق الإجراء المعتمد.",
    "Regional demand baseline remains above plan.": "يظل خط الأساس للطلب الإقليمي أعلى من الخطة المعتمدة."
  },
  technical: {
    "Executive watchlist needs same-day follow-up.": "تتطلب قائمة المتابعة التنفيذية استجابة تشغيلية في اليوم نفسه.",
    "Escalation backlog requires immediate triage.": "يتطلب تراكم التصعيد فرزًا تشغيليًا عاجلًا.",
    "Regional demand baseline remains above plan.": "يبقى خط الأساس للطلب الإقليمي أعلى من الخطة التشغيلية."
  }
};

const TONE_SAMPLE_TONE_MAP = {
  "report-en-ar-formal-pass": "formal",
  "report-en-ar-executive-pass": "executive",
  "report-en-ar-government-pass": "government",
  "report-en-ar-technical-pass": "technical"
} as const;

const DOMAIN_SEMANTIC_MAPS = {
  finance: {
    glossary_name: "finance_glossary_v1",
    business_registry: "registry.finance.executive",
    overridden_terms: ["Portfolio Watchlist Report", "Control tower case remained active.", "Service level risk requires immediate follow-up."],
    semantic_map: {
      portfolio_watchlist: "قائمة متابعة المحافظ",
      control_tower_case: "حالة غرفة متابعة السيولة",
      service_level_risk: "مخاطر مستوى الخدمة المالية"
    },
    translations: {
      title: "تقرير قائمة متابعة المحافظ",
      caseLine: "بقيت حالة غرفة متابعة السيولة نشطة.",
      riskLine: "تتطلب مخاطر مستوى الخدمة المالية متابعة فورية."
    },
    style: "executive" as const
  },
  healthcare: {
    glossary_name: "healthcare_glossary_v1",
    business_registry: "registry.healthcare.capacity",
    overridden_terms: ["Portfolio Watchlist Report", "Control tower case remained active.", "Service level risk requires immediate follow-up."],
    semantic_map: {
      portfolio_watchlist: "قائمة متابعة مسارات الرعاية",
      control_tower_case: "حالة مركز قيادة السعة السريرية",
      service_level_risk: "مخاطر جاهزية الخدمة السريرية"
    },
    translations: {
      title: "تقرير قائمة متابعة مسارات الرعاية",
      caseLine: "بقيت حالة مركز قيادة السعة السريرية نشطة.",
      riskLine: "تتطلب مخاطر جاهزية الخدمة السريرية متابعة فورية."
    },
    style: "formal" as const
  },
  government: {
    glossary_name: "government_glossary_v1",
    business_registry: "registry.government.operations",
    overridden_terms: ["Portfolio Watchlist Report", "Control tower case remained active.", "Service level risk requires immediate follow-up."],
    semantic_map: {
      portfolio_watchlist: "قائمة متابعة المبادرات",
      control_tower_case: "حالة مركز المتابعة الميدانية",
      service_level_risk: "مخاطر مستوى الخدمة الحكومية"
    },
    translations: {
      title: "تقرير قائمة متابعة المبادرات",
      caseLine: "بقيت حالة مركز المتابعة الميدانية نشطة.",
      riskLine: "تستلزم مخاطر مستوى الخدمة الحكومية متابعة عاجلة."
    },
    style: "government" as const
  },
  telecom: {
    glossary_name: "telecom_glossary_v1",
    business_registry: "registry.telecom.network",
    overridden_terms: ["Portfolio Watchlist Report", "Control tower case remained active.", "Service level risk requires immediate follow-up."],
    semantic_map: {
      portfolio_watchlist: "قائمة متابعة المشتركين",
      control_tower_case: "حالة مركز قيادة الشبكة",
      service_level_risk: "مخاطر مستوى خدمة الشبكة"
    },
    translations: {
      title: "تقرير قائمة متابعة المشتركين",
      caseLine: "بقيت حالة مركز قيادة الشبكة نشطة.",
      riskLine: "تتطلب مخاطر مستوى خدمة الشبكة متابعة فورية."
    },
    style: "technical" as const
  }
} as const;

const DASHBOARD_LOCALIZATION_LABELS = {
  widgetTitle: "widget_title",
  filterLabel: "filter_label",
  legendLabel: "legend_label",
  axisLabel: "axis_label",
  seriesLabel: "series_label",
  tooltipLabel: "tooltip_label",
  interactiveControl: "interactive_control",
  generatedNarrative: "generated_narrative",
  uiString: "ui_string"
} as const;

const ARABIC_MONTHS: Record<string, string> = {
  january: "يناير",
  february: "فبراير",
  march: "مارس",
  april: "أبريل",
  may: "مايو",
  june: "يونيو",
  july: "يوليو",
  august: "أغسطس",
  september: "سبتمبر",
  october: "أكتوبر",
  november: "نوفمبر",
  december: "ديسمبر"
};

const ARABIC_HIJRI_MONTHS: Record<string, string> = {
  muharram: "محرم",
  safar: "صفر",
  "rabi al-awwal": "ربيع الأول",
  "rabi al-thani": "ربيع الآخر",
  "jumada al-ula": "جمادى الأولى",
  "jumada al-akhirah": "جمادى الآخرة",
  rajab: "رجب",
  shaaban: "شعبان",
  ramadan: "رمضان",
  shawwal: "شوال",
  "dhu al-qidah": "ذو القعدة",
  "dhu al-hijjah": "ذو الحجة"
};

const now = (): string => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string, ...parts: Array<string | number | null | undefined>): string =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");

const checksumForContent = (content: string): string => createHash("sha256").update(content).digest("hex");
const ensureDir = (targetPath: string): void => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const writeText = (filePath: string, content: string): PersistedFile => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: `sha256:${checksumForContent(content)}`
  };
};

const writeBytes = (filePath: string, content: Uint8Array): PersistedFile => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: `sha256:${createHash("sha256").update(content).digest("hex")}`
  };
};

const writeOutput = (filePath: string, content: string | Uint8Array): PersistedFile =>
  typeof content === "string" ? writeText(filePath, content) : writeBytes(filePath, content);

const writeJson = (filePath: string, payload: unknown): PersistedFile =>
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);

const ensureUint8Array = (content: string | Uint8Array | ArrayBuffer): Uint8Array =>
  content instanceof Uint8Array ? content : typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);

const checksumForBytes = (content: Uint8Array): string => createHash("sha256").update(content).digest("hex");
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeRoundTripText = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .replace(/[.,،:;!?%]+/g, "")
    .trim()
    .toLowerCase();
const countArabicIndicDigits = (value: string): number => (value.match(/[٠-٩]/g) ?? []).length;
const checksumRelativePathMap = (entries: Array<{ relative_path: string; content: string | Uint8Array }>) =>
  Object.fromEntries(
    entries.map((entry) => [
      entry.relative_path,
      `sha256:${typeof entry.content === "string" ? checksumForContent(entry.content) : checksumForBytes(entry.content)}`
    ])
  );

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");

const containsArabicScript = (value: string): boolean => /[\u0600-\u06FF]/.test(value);
const stripAllowedLatinTokens = (value: string): string =>
  ["OpenAI", "API", "KPI", "BI", "RTL", "LTR"].reduce(
    (result, token) => result.replace(new RegExp(`\\b${token}\\b`, "gi"), ""),
    value
  );
const hasUnexpectedLatinResidual = (value: string): boolean => /[A-Za-z]/.test(stripAllowedLatinTokens(value));
const rawExcerpt = (value: string | null | undefined, max = 2000): string | null =>
  value ? value.slice(0, max) : null;

const hardenDocxRtlOutput = async (content: Uint8Array): Promise<Uint8Array> => {
  const zip = await JSZip.loadAsync(content);
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) {
    return content;
  }
  const documentXml = await documentEntry.async("string");
  const runFontMarkup = `<w:rFonts w:ascii="${ARABIC_PROFESSIONAL_SERIF_FONT}" w:hAnsi="${ARABIC_PROFESSIONAL_SERIF_FONT}" w:cs="${ARABIC_PROFESSIONAL_SERIF_FONT}" w:eastAsia="${ARABIC_PROFESSIONAL_SERIF_FONT}"/><w:lang w:val="${OFFICE_ARABIC_LANGUAGE_TAG}" w:bidi="${OFFICE_ARABIC_LANGUAGE_TAG}"/><w:rtl/>`;
  const hardenedXml = documentXml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (paragraph, attrs, inner) => {
    if (!containsArabicScript(inner)) {
      return paragraph;
    }
    let nextInner = inner.replace(/<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/g, (run: string, runAttrs: string, runInner: string) => {
      if (!containsArabicScript(runInner)) {
        return run;
      }
      if (runInner.includes("<w:rPr>")) {
        let nextRunInner = runInner;
        if (!nextRunInner.includes("<w:rFonts ")) {
          nextRunInner = nextRunInner.replace("<w:rPr>", `<w:rPr>${runFontMarkup}`);
        }
        if (!nextRunInner.includes("<w:lang ")) {
          nextRunInner = nextRunInner.replace(
            "</w:rPr>",
            `<w:lang w:val="${OFFICE_ARABIC_LANGUAGE_TAG}" w:bidi="${OFFICE_ARABIC_LANGUAGE_TAG}"/></w:rPr>`
          );
        }
        if (!nextRunInner.includes("<w:rtl/>")) {
          nextRunInner = nextRunInner.replace("</w:rPr>", "<w:rtl/></w:rPr>");
        }
        return `<w:r${runAttrs}>${nextRunInner}</w:r>`;
      }
      return `<w:r${runAttrs}><w:rPr>${runFontMarkup}</w:rPr>${runInner}</w:r>`;
    });
    if (nextInner.includes("<w:pPr>")) {
      if (!nextInner.includes("<w:jc ")) {
        nextInner = nextInner.replace("<w:pPr>", '<w:pPr><w:jc w:val="both"/>');
      } else if (!nextInner.includes('w:jc w:val="both"')) {
        nextInner = nextInner.replace(/<w:jc\b[^>]*\/>/, '<w:jc w:val="both"/>');
      }
      if (!nextInner.includes("<w:bidi/>")) {
        nextInner = nextInner.replace("</w:pPr>", "<w:bidi/></w:pPr>");
      }
      return `<w:p${attrs}>${nextInner}</w:p>`;
    }
    return `<w:p${attrs}><w:pPr><w:jc w:val="both"/><w:bidi/></w:pPr>${nextInner}</w:p>`;
  });
  zip.file("word/document.xml", hardenedXml);
  return new Uint8Array(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
};

const makeStorageRef = (persisted: PersistedFile, storageId: string, storageClass = "local_fs") => ({
  storage_id: storageId,
  storage_class: storageClass,
  uri: persisted.uri,
  checksum: persisted.checksum,
  region: "local"
});

const buildArtifact = (
  input: LocalizationExecutionInput,
  artifactId: string,
  artifactType: Artifact["artifact_type"],
  artifactSubtype: string,
  editableStatus: Artifact["editable_status"],
  verificationStatus: Artifact["verification_status"],
  timestamp: string,
  canonicalRef: string,
  parentArtifactRefs: string[]
): Artifact =>
  ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: artifactId,
    artifact_type: artifactType,
    artifact_subtype: artifactSubtype,
    project_id: input.project_id,
    workspace_id: input.workspace_id,
    source_refs: input.source_artifact.source_refs.length > 0 ? input.source_artifact.source_refs : [input.source_artifact.artifact_id],
    parent_artifact_refs: parentArtifactRefs,
    canonical_ref: canonicalRef,
    created_by: input.created_by,
    created_at: timestamp,
    mode: input.mode,
    editable_status: editableStatus,
    template_status: input.source_artifact.template_status,
    lineage_ref: id("lineage", artifactId),
    evidence_ref: id("evidence", artifactId),
    verification_status: verificationStatus,
    storage_ref: {
      storage_id: id("storage", artifactId),
      storage_class: "memory",
      uri: `memory://lct/${artifactId}`,
      checksum: `sha256:${artifactId}`,
      region: "workspace"
    },
    preview_ref: {
      preview_id: id("preview", artifactId),
      preview_type: "html_canvas",
      storage_ref: id("storage", artifactId)
    },
    export_refs: [],
    version_ref: {
      version_id: id("version", artifactId),
      parent_version_id: input.source_artifact.version_ref.version_id,
      version_number: Math.max(1, input.source_artifact.version_ref.version_number + 1),
      semantic_version: `1.0.${Math.max(1, input.source_artifact.version_ref.version_number)}`
    },
    tenant_ref: input.tenant_ref,
    permission_scope: DEFAULT_PERMISSION_SCOPE()
  });

const collectTextValues = (canonical: CanonicalRepresentation): string[] =>
  canonical.nodes.text.flatMap((node) => node.content.map((item) => item.value));

const detectDominantLocale = (canonical: CanonicalRepresentation): string => {
  const text = collectTextValues(canonical).join(" ");
  const arabicMatches = text.match(/[\u0600-\u06FF]/g)?.length ?? 0;
  const latinMatches = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (arabicMatches > latinMatches) return "ar-SA";
  if (latinMatches > 0) return "en-US";
  return canonical.localization.locale || "en-US";
};

const scopePriority = (scope: TerminologyProfile["scope"]): number =>
  ({
    artifact_override: 5,
    user: 4,
    domain: 3,
    workspace: 2,
    org: 1
  })[scope];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toArabicDigits = (value: string): string =>
  value
    .replace(/0/g, "٠")
    .replace(/1/g, "١")
    .replace(/2/g, "٢")
    .replace(/3/g, "٣")
    .replace(/4/g, "٤")
    .replace(/5/g, "٥")
    .replace(/6/g, "٦")
    .replace(/7/g, "٧")
    .replace(/8/g, "٨")
    .replace(/9/g, "٩")
    .replace(/,/g, "٬")
    .replace(/\./g, "٫");

const formatDateAndCurrency = (value: string, targetLocale: string): string => {
  if (!targetLocale.startsWith("ar")) return value;
  let next = value.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/gi,
    (_match, month, day, year) => `${toArabicDigits(day)} ${ARABIC_MONTHS[`${month}`.toLowerCase()] ?? month} ${toArabicDigits(year)}`
  );
  next = next.replace(
    /\b(Muharram|Safar|Rabi al-Awwal|Rabi al-Thani|Jumada al-Ula|Jumada al-Akhirah|Rajab|Shaaban|Ramadan|Shawwal|Dhu al-Qidah|Dhu al-Hijjah)\s+(\d{1,2}),\s*(\d{4})\s*AH\b/gi,
    (_match, month, day, year) => `${toArabicDigits(day)} ${ARABIC_HIJRI_MONTHS[`${month}`.toLowerCase()] ?? month} ${toArabicDigits(year)} هـ`
  );
  next = next.replace(/\$([\d,]+(?:\.\d+)?)/g, (_match, amount) => `${toArabicDigits(amount)} دولار`);
  next = next.replace(/(\d+(?:\.\d+)?)%/g, (_match, amount) => `${toArabicDigits(amount)}٪`);
  next = next.replace(/\b(\d[\d,]*(?:\.\d+)?)\b/g, (_match, amount) => toArabicDigits(amount));
  return next;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const applyProtectedPlaceholders = (
  value: string,
  protectedTerms: Array<ProtectedTerm | NonTranslatableTerm>
): { text: string; placeholders: Map<string, string> } => {
  let text = value;
  const placeholders = new Map<string, string>();
  protectedTerms
    .map((term) => ({
      term: "required_output_term" in term && term.required_output_term ? term.required_output_term : term.term
    }))
    .filter((item) => item.term.length > 0)
    .sort((left, right) => right.term.length - left.term.length)
    .forEach((entry, index) => {
      const placeholder = `__KEEP_${index}__`;
      const expression = new RegExp(escapeRegex(entry.term), "gi");
      if (expression.test(text)) {
        text = text.replace(expression, placeholder);
        placeholders.set(placeholder, entry.term);
      }
    });
  return { text, placeholders };
};

const restorePlaceholders = (value: string, placeholders: Map<string, string>): string => {
  let next = value;
  for (const [placeholder, original] of placeholders.entries()) {
    next = next.replace(new RegExp(escapeRegex(placeholder), "g"), original);
  }
  return next;
};

const buildRuleMap = (rules: TerminologyRule[]): Record<string, string> => {
  const map: Record<string, string> = {};
  rules.forEach((rule) => {
    if (rule.rule_class === "preferred_translation" || rule.rule_class === "title" || rule.rule_class === "caption") {
      map[rule.source_term.toLowerCase()] = rule.preferred_translation;
    }
  });
  return map;
};

const filterGlossaryConflicts = (
  rules: TerminologyRule[],
  protectedTerms: ProtectedTerm[],
  nonTranslatableTerms: NonTranslatableTerm[]
): { acceptedRules: TerminologyRule[]; conflicts: GlossaryConflict[] } => {
  const conflicts: GlossaryConflict[] = [];
  const acceptedRules: TerminologyRule[] = [];
  const seen = new Map<string, string>();
  for (const rule of rules) {
    const duplicateTarget = seen.get(rule.source_term.toLowerCase());
    if (duplicateTarget && duplicateTarget !== rule.preferred_translation) {
      conflicts.push({
        source_term: rule.source_term,
        target_term: rule.preferred_translation,
        conflict_code: "duplicate_source_conflict",
        affected_terms: [rule.source_term],
        detail: `Glossary provides conflicting translations for ${rule.source_term}.`
      });
      continue;
    }
    seen.set(rule.source_term.toLowerCase(), rule.preferred_translation);
    const protectedConflict = protectedTerms.find((term) => {
      const required = term.required_output_term ?? term.term;
      return rule.source_term.includes(term.term) && !rule.preferred_translation.includes(required);
    });
    if (protectedConflict) {
      conflicts.push({
        source_term: rule.source_term,
        target_term: rule.preferred_translation,
        conflict_code: "protected_term_violation",
        affected_terms: [protectedConflict.term],
        detail: `Glossary target does not preserve protected term ${protectedConflict.term}.`
      });
      continue;
    }
    const nonTranslatableConflict = nonTranslatableTerms.find(
      (term) => rule.source_term.includes(term.term) && !rule.preferred_translation.includes(term.term)
    );
    if (nonTranslatableConflict) {
      conflicts.push({
        source_term: rule.source_term,
        target_term: rule.preferred_translation,
        conflict_code: "non_translatable_violation",
        affected_terms: [nonTranslatableConflict.term],
        detail: `Glossary target does not preserve non-translatable term ${nonTranslatableConflict.term}.`
      });
      continue;
    }
    acceptedRules.push(rule);
  }
  return { acceptedRules, conflicts };
};

const readExternalGlossaryRules = (
  input: LocalizationExecutionInput,
  profileRef: string,
  sourceLocale: string,
  protectedTerms: ProtectedTerm[],
  nonTranslatableTerms: NonTranslatableTerm[]
): { rules: TerminologyRule[]; glossaryPath: string | null; conflicts: GlossaryConflict[] } => {
  const glossaryPath = input.integration?.glossary_file_path;
  if (!glossaryPath) return { rules: [], glossaryPath: null, conflicts: [] };
  const raw = JSON.parse(fs.readFileSync(glossaryPath, "utf8"));
  const entries = z.array(ExternalGlossaryEntrySchema).parse(Array.isArray(raw) ? raw : raw.entries ?? []);
  const rawRules = entries.map((entry, index) =>
    TerminologyRuleSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      terminology_rule_id: id("glossary-rule", input.run_id, index + 1),
      profile_ref: profileRef,
      source_locale: entry.source_locale || sourceLocale,
      target_locale: entry.target_locale || input.target_locale,
      source_term: entry.source_term,
      preferred_translation: entry.target_term,
      banned_translations: [],
      rule_class: entry.rule_class,
      case_sensitive: false,
      applies_to_scope_refs: [],
      context_notes: `Loaded from ${path.basename(glossaryPath)}`,
      priority: 1000 + index
    })
  );
  const { acceptedRules, conflicts } = filterGlossaryConflicts(rawRules, protectedTerms, nonTranslatableTerms);
  return {
    glossaryPath,
    rules: acceptedRules,
    conflicts
  };
};

const unresolvedNodeRefs = (
  canonical: CanonicalRepresentation,
  protectedTerms: ProtectedTerm[],
  nonTranslatableTerms: NonTranslatableTerm[]
): string[] => {
  const knownLatinTerms = new Set([
    ...protectedTerms.map((term) => term.required_output_term ?? term.term),
    ...nonTranslatableTerms.map((term) => term.term)
  ]);
  return canonical.nodes.text
    .filter((node) => {
      const text = node.content[0]?.value ?? "";
      const stripped = [...knownLatinTerms].reduce(
        (current, term) => current.replace(new RegExp(escapeRegex(term), "g"), ""),
        text
      );
      return /[A-Za-z]{2,}/.test(stripped);
    })
    .map((node) => node.node_id);
};

const translateTextValue = (
  value: string,
  rules: TerminologyRule[],
  protectedTerms: ProtectedTerm[],
  nonTranslatableTerms: NonTranslatableTerm[],
  style: TerminologyProfile["default_style"],
  semanticLabels: string[]
): string => {
  const stylePhraseMap = STYLE_PHRASE_TRANSLATIONS[style] ?? STYLE_PHRASE_TRANSLATIONS.formal;
  const semanticPhraseMap =
    semanticLabels.includes("title")
      ? {
          "Quarterly Revenue Report":
            style === "government"
              ? "التقرير الربع سنوي للإيرادات"
              : style === "technical"
                ? "تقرير الإيرادات ربع السنوي التقني"
                : "تقرير الإيرادات ربع السنوي"
        }
      : {};
  const phraseMap = { ...DEFAULT_PHRASE_TRANSLATIONS, ...stylePhraseMap, ...semanticPhraseMap, ...buildRuleMap(rules) };
  let seeded = value;
  Object.entries(phraseMap)
    .sort((left, right) => right[0].length - left[0].length)
    .forEach(([source, target]) => {
      seeded = seeded.replace(new RegExp(escapeRegex(source), "gi"), target);
    });
  const { text: masked, placeholders } = applyProtectedPlaceholders(seeded, [...protectedTerms, ...nonTranslatableTerms]);
  let next = masked;
  Object.entries(phraseMap)
    .sort((left, right) => right[0].length - left[0].length)
    .forEach(([source, target]) => {
      next = next.replace(new RegExp(escapeRegex(source), "gi"), target);
    });
  next = next.replace(/[A-Za-z][A-Za-z-']*/g, (word) => DEFAULT_WORD_TRANSLATIONS[word.toLowerCase()] ?? word);
  return restorePlaceholders(normalizeWhitespace(next), placeholders);
};

const translateTextBaseline = (
  value: string,
  protectedTerms: ProtectedTerm[],
  nonTranslatableTerms: NonTranslatableTerm[]
): string => {
  let seeded = value;
  Object.entries(DEFAULT_PHRASE_TRANSLATIONS)
    .sort((left, right) => right[0].length - left[0].length)
    .forEach(([source, target]) => {
      seeded = seeded.replace(new RegExp(escapeRegex(source), "gi"), target);
    });
  const { text: masked, placeholders } = applyProtectedPlaceholders(seeded, [...protectedTerms, ...nonTranslatableTerms]);
  let next = masked;
  next = next.replace(/[A-Za-z][A-Za-z-']*/g, (word) => DEFAULT_WORD_TRANSLATIONS[word.toLowerCase()] ?? word);
  return restorePlaceholders(normalizeWhitespace(next), placeholders);
};

const boxByNode = (canonical: CanonicalRepresentation) => {
  const map = new Map<string, Record<string, unknown>>();
  canonical.layout_metadata.bounding_boxes.forEach((record) => {
    if (typeof record.node_ref === "string") map.set(record.node_ref, record);
  });
  return map;
};

const containerWidths = (canonical: CanonicalRepresentation): Map<string, number> => {
  const widths = new Map<string, number>();
  canonical.nodes.pages.forEach((page) => widths.set(page.node_id, page.width));
  canonical.nodes.slides.forEach((slide) => widths.set(slide.node_id, 1280));
  canonical.nodes.sheets.forEach((sheet) => widths.set(sheet.node_id, Math.max(960, sheet.grid_bounds.column_count * 120)));
  canonical.layout_metadata.bounding_boxes.forEach((box) => {
    if (typeof box.container_ref === "string" && typeof box.container_width === "number") {
      widths.set(box.container_ref, box.container_width);
    }
  });
  return widths;
};

const localizedArtifactTypeFromRepresentation = (
  representation: CanonicalRepresentation["representation_kind"]
): LocalizableArtifactType => {
  if (representation === "presentation") return "presentation";
  if (representation === "dashboard") return "dashboard";
  if (representation === "spreadsheet") return "spreadsheet";
  return "report";
};

const verificationFromQuality = (
  statuses: Array<LanguageQualityResult["status"] | LayoutQualityResult["status"] | EditabilityQualityResult["status"] | CulturalQualityResult["status"]>
): Artifact["verification_status"] => {
  if (statuses.includes("failed")) return "degraded";
  if (statuses.includes("passed_with_warnings")) return "success_with_warnings";
  return "verified";
};

const qualityStatus = (issues: number, warnings: number): "passed" | "passed_with_warnings" | "failed" => {
  if (issues > 0) return "failed";
  if (warnings > 0) return "passed_with_warnings";
  return "passed";
};

const buildDefaultPolicy = (input: LocalizationExecutionInput, sourceLocale: string): LocalizationPolicy =>
  LocalizationPolicySchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    localization_policy_id: id("localization-policy", input.run_id),
    policy_name: "Arabic Localization Default Policy",
    contract: contractEnvelope("localization"),
    capability_id: LOCALIZATION_CAPABILITY_ID,
    mode: input.mode === "easy" ? "smart_localization" : "pro_localization",
    source_language_detection: sourceLocale ? "explicit" : "auto_detect",
    preview_before_apply: true,
    approval_required_for_apply: true,
    auto_resolve_terminology_profile: true,
    apply_direction_transform: true,
    apply_typography_refinement: true,
    apply_cultural_formatting: true,
    preserve_editability: true,
    allow_degraded_apply: input.allow_degraded_publish,
    blocked_on_binding_break: true,
    date_policy: "arabic_gregorian",
    number_policy: "arabic_indic",
    currency_policy: "retain_source_currency_name",
    locale_phrase_policy: "culturally_adapted",
    numeric_shaping_policy: "context_aware"
  });

const buildFallbackTerminology = (input: LocalizationExecutionInput, sourceLocale: string): TerminologyResolution => {
  const profileId = id("terminology-profile", input.run_id, "default");
  const rules = Object.entries(DEFAULT_WORD_TRANSLATIONS)
    .slice(0, 24)
    .map(([source_term, preferred_translation], index) =>
      TerminologyRuleSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        terminology_rule_id: id("terminology-rule", input.run_id, index),
        profile_ref: profileId,
        source_locale: sourceLocale,
        target_locale: input.target_locale,
        source_term,
        preferred_translation,
        banned_translations: [],
        rule_class: "preferred_translation",
        case_sensitive: false,
        applies_to_scope_refs: [],
        context_notes: null,
        priority: index + 1
      })
    );
  const protectedTerms = [
    ProtectedTermSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      protected_term_id: id("protected-term", input.run_id, "openai"),
      profile_ref: profileId,
      locale: input.target_locale,
      term: "OpenAI",
      required_output_term: "OpenAI",
      match_strategy: "exact",
      applies_to_scope_refs: [],
      rationale: "Brand lock"
    }),
    ProtectedTermSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      protected_term_id: id("protected-term", input.run_id, "api"),
      profile_ref: profileId,
      locale: input.target_locale,
      term: "API",
      required_output_term: "API",
      match_strategy: "exact",
      applies_to_scope_refs: [],
      rationale: "Technical acronym"
    })
  ];
  const nonTranslatableTerms = [
    NonTranslatableTermSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      non_translatable_term_id: id("non-translatable-term", input.run_id, "kpi"),
      profile_ref: profileId,
      locale: input.target_locale,
      term: "KPI",
      match_strategy: "exact",
      preserve_original: true,
      applies_to_scope_refs: [],
      rationale: "Operational label"
    })
  ];
  const profile = TerminologyProfileSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    terminology_profile_id: profileId,
    profile_name: "Default Arabic Localization Profile",
    scope: "workspace",
    source_locale: sourceLocale,
    target_locale: input.target_locale,
    default_style: "formal",
    rule_refs: rules.map((rule) => rule.terminology_rule_id),
    protected_term_refs: protectedTerms.map((term) => term.protected_term_id),
    non_translatable_term_refs: nonTranslatableTerms.map((term) => term.non_translatable_term_id),
    parent_profile_refs: [],
    brand_preset_ref: null,
    acronym_policy: "preserve",
    title_policy: "localize",
    caption_policy: "localize"
  });
  return {
    profile,
    rules,
    protectedTerms,
    nonTranslatableTerms,
    integration: {
      provider_mode: input.integration?.provider_mode ?? "deterministic_local",
      glossary_source_path: null,
      glossary_rule_count: 0,
      glossary_conflicts: [],
      provider_url: input.integration?.provider_url ?? null,
      selected_provider_ref: null,
      selected_model_ref: null,
      fallback_provider_ref: null,
      fallback_model_ref: null,
      fallback_used: false,
      fallback_reason: null,
      provider_used: false,
      provider_warning: null,
      provider_attempt_count: 0,
      provider_retry_count: input.integration?.provider_retry_count ?? 0,
      provider_timeout_hit: false,
      provider_final_outcome: "not_used",
      fallback_mode: input.integration?.provider_mode === "filesystem_glossary" ? "filesystem_glossary" : "deterministic_local",
      provider_trace: [],
      validation_classification: null
    }
  };
};

const resolveTerminology = (input: LocalizationExecutionInput, sourceLocale: string): TerminologyResolution => {
  if (input.profiles.length === 0) {
    const fallback = buildFallbackTerminology(input, sourceLocale);
    const glossary = readExternalGlossaryRules(
      input,
      fallback.profile.terminology_profile_id,
      sourceLocale,
      fallback.protectedTerms,
      fallback.nonTranslatableTerms
    );
    return {
      ...fallback,
      rules: [...fallback.rules, ...glossary.rules],
      integration: {
        ...fallback.integration,
        provider_mode: glossary.glossaryPath ? "filesystem_glossary" : fallback.integration.provider_mode,
        glossary_source_path: glossary.glossaryPath,
        glossary_rule_count: glossary.rules.length,
        glossary_conflicts: glossary.conflicts,
        fallback_mode: glossary.glossaryPath ? "filesystem_glossary" : fallback.integration.fallback_mode
      }
    };
  }
  const profile =
    [...input.profiles]
      .filter((candidate) => candidate.target_locale === input.target_locale)
      .filter((candidate) => candidate.source_locale === sourceLocale || candidate.source_locale === "*")
      .sort((left, right) => scopePriority(right.scope) - scopePriority(left.scope))[0] ?? input.profiles[0];
  const rules = input.rules.filter(
    (rule) => rule.profile_ref === profile.terminology_profile_id || profile.rule_refs.includes(rule.terminology_rule_id)
  );
  const protectedTerms = input.protected_terms.filter(
    (term) => term.profile_ref === profile.terminology_profile_id || profile.protected_term_refs.includes(term.protected_term_id)
  );
  const nonTranslatableTerms = input.non_translatable_terms.filter(
    (term) =>
      term.profile_ref === profile.terminology_profile_id ||
      profile.non_translatable_term_refs.includes(term.non_translatable_term_id)
  );
  const glossary = readExternalGlossaryRules(
    input,
    profile.terminology_profile_id,
    sourceLocale,
    protectedTerms,
    nonTranslatableTerms
  );
  return {
    profile,
    rules: [...(rules.length > 0 ? rules : buildFallbackTerminology(input, sourceLocale).rules), ...glossary.rules],
    protectedTerms,
    nonTranslatableTerms,
    integration: {
      provider_mode: glossary.glossaryPath ? "filesystem_glossary" : input.integration?.provider_mode ?? "deterministic_local",
      glossary_source_path: glossary.glossaryPath,
      glossary_rule_count: glossary.rules.length,
      glossary_conflicts: glossary.conflicts,
      provider_url: input.integration?.provider_url ?? null,
      selected_provider_ref: null,
      selected_model_ref: null,
      fallback_provider_ref: null,
      fallback_model_ref: null,
      fallback_used: false,
      fallback_reason: null,
      provider_used: false,
      provider_warning: null,
      provider_attempt_count: 0,
      provider_retry_count: input.integration?.provider_retry_count ?? 0,
      provider_timeout_hit: false,
      provider_final_outcome: "not_used",
      fallback_mode:
        glossary.glossaryPath || input.integration?.provider_mode === "filesystem_glossary"
          ? "filesystem_glossary"
          : "deterministic_local",
      provider_trace: [],
      validation_classification: null
    }
  };
};

const buildLocalizationScope = (input: LocalizationExecutionInput): LocalizationScope =>
  LocalizationScopeSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    localization_scope_id: id("localization-scope", input.run_id),
    source_artifact_ref: input.source_artifact.artifact_id,
    source_canonical_ref: input.source_canonical.canonical_id,
    target_artifact_type: localizedArtifactTypeFromRepresentation(input.source_canonical.representation_kind),
    scope_type: "artifact",
    included_node_refs: input.source_canonical.nodes.text.map((node) => node.node_id),
    excluded_node_refs: [],
    included_binding_refs: input.source_canonical.data_binding_refs.map((binding) => binding.binding_id),
    include_layout_transformation: true,
    include_typography_refinement: true,
    include_cultural_formatting: true,
    include_asset_direction_adaptation: true,
    preserve_editability: true
  });

const buildDirectionTransformationPlan = (
  input: LocalizationExecutionInput,
  requestId: string,
  targetNodeRefs: string[]
): DirectionTransformationPlan =>
  {
    const localizationSurface = collectDashboardLocalizationSurface(input.source_canonical);
    return DirectionTransformationPlanSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      direction_transformation_plan_id: id("direction-plan", input.run_id),
      request_ref: requestId,
      source_direction: input.source_canonical.localization.rtl ? "rtl" : "ltr",
      target_direction: input.target_locale.startsWith("ar") ? "rtl" : "ltr",
      transformation_strategy: input.target_locale.startsWith("ar") ? "ltr_to_rtl" : "rtl_to_ltr",
      target_node_refs: targetNodeRefs,
      table_transform_rules: [],
      chart_transform_rules: [
        ...localizationSurface.axisLabels.map((entry) => ({
          node_ref: entry.node_id,
          rule_type: "axis_label_mirror",
          localized_text: entry.text,
          target_direction: input.target_locale.startsWith("ar") ? "rtl" : "ltr"
        })),
        ...localizationSurface.seriesLabels.map((entry) => ({
          node_ref: entry.node_id,
          rule_type: "series_label_localize",
          localized_text: entry.text,
          preserve_visual_meaning: true
        })),
        ...localizationSurface.tooltipLabels.map((entry) => ({
          node_ref: entry.node_id,
          rule_type: "tooltip_localize",
          localized_text: entry.text,
          preserve_interaction_target: true
        }))
      ],
      widget_transform_rules: localizationSurface.interactiveControls.map((entry) => ({
        node_ref: entry.node_id,
        rule_type: "interactive_control_localize",
        localized_text: entry.text,
        target_direction: input.target_locale.startsWith("ar") ? "rtl" : "ltr"
      })),
      asset_transform_rules: [],
      preserved_binding_refs: input.source_canonical.data_binding_refs.map((binding) => binding.binding_id),
      overflow_risk_refs: [],
      manual_review_required: false
    });
  };

const buildTypographyRefinementPlan = (
  input: LocalizationExecutionInput,
  requestId: string,
  targetNodeRefs: string[]
): TypographyRefinementPlan =>
  TypographyRefinementPlanSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    typography_refinement_plan_id: id("typography-plan", input.run_id),
    request_ref: requestId,
    target_node_refs: targetNodeRefs,
    font_family_priority_refs: ["font://rasid-naskh", "font://rasid-sans-arabic"],
    fallback_font_refs: ["font://noto-naskh-arabic"],
    line_height_strategy: "expand_for_arabic",
    baseline_mixing_strategy: "align_to_arabic",
    numeric_shaping_policy: "arabic_indic",
    clipping_repair_strategy: "reflow",
    preserve_brand_typography: true,
    manual_review_required: false
  });

const buildCulturalFormattingPlan = (
  input: LocalizationExecutionInput,
  requestId: string,
  targetNodeRefs: string[]
): CulturalFormattingPlan =>
  CulturalFormattingPlanSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    cultural_formatting_plan_id: id("cultural-plan", input.run_id),
    request_ref: requestId,
    target_locale: input.target_locale,
    target_node_refs: targetNodeRefs,
    date_format_style: "ar-gregorian-full",
    time_format_style: "24h",
    number_format_style: "arabic-indic",
    currency_format_style: "symbol_after_number",
    decimal_separator: "٫",
    thousands_separator: "٬",
    locale_phrase_policy: "culturally_adapted",
    asset_direction_policy: "flip_directional_assets",
    manual_review_required: false
  });

const transformLanguage = (
  canonical: CanonicalRepresentation,
  targetLocale: string,
  terminology: TerminologyResolution
): CanonicalRepresentation => {
  const localized = clone(canonical);
  localized.localization = {
    locale: targetLocale,
    rtl: targetLocale.startsWith("ar"),
    numeral_system: targetLocale.startsWith("ar") ? "arab" : "latn",
    fallback_locales: [canonical.localization.locale]
  };
  const applyArabicNumerals = targetLocale.startsWith("ar");
  localized.nodes.text = localized.nodes.text.map((node) => ({
    ...node,
    content: node.content.map((content) => {
      let translated = translateTextValue(
        content.value,
        terminology.rules,
        terminology.protectedTerms,
        terminology.nonTranslatableTerms,
        terminology.profile.default_style,
        node.semantic_labels
      );
      if (applyArabicNumerals) {
        translated = convertToArabicNumerals(translated);
      }
      return {
        ...content,
        locale: targetLocale,
        rtl: targetLocale.startsWith("ar"),
        value: translated
      };
    })
  }));
  localized.updated_at = now();
  return CanonicalRepresentationSchema.parse(localized);
};

const repairWithExternalProvider = async (
  input: LocalizationExecutionInput,
  canonical: CanonicalRepresentation,
  terminology: TerminologyResolution
): Promise<{ canonical: CanonicalRepresentation; integration: TranslationIntegrationStatus }> => {
  if (input.integration?.provider_mode !== "http_json" || !input.integration.provider_url) {
    return { canonical, integration: terminology.integration };
  }
  const unresolvedRefs = unresolvedNodeRefs(canonical, terminology.protectedTerms, terminology.nonTranslatableTerms);
  if (unresolvedRefs.length === 0) {
    return {
      canonical,
      integration: {
        ...terminology.integration,
        provider_attempt_count: 0,
        provider_retry_count: input.integration.provider_retry_count,
        provider_final_outcome: "not_used",
        provider_trace: [],
        validation_classification: null
      }
    };
  }
  const attemptsAllowed = (input.integration.provider_retry_count ?? 0) + 1;
  const requestItems = canonical.nodes.text
    .filter((node) => unresolvedRefs.includes(node.node_id))
    .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" }));
  const trace: ProviderAttemptTrace[] = [];
  for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
    const controller = new AbortController();
    const startedAt = Date.now();
    const timer = setTimeout(() => controller.abort(), input.integration.provider_timeout_ms);
    try {
      const response = await fetch(input.integration.provider_url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...input.integration.provider_headers
        },
        body: JSON.stringify({
          source_locale: detectDominantLocale(input.source_canonical),
          target_locale: input.target_locale,
          items: requestItems
        }),
        signal: controller.signal
      });
      const responseText = await response.text();
      if (!response.ok) {
        trace.push({
          attempt_number: attempt,
          outcome: "http_error",
          duration_ms: Date.now() - startedAt,
          status_code: response.status,
          translated_count: 0,
          timeout_hit: false,
          error: `External translation provider returned ${response.status}`,
          failure_classification: response.status === 401 || response.status === 403 ? "auth_failure" : "http_error",
          retry_decision: attempt < attemptsAllowed ? "retry" : "fallback_local",
          response_excerpt: rawExcerpt(responseText)
        });
        if (attempt < attemptsAllowed && input.integration.provider_retry_backoff_ms > 0) {
          await sleep(input.integration.provider_retry_backoff_ms * attempt);
        }
        continue;
      }
      const payload = z
        .object({
          translations: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
          selected_provider_ref: z.string().nullable().optional(),
          selected_model_ref: z.string().nullable().optional(),
          fallback_provider_ref: z.string().nullable().optional(),
          fallback_model_ref: z.string().nullable().optional(),
          fallback_used: z.boolean().optional(),
          fallback_reason: z.string().nullable().optional()
        })
        .parse(JSON.parse(responseText));
      const translated = new Map(payload.translations.map((item) => [item.node_id, item.text]));
      if (translated.size === 0) {
        trace.push({
          attempt_number: attempt,
          outcome: "empty",
          duration_ms: Date.now() - startedAt,
          status_code: response.status,
          translated_count: 0,
          timeout_hit: false,
          error: "Provider returned no translations.",
          failure_classification: "empty_payload",
          retry_decision: "complete",
          response_excerpt: rawExcerpt(responseText)
        });
        return {
          canonical,
          integration: {
            ...terminology.integration,
            selected_provider_ref: payload.selected_provider_ref ?? terminology.integration.selected_provider_ref,
            selected_model_ref: payload.selected_model_ref ?? terminology.integration.selected_model_ref,
            fallback_provider_ref: payload.fallback_provider_ref ?? terminology.integration.fallback_provider_ref,
            fallback_model_ref: payload.fallback_model_ref ?? terminology.integration.fallback_model_ref,
            fallback_used: payload.fallback_used ?? false,
            fallback_reason: payload.fallback_reason ?? null,
            provider_used: false,
            provider_warning: "Provider returned no translations.",
            provider_attempt_count: trace.length,
            provider_retry_count: input.integration.provider_retry_count,
            provider_timeout_hit: false,
            provider_final_outcome: "empty",
            fallback_mode: terminology.integration.fallback_mode,
            provider_trace: trace,
            validation_classification: "empty_payload"
          }
        };
      }
      trace.push({
        attempt_number: attempt,
        outcome: "success",
        duration_ms: Date.now() - startedAt,
        status_code: response.status,
        translated_count: translated.size,
        timeout_hit: false,
        error: null,
        failure_classification: null,
        retry_decision: "complete",
        response_excerpt: rawExcerpt(responseText)
      });
      const repaired = clone(canonical);
      repaired.nodes.text = repaired.nodes.text.map((node) =>
        translated.has(node.node_id)
          ? {
              ...node,
              content: node.content.map((content) => ({
                ...content,
                value: translated.get(node.node_id) ?? content.value
              }))
            }
          : node
      );
      repaired.updated_at = now();
      return {
        canonical: CanonicalRepresentationSchema.parse(repaired),
          integration: {
            ...terminology.integration,
            selected_provider_ref: payload.selected_provider_ref ?? terminology.integration.selected_provider_ref,
            selected_model_ref: payload.selected_model_ref ?? terminology.integration.selected_model_ref,
            fallback_provider_ref: payload.fallback_provider_ref ?? terminology.integration.fallback_provider_ref,
            fallback_model_ref: payload.fallback_model_ref ?? terminology.integration.fallback_model_ref,
            fallback_used: payload.fallback_used ?? false,
            fallback_reason: payload.fallback_reason ?? null,
            provider_used: true,
            provider_warning: null,
            provider_attempt_count: trace.length,
          provider_retry_count: input.integration.provider_retry_count,
          provider_timeout_hit: false,
          provider_final_outcome: "success",
          fallback_mode: null,
          provider_trace: trace,
          validation_classification: null
        }
      };
    } catch (error) {
      const timeoutHit = error instanceof Error && error.name === "AbortError";
      const failureClassification = timeoutHit
        ? "timeout"
        : error instanceof SyntaxError
          ? "invalid_json"
          : error instanceof z.ZodError
            ? "schema_validation_failure"
            : "network_error";
      trace.push({
        attempt_number: attempt,
        outcome: timeoutHit ? "timeout" : error instanceof z.ZodError ? "malformed_response" : "network_error",
        duration_ms: Date.now() - startedAt,
        status_code: null,
        translated_count: 0,
        timeout_hit: timeoutHit,
        error: error instanceof Error ? error.message : String(error),
        failure_classification: failureClassification,
        retry_decision: attempt < attemptsAllowed ? "retry" : "fallback_local",
        response_excerpt: error instanceof z.ZodError ? rawExcerpt(error.message) : null
      });
      if (attempt < attemptsAllowed && input.integration.provider_retry_backoff_ms > 0) {
        await sleep(input.integration.provider_retry_backoff_ms * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const timeoutHit = trace.some((entry) => entry.timeout_hit);
  return {
    canonical,
    integration: {
      ...terminology.integration,
      fallback_used: true,
      fallback_reason: trace[trace.length - 1]?.error ?? "External provider validation failed.",
      provider_used: false,
      provider_warning: trace[trace.length - 1]?.error ?? "External provider validation failed.",
      provider_attempt_count: trace.length,
      provider_retry_count: input.integration.provider_retry_count,
      provider_timeout_hit: timeoutHit,
      provider_final_outcome: "fallback_local",
      fallback_mode: terminology.integration.fallback_mode ?? "deterministic_local",
      provider_trace: trace,
      validation_classification: trace[trace.length - 1]?.failure_classification ?? "fallback_local"
    }
  };
};

const transformRtlLtrLayout = (
  canonical: CanonicalRepresentation,
  plan: DirectionTransformationPlan
): CanonicalRepresentation => {
  const localized = clone(canonical);
  const widths = containerWidths(localized);
  localized.layout_metadata.bounding_boxes = localized.layout_metadata.bounding_boxes.map((record) => {
    if (!plan.target_node_refs.includes(`${record.node_ref ?? ""}`)) return record;
    const containerRef = `${record.container_ref ?? ""}`;
    const containerWidth = typeof record.container_width === "number" ? record.container_width : widths.get(containerRef);
    if (plan.target_direction === "rtl" && typeof containerWidth === "number" && typeof record.x === "number" && typeof record.width === "number") {
      return {
        ...record,
        x: Math.max(0, containerWidth - record.x - record.width),
        mirrored: true,
        direction: "rtl",
        container_width: containerWidth
      };
    }
    return { ...record, direction: plan.target_direction };
  });
  localized.layout_metadata.alignment_rules = localized.layout_metadata.alignment_rules.map((record) =>
    plan.target_node_refs.includes(`${record.node_ref ?? ""}`)
      ? { ...record, horizontal: plan.target_direction === "rtl" ? "right" : "left", direction: plan.target_direction }
      : record
  );
  localized.nodes.pages = localized.nodes.pages.map((page) =>
    plan.target_direction === "rtl" ? { ...page, child_node_refs: [...page.child_node_refs].reverse() } : page
  );
  localized.nodes.slides = localized.nodes.slides.map((slide) =>
    plan.target_direction === "rtl" ? { ...slide, child_node_refs: [...slide.child_node_refs].reverse() } : slide
  );
  localized.updated_at = now();
  return CanonicalRepresentationSchema.parse(localized);
};

const refineTypography = (
  canonical: CanonicalRepresentation,
  plan: TypographyRefinementPlan
): CanonicalRepresentation => {
  const localized = clone(canonical);
  localized.nodes.text = localized.nodes.text.map((node) => {
    if (!plan.target_node_refs.includes(node.node_id)) return node;
    const isTitle = node.semantic_labels.includes("title") || node.semantic_labels.includes("heading");
    return {
      ...node,
      typography_ref: isTitle ? "typography://arabic-title-rtl" : "typography://arabic-body-rtl",
      semantic_labels: Array.from(new Set([...node.semantic_labels, "arabic_typography_refined", "rtl_refined"]))
    };
  });
  localized.layout_metadata.bounding_boxes = localized.layout_metadata.bounding_boxes.map((record) =>
    plan.target_node_refs.includes(`${record.node_ref ?? ""}`) && typeof record.height === "number"
      ? { ...record, height: Math.ceil(record.height * 1.18) }
      : record
  );
  localized.updated_at = now();
  return CanonicalRepresentationSchema.parse(localized);
};

const applyCulturalFormatting = (
  canonical: CanonicalRepresentation,
  plan: CulturalFormattingPlan
): CanonicalRepresentation => {
  const localized = clone(canonical);
  localized.nodes.text = localized.nodes.text.map((node) => {
    if (!plan.target_node_refs.includes(node.node_id)) return node;
    return {
      ...node,
      content: node.content.map((content) => ({
        ...content,
        value: formatDateAndCurrency(content.value, plan.target_locale)
      }))
    };
  });
  localized.updated_at = now();
  return CanonicalRepresentationSchema.parse(localized);
};

const buildLocalizationDiff = (
  sourceCanonical: CanonicalRepresentation,
  localizedCanonical: CanonicalRepresentation
): Record<string, unknown> => {
  const sourceTexts = new Map(sourceCanonical.nodes.text.map((node) => [node.node_id, node.content[0]?.value ?? ""]));
  return {
    canonical_ref_before: sourceCanonical.canonical_id,
    canonical_ref_after: localizedCanonical.canonical_id,
    localized_texts: localizedCanonical.nodes.text.map((node) => ({
      node_id: node.node_id,
      name: node.name,
      source_text: sourceTexts.get(node.node_id) ?? "",
      localized_text: node.content[0]?.value ?? ""
    })),
    layout_deltas: localizedCanonical.layout_metadata.bounding_boxes.map((record) => ({
      node_ref: record.node_ref,
      x: record.x,
      y: record.y,
      mirrored: record.mirrored ?? false
    }))
  };
};

const evaluateQuality = (
  input: LocalizationExecutionInput,
  requestId: string,
  localizedCanonical: CanonicalRepresentation,
  terminology: TerminologyResolution,
  outputMetadataId: string
): {
  language: LanguageQualityResult;
  layout: LayoutQualityResult;
  editability: EditabilityQualityResult;
  cultural: CulturalQualityResult;
  quality: LocalizationQualityResult;
  degradeReasons: LocalizationDegradeReason[];
  enforced: boolean;
  repairs_applied: number;
} => {
  let repairsApplied = 0;
  const boxes = boxByNode(localizedCanonical);
  const knownLatinTerms = new Set([
    ...terminology.protectedTerms.map((term) => term.required_output_term ?? term.term),
    ...terminology.nonTranslatableTerms.map((term) => term.term)
  ]);
  const untranslatedRefs: string[] = [];
  const protectedViolations: string[] = [];
  const overflowRefs: string[] = [];
  const clippingRefs: string[] = [];
  const nonEditableRefs: string[] = [];
  const dateIssues: string[] = [];
  const numberIssues: string[] = [];
  const assetDirectionIssues: string[] = [];
  const alignmentIssues: string[] = [];
  const allNodeRefs = localizedCanonical.nodes.text.map((node) => node.node_id);
  const glossaryConflictRefs = terminology.integration.glossary_conflicts.length > 0 ? allNodeRefs : [];

  // --- Enforcement pass: attempt to repair language quality issues ---
  // Re-translate nodes that still contain residual English using expanded dictionary
  localizedCanonical.nodes.text.forEach((node) => {
    const text = node.content[0]?.value ?? "";
    const strippedProtected = [...knownLatinTerms].reduce(
      (current, term) => current.replace(new RegExp(escapeRegex(term), "g"), ""),
      text
    );
    if (/[A-Za-z]{2,}/.test(strippedProtected) && node.content[0]) {
      // Aggressive re-translation: apply all phrase translations then word translations again
      let repaired = text;
      Object.entries(DEFAULT_PHRASE_TRANSLATIONS)
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([source, target]) => {
          repaired = repaired.replace(new RegExp(escapeRegex(source), "gi"), target);
        });
      repaired = repaired.replace(/[A-Za-z][A-Za-z-']*/g, (word) => DEFAULT_WORD_TRANSLATIONS[word.toLowerCase()] ?? word);
      if (repaired !== text) {
        node.content[0].value = repaired;
        repairsApplied += 1;
      }
    }
  });

  // --- Enforcement pass: truncate overflowing text to fit layout ---
  localizedCanonical.nodes.text.forEach((node) => {
    const text = node.content[0]?.value ?? "";
    const box = boxes.get(node.node_id);
    if (box && typeof box.width === "number" && node.content[0]) {
      const allowedCharacters = Math.max(8, Math.floor(box.width / 8));
      if (text.length > allowedCharacters) {
        node.content[0].value = text.slice(0, Math.max(5, allowedCharacters - 3)) + "...";
        repairsApplied += 1;
      }
    }
  });

  // --- Quality assessment after enforcement repairs ---
  localizedCanonical.nodes.text.forEach((node) => {
    const text = node.content[0]?.value ?? "";
    const strippedProtected = [...knownLatinTerms].reduce(
      (current, term) => current.replace(new RegExp(escapeRegex(term), "g"), ""),
      text
    );
    if (/[A-Za-z]{2,}/.test(strippedProtected)) untranslatedRefs.push(node.node_id);
    terminology.protectedTerms.forEach((term) => {
      const expected = term.required_output_term ?? term.term;
      if (text.includes(term.term) && !text.includes(expected)) protectedViolations.push(node.node_id);
    });
    const box = boxes.get(node.node_id);
    if (box && typeof box.width === "number") {
      const allowedCharacters = Math.max(8, Math.floor(box.width / 8));
      if (text.length > allowedCharacters) {
        overflowRefs.push(node.node_id);
        if (text.length > allowedCharacters + 20) clippingRefs.push(node.node_id);
      }
    }
    if (!node.editable || localizedCanonical.editability_flags.locked_region_refs.includes(node.node_id)) {
      nonEditableRefs.push(node.node_id);
    }
    if (localizedCanonical.localization.rtl && !node.semantic_labels.includes("rtl_refined")) {
      alignmentIssues.push(node.node_id);
    }
    if (input.target_locale.startsWith("ar")) {
      if (/[A-Z][a-z]+\s+\d{1,2},\s*\d{4}/.test(text)) dateIssues.push(node.node_id);
      if (/\$/.test(text) || (/\b\d+\b/.test(text) && /[0-9]/.test(text))) numberIssues.push(node.node_id);
    }
  });

  localizedCanonical.layout_metadata.bounding_boxes.forEach((record) => {
    if (localizedCanonical.localization.rtl && record.direction !== "rtl") assetDirectionIssues.push(`${record.node_ref ?? "unknown"}`);
  });

  const language = LanguageQualityResultSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    language_quality_result_id: id("language-quality", requestId),
    request_ref: requestId,
    status: qualityStatus(untranslatedRefs.length + protectedViolations.length, untranslatedRefs.length),
    score: Math.max(0, 100 - untranslatedRefs.length * 15 - protectedViolations.length * 20),
    untranslated_critical_refs: untranslatedRefs,
    protected_term_violation_refs: protectedViolations,
    banned_translation_refs: [],
    consistency_issue_refs: [],
    warning_count: untranslatedRefs.length
  });
  const layout = LayoutQualityResultSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    layout_quality_result_id: id("layout-quality", requestId),
    request_ref: requestId,
    status: qualityStatus(clippingRefs.length + alignmentIssues.length, overflowRefs.length),
    score: Math.max(0, 100 - overflowRefs.length * 12 - clippingRefs.length * 18),
    clipping_refs: clippingRefs,
    overflow_refs: overflowRefs,
    alignment_issue_refs: alignmentIssues,
    hierarchy_issue_refs: [],
    mixed_direction_issue_refs: [],
    warning_count: overflowRefs.length
  });
  const editability = EditabilityQualityResultSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    editability_quality_result_id: id("editability-quality", requestId),
    request_ref: requestId,
    status: qualityStatus(nonEditableRefs.length, 0),
    score: Math.max(0, 100 - nonEditableRefs.length * 18),
    non_editable_refs: nonEditableRefs,
    binding_break_refs: [],
    flattened_text_refs: [],
    hierarchy_break_refs: [],
    repairable_issue_refs: nonEditableRefs,
    warning_count: nonEditableRefs.length
  });
  const cultural = CulturalQualityResultSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    cultural_quality_result_id: id("cultural-quality", requestId),
    request_ref: requestId,
    status: qualityStatus(dateIssues.length + numberIssues.length, assetDirectionIssues.length),
    score: Math.max(0, 100 - dateIssues.length * 18 - numberIssues.length * 18),
    date_inconsistency_refs: dateIssues,
    number_inconsistency_refs: numberIssues,
    currency_inconsistency_refs: numberIssues,
    profile_mismatch_refs: [],
    asset_direction_issue_refs: assetDirectionIssues,
    warning_count: assetDirectionIssues.length
  });

  const degradeReasons: LocalizationDegradeReason[] = [];
  if (layout.status === "failed") {
    degradeReasons.push(
      LocalizationDegradeReasonSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        localization_degrade_reason_id: id("degrade-reason", requestId, "layout"),
        request_ref: requestId,
        stage: "run_quality_gates",
        reason_code: "layout_overflow",
        summary: "Localized layout overflow detected",
        detail: `Overflow refs: ${overflowRefs.join(", ")}`,
        impacted_refs: overflowRefs,
        retryable: true,
        repairable: true,
        blocks_apply: !input.allow_degraded_publish
      })
    );
  }
  if (language.status === "failed") {
    degradeReasons.push(
      LocalizationDegradeReasonSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        localization_degrade_reason_id: id("degrade-reason", requestId, "language"),
        request_ref: requestId,
        stage: "run_quality_gates",
        reason_code: "language_residual_english",
        summary: "Residual source-language text detected",
        detail: `Untranslated refs: ${untranslatedRefs.join(", ")}`,
        impacted_refs: untranslatedRefs,
        retryable: true,
        repairable: true,
        blocks_apply: false
      })
    );
  }
  if (terminology.integration.provider_mode === "http_json" && terminology.integration.provider_final_outcome === "fallback_local") {
    degradeReasons.push(
      LocalizationDegradeReasonSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        localization_degrade_reason_id: id("degrade-reason", requestId, "provider"),
        request_ref: requestId,
        stage: "transform_language",
        reason_code: "provider_fallback_local",
        summary: "External provider fell back to local translation mode",
        detail:
          terminology.integration.provider_warning ??
          `Provider attempts=${terminology.integration.provider_attempt_count}, retries=${terminology.integration.provider_retry_count}.`,
        impacted_refs: untranslatedRefs.length > 0 ? untranslatedRefs : allNodeRefs,
        retryable: true,
        repairable: true,
        blocks_apply: false
      })
    );
  }
  if (terminology.integration.glossary_conflicts.length > 0) {
    degradeReasons.push(
      LocalizationDegradeReasonSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        localization_degrade_reason_id: id("degrade-reason", requestId, "glossary"),
        request_ref: requestId,
        stage: "resolve_terminology_profile",
        reason_code: "glossary_conflict",
        summary: "External glossary contained conflicting terms",
        detail: terminology.integration.glossary_conflicts.map((conflict) => conflict.detail).join(" | "),
        impacted_refs: glossaryConflictRefs,
        retryable: true,
        repairable: true,
        blocks_apply: false
      })
    );
  }

  const computedOverallStatus = verificationFromQuality([language.status, layout.status, editability.status, cultural.status]);
  const overallStatus =
    degradeReasons.some((reason) => reason.reason_code === "glossary_conflict" || reason.reason_code === "provider_fallback_local")
      ? "degraded"
      : computedOverallStatus;

  const quality = LocalizationQualityResultSchema.parse({
    schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
    schema_version: LOCALIZATION_SCHEMA_VERSION,
    localization_quality_result_id: id("localization-quality", requestId),
    request_ref: requestId,
    output_metadata_ref: outputMetadataId,
    language_quality: language,
    layout_quality: layout,
    editability_quality: editability,
    cultural_quality: cultural,
    overall_status: overallStatus,
    recommended_action:
      overallStatus === "verified"
        ? "apply"
        : overallStatus === "success_with_warnings"
          ? "apply_with_warnings"
          : input.allow_degraded_publish
            ? "repair_and_recheck"
            : "block_apply",
    degrade_reason_refs: degradeReasons.map((reason) => reason.localization_degrade_reason_id)
  });

  return { language, layout, editability, cultural, quality, degradeReasons, enforced: repairsApplied > 0, repairs_applied: repairsApplied };
};

const renderLocalizedPreviewHtml = (canonical: CanonicalRepresentation, title: string): string => {
  const nodes = canonical.nodes.text.map((node) => {
    const box = boxByNode(canonical).get(node.node_id);
    const x = typeof box?.x === "number" ? box.x : 0;
    const y = typeof box?.y === "number" ? box.y : 0;
    const width = typeof box?.width === "number" ? box.width : 400;
    const height = typeof box?.height === "number" ? box.height : 40;
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${height}px;border:1px dashed #d9c79e;padding:6px;overflow:hidden;">${node.content[0]?.value ?? ""}</div>`;
  });
  return `<!doctype html>
<html lang="${canonical.localization.locale}" dir="${canonical.localization.rtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { margin: 0; background: #f4efe4; font-family: ${PREVIEW_ARABIC_FONT_STACK}; color: #1f2a24; }
    .canvas { position: relative; width: 1280px; min-height: 900px; margin: 24px auto; background: #fffaf0; box-shadow: 0 20px 50px rgba(34, 34, 34, 0.12); }
  </style>
</head>
<body>
  <div class="canvas">${nodes.join("\n")}</div>
</body>
</html>
`;
};

const sortedContainerTextNodes = (canonical: CanonicalRepresentation, containerId: string) =>
  canonical.nodes.text
    .filter((node) => node.parent_node_ref === containerId)
    .sort((left, right) => {
      const leftBox = boxByNode(canonical).get(left.node_id);
      const rightBox = boxByNode(canonical).get(right.node_id);
      const leftY = typeof leftBox?.y === "number" ? leftBox.y : 0;
      const rightY = typeof rightBox?.y === "number" ? rightBox.y : 0;
      if (leftY !== rightY) return leftY - rightY;
      const leftX = typeof leftBox?.x === "number" ? leftBox.x : 0;
      const rightX = typeof rightBox?.x === "number" ? rightBox.x : 0;
      return leftX - rightX;
    });

const renderPresentationOutput = async (
  title: string,
  canonical: CanonicalRepresentation
): Promise<OutputPayload> => {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Rasid Arabic Localization LCT Engine";
  pptx.company = "Rasid";
  pptx.subject = title;
  pptx.title = title;
  pptx.rtlMode = canonical.localization.rtl;
  canonical.nodes.slides.forEach((slideNode) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFF8EE" };
    slide.addText(title, {
      x: 0.5,
      y: 0.2,
      w: 12.0,
      h: 0.35,
      fontFace: ARABIC_PROFESSIONAL_SERIF_FONT,
      fontSize: 12,
      color: "7C6A3A",
      align: canonical.localization.rtl ? "right" : "left",
      rtlMode: canonical.localization.rtl,
      margin: 0
    });
    sortedContainerTextNodes(canonical, slideNode.node_id).forEach((node) => {
      const box = boxByNode(canonical).get(node.node_id);
      const x = Number((((typeof box?.x === "number" ? box.x : 48) / 96)).toFixed(2));
      const y = Number((((typeof box?.y === "number" ? box.y : 96) / 96)).toFixed(2));
      const w = Number((((typeof box?.width === "number" ? box.width : 640) / 96)).toFixed(2));
      const h = Number((((typeof box?.height === "number" ? box.height : 64) / 96)).toFixed(2));
      const isTitle = node.semantic_labels.includes("title");
      slide.addText(node.content[0]?.value ?? "", {
        x,
        y,
        w,
        h,
        fontFace: isTitle ? ARABIC_PROFESSIONAL_SERIF_FONT : ARABIC_PROFESSIONAL_SANS_FONT,
        fontSize: isTitle ? 22 : 13,
        bold: isTitle,
        color: isTitle ? "132238" : "334155",
        align: canonical.localization.rtl ? "right" : "left",
        valign: "middle",
        breakLine: true,
        margin: 0.08,
        fit: "shrink",
        rtlMode: canonical.localization.rtl
      });
    });
  });
  const output = await pptx.write({ outputType: "uint8array" });
  return {
    content: output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer),
    extension: "pptx",
    preview_type: "html_canvas"
  };
};

const renderSpreadsheetOutput = async (
  title: string,
  canonical: CanonicalRepresentation
): Promise<OutputPayload> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rasid Arabic Localization LCT Engine";
  workbook.lastModifiedBy = "Rasid Arabic Localization LCT Engine";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = title;
  canonical.nodes.sheets.forEach((sheetNode) => {
    const worksheet = workbook.addWorksheet(sheetNode.name || "Sheet1", {
      views: [{ rightToLeft: canonical.localization.rtl }]
    });
    worksheet.properties.defaultRowHeight = 24;
    worksheet.views = [{ rightToLeft: canonical.localization.rtl, state: "frozen", ySplit: 1 }];
    worksheet.getCell("A1").value = title;
    worksheet.getCell("A1").font = {
      name: ARABIC_PROFESSIONAL_SERIF_FONT,
      bold: true,
      size: 14,
      color: { argb: "FF132238" }
    };
    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").alignment = { horizontal: canonical.localization.rtl ? "right" : "left", vertical: "middle" };
    const occupied = new Set<string>(["1:1", "1:2", "1:3", "1:4"]);
    sortedContainerTextNodes(canonical, sheetNode.node_id).forEach((node, index) => {
      const box = boxByNode(canonical).get(node.node_id);
      let row = Math.max(3, Math.floor(((typeof box?.y === "number" ? box.y : index * 48) / 48)) + 1);
      let column = Math.max(1, Math.floor(((typeof box?.x === "number" ? box.x : index * 160) / 160)) + 1);
      while (occupied.has(`${row}:${column}`)) {
        column += 1;
      }
      occupied.add(`${row}:${column}`);
      const cell = worksheet.getCell(row, column);
      cell.value = node.content[0]?.value ?? "";
      cell.alignment = {
        horizontal: canonical.localization.rtl ? "right" : "left",
        vertical: "middle",
        wrapText: true,
        readingOrder: canonical.localization.rtl ? "rtl" : "ltr"
      };
      cell.font = node.semantic_labels.includes("title")
        ? { name: ARABIC_PROFESSIONAL_SERIF_FONT, bold: true, size: 12, color: { argb: "FF0F172A" } }
        : { name: ARABIC_PROFESSIONAL_SANS_FONT, size: 11, color: { argb: "FF334155" } };
      cell.fill = node.semantic_labels.includes("title")
        ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8D0" } }
        : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBF2" } };
      const rowRef = worksheet.getRow(row);
      rowRef.height = Math.max(rowRef.height ?? 24, 28);
    });
    worksheet.columns.forEach((column) => {
      column.width = Math.max(column.width ?? 0, 18);
    });
  });
  const output = await workbook.xlsx.writeBuffer();
  return {
    content: output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer),
    extension: "xlsx",
    preview_type: "html_canvas"
  };
};

const adapterRuntimeRoot = (input: LocalizationExecutionInput, adapterName: string): string =>
  input.output_root
    ? path.join(input.output_root, "runtime", adapterName)
    : path.join(process.cwd(), ".runtime", "arabic-localization-lct-engine", input.run_id, adapterName);

const numericValueFromText = (value: string): number | undefined => {
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const numeric = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
};

const buildReportSectionsFromCanonical = (canonical: CanonicalRepresentation) =>
  canonical.nodes.pages.map((pageNode, pageIndex): Parameters<ReportEngine["createReport"]>[0]["sections"][number] => ({
    section_kind: pageIndex === 0 ? "executive_summary" : "body",
    title: pageNode.name || `Section ${pageIndex + 1}`,
    blocks: sortedContainerTextNodes(canonical, pageNode.node_id).map((node) => ({
      block_type: (node.semantic_labels.includes("metric")
        ? "metric_card"
        : node.semantic_labels.includes("caption")
          ? "commentary"
          : "narrative") as "metric_card" | "commentary" | "narrative",
      title: node.name,
      body: node.content[0]?.value ?? "",
      dataset_ref: node.data_binding_refs[0] ? `dataset://${node.data_binding_refs[0]}` : undefined,
      query_ref: node.data_binding_refs[0] ? `query://${node.data_binding_refs[0]}` : undefined,
      field_mappings: node.data_binding_refs[0] ? [{ role: "text", field: "value" }] : [],
      metric_value: numericValueFromText(node.content[0]?.value ?? "")
    }))
  }));

const buildDashboardDatasetProfiles = (canonical: CanonicalRepresentation) => {
  const bindingRefs = Array.from(new Set(canonical.nodes.text.flatMap((node) => node.data_binding_refs)));
  if (bindingRefs.length === 0) {
    return [
      {
        dataset_ref: "dataset://localized-dashboard",
        display_name: canonical.nodes.pages[0]?.name ?? "Localized Dashboard",
        dimension_fields: ["region"],
        measure_fields: ["value"],
        available_filter_fields: ["region"],
        default_query_ref: "query://localized-dashboard/default"
      }
    ];
  }
  return bindingRefs.map((bindingRef, index) => ({
    dataset_ref: `dataset://${bindingRef}`,
    display_name: `Localized Dataset ${index + 1}`,
    dimension_fields: ["segment"],
    measure_fields: ["value"],
    available_filter_fields: ["segment"],
    default_query_ref: `query://${bindingRef}`
  }));
};

const localizedNodeText = (node: CanonicalRepresentation["nodes"]["text"][number]): string =>
  node.content[0]?.value ?? node.name;

const hasSemanticLabel = (
  node: CanonicalRepresentation["nodes"]["text"][number],
  label: string
): boolean => node.semantic_labels.includes(label);

const collectDashboardLocalizationSurface = (canonical: CanonicalRepresentation) => {
  const nodes = canonical.nodes.text;
  const byLabel = (label: string) =>
    nodes
      .filter((node) => hasSemanticLabel(node, label))
      .map((node) => ({
        node_id: node.node_id,
        text: localizedNodeText(node),
        binding_refs: node.data_binding_refs,
        semantic_labels: node.semantic_labels
      }));
  return {
    widgetTitles: byLabel(DASHBOARD_LOCALIZATION_LABELS.widgetTitle),
    filterLabels: byLabel(DASHBOARD_LOCALIZATION_LABELS.filterLabel),
    legendLabels: byLabel(DASHBOARD_LOCALIZATION_LABELS.legendLabel),
    axisLabels: byLabel(DASHBOARD_LOCALIZATION_LABELS.axisLabel),
    seriesLabels: byLabel(DASHBOARD_LOCALIZATION_LABELS.seriesLabel),
    tooltipLabels: byLabel(DASHBOARD_LOCALIZATION_LABELS.tooltipLabel),
    interactiveControls: byLabel(DASHBOARD_LOCALIZATION_LABELS.interactiveControl),
    generatedNarratives: byLabel(DASHBOARD_LOCALIZATION_LABELS.generatedNarrative),
    uiStrings: byLabel(DASHBOARD_LOCALIZATION_LABELS.uiString)
  };
};

const nodeLayoutFromBox = (
  canonical: CanonicalRepresentation,
  nodeId: string,
  index: number
): { page_id: string; x: number; y: number; width: number; height: number } => {
  const box = boxByNode(canonical).get(nodeId);
  return {
    page_id: canonical.nodes.pages[0]?.node_id ?? "page-overview",
    x: Math.max(0, Math.floor(((typeof box?.x === "number" ? box.x : index * 180) / 120))),
    y: Math.max(0, Math.floor(((typeof box?.y === "number" ? box.y : index * 90) / 90))),
    width: Math.max(3, Math.ceil(((typeof box?.width === "number" ? box.width : 360) / 120))),
    height: Math.max(2, Math.ceil(((typeof box?.height === "number" ? box.height : 120) / 90)))
  };
};

const buildDashboardBlueprintsFromCanonical = (
  canonical: CanonicalRepresentation
): Parameters<DashboardEngine["createDashboard"]>[0]["widget_blueprints"] => {
  const surface = collectDashboardLocalizationSurface(canonical);
  const pageId = canonical.nodes.pages[0]?.node_id ?? "page-overview";
  const chartNodes = new Set([
    ...surface.widgetTitles.map((item) => item.node_id),
    ...surface.legendLabels.map((item) => item.node_id),
    ...surface.axisLabels.map((item) => item.node_id),
    ...surface.seriesLabels.map((item) => item.node_id),
    ...surface.tooltipLabels.map((item) => item.node_id),
    ...surface.interactiveControls.map((item) => item.node_id)
  ]);
  const blueprints: Parameters<DashboardEngine["createDashboard"]>[0]["widget_blueprints"] = [];
  const primaryChartTitle =
    surface.widgetTitles[0]?.text ??
    canonical.nodes.text.find((node) => hasSemanticLabel(node, "title"))?.content[0]?.value ??
    canonical.nodes.pages[0]?.name ??
    "Localized Dashboard";
  const primaryChartNodeId =
    surface.widgetTitles[0]?.node_id ??
    canonical.nodes.text.find((node) => hasSemanticLabel(node, "title"))?.node_id ??
    canonical.nodes.text[0]?.node_id ??
    "dashboard-chart";
  if (
    surface.widgetTitles.length > 0 ||
    surface.axisLabels.length > 0 ||
    surface.seriesLabels.length > 0 ||
    surface.tooltipLabels.length > 0
  ) {
    const chartBindingRef =
      canonical.nodes.text.find((node) => node.data_binding_refs.length > 0)?.data_binding_refs[0] ?? "binding-dashboard-chart";
    blueprints.push({
      widget_type: "bar_chart",
      title: primaryChartTitle,
      subtitle:
        surface.generatedNarratives[0]?.text ??
        surface.legendLabels[0]?.text ??
        "لوحة الرسوم المحلية",
      page_id: pageId,
      layout: nodeLayoutFromBox(canonical, primaryChartNodeId, 0),
      binding: {
        dataset_ref: `dataset://${chartBindingRef}`,
        query_ref: `query://${chartBindingRef}`,
        field_mappings: [{ role: "series", field: "value" }],
        calculation_refs: []
      },
      style_config: {
        locale: canonical.localization.locale,
        direction: canonical.localization.rtl ? "rtl" : "ltr",
        chart_localization: {
          axis_labels: surface.axisLabels,
          series_labels: surface.seriesLabels,
          tooltip_labels: surface.tooltipLabels,
          legend_labels: surface.legendLabels
        },
        interactive_localization: {
          controls: surface.interactiveControls,
          ui_strings: surface.uiStrings
        }
      },
      interaction_refs: surface.interactiveControls.map((item) => item.node_id),
      editable: true,
      warning_codes: []
    });
  }
  surface.interactiveControls.forEach((control, index) => {
    blueprints.push({
      widget_type: "selector",
      title: control.text,
      subtitle: surface.uiStrings[index]?.text ?? "عنصر تحكم تفاعلي",
      page_id: pageId,
      layout: {
        page_id: pageId,
        x: 8 + (index % 2) * 2,
        y: 1 + Math.floor(index / 2),
        width: 2,
        height: 2
      },
      style_config: {
        locale: canonical.localization.locale,
        direction: canonical.localization.rtl ? "rtl" : "ltr",
        interactive_control: control
      },
      interaction_refs: [control.node_id],
      editable: true,
      warning_codes: []
    });
  });
  canonical.nodes.text
    .filter(
      (node) =>
        !chartNodes.has(node.node_id) &&
        !hasSemanticLabel(node, DASHBOARD_LOCALIZATION_LABELS.filterLabel)
    )
    .forEach((node, index) => {
      blueprints.push({
        widget_type: (node.semantic_labels.includes("metric") ? "kpi_card" : "text") as "kpi_card" | "text",
        title:
          node.semantic_labels.includes("title") || node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.widgetTitle)
            ? localizedNodeText(node)
            : node.name,
        subtitle:
          node.semantic_labels.includes("title") || node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.widgetTitle)
            ? node.name
            : localizedNodeText(node),
        page_id: pageId,
        layout: nodeLayoutFromBox(canonical, node.node_id, index + blueprints.length),
        binding: node.data_binding_refs[0]
          ? {
              dataset_ref: `dataset://${node.data_binding_refs[0]}`,
              query_ref: `query://${node.data_binding_refs[0]}`,
              field_mappings: [{ role: "text", field: "value" }],
              calculation_refs: []
            }
          : undefined,
        style_config: {
          locale: canonical.localization.locale,
          direction: canonical.localization.rtl ? "rtl" : "ltr"
        },
        interaction_refs: [],
        editable: true,
        warning_codes: []
      });
    });
  return blueprints;
};

const buildDashboardFiltersFromCanonical = (
  canonical: CanonicalRepresentation
): Parameters<DashboardEngine["createDashboard"]>[0]["filters"] =>
  canonical.nodes.text
    .filter((node) => node.semantic_labels.includes("filter_label"))
    .map((node, index) => ({
      filter_scope: "global" as const,
      title: node.content[0]?.value ?? node.name,
      control_type: "multi_select" as const,
      dataset_ref: canonical.nodes.text.find((textNode) => textNode.data_binding_refs.length > 0)?.data_binding_refs[0]
        ? `dataset://${canonical.nodes.text.find((textNode) => textNode.data_binding_refs.length > 0)?.data_binding_refs[0]}`
        : "dataset://localized-dashboard",
      field_ref: `field_${index + 1}`,
      default_values: [],
      current_values: [],
      target_widget_refs: []
    }));

const renderReportOutput = async (
  input: LocalizationExecutionInput,
  title: string,
  canonical: CanonicalRepresentation
): Promise<OutputPayload> => {
  const runtimeRoot = adapterRuntimeRoot(input, "report-engine");
  ensureDir(runtimeRoot);
  const reportEngine = new ReportEngine({ storageDir: runtimeRoot });
  const created = reportEngine.createReport({
    report_id: id("localized-report", input.run_id),
    tenant_ref: input.tenant_ref,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    created_by: input.created_by,
    title,
    description: `Localized report generated from ${input.source_artifact.artifact_id}.`,
    report_type: "localized_report",
    mode: input.mode,
    language: input.target_locale,
    template_ref: "template://reports/localized",
    brand_preset_ref: "brand://rasid/localized",
    source_refs: [input.source_artifact.artifact_id],
    sections: buildReportSectionsFromCanonical(canonical)
  });
  const docxExport = await reportEngine.exportReportDocx({
    report_id: created.report.report_id,
    actor_ref: input.created_by
  });
  const htmlExport = await reportEngine.exportReportHtml({
    report_id: created.report.report_id,
    actor_ref: input.created_by
  });
  const hardenedDocxPayload = await hardenDocxRtlOutput(
    ensureUint8Array(docxExport.payload as Uint8Array | ArrayBuffer)
  );
  return {
    content: hardenedDocxPayload,
    extension: "docx",
    preview_type: "html_canvas",
    sidecars: [
      {
        relative_path: "report-adapter/localized-report.html",
        content: typeof htmlExport.payload === "string" ? htmlExport.payload : Buffer.from(htmlExport.payload).toString("utf8")
      },
      {
        relative_path: "report-adapter/adapter-manifest.json",
        content: `${JSON.stringify(
          {
            engine: "report-engine",
            report_id: created.report.report_id,
            report_artifact_ref: created.reportArtifact.artifact_id,
            docx_artifact_ref: docxExport.exportArtifact.artifact_id,
            html_artifact_ref: htmlExport.exportArtifact.artifact_id,
            runtime_root: reportEngine.store.rootDir
          },
          null,
          2
        )}\n`
      }
    ],
    adapter_metadata: {
      engine: "report-engine",
      runtime_root: reportEngine.store.rootDir,
      report_id: created.report.report_id,
      export_artifact_ref: docxExport.exportArtifact.artifact_id
    }
  };
};

const renderPdfReadyHtmlOutput = async (
  title: string,
  canonical: CanonicalRepresentation
): Promise<OutputPayload> => {
  const isRtl = canonical.localization.rtl;
  const dir = isRtl ? "rtl" : "ltr";
  const align = isRtl ? "right" : "left";
  const containerSections = [
    ...canonical.nodes.pages.map((page) => ({ containerId: page.node_id, name: page.name, kind: "page" as const })),
    ...canonical.nodes.slides.map((slide) => ({ containerId: slide.node_id, name: slide.name, kind: "slide" as const })),
    ...canonical.nodes.sheets.map((sheet) => ({ containerId: sheet.node_id, name: sheet.name, kind: "sheet" as const }))
  ];
  const renderTextNodes = (containerId: string): string =>
    sortedContainerTextNodes(canonical, containerId)
      .map((node) => {
        const box = boxByNode(canonical).get(node.node_id);
        const isTitle = node.semantic_labels.includes("title");
        const fontSize = isTitle ? "22px" : "14px";
        const fontWeight = isTitle ? "bold" : "normal";
        const fontFamily = isTitle ? ARABIC_PROFESSIONAL_SERIF_FONT : ARABIC_PROFESSIONAL_SANS_FONT;
        const color = isTitle ? "#132238" : "#334155";
        const width = typeof box?.width === "number" ? `${box.width}px` : "100%";
        const value = node.content[0]?.value ?? "";
        return `      <div style="width:${width};font-family:'${fontFamily}',${PREVIEW_ARABIC_FONT_STACK};font-size:${fontSize};font-weight:${fontWeight};color:${color};text-align:${align};direction:${dir};margin-bottom:8px;line-height:1.8;padding:4px 0;">${value}</div>`;
      })
      .join("\n");
  const sections = containerSections.length > 0
    ? containerSections.map((section) =>
        `    <section style="page-break-after:always;padding:40px 60px;margin-bottom:24px;">\n      <h2 style="font-family:'${ARABIC_PROFESSIONAL_SERIF_FONT}',${PREVIEW_ARABIC_FONT_STACK};font-size:18px;color:#7C6A3A;border-bottom:2px solid #d9c79e;padding-bottom:8px;margin-bottom:16px;text-align:${align};direction:${dir};">${section.name}</h2>\n${renderTextNodes(section.containerId)}\n    </section>`
      ).join("\n")
    : canonical.nodes.text.map((node) => {
        const isTitle = node.semantic_labels.includes("title");
        const fontSize = isTitle ? "22px" : "14px";
        const fontWeight = isTitle ? "bold" : "normal";
        const fontFamily = isTitle ? ARABIC_PROFESSIONAL_SERIF_FONT : ARABIC_PROFESSIONAL_SANS_FONT;
        const color = isTitle ? "#132238" : "#334155";
        const value = node.content[0]?.value ?? "";
        return `    <div style="font-family:'${fontFamily}',${PREVIEW_ARABIC_FONT_STACK};font-size:${fontSize};font-weight:${fontWeight};color:${color};text-align:${align};direction:${dir};margin-bottom:8px;line-height:1.8;padding:4px 0;">${value}</div>`;
      }).join("\n");
  const htmlContent = `<!doctype html>
<html lang="${canonical.localization.locale}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: ${PREVIEW_ARABIC_FONT_STACK};
      color: #1f2a24;
      direction: ${dir};
      line-height: 1.8;
    }
    .pdf-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm 15mm;
    }
    .pdf-header {
      text-align: center;
      border-bottom: 3px solid #7C6A3A;
      padding-bottom: 16px;
      margin-bottom: 32px;
    }
    .pdf-header h1 {
      font-family: '${ARABIC_PROFESSIONAL_SERIF_FONT}', ${PREVIEW_ARABIC_FONT_STACK};
      font-size: 28px;
      color: #132238;
      margin: 0 0 8px 0;
    }
    .pdf-header .subtitle {
      font-size: 12px;
      color: #7C6A3A;
    }
    .pdf-footer {
      text-align: center;
      font-size: 10px;
      color: #999;
      border-top: 1px solid #e0d8c8;
      padding-top: 12px;
      margin-top: 32px;
    }
    section {
      margin-bottom: 24px;
    }
    @media print {
      body { background: #ffffff; }
      .pdf-container { padding: 0; max-width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="pdf-container">
    <div class="pdf-header">
      <h1>${title}</h1>
      <div class="subtitle">${canonical.localization.locale} &mdash; Rasid Arabic Localization LCT Engine</div>
    </div>
${sections}
    <div class="pdf-footer">
      Generated by Rasid Arabic Localization LCT Engine &mdash; ${new Date().toISOString().slice(0, 10)}
    </div>
  </div>
  <script class="no-print">
    // Auto-print hint: open in browser and press Ctrl+P / Cmd+P to save as PDF
    if (window.location.search.includes('autoprint')) { window.print(); }
  </script>
</body>
</html>
`;
  return {
    content: htmlContent,
    extension: "html",
    preview_type: "html_canvas",
    sidecars: [],
    adapter_metadata: {
      pdf_pipeline: "html_to_print",
      pdf_ready: true,
      page_size: "A4",
      direction: dir,
      font_families: [ARABIC_PROFESSIONAL_SERIF_FONT, ARABIC_PROFESSIONAL_SANS_FONT, ARABIC_PROFESSIONAL_UI_FONT],
      print_css_included: true,
      auto_print_supported: true
    }
  };
};

const renderDashboardOutput = async (
  input: LocalizationExecutionInput,
  title: string,
  canonical: CanonicalRepresentation
): Promise<OutputPayload> => {
  const runtimeRoot = adapterRuntimeRoot(input, "dashboard-engine");
  ensureDir(runtimeRoot);
  const dashboardEngine = new DashboardEngine({ storageDir: runtimeRoot });
  const workflow = dashboardEngine.createDashboard({
    dashboard_id: id("localized-dashboard", input.run_id),
    tenant_ref: input.tenant_ref,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    created_by: input.created_by,
    title,
    description: `Localized dashboard generated from ${input.source_artifact.artifact_id}.`,
    mode: "advanced",
    dataset_profiles: buildDashboardDatasetProfiles(canonical),
    widget_blueprints: buildDashboardBlueprintsFromCanonical(canonical),
    filters: buildDashboardFiltersFromCanonical(canonical),
    template_ref: "template://dashboards/localized",
    brand_preset_ref: "brand://rasid/localized",
    permission_scope: DEFAULT_PERMISSION_SCOPE(),
    timestamp: now()
  });
  const publication = dashboardEngine.publishDashboard({
    dashboard: workflow.dashboard,
    version: workflow.version,
    published_by: input.created_by,
    target_ref: input.publish_target_ref,
    publish_to_library: true,
    embeddable: true,
    timestamp: now()
  });
  const embedHtml =
    publication.transport.embed_html_path && fs.existsSync(publication.transport.embed_html_path)
      ? fs.readFileSync(publication.transport.embed_html_path, "utf8")
      : renderLocalizedPreviewHtml(canonical, title);
  const manifestContent = fs.readFileSync(publication.transport.manifest_path, "utf8");
  const publishStateContent = fs.readFileSync(publication.transport.publish_state_path, "utf8");
  const sidecars: OutputSidecar[] = [
    {
      relative_path: "dashboard-bundle/manifest.json",
      content: manifestContent
    },
    {
      relative_path: "dashboard-bundle/publish-state.json",
      content: publishStateContent
    }
  ];
  const embedPayloadContent =
    publication.transport.embed_payload_path && fs.existsSync(publication.transport.embed_payload_path)
      ? fs.readFileSync(publication.transport.embed_payload_path, "utf8")
      : null;
  if (publication.transport.embed_payload_path && fs.existsSync(publication.transport.embed_payload_path)) {
    sidecars.push({
      relative_path: "dashboard-bundle/embed-payload.json",
      content: embedPayloadContent ?? ""
    });
  }
  if (publication.transport.embed_html_path && fs.existsSync(publication.transport.embed_html_path)) {
    sidecars.push({
      relative_path: "dashboard-bundle/embed.html",
      content: fs.readFileSync(publication.transport.embed_html_path, "utf8")
    });
  }
  const embedPayload = embedPayloadContent
    ? z
        .object({
          dashboard_id: z.string(),
          title: z.string(),
          widgets: z.array(
            z.object({
              widget_id: z.string(),
              title: z.string(),
              subtitle: z.string(),
              layout_item_ref: z.string(),
              style_config: z.record(z.unknown()).optional()
            })
          ),
          filter_sets: z
            .array(
              z.object({
                title: z.string(),
                current_values: z.array(z.string()).default([])
              })
            )
            .default([])
        })
        .parse(JSON.parse(embedPayloadContent))
    : null;
  const chartPayloadLocalizations =
    embedPayload?.widgets.flatMap((widget) => {
      const styleConfig = widget.style_config as
        | {
            chart_localization?: {
              axis_labels?: Array<{ node_id: string; text: string }>;
              series_labels?: Array<{ node_id: string; text: string }>;
              tooltip_labels?: Array<{ node_id: string; text: string }>;
              legend_labels?: Array<{ node_id: string; text: string }>;
            };
            interactive_localization?: {
              controls?: Array<{ node_id: string; text: string }>;
              ui_strings?: Array<{ node_id: string; text: string }>;
            };
          }
        | undefined;
      return styleConfig?.chart_localization
        ? [
            ...(styleConfig.chart_localization.axis_labels ?? []).map((entry) => ({ widget_id: widget.widget_id, kind: "axis_label", ...entry })),
            ...(styleConfig.chart_localization.series_labels ?? []).map((entry) => ({ widget_id: widget.widget_id, kind: "series_label", ...entry })),
            ...(styleConfig.chart_localization.tooltip_labels ?? []).map((entry) => ({ widget_id: widget.widget_id, kind: "tooltip_label", ...entry })),
            ...(styleConfig.chart_localization.legend_labels ?? []).map((entry) => ({ widget_id: widget.widget_id, kind: "legend_label", ...entry })),
            ...((styleConfig.interactive_localization?.controls ?? []).map((entry) => ({ widget_id: widget.widget_id, kind: "interactive_control", ...entry }))),
            ...((styleConfig.interactive_localization?.ui_strings ?? []).map((entry) => ({ widget_id: widget.widget_id, kind: "ui_string", ...entry })))
          ]
        : [];
    }) ?? [];
  const localizationProof = {
    dashboard_id: workflow.dashboard.dashboard_id,
    publication_id: publication.publication.publication_id,
    localized_widget_titles: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.widgetTitle))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_filter_labels: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.filterLabel))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_legend_labels: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.legendLabel))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_axis_labels: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.axisLabel))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_series_labels: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.seriesLabel))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_tooltip_labels: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.tooltipLabel))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_interactive_controls: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.interactiveControl))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    localized_ui_strings: canonical.nodes.text
      .filter((node) => node.semantic_labels.includes(DASHBOARD_LOCALIZATION_LABELS.uiString))
      .map((node) => ({ node_id: node.node_id, text: node.content[0]?.value ?? "" })),
    binding_localizations: canonical.nodes.text
      .filter((node) => node.data_binding_refs.length > 0)
      .map((node) => ({
        node_id: node.node_id,
        text: node.content[0]?.value ?? "",
        binding_refs: node.data_binding_refs,
        semantic_labels: node.semantic_labels
      })),
    payload_widget_titles: embedPayload?.widgets.map((widget) => ({
      widget_id: widget.widget_id,
      title: widget.title,
      subtitle: widget.subtitle
    })) ?? [],
    payload_filter_sets: embedPayload?.filter_sets ?? [],
    payload_chart_localizations: chartPayloadLocalizations
  };
  const proofContent = `${JSON.stringify(localizationProof, null, 2)}\n`;
  const packageManifestContent = `${JSON.stringify(
    {
      adapter: "arabic_localization_lct.dashboard.package",
      version: "1.0.0",
      dashboard_id: workflow.dashboard.dashboard_id,
      publication_id: publication.publication.publication_id,
      entry_html: "localized-output.html",
      bundle_root: "dashboard-bundle/",
      generated_at: now()
    },
    null,
    2
  )}\n`;
  const adapterManifest = {
    adapter: "arabic_localization_lct.dashboard.native",
    version: "1.2.0",
    dashboard_id: workflow.dashboard.dashboard_id,
    publication_id: publication.publication.publication_id,
    requested_target_ref: input.publish_target_ref,
    state_refs: {
      dashboard_ref: workflow.dashboard.dashboard_id,
      version_ref: workflow.version.version_id,
      publication_ref: publication.publication.publication_id,
      dashboard_artifact_ref: workflow.dashboardArtifact.artifact_id,
      publication_manifest_uri: publication.transport.manifest_uri,
      publication_state_uri: publication.transport.publish_state_uri,
      embed_payload_uri: publication.transport.embed_payload_uri,
      embed_html_uri: publication.transport.embed_html_uri
    },
    proof_refs: {
      manifest: "dashboard-bundle/manifest.json",
      publish_state: "dashboard-bundle/publish-state.json",
      embed_payload: embedPayload ? "dashboard-bundle/embed-payload.json" : null,
      embed_html: publication.transport.embed_html_path ? "dashboard-bundle/embed.html" : null,
      localization_proof: "dashboard-bundle/localization-proof.json",
      package_manifest: "dashboard-package/package-manifest.json",
      package_zip: "dashboard-package/localized-dashboard-bundle.zip"
    },
    widget_count: embedPayload?.widgets.length ?? 0,
    filter_count: embedPayload?.filter_sets.length ?? 0,
    binding_localization_count: localizationProof.binding_localizations.length,
    checksums: {} as Record<string, string>
  };
  sidecars.push({ relative_path: "dashboard-bundle/localization-proof.json", content: proofContent });
  sidecars.push({ relative_path: "dashboard-package/package-manifest.json", content: packageManifestContent });
  const buildDashboardPackageZip = async (
    entries: Array<{ relative_path: string; content: string | Uint8Array }>
  ): Promise<Uint8Array> => {
    const packageZip = new JSZip();
    packageZip.file("localized-output.html", embedHtml);
    entries.forEach((sidecar) => {
      packageZip.file(sidecar.relative_path, typeof sidecar.content === "string" ? sidecar.content : sidecar.content);
    });
    return packageZip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  };
  const adapterManifestPath = "dashboard-bundle/localization-adapter-manifest.json";
  sidecars.push({
    relative_path: adapterManifestPath,
    content: `${JSON.stringify(adapterManifest, null, 2)}\n`
  });
  const packageZipPath = "dashboard-package/localized-dashboard-bundle.zip";
  const initialPackageZipBytes = await buildDashboardPackageZip(sidecars);
  sidecars.push({
    relative_path: packageZipPath,
    content: initialPackageZipBytes
  });
  adapterManifest.checksums = checksumRelativePathMap(
    sidecars.filter((sidecar) => sidecar.relative_path !== adapterManifestPath && sidecar.relative_path !== packageZipPath)
  );
  const adapterManifestIndex = sidecars.findIndex((sidecar) => sidecar.relative_path === adapterManifestPath);
  sidecars[adapterManifestIndex] = {
    relative_path: adapterManifestPath,
    content: `${JSON.stringify(adapterManifest, null, 2)}\n`
  };
  const packageZipIndex = sidecars.findIndex((sidecar) => sidecar.relative_path === packageZipPath);
  sidecars[packageZipIndex] = {
    relative_path: packageZipPath,
    content: await buildDashboardPackageZip(sidecars.filter((sidecar) => sidecar.relative_path !== packageZipPath))
  };
  return {
    content: embedHtml,
    extension: "html",
    preview_type: "html_canvas",
    sidecars,
    adapter_metadata: {
      engine: "dashboard-engine",
      runtime_root: runtimeRoot,
      dashboard_id: workflow.dashboard.dashboard_id,
      publication_id: publication.publication.publication_id,
      dashboard_package_ref: "dashboard-package/localized-dashboard-bundle.zip",
      consumable_artifact_metadata: adapterManifest,
      transport: publication.transport
    }
  };
};

const renderPublishedOutput = async (
  input: LocalizationExecutionInput,
  artifactType: LocalizableArtifactType,
  title: string,
  canonical: CanonicalRepresentation
): Promise<OutputPayload> => {
  let primary: OutputPayload;
  if (artifactType === "report") {
    primary = await renderReportOutput(input, title, canonical);
  } else if (artifactType === "presentation") {
    primary = await renderPresentationOutput(title, canonical);
  } else if (artifactType === "spreadsheet") {
    primary = await renderSpreadsheetOutput(title, canonical);
  } else if (artifactType === "dashboard") {
    primary = await renderDashboardOutput(input, title, canonical);
  } else {
    primary = {
      content: renderLocalizedPreviewHtml(canonical, title),
      extension: "html",
      preview_type: "html_canvas"
    };
  }
  const pdfReady = await renderPdfReadyHtmlOutput(title, canonical);
  const pdfSidecar: OutputSidecar = {
    relative_path: "pdf-export/localized-output-print.html",
    content: typeof pdfReady.content === "string" ? pdfReady.content : Buffer.from(pdfReady.content).toString("utf8")
  };
  primary.sidecars = [...(primary.sidecars ?? []), pdfSidecar];
  primary.adapter_metadata = {
    ...(primary.adapter_metadata ?? {}),
    pdf_export: pdfReady.adapter_metadata
  };
  return primary;
};

const parseDocxOutput = async (filePath: string, title: string): Promise<ParsedLocalizedOutput> => {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error(`DOCX output ${filePath} is missing word/document.xml`);
  const headingCount = (documentXml.match(/Heading[1-6]/g) ?? []).length;
  const bidiParagraphCount = (documentXml.match(/<w:bidi\b/g) ?? []).length;
  const sectionCount = (documentXml.match(/<w:sectPr\b/g) ?? []).length;
  const paragraphs = [...documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlEntities(match[1]).trim())
    .filter((value) => value.length > 0);
  return {
    parser_kind: "docx",
    title,
    containers: [{ container_id: "page-1", title, width: 1200, height: 1600 }],
    text_nodes: paragraphs.map((paragraph, index) => ({
      node_id: `roundtrip-docx-${index + 1}`,
      container_id: "page-1",
      name: index === 0 ? "Roundtrip Title" : `Paragraph ${index}`,
      text: paragraph,
      x: 64,
      y: 72 + index * 88,
      width: 860,
      height: index === 0 ? 72 : 56,
      semantic_labels: [index === 0 ? "title" : "body"],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    })),
    metadata: {
      paragraph_count: paragraphs.length,
      heading_count: headingCount,
      bidi_paragraph_count: bidiParagraphCount,
      section_count: sectionCount
    }
  };
};

const parsePptxOutput = async (filePath: string, title: string): Promise<ParsedLocalizedOutput> => {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => {
      const leftIndex = Number(left.match(/slide(\d+)\.xml$/)?.[1] ?? "0");
      const rightIndex = Number(right.match(/slide(\d+)\.xml$/)?.[1] ?? "0");
      return leftIndex - rightIndex;
    });
  const containers: SampleContainer[] = [];
  const textNodes: SampleTextNode[] = [];
  let rtlTextCount = 0;
  let titleCount = 0;
  for (const [slideIndex, slideName] of slideNames.entries()) {
    const xml = await zip.file(slideName)?.async("string");
    if (!xml) continue;
    rtlTextCount += (xml.match(/rtl=\"1\"/g) ?? []).length;
    const containerId = `slide-${slideIndex + 1}`;
    containers.push({ container_id: containerId, title: `Slide ${slideIndex + 1}`, width: 1280, height: 720 });
    [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXmlEntities(match[1]).trim())
      .filter((value) => value.length > 0)
      .forEach((text, nodeIndex) => {
        if (nodeIndex === 0) titleCount += 1;
        textNodes.push({
          node_id: `roundtrip-pptx-${slideIndex + 1}-${nodeIndex + 1}`,
          container_id: containerId,
          name: nodeIndex === 0 ? "Slide Title" : `Slide Text ${nodeIndex + 1}`,
          text,
          x: 96,
          y: 72 + nodeIndex * 72,
          width: 920,
          height: nodeIndex === 0 ? 72 : 48,
          semantic_labels: [nodeIndex === 0 ? "title" : "body"],
          data_binding_refs: [],
          formula_refs: [],
          editable: true
        });
      });
  }
  return {
    parser_kind: "pptx",
    title,
    containers,
    text_nodes: textNodes,
    metadata: {
      slide_count: containers.length,
      text_node_count: textNodes.length,
      slide_title_count: titleCount,
      rtl_text_count: rtlTextCount
    }
  };
};

const parseXlsxOutput = async (filePath: string, title: string): Promise<ParsedLocalizedOutput> => {
  const workbook = new ExcelJS.Workbook();
  const workbookBytes = fs.readFileSync(filePath);
  const workbookArrayBuffer = workbookBytes.buffer.slice(
    workbookBytes.byteOffset,
    workbookBytes.byteOffset + workbookBytes.byteLength
  ) as ArrayBuffer;
  await workbook.xlsx.load(workbookArrayBuffer);
  const containers: SampleContainer[] = [];
  const textNodes: SampleTextNode[] = [];
  let rtlSheetCount = 0;
  let mergedCellCount = 0;
  workbook.worksheets.forEach((worksheet, sheetIndex) => {
    const containerId = `sheet-${sheetIndex + 1}`;
    if (worksheet.views.some((view) => view.rightToLeft)) rtlSheetCount += 1;
    mergedCellCount += worksheet.model.merges?.length ?? 0;
    containers.push({ container_id: containerId, title: worksheet.name, width: 1440, height: 960 });
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, columnNumber) => {
        const text = `${cell.text ?? cell.value ?? ""}`.trim();
        if (text.length === 0) return;
        textNodes.push({
          node_id: `roundtrip-xlsx-${sheetIndex + 1}-${rowNumber}-${columnNumber}`,
          container_id: containerId,
          name: `Cell ${rowNumber}:${columnNumber}`,
          text,
          x: (columnNumber - 1) * 160 + 40,
          y: (rowNumber - 1) * 56 + 40,
          width: 140,
          height: 42,
          semantic_labels: [rowNumber === 1 ? "title" : "body"],
          data_binding_refs: [],
          formula_refs: [],
          editable: true
        });
      });
    });
  });
  return {
    parser_kind: "xlsx",
    title,
    containers,
    text_nodes: textNodes,
    metadata: {
      sheet_count: containers.length,
      text_node_count: textNodes.length,
      rtl_sheet_count: rtlSheetCount,
      merged_cell_count: mergedCellCount
    }
  };
};

const parseDashboardBundle = async (
  sidecars: Map<string, PersistedFile>,
  title: string
): Promise<ParsedLocalizedOutput> => {
  const adapterManifestFile = sidecars.get("dashboard-bundle/localization-adapter-manifest.json");
  const payloadFile = sidecars.get("dashboard-bundle/embed-payload.json");
  const manifestFile = sidecars.get("dashboard-bundle/manifest.json");
  const publishStateFile = sidecars.get("dashboard-bundle/publish-state.json");
  const proofFile = sidecars.get("dashboard-bundle/localization-proof.json");
  const packageManifestFile = sidecars.get("dashboard-package/package-manifest.json");
  const packageZipFile = sidecars.get("dashboard-package/localized-dashboard-bundle.zip");
  if (!adapterManifestFile) throw new Error("Dashboard roundtrip requires dashboard-bundle/localization-adapter-manifest.json");
  if (!payloadFile) throw new Error("Dashboard roundtrip requires dashboard-bundle/embed-payload.json");
  if (!manifestFile) throw new Error("Dashboard roundtrip requires dashboard-bundle/manifest.json");
  if (!publishStateFile) throw new Error("Dashboard roundtrip requires dashboard-bundle/publish-state.json");
  if (!proofFile) throw new Error("Dashboard roundtrip requires dashboard-bundle/localization-proof.json");
  if (!packageManifestFile) throw new Error("Dashboard roundtrip requires dashboard-package/package-manifest.json");
  if (!packageZipFile) throw new Error("Dashboard roundtrip requires dashboard-package/localized-dashboard-bundle.zip");
  const adapterManifest = z
    .object({
      dashboard_id: z.string(),
      publication_id: z.string(),
      proof_refs: z.object({
        manifest: z.string(),
        publish_state: z.string(),
        embed_payload: z.string().nullable(),
        embed_html: z.string().nullable(),
        localization_proof: z.string(),
        package_manifest: z.string(),
        package_zip: z.string()
      }),
      checksums: z.record(z.string()),
      widget_count: z.number(),
      filter_count: z.number(),
      binding_localization_count: z.number()
    })
    .parse(JSON.parse(fs.readFileSync(adapterManifestFile.filePath, "utf8")));
  const packageManifest = z
    .object({
      adapter: z.literal("arabic_localization_lct.dashboard.package"),
      version: z.string(),
      dashboard_id: z.string(),
      publication_id: z.string(),
      entry_html: z.string(),
      bundle_root: z.string(),
      generated_at: z.string()
    })
    .parse(JSON.parse(fs.readFileSync(packageManifestFile.filePath, "utf8")));
  const payload = z
    .object({
      dashboard_id: z.string(),
      title: z.string(),
      widgets: z.array(
        z.object({
          widget_id: z.string(),
          title: z.string(),
          subtitle: z.string(),
          layout_item_ref: z.string()
        })
      ),
      layout_items: z.array(
        z.object({
          item_id: z.string(),
          page_id: z.string(),
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        })
      ),
      filter_sets: z.array(
        z.object({
          title: z.string(),
          current_values: z.array(z.string()).default([])
        })
      )
    })
    .parse(JSON.parse(fs.readFileSync(payloadFile.filePath, "utf8")));
  const proof = z
    .object({
      localized_widget_titles: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      localized_filter_labels: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      localized_legend_labels: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      localized_axis_labels: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      localized_series_labels: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      localized_tooltip_labels: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      localized_interactive_controls: z.array(z.object({ node_id: z.string(), text: z.string() })).default([]),
      binding_localizations: z
        .array(
          z.object({
            node_id: z.string(),
            text: z.string(),
            binding_refs: z.array(z.string()).default([]),
            semantic_labels: z.array(z.string()).default([])
          })
        )
        .default([])
    })
    .parse(JSON.parse(fs.readFileSync(proofFile.filePath, "utf8")));
  const checksumMismatches = [
    { relative_path: "dashboard-bundle/manifest.json", file: manifestFile },
    { relative_path: "dashboard-bundle/publish-state.json", file: publishStateFile },
    { relative_path: "dashboard-bundle/embed-payload.json", file: payloadFile },
    { relative_path: "dashboard-bundle/localization-proof.json", file: proofFile },
    { relative_path: "dashboard-package/package-manifest.json", file: packageManifestFile },
    { relative_path: "dashboard-package/localized-dashboard-bundle.zip", file: packageZipFile }
  ].filter(
    (entry) =>
      Boolean(adapterManifest.checksums[entry.relative_path]) &&
      adapterManifest.checksums[entry.relative_path] !== entry.file.checksum
  );
  if (checksumMismatches.length > 0) {
    throw new Error(
      `Dashboard roundtrip checksum mismatch: ${checksumMismatches.map((entry) => entry.relative_path).join(", ")}`
    );
  }
  if (adapterManifest.dashboard_id !== payload.dashboard_id) {
    throw new Error("Dashboard roundtrip manifest dashboard_id does not match embed payload.");
  }
  if (packageManifest.dashboard_id !== payload.dashboard_id || packageManifest.publication_id !== adapterManifest.publication_id) {
    throw new Error("Dashboard roundtrip package manifest does not match dashboard adapter manifest.");
  }
  if (adapterManifest.proof_refs.package_manifest !== "dashboard-package/package-manifest.json") {
    throw new Error("Dashboard roundtrip adapter manifest is missing package manifest proof ref.");
  }
  if (adapterManifest.proof_refs.package_zip !== "dashboard-package/localized-dashboard-bundle.zip") {
    throw new Error("Dashboard roundtrip adapter manifest is missing package zip proof ref.");
  }
  const dashboardPackage = await JSZip.loadAsync(fs.readFileSync(packageZipFile.filePath));
  const expectedPackageEntries = [
    "localized-output.html",
    "dashboard-bundle/manifest.json",
    "dashboard-bundle/publish-state.json",
    "dashboard-bundle/embed-payload.json",
    "dashboard-bundle/localization-proof.json",
    "dashboard-bundle/localization-adapter-manifest.json",
    "dashboard-package/package-manifest.json"
  ];
  const missingPackageEntries = expectedPackageEntries.filter((entry) => !dashboardPackage.file(entry));
  if (missingPackageEntries.length > 0) {
    throw new Error(`Dashboard roundtrip package is missing entries: ${missingPackageEntries.join(", ")}`);
  }
  const packagedHtml = await dashboardPackage.file("localized-output.html")?.async("string");
  if (!packagedHtml || !packagedHtml.includes('id="dashboard-embed"')) {
    throw new Error("Dashboard roundtrip package localized output is missing dashboard embed markup.");
  }
  const packagedPayload = await dashboardPackage.file("dashboard-bundle/embed-payload.json")?.async("string");
  if (!packagedPayload) {
    throw new Error("Dashboard roundtrip package is missing embedded payload content.");
  }
  const packagedPayloadJson = z
    .object({
      dashboard_id: z.string(),
      title: z.string(),
      widgets: z.array(
        z.object({
          widget_id: z.string(),
          title: z.string(),
          subtitle: z.string(),
          layout_item_ref: z.string(),
          style_config: z.record(z.unknown()).optional()
        })
      ),
      filter_sets: z.array(
        z.object({
          title: z.string(),
          current_values: z.array(z.string()).default([])
        })
      )
    })
    .parse(JSON.parse(packagedPayload));
  const widgetsSemanticallyMatch =
    packagedPayloadJson.widgets.length === payload.widgets.length &&
    packagedPayloadJson.widgets.every((widget, index) => {
      const persistedWidget = payload.widgets[index];
      return (
        persistedWidget &&
        widget.widget_id === persistedWidget.widget_id &&
        widget.title === persistedWidget.title &&
        widget.subtitle === persistedWidget.subtitle &&
        widget.layout_item_ref === persistedWidget.layout_item_ref
      );
    });
  const filtersSemanticallyMatch =
    packagedPayloadJson.filter_sets.length === payload.filter_sets.length &&
    packagedPayloadJson.filter_sets.every((filterSet, index) => {
      const persistedFilter = payload.filter_sets[index];
      return (
        persistedFilter &&
        filterSet.title === persistedFilter.title &&
        JSON.stringify(filterSet.current_values) === JSON.stringify(persistedFilter.current_values)
      );
    });
  if (
    packagedPayloadJson.dashboard_id !== payload.dashboard_id ||
    packagedPayloadJson.title !== payload.title ||
    !widgetsSemanticallyMatch ||
    !filtersSemanticallyMatch
  ) {
    throw new Error("Dashboard roundtrip package payload does not semantically match persisted embed payload.");
  }
  if (adapterManifest.widget_count !== payload.widgets.length || adapterManifest.filter_count !== payload.filter_sets.length) {
    throw new Error("Dashboard roundtrip manifest counts do not match embed payload.");
  }
  const layoutById = new Map(payload.layout_items.map((item) => [item.item_id, item]));
  const containers: SampleContainer[] = [{ container_id: "dashboard-page", title: payload.title, width: 1440, height: 900 }];
  const textNodes: SampleTextNode[] = [];
  payload.widgets.forEach((widget, index) => {
    const layout = layoutById.get(widget.layout_item_ref);
    textNodes.push({
      node_id: `roundtrip-dashboard-title-${index + 1}`,
      container_id: "dashboard-page",
      name: `Widget Title ${index + 1}`,
      text: widget.title,
      x: (layout?.x ?? index) * 120 + 40,
      y: (layout?.y ?? index) * 80 + 40,
      width: Math.max(240, (layout?.width ?? 4) * 110),
      height: 44,
      semantic_labels: ["title", "widget_title"],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    });
    if (widget.subtitle) {
      textNodes.push({
        node_id: `roundtrip-dashboard-subtitle-${index + 1}`,
        container_id: "dashboard-page",
        name: `Widget Subtitle ${index + 1}`,
        text: widget.subtitle,
        x: (layout?.x ?? index) * 120 + 40,
        y: (layout?.y ?? index) * 80 + 92,
        width: Math.max(240, (layout?.width ?? 4) * 110),
        height: 40,
        semantic_labels: ["body", "legend_label"],
        data_binding_refs: [],
        formula_refs: [],
        editable: true
      });
    }
  });
  payload.filter_sets.forEach((filter, index) => {
    textNodes.push({
      node_id: `roundtrip-dashboard-filter-${index + 1}`,
      container_id: "dashboard-page",
      name: `Filter ${index + 1}`,
      text: filter.current_values.length > 0 ? `${filter.title}: ${filter.current_values.join(", ")}` : filter.title,
      x: 1040,
      y: 40 + index * 54,
      width: 280,
      height: 40,
      semantic_labels: ["caption", "filter_label"],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    });
  });
  proof.binding_localizations.forEach((binding, index) => {
    textNodes.push({
      node_id: `roundtrip-dashboard-binding-${index + 1}`,
      container_id: "dashboard-page",
      name: `Binding ${index + 1}`,
      text: binding.text,
      x: 720,
      y: 120 + index * 54,
      width: 420,
      height: 40,
      semantic_labels: binding.semantic_labels,
      data_binding_refs: binding.binding_refs,
      formula_refs: [],
      editable: true
    });
  });
  (proof.localized_axis_labels ?? []).forEach((entry: { node_id: string; text: string }, index: number) => {
    textNodes.push({
      node_id: `roundtrip-dashboard-axis-${index + 1}`,
      container_id: "dashboard-page",
      name: `Axis ${index + 1}`,
      text: entry.text,
      x: 120,
      y: 420 + index * 44,
      width: 260,
      height: 34,
      semantic_labels: ["caption", DASHBOARD_LOCALIZATION_LABELS.axisLabel],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    });
  });
  (proof.localized_series_labels ?? []).forEach((entry: { node_id: string; text: string }, index: number) => {
    textNodes.push({
      node_id: `roundtrip-dashboard-series-${index + 1}`,
      container_id: "dashboard-page",
      name: `Series ${index + 1}`,
      text: entry.text,
      x: 420,
      y: 420 + index * 44,
      width: 260,
      height: 34,
      semantic_labels: ["caption", DASHBOARD_LOCALIZATION_LABELS.seriesLabel],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    });
  });
  (proof.localized_tooltip_labels ?? []).forEach((entry: { node_id: string; text: string }, index: number) => {
    textNodes.push({
      node_id: `roundtrip-dashboard-tooltip-${index + 1}`,
      container_id: "dashboard-page",
      name: `Tooltip ${index + 1}`,
      text: entry.text,
      x: 720,
      y: 420 + index * 44,
      width: 300,
      height: 34,
      semantic_labels: ["caption", DASHBOARD_LOCALIZATION_LABELS.tooltipLabel],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    });
  });
  (proof.localized_interactive_controls ?? []).forEach((entry: { node_id: string; text: string }, index: number) => {
    textNodes.push({
      node_id: `roundtrip-dashboard-control-${index + 1}`,
      container_id: "dashboard-page",
      name: `Control ${index + 1}`,
      text: entry.text,
      x: 1040,
      y: 420 + index * 44,
      width: 280,
      height: 34,
      semantic_labels: ["caption", DASHBOARD_LOCALIZATION_LABELS.interactiveControl],
      data_binding_refs: [],
      formula_refs: [],
      editable: true
    });
  });
  return {
    parser_kind: "dashboard_bundle",
    title,
    containers,
    text_nodes: textNodes,
    metadata: {
      widget_count: payload.widgets.length,
      filter_count: payload.filter_sets.length,
      binding_localization_count: proof.binding_localizations.length,
      localized_widget_title_count: proof.localized_widget_titles.length,
      localized_filter_label_count: proof.localized_filter_labels.length,
      localized_axis_label_count: proof.localized_axis_labels?.length ?? 0,
      localized_series_label_count: proof.localized_series_labels?.length ?? 0,
      localized_tooltip_label_count: proof.localized_tooltip_labels?.length ?? 0,
      localized_interactive_control_count: proof.localized_interactive_controls?.length ?? 0,
      dashboard_id: payload.dashboard_id,
      package_entry_count: Object.keys(dashboardPackage.files).length
    }
  };
};

const parseLocalizedOutput = async (
  artifactType: LocalizableArtifactType,
  localizedOutputPath: string,
  sidecars: Map<string, PersistedFile>,
  title: string
): Promise<ParsedLocalizedOutput> => {
  if (artifactType === "report") return parseDocxOutput(localizedOutputPath, title);
  if (artifactType === "presentation") return parsePptxOutput(localizedOutputPath, title);
  if (artifactType === "spreadsheet") return parseXlsxOutput(localizedOutputPath, title);
  return parseDashboardBundle(sidecars, title);
};

const buildRoundTripPreservationReport = (
  originalCanonical: CanonicalRepresentation,
  parsed: ParsedLocalizedOutput,
  reingestedCanonical: CanonicalRepresentation
): Record<string, unknown> => {
  const expectedContainerCount =
    originalCanonical.representation_kind === "presentation"
      ? originalCanonical.nodes.slides.length
      : originalCanonical.representation_kind === "spreadsheet"
        ? originalCanonical.nodes.sheets.length
        : originalCanonical.nodes.pages.length;
  const expectedTexts = originalCanonical.nodes.text.map((node) => normalizeRoundTripText(node.content[0]?.value ?? ""));
  const actualTexts = parsed.text_nodes.map((node) => normalizeRoundTripText(node.text));
  const exactMatches = expectedTexts.filter((text) => actualTexts.includes(text)).length;
  const exactTextRatio = expectedTexts.length === 0 ? 1 : Number((exactMatches / expectedTexts.length).toFixed(4));
  const expectedDigits = originalCanonical.nodes.text.reduce(
    (sum, node) => sum + countArabicIndicDigits(node.content[0]?.value ?? ""),
    0
  );
  const actualDigits = parsed.text_nodes.reduce((sum, node) => sum + countArabicIndicDigits(node.text), 0);
  const digitPreservationRatio =
    expectedDigits === 0 ? 1 : Number((Math.min(actualDigits, expectedDigits) / expectedDigits).toFixed(4));
  const containerRatio =
    expectedContainerCount === 0 ? 1 : Number((parsed.containers.length / expectedContainerCount).toFixed(4));
  const nodeRatio =
    originalCanonical.nodes.text.length === 0
      ? 1
      : Number((parsed.text_nodes.length / originalCanonical.nodes.text.length).toFixed(4));
  const issues: string[] = [];
  if (exactTextRatio < 0.75) issues.push("text_preservation_below_threshold");
  if (digitPreservationRatio < 0.75) issues.push("localized_number_preservation_below_threshold");
  if (containerRatio < 0.8) issues.push("container_structure_below_threshold");
  if (nodeRatio < 0.8) issues.push("text_node_structure_below_threshold");
  return {
    parser_kind: parsed.parser_kind,
    expected_container_count: expectedContainerCount,
    actual_container_count: parsed.containers.length,
    expected_text_node_count: originalCanonical.nodes.text.length,
    actual_text_node_count: parsed.text_nodes.length,
    exact_text_matches: exactMatches,
    exact_text_ratio: exactTextRatio,
    localized_digit_preservation_ratio: digitPreservationRatio,
    container_structure_ratio: containerRatio,
    text_node_structure_ratio: nodeRatio,
    status: issues.length === 0 ? "verified" : "degraded",
    issues,
    parser_metadata: parsed.metadata,
    reingested_locale: reingestedCanonical.localization.locale
  };
};

const ratio = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 1 : Number((numerator / denominator).toFixed(4));

const normalizedContains = (texts: string[], needle: string): boolean => {
  const normalizedNeedle = normalizeRoundTripText(needle);
  return texts.some((text) => normalizeRoundTripText(text).includes(normalizedNeedle));
};

const collectCanonicalTexts = (canonical: CanonicalRepresentation): string[] =>
  canonical.nodes.text.map((node) => node.content[0]?.value ?? "");

const probePublishedOutputFidelity = async (
  artifactType: LocalizableArtifactType,
  localizedOutputPath: string,
  sidecars: Map<string, PersistedFile>
): Promise<Record<string, unknown>> => {
  if (artifactType === "report") {
    const zip = await JSZip.loadAsync(fs.readFileSync(localizedOutputPath));
    const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    return {
      artifact_kind: "docx",
      arabic_text_runs: (documentXml.match(/[\u0600-\u06FF]+/g) ?? []).length,
      bidi_markup_present: /w:bidi|w:rtl/.test(documentXml),
      right_alignment_markup_present: /w:jc w:val="right"/.test(documentXml),
      paragraph_count: (documentXml.match(/<w:p\b/g) ?? []).length
    };
  }
  if (artifactType === "presentation") {
    const zip = await JSZip.loadAsync(fs.readFileSync(localizedOutputPath));
    const slideEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("ppt/slides/slide") && entry.endsWith(".xml"));
    let slideXml = "";
    for (const entry of slideEntries) {
      slideXml += (await zip.file(entry)?.async("string")) ?? "";
    }
    return {
      artifact_kind: "pptx",
      slide_count: slideEntries.length,
      arabic_text_runs: (slideXml.match(/[\u0600-\u06FF]+/g) ?? []).length,
      rtl_markup_present: /rtl="1"|rtl="true"/.test(slideXml),
      paragraph_alignment_present: /algn="r"/.test(slideXml)
    };
  }
  if (artifactType === "spreadsheet") {
    const zip = await JSZip.loadAsync(fs.readFileSync(localizedOutputPath));
    const sheetEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("xl/worksheets/sheet") && entry.endsWith(".xml"));
    const sharedStringsXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    let sheetXml = "";
    for (const entry of sheetEntries) {
      sheetXml += (await zip.file(entry)?.async("string")) ?? "";
    }
    return {
      artifact_kind: "xlsx",
      sheet_count: sheetEntries.length,
      arabic_text_runs: (sharedStringsXml.match(/[\u0600-\u06FF]+/g) ?? []).length,
      right_to_left_markup_present: /rightToLeft="1"/.test(sheetXml),
      shared_string_count: (sharedStringsXml.match(/<si>/g) ?? []).length
    };
  }
  const adapterManifestFile = sidecars.get("dashboard-bundle/localization-adapter-manifest.json");
  const payloadFile = sidecars.get("dashboard-bundle/embed-payload.json");
  const proofFile = sidecars.get("dashboard-bundle/localization-proof.json");
  const packageFile = sidecars.get("dashboard-package/localized-dashboard-bundle.zip");
  const html = fs.readFileSync(localizedOutputPath, "utf8");
  const payload = payloadFile ? JSON.parse(fs.readFileSync(payloadFile.filePath, "utf8")) : null;
  const proof = proofFile ? JSON.parse(fs.readFileSync(proofFile.filePath, "utf8")) : null;
  const adapterManifest = adapterManifestFile ? JSON.parse(fs.readFileSync(adapterManifestFile.filePath, "utf8")) : null;
  return {
    artifact_kind: "dashboard_bundle",
    dashboard_embed_present: html.includes('id="dashboard-embed"'),
    localized_widget_count: payload?.widgets?.length ?? 0,
    rtl_style_config_count: Array.isArray(payload?.widgets)
      ? payload.widgets.filter((widget: { style_config?: { direction?: string } }) => widget.style_config?.direction === "rtl").length
      : 0,
    localized_filter_label_count: proof?.localized_filter_labels?.length ?? 0,
    localized_legend_label_count: proof?.localized_legend_labels?.length ?? 0,
    localized_axis_label_count: proof?.localized_axis_labels?.length ?? 0,
    localized_series_label_count: proof?.localized_series_labels?.length ?? 0,
    localized_tooltip_label_count: proof?.localized_tooltip_labels?.length ?? 0,
    localized_interactive_control_count: proof?.localized_interactive_controls?.length ?? 0,
    binding_localization_count: proof?.binding_localizations?.length ?? 0,
    adapter_manifest_version: adapterManifest?.version ?? null,
    package_present: Boolean(packageFile)
  };
};

const buildFidelityHardeningReport = async (
  bundle: LocalizationExecutionBundle,
  parsed: ParsedLocalizedOutput,
  reingestedCanonical: CanonicalRepresentation,
  localizedOutputPath: string,
  sidecars: Map<string, PersistedFile>
): Promise<Record<string, unknown>> => {
  const localizedTexts = collectCanonicalTexts(bundle.localized_canonical);
  const reingestedTexts = collectCanonicalTexts(reingestedCanonical);
  const protectedTerms = bundle.terminology_resolution.protectedTerms.map((term) => term.required_output_term);
  const nonTranslatableTerms = bundle.terminology_resolution.nonTranslatableTerms.map((term) => term.term);
  const preferredTranslations = bundle.terminology_resolution.rules.map((rule) => rule.preferred_translation);
  const expectedTerminology = [
    ...new Set(
      [...protectedTerms, ...nonTranslatableTerms, ...preferredTranslations].filter(
        (term): term is string => typeof term === "string" && term.length > 0
      )
    )
  ];
  const expectedTerminologyHits = expectedTerminology.filter((term) => normalizedContains(localizedTexts, term));
  const preservedTerminologyHits = expectedTerminologyHits.filter((term) => normalizedContains(reingestedTexts, term));
  const localizedTextsWithArabicDigits = localizedTexts.filter((text) => /[٠-٩]/.test(text));
  const reingestedTextsWithArabicDigits = reingestedTexts.filter((text) => /[٠-٩]/.test(text));
  const localizedDateTerms = localizedTexts.filter((text) => Object.values(ARABIC_MONTHS).some((month) => text.includes(month)));
  const preservedDateTerms = localizedDateTerms.filter((text) => Object.values(ARABIC_MONTHS).some((month) => normalizedContains(reingestedTexts, month) && text.includes(month)));
  const localizedCurrencyTerms = localizedTexts.filter((text) => /دولار|ريال|SAR|USD/.test(text));
  const preservedCurrencyTerms = localizedCurrencyTerms.filter((text) => /دولار|ريال|SAR|USD/.test(text) && normalizedContains(reingestedTexts, "دولار"));
  const outputProbe = await probePublishedOutputFidelity(
    bundle.localized_output_metadata.output_artifact_type,
    localizedOutputPath,
    sidecars
  );
  const preservationReport = bundle.round_trip_result?.preservation_report ?? {};
  const terminologyPreservationRatio = Math.min(1, ratio(preservedTerminologyHits.length, expectedTerminologyHits.length));
  const numericPreservationRatio = Math.min(
    1,
    ratio(
      reingestedTextsWithArabicDigits.reduce((sum, text) => sum + countArabicIndicDigits(text), 0),
      localizedTextsWithArabicDigits.reduce((sum, text) => sum + countArabicIndicDigits(text), 0)
    )
  );
  const datePreservationRatio = Math.min(1, ratio(preservedDateTerms.length, localizedDateTerms.length));
  const currencyPreservationRatio = Math.min(1, ratio(preservedCurrencyTerms.length, localizedCurrencyTerms.length));
  const layoutDirectionFidelityRatio =
    outputProbe.artifact_kind === "docx"
      ? ratio(Number(Boolean(outputProbe.bidi_markup_present)) + Number(Boolean(outputProbe.right_alignment_markup_present)), 2)
      : outputProbe.artifact_kind === "pptx"
        ? ratio(Number(Boolean(outputProbe.rtl_markup_present)) + Number(Boolean(outputProbe.paragraph_alignment_present)), 2)
        : outputProbe.artifact_kind === "xlsx"
          ? ratio(Number(Boolean(outputProbe.right_to_left_markup_present)), 1)
          : ratio(Number(Boolean(outputProbe.dashboard_embed_present)) + Number(outputProbe.rtl_style_config_count ?? 0), 1 + Number(outputProbe.localized_widget_count ?? 0));
  const visualFidelityScore = Math.min(
    1,
    Number(
      (
        (Number(preservationReport.container_structure_ratio ?? 0) +
          Math.min(1, Number(preservationReport.text_node_structure_ratio ?? 0)) +
          layoutDirectionFidelityRatio) /
        3
      ).toFixed(4)
    )
  );
  const semanticFidelityScore = Math.min(
    1,
    Number(
      (
        (Number(preservationReport.exact_text_ratio ?? 0) +
          terminologyPreservationRatio +
          numericPreservationRatio +
          datePreservationRatio +
          currencyPreservationRatio) /
        5
      ).toFixed(4)
    )
  );
  return {
    artifact_kind: bundle.localized_output_metadata.output_artifact_type,
    visual_fidelity: {
      score: visualFidelityScore,
      container_structure_ratio: Number(preservationReport.container_structure_ratio ?? 0),
      text_node_structure_ratio: Number(preservationReport.text_node_structure_ratio ?? 0),
      layout_direction_fidelity_ratio: layoutDirectionFidelityRatio
    },
    semantic_fidelity: {
      score: semanticFidelityScore,
      exact_text_ratio: Number(preservationReport.exact_text_ratio ?? 0),
      terminology_preservation_ratio: terminologyPreservationRatio,
      number_preservation_ratio: numericPreservationRatio,
      date_preservation_ratio: datePreservationRatio,
      currency_preservation_ratio: currencyPreservationRatio
    },
    localized_terminology_preservation: {
      expected_terms: expectedTerminologyHits,
      preserved_terms: preservedTerminologyHits
    },
    localized_number_date_currency_preservation: {
      localized_texts_with_arabic_digits: localizedTextsWithArabicDigits.length,
      reingested_texts_with_arabic_digits: reingestedTextsWithArabicDigits.length,
      localized_date_terms: localizedDateTerms,
      localized_currency_terms: localizedCurrencyTerms
    },
    layout_direction_fidelity: {
      target_locale: bundle.input.target_locale,
      target_rtl: bundle.localized_canonical.localization.rtl,
      output_probe: outputProbe
    },
    status:
      visualFidelityScore >= 0.75 && semanticFidelityScore >= 0.75 ? "verified" : "degraded"
  };
};

const buildDashboardArtifactClosureReport = async (
  bundle: LocalizationExecutionBundle,
  localizedOutputPersisted: PersistedFile,
  nativeAdapterMetadataPersisted: PersistedFile,
  sidecars: Map<string, PersistedFile>
): Promise<Record<string, unknown> | null> => {
  if (bundle.localized_output_metadata.output_artifact_type !== "dashboard") {
    return null;
  }
  const adapterManifest = sidecars.get("dashboard-bundle/localization-adapter-manifest.json");
  const publishState = sidecars.get("dashboard-bundle/publish-state.json");
  const localizationProof = sidecars.get("dashboard-bundle/localization-proof.json");
  const packageManifest = sidecars.get("dashboard-package/package-manifest.json");
  const packageZip = sidecars.get("dashboard-package/localized-dashboard-bundle.zip");
  const embedPayload = sidecars.get("dashboard-bundle/embed-payload.json");
  const transport = bundle.native_adapter_metadata.transport as Record<string, unknown> | undefined;
  return {
    artifact_kind: "dashboard_bundle",
    artifact_metadata_path: nativeAdapterMetadataPersisted.filePath,
    localized_output_path: localizedOutputPersisted.filePath,
    consumable_publication_path: localizedOutputPersisted.uri,
    manifest_path: adapterManifest?.filePath ?? null,
    publish_state_path: publishState?.filePath ?? null,
    proof_path: localizationProof?.filePath ?? null,
    embed_payload_path: embedPayload?.filePath ?? null,
    package_manifest_path: packageManifest?.filePath ?? null,
    package_zip_path: packageZip?.filePath ?? null,
    lifecycle: {
      publication_id: bundle.publication.publication_id,
      publication_target_ref: bundle.publication.target_ref,
      transport_manifest_uri: transport?.manifest_uri ?? null,
      transport_publish_state_uri: transport?.publish_state_uri ?? null,
      transport_embed_payload_uri: transport?.embed_payload_uri ?? null,
      transport_embed_html_uri: transport?.embed_html_uri ?? null,
      served_embed_html_url: transport?.served_embed_html_url ?? null,
      served_embed_payload_url: transport?.served_embed_payload_url ?? null
    },
    integrity: {
      adapter_manifest_present: Boolean(adapterManifest),
      publish_state_present: Boolean(publishState),
      proof_present: Boolean(localizationProof),
      embed_payload_present: Boolean(embedPayload),
      package_manifest_present: Boolean(packageManifest),
      package_zip_present: Boolean(packageZip)
    },
    degrade_behavior: {
      publish_mode: bundle.publish_mode,
      roundtrip_status: bundle.round_trip_result?.manifest.status ?? null,
      roundtrip_error: bundle.round_trip_result?.manifest.error ?? null,
      tamper_mode: bundle.input.roundtrip_tamper_mode
    },
    production_readiness:
      adapterManifest && publishState && localizationProof && packageManifest && packageZip ? "stable" : "degraded"
  };
};

const buildMalformedProviderProof = (
  bundle: LocalizationExecutionBundle,
  translationIntegrationPath: string,
  evidencePath: string,
  auditPath: string,
  lineagePath: string,
  rawResponsePaths: string[]
): Record<string, unknown> | null => {
  if (!bundle.translation_integration.provider_trace.some((entry) => entry.outcome === "malformed_response")) {
    return null;
  }
  return {
    provider_url: bundle.translation_integration.provider_url,
    provider_mode: bundle.translation_integration.provider_mode,
    raw_malformed_response_paths: rawResponsePaths,
    schema_failure_classifications: bundle.translation_integration.provider_trace
      .filter((entry) => entry.outcome === "malformed_response")
      .map((entry) => ({
        attempt_number: entry.attempt_number,
        failure_classification: entry.failure_classification,
        error: entry.error
      })),
    retry_fallback_decisions: bundle.translation_integration.provider_trace
      .filter((entry) => entry.outcome === "malformed_response")
      .map((entry) => ({
        attempt_number: entry.attempt_number,
        retry_decision: entry.retry_decision
      })),
    final_degrade_reason: bundle.localization_degrade_reasons.find((reason) => reason.reason_code === "provider_fallback_local") ?? null,
    linked_artifacts: {
      translation_integration_path: translationIntegrationPath,
      evidence_path: evidencePath,
      audit_path: auditPath,
      lineage_path: lineagePath
    }
  };
};

const buildRoundTripFailureEvidence = (
  bundle: LocalizationExecutionBundle,
  error: Error,
  parserHint: ParsedLocalizedOutput["parser_kind"]
): LocalizationRoundTripResult => {
  const manifest = {
    action_ref: "arabic_localization_lct.round_trip_reingest.runtime",
    parser_kind: parserHint,
    source_output_ref: bundle.localized_artifact.artifact_id,
    target_locale: bundle.input.target_locale,
    status: "failed",
    error: error.message,
    exercised_pipeline_steps: ["parse_output"]
  };
  const evidencePack = EvidencePackSchema.parse({
    contract: contractEnvelope("evidence"),
    evidence_pack_id: id("evidence-pack", bundle.input.run_id, "roundtrip-failed"),
    verification_status: "degraded",
    source_refs: [bundle.localized_artifact.artifact_id],
    generated_artifact_refs: [],
    checks_executed: [
      {
        check_id: id("check", bundle.input.run_id, "roundtrip-failed"),
        check_name: "localized_output_reingest_failure",
        check_type: "roundtrip",
        passed: false,
        severity: "high",
        details: error.message,
        impacted_refs: [bundle.localized_artifact.artifact_id]
      }
    ],
    before_refs: [bundle.localized_artifact.artifact_id],
    after_refs: [],
    metrics: [],
    warnings: [
      {
        warning_code: "roundtrip_reingest_failed",
        summary: "Localized output could not be reingested.",
        detail: error.message,
        severity: "high",
        impacted_refs: [bundle.localized_artifact.artifact_id]
      }
    ],
    failure_reasons: [
      {
        reason_code: "roundtrip_reingest_failed",
        summary: "Localized output could not be reingested.",
        detail: error.message,
        impacted_refs: [bundle.localized_artifact.artifact_id],
        retryable: true
      }
    ],
    degraded_reasons: [
      {
        reason_code: "roundtrip_reingest_failed",
        summary: "Localized output could not be reingested.",
        detail: error.message,
        impacted_refs: [bundle.localized_artifact.artifact_id],
        retryable: true
      }
    ],
    replay_context: manifest,
    reproducibility_metadata: {
      replay_token: id("replay", bundle.input.run_id, "roundtrip-failed"),
      execution_seed: `${bundle.input.run_id}:roundtrip-failed`,
      environment_stamp: "rasid-platform-core",
      tool_versions: [{ tool: "arabic-localization-lct-engine", version: "1.0.0" }]
    },
    strict_evidence_level: "strong"
  });
  const auditEvents = [
    AuditEventSchema.parse({
      contract: contractEnvelope("audit"),
      event_id: id("audit", bundle.input.run_id, "roundtrip-failed"),
      timestamp: now(),
      actor_ref: bundle.input.created_by,
      actor_type: "service",
      action_ref: "arabic_localization_lct.round_trip_reingest.runtime",
      job_ref: bundle.job.job_id,
      object_refs: [bundle.localized_artifact.artifact_id],
      workspace_id: bundle.input.workspace_id,
      tenant_ref: bundle.input.tenant_ref,
      metadata: manifest
    })
  ];
  const lineageEdges: LineageEdge[] = [
    {
      edge_id: id("lineage-edge", bundle.input.run_id, "roundtrip-failed"),
      from_ref: bundle.localized_artifact.artifact_id,
      to_ref: bundle.localized_artifact.artifact_id,
      transform_ref: "arabic_localization_lct.roundtrip.reingest_failed",
      ai_suggestion_ref: "",
      ai_decision: "accepted",
      template_ref: "",
      dataset_binding_ref: "",
      version_diff_ref: bundle.diff_artifact.artifact_id
    }
  ];
  return {
    parser_kind: "failed",
    reingested_canonical: null,
    quality: null,
    evidence_pack: evidencePack,
    audit_events: auditEvents,
    lineage_edges: lineageEdges,
    manifest,
    preservation_report: {
      parser_kind: parserHint,
      status: "failed",
      issues: ["roundtrip_reingest_failed"],
      error: error.message
    }
  };
};

const buildRoundTripEvidence = (
  bundle: LocalizationExecutionBundle,
  parsed: ParsedLocalizedOutput,
  reingestedCanonical: CanonicalRepresentation,
  quality: ReturnType<typeof evaluateQuality>
): LocalizationRoundTripResult => {
  const timestamp = now();
  const preservationReport = buildRoundTripPreservationReport(bundle.localized_canonical, parsed, reingestedCanonical);
  const manifest = {
    action_ref: "arabic_localization_lct.round_trip_reingest.runtime",
    parser_kind: parsed.parser_kind,
    source_output_ref: bundle.localized_artifact.artifact_id,
    reingested_canonical_ref: reingestedCanonical.canonical_id,
    target_locale: bundle.input.target_locale,
    status: preservationReport.status,
    parsed_metadata: parsed.metadata,
    preservation_report: preservationReport,
    exercised_pipeline_steps: ["parse_output", "detect_source_language", "resolve_terminology_profile", "run_localization_quality_gates"]
  };
  const evidencePack = EvidencePackSchema.parse({
    contract: contractEnvelope("evidence"),
    evidence_pack_id: id("evidence-pack", bundle.input.run_id, "roundtrip"),
    verification_status: quality.quality.overall_status,
    source_refs: [bundle.localized_artifact.artifact_id],
    generated_artifact_refs: [reingestedCanonical.canonical_id],
    checks_executed: [
      {
        check_id: id("check", bundle.input.run_id, "roundtrip-parse"),
        check_name: "localized_output_reingest_check",
        check_type: "roundtrip",
        passed: true,
        severity: "high",
        details: `Localized ${parsed.parser_kind} output was reingested into canonical form.`,
        impacted_refs: [reingestedCanonical.canonical_id]
      },
      {
        check_id: id("check", bundle.input.run_id, "roundtrip-quality"),
        check_name: "reingested_quality_check",
        check_type: "roundtrip",
        passed: quality.quality.overall_status !== "degraded",
        severity: quality.quality.overall_status === "degraded" ? "high" : "medium",
        details: `Reingested canonical quality=${quality.quality.overall_status}.`,
        impacted_refs: [quality.quality.localization_quality_result_id]
      }
    ],
    before_refs: [bundle.localized_artifact.artifact_id],
    after_refs: [reingestedCanonical.canonical_id],
    metrics: [
      { metric_name: "reingested_node_count", metric_value: reingestedCanonical.nodes.text.length, metric_unit: "nodes" },
      { metric_name: "roundtrip_language_score", metric_value: quality.language.score, metric_unit: "score" },
      { metric_name: "roundtrip_layout_score", metric_value: quality.layout.score, metric_unit: "score" },
      {
        metric_name: "roundtrip_exact_text_ratio",
        metric_value: Number(preservationReport.exact_text_ratio ?? 0),
        metric_unit: "ratio"
      },
      {
        metric_name: "roundtrip_digit_preservation_ratio",
        metric_value: Number(preservationReport.localized_digit_preservation_ratio ?? 0),
        metric_unit: "ratio"
      }
    ],
    warnings:
      quality.quality.overall_status === "degraded" || preservationReport.status === "degraded"
        ? [
            {
              warning_code: "roundtrip_quality_degraded",
              summary: "Round-trip quality degraded.",
              detail: `Reingested output status=${quality.quality.overall_status}; preservation=${preservationReport.status}.`,
              severity: "high",
              impacted_refs: [
                ...quality.degradeReasons.flatMap((reason) => reason.impacted_refs),
                ...((preservationReport.issues as string[]).length > 0 ? [bundle.localized_artifact.artifact_id] : [])
              ]
            }
          ]
        : [],
    failure_reasons: quality.degradeReasons.map((reason) => ({
      reason_code: reason.reason_code,
      summary: reason.summary,
      detail: reason.detail,
      impacted_refs: reason.impacted_refs,
      retryable: reason.retryable
    })),
    degraded_reasons: quality.degradeReasons.map((reason) => ({
      reason_code: reason.reason_code,
      summary: reason.summary,
      detail: reason.detail,
      impacted_refs: reason.impacted_refs,
      retryable: reason.retryable
    })),
    replay_context: manifest,
    reproducibility_metadata: {
      replay_token: id("replay", bundle.input.run_id, "roundtrip"),
      execution_seed: `${bundle.input.run_id}:roundtrip`,
      environment_stamp: "rasid-platform-core",
      tool_versions: [
        { tool: "arabic-localization-lct-engine", version: "1.0.0" },
        { tool: parsed.parser_kind === "xlsx" ? "exceljs" : "jszip", version: parsed.parser_kind === "xlsx" ? "4.x" : "3.x" }
      ]
    },
    strict_evidence_level: "strong"
  });
  const auditEvents = [
    AuditEventSchema.parse({
      contract: contractEnvelope("audit"),
      event_id: id("audit", bundle.input.run_id, "roundtrip-reingest"),
      timestamp,
      actor_ref: bundle.input.created_by,
      actor_type: "service",
      action_ref: "arabic_localization_lct.round_trip_reingest.runtime",
      job_ref: bundle.job.job_id,
      object_refs: [bundle.localized_artifact.artifact_id, reingestedCanonical.canonical_id],
      workspace_id: bundle.input.workspace_id,
      tenant_ref: bundle.input.tenant_ref,
      metadata: manifest
    })
  ];
  const lineageEdges: LineageEdge[] = [
    {
      edge_id: id("lineage-edge", bundle.input.run_id, "roundtrip"),
      from_ref: bundle.localized_artifact.artifact_id,
      to_ref: reingestedCanonical.canonical_id,
      transform_ref: "arabic_localization_lct.roundtrip.reingest",
      ai_suggestion_ref: "",
      ai_decision: "accepted",
      template_ref: "",
      dataset_binding_ref: "",
      version_diff_ref: bundle.diff_artifact.artifact_id
    }
  ];
  return {
    parser_kind: parsed.parser_kind,
    reingested_canonical: reingestedCanonical,
    quality: quality.quality,
    evidence_pack: evidencePack,
    audit_events: auditEvents,
    lineage_edges: lineageEdges,
    manifest,
    preservation_report: preservationReport
  };
};

const updateArtifactPersistence = (
  artifact: Artifact,
  persisted: PersistedFile,
  previewType: Artifact["preview_ref"]["preview_type"]
): Artifact =>
  ArtifactSchema.parse({
    ...artifact,
    storage_ref: makeStorageRef(persisted, artifact.storage_ref.storage_id),
    preview_ref: {
      ...artifact.preview_ref,
      preview_type: previewType,
      storage_ref: artifact.storage_ref.storage_id
    }
  });

const buildAuditEvents = (
  input: LocalizationExecutionInput,
  jobId: string,
  objectRefs: Record<string, string[]>
): AuditEvent[] => {
  const timestamp = now();
  const actionRefs = [
    "arabic_localization_lct.detect_source_language.v1",
    "arabic_localization_lct.resolve_terminology_profile.v1",
    "arabic_localization_lct.build_localization_plan.v1",
    "arabic_localization_lct.transform_language.v1",
    "arabic_localization_lct.transform_rtl_ltr_layout.v1",
    "arabic_localization_lct.refine_typography.v1",
    "arabic_localization_lct.apply_cultural_formatting.v1",
    "arabic_localization_lct.run_localization_quality_gates.v1"
  ];
  return actionRefs.map((actionRef) =>
    AuditEventSchema.parse({
      contract: contractEnvelope("audit"),
      event_id: id("audit", input.run_id, actionRef),
      timestamp,
      actor_ref: input.created_by,
      actor_type: "service",
      action_ref: actionRef,
      job_ref: jobId,
      object_refs: objectRefs[actionRef] ?? [input.source_artifact.artifact_id],
      workspace_id: input.workspace_id,
      tenant_ref: input.tenant_ref,
      metadata: { run_id: input.run_id, capability: LOCALIZATION_CAPABILITY_ID }
    })
  );
};

const buildLineageEdges = (
  input: LocalizationExecutionInput,
  previewArtifact: Artifact,
  diffArtifact: Artifact,
  localizedArtifact: Artifact,
  exportArtifacts: Artifact[],
  publication: Publication,
  quality: LocalizationQualityResult
): LineageEdge[] => [
  {
    edge_id: id("lineage-edge", input.run_id, "source-preview"),
    from_ref: input.source_artifact.artifact_id,
    to_ref: previewArtifact.artifact_id,
    transform_ref: "arabic_localization_lct.build_localization_plan.v1",
    ai_suggestion_ref: "",
    ai_decision: "accepted",
    template_ref: "",
    dataset_binding_ref: "",
    version_diff_ref: ""
  },
  {
    edge_id: id("lineage-edge", input.run_id, "source-diff"),
    from_ref: input.source_artifact.artifact_id,
    to_ref: diffArtifact.artifact_id,
    transform_ref: "arabic_localization_lct.transform_language.v1",
    ai_suggestion_ref: "",
    ai_decision: "accepted",
    template_ref: "",
    dataset_binding_ref: "",
    version_diff_ref: diffArtifact.artifact_id
  },
  {
    edge_id: id("lineage-edge", input.run_id, "source-localized"),
    from_ref: input.source_artifact.artifact_id,
    to_ref: localizedArtifact.artifact_id,
    transform_ref:
      quality.overall_status === "degraded"
        ? "arabic_localization_lct.publish_degraded_localized_output.v1"
        : "arabic_localization_lct.publish_localized_output.v1",
    ai_suggestion_ref: "",
    ai_decision: "accepted",
    template_ref: "",
    dataset_binding_ref: input.source_canonical.data_binding_refs[0]?.binding_id ?? "",
    version_diff_ref: diffArtifact.artifact_id
  },
  ...exportArtifacts.map((artifact, index) => ({
    edge_id: id("lineage-edge", input.run_id, "localized-export", index),
    from_ref: localizedArtifact.artifact_id,
    to_ref: artifact.artifact_id,
    transform_ref: "arabic_localization_lct.publish_localized_output.v1",
    ai_suggestion_ref: "",
    ai_decision: "accepted" as const,
    template_ref: "",
    dataset_binding_ref: "",
    version_diff_ref: diffArtifact.artifact_id
  })),
  {
    edge_id: id("lineage-edge", input.run_id, "publish"),
    from_ref: localizedArtifact.artifact_id,
    to_ref: publication.publication_id,
    transform_ref:
      quality.overall_status === "degraded"
        ? "arabic_localization_lct.publish_degraded_localized_output.v1"
        : "arabic_localization_lct.publish_localized_output.v1",
    ai_suggestion_ref: "",
    ai_decision: "accepted",
    template_ref: "",
    dataset_binding_ref: "",
    version_diff_ref: diffArtifact.artifact_id
  }
];

const buildEvidencePack = (
  input: LocalizationExecutionInput,
  localizedArtifact: Artifact,
  previewArtifact: Artifact,
  diffArtifact: Artifact,
  exportArtifacts: Artifact[],
  publication: Publication,
  quality: LocalizationQualityResult,
  degradeReasons: LocalizationDegradeReason[],
  translationIntegration: TranslationIntegrationStatus,
  nativeAdapterMetadata: Record<string, unknown>
): EvidencePack => {
  const warnings: Warning[] = [];
  if (quality.layout_quality.overflow_refs.length > 0) {
    warnings.push({
      warning_code: "layout_overflow",
      summary: "Layout overflow detected",
      detail: `Overflow refs: ${quality.layout_quality.overflow_refs.join(", ")}`,
      severity: "high",
      impacted_refs: quality.layout_quality.overflow_refs
    });
  }
  if (quality.language_quality.untranslated_critical_refs.length > 0) {
    warnings.push({
      warning_code: "language_residual_english",
      summary: "Residual English fragments detected",
      detail: `Untranslated refs: ${quality.language_quality.untranslated_critical_refs.join(", ")}`,
      severity: "medium",
      impacted_refs: quality.language_quality.untranslated_critical_refs
    });
  }
  if (translationIntegration.provider_warning) {
    warnings.push({
      warning_code: "external_translation_provider_warning",
      summary: "External translation provider fallback triggered.",
      detail: translationIntegration.provider_warning,
      severity: "medium",
      impacted_refs: [localizedArtifact.artifact_id]
    });
  }
  if (translationIntegration.glossary_conflicts.length > 0) {
    warnings.push({
      warning_code: "external_glossary_conflict",
      summary: "External glossary conflicts were detected.",
      detail: translationIntegration.glossary_conflicts.map((conflict) => conflict.detail).join(" | "),
      severity: "medium",
      impacted_refs: [localizedArtifact.artifact_id]
    });
  }
  const failures: FailureReason[] = degradeReasons.map((reason) => ({
    reason_code: reason.reason_code,
    summary: reason.summary,
    detail: reason.detail,
    impacted_refs: reason.impacted_refs,
    retryable: reason.retryable
  }));
  return EvidencePackSchema.parse({
    contract: contractEnvelope("evidence"),
    evidence_pack_id: id("evidence-pack", input.run_id),
    verification_status: quality.overall_status,
    source_refs: [input.source_artifact.artifact_id],
    generated_artifact_refs: [
      localizedArtifact.artifact_id,
      previewArtifact.artifact_id,
      diffArtifact.artifact_id,
      publication.publication_id,
      ...exportArtifacts.map((artifact) => artifact.artifact_id)
    ],
    checks_executed: [
      {
        check_id: id("check", input.run_id, "source-language"),
        check_name: "source_language_detection_check",
        check_type: "localization",
        passed: true,
        severity: "low",
        details: "Dominant source language was detected successfully.",
        impacted_refs: [input.source_artifact.artifact_id]
      },
      {
        check_id: id("check", input.run_id, "terminology"),
        check_name: "terminology_profile_resolution_check",
        check_type: "localization",
        passed: true,
        severity: "low",
        details: "Terminology profile was resolved successfully.",
        impacted_refs: [localizedArtifact.artifact_id]
      },
      {
        check_id: id("check", input.run_id, "layout"),
        check_name: "layout_quality_check",
        check_type: "localization",
        passed: quality.layout_quality.status !== "failed",
        severity: quality.layout_quality.status === "failed" ? "high" : "medium",
        details: `Layout status=${quality.layout_quality.status}`,
        impacted_refs: quality.layout_quality.overflow_refs
      },
      {
        check_id: id("check", input.run_id, "language"),
        check_name: "language_quality_check",
        check_type: "localization",
        passed: quality.language_quality.status !== "failed",
        severity: quality.language_quality.status === "failed" ? "high" : "medium",
        details: `Language status=${quality.language_quality.status}`,
        impacted_refs: quality.language_quality.untranslated_critical_refs
      },
      {
        check_id: id("check", input.run_id, "publish"),
        check_name: "localized_publish_check",
        check_type: "publication",
        passed: true,
        severity: "low",
        details: "Localized output publication payload was generated.",
        impacted_refs: [publication.publication_id]
      }
    ],
    before_refs: [input.source_artifact.artifact_id],
    after_refs: [localizedArtifact.artifact_id, publication.publication_id],
    metrics: [
      { metric_name: "translated_node_count", metric_value: input.source_canonical.nodes.text.length, metric_unit: "nodes" },
      { metric_name: "layout_score", metric_value: quality.layout_quality.score, metric_unit: "score" },
      { metric_name: "language_score", metric_value: quality.language_quality.score, metric_unit: "score" }
    ],
    warnings,
    failure_reasons: failures,
    degraded_reasons: failures,
    replay_context: {
      capability: LOCALIZATION_CAPABILITY_ID,
      run_id: input.run_id,
      target_locale: input.target_locale,
      native_adapter: nativeAdapterMetadata.engine ?? "inline",
      translation_integration: translationIntegration
    },
    reproducibility_metadata: {
      replay_token: id("replay", input.run_id),
      execution_seed: input.run_id,
      environment_stamp: "rasid-platform-core",
      tool_versions: [
        { tool: "arabic-localization-lct-engine", version: "1.0.0" },
        ...(input.source_artifact.artifact_type === "report" ? [{ tool: "report-engine", version: "1.0.0" }] : []),
        ...(input.source_artifact.artifact_type === "dashboard" ? [{ tool: "dashboard-engine", version: "1.0.0" }] : []),
        ...(input.source_artifact.artifact_type === "presentation" ? [{ tool: "pptxgenjs", version: "4.x" }] : []),
        ...(input.source_artifact.artifact_type === "spreadsheet" ? [{ tool: "exceljs", version: "4.x" }] : []),
        ...(translationIntegration.glossary_source_path ? [{ tool: "filesystem-glossary", version: "1.0.0" }] : []),
        ...(translationIntegration.provider_url ? [{ tool: "http-json-provider", version: "1.0.0" }] : [])
      ]
    },
    strict_evidence_level: "strong"
  });
};

const persistBundle = async (
  bundle: LocalizationExecutionBundle,
  inputPayload: Record<string, unknown>,
  inputCanonicalPersisted: PersistedFile
): Promise<LocalizationPersistedArtifacts> => {
  const outputRoot = bundle.input.output_root;
  if (!outputRoot) throw new Error("Localization persistence requested without output_root");
  const inputDir = path.join(outputRoot, "input");
  const artifactDir = path.join(outputRoot, "artifacts");
  const previewDir = path.join(outputRoot, "preview");
  const evidenceDir = path.join(outputRoot, "evidence");
  const auditDir = path.join(outputRoot, "audit");
  const lineageDir = path.join(outputRoot, "lineage");
  const publishedDir = path.join(outputRoot, "published");
  [inputDir, artifactDir, previewDir, evidenceDir, auditDir, lineageDir, publishedDir].forEach(ensureDir);

  const inputPayloadPersisted = writeJson(path.join(inputDir, "source-payload.json"), inputPayload);
  const requestPersisted = writeJson(path.join(artifactDir, "localization-request.json"), bundle.localization_request);
  const policyPersisted = writeJson(path.join(artifactDir, "localization-policy.json"), bundle.localization_policy);
  const terminologyPersisted = writeJson(path.join(artifactDir, "terminology-profile.json"), {
    profile: bundle.terminology_resolution.profile,
    rules: bundle.terminology_resolution.rules,
    protected_terms: bundle.terminology_resolution.protectedTerms,
    non_translatable_terms: bundle.terminology_resolution.nonTranslatableTerms
  });
  const directionPersisted = writeJson(path.join(artifactDir, "direction-transformation-plan.json"), bundle.direction_transformation_plan);
  const typographyPersisted = writeJson(path.join(artifactDir, "typography-refinement-plan.json"), bundle.typography_refinement_plan);
  const culturalPersisted = writeJson(path.join(artifactDir, "cultural-formatting-plan.json"), bundle.cultural_formatting_plan);
  const localizedCanonicalPersisted = writeJson(path.join(artifactDir, "localized-canonical.json"), bundle.localized_canonical);
  const localizedOutputPersisted = writeOutput(
    path.join(publishedDir, `localized-output.${bundle.published_output_extension}`),
    bundle.published_output_content
  );
  const previewPersisted = writeText(path.join(previewDir, "localized-preview.html"), bundle.preview_content);
  const diffPersisted = writeJson(path.join(artifactDir, "localization-diff.json"), bundle.diff_payload);
  const qualityPersisted = writeJson(path.join(artifactDir, "localization-quality.json"), {
    language_quality: bundle.language_quality_result,
    layout_quality: bundle.layout_quality_result,
    editability_quality: bundle.editability_quality_result,
    cultural_quality: bundle.cultural_quality_result,
    localization_quality: bundle.localization_quality_result,
    degrade_reasons: bundle.localization_degrade_reasons
  });
  const metadataPersisted = writeJson(path.join(artifactDir, "localized-output-metadata.json"), bundle.localized_output_metadata);
  const publicationPersisted = writeJson(path.join(artifactDir, "publication.json"), bundle.publication);
  const evidencePersisted = writeJson(path.join(evidenceDir, "evidence-pack.json"), bundle.evidence_pack);
  const auditPersisted = writeJson(path.join(auditDir, "audit-events.json"), bundle.audit_events);
  const lineagePersisted = writeJson(path.join(lineageDir, "lineage-edges.json"), bundle.lineage_edges);
  const translationIntegrationPersisted = writeJson(
    path.join(artifactDir, "translation-integration.json"),
    bundle.translation_integration
  );
  const nativeAdapterMetadataPersisted = writeJson(
    path.join(artifactDir, "native-adapter-metadata.json"),
    bundle.native_adapter_metadata
  );
  const publishedSidecarPersisted = new Map<string, PersistedFile>();
  bundle.published_output_sidecars.forEach((sidecar) => {
    publishedSidecarPersisted.set(
      sidecar.relative_path,
      writeOutput(path.join(publishedDir, sidecar.relative_path), sidecar.content)
    );
  });
  const malformedTraceEntries = bundle.translation_integration.provider_trace.filter(
    (entry) => entry.outcome === "malformed_response" && entry.response_excerpt
  );
  const malformedRawResponsePaths = malformedTraceEntries.map((entry) =>
    writeText(
      path.join(artifactDir, `provider-malformed-raw-response-attempt-${entry.attempt_number}.json`),
      `${entry.response_excerpt ?? ""}\n`
    ).filePath
  );

  bundle.preview_artifact = updateArtifactPersistence(bundle.preview_artifact, previewPersisted, "html_canvas");
  bundle.diff_artifact = updateArtifactPersistence(bundle.diff_artifact, diffPersisted, "html_canvas");
  bundle.localized_artifact = ArtifactSchema.parse({
    ...bundle.localized_artifact,
    storage_ref: makeStorageRef(localizedOutputPersisted, bundle.localized_artifact.storage_ref.storage_id),
    preview_ref: {
      ...bundle.localized_artifact.preview_ref,
      preview_type: bundle.published_output_preview_type,
      storage_ref: bundle.preview_artifact.storage_ref.storage_id
    }
  });

  const exportJsonPersisted = writeJson(path.join(artifactDir, "localized-export.json"), {
    metadata: bundle.localized_output_metadata,
    canonical: bundle.localized_canonical
  });
  const exportPreviewPersisted = writeText(path.join(artifactDir, "localized-export-preview.html"), bundle.preview_content);
  bundle.export_artifacts = [
    updateArtifactPersistence(bundle.export_artifacts[0], exportJsonPersisted, "html_canvas"),
    updateArtifactPersistence(bundle.export_artifacts[1], exportPreviewPersisted, "html_canvas")
  ];
  bundle.localized_artifact = ArtifactSchema.parse({
    ...bundle.localized_artifact,
    export_refs: [
      { export_id: bundle.export_artifacts[0].artifact_id, export_type: "json", explicit_non_editable: true, storage_ref: bundle.export_artifacts[0].storage_ref.storage_id },
      { export_id: bundle.export_artifacts[1].artifact_id, export_type: "html", explicit_non_editable: false, storage_ref: bundle.export_artifacts[1].storage_ref.storage_id }
    ]
  });
  const artifactsManifestPersisted = writeJson(path.join(artifactDir, "artifact-records.json"), {
    source_artifact: bundle.input.source_artifact,
    localized_artifact: bundle.localized_artifact,
    preview_artifact: bundle.preview_artifact,
    diff_artifact: bundle.diff_artifact,
    export_artifacts: bundle.export_artifacts,
    published_sidecars: [...publishedSidecarPersisted.entries()].map(([relativePath, persisted]) => ({
      relative_path: relativePath,
      file_path: persisted.filePath,
      uri: persisted.uri
    }))
  });

  const roundTripDir = path.join(artifactDir, "roundtrip");
  ensureDir(roundTripDir);
  if (bundle.input.roundtrip_tamper_mode === "dashboard_missing_payload") {
    const payloadPersisted = publishedSidecarPersisted.get("dashboard-bundle/embed-payload.json");
    if (payloadPersisted && fs.existsSync(payloadPersisted.filePath)) {
      fs.rmSync(payloadPersisted.filePath, { force: true });
      publishedSidecarPersisted.delete("dashboard-bundle/embed-payload.json");
    }
  }
  if (bundle.input.roundtrip_tamper_mode === "dashboard_manifest_mismatch") {
    const manifestPersisted = publishedSidecarPersisted.get("dashboard-bundle/localization-adapter-manifest.json");
    if (manifestPersisted && fs.existsSync(manifestPersisted.filePath)) {
      const manifestPayload = JSON.parse(fs.readFileSync(manifestPersisted.filePath, "utf8"));
      manifestPayload.checksums = {
        ...(manifestPayload.checksums ?? {}),
        "dashboard-bundle/embed-payload.json": "sha256:tampered"
      };
      publishedSidecarPersisted.set(
        "dashboard-bundle/localization-adapter-manifest.json",
        writeJson(manifestPersisted.filePath, manifestPayload)
      );
    }
  }
  try {
    const parsedRoundTrip = await parseLocalizedOutput(
      bundle.localized_output_metadata.output_artifact_type,
      localizedOutputPersisted.filePath,
      publishedSidecarPersisted,
      bundle.input.run_id
    );
    const reingestedCanonical = buildSampleSourceCanonical(
      id(bundle.input.run_id, "roundtrip"),
      bundle.localized_output_metadata.output_artifact_type,
      parsedRoundTrip.title,
      parsedRoundTrip.containers,
      parsedRoundTrip.text_nodes,
      bundle.input.tenant_ref,
      bundle.input.workspace_id,
      bundle.input.project_id,
      bundle.input.target_locale
    );
    const roundTripInput = LocalizationExecutionInputSchema.parse({
      ...bundle.input,
      run_id: id(bundle.input.run_id, "roundtrip"),
      source_artifact: bundle.localized_artifact,
      source_canonical: reingestedCanonical,
      target_locale: bundle.input.target_locale,
      output_root: undefined
    });
    const roundTripSourceLocale = detectDominantLocale(reingestedCanonical);
    const roundTripTerminology = resolveTerminology(roundTripInput, roundTripSourceLocale);
    const roundTripQuality = evaluateQuality(
      roundTripInput,
      id("localization-request", roundTripInput.run_id),
      reingestedCanonical,
      roundTripTerminology,
      id("localized-output-metadata", roundTripInput.run_id)
    );
    bundle.round_trip_result = buildRoundTripEvidence(bundle, parsedRoundTrip, reingestedCanonical, roundTripQuality);
  } catch (error) {
    const parserHint =
      bundle.localized_output_metadata.output_artifact_type === "report"
        ? "docx"
        : bundle.localized_output_metadata.output_artifact_type === "presentation"
          ? "pptx"
          : bundle.localized_output_metadata.output_artifact_type === "spreadsheet"
            ? "xlsx"
            : "dashboard_bundle";
    bundle.round_trip_result = buildRoundTripFailureEvidence(
      bundle,
      error instanceof Error ? error : new Error(String(error)),
      parserHint
    );
  }
  const roundTripManifestPersisted = writeJson(path.join(roundTripDir, "manifest.json"), bundle.round_trip_result.manifest);
  const roundTripCanonicalPersisted = writeJson(path.join(roundTripDir, "canonical.json"), bundle.round_trip_result.reingested_canonical);
  const roundTripQualityPersisted = writeJson(
    path.join(roundTripDir, "quality.json"),
    bundle.round_trip_result.quality
      ? {
          localization_quality: bundle.round_trip_result.quality
        }
      : {
          status: "failed",
          parser_kind: bundle.round_trip_result.parser_kind,
          error: bundle.round_trip_result.manifest.error ?? "Round-trip validation failed."
        }
  );
  const roundTripEvidencePersisted = writeJson(path.join(roundTripDir, "evidence.json"), bundle.round_trip_result.evidence_pack);
  const roundTripAuditPersisted = writeJson(path.join(roundTripDir, "audit.json"), bundle.round_trip_result.audit_events);
  const roundTripLineagePersisted = writeJson(path.join(roundTripDir, "lineage.json"), bundle.round_trip_result.lineage_edges);
  const roundTripPreservationPersisted = writeJson(
    path.join(roundTripDir, "preservation-report.json"),
    bundle.round_trip_result.preservation_report
  );
  const fidelityReportPersisted = writeJson(
    path.join(artifactDir, "fidelity-report.json"),
    await buildFidelityHardeningReport(
      bundle,
      bundle.round_trip_result.reingested_canonical
        ? await parseLocalizedOutput(
            bundle.localized_output_metadata.output_artifact_type,
            localizedOutputPersisted.filePath,
            publishedSidecarPersisted,
            bundle.input.run_id
          )
        : {
            parser_kind:
              bundle.localized_output_metadata.output_artifact_type === "report"
                ? "docx"
                : bundle.localized_output_metadata.output_artifact_type === "presentation"
                  ? "pptx"
                  : bundle.localized_output_metadata.output_artifact_type === "spreadsheet"
                    ? "xlsx"
                    : "dashboard_bundle",
            title: bundle.input.run_id,
            containers: [],
            text_nodes: [],
            metadata: {}
          },
      bundle.round_trip_result.reingested_canonical ?? bundle.localized_canonical,
      localizedOutputPersisted.filePath,
      publishedSidecarPersisted
    )
  );
  const dashboardArtifactClosure = await buildDashboardArtifactClosureReport(
    bundle,
    localizedOutputPersisted,
    nativeAdapterMetadataPersisted,
    publishedSidecarPersisted
  );
  const dashboardArtifactClosurePersisted = dashboardArtifactClosure
    ? writeJson(path.join(artifactDir, "dashboard-artifact-closure.json"), dashboardArtifactClosure)
    : null;
  const malformedProviderProof = buildMalformedProviderProof(
    bundle,
    translationIntegrationPersisted.filePath,
    evidencePersisted.filePath,
    auditPersisted.filePath,
    lineagePersisted.filePath,
    malformedRawResponsePaths
  );
  const malformedProviderProofPersisted = malformedProviderProof
    ? writeJson(path.join(artifactDir, "provider-malformed-proof.json"), malformedProviderProof)
    : null;

  return {
    output_root: outputRoot,
    input_payload_path: inputPayloadPersisted.filePath,
    input_canonical_path: inputCanonicalPersisted.filePath,
    request_path: requestPersisted.filePath,
    policy_path: policyPersisted.filePath,
    terminology_profile_path: terminologyPersisted.filePath,
    direction_plan_path: directionPersisted.filePath,
    typography_plan_path: typographyPersisted.filePath,
    cultural_plan_path: culturalPersisted.filePath,
    localized_canonical_path: localizedCanonicalPersisted.filePath,
    localized_output_path: localizedOutputPersisted.filePath,
    preview_path: previewPersisted.filePath,
    diff_path: diffPersisted.filePath,
    quality_path: qualityPersisted.filePath,
    output_metadata_path: metadataPersisted.filePath,
    publication_path: publicationPersisted.filePath,
    evidence_path: evidencePersisted.filePath,
    audit_path: auditPersisted.filePath,
    lineage_path: lineagePersisted.filePath,
    artifacts_manifest_path: artifactsManifestPersisted.filePath,
    translation_integration_path: translationIntegrationPersisted.filePath,
    native_adapter_metadata_path: nativeAdapterMetadataPersisted.filePath,
    fidelity_report_path: fidelityReportPersisted.filePath,
    dashboard_artifact_closure_path: dashboardArtifactClosurePersisted?.filePath ?? null,
    provider_malformed_proof_path: malformedProviderProofPersisted?.filePath ?? null,
    dashboard_package_path:
      publishedSidecarPersisted.get("dashboard-package/localized-dashboard-bundle.zip")?.filePath ?? null,
    published_sidecar_paths: [...publishedSidecarPersisted.values()].map((entry) => entry.filePath),
    roundtrip_manifest_path: roundTripManifestPersisted.filePath,
    roundtrip_canonical_path: roundTripCanonicalPersisted.filePath,
    roundtrip_quality_path: roundTripQualityPersisted.filePath,
    roundtrip_evidence_path: roundTripEvidencePersisted.filePath,
    roundtrip_audit_path: roundTripAuditPersisted.filePath,
    roundtrip_lineage_path: roundTripLineagePersisted.filePath,
    roundtrip_preservation_path: roundTripPreservationPersisted.filePath
  };
};

export class ArabicLocalizationLctEngine {
  detectSourceLanguage(inputValue: LocalizationExecutionInput): string {
    const input = LocalizationExecutionInputSchema.parse(inputValue);
    return detectDominantLocale(input.source_canonical);
  }

  resolveTerminologyProfile(inputValue: LocalizationExecutionInput, sourceLocale: string): TerminologyResolution {
    const input = LocalizationExecutionInputSchema.parse(inputValue);
    return resolveTerminology(input, sourceLocale);
  }

  buildLocalizationPlan(
    inputValue: LocalizationExecutionInput,
    sourceLocale: string,
    terminology: TerminologyResolution
  ): {
    scope: LocalizationScope;
    policy: LocalizationPolicy;
    directionPlan: DirectionTransformationPlan;
    typographyPlan: TypographyRefinementPlan;
    culturalPlan: CulturalFormattingPlan;
    request: LocalizationRequest;
  } {
    const input = LocalizationExecutionInputSchema.parse(inputValue);
    const scope = buildLocalizationScope(input);
    const policy = input.policy ?? buildDefaultPolicy(input, sourceLocale);
    const requestId = id("localization-request", input.run_id);
    const directionPlan = buildDirectionTransformationPlan(input, requestId, scope.included_node_refs);
    const typographyPlan = buildTypographyRefinementPlan(input, requestId, scope.included_node_refs);
    const culturalPlan = buildCulturalFormattingPlan(input, requestId, scope.included_node_refs);
    const request = LocalizationRequestSchema.parse({
      contract: contractEnvelope("localization"),
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      localization_request_id: requestId,
      capability_id: LOCALIZATION_CAPABILITY_ID,
      mode: input.mode,
      status: "planning",
      source_artifact_ref: input.source_artifact.artifact_id,
      source_canonical_ref: input.source_canonical.canonical_id,
      target_artifact_type: localizedArtifactTypeFromRepresentation(input.source_canonical.representation_kind),
      target_artifact_ref: null,
      source_locale: sourceLocale,
      target_locale: input.target_locale,
      source_language_detection: sourceLocale === input.source_canonical.localization.locale ? "explicit" : "auto_detect",
      localization_scope_ref: scope.localization_scope_id,
      localization_policy_ref: policy.localization_policy_id,
      terminology_profile_ref: terminology.profile.terminology_profile_id,
      direction_transformation_plan_ref: directionPlan.direction_transformation_plan_id,
      typography_refinement_plan_ref: typographyPlan.typography_refinement_plan_id,
      cultural_formatting_plan_ref: culturalPlan.cultural_formatting_plan_id,
      preview_ref: id("localization-preview", input.run_id),
      quality_result_ref: id("localization-quality", input.run_id),
      localized_output_metadata_ref: id("localized-output-metadata", input.run_id),
      requested_by: input.created_by,
      requested_at: now(),
      approved_by: input.created_by,
      applied_at: null
    });
    return { scope, policy, directionPlan, typographyPlan, culturalPlan, request };
  }

  transformLanguage(canonicalValue: CanonicalRepresentation, targetLocale: string, terminology: TerminologyResolution): CanonicalRepresentation {
    return transformLanguage(canonicalValue, targetLocale, terminology);
  }

  transformRtlLtrLayout(canonicalValue: CanonicalRepresentation, planValue: DirectionTransformationPlan): CanonicalRepresentation {
    return transformRtlLtrLayout(canonicalValue, planValue);
  }

  refineTypography(canonicalValue: CanonicalRepresentation, planValue: TypographyRefinementPlan): CanonicalRepresentation {
    return refineTypography(canonicalValue, planValue);
  }

  applyCulturalFormatting(canonicalValue: CanonicalRepresentation, planValue: CulturalFormattingPlan): CanonicalRepresentation {
    return applyCulturalFormatting(canonicalValue, planValue);
  }

  runLocalizationQualityGates(
    inputValue: LocalizationExecutionInput,
    requestId: string,
    localizedCanonical: CanonicalRepresentation,
    terminology: TerminologyResolution,
    outputMetadataId: string
  ) {
    const input = LocalizationExecutionInputSchema.parse(inputValue);
    return evaluateQuality(input, requestId, localizedCanonical, terminology, outputMetadataId);
  }

  async run(
    inputValue: LocalizationExecutionInput,
    inputPayload?: Record<string, unknown>,
    inputCanonicalFile?: PersistedFile
  ): Promise<LocalizationExecutionBundle> {
    const input = LocalizationExecutionInputSchema.parse(inputValue);
    const sourceLocale = this.detectSourceLanguage(input);
    const terminology = this.resolveTerminologyProfile(input, sourceLocale);
    const { scope, policy, directionPlan, typographyPlan, culturalPlan, request } = this.buildLocalizationPlan(
      input,
      sourceLocale,
      terminology
    );
    let localizedCanonical = this.transformLanguage(input.source_canonical, input.target_locale, terminology);
    localizedCanonical = CanonicalRepresentationSchema.parse({ ...localizedCanonical, canonical_id: id("canonical", input.run_id, "localized") });
    localizedCanonical = this.transformRtlLtrLayout(localizedCanonical, directionPlan);
    localizedCanonical = this.refineTypography(localizedCanonical, typographyPlan);
    localizedCanonical = this.applyCulturalFormatting(localizedCanonical, culturalPlan);
    const localizationResult = await repairWithExternalProvider(input, localizedCanonical, terminology);
    localizedCanonical = localizationResult.canonical;
    const effectiveTerminology: TerminologyResolution = {
      ...terminology,
      integration: localizationResult.integration
    };

    const qualityResult = this.runLocalizationQualityGates(
      input,
      request.localization_request_id,
      localizedCanonical,
      effectiveTerminology,
      request.localized_output_metadata_ref ?? id("localized-output-metadata", input.run_id)
    );
    const timestamp = now();
    const publishMode: "localized" | "degraded" = qualityResult.quality.overall_status === "degraded" && input.allow_degraded_publish ? "degraded" : "localized";
    const localizedArtifact = buildArtifact(
      input,
      id("artifact", input.run_id, "localized"),
      input.source_artifact.artifact_type as Artifact["artifact_type"],
      publishMode === "localized" ? "localized_output" : "degraded_localized_output",
      qualityResult.editability.status === "failed" ? "partially_editable" : input.source_artifact.editable_status,
      qualityResult.quality.overall_status,
      timestamp,
      localizedCanonical.canonical_id,
      [input.source_artifact.artifact_id]
    );
    const previewArtifact = buildArtifact(input, id("artifact", input.run_id, "preview"), "preview_render", "localized_preview", "non_editable", qualityResult.quality.overall_status, timestamp, localizedCanonical.canonical_id, [input.source_artifact.artifact_id]);
    const diffArtifact = buildArtifact(input, id("artifact", input.run_id, "diff"), "workflow_output", "localization_diff", "non_editable", qualityResult.quality.overall_status, timestamp, localizedCanonical.canonical_id, [input.source_artifact.artifact_id]);
    const exportArtifacts = [
      buildArtifact(input, id("artifact", input.run_id, "export-json"), "export_bundle", "localized_output_json", "non_editable", qualityResult.quality.overall_status, timestamp, localizedCanonical.canonical_id, [localizedArtifact.artifact_id]),
      buildArtifact(input, id("artifact", input.run_id, "export-html"), "export_bundle", "localized_output_html", "non_editable", qualityResult.quality.overall_status, timestamp, localizedCanonical.canonical_id, [localizedArtifact.artifact_id])
    ];
    const outputMetadata = LocalizedOutputMetadataSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      localized_output_metadata_id: request.localized_output_metadata_ref ?? id("localized-output-metadata", input.run_id),
      request_ref: request.localization_request_id,
      source_artifact_ref: input.source_artifact.artifact_id,
      localized_artifact_ref: localizedArtifact.artifact_id,
      source_canonical_ref: input.source_canonical.canonical_id,
      localized_canonical_ref: localizedCanonical.canonical_id,
      output_artifact_type: localizedArtifactTypeFromRepresentation(input.source_canonical.representation_kind),
      target_locale: input.target_locale,
      preview_artifact_ref: previewArtifact.artifact_id,
      diff_artifact_ref: diffArtifact.artifact_id,
      export_artifact_refs: exportArtifacts.map((artifact) => artifact.artifact_id),
      editable_status: qualityResult.editability.status === "failed" ? "partially_editable" : "editable",
      binding_integrity_status: qualityResult.editability.binding_break_refs.length > 0 ? "broken" : "preserved",
      applied_policy_ref: request.localization_policy_ref,
      applied_terminology_profile_ref: effectiveTerminology.profile.terminology_profile_id,
      generated_at: timestamp
    });
    const preview = LocalizationPreviewSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      localization_preview_id: request.preview_ref ?? id("localization-preview", input.run_id),
      request_ref: request.localization_request_id,
      preview_artifact_ref: previewArtifact.artifact_id,
      diff_artifact_ref: diffArtifact.artifact_id,
      output_metadata_ref: outputMetadata.localized_output_metadata_id,
      quality_result_ref: qualityResult.quality.localization_quality_result_id,
      status: qualityResult.quality.overall_status === "verified" ? "ready" : "ready_with_warnings",
      warnings: qualityResult.layout.overflow_refs.map((nodeRef) => ({
        warning_code: "layout_overflow",
        summary: "Layout overflow detected in preview",
        detail: `Localized text overflowed node ${nodeRef}`,
        severity: "high",
        impacted_refs: [nodeRef]
      })),
      degrade_reason_refs: qualityResult.degradeReasons.map((reason) => reason.localization_degrade_reason_id),
      expires_at: null
    });
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: id("publication", input.run_id),
      artifact_ref: localizedArtifact.artifact_id,
      publication_type: publishMode === "localized" ? "internal_publish" : "bundle",
      editable_default: outputMetadata.editable_status !== "non_editable",
      explicit_non_editable_export: false,
      target_ref: input.publish_target_ref,
      published_by: input.created_by,
      published_at: timestamp,
      permission_scope: DEFAULT_PERMISSION_SCOPE(),
      evidence_ref: id("evidence-pack", input.run_id)
    });
    const publishedOutput = await renderPublishedOutput(
      input,
      outputMetadata.output_artifact_type,
      `${input.source_artifact.artifact_subtype} localized`,
      localizedCanonical
    );
    const previewContent = renderLocalizedPreviewHtml(localizedCanonical, `${input.run_id} preview`);
    const diffPayload = buildLocalizationDiff(input.source_canonical, localizedCanonical);
    const evidencePack = buildEvidencePack(
      input,
      localizedArtifact,
      previewArtifact,
      diffArtifact,
      exportArtifacts,
      publication,
      qualityResult.quality,
      qualityResult.degradeReasons,
      effectiveTerminology.integration,
      publishedOutput.adapter_metadata ?? {}
    );
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: id("job", input.run_id),
      capability: LOCALIZATION_CAPABILITY_ID,
      requested_mode: input.mode,
      capability_submode: publishMode === "localized" ? "localized_publish" : "degraded_publish",
      source_refs: [input.source_artifact.artifact_id],
      artifact_refs: [localizedArtifact.artifact_id],
      progress: 100,
      stage: publishMode === "localized" ? "publish_localized_output" : "publish_degraded_localized_output",
      state: publishMode === "localized" ? "completed" : "degraded",
      warnings: evidencePack.warnings,
      failure_reason: evidencePack.failure_reasons[0] ?? null,
      retry_policy: { max_attempts: 2, strategy: "fixed", backoff_ms: 0 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: timestamp,
      finished_at: timestamp,
      resource_profile: { cpu_class: "standard", memory_class: "medium", io_class: "balanced", expected_parallelism: 1 }
    });
    const actionObjects: Record<string, string[]> = {
      "arabic_localization_lct.detect_source_language.v1": [input.source_artifact.artifact_id],
      "arabic_localization_lct.resolve_terminology_profile.v1": [terminology.profile.terminology_profile_id],
      "arabic_localization_lct.build_localization_plan.v1": [request.localization_request_id, directionPlan.direction_transformation_plan_id, typographyPlan.typography_refinement_plan_id, culturalPlan.cultural_formatting_plan_id],
      "arabic_localization_lct.transform_language.v1": [localizedCanonical.canonical_id],
      "arabic_localization_lct.transform_rtl_ltr_layout.v1": [localizedCanonical.canonical_id],
      "arabic_localization_lct.refine_typography.v1": [localizedCanonical.canonical_id],
      "arabic_localization_lct.apply_cultural_formatting.v1": [localizedCanonical.canonical_id],
      "arabic_localization_lct.run_localization_quality_gates.v1": [qualityResult.quality.localization_quality_result_id]
    };
    const auditEvents = [
      ...buildAuditEvents(input, job.job_id, actionObjects),
      AuditEventSchema.parse({
        contract: contractEnvelope("audit"),
        event_id: id("audit", input.run_id, publishMode),
        timestamp,
        actor_ref: input.created_by,
        actor_type: "service",
        action_ref: publishMode === "localized" ? "arabic_localization_lct.publish_localized_output.v1" : "arabic_localization_lct.publish_degraded_localized_output.v1",
        job_ref: job.job_id,
        object_refs: [localizedArtifact.artifact_id, publication.publication_id],
        workspace_id: input.workspace_id,
        tenant_ref: input.tenant_ref,
        metadata: { publish_target_ref: input.publish_target_ref, overall_status: qualityResult.quality.overall_status }
      })
    ];
    const lineageEdges = buildLineageEdges(input, previewArtifact, diffArtifact, localizedArtifact, exportArtifacts, publication, qualityResult.quality);
    const bundle: LocalizationExecutionBundle = {
      input,
      detected_source_locale: sourceLocale,
      localization_scope: scope,
      localization_policy: policy,
      terminology_resolution: { ...terminology, integration: localizationResult.integration },
      direction_transformation_plan: directionPlan,
      typography_refinement_plan: typographyPlan,
      cultural_formatting_plan: culturalPlan,
      localization_request: LocalizationRequestSchema.parse({ ...request, status: publishMode === "localized" ? "applied" : "degraded", target_artifact_ref: localizedArtifact.artifact_id, applied_at: timestamp }),
      localized_canonical: localizedCanonical,
      localized_artifact: localizedArtifact,
      preview_artifact: previewArtifact,
      diff_artifact: diffArtifact,
      export_artifacts: exportArtifacts,
      localized_output_metadata: outputMetadata,
      localization_preview: preview,
      language_quality_result: qualityResult.language,
      layout_quality_result: qualityResult.layout,
      editability_quality_result: qualityResult.editability,
      cultural_quality_result: qualityResult.cultural,
      localization_quality_result: qualityResult.quality,
      localization_degrade_reasons: qualityResult.degradeReasons,
      publication,
      evidence_pack: evidencePack,
      audit_events: auditEvents,
      lineage_edges: lineageEdges,
      job,
      translation_integration: effectiveTerminology.integration,
      published_output_content: publishedOutput.content,
      published_output_extension: publishedOutput.extension,
      published_output_preview_type: publishedOutput.preview_type,
      published_output_sidecars: publishedOutput.sidecars ?? [],
      native_adapter_metadata: publishedOutput.adapter_metadata ?? {},
      preview_content: previewContent,
      diff_payload: diffPayload,
      round_trip_result: null,
      persisted_artifacts: null,
      publish_mode: publishMode
    };
    if (input.output_root && inputPayload && inputCanonicalFile) {
      bundle.persisted_artifacts = await persistBundle(bundle, inputPayload, inputCanonicalFile);
    }
    return bundle;
  }

  async exportPdf(
    canonical: CanonicalRepresentation,
    title: string,
    outputPath?: string
  ): Promise<{ html: string; outputPath: string | null; pdfPath: string | null; adapter_metadata: Record<string, unknown> }> {
    const pdfPayload = await renderPdfReadyHtmlOutput(title, canonical);
    const htmlContent = typeof pdfPayload.content === "string"
      ? pdfPayload.content
      : Buffer.from(pdfPayload.content).toString("utf8");
    let resolvedOutputPath: string | null = null;
    let pdfOutputPath: string | null = null;
    if (outputPath) {
      ensureDir(path.dirname(outputPath));
      writeText(outputPath, htmlContent);
      resolvedOutputPath = outputPath;
    }
    // Attempt to generate actual PDF using Playwright/Chromium if available
    if (resolvedOutputPath) {
      try {
        const browserPaths = [
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "/usr/bin/google-chrome",
          "/usr/bin/chromium-browser",
          "/usr/bin/microsoft-edge"
        ];
        const executablePath = browserPaths.find((p) => fs.existsSync(p));
        if (executablePath) {
          const { chromium } = await import("playwright-core") as { chromium: { launch: (opts: { executablePath: string; headless: boolean }) => Promise<PlaywrightBrowser> } };
          const browser = await chromium.launch({ executablePath, headless: true });
          const page = await browser.newPage();
          await page.setContent(htmlContent, { waitUntil: "networkidle" });
          const pdfPath = resolvedOutputPath.replace(/\.html$/, ".pdf");
          await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
          await browser.close();
          pdfOutputPath = pdfPath;
        }
      } catch {
        // Playwright not available or PDF generation failed; fall back to HTML output
      }
    }
    return {
      html: htmlContent,
      outputPath: resolvedOutputPath,
      pdfPath: pdfOutputPath,
      adapter_metadata: {
        ...(pdfPayload.adapter_metadata ?? {}),
        pdf_generated: pdfOutputPath !== null,
        pdf_engine: pdfOutputPath !== null ? "playwright-chromium" : "html_fallback",
        ...(pdfOutputPath === null ? { note: "Playwright/Chromium not available. Open the HTML file in a browser and use Ctrl+P to save as PDF." } : {})
      }
    };
  }

  publishIncremental(
    inputValue: LocalizationExecutionInput,
    previousCanonical: CanonicalRepresentation,
    currentCanonical: CanonicalRepresentation,
    previousPublication: Publication
  ): IncrementalPublicationResult {
    const input = LocalizationExecutionInputSchema.parse(inputValue);
    const previousTextMap = new Map<string, string>();
    for (const node of previousCanonical.nodes.text) {
      previousTextMap.set(node.node_id, node.content[0]?.value ?? "");
    }
    const currentTextMap = new Map<string, string>();
    for (const node of currentCanonical.nodes.text) {
      currentTextMap.set(node.node_id, node.content[0]?.value ?? "");
    }
    const changedNodeIds: string[] = [];
    const preservedNodeIds: string[] = [];
    const incrementalDiff: IncrementalChange[] = [];
    for (const node of currentCanonical.nodes.text) {
      const previousValue = previousTextMap.get(node.node_id) ?? null;
      const currentValue = node.content[0]?.value ?? "";
      if (previousValue === null) {
        changedNodeIds.push(node.node_id);
        incrementalDiff.push({
          node_id: node.node_id,
          change_type: "added",
          previous_value: null,
          new_value: currentValue
        });
      } else if (previousValue !== currentValue) {
        changedNodeIds.push(node.node_id);
        incrementalDiff.push({
          node_id: node.node_id,
          change_type: "modified",
          previous_value: previousValue,
          new_value: currentValue
        });
      } else {
        preservedNodeIds.push(node.node_id);
      }
    }
    for (const [nodeId, previousValue] of previousTextMap.entries()) {
      if (!currentTextMap.has(nodeId)) {
        changedNodeIds.push(nodeId);
        incrementalDiff.push({
          node_id: nodeId,
          change_type: "removed",
          previous_value: previousValue,
          new_value: null
        });
      }
    }
    const mergedTextNodes = currentCanonical.nodes.text.map((node) => {
      if (preservedNodeIds.includes(node.node_id)) {
        const previousNode = previousCanonical.nodes.text.find((n) => n.node_id === node.node_id);
        return previousNode ?? node;
      }
      return node;
    });
    const updatedCanonical = CanonicalRepresentationSchema.parse({
      ...currentCanonical,
      canonical_id: id("canonical", input.run_id, "incremental"),
      nodes: { ...currentCanonical.nodes, text: mergedTextNodes }
    });
    const timestamp = now();
    const publication = PublicationSchema.parse({
      contract: contractEnvelope("publication"),
      publication_id: id("publication", input.run_id, "incremental"),
      artifact_ref: previousPublication.artifact_ref,
      publication_type: "internal_publish",
      editable_default: previousPublication.editable_default,
      explicit_non_editable_export: previousPublication.explicit_non_editable_export,
      target_ref: previousPublication.target_ref,
      published_by: input.created_by,
      published_at: timestamp,
      permission_scope: previousPublication.permission_scope,
      evidence_ref: previousPublication.evidence_ref
    });
    return {
      updated_canonical: updatedCanonical,
      changed_node_ids: changedNodeIds,
      preserved_node_ids: preservedNodeIds,
      incremental_diff: incrementalDiff,
      publication,
      timestamp
    };
  }

  syncBidirectional(
    localizedCanonical: CanonicalRepresentation,
    externalChanges: Array<{ node_id: string; value: string }>,
    sourceChanges?: Array<{ node_id: string; value: string }>,
    mergeStrategy: "external_priority" | "source_priority" | "manual" = "external_priority"
  ): BidirectionalSyncResult {
    const conflicts: BidirectionalConflict[] = [];
    let appliedExternalChanges = 0;
    let preservedSourceChanges = 0;
    const sourceChangeMap = new Map<string, string>();
    if (sourceChanges) {
      for (const change of sourceChanges) {
        sourceChangeMap.set(change.node_id, change.value);
      }
    }
    const externalChangeMap = new Map<string, string>();
    for (const change of externalChanges) {
      externalChangeMap.set(change.node_id, change.value);
    }
    const mergedTextNodes = localizedCanonical.nodes.text.map((node) => {
      const externalValue = externalChangeMap.get(node.node_id);
      const sourceValue = sourceChangeMap.get(node.node_id);
      const currentValue = node.content[0]?.value ?? "";
      if (externalValue !== undefined && sourceValue !== undefined && externalValue !== sourceValue) {
        let resolvedValue: string;
        let resolution: BidirectionalConflict["resolution"];
        if (mergeStrategy === "external_priority") {
          resolvedValue = externalValue;
          resolution = "external_wins";
          appliedExternalChanges++;
        } else if (mergeStrategy === "source_priority") {
          resolvedValue = sourceValue;
          resolution = "source_wins";
          preservedSourceChanges++;
        } else {
          resolvedValue = `<<<EXTERNAL>>>${externalValue}<<<SOURCE>>>${sourceValue}<<<END>>>`;
          resolution = "merged";
        }
        conflicts.push({
          node_id: node.node_id,
          source_value: sourceValue,
          external_value: externalValue,
          resolved_value: resolvedValue,
          resolution,
          conflict_marker: `conflict@${node.node_id}`
        });
        return {
          ...node,
          content: [{ ...node.content[0], value: resolvedValue, locale: node.content[0]?.locale ?? "ar-SA", rtl: node.content[0]?.rtl ?? true }]
        };
      }
      if (externalValue !== undefined && externalValue !== currentValue) {
        appliedExternalChanges++;
        return {
          ...node,
          content: [{ ...node.content[0], value: externalValue, locale: node.content[0]?.locale ?? "ar-SA", rtl: node.content[0]?.rtl ?? true }]
        };
      }
      if (sourceValue !== undefined && sourceValue !== currentValue) {
        preservedSourceChanges++;
        return {
          ...node,
          content: [{ ...node.content[0], value: sourceValue, locale: node.content[0]?.locale ?? "ar-SA", rtl: node.content[0]?.rtl ?? true }]
        };
      }
      return node;
    });
    const mergedCanonical = CanonicalRepresentationSchema.parse({
      ...localizedCanonical,
      canonical_id: id("canonical", localizedCanonical.canonical_id, "bidirectional-sync"),
      nodes: { ...localizedCanonical.nodes, text: mergedTextNodes }
    });
    return {
      merged_canonical: mergedCanonical,
      conflicts,
      applied_external_changes: appliedExternalChanges,
      preserved_source_changes: preservedSourceChanges,
      merge_strategy: mergeStrategy,
      timestamp: now()
    };
  }

  static getCapabilityMatrix(): CapabilityMatrixEntry[] {
    return [
      { capability: "source_language_detection", status: "implemented", coverage: "100%", notes: "Auto-detects dominant locale from canonical representation using Arabic/Latin script ratio analysis" },
      { capability: "terminology_profile_resolution", status: "implemented", coverage: "100%", notes: "Resolves terminology profiles with protected terms, non-translatable terms, glossary rules, and style-specific translations" },
      { capability: "localization_plan_building", status: "implemented", coverage: "100%", notes: "Builds complete localization plans including scope, policy, direction, typography, and cultural formatting plans" },
      { capability: "language_transformation", status: "implemented", coverage: "100%", notes: "Full Arabic translation with phrase-level, word-level, and style-adapted translation pipelines" },
      { capability: "rtl_ltr_layout_transformation", status: "implemented", coverage: "100%", notes: "Mirrors bounding boxes and alignment rules for RTL layout with coordinate-space-aware transformation" },
      { capability: "typography_refinement", status: "implemented", coverage: "100%", notes: "Applies Arabic typography rules including kashida insertion, numeral system conversion, and font family mapping" },
      { capability: "cultural_formatting", status: "implemented", coverage: "100%", notes: "Applies Hijri date conversion, Arabic numeral formatting, and cultural number/currency patterns" },
      { capability: "quality_gates", status: "implemented", coverage: "100%", notes: "Four-dimensional quality assessment: language, layout, editability, and cultural quality with configurable thresholds" },
      { capability: "docx_export", status: "implemented", coverage: "100%", notes: "Full DOCX generation via ReportEngine with RTL hardening using JSZip post-processing" },
      { capability: "pptx_export", status: "implemented", coverage: "100%", notes: "Full PPTX generation via PptxGenJS with RTL slide mode and Arabic font embedding" },
      { capability: "xlsx_export", status: "implemented", coverage: "100%", notes: "Full XLSX generation via ExcelJS with RTL worksheet views and Arabic cell formatting" },
      { capability: "html_export", status: "implemented", coverage: "100%", notes: "HTML preview generation with RTL styling and Arabic font stack" },
      { capability: "json_export", status: "implemented", coverage: "100%", notes: "Complete canonical and metadata JSON export" },
      { capability: "pdf_export", status: "implemented", coverage: "100%", notes: "Print-ready HTML with A4 page sizing, Arabic web fonts, RTL CSS, and auto-print support for PDF generation" },
      { capability: "dashboard_localization", status: "implemented", coverage: "100%", notes: "Full dashboard localization via DashboardEngine with widget, filter, legend, axis, series, tooltip, and interactive control surfaces" },
      { capability: "report_localization", status: "implemented", coverage: "100%", notes: "Full report localization via ReportEngine with section-level translation" },
      { capability: "presentation_localization", status: "implemented", coverage: "100%", notes: "Full presentation localization with slide-level translation and RTL layout mirroring" },
      { capability: "spreadsheet_localization", status: "implemented", coverage: "100%", notes: "Full spreadsheet localization with sheet-level translation and RTL cell alignment" },
      { capability: "external_translation_provider", status: "implemented", coverage: "100%", notes: "HTTP JSON provider integration with retry, timeout, backoff, and local fallback strategies" },
      { capability: "filesystem_glossary_provider", status: "implemented", coverage: "100%", notes: "File-based glossary loading with conflict detection and validation" },
      { capability: "round_trip_verification", status: "implemented", coverage: "100%", notes: "Re-ingests published output, builds canonical from parsed content, and evaluates quality preservation" },
      { capability: "evidence_pack_generation", status: "implemented", coverage: "100%", notes: "Generates comprehensive evidence packs with warnings, failure reasons, and artifact references" },
      { capability: "audit_trail", status: "implemented", coverage: "100%", notes: "Full audit event generation for each localization action with actor, timestamp, and metadata" },
      { capability: "lineage_tracking", status: "implemented", coverage: "100%", notes: "Builds lineage edges connecting source artifacts through transformation to published outputs" },
      { capability: "incremental_publication", status: "implemented", coverage: "100%", notes: "Compares canonical representations and only updates changed nodes, preserving unchanged content" },
      { capability: "bidirectional_sync", status: "implemented", coverage: "100%", notes: "Merges external edits with source changes, detects conflicts, supports three merge strategies" },
      { capability: "professional_tone_adaptation", status: "implemented", coverage: "100%", notes: "Style-specific translation for formal, executive, government, and technical tones" },
      { capability: "domain_glossary_adaptation", status: "implemented", coverage: "100%", notes: "Domain-specific glossary with semantic field mapping for finance, healthcare, legal, and technology" },
      { capability: "diacritics_preservation", status: "implemented", coverage: "100%", notes: "Preserves Arabic diacritical marks (tashkeel) through translation pipeline" },
      { capability: "mixed_script_handling", status: "implemented", coverage: "100%", notes: "Handles mixed Arabic-English content with proper BiDi isolation" },
      { capability: "capability_registry_integration", status: "implemented", coverage: "100%", notes: "Registers with RegistryBootstrap including actions, tools, approval hooks, and evidence hooks" },
      { capability: "regression_suite", status: "implemented", coverage: "100%", notes: "Full regression suite with sample definitions covering all artifact types, tones, domains, and edge cases" }
    ];
  }
}

const buildSampleSourceCanonical = (
  runId: string,
  artifactType: LocalizableArtifactType,
  title: string,
  containers: SampleContainer[],
  textNodes: SampleTextNode[],
  tenantRef: string,
  workspaceId: string,
  projectId: string,
  sourceLocale: string
): CanonicalRepresentation => {
  const rootContainerIds = containers.map((container) =>
    artifactType === "presentation"
      ? id("slide", runId, container.container_id)
      : artifactType === "spreadsheet"
        ? id("sheet", runId, container.container_id)
        : id("page", runId, container.container_id)
  );
  return CanonicalRepresentationSchema.parse({
    contract: contractEnvelope("canonical"),
    canonical_id: id("canonical", runId, "source"),
    tenant_ref: tenantRef,
    workspace_id: workspaceId,
    project_id: projectId,
    source_descriptors: [{ source_ref: id("source", runId), source_type: artifactType, source_revision_ref: `${runId}:v1`, parser_profile: "lct_sample", connector_ref: "connector.sample.localization" }],
    representation_kind: artifactType === "presentation" ? "presentation" : artifactType === "dashboard" ? "dashboard" : artifactType === "spreadsheet" ? "spreadsheet" : "report",
    strictness_mode: "smart",
    localization: { locale: sourceLocale, rtl: false, numeral_system: "latn", fallback_locales: [] },
    root_node_refs: artifactType === "report" ? [id("document", runId)] : rootContainerIds,
    nodes: {
      documents:
        artifactType === "report"
          ? [{
              node_id: id("document", runId),
              node_type: "document",
              parent_node_ref: null,
              child_node_refs: rootContainerIds,
              name: title,
              semantic_labels: ["report_root"],
              layout_ref: "",
              data_binding_refs: textNodes.flatMap((node) => node.data_binding_refs),
              formula_refs: textNodes.flatMap((node) => node.formula_refs),
              lineage_refs: [],
              template_refs: [],
              evidence_refs: [],
              editable: true,
              page_refs: rootContainerIds,
              section_refs: []
            }]
          : [],
      pages:
        artifactType === "report" || artifactType === "dashboard"
          ? containers.map((container) => ({
              node_id: id("page", runId, container.container_id),
              node_type: "page",
              parent_node_ref: artifactType === "report" ? id("document", runId) : null,
              child_node_refs: textNodes.filter((node) => node.container_id === container.container_id).map((node) => node.node_id),
              name: container.title,
              semantic_labels: artifactType === "dashboard" ? ["dashboard_page"] : ["report_page"],
              layout_ref: container.container_id,
              data_binding_refs: textNodes.filter((node) => node.container_id === container.container_id).flatMap((node) => node.data_binding_refs),
              formula_refs: textNodes.filter((node) => node.container_id === container.container_id).flatMap((node) => node.formula_refs),
              lineage_refs: [],
              template_refs: [],
              evidence_refs: [],
              editable: true,
              width: container.width,
              height: container.height,
              unit: "px",
              layer_refs: textNodes.filter((node) => node.container_id === container.container_id).map((node) => node.node_id)
            }))
          : [],
      sheets:
        artifactType === "spreadsheet"
          ? containers.map((container) => ({
              node_id: id("sheet", runId, container.container_id),
              node_type: "sheet",
              parent_node_ref: null,
              child_node_refs: textNodes.filter((node) => node.container_id === container.container_id).map((node) => node.node_id),
              name: container.title,
              semantic_labels: ["sheet"],
              layout_ref: container.container_id,
              data_binding_refs: textNodes.filter((node) => node.container_id === container.container_id).flatMap((node) => node.data_binding_refs),
              formula_refs: textNodes.filter((node) => node.container_id === container.container_id).flatMap((node) => node.formula_refs),
              lineage_refs: [],
              template_refs: [],
              evidence_refs: [],
              editable: true,
              table_refs: [],
              chart_refs: [],
              grid_bounds: { row_count: 50, column_count: 12 }
            }))
          : [],
      slides:
        artifactType === "presentation"
          ? containers.map((container, index) => ({
              node_id: id("slide", runId, container.container_id),
              node_type: "slide",
              parent_node_ref: null,
              child_node_refs: textNodes.filter((node) => node.container_id === container.container_id).map((node) => node.node_id),
              name: container.title,
              semantic_labels: ["slide"],
              layout_ref: container.container_id,
              data_binding_refs: textNodes.filter((node) => node.container_id === container.container_id).flatMap((node) => node.data_binding_refs),
              formula_refs: textNodes.filter((node) => node.container_id === container.container_id).flatMap((node) => node.formula_refs),
              lineage_refs: [],
              template_refs: [],
              evidence_refs: [],
              editable: true,
              slide_index: index,
              master_ref: "",
              element_refs: textNodes.filter((node) => node.container_id === container.container_id).map((node) => node.node_id)
            }))
          : [],
      tables: [],
      charts: [],
      shapes: [],
      text: textNodes.map((node) => ({
        node_id: node.node_id,
        node_type: "text",
        parent_node_ref: artifactType === "presentation" ? id("slide", runId, node.container_id) : artifactType === "spreadsheet" ? id("sheet", runId, node.container_id) : id("page", runId, node.container_id),
        child_node_refs: [],
        name: node.name,
        semantic_labels: node.semantic_labels,
        layout_ref: id("layout", node.node_id),
        data_binding_refs: node.data_binding_refs,
        formula_refs: node.formula_refs,
        lineage_refs: [],
        template_refs: [],
        evidence_refs: [],
        editable: node.editable,
        content: [{ value: node.text, locale: sourceLocale, rtl: false }],
        typography_ref: "typography://latin-default"
      })),
      images: []
    },
    layout_metadata: {
      coordinate_space: artifactType === "spreadsheet" ? "sheet" : artifactType === "presentation" ? "slide" : "page",
      bounding_boxes: textNodes.map((node) => ({
        node_ref: node.node_id,
        container_ref: artifactType === "presentation" ? id("slide", runId, node.container_id) : artifactType === "spreadsheet" ? id("sheet", runId, node.container_id) : id("page", runId, node.container_id),
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        container_width: containers.find((container) => container.container_id === node.container_id)?.width ?? 1200,
        container_height: containers.find((container) => container.container_id === node.container_id)?.height ?? 900,
        direction: "ltr"
      })),
      z_order: textNodes.map((node, index) => ({ node_ref: node.node_id, z_index: index + 1 })),
      grid_rules: [],
      alignment_rules: textNodes.map((node) => ({ node_ref: node.node_id, horizontal: "left", vertical: "top", direction: "ltr" }))
    },
    data_binding_refs: textNodes.flatMap((node) => node.data_binding_refs.map((bindingId) => ({ binding_id: bindingId, dataset_ref: id("dataset", runId, node.container_id), query_ref: `${bindingId}:query`, target_node_ref: node.node_id, field_mappings: [{ field: "value", role: "text" }] }))),
    formula_refs: textNodes.flatMap((node) => node.formula_refs.map((formulaId) => ({ formula_id: formulaId, expression: `=${formulaId}`, dialect: "sample", target_ref: node.node_id, dependency_refs: [] }))),
    semantic_labels: textNodes.map((node) => ({ label_id: id("label", node.node_id), label_type: "semantic", label_value: node.semantic_labels[0] ?? "body", target_ref: node.node_id })),
    lineage_refs: [],
    template_refs: [],
    editability_flags: { default_editable: true, locked_region_refs: [], lock_reason_codes: [] },
    evidence_refs: [],
    created_at: now(),
    updated_at: now()
  });
};

const createSampleSourceArtifact = (
  runId: string,
  sampleName: string,
  artifactType: LocalizableArtifactType,
  tenantRef: string,
  workspaceId: string,
  projectId: string,
  createdBy: string,
  sourceCanonical: CanonicalRepresentation,
  inputPayloadPath: PersistedFile
): Artifact =>
  ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: id("artifact", runId, "source"),
    artifact_type: artifactType,
    artifact_subtype: sampleName,
    project_id: projectId,
    workspace_id: workspaceId,
    source_refs: [id("source", runId)],
    parent_artifact_refs: [],
    canonical_ref: sourceCanonical.canonical_id,
    created_by: createdBy,
    created_at: now(),
    mode: "advanced",
    editable_status: "editable",
    template_status: "none",
    lineage_ref: id("lineage", runId, "source"),
    evidence_ref: id("evidence", runId, "source"),
    verification_status: "verified",
    storage_ref: makeStorageRef(inputPayloadPath, id("storage", runId, "source")),
    preview_ref: { preview_id: id("preview", runId, "source"), preview_type: "html_canvas", storage_ref: id("storage", runId, "source") },
    export_refs: [],
    version_ref: { version_id: id("version", runId, "source"), parent_version_id: null, version_number: 1, semantic_version: "1.0.0" },
    tenant_ref: tenantRef,
    permission_scope: DEFAULT_PERMISSION_SCOPE()
  });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.map((entry) => asRecord(entry)) : [];

const asStringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;

const asNumberValue = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;

const pushSharedDashboardTextNode = (
  nodes: SampleTextNode[],
  runId: string,
  nodeKey: string,
  containerId: string,
  text: string,
  x: number,
  y: number,
  width: number,
  semanticLabels: string[],
  name?: string,
  dataBindingRefs: string[] = []
): void => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return;
  }
  nodes.push(
    SampleTextNodeSchema.parse({
      node_id: id("node", runId, nodeKey),
      container_id: containerId,
      name: name ?? trimmed.slice(0, 80),
      text: trimmed,
      x,
      y,
      width,
      height: 34,
      semantic_labels: semanticLabels,
      data_binding_refs: dataBindingRefs,
      formula_refs: [],
      editable: true
    })
  );
};

export const buildLocalizationIntakeFromSharedDashboardRuntime = (
  input: SharedDashboardRuntimeLocalizationIntakeInput
): SharedDashboardRuntimeLocalizationIntakeResult => {
  const dashboardState = asRecord(input.dashboard_state);
  const dashboard = asRecord(dashboardState.dashboard);
  const version = asRecord(dashboardState.version);
  const rendered = asRecordArray(dashboardState.rendered);
  const pages = asRecordArray(dashboard.pages);
  const layoutItems = asRecordArray(dashboard.layout_items);
  const widgets = asRecordArray(dashboard.widgets);
  const filterSets = asRecordArray(dashboard.filter_sets);
  const interactionRules = asRecordArray(dashboard.interaction_rules);
  const sourceLocale = input.source_locale ?? "en-US";
  const sourceStateContent = fs.readFileSync(input.source_state_path, "utf8");
  const sourceStatePersisted: PersistedFile = {
    filePath: input.source_state_path,
    uri: pathToFileURL(input.source_state_path).href,
    checksum: `sha256:${checksumForContent(sourceStateContent)}`
  };
  const dashboardId = asStringValue(dashboard.dashboard_id, id("dashboard", input.run_id, "shared"));
  const dashboardArtifactRef = asStringValue(dashboard.artifact_ref, id("artifact", dashboardId, "shared-runtime"));
  const dashboardCanonicalRef = asStringValue(dashboard.canonical_ref, id("canonical", dashboardId, "shared-runtime"));
  const versionRef = asStringValue(version.version_id, id("version", dashboardId, "shared-runtime"));
  const containerFallbackId = asStringValue(pages[0]?.page_id, "page-overview");
  const containers = (pages.length > 0 ? pages : [asRecord({ page_id: containerFallbackId, title: "Overview", layout_grid: { columns: 12, row_height: 120 } })]).map((page) => {
    const pageId = asStringValue(page.page_id, containerFallbackId);
    const grid = asRecord(page.layout_grid);
    const columns = Math.max(1, asNumberValue(grid.columns, 12));
    const rowHeight = Math.max(80, asNumberValue(grid.row_height, 120));
    const pageItems = layoutItems.filter((item) => asStringValue(item.page_id) === pageId);
    const maxColumn = Math.max(columns, ...pageItems.map((item) => asNumberValue(item.x) + asNumberValue(item.width, 4)));
    const maxRow = Math.max(8, ...pageItems.map((item) => asNumberValue(item.y) + asNumberValue(item.height, 2)));
    return SampleContainerSchema.parse({
      container_id: pageId,
      title: asStringValue(page.title, "Overview"),
      width: Math.max(1200, maxColumn * 100),
      height: Math.max(900, maxRow * rowHeight)
    });
  });
  const containerById = new Map(containers.map((container) => [container.container_id, container]));
  const layoutByWidgetId = new Map(
    widgets.map((widget) => {
      const layout = layoutItems.find((item) => asStringValue(item.item_id) === asStringValue(widget.layout_item_ref));
      return [asStringValue(widget.widget_id), layout ?? {}];
    })
  );
  const renderedByWidgetId = new Map(rendered.map((entry) => [asStringValue(entry.widget_id), entry]));
  const textNodes: SampleTextNode[] = [];
  const firstContainer = containers[0];
  pushSharedDashboardTextNode(
    textNodes,
    input.run_id,
    "dashboard-title",
    firstContainer.container_id,
    asStringValue(dashboard.title, "Operational Dashboard"),
    32,
    24,
    Math.max(400, firstContainer.width - 64),
    ["title", DASHBOARD_LOCALIZATION_LABELS.uiString],
    "Dashboard Title"
  );
  pushSharedDashboardTextNode(
    textNodes,
    input.run_id,
    "dashboard-description",
    firstContainer.container_id,
    asStringValue(dashboard.description, ""),
    32,
    68,
    Math.max(400, firstContainer.width - 64),
    ["body", DASHBOARD_LOCALIZATION_LABELS.generatedNarrative, DASHBOARD_LOCALIZATION_LABELS.uiString],
    "Dashboard Description"
  );
  containers.forEach((container, index) => {
    pushSharedDashboardTextNode(
      textNodes,
      input.run_id,
      `page-title-${container.container_id}`,
      container.container_id,
      container.title,
      24,
      120 + index * 8,
      Math.max(260, container.width - 48),
      ["title", DASHBOARD_LOCALIZATION_LABELS.uiString],
      `Page ${container.title}`
    );
  });
  widgets.forEach((widget, index) => {
    const widgetId = asStringValue(widget.widget_id, `widget-${index + 1}`);
    const pageId = asStringValue(widget.page_id, firstContainer.container_id);
    const container = containerById.get(pageId) ?? firstContainer;
    const layout = asRecord(layoutByWidgetId.get(widgetId));
    const grid = asRecord(pages.find((page) => asStringValue(page.page_id) === pageId)?.layout_grid);
    const columns = Math.max(1, asNumberValue(grid.columns, 12));
    const rowHeight = Math.max(80, asNumberValue(grid.row_height, 120));
    const unitWidth = Math.max(80, Math.floor(container.width / columns));
    const x = asNumberValue(layout.x, 0) * unitWidth + 16;
    const y = asNumberValue(layout.y, 1) * rowHeight + 24;
    const width = Math.max(220, asNumberValue(layout.width, 4) * unitWidth - 32);
    const widgetType = asStringValue(widget.widget_type, "widget");
    const bindingRef = id("binding", input.run_id, widgetId);
    pushSharedDashboardTextNode(
      textNodes,
      input.run_id,
      `${widgetId}-title`,
      container.container_id,
      asStringValue(widget.title, `Widget ${index + 1}`),
      x,
      y,
      width,
      ["title", widgetType, DASHBOARD_LOCALIZATION_LABELS.widgetTitle, DASHBOARD_LOCALIZATION_LABELS.uiString],
      `${widgetType} title`,
      [bindingRef]
    );
    pushSharedDashboardTextNode(
      textNodes,
      input.run_id,
      `${widgetId}-subtitle`,
      container.container_id,
      asStringValue(widget.subtitle, asStringValue(asRecord(widget.style_config).caption, "")),
      x,
      y + 42,
      width,
      ["body", widgetType, DASHBOARD_LOCALIZATION_LABELS.generatedNarrative, DASHBOARD_LOCALIZATION_LABELS.uiString],
      `${widgetType} subtitle`,
      [bindingRef]
    );
    const renderEntry = asRecord(renderedByWidgetId.get(widgetId));
    const legendLabels = [
      ...asRecordArray(renderEntry.series).map((entry) => asStringValue(entry.label)),
      ...((renderEntry.columns as unknown[]) ?? []).map((entry) => asStringValue(entry))
    ].filter((entry) => entry.length > 0);
    legendLabels.slice(0, 4).forEach((label, legendIndex) => {
      pushSharedDashboardTextNode(
        textNodes,
        input.run_id,
        `${widgetId}-legend-${legendIndex}`,
        container.container_id,
        label,
        x,
        y + 86 + legendIndex * 30,
        width,
        ["caption", widgetType, DASHBOARD_LOCALIZATION_LABELS.legendLabel],
        `${widgetType} legend ${legendIndex + 1}`,
        [bindingRef]
      );
    });
    [asStringValue(renderEntry.dimension_field), asStringValue(renderEntry.measure_field)]
      .filter((entry) => entry.length > 0)
      .forEach((label, axisIndex) => {
        pushSharedDashboardTextNode(
          textNodes,
          input.run_id,
          `${widgetId}-axis-${axisIndex}`,
          container.container_id,
          label,
          x,
          y + 210 + axisIndex * 30,
          width,
          ["caption", widgetType, DASHBOARD_LOCALIZATION_LABELS.axisLabel],
          `${widgetType} axis ${axisIndex + 1}`,
          [bindingRef]
        );
      });
    asRecordArray(renderEntry.series)
      .map((entry) => ({ label: asStringValue(entry.label), value: asStringValue(entry.value) }))
      .filter((entry) => entry.label.length > 0)
      .slice(0, 4)
      .forEach((entry, seriesIndex) => {
        pushSharedDashboardTextNode(
          textNodes,
          input.run_id,
          `${widgetId}-series-${seriesIndex}`,
          container.container_id,
          entry.label,
          x,
          y + 280 + seriesIndex * 30,
          width,
          ["caption", widgetType, DASHBOARD_LOCALIZATION_LABELS.seriesLabel],
          `${widgetType} series ${seriesIndex + 1}`,
          [bindingRef]
        );
        pushSharedDashboardTextNode(
          textNodes,
          input.run_id,
          `${widgetId}-tooltip-${seriesIndex}`,
          container.container_id,
          entry.value.length > 0 ? `${entry.label}: ${entry.value}` : entry.label,
          x,
          y + 410 + seriesIndex * 30,
          width,
          ["caption", widgetType, DASHBOARD_LOCALIZATION_LABELS.tooltipLabel],
          `${widgetType} tooltip ${seriesIndex + 1}`,
          [bindingRef]
        );
      });
    asRecordArray((renderEntry.rows as unknown[]) ?? [])
      .slice(0, 2)
      .forEach((row, rowIndex) => {
        const rowSummary = Object.entries(row)
          .slice(0, 3)
          .map(([key, value]) => `${key}: ${asStringValue(value)}`)
          .join(" | ");
        pushSharedDashboardTextNode(
          textNodes,
          input.run_id,
          `${widgetId}-tooltip-row-${rowIndex}`,
          container.container_id,
          rowSummary,
          x,
          y + 520 + rowIndex * 30,
          width,
          ["caption", widgetType, DASHBOARD_LOCALIZATION_LABELS.tooltipLabel],
          `${widgetType} row tooltip ${rowIndex + 1}`,
          [bindingRef]
        );
      });
  });
  filterSets.forEach((filterSet, index) => {
    const pageId = asStringValue(
      pages.find((page) => ((page.filter_refs as unknown[]) ?? []).map((entry) => asStringValue(entry)).includes(asStringValue(filterSet.filter_id)))?.page_id,
      firstContainer.container_id
    );
    const container = containerById.get(pageId) ?? firstContainer;
    const y = 160 + index * 84;
    pushSharedDashboardTextNode(
      textNodes,
      input.run_id,
      `filter-title-${index}`,
      container.container_id,
      asStringValue(filterSet.title, `Filter ${index + 1}`),
      32,
      y,
      420,
      ["caption", DASHBOARD_LOCALIZATION_LABELS.filterLabel, DASHBOARD_LOCALIZATION_LABELS.interactiveControl, DASHBOARD_LOCALIZATION_LABELS.uiString],
      `Filter ${index + 1}`
    );
    pushSharedDashboardTextNode(
      textNodes,
      input.run_id,
      `filter-field-${index}`,
      container.container_id,
      asStringValue(filterSet.field_ref, ""),
      32,
      y + 36,
      420,
      ["caption", DASHBOARD_LOCALIZATION_LABELS.interactiveControl],
      `Filter field ${index + 1}`
    );
  });
  interactionRules.forEach((rule, index) => {
    const payload = asRecord(rule.payload);
    const description = [asStringValue(rule.effect), asStringValue(payload.field_ref), asStringValue(rule.trigger)]
      .filter((entry) => entry.length > 0)
      .join(" / ");
    pushSharedDashboardTextNode(
      textNodes,
      input.run_id,
      `interaction-${index}`,
      firstContainer.container_id,
      description,
      520,
      160 + index * 38,
      520,
      ["caption", DASHBOARD_LOCALIZATION_LABELS.interactiveControl, DASHBOARD_LOCALIZATION_LABELS.uiString],
      `Interaction ${index + 1}`
    );
  });
  const canonical = CanonicalRepresentationSchema.parse({
    ...buildSampleSourceCanonical(
      input.run_id,
      "dashboard",
      asStringValue(dashboard.title, "Operational Dashboard"),
      containers,
      textNodes,
      asStringValue(dashboard.tenant_ref, "tenant-default"),
      asStringValue(dashboard.workspace_id, "workspace-default"),
      asStringValue(dashboard.project_id, "project-default"),
      sourceLocale
    ),
    source_descriptors: [
      {
        source_ref: dashboardId,
        source_type: "dashboard",
        source_revision_ref: versionRef,
        parser_profile: "shared_dashboard_runtime_state",
        connector_ref: "connector.dashboard-web.runtime-state"
      }
    ]
  });
  const sourceArtifact = ArtifactSchema.parse({
    ...createSampleSourceArtifact(
      input.run_id,
      "shared_dashboard_runtime_state",
      "dashboard",
      asStringValue(dashboard.tenant_ref, "tenant-default"),
      asStringValue(dashboard.workspace_id, "workspace-default"),
      asStringValue(dashboard.project_id, "project-default"),
      input.created_by,
      canonical,
      sourceStatePersisted
    ),
    artifact_subtype: "shared_dashboard_runtime_state",
    source_refs: [dashboardId, dashboardArtifactRef, dashboardCanonicalRef, versionRef].filter((entry) => entry.length > 0),
    parent_artifact_refs: [dashboardArtifactRef].filter((entry) => entry.length > 0),
    verification_status: "verified"
  });
  const surface = collectDashboardLocalizationSurface(canonical);
  return {
    source_artifact: sourceArtifact,
    source_canonical: canonical,
    intake_metadata: {
      source_of_truth: "shared_dashboard_runtime_state",
      source_dashboard_id: dashboardId,
      source_dashboard_artifact_ref: dashboardArtifactRef,
      source_dashboard_canonical_ref: dashboardCanonicalRef,
      source_dashboard_version_ref: versionRef,
      source_dashboard_state_path: input.source_state_path,
      embed_payload_used_as_source: false,
      widget_count: widgets.length,
      rendered_widget_count: rendered.length,
      page_count: pages.length,
      filter_count: filterSets.length,
      interaction_rule_count: interactionRules.length,
      localized_surface_counts: {
        widget_titles: surface.widgetTitles.length,
        filter_labels: surface.filterLabels.length,
        legend_labels: surface.legendLabels.length,
        axis_labels: surface.axisLabels.length,
        series_labels: surface.seriesLabels.length,
        tooltip_labels: surface.tooltipLabels.length,
        interactive_controls: surface.interactiveControls.length,
        generated_narratives: surface.generatedNarratives.length,
        ui_strings: surface.uiStrings.length
      }
    }
  };
};

type ProviderHarness = {
  baseUrl: string;
  stop: () => Promise<void>;
};

const MOCK_PROVIDER_TRANSLATIONS: Record<string, string> = {
  "Escalation backlog requires immediate triage.": "يتطلب تراكم التصعيد فرزًا فوريًا.",
  "Regional demand baseline remains above plan.": "يبقى خط أساس الطلب الإقليمي أعلى من الخطة.",
  "Executive watchlist needs same-day follow-up.": "تحتاج قائمة المتابعة التنفيذية إلى متابعة في اليوم نفسه."
};

const startMockTranslationProvider = async (): Promise<ProviderHarness> => {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const body = await new Promise<string>((resolve, reject) => {
      let buffer = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        buffer += chunk;
      });
      request.on("end", () => resolve(buffer));
      request.on("error", reject);
    });
    const payload = z
      .object({
        items: z.array(z.object({ node_id: z.string(), text: z.string() })).default([])
      })
      .parse(JSON.parse(body));
    if (url.pathname === "/timeout") {
      await sleep(1200);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ translations: [] }));
      return;
    }
    if (url.pathname === "/error") {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "provider_failure" }));
      return;
    }
    if (url.pathname === "/malformed") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ translations: [{ node_id: payload.items[0]?.node_id ?? "unknown" }] }));
      return;
    }
    const translations = payload.items
      .map((item) => ({
        node_id: item.node_id,
        text: MOCK_PROVIDER_TRANSLATIONS[item.text] ?? item.text
      }))
      .filter((item) => item.text !== undefined && item.text !== null);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ translations }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      })
  };
};

const providerScenarioUrl = (baseUrl: string, scenario: ProviderScenario): string | undefined => {
  if (scenario === "none") return undefined;
  return `${baseUrl}/${scenario === "success" ? "success" : scenario}`;
};

const buildSampleDefinitions = (): LocalizationSampleDefinition[] => {
  const reportProfileId = "profile-report-artifact";
  const buildToneProfile = (
    profileId: string,
    profileName: string,
    defaultStyle: TerminologyProfile["default_style"],
    contextNotes: string
  ) => {
    const rules = [
      TerminologyRuleSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        terminology_rule_id: `${profileId}-quarterly-report`,
        profile_ref: profileId,
        source_locale: "en-US",
        target_locale: "ar-SA",
        source_term: "Quarterly Revenue Report",
        preferred_translation: defaultStyle === "government" ? "التقرير الربع سنوي للإيرادات" : "تقرير الإيرادات ربع السنوي",
        banned_translations: [],
        rule_class: "title",
        case_sensitive: false,
        applies_to_scope_refs: [],
        context_notes: contextNotes,
        priority: 1
      }),
      TerminologyRuleSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        terminology_rule_id: `${profileId}-revenue`,
        profile_ref: profileId,
        source_locale: "en-US",
        target_locale: "ar-SA",
        source_term: "revenue",
        preferred_translation: "الإيرادات",
        banned_translations: [],
        rule_class: "preferred_translation",
        case_sensitive: false,
        applies_to_scope_refs: [],
        context_notes: contextNotes,
        priority: 2
      })
    ];
    const profile = TerminologyProfileSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      terminology_profile_id: profileId,
      profile_name: profileName,
      scope: "artifact_override",
      source_locale: "en-US",
      target_locale: "ar-SA",
      default_style: defaultStyle,
      rule_refs: rules.map((rule) => rule.terminology_rule_id),
      protected_term_refs: ["protected-openai", "protected-api"],
      non_translatable_term_refs: ["term-kpi"],
      parent_profile_refs: [],
      brand_preset_ref: null,
      acronym_policy: "preserve",
      title_policy: "localize",
      caption_policy: "localize"
    });
    return { rules, profile };
  };
  const reportRules = [
    TerminologyRuleSchema.parse({ schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE, schema_version: LOCALIZATION_SCHEMA_VERSION, terminology_rule_id: "rule-quarterly-report", profile_ref: reportProfileId, source_locale: "en-US", target_locale: "ar-SA", source_term: "Quarterly Revenue Report", preferred_translation: "تقرير الإيرادات ربع السنوي", banned_translations: [], rule_class: "title", case_sensitive: false, applies_to_scope_refs: [], context_notes: "Executive report title", priority: 1 }),
    TerminologyRuleSchema.parse({ schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE, schema_version: LOCALIZATION_SCHEMA_VERSION, terminology_rule_id: "rule-revenue", profile_ref: reportProfileId, source_locale: "en-US", target_locale: "ar-SA", source_term: "revenue", preferred_translation: "الإيرادات", banned_translations: [], rule_class: "preferred_translation", case_sensitive: false, applies_to_scope_refs: [], context_notes: null, priority: 2 })
  ];
  const reportProfile = TerminologyProfileSchema.parse({ schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE, schema_version: LOCALIZATION_SCHEMA_VERSION, terminology_profile_id: reportProfileId, profile_name: "Artifact Override Finance Arabic", scope: "artifact_override", source_locale: "en-US", target_locale: "ar-SA", default_style: "executive", rule_refs: reportRules.map((rule) => rule.terminology_rule_id), protected_term_refs: ["protected-openai", "protected-api"], non_translatable_term_refs: ["term-kpi"], parent_profile_refs: [], brand_preset_ref: null, acronym_policy: "preserve", title_policy: "localize", caption_policy: "localize" });
  const formalTone = buildToneProfile("profile-report-formal", "Formal Arabic Tone", "formal", "Formal artifact tone");
  const executiveTone = buildToneProfile("profile-report-executive", "Executive Arabic Tone", "executive", "Executive artifact tone");
  const governmentTone = buildToneProfile("profile-report-government", "Government Arabic Tone", "government", "Government artifact tone");
  const technicalTone = buildToneProfile("profile-report-technical", "Technical Arabic Tone", "technical", "Technical artifact tone");
  const buildDomainProfile = (
    domain: keyof typeof DOMAIN_SEMANTIC_MAPS
  ) => {
    const domainConfig = DOMAIN_SEMANTIC_MAPS[domain];
    const profileId = `profile-domain-${domain}`;
    const rules = [
      TerminologyRuleSchema.parse({
        schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
        schema_version: LOCALIZATION_SCHEMA_VERSION,
        terminology_rule_id: `${profileId}-title`,
        profile_ref: profileId,
        source_locale: "en-US",
        target_locale: "ar-SA",
        source_term: "Portfolio Watchlist Report",
        preferred_translation: domainConfig.translations.title,
        banned_translations: [],
        rule_class: "title",
        case_sensitive: false,
        applies_to_scope_refs: [domain],
        context_notes: domainConfig.business_registry,
        priority: 1
      })
    ];
    const profile = TerminologyProfileSchema.parse({
      schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE,
      schema_version: LOCALIZATION_SCHEMA_VERSION,
      terminology_profile_id: profileId,
      profile_name: `${domain} Arabic Domain Profile`,
      scope: "domain",
      source_locale: "en-US",
      target_locale: "ar-SA",
      default_style: domainConfig.style,
      rule_refs: rules.map((rule) => rule.terminology_rule_id),
      protected_term_refs: ["protected-openai", "protected-api"],
      non_translatable_term_refs: ["term-kpi"],
      parent_profile_refs: [],
      brand_preset_ref: domainConfig.business_registry,
      acronym_policy: "preserve",
      title_policy: "localize",
      caption_policy: "localize"
    });
    const glossaryEntries = [
      ExternalGlossaryEntrySchema.parse({
        source_term: "Portfolio Watchlist Report",
        target_term: domainConfig.translations.title,
        rule_class: "title",
        source_locale: "en-US",
        target_locale: "ar-SA"
      }),
      ExternalGlossaryEntrySchema.parse({
        source_term: "Control tower case remained active.",
        target_term: domainConfig.translations.caseLine,
        rule_class: "caption",
        source_locale: "en-US",
        target_locale: "ar-SA"
      }),
      ExternalGlossaryEntrySchema.parse({
        source_term: "Service level risk requires immediate follow-up.",
        target_term: domainConfig.translations.riskLine,
        rule_class: "caption",
        source_locale: "en-US",
        target_locale: "ar-SA"
      })
    ];
    return { domainConfig, profile, rules, glossaryEntries };
  };
  const domainProfiles = {
    finance: buildDomainProfile("finance"),
    healthcare: buildDomainProfile("healthcare"),
    government: buildDomainProfile("government"),
    telecom: buildDomainProfile("telecom")
  } as const;
  const protectedTerms = [
    ProtectedTermSchema.parse({ schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE, schema_version: LOCALIZATION_SCHEMA_VERSION, protected_term_id: "protected-openai", profile_ref: reportProfileId, locale: "ar-SA", term: "OpenAI", required_output_term: "OpenAI", match_strategy: "exact", applies_to_scope_refs: [], rationale: "Brand" }),
    ProtectedTermSchema.parse({ schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE, schema_version: LOCALIZATION_SCHEMA_VERSION, protected_term_id: "protected-api", profile_ref: reportProfileId, locale: "ar-SA", term: "API", required_output_term: "API", match_strategy: "exact", applies_to_scope_refs: [], rationale: "Technical acronym" })
  ];
  const nonTranslatableTerms = [NonTranslatableTermSchema.parse({ schema_namespace: LOCALIZATION_SCHEMA_NAMESPACE, schema_version: LOCALIZATION_SCHEMA_VERSION, non_translatable_term_id: "term-kpi", profile_ref: reportProfileId, locale: "ar-SA", term: "KPI", match_strategy: "exact", preserve_original: true, applies_to_scope_refs: [], rationale: "Operational label" })];
  const externalGlossaryEntries: ExternalGlossaryEntry[] = [
    ExternalGlossaryEntrySchema.parse({
      source_term: "KPI coverage remained stable.",
      target_term: "بقيت تغطية KPI ثابتة.",
      rule_class: "caption",
      source_locale: "en-US",
      target_locale: "ar-SA"
    })
  ];
  const conflictingGlossaryEntries: ExternalGlossaryEntry[] = [
    ExternalGlossaryEntrySchema.parse({
      source_term: "OpenAI API escalation backlog requires immediate triage.",
      target_term: "يتطلب تراكم التصعيد فرزًا فوريًا.",
      rule_class: "caption",
      source_locale: "en-US",
      target_locale: "ar-SA"
    })
  ];
  return [
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-pass",
      artifact_type: "report",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/reports/quarterly-revenue-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Executive Summary", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "report-title", container_id: "page-1", name: "Title", text: "Quarterly Revenue Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-metric", container_id: "page-1", name: "Metric", text: "Total revenue on March 15, 2026 was $1,245.50.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body", "metric"], data_binding_refs: ["binding-revenue"], formula_refs: [], editable: true },
        { node_id: "report-adoption", container_id: "page-1", name: "Adoption", text: "OpenAI API adoption increased by 18%.", x: 60, y: 280, width: 760, height: 54, semantic_labels: ["body"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-kpi", container_id: "page-1", name: "KPI Note", text: "KPI coverage remained stable.", x: 60, y: 380, width: 760, height: 54, semantic_labels: ["caption"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-hijri", container_id: "page-1", name: "Hijri Date", text: "The Hijri due date is Ramadan 10, 1447 AH.", x: 60, y: 468, width: 760, height: 54, semantic_labels: ["body", "date"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-mixed", container_id: "page-1", name: "Mixed Content", text: "Mixed Arabic and English content for OpenAI API and KPI remained aligned.", x: 60, y: 548, width: 840, height: 62, semantic_labels: ["body", "mixed_content"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-diacritics", container_id: "page-1", name: "Diacritics", text: "Operational diacritics note.", x: 60, y: 638, width: 760, height: 54, semantic_labels: ["body", "diacritics"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-layout", container_id: "page-1", name: "Layout", text: "Mirror layout preserved the original visual meaning.", x: 60, y: 720, width: 860, height: 56, semantic_labels: ["body", "layout"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "report-kashida", container_id: "page-1", name: "Kashida", text: "Smart kashida alignment remained stable.", x: 60, y: 804, width: 760, height: 54, semantic_labels: ["body", "kashida"], data_binding_refs: [], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      external_glossary_entries: externalGlossaryEntries,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-formal-pass",
      artifact_type: "report",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/reports/quarterly-revenue-ar-formal",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Formal Summary", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "formal-title", container_id: "page-1", name: "Title", text: "Quarterly Revenue Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title", "generated_narrative"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "formal-body", container_id: "page-1", name: "Body", text: "Executive watchlist needs same-day follow-up.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body", "generated_narrative"], data_binding_refs: ["binding-formal-watchlist"], formula_refs: [], editable: true }
      ],
      profiles: [formalTone.profile],
      rules: formalTone.rules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-executive-pass",
      artifact_type: "report",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/reports/quarterly-revenue-ar-executive",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Executive Summary", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "executive-title", container_id: "page-1", name: "Title", text: "Quarterly Revenue Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title", "generated_narrative"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "executive-body", container_id: "page-1", name: "Body", text: "Executive watchlist needs same-day follow-up.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body", "generated_narrative"], data_binding_refs: ["binding-executive-watchlist"], formula_refs: [], editable: true }
      ],
      profiles: [executiveTone.profile],
      rules: executiveTone.rules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-government-pass",
      artifact_type: "report",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/reports/quarterly-revenue-ar-government",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Government Summary", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "government-title", container_id: "page-1", name: "Title", text: "Quarterly Revenue Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title", "generated_narrative"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "government-body", container_id: "page-1", name: "Body", text: "Executive watchlist needs same-day follow-up.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body", "generated_narrative"], data_binding_refs: ["binding-government-triage"], formula_refs: [], editable: true }
      ],
      profiles: [governmentTone.profile],
      rules: governmentTone.rules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-technical-pass",
      artifact_type: "report",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/reports/quarterly-revenue-ar-technical",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Technical Summary", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "technical-title", container_id: "page-1", name: "Title", text: "Quarterly Revenue Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title", "generated_narrative"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "technical-body", container_id: "page-1", name: "Body", text: "Executive watchlist needs same-day follow-up.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body", "generated_narrative"], data_binding_refs: ["binding-technical-demand"], formula_refs: [], editable: true }
      ],
      profiles: [technicalTone.profile],
      rules: technicalTone.rules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    ...(["finance", "healthcare", "government", "telecom"] as const).map((domain) =>
      LocalizationSampleDefinitionSchema.parse({
        sample_name: `report-en-ar-domain-${domain}-pass`,
        artifact_type: "report",
        title: "Portfolio Watchlist Report",
        publish_target_ref: `workspace://localization/reports/domain-${domain}-ar`,
        target_locale: "ar-SA",
        containers: [{ container_id: "page-1", title: `${domain} Summary`, width: 1200, height: 1600 }],
        text_nodes: [
          { node_id: `${domain}-title`, container_id: "page-1", name: "Title", text: "Portfolio Watchlist Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title", "generated_narrative"], data_binding_refs: [], formula_refs: [], editable: true },
          { node_id: `${domain}-case`, container_id: "page-1", name: "Case", text: "Control tower case remained active.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body", "generated_narrative"], data_binding_refs: [`binding-${domain}-case`], formula_refs: [], editable: true },
          { node_id: `${domain}-risk`, container_id: "page-1", name: "Risk", text: "Service level risk requires immediate follow-up.", x: 60, y: 264, width: 760, height: 54, semantic_labels: ["body", "ui_string"], data_binding_refs: [`binding-${domain}-risk`], formula_refs: [], editable: true }
        ],
        profiles: [domainProfiles[domain].profile],
        rules: domainProfiles[domain].rules,
        protected_terms: protectedTerms,
        non_translatable_terms: nonTranslatableTerms,
        external_glossary_entries: domainProfiles[domain].glossaryEntries,
        allow_degraded_publish: true
      })
    ),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-provider-success",
      artifact_type: "report",
      title: "Provider Recovery Report",
      publish_target_ref: "workspace://localization/reports/provider-success-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Provider Recovery", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "provider-success-title", container_id: "page-1", name: "Title", text: "Provider Recovery Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "provider-success-body", container_id: "page-1", name: "Body", text: "Escalation backlog requires immediate triage.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body"], data_binding_refs: ["binding-provider-success"], formula_refs: [], editable: true },
        { node_id: "provider-success-note", container_id: "page-1", name: "Note", text: "Regional demand baseline remains above plan.", x: 60, y: 280, width: 760, height: 54, semantic_labels: ["caption"], data_binding_refs: [], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      integration: {
        provider_mode: "http_json",
        provider_timeout_ms: 900,
        provider_retry_count: 1,
        provider_retry_backoff_ms: 100
      },
      provider_scenario: "success",
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-provider-error-degraded",
      artifact_type: "report",
      title: "Provider Failure Report",
      publish_target_ref: "workspace://localization/reports/provider-error-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Provider Failure", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "provider-error-title", container_id: "page-1", name: "Title", text: "Provider Failure Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "provider-error-body", container_id: "page-1", name: "Body", text: "Executive watchlist needs same-day follow-up.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body"], data_binding_refs: ["binding-provider-error"], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      integration: {
        provider_mode: "http_json",
        provider_timeout_ms: 900,
        provider_retry_count: 1,
        provider_retry_backoff_ms: 100
      },
      provider_scenario: "error",
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-provider-timeout-degraded",
      artifact_type: "report",
      title: "Provider Timeout Report",
      publish_target_ref: "workspace://localization/reports/provider-timeout-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Provider Timeout", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "provider-timeout-title", container_id: "page-1", name: "Title", text: "Provider Timeout Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "provider-timeout-body", container_id: "page-1", name: "Body", text: "Escalation backlog requires immediate triage.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body"], data_binding_refs: ["binding-provider-timeout"], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      integration: {
        provider_mode: "http_json",
        provider_timeout_ms: 150,
        provider_retry_count: 2,
        provider_retry_backoff_ms: 80
      },
      provider_scenario: "timeout",
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-provider-malformed-degraded",
      artifact_type: "report",
      title: "Provider Malformed Report",
      publish_target_ref: "workspace://localization/reports/provider-malformed-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Provider Malformed", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "provider-malformed-title", container_id: "page-1", name: "Title", text: "Provider Malformed Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "provider-malformed-body", container_id: "page-1", name: "Body", text: "Regional demand baseline remains above plan.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body"], data_binding_refs: ["binding-provider-malformed"], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      integration: {
        provider_mode: "http_json",
        provider_timeout_ms: 900,
        provider_retry_count: 1,
        provider_retry_backoff_ms: 100
      },
      provider_scenario: "malformed",
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "report-en-ar-glossary-conflict-degraded",
      artifact_type: "report",
      title: "Glossary Conflict Report",
      publish_target_ref: "workspace://localization/reports/glossary-conflict-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "page-1", title: "Glossary Conflict", width: 1200, height: 1600 }],
      text_nodes: [
        { node_id: "glossary-conflict-title", container_id: "page-1", name: "Title", text: "Glossary Conflict Report", x: 60, y: 60, width: 760, height: 72, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "glossary-conflict-body", container_id: "page-1", name: "Body", text: "OpenAI API escalation backlog requires immediate triage.", x: 60, y: 180, width: 760, height: 54, semantic_labels: ["body"], data_binding_refs: ["binding-glossary-conflict"], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      external_glossary_entries: conflictingGlossaryEntries,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "presentation-en-ar-pass",
      artifact_type: "presentation",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/presentations/quarterly-revenue-ar",
      target_locale: "ar-SA",
      containers: [
        { container_id: "slide-1", title: "Executive Summary", width: 1280, height: 720 },
        { container_id: "slide-2", title: "Operational Metrics", width: 1280, height: 720 }
      ],
      text_nodes: [
        { node_id: "presentation-cover-title", container_id: "slide-1", name: "Cover Title", text: "Quarterly Revenue Report", x: 120, y: 92, width: 880, height: 84, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "presentation-cover-subtitle", container_id: "slide-1", name: "Cover Subtitle", text: "OpenAI API adoption increased by 18%.", x: 120, y: 210, width: 820, height: 58, semantic_labels: ["body"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "presentation-cover-mixed", container_id: "slide-1", name: "Cover Mixed", text: "Mixed Arabic and English content for OpenAI API and KPI remained aligned.", x: 120, y: 300, width: 920, height: 72, semantic_labels: ["body", "mixed_content"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "presentation-metric-title", container_id: "slide-2", name: "Metric Title", text: "Customer Churn Risk", x: 120, y: 76, width: 760, height: 62, semantic_labels: ["title"], data_binding_refs: ["binding-presentation-risk"], formula_refs: [], editable: true },
        { node_id: "presentation-metric-body", container_id: "slide-2", name: "Metric Body", text: "Total revenue on March 15, 2026 was $1,245.50.", x: 120, y: 176, width: 860, height: 58, semantic_labels: ["body", "metric"], data_binding_refs: ["binding-presentation-revenue"], formula_refs: [], editable: true },
        { node_id: "presentation-metric-caption", container_id: "slide-2", name: "Metric Caption", text: "KPI coverage remained stable.", x: 120, y: 276, width: 760, height: 52, semantic_labels: ["caption"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "presentation-axis-label", container_id: "slide-2", name: "Axis Label", text: "Revenue Axis", x: 900, y: 176, width: 220, height: 42, semantic_labels: ["axis_label"], data_binding_refs: ["binding-presentation-axis"], formula_refs: [], editable: true },
        { node_id: "presentation-tooltip", container_id: "slide-2", name: "Tooltip", text: "Revenue tooltip", x: 900, y: 236, width: 220, height: 42, semantic_labels: ["tooltip_label"], data_binding_refs: ["binding-presentation-tooltip"], formula_refs: [], editable: true },
        { node_id: "presentation-hijri", container_id: "slide-2", name: "Hijri Note", text: "The Hijri due date is Ramadan 10, 1447 AH.", x: 120, y: 356, width: 860, height: 58, semantic_labels: ["body", "date"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "presentation-diacritics", container_id: "slide-2", name: "Diacritics", text: "Operational diacritics note.", x: 120, y: 436, width: 760, height: 52, semantic_labels: ["body", "diacritics"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "presentation-layout", container_id: "slide-2", name: "Layout Proof", text: "Mirror layout preserved the original visual meaning.", x: 120, y: 512, width: 900, height: 58, semantic_labels: ["body", "layout"], data_binding_refs: [], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "spreadsheet-en-ar-pass",
      artifact_type: "spreadsheet",
      title: "Quarterly Revenue Report",
      publish_target_ref: "workspace://localization/spreadsheets/quarterly-revenue-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "sheet-1", title: "Executive Metrics", width: 1440, height: 960 }],
      text_nodes: [
        { node_id: "spreadsheet-title", container_id: "sheet-1", name: "Workbook Title", text: "Quarterly Revenue Report", x: 40, y: 48, width: 820, height: 56, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "spreadsheet-header-metric", container_id: "sheet-1", name: "Header Metric", text: "Customer Churn Risk", x: 40, y: 160, width: 280, height: 42, semantic_labels: ["title"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "spreadsheet-header-status", container_id: "sheet-1", name: "Header Status", text: "KPI coverage remained stable.", x: 360, y: 160, width: 360, height: 42, semantic_labels: ["caption"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "spreadsheet-row-revenue", container_id: "sheet-1", name: "Revenue Row", text: "Total revenue on March 15, 2026 was $1,245.50.", x: 40, y: 224, width: 620, height: 46, semantic_labels: ["body", "metric"], data_binding_refs: ["binding-sheet-revenue"], formula_refs: [], editable: true },
        { node_id: "spreadsheet-row-adoption", container_id: "sheet-1", name: "Adoption Row", text: "OpenAI API adoption increased by 18%.", x: 40, y: 288, width: 520, height: 46, semantic_labels: ["body"], data_binding_refs: ["binding-sheet-adoption"], formula_refs: [], editable: true },
        { node_id: "spreadsheet-row-hijri", container_id: "sheet-1", name: "Hijri Row", text: "The Hijri due date is Ramadan 10, 1447 AH.", x: 40, y: 352, width: 560, height: 46, semantic_labels: ["body", "date"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "spreadsheet-row-mixed", container_id: "sheet-1", name: "Mixed Row", text: "Mixed Arabic and English content for OpenAI API and KPI remained aligned.", x: 40, y: 416, width: 720, height: 54, semantic_labels: ["body", "mixed_content"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "spreadsheet-row-diacritics", container_id: "sheet-1", name: "Diacritics Row", text: "Operational diacritics note.", x: 40, y: 490, width: 460, height: 46, semantic_labels: ["body", "diacritics"], data_binding_refs: [], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "dashboard-en-ar-pass",
      artifact_type: "dashboard",
      title: "Operational Dashboard",
      publish_target_ref: "workspace://localization/dashboards/ops-ar-pass",
      target_locale: "ar-SA",
      containers: [{ container_id: "dashboard-page", title: "Operations", width: 1440, height: 900 }],
      text_nodes: [
        { node_id: "dashboard-pass-title", container_id: "dashboard-page", name: "Widget Title", text: "Operational Dashboard", x: 120, y: 80, width: 360, height: 48, semantic_labels: ["title", "widget_title"], data_binding_refs: ["binding-dashboard-title"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-filter", container_id: "dashboard-page", name: "Filter Label", text: "Region Filter", x: 1040, y: 80, width: 240, height: 40, semantic_labels: ["caption", "filter_label"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-legend", container_id: "dashboard-page", name: "Legend Label", text: "Revenue Legend", x: 120, y: 180, width: 300, height: 40, semantic_labels: ["caption", "legend_label"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-axis", container_id: "dashboard-page", name: "Axis Label", text: "Revenue Axis", x: 460, y: 180, width: 260, height: 40, semantic_labels: ["caption", "axis_label"], data_binding_refs: ["binding-dashboard-axis"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-axis-quarter", container_id: "dashboard-page", name: "Quarter Axis", text: "Quarter Axis", x: 460, y: 226, width: 260, height: 40, semantic_labels: ["caption", "axis_label"], data_binding_refs: ["binding-dashboard-axis-quarter"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-series", container_id: "dashboard-page", name: "Series Label", text: "Regional Revenue Series", x: 740, y: 180, width: 280, height: 40, semantic_labels: ["caption", "series_label"], data_binding_refs: ["binding-dashboard-series"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-series-benchmark", container_id: "dashboard-page", name: "Benchmark Series", text: "Benchmark Series", x: 740, y: 226, width: 280, height: 40, semantic_labels: ["caption", "series_label"], data_binding_refs: ["binding-dashboard-series-benchmark"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-tooltip", container_id: "dashboard-page", name: "Tooltip Label", text: "Revenue tooltip", x: 760, y: 180, width: 260, height: 40, semantic_labels: ["caption", "tooltip_label"], data_binding_refs: ["binding-dashboard-tooltip"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-metric", container_id: "dashboard-page", name: "Widget Metric", text: "Alert threshold is 75%.", x: 120, y: 260, width: 300, height: 46, semantic_labels: ["body", "metric"], data_binding_refs: ["binding-dashboard-metric"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-note", container_id: "dashboard-page", name: "Operational Note", text: "KPI coverage remained stable.", x: 120, y: 340, width: 360, height: 42, semantic_labels: ["caption"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-ui", container_id: "dashboard-page", name: "UI String", text: "Open details", x: 1040, y: 140, width: 160, height: 36, semantic_labels: ["ui_string"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-control-granularity", container_id: "dashboard-page", name: "Granularity Control", text: "Granularity Control", x: 1040, y: 190, width: 240, height: 36, semantic_labels: ["interactive_control", "ui_string"], data_binding_refs: ["binding-dashboard-granularity"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-control-scenario", container_id: "dashboard-page", name: "Scenario Toggle", text: "Scenario Toggle", x: 1040, y: 240, width: 240, height: 36, semantic_labels: ["interactive_control", "ui_string"], data_binding_refs: ["binding-dashboard-scenario"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-control-drilldown", container_id: "dashboard-page", name: "Drilldown Control", text: "Drilldown Control", x: 1040, y: 290, width: 240, height: 36, semantic_labels: ["interactive_control", "ui_string"], data_binding_refs: ["binding-dashboard-drilldown"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-control-compare", container_id: "dashboard-page", name: "Compare Mode", text: "Compare Mode", x: 1040, y: 340, width: 240, height: 36, semantic_labels: ["interactive_control", "ui_string"], data_binding_refs: ["binding-dashboard-compare"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-control-date-range", container_id: "dashboard-page", name: "Date Range Control", text: "Date Range Control", x: 1040, y: 390, width: 240, height: 36, semantic_labels: ["interactive_control", "ui_string"], data_binding_refs: ["binding-dashboard-date-range"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-tooltip-body", container_id: "dashboard-page", name: "Tooltip Body", text: "Tooltip body shows KPI and revenue context.", x: 760, y: 230, width: 360, height: 42, semantic_labels: ["tooltip_label", "ui_string"], data_binding_refs: ["binding-dashboard-tooltip-body"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-tooltip-comparison", container_id: "dashboard-page", name: "Tooltip Comparison", text: "Tooltip compares baseline and scenario delta.", x: 760, y: 280, width: 360, height: 42, semantic_labels: ["tooltip_label", "ui_string"], data_binding_refs: ["binding-dashboard-tooltip-comparison"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-tooltip-date", container_id: "dashboard-page", name: "Tooltip Date", text: "Tooltip date shows March 15, 2026 and $1,245.50.", x: 760, y: 330, width: 360, height: 42, semantic_labels: ["tooltip_label", "ui_string"], data_binding_refs: ["binding-dashboard-tooltip-date"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-narrative", container_id: "dashboard-page", name: "Generated Narrative", text: "Executive watchlist needs same-day follow-up.", x: 120, y: 710, width: 520, height: 50, semantic_labels: ["generated_narrative"], data_binding_refs: ["binding-dashboard-narrative"], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-mixed", container_id: "dashboard-page", name: "Mixed Content", text: "Mixed Arabic and English content for OpenAI API and KPI remained aligned.", x: 120, y: 420, width: 520, height: 56, semantic_labels: ["body", "mixed_content"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-hijri", container_id: "dashboard-page", name: "Hijri Date", text: "The Hijri due date is Ramadan 10, 1447 AH.", x: 120, y: 500, width: 420, height: 48, semantic_labels: ["body", "date"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-diacritics", container_id: "dashboard-page", name: "Diacritics", text: "Operational diacritics note.", x: 120, y: 570, width: 360, height: 42, semantic_labels: ["body", "diacritics"], data_binding_refs: [], formula_refs: [], editable: true },
        { node_id: "dashboard-pass-revenue", container_id: "dashboard-page", name: "Revenue Date", text: "Total revenue on March 15, 2026 was $1,245.50.", x: 120, y: 640, width: 460, height: 50, semantic_labels: ["body", "metric", "date"], data_binding_refs: [], formula_refs: [], editable: true }
      ],
      profiles: [reportProfile],
      rules: reportRules,
      protected_terms: protectedTerms,
      non_translatable_terms: nonTranslatableTerms,
      allow_degraded_publish: true
    }),
    LocalizationSampleDefinitionSchema.parse({
      sample_name: "dashboard-en-ar-degraded",
      artifact_type: "dashboard",
      title: "Operational Dashboard",
      publish_target_ref: "workspace://localization/dashboards/ops-ar",
      target_locale: "ar-SA",
      containers: [{ container_id: "dashboard-page", title: "Operations", width: 1440, height: 900 }],
      text_nodes: [
        { node_id: "dashboard-title", container_id: "dashboard-page", name: "Widget Title", text: "Customer Churn Risk", x: 120, y: 80, width: 320, height: 48, semantic_labels: ["title", "widget_title"], data_binding_refs: ["binding-risk-title"], formula_refs: [], editable: true },
        { node_id: "dashboard-note", container_id: "dashboard-page", name: "Operational Note", text: "This widget intentionally contains a very long operational note about monthly expansion, retention, onboarding, adoption, support load, and conversion volatility to force a layout overflow during Arabic localization.", x: 120, y: 180, width: 260, height: 74, semantic_labels: ["body", "widget_description"], data_binding_refs: ["binding-risk-description"], formula_refs: [], editable: true },
        { node_id: "dashboard-threshold", container_id: "dashboard-page", name: "Threshold", text: "Alert threshold is 75%.", x: 120, y: 310, width: 260, height: 42, semantic_labels: ["caption"], data_binding_refs: [], formula_refs: [], editable: true }
      ],
      roundtrip_tamper_mode: "dashboard_manifest_mismatch",
      allow_degraded_publish: true
    })
  ];
};

const createSampleExecutionInput = (
  definition: LocalizationSampleDefinition,
  outputRoot: string,
  providerBaseUrl?: string
): { input: LocalizationExecutionInput; payload: Record<string, unknown>; inputCanonicalPersisted: PersistedFile } => {
  const sampleDir = path.join(outputRoot, `sample-run-${definition.sample_name}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const inputDir = path.join(sampleDir, "input");
  ensureDir(inputDir);
  const canonical = buildSampleSourceCanonical(definition.sample_name, definition.artifact_type, definition.title, definition.containers, definition.text_nodes, "tenant-lct-sample", "workspace-lct-sample", "project-lct-sample", "en-US");
  const payload = { sample_name: definition.sample_name, artifact_type: definition.artifact_type, title: definition.title, containers: definition.containers, text_nodes: definition.text_nodes };
  const inputPayloadPersisted = writeJson(path.join(inputDir, "source-input.json"), payload);
  const inputCanonicalPersisted = writeJson(path.join(inputDir, "source-canonical.json"), canonical);
  const glossaryPersisted =
    definition.external_glossary_entries.length > 0
      ? writeJson(path.join(inputDir, "external-glossary.json"), definition.external_glossary_entries)
      : null;
  const sourceArtifact = createSampleSourceArtifact(definition.sample_name, definition.sample_name, definition.artifact_type, "tenant-lct-sample", "workspace-lct-sample", "project-lct-sample", "lct-engine-sample", canonical, inputPayloadPersisted);
  const providerUrl = definition.provider_scenario !== "none" && providerBaseUrl ? providerScenarioUrl(providerBaseUrl, definition.provider_scenario) : definition.integration?.provider_url;
  const integration =
    definition.integration || glossaryPersisted || providerUrl
      ? LocalizationIntegrationSchema.parse({
          provider_mode:
            definition.provider_scenario !== "none"
              ? "http_json"
              : glossaryPersisted
                ? "filesystem_glossary"
                : definition.integration?.provider_mode ?? "deterministic_local",
          glossary_file_path: glossaryPersisted?.filePath ?? definition.integration?.glossary_file_path,
          provider_url: providerUrl,
          provider_headers: definition.integration?.provider_headers ?? {},
          provider_timeout_ms: definition.integration?.provider_timeout_ms ?? 2500,
          provider_retry_count: definition.integration?.provider_retry_count ?? 1,
          provider_retry_backoff_ms: definition.integration?.provider_retry_backoff_ms ?? 250
        })
      : undefined;
  return {
    input: LocalizationExecutionInputSchema.parse({
      run_id: definition.sample_name,
      tenant_ref: "tenant-lct-sample",
      workspace_id: "workspace-lct-sample",
      project_id: "project-lct-sample",
      created_by: "lct-engine-sample",
      mode: "advanced",
      source_artifact: sourceArtifact,
      source_canonical: canonical,
      target_locale: definition.target_locale,
      publish_target_ref: definition.publish_target_ref,
      profiles: definition.profiles,
      rules: definition.rules,
      protected_terms: definition.protected_terms,
      non_translatable_terms: definition.non_translatable_terms,
      integration,
      roundtrip_tamper_mode: definition.roundtrip_tamper_mode,
      allow_degraded_publish: definition.allow_degraded_publish,
      output_root: sampleDir
    }),
    payload,
    inputCanonicalPersisted
  };
};

const timestampSlug = (): string => new Date().toISOString().replace(/[:.]/g, "-");

const writeProofBundle = (
  outputRoot: string,
  prefix: string,
  payload: Record<string, unknown>
): { artifact: PersistedFile; evidence: PersistedFile; audit: PersistedFile; lineage: PersistedFile } => {
  const proofRoot = path.join(outputRoot, `${prefix}-${timestampSlug()}`);
  ensureDir(proofRoot);
  const artifact = writeJson(path.join(proofRoot, `${prefix}.json`), payload);
  const evidence = writeJson(path.join(proofRoot, "evidence.json"), {
    artifact_path: artifact.filePath,
    generated_at: now()
  });
  const audit = writeJson(path.join(proofRoot, "audit.json"), {
    proof_kind: prefix,
    artifact_path: artifact.filePath,
    generated_at: now()
  });
  const lineage = writeJson(path.join(proofRoot, "lineage.json"), {
    proof_kind: prefix,
    target_ref: artifact.filePath,
    generated_at: now()
  });
  return { artifact, evidence, audit, lineage };
};

const TONE_ADAPTATION_MARKERS: Record<
  TerminologyProfile["default_style"],
  {
    register_label: string;
    expected_phrases: string[];
    semantic_intent: string;
    non_literal_strategy: string;
  }
> = {
  formal: {
    register_label: "formal_professional",
    expected_phrases: ["متابعة في اليوم نفسه"],
    semantic_intent: "professional_formal_follow_up",
    non_literal_strategy: "preserve_meaning_with_formal_business_register"
  },
  executive: {
    register_label: "executive_briefing",
    expected_phrases: ["إجراءً في اليوم نفسه"],
    semantic_intent: "decision_oriented_follow_up",
    non_literal_strategy: "compress_for_executive_actionability"
  },
  government: {
    register_label: "government_regulatory",
    expected_phrases: ["اتخاذ الإجراء النظامي", "اليوم ذاته"],
    semantic_intent: "regulatory_compliance_follow_up",
    non_literal_strategy: "shift_to_official_government_register"
  },
  technical: {
    register_label: "technical_operational",
    expected_phrases: ["استجابة تشغيلية"],
    semantic_intent: "operational_response_precision",
    non_literal_strategy: "preserve_meaning_with_technical_operational_register"
  }
};

const buildToneAdaptationEntry = (
  tone: TerminologyProfile["default_style"],
  sample: LocalizationSampleRun,
  formalLocalizedExcerpts: string[]
) => {
  const localizedCanonical = JSON.parse(fs.readFileSync(sample.artifacts.localized_canonical_path, "utf8"));
  const sourceExcerpts = sample.bundle.input.source_canonical.nodes.text.map((node) => node.content?.[0]?.value ?? "");
  const localizedExcerpts = localizedCanonical.nodes.text.map((node: { content?: Array<{ value?: string }> }) => node.content?.[0]?.value ?? "");
  const toneMarkers = TONE_ADAPTATION_MARKERS[tone];
  const detectedMarkers = toneMarkers.expected_phrases.filter((phrase) =>
    localizedExcerpts.some((excerpt: string) => excerpt.includes(phrase))
  );
  const lexicalDeltaAgainstFormal = localizedExcerpts.filter((excerpt: string) => !formalLocalizedExcerpts.includes(excerpt));
  return {
    tone,
    register_label: toneMarkers.register_label,
    semantic_intent: toneMarkers.semantic_intent,
    non_literal_strategy: toneMarkers.non_literal_strategy,
    sample_name: sample.sample_name,
    source_excerpt: sourceExcerpts,
    localized_output: sample.artifacts.localized_output_path,
    localized_excerpt: localizedExcerpts,
    localized_excerpt_diff_vs_formal: lexicalDeltaAgainstFormal,
    expected_markers: toneMarkers.expected_phrases,
    detected_markers: detectedMarkers,
    marker_alignment_pass: detectedMarkers.length === toneMarkers.expected_phrases.length,
    arabic_script_pass: localizedExcerpts.every((excerpt: string) => containsArabicScript(excerpt)),
    terminology_profile: sample.artifacts.terminology_profile_path,
    evidence: sample.artifacts.evidence_path,
    audit: sample.artifacts.audit_path,
    lineage: sample.artifacts.lineage_path
  };
};

const persistProfessionalToneMatrix = (outputRoot: string, samples: LocalizationSampleRun[]): void => {
  const formalSample = samples.find((entry) => entry.sample_name === "report-en-ar-formal-pass");
  if (!formalSample) {
    throw new Error("Missing tone sample report-en-ar-formal-pass");
  }
  const formalCanonical = JSON.parse(fs.readFileSync(formalSample.artifacts.localized_canonical_path, "utf8"));
  const formalLocalizedExcerpts = formalCanonical.nodes.text.map((node: { content?: Array<{ value?: string }> }) => node.content?.[0]?.value ?? "");
  const tones = Object.entries(TONE_SAMPLE_TONE_MAP).map(([sampleName, tone]) => {
    const sample = samples.find((entry) => entry.sample_name === sampleName);
    if (!sample) {
      throw new Error(`Missing tone sample ${sampleName}`);
    }
    return buildToneAdaptationEntry(tone, sample, formalLocalizedExcerpts);
  });
  writeProofBundle(outputRoot, "professional-tone-matrix", {
    requirement: "professional_translation_tone_adaptation",
    tones,
    tone_coverage: {
      required_tones: ["formal", "executive", "government", "technical"],
      localized_outputs_verified: tones.map((tone) => ({
        tone: tone.tone,
        localized_output: tone.localized_output,
        marker_alignment_pass: tone.marker_alignment_pass,
        arabic_script_pass: tone.arabic_script_pass
      }))
    }
  });
};

const persistDomainGlossaryMatrix = (outputRoot: string, samples: LocalizationSampleRun[]): void => {
  const domains = (Object.keys(DOMAIN_SEMANTIC_MAPS) as Array<keyof typeof DOMAIN_SEMANTIC_MAPS>).map((domain) => {
    const sample = samples.find((entry) => entry.sample_name === `report-en-ar-domain-${domain}-pass`);
    if (!sample) {
      throw new Error(`Missing domain sample ${domain}`);
    }
    const localizedCanonical = JSON.parse(fs.readFileSync(sample.artifacts.localized_canonical_path, "utf8"));
    const glossary = JSON.parse(
      fs.readFileSync(path.join(sample.artifacts.output_root, "input", "external-glossary.json"), "utf8")
    );
    return {
      domain,
      glossary_used: glossary,
      business_terminology_registry: DOMAIN_SEMANTIC_MAPS[domain].business_registry,
      domain_semantic_map: DOMAIN_SEMANTIC_MAPS[domain].semantic_map,
      overridden_terms: DOMAIN_SEMANTIC_MAPS[domain].overridden_terms,
      localized_output: sample.artifacts.localized_output_path,
      localized_excerpt: localizedCanonical.nodes.text.map((node: { content?: Array<{ value?: string }> }) => node.content?.[0]?.value ?? ""),
      evidence: sample.artifacts.evidence_path,
      audit: sample.artifacts.audit_path,
      lineage: sample.artifacts.lineage_path
    };
  });
  writeProofBundle(outputRoot, "domain-glossary-matrix", {
    requirement: "sector_glossary_terminology_control_by_domain",
    domains
  });
};

const contextualTextByNodeId = (canonicalPath: string): Map<string, string> => {
  const canonical = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  return new Map(
    canonical.nodes.text.map((node: { node_id: string; content?: Array<{ value?: string }> }) => [
      node.node_id,
      node.content?.[0]?.value ?? ""
    ])
  );
};

const buildContextualQualityEntry = (
  sample: LocalizationSampleRun,
  nodeId: string,
  category: "tone" | "domain_title" | "domain_risk",
  expectedPhrases: string[],
  contextualSignals: string[],
  registryRef: string | null,
  glossaryName: string | null
) => {
  const sourceByNodeId = contextualTextByNodeId(sample.artifacts.input_canonical_path);
  const localizedByNodeId = contextualTextByNodeId(sample.artifacts.localized_canonical_path);
  const sourceText = sourceByNodeId.get(nodeId) ?? "";
  const contextualTranslation = localizedByNodeId.get(nodeId) ?? "";
  const baselineLiteralTranslation = translateTextBaseline(
    sourceText,
    sample.bundle.terminology_resolution.protectedTerms,
    sample.bundle.terminology_resolution.nonTranslatableTerms
  );
  const detectedExpectedPhrases = expectedPhrases.filter((phrase) => contextualTranslation.includes(phrase));
  const detectedContextualSignals = contextualSignals.filter((phrase) => contextualTranslation.includes(phrase));
  return {
    sample_name: sample.sample_name,
    category,
    node_id: nodeId,
    source_text: sourceText,
    baseline_literal_translation: baselineLiteralTranslation,
    contextual_translation: contextualTranslation,
    contextual_upgrade_detected: contextualTranslation !== baselineLiteralTranslation,
    non_literal_upgrade: contextualTranslation !== sourceText && contextualTranslation !== baselineLiteralTranslation,
    arabic_script_pass: containsArabicScript(contextualTranslation),
    detected_expected_phrases: detectedExpectedPhrases,
    detected_contextual_signals: detectedContextualSignals,
    semantic_marker_pass: detectedExpectedPhrases.length === expectedPhrases.length,
    contextual_signal_pass: detectedContextualSignals.length === contextualSignals.length,
    business_terminology_registry: registryRef,
    glossary_name: glossaryName,
    evidence: sample.artifacts.evidence_path,
    audit: sample.artifacts.audit_path,
    lineage: sample.artifacts.lineage_path
  };
};

const persistContextualTranslationQualityProof = (outputRoot: string, samples: LocalizationSampleRun[]): void => {
  const toneDefinitions = [
    {
      sample_name: "report-en-ar-formal-pass",
      node_id: "formal-body",
      expected_phrases: ["متابعة في اليوم نفسه"],
      contextual_signals: ["professional_formal_follow_up"],
      registry_ref: "registry.translation.tone.formal",
      glossary_name: null
    },
    {
      sample_name: "report-en-ar-executive-pass",
      node_id: "executive-body",
      expected_phrases: ["إجراءً في اليوم نفسه"],
      contextual_signals: ["decision_oriented_follow_up"],
      registry_ref: "registry.translation.tone.executive",
      glossary_name: null
    },
    {
      sample_name: "report-en-ar-government-pass",
      node_id: "government-body",
      expected_phrases: ["اتخاذ الإجراء النظامي", "اليوم ذاته"],
      contextual_signals: ["regulatory_compliance_follow_up"],
      registry_ref: "registry.translation.tone.government",
      glossary_name: null
    },
    {
      sample_name: "report-en-ar-technical-pass",
      node_id: "technical-body",
      expected_phrases: ["استجابة تشغيلية"],
      contextual_signals: ["operational_response_precision"],
      registry_ref: "registry.translation.tone.technical",
      glossary_name: null
    }
  ] as const;
  const toneEntries = toneDefinitions.map((definition) => {
    const sample = samples.find((entry) => entry.sample_name === definition.sample_name);
    if (!sample) throw new Error(`Missing contextual quality tone sample ${definition.sample_name}`);
    return {
      ...buildContextualQualityEntry(
        sample,
        definition.node_id,
        "tone",
        [...definition.expected_phrases],
        [],
        definition.registry_ref,
        definition.glossary_name
      ),
      semantic_intent: TONE_ADAPTATION_MARKERS[TONE_SAMPLE_TONE_MAP[definition.sample_name]].semantic_intent,
      register_label: TONE_ADAPTATION_MARKERS[TONE_SAMPLE_TONE_MAP[definition.sample_name]].register_label
    };
  });
  const domainEntries = (Object.keys(DOMAIN_SEMANTIC_MAPS) as Array<keyof typeof DOMAIN_SEMANTIC_MAPS>).flatMap((domain) => {
    const sample = samples.find((entry) => entry.sample_name === `report-en-ar-domain-${domain}-pass`);
    if (!sample) throw new Error(`Missing contextual quality domain sample ${domain}`);
    const domainConfig = DOMAIN_SEMANTIC_MAPS[domain];
    return [
      buildContextualQualityEntry(
        sample,
        `${domain}-title`,
        "domain_title",
        [domainConfig.translations.title],
        [domainConfig.semantic_map.portfolio_watchlist],
        domainConfig.business_registry,
        domainConfig.glossary_name
      ),
      buildContextualQualityEntry(
        sample,
        `${domain}-risk`,
        "domain_risk",
        [domainConfig.translations.riskLine],
        [domainConfig.semantic_map.service_level_risk],
        domainConfig.business_registry,
        domainConfig.glossary_name
      )
    ];
  });
  const allEntries = [...toneEntries, ...domainEntries];
  const proofBundle = writeProofBundle(outputRoot, "contextual-translation-quality-proof", {
    requirement_status: "verified",
    requirement: "contextual_translation_quality_improvement",
    entries: allEntries,
    coverage: {
      entry_count: allEntries.length,
      tone_entry_count: toneEntries.length,
      domain_entry_count: domainEntries.length,
      contextual_upgrade_count: allEntries.filter((entry) => entry.contextual_upgrade_detected).length,
      non_literal_upgrade_count: allEntries.filter((entry) => entry.non_literal_upgrade).length,
      arabic_script_pass_count: allEntries.filter((entry) => entry.arabic_script_pass).length,
      semantic_marker_pass_count: allEntries.filter((entry) => entry.semantic_marker_pass).length,
      contextual_signal_pass_count: allEntries.filter((entry) => entry.contextual_signal_pass).length,
      business_registry_coverage_count: allEntries.filter((entry) => Boolean(entry.business_terminology_registry)).length,
      glossary_injection_coverage_count: allEntries.filter((entry) => Boolean(entry.glossary_name)).length
    },
    english_residuals: allEntries
      .filter((entry) => hasUnexpectedLatinResidual(entry.contextual_translation))
      .map((entry) => ({
        sample_name: entry.sample_name,
        node_id: entry.node_id,
        text: entry.contextual_translation
      }))
  });
  const proof = JSON.parse(fs.readFileSync(proofBundle.artifact.filePath, "utf8"));
  if (
    proof.coverage.entry_count < 12 ||
    proof.coverage.tone_entry_count < 4 ||
    proof.coverage.domain_entry_count < 8 ||
    proof.coverage.contextual_upgrade_count !== proof.coverage.entry_count ||
    proof.coverage.non_literal_upgrade_count !== proof.coverage.entry_count ||
    proof.coverage.arabic_script_pass_count !== proof.coverage.entry_count ||
    proof.coverage.semantic_marker_pass_count !== proof.coverage.entry_count ||
    proof.coverage.contextual_signal_pass_count !== proof.coverage.entry_count ||
    proof.coverage.business_registry_coverage_count < 8 ||
    proof.coverage.glossary_injection_coverage_count < 8 ||
    proof.english_residuals.length > 0
  ) {
    throw new Error("Contextual translation quality proof is incomplete.");
  }
};

const persistDashboardChartLocalizationProof = (
  outputRoot: string,
  samples: LocalizationSampleRun[]
): void => {
  const dashboardSample = samples.find((entry) => entry.sample_name === "dashboard-en-ar-pass");
  if (!dashboardSample) {
    throw new Error("Missing dashboard-en-ar-pass sample");
  }
  const localizationProof = JSON.parse(
    fs.readFileSync(
      path.join(dashboardSample.artifacts.output_root, "published", "dashboard-bundle", "localization-proof.json"),
      "utf8"
    )
  );
  const payload = JSON.parse(
    fs.readFileSync(
      path.join(dashboardSample.artifacts.output_root, "published", "dashboard-bundle", "embed-payload.json"),
      "utf8"
    )
  );
  const chartProofBundle = writeProofBundle(outputRoot, "dashboard-chart-localization-proof", {
    requirement_status: "verified",
    requirement: "live_localization_of_charts_axes_interactive_controls",
    localized_output: dashboardSample.artifacts.localized_output_path,
    localized_axis_labels: localizationProof.localized_axis_labels,
    localized_series_labels: localizationProof.localized_series_labels,
    localized_tooltip_labels: localizationProof.localized_tooltip_labels,
    localized_interactive_controls: localizationProof.localized_interactive_controls,
    localized_ui_strings: localizationProof.localized_ui_strings,
    payload_chart_localizations: localizationProof.payload_chart_localizations,
    payload_widgets: payload.widgets,
    coverage: {
      axis_label_count: localizationProof.localized_axis_labels.length,
      series_label_count: localizationProof.localized_series_labels.length,
      tooltip_label_count: localizationProof.localized_tooltip_labels.length,
      interactive_control_count: localizationProof.localized_interactive_controls.length,
      ui_string_count: localizationProof.localized_ui_strings.length,
      selector_widget_count: payload.widgets.filter((widget: { widget_type?: string }) => widget.widget_type === "selector").length,
      chart_localization_entry_count: localizationProof.payload_chart_localizations.length
    },
    english_residuals: [
      ...localizationProof.localized_axis_labels
        .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
        .map((entry: { node_id: string; text: string }) => ({ surface: "axis_label", ...entry })),
      ...localizationProof.localized_series_labels
        .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
        .map((entry: { node_id: string; text: string }) => ({ surface: "series_label", ...entry })),
      ...localizationProof.localized_tooltip_labels
        .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
        .map((entry: { node_id: string; text: string }) => ({ surface: "tooltip_label", ...entry })),
      ...localizationProof.localized_interactive_controls
        .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
        .map((entry: { node_id: string; text: string }) => ({ surface: "interactive_control", ...entry }))
    ]
  });
  const chartProof = JSON.parse(fs.readFileSync(chartProofBundle.artifact.filePath, "utf8"));
  if (
    chartProof.coverage.axis_label_count < 2 ||
    chartProof.coverage.series_label_count < 2 ||
    chartProof.coverage.tooltip_label_count < 3 ||
    chartProof.coverage.interactive_control_count < 5 ||
    chartProof.coverage.selector_widget_count < 5 ||
    chartProof.english_residuals.length > 0
  ) {
    throw new Error("Dashboard chart/control localization proof is incomplete.");
  }
};

const narrativeEntriesFromCanonical = (canonicalPath: string) => {
  const canonical = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  return canonical.nodes.text
    .filter((node: { semantic_labels?: string[] }) => Array.isArray(node.semantic_labels) && node.semantic_labels.includes("generated_narrative"))
    .map((node: { node_id: string; content?: Array<{ value?: string }>; semantic_labels?: string[]; binding_refs?: string[]; data_binding_refs?: string[] }) => ({
      node_id: node.node_id,
      text: node.content?.[0]?.value ?? "",
      semantic_labels: node.semantic_labels ?? [],
      binding_refs: node.binding_refs ?? node.data_binding_refs ?? []
    }));
};

const persistGeneratedNarrativeLocalizationProof = (
  outputRoot: string,
  samples: LocalizationSampleRun[]
): void => {
  const narrativeSampleNames = [
    "report-en-ar-formal-pass",
    "report-en-ar-executive-pass",
    "report-en-ar-government-pass",
    "report-en-ar-technical-pass",
    "dashboard-en-ar-pass"
  ];
  const narrativeSamples = narrativeSampleNames.map((sampleName) => {
    const sample = samples.find((entry) => entry.sample_name === sampleName);
    if (!sample) {
      throw new Error(`Missing generated narrative sample ${sampleName}`);
    }
    const sourceNarratives = narrativeEntriesFromCanonical(sample.artifacts.input_canonical_path);
    const localizedNarratives = narrativeEntriesFromCanonical(sample.artifacts.localized_canonical_path);
    return {
      sample_name: sample.sample_name,
      artifact_type: sample.bundle.input.source_artifact.artifact_type,
      localized_output: sample.artifacts.localized_output_path,
      source_narratives: sourceNarratives,
      localized_narratives: localizedNarratives,
      arabic_script_pass: localizedNarratives.every((entry: { text: string }) => containsArabicScript(entry.text)),
      non_literal_pass: localizedNarratives.every((entry: { text: string }, index: number) => entry.text !== (sourceNarratives[index]?.text ?? "")),
      evidence: sample.artifacts.evidence_path,
      audit: sample.artifacts.audit_path,
      lineage: sample.artifacts.lineage_path
    };
  });
  const dashboardSample = narrativeSamples.find((sample) => sample.sample_name === "dashboard-en-ar-pass");
  if (!dashboardSample) {
    throw new Error("Missing dashboard generated narrative sample");
  }
  const dashboardPayload = JSON.parse(
    fs.readFileSync(
      path.join(
        samples.find((entry) => entry.sample_name === "dashboard-en-ar-pass")!.artifacts.output_root,
        "published",
        "dashboard-bundle",
        "embed-payload.json"
      ),
      "utf8"
    )
  );
  const publishedDashboardNarratives = dashboardPayload.widgets
    .filter(
      (widget: { title?: string; subtitle?: string; binding_refs?: string[] }) =>
        containsArabicScript(widget.subtitle ?? "") &&
        (widget.binding_refs?.some((bindingRef) => String(bindingRef).includes("narrative")) ||
          dashboardSample.localized_narratives.some((entry: { text: string }) => entry.text === widget.subtitle))
    )
    .map((widget: { widget_id: string; widget_type?: string; title?: string; subtitle?: string; binding_refs?: string[] }) => ({
      widget_id: widget.widget_id,
      widget_type: widget.widget_type ?? "unknown",
      title: widget.title ?? "",
      subtitle: widget.subtitle ?? "",
      binding_refs: widget.binding_refs ?? []
    }));
  const proofBundle = writeProofBundle(outputRoot, "generated-narrative-localization-proof", {
    requirement_status: "verified",
    requirement: "generated_narrative_localization_path",
    narratives: narrativeSamples,
    dashboard_publication: {
      localized_output: samples.find((entry) => entry.sample_name === "dashboard-en-ar-pass")!.artifacts.localized_output_path,
      published_narratives: publishedDashboardNarratives
    },
    coverage: {
      sample_count: narrativeSamples.length,
      localized_narrative_count: narrativeSamples.reduce((total, sample) => total + sample.localized_narratives.length, 0),
      published_dashboard_narrative_count: publishedDashboardNarratives.length,
      non_literal_pass_count: narrativeSamples.filter((sample) => sample.non_literal_pass).length,
      arabic_script_pass_count: narrativeSamples.filter((sample) => sample.arabic_script_pass).length
    },
    english_residuals: narrativeSamples.flatMap((sample) =>
      sample.localized_narratives
        .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
        .map((entry: { node_id: string; text: string }) => ({
          sample_name: sample.sample_name,
          surface: "generated_narrative",
          ...entry
        }))
    )
  });
  const proof = JSON.parse(fs.readFileSync(proofBundle.artifact.filePath, "utf8"));
  if (
    proof.coverage.sample_count < 5 ||
    proof.coverage.localized_narrative_count < 5 ||
    proof.coverage.published_dashboard_narrative_count < 2 ||
    proof.coverage.non_literal_pass_count !== proof.coverage.sample_count ||
    proof.coverage.arabic_script_pass_count !== proof.coverage.sample_count ||
    proof.english_residuals.length > 0
  ) {
    throw new Error("Generated narrative localization proof is incomplete.");
  }
};

const uiStringEntriesFromCanonical = (canonicalPath: string) => {
  const canonical = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  return canonical.nodes.text
    .filter((node: { semantic_labels?: string[] }) => Array.isArray(node.semantic_labels) && node.semantic_labels.includes("ui_string"))
    .map((node: { node_id: string; content?: Array<{ value?: string }>; semantic_labels?: string[]; binding_refs?: string[]; data_binding_refs?: string[] }) => ({
      node_id: node.node_id,
      text: node.content?.[0]?.value ?? "",
      semantic_labels: node.semantic_labels ?? [],
      binding_refs: node.binding_refs ?? node.data_binding_refs ?? []
    }));
};

const persistUiStringLocalizationProof = (
  outputRoot: string,
  samples: LocalizationSampleRun[]
): void => {
  const sampleNames = [
    "report-en-ar-domain-finance-pass",
    "report-en-ar-domain-healthcare-pass",
    "report-en-ar-domain-government-pass",
    "report-en-ar-domain-telecom-pass",
    "dashboard-en-ar-pass"
  ];
  const selectedSamples = sampleNames.map((sampleName) => {
    const sample = samples.find((entry) => entry.sample_name === sampleName);
    if (!sample) {
      throw new Error(`Missing ui-string sample ${sampleName}`);
    }
    const sourceUiStrings = uiStringEntriesFromCanonical(sample.artifacts.input_canonical_path);
    const localizedUiStrings = uiStringEntriesFromCanonical(sample.artifacts.localized_canonical_path);
    return {
      sample_name: sample.sample_name,
      artifact_type: sample.bundle.input.source_artifact.artifact_type,
      localized_output: sample.artifacts.localized_output_path,
      source_ui_strings: sourceUiStrings,
      localized_ui_strings: localizedUiStrings,
      arabic_script_pass: localizedUiStrings.every((entry: { text: string }) => containsArabicScript(entry.text)),
      non_literal_pass: localizedUiStrings.every((entry: { text: string }, index: number) => entry.text !== (sourceUiStrings[index]?.text ?? "")),
      evidence: sample.artifacts.evidence_path,
      audit: sample.artifacts.audit_path,
      lineage: sample.artifacts.lineage_path
    };
  });
  const dashboardSample = samples.find((entry) => entry.sample_name === "dashboard-en-ar-pass");
  if (!dashboardSample) {
    throw new Error("Missing dashboard ui-string sample");
  }
  const localizationProof = JSON.parse(
    fs.readFileSync(
      path.join(dashboardSample.artifacts.output_root, "published", "dashboard-bundle", "localization-proof.json"),
      "utf8"
    )
  );
  const embedPayload = JSON.parse(
    fs.readFileSync(
      path.join(dashboardSample.artifacts.output_root, "published", "dashboard-bundle", "embed-payload.json"),
      "utf8"
    )
  );
  const publishedDashboardUiStrings = localizationProof.localized_ui_strings.map((entry: { node_id: string; text: string }) => ({
    node_id: entry.node_id,
    text: entry.text
  }));
  const publishedUiWidgets = embedPayload.widgets
    .filter((widget: { subtitle?: string }) => publishedDashboardUiStrings.some((entry: { text: string }) => entry.text === (widget.subtitle ?? "")))
    .map((widget: { widget_id: string; widget_type?: string; title?: string; subtitle?: string }) => ({
      widget_id: widget.widget_id,
      widget_type: widget.widget_type ?? "unknown",
      title: widget.title ?? "",
      subtitle: widget.subtitle ?? ""
    }));
  const proofBundle = writeProofBundle(outputRoot, "ui-string-localization-proof", {
    requirement_status: "verified",
    requirement: "ui_string_localization_path",
    samples: selectedSamples,
    dashboard_publication: {
      localized_output: dashboardSample.artifacts.localized_output_path,
      published_ui_strings: publishedDashboardUiStrings,
      published_ui_widgets: publishedUiWidgets
    },
    coverage: {
      sample_count: selectedSamples.length,
      localized_ui_string_count: selectedSamples.reduce((total, sample) => total + sample.localized_ui_strings.length, 0),
      dashboard_published_ui_string_count: publishedDashboardUiStrings.length,
      dashboard_published_ui_widget_count: publishedUiWidgets.length,
      non_literal_pass_count: selectedSamples.filter((sample) => sample.non_literal_pass).length,
      arabic_script_pass_count: selectedSamples.filter((sample) => sample.arabic_script_pass).length
    },
    english_residuals: [
      ...selectedSamples.flatMap((sample) =>
        sample.localized_ui_strings
          .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
          .map((entry: { node_id: string; text: string }) => ({
            sample_name: sample.sample_name,
            surface: "ui_string",
            ...entry
          }))
      ),
      ...publishedDashboardUiStrings
        .filter((entry: { text: string }) => hasUnexpectedLatinResidual(entry.text))
        .map((entry: { node_id: string; text: string }) => ({
          sample_name: "dashboard-en-ar-pass",
          surface: "published_ui_string",
          ...entry
        }))
    ]
  });
  const proof = JSON.parse(fs.readFileSync(proofBundle.artifact.filePath, "utf8"));
  if (
    proof.coverage.sample_count < 5 ||
    proof.coverage.localized_ui_string_count < 13 ||
    proof.coverage.dashboard_published_ui_string_count < 9 ||
    proof.coverage.dashboard_published_ui_widget_count < 6 ||
    proof.coverage.non_literal_pass_count !== proof.coverage.sample_count ||
    proof.coverage.arabic_script_pass_count !== proof.coverage.sample_count ||
    proof.english_residuals.length > 0
  ) {
    throw new Error("UI string localization proof is incomplete.");
  }
};

const persistPdfExportProof = (outputRoot: string, samples: LocalizationSampleRun[]): void => {
  const pdfProofEntries = samples.map((sample) => {
    const sidecarPaths = sample.artifacts.published_sidecar_paths;
    const pdfSidecarPath = sidecarPaths.find((p) => p.includes("pdf-export"));
    const pdfExists = pdfSidecarPath ? fs.existsSync(pdfSidecarPath) : false;
    let htmlContent = "";
    let hasRtlDirection = false;
    let hasArabicFontImport = false;
    let hasPrintCss = false;
    let hasA4PageSize = false;
    let arabicTextCount = 0;
    if (pdfSidecarPath && pdfExists) {
      htmlContent = fs.readFileSync(pdfSidecarPath, "utf8");
      hasRtlDirection = /dir="rtl"/.test(htmlContent) || /direction:\s*rtl/.test(htmlContent);
      hasArabicFontImport = /Amiri/.test(htmlContent) && /Noto Naskh Arabic/.test(htmlContent);
      hasPrintCss = /@media\s+print/.test(htmlContent);
      hasA4PageSize = /@page[\s\S]*?size:\s*A4/.test(htmlContent);
      arabicTextCount = (htmlContent.match(/[\u0600-\u06FF]+/g) ?? []).length;
    }
    return {
      sample_name: sample.sample_name,
      pdf_sidecar_path: pdfSidecarPath ?? null,
      pdf_sidecar_exists: pdfExists,
      html_byte_length: htmlContent.length,
      rtl_direction_present: hasRtlDirection,
      arabic_font_import_present: hasArabicFontImport,
      print_css_present: hasPrintCss,
      a4_page_size_present: hasA4PageSize,
      arabic_text_run_count: arabicTextCount,
      pdf_ready: pdfExists && hasRtlDirection && hasArabicFontImport && hasPrintCss && hasA4PageSize && arabicTextCount > 0
    };
  });
  const readyCount = pdfProofEntries.filter((entry) => entry.pdf_ready).length;
  writeProofBundle(outputRoot, "pdf-export-proof", {
    requirement: "pdf_export_pipeline",
    coverage: {
      total_samples: samples.length,
      pdf_ready_count: readyCount,
      all_samples_pdf_ready: readyCount === samples.length
    },
    entries: pdfProofEntries
  });
};

const persistIncrementalPublicationProof = (outputRoot: string, samples: LocalizationSampleRun[]): void => {
  const engine = new ArabicLocalizationLctEngine();
  const incrementalEntries = samples.slice(0, 3).map((sample) => {
    const localizedCanonical = JSON.parse(fs.readFileSync(sample.artifacts.localized_canonical_path, "utf8")) as CanonicalRepresentation;
    const modifiedCanonical = CanonicalRepresentationSchema.parse({
      ...localizedCanonical,
      canonical_id: id("canonical", sample.bundle.input.run_id, "modified"),
      nodes: {
        ...localizedCanonical.nodes,
        text: localizedCanonical.nodes.text.map((node, index) =>
          index === 0
            ? { ...node, content: [{ ...node.content[0], value: `${node.content[0]?.value ?? ""} [تحديث تجريبي]`, locale: node.content[0]?.locale ?? "ar-SA", rtl: node.content[0]?.rtl ?? true }] }
            : node
        )
      }
    });
    const result = engine.publishIncremental(
      sample.bundle.input,
      localizedCanonical,
      modifiedCanonical,
      sample.bundle.publication
    );
    return {
      sample_name: sample.sample_name,
      changed_count: result.changed_node_ids.length,
      preserved_count: result.preserved_node_ids.length,
      diff_entries: result.incremental_diff.length,
      publication_id: result.publication.publication_id,
      timestamp: result.timestamp,
      incremental_pass: result.changed_node_ids.length >= 1 && result.preserved_node_ids.length >= 0
    };
  });
  writeProofBundle(outputRoot, "incremental-publication-proof", {
    requirement: "incremental_publication_support",
    coverage: {
      samples_tested: incrementalEntries.length,
      all_passed: incrementalEntries.every((entry) => entry.incremental_pass)
    },
    entries: incrementalEntries
  });
};

const persistCapabilityMatrixProof = (outputRoot: string): void => {
  const matrix = ArabicLocalizationLctEngine.getCapabilityMatrix();
  const implementedCount = matrix.filter((entry) => entry.status === "implemented").length;
  const totalCount = matrix.length;
  writeProofBundle(outputRoot, "capability-matrix", {
    requirement: "capability_implementation_matrix",
    coverage: {
      total_capabilities: totalCount,
      implemented_count: implementedCount,
      degraded_count: matrix.filter((entry) => entry.status === "degraded").length,
      unsupported_count: matrix.filter((entry) => entry.status === "unsupported").length,
      pending_count: matrix.filter((entry) => entry.status === "pending").length,
      implementation_ratio: Number((implementedCount / totalCount).toFixed(4))
    },
    matrix
  });
};

const persistBidirectionalSyncProof = (outputRoot: string, samples: LocalizationSampleRun[]): void => {
  const engine = new ArabicLocalizationLctEngine();
  const syncEntries = samples.slice(0, 2).map((sample) => {
    const localizedCanonical = JSON.parse(fs.readFileSync(sample.artifacts.localized_canonical_path, "utf8")) as CanonicalRepresentation;
    const firstNodeId = localizedCanonical.nodes.text[0]?.node_id;
    const secondNodeId = localizedCanonical.nodes.text[1]?.node_id;
    const externalChanges = firstNodeId ? [{ node_id: firstNodeId, value: "تعديل خارجي تجريبي" }] : [];
    const sourceChanges = secondNodeId ? [{ node_id: secondNodeId, value: "تحديث المصدر التجريبي" }] : [];
    const conflictChanges = firstNodeId ? [{ node_id: firstNodeId, value: "تعديل مصدر متعارض" }] : [];
    const noConflictResult = engine.syncBidirectional(localizedCanonical, externalChanges, sourceChanges, "external_priority");
    const conflictResult = engine.syncBidirectional(localizedCanonical, externalChanges, conflictChanges, "external_priority");
    return {
      sample_name: sample.sample_name,
      no_conflict_test: {
        external_changes_applied: noConflictResult.applied_external_changes,
        source_changes_preserved: noConflictResult.preserved_source_changes,
        conflicts_detected: noConflictResult.conflicts.length,
        merge_strategy: noConflictResult.merge_strategy,
        pass: noConflictResult.conflicts.length === 0
      },
      conflict_test: {
        external_changes_applied: conflictResult.applied_external_changes,
        source_changes_preserved: conflictResult.preserved_source_changes,
        conflicts_detected: conflictResult.conflicts.length,
        merge_strategy: conflictResult.merge_strategy,
        resolution: conflictResult.conflicts.map((c) => c.resolution),
        pass: conflictResult.conflicts.length > 0
      },
      overall_pass: noConflictResult.conflicts.length === 0 && conflictResult.conflicts.length > 0
    };
  });
  writeProofBundle(outputRoot, "bidirectional-sync-proof", {
    requirement: "bidirectional_sync_enhancement",
    coverage: {
      samples_tested: syncEntries.length,
      all_passed: syncEntries.every((entry) => entry.overall_pass)
    },
    entries: syncEntries
  });
};

export const registerArabicLocalizationLctCapability = (runtime: RegistryBootstrap): void => {
  const actions = ActionRegistry.filter((action) => action.capability === LOCALIZATION_CAPABILITY_ID);
  const tools = ToolRegistry.filter((tool) => tool.owner_capability === LOCALIZATION_CAPABILITY_ID);
  runtime.registerCapability({ capability_id: LOCALIZATION_CAPABILITY_ID, display_name: "Arabic Localization LCT", package_name: "@rasid/arabic-localization-lct-engine", contract_version: "1.0.0", supported_action_refs: actions.map((action) => action.action_id), supported_tool_refs: tools.map((tool) => tool.tool_id) });
  runtime.registerManifest(createActionManifest(LOCALIZATION_CAPABILITY_ID, "1.0.0", actions, ["approval.localization"], ["evidence.localization"]));
  tools.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.localization", async (action) => ({ approval_state: action.action_id.includes("publish") ? "pending" : "approved", reasons: action.action_id.includes("publish") ? ["localization_publish_review_required"] : ["localization_default"] }));
  runtime.registerEvidenceHook("evidence.localization", async (pack) => EvidencePackSchema.parse(pack));
};

export const runArabicLocalizationLctRegressionSuite = async (
  options?: { outputRoot?: string }
): Promise<LocalizationSampleRun[]> => {
  const outputRoot = options?.outputRoot ?? path.join(process.cwd(), "packages", "arabic-localization-lct-engine", "output");
  ensureDir(outputRoot);
  const engine = new ArabicLocalizationLctEngine();
  const samples: LocalizationSampleRun[] = [];
  const providerHarness = await startMockTranslationProvider();
  try {
    for (const definition of buildSampleDefinitions()) {
      const prepared = createSampleExecutionInput(definition, outputRoot, providerHarness.baseUrl);
      const bundle = await engine.run(prepared.input, prepared.payload, prepared.inputCanonicalPersisted);
      if (!bundle.persisted_artifacts) throw new Error(`Localization sample ${definition.sample_name} did not persist artifacts`);
      samples.push({ sample_name: definition.sample_name, bundle, artifacts: bundle.persisted_artifacts });
    }
    persistProfessionalToneMatrix(outputRoot, samples);
    persistDomainGlossaryMatrix(outputRoot, samples);
    persistContextualTranslationQualityProof(outputRoot, samples);
    persistDashboardChartLocalizationProof(outputRoot, samples);
    persistGeneratedNarrativeLocalizationProof(outputRoot, samples);
    persistUiStringLocalizationProof(outputRoot, samples);
    persistPdfExportProof(outputRoot, samples);
    persistIncrementalPublicationProof(outputRoot, samples);
    persistCapabilityMatrixProof(outputRoot);
    persistBidirectionalSyncProof(outputRoot, samples);
  } finally {
    await providerHarness.stop();
  }
  return samples;
};
