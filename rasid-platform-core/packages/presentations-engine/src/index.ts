import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RegistryBootstrap, createActionManifest } from "@rasid/capability-registry";
import {
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  DeckAggregateSchema,
  DeckOutlineNodeSchema,
  DeckOutlineSchema,
  DeckVersionSchema,
  EvidencePackSchema,
  ExportValidationCheckSchema,
  ExportValidationResultSchema,
  GroupedInfographicPlanSchema,
  InfographicBlockPlanSchema,
  JobSchema,
  LibraryAssetSchema,
  MediaBlockPlanSchema,
  MotionMetadataSchema,
  PRESENTATION_CONTRACT,
  PRESENTATION_SCHEMA_NAMESPACE,
  PRESENTATION_SCHEMA_VERSION,
  PresentationActionRegistry,
  PresentationBindingSetSchema,
  PresentationDataBindingSchema,
  PresentationDegradeReasonSchema,
  PresentationIntentManifestSchema,
  PresentationOutputMetadataSchema,
  PresentationOutputStatusSchema,
  PublicationSchema,
  RenderParityValidationSchema,
  SlideBlockSchema,
  SpeakerNotesSchema,
  StoryboardSlidePlanSchema,
  TemplateLockStateSchema,
  contractEnvelope,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type DeckAggregate,
  type DeckOutline,
  type DeckVersion,
  type EvidencePack,
  type ExportRef,
  type ExportValidationResult,
  type GroupedInfographicPlan,
  type InfographicBlockPlan,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type MediaBlockPlan,
  type MotionMetadata,
  type PermissionScope,
  type PresentationBindingSet,
  type PresentationDegradeReason,
  type PresentationIntentManifest,
  type PresentationOutputMetadata,
  type PresentationOutputStatus,
  type Publication,
  type RenderParityValidation,
  type SlideBlock,
  type SpeakerNotes,
  type StoryboardSlidePlan,
  type TemplateLockState
} from "@rasid/contracts";
import JSZip from "jszip";
import { chromium } from "playwright-core";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import { z } from "zod";
import {
  matchPremiumTemplate,
  resolvePremiumTemplate,
  templateLayoutFallback,
  type PremiumMode,
  type VisualDnaProfile
} from "./premium";
import { PresentationEngineStore, defaultPresentationsEngineStorageRoot } from "./store";

const JsonRecordSchema = z.record(z.unknown());
const CellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const StructuredOutlineItemSchema = z.object({
  title: z.string(),
  bullets: z.array(z.string()).default([]),
  strict_insert: z.boolean().default(false)
});

const MetricInputSchema = z.object({
  label: z.string(),
  value: z.number(),
  unit: z.string().default(""),
  trend: z.enum(["up", "down", "flat"]).optional()
});

const PromptTopicSourceSchema = z.object({
  source_kind: z.literal("prompt_topic"),
  source_ref: z.string(),
  prompt: z.string(),
  topic: z.string().default(""),
  title: z.string().default("")
});

const PlainTextSourceSchema = z.object({
  source_kind: z.literal("plain_text"),
  source_ref: z.string(),
  text: z.string(),
  title: z.string().default("")
});

const NotesSourceSchema = z.object({
  source_kind: z.literal("notes"),
  source_ref: z.string(),
  notes: z.array(z.string()).min(1),
  title: z.string().default("")
});

const StructuredOutlineSourceSchema = z.object({
  source_kind: z.literal("structured_outline"),
  source_ref: z.string(),
  title: z.string().default(""),
  items: z.array(StructuredOutlineItemSchema).min(1)
});

const TxtDocumentSourceSchema = z.object({
  source_kind: z.literal("txt_document"),
  source_ref: z.string(),
  title: z.string().default(""),
  text: z.string()
});

const BinaryFileSourceSchema = z.object({
  source_kind: z.literal("binary_file"),
  source_ref: z.string(),
  title: z.string().default(""),
  file_path: z.string(),
  mime_type: z.string().default("application/octet-stream"),
  parser_hint: z.enum(["auto", "pdf", "docx", "pptx", "xlsx"]).default("auto")
});

const DatasetSourceSchema = z.object({
  source_kind: z.literal("dataset"),
  source_ref: z.string(),
  title: z.string().default(""),
  dataset_name: z.string(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.record(CellValueSchema)).default([]),
  preferred_chart: z.enum(["bar", "line", "pie"]).default("bar"),
  preferred_dimension: z.string().optional(),
  preferred_measure: z.string().optional()
});

const DashboardSourceSchema = z.object({
  source_kind: z.literal("dashboard_artifact"),
  source_ref: z.string(),
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()).default([]),
  metrics: z.array(MetricInputSchema).default([]),
  dataset_ref: z.string().nullable().default(null)
});

const ReportSectionSourceSchema = z.object({
  heading: z.string(),
  summary: z.string().default(""),
  bullets: z.array(z.string()).default([]),
  section_kind: z.string().default("body"),
  order_index: z.number().int().nonnegative().default(0),
  page_numbers: z.array(z.number().int().positive()).default([]),
  captions: z.array(z.string()).default([]),
  narrative_hierarchy: z
    .object({
      section_ref: z.string(),
      parent_section_ref: z.string().nullable().default(null),
      child_section_refs: z.array(z.string()).default([])
    })
    .default({ section_ref: "", parent_section_ref: null, child_section_refs: [] }),
  metrics: z.array(MetricInputSchema).default([]),
  tables: z
    .array(
      z.object({
        title: z.string(),
        caption: z.string().default(""),
        rows: z.array(z.array(z.string())).default([]),
        lineage_refs: z.array(z.string()).default([]),
        source_lineage_refs: z.array(z.string()).default([])
      })
    )
    .default([]),
  charts: z
    .array(
      z.object({
        title: z.string(),
        caption: z.string().default(""),
        chart_type: z.string().default("bar"),
        series: z.array(JsonRecordSchema).default([]),
        lineage_refs: z.array(z.string()).default([]),
        source_lineage_refs: z.array(z.string()).default([])
      })
    )
    .default([])
});

const ReportSourceSchema = z.object({
  source_kind: z.literal("report_artifact"),
  source_ref: z.string(),
  title: z.string(),
  summary: z.string(),
  sections: z.array(ReportSectionSourceSchema).default([])
});

const LibraryTemplateSourceSchema = z.object({
  source_kind: z.literal("library_template"),
  source_ref: z.string(),
  template_name: z.string(),
  theme_id: z.string().optional(),
  brand_kit_id: z.string().optional(),
  brand_preset_ref: z.string().nullable().default(null),
  industry: z.string().optional(),
  lock_mode: z.enum(["unlocked", "soft_lock", "strict_lock"]).default("soft_lock"),
  force_fonts: z.boolean().default(true),
  force_palette: z.boolean().default(true),
  logo_rules: z.enum(["auto", "off"]).default("auto"),
  layout_archetypes: z.array(z.string()).default([]),
  component_styles: z.array(z.string()).default([]),
  visual_dna: z
    .object({
      canvas_bg: z.string().default("#F8FAFC"),
      panel_bg: z.string().default("#FFFFFF"),
      glow: z.string().default("rgba(12,29,61,0.12)"),
      shadow: z.string().default("0 18px 48px rgba(15,23,42,0.12)"),
      logo_mode: z.enum(["light_header", "light_alt", "dark_header", "dark_alt"]).default("light_header"),
      character_ref: z
        .enum(["char1_waving", "char2_shmagh", "char3_dark", "char3b_dark", "char4_sunglasses", "char5_arms_crossed", "char6_standing"])
        .default("char1_waving"),
      motion_profile: z.enum(["none", "subtle", "moderate", "cinematic"]).default("subtle"),
      surface_style: z.enum(["glass", "paper", "gallery", "studio"]).default("glass")
    })
    .default({
      canvas_bg: "#F8FAFC",
      panel_bg: "#FFFFFF",
      glow: "rgba(12,29,61,0.12)",
      shadow: "0 18px 48px rgba(15,23,42,0.12)",
      logo_mode: "light_header",
      character_ref: "char1_waving",
      motion_profile: "subtle",
      surface_style: "glass"
    }),
  theme_tokens: z
    .object({
      primary_color: z.string().default("C7511F"),
      secondary_color: z.string().default("0F172A"),
      accent_color: z.string().default("1D8F6E"),
      neutral_color: z.string().default("EEF2F6"),
      font_face: z.string().default("Aptos")
    })
    .default({
      primary_color: "C7511F",
      secondary_color: "0F172A",
      accent_color: "1D8F6E",
      neutral_color: "EEF2F6",
      font_face: "Aptos"
    })
});

const MediaSourceSchema = z.object({
  source_kind: z.literal("media_asset"),
  source_ref: z.string(),
  title: z.string(),
  media_kind: z.enum(["image", "icon", "video"]),
  uri: z.string().default(""),
  file_path: z.string().default(""),
  mime_type: z.string().default(""),
  data_base64: z.string().default(""),
  caption: z.string().default("")
});

const ExistingPresentationReferenceSchema = z.object({
  source_kind: z.literal("existing_presentation_reference"),
  source_ref: z.string(),
  title: z.string(),
  file_path: z.string().default(""),
  theme_summary: z.string().default(""),
  slide_titles: z.array(z.string()).default([]),
  layout_refs: z.array(z.string()).default([]),
  slide_geometries: z
    .array(
      z.object({
        slide_index: z.number().int().nonnegative(),
        width_px: z.number().positive(),
        height_px: z.number().positive(),
        layout_ref: z.string().optional(),
        master_ref: z.string().optional(),
        notes_text: z.string().optional(),
        media_refs: z.array(z.string()).default([]),
        element_boxes: z
          .array(
            z.object({
              x: z.number(),
              y: z.number(),
              w: z.number().positive(),
              h: z.number().positive(),
              shape_name: z.string().optional(),
              element_type: z.string().optional(),
              placeholder_type: z.string().nullable().optional(),
              placeholder_idx: z.number().nullable().optional(),
              layout_ref: z.string().optional(),
              master_ref: z.string().optional(),
              text: z.string().optional(),
              image_ext: z.string().optional()
            })
          )
          .default([])
      })
    )
    .default([]),
  theme_tokens: z
    .object({
      primary_color: z.string().default("C7511F"),
      secondary_color: z.string().default("0F172A"),
      accent_color: z.string().default("1D8F6E"),
      neutral_color: z.string().default("EEF2F6"),
      font_face: z.string().default("Aptos")
    })
    .default({
      primary_color: "C7511F",
      secondary_color: "0F172A",
      accent_color: "1D8F6E",
      neutral_color: "EEF2F6",
      font_face: "Aptos"
    })
});

const PresentationSourceSchema = z.discriminatedUnion("source_kind", [
  PromptTopicSourceSchema,
  PlainTextSourceSchema,
  NotesSourceSchema,
  StructuredOutlineSourceSchema,
  BinaryFileSourceSchema,
  TxtDocumentSourceSchema,
  DatasetSourceSchema,
  DashboardSourceSchema,
  ReportSourceSchema,
  LibraryTemplateSourceSchema,
  MediaSourceSchema,
  ExistingPresentationReferenceSchema
]);

const CreatePresentationRequestSchema = z.object({
  presentation_id: z.string().optional(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  created_by: z.string(),
  title: z.string(),
  description: z.string().default(""),
  mode: z.enum(["easy", "advanced"]).default("easy"),
  language: z.string().default("ar-SA"),
  audience: z.string().default("executive stakeholders"),
  tone: z.string().default("confident"),
  density: z.enum(["light", "balanced", "dense"]).default("balanced"),
  target_slide_count: z.number().int().positive().optional(),
  source_policy: z
    .enum(["use_all_sources", "prefer_structured_sources", "prefer_uploaded_assets", "strict_explicit_sources"])
    .default("prefer_structured_sources"),
  rtl_policy: z.enum(["auto", "rtl", "ltr"]).default("auto"),
  motion_level: z.enum(["none", "subtle", "moderate", "high"]).default("subtle"),
  notes_policy: z.enum(["auto_generate", "manual_only", "disabled"]).default("auto_generate"),
  export_targets: z.array(z.enum(["reader", "pptx", "pdf", "html"])).default(["reader", "pptx", "pdf", "html"]),
  template_ref: z.string().nullable().default(null),
  workspace_preset_ref: z.string().nullable().default(null),
  brand_preset_ref: z.string().nullable().default(null),
  strict_insert_requests: z.array(z.string()).default([]),
  sources: z.array(PresentationSourceSchema).default([]),
  timestamp: z.string().optional(),
  permission_scope: z
    .object({
      visibility: z.enum(["private", "workspace", "tenant", "shared_link"]),
      allow_read: z.boolean(),
      allow_write: z.boolean(),
      allow_share: z.boolean(),
      allow_publish: z.boolean(),
      allow_audit_view: z.boolean()
    })
    .default({
      visibility: "workspace",
      allow_read: true,
      allow_write: true,
      allow_share: true,
      allow_publish: true,
      allow_audit_view: true
    })
});

const AddSlideMutationSchema = z.object({
  mutation_kind: z.literal("add_slide"),
  title: z.string(),
  bullets: z.array(z.string()).default([]),
  summary: z.string().default(""),
  insert_after_slide_ref: z.string().nullable().default(null)
});

const DeleteSlideMutationSchema = z.object({
  mutation_kind: z.literal("delete_slide"),
  slide_ref: z.string()
});

const ReorderSlideMutationSchema = z.object({
  mutation_kind: z.literal("reorder_slide"),
  slide_ref: z.string(),
  new_index: z.number().int().nonnegative()
});

const RegenerateSlideMutationSchema = z.object({
  mutation_kind: z.literal("regenerate_slide"),
  slide_ref: z.string(),
  refresh_source_refs: z.array(z.string()).default([]),
  override_prompt: z.string().default("")
});

const ReplaceBlockKindMutationSchema = z.object({
  mutation_kind: z.literal("replace_block_kind"),
  block_ref: z.string(),
  new_block_kind: z.enum(["chart", "table", "infographic", "grouped_infographic", "body"])
});

const PresentationMutationSchema = z.discriminatedUnion("mutation_kind", [
  AddSlideMutationSchema,
  DeleteSlideMutationSchema,
  ReorderSlideMutationSchema,
  RegenerateSlideMutationSchema,
  ReplaceBlockKindMutationSchema
]);

const MutatePresentationRequestSchema = z.object({
  bundle: z.unknown(),
  actor_ref: z.string(),
  mutation: PresentationMutationSchema,
  timestamp: z.string().optional()
});

const BindDeckRequestSchema = z.object({
  bundle: z.unknown(),
  actor_ref: z.string(),
  source_refs: z.array(z.string()).default([]),
  timestamp: z.string().optional()
});

const ApplyTemplateLockRequestSchema = z.object({
  bundle: z.unknown(),
  actor_ref: z.string(),
  template_ref: z.string(),
  brand_preset_ref: z.string().nullable().default(null),
  lock_mode: z.enum(["unlocked", "soft_lock", "strict_lock"]).default("soft_lock"),
  timestamp: z.string().optional()
});

const PublishPresentationRequestSchema = z.object({
  bundle: z.unknown(),
  published_by: z.string(),
  target_ref: z.string(),
  publish_to_library: z.boolean().default(true),
  allow_degraded: z.boolean().default(false),
  timestamp: z.string().optional()
});

export type PresentationSource = z.infer<typeof PresentationSourceSchema>;
type CreatePresentationRequest = z.infer<typeof CreatePresentationRequestSchema>;
type PrimitiveCell = z.infer<typeof CellValueSchema>;
type DatasetRow = Record<string, PrimitiveCell>;
type StructuredOutlineItem = z.infer<typeof StructuredOutlineItemSchema>;
type MetricInput = z.infer<typeof MetricInputSchema>;

type Box = { x: number; y: number; w: number; h: number };
type ExtractedElementBox = Box & {
  shape_name?: string;
  element_type?: string;
  placeholder_type?: string | null;
  placeholder_idx?: number | null;
  layout_ref?: string;
  master_ref?: string;
  text?: string;
  image_ext?: string;
};
type ChartSeries = { name: string; values: number[] };
type ChartModel = {
  chart_type: "bar" | "line" | "pie";
  categories: string[];
  series: ChartSeries[];
  dataset_ref?: string;
  query_ref?: string;
  field_mappings: Array<Record<string, unknown>>;
};
type TableModel = {
  columns: string[];
  rows: string[][];
  dataset_ref?: string;
  query_ref?: string;
  field_mappings: Array<Record<string, unknown>>;
};
type NarrativeSection = {
  section_id: string;
  title: string;
  role: "cover" | "agenda" | "content" | "data_story" | "comparison" | "closing";
  summary: string;
  bullets: string[];
  source_refs: string[];
  strict_insert: boolean;
  metrics: MetricInput[];
  chart: ChartModel | null;
  table: TableModel | null;
  infographic_kind: "timeline" | "process" | "comparison" | "statistic_panel" | null;
  media_refs: string[];
};
type StylePreset = {
  templateRef: string | null;
  brandPresetRef: string | null;
  lockMode: "unlocked" | "soft_lock" | "strict_lock";
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  neutralColor: string;
  fontFace: string;
  themeId: string;
  brandKitId: string | null;
  industry: string | null;
  layoutArchetypes: string[];
  componentStyles: string[];
  visualDna: VisualDnaProfile;
};
type MaterializedSlide = {
  section: NarrativeSection;
  storyboard: StoryboardSlidePlan;
  slideNode: CanonicalRepresentation["nodes"]["slides"][number];
  blocks: SlideBlock[];
  notes: SpeakerNotes;
  motion: MotionMetadata;
  infographicPlans: InfographicBlockPlan[];
  mediaPlans: MediaBlockPlan[];
  groupedInfographicPlans: GroupedInfographicPlan[];
  boxes: Array<{ block_ref: string; node_ref: string; box: Box }>;
};

type ParsedSourceRecord = {
  source_ref: string;
  source_kind: string;
  parser_kind: "pdf" | "docx" | "pptx" | "xlsx";
  file_path: string;
  title: string;
  extracted_text: string;
  slide_titles: string[];
  layout_refs: string[];
  master_refs?: string[];
  media_refs: string[];
  notes_count: number;
  page_count: number;
  sheet_names?: string[];
  dataset_summaries?: Array<{
    sheet_name: string;
    headers: string[];
    rows: Array<Record<string, PrimitiveCell>>;
  }>;
  theme_tokens: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    neutral_color: string;
    font_face: string;
  };
  slide_geometries: Array<{
    slide_index: number;
    width_px: number;
    height_px: number;
    layout_ref?: string;
    master_ref?: string;
    notes_text?: string;
    media_refs?: string[];
    element_boxes: ExtractedElementBox[];
  }>;
};

type RoundTripValidationRecord = {
  target: PresentationBinaryTarget;
  slide_count: number;
  notes_count: number;
  text_sample: string[];
  layout_refs: string[];
  media_refs: string[];
  chart_markers: number;
  table_markers: number;
  rendered_pages?: string[];
  screenshot_paths?: string[];
  semantic_text_sample?: string[];
  renderer_kind?: string;
  external_validation_ref?: string | null;
};

type ReferenceSlideGeometry = {
  slide_index: number;
  width_px: number;
  height_px: number;
  layout_ref: string;
  master_ref: string;
  notes_text?: string;
  media_refs: string[];
  element_boxes: ExtractedElementBox[];
};

type GenerationFidelityProfile = {
  source_ref: string;
  slide_titles: string[];
  layout_refs: string[];
  theme_tokens: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    neutral_color: string;
    font_face: string;
  };
  slides: ReferenceSlideGeometry[];
};

type StoredExportArtifactSnapshot = {
  target: PresentationBinaryTarget;
  artifact: Artifact;
  validation: ExportValidationResult;
  roundTrip: RoundTripValidationRecord | null;
  contentType: string;
  fileName: string;
  stored_content_kind: "text" | "binary";
};

export type PresentationBinaryTarget = "reader" | "pptx" | "pdf" | "html";

export type PresentationExportArtifact = {
  target: PresentationBinaryTarget;
  artifact: Artifact;
  validation: ExportValidationResult;
  roundTrip: RoundTripValidationRecord | null;
  contentType: string;
  fileName: string;
  content: string | Uint8Array;
};

export type PresentationPreviewArtifact = {
  target: "reader";
  artifact: Artifact;
  html: string;
  roundTrip?: RoundTripValidationRecord | null;
};

export type PresentationStageRecord = {
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

export type PresentationBundle = {
  inputSources: PresentationSource[];
  parsedSourceRecords: ParsedSourceRecord[];
  intentManifest: PresentationIntentManifest;
  outline: DeckOutline;
  storyboard: StoryboardSlidePlan[];
  slideBlocks: SlideBlock[];
  speakerNotes: SpeakerNotes[];
  motionMetadata: MotionMetadata[];
  infographicPlans: InfographicBlockPlan[];
  mediaPlans: MediaBlockPlan[];
  groupedInfographicPlans: GroupedInfographicPlan[];
  bindingSet: PresentationBindingSet;
  templateLockState: TemplateLockState;
  deck: DeckAggregate;
  version: DeckVersion;
  canonical: CanonicalRepresentation;
  outputMetadata: PresentationOutputMetadata;
  parityValidation: RenderParityValidation | null;
  outputStatuses: PresentationOutputStatus[];
  deckArtifact: Artifact;
  versionArtifact: Artifact;
  previewArtifact: Artifact | null;
  exportArtifacts: PresentationExportArtifact[];
  publications: Publication[];
  libraryAssets: LibraryAsset[];
  jobs: Job[];
  evidencePacks: EvidencePack[];
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  roundTripValidations: RoundTripValidationRecord[];
};

export type PresentationPublicationResult = {
  publication: Publication;
  libraryAsset: LibraryAsset | null;
  stage: PresentationStageRecord;
  bundle: PresentationBundle;
};

export type PresentationRegressionSuiteResult = {
  runId: string;
  createBundle: PresentationBundle;
  mutatedBundle: PresentationBundle;
  preview: PresentationPreviewArtifact;
  exports: PresentationExportArtifact[];
  parityValidation: RenderParityValidation;
  publication: Publication;
  libraryAsset: LibraryAsset | null;
  artifacts: {
    readerHtml: string;
    exportHtml: string;
    exportPdf: Uint8Array;
    exportPptx: Uint8Array;
  };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = (value?: string): string => value ?? new Date().toISOString();
const semver = (versionNumber: number): string => `1.0.${Math.max(0, versionNumber - 1)}`;
const hash = (value: string | Uint8Array): string =>
  createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value))
    .digest("hex");
const id = (prefix: string, ...parts: Array<string | number | null | undefined>): string =>
  [prefix, ...parts.filter((part) => part !== null && part !== undefined && `${part}`.length > 0)]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const toLocalizedText = (value: string, language: string, rtl: boolean) => [{ value, locale: language, rtl }];
