package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"pomodoro-tracker/backend/internal/model"
)

var (
	ErrSessionNotFound     = errors.New("session not found")
	ErrActiveSessionExists = errors.New("active session already exists")
	ErrSessionTaskNotFound = errors.New("task not found")
	ErrInvalidSessionState = errors.New("session state does not allow this action")
)

type SessionRepository struct {
	db *pgxpool.Pool
}

func NewSessionRepository(db *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Start(
	ctx context.Context,
	userID int64,
	taskID *int64,
	sessionType string,
	durationSeconds int,
	breakActivities []string,
) (model.PomodoroSession, error) {
	session, err := scanSession(r.db.QueryRow(
		ctx,
		`INSERT INTO pomodoro_sessions (
			user_id, task_id, session_type, planned_duration_seconds, break_activities
		)
		SELECT $1, $2::BIGINT, $3, $4, $5::TEXT[]
		WHERE $2::BIGINT IS NULL OR EXISTS (
			SELECT 1 FROM tasks
			WHERE id = $2::BIGINT AND user_id = $1
			  AND status = 'active' AND deleted_at IS NULL
		)
		RETURNING id, user_id, task_id, session_type,
		          planned_duration_seconds, elapsed_seconds, status,
		          break_activities, readiness_score,
		          started_at, state_changed_at, ended_at`,
		userID,
		taskID,
		sessionType,
		durationSeconds,
		breakActivities,
	))
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, ErrSessionNotFound) {
		return model.PomodoroSession{}, ErrSessionTaskNotFound
	}
	var databaseError *pgconn.PgError
	if errors.As(err, &databaseError) && databaseError.Code == "23505" {
		return model.PomodoroSession{}, ErrActiveSessionExists
	}
	if err != nil {
		return model.PomodoroSession{}, fmt.Errorf("insert session: %w", err)
	}
	return session, nil
}

func (r *SessionRepository) GetCurrent(
	ctx context.Context,
	userID int64,
) (model.PomodoroSession, error) {
	return scanSession(r.db.QueryRow(
		ctx,
		`SELECT id, user_id, task_id, session_type,
		        planned_duration_seconds, elapsed_seconds, status,
		        break_activities, readiness_score,
		        started_at, state_changed_at, ended_at
		 FROM pomodoro_sessions
		 WHERE user_id = $1 AND status IN ('running', 'paused')`,
		userID,
	))
}

func (r *SessionRepository) ListHistory(
	ctx context.Context,
	userID int64,
) ([]model.SessionHistoryItem, error) {
	rows, err := r.db.Query(
		ctx,
		`SELECT sessions.id, sessions.task_id, tasks.title,
		        sessions.session_type, sessions.planned_duration_seconds,
		        sessions.elapsed_seconds, sessions.status,
		        sessions.break_activities, sessions.readiness_score,
		        sessions.started_at, sessions.ended_at
		 FROM pomodoro_sessions AS sessions
		 LEFT JOIN tasks ON tasks.id = sessions.task_id
		 WHERE sessions.user_id = $1
		   AND sessions.status IN ('completed', 'cancelled')
		 ORDER BY sessions.ended_at DESC, sessions.id DESC
		 LIMIT 200`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("select session history: %w", err)
	}
	defer rows.Close()

	history, err := pgx.CollectRows(rows, pgx.RowToStructByPos[model.SessionHistoryItem])
	if err != nil {
		return nil, fmt.Errorf("collect session history: %w", err)
	}
	return history, nil
}

func (r *SessionRepository) Pause(
	ctx context.Context,
	userID int64,
	sessionID int64,
) (model.PomodoroSession, error) {
	return r.changeState(ctx, userID, sessionID, "pause")
}

func (r *SessionRepository) Resume(
	ctx context.Context,
	userID int64,
	sessionID int64,
) (model.PomodoroSession, error) {
	return r.changeState(ctx, userID, sessionID, "resume")
}

func (r *SessionRepository) Complete(
	ctx context.Context,
	userID int64,
	sessionID int64,
) (model.PomodoroSession, error) {
	return r.changeState(ctx, userID, sessionID, "complete")
}

func (r *SessionRepository) Cancel(
	ctx context.Context,
	userID int64,
	sessionID int64,
) (model.PomodoroSession, error) {
	return r.changeState(ctx, userID, sessionID, "cancel")
}

