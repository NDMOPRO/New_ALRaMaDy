# دليل ربط المحركات بصفحة Canvas — للمصمم

> هذا الدليل يشرح لماذا توجد محركات منفصلة، وكيف تتصل ببعضها، وكيف يربطها المصمم بالواجهة.

---

## الفكرة الأساسية: لماذا محركات؟

تخيّل أن رصيد مطعم كبير فيه:
- **طباخ للأرز** (Excel Engine)
- **طباخ للحم** (Report Engine)
- **طباخ للسلطة** (Dashboard Engine)
- **مترجم القائمة** (Arabic Localization)
- **مصوّر الأطباق** (Strict Replication)
- **كاتب الوصفات** (Transcription)
- **مقدّم العروض** (Presentations Engine)
- **الشيف الذكي** (AI Engine)

**الواجهة (Canvas)** = هي **صالة المطعم** — الزبون يجلس فيها ويطلب، والطلب يروح للمطبخ المناسب.

المصمم يصمم **الصالة فقط** (Canvas/UI)، لكن كل زر يضغطه المستخدم يرسل طلب لمحرك معين في الخلفية.

---

## الخريطة البصرية: كيف يتصل كل شيء

```
┌─────────────────────────────────────────────────────┐
│                    صفحة Canvas                       │
│                  (ما يراه المستخدم)                   │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │  شات AI  │ │ جدول Excel│ │ لوحة بيان│ │ عروض    │ │
│  │ ChatCanvas│ │ExcelEngine│ │Dashboard │ │Presentat│ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │             │            │             │      │
└───────┼─────────────┼────────────┼─────────────┼──────┘
        │             │            │             │
        ▼             ▼            ▼             ▼
┌─────────────────────────────────────────────────────┐
│              طبقة الاتصال: tRPC                      │
│         /api/trpc/[اسم_الخدمة]/[العملية]             │
│                                                      │
│  كل استدعاء من الواجهة يمر من هنا                    │
│  مثال: trpc.ai.chat.useMutation()                    │
│  مثال: trpc.spreadsheets.create.useMutation()        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              السيرفر (Express + tRPC)                │
│              http://localhost:3000                    │
│                                                      │
│  server/routers.ts ← يستقبل الطلبات ويوزعها         │
│  server/aiRouter.ts ← طلبات الذكاء الاصطناعي         │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │Excel     │  │Dashboard │  │Report    │
  │Engine    │  │Engine    │  │Engine    │
  │(حسابات) │  │(رسوم)   │  │(تقارير) │
  └──────────┘  └──────────┘  └──────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
              ┌────────┼────────┐
              │        │        │
              ▼        ▼        ▼
        ┌──────┐ ┌────────┐ ┌────────┐
        │تعريب │ │تفريغ   │ │مطابقة  │
        │Arabic│ │Transcr.│ │Strict  │
        └──────┘ └────────┘ └────────┘
```

---

## الملفات التي يحتاجها المصمم

### ملفات الواجهة (Frontend) — يعدّلها المصمم

| الملف | الوظيفة | متى يحتاجه |
|-------|---------|------------|
| `apps/rasid-web/client/src/pages/Home.tsx` | الصفحة الرئيسية (Canvas) | دائمًا |
| `apps/rasid-web/client/src/components/WorkspaceView.tsx` | التخطيط الرئيسي مع التبويبات | عند تعديل التنقل |
| `apps/rasid-web/client/src/components/ChatCanvas.tsx` | شاشة الشات مع AI | عند تعديل تجربة المحادثة |
| `apps/rasid-web/client/src/components/ExcelEngine.tsx` | محرر الجداول | عند تعديل تجربة Excel |
| `apps/rasid-web/client/src/components/DashboardEngine.tsx` | محرر لوحات البيانات | عند تعديل تجربة Dashboard |
| `apps/rasid-web/client/src/components/ReportsEngine.tsx` | محرر التقارير | عند تعديل تجربة التقارير |
| `apps/rasid-web/client/src/components/PresentationsEngine.tsx` | محرر العروض | عند تعديل تجربة العروض |
| `apps/rasid-web/client/src/components/AIPresentationCreator.tsx` | إنشاء عرض بالذكاء | عند تعديل تجربة AI |

