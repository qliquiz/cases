import type { Sql } from 'postgres';

import { caseCatalog } from '@/game/catalog';

export type PlayerStats = {
    nickname: string | null;
    rank: number | null;
    uniqueItems: number;
    openings: number;
    rareDrops: number;
};
export type LeaderboardEntry = PlayerStats & {
    nickname: string;
    rank: number;
    isYou: boolean;
};
export type LeaderboardSnapshot = {
    entries: LeaderboardEntry[];
    mine: PlayerStats | null;
    participants: number;
};

const rareIds = [
    ...new Set(
        caseCatalog.flatMap((item) => item.rareDrops.map((drop) => drop.id)),
    ),
];

export async function getLeaderboard(
    sql: Sql,
    viewerId?: string,
): Promise<LeaderboardSnapshot> {
    // One statement gives top, own rank and population the same database snapshot.
    const rows = await sql<LeaderboardSnapshot[]>`
        with stats as (
            select u.id, u.public_nickname as nickname,
                   count(distinct o.item_id)::int as unique_items,
                   count(o.id)::int as openings,
                   count(o.id) filter (where o.item_id = any(${rareIds}::text[]))::int as rare_drops
            from app_users u left join openings o on o.user_id = u.id
            where u.public_nickname is not null or u.id = ${viewerId ?? null}::uuid
            group by u.id
        ), ranked as (
            select *, rank() over (order by unique_items desc)::int as rank
            from stats where nickname is not null and openings > 0
        ), top_players as (
            select nickname, rank, unique_items as "uniqueItems", openings,
                   rare_drops as "rareDrops", coalesce(id = ${viewerId ?? null}::uuid, false) as "isYou"
            from ranked order by unique_items desc, lower(nickname), id limit 50
        )
        select coalesce((select jsonb_agg(top_players) from top_players), '[]'::jsonb) as entries,
               (select jsonb_build_object('nickname', s.nickname, 'rank', r.rank,
                   'uniqueItems', s.unique_items, 'openings', s.openings, 'rareDrops', s.rare_drops)
                from stats s left join ranked r on r.id = s.id where s.id = ${viewerId ?? null}::uuid) as mine,
               (select count(*)::int from ranked) as participants
    `;
    return rows[0];
}

export class NicknameError extends Error {}

export async function saveLeaderboardNickname(
    sql: Sql,
    userId: string,
    nickname: string | null,
) {
    if (
        nickname !== null &&
        (typeof nickname !== 'string' ||
            !/^[A-Za-zА-Яа-яЁё0-9 _-]{3,24}$/.test(nickname) ||
            !/[A-Za-zА-Яа-яЁё]/.test(nickname) ||
            nickname.trim() !== nickname)
    ) {
        throw new NicknameError(
            'Ник: 3–24 символа, буквы, цифры, пробел, _ или -. Нужна хотя бы одна буква.',
        );
    }
    try {
        const updated =
            await sql`update app_users set public_nickname = ${nickname} where id = ${userId} returning id`;
        if (!updated.length)
            throw new NicknameError('Аккаунт не найден. Войдите заново.');
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === '23505'
        )
            throw new NicknameError('Этот ник уже занят. Выберите другой.');
        throw error;
    }
}
