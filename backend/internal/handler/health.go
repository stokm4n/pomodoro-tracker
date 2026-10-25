package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// DatabasePinger is the part of the database pool required by the health check.
type DatabasePinger interface {
	Ping(context.Context) error
}

// Health returns a handler that reports the availability of the API and database.
func Health(db DatabasePinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		status := http.StatusOK
		body := map[string]string{"status": "ok"}

		if err := db.Ping(ctx); err != nil {
			status = http.StatusServiceUnavailable
			body["status"] = "unavailable"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	}
}
