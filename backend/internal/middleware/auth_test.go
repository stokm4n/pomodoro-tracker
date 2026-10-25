package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"pomodoro-tracker/backend/internal/model"
)

type tokenParserStub struct {
	user model.User
	err  error
}

func (p tokenParserStub) ParseToken(string) (model.User, error) {
	return p.user, p.err
}

func TestRequireAuthAddsUserToContext(t *testing.T) {
	expectedUser := model.User{ID: 1, Username: "sergey", Role: "user"}
	protected := RequireAuth(
		tokenParserStub{user: expectedUser},
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok || user.ID != expectedUser.ID {
				t.Fatal("authenticated user is missing from context")
			}
			w.WriteHeader(http.StatusNoContent)
		}),
	)

	request := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	request.Header.Set("Authorization", "Bearer valid-token")
	recorder := httptest.NewRecorder()
	protected.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}
}

func TestRequireAuthRejectsInvalidToken(t *testing.T) {
	protected := RequireAuth(
		tokenParserStub{err: errors.New("invalid token")},
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Fatal("protected handler must not be called")
		}),
	)

	request := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
	request.Header.Set("Authorization", "Bearer invalid-token")
	recorder := httptest.NewRecorder()
	protected.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, recorder.Code)
	}
}

func TestRequireAdminAllowsAdministrator(t *testing.T) {
	protected := RequireAuth(
		tokenParserStub{user: model.User{ID: 1, Username: "admin", Role: "admin"}},
		RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})),
	)

	request := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	request.Header.Set("Authorization", "Bearer valid-token")
	recorder := httptest.NewRecorder()
	protected.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, recorder.Code)
	}
}

func TestRequireAdminRejectsRegularUser(t *testing.T) {
	protected := RequireAuth(
		tokenParserStub{user: model.User{ID: 1, Username: "sergey", Role: "user"}},
		RequireAdmin(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Fatal("admin handler must not be called for a regular user")
		})),
	)

	request := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	request.Header.Set("Authorization", "Bearer valid-token")
	recorder := httptest.NewRecorder()
	protected.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, recorder.Code)
	}
}
