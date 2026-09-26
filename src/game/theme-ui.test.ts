import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Home from '../app/page';

test('тема выбирается тройным переключателем с активным автоматическим режимом', () => {
    const html = renderToStaticMarkup(createElement(Home));
    assert.match(html, /aria-label="Тема оформления"/);
    assert.match(html, /role="radiogroup"/);
    assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
    assert.equal((html.match(/checked=""/g) ?? []).length, 1);
    assert.match(html, /checked=""[^>]*value="system"/);
    assert.match(html, /value="light"/);
    assert.match(html, /value="dark"/);
    assert.doesNotMatch(html, /<select/);
});
