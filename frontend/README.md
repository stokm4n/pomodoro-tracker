# Frontend

## Требования

- Node.js 20.19 или новее;
- запущенный backend на `http://localhost:8080`.

## Запуск

```bash
npm install
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`. Запросы с путём
`/api` Vite автоматически перенаправляет на Go backend.

## Проверка и сборка

```bash
npm run typecheck
npm run build
```
