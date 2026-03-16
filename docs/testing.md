# Testing

## Testing Strategy

The repository uses four distinct testing styles:

1. static validation through TypeScript build and custom guardrail scripts
2. smoke tests that prove the shared foundation boots and major engines run
3. capability-specific regression scripts that generate durable runtime evidence under `.runtime/` or package output folders
4. app-local unit/integration tests in `apps/rasid-web`

This is not a conventional "unit test only" codebase. Proof artifacts are part of the testing model.

## CI Validation

GitHub Actions workflow: `rasid-platform-core/.github/workflows/shared-foundation.yml`

CI steps:

- `npm ci`
- `npm run build`
- `npm run lint`
- `npm run test:smoke`
- `npm run check`

Implication:

- the active CI path validates the monorepo runtime
- `apps/rasid-web` is not wired into the monorepo TypeScript references or CI pipeline

## Monorepo Validation Commands

### Core static checks

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run check`

What they cover:

- TypeScript project references
- shared contract version guards
- workspace import rules
- shared architectural guardrails

### Smoke tests

- `npm run test:smoke`
- `npm run test:excel-engine`
- `npm run test:localization-engine`

These prove foundational runtime viability rather than exhaustive business correctness.

## Capability Regression Suites

### Dashboard / unified gateway

- `npm run test:dashboard-web`
- `npm run test:dashboard-publication`
- `npm run test:dashboard-open-items`
- `npm run test:dashboard-drag`
- `npm run test:dashboard-drag-completeness`
- `npm run test:dashboard-live-performance`
- `npm run test:dashboard-ai-surface`
- `npm run test:dashboard-compare-governance`
- `npm run test:dashboard-full-proof`

Focus:

- page/API behavior
- publication interactivity
- drag/rebind flows
- compare and governance panels
- performance probe surfaces

### AI and governance

- `npm run test:ai-engine`
- `npm run test:governance-engine`
- `npm run test:governance-hostile`
- `npm run test:governance-unauthorized`
- `npm run test:governance-cross-engine-strict`
- `npm run test:governance-cross-engine-coverage`

Focus:

- planner/executor behavior
- approval boundaries
- hostile path validation
- cross-engine governance coverage

### Report engine

- `npm run test:report-engine`
- `npm run test:report-complex-layout`
- `npm run test:report-remote-externalization`
- `npm run test:report-cross-engine-flow`
- `npm run test:report-dashboard-platform-flow`
- `npm run test:report-dashboard-localization-platform-flow`
- `npm run test:report-open-items`
- `npm run test:report-platform`

Focus:

- import fidelity
- review/approval/publish flows
- downstream dashboard/presentation/localization continuation
- remote publication

### Presentations engine

- `npm run test:presentations-engine`

Focus:

- generation
- theme/template behavior
- export paths
- parity validation
- public/presenter/remote flows

### Transcription engine

- `npm run test:transcription-engine`
- `npm run test:transcription-report-presentation-dashboard-flow`
- `scripts/transcription-hostile-revalidation.mjs`

Focus:

- ingestion and extraction
- report/presentation/dashboard continuation
- hostile inputs

### Localization and strict replication

- `npm run test:localization-contextual-quality`
- `npm run test:localization-generated-narrative`
- `npm run test:localization-ui-strings`
- `npm run test:localization-live-proof`
- `npm run test:localization-remote-gateway`
- `npm run test:localization-hostile-revalidation`
- `npm run test:localization-cross-engine-flow`
- `npm run test:strict-regression`

### Excel engine

- `npm run test:excel-engine`
- `npm run test:excel-engine-hostile-audit`
- `npm run test:excel-cross-engine`
- `npm run test:excel-report-cross-engine`
- `npm run test:excel-dashboard-cross-engine`

Focus:

- workbook import/export/editability
- formula and formatting fidelity
- hostile input behavior
- cross-engine consumability

## `apps/rasid-web` Tests

`apps/rasid-web` defines:

- `npm test` -> `vitest run`
- `npm run check` -> `tsc --noEmit`

Observed server test files:

- `ai.test.ts`
- `aiPresentation.test.ts`
- `auth.logout.test.ts`
- `autoSaveExport.test.ts`
- `newFeatures.test.ts`
- `openai.test.ts`
- `phase16.test.ts`
- `phase17.test.ts`
- `presentationGen.test.ts`
- `realData.test.ts`

These tests are app-local and do not currently participate in the monorepo root CI path.

## Test Artifacts

A defining characteristic of this repo is that many tests persist proof artifacts instead of only returning pass/fail.

Common artifact locations:

- `rasid-platform-core/.runtime/*`
- `rasid-platform-core/packages/*/output/*`
- `rasid-platform-core/packages/*/artifacts/latest-run/*`

Typical artifact types:

- screenshots
- JSON summaries
- route inventories
- evidence packs
- audit and lineage outputs
- generated exports and publication bundles

## What Is Actually Verified Well

- contract/bootstrap coherence of the active monorepo
- capability-specific happy paths for dashboard, report, presentation, transcription, localization, governance, AI, and Excel flows
- many cross-engine continuation paths
- persistence of runtime evidence on disk

## Main Testing Gaps

- `apps/rasid-web` is not first-class in root CI
- broad repo health can drift even when one capability-specific regression passes
- many tests are proof-oriented integration runs, so they are heavier and harder to parallelize than isolated unit tests
- there is limited evidence of a single, deterministic, fast unit-test layer across all packages
- live external providers and deployment-time behavior are sometimes verified manually or through environment-specific proof runs rather than repeatable CI

## Practical Guidance

- for shared monorepo changes, run the narrow capability regression plus the root `build`, `lint`, and `test:smoke` path
- for `apps/rasid-web` changes, run both `npm run check` and `npm test` inside that app
- inspect generated proof artifacts, not just exit codes, when modifying publish, export, OCR, localization, or cross-engine continuation paths
