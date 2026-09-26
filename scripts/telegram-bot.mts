import nextEnv from '@next/env';

import { runBotCommand } from '../src/server/telegram-bot-setup';

nextEnv.loadEnvConfig(process.cwd());
const [mode, ...flags] = process.argv.slice(2);
try {
    if (
        (mode !== 'check' && mode !== 'setup') ||
        flags.some((flag) => !['--apply', '--replace-webhook'].includes(flag))
    )
        throw new Error(
            'Используйте bot:check или bot:setup --apply [--replace-webhook]',
        );
    const result = await runBotCommand(mode, {
        apply: flags.includes('--apply'),
        replaceWebhook: flags.includes('--replace-webhook'),
    });
    console.log(JSON.stringify(result, null, 2));
    if (mode === 'setup') {
        if (!result.webhookConfigured || !result.menuConfigured)
            throw new Error(
                'Telegram не подтвердил настройки. Запустите bot:check.',
            );
        console.log(
            'Webhook и меню подключены. Отправьте боту новое /start и нажмите «Открыть CaseGo».',
        );
    }
} catch (error) {
    console.error(
        error instanceof Error ? error.message : 'Настройка бота не выполнена',
    );
    process.exitCode = 1;
}
