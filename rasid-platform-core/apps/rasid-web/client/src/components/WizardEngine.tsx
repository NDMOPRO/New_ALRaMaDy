/* ═══════════════════════════════════════════════════════════════════
   RASID Wizard Engine — Ultra Premium Sequential Flow System
   Each engine tool triggers a step-by-step wizard INSIDE the chat canvas.
   Steps appear one at a time with staggered animations.
   On execution, a Gamma-like dynamic output cascade plays.
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useCallback, useEffect, useRef } from 'react';
import MaterialIcon from './MaterialIcon';
import { useTheme } from '@/contexts/ThemeContext';

/* ─── Types ─── */
export type EngineId = 'dashboard' | 'report' | 'presentation' | 'matching' | 'arabization' | 'extraction' | 'translation' | 'excel';

interface WizardStep {
  id: string;
  title: string;
  icon: string;
  options?: WizardOption[];
  type: 'select' | 'multi-select' | 'upload' | 'input' | 'range' | 'confirm';
  placeholder?: string;
  min?: number;
  max?: number;
  defaultValue?: string;
}

interface WizardOption {
  id: string;
  label: string;
  icon: string;
  desc?: string;
  color?: string;
}

interface ExecutionSlide {
  id: string;
  title: string;
  icon: string;
  content: string;
  color: string;
  progress: number;
}

