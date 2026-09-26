import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';

import { LeaderboardScreen } from '../app/leaderboard/leaderboard-screen';
import LoadingLeaderboard from '../app/leaderboard/loading';
import Home from '../app/page';
import { renderToStaticMarkup } from './render-ui';

test('первая загрузка аккаунта и рейтинга резервирует место скелетонами', () => {
    const home = renderToStaticMarkup(createElement(Home));
    const leaderboard = renderToStaticMarkup(createElement(LeaderboardScreen));
    assert.match(home, /data-skeleton="account"/);
    assert.match(leaderboard, /data-skeleton="leaderboard"/);
    assert.match(leaderboard, /aria-busy="true"/);
});

test('картинки каталога используют оптимизатор и плейсхолдер вместо прямой загрузки оригиналов', () => {
    const home = renderToStaticMarkup(createElement(Home));
    assert.match(home, /srcSet="\/_next\/image\?/);
    assert.match(home, /data-skeleton="image"/);
});

test('маршрутный и клиентский скелетоны рейтинга имеют одинаковый заголовок и кнопку', () => {
    const route = renderToStaticMarkup(createElement(LoadingLeaderboard));
    const client = renderToStaticMarkup(createElement(LeaderboardScreen));
    const intro = (html: string) => html.match(/<section.*?<\/section>/)?.[0];
    assert.ok(intro(route));
    assert.equal(intro(route), intro(client));
});