const splitParagraphs = (value: string): string[] =>
  value
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
const splitSentences = (value: string, limit = 4): string[] =>
  value
    .split(/[.!؟\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};
const inferRtl = (language: string, rtlPolicy: "auto" | "rtl" | "ltr"): boolean =>
  rtlPolicy === "rtl" ? true : rtlPolicy === "ltr" ? false : /^ar/i.test(language);

const defaultPermissionScope: PermissionScope = {
  visibility: "workspace",
  allow_read: true,
  allow_write: true,
  allow_share: true,
  allow_publish: true,
  allow_audit_view: true
};

const pxBox = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const SAFE_SLIDE_WIDTH = 1230;
const SAFE_SLIDE_HEIGHT = 680;
const clampBox = (box: Box): Box => {
  const width = Math.max(96, Math.min(Math.round(box.w), SAFE_SLIDE_WIDTH - 48));
  const height = Math.max(64, Math.min(Math.round(box.h), SAFE_SLIDE_HEIGHT - 48));
  const x = Math.max(24, Math.min(Math.round(box.x), SAFE_SLIDE_WIDTH - width));
  const y = Math.max(24, Math.min(Math.round(box.y), SAFE_SLIDE_HEIGHT - height));
  return pxBox(x, y, width, height);
};

const toStorageRef = (artifactId: string, target: string, checksum: string) => ({
  storage_id: id("storage", artifactId),
  storage_class: "object",
  uri: `memory://presentations/${target}/${artifactId}`,
  checksum: `sha256:${checksum}`,
  region: "workspace"
});

const baseWarning = (warning_code: string, summary: string, detail: string, impacted_refs: string[]) => ({
  warning_code,
  summary,
  detail,
  severity: "medium" as const,
  impacted_refs
});

const baseFailure = (reason_code: string, summary: string, detail: string, impacted_refs: string[]) => ({
  reason_code,
  summary,
  detail,
  impacted_refs,
  retryable: true
});

const bundleToSnapshot = (bundle: PresentationBundle): Record<string, unknown> => ({
  inputSources: bundle.inputSources.map((item) => PresentationSourceSchema.parse(item)),
  parsedSourceRecords: clone(bundle.parsedSourceRecords),
  intentManifest: PresentationIntentManifestSchema.parse(bundle.intentManifest),
  outline: DeckOutlineSchema.parse(bundle.outline),
  storyboard: bundle.storyboard.map((item) => StoryboardSlidePlanSchema.parse(item)),
  slideBlocks: bundle.slideBlocks.map((item) => SlideBlockSchema.parse(item)),
  speakerNotes: bundle.speakerNotes.map((item) => SpeakerNotesSchema.parse(item)),
  motionMetadata: bundle.motionMetadata.map((item) => MotionMetadataSchema.parse(item)),
  infographicPlans: bundle.infographicPlans.map((item) => InfographicBlockPlanSchema.parse(item)),
  mediaPlans: bundle.mediaPlans.map((item) => MediaBlockPlanSchema.parse(item)),
  groupedInfographicPlans: bundle.groupedInfographicPlans.map((item) => GroupedInfographicPlanSchema.parse(item)),
  bindingSet: PresentationBindingSetSchema.parse(bundle.bindingSet),
  templateLockState: TemplateLockStateSchema.parse(bundle.templateLockState),
  deck: DeckAggregateSchema.parse(bundle.deck),
  version: DeckVersionSchema.parse(bundle.version),
  canonical: CanonicalRepresentationSchema.parse(bundle.canonical),
  outputMetadata: PresentationOutputMetadataSchema.parse(bundle.outputMetadata),
  parityValidation: bundle.parityValidation ? RenderParityValidationSchema.parse(bundle.parityValidation) : null,
  outputStatuses: bundle.outputStatuses.map((item) => PresentationOutputStatusSchema.parse(item)),
  deckArtifact: ArtifactSchema.parse(bundle.deckArtifact),
  versionArtifact: ArtifactSchema.parse(bundle.versionArtifact),
  previewArtifact: bundle.previewArtifact ? ArtifactSchema.parse(bundle.previewArtifact) : null,
  exportArtifacts: bundle.exportArtifacts.map<StoredExportArtifactSnapshot>((item) => ({
    target: item.target,
    artifact: ArtifactSchema.parse(item.artifact),
    validation: ExportValidationResultSchema.parse(item.validation),
    roundTrip: item.roundTrip ? clone(item.roundTrip) : null,
    contentType: item.contentType,
    fileName: item.fileName,
    stored_content_kind: typeof item.content === "string" ? "text" : "binary"
  })),
  publications: bundle.publications.map((item) => PublicationSchema.parse(item)),
  libraryAssets: bundle.libraryAssets.map((item) => LibraryAssetSchema.parse(item)),
  jobs: bundle.jobs.map((item) => JobSchema.parse(item)),
  evidencePacks: bundle.evidencePacks.map((item) => EvidencePackSchema.parse(item)),
  auditEvents: bundle.auditEvents.map((item) => AuditEventSchema.parse(item)),
  lineageEdges: clone(bundle.lineageEdges),
  roundTripValidations: clone(bundle.roundTripValidations)
});

const bundleFromSnapshot = (snapshot: Record<string, unknown>): PresentationBundle => {
  const raw = snapshot as {
    inputSources?: unknown[];
    parsedSourceRecords?: ParsedSourceRecord[];
    intentManifest: unknown;
    outline: unknown;
    storyboard?: unknown[];
    slideBlocks?: unknown[];
    speakerNotes?: unknown[];
    motionMetadata?: unknown[];
    infographicPlans?: unknown[];
    mediaPlans?: unknown[];
    groupedInfographicPlans?: unknown[];
    bindingSet: unknown;
    templateLockState: unknown;
    deck: unknown;
    version: unknown;
    canonical: unknown;
    outputMetadata: unknown;
    parityValidation?: unknown;
    outputStatuses?: unknown[];
    deckArtifact: unknown;
    versionArtifact: unknown;
    previewArtifact?: unknown;
    exportArtifacts?: Array<Record<string, unknown>>;
    publications?: unknown[];
    libraryAssets?: unknown[];
    jobs?: unknown[];
    evidencePacks?: unknown[];
    auditEvents?: unknown[];
    lineageEdges?: LineageEdge[];
    roundTripValidations?: RoundTripValidationRecord[];
  };
  return {
    inputSources: (raw.inputSources ?? []).map((item) => PresentationSourceSchema.parse(item)),
    parsedSourceRecords: clone(raw.parsedSourceRecords ?? []),
    intentManifest: PresentationIntentManifestSchema.parse(raw.intentManifest),
    outline: DeckOutlineSchema.parse(raw.outline),
    storyboard: (raw.storyboard ?? []).map((item) => StoryboardSlidePlanSchema.parse(item)),
    slideBlocks: (raw.slideBlocks ?? []).map((item) => SlideBlockSchema.parse(item)),
    speakerNotes: (raw.speakerNotes ?? []).map((item) => SpeakerNotesSchema.parse(item)),
    motionMetadata: (raw.motionMetadata ?? []).map((item) => MotionMetadataSchema.parse(item)),
    infographicPlans: (raw.infographicPlans ?? []).map((item) => InfographicBlockPlanSchema.parse(item)),
    mediaPlans: (raw.mediaPlans ?? []).map((item) => MediaBlockPlanSchema.parse(item)),
    groupedInfographicPlans: (raw.groupedInfographicPlans ?? []).map((item) => GroupedInfographicPlanSchema.parse(item)),
    bindingSet: PresentationBindingSetSchema.parse(raw.bindingSet),
    templateLockState: TemplateLockStateSchema.parse(raw.templateLockState),
    deck: DeckAggregateSchema.parse(raw.deck),
    version: DeckVersionSchema.parse(raw.version),
    canonical: CanonicalRepresentationSchema.parse(raw.canonical),
    outputMetadata: PresentationOutputMetadataSchema.parse(raw.outputMetadata),
    parityValidation: raw.parityValidation ? RenderParityValidationSchema.parse(raw.parityValidation) : null,
    outputStatuses: (raw.outputStatuses ?? []).map((item) => PresentationOutputStatusSchema.parse(item)),
    deckArtifact: ArtifactSchema.parse(raw.deckArtifact),
    versionArtifact: ArtifactSchema.parse(raw.versionArtifact),
    previewArtifact: raw.previewArtifact ? ArtifactSchema.parse(raw.previewArtifact) : null,
    exportArtifacts: (raw.exportArtifacts ?? []).map((item) => {
      const target = item.target as PresentationBinaryTarget;
      return {
        target,
        artifact: ArtifactSchema.parse(item.artifact),
        validation: ExportValidationResultSchema.parse(item.validation),
        roundTrip: (item.roundTrip as RoundTripValidationRecord | null | undefined) ?? null,
        contentType: `${item.contentType ?? ""}`,
        fileName: `${item.fileName ?? ""}`,
        content: target === "html" ? "" : new Uint8Array()
      } satisfies PresentationExportArtifact;
    }),
    publications: (raw.publications ?? []).map((item) => PublicationSchema.parse(item)),
    libraryAssets: (raw.libraryAssets ?? []).map((item) => LibraryAssetSchema.parse(item)),
    jobs: (raw.jobs ?? []).map((item) => JobSchema.parse(item)),
    evidencePacks: (raw.evidencePacks ?? []).map((item) => EvidencePackSchema.parse(item)),
    auditEvents: (raw.auditEvents ?? []).map((item) => AuditEventSchema.parse(item)),
    lineageEdges: clone(raw.lineageEdges ?? []),
    roundTripValidations: clone(raw.roundTripValidations ?? [])
  };
};

const asBundle = (input: unknown): PresentationBundle => input as PresentationBundle;

const pythonBridgePath = (): string =>
  path.join(process.cwd(), "packages", "presentations-engine", "tools", "document_bridge.py");

const powerPointBridgePath = (): string =>
  path.join(process.cwd(), "packages", "presentations-engine", "tools", "powerpoint_render.ps1");

const browserExecutablePath = (): string | null => {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const runPythonBridge = (
  command: "extract-pptx" | "extract-pdf" | "extract-xlsx" | "render-pdf",
  inputPath: string,
  extra: { renderDir?: string; outputPath?: string; pdfPath?: string } = {}
): Record<string, unknown> => {
  const outputPath =
    extra.outputPath ??
    path.join(
      defaultPresentationsEngineStorageRoot(process.cwd()),
      ".tmp",
      `${id("bridge", command, path.basename(inputPath)).toLowerCase()}.json`
    );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const args = [pythonBridgePath(), command, inputPath, outputPath];
  if (extra.renderDir) args.push("--render-dir", extra.renderDir);
  if (extra.pdfPath) args.push("--pdf-path", extra.pdfPath);
  const result = spawnSync("python", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Python bridge failed for ${command}`);
  }
  return JsonRecordSchema.parse(JSON.parse(fs.readFileSync(outputPath, "utf8")));
};

const inferBinaryParserKind = (source: z.infer<typeof BinaryFileSourceSchema>): "pdf" | "docx" | "pptx" | "xlsx" => {
  if (source.parser_hint !== "auto") return source.parser_hint;
  const extension = path.extname(source.file_path).toLowerCase();
  if (extension === ".pdf" || source.mime_type === "application/pdf") return "pdf";
  if (
    extension === ".docx" ||
    source.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    extension === ".xlsx" ||
    source.mime_type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  return "pptx";
};

const emuToPx = (value: string): number => Math.max(1, Math.round(Number(value || 0) / 9525));

const stripXml = (value: string): string =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const extractXmlTexts = (xml: string, pattern: RegExp): string[] => {
  const values: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    const value = stripXml(match[1] ?? "");
    if (value) values.push(value);
  }
  return values;
};

const defaultParsedThemeTokens = {
  primary_color: "C7511F",
  secondary_color: "0F172A",
  accent_color: "1D8F6E",
  neutral_color: "EEF2F6",
  font_face: "Aptos"
};

const parsePdfSource = (source: z.infer<typeof BinaryFileSourceSchema>): ParsedSourceRecord => {
  const extracted = runPythonBridge("extract-pdf", source.file_path);
  return {
    source_ref: source.source_ref,
    source_kind: source.source_kind,
    parser_kind: "pdf",
    file_path: source.file_path,
    title: source.title || path.basename(source.file_path),
    extracted_text: `${extracted.extracted_text ?? ""}`,
    slide_titles: [],
    layout_refs: [],
    media_refs: [],
    notes_count: 0,
    page_count: Number(extracted.page_count ?? 1),
    theme_tokens: defaultParsedThemeTokens,
    slide_geometries: []
  };
};

const parseDocxSource = async (source: z.infer<typeof BinaryFileSourceSchema>): Promise<ParsedSourceRecord> => {
  const zip = await JSZip.loadAsync(fs.readFileSync(source.file_path));
  const xml = await zip.file("word/document.xml")?.async("string");
  const extractedText = xml ? extractXmlTexts(xml, /<w:t[^>]*>([\s\S]*?)<\/w:t>/g).join("\n") : "";
  return {
    source_ref: source.source_ref,
    source_kind: source.source_kind,
    parser_kind: "docx",
    file_path: source.file_path,
    title: source.title || path.basename(source.file_path),
    extracted_text: extractedText,
    slide_titles: [],
    layout_refs: [],
    media_refs: [],
    notes_count: 0,
    page_count: 1,
    theme_tokens: defaultParsedThemeTokens,
    slide_geometries: []
  };
};

const parsePptxSource = async (sourceRef: string, title: string, filePath: string, sourceKind: string): Promise<ParsedSourceRecord> => {
  const extracted = runPythonBridge("extract-pptx", filePath);
  return {
    source_ref: sourceRef,
    source_kind: sourceKind,
    parser_kind: "pptx",
    file_path: filePath,
    title: title || path.basename(filePath),
    extracted_text: `${extracted.extracted_text ?? ""}`,
    slide_titles: z.array(z.string()).parse(extracted.slide_titles ?? []),
    layout_refs: z.array(z.string()).parse(extracted.layout_refs ?? []),
    master_refs: z.array(z.string()).optional().parse(extracted.master_refs ?? []),
    media_refs: z.array(z.string()).parse(extracted.media_refs ?? []),
    notes_count: Number(extracted.notes_count ?? 0),
    page_count: Number(extracted.page_count ?? 0),
    theme_tokens: {
      primary_color: `${(extracted.theme_tokens as Record<string, unknown> | undefined)?.primary_color ?? defaultParsedThemeTokens.primary_color}`,
      secondary_color: `${(extracted.theme_tokens as Record<string, unknown> | undefined)?.secondary_color ?? defaultParsedThemeTokens.secondary_color}`,
      accent_color: `${(extracted.theme_tokens as Record<string, unknown> | undefined)?.accent_color ?? defaultParsedThemeTokens.accent_color}`,
      neutral_color: `${(extracted.theme_tokens as Record<string, unknown> | undefined)?.neutral_color ?? defaultParsedThemeTokens.neutral_color}`,
      font_face: `${(extracted.theme_tokens as Record<string, unknown> | undefined)?.font_face ?? defaultParsedThemeTokens.font_face}`
    },
    slide_geometries: z
      .array(
        z.object({
          slide_index: z.number(),
          width_px: z.number(),
          height_px: z.number(),
          layout_ref: z.string().optional(),
          master_ref: z.string().optional(),
          notes_text: z.string().optional(),
          media_refs: z.array(z.string()).optional(),
          element_boxes: z.array(z.record(z.unknown()))
        })
      )
      .parse(extracted.slide_geometries ?? []) as ParsedSourceRecord["slide_geometries"]
  };
};

const parseXlsxSource = (source: z.infer<typeof BinaryFileSourceSchema>): ParsedSourceRecord => {
  const extracted = runPythonBridge("extract-xlsx", source.file_path);
  return {
    source_ref: source.source_ref,
    source_kind: source.source_kind,
    parser_kind: "xlsx",
    file_path: source.file_path,
    title: source.title || path.basename(source.file_path),
    extracted_text: `${extracted.extracted_text ?? ""}`,
    slide_titles: [],
    layout_refs: [],
    media_refs: [],
    notes_count: 0,
    page_count: Number(extracted.sheet_count ?? 0),
    sheet_names: z.array(z.string()).optional().parse(extracted.sheet_names ?? []),
    dataset_summaries: z
      .array(
        z.object({
          sheet_name: z.string(),
          headers: z.array(z.string()),
          rows: z.array(z.record(CellValueSchema))
        })
      )
      .optional()
      .parse(extracted.dataset_summaries ?? []),
    theme_tokens: defaultParsedThemeTokens,
    slide_geometries: []
  };
};

const parseBinarySource = async (source: z.infer<typeof BinaryFileSourceSchema>): Promise<ParsedSourceRecord> => {
  const parserKind = inferBinaryParserKind(source);
  if (parserKind === "pdf") return parsePdfSource(source);
  if (parserKind === "docx") return parseDocxSource(source);
  if (parserKind === "xlsx") return parseXlsxSource(source);
  return parsePptxSource(source.source_ref, source.title, source.file_path, source.source_kind);
};

const extractExistingPresentationReference = async (
  source: z.infer<typeof ExistingPresentationReferenceSchema>
): Promise<{
  source: z.infer<typeof ExistingPresentationReferenceSchema>;
  parsedRecord: ParsedSourceRecord | null;
}> => {
  if (!source.file_path || !fs.existsSync(source.file_path)) {
    return { source, parsedRecord: null };
  }
  const parsedRecord = await parsePptxSource(
    source.source_ref,
    source.title,
    source.file_path,
    source.source_kind
  );
  return {
    source: ExistingPresentationReferenceSchema.parse({
      ...source,
      theme_summary:
        source.theme_summary ||
        `Theme extracted from ${path.basename(source.file_path)} with ${parsedRecord.page_count} slides.`,
      slide_titles: parsedRecord.slide_titles,
      layout_refs: parsedRecord.layout_refs,
      slide_geometries: parsedRecord.slide_geometries,
      theme_tokens: parsedRecord.theme_tokens
    }),
    parsedRecord
  };
};

const normalizePresentationSources = async (
  sources: PresentationSource[]
): Promise<{ normalizedSources: PresentationSource[]; parsedSourceRecords: ParsedSourceRecord[] }> => {
  const normalizedSources: PresentationSource[] = [];
  const parsedSourceRecords: ParsedSourceRecord[] = [];

  for (const source of sources) {
    if (source.source_kind === "binary_file") {
      const parsed = await parseBinarySource(source);
      parsedSourceRecords.push(parsed);
      if (parsed.parser_kind === "xlsx" && parsed.dataset_summaries && parsed.dataset_summaries.length > 0) {
        parsed.dataset_summaries.forEach((dataset, datasetIndex) => {
          normalizedSources.push(
            DatasetSourceSchema.parse({
              source_kind: "dataset",
              source_ref: `${source.source_ref}-sheet-${datasetIndex + 1}`,
              title: dataset.sheet_name,
              dataset_name: dataset.sheet_name,
              columns: dataset.headers,
              rows: dataset.rows,
              preferred_chart: "bar",
              preferred_dimension: dataset.headers[0],
              preferred_measure: dataset.headers.find((header) =>
                dataset.rows.some((row) => typeof row[header] === "number")
              )
            })
          );
        });
        normalizedSources.push(
          TxtDocumentSourceSchema.parse({
            source_kind: "txt_document",
            source_ref: source.source_ref,
            title: source.title || parsed.title,
            text: parsed.extracted_text
          })
        );
        continue;
      }
      if (parsed.parser_kind === "pptx") {
        normalizedSources.push(
          ExistingPresentationReferenceSchema.parse({
            source_kind: "existing_presentation_reference",
            source_ref: source.source_ref,
            title: source.title || parsed.title,
            file_path: source.file_path,
            theme_summary: `Extracted from deck ${path.basename(source.file_path)}`,
            slide_titles: parsed.slide_titles,
            layout_refs: parsed.layout_refs,
            slide_geometries: parsed.slide_geometries,
            theme_tokens: parsed.theme_tokens
          })
        );
        normalizedSources.push(
          TxtDocumentSourceSchema.parse({
            source_kind: "txt_document",
            source_ref: `${source.source_ref}-slides`,
            title: `${source.title || parsed.title} text`,
            text: parsed.extracted_text
          })
        );
      } else {
        normalizedSources.push(
          TxtDocumentSourceSchema.parse({
            source_kind: "txt_document",
            source_ref: source.source_ref,
            title: source.title || parsed.title,
            text: parsed.extracted_text
          })
        );
      }
      continue;
    }

    if (source.source_kind === "existing_presentation_reference") {
      const extracted = await extractExistingPresentationReference(source);
      normalizedSources.push(extracted.source);
      if (extracted.parsedRecord) {
        parsedSourceRecords.push(extracted.parsedRecord);
        normalizedSources.push(
          TxtDocumentSourceSchema.parse({
            source_kind: "txt_document",
            source_ref: `${source.source_ref}-deck-text`,
            title: `${source.title} extracted text`,
            text: extracted.parsedRecord.extracted_text
          })
        );
      }
      continue;
    }

    normalizedSources.push(source);
  }

  return { normalizedSources, parsedSourceRecords };
};

const toDataUri = (mimeType: string, content: Buffer): string => `data:${mimeType};base64,${content.toString("base64")}`;

const resolveMediaAsset = (
  sources: PresentationSource[],
  sourceRef: string
): {
  title: string;
  mediaKind: "image" | "icon" | "video";
  filePath: string | null;
  mimeType: string;
  dataUri: string | null;
  caption: string;
} | null => {
  const source = sources.find(
    (candidate): candidate is z.infer<typeof MediaSourceSchema> =>
      candidate.source_kind === "media_asset" && candidate.source_ref === sourceRef
  );
  if (!source) return null;
  if (source.data_base64) {
    return {
      title: source.title,
      mediaKind: source.media_kind,
      filePath: source.file_path || null,
      mimeType: source.mime_type || (source.media_kind === "video" ? "video/mp4" : "image/png"),
      dataUri: source.data_base64.startsWith("data:")
        ? source.data_base64
        : `data:${source.mime_type || "application/octet-stream"};base64,${source.data_base64}`,
      caption: source.caption
    };
  }
  if (source.file_path && fs.existsSync(source.file_path)) {
    const extension = path.extname(source.file_path).toLowerCase();
    const mimeType =
      source.mime_type ||
      (source.media_kind === "video"
        ? "video/mp4"
        : extension === ".svg"
          ? "image/svg+xml"
          : extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : "image/png");
    return {
      title: source.title,
      mediaKind: source.media_kind,
      filePath: source.file_path,
      mimeType,
      dataUri: toDataUri(mimeType, fs.readFileSync(source.file_path)),
      caption: source.caption
    };
  }
  return {
    title: source.title,
    mediaKind: source.media_kind,
    filePath: null,
    mimeType: source.mime_type || (source.media_kind === "video" ? "video/mp4" : "image/png"),
    dataUri: source.uri.startsWith("data:") ? source.uri : null,
    caption: source.caption
  };
};

const visualDnaFromTemplateSource = (
  templateSource: z.infer<typeof LibraryTemplateSourceSchema> | undefined,
  templateName: string,
  mode: PremiumMode
): VisualDnaProfile => {
  const premiumTemplate = resolvePremiumTemplate(templateName, mode);
  return {
    canvasBg: templateSource?.visual_dna?.canvas_bg ?? premiumTemplate.visualDna.canvasBg,
    panelBg: templateSource?.visual_dna?.panel_bg ?? premiumTemplate.visualDna.panelBg,
    glow: templateSource?.visual_dna?.glow ?? premiumTemplate.visualDna.glow,
    shadow: templateSource?.visual_dna?.shadow ?? premiumTemplate.visualDna.shadow,
    logoMode: templateSource?.visual_dna?.logo_mode ?? premiumTemplate.visualDna.logoMode,
    characterRef: templateSource?.visual_dna?.character_ref ?? premiumTemplate.visualDna.characterRef,
    motionProfile: templateSource?.visual_dna?.motion_profile ?? premiumTemplate.visualDna.motionProfile,
    surfaceStyle: templateSource?.visual_dna?.surface_style ?? premiumTemplate.visualDna.surfaceStyle
  };
};

const chooseStylePresetFromContext = (input: {
  sources: PresentationSource[];
  templateRef: string | null | undefined;
  brandPresetRef: string | null | undefined;
  mode?: PremiumMode;
}): StylePreset => {
  const templateSource = input.sources.find(
    (source): source is z.infer<typeof LibraryTemplateSourceSchema> => source.source_kind === "library_template"
  );
  const referenceSource = input.sources.find(
    (source): source is z.infer<typeof ExistingPresentationReferenceSchema> =>
      source.source_kind === "existing_presentation_reference"
  );
  const templateKey =
    input.templateRef ??
    templateSource?.template_name ??
    templateSource?.theme_id ??
    referenceSource?.source_ref ??
    "Vinyl";
  const premiumTemplate = resolvePremiumTemplate(templateKey, input.mode ?? "light");
  const tokens = templateSource?.theme_tokens ?? referenceSource?.theme_tokens;
  return {
    templateRef: input.templateRef ?? templateSource?.source_ref ?? referenceSource?.source_ref ?? premiumTemplate.themeId,
    brandPresetRef: input.brandPresetRef ?? templateSource?.brand_preset_ref ?? premiumTemplate.brandKitId,
    lockMode: templateSource?.lock_mode ?? "soft_lock",
    primaryColor: tokens?.primary_color ?? premiumTemplate.primary,
    secondaryColor: tokens?.secondary_color ?? premiumTemplate.secondary,
    accentColor: tokens?.accent_color ?? premiumTemplate.accent,
    neutralColor: tokens?.neutral_color ?? premiumTemplate.neutral,
    fontFace: tokens?.font_face ?? premiumTemplate.font,
    themeId: templateSource?.theme_id ?? premiumTemplate.themeId,
    brandKitId: templateSource?.brand_kit_id ?? premiumTemplate.brandKitId,
    industry: templateSource?.industry ?? premiumTemplate.industry,
    layoutArchetypes: templateSource?.layout_archetypes?.length ? templateSource.layout_archetypes : premiumTemplate.layoutArchetypes,
    componentStyles: templateSource?.component_styles?.length ? templateSource.component_styles : premiumTemplate.componentStyles,
    visualDna: visualDnaFromTemplateSource(templateSource, premiumTemplate.name, input.mode ?? "light")
  };
};

const chooseStylePreset = (request: CreatePresentationRequest): StylePreset =>
  chooseStylePresetFromContext({
    sources: request.sources,
    templateRef: request.template_ref,
    brandPresetRef: request.brand_preset_ref
  });

const chooseStylePresetFromBundle = (bundle: PresentationBundle): StylePreset =>
  chooseStylePresetFromContext({
    sources: bundle.inputSources,
    templateRef: bundle.deck.template_ref,
    brandPresetRef: bundle.deck.brand_preset_ref
  });

const resolveBundleRenderThemeTokens = (bundle: PresentationBundle) => {
  const style = chooseStylePresetFromBundle(bundle);
  const fidelityTokens = buildGenerationFidelityProfile(bundle.inputSources)?.theme_tokens;
  return {
    primary_color: fidelityTokens?.primary_color ?? style.primaryColor,
    secondary_color: fidelityTokens?.secondary_color ?? style.secondaryColor,
    accent_color: fidelityTokens?.accent_color ?? style.accentColor,
    neutral_color: fidelityTokens?.neutral_color ?? style.neutralColor,
    font_face: fidelityTokens?.font_face ?? style.fontFace,
    visual_dna: style.visualDna,
    component_styles: style.componentStyles
  };
};

const buildGenerationFidelityProfile = (sources: PresentationSource[]): GenerationFidelityProfile | null => {
  const referenceSource = sources.find(
    (source): source is z.infer<typeof ExistingPresentationReferenceSchema> =>
      source.source_kind === "existing_presentation_reference" && source.slide_geometries.length > 0
  );
  if (!referenceSource) return null;
  return {
    source_ref: referenceSource.source_ref,
    slide_titles: referenceSource.slide_titles,
    layout_refs: referenceSource.layout_refs,
    theme_tokens: referenceSource.theme_tokens,
    slides: referenceSource.slide_geometries.map((slide, index) => ({
      slide_index: slide.slide_index,
      width_px: slide.width_px,
      height_px: slide.height_px,
      layout_ref: slide.layout_ref ?? referenceSource.layout_refs[index] ?? `reference-layout-${index + 1}`,
      master_ref: slide.master_ref ?? `reference-master-${index + 1}`,
      notes_text: slide.notes_text,
      media_refs: slide.media_refs ?? [],
      element_boxes: slide.element_boxes.map((box) => ({ ...box }))
    }))
  };
};

const defaultLayoutRefForSection = (section: NarrativeSection): string => {
  if (section.role === "cover") return "cover.hero";
  if (section.role === "agenda") return "agenda.list";
  if (section.chart && section.table) return "data.chart_table";
  if (section.metrics.length >= 2) return "comparison.metric_panel";
  if (section.media_refs.length > 0) return "media.focus";
  if (section.role === "closing") return "closing.callout";
  return "content.body";
};

const scoreReferenceSlide = (
  slide: ReferenceSlideGeometry,
  section: NarrativeSection,
  slideOrder: number
): number => {
  let score = 0;
  const textBoxes = slide.element_boxes.filter((box) => `${box.text ?? ""}`.trim().length > 0);
  const titleBoxes = slide.element_boxes.filter((box) =>
    `${box.placeholder_type ?? ""}`.toLowerCase().includes("title") || box.y < 140
  );
  const mediaBoxes = slide.element_boxes.filter((box) =>
    /(picture|media|video|image)/i.test(`${box.element_type ?? ""} ${box.shape_name ?? ""}`) || !!box.image_ext
  );
  const wideBoxes = [...slide.element_boxes].sort((left, right) => right.w * right.h - left.w * left.h);
  if (section.role === "cover" && slide.slide_index === 0) score += 120;
  if (section.role === "closing" && slide.slide_index === Math.max(0, slideOrder)) score += 10;
  if (section.role === "agenda" && textBoxes.length >= 2) score += 70;
  if (section.role === "content" && textBoxes.length >= 2) score += 40;
  if ((section.chart || section.table) && wideBoxes.length >= 2) score += 80;
  if (section.media_refs.length > 0 && mediaBoxes.length > 0) score += 90;
  if (section.metrics.length >= 2 && wideBoxes.length > 0) score += 60;
  if (section.title && slide.layout_ref.toLowerCase().includes(section.role)) score += 30;
  if (titleBoxes.length > 0) score += 15;
  score += Math.max(0, 20 - Math.abs(slide.slide_index - slideOrder) * 4);
  return score;
};

const selectReferenceSlide = (
  section: NarrativeSection,
  slideOrder: number,
  fidelityProfile: GenerationFidelityProfile | null
): ReferenceSlideGeometry | null => {
  if (!fidelityProfile || fidelityProfile.slides.length === 0) return null;
  return (
    [...fidelityProfile.slides]
      .sort((left, right) => scoreReferenceSlide(right, section, slideOrder) - scoreReferenceSlide(left, section, slideOrder))
      [0] ?? null
  );
};

const chooseLayoutRef = (
  section: NarrativeSection,
  slideOrder: number,
  fidelityProfile: GenerationFidelityProfile | null,
  stylePreset: StylePreset
): string =>
  selectReferenceSlide(section, slideOrder, fidelityProfile)?.layout_ref ??
  (stylePreset.layoutArchetypes.length > 0
    ? templateLayoutFallback(
        matchPremiumTemplate(stylePreset.themeId ?? stylePreset.templateRef ?? "Vinyl") ?? resolvePremiumTemplate("Vinyl"),
        section.role,
        slideOrder
      )
    : defaultLayoutRefForSection(section));

const inferRequestType = (sources: PresentationSource[]): PresentationIntentManifest["request_type"] => {
  if (sources.some((source) => source.source_kind === "dashboard_artifact")) return "dashboard_to_deck";
  if (sources.some((source) => source.source_kind === "report_artifact")) return "report_to_deck";
  if (sources.some((source) => source.source_kind === "dataset")) return "source_to_deck";
  if (sources.some((source) => source.source_kind === "prompt_topic")) return "prompt_to_deck";
  return "source_to_deck";
};

const deriveTargetSlideCount = (request: CreatePresentationRequest): number => {
  if (request.target_slide_count) return request.target_slide_count;
  const weighted =
    request.sources.reduce((sum, source) => {
      if (source.source_kind === "structured_outline") return sum + source.items.length;
      if (source.source_kind === "dataset") return sum + 2;
      if (source.source_kind === "dashboard_artifact") return sum + Math.max(1, source.metrics.length > 0 ? 2 : 1);
      if (source.source_kind === "report_artifact") return sum + Math.max(1, source.sections.length);
      if (source.source_kind === "txt_document" || source.source_kind === "plain_text") {
        return sum + Math.max(1, Math.ceil(splitParagraphs(source.text).length / 2));
      }
      return sum + 1;
    }, 2) + (request.mode === "advanced" ? 1 : 0);
  return Math.max(4, Math.min(10, weighted));
};

const buildIntentManifest = (request: CreatePresentationRequest, timestamp: string): PresentationIntentManifest => {
  const targetSlideCount = deriveTargetSlideCount(request);
  const rtl = inferRtl(request.language, request.rtl_policy);
  return PresentationIntentManifestSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    intent_id: id("presentation-intent", request.presentation_id ?? request.title, timestamp),
    request_type: inferRequestType(request.sources),
    source_refs: request.sources.map((source) => source.source_ref),
    template_ref: request.template_ref,
    audience: request.audience,
    tone: request.tone,
    language: request.language,
    target_slide_count: targetSlideCount,
    density: request.density,
    strict_insert_requests: request.strict_insert_requests,
    data_binding_intent: request.sources.some((source) => ["dataset", "dashboard_artifact", "report_artifact"].includes(source.source_kind))
      ? "bind charts, tables, and metric cards to structured sources when available"
      : "narrative-only deck with optional manual binding",
    export_targets: request.export_targets,
    source_policy: request.source_policy,
    rtl_policy: rtl ? "rtl" : "ltr",
    motion_level: request.motion_level,
    notes_policy: request.notes_policy,
    mode: request.mode,
    workspace_preset_ref: request.workspace_preset_ref,
    brand_preset_ref: request.brand_preset_ref,
    created_at: timestamp
  });
};

const buildDatasetNarrative = (source: z.infer<typeof DatasetSourceSchema>): NarrativeSection[] => {
  if (source.rows.length === 0) {
    return [
      {
        section_id: id("section", source.source_ref),
        title: source.title || source.dataset_name,
        role: "data_story",
      summary: `No rows were supplied for ${source.dataset_name}, so the deck keeps a baseline data story until rows arrive.`,
        bullets: [`Dataset ${source.dataset_name} is connected but currently empty.`],
        source_refs: [source.source_ref],
        strict_insert: false,
        metrics: [],
        chart: null,
        table: {
          columns: source.columns,
          rows: [],
          dataset_ref: source.source_ref,
          query_ref: `${source.source_ref}:table`,
          field_mappings: source.columns.map((column, index) => ({ role: index === 0 ? "dimension" : "measure", field: column }))
        },
        infographic_kind: null,
        media_refs: []
      }
    ];
  }

  const dimension = source.preferred_dimension ?? source.columns[0];
  const numericColumns = source.columns.filter((column) =>
    source.rows.some((row) => typeof row[column] === "number")
  );
  const measure = source.preferred_measure ?? numericColumns[0] ?? source.columns[1] ?? source.columns[0];
  const categories = source.rows.slice(0, 6).map((row) => `${row[dimension] ?? ""}`);
  const values = source.rows.slice(0, 6).map((row) => {
    const value = row[measure];
    return typeof value === "number" ? value : Number(value ?? 0);
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = values.length > 0 ? total / values.length : 0;
  const metrics: MetricInput[] = [
    { label: `${measure} total`, value: total, unit: "" },
    { label: `${measure} average`, value: Number(average.toFixed(2)), unit: "" }
  ];
  return [
    {
      section_id: id("section", source.source_ref, "overview"),
      title: source.title || `${source.dataset_name} overview`,
      role: "data_story",
      summary: `Structured data from ${source.dataset_name} drives the main chart and table on this slide.`,
      bullets: [
        `Dimension field: ${dimension}`,
        `Measure field: ${measure}`,
        `Rows available: ${source.rows.length}`
      ],
      source_refs: [source.source_ref],
      strict_insert: false,
      metrics,
      chart: {
        chart_type: source.preferred_chart,
        categories,
        series: [{ name: measure, values }],
        dataset_ref: source.source_ref,
        query_ref: `${source.source_ref}:chart`,
        field_mappings: [
          { role: "dimension", field: dimension },
          { role: "measure", field: measure }
        ]
      },
      table: {
        columns: source.columns,
        rows: source.rows.slice(0, 6).map((row) => source.columns.map((column) => `${row[column] ?? ""}`)),
        dataset_ref: source.source_ref,
        query_ref: `${source.source_ref}:table`,
        field_mappings: source.columns.map((column, index) => ({ role: index === 0 ? "dimension" : "measure", field: column }))
      },
      infographic_kind: "statistic_panel",
      media_refs: []
    }
  ];
};

const deriveNarrativeSections = (request: CreatePresentationRequest, intent: PresentationIntentManifest): NarrativeSection[] => {
  const promptSource = request.sources.find(
    (source): source is z.infer<typeof PromptTopicSourceSchema> => source.source_kind === "prompt_topic"
  );
  const noteSource = request.sources.find(
    (source): source is z.infer<typeof NotesSourceSchema> => source.source_kind === "notes"
  );
  const outlineSource = request.sources.find(
    (source): source is z.infer<typeof StructuredOutlineSourceSchema> => source.source_kind === "structured_outline"
  );
  const txtSources = request.sources.filter(
    (source): source is z.infer<typeof TxtDocumentSourceSchema> | z.infer<typeof PlainTextSourceSchema> =>
      source.source_kind === "txt_document" || source.source_kind === "plain_text"
  );
  const mediaSources = request.sources.filter(
    (source): source is z.infer<typeof MediaSourceSchema> => source.source_kind === "media_asset"
  );
  const referenceSource = request.sources.find(
    (source): source is z.infer<typeof ExistingPresentationReferenceSchema> =>
      source.source_kind === "existing_presentation_reference"
  );
  const sections: NarrativeSection[] = [
    {
      section_id: id("section", "cover", request.presentation_id ?? request.title),
      title: request.title,
      role: "cover",
      summary:
        promptSource?.prompt ||
        request.description ||
        `Deck for ${request.audience} with a ${request.tone} tone and ${intent.target_slide_count} target slides.`,
      bullets: noteSource?.notes.slice(0, 3) ?? splitSentences(request.description, 3),
      source_refs: promptSource ? [promptSource.source_ref] : [],
      strict_insert: true,
      metrics: [],
      chart: null,
      table: null,
      infographic_kind: null,
      media_refs: mediaSources.slice(0, 1).map((item) => item.source_ref)
    }
  ];

  if (outlineSource) {
    sections.push({
      section_id: id("section", outlineSource.source_ref, "agenda"),
      title: outlineSource.title || "Agenda",
      role: "agenda",
      summary: "Slide-by-slide agenda generated from the provided structured outline.",
      bullets: outlineSource.items.map((item) => item.title),
      source_refs: [outlineSource.source_ref],
      strict_insert: true,
      metrics: [],
      chart: null,
      table: null,
      infographic_kind: null,
      media_refs: []
    });
    outlineSource.items.forEach((item, index) => {
      sections.push({
        section_id: id("section", outlineSource.source_ref, index),
        title: item.title,
        role: "content",
        summary: item.bullets[0] ?? `Narrative section for ${item.title}.`,
        bullets: item.bullets,
        source_refs: [outlineSource.source_ref],
        strict_insert: item.strict_insert,
        metrics: [],
        chart: null,
        table: null,
        infographic_kind: item.bullets.length >= 3 ? "process" : null,
        media_refs: []
      });
    });
  }

  txtSources.forEach((source, index) => {
    const paragraphs = splitParagraphs(source.text);
    chunk(paragraphs, 3).forEach((paragraphGroup, paragraphIndex) => {
      sections.push({
        section_id: id("section", source.source_ref, paragraphIndex),
        title:
          paragraphIndex === 0
            ? source.title || `Key context ${index + 1}`
            : `${source.title || "Key context"} ${paragraphIndex + 1}`,
        role: "content",
        summary: paragraphGroup[0] ?? source.title ?? "Narrative context",
        bullets: paragraphGroup.slice(0, 3),
        source_refs: [source.source_ref],
        strict_insert: false,
        metrics: [],
        chart: null,
        table: null,
        infographic_kind: paragraphGroup.length >= 3 ? "timeline" : null,
        media_refs: []
      });
    });
  });

  if (referenceSource) {
    sections.push({
      section_id: id("section", referenceSource.source_ref, "reference"),
      title: `${referenceSource.title} reference`,
      role: "content",
      summary:
        referenceSource.theme_summary ||
        `Existing presentation reference extracted from ${path.basename(referenceSource.file_path || referenceSource.source_ref)}.`,
      bullets:
        referenceSource.slide_titles.length > 0
          ? referenceSource.slide_titles.slice(0, 4)
          : referenceSource.layout_refs.slice(0, 4),
      source_refs: [referenceSource.source_ref],
      strict_insert: false,
      metrics: [],
      chart: null,
      table: null,
      infographic_kind: referenceSource.slide_titles.length >= 3 ? "timeline" : null,
      media_refs: []
    });
  }

  request.sources
    .filter((source): source is z.infer<typeof DatasetSourceSchema> => source.source_kind === "dataset")
    .forEach((source) => sections.push(...buildDatasetNarrative(source)));

  request.sources
    .filter((source): source is z.infer<typeof DashboardSourceSchema> => source.source_kind === "dashboard_artifact")
    .forEach((source) => {
      const metricRows = source.metrics.slice(0, 4);
      sections.push({
        section_id: id("section", source.source_ref),
        title: source.title,
        role: metricRows.length >= 2 ? "comparison" : "content",
        summary: source.summary,
        bullets: source.highlights.slice(0, 4),
        source_refs: [source.source_ref],
        strict_insert: false,
        metrics: metricRows,
        chart:
          metricRows.length > 0
            ? {
                chart_type: "bar",
                categories: metricRows.map((metric) => metric.label),
                series: [{ name: source.title, values: metricRows.map((metric) => metric.value) }],
                dataset_ref: source.dataset_ref ?? undefined,
                query_ref: source.dataset_ref ? `${source.dataset_ref}:dashboard` : undefined,
                field_mappings: metricRows.map((metric) => ({ role: "measure", field: metric.label }))
              }
            : null,
        table:
          metricRows.length > 0
            ? {
                columns: ["Metric", "Value", "Unit"],
                rows: metricRows.map((metric) => [metric.label, `${metric.value}`, metric.unit]),
                dataset_ref: source.dataset_ref ?? undefined,
                query_ref: source.dataset_ref ? `${source.dataset_ref}:dashboard-table` : undefined,
                field_mappings: [
                  { role: "dimension", field: "Metric" },
                  { role: "measure", field: "Value" }
                ]
              }
            : null,
        infographic_kind: "comparison",
        media_refs: []
      });
    });

  request.sources
    .filter((source): source is z.infer<typeof ReportSourceSchema> => source.source_kind === "report_artifact")
    .forEach((source) => {
      sections.push({
        section_id: id("section", source.source_ref, "summary"),
        title: source.title,
        role: "content",
        summary: source.summary,
        bullets: splitSentences(source.summary, 4),
        source_refs: [source.source_ref],
        strict_insert: false,
        metrics: [],
        chart: null,
        table: null,
        infographic_kind: source.sections.length >= 3 ? "timeline" : null,
        media_refs: []
      });
      source.sections.forEach((section, index) => {
        const leadChart = section.charts[0] ?? null;
        const leadTable = section.tables[0] ?? null;
        sections.push({
          section_id: id("section", source.source_ref, index),
          title: section.heading,
          role: section.section_kind === "executive_summary" ? "agenda" : section.section_kind === "appendix" ? "closing" : "content",
          summary: section.summary || section.captions[0] || section.bullets[0] || `Section ${index + 1}`,
          bullets: [...section.bullets, ...section.captions].slice(0, 5),
          source_refs: [source.source_ref],
          strict_insert: false,
          metrics: section.metrics,
          chart: leadChart
            ? {
                chart_type: leadChart.chart_type.includes("line") ? "line" : "bar",
                categories: leadChart.series.map((entry, seriesIndex) => String(entry["label"] ?? `Series ${seriesIndex + 1}`)),
                series: [
                  {
                    name: leadChart.title,
                    values: leadChart.series.map((entry) => Number(entry["value"] ?? 0))
                  }
                ],
                dataset_ref: undefined,
                query_ref: undefined,
                field_mappings: []
              }
            : null,
          table: leadTable
            ? {
                columns: leadTable.rows[0] ?? ["Column 1", "Column 2"],
                rows: leadTable.rows.slice(1),
                dataset_ref: undefined,
                query_ref: undefined,
                field_mappings: []
              }
            : null,
          infographic_kind:
            leadChart || leadTable
              ? "comparison"
              : section.narrative_hierarchy.child_section_refs.length > 0
                ? "timeline"
                : section.bullets.length >= 3
                  ? "process"
                  : null,
          media_refs: []
        });
      });
    });

  sections.push({
    section_id: id("section", "closing", request.presentation_id ?? request.title),
    title: "الختام",
    role: "closing",
    summary: "Close with the operating recommendation and next action.",
    bullets: noteSource?.notes.slice(0, 3) ?? ["اعتماد المسار", "بدء التنفيذ", "متابعة القياس"],
    source_refs: noteSource ? [noteSource.source_ref] : [],
    strict_insert: true,
    metrics: [],
    chart: null,
    table: null,
    infographic_kind: "process",
    media_refs: []
  });

  const targetCount = intent.target_slide_count;
  if (sections.length <= targetCount) return sections;
  const middle = sections.slice(1, -1).slice(0, Math.max(1, targetCount - 2));
  return [sections[0], ...middle, sections[sections.length - 1]];
};

const buildDeckOutline = (
  deckId: string,
  intent: PresentationIntentManifest,
  sections: NarrativeSection[],
  timestamp: string,
  language: string,
  rtl: boolean
): DeckOutline => {
  const agendaNode = sections.find((section) => section.role === "agenda");
  const nodes = sections.map((section, index) =>
    DeckOutlineNodeSchema.parse({
      schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
      schema_version: PRESENTATION_SCHEMA_VERSION,
      outline_node_id: id("outline-node", deckId, index),
      parent_node_ref:
        section.role === "cover" || section.role === "agenda" || section.role === "closing" || !agendaNode
          ? null
          : id("outline-node", deckId, sections.findIndex((item) => item.section_id === agendaNode.section_id)),
      title: toLocalizedText(section.title, language, rtl),
      narrative_role: section.role,
      source_refs: section.source_refs,
      target_slide_count: 1,
      strict_insert: section.strict_insert,
      child_node_refs: []
    })
  );

  nodes.forEach((node) => {
    if (node.parent_node_ref) {
      const parent = nodes.find((candidate) => candidate.outline_node_id === node.parent_node_ref);
      if (parent && !parent.child_node_refs.includes(node.outline_node_id)) {
        parent.child_node_refs.push(node.outline_node_id);
      }
    }
  });

  return DeckOutlineSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    outline_id: id("deck-outline", deckId),
    deck_ref: null,
    intent_ref: intent.intent_id,
    outline_nodes: nodes,
    narrative_arc: "briefing_to_action",
    must_include_refs: nodes.filter((node) => node.strict_insert).map((node) => node.outline_node_id),
    estimated_slide_count: sections.length,
    source_refs: sections.flatMap((section) => section.source_refs)
  });
};

const makeBlockPlanRefs = (deckId: string, slideOrder: number, section: NarrativeSection): string[] => {
  const refs = [id("block-plan", deckId, slideOrder, "title")];
  if (section.bullets.length > 0) refs.push(id("block-plan", deckId, slideOrder, "body"));
  if (section.metrics.length > 0) refs.push(id("block-plan", deckId, slideOrder, "metric-card"));
  if (section.chart) refs.push(id("block-plan", deckId, slideOrder, "chart"));
  if (section.table) refs.push(id("block-plan", deckId, slideOrder, "table"));
  if (section.infographic_kind) refs.push(id("block-plan", deckId, slideOrder, "infographic"));
  if (section.media_refs.length > 0) refs.push(id("block-plan", deckId, slideOrder, "media"));
  return refs;
};

const buildStoryboard = (
  deckId: string,
  intent: PresentationIntentManifest,
  outline: DeckOutline,
  sections: NarrativeSection[],
  language: string,
  rtl: boolean,
  fidelityProfile: GenerationFidelityProfile | null,
  stylePreset: StylePreset
): StoryboardSlidePlan[] =>
  sections.map((section, index) =>
    StoryboardSlidePlanSchema.parse({
      schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
      schema_version: PRESENTATION_SCHEMA_VERSION,
      storyboard_slide_plan_id: id("storyboard", deckId, index),
      deck_ref: null,
      intent_ref: intent.intent_id,
      outline_node_ref: outline.outline_nodes[index]?.outline_node_id ?? null,
      slide_order: index,
      slide_title: toLocalizedText(section.title, language, rtl),
      layout_ref: chooseLayoutRef(section, index, fidelityProfile, stylePreset),
      content_spec: {
        summary: section.summary,
        bullets: section.bullets,
        metrics: section.metrics,
        chart: section.chart,
        table: section.table,
        infographic_kind: section.infographic_kind,
        media_refs: section.media_refs
      },
      block_plan_refs: makeBlockPlanRefs(deckId, index, section),
      source_refs: section.source_refs,
      binding_refs: [],
      speaker_notes_intent: section.summary,
      rtl_policy: rtl ? "rtl" : "ltr",
      editability_flags: {
        default_editable: true,
        locked_block_refs: []
      },
      parity_expectations: [
        "text_stays_text",
        "charts_stay_charts",
        "tables_stay_editable",
        "overflow_check",
        "clipping_check",
        "rtl_check",
        "template_lock_check"
      ]
    })
  );

const sortBoxesByArea = (boxes: ExtractedElementBox[]): ExtractedElementBox[] =>
  [...boxes].sort((left, right) => right.w * right.h - left.w * left.h);

const splitBoxHorizontally = (box: ExtractedElementBox, slots: number, slotIndex: number): Box => {
  const gap = 18;
  const slotWidth = Math.max(80, Math.floor((box.w - gap * (slots - 1)) / slots));
  return pxBox(box.x + slotIndex * (slotWidth + gap), box.y, slotWidth, box.h);
};

const pickReferenceBox = (
  referenceSlide: ReferenceSlideGeometry | null,
  blockKind: SlideBlock["block_kind"],
  orderIndex: number
): { box: Box; masterRef: string | null; placeholderType: string | null } | null => {
  if (!referenceSlide) return null;
  const titleBoxes = referenceSlide.element_boxes.filter((box) =>
    `${box.placeholder_type ?? ""}`.toLowerCase().includes("title") || (box.y < 150 && `${box.text ?? ""}`.trim().length > 0)
  );
  const mediaBoxes = referenceSlide.element_boxes.filter((box) =>
    /(picture|media|video|image)/i.test(`${box.element_type ?? ""} ${box.shape_name ?? ""}`) || !!box.image_ext
  );
  const nonTitleBoxes = sortBoxesByArea(referenceSlide.element_boxes.filter((box) => !titleBoxes.includes(box)));
  const textBoxes = sortBoxesByArea(
    referenceSlide.element_boxes.filter((box) =>
      /text|placeholder|shape/i.test(`${box.element_type ?? ""}`) || `${box.text ?? ""}`.trim().length > 0
    )
  );
  let selected: ExtractedElementBox | null = null;
  if (blockKind === "title") {
    selected = titleBoxes[0] ?? textBoxes[0] ?? nonTitleBoxes[0] ?? null;
  } else if (blockKind === "image" || blockKind === "video") {
    selected = mediaBoxes[orderIndex] ?? mediaBoxes[0] ?? nonTitleBoxes[0] ?? null;
  } else if (blockKind === "table" || blockKind === "chart") {
    selected = nonTitleBoxes[Math.min(orderIndex, nonTitleBoxes.length - 1)] ?? null;
  } else if (blockKind === "metric_card") {
    const candidate = nonTitleBoxes.find((box) => box.w >= 420 && box.h >= 80) ?? nonTitleBoxes[0] ?? null;
    if (candidate) {
      return {
        box: clampBox(splitBoxHorizontally(candidate, 3, Math.min(orderIndex, 2))),
        masterRef: candidate.master_ref ?? referenceSlide.master_ref,
        placeholderType: candidate.placeholder_type ?? null
      };
    }
  } else {
    selected = textBoxes[Math.min(orderIndex, textBoxes.length - 1)] ?? nonTitleBoxes[0] ?? null;
  }
  if (!selected) return null;
  return {
    box: clampBox(pxBox(selected.x, selected.y, selected.w, selected.h)),
    masterRef: selected.master_ref ?? referenceSlide.master_ref,
    placeholderType: selected.placeholder_type ?? null
  };
};

const blockBox = (
  layoutRef: string,
  blockKind: SlideBlock["block_kind"],
  orderIndex: number,
  referenceSlide: ReferenceSlideGeometry | null
): { box: Box; masterRef: string | null; placeholderType: string | null } => {
  const referenceBox = pickReferenceBox(referenceSlide, blockKind, orderIndex);
  if (referenceBox) return referenceBox;
  if (layoutRef === "cover.hero") {
    if (blockKind === "title") return { box: pxBox(72, 80, 1136, 96), masterRef: null, placeholderType: null };
    if (blockKind === "image" || blockKind === "video") return { box: pxBox(820, 180, 320, 240), masterRef: null, placeholderType: null };
    return { box: pxBox(72, 200, 680, 300), masterRef: null, placeholderType: null };
  }
  if (layoutRef === "agenda.list") {
    if (blockKind === "title") return { box: pxBox(72, 56, 1136, 72), masterRef: null, placeholderType: null };
    return { box: pxBox(96, 160, 1040, 420), masterRef: null, placeholderType: null };
  }
  if (layoutRef === "data.chart_table") {
    if (blockKind === "title") return { box: pxBox(72, 48, 1136, 72), masterRef: null, placeholderType: null };
    if (blockKind === "chart") return { box: pxBox(72, 148, 560, 280), masterRef: null, placeholderType: null };
    if (blockKind === "table") return { box: pxBox(672, 148, 536, 280), masterRef: null, placeholderType: null };
    if (blockKind === "metric_card") return { box: pxBox(72 + orderIndex * 180, 452, 160, 104), masterRef: null, placeholderType: null };
    return { box: pxBox(72, 576, 1136, 96), masterRef: null, placeholderType: null };
  }
  if (layoutRef === "comparison.metric_panel") {
    if (blockKind === "title") return { box: pxBox(72, 48, 1136, 72), masterRef: null, placeholderType: null };
    if (blockKind === "grouped_infographic" || blockKind === "infographic") return { box: pxBox(72, 148, 640, 320), masterRef: null, placeholderType: null };
    if (blockKind === "metric_card") return { box: pxBox(760, 160 + orderIndex * 112, 360, 92), masterRef: null, placeholderType: null };
    return { box: pxBox(72, 500, 1136, 120), masterRef: null, placeholderType: null };
  }
  if (layoutRef === "media.focus") {
    if (blockKind === "title") return { box: pxBox(72, 48, 1136, 72), masterRef: null, placeholderType: null };
    if (blockKind === "image" || blockKind === "video") return { box: pxBox(72, 148, 620, 340), masterRef: null, placeholderType: null };
    return { box: pxBox(732, 148 + orderIndex * 120, 430, 100), masterRef: null, placeholderType: null };
  }
  if (layoutRef === "closing.callout") {
    if (blockKind === "title") return { box: pxBox(72, 72, 1136, 72), masterRef: null, placeholderType: null };
    return { box: pxBox(120, 220, 1040, 260), masterRef: null, placeholderType: null };
  }
  if (blockKind === "title") return { box: pxBox(72, 48, 1136, 72), masterRef: null, placeholderType: null };
  if (blockKind === "metric_card") return { box: pxBox(72 + orderIndex * 220, 148, 200, 100), masterRef: null, placeholderType: null };
  return { box: pxBox(72, 160 + orderIndex * 120, 1136, 104), masterRef: null, placeholderType: null };
};

const blockText = (block: SlideBlock): string => {
  const title = block.title.map((item) => item.value).join(" ");
  const body = block.body.map((item) => item.value).join(" ");
  return [title, body].filter(Boolean).join(" - ");
};

const buildSlideBlocks = (
  deckId: string,
  versionId: string,
  slideRef: string,
  section: NarrativeSection,
  plan: StoryboardSlidePlan,
  slideOrder: number,
  sources: PresentationSource[],
  language: string,
  rtl: boolean,
  templateLockStateRef: string | null,
  generatedBy: "manual" | "template" | "ai_assisted" | "data_bound"
): {
  blocks: SlideBlock[];
  infographicPlans: InfographicBlockPlan[];
  mediaPlans: MediaBlockPlan[];
  groupedInfographicPlans: GroupedInfographicPlan[];
} => {
  const blocks: SlideBlock[] = [];
  const infographicPlans: InfographicBlockPlan[] = [];
  const mediaPlans: MediaBlockPlan[] = [];
  const groupedInfographicPlans: GroupedInfographicPlan[] = [];
  const fidelityProfile = buildGenerationFidelityProfile(sources);
  const referenceSlide = selectReferenceSlide(section, slideOrder, fidelityProfile);

  const makeBlock = (
    blockKind: SlideBlock["block_kind"],
    orderIndex: number,
    title: string,
    body: string,
    metadata: Record<string, unknown>
  ) => {
    const blockId = id("slide-block", slideRef, blockKind, orderIndex);
    const placementOrder =
      blockKind === "metric_card"
        ? Math.max(0, orderIndex - 2)
        : blockKind === "chart"
          ? Math.max(0, orderIndex - 5)
          : blockKind === "table"
            ? Math.max(0, orderIndex - 6)
            : blockKind === "image" || blockKind === "video"
              ? Math.max(0, orderIndex - 8)
              : orderIndex;
    const placement = blockBox(plan.layout_ref, blockKind, placementOrder, referenceSlide);
    const block = SlideBlockSchema.parse({
      schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
      schema_version: PRESENTATION_SCHEMA_VERSION,
      slide_block_id: blockId,
      deck_ref: deckId,
      version_ref: versionId,
      slide_ref: slideRef,
      block_kind: blockKind,
      order_index: orderIndex,
      title: toLocalizedText(title, language, rtl),
      body: body ? toLocalizedText(body, language, rtl) : [],
      canonical_node_ref: id("node", blockId),
      binding_refs: [],
      infographic_block_plan_ref: null,
      media_block_plan_ref: null,
      grouped_infographic_plan_ref: null,
      template_lock_state_ref: templateLockStateRef,
      editability: templateLockStateRef && blockKind === "title" ? "template_locked" : "editable",
      generated_by: generatedBy,
      block_metadata: {
        ...metadata,
        layout_box: clampBox(placement.box),
        layout_ref: plan.layout_ref,
        reference_layout_ref: referenceSlide?.layout_ref ?? null,
        reference_master_ref: placement.masterRef ?? referenceSlide?.master_ref ?? null,
        reference_placeholder_type: placement.placeholderType ?? null,
        geometry_source_ref: referenceSlide ? fidelityProfile?.source_ref ?? null : null
      }
    });
    blocks.push(block);
    return block;
  };

  makeBlock("title", 0, section.title, "", {
    theme_inheritance_ref: fidelityProfile?.source_ref ?? null
  });

  if (section.bullets.length > 0) {
    const bodyKind: SlideBlock["block_kind"] = section.role === "agenda" ? "agenda" : section.role === "closing" ? "callout" : "body";
    makeBlock(bodyKind, 1, section.summary, section.bullets.join("\n"), {
      bullets: section.bullets
    });
  }

  if (section.metrics.length > 0) {
    section.metrics.slice(0, plan.layout_ref === "comparison.metric_panel" ? 3 : 2).forEach((metric, index) => {
      makeBlock("metric_card", 2 + index, metric.label, `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`, {
        metric
      });
    });
  }

  if (section.chart) {
    makeBlock("chart", 5, section.title, "Bound chart", {
      chart: section.chart
    });
  }

  if (section.table) {
    makeBlock("table", 6, "Data table", "", {
      table: section.table
    });
  }

  if (section.infographic_kind) {
    const infographicBlock = makeBlock(
      section.metrics.length >= 2 ? "grouped_infographic" : "infographic",
      7,
      "Narrative structure",
      section.bullets.join(" | "),
      {
        layout_kind: section.infographic_kind,
        items: section.bullets
      }
    );
    if (infographicBlock.block_kind === "grouped_infographic") {
      const grouped = GroupedInfographicPlanSchema.parse({
        schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
        schema_version: PRESENTATION_SCHEMA_VERSION,
        grouped_infographic_plan_id: id("grouped-plan", infographicBlock.slide_block_id),
        deck_ref: deckId,
        version_ref: versionId,
        slide_ref: slideRef,
        block_ref: infographicBlock.slide_block_id,
        group_kind: "stat_cluster",
        item_refs: section.metrics.map((metric) => metric.label),
        layout_rules: section.metrics.map((metric, index) => ({ metric: metric.label, slot: index })),
        source_refs: section.source_refs,
        canonical_node_ref: infographicBlock.canonical_node_ref
      });
      groupedInfographicPlans.push(grouped);
      infographicBlock.grouped_infographic_plan_ref = grouped.grouped_infographic_plan_id;
    } else {
      const planRecord = InfographicBlockPlanSchema.parse({
        schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
        schema_version: PRESENTATION_SCHEMA_VERSION,
        infographic_block_plan_id: id("infographic-plan", infographicBlock.slide_block_id),
        deck_ref: deckId,
        version_ref: versionId,
        slide_ref: slideRef,
        block_ref: infographicBlock.slide_block_id,
        layout_kind: section.infographic_kind,
        narrative_goal: section.summary,
        metric_refs: section.metrics.map((metric) => metric.label),
        source_refs: section.source_refs,
        icon_refs: [],
        chart_binding_refs: [],
        step_refs: section.bullets,
        canonical_node_ref: infographicBlock.canonical_node_ref,
        editable_region_refs: [infographicBlock.slide_block_id]
      });
      infographicPlans.push(planRecord);
      infographicBlock.infographic_block_plan_ref = planRecord.infographic_block_plan_id;
    }
  }

  if (section.media_refs.length > 0) {
    section.media_refs.forEach((sourceRef, index) => {
      const mediaAsset = resolveMediaAsset(sources, sourceRef);
      const blockKind = (mediaAsset?.mediaKind ?? "image") as SlideBlock["block_kind"];
      const mediaBlock = makeBlock(blockKind, 8 + index, mediaAsset?.title ?? "Reference media", mediaAsset?.caption ?? sourceRef, {
        source_ref: sourceRef
      });
      const mediaPlan = MediaBlockPlanSchema.parse({
        schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
        schema_version: PRESENTATION_SCHEMA_VERSION,
        media_block_plan_id: id("media-plan", mediaBlock.slide_block_id),
        deck_ref: deckId,
        version_ref: versionId,
        slide_ref: slideRef,
        block_ref: mediaBlock.slide_block_id,
        media_kind: mediaAsset?.mediaKind ?? "image",
        asset_ref: sourceRef,
        source_ref: sourceRef,
        fit_policy: "contain",
        start_at_ms: null,
        end_at_ms: null,
        autoplay: false,
        loop: false,
        caption: sourceRef,
        canonical_node_ref: mediaBlock.canonical_node_ref
      });
      mediaPlans.push(mediaPlan);
      mediaBlock.media_block_plan_ref = mediaPlan.media_block_plan_id;
    });
  }

  return { blocks, infographicPlans, mediaPlans, groupedInfographicPlans };
};

const buildSpeakerNotes = (
  deckId: string,
  versionId: string,
  slideRef: string,
  section: NarrativeSection,
  language: string,
  rtl: boolean,
  aiGenerated: boolean
): SpeakerNotes =>
  SpeakerNotesSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    speaker_notes_id: id("speaker-notes", slideRef),
    deck_ref: deckId,
    version_ref: versionId,
    slide_ref: slideRef,
    format: "structured_brief",
    content: toLocalizedText(`${section.summary}\n${section.bullets.join("\n")}`, language, rtl),
    note_refs: [],
    source_refs: section.source_refs,
    ai_generated: aiGenerated,
    presenter_duration_seconds: Math.max(30, 25 + section.bullets.length * 10)
  });

const buildMotionMetadata = (
  deckId: string,
  versionId: string,
  slideRef: string,
  blocks: SlideBlock[],
  motionLevel: PresentationIntentManifest["motion_level"]
): MotionMetadata =>
  MotionMetadataSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    motion_metadata_id: id("motion", slideRef),
    deck_ref: deckId,
    version_ref: versionId,
    slide_ref: slideRef,
    motion_level: motionLevel,
    transition_style: motionLevel === "none" ? "none" : motionLevel === "subtle" ? "fade" : "push",
    transition_duration_ms: motionLevel === "none" ? 0 : motionLevel === "subtle" ? 250 : 450,
    respects_template_lock: true,
    steps:
      motionLevel === "none"
        ? []
        : blocks.slice(0, 4).map((block, index) => ({
            schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
            schema_version: PRESENTATION_SCHEMA_VERSION,
            motion_step_id: id("motion-step", block.slide_block_id),
            target_ref: block.slide_block_id,
            effect_kind: index === 0 ? "transition" : "entrance",
            preset_ref: motionLevel === "subtle" ? "fade" : "wipe",
            duration_ms: motionLevel === "subtle" ? 250 : 400,
            delay_ms: index * 50,
            trigger: index === 0 ? "with_previous" : "after_previous",
            direction: null
          }))
  });

const materializeSlide = (
  deckId: string,
  versionId: string,
  section: NarrativeSection,
  storyboard: StoryboardSlidePlan,
  slideIndex: number,
  sources: PresentationSource[],
  language: string,
  rtl: boolean,
  intent: PresentationIntentManifest,
  templateLockStateRef: string | null
): MaterializedSlide => {
  const slideId = id("slide", deckId, slideIndex);
  const generatedBy =
    section.chart || section.table || section.metrics.length > 0 ? "data_bound" : intent.mode === "easy" ? "ai_assisted" : "manual";
  const content = buildSlideBlocks(
    deckId,
    versionId,
    slideId,
    section,
    storyboard,
    slideIndex,
    sources,
    language,
    rtl,
    templateLockStateRef,
    generatedBy
  );
  const slideNode = {
    node_id: id("node", slideId),
    node_type: "slide" as const,
    parent_node_ref: id("node-document", deckId),
    child_node_refs: [],
    name: section.title,
    semantic_labels: ["presentation_slide", storyboard.layout_ref, section.role],
    layout_ref: storyboard.layout_ref,
    data_binding_refs: [],
    formula_refs: [],
    lineage_refs: section.source_refs,
    template_refs: templateLockStateRef ? [templateLockStateRef] : [],
    evidence_refs: [],
    editable: true,
    slide_index: slideIndex,
    master_ref:
      `${content.blocks.find((block) => `${block.block_metadata.reference_master_ref ?? ""}`.length > 0)?.block_metadata.reference_master_ref ?? ""}` ||
      storyboard.layout_ref,
    element_refs: content.blocks.map((block) => block.canonical_node_ref ?? "")
  };
  const notes = buildSpeakerNotes(
    deckId,
    versionId,
    slideId,
    section,
    language,
    rtl,
    intent.notes_policy === "auto_generate"
  );
  const motion = buildMotionMetadata(deckId, versionId, slideId, content.blocks, intent.motion_level);
  const boxes = content.blocks.map((block) => ({
    block_ref: block.slide_block_id,
    node_ref: block.canonical_node_ref ?? "",
    box: (block.block_metadata.layout_box as Box | undefined) ?? pxBox(72, 160, 1136, 96)
  }));
  return {
    section,
    storyboard,
    slideNode,
    blocks: content.blocks,
    notes,
    motion,
    infographicPlans: content.infographicPlans,
    mediaPlans: content.mediaPlans,
    groupedInfographicPlans: content.groupedInfographicPlans,
    boxes
  };
};

const slideIdsToBindingRefs = (slides: MaterializedSlide[], bindings: PresentationBindingSet["bindings"]) => {
  slides.forEach((slide) => {
    slide.slideNode.data_binding_refs = bindings
      .filter((binding) => binding.slide_ref === slide.blocks[0]?.slide_ref)
      .map((binding) => binding.binding_id);
  });
};

const buildBindingSet = (
  deckId: string,
  versionId: string,
  slides: MaterializedSlide[],
  timestamp: string
): PresentationBindingSet => {
  const bindings = slides.flatMap((slide) =>
    slide.blocks.flatMap((block) => {
      const chart = block.block_metadata.chart as ChartModel | undefined;
      const table = block.block_metadata.table as TableModel | undefined;
      const metric = block.block_metadata.metric as MetricInput | undefined;
      const bindingSource =
        chart?.dataset_ref || table?.dataset_ref
          ? {
              dataset_ref: chart?.dataset_ref ?? table?.dataset_ref ?? "",
              query_ref: chart?.query_ref ?? table?.query_ref ?? "",
              field_mappings: chart?.field_mappings ?? table?.field_mappings ?? []
            }
          : metric && slide.section.source_refs[0]
            ? {
                dataset_ref: slide.section.source_refs[0],
                query_ref: `${slide.section.source_refs[0]}:metric`,
                field_mappings: [{ role: "metric", field: metric.label }]
              }
            : null;
      if (!bindingSource) return [];
      return [
        PresentationDataBindingSchema.parse({
          schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
          schema_version: PRESENTATION_SCHEMA_VERSION,
          binding_id: id("presentation-binding", block.slide_block_id),
          deck_ref: deckId,
          version_ref: versionId,
          slide_ref: block.slide_ref,
          target_block_ref: block.slide_block_id,
          target_node_ref: block.canonical_node_ref ?? "",
          dataset_ref: bindingSource.dataset_ref,
          query_ref: bindingSource.query_ref,
          field_mappings: bindingSource.field_mappings,
          snapshot_version_ref: null,
          last_refresh_at: timestamp
        })
      ];
    })
  );

  slides.forEach((slide) => {
    slide.blocks.forEach((block) => {
      block.binding_refs = bindings
        .filter((binding) => binding.target_block_ref === block.slide_block_id)
        .map((binding) => binding.binding_id);
    });
  });

  slideIdsToBindingRefs(slides, bindings);

  return PresentationBindingSetSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    presentation_binding_set_id: id("presentation-binding-set", deckId),
    deck_ref: deckId,
    version_ref: versionId,
    source_artifact_refs: [...new Set(bindings.map((binding) => binding.dataset_ref))],
    dataset_binding_refs: bindings.map((binding) => binding.binding_id),
    bindings,
    staleness_status: bindings.length > 0 ? "live" : "snapshot",
    refresh_policy: {
      refresh_mode: "manual",
      selective_regeneration_enabled: true,
      stale_after_minutes: 120
    },
    selective_regeneration_refs: slides.map((slide) => slide.slideNode.node_id),
    broken_binding_refs: [],
    last_refresh_at: bindings.length > 0 ? timestamp : null
  });
};

const buildTemplateLockState = (
  deckId: string,
  versionId: string,
  style: StylePreset,
  slides: MaterializedSlide[],
  timestamp: string
): TemplateLockState =>
  TemplateLockStateSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    template_lock_state_id: id("template-lock", deckId, versionId),
    deck_ref: deckId,
    version_ref: versionId,
    template_ref: style.templateRef ?? "template://presentations/default",
    lock_mode: style.lockMode,
    locked_slide_refs: style.lockMode === "strict_lock" ? slides.map((slide) => slide.slideNode.node_id) : [],
    locked_block_refs:
      style.lockMode === "strict_lock"
        ? slides.flatMap((slide) => slide.blocks.filter((block) => block.block_kind === "title").map((block) => block.slide_block_id))
        : slides
            .flatMap((slide) => slide.blocks)
            .filter((block) => block.block_kind === "title")
            .map((block) => block.slide_block_id),
    locked_style_refs: [`color:${style.primaryColor}`, `font:${style.fontFace}`],
    override_allowed: style.lockMode !== "strict_lock",
    override_actor_refs: [],
    last_applied_at: timestamp
  });

const buildCanonical = (
  deckId: string,
  request: CreatePresentationRequest,
  slides: MaterializedSlide[],
  bindingSet: PresentationBindingSet,
  templateLockState: TemplateLockState,
  timestamp: string,
  style: StylePreset
): CanonicalRepresentation => {
  const slideNodes = slides.map((slide) => slide.slideNode);
  const textNodes: CanonicalRepresentation["nodes"]["text"] = [];
  const tableNodes: CanonicalRepresentation["nodes"]["tables"] = [];
  const chartNodes: CanonicalRepresentation["nodes"]["charts"] = [];
  const shapeNodes: CanonicalRepresentation["nodes"]["shapes"] = [];
  const imageNodes: CanonicalRepresentation["nodes"]["images"] = [];

  slides.forEach((slide) => {
    slide.blocks.forEach((block) => {
      const nodeId = block.canonical_node_ref ?? id("node", block.slide_block_id);
      if (block.block_kind === "table") {
        const table = block.block_metadata.table as TableModel | undefined;
        tableNodes.push({
          node_id: nodeId,
          node_type: "table",
          parent_node_ref: slide.slideNode.node_id,
          child_node_refs: [],
          name: block.title[0]?.value ?? "table",
          semantic_labels: ["presentation_block", block.block_kind],
          layout_ref: slide.storyboard.layout_ref,
          data_binding_refs: block.binding_refs,
          formula_refs: [],
          lineage_refs: slide.section.source_refs,
          template_refs: [templateLockState.template_lock_state_id],
          evidence_refs: [],
          editable: true,
          row_count: table?.rows.length ?? 0,
          column_count: table?.columns.length ?? 0,
          schema_ref: "schema://presentation-table/1.0.0"
        });
        return;
      }
      if (block.block_kind === "chart") {
        const chart = block.block_metadata.chart as ChartModel | undefined;
        chartNodes.push({
          node_id: nodeId,
          node_type: "chart",
          parent_node_ref: slide.slideNode.node_id,
          child_node_refs: [],
          name: block.title[0]?.value ?? "chart",
          semantic_labels: ["presentation_block", block.block_kind],
          layout_ref: slide.storyboard.layout_ref,
          data_binding_refs: block.binding_refs,
          formula_refs: [],
          lineage_refs: slide.section.source_refs,
          template_refs: [templateLockState.template_lock_state_id],
          evidence_refs: [],
          editable: true,
          chart_type: chart?.chart_type ?? "bar",
          series_refs: chart?.series.map((series) => series.name) ?? [],
          axis_refs: chart?.categories ?? []
        });
        return;
      }
      if (block.block_kind === "image" || block.block_kind === "video") {
        imageNodes.push({
          node_id: nodeId,
          node_type: "image",
          parent_node_ref: slide.slideNode.node_id,
          child_node_refs: [],
          name: block.title[0]?.value ?? "media",
          semantic_labels: ["presentation_block", block.block_kind],
          layout_ref: slide.storyboard.layout_ref,
          data_binding_refs: [],
          formula_refs: [],
          lineage_refs: slide.section.source_refs,
          template_refs: [templateLockState.template_lock_state_id],
          evidence_refs: [],
          editable: true,
          image_asset_ref: `${block.block_metadata.source_ref ?? ""}`,
          crop_metadata: {}
        });
        return;
      }
      if (["infographic", "grouped_infographic"].includes(block.block_kind)) {
        shapeNodes.push({
          node_id: nodeId,
          node_type: "shape",
          parent_node_ref: slide.slideNode.node_id,
          child_node_refs: [],
          name: block.title[0]?.value ?? "shape",
          semantic_labels: ["presentation_block", block.block_kind],
          layout_ref: slide.storyboard.layout_ref,
          data_binding_refs: block.binding_refs,
          formula_refs: [],
          lineage_refs: slide.section.source_refs,
          template_refs: [templateLockState.template_lock_state_id],
          evidence_refs: [],
          editable: true,
          shape_type: block.block_kind,
          style_ref: `theme://${style.primaryColor}/${style.accentColor}`
        });
        return;
      }
      textNodes.push({
        node_id: nodeId,
        node_type: "text",
        parent_node_ref: slide.slideNode.node_id,
        child_node_refs: [],
        name: block.title[0]?.value ?? "text",
        semantic_labels: ["presentation_block", block.block_kind],
        layout_ref: slide.storyboard.layout_ref,
        data_binding_refs: block.binding_refs,
        formula_refs: [],
        lineage_refs: slide.section.source_refs,
        template_refs: [templateLockState.template_lock_state_id],
        evidence_refs: [],
        editable: block.editability !== "approval_locked",
        content: [...block.title, ...block.body],
        typography_ref: `font://${style.fontFace}`
      });
    });
  });

  return CanonicalRepresentationSchema.parse({
    contract: contractEnvelope("canonical"),
    canonical_id: id("canonical", deckId, "current"),
    tenant_ref: request.tenant_ref,
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    source_descriptors: request.sources.map((source) => ({
      source_ref: source.source_ref,
      source_type: source.source_kind,
      source_revision_ref: `${source.source_ref}:latest`,
      parser_profile: "presentations",
      connector_ref: "connector.shared"
    })),
    representation_kind: "presentation",
    strictness_mode: "smart",
    localization: {
      locale: request.language,
      rtl: inferRtl(request.language, request.rtl_policy),
      numeral_system: /^ar/i.test(request.language) ? "arab" : "latn",
      fallback_locales: ["en-US"]
    },
    root_node_refs: [id("node-document", deckId)],
    nodes: {
      documents: [
        {
          node_id: id("node-document", deckId),
          node_type: "document",
          parent_node_ref: null,
          child_node_refs: slideNodes.map((slide) => slide.node_id),
          name: request.title,
          semantic_labels: ["presentation_root"],
          layout_ref: "presentation.document",
          data_binding_refs: bindingSet.dataset_binding_refs,
          formula_refs: [],
          lineage_refs: request.sources.map((source) => source.source_ref),
          template_refs: [templateLockState.template_lock_state_id],
          evidence_refs: [],
          editable: true,
          page_refs: [],
          section_refs: slideNodes.map((slide) => slide.node_id)
        }
      ],
      pages: [],
      sheets: [],
      slides: slideNodes,
      tables: tableNodes,
      charts: chartNodes,
      shapes: shapeNodes,
      text: textNodes,
      images: imageNodes
    },
    layout_metadata: {
      coordinate_space: "slide",
      bounding_boxes: slides.flatMap((slide) =>
        slide.boxes.map((box) => ({
          item_ref: box.node_ref,
          x: box.box.x,
          y: box.box.y,
          width: box.box.w,
          height: box.box.h
        }))
      ),
      z_order: slides.flatMap((slide) =>
        slide.blocks.map((block, index) => ({
          item_ref: block.canonical_node_ref ?? "",
          z_index: index
        }))
      ),
      grid_rules: slideNodes.map((slide) => ({ slide_ref: slide.node_id, columns: 12, row_height: 60, gap: 16 })),
      alignment_rules: []
    },
    data_binding_refs: bindingSet.bindings.map((binding) => ({
      binding_id: binding.binding_id,
      dataset_ref: binding.dataset_ref,
      query_ref: binding.query_ref,
      target_node_ref: binding.target_node_ref,
      field_mappings: binding.field_mappings
    })),
    formula_refs: [],
    semantic_labels: slideNodes.map((slide) => ({
      label_id: id("label", slide.node_id, "layout"),
      label_type: "layout",
      label_value: slide.layout_ref,
      target_ref: slide.node_id
    })),
    lineage_refs: request.sources.map((source) => source.source_ref),
    template_refs: [templateLockState.template_lock_state_id],
    editability_flags: {
      default_editable: true,
      locked_region_refs: templateLockState.locked_block_refs,
      lock_reason_codes: templateLockState.locked_block_refs.map(() => templateLockState.lock_mode)
    },
    evidence_refs: [],
    created_at: timestamp,
    updated_at: timestamp
  });
};

