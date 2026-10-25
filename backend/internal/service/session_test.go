package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

type sessionRepositoryStub struct {
	startedType     string
	startedDuration int
	startResult     model.PomodoroSession
	currentResult   model.PomodoroSession
	currentErr      error
	completeResult  model.PomodoroSession
	completedWork   int
}

func (r *sessionRepositoryStub) Start(
	_ context.Context,
	_ int64,
	_ *int64,
	sessionType string,
	duration int,
) (model.PomodoroSession, error) {
	r.startedType = sessionType
	r.startedDuration = duration
	return r.startResult, nil
}

func (r *sessionRepositoryStub) GetCurrent(context.Context, int64) (model.PomodoroSession, error) {
	return r.currentResult, r.currentErr
}

func (r *sessionRepositoryStub) ListHistory(context.Context, int64) ([]model.SessionHistoryItem, error) {
	return nil, nil
}

func (r *sessionRepositoryStub) Pause(context.Context, int64, int64) (model.PomodoroSession, error) {
	return model.PomodoroSession{}, nil
}

func (r *sessionRepositoryStub) Resume(context.Context, int64, int64) (model.PomodoroSession, error) {
	return model.PomodoroSession{}, nil
}

func (r *sessionRepositoryStub) Complete(context.Context, int64, int64) (model.PomodoroSession, error) {
	return r.completeResult, nil
}

func (r *sessionRepositoryStub) CountCompletedWork(context.Context, int64) (int, error) {
	return r.completedWork, nil
}

func (r *sessionRepositoryStub) Cancel(context.Context, int64, int64) (model.PomodoroSession, error) {
	return model.PomodoroSession{}, nil
}

type sessionSettingsStub struct {
	settings model.Settings
}

func (r *sessionSettingsStub) GetByUser(context.Context, int64) (model.Settings, error) {
	return r.settings, nil
}

func TestSessionStartUsesConfiguredDuration(t *testing.T) {
	repositoryStub := &sessionRepositoryStub{
		startResult: model.PomodoroSession{
			SessionType:            "short_break",
			PlannedDurationSeconds: 600,
		},
	}
	settingsStub := &sessionSettingsStub{settings: model.Settings{
		WorkDurationMinutes: 50,
		ShortBreakMinutes:   10,
		LongBreakMinutes:    25,
	}}
	sessions := NewSessionService(repositoryStub, settingsStub)

	_, err := sessions.Start(context.Background(), 7, nil, "short_break")
	if err != nil {
		t.Fatalf("Start() returned an error: %v", err)
	}
	if repositoryStub.startedType != "short_break" || repositoryStub.startedDuration != 600 {
		t.Fatalf("unexpected start arguments: %s, %d", repositoryStub.startedType, repositoryStub.startedDuration)
	}
}

func TestSessionStartRejectsInvalidType(t *testing.T) {
	sessions := NewSessionService(&sessionRepositoryStub{}, &sessionSettingsStub{})

	_, err := sessions.Start(context.Background(), 1, nil, "unknown")
	if !errors.Is(err, ErrInvalidSessionType) {
		t.Fatalf("expected ErrInvalidSessionType, got %v", err)
	}
}

func TestSessionCurrentCalculatesRunningTime(t *testing.T) {
	now := time.Date(2026, time.October, 16, 12, 0, 20, 0, time.UTC)
	repositoryStub := &sessionRepositoryStub{currentResult: model.PomodoroSession{
		PlannedDurationSeconds: 1500,
		ElapsedSeconds:         120,
		Status:                 "running",
		StateChangedAt:         now.Add(-20 * time.Second),
	}}
	sessions := NewSessionService(repositoryStub, &sessionSettingsStub{})
	sessions.now = func() time.Time { return now }

	result, err := sessions.Current(context.Background(), 1)
	if err != nil {
		t.Fatalf("Current() returned an error: %v", err)
	}
	if result.ElapsedSeconds != 140 || result.RemainingSeconds != 1360 {
		t.Fatalf("unexpected timer values: elapsed=%d remaining=%d", result.ElapsedSeconds, result.RemainingSeconds)
	}
}

func TestSessionCurrentMapsNotFound(t *testing.T) {
	repositoryStub := &sessionRepositoryStub{currentErr: repository.ErrSessionNotFound}
	sessions := NewSessionService(repositoryStub, &sessionSettingsStub{})

	_, err := sessions.Current(context.Background(), 1)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestSessionCompleteSelectsShortBreak(t *testing.T) {
	repositoryStub := &sessionRepositoryStub{
		completeResult: model.PomodoroSession{SessionType: "work", Status: "completed"},
		completedWork:  3,
	}
	sessions := NewSessionService(repositoryStub, &sessionSettingsStub{})

	result, err := sessions.Complete(context.Background(), 1, 10)
	if err != nil {
		t.Fatalf("Complete() returned an error: %v", err)
	}
	if result.NextSessionType != "short_break" {
		t.Fatalf("expected short_break, got %s", result.NextSessionType)
	}
}

func TestSessionCompleteSelectsLongBreakAfterFourthWork(t *testing.T) {
	repositoryStub := &sessionRepositoryStub{
		completeResult: model.PomodoroSession{SessionType: "work", Status: "completed"},
		completedWork:  4,
	}
	sessions := NewSessionService(repositoryStub, &sessionSettingsStub{})

	result, err := sessions.Complete(context.Background(), 1, 10)
	if err != nil {
		t.Fatalf("Complete() returned an error: %v", err)
	}
	if result.NextSessionType != "long_break" {
		t.Fatalf("expected long_break, got %s", result.NextSessionType)
	}
}

func TestSessionCompleteBreakReturnsToWork(t *testing.T) {
	repositoryStub := &sessionRepositoryStub{
		completeResult: model.PomodoroSession{SessionType: "short_break", Status: "completed"},
	}
	sessions := NewSessionService(repositoryStub, &sessionSettingsStub{})

	result, err := sessions.Complete(context.Background(), 1, 10)
	if err != nil {
		t.Fatalf("Complete() returned an error: %v", err)
	}
	if result.NextSessionType != "work" {
		t.Fatalf("expected work, got %s", result.NextSessionType)
	}
}
