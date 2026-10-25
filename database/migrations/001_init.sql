BEGIN;

-- Registered users and administrators. Passwords are stored only as hashes.
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_username_not_blank CHECK (BTRIM(username) <> ''),
    CONSTRAINT users_password_hash_not_blank CHECK (BTRIM(password_hash) <> ''),
    CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

-- Each user has exactly one set of Pomodoro and notification settings.
CREATE TABLE IF NOT EXISTS user_settings (
    user_id BIGINT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,
    work_duration_minutes INTEGER NOT NULL DEFAULT 25,
    short_break_minutes INTEGER NOT NULL DEFAULT 5,
    long_break_minutes INTEGER NOT NULL DEFAULT 15,
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_settings_work_duration_check
        CHECK (work_duration_minutes BETWEEN 1 AND 180),
    CONSTRAINT user_settings_short_break_check
        CHECK (short_break_minutes BETWEEN 1 AND 60),
    CONSTRAINT user_settings_long_break_check
        CHECK (long_break_minutes BETWEEN 1 AND 120)
);

-- User tasks that can be linked to work sessions.
CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT tasks_title_not_blank CHECK (BTRIM(title) <> ''),
    CONSTRAINT tasks_status_check CHECK (status IN ('active', 'completed')),
    CONSTRAINT tasks_completed_at_check CHECK (
        (status = 'active' AND completed_at IS NULL)
        OR (status = 'completed' AND completed_at IS NOT NULL)
    )
);

-- Current and historical timer sessions. A task may be deleted without
-- deleting its session history, therefore task_id uses ON DELETE SET NULL.
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    task_id BIGINT
        REFERENCES tasks(id) ON DELETE SET NULL,
    session_type VARCHAR(20) NOT NULL,
    planned_duration_seconds INTEGER NOT NULL,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    CONSTRAINT pomodoro_sessions_type_check CHECK (
        session_type IN ('work', 'short_break', 'long_break')
    ),
    CONSTRAINT pomodoro_sessions_duration_check
        CHECK (planned_duration_seconds > 0),
    CONSTRAINT pomodoro_sessions_elapsed_check
        CHECK (elapsed_seconds >= 0),
    CONSTRAINT pomodoro_sessions_status_check CHECK (
        status IN ('running', 'paused', 'completed', 'cancelled')
    ),
    CONSTRAINT pomodoro_sessions_ended_at_check CHECK (
        (status IN ('running', 'paused') AND ended_at IS NULL)
        OR (status IN ('completed', 'cancelled') AND ended_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx
    ON tasks(user_id);

CREATE INDEX IF NOT EXISTS tasks_user_status_idx
    ON tasks(user_id, status);

CREATE INDEX IF NOT EXISTS tasks_user_deleted_at_idx
    ON tasks(user_id, deleted_at);

CREATE INDEX IF NOT EXISTS pomodoro_sessions_user_id_idx
    ON pomodoro_sessions(user_id);

CREATE INDEX IF NOT EXISTS pomodoro_sessions_user_started_at_idx
    ON pomodoro_sessions(user_id, started_at DESC);

-- A user cannot have two running or paused timers at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS pomodoro_sessions_one_active_per_user_idx
    ON pomodoro_sessions(user_id)
    WHERE status IN ('running', 'paused');

COMMIT;
