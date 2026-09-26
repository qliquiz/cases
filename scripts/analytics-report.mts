import nextEnv from '@next/env';
import postgres from 'postgres';

import { getAnalyticsReport } from '../src/server/analytics';

nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--json')) {
    console.error('Usage: bun run analytics:report [--json]');
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL не задан');
    process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const ratio = (returned: number, eligible: number) =>
    eligible
        ? `${returned}/${eligible} (${((100 * returned) / eligible).toFixed(1)}%)`
        : '—';
try {
    const report = await getAnalyticsReport(sql);
    if (args.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(
            `CaseGo · последние 30 дней UTC · сбор с ${report.trackingStartedAt}`,
        );
        console.log(
            'Авторизованные аккаунты. Сегодня — неполный день. Когорты — по первому открытию.',
        );
        console.table(
            report.days.map((day) => ({
                'День UTC': day.day,
                Активные: day.activeUsers,
                'Смотрели альбом': day.collectionViewers,
                Открытия: day.openings,
                'Первое открытие': day.firstOpeners,
                D1: ratio(day.d1Returned, day.d1Eligible),
                D7: ratio(day.d7Returned, day.d7Eligible),
            })),
        );
        const totals = report.days.reduce(
            (sum, day) => ({
                d1Eligible: sum.d1Eligible + day.d1Eligible,
                d1Returned: sum.d1Returned + day.d1Returned,
                d7Eligible: sum.d7Eligible + day.d7Eligible,
                d7Returned: sum.d7Returned + day.d7Returned,
            }),
            { d1Eligible: 0, d1Returned: 0, d7Eligible: 0, d7Returned: 0 },
        );
        console.log(
            `Возврат по созревшим когортам отчёта: D1 ${ratio(totals.d1Returned, totals.d1Eligible)} · D7 ${ratio(totals.d7Returned, totals.d7Eligible)}`,
        );
        console.log(
            '«—»: нет пользователей с завершённым днём наблюдения. До входа визиты не учитываются.',
        );
    }
} catch {
    console.error(
        'Не удалось получить аналитику. Проверьте DATABASE_URL и применение миграции 004-analytics.',
    );
    process.exitCode = 1;
} finally {
    await sql.end();
}
