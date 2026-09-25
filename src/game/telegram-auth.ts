import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramIdentity = {
    id: string;
    firstName: string;
};

const maxInitDataAgeSeconds = 60 * 60;
const futureSkewSeconds = 60;

export function verifyTelegramInitData(
    raw: string,
    botToken: string,
    nowSeconds = Math.floor(Date.now() / 1000),
): TelegramIdentity {
    if (!raw || raw.length > 8192 || !botToken) {
        throw new Error('Недействительные данные Telegram');
    }

    const params = new URLSearchParams(raw);
    const fields = [...params.entries()];
    const keys = new Set(fields.map(([key]) => key));
    if (keys.size !== fields.length) {
        throw new Error('Повторяющиеся поля Telegram');
    }

    const hash = params.get('hash');
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
        throw new Error('Нет подписи Telegram');
    }

    const dataCheckString = fields
        .filter(([key]) => key !== 'hash')
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = createHmac('sha256', secret)
        .update(dataCheckString)
        .digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) {
        throw new Error('Неверная подпись Telegram');
    }

    const authDate = Number(params.get('auth_date'));
    if (
        !Number.isSafeInteger(authDate) ||
        authDate <= 0 ||
        nowSeconds - authDate > maxInitDataAgeSeconds ||
        authDate - nowSeconds > futureSkewSeconds
    ) {
        throw new Error('Данные Telegram устарели');
    }

    let user: unknown;
    try {
        user = JSON.parse(params.get('user') ?? '');
    } catch {
        throw new Error('Нет пользователя Telegram');
    }
    if (!user || typeof user !== 'object') {
        throw new Error('Нет пользователя Telegram');
    }
    const { id, first_name: firstName } = user as Record<string, unknown>;
    if (
        !Number.isSafeInteger(id) ||
        Number(id) <= 0 ||
        typeof firstName !== 'string' ||
        firstName.length === 0 ||
        firstName.length > 200
    ) {
        throw new Error('Некорректный пользователь Telegram');
    }

    return { id: String(id), firstName };
}
