import { readFile } from 'node:fs/promises';

const migrations = [
    ['001-initial', new URL('../db/schema.sql', import.meta.url)],
    [
        '002-accounts',
        new URL('../db/migrations/002-accounts.sql', import.meta.url),
    ],
    [
        '003-auth-flows',
        new URL('../db/migrations/003-auth-flows.sql', import.meta.url),
    ],
    [
        '004-analytics',
        new URL('../db/migrations/004-analytics.sql', import.meta.url),
    ],
    [
        '005-opening-limit-reset',
        new URL(
            '../db/migrations/005-opening-limit-reset.sql',
            import.meta.url,
        ),
    ],
];

export async function migrate(sql) {
    await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(170926, 1)`;
        await tx`create table if not exists schema_migrations (
            version text primary key, applied_at timestamptz not null default now()
        )`;
        for (const [version, file] of migrations) {
            const done =
                await tx`select version from schema_migrations where version = ${version}`;
            if (done.length) continue;
            await tx.unsafe(await readFile(file, 'utf8')).simple();
            await tx`insert into schema_migrations (version) values (${version})`;
        }
    });
}
