import { z } from "zod";
import {
  ContractEnvelopeSchema,
  LocalizedTextSchema,
  RecordListSchema,
  StrictnessModeSchema,
  StringListSchema,
  TimestampSchema,
  contractEnvelope
} from "./common";

export const SourceDescriptorSchema = z.object({
  source_ref: z.string(),
  source_type: z.string(),
  source_revision_ref: z.string(),
  parser_profile: z.string(),
  connector_ref: z.string()
});

export const BaseNodeSchema = z.object({
  node_id: z.string(),
  node_type: z.string(),
  parent_node_ref: z.string().nullable(),
  child_node_refs: StringListSchema,
  name: z.string(),
  semantic_labels: StringListSchema,
  layout_ref: z.string(),
  data_binding_refs: StringListSchema,
  formula_refs: StringListSchema,
  lineage_refs: StringListSchema,
  template_refs: StringListSchema,
  evidence_refs: StringListSchema,
  editable: z.boolean()
});

export const DocumentNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("document"),
  page_refs: StringListSchema,
  section_refs: StringListSchema
});

export const PageNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("page"),
  width: z.number(),
  height: z.number(),
  unit: z.string(),
  layer_refs: StringListSchema
});

export const SheetNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("sheet"),
  table_refs: StringListSchema,
  chart_refs: StringListSchema,
  grid_bounds: z.object({
    row_count: z.number().int().nonnegative(),
    column_count: z.number().int().nonnegative()
  })
});

export const SlideNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("slide"),
  slide_index: z.number().int().nonnegative(),
  master_ref: z.string(),
  element_refs: StringListSchema
});

export const TableNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("table"),
  row_count: z.number().int().nonnegative(),
  column_count: z.number().int().nonnegative(),
  schema_ref: z.string()
});

export const ChartNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("chart"),
  chart_type: z.string(),
  series_refs: StringListSchema,
  axis_refs: StringListSchema
});

export const ShapeNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("shape"),
  shape_type: z.string(),
  style_ref: z.string()
});

export const TextNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("text"),
  content: z.array(LocalizedTextSchema),
  typography_ref: z.string()
});

export const ImageNodeSchema = BaseNodeSchema.extend({
  node_type: z.literal("image"),
  image_asset_ref: z.string(),
  crop_metadata: z.record(z.unknown())
});

export const LayoutMetadataSchema = z.object({
  coordinate_space: z.enum(["page", "sheet", "slide", "canvas"]),
  bounding_boxes: RecordListSchema,
  z_order: RecordListSchema,
  grid_rules: RecordListSchema,
  alignment_rules: RecordListSchema
});

export const DataBindingRefSchema = z.object({
  binding_id: z.string(),
  dataset_ref: z.string(),
  query_ref: z.string(),
  target_node_ref: z.string(),
  field_mappings: RecordListSchema
});

export const FormulaRefSchema = z.object({
  formula_id: z.string(),
  expression: z.string(),
  dialect: z.string(),
  target_ref: z.string(),
  dependency_refs: StringListSchema
});

export const SemanticLabelSchema = z.object({
  label_id: z.string(),
  label_type: z.string(),
  label_value: z.string(),
  target_ref: z.string()
});

export const CanonicalRepresentationSchema = z.object({
  contract: ContractEnvelopeSchema,
  canonical_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  project_id: z.string(),
  source_descriptors: z.array(SourceDescriptorSchema),
  representation_kind: z.enum([
    "document",
    "spreadsheet",
    "presentation",
    "dashboard",
    "report",
    "multimodal_content",
    "intermediate_converted_artifact"
  ]),
  strictness_mode: StrictnessModeSchema,
  localization: z.object({
    locale: z.string(),
    rtl: z.boolean(),
    numeral_system: z.string(),
    fallback_locales: StringListSchema
  }),
  root_node_refs: StringListSchema,
  nodes: z.object({
    documents: z.array(DocumentNodeSchema),
    pages: z.array(PageNodeSchema),
    sheets: z.array(SheetNodeSchema),
    slides: z.array(SlideNodeSchema),
    tables: z.array(TableNodeSchema),
    charts: z.array(ChartNodeSchema),
    shapes: z.array(ShapeNodeSchema),
    text: z.array(TextNodeSchema),
    images: z.array(ImageNodeSchema)
  }),
  layout_metadata: LayoutMetadataSchema,
  data_binding_refs: z.array(DataBindingRefSchema),
  formula_refs: z.array(FormulaRefSchema),
  semantic_labels: z.array(SemanticLabelSchema),
  lineage_refs: StringListSchema,
  template_refs: StringListSchema,
  editability_flags: z.object({
    default_editable: z.boolean(),
    locked_region_refs: StringListSchema,
    lock_reason_codes: StringListSchema
  }),
  evidence_refs: StringListSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema
});

export const CANONICAL_CONTRACT = contractEnvelope("canonical");

export type CanonicalRepresentation = z.infer<typeof CanonicalRepresentationSchema>;
