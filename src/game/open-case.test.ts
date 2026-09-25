import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';
import { openVirtualCase } from './open-case';

test('неизвестный кейс отклоняется до генерации результата', () => {
    assert.throws(
        () => openVirtualCase('unknown', () => 0),
        /Неизвестный кейс/,
    );
});

test('некорректный билет или индекс предмета отклоняется', () => {
    assert.throws(
        () => openVirtualCase(featuredCase.id, () => 10_000),
        /Некорректный/,
    );
    let calls = 0;
    assert.throws(
        () =>
            openVirtualCase(featuredCase.id, (max) =>
                ++calls === 1 ? 0 : max,
            ),
        /Некорректный/,
    );
});
