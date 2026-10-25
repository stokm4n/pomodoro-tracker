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
	ErrUsernameTaken = errors.New("username is already taken")
	ErrUserNotFound  = errors.New("user not found")
)

// UserRepository stores and retrieves users in PostgreSQL.
type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// Create inserts a user and default settings in one transaction.
func (r *UserRepository) Create(
	ctx context.Context,
	username string,
	passwordHash string,
) (model.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.User{}, fmt.Errorf("begin user transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var user model.User
	err = tx.QueryRow(
		ctx,
		`INSERT INTO users (username, password_hash)
		 VALUES ($1, $2)
		 RETURNING id, username, password_hash, role, created_at, bio, avatar_data,
		           leaderboard_visible`,
		username,
		passwordHash,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.Bio,
		&user.AvatarData,
		&user.LeaderboardVisible,
	)
	if err != nil {
		var postgresError *pgconn.PgError
		if errors.As(err, &postgresError) && postgresError.Code == "23505" {
			return model.User{}, ErrUsernameTaken
		}
		return model.User{}, fmt.Errorf("insert user: %w", err)
	}

	if _, err := tx.Exec(
		ctx,
		`INSERT INTO user_settings (user_id) VALUES ($1)`,
		user.ID,
	); err != nil {
		return model.User{}, fmt.Errorf("insert user settings: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return model.User{}, fmt.Errorf("commit user transaction: %w", err)
	}

	return user, nil
}

func (r *UserRepository) FindByUsername(
	ctx context.Context,
	username string,
) (model.User, error) {
	var user model.User
	err := r.db.QueryRow(
		ctx,
		`SELECT id, username, password_hash, role, created_at, bio, avatar_data,
		        leaderboard_visible
		 FROM users
		 WHERE username = $1`,
		username,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.Bio,
		&user.AvatarData,
		&user.LeaderboardVisible,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrUserNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("find user by username: %w", err)
	}

	return user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, userID int64) (model.User, error) {
	var user model.User
	err := r.db.QueryRow(
		ctx,
		`SELECT id, username, password_hash, role, created_at, bio, avatar_data,
		        leaderboard_visible
		 FROM users
		 WHERE id = $1`,
		userID,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.Bio,
		&user.AvatarData,
		&user.LeaderboardVisible,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrUserNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("find user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) UpdateProfile(
	ctx context.Context,
	userID int64,
	username string,
	passwordHash *string,
) (model.User, error) {
	var user model.User
	err := r.db.QueryRow(
		ctx,
		`UPDATE users
		 SET username = $2,
		     password_hash = COALESCE($3, password_hash)
		 WHERE id = $1
		 RETURNING id, username, password_hash, role, created_at, bio, avatar_data,
		           leaderboard_visible`,
		userID,
		username,
		passwordHash,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.Bio,
		&user.AvatarData,
		&user.LeaderboardVisible,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrUserNotFound
	}
	if err != nil {
		var postgresError *pgconn.PgError
		if errors.As(err, &postgresError) && postgresError.Code == "23505" {
			return model.User{}, ErrUsernameTaken
		}
		return model.User{}, fmt.Errorf("update user profile: %w", err)
	}
	return user, nil
}

func (r *UserRepository) UpdateProfileDetails(
	ctx context.Context,
	userID int64,
	bio string,
	avatarData *string,
) (model.User, error) {
	var user model.User
	err := r.db.QueryRow(
		ctx,
		`UPDATE users
		 SET bio = $2,
		     avatar_data = COALESCE($3, avatar_data)
		 WHERE id = $1
		 RETURNING id, username, password_hash, role, created_at, bio, avatar_data,
		           leaderboard_visible`,
		userID,
		bio,
		avatarData,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.Bio,
		&user.AvatarData,
		&user.LeaderboardVisible,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrUserNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("update user profile details: %w", err)
	}
	return user, nil
}

func (r *UserRepository) UpdateLeaderboardVisibility(
	ctx context.Context,
	userID int64,
	visible bool,
) (model.User, error) {
	var user model.User
	err := r.db.QueryRow(
		ctx,
		`UPDATE users
		 SET leaderboard_visible = $2
		 WHERE id = $1
		 RETURNING id, username, password_hash, role, created_at, bio, avatar_data,
		           leaderboard_visible`,
		userID,
		visible,
	).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.Bio,
		&user.AvatarData,
		&user.LeaderboardVisible,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, ErrUserNotFound
	}
	if err != nil {
		return model.User{}, fmt.Errorf("update leaderboard visibility: %w", err)
	}
	return user, nil
}
