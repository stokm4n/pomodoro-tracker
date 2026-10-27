ALTER TABLE pomodoro_sessions
    ADD COLUMN IF NOT EXISTS break_activities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS readiness_score SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pomodoro_sessions_break_activities_check'
    ) THEN
        ALTER TABLE pomodoro_sessions
            ADD CONSTRAINT pomodoro_sessions_break_activities_check CHECK (
                break_activities <@ ARRAY[
                    'water', 'eyes', 'music', 'stretch', 'walk', 'meal'
                ]::TEXT[]
                AND (session_type <> 'work' OR cardinality(break_activities) = 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pomodoro_sessions_readiness_score_check'
    ) THEN
        ALTER TABLE pomodoro_sessions
            ADD CONSTRAINT pomodoro_sessions_readiness_score_check CHECK (
                readiness_score IS NULL
                OR (
                    session_type IN ('short_break', 'long_break')
                    AND readiness_score BETWEEN 1 AND 10
                )
            );
    END IF;
END $$;
