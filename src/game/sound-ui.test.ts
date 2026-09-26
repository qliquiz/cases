import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CasePlayground } from '../app/case-playground';

test('открытие кейса не показывает переключатель звука', () => {
    const html = renderToStaticMarkup(createElement(CasePlayground));
    assert.doesNotMatch(html, /Звук:|aria-pressed=/);
});
