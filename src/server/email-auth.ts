import {
    createHash,
    createHmac,
    randomBytes,
    randomInt,
    timingSafeEqual,
} from 'node:crypto';

import type { Sql } from 'postgres';

import { IdentityConflict, resolveIdentity } from './identities';

export function normalizeEmail(value: string) {
    const email = value.trim().toLowerCase();
    if (
        email.length > 254 ||
        !/^[\x21-\x7e]+$/.test(email) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        throw new Error('Некорректный email');
    }
    return email;
}

function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

function codeHash(secret: string, token: string, code: string) {
    if (secret.length < 32)
        throw new Error('AUTH_SECRET должен содержать минимум 32 символа');
    return createHmac('sha256', secret)
        .update(token + ':' + code)
        .digest('hex');
}

type EmailRequest = { email: string; secret: string; linkUserId?: string };
type EmailConfirmation = {
    token: string;
    code: string;
    secret: string;
    currentUserId?: string;
};
export type EmailResult =
    | { ok: true; userId: string }
    | { ok: false; error: 'invalid-code' | 'identity-conflict' };

export async function requestEmailCode(
    sql: Sql,
    input: EmailRequest,
    send: (email: string, code: string) => Promise<void>,
) {
    const email = normalizeEmail(input.email);
    const token = randomBytes(32).toString('base64url');
    const code = randomInt(1_000_000).toString().padStart(6, '0');
    const digest = codeHash(input.secret, token, code);
    await sql.begin(async (tx) => {
        // A shared database budget also bounds sends across instances and arbitrary email addresses.
        await tx`select pg_advisory_xact_lock(170926, 2)`;
        await tx`delete from email_challenges where created_at < now() - interval '1 day'`;
        const limits = await tx<
            { total: number; per_email: number; recent: number }[]
        >`
            select count(*)::int as total,
                count(*) filter (where email = ${email})::int as per_email,
                count(*) filter (where email = ${email} and created_at > now() - interval '60 seconds')::int as recent
            from email_challenges where created_at > now() - interval '1 hour'
        `;
        if (
            limits[0].total >= 100 ||
            limits[0].per_email >= 5 ||
            limits[0].recent > 0
        ) {
            throw new Error('Слишком много запросов. Повторите позже.');
        }
        await tx`update email_challenges set consumed_at = now()
            where email = ${email} and consumed_at is null`;
        await tx`insert into email_challenges (token_hash, email, code_hash, link_user_id)
            values (${hash(token)}, ${email}, ${digest}, ${input.linkUserId ?? null})`;
    });
    try {
        await send(email, code);
    } catch {
        await sql`update email_challenges set consumed_at = now() where token_hash = ${hash(token)}`;
        throw new Error('Не удалось отправить письмо');
    }
    return token;
}

export async function confirmEmailCode(
    sql: Sql,
    input: EmailConfirmation,
): Promise<EmailResult> {
    const invalid = { ok: false, error: 'invalid-code' } as const;
    if (!/^[A-Za-z0-9_-]{43}$/.test(input.token) || input.code.length > 32)
        return invalid;
    const digest = codeHash(input.secret, input.token, input.code);
    return sql.begin(async (tx) => {
        const rows = await tx<
            {
                email: string;
                code_hash: string;
                link_user_id: string | null;
                attempts: number;
                valid: boolean;
                consumed_at: Date | null;
            }[]
        >`select email, code_hash, link_user_id, attempts, consumed_at, expires_at > now() as valid
            from email_challenges where token_hash = ${hash(input.token)} for update`;
        const row = rows[0];
        if (
            !row ||
            !row.valid ||
            row.consumed_at ||
            row.attempts >= 5 ||
            row.link_user_id !== (input.currentUserId ?? null)
        )
            return invalid;
        await tx`update email_challenges set attempts = attempts + 1 where token_hash = ${hash(input.token)}`;
        if (
            !timingSafeEqual(
                Buffer.from(row.code_hash, 'hex'),
                Buffer.from(digest, 'hex'),
            )
        )
            return invalid;
        await tx`update email_challenges set consumed_at = now() where token_hash = ${hash(input.token)}`;
        try {
            const userId = await resolveIdentity(
                tx,
                { provider: 'email', subject: row.email, name: 'Игрок' },
                row.link_user_id ?? undefined,
            );
            return { ok: true, userId } as const;
        } catch (error) {
            if (error instanceof IdentityConflict)
                return { ok: false, error: 'identity-conflict' } as const;
            throw error;
        }
    });
}
