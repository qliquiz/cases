import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Home from '../app/page';

test('главная страница использует название CaseGo', () => {
    const html = renderToStaticMarkup(createElement(Home));
    assert.match(html, /CaseGo/);
    assert.doesNotMatch(html, /Case Lab/);
});
