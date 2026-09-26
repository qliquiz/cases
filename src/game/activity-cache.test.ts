import assert from 'node:assert/strict';
import { test } from 'node:test';

import { observeActivity } from '../browser/activity';
import { createQueryClient, resetSessionCache } from '../browser/query-cache';

test('визит не отправляется заново при возвращении на страницу, но отправляется после смены аккаунта', async () => {
    const names = ['window', 'document', 'fetch'] as const;
    const original = names.map((name) =>
        Object.getOwnPropertyDescriptor(globalThis, name),
    );
    let requests = 0;
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            setTimeout,
            clearTimeout,
            addEventListener() {},
            removeEventListener() {},
        },
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            visibilityState: 'visible',
            addEventListener() {},
            removeEventListener() {},
        },
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async () => {
            requests++;
            return new Response(null, { status: 204 });
        },
    });
    const client = createQueryClient();
    let stop = () => {};
    try {
        stop = observeActivity('visit');
        await new Promise(setImmediate);
        stop();
        stop = observeActivity('visit');
        await new Promise(setImmediate);
        assert.equal(requests, 1);
        stop();
        await resetSessionCache(client);
        stop = observeActivity('visit');
        await new Promise(setImmediate);
        assert.equal(requests, 2);
    } finally {
        stop();
        client.clear();
        names.forEach((name, index) => {
            if (original[index])
                Object.defineProperty(globalThis, name, original[index]!);
            else Reflect.deleteProperty(globalThis, name);
        });
    }
});
