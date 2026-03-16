# Rasid Literal Service Wiring Guide

هذا الدليل تنفيذي حرفي.
هدفه توضيح الربط الكامل بين الواجهة والخدمات والمحركات بدون اجتهاد.

لا يشرح شكلاً بصريًا.
لا يقترح UI جديدًا.
لا يغير أسماء المتغيرات الحالية.

يجب اعتماد هذا الدليل عند تنفيذ الربط.

## 1. القاعدة الحاكمة

- الطبقة الأمامية يجب أن تستهلك نفس أسماء الـ procedures الحالية.
- يمنع تغيير أسماء الـ namespaces التالية لأنها هي contract الربط الفعلي:
  - `auth`
  - `ai`
  - `files`
  - `reports`
  - `presentations`
  - `dashboards`
  - `spreadsheets`
  - `extractions`
  - `translations`
  - `chat`
  - `library`
  - `slideLibrary`
  - `admin`
- الطبقة الخلفية يجب أن تستبدل التخزين المحلي الحالي فقط، لا أن تغيّر العقود الأمامية.
- أي procedure تبقى باسمها الحالي، لكن تنفيذها الداخلي يجب أن يذهب إلى المحرك المختص.

## 2. الملفات المرجعية الإلزامية

### الواجهة

- [Home.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/Home.tsx)
- [routers.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/routers.ts)
- [aiRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/aiRouter.ts)

### المحركات الخلفية

- [dashboard-engine](/C:/ALRaMaDy/rasid-platform-core/packages/dashboard-engine/src/index.ts)
- [report-engine](/C:/ALRaMaDy/rasid-platform-core/packages/report-engine/src/index.ts)
- [presentations-engine](/C:/ALRaMaDy/rasid-platform-core/packages/presentations-engine/src/index.ts)
- [excel-engine](/C:/ALRaMaDy/rasid-platform-core/packages/excel-engine/src/engine.ts)
- [transcription-extraction-engine](/C:/ALRaMaDy/rasid-platform-core/packages/transcription-extraction-engine/src/index.ts)
- [ai-engine](/C:/ALRaMaDy/rasid-platform-core/packages/ai-engine/src/index.ts)
- [governance-engine](/C:/ALRaMaDy/rasid-platform-core/packages/governance-engine/src/index.ts)
- [library](/C:/ALRaMaDy/rasid-platform-core/packages/library/src/index.ts)
- [permissions](/C:/ALRaMaDy/rasid-platform-core/packages/permissions/src/index.ts)

## 3. القاعدة التنفيذية للربط

نفّذ الربط بهذه الصيغة:

1. الواجهة تستدعي `trpc.<namespace>.<procedure>`.
2. `server/routers.ts` أو `server/aiRouter.ts` يستقبل الطلب بنفس الاسم.
3. داخل الـ procedure:
   - ينشأ `source` أو `artifact` أو `job` أو `publication` حسب نوع العملية.
   - يستدعى المحرك المختص.
   - تعاد النتيجة بصيغة تناسب الواجهة الحالية.
4. لا يجوز إبقاء `localDb.ts` كـ source of truth نهائي.

## 4. متغيرات الصفحة الرئيسية التي يجب عدم تغيير أسمائها

المصدر: [Home.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/Home.tsx)

### نماذج البيانات

- `DataItem`
  - `id`
  - `title`
  - `type`
  - `status`
  - `icon`
  - `size`
- الوظيفة:
  - تمثيل أي عنصر بيانات يظهر في لوحة البيانات.
- الربط:
  - يأتي من:
    - `trpc.files.list`
    - `trpc.reports.list`
  - يجب أن يعكس artifacts/sources حقيقية من النظام.

- `StudioOutput`
  - `id`
  - `title`
  - `type`
  - `time`
  - `icon`
- الوظيفة:
  - تمثيل مخرجات الاستوديو.
- الربط:
  - يأتي من:
    - `trpc.dashboards.list`
    - `trpc.reports.list`
    - `trpc.presentations.list`

### متغيرات حالة الصفحة

- `dataOpen`
  - وظيفة: فتح/إغلاق لوحة البيانات.
  - لا يرتبط بمحرك.
  - UI-only.

