package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pomodoro-tracker/backend/internal/model"
)

type AdminRepository struct {
	db *pgxpool.Pool
}

func NewAdminRepository(db *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{db: db}
}

func (r *AdminRepository) ListUsers(ctx context.Context) ([]model.AdminUserSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT u.id,
		       u.username,
		       u.role,
		       u.created_at,
		       u.avatar_data,
		       (SELECT COUNT(*) FROM tasks t
		        WHERE t.user_id = u.id AND t.deleted_at IS NULL),
		       (SELECT COUNT(*) FROM pomodoro_sessions s
		        WHERE s.user_id = u.id
		          AND s.session_type = 'work'
		          AND s.status = 'completed'
		          AND s.elapsed_seconds >= s.planned_duration_seconds),
		       (SELECT COALESCE(SUM(s.elapsed_seconds), 0)
		        FROM pomodoro_sessions s
		        WHERE s.user_id = u.id
		          AND s.session_type = 'work'
		          AND s.status = 'completed')
		FROM users u
		ORDER BY u.created_at DESC, u.id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list users for admin: %w", err)
	}
	defer rows.Close()

	users, err := pgx.CollectRows(rows, pgx.RowToStructByPos[model.AdminUserSummary])
	if err != nil {
		return nil, fmt.Errorf("collect users for admin: %w", err)
	}
	return users, nil
}

func (r *AdminRepository) GetUser(ctx context.Context, userID int64) (model.AdminUserDetails, error) {
	var user model.AdminUserDetails
	err := r.db.QueryRow(ctx, `
		SELECT u.id,
		       u.username,
		       u.role,
		       u.created_at,
		       u.avatar_data,
		       (SELECT COUNT(*) FROM tasks t
		        WHERE t.user_id = u.id AND t.deleted_at IS NULL),
		       (SELECT COUNT(*) FROM pomodoro_sessions s
		        WHERE s.user_id = u.id
		          AND s.session_type = 'work'
		          AND s.status = 'completed'
		          AND s.elapsed_seconds >= s.planned_duration_seconds),
		       (SELECT COALESCE(SUM(s.elapsed_seconds), 0)
		        FROM pomodoro_sessions s
		        WHERE s.user_id = u.id
		          AND s.session_type = 'work'
		          AND s.status = 'completed'),
		       (SELECT COUNT(*) FROM tasks t
		        WHERE t.user_id = u.id
		          AND t.deleted_at IS NULL
		          AND t.status = 'active'),
		       (SELECT COUNT(*) FROM tasks t
		        WHERE t.user_id = u.id
		          AND t.deleted_at IS NULL
		          AND t.status = 'completed')
		FROM users u
		WHERE u.id = $1`, userID).Scan(
		&user.ID,
		&user.Username,
		&user.Role,
		&user.CreatedAt,
		&user.AvatarData,
		&user.TaskCount,
		&user.CompletedPomodoros,
		&user.FocusSeconds,
		&user.ActiveTasks,
		&user.CompletedTasks,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.AdminUserDetails{}, ErrUserNotFound
	}
	if err != nil {
		return model.AdminUserDetails{}, fmt.Errorf("get user for admin: %w", err)
	}
	return user, nil
}

func (r *AdminRepository) DeleteUser(ctx context.Context, userID int64) error {
	commandTag, err := r.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete user for admin: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *AdminRepository) GetSystemStatistics(
	ctx context.Context,
) (model.AdminSystemStatistics, error) {
	var statistics model.AdminSystemStatistics
	err := r.db.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM users),
		       (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL),
		       (SELECT COUNT(*) FROM tasks
		        WHERE deleted_at IS NULL AND status = 'completed'),
		       (SELECT COUNT(*) FROM pomodoro_sessions
		        WHERE session_type = 'work'
		          AND status = 'completed'
		          AND elapsed_seconds >= planned_duration_seconds),
		       (SELECT COALESCE(SUM(elapsed_seconds), 0)
		        FROM pomodoro_sessions
		        WHERE session_type = 'work' AND status = 'completed')`).Scan(
		&statistics.TotalUsers,
		&statistics.TotalTasks,
		&statistics.CompletedTasks,
		&statistics.CompletedPomodoros,
		&statistics.TotalFocusSeconds,
	)
	if err != nil {
		return model.AdminSystemStatistics{}, fmt.Errorf("get admin system statistics: %w", err)
	}
	return statistics, nil
}
