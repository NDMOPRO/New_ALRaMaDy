# Module and Service Breakdown

## 1. Applications

### `apps/contracts-cli`

| Module | Purpose | Main components | Inputs and outputs | Dependencies | Failure scenarios |
| --- | --- | --- | --- | --- | --- |
| `src/index.ts` | Bootstraps the runtime registry and exposes CLI/server commands | `RegistryBootstrap`, command dispatch, capability registration | CLI args or JSON payloads in, server handles or action results out | all engine packages, registry, contracts | invalid payloads, missing compiled platform modules, unhandled engine exceptions |
| `src/dashboard-web.ts` | Active unified platform server | page renderer, auth shell, governance facade, AI facade, dashboard/report/presentation bridge handlers | HTTP requests in, HTML/JSON/open-path responses out | AI, dashboard, governance, localization, presentations, report, transcription engines | auth bypass bugs, policy mismatch, engine errors, runtime file corruption |
| `src/transcription-web.ts` | Focused transcription server | login shell, transcription job routes, compare and question surfaces | HTTP requests in, transcription state/proof JSON out | AI and transcription engines | bridge failures, OCR/transcription degradation, missing runtime artifacts |

### `apps/rasid-web`

| Module group | Purpose | Main components | Inputs and outputs | Dependencies | Failure scenarios |
| --- | --- | --- | --- | --- | --- |
| Client shell | User-facing SPA | [App.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/App.tsx), pages, contexts, Wouter routes | browser events in, tRPC requests and UI state out | React, Wouter, React Query, tRPC client | auth drift, stale local state, routing mismatch |
| Home workspace | Premium canvas UI | [Home.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/Home.tsx), `NotebookHeader`, `DataPanel`, `StudioPanel`, `ChatCanvas`, `WorkspaceView` | data/report/presentation/dashboard lists in, user actions out | tRPC `files`, `reports`, `presentations`, `dashboards` | inconsistent source-of-truth when backend adapters change |
| Server core | Express and tRPC bootstrap | [server/_core/index.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/_core/index.ts), context, vite/static setup, cookie parsing | HTTP/tRPC requests in, SSR/static assets and tRPC responses out | Express, tRPC, Vite | startup/config failures, cookie/auth parsing issues |
| Local auth | Cookie/JWT auth for local runtime | [server/localAuth.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/localAuth.ts) | credentials or cookie in, user session out | `bcryptjs`, `jose`, `localDb.ts` | weak secret management, expired or invalid sessions |
| Local operational DB | App-specific operational CRUD | [server/localDb.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/localDb.ts) | CRUD inputs in, sqlite-backed records out | `sql.js` | DB file corruption, race conditions from process-local writes |
| MySQL library/auth DB | Optional relational metadata path | [server/db.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/db.ts), [drizzle/schema.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/drizzle/schema.ts) | OAuth or library metadata in, MySQL rows out | Drizzle, `DATABASE_URL` | unavailable DB, partial schema setup |
| Upload service | Multipart file intake | [server/uploadRoute.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/uploadRoute.ts) | multipart files in, local file records out | `multer`, `localAuth`, `localDb` | oversized files, bad MIME handling, path cleanup failures |
| AI router | Direct AI helpers for the app shell | [server/aiRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/aiRouter.ts) | prompts/files/images in, generated content and analysis out | OpenAI/Forge helpers, Drizzle library tables | provider failure, malformed JSON-schema outputs, missing API keys |
| Library router | Slide/template decomposition and library CRUD | [server/libraryRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/libraryRouter.ts) | PPTX buffers, metadata, library edits in | Drizzle schema, storage helper, LLM helper | PPTX parsing failure, storage proxy failure, bad AI decomposition |

## 2. Engine Packages

