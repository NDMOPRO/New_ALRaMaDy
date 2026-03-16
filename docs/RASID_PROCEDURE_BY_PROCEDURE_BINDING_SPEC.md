# Rasid Procedure-by-Procedure Binding Spec

هذا الملف هو النسخة الأكثر تفصيلاً.

يجب استخدامه عند تنفيذ الربط الفعلي.

لا يسمح هذا الملف بأي اجتهاد في:
- أسماء الـ procedures
- أسماء الـ namespaces
- أسماء المتغيرات الأساسية
- الجهة المالكة لكل إجراء

## 1. القاعدة التنفيذية

كل `procedure` يجب أن يجيب على الأسئلة التالية:

1. من الذي يستدعيه في الواجهة؟
2. ما الـ input الحالي حرفيًا؟
3. ما الـ output الحالي أو المتوقع؟
4. ما المحرك الخلفي الذي يجب أن يملكه؟
5. هل الإجراء:
   - قراءة فقط
   - كتابة
   - generate
   - publish
   - approve
   - export
   - compare
6. ما الذي يجب أن ينتج معه من:
   - `artifact`
   - `job`
   - `evidence`
   - `audit`
   - `lineage`

## 2. قاموس الأنواع الحاكمة

### Runtime ownership

- `auth/session`
  - identity + session + tenant + workspace access
- `source/artifact`
  - file/source/workbook/report/dashboard/deck records
- `job`
  - async lifecycle state
- `evidence`
  - verification checks and reproducibility
- `audit`
  - activity + approval + AI acceptance/rejection
- `lineage`
  - cross-artifact dependency and transformation graph
- `publication`
  - public/private published outputs

### Engine ownership

- `DashboardEngine`
- `ReportEngine`
- `PresentationEngine`
- `ExcelEngine`
- `TranscriptionExtractionEngine`
- `RasidAiEngine`
- `GovernanceEngine`
- `Library`
- `Permissions`
- `OutputPublication`

## 3. Frontend call sites inventory

المصادر الرئيسية التي تستدعي الإجراءات:

- [useAuth.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/_core/hooks/useAuth.ts)
- [AuthContext.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/contexts/AuthContext.tsx)
- [Home.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/Home.tsx)
- [ChatCanvas.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/ChatCanvas.tsx)
- [AIChatBox.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/AIChatBox.tsx)
- [DashboardEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/DashboardEngine.tsx)
- [ReportsEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/ReportsEngine.tsx)
- [PresentationsEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/PresentationsEngine.tsx)
- [ExcelEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/ExcelEngine.tsx)
- [ExtractionEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/ExtractionEngine.tsx)
- [TranslationEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/TranslationEngine.tsx)
- [VisualMatchEngine.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/VisualMatchEngine.tsx)
- [SlideLibraryManager.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/SlideLibraryManager.tsx)
- [CreateTemplateDialog.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/CreateTemplateDialog.tsx)
- [AdminPanel.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/AdminPanel.tsx)
- [SharedPresentation.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/SharedPresentation.tsx)

## 4. `auth.*`

المصدر: [routers.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/routers.ts)

### `auth.me`
- Called from:
  - `useAuth.ts`
  - `AuthContext.tsx`
- Input:
  - none
- Output:
  - `id`
  - `userId`
  - `displayName`
  - `email`
  - `mobile`
  - `role`
  - `department`
  - `avatar`
  - `status`
  - `permissions`
  - `createdAt`
  - `lastSignedIn`
- Runtime type:
  - read
- Engine owner:
  - `Permissions` + identity/session store
- Required records:
  - audit optional
  - no artifact
  - no job
- Binding note:
  - This procedure is the root truth for user/role/permission hydration in the UI.

### `auth.login`
- Called from:
  - `AuthContext.tsx`
- Input:
  - `userId`
  - `password`
- Output:
  - `success`
  - `error`
  - `user`
- Runtime type:
  - write/session
- Engine owner:
  - identity/auth layer
- Required records:
  - audit event for successful login
  - optional audit event for failed login
- Binding note:
  - must set tenant/workspace context if available
  - must return permission payload coherent with `auth.me`

