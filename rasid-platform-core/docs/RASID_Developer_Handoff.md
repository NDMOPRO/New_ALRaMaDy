# وثيقة التسليم التنفيذي — منصة راصد البيانات

**الإصدار:** 2.0  
**التاريخ:** 16 مارس 2026  
**المشروع:** راصد البيانات — منصة الذكاء الاصطناعي لإدارة البيانات الوطنية  
**الجهة:** مكتب إدارة البيانات الوطنية (NDMO)  
**التصنيف:** وثيقة تنفيذية داخلية  

---

## جدول المحتويات

1. [نظرة عامة على المنصة](#1-نظرة-عامة-على-المنصة)
2. [الهوية البصرية (Visual DNA)](#2-الهوية-البصرية-visual-dna)
3. [هندسة التخطيط (Layout Architecture)](#3-هندسة-التخطيط-layout-architecture)
4. [المنطقة الأولى: الشريط العلوي (NotebookHeader)](#4-المنطقة-الأولى-الشريط-العلوي-notebookheader)
5. [المنطقة الثانية: لوحة البيانات (DataPanel)](#5-المنطقة-الثانية-لوحة-البيانات-datapanel)
6. [المنطقة الثالثة: راصد الذكي (ChatCanvas)](#6-المنطقة-الثالثة-راصد-الذكي-chatcanvas)
7. [المنطقة الرابعة: الاستوديو (StudioPanel)](#7-المنطقة-الرابعة-الاستوديو-studiopanel)
8. [نظام مساحات العمل (Workspace Views)](#8-نظام-مساحات-العمل-workspace-views)
9. [نظام الحوارات والمعالجات (Wizards)](#9-نظام-الحوارات-والمعالجات-wizards)
10. [نظام السحب والإفلات (Drag & Drop)](#10-نظام-السحب-والإفلات-drag--drop)
11. [نظام الحركة والانتقالات (Animations)](#11-نظام-الحركة-والانتقالات-animations)
12. [نظام الأصوات التفاعلية](#12-نظام-الأصوات-التفاعلية)
13. [نظام الألوان والمتغيرات (Design Tokens)](#13-نظام-الألوان-والمتغيرات-design-tokens)
14. [هندسة الخادم وقاعدة البيانات](#14-هندسة-الخادم-وقاعدة-البيانات)
15. [هيكل الملفات الكامل](#15-هيكل-الملفات-الكامل)
16. [التجاوب والأجهزة المتعددة](#16-التجاوب-والأجهزة-المتعددة)
17. [ملحق: قائمة المكونات الكاملة](#17-ملحق-قائمة-المكونات-الكاملة)

---

## 1. نظرة عامة على المنصة

### 1.1 الرؤية

منصة **راصد البيانات** هي منصة ذكاء اصطناعي سيادية مصممة لمكتب إدارة البيانات الوطنية (NDMO) في المملكة العربية السعودية. تهدف المنصة إلى تمكين المستخدمين من تحليل البيانات الحكومية، إنشاء التقارير والعروض التقديمية، وبناء لوحات المؤشرات — كل ذلك عبر واجهة محادثة ذكية باللغة العربية.

### 1.2 الفلسفة التصميمية

> **"القوة المخفية"** — واجهة بسيطة تخفي قدرات هائلة. المستخدم يرى فقط ما يحتاجه في اللحظة المناسبة.

المنصة تتبنى نموذج **"دفتر الملاحظات الذكي" (Intelligent Notebook)** حيث:

- **راصد الذكي** هو المركز البصري والوظيفي الدائم — يظهر في كل الشاشات بلا استثناء
- **لوحة البيانات** تمثل المدخلات (الجانب الأيمن)
- **الاستوديو** يمثل المخرجات (الجانب الأيسر)
- **الشريط العلوي** يوفر التنقل والهوية المؤسسية

### 1.3 المكدس التقني

| الطبقة | التقنية | الإصدار |
|--------|---------|---------|
| الواجهة الأمامية | React + TypeScript | 19.x + 5.9 |
| التنسيق | Tailwind CSS | 4.x |
| المكونات | shadcn/ui + مكونات مخصصة | — |
| الحالة | React Context + tRPC | 11.x |
| الخادم | Express + tRPC | 4.x + 11.x |
| قاعدة البيانات | MySQL/TiDB + Drizzle ORM | — |
| الخطوط | DIN Next Arabic, Tajawal, Objectivity | — |
| الأيقونات | Google Material Symbols (Outlined) | — |
| الذكاء الاصطناعي | OpenAI API (عبر وسيط داخلي) | — |

---

## 2. الهوية البصرية (Visual DNA)

### 2.1 فلسفة التصميم

التصميم يتبع مبدأ **"المؤسسي الهادئ"** — لا مبالغة في التأثيرات، لا ألوان صارخة، لا حركات مشتتة. كل عنصر يخدم غرضاً وظيفياً واضحاً.

### 2.2 الخطوط

| الاستخدام | الخط | الأوزان |
|-----------|------|---------|
| النصوص العربية الأساسية | Tajawal | 300, 400, 500, 700 |
| العناوين العربية الرسمية | DIN Next Arabic | 300, 400, 500 |
| النصوص الإنجليزية والأرقام | Objectivity | 300, 400, 500, 700 |
| النصوص العربية البديلة | Helvetica Neue Arabic | 300, 400, 700 |
| الأيقونات | Google Symbols (Material) | 400 |

### 2.3 لوحة الألوان الأساسية

#### الوضع الفاتح (Light Mode)

| الدور | القيمة OKLCH | الوصف |
|-------|-------------|-------|
| Primary | `oklch(0.28 0.09 250)` | الأزرق الملكي الداكن — اللون السيادي |
| Background | `oklch(0.98 0.002 240)` | أبيض مائل للرمادي الخفيف |
| Card | `oklch(1 0 0)` | أبيض نقي للبطاقات |
| Foreground | `oklch(0.16 0.03 250)` | أسود مائل للأزرق |
| Border | `oklch(0.925 0.004 250)` | حدود رمادية خفيفة جداً |
| Canvas BG | `oklch(0.965 0.004 250)` | خلفية مساحة العمل |
| Muted | `oklch(0.965 0.003 250)` | أسطح خافتة |
| Gold | `oklch(0.72 0.14 75)` | ذهبي للاستوديو والتمييز |

#### الوضع الداكن (Dark Mode)

| الدور | القيمة OKLCH | الوصف |
|-------|-------------|-------|
| Primary | `oklch(0.56 0.14 250)` | أزرق ملكي أفتح للقراءة |
| Background | `oklch(0.14 0.022 250)` | أسود مائل للأزرق العميق |
| Card | `oklch(0.18 0.018 250)` | رمادي داكن للبطاقات |
| Foreground | `oklch(0.93 0.004 250)` | أبيض مائل للرمادي |
| Border | `oklch(0.27 0.018 250)` | حدود رمادية داكنة |
| Canvas BG | `oklch(0.12 0.018 250)` | خلفية مساحة العمل الداكنة |
| Gold | `oklch(0.78 0.12 75)` | ذهبي أفتح للوضع الداكن |

#### ألوان الحالة (Status Colors)

| الحالة | الوضع الفاتح | الوضع الداكن | الاستخدام |
|--------|-------------|-------------|-----------|
| Success | `oklch(0.55 0.17 155)` | `oklch(0.62 0.15 155)` | جاهز، مكتمل، نجاح |
| Warning | `oklch(0.65 0.17 65)` | `oklch(0.72 0.15 65)` | قيد المعالجة، تنبيه |
| Danger | `oklch(0.55 0.22 25)` | `oklch(0.62 0.2 25)` | فشل، خطأ، حذف |
| Info | `oklch(0.55 0.15 240)` | `oklch(0.62 0.13 240)` | معلومات، مراجعة |

### 2.4 نظام الظلال والحدود

```css
/* البطاقات والألواح */
border: 1px solid oklch(0.925 0.004 250);     /* حدود خفيفة جداً */
border-radius: 0.75rem;                        /* --radius الافتراضي */
box-shadow: 0 1px 2px oklch(0 0 0 / 0.04);   /* ظل خفيف */

/* Hover على البطاقات */
box-shadow: 0 4px 12px oklch(0 0 0 / 0.06);  /* ارتفاع خفيف */
transform: translateY(-1px);                   /* رفع 1px */

/* الزجاج (Glassmorphism) */
.glass {
  background: oklch(1 0 0 / 0.7);            /* شفافية 70% */
  backdrop-filter: blur(12px) saturate(1.3);  /* ضبابية ناعمة */
  border: 1px solid oklch(1 0 0 / 0.3);      /* حد شفاف */
}
```

### 2.5 نظام المسافات

| المستوى | القيمة | الاستخدام |
|---------|--------|-----------|
| xs | 4px (0.25rem) | بين الأيقونة والنص |
| sm | 8px (0.5rem) | بين العناصر المتجاورة |
| md | 12px (0.75rem) | padding داخل البطاقات |
| lg | 16px (1rem) | بين الأقسام |
| xl | 24px (1.5rem) | بين المناطق الرئيسية |
| 2xl | 32px (2rem) | هوامش الصفحة |

---

## 3. هندسة التخطيط (Layout Architecture)

### 3.1 نموذج المناطق الأربع

الصفحة الرئيسية مقسمة إلى أربع مناطق ثابتة في تخطيط Flexbox عمودي:

```
┌─────────────────────────────────────────────────────────────┐
│                    الشريط العلوي (Header)                    │  ← h-14 ثابت
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│  لوحة    │       مساحة العمل المركزية        │  الاستوديو   │
│ البيانات │    (ChatCanvas + WorkspaceView)   │  (Studio)    │
│  (Data)  │                                  │               │
│          │                                  │               │
│  يمين    │           المركز                  │    يسار      │
│ w-[340px]│          flex-1                   │  w-[200px]   │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│                  شريط التنقل السفلي (موبايل فقط)             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 حالات التخطيط

| الحالة | لوحة البيانات | المركز | الاستوديو | الوصف |
|--------|--------------|--------|-----------|-------|
| الافتراضية (Desktop) | مفتوحة w-[340px] | flex-1 | مفتوح w-[200px] | كل الألواح مرئية |
| بيانات مطوية | شريط w-[52px] | flex-1 (أوسع) | مفتوح | اللوح الأيمن مطوي |
| استوديو مطوي | مفتوحة | flex-1 (أوسع) | شريط w-[52px] | اللوح الأيسر مطوي |
| وضع التركيز | شريط w-[52px] | flex-1 (أقصى عرض) | شريط w-[52px] | كلاهما مطوي |
| موبايل | مخفية/drawer | كامل العرض | مخفي/drawer | أدراج من الجوانب |

### 3.3 الشريط المطوي (CollapsedRail)

عند طي أي لوح جانبي، يتحول إلى شريط عمودي أنيق بعرض 52px:

```tsx
// CollapsedRail — مكوّن موحّد لكلا اللوحين
<div className="w-[52px] h-full">
  <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
    {/* زر التوسيع */}
    <button className="w-10 h-10 rounded-xl bg-primary/8 hover:bg-primary/15">
      <MaterialIcon icon={icon} size={20} />
    </button>
    {/* مؤشرات بصرية */}
    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse-soft" />
    {/* نص عمودي */}
    <span className="writing-mode-vertical text-[9px]">{label}</span>
    {/* عداد العناصر */}
    <div className="w-7 h-7 rounded-lg bg-primary/10">
      <span className="text-[10px] font-bold">{count}</span>
    </div>
  </div>
</div>
```

### 3.4 قاعدة ChatCanvas الإلزامية

> **متطلب صارم:** مربع المحادثة (ChatCanvas) يجب أن يكون مرئياً في **جميع الشاشات بلا استثناء**.

| تبويب مساحة العمل | سلوك ChatCanvas |
|-------------------|-----------------|
| المحادثة (chat) | يأخذ المساحة المركزية الكاملة |
| أي تبويب آخر | يظهر كشريط جانبي مفتوح (w-[380px]) بجانب المحتوى |
| موبايل (غير chat) | زر عائم (FAB) في الزاوية السفلية اليسرى يفتح ChatCanvas كـ overlay |

```tsx
// في Home.tsx — ChatCanvas دائماً مرئي
{activeView === 'chat' ? (
  <ChatCanvas ref={chatCanvasRef} /* ... */ />
) : (
  <div className="flex flex-1 min-w-0">
    {/* محتوى مساحة العمل */}
    <AnimatedWorkspace activeView={activeView}>
      <WorkspaceView view={activeView} />
    </AnimatedWorkspace>
    {/* ChatCanvas كشريط جانبي — دائماً مرئي */}
    <div className="w-[380px] border-r border-border/30">
      <ChatCanvas ref={chatCanvasRef} /* ... */ />
    </div>
  </div>
)}
```

---

## 4. المنطقة الأولى: الشريط العلوي (NotebookHeader)

### 4.1 التخطيط

```
┌───────────────────────────────────────────────────────────────────┐
│  [أزرار الإجراءات]  │  [تبويبات مساحة العمل]  │  [شعار NDMO + راصد]  │
│      يسار           │        المركز            │        يمين          │
└───────────────────────────────────────────────────────────────────┘
```

> **ملاحظة:** التخطيط بنظام RTL — الشعار على اليمين والأزرار على اليسار.

### 4.2 الجانب الأيمن — الهوية المؤسسية

```tsx
{/* شعار راصد مع أنيميشن */}
<div className="rasid-logo-animated">
  <div className="rasid-logo-ring" />        {/* حلقة conic-gradient دوّارة */}
  <div className="rasid-logo-pulse" />        {/* نبض ضوئي */}
  <img src={LOGOS[themeLogoKey]} />            {/* الشعار حسب الثيم */}
</div>

{/* اسم المنصة */}
<span className="text-lg font-bold">راصد البيانات</span>
<span className="text-xs text-muted-foreground">أحد مبادرات مكتب إدارة البيانات الوطنية</span>

{/* شعار NDMO بألوانه الطبيعية */}
<div className="bg-white rounded-lg p-1.5">
  <img src={NDMO_LOGO} className="h-8" />     {/* بدون فلاتر — ألوان طبيعية */}
</div>
```

#### أنيميشن شعار راصد

```css
.rasid-logo-animated {
  position: relative;
  width: 44px; height: 44px;
}
.rasid-logo-ring {
  position: absolute; inset: -3px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    oklch(0.28 0.09 250),      /* أزرق ملكي */
    oklch(0.72 0.14 75),        /* ذهبي */
    oklch(0.28 0.09 250)
  );
  animation: rasid-ring-spin 4s linear infinite;
  mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
}
.rasid-logo-pulse {
  position: absolute; inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow) 0%, transparent 70%);
  animation: rasid-logo-breathe 3s ease-in-out infinite;
}
@keyframes rasid-ring-spin { to { transform: rotate(360deg); } }
@keyframes rasid-logo-breathe {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}
```

### 4.3 المركز — تبويبات مساحة العمل

تبويبات التنقل بين أقسام مساحة العمل مع مؤشر منزلق متحرك:

```tsx
const WORKSPACE_VIEWS = [
  { id: 'chat',          label: 'المحادثة',  icon: 'chat_bubble_outline' },
  { id: 'data',          label: 'بياناتي',   icon: 'table_chart' },
  { id: 'presentations', label: 'عروضي',     icon: 'slideshow' },
  { id: 'reports',       label: 'تقاريري',   icon: 'article' },
  { id: 'dashboard',     label: 'لوحاتي',    icon: 'dashboard' },
  { id: 'extraction',    label: 'تفريغ',     icon: 'document_scanner' },
  { id: 'translation',   label: 'ترجمة',     icon: 'translate' },
  { id: 'matching',      label: 'مطابقة',    icon: 'compare' },
  { id: 'library',       label: 'مكتبتي',    icon: 'folder_open' },
];
```

المؤشر المنزلق (sliding indicator) يتحرك بسلاسة تحت التبويب النشط:

```tsx
<div
  className="absolute bottom-0 h-[2.5px] rounded-full bg-primary transition-all duration-300"
  style={{ width: `${activeTabWidth}px`, transform: `translateX(${activeTabOffset}px)` }}
/>
```

### 4.4 الجانب الأيسر — أزرار الإجراءات

| الزر | الأيقونة | الوظيفة |
|------|---------|---------|
| مساحة جديدة | `add` | إنشاء مساحة عمل جديدة |
| تركيز | `center_focus_strong` | طي كلا اللوحين الجانبيين |
| التحكم | `tune` | فتح إعدادات المساحة |
| مشاركة | `share` | مشاركة المحتوى |
| تحديث | `refresh` | تحديث البيانات |
| إعدادات | `settings` | فتح قائمة الإعدادات |
| وضع مضغوط | `density_small/medium` | تبديل كثافة العرض |
| صوت | `volume_up/off` | تفعيل/كتم الأصوات |
| إشعارات | `notifications` | عرض الإشعارات |
| تحليلات | `bar_chart` | فتح التحليلات |
| الملف الشخصي | صورة المستخدم | فتح القائمة المنسدلة |

---

## 5. المنطقة الثانية: لوحة البيانات (DataPanel)

### 5.1 الهيكل

```
┌─────────────────────────┐
│  العنوان: البيانات    ✕  │  ← شريط العنوان مع زر الإغلاق
├─────────────────────────┤
│  🔍 ابحث...    ☰ الكل ▾ │  ← بحث + فلتر النوع
├─────────────────────────┤
│  ⊕ إضافة مصدر بيانات    │  ← زر إضافة مصدر
├─────────────────────────┤
│                         │
│  قائمة عناصر البيانات    │  ← عناصر قابلة للسحب
│  (DataItemRow × n)      │
│                         │
├─────────────────────────┤
│  📋 النماذج              │  ← قسم القوالب
│  ├ قالب تقرير الامتثال   │
│  └ قالب عرض تقديمي      │
└─────────────────────────┘
```

### 5.2 عنصر البيانات (DataItemRow)

كل عنصر بيانات يعرض:

```tsx
<div
  draggable                                    // قابل للسحب
  onDragStart={handleDragStart}                // يرسل بيانات العنصر
  className="group flex items-center gap-2.5 px-3 py-2 rounded-xl
             hover:bg-accent/50 transition-all duration-200
             cursor-grab active:cursor-grabbing"
>
  {/* مقبض السحب — يظهر عند hover */}
  <MaterialIcon icon="drag_indicator" className="opacity-0 group-hover:opacity-40" />
  {/* أيقونة النوع */}
  <MaterialIcon icon={item.icon} />
  {/* العنوان والحجم */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium truncate">{item.title}</p>
    <p className="text-xs text-muted-foreground">{item.size}</p>
  </div>
  {/* شارة الحالة */}
  <StatusBadge status={item.status} />
  {/* قائمة السياق */}
  <ContextMenu items={DATA_ITEM_MENU} />
</div>
```

### 5.3 أنواع البيانات وحالاتها

| النوع | الأيقونة | الوصف |
|-------|---------|-------|
| file | `table_chart` / `description` | ملف بيانات (Excel, CSV, PDF) |
| table | `grid_on` | جدول بيانات |
| group | `folder` | مجموعة ملفات |
| flow | `account_tree` | تدفق معالجة بيانات |

| الحالة | اللون | الخلفية | الوصف |
|--------|-------|---------|-------|
| ready | `#059669` | `#ecfdf5` | جاهز للاستخدام |
| processing | `#d97706` | `#fffbeb` | قيد المعالجة |
| review | `#2563eb` | `#eff6ff` | يحتاج مراجعة |
| failed | `#dc2626` | `#fef2f2` | فشل في المعالجة |
| merged | `#7c3aed` | `#f5f3ff` | تم الدمج |

### 5.4 بيانات السحب (Drag Data)

عند سحب عنصر من لوحة البيانات:

```typescript
// DataPanel → dragStart
e.dataTransfer.setData('application/rasid-data', JSON.stringify({
  id: item.id,
  title: item.title,
  type: item.type,
  icon: item.icon,
}));
e.dataTransfer.effectAllowed = 'copy';
```

---

## 6. المنطقة الثالثة: راصد الذكي (ChatCanvas)

### 6.1 المتطلب الإلزامي

> **راصد الذكي يجب أن يكون مرئياً في كل الشاشات بلا استثناء.** هذا ليس اقتراحاً — إنه متطلب تصميمي صارم.

### 6.2 هيكل ChatCanvas

```
┌─────────────────────────────────────────┐
│  🟢 راصد الذكي          ⋮  │  ← شريط العنوان + قائمة خيارات
├─────────────────────────────────────────┤
│                                         │
│         [صورة شخصية راصد]               │  ← حالة الترحيب (فارغة)
│     "أنت تأمر وأنا أطامر"              │
│  اكتب طلبك بلغتك الطبيعية              │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ تحليل    │ │ لوحة     │ │ إنشاء    │ │  ← أزرار الإجراءات السريعة
│  │ البيانات │ │ مؤشرات  │ │ تقرير   │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ مقارنة   │ │ تنظيف    │ │ دمج      │ │
│  │ جهات    │ │ البيانات │ │ الجداول  │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                         │
├─────────────────────────────────────────┤
│  ↑  │ اكتب طلبك هنا... 🎤 📎          │  ← منطقة الإدخال
├─────────────────────────────────────────┤
│  منصة راصد الذكي — مكتب إدارة البيانات  │  ← التذييل
└─────────────────────────────────────────┘
```

### 6.3 الإجراءات السريعة (Quick Actions)

| الإجراء | الأيقونة | الوصف |
|---------|---------|-------|
| تحليل البيانات | `analytics` | تحليل شامل للبيانات المرفوعة |
| إنشاء لوحة مؤشرات | `dashboard` | لوحة مؤشرات تفاعلية |
| إنشاء تقرير | `description` | تقرير احترافي جاهز |
| مقارنة جهات | `compare` | مقارنة بين جهتين أو أكثر |
| تنظيف البيانات | `cleaning_services` | تنظيف وتوحيد البيانات |
| دمج الجداول | `merge_type` | دمج جداول متعددة |

### 6.4 منطقة الإدخال

```tsx
<div className="border-t border-border/30 p-3">
  <div className="flex items-end gap-2 bg-card rounded-2xl border border-border/40 px-4 py-3">
    {/* زر الإرسال */}
    <button className="w-9 h-9 rounded-xl bg-primary text-primary-foreground">
      <MaterialIcon icon="arrow_upward" />
    </button>
    {/* حقل الإدخال */}
    <textarea
      placeholder="اكتب طلبك هنا... أو اسحب ملفاً"
      className="flex-1 resize-none bg-transparent"
      dir="rtl"
    />
    {/* أزرار الوسائط */}
    <button><MaterialIcon icon="mic" /></button>           {/* تسجيل صوتي */}
    <button><MaterialIcon icon="attach_file" /></button>   {/* إرفاق ملف */}
  </div>
</div>
```

### 6.5 استقبال السحب والإفلات

عند إسقاط عنصر بيانات في ChatCanvas:

```typescript
// ChatCanvas → onDrop
const rasidData = e.dataTransfer.getData('application/rasid-data');
if (rasidData) {
  const item = JSON.parse(rasidData);
  // إضافة طلب تحليل تلقائي
  setInput(`حلل لي "${item.title}"`);
  // تأثير بصري: snap animation
  setDropAnimation(true);
}
```

### 6.6 حالات ChatCanvas

| الحالة | العرض |
|--------|-------|
| فارغ (ترحيب) | صورة راصد + رسالة ترحيب + أزرار سريعة |
| محادثة نشطة | رسائل المستخدم + ردود راصد (Markdown) |
| جاري المعالجة | مؤشر كتابة (typing indicator) + شريط تقدم |
| خطأ | رسالة خطأ مع زر إعادة المحاولة |
| منطقة إفلات | overlay أزرق شفاف مع أيقونة إفلات |

---

## 7. المنطقة الرابعة: الاستوديو (StudioPanel)

### 7.1 الهيكل

```
┌───────────────────────┐
│  الاستوديو          ✕  │  ← شريط العنوان
├───────────────────────┤
│  أدوات الإنشاء        │  ← عنوان القسم
│  ┌─────────────────┐  │
│  │ 📊 لوحة مؤشرات  │  │
│  │ 📄 تقرير        │  │
│  │ 📽 عرض          │  │  ← أدوات الإنشاء (7 أدوات)
│  │ 🔄 مطابقة       │  │
│  │ 🌐 تعريب        │  │
│  │ 📋 تفريغ        │  │
│  │ 🔤 ترجمة        │  │
│  └─────────────────┘  │
│  ┌─────────────────┐  │
│  │ ＋ إنشاء مخرج   │  │  ← زر إنشاء مخرج جديد
│  └─────────────────┘  │
├───────────────────────┤
│  المخرجات             │  ← قسم المخرجات المحفوظة
│  (فارغ / قائمة)       │
└───────────────────────┘
```

### 7.2 أدوات الإنشاء (Studio Tools)

| الأداة | المعرف | الأيقونة | اللون | الوصف |
|--------|--------|---------|-------|-------|
| لوحة مؤشرات | `dashboard` | `dashboard` | `#1e40af` | لوحة مؤشرات تفاعلية |
| تقرير | `report` | `description` | `#059669` | تقرير احترافي |
| عرض | `presentation` | `slideshow` | `#d97706` | عرض شرائح |
| مطابقة | `matching` | `compare` | `#7c3aed` | مطابقة بصرية |
| تعريب | `arabization` | `g_translate` | `#0891b2` | تعريب المحتوى |
| تفريغ | `extraction` | `text_snippet` | `#dc2626` | استخراج نصوص |
| ترجمة | `translation` | `translate` | `#4f46e5` | ترجمة متعددة |

### 7.3 سلوك النقر على أداة

عند النقر على أي أداة إنشاء:
1. يتم إرسال أمر إلى ChatCanvas عبر `chatCanvasRef`
2. راصد الذكي يبدأ معالج (Wizard) داخل المحادثة
3. المعالج يجمع المتطلبات خطوة بخطوة
4. النتيجة تظهر في مساحة العمل المناسبة

---

## 8. نظام مساحات العمل (Workspace Views)

### 8.1 المحركات (Engines)

كل تبويب في مساحة العمل يُحمّل محركاً مخصصاً:

| التبويب | المكوّن | الوصف |
|---------|--------|-------|
| المحادثة | `ChatCanvas` | المحادثة مع راصد الذكي |
| بياناتي | `ExcelEngine` | عرض وتحرير البيانات بأسلوب Excel |
| عروضي | `PresentationsEngine` | إنشاء وتحرير العروض التقديمية |
| تقاريري | `ReportsEngine` | إنشاء وتحرير التقارير |
| لوحاتي | `DashboardEngine` | بناء لوحات المؤشرات |
| تفريغ | `ExtractionEngine` | استخراج النصوص من الملفات |
| ترجمة | `TranslationEngine` | ترجمة المحتوى |
| مطابقة | `VisualMatchEngine` | مطابقة بصرية للمستندات |
| مكتبتي | `LibraryEngine` | مكتبة العناصر والقوالب |

### 8.2 الانتقالات بين المساحات

مكوّن `AnimatedWorkspace` يوفر انتقالات اتجاهية:

```tsx
// الاتجاه يُحسب من فهرس التبويب
const direction = newIndex > oldIndex ? 'left' : 'right';

// CSS Animations
.ws-enter-from-left  { animation: wsSlideInLeft 300ms ease-out; }
.ws-enter-from-right { animation: wsSlideInRight 300ms ease-out; }
.ws-exit-to-left     { animation: wsSlideOutLeft 200ms ease-in; }
.ws-exit-to-right    { animation: wsSlideOutRight 200ms ease-in; }
```

---

## 9. نظام الحوارات والمعالجات (Wizards)

### 9.1 المعالجات المتاحة

عند طلب إنشاء مخرج (تقرير، عرض، لوحة مؤشرات)، يعمل المعالج داخل ChatCanvas:

```
المستخدم: "أنشئ تقرير امتثال"
    ↓
راصد: "ما هي الجهات المطلوبة؟" [اختيار متعدد]
    ↓
المستخدم: يختار الجهات
    ↓
راصد: "ما الفترة الزمنية؟" [اختيار]
    ↓
المستخدم: يختار الفترة
    ↓
راصد: "جاري إنشاء التقرير..." [شريط تقدم]
    ↓
راصد: "تم إنشاء التقرير بنجاح" [رابط للعرض]
```

### 9.2 الحوارات المنبثقة

| الحوار | المكوّن | الوظيفة |
|--------|--------|---------|
| إضافة مصدر | `AddSourceDialog` | رفع ملفات أو ربط مصادر بيانات |
| مشاركة | `ShareDialog` | مشاركة المحتوى مع مستخدمين آخرين |
| تحليلات | `AnalyticsDialog` | عرض إحصائيات الاستخدام |
| إعدادات | `SettingsMenu` | قائمة الإعدادات المنسدلة |
| البحث الشامل | `CommandPalette` | بحث سريع (Ctrl+K) |

---

## 10. نظام السحب والإفلات (Drag & Drop)

### 10.1 تدفق السحب

```
DataPanel (المصدر)
    │
    ├── dragStart: إعداد البيانات في dataTransfer
    │   └── 'application/rasid-data': { id, title, type, icon }
    │
    ├── أثناء السحب: مقبض drag_indicator يظهر
    │
    └── ChatCanvas (الهدف)
        ├── dragOver: إظهار overlay الإفلات
        │   └── خلفية زرقاء شفافة + أيقونة + نص
        ├── drop: استقبال البيانات
        │   ├── تحليل نوع البيانات
        │   ├── إضافة طلب تحليل تلقائي في حقل الإدخال
        │   └── تشغيل snap animation
        └── dragLeave: إخفاء overlay
```

### 10.2 التأثيرات البصرية

```css
/* منطقة الإفلات النشطة */
.drop-zone-active {
  background: oklch(0.28 0.09 250 / 0.08);
  border: 2px dashed oklch(0.28 0.09 250 / 0.3);
  animation: dropZonePulse 1.5s ease-in-out infinite;
}

/* Snap animation عند الإسقاط */
@keyframes snapIn {
  0% { transform: scale(1.1); opacity: 0.7; }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
}
```

---

## 11. نظام الحركة والانتقالات (Animations)

### 11.1 فئات الحركة

| الفئة | المدة | التوقيت | الاستخدام |
|-------|-------|---------|-----------|
| Micro | 150ms | ease-out | hover, focus, toggle |
| Standard | 300ms | ease-out | فتح/إغلاق ألواح، تبديل تبويبات |
| Emphasis | 500ms | cubic-bezier(0.34, 1.56, 0.64, 1) | ظهور عناصر جديدة |
| Ambient | 3-8s | ease-in-out | خلفيات متحركة، نبض |

### 11.2 الحركات الأساسية (Keyframes)

```css
/* طفو خفيف */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

/* نبض ناعم */
@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* توهج نابض */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--glow); }
  50% { box-shadow: 0 0 20px 4px var(--glow); }
}

/* دخول من الأسفل */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* دخول الشريط المطوي */
@keyframes rail-enter {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* خلفية ambient متحركة */
@keyframes ambient-drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.15; }
  33% { transform: translate(30px, -20px) scale(1.1); opacity: 0.2; }
  66% { transform: translate(-20px, 15px) scale(0.95); opacity: 0.12; }
}
```

### 11.3 الخلفية المتحركة (AmbientBackground)

```tsx
function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* كرة ضوئية أولى — أزرق */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full
                      bg-primary/8 blur-3xl animate-ambient-1" />
      {/* كرة ضوئية ثانية — ذهبي */}
      <div className="absolute bottom-1/3 left-1/3 w-80 h-80 rounded-full
                      bg-gold/5 blur-3xl animate-ambient-2" />
      {/* كرة ضوئية ثالثة — أزرق فاتح */}
      <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full
                      bg-info/4 blur-3xl animate-ambient-3" />
    </div>
  );
}
```

---

## 12. نظام الأصوات التفاعلية

### 12.1 المحرك الصوتي

النظام يستخدم **Web Audio API** لتوليد أصوات مُصنّعة (لا ملفات صوتية خارجية):

```typescript
// client/src/lib/sounds.ts
class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean;           // يُحفظ في localStorage

  // أصوات مُصنّعة بالكامل
  playClick()        // نقرة خفيفة — sine wave 800Hz, 50ms
  playHover()        // تمرير — sine wave 600Hz, 30ms
  playSuccess()      // نجاح — chord C5+E5+G5, 200ms
  playError()        // خطأ — sawtooth 200Hz, 300ms
  playNotification() // إشعار — bell-like 1000Hz→800Hz, 400ms
  playWhoosh()       // انتقال — noise sweep, 150ms
  playDrop()         // إسقاط — thud 150Hz, 100ms
}

export const soundEngine = new SoundEngine();
```

### 12.2 نقاط التشغيل

| الحدث | الصوت | المكوّن |
|-------|-------|--------|
| نقر زر | `playClick()` | NotebookHeader, StudioPanel |
| تبديل ثيم | `playWhoosh()` | NotebookHeader |
| فتح البحث | `playWhoosh()` | CommandPalette |
| نتيجة بحث | `playClick()` | CommandPalette |
| إشعار جديد | `playNotification()` | NotificationContext |
| إسقاط عنصر | `playDrop()` | ChatCanvas |
| نجاح عملية | `playSuccess()` | عام |
| خطأ | `playError()` | عام |

### 12.3 التحكم

- زر تبديل الصوت في الشريط العلوي (أيقونة `volume_up` / `volume_off`)
- الحالة تُحفظ في `localStorage('rasid-sounds-enabled')`
- الأصوات معطلة افتراضياً — تُفعّل بنقر المستخدم

---

## 13. نظام الألوان والمتغيرات (Design Tokens)

### 13.1 متغيرات CSS الكاملة

```css
:root {
  /* الأساسيات */
  --radius: 0.75rem;
  --background: oklch(0.98 0.002 240);
  --foreground: oklch(0.16 0.03 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.16 0.03 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.16 0.03 250);

  /* الأزرق الملكي */
  --primary: oklch(0.28 0.09 250);
  --primary-foreground: oklch(1 0 0);

  /* الأسطح */
  --secondary: oklch(0.97 0.003 250);
  --secondary-foreground: oklch(0.32 0.02 250);
  --muted: oklch(0.965 0.003 250);
  --muted-foreground: oklch(0.50 0.012 250);
  --accent: oklch(0.96 0.006 250);
  --accent-foreground: oklch(0.16 0.03 250);

  /* الحالة */
  --destructive: oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.985 0 0);

  /* الحدود */
  --border: oklch(0.925 0.004 250);
  --input: oklch(0.925 0.004 250);
  --ring: oklch(0.28 0.09 250);

  /* التخطيط */
  --canvas-bg: oklch(0.965 0.004 250);
  --panel-bg: oklch(1 0 0);
  --glow: oklch(0.28 0.09 250 / 0.10);

  /* البيانات */
  --success: oklch(0.55 0.17 155);
  --warning: oklch(0.65 0.17 65);
  --danger: oklch(0.55 0.22 25);
  --info: oklch(0.55 0.15 240);
  --gold: oklch(0.72 0.14 75);
}
```

### 13.2 فئات CSS المخصصة

| الفئة | الوظيفة |
|-------|---------|
| `.glass` | تأثير الزجاج (backdrop-blur + شفافية) |
| `.writing-mode-vertical` | نص عمودي (للأشرطة المطوية) |
| `.animate-float` | طفو خفيف (3s) |
| `.animate-pulse-soft` | نبض ناعم (2s) |
| `.animate-pulse-glow` | توهج نابض (3s) |
| `.animate-slide-up` | دخول من الأسفل (300ms) |
| `.animate-collapsed-enter` | دخول الشريط المطوي (300ms) |
| `.animate-ambient-1/2/3` | كرات الخلفية المتحركة |
| `.animate-rail-enter` | دخول الشريط الجانبي |

---

## 14. هندسة الخادم وقاعدة البيانات

### 14.1 بنية API (tRPC Routers)

```typescript
appRouter = {
  auth: {
    me:       publicProcedure.query()      // بيانات المستخدم الحالي
    login:    publicProcedure.mutation()    // تسجيل الدخول
    register: publicProcedure.mutation()    // إنشاء حساب
    logout:   publicProcedure.mutation()    // تسجيل الخروج
  },
  ai: aiRouter,                            // إجراءات الذكاء الاصطناعي
  files: {
    list:     protectedProcedure.query()    // قائمة الملفات
    get:      protectedProcedure.query()    // ملف واحد
    create:   protectedProcedure.mutation() // إنشاء ملف
    update:   protectedProcedure.mutation() // تحديث ملف
    delete:   protectedProcedure.mutation() // حذف ملف
    toggleFavorite: protectedProcedure.mutation()
  },
  reports: { list, get, create, update, delete },
  presentations: {
    list, get, create, update, delete,
    share, myShares, deleteShare, updateShare,
    viewShared: publicProcedure             // عرض مشترك بدون تسجيل دخول
  },
  dashboards: { list, get, create, update, delete },
  spreadsheets: { list, get, create, update, delete },
  extractions: { list, get, create, update, delete },
  translations: { list, get, create, update, delete },
  chat: { list, get, create, update, delete },
  library: libraryRouter,                   // مكتبة العناصر
  admin: { ... },                           // لوحة الإدارة
}
```

### 14.2 جداول قاعدة البيانات

| الجدول | الوصف | الحقول الرئيسية |
|--------|-------|----------------|
| `users` | المستخدمون | id, openId, name, email, role, loginMethod |
| `slide_templates` | قوالب العروض | id, name, fileUrl, slideCount, status |
| `element_categories` | فئات العناصر | id, slug, nameAr, nameEn, icon |
| `slide_elements` | عناصر التصميم | id, templateId, categoryId, name, htmlTemplate |
| `element_usage_rules` | قواعد الاستخدام | id, elementId, triggerContext, priority |

### 14.3 نظام المصادقة

```
المستخدم → صفحة الدخول (Login.tsx)
    │
    ├── تسجيل دخول محلي (userId + password)
    │   └── POST /api/trpc/auth.login
    │       └── JWT cookie → redirect to /
    │
    └── OAuth (Manus)
        └── redirect → OAuth server → callback
            └── JWT cookie → redirect to /
```

---

## 15. هيكل الملفات الكامل

```
rasid-data/
├── client/
│   ├── public/                    # ملفات ثابتة (favicon, robots.txt)
│   ├── src/
│   │   ├── _core/hooks/           # Hooks أساسية
│   │   │   └── useAuth.ts         # حالة المصادقة
│   │   ├── components/            # 47 مكوّن
│   │   │   ├── NotebookHeader.tsx  # الشريط العلوي
│   │   │   ├── DataPanel.tsx       # لوحة البيانات
│   │   │   ├── StudioPanel.tsx     # الاستوديو
│   │   │   ├── ChatCanvas.tsx      # راصد الذكي
│   │   │   ├── WorkspaceView.tsx   # محوّل المحركات
│   │   │   ├── AnimatedWorkspace.tsx# انتقالات الصفحات
│   │   │   ├── CommandPalette.tsx   # البحث الشامل
│   │   │   ├── ExcelEngine.tsx     # محرك البيانات
│   │   │   ├── ReportsEngine.tsx   # محرك التقارير
│   │   │   ├── PresentationsEngine.tsx # محرك العروض
│   │   │   ├── DashboardEngine.tsx # محرك اللوحات
│   │   │   ├── ExtractionEngine.tsx# محرك التفريغ
│   │   │   ├── TranslationEngine.tsx# محرك الترجمة
│   │   │   ├── VisualMatchEngine.tsx# محرك المطابقة
│   │   │   ├── LibraryEngine.tsx   # محرك المكتبة
│   │   │   └── ui/                 # مكونات shadcn/ui
│   │   ├── contexts/              # 5 سياقات
│   │   │   ├── ThemeContext.tsx     # الثيم (فاتح/داكن)
│   │   │   ├── WorkspaceContext.tsx # حالة مساحة العمل
│   │   │   ├── NotificationContext.tsx # الإشعارات
│   │   │   ├── CompactModeContext.tsx  # الوضع المضغوط
│   │   │   └── AuthContext.tsx     # المصادقة
│   │   ├── hooks/                 # Hooks مخصصة
│   │   ├── lib/                   # مكتبات مساعدة
│   │   │   ├── assets.ts           # URLs الأصول والثوابت
│   │   │   ├── sounds.ts           # محرك الأصوات
│   │   │   ├── trpc.ts             # عميل tRPC
│   │   │   └── utils.ts            # أدوات مساعدة
│   │   ├── pages/                 # 10 صفحات
│   │   │   ├── Home.tsx            # الصفحة الرئيسية
│   │   │   ├── Login.tsx           # تسجيل الدخول
│   │   │   ├── Profile.tsx         # الملف الشخصي
│   │   │   ├── AdminPanel.tsx      # لوحة الإدارة
│   │   │   └── ...
│   │   ├── App.tsx                # التوجيه والتخطيط
│   │   ├── main.tsx               # نقطة الدخول
│   │   └── index.css              # الثيم والأنماط العامة
│   └── index.html
├── server/
│   ├── _core/                     # البنية التحتية
│   │   ├── context.ts              # سياق tRPC
│   │   ├── env.ts                  # متغيرات البيئة
│   │   ├── llm.ts                  # تكامل الذكاء الاصطناعي
│   │   ├── oauth.ts                # مصادقة OAuth
│   │   └── ...
│   ├── routers.ts                 # إجراءات tRPC
│   ├── db.ts                      # استعلامات قاعدة البيانات
│   ├── aiRouter.ts                # إجراءات AI
│   ├── storage.ts                 # تخزين S3
│   └── *.test.ts                  # اختبارات Vitest
├── drizzle/
│   ├── schema.ts                  # مخطط قاعدة البيانات
│   └── migrations/                # ملفات الترحيل
├── shared/
│   ├── const.ts                   # ثوابت مشتركة
│   └── types.ts                   # أنواع مشتركة
└── package.json
```

---

## 16. التجاوب والأجهزة المتعددة

### 16.1 نقاط التوقف

| النقطة | العرض | السلوك |
|--------|-------|--------|
| Mobile | < 768px | أدراج جانبية، شريط تنقل سفلي، ChatCanvas عبر FAB |
| Tablet | 768px - 1023px | ألواح مطوية افتراضياً، ChatCanvas شريط جانبي |
| Desktop | >= 1024px | كل الألواح مفتوحة، التخطيط الكامل |

### 16.2 الموبايل

```tsx
// شريط التنقل السفلي (MobileBottomNav)
<div className="fixed bottom-0 inset-x-0 h-16 bg-card border-t md:hidden">
  <button>المحادثة</button>
  <button>البيانات</button>
  <button>الاستوديو</button>
  <button>المزيد</button>
</div>

// زر ChatCanvas العائم (عند عدم وجود تبويب المحادثة)
<button className="fixed bottom-20 left-4 w-14 h-14 rounded-full
                   bg-primary text-primary-foreground shadow-lg z-50">
  <MaterialIcon icon="chat" />
  {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
</button>
```

### 16.3 الأدراج (Drawers)

على الموبايل، لوحة البيانات والاستوديو تظهر كأدراج:

```tsx
// Drawer من اليمين (لوحة البيانات)
<div className={`fixed inset-y-0 right-0 w-[85vw] max-w-[340px] z-50
                 transform transition-transform duration-300
                 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
  <DataPanel />
</div>

// Drawer من اليسار (الاستوديو)
<div className={`fixed inset-y-0 left-0 w-[85vw] max-w-[200px] z-50
                 transform transition-transform duration-300
                 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
  <StudioPanel />
</div>
```

---

## 17. ملحق: قائمة المكونات الكاملة

### 17.1 المكونات الأساسية (Core)

| المكوّن | الملف | الوصف |
|---------|-------|-------|
| NotebookHeader | `NotebookHeader.tsx` | الشريط العلوي الرئيسي |
| DataPanel | `DataPanel.tsx` | لوحة البيانات (يمين) |
| StudioPanel | `StudioPanel.tsx` | الاستوديو (يسار) |
| ChatCanvas | `ChatCanvas.tsx` | راصد الذكي — المحادثة |
| WorkspaceView | `WorkspaceView.tsx` | محوّل محركات مساحة العمل |
| AnimatedWorkspace | `AnimatedWorkspace.tsx` | انتقالات الصفحات |
| Home | `Home.tsx` | الصفحة الرئيسية — التخطيط |

### 17.2 المحركات (Engines)

| المكوّن | الملف | الوصف |
|---------|-------|-------|
| ExcelEngine | `ExcelEngine.tsx` | عرض/تحرير البيانات |
| ReportsEngine | `ReportsEngine.tsx` | إنشاء/تحرير التقارير |
| PresentationsEngine | `PresentationsEngine.tsx` | إنشاء/تحرير العروض |
| DashboardEngine | `DashboardEngine.tsx` | بناء لوحات المؤشرات |
| ExtractionEngine | `ExtractionEngine.tsx` | استخراج النصوص |
| TranslationEngine | `TranslationEngine.tsx` | الترجمة |
| VisualMatchEngine | `VisualMatchEngine.tsx` | المطابقة البصرية |
| LibraryEngine | `LibraryEngine.tsx` | مكتبة العناصر |

### 17.3 مكونات الدعم

| المكوّن | الملف | الوصف |
|---------|-------|-------|
| CommandPalette | `CommandPalette.tsx` | البحث الشامل (Ctrl+K) |
| InspectorPanel | `InspectorPanel.tsx` | فحص العناصر |
| EvidenceDrawer | `EvidenceDrawer.tsx` | سجل الأدلة |
| ExecutionTimeline | `ExecutionTimeline.tsx` | خط زمني للتنفيذ |
| CompareView | `CompareView.tsx` | مقارنة بصرية |
| MaterialIcon | `MaterialIcon.tsx` | غلاف أيقونات Material |
| ModeSwitcher | `ModeSwitcher.tsx` | تبديل سهل/متقدم |
| OnboardingTour | `OnboardingTour.tsx` | جولة تعريفية |
| NotificationBell | `NotificationBell.tsx` | جرس الإشعارات |
| MobileBottomNav | `MobileBottomNav.tsx` | شريط تنقل الموبايل |
| RasedLoader | `RasedLoader.tsx` | شاشة التحميل |

### 17.4 الحوارات

| المكوّن | الملف | الوظيفة |
|---------|-------|---------|
| AddSourceDialog | `AddSourceDialog.tsx` | إضافة مصدر بيانات |
| ShareDialog | `ShareDialog.tsx` | مشاركة المحتوى |
| AnalyticsDialog | `AnalyticsDialog.tsx` | عرض التحليلات |
| SettingsMenu | `SettingsMenu.tsx` | قائمة الإعدادات |
| CreateTemplateDialog | `CreateTemplateDialog.tsx` | إنشاء قالب |
| NoteEditorDialog | `NoteEditorDialog.tsx` | تحرير ملاحظة |

### 17.5 السياقات (Contexts)

| السياق | الملف | الحالة المُدارة |
|--------|-------|----------------|
| ThemeContext | `ThemeContext.tsx` | الثيم (فاتح/داكن) |
| WorkspaceContext | `WorkspaceContext.tsx` | التبويب النشط، الألواح |
| NotificationContext | `NotificationContext.tsx` | الإشعارات |
| CompactModeContext | `CompactModeContext.tsx` | كثافة العرض |
| AuthContext | `AuthContext.tsx` | حالة المصادقة |

---

## اختصارات لوحة المفاتيح

| الاختصار | الوظيفة |
|----------|---------|
| `Ctrl+K` | فتح البحث الشامل |
| `Ctrl+D` | تبديل لوحة البيانات |
| `Ctrl+Shift+S` | تبديل الاستوديو |
| `Ctrl+B` | تبديل كلا اللوحين (وضع التركيز) |
| `Escape` | إغلاق الحوار/الدرج المفتوح |

---

> **نهاية الوثيقة**  
> هذه الوثيقة تمثل الحالة الحالية لمنصة راصد البيانات اعتباراً من 16 مارس 2026.  
> أي تعديلات مستقبلية يجب أن تُوثّق كملحق لهذه الوثيقة.

---

## 9. Drag & Drop System

The platform implements a cross-panel drag-and-drop system that allows users to drag data items from the DataPanel directly into the ChatCanvas for instant AI analysis.

### 9.1 Drag Source — DataPanel Items

Each `DataItemRow` in the DataPanel is configured as a drag source. When the user initiates a drag, the system serializes the item metadata into the `dataTransfer` object.

| Property | Value |
|---|---|
| **Drag Handle** | Visible grip icon (`drag_indicator`) on hover |
| **Data Format** | `application/rasid-data` (custom MIME type) |
| **Payload** | JSON: `{ id, title, type, status, icon }` |
| **Drag Image** | Native browser drag ghost with opacity reduction |
| **Visual Feedback** | Source item gets `opacity-50` during drag |

### 9.2 Drop Target — ChatCanvas

The ChatCanvas acts as the primary drop target. When a data item is dropped, the system automatically generates an analysis prompt.

| State | Visual Indicator |
|---|---|
| **Idle** | No drop zone visible |
| **Drag Over** | Pulsing border ring with `border-primary/50`, overlay with `bg-primary/5` |
| **Drop Zone Active** | Icon changes to `add_circle`, text shows "أفلت هنا للتحليل" |
| **After Drop** | Item title injected into input as: `حلل بيانات "{title}"` |
| **Snap Animation** | 300ms scale bounce on successful drop |

### 9.3 Implementation Notes

The drag-and-drop uses the native HTML5 Drag and Drop API (no external libraries). The `dataTransfer.setData()` call uses a custom MIME type to distinguish RASID data items from file drops. File drops (from the operating system) are handled separately with a different code path that uploads files to S3.

---

## 10. Sound Effects System

The platform includes a synthesized audio feedback system using the Web Audio API. All sounds are generated programmatically (no audio files required).

### 10.1 Sound Types

| Sound | Trigger | Frequency | Duration | Character |
|---|---|---|---|---|
| **Click** | Button press, tab switch | 800 Hz | 50ms | Short sine tap |
| **Hover** | Menu item hover | 600 Hz | 30ms | Soft whisper |
| **Success** | Operation complete | 523→659→784 Hz | 300ms | Rising major chord |
| **Error** | Validation failure | 200 Hz | 200ms | Low buzz |
| **Notification** | New alert arrives | 880→1047 Hz | 200ms | Two-tone chime |
| **Whoosh** | Panel open/close | White noise sweep | 150ms | Filtered noise |
| **Pop** | Item appear/drop | 1000 Hz | 80ms | Quick pop |

### 10.2 Sound Toggle

The sound system is controlled by a global toggle in the header toolbar. State is persisted in `localStorage` under the key `rasid-sounds-enabled`. Default state is **enabled**. The toggle button shows `volume_up` (enabled) or `volume_off` (disabled) icons.

### 10.3 Technical Implementation

All sounds are synthesized using `OscillatorNode` and `GainNode` from the Web Audio API. The `AudioContext` is created lazily on first user interaction to comply with browser autoplay policies. The implementation lives in `client/src/lib/sounds.ts` and exports individual functions: `playClick()`, `playSuccess()`, `playError()`, `playNotification()`, `playWhoosh()`, `playPop()`.

---

## 11. Compact Mode

The platform supports a density toggle that reduces spacing and font sizes for power users who prefer to see more content on screen.

### 11.1 Mode Comparison

| Property | Normal Mode | Compact Mode |
|---|---|---|
| **Base Font Size** | 14px | 12px |
| **Panel Padding** | 16px | 10px |
| **Item Row Height** | 44px | 32px |
| **Header Height** | 56px | 44px |
| **Gap Between Zones** | 12px | 6px |
| **Card Padding** | 16px | 10px |
| **Icon Size** | 20px | 16px |

### 11.2 Implementation

Compact mode is managed by `CompactModeContext` (`client/src/contexts/CompactModeContext.tsx`). The context provides `{ compact, toggleCompact }` to all child components. State is persisted in `localStorage` under the key `rasid-compact-mode`. The toggle button in the header shows `density_small` (compact) or `density_medium` (normal) icons.

Components read the compact state via `useCompactMode()` hook and conditionally apply reduced spacing classes. The CSS approach uses conditional Tailwind classes rather than CSS variables to maintain specificity control.

---

## 12. Keyboard Shortcuts

### 12.1 Global Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `Ctrl+K` | Open Command Palette (global search) | Global |
| `Ctrl+D` | Toggle Data Panel | Home page |
| `Ctrl+Shift+S` | Toggle Studio Panel | Home page |
| `Ctrl+B` | Toggle both panels simultaneously | Home page |
| `Escape` | Close active dialog/drawer/palette | Global |

### 12.2 Command Palette Shortcuts

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Navigate results |
| `Enter` | Execute selected result |
| `Escape` | Close palette |
| Type `>` prefix | Filter to actions only |
| Type `@` prefix | Filter to data items only |

### 12.3 Chat Input Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | New line |

---

## 13. Responsive Breakpoints & Mobile Behavior

### 13.1 Breakpoint System

| Breakpoint | Width | Layout Behavior |
|---|---|---|
| **Desktop** | >= 1024px | Full 4-zone layout, panels open by default |
| **Tablet** | 768–1023px | Panels collapsed by default, can be toggled |
| **Mobile** | < 768px | Single-column, bottom navigation, drawer panels |

### 13.2 Mobile-Specific Behaviors

On mobile devices (< 768px), the layout transforms significantly:

**Navigation**: The workspace tabs move to a bottom navigation bar with icon-only display. The active tab is highlighted with the primary color indicator.

**Panels**: DataPanel and StudioPanel render as full-screen drawers that slide in from the sides (data from right, studio from left, following RTL convention). A backdrop overlay appears behind the active drawer.

**ChatCanvas**: Always accessible via a floating action button (FAB) in the bottom-right corner. The FAB shows a chat icon with a pulse animation when there are unread messages. Tapping the FAB opens the chat as a full-screen overlay.

**Header**: Simplified to show only the RASID logo, workspace title, and a hamburger menu for settings access.

### 13.3 Touch Interactions

| Gesture | Action |
|---|---|
| **Tap** | Standard click behavior |
| **Long Press** | Context menu on data items |
| **Swipe Right** | Open data panel drawer (from edge) |
| **Swipe Left** | Open studio panel drawer (from edge) |

---

## 14. Authentication & Session Flow

### 14.1 Login Page

The login page (`client/src/pages/Login.tsx`) presents a split-screen layout:

| Zone | Content |
|---|---|
| **Left Panel** | RASID branding, feature highlights, NDMO logo at bottom |
| **Right Panel** | OAuth login button, welcome message |

The login flow uses OAuth 2.0 via the platform's authentication service. After successful authentication, the user is redirected to the home page with a session cookie.

### 14.2 Session Management

| Aspect | Implementation |
|---|---|
| **Auth State** | `useAuth()` hook from `client/src/_core/hooks/useAuth.ts` |
| **Session Check** | `trpc.auth.me.useQuery()` on app mount |
| **Logout** | `trpc.auth.logout.useMutation()` clears session |
| **Protected Routes** | `protectedProcedure` in server routers |
| **Role-Based Access** | `user.role` field (`admin` or `user`) |

### 14.3 User Menu

The user avatar in the header opens a dropdown menu with:
- User name and email display
- Profile page link
- Theme toggle
- Logout action

---

## 15. Database Schema

### 15.1 Core Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | User accounts | `id`, `openId`, `name`, `email`, `avatarUrl`, `role`, `createdAt` |
| `workspaces` | User workspaces | `id`, `userId`, `name`, `description`, `createdAt` |
| `data_sources` | Uploaded data files | `id`, `workspaceId`, `name`, `type`, `status`, `fileUrl`, `fileKey`, `size` |
| `conversations` | Chat conversations | `id`, `workspaceId`, `title`, `createdAt` |
| `messages` | Chat messages | `id`, `conversationId`, `role`, `content`, `createdAt` |
| `outputs` | Generated outputs | `id`, `workspaceId`, `type`, `title`, `content`, `fileUrl` |
| `activity_logs` | User activity tracking | `id`, `userId`, `action`, `details`, `createdAt` |

### 15.2 Relationships

- A **User** has many **Workspaces**
- A **Workspace** has many **DataSources**, **Conversations**, and **Outputs**
- A **Conversation** has many **Messages**
- All tables use UUID primary keys and UTC timestamps

---

## 16. File & Component Map

### 16.1 Directory Structure

```
client/
  src/
    pages/
      Home.tsx              → Main workspace (4-zone layout)
      Login.tsx             → Authentication page
      Profile.tsx           → User profile with stats
      ComponentShowcase.tsx → Design system reference
    components/
      NotebookHeader.tsx    → Top header bar (486 lines)
      ChatCanvas.tsx        → AI conversation interface (780 lines)
      DataPanel.tsx         → Data sources panel (420 lines)
      StudioPanel.tsx       → Output tools panel (380 lines)
      WorkspaceView.tsx     → Context-specific workspace content
      AnimatedWorkspace.tsx → Page transition wrapper
      CommandPalette.tsx    → Global search (Ctrl+K)
      InspectorPanel.tsx    → Data inspection overlay
      EvidenceDrawer.tsx    → Audit trail drawer
      ExecutionTimeline.tsx → Job progress tracker
      CompareView.tsx       → Side-by-side comparison
      ModeSwitcher.tsx      → Easy/Advanced mode toggle
      AddSourceDialog.tsx   → Data upload dialog
      ShareDialog.tsx       → Sharing controls
      AnalyticsDialog.tsx   → Usage analytics
      SettingsMenu.tsx      → Settings dropdown
      MaterialIcon.tsx      → Google Material Icons wrapper
      DashboardLayout.tsx   → Admin dashboard shell
      AIChatBox.tsx         → Reusable chat component
      Map.tsx               → Google Maps integration
    contexts/
      ThemeContext.tsx       → Dark/light theme state
      NotificationContext.tsx → Toast notification system
      CompactModeContext.tsx → Density mode state
      WorkspaceContext.tsx   → Active workspace state
    hooks/
      useAuth.ts            → Authentication state
    lib/
      trpc.ts               → tRPC client binding
      assets.ts             → Static data (views, actions, icons)
      sounds.ts             → Web Audio API sound effects
    index.css               → Global theme & animations (1950+ lines)
server/
  routers.ts                → tRPC API procedures
  db.ts                     → Database query helpers
  storage.ts                → S3 file storage helpers
  _core/                    → Framework infrastructure (do not modify)
drizzle/
  schema.ts                 → Database table definitions
  relations.ts              → Table relationships
shared/
  types.ts                  → Shared TypeScript types
  const.ts                  → Shared constants
```

### 16.2 Key Dependencies

| Package | Purpose | Version |
|---|---|---|
| React | UI framework | 19.x |
| Tailwind CSS | Utility-first styling | 4.x |
| tRPC | End-to-end typesafe API | 11.x |
| Drizzle ORM | Database queries | 0.44.x |
| Wouter | Client-side routing | 3.x |
| TanStack Query | Server state management | 5.x |
| Superjson | JSON serialization | 1.x |
| shadcn/ui | UI component library | Latest |
| Lucide React | Icon library | Latest |
| Google Material Icons | Icon font | Via CDN |

---

## Appendix A: CSS Custom Properties Reference

### A.1 Core Theme Tokens (Light Mode)

```css
--background: oklch(0.985 0.002 250)     /* Near-white with blue tint */
--foreground: oklch(0.20 0.03 250)        /* Deep navy text */
--primary: oklch(0.42 0.12 255)           /* Royal blue */
--primary-foreground: oklch(0.98 0.01 250) /* White on primary */
--secondary: oklch(0.94 0.02 250)         /* Light blue-gray */
--accent: oklch(0.92 0.03 250)            /* Soft blue accent */
--muted: oklch(0.94 0.015 250)            /* Muted background */
--card: oklch(0.99 0.002 250)             /* Card surface */
--border: oklch(0.88 0.02 250)            /* Subtle borders */
--gold: oklch(0.78 0.12 75)              /* Gold accent */
--success: oklch(0.60 0.15 155)           /* Green status */
--warning: oklch(0.75 0.15 75)            /* Amber status */
--danger: oklch(0.55 0.20 25)             /* Red status */
--info: oklch(0.55 0.12 250)              /* Blue info */
```

### A.2 Animation Tokens

```css
--ease-premium: cubic-bezier(0.22, 0.61, 0.36, 1)
--duration-fast: 150ms
--duration-normal: 300ms
--duration-slow: 500ms
```

---

## Appendix B: State Machine — Panel Visibility

```
┌─────────────────────────────────────────────┐
│              Desktop (>= 1024px)            │
│                                             │
│  Data: OPEN ←→ COLLAPSED (Ctrl+D)          │
│  Studio: OPEN ←→ COLLAPSED (Ctrl+Shift+S)  │
│  Chat: ALWAYS VISIBLE                       │
│  Both: Toggle (Ctrl+B)                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Tablet (768-1023px)             │
│                                             │
│  Data: COLLAPSED ←→ OPEN (tap rail)         │
│  Studio: COLLAPSED ←→ OPEN (tap rail)       │
│  Chat: ALWAYS VISIBLE                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Mobile (< 768px)               │
│                                             │
│  Data: HIDDEN ←→ DRAWER (bottom nav)        │
│  Studio: HIDDEN ←→ DRAWER (bottom nav)      │
│  Chat: ALWAYS VISIBLE (FAB or full-screen)  │
└─────────────────────────────────────────────┘
```

---

## Appendix C: Naming Conventions

| Layer | Convention | Example |
|---|---|---|
| **Components** | PascalCase | `NotebookHeader.tsx` |
| **Hooks** | camelCase with `use` prefix | `useAuth.ts` |
| **Contexts** | PascalCase with `Context` suffix | `ThemeContext.tsx` |
| **CSS Classes** | Tailwind utilities + custom `.glass`, `.writing-mode-vertical` | `bg-primary/10 glass` |
| **tRPC Procedures** | camelCase dot notation | `trpc.auth.me` |
| **Database Tables** | snake_case | `data_sources` |
| **TypeScript Types** | PascalCase | `DataItem`, `StudioOutput` |
| **Constants** | UPPER_SNAKE_CASE | `WORKSPACE_VIEWS` |
| **Event Handlers** | `on` + Action | `onSearchClick`, `onExpand` |

---

**Document Version**: 1.0
**Generated From**: RASID Production Codebase
**Last Updated**: March 2026
**Classification**: Internal — Development Team Only
