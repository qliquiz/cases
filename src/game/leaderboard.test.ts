import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import postgres from 'postgres';

import { migrate } from '../../scripts/migrations.mjs';
import * as leaderboard from '../server/leaderboard';
import {
    openCaseForUser,
    resetOpeningLimit,
    upsertTelegramUser,
} from '../server/store';
import { featuredCase } from './catalog';

test(
    'рейтинг: уникальные предметы, общие места, редкие выпадения и явная публикация без личных данных',
    { skip: !process.env.TEST_PG_SOCKET },
    async () => {
        const schema = 'leaderboard_' + randomUUID().replaceAll('-', '');
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
            const alice = await upsertTelegramUser(
                sql,
                '900000000201',
                'private-email@example.test',
            );
            const bob = await upsertTelegramUser(
                sql,
                '900000000202',
                'PrivateName',
            );
            const hidden = await upsertTelegramUser(
                sql,
                '900000000203',
                'PrivateHidden',
            );
            assert.deepEqual(
                (await leaderboard.getLeaderboard(sql)).entries,
                [],
            );
            await leaderboard.saveLeaderboardNickname(sql, alice, 'Alice');
            await leaderboard.saveLeaderboardNickname(sql, bob, 'Боб');
            assert.equal(
                (await leaderboard.getLeaderboard(sql, alice)).mine?.rank,
                null,
            );
            for (const user of [alice, bob, hidden]) {
                await openCaseForUser(
                    sql,
                    user,
                    featuredCase.id,
                    randomUUID(),
                    () => 0,
                );
            }
            await openCaseForUser(
                sql,
                alice,
                featuredCase.id,
                randomUUID(),
                () => 0,
            );
            let result = await leaderboard.getLeaderboard(sql, alice);
            assert.equal(result.participants, 2);
            assert.deepEqual(
                result.entries.map((row) => row.rank),
                [1, 1],
            );
            assert.equal(result.mine?.uniqueItems, 1);
            assert.equal(result.mine?.openings, 2);
            let draw = 0;
            const rareRequest = randomUUID();
            await openCaseForUser(
                sql,
                alice,
                featuredCase.id,
                rareRequest,
                () => (draw++ === 0 ? 9999 : 0),
            );
            await openCaseForUser(sql, alice, featuredCase.id, rareRequest);
            await resetOpeningLimit(sql, alice);
            result = await leaderboard.getLeaderboard(sql, alice);
            assert.deepEqual(result.mine, {
                nickname: 'Alice',
                rank: 1,
                uniqueItems: 2,
                openings: 3,
                rareDrops: 1,
            });
            // The first request in a cold serverless instance must work without
            // another query warming postgres.js's array-type metadata first.
            const cold = postgres({
                path: process.env.TEST_PG_SOCKET,
                database: 'cases_test',
                user: process.env.USER,
                connection: { search_path: schema },
            });
            try {
                assert.deepEqual(
                    await leaderboard.getLeaderboard(cold, alice),
                    result,
                );
            } finally {
                await cold.end();
            }
            assert.equal(result.entries[1].rank, 2);
            assert.equal(result.entries[0].isYou, true);
            assert.doesNotMatch(
                JSON.stringify(result),
                /private-email|PrivateName|PrivateHidden|90000000020|user_id|userId/,
            );
            assert.ok(!JSON.stringify(result).includes(alice));
            await assert.rejects(
                leaderboard.saveLeaderboardNickname(sql, bob, 'alice'),
                /занят/,
            );
            for (const name of [
                '',
                'ab',
                'x'.repeat(25),
                'email@example.test',
                '<script>',
                'bad\nname',
                '123456',
            ]) {
                await assert.rejects(
                    leaderboard.saveLeaderboardNickname(sql, bob, name),
                );
            }
            await leaderboard.saveLeaderboardNickname(sql, alice, null);
            result = await leaderboard.getLeaderboard(sql, alice);
            assert.equal(result.participants, 1);
            assert.equal(result.mine?.rank, null);
            assert.equal(result.mine?.uniqueItems, 2);
            assert.equal(result.entries[0].nickname, 'Боб');
            assert.equal(result.entries[0].rank, 1);
            assert.equal((await leaderboard.getLeaderboard(sql)).mine, null);
            await leaderboard.saveLeaderboardNickname(sql, alice, 'Alice');
            for (let index = 0; index < 50; index++) {
                const user = await upsertTelegramUser(
                    sql,
                    String(900000001000 + index),
                    'private',
                );
                await leaderboard.saveLeaderboardNickname(
                    sql,
                    user,
                    `Player${String(index).padStart(2, '0')}`,
                );
                for (let item = 0; item < 3; item++) {
                    let call = 0;
                    await openCaseForUser(
                        sql,
                        user,
                        featuredCase.id,
                        randomUUID(),
                        () => (call++ === 0 ? 0 : item),
                    );
                }
            }
            result = await leaderboard.getLeaderboard(sql, alice);
            assert.equal(result.entries.length, 50);
            assert.equal(result.participants, 52);
            assert.equal(result.mine?.rank, 51);
            assert.equal(result.mine?.uniqueItems, 2);
            assert.ok(
                result.entries.every((row) => row.rank === 1 && !row.isYou),
            );
            assert.equal(result.entries[0].nickname, 'Player00');
            assert.equal(result.entries[49].nickname, 'Player49');
        } finally {
            await sql.unsafe('set search_path to public');
            await sql.unsafe('drop schema if exists ' + schema + ' cascade');
            await sql.end();
        }
    },
);