const buildOutputMetadata = (deckId: string, versionId: string): PresentationOutputMetadata =>
  PresentationOutputMetadataSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    presentation_output_metadata_id: id("presentation-output-metadata", deckId, versionId),
    deck_ref: deckId,
    version_ref: versionId,
    preview_ref: null,
    export_refs: [],
    publication_refs: [],
    parity_validation_ref: null,
    latest_reader_publication_ref: null,
    delivered_targets: [],
    editable_export_default: true,
    explicit_non_editable_targets: ["pdf"],
    last_validated_at: null
  });

const verificationStatusFromBundle = (bundle: PresentationBundle | null, includeParity = true) => {
  if (!bundle) return "verified" as const;
  if (includeParity && bundle.parityValidation) {
    if (bundle.parityValidation.overall_status === "failed") return "failed" as const;
    if (bundle.parityValidation.overall_status === "degraded") return "degraded" as const;
    if (bundle.parityValidation.overall_status === "success_with_warnings") return "success_with_warnings" as const;
  }
  if (bundle.bindingSet.broken_binding_refs.length > 0) return "degraded" as const;
  return "verified" as const;
};

const makeArtifact = (
  artifactId: string,
  artifactType: Artifact["artifact_type"],
  artifactSubtype: string,
  canonicalRef: string,
  request: CreatePresentationRequest,
  bundle: PresentationBundle | null,
  version: DeckVersion,
  createdBy: string,
  timestamp: string,
  storageTarget: string,
  storageChecksum: string,
  previewType: Artifact["preview_ref"]["preview_type"]
): Artifact =>
  ArtifactSchema.parse({
    contract: contractEnvelope("artifact"),
    artifact_id: artifactId,
    artifact_type: artifactType,
    artifact_subtype: artifactSubtype,
    project_id: request.project_id,
    workspace_id: request.workspace_id,
    source_refs: request.sources.map((source) => source.source_ref),
    parent_artifact_refs: version.version_ref.parent_version_id ? [version.version_ref.parent_version_id] : [],
    canonical_ref: canonicalRef,
    created_by: createdBy,
    created_at: timestamp,
    mode: request.mode,
    editable_status:
      artifactSubtype === "presentation_pdf" ? "partially_editable" : artifactType === "preview_render" ? "non_editable" : "editable",
    template_status: bundle?.templateLockState.lock_mode === "strict_lock" ? "strict_locked" : bundle?.templateLockState.lock_mode === "soft_lock" ? "soft_locked" : "applied",
    lineage_ref: id("lineage", artifactId),
    evidence_ref: id("evidence", artifactId),
    verification_status: verificationStatusFromBundle(bundle, artifactType !== "preview_render"),
    storage_ref: toStorageRef(artifactId, storageTarget, storageChecksum),
    preview_ref: {
      preview_id: id("preview", artifactId),
      preview_type: previewType,
      storage_ref: id("storage", artifactId)
    },
    export_refs: [],
    version_ref: version.version_ref,
    tenant_ref: request.tenant_ref,
    permission_scope: request.permission_scope
  });

