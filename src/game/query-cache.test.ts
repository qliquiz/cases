import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    announceSessionChange,
    createQueryClient,
    resetSessionCache,
    sessionGeneration,
} from '../browser/query-cache';

test('запрет межвкладочного канала не мешает завершить выход', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousChannel = Object.getOwnPropertyDescriptor(
        globalThis,
        'BroadcastChannel',
    );
    Object.defineProperty(globalThis, 'BroadcastChannel', {
        configurable: true,
        value: class {
            constructor() {
                throw new Error('Blocked');
            }
        },
    });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            BroadcastChannel: class {
                constructor() {
                    throw new Error('Blocked');
                }
            },
        },
    });
    try {
        assert.doesNotThrow(announceSessionChange);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
        if (previousChannel)
            Object.defineProperty(
                globalThis,
                'BroadcastChannel',
                previousChannel,
            );
        else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
    }
});

test('повторное чтение использует кеш, инвалидация получает свежие данные', async () => {
    const client = createQueryClient();
    let serverValue = 1;
    const query = { queryKey: ['account'], queryFn: async () => serverValue };
    try {
        assert.equal(await client.fetchQuery(query), 1);
        serverValue = 2;
        assert.equal(await client.fetchQuery(query), 1);
        await client.invalidateQueries({ queryKey: ['account'] });
        assert.equal(await client.fetchQuery(query), 2);
    } finally {
        client.clear();
    }
});

test('смена сессии убирает личные данные и не принимает запоздалый ответ старой сессии', async () => {
    const client = createQueryClient();
    let complete!: (value: string) => void;
    client.setQueryData(['account'], 'Old account');
    client.setQueryData(['leaderboard'], 'Old private rank');
    const request = client
        .fetchQuery({
            queryKey: ['account'],
            staleTime: 0,
            queryFn: () =>
                new Promise<string>((resolve) => {
                    complete = resolve;
                }),
        })
        .catch(() => undefined);
    await resetSessionCache(client);
    complete('Old response');
    await request;
    assert.equal(client.getQueryData(['account']), undefined);
    assert.equal(client.getQueryData(['leaderboard']), undefined);
    client.clear();
});

test('начатая до смены сессии операция больше не может публиковать результат', async () => {
    const client = createQueryClient();
    const generation = sessionGeneration(client);
    const reset = resetSessionCache(client);
    assert.notEqual(sessionGeneration(client), generation);
    await reset;
    client.clear();
});
