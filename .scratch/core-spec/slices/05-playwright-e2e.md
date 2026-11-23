# Срез 5: браузерный сценарий Playwright

Status: resolved
Parent: [Реализация: вертикальные тикеты и первая сквозная функция](../issues/15-vertical-slices.md)
Blocked by: 03
Commits: `ee69570` test: add Playwright browser scenario and e2e CI job

> Тикет оформлен задним числом (2026-11-23): работа выполнена и слита в `master` до его создания; коммит не содержит строки `Refs`.

## Задача

Браузерный сценарий основного пути на настоящих серверах (тикет «Проверка приложения») и его запуск в CI (тикет «Качество и релизы»).

## Сделано

- Пакет `e2e/` (Playwright 1.65.1), `mise run e2e`; Playwright поднимает бэкенд (порт 18080, H2 в памяти) и Vite (порт 15173).
- Сценарий: владелец создаёт тип встречи и расписание → гость записывается с главной → владелец видит запись.
- CI: задача `e2e` в `project-check.yml` после `check`, отчёт Playwright при падении; `backend/mvnw` сделан исполняемым.
- AGENTS.md и README: команда `mise run e2e`.

## Проверки

`mise run e2e` локально: 1 тест прошёл; `mise run check` зелёный; в GitHub Actions задача `e2e` на Linux и `hexlet-check` зелёные.
