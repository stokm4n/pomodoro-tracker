package model

import "time"

// Settings contains one user's Pomodoro durations and notification preference.
type Settings struct {
	UserID               int64     `json:"user_id"`
	WorkDurationMinutes  int       `json:"work_duration_minutes"`
	ShortBreakMinutes    int       `json:"short_break_minutes"`
	LongBreakMinutes     int       `json:"long_break_minutes"`
	NotificationsEnabled bool      `json:"notifications_enabled"`
	NotificationSound    string    `json:"notification_sound"`
	NotificationVolume   int       `json:"notification_volume"`
	UpdatedAt            time.Time `json:"updated_at"`
}
