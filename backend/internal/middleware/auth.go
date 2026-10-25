package middleware

import (
	"context"
	"net/http"
	"strings"

	"pomodoro-tracker/backend/internal/model"
)

type tokenParser interface {
	ParseToken(string) (model.User, error)
}

type contextKey string

const userContextKey contextKey = "authenticated-user"

// RequireAuth rejects requests without a valid Bearer token.
func RequireAuth(parser tokenParser, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization := r.Header.Get("Authorization")
		parts := strings.Fields(authorization)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeUnauthorized(w)
			return
		}

		user, err := parser.ParseToken(parts[1])
		if err != nil {
			writeUnauthorized(w)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) (model.User, bool) {
	user, ok := ctx.Value(userContextKey).(model.User)
	return user, ok
}

// RequireAdmin allows the request only for an authenticated administrator.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			writeUnauthorized(w)
			return
		}
		if user.Role != "admin" {
			writeForbidden(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte("{\"error\":\"authorization required\"}\n"))
}

func writeForbidden(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte("{\"error\":\"administrator access required\"}\n"))
}
