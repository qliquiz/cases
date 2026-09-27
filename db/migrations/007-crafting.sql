CREATE TABLE crafts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    input_ids UUID[] NOT NULL CHECK (cardinality(input_ids) = 10),
    input_snapshot JSONB NOT NULL,
    case_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_snapshot JSONB NOT NULL,
    rules_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, request_id)
);
CREATE INDEX crafts_user_time_idx ON crafts (user_id, created_at DESC);

ALTER TABLE inventory_items ALTER COLUMN opening_id DROP NOT NULL;
ALTER TABLE inventory_items
    ADD COLUMN craft_id UUID UNIQUE REFERENCES crafts(id) ON DELETE CASCADE,
    ADD COLUMN consumed_by UUID REFERENCES crafts(id),
    ADD COLUMN consumed_at TIMESTAMPTZ,
    ADD CONSTRAINT inventory_acquisition_source CHECK (num_nonnulls(opening_id, craft_id) = 1),
    ADD CONSTRAINT inventory_consumption CHECK ((consumed_by IS NULL) = (consumed_at IS NULL));
CREATE INDEX inventory_available_idx ON inventory_items (user_id, created_at DESC)
    WHERE consumed_by IS NULL;
