# C4 Level 2: Container Architecture

Diagram source: `docs/diagrams/container-architecture.mmd`

## Active Containers

### Unified gateway: `apps/contracts-cli/src/dashboard-web.ts`

This is the current primary container.

- serves page routes such as `/home`, `/data`, `/transcription`, `/dashboards`, `/reports`, `/presentations`, `/library`, and `/governance`
- exposes a large `/api/v1/...` surface for AI jobs, governance, data registration, dashboard actions, cross-engine conversion, replication, and localization
- authenticates through a simple login flow on `/api/v1/governance/auth/login`
- coordinates multiple engines in-process

### Transcription web server: `apps/contracts-cli/src/transcription-web.ts`

- dedicated UI/API for transcription flows
- exposes `/login`, `/transcription`, `/api/v1/transcription/jobs`, `/compare`, `/question`, and AI job helpers
- wraps `TranscriptionExtractionEngine` and AI orchestration for a narrower surface

### Report platform server: `packages/report-engine/src/platform.ts`

- standalone report product server
- serves `/login`, `/reports`, `/reports/:id`, published report routes, and a report-specific `/api/v1/reports/...` surface
- wraps `ReportEngine` and report publication service

### Presentations platform server: `packages/presentations-engine/src/platform.ts`

- standalone presentation product server
- serves `/login`, `/presentations`, presenter/remote/public routes, template library routes, deck mutation routes, analytics, comments, and export endpoints
- wraps `PresentationEngine`

### Optional full-stack app: `apps/rasid-web`

This is a separate application container pair rather than the active deploy path.

- client container: React/Vite single-page app
- server container: Express + tRPC + upload routes
- local auth, local sql.js persistence, optional Drizzle/MySQL library metadata

## Shared Engine Containers

These are code-level containers executed in-process by the HTTP surfaces.

| Package | Responsibility |
| --- | --- |
| `dashboard-engine` | Dashboard creation, mutation, refresh, compare, publish, template save, interaction handling |
| `report-engine` | Report ingest, structure/layout state, review/approval, scheduling, export, conversion |
| `presentations-engine` | Deck generation, themeing, media, collaboration, publish, parity, export |
| `transcription-extraction-engine` | OCR/transcription extraction, summaries, compare, question answering |
| `ai-engine` | Prompt routing, planning, provider selection, downstream engine execution, evidence capture |
| `governance-engine` | Role/permission/policy evaluation, approvals, audit, evidence, replay, versioning |
| `arabic-localization-lct-engine` | Arabic localization plans, typography/direction transformations, quality gates |
| `strict-replication-engine` | Deterministic visual/layout fidelity workflows |
| `excel-engine` | Workbook-native operations and optional backend object/publication service |

## Persistence Containers

### Filesystem runtime stores

Primary active persistence for the monorepo.

- location pattern: `rasid-platform-core/.runtime/<engine>/...`
- contents: JSON state, artifacts, evidence, audit events, lineage edges, generated exports, publication bundles
- used by dashboard, report, presentation, AI, transcription, governance, strict replication, localization, and Excel flows

### sql.js SQLite file: `apps/rasid-web/server/localDb.ts`

- location: `data/rasid.db`
- local operational store for users, files, reports, presentations, dashboards, spreadsheets, chat history, translations, extractions, and shared presentation links

### Optional MySQL schema: `apps/rasid-web/drizzle`

- accessed through `server/db.ts` when `DATABASE_URL` is available
- stores users plus slide template/library metadata used by AI presentation generation

### Upload filesystem

- location: `uploads/`
- used by `apps/rasid-web/server/uploadRoute.ts`
- stores images, documents, spreadsheets, audio, video, and other uploaded files

## Container Responsibilities

| Container | Technology | Role |
| --- | --- | --- |
| Unified gateway | Node HTTP server | Main shell and cross-engine API coordinator |
| Report platform | Node HTTP server | Focused report UI/API |
| Presentations platform | Node HTTP server | Focused presentation UI/API |
| Transcription server | Node HTTP server | Focused transcription UI/API |
| `rasid-web` client | React + Vite | Alternative unified workspace frontend |
| `rasid-web` server | Express + tRPC | App-specific backend and local product runtime |
| Engine packages | TypeScript classes | Domain logic and persistence orchestration |
| Filesystem stores | JSON/files | Main persistence for monorepo runtime state |
| sql.js DB | Embedded SQLite | Local app state for `rasid-web` |
| MySQL/Drizzle | Relational DB | Optional library/auth metadata for `rasid-web` |

## Container Architecture Diagram

See `docs/diagrams/container-architecture.mmd`.

