import assert from 'node:assert/strict';
import { test } from 'node:test';

import { featuredCase } from './catalog';
import { duplicateSelection } from './craft-selection';

test('автоподбор оставляет одну доступную копию каждого вида и не берёт потраченные', () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        caseId: featuredCase.id,
        itemId: featuredCase.drops[0].id,
        consumedAt: i === 11 ? 'spent' : null,
    }));
    assert.deepEqual(duplicateSelection(entries, [], 'Mil-Spec Grade', ''), [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
    ]);
    assert.deepEqual(
        duplicateSelection(entries.slice(0, 2), ['0'], 'Mil-Spec Grade', ''),
        ['0'],
    );
    assert.deepEqual(duplicateSelection(entries, [], 'Restricted', ''), []);
    assert.deepEqual(
        duplicateSelection(entries, [], 'Mil-Spec Grade', 'other'),
        [],
    );
});
