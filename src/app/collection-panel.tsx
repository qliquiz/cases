import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { observeActivity } from '@/browser/activity';
import {
    type CaseDefinition,
    featuredCase,
    findCase,
    itemLabel,
} from '@/game/catalog';
import { openingLimit } from '@/game/opening-limit';
import type { CollectionEntry } from '@/server/store';

type AlbumFilter = 'all' | 'owned' | 'missing';

export function CollectionPanel({
    caseData = featuredCase,
    collection,
    remaining,
    onRefresh,
    refreshing = false,
}: {
    caseData?: CaseDefinition;
    collection: CollectionEntry[];
    remaining: number;
    onRefresh: () => void;
    refreshing?: boolean;
}) {
    const catalogIds = new Set(
        [...caseData.drops, ...caseData.rareDrops].map((item) => item.id),
    );
    const [filter, setFilter] = useState<AlbumFilter>('all');
    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect(
        () => observeActivity('collection_view', headingRef.current),
        [collection],
    );
    const counts = new Map<
        string,
        { count: number; item: CollectionEntry['item'] }
    >();
    for (const entry of collection) {
        const prior = counts.get(entry.itemId);
        counts.set(entry.itemId, {
            count: (prior?.count ?? 0) + 1,
            item: entry.item,
        });
    }

    const owned = [...catalogIds].filter((id) => counts.has(id)).length;
    const total = catalogIds.size;
    const missing = total - owned;
    const duplicates = collection.length - counts.size;
    const archived = [...counts].filter(([id]) => !catalogIds.has(id));
    const percent = Math.floor((owned / total) * 100);
    const groups = [
        { name: 'Обычные предметы', items: caseData.drops, rare: false },
        {
            name: 'Редкие особые предметы',
            items: caseData.rareDrops,
            rare: true,
        },
    ];
    const visibleGroups = groups.map((group) => ({
        ...group,
        owned: group.items.filter((item) => counts.has(item.id)).length,
        visible: group.items.filter((item) =>
            filter === 'owned'
                ? counts.has(item.id)
                : filter === 'missing'
                  ? !counts.has(item.id)
                  : true,
        ),
    }));

    return (
        <section
            aria-label="Моя коллекция"
            className="mt-6 border-t border-line pt-5"
        >
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 ref={headingRef} className="text-lg font-bold">
                        Моя коллекция
                    </h2>
                    <p className="text-xs text-subtle">
                        {caseData.name} · Общая для сайта и Telegram
                    </p>
                </div>
                <span className="text-xs text-muted">
                    {remaining} из {openingLimit} открытий доступно
                </span>
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-inset p-4">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">
                        Собрано {owned} из {total}
                    </p>
                    <span className="text-xl font-black tabular-nums text-accent">
                        {percent}%
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Прогресс коллекции"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={owned}
                    aria-valuetext={`${owned} из ${total} уникальных предметов`}
                    className="mt-3 h-2 overflow-hidden rounded-full bg-line"
                >
                    <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                        <dt className="text-subtle">Всего</dt>
                        <dd className="mt-1 text-base font-bold tabular-nums">
                            {collection.length}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-subtle">Не хватает</dt>
                        <dd className="mt-1 text-base font-bold tabular-nums">
                            {missing}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-subtle">Дубликаты</dt>
                        <dd className="mt-1 text-base font-bold tabular-nums">
                            {duplicates}
                        </dd>
                    </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-subtle">
                    {owned === total
                        ? 'Альбом собран полностью!'
                        : collection.length === 0
                          ? 'Открой кейс, чтобы начать коллекцию.'
                          : 'Каждый новый вид приближает к полному альбому.'}{' '}
                    Повторы не увеличивают прогресс.
                </p>
            </div>
            <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="mt-3 cursor-pointer rounded-lg border border-accent/50 px-3 py-1 text-xs text-accent hover:border-accent disabled:cursor-wait disabled:opacity-50"
            >
                {refreshing ? 'Подождите…' : 'Сбросить лимит'}
            </button>
            <div
                role="group"
                aria-label="Фильтр коллекции"
                className="mt-4 flex gap-1 rounded-xl border border-line bg-inset p-1"
            >
                {(
                    [
                        ['all', 'Все', total],
                        ['owned', 'Собрано', owned],
                        ['missing', 'Не хватает', missing],
                    ] as const
                ).map(([value, label, count]) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={`min-w-0 flex-1 cursor-pointer rounded-lg px-1 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${filter === value ? 'bg-amber-300 text-slate-950 forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-[Highlight]' : 'text-muted hover:bg-raised'}`}
                    >
                        {label} <span className="tabular-nums">{count}</span>
                    </button>
                ))}
            </div>
            <div
                className="mt-4 max-h-[28rem] overflow-y-auto overscroll-contain rounded-xl border border-line p-3"
                tabIndex={0}
                role="region"
                aria-label="Предметы альбома"
            >
                {visibleGroups.every((group) => group.visible.length === 0) && (
                    <p className="py-6 text-center text-sm text-subtle">
                        {filter === 'missing'
                            ? 'Все предметы уже в коллекции.'
                            : 'Здесь появятся собранные предметы.'}
                    </p>
                )}
                {visibleGroups
                    .filter((group) => group.visible.length > 0)
                    .map((group) => (
                        <div key={group.name} className="mb-5 last:mb-0">
                            <h3 className="mb-3 flex justify-between gap-2 text-xs font-semibold text-muted">
                                <span>{group.name}</span>
                                <span className="shrink-0 tabular-nums">
                                    {group.owned} / {group.items.length}
                                </span>
                            </h3>
                            <ul className="grid grid-cols-2 gap-2">
                                {group.visible.map((item) => (
                                    <AlbumCard
                                        key={item.id}
                                        item={counts.get(item.id)?.item ?? item}
                                        count={counts.get(item.id)?.count ?? 0}
                                        rare={group.rare}
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}
            </div>
            {archived.length > 0 && (
                <details className="mt-4 text-xs text-subtle">
                    <summary className="cursor-pointer">
                        Вне текущего альбома · {archived.length}
                    </summary>
                    <p className="my-2">
                        Предметы, не входящие в выбранный кейс. Учтены в общем
                        количестве и дубликатах, но не в прогрессе этого
                        альбома.
                    </p>
                    <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                        {archived.map(([id, { item, count }]) => (
                            <AlbumCard key={id} item={item} count={count} />
                        ))}
                    </ul>
                </details>
            )}
            {collection.length > 0 && (
                <>
                    <details className="mt-4 text-xs text-subtle">
                        <summary className="cursor-pointer">
                            История открытий
                        </summary>
                        <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                            {collection.map((entry) => (
                                <li key={entry.id}>
                                    {new Date(entry.openedAt).toLocaleString(
                                        'ru-RU',
                                    )}{' '}
                                    — {itemLabel(entry.item)} ·{' '}
                                    {findCase(entry.caseId)?.name ??
                                        entry.caseId}
                                </li>
                            ))}
                        </ol>
                    </details>
                </>
            )}
            <p className="mt-3 text-xs text-subtle">
                Тестовый режим: можно бесплатно сбрасывать лимит сколько угодно.
                Автоматическое обновление — в 00:00 UTC.
            </p>
        </section>
    );
}

function AlbumCard({
    item,
    count,
    rare = false,
}: {
    item: CollectionEntry['item'];
    count: number;
    rare?: boolean;
}) {
    return (
        <li
            className={`min-w-0 overflow-hidden rounded-xl border bg-surface ${count ? 'border-line-strong' : 'border-dashed border-line'}`}
        >
            <div
                className="relative flex h-20 items-center justify-center border-b-2 bg-slate-900"
                style={{ borderBottomColor: rare ? '#e4ae39' : item.accent }}
            >
                {item.image && (
                    <Image
                        src={item.image}
                        alt=""
                        width={120}
                        height={75}
                        unoptimized
                        className={`h-16 w-full object-contain ${count ? '' : 'opacity-40 grayscale'}`}
                    />
                )}
                {count > 0 && (
                    <span className="absolute right-1 top-1 rounded-md bg-slate-950 px-1.5 py-0.5 text-xs font-bold text-white">
                        ×{count}
                    </span>
                )}
            </div>
            <div className="p-2">
                <p className="break-words text-xs font-semibold leading-4">
                    {itemLabel(item)}
                </p>
                <p
                    className={`mt-1 text-[11px] ${count ? 'text-success' : 'text-subtle'}`}
                >
                    {count ? 'В коллекции' : 'Ещё не выпал'}
                </p>
                {count > 1 && (
                    <p className="mt-1 text-[11px] text-subtle">
                        Дубликаты: {count - 1}
                    </p>
                )}
            </div>
        </li>
    );
}
