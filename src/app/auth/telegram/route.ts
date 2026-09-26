import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { appOrigin, telegramLoginConfig } from '@/server/auth-config';
import { database } from '@/server/db';
import {
    authCookieOptions,
    currentSession,
    telegramFlowCookieName,
} from '@/server/session';
import { beginTelegramLogin } from '@/server/telegram-flow';

export async function GET(request: Request) {
    try {
        const config = telegramLoginConfig();
        const intent =
            new URL(request.url).searchParams.get('intent') ?? 'login';
        if (!['login', 'link'].includes(intent))
            throw new Error('Некорректный intent');
        const session = await currentSession();
        if ((intent === 'link') !== Boolean(session)) {
            return NextResponse.redirect(
                new URL('/?authError=session', config.origin),
            );
        }
        const flow = await beginTelegramLogin(
            database(),
            config,
            session?.userId,
        );
        (await cookies()).set(telegramFlowCookieName, flow.state, {
            ...authCookieOptions,
            maxAge: 10 * 60,
        });
        return NextResponse.redirect(flow.url);
    } catch {
        return NextResponse.redirect(
            new URL('/?authError=telegram', appOrigin()),
        );
    }
}
