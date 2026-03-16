import { z } from "zod";
import {
  ContractEnvelopeSchema,
  JsonSchemaRefSchema,
  PlatformModeSchema,
  RecordListSchema,
  StringListSchema,
  TimestampSchema,
  contractEnvelope
} from "./common";

export const TRANSCRIPTION_SCHEMA_NAMESPACE = "rasid.shared.transcription.v1" as const;
export const TRANSCRIPTION_SCHEMA_VERSION = "1.0.0" as const;
export const TRANSCRIPTION_CAPABILITY_ID = "transcription_extraction" as const;

export const transcriptionSchemaRef = (schemaId: string) =>
  JsonSchemaRefSchema.parse({
    schema_id: schemaId,
    schema_version: TRANSCRIPTION_SCHEMA_VERSION,
    uri: `schema://${schemaId}/${TRANSCRIPTION_SCHEMA_VERSION}`
  });

const transcriptionEntity = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      schema_namespace: z.literal(TRANSCRIPTION_SCHEMA_NAMESPACE),
      schema_version: z.literal(TRANSCRIPTION_SCHEMA_VERSION)
    })
    .extend(shape);

export const TranscriptionInputKindSchema = z.enum([
  "audio_file",
  "video_file",
  "scanned_document",
  "pdf",
  "image_text",
  "image_table",
  "mixed_attachment",
  "batch",
  "spreadsheet_file"
]);

export const TranscriptSegmentKindSchema = z.enum([
  "speech",
  "paragraph",
  "section",
  "table",
  "ocr_block",
  "caption",
  "summary"
]);

export const ExtractionEntityTypeSchema = z.enum([
  "person",
  "organization",
  "location",
  "date",
  "amount",
  "identifier",
  "classification",
  "named_value",
  "action_item",
  "topic",
  "other"
]);

export const SummaryLevelSchema = z.enum(["brief", "standard", "detailed", "executive"]);
export const ComparisonKindSchema = z.enum(["source_to_source", "bundle_to_bundle", "version_to_version"]);

export const IngestAttachmentSchema = transcriptionEntity({
  attachment_id: z.string(),
  file_name: z.string(),
  file_path: z.string().nullable(),
  content_base64: z.string().nullable(),
  media_type: z.string(),
  input_kind: TranscriptionInputKindSchema,
  external_ref: z.string().nullable(),
  batch_ref: z.string().nullable()
});

export const TranscriptionSourceSchema = transcriptionEntity({
  source_id: z.string(),
  attachment_ref: z.string().nullable(),
  file_name: z.string(),
  media_type: z.string(),
  input_kind: TranscriptionInputKindSchema,
  storage_ref: z.string(),
  source_artifact_ref: z.string(),
  file_size_bytes: z.number().int().nonnegative(),
  page_count: z.number().int().nonnegative().nullable(),
  duration_ms: z.number().int().nonnegative().nullable(),
  detected_language: z.string().nullable(),
  warning_codes: StringListSchema,
  ingested_at: TimestampSchema
});

export const TranscriptSpeakerSchema = transcriptionEntity({
  speaker_id: z.string(),
  display_name: z.string(),
  detection_method: z.enum(["provided", "heuristic", "single_speaker"]),
  confidence: z.number().min(0).max(1)
});

export const TranscriptSectionSchema = transcriptionEntity({
  section_id: z.string(),
  source_ref: z.string(),
  title: z.string(),
  section_kind: z.enum(["cover", "body", "table", "appendix", "summary", "transcript", "unknown"]),
  page_ref: z.string().nullable(),
  segment_refs: StringListSchema,
  order_index: z.number().int().nonnegative(),
  heading_level: z.number().int().nonnegative(),
  bbox: z.array(z.number()).length(4).nullable()
});

export const TranscriptSegmentSchema = transcriptionEntity({
  segment_id: z.string(),
  source_ref: z.string(),
  segment_kind: TranscriptSegmentKindSchema,
  section_ref: z.string().nullable(),
  speaker_ref: z.string().nullable(),
  order_index: z.number().int().nonnegative(),
  text: z.string(),
  normalized_text: z.string(),
  language: z.string(),
  confidence: z.number().min(0).max(1),
  start_ms: z.number().int().nonnegative().nullable(),
  end_ms: z.number().int().nonnegative().nullable(),
  paragraph_index: z.number().int().nonnegative(),
  page_number: z.number().int().nonnegative().nullable(),
  bbox: z.array(z.number()).length(4).nullable(),
  evidence_ref: z.string(),
  lineage_ref: z.string()
});

export const AlignedWordSchema = transcriptionEntity({
  word_id: z.string(),
  source_ref: z.string(),
  segment_ref: z.string().nullable(),
  speaker_ref: z.string().nullable(),
  text: z.string(),
  normalized_text: z.string(),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  evidence_ref: z.string(),
  lineage_ref: z.string()
});

