export function telegramBotConfig(
    env: Record<string, string | undefined> = process.env,
) {
    const secret = env.TELEGRAM_WEBHOOK_SECRET ?? '';
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret))
        throw new Error(
            'TELEGRAM_WEBHOOK_SECRET: нужно 32–256 символов A-Z, a-z, 0-9, _ или -',
        );
    let url: URL;
    try {
        url = new URL(env.APP_ORIGIN ?? '');
    } catch {
        throw new Error('APP_ORIGIN: укажите HTTPS-адрес сайта');
    }
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    )
        throw new Error(
            'APP_ORIGIN: нужен HTTPS origin без пути, параметров и пароля',
        );
    return {
        secret,
        origin: url.origin,
        webhookUrl: `${url.origin}/api/telegram/webhook`,
    };
}