### `auth.register`
- Called from:
  - `AuthContext.tsx`
- Input:
  - `userId`
  - `password`
  - `displayName`
  - `email`
  - `mobile`
  - `department`
- Runtime type:
  - write
- Engine owner:
  - identity store + permission bootstrap
- Required records:
  - user creation audit
  - role binding creation

### `auth.logout`
- Called from:
  - `useAuth.ts`
  - `AuthContext.tsx`
- Input:
  - none
- Runtime type:
  - session terminate
- Engine owner:
  - session layer

## 5. `files.*`

### `files.list`
- Called from:
  - `Home.tsx`
  - `AIPresentationGenerator.tsx`
  - `LibraryEngine.tsx`
- Input:
  - none
- Output:
  - current UI expects a file list with at least:
    - `id`
    - `title`
    - `type`
    - `status`
    - `icon`
    - `size`
    - `metadata`
    - `tags`
- Runtime type:
  - read
- Engine owner:
  - source registry + artifacts
- Required records:
  - none mandatory
- Binding note:
  - this should not read from local SQL demo storage
  - must aggregate real sources and file-like artifacts

### `files.get`
- Input:
  - `id`
- Runtime type:
  - read
- Engine owner:
  - source/artifact lookup
- Required records:
  - none

### `files.create`
- Input:
  - `title`
  - `type`
  - `category`
  - `status`
  - `icon`
  - `size`
  - `filePath`
  - `mimeType`
  - `metadata`
  - `tags`
- Runtime type:
  - write
- Engine owner:
  - connectors + artifact/source creation
- Required records:
  - `Source`
  - optional `Artifact` if normalized immediately
  - audit event
- Binding note:
  - if this is a raw upload, create `source file` artifact
  - if it is already parsed, create source + normalized artifact

### `files.update`
- Input:
  - `id`
  - `title`
  - `status`
  - `metadata`
  - `tags`
- Runtime type:
  - write
- Engine owner:
  - source/artifact metadata manager
- Required records:
  - audit

### `files.delete`
- Input:
  - `id`
- Runtime type:
  - write
- Engine owner:
  - source/artifact lifecycle
- Required records:
  - audit
- Binding note:
  - prefer archive/soft-delete if artifacts are referenced downstream

### `files.toggleFavorite`
- Input:
  - `id`
- Runtime type:
  - write preference
- Engine owner:
  - user preference layer
- Required records:
  - audit optional

## 6. `reports.*`

### `reports.list`
- Called from:
  - `Home.tsx`
  - `StudioPanel`
  - `ReportsEngine.tsx`
  - `VisualMatchEngine.tsx`
- Input:
  - none
- Runtime type:
  - read
- Engine owner:
  - `ReportEngine`
- Required records:
  - none
- Must return:
  - report identity
  - title
  - status
  - updatedAt
  - enough metadata for cards/listing

### `reports.get`
- Input:
  - `id`
- Runtime type:
  - read
- Engine owner:
  - `ReportEngine`
- Required records:
  - none
- Must return:
  - report content
  - sections
  - status
  - lineage/evidence summary if available

### `reports.create`
- Called from:
  - `ReportsEngine.tsx`
  - `VisualMatchEngine.tsx`
- Input:
  - `title`
  - `description`
  - `reportType`
  - `sections`
  - `classification`
  - `entity`
- Runtime type:
  - write/create
- Engine owner:
  - `ReportEngine.createReport(...)`
- Required records:
  - `Artifact`: report/editable report
  - `Audit`: report.create
  - `Lineage`: source refs if content came from source
  - `Evidence`: initial verification status
- Variable meaning:
  - `reportType`: report subtype
  - `sections`: canonical report blocks
  - `classification`: business/security/report classification
  - `entity`: owning entity or business scope

### `reports.update`
- Called from:
  - `ReportsEngine.tsx`
- Input:
  - `id`
  - `title`
  - `sections`
  - `classification`
  - `entity`
  - `status`
- Runtime type:
  - write/update
- Engine owner:
  - `ReportEngine.updateReport(...)`