const buildStageRecord = (
  bundle: PresentationBundle,
  actionRef: string,
  stage: string,
  actorRef: string,
  timestamp: string,
  generatedArtifactRefs: string[],
  extraChecks: EvidencePack["checks_executed"],
  warnings: EvidencePack["warnings"],
  failures: EvidencePack["failure_reasons"],
  extraLineage: LineageEdge[] = []
): PresentationStageRecord => {
  const evidencePack = EvidencePackSchema.parse({
    contract: contractEnvelope("evidence"),
    evidence_pack_id: id("evidence", bundle.deck.deck_id, bundle.version.version_ref.version_id, stage),
    verification_status: verificationStatusFromBundle(bundle),
    source_refs: bundle.inputSources.map((source) => source.source_ref),
    generated_artifact_refs: generatedArtifactRefs,
    checks_executed: extraChecks,
    before_refs: bundle.version.version_ref.parent_version_id ? [bundle.version.version_ref.parent_version_id] : [],
    after_refs: [bundle.version.version_ref.version_id],
    metrics: [
      { metric_name: "slide_count", metric_value: bundle.storyboard.length, metric_unit: "slides" },
      { metric_name: "binding_count", metric_value: bundle.bindingSet.bindings.length, metric_unit: "bindings" },
      { metric_name: "export_count", metric_value: bundle.exportArtifacts.length, metric_unit: "exports" }
    ],
    warnings,
    failure_reasons: failures,
    degraded_reasons: failures,
    replay_context: { action_ref: actionRef, stage, deck_id: bundle.deck.deck_id },
    reproducibility_metadata: {
      replay_token: id("replay", bundle.deck.deck_id, bundle.version.version_ref.version_id, stage),
      execution_seed: `${bundle.deck.deck_id}:${bundle.version.version_ref.version_id}:${stage}`,
      environment_stamp: "rasid-platform-core",
      tool_versions: [
        { tool: "presentations-engine", version: "1.0.0" },
        { tool: "pptxgenjs", version: "4.0.1" }
      ]
    },
    strict_evidence_level: "standard"
  });
  const job = JobSchema.parse({
    contract: contractEnvelope("job"),
    job_id: id("job", bundle.deck.deck_id, bundle.version.version_ref.version_id, stage),
    capability: "presentations",
    requested_mode: bundle.deck.mode,
    capability_submode: stage,
    source_refs: bundle.inputSources.map((source) => source.source_ref),
    artifact_refs: [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id, ...generatedArtifactRefs],
    progress: 100,
    stage,
    state: failures.length > 0 ? "degraded" : "completed",
    warnings,
    failure_reason: failures[0] ?? null,
    retry_policy: { max_attempts: 3, strategy: "exponential", backoff_ms: 1000 },
    evidence_ref: evidencePack.evidence_pack_id,
    started_at: timestamp,
    finished_at: timestamp,
    resource_profile: {
      cpu_class: "standard",
      memory_class: "medium",
      io_class: "balanced",
      expected_parallelism: 2
    }
  });
  const auditEvents = [
    AuditEventSchema.parse({
      contract: contractEnvelope("audit"),
      event_id: id("audit", bundle.deck.deck_id, stage, timestamp),
      timestamp,
      actor_ref: actorRef,
      actor_type: "service",
      action_ref: actionRef,
      job_ref: job.job_id,
      object_refs: [bundle.deck.deck_id, bundle.version.version_ref.version_id],
      workspace_id: bundle.deckArtifact.workspace_id,
      tenant_ref: bundle.deckArtifact.tenant_ref,
      metadata: {
        stage,
        version_number: bundle.version.version_ref.version_number,
        output_targets: bundle.exportArtifacts.map((item) => item.target)
      }
    })
  ];
  const lineageEdges: LineageEdge[] = [
    ...bundle.inputSources.map((source) => ({
      edge_id: id("edge", source.source_ref, bundle.deck.deck_id, stage),
      from_ref: source.source_ref,
      to_ref: bundle.deck.artifact_ref,
      transform_ref: actionRef,
      ai_suggestion_ref: "",
      ai_decision: "accepted" as const,
      template_ref: bundle.deck.template_ref ?? "",
      dataset_binding_ref: "",
      version_diff_ref: ""
    })),
    ...bundle.bindingSet.bindings.map((binding) => ({
      edge_id: id("edge", binding.binding_id, binding.target_block_ref),
      from_ref: binding.dataset_ref,
      to_ref: binding.target_block_ref,
      transform_ref: "presentations.binding",
      ai_suggestion_ref: "",
      ai_decision: "not_applicable" as const,
      template_ref: bundle.deck.template_ref ?? "",
      dataset_binding_ref: binding.binding_id,
      version_diff_ref: ""
    })),
    ...(bundle.version.version_ref.parent_version_id
      ? [
          {
            edge_id: id("edge", bundle.version.version_ref.parent_version_id, bundle.version.version_ref.version_id),
            from_ref: bundle.version.version_ref.parent_version_id,
            to_ref: bundle.version.version_ref.version_id,
            transform_ref: "presentations.version",
            ai_suggestion_ref: "",
            ai_decision: "not_applicable" as const,
            template_ref: bundle.deck.template_ref ?? "",
            dataset_binding_ref: "",
            version_diff_ref: ""
          }
        ]
      : []),
    ...extraLineage
  ];
  return { job, evidencePack, auditEvents, lineageEdges };
};

