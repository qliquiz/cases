import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CasePlayground } from '../app/case-playground';

test('до проверки Telegram виртуальное открытие недоступно', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.match(html, /Подключаем Telegram/);
    assert.match(html, /disabled=""[^>]*>Открыть бесплатно/);
});
