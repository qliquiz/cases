import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { authenticateIdentity } from '../src/server/identities';
import { chromium } from 'playwright';
import postgres from 'postgres';
import {
    createSession,
    getSession,
    getCollection,
    getDailyRemaining,
    openCaseForUser,
} from '../src/server/store';
import { featuredCase } from '../src/game/catalog';
import { getAnalyticsReport } from '../src/server/analytics';

const baseUrl = process.env.CASE_TEST_BASE_URL;
const socket = process.env.TEST_PG_SOCKET;
if (
    !baseUrl ||
    !socket ||
    !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)
) {
    throw new Error(
        'Set loopback CASE_TEST_BASE_URL and TEST_PG_SOCKET for an isolated dev server / cases_test database.',
    );
}
const sql = postgres({
    path: socket,
    database: 'cases_test',
    user: process.env.USER,
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const errors: string[] = [];
let userId = '';
page.on('pageerror', (error) => errors.push(error.message));
let telegramSdkRequests = 0;
await page.route('**/telegram.org/js/**', (route) => {
    telegramSdkRequests++;
    return route.abort();
});
await page.route('**/oauth.telegram.org/auth**', (route) =>
    route.fulfill({ status: 200, body: 'OAuth intercepted for test' }),
);
try {
    const baseline = (await getAnalyticsReport(sql)).days.at(-1)!;
    await page.goto(baseUrl);
    await page
        .getByRole('button', { name: 'Получить код', exact: true })
        .waitFor();
    assert.equal(telegramSdkRequests, 0);
    assert.equal(
        await page
            .getByRole('button', { name: 'Открыть бесплатно', exact: true })
            .isDisabled(),
        true,
    );
    userId = await authenticateIdentity(sql, {
        provider: 'email',
        subject: randomUUID() + '@example.test',
        name: 'Browser fixture',
    });
    const token = await createSession(sql, userId);
    await context.addCookies([
        {
            name: 'case_lab_session',
            value: token,
            domain: new URL(baseUrl).hostname,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
    await page.reload();
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    await page
        .getByRole('heading', { name: 'Моя коллекция', exact: true })
        .scrollIntoViewIfNeeded();
    // Poll the public report while the best-effort browser request completes.
    let viewed = false;
    for (let attempt = 0; attempt < 50; attempt++) {
        const day = (await getAnalyticsReport(sql)).days.at(-1)!;
        if (day.collectionViewers === baseline.collectionViewers + 1) {
            viewed = true;
            break;
        }
        await page.waitForTimeout(100);
    }
    assert.equal(
        viewed,
        true,
        'visible collection is recorded through the real route',
    );
    const viewedDay = (await getAnalyticsReport(sql)).days.at(-1)!;
    assert.equal(viewedDay.activeUsers, baseline.activeUsers + 1);
    await page
        .getByRole('button', { name: 'Открыть бесплатно', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Открыть ещё раз', exact: true })
        .waitFor();
    await page
        .getByText('9 из 10 открытий доступно', { exact: false })
        .waitFor();
    const openedDay = (await getAnalyticsReport(sql)).days.at(-1)!;
    assert.equal(openedDay.firstOpeners, baseline.firstOpeners + 1);
    assert.equal(openedDay.openings, baseline.openings + 1);
    assert.equal(openedDay.activeUsers, baseline.activeUsers + 1);
    await page.reload();
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    assert.equal(
        (await getAnalyticsReport(sql)).days.at(-1)!.firstOpeners,
        baseline.firstOpeners + 1,
    );
    for (let index = 0; index < 9; index++) {
        await openCaseForUser(
            sql,
            userId,
            featuredCase.id,
            randomUUID(),
            () => 0,
        );
    }
    await page.reload();
    await page.getByText('0 из 10 открытий доступно').waitFor();
    assert.equal(
        await page
            .getByRole('button', { name: 'Открыть бесплатно', exact: true })
            .isDisabled(),
        true,
    );
    for (let cycle = 0; cycle < 2; cycle++) {
        await page
            .getByRole('button', { name: 'Сбросить лимит', exact: true })
            .click();
        await page.getByText('10 из 10 открытий доступно').waitFor();
        assert.equal(await getDailyRemaining(sql, userId), 10);
        await page
            .getByRole('button', {
                name: cycle === 0 ? 'Открыть бесплатно' : 'Открыть ещё раз',
                exact: true,
            })
            .click();
        await page.getByText('9 из 10 открытий доступно').waitFor();
        assert.equal(await getDailyRemaining(sql, userId), 9);
        assert.equal((await getCollection(sql, userId)).length, 11 + cycle);
    }
    await page.reload();
    await page.getByText('9 из 10 открытий доступно').waitFor();
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page
        .getByRole('button', { name: 'Войти через Telegram', exact: true })
        .waitFor();
    assert.equal(await getSession(sql, token), null);
    await page
        .getByRole('button', { name: 'Войти через Telegram', exact: true })
        .click();
    await page.waitForURL('https://oauth.telegram.org/auth**');
    assert.equal(
        new URL(page.url()).searchParams.get('code_challenge_method'),
        'S256',
    );
    assert.deepEqual(errors, []);
    console.log(
        'Browser smoke passed: email form, authenticated opening, analytics, persistent 10-attempt quota, repeatable server reset and subsequent real openings, history preserved, logout revocation, OAuth redirect.',
    );
} finally {
    if (userId) await sql`delete from app_users where id = ${userId}`;
    await browser.close();
    await sql.end();
}
