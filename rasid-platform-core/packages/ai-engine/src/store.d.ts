import type { AiExecutionPlan, AiExecutionRequest, AiExecutionSummary, AiPageContext, Artifact, AuditEvent, EvidencePack, Job, LineageEdge } from "@rasid/contracts";
export type AiSessionState = {
    session_id: string;
    page_path: string;
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    current_artifact_ref: string | null;
    recent_job_refs: string[];
    recent_output_refs: string[];
    updated_at: string;
};
export type AiPersistedBundle = {
    request: AiExecutionRequest;
    context: AiPageContext;
    plan: AiExecutionPlan;
    summary: AiExecutionSummary;
    phases: unknown[];
    job: Job;
    artifacts: Artifact[];
    evidencePack: EvidencePack;
    auditEvents: AuditEvent[];
    lineageEdges: LineageEdge[];
    open_path: string | null;
};
export declare const defaultAiEngineStorageRoot: (root?: string) => string;
export declare class AiEngineStore {
    readonly rootDir: string;
    constructor(rootDir?: string);
    private sessionFile;
    private jobRoot;
    loadSession(sessionId: string): AiSessionState | null;
    persistSession(session: AiSessionState): AiSessionState;
    persistBundle(bundle: AiPersistedBundle): AiPersistedBundle;
    loadBundle(jobId: string): AiPersistedBundle;
    listJobIds(sessionId?: string): string[];
}
