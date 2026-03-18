// ═══════════════════════════════════════════════════════════════
// Rasid — Ultra Premium HTML Slide Templates
// Like Gamma.app — each slide is a standalone HTML page (960×540)
// 10 slide types × 5 themes = 50 unique combinations
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
    primary: '#0f2744', secondary: '#d4af37', accent: '#1a73e8',
    background: '#ffffff', cardBg: '#f8fafc',
    textPrimary: '#0f172a', textSecondary: '#475569', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#0f2744', gradientEnd: '#1a3a6b',
    borderColor: '#e2e8f0', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
    surfaceGlow: 'rgba(212,175,55,0.08)',
  },
  sdaia: {
    id: 'sdaia', name: 'سدايا', nameEn: 'SDAIA',
    primary: '#1a73e8', secondary: '#0f766e', accent: '#6366f1',
    background: '#ffffff', cardBg: '#f0f9ff',
    textPrimary: '#0f172a', textSecondary: '#475569', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#1a73e8', gradientEnd: '#0f766e',
    borderColor: '#dbeafe', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
    surfaceGlow: 'rgba(26,115,232,0.08)',
  },
  modern: {
    id: 'modern', name: 'عصري احترافي', nameEn: 'Modern',
    primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899',
    background: '#ffffff', cardBg: '#faf5ff',
    textPrimary: '#1e1b4b', textSecondary: '#6b7280', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#6366f1', gradientEnd: '#a855f7',
    borderColor: '#e9d5ff', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
    surfaceGlow: 'rgba(99,102,241,0.08)',
  },
  minimal: {
    id: 'minimal', name: 'بسيط ونظيف', nameEn: 'Minimal',
    primary: '#1f2937', secondary: '#6b7280', accent: '#3b82f6',
    background: '#ffffff', cardBg: '#f9fafb',
    textPrimary: '#111827', textSecondary: '#6b7280', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#1f2937', gradientEnd: '#374151',
    borderColor: '#e5e7eb', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
    surfaceGlow: 'rgba(31,41,55,0.06)',
  },
  creative: {
    id: 'creative', name: 'إبداعي', nameEn: 'Creative',
    primary: '#dc2626', secondary: '#f59e0b', accent: '#10b981',
    background: '#fffbeb', cardBg: '#fef3c7',
    textPrimary: '#1c1917', textSecondary: '#78716c', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#dc2626', gradientEnd: '#f59e0b',
    borderColor: '#fde68a', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
    surfaceGlow: 'rgba(220,38,38,0.06)',
  },
};

export interface SlideData {
  title: string;
  subtitle?: string;
  content?: string;
  bulletPoints?: string[];
  notes?: string;
  layout: 'title' | 'toc' | 'executive-summary' | 'pillars' | 'chart' | 'table' | 'infographic' | 'kpi' | 'timeline' | 'closing' | 'content' | 'two-column' | 'quote';
  chartType?: 'bar' | 'line' | 'pie' | 'donut';
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
}

