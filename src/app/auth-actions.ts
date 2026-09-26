'use server';

import { cookies } from 'next/headers';

import { authSecret } from '@/server/auth-config';
import { database } from '@/server/db';
import { confirmEmailCode, requestEmailCode } from '@/server/email-auth';
import { sendLoginCode } from '@/server/mail';
import {
    authCookieOptions,
    currentSession,
    emailCookieName,
    endSession,
    establishSession,
} from '@/server/session';

export async function sendEmailCode(email: string, intent: 'login' | 'link') {
    try {
        if (
            typeof email !== 'string' ||
            email.length > 254 ||
            !['login', 'link'].includes(intent)
        ) {
            return { ok: false, error: 'Проверьте email.' } as const;
        }
        const session = await currentSession();
        if ((intent === 'link') !== Boolean(session)) {
            return {
                ok: false,
                error: 'Состояние входа изменилось. Обновите страницу.',
            } as const;
        }
        const token = await requestEmailCode(
            database(),
            {
                email,
                secret: authSecret(),
                linkUserId: session?.userId,
            },
            sendLoginCode,
        );
        (await cookies()).set(emailCookieName, token, {
            ...authCookieOptions,
            maxAge: 10 * 60,
        });
        return { ok: true } as const;
    } catch {
        return {
            ok: false,
            error: 'Не удалось отправить код. Проверьте адрес и повторите позже (не чаще раза в минуту).',
        } as const;
    }
}

export async function verifyEmailCode(code: string) {
    try {
        const token = (await cookies()).get(emailCookieName)?.value;
        if (!token || typeof code !== 'string')
            return { ok: false, error: 'Запросите новый код.' } as const;
        const session = await currentSession();
        const result = await confirmEmailCode(database(), {
            token,
            code,
            secret: authSecret(),
            currentUserId: session?.userId,
        });
        if (!result.ok) {
            return {
                ok: false,
                error:
                    result.error === 'identity-conflict'
                        ? 'Этот email уже связан с другим аккаунтом. Выйдите и войдите в него отдельно; автоматически аккаунты не объединяются.'
                        : 'Код неверен, истёк или исчерпаны попытки. Проверьте код или запросите новый.',
            } as const;
        }
        await establishSession(result.userId);
        (await cookies()).delete(emailCookieName);
        return { ok: true } as const;
    } catch {
        return {
            ok: false,
            error: 'Не удалось завершить вход. Повторите позже.',
        } as const;
    }
}

export async function logout() {
    await endSession();
}
