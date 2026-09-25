import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import postgres from 'postgres';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CollectionPanel } from '../app/collection-panel';
import {
    createSession,
    getCollection,
    getSession,
    openCaseForUser,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

const socket = process.env.TEST_PG_SOCKET;

test('исчерпанный лимит можно обновить без перезагрузки Mini App', () => {
    const html = renderToStaticMarkup(
        createElement(CollectionPanel, {
            collection: [],
            remaining: 0,
            onRefresh: () => {},
        }),
    );
    assert.match(html, /Обновить лимит/);
});

test(
    'сессии ограничены, а данные предмета сохраняются при изменении каталога',
    { skip: !socket },
    async () => {
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
        });
        const telegramId = '900000000004';
        try {
            await sql.unsafe(await readFile('db/schema.sql', 'utf8')).simple();
            await upsertTelegramUser(sql, telegramId, 'Ada');
            const tokens = [];
            for (let index = 0; index < 7; index++) {
                tokens.push(await createSession(sql, telegramId));
            }
            assert.equal(await getSession(sql, tokens[0]), null);
            assert.equal(
                (await getSession(sql, tokens[6]))?.telegramId,
                telegramId,
            );
            const sessionRows = await sql<{ count: number }[]>`
                select count(*)::int as count from sessions
                where telegram_id = ${telegramId}
            `;
            assert.ok(sessionRows[0].count <= 5);

            const requestId = randomUUID();
            const first = await openCaseForUser(
                sql,
                telegramId,
                featuredCase.id,
                requestId,
                () => 0,
            );
            const rows = await sql<{ item_snapshot: unknown }[]>`
                select item_snapshot from openings
                where telegram_id = ${telegramId} and request_id = ${requestId}
            `;
            assert.deepEqual(rows[0].item_snapshot, first.drop);
            const repeated = await openCaseForUser(
                sql,
                telegramId,
                featuredCase.id,
                requestId,
            );
            assert.deepEqual(repeated.drop, first.drop);
            const collection = await getCollection(sql, telegramId);
            assert.deepEqual(collection[0].item, first.drop);
        } finally {
            await sql`delete from app_users where telegram_id = ${telegramId}`;
            await sql.end();
        }
    },
);
