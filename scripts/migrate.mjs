import nextEnv from '@next/env';
import postgres from 'postgres';

import { migrate } from './migrations.mjs';

nextEnv.loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL не задан');
    process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
try {
    await migrate(sql);
    console.log('Миграции PostgreSQL применены');
} finally {
    await sql.end();
}
