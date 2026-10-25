package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pomodoro-tracker/backend/internal/model"
)

var ErrTaskNotFound = errors.New("task not found")

// TaskRepository stores user tasks in PostgreSQL.
type TaskRepository struct {
	db *pgxpool.Pool
}

func NewTaskRepository(db *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(
	ctx context.Context,
	userID int64,
	title string,
	description string,
) (model.Task, error) {
	var task model.Task
	err := r.db.QueryRow(
		ctx,
		`INSERT INTO tasks (user_id, title, description)
		 VALUES ($1, $2, NULLIF($3, ''))
		 RETURNING id, user_id, title, COALESCE(description, ''), status,
		           created_at, updated_at, completed_at`,
		userID,
		title,
		description,
	).Scan(
		&task.ID,
		&task.UserID,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.CreatedAt,
		&task.UpdatedAt,
		&task.CompletedAt,
	)
	if err != nil {
		return model.Task{}, fmt.Errorf("insert task: %w", err)
	}

	return task, nil
}

func (r *TaskRepository) ListByUser(
	ctx context.Context,
	userID int64,
) ([]model.Task, error) {
	rows, err := r.db.Query(
		ctx,
		`SELECT id, user_id, title, COALESCE(description, ''), status,
		        created_at, updated_at, completed_at
		 FROM tasks
		 WHERE user_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at DESC, id DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("select tasks: %w", err)
	}
	defer rows.Close()

	tasks, err := pgx.CollectRows(rows, pgx.RowToStructByPos[model.Task])
	if err != nil {
		return nil, fmt.Errorf("collect tasks: %w", err)
	}
	return tasks, nil
}

func (r *TaskRepository) Update(
	ctx context.Context,
	userID int64,
	taskID int64,
	title string,
	description string,
	status string,
) (model.Task, error) {
	var task model.Task
	err := r.db.QueryRow(
		ctx,
		`UPDATE tasks
		 SET title = $3,
		     description = NULLIF($4, ''),
		     status = $5::VARCHAR,
		     updated_at = NOW(),
		     completed_at = CASE
		         WHEN $5::VARCHAR = 'completed' THEN COALESCE(completed_at, NOW())
		         ELSE NULL
		     END
		 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		 RETURNING id, user_id, title, COALESCE(description, ''), status,
		           created_at, updated_at, completed_at`,
		taskID,
		userID,
		title,
		description,
		status,
	).Scan(
		&task.ID,
		&task.UserID,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.CreatedAt,
		&task.UpdatedAt,
		&task.CompletedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Task{}, ErrTaskNotFound
	}
	if err != nil {
		return model.Task{}, fmt.Errorf("update task: %w", err)
	}

	return task, nil
}

func (r *TaskRepository) Delete(
	ctx context.Context,
	userID int64,
	taskID int64,
) error {
	result, err := r.db.Exec(
		ctx,
		`UPDATE tasks
		 SET deleted_at = NOW(), updated_at = NOW()
		 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
		taskID,
		userID,
	)
	if err != nil {
		return fmt.Errorf("delete task: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrTaskNotFound
	}
	return nil
}

func (r *TaskRepository) DeletePermanently(
	ctx context.Context,
	userID int64,
	taskID int64,
) error {
	result, err := r.db.Exec(
		ctx,
		`DELETE FROM tasks
		 WHERE id = $1 AND user_id = $2`,
		taskID,
		userID,
	)
	if err != nil {
		return fmt.Errorf("permanently delete task: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrTaskNotFound
	}
	return nil
}
