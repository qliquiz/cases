'use client';

import Image from 'next/image';
import Script from 'next/script';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    useTransition,
} from 'react';

import {
    getAccountState,
    openCase,
    resetCaseLimit,
    startTelegramSession,
} from '@/app/actions';
import { AuthPanel } from '@/app/auth-panel';
import { CollectionPanel } from '@/app/collection-panel';
import { observeActivity } from '@/browser/activity';
import {
    caseCatalog,
    type CaseDefinition,
    featuredCase,
    itemLabel,
} from '@/game/catalog';
import { openingLimit } from '@/game/opening-limit';
import { createReel } from '@/game/reel';
import {
    cardAtMarker,
    playPreviewSound,
    playResultSound,
    playTickSound,
    tryPlaySound,
} from '@/game/reel-audio';

type Drop = (typeof featuredCase.drops)[number];
type Reel = ReturnType<typeof createReel>;
type Phase = 'idle' | 'ready' | 'spinning' | 'complete';
type Account = NonNullable<Awaited<ReturnType<typeof getAccountState>>>;
type AuthStatus = 'loading' | 'ready' | 'signed-out' | 'error';

const cardWidth = 160;
const cardStep = 176;
const rareItemIds = new Set(
    caseCatalog.flatMap((caseData) =>
        caseData.rareDrops.map((item) => item.id),
    ),
);

function itemAccent(item: Drop) {
    return rareItemIds.has(item.id) ? '#e4ae39' : item.accent;
}

const subscribeLaunch = () => () => {};
const serverLaunch = () => null;
function browserLaunch() {
    const mini =
        Boolean(window.Telegram?.WebApp?.initData) ||
        new URLSearchParams(window.location.hash.slice(1)).has('tgWebAppData');
    return (
        (mini ? 'mini:' : 'web:') +
        (new URLSearchParams(window.location.search).get('authError') ?? '')
    );
}

