# تحليل rasid_core_seed — قطع الغيار القابلة للاستخدام

> المسار: `C:\ALRaMaDy\rasid_core_seed`
> الغرض: تحديد ما يفيدنا من الكود السابق كـ "قطع غيار" للمنفذين

---

## الخلاصة التنفيذية

الكود السابق يحتوي على **قطع غيار ذهبية** خصوصًا في:
1. **محرك المطابقة البصرية** — أكثر ما نحتاجه (04_strict_fidelity_kernel)
2. **محرك Excel** — كامل ومتقدم (05_excel_core)
3. **عقود الـ schemas** — 522 ملف JSON جاهز (07_schema_contracts)

---

## 1. محرك المطابقة البصرية (04_strict_fidelity_kernel) — الأهم

### ما عندنا حاليًا vs ما في الـ seed:

| الوظيفة | حالتنا الحالية | الـ seed |
|---------|---------------|---------|
| **مقارنة بكسلات** | GPT-4o Vision فقط | **pixelmatch + SSIM + حلقة إصلاح تكرارية** |
| **استخراج بيانات** | GPT-4o يرجع JSON | **محرك متخصص: جداول + رسوم + KPIs + نصوص** |
| **تحليل PDF** | لا يوجد | **pdf-parse + استخراج طبقات + خطوط + vectors** |
| **معالجة صور** | لا يوجد | **sharp + canvas + OCR** |
| **التيبوغرافيا العربية** | قاموس ترجمة | **محرك Kashida + استبدال خطوط + تحسين RTL** |
| **التعرف على الخطوط** | لا يوجد | **OpenAI Vision + 28 خط (14 لاتيني + 14 عربي)** |
| **ربط البيانات** | لا يوجد | **TableBinding + ChartBinding + KPIBinding** |
| **التحقق من الجودة** | لا يوجد | **CER + layout + ألوان + خطوط + spacing + بكسلات** |

### قطع الغيار المطلوبة — أوصِ المنفذين بالرجوع إليها:

| الملف | لماذا مهم | الأولوية |
|-------|----------|---------|
| `pixel-validation-loop.service.ts` | **حلقة المطابقة الحقيقية** — pixelmatch + SSIM + إصلاح تكراري حتى PixelDiff=0 | عالية جدًا |
| `canonical-pipeline-orchestrator.service.ts` | **المنسق الرئيسي** — يحوّل CDR إلى 6 صيغ (HTML/PDF/PPTX/XLSX/DOCX/PNG) | عالية جدًا |
| `data-extraction.service.ts` | **استخراج البيانات** — جداول + رسوم + KPIs + نصوص من الصور/PDF | عالية جدًا |
| `pdf-intelligence.service.ts` | **تحليل PDF** — طبقات + خطوط + vectors + OCR fallback | عالية |
| `layout-generation-controller.service.ts` | **المتحكم الرئيسي** — يربط كل الخدمات ببعض | عالية |
| `arabic-typography-optimizer.service.ts` | **التيبوغرافيا العربية** — Kashida + 10 خطوط + overflow + RTL | عالية |
| `font-recognition.service.ts` | **التعرف على الخطوط** — OpenAI Vision + 28 خط مع fallbacks | متوسطة |
| `data-binding.service.ts` | **ربط البيانات** — يربط البيانات المستخرجة بالعناصر البصرية | متوسطة |
| `quality-validation.service.ts` | **التحقق من الجودة** — 6 أبعاد + OpenAI semantic check | متوسطة |
| `visual-analyzer.service.ts` | **تحليل الصور** — sharp + SSIM + OCR + كشف عناصر | متوسطة |
| `comparison-engine.service.ts` | **محرك المقارنة** — visual + structural + content + overlay | متوسطة |
| `style-extractor.service.ts` | **استخراج الأنماط** — CSS + ألوان + خطوط + design tokens | منخفضة |

### المكتبات المطلوبة (موجودة في الـ seed):
- `pixelmatch` — مقارنة بكسلات
- `sharp` — معالجة صور
- `canvas` — رسم
- `pdf-parse` — تحليل PDF
- `pngjs` — قراءة PNG

---

## 2. محرك Excel (05_excel_core) — متقدم جدًا

### ما عندنا vs الـ seed:

| الوظيفة | حالتنا | الـ seed |
|---------|--------|---------|
| **محرك الصيغ** | DAG + 50 دالة | **hot-formula-parser + math.js + Decimal.js + 11 مجموعة دوال** |
| **Pivot Tables** | بسيط | **كامل مع Zod validation + 6 aggregations** |
| **الرسوم البيانية** | SVG بسيط | **ChartJS + 10+ أنواع + chartjs-node-canvas** |
| **الاستيراد/التصدير** | XLSX + CSV | **CSV + XLSX + ODS + Google Sheets + PDF + تشفير** |
| **التحويلات** | 11 عملية | **محرك ULTRA مع SMART/PRO modes + Recipes** |
| **الدقة الرقمية** | JavaScript عادي | **Decimal.js (دقة 0.000001)** |
| **التقويم** | لا يوجد | **تحويل ميلادي/هجري** |

### قطع الغيار المطلوبة:

