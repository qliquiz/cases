import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';

import { CasePlayground } from '../app/case-playground';
import { renderToStaticMarkup } from './render-ui';

test('открытие кейса не показывает переключатель звука', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.doesNotMatch(html, /Звук:|aria-pressed=/);
});
