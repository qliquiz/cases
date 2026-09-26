import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { Sql, TransactionSql } from 'postgres';

import { caseCatalog, type CaseDrop, findCase } from '@/game/catalog';

export type CaseItem = CaseDrop;
import { openVirtualCase } from '@/game/open-case';

import { authenticateIdentity } from './identities';

const dailyLimit = 5;
const sessionDays = 30;
const maxSessionsPerUser = 5;
const knownDrops = new Map(
    caseCatalog
        .flatMap((item) => [...item.drops, ...item.rareDrops])
        .map((drop) => [drop.id, drop]),
);

export type CollectionEntry = {
    id: string;
    caseId: string;
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
    return authenticateIdentity(sql, {
        provider: 'telegram',
        subject: telegramId,
        name: firstName,
    });
}

export async function createSession(sql: Sql, userId: string) {
    const token = randomBytes(32).toString('base64url');
    await sql.begin(async (tx) => {
        await tx`
            select id from app_users
            where id = ${userId}
            for update
        `;
        await tx`
            delete from sessions
            where user_id = ${userId} and expires_at <= now()
        `;
        await tx`
            insert into sessions (token_hash, user_id, expires_at)
            values (${tokenHash(token)}, ${userId},
                    now() + ${sessionDays} * interval '1 day')
        `;
        await tx`
            delete from sessions where token_hash in (
                select token_hash from sessions
                where user_id = ${userId}
                order by created_at desc, token_hash desc
                offset ${maxSessionsPerUser}
            )
        `;
    });
    return token;
}

export async function getSession(sql: Sql, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const rows = await sql<{ user_id: string; first_name: string }[]>`
        select users.id::text as user_id, users.first_name
        from sessions
        join app_users as users on users.id = sessions.user_id
        where sessions.token_hash = ${tokenHash(token)}
          and sessions.expires_at > now()
    `;
    if (!rows.length) return null;
    return {
        userId: rows[0].user_id,
        firstName: rows[0].first_name,
    };
}

export async function getDailyRemaining(
    sql: Sql | TransactionSql,
    userId: string,
) {
    const rows = await sql<{ used: number }[]>`
        select count(*)::int as used
        from openings
        where user_id = ${userId}
          and opened_at >=
            (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
    `;
    return Math.max(0, dailyLimit - rows[0].used);
}

export async function getCollection(
    sql: Sql,
    userId: string,
): Promise<CollectionEntry[]> {
    const rows = await sql<
        {
            id: string;
            case_id: string;
            item_id: string;
            item_snapshot: CaseItem | null;
            opened_at: Date;
        }[]
    >`
        select inventory_items.id::text as id,
               openings.case_id,
               inventory_items.item_id,
               openings.item_snapshot,
               openings.opened_at
        from inventory_items
        join openings on openings.id = inventory_items.opening_id
        where inventory_items.user_id = ${userId}
        order by openings.opened_at desc, inventory_items.id desc
    `;
    return rows.map((row) => ({
        id: row.id,
        caseId: row.case_id,
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
    userId: string,
    caseId: string,
    requestId: string,
    draw?: (maxExclusive: number) => number,
) {
    const selectedCase = findCase(caseId);
    if (!selectedCase) throw new Error('Неизвестный кейс');
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            requestId,
        )
    ) {
        throw new Error('Некорректный ID открытия');
    }

    return sql.begin(async (tx) => {
        const users = await tx`
            select id from app_users
            where id = ${userId}
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
            where user_id = ${userId} and request_id = ${requestId}
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
                remaining: await getDailyRemaining(tx, userId),
            };
        }

        const remaining = await getDailyRemaining(tx, userId);
        if (remaining <= 0)
            throw new Error('Лимит 5 открытий на сегодня исчерпан');

        const drop = openVirtualCase(caseId, draw);
        const openingId = randomUUID();
        await tx`
            insert into openings
                (id, user_id, request_id, case_id, item_id, item_snapshot, drop_table_version)
            values
                (${openingId}, ${userId}, ${requestId}, ${caseId},
                 ${drop.id}, ${sql.json(drop)}, ${selectedCase.dropTableVersion})
        `;
        await tx`
            insert into inventory_items (id, opening_id, user_id, item_id)
            values (${randomUUID()}, ${openingId}, ${userId}, ${drop.id})
        `;
        return { drop, remaining: remaining - 1 };
    });
}
