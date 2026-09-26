'use client';

import { useSyncExternalStore } from 'react';

import {
    getThemePreference,
    setThemePreference,
    subscribeTheme,
} from '@/browser/theme';

const serverPreference = () => 'system' as const;

const themes = [
    { value: 'system', label: 'Авто', path: 'M3 4h18v12H3z M8 20h8 M12 16v4' },
    {
        value: 'light',
        label: 'Светлая',
        path: 'M12 3v1 M12 20v1 M3 12h1 M20 12h1 M5.6 5.6l.7.7 M17.7 17.7l.7.7 M5.6 18.4l.7-.7 M17.7 6.3l.7-.7 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    },
    {
        value: 'dark',
        label: 'Тёмная',
        path: 'M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z',
    },
] as const;

export function ThemePicker() {
    const preference = useSyncExternalStore(
        subscribeTheme,
        getThemePreference,
        serverPreference,
    );

    return (
        <div
            role="radiogroup"
            aria-label="Тема оформления"
            className="relative isolate flex w-36 max-w-full rounded-full border border-line bg-inset p-1 shadow-inner sm:w-[16.5rem]"
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 left-1 -z-10 w-[calc((100%-0.5rem)/3)] rounded-full bg-amber-300 shadow-sm shadow-amber-950/15 transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{
                    transform: `translateX(${themes.findIndex((theme) => theme.value === preference) * 100}%)`,
                }}
            />
            {themes.map((theme) => (
                <label
                    key={theme.value}
                    title={theme.label}
                    className="relative flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-full"
                >
                    <input
                        type="radio"
                        name="theme"
                        value={theme.value}
                        checked={preference === theme.value}
                        onChange={() => setThemePreference(theme.value)}
                        className="peer absolute inset-0 m-0 size-full cursor-pointer rounded-full opacity-0"
                    />
                    <span className="pointer-events-none flex items-center gap-1.5 rounded-full text-xs font-medium text-muted transition-colors peer-checked:text-slate-950 peer-hover:text-foreground peer-checked:peer-hover:text-slate-950 motion-reduce:transition-none">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-4 shrink-0"
                        >
                            <path d={theme.path} />
                        </svg>
                        <span className="sr-only sm:not-sr-only">
                            {theme.label}
                        </span>
                    </span>
                    <span className="pointer-events-none absolute inset-0 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent forced-colors:peer-checked:outline-2 forced-colors:peer-checked:-outline-offset-2 forced-colors:peer-checked:outline-[Highlight]" />
                </label>
            ))}
        </div>
    );
}
