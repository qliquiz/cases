import Link from 'next/link';

import { ThemePicker } from '@/app/theme-picker';

export function SiteHeader({ active }: { active: 'cases' | 'leaderboard' }) {
    return (
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
            <Link
                href="/"
                className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="CaseGo — главная"
            >
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                    C
                </span>
                <span className="text-lg font-bold tracking-tight">CaseGo</span>
            </Link>
            <nav
                aria-label="Главное меню"
                className="flex gap-1 rounded-xl border border-line bg-surface p-1"
            >
                {[
                    ['cases', '/', 'Кейсы'],
                    ['leaderboard', '/leaderboard', 'Рейтинг'],
                ].map(([key, href, label]) => (
                    <Link
                        key={key}
                        href={href}
                        prefetch={true}
                        aria-current={active === key ? 'page' : undefined}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent ${active === key ? 'bg-amber-400 text-slate-950' : 'text-muted hover:bg-inset'}`}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            <ThemePicker />
        </header>
    );
}
