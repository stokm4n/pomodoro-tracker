package model

import "time"

// PomodoroSession is a work or break timer owned by one user.
type PomodoroSession struct {
	ID                     int64      `json:"id"`
	UserID                 int64      `json:"user_id"`
	TaskID                 *int64     `json:"task_id"`
	SessionType            string     `json:"session_type"`
	PlannedDurationSeconds int        `json:"planned_duration_seconds"`
	ElapsedSeconds         int        `json:"elapsed_seconds"`
	RemainingSeconds       int        `json:"remaining_seconds"`
	Status                 string     `json:"status"`
	StartedAt              time.Time  `json:"started_at"`
	StateChangedAt         time.Time  `json:"state_changed_at"`
	EndedAt                *time.Time `json:"ended_at"`
}

// SessionHistoryItem is a finished timer enriched with its task title.
type SessionHistoryItem struct {
	ID                     int64      `json:"id"`
	TaskID                 *int64     `json:"task_id"`
	TaskTitle              *string    `json:"task_title"`
	SessionType            string     `json:"session_type"`
	PlannedDurationSeconds int        `json:"planned_duration_seconds"`
	ElapsedSeconds         int        `json:"elapsed_seconds"`
	Status                 string     `json:"status"`
	StartedAt              time.Time  `json:"started_at"`
	EndedAt                *time.Time `json:"ended_at"`
}
