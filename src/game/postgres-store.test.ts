import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
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
        let userId = '';
        try {
            await migrate(sql);
            userId = await upsertTelegramUser(sql, telegramId, 'Ada');
            const token = await createSession(sql, userId);
            assert.equal((await getSession(sql, token))?.userId, userId);

            const opened = await openCaseForUser(
                sql,
                userId,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            assert.equal(opened.drop.name, 'Dual Berettas | Hideout');
            assert.equal(opened.remaining, 4);

            const collection = await getCollection(sql, userId);
            assert.equal(collection.length, 1);
            assert.equal(collection[0].itemId, opened.drop.id);
        } finally {
            await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
