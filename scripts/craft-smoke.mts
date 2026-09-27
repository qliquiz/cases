import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import postgres from 'postgres';
import { featuredCase } from '../src/game/catalog';
import { getCraftHistory } from '../src/server/crafting';
import { authenticateIdentity } from '../src/server/identities';
import {
    getLeaderboard,
    saveLeaderboardNickname,
} from '../src/server/leaderboard';
import {
    createSession,
    getCollection,
    getDailyRemaining,
    openCaseForUser,
    resetOpeningLimit,
} from '../src/server/store';
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
    viewport: { width: 1280, height: 1000 },
    reducedMotion: 'reduce',
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
let user = '';
const nav = (name: string) =>
    page
        .getByRole('navigation')
        .getByRole('link', { name, exact: true })
        .click();
try {
    await migrate(sql);
    await page.goto(new URL('/craft', baseUrl).href);
    await page
        .getByRole('heading', { name: 'Сначала собери предметы' })
        .waitFor();
    user = await authenticateIdentity(sql, {
        provider: 'email',
        subject: randomUUID() + '@example.test',
        name: 'Craft browser',
    });
    await saveLeaderboardNickname(
        sql,
        user,
        'Craft-' + randomUUID().slice(0, 6),
    );
    for (let i = 0; i < 11; i++) {
        if (i === 10) await resetOpeningLimit(sql, user);
        await openCaseForUser(
            sql,
            user,
            featuredCase.id,
            randomUUID(),
            () => 0,
        );
    }
    const quota = await getDailyRemaining(sql, user);
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
    await page.reload();
    const duplicates = page.getByRole('button', {
        name: 'Добавить дубликаты',
        exact: true,
    });
    await duplicates.click();
    const contract = page.getByRole('region', {
        name: 'Контракт крафта',
        exact: true,
    });
    assert.equal(await contract.getByText('20%', { exact: true }).count(), 5);
    assert.equal(
        await contract.getByText(/Выбраны последние копии/).count(),
        0,
    );
    const create = page.getByRole('button', {
        name: 'Создать предмет',
        exact: true,
    });
    assert.equal(await create.isDisabled(), true);
    await page.getByRole('checkbox').check();
    for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const colorScheme of ['light', 'dark'] as const) {
            await page.emulateMedia({ colorScheme });
            assert.ok(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                `No horizontal overflow at ${width}`,
            );
            if (width !== 320)
                await page.screenshot({
                    path: `/private/tmp/casego-craft-${engine.name()}-${width}-${colorScheme}.png`,
                    fullPage: true,
                });
        }
    }
    await create.click();
    await page.getByRole('status', { name: 'Результат крафта' }).waitFor();
    const collection = await getCollection(sql, user);
    assert.equal(collection.length, 12);
    assert.equal(collection.filter((x) => !x.consumedAt).length, 2);
    assert.equal(await getDailyRemaining(sql, user), quota);
    assert.equal((await getLeaderboard(sql, user)).mine?.uniqueItems, 2);
    await nav('Кейсы');
    const progress = page.getByRole('progressbar');
    await progress.waitFor();
    assert.equal(await progress.getAttribute('aria-valuenow'), '2');
    await nav('Крафт');
    await page
        .getByRole('region', { name: 'История крафта' })
        .getByText('Потрачено 10 предметов')
        .waitFor();
    await page.reload();
    await duplicates.waitFor();
    await page
        .getByRole('region', { name: 'История крафта' })
        .getByText('Потрачено 10 предметов')
        .waitFor();

    // Commit a second craft, drop its HTTP response, then retry the SAME request.
    await resetOpeningLimit(sql, user);
    for (let i = 0; i < 10; i++)
        await openCaseForUser(
            sql,
            user,
            featuredCase.id,
            randomUUID(),
            () => 0,
        );
    await page
        .getByRole('button', { name: 'Обновить инвентарь', exact: true })
        .click();
    await page
        .getByText('Доступно с выбранными фильтрами: 11.', { exact: false })
        .waitFor();
    await duplicates.click();
    await page.getByRole('checkbox').check();
    const inputs = (await getCollection(sql, user)).filter(
        (x) => !x.consumedAt && x.item.rarity === 'Mil-Spec Grade',
    );
    let dropped = false;
    await page.route('**/craft', async (route) => {
        const request = route.request();
        if (
            !dropped &&
            request.headers()['next-action'] &&
            inputs.some((x) => request.postData()?.includes(x.id))
        ) {
            dropped = true;
            await route.fetch();
            await route.abort('failed');
        } else await route.continue();
    });
    await create.click();
    await page
        .getByRole('button', { name: 'Проверить результат', exact: true })
        .click();
    await page.getByRole('status', { name: 'Результат крафта' }).waitFor();
    assert.equal(dropped, true);
    assert.equal((await getCraftHistory(sql, user)).length, 2);
    assert.equal(
        (await getCollection(sql, user)).filter((x) => !x.consumedAt).length,
        3,
    );
    await page.unroute('**/craft');

    const other = await context.newPage();
    await other.goto(baseUrl);
    await other.getByRole('button', { name: 'Выйти', exact: true }).click();
    await page
        .getByRole('heading', { name: 'Сначала собери предметы' })
        .waitFor();
    assert.equal(
        await page.getByRole('region', { name: 'История крафта' }).count(),
        0,
    );
    assert.deepEqual(errors, []);
    console.log(
        `${engine.name()}: guest, duplicates, odds, confirmation, craft, lifetime album/rating, quota, reload, network retry, cross-tab logout and mobile themes passed.`,
    );
} finally {
    await browser.close();
    if (user) await sql`delete from app_users where id = ${user}`;
    await sql.end();
}