func (r *SessionRepository) SaveReadiness(
	ctx context.Context,
	userID int64,
	sessionID int64,
	score int,
) (model.PomodoroSession, error) {
	return scanSession(r.db.QueryRow(
		ctx,
		`UPDATE pomodoro_sessions
		 SET readiness_score = $3
		 WHERE id = $1
		   AND user_id = $2
		   AND session_type IN ('short_break', 'long_break')
		   AND status = 'completed'
		 RETURNING id, user_id, task_id, session_type,
		           planned_duration_seconds, elapsed_seconds, status,
		           break_activities, readiness_score,
		           started_at, state_changed_at, ended_at`,
		sessionID,
		userID,
		score,
	))
}

func (r *SessionRepository) CountCompletedWork(
	ctx context.Context,
	userID int64,
) (int, error) {
	var count int
	err := r.db.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM pomodoro_sessions
		 WHERE user_id = $1
		   AND session_type = 'work'
		   AND status = 'completed'`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count completed work sessions: %w", err)
	}
	return count, nil
}

func (r *SessionRepository) changeState(
	ctx context.Context,
	userID int64,
	sessionID int64,
	action string,
) (model.PomodoroSession, error) {
	var query string
	switch action {
	case "pause":
		query = `UPDATE pomodoro_sessions
		 SET elapsed_seconds = LEAST(
		         planned_duration_seconds,
		         elapsed_seconds + GREATEST(
		             0, FLOOR(EXTRACT(EPOCH FROM (NOW() - state_changed_at)))::INTEGER
		         )
		     ),
		     status = 'paused', state_changed_at = NOW()
		 WHERE id = $1 AND user_id = $2 AND status = 'running'
		 RETURNING id, user_id, task_id, session_type,
		           planned_duration_seconds, elapsed_seconds, status,
		           break_activities, readiness_score,
		           started_at, state_changed_at, ended_at`
	case "resume":
		query = `UPDATE pomodoro_sessions
		 SET status = 'running', state_changed_at = NOW()
		 WHERE id = $1 AND user_id = $2 AND status = 'paused'
		 RETURNING id, user_id, task_id, session_type,
		           planned_duration_seconds, elapsed_seconds, status,
		           break_activities, readiness_score,
		           started_at, state_changed_at, ended_at`
	case "complete", "cancel":
		status := "completed"
		if action == "cancel" {
			status = "cancelled"
		}
		query = fmt.Sprintf(`UPDATE pomodoro_sessions
		 SET elapsed_seconds = LEAST(
		         planned_duration_seconds,
		         elapsed_seconds + CASE WHEN status = 'running' THEN GREATEST(
		             0, FLOOR(EXTRACT(EPOCH FROM (NOW() - state_changed_at)))::INTEGER
		         ) ELSE 0 END
		     ),
		     status = '%s', state_changed_at = NOW(), ended_at = NOW()
		 WHERE id = $1 AND user_id = $2 AND status IN ('running', 'paused')
		 RETURNING id, user_id, task_id, session_type,
		           planned_duration_seconds, elapsed_seconds, status,
		           break_activities, readiness_score,
		           started_at, state_changed_at, ended_at`, status)
	default:
		return model.PomodoroSession{}, ErrInvalidSessionState
	}

	session, err := scanSession(r.db.QueryRow(ctx, query, sessionID, userID))
	if errors.Is(err, ErrSessionNotFound) {
		return model.PomodoroSession{}, ErrInvalidSessionState
	}
	if err != nil {
		return model.PomodoroSession{}, fmt.Errorf("%s session: %w", action, err)
	}
	return session, nil
}

type sessionRow interface {
	Scan(...any) error
}

func scanSession(row sessionRow) (model.PomodoroSession, error) {
	var session model.PomodoroSession
	err := row.Scan(
		&session.ID,
		&session.UserID,
		&session.TaskID,
		&session.SessionType,
		&session.PlannedDurationSeconds,
		&session.ElapsedSeconds,
		&session.Status,
		&session.BreakActivities,
		&session.ReadinessScore,
		&session.StartedAt,
		&session.StateChangedAt,
		&session.EndedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.PomodoroSession{}, ErrSessionNotFound
	}
	if err != nil {
		return model.PomodoroSession{}, fmt.Errorf("scan session: %w", err)
	}
	return session, nil
}
