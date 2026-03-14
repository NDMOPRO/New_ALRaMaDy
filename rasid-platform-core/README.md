# rasid-platform-core

Baseline monorepo/workspace for Rasid shared contracts.

## Included baseline
- monorepo workspace structure (`packages/*`, `apps/*`)
- shared contracts as TypeScript + Zod schemas in `packages/shared-contracts/src/contracts`
- versioned JSON schemas in `packages/shared-contracts/schemas/v1`
- action registry in `packages/shared-contracts/src/registry/actionRegistry.json`
- runnable CLI bootstrap in `apps/contracts-cli/index.mjs`

## Run
```bash
npm run build
npm start
```
