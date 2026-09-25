import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import postgres from 'postgres';

import {
    createSession,
    getCollection,
    getSession,
    openCaseForUser,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

const socket = process.env.TEST_PG_SOCKET;

test(
    'открытие и предмет коллекции сохраняются сервером атомарно',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const telegramId = '900000000001';
        try {
            const schema = await readFile('db/schema.sql', 'utf8');
            await sql.unsafe(schema).simple();
            await upsertTelegramUser(sql, telegramId, 'Ada');
            const token = await createSession(sql, telegramId);
            assert.equal(
                (await getSession(sql, token))?.telegramId,
                telegramId,
            );

            const opened = await openCaseForUser(
                sql,
                telegramId,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            assert.equal(opened.drop.name, 'Dual Berettas | Hideout');
            assert.equal(opened.remaining, 4);

            const collection = await getCollection(sql, telegramId);
            assert.equal(collection.length, 1);
            assert.equal(collection[0].itemId, opened.drop.id);
        } finally {
            await sql`delete from app_users where telegram_id = ${telegramId}`;
            await sql.end();
        }
    },
);
