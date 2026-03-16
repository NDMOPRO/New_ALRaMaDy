/**
 * Populate all 17 slide elements with full HTML templates.
 * Each template is a complete standalone HTML slide (1280x720)
 * with NDMO professional design, Chart.js, Arabic fonts (Tajawal).
 * 
 * Run: node scripts/populate-html-templates.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const NDMO_COLORS = {
  navy: '#0f2744',
  navyLight: '#1a3a5c',
  gold: '#d4af37',
  goldLight: '#e8c84a',
  white: '#ffffff',
  gray: '#f0f2f5',
  grayDark: '#6b7280',
  accent: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  teal: '#0d9488',
};

const BASE_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
  .slide { width: 1280px; min-height: 720px; font-family: 'Tajawal', sans-serif; direction: rtl; position: relative; overflow: hidden; }
`;

function wrapSlide(innerCSS, innerHTML, extraScripts = '') {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
${extraScripts.includes('chart.js') ? '<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1"></script>' : ''}
<style>
${BASE_STYLE}
${innerCSS}
</style>
</head>
<body>
<div class="slide">
${innerHTML}
</div>
${extraScripts.includes('<script') ? extraScripts : ''}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// ELEMENT 1: Cover Slide (شريحة غلاف العرض التقديمي)
// ═══════════════════════════════════════════════════════════════
const el1_css = `
  .slide { background: linear-gradient(135deg, ${NDMO_COLORS.navy} 0%, #0a1929 100%); color: ${NDMO_COLORS.white}; display: flex; align-items: center; justify-content: center; }
  .cover-content { text-align: center; z-index: 2; padding: 60px; }
  .logo-area { width: 80px; height: 80px; border-radius: 16px; background: ${NDMO_COLORS.gold}; display: flex; align-items: center; justify-content: center; margin: 0 auto 40px; font-size: 32px; font-weight: 900; color: ${NDMO_COLORS.navy}; }
  .cover-title { font-size: 48px; font-weight: 900; line-height: 1.3; margin-bottom: 16px; }
  .cover-subtitle { font-size: 22px; font-weight: 400; opacity: 0.7; margin-bottom: 40px; }
  .cover-meta { display: flex; gap: 32px; justify-content: center; font-size: 14px; opacity: 0.5; }
  .geo-shape { position: absolute; border-radius: 50%; opacity: 0.05; }
  .geo1 { width: 400px; height: 400px; background: ${NDMO_COLORS.gold}; top: -100px; right: -100px; }
  .geo2 { width: 300px; height: 300px; background: ${NDMO_COLORS.accent}; bottom: -80px; left: -80px; }
  .geo3 { width: 200px; height: 200px; border: 3px solid ${NDMO_COLORS.gold}; top: 50%; left: 10%; opacity: 0.08; }
  .bottom-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, ${NDMO_COLORS.gold}, ${NDMO_COLORS.accent}, ${NDMO_COLORS.gold}); }
`;
const el1_html = `
  <div class="geo-shape geo1"></div>
  <div class="geo-shape geo2"></div>
  <div class="geo-shape geo3"></div>
  <div class="cover-content">
    <div class="logo-area">ه.و.ب</div>
    <h1 class="cover-title">الخطة الاستراتيجية للبيانات الوطنية</h1>
    <p class="cover-subtitle">الهيئة الوطنية للبيانات والذكاء الاصطناعي</p>
    <div class="cover-meta">
      <span>الربع الرابع 2024</span>
      <span>سري — للاستخدام الداخلي</span>
    </div>
  </div>
  <div class="bottom-bar"></div>
`;
const TEMPLATE_1 = wrapSlide(el1_css, el1_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 2: Table of Contents (فهرس العرض التقديمي)
// ═══════════════════════════════════════════════════════════════
const el2_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 60px 80px; }
  .toc-header { font-size: 36px; font-weight: 800; margin-bottom: 8px; }
  .toc-sub { font-size: 16px; color: ${NDMO_COLORS.grayDark}; margin-bottom: 40px; }
  .toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .toc-item { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 12px; background: ${NDMO_COLORS.gray}; border-right: 4px solid transparent; transition: all 0.2s; }
  .toc-item:hover { border-right-color: ${NDMO_COLORS.gold}; background: #e8ecf1; }
  .toc-num { width: 44px; height: 44px; border-radius: 10px; background: ${NDMO_COLORS.navy}; color: ${NDMO_COLORS.gold}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; flex-shrink: 0; }
  .toc-label { font-size: 15px; font-weight: 600; }
  .toc-desc { font-size: 11px; color: ${NDMO_COLORS.grayDark}; margin-top: 2px; }
  .slide-num { position: absolute; bottom: 30px; left: 40px; font-size: 12px; color: ${NDMO_COLORS.grayDark}; }
`;
const el2_html = `
  <h2 class="toc-header">فهرس المحتويات</h2>
  <p class="toc-sub">نظرة شاملة على أقسام العرض التقديمي</p>
  <div class="toc-grid">
    <div class="toc-item"><div class="toc-num">01</div><div><div class="toc-label">المقدمة والأهداف</div><div class="toc-desc">الغرض من العرض والمخرجات المتوقعة</div></div></div>
    <div class="toc-item"><div class="toc-num">02</div><div><div class="toc-label">الملخص التنفيذي</div><div class="toc-desc">أبرز النتائج والتوصيات</div></div></div>
    <div class="toc-item"><div class="toc-num">03</div><div><div class="toc-label">تقييم الوضع الراهن</div><div class="toc-desc">تحليل النضج والفجوات</div></div></div>
    <div class="toc-item"><div class="toc-num">04</div><div><div class="toc-label">الإطار الاستراتيجي</div><div class="toc-desc">الركائز والمبادرات الرئيسية</div></div></div>
    <div class="toc-item"><div class="toc-num">05</div><div><div class="toc-label">خارطة الطريق</div><div class="toc-desc">مراحل التنفيذ والجدول الزمني</div></div></div>
    <div class="toc-item"><div class="toc-num">06</div><div><div class="toc-label">مؤشرات الأداء</div><div class="toc-desc">KPIs والمستهدفات</div></div></div>
    <div class="toc-item"><div class="toc-num">07</div><div><div class="toc-label">الحوكمة والأدوار</div><div class="toc-desc">مصفوفة المسؤوليات</div></div></div>
    <div class="toc-item"><div class="toc-num">08</div><div><div class="toc-label">التوصيات والخطوات التالية</div><div class="toc-desc">الإجراءات المطلوبة</div></div></div>
  </div>
  <span class="slide-num">02</span>
`;
const TEMPLATE_2 = wrapSlide(el2_css, el2_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 3: KPI Cards (بطاقة مؤشرات الأداء الرئيسية)
// ═══════════════════════════════════════════════════════════════
const el3_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .kpi-title { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
  .kpi-sub { font-size: 14px; color: ${NDMO_COLORS.grayDark}; margin-bottom: 32px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .kpi-card { background: linear-gradient(135deg, ${NDMO_COLORS.navy}, ${NDMO_COLORS.navyLight}); border-radius: 16px; padding: 28px; color: white; position: relative; overflow: hidden; }
  .kpi-card::after { content: ''; position: absolute; top: -20px; left: -20px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.05); }
  .kpi-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(212,175,55,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; }
  .kpi-value { font-size: 36px; font-weight: 900; color: ${NDMO_COLORS.gold}; margin-bottom: 4px; }
  .kpi-label { font-size: 13px; opacity: 0.7; margin-bottom: 12px; }
  .kpi-change { font-size: 12px; padding: 4px 10px; border-radius: 20px; display: inline-block; }
  .kpi-up { background: rgba(16,185,129,0.2); color: #6ee7b7; }
  .kpi-down { background: rgba(239,68,68,0.2); color: #fca5a5; }
`;
const el3_html = `
  <h2 class="kpi-title">مؤشرات الأداء الرئيسية</h2>
  <p class="kpi-sub">الربع الرابع 2024 — مقارنة بالربع السابق</p>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon">📊</div>
      <div class="kpi-value">87%</div>
      <div class="kpi-label">نسبة الانتقال العام</div>
      <span class="kpi-change kpi-up">↑ 12% عن الربع السابق</span>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">🏛️</div>
      <div class="kpi-value">142</div>
      <div class="kpi-label">جهة حكومية مرتبطة</div>
      <span class="kpi-change kpi-up">↑ 18 جهة جديدة</span>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">📋</div>
      <div class="kpi-value">94%</div>
      <div class="kpi-label">نسبة الامتثال</div>
      <span class="kpi-change kpi-up">↑ 7% تحسن</span>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">⚡</div>
      <div class="kpi-value">3.8</div>
      <div class="kpi-label">مستوى النضج (من 5)</div>
      <span class="kpi-change kpi-down">↓ 0.2 عن المستهدف</span>
    </div>
  </div>
`;
const TEMPLATE_3 = wrapSlide(el3_css, el3_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 4: Organizational Summary Infographic (ملخص تنظيمي)
// ═══════════════════════════════════════════════════════════════
const el4_css = `
  .slide { background: linear-gradient(180deg, ${NDMO_COLORS.navy} 0%, #0a1929 100%); color: white; padding: 50px 60px; }
  .org-title { font-size: 28px; font-weight: 800; margin-bottom: 32px; color: ${NDMO_COLORS.gold}; }
  .org-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .org-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px; text-align: center; backdrop-filter: blur(8px); }
  .org-card-icon { width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, ${NDMO_COLORS.gold}, ${NDMO_COLORS.goldLight}); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px; }
  .org-card-label { font-size: 12px; opacity: 0.5; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .org-card-value { font-size: 22px; font-weight: 800; }
  .org-card-sub { font-size: 11px; opacity: 0.4; margin-top: 4px; }
  .org-footer { margin-top: 32px; text-align: center; font-size: 12px; opacity: 0.3; }
`;
const el4_html = `
  <h2 class="org-title">الهيئة الوطنية للبيانات والذكاء الاصطناعي</h2>
  <div class="org-grid">
    <div class="org-card">
      <div class="org-card-icon">📅</div>
      <div class="org-card-label">تاريخ التأسيس</div>
      <div class="org-card-value">1440 هـ</div>
      <div class="org-card-sub">الموافق 2019م</div>
    </div>
    <div class="org-card">
      <div class="org-card-icon">📜</div>
      <div class="org-card-label">المرجع التنظيمي</div>
      <div class="org-card-value">أمر ملكي</div>
      <div class="org-card-sub">رقم (أ/418)</div>
    </div>
    <div class="org-card">
      <div class="org-card-icon">👤</div>
      <div class="org-card-label">الرئيس التنفيذي</div>
      <div class="org-card-value">د. عبدالله الغامدي</div>
      <div class="org-card-sub">معالي الرئيس</div>
    </div>
    <div class="org-card">
      <div class="org-card-icon">📍</div>
      <div class="org-card-label">المقر الرئيسي</div>
      <div class="org-card-value">الرياض</div>
      <div class="org-card-sub">المملكة العربية السعودية</div>
    </div>
    <div class="org-card">
      <div class="org-card-icon">👥</div>
      <div class="org-card-label">عدد الموظفين</div>
      <div class="org-card-value">+850</div>
      <div class="org-card-sub">موظف وموظفة</div>
    </div>
    <div class="org-card">
      <div class="org-card-icon">🏢</div>
      <div class="org-card-label">الجهات المرتبطة</div>
      <div class="org-card-value">142</div>
      <div class="org-card-sub">جهة حكومية</div>
    </div>
  </div>
  <div class="org-footer">المصدر: التقرير السنوي للهيئة الوطنية للبيانات 2024</div>
`;
const TEMPLATE_4 = wrapSlide(el4_css, el4_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 5: Vision 2030 Infographic (إنفوجرافيك الارتباط برؤية المملكة 2030)
// ═══════════════════════════════════════════════════════════════
const el5_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .v-title { font-size: 28px; font-weight: 800; margin-bottom: 32px; text-align: center; }
  .v-title span { color: ${NDMO_COLORS.gold}; }
  .pillars { display: flex; gap: 24px; justify-content: center; }
  .pillar { flex: 1; max-width: 360px; border-radius: 16px; overflow: hidden; }
  .pillar-header { padding: 20px; text-align: center; color: white; font-size: 18px; font-weight: 800; }
  .p1 .pillar-header { background: linear-gradient(135deg, #0d9488, #14b8a6); }
  .p2 .pillar-header { background: linear-gradient(135deg, ${NDMO_COLORS.accent}, #3b82f6); }
  .p3 .pillar-header { background: linear-gradient(135deg, ${NDMO_COLORS.gold}, ${NDMO_COLORS.goldLight}); color: ${NDMO_COLORS.navy}; }
  .pillar-body { background: ${NDMO_COLORS.gray}; padding: 20px; }
  .pillar-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 13px; }
  .pillar-item:last-child { border-bottom: none; }
  .pillar-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .p1 .pillar-dot { background: #0d9488; }
  .p2 .pillar-dot { background: ${NDMO_COLORS.accent}; }
  .p3 .pillar-dot { background: ${NDMO_COLORS.gold}; }
  .slide-num { position: absolute; bottom: 20px; left: 40px; font-size: 12px; color: ${NDMO_COLORS.grayDark}; }
`;
const el5_html = `
  <h2 class="v-title">الارتباط بـ<span>رؤية المملكة 2030</span></h2>
  <div class="pillars">
    <div class="pillar p1">
      <div class="pillar-header">مجتمع حيوي</div>
      <div class="pillar-body">
        <div class="pillar-item"><div class="pillar-dot"></div>تعزيز الشفافية الحكومية</div>
        <div class="pillar-item"><div class="pillar-dot"></div>تمكين المواطن من البيانات</div>
        <div class="pillar-item"><div class="pillar-dot"></div>حماية الخصوصية</div>
        <div class="pillar-item"><div class="pillar-dot"></div>تحسين جودة الخدمات</div>
      </div>
    </div>
    <div class="pillar p2">
      <div class="pillar-header">اقتصاد مزدهر</div>
      <div class="pillar-body">
        <div class="pillar-item"><div class="pillar-dot"></div>البيانات المفتوحة</div>
        <div class="pillar-item"><div class="pillar-dot"></div>الابتكار القائم على البيانات</div>
        <div class="pillar-item"><div class="pillar-dot"></div>تمكين القطاع الخاص</div>
        <div class="pillar-item"><div class="pillar-dot"></div>الاقتصاد الرقمي</div>
      </div>
    </div>
    <div class="pillar p3">
      <div class="pillar-header">وطن طموح</div>
      <div class="pillar-body">
        <div class="pillar-item"><div class="pillar-dot"></div>الحوكمة الرشيدة للبيانات</div>
        <div class="pillar-item"><div class="pillar-dot"></div>البنية التحتية الرقمية</div>
        <div class="pillar-item"><div class="pillar-dot"></div>الكفاءات الوطنية</div>
        <div class="pillar-item"><div class="pillar-dot"></div>التميز المؤسسي</div>
      </div>
    </div>
  </div>
  <span class="slide-num">08</span>
`;
const TEMPLATE_5 = wrapSlide(el5_css, el5_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 6: Objectives & Outputs (الغرض من العرض)
// ═══════════════════════════════════════════════════════════════
const el6_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .obj-title { font-size: 28px; font-weight: 800; margin-bottom: 32px; }
  .obj-main { background: linear-gradient(135deg, ${NDMO_COLORS.navy}, ${NDMO_COLORS.navyLight}); border-radius: 16px; padding: 32px; color: white; margin-bottom: 24px; }
  .obj-main-label { font-size: 12px; color: ${NDMO_COLORS.gold}; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .obj-main-text { font-size: 20px; font-weight: 700; line-height: 1.6; }
  .obj-section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: ${NDMO_COLORS.gold}; display: flex; align-items: center; gap: 8px; }
  .obj-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .obj-card { background: ${NDMO_COLORS.gray}; border-radius: 12px; padding: 20px; border-right: 3px solid ${NDMO_COLORS.gold}; }
  .obj-card-num { font-size: 24px; font-weight: 900; color: ${NDMO_COLORS.gold}; margin-bottom: 8px; }
  .obj-card-text { font-size: 13px; line-height: 1.6; color: ${NDMO_COLORS.navy}; }
`;
const el6_html = `
  <h2 class="obj-title">الغرض من العرض — الأهداف والمخرجات</h2>
  <div class="obj-main">
    <div class="obj-main-label">الهدف الرئيسي</div>
    <div class="obj-main-text">الحصول على اعتماد اللجنة التوجيهية للخطة الاستراتيجية المحدثة للبيانات الوطنية 2025-2030</div>
  </div>
  <div class="obj-section-title">◆ استعراض الأداء</div>
  <div class="obj-cards">
    <div class="obj-card">
      <div class="obj-card-num">01</div>
      <div class="obj-card-text">تسليط الضوء على الإنجازات الرئيسية في الفترة السابقة وأثرها على المنظومة</div>
    </div>
    <div class="obj-card">
      <div class="obj-card-num">02</div>
      <div class="obj-card-text">تحليل التحديات والمعوقات التي واجهت التنفيذ واقتراح حلول عملية</div>
    </div>
    <div class="obj-card">
      <div class="obj-card-num">03</div>
      <div class="obj-card-text">عرض مؤشرات الأداء الرئيسية ومقارنتها بالمستهدفات المعتمدة</div>
    </div>
  </div>
`;
const TEMPLATE_6 = wrapSlide(el6_css, el6_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 7: Maturity Assessment (تقييم النضج والفجوات)
// ═══════════════════════════════════════════════════════════════
const el7_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .mat-title { font-size: 28px; font-weight: 800; margin-bottom: 32px; }
  .mat-overall { display: flex; align-items: center; gap: 24px; background: linear-gradient(135deg, ${NDMO_COLORS.navy}, ${NDMO_COLORS.navyLight}); border-radius: 16px; padding: 24px 32px; color: white; margin-bottom: 24px; }
  .mat-score { font-size: 56px; font-weight: 900; color: ${NDMO_COLORS.gold}; }
  .mat-score-label { font-size: 14px; opacity: 0.6; }
  .mat-score-text { font-size: 18px; font-weight: 700; }
  .mat-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .mat-bar-item { background: ${NDMO_COLORS.gray}; border-radius: 12px; padding: 16px 20px; }
  .mat-bar-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .mat-bar-name { font-size: 13px; font-weight: 700; }
  .mat-bar-val { font-size: 13px; font-weight: 800; color: ${NDMO_COLORS.accent}; }
  .mat-bar-track { height: 8px; background: #dde1e7; border-radius: 4px; overflow: hidden; }
  .mat-bar-fill { height: 100%; border-radius: 4px; }
  .mat-bar-gap { font-size: 11px; color: ${NDMO_COLORS.grayDark}; margin-top: 6px; }
`;
const el7_html = `
  <h2 class="mat-title">تقييم النضج والفجوات</h2>
  <div class="mat-overall">
    <div><div class="mat-score">3.8</div><div class="mat-score-label">من 5.0</div></div>
    <div><div class="mat-score-text">مستوى النضج العام</div><div style="font-size:13px;opacity:0.5;margin-top:4px;">المستهدف: 4.2 — الفجوة: 0.4</div></div>
  </div>
  <div class="mat-bars">
    <div class="mat-bar-item">
      <div class="mat-bar-header"><span class="mat-bar-name">الحوكمة والسياسات</span><span class="mat-bar-val">4.1 / 5</span></div>
      <div class="mat-bar-track"><div class="mat-bar-fill" style="width:82%;background:${NDMO_COLORS.success}"></div></div>
      <div class="mat-bar-gap">الفجوة: 0.3 — أعلى من المتوسط</div>
    </div>
    <div class="mat-bar-item">
      <div class="mat-bar-header"><span class="mat-bar-name">جودة البيانات</span><span class="mat-bar-val">3.6 / 5</span></div>
      <div class="mat-bar-track"><div class="mat-bar-fill" style="width:72%;background:${NDMO_COLORS.warning}"></div></div>
      <div class="mat-bar-gap">الفجوة: 0.8 — يحتاج تحسين</div>
    </div>
    <div class="mat-bar-item">
      <div class="mat-bar-header"><span class="mat-bar-name">العمليات والتشغيل</span><span class="mat-bar-val">3.9 / 5</span></div>
      <div class="mat-bar-track"><div class="mat-bar-fill" style="width:78%;background:${NDMO_COLORS.accent}"></div></div>
      <div class="mat-bar-gap">الفجوة: 0.5 — ضمن المعدل</div>
    </div>
    <div class="mat-bar-item">
      <div class="mat-bar-header"><span class="mat-bar-name">التقنية والأدوات</span><span class="mat-bar-val">4.0 / 5</span></div>
      <div class="mat-bar-track"><div class="mat-bar-fill" style="width:80%;background:${NDMO_COLORS.success}"></div></div>
      <div class="mat-bar-gap">الفجوة: 0.4 — أداء جيد</div>
    </div>
    <div class="mat-bar-item">
      <div class="mat-bar-header"><span class="mat-bar-name">الأفراد والثقافة</span><span class="mat-bar-val">3.4 / 5</span></div>
      <div class="mat-bar-track"><div class="mat-bar-fill" style="width:68%;background:${NDMO_COLORS.danger}"></div></div>
      <div class="mat-bar-gap">الفجوة: 1.0 — أولوية قصوى</div>
    </div>
    <div class="mat-bar-item">
      <div class="mat-bar-header"><span class="mat-bar-name">إدارة البيانات الرئيسية</span><span class="mat-bar-val">3.7 / 5</span></div>
      <div class="mat-bar-track"><div class="mat-bar-fill" style="width:74%;background:${NDMO_COLORS.warning}"></div></div>
      <div class="mat-bar-gap">الفجوة: 0.7 — يحتاج متابعة</div>
    </div>
  </div>
`;
const TEMPLATE_7 = wrapSlide(el7_css, el7_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 8: Stakeholder Matrix (مصفوفة أصحاب المصلحة)
// ═══════════════════════════════════════════════════════════════
const el8_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .stk-title { font-size: 28px; font-weight: 800; margin-bottom: 24px; }
  .matrix { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3px; height: 520px; background: #ddd; border-radius: 16px; overflow: hidden; }
  .quad { padding: 24px; position: relative; }
  .q1 { background: #fef3c7; }
  .q2 { background: #dcfce7; }
  .q3 { background: #f3f4f6; }
  .q4 { background: #dbeafe; }
  .quad-label { font-size: 12px; font-weight: 800; margin-bottom: 12px; padding: 4px 12px; border-radius: 6px; display: inline-block; }
  .q1 .quad-label { background: ${NDMO_COLORS.warning}; color: white; }
  .q2 .quad-label { background: ${NDMO_COLORS.success}; color: white; }
  .q3 .quad-label { background: ${NDMO_COLORS.grayDark}; color: white; }
  .q4 .quad-label { background: ${NDMO_COLORS.accent}; color: white; }
  .quad-strategy { font-size: 11px; color: ${NDMO_COLORS.grayDark}; margin-bottom: 12px; font-style: italic; }
  .stk-item { display: inline-flex; align-items: center; gap: 6px; background: white; border-radius: 8px; padding: 6px 12px; margin: 3px; font-size: 11px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .axis-label { position: absolute; font-size: 11px; font-weight: 700; color: ${NDMO_COLORS.grayDark}; }
  .axis-y { bottom: 50%; right: -30px; transform: rotate(-90deg); }
  .axis-x { bottom: -24px; left: 50%; transform: translateX(-50%); }
`;
const el8_html = `
  <h2 class="stk-title">مصفوفة أصحاب المصلحة</h2>
  <div class="matrix">
    <div class="quad q1">
      <div class="quad-label">إرضاء — تأثير عالٍ / اهتمام منخفض</div>
      <div class="quad-strategy">إبقاء على اطلاع دوري</div>
      <div class="stk-item">🏛️ ديوان المحاسبة</div>
      <div class="stk-item">⚖️ هيئة مكافحة الفساد</div>
    </div>
    <div class="quad q2">
      <div class="quad-label">إدارة عن قرب — تأثير عالٍ / اهتمام عالٍ</div>
      <div class="quad-strategy">شراكة استراتيجية وتواصل مستمر</div>
      <div class="stk-item">👑 مجلس الوزراء</div>
      <div class="stk-item">🏢 وزارة الاتصالات</div>
      <div class="stk-item">💻 هيئة الحكومة الرقمية</div>
      <div class="stk-item">🔐 الهيئة الوطنية للأمن السيبراني</div>
    </div>
    <div class="quad q3">
      <div class="quad-label">مراقبة — تأثير منخفض / اهتمام منخفض</div>
      <div class="quad-strategy">متابعة دورية بأقل جهد</div>
      <div class="stk-item">📰 وسائل الإعلام</div>
      <div class="stk-item">🌐 المنظمات الدولية</div>
    </div>
    <div class="quad q4">
      <div class="quad-label">إبقاء مطلعاً — تأثير منخفض / اهتمام عالٍ</div>
      <div class="quad-strategy">تقارير دورية وورش عمل</div>
      <div class="stk-item">🎓 الجامعات ومراكز البحث</div>
      <div class="stk-item">💼 القطاع الخاص</div>
      <div class="stk-item">👥 المستفيدون</div>
    </div>
  </div>
`;
const TEMPLATE_8 = wrapSlide(el8_css, el8_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 9: Data Policies Summary (ملخص سياسات إدارة البيانات)
// ═══════════════════════════════════════════════════════════════
const el9_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .pol-title { font-size: 28px; font-weight: 800; margin-bottom: 24px; }
  .pol-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .pol-stat { border-radius: 12px; padding: 20px; text-align: center; }
  .ps1 { background: #dcfce7; border: 2px solid ${NDMO_COLORS.success}; }
  .ps2 { background: #dbeafe; border: 2px solid ${NDMO_COLORS.accent}; }
  .ps3 { background: #fef3c7; border: 2px solid ${NDMO_COLORS.warning}; }
  .ps4 { background: #f3f4f6; border: 2px solid #9ca3af; }
  .pol-stat-num { font-size: 36px; font-weight: 900; }
  .ps1 .pol-stat-num { color: ${NDMO_COLORS.success}; }
  .ps2 .pol-stat-num { color: ${NDMO_COLORS.accent}; }
  .ps3 .pol-stat-num { color: ${NDMO_COLORS.warning}; }
  .ps4 .pol-stat-num { color: #6b7280; }
  .pol-stat-label { font-size: 12px; color: ${NDMO_COLORS.grayDark}; margin-top: 4px; }
  .pol-compliance { background: linear-gradient(135deg, ${NDMO_COLORS.navy}, ${NDMO_COLORS.navyLight}); border-radius: 16px; padding: 24px 32px; color: white; display: flex; align-items: center; gap: 24px; }
  .pol-comp-val { font-size: 48px; font-weight: 900; color: ${NDMO_COLORS.gold}; }
  .pol-comp-label { font-size: 16px; font-weight: 600; }
  .pol-comp-sub { font-size: 12px; opacity: 0.5; margin-top: 4px; }
`;
const el9_html = `
  <h2 class="pol-title">ملخص سياسات إدارة البيانات الوطنية</h2>
  <div class="pol-stats">
    <div class="pol-stat ps1"><div class="pol-stat-num">12</div><div class="pol-stat-label">سياسة معتمدة ومفعّلة</div></div>
    <div class="pol-stat ps2"><div class="pol-stat-num">5</div><div class="pol-stat-label">قيد المراجعة والتحديث</div></div>
    <div class="pol-stat ps3"><div class="pol-stat-num">3</div><div class="pol-stat-label">قيد الإعداد (مسودة)</div></div>
    <div class="pol-stat ps4"><div class="pol-stat-num">20</div><div class="pol-stat-label">إجمالي السياسات</div></div>
  </div>
  <div class="pol-compliance">
    <div class="pol-comp-val">87%</div>
    <div><div class="pol-comp-label">متوسط الامتثال العام</div><div class="pol-comp-sub">ارتفاع بنسبة 9% عن الربع السابق</div></div>
  </div>
`;
const TEMPLATE_9 = wrapSlide(el9_css, el9_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 10: Impact-Effort Matrix (مصفوفة الأثر والجهد)
// ═══════════════════════════════════════════════════════════════
const el10_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .ie-title { font-size: 28px; font-weight: 800; margin-bottom: 24px; }
  .ie-matrix { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3px; height: 500px; border-radius: 16px; overflow: hidden; }
  .ie-q { padding: 20px; }
  .ie-q1 { background: linear-gradient(135deg, #dcfce7, #bbf7d0); }
  .ie-q2 { background: linear-gradient(135deg, #dbeafe, #bfdbfe); }
  .ie-q3 { background: linear-gradient(135deg, #fef3c7, #fde68a); }
  .ie-q4 { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); }
  .ie-q-label { font-size: 14px; font-weight: 800; margin-bottom: 4px; }
  .ie-q-desc { font-size: 10px; color: ${NDMO_COLORS.grayDark}; margin-bottom: 12px; }
  .ie-item { background: white; border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; font-size: 11px; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 6px; }
  .ie-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .ie-axes { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: ${NDMO_COLORS.grayDark}; font-weight: 600; }
`;
const el10_html = `
  <h2 class="ie-title">مصفوفة الأثر والجهد للمبادرات</h2>
  <div class="ie-matrix">
    <div class="ie-q ie-q1">
      <div class="ie-q-label">⭐ مكاسب سريعة</div>
      <div class="ie-q-desc">أثر عالٍ — جهد منخفض</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.success}"></div>توحيد معايير جودة البيانات</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.success}"></div>إطلاق بوابة البيانات المفتوحة</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.success}"></div>تفعيل لوحة مؤشرات الأداء</div>
    </div>
    <div class="ie-q ie-q2">
      <div class="ie-q-label">🚀 مشاريع استراتيجية</div>
      <div class="ie-q-desc">أثر عالٍ — جهد عالٍ</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.accent}"></div>بناء منصة البيانات الوطنية</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.accent}"></div>تطوير إطار حوكمة شامل</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.accent}"></div>برنامج بناء القدرات الوطنية</div>
    </div>
    <div class="ie-q ie-q4">
      <div class="ie-q-label">📋 مهام تشغيلية</div>
      <div class="ie-q-desc">أثر منخفض — جهد منخفض</div>
      <div class="ie-item"><div class="ie-dot" style="background:#9ca3af"></div>تحديث وثائق السياسات</div>
      <div class="ie-item"><div class="ie-dot" style="background:#9ca3af"></div>تقارير الامتثال الدورية</div>
    </div>
    <div class="ie-q ie-q3">
      <div class="ie-q-label">⏸️ مؤجلة / مستبعدة</div>
      <div class="ie-q-desc">أثر منخفض — جهد عالٍ</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.warning}"></div>إعادة هيكلة كاملة للأنظمة</div>
      <div class="ie-item"><div class="ie-dot" style="background:${NDMO_COLORS.warning}"></div>بناء مركز بيانات مستقل</div>
    </div>
  </div>
  <div class="ie-axes"><span>← جهد منخفض</span><span>جهد عالٍ →</span></div>
`;
const TEMPLATE_10 = wrapSlide(el10_css, el10_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 11: Opportunities & Enablers (فرص وممكنات)
// ═══════════════════════════════════════════════════════════════
const el11_css = `
  .slide { background: linear-gradient(180deg, ${NDMO_COLORS.navy} 0%, #0a1929 100%); color: white; padding: 50px 60px; }
  .opp-title { font-size: 28px; font-weight: 800; color: ${NDMO_COLORS.gold}; margin-bottom: 32px; }
  .opp-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .opp-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px; backdrop-filter: blur(8px); }
  .opp-card-icon { font-size: 32px; margin-bottom: 16px; }
  .opp-card-title { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
  .opp-card-desc { font-size: 13px; opacity: 0.6; line-height: 1.7; margin-bottom: 16px; }
  .opp-card-metric { display: flex; align-items: baseline; gap: 8px; }
  .opp-card-num { font-size: 32px; font-weight: 900; color: ${NDMO_COLORS.gold}; }
  .opp-card-unit { font-size: 13px; opacity: 0.5; }
`;
const el11_html = `
  <h2 class="opp-title">فرص وممكنات تطوير منظومة البيانات</h2>
  <div class="opp-cards">
    <div class="opp-card">
      <div class="opp-card-icon">⚡</div>
      <div class="opp-card-title">تعزيز الكفاءة التشغيلية</div>
      <div class="opp-card-desc">أتمتة عمليات جمع ومعالجة البيانات وتقليل الازدواجية بين الجهات الحكومية</div>
      <div class="opp-card-metric"><span class="opp-card-num">35%</span><span class="opp-card-unit">توفير متوقع في التكاليف</span></div>
    </div>
    <div class="opp-card">
      <div class="opp-card-icon">💡</div>
      <div class="opp-card-title">دعم الابتكار والمنتجات</div>
      <div class="opp-card-desc">تمكين القطاع الخاص من بناء منتجات وخدمات مبتكرة قائمة على البيانات المفتوحة</div>
      <div class="opp-card-metric"><span class="opp-card-num">+120</span><span class="opp-card-unit">منتج بيانات جديد متوقع</span></div>
    </div>
    <div class="opp-card">
      <div class="opp-card-icon">🎯</div>
      <div class="opp-card-title">دعم اتخاذ القرار</div>
      <div class="opp-card-desc">توفير بيانات موثوقة وآنية لصناع القرار لتحسين جودة السياسات العامة</div>
      <div class="opp-card-metric"><span class="opp-card-num">90%</span><span class="opp-card-unit">دقة التنبؤات المستهدفة</span></div>
    </div>
  </div>
`;
const TEMPLATE_11 = wrapSlide(el11_css, el11_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 12: Implementation Phases (مراحل التنفيذ)
// ═══════════════════════════════════════════════════════════════
const el12_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .impl-title { font-size: 28px; font-weight: 800; margin-bottom: 32px; }
  .phases { display: flex; gap: 24px; align-items: stretch; }
  .phase { flex: 1; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
  .phase-header { padding: 20px; color: white; text-align: center; }
  .ph1 .phase-header { background: linear-gradient(135deg, ${NDMO_COLORS.accent}, #3b82f6); }
  .ph2 .phase-header { background: linear-gradient(135deg, ${NDMO_COLORS.teal}, #14b8a6); }
  .ph3 .phase-header { background: linear-gradient(135deg, ${NDMO_COLORS.gold}, ${NDMO_COLORS.goldLight}); color: ${NDMO_COLORS.navy}; }
  .phase-num { font-size: 32px; font-weight: 900; }
  .phase-name { font-size: 14px; font-weight: 700; margin-top: 4px; }
  .phase-period { font-size: 11px; opacity: 0.7; margin-top: 2px; }
  .phase-body { background: ${NDMO_COLORS.gray}; padding: 20px; flex: 1; }
  .phase-task { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 12px; line-height: 1.5; }
  .phase-task:last-child { border-bottom: none; }
  .phase-check { color: ${NDMO_COLORS.success}; font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .arrow { display: flex; align-items: center; font-size: 24px; color: ${NDMO_COLORS.grayDark}; opacity: 0.3; }
`;
const el12_html = `
  <h2 class="impl-title">مراحل التنفيذ — منهجية العمل المتسلسلة</h2>
  <div class="phases">
    <div class="phase ph1">
      <div class="phase-header">
        <div class="phase-num">01</div>
        <div class="phase-name">التقييم والتحليل</div>
        <div class="phase-period">الأشهر 1-3</div>
      </div>
      <div class="phase-body">
        <div class="phase-task"><span class="phase-check">✓</span>تحليل الوضع الراهن لمنظومة البيانات</div>
        <div class="phase-task"><span class="phase-check">✓</span>تقييم مستوى النضج للجهات</div>
        <div class="phase-task"><span class="phase-check">✓</span>تحديد الفجوات والتحديات</div>
        <div class="phase-task"><span class="phase-check">✓</span>مسح أصحاب المصلحة</div>
      </div>
    </div>
    <div class="arrow">→</div>
    <div class="phase ph2">
      <div class="phase-header">
        <div class="phase-num">02</div>
        <div class="phase-name">التصميم والتخطيط</div>
        <div class="phase-period">الأشهر 4-6</div>
      </div>
      <div class="phase-body">
        <div class="phase-task"><span class="phase-check">✓</span>تصميم إطار الحوكمة</div>
        <div class="phase-task"><span class="phase-check">✓</span>وضع السياسات والمعايير</div>
        <div class="phase-task"><span class="phase-check">✓</span>تحديد المبادرات والأولويات</div>
        <div class="phase-task"><span class="phase-check">✓</span>إعداد خارطة الطريق</div>
      </div>
    </div>
    <div class="arrow">→</div>
    <div class="phase ph3">
      <div class="phase-header">
        <div class="phase-num">03</div>
        <div class="phase-name">التنفيذ والتطبيق</div>
        <div class="phase-period">الأشهر 7-12</div>
      </div>
      <div class="phase-body">
        <div class="phase-task"><span class="phase-check">✓</span>تنفيذ المبادرات ذات الأولوية</div>
        <div class="phase-task"><span class="phase-check">✓</span>بناء القدرات والتدريب</div>
        <div class="phase-task"><span class="phase-check">✓</span>إطلاق المنصات التقنية</div>
        <div class="phase-task"><span class="phase-check">✓</span>قياس الأثر والتحسين المستمر</div>
      </div>
    </div>
  </div>
`;
const TEMPLATE_12 = wrapSlide(el12_css, el12_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 13: KPI Overview Cards (بطاقة مؤشرات الأداء الرئيسية)
// ═══════════════════════════════════════════════════════════════
const el13_css = `
  .slide { background: ${NDMO_COLORS.gray}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .kpi2-title { font-size: 28px; font-weight: 800; margin-bottom: 24px; }
  .kpi2-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .kpi2-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .kpi2-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .kpi2-badge { font-size: 10px; padding: 4px 10px; border-radius: 20px; font-weight: 700; }
  .kpi2-up { background: #dcfce7; color: ${NDMO_COLORS.success}; }
  .kpi2-down { background: #fee2e2; color: ${NDMO_COLORS.danger}; }
  .kpi2-value { font-size: 40px; font-weight: 900; margin-bottom: 4px; }
  .kpi2-label { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
  .kpi2-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
  .kpi2-bar-fill { height: 100%; border-radius: 3px; }
  .kpi2-meta { display: flex; justify-content: space-between; font-size: 11px; color: ${NDMO_COLORS.grayDark}; }
`;
const el13_html = `
  <h2 class="kpi2-title">نظرة عامة على مؤشرات الأداء</h2>
  <div class="kpi2-grid">
    <div class="kpi2-card">
      <div class="kpi2-header"><span style="font-size:24px">📊</span><span class="kpi2-badge kpi2-up">↑ 12%</span></div>
      <div class="kpi2-value" style="color:${NDMO_COLORS.accent}">87%</div>
      <div class="kpi2-label">نسبة الانتقال العام</div>
      <div class="kpi2-bar"><div class="kpi2-bar-fill" style="width:87%;background:${NDMO_COLORS.accent}"></div></div>
      <div class="kpi2-meta"><span>المستهدف: 90%</span><span>الفجوة: 3%</span></div>
    </div>
    <div class="kpi2-card">
      <div class="kpi2-header"><span style="font-size:24px">🏛️</span><span class="kpi2-badge kpi2-up">↑ 15%</span></div>
      <div class="kpi2-value" style="color:${NDMO_COLORS.success}">94%</div>
      <div class="kpi2-label">نسبة الامتثال للسياسات</div>
      <div class="kpi2-bar"><div class="kpi2-bar-fill" style="width:94%;background:${NDMO_COLORS.success}"></div></div>
      <div class="kpi2-meta"><span>المستهدف: 95%</span><span>الفجوة: 1%</span></div>
    </div>
    <div class="kpi2-card">
      <div class="kpi2-header"><span style="font-size:24px">⚡</span><span class="kpi2-badge kpi2-down">↓ 5%</span></div>
      <div class="kpi2-value" style="color:${NDMO_COLORS.warning}">72%</div>
      <div class="kpi2-label">جاهزية البنية التحتية</div>
      <div class="kpi2-bar"><div class="kpi2-bar-fill" style="width:72%;background:${NDMO_COLORS.warning}"></div></div>
      <div class="kpi2-meta"><span>المستهدف: 85%</span><span>الفجوة: 13%</span></div>
    </div>
  </div>
`;
const TEMPLATE_13 = wrapSlide(el13_css, el13_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 14: Operational KPI Cards (بطاقات مؤشرات الأداء التشغيلية)
// ═══════════════════════════════════════════════════════════════
const el14_css = `
  .slide { background: linear-gradient(135deg, ${NDMO_COLORS.navy} 0%, #0a1929 100%); color: white; padding: 50px 60px; }
  .op-title { font-size: 28px; font-weight: 800; color: ${NDMO_COLORS.gold}; margin-bottom: 32px; }
  .op-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .op-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; text-align: center; backdrop-filter: blur(8px); }
  .op-icon { font-size: 28px; margin-bottom: 12px; }
  .op-value { font-size: 32px; font-weight: 900; margin-bottom: 4px; }
  .op-label { font-size: 12px; opacity: 0.6; margin-bottom: 12px; }
  .op-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .op-good { background: rgba(16,185,129,0.2); color: #6ee7b7; }
  .op-warn { background: rgba(245,158,11,0.2); color: #fcd34d; }
  .op-bad { background: rgba(239,68,68,0.2); color: #fca5a5; }
`;
const el14_html = `
  <h2 class="op-title">مؤشرات الأداء التشغيلية — الرصد اللحظي</h2>
  <div class="op-grid">
    <div class="op-card">
      <div class="op-icon">🖥️</div>
      <div class="op-value" style="color:${NDMO_COLORS.success}">99.7%</div>
      <div class="op-label">جاهزية الأنظمة</div>
      <div class="op-status op-good">● طبيعي</div>
    </div>
    <div class="op-card">
      <div class="op-icon">📡</div>
      <div class="op-value" style="color:${NDMO_COLORS.gold}">2.4M</div>
      <div class="op-label">تدفق البيانات / يوم</div>
      <div class="op-status op-good">● نشط</div>
    </div>
    <div class="op-card">
      <div class="op-icon">🔔</div>
      <div class="op-value" style="color:${NDMO_COLORS.warning}">7</div>
      <div class="op-label">تنبيهات نشطة</div>
      <div class="op-status op-warn">● يحتاج مراجعة</div>
    </div>
    <div class="op-card">
      <div class="op-icon">⏱️</div>
      <div class="op-value" style="color:${NDMO_COLORS.accent}">1.2s</div>
      <div class="op-label">زمن الاستجابة</div>
      <div class="op-status op-good">● ممتاز</div>
    </div>
  </div>
`;
const TEMPLATE_14 = wrapSlide(el14_css, el14_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 15: Digital Transformation Results (إنفوجرافيك النتائج الرئيسية)
// ═══════════════════════════════════════════════════════════════
const el15_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .dt-title { font-size: 28px; font-weight: 800; margin-bottom: 32px; }
  .dt-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .dt-card { border-radius: 16px; padding: 32px; text-align: center; position: relative; overflow: hidden; }
  .dt-c1 { background: linear-gradient(135deg, #dcfce7, #bbf7d0); }
  .dt-c2 { background: linear-gradient(135deg, #dbeafe, #bfdbfe); }
  .dt-c3 { background: linear-gradient(135deg, #fef3c7, #fde68a); }
  .dt-icon { font-size: 40px; margin-bottom: 16px; }
  .dt-value { font-size: 48px; font-weight: 900; margin-bottom: 4px; }
  .dt-c1 .dt-value { color: ${NDMO_COLORS.success}; }
  .dt-c2 .dt-value { color: ${NDMO_COLORS.accent}; }
  .dt-c3 .dt-value { color: ${NDMO_COLORS.warning}; }
  .dt-change { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .dt-label { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .dt-desc { font-size: 12px; color: ${NDMO_COLORS.grayDark}; line-height: 1.6; }
`;
const el15_html = `
  <h2 class="dt-title">النتائج الرئيسية للتحول الرقمي في البيانات</h2>
  <div class="dt-cards">
    <div class="dt-card dt-c1">
      <div class="dt-icon">💰</div>
      <div class="dt-value">2.8B</div>
      <div class="dt-change" style="color:${NDMO_COLORS.success}">↑ 42% عن العام السابق</div>
      <div class="dt-label">الوفورات المالية (ريال)</div>
      <div class="dt-desc">من خلال أتمتة العمليات وتقليل الازدواجية في جمع البيانات</div>
    </div>
    <div class="dt-card dt-c2">
      <div class="dt-icon">⚡</div>
      <div class="dt-value">67%</div>
      <div class="dt-change" style="color:${NDMO_COLORS.accent}">↑ 23% تحسن</div>
      <div class="dt-label">سرعة الإنجاز</div>
      <div class="dt-desc">تسريع عمليات اتخاذ القرار المبني على البيانات في الجهات الحكومية</div>
    </div>
    <div class="dt-card dt-c3">
      <div class="dt-icon">🛡️</div>
      <div class="dt-value">99.2%</div>
      <div class="dt-change" style="color:${NDMO_COLORS.warning}">↑ 8% تحسن</div>
      <div class="dt-label">حماية البيانات</div>
      <div class="dt-desc">نسبة الامتثال لمعايير حماية البيانات الشخصية وفق نظام حماية البيانات</div>
    </div>
  </div>
`;
const TEMPLATE_15 = wrapSlide(el15_css, el15_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 16: Contact & Closing (شريحة معلومات التواصل والختام)
// ═══════════════════════════════════════════════════════════════
const el16_css = `
  .slide { background: linear-gradient(135deg, ${NDMO_COLORS.navy} 0%, #0a1929 100%); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .close-title { font-size: 36px; font-weight: 900; margin-bottom: 8px; }
  .close-sub { font-size: 18px; opacity: 0.5; margin-bottom: 48px; }
  .close-contacts { display: flex; gap: 40px; margin-bottom: 48px; }
  .close-contact { display: flex; align-items: center; gap: 12px; }
  .close-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(212,175,55,0.15); display: flex; align-items: center; justify-content: center; font-size: 20px; }
  .close-info { text-align: right; }
  .close-info-label { font-size: 11px; opacity: 0.4; }
  .close-info-value { font-size: 14px; font-weight: 600; }
  .close-logo { width: 64px; height: 64px; border-radius: 16px; background: ${NDMO_COLORS.gold}; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: ${NDMO_COLORS.navy}; margin-bottom: 16px; }
  .close-org { font-size: 14px; opacity: 0.4; }
  .bottom-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, ${NDMO_COLORS.gold}, ${NDMO_COLORS.accent}, ${NDMO_COLORS.gold}); }
`;
const el16_html = `
  <div class="close-logo">ه.و.ب</div>
  <h2 class="close-title">شكراً لكم</h2>
  <p class="close-sub">للتنسيق والمتابعة</p>
  <div class="close-contacts">
    <div class="close-contact">
      <div class="close-icon">📧</div>
      <div class="close-info"><div class="close-info-label">البريد الإلكتروني</div><div class="close-info-value">info@ndmo.gov.sa</div></div>
    </div>
    <div class="close-contact">
      <div class="close-icon">🌐</div>
      <div class="close-info"><div class="close-info-label">الموقع الإلكتروني</div><div class="close-info-value">www.ndmo.gov.sa</div></div>
    </div>
    <div class="close-contact">
      <div class="close-icon">📞</div>
      <div class="close-info"><div class="close-info-label">الهاتف الموحد</div><div class="close-info-value">920000123</div></div>
    </div>
  </div>
  <div class="close-org">الهيئة الوطنية للبيانات والذكاء الاصطناعي</div>
  <div class="bottom-bar"></div>
`;
const TEMPLATE_16 = wrapSlide(el16_css, el16_html);

// ═══════════════════════════════════════════════════════════════
// ELEMENT 30001: KPI Cards with Target & Gap (بطاقات مؤشرات مع تفاصيل المستهدف والفجوة)
// ═══════════════════════════════════════════════════════════════
const el30001_css = `
  .slide { background: ${NDMO_COLORS.white}; color: ${NDMO_COLORS.navy}; padding: 50px 60px; }
  .kg-title { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
  .kg-sub { font-size: 14px; color: ${NDMO_COLORS.grayDark}; margin-bottom: 24px; }
  .kg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .kg-card { border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .kg-card-header { padding: 20px 24px; color: white; }
  .kgh1 { background: linear-gradient(135deg, ${NDMO_COLORS.accent}, #3b82f6); }
  .kgh2 { background: linear-gradient(135deg, ${NDMO_COLORS.success}, #34d399); }
  .kgh3 { background: linear-gradient(135deg, ${NDMO_COLORS.warning}, #fbbf24); }
  .kg-card-value { font-size: 36px; font-weight: 900; }
  .kg-card-name { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .kg-card-body { background: white; padding: 20px 24px; }
  .kg-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .kg-row:last-child { border-bottom: none; }
  .kg-row-label { color: ${NDMO_COLORS.grayDark}; }
  .kg-row-val { font-weight: 700; }
  .kg-gap { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; }
  .kg-gap-pos { background: #dcfce7; color: ${NDMO_COLORS.success}; }
  .kg-gap-neg { background: #fee2e2; color: ${NDMO_COLORS.danger}; }
`;
const el30001_html = `
  <h2 class="kg-title">مؤشرات الأداء الرئيسية — التفاصيل</h2>
  <p class="kg-sub">مقارنة الأداء الفعلي بالمستهدفات المعتمدة</p>
  <div class="kg-grid">
    <div class="kg-card">
      <div class="kg-card-header kgh1"><div class="kg-card-value">87%</div><div class="kg-card-name">نسبة الانتقال العام</div></div>
      <div class="kg-card-body">
        <div class="kg-row"><span class="kg-row-label">المستهدف</span><span class="kg-row-val">90%</span></div>
        <div class="kg-row"><span class="kg-row-label">الربع السابق</span><span class="kg-row-val">75%</span></div>
        <div class="kg-row"><span class="kg-row-label">التغير</span><span class="kg-row-val" style="color:${NDMO_COLORS.success}">+12%</span></div>
        <div class="kg-gap kg-gap-neg">⚠️ الفجوة: 3% عن المستهدف</div>
      </div>
    </div>
    <div class="kg-card">
      <div class="kg-card-header kgh2"><div class="kg-card-value">94%</div><div class="kg-card-name">نسبة الامتثال</div></div>
      <div class="kg-card-body">
        <div class="kg-row"><span class="kg-row-label">المستهدف</span><span class="kg-row-val">95%</span></div>
        <div class="kg-row"><span class="kg-row-label">الربع السابق</span><span class="kg-row-val">87%</span></div>
        <div class="kg-row"><span class="kg-row-label">التغير</span><span class="kg-row-val" style="color:${NDMO_COLORS.success}">+7%</span></div>
        <div class="kg-gap kg-gap-neg">⚠️ الفجوة: 1% عن المستهدف</div>
      </div>
    </div>
    <div class="kg-card">
      <div class="kg-card-header kgh3"><div class="kg-card-value">3.8</div><div class="kg-card-name">مستوى النضج (من 5)</div></div>
      <div class="kg-card-body">
        <div class="kg-row"><span class="kg-row-label">المستهدف</span><span class="kg-row-val">4.2</span></div>
        <div class="kg-row"><span class="kg-row-label">الربع السابق</span><span class="kg-row-val">3.5</span></div>
        <div class="kg-row"><span class="kg-row-label">التغير</span><span class="kg-row-val" style="color:${NDMO_COLORS.success}">+0.3</span></div>
        <div class="kg-gap kg-gap-neg">⚠️ الفجوة: 0.4 عن المستهدف</div>
      </div>
    </div>
  </div>
`;
const TEMPLATE_30001 = wrapSlide(el30001_css, el30001_html);

// ═══════════════════════════════════════════════════════════════
// UPDATE DATABASE
// ═══════════════════════════════════════════════════════════════
const TEMPLATES = {
  1: TEMPLATE_1,
  2: TEMPLATE_2,
  3: TEMPLATE_3,
  4: TEMPLATE_4,
  5: TEMPLATE_5,
  6: TEMPLATE_6,
  7: TEMPLATE_7,
  8: TEMPLATE_8,
  9: TEMPLATE_9,
  10: TEMPLATE_10,
  11: TEMPLATE_11,
  12: TEMPLATE_12,
  13: TEMPLATE_13,
  14: TEMPLATE_14,
  15: TEMPLATE_15,
  16: TEMPLATE_16,
  30001: TEMPLATE_30001,
};

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  for (const [id, html] of Object.entries(TEMPLATES)) {
    await conn.query('UPDATE slide_elements SET htmlTemplate = ? WHERE id = ?', [html, parseInt(id)]);
    console.log(`✓ Updated element ${id} with HTML template (${html.length} chars)`);
  }
  
  console.log(`\n✅ All ${Object.keys(TEMPLATES).length} elements updated with full HTML templates!`);
  await conn.end();
}

main().catch(console.error);
