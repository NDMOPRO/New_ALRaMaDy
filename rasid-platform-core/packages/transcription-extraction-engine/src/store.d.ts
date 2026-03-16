import { type Artifact, type AuditEvent, type CanonicalRepresentation, type EvidencePack, type Job, type LibraryAsset, type LineageEdge, type TranscriptionCompareResult, type TranscriptionQuestionAnswer, type UnifiedContentBundle } from "@rasid/contracts";
export type StoredWorkflowResult = {
    bundle: UnifiedContentBundle;
    bundleArtifact: Artifact;
    transcriptArtifact: Artifact;
    extractionArtifact: Artifact;
    summaryArtifact: Artifact;
    canonical: CanonicalRepresentation;
    job: Job;
    evidencePack: EvidencePack;
    auditEvents: AuditEvent[];
    lineageEdges: LineageEdge[];
    libraryAsset: LibraryAsset | null;
    reportHandoff: Record<string, unknown>;
    queryDataset: Record<string, unknown>;
};
export type StoredCompareResult = {
    compareResult: TranscriptionCompareResult;
    diffArtifact: Artifact;
    job: Job;
    evidencePack: EvidencePack;
    auditEvents: AuditEvent[];
    lineageEdges: LineageEdge[];
};
export declare const defaultTranscriptionStorageRoot: (root?: string) => string;
export declare class TranscriptionExtractionStore {
    readonly rootDir: string;
    constructor(rootDir?: string);
    private jobRoot;
    private bundleRoot;
    private jobFile;
    private bundleFile;
    writeInputFile(jobId: string, fileName: string, content: Buffer): string;
    writeInputCopy(jobId: string, fileName: string, sourcePath: string): string;
    persistWorkflow(result: StoredWorkflowResult): StoredWorkflowResult;
    persistCompare(jobId: string, compare: StoredCompareResult): StoredCompareResult;
    persistQuestionAnswer(jobId: string, answer: TranscriptionQuestionAnswer): TranscriptionQuestionAnswer;
    listJobIds(): string[];
    loadJob(jobId: string): Job;
    listJobs(): Job[];
    loadBundle(bundleId: string): UnifiedContentBundle;
    loadBundleByJob(jobId: string): UnifiedContentBundle;
    listAuditEvents(jobId: string): AuditEvent[];
    listLineageEdges(jobId: string): LineageEdge[];
    listQuestions(jobId: string): TranscriptionQuestionAnswer[];
    loadCompare(jobId: string, compareId: string): TranscriptionCompareResult;
}
