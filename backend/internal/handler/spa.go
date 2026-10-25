package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// SPA serves the Vite production build and falls back to index.html for routes.
func SPA(frontendDir string) http.HandlerFunc {
	fileServer := http.FileServer(http.Dir(frontendDir))

	return func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
		if cleanPath != "." && cleanPath != "" {
			filePath := filepath.Join(frontendDir, cleanPath)
			if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
	}
}
