# C4 Level 3: Component Architecture

Diagram sources:

- `docs/diagrams/component-unified-gateway.mmd`
- `docs/diagrams/component-rasid-web.mmd`

## Unified Gateway Components

The unified gateway in `apps/contracts-cli/src/dashboard-web.ts` is a hand-built monolith. Its major components are:

### 1. HTTP/auth shell

- parses requests and routes by pathname
- serves top-level HTML pages
- owns login handling on `/api/v1/governance/auth/login`
- protects routes before write operations

### 2. Surface renderer

- renders the unified canvas HTML for `/home`, `/data`, `/transcription`, `/dashboards`, `/reports`, `/presentations`, `/library`, and `/governance`
- embeds client-side scripts that call `/api/v1/...`
- keeps page-specific hints, labels, and action affordances close to the route layer

### 3. Governance facade

- wraps mutating operations in `GovernanceEngine.execute...` style flows
- exposes role, assignment, policy, KPI, approval, audit, evidence, lineage, and library endpoints
- enforces approval-required boundaries for publish/share/schedule and selected AI actions

### 4. AI orchestration facade

- receives AI job requests
- builds page-specific context
- uses `RasidAiEngine` to route to downstream engines
- exposes status, result, evidence, audit, and lineage retrieval

### 5. Data registration facade

- registers datasets into a governed workspace model
- returns `open_path` links for downstream dashboard/report continuation

### 6. Dashboard orchestration facade

- creates, mutates, refreshes, compares, publishes, shares, schedules, and exports dashboards
- provides template and library helpers
- exposes websocket updates for dashboard interactions

### 7. Cross-engine bridge handlers

- transcription to report
- report to presentation
- report to dashboard
- presentation to dashboard
- dashboard to localization
- dashboard to strict replication

## Shared Engine Internal Pattern

Most engine packages follow the same internal structure:

1. Input schemas and request discriminators
2. Engine class implementing orchestration methods
3. Store class persisting bundles/artifacts under `.runtime`
4. Optional standalone HTTP wrapper or backend helper

This pattern is explicit in:

- `DashboardEngine` + `DashboardEngineStore`
- `ReportEngine` + `ReportEngineStore`
- `PresentationEngine` + `PresentationEngineStore`
- `TranscriptionExtractionEngine` + `TranscriptionExtractionStore`
- `RasidAiEngine` + `AiEngineStore`

## `apps/rasid-web` Components

### Client-side

- `App.tsx`: route and provider composition
- `pages/Home.tsx`: premium unified canvas shell
- `WorkspaceContext.tsx`: active view and cross-engine navigation state
- engine-themed React components such as `ReportsEngine.tsx`, `PresentationsEngine.tsx`, `DashboardEngine.tsx`, `ExtractionEngine.tsx`, `TranslationEngine.tsx`, and `LibraryEngine.tsx`
- `lib/trpc.ts`: client-side API binding

### Server-side

- `server/_core/index.ts`: Express bootstrap, cookie parser, uploads, tRPC middleware, Vite/static serving
- `routers.ts`: top-level tRPC namespaces for auth, files, reports, presentations, dashboards, spreadsheets, admin, translations, extractions, and chat history
- `aiRouter.ts`: AI chat, slide generation, analysis, and PPTX library decomposition flows
- `libraryRouter.ts`: template-library management
- `localAuth.ts`: JWT and password-based auth
- `localDb.ts`: local sql.js CRUD layer
- `db.ts`: optional Drizzle/MySQL connection
- `uploadRoute.ts`: multipart upload API and upload file registration

## Component Interaction Summary

### Unified gateway path

Browser page -> route handler -> governance wrapper -> domain engine -> engine store -> JSON/filesystem artifacts -> response with next `open_path`

### `rasid-web` path

React UI -> tRPC client -> Express/tRPC router -> local auth/db helpers or AI/library helpers -> sql.js/MySQL/filesystem -> response

## Component Diagrams

See:

- `docs/diagrams/component-unified-gateway.mmd`
- `docs/diagrams/component-rasid-web.mmd`

