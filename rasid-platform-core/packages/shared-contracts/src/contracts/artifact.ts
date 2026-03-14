import { z } from "zod";
import { ModeSchema, PermissionScopeSchema, VerificationStatusSchema } from "../common";

export const ArtifactSchema = z.object({
  artifact_id: z.string(),
  artifact_type: z.enum([
    "source_file",
    "normalized_dataset",
    "workflow_output",
    "report",
    "dashboard",
    "presentation",
    "spreadsheet",
    "strict_output",
    "preview_render",
    "export_bundle",
    "evidence_pack"
  ]),
  artifact_subtype: z.string(),
  project_id: z.string(),
  workspace_id: z.string(),
  source_refs: z.array(z.string()),
  parent_artifact_refs: z.array(z.string()),
  created_by: z.string(),
  created_at: z.string(),
  mode: ModeSchema,
  editable_status: z.enum(["editable", "partially_editable", "non_editable"]),
  template_status: z.enum(["none", "applied", "locked", "soft_locked"]),
  lineage_ref: z.string(),
  evidence_ref: z.string(),
  verification_status: VerificationStatusSchema,
  storage_ref: z.string(),
  preview_ref: z.string(),
  export_refs: z.array(z.string()),
  version_ref: z.string(),
  tenant_ref: z.string(),
  permission_scope: PermissionScopeSchema
});
