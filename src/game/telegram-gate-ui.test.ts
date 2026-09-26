import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';

import { CasePlayground } from '../app/case-playground';
import { renderToStaticMarkup } from './render-ui';

test('до проверки аккаунта виртуальное открытие недоступно', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.match(html, /Проверяем вход/);
    assert.match(html, /disabled=""[^>]*>Открыть бесплатно/);
});
