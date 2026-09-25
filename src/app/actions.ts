'use server';

import { cookies } from 'next/headers';

import { verifyTelegramInitData } from '@/game/telegram-auth';
import { database } from '@/server/db';
import { currentSession, sessionCookieName } from '@/server/session';
import {
    createSession,
    getCollection,
    getDailyRemaining,
    openCaseForUser,
    upsertTelegramUser,
} from '@/server/store';

async function accountStateFor(telegramId: string, firstName: string) {
    const sql = database();
    const [remaining, collection] = await Promise.all([
        getDailyRemaining(sql, telegramId),
        getCollection(sql, telegramId),
    ]);
    return { firstName, remaining, collection };
}

export async function getAccountState() {
    const session = await currentSession();
    if (!session) return null;
    return accountStateFor(session.telegramId, session.firstName);
}

export async function startTelegramSession(rawInitData: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN не задан');

    const identity = verifyTelegramInitData(rawInitData, botToken);
    const sql = database();
    await upsertTelegramUser(sql, identity.id, identity.firstName);
    const existing = await currentSession();
    if (existing?.telegramId === identity.id) {
        return accountStateFor(identity.id, identity.firstName);
    }
    const token = await createSession(sql, identity.id);
    (await cookies()).set(sessionCookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
    });
    return accountStateFor(identity.id, identity.firstName);
}

export async function openCase(caseId: string, requestId: string) {
    const session = await currentSession();
    if (!session) throw new Error('Откройте приложение через Telegram');
    const sql = database();
    const opened = await openCaseForUser(
        sql,
        session.telegramId,
        caseId,
        requestId,
    );
    const collection = await getCollection(sql, session.telegramId);
    return { ...opened, collection };
}
