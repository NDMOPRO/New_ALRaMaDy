// ═══════════════════════════════════════════════════════════════
// Rasid — Cinematic NDMO Slide Engine v4.0
// Ultra-premium design with glassmorphism, mesh gradients,
// animated accents, and cinematic typography
// Mandatory backgrounds: Picture1.jpg (cover/closing), NDMO_2024.png (toc/section)
// Brand: NDMO Official Identity — Tajawal
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

// ═══════════════════════════════════════════════════════════════
// SHARED CSS — Cinematic Premium Foundation v4
// ═══════════════════════════════════════════════════════════════
function baseCSS(theme: SlideTheme): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html {
      width: 1280px; height: 720px; overflow: hidden;
      direction: rtl; text-align: right;
      font-family: ${theme.fontBody};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ─── Keyframes — Cinematic ─── */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lineGrow { from { width: 0; } to { width: 64px; } }
    @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    @keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(0,179,136,0.25); } 50% { box-shadow: 0 0 20px 6px rgba(0,179,136,0.1); } }
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes borderGlow { 0%,100% { border-color: ${theme.secondary}30; } 50% { border-color: ${theme.secondary}60; } }
    @keyframes revealLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    /* ─── Slide Container — Mesh Background ─── */
    .slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      font-family: ${theme.fontBody}; color: ${theme.textPrimary};
      background: linear-gradient(135deg, #FAFBFE 0%, #F4F7FC 30%, #F0F5FA 60%, #F6F8FD 100%);
      display: flex; flex-direction: column;
      direction: rtl; text-align: right;
    }
    .slide::before {
      content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 600px 400px at 85% 15%, ${theme.secondary}0A 0%, transparent 100%),
        radial-gradient(ellipse 500px 350px at 15% 85%, ${theme.accent}08 0%, transparent 100%),
        radial-gradient(ellipse 400px 300px at 50% 50%, ${theme.warningColor}05 0%, transparent 100%);
    }
    .slide::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231B2A4A' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .slide-bg-image {
      position: absolute; inset: 0; background-size: cover; background-position: center;
      z-index: 0; opacity: 0.06; filter: saturate(0.5);
    }
    h1, h2, h3, h4 { font-family: ${theme.fontHeading}; line-height: 1.3; }
    .material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-size: 24px; direction: ltr; }

    /* ─── Top Accent — Animated Gradient Ribbon ─── */
    .top-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}, ${theme.secondary});
      background-size: 300% 100%;
      animation: gradientFlow 8s ease infinite;
      z-index: 100;
    }

    /* ─── Header Bar — Premium Glass Dark ─── */
    .header-bar {
      width: 100%; height: 72px; flex-shrink: 0;
      background: linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 50%, ${theme.primary}F0 100%);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 48px; color: white; position: relative; direction: rtl;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
    }
    .header-bar::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 300px 200px at 80% 50%, ${theme.secondary}18 0%, transparent 100%),
        radial-gradient(ellipse 200px 150px at 20% 50%, ${theme.warningColor}10 0%, transparent 100%);
    }
    .header-bar::after {
      content: ''; position: absolute; bottom: 0; left: 48px; right: 48px; height: 1px;
      background: linear-gradient(to left, ${theme.secondary}50, ${theme.warningColor}20, transparent 30%, transparent 70%, ${theme.secondary}20);
    }
    .header-title {
      font-size: 22px; font-weight: 800; letter-spacing: -0.3px; text-align: right;
      position: relative; z-index: 1;
      text-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: fadeInRight 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
    }
    .header-subtitle {
      font-size: 12px; opacity: 0.6; margin-top: 3px; text-align: right;
      position: relative; z-index: 1; font-weight: 400;
      animation: fadeInRight 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    }
    .header-badge {
      min-width: 46px; height: 46px; padding: 0 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 17px; color: ${theme.warningColor};
      backdrop-filter: blur(12px); position: relative; z-index: 1;
      animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05);
    }

    /* ─── Body ─── */
    .slide-body {
      flex: 1; padding: 28px 48px 20px; display: flex; flex-direction: column; gap: 16px;
      overflow: hidden; text-align: right; direction: rtl; position: relative; z-index: 1;
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
    }

    /* ─── Footer — Elegant Minimal ─── */
    .slide-footer {
      height: 44px; padding: 0 48px; display: flex; align-items: center; justify-content: space-between;
      background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
      flex-shrink: 0; direction: rtl; position: relative; z-index: 1;
      border-top: 1px solid ${theme.borderColor};
    }
    .slide-footer::before {
      content: ''; position: absolute; top: -1px; left: 48px; right: 48px; height: 1px;
      background: linear-gradient(to left, ${theme.secondary}25, transparent 20%, transparent 80%, ${theme.warningColor}25);
    }
    .footer-logos { display: flex; align-items: center; gap: 14px; }
    .footer-logos img { height: 26px; object-fit: contain; }
    .footer-sep { width: 1px; height: 18px; background: ${theme.borderColor}; }
    .footer-page {
      font-size: 11px; font-weight: 800; color: ${theme.primary};
      opacity: 0.3; letter-spacing: 1px;
    }

    /* ─── Content paragraph ─── */
    .content-text {
      font-size: 15px; line-height: 2; color: ${theme.textSecondary};
      max-width: 95%; text-align: right; direction: rtl;
      animation: fadeInUp 0.5s ease 0.3s both;
    }

    /* ─── KPI Cards — Glassmorphism ─── */
    .kpi-grid { display: grid; gap: 16px; flex: 1; align-content: center; }
    .kpi-card {
      background: rgba(255,255,255,0.85); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.6);
      border-radius: 20px; padding: 26px 20px; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 8px 32px rgba(27,42,74,0.06), 0 2px 6px rgba(27,42,74,0.04);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(27,42,74,0.1); }
    .kpi-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.warningColor});
      background-size: 200% 100%; animation: gradientFlow 5s ease infinite;
    }
    .kpi-card::after {
      content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
      background: radial-gradient(circle at 30% 30%, ${theme.secondary}06, transparent 60%);
      pointer-events: none;
    }
    .kpi-card { animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
    .kpi-card:nth-child(2) { animation-delay: 0.4s; }
    .kpi-card:nth-child(3) { animation-delay: 0.5s; }
    .kpi-card:nth-child(4) { animation-delay: 0.6s; }
    .kpi-card:nth-child(5) { animation-delay: 0.7s; }
    .kpi-card:nth-child(6) { animation-delay: 0.8s; }
    .kpi-value {
      font-size: 40px; font-weight: 900; position: relative; z-index: 1;
      letter-spacing: -1.5px;
      background: linear-gradient(135deg, ${theme.primary}, ${theme.accent}, ${theme.secondary});
      background-size: 200% 200%; animation: gradientFlow 6s ease infinite;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .kpi-label {
      font-size: 13px; color: ${theme.textSecondary}; margin-top: 10px;
      font-weight: 600; position: relative; z-index: 1;
    }
    .kpi-trend {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 700; margin-top: 10px;
      padding: 4px 14px; border-radius: 20px; position: relative; z-index: 1;
    }
    .kpi-trend.up { color: ${theme.successColor}; background: ${theme.successColor}14; }
    .kpi-trend.down { color: ${theme.dangerColor}; background: ${theme.dangerColor}14; }
    .kpi-trend.flat { color: ${theme.textSecondary}; background: ${theme.textSecondary}10; }

    /* ─── Bullet List — Elegant Glass Cards ─── */
    .bullet-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .bullet-list li {
      padding: 14px 20px; padding-right: 46px; position: relative; font-size: 14px; line-height: 1.85;
      background: rgba(255,255,255,0.75); backdrop-filter: blur(8px);
      border-radius: 14px; border: 1px solid rgba(255,255,255,0.5);
      box-shadow: 0 2px 10px rgba(27,42,74,0.04);
      text-align: right; direction: rtl; color: ${theme.textPrimary};
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bullet-list li:hover {
      transform: translateX(-6px);
      box-shadow: 0 6px 24px rgba(27,42,74,0.08);
      border-color: ${theme.secondary}40;
      background: rgba(255,255,255,0.9);
    }
    .bullet-list li { animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .bullet-list li:nth-child(1) { animation-delay: 0.2s; }
    .bullet-list li:nth-child(2) { animation-delay: 0.3s; }
    .bullet-list li:nth-child(3) { animation-delay: 0.4s; }
    .bullet-list li:nth-child(4) { animation-delay: 0.5s; }
    .bullet-list li:nth-child(5) { animation-delay: 0.6s; }
    .bullet-list li:nth-child(6) { animation-delay: 0.7s; }
    .bullet-list li::before {
      content: ''; position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
      width: 12px; height: 12px; border-radius: 50%;
      background: linear-gradient(135deg, ${theme.secondary}, ${theme.accent});
      box-shadow: 0 0 12px ${theme.secondary}40, 0 2px 4px ${theme.secondary}30;
    }

    /* ─── Table — Frosted Glass ─── */
    .table-wrap {
      flex: 1; overflow: hidden; border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.5);
      box-shadow: 0 8px 32px rgba(27,42,74,0.06);
      animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
      background: rgba(255,255,255,0.6); backdrop-filter: blur(8px);
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead {
      background: linear-gradient(135deg, ${theme.primary}, ${theme.gradientEnd}, ${theme.accent}90);
    }
    th {
      color: white; padding: 16px 20px; text-align: right; font-weight: 700; font-size: 12px;
      letter-spacing: 0.5px; border-bottom: 2px solid ${theme.secondary};
      text-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    td {
      padding: 13px 20px; border-bottom: 1px solid ${theme.borderColor}40;
      text-align: right; font-size: 12px; color: ${theme.textPrimary};
      transition: all 0.2s;
    }
    tr:nth-child(even) td { background: rgba(27,42,74,0.02); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: ${theme.secondary}0A; }

    /* ─── Chart — Cinematic Bars ─── */
    .chart-area {
      flex: 1; display: flex; align-items: flex-end; gap: 14px;
      padding: 20px 0 0; position: relative;
    }
    .chart-area::before {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(to left, ${theme.secondary}30, ${theme.borderColor}, ${theme.warningColor}30);
      border-radius: 1px;
    }
    .chart-bar-col {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0;
      position: relative; z-index: 1;
    }
    .chart-bar {
      width: 100%; max-width: 56px; border-radius: 14px 14px 4px 4px; position: relative;
      display: flex; align-items: flex-start; justify-content: center; padding-top: 10px;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); cursor: default;
    }
    .chart-bar:hover { filter: brightness(1.12); transform: scaleY(1.03); transform-origin: bottom; }
    .chart-bar-val {
      font-size: 11px; font-weight: 900; color: white;
      text-shadow: 0 1px 6px rgba(0,0,0,0.4);
    }
    .chart-bar-lbl {
      font-size: 10px; color: ${theme.textSecondary}; margin-top: 10px;
      text-align: center; font-weight: 600; max-width: 80px;
    }

    /* ─── Infographic — Premium Glass Cards ─── */
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .info-card {
      background: rgba(255,255,255,0.8); backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 20px; padding: 22px 18px; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 6px 24px rgba(27,42,74,0.05);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .info-card:hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 16px 48px rgba(27,42,74,0.1); }
    .info-card { animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .info-card:nth-child(1) { animation-delay: 0.2s; }
    .info-card:nth-child(2) { animation-delay: 0.3s; }
    .info-card:nth-child(3) { animation-delay: 0.4s; }
    .info-card:nth-child(4) { animation-delay: 0.5s; }
    .info-card:nth-child(5) { animation-delay: 0.6s; }
    .info-card:nth-child(6) { animation-delay: 0.7s; }
    .info-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, ${theme.accent}, ${theme.secondary}, ${theme.warningColor});
      background-size: 200% 100%; animation: gradientFlow 5s ease infinite;
    }
    .info-icon {
      width: 54px; height: 54px; border-radius: 16px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 12px; font-size: 24px;
      background: linear-gradient(135deg, ${theme.primary}14, ${theme.secondary}14);
      color: ${theme.primary}; position: relative;
      box-shadow: 0 4px 12px ${theme.primary}10;
    }
    .info-value {
      font-size: 28px; font-weight: 900; letter-spacing: -0.5px;
      background: linear-gradient(135deg, ${theme.primary}, ${theme.accent});
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .info-label { font-size: 12px; color: ${theme.textSecondary}; margin-top: 6px; font-weight: 600; text-align: center; }
    .info-desc { font-size: 11px; color: ${theme.textSecondary}; margin-top: 6px; opacity: 0.75; line-height: 1.6; text-align: center; }

    /* ─── Timeline — Cinematic Vertical ─── */
    .timeline { display: flex; flex-direction: column; gap: 0; position: relative; padding-right: 44px; flex: 1; }
    .timeline::before {
      content: ''; position: absolute; right: 15px; top: 0; bottom: 0;
      width: 3px; border-radius: 2px;
      background: linear-gradient(180deg, ${theme.primary}, ${theme.secondary}, ${theme.warningColor}, ${theme.secondary}60);
    }
    .tl-item {
      display: flex; gap: 20px; position: relative; padding-bottom: 16px;
      animation: fadeInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .tl-item:nth-child(1) { animation-delay: 0.25s; }
    .tl-item:nth-child(2) { animation-delay: 0.4s; }
    .tl-item:nth-child(3) { animation-delay: 0.55s; }
    .tl-item:nth-child(4) { animation-delay: 0.7s; }
    .tl-dot {
      width: 22px; height: 22px; border-radius: 50%; background: ${theme.primary};
      border: 3px solid white; position: absolute; right: -44px; top: 8px;
      box-shadow: 0 0 0 4px ${theme.primary}15, 0 4px 12px rgba(0,0,0,0.1);
      z-index: 1;
    }
    .tl-content {
      flex: 1; background: rgba(255,255,255,0.8); backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 16px; padding: 16px 20px;
      box-shadow: 0 4px 16px rgba(27,42,74,0.05);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tl-content:hover { transform: translateX(-4px); box-shadow: 0 8px 32px rgba(27,42,74,0.08); }
    .tl-year {
      font-size: 11px; font-weight: 800; color: white;
      background: linear-gradient(135deg, ${theme.secondary}, ${theme.accent});
      padding: 3px 12px; border-radius: 8px; display: inline-block;
      box-shadow: 0 2px 8px ${theme.secondary}30;
    }
    .tl-title { font-size: 14px; font-weight: 700; color: ${theme.textPrimary}; margin-top: 8px; text-align: right; }
    .tl-desc { font-size: 12px; color: ${theme.textSecondary}; margin-top: 4px; line-height: 1.7; text-align: right; }

    /* ─── Pillar Cards — Elevated Glass ─── */
    .pillar-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .pillar-card {
      background: rgba(255,255,255,0.8); backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 20px; padding: 24px 18px; text-align: center;
      position: relative; overflow: hidden;
      box-shadow: 0 6px 24px rgba(27,42,74,0.05);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pillar-card:hover { transform: translateY(-5px); box-shadow: 0 16px 48px rgba(27,42,74,0.1); }
    .pillar-card { animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .pillar-card:nth-child(1) { animation-delay: 0.2s; }
    .pillar-card:nth-child(2) { animation-delay: 0.35s; }
    .pillar-card:nth-child(3) { animation-delay: 0.5s; }
    .pillar-card:nth-child(4) { animation-delay: 0.65s; }
    .pillar-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary});
    }
    .pillar-card::after {
      content: ''; position: absolute; bottom: -60px; left: 50%; transform: translateX(-50%);
      width: 140px; height: 140px; border-radius: 50%;
      background: radial-gradient(circle, ${theme.secondary}08, transparent);
      pointer-events: none;
    }
    .pillar-icon {
      width: 58px; height: 58px; border-radius: 16px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 14px; font-size: 26px;
      background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd});
      color: white;
      box-shadow: 0 8px 24px ${theme.primary}25;
      animation: float 4s ease-in-out infinite;
    }
    .pillar-card:nth-child(2) .pillar-icon { animation-delay: 0.5s; }
    .pillar-card:nth-child(3) .pillar-icon { animation-delay: 1s; }
    .pillar-card:nth-child(4) .pillar-icon { animation-delay: 1.5s; }
    .pillar-title { font-size: 15px; font-weight: 800; color: ${theme.textPrimary}; text-align: center; }
    .pillar-desc { font-size: 12px; color: ${theme.textSecondary}; margin-top: 8px; line-height: 1.7; text-align: center; }

    /* ─── Two Column ─── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

    /* ─── Accent Elements ─── */
    .accent-line {
      width: 64px; height: 4px; border-radius: 2px;
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
// SLIDE TEMPLATES — Cinematic Premium v4
// ═══════════════════════════════════════════════════════════════

// ─── 1. COVER — Cinematic Parallax ───
function coverSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lineGrow { from { width: 0; opacity: 0; } to { width: 140px; opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes breathe { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
    .cover {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${data.backgroundImage || ASSETS.coverBg}') center/cover no-repeat;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; color: white;
    }
    .cover::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(180deg,
        rgba(11,17,35,0.35) 0%,
        rgba(11,17,35,0.55) 30%,
        rgba(11,17,35,0.75) 60%,
        rgba(11,17,35,0.88) 100%);
    }
    .cover::after {
      content: ''; position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 800px 500px at 50% 80%, rgba(0,179,136,0.12) 0%, transparent 100%),
        radial-gradient(ellipse 600px 400px at 80% 20%, rgba(43,94,167,0.08) 0%, transparent 100%);
    }
    .cover-content { position: relative; z-index: 2; max-width: 1000px; padding: 0 80px; }
    .cover-accent-top {
      width: 140px; height: 3px; border-radius: 2px; margin: 0 auto 44px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor}, ${theme.secondary});
      background-size: 200% auto;
      animation: lineGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both, shimmer 4s linear 1.5s infinite;
    }
    .cover-title {
      font-size: 50px; font-weight: 900; line-height: 1.45; letter-spacing: -0.5px;
      text-shadow: 0 4px 40px rgba(0,0,0,0.5), 0 2px 12px rgba(0,0,0,0.3);
      animation: fadeInUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
    }
    .cover-accent-bottom {
      width: 140px; height: 3px; border-radius: 2px; margin: 44px auto 0;
      background: linear-gradient(90deg, ${theme.warningColor}, ${theme.secondary}, ${theme.warningColor});
      background-size: 200% auto;
      animation: lineGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1s both, shimmer 4s linear 2.2s infinite;
    }
    .cover-org {
      font-size: 14px; font-weight: 500; opacity: 0.6; margin-top: 36px;
      letter-spacing: 3px; text-transform: uppercase;
      animation: fadeIn 1s ease 1.4s both;
    }
    .cover-date {
      font-size: 12px; opacity: 0.35; margin-top: 10px;
      animation: fadeIn 1s ease 1.6s both;
    }
    .cover-logos {
      position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 20px; z-index: 2;
      animation: fadeIn 1.2s ease 1.8s both, float 5s ease-in-out 3s infinite;
    }
    .cover-logos img { height: 38px; object-fit: contain; filter: brightness(10); }
    .cover-logo-sep { width: 1px; height: 30px; background: rgba(255,255,255,0.2); }
    .top-accent-cover {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}, ${theme.secondary});
      background-size: 300% 100%; animation: gradientFlow 8s ease infinite;
      z-index: 100;
    }
    .bottom-accent-cover {
      position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(to right, ${theme.secondary}40, transparent 30%, transparent 70%, ${theme.warningColor}40);
      z-index: 100; animation: breathe 3s ease-in-out infinite;
    }
    .cover-particles {
      position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background:
        radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.15), transparent),
        radial-gradient(2px 2px at 80% 20%, rgba(255,255,255,0.1), transparent),
        radial-gradient(2px 2px at 40% 70%, rgba(255,255,255,0.08), transparent),
        radial-gradient(2px 2px at 70% 60%, rgba(255,255,255,0.12), transparent),
        radial-gradient(2px 2px at 10% 80%, rgba(255,255,255,0.06), transparent),
        radial-gradient(2px 2px at 90% 90%, rgba(255,255,255,0.08), transparent);
      animation: breathe 4s ease-in-out infinite;
    }
  </style></head><body>
    <div class="cover">
      <div class="top-accent-cover"></div>
      <div class="bottom-accent-cover"></div>
      <div class="cover-particles"></div>
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

