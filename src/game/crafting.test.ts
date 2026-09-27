import assert from 'node:assert/strict';
import { test } from 'node:test';

import { caseCatalog, featuredCase } from './catalog';
import { drawCraft, previewCraft } from './crafting';

test('10 розовых Kilowatt дают ровно два красных результата по 50%', () => {
    const item = featuredCase.drops.find((x) => x.rarity === 'Classified')!;
    const inputs = Array.from({ length: 10 }, () => ({
        caseId: featuredCase.id,
        itemId: item.id,
    }));
    const preview = previewCraft(inputs);
    assert.deepEqual(
        preview.map((x) => [x.item.name, x.probability]),
        [
            ['AWP | Chrome Cannon', 0.5],
            ['AK-47 | Inheritance', 0.5],
        ],
    );
    assert.equal(drawCraft(inputs, () => 0).item.name, 'AWP | Chrome Cannon');
    assert.equal(
        drawCraft(inputs, (max) => max - 1).item.name,
        'AK-47 | Inheritance',
    );
});

test('смесь коллекций распределяет шансы по доле входов, а несовместимые контракты отклоняются', () => {
    const blue = (pool: typeof featuredCase) => ({
        caseId: pool.id,
        itemId: pool.drops[0].id,
    });
    const inputs = [
        ...Array.from({ length: 6 }, () => blue(featuredCase)),
        ...Array.from({ length: 4 }, () => blue(caseCatalog[1])),
    ];
    const outcomes = previewCraft(inputs);
    assert.equal(outcomes.length, 9);
    assert.deepEqual(
        outcomes.map((x) => x.probability),
        [0.12, 0.12, 0.12, 0.12, 0.12, 0.1, 0.1, 0.1, 0.1],
    );
    assert.ok(
        Math.abs(outcomes.reduce((sum, x) => sum + x.probability, 0) - 1) <
            1e-12,
    );
    assert.throws(() => previewCraft(inputs.slice(1)), /ровно 10/);
    assert.throws(
        () =>
            previewCraft([
                ...inputs.slice(1),
                {
                    caseId: featuredCase.id,
                    itemId: featuredCase.drops.find(
                        (x) => x.rarity === 'Restricted',
                    )!.id,
                },
            ]),
        /одной редкости/,
    );
    for (const itemId of [
        'unknown',
        featuredCase.rareDrops[0].id,
        featuredCase.drops.find((x) => x.rarity === 'Covert')!.id,
    ])
        assert.throws(
            () =>
                previewCraft(
                    Array.from({ length: 10 }, () => ({
                        caseId: featuredCase.id,
                        itemId,
                    })),
                ),
            /нельзя/,
        );
    assert.throws(() => drawCraft(inputs, () => -1), /генератора/);
});
