export type ThemePreference = 'system' | 'light' | 'dark';

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                initData: string;
                ready: () => void;
                colorScheme?: 'light' | 'dark';
                onEvent?: (event: 'themeChanged', callback: () => void) => void;
                offEvent?: (
                    event: 'themeChanged',
                    callback: () => void,
                ) => void;
            };
        };
    }
}

// Self-contained: this same function runs inline before paint and after hydration.
// Do not reference module variables here — the inline copy has no module scope.
export function applyTheme() {
    const root = document.documentElement;
    let preference = root.dataset.themePreference;
    if (!preference) {
        try {
            preference = localStorage.getItem('casego-theme') ?? 'system';
        } catch {
            preference = 'system';
        }
    }
    if (preference !== 'light' && preference !== 'dark') preference = 'system';
    const webApp = window.Telegram?.WebApp;
    const isMiniApp =
        Boolean(webApp?.initData) ||
        new URLSearchParams(window.location.hash.slice(1)).has('tgWebAppData');
    const telegramTheme = isMiniApp ? webApp?.colorScheme : undefined;
    const automaticTheme =
        telegramTheme === 'light' || telegramTheme === 'dark'
            ? telegramTheme
            : window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === 'system' ? automaticTheme : preference;
}

export const themeInitScript = `(${applyTheme.toString()})()`;

export function getThemePreference(): ThemePreference {
    const value = document.documentElement.dataset.themePreference;
    return value === 'light' || value === 'dark' ? value : 'system';
}

export function setThemePreference(value: ThemePreference) {
    document.documentElement.dataset.themePreference = value;
    try {
        localStorage.setItem('casego-theme', value);
    } catch {
        // Private/restricted browsers can still change theme for this page.
    }
    applyTheme();
    window.dispatchEvent(new Event('casego:theme-change'));
}

export function subscribeTheme(onChange: () => void) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let webApp: NonNullable<Window['Telegram']>['WebApp'];
    function update() {
        const next = window.Telegram?.WebApp;
        if (next !== webApp) {
            webApp?.offEvent?.('themeChanged', update);
            webApp = next;
            webApp?.onEvent?.('themeChanged', update);
        }
        applyTheme();
        onChange();
    }
    function onStorage(event: StorageEvent) {
        if (event.key !== null && event.key !== 'casego-theme') return;
        delete document.documentElement.dataset.themePreference;
        update();
    }
    update();
    media.addEventListener('change', update);
    window.addEventListener('storage', onStorage);
    window.addEventListener('casego:theme-change', update);
    window.addEventListener('casego:telegram-ready', update);
    return () => {
        media.removeEventListener('change', update);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('casego:theme-change', update);
        window.removeEventListener('casego:telegram-ready', update);
        webApp?.offEvent?.('themeChanged', update);
    };
}
