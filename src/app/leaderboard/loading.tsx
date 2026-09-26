import { SiteHeader } from '@/app/site-header';
import { LeaderboardSkeleton } from '@/app/skeletons';

import { LeaderboardIntro } from './leaderboard-intro';

export default function LoadingLeaderboard() {
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
            <SiteHeader active="leaderboard" />
            <LeaderboardIntro />
            <LeaderboardSkeleton />
        </main>
    );
}
