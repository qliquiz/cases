import { createHash } from 'node:crypto';

import { cookies } from 'next/headers';

import { database } from './db';
import { createSession, getSession } from './store';

export const sessionCookieName = 'case_lab_session';
export const emailCookieName = 'case_lab_email';
export const telegramFlowCookieName = 'case_lab_telegram_flow';
export const authCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
};

export async function currentSession() {
    const token = (await cookies()).get(sessionCookieName)?.value;
    if (!token) return null;
    return getSession(database(), token);
}

export async function establishSession(userId: string) {
    const token = await createSession(database(), userId);
    (await cookies()).set(sessionCookieName, token, {
        ...authCookieOptions,
        maxAge: 30 * 24 * 60 * 60,
    });
}

export async function endSession() {
    const jar = await cookies();
    const token = jar.get(sessionCookieName)?.value;
    if (token)
        await database()`delete from sessions where token_hash = ${createHash('sha256').update(token).digest('hex')}`;
    jar.delete(sessionCookieName);
    jar.delete(emailCookieName);
    jar.delete(telegramFlowCookieName);
}