- `studioOpen`
  - وظيفة: فتح/إغلاق لوحة الاستوديو.
  - لا يرتبط بمحرك.
  - UI-only.

- `mobileDrawer`
  - القيم: `'data' | 'studio' | null`
  - وظيفة: أي drawer متحرك مفتوح على الجوال.
  - UI-only.

- `isMobile`
  - وظيفة: تحديد وضع الهاتف.
  - UI-only.

- `chatSidebarOpen`
  - وظيفة: إظهار/إخفاء شريط المحادثة.
  - الربط غير مباشر:
    - إذا كانت المحادثة مفتوحة، يجب أن تكون كل إجراءات `trpc.ai.*` و`trpc.chat.*` جاهزة.

- `addSourceOpen`
  - وظيفة: فتح نافذة إضافة مصدر.
  - عند الحفظ يجب أن يذهب إلى:
    - `files.create`
    - أو `ai.uploadFile`
    - أو `extractions.create`
    - حسب نوع المصدر.

- `shareOpen`
  - وظيفة: فتح مشاركة المخرجات.
  - يجب أن يربط مع:
    - `presentations.share`
    - وأي publish/share لاحقًا للدashboard/report عبر output-publication path.

- `analyticsOpen`
  - وظيفة: فتح analytics dialog.
  - يجب أن يربط مع:
    - `admin.stats`
    - `admin.recentActivity`
    - أو analytics runtime فعلي إذا توسع النظام.

- `settingsOpen`
  - وظيفة: فتح قائمة الإعدادات.
  - يجب أن يربط مع:
    - mode
    - permissions
    - workspace/user preferences

- `inspectorOpen`
  - وظيفة: إظهار inspector.
  - يجب أن يستهلك object حقيقي من المحرك الفعلي.

- `inspectorTarget`
  - وظيفة: العنصر المحدد حاليًا داخل الـ inspector.
  - يجب أن يشير إلى:
    - report section
    - dashboard widget
    - presentation slide/element
    - spreadsheet sheet/cell-range
    - library asset

- `evidenceOpen`
  - وظيفة: إظهار evidence drawer.

- `evidenceData`
  - النوع: `EvidenceData | null`
  - يجب أن يحمل:
    - `jobId`
    - `capability`
    - `status`
    - `entries`
    - `auditTrail`
  - الربط:
    - evidence engine data
    - audit-lineage data
    - verification status

- `compareOpen`
  - وظيفة: إظهار المقارنة.
  - الربط:
    - compare outputs from reports/dashboards/transcription/localization/strict flows.

- `timelineJobs`
  - النوع: `TimelineJob[]`
  - وظيفة: الجدول التنفيذي للـ jobs.
  - الربط:
    - jobs lifecycle model
    - ai-engine jobs
    - report jobs
    - transcription jobs
    - localization jobs
    - strict jobs

## 5. استعلامات الصفحة الرئيسية الحالية وما يجب أن تستهلكه

المصدر: [Home.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/Home.tsx)

- `trpc.files.list.useQuery()`
  - الوظيفة الحالية: جلب الملفات.
  - الربط الصحيح:
    - Sources/Artifacts registry
    - connectors + artifacts

- `trpc.reports.list.useQuery()`
  - الوظيفة الحالية: جلب التقارير.
  - الربط الصحيح:
    - `ReportEngine`

- `trpc.presentations.list.useQuery()`
  - الوظيفة الحالية: جلب العروض.
  - الربط الصحيح:
    - `PresentationEngine`

- `trpc.dashboards.list.useQuery()`
  - الوظيفة الحالية: جلب اللوحات.
  - الربط الصحيح:
    - `DashboardEngine`

## 6. خريطة الربط الكاملة للـ appRouter

المصدر: [routers.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/routers.ts)

### 6.1 `auth`

#### `auth.me`
- output fields:
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
- الربط الصحيح:
  - `permissions`
  - `governance-engine`
  - tenant/workspace/user identity store

#### `auth.login`
- input:
  - `userId`
  - `password`
- output:
  - `success`
  - `error`
  - `user`
- الربط الصحيح:
  - identity/auth provider
  - permission bootstrap
  - session cookie

