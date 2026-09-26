import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { appOrigin, telegramLoginConfig } from '@/server/auth-config';
import { database } from '@/server/db';
import { IdentityConflict } from '@/server/identities';
import {
    currentSession,
    establishSession,
    telegramFlowCookieName,
} from '@/server/session';
import { completeTelegramLogin } from '@/server/telegram-flow';

export async function GET(request: Request) {
    const jar = await cookies();
    try {
        const query = new URL(request.url).searchParams;
        const session = await currentSession();
        const userId = await completeTelegramLogin(
            database(),
            telegramLoginConfig(),
            {
                state: query.get('state') ?? '',
                cookieState: jar.get(telegramFlowCookieName)?.value ?? '',
                code: query.get('code') ?? '',
                currentUserId: session?.userId,
            },
        );
        await establishSession(userId);
        jar.delete(telegramFlowCookieName);
        return NextResponse.redirect(new URL('/', appOrigin()));
    } catch (error) {
        jar.delete(telegramFlowCookieName);
        return NextResponse.redirect(
            new URL(
                error instanceof IdentityConflict
                    ? '/?authError=conflict'
                    : '/?authError=telegram',
                appOrigin(),
            ),
        );
    }
}
