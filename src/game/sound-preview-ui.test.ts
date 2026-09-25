import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CasePlayground } from '../app/case-playground';

test('игрок может проверить звук до открытия кейса', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.match(html, /Проверить звук/);
});