#### `auth.register`
- input:
  - `userId`
  - `password`
  - `displayName`
  - `email`
  - `mobile`
  - `department`
- الربط الصحيح:
  - tenant/workspace membership
  - role defaults
  - permission profile creation

#### `auth.logout`
- الوظيفة:
  - session termination

### 6.2 `files`

#### `files.list`
- الوظيفة:
  - إرجاع جميع الملفات للمستخدم.
- الربط الصحيح:
  - source registry
  - artifacts
  - connectors

#### `files.get`
- input:
  - `id`
- الربط الصحيح:
  - source details أو artifact details

#### `files.create`
- input:
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
- الربط الصحيح:
  - create source record
  - create source artifact if needed
  - ingestion batch registration
  - parser/profile kickoff عند الحاجة

#### `files.update`
- input:
  - `id`
  - `title`
  - `status`
  - `metadata`
  - `tags`
- الربط الصحيح:
  - metadata update only
  - يجب عدم كسر lineage

#### `files.delete`
- input:
  - `id`
- الربط الصحيح:
  - soft delete أو archive حسب policy

#### `files.toggleFavorite`
- input:
  - `id`
- الربط الصحيح:
  - user preference metadata

### 6.3 `reports`

#### `reports.list`
- الربط الصحيح:
  - `ReportEngine`

#### `reports.get`
- input:
  - `id`
- الربط الصحيح:
  - `ReportEngine`
  - report artifact fetch

#### `reports.create`
- input:
  - `title`
  - `description`
  - `reportType`
  - `sections`
  - `classification`
  - `entity`
- الربط الصحيح:
  - `ReportEngine.createReport(...)`
- المتغيرات:
  - `title`: اسم التقرير
  - `description`: وصف مختصر
  - `reportType`: نوع التقرير
  - `sections`: البلوك/الأقسام
  - `classification`: تصنيف العمل/المستوى
  - `entity`: الجهة المالكة أو المستهدفة

#### `reports.update`
- input:
  - `id`
  - `title`
  - `sections`
  - `classification`
  - `entity`
  - `status`
- الربط الصحيح:
  - `ReportEngine.updateReport(...)`

#### `reports.delete`
- input:
  - `id`
- الربط الصحيح:
  - archive/delete policy over report artifact

### 6.4 `presentations`

#### `presentations.list`
- الربط الصحيح:
  - `PresentationEngine`

#### `presentations.get`
- input:
  - `id`
- الربط الصحيح:
  - `PresentationEngine`

#### `presentations.create`
- input:
  - `title`
  - `description`
  - `slides`
  - `theme`
- الربط الصحيح:
  - `PresentationEngine.createPresentation(...)`
- المتغيرات:
  - `slides`: الشرائح الفعلية
  - `theme`: theme/template ref

#### `presentations.update`
- input:
  - `id`
  - `title`
  - `slides`
  - `theme`
  - `status`
- الربط الصحيح:
  - update existing deck bundle

#### `presentations.delete`
- input:
  - `id`

#### `presentations.share`
- input:
  - `presentationId`
  - `password`
  - `expiresAt`
- الربط الصحيح:
  - output publication/share path
  - publication token generation
  - public unlock policy

#### `presentations.myShares`
- الوظيفة:
  - جلب روابط المشاركة المملوكة للمستخدم

#### `presentations.deleteShare`
- input:
  - `id`

#### `presentations.updateShare`
- input:
  - `id`
  - `isPublic`
  - `password`

#### `presentations.viewShared`
- input:
  - `token`
  - `password`
- output fields المستخدمة حاليًا:
  - `error`
  - `needsPassword`
  - `title`
  - `slides`
  - `theme`
  - `brandKit`
  - `viewCount`
- الربط الصحيح:
  - public viewer publication runtime

### 6.5 `dashboards`

#### `dashboards.list`
- الربط الصحيح:
  - `DashboardEngine`

#### `dashboards.get`
- input:
  - `id`

#### `dashboards.create`
- input:
  - `title`
  - `description`
  - `widgets`
  - `layout`
- الربط الصحيح:
  - `DashboardEngine.createDashboard(...)`

#### `dashboards.update`
- input:
  - `id`
  - `title`
  - `widgets`
  - `layout`
  - `status`
