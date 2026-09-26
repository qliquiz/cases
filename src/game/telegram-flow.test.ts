import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { generateKeyPair, SignJWT } from 'jose';
import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import { upsertTelegramUser } from '../server/store';
import {
    beginTelegramLogin,
    completeTelegramLogin,
} from '../server/telegram-flow';

const socket = process.env.TEST_PG_SOCKET;

test(
    'ошибка обмена Telegram сообщает этап и безопасный код, не секреты ответа',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
            onnotice() {},
        });
        const config = {
            clientId: '1234',
            clientSecret: 'private-client-secret',
            origin: 'https://cases.example',
        };
        const originalFetch = globalThis.fetch;
        try {
            await migrate(sql);
            const flow = await beginTelegramLogin(sql, config);
            globalThis.fetch = async () =>
                Response.json(
                    {
                        error: 'invalid_client',
                        error_description: 'private-provider-data',
                    },
                    { status: 401 },
                );
            await assert.rejects(
                completeTelegramLogin(sql, config, {
                    state: flow.state,
                    cookieState: flow.state,
                    code: 'private-code',
                }),
                (error) => {
                    assert.ok(error instanceof Error);
                    assert.equal(
                        error.message,
                        'telegram_token_exchange:invalid_client',
                    );
                    assert.doesNotMatch(JSON.stringify(error), /private-/);
                    return true;
                },
            );
        } finally {
            globalThis.fetch = originalFetch;
            await sql.end();
        }
    },
);

test(
    'Telegram callback привязан к браузеру, PKCE и одноразовому state',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const config = {
            clientId: '1234',
            clientSecret: 'fixture',
            origin: 'https://cases.example',
        };
        let userId = '';
        try {
            await migrate(sql);
            const flow = await beginTelegramLogin(sql, config);
            const url = new URL(flow.url);
            assert.equal(url.origin, 'https://oauth.telegram.org');
            assert.equal(
                url.searchParams.get('redirect_uri'),
                'https://cases.example/auth/telegram/callback',
            );
            assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
            await assert.rejects(
                completeTelegramLogin(sql, config, {
                    state: flow.state,
                    cookieState: 'wrong-browser',
                    code: 'unused',
                }),
            );
            const { privateKey, publicKey } = await generateKeyPair('RS256');
            userId = await upsertTelegramUser(sql, '900000000007', 'Ada');
            const token = await new SignJWT({ id: '900000000007', name: 'Ada' })
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuer('https://oauth.telegram.org')
                .setAudience('1234')
                .setSubject('oidc-sub')
                .setIssuedAt()
                .setExpirationTime('5m')
                .sign(privateKey);
            const webUserId = await completeTelegramLogin(
                sql,
                config,
                { state: flow.state, cookieState: flow.state, code: 'code' },
                async (_config, code, verifier) => {
                    assert.equal(code, 'code');
                    assert.equal(
                        createHash('sha256')
                            .update(verifier)
                            .digest('base64url'),
                        url.searchParams.get('code_challenge'),
                    );
                    return token;
                },
                async () => publicKey,
            );
            assert.equal(
                webUserId,
                userId,
                'web login preserves the existing Telegram account',
            );
            await assert.rejects(
                completeTelegramLogin(sql, config, {
                    state: flow.state,
                    cookieState: flow.state,
                    code: 'code',
                }),
            );
        } finally {
            if (userId) await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
