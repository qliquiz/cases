import assert from 'node:assert/strict';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import { confirmEmailCode, requestEmailCode } from '../server/email-auth';
import { authenticateIdentity } from '../server/identities';

const socket = process.env.TEST_PG_SOCKET;
const secret = 'test-only-secret-at-least-32-characters-long';
test(
    'код из письма создаёт аккаунт без пароля, одноразовый и позволяет привязать Telegram',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const email = 'ada-account@example.test';
        let sentCode = '';
        let userId = '';
        try {
            await migrate(sql);
            const token = await requestEmailCode(
                sql,
                { email, secret },
                async (to, code) => {
                    assert.equal(to, email);
                    sentCode = code;
                },
            );
            assert.match(sentCode, /^\d{6}$/);
            assert.equal(
                (await confirmEmailCode(sql, { token, code: 'wrong', secret }))
                    .ok,
                false,
            );
            const result = await confirmEmailCode(sql, {
                token,
                code: sentCode,
                secret,
            });
            assert.equal(result.ok, true);
            if (!result.ok) throw new Error('Expected successful login');
            userId = result.userId;
            assert.equal(
                (await confirmEmailCode(sql, { token, code: sentCode, secret }))
                    .ok,
                false,
            );
            assert.equal(
                await authenticateIdentity(
                    sql,
                    {
                        provider: 'telegram',
                        subject: '900000000006',
                        name: 'Ada',
                    },
                    userId,
                ),
                userId,
            );
            assert.equal(
                await authenticateIdentity(sql, {
                    provider: 'telegram',
                    subject: '900000000006',
                    name: 'Ada',
                }),
                userId,
            );
        } finally {
            await sql`delete from email_challenges where email = ${email}`.catch(
                () => {},
            );
            if (userId) await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
