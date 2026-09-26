import nodemailer from 'nodemailer';

export async function sendLoginCode(email: string, code: string) {
    const {
        SMTP_HOST: host,
        SMTP_USER: user,
        SMTP_PASSWORD: pass,
        SMTP_FROM: from,
    } = process.env;
    const port = Number(process.env.SMTP_PORT ?? '465');
    if (
        !host ||
        !user ||
        !pass ||
        !from ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error('SMTP не настроен');
    }
    const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user, pass },
        logger: false,
        debug: false,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
    });
    await transport.sendMail({
        from,
        to: { address: email, name: '' },
        subject: 'Код входа в CaseGo',
        text:
            'Ваш код: ' +
            code +
            '\nОн действует 10 минут. Никому его не сообщайте. Если вы не запрашивали вход, проигнорируйте письмо.',
        disableFileAccess: true,
        disableUrlAccess: true,
    });
}
