import { RawMessage } from './IPCMessage';
export interface StoredPromise {
    resolve(value: any): void;
    reject(error: Error): void;
    options: PromiseCreateOptions;
    timeout?: NodeJS.Timeout;
    clusterId?: number;
}
export interface ResolveMessage {
    _error: {
        message: string;
        stack: string;
        name: string;
    };
    _result: any;
    _eval?: string;
    _type?: number;
    nonce: string;
}
export interface PromiseCreateOptions {
    timeout?: number;
    clusterId?: number;
}
export declare class PromiseHandler {
    nonce: Map<string, StoredPromise>;
    constructor();
    resolve(message: ResolveMessage): void;
    create(message: RawMessage & {
        options?: PromiseCreateOptions;
        stack?: string;
    }, options?: PromiseCreateOptions): Promise<unknown>;
    /**
     * Rejects and deletes all pending promises for a deceased cluster
     * @param clusterId The ID of the deceased cluster
     * @param reason The reason for the rejection
     */
    rejectAllForCluster(clusterId: number, reason: string): void;
    /**
     * Rejects all pending promises before clearing the map
     * @param reason The reason for cancelling all pending promises
     */
    rejectAll(reason: string): void;
}
//# sourceMappingURL=PromiseHandler.d.ts.map