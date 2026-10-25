package service

import (
	"context"
	"errors"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

var (
	ErrAdminUserNotFound = errors.New("user not found")
	ErrCannotDeleteSelf  = errors.New("administrator cannot delete their own account")
)

type adminRepository interface {
	ListUsers(context.Context) ([]model.AdminUserSummary, error)
	GetUser(context.Context, int64) (model.AdminUserDetails, error)
	DeleteUser(context.Context, int64) error
	GetSystemStatistics(context.Context) (model.AdminSystemStatistics, error)
}

type AdminService struct {
	admin adminRepository
}

func NewAdminService(admin adminRepository) *AdminService {
	return &AdminService{admin: admin}
}

func (s *AdminService) ListUsers(ctx context.Context) ([]model.AdminUserSummary, error) {
	users, err := s.admin.ListUsers(ctx)
	if err != nil {
		return nil, err
	}
	if users == nil {
		users = make([]model.AdminUserSummary, 0)
	}
	return users, nil
}

func (s *AdminService) GetUser(
	ctx context.Context,
	userID int64,
) (model.AdminUserDetails, error) {
	user, err := s.admin.GetUser(ctx, userID)
	if errors.Is(err, repository.ErrUserNotFound) {
		return model.AdminUserDetails{}, ErrAdminUserNotFound
	}
	return user, err
}

func (s *AdminService) DeleteUser(ctx context.Context, adminID, userID int64) error {
	if adminID == userID {
		return ErrCannotDeleteSelf
	}
	if err := s.admin.DeleteUser(ctx, userID); errors.Is(err, repository.ErrUserNotFound) {
		return ErrAdminUserNotFound
	} else {
		return err
	}
}

func (s *AdminService) GetSystemStatistics(
	ctx context.Context,
) (model.AdminSystemStatistics, error) {
	return s.admin.GetSystemStatistics(ctx)
}
