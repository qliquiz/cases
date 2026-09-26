import assert from 'node:assert/strict';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import { upsertTelegramUser } from '../server/store';

const socket = process.env.TEST_PG_SOCKET;
test(
    'Telegram создаёт независимый UUID аккаунта и возвращает его при повторном входе',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        let userId: string | undefined;
        try {
            await migrate(sql);
            userId = await upsertTelegramUser(sql, '900000000005', 'Ada');
            assert.match(userId!, /^[0-9a-f-]{36}$/);
            assert.equal(
                await upsertTelegramUser(sql, '900000000005', 'Ada'),
                userId,
            );
        } finally {
            if (userId) await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
