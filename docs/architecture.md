# Architecture

This repository contains three architectural strata that coexist in one workspace:

1. `rasid-platform-core`, the active contract-first monorepo that currently drives the deployed unified gateway and the standalone report, presentation, and transcription HTTP servers.
2. `apps/rasid-web`, an imported full-stack React + Express + tRPC application that preserves a richer product shell but still relies on local `sql.js` data access and optional Drizzle/MySQL metadata.
3. `rasid_core_seed`, a historical extracted reference corpus used as implementation inspiration rather than a runnable production runtime.

## Primary Architectural Style

The active platform is a contract-first modular monolith.

- Shared schemas, action registries, and tool registries live in `packages/contracts`.
- Runtime bootstrap and hook execution live in `packages/runtime` and `packages/capability-registry`.
- Capability packages implement domain logic as TypeScript classes with file-backed store classes under `.runtime/`.
- Thin HTTP shells in `apps/contracts-cli/src/dashboard-web.ts`, `apps/contracts-cli/src/transcription-web.ts`, `packages/report-engine/src/platform.ts`, and `packages/presentations-engine/src/platform.ts` orchestrate the engines in-process.

This produces a layered system, but not a microservice fleet. Most "services" are code-level engines sharing one process and one repository.

## Layer Model

| Layer | Main code areas | Responsibility |
| --- | --- | --- |
| Presentation layer | `apps/contracts-cli/src/dashboard-web.ts`, `apps/contracts-cli/src/transcription-web.ts`, `packages/*/src/platform.ts`, `apps/rasid-web/client` | Browser routes, page rendering, API entrypoints, route-level auth, user interaction |
| Application services | `apps/contracts-cli/src/index.ts`, `apps/rasid-web/server/_core/index.ts`, `apps/rasid-web/server/routers.ts` | Runtime bootstrap, request dispatch, orchestration, API shaping |
| Domain logic | `packages/dashboard-engine`, `report-engine`, `presentations-engine`, `transcription-extraction-engine`, `ai-engine`, `governance-engine`, `arabic-localization-lct-engine`, `strict-replication-engine`, `excel-engine` | Capability workflows, validation, transformation, publication, review, continuation |
| Shared kernel | `packages/contracts`, `runtime`, `capability-registry`, `common`, `artifacts`, `audit-lineage`, `evidence`, `jobs`, `library`, `permissions`, `output-publication`, `connectors`, `canvas-contract`, `brand-template` | Common types, envelopes, approval/evidence hooks, action/tool manifests, shared model vocabulary |
| Persistence and transport | `.runtime/*`, `apps/rasid-web/server/localDb.ts`, `apps/rasid-web/drizzle`, `uploads/` | Durable execution state, local content store, optional relational metadata, uploaded files |
| External integrations | OpenAI API, Forge APIs, optional MySQL, Railway/Nixpacks | LLM, vision, speech transcription, file/data APIs, deployment runtime |

## Active Runtime Shapes

### Unified gateway

`npm start` launches `apps/contracts-cli/dist/index.js dashboard-serve-web`, which serves the unified canvas routes:

- `/home`
- `/data`
- `/transcription`
- `/excel`
- `/reports`
- `/presentations`
- `/replication`
- `/localization`
- `/dashboards`
- `/library`
- `/governance`

This gateway is the current integration point for AI orchestration, governance, dashboard mutation, cross-engine conversion, localization, and replication.

### Standalone product servers

The repo also exposes narrower product-style servers:

- report platform: `packages/report-engine/src/platform.ts`
- presentations platform: `packages/presentations-engine/src/platform.ts`
- transcription platform: `apps/contracts-cli/src/transcription-web.ts`

These duplicate some capability-specific behavior already present in the unified gateway, but they remain useful as focused surfaces and regression targets.

### Alternative full-stack app

`apps/rasid-web` is a separate application architecture:

- React/Vite SPA on the client
- Express + tRPC server
- local JWT auth via cookies
- local `sql.js` content persistence
- optional Drizzle/MySQL template-library metadata
- AI helper endpoints implemented directly in the app server

It is architecturally important because it preserves a UI the audit trail marks as the preferred design authority, even though it is not the current deployment entrypoint.

## Dependency Rules Visible in Code

- Contracts are imported downstream by engines and bootstrap code; engines do not define independent private schemas for shared artifacts.
- Store classes are part of the domain runtime, not a separate infrastructure service. They create the durable runtime graph used by later steps.
- Queueing and scheduling are implemented as file-backed orchestration records, not Redis/SQS/Kafka style external brokers.
- Governance is partially centralized in `packages/governance-engine`, but some surfaces still expose direct engine operations and only layer governance at the route/orchestration level.
- `apps/rasid-web` currently duplicates business logic that the shared engines already implement elsewhere; the durable wiring guide in `docs/RASID_LITERAL_SERVICE_WIRING_GUIDE.md` records that this app should move toward adapters instead of owning the logic itself.

## Major Architectural Tensions

### 1. Dual runtime model

The monorepo runtime uses `.runtime/` JSON/file persistence. `apps/rasid-web` uses local relational-style CRUD and optional MySQL metadata. This creates two truth models for similar concepts such as files, reports, dashboards, and presentations.

### 2. Dual web surfaces

The repository contains both:

- a deployed unified gateway
- a richer imported SPA with its own backend

That is useful for migration, but it increases maintenance cost and documentation complexity.

### 3. Contract-first core vs app-local implementation

The shared engine packages are relatively disciplined around schemas, artifacts, evidence, and lineage. The imported app is much more product-local and imperative, especially in `server/aiRouter.ts` and `server/localDb.ts`.

## Diagram Map

- high-level architecture: `docs/diagrams/system-architecture.mmd`
- service interactions: `docs/diagrams/service-map.mmd`
- data pipelines: `docs/diagrams/dataflows.mmd`
- ERD: `docs/diagrams/database-erd.mmd`
- supporting C4 views:
  - `docs/c4-context.md`
  - `docs/c4-containers.md`
  - `docs/c4-components.md`
  - `docs/c4-code.md`

## Recommended Reading Order

1. `docs/system-overview.md`
2. `docs/architecture.md`
3. `docs/modules.md`
4. `docs/apis.md`
5. `docs/dataflows.md`
6. `docs/database.md`
7. `docs/infrastructure.md`
8. `docs/deployment.md`
9. `docs/security.md`
10. `docs/performance.md`
11. `docs/testing.md`
