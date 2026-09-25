import assert from 'node:assert/strict';
import { test } from 'node:test';

import { playPreviewSound } from './reel-audio';

test('проверочный звук запускает источник сразу, пока действует жест пользователя', () => {
    const starts: number[] = [];
    const gains: number[] = [];
    const context = {
        currentTime: 12,
        destination: {},
        createOscillator() {
            return {
                type: '',
                frequency: { setValueAtTime() {} },
                connect() {},
                start(time: number) {
                    starts.push(time);
                },
                stop() {},
            };
        },
        createGain() {
            return {
                gain: {
                    setValueAtTime(value: number) {
                        gains.push(value);
                    },
                    exponentialRampToValueAtTime() {},
                },
                connect() {},
            };
        },
    } as unknown as AudioContext;

    playPreviewSound(context);

    assert.deepEqual(starts, [12]);
    assert.ok(gains[0] >= 0.12);
});