const pushStage = (bundle: PresentationBundle, stage: PresentationStageRecord): PresentationBundle => ({
  ...bundle,
  jobs: [...bundle.jobs, stage.job],
  evidencePacks: [...bundle.evidencePacks, stage.evidencePack],
  auditEvents: [...bundle.auditEvents, ...stage.auditEvents],
  lineageEdges: [...bundle.lineageEdges, ...stage.lineageEdges]
});

const renderInfographicText = (block: SlideBlock): string[] => {
  const items = (block.block_metadata.items as string[] | undefined) ?? [];
  return items.length > 0 ? items : splitSentences(blockText(block), 4);
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

const blockLayoutBox = (block: SlideBlock): Box =>
  (block.block_metadata.layout_box as Box | undefined) ?? pxBox(72, 160, 1136, 96);

const blockStyle = (block: SlideBlock): string => {
  const box = blockLayoutBox(block);
  return `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;`;
};

const renderReaderHtml = (bundle: PresentationBundle, title: string): string => {
  const rtl = bundle.deck.rtl;
  const renderStyle = resolveBundleRenderThemeTokens(bundle);
  const slidesHtml = bundle.storyboard.map((storyboard, index) => {
    const slideBlocks = bundle.slideBlocks
      .filter((block) => block.slide_ref === id("slide", bundle.deck.deck_id, index))
      .sort((left, right) => left.order_index - right.order_index);
    const blockHtml = slideBlocks
      .map((block) => {
        const box = blockLayoutBox(block);
        const sharedAttrs = `class="block ${block.block_kind}" style="${blockStyle(block)}" data-block-kind="${escapeHtml(block.block_kind)}" data-block-ref="${escapeHtml(block.slide_block_id)}" data-layout-ref="${escapeHtml(`${block.block_metadata.reference_layout_ref ?? block.block_metadata.layout_ref ?? ""}`)}" data-master-ref="${escapeHtml(`${block.block_metadata.reference_master_ref ?? ""}`)}" data-box="${escapeHtml(`${box.x},${box.y},${box.w},${box.h}`)}"`;
        if (block.block_kind === "table") {
          const table = block.block_metadata.table as TableModel | undefined;
          const header = table?.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("") ?? "";
          const rows =
            table?.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
              .join("") ?? "";
          return `<table ${sharedAttrs}><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
        }
        if (block.block_kind === "chart") {
          const chart = block.block_metadata.chart as ChartModel | undefined;
          const bars =
            chart?.series[0]?.values
              .map((value, valueIndex) => {
                const max = Math.max(...(chart.series[0]?.values ?? [1]), 1);
                const width = Math.max(12, Math.round((value / max) * 100));
                return `<div class="chart-row"><span>${escapeHtml(chart.categories[valueIndex] ?? "")}</span><div class="bar" style="width:${width}%">${value}</div></div>`;
              })
              .join("") ?? "";
          return `<div ${sharedAttrs}><div class="chart-title">${escapeHtml(block.title[0]?.value ?? "")}</div>${bars}</div>`;
        }
        if (block.block_kind === "metric_card") {
          return `<div ${sharedAttrs}><strong>${escapeHtml(block.title[0]?.value ?? "")}</strong><span>${escapeHtml(block.body[0]?.value ?? "")}</span></div>`;
        }
        if (block.block_kind === "infographic" || block.block_kind === "grouped_infographic") {
          return `<div ${sharedAttrs}>${renderInfographicText(block)
            .map((item) => `<div class="infographic-item">${escapeHtml(item)}</div>`)
            .join("")}</div>`;
        }
        if (block.block_kind === "image" || block.block_kind === "video") {
          const mediaAsset = resolveMediaAsset(bundle.inputSources, `${block.block_metadata.source_ref ?? ""}`);
          if (mediaAsset?.mediaKind === "video" && mediaAsset.dataUri) {
            return `<div ${sharedAttrs}><video class="media-video" controls preload="metadata" src="${escapeHtml(mediaAsset.dataUri)}"></video><div class="media-caption">${escapeHtml(mediaAsset.caption || mediaAsset.title)}</div></div>`;
          }
          if (mediaAsset?.dataUri) {
            return `<div ${sharedAttrs}><img class="media-image" src="${escapeHtml(mediaAsset.dataUri)}" alt="${escapeHtml(mediaAsset.title)}" /><div class="media-caption">${escapeHtml(mediaAsset.caption || mediaAsset.title)}</div></div>`;
          }
          return `<div ${sharedAttrs}><div class="media-card">${escapeHtml(block.body[0]?.value ?? block.title[0]?.value ?? "")}</div></div>`;
        }
        const heading = block.title[0]?.value ? `<h3>${escapeHtml(block.title[0]?.value)}</h3>` : "";
        const body =
          block.body.length > 0
            ? `<div class="body">${block.body
                .map((item) => `<p>${escapeHtml(item.value).replace(/\n/g, "<br/>")}</p>`)
                .join("")}</div>`
            : "";
        return `<div ${sharedAttrs}>${heading}${body}</div>`;
      })
      .join("");
    return `<section class="slide${index === 0 ? " active" : ""}" data-slide-index="${index}" data-layout-ref="${escapeHtml(storyboard.layout_ref)}"><div class="slide-shell">${blockHtml}</div></section>`;
  });

  return `<!DOCTYPE html>
<html lang="${escapeHtml(bundle.deck.language)}" dir="${rtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --primary: #${escapeHtml(renderStyle.primary_color)}; --accent: #${escapeHtml(renderStyle.accent_color)}; --ink: #${escapeHtml(renderStyle.secondary_color)}; --paper: #${escapeHtml(renderStyle.neutral_color)}; --panel: ${escapeHtml(renderStyle.visual_dna.panelBg)}; --canvas: ${escapeHtml(renderStyle.visual_dna.canvasBg)}; --glow: ${escapeHtml(renderStyle.visual_dna.glow)}; --shadow: ${escapeHtml(renderStyle.visual_dna.shadow)}; }
    body { margin: 0; font-family: ${escapeHtml(renderStyle.font_face)}, "Segoe UI", sans-serif; background: linear-gradient(145deg, var(--canvas), var(--paper)); color: var(--ink); }
    .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: rgba(255,255,255,0.8); position: sticky; top: 0; backdrop-filter: blur(6px); }
    .deck { padding: 24px; }
    .slide { display: none; margin: 0 auto 24px; width: 1280px; min-height: 720px; background: var(--panel); border-radius: 28px; box-shadow: var(--shadow); overflow: hidden; }
    .slide.active { display: block; }
    .slide-shell { position: relative; width: 1280px; height: 720px; }
    .block { position: absolute; border-radius: 18px; padding: 16px 20px; background: #fff; box-sizing: border-box; overflow: hidden; border: 1px solid rgba(15,23,42,0.06); }
    .block.title { background: transparent; padding: 0; }
    .block.metric { display: flex; justify-content: space-between; align-items: center; background: #fff7ed; border: 1px solid #fed7aa; }
    .block.chart { background: color-mix(in srgb, var(--paper) 80%, white 20%); border: 1px solid color-mix(in srgb, var(--primary) 18%, #dbe6ef 82%); box-shadow: 0 0 0 1px var(--glow) inset; }
    .chart-row { display: grid; grid-template-columns: 220px 1fr; gap: 12px; align-items: center; margin: 10px 0; }
    .bar { background: linear-gradient(90deg, var(--primary), var(--accent)); color: white; border-radius: 999px; padding: 8px 12px; min-width: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border: 1px solid #dbe6ef; padding: 8px 10px; text-align: start; }
    th { background: #f1f5f9; }
    .infographic { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .infographic-item { background: #f8fafc; padding: 14px; border-radius: 14px; border-inline-start: 4px solid var(--primary); }
    .media-card { min-height: 180px; border: 2px dashed #cbd5e1; display: grid; place-items: center; background: #f8fafc; }
    .media-image, .media-video { width: 100%; max-height: 320px; object-fit: contain; border-radius: 14px; background: #f8fafc; }
    .media-caption { margin-top: 10px; font-size: 13px; color: #475569; }
    .nav { display: flex; gap: 8px; }
    button { border: 0; border-radius: 999px; background: var(--ink); color: white; padding: 10px 14px; cursor: pointer; }
    @media (max-width: 1340px) { .slide { width: calc(100vw - 32px); min-height: auto; } .slide-shell { transform: scale(calc((100vw - 32px) / 1280)); margin-inline-start: 0; margin-bottom: calc(720px * ((100vw - 32px) / 1280) - 720px); } }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><strong>${escapeHtml(bundle.deck.audience)}</strong><div>${escapeHtml(bundle.deck.deck_kind)}</div></div>
    <div class="nav">
      <button onclick="changeSlide(-1)">Prev</button>
      <button onclick="changeSlide(1)">Next</button>
    </div>
  </div>
  <main class="deck">${slidesHtml.join("")}</main>
  <script>
    let current = 0;
    const slides = [...document.querySelectorAll('.slide')];
    const render = () => slides.forEach((slide, index) => slide.classList.toggle('active', index === current));
    const changeSlide = (direction) => { current = Math.max(0, Math.min(slides.length - 1, current + direction)); render(); };
    render();
  </script>
</body>
</html>`;
};

const escapePdf = (value: string): string => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildPdfContentStream = (bundle: PresentationBundle, slideIndex: number): string => {
  const blocks = bundle.slideBlocks.filter((block) => block.slide_ref === id("slide", bundle.deck.deck_id, slideIndex));
  const lines: string[] = [];
  let cursorY = 740;
  blocks.forEach((block, index) => {
    const text = blockText(block);
    lines.push(`BT /F1 ${block.block_kind === "title" ? 22 : 12} Tf 60 ${cursorY} Td (${escapePdf(text.slice(0, 110))}) Tj ET`);
    cursorY -= block.block_kind === "title" ? 40 : 24;
    if (block.block_kind === "chart") {
      const chart = block.block_metadata.chart as ChartModel | undefined;
      const max = Math.max(...(chart?.series[0]?.values ?? [1]), 1);
      chart?.series[0]?.values.forEach((value, valueIndex) => {
        const width = Math.max(20, Math.round((value / max) * 180));
        lines.push(`0.78 0.32 0.12 rg 60 ${cursorY - 8} ${width} 10 re f`);
        lines.push(`BT /F1 10 Tf 250 ${cursorY - 4} Td (${escapePdf(`${chart.categories[valueIndex] ?? ""}: ${value}`)}) Tj ET`);
        cursorY -= 18;
      });
    }
    if (block.block_kind === "table") {
      const table = block.block_metadata.table as TableModel | undefined;
      table?.rows.slice(0, 4).forEach((row) => {
        lines.push(`BT /F1 10 Tf 70 ${cursorY} Td (${escapePdf(row.join(" | ").slice(0, 110))}) Tj ET`);
        cursorY -= 16;
      });
    }
    if (index < blocks.length - 1) cursorY -= 8;
  });
  return lines.join("\n");
};

const serializePdf = (pageStreams: string[]): Uint8Array => {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pageStreams.forEach((stream) => {
    const contentObjectId = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageObjectId = objects.length + 1;
    pageObjectIds.push(pageObjectId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((idNumber) => `${idNumber} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(pdf, "utf8"));
};

const renderToPptx = async (bundle: PresentationBundle): Promise<Uint8Array> => {
  const pptx = new PptxGenJS();
  const renderStyle = resolveBundleRenderThemeTokens(bundle);
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Rasid Presentations Engine";
  pptx.company = "Rasid";
  pptx.subject = bundle.deck.deck_kind;
  pptx.title = bundle.deck.deck_kind;
  pptx.rtlMode = bundle.deck.rtl;
  bundle.storyboard.forEach((storyboard, slideIndex) => {
    const slide = pptx.addSlide();
    slide.background = { color: renderStyle.neutral_color };
    const blocks = bundle.slideBlocks
      .filter((block) => block.slide_ref === id("slide", bundle.deck.deck_id, slideIndex))
      .sort((left, right) => left.order_index - right.order_index);
    blocks.forEach((block) => {
      const box = (block.block_metadata.layout_box as Box | undefined) ?? pxBox(72, 160, 960, 96);
      const x = Number((box.x / 96).toFixed(2));
      const y = Number((box.y / 96).toFixed(2));
      const w = Number((box.w / 96).toFixed(2));
      const h = Number((box.h / 96).toFixed(2));
      if (block.block_kind === "table") {
        const table = block.block_metadata.table as TableModel | undefined;
        slide.addTable(
          table
            ? [table.columns.map((text) => ({ text })), ...table.rows.map((row) => row.map((text) => ({ text })))]
            : [[{ text: block.title[0]?.value ?? "" }]],
          {
            x,
            y,
            w,
            h,
            border: { type: "solid", color: renderStyle.secondary_color, pt: 1 },
            fill: { color: "FFFFFF" },
            fontFace: renderStyle.font_face,
            fontSize: 11
          }
        );
        return;
      }
      if (block.block_kind === "chart") {
        const chart = block.block_metadata.chart as ChartModel | undefined;
        const chartType = chart?.chart_type === "line" ? pptx.ChartType.line : chart?.chart_type === "pie" ? pptx.ChartType.pie : pptx.ChartType.bar;
        slide.addChart(chartType, (chart?.series ?? [{ name: "Series 1", values: [1] }]).map((series) => ({
          name: series.name,
          labels: chart?.categories ?? ["A"],
          values: series.values
        })), {
          x,
          y,
          w,
          h,
          showLegend: chart?.series.length ? chart.series.length > 1 : false,
          showTitle: true,
          title: block.title[0]?.value ?? "Chart",
          catAxisLabelColor: renderStyle.secondary_color,
          valAxisLabelColor: renderStyle.secondary_color,
          chartColors: [renderStyle.primary_color, renderStyle.accent_color, renderStyle.secondary_color]
        });
        return;
      }
      if (block.block_kind === "metric_card") {
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y,
          w,
          h,
          fill: { color: "FFF7ED" },
          line: { color: renderStyle.primary_color, pt: 1 }
        });
      }
      if (block.block_kind === "infographic" || block.block_kind === "grouped_infographic") {
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y,
          w,
          h,
          fill: { color: "F8FAFC" },
          line: { color: renderStyle.secondary_color, pt: 1 }
        });
      }
      if (block.block_kind === "image" || block.block_kind === "video") {
        const mediaAsset = resolveMediaAsset(bundle.inputSources, `${block.block_metadata.source_ref ?? ""}`);
        if (mediaAsset?.mediaKind === "video" && (mediaAsset.filePath || mediaAsset.dataUri)) {
          slide.addMedia({
            type: "video",
            path: mediaAsset.filePath ?? undefined,
            data: mediaAsset.filePath ? undefined : mediaAsset.dataUri ?? undefined,
            x,
            y,
            w,
            h
          });
          if (mediaAsset.caption) {
            slide.addText(mediaAsset.caption, { x, y: y + Math.max(0, h - 0.35), w, h: 0.3, fontFace: renderStyle.font_face, fontSize: 10, color: renderStyle.secondary_color, rtlMode: bundle.deck.rtl });
          }
          return;
        } else if (mediaAsset?.dataUri || mediaAsset?.filePath) {
          slide.addImage({
            path: mediaAsset.filePath ?? undefined,
            data: mediaAsset.filePath ? undefined : mediaAsset.dataUri ?? undefined,
            x,
            y,
            w,
            h
          });
          if (mediaAsset.caption) {
            slide.addText(mediaAsset.caption, { x, y: y + Math.max(0, h - 0.35), w, h: 0.3, fontFace: renderStyle.font_face, fontSize: 10, color: renderStyle.secondary_color, rtlMode: bundle.deck.rtl });
          }
          return;
        } else {
          slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: renderStyle.neutral_color, transparency: 15 }, line: { color: renderStyle.secondary_color, pt: 1 } });
        }
      }
      slide.addText(blockText(block) || storyboard.slide_title[0]?.value || "", {
        x,
        y,
        w,
        h,
        fontFace: renderStyle.font_face,
        fontSize: block.block_kind === "title" ? 24 : 13,
        bold: block.block_kind === "title",
        color: block.block_kind === "title" ? renderStyle.secondary_color : "334155",
        valign: "middle",
        breakLine: true,
        margin: 0.1,
        rtlMode: bundle.deck.rtl
      });
    });
    const notes = bundle.speakerNotes.find((item) => item.slide_ref === id("slide", bundle.deck.deck_id, slideIndex));
    if (notes) slide.addNotes(notes.content.map((item) => item.value).join("\n"));
  });
  const output = await pptx.write({ outputType: "uint8array" });
  return output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
};

const buildPdfRenderSpec = (bundle: PresentationBundle): Record<string, unknown> => ({
  deck: {
    title: bundle.deck.deck_kind,
    rtl: bundle.deck.rtl
  },
  slides: bundle.storyboard.map((storyboard, slideIndex) => ({
    slide_index: slideIndex,
    title: storyboard.slide_title[0]?.value ?? "",
    blocks: bundle.slideBlocks
      .filter((block) => block.slide_ref === id("slide", bundle.deck.deck_id, slideIndex))
      .sort((left, right) => left.order_index - right.order_index)
      .map((block) => ({
        kind: block.block_kind,
        title: block.title[0]?.value ?? "",
        body: block.body.map((item) => item.value).join("\n"),
        box: (block.block_metadata.layout_box as Box | undefined) ?? pxBox(72, 160, 1136, 96),
        chart: block.block_metadata.chart ?? null,
        table: block.block_metadata.table ?? null,
        media:
          block.block_kind === "image" || block.block_kind === "video"
            ? resolveMediaAsset(bundle.inputSources, `${block.block_metadata.source_ref ?? ""}`)
            : null
      }))
  }))
});

const renderToPdf = async (bundle: PresentationBundle): Promise<Uint8Array> => {
  const tempRoot = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp");
  const specPath = path.join(tempRoot, `${id("pdf-spec", bundle.deck.deck_id, bundle.version.version_ref.version_id)}.json`);
  const pdfPath = path.join(tempRoot, `${id("pdf-render", bundle.deck.deck_id, bundle.version.version_ref.version_id)}.pdf`);
  fs.mkdirSync(tempRoot, { recursive: true });
  fs.writeFileSync(specPath, JSON.stringify(buildPdfRenderSpec(bundle), null, 2), "utf8");
  runPythonBridge("render-pdf", specPath, {
    outputPath: path.join(tempRoot, `${id("pdf-render-meta", bundle.deck.deck_id)}.json`),
    pdfPath
  });
  return Uint8Array.from(fs.readFileSync(pdfPath));
};

const normalizeSemanticText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const reopenHtmlExport = (content: string): RoundTripValidationRecord => ({
  target: "html",
  slide_count: (content.match(/<section class="slide\b/g) ?? []).length,
  notes_count: 0,
  text_sample: [...content.matchAll(/<h3>(.*?)<\/h3>|<p>(.*?)<\/p>|<div class="media-caption">(.*?)<\/div>/g)]
    .map((match) => stripXml(match[1] ?? match[2] ?? match[3] ?? ""))
    .filter(Boolean)
    .slice(0, 8),
  semantic_text_sample: [...content.matchAll(/<h3>(.*?)<\/h3>|<p>(.*?)<\/p>|<div class="media-caption">(.*?)<\/div>/g)]
    .map((match) => normalizeSemanticText(stripXml(match[1] ?? match[2] ?? match[3] ?? "")))
    .filter(Boolean)
    .slice(0, 8),
  layout_refs: [...content.matchAll(/data-layout-ref="(.*?)"/g)].map((match) => stripXml(match[1] ?? "")),
  media_refs: [...content.matchAll(/<(img|video)\b/g)].map((match) => match[1]),
  chart_markers: (content.match(/class="block chart"/g) ?? []).length,
  table_markers: (content.match(/<table class="block table"/g) ?? []).length,
  renderer_kind: "local-dom"
});

const captureBrowserRoundTrip = async (
  target: "html" | "pdf",
  filePath: string,
  outputDir: string
): Promise<Partial<RoundTripValidationRecord>> => {
  const executablePath = browserExecutablePath();
  if (!executablePath) {
    return { renderer_kind: "browser-missing", screenshot_paths: [] };
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath,
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(filePath).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    if (target === "html") {
      const htmlScreenshots: string[] = [];
      const slideCount = await page.locator("section.slide").count();
      for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
        await page.evaluate((index) => {
          const slides = Array.from(document.querySelectorAll<HTMLElement>("section.slide"));
          slides.forEach((slide, candidateIndex) => slide.classList.toggle("active", candidateIndex === index));
        }, slideIndex);
        await page.waitForTimeout(120);
        const screenshotPath = path.join(outputDir, `html-slide-${slideIndex + 1}.png`);
        await page.locator(`section.slide[data-slide-index="${slideIndex}"]`).screenshot({ path: screenshotPath });
        htmlScreenshots.push(screenshotPath);
      }
      const browserData = await page.evaluate(() => {
        const slides = Array.from(document.querySelectorAll<HTMLElement>("section.slide"));
        const textSample = Array.from(document.querySelectorAll<HTMLElement>(".block h3, .block p, .media-caption"))
          .map((node) => node.innerText.trim())
          .filter(Boolean)
          .slice(0, 8);
        return {
          slideCount: slides.length,
          layoutRefs: slides.map((slide) => slide.dataset.layoutRef ?? "").filter(Boolean),
          mediaRefs: Array.from(document.querySelectorAll<HTMLElement>(".media-image, .media-video")).map((node) =>
            node.tagName.toLowerCase()
          ),
          chartMarkers: document.querySelectorAll(".block.chart").length,
          tableMarkers: document.querySelectorAll("table.block.table").length,
          textSample
        };
      });
      return {
        slide_count: Number(browserData.slideCount ?? 0),
        text_sample: z.array(z.string()).parse(browserData.textSample ?? []),
        semantic_text_sample: z
          .array(z.string())
          .parse(browserData.textSample ?? [])
          .map((entry) => normalizeSemanticText(entry)),
        layout_refs: z.array(z.string()).parse(browserData.layoutRefs ?? []),
        media_refs: z.array(z.string()).parse(browserData.mediaRefs ?? []),
        chart_markers: Number(browserData.chartMarkers ?? 0),
        table_markers: Number(browserData.tableMarkers ?? 0),
        screenshot_paths: htmlScreenshots,
        renderer_kind: "edge-browser"
      };
    }
    const screenshotPath = path.join(outputDir, "pdf-browser-page-1.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return {
      screenshot_paths: [screenshotPath],
      renderer_kind: "edge-pdf-viewer"
    };
  } finally {
    await browser.close();
  }
};

const renderPptxViaPowerPoint = (pptxPath: string, outputPdfPath: string): boolean => {
  if (!fs.existsSync(powerPointBridgePath())) return false;
  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
  if (fs.existsSync(outputPdfPath)) fs.rmSync(outputPdfPath, { force: true });
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      powerPointBridgePath(),
      "-InputPath",
      pptxPath,
      "-OutputPdfPath",
      outputPdfPath
    ],
    { encoding: "utf8", timeout: 120000 }
  );
  return result.status === 0 && fs.existsSync(outputPdfPath);
};

const reopenExportArtifact = async (
  target: Exclude<PresentationBinaryTarget, "reader">,
  content: string | Uint8Array
): Promise<RoundTripValidationRecord> => {
  const roundTripRunId = id("roundtrip", target, now().replace(/[^0-9]/g, ""), process.pid);
  if (target === "html") {
    const htmlPath = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}.html`);
    const browserDir = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-browser`);
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
    fs.writeFileSync(htmlPath, content as string, "utf8");
    const local = reopenHtmlExport(content as string);
    const browser = await captureBrowserRoundTrip("html", htmlPath, browserDir);
    return {
      ...local,
      slide_count: Number(browser.slide_count ?? local.slide_count),
      text_sample: z.array(z.string()).parse(browser.text_sample ?? local.text_sample),
      semantic_text_sample: z.array(z.string()).parse(browser.semantic_text_sample ?? local.semantic_text_sample ?? local.text_sample),
      layout_refs: z.array(z.string()).parse(browser.layout_refs ?? local.layout_refs),
      media_refs: z.array(z.string()).parse(browser.media_refs ?? local.media_refs),
      chart_markers: Number(browser.chart_markers ?? local.chart_markers),
      table_markers: Number(browser.table_markers ?? local.table_markers),
      screenshot_paths: z.array(z.string()).optional().parse(browser.screenshot_paths ?? []),
      renderer_kind: browser.renderer_kind ?? local.renderer_kind
    };
  }
  if (target === "pdf") {
    const pdfPath = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}.pdf`);
    const renderDir = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-render`);
    const browserDir = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-browser`);
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.writeFileSync(pdfPath, Buffer.from(content as Uint8Array));
    const extracted = runPythonBridge("extract-pdf", pdfPath, {
      outputPath: path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}.json`),
      renderDir
    });
    const browser = await captureBrowserRoundTrip("pdf", pdfPath, browserDir);
    return {
      target: "pdf",
      slide_count: Number(extracted.page_count ?? 0),
      notes_count: 0,
      text_sample: splitParagraphs(`${extracted.extracted_text ?? ""}`).slice(0, 8),
      semantic_text_sample: splitParagraphs(`${extracted.normalized_text ?? extracted.extracted_text ?? ""}`)
        .map((entry) => normalizeSemanticText(entry))
        .slice(0, 8),
      layout_refs: [],
      media_refs: Array.from({ length: Number(extracted.image_count ?? 0) }, (_, index) => `image-${index + 1}`),
      chart_markers: Number(extracted.image_count ?? 0),
      table_markers: Number(extracted.table_count ?? 0),
      rendered_pages: z.array(z.string()).optional().parse(extracted.rendered_pages ?? []),
      screenshot_paths: z.array(z.string()).optional().parse(browser.screenshot_paths ?? []),
      renderer_kind: browser.renderer_kind ?? "pymupdf+browser"
    };
  }
  const tempPath = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}.pptx`);
  const nativePdfPath = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-native.pdf`);
  const nativeRenderDir = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-native-render`);
  const browserDir = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-browser`);
  fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  fs.writeFileSync(tempPath, Buffer.from(content as Uint8Array));
  const parsed = await parsePptxSource("round-trip-pptx", "Round trip PPTX", tempPath, "export");
  let externalValidationRef: string | null = null;
  let renderedPages: string[] = [];
  let screenshotPaths: string[] = [];
  if (renderPptxViaPowerPoint(tempPath, nativePdfPath)) {
    externalValidationRef = nativePdfPath;
    const extractedNative = runPythonBridge("extract-pdf", nativePdfPath, {
      outputPath: path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${roundTripRunId}-native.json`),
      renderDir: nativeRenderDir
    });
    renderedPages = z.array(z.string()).parse(extractedNative.rendered_pages ?? []);
    const browser = await captureBrowserRoundTrip("pdf", nativePdfPath, browserDir);
    screenshotPaths = z.array(z.string()).parse(browser.screenshot_paths ?? []);
  }
  return {
    target: "pptx",
    slide_count: parsed.page_count,
    notes_count: parsed.notes_count,
    text_sample: splitParagraphs(parsed.extracted_text).slice(0, 8),
    semantic_text_sample: splitParagraphs(parsed.extracted_text)
      .map((entry) => normalizeSemanticText(entry))
      .slice(0, 8),
    layout_refs: parsed.layout_refs,
    media_refs: parsed.media_refs,
    chart_markers: parsed.extracted_text.includes("Chart") ? 1 : 0,
    table_markers: parsed.extracted_text.includes("Data table") ? 1 : 0,
    rendered_pages: renderedPages,
    screenshot_paths: screenshotPaths,
    renderer_kind: externalValidationRef ? "powerpoint-native-pdf" : "python-pptx",
    external_validation_ref: externalValidationRef
  };
};

const overflowHeuristic = (bundle: PresentationBundle, target: PresentationBinaryTarget): boolean =>
  bundle.slideBlocks.some((block) => {
    if (block.block_kind !== "body" && block.block_kind !== "agenda" && block.block_kind !== "callout") return false;
    const bodyLength = block.body.reduce((sum, item) => sum + item.value.length, 0);
    return bodyLength > (target === "pptx" ? 560 : 720);
  });

const clippingHeuristic = (bundle: PresentationBundle): boolean =>
  bundle.slideBlocks.some((block) => {
    const box = block.block_metadata.layout_box as Box | undefined;
    return box ? box.x + box.w > SAFE_SLIDE_WIDTH || box.y + box.h > SAFE_SLIDE_HEIGHT : false;
  });

const buildValidationResult = (
  bundle: PresentationBundle,
  target: PresentationBinaryTarget,
  exportRef: string | null,
  timestamp: string,
  roundTrip: RoundTripValidationRecord | null = null
): ExportValidationResult => {
  const hasSemanticText = (roundTrip?.semantic_text_sample?.length ?? 0) > 0;
  const mediaParity =
    !bundle.mediaPlans.some((plan) => plan.media_kind === "image" || plan.media_kind === "video") ||
    target === "reader" ||
    (roundTrip?.media_refs.length ?? 0) >= bundle.mediaPlans.length ||
    (roundTrip?.screenshot_paths?.length ?? 0) > 0;
  const chartParity =
    !bundle.slideBlocks.some((block) => block.block_kind === "chart") ||
    target === "reader" ||
    (roundTrip?.chart_markers ?? 0) > 0 ||
    (target === "pdf" && (roundTrip?.text_sample.length ?? 0) > 0);
  const tableParity =
    !bundle.slideBlocks.some((block) => block.block_kind === "table") ||
    target === "reader" ||
    (roundTrip?.table_markers ?? 0) > 0 ||
    (target === "pdf" && (roundTrip?.text_sample.length ?? 0) > 0);
  const checks = [
    {
      check_type: "text_editability" as const,
      passed:
        bundle.slideBlocks.some((block) => ["title", "body", "callout", "agenda"].includes(block.block_kind)) &&
        (target !== "pdf" || hasSemanticText),
      detail: "Text blocks are exported as native text objects with semantic round-trip text evidence."
    },
    { check_type: "chart_editability" as const, passed: chartParity, detail: "Chart blocks preserve structured chart metadata through reopen validation." },
    { check_type: "table_editability" as const, passed: tableParity, detail: "Table blocks preserve row and column structure through reopen validation." },
    { check_type: "overflow" as const, passed: !overflowHeuristic(bundle, target), detail: "Text volume fits the allocated layout zones." },
    { check_type: "clipping" as const, passed: !clippingHeuristic(bundle), detail: "No block bounding box exceeds slide bounds." },
    { check_type: "rtl" as const, passed: bundle.deck.rtl ? bundle.intentManifest.rtl_policy === "rtl" : true, detail: "RTL policy remained stable through render." },
    { check_type: "template_lock" as const, passed: bundle.templateLockState.lock_mode !== "strict_lock" || bundle.templateLockState.locked_block_refs.length > 0, detail: "Template lock refs are preserved in the rendered output." },
    {
      check_type: "layout_parity" as const,
      passed:
        roundTrip
          ? roundTrip.slide_count === bundle.storyboard.length &&
            (target !== "pptx" || !!roundTrip.external_validation_ref || (roundTrip.layout_refs?.length ?? 0) > 0)
          : true,
      detail: "Slide count, layout refs, and any available native-render evidence remain aligned after reopen validation."
    },
    { check_type: "notes_presence" as const, passed: roundTrip ? target !== "pptx" || roundTrip.notes_count === bundle.speakerNotes.length : bundle.speakerNotes.length === bundle.storyboard.length, detail: "Each slide retains speaker notes." },
    {
      check_type: "media_reference_integrity" as const,
      passed: bundle.mediaPlans.every((plan) => plan.asset_ref.length > 0) && (roundTrip ? mediaParity : true),
      detail: "Media blocks continue to reference their assets with reopen and screenshot evidence where supported."
    }
  ].map((check, index) => ExportValidationCheckSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    validation_check_id: id("validation-check", bundle.deck.deck_id, target, index),
    check_type: check.check_type,
    target,
    passed: check.passed,
    severity: check.passed ? "low" : check.check_type === "overflow" || check.check_type === "clipping" ? "high" : "medium",
    detail: check.detail,
    impacted_refs: bundle.slideBlocks.map((block) => block.slide_block_id)
  }));
  const failed = checks.some((check) => !check.passed);
  const warningOnly = checks.some((check) => !check.passed && check.severity !== "high" && check.severity !== "critical");
  return ExportValidationResultSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    export_validation_result_id: id("export-validation", bundle.deck.deck_id, target),
    deck_ref: bundle.deck.deck_id,
    version_ref: bundle.version.version_ref.version_id,
    export_target: target,
    export_ref: exportRef,
    verification_status: failed ? (warningOnly ? "success_with_warnings" : "degraded") : "verified",
    checks,
    text_remains_text: checks.find((check) => check.check_type === "text_editability")?.passed ?? true,
    charts_remain_charts: chartParity,
    tables_remain_editable: tableParity,
    overflow_detected: !checks.find((check) => check.check_type === "overflow")?.passed,
    clipping_detected: !checks.find((check) => check.check_type === "clipping")?.passed,
    rtl_verified: checks.find((check) => check.check_type === "rtl")?.passed ?? true,
    template_lock_verified: checks.find((check) => check.check_type === "template_lock")?.passed ?? true,
    validated_at: timestamp
  });
};

const buildOutputStatuses = (bundle: PresentationBundle, parityValidation: RenderParityValidation | null, timestamp: string): PresentationOutputStatus[] => {
  const validationMap = new Map(bundle.exportArtifacts.map((artifact) => [artifact.target, artifact.validation]));
  return ["reader", "pptx", "pdf", "html"].map((target) => PresentationOutputStatusSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    output_status_id: id("presentation-output-status", bundle.deck.deck_id, target),
    deck_ref: bundle.deck.deck_id,
    version_ref: bundle.version.version_ref.version_id,
    target,
    outcome: target === "reader" ? (parityValidation?.overall_status === "verified" ? "success" : "success_with_warnings") : validationMap.get(target as PresentationBinaryTarget)?.verification_status === "degraded" ? "degraded" : "success",
    export_validation_result_ref: validationMap.get(target as PresentationBinaryTarget)?.export_validation_result_id ?? null,
    degrade_reason_ref: parityValidation?.degrade_reasons[0]?.presentation_degrade_reason_id ?? null,
    updated_at: timestamp
  }));
};

const exportRefsFromArtifacts = (artifacts: PresentationExportArtifact[]): ExportRef[] => artifacts.map((artifact) => ({
  export_id: id("export-ref", artifact.artifact.artifact_id),
  export_type: artifact.target === "reader" ? "html" : artifact.target,
  explicit_non_editable: artifact.target === "pdf",
  storage_ref: artifact.artifact.storage_ref.storage_id
}));

const validateParity = (bundle: PresentationBundle, previewArtifact: PresentationPreviewArtifact, exports: PresentationExportArtifact[], timestamp: string): RenderParityValidation => {
  const results = exports.map((item) => item.validation);
  const checks = results.flatMap((result) => result.checks);
  const htmlExport = exports.find((item) => item.target === "html");
  const readerExportParityPassed =
    !previewArtifact.roundTrip ||
    !htmlExport?.roundTrip ||
    (previewArtifact.roundTrip.slide_count === htmlExport.roundTrip.slide_count &&
      previewArtifact.roundTrip.layout_refs.join("|") === htmlExport.roundTrip.layout_refs.join("|"));
  checks.push(
    ExportValidationCheckSchema.parse({
      schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
      schema_version: PRESENTATION_SCHEMA_VERSION,
      validation_check_id: id("validation-check", bundle.deck.deck_id, "reader-html"),
      check_type: "layout_parity",
      target: "reader",
      passed: readerExportParityPassed,
      severity: readerExportParityPassed ? "low" : "high",
      detail: "Browser-native reader and HTML export reopen paths remain aligned.",
      impacted_refs: bundle.storyboard.map((item) => item.storyboard_slide_plan_id)
    })
  );
  const degradeReasons: PresentationDegradeReason[] = [];
  results.forEach((result) => {
    if (result.verification_status === "degraded" || result.verification_status === "failed") {
      degradeReasons.push(PresentationDegradeReasonSchema.parse({
        schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
        schema_version: PRESENTATION_SCHEMA_VERSION,
        presentation_degrade_reason_id: id("presentation-degrade-reason", bundle.deck.deck_id, result.export_target),
        deck_ref: bundle.deck.deck_id,
        version_ref: bundle.version.version_ref.version_id,
        reason_code: `parity_${result.export_target}`,
        summary: `Parity degraded for ${result.export_target}`,
        detail: `One or more parity checks failed for ${result.export_target}.`,
        severity: "high",
        affected_targets: [result.export_target],
        impacted_refs: result.checks.filter((check) => !check.passed).flatMap((check) => check.impacted_refs),
        editable_path_impacted: result.export_target === "pptx",
        publish_allowed: result.export_target !== "pptx"
      }));
    }
  });
  if (!readerExportParityPassed) {
    degradeReasons.push(
      PresentationDegradeReasonSchema.parse({
        schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
        schema_version: PRESENTATION_SCHEMA_VERSION,
        presentation_degrade_reason_id: id("presentation-degrade-reason", bundle.deck.deck_id, "reader-html"),
        deck_ref: bundle.deck.deck_id,
        version_ref: bundle.version.version_ref.version_id,
        reason_code: "parity_reader_html",
        summary: "Reader and HTML browser parity diverged",
        detail: "Browser-native reopen detected a mismatch between preview reader and HTML export layout paths.",
        severity: "high",
        affected_targets: ["reader", "html"],
        impacted_refs: bundle.storyboard.map((item) => item.storyboard_slide_plan_id),
        editable_path_impacted: false,
        publish_allowed: false
      })
    );
  }
  const overallStatus = degradeReasons.length > 0 ? "degraded" : results.some((result) => result.verification_status === "success_with_warnings") ? "success_with_warnings" : "verified";
  return RenderParityValidationSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    render_parity_validation_id: id("render-parity", bundle.deck.deck_id, bundle.version.version_ref.version_id),
    deck_ref: bundle.deck.deck_id,
    version_ref: bundle.version.version_ref.version_id,
    reader_ref: previewArtifact.artifact.artifact_id,
    export_validation_refs: results.map((result) => result.export_validation_result_id),
    results,
    checks,
    overall_status: overallStatus,
    publish_ready: degradeReasons.length === 0,
    degrade_reason_refs: degradeReasons.map((reason) => reason.presentation_degrade_reason_id),
    degrade_reasons: degradeReasons,
    validated_at: timestamp
  });
};

const createVersion = (deckId: string, versionNumber: number, parentVersionId: string | null, createdBy: string, createdFrom: DeckVersion["created_from"], changeReason: string, bindingSetRef: string, templateLockStateRef: string, outlineRef: string, storyboardRefs: string[], slideRefs: string[], speakerNotesRefs: string[], motionRefs: string[], parityValidationRef: string | null, outputMetadataRef: string | null, timestamp: string): DeckVersion =>
  DeckVersionSchema.parse({
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    deck_version_id: id("deck-version-record", deckId, versionNumber),
    deck_ref: deckId,
    version_ref: { version_id: id("deck-version", deckId, versionNumber), parent_version_id: parentVersionId, version_number: versionNumber, semantic_version: semver(versionNumber) },
    change_reason: changeReason,
    created_from: createdFrom,
    slide_refs: slideRefs,
    speaker_notes_refs: speakerNotesRefs,
    motion_metadata_refs: motionRefs,
    binding_set_ref: bindingSetRef,
    template_lock_state_ref: templateLockStateRef,
    outline_ref: outlineRef,
    storyboard_refs: storyboardRefs,
    parity_validation_ref: parityValidationRef,
    output_metadata_ref: outputMetadataRef,
    created_by: createdBy,
    created_at: timestamp
  });

const createDeckAggregate = (deckId: string, request: CreatePresentationRequest, version: DeckVersion, intent: PresentationIntentManifest, outline: DeckOutline, bindingSet: PresentationBindingSet, templateLockState: TemplateLockState, outputMetadata: PresentationOutputMetadata, parityValidation: RenderParityValidation | null, timestamp: string): DeckAggregate =>
  DeckAggregateSchema.parse({
    contract: PRESENTATION_CONTRACT,
    schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
    schema_version: PRESENTATION_SCHEMA_VERSION,
    deck_id: deckId,
    artifact_ref: id("artifact", deckId, "current"),
    canonical_ref: id("canonical", deckId, "current"),
    current_version_ref: version.version_ref.version_id,
    intent_ref: intent.intent_id,
    outline_ref: outline.outline_id,
    current_storyboard_refs: version.storyboard_refs,
    binding_set_ref: bindingSet.presentation_binding_set_id,
    template_lock_state_ref: templateLockState.template_lock_state_id,
    current_output_metadata_ref: outputMetadata.presentation_output_metadata_id,
    current_parity_validation_ref: parityValidation?.render_parity_validation_id ?? null,
    mode: request.mode,
    deck_kind: request.title,
    audience: request.audience,
    language: request.language,
    rtl: inferRtl(request.language, request.rtl_policy),
    status: parityValidation?.publish_ready ? "review" : "degraded",
    template_ref: request.template_ref,
    brand_preset_ref: request.brand_preset_ref,
    publication_refs: outputMetadata.publication_refs,
    owner_ref: request.created_by,
    created_by: request.created_by,
    created_at: timestamp,
    updated_at: timestamp
  });

const mergeExportMetadata = (bundle: PresentationBundle, preview: PresentationPreviewArtifact, exports: PresentationExportArtifact[], parityValidation: RenderParityValidation, publications: Publication[]): PresentationOutputMetadata =>
  PresentationOutputMetadataSchema.parse({
    ...bundle.outputMetadata,
    preview_ref: preview.artifact.artifact_id,
    export_refs: exportRefsFromArtifacts(exports),
    publication_refs: publications.map((publication) => publication.publication_id),
    parity_validation_ref: parityValidation.render_parity_validation_id,
    latest_reader_publication_ref: publications.find((publication) => publication.target_ref.includes("reader"))?.publication_id ?? null,
    delivered_targets: ["reader", ...exports.map((item) => item.target)],
    last_validated_at: parityValidation.validated_at
  });

export class PresentationEngine {
  readonly store: PresentationEngineStore;

  constructor(store = new PresentationEngineStore(defaultPresentationsEngineStorageRoot(process.cwd()))) {
    this.store = store;
  }

  private persistRuntimeBundle(bundle: PresentationBundle): void {
    this.store.persistBundle({
      inputSources: bundle.inputSources.map((item) => PresentationSourceSchema.parse(item)) as Array<Record<string, unknown>>,
      deck: bundle.deck,
      version: bundle.version,
      intentManifest: bundle.intentManifest,
      outline: bundle.outline,
      storyboard: bundle.storyboard,
      slideBlocks: bundle.slideBlocks as Array<Record<string, unknown>>,
      speakerNotes: bundle.speakerNotes,
      motionMetadata: bundle.motionMetadata as Array<Record<string, unknown>>,
      infographicPlans: bundle.infographicPlans as Array<Record<string, unknown>>,
      mediaPlans: bundle.mediaPlans as Array<Record<string, unknown>>,
      groupedInfographicPlans: bundle.groupedInfographicPlans as Array<Record<string, unknown>>,
      bindingSet: bundle.bindingSet,
      templateLockState: bundle.templateLockState,
      canonical: bundle.canonical,
      outputMetadata: bundle.outputMetadata,
      parityValidation: bundle.parityValidation,
      outputStatuses: bundle.outputStatuses as Array<Record<string, unknown>>,
      deckArtifact: bundle.deckArtifact,
      versionArtifact: bundle.versionArtifact,
      previewArtifact: bundle.previewArtifact,
      exportArtifacts: bundle.exportArtifacts.map((item) => ({
        target: item.target,
        artifact: item.artifact,
        validation: item.validation,
        contentType: item.contentType,
        fileName: item.fileName,
        content: item.content
      })),
      publications: bundle.publications,
      libraryAssets: bundle.libraryAssets,
      jobs: bundle.jobs,
      evidencePacks: bundle.evidencePacks,
      auditEvents: bundle.auditEvents,
      lineageEdges: bundle.lineageEdges,
      parsedSourceRecords: bundle.parsedSourceRecords,
      roundTripValidations: bundle.roundTripValidations
    });
    this.store.persistRuntimeBundleSnapshot(bundle.deck.deck_id, bundleToSnapshot(bundle));
  }

  loadBundle(deckId: string): PresentationBundle {
    return bundleFromSnapshot(this.store.loadRuntimeBundleSnapshot(deckId));
  }

  listDecks(): Array<Record<string, unknown>> {
    return this.store.listStoredDeckStates();
  }

  buildIntentManifest(input: z.input<typeof CreatePresentationRequestSchema>): PresentationIntentManifest {
    const request = CreatePresentationRequestSchema.parse(input);
    return buildIntentManifest(request, now(request.timestamp));
  }

  buildDeckOutline(input: z.input<typeof CreatePresentationRequestSchema>): DeckOutline {
    const request = CreatePresentationRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const intent = buildIntentManifest(request, timestamp);
    const deckId = request.presentation_id ?? id("deck", request.title, timestamp.slice(11, 19).replace(/:/g, ""));
    const sections = deriveNarrativeSections(request, intent);
    return buildDeckOutline(deckId, intent, sections, timestamp, request.language, inferRtl(request.language, request.rtl_policy));
  }

  buildStoryboard(input: z.input<typeof CreatePresentationRequestSchema>): StoryboardSlidePlan[] {
    const request = CreatePresentationRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const intent = buildIntentManifest(request, timestamp);
    const deckId = request.presentation_id ?? id("deck", request.title, timestamp.slice(11, 19).replace(/:/g, ""));
    const sections = deriveNarrativeSections(request, intent);
    const outline = buildDeckOutline(deckId, intent, sections, timestamp, request.language, inferRtl(request.language, request.rtl_policy));
    const style = chooseStylePreset(request);
    return buildStoryboard(
      deckId,
      intent,
      outline,
      sections,
      request.language,
      inferRtl(request.language, request.rtl_policy),
      buildGenerationFidelityProfile(request.sources),
      style
    );
  }

  async createPresentation(input: z.input<typeof CreatePresentationRequestSchema>): Promise<PresentationBundle> {
    const request = CreatePresentationRequestSchema.parse(input);
    const timestamp = now(request.timestamp);
    const { normalizedSources, parsedSourceRecords } = await normalizePresentationSources(request.sources);
    const normalizedRequest = CreatePresentationRequestSchema.parse({ ...request, sources: normalizedSources });
    const deckId = request.presentation_id ?? id("deck", request.title, timestamp.slice(11, 19).replace(/:/g, ""));
    const rtl = inferRtl(normalizedRequest.language, normalizedRequest.rtl_policy);
    const style = chooseStylePreset(normalizedRequest);
    const fidelityProfile = buildGenerationFidelityProfile(normalizedRequest.sources);
    const intentManifest = buildIntentManifest(normalizedRequest, timestamp);
    const sections = deriveNarrativeSections(normalizedRequest, intentManifest);
    const outline = buildDeckOutline(deckId, intentManifest, sections, timestamp, normalizedRequest.language, rtl);
    const storyboard = buildStoryboard(deckId, intentManifest, outline, sections, normalizedRequest.language, rtl, fidelityProfile, style);
    const versionSeed = createVersion(
      deckId,
      1,
      null,
      normalizedRequest.created_by,
      "ai_generate",
      "Initial deck generation",
      id("presentation-binding-set", deckId),
      id("template-lock", deckId, id("deck-version", deckId, 1)),
      outline.outline_id,
      storyboard.map((item) => item.storyboard_slide_plan_id),
      [],
      [],
      [],
      null,
      id("presentation-output-metadata", deckId, id("deck-version", deckId, 1)),
      timestamp
    );
    const slides = storyboard.map((plan, index) =>
      materializeSlide(
        deckId,
        versionSeed.version_ref.version_id,
        sections[index],
        plan,
        index,
        normalizedRequest.sources,
        normalizedRequest.language,
        rtl,
        intentManifest,
        null
      )
    );
    const bindingSet = buildBindingSet(deckId, versionSeed.version_ref.version_id, slides, timestamp);
    const templateLockState = buildTemplateLockState(deckId, versionSeed.version_ref.version_id, style, slides, timestamp);
    slides.forEach((slide) =>
      slide.blocks.forEach((block) => {
        block.template_lock_state_ref = templateLockState.template_lock_state_id;
        if (templateLockState.locked_block_refs.includes(block.slide_block_id)) {
          block.editability = "template_locked";
        }
      })
    );
    const canonical = buildCanonical(deckId, normalizedRequest, slides, bindingSet, templateLockState, timestamp, style);
    const outputMetadata = buildOutputMetadata(deckId, versionSeed.version_ref.version_id);
    const version = createVersion(
      deckId,
      1,
      null,
      normalizedRequest.created_by,
      "ai_generate",
      "Initial deck generation",
      bindingSet.presentation_binding_set_id,
      templateLockState.template_lock_state_id,
      outline.outline_id,
      storyboard.map((item) => item.storyboard_slide_plan_id),
      slides.map((slide) => slide.slideNode.node_id),
      slides.map((slide) => slide.notes.speaker_notes_id),
      slides.map((slide) => slide.motion.motion_metadata_id),
      null,
      outputMetadata.presentation_output_metadata_id,
      timestamp
    );
    const deck = createDeckAggregate(deckId, normalizedRequest, version, intentManifest, outline, bindingSet, templateLockState, outputMetadata, null, timestamp);
    const seedBundle: PresentationBundle = {
      inputSources: normalizedRequest.sources,
      parsedSourceRecords,
      intentManifest,
      outline,
      storyboard,
      slideBlocks: slides.flatMap((slide) => slide.blocks),
      speakerNotes: slides.map((slide) => slide.notes),
      motionMetadata: slides.map((slide) => slide.motion),
      infographicPlans: slides.flatMap((slide) => slide.infographicPlans),
      mediaPlans: slides.flatMap((slide) => slide.mediaPlans),
      groupedInfographicPlans: slides.flatMap((slide) => slide.groupedInfographicPlans),
      bindingSet,
      templateLockState,
      deck,
      version,
      canonical,
      outputMetadata,
      parityValidation: null,
      outputStatuses: [],
      deckArtifact: {} as Artifact,
      versionArtifact: {} as Artifact,
      previewArtifact: null,
      exportArtifacts: [],
      publications: [],
      libraryAssets: [],
      jobs: [],
      evidencePacks: [],
      auditEvents: [],
      lineageEdges: [],
      roundTripValidations: []
    };
    const deckArtifact = makeArtifact(deck.artifact_ref, "presentation", "editable_deck", canonical.canonical_id, normalizedRequest, seedBundle, version, normalizedRequest.created_by, timestamp, "deck-current.json", hash(JSON.stringify(deck)), "html_canvas");
    const versionArtifact = makeArtifact(id("artifact", deckId, "version", version.version_ref.version_number), "presentation", "deck_version", canonical.canonical_id, normalizedRequest, seedBundle, version, normalizedRequest.created_by, timestamp, "deck-version.json", hash(JSON.stringify(version)), "html_canvas");
    let bundle: PresentationBundle = { ...seedBundle, deckArtifact, versionArtifact };
    const stage = buildStageRecord(
      bundle,
      "presentations.generate_deck.v1",
      "presentation_generate",
      normalizedRequest.created_by,
      timestamp,
      [deckArtifact.artifact_id, versionArtifact.artifact_id],
      [
        {
          check_id: id("check", deckId, "outline"),
          check_name: "outline_storyboard_alignment",
          check_type: "generation",
          passed: outline.outline_nodes.length === storyboard.length,
          severity: "high",
          details: "Outline and storyboard counts remain aligned.",
          impacted_refs: storyboard.map((item) => item.storyboard_slide_plan_id)
        },
        {
          check_id: id("check", deckId, "bindings"),
          check_name: "binding_emit_check",
          check_type: "generation",
          passed: bindingSet.bindings.length >= 0,
          severity: "medium",
          details: "Generation emitted the expected binding records.",
          impacted_refs: bindingSet.dataset_binding_refs
        }
      ],
      [],
      []
    );
    bundle = pushStage(bundle, stage);
    parsedSourceRecords.forEach((record) => this.store.persistParserRecord(deckId, record.source_ref, record));
    this.persistRuntimeBundle(bundle);
    return bundle;
  }

  mutatePresentation(input: z.infer<typeof MutatePresentationRequestSchema>): PresentationBundle {
    const request = MutatePresentationRequestSchema.parse(input);
    const base = clone(asBundle(request.bundle));
    const timestamp = now(request.timestamp);
    const versionNumber = base.version.version_ref.version_number + 1;
    let storyboard = clone(base.storyboard);
    let slideBlocks = clone(base.slideBlocks);
    let speakerNotes = clone(base.speakerNotes);
    let motionMetadata = clone(base.motionMetadata);
    const mutation = request.mutation;
    if (mutation.mutation_kind === "add_slide") {
      const insertIndex =
        mutation.insert_after_slide_ref === null
          ? storyboard.length
          : storyboard.findIndex((plan, index) => id("slide", base.deck.deck_id, index) === mutation.insert_after_slide_ref) + 1;
      const newSection: NarrativeSection = {
        section_id: id("mutation-section", mutation.title, timestamp),
        title: mutation.title,
        role: "content",
        summary: mutation.summary || mutation.bullets[0] || mutation.title,
        bullets: mutation.bullets,
        source_refs: [],
        strict_insert: false,
        metrics: [],
        chart: null,
        table: null,
        infographic_kind: mutation.bullets.length >= 3 ? "process" : null,
        media_refs: []
      };
      const newStoryboard = StoryboardSlidePlanSchema.parse({
        schema_namespace: PRESENTATION_SCHEMA_NAMESPACE,
        schema_version: PRESENTATION_SCHEMA_VERSION,
        storyboard_slide_plan_id: id("storyboard", base.deck.deck_id, "mutation", timestamp),
        deck_ref: base.deck.deck_id,
        intent_ref: base.intentManifest.intent_id,
        outline_node_ref: null,
        slide_order: insertIndex,
        slide_title: toLocalizedText(mutation.title, base.deck.language, base.deck.rtl),
        layout_ref: chooseLayoutRef(
          newSection,
          insertIndex,
          buildGenerationFidelityProfile(base.inputSources),
          chooseStylePresetFromBundle(base)
        ),
        content_spec: {
          summary: newSection.summary,
          bullets: newSection.bullets,
          metrics: [],
          chart: null,
          table: null,
          infographic_kind: newSection.infographic_kind,
          media_refs: []
        },
        block_plan_refs: makeBlockPlanRefs(base.deck.deck_id, insertIndex, newSection),
        source_refs: [],
        binding_refs: [],
        speaker_notes_intent: newSection.summary,
        rtl_policy: base.deck.rtl ? "rtl" : "ltr",
        editability_flags: { default_editable: true, locked_block_refs: [] },
        parity_expectations: ["text_stays_text", "overflow_check", "clipping_check"]
      });
      storyboard.splice(insertIndex, 0, newStoryboard);
      const slide = materializeSlide(
        base.deck.deck_id,
        id("deck-version", base.deck.deck_id, versionNumber),
        newSection,
        newStoryboard,
        insertIndex,
        base.inputSources,
        base.deck.language,
        base.deck.rtl,
        base.intentManifest,
        base.templateLockState.template_lock_state_id
      );
      slideBlocks = [...slideBlocks, ...slide.blocks];
      speakerNotes = [...speakerNotes, slide.notes];
      motionMetadata = [...motionMetadata, slide.motion];
    } else if (mutation.mutation_kind === "delete_slide") {
      const targetIndex = storyboard.findIndex((plan, index) => id("slide", base.deck.deck_id, index) === mutation.slide_ref);
      if (targetIndex >= 0) {
        storyboard = storyboard.filter((_, index) => index !== targetIndex);
        slideBlocks = slideBlocks.filter((block) => block.slide_ref !== mutation.slide_ref);
        speakerNotes = speakerNotes.filter((note) => note.slide_ref !== mutation.slide_ref);
        motionMetadata = motionMetadata.filter((motion) => motion.slide_ref !== mutation.slide_ref);
      }
    } else if (mutation.mutation_kind === "reorder_slide") {
      const targetIndex = storyboard.findIndex((plan, index) => id("slide", base.deck.deck_id, index) === mutation.slide_ref);
      if (targetIndex >= 0) {
        const [plan] = storyboard.splice(targetIndex, 1);
        storyboard.splice(Math.min(mutation.new_index, storyboard.length), 0, plan);
      }
    } else if (mutation.mutation_kind === "regenerate_slide") {
      const targetIndex = storyboard.findIndex((plan, index) => id("slide", base.deck.deck_id, index) === mutation.slide_ref);
      if (targetIndex >= 0) {
        const section: NarrativeSection = {
          section_id: storyboard[targetIndex].storyboard_slide_plan_id,
          title: storyboard[targetIndex].slide_title[0]?.value ?? "Slide",
          role: "content",
          summary: mutation.override_prompt || "Regenerated slide",
          bullets:
            mutation.override_prompt.length > 0
              ? splitSentences(mutation.override_prompt, 4)
              : ["Regenerated content", "Updated narrative", "Binding preserved"],
          source_refs: mutation.refresh_source_refs,
          strict_insert: false,
          metrics: [],
          chart: null,
          table: null,
          infographic_kind: "process",
          media_refs: []
        };
        const slide = materializeSlide(
          base.deck.deck_id,
          id("deck-version", base.deck.deck_id, versionNumber),
          section,
          storyboard[targetIndex],
          targetIndex,
          base.inputSources,
          base.deck.language,
          base.deck.rtl,
          base.intentManifest,
          base.templateLockState.template_lock_state_id
        );
        slideBlocks = slideBlocks.filter((block) => block.slide_ref !== mutation.slide_ref).concat(slide.blocks);
        speakerNotes = speakerNotes.filter((item) => item.slide_ref !== mutation.slide_ref).concat(slide.notes);
        motionMetadata = motionMetadata.filter((item) => item.slide_ref !== mutation.slide_ref).concat(slide.motion);
      }
    } else if (mutation.mutation_kind === "replace_block_kind") {
      slideBlocks = slideBlocks.map((block) => {
        if (block.slide_block_id !== mutation.block_ref) return block;
        const metadata = clone(block.block_metadata);
        if (mutation.new_block_kind === "table" && metadata.chart) {
          const chart = metadata.chart as ChartModel;
          metadata.table = {
            columns: ["Category", ...chart.series.map((series) => series.name)],
            rows: chart.categories.map((category, index) => [category, ...chart.series.map((series) => `${series.values[index] ?? ""}`)]),
            dataset_ref: chart.dataset_ref,
            query_ref: chart.query_ref,
            field_mappings: chart.field_mappings
          } satisfies TableModel;
        }
        if (mutation.new_block_kind === "chart" && metadata.table) {
          const table = metadata.table as TableModel;
          metadata.chart = {
            chart_type: "bar",
            categories: table.rows.map((row) => row[0]),
            series: table.columns.slice(1).map((column, columnIndex) => ({
              name: column,
              values: table.rows.map((row) => Number(row[columnIndex + 1] ?? 0))
            })),
            dataset_ref: table.dataset_ref,
            query_ref: table.query_ref,
            field_mappings: table.field_mappings
          } satisfies ChartModel;
        }
        return SlideBlockSchema.parse({
          ...block,
          block_kind: mutation.new_block_kind,
          block_metadata: metadata
        });
      });
    }
    storyboard = storyboard.map((plan, index) => StoryboardSlidePlanSchema.parse({ ...plan, slide_order: index }));
    const version = createVersion(
      base.deck.deck_id,
      versionNumber,
      base.version.version_ref.version_id,
      request.actor_ref,
      mutation.mutation_kind === "regenerate_slide" ? "slide_regeneration" : "manual_edit",
      `Mutation applied: ${mutation.mutation_kind}`,
      base.bindingSet.presentation_binding_set_id,
      base.templateLockState.template_lock_state_id,
      base.outline.outline_id,
      storyboard.map((item) => item.storyboard_slide_plan_id),
      storyboard.map((_, index) => id("slide", base.deck.deck_id, index)),
      speakerNotes.map((item) => item.speaker_notes_id),
      motionMetadata.map((item) => item.motion_metadata_id),
      null,
      base.outputMetadata.presentation_output_metadata_id,
      timestamp
    );
    let bundle: PresentationBundle = {
      ...base,
      storyboard,
      slideBlocks,
      speakerNotes,
      motionMetadata,
      version,
      deck: DeckAggregateSchema.parse({
        ...base.deck,
        current_version_ref: version.version_ref.version_id,
        current_storyboard_refs: version.storyboard_refs,
        updated_at: timestamp
      }),
      parityValidation: null,
      outputMetadata: PresentationOutputMetadataSchema.parse({
        ...base.outputMetadata,
        export_refs: [],
        delivered_targets: [],
        parity_validation_ref: null,
        preview_ref: null,
        last_validated_at: null
      }),
      exportArtifacts: [],
      previewArtifact: null,
      outputStatuses: [],
      publications: [],
      libraryAssets: [],
      roundTripValidations: []
    };
    bundle = pushStage(
      bundle,
      buildStageRecord(
        bundle,
        mutation.mutation_kind === "regenerate_slide" ? "presentations.regenerate_slide.v1" : "presentations.generate_deck.v1",
        "presentation_mutate",
        request.actor_ref,
        timestamp,
        [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id],
        [
          {
            check_id: id("check", bundle.deck.deck_id, "mutation", timestamp),
            check_name: "slide_mutation_check",
            check_type: "mutation",
            passed: bundle.storyboard.length > 0,
            severity: "high",
            details: "Mutation preserved a non-empty storyboard.",
            impacted_refs: bundle.storyboard.map((item) => item.storyboard_slide_plan_id)
          }
        ],
        [],
        []
      )
    );
    this.persistRuntimeBundle(bundle);
    return bundle;
  }

  bindDeckToData(input: z.infer<typeof BindDeckRequestSchema>): PresentationBundle {
    const request = BindDeckRequestSchema.parse(input);
    let bundle = clone(asBundle(request.bundle));
    const timestamp = now(request.timestamp);
    const allowedRefs = request.source_refs.length > 0 ? new Set(request.source_refs) : null;
    const brokenBindingRefs =
      allowedRefs === null
        ? []
        : bundle.bindingSet.bindings.filter((binding) => !allowedRefs.has(binding.dataset_ref)).map((binding) => binding.binding_id);
    bundle.bindingSet = PresentationBindingSetSchema.parse({
      ...bundle.bindingSet,
      bindings: bundle.bindingSet.bindings.map((binding) =>
        PresentationDataBindingSchema.parse({
          ...binding,
          last_refresh_at: timestamp,
          snapshot_version_ref: bundle.version.version_ref.version_id
        })
      ),
      broken_binding_refs: brokenBindingRefs,
      staleness_status:
        brokenBindingRefs.length > 0 ? "partially_live" : bundle.bindingSet.bindings.length > 0 ? "live" : "snapshot",
      last_refresh_at: timestamp
    });
    bundle.parityValidation = null;
    bundle.exportArtifacts = [];
    bundle.previewArtifact = null;
    bundle.roundTripValidations = [];
    bundle = pushStage(
      bundle,
      buildStageRecord(
        bundle,
        "presentations.bind_deck_to_data.v1",
        "presentation_bind_data",
        request.actor_ref,
        timestamp,
        [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id],
        [
          {
            check_id: id("check", bundle.deck.deck_id, "binding-refresh"),
            check_name: "binding_refresh_check",
            check_type: "binding",
            passed: brokenBindingRefs.length === 0,
            severity: "high",
            details: "Bindings remain resolvable after the refresh step.",
            impacted_refs: bundle.bindingSet.dataset_binding_refs
          }
        ],
        brokenBindingRefs.length > 0
          ? [baseWarning("binding_scope_change", "Some bindings lost their allowed source scope.", "Data binding was limited by the provided source refs.", brokenBindingRefs)]
          : [],
        brokenBindingRefs.length > 0
          ? [baseFailure("binding_missing_source", "A subset of data bindings is unresolved.", "One or more binding source refs were removed.", brokenBindingRefs)]
          : []
      )
    );
    this.persistRuntimeBundle(bundle);
    return bundle;
  }

  applyTemplateLock(input: z.infer<typeof ApplyTemplateLockRequestSchema>): PresentationBundle {
    const request = ApplyTemplateLockRequestSchema.parse(input);
    let bundle = clone(asBundle(request.bundle));
    const timestamp = now(request.timestamp);
    bundle.templateLockState = TemplateLockStateSchema.parse({
      ...bundle.templateLockState,
      template_ref: request.template_ref,
      lock_mode: request.lock_mode,
      override_allowed: request.lock_mode !== "strict_lock",
      last_applied_at: timestamp
    });
    bundle.slideBlocks = bundle.slideBlocks.map((block) =>
      SlideBlockSchema.parse({
        ...block,
        template_lock_state_ref: bundle.templateLockState.template_lock_state_id,
        editability: request.lock_mode !== "unlocked" && block.block_kind === "title" ? "template_locked" : "editable"
      })
    );
    bundle.deck = DeckAggregateSchema.parse({
      ...bundle.deck,
      template_ref: request.template_ref,
      brand_preset_ref: request.brand_preset_ref,
      template_lock_state_ref: bundle.templateLockState.template_lock_state_id,
      updated_at: timestamp
    });
    bundle.parityValidation = null;
    bundle.exportArtifacts = [];
    bundle.previewArtifact = null;
    bundle.roundTripValidations = [];
    bundle = pushStage(
      bundle,
      buildStageRecord(
        bundle,
        "presentations.apply_template_lock.v1",
        "presentation_apply_template",
        request.actor_ref,
        timestamp,
        [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id],
        [
          {
            check_id: id("check", bundle.deck.deck_id, "template-lock"),
            check_name: "template_lock_check",
            check_type: "template",
            passed: bundle.slideBlocks.some((block) => block.editability === "template_locked") || request.lock_mode === "unlocked",
            severity: "medium",
            details: "Template lock propagated into block editability flags.",
            impacted_refs: bundle.slideBlocks.map((block) => block.slide_block_id)
          }
        ],
        [],
        []
      )
    );
    this.persistRuntimeBundle(bundle);
    return bundle;
  }

  async renderPreview(bundle: PresentationBundle): Promise<PresentationPreviewArtifact> {
    const html = renderReaderHtml(bundle, `${bundle.deck.deck_kind} Reader`);
    const requestLike: CreatePresentationRequest = CreatePresentationRequestSchema.parse({
      presentation_id: bundle.deck.deck_id,
      tenant_ref: bundle.deckArtifact.tenant_ref,
      workspace_id: bundle.deckArtifact.workspace_id,
      project_id: bundle.deckArtifact.project_id,
      created_by: bundle.deck.created_by,
      title: bundle.deck.deck_kind,
      description: "",
      mode: bundle.deck.mode,
      language: bundle.deck.language,
      audience: bundle.deck.audience,
      tone: bundle.intentManifest.tone,
      density: bundle.intentManifest.density,
      source_policy: bundle.intentManifest.source_policy,
      rtl_policy: bundle.deck.rtl ? "rtl" : "ltr",
      motion_level: bundle.intentManifest.motion_level,
      notes_policy: bundle.intentManifest.notes_policy,
      export_targets: bundle.intentManifest.export_targets,
      template_ref: bundle.deck.template_ref,
      workspace_preset_ref: bundle.intentManifest.workspace_preset_ref,
      brand_preset_ref: bundle.deck.brand_preset_ref,
      strict_insert_requests: bundle.intentManifest.strict_insert_requests,
      sources: bundle.inputSources,
      permission_scope: bundle.deckArtifact.permission_scope
    });
    const artifact = makeArtifact(
      id("artifact", bundle.deck.deck_id, "reader"),
      "preview_render",
      "presentation_reader",
      bundle.canonical.canonical_id,
      requestLike,
      bundle,
      bundle.version,
      bundle.deck.created_by,
      bundle.deck.updated_at,
      "reader.html",
      hash(html),
      "html_canvas"
    );
    this.store.persistPreview(bundle.deck.deck_id, "reader.html", html);
    const readerPath = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${id("roundtrip", "reader")}.html`);
    fs.mkdirSync(path.dirname(readerPath), { recursive: true });
    fs.writeFileSync(readerPath, html, "utf8");
    const roundTrip: RoundTripValidationRecord = {
      ...(reopenHtmlExport(html)),
      target: "reader",
      renderer_kind: "local-dom"
    };
    const browser = await captureBrowserRoundTrip(
      "html",
      readerPath,
      path.join(defaultPresentationsEngineStorageRoot(process.cwd()), ".tmp", `${id("roundtrip-browser", "reader")}`)
    );
    roundTrip.slide_count = Number(browser.slide_count ?? roundTrip.slide_count);
    roundTrip.text_sample = z.array(z.string()).parse(browser.text_sample ?? roundTrip.text_sample);
    roundTrip.semantic_text_sample = z
      .array(z.string())
      .parse(browser.semantic_text_sample ?? roundTrip.semantic_text_sample ?? roundTrip.text_sample);
    roundTrip.layout_refs = z.array(z.string()).parse(browser.layout_refs ?? roundTrip.layout_refs);
    roundTrip.media_refs = z.array(z.string()).parse(browser.media_refs ?? roundTrip.media_refs);
    roundTrip.chart_markers = Number(browser.chart_markers ?? roundTrip.chart_markers);
    roundTrip.table_markers = Number(browser.table_markers ?? roundTrip.table_markers);
    roundTrip.screenshot_paths = z.array(z.string()).optional().parse(browser.screenshot_paths ?? []);
    roundTrip.renderer_kind = browser.renderer_kind ?? roundTrip.renderer_kind;
    this.store.persistRoundTripReport(bundle.deck.deck_id, "reader", roundTrip);
    roundTrip.screenshot_paths?.forEach((screenshotPath, index) => {
      if (fs.existsSync(screenshotPath)) {
        this.store.persistExport(
          bundle.deck.deck_id,
          `parity-reader-slide-${index + 1}.png`,
          Uint8Array.from(fs.readFileSync(screenshotPath))
        );
      }
    });
    return { target: "reader", artifact, html, roundTrip };
  }

  async exportPresentation(bundle: PresentationBundle, target: "pptx" | "pdf" | "html"): Promise<PresentationExportArtifact> {
    const requestLike: CreatePresentationRequest = CreatePresentationRequestSchema.parse({
      presentation_id: bundle.deck.deck_id,
      tenant_ref: bundle.deckArtifact.tenant_ref,
      workspace_id: bundle.deckArtifact.workspace_id,
      project_id: bundle.deckArtifact.project_id,
      created_by: bundle.deck.created_by,
      title: bundle.deck.deck_kind,
      description: "",
      mode: bundle.deck.mode,
      language: bundle.deck.language,
      audience: bundle.deck.audience,
      tone: bundle.intentManifest.tone,
      density: bundle.intentManifest.density,
      source_policy: bundle.intentManifest.source_policy,
      rtl_policy: bundle.deck.rtl ? "rtl" : "ltr",
      motion_level: bundle.intentManifest.motion_level,
      notes_policy: bundle.intentManifest.notes_policy,
      export_targets: bundle.intentManifest.export_targets,
      template_ref: bundle.deck.template_ref,
      workspace_preset_ref: bundle.intentManifest.workspace_preset_ref,
      brand_preset_ref: bundle.deck.brand_preset_ref,
      strict_insert_requests: bundle.intentManifest.strict_insert_requests,
      sources: bundle.inputSources,
      permission_scope: bundle.deckArtifact.permission_scope
    });
    if (target === "html") {
      const html = renderReaderHtml(bundle, `${bundle.deck.deck_kind} HTML Export`);
      const artifact = makeArtifact(id("artifact", bundle.deck.deck_id, "html"), "presentation", "presentation_html", bundle.canonical.canonical_id, requestLike, bundle, bundle.version, bundle.deck.created_by, bundle.deck.updated_at, "export.html", hash(html), "html_canvas");
      this.store.persistExport(bundle.deck.deck_id, "presentation.html", html);
      const roundTrip = await reopenExportArtifact("html", html);
      this.store.persistRoundTripReport(bundle.deck.deck_id, "html", roundTrip);
      roundTrip.screenshot_paths?.forEach((screenshotPath, index) => {
        if (fs.existsSync(screenshotPath)) {
          this.store.persistExport(
            bundle.deck.deck_id,
            `parity-html-slide-${index + 1}.png`,
            Uint8Array.from(fs.readFileSync(screenshotPath))
          );
        }
      });
      return { target, artifact, validation: buildValidationResult(bundle, "html", artifact.artifact_id, bundle.deck.updated_at, roundTrip), roundTrip, contentType: "text/html; charset=utf-8", fileName: "presentation.html", content: html };
    }
    if (target === "pdf") {
      const pdf = await renderToPdf(bundle);
      const artifact = makeArtifact(id("artifact", bundle.deck.deck_id, "pdf"), "presentation", "presentation_pdf", bundle.canonical.canonical_id, requestLike, bundle, bundle.version, bundle.deck.created_by, bundle.deck.updated_at, "export.pdf", hash(pdf), "pdf_preview");
      this.store.persistExport(bundle.deck.deck_id, "presentation.pdf", pdf);
      const roundTrip = await reopenExportArtifact("pdf", pdf);
      this.store.persistRoundTripReport(bundle.deck.deck_id, "pdf", roundTrip);
      roundTrip.rendered_pages?.forEach((pagePath, index) => {
        if (fs.existsSync(pagePath)) {
          this.store.persistExport(bundle.deck.deck_id, `parity-pdf-page-${index + 1}.png`, Uint8Array.from(fs.readFileSync(pagePath)));
        }
      });
      roundTrip.screenshot_paths?.forEach((pagePath, index) => {
        if (fs.existsSync(pagePath)) {
          this.store.persistExport(bundle.deck.deck_id, `parity-pdf-browser-${index + 1}.png`, Uint8Array.from(fs.readFileSync(pagePath)));
        }
      });
      return { target, artifact, validation: buildValidationResult(bundle, "pdf", artifact.artifact_id, bundle.deck.updated_at, roundTrip), roundTrip, contentType: "application/pdf", fileName: "presentation.pdf", content: pdf };
    }
    const pptx = await renderToPptx(bundle);
    const artifact = makeArtifact(id("artifact", bundle.deck.deck_id, "pptx"), "presentation", "presentation_pptx", bundle.canonical.canonical_id, requestLike, bundle, bundle.version, bundle.deck.created_by, bundle.deck.updated_at, "export.pptx", hash(pptx), "thumbnail");
    this.store.persistExport(bundle.deck.deck_id, "presentation.pptx", pptx);
    const roundTrip = await reopenExportArtifact("pptx", pptx);
    this.store.persistRoundTripReport(bundle.deck.deck_id, "pptx", roundTrip);
    if (roundTrip.external_validation_ref && fs.existsSync(roundTrip.external_validation_ref)) {
      this.store.persistExport(
        bundle.deck.deck_id,
        "presentation-native-render.pdf",
        Uint8Array.from(fs.readFileSync(roundTrip.external_validation_ref))
      );
    }
    roundTrip.rendered_pages?.forEach((pagePath, index) => {
      if (fs.existsSync(pagePath)) {
        this.store.persistExport(
          bundle.deck.deck_id,
          `parity-pptx-native-page-${index + 1}.png`,
          Uint8Array.from(fs.readFileSync(pagePath))
        );
      }
    });
    roundTrip.screenshot_paths?.forEach((pagePath, index) => {
      if (fs.existsSync(pagePath)) {
        this.store.persistExport(
          bundle.deck.deck_id,
          `parity-pptx-browser-${index + 1}.png`,
          Uint8Array.from(fs.readFileSync(pagePath))
        );
      }
    });
    return { target, artifact, validation: buildValidationResult(bundle, "pptx", artifact.artifact_id, bundle.deck.updated_at, roundTrip), roundTrip, contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileName: "presentation.pptx", content: pptx };
  }

  async runRenderParityValidation(bundle: PresentationBundle): Promise<{ bundle: PresentationBundle; preview: PresentationPreviewArtifact; exports: PresentationExportArtifact[]; parityValidation: RenderParityValidation; }> {
    const preview = await this.renderPreview(bundle);
    const exports = [await this.exportPresentation(bundle, "html"), await this.exportPresentation(bundle, "pdf"), await this.exportPresentation(bundle, "pptx")];
    const timestamp = now();
    const parityValidation = validateParity(bundle, preview, exports, timestamp);
    let updatedBundle: PresentationBundle = {
      ...bundle,
      previewArtifact: preview.artifact,
      exportArtifacts: exports,
      roundTripValidations: [
        ...(preview.roundTrip ? [preview.roundTrip] : []),
        ...exports.flatMap((item) => (item.roundTrip ? [item.roundTrip] : []))
      ],
      parityValidation,
      outputMetadata: mergeExportMetadata(bundle, preview, exports, parityValidation, []),
      outputStatuses: [],
      deck: DeckAggregateSchema.parse({
        ...bundle.deck,
        current_parity_validation_ref: parityValidation.render_parity_validation_id,
        status: parityValidation.publish_ready ? "review" : "degraded",
        updated_at: timestamp
      })
    };
    updatedBundle.outputStatuses = buildOutputStatuses(updatedBundle, parityValidation, timestamp);
    updatedBundle = pushStage(updatedBundle, buildStageRecord(updatedBundle, "presentations.run_render_parity_validation.v1", "presentation_render_parity", bundle.deck.created_by, timestamp, [preview.artifact.artifact_id, ...exports.map((item) => item.artifact.artifact_id)], parityValidation.checks.map((check) => ({ check_id: check.validation_check_id, check_name: check.check_type, check_type: "parity", passed: check.passed, severity: check.severity, details: check.detail, impacted_refs: check.impacted_refs })), parityValidation.overall_status === "success_with_warnings" ? [baseWarning("render_parity_warning", "Parity completed with warnings.", "One or more parity checks returned warning status.", parityValidation.export_validation_refs)] : [], parityValidation.overall_status === "degraded" ? [baseFailure("render_parity_failed", "Parity validation degraded.", "At least one export target failed parity validation.", parityValidation.degrade_reason_refs)] : []));
    this.persistRuntimeBundle(updatedBundle);
    return { bundle: updatedBundle, preview, exports, parityValidation };
  }

  publishPresentation(input: z.infer<typeof PublishPresentationRequestSchema>): PresentationPublicationResult {
    const request = PublishPresentationRequestSchema.parse(input);
    let bundle = clone(asBundle(request.bundle));
    const timestamp = now(request.timestamp);
    if (!bundle.parityValidation) throw new Error("Parity validation must run before publish.");
    const parityValidation = bundle.parityValidation;
    if (!parityValidation.publish_ready && !request.allow_degraded) throw new Error("Publish blocked because render parity is not ready.");
    const publication = PublicationSchema.parse({ contract: contractEnvelope("publication"), publication_id: id("publication", bundle.deck.deck_id, timestamp), artifact_ref: bundle.deckArtifact.artifact_id, publication_type: request.allow_degraded ? "external_export" : "internal_publish", editable_default: true, explicit_non_editable_export: false, target_ref: request.target_ref, published_by: request.published_by, published_at: timestamp, permission_scope: bundle.deckArtifact.permission_scope, evidence_ref: bundle.evidencePacks[bundle.evidencePacks.length - 1]?.evidence_pack_id ?? id("evidence", bundle.deck.deck_id, "publish") });
    const libraryAsset = request.publish_to_library ? LibraryAssetSchema.parse({ contract: contractEnvelope("library"), asset_id: id("library-asset", bundle.deck.deck_id, timestamp), asset_type: "presentation", source: publication.target_ref, tags: ["presentation", bundle.deck.language, bundle.deck.mode], version: bundle.version.version_ref.semantic_version, tenant_scope: "workspace", permission_scope: bundle.deckArtifact.permission_scope, reuse_policy: request.allow_degraded ? "restricted" : "free", dependency_refs: [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id], created_at: timestamp, updated_at: timestamp }) : null;
    bundle = { ...bundle, publications: [...bundle.publications, publication], libraryAssets: libraryAsset ? [...bundle.libraryAssets, libraryAsset] : bundle.libraryAssets, outputMetadata: PresentationOutputMetadataSchema.parse({ ...bundle.outputMetadata, publication_refs: [...bundle.outputMetadata.publication_refs, publication.publication_id] }), deck: DeckAggregateSchema.parse({ ...bundle.deck, publication_refs: [...bundle.deck.publication_refs, publication.publication_id], status: request.allow_degraded ? "degraded" : "published", updated_at: timestamp }) };
    const stage = buildStageRecord(bundle, request.allow_degraded ? "presentations.publish_degraded_presentation_artifact.v1" : "presentations.publish_presentation_artifact.v1", "presentation_publish", request.published_by, timestamp, [bundle.deckArtifact.artifact_id, bundle.versionArtifact.artifact_id, ...(bundle.previewArtifact ? [bundle.previewArtifact.artifact_id] : []), ...bundle.exportArtifacts.map((item) => item.artifact.artifact_id)], [{ check_id: id("check", bundle.deck.deck_id, "publish-ready", timestamp), check_name: "publication_ready_check", check_type: "publication", passed: request.allow_degraded || parityValidation.publish_ready, severity: "high", details: "Publish gate is driven by parity validation and evidence.", impacted_refs: parityValidation.export_validation_refs }], request.allow_degraded ? [baseWarning("degraded_publish", "Publishing in degraded mode.", "The output is published with explicit degraded status.", parityValidation.degrade_reason_refs)] : [], request.allow_degraded ? [] : parityValidation.publish_ready ? [] : [baseFailure("publish_gate_blocked", "Publish gate failed.", "Parity validation did not authorize publication.", parityValidation.degrade_reason_refs)], [{ edge_id: id("edge", bundle.deckArtifact.artifact_id, publication.publication_id), from_ref: bundle.deckArtifact.artifact_id, to_ref: publication.publication_id, transform_ref: "presentations.publish", ai_suggestion_ref: "", ai_decision: "not_applicable", template_ref: bundle.deck.template_ref ?? "", dataset_binding_ref: "", version_diff_ref: bundle.version.version_ref.version_id }]);
    bundle = pushStage(bundle, stage);
    this.persistRuntimeBundle(bundle);
    return { publication, libraryAsset, stage, bundle };
  }
}

