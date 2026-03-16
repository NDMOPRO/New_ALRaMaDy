// ═══════════════════════════════════════════════════════════════
// Rasid — Professional HTML Slide Templates
// Like Gamma.app — each slide is a standalone HTML page
// ═══════════════════════════════════════════════════════════════

export interface SlideTheme {
  id: string;
  name: string;
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
}

export const THEMES: Record<string, SlideTheme> = {
  ndmo: {
    id: 'ndmo', name: 'مكتب إدارة البيانات الوطنية',
    primary: '#0f2744', secondary: '#d4af37', accent: '#1a73e8',
    background: '#ffffff', cardBg: '#f8fafc',
    textPrimary: '#0f172a', textSecondary: '#475569', textLight: '#ffffff',
    fontHeading: "'DIN Next Arabic', 'Tajawal', sans-serif",
    fontBody: "'Tajawal', 'Helvetica Neue Arabic', sans-serif",
    gradientStart: '#0f2744', gradientEnd: '#1a3a6b',
    borderColor: '#e2e8f0', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
  },
  sdaia: {
    id: 'sdaia', name: 'سدايا',
    primary: '#1a73e8', secondary: '#0f766e', accent: '#6366f1',
    background: '#ffffff', cardBg: '#f0f9ff',
    textPrimary: '#0f172a', textSecondary: '#475569', textLight: '#ffffff',
    fontHeading: "'DIN Next Arabic', 'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#1a73e8', gradientEnd: '#0f766e',
    borderColor: '#dbeafe', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
  },
  modern: {
    id: 'modern', name: 'عصري احترافي',
    primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899',
    background: '#ffffff', cardBg: '#faf5ff',
    textPrimary: '#1e1b4b', textSecondary: '#6b7280', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#6366f1', gradientEnd: '#a855f7',
    borderColor: '#e9d5ff', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
  },
  minimal: {
    id: 'minimal', name: 'بسيط ونظيف',
    primary: '#1f2937', secondary: '#6b7280', accent: '#3b82f6',
    background: '#ffffff', cardBg: '#f9fafb',
    textPrimary: '#111827', textSecondary: '#6b7280', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#1f2937', gradientEnd: '#374151',
    borderColor: '#e5e7eb', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
  },
  creative: {
    id: 'creative', name: 'إبداعي',
    primary: '#dc2626', secondary: '#f59e0b', accent: '#10b981',
    background: '#fffbeb', cardBg: '#fef3c7',
    textPrimary: '#1c1917', textSecondary: '#78716c', textLight: '#ffffff',
    fontHeading: "'Tajawal', sans-serif",
    fontBody: "'Tajawal', sans-serif",
    gradientStart: '#dc2626', gradientEnd: '#f59e0b',
    borderColor: '#fde68a', successColor: '#059669', warningColor: '#d97706', dangerColor: '#dc2626',
  },
};

export interface SlideData {
  title: string;
  subtitle?: string;
  content?: string;
  bulletPoints?: string[];
  notes?: string;
  layout: string;
  chartType?: string;
  chartData?: number[];
  chartLabels?: string[];
  chartColors?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  infographicItems?: Array<{ icon: string; label: string; value: string }>;
  timelineItems?: Array<{ year: string; title: string; description: string }>;
  style?: { backgroundColor?: string; titleColor?: string; textColor?: string };
}

