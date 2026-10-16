import { Child } from '../src/Structures/Child';
import { PromiseHandler } from '../src/Structures/PromiseHandler';
import { Cluster } from '../src/Core/Cluster';
import { ClusterClient } from '../src/Core/ClusterClient';
import { getInfo } from '../src/Structures/Data';
import { Events } from '../src/types/shared';
import { fetchRecommendedShards } from '../src/Util/Util';
import path from 'path';
import { fork } from 'child_process';

describe('discord-hybrid-sharding Modernization & Reliability Suite', () => {
    describe('1. BigInt IPC Serialization (P2-2)', () => {
        it('should default Child processOptions.serialization to "advanced"', () => {
            const child = new Child('dummy.js', { clusterData: undefined });
            expect(child.processOptions.serialization).toBe('advanced');
        });

        it('should successfully serialize and deserialize BigInt payloads over IPC', async () => {
            // Write a tiny inline worker script that echoes back received IPC messages
            const workerScript = `
                process.on('message', (msg) => {
                    process.send({ echo: msg, echoedBigInt: msg.snowflake * 2n });
                });
            `;

            const childProcess = fork('-e', [workerScript], {
                serialization: 'advanced',
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            });

            const received = await new Promise<any>((resolve, reject) => {
                const timer = setTimeout(() => {
                    childProcess.kill();
                    reject(new Error('IPC echo timed out'));
                }, 4000);

                childProcess.on('message', msg => {
                    clearTimeout(timer);
                    childProcess.kill();
                    resolve(msg);
                });

                childProcess.on('error', err => {
                    clearTimeout(timer);
                    childProcess.kill();
                    reject(err);
                });

                // Send BigInt payload
                const payload = {
                    snowflake: 123456789012345678n,
                    permissions: 1n << 32n,
                };
                childProcess.send(payload);
            });

            expect(typeof received.echo.snowflake).toBe('bigint');
            expect(received.echo.snowflake).toBe(123456789012345678n);
            expect(received.echo.permissions).toBe(1n << 32n);
            expect(received.echoedBigInt).toBe(246913578024691356n);
        });
    });

    describe('2. PromiseHandler Lifecycle & Orphan Clean-up (P0-1)', () => {
        it('should track clusterId and reject all pending promises for deceased cluster', async () => {
            const handler = new PromiseHandler();

            const promiseCluster1 = handler.create({ nonce: 'nonce-c1' }, { clusterId: 1 });
            const promiseCluster2 = handler.create({ nonce: 'nonce-c2' }, { clusterId: 2 });

            expect(handler.nonce.get('nonce-c1')?.clusterId).toBe(1);
            expect(handler.nonce.get('nonce-c2')?.clusterId).toBe(2);

            // Simulate death of cluster 1
            handler.rejectAllForCluster(1, 'Worker terminated with SIGKILL');

            expect(handler.nonce.has('nonce-c1')).toBe(false);
            expect(handler.nonce.has('nonce-c2')).toBe(true);

            await expect(promiseCluster1).rejects.toThrow(
                'Cluster 1 died before replying: Worker terminated with SIGKILL',
            );

            // Cluster 2 should still be resolvable
            handler.resolve({ nonce: 'nonce-c2', _result: 'cluster 2 result', _error: null as any });
            await expect(promiseCluster2).resolves.toBe('cluster 2 result');
        });

        it('should reject all pending promises when rejectAll is invoked', async () => {
            const handler = new PromiseHandler();

            const p1 = handler.create({ nonce: 'p1' }, { clusterId: 1 });
            const p2 = handler.create({ nonce: 'p2' }, { clusterId: 2 });

            handler.rejectAll('Global respawnAll in progress');
            expect(handler.nonce.size).toBe(0);

            await expect(p1).rejects.toThrow('Operation cancelled: Global respawnAll in progress');
            await expect(p2).rejects.toThrow('Operation cancelled: Global respawnAll in progress');
        });
    });

    describe('3. Cluster Respawn Concurrency Protection (P0-2, P1-1)', () => {
        let manager: any;

        beforeEach(() => {
            manager = {
                mode: 'process',
                shardArgs: [],
                execArgv: [],
                totalClusters: 1,
                token: 'mock-token',
                restarts: { current: 0, max: 3, interval: 60000 },
                spawnOptions: { delay: 50, timeout: 500 },
                promise: new PromiseHandler(),
                _debug: jest.fn(),
                emit: jest.fn(),
                hooks: { constructClusterArgs: (_: any, args: string[]) => args },
                clusterOptions: {},
                clusterData: {},
                file: path.resolve(__dirname, 'dummy_worker.js'),
            };
        });

        it('should guard against duplicate concurrent respawn calls', async () => {
            const cluster = new Cluster(manager, 0, [0], 1);

            let spawnCalls = 0;
            cluster.spawn = jest.fn().mockImplementation(async () => {
                spawnCalls++;
                return {} as any;
            });
            cluster.kill = jest.fn();

            // Fire two respawns simultaneously
            const r1 = cluster.respawn({ delay: 50, timeout: 500 });
            const r2 = cluster.respawn({ delay: 50, timeout: 500 });

            await Promise.all([r1, r2]);

            expect(spawnCalls).toBe(1);
            expect(manager._debug).toHaveBeenCalledWith(
                expect.stringContaining('[RESPAWN] Respawn already in progress'),
                0,
            );
        });

        it('should abort auto-respawn in _handleExit if explicit respawn is in progress', () => {
            const cluster = new Cluster(manager, 0, [0], 1);

            const spawnMock = jest.fn().mockResolvedValue({} as any);
            cluster.spawn = spawnMock;

            // Mark isRespawning as true
            (cluster as any).isRespawning = true;
            (cluster as any)._handleExit(1);

            expect(spawnMock).not.toHaveBeenCalled();
            expect(manager._debug).toHaveBeenCalledWith(
                expect.stringContaining('[EXIT] Process exited during explicit respawn cycle'),
                0,
            );
        });

        it('should unconditionally remove ready and death listeners in spawn cleanup', async () => {
            const cluster = new Cluster(manager, 0, [0], 1);

            // Timeout path
            try {
                await cluster.spawn(10);
            } catch (err: any) {
                expect(err.message).toContain('CLUSTERING_READY_TIMEOUT');
            }
            cluster.kill({ force: true });
            expect(cluster.listenerCount('ready')).toBe(0);
            expect(cluster.listenerCount('death')).toBe(0);

            // Ready path
            cluster.thread = null;
            const readyPromise = cluster.spawn(5000);
            cluster.emit('ready');
            await readyPromise;
            cluster.kill({ force: true });
            expect(cluster.listenerCount('ready')).toBe(0);
            expect(cluster.listenerCount('death')).toBe(0);

            // Death path
            cluster.thread = null;
            const deathPromise = cluster.spawn(5000);
            cluster.emit('death', cluster, null);
            await expect(deathPromise).rejects.toThrow('CLUSTERING_READY_DIED');
            cluster.kill({ force: true });
            expect(cluster.listenerCount('ready')).toBe(0);
            expect(cluster.listenerCount('death')).toBe(0);
        });
    });

    describe('4. Gateway Decoupling & Runtime Environment (P1-2, P2-1, P2-3)', () => {
        const originalEnv = { ...process.env };

        beforeEach(() => {
            process.env.CLUSTER_MANAGER_MODE = 'process';
            process.env.TOTAL_SHARDS = '1';
            process.env.CLUSTER_COUNT = '1';
            process.env.CLUSTER = '0';
            process.env.SHARD_LIST = '0';
        });

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        it('should guard shards getter and fallback gracefully on non-monolithic client', () => {
            const mockClient: any = {}; // No ws property
            const clusterClient = new ClusterClient(mockClient);

            // Fallback to SHARD_LIST instead of throwing TypeError
            expect(Array.isArray(clusterClient.shards)).toBe(true);
            expect(clusterClient.shardList).toEqual(clusterClient.info.SHARD_LIST);
        });

        it('should return client.gateway.shards if available (@discordjs/ws decoupling)', () => {
            const mockGatewayShards = new Map([[0, { id: 0 }]]);
            const mockClient: any = { gateway: { shards: mockGatewayShards } };
            const clusterClient = new ClusterClient(mockClient);

            expect(clusterClient.shards).toBe(mockGatewayShards);
        });

        it('should parse empty or unset SHARD_LIST to empty array []', () => {
            const originalEnv = { ...process.env };
            process.env.CLUSTER_MANAGER_MODE = 'process';
            process.env.TOTAL_SHARDS = '1';
            process.env.CLUSTER_COUNT = '1';
            process.env.CLUSTER = '0';

            process.env.SHARD_LIST = '';
            expect(getInfo().SHARD_LIST).toEqual([]);

            delete process.env.SHARD_LIST;
            expect(getInfo().SHARD_LIST).toEqual([]);

            process.env.SHARD_LIST = '0,1,2';
            expect(getInfo().SHARD_LIST).toEqual([0, 1, 2]);

            process.env = originalEnv;
        });

        it('should map Events.ERROR to "error" and Events.WARN to "warn"', () => {
            expect(Events.ERROR).toBe('error');
            expect(Events.WARN).toBe('warn');
        });

        it('should use Math.ceil in fetchRecommendedShards to prevent fractional shard counts', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({
                status: 200,
                json: async () => ({ shards: 2 }),
            } as any);

            try {
                // 2 * (1000 / 1500) = 1.3333333333333333 -> ceil to 2
                const result = await fetchRecommendedShards('token', 1500);
                expect(result).toBe(2);
                expect(Number.isInteger(result)).toBe(true);
            } finally {
                global.fetch = originalFetch;
            }
        });
    });
});
