# Исследование: серверные артефакты из OpenAPI для Spring Boot 4

Type: research
Status: resolved
Blocked by: —

## Question

Какие есть способы получать серверные артефакты Spring Boot 4 (интерфейсы контроллеров, DTO) из OpenAPI, сгенерированного TypeSpec (openapi-generator `spring` с `interfaceOnly`, эмиттеры TypeSpec для Java и др.)? Совместимость со Spring Boot 4 и Jackson 3, интеграция с Maven, где хранить сгенерированный код, как ловить рассинхрон контракта и кода.

## Текущее состояние

Из TypeSpec генерируются OpenAPI и TS SDK (`contracts/`); серверный код написан вручную.

## Answer

Данные на 2026-11-23. Последний релиз openapi-generator: 7.27.0 от 02.11.2026 ([releases](https://github.com/OpenAPITools/openapi-generator/releases)).

**A. openapi-generator `spring` с `interfaceOnly`**
- Опции ([docs](https://openapi-generator.tech/docs/generators/spring/)): `interfaceOnly` (по умолчанию false), `useSpringBoot4` (false, включает `useJakartaEe`), `useJackson3` (false, разрешена только вместе с `useSpringBoot4`), `useBeanValidation` (true), `openApiNullable` (true), `skipDefaultInterface`, `useTags`, `documentationProvider` (по умолчанию `springdoc`, есть `none`).
- Поддержка Boot 4 и Jackson 3 появилась в 7.20.0 (16.02.2026, [#22854](https://github.com/OpenAPITools/openapi-generator/pull/22854)). Шаблоны используют `tools.jackson` только для databind-аннотаций, остальные аннотации остаются в `com.fasterxml.jackson.annotation`, как в самом Jackson 3. Сочетание `openApiNullable` с `useJackson3` поддерживается с 7.22.0 ([#23331](https://github.com/OpenAPITools/openapi-generator/pull/23331)). Позже закрыта проблема с устаревшей версией jackson-databind-nullable в шаблонах sb4 (#24975). Исправление JSpecify для Boot 4 вышло в 7.23.0 (#23649). В 7.27.0 появилась опция `useRecords`. Поддержка Boot 4 молодая и меняется почти в каждом релизе.
- Maven: `openapi-generator-maven-plugin`, цель `generate` в фазе `generate-sources`. По умолчанию пишет в `target/generated-sources/openapi`, `addCompileSourceRoot=true`, есть `skipIfSpecIsUnchanged` ([README](https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator-maven-plugin/README.md)). Другой путь: уже используемый npm-wrapper CLI в `scripts/check.mjs` с коммитом кода по аналогии с TS SDK. Wrapper 2.42 — отдельный продукт, версия JAR генератора закрепляется в `openapitools.json`.
- Рассинхрон ловит компилятор: контроллер реализует сгенерированный интерфейс, поэтому изменение сигнатуры ломает сборку. Изменения семантики (статусы, nullable, ошибки) компилятор не замечает.
- Риски для репо: ручные DTO и контроллеры придётся заменить или адаптировать. Сгенерированные модели могут тянуть jackson-databind-nullable и springdoc-аннотации, если не выключить их опциями. Генерация зависит от того, как `@typespec/openapi3` выражает union, nullable и anonymous models.

**B. Нативный серверный эмиттер TypeSpec для Java**
- Его нет. В каталоге эмиттеров TypeSpec серверные — только `http-server-csharp` и `http-server-js`, оба alpha. Для Java есть только клиентский `http-client-java` (preview) ([typespec.io/docs](https://typespec.io/docs/)). Экспериментальный java-spring эмиттер в рамках emitter framework не выпущен ([#4895](https://github.com/microsoft/typespec/issues/4895)). Для этого репо вариант нежизнеспособен.

**C. Ручной код плюс проверка рассинхрона**
- springdoc-openapi 3.x совместим с Boot 4: 3.1.x–3.2.x для Boot 4.1.x, 3.2.0 собран на Boot 4.1.2 ([FAQ](https://springdoc.org/faq.html), [releases](https://github.com/springdoc/springdoc-openapi/releases)). Это новая runtime-зависимость.
- Получить runtime-спеку можно двумя способами. Первый — `springdoc-openapi-maven-plugin`: стартует приложение в фазе `integration-test` и пишет `target/openapi.json` ([plugins](https://springdoc.org/plugins.html)). Второй — `@SpringBootTest` с MockMvc, который читает `/v3/api-docs` на фазе `test` ([#739](https://github.com/springdoc/springdoc-openapi/issues/739)).
- Сравнить спеки можно через `oasdiff breaking|diff`: Go CLI или GitHub Action, OpenAPI 3.0/3.1, exit code 1 при breaking changes ([oasdiff](https://github.com/oasdiff/oasdiff)). Это ещё один инструмент вне npm и Maven, и mise должен уметь его поставить. Спека springdoc структурно отличается от вывода TypeSpec: имена схем, nullable, required, версия OAS. Поэтому возможен шум, и нужна настройка аннотациями или фильтрами.
- Альтернатива без springdoc: контрактные тесты MockMvc, которые валидируют запросы и ответы по `openapi.yaml`, например через Atlassian swagger-request-validator. Совместимость с Boot 4 я не проверил. Такие тесты ловят только покрытые эндпоинты.

| | A. spring-генератор | B. TypeSpec Java server | C. ручной код + drift check |
|---|---|---|---|
| Зрелость | зрелый, Boot 4 с 7.20 (02.2026) | нет | springdoc 3.x и oasdiff стабильны |
| Boot 4 / Jackson 3 | `useSpringBoot4` + `useJackson3` | — | springdoc 3.1+/3.2 |
| Maven | plugin, `generate-sources` | — | springdoc plugin (`integration-test`) или тест |
| Где код | `target/` или коммит | — | ручной код без изменений |
| Ловит дрейф | компиляция (сигнатуры) | — | diff спек или тесты (семантика тоже, но шумно) |
| Усилия/риск | средние: переписать DTO | — | средние: новые зависимости, настройка шума |

**Что важнее всего для решения:** поддержка Boot 4 в генераторе новая (с 7.20) и активно чинится, поэтому версию надо закреплять. Нативного Java-серверного эмиттера TypeSpec нет. Компиляция по интерфейсам ловит только сигнатуры, а сравнение спек ловит больше, но даёт шум из-за структурных различий springdoc и TypeSpec. Каждый вариант добавляет зависимости: плагин генератора, springdoc, oasdiff.
