import { randomUUID } from 'node:crypto';

import type { Sql, TransactionSql } from 'postgres';

export type VerifiedIdentity = {
    provider: 'telegram' | 'email';
    subject: string;
    name: string;
};

export class IdentityConflict extends Error {
    constructor() {
        super(
            'Этот способ входа уже связан с другим аккаунтом или у аккаунта уже есть такая привязка.',
        );
    }
}

// Call only after proof of ownership has been verified on the server.
export async function resolveIdentity(
    tx: TransactionSql,
    identity: VerifiedIdentity,
    linkUserId?: string,
): Promise<string> {
    await tx`select pg_advisory_xact_lock(hashtextextended(${identity.provider + ':' + identity.subject}, 0))`;
    if (linkUserId) {
        const users =
            await tx`select id from app_users where id = ${linkUserId} for update`;
        if (!users.length) throw new Error('Аккаунт не найден');
    }
    const existing = await tx<{ user_id: string }[]>`
        select user_id from identities
        where provider = ${identity.provider} and subject = ${identity.subject}
    `;
    if (existing.length) {
        if (linkUserId && existing[0].user_id !== linkUserId)
            throw new IdentityConflict();
        return existing[0].user_id;
    }
    if (linkUserId) {
        const linked = await tx`select subject from identities
            where user_id = ${linkUserId} and provider = ${identity.provider}`;
        if (linked.length) throw new IdentityConflict();
    }
    const userId = linkUserId ?? randomUUID();
    if (!linkUserId)
        await tx`
        insert into app_users (id, first_name) values (${userId}, ${identity.name})
    `;
    await tx`insert into identities (provider, subject, user_id)
        values (${identity.provider}, ${identity.subject}, ${userId})`;
    return userId;
}

export async function authenticateIdentity(
    sql: Sql,
    identity: VerifiedIdentity,
    linkUserId?: string,
) {
    return sql.begin((tx) => resolveIdentity(tx, identity, linkUserId));
}

export async function getIdentities(sql: Sql, userId: string) {
    return sql<{ provider: 'telegram' | 'email'; subject: string }[]>`
        select provider, subject from identities where user_id = ${userId}
        order by provider
    `;
}
