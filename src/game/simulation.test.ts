import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';
import { simulatedChancePercent } from './simulation';

test('на странице можно показать неофициальный шанс каждого предмета', () => {
    assert.equal(
        simulatedChancePercent(featuredCase, featuredCase.drops[0].id).toFixed(
            3,
        ),
        '11.417',
    );
    assert.equal(
        simulatedChancePercent(featuredCase, featuredCase.drops[7].id).toFixed(
            3,
        ),
        '3.196',
    );
    assert.equal(
        simulatedChancePercent(
            featuredCase,
            featuredCase.rareDrops[0].id,
        ).toFixed(3),
        '0.020',
    );
});

test('невозможно показать шанс несуществующего предмета', () => {
    assert.throws(
        () => simulatedChancePercent(featuredCase, 'missing'),
        /нет в кейсе/,
    );
});
