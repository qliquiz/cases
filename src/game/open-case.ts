import { randomInt } from 'node:crypto';

import { featuredCase } from './catalog';
import { drawSimulatedDrop } from './simulation';

type CaseDrop = (typeof featuredCase.drops)[number];

export function openVirtualCase(
    caseId: string,
    draw: (maxExclusive: number) => number = randomInt,
): CaseDrop {
    if (caseId !== featuredCase.id) {
        throw new Error('Неизвестный кейс');
    }

    return drawSimulatedDrop(featuredCase, draw);
}
