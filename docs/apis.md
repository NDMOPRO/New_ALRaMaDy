# API Architecture

## 1. Unified Gateway APIs

Primary file: `rasid-platform-core/apps/contracts-cli/src/dashboard-web.ts`

### Main route families

| Route family | Purpose |
| --- | --- |
| `/api/v1/governance/auth/login` | login for unified gateway surfaces |
| `/api/v1/ai/jobs*` | AI submission, status, result, evidence, audit, lineage |
| `/api/v1/governance/*` | roles, assignments, policies, approvals, evidence, library, audit, lineage, KPIs |
| `/api/v1/data/*` | register/list datasets and canvas state |
| `/api/v1/dashboards/*` | state, templates, library, create, mutate, refresh, compare, publish, share, schedule, export |
| `/api/v1/transcription/jobs*` | start/list transcription jobs |
| `/api/v1/reports/create-from-transcription` | transcription-to-report bridge |
| `/api/v1/reports/convert-to-dashboard` | report-to-dashboard bridge |
| `/api/v1/reports/convert-to-presentation` | report-to-presentation bridge |
| `/api/v1/presentations/create-from-canvas` | canvas-to-presentation creation |
| `/api/v1/presentations/convert-to-dashboard` | presentation-to-dashboard bridge |
| `/api/v1/replication/consume-dashboard-output` | strict replication continuation |
| `/api/v1/localization/consume-dashboard-output` | localization continuation |
| `/api/v1/localization/localize-dashboard` | dashboard localization action |
| `/api/v1/graphql` | lightweight GraphQL surface for dashboard state and creation |

## 2. Standalone Report Platform API

Primary file: `rasid-platform-core/packages/report-engine/src/platform.ts`

### Served routes

- `/login`
- `/reports`
- `/reports/:id`
- `/published/reports/:publicationId`
- `/files/reports/:id/{html|pdf|docx}`

### API routes

- `/api/v1/reports/reports`
- `/api/v1/reports/reports/create`
- `/api/v1/reports/reports/create-from-transcription`
- `/api/v1/reports/reports/create-from-excel`
- `/api/v1/reports/reports/import`
- `/api/v1/reports/reports/:id`
- `/api/v1/reports/reports/:id/update`
- `/api/v1/reports/reports/:id/refresh`
- `/api/v1/reports/reports/:id/compare`
- `/api/v1/reports/reports/:id/review`
- `/api/v1/reports/reports/:id/approve`
- `/api/v1/reports/reports/:id/publish`
- `/api/v1/reports/reports/:id/publish-degraded`
- `/api/v1/reports/reports/:id/schedules`
- `/api/v1/reports/schedules/:id/{run|update|cancel|resume}`
- `/api/v1/reports/reports/:id/export/{html|pdf|docx}`
- `/api/v1/reports/reports/:id/convert/{presentation|dashboard}`

## 3. Standalone Presentations Platform API

Primary file: `rasid-platform-core/packages/presentations-engine/src/platform.ts`

### Served routes

- `/login`
- `/presentations`
- `/presentations/:id`
- `/presentations/:id/presenter`
- `/presentations/:id/remote`
- `/published/:deckId`
- helper entry surfaces on `/data` and `/reports` for prefill continuation

### API routes

- `/api/v1/presentations/capabilities`
- `/api/v1/presentations/decks`
- `/api/v1/presentations/decks/create`
- `/api/v1/presentations/decks/:id`
- `/api/v1/presentations/decks/:id/events`
- `/api/v1/presentations/decks/:id/mutate`
- `/api/v1/presentations/decks/:id/bind`
- `/api/v1/presentations/decks/:id/theme`
- `/api/v1/presentations/decks/:id/save-template`
- `/api/v1/presentations/decks/:id/translate`
- `/api/v1/presentations/decks/:id/speaker-notes`
- `/api/v1/presentations/decks/:id/ai-image`
- `/api/v1/presentations/decks/:id/voiceover`
- `/api/v1/presentations/decks/:id/parity`
- `/api/v1/presentations/decks/:id/publish`
- `/api/v1/presentations/decks/:id/comments`
- `/api/v1/presentations/decks/:id/export/*`
- `/api/v1/presentations/decks/:id/analytics`
- `/api/v1/presentations/templates`
- `/api/v1/presentations/template-library`
- `/api/v1/presentations/template-library/import`
- `/api/v1/presentations/template-library/:templateId`
- `/api/v1/presentations/public/:deckId/{unlock|track|quiz|poll}`
- `/api/v1/media/search`

## 4. Transcription Web API

Primary file: `rasid-platform-core/apps/contracts-cli/src/transcription-web.ts`

### API routes

- `/api/v1/governance/auth/login`
- `/api/v1/ai/jobs*`
- `/api/v1/transcription/jobs`
- `/api/v1/transcription/jobs/:id`
- `/api/v1/transcription/jobs/start`
- `/api/v1/transcription/compare`
- `/api/v1/transcription/question`

## 5. `apps/rasid-web` tRPC API

Primary file: `rasid-platform-core/apps/rasid-web/server/routers.ts`

### Namespace inventory

- `auth`
- `ai`
- `files`
- `reports`
- `presentations`
- `dashboards`
- `spreadsheets`
- `chat`
- `library`
- `translations`
- `extractions`
- `admin`

The app exposes these through `/api/trpc` from `server/_core/index.ts`.

## API Design Characteristics

- The unified gateway APIs are route-driven and hand-authored, not framework-generated.
- The standalone product servers repeat some auth and page-wrapper logic instead of being composed behind a single shared API gateway.
- `apps/rasid-web` uses tRPC and therefore has a very different API shape from the monorepo HTTP servers.
- Cross-engine APIs return `open_path` values often enough that navigation continuity is part of the API contract, not just the UI layer.

