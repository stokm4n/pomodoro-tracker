#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! pg_isready -h localhost -p 5433 >/dev/null 2>&1; then
  echo "Запускаем PostgreSQL..."
  /opt/homebrew/opt/postgresql@16/bin/pg_ctl \
    start \
    -D /opt/homebrew/var/postgresql@16 \
    -l /opt/homebrew/var/log/postgresql@16.log \
    -o "-p 5433"

  for _ in {1..30}; do
    if pg_isready -h localhost -p 5433 >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

if ! pg_isready -h localhost -p 5433 >/dev/null 2>&1; then
  echo "PostgreSQL не запустился на порту 5433."
  exit 1
fi

(
  cd "$PROJECT_DIR/backend"
  set -a
  source "$PROJECT_DIR/.env"
  set +a
  GOCACHE=/tmp/pomodoro-go-build go run ./cmd/server
) &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
  wait "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

for _ in {1..50}; do
  if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    wait "$BACKEND_PID"
  fi
  sleep 0.2
done

if ! curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
  echo "Backend не запустился на порту 8080."
  exit 1
fi

echo "Backend готов: http://localhost:8080"
echo "Запускаем frontend..."
cd "$PROJECT_DIR/frontend"
npm run dev
