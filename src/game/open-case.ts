import { randomInt } from 'node:crypto';

import { demoCase, type DemoDrop, totalWeight } from './catalog';

export function openVirtualCase(
    caseId: string,
    draw: (maxExclusive: number) => number = randomInt,
): DemoDrop {
    if (caseId !== demoCase.id) {
        throw new Error('Неизвестный кейс');
    }

    const ticket = draw(totalWeight);
    if (!Number.isInteger(ticket) || ticket < 0 || ticket >= totalWeight) {
        throw new Error('Некорректный результат генератора случайных чисел');
    }

    let boundary = 0;
    for (const drop of demoCase.drops) {
        boundary += drop.weight;
        if (ticket < boundary) return drop;
    }

    throw new Error('Таблица выпадения настроена неверно');
}