export function CasePlayground({
    caseData = featuredCase,
    onCaseChange,
}: {
    caseData?: CaseDefinition;
    onCaseChange?: (caseData: CaseDefinition) => void;
} = {}) {
    const [result, setResult] = useState<Drop | null>(null);
    const [reel, setReel] = useState<Reel | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [soundError, setSoundError] = useState<string | null>(null);
    const [account, setAccount] = useState<Account | null>(null);
    const [authBusy, setAuthBusy] = useState(false);
    const launch = useSyncExternalStore(
        subscribeLaunch,
        browserLaunch,
        serverLaunch,
    );
    const isMiniApp = launch?.startsWith('mini:') ?? false;
    const [dismissedAuthError, setDismissedAuthError] = useState(false);
    const authFlowError = !dismissedAuthError && launch?.split(':')[1];
    const authFlowMessage =
        authFlowError === 'conflict'
            ? 'Этот способ входа уже связан с другим аккаунтом. Автоматическое объединение недоступно.'
            : authFlowError
              ? 'Не удалось завершить вход через Telegram. Попробуйте ещё раз или используйте email.'
              : null;
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [pending, startTransition] = useTransition();
    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<AudioContext | null>(null);
    const suspendTimerRef = useRef<number | null>(null);
    const finishedRef = useRef(false);
    const bootstrappedRef = useRef(false);
    const requestIdRef = useRef<string | null>(null);
    const pendingAccountRef = useRef<Pick<
        Account,
        'remaining' | 'collection'
    > | null>(null);

    useEffect(() => {
        if (account) return observeActivity('visit');
    }, [account]);

    useEffect(() => {
        return () => {
            if (suspendTimerRef.current !== null)
                window.clearTimeout(suspendTimerRef.current);
            void audioRef.current?.close();
        };
    }, []);

    const bootstrap = useCallback(
        (miniApp: boolean) => {
            if (bootstrappedRef.current) return;
            bootstrappedRef.current = true;
            startTransition(async () => {
                try {
                    const webApp = window.Telegram?.WebApp;
                    if (miniApp && !webApp?.initData)
                        throw new Error('Нет данных Telegram');
                    if (miniApp) webApp?.ready();
                    const next = miniApp
                        ? await startTelegramSession(webApp!.initData)
                        : await getAccountState();
                    if (!next) {
                        setAuthStatus('signed-out');
                        return;
                    }
                    setAccount(next);
                    setAuthStatus('ready');
                } catch {
                    setAuthStatus('error');
                }
            });
        },
        [startTransition],
    );

    useEffect(() => {
        if (launch && !isMiniApp) bootstrap(false);
    }, [launch, isMiniApp, bootstrap]);

    async function accountChanged() {
        setDismissedAuthError(true);
        const next = await getAccountState();
        setAccount(next);
        setAuthStatus(next ? 'ready' : 'signed-out');
        setResult(null);
        setReel(null);
        setPhase('idle');
        setError(null);
        requestIdRef.current = null;
        pendingAccountRef.current = null;
    }

    const suspendAudio = useCallback((delayMs = 0) => {
        if (suspendTimerRef.current !== null) {
            window.clearTimeout(suspendTimerRef.current);
            suspendTimerRef.current = null;
        }
        if (delayMs > 0) {
            suspendTimerRef.current = window.setTimeout(() => {
                suspendTimerRef.current = null;
                void audioRef.current?.suspend().catch(() => {});
            }, delayMs);
        } else {
            void audioRef.current?.suspend().catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (phase !== 'ready') return;
        const timer = window.setTimeout(() => setPhase('spinning'), 50);
        return () => window.clearTimeout(timer);
    }, [phase]);

    const finishSpin = useCallback(() => {
        if (phase !== 'spinning' || !reel || finishedRef.current) return;
        finishedRef.current = true;
        setResult(reel.items[reel.winnerIndex]);
        const nextAccount = pendingAccountRef.current;
        if (nextAccount) {
            setAccount((current) =>
                current ? { ...current, ...nextAccount } : current,
            );
            pendingAccountRef.current = null;
        }
        setPhase('complete');
        if (
            audioRef.current?.state === 'running' &&
            !tryPlaySound(audioRef.current, playResultSound)
        ) {
            setSoundError(
                'Не удалось воспроизвести звук. Открытие кейса работает.',
            );
        }
        suspendAudio(350);
    }, [phase, reel, suspendAudio]);

    useEffect(() => {
        if (phase !== 'spinning' || !reel) return;
        const timer = window.setTimeout(finishSpin, 6000);
        return () => window.clearTimeout(timer);
    }, [phase, reel, finishSpin]);

    useEffect(() => {
        if (phase !== 'spinning') return;
        const viewport = viewportRef.current;
        const track = trackRef.current;
        if (!viewport || !track) return;

        const markerX = () => {
            const rect = viewport.getBoundingClientRect();
            return rect.left + rect.width / 2;
        };
        let previousIndex = cardAtMarker(
            markerX(),
            track.getBoundingClientRect().left,
            cardWidth,
            cardStep,
        );
        let frame = 0;
        const followMarker = () => {
            const currentIndex = cardAtMarker(
                markerX(),
                track.getBoundingClientRect().left,
                cardWidth,
                cardStep,
            );
            if (currentIndex > previousIndex) {
                if (
                    audioRef.current?.state === 'running' &&
                    !tryPlaySound(audioRef.current, playTickSound)
                ) {
                    setSoundError(
                        'Не удалось воспроизвести звук. Открытие кейса работает.',
                    );
                }
                previousIndex = currentIndex;
            }
            frame = window.requestAnimationFrame(followMarker);
        };
        frame = window.requestAnimationFrame(followMarker);
        return () => window.cancelAnimationFrame(frame);
    }, [phase]);

    function activateAudio() {
        if (suspendTimerRef.current !== null) {
            window.clearTimeout(suspendTimerRef.current);
            suspendTimerRef.current = null;
        }
        if (!window.AudioContext) {
            setSoundError('Этот браузер не поддерживает Web Audio.');
            return;
        }
        try {
            audioRef.current ??= new AudioContext();
            const context = audioRef.current;
            // Первый источник запускается в самом обработчике нажатия: это важно для Safari.
            const previewReady = tryPlaySound(context, playPreviewSound);
            void context
                .resume()
                .then(() => {
                    setSoundError(
                        !previewReady
                            ? 'Не удалось воспроизвести звук. Открытие кейса работает.'
                            : context.state === 'running'
                              ? null
                              : 'Safari не разрешил воспроизведение. Проверь настройки сайта и вкладки.',
                    );
                })
                .catch(() => {
                    setSoundError(
                        'Браузер заблокировал звук. Проверь настройки сайта и вкладки.',
                    );
                });
        } catch {
            setSoundError('Не удалось запустить звук в этом браузере.');
        }
    }

    function refreshAccount() {
        startTransition(async () => {
            try {
                const next = await getAccountState();
                if (!next) {
                    setAuthStatus('signed-out');
                    setAccount(null);
                    return;
                }
                setAccount(next);
                setError(null);
            } catch {
                setError('Не удалось обновить лимит. Попробуйте ещё раз.');
            }
        });
    }

    function handleResetLimit() {
        if (pending || authBusy || phase === 'ready' || phase === 'spinning')
            return;
        startTransition(async () => {
            try {
                const next = await resetCaseLimit();
                setAccount(next);
                requestIdRef.current = null;
                setError(null);
            } catch {
                setError('Не удалось сбросить лимит. Попробуйте ещё раз.');
            }
        });
    }

    function handleOpen() {
        if (
            pending ||
            authBusy ||
            authStatus !== 'ready' ||
            !account ||
            account.remaining <= 0 ||
            phase === 'ready' ||
            phase === 'spinning'
        )
            return;
        requestIdRef.current ??= window.crypto.randomUUID();
        activateAudio();

        setError(null);
        startTransition(async () => {
            try {
                const opened = await openCase(
                    caseData.id,
                    requestIdRef.current!,
                );
                const selected = opened.drop;
                const nextReel = createReel(caseData, selected);
                requestIdRef.current = null;
                pendingAccountRef.current = {
                    remaining: opened.remaining,
                    collection: opened.collection,
                };
                finishedRef.current = false;
                setReel(nextReel);

                if (
                    window.matchMedia('(prefers-reduced-motion: reduce)')
                        .matches
                ) {
                    finishedRef.current = true;
                    setResult(selected);
                    setAccount((current) =>
                        current
                            ? {
                                  ...current,
                                  remaining: opened.remaining,
                                  collection: opened.collection,
                              }
                            : current,
                    );
                    pendingAccountRef.current = null;
                    setPhase('complete');
                    if (
                        audioRef.current?.state === 'running' &&
                        !tryPlaySound(audioRef.current, playResultSound)
                    ) {
                        setSoundError(
                            'Не удалось воспроизвести звук. Открытие кейса работает.',
                        );
                    }
                    suspendAudio(350);
                } else {
                    setResult(null);
                    setPhase('ready');
                }
            } catch {
                suspendAudio();
                setError('Не получилось открыть кейс. Попробуйте ещё раз.');
            }
        });
    }

    const targetIndex =
        phase === 'spinning' || phase === 'complete'
            ? (reel?.winnerIndex ?? 0)
            : 0;

    return (
        <div className="rounded-[2rem] border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-2xl shadow-black/10 sm:p-7">
            {isMiniApp && (
                <Script
                    src="https://telegram.org/js/telegram-web-app.js?63"
                    onReady={() => {
                        window.dispatchEvent(
                            new Event('casego:telegram-ready'),
                        );
                        bootstrap(true);
                    }}
                    onError={() => setAuthStatus('error')}
                />
            )}
            {onCaseChange && (
                <fieldset
                    disabled={
                        pending ||
                        authBusy ||
                        phase === 'ready' ||
                        phase === 'spinning'
                    }
                    aria-label="Выбор кейса"
                    className="mb-5"
                >
                    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                        Выбери кейс
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {caseCatalog.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-label={item.name}
                                aria-pressed={item.id === caseData.id}
                                className={`min-w-0 cursor-pointer rounded-xl border p-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${item.id === caseData.id ? 'border-accent bg-amber-400/10 text-accent forced-colors:outline-2 forced-colors:outline-[Highlight]' : 'border-line bg-inset text-muted hover:border-line-strong'}`}
                                onClick={() => {
                                    if (
                                        pending ||
                                        authBusy ||
                                        phase === 'ready' ||
                                        phase === 'spinning' ||
                                        item.id === caseData.id
                                    )
                                        return;
                                    if (requestIdRef.current) refreshAccount();
                                    requestIdRef.current = null;
                                    pendingAccountRef.current = null;
                                    setResult(null);
                                    setReel(null);
                                    setPhase('idle');
                                    setError(null);
                                    suspendAudio();
                                    onCaseChange(item);
                                }}
                            >
                                <Image
                                    src={item.image}
                                    alt=""
                                    width={96}
                                    height={60}
                                    unoptimized
                                    className="mx-auto mb-1 h-12 w-full object-contain"
                                />
                                {item.name}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-subtle">
                        {openingLimit} открытий на все кейсы вместе · свободный
                        сброс в тестовом режиме
                    </p>
                </fieldset>
            )}
            <p className="text-sm font-semibold">{caseData.name}</p>
            {soundError && (
                <p role="alert" className="mt-2 text-xs text-danger">
                    {soundError}
                </p>
            )}
            <div
                ref={viewportRef}
                className="relative mt-6 h-60 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-slate-100"
            >
                {reel ? (
                    <>
                        <div
                            ref={trackRef}
                            className="absolute top-8 left-1/2 flex gap-4 will-change-transform"
                            style={{
                                transform: `translate3d(${-targetIndex * cardStep - cardWidth / 2}px, 0, 0)`,
                                transition:
                                    phase === 'spinning'
                                        ? 'transform 5.5s cubic-bezier(0.08, 0.55, 0.08, 1)'
                                        : 'none',
                            }}
                            onTransitionEnd={(event) => {
                                if (
                                    event.propertyName === 'transform' &&
                                    event.target === event.currentTarget
                                )
                                    finishSpin();
                            }}
                        >
                            {reel.items.map((item, index) => (
                                <div
                                    key={`${index}-${item.id}`}
                                    className="flex h-40 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-slate-800/90 p-2"
                                    style={{
                                        width: cardWidth,
                                        borderBottomColor: itemAccent(item),
                                        borderBottomWidth: 4,
                                    }}
                                >
                                    <Image
                                        src={item.image}
                                        alt=""
                                        width={140}
                                        height={105}
                                        unoptimized
                                        className="h-24 w-36 object-contain"
                                    />
                                    <span className="mt-2 max-w-full truncate text-xs font-semibold">
                                        {itemLabel(item)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-amber-300 shadow-[0_0_18px_3px_#fcd34d]" />
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-950 to-transparent" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-slate-950 to-transparent" />
                    </>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center">
                        <Image
                            src={caseData.image}
                            alt={caseData.name}
                            width={170}
                            height={150}
                            unoptimized
                            className="h-36 w-44 object-contain"
                            priority
                        />
                        <p className="mt-2 text-sm text-slate-400">
                            Нажми, чтобы открыть кейс
                        </p>
                    </div>
                )}
            </div>
            <div className="mt-4 min-h-12 text-center" aria-live="polite">
                {result ? (
                    <>
                        <p
                            className="inline-block rounded-lg bg-slate-950 px-3 py-1 font-bold"
                            style={{ color: itemAccent(result) }}
                        >
                            {itemLabel(result)}
                        </p>
                        <p className="text-xs text-subtle">
                            {rareItemIds.has(result.id)
                                ? 'Редкий особый предмет'
                                : result.rarity}
                        </p>
                    </>
                ) : phase === 'spinning' ? (
                    <p className="text-sm text-subtle">Лента прокручивается…</p>
                ) : null}
            </div>
            {authStatus === 'loading' && (
                <p className="mb-3 text-center text-sm text-subtle">
                    Проверяем вход…
                </p>
            )}
            {authStatus === 'signed-out' && (
                <p className="mb-3 text-center text-sm text-accent">
                    Войдите, чтобы открывать кейсы и сохранять коллекцию.
                </p>
            )}
            {authStatus === 'error' && (
                <p
                    role="alert"
                    className="mb-3 text-center text-sm text-danger"
                >
                    Не удалось проверить вход. Перезапустите Mini App или
                    войдите на сайте.
                </p>
            )}
            <button
                type="button"
                onClick={handleOpen}
                disabled={
                    pending ||
                    authBusy ||
                    authStatus !== 'ready' ||
                    !account ||
                    account.remaining <= 0 ||
                    phase === 'ready' ||
                    phase === 'spinning'
                }
                className="w-full cursor-pointer rounded-xl bg-amber-300 px-5 py-4 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
            >
                {pending || phase === 'ready'
                    ? 'Готовим открытие…'
                    : phase === 'spinning'
                      ? 'Открываем…'
                      : result
                        ? 'Открыть ещё раз'
                        : 'Открыть бесплатно'}
            </button>
            {(error || authFlowMessage) && (
                <p className="mt-3 text-center text-sm text-danger">
                    {error || authFlowMessage}
                </p>
            )}
            {authStatus !== 'loading' && (
                <AuthPanel
                    account={account}
                    onChanged={accountChanged}
                    onBusyChange={setAuthBusy}
                    disabled={
                        pending || phase === 'ready' || phase === 'spinning'
                    }
                />
            )}
            {account && (
                <CollectionPanel
                    key={caseData.id}
                    caseData={caseData}
                    collection={account.collection}
                    remaining={account.remaining}
                    onRefresh={handleResetLimit}
                    refreshing={
                        pending ||
                        authBusy ||
                        phase === 'ready' ||
                        phase === 'spinning'
                    }
                />
            )}
            <p className="mt-4 text-center text-xs text-subtle">
                Результат виртуальный и не выдаётся в Steam
            </p>
        </div>
    );
}