### ملفات لا يعدّلها المصمم (Backend) — لكن يحتاج يعرفها

| الملف | الوظيفة |
|-------|---------|
| `apps/rasid-web/server/routers.ts` | كل الـ API endpoints |
| `apps/rasid-web/server/aiRouter.ts` | endpoints الذكاء الاصطناعي |
| `packages/excel-engine/src/engine.ts` | محرك Excel الفعلي |
| `packages/dashboard-engine/src/index.ts` | محرك لوحات البيانات |
| `packages/report-engine/src/index.ts` | محرك التقارير |
| `packages/presentations-engine/src/platform.ts` | محرك العروض |
| `packages/transcription-extraction-engine/src/index.ts` | محرك التفريغ |
| `packages/arabic-localization-lct-engine/src/index.ts` | محرك التعريب |
| `packages/strict-replication-engine/src/index.ts` | محرك المطابقة |

---

## كيف يربط المصمم كل زر بمحرك

### النمط الأساسي: استدعاء tRPC من أي Component

```tsx
// 1. استيراد tRPC
import { trpc } from "@/lib/trpc";

// 2. في أي Component:
function MyButton() {
  // للقراءة (GET):
  const { data, isLoading } = trpc.spreadsheets.list.useQuery();

  // للكتابة (POST):
  const mutation = trpc.spreadsheets.create.useMutation();

  const handleClick = async () => {
    const result = await mutation.mutateAsync({
      title: "جدول جديد",
      description: "وصف",
      sheets: []
    });
    console.log("تم الإنشاء:", result.id);
  };

  return <button onClick={handleClick}>إنشاء جدول</button>;
}
```

---

## دليل الربط لكل محرك

### 1. محرك Excel — ربط الجداول

**المكوّن:** `ExcelEngine.tsx`

**الاستدعاءات المتاحة:**

```tsx
// إنشاء جدول جديد
const create = trpc.spreadsheets.create.useMutation();
await create.mutateAsync({
  title: "تحليل المبيعات",
  description: "بيانات الربع الأول",
  sheets: [{ name: "Sheet1", data: [[]] }]
});

// جلب قائمة الجداول
const { data: sheets } = trpc.spreadsheets.list.useQuery();

// تحديث جدول
const update = trpc.spreadsheets.update.useMutation();
await update.mutateAsync({
  id: 5,
  title: "عنوان جديد",
  sheets: updatedSheets
});

// حذف جدول
const del = trpc.spreadsheets.delete.useMutation();
await del.mutateAsync({ id: 5 });

// تحليل بالذكاء الاصطناعي
const analyze = trpc.ai.analyzeExcelData.useMutation();
const result = await analyze.mutateAsync({
  fileId: "file-123",
  analysis_type: "full"
});

// استعلام بالعربي عن البيانات
const query = trpc.ai.analyzeData.useMutation();
const answer = await query.mutateAsync({
  prompt: "ما هو إجمالي المبيعات؟",
  data: myData
});
```

**أين يضع المصمم هذا الكود:**

```
ExcelEngine.tsx
├── زر "ملف جديد" → trpc.spreadsheets.create
├── زر "حفظ" → trpc.spreadsheets.update
├── زر "تحليل" → trpc.ai.analyzeExcelData
├── شريط البحث → trpc.ai.analyzeData (NLQ)
├── زر "تصدير" → trpc.spreadsheets.update + تنزيل
└── زر "حذف" → trpc.spreadsheets.delete
```

---

### 2. محرك لوحات البيانات — ربط الداشبورد

**المكوّن:** `DashboardEngine.tsx`

```tsx
// إنشاء لوحة بيانات
const create = trpc.dashboards.create.useMutation();
await create.mutateAsync({
  title: "لوحة تشغيلية",
  description: "مؤشرات الأداء",
  widgets: [
    { type: "kpi", title: "الإيرادات", value: "42M" },
    { type: "bar", title: "المبيعات حسب المنطقة", data: [...] }
  ],
  layout: { columns: 12, rows: 8 }
});

// إنشاء widgets بالذكاء
const aiWidgets = trpc.ai.generateDashboardWidgets.useMutation();
const widgets = await aiWidgets.mutateAsync({
  metrics: ["revenue", "cost", "profit"],
  layout: "grid"
});

// تحليل اللوحة بالذكاء
const analyze = trpc.ai.analyzeDashboard.useMutation();
const suggestion = await analyze.mutateAsync({
  prompt: "أضف مؤشر لرضا العملاء",
  currentWidgets: existingWidgets
});
```

