import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';

import { chromium, webkit } from 'playwright';
import postgres from 'postgres';

import { featuredCase } from '../src/game/catalog';
import { authenticateIdentity } from '../src/server/identities';
import { saveLeaderboardNickname } from '../src/server/leaderboard';
import { createSession, openCaseForUser } from '../src/server/store';
import { migrate } from './migrations.mjs';

const baseUrl = process.env.CASE_TEST_BASE_URL;
const socket = process.env.TEST_PG_SOCKET;
if (
    !baseUrl ||
    !socket ||
    !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)
)
    throw new Error(
        'Use loopback CASE_TEST_BASE_URL and isolated TEST_PG_SOCKET / cases_test.',
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
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.clock.install();
page.setDefaultTimeout(15_000);
let user = '';
let miniUser = '';
let reads = 0;
let routeReads = 0;
let visits = 0;
let acknowledgedVisits = 0;
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
    if (
        new URL(response.url()).pathname === '/api/activity' &&
        response.request().postData() === 'visit' &&
        response.status() === 204
    )
        acknowledgedVisits++;
});
page.on('request', (request) => {
    if (request.headers()['next-action']) reads++;
    if (new URL(request.url()).searchParams.has('_rsc')) routeReads++;
    if (
        new URL(request.url()).pathname === '/api/activity' &&
        request.postData() === 'visit'
    )
        visits++;
});
const nav = (name: string) =>
    page
        .getByRole('navigation', { name: 'Главное меню' })
        .getByRole('link', { name, exact: true })
        .click();
const ownOpenings = page
    .getByRole('complementary')
    .locator('dl > div')
    .filter({ has: page.getByText('Открытия', { exact: true }) })
    .locator('dd');
