import { type CaseDrop } from './catalog';
import { drawSimulatedDrop, type VirtualCase } from './simulation';

export type Reel<T> = { items: T[]; winnerIndex: number };

function browserRandomInt(maxExclusive: number) {
    return Math.floor(Math.random() * maxExclusive);
}

export function createReel(
    caseData: VirtualCase,
    winner: CaseDrop,
    draw: (maxExclusive: number) => number = browserRandomInt,
): Reel<CaseDrop> {
    if (
        ![...caseData.drops, ...caseData.rareDrops].some(
            (item) => item.id === winner.id,
        )
    ) {
        throw new Error('Выбранного предмета нет в кейсе');
    }

    const winnerIndex = 36;
    const items = Array.from({ length: 42 }, () =>
        drawSimulatedDrop(caseData, draw),
    );
    items[winnerIndex] = winner;

    return { items, winnerIndex };
}
