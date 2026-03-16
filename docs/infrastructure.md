# Infrastructure Architecture

Diagram source: `docs/diagrams/integration-map.mmd`

## Runtime Topology

The current infrastructure is lightweight and process-oriented.

- one Node process can run the unified gateway via `dashboard-serve-web`
- separate Node processes can run the report platform, presentation platform, transcription server, or Excel backend service
- each process uses local filesystem persistence under `.runtime/` and adjacent backend folders

## Main Runtime Directories

| Path pattern | Purpose |
| --- | --- |
| `rasid-platform-core/.runtime/dashboard-engine` | dashboard state and publication artifacts |
| `rasid-platform-core/.runtime/report-engine` | report state, schedules, orchestration, backend deliveries |
| `rasid-platform-core/.runtime/presentations-engine` | deck state, files, parity, analytics artifacts |
| `rasid-platform-core/.runtime/transcription-extraction-engine` | bundles, transcripts, summaries |
| `rasid-platform-core/.runtime/ai-engine` | AI plans, jobs, evidence |
| `rasid-platform-core/.runtime/governance-engine` | policy/approval/audit/evidence state |
| `rasid-platform-core/.runtime/excel-engine-backend` | Excel backend HTTP object/publication payloads |
| `rasid-platform-core/uploads` | `rasid-web` uploaded files |
| `rasid-platform-core/data/rasid.db` | `rasid-web` sql.js file |

## Background and Sidecar Services

### Excel backend service

`scripts/excel-backend-server.mjs` starts `ExcelBackendService`, which exposes:

- `/health`
- `/services/object-store/manifest`
- `/publications/:id/manifest`
- `/publications/:id/download`
- `/objects/:id/manifest`
- `/objects/:id/download`

This acts like a local object/publication backend for workbook outputs.

### Dashboard websocket endpoint

`dashboard-web.ts` also opens `/ws/dashboards` for live dashboard updates.

## Environment Variables

### Monorepo gateway/runtime

- `PORT`
- `HOST`
- `EXCEL_BACKEND_PORT`

### `apps/rasid-web`

- `DATABASE_URL`
- `JWT_SECRET`
- `OWNER_OPEN_ID`
- `OAUTH_SERVER_URL`
- `OPENAI_API_KEY`
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`
- `VITE_APP_ID`

## External Integration Surfaces

| Integration | Consumed by |
| --- | --- |
| OpenAI chat completions | `apps/rasid-web/server/openai.ts` |
| Forge chat completions fallback | `apps/rasid-web/server/_core/llm.ts` |
| Forge storage upload/download | `apps/rasid-web/server/storage.ts` |
| Forge data API bridge | `apps/rasid-web/server/_core/dataApi.ts` |
| Forge audio transcription | `apps/rasid-web/server/_core/voiceTranscription.ts` |
| Optional OAuth provider/sdk flow | `apps/rasid-web/server/_core/oauth.ts` |

## Infrastructure Characteristics

- stateful local filesystem design
- multiple product-specific HTTP wrappers rather than one shared reverse proxy
- deploy-friendly single process for the unified gateway
- minimal explicit infrastructure-as-code in repo; deployment is mostly package scripts and Nixpacks config

