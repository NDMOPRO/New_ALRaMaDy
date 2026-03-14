import { z } from "zod";
import {
  ContractEnvelopeSchema,
  EditableStatusSchema,
  ExportRefSchema,
  PermissionScopeSchema,
  PlatformModeSchema,
  PreviewRefSchema,
  StorageRefSchema,
  TimestampSchema,
  VerificationStatusSchema,
  VersionRefSchema,
  contractEnvelope
} from "./common";

export const ArtifactSchema = z.object({
  contract: ContractEnvelopeSchema,
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
  canonical_ref: z.string(),
  created_by: z.string(),
  created_at: TimestampSchema,
  mode: PlatformModeSchema,
  editable_status: EditableStatusSchema,
  template_status: z.enum(["none", "applied", "soft_locked", "strict_locked"]),
  lineage_ref: z.string(),
  evidence_ref: z.string(),
  verification_status: VerificationStatusSchema,
  storage_ref: StorageRefSchema,
  preview_ref: PreviewRefSchema,
  export_refs: z.array(ExportRefSchema),
  version_ref: VersionRefSchema,
  tenant_ref: z.string(),
  permission_scope: PermissionScopeSchema
});

export const ARTIFACT_CONTRACT = contractEnvelope("artifact");

export type Artifact = z.infer<typeof ArtifactSchema>;
