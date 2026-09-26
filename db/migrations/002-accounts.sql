ALTER TABLE app_users ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sessions ADD COLUMN user_id UUID;
ALTER TABLE openings ADD COLUMN user_id UUID;
ALTER TABLE inventory_items ADD COLUMN user_id UUID;

UPDATE sessions s SET user_id = u.id FROM app_users u WHERE s.telegram_id = u.telegram_id;
UPDATE openings o SET user_id = u.id FROM app_users u WHERE o.telegram_id = u.telegram_id;
UPDATE inventory_items i SET user_id = u.id FROM app_users u WHERE i.telegram_id = u.telegram_id;

ALTER TABLE sessions DROP COLUMN telegram_id;
ALTER TABLE openings DROP COLUMN telegram_id;
ALTER TABLE inventory_items DROP COLUMN telegram_id;
ALTER TABLE app_users DROP CONSTRAINT app_users_pkey;
ALTER TABLE app_users ADD PRIMARY KEY (id);

CREATE TABLE identities (
    provider TEXT NOT NULL CHECK (provider IN ('telegram', 'email')),
    subject TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject),
    UNIQUE (user_id, provider)
);
INSERT INTO identities (provider, subject, user_id)
SELECT 'telegram', telegram_id::text, id FROM app_users;
ALTER TABLE app_users DROP COLUMN telegram_id;

ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sessions ADD FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE openings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE openings ADD FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE openings ADD UNIQUE (user_id, request_id);
ALTER TABLE inventory_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE inventory_items ADD FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX openings_user_time_idx ON openings (user_id, opened_at DESC);
CREATE INDEX inventory_user_time_idx ON inventory_items (user_id, created_at DESC);
