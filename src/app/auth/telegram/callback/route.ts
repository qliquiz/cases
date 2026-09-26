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
import {
    telegramFailure,
    type TelegramLoginStage,
} from '@/server/telegram-errors';
import { completeTelegramLogin } from '@/server/telegram-flow';

export async function GET(request: Request) {
    const jar = await cookies();
    let stage: TelegramLoginStage = 'config';
    try {
        const config = telegramLoginConfig();
        const query = new URL(request.url).searchParams;
        stage = 'session';
        const session = await currentSession();
        stage = 'identity';
        const userId = await completeTelegramLogin(database(), config, {
            state: query.get('state') ?? '',
            cookieState: jar.get(telegramFlowCookieName)?.value ?? '',
            code: query.get('code') ?? '',
            currentUserId: session?.userId,
        });
        stage = 'session';
        await establishSession(userId);
        jar.delete(telegramFlowCookieName);
        return NextResponse.redirect(
            new URL('/?authSuccess=telegram', appOrigin()),
        );
    } catch (error) {
        const failure = telegramFailure(error, stage);
        console.error('[telegram-login]', failure);
        jar.delete(telegramFlowCookieName);
        return NextResponse.redirect(
            new URL(
                error instanceof IdentityConflict
                    ? '/?authError=conflict'
                    : `/?authError=telegram_${failure.stage}`,
                appOrigin(),
            ),
        );
    }
}
