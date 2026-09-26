CREATE TABLE email_challenges (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    link_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes',
    consumed_at TIMESTAMPTZ
);
CREATE INDEX email_challenges_email_time_idx ON email_challenges (email, created_at DESC);
CREATE INDEX email_challenges_time_idx ON email_challenges (created_at);

CREATE TABLE telegram_login_flows (
    state_hash TEXT PRIMARY KEY,
    verifier TEXT NOT NULL,
    link_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE INDEX telegram_login_flows_time_idx ON telegram_login_flows (created_at);
