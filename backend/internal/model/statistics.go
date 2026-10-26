package model

import "time"

type DailyStatistics struct {
	Date               string `json:"date"`
	CompletedPomodoros int64  `json:"completed_pomodoros"`
	FocusSeconds       int64  `json:"focus_seconds"`
}

type TaskStatistics struct {
	TaskID             int64  `json:"task_id"`
	Title              string `json:"title"`
	CompletedPomodoros int64  `json:"completed_pomodoros"`
	FocusSeconds       int64  `json:"focus_seconds"`
	Deleted            bool   `json:"deleted"`
}

type Statistics struct {
	Period             string            `json:"period"`
	CompletedPomodoros int64             `json:"completed_pomodoros"`
	FocusSeconds       int64             `json:"focus_seconds"`
	CompletedTasks     int64             `json:"completed_tasks"`
	CancelledSessions  int64             `json:"cancelled_sessions"`
	Daily              []DailyStatistics `json:"daily"`
	TopTasks           []TaskStatistics  `json:"top_tasks"`
}

type LeaderboardEntry struct {
	Rank                    int64     `json:"rank"`
	UserID                  int64     `json:"user_id"`
	Username                string    `json:"username"`
	AvatarData              string    `json:"avatar_data"`
	Bio                     string    `json:"bio"`
	CreatedAt               time.Time `json:"created_at"`
	CompletedPomodoros      int64     `json:"completed_pomodoros"`
	FocusSeconds            int64     `json:"focus_seconds"`
	TotalCompletedPomodoros int64     `json:"total_completed_pomodoros"`
	TotalFocusSeconds       int64     `json:"total_focus_seconds"`
	TotalCompletedTasks     int64     `json:"total_completed_tasks"`
	LongestStreak           int64     `json:"longest_streak"`
	IsCurrentUser           bool      `json:"is_current_user"`
}

type Leaderboard struct {
	Period  string             `json:"period"`
	Entries []LeaderboardEntry `json:"entries"`
}
