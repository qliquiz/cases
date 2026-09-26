'use client';

import { useState, useTransition } from 'react';

import { logout, sendEmailCode, verifyEmailCode } from '@/app/auth-actions';

type Account = {
    firstName: string;
    identities: { provider: 'telegram' | 'email'; subject: string }[];
};

export function AuthPanel({
    account,
    onChanged,
    disabled = false,
    onBusyChange,
}: {
    account: Account | null;
    onChanged: () => Promise<void>;
    disabled?: boolean;
    onBusyChange?: (busy: boolean) => void;
}) {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [sent, setSent] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    function run(operation: () => Promise<void>) {
        onBusyChange?.(true);
        startTransition(async () => {
            try {
                await operation();
            } finally {
                onBusyChange?.(false);
            }
        });
    }
    const hasTelegram = account?.identities.some(
        (item) => item.provider === 'telegram',
    );
    const linkedEmail = account?.identities.find(
        (item) => item.provider === 'email',
    )?.subject;
    const button =
        'cursor-pointer rounded-lg border border-line-strong px-3 py-2 text-sm hover:border-accent disabled:cursor-wait disabled:opacity-50';
    const input =
        'w-full rounded-lg border border-line-strong bg-inset px-3 py-2 text-sm text-foreground';

    return (
        <fieldset
            disabled={pending || disabled}
            className="mt-4 rounded-xl border border-line p-4 disabled:opacity-70"
        >
            <legend className="px-2 text-sm font-semibold">
                {account ? 'Ваш аккаунт' : 'Вход и регистрация'}
            </legend>
            {account && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                        {account.firstName}
                        {hasTelegram ? ' · Telegram привязан' : ''}
                        {linkedEmail ? ' · ' + linkedEmail : ''}
                    </span>
                    <button
                        type="button"
                        className={button}
                        onClick={() =>
                            run(async () => {
                                try {
                                    await logout();
                                    setSent(false);
                                    setCode('');
                                    setMessage(null);
                                    await onChanged();
                                } catch {
                                    setMessage(
                                        'Не удалось выйти. Повторите позже.',
                                    );
                                }
                            })
                        }
                    >
                        Выйти
                    </button>
                </div>
            )}
            {!hasTelegram && (
                <button
                    type="button"
                    className={button + ' mb-3 w-full'}
                    onClick={() => {
                        window.location.assign(
                            account
                                ? '/auth/telegram?intent=link'
                                : '/auth/telegram',
                        );
                    }}
                >
                    {account ? 'Привязать Telegram' : 'Войти через Telegram'}
                </button>
            )}
            {!linkedEmail && (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        setMessage(null);
                        run(async () => {
                            try {
                                const result = sent
                                    ? await verifyEmailCode(code)
                                    : await sendEmailCode(
                                          email,
                                          account ? 'link' : 'login',
                                      );
                                if (!result.ok) {
                                    setMessage(result.error);
                                    return;
                                }
                                if (sent) {
                                    setSent(false);
                                    setCode('');
                                    await onChanged();
                                } else {
                                    setSent(true);
                                    setMessage(
                                        'Код отправлен. Он действует 10 минут. Проверьте также папку «Спам».',
                                    );
                                }
                            } catch {
                                setMessage(
                                    'Сервис временно недоступен. Повторите позже.',
                                );
                            }
                        });
                    }}
                    className="space-y-2"
                >
                    <label className="block space-y-1 text-xs text-muted">
                        <span>
                            {account
                                ? 'Привязать email'
                                : 'Или войти по email — без пароля'}
                        </span>
                        <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            readOnly={sent}
                            className={input}
                        />
                    </label>
                    {sent && (
                        <label className="block space-y-1 text-xs text-muted">
                            <span>Код из письма</span>
                            <input
                                name="code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                required
                                value={code}
                                onChange={(event) =>
                                    setCode(event.target.value)
                                }
                                className={input}
                            />
                        </label>
                    )}
                    <button type="submit" className={button + ' w-full'}>
                        {pending
                            ? 'Подождите…'
                            : sent
                              ? 'Подтвердить код'
                              : 'Получить код'}
                    </button>
                    {sent && (
                        <button
                            type="button"
                            className="cursor-pointer text-xs text-muted underline"
                            onClick={() => {
                                setSent(false);
                                setCode('');
                                setMessage(null);
                            }}
                        >
                            Изменить email или запросить новый код
                        </button>
                    )}
                    {!account && (
                        <p className="text-xs text-subtle">
                            При первом входе аккаунт создастся автоматически.
                            Уже играли через Telegram? Войдите через него и
                            привяжите почту в аккаунте.
                        </p>
                    )}
                </form>
            )}
            {message && (
                <p role="status" className="mt-2 text-xs text-accent">
                    {message}
                </p>
            )}
        </fieldset>
    );
}
