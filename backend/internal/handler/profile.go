package handler

import (
	"errors"
	"log"
	"net/http"

	"pomodoro-tracker/backend/internal/middleware"
	"pomodoro-tracker/backend/internal/service"
)

type profileUpdateRequest struct {
	Username        string `json:"username"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type profileDetailsUpdateRequest struct {
	Bio        string  `json:"bio"`
	AvatarData *string `json:"avatar_data"`
}

type profilePrivacyUpdateRequest struct {
	LeaderboardVisible bool `json:"leaderboard_visible"`
}

func (h *AuthHandler) Profile(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	profile, err := h.auth.GetProfile(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			writeError(w, http.StatusUnauthorized, "authorization required")
			return
		}
		log.Printf("get profile: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
}

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	var request profileUpdateRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	result, err := h.auth.UpdateProfile(
		r.Context(),
		user.ID,
		request.Username,
		request.CurrentPassword,
		request.NewPassword,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidUsername),
			errors.Is(err, service.ErrInvalidPassword):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrInvalidCurrentPassword):
			writeError(w, http.StatusUnauthorized, err.Error())
		case errors.Is(err, service.ErrUsernameTaken):
			writeError(w, http.StatusConflict, err.Error())
		default:
			log.Printf("update profile: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *AuthHandler) UpdateProfileDetails(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	var request profileDetailsUpdateRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	profile, err := h.auth.UpdateProfileDetails(
		r.Context(), user.ID, request.Bio, request.AvatarData,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidBio),
			errors.Is(err, service.ErrInvalidAvatar):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrInvalidToken):
			writeError(w, http.StatusUnauthorized, "authorization required")
		default:
			log.Printf("update profile details: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
}

func (h *AuthHandler) UpdateProfilePrivacy(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	var request profilePrivacyUpdateRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	profile, err := h.auth.UpdateLeaderboardVisibility(
		r.Context(), user.ID, request.LeaderboardVisible,
	)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			writeError(w, http.StatusUnauthorized, "authorization required")
			return
		}
		log.Printf("update profile privacy: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
}
