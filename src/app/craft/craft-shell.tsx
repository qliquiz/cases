import type { ReactNode } from 'react';

import { SiteHeader } from '@/app/site-header';
import { Skeleton } from '@/app/skeletons';

export function CraftShell({ children }: { children: ReactNode }) {
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
            <SiteHeader active="craft" />
            <section className="py-10 sm:py-14">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                    Дубликаты в дело · 10 → 1
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                    Крафт скинов
                </h1>
                <p className="mt-4 max-w-2xl leading-7 text-muted">
                    Обменяй десять предметов одной редкости на один следующей.
                    Смешивай коллекции, смотри шансы и собирай альбом дальше.
                </p>
                <p className="mt-5 rounded-2xl border border-accent/30 bg-amber-400/10 p-4 text-sm leading-6 text-muted">
                    Это виртуальный контракт CaseGo. Шансы — модель симулятора,
                    не официальные вероятности Valve. Без float, StatTrak,
                    ножевых контрактов и выдачи в Steam.
                </p>
            </section>
            {children}
        </main>
    );
}

export function CraftSkeleton() {
    return (
        <div
            role="status"
            aria-label="Загружаем крафт"
            aria-busy="true"
            data-skeleton="craft"
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
        >
            <span className="sr-only">Загружаем инвентарь…</span>
            <div className="min-h-[32rem] space-y-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-12 w-full" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-36 w-full rounded-xl" />
                    ))}
                </div>
            </div>
            <div className="min-h-[32rem] space-y-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}