// ─── Base CSS for all slides ───
function baseCSS(theme: SlideTheme): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 960px; height: 540px; overflow: hidden; direction: rtl; }
    .slide {
      width: 960px; height: 540px; position: relative; overflow: hidden;
      font-family: ${theme.fontBody}; color: ${theme.textPrimary};
      background: ${theme.background}; display: flex; flex-direction: column;
    }
    h1, h2, h3, h4 { font-family: ${theme.fontHeading}; line-height: 1.3; }
    .material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-size: 24px; direction: ltr; }

    /* Header */
    .slide-header {
      background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd});
      color: ${theme.textLight}; padding: 20px 40px; display: flex; align-items: center; gap: 16px;
      position: relative; overflow: hidden;
    }
    .slide-header::after {
      content: ''; position: absolute; top: -50%; left: -20%; width: 200px; height: 200px;
      background: radial-gradient(circle, ${theme.secondary}15, transparent 70%);
      border-radius: 50%;
    }
    .slide-header h2 { font-size: 24px; font-weight: 800; position: relative; z-index: 1; }
    .slide-header .subtitle { font-size: 13px; opacity: 0.85; position: relative; z-index: 1; }
    .slide-header .accent-bar { width: 4px; height: 32px; background: ${theme.secondary}; border-radius: 2px; flex-shrink: 0; }

    /* Body */
    .slide-body { flex: 1; padding: 28px 40px; display: flex; flex-direction: column; gap: 16px; overflow: hidden; }

    /* Footer */
    .slide-footer {
      height: 36px; padding: 0 40px; display: flex; align-items: center; justify-content: space-between;
      font-size: 10px; color: ${theme.textSecondary}; border-top: 1px solid ${theme.borderColor};
      background: ${theme.cardBg};
    }
    .slide-footer .brand { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .slide-footer .brand::before {
      content: ''; width: 8px; height: 8px; border-radius: 2px; background: ${theme.secondary};
    }

    /* Cards */
    .card {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 14px; padding: 18px; transition: all 0.2s;
    }
    .card:hover { box-shadow: 0 4px 20px ${theme.surfaceGlow}; }

    /* KPI Cards */
    .kpi-card {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 14px; padding: 20px; text-align: center;
      border-top: 4px solid ${theme.primary}; position: relative; overflow: hidden;
    }
    .kpi-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 60px;
      background: linear-gradient(180deg, ${theme.surfaceGlow}, transparent);
    }
    .kpi-value { font-size: 32px; font-weight: 900; color: ${theme.primary}; position: relative; }
    .kpi-label { font-size: 12px; color: ${theme.textSecondary}; margin-top: 6px; font-weight: 500; position: relative; }
    .kpi-trend { font-size: 11px; font-weight: 700; margin-top: 4px; position: relative; }
    .kpi-trend.up { color: ${theme.successColor}; }
    .kpi-trend.down { color: ${theme.dangerColor}; }

    /* Bullet List */
    .bullet-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .bullet-list li {
      padding: 10px 18px; padding-right: 32px; position: relative; font-size: 13px; line-height: 1.7;
      background: ${theme.cardBg}; border-radius: 10px; border: 1px solid ${theme.borderColor};
      transition: all 0.2s;
    }
    .bullet-list li::before {
      content: ''; position: absolute; right: 14px; top: 16px;
      width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary});
    }

    /* Table */
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; border-radius: 10px; overflow: hidden; border: 1px solid ${theme.borderColor}; }
    th {
      background: linear-gradient(135deg, ${theme.primary}, ${theme.gradientEnd});
      color: ${theme.textLight}; padding: 12px 14px; text-align: right; font-weight: 700; font-size: 11px;
      letter-spacing: 0.3px;
    }
    td { padding: 10px 14px; border-bottom: 1px solid ${theme.borderColor}; text-align: right; font-size: 11px; }
    tr:nth-child(even) td { background: ${theme.cardBg}; }
    tr:last-child td { border-bottom: none; }

    /* Chart */
    .chart-container { flex: 1; display: flex; align-items: flex-end; gap: 16px; padding: 16px 0; }
    .chart-bar {
      flex: 1; border-radius: 8px 8px 0 0; position: relative; display: flex;
      flex-direction: column; align-items: center; justify-content: flex-end; min-width: 48px;
      transition: all 0.3s;
    }
    .chart-bar:hover { filter: brightness(1.1); transform: translateY(-2px); }
    .chart-bar-value { font-size: 12px; font-weight: 800; color: ${theme.textLight}; padding: 6px 0; }
    .chart-bar-label { font-size: 10px; color: ${theme.textSecondary}; margin-top: 8px; text-align: center; font-weight: 500; }

    /* Infographic */
    .infographic-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
    .infographic-item {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 14px; padding: 18px; text-align: center;
      border-top: 4px solid ${theme.accent}; transition: all 0.2s;
    }
    .infographic-item:hover { transform: translateY(-2px); box-shadow: 0 8px 24px ${theme.surfaceGlow}; }
    .infographic-icon {
      width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 10px; font-size: 24px;
      background: linear-gradient(135deg, ${theme.primary}12, ${theme.accent}12);
      color: ${theme.primary};
    }
    .infographic-value { font-size: 24px; font-weight: 900; color: ${theme.primary}; }
    .infographic-label { font-size: 11px; color: ${theme.textSecondary}; margin-top: 4px; font-weight: 500; }
    .infographic-desc { font-size: 10px; color: ${theme.textSecondary}; margin-top: 4px; opacity: 0.8; line-height: 1.5; }

    /* Timeline */
    .timeline { display: flex; flex-direction: column; gap: 0; position: relative; padding-right: 28px; }
    .timeline::before {
      content: ''; position: absolute; right: 9px; top: 0; bottom: 0;
      width: 3px; background: linear-gradient(180deg, ${theme.primary}, ${theme.secondary});
      border-radius: 2px;
    }
    .timeline-item { display: flex; gap: 16px; position: relative; padding-bottom: 18px; }
    .timeline-dot {
      width: 18px; height: 18px; border-radius: 50%; background: ${theme.primary};
      border: 3px solid ${theme.background}; position: absolute; right: -28px; top: 2px;
      box-shadow: 0 0 0 4px ${theme.primary}25; z-index: 1;
    }
    .timeline-content { flex: 1; background: ${theme.cardBg}; border: 1px solid ${theme.borderColor}; border-radius: 10px; padding: 12px 16px; }
    .timeline-year { font-size: 12px; font-weight: 800; color: ${theme.primary}; }
    .timeline-title { font-size: 13px; font-weight: 700; color: ${theme.textPrimary}; margin-top: 2px; }
    .timeline-desc { font-size: 11px; color: ${theme.textSecondary}; margin-top: 4px; line-height: 1.6; }

    /* Pillar Cards */
    .pillar-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .pillar-card {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 14px; padding: 20px; text-align: center;
      position: relative; overflow: hidden;
    }
    .pillar-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, ${theme.primary}, ${theme.secondary});
    }
    .pillar-icon {
      width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 12px; font-size: 26px;
      background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd});
      color: ${theme.textLight}; box-shadow: 0 4px 12px ${theme.primary}30;
    }
    .pillar-title { font-size: 14px; font-weight: 800; color: ${theme.textPrimary}; }
    .pillar-desc { font-size: 11px; color: ${theme.textSecondary}; margin-top: 6px; line-height: 1.6; }

    /* Two Column */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

    /* Accent Elements */
    .accent-line { width: 56px; height: 4px; background: linear-gradient(90deg, ${theme.secondary}, ${theme.primary}); border-radius: 2px; }
    .section-number {
      width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
      background: ${theme.primary}; color: ${theme.textLight}; font-size: 14px; font-weight: 800; flex-shrink: 0;
    }

    /* Donut Chart */
    .donut-wrapper { display: flex; align-items: center; justify-content: center; gap: 24px; }
    .donut-legend { display: flex; flex-direction: column; gap: 8px; }
    .donut-legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; }
    .donut-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
  `;
}

// ─── Slide wrapper ───
function slideWrap(theme: SlideTheme, slideNum: number, totalSlides: number, inner: string): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${baseCSS(theme)}</style></head><body><div class="slide">${inner}<div class="slide-footer"><span class="brand">منصة راصد — ${theme.name}</span><span>${slideNum} / ${totalSlides}</span></div></div></body></html>`;
}

