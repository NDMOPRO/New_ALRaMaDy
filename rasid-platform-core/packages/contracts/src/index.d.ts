export type ContractRef = { contract: string; version: string };
export declare const CanonicalContract: ContractRef;
export declare const ActionRuntimeContract: ContractRef;
export declare const ModeContract: ContractRef & { allowed: string[] };
export declare const DegradeWarningContract: ContractRef & { allowed_outcomes: string[] };
export declare function validateCanonical(model: Record<string, unknown>): true;
export declare function validateActionDefinition(action: Record<string, unknown>): true;
export declare function validateMode(mode: string): true;
export declare function validateDegrade(outcome: Record<string, unknown>): true;