**أين يضع المصمم هذا الكود:**

```
DashboardEngine.tsx
├── زر "لوحة جديدة" → trpc.dashboards.create
├── زر "إضافة widget" → trpc.ai.generateDashboardWidgets
├── زر "تحليل ذكي" → trpc.ai.analyzeDashboard
├── زر "حفظ" → trpc.dashboards.update
└── سحب وإفلات → تحديث layout محلي ثم trpc.dashboards.update
```

---

### 3. محرك التقارير — ربط التقارير

**المكوّن:** `ReportsEngine.tsx`

```tsx
// إنشاء تقرير
const create = trpc.reports.create.useMutation();
await create.mutateAsync({
  title: "تقرير ربع سنوي",
  description: "أداء Q1 2026",
  reportType: "quarterly",
  sections: [
    { title: "الملخص التنفيذي", content: "..." },
    { title: "النتائج", content: "...", charts: [...] }
  ]
});

// توليد تقرير بالذكاء
const generate = trpc.ai.generateReport.useMutation();
const report = await generate.mutateAsync({
  prompt: "أنشئ تقرير أداء ربع سنوي عن المبيعات"
});

// توليد أقسام التقرير
const sections = trpc.ai.generateReportSections.useMutation();
const result = await sections.mutateAsync({
  topic: "تحليل رضا العملاء",
  structure: "executive"
});
```

**أين يضع المصمم هذا الكود:**

```
ReportsEngine.tsx
├── زر "تقرير جديد" → trpc.reports.create
├── زر "توليد بالذكاء" → trpc.ai.generateReport
├── زر "إضافة قسم" → trpc.ai.generateReportSections
├── زر "حفظ" → trpc.reports.update
└── زر "تصدير PDF" → تنزيل من السيرفر
```

---

### 4. محرك العروض — ربط العروض التقديمية

**المكوّن:** `PresentationsEngine.tsx` و `AIPresentationCreator.tsx`

```tsx
// إنشاء عرض
const create = trpc.presentations.create.useMutation();
await create.mutateAsync({
  title: "عرض تنفيذي",
  description: "نتائج الربع الأول",
  slides: [],
  theme: { primary: "#C7511F", font: "Amiri" }
});

// توليد عرض بالذكاء
const generate = trpc.ai.generatePresentation.useMutation();
const presentation = await generate.mutateAsync({
  topic: "استراتيجية التحول الرقمي 2026",
  context: "حكومي",
  slides: 10
});

// توليد شرائح من محتوى
const slides = trpc.ai.generateSlides.useMutation();
const result = await slides.mutateAsync({
  prompt: "أنشئ 5 شرائح عن الذكاء الاصطناعي في القطاع الصحي",
  style: "professional"
});

// مشاركة العرض
const share = trpc.presentations.share.useMutation();
const link = await share.mutateAsync({
  presentationId: 7,
  password: "1234"
});
// النتيجة: رابط مشاركة عام
```

---

### 5. محرك الشات الذكي — ربط المحادثة

**المكوّن:** `ChatCanvas.tsx`

```tsx
// إرسال رسالة للذكاء
const chat = trpc.ai.chat.useMutation();
const response = await chat.mutateAsync({
  messages: [
    { role: "user", content: "حلل بيانات المبيعات وأعطني ملخص" }
  ]
});
// response.content = رد الذكاء الاصطناعي

// ترجمة نص
const translate = trpc.ai.translate.useMutation();
const translated = await translate.mutateAsync({
  text: "Quarterly Revenue Report",
  sourceLang: "en",
  targetLang: "ar"
});

// تلخيص نص
const summarize = trpc.ai.summarize.useMutation();
const summary = await summarize.mutateAsync({
  text: longDocument,
  length: "short"
});

// استخراج من صورة
const extract = trpc.ai.extractFromImage.useMutation();
const data = await extract.mutateAsync({
  imageUrl: "/uploads/table-scan.png",
  language: "ar"
});
```

