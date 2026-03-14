import { z } from "zod";

export const CanonicalRepresentationSchema = z.object({
  canonical_id: z.string(),
  tenant_ref: z.string(),
  workspace_id: z.string(),
  strictness_mode: z.enum(["strict", "smart", "flex"]),
  source_descriptors: z.array(z.object({ source_id: z.string(), source_type: z.string() })),
  entities: z.object({
    documents: z.array(z.string()),
    pages: z.array(z.string()),
    sheets: z.array(z.string()),
    slides: z.array(z.string()),
    tables: z.array(z.string()),
    charts: z.array(z.string()),
    shapes: z.array(z.string()),
    text_blocks: z.array(z.string()),
    images: z.array(z.string())
  }),
  layout_metadata: z.record(z.any()),
  data_binding_refs: z.array(z.string()),
  formula_refs: z.array(z.string()),
  semantic_labels: z.array(z.string()),
  lineage_refs: z.array(z.string()),
  template_refs: z.array(z.string()),
  localization: z.object({ locale: z.string(), rtl: z.boolean(), numeral_system: z.string() }),
  editability_flags: z.object({
    editable: z.boolean(),
    locked_regions: z.array(z.string()),
    lock_reason: z.array(z.string())
  }),
  evidence_refs: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string()
});
