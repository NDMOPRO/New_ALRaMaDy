import { RegistryBootstrap } from "@rasid/capability-registry";
import { type TranscriptionJobRequest, type TranscriptionQuestionAnswer, type TranscriptionQuestionRequest } from "@rasid/contracts";
import { z } from "zod";
import { TranscriptionExtractionStore, type StoredCompareResult, type StoredWorkflowResult } from "./store";
export { TranscriptionExtractionStore, defaultTranscriptionStorageRoot } from "./store";
declare const CompareRequestSchema: z.ZodObject<{
    left_bundle_ref: z.ZodString;
    right_bundle_ref: z.ZodString;
    actor_ref: z.ZodString;
    workspace_id: z.ZodString;
    tenant_ref: z.ZodString;
    storage_dir: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenant_ref: string;
    workspace_id: string;
    actor_ref: string;
    left_bundle_ref: string;
    right_bundle_ref: string;
    storage_dir?: string | undefined;
}, {
    tenant_ref: string;
    workspace_id: string;
    actor_ref: string;
    left_bundle_ref: string;
    right_bundle_ref: string;
    storage_dir?: string | undefined;
}>;
declare const TranscriptionDispatchRequestSchema: z.ZodObject<{
    action_id: z.ZodString;
    payload: z.ZodUnknown;
    storage_dir: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action_id: string;
    storage_dir?: string | undefined;
    payload?: unknown;
}, {
    action_id: string;
    storage_dir?: string | undefined;
    payload?: unknown;
}>;
declare const TranscriptionToolDispatchRequestSchema: z.ZodObject<{
    tool_id: z.ZodString;
    payload: z.ZodUnknown;
    storage_dir: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tool_id: string;
    storage_dir?: string | undefined;
    payload?: unknown;
}, {
    tool_id: string;
    storage_dir?: string | undefined;
    payload?: unknown;
}>;
type CompareRequest = z.infer<typeof CompareRequestSchema>;
export type TranscriptionEngineOptions = {
    storageDir?: string;
    pythonExecutable?: string;
};
export type TranscriptionWorkflowResult = StoredWorkflowResult;
export type TranscriptionCompareBundle = StoredCompareResult;
export declare class TranscriptionExtractionEngine {
    readonly store: TranscriptionExtractionStore;
    readonly pythonExecutable: string;
    constructor(options?: TranscriptionEngineOptions);
    private callBridge;
    private analyzeSpreadsheet;
    ingestAndExtract(input: TranscriptionJobRequest): Promise<TranscriptionWorkflowResult>;
    compareBundles(input: CompareRequest): TranscriptionCompareBundle;
    answerQuestion(input: TranscriptionQuestionRequest): TranscriptionQuestionAnswer;
}
export declare const dispatchTranscriptionAction: (input: z.infer<typeof TranscriptionDispatchRequestSchema>) => Promise<unknown>;
export declare const dispatchTranscriptionTool: (input: z.infer<typeof TranscriptionToolDispatchRequestSchema>) => Promise<unknown>;
export declare const registerTranscriptionCapability: (runtime: RegistryBootstrap) => void;
