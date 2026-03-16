# Rasid Designer Full Integration Guide

هذا الدليل مخصص للمصمم المسؤول عن ربط التجربة الكاملة للمشروع.

غرضه:
- شرح كيف ترتبط كل شاشة وكل مكوّن بصري بخدمات النظام ووظائفه
- منع أي انحراف تصميمي عن العقود الحاكمة الحالية
- توحيد فهم المصمم مع المطور حول ما الذي يظهر للمستخدم وما الذي يشتغل خلفه

هذا الدليل لا يستبدل المواصفات التنفيذية الأدق، بل يجمعها في صيغة تشغيلية مناسبة للمصمم.

## 1. الملفات الحاكمة التي يجب الرجوع لها دائمًا

- [RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md](/C:/ALRaMaDy/docs/RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md)
- [RASID_LITERAL_SERVICE_WIRING_GUIDE.md](/C:/ALRaMaDy/docs/RASID_LITERAL_SERVICE_WIRING_GUIDE.md)
- [system-overview.md](/C:/ALRaMaDy/docs/system-overview.md)
- [architecture.md](/C:/ALRaMaDy/docs/architecture.md)
- [apis.md](/C:/ALRaMaDy/docs/apis.md)

القاعدة:
- المصمم لا يغيّر أسماء الـ namespaces أو الـ procedures أو الـ state keys المستخدمة فعليًا في الواجهة.
- أي اقتراح بصري جديد يجب أن يركب فوق العقود الحالية، لا أن يفرض عقودًا جديدة.

## 2. خريطة النظام من منظور المصمم

النظام مكوّن من 3 طبقات يجب أن يفهمها المصمم:

1. طبقة التجربة:
   - الصفحات
   - اللوحات
   - الـ dialogs
   - الـ drawers
   - التنقل

2. طبقة العقود:
   - `trpc.<namespace>.<procedure>`
   - وهي نقطة الربط الثابتة بين التصميم والتنفيذ

3. طبقة المحركات:
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

## 3. مسارات التطبيق الأساسية

المصدر: [App.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/App.tsx)

### المسارات العامة

- `/login`
  - شاشة دخول
  - ترتبط بـ `auth.login`

- `/register`
  - شاشة تسجيل
  - ترتبط بـ `auth.register`

- `/forgot-password`
  - شاشة مساعدة للدخول
  - حاليًا سطح UX مستقل ويجب اعتباره جزءًا من رحلة الهوية

- `/shared/:token`
  - شاشة عرض تقديمي عام أو محمي
  - ترتبط بـ `presentations.viewShared`

- `/about`
  - صفحة تعريفية

### المسارات المحمية

- `/`
  - مساحة العمل الرئيسية
  - ترتبط بأغلب قدرات النظام

- `/profile`
  - ملف المستخدم
  - يعتمد على هوية المستخدم والنشاط

- `/admin`
  - لوحة الإدارة
  - متاحة فقط لدور `admin`
  - ترتبط بـ `admin.*` و`slideLibrary.*`

## 4. هيكل مساحة العمل الرئيسية

المصدر: [Home.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/Home.tsx)

مساحة العمل الرئيسية تتكون من:

- Header
  - تنقل سريع
  - وضع العرض
  - إشعارات
  - أوامر سريعة

- Data Panel
  - يعرض المصادر والملفات والجداول والمجموعات والتدفقات

- Workspace Canvas
  - يعرض الـ engine النشط حسب الـ tab

- Studio Panel
  - أدوات إنشاء ومخرجات محفوظة

- طبقات تشغيل مساندة
  - `AddSourceDialog`
  - `ShareDialog`
  - `AnalyticsDialog`
  - `SettingsMenu`
  - `InspectorPanel`
  - `EvidenceDrawer`
  - `ExecutionTimeline`
  - `CompareView`
  - `CommandPalette`
  - `MobileBottomNav`

### متغيرات الحالة الحاكمة في الصفحة

المصمم يجب أن يحترم وجود هذه الـ states لأنها تحدد سلوك الواجهة:

- `dataOpen`
- `studioOpen`
- `mobileDrawer`
- `isMobile`
- `chatSidebarOpen`
- `addSourceOpen`
- `shareOpen`
- `analyticsOpen`
- `settingsOpen`
- `inspectorOpen`
- `inspectorTarget`
- `evidenceOpen`
- `evidenceData`
- `compareOpen`
- `timelineJobs`

هذه ليست تفاصيل برمجية فقط.
هي عقود UX فعلية تحدد:
- أي نافذة تظهر
- ما الذي يجب تعبئته فيها
- ما السياق النشط
- ما الذي يجب أن يتحدث عند نجاح/فشل العملية