- Required records:
  - new version ref
  - audit diff
  - lineage version edge

### `reports.delete`
- Input:
  - `id`
- Runtime type:
  - write/delete
- Engine owner:
  - report lifecycle service
- Required records:
  - audit

## 7. `presentations.*`

### `presentations.list`
- Called from:
  - `Home.tsx`
  - `PresentationsEngine.tsx`
  - `StudioPanel`
- Runtime type:
  - read
- Engine owner:
  - `PresentationEngine`

### `presentations.get`
- Input:
  - `id`
- Runtime type:
  - read
- Engine owner:
  - `PresentationEngine`

### `presentations.create`
- Called from:
  - `PresentationsEngine.tsx`
  - `VisualMatchEngine.tsx`
- Input:
  - `title`
  - `description`
  - `slides`
  - `theme`
- Runtime type:
  - write/create
- Engine owner:
  - `PresentationEngine.createPresentation(...)`
- Required records:
  - deck artifact
  - deck version
  - audit create event
  - evidence baseline
- Variable meaning:
  - `slides`: slide payloads
  - `theme`: template/brand/theme ref

### `presentations.update`
- Called from:
  - `PresentationsEngine.tsx`
- Input:
  - `id`
  - `title`
  - `slides`
  - `theme`
  - `status`
- Runtime type:
  - write/update
- Engine owner:
  - `PresentationEngine`
- Required records:
  - version edge
  - audit diff

### `presentations.delete`
- Input:
  - `id`
- Runtime type:
  - write/delete

### `presentations.share`
- Called from:
  - `PresentationsEngine.tsx`
- Input:
  - `presentationId`
  - `password`
  - `expiresAt`
- Runtime type:
  - publish/share
- Engine owner:
  - output publication + viewer runtime
- Required records:
  - publication record
  - audit share event
  - evidence/publication verification

### `presentations.myShares`
- Runtime type:
  - read
- Engine owner:
  - publication layer

### `presentations.deleteShare`
- Input:
  - `id`
- Runtime type:
  - write
- Engine owner:
  - publication layer

### `presentations.updateShare`
- Input:
  - `id`
  - `isPublic`
  - `password`
- Runtime type:
  - write
- Engine owner:
  - publication layer

### `presentations.viewShared`
- Called from:
  - `SharedPresentation.tsx`
- Input:
  - `token`
  - `password`
- Output currently expected:
  - `error`
  - `needsPassword`
  - `title`
  - `slides`
  - `theme`
  - `brandKit`
  - `viewCount`
- Runtime type:
  - read/publication-view
- Engine owner:
  - public publication runtime
- Required records:
  - public view tracking
  - audit/public analytics

## 8. `dashboards.*`

### `dashboards.list`
- Called from:
  - `Home.tsx`
  - `DashboardEngine.tsx`
  - `VisualMatchEngine.tsx`
- Runtime type:
  - read
- Engine owner:
  - `DashboardEngine`

### `dashboards.get`
- Input:
  - `id`
- Runtime type:
  - read
- Engine owner:
  - `DashboardEngine`

### `dashboards.create`
- Called from:
  - `DashboardEngine.tsx`
  - `VisualMatchEngine.tsx`
- Input:
  - `title`
  - `description`
  - `widgets`
  - `layout`
- Runtime type:
  - write/create
- Engine owner:
  - `DashboardEngine.createDashboard(...)`
- Required records:
  - dashboard artifact
  - audit create
  - evidence baseline
- Variable meaning:
  - `widgets`: widget list
  - `layout`: grid/layout metadata

### `dashboards.update`
- Called from:
  - `DashboardEngine.tsx`
- Input:
  - `id`
  - `title`
  - `widgets`
  - `layout`
  - `status`
- Runtime type:
  - write/update
- Engine owner:
  - `DashboardEngine.updateDashboard(...)`
- Required records:
  - version
  - audit diff

### `dashboards.delete`
- Input:
  - `id`
- Runtime type:
  - write/delete

## 9. `spreadsheets.*`

### `spreadsheets.list`
- Called from:
  - `ExcelEngine.tsx`
  - `VisualMatchEngine.tsx`
