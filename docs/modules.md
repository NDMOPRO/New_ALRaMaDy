# Modules

This file inventories the repository by executable or structurally important module. It complements the topic-specific documents by making the codebase navigable.

## Top-Level Repository Areas

| Path | Role |
| --- | --- |
| `rasid-platform-core/` | Active monorepo containing the shared contracts, engines, web shells, scripts, deployment config, and runtime artifacts |
| `rasid_core_seed/` | Historical extracted reference code grouped by capability slice; used as source material and comparison, not as the active runtime |
| `docs/` | Architecture and audit documentation |

## Apps

### `rasid-platform-core/apps/contracts-cli`

Purpose: command and server bootstrap for the shared monorepo.

Key files:

- `src/index.ts`: CLI dispatch, capability registration, server startup commands
- `src/dashboard-web.ts`: deployed unified gateway and cross-engine API shell
- `src/transcription-web.ts`: dedicated transcription UI/API shell

Dependencies:

- all major shared engine packages
- `@rasid/contracts`
- `@rasid/runtime`
- `@rasid/capability-registry`

Interactions:

- starts HTTP servers
- dispatches action/tool invocations
- bootstraps runtime capability metadata

### `rasid-platform-core/apps/rasid-web`

Purpose: imported full-stack workspace application with a premium unified canvas UI and its own app server.

Submodules:

- `client/`: React/Vite SPA
- `server/`: Express + tRPC backend
- `drizzle/`: optional MySQL schema and migrations

Important client files:

- `client/src/App.tsx`: route tree and providers
- `client/src/pages/Home.tsx`: main workspace shell
- `client/src/components/WorkspaceView.tsx`: engine tab renderer
- `client/src/contexts/WorkspaceContext.tsx`: cross-view navigation state
- `client/src/lib/assets.ts`: workspace view inventory and UI constants

Important server files:

- `server/_core/index.ts`: Express bootstrap
- `server/routers.ts`: primary tRPC namespaces
- `server/aiRouter.ts`: AI-heavy tRPC namespace
- `server/libraryRouter.ts`: slide library/template namespace
- `server/localAuth.ts`: JWT cookie auth
- `server/localDb.ts`: embedded `sql.js` data access layer
- `server/db.ts`: optional Drizzle/MySQL connector
- `server/uploadRoute.ts`: multipart upload API

Important characteristics:

- client talks to `/api/trpc` via `httpBatchLink`
- auth is cookie-based
- content records live in `data/rasid.db`
- uploads live under `uploads/`
- slide template metadata can live in MySQL when `DATABASE_URL` is configured

## Shared Kernel Packages

These packages define the common language of the active architecture.

| Package | Purpose | Notes |
| --- | --- | --- |
| `packages/contracts` | Shared `zod` schemas, registries, and type exports | Architectural source of truth |
| `packages/capability-registry` | `RegistryBootstrap`, capability registration, manifest handling | Connects capabilities, actions, tools, hooks |
| `packages/runtime` | Approval/evidence hook runtime | Shared execution policy helpers |
| `packages/common` | shared constants, contract versions | Used by bootstrap and guards |
| `packages/artifacts` | artifact contract re-export package | Thin package |
| `packages/audit-lineage` | audit/lineage contract re-export package | Thin package |
| `packages/evidence` | evidence contract re-export package | Thin package |
| `packages/jobs` | job contract re-export package | Thin package |
| `packages/library` | library asset contract re-export package | Thin package |
| `packages/permissions` | permission contract re-export package | Thin package |
| `packages/output-publication` | publication contract re-export package | Thin package |
| `packages/connectors` | source connector contract re-export package | Thin package |
| `packages/canvas-contract` | unified canvas state contracts | Shared page/session model |
| `packages/brand-template` | brand preset contracts | Used by report/presentation surfaces |

These packages are intentionally lightweight because the deeper behavior is implemented by the domain engines.

## Domain Engine Packages

### `packages/dashboard-engine`

Purpose: dashboard creation, mutation, compare, publish, interaction, and scheduling runtime.

Key internals:

- `DashboardEngine`
- `DashboardEngineStore`
- dashboard transport/websocket helpers

Representative methods:

- `createDashboard`
- `updateDashboard`
- `refreshDashboard`
- `publishDashboard`
- `executeInteraction`
- `compareDashboardVersions`
- `scheduleDashboardRefresh`
- `runDueRefreshes`

Persistence:

- `.runtime/dashboard-engine`
- schedule records
- publication state
- interactive transport runtime

### `packages/report-engine`

Purpose: governed report ingest, editing, review, approval, scheduling, publishing, and downstream conversion.

Key internals:

- `ReportEngine`
- `ReportEngineStore`
- `platform.ts` standalone server

Representative methods:

- `ingestExternalReport`
- `createReportFromTranscription`
- `createReport`
- `updateReport`
- `refreshReport`
- `reviewReport`
- `approveReport`
- `exportReport`
- `convertReportToPresentation`
- `convertReportToDashboard`
- `publishReport`
- `scheduleReport`
- `runDueSchedules`

Distinctive features:

- external DOCX/PDF import bridge
- versioning and back-sync records
- publication transport records
- orchestration and retry metadata

### `packages/presentations-engine`

Purpose: deck generation, themeing, mutation, data binding, publishing, parity validation, and export.

Key internals:

