import {
  ActionDefinitionSchema,
  type ActionDefinition,
  type ActionExecution,
  ApprovalPolicySchema,
  ApprovalStateSchema,
  EvidencePackSchema,
  type EvidencePack,
  ToolRegistrationSchema,
  type ToolRegistration
} from "@rasid/contracts";
import { z } from "zod";

export const ApprovalHookResultSchema = z.object({
  approval_state: ApprovalStateSchema,
  reasons: z.array(z.string())
});

export const EvidenceHookContextSchema = z.object({
  hook_id: z.string(),
  artifact_refs: z.array(z.string()),
  action_id: z.string()
});

export const ApprovalPolicyHookSchema = z.object({
  hook_id: z.string(),
  supported_policy: ApprovalPolicySchema,
  description: z.string()
});

export const RuntimeActionBindingSchema = z.object({
  binding_id: z.string(),
  action: ActionDefinitionSchema,
  tool: ToolRegistrationSchema,
  approval_hook_ids: z.array(z.string()),
  evidence_hook_ids: z.array(z.string())
});

export type ApprovalHookResult = z.infer<typeof ApprovalHookResultSchema>;
export type EvidenceHookContext = z.infer<typeof EvidenceHookContextSchema>;
export type ApprovalPolicyHook = z.infer<typeof ApprovalPolicyHookSchema>;
export type RuntimeActionBinding = z.infer<typeof RuntimeActionBindingSchema>;
export type ApprovalHook = (action: ActionDefinition, context: ActionExecution | null) => ApprovalHookResult | Promise<ApprovalHookResult>;
export type EvidenceHook = (pack: EvidencePack, context: EvidenceHookContext | null) => EvidencePack | Promise<EvidencePack>;

export const applyApprovalHook = async (
  hook: ApprovalHook,
  action: ActionDefinition,
  context: ActionExecution | null
): Promise<ApprovalHookResult> => ApprovalHookResultSchema.parse(await hook(action, context));

export const applyEvidenceHook = async (
  hook: EvidenceHook,
  pack: EvidencePack,
  context: EvidenceHookContext | null
): Promise<EvidencePack> => EvidencePackSchema.parse(await hook(pack, context));
