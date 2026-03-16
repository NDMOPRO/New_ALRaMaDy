# C4 Level 1: System Context

Diagram source: `docs/diagrams/system-context.mmd`

## System Purpose

Rasid is a multi-capability data operations platform for ingesting source material, extracting structured content, generating governed outputs, and publishing downstream artifacts. It combines authoring, AI assistance, governance, evidence capture, and cross-engine continuation inside one repository.

## Primary Actors

| Actor | Goal |
| --- | --- |
| Data analyst / operator | Register datasets, inspect outputs, create dashboards, convert outputs |
| Report or presentation author | Build, update, review, and publish governed narrative deliverables |
| Governance/admin user | Control roles, approvals, evidence, policy decisions, and audit surfaces |
| Public viewer | Open published reports and presentations through public routes |
| Platform engineer | Extend shared contracts, engines, and HTTP surfaces |

## External Systems

| External system | Current role |
| --- | --- |
| OpenAI Chat Completions API | Direct chat and vision calls in `apps/rasid-web/server/openai.ts` |
| Forge API services | LLM fallback, storage proxy, and data API bridge in `apps/rasid-web/server/_core/*` |
| Internal speech transcription endpoint | Audio transcription through `/v1/audio/transcriptions` on the Forge base URL |
| Optional MySQL database | Backing store for `apps/rasid-web/server/db.ts` and the Drizzle slide-library schema |
| Railway/Nixpacks runtime | Deploys the monorepo unified gateway |
| Browser clients | Consume the unified pages, tRPC app UI, and public published views |

## Context Narrative

The active deployed platform is the unified gateway in `apps/contracts-cli`. Users access top-level surfaces such as `/data`, `/transcription`, `/dashboards`, `/reports`, `/presentations`, `/library`, and `/governance`. Those routes orchestrate shared engines that persist results under `.runtime/` and expose evidence, audit, lineage, publication, and continuation links.

Separately, the repository also contains `apps/rasid-web`, a richer full-stack application shell that uses local app-specific storage and tRPC procedures. It is important for architecture because it introduces a second UI/server boundary and the only conventional relational schema in the current repo.

## System Context Diagram

See `docs/diagrams/system-context.mmd`.

