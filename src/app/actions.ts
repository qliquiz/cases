'use server';

import { verifyTelegramInitData } from '@/game/telegram-auth';
import { database } from '@/server/db';
import { getIdentities } from '@/server/identities';
import { currentSession, establishSession } from '@/server/session';
import {
    getCollection,
    getDailyRemaining,
    openCaseForUser,
    upsertTelegramUser,
} from '@/server/store';

async function accountStateFor(userId: string, firstName: string) {
    const sql = database();
    const [remaining, collection, identities] = await Promise.all([
        getDailyRemaining(sql, userId),
        getCollection(sql, userId),
        getIdentities(sql, userId),
    ]);
    return { firstName, remaining, collection, identities };
}

export async function getAccountState() {
    const session = await currentSession();
    if (!session) return null;
    return accountStateFor(session.userId, session.firstName);
}

export async function startTelegramSession(rawInitData: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN не задан');

    const identity = verifyTelegramInitData(rawInitData, botToken);
    const sql = database();
    const userId = await upsertTelegramUser(
        sql,
        identity.id,
        identity.firstName,
    );
    const existing = await currentSession();
    if (existing?.userId === userId) {
        return accountStateFor(userId, identity.firstName);
    }
    await establishSession(userId);
    return accountStateFor(userId, identity.firstName);
}

export async function openCase(caseId: string, requestId: string) {
    const session = await currentSession();
    if (!session) throw new Error('Войдите в аккаунт');
    const sql = database();
    const opened = await openCaseForUser(
        sql,
        session.userId,
        caseId,
        requestId,
    );
    const collection = await getCollection(sql, session.userId);
    return { ...opened, collection };
}