- Runtime type:
  - read
- Engine owner:
  - `ExcelEngine`

### `spreadsheets.get`
- Input:
  - `id`
- Runtime type:
  - read
- Engine owner:
  - `ExcelEngine`

### `spreadsheets.create`
- Called from:
  - `ExcelEngine.tsx`
  - `VisualMatchEngine.tsx`
- Input:
  - `title`
  - `description`
  - `sheets`
- Runtime type:
  - write/create
- Engine owner:
  - `ExcelEngine.importWorkbook(...)` or workbook initializer
- Required records:
  - workbook artifact
  - audit create/import
  - evidence baseline
- Variable meaning:
  - `sheets`: workbook sheet payload

### `spreadsheets.update`
- Called from:
  - `ExcelEngine.tsx`
- Input:
  - `id`
  - `title`
  - `sheets`
  - `status`
- Runtime type:
  - write/update
- Engine owner:
  - `ExcelEngine`
- Required records:
  - workbook version
  - audit diff

### `spreadsheets.delete`
- Input:
  - `id`
- Runtime type:
  - write/delete

## 10. `extractions.*`

### `extractions.list`
- Called from:
  - extraction surfaces indirectly
- Runtime type:
  - read
- Engine owner:
  - `TranscriptionExtractionEngine`

### `extractions.create`
- Input:
  - `sourceType`
  - `sourceFile`
  - `extractedText`
  - `structuredData`
  - `language`
- Runtime type:
  - write/create
- Engine owner:
  - `TranscriptionExtractionEngine.ingestAndExtract(...)`
- Required records:
  - source artifact
  - transcript artifact
  - extraction artifact
  - summary artifact
  - job
  - evidence
  - audit
  - lineage

## 11. `translations.*`

### `translations.list`
- Runtime type:
  - read
- Engine owner:
  - localization history

### `translations.create`
- Input:
  - `sourceText`
  - `translatedText`
  - `sourceLang`
  - `targetLang`
  - `type`
- Runtime type:
  - write/create
- Engine owner:
  - `arabic-localization-lct-engine`
- Required records:
  - localized artifact
  - evidence
  - audit
  - lineage
- Binding note:
  - current field `translatedText` exists for UI compatibility
  - authoritative automated value must come from localization engine output

## 12. `chat.*`

### `chat.history`
- Called from:
  - AI/chat surfaces
- Input:
  - `sessionId`
- Runtime type:
  - read
- Engine owner:
  - AI session store

### `chat.addMessage`
- Input:
  - `sessionId`
  - `role`
  - `content`
  - `metadata`
- Runtime type:
  - write
- Engine owner:
  - AI session store
- Required records:
  - audit optional
- Binding note:
  - use for memory/log only
  - should not replace `ai.submitJob`-style governed actions

## 13. `library.*`

### `library.items`
- Called from:
  - `LibraryEngine.tsx`
- Runtime type:
  - read
- Engine owner:
  - `packages/library`
- Must aggregate:
  - files
  - reports
  - presentations
  - dashboards
  - templates
  - brand assets

## 14. `slideLibrary.*`

المصدر: [libraryRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/libraryRouter.ts)

### `slideLibrary.getCategories`
- Called from:
  - `SlideLibraryManager.tsx`
- Runtime type:
  - read
- Engine owner:
  - library/template catalog

### `slideLibrary.getTemplates`
- Called from:
  - `SlideLibraryManager.tsx`
- Runtime type:
  - read
- Engine owner:
  - template library

### `slideLibrary.getElementsByCategory`
- Input:
  - `categoryId`
  - `activeOnly`
- Runtime type:
  - read
- Engine owner:
  - slide element library

### `slideLibrary.getAllElements`
- Called from:
  - `SlideLibraryManager.tsx`
  - `AdminPanel.tsx`
- Input:
  - optional `activeOnly`
- Runtime type:
  - read
- Engine owner:
  - slide element library

### `slideLibrary.getElementsForContext`
- Input:
  - `triggerContext`
- Runtime type:
  - read
- Engine owner:
  - library recommendation/context resolver
