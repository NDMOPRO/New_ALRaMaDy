# rasid-platform-core

Core baseline monorepo/workspace for Rasid shared platform models.

## Included shared packages
- common
- contracts
- runtime
- artifacts
- jobs
- evidence
- audit-lineage
- library
- brand-template
- canvas-contract
- permissions
- connectors
- output-publication
- capability-registry

## Commands
```bash
npm run build
npm run typecheck
npm run lint
npm run check:boundaries
npm run test:smoke
npm run check
npm start
```

This baseline intentionally excludes capabilities and UI; it enforces shared typed/versioned contracts only.
