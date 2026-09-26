import type { ActivityEvent } from '@/game/analytics-events';

const deliveredDays = new Map<ActivityEvent, string>();
let generation = 0;

export function resetActivityCache() {
    generation++;
    deliveredDays.clear();
}

// Best-effort signals only. Identity, UTC day and durable deduplication are server-owned.
export function observeActivity(event: ActivityEvent, target?: Element | null) {
    const sessionGeneration = generation;
    let inViewport = event === 'visit';
    let stopped = false;
    let pending = false;
    let attemptDay = '';
    let attemptedAt = 0;
    let midnightTimer: number | undefined;
    let abort: AbortController | undefined;
    const day = () => new Date().toISOString().slice(0, 10);

    async function send() {
        const today = day();
        if (
            stopped ||
            pending ||
            !inViewport ||
            document.visibilityState !== 'visible' ||
            sessionGeneration !== generation ||
            deliveredDays.get(event) === today
        )
            return;
        if (attemptDay === today && Date.now() - attemptedAt < 60_000) return;
        attemptDay = today;
        attemptedAt = Date.now();
        pending = true;
        const controller = new AbortController();
        abort = controller;
        const timeout = window.setTimeout(() => controller.abort(), 5_000);
        try {
            const response = await fetch('/api/activity', {
                method: 'POST',
                credentials: 'same-origin',
                body: event,
                signal: controller.signal,
            });
            if (response.ok && sessionGeneration === generation)
                deliveredDays.set(event, today);
        } catch {
            // Network/analytics failures must not affect authentication or opening.
        } finally {
            window.clearTimeout(timeout);
            pending = false;
            if (!stopped && day() !== today) void send();
        }
    }

    function wake() {
        window.clearTimeout(midnightTimer);
        if (stopped || document.visibilityState !== 'visible') return;
        void send();
        const now = new Date();
        const nextMidnight = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
        );
        midnightTimer = window.setTimeout(
            wake,
            nextMidnight - now.getTime() + 100,
        );
    }

    const observer =
        target && typeof IntersectionObserver !== 'undefined'
            ? new IntersectionObserver(
                  ([entry]) => {
                      inViewport =
                          entry.isIntersecting &&
                          entry.intersectionRatio >= 0.5;
                      void send();
                  },
                  { threshold: 0.5 },
              )
            : null;
    if (observer && target) observer.observe(target);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    wake();
    return () => {
        stopped = true;
        abort?.abort();
        window.clearTimeout(midnightTimer);
        observer?.disconnect();
        document.removeEventListener('visibilitychange', wake);
        window.removeEventListener('focus', wake);
    };
}
