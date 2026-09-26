import additionalCases from './additional-cases.json';
import kilowattCase from './kilowatt-case.json';

export type CaseDrop = {
    id: string;
    name: string;
    image: string;
    rarity: string;
    accent: string;
    phase?: string;
};
export type CaseDefinition = {
    id: string;
    name: string;
    image: string;
    drops: CaseDrop[];
    rareDrops: CaseDrop[];
    dropTableVersion: string;
};

export const featuredCase: CaseDefinition = {
    ...kilowattCase,
    dropTableVersion: 'kilowatt-sim-v1',
};
export const caseCatalog: CaseDefinition[] = [
    featuredCase,
    ...additionalCases.cases.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
        drops: item.drops,
        rareDrops:
            additionalCases.rarePools[
                item.rarePool as keyof typeof additionalCases.rarePools
            ],
        dropTableVersion: `${item.id}-sim-v1`,
    })),
];

export function findCase(id: string) {
    return caseCatalog.find((item) => item.id === id);
}

export function itemLabel(item: CaseDrop) {
    return item.phase ? `${item.name} · ${item.phase}` : item.name;
}
