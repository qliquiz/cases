import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { chromium, webkit } from 'playwright';
import postgres from 'postgres';

import { caseCatalog, itemLabel } from '../src/game/catalog';
import { authenticateIdentity } from '../src/server/identities';
import { createSession, getCollection } from '../src/server/store';

const baseUrl = process.env.CASE_TEST_BASE_URL;
const socket = process.env.TEST_PG_SOCKET;
if (
    !baseUrl ||
    !socket ||
    !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)
) {
    throw new Error(
        'Use loopback CASE_TEST_BASE_URL and TEST_PG_SOCKET for an isolated cases_test server.',
    );
}
const sql = postgres({
    path: socket,
    database: 'cases_test',
    user: process.env.USER,
});
const engine = process.env.CASE_TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    reducedMotion: 'no-preference',
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
let userId = '';
try {
    await page.goto(baseUrl);
    await page
        .getByRole('button', { name: 'Получить код', exact: true })
        .waitFor();
    const picker = page.getByRole('group', {
        name: 'Выбор кейса',
        exact: true,
    });
    const contents = page.getByRole('region', {
        name: 'Содержимое выбранного кейса',
        exact: true,
    });
    for (const item of caseCatalog) {
        await picker
            .getByRole('button', { name: item.name, exact: true })
            .click();
        assert.equal(
            await picker
                .getByRole('button', { name: item.name, exact: true })
                .getAttribute('aria-pressed'),
            'true',
        );
        await contents
            .getByRole('heading', { name: item.name, exact: true })
            .waitFor();
        assert.equal(
            await contents.locator('img').count(),
            item.drops.length + item.rareDrops.length,
        );
        await contents
            .getByText(itemLabel(item.drops[0]), { exact: true })
            .waitFor();
        if (item.rareDrops[0].phase)
            await contents
                .getByText(itemLabel(item.rareDrops[0]), { exact: true })
                .waitFor();
    }
    userId = await authenticateIdentity(sql, {
        provider: 'email',
        subject: randomUUID() + '@example.test',
        name: 'Cases browser fixture',
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
    assert.equal(
        await picker
            .getByRole('button', { name: 'Kilowatt Case', exact: true })
            .getAttribute('aria-pressed'),
        'true',
    );
    for (const [index, caseId] of ['crate-4061', 'crate-4351'].entries()) {
        const item = caseCatalog.find((item) => item.id === caseId)!;
        await picker
            .getByRole('button', { name: item.name, exact: true })
            .click();
        assert.equal(
            await page.getByRole('progressbar').getAttribute('aria-valuemax'),
            String(item.drops.length + item.rareDrops.length),
        );
        await page
            .getByRole('button', { name: 'Открыть бесплатно', exact: true })
            .click();
        await page
            .getByText('Лента прокручивается…', { exact: true })
            .waitFor();
        for (const candidate of caseCatalog) {
            assert.equal(
                await picker
                    .getByRole('button', { name: candidate.name, exact: true })
                    .isDisabled(),
                true,
            );
        }
        await page
            .getByRole('button', { name: 'Открыть ещё раз', exact: true })
            .waitFor();
        await page
            .getByText(`${9 - index} из 10 открытий доступно`, { exact: false })
            .waitFor();
        const collection = await getCollection(sql, userId);
        assert.equal(collection.length, index + 1);
        assert.ok(
            collection.some(
                (entry) =>
                    entry.caseId === caseId &&
                    [...item.drops, ...item.rareDrops].some(
                        (drop) => drop.id === entry.itemId,
                    ),
            ),
        );
    }
    for (const item of caseCatalog) {
        await picker
            .getByRole('button', { name: item.name, exact: true })
            .click();
        assert.equal(
            await page.getByRole('progressbar').getAttribute('aria-valuemax'),
            String(item.drops.length + item.rareDrops.length),
        );
        await page
            .getByText('8 из 10 открытий доступно', { exact: false })
            .waitFor();
    }
    await page.getByText('История открытий', { exact: true }).click();
    const history = await page
        .locator('details')
        .filter({ has: page.getByText('История открытий', { exact: true }) })
        .innerText();
    assert.ok(
        history.includes('Chroma Case') && history.includes('Spectrum Case'),
    );
    for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const colorScheme of ['light', 'dark'] as const) {
            await page.emulateMedia({ colorScheme });
            await picker.scrollIntoViewIfNeeded();
            assert.equal(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                true,
                `no horizontal overflow ${width}/${colorScheme}`,
            );
            await page.screenshot({
                path: `/private/tmp/casego-cases-${engine.name()}-${width}-${colorScheme}.png`,
            });
        }
    }
    await picker
        .getByRole('button', { name: 'Chroma Case', exact: true })
        .focus();
    await page.keyboard.press('Enter');
    assert.equal(
        await picker
            .getByRole('button', { name: 'Chroma Case', exact: true })
            .getAttribute('aria-pressed'),
        'true',
    );
    await page.reload();
    await page
        .getByText('8 из 10 открытий доступно', { exact: false })
        .waitFor();
    assert.equal((await getCollection(sql, userId)).length, 2);
    assert.deepEqual(errors, []);
    console.log(
        `${engine.name()}: five catalogs, albums, phases, real saved openings, animation lock, shared quota, history, keyboard, mobile themes and reload passed.`,
    );
} finally {
    if (userId) await sql`delete from app_users where id = ${userId}`;
    await browser.close();
    await sql.end();
}