// ─── 2. TOC — Split Panel with Glass Items ───
function tocSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.bulletPoints || []).map((bp, i) => `
    <div class="toc-item" style="animation: tocItemIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.07}s both;">
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
    @keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes breathe { 0%,100% { opacity: 0.03; } 50% { opacity: 0.06; } }
    .toc-slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${ASSETS.tocBg}') center/cover no-repeat;
      display: flex; flex-direction: row;
    }
    .top-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}, ${theme.secondary});
      background-size: 300% 100%; animation: gradientFlow 8s ease infinite;
      z-index: 100;
    }
    .toc-right {
      width: 380px;
      background: linear-gradient(180deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 60%, ${theme.primary}F0 100%);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      padding: 60px 36px; position: relative; overflow: hidden; text-align: center;
    }
    .toc-right::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 300px 200px at 50% 30%, ${theme.secondary}10 0%, transparent 100%),
        radial-gradient(ellipse 200px 200px at 50% 80%, ${theme.warningColor}08 0%, transparent 100%);
    }
    .toc-right-watermark {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 180px; font-weight: 900; color: rgba(255,255,255,0.03); line-height: 1;
      animation: breathe 5s ease-in-out infinite;
    }
    .toc-right-title {
      font-size: 28px; font-weight: 900; color: white; line-height: 1.5;
      position: relative; z-index: 2;
      text-shadow: 0 2px 12px rgba(0,0,0,0.2);
      animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
    }
    .toc-right-subtitle {
      font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 12px;
      position: relative; z-index: 2; animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    }
    .toc-right-accent {
      width: 64px; height: 4px; border-radius: 2px; margin-top: 20px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor});
      animation: lineGrow 0.8s ease 0.5s both;
      position: relative; z-index: 2;
    }
    .toc-left {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 24px 36px; position: relative; z-index: 2;
    }
    .toc-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
    }
    .toc-item {
      display: flex; flex-direction: row-reverse; align-items: stretch;
      background: rgba(255,255,255,0.92); backdrop-filter: blur(8px);
      border-radius: 14px; overflow: hidden;
      box-shadow: 0 3px 12px rgba(0,0,0,0.04);
      border: 1px solid rgba(255,255,255,0.6);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); cursor: default;
    }
    .toc-item:hover {
      box-shadow: 0 8px 28px rgba(0,0,0,0.08);
      transform: translateY(-3px);
      border-color: ${theme.secondary}40;
    }
    .toc-item-num {
      width: 50px; display: flex; align-items: center;
      justify-content: center; color: white; font-size: 17px; font-weight: 900; flex-shrink: 0;
      background: linear-gradient(180deg, ${theme.primary}, ${theme.gradientEnd});
    }
    .toc-item:nth-child(1) .toc-item-num {
      background: linear-gradient(180deg, ${theme.secondary}, ${theme.secondary}D0);
    }
    .toc-item:nth-child(odd):not(:first-child) .toc-item-num {
      background: linear-gradient(180deg, ${theme.accent}, ${theme.accent}D0);
    }
    .toc-item-text {
      flex: 1; padding: 12px 16px; display: flex; align-items: center;
      font-size: 12.5px; font-weight: 600; color: ${theme.textPrimary}; line-height: 1.55;
      text-align: right; direction: rtl;
    }
    .toc-footer {
      position: absolute; bottom: 0; left: 0; right: 0; height: 44px; padding: 0 48px;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid ${theme.borderColor}40;
      background: rgba(255,255,255,0.9); backdrop-filter: blur(8px);
      z-index: 2; direction: rtl;
    }
    .footer-logos { display: flex; align-items: center; gap: 14px; }
    .footer-logos img { height: 26px; object-fit: contain; }
    .footer-sep { width: 1px; height: 18px; background: ${theme.borderColor}; }
    .footer-page { font-size: 11px; font-weight: 800; color: ${theme.primary}; opacity: 0.3; letter-spacing: 1px; }
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

// ─── 3. SECTION TITLE — Cinematic Split ───
function sectionTitleSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    @keyframes fadeInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
    @keyframes lineGrow { from { width: 0; } to { width: 64px; } }
    @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 ${theme.warningColor}50; } 50% { box-shadow: 0 0 24px 8px ${theme.warningColor}15; } }
    @keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes breathe { 0%,100% { opacity: 0.03; } 50% { opacity: 0.06; } }
    .section-slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${ASSETS.tocBg}') center/cover no-repeat;
      display: flex; flex-direction: row;
    }
    .top-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}, ${theme.secondary});
      background-size: 300% 100%; animation: gradientFlow 8s ease infinite;
      z-index: 100;
    }
    .section-right {
      width: 520px;
      background: linear-gradient(180deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 60%, ${theme.primary}F0 100%);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      padding: 60px 50px; position: relative; overflow: hidden; text-align: center;
    }
    .section-right::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 400px 300px at 50% 40%, ${theme.secondary}10 0%, transparent 100%),
        radial-gradient(ellipse 300px 200px at 30% 80%, ${theme.warningColor}08 0%, transparent 100%);
    }
    .section-watermark {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 260px; font-weight: 900; color: rgba(255,255,255,0.03); line-height: 1;
      animation: breathe 5s ease-in-out infinite;
    }
    .section-num-box {
      width: 88px; height: 88px; border: 2px solid ${theme.warningColor}80;
      border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 24px; position: relative; z-index: 2;
      background: rgba(255,255,255,0.04); backdrop-filter: blur(8px);
      animation: scaleIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both, pulseGlow 3s ease-in-out infinite;
    }
    .section-num { font-size: 40px; font-weight: 900; color: ${theme.warningColor}; }
    .section-label {
      font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.45);
      letter-spacing: 3px; text-transform: uppercase;
      position: relative; z-index: 2; animation: fadeInUp 0.6s ease 0.4s both;
    }
    .section-title {
      font-size: 30px; font-weight: 900; color: white; line-height: 1.5; margin-top: 18px;
      position: relative; z-index: 2;
      text-shadow: 0 2px 12px rgba(0,0,0,0.2);
      animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
    }
    .section-desc {
      font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 14px; line-height: 1.8;
      position: relative; z-index: 2; max-width: 400px;
      animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both;
    }
    .section-accent {
      width: 64px; height: 4px; border-radius: 2px; margin-top: 22px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor});
      animation: lineGrow 0.8s ease 0.9s both;
      position: relative; z-index: 2;
    }
    .section-left { flex: 1; position: relative; z-index: 2; }
    .section-footer {
      position: absolute; bottom: 0; left: 0; right: 0; height: 44px; padding: 0 48px;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid ${theme.borderColor}40;
      background: rgba(255,255,255,0.9); backdrop-filter: blur(8px);
      z-index: 2; direction: rtl;
    }
    .footer-logos { display: flex; align-items: center; gap: 14px; }
    .footer-logos img { height: 26px; object-fit: contain; }
    .footer-sep { width: 1px; height: 18px; background: ${theme.borderColor}; }
    .footer-page { font-size: 11px; font-weight: 800; color: ${theme.primary}; opacity: 0.3; letter-spacing: 1px; }
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
      ${kpis ? `<div style="display:flex;gap:14px;">${kpis}</div>` : ''}
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
      <div class="chart-bar" style="height:${h}px;background:linear-gradient(180deg,${color},${color}bb);box-shadow:0 -8px 24px ${color}25;">
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
      <div class="tl-dot" style="background:${i % 3 === 0 ? theme.primary : i % 3 === 1 ? theme.secondary : theme.warningColor};box-shadow:0 0 0 4px ${i % 3 === 0 ? theme.primary : i % 3 === 1 ? theme.secondary : theme.warningColor}18, 0 4px 12px rgba(0,0,0,0.1);"></div>
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

// ─── 13. CLOSING — Cinematic ───
function closingSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 1280px; height: 720px; overflow: hidden; direction: rtl; text-align: right; font-family: ${theme.fontBody}; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
    @keyframes lineGrow { from { width: 0; } to { width: 100px; } }
    @keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes breathe { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
    @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    .closing {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: url('${data.backgroundImage || ASSETS.coverBg}') center/cover no-repeat;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; color: white;
    }
    .closing::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(180deg,
        rgba(11,17,35,0.5) 0%,
        rgba(11,17,35,0.7) 40%,
        rgba(11,17,35,0.85) 100%);
    }
    .closing::after {
      content: ''; position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 50% 60%, rgba(0,179,136,0.1) 0%, transparent 100%),
        radial-gradient(ellipse 400px 300px at 80% 20%, rgba(43,94,167,0.06) 0%, transparent 100%);
    }
    .closing-particles {
      position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background:
        radial-gradient(2px 2px at 15% 25%, rgba(255,255,255,0.12), transparent),
        radial-gradient(2px 2px at 85% 15%, rgba(255,255,255,0.08), transparent),
        radial-gradient(2px 2px at 35% 75%, rgba(255,255,255,0.06), transparent),
        radial-gradient(2px 2px at 75% 65%, rgba(255,255,255,0.1), transparent);
      animation: breathe 4s ease-in-out infinite;
    }
    .closing-content { position: relative; z-index: 2; }
    .closing-icon {
      width: 96px; height: 96px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 28px; font-size: 44px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08);
      animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both, float 4s ease-in-out 1.5s infinite;
    }
    .closing-title {
      font-size: 50px; font-weight: 900; letter-spacing: -0.5px;
      text-shadow: 0 4px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
      animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
    }
    .closing-accent {
      width: 100px; height: 3px; border-radius: 2px; margin: 28px auto;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.warningColor}, ${theme.secondary});
      background-size: 200% auto;
      animation: lineGrow 1s ease 0.8s both, shimmer 4s linear 1.8s infinite;
    }
    .closing-subtitle {
      font-size: 17px; opacity: 0.75; max-width: 580px; margin: 0 auto;
      line-height: 1.9; text-shadow: 0 2px 12px rgba(0,0,0,0.3);
      animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 1s both;
    }
    .closing-meta {
      font-size: 12px; opacity: 0.4; margin-top: 32px;
      letter-spacing: 1px;
      animation: fadeInUp 0.8s ease 1.2s both;
    }
    .closing-logos {
      position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 18px; z-index: 2;
      animation: fadeInUp 0.8s ease 1.4s both, float 5s ease-in-out 2.5s infinite;
    }
    .closing-logos img { height: 34px; object-fit: contain; filter: brightness(10); }
    .closing-logo-sep { width: 1px; height: 26px; background: rgba(255,255,255,0.2); }
    .top-accent-closing {
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.secondary}, ${theme.accent}, ${theme.warningColor}, ${theme.secondary});
      background-size: 300% 100%; animation: gradientFlow 8s ease infinite;
      z-index: 100;
    }
  </style></head><body>
    <div class="closing">
      <div class="top-accent-closing"></div>
      <div class="closing-particles"></div>
      <div class="closing-content">
        <div class="closing-icon"><span class="material-symbols-outlined" style="font-size:44px;color:white;">forum</span></div>
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
      { label: 'نسبة الامتثال', value: '87%', trend: 'up' as const, change: '23%' },
      { label: 'الجهات المتصلة', value: '156', trend: 'up' as const, change: '34' },
      { label: 'مجموعات البيانات', value: '12,450', trend: 'up' as const, change: '2,100' },
      { label: 'المبادرات النشطة', value: '45', trend: 'flat' as const, change: '' },
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
      { label: 'رضا المستخدمين', value: '94%', trend: 'up' as const, change: '8%' },
      { label: 'سرعة الاستجابة', value: '120ms', trend: 'up' as const, change: '35ms' },
      { label: 'الجهات النشطة', value: '142', trend: 'up' as const, change: '18' },
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
