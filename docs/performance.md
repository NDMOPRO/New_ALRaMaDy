# Performance Architecture

## Current Performance Design

The repo does not implement a separate distributed performance layer. Performance behavior is mostly shaped by:

- in-process engine execution
- filesystem reads/writes under `.runtime`
- embedded HTML pages with direct fetch calls
- optional websocket updates for dashboard interactivity
- optional standalone product servers for narrower workflows

## Existing Performance-Oriented Features

### Dashboard performance endpoints

`dashboard-web.ts` exposes dedicated performance-related routes:

- `/api/v1/dashboards/perf/cache/prime`
- `/api/v1/dashboards/perf/cache/fallback`
- `/api/v1/dashboards/perf/metrics`
- `/api/v1/dashboards/perf/load-model`
- `/api/v1/dashboards/perf/concurrency`
- `/api/v1/dashboards/perf/websocket-burst`

These indicate explicit testing and modeling around cache warmup, concurrency, load behavior, and websocket fanout.

### File-based stores

Store classes keep bundle files grouped by entity, which simplifies retrieval by ID and reduces the need for scanning global state, but it also means write amplification can grow with large artifact sets.

### Export-heavy engines

Report, presentation, localization, and Excel flows generate multiple artifacts per run. Performance is therefore sensitive to:

- file serialization size
- export/parity work
- external process bridges
- repeated checksum generation

## Expected Bottlenecks

| Area | Likely bottleneck |
| --- | --- |
| `dashboard-web.ts` | single-process route monolith and large in-memory page templates |
| filesystem stores | synchronous file I/O in hot paths |
| presentation/report exports | document generation and parity validation cost |
| transcription | Python bridge and content extraction latency |
| `apps/rasid-web` AI routes | external API round-trips and large prompt payloads |

## Performance Risks

- synchronous `fs` calls are used extensively in store implementations
- very large gateway files reduce locality and complicate targeted optimization
- multiple parallel platform servers duplicate auth/render overhead instead of sharing a cached gateway layer
- no shared queue or worker system is present for heavy background execution

## Practical Guidance

When troubleshooting latency:

1. identify whether the slow path is gateway routing, engine work, export generation, or store persistence
2. inspect the corresponding `.runtime` directory for run size and artifact count
3. check whether the flow is doing local-only work or calling external providers
4. prefer narrowing to a standalone platform server if the unified gateway is adding unnecessary surface overhead