| Package | Purpose | Major classes and functions | Input and output model | Direct dependencies | Failure scenarios |
| --- | --- | --- | --- | --- | --- |
| `ai-engine` | AI planning and downstream orchestration | `RasidAiEngine.submitJob`, `approveJob`, `getJob`, `listJobs`, `registerAiCapability` | `SubmitAiJobInput` in, execution plan/summary/artifacts/evidence out | localization, dashboard, excel, presentations, report, strict, transcription engines | planner/provider failure, approval boundary rejection, downstream engine failure |
| `arabic-localization-lct-engine` | Arabic localization and quality gating | `ArabicLocalizationLctEngine.run`, `detectSourceLanguage`, `buildLocalizationPlan`, `runLocalizationQualityGates` | dashboard/report-like source bundle in, localized bundle and proof artifacts out | dashboard-engine, report-engine, capability-registry, contracts | terminology mismatch, typography/layout degradation, failed quality gates |
| `dashboard-engine` | Dashboard authoring, refresh, compare, publish, share, schedule | `DashboardEngine.createDashboard`, `updateDashboard`, `refreshDashboard`, `publishDashboard`, `executeInteraction`, `compareDashboardVersions`, `scheduleDashboardRefresh` | dashboard action requests in, dashboard/version/publication/compare bundles out | capability-registry, contracts, `DashboardEngineStore` | invalid layout/binding input, publication transport errors, scheduled refresh drift |
| `excel-engine` | Workbook-native import, analysis, transform, chart, pivot, export | `ExcelEngine.importWorkbook`, `analyzeWorkbook`, `recalculateFormulas`, `applyTransformation`, `generatePivot`, `generateChart`, `exportEditableWorkbook`, `publishWorkbook` | workbook files and transformation requests in, workbook package/artifacts/publication out | contracts, capability-registry, `ExcelEngineStore`, `ExcelBackendService` | formula recalculation issues, unsupported workbook content, backend publication path failures |
| `governance-engine` | Roles, policies, approvals, evidence, audit, prompt/compliance checks | `GovernanceEngine`, `GovernanceEngineStore`, `authorize`, `createApproval`, `reviewApproval`, `createEvidence`, `scanPromptSurface`, `complianceSurface` | actor context + governance mutations in, decisions/approvals/evidence/audit/lineage out | contracts, capability-registry | incorrect policy evaluation, stale approval state, missing evidence closure |
| `presentations-engine` | Deck generation, mutation, binding, publish, export, parity | `PresentationEngine.createPresentation`, `mutatePresentation`, `bindDeckToData`, `applyTemplateLock`, `renderPreview`, `exportPresentation`, `runRenderParityValidation`, `publishPresentation` | prompts, source refs, theme/template choices in, deck bundle/public exports/publication out | contracts, capability-registry, `PresentationEngineStore`, premium template helpers | export failure, parity failure, unsupported media/template combination |
| `report-engine` | Report ingest, authoring, review, approval, export, scheduling, conversion | `ReportEngine.createReport`, `createReportFromTranscription`, `ingestExternalReport`, `updateReport`, `reviewReport`, `approveReport`, `exportReport`, `convertReportToPresentation`, `convertReportToDashboard`, `scheduleReport` | structured sections or imported file/transcription bundle in, report state/publications/conversions out | dashboard-engine, presentations-engine, contracts, capability-registry, `ReportEngineStore` | parser failure, invalid content-block state, approval rejection, export transport failure |
| `strict-replication-engine` | Layout-preserving reconstruction and fidelity scoring | `StrictReplicationEngine.run`, `registerStrictReplicationEngine` | page/element grid description in, strict execution bundle and publication out | contracts, capability-registry | editability gate failure, pixel/structural mismatch, degraded publish only |
| `transcription-extraction-engine` | OCR, transcription, extraction, compare, QA handoff | `TranscriptionExtractionEngine.ingestAndExtract`, `compareBundles`, `answerQuestion`, `dispatchTranscriptionAction`, `dispatchTranscriptionTool` | files or bundle refs in, unified content bundle/report handoff/query dataset out | contracts, capability-registry, Python bridge, `TranscriptionExtractionStore` | bridge process failure, unsupported file type, disagreement or verification gate failure |

## 3. Shared Support Packages

| Package | Responsibility | Notes |
| --- | --- | --- |
| `contracts` | Canonical source of domain schemas, action registries, tool registries, validators, contract envelopes | Every engine and runtime package depends on this layer. |
| `capability-registry` | Capability, manifest, tool, approval-hook, and evidence-hook registration | `RegistryBootstrap` is the root bootstrap primitive for `contracts-cli`. |
| `runtime` | Hook schemas and hook application helpers | Keeps approval/evidence execution typed and separate from engine code. |
| `artifacts`, `audit-lineage`, `brand-template`, `canvas-contract`, `connectors`, `evidence`, `jobs`, `library`, `output-publication`, `permissions` | Thin contract-version guard packages around specialized contract families | They enforce version alignment more than business logic. |
| `common` | Shared contract constants and envelope helpers | Used throughout the contracts package. |

