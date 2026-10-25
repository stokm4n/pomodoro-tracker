BEGIN;

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS notification_sound VARCHAR(20) NOT NULL DEFAULT 'classic',
    ADD COLUMN IF NOT EXISTS notification_volume INTEGER NOT NULL DEFAULT 70;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_settings_notification_sound_check'
    ) THEN
        ALTER TABLE user_settings
            ADD CONSTRAINT user_settings_notification_sound_check
                CHECK (notification_sound IN ('classic', 'soft', 'bell', 'digital'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_settings_notification_volume_check'
    ) THEN
        ALTER TABLE user_settings
            ADD CONSTRAINT user_settings_notification_volume_check
                CHECK (notification_volume BETWEEN 0 AND 100);
    END IF;
END $$;

COMMIT;
