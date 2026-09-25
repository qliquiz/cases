import { featuredCase } from './catalog';

export type VirtualCase = Pick<typeof featuredCase, 'drops' | 'rareDrops'>;
type CaseDrop = (typeof featuredCase.drops)[number];

// Настройки симуляции. Valve не публикует эти значения для данного кейса.
const tierWeights = [7992, 1598, 320, 64, 26] as const;
const ticketCount = 10_000;

function itemGroups(caseData: VirtualCase): CaseDrop[][] {
    return [
        caseData.drops.filter((item) => item.rarity === 'Mil-Spec Grade'),
        caseData.drops.filter((item) => item.rarity === 'Restricted'),
        caseData.drops.filter((item) => item.rarity === 'Classified'),
        caseData.drops.filter((item) => item.rarity === 'Covert'),
        caseData.rareDrops,
    ];
}

function checkedDraw(
    draw: (maxExclusive: number) => number,
    maxExclusive: number,
) {
    const ticket = draw(maxExclusive);
    if (!Number.isInteger(ticket) || ticket < 0 || ticket >= maxExclusive) {
        throw new Error('Некорректный результат генератора случайных чисел');
    }
    return ticket;
}

export function simulatedChancePercent(
    caseData: VirtualCase,
    itemId: string,
): number {
    const groups = itemGroups(caseData);
    const index = groups.findIndex((group) =>
        group.some((item) => item.id === itemId),
    );
    if (index === -1) throw new Error('Предмета нет в кейсе');

    return ((tierWeights[index] / ticketCount) * 100) / groups[index].length;
}

export function drawSimulatedDrop(
    caseData: VirtualCase,
    draw: (maxExclusive: number) => number,
): CaseDrop {
    const groups = itemGroups(caseData);
    const ticket = checkedDraw(draw, ticketCount);
    let boundary = 0;

    for (let index = 0; index < groups.length; index++) {
        boundary += tierWeights[index];
        if (ticket < boundary) {
            const group = groups[index];
            return group[checkedDraw(draw, group.length)];
        }
    }

    throw new Error('Таблица выпадения настроена неверно');
}
