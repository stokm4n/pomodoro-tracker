package service

import (
	"context"
	"errors"
	"time"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

var (
	ErrInvalidSessionType    = errors.New("session type must be 'work', 'short_break' or 'long_break'")
	ErrActiveSessionExists   = errors.New("finish the current timer before starting another one")
	ErrSessionTaskNotFound   = errors.New("active task not found")
	ErrSessionNotFound       = errors.New("active session not found")
	ErrInvalidSessionState   = errors.New("timer cannot perform this action in its current state")
	ErrInvalidBreakActivity  = errors.New("invalid break activity for this break duration")
	ErrInvalidReadinessScore = errors.New("readiness score must be between 1 and 10")
)

type sessionRepository interface {
	Start(context.Context, int64, *int64, string, int, []string) (model.PomodoroSession, error)
	GetCurrent(context.Context, int64) (model.PomodoroSession, error)
	ListHistory(context.Context, int64) ([]model.SessionHistoryItem, error)
	Pause(context.Context, int64, int64) (model.PomodoroSession, error)
	Resume(context.Context, int64, int64) (model.PomodoroSession, error)
	Complete(context.Context, int64, int64) (model.PomodoroSession, error)
	Cancel(context.Context, int64, int64) (model.PomodoroSession, error)
	SaveReadiness(context.Context, int64, int64, int) (model.PomodoroSession, error)
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
	breakActivities []string,
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
	validatedActivities, err := validateBreakActivities(sessionType, minutes, breakActivities)
	if err != nil {
		return model.PomodoroSession{}, err
	}

	session, err := s.sessions.Start(
		ctx,
		userID,
		taskID,
		sessionType,
		minutes*60,
		validatedActivities,
	)
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
	completedFullInterval := session.ElapsedSeconds >= session.PlannedDurationSeconds
	if completedFullInterval && completedWork > 0 && completedWork%4 == 0 {
		completion.NextSessionType = "long_break"
	}
	return completion, nil
}

func (s *SessionService) Cancel(ctx context.Context, userID, sessionID int64) (model.PomodoroSession, error) {
	session, err := s.sessions.Cancel(ctx, userID, sessionID)
	return s.mapResult(session, err)
}

func (s *SessionService) SaveReadiness(
	ctx context.Context,
	userID int64,
	sessionID int64,
	score int,
) (model.PomodoroSession, error) {
	if score < 1 || score > 10 {
		return model.PomodoroSession{}, ErrInvalidReadinessScore
	}
	session, err := s.sessions.SaveReadiness(ctx, userID, sessionID, score)
	return s.mapResult(session, err)
}

var breakActivityMinimumMinutes = map[string]int{
	"water":   1,
	"eyes":    1,
	"music":   2,
	"stretch": 4,
	"walk":    10,
	"meal":    20,
}

func validateBreakActivities(
	sessionType string,
	durationMinutes int,
	activities []string,
) ([]string, error) {
	if sessionType == "work" {
		if len(activities) > 0 {
			return nil, ErrInvalidBreakActivity
		}
		return []string{}, nil
	}

	validated := make([]string, 0, len(activities))
	seen := make(map[string]struct{}, len(activities))
	for _, activity := range activities {
		minimumMinutes, exists := breakActivityMinimumMinutes[activity]
		if !exists || durationMinutes < minimumMinutes {
			return nil, ErrInvalidBreakActivity
		}
		if _, duplicate := seen[activity]; duplicate {
			continue
		}
		seen[activity] = struct{}{}
		validated = append(validated, activity)
	}
	return validated, nil
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
