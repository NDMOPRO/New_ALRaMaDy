/* ═══════════════════════════════════════════════════════════════════
   ElementPreview — Visual Preview Renderer for Library Elements
   
   Priority rendering order:
   1. If htmlTemplate exists → render via srcdoc iframe (actual 1280x720 HTML)
   2. Otherwise → fallback to simple SVG/HTML mini preview
   ═══════════════════════════════════════════════════════════════════ */
import { useRef, useEffect, useState } from 'react';
import MaterialIcon from './MaterialIcon';

interface ElementPreviewProps {
  elementType: string;
  designTemplate: {
    layout?: string;
    columns?: number;
    rows?: number;
    colorScheme?: string[];
    typography?: { headingSize?: number; bodySize?: number; fontWeight?: string };
    spacing?: { padding?: number; gap?: number; borderRadius?: number };
    borders?: { width?: number; color?: string; style?: string };
    background?: { type?: string; color?: string; gradient?: string };
    elements?: string[];
    sampleData?: {
      headers?: string[];
      rows?: string[][];
      labels?: string[];
      values?: number[];
      items?: { label: string; value: string; icon: string; color: string }[];
      title?: string;
      subtitle?: string;
    };
  };
  name: string;
  className?: string;
  /** Full HTML template code (1280x720 slide) — if present, renders via iframe */
  htmlTemplate?: string | null;
}

