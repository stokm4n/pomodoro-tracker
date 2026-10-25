package model

import "time"

// User is an application user. PasswordHash is never included in JSON responses.
type User struct {
	ID                 int64     `json:"id"`
	Username           string    `json:"username"`
	PasswordHash       string    `json:"-"`
	Role               string    `json:"role"`
	CreatedAt          time.Time `json:"created_at"`
	Bio                string    `json:"bio"`
	AvatarData         string    `json:"avatar_data"`
	LeaderboardVisible bool      `json:"leaderboard_visible"`
}
