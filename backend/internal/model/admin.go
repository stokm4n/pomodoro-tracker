package model

import "time"

type AdminUserSummary struct {
	ID                 int64     `json:"id"`
	Username           string    `json:"username"`
	Role               string    `json:"role"`
	CreatedAt          time.Time `json:"created_at"`
	AvatarData         string    `json:"avatar_data"`
	TaskCount          int64     `json:"task_count"`
	CompletedPomodoros int64     `json:"completed_pomodoros"`
	FocusSeconds       int64     `json:"focus_seconds"`
}

type AdminUserDetails struct {
	AdminUserSummary
	ActiveTasks    int64 `json:"active_tasks"`
	CompletedTasks int64 `json:"completed_tasks"`
}

type AdminSystemStatistics struct {
	TotalUsers         int64 `json:"total_users"`
	TotalTasks         int64 `json:"total_tasks"`
	CompletedTasks     int64 `json:"completed_tasks"`
	CompletedPomodoros int64 `json:"completed_pomodoros"`
	TotalFocusSeconds  int64 `json:"total_focus_seconds"`
}
