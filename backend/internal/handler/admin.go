package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"pomodoro-tracker/backend/internal/middleware"
	"pomodoro-tracker/backend/internal/service"
)

type AdminHandler struct {
	admin *service.AdminService
}

func NewAdminHandler(admin *service.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.admin.ListUsers(r.Context())
	if err != nil {
		log.Printf("admin list users: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := adminUserIDFromRequest(w, r)
	if !ok {
		return
	}

	user, err := h.admin.GetUser(r.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrAdminUserNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Printf("admin get user: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	admin, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}
	userID, valid := adminUserIDFromRequest(w, r)
	if !valid {
		return
	}

	err := h.admin.DeleteUser(r.Context(), admin.ID, userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrCannotDeleteSelf):
			writeError(w, http.StatusConflict, err.Error())
		case errors.Is(err, service.ErrAdminUserNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		default:
			log.Printf("admin delete user: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) Statistics(w http.ResponseWriter, r *http.Request) {
	statistics, err := h.admin.GetSystemStatistics(r.Context())
	if err != nil {
		log.Printf("admin get statistics: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"statistics": statistics})
}

func adminUserIDFromRequest(w http.ResponseWriter, r *http.Request) (int64, bool) {
	userID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return 0, false
	}
	return userID, true
}
