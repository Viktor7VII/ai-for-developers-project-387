# Исследование: release-please для репозитория Java + Node

Type: research
Status: resolved
Blocked by: —

## Question

Как настроить release-please для этого репозитория (Maven-бэкенд, npm-фронтенд и контракты, Conventional Commits, GitHub Actions): один релиз на репозиторий или по пакетам, какие типы релизов подходят, какие права и токены нужны в Actions, как это сочетается с `hexlet-check.yml`, который менять нельзя.

## Текущее состояние

Conventional Commits проверяются хуком hk; release-please не настроен.

## Answer

Проверено 2026-11-23 по первоисточникам.

**Версии.** release-please-action: последняя `v5.0.0` (2026-04-22, единственное breaking change — runtime Node 24, внутри release-please 17.6.0); предыдущая линия `v4.4.1`. README всё ещё показывает `@v4`. [releases](https://github.com/googleapis/release-please-action/releases)

**Конфигурация.** Manifest-режим: `release-please-config.json` + `.release-please-manifest.json` (может быть `{}`, но файл обязан существовать; для старта можно задать версии вручную). `packages` — ключи-каталоги; `"."` — корень, релиз при любом изменении; `exclude-paths` исключает каталоги из корневого пакета. По умолчанию один общий release PR; `separate-pull-requests: true` — PR на пакет. Тег по умолчанию `<component>-v<version>`, `include-component-in-tag: false` → `v<version>`. Плагины `node-workspace`, `maven-workspace`, `linked-versions` (одна версия для группы). [manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)

**Типы релизов.** `simple` — `version.txt` + `CHANGELOG.md`; `node` — `package.json`; `maven` — рекурсивно обновляет все `pom.xml` (`/project/version`, при отсутствии — `/project/parent/version`) и после релиза открывает отдельный snapshot-PR (метка `autorelease: snapshot`, без тега); `java` — то же snapshot-поведение, но сам файлы не трогает, только `extra-files`. `extra-files`: `generic` (аннотации `x-release-please-version`, блоки `x-release-please-start-version`/`-end`), `json` с `jsonpath`, `xml` с `xpath`, `yaml`/`toml`. Опции `skip-snapshot` (не предлагать snapshot-PR), `bump-minor-pre-major`, `bump-patch-for-minor-pre-major`, `initial-version`. [customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md), [java.md](https://github.com/googleapis/release-please/blob/main/docs/java.md), [config schema](https://github.com/googleapis/release-please/blob/main/schemas/config.json)

**Maven/SNAPSHOT.** В `backend/pom.xml` строка 8 — версия `spring-boot-starter-parent` (4.1.2), строка 13 — версия проекта `0.0.1-SNAPSHOT`; `pom`-апдейтер меняет `/project/version`, родителя трогает только если своей версии нет. Варианты без конфликтов: `maven` (релиз-версия, затем snapshot-PR на следующую `-SNAPSHOT`), `maven` + `skip-snapshot: true` (pom остаётся на релизной версии), или `simple`/`node` + `extra-files` `{type: xml, path: backend/pom.xml, xpath: //project/version}` (тогда SNAPSHOT-суффикс исчезает навсегда).

**Action и права.** Триггер — `on: push: branches: [master]`; `permissions: contents: write, issues: write, pull-requests: write` (README перечисляет и `issues`). Inputs: `token` (по умолчанию `GITHUB_TOKEN`), `release-type`, `config-file`, `manifest-file`, `target-branch`, `skip-github-release`, `skip-github-pull-request`; outputs `release_created`, `tag_name`, для пакетов — `<path>--release_created`. Может понадобиться включить Settings → Actions → General → «Allow GitHub Actions to create and approve pull requests». [README](https://github.com/googleapis/release-please-action/blob/main/README.md)

**GITHUB_TOKEN.** События от `GITHUB_TOKEN` не запускают новые workflow (кроме `workflow_dispatch`/`repository_dispatch`); PR-события от автоматизации ждут одобрения человека с write-доступом. Альтернатива — PAT или токен установки GitHub App в секрете. [GitHub Docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) Отсюда для этого репо: при `GITHUB_TOKEN` ни push в ветку release PR, ни тег релиза не запустят `hexlet-check.yml` (`push` на `'**'` ветки и теги) и `project-check.yml`; с PAT/App — запустят оба (hexlet-check — на ветку PR и на тег). Мерж release PR человеком — обычный push в `master`, он запускает всё как обычно.

**Прямые пуши в master.** release-please работает на каждый push в `master` и открывает/обновляет release PR; релиз и тег создаются только когда этот PR смержен (ориентир — метка `autorelease: pending`). То есть появляется хотя бы один PR-шаг в процессе, который сейчас обходится без PR.

**Сравнение вариантов.**
1. Один корневой пакет `"."` (`simple` или `node`) + `extra-files` для `pom.xml` и двух `package.json` — одна версия, один тег `vX.Y.Z`, SNAPSHOT уходит.
2. Корень + `linked-versions` по трём пакетам (`maven`, `node`, `node`) — одна версия, родные апдейтеры, теги по компонентам, snapshot-PR от `maven` (если не `skip-snapshot`).
3. Пакеты с независимыми версиями (`backend` maven, `frontend` node, `contracts` node) — несколько тегов/CHANGELOG; при `separate-pull-requests` несколько PR.

Что важнее всего для решения: нужны ли независимые версии пакетов (ничего не публикуется); оставлять ли `-SNAPSHOT` в pom; нужен ли запуск CI/hexlet-check на release PR и тегах (определяет `GITHUB_TOKEN` или PAT/App); готовность к PR-шагу при текущем процессе прямых пушей; `v4` или `v5` action.