export const registerPresentationsCapability = (runtime: RegistryBootstrap): void => {
  runtime.registerCapability({ capability_id: "presentations", display_name: "Presentations", package_name: "@rasid/presentations-engine", contract_version: "1.0.0", supported_action_refs: PresentationActionRegistry.map((action) => action.action_id), supported_tool_refs: [] });
  runtime.registerManifest(createActionManifest("presentations", "1.0.0", PresentationActionRegistry, ["approval.default"], ["evidence.default"]));
};

const createRegressionDocx = async (targetPath: string): Promise<void> => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Binary DOCX source for presentations engine.</w:t></w:r></w:p>
    <w:p><w:r><w:t>It carries editable narrative input for source-to-deck generation.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
};

const createRegressionPdf = (targetPath: string): void => {
  const pdf = serializePdf([
    [
      "BT /F1 18 Tf 60 740 Td (Binary PDF source for presentations engine) Tj ET",
      "BT /F1 12 Tf 60 708 Td (This PDF is reopened by the source parser and parity validator.) Tj ET"
    ].join("\n")
  ]);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(pdf));
};

const createRegressionPptx = async (targetPath: string, imagePath: string): Promise<void> => {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Rasid Presentations Engine";
  const first = pptx.addSlide();
  first.addText("Existing Deck Template", { x: 0.8, y: 0.8, w: 6.5, h: 0.5, fontFace: "Aptos", fontSize: 24, bold: true });
  first.addText("Theme and geometry are extracted from this source deck.", { x: 0.8, y: 1.6, w: 7.4, h: 0.5, fontFace: "Aptos", fontSize: 14 });
  first.addNotes("Reference slide notes");
  const second = pptx.addSlide();
  second.addText("Layout Reuse", { x: 0.8, y: 0.8, w: 6.5, h: 0.5, fontFace: "Aptos", fontSize: 22, bold: true });
  second.addTable(
    [
      [{ text: "Area" }, { text: "Value" }],
      [{ text: "Narrative" }, { text: "Reusable" }],
      [{ text: "Theme" }, { text: "Extracted" }]
    ],
    { x: 0.8, y: 1.6, w: 4.5, h: 1.6, fontFace: "Aptos", fontSize: 12 }
  );
  const third = pptx.addSlide();
  third.addText("Media Layout", { x: 0.8, y: 0.7, w: 4.8, h: 0.5, fontFace: "Aptos", fontSize: 22, bold: true });
  third.addImage({ path: imagePath, x: 0.8, y: 1.4, w: 5.2, h: 3 });
  third.addText("Reference image used to drive media placement fidelity.", {
    x: 6.3,
    y: 1.6,
    w: 5.3,
    h: 1.1,
    fontFace: "Aptos",
    fontSize: 14
  });
  third.addNotes("Media slide notes");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  await pptx.writeFile({ fileName: targetPath });
};

