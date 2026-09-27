'use server';

import { CraftError } from '@/game/crafting';
import { craftForUser, getCraftHistory } from '@/server/crafting';
import { database } from '@/server/db';
import { currentSession } from '@/server/session';
import { getCollection } from '@/server/store';

export async function loadCraftHistory() {
    const session = await currentSession();
    if (!session) return [];
    return getCraftHistory(database(), session.userId);
}

export async function createCraft(inputIds: string[], requestId: string) {
    try {
        const session = await currentSession();
        if (!session)
            return {
                ok: false,
                error: 'Войдите в аккаунт на странице кейсов.',
                retryable: false,
            } as const;
        const sql = database();
        const result = await craftForUser(
            sql,
            session.userId,
            inputIds,
            requestId,
        );
        const [collection, history] = await Promise.all([
            getCollection(sql, session.userId),
            getCraftHistory(sql, session.userId),
        ]);
        return { ok: true, result, collection, history } as const;
    } catch (error) {
        return {
            ok: false,
            error:
                error instanceof CraftError
                    ? error.message
                    : 'Не удалось подтвердить результат. Повторите проверку — предметы не спишутся дважды.',
            retryable: !(error instanceof CraftError),
        } as const;
    }
}
