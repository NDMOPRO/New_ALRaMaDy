import { RegistryBootstrap } from "@rasid/capability-registry";
import { type AiExecutionPhase, type AiExecutionSummary, type AiPagePath, type Job, type PermissionScope } from "@rasid/contracts";
import { AiEngineStore, type AiPersistedBundle } from "./store";
export { AiEngineStore, defaultAiEngineStorageRoot } from "./store";
export type SubmitAiJobInput = {
    session_id: string;
    page_path: AiPagePath;
    user_prompt: string;
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    actor_ref: string;
    requested_mode?: "easy" | "advanced";
    approval_granted?: boolean;
    resource_ref?: string | null;
    resource_refs?: string[];
    current_artifact_ref?: string | null;
    context_payload?: Record<string, unknown>;
    permission_scope?: PermissionScope;
    governance_tags?: string[];
};
export type AiJobBundle = AiPersistedBundle & {
    phases: AiExecutionPhase[];
    approval_boundary: {
        required: boolean;
        state: "not_required" | "pending" | "approved" | "rejected";
    };
};
export declare class RasidAiEngine {
    readonly store: AiEngineStore;
    constructor(options?: {
        storageDir?: string;
    });
    submitJob(input: SubmitAiJobInput): Promise<AiJobBundle>;
    private finalizePhases;
    private persistRun;
    approveJob(jobId: string, actorRef?: string): Promise<AiJobBundle>;
    getJob(jobId: string): AiJobBundle;
    listJobs(sessionId?: string): Array<{
        job_id: string;
        summary: AiExecutionSummary;
        job: Job;
    }>;
}
export declare const registerAiCapability: (runtime: RegistryBootstrap) => void;
