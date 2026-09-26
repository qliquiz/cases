import { queryOptions } from '@tanstack/react-query';

import { getAccountState } from '@/app/actions';
import { loadLeaderboard } from '@/app/leaderboard/actions';

export const accountKey = ['account'] as const;
export const leaderboardKey = ['leaderboard'] as const;

export const accountQueryOptions = queryOptions({
    queryKey: accountKey,
    queryFn: () => getAccountState(),
});

export const leaderboardQueryOptions = queryOptions({
    queryKey: leaderboardKey,
    queryFn: async () => {
        const result = await loadLeaderboard();
        if (!result.ok) throw new Error(result.error);
        return result.data;
    },
    // Refresh only while the rating is on screen; no hidden-tab polling.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
});
