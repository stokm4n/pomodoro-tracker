BEGIN;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_user_deleted_at_idx
    ON tasks(user_id, deleted_at);

COMMIT;
