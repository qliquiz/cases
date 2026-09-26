import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import {
    getCollection,
    openCaseForUser,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

const socket = process.env.TEST_PG_SOCKET;

test(
    'повтор запроса не выдаёт второй предмет, а одиннадцатое открытие отклоняется',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const telegramId = '900000000002';
        let userId = '';
        try {
            await migrate(sql);
            userId = await upsertTelegramUser(sql, telegramId, 'Ada');

            const requestIds = Array.from({ length: 11 }, () => randomUUID());
            const first = await openCaseForUser(
                sql,
                userId,
                featuredCase.id,
                requestIds[0],
                () => 0,
            );
            const repeated = await openCaseForUser(
                sql,
                userId,
                featuredCase.id,
                requestIds[0],
                () => 9999,
            );
            assert.equal(repeated.drop.id, first.drop.id);
            assert.equal((await getCollection(sql, userId)).length, 1);

            for (const id of requestIds.slice(1, 10)) {
                await openCaseForUser(
                    sql,
                    userId,
                    featuredCase.id,
                    id,
                    () => 0,
                );
            }
            await assert.rejects(
                openCaseForUser(
                    sql,
                    userId,
                    featuredCase.id,
                    requestIds[10],
                    () => 0,
                ),
                /Лимит 10 открытий/,
            );
            assert.equal((await getCollection(sql, userId)).length, 10);
        } finally {
            await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
