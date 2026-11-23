# Design First: цепочка генерации и её команды

Type: grilling
Status: resolved
Blocked by: 08, 10

## Question

Какие артефакты генерируются из TypeSpec (OpenAPI, TS SDK, серверные интерфейсы или DTO), хранятся ли сгенерированные файлы в git, какими командами запускается генерация и как проверка ловит расхождение контракта с кодом?

## Текущее состояние

`mise run check` компилирует TypeSpec и генерирует SDK; сгенерированные OpenAPI и SDK лежат в git; серверных артефактов нет.

## Answer

Решено 2026-11-23. Выбор пользователя: серверные интерфейсы и DTO генерируются через OpenAPI Generator 7.27 для Spring Boot 4, бизнес-логика — ручной код, SDK фронтенда — из того же OpenAPI (ADR-0003). Остальное — технические решения без отдельных вопросов.

### Цепочка

`contracts/main.tsp` → (`tsp compile`) → `contracts/openapi/openapi.yaml` → 
- сервер: `openapi-generator-maven-plugin` 7.27.0, генератор `spring`;
- клиент: `@openapitools/openapi-generator-cli`, генератор `typescript-fetch`, JAR-версия 7.27.0 закреплена в `contracts/openapitools.json`.

### Серверные артефакты

- Плагин в `backend/pom.xml`, цель `generate` в фазе `generate-sources`; вход `../contracts/openapi/openapi.yaml`; выход `target/generated-sources/openapi` (не в git, создаётся при каждой сборке Maven, отдельная команда не нужна).
- Опции: `interfaceOnly=true`, `useSpringBoot4=true`, `useJackson3=true`, `useBeanValidation=true`, `useTags=true` (интерфейс на тег: `EventTypesApi`, `ScheduleApi`, `BookingsApi`, `PublicBookingApi`), `skipDefaultInterface=true`, `openApiNullable=false` (без jackson-databind-nullable), `documentationProvider=none` (без springdoc).
- Пакеты: `com.hexlet.backend.api` (интерфейсы), `com.hexlet.backend.api.model` (DTO).
- Контроллеры реализуют интерфейсы; ручные DTO запросов и ответов удаляются; преобразование DTO ↔ доменные сущности — в ручном коде. Ответ об ошибке — сгенерированная модель `ErrorResponse`.
- Ограничения полей из контракта (длины, шаблоны, диапазоны) проверяются сгенерированными аннотациями Bean Validation; правила, которых нет в контракте (IANA-пояс, пересечение интервалов, окно, слоты, конфликты), — в ручном коде.
- Операция health в контракте описывает Actuator; её сгенерированный интерфейс не реализуется.

### Клиентские артефакты

- Выход `frontend/src/shared/api/generated/` остаётся в git (нужен фронтенду и IDE без запуска генерации); вручную не редактируется.

### Команды

- `mise run generate` (новая задача): `tsp compile` → генерация TS SDK → `./mvnw generate-sources` в `backend`.
- `mise run check`: первым шагом выполняет то же, что `generate`, затем проверку расхождения, тесты, линтер, сборку (полный состав решает тикет «Качество и релизы»).
- Проверка расхождения в `check` (локально и в CI): уточнена в тикете [Качество и релизы](14-quality-and-releases.md) — очистка каталога SDK перед генерацией и `git status --porcelain` по сгенерированным путям, чтобы ловить и новые, и удалённые файлы.
- Чтобы Windows не давал ложных расхождений из-за CRLF, в `.gitattributes` для `contracts/openapi/**` и `frontend/src/shared/api/generated/**` задаётся `text eol=lf`.

### Правила обновления

1. Любое изменение API начинается с `contracts/main.tsp`.
2. Затем `mise run generate`; изменённые `openapi.yaml` и SDK коммитятся вместе с изменением контракта и кодом, который его реализует, — в одном коммите или одной ветке.
3. Сгенерированные файлы не редактируются вручную (AGENTS.md); серверные сгенерированные классы в git не попадают.
4. Версия генератора меняется только осознанно, одновременно в плагине Maven и в `openapitools.json`.
5. Сигнатуры сверяет компилятор; коды ответов и правила — тесты (тикет «Проверка приложения»).

Расхождения с текущей реализацией: серверный код написан вручную (свои DTO, контроллеры без интерфейсов); нет плагина генератора в Maven, задачи `mise run generate`, проверки расхождения и `.gitattributes` для сгенерированных файлов. Генерация OpenAPI и SDK, их хранение в git и версия генератора SDK (7.27.0 в `openapitools.json`) совпадают.

Открытые вопросы: нет. Словарь не менялся. Добавлен ADR-0003.
