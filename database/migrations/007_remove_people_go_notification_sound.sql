UPDATE user_settings
SET notification_sound = 'classic'
WHERE notification_sound = 'people_go';

ALTER TABLE user_settings
    DROP CONSTRAINT IF EXISTS user_settings_notification_sound_check;

ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_notification_sound_check
    CHECK (notification_sound IN ('classic', 'soft', 'bell', 'digital'));