// ═══ 10 Slide Templates ═══

function coverSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return slideWrap(theme, num, total, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,${theme.gradientStart},${theme.gradientEnd});color:${theme.textLight};padding:48px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-100px;left:-100px;width:400px;height:400px;background:radial-gradient(circle,${theme.secondary}15,transparent 70%);border-radius:50%;"></div>
      <div style="position:absolute;bottom:-80px;right:-80px;width:300px;height:300px;background:radial-gradient(circle,${theme.accent}10,transparent 70%);border-radius:50%;"></div>
      <div class="accent-line" style="margin-bottom:28px;width:72px;background:${theme.secondary};"></div>
      <h1 style="font-size:40px;font-weight:900;line-height:1.25;max-width:720px;position:relative;z-index:1;">${data.title}</h1>
      ${data.subtitle ? `<p style="font-size:17px;opacity:0.88;margin-top:16px;max-width:600px;line-height:1.6;position:relative;z-index:1;">${data.subtitle}</p>` : ''}
      <div class="accent-line" style="margin-top:28px;width:72px;background:${theme.secondary};"></div>
      <p style="font-size:11px;opacity:0.5;margin-top:36px;position:relative;z-index:1;">منصة راصد البيانات — ${new Date().getFullYear()}</p>
    </div>
  `);
}

function tocSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.bulletPoints || []).map((bp, i) => `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 18px;background:${theme.cardBg};border:1px solid ${theme.borderColor};border-radius:12px;border-right:4px solid ${i % 2 === 0 ? theme.primary : theme.secondary};transition:all 0.2s;">
      <div class="section-number">${String(i + 1).padStart(2, '0')}</div>
      <div>
        <span style="font-size:14px;font-weight:700;color:${theme.textPrimary};">${bp}</span>
      </div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title || 'فهرس المحتويات'}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body" style="gap:10px;">${items}</div>
  `);
}

function executiveSummarySlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const kpis = (data.kpiItems || data.infographicItems || []).slice(0, 4).map(item => `
    <div class="kpi-card" style="flex:1;">
      <div class="kpi-value">${'value' in item ? item.value : ''}</div>
      <div class="kpi-label">${item.label}</div>
      ${'trend' in item && item.trend ? `<div class="kpi-trend ${item.trend}">${item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '—'} ${'change' in item ? item.change : ''}</div>` : ''}
    </div>
  `).join('');
  const bullets = (data.bulletPoints || []).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${kpis ? `<div style="display:flex;gap:14px;">${kpis}</div>` : ''}
      ${data.content ? `<p style="font-size:13px;line-height:1.7;color:${theme.textSecondary};">${data.content}</p>` : ''}
      ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
    </div>
  `);
}

function pillarsSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.pillarItems || data.infographicItems || []).map(item => `
    <div class="pillar-card">
      <div class="pillar-icon"><span class="material-symbols-outlined">${item.icon || 'star'}</span></div>
      <div class="pillar-title">${'title' in item ? item.title : item.label}</div>
      <div class="pillar-desc">${item.description || ''}</div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div class="pillar-grid" style="flex:1;align-content:center;">${items}</div>
    </div>
  `);
}

function chartSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const maxVal = Math.max(...(data.chartData || [1]));
  const defaultColors = [theme.primary, theme.secondary, theme.accent, theme.successColor, theme.warningColor, theme.dangerColor, '#8b5cf6', '#06b6d4'];
  const bars = (data.chartData || []).map((v, i) => {
    const h = Math.max(24, (v / maxVal) * 220);
    const color = (data.chartColors || [])[i] || defaultColors[i % defaultColors.length];
    const label = (data.chartLabels || [])[i] || '';
    return `<div class="chart-bar"><div style="width:100%;height:${h}px;background:linear-gradient(180deg,${color},${color}cc);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;box-shadow:0 -4px 12px ${color}30;"><span class="chart-bar-value">${v}</span></div><span class="chart-bar-label">${label}</span></div>`;
  }).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div class="chart-container">${bars}</div>
    </div>
  `);
}

function tableSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const headers = (data.tableHeaders || []).map(h => `<th>${h}</th>`).join('');
  const rows = (data.tableRows || []).map(row => {
    const cells = Array.isArray(row) ? row : Object.values(row as Record<string, unknown>);
    return `<tr>${cells.map(cell => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`;
  }).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};margin-bottom:4px;">${data.content}</p>` : ''}
      <div style="flex:1;overflow:hidden;border-radius:12px;border:1px solid ${theme.borderColor};">
        <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>
  `);
}

function infographicSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.infographicItems || []).map(item => `
    <div class="infographic-item">
      <div class="infographic-icon"><span class="material-symbols-outlined">${item.icon || 'analytics'}</span></div>
      <div class="infographic-value">${item.value}</div>
      <div class="infographic-label">${item.label}</div>
      ${item.description ? `<div class="infographic-desc">${item.description}</div>` : ''}
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div class="infographic-grid" style="flex:1;align-content:center;">${items}</div>
    </div>
  `);
}

function kpiSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.kpiItems || data.infographicItems || []).slice(0, 4).map(item => `
    <div class="kpi-card" style="flex:1;">
      <div class="kpi-value">${'value' in item ? item.value : ''}</div>
      <div class="kpi-label">${item.label}</div>
      ${'trend' in item && item.trend ? `<div class="kpi-trend ${item.trend}">${item.trend === 'up' ? '▲ +' : item.trend === 'down' ? '▼ -' : '— '}${'change' in item ? item.change : ''}</div>` : ''}
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.7;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div style="display:flex;gap:16px;flex:1;align-items:center;">${items}</div>
    </div>
  `);
}

function timelineSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.timelineItems || []).map((item, i) => `
    <div class="timeline-item">
      <div class="timeline-dot" style="background:${i % 2 === 0 ? theme.primary : theme.secondary};box-shadow:0 0 0 4px ${i % 2 === 0 ? theme.primary : theme.secondary}25;"></div>
      <div class="timeline-content">
        <div class="timeline-year">${item.year}</div>
        <div class="timeline-title">${item.title}</div>
        <div class="timeline-desc">${item.description}</div>
      </div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body"><div class="timeline">${items}</div></div>
  `);
}

function contentSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const bullets = (data.bulletPoints || []).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header">
      <div class="accent-bar"></div>
      <div><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    </div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.8;color:${theme.textSecondary};">${data.content}</p>` : ''}
      ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
    </div>
  `);
}

function closingSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return slideWrap(theme, num, total, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,${theme.gradientStart},${theme.gradientEnd});color:${theme.textLight};padding:48px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;background:radial-gradient(circle,${theme.secondary}12,transparent 70%);border-radius:50%;"></div>
      <div class="accent-line" style="margin-bottom:24px;background:${theme.secondary};"></div>
      <h1 style="font-size:44px;font-weight:900;position:relative;z-index:1;">${data.title || 'شكراً لكم'}</h1>
      ${data.content ? `<p style="font-size:17px;opacity:0.85;margin-top:18px;max-width:520px;line-height:1.7;position:relative;z-index:1;">${data.content}</p>` : ''}
      <div class="accent-line" style="margin-top:24px;background:${theme.secondary};"></div>
      ${data.subtitle ? `<p style="font-size:12px;opacity:0.6;margin-top:28px;position:relative;z-index:1;">${data.subtitle}</p>` : ''}
    </div>
  `);
}

