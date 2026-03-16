# Data Flows

Diagram sources:

- `docs/diagrams/dataflow-request-lifecycle.mmd`
- `docs/diagrams/dataflow-document-ingestion.mmd`
- `docs/diagrams/dataflow-cross-engine-pipeline.mmd`

## 1. Request Lifecycle

For the active monorepo gateway, a typical write request follows this path:

1. browser hits a top-level page and runs embedded client-side fetch logic
2. request is sent to `/api/v1/...`
3. gateway authenticates and builds a governance actor context
4. governance policy decides allow, deny, or approval-required
5. downstream engine executes the domain workflow
6. engine store persists bundles, artifacts, evidence, audit events, and lineage
7. gateway returns JSON including IDs, state, and next `open_path`

This same structure repeats across dashboard publish/share/schedule, transcription start, report conversions, and AI jobs.

## 2. Document Ingestion and Transcription

The transcription path is the closest thing to an ingestion pipeline in the repo:

1. user submits a file or reference
2. `TranscriptionExtractionEngine` determines input kind
3. Python bridge or extraction helpers process OCR/transcription/content extraction
4. engine builds:
   - unified content bundle
   - transcript segments
   - summaries
   - extracted fields/entities/tables
   - verification and disagreement records
5. `TranscriptionExtractionStore` writes the bundle under `.runtime/transcription-extraction-engine`
6. downstream routes can convert the resulting bundle into reports

## 3. Report Generation Pipeline

There are two main report entry patterns in the current code:

- direct report creation/import through `ReportEngine`
- report creation from transcription bundle via unified gateway bridge or standalone report platform

Core report flow:

1. collect request sections or imported structure
2. build report, version, layout, sections, blocks, binding set, review state, and approval state
3. persist state via `ReportEngineStore`
4. expose refresh, compare, review, approve, publish, schedule, export, and downstream conversion actions

## 4. Presentation Generation Pipeline

Presentation flow in `PresentationEngine`:

1. accept prompt, text, dataset, report, dashboard, or binary file sources
2. build intent manifest and outline
3. generate storyboard, slide blocks, notes, bindings, template lock state, and output metadata
4. run parity/export generation
5. persist bundle through `PresentationEngineStore`
6. publish public view and optional comments/analytics/events

## 5. Dashboard Pipeline

Dashboard flow in `DashboardEngine`:

1. validate create/mutate/refresh/interaction request
2. build dashboard object, version, bindings, layouts, interaction rules, and publication metadata
3. persist through `DashboardEngineStore`
4. optionally publish/share/schedule and expose compare results
5. allow downstream localization and strict replication consumption

## 6. Localization Pipeline

The localization engine treats artifacts as typed, editable source bundles:

1. receive source artifact + canonical content + policy
2. resolve terminology, protected terms, and non-translatable terms
3. build direction transformation and typography refinement plans
4. run language, layout, cultural, and editability quality gates
5. persist localized artifacts and quality evidence
6. optionally feed localized output back into dashboard/runtime publication flows

## 7. Cross-Engine Continuation

The unified gateway contains explicit continuation paths:

- transcription -> report
- report -> presentation
- report -> dashboard
- presentation -> dashboard
- dashboard -> localization
- dashboard -> strict replication

This is a critical architecture characteristic: product surfaces are not isolated islands. The gateway is intentionally a cross-engine continuation hub.

## Diagrams

See:

- `docs/diagrams/dataflow-request-lifecycle.mmd`
- `docs/diagrams/dataflow-document-ingestion.mmd`
- `docs/diagrams/dataflow-cross-engine-pipeline.mmd`

