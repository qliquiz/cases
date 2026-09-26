'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { leaderboardKey, leaderboardQueryOptions } from '@/app/query-options';
import { LeaderboardSkeleton } from '@/app/skeletons';
import { sessionGeneration } from '@/browser/query-cache';

import { updateLeaderboardProfile } from './actions';
import { LeaderboardIntro, RefreshRatingButton } from './leaderboard-intro';

const count = (value: number) => value.toLocaleString('ru-RU');
const buttonClass =
    'cursor-pointer rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function LeaderboardScreen() {
    const client = useQueryClient();
    const generation = sessionGeneration(client);
    const query = useQuery(leaderboardQueryOptions);
    const [nickname, setNickname] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();
    const data = query.data;
    const mine = data?.mine;

    function refresh() {
        void query.refetch();
    }
    function save(value: string | null) {
        startTransition(async () => {
            setMessage('');
            setError('');
            try {
                await client.cancelQueries({ queryKey: leaderboardKey });
                const next = await updateLeaderboardProfile(value);
                if (generation !== sessionGeneration(client)) return;
                if (!next.ok) {
                    setError(next.error);
                    return;
                }
                client.setQueryData(leaderboardKey, next.data);
                setNickname(null);
                setMessage(
                    value === null
                        ? 'Профиль скрыт. Коллекция сохранена.'
                        : 'Публичный ник сохранён.',
                );
            } catch {
                setError('Не удалось сохранить профиль. Повторите позже.');
            }
        });
    }

    return (
        <>
            <LeaderboardIntro
                action={
                    <RefreshRatingButton
                        onClick={refresh}
                        disabled={pending || query.isFetching}
                    >
                        {pending
                            ? 'Подождите…'
                            : query.isFetching
                              ? 'Обновляем…'
                              : 'Обновить рейтинг'}
                    </RefreshRatingButton>
                }
            />
            {query.isPending && <LeaderboardSkeleton />}
            {query.isError && (
                <p
                    role="alert"
                    className="rounded-2xl border border-danger/30 p-5 text-danger"
                >
                    {data
                        ? 'Не удалось обновить рейтинг. Показаны последние загруженные данные.'
                        : 'Не удалось загрузить рейтинг. Попробуйте ещё раз.'}
                </p>
            )}
            {error && (
                <p role="alert" className="mb-5 text-sm text-danger">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="mb-5 text-sm text-success">
                    {message}
                </p>
            )}
            {data && (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <section
                        aria-label="Топ игроков"
                        className="min-h-[30rem] min-w-0 overflow-hidden rounded-3xl border border-line bg-surface"
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-line p-5 sm:p-6">
                            <h2 className="text-xl font-bold">Топ-50</h2>
                            <p className="text-xs text-subtle">
                                Участников: {count(data.participants)}
                            </p>
                        </div>
                        {data.entries.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="font-semibold">
                                    Пока нет участников
                                </p>
                                <p className="mt-2 text-sm leading-6 text-subtle">
                                    Задай публичный ник и открой первый кейс —
                                    твоё имя появится здесь.
                                </p>
                            </div>
                        ) : (
                            <ol
                                className="divide-y divide-line"
                                aria-label="Список игроков"
                            >
                                {data.entries.map((player) => (
                                    <li
                                        key={player.nickname}
                                        className={`flex gap-3 px-4 py-5 sm:gap-4 sm:px-6 ${player.isYou ? 'bg-amber-400/10' : ''}`}
                                    >
                                        <span
                                            className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-1 text-sm font-black tabular-nums ${player.rank <= 3 ? 'bg-amber-400 text-slate-950' : 'bg-inset text-subtle'}`}
                                        >
                                            #{player.rank}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                <p className="min-w-0 break-words font-bold">
                                                    {player.nickname}
                                                    {player.isYou && (
                                                        <span className="ml-2 text-xs font-medium text-accent">
                                                            Это вы
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-sm font-bold tabular-nums text-accent">
                                                    {count(player.uniqueItems)}{' '}
                                                    <span className="font-normal text-subtle">
                                                        уник.
                                                    </span>
                                                </p>
                                            </div>
                                            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-subtle">
                                                <div className="flex gap-1">
                                                    <dt>Открытия:</dt>
                                                    <dd className="tabular-nums text-muted">
                                                        {count(player.openings)}
                                                    </dd>
                                                </div>
                                                <div className="flex gap-1">
                                                    <dt>Редкие:</dt>
                                                    <dd className="tabular-nums text-muted">
                                                        {count(
                                                            player.rareDrops,
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <p className="border-t border-line p-5 text-xs leading-5 text-subtle">
                            При равном числе уникальных предметов место
                            одинаковое (1, 1, 3). Внутри такого места — порядок
                            по нику. Редкие — число выпадений ножей из текущего
                            каталога, включая повторы.
                        </p>
                    </section>
                    <aside className="order-first min-h-[30rem] rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:order-last">
                        <h2 className="text-xl font-bold">Моё место</h2>
                        {mine ? (
                            <>
                                <p className="mt-4 text-4xl font-black tabular-nums text-accent">
                                    {mine.rank ? `#${mine.rank}` : '—'}
                                </p>
                                <p className="mt-2 text-sm text-subtle">
                                    {mine.nickname
                                        ? mine.openings
                                            ? mine.nickname
                                            : 'Открой первый кейс, чтобы получить место.'
                                        : 'Ты пока не участвуешь в публичном рейтинге.'}
                                </p>
                                <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-line py-4 text-xs text-subtle">
                                    {[
                                        ['Уникальные', mine.uniqueItems],
                                        ['Открытия', mine.openings],
                                        ['Редкие', mine.rareDrops],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <dt>{label}</dt>
                                            <dd className="mt-1 text-lg font-bold tabular-nums text-foreground">
                                                {count(Number(value))}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                                <form
                                    className="mt-5"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        save(nickname ?? mine.nickname ?? '');
                                    }}
                                >
                                    <label
                                        htmlFor="public-nickname"
                                        className="text-sm font-semibold"
                                    >
                                        Публичный ник
                                    </label>
                                    <input
                                        id="public-nickname"
                                        value={nickname ?? mine.nickname ?? ''}
                                        onChange={(event) =>
                                            setNickname(event.target.value)
                                        }
                                        minLength={3}
                                        maxLength={24}
                                        required
                                        disabled={pending}
                                        autoComplete="off"
                                        spellCheck={false}
                                        aria-describedby="nickname-help"
                                        className="mt-2 w-full min-w-0 rounded-xl border border-line bg-inset px-3 py-3 text-sm outline-none focus:border-accent disabled:opacity-50"
                                        placeholder="Например, CaseHunter"
                                    />
                                    <p
                                        id="nickname-help"
                                        className="mt-2 text-xs leading-5 text-subtle"
                                    >
                                        3–24 символа: буквы, цифры, пробел, _ и
                                        -. Нужна хотя бы одна буква. Ник и
                                        статистика станут видны всем. Не
                                        указывай личные данные.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={pending}
                                        className={`${buttonClass} mt-4 w-full`}
                                    >
                                        {mine.nickname
                                            ? 'Сохранить ник'
                                            : 'Участвовать в рейтинге'}
                                    </button>
                                </form>
                                {mine.nickname && (
                                    <button
                                        onClick={() => save(null)}
                                        disabled={pending}
                                        className="mt-3 w-full cursor-pointer rounded-lg px-2 py-2 text-xs text-muted underline underline-offset-4 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                                    >
                                        Скрыться из рейтинга
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="mt-4 text-sm leading-6 text-muted">
                                    Войди, чтобы увидеть своё место и выбрать
                                    публичный ник. Почту и Telegram ID мы не
                                    публикуем.
                                </p>
                                <Link
                                    href="/"
                                    className={`${buttonClass} mt-5 inline-block`}
                                >
                                    Войти на странице кейсов
                                </Link>
                            </>
                        )}
                    </aside>
                </div>
            )}
        </>
    );
}
