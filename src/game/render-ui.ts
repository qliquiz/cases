import { QueryClientProvider } from '@tanstack/react-query';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

import nextConfig from '../../next.config';
import { createQueryClient } from '../browser/query-cache';
import type { LeaderboardSnapshot } from '../server/leaderboard';

export function renderToStaticMarkup(
    node: ReactNode,
    leaderboard?: LeaderboardSnapshot,
) {
    const client = createQueryClient();
    if (leaderboard) client.setQueryData(['leaderboard'], leaderboard);
    try {
        // Standalone React SSR does not run Next's provider/config bootstrap.
        return render(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    ImageConfigContext.Provider,
                    { value: { ...imageConfigDefault, ...nextConfig.images } },
                    node,
                ),
            ),
        );
    } finally {
        client.clear();
    }
}
