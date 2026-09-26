import { errors } from 'jose';

export type TelegramLoginStage =
    | 'config'
    | 'begin'
    | 'state'
    | 'flow'
    | 'token_exchange'
    | 'token_verify'
    | 'identity'
    | 'session';

// Only fixed, non-sensitive reasons cross the log/UI boundary. Never log raw errors or JWTs.
export class TelegramLoginError extends Error {
    constructor(
        readonly stage: TelegramLoginStage,
        readonly reason: string,
    ) {
        super(`telegram_${stage}:${reason}`);
    }
}

export function telegramFailure(error: unknown, fallback: TelegramLoginStage) {
    if (error instanceof TelegramLoginError)
        return { stage: error.stage, reason: error.reason };
    const details = error && typeof error === 'object' ? error : {};
    const code =
        'code' in details && typeof details.code === 'string'
            ? details.code
            : '';
    // A production bundle can contain separate JOSE class instances. Classify by
    // allowlisted codes only; this affects diagnostics, never token acceptance.
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
        const rawClaim =
            'claim' in details && typeof details.claim === 'string'
                ? details.claim
                : '';
        const claim = ['iss', 'aud', 'exp', 'iat', 'sub', 'id'].includes(
            rawClaim,
        )
            ? rawClaim
            : 'other';
        return { stage: fallback, reason: `claim_${claim}` };
    }
    {
        const allowed = [
            'ERR_JWT_EXPIRED',
            'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
            'ERR_JOSE_ALG_NOT_ALLOWED',
            'ERR_JWKS_NO_MATCHING_KEY',
            'ERR_JWKS_TIMEOUT',
            'ERR_JWS_INVALID',
            'ERR_JWT_INVALID',
        ];
        if (allowed.includes(code)) return { stage: fallback, reason: code };
    }
    if (error instanceof errors.JOSEError)
        return { stage: fallback, reason: 'invalid_token' };
    if (error instanceof TypeError) {
        const cause = error.cause;
        const networkCodes = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ENOTFOUND',
            'EAI_AGAIN',
            'ETIMEDOUT',
            'UND_ERR_CONNECT_TIMEOUT',
            'UND_ERR_SOCKET',
        ];
        const isNetwork =
            cause &&
            typeof cause === 'object' &&
            'code' in cause &&
            typeof cause.code === 'string' &&
            networkCodes.includes(cause.code);
        return {
            stage: fallback,
            reason: isNetwork ? 'network_error' : 'type_error',
        };
    }
    return { stage: fallback, reason: 'failed' };
}