- الربط الصحيح:
  - `DashboardEngine.updateDashboard(...)`

#### `dashboards.delete`
- input:
  - `id`

### 6.6 `spreadsheets`

#### `spreadsheets.list`
- الربط الصحيح:
  - workbook registry via `ExcelEngine`

#### `spreadsheets.get`
- input:
  - `id`

#### `spreadsheets.create`
- input:
  - `title`
  - `description`
  - `sheets`
- الربط الصحيح:
  - `ExcelEngine.importWorkbook(...)` إذا كان الملف واردًا
  - أو create workbook state إذا كانت البداية empty workbook

#### `spreadsheets.update`
- input:
  - `id`
  - `title`
  - `sheets`
  - `status`
- الربط الصحيح:
  - workbook mutation + versioning

#### `spreadsheets.delete`
- input:
  - `id`

### 6.7 `extractions`

#### `extractions.list`
- الربط الصحيح:
  - `TranscriptionExtractionEngine`

#### `extractions.create`
- input:
  - `sourceType`
  - `sourceFile`
  - `extractedText`
  - `structuredData`
  - `language`
- الربط الصحيح:
  - `TranscriptionExtractionEngine.ingestAndExtract(...)`
- المتغيرات:
  - `sourceType`: نوع المصدر
  - `sourceFile`: path/url/ref
  - `extractedText`: النص المستخرج
  - `structuredData`: الحقول والجداول والكيانات
  - `language`: لغة المحتوى

### 6.8 `translations`

#### `translations.list`
- الربط الصحيح:
  - localization history

#### `translations.create`
- input:
  - `sourceText`
  - `translatedText`
  - `sourceLang`
  - `targetLang`
  - `type`
- الربط الصحيح:
  - `arabic-localization-lct-engine`
- ملاحظة:
  - في الوضع الصحيح لا يمر `translatedText` من الواجهة كقيمة نهائية إلا إذا كان المستخدم يعدّل يدويًا.
  - المسار الآلي يجب أن ينتج `translatedText` من المحرك.

### 6.9 `chat`

#### `chat.history`
- input:
  - `sessionId`
- الربط الصحيح:
  - AI session memory store

#### `chat.addMessage`
- input:
  - `sessionId`
  - `role`
  - `content`
  - `metadata`
- الربط الصحيح:
  - AI conversation log
  - audit trail

### 6.10 `library`

#### `library.items`
- الربط الصحيح:
  - `packages/library`
  - unified asset registry

### 6.11 `slideLibrary`

- الربط الصحيح:
  - library + template + brand assets
  - admin-managed slide elements

### 6.12 `admin`

#### `admin.users`
- الربط الصحيح:
  - permission-aware user listing

#### `admin.stats`
- الربط الصحيح:
  - governance/admin analytics

#### `admin.recentActivity`
- الربط الصحيح:
  - audit feed

#### `admin.allContent`
- الربط الصحيح:
  - cross-artifact admin listing

## 7. خريطة الربط الكاملة للـ aiRouter

المصدر: [aiRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/aiRouter.ts)

### قاعدة عامة

كل إجراءات `ai.*` يجب أن تنتهي إلى:
- `RasidAiEngine.submitJob(...)`
- أو محرك مختص + job/evidence/audit/lineage

ولا يجوز أن تبقى مجرد استدعاء LLM نصي بدون runtime effect في المسارات التي تغيّر المنتج.

### `ai.status`
- input: لا شيء
- output: availability status
- الربط الصحيح:
  - provider health
  - AI runtime health

### `ai.chat`
- input:
  - `messages[]`
    - `role`
    - `content`
  - `context`
- الربط الصحيح:
  - `RasidAiEngine.submitJob(...)`
  - capability selection
  - session memory

### `ai.generateSlides`
- input:
  - `prompt`
  - `slideCount`
  - `style`
- الربط الصحيح:
  - `PresentationEngine` عبر AI orchestration

### `ai.generateReport`
- input:
  - `prompt`
  - `reportType`
- الربط الصحيح:
  - `ReportEngine` عبر AI orchestration

### `ai.analyzeDashboard`
- input:
  - `prompt`
  - `currentWidgets`
