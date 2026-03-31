// ═══════════════════════════════════════════════════════════════
// Rasid — Ultra Premium NDMO Slide Engine
// McKinsey × Gamma.app quality — each slide is a masterpiece
// Mandatory backgrounds: Picture1.jpg (cover/closing), NDMO_2024.png (toc/section)
// Brand: NDMO Official Identity — DIN Next / Tajawal
// ═══════════════════════════════════════════════════════════════

export interface SlideTheme {
  id: string;
  name: string;
  nameEn: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  textLight: string;
  fontHeading: string;
  fontBody: string;
  gradientStart: string;
  gradientEnd: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  surfaceGlow: string;
}

export const THEMES: Record<string, SlideTheme> = {
  ndmo: {
    id: 'ndmo', name: 'مكتب إدارة البيانات الوطنية', nameEn: 'NDMO',
    primary: '#1B2A4A', secondary: '#00B388', accent: '#2B5EA7',
    background: '#FFFFFF', cardBg: '#FFFFFF',
    textPrimary: '#1B2A4A', textSecondary: '#5A6B7F', textLight: '#FFFFFF',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#1B2A4A', gradientEnd: '#243656',
    borderColor: '#E2E8F0', successColor: '#00B388', warningColor: '#E8A838', dangerColor: '#E0301E',
    surfaceGlow: 'rgba(27,42,74,0.06)',
  },
  sdaia: {
    id: 'sdaia', name: 'سدايا', nameEn: 'SDAIA',
    primary: '#273470', secondary: '#23AC7C', accent: '#2B5EA7',
    background: '#FFFFFF', cardBg: '#FFFFFF',
    textPrimary: '#273470', textSecondary: '#5A6B7F', textLight: '#FFFFFF',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#273470', gradientEnd: '#394375',
    borderColor: '#DDE3F0', successColor: '#23AC7C', warningColor: '#E8A838', dangerColor: '#E0301E',
    surfaceGlow: 'rgba(39,52,112,0.06)',
  },
};

export interface SlideData {
  title: string;
  subtitle?: string;
  content?: string;
  bulletPoints?: string[];
  notes?: string;
  layout: 'title' | 'toc' | 'executive-summary' | 'pillars' | 'chart' | 'table' | 'infographic' | 'kpi' | 'timeline' | 'closing' | 'content' | 'two-column' | 'quote' | 'section-title';
  chartType?: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'radar';
  chartData?: number[];
  chartLabels?: string[];
  chartColors?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  infographicItems?: Array<{ icon: string; label: string; value: string; description?: string }>;
  timelineItems?: Array<{ year: string; title: string; description: string }>;
  kpiItems?: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'flat'; change?: string }>;
  pillarItems?: Array<{ icon: string; title: string; description: string }>;
  style?: { backgroundColor?: string; titleColor?: string; textColor?: string };
  backgroundImage?: string;
  imageSource?: string;
}

// ─── NDMO Asset Paths (public folder) ───
const ASSETS = {
  coverBg: '/ndmo-assets/Picture1.jpg',
  tocBg: '/ndmo-assets/NDMO_2024.png',
  ndmoLogo: '/ndmo-assets/ndmo_logo.png',
  sdaiaLogo: '/ndmo-assets/sdaia_logo.png',
};