- Required records:
  - none

### `slideLibrary.uploadTemplate`
- Called from:
  - `SlideLibraryManager.tsx`
- Input:
  - `name`
  - `description`
  - `fileBase64`
  - `fileName`
- Runtime type:
  - write/import
- Engine owner:
  - template library ingestion
- Required records:
  - template asset
  - extracted slide elements
  - audit import
- Binding note:
  - current implementation parses PPTX and decomposes slides
  - this should eventually integrate with shared library/asset contracts

### `slideLibrary.updateElement`
- Called from:
  - `SlideLibraryManager.tsx`
  - `TemplateEditor.tsx`
- Input:
  - `id`
  - `name`
  - `description`
  - `categoryId`
  - `isActive`
  - `qualityRating`
  - `htmlTemplate`
  - `designTemplate`
  - `styleProperties`
  - `contentSlots`
- Runtime type:
  - write/update
- Engine owner:
  - template/element library
- Required records:
  - audit diff

### `slideLibrary.updateUsageRules`
- Input:
  - `elementId`
  - `rules[]`
    - `triggerContext`
    - `ruleDescription`
    - `priority`
    - `isActive`
- Runtime type:
  - write/update
- Engine owner:
  - template/element rules layer
- Required records:
  - audit diff

### `slideLibrary.deleteTemplate`
- Input:
  - `id`
- Runtime type:
  - write/delete
- Engine owner:
  - template library
- Required records:
  - audit

### `slideLibrary.createElement`
- Called from:
  - `CreateTemplateDialog.tsx`
- Input:
  - `name`
  - `description`
  - `categoryId`
  - `htmlTemplate`
  - `designTemplate`
  - `styleProperties`
  - `contentSlots`
- Runtime type:
  - write/create
- Engine owner:
  - template/element library
- Required records:
  - asset create audit

### `slideLibrary.getElement`
- Input:
  - `id`
- Runtime type:
  - read
- Engine owner:
  - template/element library

### `slideLibrary.deleteElement`
- Called from:
  - `SlideLibraryManager.tsx`
- Input:
  - `id`
- Runtime type:
  - write/delete
- Engine owner:
  - template/element library

### `slideLibrary.convertPptxToHtml`
- Called from:
  - `CreateTemplateDialog.tsx`
- Input:
  - `slideDescription`
  - `slideName`
  - `categorySlug`
- Runtime type:
  - AI-assisted generation
- Engine owner:
  - AI + template library
- Required records:
  - AI generation audit

### `slideLibrary.getStats`
- Called from:
  - `SlideLibraryManager.tsx`
- Runtime type:
  - read
- Engine owner:
  - template library analytics

## 15. `admin.*`

### `admin.users`
- Called from:
  - `AdminPanel.tsx`
- Runtime type:
  - read
- Engine owner:
  - admin/permissions

### `admin.stats`
- Called from:
  - `AdminPanel.tsx`
- Runtime type:
  - read
- Engine owner:
  - governance/admin aggregation

### `admin.recentActivity`
- Called from:
  - `AdminPanel.tsx`
  - `Profile.tsx`
- Runtime type:
  - read
- Engine owner:
  - audit feed

### `admin.allContent`
- Called from:
  - `AdminPanel.tsx`
- Runtime type:
  - read
- Engine owner:
  - artifact aggregation

## 16. `ai.*`

المصدر: [aiRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/aiRouter.ts)

### `ai.status`
- Called from:
  - `useAI.ts`
- Runtime type:
  - read
- Engine owner:
  - `RasidAiEngine` health/provider layer

### `ai.chat`
- Called from:
  - `AIChatBox.tsx`
  - `ChatCanvas.tsx`
  - `AIPresentationGenerator.tsx`
  - `VisualMatchEngine.tsx`
  - `useAI.ts`
- Input:
  - `messages[]`
    - `role`
    - `content`
  - `context`
- Runtime type:
  - AI assist
- Engine owner:
  - `RasidAiEngine.submitJob(...)`
- Required records:
  - job
  - audit
  - evidence
- Binding note:
  - never leave this as plain chat only if user accepted an apply action