- الربط الصحيح:
  - `DashboardEngine`
  - AI suggestion plan

### `ai.analyzeData`
- input:
  - `prompt`
  - `data`
  - `columns`
- الربط الصحيح:
  - `RasidAiEngine`
  - dataset context analysis

### `ai.matchSuggest`
- input:
  - `prompt`
  - `sourceData`
  - `targetData`
- الربط الصحيح:
  - CDR / matching logic
  - strict/data reconciliation path

### `ai.translate`
- input:
  - `text`
  - `from`
  - `to`
  - `mode`
  - `glossary[]`
    - `source`
    - `target`
- الربط الصحيح:
  - `arabic-localization-lct-engine`
- المخرجات المتوقعة:
  - `content`
  - `confidence`
  - `changes`
  - `structured`

### `ai.summarize`
- input:
  - `text`
  - `maxLength`
- الربط الصحيح:
  - AI summarization utility

### `ai.extractFromImage`
- input:
  - `imageBase64`
  - `extractionType`
  - `language`
- الربط الصحيح:
  - `TranscriptionExtractionEngine`
  - OCR path

### `ai.visualMatch`
- input:
  - `imageBase64`
  - `outputType`
  - `additionalInstructions`
- الربط الصحيح:
  - strict replication
  - dashboard/report/presentation/excel generation from visual reference

### `ai.generateSlidesFromContent`
- input:
  - `content`
  - `sourceType`
  - `slideCount`
  - `style`
  - `language`
- الربط الصحيح:
  - AI -> presentation workflow

### `ai.textOperation`
- input:
  - `text`
  - `operation`
  - `targetLanguage`
  - `style`
- الربط الصحيح:
  - shared text utility
  - localization path when `operation=translate`

### `ai.generateQuiz`
- input:
  - `topic`
  - `questionCount`
  - `type`
- الربط الصحيح:
  - presentation interaction layer
  - public viewer interactions

### `ai.generatePresentation`
- input:
  - `topic`
  - `slideCount`
  - `brandId`
  - `language`
  - `contentSource`
  - `userContent`
  - `strictContent`
- الربط الصحيح:
  - `PresentationEngine`
  - `brand-template`
  - `library`
  - `RasidAiEngine`

### `ai.deepResearch`
- input:
  - `topic`
  - `depth`
- الربط الصحيح:
  - research capability feeding:
    - reports
    - presentations
    - governance

### `ai.uploadFile`
- input:
  - `fileName`
  - `fileBase64`
  - `contentType`
- الربط الصحيح:
  - source storage
  - connectors/storage layer
- output:
  - `url`
  - `key`
  - `size`

### `ai.extractFromFile`
- input:
  - `fileUrl`
  - `fileBase64`
  - `fileName`
  - `fileType`
  - `language`
- الربط الصحيح:
  - audio/video -> transcription
  - image -> OCR
  - pdf/document/spreadsheet -> extraction

### `ai.generateDashboardWidgets`
- input:
  - `prompt`
  - `dataContext`
  - `existingWidgets`
- الربط الصحيح:
  - `DashboardEngine`

### `ai.generateReportSections`
- input:
  - `prompt`
  - `template`
  - `existingSections`
- الربط الصحيح:
  - `ReportEngine`

### `ai.analyzeExcelData`
- input:
  - `prompt`
  - `sheetData`
  - `operation`
- الربط الصحيح:
  - `ExcelEngine`

## 8. خريطة المحركات الخلفية التي يجب أن تنفذ الربط

### `DashboardEngine`
- المصدر: [dashboard-engine](/C:/ALRaMaDy/rasid-platform-core/packages/dashboard-engine/src/index.ts)
- الوظائف الأساسية:
  - `createDashboard`
  - `updateDashboard`
  - `publishDashboard`
- يجب أن يملك:
  - dashboard artifact
  - dashboard publication
  - dashboard evidence
  - dashboard lineage

### `ReportEngine`
- المصدر: [report-engine](/C:/ALRaMaDy/rasid-platform-core/packages/report-engine/src/index.ts)
- الوظائف الأساسية:
  - `createReport`
  - `updateReport`
  - `publishReport`
  - `publishDegradedReportOutput`
  - `convertReportToPresentation`
  - `convertReportToDashboard`

