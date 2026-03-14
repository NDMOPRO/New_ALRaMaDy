export declare const ActionRegistry: {contract:string;version:string;actions:Array<Record<string, unknown>>};
export declare function executeAction(action: Record<string, unknown>, payload: unknown): {execution_id:string;action_id:unknown;status:string;payload:unknown};
