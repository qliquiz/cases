import { findCase } from './catalog';
import { type CraftInput, craftRarities } from './crafting';

type Entry = CraftInput & { id: string; consumedAt?: string | null };

export function duplicateSelection(
    entries: Entry[],
    selected: string[],
    rarity: string,
    caseId: string,
) {
    const next = [...selected];
    const available = entries.filter((x) => !x.consumedAt);
    const total = new Map<string, number>();
    const chosen = new Map<string, number>();
    for (const entry of available) {
        total.set(entry.itemId, (total.get(entry.itemId) ?? 0) + 1);
        if (next.includes(entry.id))
            chosen.set(entry.itemId, (chosen.get(entry.itemId) ?? 0) + 1);
    }
    for (const entry of available) {
        const item = findCase(entry.caseId)?.drops.find(
            (x) => x.id === entry.itemId,
        );
        if (next.length >= 10) break;
        if (
            next.includes(entry.id) ||
            (caseId && caseId !== entry.caseId) ||
            item?.rarity !== rarity ||
            !craftRarities.some((x) => x === rarity)
        )
            continue;
        if (
            (chosen.get(entry.itemId) ?? 0) >=
            (total.get(entry.itemId) ?? 0) - 1
        )
            continue;
        next.push(entry.id);
        chosen.set(entry.itemId, (chosen.get(entry.itemId) ?? 0) + 1);
    }
    return next;
}