// ─── Shared CSS Foundation ───
function baseCSS(theme: SlideTheme): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(25px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lineGrow { from { width: 0; } to { width: 64px; } }
    .slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      font-family: ${theme.fontBody}; color: ${theme.textPrimary};
      background: ${theme.background}; display: flex; flex-direction: column;
      direction: rtl; text-align: right;
    }
    .slide-bg-image {
      position: absolute; inset: 0; background-size: cover; background-position: center;
      z-index: 0; opacity: 0.12;
    }
    h1, h2, h3, h4 { font-family: ${theme.fontHeading}; line-height: 1.3; }
    .material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-size: 24px; direction: ltr; }

    /* ─── Top Accent Bar (NDMO signature) ─── */
    .top-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(to left, ${theme.secondary}, ${theme.accent}, ${theme.warningColor});
      z-index: 100;
    }

    /* ─── Header Bar (NDMO dark) ─── */
    .header-bar {
      width: 100%; height: 64px; flex-shrink: 0;
      background: linear-gradient(to left, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 48px; color: white; position: relative; direction: rtl;
    }
    .header-bar::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(to left, ${theme.secondary}40, transparent, ${theme.warningColor}40);
    }
    .header-title { font-size: 24px; font-weight: 800; letter-spacing: -0.3px; text-align: right; animation: fadeInRight 0.5s ease 0.2s both; }
    .header-subtitle { font-size: 13px; opacity: 0.7; margin-top: 2px; text-align: right; animation: fadeInRight 0.5s ease 0.3s both; }
    .header-badge {
      min-width: 40px; height: 40px; padding: 0 12px;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 15px; color: ${theme.warningColor};
    }

    /* ─── Body ─── */
    .slide-body { flex: 1; padding: 32px 48px; display: flex; flex-direction: column; gap: 20px; overflow: hidden; text-align: right; direction: rtl; animation: fadeInUp 0.6s ease 0.3s both; }

    /* ─── Footer (NDMO official) ─── */
    .slide-footer {
      height: 44px; padding: 0 48px; display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid ${theme.borderColor}; background: white; flex-shrink: 0; direction: rtl;
    }
    .footer-logos { display: flex; align-items: center; gap: 14px; }
    .footer-logos img { height: 28px; object-fit: contain; }
    .footer-sep { width: 1px; height: 22px; background: #ccc; }
    .footer-page { font-size: 13px; font-weight: 700; color: ${theme.primary}; opacity: 0.4; }

    /* ─── Cards (Premium) ─── */
    .card {
      background: white; border: 1px solid #E2E8F0;
      border-radius: 16px; padding: 24px; position: relative; overflow: hidden;
      box-shadow: 0 2px 8px rgba(27,42,74,0.06);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .card:hover { box-shadow: 0 8px 32px ${theme.surfaceGlow}; transform: translateY(-2px); }
    .card { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary});
    }

    /* ─── KPI Cards (Ultra Premium) ─── */
    .kpi-grid { display: grid; gap: 20px; flex: 1; align-content: center; }
    .kpi-card {
      background: white; border: 1px solid #E2E8F0;
      border-radius: 16px; padding: 28px 24px; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 2px 10px rgba(27,42,74,0.06);
    }
    .kpi-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary});
    }
    .kpi-card { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }
    .kpi-card:nth-child(2) { animation-delay: 0.5s; }
    .kpi-card:nth-child(3) { animation-delay: 0.6s; }
    .kpi-card:nth-child(4) { animation-delay: 0.7s; }
    .kpi-card:nth-child(5) { animation-delay: 0.8s; }
    .kpi-card:nth-child(6) { animation-delay: 0.9s; }
    .kpi-card::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 80px;
      background: linear-gradient(180deg, rgba(27,42,74,0.03), transparent);
    }
    .kpi-icon {
      width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 12px; font-size: 22px;
      background: linear-gradient(135deg, ${theme.primary}10, ${theme.secondary}10);
      color: ${theme.primary}; position: relative; z-index: 1;
    }
    .kpi-value {
      font-size: 36px; font-weight: 900; color: ${theme.primary};
      position: relative; z-index: 1; letter-spacing: -1px;
      background: linear-gradient(135deg, ${theme.primary}, ${theme.accent});
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .kpi-label { font-size: 13px; color: ${theme.textSecondary}; margin-top: 8px; font-weight: 600; position: relative; z-index: 1; }
    .kpi-trend {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700; margin-top: 8px;
      padding: 3px 10px; border-radius: 20px; position: relative; z-index: 1;
    }
    .kpi-trend.up { color: ${theme.successColor}; background: ${theme.successColor}12; }
    .kpi-trend.down { color: ${theme.dangerColor}; background: ${theme.dangerColor}12; }
    .kpi-trend.flat { color: ${theme.textSecondary}; background: ${theme.textSecondary}12; }

    /* ─── Bullet List (Premium) ─── */
    .bullet-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .bullet-list li {
      padding: 14px 22px; padding-right: 40px; position: relative; font-size: 14px; line-height: 1.8;
      background: #FAFBFC; border-radius: 12px; border: 1px solid #E2E8F0;
      box-shadow: 0 1px 4px rgba(27,42,74,0.04); text-align: right; direction: rtl;
    }
    .bullet-list li { animation: fadeInRight 0.4s ease both; }
    .bullet-list li:nth-child(1) { animation-delay: 0.3s; }
    .bullet-list li:nth-child(2) { animation-delay: 0.4s; }
    .bullet-list li:nth-child(3) { animation-delay: 0.5s; }
    .bullet-list li:nth-child(4) { animation-delay: 0.6s; }
    .bullet-list li:nth-child(5) { animation-delay: 0.7s; }
    .bullet-list li:nth-child(6) { animation-delay: 0.8s; }
    .bullet-list li::before {
      content: ''; position: absolute; right: 18px; top: 20px;
      width: 10px; height: 10px; border-radius: 50%;
      background: linear-gradient(135deg, ${theme.secondary}, ${theme.accent});
      box-shadow: 0 2px 6px ${theme.secondary}40;
    }

    /* ─── Table (Premium) ─── */
    .table-wrap {
      flex: 1; overflow: hidden; border-radius: 14px;
      border: 1px solid #E2E8F0; box-shadow: 0 2px 10px rgba(27,42,74,0.06);
      animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { background: linear-gradient(135deg, ${theme.primary}, ${theme.gradientEnd}); }
    th {
      color: white; padding: 14px 18px; text-align: right; font-weight: 700; font-size: 12px;
      letter-spacing: 0.3px; border-bottom: 2px solid ${theme.secondary};
    }
    td {
      padding: 12px 18px; border-bottom: 1px solid ${theme.borderColor};
      text-align: right; font-size: 12px; color: ${theme.textPrimary};
    }
    tr:nth-child(even) td { background: #F8FAFC; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: ${theme.secondary}08; }

    /* ─── Chart (CSS bars — Ultra Premium) ─── */
    .chart-area { flex: 1; display: flex; align-items: flex-end; gap: 12px; padding: 20px 0 0; position: relative; }
    .chart-area::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: ${theme.borderColor};
    }
    .chart-bar-col {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0;
      position: relative; z-index: 1;
    }
    .chart-bar {
      width: 100%; max-width: 64px; border-radius: 10px 10px 0 0; position: relative;
      display: flex; align-items: flex-start; justify-content: center; padding-top: 10px;
      transition: all 0.3s; cursor: default;
    }
    .chart-bar:hover { filter: brightness(1.08); transform: scaleY(1.02); transform-origin: bottom; }
    .chart-bar-val {
      font-size: 12px; font-weight: 800; color: white;
      text-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .chart-bar-lbl {
      font-size: 11px; color: ${theme.textSecondary}; margin-top: 10px;
      text-align: center; font-weight: 600; max-width: 80px;
    }

    /* ─── Infographic Grid ─── */
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
    .info-card {
      background: white; border: 1px solid #E2E8F0;
      border-radius: 16px; padding: 24px; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 2px 10px rgba(27,42,74,0.06);
    }
    .info-card { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .info-card:nth-child(1) { animation-delay: 0.3s; }
    .info-card:nth-child(2) { animation-delay: 0.4s; }
    .info-card:nth-child(3) { animation-delay: 0.5s; }
    .info-card:nth-child(4) { animation-delay: 0.6s; }
    .info-card:nth-child(5) { animation-delay: 0.7s; }
    .info-card:nth-child(6) { animation-delay: 0.8s; }
    .info-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.accent}, ${theme.secondary});
    }
    .info-icon {
      width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 14px; font-size: 26px;
      background: linear-gradient(135deg, ${theme.primary}0D, ${theme.secondary}0D);
      color: ${theme.primary};
    }
    .info-value { font-size: 28px; font-weight: 900; color: ${theme.primary}; letter-spacing: -0.5px; }
    .info-label { font-size: 12px; color: ${theme.textSecondary}; margin-top: 6px; font-weight: 600; text-align: center; }
    .info-desc { font-size: 11px; color: ${theme.textSecondary}; margin-top: 6px; opacity: 0.8; line-height: 1.6; text-align: center; }

    /* ─── Timeline (Premium) ─── */
    .timeline { display: flex; flex-direction: column; gap: 0; position: relative; padding-right: 36px; }
    .timeline::before {
      content: ''; position: absolute; right: 12px; top: 0; bottom: 0;
      width: 3px; background: linear-gradient(180deg, ${theme.primary}, ${theme.secondary}, ${theme.warningColor});
      border-radius: 2px;
    }
    .tl-item { display: flex; gap: 20px; position: relative; padding-bottom: 20px; animation: fadeInRight 0.5s ease both; }
    .tl-item:nth-child(1) { animation-delay: 0.3s; }
    .tl-item:nth-child(2) { animation-delay: 0.5s; }
    .tl-item:nth-child(3) { animation-delay: 0.7s; }
    .tl-item:nth-child(4) { animation-delay: 0.9s; }
    .tl-dot {
      width: 22px; height: 22px; border-radius: 50%; background: ${theme.primary};
      border: 4px solid #F0F4F8; position: absolute; right: -36px; top: 4px;
      box-shadow: 0 0 0 4px ${theme.primary}20; z-index: 1;
    }
    .tl-content {
      flex: 1; background: white; border: 1px solid #E2E8F0;
      border-radius: 14px; padding: 16px 20px;
      box-shadow: 0 2px 8px rgba(27,42,74,0.05);
    }
    .tl-year { font-size: 13px; font-weight: 800; color: ${theme.secondary}; }
    .tl-title { font-size: 14px; font-weight: 700; color: ${theme.textPrimary}; margin-top: 4px; text-align: right; }
    .tl-desc { font-size: 12px; color: ${theme.textSecondary}; margin-top: 6px; line-height: 1.7; text-align: right; }

    /* ─── Pillar Cards (Premium) ─── */
    .pillar-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
    .pillar-card {
      background: white; border: 1px solid #E2E8F0;
      border-radius: 16px; padding: 24px; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 2px 10px rgba(27,42,74,0.06);
    }
    .pillar-card { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .pillar-card:nth-child(1) { animation-delay: 0.3s; }
    .pillar-card:nth-child(2) { animation-delay: 0.45s; }
    .pillar-card:nth-child(3) { animation-delay: 0.6s; }
    .pillar-card:nth-child(4) { animation-delay: 0.75s; }
    .pillar-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary});
    }
    .pillar-icon {
      width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 14px; font-size: 28px;
      background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd});
      color: white; box-shadow: 0 6px 20px ${theme.primary}30;
    }
    .pillar-title { font-size: 15px; font-weight: 800; color: ${theme.textPrimary}; text-align: center; }
    .pillar-desc { font-size: 12px; color: ${theme.textSecondary}; margin-top: 8px; line-height: 1.7; text-align: center; }

    /* ─── Content paragraph ─── */
    .content-text {
      font-size: 14px; line-height: 2; color: ${theme.textSecondary};
      max-width: 95%; text-align: right; direction: rtl;
    }

    /* ─── Two Column ─── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }

    /* ─── Accent Elements ─── */
    .accent-line {
      width: 64px; height: 5px; border-radius: 3px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor});
    }
  `;
}

// ─── Footer HTML ───
function footerHTML(num: number, total: number): string {
  return `
    <div class="slide-footer">
      <div class="footer-logos">
        <img src="${ASSETS.ndmoLogo}" alt="NDMO" onerror="this.style.display='none'">
        <div class="footer-sep"></div>
        <img src="${ASSETS.sdaiaLogo}" alt="SDAIA" onerror="this.style.display='none'">
      </div>
      <div class="footer-page">${num} / ${total}</div>
    </div>
  `;
}

// ─── Slide HTML wrapper ───
function slideWrap(theme: SlideTheme, num: number, total: number, inner: string, noFooter = false, bgImage?: string): string {
  const bgDiv = bgImage ? `<div class="slide-bg-image" style="background-image:url('${bgImage}')"></div>` : '';
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${baseCSS(theme)}</style></head><body><div class="slide"><div class="top-accent"></div>${bgDiv}<div style="position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:0;direction:rtl;text-align:right">${inner}</div>${noFooter ? '' : footerHTML(num, total)}</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// SLIDE TEMPLATES — Ultra Premium
// ═══════════════════════════════════════════════════════════════

// ─── 1. COVER (Mandatory: Picture1.jpg background) — TITLE ONLY, Ultra Premium ───
function coverSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    .cover {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${data.backgroundImage || ASSETS.coverBg}') center/cover no-repeat;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; color: white;
    }
    .cover::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(11,17,35,0.45) 0%, rgba(11,17,35,0.70) 50%, rgba(11,17,35,0.85) 100%);
    }
    .cover::after {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at center bottom, rgba(0,179,136,0.08) 0%, transparent 70%);
    }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lineGrow { from { width: 0; opacity: 0; } to { width: 120px; opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    @keyframes floatUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    .cover-content { position: relative; z-index: 2; max-width: 1000px; padding: 0 80px; }
    .cover-accent-top {
      width: 120px; height: 4px; border-radius: 2px; margin: 0 auto 48px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor}, ${theme.secondary});
      background-size: 200% auto;
      animation: lineGrow 1s ease 0.3s both, shimmer 3s linear 1.3s infinite;
    }
    .cover-title {
      font-size: 52px; font-weight: 900; line-height: 1.4; letter-spacing: -0.5px;
      text-shadow: 0 4px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
      animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
    }
    .cover-accent-bottom {
      width: 120px; height: 4px; border-radius: 2px; margin: 48px auto 0;
      background: linear-gradient(90deg, ${theme.warningColor}, ${theme.secondary}, ${theme.warningColor});
      background-size: 200% auto;
      animation: lineGrow 1s ease 1s both, shimmer 3s linear 2s infinite;
    }
    .cover-org {
      font-size: 15px; font-weight: 600; opacity: 0.7; margin-top: 40px;
      letter-spacing: 2px;
      animation: fadeIn 1s ease 1.3s both;
    }
    .cover-date {
      font-size: 13px; opacity: 0.45; margin-top: 12px;
      animation: fadeIn 1s ease 1.5s both;
    }
    .cover-logos {
      position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 20px; z-index: 2;
      animation: fadeIn 1.2s ease 1.6s both, floatUp 4s ease-in-out 2.8s infinite;
    }
    .cover-logos img { height: 40px; object-fit: contain; filter: brightness(10); }
    .cover-logo-sep { width: 1px; height: 32px; background: rgba(255,255,255,0.25); }
    .top-accent-cover {
      position: absolute; top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(to left, ${theme.secondary}, ${theme.accent}, ${theme.warningColor});
      z-index: 100;
    }
    .bottom-accent-cover {
      position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(to right, ${theme.secondary}60, transparent, ${theme.warningColor}60);
      z-index: 100;
    }
  </style></head><body>
    <div class="cover">
      <div class="top-accent-cover"></div>
      <div class="bottom-accent-cover"></div>
      <div class="cover-content">
        <div class="cover-accent-top"></div>
        <h1 class="cover-title">${data.title}</h1>
        <div class="cover-accent-bottom"></div>
        <div class="cover-org">مكتب إدارة البيانات الوطنية</div>
        <div class="cover-date">${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}</div>
      </div>
      <div class="cover-logos">
        <img src="${ASSETS.ndmoLogo}" alt="NDMO" onerror="this.style.display='none'">
        <div class="cover-logo-sep"></div>
        <img src="${ASSETS.sdaiaLogo}" alt="SDAIA" onerror="this.style.display='none'">
      </div>
    </div>
  </body></html>`;
}

