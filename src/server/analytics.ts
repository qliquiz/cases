import type { Sql } from 'postgres';

import { type ActivityEvent, isActivityEvent } from '@/game/analytics-events';

export async function recordActivity(
    sql: Sql,
    userId: string,
    event: ActivityEvent,
) {
    if (!isActivityEvent(event)) throw new Error('Unknown analytics event');
    await sql`
        insert into analytics_daily (user_id, event) values (${userId}, ${event})
        on conflict do nothing
    `;
}

export type AnalyticsDay = {
    day: string;
    activeUsers: number;
    collectionViewers: number;
    openings: number;
    firstOpeners: number;
    d1Eligible: number;
    d1Returned: number;
    d7Eligible: number;
    d7Returned: number;
};

// Not a Server Action: only the operator's CLI can access this aggregate report.
export async function getAnalyticsReport(sql: Sql, asOf?: Date) {
    return sql.begin(async (tx) => {
        await tx`set transaction read only`;
        const [meta] = await tx<{ started: Date; as_of: Date }[]>`
            select applied_at as started, coalesce(${asOf?.toISOString() ?? null}::timestamptz, now()) as as_of
            from schema_migrations where version = '004-analytics'
        `;
        if (!meta) throw new Error('Apply migration 004-analytics first');
        const days = await tx<AnalyticsDay[]>`
            with bounds as (
                select ${meta.started.toISOString()}::timestamptz as started,
                       ${meta.as_of.toISOString()}::timestamptz as as_of,
                       (${meta.as_of.toISOString()}::timestamptz at time zone 'UTC')::date as today
            ), first_openings as (
                select user_id, min(opened_at) as first_at from openings group by user_id
            ), cohorts as (
                select user_id, (first_at at time zone 'UTC')::date as day
                from first_openings, bounds where first_at >= started and first_at <= as_of
            ), activity as (
                select user_id, day from analytics_daily, bounds
                where day >= (started at time zone 'UTC')::date and day <= today
                union
                select user_id, (opened_at at time zone 'UTC')::date as day
                from openings, bounds where opened_at >= started and opened_at <= as_of
            ), days as (
                select generate_series(
                    greatest((started at time zone 'UTC')::date, today - 29)::timestamp,
                    today::timestamp, interval '1 day'
                )::date as day from bounds
            )
            select d.day::text as day,
                (select count(*)::int from activity a where a.day = d.day) as "activeUsers",
                (select count(*)::int from analytics_daily a where a.day = d.day and event = 'collection_view') as "collectionViewers",
                (select count(*)::int from openings o where (o.opened_at at time zone 'UTC')::date = d.day and opened_at >= b.started and opened_at <= b.as_of) as openings,
                (select count(*)::int from cohorts c where c.day = d.day) as "firstOpeners",
                (select count(*)::int from cohorts c where c.day = d.day and c.day + 1 < b.today) as "d1Eligible",
                (select count(*)::int from cohorts c where c.day = d.day and c.day + 1 < b.today
                    and exists (select 1 from activity a where a.user_id = c.user_id and a.day = c.day + 1)) as "d1Returned",
                (select count(*)::int from cohorts c where c.day = d.day and c.day + 7 < b.today) as "d7Eligible",
                (select count(*)::int from cohorts c where c.day = d.day and c.day + 7 < b.today
                    and exists (select 1 from activity a where a.user_id = c.user_id and a.day = c.day + 7)) as "d7Returned"
            from days d cross join bounds b order by d.day
        `;
        return {
            trackingStartedAt: meta.started.toISOString(),
            asOf: meta.as_of.toISOString(),
            days: [...days],
        };
    });
}
