# Deployment

## Primary Deployment Path

The active deployment path is the monorepo unified gateway.

### Build and start

From `rasid-platform-core/`:

```bash
npm ci
npx tsc -b tsconfig.json
node apps/contracts-cli/dist/index.js dashboard-serve-web
```

This matches `nixpacks.toml`:

- install: `npm ci`
- build: `npx tsc -b tsconfig.json`
- start: `node apps/contracts-cli/dist/index.js dashboard-serve-web`

## Other Deployable Processes

### Transcription server

```bash
node apps/contracts-cli/dist/index.js transcription-serve-web
```

### Report platform

```bash
node apps/contracts-cli/dist/index.js report-start-platform
```

### Presentations platform

```bash
node apps/contracts-cli/dist/index.js presentations-serve-app
```

### Excel backend service

```bash
node scripts/excel-backend-server.mjs
```

## `apps/rasid-web` Deployment Shape

This app is deployable separately but is not the active production path in the current repo narrative.

Build:

```bash
vite build
esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

Start:

```bash
node dist/index.js
```

## Deployment Notes

- the current Railway deployment evidence points to `dashboard-serve-web` as the correct long-lived process
- product-specific platform servers remain useful for isolated testing and proof runs
- because major state is filesystem-backed, deployments need writable local storage
- `apps/rasid-web` and the monorepo gateway are not yet unified behind one deployment topology

## Recommended Deployment Mental Model

Treat the repo as:

1. one primary deployed platform server
2. several auxiliary product-specific servers for focused workflows and regression proof
3. one separate full-stack app that still needs adapter integration work before it can replace the current gateway