// ─── 2. TOC (Mandatory: NDMO_2024.png background) — Title on RIGHT (dark side) ───
function tocSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.bulletPoints || []).map((bp, i) => `
    <div class="toc-item" style="animation: tocItemIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.08}s both;">
      <div class="toc-item-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="toc-item-text">${bp}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(25px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes tocItemIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes lineGrow { from { width: 0; } to { width: 64px; } }
    .toc-slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${ASSETS.tocBg}') center/cover no-repeat;
      display: flex; flex-direction: row;
    }
    .top-accent { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(to left, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}); z-index: 100; }
    .toc-right {
      width: 400px; background: linear-gradient(180deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      padding: 60px 40px; position: relative; overflow: hidden; text-align: center;
    }
    .toc-right-watermark {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 200px; font-weight: 900; color: rgba(255,255,255,0.03); line-height: 1;
    }
    .toc-right-title {
      font-size: 30px; font-weight: 900; color: white; line-height: 1.5;
      position: relative; z-index: 2; animation: fadeInUp 0.6s ease 0.2s both;
    }
    .toc-right-subtitle {
      font-size: 14px; color: rgba(255,255,255,0.65); margin-top: 12px;
      position: relative; z-index: 2; animation: fadeInUp 0.6s ease 0.4s both;
    }
    .toc-right-accent {
      width: 64px; height: 5px; border-radius: 3px; margin-top: 18px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor});
      animation: lineGrow 0.8s ease 0.6s both;
    }
    .toc-left {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 28px 40px; position: relative; z-index: 2;
    }
    .toc-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
    }
    .toc-item {
      display: flex; flex-direction: row-reverse; align-items: stretch; background: white; border-radius: 12px;
      overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid ${theme.borderColor};
      transition: all 0.3s; cursor: default;
    }
    .toc-item:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .toc-item-num {
      width: 48px; background: ${theme.primary}; display: flex; align-items: center;
      justify-content: center; color: white; font-size: 18px; font-weight: 900; flex-shrink: 0;
    }
    .toc-item:first-child .toc-item-num { background: ${theme.secondary}; }
    .toc-item-text {
      flex: 1; padding: 12px 16px; display: flex; align-items: center;
      font-size: 13px; font-weight: 700; color: ${theme.textPrimary}; line-height: 1.5; text-align: right; direction: rtl;
    }
    .toc-footer {
      position: absolute; bottom: 0; left: 0; right: 0; height: 44px; padding: 0 48px;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid ${theme.borderColor}; background: rgba(255,255,255,0.95); z-index: 2; direction: rtl;
    }
    .footer-logos { display: flex; align-items: center; gap: 14px; }
    .footer-logos img { height: 28px; object-fit: contain; }
    .footer-sep { width: 1px; height: 22px; background: #ccc; }
    .footer-page { font-size: 13px; font-weight: 700; color: ${theme.primary}; opacity: 0.4; }
  </style></head><body>
    <div class="toc-slide">
      <div class="top-accent"></div>
      <div class="toc-right">
        <div class="toc-right-watermark">فهرس</div>
        <div class="toc-right-title">${data.title || 'فهرس المحتويات'}</div>
        ${data.subtitle ? `<div class="toc-right-subtitle">${data.subtitle}</div>` : ''}
        <div class="toc-right-accent"></div>
      </div>
      <div class="toc-left">
        <div class="toc-grid">${items}</div>
      </div>
      <div class="toc-footer">
        <div class="footer-logos">
          <img src="${ASSETS.ndmoLogo}" alt="NDMO" onerror="this.style.display='none'">
          <div class="footer-sep"></div>
          <img src="${ASSETS.sdaiaLogo}" alt="SDAIA" onerror="this.style.display='none'">
        </div>
        <div class="footer-page">${num} / ${total}</div>
      </div>
    </div>
  </body></html>`;
}

