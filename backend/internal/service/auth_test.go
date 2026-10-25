package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

const testJWTSecret = "test_secret_with_at_least_32_characters"

type userRepositoryStub struct {
	createdUsername string
	createdHash     string
	createUser      model.User
	createErr       error
	foundUser       model.User
	findErr         error
	updatedUser     model.User
	updateErr       error
}

func (r *userRepositoryStub) Create(
	_ context.Context,
	username string,
	passwordHash string,
) (model.User, error) {
	r.createdUsername = username
	r.createdHash = passwordHash
	return r.createUser, r.createErr
}

func (r *userRepositoryStub) FindByUsername(
	context.Context,
	string,
) (model.User, error) {
	return r.foundUser, r.findErr
}

func (r *userRepositoryStub) FindByID(context.Context, int64) (model.User, error) {
	return r.foundUser, r.findErr
}

func (r *userRepositoryStub) UpdateProfile(
	_ context.Context,
	_ int64,
	username string,
	passwordHash *string,
) (model.User, error) {
	r.updatedUser.Username = username
	if passwordHash != nil {
		r.updatedUser.PasswordHash = *passwordHash
	}
	return r.updatedUser, r.updateErr
}

func (r *userRepositoryStub) UpdateProfileDetails(
	_ context.Context,
	_ int64,
	bio string,
	avatarData *string,
) (model.User, error) {
	r.updatedUser.Bio = bio
	if avatarData != nil {
		r.updatedUser.AvatarData = *avatarData
	}
	return r.updatedUser, r.updateErr
}

func (r *userRepositoryStub) UpdateLeaderboardVisibility(
	_ context.Context,
	_ int64,
	visible bool,
) (model.User, error) {
	r.updatedUser.LeaderboardVisible = visible
	return r.updatedUser, r.updateErr
}

func TestRegisterHashesPasswordAndCreatesToken(t *testing.T) {
	repositoryStub := &userRepositoryStub{
		createUser: model.User{ID: 1, Username: "sergey", Role: "user"},
	}
	auth := NewAuthService(repositoryStub, testJWTSecret, time.Hour)

	result, err := auth.Register(context.Background(), " Sergey ", "password123")
	if err != nil {
		t.Fatalf("Register() returned an error: %v", err)
	}

	if repositoryStub.createdUsername != "sergey" {
		t.Errorf("expected normalized username, got %q", repositoryStub.createdUsername)
	}
	if repositoryStub.createdHash == "password123" {
		t.Fatal("password was stored without hashing")
	}
	if err := bcrypt.CompareHashAndPassword(
		[]byte(repositoryStub.createdHash),
		[]byte("password123"),
	); err != nil {
		t.Fatalf("stored password hash does not match: %v", err)
	}

	user, err := auth.ParseToken(result.Token)
	if err != nil {
		t.Fatalf("ParseToken() returned an error: %v", err)
	}
	if user.ID != 1 || user.Username != "sergey" || user.Role != "user" {
		t.Errorf("unexpected token user: %+v", user)
	}
}

func TestRegisterRejectsInvalidInput(t *testing.T) {
	auth := NewAuthService(&userRepositoryStub{}, testJWTSecret, time.Hour)

	if _, err := auth.Register(context.Background(), "a", "password123"); !errors.Is(err, ErrInvalidUsername) {
		t.Fatalf("expected ErrInvalidUsername, got %v", err)
	}
	if _, err := auth.Register(context.Background(), "sergey", "short"); !errors.Is(err, ErrInvalidPassword) {
		t.Fatalf("expected ErrInvalidPassword, got %v", err)
	}
}

func TestRegisterReportsTakenUsername(t *testing.T) {
	auth := NewAuthService(
		&userRepositoryStub{createErr: repository.ErrUsernameTaken},
		testJWTSecret,
		time.Hour,
	)

	_, err := auth.Register(context.Background(), "sergey", "password123")
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken, got %v", err)
	}
}

func TestLoginRejectsWrongPassword(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("create test password hash: %v", err)
	}

	auth := NewAuthService(
		&userRepositoryStub{foundUser: model.User{PasswordHash: string(hash)}},
		testJWTSecret,
		time.Hour,
	)

	_, err = auth.Login(context.Background(), "sergey", "wrong-password")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestUpdateProfileChangesUsernameAndPassword(t *testing.T) {
	oldHash, err := bcrypt.GenerateFromPassword([]byte("oldpassword"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("create old password hash: %v", err)
	}

	repositoryStub := &userRepositoryStub{
		foundUser: model.User{
			ID: 5, Username: "old-name", PasswordHash: string(oldHash), Role: "user",
		},
		updatedUser: model.User{
			ID: 5, Username: "old-name", PasswordHash: string(oldHash), Role: "user",
		},
	}
	auth := NewAuthService(repositoryStub, testJWTSecret, time.Hour)

	result, err := auth.UpdateProfile(
		context.Background(), 5, " New-Name ", "oldpassword", "newpassword",
	)
	if err != nil {
		t.Fatalf("UpdateProfile() returned an error: %v", err)
	}
	if result.User.Username != "new-name" {
		t.Fatalf("expected normalized username, got %q", result.User.Username)
	}
	if err := bcrypt.CompareHashAndPassword(
		[]byte(result.User.PasswordHash), []byte("newpassword"),
	); err != nil {
		t.Fatalf("new password hash does not match: %v", err)
	}
	parsedUser, err := auth.ParseToken(result.Token)
	if err != nil {
		t.Fatalf("ParseToken() returned an error: %v", err)
	}
	if parsedUser.Username != "new-name" {
		t.Fatalf("token contains old username: %q", parsedUser.Username)
	}
}

func TestUpdateProfileRejectsWrongCurrentPassword(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("oldpassword"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("create password hash: %v", err)
	}
	auth := NewAuthService(&userRepositoryStub{
		foundUser: model.User{ID: 5, Username: "sergey", PasswordHash: string(hash)},
	}, testJWTSecret, time.Hour)

	_, err = auth.UpdateProfile(
		context.Background(), 5, "sergey", "wrong-password", "newpassword",
	)
	if !errors.Is(err, ErrInvalidCurrentPassword) {
		t.Fatalf("expected ErrInvalidCurrentPassword, got %v", err)
	}
}

func TestUpdateProfileDetailsValidatesAndStoresData(t *testing.T) {
	repositoryStub := &userRepositoryStub{
		updatedUser: model.User{ID: 5, Username: "sergey", Role: "user"},
	}
	auth := NewAuthService(repositoryStub, testJWTSecret, time.Hour)
	avatar := "data:image/png;base64,aGVsbG8="

	user, err := auth.UpdateProfileDetails(
		context.Background(), 5, "  О себе  ", &avatar,
	)
	if err != nil {
		t.Fatalf("UpdateProfileDetails() returned an error: %v", err)
	}
	if user.Bio != "О себе" || user.AvatarData != avatar {
		t.Fatalf("unexpected updated profile: %+v", user)
	}
}

func TestUpdateProfileDetailsRejectsInvalidAvatar(t *testing.T) {
	auth := NewAuthService(&userRepositoryStub{}, testJWTSecret, time.Hour)
	avatar := "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="

	_, err := auth.UpdateProfileDetails(context.Background(), 5, "", &avatar)
	if !errors.Is(err, ErrInvalidAvatar) {
		t.Fatalf("expected ErrInvalidAvatar, got %v", err)
	}
}