## 5. شريط التبويبات ومساحات العمل

المصدر: [assets.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/lib/assets.ts)

### التبويبات الحالية

- `chat`
- `data`
- `presentations`
- `reports`
- `dashboard`
- `extraction`
- `translation`
- `matching`
- `library`

### قاعدة الربط

كل تبويب يجب أن يحقق 4 أشياء بصريًا:

1. عرض الحالة الحالية للكيان الذي يعمل عليه المستخدم
2. عرض أزرار الإجراءات المتاحة
3. عرض نتائج التنفيذ أو مخرجات الذكاء
4. توفير روابط واضحة إلى:
   - الأدلة
   - التتبع
   - المشاركة
   - التصدير
   - المراجعة

## 6. خريطة الربط من التبويب إلى المكوّن إلى الخدمة

المصدر: [WorkspaceView.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/WorkspaceView.tsx)

### `chat`

- السطح البصري:
  - `ChatCanvas`
  - `AIChatBox`
- الخدمات:
  - `ai.chat`
  - `chat.history`
  - `chat.addMessage`
- المحرك الخلفي:
  - `RasidAiEngine`
- ما يجب أن يظهر للمصمم:
  - حالة إرسال الرسالة
  - حالة انتظار الرد
  - محفوظات المحادثة
  - رسائل فشل/نجاح
  - مخرجات قابلة للتحويل إلى تقرير/عرض/لوحة عند الحاجة

### `data`

- المكوّن:
  - `ExcelEngine`
- الخدمات:
  - `spreadsheets.list`
  - `spreadsheets.get`
  - `spreadsheets.create`
  - `spreadsheets.update`
  - `spreadsheets.delete`
  - `ai.analyzeData`
  - `ai.analyzeExcelData`
- المحرك الخلفي:
  - `ExcelEngine`
  - `RasidAiEngine`
- المطلوب بصريًا:
  - استيراد ملف
  - عرض أوراق/جداول
  - تحليل ذكي
  - حفظ نسخة
  - حالة المعالجة
  - أثر الأدلة والجودة إن وُجد

### `presentations`

- المكوّن:
  - `PresentationsEngine`
- الخدمات:
  - `presentations.list`
  - `presentations.get`
  - `presentations.create`
  - `presentations.update`
  - `presentations.delete`
  - `presentations.share`
  - `presentations.myShares`
  - `presentations.deleteShare`
  - `presentations.updateShare`
  - `ai.generateSlides`
  - `ai.generateSlidesFromContent`
  - `ai.textOperation`
  - `ai.generateQuiz`
  - `ai.deepResearch`
- المحركات:
  - `PresentationEngine`
  - `RasidAiEngine`
  - `OutputPublication`
- المطلوب بصريًا:
  - إنشاء عرض من prompt أو محتوى
  - تحرير الشرائح
  - مشاركة العرض
  - رؤية حالة النشر
  - إظهار ما إذا كان العرض Draft أو Published أو Shared
  - عرض `evidence`, `audit`, `lineage`, `publication` إن كانت متاحة

### `reports`

- المكوّن:
  - `ReportsEngine`
- الخدمات:
  - `reports.list`
  - `reports.get`
  - `reports.create`
  - `reports.update`
  - `reports.delete`
  - `ai.generateReport`
  - `ai.generateReportSections`
- المحركات:
  - `ReportEngine`
  - `RasidAiEngine`
- المطلوب بصريًا:
  - هيكل التقرير
  - الأقسام
  - مؤشرات المراجعة
  - حفظ وتحديث
  - تصدير ومشاركة لاحقًا
  - إظهار أصل التقرير ومصادره وروابطه downstream

### `dashboard`

- المكوّن:
  - `DashboardEngine`
- الخدمات:
  - `dashboards.list`
  - `dashboards.get`
  - `dashboards.create`
  - `dashboards.update`
  - `dashboards.delete`
  - `ai.analyzeDashboard`
  - `ai.generateDashboardWidgets`
- المحركات:
  - `DashboardEngine`
  - `RasidAiEngine`
- المطلوب بصريًا:
  - منطقة widgets
  - layout قابل للتحديث
  - نتائج التحليل الذكي
  - حالة الحفظ/النشر/المشاركة
  - إظهار lineage بين dataset/report/dashboard

### `extraction`

- المكوّن:
  - `ExtractionEngine`
