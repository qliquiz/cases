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
    'повтор запроса не выдаёт второй предмет, а шестое открытие за день отклоняется',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const telegramId = '900000000002';
        try {
            await sql.unsafe(await readFile('db/schema.sql', 'utf8')).simple();
            await upsertTelegramUser(sql, telegramId, 'Ada');

            const requestIds = Array.from({ length: 6 }, () => randomUUID());
            const first = await openCaseForUser(
                sql,
                telegramId,
                featuredCase.id,
                requestIds[0],
                () => 0,
            );
            const repeated = await openCaseForUser(
                sql,
                telegramId,
                featuredCase.id,
                requestIds[0],
                () => 9999,
            );
            assert.equal(repeated.drop.id, first.drop.id);
            assert.equal((await getCollection(sql, telegramId)).length, 1);

            for (const id of requestIds.slice(1, 5)) {
                await openCaseForUser(
                    sql,
                    telegramId,
                    featuredCase.id,
                    id,
                    () => 0,
                );
            }
            await assert.rejects(
                openCaseForUser(
                    sql,
                    telegramId,
                    featuredCase.id,
                    requestIds[5],
                    () => 0,
                ),
                /Лимит 5 открытий/,
            );
            assert.equal((await getCollection(sql, telegramId)).length, 5);
        } finally {
            await sql`delete from app_users where telegram_id = ${telegramId}`;
            await sql.end();
        }
    },
);
