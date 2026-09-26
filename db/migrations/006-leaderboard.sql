-- Public nicknames are opt-in; never copy names or identities from auth providers.
ALTER TABLE app_users ADD COLUMN public_nickname TEXT
    CHECK (public_nickname IS NULL OR char_length(public_nickname) BETWEEN 3 AND 24);
CREATE UNIQUE INDEX app_users_public_nickname_unique ON app_users (lower(public_nickname))
    WHERE public_nickname IS NOT NULL;
