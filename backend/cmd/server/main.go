package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pomodoro-tracker/backend/internal/config"
	"pomodoro-tracker/backend/internal/database"
	"pomodoro-tracker/backend/internal/handler"
	"pomodoro-tracker/backend/internal/middleware"
	"pomodoro-tracker/backend/internal/repository"
	"pomodoro-tracker/backend/internal/service"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}

	connectionContext, cancelConnection := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelConnection()

	db, err := database.Open(connectionContext, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	migrationContext, cancelMigration := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancelMigration()
	if err := database.Migrate(migrationContext, db, cfg.MigrationsDir); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}

	userRepository := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepository, cfg.JWTSecret, 24*time.Hour)
	authHandler := handler.NewAuthHandler(authService)
	taskRepository := repository.NewTaskRepository(db)
	taskService := service.NewTaskService(taskRepository)
	taskHandler := handler.NewTaskHandler(taskService)
	settingsRepository := repository.NewSettingsRepository(db)
	settingsService := service.NewSettingsService(settingsRepository)
	settingsHandler := handler.NewSettingsHandler(settingsService)
	sessionRepository := repository.NewSessionRepository(db)
	sessionService := service.NewSessionService(sessionRepository, settingsRepository)
	sessionHandler := handler.NewSessionHandler(sessionService)
	statisticsRepository := repository.NewStatisticsRepository(db)
	statisticsService := service.NewStatisticsService(statisticsRepository)
	statisticsHandler := handler.NewStatisticsHandler(statisticsService)
	adminRepository := repository.NewAdminRepository(db)
	adminService := service.NewAdminService(adminRepository)
	adminHandler := handler.NewAdminHandler(adminService)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.Health(db))
	mux.HandleFunc("GET /api/timer/ticks", handler.TimerTicks)
	mux.HandleFunc("POST /api/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.Handle(
		"GET /api/profile",
		middleware.RequireAuth(authService, http.HandlerFunc(authHandler.Profile)),
	)
	mux.Handle(
		"PUT /api/profile",
		middleware.RequireAuth(authService, http.HandlerFunc(authHandler.UpdateProfile)),
	)
	mux.Handle(
		"PUT /api/profile/details",
		middleware.RequireAuth(authService, http.HandlerFunc(authHandler.UpdateProfileDetails)),
	)
	mux.Handle(
		"PUT /api/profile/privacy",
		middleware.RequireAuth(authService, http.HandlerFunc(authHandler.UpdateProfilePrivacy)),
	)
	mux.Handle(
		"POST /api/tasks",
		middleware.RequireAuth(authService, http.HandlerFunc(taskHandler.Create)),
	)
	mux.Handle(
		"GET /api/tasks",
		middleware.RequireAuth(authService, http.HandlerFunc(taskHandler.List)),
	)
	mux.Handle(
		"PUT /api/tasks/{id}",
		middleware.RequireAuth(authService, http.HandlerFunc(taskHandler.Update)),
	)
	mux.Handle(
		"DELETE /api/tasks/{id}",
		middleware.RequireAuth(authService, http.HandlerFunc(taskHandler.Delete)),
	)
	mux.Handle(
		"DELETE /api/statistics/tasks/{id}",
		middleware.RequireAuth(authService, http.HandlerFunc(taskHandler.DeletePermanently)),
	)
	mux.Handle(
		"GET /api/settings",
		middleware.RequireAuth(authService, http.HandlerFunc(settingsHandler.Get)),
	)
	mux.Handle(
		"PUT /api/settings",
		middleware.RequireAuth(authService, http.HandlerFunc(settingsHandler.Update)),
	)
	mux.Handle(
		"POST /api/sessions/start",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.Start)),
	)
	mux.Handle(
		"GET /api/sessions/current",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.Current)),
	)
	mux.Handle(
		"GET /api/sessions/history",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.History)),
	)
	mux.Handle(
		"POST /api/sessions/{id}/pause",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.Pause)),
	)
	mux.Handle(
		"POST /api/sessions/{id}/resume",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.Resume)),
	)
	mux.Handle(
		"POST /api/sessions/{id}/complete",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.Complete)),
	)
	mux.Handle(
		"POST /api/sessions/{id}/cancel",
		middleware.RequireAuth(authService, http.HandlerFunc(sessionHandler.Cancel)),
	)
	mux.Handle(
		"GET /api/statistics",
		middleware.RequireAuth(authService, http.HandlerFunc(statisticsHandler.Get)),
	)
	mux.Handle(
		"GET /api/leaderboard",
		middleware.RequireAuth(authService, http.HandlerFunc(statisticsHandler.Leaderboard)),
	)
	mux.Handle(
		"GET /api/admin/users",
		middleware.RequireAuth(authService, middleware.RequireAdmin(http.HandlerFunc(adminHandler.ListUsers))),
	)
	mux.Handle(
		"GET /api/admin/users/{id}",
		middleware.RequireAuth(authService, middleware.RequireAdmin(http.HandlerFunc(adminHandler.GetUser))),
	)
	mux.Handle(
		"DELETE /api/admin/users/{id}",
		middleware.RequireAuth(authService, middleware.RequireAdmin(http.HandlerFunc(adminHandler.DeleteUser))),
	)
	mux.Handle(
		"GET /api/admin/statistics",
		middleware.RequireAuth(authService, middleware.RequireAdmin(http.HandlerFunc(adminHandler.Statistics))),
	)
	mux.HandleFunc("GET /", handler.SPA(cfg.FrontendDir))
	server := &http.Server{
		Addr:              ":" + cfg.ServerPort,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdownContext, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("server is listening on http://localhost:%s", cfg.ServerPort)
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("serve HTTP: %w", err)
		}
		return nil
	case <-shutdownContext.Done():
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			return fmt.Errorf("shut down HTTP server: %w", err)
		}
		return nil
	}
}
