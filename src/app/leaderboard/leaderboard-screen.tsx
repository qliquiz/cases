'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import type { LeaderboardSnapshot } from '@/server/leaderboard';

import { loadLeaderboard, updateLeaderboardProfile } from './actions';

type Result =
    { ok: true; data: LeaderboardSnapshot } | { ok: false; error: string };
const count = (value: number) => value.toLocaleString('ru-RU');
const buttonClass =
    'cursor-pointer rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function LeaderboardScreen({ initial }: { initial: Result }) {
    const [result, setResult] = useState(initial);
    const [nickname, setNickname] = useState(
        initial.ok ? (initial.data.mine?.nickname ?? '') : '',
    );
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();
    const data = result.ok ? result.data : null;
    const mine = data?.mine;

    function refresh() {
        startTransition(async () => {
            setError('');
            setMessage('');
            try {
                const next = await loadLeaderboard();
                setResult(next);
                if (next.ok) setNickname(next.data.mine?.nickname ?? '');
            } catch {
                setError('Не удалось обновить рейтинг. Повторите позже.');
            }
        });
    }
    function save(value: string | null) {
        startTransition(async () => {
            setMessage('');
            setError('');
            try {
                const next = await updateLeaderboardProfile(value);
                if (!next.ok) {
                    setError(next.error);
                    return;
                }
                setResult(next);
                setNickname(next.data.mine?.nickname ?? '');
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
            <section className="py-10 sm:py-14">
                <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                            Коллекция решает
                        </p>
                        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                            Рейтинг игроков
                        </h1>
                        <p className="mt-4 max-w-2xl leading-7 text-muted">
                            Собирай новые предметы и поднимайся в топе. Каждый
                            уникальный предмет — одно очко. Дубликаты не
                            увеличивают результат.
                        </p>
                    </div>
                    <button
                        onClick={refresh}
                        disabled={pending}
                        className="cursor-pointer rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                        {pending ? 'Подождите…' : 'Обновить рейтинг'}
                    </button>
                </div>
                <div className="mt-6 rounded-2xl border border-accent/30 bg-amber-400/10 p-4 text-sm leading-6 text-muted">
                    <strong className="text-accent">Тестовый рейтинг.</strong>{' '}
                    Сейчас лимит можно сбрасывать без ограничений, поэтому число
                    открытий не ограничено. Все сохранённые открытия
                    учитываются; призов и реальной стоимости предметов нет.
                </div>
            </section>
            {!result.ok && (
                <p
                    role="alert"
                    className="rounded-2xl border border-danger/30 p-5 text-danger"
                >
                    {result.error}
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
                        className="min-w-0 overflow-hidden rounded-3xl border border-line bg-surface"
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
                    <aside className="order-first rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:order-last">
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
                                        save(nickname);
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
                                        value={nickname}
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
