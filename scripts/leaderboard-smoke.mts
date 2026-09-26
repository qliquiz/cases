import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { chromium, webkit } from 'playwright';
import postgres from 'postgres';

import { featuredCase } from '../src/game/catalog';
import { authenticateIdentity } from '../src/server/identities';
import {
    getLeaderboard,
    saveLeaderboardNickname,
} from '../src/server/leaderboard';
import { createSession, openCaseForUser } from '../src/server/store';
import { migrate } from './migrations.mjs';

const baseUrl = process.env.CASE_TEST_BASE_URL;
const socket = process.env.TEST_PG_SOCKET;
if (
    !baseUrl ||
    !socket ||
    !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)
)
    throw new Error(
        'Use loopback CASE_TEST_BASE_URL with isolated TEST_PG_SOCKET / cases_test.',
    );
const sql = postgres({
    path: socket,
    database: 'cases_test',
    user: process.env.USER,
    onnotice() {},
});
const engine = process.env.CASE_TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    reducedMotion: 'reduce',
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
const users: string[] = [];
const suffix = randomUUID().slice(0, 6);
const mineName = 'CaseHunter-' + suffix;
const opponentName = 'Aurora-' + suffix;
try {
    await migrate(sql);
    for (let index = 0; index < 3; index++) {
        const user = await authenticateIdentity(sql, {
            provider: 'email',
            subject: `private-${suffix}-${index}@example.test`,
            name: `private-${suffix}-${index}@example.test`,
        });
        users.push(user);
        if (index > 0)
            await saveLeaderboardNickname(
                sql,
                user,
                index === 1 ? opponentName : 'Спектр-' + suffix,
            );
        for (let item = 0; item <= index; item++) {
            let call = 0;
            await openCaseForUser(
                sql,
                user,
                featuredCase.id,
                randomUUID(),
                () =>
                    call++ === 0
                        ? index === 2 && item === 2
                            ? 9999
                            : 0
                        : item,
            );
        }
    }
    await page.goto(baseUrl);
    await page
        .getByRole('navigation', { name: 'Главное меню' })
        .getByRole('link', { name: 'Рейтинг', exact: true })
        .click();
    await page
        .getByRole('heading', { name: 'Рейтинг игроков', exact: true })
        .waitFor();
    assert.ok(
        (await getLeaderboard(sql)).entries.some(
            (row) => row.nickname === opponentName,
        ),
    );
    await page.getByText(opponentName, { exact: true }).waitFor();
    assert.equal(
        await page.getByLabel('Публичный ник', { exact: true }).count(),
        0,
    );
    assert.doesNotMatch(
        await page.content(),
        new RegExp(`private-${suffix}|${users[0]}`),
    );
    const token = await createSession(sql, users[0]);
    const cookie = {
        name: 'case_lab_session',
        value: token,
        domain: new URL(baseUrl).hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax' as const,
    };
    await context.addCookies([cookie]);
    await page.reload();
    const input = page.getByLabel('Публичный ник', { exact: true });
    await input.waitFor();
    await input.fill(mineName);
    await page
        .getByRole('button', { name: 'Участвовать в рейтинге', exact: true })
        .click();
    await page
        .getByRole('status')
        .filter({ hasText: 'Публичный ник сохранён.' })
        .waitFor();
    await page.getByText('Это вы', { exact: true }).waitFor();
    assert.equal(
        (await getLeaderboard(sql, users[0])).mine?.nickname,
        mineName,
    );
    await input.fill(opponentName);
    await page
        .getByRole('button', { name: 'Сохранить ник', exact: true })
        .click();
    await page
        .getByRole('alert')
        .filter({ hasText: 'Этот ник уже занят' })
        .waitFor();
    await page.reload();
    assert.equal(await input.inputValue(), mineName);
    const refresh = page.getByRole('button', {
        name: 'Обновить рейтинг',
        exact: true,
    });
    const ownOpenings = page
        .getByRole('complementary')
        .locator('dl > div')
        .filter({ has: page.getByText('Открытия', { exact: true }) })
        .locator('dd');
    assert.equal(await ownOpenings.textContent(), '1');
    await openCaseForUser(
        sql,
        users[0],
        featuredCase.id,
        randomUUID(),
        () => 0,
    );
    await refresh.click();
    await ownOpenings.filter({ hasText: /^2$/ }).waitFor();
    await page.waitForFunction(
        () =>
            !Array.from(document.querySelectorAll('button')).some(
                (button) => button.textContent === 'Подождите…',
            ),
    );
    assert.equal((await getLeaderboard(sql, users[0])).mine?.uniqueItems, 1);
    for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const colorScheme of ['light', 'dark'] as const) {
            await page.emulateMedia({ colorScheme });
            await page.waitForTimeout(250);
            await page.evaluate(() => window.scrollTo(0, 0));
            assert.ok(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                `overflow at ${width}/${colorScheme}`,
            );
            await page.screenshot({
                path: `/private/tmp/casego-leaderboard-${engine.name()}-${width}-${colorScheme}.png`,
                fullPage: true,
            });
        }
    }
    await context.clearCookies();
    await input.fill('Unauthorized');
    await page
        .getByRole('button', { name: 'Сохранить ник', exact: true })
        .click();
    await page
        .getByRole('alert')
        .filter({ hasText: 'Войдите в аккаунт' })
        .waitFor();
    assert.equal(
        (await getLeaderboard(sql, users[0])).mine?.nickname,
        mineName,
    );
    await context.addCookies([cookie]);
    await page.reload();
    await page
        .getByRole('button', { name: 'Скрыться из рейтинга', exact: true })
        .click();
    await page
        .getByRole('status')
        .filter({ hasText: 'Профиль скрыт' })
        .waitFor();
    assert.ok(
        !(await getLeaderboard(sql)).entries.some(
            (row) => row.nickname === mineName,
        ),
    );
    await page
        .getByRole('navigation', { name: 'Главное меню' })
        .getByRole('link', { name: 'Кейсы', exact: true })
        .click();
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
        `${engine.name()}: public/private views, publish, duplicate rejection, persistence, refresh, session enforcement, hide, navigation and mobile themes passed.`,
    );
} finally {
    for (const user of users)
        await sql`delete from app_users where id = ${user}`;
    await browser.close();
    await sql.end();
}
