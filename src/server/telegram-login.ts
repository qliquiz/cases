import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { VerifiedIdentity } from './identities';
import { TelegramLoginError } from './telegram-errors';

const telegramKeys = createRemoteJWKSet(
    new URL('https://oauth.telegram.org/.well-known/jwks.json'),
);

export async function verifyTelegramIdToken(
    token: string,
    clientId: string,
    keys: JWTVerifyGetKey = telegramKeys,
): Promise<VerifiedIdentity> {
    const { payload } = await jwtVerify(token, keys, {
        issuer: 'https://oauth.telegram.org',
        audience: clientId,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'sub', 'id'],
        maxTokenAge: '10m',
    });
    // Normalize only after signature and claims verification. Never substitute OIDC sub.
    const id =
        typeof payload.id === 'string' && /^[1-9][0-9]{0,15}$/.test(payload.id)
            ? Number(payload.id)
            : payload.id;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
        throw new TelegramLoginError('token_verify', 'invalid_profile_id');
    if (typeof payload.sub !== 'string' || !payload.sub)
        throw new TelegramLoginError('token_verify', 'invalid_subject');
    return {
        provider: 'telegram',
        subject: String(id),
        name:
            typeof payload.name === 'string' && payload.name.length <= 200
                ? payload.name
                : 'Игрок',
    };
}
