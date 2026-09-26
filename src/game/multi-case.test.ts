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
import { caseCatalog, findCase, itemLabel } from './catalog';
import { simulatedChancePercent } from './simulation';

test('каталог содержит пять кейсов, исходные названия, нужные группы и различимые фазы ножей', () => {
    assert.equal(caseCatalog.length, 5);
    const expected: Record<string, [number[], string]> = {
        'crate-4061': [
            [5, 4, 3, 2],
            "Glock-18 | Catacombs;M249 | System Lock;MP9 | Deadly Poison;SCAR-20 | Grotto;XM1014 | Quicksilver;Dual Berettas | Urban Shock;Desert Eagle | Naga;MAC-10 | Malachite;Sawed-Off | Serenity;AK-47 | Cartel;M4A4 | 龍王 (Dragon King);P250 | Muertos;AWP | Man-o'-war;Galil AR | Chatterbox",
        ],
        'crate-4089': [
            [6, 4, 3, 2],
            "AK-47 | Elite Build;MP7 | Armor Core;Desert Eagle | Bronze Deco;P250 | Valence;Negev | Man-o'-war;Sawed-Off | Origami;AWP | Worm God;MAG-7 | Heat;CZ75-Auto | Pole Position;UMP-45 | Grand Prix;Five-SeveN | Monkey Business;Galil AR | Eco;FAMAS | Djinn;M4A1-S | Hyper Beast;MAC-10 | Neon Rider",
        ],
        'crate-4351': [
            [7, 5, 3, 2],
            'PP-Bizon | Jungle Slipstream;SCAR-20 | Blueprint;Desert Eagle | Oxide Blaze;Five-SeveN | Capillary;MP7 | Akoben;P250 | Ripple;Sawed-Off | Zander;Galil AR | Crimson Tsunami;M249 | Emerald Poison Dart;MAC-10 | Last Dive;UMP-45 | Scaffold;XM1014 | Seasons;AWP | Fever Dream;CZ75-Auto | Xiangliu;M4A1-S | Decimator;AK-47 | Bloodsport;USP-S | Neo-Noir',
        ],
        'crate-4403': [
            [7, 5, 3, 2],
            'Sawed-Off | Morris;AUG | Triqua;G3SG1 | Hunter;Glock-18 | Off World;MAC-10 | Oceanic;Tec-9 | Cracked Opal;SCAR-20 | Jungle Slipstream;MP9 | Goo;SG 553 | Phantom;CZ75-Auto | Tacticat;UMP-45 | Exposure;XM1014 | Ziggy;PP-Bizon | High Roller;M4A1-S | Leaded Glass;R8 Revolver | Llama Cannon;AK-47 | The Empress;P250 | See Ya Later',
        ],
    };
    for (const [id, [tiers, names]] of Object.entries(expected)) {
        const item = findCase(id)!;
        assert.deepEqual(
            item.drops.map((drop) => drop.name),
            names.split(';'),
        );
        assert.deepEqual(
            ['Mil-Spec Grade', 'Restricted', 'Classified', 'Covert'].map(
                (rarity) =>
                    item.drops.filter((drop) => drop.rarity === rarity).length,
            ),
            tiers,
        );
        assert.equal(item.rareDrops.length, 60);
        const models = [
            ...new Set(item.rareDrops.map((drop) => drop.name.split(' | ')[0])),
        ].sort();
        assert.deepEqual(
            models,
            (id === 'crate-4061' || id === 'crate-4089'
                ? [
                      '★ Bayonet',
                      '★ Flip Knife',
                      '★ Gut Knife',
                      '★ Karambit',
                      '★ M9 Bayonet',
                  ]
                : [
                      '★ Bowie Knife',
                      '★ Butterfly Knife',
                      '★ Falchion Knife',
                      '★ Huntsman Knife',
                      '★ Shadow Daggers',
                  ]
            ).sort(),
        );
        for (const model of models) {
            const variants = item.rareDrops.filter(
                (drop) => drop.name === `${model} | Doppler`,
            );
            assert.deepEqual(variants.map((drop) => drop.phase).sort(), [
                'Black Pearl',
                'Phase 1',
                'Phase 2',
                'Phase 3',
                'Phase 4',
                'Ruby',
                'Sapphire',
            ]);
            assert.equal(new Set(variants.map(itemLabel)).size, 7);
        }
        const drops = [...item.drops, ...item.rareDrops];
        assert.equal(new Set(drops.map((drop) => drop.id)).size, drops.length);
        assert.ok(
            drops.every(
                (drop) =>
                    new URL(drop.image).origin ===
                    'https://community.akamai.steamstatic.com',
            ),
        );
        assert.ok(
            Math.abs(
                drops.reduce(
                    (sum, drop) => sum + simulatedChancePercent(item, drop.id),
                    0,
                ) - 100,
            ) < 1e-8,
        );
    }
    assert.deepEqual(
        findCase('crate-4061')!.rareDrops.map((item) => item.id),
        findCase('crate-4089')!.rareDrops.map((item) => item.id),
    );
    assert.deepEqual(
        findCase('crate-4351')!.rareDrops.map((item) => item.id),
        findCase('crate-4403')!.rareDrops.map((item) => item.id),
    );
});

test(
    'разные кейсы делят один лимит и сохраняют происхождение, повтор UUID не меняет кейс',
    { skip: !process.env.TEST_PG_SOCKET },
    async () => {
        const sql = postgres({
            path: process.env.TEST_PG_SOCKET,
            database: 'cases_test',
            user: process.env.USER,
            onnotice() {},
        });
        let userId = '';
        try {
            await migrate(sql);
            userId = await upsertTelegramUser(
                sql,
                '900000000099',
                'Cases fixture',
            );
            const requestId = randomUUID();
            const first = await openCaseForUser(
                sql,
                userId,
                'crate-4061',
                requestId,
                () => 0,
            );
            assert.equal(first.drop.name, 'Glock-18 | Catacombs');
            assert.deepEqual(
                (await openCaseForUser(sql, userId, 'crate-4061', requestId))
                    .drop,
                first.drop,
            );
            await assert.rejects(
                openCaseForUser(sql, userId, 'crate-4351', requestId),
            );
            const attempts = await Promise.allSettled(
                Array.from({ length: 8 }, (_, index) =>
                    openCaseForUser(
                        sql,
                        userId,
                        caseCatalog[index % 5].id,
                        randomUUID(),
                        () => 0,
                    ),
                ),
            );
            assert.equal(
                attempts.filter((attempt) => attempt.status === 'fulfilled')
                    .length,
                4,
            );
            const collection = await getCollection(sql, userId);
            assert.equal(collection.length, 5);
            for (const entry of collection) {
                assert.ok(
                    findCase(entry.caseId)!.drops.some(
                        (drop) => drop.id === entry.itemId,
                    ),
                );
            }
            await assert.rejects(
                openCaseForUser(sql, userId, 'crate-4403', randomUUID()),
                /Лимит 5/,
            );
        } finally {
            if (userId) await sql`delete from app_users where id = ${userId}`;
            await sql.end();
        }
    },
);
