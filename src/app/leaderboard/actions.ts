'use server';

import { revalidatePath } from 'next/cache';

import { database } from '@/server/db';
import {
    getLeaderboard,
    NicknameError,
    saveLeaderboardNickname,
} from '@/server/leaderboard';
import { currentSession } from '@/server/session';

export async function loadLeaderboard() {
    try {
        const session = await currentSession();
        return {
            ok: true,
            data: await getLeaderboard(database(), session?.userId),
        } as const;
    } catch {
        return {
            ok: false,
            error: 'Не удалось загрузить рейтинг. Попробуйте ещё раз.',
        } as const;
    }
}

export async function updateLeaderboardProfile(nickname: string | null) {
    try {
        const session = await currentSession();
        if (!session)
            return {
                ok: false,
                error: 'Войдите в аккаунт на странице кейсов.',
            } as const;
        await saveLeaderboardNickname(database(), session.userId, nickname);
        revalidatePath('/leaderboard');
        return {
            ok: true,
            data: await getLeaderboard(database(), session.userId),
        } as const;
    } catch (error) {
        return {
            ok: false,
            error:
                error instanceof NicknameError
                    ? error.message
                    : 'Не удалось сохранить профиль. Попробуйте ещё раз.',
        } as const;
    }
}
