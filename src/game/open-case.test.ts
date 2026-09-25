import assert from 'node:assert/strict';
import { test } from 'node:test';

import { demoCase, totalWeight } from './catalog';
import { openVirtualCase } from './open-case';

test('веса демо-кейса составляют ровно 100%', () => {
    assert.equal(totalWeight, 10_000);
});

test('каждый диапазон билетов выбирает ожидаемый предмет', () => {
    const samples = [
        [0, 'slate'],
        [6499, 'slate'],
        [6500, 'copper'],
        [8999, 'copper'],
        [9000, 'orchid'],
        [9799, 'orchid'],
        [9800, 'solar'],
        [9979, 'solar'],
        [9980, 'nova'],
        [9999, 'nova'],
    ] as const;

    for (const [ticket, expectedId] of samples) {
        assert.equal(openVirtualCase(demoCase.id, () => ticket).id, expectedId);
    }
});

test('неизвестный кейс и некорректный билет отклоняются', () => {
    assert.throws(
        () => openVirtualCase('unknown', () => 0),
        /Неизвестный кейс/,
    );
    assert.throws(
        () => openVirtualCase(demoCase.id, () => totalWeight),
        /Некорректный/,
    );
});
