import Image from 'next/image';

import { CasePlayground } from '@/app/case-playground';
import { ThemePicker } from '@/app/theme-picker';
import { featuredCase } from '@/game/catalog';
import { simulatedChancePercent } from '@/game/simulation';

type Item = (typeof featuredCase.drops)[number];

function ItemCard({ item, rare = false }: { item: Item; rare?: boolean }) {
    const accent = rare ? '#e4ae39' : item.accent;
    const chance = simulatedChancePercent(featuredCase, item.id);

    return (
        <div
            className="rounded-2xl border border-line bg-surface p-4"
            style={{ borderBottomColor: accent, borderBottomWidth: 3 }}
        >
            <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-slate-900">
                <Image
                    src={item.image}
                    alt=""
                    width={190}
                    height={110}
                    unoptimized
                    className="h-24 w-full object-contain"
                />
            </div>
            <p className="text-sm font-semibold">{item.name}</p>
            <p
                className="mt-2 inline-block rounded-md bg-slate-950 px-2 py-1 text-xs"
                style={{ color: accent }}
            >
                {rare ? 'Редкий особый предмет' : item.rarity}
            </p>
            <p className="mt-2 text-xs text-subtle">
                Шанс симулятора:{' '}
                {chance.toLocaleString('ru-RU', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 3,
                })}
                %
            </p>
        </div>
    );
}

export default function Home() {
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                        C
                    </div>
                    <span className="text-lg font-bold tracking-tight">
                        CaseGo
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-success sm:inline-flex">
                        Бесплатный прототип
                    </span>
                    <ThemePicker />
                </div>
            </header>

            <section className="grid gap-10 py-14 md:grid-cols-[1fr_0.9fr] md:items-center md:py-20">
                <div>
                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                        Симулятор открытий CS2
                    </p>
                    <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                        Реальный кейс.{' '}
                        <span className="text-accent">
                            Виртуальное открытие.
                        </span>
                    </h1>
                    <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
                        Открой {featuredCase.name} и посмотри, какой предмет
                        выпал бы в симуляции. Состав и изображения взяты из
                        каталога CS2. Платежей, выдачи скинов и призов нет.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted">
                        <span className="rounded-full border border-line px-4 py-2">
                            17 обычных предметов
                        </span>
                        <span className="rounded-full border border-line px-4 py-2">
                            13 редких вариантов
                        </span>
                        <span className="rounded-full border border-line px-4 py-2">
                            0 ₽ за открытие
                        </span>
                    </div>
                    <p className="mt-5 max-w-xl text-xs leading-5 text-subtle">
                        Показанные ниже проценты — модель симулятора, не
                        официальные шансы Valve. Скины не имеют стоимости внутри
                        приложения.
                    </p>
                </div>
                <CasePlayground />
            </section>

            <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
                        Содержимое кейса
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                        {featuredCase.name}
                    </h2>
                    <p className="mt-2 text-sm text-subtle">
                        17 обычных предметов и 13 вариантов редкого особого
                        предмета
                    </p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {featuredCase.drops.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>
                <h3 className="mt-9 text-lg font-bold">
                    Редкие особые предметы
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {featuredCase.rareDrops.map((item) => (
                        <ItemCard key={item.id} item={item} rare />
                    ))}
                </div>
            </section>

            <footer className="pt-8 text-sm leading-6 text-subtle">
                Неофициальный прототип, не связан с Valve. Изображения предметов
                и кейса принадлежат их правообладателям. Коллекция сохраняется в
                аккаунте CaseGo; предметы не передаются в Steam.
                <p className="mt-2 text-xs">
                    Для улучшения CaseGo учитываем посещения, открытия и
                    просмотры коллекции в вашем аккаунте.
                </p>
            </footer>
        </main>
    );
}
