import { randomInt } from 'node:crypto';

import { type CaseDrop, findCase } from './catalog';
import { drawSimulatedDrop } from './simulation';

export function openVirtualCase(
    caseId: string,
    draw: (maxExclusive: number) => number = randomInt,
): CaseDrop {
    const selectedCase = findCase(caseId);
    if (!selectedCase) {
        throw new Error('Неизвестный кейс');
    }

    return drawSimulatedDrop(selectedCase, draw);
}