### `ai.generateSlides`
- Called from:
  - `PresentationsEngine.tsx`
  - `useAI.ts`
- Input:
  - `prompt`
  - `slideCount`
  - `style`
- Runtime type:
  - generate
- Engine owner:
  - `RasidAiEngine` + `PresentationEngine`
- Required records:
  - job
  - deck artifact draft
  - evidence

### `ai.generateReport`
- Called from:
  - `ReportsEngine.tsx`
  - `useAI.ts`
- Input:
  - `prompt`
  - `reportType`
- Runtime type:
  - generate
- Engine owner:
  - `RasidAiEngine` + `ReportEngine`
- Required records:
  - job
  - report draft artifact
  - evidence

### `ai.analyzeDashboard`
- Called from:
  - `DashboardEngine.tsx`
  - `useAI.ts`
- Input:
  - `prompt`
  - `currentWidgets`
- Runtime type:
  - analyze/suggest
- Engine owner:
  - `RasidAiEngine` + `DashboardEngine`
- Required records:
  - job
  - evidence
  - audit

### `ai.analyzeData`
- Called from:
  - `ExcelEngine.tsx`
  - `useAI.ts`
- Input:
  - `prompt`
  - `data`
  - `columns`
- Runtime type:
  - analyze
- Engine owner:
  - `RasidAiEngine`

### `ai.matchSuggest`
- Called from:
  - `useAI.ts`
- Input:
  - `prompt`
  - `sourceData`
  - `targetData`
- Runtime type:
  - compare/match
- Engine owner:
  - strict/CDR matching runtime

### `ai.translate`
- Called from:
  - `TranslationEngine.tsx`
  - `useAI.ts`
- Input:
  - `text`
  - `from`
  - `to`
  - `mode`
  - `glossary`
- Runtime type:
  - generate/transform
- Engine owner:
  - `arabic-localization-lct-engine`
- Required records:
  - job
  - localized artifact
  - evidence
  - audit

### `ai.summarize`
- Called from:
  - `ExtractionEngine.tsx`
  - `useAI.ts`
- Input:
  - `text`
  - `maxLength`
- Runtime type:
  - summarize
- Engine owner:
  - `RasidAiEngine`

### `ai.extractFromImage`
- Input:
  - `imageBase64`
  - `extractionType`
  - `language`
- Runtime type:
  - extract
- Engine owner:
  - `TranscriptionExtractionEngine`
- Required records:
  - job
  - extraction artifact
  - evidence

### `ai.visualMatch`
- Called from:
  - `VisualMatchEngine.tsx`
- Input:
  - `imageBase64`
  - `outputType`
  - `additionalInstructions`
- Runtime type:
  - replicate/generate
- Engine owner:
  - strict replication path
  - plus target engine according to `outputType`
- Required records:
  - job
  - artifact
  - evidence
  - audit
  - lineage

### `ai.generateSlidesFromContent`
- Called from:
  - `PresentationsEngine.tsx`
- Input:
  - `content`
  - `sourceType`
  - `slideCount`
  - `style`
  - `language`
- Runtime type:
  - generate
- Engine owner:
  - `RasidAiEngine` + `PresentationEngine`

### `ai.textOperation`
- Called from:
  - `PresentationsEngine.tsx`
- Input:
  - `text`
  - `operation`
  - `targetLanguage`
  - `style`
- Runtime type:
  - transform
- Engine owner:
  - `RasidAiEngine`
  - localization when operation is translation

### `ai.generateQuiz`
- Called from:
  - `PresentationsEngine.tsx`
- Input:
  - `topic`
  - `questionCount`
  - `type`
- Runtime type:
  - generate interaction content
- Engine owner:
  - presentation interaction layer

### `ai.generatePresentation`
- Called from:
  - `AIPresentationGenerator.tsx`
- Input:
  - `topic`
  - `slideCount`
  - `brandId`
  - `language`
  - `contentSource`
  - `userContent`
  - `strictContent`
- Runtime type:
  - generate
- Engine owner:
  - `RasidAiEngine`
  - `PresentationEngine`
  - brand/template library
