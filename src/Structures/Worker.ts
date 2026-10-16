import { Serializable } from 'child_process';
import { Worker as Worker_Thread, WorkerOptions, parentPort, workerData } from 'worker_threads';

export interface WorkerThreadOptions extends WorkerOptions {
    clusterData: any;
}

export class Worker {
    file: string;
    process: Worker_Thread | null;
    workerOptions: WorkerOptions;
    constructor(file: string, options: WorkerThreadOptions) {
        this.file = file;
        this.process = null;

        this.workerOptions = {};

        // Custom options
        if (options.clusterData) this.workerOptions.workerData = options.clusterData;

        if (options.argv) this.workerOptions.argv = options.argv;
        if (options.execArgv) this.workerOptions.execArgv = options.execArgv;
        if (options.env) this.workerOptions.env = options.env;
        if (options.eval) this.workerOptions.eval = options.eval;
        if (options.stdin) this.workerOptions.stdin = options.stdin;
        if (options.stdout) this.workerOptions.stdout = options.stdout;
        if (options.stderr) this.workerOptions.stderr = options.stderr;
        if (options.trackUnmanagedFds) this.workerOptions.trackUnmanagedFds = options.trackUnmanagedFds;
        if (options.transferList) this.workerOptions.transferList = options.transferList;
        if (options.resourceLimits) this.workerOptions.resourceLimits = options.resourceLimits;
    }

    public spawn() {
        return (this.process = new Worker_Thread(this.file, this.workerOptions));
    }

    public respawn() {
        this.kill();
        return this.spawn();
    }

    public kill() {
        this.process?.removeAllListeners();
        return this.process?.terminate();
    }

    public send(message: Serializable) {
        return new Promise((resolve, reject) => {
            if (!this.process) return reject(new Error('Worker process does not exist'));
            try {
                const canSend: unknown = this.process.postMessage(message);
                if (canSend === false) {
                    this.process.once('drain', () => resolve(this));
                } else {
                    resolve(this);
                }
            } catch (err) {
                reject(err);
            }
        });
    }
}

export class WorkerClient {
    ipc: typeof parentPort;
    constructor() {
        this.ipc = parentPort;
    }

    public send(message: Serializable) {
        return new Promise<void>((resolve, reject) => {
            if (!this.ipc) return reject(new Error('Parent port is not available'));
            try {
                const canSend: unknown = this.ipc.postMessage(message);
                if (canSend === false) {
                    this.ipc.once('drain', () => resolve());
                } else {
                    resolve();
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    public getData() {
        return workerData;
    }
}
