# C4 Level 4: Code Structure

Diagram source: `docs/diagrams/code-structure.mmd`

## Top-Level Module Layout

```text
rasid-platform-core/
  apps/
    contracts-cli/
      src/
        index.ts
        dashboard-web.ts
        transcription-web.ts
    rasid-web/
      client/
      server/
      drizzle/
  packages/
    contracts/
    capability-registry/
    runtime/
    dashboard-engine/
    report-engine/
    presentations-engine/
    transcription-extraction-engine/
    ai-engine/
    governance-engine/
    arabic-localization-lct-engine/
    strict-replication-engine/
    excel-engine/
```

## Key Classes and Entry Functions

| Module | Key code unit | Role |
| --- | --- | --- |
| `apps/contracts-cli/src/index.ts` | `runCommand`, `bootstrapRuntime` | CLI entrypoint and capability bootstrap |
| `apps/contracts-cli/src/dashboard-web.ts` | `startDashboardWebApp` | Main web gateway |
| `apps/contracts-cli/src/transcription-web.ts` | `startTranscriptionWebApp` | Dedicated transcription server |
| `packages/capability-registry/src/index.ts` | `RegistryBootstrap` | Registers capabilities, manifests, tools, hooks |
| `packages/dashboard-engine/src/index.ts` | `DashboardEngine` | Dashboard domain orchestration |
| `packages/dashboard-engine/src/store.ts` | `DashboardEngineStore` | Filesystem persistence for dashboard state |
| `packages/report-engine/src/index.ts` | `ReportEngine` | Report creation, import, review, schedule, convert |
| `packages/report-engine/src/store.ts` | `ReportEngineStore` | Report state, publication, orchestration, transport persistence |
| `packages/report-engine/src/platform.ts` | `startReportPlatformServer` | Standalone report HTTP surface |
| `packages/presentations-engine/src/index.ts` | `PresentationEngine` | Deck generation, mutation, publish, parity, export |
| `packages/presentations-engine/src/store.ts` | `PresentationEngineStore` | Deck bundle persistence |
| `packages/presentations-engine/src/platform.ts` | `startPresentationPlatformServer` | Standalone presentation HTTP surface |
| `packages/transcription-extraction-engine/src/index.ts` | `TranscriptionExtractionEngine` | Extraction, compare, Q&A, summaries |
| `packages/transcription-extraction-engine/src/store.ts` | `TranscriptionExtractionStore` | Bundle and compare persistence |
| `packages/ai-engine/src/index.ts` | `RasidAiEngine` | Planner/router/executor for AI jobs |
| `packages/ai-engine/src/store.ts` | `AiEngineStore` | AI session/job persistence |
| `packages/governance-engine/src/index.ts` | `GovernanceEngine`, `GovernanceEngineStore` | Policy/approval/evidence/audit runtime |
| `packages/excel-engine/src/backend-service.ts` | `ExcelBackendService` | Lightweight HTTP object/publication backend |
| `apps/rasid-web/server/routers.ts` | `appRouter` | Full-stack app API namespace map |

## How Code Implements the Architecture

### Contract-first implementation

`packages/contracts` defines the shape of the architecture. Domain schemas for dashboards, reports, presentations, transcription, governance, localization, AI, and schedules are expressed as `zod` models. These schemas are imported by both engines and bootstrap code, making them the shared language of the system.

### Bootstrap implementation

`apps/contracts-cli/src/index.ts` wires the runtime:

- registers base capabilities
- creates action manifests from the shared registries
- registers tools
- installs default approval and evidence hooks
- hands off execution to web servers or dispatch functions

### Engine implementation

Each major engine file follows the same code pattern:

- define request schemas
- normalize identifiers and timestamps
- construct artifacts/jobs/evidence/audit/lineage
- delegate persistence to a store class
- optionally expose dispatch or platform server functions

### Store implementation

Store classes are responsible for durable execution state. They are not thin caches. They create directory structures under `.runtime`, write record files, update artifact metadata, and provide lookup helpers used by subsequent platform calls.

### Application implementation

`apps/rasid-web` implements a classic app stack:

- React components and contexts control the UI shell
- tRPC procedures call server helpers
- `localDb.ts` exposes sql.js-based CRUD
- `db.ts` and `drizzle/schema.ts` add an optional relational library path

## Representative Code Structure Diagram

See `docs/diagrams/code-structure.mmd`.

## Practical Entry Points for Engineers

For most changes, start here:

- new domain fields or contracts: `packages/contracts/src/*`
- new engine behavior: `packages/<engine>/src/index.ts`
- persistence changes: `packages/<engine>/src/store.ts`
- unified platform routing: `apps/contracts-cli/src/dashboard-web.ts`
- standalone product routing: `packages/report-engine/src/platform.ts`, `packages/presentations-engine/src/platform.ts`, `apps/contracts-cli/src/transcription-web.ts`
- design-app UI changes: `apps/rasid-web/client/src/pages/Home.tsx`
- design-app API changes: `apps/rasid-web/server/routers.ts`

