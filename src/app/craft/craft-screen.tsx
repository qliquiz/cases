'use client';

import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import { ItemImage } from '@/app/item-image';
import {
    accountKey,
    accountQueryOptions,
    leaderboardKey,
} from '@/app/query-options';
import { sessionGeneration } from '@/browser/query-cache';
import { caseCatalog, findCase, itemLabel } from '@/game/catalog';
import { duplicateSelection } from '@/game/craft-selection';
import { craftRarities, previewCraft } from '@/game/crafting';
import type { CollectionEntry } from '@/server/store';

import { createCraft, loadCraftHistory } from './actions';
import { CraftSkeleton } from './craft-shell';

const historyKey = ['craft-history'] as const;
const historyOptions = queryOptions({
    queryKey: historyKey,
    queryFn: () => loadCraftHistory(),
});
const rarityNames = [
    'Синие → фиолетовый',
    'Фиолетовые → розовый',
    'Розовые → красный',
];
const button =
    'cursor-pointer rounded-xl border border-line-strong px-4 py-3 text-sm font-semibold hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent';

export function CraftScreen() {
    const client = useQueryClient();
    const generation = sessionGeneration(client);
    const account = useQuery(accountQueryOptions);
    const history = useQuery({ ...historyOptions, enabled: !!account.data });
    const [rarity, setRarity] = useState<string>(craftRarities[0]);
    const [caseId, setCaseId] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const [result, setResult] = useState<
        Awaited<ReturnType<typeof loadCraftHistory>>[number] | null
    >(null);
    const [pending, startTransition] = useTransition();
    const request = useRef<{ id: string; inputs: string[] } | null>(null);
    const inFlight = useRef(false);
    const available = (account.data?.collection ?? []).filter(
        (x) => !x.consumedAt,
    );
    const selectedEntries = selected
        .map((id) => available.find((x) => x.id === id))
        .filter((x): x is CollectionEntry => !!x);
    const staleSelection = selectedEntries.length !== selected.length;
    const eligible = available.filter((entry) => {
        const canonical = findCase(entry.caseId)?.drops.find(
            (x) => x.id === entry.itemId,
        );
        return (
            canonical?.rarity === rarity && (!caseId || caseId === entry.caseId)
        );
    });
    const groups = new Map<string, CollectionEntry[]>();
    for (const entry of eligible)
        groups.set(entry.itemId, [...(groups.get(entry.itemId) ?? []), entry]);
    const outcomes =
        selectedEntries.length === 10 ? previewCraft(selectedEntries) : [];
    const lastCopies = [
        ...new Set(selectedEntries.map((x) => x.itemId)),
    ].filter((id) =>
        available
            .filter((x) => x.itemId === id)
            .every((x) => selected.includes(x.id)),
    );
    const locked = pending || uncertain;

    function choose(ids: string[]) {
        setSelected(ids);
        setConfirmed(false);
        setError('');
        setResult(null);
        request.current = null;
    }
    function submit() {
        if (
            inFlight.current ||
            (!uncertain &&
                (!confirmed || outcomes.length === 0 || staleSelection))
        )
            return;
        inFlight.current = true;
        request.current ??= {
            id: window.crypto.randomUUID(),
            inputs: [...selected],
        };
        const submission = request.current;
        setError('');
        startTransition(async () => {
            try {
                await client.cancelQueries({ queryKey: accountKey });
                await client.cancelQueries({ queryKey: historyKey });
                const response = await createCraft(
                    submission.inputs,
                    submission.id,
                );
                if (generation !== sessionGeneration(client)) return;
                if (!response.ok) {
                    setError(response.error);
                    setUncertain(response.retryable);
                    if (!response.retryable) {
                        request.current = null;
                        void client.invalidateQueries({ queryKey: accountKey });
                    }
                    return;
                }
                await client.cancelQueries({ queryKey: accountKey });
                if (generation !== sessionGeneration(client)) return;
                await client.cancelQueries({ queryKey: historyKey });
                if (generation !== sessionGeneration(client)) return;
                client.setQueryData(accountKey, (old) =>
                    old ? { ...old, collection: response.collection } : old,
                );
                client.setQueryData(historyKey, response.history);
                void client.invalidateQueries({
                    queryKey: leaderboardKey,
                    refetchType: 'none',
                });
                setResult(response.result);
                setSelected([]);
                setConfirmed(false);
                setUncertain(false);
                request.current = null;
            } catch {
                if (generation !== sessionGeneration(client)) return;
                setUncertain(true);
                setError(
                    'Связь прервалась. Проверь результат тем же запросом — повторного списания не будет.',
                );
            } finally {
                inFlight.current = false;
            }
        });
    }

    if (account.isPending) return <CraftSkeleton />;
    if (!account.data)
        return (
            <section className="min-h-72 rounded-3xl border border-line bg-surface p-6 sm:p-8">
                <h2 className="text-xl font-bold">
                    {account.isError
                        ? 'Не удалось загрузить инвентарь'
                        : 'Сначала собери предметы'}
                </h2>
                <p className="mt-3 text-muted">
                    {account.isError
                        ? 'Попробуй обновить данные. Сохранённые предметы никуда не пропали.'
                        : 'Войди через Telegram или почту на странице кейсов. Здесь появятся твои скины для крафта.'}
                </p>
                {account.isError ? (
                    <button
                        className={button + ' mt-6'}
                        onClick={() => void account.refetch()}
                    >
                        Повторить загрузку
                    </button>
                ) : (
                    <Link href="/" className={button + ' mt-6 inline-block'}>
                        Перейти к кейсам
                    </Link>
                )}
            </section>
        );

    return (
        <>
            {account.isError && (
                <p role="alert" className="mb-4 text-danger">
                    Не удалось обновить инвентарь. Показаны последние данные.
                </p>
            )}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <section
                    aria-label="Инвентарь для крафта"
                    className="min-w-0 rounded-3xl border border-line bg-surface p-5 sm:p-6"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl font-bold">Твои предметы</h2>
                        <button
                            className="cursor-pointer text-sm text-accent disabled:opacity-50"
                            disabled={locked || account.isFetching}
                            onClick={() => {
                                void account.refetch();
                                void history.refetch();
                            }}
                        >
                            {account.isFetching
                                ? 'Обновляем…'
                                : 'Обновить инвентарь'}
                        </button>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-muted">
                            Редкость
                            <select
                                value={rarity}
                                disabled={locked}
                                onChange={(e) => {
                                    setRarity(e.target.value);
                                    choose([]);
                                }}
                                className="mt-2 h-12 w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-inset px-3 text-sm text-foreground"
                            >
                                {craftRarities.map((value, i) => (
                                    <option key={value} value={value}>
                                        {rarityNames[i]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs text-muted">
                            Коллекция
                            <select
                                value={caseId}
                                disabled={locked}
                                onChange={(e) => setCaseId(e.target.value)}
                                className="mt-2 h-12 w-full cursor-pointer appearance-none rounded-xl border border-line-strong bg-inset px-3 text-sm text-foreground"
                            >
                                <option value="">Все коллекции</option>
                                {caseCatalog.map((pool) => (
                                    <option key={pool.id} value={pool.id}>
                                        {pool.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            className={button}
                            disabled={locked || selected.length >= 10}
                            onClick={() =>
                                choose(
                                    duplicateSelection(
                                        available,
                                        selected,
                                        rarity,
                                        caseId,
                                    ),
                                )
                            }
                        >
                            Добавить дубликаты
                        </button>
                        <p className="text-xs leading-5 text-subtle">
                            Автоподбор оставит последнюю копию каждого вида.
                        </p>
                    </div>
                    <p className="mt-4 text-xs text-subtle">
                        Доступно с выбранными фильтрами: {eligible.length}.
                        Красные скины и ножи пока не участвуют.
                    </p>
                    <div className="mt-4 grid max-h-[42rem] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                        {[...groups].map(([id, copies]) => {
                            const chosen = copies.filter((x) =>
                                selected.includes(x.id),
                            ).length;
                            const next = copies.find(
                                (x) => !selected.includes(x.id),
                            );
                            return (
                                <button
                                    key={id}
                                    disabled={
                                        locked || !next || selected.length >= 10
                                    }
                                    onClick={() =>
                                        next && choose([...selected, next.id])
                                    }
                                    aria-label={`Добавить ${itemLabel(copies[0].item)}`}
                                    className="min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-line bg-inset p-3 text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                                >
                                    <div className="rounded-lg bg-slate-900">
                                        <ItemImage
                                            src={copies[0].item.image}
                                            alt=""
                                            width={160}
                                            height={100}
                                            className="h-24 w-full"
                                        />
                                    </div>
                                    <p className="mt-3 break-words text-xs font-semibold leading-5">
                                        {itemLabel(copies[0].item)}
                                    </p>
                                    <p className="mt-1 text-[11px] text-subtle">
                                        {findCase(copies[0].caseId)?.name}
                                    </p>
                                    <p className="mt-2 text-xs font-bold text-accent">
                                        {chosen} / {copies.length} выбрано
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                    {!groups.size && (
                        <div className="py-12 text-center">
                            <p className="font-semibold">
                                Подходящих предметов пока нет
                            </p>
                            <p className="mt-2 text-sm text-subtle">
                                Выбери другую редкость или открой ещё кейсы.
                            </p>
                            <Link
                                href="/"
                                className="mt-4 inline-block text-sm text-accent underline"
                            >
                                Открыть кейсы
                            </Link>
                        </div>
                    )}
                </section>

                <section
                    aria-label="Контракт крафта"
                    className="min-w-0 rounded-3xl border border-line bg-surface p-5 sm:p-6"
                >
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-bold">Контракт</h2>
                        <span className="font-bold tabular-nums text-accent">
                            {selected.length} / 10
                        </span>
                    </div>
                    <div className="mt-5 grid grid-cols-5 gap-2">
                        {Array.from({ length: 10 }, (_, i) => {
                            const entry = available.find(
                                (x) => x.id === selected[i],
                            );
                            return (
                                <button
                                    key={i}
                                    disabled={locked || !selected[i]}
                                    onClick={() =>
                                        choose(
                                            selected.filter(
                                                (_, index) => index !== i,
                                            ),
                                        )
                                    }
                                    aria-label={
                                        entry
                                            ? `Убрать ${itemLabel(entry.item)} из слота ${i + 1}`
                                            : `Слот ${i + 1}`
                                    }
                                    className="flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-inset text-xs text-subtle enabled:cursor-pointer enabled:hover:border-danger focus-visible:outline-2 focus-visible:outline-accent"
                                >
                                    {entry ? (
                                        <ItemImage
                                            src={entry.item.image}
                                            alt=""
                                            width={80}
                                            height={80}
                                            className="h-full w-full"
                                        />
                                    ) : (
                                        i + 1
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        className="mt-3 cursor-pointer text-xs text-subtle underline disabled:opacity-50"
                        disabled={locked || !selected.length}
                        onClick={() => choose([])}
                    >
                        Очистить выбор
                    </button>
                    <h3 className="mt-6 font-semibold">Возможные результаты</h3>
                    <p className="mt-1 text-xs text-subtle">
                        Шансы симулятора · результат следующей редкости
                        гарантирован
                    </p>
                    <div className="mt-4 min-h-32 space-y-2" aria-live="polite">
                        {outcomes.length ? (
                            outcomes.map((outcome) => (
                                <div
                                    key={`${outcome.caseId}:${outcome.item.id}`}
                                    className="flex items-center gap-3 rounded-xl bg-inset p-2"
                                >
                                    <ItemImage
                                        src={outcome.item.image}
                                        alt=""
                                        width={80}
                                        height={60}
                                        className="h-12 w-16"
                                    />
                                    <p className="min-w-0 flex-1 text-xs leading-5">
                                        {itemLabel(outcome.item)}
                                    </p>
                                    <span className="shrink-0 text-sm font-bold tabular-nums text-accent">
                                        {(
                                            outcome.probability * 100
                                        ).toLocaleString('ru-RU', {
                                            maximumFractionDigits: 2,
                                        })}
                                        %
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="py-6 text-sm leading-6 text-subtle">
                                Добавь десять предметов, чтобы увидеть полный
                                список результатов и их вероятности.
                            </p>
                        )}
                    </div>
                    {lastCopies.length > 0 && (
                        <p className="mt-4 rounded-xl border border-accent/40 p-3 text-xs leading-5 text-accent">
                            Выбраны последние копии: {lastCopies.length}. Они
                            исчезнут из инвентаря, но останутся открытыми в
                            альбоме и рейтинге.
                        </p>
                    )}
                    {staleSelection && (
                        <p role="alert" className="mt-4 text-sm text-danger">
                            Инвентарь изменился. Очисти выбор и собери контракт
                            заново.
                        </p>
                    )}
                    <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-muted">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            disabled={locked || !outcomes.length}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="mt-1 size-4 shrink-0 accent-amber-400"
                        />
                        Подтверждаю расход 10 выбранных предметов. Отменить
                        крафт нельзя.
                    </label>
                    <button
                        onClick={submit}
                        disabled={
                            pending ||
                            (!uncertain &&
                                (!confirmed ||
                                    !outcomes.length ||
                                    staleSelection))
                        }
                        className="mt-4 w-full cursor-pointer rounded-xl bg-amber-400 px-4 py-4 font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                        {pending
                            ? 'Создаём предмет…'
                            : uncertain
                              ? 'Проверить результат'
                              : 'Создать предмет'}
                    </button>
                    {error && (
                        <p
                            role="alert"
                            className="mt-3 text-sm leading-6 text-danger"
                        >
                            {error}
                        </p>
                    )}
                    <p className="mt-3 text-xs leading-5 text-subtle">
                        Стоимость — только выбранные предметы. Лимит открытий
                        кейсов не расходуется.
                    </p>
                    {result && (
                        <div
                            key={result.id}
                            role="status"
                            aria-label="Результат крафта"
                            className="craft-reveal mt-6 rounded-2xl border border-accent/50 bg-amber-400/10 p-4 text-center"
                        >
                            <p className="text-xs font-bold uppercase tracking-widest text-accent">
                                Готово · новый предмет
                            </p>
                            <ItemImage
                                src={result.item.image}
                                alt=""
                                width={200}
                                height={120}
                                className="mx-auto mt-4 h-28 w-full"
                            />
                            <p className="mt-2 font-bold">
                                {itemLabel(result.item)}
                            </p>
                            <p className="mt-2 text-xs text-muted">
                                Предмет в инвентаре. Прогресс альбома сохранён.
                            </p>
                        </div>
                    )}
                </section>
            </div>
            <section
                className="mt-8 rounded-3xl border border-line bg-surface p-5 sm:p-6"
                aria-label="История крафта"
            >
                <h2 className="text-xl font-bold">История крафта</h2>
                <p className="mt-1 text-xs text-subtle">
                    Последние 30 контрактов
                </p>
                {history.isPending && (
                    <div
                        role="status"
                        aria-label="Загружаем историю"
                        className="mt-4 h-24 rounded-xl bg-line motion-safe:animate-pulse"
                    />
                )}
                {history.isError && (
                    <p role="alert" className="mt-4 text-danger">
                        История не загрузилась.{' '}
                        <button
                            className="cursor-pointer underline"
                            onClick={() => void history.refetch()}
                        >
                            Повторить
                        </button>
                    </p>
                )}
                {history.data?.length === 0 && (
                    <p className="py-8 text-sm text-subtle">
                        Здесь появится твой первый контракт.
                    </p>
                )}
                <ol className="mt-4 space-y-3">
                    {history.data?.map((craft) => (
                        <li
                            key={craft.id}
                            className="rounded-xl border border-line p-3"
                        >
                            <div className="flex items-center gap-3">
                                <ItemImage
                                    src={craft.item.image}
                                    alt=""
                                    width={80}
                                    height={60}
                                    className="h-14 w-20"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                        {itemLabel(craft.item)}
                                    </p>
                                    <p className="mt-1 text-xs text-subtle">
                                        {new Date(
                                            craft.createdAt,
                                        ).toLocaleString('ru-RU')}{' '}
                                        · {findCase(craft.caseId)?.name}
                                    </p>
                                </div>
                            </div>
                            <details className="mt-2 text-xs text-muted">
                                <summary className="cursor-pointer">
                                    Потрачено 10 предметов
                                </summary>
                                <ul className="mt-2 space-y-1">
                                    {craft.inputs.map((input) => (
                                        <li key={input.id}>
                                            {itemLabel(input.item)}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        </li>
                    ))}
                </ol>
            </section>
        </>
    );
}
