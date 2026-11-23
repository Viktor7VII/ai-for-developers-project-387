# Срез 1: удаление типа встречи и цепочка генерации

Status: resolved
Parent: [Реализация: вертикальные тикеты и первая сквозная функция](../issues/15-vertical-slices.md)
Commits: `070e9c0` feat: delete event types and generate server API from the contract

> Тикет оформлен задним числом (2026-11-23): работа выполнена и слита в `master` до его создания; коммит не содержит строки `Refs`.

## Задача

Первая сквозная функция через всю контрактную цепочку (ADR-0003): удаление типа встречи и инфраструктура генерации серверных интерфейсов.

## Сделано

- Контракт: `DELETE /api/event-types/{id}` (204, 404, 409 при наличии записей), входная модель `EventTypeInput`, правило непустого названия.
- Бэкенд: OpenAPI Generator 7.27.0 в Maven; `EventTypeController` реализует `EventTypesApi`; ошибки — сгенерированный `ErrorResponse`; ручные DTO типов встреч удалены.
- Фронтенд: кнопка «Удалить» с подтверждением в кабинете.
- Инструменты: `mise run generate`, очистка каталога SDK, проверка сгенерированных файлов в CI, `.gitattributes`, AGENTS.md.

## Проверки

`mise run check` (локально и с `CI=1`): бэкенд 54, фронтенд 34 теста; GitHub Actions `project-check` и `hexlet-check` зелёные.
