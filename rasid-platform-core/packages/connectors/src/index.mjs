import { assertRequired, assertVersioned } from "../../common/src/index.mjs";

export const ConnectorsContract = { contract: "source_connector", version: "1.0.0" };

export function validateSource(model) {
  assertVersioned("source_connector", model);
  assertRequired(model, [
    "source_id", "source_type", "ingestion_batch_id", "tenant_ref", "original_name",
    "media_type", "size", "parser_status", "profiling_status", "schema_summary", "sensitivity_hint"
  ], "source_connector");
  return true;
}
