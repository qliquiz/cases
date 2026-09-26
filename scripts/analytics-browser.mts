import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, webkit } from 'playwright';

const temp = await mkdtemp(join(tmpdir(), 'casego-analytics-browser-'));
const bundle = join(temp, 'activity.js');
execFileSync('bun', [
    'build',
    'src/browser/activity.ts',
    '--target=browser',
    '--outfile',
    bundle,
]);
const script = await readFile(bundle, 'utf8');
const browser = await (
    process.env.ANALYTICS_TEST_BROWSER === 'webkit' ? webkit : chromium
).launch();
try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 700 },
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const events: string[] = [];
    let failure = false;
    await page.route('http://127.0.0.1:3097/**', async (route) => {
        if (new URL(route.request().url()).pathname === '/api/activity') {
            events.push(route.request().postData() ?? '');
            return route.fulfill({ status: failure ? 503 : 204 });
        }
        return route.fulfill({
            contentType: 'text/html',
            body: '<div style="height:1800px"></div><h2 id="album">Коллекция</h2>',
        });
    });
    await page.clock.install({ time: new Date('2026-09-26T23:59:00Z') });
    await page.goto('http://127.0.0.1:3097/');
    await page.addScriptTag({
        type: 'module',
        content:
            script +
            '\nwindow.stopVisit = observeActivity("visit"); window.stopAlbum = observeActivity("collection_view", document.getElementById("album"));',
    });
    await page.waitForFunction(
        () =>
            typeof (window as unknown as { stopVisit: unknown }).stopVisit ===
            'function',
    );
    await page.waitForTimeout(100);
    assert.deepEqual(events, ['visit'], 'offscreen collection is not a view');
    await page.locator('#album').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    assert.deepEqual(events, ['visit', 'collection_view']);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);
    assert.equal(events.length, 2, 'same-day repeat is suppressed');
    await page.clock.fastForward(61_000);
    await page.waitForTimeout(100);
    assert.equal(events.filter((event) => event === 'visit').length, 2);
    assert.equal(
        events.filter((event) => event === 'collection_view').length,
        2,
    );
    // Background tabs do not produce a new day's visit.
    await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(86_400_000);
    assert.equal(events.length, 4);
    failure = true;
    await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(100);
    assert.equal(events.length, 6);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);
    assert.equal(events.length, 6, 'failure retry is throttled');
    failure = false;
    await page.clock.fastForward(61_000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);
    assert.equal(events.length, 8);
    await page.evaluate(() => {
        const scope = window as unknown as {
            stopVisit: () => void;
            stopAlbum: () => void;
        };
        scope.stopVisit();
        scope.stopAlbum();
    });
    await page.clock.fastForward(86_400_000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(events.length, 8, 'cleanup removes timers and listeners');
    assert.deepEqual(errors, []);
    console.log(
        'Analytics browser passed: visibility, viewport, deduplication, UTC rollover, background, retry and cleanup.',
    );
} finally {
    await browser.close();
}