---

### 6. التفريغ والاستخراج — ربط التفريغ

**المكوّن:** `ExtractionEngine.tsx`

```tsx
// إنشاء تفريغ جديد
const create = trpc.extractions.create.useMutation();
await create.mutateAsync({
  sourceType: "audio",
  sourceFile: "/uploads/meeting.mp3",
  extractedText: "",  // سيُملأ تلقائيًا
  structuredData: {},
  language: "ar"
});

// استخراج محتوى من ملف
const extract = trpc.ai.extractFileContent.useMutation();
const content = await extract.mutateAsync({
  filePath: "/uploads/contract.pdf",
  type: "pdf"
});
```

---

### 7. الترجمة والتعريب — ربط الترجمة

**المكوّن:** `TranslationEngine.tsx`

```tsx
// ترجمة نص
const create = trpc.translations.create.useMutation();
await create.mutateAsync({
  sourceText: "Annual Performance Report",
  translatedText: "تقرير الأداء السنوي",
  sourceLang: "en",
  targetLang: "ar",
  type: "document"
});

// ترجمة بالذكاء
const translate = trpc.ai.translate.useMutation();
const result = await translate.mutateAsync({
  text: "Key Performance Indicators show growth",
  sourceLang: "en",
  targetLang: "ar"
});
```

---

## التنقل بين المحركات (Cross-Engine Navigation)

المستخدم يمكنه الانتقال من محرك لآخر. هذا يتم عبر `WorkspaceContext`:

```tsx
import { useWorkspace } from "@/contexts/WorkspaceContext";

function MyComponent() {
  const { navigateTo } = useWorkspace();

  // الانتقال من Excel إلى Dashboard
  const sendToDashboard = () => {
    navigateTo({
      targetView: "dashboard",    // الوجهة
      data: { widgets: myKPIs }   // البيانات المرسلة
    });
  };

  // الانتقال من التقارير إلى العروض
  const sendToPresentation = () => {
    navigateTo({
      targetView: "presentations",
      data: { sections: reportSections }
    });
  };

  // الانتقال من الشات إلى Excel
  const openInExcel = () => {
    navigateTo({
      targetView: "data",         // data = Excel
      data: { table: extractedTable }
    });
  };
}
```

**التبويبات المتاحة (targetView):**

| القيمة | المحرك | الشاشة |
|--------|--------|--------|
| `"chat"` | ChatCanvas | شاشة المحادثة |
| `"data"` | ExcelEngine | شاشة الجداول |
| `"studio"` | StudioPanel | أدوات التصميم |
| `"reports"` | ReportsEngine | شاشة التقارير |
| `"dashboard"` | DashboardEngine | لوحات البيانات |
| `"presentations"` | PresentationsEngine | العروض |
| `"library"` | LibraryEngine | المكتبة |

---

## تدفقات العمل الشائعة (Workflows)

### التدفق 1: من ملف Excel إلى لوحة بيانات

```
المستخدم يرفع ملف Excel
        │
        ▼
   ExcelEngine.tsx
   trpc.spreadsheets.create ← حفظ الجدول
        │
        ▼
   trpc.ai.analyzeExcelData ← تحليل ذكي
        │
        ▼
   يعرض KPIs + رسوم بيانية مقترحة
        │
   المستخدم يضغط "أنشئ لوحة بيانات"
        │
        ▼
   navigateTo({ targetView: "dashboard", data: { widgets } })
        │
        ▼
   DashboardEngine.tsx
   trpc.dashboards.create ← حفظ اللوحة
```

### التدفق 2: من محادثة إلى عرض تقديمي

```
المستخدم يكتب: "أنشئ عرض عن نتائج Q1"
        │
        ▼
   ChatCanvas.tsx
   trpc.ai.generatePresentation
        │
        ▼
   الذكاء يولّد الشرائح
        │
   المستخدم يضغط "فتح في محرر العروض"
        │
        ▼
   navigateTo({ targetView: "presentations", data: { slides } })
        │
        ▼
   PresentationsEngine.tsx ← تعديل وتصدير
```

