import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateKeyPair, SignJWT } from 'jose';

import { verifyTelegramIdToken } from '../server/telegram-login';

test('веб-вход проверяет подпись, audience и срок, а identity берёт из Telegram id, не sub', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const sign = (aud = '1234', exp = '5m') =>
        new SignJWT({ id: 987654321, name: 'Ada' })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer('https://oauth.telegram.org')
            .setAudience(aud)
            .setSubject('opaque-oidc-sub')
            .setIssuedAt()
            .setExpirationTime(exp)
            .sign(privateKey);
    assert.deepEqual(
        await verifyTelegramIdToken(
            await sign(),
            '1234',
            async () => publicKey,
        ),
        { provider: 'telegram', subject: '987654321', name: 'Ada' },
    );
    await assert.rejects(
        verifyTelegramIdToken(
            await sign('other-app'),
            '1234',
            async () => publicKey,
        ),
    );
    await assert.rejects(
        verifyTelegramIdToken(
            await sign('1234', '-1m'),
            '1234',
            async () => publicKey,
        ),
    );
    const other = await generateKeyPair('RS256');
    await assert.rejects(
        verifyTelegramIdToken(
            await sign(),
            '1234',
            async () => other.publicKey,
        ),
    );
});
