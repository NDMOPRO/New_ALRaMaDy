import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  ActionRegistry,
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  EvidencePackSchema,
  JobSchema,
  LibraryAssetSchema,
  ToolRegistry,
  TRANSCRIPTION_CAPABILITY_ID,
  TRANSCRIPTION_CONTRACT,
  TRANSCRIPTION_SCHEMA_NAMESPACE,
  TRANSCRIPTION_SCHEMA_VERSION,
  TranscriptionCompareResultSchema,
  TranscriptionJobRequestSchema,
  TranscriptionQuestionAnswerSchema,
  TranscriptionQuestionRequestSchema,
  UnifiedContentBundleSchema,
  contractEnvelope,
  type AuditEvent,
  type CanonicalRepresentation,
  type EvidencePack,
  type Job,
  type LineageEdge,
  type Summary,
  type TranscriptionJobRequest,
  type TranscriptionQuestionAnswer,
  type TranscriptionQuestionRequest,
  type UnifiedContentBundle
} from "@rasid/contracts";
import { z } from "zod";
import {
  TranscriptionExtractionStore,
  defaultTranscriptionStorageRoot,
  type StoredCompareResult,
  type StoredWorkflowResult
} from "./store";

export { TranscriptionExtractionStore, defaultTranscriptionStorageRoot } from "./store";

const CompareRequestSchema = z.object({
  left_bundle_ref: z.string(),
  right_bundle_ref: z.string(),
  actor_ref: z.string(),
  workspace_id: z.string(),
  tenant_ref: z.string(),
  storage_dir: z.string().optional()
});

const TranscriptionDispatchRequestSchema = z.object({
  action_id: z.string(),
  payload: z.unknown(),
  storage_dir: z.string().optional()
});

const TranscriptionToolDispatchRequestSchema = z.object({
  tool_id: z.string(),
  payload: z.unknown(),
  storage_dir: z.string().optional()
});

type CompareRequest = z.infer<typeof CompareRequestSchema>;
type BridgeResponse = {
  status: "success" | "failed";
  file_name: string;
  input_path: string;
  input_kind: string;
  full_text?: string;
  normalized_text?: string;
  detected_language?: string;
  duration_ms?: number | null;
  page_count?: number | null;
  sections?: Array<Record<string, unknown>>;
  segments?: Array<Record<string, unknown>>;
  tables?: Array<Record<string, unknown>>;
  speakers?: Array<Record<string, unknown>>;
  word_timestamps?: Array<Record<string, unknown>>;
  alignment_pass?: boolean;
  alignment?: Record<string, unknown>;
  on_screen_text?: Array<Record<string, unknown>>;
  subtitle_detection?: Record<string, unknown>;
  disagreements?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  warning_codes?: string[];
  error?: { type: string; message: string };
};

export type TranscriptionEngineOptions = {
  storageDir?: string;
  pythonExecutable?: string;
};

export type TranscriptionWorkflowResult = StoredWorkflowResult;
export type TranscriptionCompareBundle = StoredCompareResult;

