import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import * as store from '../server/store';
import { featuredCase } from './catalog';

test(
    '10 попыток и повторный серверный сброс сохраняют историю, UUID и чужой лимит',
    { skip: !process.env.TEST_PG_SOCKET },
    async () => {
        const sql = postgres({
            path: process.env.TEST_PG_SOCKET,
            database: 'cases_test',
            user: process.env.USER,
            onnotice() {},
        });
        const users: string[] = [];
        try {
            await migrate(sql);
            const user = await store.upsertTelegramUser(
                sql,
                '900000000110',
                'Reset fixture',
            );
            const other = await store.upsertTelegramUser(
                sql,
                '900000000111',
                'Other fixture',
            );
            users.push(user, other);
            assert.equal(await store.getDailyRemaining(sql, user), 10);
            const original = randomUUID();
            await store.openCaseForUser(
                sql,
                user,
                featuredCase.id,
                original,
                () => 0,
            );
            await store.openCaseForUser(
                sql,
                other,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            for (let cycle = 0; cycle < 2; cycle++) {
                const attempts = await Promise.allSettled(
                    Array.from({ length: 12 }, () =>
                        store.openCaseForUser(
                            sql,
                            user,
                            featuredCase.id,
                            randomUUID(),
                            () => 0,
                        ),
                    ),
                );
                assert.equal(
                    attempts.filter((result) => result.status === 'fulfilled')
                        .length,
                    cycle === 0 ? 9 : 10,
                );
                assert.equal(await store.getDailyRemaining(sql, user), 0);
                await store.resetOpeningLimit(sql, user);
                assert.equal(await store.getDailyRemaining(sql, user), 10);
                const replay = await store.openCaseForUser(
                    sql,
                    user,
                    featuredCase.id,
                    original,
                );
                assert.equal(replay.remaining, 10);
                assert.equal(
                    (await store.getCollection(sql, user)).length,
                    (cycle + 1) * 10,
                );
                assert.equal(await store.getDailyRemaining(sql, other), 9);
            }
            await store.openCaseForUser(
                sql,
                user,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            assert.equal(await store.getDailyRemaining(sql, user), 9);
            await store.resetOpeningLimit(sql, user);
            await store.resetOpeningLimit(sql, user);
            assert.equal(await store.getDailyRemaining(sql, user), 10);
            assert.equal((await store.getCollection(sql, user)).length, 21);
            await sql`update openings set opened_at = (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') - interval '1 second' where user_id = ${user}`;
            await sql`update app_users set quota_reset_day = (now() at time zone 'UTC')::date - 1 where id = ${user}`;
            assert.equal(await store.getDailyRemaining(sql, user), 10);
            await store.openCaseForUser(
                sql,
                user,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            assert.equal(await store.getDailyRemaining(sql, user), 9);
            await Promise.all([
                store.resetOpeningLimit(sql, user),
                store.openCaseForUser(
                    sql,
                    user,
                    featuredCase.id,
                    randomUUID(),
                    () => 0,
                ),
            ]);
            // Both serial orders are valid: opening then reset => 10, reset then opening => 9.
            assert.ok(
                [9, 10].includes(await store.getDailyRemaining(sql, user)),
            );
            assert.equal((await store.getCollection(sql, user)).length, 23);
        } finally {
            for (const user of users)
                await sql`delete from app_users where id = ${user}`;
            await sql.end();
        }
    },
);
