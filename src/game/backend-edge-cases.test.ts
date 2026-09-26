import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';
import { createElement } from 'react';

import { migrate } from '../../scripts/migrations.mjs';
import { CollectionPanel } from '../app/collection-panel';
import {
    createSession,
    getCollection,
    getSession,
    openCaseForUser,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';
import { renderToStaticMarkup } from './render-ui';

const socket = process.env.TEST_PG_SOCKET;

test('лимит можно сбросить до 10 без перезагрузки Mini App', () => {
    const html = renderToStaticMarkup(
        createElement(CollectionPanel, {
            collection: [],
            remaining: 0,
            onRefresh: () => {},
        }),
    );
    assert.match(html, /Сбросить лимит/);
    assert.match(html, /из 10 открытий/);
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
        let userId = '';
        try {
            await migrate(sql);
            userId = await upsertTelegramUser(sql, telegramId, 'Ada');
            const tokens = [];
            for (let index = 0; index < 7; index++) {
                tokens.push(await createSession(sql, userId));
            }
            assert.equal(await getSession(sql, tokens[0]), null);
            assert.equal((await getSession(sql, tokens[6]))?.userId, userId);
            const sessionRows = await sql<{ count: number }[]>`
                select count(*)::int as count from sessions
                where user_id = ${userId}
            `;
            assert.ok(sessionRows[0].count <= 5);

            const requestId = randomUUID();
            const first = await openCaseForUser(
                sql,
                userId,
                featuredCase.id,
                requestId,
                () => 0,
            );
            const rows = await sql<{ item_snapshot: unknown }[]>`
                select item_snapshot from openings
                where user_id = ${userId} and request_id = ${requestId}
            `;
            assert.deepEqual(rows[0].item_snapshot, first.drop);
            const repeated = await openCaseForUser(
                sql,
                userId,
                featuredCase.id,
                requestId,
            );
            assert.deepEqual(repeated.drop, first.drop);
            const collection = await getCollection(sql, userId);
            assert.deepEqual(collection[0].item, first.drop);
        } finally {
            await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
