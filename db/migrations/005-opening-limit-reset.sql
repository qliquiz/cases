-- A reset discounts existing openings without deleting inventory or history.
ALTER TABLE app_users
    ADD COLUMN quota_reset_day DATE,
    ADD COLUMN quota_reset_used INTEGER NOT NULL DEFAULT 0 CHECK (quota_reset_used >= 0);
