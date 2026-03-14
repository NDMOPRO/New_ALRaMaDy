export declare const CapabilityRegistryContract: { contract: "capability_registry"; version: "1.0.0" };
export declare const Capabilities: readonly string[];
export declare const CapabilityRegistry: {contract:string;version:string;capabilities:Array<Record<string,unknown>>};
export declare function validateCapabilityEntry(entry: Record<string, unknown>): true;
