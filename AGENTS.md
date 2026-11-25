# AGENTS.md

## Project overview

This repository contains a meeting scheduling application inspired by Cal.com.

It continues the first project [`Viktor7VII/ai-for-developers-project-386`](https://github.com/Viktor7VII/ai-for-developers-project-386): the application, infrastructure, specification and decisions were migrated from it. The original specification and decision tickets stay in that repository's GitHub Issues (see "Issue tracker" below).

The first version is implemented end to end:

- Owner area (`/admin`, single owner without authentication, ADR-0001): event types (create, edit, delete only without bookings), weekly schedule with an IANA time zone, list of bookings.
- Guest flow without registration: home page with event types, booking page `/book/{slug}` with free slots inside the 14-day booking window, booking by name and email.
- Booking rules: availability is re-checked on creation; any booking occupies the time for all event types; double booking is guarded in the application (ADR-0002) and answered with `409`.
- Persistence: embedded H2 in a file (`CALENDAR_DB_URL`, default `backend/data/calendar`).
- Delivery: one Docker image (backend serves the API and the built frontend), deployed on Render; public URL is in `README.md`.

Out of scope for now: guest accounts, owner login, calendar integrations, notifications, payments. Domain terms follow `GLOSSARY.md`.

## Technology stack

- Backend: Java 21, Spring Boot 4, Maven.
- Frontend: TypeScript, React, Vite.
- UI: Mantine.
- API contract: TypeSpec.
- API specification: OpenAPI.
- Frontend API client: generated TypeScript Fetch SDK.
- Backend tests: JUnit 5.
- Frontend tests: Vitest, Testing Library.
- Frontend linting: Oxlint.
- Tool version management: mise.
- Git hooks: hk.
- CI: GitHub Actions.

## Repository structure

- `backend/` — Spring Boot application, Maven build and backend tests.
- `frontend/` — React application, Vite configuration, frontend tests and generated API client.
- `contracts/` — TypeSpec API contract, generated OpenAPI specification and SDK generation configuration.
- `frontend/src/shared/api/generated/` — generated TypeScript API client.
- `scripts/check.mjs` — unified project check script.
- `.github/workflows/project-check.yml` — project CI workflow.
- `.github/workflows/hexlet-check.yml` — Hexlet-managed workflow; do not modify.
- `.github/workflows/opencode.yml`, `.github/workflows/opencode-review.yml`, `.github/actions/agent-run-limit*/`, `.github/scripts/` — OpenCode agent on `/oc` comments, read-only PR auto-review (OpenCode CLI 2.x) and the per-PR agent run limit (see README; the limit's guarantees and accepted race risk: ADR-0004).
- `REVIEW.md` — pull request review criteria; `.github/pull_request_template.md` — PR description template.
- `mise.toml` — tool versions and project tasks.
- `mise.lock` — locked tool versions.
- `hk.pkl` and `.hk/pkl/` — hk configuration and local Pkl dependencies.
- `.claude/skills/` and `skills-lock.json` — agent skills installed from `mattpocock/skills`; restore them with `npx skills experimental_install`.
- `docs/agents/` — skills configuration: issue tracker (GitHub Issues), triage labels, domain docs layout.
- `.scratch/` — local copy of the specification and decision tickets, implementation slice tickets.

## Development setup

Install the pinned project tools:

```bash
mise install
```

Install project dependencies:

```bash
cd backend
./mvnw dependency:resolve
cd ../contracts
npm install
cd ../frontend
npm install
```

On Windows PowerShell, use `.\mvnw.cmd` instead of `./mvnw` and `npm.cmd` instead of `npm`.

## Running the application

Backend:

```bash
cd backend
./mvnw spring-boot:run
```

Frontend:

```bash
cd frontend
npm run dev
```

The backend exposes the Spring Boot Actuator health endpoint:

`GET /actuator/health`

## Tests and quality checks

Run all project checks from the repository root:

```bash
mise run check
```

This command performs:

1. TypeSpec compilation.
2. TypeScript SDK generation.
3. Agent run limit action tests (`scripts/agent-run-limit.test.sh`, bash with a fake GitHub API; on Windows the bash of Git for Windows).
4. PR auto-review tests: output extraction (`.github/scripts/review-output.test.mjs`), prompt preparation (`.github/scripts/prepare-review.test.sh`), the review run with a fake OpenCode (`.github/scripts/run-review.test.sh`) and the workflow structure the run limit relies on (`.github/scripts/review-workflow.test.mjs`).
5. Backend tests.
6. Frontend tests.
7. Frontend Oxlint.
8. Frontend production build.

Run backend tests separately:

```bash
cd backend
./mvnw test
```

Run frontend tests:

```bash
cd frontend
npm test
```

Run the browser scenario (Playwright, `e2e/`). It starts the backend on port 18080 with an in-memory database and the Vite dev server on port 15173 itself; install Chromium once with `npx playwright install chromium` in `e2e/`:

```bash
mise run e2e
```

Run frontend lint:

```bash
cd frontend
npm run lint
```

## API contract and generated code

- Treat `contracts/main.tsp` as the source of truth for the API contract.
- OpenAPI output is generated from the TypeSpec contract.
- The TypeScript SDK is generated from the OpenAPI specification.
- Never edit files in `frontend/src/shared/api/generated/` manually.
- The backend API interfaces and DTOs are generated from the same OpenAPI by the Maven plugin into `backend/target/generated-sources/openapi` (packages `com.hexlet.backend.api` and `com.hexlet.backend.api.model`, not committed). Controllers implement the generated interfaces; business logic stays in hand-written code (ADR-0003).
- When changing the API contract, regenerate OpenAPI, the SDK and the server interfaces, then commit the regenerated `contracts/openapi/` and SDK together with the contract change:

```bash
mise run generate
```

- In CI, `mise run check` fails if the committed generated files differ from a fresh generation (modified, deleted or new files).

- Keep the backend API behavior consistent with the contract.

## Git conventions

Use Conventional Commits.

Every implementation commit references its ticket with a `Refs` line in the commit body: the GitHub issue of this repository by its full URL and, for implementation slices kept only locally, the ticket file path:

```text
feat: add owner notes to bookings

Refs: https://github.com/Viktor7VII/ai-for-developers-project-387/issues/<number>
Refs: .scratch/core-spec/slices/07-owner-notes.md
```

- Do not write `#<number>` in commit messages (especially `feat` / `fix`); use the full URL `https://github.com/Viktor7VII/ai-for-developers-project-387/issues/<number>`.
- Do not put closing keywords (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`) next to issue references.
- Why: release-please builds the changelog with conventional-changelog (`conventionalcommits` preset), which detects `#<number>` anywhere in the message regardless of the `Refs:` prefix and renders it as `closes #<number>` in the release PR; merging that PR would close the issue.

Allowed commit types:

- `build`
- `chore`
- `ci`
- `docs`
- `feat`
- `fix`
- `perf`
- `refactor`
- `revert`
- `style`
- `test`

Examples:

```text
feat: add meeting types endpoint
fix: handle unavailable time slots
test: add health endpoint test
docs: update project setup instructions
```

The hk `commit-msg` hook validates commit messages.

Releases are managed by release-please (`.github/workflows/release-please.yml`, `release-please-config.json`): commit types drive the version and `CHANGELOG.md`; the release happens when the release PR is merged. Do not edit `version.txt`, `CHANGELOG.md` or `.release-please-manifest.json` manually.

After cloning the repository, install the hook with:

```bash
mise exec -- hk install
```

## Agent skills

### Issue tracker

GitHub Issues of `Viktor7VII/ai-for-developers-project-387` is the primary tracker for new work. The original core specification lives in the first project `Viktor7VII/ai-for-developers-project-386`: decision map https://github.com/Viktor7VII/ai-for-developers-project-386/issues/3, specification https://github.com/Viktor7VII/ai-for-developers-project-386/issues/19, decision tickets https://github.com/Viktor7VII/ai-for-developers-project-386/issues/4 – https://github.com/Viktor7VII/ai-for-developers-project-386/issues/18 (sub-issues of the map with native blocked-by dependencies, answers as `## Answer` comments); reference them by full URL. `.scratch/core-spec/` is the local copy and working material; implementation slice tickets live only in `.scratch/core-spec/slices/`. Never close issues automatically. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), applied as GitHub labels (local slice files record them as a `Status:` line). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and ADRs in `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## MCP

- `.mcp.json` connects the Render MCP server (`https://mcp.render.com/mcp`) used to create and inspect the Render deployment (service `call-calendar`, see README).
- Authorization is a Render API key read from the `RENDER_API_KEY` environment variable (`Authorization: Bearer ${RENDER_API_KEY}`); the variable is set in the user's system, and Claude Code must be restarted after setting it.
- Secrets are never stored in the repository: no API keys, tokens or passwords in `.mcp.json`, code, docs or commit messages. Reference them only through environment variables.

## Working rules

- Read existing code and configuration before changing them.
- Prefer small, focused changes.
- Do not introduce new dependencies without a clear reason.
- Do not modify generated SDK files manually.
- Do not modify `.github/workflows/hexlet-check.yml`.
- Keep tool versions managed by mise.
- Run `mise run check` after making changes.
- Do not claim that a feature is implemented unless it exists in the code.
- Do not commit or push changes unless explicitly requested.
