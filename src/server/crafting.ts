import { randomInt, randomUUID } from 'node:crypto';

import type { Sql } from 'postgres';

import { type CaseDrop, findCase } from '@/game/catalog';
import { CraftError, craftRulesVersion, drawCraft } from '@/game/crafting';

const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type CraftRow = {
    id: string;
    input_ids: string[];
    input_snapshot: { id: string; item: CaseDrop }[];
    case_id: string;
    item_snapshot: CaseDrop;
    created_at: Date;
};
function serialize(row: CraftRow) {
    return {
        id: row.id,
        inputs: row.input_snapshot,
        caseId: row.case_id,
        item: row.item_snapshot,
        createdAt: row.created_at.toISOString(),
    };
}

export async function getCraftHistory(sql: Sql, userId: string) {
    const rows = await sql<CraftRow[]>`
        select id, input_ids, input_snapshot, case_id, item_snapshot, created_at
        from crafts where user_id = ${userId}
        order by created_at desc, id desc limit 30
    `;
    return rows.map(serialize);
}

export async function craftForUser(
    sql: Sql,
    userId: string,
    inputIds: unknown,
    requestId: unknown,
    draw: (max: number) => number = randomInt,
) {
    if (typeof requestId !== 'string' || !uuid.test(requestId))
        throw new CraftError('Некорректный ID крафта');
    if (
        !Array.isArray(inputIds) ||
        inputIds.length !== 10 ||
        inputIds.some((x) => typeof x !== 'string' || !uuid.test(x))
    )
        throw new CraftError('Выберите ровно 10 предметов');
    const ids = (inputIds as string[]).map((x) => x.toLowerCase()).sort();
    if (new Set(ids).size !== 10)
        throw new CraftError('Одна копия предмета выбрана несколько раз');
    return sql.begin(async (tx) => {
        const users =
            await tx`select id from app_users where id = ${userId} for update`;
        if (!users.length) throw new CraftError('Пользователь не найден');
        const prior = await tx<CraftRow[]>`
            select id, input_ids, input_snapshot, case_id, item_snapshot, created_at
            from crafts where user_id = ${userId} and request_id = ${requestId}
        `;
        if (prior.length) {
            if (prior[0].input_ids.join(',') !== ids.join(','))
                throw new CraftError(
                    'ID крафта уже использован для другого набора',
                );
            return serialize(prior[0]);
        }
        const inputs = await tx<
            { id: string; caseId: string; itemId: string; item: CaseDrop }[]
        >`
            select i.id, i.item_id as "itemId", coalesce(o.case_id, c.case_id) as "caseId",
                   coalesce(o.item_snapshot, c.item_snapshot) as item
            from inventory_items i
            left join openings o on o.id = i.opening_id
            left join crafts c on c.id = i.craft_id
            where i.user_id = ${userId} and i.id = any(${ids}::uuid[]) and i.consumed_by is null
            order by i.id for update of i
        `;
        if (inputs.length !== 10)
            throw new CraftError(
                'Некоторые предметы уже недоступны. Обновите инвентарь.',
            );
        const result = drawCraft(inputs, draw);
        const id = randomUUID();
        const rows = await tx<CraftRow[]>`
            insert into crafts (id, user_id, request_id, input_ids, input_snapshot, case_id, item_id, item_snapshot, rules_version)
            values (${id}, ${userId}, ${requestId}, ${ids}::uuid[],
                ${sql.json(inputs.map((x) => ({ id: x.id, item: x.item ?? findCase(x.caseId)!.drops.find((item) => item.id === x.itemId)! })))}, ${result.caseId}, ${result.item.id},
                ${sql.json(result.item)}, ${craftRulesVersion})
            returning id, input_ids, input_snapshot, case_id, item_snapshot, created_at
        `;
        await tx`update inventory_items set consumed_by = ${id}, consumed_at = now()
            where user_id = ${userId} and id = any(${ids}::uuid[])`;
        await tx`insert into inventory_items (id, user_id, craft_id, item_id)
            values (${randomUUID()}, ${userId}, ${id}, ${result.item.id})`;
        return serialize(rows[0]);
    });
}