try {
    await migrate(sql);
    user = await authenticateIdentity(sql, {
        provider: 'email',
        subject: `${randomUUID()}@example.test`,
        name: 'Cache fixture',
    });
    await saveLeaderboardNickname(
        sql,
        user,
        'Cache-' + randomUUID().slice(0, 6),
    );
    await openCaseForUser(sql, user, featuredCase.id, randomUUID(), () => 0);
    await context.addCookies([
        {
            name: 'case_lab_session',
            value: await createSession(sql, user),
            domain: new URL(baseUrl).hostname,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    const columns = page
        .locator('main > section')
        .first()
        .locator(':scope > div');
    const left = await columns.nth(0).boundingBox();
    const right = await columns.nth(1).boundingBox();
    assert.ok(
        left && right && Math.abs(left.y - right.y) < 2,
        'Desktop hero columns must align at the top',
    );
    await page.screenshot({
        path: `/private/tmp/casego-top-${engine.name()}.png`,
        fullPage: true,
    });

    await nav('Рейтинг');
    await ownOpenings.filter({ hasText: /^1$/ }).waitFor();
    const beforeNavigation = reads;
    const routesBeforeNavigation = routeReads;
    const visitsBeforeNavigation = visits;
    await nav('Кейсы');
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    await nav('Рейтинг');
    await ownOpenings.filter({ hasText: /^1$/ }).waitFor();
    await page.waitForTimeout(300);
    assert.equal(
        reads,
        beforeNavigation,
        'Fresh account and leaderboard must not refetch on menu navigation',
    );
    assert.equal(
        routeReads,
        routesBeforeNavigation,
        'Visited menu pages must reuse their RSC payload, not just query data',
    );
    // HTTP-only production fixtures can intentionally fail the HTTPS Origin
    // check; failed telemetry must remain retryable, not count as delivered.
    if (acknowledgedVisits)
        assert.equal(
            visits,
            visitsBeforeNavigation,
            'Menu navigation must not send duplicate acknowledged daily visits',
        );

    const input = page.getByLabel('Публичный ник', { exact: true });
    await input.fill('Unsaved draft');
    await openCaseForUser(sql, user, featuredCase.id, randomUUID(), () => 0);
    await page.clock.fastForward(61_000);
    await ownOpenings.filter({ hasText: /^2$/ }).waitFor();
    assert.equal(
        await input.inputValue(),
        'Unsaved draft',
        'Background refresh must preserve the draft',
    );

    await page.route('**/*', (route) =>
        route.request().headers()['next-action']
            ? route.abort()
            : route.continue(),
    );
    await page
        .getByRole('button', { name: 'Обновить рейтинг', exact: true })
        .click();
    await page.clock.runFor(2000);
    await page
        .getByRole('alert')
        .filter({ hasText: 'Показаны последние загруженные данные' })
        .waitFor();
    assert.equal(await ownOpenings.textContent(), '2');
    await page.unroute('**/*');
    await page
        .getByRole('button', { name: 'Обновить рейтинг', exact: true })
        .click();
    await page
        .getByRole('alert')
        .filter({ hasText: 'Показаны последние загруженные данные' })
        .waitFor({ state: 'detached' });

    await nav('Кейсы');
    await page
        .getByRole('button', { name: 'Открыть бесплатно', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Открыть ещё раз', exact: true })
        .waitFor();
    await nav('Рейтинг');
    await ownOpenings.filter({ hasText: /^3$/ }).waitFor();

    const otherTab = await context.newPage();
    await otherTab.goto(baseUrl + '/leaderboard');
    await otherTab.getByLabel('Публичный ник', { exact: true }).waitFor();
    // Hold a real mutation response from the old session across logout.
    let release!: () => void;
    let received!: () => void;
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    const responseReady = new Promise<void>((resolve) => {
        received = resolve;
    });
    let intercepted = false;
    await otherTab.route('**/*', async (route) => {
        if (!route.request().headers()['next-action'] || intercepted)
            return route.continue();
        intercepted = true;
        const response = await route.fetch();
        received();
        await held;
        await route.fulfill({ response });
    });
    await otherTab
        .getByLabel('Публичный ник', { exact: true })
        .fill('Delayed-' + randomUUID().slice(0, 6));
    await otherTab
        .getByRole('button', { name: 'Сохранить ник', exact: true })
        .click();
    await responseReady;
    await nav('Кейсы');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page
        .getByRole('button', { name: 'Войти через Telegram', exact: true })
        .waitFor();
    await otherTab
        .getByLabel('Публичный ник', { exact: true })
        .waitFor({ state: 'detached' });
    await otherTab.evaluate(() => {
        const probe = window as Window & { leakedOldProfile?: boolean };
        probe.leakedOldProfile = false;
        new MutationObserver(() => {
            if (document.querySelector('#public-nickname'))
                probe.leakedOldProfile = true;
        }).observe(document.body, { childList: true, subtree: true });
    });
    release();
    await nav('Рейтинг');
    await page
        .getByRole('link', { name: 'Войти на странице кейсов', exact: true })
        .waitFor();
    await otherTab
        .getByRole('link', { name: 'Войти на странице кейсов', exact: true })
        .waitFor();
    assert.equal(await input.count(), 0);
    assert.equal(await page.getByText('Это вы', { exact: true }).count(), 0);
    assert.equal(
        await otherTab.evaluate(
            () =>
                (window as Window & { leakedOldProfile?: boolean })
                    .leakedOldProfile,
        ),
        false,
        'Delayed mutation must not resurrect the old private profile',
    );
    // OAuth establishes the cookie on the server and performs a full redirect.
    // Reproduce its return boundary, without contacting Telegram itself.
    await context.addCookies([
        {
            name: 'case_lab_session',
            value: await createSession(sql, user),
            domain: new URL(baseUrl).hostname,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
    await page.goto(baseUrl + '/?authSuccess=telegram');
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    await otherTab.getByLabel('Публичный ник', { exact: true }).waitFor();
    assert.notEqual(
        await otherTab
            .getByLabel('Публичный ник', { exact: true })
            .inputValue(),
        'Unsaved draft',
    );
    assert.equal(new URL(page.url()).searchParams.has('authSuccess'), false);

    const testBotToken = process.env.CASE_TEST_BOT_TOKEN;
    if (testBotToken) {
        const telegramId = String(
            700_000_000_000 + parseInt(randomUUID().slice(0, 8), 16),
        );
        miniUser = await authenticateIdentity(sql, {
            provider: 'telegram',
            subject: telegramId,
            name: 'Mini cache fixture',
        });
        const initData = new URLSearchParams({
            auth_date: String(Math.floor(Date.now() / 1000)),
            user: JSON.stringify({
                id: Number(telegramId),
                first_name: 'Mini cache fixture',
            }),
        });
        const check = [...initData.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        const key = createHmac('sha256', 'WebAppData')
            .update(testBotToken)
            .digest();
        initData.set(
            'hash',
            createHmac('sha256', key).update(check).digest('hex'),
        );
        const miniContext = await browser.newContext();
        await miniContext.addInitScript((data) => {
            window.Telegram = {
                WebApp: { initData: data, ready() {}, colorScheme: 'dark' },
            };
        }, initData.toString());
        await miniContext.route('**/telegram.org/js/**', (route) =>
            route.fulfill({ contentType: 'application/javascript', body: '' }),
        );
        const mini = await miniContext.newPage();
        await mini.goto(baseUrl);
        await mini
            .getByRole('button', { name: 'Выйти', exact: true })
            .waitFor();
        let miniRequests = 0;
        mini.on('request', (request) => {
            if (request.headers()['next-action']) miniRequests++;
        });
        const miniNav = (name: string) =>
            mini
                .getByRole('navigation', { name: 'Главное меню' })
                .getByRole('link', { name, exact: true })
                .click();
        await miniNav('Рейтинг');
        await mini.getByLabel('Публичный ник', { exact: true }).waitFor();
        const requests = miniRequests;
        await miniNav('Кейсы');
        await mini
            .getByRole('button', { name: 'Выйти', exact: true })
            .waitFor();
        await mini.waitForTimeout(300);
        assert.equal(
            miniRequests,
            requests,
            'Mini App must reuse the established account session across menu navigation',
        );
        await mini.getByRole('button', { name: 'Выйти', exact: true }).click();
        await mini
            .getByRole('button', { name: 'Войти через Telegram', exact: true })
            .waitFor();
        await miniNav('Рейтинг');
        await mini
            .getByRole('link', {
                name: 'Войти на странице кейсов',
                exact: true,
            })
            .waitFor();
        await miniNav('Кейсы');
        await mini
            .getByRole('button', { name: 'Войти через Telegram', exact: true })
            .waitFor();
        assert.equal(
            await mini
                .getByRole('button', { name: 'Выйти', exact: true })
                .count(),
            0,
        );
        await miniContext.close();
        console.log(
            `${engine.name()}: signed Mini App bootstrap, cached navigation and explicit logout passed.`,
        );
    }
    assert.deepEqual(errors, []);
    console.log(
        `${engine.name()}: top alignment, cached menu navigation, background refresh, draft preservation, error recovery, opening invalidation and cross-tab logout passed.`,
    );
} finally {
    await browser.close();
    if (user) await sql`delete from app_users where id = ${user}`;
    if (miniUser) await sql`delete from app_users where id = ${miniUser}`;
    await sql.end();
}
