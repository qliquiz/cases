import { telegramBotConfig } from './telegram-bot-config';

type WebhookInfo = {
    url: string;
    pending_update_count: number;
    last_error_date?: number;
};
type Menu = { type: string; web_app?: { url: string } };

export async function runBotCommand(
    mode: 'check' | 'setup',
    options: { apply?: boolean; replaceWebhook?: boolean },
    env: Record<string, string | undefined> = process.env,
    request: typeof fetch = fetch,
) {
    if (mode === 'setup' && !options.apply)
        throw new Error(
            'Для изменения webhook и кнопки меню запустите bot:setup --apply',
        );
    if (mode === 'setup' && env.VERCEL_ENV && env.VERCEL_ENV !== 'production')
        throw new Error(
            'Настройка рабочего бота разрешена только из Production окружения',
        );
    const config = telegramBotConfig(env);
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token))
        throw new Error('Настройте TELEGRAM_BOT_TOKEN из BotFather');

    async function api<T>(method: string, body = {}) {
        // Never print fetch errors or Telegram descriptions: the URL contains a token.
        try {
            const response = await request(
                `https://api.telegram.org/bot${token}/${method}`,
                {
                    method: 'POST',
                    redirect: 'error',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(10_000),
                },
            );
            const data = await response.json();
            if (!response.ok || data.ok !== true) throw new Error();
            return data.result as T;
        } catch {
            throw new Error(
                `Telegram ${method}: запрос не выполнен. Проверьте токен и соединение.`,
            );
        }
    }

    const bot = await api<{ username: string }>('getMe');
    let info = await api<WebhookInfo>('getWebhookInfo');
    if (mode === 'setup') {
        if (
            info.url &&
            info.url !== config.webhookUrl &&
            !options.replaceWebhook
        )
            throw new Error(
                'У бота уже есть другой webhook. Для осознанной замены добавьте --replace-webhook',
            );
        // Authenticated no-op: validates the deployed route without messaging a user.
        try {
            const response = await request(config.webhookUrl, {
                method: 'POST',
                redirect: 'error',
                headers: {
                    'content-type': 'application/json',
                    'x-telegram-bot-api-secret-token': config.secret,
                },
                body: JSON.stringify({ update_id: 0 }),
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok || (await response.json()).ok !== true)
                throw new Error();
        } catch {
            throw new Error(
                'Webhook недоступен. Сначала сделайте Production-деплой с теми же APP_ORIGIN и TELEGRAM_WEBHOOK_SECRET; проверьте Deployment Protection.',
            );
        }
        await api('setWebhook', {
            url: config.webhookUrl,
            secret_token: config.secret,
            allowed_updates: ['message'],
            max_connections: 5,
            drop_pending_updates: false,
        });
        await api('setChatMenuButton', {
            menu_button: {
                type: 'web_app',
                text: 'Открыть CaseGo',
                web_app: { url: config.origin },
            },
        });
        info = await api<WebhookInfo>('getWebhookInfo');
    }
    const menu = await api<Menu>('getChatMenuButton');
    return {
        bot: bot.username,
        webhookConfigured: info.url === config.webhookUrl,
        anotherWebhookConfigured: Boolean(
            info.url && info.url !== config.webhookUrl,
        ),
        pendingUpdates: info.pending_update_count,
        lastDeliveryErrorAt: info.last_error_date
            ? new Date(info.last_error_date * 1000).toISOString()
            : null,
        menuConfigured:
            menu.type === 'web_app' && menu.web_app?.url === config.origin,
    };
}
