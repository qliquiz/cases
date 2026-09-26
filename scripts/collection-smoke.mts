import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, webkit } from 'playwright';

const baseUrl = process.env.CASE_TEST_BASE_URL;
if (
    !baseUrl ||
    !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)
) {
    throw new Error('Set loopback CASE_TEST_BASE_URL for a local test server.');
}
const scratch = await mkdtemp(join(tmpdir(), 'casego-album-'));
const bundle = join(scratch, 'fixture.js');
execFileSync(
    'bun',
    [
        'build',
        'scripts/collection-fixture.tsx',
        '--target=browser',
        '--define=process.env={}',
        '--tsconfig-override=scripts/collection-tsconfig.json',
        '--outfile',
        bundle,
    ],
    { stdio: 'pipe' },
);
const script = await readFile(bundle, 'utf8');
const browser = await (
    process.env.COLLECTION_TEST_BROWSER === 'webkit' ? webkit : chromium
).launch();
const errors: string[] = [];
try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl);
    const styles = await page
        .locator('link[rel="stylesheet"]')
        .evaluateAll((links) =>
            links.map((link) => (link as HTMLLinkElement).href),
        );
    assert.ok(
        styles.length,
        'fixture must use the real application stylesheet',
    );
    await page.route('**/__collection_test__', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><div id="fixture"></div></body></html>`,
        }),
    );
    await page.goto(new URL('/__collection_test__', baseUrl).href);
    await page.addScriptTag({ content: script });
    const album = page.getByRole('region', { name: 'Предметы альбома' });
    const progress = page.getByRole('progressbar');
    const filters = page.getByRole('group', { name: 'Фильтр коллекции' });
    const cards = album.getByRole('listitem');
    await progress.waitFor();
    assert.equal(await cards.count(), 30);
    assert.equal(await progress.getAttribute('aria-valuenow'), '0');
    await filters
        .getByRole('button', { name: 'Собрано 0', exact: true })
        .click();
    assert.equal(await cards.count(), 0);
    assert.equal(
        await album.getByText('Здесь появятся собранные предметы.').isVisible(),
        true,
    );
    await page
        .getByRole('button', { name: 'Fixture partial', exact: true })
        .click();
    await filters
        .getByRole('button', { name: 'Собрано 3', exact: true })
        .waitFor();
    assert.equal(await cards.count(), 3);
    assert.equal(await album.getByText('Дубликаты: 2').isVisible(), true);
    assert.equal(await progress.getAttribute('aria-valuenow'), '3');
    await filters
        .getByRole('button', { name: 'Не хватает 27', exact: true })
        .click();
    assert.equal(await cards.count(), 27);
    assert.equal(
        await album
            .getByText('Dual Berettas | Hideout', { exact: true })
            .count(),
        0,
    );
    await page
        .getByRole('button', { name: 'Fixture new drop', exact: true })
        .click();
    await filters
        .getByRole('button', { name: 'Не хватает 26', exact: true })
        .waitFor();
    assert.equal(await cards.count(), 26);
    assert.equal(await progress.getAttribute('aria-valuenow'), '4');
    await filters.getByRole('button', { name: 'Все 30', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await cards.count(), 30);
    assert.equal(
        await filters
            .getByRole('button', { name: 'Все 30', exact: true })
            .getAttribute('aria-pressed'),
        'true',
    );
    await page
        .getByRole('button', { name: 'Обновить лимит', exact: true })
        .click();
    assert.equal(
        await page.getByText('5 из 5 открытий сегодня').isVisible(),
        true,
    );
    await page.getByText('История открытий', { exact: true }).click();
    assert.equal(await page.locator('details ol li').count(), 6);
    await page.getByText('История открытий', { exact: true }).click();
    await page.emulateMedia({ forcedColors: 'active' });
    if (
        await page.evaluate(() => matchMedia('(forced-colors: active)').matches)
    ) {
        await album.focus();
        assert.notEqual(
            await filters
                .getByRole('button', { name: 'Все 30', exact: true })
                .evaluate((button) => getComputedStyle(button).outlineStyle),
            'none',
            'selected filter must remain visible in forced colors without focus',
        );
    }
    await page.emulateMedia({ forcedColors: 'none' });
    for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
        }, theme);
        for (const width of [320, 390, 1024]) {
            await page.setViewportSize({ width, height: 1000 });
            assert.equal(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                true,
                `${theme} ${width}: no overflow`,
            );
            await page
                .getByRole('region', { name: 'Моя коллекция', exact: true })
                .screenshot({
                    path: `/private/tmp/casego-album-${theme}-${width}.png`,
                    animations: 'disabled',
                });
        }
    }
    await page
        .getByRole('button', { name: 'Fixture full', exact: true })
        .click();
    await page
        .getByText('Альбом собран полностью!', { exact: false })
        .waitFor();
    assert.equal(await progress.getAttribute('aria-valuenow'), '30');
    await filters
        .getByRole('button', { name: 'Не хватает 0', exact: true })
        .click();
    assert.equal(await cards.count(), 0);
    assert.equal(
        await album.getByText('Все предметы уже в коллекции.').isVisible(),
        true,
    );
    // A new account's empty collection must not retain the previous account's progress.
    await page
        .getByRole('button', { name: 'Fixture empty', exact: true })
        .click();
    await filters
        .getByRole('button', { name: 'Не хватает 30', exact: true })
        .waitFor();
    assert.equal(await cards.count(), 30);
    assert.equal(await progress.getAttribute('aria-valuenow'), '0');
    assert.deepEqual(errors, []);
    console.log(
        'Album smoke passed: filters, new drop, duplicates, empty/full/reset, history, quota refresh, keyboard, both themes and mobile.',
    );
} catch (error) {
    if (errors.length) console.error('Browser errors:', errors);
    throw error;
} finally {
    await browser.close();
}
