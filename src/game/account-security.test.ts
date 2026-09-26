import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import { confirmEmailCode, requestEmailCode } from '../server/email-auth';
import { authenticateIdentity, IdentityConflict } from '../server/identities';
import {
    getCollection,
    getDailyRemaining,
    openCaseForUser,
} from '../server/store';
import { featuredCase } from './catalog';

const socket = process.env.TEST_PG_SOCKET;
const secret = 'test-only-secret-at-least-32-characters-long';

test(
    'код ограничен пятью попытками, сроком и исходным аккаунтом; отправка имеет cooldown',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const emails = [
            'lockout@example.test',
            'expired@example.test',
            'link@example.test',
        ];
        let userId = '';
        try {
            await migrate(sql);
            let code = '';
            const send = async (_email: string, value: string) => {
                code = value;
            };
            const token = await requestEmailCode(
                sql,
                { email: emails[0], secret },
                send,
            );
            await assert.rejects(
                requestEmailCode(sql, { email: emails[0], secret }, send),
                /Слишком много/,
            );
            for (let i = 0; i < 5; i++)
                assert.equal(
                    (
                        await confirmEmailCode(sql, {
                            token,
                            code: 'not-a-code',
                            secret,
                        })
                    ).ok,
                    false,
                );
            assert.equal(
                (await confirmEmailCode(sql, { token, code, secret })).ok,
                false,
            );

            const expired = await requestEmailCode(
                sql,
                { email: emails[1], secret },
                send,
            );
            await sql`update email_challenges set expires_at = now() - interval '1 second'
            where token_hash = ${createHash('sha256').update(expired).digest('hex')}`;
            assert.equal(
                (await confirmEmailCode(sql, { token: expired, code, secret }))
                    .ok,
                false,
            );

            userId = await authenticateIdentity(sql, {
                provider: 'telegram',
                subject: '900000000008',
                name: 'Ada',
            });
            const link = await requestEmailCode(
                sql,
                { email: emails[2], secret, linkUserId: userId },
                send,
            );
            assert.equal(
                (await confirmEmailCode(sql, { token: link, code, secret })).ok,
                false,
            );
            const results = await Promise.all(
                [1, 2].map(() =>
                    confirmEmailCode(sql, {
                        token: link,
                        code,
                        secret,
                        currentUserId: userId,
                    }),
                ),
            );
            assert.equal(results.filter((result) => result.ok).length, 1);
        } finally {
            await sql`delete from email_challenges where email in ${sql(emails)}`;
            if (userId) await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);

test(
    'привязки разделяют одну коллекцию и лимит, но чужие аккаунты не объединяются',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const users: string[] = [];
        try {
            await migrate(sql);
            const telegram = {
                provider: 'telegram' as const,
                subject: '900000000009',
                name: 'Ada',
            };
            const email = {
                provider: 'email' as const,
                subject: 'shared@example.test',
                name: 'Ada',
            };
            const user = await authenticateIdentity(sql, telegram);
            users.push(user);
            await openCaseForUser(
                sql,
                user,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            assert.equal(await authenticateIdentity(sql, email, user), user);
            const webUser = await authenticateIdentity(sql, email);
            assert.equal(webUser, user);
            assert.equal(await getDailyRemaining(sql, webUser), 9);
            assert.equal((await getCollection(sql, webUser)).length, 1);
            const other = await authenticateIdentity(sql, {
                provider: 'email',
                subject: 'other@example.test',
                name: 'Ada',
            });
            users.push(other);
            await assert.rejects(
                authenticateIdentity(sql, telegram, other),
                IdentityConflict,
            );
            assert.equal((await getCollection(sql, other)).length, 0);
            assert.equal(await authenticateIdentity(sql, telegram), user);
        } finally {
            for (const id of users)
                await sql`delete from app_users where id = ${id}`;
            await sql.end();
        }
    },
);
