'use client';

import Image from 'next/image';
import { useEffect, useState, useTransition } from 'react';

import { openCase } from '@/app/actions';
import { featuredCase } from '@/game/catalog';
import { createReel } from '@/game/reel';

type Drop = (typeof featuredCase.drops)[number];
type Reel = ReturnType<typeof createReel>;
type Phase = 'idle' | 'ready' | 'spinning' | 'complete';

const cardWidth = 160;
const cardStep = 176;
const rareItemIds = new Set(featuredCase.rareDrops.map((item) => item.id));

function itemAccent(item: Drop) {
    return rareItemIds.has(item.id) ? '#e4ae39' : item.accent;
}

export function CasePlayground() {
    const [result, setResult] = useState<Drop | null>(null);
    const [reel, setReel] = useState<Reel | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (phase !== 'ready') return;
        const timer = window.setTimeout(() => setPhase('spinning'), 50);
        return () => window.clearTimeout(timer);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'spinning' || !reel) return;
        const timer = window.setTimeout(() => {
            setResult(reel.items[reel.winnerIndex]);
            setPhase('complete');
        }, 6000);
        return () => window.clearTimeout(timer);
    }, [phase, reel]);

    function handleOpen() {
        if (pending || phase === 'ready' || phase === 'spinning') return;

        setError(null);
        startTransition(async () => {
            try {
                const selected = await openCase(featuredCase.id);
                const nextReel = createReel(featuredCase, selected);
                setReel(nextReel);

                if (
                    window.matchMedia('(prefers-reduced-motion: reduce)')
                        .matches
                ) {
                    setResult(selected);
                    setPhase('complete');
                } else {
                    setResult(null);
                    setPhase('ready');
                }
            } catch {
                setError('Не получилось открыть кейс. Попробуйте ещё раз.');
            }
        });
    }

    function finishSpin() {
        if (phase !== 'spinning' || !reel) return;
        setResult(reel.items[reel.winnerIndex]);
        setPhase('complete');
    }

    const targetIndex =
        phase === 'spinning' || phase === 'complete'
            ? (reel?.winnerIndex ?? 0)
            : 0;

    return (
        <div className="rounded-[2rem] border border-white/15 bg-gradient-to-b from-slate-800 to-slate-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{featuredCase.name}</span>
                <span className="text-slate-400">
                    CS2 · бесплатная симуляция
                </span>
            </div>
            <div className="relative mt-6 h-60 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
                {reel ? (
                    <>
                        <div
                            className="absolute top-8 left-1/2 flex gap-4 will-change-transform"
                            style={{
                                transform: `translate3d(${-targetIndex * cardStep - cardWidth / 2}px, 0, 0)`,
                                transition:
                                    phase === 'spinning'
                                        ? 'transform 5.5s cubic-bezier(0.08, 0.55, 0.08, 1)'
                                        : 'none',
                            }}
                            onTransitionEnd={(event) => {
                                if (
                                    event.propertyName === 'transform' &&
                                    event.target === event.currentTarget
                                )
                                    finishSpin();
                            }}
                        >
                            {reel.items.map((item, index) => (
                                <div
                                    key={`${index}-${item.id}`}
                                    className="flex h-40 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-slate-800/90 p-2"
                                    style={{
                                        width: cardWidth,
                                        borderBottomColor: itemAccent(item),
                                        borderBottomWidth: 4,
                                    }}
                                >
                                    <Image
                                        src={item.image}
                                        alt=""
                                        width={140}
                                        height={105}
                                        unoptimized
                                        className="h-24 w-36 object-contain"
                                    />
                                    <span className="mt-2 max-w-full truncate text-xs font-semibold">
                                        {item.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-amber-300 shadow-[0_0_18px_3px_#fcd34d]" />
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-950 to-transparent" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-slate-950 to-transparent" />
                    </>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center">
                        <Image
                            src={featuredCase.image}
                            alt={featuredCase.name}
                            width={170}
                            height={150}
                            unoptimized
                            className="h-36 w-44 object-contain"
                            priority
                        />
                        <p className="mt-2 text-sm text-slate-400">
                            Нажми, чтобы открыть кейс
                        </p>
                    </div>
                )}
            </div>
            <div className="mt-4 min-h-12 text-center" aria-live="polite">
                {result ? (
                    <>
                        <p
                            className="font-bold"
                            style={{ color: itemAccent(result) }}
                        >
                            {result.name}
                        </p>
                        <p className="text-xs text-slate-400">
                            {rareItemIds.has(result.id)
                                ? 'Редкий особый предмет'
                                : result.rarity}
                        </p>
                    </>
                ) : phase === 'spinning' ? (
                    <p className="text-sm text-slate-400">
                        Лента прокручивается…
                    </p>
                ) : null}
            </div>
            <button
                type="button"
                onClick={handleOpen}
                disabled={pending || phase === 'ready' || phase === 'spinning'}
                className="w-full cursor-pointer rounded-xl bg-amber-300 px-5 py-4 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
            >
                {pending || phase === 'ready'
                    ? 'Готовим открытие…'
                    : phase === 'spinning'
                      ? 'Открываем…'
                      : result
                        ? 'Открыть ещё раз'
                        : 'Открыть бесплатно'}
            </button>
            {error && (
                <p className="mt-3 text-center text-sm text-rose-300">
                    {error}
                </p>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">
                Результат виртуальный, не сохраняется и не выдаётся в Steam
            </p>
        </div>
    );
}
