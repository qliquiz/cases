import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CasePlayground } from '../app/case-playground';

test('у открытия есть доступная кнопка включения и отключения звука', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /Звук: вкл/);
});
