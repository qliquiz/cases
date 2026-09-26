import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { generateKeyPair, SignJWT } from 'jose';
import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import {
    beginTelegramLogin,
    completeTelegramLogin,
} from '../server/telegram-flow';

const socket = process.env.TEST_PG_SOCKET;
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
            const token = await new SignJWT({ id: 900000000007, name: 'Ada' })
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuer('https://oauth.telegram.org')
                .setAudience('1234')
                .setSubject('oidc-sub')
                .setIssuedAt()
                .setExpirationTime('5m')
                .sign(privateKey);
            userId = await completeTelegramLogin(
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
            assert.match(userId, /^[0-9a-f-]{36}$/);
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
