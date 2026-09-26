import type { Metadata } from 'next';

import { SiteHeader } from '@/app/site-header';

import { loadLeaderboard } from './actions';
import { LeaderboardScreen } from './leaderboard-screen';

export const metadata: Metadata = { title: 'Рейтинг игроков — CaseGo' };

export default async function LeaderboardPage() {
    const initial = await loadLeaderboard();
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
            <SiteHeader active="leaderboard" />
            <LeaderboardScreen initial={initial} />
        </main>
    );
}