// ─── Layout router ───
function renderSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  switch (data.layout) {
    case 'title': return coverSlide(theme, data, num, total);
    case 'toc': return tocSlide(theme, data, num, total);
    case 'executive-summary': return executiveSummarySlide(theme, data, num, total);
    case 'pillars': return pillarsSlide(theme, data, num, total);
    case 'chart': return chartSlide(theme, data, num, total);
    case 'table': return tableSlide(theme, data, num, total);
    case 'infographic': return infographicSlide(theme, data, num, total);
    case 'kpi': return kpiSlide(theme, data, num, total);
    case 'timeline': return timelineSlide(theme, data, num, total);
    case 'closing': return closingSlide(theme, data, num, total);
    case 'content': return contentSlide(theme, data, num, total);
    case 'two-column': return contentSlide(theme, data, num, total);
    case 'quote': return contentSlide(theme, data, num, total);
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

// ═══ Demo Presentation (10 slides — all types) ═══
export const DEMO_SLIDES: SlideData[] = [
  {
    layout: 'title',
    title: 'استراتيجية البيانات الوطنية 2030',
    subtitle: 'خارطة طريق شاملة لتحويل المملكة العربية السعودية إلى مركز عالمي للبيانات والذكاء الاصطناعي',
    notes: 'هذا العرض يقدم الاستراتيجية الوطنية للبيانات ضمن رؤية 2030',
  },
  {
    layout: 'toc',
    title: 'فهرس المحتويات',
    subtitle: 'محاور العرض الرئيسية',
    bulletPoints: [
      'الملخص التنفيذي والمؤشرات الرئيسية',
      'الركائز الاستراتيجية الأربع',
      'تحليل الأداء والنمو',
      'مقارنة الأداء حسب القطاعات',
      'البنية التحتية للبيانات',
      'المؤشرات الرقمية الرئيسية',
      'خارطة الطريق والمراحل الزمنية',
      'الختام والتوصيات',
    ],
  },
  {
    layout: 'executive-summary',
    title: 'الملخص التنفيذي',
    subtitle: 'أبرز المؤشرات والإنجازات',
    content: 'حققت المملكة تقدماً ملحوظاً في مجال البيانات والتحول الرقمي خلال العام الماضي، حيث ارتفعت نسبة الامتثال لمعايير البيانات المفتوحة بنسبة 23% وتم إطلاق 15 مبادرة جديدة.',
    kpiItems: [
      { label: 'نسبة الامتثال', value: '87%', trend: 'up', change: '23%' },
      { label: 'الجهات المتصلة', value: '156', trend: 'up', change: '34' },
      { label: 'مجموعات البيانات', value: '12,450', trend: 'up', change: '2,100' },
      { label: 'المبادرات النشطة', value: '45', trend: 'flat', change: '' },
    ],
    bulletPoints: [
      'تم ربط 156 جهة حكومية بمنصة البيانات الوطنية',
      'إطلاق 15 مبادرة جديدة في مجال الذكاء الاصطناعي',
      'تحسين جودة البيانات بنسبة 40% عبر أدوات التنظيف الآلي',
    ],
  },
  {
    layout: 'pillars',
    title: 'الركائز الاستراتيجية',
    subtitle: 'أربع ركائز أساسية لتحقيق الرؤية',
    content: 'تقوم الاستراتيجية على أربع ركائز متكاملة تضمن تحقيق الأهداف المرجوة بكفاءة عالية.',
    pillarItems: [
      { icon: 'security', title: 'حوكمة البيانات', description: 'إطار تنظيمي شامل يضمن جودة وأمن البيانات عبر جميع الجهات الحكومية' },
      { icon: 'hub', title: 'البنية التحتية', description: 'منصات سحابية متطورة وشبكات ربط عالية السرعة لتبادل البيانات' },
      { icon: 'psychology', title: 'الذكاء الاصطناعي', description: 'تطبيقات ذكية لتحليل البيانات واستخراج الرؤى واتخاذ القرارات' },
      { icon: 'school', title: 'بناء القدرات', description: 'برامج تدريبية متخصصة لتأهيل الكوادر الوطنية في علوم البيانات' },
    ],
  },
  {
    layout: 'chart',
    title: 'تحليل النمو السنوي',
    subtitle: 'معدل نمو مجموعات البيانات المفتوحة (2020-2026)',
    content: 'شهدت مجموعات البيانات المفتوحة نمواً متسارعاً خلال السنوات الست الماضية، مع تسارع ملحوظ بعد 2023.',
    chartData: [2400, 3800, 5200, 7100, 9300, 11200, 12450],
    chartLabels: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'],
  },
  {
    layout: 'table',
    title: 'مقارنة الأداء حسب القطاعات',
    subtitle: 'تقييم شامل لمستوى نضج البيانات',
    content: 'يوضح الجدول التالي مستوى نضج البيانات في القطاعات الرئيسية مع مؤشرات الأداء.',
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
    layout: 'infographic',
    title: 'البنية التحتية للبيانات',
    subtitle: 'إحصائيات المنصة الوطنية',
    content: 'تمتلك المنصة الوطنية للبيانات بنية تحتية متطورة تخدم جميع الجهات الحكومية.',
    infographicItems: [
      { icon: 'cloud', label: 'سعة التخزين السحابي', value: '50 PB', description: 'موزعة على 3 مراكز بيانات' },
      { icon: 'api', label: 'واجهات برمجية نشطة', value: '1,240', description: 'متاحة للمطورين والجهات' },
      { icon: 'speed', label: 'معالجة يومية', value: '8.5M', description: 'طلب معالجة بيانات يومياً' },
      { icon: 'verified_user', label: 'نسبة الأمان', value: '99.97%', description: 'وقت التشغيل السنوي' },
    ],
  },
  {
    layout: 'kpi',
    title: 'المؤشرات الرقمية الرئيسية',
    subtitle: 'أداء الربع الأول 2026',
    content: 'تظهر المؤشرات تحسناً ملحوظاً في جميع المجالات مقارنة بالربع السابق.',
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
      { year: 'Q1 2026', title: 'إطلاق المنصة المحدثة', description: 'نشر الإصدار 3.0 مع واجهة مستخدم جديدة ومحركات ذكاء اصطناعي متطورة' },
      { year: 'Q2 2026', title: 'التكامل مع الجهات', description: 'ربط 50 جهة حكومية إضافية وتفعيل تبادل البيانات الآلي' },
      { year: 'Q3 2026', title: 'إطلاق سوق البيانات', description: 'منصة لتبادل مجموعات البيانات بين القطاعين العام والخاص' },
      { year: 'Q4 2026', title: 'الذكاء الاصطناعي التوليدي', description: 'دمج نماذج AI متقدمة لتحليل البيانات وتوليد التقارير تلقائياً' },
      { year: 'Q1 2027', title: 'التوسع الإقليمي', description: 'شراكات مع دول الخليج لتبادل البيانات والخبرات' },
    ],
  },
  {
    layout: 'closing',
    title: 'شكراً لكم',
    content: 'نتطلع لشراكتكم في بناء مستقبل البيانات في المملكة العربية السعودية',
    subtitle: 'منصة راصد — مكتب إدارة البيانات الوطنية',
  },
];
