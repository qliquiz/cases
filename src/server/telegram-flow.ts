import { createHash, randomBytes } from 'node:crypto';

import type { JWTVerifyGetKey } from 'jose';
import type { Sql } from 'postgres';

import { authenticateIdentity } from './identities';
import { verifyTelegramIdToken } from './telegram-login';

export type TelegramLoginConfig = {
    origin: string;
    clientId: string;
    clientSecret: string;
};
const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
const callback = (config: TelegramLoginConfig) =>
    new URL('/auth/telegram/callback', config.origin).href;

export async function beginTelegramLogin(
    sql: Sql,
    config: TelegramLoginConfig,
    linkUserId?: string,
) {
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(170926, 3)`;
        await tx`delete from telegram_login_flows where expires_at <= now()`;
        const rows = await tx<
            { total: number }[]
        >`select count(*)::int as total from telegram_login_flows`;
        if (rows[0].total >= 1000)
            throw new Error('Слишком много запросов входа');
        await tx`insert into telegram_login_flows (state_hash, verifier, link_user_id)
            values (${hash(state)}, ${verifier}, ${linkUserId ?? null})`;
    });
    const url = new URL('https://oauth.telegram.org/auth');
    url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: callback(config),
        response_type: 'code',
        scope: 'openid profile',
        state,
        code_challenge: createHash('sha256')
            .update(verifier)
            .digest('base64url'),
        code_challenge_method: 'S256',
    }).toString();
    return { state, url: url.href };
}

async function exchangeAuthorizationCode(
    config: TelegramLoginConfig,
    code: string,
    verifier: string,
) {
    const response = await fetch('https://oauth.telegram.org/token', {
        method: 'POST',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:
                'Basic ' +
                Buffer.from(
                    config.clientId + ':' + config.clientSecret,
                ).toString('base64'),
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: callback(config),
            client_id: config.clientId,
            code_verifier: verifier,
        }),
    });
    if (!response.ok) throw new Error('Telegram не подтвердил вход');
    const body: unknown = await response.json();
    if (
        !body ||
        typeof body !== 'object' ||
        !('id_token' in body) ||
        typeof body.id_token !== 'string'
    ) {
        throw new Error('Telegram не вернул ID token');
    }
    return body.id_token;
}

export async function completeTelegramLogin(
    sql: Sql,
    config: TelegramLoginConfig,
    input: {
        state: string;
        cookieState: string;
        code: string;
        currentUserId?: string;
    },
    exchange = exchangeAuthorizationCode,
    keys?: JWTVerifyGetKey,
) {
    if (
        !/^[A-Za-z0-9_-]{43}$/.test(input.state) ||
        input.state !== input.cookieState ||
        !input.code ||
        input.code.length > 4096
    )
        throw new Error('Недействительный запрос входа');
    const rows = await sql<{ verifier: string; link_user_id: string | null }[]>`
        delete from telegram_login_flows
        where state_hash = ${hash(input.state)} and expires_at > now()
        and link_user_id is not distinct from ${input.currentUserId ?? null}::uuid
        returning verifier, link_user_id
    `;
    if (!rows.length) throw new Error('Запрос входа истёк или уже использован');
    const token = await exchange(config, input.code, rows[0].verifier);
    const identity = await verifyTelegramIdToken(token, config.clientId, keys);
    return authenticateIdentity(
        sql,
        identity,
        rows[0].link_user_id ?? undefined,
    );
}
