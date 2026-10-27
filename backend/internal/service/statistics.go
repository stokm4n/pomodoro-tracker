package service

import (
	"context"
	"errors"

	"pomodoro-tracker/backend/internal/model"
)

var (
	ErrInvalidStatisticsPeriod  = errors.New("period must be 'today', 'week' or 'all'")
	ErrInvalidLeaderboardPeriod = errors.New("period must be 'week' or 'all'")
)

type statisticsRepository interface {
	Get(context.Context, int64, int) (model.Statistics, error)
	GetLeaderboard(context.Context, int64, int) ([]model.LeaderboardEntry, error)
}

func (s *StatisticsService) GetLeaderboard(
	ctx context.Context,
	currentUserID int64,
	period string,
) (model.Leaderboard, error) {
	days := 0
	switch period {
	case "week":
		days = 7
	case "all":
		days = 0
	default:
		return model.Leaderboard{}, ErrInvalidLeaderboardPeriod
	}

	entries, err := s.statistics.GetLeaderboard(ctx, currentUserID, days)
	if err != nil {
		return model.Leaderboard{}, err
	}
	if entries == nil {
		entries = make([]model.LeaderboardEntry, 0)
	}
	return model.Leaderboard{Period: period, Entries: entries}, nil
}

type StatisticsService struct {
	statistics statisticsRepository
}

func NewStatisticsService(statistics statisticsRepository) *StatisticsService {
	return &StatisticsService{statistics: statistics}
}

func (s *StatisticsService) Get(
	ctx context.Context,
	userID int64,
	period string,
) (model.Statistics, error) {
	days := 0
	switch period {
	case "today":
		days = 1
	case "week":
		days = 7
	case "all":
		days = 0
	default:
		return model.Statistics{}, ErrInvalidStatisticsPeriod
	}

	statistics, err := s.statistics.Get(ctx, userID, days)
	if err != nil {
		return model.Statistics{}, err
	}
	statistics.Period = period
	if statistics.Daily == nil {
		statistics.Daily = make([]model.DailyStatistics, 0)
	}
	if statistics.TopTasks == nil {
		statistics.TopTasks = make([]model.TaskStatistics, 0)
	}
	if statistics.BreakActivities == nil {
		statistics.BreakActivities = make([]model.BreakActivityStatistics, 0)
	}
	return statistics, nil
}