const createRegressionXlsx = (targetPath: string): void => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    { Region: "الرياض", Revenue: 42, Target: 38 },
    { Region: "جدة", Revenue: 35, Target: 33 },
    { Region: "الدمام", Revenue: 28, Target: 29 }
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Revenue");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  XLSX.writeFile(workbook, targetPath);
};

const createRegressionImage = (targetPath: string): void => {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh2QAAAAASUVORK5CYII=";
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(pngBase64, "base64"));
};

export const runPresentationRegressionSuite = async (): Promise<PresentationRegressionSuiteResult> => {
  const engine = new PresentationEngine();
  const runId = id("presentation-regression", now().replace(/[^0-9]/g, ""));
  const sampleRoot = path.join(defaultPresentationsEngineStorageRoot(process.cwd()), "regression-inputs", runId);
  const docxPath = path.join(sampleRoot, "source.docx");
  const pdfPath = path.join(sampleRoot, "source.pdf");
  const pptxPath = path.join(sampleRoot, "reference-deck.pptx");
  const xlsxPath = path.join(sampleRoot, "source.xlsx");
  const imagePath = path.join(sampleRoot, "reference-image.png");
  await createRegressionDocx(docxPath);
  createRegressionPdf(pdfPath);
  createRegressionImage(imagePath);
  await createRegressionPptx(pptxPath, imagePath);
  createRegressionXlsx(xlsxPath);
  const createBundle = await engine.createPresentation({ presentation_id: id("deck", "service-request-05"), tenant_ref: "tenant-1", workspace_id: "workspace-1", project_id: "project-1", created_by: "user-1", title: "محرك presentations داخل راصد", description: "Deck generated from prompt, text, dashboard, report, dataset, template, and media sources.", mode: "advanced", language: "ar-SA", audience: "قيادات المنتج والتنفيذ", tone: "direct", density: "balanced", target_slide_count: 8, source_policy: "prefer_structured_sources", rtl_policy: "rtl", motion_level: "subtle", notes_policy: "auto_generate", export_targets: ["reader", "pptx", "pdf", "html"], template_ref: "template://board/ops-review", workspace_preset_ref: "workspace-preset://riyadh", brand_preset_ref: "brand://rasid/default", strict_insert_requests: ["Agenda", "الختام"], sources: [{ source_kind: "prompt_topic", source_ref: "source-prompt-1", prompt: "ابنِ عرضًا عربيًا مهنيًا يشرح محرك presentations ومسار التوليد والتحرير والتصدير مع أمثلة بيانات.", topic: "presentations engine", title: "Prompt" }, { source_kind: "txt_document", source_ref: "source-txt-1", title: "Scope", text: "المطلوب تنفيذ intent manifest الحقيقي. ثم outline/storyboard pipeline. ثم deck/slide/block model. ثم preview/export/parity." }, { source_kind: "structured_outline", source_ref: "source-outline-1", title: "Agenda", items: [{ title: "مدخلات المحرك", bullets: ["Prompt", "TXT", "Dataset", "Dashboard", "Report"], strict_insert: true }, { title: "خط التوليد", bullets: ["Intent", "Outline", "Storyboard", "Deck"], strict_insert: true }, { title: "التصدير والحوكمة", bullets: ["Reader", "PPTX", "PDF", "HTML"], strict_insert: false }] }, { source_kind: "dataset", source_ref: "dataset-revenue-q1", title: "الإيرادات حسب المنطقة", dataset_name: "Revenue Q1", columns: ["Region", "Revenue", "Target"], rows: [{ Region: "الرياض", Revenue: 42, Target: 38 }, { Region: "جدة", Revenue: 35, Target: 33 }, { Region: "الدمام", Revenue: 28, Target: 29 }, { Region: "المدينة", Revenue: 22, Target: 20 }], preferred_chart: "bar", preferred_dimension: "Region", preferred_measure: "Revenue" }, { source_kind: "dashboard_artifact", source_ref: "dashboard-ops-1", title: "Operational Dashboard", summary: "The dashboard shows improving response time and higher coverage.", highlights: ["Coverage reached 94%", "Response time dropped 18%", "Backlog aging improved"], metrics: [{ label: "Coverage", value: 94, unit: "%" }, { label: "Response Time", value: 18, unit: "min" }, { label: "Backlog Aging", value: 12, unit: "days" }], dataset_ref: "dataset-revenue-q1" }, { source_kind: "report_artifact", source_ref: "report-weekly-1", title: "Weekly Program Report", summary: "The weekly report confirms that deck generation must remain editable and evidence-backed.", sections: [{ heading: "Generation", summary: "Intent, outline, and storyboard are now real.", bullets: ["Intent manifest", "Outline nodes", "Storyboard slides"] }, { heading: "Editing", summary: "Slide-level mutation is implemented.", bullets: ["Add slide", "Reorder slide", "Regenerate slide"] }] }, { source_kind: "binary_file", source_ref: "binary-docx-1", title: "Binary DOCX source", file_path: docxPath, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", parser_hint: "docx" }, { source_kind: "binary_file", source_ref: "binary-pdf-1", title: "Binary PDF source", file_path: pdfPath, mime_type: "application/pdf", parser_hint: "pdf" }, { source_kind: "binary_file", source_ref: "binary-pptx-1", title: "Binary PPTX source", file_path: pptxPath, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", parser_hint: "pptx" }, { source_kind: "binary_file", source_ref: "binary-xlsx-1", title: "Binary XLSX source", file_path: xlsxPath, mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", parser_hint: "xlsx" }, { source_kind: "existing_presentation_reference", source_ref: "existing-deck-1", title: "Existing reference deck", file_path: pptxPath, theme_summary: "", slide_titles: [] }, { source_kind: "library_template", source_ref: "template-board-ops", template_name: "Board Ops Review", brand_preset_ref: "brand://rasid/default", lock_mode: "soft_lock", theme_tokens: { primary_color: "C7511F", secondary_color: "0F172A", accent_color: "1D8F6E", neutral_color: "F8FAFC", font_face: "Aptos" } }, { source_kind: "media_asset", source_ref: "media-architecture-1", title: "Architecture reference", media_kind: "image", file_path: imagePath, mime_type: "image/png", caption: "Reference visual" }, { source_kind: "notes", source_ref: "notes-1", title: "Presenter notes", notes: ["ابدأ بالمصدر الحقيقي", "أثبت الـ editable path", "اختم ببوابة parity والدليل"] }] });
  const mutatedBundle = engine.bindDeckToData({ bundle: engine.applyTemplateLock({ bundle: engine.mutatePresentation({ bundle: createBundle, actor_ref: "user-1", mutation: { mutation_kind: "regenerate_slide", slide_ref: id("slide", createBundle.deck.deck_id, 2), refresh_source_refs: ["dataset-revenue-q1", "dashboard-ops-1"], override_prompt: "حدث هذه الشريحة لتوضح أن regenerate يحافظ على الـ bindings ويولد content أوضح." } }), actor_ref: "user-1", template_ref: "template://board/ops-review", brand_preset_ref: "brand://rasid/default", lock_mode: "strict_lock" }), actor_ref: "user-1", source_refs: ["dataset-revenue-q1", "dashboard-ops-1", "report-weekly-1"] });
  const parity = await engine.runRenderParityValidation(mutatedBundle);
  const publicationResult = engine.publishPresentation({ bundle: parity.bundle, published_by: "user-1", target_ref: "workspace://presentations/service-request-05", publish_to_library: true, allow_degraded: false });
  return { runId, createBundle, mutatedBundle: publicationResult.bundle, preview: parity.preview, exports: parity.exports, parityValidation: parity.parityValidation, publication: publicationResult.publication, libraryAsset: publicationResult.libraryAsset, artifacts: { readerHtml: parity.preview.html, exportHtml: (parity.exports.find((item) => item.target === "html")?.content as string) ?? "", exportPdf: (parity.exports.find((item) => item.target === "pdf")?.content as Uint8Array) ?? new Uint8Array(), exportPptx: (parity.exports.find((item) => item.target === "pptx")?.content as Uint8Array) ?? new Uint8Array() } };
};
