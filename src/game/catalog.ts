import kilowattCase from './kilowatt-case.json';

export const featuredCase = kilowattCase;
export type CaseDrop = (typeof featuredCase.drops)[number];