- الخدمات:
  - `extractions.list`
  - `extractions.create`
  - `ai.extractFromImage`
  - `ai.extractFromFile`
  - `ai.uploadFile`
  - `ai.summarize`
- المحركات:
  - `TranscriptionExtractionEngine`
  - `RasidAiEngine`
- المطلوب بصريًا:
  - رفع ملف أو صورة
  - عرض progress
  - عرض النص المستخرج
  - عرض البيانات المنظمة
  - عرض job وevidence وaudit وlineage

### `translation`

- المكوّن:
  - `TranslationEngine`
- الخدمات:
  - `translations.list`
  - `translations.create`
  - `ai.translate`
- المحركات:
  - `RasidAiEngine`
  - محرك الترجمة/التعريب الخلفي
- المطلوب بصريًا:
  - اللغة المصدر والهدف
  - النص الأصلي والمترجم
  - اعتماد النتيجة أو إعادة توليدها
  - إظهار دليل الجودة إذا توفر

### `matching`

- المكوّن:
  - `VisualMatchEngine`
- الخدمات:
  - `ai.chat`
  - `ai.visualMatch`
  - `dashboards.create`
  - `reports.create`
  - `presentations.create`
  - `spreadsheets.create`
- المحركات:
  - `RasidAiEngine`
  - محركات المخرجات حسب نوع التحويل
- المطلوب بصريًا:
  - مقارنة مرئية
  - اقتراحات مطابقة
  - أزرار تحويل سريع إلى Report / Dashboard / Presentation / Spreadsheet
  - عرض lineage بين المدخل والمخرج الجديد

### `library`

- المكوّن:
  - `LibraryEngine`
- الخدمات:
  - `library.items`
  - `files.list`
- المحرك:
  - `Library`
  - `source/artifact registry`
- المطلوب بصريًا:
  - عرض أصول المكتبة
  - فرز/بحث
  - حالات الاستخدام
  - أصل كل عنصر
  - هل هو reusable asset أم user file أم template

## 7. اللوحات الجانبية والـ dialogs والـ drawers

### `DataPanel`

المصدر: [DataPanel.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/DataPanel.tsx)

وظيفته:
- عرض المصادر
- البحث
- التصفية
- سحب وإفلات
- قائمة سياقية لكل عنصر

ربطه:
- `files.list`
- لاحقًا يجب أن يعكس sources/artifacts حقيقية لا بيانات mock

### `StudioPanel`

المصدر: [StudioPanel.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/StudioPanel.tsx)

وظيفته:
- نقطة إطلاق الإنشاء
- عرض المخرجات الأخيرة
- الوصول إلى القوالب

ربطه:
- outputs من:
  - `dashboards.list`
  - `reports.list`
  - `presentations.list`
- tools من:
  - `dashboard`
  - `report`
  - `presentation`
  - `matching`
  - `arabization`
  - `extraction`
  - `translation`

### `AddSourceDialog`

وظيفته:
- إدخال مصدر جديد

الربط المطلوب:
- `files.create`
- أو `ai.uploadFile`
- أو `extractions.create`

قرار المصمم هنا:
- يجب أن تكون أنواع الإدخال واضحة:
  - ملف خام
  - صورة
  - مستند
  - مسار تفريغ/استخراج

### `ShareDialog`

المصدر: [ShareDialog.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/ShareDialog.tsx)

وظيفته الحالية:
- تجربة مشاركة بصرية عامة

الربط المطلوب:
- `presentations.share`
- ثم `presentations.updateShare`
- ثم `presentations.myShares`
- وللمخرجات الأخرى يجب أن يمر عبر `publication` path لاحقًا

قاعدة تصميم:
- الرابط المعروض يجب أن يأتي من نتيجة backend وليس من قيمة ثابتة
- الصلاحية يجب أن ترتبط بدور واضح
- يجب إظهار حالات:
  - Public
  - Password protected
  - Expires at
  - Viewer role

### `AnalyticsDialog`

المصدر: [AnalyticsDialog.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/AnalyticsDialog.tsx)

الربط المطلوب:
- `admin.stats`
- `admin.recentActivity`

قاعدة تصميم:
- الأرقام المعروضة ليست ديكورًا
- يجب أن تملك:
  - label
  - value
  - trend إن وجد
  - last updated

### `SettingsMenu`

وظيفته:
- إعدادات المستخدم/الوضع/المساحة

الربط المطلوب:
- `auth.me`
- permissions
- workspace preferences
- mode

### `InspectorPanel`

وظيفته:
- عرض الكيان المحدد وتفاصيله

