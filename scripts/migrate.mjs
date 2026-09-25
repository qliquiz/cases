import { readFile } from 'node:fs/promises';

import nextEnv from '@next/env';
import postgres from 'postgres';

nextEnv.loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL не задан');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
try {
    const schema = await readFile(
        new URL('../db/schema.sql', import.meta.url),
        'utf8',
    );
    await sql.unsafe(schema).simple();
    console.log('Схема PostgreSQL готова');
} finally {
    await sql.end();
}
