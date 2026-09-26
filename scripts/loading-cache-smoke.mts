import assert from 'node:assert/strict';

import { chromium, webkit } from 'playwright';

const baseUrl = process.env.CASE_TEST_BASE_URL;
if (!baseUrl || !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname))
    throw new Error('Use loopback CASE_TEST_BASE_URL.');
const engine = process.env.CASE_TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
try {
    // No routing/interception here: Playwright routing disables the HTTP cache.
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(baseUrl);
    await page
        .getByRole('button', { name: 'Получить код', exact: true })
        .waitFor();
    const hero = page.locator('img[alt="Kilowatt Case"]');
    await page.waitForFunction(() => {
        const img = document.querySelector<HTMLImageElement>(
            'img[alt="Kilowatt Case"]',
        );
        return img?.complete && img.naturalWidth > 0;
    });
    const url = new URL((await hero.getAttribute('src')) ?? '', baseUrl);
    assert.equal(url.pathname, '/_next/image');
    const response = await page.request.get(url.href, {
        headers: { Accept: 'image/webp' },
    });
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /image\/webp/);
    assert.match(response.headers()['cache-control'], /max-age=([1-9]\d+)/);
    const second = await page.request.get(url.href, {
        headers: { Accept: 'image/webp' },
    });
    assert.equal(second.headers()['x-nextjs-cache'], 'HIT');
    const bytes = (await second.body()).length;
    assert.ok(
        bytes < 68_512,
        'Optimized case thumbnail must be smaller than its original',
    );
    const invalid = new URL('/_next/image', baseUrl);
    invalid.search = new URLSearchParams({
        url: 'https://example.com/private.png',
        w: '384',
        q: '75',
    }).toString();
    assert.equal((await page.request.get(invalid.href)).status(), 400);
    await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Рейтинг', exact: true })
        .click();
    await page
        .getByRole('link', { name: 'Войти на странице кейсов', exact: true })
        .waitFor();
    await page.evaluate(() => performance.clearResourceTimings());
    await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Кейсы', exact: true })
        .click();
    await hero.waitFor();
    await page.waitForFunction(
        () =>
            document.querySelector<HTMLImageElement>('img[alt="Kilowatt Case"]')
                ?.naturalWidth,
    );
    const repeatedBytes = await page.evaluate(
        (src) =>
            performance
                .getEntriesByType('resource')
                .filter((entry) => entry.name === src)
                .reduce(
                    (total, entry) =>
                        total +
                        (entry as PerformanceResourceTiming).transferSize,
                    0,
                ),
        url.href,
    );
    assert.equal(
        repeatedBytes,
        0,
        'Returning to cases must reuse the browser image cache',
    );
    await context.close();

    // Separate slow-network context for skeletons, not for cache assertions.
    const slow = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        reducedMotion: 'reduce',
    });
    const screen = await slow.newPage();
    let release!: () => void;
    let gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await screen.route('**/*', async (route) => {
        if (route.request().headers()['next-action']) await gate;
        await route.continue();
    });
    await screen.goto(baseUrl);
    await screen.locator('[data-skeleton="account"]').waitFor();
    const open = screen.getByRole('button', {
        name: 'Открыть бесплатно',
        exact: true,
    });
    const before = await open.boundingBox();
    const contents = screen.getByRole('region', {
        name: 'Содержимое выбранного кейса',
    });
    const contentsBefore = await contents.boundingBox();
    await screen.screenshot({
        path: `/private/tmp/casego-account-skeleton-${engine.name()}.png`,
    });
    release();
    await screen
        .getByRole('button', { name: 'Получить код', exact: true })
        .waitFor();
    const after = await open.boundingBox();
    assert.equal(
        (await contents.boundingBox())?.y,
        contentsBefore?.y,
        'Guest auth loading must not shift the case contents below the hero',
    );
    assert.equal(
        before?.y,
        after?.y,
        'Auth loading must not shift the opening button',
    );
    gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await screen
        .getByRole('navigation')
        .getByRole('link', { name: 'Рейтинг', exact: true })
        .click();
    const skeleton = screen.locator('[data-skeleton="leaderboard"]');
    await skeleton.waitFor();
    const top = await skeleton.boundingBox();
    for (const width of [1280, 390]) {
        await screen.setViewportSize({ width, height: 1000 });
        for (const colorScheme of ['light', 'dark'] as const) {
            await screen.emulateMedia({ colorScheme });
            assert.ok(
                await screen.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            );
            await screen.screenshot({
                path: `/private/tmp/casego-rating-skeleton-${engine.name()}-${width}-${colorScheme}.png`,
                fullPage: true,
            });
        }
    }
    await screen.setViewportSize({ width: 1280, height: 1000 });
    release();
    await screen
        .getByRole('link', { name: 'Войти на странице кейсов', exact: true })
        .waitFor();
    const loadedTop = await screen
        .getByRole('region', { name: 'Топ игроков' })
        .boundingBox();
    assert.equal(
        top?.y,
        loadedTop?.y,
        'Rating loading must reserve the list position',
    );
    assert.equal(await skeleton.count(), 0);
    await slow.close();
    console.log(
        `${engine.name()}: optimized WebP ${bytes} bytes, server HIT, browser cache reuse, remote URL restriction and stable skeletons passed.`,
    );
} finally {
    await browser.close();
}
