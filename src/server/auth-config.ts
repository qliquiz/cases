export function authSecret() {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32)
        throw new Error('Настройте AUTH_SECRET (минимум 32 символа)');
    return secret;
}

export function appOrigin() {
    const url = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000');
    if (
        (url.protocol !== 'https:' && url.protocol !== 'http:') ||
        url.username ||
        url.password ||
        (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
        throw new Error('Некорректный APP_ORIGIN');
    }
    return url.origin;
}

export function telegramLoginConfig() {
    const clientId = process.env.TELEGRAM_CLIENT_ID;
    const clientSecret = process.env.TELEGRAM_CLIENT_SECRET;
    if (!clientId || !clientSecret)
        throw new Error('Веб-вход Telegram не настроен');
    return { origin: appOrigin(), clientId, clientSecret };
}
