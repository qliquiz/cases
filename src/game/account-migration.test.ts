import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import {
    getCollection,
    getDailyRemaining,
    getSession,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

const socket = process.env.TEST_PG_SOCKET;
test(
    'миграция сохраняет старые сессии, коллекцию и использованный лимит; повторный запуск безопасен',
    { skip: !socket },
    async () => {
        const schema = 'migration_' + randomUUID().replaceAll('-', '');
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
            max: 1,
            onnotice: () => {},
        });
        try {
            await sql.unsafe('create schema ' + schema);
            await sql.unsafe('set search_path to ' + schema);
            await sql.unsafe(await readFile('db/schema.sql', 'utf8')).simple();
            const token = 'a'.repeat(43);
            await sql`insert into app_users (telegram_id, first_name) values (42, 'Ada')`;
            await sql`insert into sessions (token_hash, telegram_id, expires_at)
            values (${createHash('sha256').update(token).digest('hex')}, 42, now() + interval '1 day')`;
            const openingId = randomUUID();
            const drop = featuredCase.drops[0];
            await sql`insert into openings (id, telegram_id, request_id, case_id, item_id, item_snapshot, drop_table_version)
            values (${openingId}, 42, ${randomUUID()}, ${featuredCase.id}, ${drop.id}, ${sql.json(drop)}, 'kilowatt-sim-v1')`;
            await sql`insert into inventory_items (id, opening_id, telegram_id, item_id)
            values (${randomUUID()}, ${openingId}, 42, ${drop.id})`;
            await migrate(sql);
            await migrate(sql);
            const userId = await upsertTelegramUser(sql, '42', 'Ada');
            assert.equal((await getSession(sql, token))?.userId, userId);
            assert.equal(await getDailyRemaining(sql, userId), 9);
            assert.equal(
                (await getCollection(sql, userId))[0].item.name,
                'Dual Berettas | Hideout',
            );
        } finally {
            await sql.unsafe('set search_path to public');
            await sql.unsafe('drop schema if exists ' + schema + ' cascade');
            await sql.end();
        }
    },
);
