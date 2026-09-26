import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Home from '../app/page';

test('доступен выбор автоматической, светлой и тёмной темы', () => {
    const html = renderToStaticMarkup(createElement(Home));
    assert.match(html, /aria-label="Тема оформления"/);
    assert.match(html, /value="system"[^>]*selected=""/);
    assert.match(html, /value="light"/);
    assert.match(html, /value="dark"/);
});
