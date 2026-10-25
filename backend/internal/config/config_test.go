package config

import "testing"

func TestLoad(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:password@localhost:5432/pomodoro")
	t.Setenv("SERVER_PORT", "9090")
	t.Setenv("JWT_SECRET", "test_secret_with_at_least_32_characters")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}

	if cfg.DatabaseURL != "postgres://user:password@localhost:5432/pomodoro" {
		t.Errorf("unexpected database URL: %q", cfg.DatabaseURL)
	}
	if cfg.ServerPort != "9090" {
		t.Errorf("unexpected server port: %q", cfg.ServerPort)
	}
}

func TestLoadUsesDefaultPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:password@localhost:5432/pomodoro")
	t.Setenv("SERVER_PORT", "")
	t.Setenv("JWT_SECRET", "test_secret_with_at_least_32_characters")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}

	if cfg.ServerPort != defaultServerPort {
		t.Errorf("expected default port %q, got %q", defaultServerPort, cfg.ServerPort)
	}
}

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "test_secret_with_at_least_32_characters")

	if _, err := Load(); err == nil {
		t.Fatal("Load() should return an error when DATABASE_URL is empty")
	}
}

func TestLoadRequiresLongJWTSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:password@localhost:5432/pomodoro")
	t.Setenv("JWT_SECRET", "short")

	if _, err := Load(); err == nil {
		t.Fatal("Load() should return an error when JWT_SECRET is too short")
	}
}
