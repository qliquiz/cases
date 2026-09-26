import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleActivity } from '../server/analytics-handler';

test('аналитика принимает только известное событие от текущей сессии и same-origin запроса', async () => {
    const saved: unknown[] = [];
    const services = {
        origin: 'https://casego.test',
        getUserId: async () => 'session-user',
        record: async (...args: unknown[]) => {
            saved.push(args);
        },
    };
    const request = (body: string, origin = 'https://casego.test') =>
        new Request('https://casego.test/api/activity', {
            method: 'POST',
            headers: { origin },
            body,
        });
    assert.equal(
        (await handleActivity(request('visit'), services)).status,
        204,
    );
    assert.deepEqual(saved, [['session-user', 'visit']]);
    assert.equal(
        (await handleActivity(request('collection_view'), services)).status,
        204,
    );
    assert.equal(
        (await handleActivity(request('visit', 'https://evil.test'), services))
            .status,
        403,
    );
    assert.equal(
        (await handleActivity(request('first_opening'), services)).status,
        400,
    );
    assert.equal(
        (
            await handleActivity(
                request('{"userId":"other","event":"visit"}'),
                services,
            )
        ).status,
        413,
    );
    assert.equal(
        (
            await handleActivity(request('visit'), {
                ...services,
                getUserId: async () => null,
            })
        ).status,
        401,
    );
    assert.equal(saved.length, 2);
});

test('сбой аналитики не раскрывает секреты, oversized stream ограничен без Content-Length', async () => {
    const services = {
        origin: 'https://casego.test',
        getUserId: async () => 'session-user',
        record: async () => {
            throw new Error('secret-db-url');
        },
    };
    const request = new Request('https://casego.test/api/activity', {
        method: 'POST',
        headers: { origin: 'https://casego.test' },
        body: 'visit',
    });
    const response = await handleActivity(request, services);
    assert.equal(response.status, 503);
    assert.equal(await response.text(), '');
    const huge = new Request('https://casego.test/api/activity', {
        method: 'POST',
        headers: { origin: 'https://casego.test' },
        body: 'x'.repeat(1000),
    });
    assert.equal((await handleActivity(huge, services)).status, 413);
});

test('за доверенным proxy Origin сверяется с настроенным адресом приложения, не внутренним URL', async () => {
    const request = new Request('http://localhost:3000/api/activity', {
        method: 'POST',
        headers: { origin: 'https://casego.test' },
        body: 'visit',
    });
    const result = await handleActivity(request, {
        origin: 'https://casego.test',
        getUserId: async () => 'session-user',
        record: async () => {},
    });
    assert.equal(result.status, 204);
});
