import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import { craftForUser, getCraftHistory } from '../server/crafting';
import { getLeaderboard } from '../server/leaderboard';
import {
    getCollection,
    getDailyRemaining,
    openCaseForUser,
    resetOpeningLimit,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

test(
    'крафт расходует 10 копий один раз, сохраняет альбом, добавляет очко и не тратит лимит кейсов',
    { skip: !process.env.TEST_PG_SOCKET },
    async () => {
        const schema = 'craft_' + randomUUID().replaceAll('-', '');
        const sql = postgres({
            path: process.env.TEST_PG_SOCKET,
            database: 'cases_test',
            user: process.env.USER,
            max: 1,
            onnotice() {},
        });
        try {
            await sql.unsafe('create schema ' + schema);
            await sql.unsafe('set search_path to ' + schema);
            await migrate(sql);
            const user = await upsertTelegramUser(
                sql,
                '900000009101',
                'Craft fixture',
            );
            for (let i = 0; i < 10; i++)
                await openCaseForUser(
                    sql,
                    user,
                    featuredCase.id,
                    randomUUID(),
                    () => 0,
                );
            const before = await getCollection(sql, user);
            const ids = before.map((x) => x.id);
            const request = randomUUID();
            await assert.rejects(
                craftForUser(sql, user, [...ids.slice(1), ids[1]], request),
                /несколько раз/,
            );
            await assert.rejects(
                craftForUser(sql, user, ids.slice(1), request),
                /ровно 10/,
            );
            await assert.rejects(craftForUser(sql, user, ids, 'invalid'), /ID/);
            await assert.rejects(
                craftForUser(
                    sql,
                    user,
                    [...ids.slice(1), randomUUID()],
                    request,
                ),
                /недоступны/,
            );
            const other = await upsertTelegramUser(
                sql,
                '900000009102',
                'Other',
            );
            await assert.rejects(
                craftForUser(sql, other, ids, request),
                /недоступны/,
            );
            await assert.rejects(
                craftForUser(sql, user, ids, request, () => {
                    throw new Error('rng offline');
                }),
                /rng offline/,
            );
            assert.equal(
                (await getCollection(sql, user)).filter((x) => !x.consumedAt)
                    .length,
                10,
            );
            assert.equal((await getCraftHistory(sql, user)).length, 0);
            // Fail after the craft record and consumption update, at output insertion.
            await sql.unsafe(`create function reject_craft_output() returns trigger language plpgsql as $$
            begin raise exception 'fixture output unavailable'; end $$`);
            await sql.unsafe(`create trigger reject_craft_output before insert on inventory_items
            for each row when (new.craft_id is not null) execute function reject_craft_output()`);
            await assert.rejects(
                craftForUser(sql, user, ids, request, () => 0),
                /fixture output unavailable/,
            );
            assert.equal(
                (await getCollection(sql, user)).filter((x) => !x.consumedAt)
                    .length,
                10,
            );
            assert.equal((await getCraftHistory(sql, user)).length, 0);
            await sql.unsafe(
                'drop trigger reject_craft_output on inventory_items',
            );
            await sql.unsafe('drop function reject_craft_output()');
            const result = await craftForUser(sql, user, ids, request, () => 0);
            assert.equal(result.item.rarity, 'Restricted');
            const after = await getCollection(sql, user);
            assert.equal(
                after.length,
                11,
                'lifetime album retains all acquisitions',
            );
            assert.equal(after.filter((x) => !x.consumedAt).length, 1);
            assert.equal(
                (await getLeaderboard(sql, user)).mine?.uniqueItems,
                2,
            );
            assert.equal((await getLeaderboard(sql, user)).mine?.openings, 10);
            assert.equal(await getDailyRemaining(sql, user), 0);
            assert.deepEqual(
                await craftForUser(sql, user, [...ids].reverse(), request),
                result,
            );
            assert.equal((await getCraftHistory(sql, user)).length, 1);
            await assert.rejects(
                craftForUser(
                    sql,
                    user,
                    [...ids.slice(1), randomUUID()],
                    request,
                ),
                /другого набора/,
            );
            await assert.rejects(
                craftForUser(sql, user, ids, randomUUID()),
                /недоступны/,
            );
            await migrate(sql);
            assert.equal((await getCollection(sql, user)).length, 11);
            // Independent database connections exercise the real user/row locks.
            const concurrent = postgres({
                path: process.env.TEST_PG_SOCKET,
                database: 'cases_test',
                user: process.env.USER,
                connection: { search_path: schema },
                max: 3,
                onnotice() {},
            });
            try {
                await resetOpeningLimit(sql, user);
                for (let i = 0; i < 10; i++)
                    await openCaseForUser(
                        sql,
                        user,
                        featuredCase.id,
                        randomUUID(),
                        () => 0,
                    );
                const batch = (await getCollection(sql, user))
                    .filter(
                        (x) =>
                            !x.consumedAt && x.item.rarity === 'Mil-Spec Grade',
                    )
                    .map((x) => x.id);
                const race = await Promise.allSettled([
                    craftForUser(concurrent, user, batch, randomUUID()),
                    craftForUser(concurrent, user, batch, randomUUID()),
                ]);
                assert.equal(
                    race.filter((x) => x.status === 'fulfilled').length,
                    1,
                );
                assert.equal(
                    (await getCollection(sql, user)).filter(
                        (x) => !x.consumedAt,
                    ).length,
                    2,
                );
                assert.equal((await getCraftHistory(sql, user)).length, 2);
                await resetOpeningLimit(sql, user);
                for (let i = 0; i < 8; i++) {
                    let pick = 0;
                    await openCaseForUser(
                        sql,
                        user,
                        featuredCase.id,
                        randomUUID(),
                        () => (pick++ === 0 ? 7992 : 0),
                    );
                }
                const purples = (await getCollection(sql, user))
                    .filter((x) => !x.consumedAt)
                    .map((x) => x.id);
                const sameRequest = randomUUID();
                const [first, second] = await Promise.all([
                    craftForUser(concurrent, user, purples, sameRequest),
                    craftForUser(
                        concurrent,
                        user,
                        [...purples].reverse(),
                        sameRequest,
                    ),
                ]);
                assert.deepEqual(
                    first,
                    second,
                    'concurrent exact retries return one result',
                );
                assert.equal(
                    first.item.rarity,
                    'Classified',
                    'crafted copies can be used as inputs',
                );
                assert.equal((await getCraftHistory(sql, user)).length, 3);
                assert.equal(
                    (await getCollection(sql, user)).filter(
                        (x) => !x.consumedAt,
                    ).length,
                    1,
                );
            } finally {
                await concurrent.end();
            }
        } finally {
            await sql.unsafe('set search_path to public');
            await sql.unsafe('drop schema if exists ' + schema + ' cascade');
            await sql.end();
        }
    },
);
