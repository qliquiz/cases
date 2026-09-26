export function Skeleton({ className = '' }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={`block rounded-lg bg-line motion-safe:animate-pulse ${className}`}
        />
    );
}

export function AccountSkeleton() {
    return (
        <div
            role="status"
            aria-label="Загружаем аккаунт и коллекцию"
            aria-busy="true"
            data-skeleton="account"
            className="relative"
        >
            <span className="sr-only">Проверяем вход…</span>
            {/* The actual guest form reserves its responsive height, including
                wrapped text. Do not guess an authenticated collection here. */}
            <div className="invisible" aria-hidden="true" inert>
                <GuestAccountHint />
                <AuthPanel account={null} onChanged={async () => {}} disabled />
            </div>
            <div className="absolute inset-0 flex flex-col pt-3">
                <Skeleton className="mx-auto h-5 w-3/4" />
                <div className="mt-4 flex flex-1 flex-col gap-4 rounded-xl border border-line p-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                </div>
            </div>
        </div>
    );
}

export function LeaderboardSkeleton() {
    return (
        <div
            role="status"
            aria-label="Загружаем рейтинг"
            aria-busy="true"
            data-skeleton="leaderboard"
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        >
            <span className="sr-only">Загружаем рейтинг…</span>
            <div className="min-h-[30rem] overflow-hidden rounded-3xl border border-line bg-surface">
                <div className="border-b border-line p-5 sm:p-6">
                    <Skeleton className="h-7 w-24" />
                </div>
                {Array.from({ length: 5 }, (_, i) => (
                    <div
                        key={i}
                        className="flex gap-4 border-b border-line px-4 py-5 sm:px-6"
                    >
                        <Skeleton className="size-10 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-3">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="order-first min-h-[30rem] space-y-6 rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:order-last">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}
import { AuthPanel, GuestAccountHint } from '@/app/auth-panel';
