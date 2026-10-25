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

type taskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type TaskHandler struct {
	tasks *service.TaskService
}

func NewTaskHandler(tasks *service.TaskService) *TaskHandler {
	return &TaskHandler{tasks: tasks}
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	var request taskRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	task, err := h.tasks.Create(r.Context(), user.ID, request.Title, request.Description)
	if err != nil {
		if isTaskValidationError(err) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("create task: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"task": task})
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	tasks, err := h.tasks.List(r.Context(), user.ID)
	if err != nil {
		log.Printf("list tasks: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if tasks == nil {
		tasks = make([]model.Task, 0)
	}

	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	taskID, err := parseTaskID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	var request taskRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	task, err := h.tasks.Update(
		r.Context(),
		user.ID,
		taskID,
		request.Title,
		request.Description,
		request.Status,
	)
	if err != nil {
		switch {
		case isTaskValidationError(err):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrTaskNotFound):
			writeError(w, http.StatusNotFound, err.Error())
		default:
			log.Printf("update task: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"task": task})
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	taskID, err := parseTaskID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	if err := h.tasks.Delete(r.Context(), user.ID, taskID); err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Printf("delete task: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskHandler) DeletePermanently(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authorization required")
		return
	}

	taskID, err := parseTaskID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	if err := h.tasks.DeletePermanently(r.Context(), user.ID, taskID); err != nil {
		if errors.Is(err, service.ErrTaskNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		log.Printf("permanently delete task: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func parseTaskID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid task id")
	}
	return id, nil
}

func isTaskValidationError(err error) bool {
	return errors.Is(err, service.ErrInvalidTaskTitle) ||
		errors.Is(err, service.ErrTaskDescriptionTooLong) ||
		errors.Is(err, service.ErrInvalidTaskStatus)
}
