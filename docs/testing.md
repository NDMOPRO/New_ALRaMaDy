# Testing, Monitoring, and Operational Readiness

## 1. Test Strategy

The repository uses four complementary validation layers.

### A. Workspace validation

Defined in [rasid-platform-core/package.json](/C:/ALRaMaDy/rasid-platform-core/package.json):

- `npm run build`
- `npm run lint`
- `npm run test:smoke`
- `npm run check`

These verify:

- TypeScript project references
- shared contract/version guardrails
- workspace import boundaries
- the foundation smoke path

### B. Engine regression suites

The `scripts/` directory contains engine and cross-engine regressions, including:

- dashboard regressions and performance probes
- report engine regressions and bridge proofs
- presentations regression
- governance cross-engine proofs
- AI engine regression
- transcription regression and hostile revalidation
- localization proof scripts
- strict replication regression
- Excel engine and cross-engine consumability runs

These scripts are the main proof-oriented validation layer for the active monorepo.

### C. `apps/rasid-web` unit/integration tests

Configured in [vitest.config.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/vitest.config.ts).

Covered areas include:

- auth/logout
- AI router behavior
- autosave/export behavior
- real-data flow checks
- presentation generation
- phase-specific regressions

### D. Live proof artifacts

The repository also preserves browser screenshots, JSON reports, and engine-generated proof bundles under `.runtime/` and root `.runtime/` folders. These are not a substitute for automated tests, but they are part of the operational evidence model used throughout the repo.

## 2. CI Pipeline

GitHub Actions workflow: [shared-foundation.yml](/C:/ALRaMaDy/rasid-platform-core/.github/workflows/shared-foundation.yml)

The pipeline runs:

1. checkout
2. Node 24 setup
3. `npm ci`
4. `npm run build`
5. `npm run lint`
6. `npm run test:smoke`
7. `npm run check`

This validates the shared monorepo foundation, but it does not yet exercise every standalone platform server or every proof script.

## 3. Logging and Monitoring Model

There is no centralized logging or metrics stack in the checked-in code. Observability is mostly filesystem-native.

### What exists

- per-engine JSON artifacts
- evidence packs
- audit events
- lineage edges
- publication manifests and state files
- screenshots and proof bundles from regression scripts
- runtime folders segmented by engine, entity id, and job id

### What does not exist

- centralized log aggregation
- metrics backend
- tracing
- alert routing
- service dashboards backed by an external monitoring platform

## 4. Performance Considerations

The main performance characteristics of the current platform are:

- synchronous `fs` writes in many store implementations
- large monolithic server files, especially `dashboard-web.ts`
- export-heavy document generation in report and presentation engines
- Python bridge cost in transcription/document understanding flows
- provider round-trips for AI/image/storage/data API helpers

Use [performance.md](/C:/ALRaMaDy/docs/performance.md) for the endpoint-level and bottleneck summary.

## 5. Scaling Strategy

### Current safe strategy

- scale vertically first
- run the unified gateway as the primary process
- split focused platform servers when needed
- keep runtime folders on fast local disk

### Limits of the current design

- filesystem state prevents easy multi-instance coordination
- schedule/orchestration state is not broker-backed
- no distributed lock or leader-election layer exists
- write-heavy flows can block the event loop with synchronous file work

### Prerequisites for real horizontal scale

1. shared metadata database
2. shared object store for artifacts and exports
3. proper worker queue
4. centralized auth/session validation
5. centralized metrics and logging

## 6. Failure Recovery

### What helps recovery today

- each engine persists durable runtime bundles
- report and dashboard schedulers store state transitions and retry metadata
- AI, transcription, governance, and strict flows store audit and lineage artifacts
- publication manifests and file outputs are preserved on disk
- proof scripts often leave enough artifacts to reproduce a failing path

### Where recovery is weak

- no transactional rollback across engines
- no broker-backed dead-letter handling
- no centralized reconciliation process for cross-engine partial failure
- filesystem corruption or disk loss can remove the primary operational state

## 7. Operational Guidance

When debugging a failure:

1. identify the entry surface: unified gateway, report platform, presentation platform, transcription server, or `rasid-web`
2. locate the corresponding `.runtime/<engine>` folder
3. inspect `state`, `artifacts`, `evidence`, `audit`, and `lineage` subfolders
4. determine whether the break is in routing, governance, engine logic, export generation, or provider integration
5. rerun the narrowest regression script that covers the failing path

## 8. Recommended Next Steps

The highest-value operational improvements are:

1. add central metrics and structured logging
2. move heavy work to background workers
3. convert schedule/orchestration records into a real queue workflow
4. add automated API tests for the standalone report and presentation servers
5. reduce `dashboard-web.ts` into composable route modules for better test isolation
