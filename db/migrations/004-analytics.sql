CREATE TABLE analytics_daily (
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
    event TEXT NOT NULL CHECK (event IN ('visit', 'collection_view')),
    PRIMARY KEY (user_id, day, event)
);
CREATE INDEX analytics_daily_day_idx ON analytics_daily(day);
