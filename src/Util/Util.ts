import { DefaultOptions, Endpoints } from "../types/shared";

export function generateNonce() {
    return Date.now().toString(36) + Math.random().toString(36);
}

export function chunkArray(array: any[], chunkSize: number) {
    const R = [];
    for (let i = 0; i < array.length; i += chunkSize) R.push(array.slice(i, i + chunkSize));
    return R;
}

export function arraysAreTheSame(firstArray: any[], secondArray: any[]) {
    return firstArray.length === secondArray.length && firstArray.every((element, index) => element === secondArray[index]);
}

export function delayFor(ms: number) {
    if(ms < 0) return;
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export function makePlainError(err: Error) {
    return {
        name: err['name'],
        message: err['message'],
        stack: err['stack'],
    };
}

export function shardIdForGuildId(guildId: string, totalShards = 1) {
    const shard = Number(BigInt(guildId) >> BigInt(22)) % totalShards;
    if (shard < 0)
        throw new Error(
            'SHARD_MISCALCULATION_SHARDID_SMALLER_THAN_0 ' +
                `Calculated Shard: ${shard}, guildId: ${guildId}, totalShards: ${totalShards}`,
        );
    return shard;
}

export async function fetchRecommendedShards(token: string, guildsPerShard = 1000): Promise<number> {
    if (!token) throw new Error('DISCORD_TOKEN_MISSING');

    const url = `${DefaultOptions.http.api}/v${DefaultOptions.http.version}${Endpoints.botGateway}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bot ${token.replace(/^Bot\s*/i, '')}`,
        },
    });

    if (res.status === 200) {
        const responseData = (await res.json()) as { shards: number };
        return Math.ceil(responseData.shards * (1000 / guildsPerShard));
    } else if (res.status === 401) {
        throw new Error('DISCORD_TOKEN_INVALID');
    } else {
        throw new Error(`Failed to fetch data. Status code: ${res.status}`);
    }
}
