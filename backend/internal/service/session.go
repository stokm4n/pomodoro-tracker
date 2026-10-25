package service

import (
	"context"
	"errors"
	"time"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

var (
	ErrInvalidSessionType  = errors.New("session type must be 'work', 'short_break' or 'long_break'")
	ErrActiveSessionExists = errors.New("finish the current timer before starting another one")
	ErrSessionTaskNotFound = errors.New("active task not found")
	ErrSessionNotFound     = errors.New("active session not found")
	ErrInvalidSessionState = errors.New("timer cannot perform this action in its current state")
)

type sessionRepository interface {
	Start(context.Context, int64, *int64, string, int) (model.PomodoroSession, error)
	GetCurrent(context.Context, int64) (model.PomodoroSession, error)
	ListHistory(context.Context, int64) ([]model.SessionHistoryItem, error)
	Pause(context.Context, int64, int64) (model.PomodoroSession, error)
	Resume(context.Context, int64, int64) (model.PomodoroSession, error)
	Complete(context.Context, int64, int64) (model.PomodoroSession, error)
	Cancel(context.Context, int64, int64) (model.PomodoroSession, error)
	CountCompletedWork(context.Context, int64) (int, error)
}

type sessionSettingsRepository interface {
	GetByUser(context.Context, int64) (model.Settings, error)
}

type SessionService struct {
	sessions sessionRepository
	settings sessionSettingsRepository
	now      func() time.Time
}

type SessionCompletion struct {
	Session            model.PomodoroSession
	NextSessionType    string
	CompletedWorkCount int
}

func NewSessionService(
	sessions sessionRepository,
	settings sessionSettingsRepository,
) *SessionService {
	return &SessionService{sessions: sessions, settings: settings, now: time.Now}
}

func (s *SessionService) Start(
	ctx context.Context,
	userID int64,
	taskID *int64,
	sessionType string,
) (model.PomodoroSession, error) {
	settings, err := s.settings.GetByUser(ctx, userID)
	if err != nil {
		return model.PomodoroSession{}, err
	}

	minutes := 0
	switch sessionType {
	case "work":
		minutes = settings.WorkDurationMinutes
	case "short_break":
		minutes = settings.ShortBreakMinutes
	case "long_break":
		minutes = settings.LongBreakMinutes
	default:
		return model.PomodoroSession{}, ErrInvalidSessionType
	}

	session, err := s.sessions.Start(ctx, userID, taskID, sessionType, minutes*60)
	return s.mapResult(session, err)
}

func (s *SessionService) Current(
	ctx context.Context,
	userID int64,
) (model.PomodoroSession, error) {
	session, err := s.sessions.GetCurrent(ctx, userID)
	return s.mapResult(session, err)
}

func (s *SessionService) History(
	ctx context.Context,
	userID int64,
) ([]model.SessionHistoryItem, error) {
	return s.sessions.ListHistory(ctx, userID)
}

func (s *SessionService) Pause(ctx context.Context, userID, sessionID int64) (model.PomodoroSession, error) {
	session, err := s.sessions.Pause(ctx, userID, sessionID)
	return s.mapResult(session, err)
}

func (s *SessionService) Resume(ctx context.Context, userID, sessionID int64) (model.PomodoroSession, error) {
	session, err := s.sessions.Resume(ctx, userID, sessionID)
	return s.mapResult(session, err)
}

func (s *SessionService) Complete(ctx context.Context, userID, sessionID int64) (SessionCompletion, error) {
	session, err := s.sessions.Complete(ctx, userID, sessionID)
	session, err = s.mapResult(session, err)
	if err != nil {
		return SessionCompletion{}, err
	}

	completion := SessionCompletion{
		Session:         session,
		NextSessionType: "work",
	}
	if session.SessionType != "work" {
		return completion, nil
	}

	completedWork, err := s.sessions.CountCompletedWork(ctx, userID)
	if err != nil {
		return SessionCompletion{}, err
	}
	completion.CompletedWorkCount = completedWork
	completion.NextSessionType = "short_break"
	if completedWork > 0 && completedWork%4 == 0 {
		completion.NextSessionType = "long_break"
	}
	return completion, nil
}

func (s *SessionService) Cancel(ctx context.Context, userID, sessionID int64) (model.PomodoroSession, error) {
	session, err := s.sessions.Cancel(ctx, userID, sessionID)
	return s.mapResult(session, err)
}

func (s *SessionService) mapResult(
	session model.PomodoroSession,
	err error,
) (model.PomodoroSession, error) {
	switch {
	case errors.Is(err, repository.ErrActiveSessionExists):
		return model.PomodoroSession{}, ErrActiveSessionExists
	case errors.Is(err, repository.ErrSessionTaskNotFound):
		return model.PomodoroSession{}, ErrSessionTaskNotFound
	case errors.Is(err, repository.ErrSessionNotFound):
		return model.PomodoroSession{}, ErrSessionNotFound
	case errors.Is(err, repository.ErrInvalidSessionState):
		return model.PomodoroSession{}, ErrInvalidSessionState
	case err != nil:
		return model.PomodoroSession{}, err
	}

	elapsed := session.ElapsedSeconds
	if session.Status == "running" {
		elapsed += int(s.now().Sub(session.StateChangedAt).Seconds())
	}
	if elapsed < 0 {
		elapsed = 0
	}
	if elapsed > session.PlannedDurationSeconds {
		elapsed = session.PlannedDurationSeconds
	}
	session.ElapsedSeconds = elapsed
	session.RemainingSeconds = session.PlannedDurationSeconds - elapsed
	return session, nil
}
