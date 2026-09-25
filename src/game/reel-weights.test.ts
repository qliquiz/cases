import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';
import { createReel } from './reel';

test('прокрутка не показывает редкие ножи на каждом втором кадре', () => {
    const winner = featuredCase.rareDrops[0];
    const reel = createReel(featuredCase, winner, () => 0);

    assert.equal(reel.items[reel.winnerIndex], winner);
    assert.ok(
        reel.items.every(
            (item, index) =>
                index === reel.winnerIndex || item.rarity === 'Mil-Spec Grade',
        ),
    );
});
