import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';

import CraftPage from '../app/craft/page';
import { renderToStaticMarkup } from './render-ui';

test('вкладка крафта доступна в меню и при первой загрузке показывает скелетон', () => {
    const html = renderToStaticMarkup(createElement(CraftPage));
    assert.match(
        html,
        /<a(?=[^>]*href="\/craft")(?=[^>]*aria-current="page")[^>]*>Крафт<\/a>/,
    );
    assert.match(html, /data-skeleton="craft"/);
    assert.match(html, /Крафт скинов/);
    assert.match(html, /10 → 1/);
});
