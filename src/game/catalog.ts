export const demoCase = {
    id: 'first-light',
    name: 'Первый свет',
    description: 'Пробный кейс с вымышленными предметами и открытыми шансами.',
    drops: [
        {
            id: 'slate',
            name: 'Сланец',
            rarity: 'Обычный',
            weight: 6500,
            accent: '#94a3b8',
        },
        {
            id: 'copper',
            name: 'Медь',
            rarity: 'Редкий',
            weight: 2500,
            accent: '#60a5fa',
        },
        {
            id: 'orchid',
            name: 'Орхидея',
            rarity: 'Эпический',
            weight: 800,
            accent: '#c084fc',
        },
        {
            id: 'solar',
            name: 'Солнечный',
            rarity: 'Легендарный',
            weight: 180,
            accent: '#fbbf24',
        },
        {
            id: 'nova',
            name: 'Нова',
            rarity: 'Особый',
            weight: 20,
            accent: '#fb7185',
        },
    ],
} as const;

export type DemoDrop = (typeof demoCase.drops)[number];

export const totalWeight = demoCase.drops.reduce(
    (sum, drop) => sum + drop.weight,
    0,
);
