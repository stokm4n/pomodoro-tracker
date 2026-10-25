package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pomodoro-tracker/backend/internal/model"
)

var ErrSettingsNotFound = errors.New("settings not found")

type SettingsRepository struct {
	db *pgxpool.Pool
}

func NewSettingsRepository(db *pgxpool.Pool) *SettingsRepository {
	return &SettingsRepository{db: db}
}

func (r *SettingsRepository) GetByUser(
	ctx context.Context,
	userID int64,
) (model.Settings, error) {
	return scanSettings(r.db.QueryRow(
		ctx,
		`SELECT user_id, work_duration_minutes, short_break_minutes,
		        long_break_minutes, notifications_enabled, notification_sound,
		        notification_volume, updated_at
		 FROM user_settings
		 WHERE user_id = $1`,
		userID,
	))
}

func (r *SettingsRepository) Update(
	ctx context.Context,
	settings model.Settings,
) (model.Settings, error) {
	updated, err := scanSettings(r.db.QueryRow(
		ctx,
		`UPDATE user_settings
		 SET work_duration_minutes = $2,
		     short_break_minutes = $3,
		     long_break_minutes = $4,
		     notifications_enabled = $5,
		     notification_sound = $6,
		     notification_volume = $7,
		     updated_at = NOW()
		 WHERE user_id = $1
		 RETURNING user_id, work_duration_minutes, short_break_minutes,
		           long_break_minutes, notifications_enabled, notification_sound,
		           notification_volume, updated_at`,
		settings.UserID,
		settings.WorkDurationMinutes,
		settings.ShortBreakMinutes,
		settings.LongBreakMinutes,
		settings.NotificationsEnabled,
		settings.NotificationSound,
		settings.NotificationVolume,
	))
	if err != nil {
		return model.Settings{}, err
	}
	return updated, nil
}

type settingsRow interface {
	Scan(...any) error
}

func scanSettings(row settingsRow) (model.Settings, error) {
	var settings model.Settings
	err := row.Scan(
		&settings.UserID,
		&settings.WorkDurationMinutes,
		&settings.ShortBreakMinutes,
		&settings.LongBreakMinutes,
		&settings.NotificationsEnabled,
		&settings.NotificationSound,
		&settings.NotificationVolume,
		&settings.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Settings{}, ErrSettingsNotFound
	}
	if err != nil {
		return model.Settings{}, fmt.Errorf("scan settings: %w", err)
	}
	return settings, nil
}
