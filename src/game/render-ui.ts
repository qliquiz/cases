import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

import { createQueryClient } from '../browser/query-cache';
import type { LeaderboardSnapshot } from '../server/leaderboard';

export function renderToStaticMarkup(
    node: ReactNode,
    leaderboard?: LeaderboardSnapshot,
) {
    const client = createQueryClient();
    if (leaderboard) client.setQueryData(['leaderboard'], leaderboard);
    try {
        return render(createElement(QueryClientProvider, { client }, node));
    } finally {
        client.clear();
    }
}
