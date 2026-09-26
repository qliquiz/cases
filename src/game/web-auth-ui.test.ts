import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AuthPanel } from '../app/auth-panel';

test('обычный веб предлагает Telegram и email, а аккаунт — явную привязку', () => {
    const signedOut = renderToStaticMarkup(
        createElement(AuthPanel, { account: null, onChanged: async () => {} }),
    );
    assert.match(signedOut, /Войти через Telegram/);
    assert.match(signedOut, /Получить код/);
    assert.match(signedOut, /type="email"/);
    const signedIn = renderToStaticMarkup(
        createElement(AuthPanel, {
            account: {
                firstName: 'Ada',
                identities: [
                    { provider: 'email', subject: 'ada@example.test' },
                ],
            },
            onChanged: async () => {},
        }),
    );
    assert.match(signedIn, /Привязать Telegram/);
    assert.match(signedIn, /Выйти/);
    assert.doesNotMatch(signedIn, /Получить код/);
});
