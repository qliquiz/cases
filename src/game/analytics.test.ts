import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import { getAnalyticsReport, recordActivity } from '../server/analytics';

const socket = process.env.TEST_PG_SOCKET;

test(
    'аналитика: миграция повторяема, события ограничены типом и одним событием в день на аккаунт',
    { skip: !socket },
    async () => {
        const schema = 'analytics_' + randomUUID().replaceAll('-', '');
        const sql = postgres({
            path: socket,
            port: Number(process.env.TEST_PG_PORT ?? 5432),
            database: 'cases_test',
            user: process.env.USER,
            max: 1,
            onnotice() {},
        });
        try {
            await sql.unsafe('create schema ' + schema);
            await sql.unsafe('set search_path to ' + schema);
            await migrate(sql);
            await migrate(sql);
            const [table] =
                await sql`select to_regclass('analytics_daily')::text as name`;
            assert.equal(table.name, 'analytics_daily');
            const [user] =
                await sql`insert into app_users (first_name) values ('Test') returning id`;
            await sql`insert into analytics_daily (user_id, event) values (${user.id}, 'visit') on conflict do nothing`;
            await sql`insert into analytics_daily (user_id, event) values (${user.id}, 'visit') on conflict do nothing`;
            const [count] =
                await sql`select count(*)::int as total from analytics_daily`;
            assert.equal(count.total, 1);
            await assert.rejects(
                sql`insert into analytics_daily (user_id, event) values (${user.id}, 'made_up')`,
            );
            await sql`delete from app_users where id = ${user.id}`;
            assert.equal((await sql`select * from analytics_daily`).length, 0);
        } finally {
            await sql.unsafe('set search_path to public');
            await sql.unsafe('drop schema if exists ' + schema + ' cascade');
            await sql.end();
        }
    },
);

test(
    'отчёт: первые открытия без дублей, точные D1/D7 и только завершённые дни',
    { skip: !socket },
    async () => {
        const schema = 'analytics_' + randomUUID().replaceAll('-', '');
        const sql = postgres({
            path: socket,
            database: 'cases_test',
            user: process.env.USER,
            max: 1,
            onnotice() {},
        });
        try {
            await sql.unsafe('create schema ' + schema);
            await sql.unsafe('set search_path to ' + schema);
            await migrate(sql);
            await sql`update schema_migrations set applied_at = '2026-09-01T00:00:00Z' where version = '004-analytics'`;
            const users =
                await sql`insert into app_users (first_name) values ('A'), ('B'), ('C'), ('Old') returning id`;
            for (const [index, date] of [
                '2026-09-02',
                '2026-09-02',
                '2026-09-09',
                '2026-08-31',
            ].entries()) {
                await sql`insert into openings (id, user_id, request_id, case_id, item_id, drop_table_version, opened_at)
                values (${randomUUID()}, ${users[index].id}, ${randomUUID()}, 'crate-4904', 'test', 'test', ${date + 'T23:59:00Z'})`;
            }
            // A returns D1 via collection view and D7 via a saved opening, B only D2.
            await sql`insert into analytics_daily (user_id, day, event) values
            (${users[0].id}, '2026-09-03', 'collection_view'),
            (${users[1].id}, '2026-09-04', 'visit'),
            (${users[2].id}, '2026-09-10', 'visit')`;
            await sql`insert into openings (id, user_id, request_id, case_id, item_id, drop_table_version, opened_at)
            values (${randomUUID()}, ${users[0].id}, ${randomUUID()}, 'crate-4904', 'test', 'test', '2026-09-09T00:00:00Z')`;
            const report = await getAnalyticsReport(
                sql,
                new Date('2026-09-10T12:00:00Z'),
            );
            const cohort = report.days.find((row) => row.day === '2026-09-02')!;
            assert.equal(cohort.firstOpeners, 2);
            assert.equal(cohort.d1Eligible, 2);
            assert.equal(cohort.d1Returned, 1);
            assert.equal(cohort.d7Eligible, 2);
            assert.equal(cohort.d7Returned, 1);
            const yesterday = report.days.find(
                (row) => row.day === '2026-09-09',
            )!;
            assert.equal(yesterday.firstOpeners, 1);
            assert.equal(yesterday.openings, 2);
            assert.equal(yesterday.activeUsers, 2);
            assert.equal(yesterday.d1Eligible, 0, 'today has not finished');
            assert.equal(yesterday.d1Returned, 0);
            assert.equal(
                report.days.find((row) => row.day === '2026-09-03')!
                    .collectionViewers,
                1,
            );
            assert.equal(report.days.length, 10);
            assert.equal(
                report.days.reduce((sum, row) => sum + row.firstOpeners, 0),
                3,
                'legacy first opening is not a new cohort',
            );
            await Promise.all(
                Array.from({ length: 10 }, () =>
                    recordActivity(sql, users[0].id, 'visit'),
                ),
            );
            const [today] =
                await sql`select count(*)::int as total from analytics_daily where user_id = ${users[0].id} and day = (now() at time zone 'UTC')::date and event = 'visit'`;
            assert.equal(today.total, 1);
        } finally {
            await sql.unsafe('set search_path to public');
            await sql.unsafe('drop schema if exists ' + schema + ' cascade');
            await sql.end();
        }
    },
);
