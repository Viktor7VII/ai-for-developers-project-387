# Срез 6: release-please

Status: resolved
Parent: [Реализация: вертикальные тикеты и первая сквозная функция](../issues/15-vertical-slices.md)
Commits:
- `353014b` ci: add release-please for repository releases
- `5b1610b` chore: track repository version in version.txt
- `718e899` ci: allow manual release-please runs

> Тикет оформлен задним числом (2026-11-23): работа выполнена и слита в `master` до его создания; коммиты не содержат строки `Refs`.

## Задача

Релизы через release-please по схеме тикета «Качество и релизы»: один корневой релиз `simple`, `version.txt`, `CHANGELOG.md`, теги `vX.Y.Z`, `GITHUB_TOKEN`.

## Сделано

- Workflow `release-please.yml` (action v5, push в `master` и ручной запуск), `release-please-config.json` с явным `version-file: version.txt`, манифест, `version.txt` (0.0.0 до релиза).
- Первый release PR (#1) не обновился после добавления `version.txt` (release-please не перезаписывает PR без изменения release notes); ветка PR удалена, новый PR #2 создан с `version.txt` 0.0.0 → 0.1.0.
- PR #2 слит владельцем: коммит `48e5d6b`, тег `v0.1.0`, GitHub Release v0.1.0 опубликован.

## Проверки

`project-check`, `hexlet-check` и `release-please` зелёные на `718e899` и на `48e5d6b`.
