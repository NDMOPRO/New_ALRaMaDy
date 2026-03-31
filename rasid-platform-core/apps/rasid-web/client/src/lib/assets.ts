// ===== RASID LOGOS =====
// Light mode: Rased5 (gold outline) for header, Rased4 (dark) for alt
// Dark mode: Rased7 (cream) for header, Rased2b (royal blue+gold) for alt
export const LOGOS = {
  // Light mode
  light_header: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased5_light_header_46f09daa.webp',
  light_alt: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased4_light_alt_041c6a51.webp',
  // Dark mode
  dark_header: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased7_dark_header_942fdefe.webp',
  dark_alt: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased2_dark_alt_40be2c8a.webp',
  // Favicon / brand mark
  rased6: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/rased6_favicon_a0d52dd8.webp',
} as const;

// ===== RASID CHARACTERS =====
export const CHARACTERS = {
  char1_waving: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char1_waving_f35e1746.webp',
  char2_shmagh: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char2_shmagh_85ac5571.webp',
  char3_dark: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char3_dark_aa070f45.webp',
  char3b_dark: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char3b_dark_0414f76c.webp',
  char4_sunglasses: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char4_sunglasses_ce29dde5.webp',
  char5_arms_crossed: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char5_arms_crossed_cc65d2f4.webp',
  char6_standing: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/B8X3qzWwAiWESGswgdyiHN/char6_standing_764eae9a.webp',
} as const;

// ===== STUDIO TOOLS =====
export const STUDIO_TOOLS = [
  { id: 'dashboard', label: 'لوحة مؤشرات', icon: 'dashboard', desc: 'لوحة مؤشرات تفاعلية', color: '#1e40af' },
  { id: 'report', label: 'تقرير', icon: 'description', desc: 'تقرير احترافي', color: '#059669' },
  { id: 'presentation', label: 'عرض', icon: 'slideshow', desc: 'عرض شرائح', color: '#d97706' },
  { id: 'matching', label: 'مطابقة', icon: 'compare', desc: 'مطابقة بصرية', color: '#7c3aed' },
  { id: 'arabization', label: 'تعريب', icon: 'g_translate', desc: 'تعريب المحتوى', color: '#0891b2' },
  { id: 'extraction', label: 'تفريغ', icon: 'text_snippet', desc: 'استخراج نصوص', color: '#dc2626' },
  { id: 'translation', label: 'ترجمة', icon: 'translate', desc: 'ترجمة متعددة', color: '#4f46e5' },
] as const;

// ===== DATA PANEL =====
export const DATA_TABS = [
  { id: 'all', label: 'الكل', icon: 'apps' },
  { id: 'files', label: 'الملفات', icon: 'description' },
  { id: 'tables', label: 'الجداول', icon: 'table_chart' },
  { id: 'groups', label: 'المجموعات', icon: 'folder' },
  { id: 'flows', label: 'التدفقات', icon: 'account_tree' },
] as const;

export const DATA_STATUSES = {
  ready: { label: 'جاهز', color: '#059669', bg: '#ecfdf5', darkBg: 'rgba(5,150,105,0.15)' },
  processing: { label: 'قيد المعالجة', color: '#d97706', bg: '#fffbeb', darkBg: 'rgba(217,119,6,0.15)' },
  review: { label: 'يحتاج مراجعة', color: '#2563eb', bg: '#eff6ff', darkBg: 'rgba(37,99,235,0.15)' },
  failed: { label: 'فشل', color: '#dc2626', bg: '#fef2f2', darkBg: 'rgba(220,38,38,0.15)' },
  merged: { label: 'مدمج', color: '#7c3aed', bg: '#f5f3ff', darkBg: 'rgba(124,58,237,0.15)' },
} as const;

// ===== QUICK ACTIONS =====
export const QUICK_ACTIONS = [
  { id: 'analyze', label: 'تحليل البيانات', icon: 'analytics', desc: 'تحليل شامل للبيانات المرفوعة' },
  { id: 'dashboard', label: 'إنشاء لوحة مؤشرات', icon: 'dashboard', desc: 'لوحة مؤشرات تفاعلية' },
  { id: 'report', label: 'إنشاء تقرير', icon: 'description', desc: 'تقرير احترافي جاهز' },
  { id: 'compare', label: 'مقارنة جهات', icon: 'compare', desc: 'مقارنة بين جهتين أو أكثر' },
  { id: 'clean', label: 'تنظيف البيانات', icon: 'cleaning_services', desc: 'تنظيف وتوحيد البيانات' },
  { id: 'merge', label: 'دمج الجداول', icon: 'merge_type', desc: 'دمج جداول متعددة' },
] as const;

// ===== CHAT OPTIONS =====
export const CHAT_OPTIONS: Array<{ id: string; label: string; icon: string; danger?: boolean }> = [
  { id: 'save', label: 'حفظ المحادثة', icon: 'save' },
  { id: 'rename', label: 'تغيير العنوان', icon: 'edit' },
  { id: 'favorite', label: 'تعيين كمفضلة', icon: 'star' },
  { id: 'export', label: 'تصدير المحادثة', icon: 'download' },
  { id: 'clear', label: 'مسح المحادثة', icon: 'delete', danger: true },
];