export const DisagreementSpanSchema = transcriptionEntity({
  disagreement_id: z.string(),
  source_ref: z.string(),
  disagreement_type: z.enum(["asr_vs_ocr", "alignment_gap", "speaker_gap", "normalization_gap", "verification_gap"]),
  text: z.string(),
  start_ms: z.number().int().nonnegative().nullable(),
  end_ms: z.number().int().nonnegative().nullable(),
  page_number: z.number().int().nonnegative().nullable(),
  severity: z.enum(["low", "medium", "high"]),
  resolution_status: z.enum(["open", "resolved", "accepted"]),
  evidence_ref: z.string()
});

export const OnScreenTextObservationSchema = transcriptionEntity({
  observation_id: z.string(),
  source_ref: z.string(),
  frame_ref: z.string(),
  text: z.string(),
  normalized_text: z.string(),
  start_ms: z.number().int().nonnegative().nullable(),
  end_ms: z.number().int().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
  subtitle_candidate: z.boolean(),
  bbox: z.array(z.number()).length(4).nullable(),
  evidence_ref: z.string()
});

export const TranscriptionVerificationGateSchema = transcriptionEntity({
  gate_id: z.string(),
  exact: z.boolean(),
  verification_score: z.number().min(0).max(1),
  alignment_pass: z.boolean(),
  subtitle_detection_pass: z.boolean(),
  on_screen_ocr_applied: z.boolean(),
  unresolved_disagreement_refs: z.array(z.string()),
  warning_codes: StringListSchema,
  summary: z.string(),
  checked_at: TimestampSchema
});

export const ExtractedFieldSchema = transcriptionEntity({
  field_id: z.string(),
  source_ref: z.string(),
  field_name: z.string(),
  field_value: z.string(),
  normalized_value: z.string(),
  value_type: z.enum(["string", "number", "date", "currency", "boolean", "table", "list"]),
  confidence: z.number().min(0).max(1),
  segment_ref: z.string().nullable(),
  page_number: z.number().int().nonnegative().nullable(),
  evidence_ref: z.string()
});

export const ExtractedEntitySchema = transcriptionEntity({
  entity_id: z.string(),
  source_ref: z.string(),
  entity_type: ExtractionEntityTypeSchema,
  display_value: z.string(),
  normalized_value: z.string(),
  confidence: z.number().min(0).max(1),
  segment_ref: z.string().nullable(),
  field_ref: z.string().nullable(),
  page_number: z.number().int().nonnegative().nullable(),
  evidence_ref: z.string()
});

export const ExtractedTableSchema = transcriptionEntity({
  table_id: z.string(),
  source_ref: z.string(),
  title: z.string(),
  page_number: z.number().int().nonnegative().nullable(),
  row_count: z.number().int().nonnegative(),
  column_count: z.number().int().nonnegative(),
  headers: StringListSchema,
  rows: z.array(z.array(z.string())),
  bbox: z.array(z.number()).length(4).nullable(),
  extraction_method: z.enum(["pdf_text", "ocr_table", "spreadsheet_parser"]),
  evidence_ref: z.string()
});

export const SummarySchema = transcriptionEntity({
  summary_id: z.string(),
  source_refs: z.array(z.string()),
  level: SummaryLevelSchema,
  title: z.string(),
  summary_text: z.string(),
  bullet_points: StringListSchema,
  evidence_refs: StringListSchema
});

export const QuestionSeedSchema = transcriptionEntity({
  seed_id: z.string(),
  source_refs: z.array(z.string()),
  question: z.string(),
  answer_seed: z.string(),
  supporting_segment_refs: StringListSchema,
  confidence: z.number().min(0).max(1)
});

export const ActionItemSchema = transcriptionEntity({
  action_item_id: z.string(),
  source_ref: z.string(),
  description: z.string(),
  owner_hint: z.string().nullable(),
  due_date_hint: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  supporting_segment_refs: StringListSchema
});

export const SemanticNodeSchema = transcriptionEntity({
  node_id: z.string(),
  node_type: z.enum(["source", "section", "segment", "field", "entity", "table", "summary", "question_seed"]),
  label: z.string(),
  source_ref: z.string().nullable(),
  metadata: z.record(z.unknown())
});

export const SemanticEdgeSchema = transcriptionEntity({
  edge_id: z.string(),
  from_ref: z.string(),
  to_ref: z.string(),
  relation_type: z.enum(["contains", "mentions", "supports", "answers", "relates_to", "differs_from", "derived_from"]),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown())
});

export const FileRelationSchema = transcriptionEntity({
  relation_id: z.string(),
  left_source_ref: z.string(),
  right_source_ref: z.string(),
  relation_kind: z.enum(["shared_entities", "shared_fields", "shared_topics", "missing_values", "comparison_pair"]),
  shared_refs: StringListSchema,
  summary: z.string()
});

export const TranscriptionLanguageProfileSchema = transcriptionEntity({
  primary_language: z.string(),
  detected_languages: StringListSchema,
  rtl: z.boolean(),
  language_confidence: z.number().min(0).max(1)
});

