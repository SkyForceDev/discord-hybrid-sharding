"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromiseHandler = void 0;
const Util_1 = require("../Util/Util");
class PromiseHandler {
    nonce;
    constructor() {
        this.nonce = new Map();
    }
    resolve(message) {
        const promise = this.nonce.get(message.nonce);
        if (promise) {
            if (promise.timeout)
                clearTimeout(promise.timeout);
            this.nonce.delete(message.nonce);
            if (message._error) {
                const error = new Error(message._error.message);
                error.stack = message._error.stack;
                error.name = message._error.name;
                promise.reject(error);
            }
            else {
                promise.resolve(message._result);
            }
        }
    }
    async create(message, options = {}) {
        if (!options)
            options = {};
        if (Object.keys(options).length === 0 && message.options)
            options = message.options;
        if (!message.nonce)
            message.nonce = (0, Util_1.generateNonce)();
        const clusterId = options.clusterId ?? message.options?.clusterId;
        const timeoutMs = typeof options.timeout === 'number' && options.timeout > 0 ? options.timeout : 30000;
        return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.nonce.delete(message.nonce);
                const error = new Error(`IPC Request timed out after ${timeoutMs}ms (Cluster: ${clusterId ?? 'unknown'})`);
                error.stack = message.stack || error.stack;
                reject(error);
            }, timeoutMs);
            this.nonce.set(message.nonce, {
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
    rejectAllForCluster(clusterId, reason) {
        for (const [nonce, item] of this.nonce.entries()) {
            if (item.clusterId === clusterId) {
                if (item.timeout)
                    clearTimeout(item.timeout);
                this.nonce.delete(nonce);
                item.reject(new Error(`Cluster ${clusterId} died before replying: ${reason}`));
            }
        }
    }
    /**
     * Rejects all pending promises before clearing the map
     * @param reason The reason for cancelling all pending promises
     */
    rejectAll(reason) {
        for (const item of this.nonce.values()) {
            if (item.timeout)
                clearTimeout(item.timeout);
            item.reject(new Error(`Operation cancelled: ${reason}`));
        }
        this.nonce.clear();
    }
}
exports.PromiseHandler = PromiseHandler;
