import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardAtMarker } from './reel-audio';

test('событие щелчка привязано к карточке под центральной меткой', () => {
    assert.equal(cardAtMarker(500, 420, 160, 176), 0);
    assert.equal(cardAtMarker(500, 244, 160, 176), 1);
    assert.equal(cardAtMarker(500, 68, 160, 176), 2);
});