- Required records:
  - AI generation job
  - deck artifact
  - evidence
  - audit

### `ai.deepResearch`
- Called from:
  - `PresentationsEngine.tsx`
- Input:
  - `topic`
  - `depth`
- Runtime type:
  - research
- Engine owner:
  - `RasidAiEngine`

### `ai.uploadFile`
- Called from:
  - `ExtractionEngine.tsx`
- Input:
  - `fileName`
  - `fileBase64`
  - `contentType`
- Runtime type:
  - upload/source-ingest
- Engine owner:
  - source storage layer
- Required records:
  - source ref

### `ai.extractFromFile`
- Called from:
  - `AIPresentationGenerator.tsx`
  - `ExtractionEngine.tsx`
- Input:
  - `fileUrl`
  - `fileBase64`
  - `fileName`
  - `fileType`
  - `language`
- Runtime type:
  - extract/transcribe
- Engine owner:
  - `TranscriptionExtractionEngine`
- Required records:
  - job
  - extraction artifact
  - evidence

### `ai.generateDashboardWidgets`
- Called from:
  - `DashboardEngine.tsx`
- Input:
  - `prompt`
  - `dataContext`
  - `existingWidgets`
- Runtime type:
  - generate
- Engine owner:
  - `RasidAiEngine` + `DashboardEngine`

### `ai.generateReportSections`
- Called from:
  - `ReportsEngine.tsx`
- Input:
  - `prompt`
  - `template`
  - `existingSections`
- Runtime type:
  - generate
- Engine owner:
  - `RasidAiEngine` + `ReportEngine`

### `ai.analyzeExcelData`
- Called from:
  - `ExcelEngine.tsx`
- Input:
  - `prompt`
  - `sheetData`
  - `operation`
- Runtime type:
  - analyze
- Engine owner:
  - `RasidAiEngine` + `ExcelEngine`

## 17. المتغيرات الحاكمة التي يجب أن تمر عبر الـ adapter layer

### هوية الوصول
- `ctx.user.id`
- `ctx.user.userId`
- `ctx.user.role`
- `ctx.user.permissions`

### هوية المستأجر/المساحة
- `tenant_ref`
- `workspace_id`
- `permission_scope`

### هوية العملية
- `created_by`
- `actor_ref`
- `requested_mode`
- `approval_policy`
- `capability`

### هوية السجلات
- `source_id`
- `artifact_id`
- `version_ref`
- `job_id`
- `evidence_ref`
- `lineage_ref`
- `publication_id`

## 18. سياسة الإلزام لكل procedure

### إجراءات القراءة فقط
- لا تحتاج job دائمًا
- تحتاج permission check
- قد تحتاج audit read only في السطوح الحساسة

### إجراءات الكتابة
- تحتاج:
  - governance check
  - audit event
  - version or artifact mutation

### إجراءات AI
- تحتاج:
  - job
  - evidence
  - audit
  - approval before apply إذا غيرت المنتج

### إجراءات publish/share/export
- تحتاج:
  - publication record
  - evidence
  - audit
  - lineage from source artifact

## 19. ما الذي يجب استبداله مباشرة

- [localDb.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/localDb.ts)
  - يجب أن يُزال كـ source of truth

- [aiRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/aiRouter.ts)
  - يجب أن يتحول من direct LLM-heavy app logic إلى adapter layer فوق `RasidAiEngine` والمحركات الفعلية

- [routers.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/routers.ts)
  - يجب أن يبقي نفس الـ names
  - لكن يغيّر التنفيذ الداخلي بالكامل إلى Rasid engines

## 20. القرار التنفيذي النهائي

أي منفذ يربط النظام يجب أن يلتزم بهذا الترتيب:

1. يبقي أسماء الإجراءات كما هي
2. ينشئ `server/rasidAdapters.ts`
3. ينقل كل procedure إلى المحرك المختص
4. يضيف governance/evidence/audit/lineage حيث يلزم
5. يختبر كل procedure من الواجهة التي تستدعيه

هذا الملف هو المرجع الأدق بندًا بندًا لكل `procedure`.
