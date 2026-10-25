package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pomodoro-tracker/backend/internal/model"
)

const statisticsPeriodCondition = `(
	$2::INTEGER = 0 OR
	(event_time AT TIME ZONE 'Europe/Moscow')::DATE >=
	(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Moscow')::DATE - ($2::INTEGER - 1)
)`

type StatisticsRepository struct {
	db *pgxpool.Pool
}

func NewStatisticsRepository(db *pgxpool.Pool) *StatisticsRepository {
	return &StatisticsRepository{db: db}
}

func (r *StatisticsRepository) Get(
	ctx context.Context,
	userID int64,
	days int,
) (model.Statistics, error) {
	var statistics model.Statistics
	err := r.db.QueryRow(
		ctx,
		`SELECT
			COUNT(*) FILTER (
				WHERE session_type = 'work' AND status = 'completed'
			),
			COALESCE(SUM(elapsed_seconds) FILTER (
				WHERE session_type = 'work' AND status = 'completed'
			), 0),
			COUNT(*) FILTER (WHERE status = 'cancelled')
		 FROM (
			SELECT session_type, status, elapsed_seconds, started_at AS event_time
			FROM pomodoro_sessions
			WHERE user_id = $1
		 ) AS filtered_sessions
		 WHERE `+statisticsPeriodCondition,
		userID,
		days,
	).Scan(
		&statistics.CompletedPomodoros,
		&statistics.FocusSeconds,
		&statistics.CancelledSessions,
	)
	if err != nil {
		return model.Statistics{}, fmt.Errorf("select statistics totals: %w", err)
	}

	err = r.db.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM (
			SELECT completed_at AS event_time
			FROM tasks
			WHERE user_id = $1 AND status = 'completed'
		 ) AS filtered_tasks
		 WHERE `+statisticsPeriodCondition,
		userID,
		days,
	).Scan(&statistics.CompletedTasks)
	if err != nil {
		return model.Statistics{}, fmt.Errorf("select completed tasks statistics: %w", err)
	}

	dailyRows, err := r.db.Query(
		ctx,
		`SELECT TO_CHAR(
		           (event_time AT TIME ZONE 'Europe/Moscow')::DATE,
		           'YYYY-MM-DD'
		       ),
		       COUNT(*),
		       COALESCE(SUM(elapsed_seconds), 0)
		 FROM (
			SELECT started_at AS event_time, elapsed_seconds
			FROM pomodoro_sessions
			WHERE user_id = $1
			  AND session_type = 'work'
			  AND status = 'completed'
		 ) AS filtered_daily
		 WHERE `+statisticsPeriodCondition+`
		 GROUP BY (event_time AT TIME ZONE 'Europe/Moscow')::DATE
		 ORDER BY (event_time AT TIME ZONE 'Europe/Moscow')::DATE`,
		userID,
		days,
	)
	if err != nil {
		return model.Statistics{}, fmt.Errorf("select daily statistics: %w", err)
	}
	statistics.Daily, err = pgx.CollectRows(
		dailyRows,
		pgx.RowToStructByPos[model.DailyStatistics],
	)
	dailyRows.Close()
	if err != nil {
		return model.Statistics{}, fmt.Errorf("collect daily statistics: %w", err)
	}

	taskRows, err := r.db.Query(
		ctx,
		`SELECT task_id, title, COUNT(*),
		        COALESCE(SUM(elapsed_seconds), 0), deleted
		 FROM (
			SELECT sessions.started_at AS event_time,
			       sessions.elapsed_seconds,
			       tasks.id AS task_id,
			       tasks.title,
			       tasks.deleted_at IS NOT NULL AS deleted
			FROM pomodoro_sessions AS sessions
			JOIN tasks ON tasks.id = sessions.task_id
			WHERE sessions.user_id = $1
			  AND sessions.session_type = 'work'
			  AND sessions.status = 'completed'
		 ) AS filtered_task_sessions
		 WHERE `+statisticsPeriodCondition+`
		 GROUP BY task_id, title, deleted
		 ORDER BY COUNT(*) DESC, SUM(elapsed_seconds) DESC, title
		 LIMIT 5`,
		userID,
		days,
	)
	if err != nil {
		return model.Statistics{}, fmt.Errorf("select task statistics: %w", err)
	}
	statistics.TopTasks, err = pgx.CollectRows(
		taskRows,
		pgx.RowToStructByPos[model.TaskStatistics],
	)
	taskRows.Close()
	if err != nil {
		return model.Statistics{}, fmt.Errorf("collect task statistics: %w", err)
	}

	return statistics, nil
}

func (r *StatisticsRepository) GetLeaderboard(
	ctx context.Context,
	currentUserID int64,
	days int,
) ([]model.LeaderboardEntry, error) {
	rows, err := r.db.Query(
		ctx,
		`WITH user_totals AS (
			SELECT u.id AS user_id,
			       u.username,
			       u.avatar_data,
			       COUNT(s.id) AS completed_pomodoros,
			       COALESCE(SUM(s.elapsed_seconds), 0) AS focus_seconds
			FROM users AS u
			LEFT JOIN pomodoro_sessions AS s
			  ON s.user_id = u.id
			 AND s.session_type = 'work'
			 AND s.status = 'completed'
			 AND (
				$1::INTEGER = 0 OR
				(s.started_at AT TIME ZONE 'Europe/Moscow')::DATE >=
				(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Moscow')::DATE - ($1::INTEGER - 1)
			 )
			WHERE u.leaderboard_visible = TRUE
			GROUP BY u.id, u.username, u.avatar_data
		), ranked AS (
			SELECT ROW_NUMBER() OVER (
			           ORDER BY completed_pomodoros DESC, focus_seconds DESC, username
			       ) AS rank,
			       user_id,
			       username,
			       avatar_data,
			       completed_pomodoros,
			       focus_seconds
			FROM user_totals
		)
		SELECT rank,
		       user_id,
		       username,
		       avatar_data,
		       completed_pomodoros,
		       focus_seconds,
		       user_id = $2
		FROM ranked
		ORDER BY rank
		LIMIT 50`,
		days,
		currentUserID,
	)
	if err != nil {
		return nil, fmt.Errorf("select leaderboard: %w", err)
	}
	defer rows.Close()

	entries, err := pgx.CollectRows(rows, pgx.RowToStructByPos[model.LeaderboardEntry])
	if err != nil {
		return nil, fmt.Errorf("collect leaderboard: %w", err)
	}
	return entries, nil
}
