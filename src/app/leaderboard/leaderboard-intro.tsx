import type { ReactNode } from 'react';

export function LeaderboardIntro({ action }: { action?: ReactNode }) {
    return (
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
                        уникальный предмет — одно очко. Дубликаты не увеличивают
                        результат.
                    </p>
                </div>
                {action ?? <RefreshRatingButton disabled />}
            </div>
            <div className="mt-6 rounded-2xl border border-accent/30 bg-amber-400/10 p-4 text-sm leading-6 text-muted">
                <strong className="text-accent">Тестовый рейтинг.</strong>{' '}
                Сейчас лимит можно сбрасывать без ограничений, поэтому число
                открытий не ограничено. Все сохранённые открытия учитываются;
                призов и реальной стоимости предметов нет.
            </div>
        </section>
    );
}

export function RefreshRatingButton({
    onClick,
    disabled = false,
    children = 'Обновляем…',
}: {
    onClick?: () => void;
    disabled?: boolean;
    children?: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-44 shrink-0 cursor-pointer rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
        >
            {children}
        </button>
    );
}
