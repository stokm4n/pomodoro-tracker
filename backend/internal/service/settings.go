package service

import (
	"context"
	"errors"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

var (
	ErrInvalidWorkDuration       = errors.New("work duration must be between 1 and 180 minutes")
	ErrInvalidShortBreak         = errors.New("short break must be between 1 and 60 minutes")
	ErrInvalidLongBreak          = errors.New("long break must be between 1 and 120 minutes")
	ErrInvalidNotificationSound  = errors.New("notification sound must be 'classic', 'soft', 'bell', 'digital' or 'people_go'")
	ErrInvalidNotificationVolume = errors.New("notification volume must be between 0 and 100")
	ErrSettingsNotFound          = errors.New("settings not found")
)

type settingsRepository interface {
	GetByUser(context.Context, int64) (model.Settings, error)
	Update(context.Context, model.Settings) (model.Settings, error)
}

type SettingsService struct {
	settings settingsRepository
}

func NewSettingsService(settings settingsRepository) *SettingsService {
	return &SettingsService{settings: settings}
}

func (s *SettingsService) Get(ctx context.Context, userID int64) (model.Settings, error) {
	settings, err := s.settings.GetByUser(ctx, userID)
	if errors.Is(err, repository.ErrSettingsNotFound) {
		return model.Settings{}, ErrSettingsNotFound
	}
	return settings, err
}

func (s *SettingsService) Update(
	ctx context.Context,
	settings model.Settings,
) (model.Settings, error) {
	if settings.WorkDurationMinutes < 1 || settings.WorkDurationMinutes > 180 {
		return model.Settings{}, ErrInvalidWorkDuration
	}
	if settings.ShortBreakMinutes < 1 || settings.ShortBreakMinutes > 60 {
		return model.Settings{}, ErrInvalidShortBreak
	}
	if settings.LongBreakMinutes < 1 || settings.LongBreakMinutes > 120 {
		return model.Settings{}, ErrInvalidLongBreak
	}
	if !validNotificationSound(settings.NotificationSound) {
		return model.Settings{}, ErrInvalidNotificationSound
	}
	if settings.NotificationVolume < 0 || settings.NotificationVolume > 100 {
		return model.Settings{}, ErrInvalidNotificationVolume
	}

	updated, err := s.settings.Update(ctx, settings)
	if errors.Is(err, repository.ErrSettingsNotFound) {
		return model.Settings{}, ErrSettingsNotFound
	}
	return updated, err
}

func validNotificationSound(sound string) bool {
	switch sound {
	case "classic", "soft", "bell", "digital", "people_go":
		return true
	default:
		return false
	}
}
