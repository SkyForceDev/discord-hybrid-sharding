import { generateNonce } from '../Util/Util';
import { RawMessage } from './IPCMessage';

export interface StoredPromise {
    resolve(value: any): void;
    reject(error: Error): void;
    options: PromiseCreateOptions;
    timeout?: NodeJS.Timeout;
    clusterId?: number;
}

export interface ResolveMessage {
    _error: { message: string; stack: string; name: string };
    _result: any;
    _eval?: string;
    _type?: number;
    nonce: string;
}

export interface PromiseCreateOptions {
    timeout?: number;
    clusterId?: number;
}

export class PromiseHandler {
    nonce: Map<string, StoredPromise>;
    constructor() {
        this.nonce = new Map();
    }
    public resolve(message: ResolveMessage) {
        const promise = this.nonce.get(message.nonce);
        if (promise) {
            if (promise.timeout) clearTimeout(promise.timeout);
            this.nonce.delete(message.nonce);
            if (message._error) {
                const error = new Error(message._error.message);
                error.stack = message._error.stack;
                error.name = message._error.name;
                promise.reject(error);
            } else {
                promise.resolve(message._result);
            }
        }
    }

    public async create(
        message: RawMessage & { options?: PromiseCreateOptions; stack?: string },
        options: PromiseCreateOptions = {},
    ) {
        if (!options) options = {};
        if (Object.keys(options).length === 0 && message.options) options = message.options;
        if (!message.nonce) message.nonce = generateNonce();

        const clusterId = options.clusterId ?? message.options?.clusterId;
        const timeoutMs = typeof options.timeout === 'number' && options.timeout > 0 ? options.timeout : 30000;

        return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.nonce.delete(message.nonce as string);
                const error = new Error(`IPC Request timed out after ${timeoutMs}ms (Cluster: ${clusterId ?? 'unknown'})`);
                error.stack = message.stack || error.stack;
                reject(error);
            }, timeoutMs);

            this.nonce.set(message.nonce as string, {
                resolve,
                reject,
                options,
                timeout,
                clusterId,
            });
        });
    }

    /**
     * Rejects and deletes all pending promises for a deceased cluster
     * @param clusterId The ID of the deceased cluster
     * @param reason The reason for the rejection
     */
    public rejectAllForCluster(clusterId: number, reason: string) {
        for (const [nonce, item] of this.nonce.entries()) {
            if (item.clusterId === clusterId) {
                if (item.timeout) clearTimeout(item.timeout);
                this.nonce.delete(nonce);
                item.reject(new Error(`Cluster ${clusterId} died before replying: ${reason}`));
            }
        }
    }

    /**
     * Rejects all pending promises before clearing the map
     * @param reason The reason for cancelling all pending promises
     */
    public rejectAll(reason: string) {
        for (const item of this.nonce.values()) {
            if (item.timeout) clearTimeout(item.timeout);
            item.reject(new Error(`Operation cancelled: ${reason}`));
        }
        this.nonce.clear();
    }
}
