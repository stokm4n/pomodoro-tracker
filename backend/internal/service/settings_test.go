package service

import (
	"context"
	"errors"
	"testing"

	"pomodoro-tracker/backend/internal/model"
)

type settingsRepositoryStub struct {
	updated model.Settings
}

func (r *settingsRepositoryStub) GetByUser(
	context.Context,
	int64,
) (model.Settings, error) {
	return model.Settings{}, nil
}

func (r *settingsRepositoryStub) Update(
	_ context.Context,
	settings model.Settings,
) (model.Settings, error) {
	r.updated = settings
	return settings, nil
}

func TestSettingsUpdate(t *testing.T) {
	repositoryStub := &settingsRepositoryStub{}
	service := NewSettingsService(repositoryStub)
	input := model.Settings{
		UserID:               7,
		WorkDurationMinutes:  50,
		ShortBreakMinutes:    10,
		LongBreakMinutes:     25,
		NotificationsEnabled: true,
		NotificationSound:    "bell",
		NotificationVolume:   65,
	}

	result, err := service.Update(context.Background(), input)
	if err != nil {
		t.Fatalf("Update() returned an error: %v", err)
	}
	if result != input || repositoryStub.updated != input {
		t.Fatalf("unexpected updated settings: %+v", result)
	}
}

func TestSettingsUpdateRejectsInvalidDurations(t *testing.T) {
	service := NewSettingsService(&settingsRepositoryStub{})
	valid := model.Settings{
		UserID:              1,
		WorkDurationMinutes: 25,
		ShortBreakMinutes:   5,
		LongBreakMinutes:    15,
		NotificationSound:   "classic",
		NotificationVolume:  70,
	}

	tests := []struct {
		name     string
		settings model.Settings
		expected error
	}{
		{"work", withDuration(valid, 0, 5, 15), ErrInvalidWorkDuration},
		{"short break", withDuration(valid, 25, 0, 15), ErrInvalidShortBreak},
		{"long break", withDuration(valid, 25, 5, 121), ErrInvalidLongBreak},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := service.Update(context.Background(), test.settings)
			if !errors.Is(err, test.expected) {
				t.Fatalf("expected %v, got %v", test.expected, err)
			}
		})
	}
}

func TestSettingsUpdateRejectsInvalidNotificationOptions(t *testing.T) {
	service := NewSettingsService(&settingsRepositoryStub{})
	valid := model.Settings{
		UserID: 1, WorkDurationMinutes: 25, ShortBreakMinutes: 5,
		LongBreakMinutes: 15, NotificationSound: "classic", NotificationVolume: 70,
	}

	invalidSound := valid
	invalidSound.NotificationSound = "unknown"
	if _, err := service.Update(context.Background(), invalidSound); !errors.Is(err, ErrInvalidNotificationSound) {
		t.Fatalf("expected ErrInvalidNotificationSound, got %v", err)
	}

	invalidVolume := valid
	invalidVolume.NotificationVolume = 101
	if _, err := service.Update(context.Background(), invalidVolume); !errors.Is(err, ErrInvalidNotificationVolume) {
		t.Fatalf("expected ErrInvalidNotificationVolume, got %v", err)
	}
}

func withDuration(
	settings model.Settings,
	work int,
	shortBreak int,
	longBreak int,
) model.Settings {
	settings.WorkDurationMinutes = work
	settings.ShortBreakMinutes = shortBreak
	settings.LongBreakMinutes = longBreak
	return settings
}
