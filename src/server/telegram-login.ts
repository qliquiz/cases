import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { VerifiedIdentity } from './identities';

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
    if (
        !Number.isSafeInteger(payload.id) ||
        Number(payload.id) <= 0 ||
        typeof payload.sub !== 'string' ||
        !payload.sub
    )
        throw new Error('Некорректная личность Telegram');
    return {
        provider: 'telegram',
        subject: String(payload.id),
        name:
            typeof payload.name === 'string' && payload.name.length <= 200
                ? payload.name
                : 'Игрок',
    };
}
