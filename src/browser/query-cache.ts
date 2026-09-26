import { QueryClient } from '@tanstack/react-query';

const generations = new WeakMap<QueryClient, number>();
export function sessionGeneration(client: QueryClient) {
    return generations.get(client) ?? 0;
}

export function announceSessionChange() {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    try {
        const channel = new BroadcastChannel('casego-session');
        try {
            channel.postMessage('changed');
        } finally {
            channel.close();
        }
    } catch {
        // Cross-tab notification is best effort; local logout must still finish.
    }
}

export function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: typeof window === 'undefined' ? Infinity : 5 * 60_000,
                retry: 1,
                refetchOnWindowFocus: true,
            },
        },
    });
}

export async function resetSessionCache(client: QueryClient) {
    generations.set(client, sessionGeneration(client) + 1);
    await client.cancelQueries();
    await client.resetQueries();
}
