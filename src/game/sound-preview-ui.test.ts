import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';

import { CasePlayground } from '../app/case-playground';
import { renderToStaticMarkup } from './render-ui';

test('проверка звука не отображается в интерфейсе', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.doesNotMatch(html, /Проверить звук/);
});
