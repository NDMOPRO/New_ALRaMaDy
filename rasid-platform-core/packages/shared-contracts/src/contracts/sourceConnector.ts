import { z } from "zod";

export const SourceSchema = z.object({
  source_id: z.string(),
  source_type: z.enum([
    "uploaded_file",
    "folder_batch",
    "url",
    "api",
    "database",
    "document",
    "spreadsheet",
    "image",
    "presentation",
    "future_connector"
  ]),
  ingestion_batch_id: z.string(),
  tenant_ref: z.string(),
  original_name: z.string(),
  media_type: z.string(),
  size: z.number(),
  parser_status: z.enum(["pending", "parsed", "failed"]),
  profiling_status: z.enum(["pending", "profiled", "failed"]),
  schema_summary: z.record(z.any()),
  sensitivity_hint: z.enum(["public", "internal", "confidential", "restricted"]),
  connector_ref: z.string().optional()
});
