package handler

import (
	"fmt"
	"net/http"
	"time"
)

// TimerTicks keeps background browser tabs informed without relying only on
// JavaScript timers, which browsers are allowed to throttle.
func TimerTicks(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming is not supported", http.StatusInternalServerError)
		return
	}

	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	sendTick := func() error {
		if _, err := fmt.Fprintf(w, "data: %d\n\n", time.Now().UnixMilli()); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	if err := sendTick(); err != nil {
		return
	}

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if err := sendTick(); err != nil {
				return
			}
		}
	}
}
