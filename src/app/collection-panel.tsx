import Image from 'next/image';

import type { CollectionEntry } from '@/server/store';

export function CollectionPanel({
    collection,
    remaining,
    onRefresh,
    refreshing = false,
}: {
    collection: CollectionEntry[];
    remaining: number;
    onRefresh: () => void;
    refreshing?: boolean;
}) {
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

    return (
        <section className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold">Моя коллекция</h2>
                    <p className="text-xs text-subtle">
                        Общая для сайта и Telegram
                    </p>
                </div>
                <span className="text-xs text-muted">
                    {remaining} из 5 открытий сегодня · {collection.length}{' '}
                    предметов
                </span>
            </div>
            {remaining === 0 && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="mt-3 cursor-pointer rounded-lg border border-accent/50 px-3 py-1 text-xs text-accent hover:border-accent disabled:cursor-wait disabled:opacity-50"
                >
                    {refreshing ? 'Обновляем…' : 'Обновить лимит'}
                </button>
            )}
            {collection.length === 0 ? (
                <p className="mt-4 text-sm text-subtle">
                    Открой кейс, чтобы начать коллекцию.
                </p>
            ) : (
                <>
                    <div className="mt-4 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                        {[...counts].map(([itemId, { count, item }]) => {
                            return (
                                <div
                                    key={itemId}
                                    className="rounded-xl border border-line bg-inset p-2 text-center"
                                >
                                    {item.image && (
                                        <Image
                                            src={item.image}
                                            alt=""
                                            width={100}
                                            height={75}
                                            unoptimized
                                            className="mx-auto h-16 w-full object-contain"
                                        />
                                    )}
                                    <p className="mt-1 truncate text-xs font-medium">
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-subtle">
                                        ×{count}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
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
                                    — {entry.item.name}
                                </li>
                            ))}
                        </ol>
                    </details>
                </>
            )}
            <p className="mt-3 text-xs text-subtle">
                Лимит обновляется в 00:00 UTC.
            </p>
        </section>
    );
}
