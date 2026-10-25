package handler

import (
	"errors"
	"log"
	"net/http"

	"pomodoro-tracker/backend/internal/middleware"
	"pomodoro-tracker/backend/internal/service"
)

type StatisticsHandler struct {
	statistics *service.StatisticsService
}

func NewStatisticsHandler(statistics *service.StatisticsService) *StatisticsHandler {
	return &StatisticsHandler{statistics: statistics}
}

func (h *StatisticsHandler) Get(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "week"
	}
	statistics, err := h.statistics.Get(r.Context(), user.ID, period)
	if err != nil {
		if errors.Is(err, service.ErrInvalidStatisticsPeriod) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("get statistics: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"statistics": statistics})
}

func (h *StatisticsHandler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "week"
	}
	leaderboard, err := h.statistics.GetLeaderboard(r.Context(), user.ID, period)
	if err != nil {
		if errors.Is(err, service.ErrInvalidLeaderboardPeriod) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("get leaderboard: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"leaderboard": leaderboard})
}
