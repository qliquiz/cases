import assert from 'node:assert/strict';

import { chromium, webkit, type Page } from 'playwright';

const baseUrl = process.env.CASE_TEST_BASE_URL;
if (!baseUrl || !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname))
    throw new Error('Set loopback CASE_TEST_BASE_URL for a local test server.');

const browser = await (
    process.env.THEME_TEST_BROWSER === 'webkit' ? webkit : chromium
).launch({ headless: true });
const errors: string[] = [];

async function expectTheme(page: Page, theme: 'light' | 'dark') {
    await page.waitForFunction(
        (expected) => document.documentElement.dataset.theme === expected,
        theme,
    );
    assert.equal(
        await page.evaluate(
            () => getComputedStyle(document.body).backgroundColor,
        ),
        theme === 'light' ? 'rgb(244, 247, 251)' : 'rgb(9, 15, 29)',
    );
}

try {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    let sdkRequests = 0;
    await context.route('**/telegram.org/js/**', (route) => {
        sdkRequests++;
        return route.abort();
    });
    await page.goto(baseUrl);
    await expectTheme(page, 'light');
    const picker = page.getByRole('combobox', { name: 'Тема оформления' });
    await page
        .getByRole('button', { name: 'Войти через Telegram', exact: true })
        .waitFor();
    assert.equal(await picker.inputValue(), 'system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectTheme(page, 'dark');
    await picker.selectOption('light');
    await expectTheme(page, 'light');
    await page.reload();
    await expectTheme(page, 'light');
    await page.waitForFunction(
        () => document.querySelector('select')?.value === 'light',
    );
    await picker.selectOption('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'dark');

    const second = await context.newPage();
    await second.goto(baseUrl);
    await expectTheme(second, 'dark');
    await picker.selectOption('system');
    await expectTheme(page, 'light');
    await expectTheme(second, 'light');
    assert.equal(sdkRequests, 0, 'ordinary web must not load Telegram SDK');
    await page.screenshot({
        path: '/private/tmp/casego-theme-light.png',
        fullPage: true,
    });
    await picker.selectOption('dark');
    await page.screenshot({
        path: '/private/tmp/casego-theme-dark.png',
        fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await picker.selectOption('light');
    assert.equal(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
    );
    await page.screenshot({
        path: '/private/tmp/casego-theme-mobile.png',
        fullPage: true,
    });
    await context.close();

    const restricted = await browser.newContext({ colorScheme: 'light' });
    await restricted.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
            get() {
                throw new Error('blocked');
            },
        });
    });
    const restrictedPage = await restricted.newPage();
    restrictedPage.on('pageerror', (error) => errors.push(error.message));
    await restrictedPage.goto(baseUrl);
    await expectTheme(restrictedPage, 'light');
    await restrictedPage
        .getByRole('button', { name: 'Войти через Telegram', exact: true })
        .waitFor();
    await restrictedPage
        .getByRole('combobox', { name: 'Тема оформления' })
        .selectOption('dark');
    await expectTheme(restrictedPage, 'dark');
    await restricted.close();

    const mini = await browser.newContext({ colorScheme: 'dark' });
    await mini.route('**/telegram.org/js/**', (route) =>
        route.fulfill({
            contentType: 'application/javascript',
            body: `window.Telegram = { WebApp: {
            initData: '', ready() {}, colorScheme: 'light',
            onEvent(event, callback) { window.addEventListener('test:' + event, callback); },
            offEvent(event, callback) { window.removeEventListener('test:' + event, callback); }
        } };`,
        }),
    );
    const miniPage = await mini.newPage();
    miniPage.on('pageerror', (error) => errors.push(error.message));
    await miniPage.goto(baseUrl + '#tgWebAppData=fixture');
    await expectTheme(miniPage, 'light');
    await miniPage.evaluate(() => {
        window.Telegram!.WebApp!.colorScheme = 'dark';
        window.dispatchEvent(new Event('test:themeChanged'));
    });
    await expectTheme(miniPage, 'dark');
    await miniPage
        .getByRole('combobox', { name: 'Тема оформления' })
        .selectOption('light');
    await miniPage.evaluate(() =>
        window.dispatchEvent(new Event('test:themeChanged')),
    );
    await expectTheme(miniPage, 'light');
    await miniPage
        .getByRole('combobox', { name: 'Тема оформления' })
        .selectOption('system');
    await expectTheme(miniPage, 'dark');
    await mini.close();

    // Initial HTML applies saved preference before the React bundles execute.
    const early = await browser.newContext({ colorScheme: 'light' });
    await early.addInitScript(() =>
        localStorage.setItem('casego-theme', 'dark'),
    );
    await early.route('**/_next/**/*.js*', (route) => route.abort());
    const earlyPage = await early.newPage();
    earlyPage.on('pageerror', (error) => errors.push(error.message));
    await earlyPage.goto(baseUrl);
    await expectTheme(earlyPage, 'dark');
    await early.close();
    assert.deepEqual(errors, []);
    console.log(
        'Theme smoke passed: device, override, reload, tabs, Telegram, restricted storage, pre-hydration, mobile.',
    );
} finally {
    await browser.close();
}
