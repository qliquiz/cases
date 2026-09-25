import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';

test('Kilowatt Case содержит точный список обычных и редких предметов', () => {
    assert.equal(featuredCase.id, 'crate-4904');
    assert.equal(featuredCase.name, 'Kilowatt Case');
    assert.equal(featuredCase.drops.length, 17);
    assert.equal(featuredCase.rareDrops.length, 13);
    assert.equal(featuredCase.drops[0].name, 'Dual Berettas | Hideout');
    assert.equal(featuredCase.drops.at(-1)?.name, 'AK-47 | Inheritance');
    assert.equal(featuredCase.rareDrops[0].name, '★ Kukri Knife');
    assert.equal(
        new Set(
            [...featuredCase.drops, ...featuredCase.rareDrops].map(
                (item) => item.id,
            ),
        ).size,
        30,
    );
    assert.ok(
        [...featuredCase.drops, ...featuredCase.rareDrops].every((item) =>
            item.image.startsWith(
                'https://community.akamai.steamstatic.com/economy/image/',
            ),
        ),
    );
});