/* ─── Engine Flow Definitions ─── */
const ENGINE_FLOWS: Record<EngineId, { title: string; icon: string; color: string; steps: WizardStep[]; outputSlides: ExecutionSlide[] }> = {
  // ═══ E04: لوحات المؤشرات ═══
  dashboard: {
    title: 'لوحة مؤشرات',
    icon: 'dashboard',
    color: '#1e40af',
    steps: [
      {
        id: 'source', title: 'مصدر البيانات', icon: 'database', type: 'select',
        options: [
          { id: 'uploaded', label: 'ملفات مرفوعة', icon: 'upload_file', desc: 'استخدم البيانات المرفوعة مسبقاً' },
          { id: 'manual', label: 'إدخال يدوي', icon: 'edit_note', desc: 'أدخل البيانات يدوياً' },
          { id: 'api', label: 'واجهة برمجية', icon: 'api', desc: 'اتصل بمصدر بيانات خارجي' },
          { id: 'sample', label: 'بيانات نموذجية', icon: 'science', desc: 'استخدم بيانات تجريبية للمعاينة' },
        ]
      },
      {
        id: 'kpis', title: 'المؤشرات الرئيسية', icon: 'speed', type: 'multi-select',
        options: [
          { id: 'compliance', label: 'نسبة الامتثال', icon: 'verified', desc: 'مؤشر الالتزام بالمعايير' },
          { id: 'quality', label: 'جودة البيانات', icon: 'high_quality', desc: 'مؤشر جودة وسلامة البيانات' },
          { id: 'coverage', label: 'التغطية', icon: 'donut_large', desc: 'نسبة تغطية البيانات' },
          { id: 'timeliness', label: 'الحداثة', icon: 'schedule', desc: 'مدى حداثة البيانات' },
          { id: 'completeness', label: 'الاكتمال', icon: 'check_circle', desc: 'نسبة اكتمال الحقول' },
          { id: 'accuracy', label: 'الدقة', icon: 'gps_fixed', desc: 'دقة القيم والسجلات' },
        ]
      },
      {
        id: 'widgets', title: 'عناصر اللوحة', icon: 'widgets', type: 'multi-select',
        options: [
          { id: 'cards', label: 'بطاقات KPI', icon: 'credit_card', color: '#1e40af' },
          { id: 'bar', label: 'أعمدة بيانية', icon: 'bar_chart', color: '#059669' },
          { id: 'line', label: 'خطوط اتجاه', icon: 'show_chart', color: '#d97706' },
          { id: 'pie', label: 'دائري', icon: 'pie_chart', color: '#7c3aed' },
          { id: 'table', label: 'جدول تفصيلي', icon: 'table_chart', color: '#0891b2' },
          { id: 'map', label: 'خريطة حرارية', icon: 'map', color: '#dc2626' },
          { id: 'gauge', label: 'مقياس', icon: 'speed', color: '#4f46e5' },
          { id: 'timeline', label: 'خط زمني', icon: 'timeline', color: '#ea580c' },
        ]
      },
      {
        id: 'theme', title: 'النمط البصري', icon: 'palette', type: 'select',
        options: [
          { id: 'ndmo', label: 'NDMO الرسمي', icon: 'verified', desc: 'الهوية الرسمية لمكتب إدارة البيانات' },
          { id: 'sdaia', label: 'سدايا', icon: 'hub', desc: 'هوية الهيئة السعودية للبيانات' },
          { id: 'modern', label: 'عصري', icon: 'auto_awesome', desc: 'تصميم حديث وأنيق' },
          { id: 'minimal', label: 'بسيط', icon: 'remove', desc: 'تصميم نظيف ومركّز' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تهيئة مصادر البيانات', icon: 'database', content: 'ربط 3 مصادر بيانات — التحقق من الهيكل', color: '#1e40af', progress: 0 },
      { id: 's2', title: 'حساب المؤشرات', icon: 'calculate', content: 'معالجة 6 مؤشرات رئيسية — تطبيق المعادلات', color: '#059669', progress: 0 },
      { id: 's3', title: 'بناء المخططات', icon: 'bar_chart', content: 'إنشاء 4 مخططات بيانية — ربط البيانات', color: '#d97706', progress: 0 },
      { id: 's4', title: 'تصميم التخطيط', icon: 'dashboard', content: 'ترتيب العناصر — تطبيق الشبكة', color: '#7c3aed', progress: 0 },
      { id: 's5', title: 'تطبيق الهوية البصرية', icon: 'palette', content: 'الألوان والخطوط والشعارات', color: '#0891b2', progress: 0 },
      { id: 's6', title: 'التحقق والتصدير', icon: 'verified', content: 'فحص الجودة — إنشاء حزمة الأدلة', color: '#059669', progress: 0 },
    ],
  },

  // ═══ E05: التقارير ═══
  report: {
    title: 'تقرير',
    icon: 'description',
    color: '#059669',
    steps: [
      {
        id: 'type', title: 'نوع التقرير', icon: 'category', type: 'select',
        options: [
          { id: 'compliance', label: 'تقرير امتثال', icon: 'gavel', desc: 'تقييم الالتزام بالمعايير والسياسات' },
          { id: 'quality', label: 'تقرير جودة', icon: 'high_quality', desc: 'تقييم جودة البيانات وسلامتها' },
          { id: 'comparison', label: 'تقرير مقارنة', icon: 'compare', desc: 'مقارنة بين جهات أو فترات' },
          { id: 'executive', label: 'تقرير تنفيذي', icon: 'business_center', desc: 'ملخص تنفيذي لصانع القرار' },
          { id: 'technical', label: 'تقرير تقني', icon: 'code', desc: 'تقرير تقني تفصيلي' },
        ]
      },
      {
        id: 'sections', title: 'أقسام التقرير', icon: 'list_alt', type: 'multi-select',
        options: [
          { id: 'cover', label: 'الغلاف', icon: 'image' },
          { id: 'toc', label: 'الفهرس', icon: 'toc' },
          { id: 'summary', label: 'الملخص التنفيذي', icon: 'summarize' },
          { id: 'methodology', label: 'المنهجية', icon: 'science' },
          { id: 'findings', label: 'النتائج', icon: 'insights' },
          { id: 'charts', label: 'المخططات', icon: 'bar_chart' },
          { id: 'recommendations', label: 'التوصيات', icon: 'lightbulb' },
          { id: 'appendix', label: 'الملاحق', icon: 'attach_file' },
        ]
      },
      {
        id: 'data', title: 'مصدر البيانات', icon: 'database', type: 'select',
        options: [
          { id: 'workspace', label: 'من مساحة العمل', icon: 'folder_open', desc: 'البيانات المرفوعة في المنصة' },
          { id: 'manual', label: 'إدخال يدوي', icon: 'edit_note', desc: 'أدخل البيانات مباشرة' },
          { id: 'template', label: 'من قالب', icon: 'content_copy', desc: 'استخدم قالب تقرير جاهز' },
        ]
      },
      {
        id: 'style', title: 'الأسلوب والنبرة', icon: 'style', type: 'select',
        options: [
          { id: 'formal', label: 'رسمي', icon: 'business_center', desc: 'لغة رسمية ومهنية' },
          { id: 'technical', label: 'تقني', icon: 'code', desc: 'مصطلحات تقنية متخصصة' },
          { id: 'executive', label: 'تنفيذي', icon: 'trending_up', desc: 'موجز ومباشر لصانع القرار' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل البيانات المصدرية', icon: 'analytics', content: 'قراءة 12 جدول — استخراج المؤشرات', color: '#059669', progress: 0 },
      { id: 's2', title: 'بناء المخطط التفصيلي', icon: 'list_alt', content: 'إنشاء 8 أقسام — تحديد التسلسل', color: '#1e40af', progress: 0 },
      { id: 's3', title: 'صياغة المحتوى', icon: 'edit_note', content: 'كتابة الملخص والنتائج والتوصيات', color: '#d97706', progress: 0 },
      { id: 's4', title: 'إنشاء المخططات', icon: 'bar_chart', content: 'توليد 6 مخططات مربوطة بالبيانات', color: '#7c3aed', progress: 0 },
      { id: 's5', title: 'تنسيق الوثيقة', icon: 'format_paint', content: 'تطبيق القالب — الخطوط — الهوامش', color: '#0891b2', progress: 0 },
      { id: 's6', title: 'مراجعة الجودة', icon: 'fact_check', content: 'التدقيق اللغوي — فحص الاتساق — الأدلة', color: '#059669', progress: 0 },
    ],
  },

  // ═══ E02: العروض التقديمية ═══
  presentation: {
    title: 'عرض تقديمي',
    icon: 'slideshow',
    color: '#d97706',
    steps: [
      {
        id: 'content', title: 'مصدر المحتوى', icon: 'source', type: 'select',
        options: [
          { id: 'ai', label: 'محتوى ذكي', icon: 'auto_awesome', desc: 'يُنشئ المحتوى تلقائياً من وصفك' },
          { id: 'data', label: 'من البيانات', icon: 'table_chart', desc: 'يبني الشرائح من جداولك ومخططاتك' },
          { id: 'document', label: 'من مستند', icon: 'description', desc: 'يحوّل مستنداً إلى شرائح' },
          { id: 'image', label: 'من صورة/PDF', icon: 'image', desc: 'يستنسخ التصميم بدقة 1:1 (Strict)' },
        ]
      },
      {
        id: 'brand', title: 'الهوية البصرية', icon: 'palette', type: 'select',
        options: [
          { id: 'ndmo', label: 'مكتب إدارة البيانات', icon: 'verified', desc: 'الهوية الرسمية NDMO' },
          { id: 'sdaia', label: 'سدايا', icon: 'hub', desc: 'هوية الهيئة السعودية للبيانات' },
          { id: 'custom', label: 'هوية مخصصة', icon: 'brush', desc: 'ارفع هويتك البصرية الخاصة' },
          { id: 'auto', label: 'تلقائي', icon: 'auto_fix_high', desc: 'يختار التصميم الأنسب للمحتوى' },
        ]
      },
      {
        id: 'slides', title: 'عدد الشرائح والأسلوب', icon: 'view_carousel', type: 'range',
        min: 3, max: 50, defaultValue: '10',
      },
      {
        id: 'style', title: 'أسلوب العرض', icon: 'style', type: 'select',
        options: [
          { id: 'formal', label: 'رسمي', icon: 'business_center', desc: 'عرض رسمي لاجتماعات القيادة' },
          { id: 'creative', label: 'إبداعي', icon: 'palette', desc: 'تصميم جذاب مع إنفوجرافيك' },
          { id: 'infographic', label: 'إنفوجرافيك', icon: 'insert_chart', desc: 'شرائح بصرية غنية بالرسوم' },
          { id: 'minimal', label: 'بسيط', icon: 'remove', desc: 'تصميم نظيف ومركّز' },
        ]
      },
      {
        id: 'infotypes', title: 'أنواع الشرائح', icon: 'view_quilt', type: 'multi-select',
        options: [
          { id: 'title', label: 'شريحة عنوان', icon: 'title' },
          { id: 'kpi', label: 'بطاقات KPI', icon: 'speed' },
          { id: 'chart', label: 'مخططات', icon: 'bar_chart' },
          { id: 'timeline', label: 'خط زمني', icon: 'timeline' },
          { id: 'comparison', label: 'مقارنة', icon: 'compare' },
          { id: 'quote', label: 'اقتباس', icon: 'format_quote' },
          { id: 'process', label: 'مراحل', icon: 'account_tree' },
          { id: 'map', label: 'خريطة', icon: 'map' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل الطلب', icon: 'psychology', content: 'فهم النية — تحديد المخرجات — تخطيط الشرائح', color: '#d97706', progress: 0 },
      { id: 's2', title: 'بناء المخطط', icon: 'list_alt', content: 'إنشاء Storyboard — ترتيب الأقسام', color: '#1e40af', progress: 0 },
      { id: 's3', title: 'تصميم الشرائح', icon: 'brush', content: 'تطبيق Grid — Layout Engine — الهوية', color: '#7c3aed', progress: 0 },
      { id: 's4', title: 'إنشاء المحتوى', icon: 'edit_note', content: 'كتابة النصوص — إنشاء المخططات — الأيقونات', color: '#059669', progress: 0 },
      { id: 's5', title: 'الحركة والانتقالات', icon: 'animation', content: 'تطبيق Fade/Slide — التحقق من التوافق', color: '#ea580c', progress: 0 },
      { id: 's6', title: 'التحقق والتصدير', icon: 'verified', content: 'RenderParity — QA — Evidence Pack — PPTX', color: '#059669', progress: 0 },
    ],
  },

  // ═══ E01: المطابقة الحرفية ═══
  matching: {
    title: 'المطابقة الحرفية',
    icon: 'compare',
    color: '#7c3aed',
    steps: [
      {
        id: 'input', title: 'الملف المصدر', icon: 'upload_file', type: 'upload',
        placeholder: 'ارفع الملف المراد مطابقته (PDF, صورة, PPTX, DOCX, XLSX)',
      },
      {
        id: 'mode', title: 'وضع المطابقة', icon: 'tune', type: 'select',
        options: [
          { id: 'strict', label: 'مطابقة حرفية 1:1', icon: 'gps_fixed', desc: 'PixelDiff==0 — تطابق بصري كامل' },
          { id: 'editable', label: 'قابل للتحرير', icon: 'edit', desc: 'مطابقة مع عناصر قابلة للتعديل' },
          { id: 'hybrid', label: 'هجين', icon: 'tune', desc: 'مطابقة بصرية مع مرونة في التحرير' },
        ]
      },
      {
        id: 'output', title: 'صيغة المخرج', icon: 'output', type: 'select',
        options: [
          { id: 'pptx', label: 'PPTX', icon: 'slideshow', desc: 'عرض تقديمي قابل للتحرير' },
          { id: 'docx', label: 'DOCX', icon: 'description', desc: 'مستند Word' },
          { id: 'xlsx', label: 'XLSX', icon: 'table_chart', desc: 'جدول Excel' },
          { id: 'html', label: 'HTML', icon: 'code', desc: 'صفحة ويب' },
          { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf', desc: 'مستند PDF' },
        ]
      },
      {
        id: 'verify', title: 'مستوى التحقق', icon: 'verified', type: 'select',
        options: [
          { id: 'triple', label: 'تحقق ثلاثي', icon: 'security', desc: 'Pixel + Structure + Content' },
          { id: 'visual', label: 'بصري فقط', icon: 'visibility', desc: 'مقارنة بصرية فقط' },
          { id: 'full', label: 'شامل + Evidence', icon: 'fact_check', desc: 'تحقق كامل مع حزمة أدلة' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل المصدر', icon: 'search', content: 'قراءة الملف — كشف الهيكل — تحديد العناصر', color: '#7c3aed', progress: 0 },
      { id: 's2', title: 'استنساخ الهيكل', icon: 'content_copy', content: 'بناء الإطار — نسخ التخطيط — الشبكة', color: '#1e40af', progress: 0 },
      { id: 's3', title: 'نسخ المحتوى', icon: 'text_fields', content: 'النصوص — الجداول — المخططات — الصور', color: '#059669', progress: 0 },
      { id: 's4', title: 'المطابقة البصرية', icon: 'compare', content: 'PixelDiff — مقارنة كل صفحة — التصحيح', color: '#d97706', progress: 0 },
      { id: 's5', title: 'التحقق الثلاثي', icon: 'verified', content: 'Pixel Gate — Structure Gate — Content Gate', color: '#059669', progress: 0 },
    ],
  },

  // ═══ E06-LOCALIZE: التعريب ═══
  arabization: {
    title: 'التعريب',
    icon: 'g_translate',
    color: '#0891b2',
    steps: [
      {
        id: 'input', title: 'الملف المصدر', icon: 'upload_file', type: 'upload',
        placeholder: 'ارفع الملف المراد تعريبه (PDF, PPTX, DOCX, XLSX)',
      },
      {
        id: 'claim', title: 'نوع العملية', icon: 'category', type: 'select',
        options: [
          { id: 'localize', label: 'تعريب احترافي', icon: 'g_translate', desc: 'ترجمة مصطلحية سياقية + حفظ التصميم' },
          { id: 'convert', label: 'تحويل صارم 1:1', icon: 'transform', desc: 'تحويل الصيغة مع مطابقة بصرية كاملة' },
          { id: 'transcribe', label: 'تفريغ/استخراج نص', icon: 'text_snippet', desc: 'استخراج النص بدقة 100%' },
        ]
      },
      {
        id: 'terminology', title: 'قاموس المصطلحات', icon: 'menu_book', type: 'select',
        options: [
          { id: 'ndmo', label: 'مصطلحات NDMO', icon: 'verified', desc: 'القاموس الرسمي لمكتب إدارة البيانات' },
          { id: 'sdaia', label: 'مصطلحات سدايا', icon: 'hub', desc: 'مصطلحات الهيئة السعودية للبيانات' },
          { id: 'general', label: 'عام', icon: 'language', desc: 'قاموس عام للمصطلحات التقنية' },
          { id: 'custom', label: 'مخصص', icon: 'upload_file', desc: 'ارفع قاموس مصطلحاتك الخاص' },
        ]
      },
      {
        id: 'quality', title: 'مستوى الجودة', icon: 'high_quality', type: 'select',
        options: [
          { id: 'lqa0', label: 'LQA==0 (بدون أخطاء)', icon: 'security', desc: 'صفر أخطاء مصطلح/معنى/نبرة/اتساق' },
          { id: 'standard', label: 'قياسي', icon: 'check_circle', desc: 'جودة عالية مع مراجعة آلية' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل المصدر', icon: 'search', content: 'كشف اللغة — تحديد المصطلحات — تحليل الهيكل', color: '#0891b2', progress: 0 },
      { id: 's2', title: 'تحميل القاموس', icon: 'menu_book', content: 'ربط 2,400 مصطلح — مطابقة السياق', color: '#1e40af', progress: 0 },
      { id: 's3', title: 'الترجمة المصطلحية', icon: 'translate', content: 'ترجمة سياقية — حفظ النبرة — RTL ELITE', color: '#059669', progress: 0 },
      { id: 's4', title: 'حفظ التصميم', icon: 'format_paint', content: 'Layout Lock — إصلاحات هندسية — Arabic Typography', color: '#d97706', progress: 0 },
      { id: 's5', title: 'فحص الجودة LQA', icon: 'fact_check', content: 'التحقق من المصطلحات — الاتساق — الأرقام — الوحدات', color: '#059669', progress: 0 },
    ],
  },

  // ═══ E06-TRANSCRIBE: التفريغ ═══
  extraction: {
    title: 'التفريغ والاستخراج',
    icon: 'text_snippet',
    color: '#dc2626',
    steps: [
      {
        id: 'input', title: 'الملف المصدر', icon: 'upload_file', type: 'upload',
        placeholder: 'ارفع الملف (صوت, فيديو, صورة, PDF, مستند)',
      },
      {
        id: 'type', title: 'نوع الاستخراج', icon: 'category', type: 'select',
        options: [
          { id: 'audio', label: 'تفريغ صوتي', icon: 'mic', desc: 'تحويل الصوت/الفيديو إلى نص دقيق' },
          { id: 'ocr', label: 'استخراج نصوص (OCR)', icon: 'document_scanner', desc: 'استخراج النص من الصور والمستندات' },
          { id: 'table', label: 'استخراج جداول', icon: 'table_chart', desc: 'استخراج الجداول وتحويلها لبيانات منظمة' },
          { id: 'structure', label: 'استخراج هيكلي', icon: 'account_tree', desc: 'استخراج العناوين والفقرات والقوائم' },
        ]
      },
      {
        id: 'output', title: 'صيغة المخرج', icon: 'output', type: 'select',
        options: [
          { id: 'txt', label: 'نص عادي', icon: 'text_snippet' },
          { id: 'docx', label: 'DOCX', icon: 'description' },
          { id: 'xlsx', label: 'XLSX', icon: 'table_chart' },
          { id: 'json', label: 'JSON', icon: 'data_object' },
          { id: 'srt', label: 'SRT (ترجمة)', icon: 'subtitles' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل الملف', icon: 'search', content: 'كشف النوع — تحديد المحتوى — تقسيم الأجزاء', color: '#dc2626', progress: 0 },
      { id: 's2', title: 'الاستخراج الآلي', icon: 'smart_toy', content: 'تشغيل النماذج — معالجة المحتوى', color: '#1e40af', progress: 0 },
      { id: 's3', title: 'التحقق والتصحيح', icon: 'spellcheck', content: 'بوابات التحقق — TranscriptExact==true', color: '#059669', progress: 0 },
      { id: 's4', title: 'التنسيق والتصدير', icon: 'output', content: 'تنسيق المخرج — إنشاء الملف النهائي', color: '#d97706', progress: 0 },
    ],
  },

  // ═══ E06-TRANSLATE: الترجمة ═══
  translation: {
    title: 'الترجمة',
    icon: 'translate',
    color: '#4f46e5',
    steps: [
      {
        id: 'input', title: 'الملف المصدر', icon: 'upload_file', type: 'upload',
        placeholder: 'ارفع الملف المراد ترجمته أو اكتب النص مباشرة',
      },
      {
        id: 'source', title: 'اللغة المصدر', icon: 'language', type: 'select',
        options: [
          { id: 'auto', label: 'كشف تلقائي', icon: 'auto_fix_high', desc: 'يكتشف اللغة تلقائياً' },
          { id: 'en', label: 'الإنجليزية', icon: 'language' },
          { id: 'fr', label: 'الفرنسية', icon: 'language' },
          { id: 'es', label: 'الإسبانية', icon: 'language' },
          { id: 'zh', label: 'الصينية', icon: 'language' },
          { id: 'de', label: 'الألمانية', icon: 'language' },
        ]
      },
      {
        id: 'target', title: 'اللغة الهدف', icon: 'language', type: 'select',
        options: [
          { id: 'ar', label: 'العربية', icon: 'language', desc: 'ترجمة احترافية مع RTL ELITE' },
          { id: 'en', label: 'الإنجليزية', icon: 'language' },
          { id: 'fr', label: 'الفرنسية', icon: 'language' },
        ]
      },
      {
        id: 'preserve', title: 'حفظ التصميم', icon: 'format_paint', type: 'select',
        options: [
          { id: 'full', label: 'حفظ كامل', icon: 'lock', desc: 'Layout Lock — تصميم مطابق للأصل' },
          { id: 'adaptive', label: 'تكيّفي', icon: 'auto_fix_high', desc: 'يعدّل التخطيط ليناسب اللغة الهدف' },
          { id: 'text_only', label: 'نص فقط', icon: 'text_fields', desc: 'ترجمة النص بدون حفظ التصميم' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل المصدر', icon: 'search', content: 'كشف اللغة — تحليل الهيكل — تقسيم الأجزاء', color: '#4f46e5', progress: 0 },
      { id: 's2', title: 'الترجمة السياقية', icon: 'translate', content: 'ترجمة مصطلحية — حفظ السياق — النبرة', color: '#059669', progress: 0 },
      { id: 's3', title: 'حفظ التصميم', icon: 'format_paint', content: 'Layout Lock — RTL/LTR — Typography', color: '#d97706', progress: 0 },
      { id: 's4', title: 'فحص الجودة', icon: 'fact_check', content: 'LQA — الاتساق — المصطلحات — الأرقام', color: '#059669', progress: 0 },
    ],
  },

  // ═══ E03: الإكسل ═══
  excel: {
    title: 'إكسل',
    icon: 'table_chart',
    color: '#059669',
    steps: [
      {
        id: 'source', title: 'مصدر البيانات', icon: 'database', type: 'select',
        options: [
          { id: 'upload', label: 'رفع ملف', icon: 'upload_file', desc: 'CSV, XLSX, JSON, أو صورة جدول' },
          { id: 'workspace', label: 'من مساحة العمل', icon: 'folder_open', desc: 'البيانات المرفوعة مسبقاً' },
          { id: 'manual', label: 'إدخال يدوي', icon: 'edit_note', desc: 'أنشئ جدولاً من الصفر' },
        ]
      },
      {
        id: 'operations', title: 'العمليات المطلوبة', icon: 'functions', type: 'multi-select',
        options: [
          { id: 'formulas', label: 'معادلات', icon: 'calculate', desc: 'SUM, AVERAGE, VLOOKUP...' },
          { id: 'pivot', label: 'جداول محورية', icon: 'pivot_table_chart', desc: 'تلخيص وتجميع البيانات' },
          { id: 'charts', label: 'مخططات', icon: 'bar_chart', desc: 'رسوم بيانية من البيانات' },
          { id: 'validation', label: 'تحقق', icon: 'fact_check', desc: 'قواعد التحقق من البيانات' },
          { id: 'formatting', label: 'تنسيق', icon: 'format_paint', desc: 'تنسيق شرطي واحترافي' },
          { id: 'cleanup', label: 'تنظيف', icon: 'cleaning_services', desc: 'إزالة التكرار والأخطاء' },
        ]
      },
      {
        id: 'output', title: 'صيغة المخرج', icon: 'output', type: 'select',
        options: [
          { id: 'xlsx', label: 'XLSX', icon: 'table_chart', desc: 'ملف Excel كامل' },
          { id: 'csv', label: 'CSV', icon: 'text_snippet', desc: 'ملف نصي مفصول بفواصل' },
          { id: 'json', label: 'JSON', icon: 'data_object', desc: 'بيانات منظمة' },
        ]
      },
    ],
    outputSlides: [
      { id: 's1', title: 'تحليل البيانات', icon: 'search', content: 'كشف الهيكل — تحديد الأنواع — التحقق', color: '#059669', progress: 0 },
      { id: 's2', title: 'بناء المعادلات', icon: 'calculate', content: 'إنشاء الصيغ — ربط الخلايا — التحقق', color: '#1e40af', progress: 0 },
      { id: 's3', title: 'إنشاء المخططات', icon: 'bar_chart', content: 'توليد الرسوم البيانية — ربط البيانات', color: '#d97706', progress: 0 },
      { id: 's4', title: 'التنسيق والتصدير', icon: 'format_paint', content: 'تنسيق احترافي — التحقق — التصدير', color: '#059669', progress: 0 },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════
   WizardEngine Component
   ═══════════════════════════════════════════════════════════════════ */
interface WizardEngineProps {
  engineId: EngineId;
  onBack: () => void;
  onComplete?: () => void;
}

export default function WizardEngine({ engineId, onBack, onComplete }: WizardEngineProps) {
  const { theme } = useTheme();
  const flow = ENGINE_FLOWS[engineId];
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionPhase, setExecutionPhase] = useState(-1);
  const [slideProgresses, setSlideProgresses] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [stepVisible, setStepVisible] = useState(true);
  const [rangeValue, setRangeValue] = useState(flow.steps.find(s => s.type === 'range')?.defaultValue || '10');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [currentStep, isExecuting, executionPhase]);

  const step = flow.steps[currentStep];
  const totalSteps = flow.steps.length;
  const progressPercent = isComplete ? 100 : isExecuting ? 70 + (executionPhase / flow.outputSlides.length) * 30 : (currentStep / totalSteps) * 70;

  // Advance to next step
  const advanceStep = useCallback(() => {
    setStepVisible(false);
    setTimeout(() => {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(prev => prev + 1);
      }
      setStepVisible(true);
    }, 250);
  }, [currentStep, totalSteps]);

  // Go back one step
  const goBackStep = useCallback(() => {
    if (currentStep > 0) {
      setStepVisible(false);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setStepVisible(true);
      }, 250);
    }
  }, [currentStep]);

  // Execute the wizard
  const handleExecute = useCallback(() => {
    setIsExecuting(true);
    setExecutionPhase(0);
    setSlideProgresses(flow.outputSlides.map(() => 0));

    // Animate slides one by one
    let phase = 0;
    const animatePhase = () => {
      if (phase >= flow.outputSlides.length) {
        setIsComplete(true);
        return;
      }
      setExecutionPhase(phase);

      // Animate progress for this slide
      let prog = 0;
      const progInterval = setInterval(() => {
        prog += Math.random() * 18 + 5;
        if (prog >= 100) {
          prog = 100;
          clearInterval(progInterval);
          setSlideProgresses(prev => {
            const next = [...prev];
            next[phase] = 100;
            return next;
          });
          phase++;
          setTimeout(animatePhase, 300);
        } else {
          setSlideProgresses(prev => {
            const next = [...prev];
            next[phase] = prog;
            return next;
          });
        }
      }, 120);
    };
    setTimeout(animatePhase, 500);
  }, [flow.outputSlides]);

  // Handle selection
  const handleSelect = useCallback((optionId: string) => {
    if (!step) return;
    if (step.type === 'multi-select') {
      setSelections(prev => {
        const current = (prev[step.id] as string[]) || [];
        return {
          ...prev,
          [step.id]: current.includes(optionId)
            ? current.filter(id => id !== optionId)
            : [...current, optionId],
        };
      });
    } else {
      setSelections(prev => ({ ...prev, [step.id]: optionId }));
      // Auto-advance or execute if last step
      setTimeout(() => {
        if (currentStep >= totalSteps - 1) {
          handleExecute();
        } else {
          advanceStep();
        }
      }, 400);
    }
  }, [step, currentStep, totalSteps, handleExecute, advanceStep]);

  // Check if current step can advance (for multi-select)
  const canAdvance = step?.type === 'multi-select'
    ? ((selections[step.id] as string[]) || []).length > 0
    : step?.type === 'upload'
      ? !!uploadedFile
      : step?.type === 'input'
        ? inputText.trim().length > 0
        : true;

  // Check if all steps are done
  const allStepsDone = currentStep === totalSteps - 1 && canAdvance;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Header with progress ─── */}
      <div className="shrink-0 border-b border-border bg-gradient-to-b from-accent/40 to-transparent px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2.5 mb-2">
          <button
            onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all active:scale-95"
          >
            <MaterialIcon icon="arrow_forward" size={16} className="text-muted-foreground" />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${flow.color}15` }}>
            <MaterialIcon icon={flow.icon} size={18} style={{ color: flow.color } as any} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] sm:text-[14px] font-bold text-foreground truncate">إنشاء {flow.title}</h3>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">
              {isComplete ? 'اكتمل بنجاح' : isExecuting ? 'جاري التنفيذ...' : `الخطوة ${currentStep + 1} من ${totalSteps}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-accent rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${flow.color}, ${flow.color}cc)`,
            }}
          />
        </div>

        {/* Step indicators */}
        {!isExecuting && (
          <div className="flex items-center gap-1 mt-2">
            {flow.steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-500 ${
                    i < currentStep
                      ? 'bg-primary text-primary-foreground scale-90'
                      : i === currentStep
                        ? 'ring-2 ring-primary/30 text-primary scale-110'
                        : 'bg-accent text-muted-foreground scale-90'
                  }`}
                  style={i <= currentStep ? { backgroundColor: i < currentStep ? flow.color : `${flow.color}20`, color: i < currentStep ? 'white' : flow.color } : {}}
                >
                  {i < currentStep ? <MaterialIcon icon="check" size={10} /> : i + 1}
                </div>
                {i < flow.steps.length - 1 && (
                  <div className={`w-3 sm:w-5 h-px transition-all duration-500 ${i < currentStep ? 'bg-primary' : 'bg-border'}`}
                    style={i < currentStep ? { backgroundColor: flow.color } : {}}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Content Area ─── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
        {/* ═══ Step Content ═══ */}
        {!isExecuting && !isComplete && step && (
          <div className={`transition-all duration-300 ${stepVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Step title */}
            <div className="flex items-center gap-2 mb-3 wizard-step-enter">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${flow.color}12` }}>
                <MaterialIcon icon={step.icon} size={16} style={{ color: flow.color } as any} />
              </div>
              <h4 className="text-[13px] sm:text-[14px] font-bold text-foreground">{step.title}</h4>
            </div>

            {/* Select / Multi-select options */}
            {(step.type === 'select' || step.type === 'multi-select') && step.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {step.options.map((opt, i) => {
                  const isSelected = step.type === 'multi-select'
                    ? ((selections[step.id] as string[]) || []).includes(opt.id)
                    : selections[step.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect(opt.id)}
                      className={`relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-right transition-all duration-300 group wizard-option-enter ${
                        isSelected
                          ? 'border-primary/40 shadow-sm'
                          : 'border-border hover:border-primary/20 hover:shadow-sm'
                      }`}
                      style={{
                        animationDelay: `${i * 0.06}s`,
                        backgroundColor: isSelected ? `${flow.color}08` : undefined,
                        borderColor: isSelected ? `${flow.color}40` : undefined,
                      }}
                    >
                      {/* Selection indicator */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${
                        isSelected ? 'border-primary scale-110' : 'border-muted-foreground/30 group-hover:border-primary/40'
                      }`} style={isSelected ? { borderColor: flow.color, backgroundColor: `${flow.color}15` } : {}}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full animate-scale-pop" style={{ backgroundColor: flow.color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <MaterialIcon icon={opt.icon} size={14} className={isSelected ? '' : 'text-muted-foreground'} style={isSelected ? { color: flow.color } as any : {}} />
                          <span className={`text-[11px] sm:text-[12px] font-medium ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>{opt.label}</span>
                        </div>
                        {opt.desc && (
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Upload zone */}
            {step.type === 'upload' && (
              <div
                className="wizard-option-enter border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => setUploadedFile('sample-file.pdf')}
              >
                <div className="w-14 h-14 rounded-2xl bg-accent/60 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                  <MaterialIcon icon="cloud_upload" size={28} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[12px] font-medium text-foreground mb-1">اسحب الملف هنا أو انقر للرفع</p>
                <p className="text-[10px] text-muted-foreground">{step.placeholder}</p>
                {uploadedFile && (
                  <div className="mt-3 flex items-center gap-2 justify-center px-3 py-1.5 bg-primary/5 rounded-lg animate-scale-pop">
                    <MaterialIcon icon="description" size={14} className="text-primary" />
                    <span className="text-[11px] font-medium text-primary">{uploadedFile}</span>
                    <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }} className="text-muted-foreground hover:text-destructive">
                      <MaterialIcon icon="close" size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Range slider */}
            {step.type === 'range' && (
              <div className="wizard-option-enter space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">الحد الأدنى: {step.min}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px] font-bold" style={{ color: flow.color }}>{rangeValue}</span>
                    <span className="text-[11px] text-muted-foreground">شريحة</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">الحد الأقصى: {step.max}</span>
                </div>
                <input
                  type="range"
                  min={step.min}
                  max={step.max}
                  value={rangeValue}
                  onChange={e => setRangeValue(e.target.value)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                  style={{ accentColor: flow.color }}
                />
              </div>
            )}

            {/* Input text */}
            {step.type === 'input' && (
              <div className="wizard-option-enter">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={step.placeholder || 'اكتب هنا...'}
                  className="w-full text-[12px] text-foreground placeholder:text-muted-foreground bg-transparent border border-border rounded-xl outline-none resize-none leading-relaxed p-3 focus:border-primary/30 transition-all h-24"
                />
              </div>
            )}

            {/* Multi-select continue button */}
            {(step.type === 'multi-select' || step.type === 'upload' || step.type === 'range' || step.type === 'input') && (
              <div className="mt-4 flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={goBackStep}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-medium text-muted-foreground hover:bg-accent transition-all"
                  >
                    <MaterialIcon icon="arrow_forward" size={14} />
                    السابق
                  </button>
                )}
                <button
                  onClick={allStepsDone ? handleExecute : advanceStep}
                  disabled={!canAdvance}
                  className="flex-1 h-9 sm:h-10 rounded-xl text-white text-[12px] sm:text-[13px] font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 wizard-btn-glow"
                  style={{ backgroundColor: flow.color }}
                >
                  <MaterialIcon icon={allStepsDone ? 'auto_awesome' : 'arrow_back'} size={16} />
                  {allStepsDone ? 'تنفيذ' : 'التالي'}
                </button>
              </div>
            )}

            {/* Single select back button */}
            {step.type === 'select' && currentStep > 0 && (
              <div className="mt-3">
                <button
                  onClick={goBackStep}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent transition-all"
                >
                  <MaterialIcon icon="arrow_forward" size={14} />
                  الخطوة السابقة
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ Execution Phase — Gamma-like Dynamic Output ═══ */}
        {isExecuting && !isComplete && (
          <div className="space-y-2">
            {flow.outputSlides.map((slide, i) => {
              const isActive = i === executionPhase;
              const isDone = i < executionPhase;
              const isPending = i > executionPhase;
              const progress = slideProgresses[i] || 0;

              return (
                <div
                  key={slide.id}
                  className={`relative rounded-xl border overflow-hidden transition-all duration-500 ${
                    isActive
                      ? 'border-primary/30 shadow-lg scale-[1.01] execution-slide-active'
                      : isDone
                        ? 'border-border/50 opacity-80 scale-[0.98]'
                        : 'border-border/30 opacity-40 scale-[0.96]'
                  }`}
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    borderColor: isActive ? `${slide.color}40` : undefined,
                  }}
                >
                  {/* Slide glow effect when active */}
                  {isActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl execution-glow-bar" style={{ background: `linear-gradient(90deg, transparent, ${slide.color}, transparent)` }} />
                      <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(ellipse at center, ${slide.color}, transparent 70%)` }} />
                    </div>
                  )}

                  <div className="p-3 sm:p-4 relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500 ${
                          isDone ? 'scale-90' : isActive ? 'scale-110 execution-icon-pulse' : ''
                        }`}
                        style={{ backgroundColor: `${slide.color}15` }}
                      >
                        {isDone ? (
                          <MaterialIcon icon="check_circle" size={18} style={{ color: slide.color } as any} />
                        ) : isActive ? (
                          <MaterialIcon icon={slide.icon} size={18} className="execution-icon-spin" style={{ color: slide.color } as any} />
                        ) : (
                          <MaterialIcon icon={slide.icon} size={18} className="text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className={`text-[11px] sm:text-[12px] font-bold transition-colors ${isDone || isActive ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                          {slide.title}
                        </h5>
                        <p className={`text-[9px] sm:text-[10px] transition-colors ${isActive ? 'text-foreground/70' : 'text-muted-foreground/40'}`}>
                          {slide.content}
                        </p>
                      </div>
                      {isDone && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${slide.color}15`, color: slide.color }}>
                          اكتمل
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: slide.color }}>
                          {Math.round(progress)}٪
                        </span>
                      )}
                    </div>

                    {/* Progress bar for active slide */}
                    {isActive && (
                      <div className="mt-2.5 h-1 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200 execution-progress-shimmer"
                          style={{ width: `${progress}%`, backgroundColor: slide.color }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Completion State ═══ */}
        {isComplete && (
          <div className="flex flex-col items-center justify-center py-6 sm:py-8 wizard-complete-enter">
            {/* Success animation */}
            <div className="relative mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center wizard-success-ring" style={{ backgroundColor: `${flow.color}10` }}>
                <MaterialIcon icon="check_circle" size={36} className="wizard-success-check" style={{ color: flow.color } as any} />
              </div>
              {/* Particles */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full wizard-particle"
                  style={{
                    backgroundColor: flow.color,
                    top: '50%',
                    left: '50%',
                    animationDelay: `${i * 0.1}s`,
                    '--particle-angle': `${i * 45}deg`,
                  } as any}
                />
              ))}
            </div>

            <h3 className="text-[15px] sm:text-[17px] font-bold text-foreground mb-1 wizard-text-reveal">
              تم إنشاء {flow.title} بنجاح
            </h3>
            <p className="text-[11px] sm:text-[12px] text-muted-foreground mb-5 wizard-text-reveal" style={{ animationDelay: '0.2s' }}>
              {flow.outputSlides.length} مراحل مكتملة — جاهز للتصدير
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 wizard-text-reveal" style={{ animationDelay: '0.4s' }}>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[12px] font-medium transition-all active:scale-[0.97] wizard-btn-glow"
                style={{ backgroundColor: flow.color }}
              >
                <MaterialIcon icon="download" size={15} />
                تصدير
              </button>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-[12px] font-medium text-foreground hover:bg-accent transition-all active:scale-[0.97]"
              >
                <MaterialIcon icon="visibility" size={15} />
                معاينة
              </button>
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium text-muted-foreground hover:bg-accent transition-all active:scale-[0.97]"
              >
                <MaterialIcon icon="arrow_forward" size={15} />
                رجوع
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
