import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';
import { createReel } from './reel';

test('лента всегда останавливается на выбранном сервером предмете', () => {
    const winner = featuredCase.drops[8];
    const reel = createReel(featuredCase, winner, () => 0);

    assert.equal(reel.items.length, 42);
    assert.equal(reel.winnerIndex, 36);
    assert.equal(reel.items[35], featuredCase.drops[0]);
    assert.equal(reel.items[36], winner);
    assert.equal(reel.items[37], featuredCase.drops[0]);
});

test('лента отклоняет отсутствующий в каталоге результат', () => {
    assert.throws(
        () =>
            createReel(
                featuredCase,
                { ...featuredCase.drops[0], id: 'missing' },
                () => 0,
            ),
        /нет в кейсе/,
    );
});
