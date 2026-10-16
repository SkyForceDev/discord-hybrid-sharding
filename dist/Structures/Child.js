"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChildClient = exports.Child = void 0;
const child_process_1 = require("child_process");
class Child {
    file;
    process;
    processOptions;
    args;
    constructor(file, options) {
        this.file = file;
        this.process = null;
        this.processOptions = {};
        // Custom options
        if (options.clusterData)
            this.processOptions.env = options.clusterData;
        if (options.args)
            this.args = options.args;
        if (options.cwd)
            this.processOptions.cwd = options.cwd;
        if (options.detached)
            this.processOptions.detached = options.detached;
        if (options.execArgv)
            this.processOptions.execArgv = options.execArgv;
        if (options.env)
            this.processOptions.env = options.env;
        if (options.execPath)
            this.processOptions.execPath = options.execPath;
        if (options.gid)
            this.processOptions.gid = options.gid;
        this.processOptions.serialization = options.serialization ?? 'advanced';
        if (options.signal)
            this.processOptions.signal = options.signal;
        if (options.killSignal)
            this.processOptions.killSignal = options.killSignal;
        if (options.silent)
            this.processOptions.silent = options.silent;
        if (options.stdio)
            this.processOptions.stdio = options.stdio;
        if (options.uid)
            this.processOptions.uid = options.uid;
        if (options.windowsVerbatimArguments)
            this.processOptions.windowsVerbatimArguments = options.windowsVerbatimArguments;
        if (options.timeout)
            this.processOptions.timeout = options.timeout;
    }
    spawn() {
        return (this.process = (0, child_process_1.fork)(this.file, this.args, this.processOptions));
    }
    respawn() {
        this.kill();
        return this.spawn();
    }
    kill() {
        this.process?.removeAllListeners();
        return this.process?.kill();
    }
    send(message) {
        return new Promise((resolve, reject) => {
            if (!this.process)
                return reject(new Error('Process does not exist'));
            let drained = false;
            let callbackFired = false;
            const onDrain = () => {
                drained = true;
                if (callbackFired) {
                    cleanup();
                    resolve(this);
                }
            };
            const cleanup = () => {
                this.process?.off('drain', onDrain);
                this.process?.off('disconnect', onDisconnect);
            };
            const onDisconnect = () => {
                cleanup();
                reject(new Error('IPC channel disconnected'));
            };
            const canSend = this.process.send(message, (err) => {
                callbackFired = true;
                if (err) {
                    cleanup();
                    return reject(err);
                }
                if (drained || canSend !== false) {
                    cleanup();
                    resolve(this);
                }
            });
            if (canSend === false) {
                this.process.once('drain', onDrain);
                this.process.once('disconnect', onDisconnect);
            }
        });
    }
}
exports.Child = Child;
class ChildClient {
    ipc;
    constructor() {
        this.ipc = process;
    }
    send(message) {
        const proc = this.ipc;
        return new Promise((resolve, reject) => {
            if (!proc || !proc.send)
                return reject(new Error('Process IPC channel is not available'));
            let drained = false;
            let callbackFired = false;
            const onDrain = () => {
                drained = true;
                if (callbackFired) {
                    cleanup();
                    resolve();
                }
            };
            const cleanup = () => {
                proc.off('drain', onDrain);
                proc.off('disconnect', onDisconnect);
            };
            const onDisconnect = () => {
                cleanup();
                reject(new Error('IPC channel disconnected'));
            };
            const canSend = proc.send(message, (err) => {
                callbackFired = true;
                if (err) {
                    cleanup();
                    return reject(err);
                }
                if (drained || canSend !== false) {
                    cleanup();
                    resolve();
                }
            });
            if (canSend === false) {
                proc.once('drain', onDrain);
                proc.once('disconnect', onDisconnect);
            }
        });
    }
    getData() {
        return process.env;
    }
}
exports.ChildClient = ChildClient;
