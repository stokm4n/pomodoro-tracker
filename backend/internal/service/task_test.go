package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

type taskRepositoryStub struct {
	createdUserID      int64
	createdTitle       string
	createdDescription string
	updatedUserID      int64
	updatedTaskID      int64
	updatedStatus      string
	createResult       model.Task
	updateResult       model.Task
	updateErr          error
	deleteErr          error
	permanentDeleteErr error
}

func (r *taskRepositoryStub) Create(
	_ context.Context,
	userID int64,
	title string,
	description string,
) (model.Task, error) {
	r.createdUserID = userID
	r.createdTitle = title
	r.createdDescription = description
	return r.createResult, nil
}

func (r *taskRepositoryStub) ListByUser(context.Context, int64) ([]model.Task, error) {
	return nil, nil
}

func (r *taskRepositoryStub) Update(
	_ context.Context,
	userID int64,
	taskID int64,
	_ string,
	_ string,
	status string,
) (model.Task, error) {
	r.updatedUserID = userID
	r.updatedTaskID = taskID
	r.updatedStatus = status
	return r.updateResult, r.updateErr
}

func (r *taskRepositoryStub) Delete(context.Context, int64, int64) error {
	return r.deleteErr
}

func (r *taskRepositoryStub) DeletePermanently(context.Context, int64, int64) error {
	return r.permanentDeleteErr
}

func TestTaskCreateTrimsInputAndUsesAuthenticatedUser(t *testing.T) {
	repositoryStub := &taskRepositoryStub{
		createResult: model.Task{ID: 10, UserID: 7, Title: "Course work"},
	}
	tasks := NewTaskService(repositoryStub)

	_, err := tasks.Create(context.Background(), 7, "  Course work  ", "  Description  ")
	if err != nil {
		t.Fatalf("Create() returned an error: %v", err)
	}

	if repositoryStub.createdUserID != 7 {
		t.Errorf("expected user id 7, got %d", repositoryStub.createdUserID)
	}
	if repositoryStub.createdTitle != "Course work" {
		t.Errorf("unexpected title: %q", repositoryStub.createdTitle)
	}
	if repositoryStub.createdDescription != "Description" {
		t.Errorf("unexpected description: %q", repositoryStub.createdDescription)
	}
}

func TestTaskCreateRejectsInvalidInput(t *testing.T) {
	tasks := NewTaskService(&taskRepositoryStub{})

	if _, err := tasks.Create(context.Background(), 1, "   ", ""); !errors.Is(err, ErrInvalidTaskTitle) {
		t.Fatalf("expected ErrInvalidTaskTitle, got %v", err)
	}

	tooLongDescription := strings.Repeat("а", maximumTaskDescriptionLength+1)
	if _, err := tasks.Create(context.Background(), 1, "Task", tooLongDescription); !errors.Is(err, ErrTaskDescriptionTooLong) {
		t.Fatalf("expected ErrTaskDescriptionTooLong, got %v", err)
	}
}

func TestTaskUpdateRejectsInvalidStatus(t *testing.T) {
	tasks := NewTaskService(&taskRepositoryStub{})

	_, err := tasks.Update(context.Background(), 1, 2, "Task", "", "unknown")
	if !errors.Is(err, ErrInvalidTaskStatus) {
		t.Fatalf("expected ErrInvalidTaskStatus, got %v", err)
	}
}

func TestTaskUpdateMapsNotFoundError(t *testing.T) {
	tasks := NewTaskService(&taskRepositoryStub{updateErr: repository.ErrTaskNotFound})

	_, err := tasks.Update(context.Background(), 1, 2, "Task", "", "active")
	if !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("expected ErrTaskNotFound, got %v", err)
	}
}
