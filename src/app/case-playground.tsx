'use client';

import { useState, useTransition } from 'react';

import { openCase } from '@/app/actions';
import { demoCase, type DemoDrop } from '@/game/catalog';

export function CasePlayground() {
    const [result, setResult] = useState<DemoDrop | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function handleOpen() {
        setError(null);
        startTransition(async () => {
            try {
                setResult(await openCase(demoCase.id));
            } catch {
                setError('Не получилось открыть кейс. Попробуйте ещё раз.');
            }
        });
    }

    return (
        <div className="rounded-[2rem] border border-white/15 bg-gradient-to-b from-slate-800 to-slate-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{demoCase.name}</span>
                <span className="text-slate-400">Демо-кейс № 01</span>
            </div>
            <div className="relative mt-6 flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                <div className="absolute size-56 rounded-full bg-amber-400/15 blur-3xl" />
                {result ? (
                    <div className="relative text-center" aria-live="polite">
                        <div
                            className="mx-auto flex size-28 items-center justify-center rounded-3xl border border-white/20 bg-white/5 text-6xl font-black shadow-xl"
                            style={{
                                color: result.accent,
                                boxShadow: `0 18px 60px ${result.accent}33`,
                            }}
                            aria-hidden="true"
                        >
                            {result.name.slice(0, 1)}
                        </div>
                        <p className="mt-5 text-xl font-bold">{result.name}</p>
                        <p
                            className="mt-1 text-sm"
                            style={{ color: result.accent }}
                        >
                            {result.rarity}
                        </p>
                    </div>
                ) : (
                    <div className="relative text-center">
                        <div className="mx-auto flex size-32 rotate-[-8deg] items-center justify-center rounded-3xl border-2 border-amber-300/50 bg-gradient-to-br from-amber-300 to-amber-600 text-6xl font-black text-slate-950 shadow-2xl shadow-amber-500/20">
                            ?
                        </div>
                        <p className="mt-5 text-sm text-slate-400">
                            Открой, чтобы узнать результат
                        </p>
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={handleOpen}
                disabled={pending}
                className="mt-5 w-full cursor-pointer rounded-xl bg-amber-300 px-5 py-4 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
            >
                {pending
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
                Результат виртуальный и не сохраняется
            </p>
        </div>
    );
}
