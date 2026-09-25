import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import postgres from 'postgres';

import {
    getCollection,
    openCaseForUser,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

const socket = process.env.TEST_PG_SOCKET;

test(
    'параллельные запросы не обходят суточный лимит',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const telegramId = '900000000003';
        try {
            await sql.unsafe(await readFile('db/schema.sql', 'utf8')).simple();
            await upsertTelegramUser(sql, telegramId, 'Ada');
            const results = await Promise.allSettled(
                Array.from({ length: 7 }, () =>
                    openCaseForUser(
                        sql,
                        telegramId,
                        featuredCase.id,
                        randomUUID(),
                        () => 0,
                    ),
                ),
            );
            assert.equal(
                results.filter((result) => result.status === 'fulfilled')
                    .length,
                5,
            );
            assert.equal((await getCollection(sql, telegramId)).length, 5);
        } finally {
            await sql`delete from app_users where telegram_id = ${telegramId}`;
            await sql.end();
        }
    },
);
