import {
  ActionDefinitionSchema,
  type ActionDefinition,
  type ActionExecution,
  contractEnvelope,
  EvidencePackSchema,
  type EvidencePack,
  ToolRegistrationSchema,
  type ToolRegistration
} from "@rasid/contracts";
import {
  applyApprovalHook,
  applyEvidenceHook,
  ApprovalHookResultSchema,
  type ApprovalHook,
  type ApprovalHookResult,
  type EvidenceHook
} from "@rasid/runtime";
import { z } from "zod";

export const CapabilityRegistrationSchema = z.object({
  capability_id: z.string(),
  display_name: z.string(),
  package_name: z.string(),
  contract_version: z.string(),
  supported_action_refs: z.array(z.string()),
  supported_tool_refs: z.array(z.string())
});

export const ActionManifestSchema = z.object({
  manifest_id: z.string(),
  manifest_version: z.string(),
  capability_id: z.string(),
  contract: z.object({
    namespace: z.string(),
    contract_name: z.literal("action"),
    contract_version: z.string(),
    schema_version: z.string(),
    status: z.string(),
    owner_ref: z.string(),
    compatibility: z.object({
      backward_compatible: z.boolean(),
      forward_compatible: z.boolean()
    }),
    extension_policy: z.object({
      namespaced_extensions_only: z.boolean(),
      mandatory_field_override_forbidden: z.boolean()
    })
  }),
  actions: z.array(ActionDefinitionSchema),
  evidence_hook_ids: z.array(z.string()),
  approval_hook_ids: z.array(z.string())
});

export type CapabilityRegistration = z.infer<typeof CapabilityRegistrationSchema>;
export type ActionManifest = z.infer<typeof ActionManifestSchema>;

export class RegistryBootstrap {
  private readonly capabilities = new Map<string, CapabilityRegistration>();
  private readonly actions = new Map<string, ActionDefinition>();
  private readonly tools = new Map<string, ToolRegistration>();
  private readonly approvalHooks = new Map<string, ApprovalHook>();
  private readonly evidenceHooks = new Map<string, EvidenceHook>();

  registerCapability(input: CapabilityRegistration): CapabilityRegistration {
    const parsed = CapabilityRegistrationSchema.parse(input);
    this.capabilities.set(parsed.capability_id, parsed);
    return parsed;
  }

  registerManifest(input: ActionManifest): ActionManifest {
    const parsed = ActionManifestSchema.parse(input);
    for (const action of parsed.actions) {
      this.actions.set(action.action_id, action);
    }
    return parsed;
  }

  registerTool(input: ToolRegistration): ToolRegistration {
    const parsed = ToolRegistrationSchema.parse(input);
    this.tools.set(parsed.tool_id, parsed);
    return parsed;
  }

  registerApprovalHook(hookId: string, hook: ApprovalHook): void {
    this.approvalHooks.set(hookId, hook);
  }

  registerEvidenceHook(hookId: string, hook: EvidenceHook): void {
    this.evidenceHooks.set(hookId, hook);
  }

  listCapabilities(): CapabilityRegistration[] {
    return [...this.capabilities.values()];
  }

  listActions(): ActionDefinition[] {
    return [...this.actions.values()];
  }

  listTools(): ToolRegistration[] {
    return [...this.tools.values()];
  }

  async evaluateApproval(hookId: string, action: ActionDefinition, context: ActionExecution | null): Promise<ApprovalHookResult> {
    const hook = this.approvalHooks.get(hookId);
    if (!hook) {
      return ApprovalHookResultSchema.parse({ approval_state: "not_required", reasons: ["no_hook_registered"] });
    }
    return applyApprovalHook(hook, action, context);
  }

  async applyEvidenceHook(hookId: string, pack: EvidencePack): Promise<EvidencePack> {
    const hook = this.evidenceHooks.get(hookId);
    if (!hook) {
      return EvidencePackSchema.parse(pack);
    }
    return applyEvidenceHook(hook, pack, {
      hook_id: hookId,
      artifact_refs: pack.generated_artifact_refs,
      action_id: "capability_registry.apply_evidence_hook"
    });
  }
}

export const createActionManifest = (
  capabilityId: string,
  manifestVersion: string,
  actions: ActionDefinition[],
  approvalHookIds: string[],
  evidenceHookIds: string[]
): ActionManifest =>
  ActionManifestSchema.parse({
    manifest_id: `${capabilityId}.manifest.${manifestVersion}`,
    manifest_version: manifestVersion,
    capability_id: capabilityId,
    contract: contractEnvelope("action"),
    actions,
    approval_hook_ids: approvalHookIds,
    evidence_hook_ids: evidenceHookIds
  });