- `PresentationEngine`
- `PresentationEngineStore`
- `platform.ts` standalone presentation server
- `workspace.ts` alternate/local workspace surface
- `premium.ts` premium template catalog

Representative methods:

- `createPresentation`
- `mutatePresentation`
- `bindDeckToData`
- `applyTemplateLock`
- `renderPreview`
- `exportPresentation`
- `runRenderParityValidation`
- `publishPresentation`

Distinctive features:

- PPTX/PDF/HTML export
- native PowerPoint rendering helpers
- template library and premium packs
- presenter/remote/public viewer flows

### `packages/transcription-extraction-engine`

Purpose: OCR/transcription extraction, bundle comparison, and cross-bundle question answering.

Key internals:

- `TranscriptionExtractionEngine`
- `TranscriptionExtractionStore`
- Python content bridge integration

Representative methods:

- `ingestAndExtract`
- `compareBundles`
- `answerQuestion`
- spreadsheet-specific analysis helper

Distinctive features:

- multimodal intake (`audio`, `video`, `pdf`, images, spreadsheet files)
- unified content bundle output
- report handoff and query dataset generation

### `packages/ai-engine`

Purpose: governed AI planner/router/executor across platform surfaces.

Key internals:

- `RasidAiEngine`
- `AiEngineStore`
- deterministic and safe fallback planner providers

Representative methods:

- `submitJob`
- `approveJob`
- `getJob`
- `listJobs`

Distinctive features:

- page-aware routing
- provider/model selection
- approval boundaries
- downstream engine continuation
- evidence, audit, and lineage capture

### `packages/governance-engine`

Purpose: file-backed governance runtime for permissions, policies, approvals, evidence, audit, queue controls, KPI definitions, and security state.

Key internals:

- `GovernanceEngineStore`
- `GovernanceEngine`

Representative methods:

- `authorize`
- `createApproval`
- `reviewApproval`
- `saveRole`
- `saveAssignment`
- `savePolicy`
- `saveKpi`
- `createEvidence`
- `attachEvidence`
- `closeEvidence`
- `scanPromptSurface`
- `complianceSurface`
- `libraryMatrix`
- `listSnapshot`

Distinctive features:

- tenant-scoped governance snapshots
- internal queue and rate-limit records
- prompt and compliance scans

### `packages/arabic-localization-lct-engine`

Purpose: Arabic localization, RTL/LTR transformation, typography refinement, and quality gate execution.

Representative methods:

- `detectSourceLanguage`
- `resolveTerminologyProfile`
- `buildLocalizationPlan`
- `transformLanguage`
- `transformRtlLtrLayout`
- `refineTypography`
- `applyCulturalFormatting`
- `runLocalizationQualityGates`
- `run`

Distinctive features:

- canonical-content transformation
- typography and layout adjustment
- proof bundle generation

### `packages/strict-replication-engine`

Purpose: deterministic fidelity and strict replication workflows.

Key internals:

- `StrictReplicationEngine`
- regression suite helpers

Distinctive features:

- evidence-oriented replication bundles
- strong fidelity framing even though much of the original full service topology now lives only in `rasid_core_seed`

### `packages/excel-engine`

Purpose: workbook-native operations, formula evaluation, transformation, pivot/chart generation, formatting, export, and publication.

Key internals:

- `ExcelEngine`
- `ExcelEngineStore`
- `ExcelBackendService`
- `formula-worker.ts`

Representative methods:

- `importWorkbook`
- `analyzeWorkbook`
- `importLambdaRegistry`
- `exportLambdaRegistry`
- `recalculateFormulas`
- `applyTransformation`
- `generatePivot`
- `generateChart`
- `applyFormatting`
- `exportEditableWorkbook`
- `publishWorkbook`
- `persistRunState`

Distinctive features:

- worker-thread formula execution
- optional lightweight backend/object-publication service
- local and remote publication proof paths

## Supporting Scripts

`rasid-platform-core/scripts/` is effectively a testing and proof orchestration module.

It includes:

- regression suites for AI, dashboard, governance, presentations, report, transcription, and strict replication
- cross-engine proof scripts
- performance and hostile-path scripts
- smoke tests under `scripts/smoke/`
- the Excel backend HTTP helper

## Reference Seed

`rasid_core_seed/` is organized by extracted capability slices:

- `01_shell`
- `02_shared_contracts`
- `03_governance_evidence`
- `04_strict_fidelity_kernel`
- `05_excel_core`
- `06_template_core`
- `07_schema_contracts`
- `08_visual_dna`

Current role:

- reference for migration and pattern borrowing
- not the active deployable runtime
- useful when tracing how older service-oriented slices informed the newer monorepo engines

## Fast Navigation Guide

- changing shared contracts: `packages/contracts/src/*`
- changing runtime/bootstrap wiring: `apps/contracts-cli/src/index.ts`
- changing deployed unified APIs/pages: `apps/contracts-cli/src/dashboard-web.ts`
- changing dedicated transcription surface: `apps/contracts-cli/src/transcription-web.ts`
- changing report platform APIs/pages: `packages/report-engine/src/platform.ts`
- changing presentations platform APIs/pages: `packages/presentations-engine/src/platform.ts`
- changing engine persistence: `packages/*/src/store.ts`
- changing imported design app UI: `apps/rasid-web/client/src/*`
- changing imported design app APIs: `apps/rasid-web/server/*`