// ─── Base CSS for all slides ───
function baseCSS(theme: SlideTheme): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=DIN+Next+Arabic:wght@300;400;500;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 960px; height: 540px; overflow: hidden; direction: rtl; }
    .slide {
      width: 960px; height: 540px; position: relative; overflow: hidden;
      font-family: ${theme.fontBody}; color: ${theme.textPrimary};
      background: ${theme.background}; display: flex; flex-direction: column;
    }
    h1, h2, h3 { font-family: ${theme.fontHeading}; }
    .slide-header {
      background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd});
      color: ${theme.textLight}; padding: 16px 40px; display: flex; align-items: center; gap: 16px;
    }
    .slide-header h2 { font-size: 22px; font-weight: 700; }
    .slide-header .subtitle { font-size: 13px; opacity: 0.8; }
    .slide-body { flex: 1; padding: 24px 40px; display: flex; flex-direction: column; gap: 16px; }
    .slide-footer {
      height: 32px; padding: 0 40px; display: flex; align-items: center; justify-content: space-between;
      font-size: 10px; color: ${theme.textSecondary}; border-top: 1px solid ${theme.borderColor};
    }
    .card {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 12px; padding: 16px;
    }
    .kpi-card {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 12px; padding: 16px; text-align: center;
      border-top: 3px solid ${theme.primary};
    }
    .kpi-value { font-size: 28px; font-weight: 800; color: ${theme.primary}; }
    .kpi-label { font-size: 11px; color: ${theme.textSecondary}; margin-top: 4px; }
    .accent-line { width: 48px; height: 3px; background: ${theme.secondary}; border-radius: 2px; }
    .bullet-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .bullet-list li {
      padding: 8px 16px; padding-right: 28px; position: relative; font-size: 13px; line-height: 1.6;
      background: ${theme.cardBg}; border-radius: 8px; border: 1px solid ${theme.borderColor};
    }
    .bullet-list li::before {
      content: ''; position: absolute; right: 12px; top: 14px;
      width: 6px; height: 6px; border-radius: 50%; background: ${theme.secondary};
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: ${theme.primary}; color: ${theme.textLight};
      padding: 10px 12px; text-align: right; font-weight: 700; font-size: 11px;
    }
    td {
      padding: 8px 12px; border-bottom: 1px solid ${theme.borderColor};
      text-align: right; font-size: 11px;
    }
    tr:nth-child(even) td { background: ${theme.cardBg}; }
    .chart-container { flex: 1; display: flex; align-items: flex-end; gap: 12px; padding: 16px 0; }
    .chart-bar {
      flex: 1; border-radius: 6px 6px 0 0; position: relative; display: flex;
      flex-direction: column; align-items: center; justify-content: flex-end; min-width: 40px;
    }
    .chart-bar-value { font-size: 11px; font-weight: 700; color: ${theme.textLight}; padding: 4px 0; }
    .chart-bar-label { font-size: 10px; color: ${theme.textSecondary}; margin-top: 6px; text-align: center; }
    .infographic-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .infographic-item {
      background: ${theme.cardBg}; border: 1px solid ${theme.borderColor};
      border-radius: 12px; padding: 16px; text-align: center;
      border-top: 3px solid ${theme.accent};
    }
    .infographic-icon {
      width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center;
      justify-content: center; margin: 0 auto 8px; font-size: 20px;
      background: linear-gradient(135deg, ${theme.primary}15, ${theme.accent}15);
      color: ${theme.primary};
    }
    .infographic-value { font-size: 22px; font-weight: 800; color: ${theme.primary}; }
    .infographic-label { font-size: 11px; color: ${theme.textSecondary}; margin-top: 4px; }
    .timeline { display: flex; flex-direction: column; gap: 0; position: relative; padding-right: 24px; }
    .timeline::before {
      content: ''; position: absolute; right: 7px; top: 0; bottom: 0;
      width: 2px; background: ${theme.borderColor};
    }
    .timeline-item { display: flex; gap: 16px; position: relative; padding-bottom: 16px; }
    .timeline-dot {
      width: 14px; height: 14px; border-radius: 50%; background: ${theme.primary};
      border: 2px solid ${theme.background}; position: absolute; right: -24px; top: 2px;
      box-shadow: 0 0 0 3px ${theme.primary}30; z-index: 1;
    }
    .timeline-content { flex: 1; }
    .timeline-year { font-size: 12px; font-weight: 700; color: ${theme.primary}; }
    .timeline-title { font-size: 13px; font-weight: 600; color: ${theme.textPrimary}; margin-top: 2px; }
    .timeline-desc { font-size: 11px; color: ${theme.textSecondary}; margin-top: 2px; line-height: 1.5; }
    .donut-container { position: relative; width: 120px; height: 120px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  `;
}

// ─── Slide wrapper ───
function slideWrap(theme: SlideTheme, slideNum: number, totalSlides: number, inner: string): string {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${baseCSS(theme)}</style></head><body><div class="slide">${inner}<div class="slide-footer"><span>${theme.name}</span><span>${slideNum} / ${totalSlides}</span></div></div></body></html>`;
}

// ═══ 10 Slide Templates ═══

function coverSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return slideWrap(theme, num, total, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,${theme.gradientStart},${theme.gradientEnd});color:${theme.textLight};padding:48px;">
      <div style="width:64px;height:3px;background:${theme.secondary};border-radius:2px;margin-bottom:24px;"></div>
      <h1 style="font-size:36px;font-weight:800;line-height:1.3;max-width:700px;">${data.title}</h1>
      ${data.subtitle ? `<p style="font-size:16px;opacity:0.85;margin-top:12px;max-width:600px;">${data.subtitle}</p>` : ''}
      <div style="width:64px;height:3px;background:${theme.secondary};border-radius:2px;margin-top:24px;"></div>
      <p style="font-size:12px;opacity:0.6;margin-top:32px;">منصة راصد البيانات</p>
    </div>
  `);
}

function tocSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.bulletPoints || []).map((bp, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:${theme.cardBg};border:1px solid ${theme.borderColor};border-radius:10px;border-right:3px solid ${theme.primary};">
      <div style="width:28px;height:28px;border-radius:8px;background:${theme.primary};color:${theme.textLight};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;shrink:0;">${i+1}</div>
      <span style="font-size:13px;font-weight:500;">${bp}</span>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title || 'فهرس المحتويات'}</h2></div>
    <div class="slide-body" style="gap:8px;">${items}</div>
  `);
}

function kpiSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.infographicItems || []).map(item => `
    <div class="kpi-card">
      <div class="kpi-value">${item.value}</div>
      <div class="kpi-label">${item.label}</div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(${Math.min((data.infographicItems||[]).length, 4)},1fr);gap:12px;flex:1;align-content:center;">${items}</div>
    </div>
  `);
}

function chartSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const maxVal = Math.max(...(data.chartData || [1]));
  const bars = (data.chartData || []).map((v, i) => {
    const h = Math.max(20, (v / maxVal) * 200);
    const color = (data.chartColors || [])[i] || theme.primary;
    const label = (data.chartLabels || [])[i] || '';
    return `<div class="chart-bar"><div style="width:100%;height:${h}px;background:${color};border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center;"><span class="chart-bar-value">${v}</span></div><span class="chart-bar-label">${label}</span></div>`;
  }).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title}</h2></div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div class="chart-container">${bars}</div>
    </div>
  `);
}

function tableSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const headers = (data.tableHeaders || []).map(h => `<th>${h}</th>`).join('');
  const rows = (data.tableRows || []).map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title}</h2></div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};margin-bottom:8px;">${data.content}</p>` : ''}
      <div style="flex:1;overflow:hidden;border-radius:10px;border:1px solid ${theme.borderColor};">
        <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>
  `);
}

function infographicSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.infographicItems || []).map(item => `
    <div class="infographic-item">
      <div class="infographic-icon"><span class="material-symbols-outlined">${item.icon}</span></div>
      <div class="infographic-value">${item.value}</div>
      <div class="infographic-label">${item.label}</div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <div class="slide-header"><h2>${data.title}</h2></div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div class="infographic-grid" style="flex:1;align-content:center;">${items}</div>
    </div>
  `);
}

function timelineSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const items = (data.timelineItems || []).map(item => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-year">${item.year}</div>
        <div class="timeline-title">${item.title}</div>
        <div class="timeline-desc">${item.description}</div>
      </div>
    </div>
  `).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title}</h2></div>
    <div class="slide-body"><div class="timeline">${items}</div></div>
  `);
}

function contentSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const bullets = (data.bulletPoints || []).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title}</h2>${data.subtitle ? `<span class="subtitle">${data.subtitle}</span>` : ''}</div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.7;color:${theme.textSecondary};">${data.content}</p>` : ''}
      ${bullets ? `<ul class="bullet-list">${bullets}</ul>` : ''}
    </div>
  `);
}

function twoColumnSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  const bps = data.bulletPoints || [];
  const mid = Math.ceil(bps.length / 2);
  const left = bps.slice(0, mid).map(bp => `<li>${bp}</li>`).join('');
  const right = bps.slice(mid).map(bp => `<li>${bp}</li>`).join('');
  return slideWrap(theme, num, total, `
    <div class="slide-header"><h2>${data.title}</h2></div>
    <div class="slide-body">
      ${data.content ? `<p style="font-size:13px;line-height:1.6;color:${theme.textSecondary};">${data.content}</p>` : ''}
      <div class="two-col" style="flex:1;">
        <ul class="bullet-list">${left}</ul>
        <ul class="bullet-list">${right}</ul>
      </div>
    </div>
  `);
}

function closingSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  return slideWrap(theme, num, total, `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,${theme.gradientStart},${theme.gradientEnd});color:${theme.textLight};padding:48px;">
      <h1 style="font-size:40px;font-weight:800;">${data.title || 'شكراً لكم'}</h1>
      ${data.content ? `<p style="font-size:16px;opacity:0.8;margin-top:16px;max-width:500px;">${data.content}</p>` : ''}
      <div style="width:48px;height:3px;background:${theme.secondary};border-radius:2px;margin-top:24px;"></div>
    </div>
  `);
}

// ─── Layout router ───
function renderSlide(theme: SlideTheme, data: SlideData, num: number, total: number): string {
  switch (data.layout) {
    case 'title': return coverSlide(theme, data, num, total);
    case 'toc': return tocSlide(theme, data, num, total);
    case 'kpi': return kpiSlide(theme, data, num, total);
    case 'chart': return chartSlide(theme, data, num, total);
    case 'table': return tableSlide(theme, data, num, total);
    case 'infographic': return infographicSlide(theme, data, num, total);
    case 'timeline': return timelineSlide(theme, data, num, total);
    case 'content': return contentSlide(theme, data, num, total);
    case 'two-column': return twoColumnSlide(theme, data, num, total);
    case 'closing': return closingSlide(theme, data, num, total);
    case 'executive-summary': return kpiSlide(theme, data, num, total);
    case 'pillars': return infographicSlide(theme, data, num, total);
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
