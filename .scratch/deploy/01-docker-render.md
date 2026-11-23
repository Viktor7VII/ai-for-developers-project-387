# Docker и деплой на Render

Status: resolved

## Задача

Этап «Docker и деплой»: один Docker-образ (API + собранный фронтенд) на порту из `PORT`, деплой на Render через Render MCP без секретов в Git, проверка публичного сценария записи, README.

## Решения

- Бэкенд отдаёт собранный фронтенд из static-ресурсов; маршруты SPA (`/`, `/admin/**`, `/book/**`) пересылаются на `index.html`.
- `server.port=${PORT:8080}`; база H2 в `/app/data` (на бесплатном Render — временная файловая система).
- Render MCP подключается через `.mcp.json`, ключ — из переменной окружения `RENDER_API_KEY`.