// ─── 3. SECTION TITLE (Mandatory: NDMO_2024.png background) — Text on RIGHT (dark side) ───
function sectionTitleSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    @keyframes fadeInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
    @keyframes lineGrow { from { width: 0; } to { width: 64px; } }
    @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,168,56,0.4); } 50% { box-shadow: 0 0 20px 8px rgba(232,168,56,0.15); } }
    .section-slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${ASSETS.tocBg}') center/cover no-repeat;
      display: flex; flex-direction: row;
    }
    .top-accent { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(to left, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}); z-index: 100; }
    .section-right {
      width: 520px; background: linear-gradient(180deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      padding: 60px 50px; position: relative; overflow: hidden; text-align: center;
    }
    .section-watermark {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 280px; font-weight: 900; color: rgba(255,255,255,0.03); line-height: 1;
    }
    .section-num-box {
      width: 90px; height: 90px; border: 3px solid ${theme.warningColor};
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 24px; position: relative; z-index: 2;
      animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both, pulseGlow 2s ease-in-out infinite;
    }
    .section-num { font-size: 42px; font-weight: 900; color: ${theme.warningColor}; }
    .section-label { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.5); position: relative; z-index: 2; animation: fadeInUp 0.5s ease 0.4s both; }
    .section-title {
      font-size: 32px; font-weight: 900; color: white; line-height: 1.5; margin-top: 20px;
      position: relative; z-index: 2; animation: fadeInUp 0.6s ease 0.5s both;
    }
    .section-desc { font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 14px; line-height: 1.8; position: relative; z-index: 2; animation: fadeInUp 0.6s ease 0.7s both; }
    .section-accent { width: 64px; height: 5px; border-radius: 3px; background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor}); margin-top: 20px; animation: lineGrow 0.8s ease 0.9s both; }
    .section-left {
      flex: 1; position: relative; z-index: 2;
    }
    .section-footer {
      position: absolute; bottom: 0; left: 0; right: 0; height: 44px; padding: 0 48px;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid ${theme.borderColor}; background: rgba(255,255,255,0.95); z-index: 2; direction: rtl;
    }
    .footer-logos { display: flex; align-items: center; gap: 14px; }
    .footer-logos img { height: 28px; object-fit: contain; }
    .footer-sep { width: 1px; height: 22px; background: #ccc; }
    .footer-page { font-size: 13px; font-weight: 700; color: ${theme.primary}; opacity: 0.4; }
  </style></head><body>
    <div class="section-slide">
      <div class="top-accent"></div>
      <div class="section-right">
        <div class="section-watermark">${num}</div>
        <div class="section-num-box"><span class="section-num">${String(num).padStart(2, '0')}</span></div>
        <div class="section-label">القسم</div>
        <div class="section-title">${data.title}</div>
        ${data.subtitle ? `<div class="section-desc">${data.subtitle}</div>` : ''}
        ${data.content ? `<div class="section-desc">${data.content}</div>` : ''}
        <div class="section-accent"></div>
      </div>
      <div class="section-left"></div>
      <div class="section-footer">
        <div class="footer-logos">
          <img src="${ASSETS.ndmoLogo}" alt="NDMO" onerror="this.style.display='none'">
          <div class="footer-sep"></div>
          <img src="${ASSETS.sdaiaLogo}" alt="SDAIA" onerror="this.style.display='none'">
        </div>
        <div class="footer-page">${num} / ${total}</div>
      </div>
    </div>
  </body></html>`;
}

// ─── 4. EXECUTIVE SUMMARY ───
function executiveSummarySlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const kpis = (data.kpiItems || []).slice(0, 4).map(item => `
    <div class="kpi-card" style="flex:1;">
      <div class="kpi-value">${item.value}</div>
      <div class="kpi-label">${item.label}</div>
      ${item.trend ? `<div class="kpi-trend ${item.trend}">${item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '—'} ${item.change || ''}</div>` : ''}
    </div>
  `).join('');
  const bullets = (data.bulletPoints || []).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${kpis ? `<div style="display:flex;gap:18px;">${kpis}</div>` : ''}
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
    </div>
  `, false, data.backgroundImage);
}

