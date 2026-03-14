# Knowledge Base

## Confirmed facts only

### Initial entry
- Date: 2026-03-15T01:06:43+03:00
- Notes: Local folder `C:\ALRaMaDy` existed but was not a Git repository at session start.

### Services

### Pages

### Engines

- Date: 2026-03-15T01:08:47+03:00
- `SHARED_CONTRACTS_PACK.md` is now the repository-level blocking contract pack for Rasid foundational execution.
- The pack freezes: canonical representation, artifact, job lifecycle, action runtime, tool registry, evidence, audit, library, mode, degrade, template/brand, source, publication, canvas, and permission contracts.
- The pack explicitly forbids detached mini-products and capability-private replacements for artifact/job/state models.

- Date: 2026-03-15T01:22:12+03:00
- `rasid-platform-core` now contains executable shared foundation packages under `packages/` for contracts, runtime, artifacts, jobs, evidence, audit-lineage, library, brand-template, canvas-contract, permissions, and connectors.
- Root workspace build now compiles all shared packages with TypeScript project references.
- Guardrails are enforced by scripts that check contract versions, shared-model duplication, and workspace import boundaries.
- The CLI bootstrap in `apps/contracts-cli` successfully loads the shared schemas and registry bootstrap at runtime.

- Date: 2026-03-15T01:27:50+03:00
- The workspace package list now matches the required baseline names exactly: `common`, `contracts`, `runtime`, `artifacts`, `jobs`, `evidence`, `audit-lineage`, `library`, `brand-template`, `canvas-contract`, `permissions`, `connectors`, `output-publication`, `capability-registry`.
- Root scripts now expose `build`, `typecheck`, `lint`, `test:smoke`, `check`, and `start`.
- Smoke tests load the built shared packages from `dist` and validate registry bootstrap plus representative schema parsing.

### Routes

### Data stores

### Integrations
- Date: 2026-03-15T01:06:43+03:00
- Confirmed remote repository target: `https://github.com/NDMOPRO/New_ALRaMaDy.git`
- Remote is reachable and exposes `main` as a branch plus additional `codex/*` branches.

- Date: 2026-03-15T01:07:44+03:00
- Local Git repository initialized with branch `main`
- Remote `origin` added and configured for fetch/push to `https://github.com/NDMOPRO/New_ALRaMaDy.git`
- Local `main` is set to track `origin/main`

### Missing links

### Partial implementations
- Date: 2026-03-15T01:06:43+03:00
- Local folder has not yet been initialized with Git metadata.

- Date: 2026-03-15T01:07:44+03:00
- Status: superseded
- Superseded by: Local Git repository initialized and aligned to `origin/main`
- Date superseded: 2026-03-15T01:07:44+03:00

### Dead / demo / mock areas

### Risks
- Date: 2026-03-15T01:06:43+03:00
- If remote history is fetched into a non-empty untracked folder, file conflicts may need manual resolution.

- Date: 2026-03-15T01:08:47+03:00
- Contract drift across parallel teams remains the main implementation risk unless schema registry governance and conformance checks are enforced at write boundaries.

### Evidence
- Date: 2026-03-15T01:06:43+03:00
- `git rev-parse --is-inside-work-tree` returned `fatal: not a git repository`.
- `git ls-remote https://github.com/NDMOPRO/New_ALRaMaDy.git` returned refs including `refs/heads/main`.

- Date: 2026-03-15T01:07:44+03:00
- `git checkout -B main --track origin/main` succeeded
- `git remote show origin` confirmed `HEAD branch: main` and `main pushes to main (up to date)`

- Date: 2026-03-15T01:08:47+03:00
- `SHARED_CONTRACTS_PACK.md` was rewritten to match the user-requested deliverable structure and freeze all required platform-wide contracts.

- Date: 2026-03-15T01:22:12+03:00
- `npm install`, `npm run build`, `npm run check`, and `npm start` succeeded inside `C:\ALRaMaDy\rasid-platform-core`.

- Date: 2026-03-15T01:27:50+03:00
- `npm run typecheck`, `npm run lint`, `npm run test:smoke`, and `npm run check` all succeeded after adding the final required packages.

### Superseded findings
- Preserve old findings here when needed
