import { CasePlayground } from '@/app/case-playground';
import { demoCase, totalWeight } from '@/game/catalog';

export default function Home() {
    return (
        <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-16 pt-6 sm:px-8">
            <header className="flex items-center justify-between border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                        C
                    </div>
                    <span className="text-lg font-bold tracking-tight">
                        Case Lab
                    </span>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    Бесплатный прототип
                </span>
            </header>

            <section className="grid gap-10 py-14 md:grid-cols-[1fr_0.9fr] md:items-center md:py-20">
                <div>
                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                        Симулятор открытий
                    </p>
                    <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                        Проверь удачу.{' '}
                        <span className="text-amber-300">Без ставки.</span>
                    </h1>
                    <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                        Открывай виртуальный кейс и смотри, что выпало бы. Здесь
                        нет платежей, вывода предметов и призов с денежной
                        стоимостью.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
                        <span className="rounded-full border border-white/10 px-4 py-2">
                            Открытые шансы
                        </span>
                        <span className="rounded-full border border-white/10 px-4 py-2">
                            Серверный выбор
                        </span>
                        <span className="rounded-full border border-white/10 px-4 py-2">
                            0 ₽ за открытие
                        </span>
                    </div>
                </div>
                <CasePlayground />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Содержимое кейса
                        </p>
                        <h2 className="mt-2 text-2xl font-bold">
                            {demoCase.name}
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400">
                        Шансы указаны для каждого открытия
                    </p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {demoCase.drops.map((drop) => (
                        <div
                            key={drop.id}
                            className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                        >
                            <div
                                className="mb-4 flex h-24 items-center justify-center rounded-xl text-4xl font-black"
                                style={{
                                    background: `radial-gradient(circle at 50% 65%, ${drop.accent}33, transparent 70%)`,
                                    color: drop.accent,
                                }}
                                aria-hidden="true"
                            >
                                {drop.name.slice(0, 1)}
                            </div>
                            <p className="font-semibold">{drop.name}</p>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                                <span className="text-slate-400">
                                    {drop.rarity}
                                </span>
                                <span
                                    className="font-mono"
                                    style={{ color: drop.accent }}
                                >
                                    {(
                                        (drop.weight / totalWeight) *
                                        100
                                    ).toLocaleString('ru-RU', {
                                        maximumFractionDigits: 2,
                                    })}
                                    %
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="pt-8 text-sm leading-6 text-slate-500">
                Независимый учебный прототип. Виртуальные предметы вымышлены и
                не связаны с Valve или Counter-Strike. Результаты пока не
                сохраняются.
            </footer>
        </main>
    );
}