### `PresentationEngine`
- المصدر: [presentations-engine](/C:/ALRaMaDy/rasid-platform-core/packages/presentations-engine/src/index.ts)
- الوظائف الأساسية:
  - `createPresentation`
- ويجب ربطه أيضًا مع:
  - save/update deck
  - theme/template application
  - publish/export/viewer paths

### `ExcelEngine`
- المصدر: [excel-engine](/C:/ALRaMaDy/rasid-platform-core/packages/excel-engine/src/engine.ts)
- الوظائف الأساسية:
  - `importWorkbook`
  - `analyzeWorkbook`
  - `exportEditableWorkbook`
  - `publishWorkbook`

### `TranscriptionExtractionEngine`
- المصدر: [transcription-extraction-engine](/C:/ALRaMaDy/rasid-platform-core/packages/transcription-extraction-engine/src/index.ts)
- الوظائف الأساسية:
  - `ingestAndExtract`
- يملك:
  - transcription artifacts
  - extraction artifacts
  - bundle state
  - compare bundle path

### `RasidAiEngine`
- المصدر: [ai-engine](/C:/ALRaMaDy/rasid-platform-core/packages/ai-engine/src/index.ts)
- الوظائف الأساسية:
  - `submitJob`
  - `listJobs`
- هو orchestrator أفقي.
- يجب أن يقرر:
  - capability
  - action
  - engine_ref
  - approval policy
  - evidence

### `GovernanceEngine`
- المصدر: [governance-engine](/C:/ALRaMaDy/rasid-platform-core/packages/governance-engine/src/index.ts)
- الوظيفة:
  - guard/write policy
  - approval
  - hostile prompt filtering
  - audit enforcement
- يجب أن يسبق:
  - جميع write paths
  - جميع publish/share/export paths
  - جميع AI apply paths

## 9. الربط الحرفي المطلوب لكل Namespace مع المحرك

| Namespace | Procedure | المحرك الإلزامي |
| --- | --- | --- |
| `auth` | `me/login/register/logout` | `permissions` + identity/session layer |
| `files` | `list/get/create/update/delete/toggleFavorite` | `connectors` + `artifacts` + source registry |
| `reports` | `list/get/create/update/delete` | `ReportEngine` |
| `presentations` | `list/get/create/update/delete` | `PresentationEngine` |
| `presentations` | `share/myShares/deleteShare/updateShare/viewShared` | output publication + viewer runtime |
| `dashboards` | `list/get/create/update/delete` | `DashboardEngine` |
| `spreadsheets` | `list/get/create/update/delete` | `ExcelEngine` |
| `extractions` | `list/create` | `TranscriptionExtractionEngine` |
| `translations` | `list/create` | `arabic-localization-lct-engine` |
| `chat` | `history/addMessage` | `RasidAiEngine` session memory |
| `library` | `items` | `packages/library` |
| `slideLibrary` | all | library + brand/template asset layer |
| `admin` | `users/stats/recentActivity/allContent` | governance/admin aggregation |
| `ai` | all AI procedures | `RasidAiEngine` + target engine |

## 10. المتغيرات التي يجب أن تنتقل بين الواجهة والمحركات

### هوية المستخدم
- `ctx.user.id`
- `ctx.user.userId`
- `ctx.user.role`
- `ctx.user.permissions`
- هذه المتغيرات يجب أن تمر في كل write path.

### هوية الـ runtime
- `tenant_ref`
- `workspace_id`
- `created_by`
- `actor_ref`
- `job_id`
- `artifact_id`
- `publication_id`

إذا لم توجد هذه القيم في الواجهة بعد، فيجب توليدها في server adapter layer وليس في الـ component.

## 11. كيف يربط المصمم أو منفذ الواجهة كل جزء عمليًا

### Data panel
- يستدعي:
  - `files.list`
  - `reports.list`
- يكوّن `dataItems`
- كل عنصر يجب أن يحمل:
  - source ref أو artifact ref حقيقي

### Studio panel
- يستدعي:
  - `dashboards.list`
  - `reports.list`
  - `presentations.list`
- يكوّن `studioOutputs`

