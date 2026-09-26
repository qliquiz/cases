import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runBotCommand } from '../server/telegram-bot-setup';

const env = {
    APP_ORIGIN: 'https://casego.example',
    TELEGRAM_WEBHOOK_SECRET: 'test_webhook_secret_0123456789abcdef',
    TELEGRAM_BOT_TOKEN: '123456:fake_test_token_not_a_real_credential',
};

test('настройка проверяет обработчик и подключает webhook с секретом и меню Mini App', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    let webhookUrl = '';
    let menu: unknown = { type: 'default' };
    const request = (async (input, init) => {
        const url = String(input);
        const body = JSON.parse(String(init?.body ?? '{}'));
        calls.push({ url, body });
        if (url === 'https://casego.example/api/telegram/webhook') {
            assert.equal(
                new Headers(init?.headers).get(
                    'x-telegram-bot-api-secret-token',
                ),
                env.TELEGRAM_WEBHOOK_SECRET,
            );
            assert.equal(init?.redirect, 'error');
            assert.deepEqual(body, { update_id: 0 });
            return Response.json({ ok: true });
        }
        const method = url.split('/').pop();
        if (method === 'getMe')
            return Response.json({
                ok: true,
                result: { username: 'CaseGoBot' },
            });
        if (method === 'getWebhookInfo')
            return Response.json({
                ok: true,
                result: { url: webhookUrl, pending_update_count: 0 },
            });
        if (method === 'setWebhook') webhookUrl = body.url;
        if (method === 'setChatMenuButton') menu = body.menu_button;
        if (method === 'getChatMenuButton')
            return Response.json({ ok: true, result: menu });
        return Response.json({ ok: true, result: true });
    }) as typeof fetch;
    const result = await runBotCommand('setup', { apply: true }, env, request);
    assert.equal(result.webhookConfigured, true);
    assert.equal(result.menuConfigured, true);
    const webhook = calls.find((call) => call.url.endsWith('/setWebhook'))!;
    assert.deepEqual(webhook.body, {
        url: 'https://casego.example/api/telegram/webhook',
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message'],
        max_connections: 5,
        drop_pending_updates: false,
    });
    assert.deepEqual(
        calls.find((call) => call.url.endsWith('/setChatMenuButton'))!.body,
        {
            menu_button: {
                type: 'web_app',
                text: 'Открыть CaseGo',
                web_app: { url: 'https://casego.example' },
            },
        },
    );
    assert.doesNotMatch(
        JSON.stringify(result),
        /fake_test_token|test_webhook_secret/,
    );
});

test('без --apply и из Preview нельзя изменить настройки бота', async () => {
    const noNetwork = (async () => {
        assert.fail('network must not be used');
    }) as typeof fetch;
    await assert.rejects(runBotCommand('setup', {}, env, noNetwork), /--apply/);
    await assert.rejects(
        runBotCommand(
            'setup',
            { apply: true },
            { ...env, VERCEL_ENV: 'preview' },
            noNetwork,
        ),
        /Production/,
    );
});

test('старый webhook другого проекта не заменяется без отдельного флага', async () => {
    const methods: string[] = [];
    const request = (async (input) => {
        const method = String(input).split('/').pop()!;
        methods.push(method);
        return Response.json({
            ok: true,
            result:
                method === 'getMe'
                    ? { username: 'CaseGoBot' }
                    : {
                          url: 'https://old.example/private-secret-path',
                          pending_update_count: 0,
                      },
        });
    }) as typeof fetch;
    await assert.rejects(
        runBotCommand('setup', { apply: true }, env, request),
        /--replace-webhook/,
    );
    assert.deepEqual(methods, ['getMe', 'getWebhookInfo']);
});

test('check читает статус, не меняет настройки и не печатает URL старого webhook', async () => {
    const methods: string[] = [];
    const request = (async (input) => {
        const method = String(input).split('/').pop()!;
        methods.push(method);
        const responses = {
            getMe: { username: 'CaseGoBot' },
            getWebhookInfo: {
                url: 'https://old.example/private-secret-path',
                pending_update_count: 2,
            },
            getChatMenuButton: { type: 'default' },
        };
        assert.ok(method in responses);
        return Response.json({
            ok: true,
            result: responses[method as keyof typeof responses],
        });
    }) as typeof fetch;
    const result = await runBotCommand('check', {}, env, request);
    assert.equal(result.webhookConfigured, false);
    assert.equal(result.anotherWebhookConfigured, true);
    assert.equal(result.pendingUpdates, 2);
    assert.doesNotMatch(JSON.stringify(result), /private-secret-path/);
    assert.deepEqual(methods, ['getMe', 'getWebhookInfo', 'getChatMenuButton']);
});

test('ошибка preflight не регистрирует webhook, а ошибки API не раскрывают токен', async () => {
    const methods: string[] = [];
    const request = (async (input) => {
        const method = String(input).split('/').pop()!;
        methods.push(method);
        if (method === 'getMe')
            return Response.json({
                ok: true,
                result: { username: 'CaseGoBot' },
            });
        if (method === 'getWebhookInfo')
            return Response.json({
                ok: true,
                result: { url: '', pending_update_count: 0 },
            });
        return new Response('Not deployed', { status: 404 });
    }) as typeof fetch;
    await assert.rejects(
        runBotCommand('setup', { apply: true }, env, request),
        /Webhook недоступен/,
    );
    assert.deepEqual(methods, ['getMe', 'getWebhookInfo', 'webhook']);
    const failing = (async () => {
        throw new Error(env.TELEGRAM_BOT_TOKEN);
    }) as typeof fetch;
    await assert.rejects(
        runBotCommand('check', {}, env, failing),
        (error: Error) => {
            assert.doesNotMatch(error.message, /fake_test_token|123456:/);
            return true;
        },
    );
});