### التدفق 3: من تفريغ صوتي إلى تقرير

```
المستخدم يرفع ملف صوتي
        │
        ▼
   ExtractionEngine.tsx
   trpc.extractions.create ← تفريغ
        │
        ▼
   trpc.ai.summarize ← تلخيص
        │
   المستخدم يضغط "حوّل إلى تقرير"
        │
        ▼
   navigateTo({ targetView: "reports", data: { sections } })
        │
        ▼
   ReportsEngine.tsx
   trpc.reports.create ← حفظ التقرير
```

### التدفق 4: ترجمة تقرير كامل

```
المستخدم عنده تقرير بالإنجليزي
        │
        ▼
   ReportsEngine.tsx
   المستخدم يضغط "ترجم للعربي"
        │
        ▼
   trpc.ai.translate ← ترجمة كل قسم
        │
        ▼
   trpc.reports.update ← حفظ النسخة المعربة
```

---

## رفع الملفات (File Upload)

```tsx
// رفع ملف واحد
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload/single", {
    method: "POST",
    body: formData,
    credentials: "include"  // مهم للمصادقة
  });

  const result = await response.json();
  return result.url;  // مسار الملف المرفوع
};

// رفع عدة ملفات
const uploadMultiple = async (files: File[]) => {
  const formData = new FormData();
  files.forEach(file => formData.append("files", file));

  const response = await fetch("/api/upload/multiple", {
    method: "POST",
    body: formData,
    credentials: "include"
  });

  return await response.json();
};
```

---

## المصادقة (Authentication)

```tsx
import { useAuth } from "@/contexts/AuthContext";

function LoginButton() {
  const { login, logout, user, isAuthenticated } = useAuth();

  // تسجيل دخول
  await login({ userId: "admin", password: "1234" });

  // تسجيل خروج
  await logout();

  // فحص هل مسجّل
  if (isAuthenticated) {
    console.log("مرحبًا", user.displayName);
  }
}
```

---

## الثيم والوضع المظلم

```tsx
import { useTheme } from "@/contexts/ThemeContext";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  // theme = "light" | "dark"

  return (
    <button onClick={toggleTheme}>
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
```

---

## خلاصة سريعة للمصمم

| ما يريد المصمم | ماذا يستدعي | من أين |
|---------------|-------------|--------|
| عرض قائمة الملفات | `trpc.files.list.useQuery()` | أي مكوّن |
| إنشاء جدول | `trpc.spreadsheets.create.useMutation()` | ExcelEngine |
| تحليل بيانات | `trpc.ai.analyzeData.useMutation()` | ChatCanvas |
| إنشاء لوحة | `trpc.dashboards.create.useMutation()` | DashboardEngine |
| إنشاء تقرير | `trpc.reports.create.useMutation()` | ReportsEngine |
| إنشاء عرض | `trpc.presentations.create.useMutation()` | PresentationsEngine |
| ترجمة | `trpc.ai.translate.useMutation()` | أي مكوّن |
| رفع ملف | `fetch("/api/upload/single")` | أي مكوّن |
| تنقل بين محركات | `navigateTo({ targetView })` | أي مكوّن |
| محادثة AI | `trpc.ai.chat.useMutation()` | ChatCanvas |

---

## القاعدة الذهبية

> **كل زر في الواجهة = استدعاء tRPC واحد**
>
> المصمم يصمم الشكل ويضع الأزرار.
> كل زر يستدعي `trpc.[خدمة].[عملية].useMutation()` أو `.useQuery()`.
> المحرك في الخلفية يقوم بكل العمل ويرجع النتيجة.
> المصمم يعرض النتيجة في الواجهة.

لا يحتاج المصمم أن يفهم كيف يعمل المحرك من الداخل — يحتاج فقط يعرف:
1. **اسم الخدمة** (spreadsheets, dashboards, reports, presentations, ai)
2. **اسم العملية** (create, list, get, update, delete)
3. **البيانات المطلوبة** (title, description, etc.)
4. **البيانات المرجعة** (id, data, etc.)
