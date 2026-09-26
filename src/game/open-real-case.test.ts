import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';
import { openVirtualCase } from './open-case';

test('виртуальное открытие Kilowatt Case выбирает предмет из нужной группы', () => {
    const samples = [
        [0, 'Dual Berettas | Hideout'],
        [7991, 'Dual Berettas | Hideout'],
        [7992, 'Glock-18 | Block-18'],
        [9589, 'Glock-18 | Block-18'],
        [9590, 'M4A1-S | Black Lotus'],
        [9909, 'M4A1-S | Black Lotus'],
        [9910, 'AWP | Chrome Cannon'],
        [9973, 'AWP | Chrome Cannon'],
        [9974, '★ Kukri Knife'],
        [9999, '★ Kukri Knife'],
    ] as const;

    for (const [ticket, expectedName] of samples) {
        const draws = [ticket, 0];
        const result = openVirtualCase(featuredCase.id, () => draws.shift()!);
        assert.equal(result.name, expectedName);
    }
});

test('Chroma и Spectrum выбирают обычные и редкие предметы из собственного состава', () => {
    const cases = [
        ['crate-4061', 'Glock-18 | Catacombs', '★ Bayonet | Marble Fade'],
        ['crate-4089', 'AK-47 | Elite Build', '★ Bayonet | Marble Fade'],
        [
            'crate-4351',
            'PP-Bizon | Jungle Slipstream',
            '★ Bowie Knife | Marble Fade',
        ],
        ['crate-4403', 'Sawed-Off | Morris', '★ Bowie Knife | Marble Fade'],
    ];
    for (const [id, regular, rare] of cases) {
        assert.equal(openVirtualCase(id, () => 0).name, regular);
        const draws = [9999, 0];
        assert.equal(openVirtualCase(id, () => draws.shift()!).name, rare);
    }
});

test('индекс предмета внутри группы выбирается отдельно', () => {
    const draws = [0, 6];
    assert.equal(
        openVirtualCase(featuredCase.id, () => draws.shift()!).name,
        'XM1014 | Irezumi',
    );
});
