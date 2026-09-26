import type { Metadata } from 'next';

import { SiteHeader } from '@/app/site-header';

import { LeaderboardScreen } from './leaderboard-screen';

export const metadata: Metadata = { title: 'Рейтинг игроков — CaseGo' };

export default function LeaderboardPage() {
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
            <SiteHeader active="leaderboard" />
            <LeaderboardScreen />
        </main>
    );
}
