CREATE TABLE IF NOT EXISTS rooms (
    room_id     TEXT PRIMARY KEY,
    invite_code TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_snapshots (
    id         BIGSERIAL PRIMARY KEY,
    room_id    TEXT NOT NULL,
    state      JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_room_time
    ON room_snapshots (room_id, created_at DESC);