const now = () => new Date().toISOString();
const id = (prefix: string, ...parts: Array<string | number | null | undefined>) =>
  [prefix, ...parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

const guessMediaType = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();
  if ([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"].includes(extension)) return "audio/*";
  if ([".mp4", ".mov", ".avi", ".webm", ".mkv"].includes(extension)) return "video/*";
  if (extension === ".pdf") return "application/pdf";
  if ([".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"].includes(extension)) return "image/*";
  if ([".xlsx", ".xlsm"].includes(extension)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".csv") return "text/csv";
  return "application/octet-stream";
};

const detectInputKind = (fileName: string): TranscriptionJobRequest["attachments"][number]["input_kind"] => {
  const extension = path.extname(fileName).toLowerCase();
  const lowerName = fileName.toLowerCase();
  if ([".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"].includes(extension)) return "audio_file";
  if ([".mp4", ".mov", ".avi", ".webm", ".mkv"].includes(extension)) return "video_file";
  if (extension === ".pdf") return lowerName.includes("scan") ? "scanned_document" : "pdf";
  if ([".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"].includes(extension)) {
    if (lowerName.includes("table") || lowerName.includes("grid") || lowerName.includes("sheet")) return "image_table";
    return "image_text";
  }
  if ([".xlsx", ".xlsm", ".csv"].includes(extension)) return "spreadsheet_file";
  return "mixed_attachment";
};

const normalizeText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const detectLanguage = (value: string): string => (/[\u0600-\u06FF]/.test(value) ? "ar" : "en");

const sentenceScore = (sentence: string): number => {
  let score = 0;
  if (/\d/.test(sentence)) score += 2;
  if (/(must|should|need|required|action|deadline|meeting|risk|issue|invoice|total|summary|يجب|مطلوب|إجراء)/i.test(sentence)) score += 3;
  if (sentence.length > 40) score += 1;
  return score;
};

const resolvePythonExecutable = (): string => {
  const candidate = path.resolve(process.cwd(), "..", ".venv311-strict", "Scripts", "python.exe");
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return "python";
};

const bridgeScriptPath = (): string =>
  path.resolve(process.cwd(), "packages", "transcription-extraction-engine", "tools", "content_bridge.py");

const bridgeRequestPath = (root: string, name: string) => path.join(root, `${name}.request.json`);
const bridgeOutputPath = (root: string, name: string) => path.join(root, `${name}.output.json`);

const namedValueMatches = (text: string): Array<{ name: string; value: string }> => {
  const matches: Array<{ name: string; value: string }> = [];
  const regex = /^([^\n:]{2,60}):\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ name: normalizeText(match[1]), value: normalizeText(match[2]) });
  }
  return matches;
};

const extractDates = (text: string): string[] => {
  const patterns = [/\b\d{4}-\d{2}-\d{2}\b/g, /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g];
  return [...new Set(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])))];
};

const extractAmounts = (text: string): string[] =>
  [...new Set([...text.matchAll(/(?:SAR|USD|EUR|\$|€|£)?\s?\d[\d,]*(?:\.\d+)?/g)].map((match) => match[0].trim()).filter((value) => /\d/.test(value)))];

const extractProperEntities = (text: string): string[] =>
  [
    ...new Set(
      [...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g)]
        .map((match) => match[0].trim())
        .filter((value) => value.length > 2)
    )
  ];

const inferClassification = (inputKind: string, text: string, tables: number): string => {
  if (inputKind === "audio_file" || inputKind === "video_file") return "meeting_transcript";
  if (/invoice|amount due|total/i.test(text)) return "invoice";
  if (/meeting|agenda|attendees/i.test(text)) return "meeting_notes";
  if (tables > 0) return "tabular_document";
  if (/risk|issue|action/i.test(text)) return "operations_report";
  return "general_document";
};

const pickTopSentences = (sentences: string[], limit: number): string[] =>
  [...sentences]
    .sort((left, right) => sentenceScore(right) - sentenceScore(left))
    .slice(0, limit)
    .filter((sentence, index, array) => array.indexOf(sentence) === index);

const summarize = (title: string, text: string): Summary[] => {
  const sentences = text
    .split(/(?<=[\.\!\?\n])\s+/)
    .map((sentence) => normalizeText(sentence))
    .filter(Boolean);
  const briefSentences = pickTopSentences(sentences, 2);
  const standardSentences = pickTopSentences(sentences, 4);
  const detailedSentences = pickTopSentences(sentences, 8);
  return [
    { schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE, schema_version: TRANSCRIPTION_SCHEMA_VERSION, summary_id: id("summary", title, "brief"), source_refs: [], level: "brief", title: `${title} brief`, summary_text: briefSentences.join(" "), bullet_points: briefSentences, evidence_refs: [] },
    { schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE, schema_version: TRANSCRIPTION_SCHEMA_VERSION, summary_id: id("summary", title, "standard"), source_refs: [], level: "standard", title: `${title} summary`, summary_text: standardSentences.join(" "), bullet_points: standardSentences, evidence_refs: [] },
    { schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE, schema_version: TRANSCRIPTION_SCHEMA_VERSION, summary_id: id("summary", title, "detailed"), source_refs: [], level: "detailed", title: `${title} detailed`, summary_text: detailedSentences.join(" "), bullet_points: detailedSentences, evidence_refs: [] },
    { schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE, schema_version: TRANSCRIPTION_SCHEMA_VERSION, summary_id: id("summary", title, "executive"), source_refs: [], level: "executive", title: `${title} executive`, summary_text: standardSentences.slice(0, 3).join(" "), bullet_points: standardSentences.slice(0, 5), evidence_refs: [] }
  ];
};

const tokenise = (value: string): string[] =>
  normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/i)
    .filter((token) => token.length > 1);

const makeStorageRef = (prefix: string, objectId: string, region: string) => ({
  storage_id: id("storage", prefix, objectId),
  storage_class: "object",
  uri: `memory://${prefix}/${objectId}`,
  checksum: `sha256:${sha(objectId)}`,
  region
});

const makePermissionScope = () => ({
  visibility: "workspace" as const,
  allow_read: true,
  allow_write: true,
  allow_share: true,
  allow_publish: true,
  allow_audit_view: true
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createAuditEvent = (
  tenantRef: string,
  workspaceId: string,
  actorRef: string,
  actionRef: string,
  jobRef: string,
  objectRefs: string[],
  metadata: Record<string, unknown>
): AuditEvent =>
  AuditEventSchema.parse({
    contract: contractEnvelope("audit"),
    event_id: id("audit", jobRef, actionRef, String(metadata.stage ?? now())),
    timestamp: now(),
    actor_ref: actorRef,
    actor_type: "service",
    action_ref: actionRef,
    job_ref: jobRef,
    object_refs: objectRefs,
    workspace_id: workspaceId,
    tenant_ref: tenantRef,
    metadata
  });

const readBridgeResponse = (filePath: string): BridgeResponse => JSON.parse(fs.readFileSync(filePath, "utf8")) as BridgeResponse;

const buildCanonical = (bundle: UnifiedContentBundle): CanonicalRepresentation => {
  const documentId = id("document", bundle.bundle_id);
  const pageNodes = bundle.sources.map((source, index) => ({
    node_id: id("page", bundle.bundle_id, index + 1),
    node_type: "page" as const,
    parent_node_ref: documentId,
    child_node_refs: [],
    name: source.file_name,
    semantic_labels: [source.input_kind],
    layout_ref: "",
    data_binding_refs: [],
    formula_refs: [],
    lineage_refs: [source.source_artifact_ref],
    template_refs: [],
    evidence_refs: [],
    editable: true,
    width: 0,
    height: 0,
    unit: "px",
    layer_refs: []
  }));
  const textNodes = bundle.segments.map((segment) => ({
    node_id: id("text-node", segment.segment_id),
    node_type: "text" as const,
    parent_node_ref: documentId,
    child_node_refs: [],
    name: segment.segment_id,
    semantic_labels: [segment.segment_kind, segment.language],
    layout_ref: "",
    data_binding_refs: [],
    formula_refs: [],
    lineage_refs: [segment.lineage_ref],
    template_refs: [],
    evidence_refs: [segment.evidence_ref],
    editable: true,
    content: [{ value: segment.text, locale: segment.language, rtl: segment.language === "ar" }],
    typography_ref: ""
  }));
  const tableNodes = bundle.tables.map((table) => ({
    node_id: id("table-node", table.table_id),
    node_type: "table" as const,
    parent_node_ref: documentId,
    child_node_refs: [],
    name: table.title,
    semantic_labels: ["table"],
    layout_ref: "",
    data_binding_refs: [],
    formula_refs: [],
    lineage_refs: [],
    template_refs: [],
    evidence_refs: [table.evidence_ref],
    editable: true,
    row_count: table.row_count,
    column_count: table.column_count,
    schema_ref: table.table_id
  }));
  return CanonicalRepresentationSchema.parse({
    contract: contractEnvelope("canonical"),
    canonical_id: id("canonical", bundle.bundle_id),
    tenant_ref: bundle.tenant_ref,
    workspace_id: bundle.workspace_id,
    project_id: bundle.project_id,
    source_descriptors: bundle.sources.map((source) => ({
      source_ref: source.source_id,
      source_type: source.input_kind,
      source_revision_ref: source.source_artifact_ref,
      parser_profile: source.input_kind,
      connector_ref: "filesystem"
    })),
    representation_kind: "multimodal_content",
    strictness_mode: "smart",
    localization: {
      locale: bundle.language_profile.primary_language,
      rtl: bundle.language_profile.rtl,
      numeral_system: bundle.language_profile.primary_language === "ar" ? "arabic" : "latin",
      fallback_locales: ["en-US", "ar-SA"]
    },
    root_node_refs: [documentId],
    nodes: {
      documents: [
        {
          node_id: documentId,
          node_type: "document",
          parent_node_ref: null,
          child_node_refs: [...pageNodes.map((page) => page.node_id), ...textNodes.map((node) => node.node_id), ...tableNodes.map((node) => node.node_id)],
          name: bundle.bundle_id,
          semantic_labels: ["multimodal_content"],
          layout_ref: "",
          data_binding_refs: [],
          formula_refs: [],
          lineage_refs: bundle.lineage_refs,
          template_refs: [],
          evidence_refs: bundle.evidence_refs,
          editable: true,
          page_refs: pageNodes.map((page) => page.node_id),
          section_refs: bundle.sections.map((section) => section.section_id)
        }
      ],
      pages: pageNodes,
      sheets: [],
      slides: [],
      tables: tableNodes,
      charts: [],
      shapes: [],
      text: textNodes,
      images: []
    },
    layout_metadata: {
      coordinate_space: "page",
      bounding_boxes: bundle.segments.filter((segment) => segment.bbox).map((segment) => ({ ref: segment.segment_id, bbox: segment.bbox })),
      z_order: [],
      grid_rules: [],
      alignment_rules: []
    },
    data_binding_refs: [],
    formula_refs: [],
    semantic_labels: bundle.entities.map((entity) => ({
      label_id: entity.entity_id,
      label_type: entity.entity_type,
      label_value: entity.display_value,
      target_ref: entity.segment_ref ?? entity.field_ref ?? entity.entity_id
    })),
    lineage_refs: bundle.lineage_refs,
    template_refs: [],
    editability_flags: { default_editable: true, locked_region_refs: [], lock_reason_codes: [] },
    evidence_refs: bundle.evidence_refs,
    created_at: bundle.created_at,
    updated_at: bundle.updated_at
  });
};

const buildQueryDataset = (bundle: UnifiedContentBundle): Record<string, unknown> => ({
  bundle_id: bundle.bundle_id,
  fields: bundle.fields.map((field) => ({ name: field.field_name, value: field.field_value, source_ref: field.source_ref })),
  entities: bundle.entities.map((entity) => ({ type: entity.entity_type, value: entity.display_value, source_ref: entity.source_ref })),
  tables: bundle.tables.map((table) => ({ title: table.title, rows: table.rows, source_ref: table.source_ref })),
  segments: bundle.segments.map((segment) => ({ text: segment.text, source_ref: segment.source_ref, section_ref: segment.section_ref })),
  aligned_words: bundle.aligned_words.map((word) => ({ text: word.text, source_ref: word.source_ref, start_ms: word.start_ms, end_ms: word.end_ms })),
  on_screen_text: bundle.on_screen_text.map((observation) => ({ text: observation.text, source_ref: observation.source_ref, frame_ref: observation.frame_ref, subtitle_candidate: observation.subtitle_candidate })),
  disagreements: bundle.disagreements.map((disagreement) => ({ text: disagreement.text, source_ref: disagreement.source_ref, severity: disagreement.severity })),
  verification_gate: bundle.verification_gate,
  summaries: bundle.summaries
});

const buildReportHandoff = (bundle: UnifiedContentBundle): Record<string, unknown> => ({
  title: bundle.bundle_id,
  executive_summary: bundle.summaries.find((summary) => summary.level === "executive")?.summary_text ?? "",
  sections: bundle.sections.map((section) => ({ title: section.title, segment_refs: section.segment_refs, source_ref: section.source_ref })),
  key_fields: bundle.fields,
  entities: bundle.entities,
  tables: bundle.tables,
  action_items: bundle.action_items,
  qa_seeds: bundle.qa_seeds,
  verification_gate: bundle.verification_gate,
  on_screen_text: bundle.on_screen_text.slice(0, 10),
  disagreements: bundle.disagreements,
  source_refs: bundle.source_refs
});

const buildQuestionAnswer = (bundle: UnifiedContentBundle, question: TranscriptionQuestionRequest): TranscriptionQuestionAnswer => {
  const questionTokens = tokenise(question.question);
  const matchedSegments = bundle.segments
    .map((segment) => ({ segment, score: questionTokens.filter((token) => tokenise(segment.normalized_text).includes(token)).length }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const matchedFields = bundle.fields.filter((field) =>
    questionTokens.some((token) => tokenise(`${field.field_name} ${field.normalized_value}`).includes(token))
  );
  const matchedEntities = bundle.entities.filter((entity) =>
    questionTokens.some((token) => tokenise(entity.normalized_value).includes(token))
  );
  const compareIntent = /(difference|diff|compare|missing|appeared|shared|فروقات|فرق|مشترك|مفقود|ظهر)/i.test(question.question);
  let answerText = "";
  if (compareIntent && bundle.sources.length > 1) {
    const lowerQuestion = question.question.toLowerCase();
    const leftSource =
      bundle.sources.find((source) => lowerQuestion.includes("pdf") && source.input_kind === "pdf") ??
      bundle.sources.find((source) => lowerQuestion.includes("audio") && source.input_kind === "audio_file") ??
      bundle.sources[0];
    const rightSource =
      bundle.sources.find((source) => lowerQuestion.includes("excel") && source.input_kind === "spreadsheet_file") ??
      bundle.sources.find((source) => lowerQuestion.includes("video") && source.input_kind === "video_file") ??
      bundle.sources[1];
    const leftValues = new Set([
      ...bundle.fields.filter((field) => field.source_ref === leftSource.source_id).map((field) => `${field.field_name}:${field.normalized_value}`),
      ...bundle.entities.filter((entity) => entity.source_ref === leftSource.source_id).map((entity) => entity.normalized_value)
    ]);
    const rightValues = new Set([
      ...bundle.fields.filter((field) => field.source_ref === rightSource.source_id).map((field) => `${field.field_name}:${field.normalized_value}`),
      ...bundle.entities.filter((entity) => entity.source_ref === rightSource.source_id).map((entity) => entity.normalized_value)
    ]);
    const onlyLeft = [...leftValues].filter((value) => !rightValues.has(value)).slice(0, 8);
    const shared = [...leftValues].filter((value) => rightValues.has(value)).slice(0, 5);
    answerText = `${leftSource.file_name} only: ${onlyLeft.join(", ") || "none"}. Shared with ${rightSource.file_name}: ${shared.join(", ") || "none"}.`;
  } else if (matchedFields.length > 0) {
    answerText = matchedFields.slice(0, 5).map((field) => `${field.field_name}: ${field.field_value}`).join(" | ");
  } else if (matchedSegments.length > 0) {
    answerText = matchedSegments.map((entry) => entry.segment.text).join(" ");
  } else {
    answerText = bundle.summaries.find((summary) => summary.level === "executive")?.summary_text ?? "No grounded answer was found in the selected bundle.";
  }
  const citedSourceRefs = [...new Set([
    ...matchedSegments.map((entry) => entry.segment.source_ref),
    ...matchedFields.map((field) => field.source_ref),
    ...matchedEntities.map((entity) => entity.source_ref)
  ])];
  return TranscriptionQuestionAnswerSchema.parse({
    schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
    schema_version: TRANSCRIPTION_SCHEMA_VERSION,
    answer_id: id("answer", question.question_id),
    question_ref: question.question_id,
    answer_text: answerText,
    matched_segment_refs: matchedSegments.map((entry) => entry.segment.segment_id),
    matched_field_refs: matchedFields.map((field) => field.field_id),
    matched_entity_refs: matchedEntities.map((entity) => entity.entity_id),
    cited_source_refs: citedSourceRefs,
    confidence: matchedSegments.length > 0 || matchedFields.length > 0 ? 0.78 : 0.41,
    created_at: now()
  });
};

export class TranscriptionExtractionEngine {
  readonly store: TranscriptionExtractionStore;
  readonly pythonExecutable: string;

  constructor(options?: TranscriptionEngineOptions) {
    this.store = new TranscriptionExtractionStore(options?.storageDir);
    this.pythonExecutable = options?.pythonExecutable ?? resolvePythonExecutable();
  }

  private callBridge(inputPath: string, inputKind: string, workDir: string): BridgeResponse {
    const requestPath = bridgeRequestPath(workDir, path.basename(inputPath));
    const outputPath = bridgeOutputPath(workDir, path.basename(inputPath));
    fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(
      requestPath,
      JSON.stringify({ input_path: inputPath, input_kind: inputKind, work_dir: workDir }, null, 2),
      "utf8"
    );
    const result = spawnSync(this.pythonExecutable, [bridgeScriptPath(), "analyze", "--request", requestPath, "--output", outputPath], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `Bridge failed for ${inputPath}`);
    }
    return readBridgeResponse(outputPath);
  }

  private async analyzeSpreadsheet(inputPath: string): Promise<BridgeResponse> {
    const workbook = new ExcelJS.Workbook();
    const extension = path.extname(inputPath).toLowerCase();
    if (extension === ".csv") {
      await workbook.csv.readFile(inputPath);
    } else {
      await workbook.xlsx.readFile(inputPath);
    }
    const sections: Array<Record<string, unknown>> = [];
    const segments: Array<Record<string, unknown>> = [];
    const tables: Array<Record<string, unknown>> = [];
    const fullTextParts: string[] = [];
    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      const rows = worksheet.getSheetValues().slice(1).map((row) =>
        Array.isArray(row)
          ? row
              .slice(1)
              .map((cell) => normalizeText(cell === null || cell === undefined ? "" : String(cell)))
              .filter((cell) => cell.length > 0)
          : []
      );
      const filteredRows = rows.filter((row) => row.length > 0);
      const sectionId = `section-${sheetIndex + 1}`;
      sections.push({ section_id: sectionId, title: worksheet.name, section_kind: "table", page_number: null, bbox: null });
      if (filteredRows.length > 0) {
        tables.push({
          table_id: `table-${tables.length + 1}`,
          title: worksheet.name,
          page_number: null,
          row_count: filteredRows.length,
          column_count: filteredRows[0]?.length ?? 0,
          headers: filteredRows[0] ?? [],
          rows: filteredRows,
          bbox: null,
          extraction_method: "spreadsheet_parser"
        });
        const text = filteredRows.map((row) => row.join(" | ")).join("\n");
        fullTextParts.push(text);
        segments.push({
          segment_id: `segment-${segments.length + 1}`,
          segment_kind: "table",
          section_id: sectionId,
          speaker_id: null,
          text,
          normalized_text: text,
          language: detectLanguage(text),
          confidence: 1,
          start_ms: null,
          end_ms: null,
          paragraph_index: segments.length,
          page_number: null,
          bbox: null
        });
      }
    });
    const fullText = normalizeText(fullTextParts.join("\n\n"));
    return {
      status: "success",
      file_name: path.basename(inputPath),
      input_path: inputPath,
      input_kind: "spreadsheet_file",
      full_text: fullText,
      normalized_text: fullText,
      detected_language: detectLanguage(fullText),
      sections,
      segments,
      tables,
      speakers: [],
      metadata: { worksheet_count: workbook.worksheets.length },
      warning_codes: []
    };
  }

  async ingestAndExtract(input: TranscriptionJobRequest): Promise<TranscriptionWorkflowResult> {
    const request = TranscriptionJobRequestSchema.parse({
      ...input,
      attachments: input.attachments.map((attachment) => ({
        ...attachment,
        input_kind: attachment.input_kind ?? detectInputKind(attachment.file_name)
      }))
    });
    const timestamp = now();
    const jobId = id("job", request.request_id || sha(timestamp).slice(0, 8), "transcription");
    const ingestWarnings: Job["warnings"] = [];
    const degradedReasons: EvidencePack["degraded_reasons"] = [];
    const globalSources: UnifiedContentBundle["sources"] = [];
    const globalSpeakers: UnifiedContentBundle["speakers"] = [];
    const globalSections: UnifiedContentBundle["sections"] = [];
    const globalSegments: UnifiedContentBundle["segments"] = [];
    const globalAlignedWords: UnifiedContentBundle["aligned_words"] = [];
    const globalDisagreements: UnifiedContentBundle["disagreements"] = [];
    const globalOnScreenText: UnifiedContentBundle["on_screen_text"] = [];
    const globalTables: UnifiedContentBundle["tables"] = [];
    const globalFields: UnifiedContentBundle["fields"] = [];
    const globalEntities: UnifiedContentBundle["entities"] = [];
    const globalActionItems: UnifiedContentBundle["action_items"] = [];
    const evidenceRefs: string[] = [];
    const lineageRefs: string[] = [];
    const semanticNodes: UnifiedContentBundle["semantic_nodes"] = [];
    const semanticEdges: UnifiedContentBundle["semantic_edges"] = [];
    const jobRoot = path.join(this.store.rootDir, "jobs", jobId, "bridge");
    const auditEvents: AuditEvent[] = [];
    const attachmentPaths = request.attachments.map((attachment) => {
      const content = attachment.content_base64 ? Buffer.from(attachment.content_base64, "base64") : null;
      const targetPath = content
        ? this.store.writeInputFile(jobId, attachment.file_name, content)
        : attachment.file_path
          ? this.store.writeInputCopy(jobId, attachment.file_name, attachment.file_path)
          : (() => {
              throw new Error(`Attachment ${attachment.file_name} has neither content_base64 nor file_path.`);
            })();
      return { attachment, targetPath };
    });
    auditEvents.push(createAuditEvent(request.tenant_ref, request.workspace_id, request.created_by, "transcription.ingest_and_extract.v1", jobId, [], { stage: "created" }));

    for (const entry of attachmentPaths) {
      const sourceId = id("source", jobId, entry.attachment.file_name);
      const sourceArtifactRef = id("artifact", sourceId, "source");
      const inputKind = entry.attachment.input_kind ?? detectInputKind(entry.attachment.file_name);
      const response =
        inputKind === "spreadsheet_file" && [".xlsx", ".xlsm", ".csv"].includes(path.extname(entry.targetPath).toLowerCase())
          ? await this.analyzeSpreadsheet(entry.targetPath)
          : this.callBridge(entry.targetPath, inputKind, path.join(jobRoot, sourceId));

      if (response.status !== "success") {
        const reason = {
          reason_code: "source_processing_failed",
          summary: `Failed to process ${entry.attachment.file_name}`,
          detail: response.error?.message ?? "Unknown bridge failure.",
          impacted_refs: [sourceId],
          retryable: true
        };
        degradedReasons.push(reason);
        ingestWarnings.push({
          warning_code: "source_processing_failed",
          summary: reason.summary,
          detail: reason.detail,
          severity: "high",
          impacted_refs: [sourceId]
        });
        continue;
      }

      const sourceRef = sourceId;
      const source = {
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        source_id: sourceRef,
        attachment_ref: entry.attachment.attachment_id,
        file_name: entry.attachment.file_name,
        media_type: entry.attachment.media_type || guessMediaType(entry.attachment.file_name),
        input_kind: inputKind,
        storage_ref: entry.targetPath,
        source_artifact_ref: sourceArtifactRef,
        file_size_bytes: fs.statSync(entry.targetPath).size,
        page_count: response.page_count ?? null,
        duration_ms: response.duration_ms ?? null,
        detected_language: response.detected_language ?? detectLanguage(response.full_text ?? ""),
        warning_codes: response.warning_codes ?? [],
        ingested_at: timestamp
      } as UnifiedContentBundle["sources"][number];
      globalSources.push(source);
      evidenceRefs.push(id("evidence-source", sourceRef));
      lineageRefs.push(id("lineage-source", sourceRef));
      semanticNodes.push({
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        node_id: sourceRef,
        node_type: "source",
        label: source.file_name,
        source_ref: sourceRef,
        metadata: { input_kind: source.input_kind, media_type: source.media_type }
      });

      const localSpeakerMap = new Map<string, string>();
      for (const speaker of response.speakers ?? []) {
        const localSpeakerId = String(speaker.speaker_id ?? `speaker-${globalSpeakers.length + 1}`);
        const globalSpeakerId = id("speaker", sourceRef, localSpeakerId);
        localSpeakerMap.set(localSpeakerId, globalSpeakerId);
        globalSpeakers.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          speaker_id: globalSpeakerId,
          display_name: String(speaker.display_name ?? globalSpeakerId),
          detection_method: (speaker.detection_method as "provided" | "heuristic" | "single_speaker") ?? "heuristic",
          confidence: Number(speaker.confidence ?? 0.75)
        });
      }

      const localSectionMap = new Map<string, string>();
      for (const section of response.sections ?? []) {
        const localSectionId = String(section.section_id ?? `section-${localSectionMap.size + 1}`);
        const globalSectionId = id("section", sourceRef, localSectionId);
        localSectionMap.set(localSectionId, globalSectionId);
        globalSections.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          section_id: globalSectionId,
          source_ref: sourceRef,
          title: String(section.title ?? source.file_name),
          section_kind: (section.section_kind as UnifiedContentBundle["sections"][number]["section_kind"]) ?? "body",
          page_ref: section.page_number === null || section.page_number === undefined ? null : `page-${section.page_number}`,
          segment_refs: [],
          order_index: globalSections.length,
          heading_level: 1,
          bbox: (section.bbox as number[] | null | undefined) ?? null
        });
      }

      const sourceText = normalizeText(response.full_text ?? response.normalized_text ?? "");
      for (const segment of response.segments ?? []) {
        const localSegmentId = String(segment.segment_id ?? `segment-${globalSegments.length + 1}`);
        const sectionRef = segment.section_id ? localSectionMap.get(String(segment.section_id)) ?? null : null;
        const globalSegmentId = id("segment", sourceRef, localSegmentId);
        const evidenceRef = id("evidence", globalSegmentId);
        const lineageRef = id("lineage", globalSegmentId);
        const parsed = {
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          segment_id: globalSegmentId,
          source_ref: sourceRef,
          segment_kind: (segment.segment_kind as UnifiedContentBundle["segments"][number]["segment_kind"]) ?? "paragraph",
          section_ref: sectionRef,
          speaker_ref: segment.speaker_id ? localSpeakerMap.get(String(segment.speaker_id)) ?? null : null,
          order_index: globalSegments.length,
          text: normalizeText(String(segment.text ?? "")),
          normalized_text: normalizeText(String(segment.normalized_text ?? segment.text ?? "")),
          language: String(segment.language ?? source.detected_language ?? "en"),
          confidence: Math.max(0, Math.min(1, Number(segment.confidence ?? 0.8))),
          start_ms: segment.start_ms === null || segment.start_ms === undefined ? null : Number(segment.start_ms),
          end_ms: segment.end_ms === null || segment.end_ms === undefined ? null : Number(segment.end_ms),
          paragraph_index: Number(segment.paragraph_index ?? globalSegments.length),
          page_number: segment.page_number === null || segment.page_number === undefined ? null : Number(segment.page_number),
          bbox: (segment.bbox as number[] | null | undefined) ?? null,
          evidence_ref: evidenceRef,
          lineage_ref: lineageRef
        } as UnifiedContentBundle["segments"][number];
        globalSegments.push(parsed);
        evidenceRefs.push(evidenceRef);
        lineageRefs.push(lineageRef);
        semanticNodes.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          node_id: globalSegmentId,
          node_type: "segment",
          label: parsed.text.slice(0, 120),
          source_ref: sourceRef,
          metadata: { segment_kind: parsed.segment_kind, language: parsed.language }
        });
        semanticEdges.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          edge_id: id("edge", sourceRef, globalSegmentId),
          from_ref: sourceRef,
          to_ref: globalSegmentId,
          relation_type: "contains",
          confidence: 1,
          metadata: {}
        });
      }

      for (const word of response.word_timestamps ?? []) {
        const text = normalizeText(String(word.text ?? ""));
        if (!text) {
          continue;
        }
        const startMs = Number(word.start_ms ?? 0);
        const endMs = Number(word.end_ms ?? startMs);
        const segmentRef =
          globalSegments.find(
            (segment) =>
              segment.source_ref === sourceRef &&
              segment.start_ms !== null &&
              segment.end_ms !== null &&
              startMs >= segment.start_ms &&
              endMs <= segment.end_ms
          )?.segment_id ?? null;
        const alignedWordId = id("aligned-word", sourceRef, startMs, text);
        const evidenceRef = id("evidence", alignedWordId);
        const lineageRef = id("lineage", alignedWordId);
        globalAlignedWords.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          word_id: alignedWordId,
          source_ref: sourceRef,
          segment_ref: segmentRef,
          speaker_ref: segmentRef ? globalSegments.find((segment) => segment.segment_id === segmentRef)?.speaker_ref ?? null : null,
          text,
          normalized_text: text,
          start_ms: startMs,
          end_ms: endMs,
          confidence: Math.max(0, Math.min(1, Number(word.confidence ?? 0.75))),
          evidence_ref: evidenceRef,
          lineage_ref: lineageRef
        });
        evidenceRefs.push(evidenceRef);
        lineageRefs.push(lineageRef);
      }

      for (const observation of response.on_screen_text ?? []) {
        const observationId = id("on-screen", sourceRef, String(observation.observation_id ?? globalOnScreenText.length + 1));
        const evidenceRef = id("evidence", observationId);
        globalOnScreenText.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          observation_id: observationId,
          source_ref: sourceRef,
          frame_ref: String(observation.frame_ref ?? "frame-1"),
          text: normalizeText(String(observation.text ?? "")),
          normalized_text: normalizeText(String(observation.normalized_text ?? observation.text ?? "")),
          start_ms: observation.start_ms === null || observation.start_ms === undefined ? null : Number(observation.start_ms),
          end_ms: observation.end_ms === null || observation.end_ms === undefined ? null : Number(observation.end_ms),
          confidence: Math.max(0, Math.min(1, Number(observation.confidence ?? 0.78))),
          subtitle_candidate: Boolean(observation.subtitle_candidate),
          bbox: (observation.bbox as number[] | null | undefined) ?? null,
          evidence_ref: evidenceRef
        });
        evidenceRefs.push(evidenceRef);
      }

      for (const disagreement of response.disagreements ?? []) {
        const disagreementId = id("disagreement", sourceRef, String(disagreement.disagreement_id ?? globalDisagreements.length + 1));
        const evidenceRef = id("evidence", disagreementId);
        globalDisagreements.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          disagreement_id: disagreementId,
          source_ref: sourceRef,
          disagreement_type:
            (disagreement.disagreement_type as UnifiedContentBundle["disagreements"][number]["disagreement_type"]) ??
            "verification_gap",
          text: normalizeText(String(disagreement.text ?? "")),
          start_ms: disagreement.start_ms === null || disagreement.start_ms === undefined ? null : Number(disagreement.start_ms),
          end_ms: disagreement.end_ms === null || disagreement.end_ms === undefined ? null : Number(disagreement.end_ms),
          page_number: disagreement.page_number === null || disagreement.page_number === undefined ? null : Number(disagreement.page_number),
          severity: (disagreement.severity as "low" | "medium" | "high") ?? "medium",
          resolution_status: (disagreement.resolution_status as "open" | "resolved" | "accepted") ?? "open",
          evidence_ref: evidenceRef
        });
        evidenceRefs.push(evidenceRef);
      }

      for (const section of globalSections.filter((candidate) => candidate.source_ref === sourceRef)) {
        section.segment_refs = globalSegments.filter((segment) => segment.section_ref === section.section_id).map((segment) => segment.segment_id);
        semanticNodes.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          node_id: section.section_id,
          node_type: "section",
          label: section.title,
          source_ref: sourceRef,
          metadata: { section_kind: section.section_kind }
        });
        semanticEdges.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          edge_id: id("edge", sourceRef, section.section_id),
          from_ref: sourceRef,
          to_ref: section.section_id,
          relation_type: "contains",
          confidence: 1,
          metadata: {}
        });
      }

      for (const table of response.tables ?? []) {
        const globalTableId = id("table", sourceRef, String(table.table_id ?? globalTables.length + 1));
        const parsed = {
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          table_id: globalTableId,
          source_ref: sourceRef,
          title: String(table.title ?? globalTableId),
          page_number: table.page_number === null || table.page_number === undefined ? null : Number(table.page_number),
          row_count: Number(table.row_count ?? 0),
          column_count: Number(table.column_count ?? 0),
          headers: ((table.headers as string[] | undefined) ?? []).map((header) => normalizeText(String(header))),
          rows: ((table.rows as string[][] | undefined) ?? []).map((row) => row.map((cell) => normalizeText(String(cell)))),
          bbox: (table.bbox as number[] | null | undefined) ?? null,
          extraction_method: (table.extraction_method as "pdf_text" | "ocr_table" | "spreadsheet_parser") ?? "ocr_table",
          evidence_ref: id("evidence", globalTableId)
        } as UnifiedContentBundle["tables"][number];
        globalTables.push(parsed);
        evidenceRefs.push(parsed.evidence_ref);
        semanticNodes.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          node_id: globalTableId,
          node_type: "table",
          label: parsed.title,
          source_ref: sourceRef,
          metadata: { row_count: parsed.row_count, column_count: parsed.column_count }
        });
        semanticEdges.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          edge_id: id("edge", sourceRef, globalTableId),
          from_ref: sourceRef,
          to_ref: globalTableId,
          relation_type: "contains",
          confidence: 1,
          metadata: {}
        });
      }

      const effectiveText =
        sourceText || globalSegments.filter((segment) => segment.source_ref === sourceRef).map((segment) => segment.text).join("\n");
      const namedValues = namedValueMatches(effectiveText);
      const dates = extractDates(effectiveText);
      const amounts = extractAmounts(effectiveText);
      const properEntities = extractProperEntities(effectiveText);
      const sourceFieldIds: string[] = [];

      namedValues.forEach((namedValue) => {
        const fieldId = id("field", sourceRef, namedValue.name);
        globalFields.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          field_id: fieldId,
          source_ref: sourceRef,
          field_name: namedValue.name,
          field_value: namedValue.value,
          normalized_value: normalizeText(namedValue.value),
          value_type: /\d/.test(namedValue.value) ? "number" : "string",
          confidence: 0.9,
          segment_ref: globalSegments.find((segment) => segment.source_ref === sourceRef && segment.text.includes(namedValue.value))?.segment_id ?? null,
          page_number: null,
          evidence_ref: id("evidence", fieldId)
        });
        sourceFieldIds.push(fieldId);
      });

      globalFields.push({
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        field_id: id("field", sourceRef, "classification"),
        source_ref: sourceRef,
        field_name: "classification",
        field_value: inferClassification(source.input_kind, effectiveText, globalTables.filter((table) => table.source_ref === sourceRef).length),
        normalized_value: inferClassification(source.input_kind, effectiveText, globalTables.filter((table) => table.source_ref === sourceRef).length),
        value_type: "string",
        confidence: 0.88,
        segment_ref: null,
        page_number: null,
        evidence_ref: id("evidence", sourceRef, "classification")
      });

      dates.forEach((value) =>
        globalEntities.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          entity_id: id("entity", sourceRef, "date", value),
          source_ref: sourceRef,
          entity_type: "date",
          display_value: value,
          normalized_value: value,
          confidence: 0.86,
          segment_ref: globalSegments.find((segment) => segment.source_ref === sourceRef && segment.text.includes(value))?.segment_id ?? null,
          field_ref: null,
          page_number: null,
          evidence_ref: id("evidence", sourceRef, "date", value)
        })
      );
      amounts.forEach((value) =>
        globalEntities.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          entity_id: id("entity", sourceRef, "amount", value),
          source_ref: sourceRef,
          entity_type: "amount",
          display_value: value,
          normalized_value: value.replace(/[^\d.]/g, ""),
          confidence: 0.82,
          segment_ref: globalSegments.find((segment) => segment.source_ref === sourceRef && segment.text.includes(value))?.segment_id ?? null,
          field_ref: null,
          page_number: null,
          evidence_ref: id("evidence", sourceRef, "amount", value)
        })
      );
      properEntities.forEach((value) =>
        globalEntities.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          entity_id: id("entity", sourceRef, "named", value),
          source_ref: sourceRef,
          entity_type: "other",
          display_value: value,
          normalized_value: value,
          confidence: 0.62,
          segment_ref: globalSegments.find((segment) => segment.source_ref === sourceRef && segment.text.includes(value))?.segment_id ?? null,
          field_ref: null,
          page_number: null,
          evidence_ref: id("evidence", sourceRef, "named", value)
        })
      );

      const actionSegments = globalSegments.filter(
        (segment) => segment.source_ref === sourceRef && /(must|should|need|required|action|يجب|مطلوب|يلزم)/i.test(segment.text)
      );
      actionSegments.forEach((segment, index) =>
        globalActionItems.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          action_item_id: id("action", sourceRef, index + 1),
          source_ref: sourceRef,
          description: segment.text,
          owner_hint: null,
          due_date_hint: extractDates(segment.text)[0] ?? null,
          confidence: 0.74,
          supporting_segment_refs: [segment.segment_id]
        })
      );

      semanticEdges.push(
        ...sourceFieldIds.map((fieldId) => ({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          edge_id: id("edge", sourceRef, fieldId),
          from_ref: sourceRef,
          to_ref: fieldId,
          relation_type: "contains" as const,
          confidence: 0.96,
          metadata: {}
        }))
      );

      auditEvents.push(
        createAuditEvent(request.tenant_ref, request.workspace_id, request.created_by, "transcription.source_ingested.v1", jobId, [sourceRef], {
          stage: "parsing",
          input_kind: source.input_kind,
          segments: globalSegments.filter((segment) => segment.source_ref === sourceRef).length,
          tables: globalTables.filter((table) => table.source_ref === sourceRef).length,
          aligned_words: globalAlignedWords.filter((word) => word.source_ref === sourceRef).length,
          on_screen_text: globalOnScreenText.filter((observation) => observation.source_ref === sourceRef).length,
          disagreements: globalDisagreements.filter((disagreement) => disagreement.source_ref === sourceRef).length
        })
      );
    }

    const combinedText = normalizeText(globalSegments.map((segment) => segment.normalized_text).join("\n"));
    const summaries = summarize(request.request_id, combinedText).map((summary) => ({
      ...summary,
      source_refs: globalSources.map((source) => source.source_id),
      evidence_refs: evidenceRefs.slice(0, 5)
    }));
    const qaSeeds = [
      ...globalFields.slice(0, 5).map((field, index) => ({
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        seed_id: id("qa", field.field_id),
        source_refs: [field.source_ref],
        question: `What is ${field.field_name}?`,
        answer_seed: `${field.field_name} is ${field.field_value}.`,
        supporting_segment_refs: field.segment_ref ? [field.segment_ref] : [],
        confidence: 0.84 - index * 0.05
      })),
      ...globalEntities.slice(0, 5).map((entity) => ({
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        seed_id: id("qa", entity.entity_id),
        source_refs: [entity.source_ref],
        question: `Where does ${entity.display_value} appear?`,
        answer_seed: `${entity.display_value} appears in ${globalSources.find((source) => source.source_id === entity.source_ref)?.file_name ?? entity.source_ref}.`,
        supporting_segment_refs: entity.segment_ref ? [entity.segment_ref] : [],
        confidence: 0.76
      }))
    ];

    const fieldMap = globalFields.reduce<Record<string, string[]>>((accumulator, field) => {
      accumulator[field.field_name] ??= [];
      accumulator[field.field_name].push(field.field_id);
      return accumulator;
    }, {});
    const relations: UnifiedContentBundle["relations"] = [];
    for (let index = 0; index < globalSources.length; index += 1) {
      for (let inner = index + 1; inner < globalSources.length; inner += 1) {
        const left = globalSources[index];
        const right = globalSources[inner];
        const leftEntities = new Set(globalEntities.filter((entity) => entity.source_ref === left.source_id).map((entity) => entity.normalized_value));
        const rightEntities = new Set(globalEntities.filter((entity) => entity.source_ref === right.source_id).map((entity) => entity.normalized_value));
        const shared = [...leftEntities].filter((value) => rightEntities.has(value));
        relations.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          relation_id: id("relation", left.source_id, right.source_id),
          left_source_ref: left.source_id,
          right_source_ref: right.source_id,
          relation_kind: shared.length > 0 ? "shared_entities" : "comparison_pair",
          shared_refs: shared,
          summary: shared.length > 0 ? `${left.file_name} and ${right.file_name} share ${shared.slice(0, 5).join(", ")}.` : `${left.file_name} and ${right.file_name} were paired for comparison.`
        });
      }
    }
    const mediaSourceCount = globalSources.filter((source) => ["audio_file", "video_file"].includes(source.input_kind)).length;
    const videoSourceCount = globalSources.filter((source) => source.input_kind === "video_file").length;
    const unresolvedDisagreementRefs = globalDisagreements
      .filter((disagreement) => disagreement.resolution_status === "open")
      .map((disagreement) => disagreement.disagreement_id);
    const multimodalCorroborated =
      mediaSourceCount === 0 ||
      (globalAlignedWords.length > 0 && (videoSourceCount === 0 || globalOnScreenText.length > 0) && unresolvedDisagreementRefs.length === 0);
    const verificationWarnings = [
      ...(mediaSourceCount > 0 && globalAlignedWords.length === 0 ? ["alignment_missing"] : []),
      ...(videoSourceCount > 0 && globalOnScreenText.length === 0 ? ["on_screen_ocr_missing"] : []),
      ...(mediaSourceCount > 0 && !multimodalCorroborated ? ["asr_single_engine"] : []),
      ...(unresolvedDisagreementRefs.length > 0 ? ["verification_disagreements_present"] : [])
    ];
    const verificationPenalty =
      unresolvedDisagreementRefs.length * 0.18 +
      (mediaSourceCount > 0 && globalAlignedWords.length === 0 ? 0.25 : 0) +
      (videoSourceCount > 0 && globalOnScreenText.length === 0 ? 0.2 : 0);
    const verificationGate = {
      schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
      schema_version: TRANSCRIPTION_SCHEMA_VERSION,
      gate_id: id("verification-gate", jobId),
      exact:
        unresolvedDisagreementRefs.length === 0 &&
        (mediaSourceCount === 0 || globalAlignedWords.length > 0) &&
        (videoSourceCount === 0 || globalOnScreenText.length > 0) &&
        verificationWarnings.length === 0,
      verification_score: Number(Math.max(0.05, Math.min(1, 1 - verificationPenalty)).toFixed(3)),
      alignment_pass: mediaSourceCount === 0 || globalAlignedWords.length > 0,
      subtitle_detection_pass: videoSourceCount === 0 || globalOnScreenText.length > 0,
      on_screen_ocr_applied: globalOnScreenText.length > 0,
      unresolved_disagreement_refs: unresolvedDisagreementRefs,
      warning_codes: verificationWarnings,
      summary:
        unresolvedDisagreementRefs.length > 0
          ? `Verification gate found ${unresolvedDisagreementRefs.length} unresolved multimodal disagreement span(s).`
          : "Verification gate passed with aligned timestamps and no unresolved multimodal disagreements.",
      checked_at: timestamp
    } as UnifiedContentBundle["verification_gate"];

    qaSeeds.forEach((seed) => {
      semanticNodes.push({
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        node_id: seed.seed_id,
        node_type: "question_seed",
        label: seed.question,
        source_ref: seed.source_refs[0] ?? null,
        metadata: {}
      });
      seed.supporting_segment_refs.forEach((segmentRef) =>
        semanticEdges.push({
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          edge_id: id("edge", seed.seed_id, segmentRef),
          from_ref: seed.seed_id,
          to_ref: segmentRef,
          relation_type: "answers",
          confidence: seed.confidence,
          metadata: {}
        })
      );
    });
    summaries.forEach((summary) =>
      semanticNodes.push({
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        node_id: summary.summary_id,
        node_type: "summary",
        label: summary.title,
        source_ref: null,
        metadata: { level: summary.level }
      })
    );

    const bundleId = id("bundle", request.request_id);
    const bundleArtifactId = id("artifact", bundleId, "bundle");
    const transcriptArtifactId = id("artifact", bundleId, "transcript");
    const extractionArtifactId = id("artifact", bundleId, "extraction");
    const summaryArtifactId = id("artifact", bundleId, "summary");
    const bundle = UnifiedContentBundleSchema.parse({
      contract: TRANSCRIPTION_CONTRACT,
      schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
      schema_version: TRANSCRIPTION_SCHEMA_VERSION,
      bundle_id: bundleId,
      capability_id: TRANSCRIPTION_CAPABILITY_ID,
      tenant_ref: request.tenant_ref,
      workspace_id: request.workspace_id,
      project_id: request.project_id,
      artifact_ref: bundleArtifactId,
      canonical_ref: id("canonical", bundleId),
      transcript_artifact_ref: transcriptArtifactId,
      extraction_artifact_ref: extractionArtifactId,
      summary_artifact_ref: summaryArtifactId,
      source_refs: globalSources.map((source) => source.source_id),
      sources: globalSources,
      speakers: globalSpeakers,
      sections: globalSections,
      segments: globalSegments,
      aligned_words: globalAlignedWords,
      disagreements: globalDisagreements,
      on_screen_text: globalOnScreenText,
      verification_gate: verificationGate,
      tables: globalTables,
      fields: globalFields,
      entities: globalEntities,
      summaries,
      qa_seeds: qaSeeds,
      action_items: globalActionItems,
      semantic_nodes: semanticNodes,
      semantic_edges: semanticEdges,
      field_map: fieldMap,
      metadata: {
        source_count: globalSources.length,
        classifications: globalFields.filter((field) => field.field_name === "classification").map((field) => field.field_value),
        compare_ready: relations.length > 0,
        mixed_batch: globalSources.length > 1,
        verification_score: verificationGate.verification_score,
        unresolved_disagreements: unresolvedDisagreementRefs.length
      },
      evidence_refs: [...new Set(evidenceRefs)],
      lineage_refs: [...new Set(lineageRefs)],
      language_profile: {
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        primary_language: detectLanguage(combinedText),
        detected_languages: [...new Set(globalSources.map((source) => source.detected_language ?? "en"))],
        rtl: detectLanguage(combinedText) === "ar",
        language_confidence: 0.88
      },
      relations,
      report_ready_handoff_ref: "report-handoff.json",
      query_ready: true,
      created_by: request.created_by,
      created_at: timestamp,
      updated_at: timestamp
    });
    const canonical = buildCanonical(bundle);
    const reportHandoff = buildReportHandoff(bundle);
    const queryDataset = buildQueryDataset(bundle);
    const verificationStatus = degradedReasons.length > 0 ? "degraded" : "verified";
    const bundleArtifact = ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: bundleArtifactId,
      artifact_type: "workflow_output",
      artifact_subtype: "transcription_bundle",
      project_id: request.project_id,
      workspace_id: request.workspace_id,
      source_refs: bundle.source_refs,
      parent_artifact_refs: globalSources.map((source) => source.source_artifact_ref),
      canonical_ref: canonical.canonical_id,
      created_by: request.created_by,
      created_at: timestamp,
      mode: request.mode,
      editable_status: "editable",
      template_status: "none",
      lineage_ref: id("lineage", bundleId),
      evidence_ref: id("evidence", bundleId),
      verification_status: verificationStatus,
      storage_ref: makeStorageRef("transcription-bundle", bundleId, "workspace"),
      preview_ref: { preview_id: id("preview", bundleId), preview_type: "html_canvas", storage_ref: id("storage", "transcription-bundle", bundleId) },
      export_refs: [],
      version_ref: { version_id: id("version", bundleId), parent_version_id: null, version_number: 1, semantic_version: "1.0.0" },
      tenant_ref: request.tenant_ref,
      permission_scope: makePermissionScope()
    });
    const transcriptArtifact = ArtifactSchema.parse({
      ...clone(bundleArtifact),
      artifact_id: transcriptArtifactId,
      artifact_subtype: "transcript_artifact",
      storage_ref: makeStorageRef("transcript", bundleId, "workspace"),
      preview_ref: { preview_id: id("preview", transcriptArtifactId), preview_type: "html_canvas", storage_ref: id("storage", "transcript", bundleId) }
    });
    const extractionArtifact = ArtifactSchema.parse({
      ...clone(bundleArtifact),
      artifact_id: extractionArtifactId,
      artifact_subtype: "extracted_fields_artifact",
      storage_ref: makeStorageRef("extraction", bundleId, "workspace"),
      preview_ref: { preview_id: id("preview", extractionArtifactId), preview_type: "html_canvas", storage_ref: id("storage", "extraction", bundleId) }
    });
    const summaryArtifact = ArtifactSchema.parse({
      ...clone(bundleArtifact),
      artifact_id: summaryArtifactId,
      artifact_subtype: "summary_artifact",
      storage_ref: makeStorageRef("summary", bundleId, "workspace"),
      preview_ref: { preview_id: id("preview", summaryArtifactId), preview_type: "html_canvas", storage_ref: id("storage", "summary", bundleId) }
    });
    const evidencePack = EvidencePackSchema.parse({
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence", bundleId),
      verification_status: verificationStatus,
      source_refs: bundle.source_refs,
      generated_artifact_refs: [bundleArtifactId, transcriptArtifactId, extractionArtifactId, summaryArtifactId],
      checks_executed: [
        { check_id: id("check", bundleId, "ingest"), check_name: "ingest_integrity_check", check_type: "ingest", passed: globalSources.length > 0, severity: "high", details: "At least one source was ingested and normalized.", impacted_refs: bundle.source_refs },
        { check_id: id("check", bundleId, "transcript"), check_name: "transcript_generation_check", check_type: "transcript", passed: globalSegments.length > 0, severity: "high", details: "Segments were produced for the normalized bundle.", impacted_refs: globalSegments.map((segment) => segment.segment_id) },
        { check_id: id("check", bundleId, "ocr"), check_name: "ocr_extraction_check", check_type: "ocr", passed: globalTables.length > 0 || globalSegments.some((segment) => segment.segment_kind === "ocr_block"), severity: "medium", details: "OCR or table extraction executed on document/image inputs when needed.", impacted_refs: globalTables.map((table) => table.table_id) },
        { check_id: id("check", bundleId, "structured"), check_name: "structured_extraction_check", check_type: "extraction", passed: globalFields.length > 0 && globalEntities.length > 0, severity: "high", details: "Structured fields and entities were derived from normalized content.", impacted_refs: [...globalFields.map((field) => field.field_id), ...globalEntities.map((entity) => entity.entity_id)] },
        { check_id: id("check", bundleId, "exactness"), check_name: "transcription_exactness_gate_check", check_type: "verification", passed: verificationGate.alignment_pass && verificationGate.subtitle_detection_pass, severity: "medium", details: verificationGate.summary, impacted_refs: verificationGate.unresolved_disagreement_refs }
      ],
      before_refs: bundle.source_refs,
      after_refs: [bundle.bundle_id],
      metrics: [
        { metric_name: "source_count", metric_value: globalSources.length, metric_unit: "sources" },
        { metric_name: "segment_count", metric_value: globalSegments.length, metric_unit: "segments" },
        { metric_name: "table_count", metric_value: globalTables.length, metric_unit: "tables" },
        { metric_name: "field_count", metric_value: globalFields.length, metric_unit: "fields" },
        { metric_name: "entity_count", metric_value: globalEntities.length, metric_unit: "entities" }
      ],
      warnings: ingestWarnings,
      failure_reasons: [],
      degraded_reasons: degradedReasons,
      replay_context: { action_id: "transcription.ingest_and_extract.v1", bundle_id: bundleId },
      reproducibility_metadata: {
        replay_token: id("replay", bundleId),
        execution_seed: `${request.request_id}:${bundle.source_refs.join("|")}`,
        environment_stamp: "rasid-platform-core",
        tool_versions: [{ tool: "transcription-extraction-engine", version: "1.0.0" }, { tool: "content-bridge.py", version: "1.0.0" }]
      },
      strict_evidence_level: "strong"
    });
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: jobId,
      capability: TRANSCRIPTION_CAPABILITY_ID,
      requested_mode: request.mode,
      capability_submode: "ingest_and_extract",
      source_refs: bundle.source_refs,
      artifact_refs: [bundleArtifactId, transcriptArtifactId, extractionArtifactId, summaryArtifactId],
      progress: 100,
      stage: degradedReasons.length > 0 ? "degraded" : "verifying",
      state: degradedReasons.length > 0 ? "degraded" : "completed",
      warnings: ingestWarnings,
      failure_reason: null,
      retry_policy: { max_attempts: 2, strategy: "fixed", backoff_ms: 1500 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: timestamp,
      finished_at: now(),
      resource_profile: { cpu_class: "standard", memory_class: "medium", io_class: "balanced", expected_parallelism: 1 }
    });
    auditEvents.push(
      createAuditEvent(request.tenant_ref, request.workspace_id, request.created_by, "transcription.extraction_generated.v1", jobId, [bundleId], { stage: "executing", fields: globalFields.length, entities: globalEntities.length, tables: globalTables.length }),
      createAuditEvent(request.tenant_ref, request.workspace_id, request.created_by, "transcription.exactness_gate.v1", jobId, [bundleId, verificationGate.gate_id], { stage: "verification", exact: verificationGate.exact, verification_score: verificationGate.verification_score, unresolved_disagreements: verificationGate.unresolved_disagreement_refs.length }),
      createAuditEvent(request.tenant_ref, request.workspace_id, request.created_by, "transcription.job_completed.v1", jobId, [bundleId, evidencePack.evidence_pack_id], { stage: degradedReasons.length > 0 ? "degraded" : "completed", verification_status: verificationStatus })
    );
    const lineageEdges: LineageEdge[] = [
      ...bundle.source_refs.map((sourceRef) => ({
        edge_id: id("edge", sourceRef, bundleId),
        from_ref: sourceRef,
        to_ref: bundleId,
        transform_ref: "transcription.ingest_and_extract",
        ai_suggestion_ref: "",
        ai_decision: "not_applicable" as const,
        template_ref: "",
        dataset_binding_ref: "",
        version_diff_ref: ""
      })),
      {
        edge_id: id("edge", bundleId, bundleArtifactId),
        from_ref: bundleId,
        to_ref: bundleArtifactId,
        transform_ref: "transcription.bundle.persist",
        ai_suggestion_ref: "",
        ai_decision: "not_applicable",
        template_ref: "",
        dataset_binding_ref: "",
        version_diff_ref: ""
      },
      {
        edge_id: id("edge", bundleId, verificationGate.gate_id),
        from_ref: bundleId,
        to_ref: verificationGate.gate_id,
        transform_ref: "transcription.exactness_gate",
        ai_suggestion_ref: "",
        ai_decision: "not_applicable",
        template_ref: "",
        dataset_binding_ref: "",
        version_diff_ref: ""
      },
      ...globalDisagreements.map((disagreement) => ({
        edge_id: id("edge", disagreement.source_ref, disagreement.disagreement_id),
        from_ref: disagreement.source_ref,
        to_ref: disagreement.disagreement_id,
        transform_ref: "transcription.disagreement.detect",
        ai_suggestion_ref: "",
        ai_decision: "not_applicable" as const,
        template_ref: "",
        dataset_binding_ref: "",
        version_diff_ref: ""
      }))
    ];
    const libraryAsset = LibraryAssetSchema.parse({
      contract: contractEnvelope("library"),
      asset_id: id("library", bundleId),
      asset_type: "dataset",
      source: bundleArtifactId,
      tags: ["transcription", "extraction", "queryable"],
      version: "1.0.0",
      tenant_scope: "workspace",
      permission_scope: makePermissionScope(),
      reuse_policy: "free",
      dependency_refs: [bundleArtifactId, summaryArtifactId],
      created_at: timestamp,
      updated_at: timestamp
    });
    return this.store.persistWorkflow({
      bundle,
      bundleArtifact,
      transcriptArtifact,
      extractionArtifact,
      summaryArtifact,
      canonical,
      job,
      evidencePack,
      auditEvents,
      lineageEdges,
      libraryAsset,
      reportHandoff,
      queryDataset
    });
  }

  compareBundles(input: CompareRequest): TranscriptionCompareBundle {
    const request = CompareRequestSchema.parse(input);
    const left = this.store.loadBundle(request.left_bundle_ref);
    const right = this.store.loadBundle(request.right_bundle_ref);
    const leftValues = new Set([...left.entities.map((entity) => entity.normalized_value), ...left.fields.map((field) => `${field.field_name}:${field.normalized_value}`)]);
    const rightValues = new Set([...right.entities.map((entity) => entity.normalized_value), ...right.fields.map((field) => `${field.field_name}:${field.normalized_value}`)]);
    const added = [...rightValues].filter((value) => !leftValues.has(value));
    const removed = [...leftValues].filter((value) => !rightValues.has(value));
    const changed = [...new Set([...added, ...removed])];
    const compareId = id("compare", request.left_bundle_ref, request.right_bundle_ref);
    const diffArtifactId = id("artifact", compareId, "diff");
    const compareResult = TranscriptionCompareResultSchema.parse({
      schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
      schema_version: TRANSCRIPTION_SCHEMA_VERSION,
      compare_id: compareId,
      compare_kind: "bundle_to_bundle",
      left_ref: request.left_bundle_ref,
      right_ref: request.right_bundle_ref,
      added_refs: added,
      removed_refs: removed,
      changed_refs: changed,
      missing_in_left: added,
      missing_in_right: removed,
      summary: `${right.bundle_id} adds ${added.length} values and misses ${removed.length} values relative to ${left.bundle_id}.`,
      detail_rows: [...added.map((value) => ({ change: "added", value })), ...removed.map((value) => ({ change: "removed", value }))],
      diff_artifact_ref: diffArtifactId,
      evidence_refs: [id("evidence", compareId)],
      created_by: request.actor_ref,
      created_at: now()
    });
    const diffArtifact = ArtifactSchema.parse({
      contract: contractEnvelope("artifact"),
      artifact_id: diffArtifactId,
      artifact_type: "workflow_output",
      artifact_subtype: "transcription_compare",
      project_id: right.project_id,
      workspace_id: right.workspace_id,
      source_refs: [...new Set([...left.source_refs, ...right.source_refs])],
      parent_artifact_refs: [left.artifact_ref, right.artifact_ref],
      canonical_ref: right.canonical_ref,
      created_by: request.actor_ref,
      created_at: now(),
      mode: "advanced",
      editable_status: "non_editable",
      template_status: "none",
      lineage_ref: id("lineage", compareId),
      evidence_ref: id("evidence", compareId),
      verification_status: "verified",
      storage_ref: makeStorageRef("compare", compareId, "workspace"),
      preview_ref: { preview_id: id("preview", compareId), preview_type: "html_canvas", storage_ref: id("storage", "compare", compareId) },
      export_refs: [],
      version_ref: { version_id: id("version", compareId), parent_version_id: null, version_number: 1, semantic_version: "1.0.0" },
      tenant_ref: request.tenant_ref,
      permission_scope: makePermissionScope()
    });
    const evidencePack = EvidencePackSchema.parse({
      contract: contractEnvelope("evidence"),
      evidence_pack_id: id("evidence", compareId),
      verification_status: "verified",
      source_refs: diffArtifact.source_refs,
      generated_artifact_refs: [diffArtifactId],
      checks_executed: [
        { check_id: id("check", compareId, "diff"), check_name: "compare_diff_check", check_type: "compare", passed: true, severity: "medium", details: "Bundle comparison diff was generated.", impacted_refs: [diffArtifactId] },
        { check_id: id("check", compareId, "lineage"), check_name: "comparison_lineage_check", check_type: "compare", passed: true, severity: "medium", details: "Comparison lineage links were produced.", impacted_refs: [compareId] }
      ],
      before_refs: [left.bundle_id],
      after_refs: [right.bundle_id],
      metrics: [{ metric_name: "changed_values", metric_value: changed.length, metric_unit: "values" }],
      warnings: [],
      failure_reasons: [],
      degraded_reasons: [],
      replay_context: { action_id: "transcription.compare.v1", compare_id: compareId },
      reproducibility_metadata: { replay_token: id("replay", compareId), execution_seed: `${left.bundle_id}:${right.bundle_id}`, environment_stamp: "rasid-platform-core", tool_versions: [{ tool: "transcription-extraction-engine", version: "1.0.0" }] },
      strict_evidence_level: "standard"
    });
    const job = JobSchema.parse({
      contract: contractEnvelope("job"),
      job_id: id("job", compareId),
      capability: TRANSCRIPTION_CAPABILITY_ID,
      requested_mode: "advanced",
      capability_submode: "compare",
      source_refs: diffArtifact.source_refs,
      artifact_refs: [diffArtifactId],
      progress: 100,
      stage: "compare",
      state: "completed",
      warnings: [],
      failure_reason: null,
      retry_policy: { max_attempts: 1, strategy: "fixed", backoff_ms: 0 },
      evidence_ref: evidencePack.evidence_pack_id,
      started_at: now(),
      finished_at: now(),
      resource_profile: { cpu_class: "standard", memory_class: "small", io_class: "balanced", expected_parallelism: 1 }
    });
    const auditEvents = [createAuditEvent(request.tenant_ref, request.workspace_id, request.actor_ref, "transcription.compare.v1", job.job_id, [compareId], { left_bundle_ref: left.bundle_id, right_bundle_ref: right.bundle_id })];
    const lineageEdges: LineageEdge[] = [
      { edge_id: id("edge", left.bundle_id, compareId), from_ref: left.bundle_id, to_ref: diffArtifactId, transform_ref: "transcription.compare", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: "", dataset_binding_ref: "", version_diff_ref: compareId },
      { edge_id: id("edge", right.bundle_id, compareId), from_ref: right.bundle_id, to_ref: diffArtifactId, transform_ref: "transcription.compare", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: "", dataset_binding_ref: "", version_diff_ref: compareId }
    ];
    return this.store.persistCompare(job.job_id, { compareResult, diffArtifact, job, evidencePack, auditEvents, lineageEdges });
  }

  answerQuestion(input: TranscriptionQuestionRequest): TranscriptionQuestionAnswer {
    const question = TranscriptionQuestionRequestSchema.parse(input);
    const bundles = question.bundle_refs.map((bundleRef) => this.store.loadBundle(bundleRef));
    const mergedBundle = bundles.reduce<UnifiedContentBundle>(
      (accumulator, bundle) =>
        UnifiedContentBundleSchema.parse({
          ...accumulator,
          bundle_id: `${accumulator.bundle_id}--${bundle.bundle_id}`,
          source_refs: [...new Set([...accumulator.source_refs, ...bundle.source_refs])],
          sources: [...accumulator.sources, ...bundle.sources],
          speakers: [...accumulator.speakers, ...bundle.speakers],
          sections: [...accumulator.sections, ...bundle.sections],
          segments: [...accumulator.segments, ...bundle.segments],
          aligned_words: [...accumulator.aligned_words, ...bundle.aligned_words],
          disagreements: [...accumulator.disagreements, ...bundle.disagreements],
          on_screen_text: [...accumulator.on_screen_text, ...bundle.on_screen_text],
          verification_gate: bundle.verification_gate,
          tables: [...accumulator.tables, ...bundle.tables],
          fields: [...accumulator.fields, ...bundle.fields],
          entities: [...accumulator.entities, ...bundle.entities],
          summaries: [...accumulator.summaries, ...bundle.summaries],
          qa_seeds: [...accumulator.qa_seeds, ...bundle.qa_seeds],
          action_items: [...accumulator.action_items, ...bundle.action_items],
          semantic_nodes: [...accumulator.semantic_nodes, ...bundle.semantic_nodes],
          semantic_edges: [...accumulator.semantic_edges, ...bundle.semantic_edges],
          field_map: { ...accumulator.field_map, ...bundle.field_map },
          evidence_refs: [...new Set([...accumulator.evidence_refs, ...bundle.evidence_refs])],
          lineage_refs: [...new Set([...accumulator.lineage_refs, ...bundle.lineage_refs])],
          relations: [...accumulator.relations, ...bundle.relations],
          updated_at: now()
        }),
      UnifiedContentBundleSchema.parse({
        contract: TRANSCRIPTION_CONTRACT,
        schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
        schema_version: TRANSCRIPTION_SCHEMA_VERSION,
        bundle_id: "question-merge",
        capability_id: TRANSCRIPTION_CAPABILITY_ID,
        tenant_ref: bundles[0]?.tenant_ref ?? "tenant-default",
        workspace_id: question.workspace_id,
        project_id: bundles[0]?.project_id ?? "project-default",
        artifact_ref: "",
        canonical_ref: "",
        transcript_artifact_ref: "",
        extraction_artifact_ref: "",
        summary_artifact_ref: "",
        source_refs: [],
        sources: [],
        speakers: [],
        sections: [],
        segments: [],
        aligned_words: [],
        disagreements: [],
        on_screen_text: [],
        verification_gate: {
          schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE,
          schema_version: TRANSCRIPTION_SCHEMA_VERSION,
          gate_id: "question-merge-verification",
          exact: false,
          verification_score: 0.5,
          alignment_pass: false,
          subtitle_detection_pass: false,
          on_screen_ocr_applied: false,
          unresolved_disagreement_refs: [],
          warning_codes: [],
          summary: "Question merge bundle has no standalone verification gate.",
          checked_at: now()
        },
        tables: [],
        fields: [],
        entities: [],
        summaries: [],
        qa_seeds: [],
        action_items: [],
        semantic_nodes: [],
        semantic_edges: [],
        field_map: {},
        metadata: {},
        evidence_refs: [],
        lineage_refs: [],
        language_profile: { schema_namespace: TRANSCRIPTION_SCHEMA_NAMESPACE, schema_version: TRANSCRIPTION_SCHEMA_VERSION, primary_language: "en", detected_languages: ["en"], rtl: false, language_confidence: 0.5 },
        relations: [],
        report_ready_handoff_ref: null,
        query_ready: true,
        created_by: question.actor_ref,
        created_at: now(),
        updated_at: now()
      })
    );
    const answer = buildQuestionAnswer(mergedBundle, question);
    this.store.persistQuestionAnswer(question.bundle_refs[0] ?? "question", answer);
    return answer;
  }
}

const transcriptionToolToActionMap: Record<string, string> = {
  "registry.transcription.ingest_and_extract": "transcription.ingest_and_extract.v1",
  "registry.transcription.compare": "transcription.compare.v1",
  "registry.transcription.answer_question": "transcription.answer_question.v1"
};

export const dispatchTranscriptionAction = async (input: z.infer<typeof TranscriptionDispatchRequestSchema>): Promise<unknown> => {
  const request = TranscriptionDispatchRequestSchema.parse(input);
  const engine = new TranscriptionExtractionEngine({ storageDir: request.storage_dir });
  switch (request.action_id) {
    case "transcription.ingest_and_extract.v1":
      return engine.ingestAndExtract(request.payload as TranscriptionJobRequest);
    case "transcription.compare.v1":
      return engine.compareBundles(request.payload as CompareRequest);
    case "transcription.answer_question.v1":
      return engine.answerQuestion(request.payload as TranscriptionQuestionRequest);
    default:
      throw new Error(`Unsupported transcription action: ${request.action_id}`);
  }
};

export const dispatchTranscriptionTool = async (input: z.infer<typeof TranscriptionToolDispatchRequestSchema>): Promise<unknown> => {
  const request = TranscriptionToolDispatchRequestSchema.parse(input);
  const actionId = transcriptionToolToActionMap[request.tool_id];
  if (!actionId) {
    throw new Error(`Unsupported transcription tool: ${request.tool_id}`);
  }
  return dispatchTranscriptionAction({
    action_id: actionId,
    payload: request.payload,
    storage_dir: request.storage_dir
  });
};

export const registerTranscriptionCapability = (runtime: RegistryBootstrap): void => {
  const actions = ActionRegistry.filter((action) => action.capability === TRANSCRIPTION_CAPABILITY_ID);
  const tools = ToolRegistry.filter((tool) => tool.owner_capability === TRANSCRIPTION_CAPABILITY_ID);
  runtime.registerCapability({
    capability_id: TRANSCRIPTION_CAPABILITY_ID,
    display_name: "Transcription & Extraction Engine",
    package_name: "@rasid/transcription-extraction-engine",
    contract_version: "1.0.0",
    supported_action_refs: actions.map((action) => action.action_id),
    supported_tool_refs: tools.map((tool) => tool.tool_id)
  });
  runtime.registerManifest(createActionManifest(TRANSCRIPTION_CAPABILITY_ID, "1.0.0", actions, ["approval.transcription"], ["evidence.transcription"]));
  tools.forEach((tool) => runtime.registerTool(tool));
  runtime.registerApprovalHook("approval.transcription", async () => ({ approval_state: "approved", reasons: ["transcription_default"] }));
  runtime.registerEvidenceHook("evidence.transcription", async (pack) => EvidencePackSchema.parse(pack));
};