الهدف:
- يجب أن يعمل على:
  - report section
  - dashboard widget
  - presentation slide/element
  - spreadsheet sheet/cell-range
  - library asset

### `EvidenceDrawer`

وظيفته:
- عرض:
  - `jobId`
  - `capability`
  - `status`
  - `entries`
  - `auditTrail`

قاعدة تصميم:
- هذه المنطقة ليست اختيارية
- أي capability ينتج `evidence` أو `audit` أو `lineage` يجب أن يملك surface واضحًا لها

### `ExecutionTimeline`

وظيفته:
- متابعة lifecycle للـ jobs

المصمم يجب أن يجهز:
- Pending
- Running
- Completed
- Failed
- Degraded
- Needs review

### `CompareView`

وظيفته:
- مقارنة مخرجات أو مدخلات أو نسخ

يجب أن يدعم:
- مقارنة source vs generated
- مقارنة version vs version
- مقارنة before vs after

## 8. سطح الإدارة الكامل

المصدر: [AdminPanel.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/AdminPanel.tsx)

### أقسام الإدارة

- Dashboard
- Analytics
- Content
- Media
- Templates
- Slide Library
- Members
- Roles
- Invitations
- Settings
- Logs

### الخدمات المرتبطة

- `admin.users`
- `admin.stats`
- `admin.recentActivity`
- `admin.allContent`
- `slideLibrary.getStats`
- `slideLibrary.getCategories`
- `slideLibrary.getTemplates`
- `slideLibrary.getAllElements`
- `slideLibrary.uploadTemplate`
- `slideLibrary.deleteTemplate`
- `slideLibrary.updateElement`

### ما يجب أن يفهمه المصمم

لوحة الإدارة ليست مجرد صفحة dashboards.
هي مركز:
- المراقبة
- إدارة المحتوى
- إدارة الأصول
- إدارة العناصر التصميمية
- الصلاحيات
- تتبع النشاط

## 9. مكتبة عناصر العروض `slideLibrary.*`

المصادر:
- [SlideLibraryAdmin.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/SlideLibraryAdmin.tsx)
- [CreateTemplateDialog.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/CreateTemplateDialog.tsx)
- [TemplateEditor.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/components/TemplateEditor.tsx)
- [libraryRouter.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/server/libraryRouter.ts)

### الخدمات الحاكمة

- `slideLibrary.getCategories`
- `slideLibrary.getTemplates`
- `slideLibrary.getElementsByCategory`
- `slideLibrary.getAllElements`
- `slideLibrary.getElementsForContext`
- `slideLibrary.uploadTemplate`
- `slideLibrary.updateElement`
- `slideLibrary.updateUsageRules`
- `slideLibrary.deleteTemplate`
- `slideLibrary.createElement`
- `slideLibrary.getElement`
- `slideLibrary.deleteElement`
- `slideLibrary.convertPptxToHtml`
- `slideLibrary.getStats`

### معنى ذلك للمصمم

هذه المنطقة ليست مجرد file manager.
هي نظام إدارة design assets حي:
- categories
- elements
- HTML templates
- usage rules
- quality score
- activation status

المصمم يجب أن يوفر surfaces لـ:
- preview
- quality/status
- usage context
- category filtering
- create/update/delete
- تحويل PPTX إلى HTML template

## 10. الهوية والصلاحيات

المصادر:
- [useAuth.ts](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/_core/hooks/useAuth.ts)
- [AuthContext.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/contexts/AuthContext.tsx)

### الخدمات

- `auth.me`
- `auth.login`
- `auth.register`
- `auth.logout`

### ما يجب أن ينعكس بصريًا

- حالة التحقق من الجلسة
- فشل الدخول
- الصلاحيات حسب الدور
- إخفاء أو تعطيل أدوات لا يملكها المستخدم
- منع الوصول إلى `/admin` لغير المدير

## 11. العرض المشترك العام

المصدر: [SharedPresentation.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/pages/SharedPresentation.tsx)

### الخدمة

- `presentations.viewShared`

### الحالات البصرية المطلوبة

- Loading
- Error / invalid token
- Expired link
- Password required
- Viewer mode
- Fullscreen mode
- Navigation between slides
- View count

### قاعدة المصمم

هذه الشاشة عامة وليست مثل workspace.
لذلك يجب أن تكون:
- نظيفة
- خفيفة
- مركزة على العرض فقط
- بلا أدوات تحرير داخلية

## 12. نقطة الربط التقنية التي لا يجب تجاهلها

المصدر: [main.tsx](/C:/ALRaMaDy/rasid-platform-core/apps/rasid-web/client/src/main.tsx)

