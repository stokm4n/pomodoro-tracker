BEGIN;

ALTER TABLE user_settings
    DROP CONSTRAINT IF EXISTS user_settings_notification_sound_check;

ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_notification_sound_check
        CHECK (
            notification_sound IN (
                'classic',
                'soft',
                'bell',
                'digital',
                'people_go'
            )
        );

COMMIT;
