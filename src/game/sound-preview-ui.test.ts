import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CasePlayground } from '../app/case-playground';

test('проверка звука не отображается в интерфейсе', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.doesNotMatch(html, /Проверить звук/);
});
