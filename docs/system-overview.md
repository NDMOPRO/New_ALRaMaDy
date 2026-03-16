# Rasid System Overview

## Purpose

This repository contains the Rasid platform's active runtime monorepo in `rasid-platform-core/` plus supporting seed material and proof artifacts. The active codebase is a contract-first, engine-oriented platform for:

- data intake and dataset registration
- transcription and document understanding
- governed report generation
- governed presentation generation
- dashboard authoring, compare, publish, and sharing
- Arabic localization
- strict visual/layout replication
- AI-assisted orchestration across those capabilities

The current production-style entrypoint is the unified Node HTTP server in `rasid-platform-core/apps/contracts-cli/src/dashboard-web.ts`.

## Repository Boundaries

The workspace root is not a single deployable app. It contains:

- `rasid-platform-core/`: the active deployable monorepo
- `docs/audit/`: durable analysis history and checkpoints
- `rasid_core_seed/`: earlier seed/reference material, not the active runtime
- `.runtime/`, `.tmp*`, deployment clones, screenshots, and worktrees: generated artifacts and proof material, not containers

## Architectural Style

The active system combines four patterns:

1. Contract-first domain modeling in `packages/contracts`
2. Engine packages that validate requests and persist runtime bundles under `.runtime/`
3. Thin bootstrap/runtime layers that register capabilities, actions, tools, approvals, and evidence hooks
4. Hand-written HTTP surfaces that expose unified pages and product APIs over the engines

## Runtime Modes

There are two parallel application styles in the repo.

### 1. Active platform monorepo

This is the deployable path today.

- Entry: `apps/contracts-cli`
- Main server: `dashboard-web.ts`
- Additional servers: `transcription-web.ts`, `report-engine/src/platform.ts`, `presentations-engine/src/platform.ts`
- Persistence: `.runtime/*` filesystem trees, generated exports, local backend folders

### 2. Imported design/full-stack app

This is present but not the active deploy target.

- App: `apps/rasid-web`
- Client: React + Vite + Wouter + tRPC client
- Server: Express + tRPC + upload routes
- Persistence: local sql.js SQLite database plus optional MySQL/Drizzle schema for slide-library metadata

## High-Level Runtime Summary

The current architecture is centered on a unified gateway that coordinates shared engines:

- `dashboard-web.ts` exposes top-level pages such as `/home`, `/data`, `/transcription`, `/dashboards`, `/reports`, `/presentations`, `/library`, and `/governance`
- the gateway invokes `DashboardEngine`, `ReportEngine`, `PresentationEngine`, `TranscriptionExtractionEngine`, `RasidAiEngine`, `GovernanceEngine`, `ArabicLocalizationLctEngine`, and `StrictReplicationEngine`
- each engine writes durable bundles to `.runtime/<engine>/...`
- governance wrappers are used around the write paths exposed by the unified gateway
- AI orchestration routes prompts to downstream engines and stores execution evidence, audit events, and lineage edges

## Key Architectural Observations

- There is no single shared relational operational database for the active monorepo. The main platform persists to the filesystem.
- The repo has multiple HTTP servers because some product packages still own their own standalone platform wrappers.
- `apps/rasid-web` duplicates product behavior with local app-specific storage and has not yet been reduced to adapters over the shared engines.
- The strongest architectural center of gravity is `packages/contracts` + engine packages + `apps/contracts-cli`.

## Primary Code Areas

| Area | Role |
| --- | --- |
| `rasid-platform-core/apps/contracts-cli` | Bootstrap CLI and current deployed unified web/transcription servers |
| `rasid-platform-core/packages/contracts` | Shared schemas, action definitions, tool contracts, domain types |
| `rasid-platform-core/packages/capability-registry` | Capability/action/tool registration bootstrap |
| `rasid-platform-core/packages/runtime` | Approval and evidence hook runtime types |
| `rasid-platform-core/packages/*-engine` | Product/domain engines and local persistence stores |
| `rasid-platform-core/apps/rasid-web/client` | Separate React workspace shell UI |
| `rasid-platform-core/apps/rasid-web/server` | Separate Express/tRPC backend with local storage/auth |

## Reading Order

For architectural onboarding, read the documents in this order:

1. `c4-context.md`
2. `c4-containers.md`
3. `c4-components.md`
4. `c4-code.md`
5. `dataflows.md`
6. `database.md`
7. `infrastructure.md`