export const UnifiedContentBundleSchema = z.object({
  contract: ContractEnvelopeSchema,
  schema_namespace: z.literal(TRANSCRIPTION_SCHEMA_NAMESPACE),
  schema_version: z.literal(TRANSCRIPTION_SCHEMA_VERSION),
  bundle_id: z.string(),
  capability_id: z.literal(TRANSCRIPTION_CAPABILITY_ID),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  artifact_ref: z.string(),
  canonical_ref: z.string(),
  transcript_artifact_ref: z.string(),
  extraction_artifact_ref: z.string(),
  summary_artifact_ref: z.string(),
  source_refs: StringListSchema,
  sources: z.array(TranscriptionSourceSchema),
  speakers: z.array(TranscriptSpeakerSchema),
  sections: z.array(TranscriptSectionSchema),
  segments: z.array(TranscriptSegmentSchema),
  aligned_words: z.array(AlignedWordSchema),
  disagreements: z.array(DisagreementSpanSchema),
  on_screen_text: z.array(OnScreenTextObservationSchema),
  verification_gate: TranscriptionVerificationGateSchema,
  tables: z.array(ExtractedTableSchema),
  fields: z.array(ExtractedFieldSchema),
  entities: z.array(ExtractedEntitySchema),
  summaries: z.array(SummarySchema),
  qa_seeds: z.array(QuestionSeedSchema),
  action_items: z.array(ActionItemSchema),
  semantic_nodes: z.array(SemanticNodeSchema),
  semantic_edges: z.array(SemanticEdgeSchema),
  field_map: z.record(z.array(z.string())),
  metadata: z.record(z.unknown()),
  evidence_refs: StringListSchema,
  lineage_refs: StringListSchema,
  language_profile: TranscriptionLanguageProfileSchema,
  relations: z.array(FileRelationSchema),
  report_ready_handoff_ref: z.string().nullable(),
  query_ready: z.boolean(),
  created_by: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const TranscriptionCompareResultSchema = transcriptionEntity({
  compare_id: z.string(),
  compare_kind: ComparisonKindSchema,
  left_ref: z.string(),
  right_ref: z.string(),
  added_refs: StringListSchema,
  removed_refs: StringListSchema,
  changed_refs: StringListSchema,
  missing_in_left: StringListSchema,
  missing_in_right: StringListSchema,
  summary: z.string(),
  detail_rows: RecordListSchema,
  diff_artifact_ref: z.string(),
  evidence_refs: StringListSchema,
  created_by: z.string(),
  created_at: TimestampSchema
});

export const TranscriptionQuestionRequestSchema = transcriptionEntity({
  question_id: z.string(),
  workspace_id: z.string(),
  actor_ref: z.string(),
  bundle_refs: z.array(z.string()),
  question: z.string(),
  compare_mode: z.boolean(),
  requested_at: TimestampSchema
});

export const TranscriptionQuestionAnswerSchema = transcriptionEntity({
  answer_id: z.string(),
  question_ref: z.string(),
  answer_text: z.string(),
  matched_segment_refs: StringListSchema,
  matched_field_refs: StringListSchema,
  matched_entity_refs: StringListSchema,
  cited_source_refs: StringListSchema,
  confidence: z.number().min(0).max(1),
  created_at: TimestampSchema
});

export const TranscriptionJobRequestSchema = transcriptionEntity({
  request_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  mode: PlatformModeSchema,
  attachments: z.array(IngestAttachmentSchema).min(1),
  options: z.object({
    language_hint: z.string().nullable(),
    enable_ocr: z.boolean(),
    enable_table_extraction: z.boolean(),
    enable_qa_seeds: z.boolean(),
    enable_comparisons: z.boolean()
  }),
  requested_at: TimestampSchema
});

export const TRANSCRIPTION_CONTRACT = contractEnvelope("transcription");

export type IngestAttachment = z.infer<typeof IngestAttachmentSchema>;
export type TranscriptionSource = z.infer<typeof TranscriptionSourceSchema>;
export type TranscriptSpeaker = z.infer<typeof TranscriptSpeakerSchema>;
export type TranscriptSection = z.infer<typeof TranscriptSectionSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type AlignedWord = z.infer<typeof AlignedWordSchema>;
export type DisagreementSpan = z.infer<typeof DisagreementSpanSchema>;
export type OnScreenTextObservation = z.infer<typeof OnScreenTextObservationSchema>;
export type TranscriptionVerificationGate = z.infer<typeof TranscriptionVerificationGateSchema>;
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type ExtractedTable = z.infer<typeof ExtractedTableSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type QuestionSeed = z.infer<typeof QuestionSeedSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type SemanticNode = z.infer<typeof SemanticNodeSchema>;
export type SemanticEdge = z.infer<typeof SemanticEdgeSchema>;
export type FileRelation = z.infer<typeof FileRelationSchema>;
export type UnifiedContentBundle = z.infer<typeof UnifiedContentBundleSchema>;
export type TranscriptionCompareResult = z.infer<typeof TranscriptionCompareResultSchema>;
export type TranscriptionQuestionRequest = z.infer<typeof TranscriptionQuestionRequestSchema>;
export type TranscriptionQuestionAnswer = z.infer<typeof TranscriptionQuestionAnswerSchema>;
export type TranscriptionJobRequest = z.infer<typeof TranscriptionJobRequestSchema>;
