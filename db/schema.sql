CREATE TABLE IF NOT EXISTS app_users (
    telegram_id BIGINT PRIMARY KEY,
    first_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES app_users(telegram_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (telegram_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS openings (
    id UUID PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES app_users(telegram_id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_snapshot JSONB,
    drop_table_version TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (telegram_id, request_id)
);
ALTER TABLE openings ADD COLUMN IF NOT EXISTS item_snapshot JSONB;
CREATE INDEX IF NOT EXISTS openings_user_time_idx
    ON openings (telegram_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY,
    opening_id UUID NOT NULL UNIQUE REFERENCES openings(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL REFERENCES app_users(telegram_id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_user_time_idx
    ON inventory_items (telegram_id, created_at DESC);
