# Dependency Map

- Basis: import scan of the copied completed-seed files only. No source files were rewritten or patched.
- `@rasid/shared` is treated as an internal seed dependency on `02_shared_contracts`, not as a third-party package.
- Exact requested source coverage is now complete: `Missing exact-source rows = 0` in this completed seed.

## 01_shell

- Extracted rows: 23/23
- Readiness split: production-usable=12, needs-refactor=11, reference-only=0
- Internal dependencies:
  Shell app/state/workspace files were restored verbatim from the snapshot archive under the original `frontend/app`, `frontend/state`, `frontend/components/workspaces`, and `frontend/lib/*` layout.
  The package now reflects the requested shell slice exactly, but any remaining missing imports shown below are coupling beyond the requested extraction boundary.
- External dependencies:
  `@xstate/react`, `lucide-react`, `next`, `react`, `react-dropzone`, `xstate`, `zustand`
- Missing files needed later:
  - None.
- Files needing decoupling before move:
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/ArtifactQuickApplyPanel.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/RasedCanvasCards.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/RasidCommandCenter.tsx (alias-coupling:1)`
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/ReplicationArtifactBanner.tsx (alias-coupling:1)`
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/SourceContextBanner.tsx (alias-coupling:1)`
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/WorkspaceBootstrapNotice.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/01_shell/frontend/components/workspaces/WorkspaceGeneratedDraftPanel.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/01_shell/frontend/lib/rased-ui.ts (alias-coupling:3)`
  - `rasid_core_seed_completed/01_shell/frontend/lib/workspaces/bootstrap-engine.ts (alias-coupling:1)`
  - `rasid_core_seed_completed/01_shell/frontend/lib/workspaces/draft-presets.ts (alias-coupling:2)`
  - `rasid_core_seed_completed/01_shell/frontend/lib/workspaces/use-workspace-draft.ts (alias-coupling:2)`

## 02_shared_contracts

- Extracted rows: 21/21
- Readiness split: production-usable=19, needs-refactor=2, reference-only=0
- Internal dependencies:
  Intra-package links across `packages/shared/constants/*`, `packages/shared/services/*`, `packages/shared/types/*`, and `packages/shared/utils/*` were preserved verbatim.
  One self-package coupling remains via `@rasid/shared` in `packages/shared/utils/api-client.ts`.
- External dependencies:
  `cors`, `crypto`, `express`, `http`, `uuid`, `winston`, `zod`
- Missing files needed later:
  - `rasid_core_seed_completed/02_shared_contracts/packages/shared/utils/auth.ts`
- Files needing decoupling before move:
  - `rasid_core_seed_completed/02_shared_contracts/packages/shared/index.ts (missing-local:1)`
  - `rasid_core_seed_completed/02_shared_contracts/packages/shared/utils/api-client.ts (depends-on:@rasid/shared)`

## 03_governance_evidence

- Extracted rows: 13/13
- Readiness split: production-usable=12, needs-refactor=1, reference-only=0
- Internal dependencies:
  Extracted middleware, route, service, and logger files remain under `services/governance-service/src/{middleware,routes,services,utils}` with original relative links intact where present.
  The governance slice is now exact-source complete, though some route-level/controller coupling may still remain outside the requested extraction boundary.
- External dependencies:
  `@elastic/elasticsearch`, `@prisma/client`, `bcrypt`, `crypto`, `express`, `fs`, `ioredis`, `jsonwebtoken`, `path`, `qrcode`, `speakeasy`, `winston`, `zod`
- Missing files needed later:
  - `rasid_core_seed_completed/03_governance_evidence/services/governance-service/src/controllers/auth.controller.ts`
- Files needing decoupling before move:
  - `rasid_core_seed_completed/03_governance_evidence/services/governance-service/src/routes/auth.routes.ts (missing-local:1)`

## 04_strict_fidelity_kernel

- Extracted rows: 39/39
- Readiness split: production-usable=28, needs-refactor=9, reference-only=2
- Internal dependencies:
  The strict kernel keeps the original split between `src/strict/**/*` and supporting replication services under `src/services/*`.
  Several replication services import `@rasid/shared`, creating an internal dependency on `02_shared_contracts` if the completed seed is turned into a runnable multi-package core later.
- External dependencies:
  `@prisma/client`, `canvas`, `crypto`, `express`, `fs`, `openai`, `os`, `path`, `pdf-parse`, `pixelmatch`, `pngjs`, `sharp`, `uuid`, `winston`, `zod`