| الملف | لماذا مهم | الأولوية |
|-------|----------|---------|
| `excel-ultra-engine.service.ts` | **SMART/PRO modes + Arabic ELITE + Recipes** | عالية |
| `formula-engine.service.ts` | **محرك صيغ متقدم** مع hot-formula-parser + math.js | عالية |
| `chart-builder.service.ts` | **10+ أنواع رسوم** بـ ChartJS + canvas export | عالية |
| `pivot-table.service.ts` | **Pivot tables كاملة** مع Zod validation | متوسطة |
| `import-export.service.ts` | **دعم ODS + Google Sheets + PDF + تشفير** | متوسطة |
| `conversion.service.ts` | **تحويل تقويم هجري/ميلادي + عملات** | متوسطة |
| `formula-functions/*.ts` | **11 مجموعة دوال** (مالية + إحصائية + تاريخ + ...) | متوسطة |
| `professional-formatting.service.ts` | **تنسيق احترافي** للجداول والخلايا | منخفضة |
| `accuracy-audit.service.ts` | **تدقيق الدقة** — يتحقق من صحة البيانات | منخفضة |

---

## 3. نظام القوالب (06_template_core) — مفيد

### قطع الغيار:

| الملف | لماذا مهم | الأولوية |
|-------|----------|---------|
| `template.service.ts` | **4 محركات render** (Handlebars/Mustache/EJS/Nunjucks) | متوسطة |
| `version-control.service.ts` | **نظام إصدارات Git-like** للقوالب — branches + diffs | متوسطة |
| `template-manager.service.ts` | **إدارة القوالب** حسب النوع والفئة | منخفضة |

---

## 4. عقود الـ Schemas (07_schema_contracts) — جاهز للاستخدام فورًا

**522 ملف JSON** — كل واحد يعرّف input/output لأداة AI.

| المجال | عدد الملفات | أبرز الأدوات |
|--------|-----------|-------------|
| **slides** | 114 | أكبر مجموعة — أدوات إنشاء وتحرير الشرائح |
| **lct** | 74 | Layout Control — تحكم بالتخطيط |
| **rased** | 74 | أدوات نظام راصد العامة |
| **strict** | 74 | أدوات المطابقة الصارمة |
| **report** | 70 | أدوات التقارير |
| **excel** | 66 | أدوات Excel |
| **dash** | 50 | أدوات لوحات المؤشرات |

**التوصية:** هذه الـ schemas يمكن استخدامها **فورًا** كعقود لـ AI tool calling. كل schema يحدد بالضبط ما يدخل وما يخرج.

---

## 5. الواجهة البصرية (08_visual_dna) — مرجع فقط

**ليست قطع غيار مباشرة** — الواجهة الحالية (من المصمم) أحدث وأفضل. لكن فيها أفكار مفيدة:

| المكوّن | فكرة مفيدة |
|---------|-----------|
| `ChatCanvas.tsx` | الـ setup modes (8 أنواع) + drag-drop + streaming |
| `DashboardLayout.tsx` | Resizable sidebar (200-480px) + localStorage |
| `StudioPanel.tsx` | Compact single-column layout + stagger animations |
| `Home.tsx` | Glass morphism + keyboard shortcuts |

---

## التوصية النهائية للمنفذين

### أولوية قصوى — استخدمها كـ reference implementation:
1. **`pixel-validation-loop.service.ts`** — هذا هو قلب المطابقة البصرية
2. **`canonical-pipeline-orchestrator.service.ts`** — المنسق الرئيسي
3. **`data-extraction.service.ts`** — استخراج البيانات من الصور
4. **`07_schema_contracts/`** — 522 عقد JSON جاهز

### أولوية عالية — أعد استخدامها مع تعديل:
5. **`formula-engine.service.ts`** — محرك صيغ Excel متقدم
6. **`chart-builder.service.ts`** — رسوم بيانية ChartJS
7. **`arabic-typography-optimizer.service.ts`** — تيبوغرافيا عربية
8. **`pdf-intelligence.service.ts`** — تحليل PDF

### أولوية متوسطة — مرجع مفيد:
9. **`quality-validation.service.ts`** — التحقق من الجودة
10. **`version-control.service.ts`** — إصدارات القوالب
11. **`excel-ultra-engine.service.ts`** — SMART/PRO modes
12. **`import-export.service.ts`** — تنسيقات متعددة

### المكتبات المطلوبة (ليست في مشروعنا الحالي):
```
pixelmatch    — مقارنة بكسلات (مجاني)
sharp         — معالجة صور (مجاني)
canvas        — رسم (مجاني)
pdf-parse     — تحليل PDF (مجاني)
hot-formula-parser — محرك صيغ (مجاني)
decimal.js    — دقة رقمية (مجاني)
chart.js + chartjs-node-canvas — رسوم بيانية (مجاني)
pdfkit        — توليد PDF (مجاني)
```

---

## ملاحظة مهمة

الكود في الـ seed **يعتمد على Prisma + Redis + Express** كبنية تحتية. مشروعنا الحالي يستخدم **sql.js + tRPC**. لذا الاستخدام يكون:
- **انسخ المنطق والخوارزميات** (الـ algorithms)
- **لا تنسخ البنية التحتية** (الـ infrastructure)
- **أعد كتابة الاتصال بقاعدة البيانات** لتعمل مع sql.js
