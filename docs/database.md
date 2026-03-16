# Database Architecture

Diagram source: `docs/diagrams/database-erd.mmd`

## Important Boundary

The active monorepo does not use a single central database for its main runtime flows. Its primary persistence model is filesystem-backed JSON/artifact storage under `.runtime/`.

The only relational/SQL layers in the repo are inside `apps/rasid-web`:

- embedded sql.js SQLite in `server/localDb.ts`
- optional MySQL/Drizzle schema in `drizzle/schema.ts` accessed through `server/db.ts`

## A. Filesystem Runtime Stores

These are the primary stores for the active monorepo:

| Store root | Purpose |
| --- | --- |
| `.runtime/dashboard-engine` | dashboard states, compare bundles, publications, schedules |
| `.runtime/report-engine` | report states, publications, schedules, orchestration and transport records |
| `.runtime/presentations-engine` | deck bundles, exports, parity records, publications |
| `.runtime/transcription-extraction-engine` | extraction bundles, transcripts, summaries, compare bundles |
| `.runtime/ai-engine` | AI sessions, plans, jobs, evidence |
| `.runtime/governance-engine` | approvals, policy decisions, evidence, lineage, audit |

These stores behave like operational databases even though they are file trees.

## B. `rasid-web` sql.js Schema

Defined imperatively in `apps/rasid-web/server/localDb.ts`.

### Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | local app accounts | `id`, `userId`, `passwordHash`, `role`, `permissions` |
| `files` | uploaded file catalog | `userId`, `title`, `filePath`, `mimeType`, `metadata`, `tags` |
| `reports` | local app report records | `userId`, `title`, `sections`, `classification`, `entity`, `status` |
| `presentations` | local app presentation records | `userId`, `title`, `slides`, `theme`, `status` |
| `dashboards` | local app dashboard records | `userId`, `title`, `widgets`, `layout`, `status` |
| `spreadsheets` | local app spreadsheet records | `userId`, `title`, `sheets`, `status` |
| `chat_history` | AI/chat session history | `userId`, `sessionId`, `role`, `content`, `metadata` |
| `translations` | stored translation outputs | `userId`, `sourceText`, `translatedText`, `sourceLang`, `targetLang` |
| `extractions` | stored extraction outputs | `userId`, `sourceType`, `sourceFile`, `structuredData`, `status` |
| `shared_presentations` | public/share links | `presentationId`, `userId`, `shareToken`, `password`, `viewCount`, `expiresAt` |

### Relationships

- `users` -> many `files`
- `users` -> many `reports`
- `users` -> many `presentations`
- `users` -> many `dashboards`
- `users` -> many `spreadsheets`
- `users` -> many `chat_history`
- `users` -> many `translations`
- `users` -> many `extractions`
- `presentations` -> many `shared_presentations`
- `users` -> many `shared_presentations`

### Indexes and constraints

- primary keys on all tables
- `users.userId` unique
- `shared_presentations.shareToken` unique
- no explicit secondary indexes are created in `localDb.ts`

## C. `rasid-web` Drizzle/MySQL Schema

Defined in `apps/rasid-web/drizzle/schema.ts`.

### Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | external/OAuth-backed users | `openId`, `name`, `email`, `loginMethod`, `role` |
| `slide_templates` | uploaded PPTX template files | `name`, `fileUrl`, `fileKey`, `status`, `uploadedBy` |
| `element_categories` | slide element taxonomy | `slug`, `nameAr`, `nameEn`, `icon`, `sortOrder` |
| `slide_elements` | reusable decomposed slide elements | `templateId`, `categoryId`, `designTemplate`, `styleProperties`, `htmlTemplate` |
| `element_usage_rules` | matching rules for AI generation | `elementId`, `triggerContext`, `priority`, `isActive` |

### Relationships

Declared in `drizzle/relations.ts`:

- `users` -> many `slide_templates` through `uploadedBy`
- `slide_templates` -> many `slide_elements`
- `element_categories` -> many `slide_elements`
- `slide_elements` -> many `element_usage_rules`

### Indexes and constraints

- primary keys on all tables
- `users.openId` unique
- `element_categories.slug` unique
- the inspected migration file does not create additional secondary indexes

## D. Entity Relationship Diagram

See `docs/diagrams/database-erd.mmd`.

## Architecture Implications

- Engineers working on the active monorepo should treat `.runtime` stores as the main operational persistence surface.
- Engineers working on `apps/rasid-web` need to reason about two separate database models: sql.js for local app state and optional MySQL for the template-library path.
- There is currently no unified persistence layer shared between `apps/rasid-web` and the engine packages.

