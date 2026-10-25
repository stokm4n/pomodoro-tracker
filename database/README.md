# Локальная база данных

PostgreSQL запускается из корня проекта:

```bash
cp .env.example .env
docker compose up -d db
```

При первом запуске PostgreSQL автоматически выполняет SQL-файлы из каталога
`database/migrations` в порядке их имен.

Проверить состояние контейнера:

```bash
docker compose ps
docker compose exec db pg_isready -U pomodoro -d pomodoro
```

Открыть консоль PostgreSQL:

```bash
docker compose exec db psql -U pomodoro -d pomodoro
```

SQL-файлы из `docker-entrypoint-initdb.d` выполняются только при создании пустого
тома. После появления новых миграций их следует применять отдельной командой или
через средство миграций backend, которое будет добавлено на следующем этапе.
