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

test('главная предлагает пять кейсов, по умолчанию выбран Kilowatt', () => {
    const html = renderToStaticMarkup(createElement(Home));
    assert.match(html, /aria-label="Выбор кейса"/);
    for (const name of [
        'Kilowatt Case',
        'Chroma Case',
        'Chroma 2 Case',
        'Spectrum Case',
        'Spectrum 2 Case',
    ]) {
        assert.match(html, new RegExp(`aria-label="${name}"`));
    }
});
