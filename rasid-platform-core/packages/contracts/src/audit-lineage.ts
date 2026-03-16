import { z } from "zod";
import { ContractEnvelopeSchema, ExecutionOutcomeSchema, TimestampSchema, contractEnvelope } from "./common";

export const AuditEventSchema = z.object({
  contract: ContractEnvelopeSchema,
  event_id: z.string(),
  timestamp: TimestampSchema,
  actor_ref: z.string(),
  actor_type: z.enum(["user", "service", "ai"]),
  action_ref: z.string(),
  job_ref: z.string(),
  object_refs: z.array(z.string()),
  target_ref: z.string().optional(),
  target_kind: z.string().optional(),
  workspace_id: z.string(),
  tenant_ref: z.string(),
  result_status: ExecutionOutcomeSchema.optional(),
  permission_decision_ref: z.string().optional(),
  input_summary: z.record(z.unknown()).optional(),
  output_summary: z.record(z.unknown()).optional(),
  degrade_reason: z.string().nullable().optional(),
  metadata: z.record(z.unknown())
});

export const LineageEdgeSchema = z.object({
  edge_id: z.string(),
  from_ref: z.string(),
  to_ref: z.string(),
  tenant_ref: z.string().optional(),
  action_ref: z.string().optional(),
  transform_ref: z.string(),
  ai_suggestion_ref: z.string(),
  ai_decision: z.enum(["accepted", "rejected", "not_applicable"]),
  template_ref: z.string(),
  dataset_binding_ref: z.string(),
  version_diff_ref: z.string(),
  evidence_ref: z.string().optional(),
  approval_ref: z.string().optional()
});

export const LineageQueryKeysSchema = z.object({
  artifact_id: z.string(),
  dataset_id: z.string(),
  report_id: z.string(),
  dashboard_id: z.string(),
  presentation_id: z.string(),
  workflow_run_id: z.string()
});

export const AUDIT_CONTRACT = contractEnvelope("audit");

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type LineageEdge = z.infer<typeof LineageEdgeSchema>;
