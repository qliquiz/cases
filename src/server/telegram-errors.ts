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
    if (error instanceof errors.JWTClaimValidationFailed) {
        const claim = ['iss', 'aud', 'exp', 'iat', 'sub', 'id'].includes(
            error.claim,
        )
            ? error.claim
            : 'other';
        return { stage: fallback, reason: `claim_${claim}` };
    }
    if (error instanceof errors.JOSEError) {
        const allowed = [
            'ERR_JWT_EXPIRED',
            'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
            'ERR_JOSE_ALG_NOT_ALLOWED',
            'ERR_JWKS_NO_MATCHING_KEY',
            'ERR_JWKS_TIMEOUT',
            'ERR_JWS_INVALID',
            'ERR_JWT_INVALID',
        ];
        return {
            stage: fallback,
            reason: allowed.includes(error.code) ? error.code : 'invalid_token',
        };
    }
    return { stage: fallback, reason: 'failed' };
}
