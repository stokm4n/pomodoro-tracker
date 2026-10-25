package handler

import (
	"errors"
	"log"
	"net/http"

	"pomodoro-tracker/backend/internal/middleware"
	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/service"
)

type settingsRequest struct {
	WorkDurationMinutes  int    `json:"work_duration_minutes"`
	ShortBreakMinutes    int    `json:"short_break_minutes"`
	LongBreakMinutes     int    `json:"long_break_minutes"`
	NotificationsEnabled bool   `json:"notifications_enabled"`
	NotificationSound    string `json:"notification_sound"`
	NotificationVolume   int    `json:"notification_volume"`
}

type SettingsHandler struct {
	settings *service.SettingsService
}

func NewSettingsHandler(settings *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{settings: settings}
}

func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	settings, err := h.settings.Get(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, service.ErrSettingsNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Printf("get settings: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"settings": settings})
}

func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	var request settingsRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	settings, err := h.settings.Update(r.Context(), model.Settings{
		UserID:               user.ID,
		WorkDurationMinutes:  request.WorkDurationMinutes,
		ShortBreakMinutes:    request.ShortBreakMinutes,
		LongBreakMinutes:     request.LongBreakMinutes,
		NotificationsEnabled: request.NotificationsEnabled,
		NotificationSound:    request.NotificationSound,
		NotificationVolume:   request.NotificationVolume,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidWorkDuration),
			errors.Is(err, service.ErrInvalidShortBreak),
			errors.Is(err, service.ErrInvalidLongBreak),
			errors.Is(err, service.ErrInvalidNotificationSound),
			errors.Is(err, service.ErrInvalidNotificationVolume):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrSettingsNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		default:
			log.Printf("update settings: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"settings": settings})
}