// ─── 5. KPI ───
function kpiSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.kpiItems || []).slice(0, 6);
  const cols = items.length <= 3 ? items.length : items.length <= 4 ? 2 : 3;
  const kpis = items.map(item => `
    <div class="kpi-card">
      <div class="kpi-value">${item.value}</div>
      <div class="kpi-label">${item.label}</div>
      ${item.trend ? `<div class="kpi-trend ${item.trend}">${item.trend === 'up' ? '▲ +' : item.trend === 'down' ? '▼ -' : '— '}${item.change || ''}</div>` : ''}
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      <div class="kpi-grid" style="grid-template-columns:repeat(${cols},1fr);">${kpis}</div>
    </div>
  `, false, data.backgroundImage);
}

// ─── 6. CHART ───
function chartSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const maxVal = Math.max(...(data.chartData || [1]));
  const defaultColors = [theme.primary, theme.secondary, theme.accent, theme.warningColor, theme.successColor, '#8b5cf6', '#06b6d4', theme.dangerColor];
  const bars = (data.chartData || []).map((v, i) => {
    const h = Math.max(32, (v / maxVal) * 300);
    const color = (data.chartColors || [])[i] || defaultColors[i % defaultColors.length];
    const label = (data.chartLabels || [])[i] || '';
    return `<div class="chart-bar-col">
      <div class="chart-bar" style="height:${h}px;background:linear-gradient(180deg,${color},${color}bb);box-shadow:0 -6px 20px ${color}30;">
        <span class="chart-bar-val">${v.toLocaleString()}</span>
      </div>
      <span class="chart-bar-lbl">${label}</span>
    </div>`;
  }).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      <div class="chart-area">${bars}</div>
    </div>
  `, false, data.backgroundImage);
}

// ─── 7. TABLE ───
function tableSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const headers = (data.tableHeaders || []).map(h => `<th>${h}</th>`).join('');
  const rows = (data.tableRows || []).map(row => {
    const cells = Array.isArray(row) ? row : Object.values(row as Record<string, unknown>);
    return `<tr>${cells.map(cell => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`;
  }).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text" style="margin-bottom:4px;">${data.content}</p>` : ''}
      <div class="table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>
    </div>
  `, false, data.backgroundImage);
}

// ─── 8. INFOGRAPHIC ───
function infographicSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.infographicItems || []).map(item => `
    <div class="info-card">
      <div class="info-icon"><span class="material-symbols-outlined">${item.icon || 'analytics'}</span></div>
      <div class="info-value">${item.value}</div>
      <div class="info-label">${item.label}</div>
      ${item.description ? `<div class="info-desc">${item.description}</div>` : ''}
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      <div class="info-grid" style="flex:1;align-content:center;">${items}</div>
    </div>
  `, false, data.backgroundImage);
}

// ─── 9. TIMELINE ───
function timelineSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.timelineItems || []).map((item, i) => `
    <div class="tl-item">
      <div class="tl-dot" style="background:${i % 3 === 0 ? theme.primary : i % 3 === 1 ? theme.secondary : theme.warningColor};box-shadow:0 0 0 4px ${i % 3 === 0 ? theme.primary : i % 3 === 1 ? theme.secondary : theme.warningColor}20;"></div>
      <div class="tl-content">
        <div class="tl-year">${item.year}</div>
        <div class="tl-title">${item.title}</div>
        <div class="tl-desc">${item.description}</div>
      </div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body"><div class="timeline">${items}</div></div>
  `, false, data.backgroundImage);
}

// ─── 10. PILLARS ───
function pillarsSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.pillarItems || []).map(item => `
    <div class="pillar-card">
      <div class="pillar-icon"><span class="material-symbols-outlined">${item.icon || 'star'}</span></div>
      <div class="pillar-title">${item.title}</div>
      <div class="pillar-desc">${item.description || ''}</div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      <div class="pillar-grid" style="flex:1;align-content:center;">${items}</div>
    </div>
  `, false, data.backgroundImage);
}

// ─── 11. CONTENT ───
function contentSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const bullets = (data.bulletPoints || []).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
    </div>
  `, false, data.backgroundImage);
}

