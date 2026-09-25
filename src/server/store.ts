import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { Sql, TransactionSql } from 'postgres';

import { featuredCase } from '@/game/catalog';

export type CaseItem = (typeof featuredCase.drops)[number];
import { openVirtualCase } from '@/game/open-case';

const dailyLimit = 5;
const sessionDays = 30;
const maxSessionsPerUser = 5;
const dropTableVersion = 'kilowatt-sim-v1';
const knownDrops = new Map(
    [...featuredCase.drops, ...featuredCase.rareDrops].map((drop) => [
        drop.id,
        drop,
    ]),
);

export type CollectionEntry = {
    id: string;
    itemId: string;
    item: CaseItem;
    openedAt: string;
};

function tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

export async function upsertTelegramUser(
    sql: Sql,
    telegramId: string,
    firstName: string,
) {
    await sql`
        insert into app_users (telegram_id, first_name)
        values (${telegramId}, ${firstName})
        on conflict (telegram_id) do update set first_name = excluded.first_name
    `;
}

export async function createSession(sql: Sql, telegramId: string) {
    const token = randomBytes(32).toString('base64url');
    await sql.begin(async (tx) => {
        await tx`
            select telegram_id from app_users
            where telegram_id = ${telegramId}
            for update
        `;
        await tx`
            delete from sessions
            where telegram_id = ${telegramId} and expires_at <= now()
        `;
        await tx`
            insert into sessions (token_hash, telegram_id, expires_at)
            values (${tokenHash(token)}, ${telegramId},
                    now() + ${sessionDays} * interval '1 day')
        `;
        await tx`
            delete from sessions where token_hash in (
                select token_hash from sessions
                where telegram_id = ${telegramId}
                order by created_at desc, token_hash desc
                offset ${maxSessionsPerUser}
            )
        `;
    });
    return token;
}

export async function getSession(sql: Sql, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const rows = await sql<{ telegram_id: string; first_name: string }[]>`
        select users.telegram_id::text as telegram_id, users.first_name
        from sessions
        join app_users as users on users.telegram_id = sessions.telegram_id
        where sessions.token_hash = ${tokenHash(token)}
          and sessions.expires_at > now()
    `;
    if (!rows.length) return null;
    return {
        telegramId: rows[0].telegram_id,
        firstName: rows[0].first_name,
    };
}

export async function getDailyRemaining(
    sql: Sql | TransactionSql,
    telegramId: string,
) {
    const rows = await sql<{ used: number }[]>`
        select count(*)::int as used
        from openings
        where telegram_id = ${telegramId}
          and opened_at >=
            (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
    `;
    return Math.max(0, dailyLimit - rows[0].used);
}

export async function getCollection(
    sql: Sql,
    telegramId: string,
): Promise<CollectionEntry[]> {
    const rows = await sql<
        {
            id: string;
            item_id: string;
            item_snapshot: CaseItem | null;
            opened_at: Date;
        }[]
    >`
        select inventory_items.id::text as id,
               inventory_items.item_id,
               openings.item_snapshot,
               openings.opened_at
        from inventory_items
        join openings on openings.id = inventory_items.opening_id
        where inventory_items.telegram_id = ${telegramId}
        order by openings.opened_at desc, inventory_items.id desc
    `;
    return rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        item: row.item_snapshot ??
            knownDrops.get(row.item_id) ?? {
                id: row.item_id,
                name: row.item_id,
                image: '',
                rarity: 'Unknown',
                accent: '#64748b',
            },
        openedAt: row.opened_at.toISOString(),
    }));
}

export async function openCaseForUser(
    sql: Sql,
    telegramId: string,
    caseId: string,
    requestId: string,
    draw?: (maxExclusive: number) => number,
) {
    if (caseId !== featuredCase.id) throw new Error('Неизвестный кейс');
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            requestId,
        )
    ) {
        throw new Error('Некорректный ID открытия');
    }

    return sql.begin(async (tx) => {
        const users = await tx`
            select telegram_id from app_users
            where telegram_id = ${telegramId}
            for update
        `;
        if (!users.length) throw new Error('Пользователь не найден');

        const prior = await tx<
            {
                item_id: string;
                case_id: string;
                item_snapshot: CaseItem | null;
            }[]
        >`
            select item_id, case_id, item_snapshot from openings
            where telegram_id = ${telegramId} and request_id = ${requestId}
        `;
        if (prior.length) {
            if (prior[0].case_id !== caseId) {
                throw new Error(
                    'ID открытия уже использован для другого кейса',
                );
            }
            const drop =
                prior[0].item_snapshot ?? knownDrops.get(prior[0].item_id);
            if (!drop) throw new Error('Предмет открытия больше не найден');
            return {
                drop,
                remaining: await getDailyRemaining(tx, telegramId),
            };
        }

        const remaining = await getDailyRemaining(tx, telegramId);
        if (remaining <= 0)
            throw new Error('Лимит 5 открытий на сегодня исчерпан');

        const drop = openVirtualCase(caseId, draw);
        const openingId = randomUUID();
        await tx`
            insert into openings
                (id, telegram_id, request_id, case_id, item_id, item_snapshot, drop_table_version)
            values
                (${openingId}, ${telegramId}, ${requestId}, ${caseId},
                 ${drop.id}, ${sql.json(drop)}, ${dropTableVersion})
        `;
        await tx`
            insert into inventory_items (id, opening_id, telegram_id, item_id)
            values (${randomUUID()}, ${openingId}, ${telegramId}, ${drop.id})
        `;
        return { drop, remaining: remaining - 1 };
    });
}
