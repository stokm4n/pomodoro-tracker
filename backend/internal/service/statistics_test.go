package service

import (
	"context"
	"errors"
	"testing"

	"pomodoro-tracker/backend/internal/model"
)

type statisticsRepositoryStub struct {
	days int
}

func (r *statisticsRepositoryStub) Get(
	_ context.Context,
	_ int64,
	days int,
) (model.Statistics, error) {
	r.days = days
	return model.Statistics{CompletedPomodoros: 3}, nil
}

func (r *statisticsRepositoryStub) GetLeaderboard(
	_ context.Context,
	_ int64,
	days int,
) ([]model.LeaderboardEntry, error) {
	r.days = days
	return []model.LeaderboardEntry{{Rank: 1, Username: "sergey"}}, nil
}

func TestStatisticsPeriodMapping(t *testing.T) {
	tests := []struct {
		period string
		days   int
	}{
		{"today", 1},
		{"week", 7},
		{"all", 0},
	}

	for _, test := range tests {
		t.Run(test.period, func(t *testing.T) {
			repositoryStub := &statisticsRepositoryStub{}
			statistics := NewStatisticsService(repositoryStub)
			result, err := statistics.Get(context.Background(), 5, test.period)
			if err != nil {
				t.Fatalf("Get() returned an error: %v", err)
			}
			if repositoryStub.days != test.days || result.Period != test.period {
				t.Fatalf("unexpected mapping: days=%d period=%s", repositoryStub.days, result.Period)
			}
		})
	}
}

func TestStatisticsRejectsInvalidPeriod(t *testing.T) {
	statistics := NewStatisticsService(&statisticsRepositoryStub{})
	_, err := statistics.Get(context.Background(), 1, "month")
	if !errors.Is(err, ErrInvalidStatisticsPeriod) {
		t.Fatalf("expected ErrInvalidStatisticsPeriod, got %v", err)
	}
}

func TestLeaderboardPeriodMapping(t *testing.T) {
	tests := []struct {
		period string
		days   int
	}{
		{"week", 7},
		{"all", 0},
	}

	for _, test := range tests {
		t.Run(test.period, func(t *testing.T) {
			repositoryStub := &statisticsRepositoryStub{}
			statistics := NewStatisticsService(repositoryStub)
			result, err := statistics.GetLeaderboard(context.Background(), 5, test.period)
			if err != nil {
				t.Fatalf("GetLeaderboard() returned an error: %v", err)
			}
			if repositoryStub.days != test.days || result.Period != test.period {
				t.Fatalf("unexpected mapping: days=%d period=%s", repositoryStub.days, result.Period)
			}
		})
	}
}
