import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';

import { LeaderboardScreen } from '../app/leaderboard/leaderboard-screen';
import { renderToStaticMarkup } from './render-ui';

test('рейтинг показывает тестовый статус, статистику и своё место вне топа', () => {
    const html = renderToStaticMarkup(createElement(LeaderboardScreen), {
        entries: [
            {
                nickname: 'Лидер',
                rank: 1,
                uniqueItems: 12,
                openings: 34,
                rareDrops: 2,
                isYou: false,
            },
        ],
        mine: {
            nickname: 'МойНик',
            rank: 57,
            uniqueItems: 3,
            openings: 8,
            rareDrops: 0,
        },
        participants: 80,
    });
    assert.match(html, /Тестовый рейтинг/);
    assert.match(html, /Лидер/);
    assert.match(html, /Моё место/);
    assert.match(html, /#57/);
    assert.match(html, /Публичный ник/);
    assert.match(html, /Скрыться из рейтинга/);
    assert.match(html, /Редкие/);
});

test('пустой рейтинг доступен гостю, загрузка не маскируется под пустой топ', () => {
    const html = renderToStaticMarkup(createElement(LeaderboardScreen), {
        entries: [],
        mine: null,
        participants: 0,
    });
    assert.match(html, /Пока нет участников/);
    assert.match(html, /Войти/);
    assert.doesNotMatch(html, /<input/);
    const loading = renderToStaticMarkup(createElement(LeaderboardScreen));
    assert.match(loading, /Загружаем рейтинг/);
    assert.doesNotMatch(loading, /Пока нет участников/);
});
