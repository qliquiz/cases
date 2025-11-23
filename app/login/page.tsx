'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface TelegramUserData {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function Login() {
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;
  const router = useRouter();
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTelegramLogin = async (user: TelegramUserData) => {
    try {
      setError(null);

      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      });

      if (res.ok) {
        router.push('/');
      } else {
        const errorData = await res
          .json()
          .catch(() => ({ error: 'Неизвестная ошибка' }));
        const errorMessage =
          errorData.error || 'Ошибка авторизации. Попробуйте еще раз.';
        setError(errorMessage);
        console.error('Telegram authentication failed:', errorData);
      }
    } catch (err) {
      const errorMessage =
        'Произошла ошибка при подключении к серверу. Проверьте подключение к интернету.';
      setError(errorMessage);
      console.error('Network error during authentication:', err);
    }
  };

  useEffect(() => {
    window.onTelegramAuth = handleTelegramLogin;
    return () => {
      delete window.onTelegramAuth;
    };
  });

  useEffect(() => {
    if (!botName) return;

    const container = scriptContainerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [botName]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-8 py-32 px-16 text-center">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          Вход через Telegram
        </h1>
        <div className="flex flex-col items-center gap-4">
          {error && (
            <div className="max-w-sm rounded-md bg-red-100 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <p className="font-medium">Ошибка авторизации</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          <div ref={scriptContainerRef}></div>
        </div>
      </div>
    </div>
  );
}