// ─── 12. TWO COLUMN ───
function twoColumnSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const bullets = (data.bulletPoints || []);
  const half = Math.ceil(bullets.length / 2);
  const col1 = bullets.slice(0, half).map(bp => `<li>${bp}</li>`).join('');
  const col2 = bullets.slice(half).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="header-bar">
      <div><div class="header-title">${data.title}</div>${data.subtitle ? `<div class="header-subtitle">${data.subtitle}</div>` : ''}</div>
      <div class="header-badge">${String(num).padStart(2, '0')}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p class="content-text">${data.content}</p>` : ''}
      <div class="two-col" style="flex:1;">
        <ul class="bullet-list">${col1}</ul>
        <ul class="bullet-list">${col2}</ul>
      </div>
    </div>
  `, false, data.backgroundImage);
}

// ─── 13. CLOSING (Mandatory: Picture1.jpg background) ───
function closingSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    .closing {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${data.backgroundImage || ASSETS.coverBg}') center/cover no-repeat;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; color: white;
    }
    .closing::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(11,17,35,0.6) 0%, rgba(11,17,35,0.8) 100%);
    }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
    @keyframes lineGrow { from { width: 0; } to { width: 80px; } }
    .closing-content { position: relative; z-index: 2; }
    .closing-icon {
      width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 28px; font-size: 48px;
      background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    }
    .closing-title {
      font-size: 52px; font-weight: 900; letter-spacing: -0.5px;
      text-shadow: 0 4px 24px rgba(0,0,0,0.4);
      animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
    }
    .closing-accent {
      width: 80px; height: 5px; border-radius: 3px; margin: 28px auto;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor});
      animation: lineGrow 0.8s ease 0.7s both;
    }
    .closing-subtitle {
      font-size: 18px; opacity: 0.85; max-width: 600px; margin: 0 auto;
      line-height: 1.8; text-shadow: 0 2px 12px rgba(0,0,0,0.3);
      animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.9s both;
    }
    .closing-meta {
      font-size: 13px; opacity: 0.5; margin-top: 36px;
    }
    .closing-logos {
      position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 16px; z-index: 2;
    }
    .closing-logos img { height: 36px; object-fit: contain; filter: brightness(10); }
    .closing-logo-sep { width: 1px; height: 28px; background: rgba(255,255,255,0.3); }
    .top-accent-closing {
      position: absolute; top: 0; left: 0; right: 0; height: 5px;
      background: linear-gradient(to left, ${theme.secondary}, ${theme.accent}, ${theme.warningColor});
      z-index: 100;
    }
  </style></head><body>
    <div class="closing">
      <div class="top-accent-closing"></div>
      <div class="closing-content">
        <div class="closing-icon"><span class="material-symbols-outlined" style="font-size:48px;color:white;">forum</span></div>
        <h1 class="closing-title">${data.title || 'شكراً لكم'}</h1>
        <div class="closing-accent"></div>
        ${data.content ? `<p class="closing-subtitle">${data.content}</p>` : `<p class="closing-subtitle">نتطلع لشراكتكم في بناء مستقبل البيانات في المملكة العربية السعودية</p>`}
        ${data.subtitle ? `<div class="closing-meta">${data.subtitle}</div>` : ''}
      </div>
      <div class="closing-logos">
        <img src="${ASSETS.ndmoLogo}" alt="NDMO" onerror="this.style.display='none'">
        <div class="closing-logo-sep"></div>
        <img src="${ASSETS.sdaiaLogo}" alt="SDAIA" onerror="this.style.display='none'">
      </div>
    </div>
  </body></html>`;
}

// ═══════════════════════════════════════════════════════════════
// Layout Router
// ═══════════════════════════════════════════════════════════════
function renderSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  switch (data.layout) {
    case 'title': return coverSlide(theme, data, num, total);
    case 'toc': return tocSlide(theme, data, num, total);
    case 'section-title': return sectionTitleSlide(theme, data, num, total);
    case 'executive-summary': return executiveSummarySlide(theme, data, num, total);
    case 'kpi': return kpiSlide(theme, data, num, total);
    case 'chart': return chartSlide(theme, data, num, total);
    case 'table': return tableSlide(theme, data, num, total);
    case 'infographic': return infographicSlide(theme, data, num, total);
    case 'timeline': return timelineSlide(theme, data, num, total);
    case 'pillars': return pillarsSlide(theme, data, num, total);
    case 'content': return contentSlide(theme, data, num, total);
    case 'two-column': return twoColumnSlide(theme, data, num, total);
    case 'quote': return contentSlide(theme, data, num, total);
    case 'closing': return closingSlide(theme, data, num, total);
    default: return contentSlide(theme, data, num, total);
  }
}

// ═══ Main export: Generate full presentation ═══
export function generateHtmlPresentation(slides: SlideData[], themeId: string = 'ndmo'): string[] {
  const theme = THEMES[themeId] || THEMES.ndmo;
  return slides.map((slide, i) => renderSlide(theme, slide, i + 1, slides.length));
}

export function getTheme(themeId: string): SlideTheme {
  return THEMES[themeId] || THEMES.ndmo;
}

// ═══ Demo Presentation (Ultra Premium — all types) ═══
export const DEMO_SLIDES: SlideData[] = [
  {
    layout: 'title',
    title: 'التقرير السنوي لالتزام الجهات الحكومية بتنفيذ خطط نشر البيانات المفتوحة',
    subtitle: 'مكتب إدارة البيانات الوطنية — الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)',
    content: 'مقيد',
  },
  {
    layout: 'toc',
    title: 'فهرس المحتويات',
    subtitle: 'محاور التقرير الرئيسية',
    bulletPoints: [
      'المقدمة والمبادئ الأساسية للبيانات المفتوحة',
      'جهود الهيئة (سدايا) لتمكين إتاحة البيانات المفتوحة',
      'المسار التنظيمي: إصدار السياسات والتنسيق',
      'المسار التنظيمي: بناء القدرات والرقابة',
      'المسار التقني: البنية التحتية والأدوات الداعمة',
      'نتائج التقييم ومؤشرات الأداء',
      'المواءمة مع المنظمات العالمية',
      'التوصيات وخطة العمل المستقبلية',
    ],
  },
  {
    layout: 'section-title',
    title: 'المقدمة والمبادئ الأساسية',
    subtitle: 'الإطار العام للبيانات المفتوحة في المملكة العربية السعودية وأهميتها في التحول الرقمي',
  },
  {
    layout: 'executive-summary',
    title: 'الملخص التنفيذي',
    subtitle: 'أبرز المؤشرات والإنجازات',
    content: 'حققت المملكة تقدماً ملحوظاً في مجال البيانات المفتوحة خلال العام الماضي، حيث ارتفعت نسبة الامتثال لمعايير البيانات المفتوحة بنسبة 23% وتم إطلاق 15 مبادرة جديدة في مجال الذكاء الاصطناعي. كما تم ربط 156 جهة حكومية بمنصة البيانات الوطنية وتحسين جودة البيانات بنسبة 40% عبر أدوات التنظيف الآلي.',
    kpiItems: [
      { label: 'نسبة الامتثال', value: '87%', trend: 'up', change: '23%' },
      { label: 'الجهات المتصلة', value: '156', trend: 'up', change: '34' },
      { label: 'مجموعات البيانات', value: '12,450', trend: 'up', change: '2,100' },
      { label: 'المبادرات النشطة', value: '45', trend: 'flat', change: '' },
    ],
    bulletPoints: [
      'تم ربط 156 جهة حكومية بمنصة البيانات الوطنية بنجاح',
      'إطلاق 15 مبادرة جديدة في مجال الذكاء الاصطناعي والبيانات',
      'تحسين جودة البيانات بنسبة 40% عبر أدوات التنظيف الآلي المتقدمة',
    ],
  },
  {
    layout: 'pillars',
    title: 'الركائز الاستراتيجية',
    subtitle: 'أربع ركائز أساسية لتحقيق رؤية البيانات المفتوحة',
    content: 'تقوم استراتيجية البيانات المفتوحة على أربع ركائز متكاملة تضمن تحقيق الأهداف المرجوة بكفاءة عالية وفق أفضل الممارسات الدولية.',
    pillarItems: [
      { icon: 'security', title: 'حوكمة البيانات', description: 'إطار تنظيمي شامل يضمن جودة وأمن البيانات عبر جميع الجهات الحكومية مع آليات رقابة فعالة' },
      { icon: 'hub', title: 'البنية التحتية', description: 'منصات سحابية متطورة وشبكات ربط عالية السرعة لتبادل البيانات بين الجهات الحكومية' },
      { icon: 'psychology', title: 'الذكاء الاصطناعي', description: 'تطبيقات ذكية لتحليل البيانات واستخراج الرؤى واتخاذ القرارات المبنية على البيانات' },
      { icon: 'school', title: 'بناء القدرات', description: 'برامج تدريبية متخصصة لتأهيل الكوادر الوطنية في علوم البيانات والذكاء الاصطناعي' },
    ],
  },
  {
    layout: 'chart',
    title: 'تحليل النمو السنوي',
    subtitle: 'معدل نمو مجموعات البيانات المفتوحة (2020-2026)',
    content: 'شهدت مجموعات البيانات المفتوحة نمواً متسارعاً خلال السنوات الست الماضية، مع تسارع ملحوظ بعد إطلاق الاستراتيجية الوطنية للبيانات في 2023.',
    chartData: [2400, 3800, 5200, 7100, 9300, 11200, 12450],
    chartLabels: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'],
  },
  {
    layout: 'table',
    title: 'مقارنة الأداء حسب القطاعات',
    subtitle: 'تقييم شامل لمستوى نضج البيانات المفتوحة',
    content: 'يوضح الجدول التالي مستوى نضج البيانات المفتوحة في القطاعات الرئيسية مع مؤشرات الأداء والاتجاهات.',
    tableHeaders: ['القطاع', 'نسبة الامتثال', 'جودة البيانات', 'مجموعات البيانات', 'التقييم', 'الاتجاه'],
    tableRows: [
      ['الصحة', '92%', 'ممتازة', '2,340', 'A+', '▲'],
      ['التعليم', '88%', 'جيدة جداً', '1,890', 'A', '▲'],
      ['المالية', '85%', 'جيدة جداً', '3,120', 'A', '▲'],
      ['النقل', '79%', 'جيدة', '1,560', 'B+', '▲'],
      ['الطاقة', '76%', 'جيدة', '980', 'B', '—'],
      ['الزراعة', '71%', 'مقبولة', '640', 'B-', '▲'],
    ],
  },
  {
    layout: 'kpi',
    title: 'المؤشرات الرقمية الرئيسية',
    subtitle: 'أداء الربع الأول 2026',
    content: 'تظهر المؤشرات تحسناً ملحوظاً في جميع المجالات مقارنة بالربع السابق مع استمرار النمو المتسارع.',
    kpiItems: [
      { label: 'رضا المستخدمين', value: '94%', trend: 'up', change: '8%' },
      { label: 'سرعة الاستجابة', value: '120ms', trend: 'up', change: '35ms' },
      { label: 'الجهات النشطة', value: '142', trend: 'up', change: '18' },
    ],
  },
  {
    layout: 'timeline',
    title: 'خارطة الطريق',
    subtitle: 'المراحل الزمنية للتنفيذ',
    timelineItems: [
      { year: 'Q1 2026', title: 'إطلاق المنصة المحدثة', description: 'نشر الإصدار 3.0 مع واجهة مستخدم جديدة ومحركات ذكاء اصطناعي متطورة لتحليل البيانات' },
      { year: 'Q2 2026', title: 'التكامل مع الجهات', description: 'ربط 50 جهة حكومية إضافية وتفعيل تبادل البيانات الآلي عبر واجهات برمجية موحدة' },
      { year: 'Q3 2026', title: 'إطلاق سوق البيانات', description: 'منصة لتبادل مجموعات البيانات بين القطاعين العام والخاص وفق معايير الحوكمة' },
      { year: 'Q4 2026', title: 'الذكاء الاصطناعي التوليدي', description: 'دمج نماذج AI متقدمة لتحليل البيانات وتوليد التقارير والرؤى تلقائياً' },
    ],
  },
  {
    layout: 'closing',
    title: 'شكراً لكم',
    content: 'نتطلع لشراكتكم في بناء مستقبل البيانات المفتوحة في المملكة العربية السعودية',
    subtitle: 'مكتب إدارة البيانات الوطنية — سدايا',
  },
];