// ===== WORKSPACE VIEWS =====
export const WORKSPACE_VIEWS = [
  { id: 'chat', label: 'راصد الذكي', icon: 'smart_toy' },
  { id: 'dashboard', label: 'لوحة المؤشرات', icon: 'dashboard' },
  { id: 'reports', label: 'التقارير', icon: 'description' },
  { id: 'presentations', label: 'العروض', icon: 'slideshow' },
  { id: 'data', label: 'بياناتي', icon: 'table_chart' },
  { id: 'library', label: 'مكتبتي', icon: 'folder_open' },
  { id: 'translation', label: 'الترجمة', icon: 'translate' },
  { id: 'extraction', label: 'التفريغ', icon: 'text_snippet' },
  { id: 'matching', label: 'المطابقة', icon: 'compare' },
] as const;

// ===== SETUP PANEL COMMON OPTIONS =====
export const SETUP_COMMON = {
  advancedOptions: 'خيارات متقدمة',
  contentAdherence: 'الالتزام بالمحتوى',
  officialIdentity: 'الهوية الرسمية',
  contentSource: 'مصدر المحتوى',
  executionScope: 'نطاق التنفيذ',
} as const;

// ===== ANALYSIS TYPES =====
export const ANALYSIS_TYPES = [
  { id: 'compliance', label: 'تحليل الامتثال', icon: 'verified', desc: 'تحليل مستوى امتثال الجهات' },
  { id: 'classification', label: 'تحليل التصنيف', icon: 'category', desc: 'تحليل تصنيف البيانات' },
  { id: 'personal', label: 'البيانات الشخصية', icon: 'person_search', desc: 'تحليل البيانات الشخصية' },
  { id: 'quality', label: 'جودة البيانات', icon: 'fact_check', desc: 'تقييم جودة البيانات' },
  { id: 'gaps', label: 'تحليل الفجوات', icon: 'troubleshoot', desc: 'تحديد الفجوات والنواقص' },
  { id: 'comparison', label: 'مقارنة', icon: 'compare_arrows', desc: 'مقارنة بين فترات أو جهات' },
] as const;

// ===== REPORT SECTIONS =====
export const REPORT_SECTIONS = [
  { id: 'cover', label: 'الغلاف', icon: 'image' },
  { id: 'summary', label: 'الملخص التنفيذي', icon: 'summarize' },
  { id: 'methodology', label: 'المنهجية', icon: 'science' },
  { id: 'results', label: 'النتائج', icon: 'assessment' },
  { id: 'tables', label: 'الجداول', icon: 'table_chart' },
  { id: 'charts', label: 'الرسوم البيانية', icon: 'bar_chart' },
  { id: 'recommendations', label: 'التوصيات', icon: 'lightbulb' },
] as const;

// ===== OUTPUT ACTIONS =====
export const REPORT_ACTIONS = [
  { id: 'save', label: 'حفظ', icon: 'save' },
  { id: 'approve', label: 'اعتماد', icon: 'check_circle' },
  { id: 'export', label: 'تصدير', icon: 'download' },
  { id: 'share', label: 'مشاركة', icon: 'share' },
  { id: 'review', label: 'إرسال للمراجعة', icon: 'send' },
] as const;

export const PRESENTATION_ACTIONS = [
  { id: 'save', label: 'حفظ', icon: 'save' },
  { id: 'export', label: 'تصدير', icon: 'download' },
  { id: 'present', label: 'عرض', icon: 'play_arrow' },
  { id: 'share', label: 'مشاركة', icon: 'share' },
  { id: 'review', label: 'إرسال للمراجعة', icon: 'send' },
] as const;

export const DASHBOARD_ACTIONS = [
  { id: 'save', label: 'حفظ', icon: 'save' },
  { id: 'publish', label: 'نشر', icon: 'publish' },
  { id: 'share', label: 'مشاركة', icon: 'share' },
  { id: 'export', label: 'تصدير', icon: 'download' },
  { id: 'analyze', label: 'تحليل مباشر', icon: 'analytics' },
] as const;

// ===== BACKGROUNDS =====
export const BACKGROUNDS = {
  pattern: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+',
} as const;

// ===== PRESENTATION STYLES =====
export const PRESENTATION_STYLES = [
  { id: 'professional', label: 'احترافي', icon: 'business_center' },
  { id: 'academic', label: 'أكاديمي', icon: 'school' },
  { id: 'creative', label: 'إبداعي', icon: 'palette' },
  { id: 'minimal', label: 'بسيط', icon: 'crop_square' },
  { id: 'data-driven', label: 'بيانات', icon: 'bar_chart' },
] as const;

// ===== SLIDE COUNTS =====
export const SLIDE_COUNTS = [5, 8, 10, 12, 15, 20] as const;

// ===== BRAND THEMES =====
export const BRAND_THEMES = [
  { id: 'ndmo', label: 'مكتب إدارة البيانات', primary: '#d4af37' },
  { id: 'sdaia', label: 'سدايا', primary: '#1a73e8' },
  { id: 'modern', label: 'عصري', primary: '#6366f1' },
  { id: 'minimal', label: 'بسيط', primary: '#1f2937' },
  { id: 'creative', label: 'إبداعي', primary: '#ec4899' },
] as const;

// ===== DATA ITEM CONTEXT MENU =====
export const DATA_ITEM_MENU: Array<{ id: string; label: string; icon: string; danger?: boolean }> = [
  { id: 'rename', label: 'إعادة تسمية', icon: 'edit' },
  { id: 'sort', label: 'ترتيب', icon: 'sort' },
  { id: 'favorite', label: 'إضافة للمفضلة', icon: 'star' },
  { id: 'pin', label: 'تثبيت', icon: 'push_pin' },
  { id: 'workspace', label: 'عرض في مساحة العمل', icon: 'open_in_new' },
  { id: 'hide', label: 'إخفاء', icon: 'visibility_off' },
  { id: 'delete', label: 'حذف', icon: 'delete', danger: true },
];
