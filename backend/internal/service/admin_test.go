package service

import (
	"context"
	"errors"
	"testing"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

type adminRepositoryStub struct {
	users         []model.AdminUserSummary
	user          model.AdminUserDetails
	statistics    model.AdminSystemStatistics
	listErr       error
	getErr        error
	deleteErr     error
	statisticsErr error
	deletedUserID int64
}

func (r *adminRepositoryStub) ListUsers(context.Context) ([]model.AdminUserSummary, error) {
	return r.users, r.listErr
}

func (r *adminRepositoryStub) GetUser(
	context.Context,
	int64,
) (model.AdminUserDetails, error) {
	return r.user, r.getErr
}

func (r *adminRepositoryStub) DeleteUser(_ context.Context, userID int64) error {
	r.deletedUserID = userID
	return r.deleteErr
}

func (r *adminRepositoryStub) GetSystemStatistics(
	context.Context,
) (model.AdminSystemStatistics, error) {
	return r.statistics, r.statisticsErr
}

func TestAdminListUsersReturnsEmptyArray(t *testing.T) {
	admin := NewAdminService(&adminRepositoryStub{})

	users, err := admin.ListUsers(context.Background())
	if err != nil {
		t.Fatalf("ListUsers() returned an error: %v", err)
	}
	if users == nil || len(users) != 0 {
		t.Fatalf("expected an empty non-nil slice, got %#v", users)
	}
}

func TestAdminGetUserReportsNotFound(t *testing.T) {
	admin := NewAdminService(&adminRepositoryStub{getErr: repository.ErrUserNotFound})

	_, err := admin.GetUser(context.Background(), 999)
	if !errors.Is(err, ErrAdminUserNotFound) {
		t.Fatalf("expected ErrAdminUserNotFound, got %v", err)
	}
}

func TestAdminCannotDeleteSelf(t *testing.T) {
	repositoryStub := &adminRepositoryStub{}
	admin := NewAdminService(repositoryStub)

	err := admin.DeleteUser(context.Background(), 5, 5)
	if !errors.Is(err, ErrCannotDeleteSelf) {
		t.Fatalf("expected ErrCannotDeleteSelf, got %v", err)
	}
	if repositoryStub.deletedUserID != 0 {
		t.Fatal("repository must not be called when administrator deletes themself")
	}
}

func TestAdminDeletesAnotherUser(t *testing.T) {
	repositoryStub := &adminRepositoryStub{}
	admin := NewAdminService(repositoryStub)

	if err := admin.DeleteUser(context.Background(), 5, 9); err != nil {
		t.Fatalf("DeleteUser() returned an error: %v", err)
	}
	if repositoryStub.deletedUserID != 9 {
		t.Fatalf("expected deleted user id 9, got %d", repositoryStub.deletedUserID)
	}
}
