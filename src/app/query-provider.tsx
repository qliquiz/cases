'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import {
    Fragment,
    type ReactNode,
    useEffect,
    useState,
    useSyncExternalStore,
} from 'react';

import {
    announceSessionChange,
    createQueryClient,
    resetSessionCache,
    sessionGeneration,
} from '@/browser/query-cache';

export function QueryProvider({ children }: { children: ReactNode }) {
    // One client per mounted layout, never a server-side module singleton.
    const [client] = useState(createQueryClient);
    const generation = useSyncExternalStore(
        (notify) => client.getQueryCache().subscribe(notify),
        () => sessionGeneration(client),
        () => 0,
    );
    useEffect(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.get('authSuccess') === 'telegram') {
            announceSessionChange();
            url.searchParams.delete('authSuccess');
            window.history.replaceState(window.history.state, '', url);
        }
        if (!window.BroadcastChannel) return;
        let channel: BroadcastChannel;
        try {
            channel = new BroadcastChannel('casego-session');
        } catch {
            return;
        }
        channel.onmessage = () => {
            void resetSessionCache(client);
        };
        return () => channel.close();
    }, [client]);
    return (
        <QueryClientProvider client={client}>
            <Fragment key={generation}>{children}</Fragment>
        </QueryClientProvider>
    );
}