- Missing files needed later:
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/large-image-processor.service.ts`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/utils/logger.ts`
- Files needing decoupling before move:
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/arabic-typography-optimizer.service.ts (depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/canonical-pipeline-orchestrator.service.ts (depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/data-binding.service.ts (depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/data-extraction.service.ts (depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/font-recognition.service.ts (depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/layout-generation-controller.service.ts (missing-local:1, depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/pdf-intelligence.service.ts (missing-local:1)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/pixel-validation-loop.service.ts (depends-on:@rasid/shared)`
  - `rasid_core_seed_completed/04_strict_fidelity_kernel/services/replication-service/src/services/quality-validation.service.ts (depends-on:@rasid/shared)`

## 05_excel_core

- Extracted rows: 42/42
- Readiness split: production-usable=27, needs-refactor=15, reference-only=0
- Internal dependencies:
  The Excel slice preserves `src/services/*`, `src/services/formula-functions/*`, `src/types/*`, `src/utils/*`, and `src/workers/*` as separate layers.
  Runtime-oriented services still depend on non-extracted infrastructure helpers under `src/utils/*` and `src/middleware/*`.
  One cross-package dependency remains on `@rasid/shared` via `table-intelligence.service.ts`.
- External dependencies:
  `@prisma/client`, `archiver`, `chardet`, `chart.js`, `chartjs-node-canvas`, `crypto`, `crypto-js`, `decimal.js`, `exceljs`, `fs`, `hot-formula-parser`, `mathjs`, `openai`, `os`, `papaparse`, `path`, `pdfkit`, `sharp`, `stream`, `uuid`, `winston`, `xlsx`, `zod`
- Missing files needed later:
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/middleware/errorHandler.ts`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/utils/logger.ts`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/utils/prisma.ts`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/utils/redis.ts`
- Files needing decoupling before move:
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/accuracy-audit.service.ts (missing-local:1)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/conversion.service.ts (missing-local:1)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/document-structure.service.ts (missing-local:4)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/excel-matching.service.ts (missing-local:5)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/fingerprint.service.ts (missing-local:2)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/formatting.service.ts (missing-local:3)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/formula-engine.service.ts (missing-local:3)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/formula-intelligence.service.ts (missing-local:2)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/formulas.service.ts (missing-local:3)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/matching.service.ts (missing-local:3)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/pivot-table.service.ts (missing-local:3)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/professional-formatting.service.ts (missing-local:4)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/spreadsheet-engine.service.ts (missing-local:3)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/spreadsheet.service.ts (missing-local:1)`
  - `rasid_core_seed_completed/05_excel_core/services/excel-service/src/services/table-intelligence.service.ts (depends-on:@rasid/shared)`

## 06_template_core

- Extracted rows: 8/8
- Readiness split: production-usable=4, needs-refactor=4, reference-only=0
- Internal dependencies:
  Controller, route, and service files were preserved under the original `services/template-service/src/*` layout.
  Template routes/services still expect auth, validation, logger, prisma, redis, and error-handler support files outside the requested list.
- External dependencies:
  `@prisma/client`, `crypto`, `ejs`, `express`, `handlebars`, `mustache`, `nunjucks`, `winston`
- Missing files needed later:
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/middleware/auth.ts`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/middleware/errorHandler.ts`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/middleware/validation.ts`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/utils/logger.ts`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/utils/prisma.ts`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/utils/redis.ts`
- Files needing decoupling before move:
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/controllers/templates-themes.ts (missing-local:1)`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/routes/templates-themes.ts (missing-local:3)`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/services/template.service.ts (missing-local:1)`
  - `rasid_core_seed_completed/06_template_core/services/template-service/src/services/templates-themes.ts (missing-local:4)`

## 07_schema_contracts

- Extracted rows: 522/522
- Readiness split: production-usable=522, needs-refactor=0, reference-only=0
- Internal dependencies:
  All copied contract files remain under `schemas/{strict,slides,excel,report,dash,rased,lct}` inside the package with no code-layer rewrites.
  These schema assets are self-contained and do not require package alias rewiring.
- External dependencies:
  None detected from copied code files.
- Missing files needed later:
  - None.
- Files needing decoupling before move:
  - None.

## 08_visual_dna

- Extracted rows: 20/20
- Readiness split: production-usable=9, needs-refactor=11, reference-only=0
- Internal dependencies:
  The visual layer keeps the original `client/src/{components,contexts,lib,pages}` layout from the second-project archive.
  Several files still rely on the original frontend alias system (`@/...`) and missing UI/support components, so the shell is visually preserved but not fully decoupled yet.
- External dependencies:
  `clsx`, `lucide-react`, `react`, `tailwind-merge`, `wouter`
- Missing files needed later:
  - `rasid_core_seed_completed/08_visual_dna/client/src/_core/hooks/useAuth.ts`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/AddSourceDialog.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/AnalyticsDialog.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ShareDialog.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ui/avatar.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ui/button.ts`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ui/dropdown-menu.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ui/sidebar.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ui/skeleton.ts`
  - `rasid_core_seed_completed/08_visual_dna/client/src/const.ts`
  - `rasid_core_seed_completed/08_visual_dna/client/src/contexts/AuthContext.tsx`
  - `rasid_core_seed_completed/08_visual_dna/client/src/hooks/useMobile.ts`
- Files needing decoupling before move:
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ChatCanvas.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/DashboardLayout.tsx (missing-local:1, alias-coupling:6)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/DashboardLayoutSkeleton.tsx (missing-local:1)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/DataPanel.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/ErrorBoundary.tsx (alias-coupling:1)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/NotebookHeader.tsx (alias-coupling:3)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/SettingsMenu.tsx (alias-coupling:1)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/StudioPanel.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/StudioToolDialog.tsx (alias-coupling:1)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/components/WorkspaceView.tsx (alias-coupling:2)`
  - `rasid_core_seed_completed/08_visual_dna/client/src/pages/Home.tsx (alias-coupling:13)`
