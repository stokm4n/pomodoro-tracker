package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"pomodoro-tracker/backend/internal/middleware"
	"pomodoro-tracker/backend/internal/model"
	"pomodoro-tracker/backend/internal/service"
)

type startSessionRequest struct {
	SessionType string `json:"session_type"`
	TaskID      *int64 `json:"task_id"`
}

type SessionHandler struct {
	sessions *service.SessionService
}

func NewSessionHandler(sessions *service.SessionService) *SessionHandler {
	return &SessionHandler{sessions: sessions}
}

func (h *SessionHandler) Start(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	var request startSessionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}
	if request.TaskID != nil && *request.TaskID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	session, err := h.sessions.Start(r.Context(), user.ID, request.TaskID, request.SessionType)
	if err != nil {
		h.writeSessionError(w, "start", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"session": session})
}

func (h *SessionHandler) Current(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	session, err := h.sessions.Current(r.Context(), user.ID)
	if err != nil {
		h.writeSessionError(w, "get current", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": session})
}

func (h *SessionHandler) History(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	history, err := h.sessions.History(r.Context(), user.ID)
	if err != nil {
		log.Printf("get session history: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if history == nil {
		history = make([]model.SessionHistoryItem, 0)
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": history})
}

func (h *SessionHandler) Pause(w http.ResponseWriter, r *http.Request) {
	h.changeState(w, r, "pause")
}

func (h *SessionHandler) Resume(w http.ResponseWriter, r *http.Request) {
	h.changeState(w, r, "resume")
}

func (h *SessionHandler) Complete(w http.ResponseWriter, r *http.Request) {
	h.changeState(w, r, "complete")
}

func (h *SessionHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	h.changeState(w, r, "cancel")
}

func (h *SessionHandler) changeState(w http.ResponseWriter, r *http.Request, action string) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}
	sessionID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || sessionID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid session id")
		return
	}

	var sessionErr error
	var result any
	switch action {
	case "pause":
		result, sessionErr = h.sessions.Pause(r.Context(), user.ID, sessionID)
	case "resume":
		result, sessionErr = h.sessions.Resume(r.Context(), user.ID, sessionID)
	case "complete":
		completion, err := h.sessions.Complete(r.Context(), user.ID, sessionID)
		if err != nil {
			h.writeSessionError(w, action, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"session":              completion.Session,
			"next_session_type":    completion.NextSessionType,
			"completed_work_count": completion.CompletedWorkCount,
		})
		return
	case "cancel":
		result, sessionErr = h.sessions.Cancel(r.Context(), user.ID, sessionID)
	}
	if sessionErr != nil {
		h.writeSessionError(w, action, sessionErr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": result})
}

func (h *SessionHandler) writeSessionError(w http.ResponseWriter, action string, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidSessionType),
		errors.Is(err, service.ErrSessionTaskNotFound):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrSessionNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrActiveSessionExists),
		errors.Is(err, service.ErrInvalidSessionState):
		writeError(w, http.StatusConflict, err.Error())
	default:
		log.Printf("%s session: %v", action, err)
		writeError(w, http.StatusInternalServerError, "internal server error")
	}
}
