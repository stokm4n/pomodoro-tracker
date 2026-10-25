package service

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/repository"
)

const (
	minimumUsernameLength = 3
	maximumUsernameLength = 50
	minimumPasswordLength = 8
	maximumPasswordLength = 72
	maximumBioLength      = 500
	maximumAvatarBytes    = 1 << 20
)

var (
	ErrInvalidUsername        = errors.New("username must be 3-50 characters and contain only letters, numbers, '.', '_' or '-'")
	ErrInvalidPassword        = errors.New("password must contain 8-72 characters")
	ErrUsernameTaken          = errors.New("username is already taken")
	ErrInvalidCredentials     = errors.New("invalid username or password")
	ErrInvalidCurrentPassword = errors.New("current password is incorrect")
	ErrInvalidToken           = errors.New("invalid or expired token")
	ErrInvalidBio             = errors.New("bio must contain no more than 500 characters")
	ErrInvalidAvatar          = errors.New("avatar must be a JPEG, PNG or WebP image up to 1 MB")

	usernamePattern = regexp.MustCompile(`^[a-z0-9._-]+$`)
)

type userRepository interface {
	Create(context.Context, string, string) (model.User, error)
	FindByUsername(context.Context, string) (model.User, error)
	FindByID(context.Context, int64) (model.User, error)
	UpdateProfile(context.Context, int64, string, *string) (model.User, error)
	UpdateProfileDetails(context.Context, int64, string, *string) (model.User, error)
	UpdateLeaderboardVisibility(context.Context, int64, bool) (model.User, error)
}

type tokenClaims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type AuthResult struct {
	User  model.User `json:"user"`
	Token string     `json:"token"`
}

// AuthService contains registration, login and JWT validation logic.
type AuthService struct {
	users         userRepository
	jwtSecret     []byte
	tokenLifetime time.Duration
}

func NewAuthService(
	users userRepository,
	jwtSecret string,
	tokenLifetime time.Duration,
) *AuthService {
	return &AuthService{
		users:         users,
		jwtSecret:     []byte(jwtSecret),
		tokenLifetime: tokenLifetime,
	}
}

func (s *AuthService) Register(
	ctx context.Context,
	username string,
	password string,
) (AuthResult, error) {
	username = normalizeUsername(username)
	if !validUsername(username) {
		return AuthResult{}, ErrInvalidUsername
	}
	if len(password) < minimumPasswordLength || len(password) > maximumPasswordLength {
		return AuthResult{}, ErrInvalidPassword
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResult{}, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.users.Create(ctx, username, string(passwordHash))
	if errors.Is(err, repository.ErrUsernameTaken) {
		return AuthResult{}, ErrUsernameTaken
	}
	if err != nil {
		return AuthResult{}, err
	}

	token, err := s.createToken(user)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{User: user, Token: token}, nil
}

func (s *AuthService) Login(
	ctx context.Context,
	username string,
	password string,
) (AuthResult, error) {
	username = normalizeUsername(username)
	user, err := s.users.FindByUsername(ctx, username)
	if errors.Is(err, repository.ErrUserNotFound) {
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash),
		[]byte(password),
	); err != nil {
		return AuthResult{}, ErrInvalidCredentials
	}

	token, err := s.createToken(user)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{User: user, Token: token}, nil
}

func (s *AuthService) GetProfile(ctx context.Context, userID int64) (model.User, error) {
	user, err := s.users.FindByID(ctx, userID)
	if errors.Is(err, repository.ErrUserNotFound) {
		return model.User{}, ErrInvalidToken
	}
	return user, err
}

