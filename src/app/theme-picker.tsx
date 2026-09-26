'use client';

import { useSyncExternalStore } from 'react';

import {
    getThemePreference,
    setThemePreference,
    subscribeTheme,
} from '@/browser/theme';

const serverPreference = () => 'system' as const;

export function ThemePicker() {
    const preference = useSyncExternalStore(
        subscribeTheme,
        getThemePreference,
        serverPreference,
    );

    return (
        <label className="flex items-center gap-2 text-xs text-muted">
            <span>Тема</span>
            <select
                aria-label="Тема оформления"
                value={preference}
                onChange={(event) => {
                    const value = event.target.value;
                    if (
                        value === 'system' ||
                        value === 'light' ||
                        value === 'dark'
                    )
                        setThemePreference(value);
                }}
                className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <option value="system">Авто</option>
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
            </select>
        </label>
    );
}
