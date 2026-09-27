import { type CaseDrop, findCase } from './catalog';

export const craftRulesVersion = 'craft-10-v1';
export const craftRarities = [
    'Mil-Spec Grade',
    'Restricted',
    'Classified',
] as const;
export type CraftInput = { caseId: string; itemId: string };
export type CraftOutcome = {
    caseId: string;
    item: CaseDrop;
    probability: number;
};

export class CraftError extends Error {}

// For this limited catalog each ordinary case pool represents one collection.
// Never infer eligibility from a client-supplied rarity or saved display snapshot.
export function craftOutputs(input: CraftInput): CaseDrop[] {
    const pool = findCase(input.caseId);
    const item = pool?.drops.find((x) => x.id === input.itemId);
    const tier = craftRarities.findIndex((x) => x === item?.rarity);
    if (!pool || tier < 0)
        throw new CraftError('Этот предмет пока нельзя использовать в крафте');
    const next = [...craftRarities, 'Covert'][tier + 1];
    const outputs = pool.drops.filter((x) => x.rarity === next);
    if (!outputs.length)
        throw new CraftError('Для коллекции нет результатов крафта');
    return outputs;
}

function validate(inputs: CraftInput[]) {
    if (inputs.length !== 10)
        throw new CraftError('Выберите ровно 10 предметов');
    const groups = inputs.map(craftOutputs);
    if (groups.some((x) => x[0].rarity !== groups[0][0].rarity))
        throw new CraftError('Все предметы должны быть одной редкости');
    return groups;
}

export function previewCraft(inputs: CraftInput[]): CraftOutcome[] {
    const groups = validate(inputs);
    const collections = new Map<
        string,
        { count: number; outputs: CaseDrop[] }
    >();
    inputs.forEach((input, i) => {
        const prior = collections.get(input.caseId);
        collections.set(input.caseId, {
            count: (prior?.count ?? 0) + 1,
            outputs: groups[i],
        });
    });
    return [...collections].flatMap(([caseId, { count, outputs }]) =>
        outputs.map((item) => ({
            caseId,
            item,
            probability: count / 10 / outputs.length,
        })),
    );
}

export function drawCraft(inputs: CraftInput[], draw: (max: number) => number) {
    const groups = validate(inputs);
    const pick = (max: number) => {
        const value = draw(max);
        if (!Number.isInteger(value) || value < 0 || value >= max)
            throw new Error(
                'Некорректный результат генератора случайных чисел',
            );
        return value;
    };
    const input = pick(10);
    return {
        caseId: inputs[input].caseId,
        item: groups[input][pick(groups[input].length)],
    };
}
