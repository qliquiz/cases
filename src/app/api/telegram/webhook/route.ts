import { timingSafeEqual } from 'node:crypto';

import { telegramBotConfig } from '@/server/telegram-bot-config';

export const runtime = 'nodejs';

function object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

export async function POST(request: Request) {
    let config: ReturnType<typeof telegramBotConfig>;
    try {
        config = telegramBotConfig();
    } catch {
        return Response.json({ ok: false }, { status: 503 });
    }
    const supplied = Buffer.from(
        request.headers.get('x-telegram-bot-api-secret-token') ?? '',
    );
    const expected = Buffer.from(config.secret);
    if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
    )
        return Response.json({ ok: false }, { status: 403 });

    // Limit actual streamed bytes, not only the caller-controlled Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ ok: false }, { status: 400 });
    let update: Record<string, unknown> | null;
    try {
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 64 * 1024) {
                await reader.cancel();
                return Response.json({ ok: false }, { status: 413 });
            }
            chunks.push(value);
        }
        update = object(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
        return Response.json({ ok: false }, { status: 400 });
    } finally {
        reader.releaseLock();
    }
    if (!update || !Number.isSafeInteger(update.update_id))
        return Response.json({ ok: false }, { status: 400 });

    const message = object(update.message);
    const chat = object(message?.chat);
    const sender = object(message?.from);
    if (
        chat?.type !== 'private' ||
        typeof chat.id !== 'number' ||
        !Number.isSafeInteger(chat.id) ||
        chat.id <= 0 ||
        sender?.is_bot === true ||
        typeof message?.text !== 'string' ||
        !/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(message.text)
    )
        return Response.json({ ok: true });

    // Telegram executes this Bot API method from the webhook response.
    // This greeting never creates accounts or mutates a player's collection.
    return Response.json({
        method: 'sendMessage',
        chat_id: chat.id,
        text: 'Добро пожаловать в CaseGo!\n\nОткрывай виртуальные кейсы CS2 и собирай коллекцию. 5 бесплатных открытий в день. Без ставок, платежей и выдачи скинов в Steam.',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Открыть CaseGo', web_app: { url: config.origin } }],
            ],
        },
    });
}
