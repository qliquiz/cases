import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tryPlaySound } from './reel-audio';

test('сбой аудио не превращает успешное открытие в ошибку', () => {
    const context = {} as AudioContext;
    assert.equal(
        tryPlaySound(context, () => {
            throw new Error('Audio output unavailable');
        }),
        false,
    );
});