### Chat / AI
- يربط:
  - `ai.chat`
  - `chat.history`
  - `chat.addMessage`
  - بقية إجراءات `ai.*`

### Inspector
- لا يفتح على بيانات وهمية.
- يجب أن يستهلك object فعليًا من:
  - dashboard widget
  - report section
  - presentation slide
  - spreadsheet area

### Evidence drawer
- يجب أن يبنى من:
  - `jobId`
  - evidence entries
  - audit trail
  - verification status

### Compare
- يجب أن يربط مع:
  - report compare
  - dashboard compare
  - transcription compare
  - localization compare
  - strict output compare

## 12. طبقة الـ adapter المطلوبة

يجب إنشاء طبقة واحدة فقط داخل `server/`:

- مثال:
  - `server/rasidAdapters.ts`
  - أو `server/rasidRuntime.ts`

وظيفتها:
- تحويل input الحالي من `routers.ts` إلى input المحرك المختص
- استدعاء المحرك
- إعادة output مبسط يطابق ما تحتاجه الواجهة الحالية

### ممنوع
- ممنوع أن تستدعي الـ components المحركات مباشرة
- ممنوع أن تبني models موازية جديدة
- ممنوع أن يبقى `localDb.ts` هو storage الحقيقي للمشروع

## 13. ما الذي يجب إزالته أو استبداله

### يجب استبداله
- [localDb.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/localDb.ts)

السبب:
- هو store محلي تجريبي
- لا يمثل artifacts/jobs/evidence/audit/lineage الحقيقية

### يجب إبقاؤه مؤقتًا فقط إن لزم
- auth cookie/session plumbing
- basic UI session helpers

## 14. ترتيب التنفيذ الصحيح

1. اربط `auth`
2. اربط `files`
3. اربط `reports`
4. اربط `presentations`
5. اربط `dashboards`
6. اربط `spreadsheets`
7. اربط `extractions`
8. اربط `translations`
9. اربط `chat`
10. اربط `library`
11. اربط `admin`
12. انقل كل `ai.*` إلى `RasidAiEngine` + target engines
13. أضف governance gates على كل write/publish/share/export

## 15. تعريف دقيق لوظيفة كل متغير مهم

### `sections`
- يوجد في `reports.create/update`
- يمثل report content blocks
- المحرك: `ReportEngine`

### `slides`
- يوجد في `presentations.create/update`
- يمثل الشرائح الفعلية
- المحرك: `PresentationEngine`

### `widgets`
- يوجد في `dashboards.create/update`
- يمثل dashboard widgets
- المحرك: `DashboardEngine`

### `layout`
- يوجد في `dashboards.create/update`
- يمثل grid/layout metadata
- المحرك: `DashboardEngine`

### `sheets`
- يوجد في `spreadsheets.create/update`
- يمثل workbook sheet payload
- المحرك: `ExcelEngine`

### `structuredData`
- يوجد في `extractions.create`
- يمثل extracted entities/tables/fields
- المحرك: `TranscriptionExtractionEngine`

### `translatedText`
- يوجد في `translations.create`
- يمثل النص الناتج
- المحرك: `arabic-localization-lct-engine`

### `metadata`
- يوجد في `files.create/update` و`chat.addMessage`
- يمثل payload إضافي غير ثابت
- يجب أن يبقى traceable ولا يستخدم كبديل لعقد رسمي

## 16. النتيجة المطلوبة من هذا الدليل

إذا التزم المنفذ بهذا الدليل:
- لن يغير أسماء العقود الأمامية
- لن يربط جزءًا من الخدمة ويترك الجزء الآخر
- سيعرف أي procedure يذهب لأي محرك
- سيعرف وظيفة كل متغير أساسي
- سيعرف ما الذي يجب أن يزال من الطبقة المحلية الحالية

## 17. القرار النهائي

الدليل التنفيذي الحرفي هو:
- ثبّت أسماء المتغيرات الحالية
- ثبّت أسماء الـ procedures الحالية
- استبدل التنفيذ الداخلي فقط
- اربط كل namespace بالمحرك المختص المذكور أعلاه
- أضف jobs/evidence/audit/lineage/governance على كل path يغير النظام
