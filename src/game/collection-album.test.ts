import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CollectionPanel } from '../app/collection-panel';
import type { CollectionEntry } from '../server/store';
import { featuredCase, findCase } from './catalog';

function entry(item: CollectionEntry['item'], id: string): CollectionEntry {
    return {
        id,
        caseId: featuredCase.id,
        itemId: item.id,
        item,
        openedAt: '2026-09-26T10:00:00.000Z',
    };
}

function render(collection: CollectionEntry[]) {
    return renderToStaticMarkup(
        createElement(CollectionPanel, {
            collection,
            remaining: 2,
            onRefresh() {},
        }),
    );
}

test('пустой альбом показывает все 30 недостающих позиций и нулевой прогресс', () => {
    const html = renderToStaticMarkup(
        createElement(CollectionPanel, {
            collection: [],
            remaining: 5,
            onRefresh() {},
        }),
    );
    assert.match(html, /aria-label="Прогресс коллекции"/);
    assert.match(html, /aria-valuenow="0"/);
    assert.match(html, /aria-valuemax="30"/);
    assert.equal((html.match(/Ещё не выпал/g) ?? []).length, 30);
    assert.match(html, /Dual Berettas \| Hideout/);
    assert.match(html, /★ Kukri Knife/);
});

test('альбом выбранного кейса учитывает общий нож, но не чужое оружие', () => {
    const chroma = findCase('crate-4061')!;
    const html = renderToStaticMarkup(
        createElement(CollectionPanel, {
            caseData: chroma,
            collection: [
                entry(chroma.rareDrops[0], 'knife'),
                entry(featuredCase.drops[0], 'kilowatt'),
            ],
            remaining: 3,
            onRefresh() {},
        }),
    );
    assert.match(html, /aria-valuemax="74"/);
    assert.match(html, /aria-valuenow="1"/);
    assert.match(html, /Chroma Case/);
    assert.equal((html.match(/Ещё не выпал/g) ?? []).length, 73);
    assert.match(html, /Doppler · Ruby/);
});

test('повторы не увеличивают прогресс, редкие варианты считаются отдельно', () => {
    const html = render([
        entry(featuredCase.drops[0], '1'),
        entry(featuredCase.drops[0], '2'),
        entry(featuredCase.drops[0], '3'),
        entry(featuredCase.rareDrops[0], '4'),
        entry(featuredCase.rareDrops[1], '5'),
    ]);
    assert.match(html, /aria-valuenow="3"/);
    assert.match(html, /aria-valuetext="3 из 30 уникальных предметов"/);
    assert.equal((html.match(/Ещё не выпал/g) ?? []).length, 27);
    assert.match(html, /Дубликаты: 2/);
    assert.match(html, /×3/);
    assert.match(html, />Дубликаты<\/dt><dd[^>]*>2<\/dd>/);
    assert.match(html, />Всего<\/dt><dd[^>]*>5<\/dd>/);
});

test('предмет вне текущего каталога сохраняется отдельной карточкой и не увеличивает прогресс', () => {
    const archived = {
        ...featuredCase.drops[0],
        id: 'archived',
        name: 'Old item snapshot',
    };
    const html = render([entry(archived, '1'), entry(archived, '2')]);
    assert.match(html, /aria-valuenow="0"/);
    assert.match(html, /Вне текущего альбома/);
    assert.match(html, /Old item snapshot/);
    assert.match(html, /×2/);
    assert.equal((html.match(/Ещё не выпал/g) ?? []).length, 30);
});

test('полный альбом достигает 100 процентов без учёта повторов', () => {
    const items = [...featuredCase.drops, ...featuredCase.rareDrops];
    const html = render([
        ...items.map((item, i) => entry(item, String(i))),
        entry(items[0], 'repeat'),
    ]);
    assert.match(html, /aria-valuenow="30"/);
    assert.match(html, /Альбом собран полностью!/);
    assert.match(html, /width:100%/);
    assert.equal((html.match(/Ещё не выпал/g) ?? []).length, 0);
});
