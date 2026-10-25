package service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

const (
	maximumTaskTitleLength       = 200
	maximumTaskDescriptionLength = 5000
)

var (
	ErrInvalidTaskTitle       = errors.New("task title must contain 1-200 characters")
	ErrTaskDescriptionTooLong = errors.New("task description must not exceed 5000 characters")
	ErrInvalidTaskStatus      = errors.New("task status must be 'active' or 'completed'")
	ErrTaskNotFound           = errors.New("task not found")
)

type taskRepository interface {
	Create(context.Context, int64, string, string) (model.Task, error)
	ListByUser(context.Context, int64) ([]model.Task, error)
	Update(context.Context, int64, int64, string, string, string) (model.Task, error)
	Delete(context.Context, int64, int64) error
	DeletePermanently(context.Context, int64, int64) error
}

type TaskService struct {
	tasks taskRepository
}

func NewTaskService(tasks taskRepository) *TaskService {
	return &TaskService{tasks: tasks}
}

func (s *TaskService) Create(
	ctx context.Context,
	userID int64,
	title string,
	description string,
) (model.Task, error) {
	title, description, err := validateTaskText(title, description)
	if err != nil {
		return model.Task{}, err
	}
	return s.tasks.Create(ctx, userID, title, description)
}

func (s *TaskService) List(ctx context.Context, userID int64) ([]model.Task, error) {
	return s.tasks.ListByUser(ctx, userID)
}

func (s *TaskService) Update(
	ctx context.Context,
	userID int64,
	taskID int64,
	title string,
	description string,
	status string,
) (model.Task, error) {
	title, description, err := validateTaskText(title, description)
	if err != nil {
		return model.Task{}, err
	}
	if status != "active" && status != "completed" {
		return model.Task{}, ErrInvalidTaskStatus
	}

	task, err := s.tasks.Update(ctx, userID, taskID, title, description, status)
	if errors.Is(err, repository.ErrTaskNotFound) {
		return model.Task{}, ErrTaskNotFound
	}
	return task, err
}

func (s *TaskService) Delete(ctx context.Context, userID int64, taskID int64) error {
	err := s.tasks.Delete(ctx, userID, taskID)
	if errors.Is(err, repository.ErrTaskNotFound) {
		return ErrTaskNotFound
	}
	return err
}

func (s *TaskService) DeletePermanently(ctx context.Context, userID int64, taskID int64) error {
	err := s.tasks.DeletePermanently(ctx, userID, taskID)
	if errors.Is(err, repository.ErrTaskNotFound) {
		return ErrTaskNotFound
	}
	return err
}

func validateTaskText(title string, description string) (string, string, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)

	if utf8.RuneCountInString(title) == 0 ||
		utf8.RuneCountInString(title) > maximumTaskTitleLength {
		return "", "", ErrInvalidTaskTitle
	}
	if utf8.RuneCountInString(description) > maximumTaskDescriptionLength {
		return "", "", ErrTaskDescriptionTooLong
	}
	return title, description, nil
}