كل الواجهة تتصل عبر:
- `httpBatchLink`
- endpoint: `/api/trpc`
- `credentials: include`

هذا مهم للمصمم لأن:
- الجلسة تعتمد على cookies
- بعض الحالات UI لن تنجح بدون authenticated context
- أخطاء `unauthorized` تعيد المستخدم إلى `/login`

## 13. نوع العملية وما الذي يجب أن ينتج معها

المصدر الحاكم: [RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md](/C:/ALRaMaDy/docs/RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md)

لكل عملية يجب على التصميم أن يعرف هل هي:

- `read`
- `write`
- `generate`
- `publish`
- `share`
- `analyze`

ولكل عملية قد تظهر كيانات تشغيلية يجب أن يجد المصمم لها مكانًا واضحًا في الواجهة:

- `artifact`
- `job`
- `evidence`
- `audit`
- `lineage`
- `publication`

### ترجمتها إلى UI

- `artifact`
  - بطاقة مخرج
  - ملف
  - عنصر محفوظ

- `job`
  - progress
  - حالة تنفيذ
  - timeline

- `evidence`
  - drawer أو panel للتثبت

- `audit`
  - activity trail
  - decision trail

- `lineage`
  - origin / derived from / related to

- `publication`
  - public link
  - sharing state
  - access control
  - expiry

## 14. الفجوة الحالية التي يجب أن يعرفها المصمم

الوضع الحالي في التطبيق المنسوخ داخل `apps/rasid-web` ما زال يعتمد بدرجة كبيرة على:
- `localDb.ts`
- `localAuth.ts`
- بعض قيم mock أو local-first behavior

المعنى:
- التصميم يجب أن يعتمد العقود الحالية
- لكنه لا يجب أن يفترض أن التخزين المحلي هو الحقيقة النهائية
- كل surface يجب أن يكون صالحًا عند استبدال backend الداخلي بمحركات Rasid الفعلية

## 15. ما الذي يجب على المصمم تسليمه لكل capability

لكل capability يجب أن تكون هناك مواصفات تصميم تغطي:

1. Entry states
   - empty
   - loading
   - loaded
   - error
   - unauthorized

2. Action states
   - idle
   - submitting
   - success
   - failed
   - needs review

3. Output states
   - draft
   - saved
   - generated
   - published
   - shared
   - archived

4. Governance states
   - has evidence
   - missing evidence
   - has audit
   - lineage available
   - publication available

## 16. قائمة فحص نهائية للمصمم

- هل كل تبويب مرتبط بمكوّن فعلي ومحرك فعلي؟
- هل كل زر رئيسي يمكن ربطه بـ procedure محدد؟
- هل كل dialog/drawer لديه input وoutput واضحان؟
- هل حالات loading/error/empty/success موجودة؟
- هل المشاركة والنشر منفصلان بصريًا؟
- هل الأدلة والتدقيق والنَسب مرئية وليست مخفية؟
- هل الصلاحيات تغيّر ما يراه المستخدم؟
- هل `AdminPanel` و`SharedPresentation` و`Home` منسقة كعوالم مختلفة لا كنسخة واحدة؟
- هل التصميم صالح للجوال والديسكتوب؟
- هل الـ labels والأيقونات والـ terminology متسقة مع `assets.ts`؟

## 17. القرار التنفيذي للمصمم

إذا احتجت قرارًا سريعًا أثناء التصميم، استخدم هذه القاعدة:

- إن كان السؤال عن:
  - من يستدعي الإجراء
  - ما الـ input الحالي حرفيًا
  - ما المحرك المسؤول
  - ما السجلات الناتجة
  فارجع إلى:
  - [RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md](/C:/ALRaMaDy/docs/RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md)

- إن كان السؤال عن:
  - كيف تمر البيانات من الواجهة إلى الخدمة
  - ما الذي يجب أن يستبدل محليًا
  فارجع إلى:
  - [RASID_LITERAL_SERVICE_WIRING_GUIDE.md](/C:/ALRaMaDy/docs/RASID_LITERAL_SERVICE_WIRING_GUIDE.md)

- إن كان السؤال عن:
  - أين يقع هذا الجزء داخل النظام كاملًا
  فارجع إلى:
  - [system-overview.md](/C:/ALRaMaDy/docs/system-overview.md)
  - [architecture.md](/C:/ALRaMaDy/docs/architecture.md)

هذا الدليل يعتبر مرجع المصمم المتكامل للربط الكامل، لكنه يبقى تابعًا للملفات الحاكمة أعلاه عند أي تعارض.
