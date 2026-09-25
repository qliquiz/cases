'use server';

import { openVirtualCase } from '@/game/open-case';

export async function openCase(caseId: string) {
    return openVirtualCase(caseId);
}
