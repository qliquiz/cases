import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateKeyPair, SignJWT } from 'jose';

import { telegramFailure } from '../server/telegram-errors';
import { verifyTelegramIdToken } from '../server/telegram-login';

test('подписанный Telegram profile id в десятичной строке совпадает с числовым ID Mini App', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ id: '987654321', name: 'Ada' })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://oauth.telegram.org')
        .setAudience('1234')
        .setSubject('opaque-oidc-sub')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    try {
        assert.deepEqual(
            await verifyTelegramIdToken(token, '1234', async () => publicKey),
            {
                provider: 'telegram',
                subject: '987654321',
                name: 'Ada',
            },
        );
    } catch (error) {
        // Emit only sanitized classification, never the test JWT.
        assert.fail(JSON.stringify(telegramFailure(error, 'token_verify')));
    }
});

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

test('нормализация ID не принимает нецелые, неоднозначные и небезопасные значения', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    for (const id of [
        0,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
        '',
        '0',
        '-1',
        '01',
        ' 123',
        '123 ',
        '+123',
        '1e3',
        '1.0',
        '9007199254740992',
        true,
        null,
        {},
        [],
    ]) {
        const token = await new SignJWT({ id })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer('https://oauth.telegram.org')
            .setAudience('1234')
            .setSubject('987654321')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
        await assert.rejects(
            verifyTelegramIdToken(token, '1234', async () => publicKey),
            (error) => {
                assert.deepEqual(telegramFailure(error, 'token_verify'), {
                    stage: 'token_verify',
                    reason: 'invalid_profile_id',
                });
                return true;
            },
        );
    }
});

test('строковый ID не обходит подпись, audience, issuer, срок или обязательный profile id', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const other = await generateKeyPair('RS256');
    for (const scenario of [
        'signature',
        'audience',
        'issuer',
        'expired',
        'missing_id',
    ]) {
        const token = await new SignJWT(
            scenario === 'missing_id' ? {} : { id: '987654321' },
        )
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer(
                scenario === 'issuer'
                    ? 'https://evil.test'
                    : 'https://oauth.telegram.org',
            )
            .setAudience(scenario === 'audience' ? 'other-app' : '1234')
            .setSubject('987654321')
            .setIssuedAt()
            .setExpirationTime(scenario === 'expired' ? '-1m' : '5m')
            .sign(scenario === 'signature' ? other.privateKey : privateKey);
        await assert.rejects(
            verifyTelegramIdToken(token, '1234', async () => publicKey),
        );
    }
});
