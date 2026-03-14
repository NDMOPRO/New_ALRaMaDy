import { z } from "zod";
import { ContractEnvelopeSchema, contractEnvelope } from "./common";

export const SourceSchema = z.object({
  contract: ContractEnvelopeSchema,
  source_id: z.string(),
  source_type: z.enum([
    "uploaded_file",
    "folder_batch",
    "url",
    "api",
    "database",
    "document_file",
    "spreadsheet_file",
    "image",
    "presentation_file",
    "future_connector"
  ]),
  ingestion_batch_id: z.string(),
  tenant_ref: z.string(),
  original_name: z.string(),
  media_type: z.string(),
  size: z.number().nonnegative(),
  parser_status: z.enum(["pending", "parsed", "failed"]),
  profiling_status: z.enum(["pending", "profiled", "failed"]),
  schema_summary: z.record(z.unknown()),
  sensitivity_hint: z.enum(["public", "internal", "confidential", "restricted"]),
  connector_ref: z.string()
});

export const SOURCE_CONTRACT = contractEnvelope("source");

export type Source = z.infer<typeof SourceSchema>;
