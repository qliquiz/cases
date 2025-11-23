'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { useAuth } from './AuthContext';

export default function Home() {
  const { user, isLoading, isTwa } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isTwa) return;
    if (!user && process.env.NODE_ENV === 'development')
      document.cookie =
        'auth_token=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6NjU0NDUxODc5LCJmaXJzdF9uYW1lIjoiYXJ0w6ptIiwidXNlcm5hbWUiOiJxbGlxdWl6IiwiaWF0IjoxNzYzOTA5OTM4LCJleHAiOjE3NjQ1MTQ3Mzh9.zqbPFN-gapzbq1muTvoYKKXAgSOlKdKspuo8-v39y5A; path=/;	max-age=3000000; samesite=strict;';
    if (!user) router.push('/login');
  }, [user, isLoading, isTwa, router]);

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        Загрузка...
      </div>
    );

  if (user || isTwa)
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
              Welcome, {user?.first_name || 'User'}!
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Your Telegram ID: {user?.id}
            </p>
          </div>
        </main>
      </div>
    );

  return null;
}