## 4. OCR and Document Processing Modules

### `transcription-extraction-engine`

- Accepts audio, video, PDF, image, spreadsheet, and mixed attachments.
- Resolves `input_kind` and media type from file extensions and bridge metadata.
- Calls the Python bridge at [packages/transcription-extraction-engine/tools/content_bridge.py](/C:/ALRaMaDy/rasid-platform-core/packages/transcription-extraction-engine/tools/content_bridge.py).
- Produces:
  - transcript segments
  - aligned words
  - on-screen OCR text
  - disagreements
  - verification gates
  - extracted fields, entities, tables, summaries
  - report handoff and query dataset artifacts

### `report-engine` external ingest

- Imports DOCX and PDF via platform requests such as `create-from-excel` and `import`.
- Converts imported structure into report sections, blocks, captions, table data, and canonical records.
- Stores external ingest metadata, geometry, and section hierarchy in `ReportEngineStore`.

### `libraryRouter`

- Decomposes PPTX templates into reusable slide elements.
- Uses `JSZip` to parse slide XML, then optionally asks the LLM to generate richer decomposition metadata.
- Saves library metadata into the Drizzle/MySQL schema used by `apps/rasid-web`.

## 5. Layout Reconstruction and Fidelity Modules

### `strict-replication-engine`

- Models source pages as explicit grids with typed elements (`text`, `shape`, `table`).
- Produces:
  - source fingerprints
  - extraction manifests
  - deterministic render profiles
  - structural and pixel equivalence results
  - dual-gate and round-trip validation records
  - degrade reasons and output metadata

### Layout models in shared contracts

- report layout: `packages/contracts/src/report.ts`
- dashboard layout and grid definitions: `packages/contracts/src/dashboard.ts`
- deck outline, storyboard, slide blocks, parity records: `packages/contracts/src/presentation.ts`
- canonical representation model for source/layout lineage: `packages/contracts/src/canonical.ts`

## 6. Translation and Localization Modules

`arabic-localization-lct-engine` owns the translation/localization path.

Responsibilities:

- detect source language
- resolve terminology profiles
- transform language content
- transform RTL/LTR layout
- refine typography
- apply cultural formatting
- run language, layout, editability, and cultural quality gates

Outputs:

- localized content artifacts
- quality reports
- localization diff and policy artifacts
- dashboard continuation bundles when localization feeds back into runtime publication

## 7. Export and File Generation Modules

| Capability | Export surfaces |
| --- | --- |
| Report engine | HTML, PDF, DOCX, degraded publication bundles, report-to-dashboard, report-to-presentation |
| Presentations engine | PPTX, PDF, HTML, Word-like exports, image and video side outputs, public published deck routes |
| Excel engine | editable workbook exports, publication bundles, object-store style backend downloads |
| Dashboard engine | publication manifests, embed payloads, served HTML/embed routes, export-to-external-target flows |
| Localization engine | localized dashboard bundles and localized export preview artifacts |
| Strict replication engine | target-specific reconstructed payload plus published artifact metadata |

## 8. Background Workers and Queue-Like Modules

There is no external broker such as RabbitMQ, Redis Streams, SQS, or Kafka in the current code. Background execution is modeled in-process and persisted to files.

### Current queue-like mechanisms

- `DashboardEngineStore` schedule entries and runner jobs
- `ReportEngineStore` schedules, orchestrations, dispatches, retries, and transport deliveries
- `AiEngineStore` session/job persistence
- `GovernanceEngineStore` approvals and queue controls
- presentation EventSource streams in the standalone presentation platform
- dashboard websocket burst/perf endpoints in the unified gateway

### Operational consequence

These mechanisms work as durable local ledgers, not distributed work queues. They are suitable for single-host or tightly controlled deployments, but not for horizontally scaled worker fleets.
