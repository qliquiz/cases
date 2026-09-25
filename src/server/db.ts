import postgres, { type Sql } from 'postgres';

let connection: Sql | undefined;

export function database(): Sql {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL не задан');
    connection ??= postgres(url, { max: 5 });
    return connection;
}
