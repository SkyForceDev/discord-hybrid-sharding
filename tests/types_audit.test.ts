import { ClusterManager, ClusterClient, evalOptions, Serialized } from '../src';

type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// Module-level compile-time type assertions
function typeVerification(manager: ClusterManager, clusterClient: ClusterClient) {
    // Test 1: string script, no options -> Promise<any[]>
    const t1 = manager.broadcastEval('client.guilds.cache.size');
    type T1 = typeof t1;

    // Test 2: string script, single cluster -> Promise<any>
    const t2 = manager.broadcastEval('client.guilds.cache.size', { cluster: 0 });
    type T2 = typeof t2;

    // Test 3: string script, multiple clusters -> Promise<any[]>
    const t3 = manager.broadcastEval('client.guilds.cache.size', { cluster: [0, 1] });
    type T3 = typeof t3;

    // Test 4: fn without context, no options -> Promise<number[]>
    const t4 = manager.broadcastEval(c => c.guilds.cache.size);
    type T4 = typeof t4;

    // Test 5: fn without context, single cluster -> Promise<number>
    const t5 = manager.broadcastEval(c => c.guilds.cache.size, { cluster: 0 });
    type T5 = typeof t5;

    // Test 6: fn without context, timeout only -> Promise<number[]>
    const t6 = manager.broadcastEval(c => c.guilds.cache.size, { timeout: 1000 });
    type T6 = typeof t6;

    // Test 7: fn without context, multiple clusters -> Promise<number[]>
    const t7 = manager.broadcastEval(c => c.guilds.cache.size, { cluster: [0, 1] });
    type T7 = typeof t7;

    // Test 8: fn with context, no cluster -> Promise<boolean[]>
    const t8 = manager.broadcastEval((c, context) => c.guilds.cache.has(context.id), { context: { id: '123' } });
    type T8 = typeof t8;

    // Test 9: fn with context, single cluster -> Promise<boolean>
    const t9 = manager.broadcastEval((c, context) => c.guilds.cache.has(context.id), { context: { id: '123' }, cluster: 0 });
    type T9 = typeof t9;

    // Test 10: fn with evalOptions variable
    const opts: evalOptions<{ id: string }> = { context: { id: '123' } };
    const t10 = manager.broadcastEval((c, context) => c.guilds.cache.has(context.id), opts);
    type T10 = typeof t10;

    // Test 11: fn with evalOptions variable with no context
    const opts2: evalOptions = { timeout: 5000 };
    const t11 = manager.broadcastEval(c => c.guilds.cache.size, opts2);
    type T11 = typeof t11;

    const c1 = clusterClient.broadcastEval('client.guilds.cache.size');
    type C1 = typeof c1;
    const c2 = clusterClient.broadcastEval('client.guilds.cache.size', { cluster: 0 });
    type C2 = typeof c2;
    const c3 = clusterClient.broadcastEval('client.guilds.cache.size', { cluster: [0, 1] });
    type C3 = typeof c3;
    const c4 = clusterClient.broadcastEval(c => c.guilds.cache.size);
    type C4 = typeof c4;
    const c5 = clusterClient.broadcastEval(c => c.guilds.cache.size, { cluster: 0 });
    type C5 = typeof c5;
    const c6 = clusterClient.broadcastEval(c => c.guilds.cache.size, { timeout: 1000 });
    type C6 = typeof c6;
    const c7 = clusterClient.broadcastEval(c => c.guilds.cache.size, { cluster: [0, 1] });
    type C7 = typeof c7;
    const c8 = clusterClient.broadcastEval((c, context) => c.guilds.cache.has(context.id), { context: { id: '123' } });
    type C8 = typeof c8;
    const c9 = clusterClient.broadcastEval((c, context) => c.guilds.cache.has(context.id), { context: { id: '123' }, cluster: 0 });
    type C9 = typeof c9;
    const c10 = clusterClient.broadcastEval((c, context) => c.guilds.cache.has(context.id), opts);
    type C10 = typeof c10;
    const c11 = clusterClient.broadcastEval(c => c.guilds.cache.size, opts2);
    type C11 = typeof c11;

    // BigInt serialization check
    type TestBigInt = Serialized<bigint>;
    type IsBigInt = [TestBigInt] extends [bigint] ? true : false;

    // Union option check
    const optsUnion: { cluster?: number | number[]; timeout?: number } = { cluster: [0, 1] };
    const tUnion = manager.broadcastEval(c => c.guilds.cache.size, optsUnion);
    type TUnion = typeof tUnion;

    type Checks = [
        Expect<Equal<T1, Promise<any[]>>>,
        Expect<Equal<T2, Promise<any>>>,
        Expect<Equal<T3, Promise<any[]>>>,
        Expect<Equal<T4, Promise<number[]>>>,
        Expect<Equal<T5, Promise<number>>>,
        Expect<Equal<T6, Promise<number[]>>>,
        Expect<Equal<T7, Promise<number[]>>>,
        Expect<Equal<T8, Promise<boolean[]>>>,
        Expect<Equal<T9, Promise<boolean>>>,
        Expect<Equal<T10, Promise<boolean[]>>>,
        Expect<Equal<T11, Promise<number[]>>>,
        Expect<Equal<C1, Promise<any[]>>>,
        Expect<Equal<C2, Promise<any>>>,
        Expect<Equal<C3, Promise<any[]>>>,
        Expect<Equal<C4, Promise<number[]>>>,
        Expect<Equal<C5, Promise<number>>>,
        Expect<Equal<C6, Promise<number[]>>>,
        Expect<Equal<C7, Promise<number[]>>>,
        Expect<Equal<C8, Promise<boolean[]>>>,
        Expect<Equal<C9, Promise<boolean>>>,
        Expect<Equal<C10, Promise<boolean[]>>>,
        Expect<Equal<C11, Promise<number[]>>>,
        Expect<Equal<IsBigInt, true>>,
        Expect<Equal<TUnion, Promise<number[]>>>,
    ];

    return true as [Checks] extends [Checks] ? true : false;
}

describe('TypeScript Type Inference & Signature Compatibility', () => {
    test('broadcastEval overloads and BigInt serialization pass type checking', () => {
        expect(typeof typeVerification).toBe('function');
    });
});