/* ─── HTML Template Renderer (iframe with srcdoc) ─────────────── */
function HtmlTemplatePreview({ html, className = '' }: { html: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        // Scale 1280px slide to fit container width
        setScale(containerWidth / 1280);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: '16/9' }}
    >
      <iframe
        srcDoc={html}
        title="Element Preview"
        sandbox="allow-scripts"
        style={{
          width: '1280px',
          height: '720px',
          transform: `scale(${scale})`,
          transformOrigin: 'top right',
          border: 'none',
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          right: 0,
        }}
        tabIndex={-1}
      />
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function ElementPreview({ elementType, designTemplate, name, className = '', htmlTemplate }: ElementPreviewProps) {
  // Priority 1: If we have an HTML template, render it via iframe
  if (htmlTemplate) {
    return <HtmlTemplatePreview html={htmlTemplate} className={className} />;
  }

  // Priority 2: Fallback to simple SVG/HTML mini preview
  const dt = designTemplate || {};
  const colors = dt.colorScheme || ['#0f2744', '#1a5276', '#2980b9', '#d4af37', '#27ae60'];
  const sd = dt.sampleData || {};
  const bg = dt.background || {};
  const spacing = dt.spacing || {};

  const containerStyle: React.CSSProperties = {
    background: bg.gradient && bg.gradient !== '' ? bg.gradient : (bg.color || '#ffffff'),
    borderRadius: spacing.borderRadius || 8,
    padding: 12,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: '"Tajawal", "Noto Sans Arabic", sans-serif',
    direction: 'rtl',
    position: 'relative',
  };

  // ─── Table Preview ─────────────────────────────────────────────
  if (elementType === 'table' || elementType === 'data_table') {
    const headers = sd.headers?.slice(0, 4) || ['العمود ١', 'العمود ٢', 'العمود ٣'];
    const rows = sd.rows?.slice(0, 3) || [['بيانات', 'قيمة', '٪٨٥'], ['بيانات', 'قيمة', '٪٧٢']];
    return (
      <div style={containerStyle} className={className}>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors[0], marginBottom: 6, textAlign: 'center' }}>
          {sd.title || name}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ background: colors[0], color: '#fff', padding: '3px 4px', textAlign: 'center', fontWeight: 600, borderBottom: `2px solid ${colors[3] || colors[0]}`, fontSize: 7 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.slice(0, headers.length).map((cell, ci) => (
                  <td key={ci} style={{ padding: '2px 4px', textAlign: 'center', borderBottom: '1px solid #e8e8e8', background: ri % 2 === 0 ? '#f8f9fa' : '#fff', fontSize: 7, color: '#333' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── Chart Preview (Bar) ───────────────────────────────────────
  if (elementType === 'chart' || elementType === 'horizontal_bars' || elementType === 'circular_gauge') {
    const labels = sd.labels?.slice(0, 5) || ['فئة ١', 'فئة ٢', 'فئة ٣', 'فئة ٤'];
    const values = sd.values?.slice(0, 5) || [85, 72, 60, 45];
    const maxVal = Math.max(...values, 1);
    return (
      <div style={containerStyle} className={className}>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors[0], marginBottom: 6, textAlign: 'center' }}>{sd.title || name}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          {labels.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 7, color: '#555', width: 40, textAlign: 'left', flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>{label}</span>
              <div style={{ flex: 1, height: 10, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(values[i] / maxVal) * 100}%`, height: '100%', background: colors[i % colors.length], borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 7, color: colors[0], fontWeight: 600, width: 20, textAlign: 'right' }}>{values[i]}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── KPI Card Preview ──────────────────────────────────────────
  if (elementType === 'kpi_card' || elementType === 'kpi') {
    const items = sd.items?.slice(0, 4) || [
      { label: 'مؤشر ١', value: '٨٥٪', icon: 'trending_up', color: colors[0] },
      { label: 'مؤشر ٢', value: '٧٢٪', icon: 'speed', color: colors[1] },
      { label: 'مؤشر ٣', value: '٩١٪', icon: 'check_circle', color: colors[4] || colors[2] },
    ];
    return (
      <div style={containerStyle} className={className}>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors[0], marginBottom: 6, textAlign: 'center' }}>{sd.title || name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`, gap: 4, flex: 1, alignContent: 'center' }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: '#f8f9fa', borderRadius: 6, padding: '6px 4px', textAlign: 'center', border: `1px solid ${item.color || colors[i % colors.length]}20`, borderTop: `3px solid ${item.color || colors[i % colors.length]}` }}>
              <MaterialIcon icon={item.icon || 'analytics'} size={14} style={{ color: item.color || colors[i % colors.length] }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: item.color || colors[i % colors.length], marginTop: 2 }}>{item.value}</div>
              <div style={{ fontSize: 6, color: '#666', marginTop: 1 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Infographic Preview ───────────────────────────────────────
  if (elementType === 'infographic') {
    const items = sd.items?.slice(0, 4) || [
      { label: 'عنصر ١', value: 'وصف', icon: 'lightbulb', color: colors[0] },
      { label: 'عنصر ٢', value: 'وصف', icon: 'groups', color: colors[1] },
      { label: 'عنصر ٣', value: 'وصف', icon: 'trending_up', color: colors[2] },
    ];
    return (
      <div style={containerStyle} className={className}>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors[0], marginBottom: 6, textAlign: 'center' }}>{sd.title || name}</div>
        <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${item.color || colors[i % colors.length]}15`, border: `2px solid ${item.color || colors[i % colors.length]}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcon icon={item.icon || 'star'} size={14} style={{ color: item.color || colors[i % colors.length] }} />
              </div>
              <span style={{ fontSize: 6, color: '#333', textAlign: 'center', fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Process Flow Preview ──────────────────────────────────────
  if (elementType === 'process_flow') {
    const items = sd.items?.slice(0, 4) || [
      { label: 'خطوة ١', value: '', icon: 'play_arrow', color: colors[0] },
      { label: 'خطوة ٢', value: '', icon: 'settings', color: colors[1] },
      { label: 'خطوة ٣', value: '', icon: 'check', color: colors[4] || colors[2] },
    ];
    return (
      <div style={containerStyle} className={className}>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors[0], marginBottom: 6, textAlign: 'center' }}>{sd.title || name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: item.color || colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <MaterialIcon icon={item.icon || 'arrow_forward'} size={12} style={{ color: '#fff' }} />
                <span style={{ fontSize: 5, color: '#fff', marginTop: 1 }}>{item.label}</span>
              </div>
              {i < items.length - 1 && <MaterialIcon icon="arrow_back" size={10} style={{ color: colors[0], opacity: 0.4 }} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Cover Preview ─────────────────────────────────────────────
  if (elementType === 'cover') {
    return (
      <div style={{ ...containerStyle, background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`, justifyContent: 'center', alignItems: 'center' }} className={className}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${colors[3] || '#d4af37'}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          <MaterialIcon icon="star" size={12} style={{ color: colors[3] || '#d4af37' }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{sd.title || name}</div>
        {sd.subtitle && <div style={{ fontSize: 7, color: '#ffffff90', marginTop: 3, textAlign: 'center' }}>{sd.subtitle}</div>}
      </div>
    );
  }

  // ─── Default / Text Block Preview ──────────────────────────────
  return (
    <div style={containerStyle} className={className}>
      <div style={{ fontSize: 10, fontWeight: 700, color: colors[0], marginBottom: 6, textAlign: 'center' }}>{sd.title || name}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
        {(sd.items || []).slice(0, 4).map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7, color: '#444' }}>
            <MaterialIcon icon={item.icon || 'circle'} size={10} style={{ color: item.color || colors[i % colors.length] }} />
            <span>{item.label}</span>
          </div>
        ))}
        {(!sd.items || sd.items.length === 0) && (
          <>
            <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3, width: '90%' }} />
            <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3, width: '75%' }} />
            <div style={{ height: 6, background: '#e8e8e8', borderRadius: 3, width: '60%' }} />
          </>
        )}
      </div>
    </div>
  );
}
