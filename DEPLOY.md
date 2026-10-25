# Публикация Pomodoro Tracker

Приложение разворачивается как один Docker-сервис: Go обслуживает REST API и
собранный React frontend. PostgreSQL размещается отдельно в Neon.

## 1. Репозиторий GitHub

Создайте пустой репозиторий `pomodoro-tracker` на GitHub, затем из корня проекта:

```bash
git init
git add .
git commit -m "Prepare Pomodoro Tracker for deployment"
git branch -M main
git remote add origin URL_РЕПОЗИТОРИЯ
git push -u origin main
```

Файл `.env` не должен попадать в репозиторий.

## 2. PostgreSQL в Neon

1. Создайте проект в Neon.
2. Скопируйте строку подключения PostgreSQL с `sslmode=require`.
3. Отдельно выполнять SQL не требуется: сервер применит файлы из
   `database/migrations` при первом запуске.

## 3. Web Service в Render

1. В Render выберите **New → Blueprint**.
2. Подключите GitHub-репозиторий проекта.
3. Render прочитает `render.yaml` и создаст Web Service.
4. В переменную `DATABASE_URL` вставьте строку подключения Neon.
5. `JWT_SECRET` Render создаст автоматически.
6. Запустите развёртывание.

После успешной сборки приложение будет доступно по HTTPS-адресу вида
`https://pomodoro-tracker-xxxx.onrender.com`.

## Ограничение бесплатного Render

Бесплатный Web Service засыпает после периода без запросов. Первый запрос после
сна может открываться около минуты. Данные при этом остаются в Neon.
