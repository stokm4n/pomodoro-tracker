package handler

import (
	"errors"
	"log"
	"net/http"

	"pomodoro-tracker/backend/internal/service"
)

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthHandler handles registration and login requests.
type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var request credentials
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	result, err := h.auth.Register(r.Context(), request.Username, request.Password)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidUsername),
			errors.Is(err, service.ErrInvalidPassword):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUsernameTaken):
			writeError(w, http.StatusConflict, err.Error())
		default:
			log.Printf("register user: %v", err)
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var request credentials
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON request")
		return
	}

	result, err := h.auth.Login(r.Context(), request.Username, request.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}

		log.Printf("login user: %v", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, result)
}
