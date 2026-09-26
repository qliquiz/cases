import assert from 'node:assert/strict';
import { test } from 'node:test';

import { POST } from '../app/api/telegram/webhook/route';

const secret = 'test_webhook_secret_0123456789abcdef';
process.env.TELEGRAM_WEBHOOK_SECRET = secret;
process.env.APP_ORIGIN = 'https://casego.example';

function request(body: unknown, token = secret) {
    return new Request('https://casego.example/api/telegram/webhook', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-telegram-bot-api-secret-token': token,
        },
        body: JSON.stringify(body),
    });
}

const start = {
    update_id: 123,
    message: {
        message_id: 1,
        chat: { id: 456, type: 'private' },
        from: { id: 456, is_bot: false },
        text: '/start',
    },
};

test('/start возвращает приветствие CaseGo и кнопку Mini App в тот же личный чат', async () => {
    const response = await POST(request(start));
    assert.equal(response.status, 200);
    const reply = await response.json();
    assert.equal(reply.method, 'sendMessage');
    assert.equal(reply.chat_id, 456);
    assert.match(reply.text, /CaseGo/);
    assert.deepEqual(reply.reply_markup, {
        inline_keyboard: [
            [
                {
                    text: 'Открыть CaseGo',
                    web_app: { url: 'https://casego.example' },
                },
            ],
        ],
    });
});

test('webhook отклоняет неверный секрет до чтения тела', async () => {
    for (const token of ['', 'wrong', 'x'.repeat(secret.length)]) {
        const response = await POST(request(start, token));
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { ok: false });
    }
});

test('группы, правки сообщений, боты и посторонние команды не получают ответ', async () => {
    for (const body of [
        { update_id: 1 },
        { update_id: 1, edited_message: start.message },
        { ...start, message: { ...start.message, text: '/starter' } },
        { ...start, message: { ...start.message, text: 'привет' } },
        {
            ...start,
            message: { ...start.message, chat: { id: -123, type: 'group' } },
        },
        {
            ...start,
            message: { ...start.message, chat: { id: '456', type: 'private' } },
        },
        { ...start, message: { ...start.message, from: { is_bot: true } } },
    ]) {
        const response = await POST(request(body));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
    }
});

test('start с deep-link параметром не отражает пользовательский текст в ответе', async () => {
    const response = await POST(
        request({
            ...start,
            message: {
                ...start.message,
                text: '/start@CaseGoBot <malicious>payload</malicious>',
            },
        }),
    );
    const reply = await response.json();
    assert.equal(reply.method, 'sendMessage');
    assert.doesNotMatch(JSON.stringify(reply), /malicious/);
});

test('некорректные и слишком большие тела отклоняются', async () => {
    for (const body of [null, [], { update_id: '123' }])
        assert.equal((await POST(request(body))).status, 400);
    assert.equal(
        (
            await POST(
                new Request('https://casego.example', {
                    method: 'POST',
                    headers: { 'x-telegram-bot-api-secret-token': secret },
                    body: '{',
                }),
            )
        ).status,
        400,
    );
    assert.equal(
        (await POST(request({ update_id: 1, text: 'x'.repeat(65536) }))).status,
        413,
    );
});

test('без настроек webhook закрыт и не раскрывает конфигурацию', async () => {
    const previous = process.env.TELEGRAM_WEBHOOK_SECRET;
    try {
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
        const response = await POST(request(start));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { ok: false });
    } finally {
        process.env.TELEGRAM_WEBHOOK_SECRET = previous;
    }
});
