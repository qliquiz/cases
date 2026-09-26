import assert from 'node:assert/strict';
import { test } from 'node:test';

import { telegramFailure } from '../server/telegram-errors';

test('диагностика JOSE не зависит от экземпляра пакета и не раскрывает payload', () => {
    const error = Object.assign(new Error('PRIVATE'), {
        code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
        claim: 'aud',
        payload: { id: 'PRIVATE' },
    });
    assert.deepEqual(telegramFailure(error, 'token_verify'), {
        stage: 'token_verify',
        reason: 'claim_aud',
    });
    assert.deepEqual(
        telegramFailure(
            Object.assign(new Error('PRIVATE'), {
                code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
            }),
            'token_verify',
        ),
        {
            stage: 'token_verify',
            reason: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
        },
    );
    assert.deepEqual(
        telegramFailure(
            Object.assign(new Error('PRIVATE'), {
                code: 'ERR_JWT_CLAIM_VALIDATION_FAILED',
                claim: 'PRIVATE',
            }),
            'token_verify',
        ),
        { stage: 'token_verify', reason: 'claim_other' },
    );
});

test('сетевые и runtime ошибки различаются без вывода сообщения или cause', () => {
    assert.deepEqual(
        telegramFailure(
            new TypeError('PRIVATE', {
                cause: { code: 'ECONNRESET', token: 'PRIVATE' },
            }),
            'token_verify',
        ),
        { stage: 'token_verify', reason: 'network_error' },
    );
    assert.deepEqual(
        telegramFailure(new TypeError('PRIVATE'), 'token_verify'),
        { stage: 'token_verify', reason: 'type_error' },
    );
    assert.deepEqual(telegramFailure(new Error('PRIVATE'), 'token_verify'), {
        stage: 'token_verify',
        reason: 'failed',
    });
});
