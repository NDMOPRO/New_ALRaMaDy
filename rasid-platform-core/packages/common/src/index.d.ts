export declare const CONTRACT_VERSION: "1.0.0";
export declare const Modes: Readonly<{EASY:"easy";ADVANCED:"advanced"}>;
export declare const DegradeOutcomes: Readonly<{SUCCESS:"success";SUCCESS_WITH_WARNINGS:"success_with_warnings";DEGRADED:"degraded";FAILED:"failed"}>;
export declare function assertRequired(obj: Record<string, unknown>, fields: string[], ctx: string): true;
export declare function assertOneOf(value: string, allowed: string[], field: string): void;
export declare function assertVersioned(contractName: string, model: {contract:string;version:string}): void;
