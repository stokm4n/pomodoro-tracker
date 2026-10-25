package config

import (
	"fmt"
	"os"
	"strings"
)

const defaultServerPort = "8080"

// Config contains the environment-dependent backend settings.
type Config struct {
	DatabaseURL   string
	ServerPort    string
	JWTSecret     string
	FrontendDir   string
	MigrationsDir string
}

// Load reads and validates the backend configuration from environment variables.
func Load() (Config, error) {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	serverPort := strings.TrimSpace(os.Getenv("SERVER_PORT"))
	if serverPort == "" {
		serverPort = strings.TrimSpace(os.Getenv("PORT"))
	}
	if serverPort == "" {
		serverPort = defaultServerPort
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET must contain at least 32 characters")
	}

	frontendDir := strings.TrimSpace(os.Getenv("FRONTEND_DIR"))
	if frontendDir == "" {
		frontendDir = "../frontend/dist"
	}

	migrationsDir := strings.TrimSpace(os.Getenv("MIGRATIONS_DIR"))
	if migrationsDir == "" {
		migrationsDir = "../database/migrations"
	}

	return Config{
		DatabaseURL:   databaseURL,
		ServerPort:    serverPort,
		JWTSecret:     jwtSecret,
		FrontendDir:   frontendDir,
		MigrationsDir: migrationsDir,
	}, nil
}