func (s *AuthService) UpdateProfile(
	ctx context.Context,
	userID int64,
	username string,
	currentPassword string,
	newPassword string,
) (AuthResult, error) {
	username = normalizeUsername(username)
	if !validUsername(username) {
		return AuthResult{}, ErrInvalidUsername
	}

	user, err := s.users.FindByID(ctx, userID)
	if errors.Is(err, repository.ErrUserNotFound) {
		return AuthResult{}, ErrInvalidToken
	}
	if err != nil {
		return AuthResult{}, err
	}

	var passwordHash *string
	if newPassword != "" {
		if len(newPassword) < minimumPasswordLength || len(newPassword) > maximumPasswordLength {
			return AuthResult{}, ErrInvalidPassword
		}
		if err := bcrypt.CompareHashAndPassword(
			[]byte(user.PasswordHash),
			[]byte(currentPassword),
		); err != nil {
			return AuthResult{}, ErrInvalidCurrentPassword
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return AuthResult{}, fmt.Errorf("hash new password: %w", err)
		}
		hashString := string(hash)
		passwordHash = &hashString
	}

	updatedUser, err := s.users.UpdateProfile(ctx, userID, username, passwordHash)
	if errors.Is(err, repository.ErrUsernameTaken) {
		return AuthResult{}, ErrUsernameTaken
	}
	if err != nil {
		return AuthResult{}, err
	}

	token, err := s.createToken(updatedUser)
	if err != nil {
		return AuthResult{}, err
	}
	return AuthResult{User: updatedUser, Token: token}, nil
}

func (s *AuthService) UpdateProfileDetails(
	ctx context.Context,
	userID int64,
	bio string,
	avatarData *string,
) (model.User, error) {
	bio = strings.TrimSpace(bio)
	if utf8.RuneCountInString(bio) > maximumBioLength {
		return model.User{}, ErrInvalidBio
	}
	if avatarData != nil && *avatarData != "" && !validAvatarData(*avatarData) {
		return model.User{}, ErrInvalidAvatar
	}

	user, err := s.users.UpdateProfileDetails(ctx, userID, bio, avatarData)
	if errors.Is(err, repository.ErrUserNotFound) {
		return model.User{}, ErrInvalidToken
	}
	return user, err
}

func (s *AuthService) UpdateLeaderboardVisibility(
	ctx context.Context,
	userID int64,
	visible bool,
) (model.User, error) {
	user, err := s.users.UpdateLeaderboardVisibility(ctx, userID, visible)
	if errors.Is(err, repository.ErrUserNotFound) {
		return model.User{}, ErrInvalidToken
	}
	return user, err
}

func validAvatarData(value string) bool {
	comma := strings.IndexByte(value, ',')
	if comma < 0 {
		return false
	}
	header := value[:comma]
	if header != "data:image/jpeg;base64" &&
		header != "data:image/png;base64" &&
		header != "data:image/webp;base64" {
		return false
	}
	decoded, err := base64.StdEncoding.DecodeString(value[comma+1:])
	return err == nil && len(decoded) > 0 && len(decoded) <= maximumAvatarBytes
}

func (s *AuthService) ParseToken(tokenString string) (model.User, error) {
	claims := &tokenClaims{}
	token, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (any, error) {
			return s.jwtSecret, nil
		},
		jwt.WithIssuer("pomodoro-tracker"),
		jwt.WithExpirationRequired(),
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil || !token.Valid {
		return model.User{}, ErrInvalidToken
	}

	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || userID <= 0 || claims.Username == "" || claims.Role == "" {
		return model.User{}, ErrInvalidToken
	}

	return model.User{
		ID:       userID,
		Username: claims.Username,
		Role:     claims.Role,
	}, nil
}

func (s *AuthService) createToken(user model.User) (string, error) {
	now := time.Now()
	claims := tokenClaims{
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "pomodoro-tracker",
			Subject:   strconv.FormatInt(user.ID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenLifetime)),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("sign JWT: %w", err)
	}
	return token, nil
}

func normalizeUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func validUsername(username string) bool {
	return len(username) >= minimumUsernameLength &&
		len(username) <= maximumUsernameLength &&
		usernamePattern.MatchString(username)
}
