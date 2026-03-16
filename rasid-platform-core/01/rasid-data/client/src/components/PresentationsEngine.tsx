/* ═══════════════════════════════════════════════════════════════
   محرك العروض الحقيقي — Real Presentations Engine
   Full slide creation, editing, drag-drop, templates, animations,
   speaker notes, brand kit, export, and AI generation
   ═══════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback, useEffect, createContext, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { trpc } from '@/lib/trpc';
import { useAutoSave, SaveStatusIndicator } from '@/hooks/useAutoSave';
import MaterialIcon from './MaterialIcon';
import ModeSwitcher from './ModeSwitcher';
import { CHARACTERS, PRESENTATION_ACTIONS } from '@/lib/assets';
import { RASED_USAGE } from '@/lib/rasedAssets';
import { useTheme } from '@/contexts/ThemeContext';

// ─── Types ───────────────────────────────────────────────────
export interface SlideElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'shape' | 'chart' | 'table' | 'icon' | 'list';
  x: number; // percentage 0-100
  y: number;
  width: number;
  height: number;
  content: string;
  style: ElementStyle;
  animation?: AnimationConfig;
  locked?: boolean;
  visible?: boolean;
}

export interface ElementStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'right' | 'center' | 'left';
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number;
  fontFamily?: string;
  lineHeight?: number;
  padding?: number;
  // Shape specific
  shapeType?: 'rect' | 'circle' | 'triangle' | 'diamond' | 'arrow' | 'star';
  // Chart specific
  chartType?: 'bar' | 'line' | 'pie' | 'donut';
  chartData?: number[];
  chartLabels?: string[];
  chartColors?: string[];
  // Image
  imageSrc?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  // List
  listItems?: string[];
  listStyle?: 'bullet' | 'number' | 'check';
}

export interface AnimationConfig {
  type: 'fadeIn' | 'slideRight' | 'slideLeft' | 'slideUp' | 'slideDown' | 'zoomIn' | 'zoomOut' | 'bounceIn' | 'rotateIn' | 'flipIn';
  duration: number; // ms
  delay: number; // ms
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

export interface SlideTransition {
  type: 'none' | 'fade' | 'slideRight' | 'slideLeft' | 'slideUp' | 'slideDown' | 'zoom' | 'flip' | 'rotate';
  duration: number;
}

export interface Slide {
  id: string;
  elements: SlideElement[];
  background: SlideBackground;
  transition: SlideTransition;
  notes: string;
  layout: string;
  duration?: number; // auto-advance in ms
}

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
  imageSrc?: string;
}

export interface BrandKit {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  logoUrl?: string;
}

export interface PresentationState {
  slides: Slide[];
  activeSlideIndex: number;
  selectedElementId: string | null;
  brandKit: BrandKit;
  title: string;
  undoStack: Slide[][];
  redoStack: Slide[][];
}

// ─── Utilities ───────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: '#0f2744',
  secondaryColor: '#d4af37',
  accentColor: '#1a73e8',
  backgroundColor: '#ffffff',
  headingFont: 'Cairo, sans-serif',
  bodyFont: 'IBM Plex Sans Arabic, sans-serif',
};

// ─── Template Definitions ────────────────────────────────────
interface TemplateDefinition {
  id: string;
  name: string;
  nameAr: string;
  preview: { from: string; to: string };
  brandKit: Partial<BrandKit>;
  defaultBackground: SlideBackground;
  headingColor: string;
  bodyColor: string;
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'corporate', name: 'Corporate', nameAr: 'رسمي',
    preview: { from: 'from-slate-800', to: 'to-slate-900' },
    brandKit: { primaryColor: '#0f2744', secondaryColor: '#d4af37', accentColor: '#1a73e8', backgroundColor: '#0f2744' },
    defaultBackground: { type: 'gradient', gradientFrom: '#0f2744', gradientTo: '#1a365d', gradientDirection: '135deg' },
    headingColor: '#ffffff', bodyColor: '#cbd5e1',
  },
  {
    id: 'clean', name: 'Clean', nameAr: 'نظيف',
    preview: { from: 'from-gray-50', to: 'to-white' },
    brandKit: { primaryColor: '#1f2937', secondaryColor: '#6b7280', accentColor: '#3b82f6', backgroundColor: '#ffffff' },
    defaultBackground: { type: 'solid', color: '#ffffff' },
    headingColor: '#1f2937', bodyColor: '#6b7280',
  },
  {
    id: 'nature', name: 'Nature', nameAr: 'طبيعة',
    preview: { from: 'from-emerald-800', to: 'to-emerald-900' },
    brandKit: { primaryColor: '#064e3b', secondaryColor: '#34d399', accentColor: '#10b981', backgroundColor: '#064e3b' },
    defaultBackground: { type: 'gradient', gradientFrom: '#064e3b', gradientTo: '#065f46', gradientDirection: '135deg' },
    headingColor: '#ecfdf5', bodyColor: '#a7f3d0',
  },
  {
    id: 'warm', name: 'Warm', nameAr: 'دافئ',
    preview: { from: 'from-orange-50', to: 'to-amber-50' },
    brandKit: { primaryColor: '#92400e', secondaryColor: '#f59e0b', accentColor: '#d97706', backgroundColor: '#fffbeb' },
    defaultBackground: { type: 'gradient', gradientFrom: '#fffbeb', gradientTo: '#fef3c7', gradientDirection: '135deg' },
    headingColor: '#92400e', bodyColor: '#78350f',
  },
  {
    id: 'ocean', name: 'Ocean', nameAr: 'محيط',
    preview: { from: 'from-blue-800', to: 'to-indigo-900' },
    brandKit: { primaryColor: '#1e3a5f', secondaryColor: '#60a5fa', accentColor: '#3b82f6', backgroundColor: '#1e3a5f' },
    defaultBackground: { type: 'gradient', gradientFrom: '#1e3a5f', gradientTo: '#312e81', gradientDirection: '135deg' },
    headingColor: '#dbeafe', bodyColor: '#93c5fd',
  },
  {
    id: 'royal', name: 'Royal', nameAr: 'ملكي',
    preview: { from: 'from-violet-800', to: 'to-purple-900' },
    brandKit: { primaryColor: '#4c1d95', secondaryColor: '#c084fc', accentColor: '#8b5cf6', backgroundColor: '#4c1d95' },
    defaultBackground: { type: 'gradient', gradientFrom: '#4c1d95', gradientTo: '#581c87', gradientDirection: '135deg' },
    headingColor: '#ede9fe', bodyColor: '#c4b5fd',
  },
  {
    id: 'rose', name: 'Rose', nameAr: 'وردي',
    preview: { from: 'from-rose-500', to: 'to-pink-600' },
    brandKit: { primaryColor: '#be123c', secondaryColor: '#fb7185', accentColor: '#f43f5e', backgroundColor: '#be123c' },
    defaultBackground: { type: 'gradient', gradientFrom: '#be123c', gradientTo: '#9d174d', gradientDirection: '135deg' },
    headingColor: '#fff1f2', bodyColor: '#fecdd3',
  },
];

// ─── Default Slides Factory ──────────────────────────────────
function createDefaultSlides(template: TemplateDefinition): Slide[] {
  return [
    {
      id: uid(), layout: 'title', notes: 'مرحباً بالجميع، اليوم سنستعرض نتائج تقييم نضج البيانات الوطنية...',
      background: { ...template.defaultBackground },
      transition: { type: 'fade', duration: 500 },
      elements: [
        { id: uid(), type: 'heading', x: 10, y: 25, width: 80, height: 15, content: 'تقرير نضج البيانات الوطنية', style: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: template.headingColor, fontFamily: 'Cairo, sans-serif' } },
        { id: uid(), type: 'text', x: 20, y: 45, width: 60, height: 8, content: 'الربع الرابع ٢٠٢٥', style: { fontSize: 18, textAlign: 'center', color: template.bodyColor, fontFamily: 'IBM Plex Sans Arabic, sans-serif' } },
        { id: uid(), type: 'shape', x: 35, y: 60, width: 30, height: 0.5, content: '', style: { backgroundColor: template.brandKit.secondaryColor || '#d4af37', shapeType: 'rect', borderRadius: 4 } },
        { id: uid(), type: 'text', x: 25, y: 68, width: 50, height: 6, content: 'مكتب إدارة البيانات الوطنية', style: { fontSize: 13, textAlign: 'center', color: template.bodyColor, opacity: 0.7 } },
      ],
    },
    {
      id: uid(), layout: 'content', notes: 'شمل التقييم ١٧ جهة حكومية رئيسية وأظهرت النتائج تحسناً ملحوظاً...',
      background: { ...template.defaultBackground },
      transition: { type: 'slideRight', duration: 500 },
      elements: [
        { id: uid(), type: 'heading', x: 5, y: 5, width: 90, height: 10, content: 'النتائج الرئيسية', style: { fontSize: 26, fontWeight: 'bold', textAlign: 'right', color: template.headingColor } },
        { id: uid(), type: 'shape', x: 5, y: 16, width: 20, height: 0.4, content: '', style: { backgroundColor: template.brandKit.secondaryColor || '#d4af37', shapeType: 'rect', borderRadius: 4 } },
        { id: uid(), type: 'text', x: 5, y: 22, width: 42, height: 30, content: '١٧', style: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', color: template.brandKit.accentColor || '#1a73e8', backgroundColor: template.brandKit.backgroundColor === '#ffffff' ? '#f1f5f9' : 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 } },
        { id: uid(), type: 'text', x: 5, y: 52, width: 42, height: 6, content: 'جهة حكومية مشمولة', style: { fontSize: 13, textAlign: 'center', color: template.bodyColor } },
        { id: uid(), type: 'text', x: 53, y: 22, width: 42, height: 30, content: '٨٥٪', style: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', color: '#10b981', backgroundColor: template.brandKit.backgroundColor === '#ffffff' ? '#f0fdf4' : 'rgba(16,185,129,0.1)', borderRadius: 12, padding: 16 } },
        { id: uid(), type: 'text', x: 53, y: 52, width: 42, height: 6, content: 'متوسط نسبة الامتثال', style: { fontSize: 13, textAlign: 'center', color: template.bodyColor } },
        { id: uid(), type: 'list', x: 5, y: 64, width: 90, height: 30, content: '', style: { fontSize: 14, color: template.bodyColor, listItems: ['تحسن بنسبة ٨٪ مقارنة بالربع السابق', '٧ جهات حققت مستوى "متقدم"', '٣ جهات تحتاج خطط تحسين عاجلة'], listStyle: 'check' } },
      ],
    },
    {
      id: uid(), layout: 'chart', notes: 'كما نلاحظ في الرسم البياني، هناك تفاوت واضح بين الجهات...',
      background: { ...template.defaultBackground },
      transition: { type: 'slideLeft', duration: 500 },
      elements: [
        { id: uid(), type: 'heading', x: 5, y: 5, width: 90, height: 10, content: 'مستوى الامتثال — تحليل مقارن', style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: template.headingColor } },
        { id: uid(), type: 'chart', x: 5, y: 20, width: 90, height: 65, content: 'bar-chart', style: { chartType: 'bar', chartData: [94, 88, 76, 91, 69, 82, 96, 78, 93, 85], chartLabels: ['المالية', 'الصحة', 'التعليم', 'الاتصالات', 'الزكاة', 'الداخلية', 'السوق', 'الموارد', 'الرقمية', 'التجارة'], chartColors: [template.brandKit.accentColor || '#3b82f6'] } },
      ],
    },
    {
      id: uid(), layout: 'list', notes: 'بناءً على النتائج نوصي بالتالي لتحسين مستوى الامتثال...',
      background: { ...template.defaultBackground },
      transition: { type: 'zoom', duration: 500 },
      elements: [
        { id: uid(), type: 'heading', x: 5, y: 5, width: 90, height: 10, content: 'التوصيات', style: { fontSize: 26, fontWeight: 'bold', textAlign: 'right', color: template.headingColor } },
        { id: uid(), type: 'shape', x: 5, y: 16, width: 20, height: 0.4, content: '', style: { backgroundColor: template.brandKit.secondaryColor || '#d4af37', shapeType: 'rect', borderRadius: 4 } },
        { id: uid(), type: 'list', x: 5, y: 22, width: 90, height: 70, content: '', style: { fontSize: 16, color: template.bodyColor, lineHeight: 2.2, listItems: ['تعزيز برامج التدريب على حوكمة البيانات في جميع الجهات', 'تطوير أنظمة المراقبة الآلية لقياس الامتثال بشكل مستمر', 'إنشاء مركز تميز للبيانات لدعم الجهات المتأخرة', 'تحديث السياسات والمعايير بما يتوافق مع المستجدات', 'تفعيل آليات المساءلة والحوافز لتحسين الأداء'], listStyle: 'number' } },
      ],
    },
    {
      id: uid(), layout: 'closing', notes: 'في الربع القادم سنركز على تنفيذ التوصيات ومتابعة التقدم...',
      background: { ...template.defaultBackground },
      transition: { type: 'fade', duration: 600 },
      elements: [
        { id: uid(), type: 'heading', x: 10, y: 25, width: 80, height: 15, content: 'الخطوات التالية', style: { fontSize: 30, fontWeight: 'bold', textAlign: 'center', color: template.headingColor } },
        { id: uid(), type: 'text', x: 15, y: 42, width: 70, height: 8, content: 'الربع الأول ٢٠٢٦ — خارطة الطريق', style: { fontSize: 16, textAlign: 'center', color: template.bodyColor } },
        { id: uid(), type: 'shape', x: 35, y: 55, width: 30, height: 0.5, content: '', style: { backgroundColor: template.brandKit.secondaryColor || '#d4af37', shapeType: 'rect', borderRadius: 4 } },
        { id: uid(), type: 'text', x: 20, y: 62, width: 60, height: 10, content: 'شكراً لحسن استماعكم', style: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: template.headingColor, opacity: 0.8 } },
        { id: uid(), type: 'text', x: 25, y: 75, width: 50, height: 6, content: 'info@ndmo.gov.sa | ndmo.gov.sa', style: { fontSize: 12, textAlign: 'center', color: template.bodyColor, opacity: 0.5 } },
      ],
    },
  ];
}

// ─── Element Renderers ───────────────────────────────────────
function renderChartElement(el: SlideElement, scale: number) {
  const { chartType, chartData, chartLabels, chartColors } = el.style;
  if (!chartData || !chartLabels) return null;
  const maxVal = Math.max(...chartData);
  const barColor = chartColors?.[0] || '#3b82f6';

  if (chartType === 'bar') {
    return (
      <div className="w-full h-full flex items-end justify-around gap-[2%] px-[3%] pb-[12%] pt-[4%]" style={{ direction: 'ltr' }}>
        {chartData.map((val, i) => (
          <div key={i} className="flex flex-col items-center flex-1 h-full justify-end" style={{ gap: `${2 * scale}px` }}>
            <span style={{ fontSize: `${Math.max(8, 10 * scale)}px`, color: barColor, fontWeight: 'bold' }}>{val}٪</span>
            <div
              className="w-full rounded-t-md transition-all duration-700"
              style={{ height: `${(val / maxVal) * 80}%`, backgroundColor: barColor, opacity: 0.85 + (val / maxVal) * 0.15, minHeight: '4px' }}
            />
            <span className="text-center leading-tight truncate w-full" style={{ fontSize: `${Math.max(6, 8 * scale)}px`, color: 'inherit', opacity: 0.7 }}>
              {chartLabels[i]}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (chartType === 'pie' || chartType === 'donut') {
    const total = chartData.reduce((a, b) => a + b, 0);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
    let cumulative = 0;
    const segments = chartData.map((val, i) => {
      const start = cumulative;
      cumulative += (val / total) * 360;
      return { start, end: cumulative, color: colors[i % colors.length], label: chartLabels[i], value: val };
    });

    const conicGradient = segments.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ');

    return (
      <div className="w-full h-full flex items-center justify-center gap-4">
        <div className="relative" style={{ width: `${60 * scale}%`, aspectRatio: '1' }}>
          <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${conicGradient})` }} />
          {chartType === 'donut' && <div className="absolute inset-[25%] rounded-full bg-inherit" style={{ backgroundColor: 'inherit' }} />}
        </div>
        <div className="flex flex-col gap-1">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-1" style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span style={{ opacity: 0.8 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chartType === 'line') {
    const w = 100;
    const h = 60;
    const points = chartData.map((val, i) => ({
      x: (i / (chartData.length - 1)) * (w - 10) + 5,
      y: h - (val / maxVal) * (h - 15) - 5,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <path d={pathD} fill="none" stroke={barColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={barColor} />
        ))}
      </svg>
    );
  }

  return null;
}

function renderShapeElement(el: SlideElement) {
  const { shapeType, backgroundColor, borderRadius, borderWidth, borderColor, opacity } = el.style;
  const bg = backgroundColor || '#3b82f6';
  const br = borderRadius ?? 0;

  switch (shapeType) {
    case 'circle':
      return <div className="w-full h-full rounded-full" style={{ backgroundColor: bg, opacity: opacity ?? 1, border: borderWidth ? `${borderWidth}px solid ${borderColor || '#000'}` : undefined }} />;
    case 'triangle':
      return (
        <div className="w-full h-full flex items-end justify-center">
          <div style={{ width: 0, height: 0, borderLeft: '50% solid transparent', borderRight: '50% solid transparent', borderBottom: `100% solid ${bg}`, opacity: opacity ?? 1 }} />
        </div>
      );
    case 'diamond':
      return <div className="w-full h-full rotate-45" style={{ backgroundColor: bg, opacity: opacity ?? 1, borderRadius: br }} />;
    default:
      return <div className="w-full h-full" style={{ backgroundColor: bg, opacity: opacity ?? 1, borderRadius: br, border: borderWidth ? `${borderWidth}px solid ${borderColor || '#000'}` : undefined }} />;
  }
}

function renderListElement(el: SlideElement, scale: number) {
  const items = el.style.listItems || [];
  const listStyle = el.style.listStyle || 'bullet';
  const fontSize = (el.style.fontSize || 14) * scale;
  const lineHeight = el.style.lineHeight || 1.8;

  return (
    <div className="w-full h-full overflow-hidden" style={{ color: el.style.color || 'inherit', direction: 'rtl' }}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 animate-stagger-in" style={{ fontSize, lineHeight, animationDelay: `${i * 0.1}s` }}>
          <span className="shrink-0 mt-0.5" style={{ fontSize: fontSize * 0.9 }}>
            {listStyle === 'bullet' ? '•' : listStyle === 'number' ? `${i + 1}.` : '✓'}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide Element Component ─────────────────────────────────
interface SlideElementRendererProps {
  element: SlideElement;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<SlideElement>) => void;
  onDelete: () => void;
  editMode: boolean;
}

function SlideElementRenderer({ element: el, scale, isSelected, onSelect, onUpdate, onDelete, editMode }: SlideElementRendererProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const parentRef = useRef<HTMLElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode || el.locked || isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    setIsDragging(true);
    const parent = elRef.current?.parentElement;
    parentRef.current = parent || null;
    dragStart.current = { x: e.clientX, y: e.clientY, elX: el.x, elY: el.y };
  }, [editMode, el.locked, el.x, el.y, isEditing, onSelect]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode || el.locked) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const parent = elRef.current?.parentElement;
    parentRef.current = parent || null;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: el.width, h: el.height };
  }, [editMode, el.locked, el.width, el.height]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const parent = parentRef.current;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (isDragging) {
        const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
        const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
        onUpdate({ x: Math.max(0, Math.min(100 - el.width, dragStart.current.elX + dx)), y: Math.max(0, Math.min(100 - el.height, dragStart.current.elY + dy)) });
      }
      if (isResizing) {
        const dw = ((e.clientX - resizeStart.current.x) / rect.width) * 100;
        const dh = ((e.clientY - resizeStart.current.y) / rect.height) * 100;
        onUpdate({ width: Math.max(5, resizeStart.current.w - dw), height: Math.max(3, resizeStart.current.h + dh) });
      }
    };
    const handleUp = () => { setIsDragging(false); setIsResizing(false); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging, isResizing, el.width, el.height, onUpdate]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    if (el.type === 'text' || el.type === 'heading') {
      setIsEditing(true);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    setIsEditing(false);
    onUpdate({ content: e.currentTarget.textContent || '' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!isEditing && isSelected) { e.preventDefault(); onDelete(); }
    }
    if (e.key === 'Escape') { setIsEditing(false); }
  };

  const animStyle = el.animation ? {
    animationName: el.animation.type,
    animationDuration: `${el.animation.duration}ms`,
    animationDelay: `${el.animation.delay}ms`,
    animationFillMode: 'both' as const,
    animationTimingFunction: el.animation.easing,
  } : {};

  const renderContent = () => {
    switch (el.type) {
      case 'text':
      case 'heading':
        return (
          <div
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={handleBlur}
            className={`w-full h-full outline-none ${isEditing ? 'ring-1 ring-blue-400/50 rounded' : ''}`}
            style={{
              fontSize: `${(el.style.fontSize || 14) * scale}px`,
              fontWeight: el.style.fontWeight || 'normal',
              fontStyle: el.style.fontStyle || 'normal',
              textDecoration: el.style.textDecoration || 'none',
              textAlign: el.style.textAlign || 'right',
              color: el.style.color || 'inherit',
              backgroundColor: el.style.backgroundColor || 'transparent',
              borderRadius: el.style.borderRadius ? `${el.style.borderRadius}px` : undefined,
              fontFamily: el.style.fontFamily || 'inherit',
              lineHeight: el.style.lineHeight || 1.4,
              padding: el.style.padding ? `${el.style.padding * scale}px` : undefined,
              opacity: el.style.opacity ?? 1,
              direction: 'rtl',
              overflow: 'hidden',
              display: 'flex',
              alignItems: el.style.padding ? 'center' : undefined,
              justifyContent: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'left' ? 'flex-end' : 'flex-start',
            }}
          >
            {el.content}
          </div>
        );
      case 'shape':
        return renderShapeElement(el);
      case 'chart':
        return renderChartElement(el, scale);
      case 'list':
        return renderListElement(el, scale);
      case 'image':
        return (
          <div className="w-full h-full rounded overflow-hidden relative" style={{ opacity: el.style.opacity ?? 1 }}>
            {el.style.imageSrc ? (
              <>
                <img src={el.style.imageSrc} alt="" className="w-full h-full" style={{ objectFit: el.style.objectFit || 'cover' }} />
                {editMode && isSelected && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <MaterialIcon icon="edit" size={20} className="text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => onUpdate({ style: { ...el.style, imageSrc: ev.target?.result as string } });
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                )}
              </>
            ) : (
              <label className="w-full h-full bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40 transition-colors">
                <MaterialIcon icon="add_photo_alternate" size={Math.max(16, 28 * scale)} className="text-muted-foreground/40 mb-1" />
                <span className="text-muted-foreground/50" style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}>اسحب صورة أو انقر</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => onUpdate({ style: { ...el.style, imageSrc: ev.target?.result as string } });
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
            )}
          </div>
        );
      default:
        return <div className="w-full h-full bg-muted/20 rounded" />;
    }
  };

  return (
    <div
      ref={elRef}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`absolute transition-shadow ${editMode && !el.locked ? 'cursor-move' : 'cursor-default'} ${isSelected && editMode ? 'ring-2 ring-blue-500/60 ring-offset-1' : ''} ${isDragging ? 'opacity-80 z-50' : ''}`}
      style={{
        left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`,
        ...animStyle,
      }}
    >
      {renderContent()}
      {/* Resize handle */}
      {isSelected && editMode && !el.locked && (
        <>
          <div onMouseDown={handleResizeMouseDown} className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize border-2 border-white shadow-sm z-10" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm z-10" />
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm z-10" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm z-10" />
        </>
      )}
    </div>
  );
}

// ─── Main Presentations Engine Component ─────────────────────
export default function PresentationsEngine() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Core state
  const [slides, setSlides] = useState<Slide[]>(() => {
    // Start with a single empty title slide
    const template = TEMPLATES[0];
    return [{
      id: uid(), layout: 'title' as const, notes: '',
      background: { ...template.defaultBackground },
      transition: { type: 'fade' as const, duration: 500 },
      elements: [
        { id: uid(), type: 'heading' as const, x: 10, y: 30, width: 80, height: 15, content: '', style: { fontSize: 32, fontWeight: 'bold' as const, textAlign: 'center' as const, color: template.headingColor, fontFamily: 'Cairo, sans-serif' } },
        { id: uid(), type: 'text' as const, x: 20, y: 50, width: 60, height: 8, content: '', style: { fontSize: 18, textAlign: 'center' as const, color: template.bodyColor, fontFamily: 'IBM Plex Sans Arabic, sans-serif' } },
      ],
    }];
  });
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit>({ ...DEFAULT_BRAND_KIT });
  const [activeTemplate, setActiveTemplate] = useState<string>('corporate');

  // UI state
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [editMode, setEditMode] = useState(true);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presSlideIndex, setPresSlideIndex] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAnimations, setShowAnimations] = useState(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [createMode, setCreateMode] = useState<string | null>(null);
  const [dragOverSlide, setDragOverSlide] = useState<number | null>(null);
  const [dragSourceSlide, setDragSourceSlide] = useState<number | null>(null);

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<Slide[][]>([]);
  const [redoStack, setRedoStack] = useState<Slide[][]>([]);

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentPresentationId, setCurrentPresentationId] = useState<number | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState<string | null>(null);
  const [sourceInput, setSourceInput] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [slideCount, setSlideCount] = useState(8);
  const [aiTextOp, setAiTextOp] = useState<string | null>(null);
  const [aiTextResult, setAiTextResult] = useState('');
  const [quizSlideOpen, setQuizSlideOpen] = useState(false);
  const [quizTopic, setQuizTopic] = useState('');
  const [presenterTimer, setPresenterTimer] = useState(0);
  const [showPresenterNotes, setShowPresenterNotes] = useState(true);
  const [slideComments, setSlideComments] = useState<Record<string, string[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [lockedSlides, setLockedSlides] = useState<Set<string>>(new Set());
  const presTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slidesMutation = trpc.ai.generateSlides.useMutation();
  const slidesFromContentMutation = trpc.ai.generateSlidesFromContent.useMutation();
  const textOpMutation = trpc.ai.textOperation.useMutation();
  const quizMutation = trpc.ai.generateQuiz.useMutation();
  const deepResearchMutation = trpc.ai.deepResearch.useMutation();
  const createPresentationMutation = trpc.presentations.create.useMutation();
  const updatePresentationMutation = trpc.presentations.update.useMutation();
  const shareMutation = trpc.presentations.share.useMutation();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Auto-save every 30 seconds
  const { status: saveStatus, lastSaved, save: forceSave } = useAutoSave({
    data: { slides, brandKit, activeTemplate },
    documentId: currentPresentationId,
    onSave: async (data) => {
      if (data.slides.length === 0) return;
      const title = data.slides[0]?.elements?.find((e: any) => e.type === 'heading')?.content || 'عرض بدون عنوان';
      if (currentPresentationId) {
        await updatePresentationMutation.mutateAsync({
          id: currentPresentationId,
          title,
          slides: data.slides,
          theme: data.activeTemplate,
        });
      } else {
        const result = await createPresentationMutation.mutateAsync({
          title,
          slides: data.slides,
          theme: data.activeTemplate,
        });
        if (result?.id) setCurrentPresentationId(result.id);
      }
    },
  });

  const activeSlide = slides[activeSlideIndex];
  const selectedElement = activeSlide?.elements.find(e => e.id === selectedElementId) || null;

  // ─── Undo/Redo ─────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-30), slides.map(s => ({ ...s, elements: s.elements.map(e => ({ ...e, style: { ...e.style } })) }))]);
    setRedoStack([]);
  }, [slides]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, slides]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setSlides(prev);
  }, [undoStack, slides]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, slides]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setSlides(next);
  }, [redoStack, slides]);

  // ─── AI Slide Generation ──────────────────────────────────
  const handleAIGenerateSlides = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await slidesMutation.mutateAsync({ prompt: aiPrompt, slideCount: 5 });
      if (result.slides && result.slides.length > 0) {
        pushUndo();
        const template = TEMPLATES.find(t => t.id === activeTemplate) || TEMPLATES[0];
        const newSlides: Slide[] = result.slides.map((s: any) => ({
          id: uid(),
          layout: s.layout === 'title' ? 'title' : 'blank',
          notes: s.notes || '',
          background: { ...template.defaultBackground },
          transition: { type: 'fade' as const, duration: 500 },
          elements: [
            { id: uid(), type: 'heading' as const, x: 10, y: 10, width: 80, height: 12, content: s.title || '', style: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: template.headingColor } },
            ...(s.subtitle ? [{ id: uid(), type: 'text' as const, x: 10, y: 25, width: 80, height: 8, content: s.subtitle, style: { fontSize: 18, textAlign: 'center', color: template.bodyColor, opacity: 0.7 } }] : []),
            { id: uid(), type: 'text' as const, x: 10, y: 38, width: 80, height: 50, content: s.content || '', style: { fontSize: 16, textAlign: 'right', color: template.bodyColor } },
          ],
        }));
        setSlides(prev => [...prev, ...newSlides]);
        setActiveSlideIndex(slides.length); // Go to first new slide
      }
      setAiPrompt('');
    } catch (e) {
      console.error('AI Slides generation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading, slidesMutation, pushUndo, activeTemplate, slides.length]);

  // ─── Generate Slides from Source Content ───────────────────
  const handleGenerateFromSource = useCallback(async (sourceType: string) => {
    if (aiLoading) return;
    let content = sourceInput;
    
    // Handle file sources
    if (sourceFile && (sourceType === 'pdf' || sourceType === 'data' || sourceType === 'image')) {
      const reader = new FileReader();
      content = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string || '');
        if (sourceType === 'image') reader.readAsDataURL(sourceFile);
        else reader.readAsText(sourceFile);
      });
    }
    
    if (!content.trim()) return;
    setAiLoading(true);
    
    try {
      // For research, first do deep research then generate slides
      if (sourceType === 'research') {
        const research = await deepResearchMutation.mutateAsync({ topic: content, depth: 'detailed' });
        if (research.research) {
          const researchText = `${research.research.title}\n\n${research.research.summary}\n\n${research.research.sections.map((s: any) => `## ${s.heading}\n${s.content}\n${s.keyPoints.map((k: any) => `- ${k}`).join('\n')}`).join('\n\n')}`;
          content = researchText;
        }
      }
      
      // Map frontend source IDs to backend sourceType enum
      const sourceTypeMap: Record<string, string> = {
        prompt: 'text',
        pdf: 'pdf',
        url: 'url',
        data: 'data',
        image: 'text',
        video: 'text',
        json: 'json',
        research: 'research',
      };
      const mappedSourceType = sourceTypeMap[sourceType] || 'text';
      
      const result = await slidesFromContentMutation.mutateAsync({
        content,
        sourceType: mappedSourceType as any,
        slideCount,
      });
      
      if (result.slides && result.slides.length > 0) {
        pushUndo();
        const template = TEMPLATES.find(t => t.id === activeTemplate) || TEMPLATES[0];
        const newSlides: Slide[] = result.slides.map((s: any) => ({
          id: uid(),
          layout: s.layout === 'title' ? 'title' : 'blank',
          notes: s.notes || '',
          background: { ...template.defaultBackground },
          transition: { type: 'fade' as const, duration: 500 },
          elements: [
            { id: uid(), type: 'heading' as const, x: 10, y: 10, width: 80, height: 12, content: s.title || '', style: { fontSize: 28, fontWeight: 'bold' as const, textAlign: 'center' as const, color: template.headingColor } },
            ...(s.subtitle ? [{ id: uid(), type: 'text' as const, x: 10, y: 25, width: 80, height: 8, content: s.subtitle, style: { fontSize: 18, textAlign: 'center' as const, color: template.bodyColor, opacity: 0.7 } }] : []),
            ...(s.bulletPoints && s.bulletPoints.length > 0 
              ? [{ id: uid(), type: 'list' as const, x: 10, y: 35, width: 80, height: 55, content: '', style: { fontSize: 15, color: template.bodyColor, listItems: s.bulletPoints, listStyle: 'bullet' as const } }]
              : [{ id: uid(), type: 'text' as const, x: 10, y: 35, width: 80, height: 55, content: s.content || '', style: { fontSize: 16, textAlign: 'right' as const, color: template.bodyColor } }]
            ),
          ],
        }));
        setSlides(prev => [...prev, ...newSlides]);
        setActiveSlideIndex(slides.length);
      }
      setSourceDialogOpen(null);
      setSourceInput('');
      setSourceFile(null);
      setCreateMode(null);
    } catch (e) {
      console.error('Source generation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [sourceInput, sourceFile, slideCount, aiLoading, slidesFromContentMutation, deepResearchMutation, pushUndo, activeTemplate, slides.length]);

  // ─── AI Text Operations ───────────────────────────────────
  const handleTextOperation = useCallback(async (operation: string, targetLang?: string) => {
    if (!selectedElement || aiLoading) return;
    const text = selectedElement.content;
    if (!text.trim()) return;
    setAiLoading(true);
    try {
      const result = await textOpMutation.mutateAsync({
        text,
        operation: operation as any,
        targetLanguage: targetLang,
      });
      if (result.text) {
        setAiTextResult(result.text);
        setAiTextOp(operation);
      }
    } catch (e) {
      console.error('Text operation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [selectedElement, aiLoading, textOpMutation]);

  const applyTextResult = useCallback(() => {
    if (!selectedElement || !aiTextResult) return;
    pushUndo();
    // Direct state update to avoid forward reference to updateElement
    setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? {
      ...s,
      elements: s.elements.map(e => e.id === selectedElement.id ? { ...e, content: aiTextResult } : e),
    } : s));
    setAiTextOp(null);
    setAiTextResult('');
  }, [selectedElement, aiTextResult, pushUndo, activeSlideIndex]);

  // ─── Generate Speaker Notes for Current Slide ─────────────
  const generateSpeakerNotes = useCallback(async () => {
    if (aiLoading) return;
    const slideContent = activeSlide.elements.map(e => e.content).filter(Boolean).join('\n');
    if (!slideContent.trim()) return;
    setAiLoading(true);
    try {
      const result = await textOpMutation.mutateAsync({
        text: slideContent,
        operation: 'generateNotes',
      });
      if (result.text) {
        // Direct state update to avoid forward reference to updateNotes
        setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, notes: result.text } : s));
      }
    } catch (e) {
      console.error('Notes generation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, activeSlide, textOpMutation, activeSlideIndex]);

  // ─── Quiz/Poll Slide Generation ───────────────────────────
  const handleGenerateQuiz = useCallback(async (type: 'multiple_choice' | 'open' | 'poll') => {
    if (!quizTopic.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await quizMutation.mutateAsync({ topic: quizTopic, questionCount: 3, type });
      if (result.questions && result.questions.length > 0) {
        pushUndo();
        const template = TEMPLATES.find(t => t.id === activeTemplate) || TEMPLATES[0];
        const quizSlides: Slide[] = result.questions.map((q: any, idx: number) => ({
          id: uid(),
          layout: 'quiz',
          notes: `الإجابة الصحيحة: ${q.correctAnswer}`,
          background: { ...template.defaultBackground },
          transition: { type: 'fade' as const, duration: 500 },
          elements: [
            { id: uid(), type: 'heading' as const, x: 5, y: 5, width: 90, height: 10, content: `سؤال ${idx + 1}`, style: { fontSize: 20, fontWeight: 'bold' as const, textAlign: 'right' as const, color: template.headingColor } },
            { id: uid(), type: 'text' as const, x: 5, y: 18, width: 90, height: 15, content: q.question, style: { fontSize: 22, fontWeight: 'bold' as const, textAlign: 'center' as const, color: template.headingColor } },
            ...(q.options && q.options.length > 0 ? [{
              id: uid(), type: 'list' as const, x: 10, y: 40, width: 80, height: 50, content: '',
              style: { fontSize: 18, color: template.bodyColor, listItems: q.options, listStyle: 'number' as const, lineHeight: 2.5 },
            }] : []),
          ],
        }));
        setSlides(prev => [...prev, ...quizSlides]);
        setActiveSlideIndex(slides.length);
      }
      setQuizSlideOpen(false);
      setQuizTopic('');
    } catch (e) {
      console.error('Quiz generation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [quizTopic, aiLoading, quizMutation, pushUndo, activeTemplate, slides.length]);

  // ─── Slide Locking ────────────────────────────────────────
  const toggleSlideLock = useCallback((slideId: string) => {
    setLockedSlides(prev => {
      const next = new Set(prev);
      if (next.has(slideId)) next.delete(slideId);
      else next.add(slideId);
      return next;
    });
  }, []);

  // ─── Comments ─────────────────────────────────────────────
  const addComment = useCallback(() => {
    if (!commentInput.trim()) return;
    const slideId = activeSlide.id;
    setSlideComments(prev => ({
      ...prev,
      [slideId]: [...(prev[slideId] || []), commentInput],
    }));
    setCommentInput('');
  }, [commentInput, activeSlide.id]);

  // ─── Presenter Timer ──────────────────────────────────────
  useEffect(() => {
    if (presentationMode) {
      setPresenterTimer(0);
      presTimerRef.current = setInterval(() => setPresenterTimer(t => t + 1), 1000);
    } else {
      if (presTimerRef.current) clearInterval(presTimerRef.current);
    }
    return () => { if (presTimerRef.current) clearInterval(presTimerRef.current); };
  }, [presentationMode]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Export to PDF ────────────────────────────────────────
  const exportToPDF = useCallback(async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    
    slides.forEach((slide, idx) => {
      if (idx > 0) pdf.addPage();
      // Background
      const bg = slide.background;
      if (bg.type === 'solid' && bg.color) {
        const hex = bg.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, pageW, pageH, 'F');
      } else if (bg.type === 'gradient' && bg.gradientFrom) {
        const hex = bg.gradientFrom.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, pageW, pageH, 'F');
      }
      // Elements
      slide.elements.forEach(el => {
        const x = (el.x / 100) * pageW;
        const y = (el.y / 100) * pageH;
        const w = (el.width / 100) * pageW;
        if (el.type === 'heading' || el.type === 'text') {
          const hex = (el.style.color || '#000000').replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          pdf.setTextColor(r, g, b);
          pdf.setFontSize(el.style.fontSize ? el.style.fontSize * 0.7 : 12);
          const lines = pdf.splitTextToSize(el.content || '', w);
          pdf.text(lines, x + w / 2, y + 5, { align: 'center' });
        } else if (el.type === 'list' && el.style.listItems) {
          const hex = (el.style.color || '#000000').replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          pdf.setTextColor(r, g, b);
          pdf.setFontSize(el.style.fontSize ? el.style.fontSize * 0.6 : 10);
          el.style.listItems.forEach((item, i) => {
            pdf.text(`${i + 1}. ${item}`, x + w - 5, y + 5 + i * 7, { align: 'right' });
          });
        }
      });
    });
    pdf.save('عرض-تقديمي.pdf');
  }, [slides]);

  // ─── Export Slides as Images ───────────────────────────────
  const exportAsImages = useCallback(async () => {
    // Create a canvas for each slide and download
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      
      // Background
      if (slide.background.type === 'solid') {
        ctx.fillStyle = slide.background.color || '#ffffff';
      } else if (slide.background.gradientFrom && slide.background.gradientTo) {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, slide.background.gradientFrom);
        grad.addColorStop(1, slide.background.gradientTo);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Elements (text only for now)
      slide.elements.forEach(el => {
        if (el.type === 'heading' || el.type === 'text') {
          ctx.fillStyle = el.style.color || '#000000';
          ctx.font = `${el.style.fontWeight === 'bold' ? 'bold ' : ''}${(el.style.fontSize || 14) * 2}px Cairo, sans-serif`;
          ctx.textAlign = (el.style.textAlign as CanvasTextAlign) || 'center';
          const x = (el.x / 100) * canvas.width + (el.width / 100) * canvas.width / 2;
          const y = (el.y / 100) * canvas.height + (el.height / 100) * canvas.height / 2;
          ctx.fillText(el.content || '', x, y);
        }
      });
      
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slide-${i + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [slides]);

  // ─── Slide Operations ──────────────────────────────────────
  const addSlide = useCallback((afterIndex?: number) => {
    pushUndo();
    const template = TEMPLATES.find(t => t.id === activeTemplate) || TEMPLATES[0];
    const newSlide: Slide = {
      id: uid(), layout: 'blank', notes: '',
      background: { ...template.defaultBackground },
      transition: { type: 'fade', duration: 500 },
      elements: [
        { id: uid(), type: 'heading', x: 10, y: 15, width: 80, height: 12, content: 'عنوان الشريحة', style: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: template.headingColor } },
        { id: uid(), type: 'text', x: 10, y: 35, width: 80, height: 50, content: 'أضف المحتوى هنا...', style: { fontSize: 16, textAlign: 'right', color: template.bodyColor } },
      ],
    };
    const idx = afterIndex !== undefined ? afterIndex + 1 : slides.length;
    setSlides(prev => [...prev.slice(0, idx), newSlide, ...prev.slice(idx)]);
    setActiveSlideIndex(idx);
  }, [slides, pushUndo, activeTemplate]);

  const duplicateSlide = useCallback((index: number) => {
    pushUndo();
    const clone: Slide = JSON.parse(JSON.stringify(slides[index]));
    clone.id = uid();
    clone.elements = clone.elements.map(e => ({ ...e, id: uid() }));
    setSlides(prev => [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)]);
    setActiveSlideIndex(index + 1);
  }, [slides, pushUndo]);

  const deleteSlide = useCallback((index: number) => {
    if (slides.length <= 1) return;
    pushUndo();
    setSlides(prev => prev.filter((_, i) => i !== index));
    setActiveSlideIndex(Math.min(index, slides.length - 2));
  }, [slides, pushUndo]);

  const moveSlide = useCallback((from: number, to: number) => {
    if (from === to) return;
    pushUndo();
    setSlides(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setActiveSlideIndex(to);
  }, [pushUndo]);

  // ─── Element Operations ────────────────────────────────────
  const updateElement = useCallback((elementId: string, updates: Partial<SlideElement>) => {
    setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? {
      ...s,
      elements: s.elements.map(e => e.id === elementId ? { ...e, ...updates, style: updates.style ? { ...e.style, ...updates.style } : e.style } : e),
    } : s));
  }, [activeSlideIndex]);

  const deleteElement = useCallback((elementId: string) => {
    pushUndo();
    setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, elements: s.elements.filter(e => e.id !== elementId) } : s));
    setSelectedElementId(null);
  }, [activeSlideIndex, pushUndo]);

  const addElement = useCallback((type: SlideElement['type'], extraStyle?: Partial<ElementStyle>) => {
    pushUndo();
    const template = TEMPLATES.find(t => t.id === activeTemplate) || TEMPLATES[0];
    const defaults: Record<string, Partial<SlideElement>> = {
      text: { x: 15, y: 40, width: 70, height: 15, content: 'نص جديد', style: { fontSize: 16, textAlign: 'right', color: template.bodyColor, ...extraStyle } },
      heading: { x: 10, y: 10, width: 80, height: 12, content: 'عنوان جديد', style: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: template.headingColor, ...extraStyle } },
      shape: { x: 30, y: 30, width: 20, height: 20, content: '', style: { shapeType: 'rect', backgroundColor: brandKit.accentColor, borderRadius: 8, ...extraStyle } },
      image: { x: 20, y: 20, width: 40, height: 40, content: '', style: { objectFit: 'cover', ...extraStyle } },
      chart: { x: 10, y: 20, width: 80, height: 60, content: 'bar-chart', style: { chartType: 'bar', chartData: [75, 88, 92, 69, 85], chartLabels: ['أ', 'ب', 'ج', 'د', 'هـ'], chartColors: [brandKit.accentColor], ...extraStyle } },
      list: { x: 10, y: 25, width: 80, height: 50, content: '', style: { fontSize: 15, color: template.bodyColor, listItems: ['عنصر أول', 'عنصر ثاني', 'عنصر ثالث'], listStyle: 'bullet', ...extraStyle } },
      icon: { x: 40, y: 40, width: 10, height: 10, content: 'star', style: { color: brandKit.accentColor, fontSize: 32, ...extraStyle } },
    };
    const d = defaults[type] || defaults.text;
    const newEl: SlideElement = { id: uid(), type, x: d.x!, y: d.y!, width: d.width!, height: d.height!, content: d.content!, style: d.style as ElementStyle };
    setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s));
    setSelectedElementId(newEl.id);
    setShowInsertMenu(false);
  }, [activeSlideIndex, pushUndo, brandKit, activeTemplate]);

  // ─── Template Application ──────────────────────────────────
  const applyTemplate = useCallback((templateId: string) => {
    pushUndo();
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    setActiveTemplate(templateId);
    setBrandKit(prev => ({ ...prev, ...template.brandKit }));
    setSlides(prev => prev.map(slide => ({
      ...slide,
      background: { ...template.defaultBackground },
      elements: slide.elements.map(el => {
        if (el.type === 'heading') return { ...el, style: { ...el.style, color: template.headingColor } };
        if (el.type === 'text') return { ...el, style: { ...el.style, color: template.bodyColor } };
        if (el.type === 'list') return { ...el, style: { ...el.style, color: template.bodyColor } };
        if (el.type === 'chart') return { ...el, style: { ...el.style, chartColors: [template.brandKit.accentColor || '#3b82f6'] } };
        return el;
      }),
    })));
    setShowTemplates(false);
  }, [pushUndo]);

  // ─── Update Slide Notes ────────────────────────────────────
  const updateNotes = useCallback((notes: string) => {
    setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, notes } : s));
  }, [activeSlideIndex]);

  // ─── Slide Drag & Drop Reorder ─────────────────────────────
  const handleSlideDragStart = (e: React.DragEvent, index: number) => {
    setDragSourceSlide(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleSlideDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverSlide(index);
  };
  const handleSlideDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragSourceSlide !== null && dragSourceSlide !== targetIndex) {
      moveSlide(dragSourceSlide, targetIndex);
    }
    setDragOverSlide(null);
    setDragSourceSlide(null);
  };

  // ─── Presentation mode trigger via custom event ────────────
  useEffect(() => {
    const startPresentation = () => {
      setPresSlideIndex(0);
      setPresentationMode(true);
    };
    window.addEventListener('rasid-start-presentation', startPresentation);
    return () => window.removeEventListener('rasid-start-presentation', startPresentation);
  }, []);

  // ─── Keyboard Shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (presentationMode) {
        if (e.key === 'Escape') setPresentationMode(false);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault();
          setPresSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          setPresSlideIndex(prev => Math.max(0, prev - 1));
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Delete' && selectedElementId && !document.querySelector('[contenteditable="true"]:focus')) {
        deleteElement(selectedElementId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presentationMode, slides.length, undo, redo, selectedElementId, deleteElement]);

  // ─── Export to HTML ────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!currentPresentationId) {
      // Save first
      try {
        const created = await createPresentationMutation.mutateAsync({
          title: `عرض تقديمي — ${new Date().toLocaleDateString('ar-SA')}`,
          slides: slides as any[],
          theme: activeTemplate,
        });
        if (created?.id) setCurrentPresentationId(created.id);
        setShareLoading(true);
        const result = await shareMutation.mutateAsync({
          presentationId: created?.id as number,
          password: sharePassword || undefined,
        });
        const token = (result as any)?.shareToken;
        if (token) {
          setShareLink(`${window.location.origin}/shared/${token}`);
        }
      } catch (e) {
        console.error('Share failed:', e);
      } finally {
        setShareLoading(false);
      }
      return;
    }
    setShareLoading(true);
    try {
      // Update presentation first
      await updatePresentationMutation.mutateAsync({
        id: currentPresentationId,
        slides: slides as any[],
        theme: activeTemplate,
      });
      const result = await shareMutation.mutateAsync({
        presentationId: currentPresentationId,
        password: sharePassword || undefined,
      });
      const token = (result as any)?.shareToken;
      if (token) {
        setShareLink(`${window.location.origin}/shared/${token}`);
      }
    } catch (e) {
      console.error('Share failed:', e);
    } finally {
      setShareLoading(false);
    }
  }, [currentPresentationId, slides, activeTemplate, sharePassword, shareMutation, createPresentationMutation, updatePresentationMutation]);

  const exportToHTML = useCallback(() => {
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عرض تقديمي — راصد</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Cairo,sans-serif;background:#000;overflow:hidden}.slide{width:100vw;height:100vh;display:none;position:relative;overflow:hidden}.slide.active{display:flex;align-items:center;justify-content:center}.nav{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:100}.nav button{padding:8px 16px;border:none;border-radius:8px;background:rgba(255,255,255,.2);color:#fff;cursor:pointer;font-size:14px}.nav button:hover{background:rgba(255,255,255,.3)}.counter{position:fixed;bottom:20px;right:20px;color:rgba(255,255,255,.5);font-size:12px;z-index:100}</style></head><body>${slides.map((s, i) => {
      const bg = s.background.type === 'gradient' ? `background:linear-gradient(${s.background.gradientDirection || '135deg'},${s.background.gradientFrom},${s.background.gradientTo})` : `background:${s.background.color || '#fff'}`;
      return `<div class="slide${i === 0 ? ' active' : ''}" style="${bg}">${s.elements.map(el => {
        const pos = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;height:${el.height}%`;
        const fs = `font-size:${el.style.fontSize || 14}px;color:${el.style.color || '#000'};text-align:${el.style.textAlign || 'right'};font-weight:${el.style.fontWeight || 'normal'}`;
        if (el.type === 'text' || el.type === 'heading') return `<div style="${pos};${fs};${el.style.backgroundColor ? `background:${el.style.backgroundColor};border-radius:${el.style.borderRadius || 0}px;padding:${el.style.padding || 0}px;display:flex;align-items:center;justify-content:center` : ''}">${el.content}</div>`;
        if (el.type === 'shape') return `<div style="${pos};background:${el.style.backgroundColor || '#3b82f6'};border-radius:${el.style.borderRadius || 0}px;opacity:${el.style.opacity ?? 1}"></div>`;
        return '';
      }).join('')}</div>`;
    }).join('')}<div class="nav"><button onclick="prev()">→ السابق</button><button onclick="next()">التالي ←</button></div><div class="counter" id="counter">1 / ${slides.length}</div><script>let c=0;const s=document.querySelectorAll('.slide');function show(n){s.forEach(e=>e.classList.remove('active'));s[n].classList.add('active');document.getElementById('counter').textContent=(n+1)+' / '+s.length}function next(){c=Math.min(s.length-1,c+1);show(c)}function prev(){c=Math.max(0,c-1);show(c)}document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key===' ')next();if(e.key==='ArrowRight')prev();if(e.key==='Escape')document.exitFullscreen?.()});document.body.addEventListener('click',next)</script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'presentation.html'; a.click();
    URL.revokeObjectURL(url);
  }, [slides]);

  // ─── Export to JSON ────────────────────────────────────────
  const exportToJSON = useCallback(() => {
    const json = JSON.stringify({ slides, brandKit, template: activeTemplate }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'presentation.json'; a.click();
    URL.revokeObjectURL(url);
  }, [slides, brandKit, activeTemplate]);

  // ─── Export to PPTX using pptxgenjs ─────────────────────────
  const exportToPPTX = useCallback(async () => {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"
    pptx.rtlMode = true;

    for (const slide of slides) {
      const pptSlide = pptx.addSlide();

      // Set background
      if (slide.background.type === 'gradient') {
        pptSlide.background = { color: slide.background.gradientFrom?.replace('#', '') || 'FFFFFF' };
      } else if (slide.background.type === 'image' && slide.background.imageSrc) {
        pptSlide.background = { path: slide.background.imageSrc };
      } else {
        pptSlide.background = { color: (slide.background.color || '#ffffff').replace('#', '') };
      }

      // Add elements
      for (const el of slide.elements) {
        const xInch = (el.x / 100) * 13.33;
        const yInch = (el.y / 100) * 7.5;
        const wInch = (el.width / 100) * 13.33;
        const hInch = (el.height / 100) * 7.5;

        if (el.type === 'heading' || el.type === 'text') {
          pptSlide.addText(el.content || '', {
            x: xInch, y: yInch, w: wInch, h: hInch,
            fontSize: el.style.fontSize ? el.style.fontSize * 0.75 : (el.type === 'heading' ? 28 : 14),
            color: (el.style.color || '#000000').replace('#', ''),
            bold: el.style.fontWeight === 'bold',
            italic: el.style.fontStyle === 'italic',
            align: el.style.textAlign === 'center' ? 'center' : el.style.textAlign === 'left' ? 'left' : 'right',
            valign: 'middle',
            rtlMode: true,
            fill: el.style.backgroundColor ? { color: el.style.backgroundColor.replace('#', '') } : undefined,
          });
        } else if (el.type === 'shape') {
          pptSlide.addShape(pptx.ShapeType.rect, {
            x: xInch, y: yInch, w: wInch, h: hInch,
            fill: { color: (el.style.backgroundColor || '#3b82f6').replace('#', '') },
            rectRadius: el.style.borderRadius ? el.style.borderRadius * 0.01 : 0,
          });
        } else if (el.type === 'image' && el.content) {
          try {
            pptSlide.addImage({
              data: el.content,
              x: xInch, y: yInch, w: wInch, h: hInch,
            });
          } catch {
            // Skip invalid images
          }
        }
      }

      // Add speaker notes
      if (slide.notes) {
        pptSlide.addNotes(slide.notes);
      }
    }

    await pptx.writeFile({ fileName: 'عرض-تقديمي.pptx' });
  }, [slides]);

  // ─── Canvas Scale ──────────────────────────────────────────
  const [canvasScale, setCanvasScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      if (canvasRef.current) {
        const w = canvasRef.current.offsetWidth;
        setCanvasScale(w / 800);
      }
    };
    updateScale();
    const obs = new ResizeObserver(updateScale);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, []);

  // ─── Slide Background Style ────────────────────────────────
  const getSlideBackground = (bg: SlideBackground): React.CSSProperties => {
    if (bg.type === 'gradient') return { background: `linear-gradient(${bg.gradientDirection || '135deg'}, ${bg.gradientFrom}, ${bg.gradientTo})` };
    if (bg.type === 'image') return { backgroundImage: `url(${bg.imageSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    return { backgroundColor: bg.color || '#ffffff' };
  };

  // ─── Presentation Mode (rendered as portal) ─────────────────

  // ─── Insert Menu Items ─────────────────────────────────────
  const insertItems = [
    { type: 'heading' as const, icon: 'title', label: 'عنوان' },
    { type: 'text' as const, icon: 'text_fields', label: 'نص' },
    { type: 'list' as const, icon: 'format_list_bulleted', label: 'قائمة' },
    { type: 'shape' as const, icon: 'rectangle', label: 'شكل' },
    { type: 'chart' as const, icon: 'bar_chart', label: 'رسم بياني' },
    { type: 'image' as const, icon: 'image', label: 'صورة' },
  ];

  const createSources = [
    { id: 'prompt', icon: 'edit_note', label: 'من نص أو فكرة' },
    { id: 'pdf', icon: 'picture_as_pdf', label: 'من ملف PDF' },
    { id: 'url', icon: 'link', label: 'من رابط ويب' },
    { id: 'data', icon: 'table_chart', label: 'من بيانات CSV/Excel' },
    { id: 'image', icon: 'image', label: 'من صور' },
    { id: 'video', icon: 'videocam', label: 'من فيديو يوتيوب' },
    { id: 'json', icon: 'data_object', label: 'من JSON' },
    { id: 'research', icon: 'travel_explore', label: 'بحث معمق' },
  ];

  const animationOptions: { id: AnimationConfig['type']; label: string; icon: string }[] = [
    { id: 'fadeIn', label: 'تلاشي', icon: 'blur_on' },
    { id: 'slideRight', label: 'انزلاق يمين', icon: 'swipe_right' },
    { id: 'slideLeft', label: 'انزلاق يسار', icon: 'swipe_left' },
    { id: 'slideUp', label: 'انزلاق أعلى', icon: 'swipe_up' },
    { id: 'zoomIn', label: 'تكبير', icon: 'zoom_in' },
    { id: 'bounceIn', label: 'ارتداد', icon: 'sports_basketball' },
    { id: 'rotateIn', label: 'دوران', icon: 'rotate_right' },
    { id: 'flipIn', label: 'قلب', icon: 'flip' },
  ];

  const transitionOptions: { type: SlideTransition['type']; label: string; icon: string }[] = [
    { type: 'none', label: 'بدون', icon: 'block' },
    { type: 'fade', label: 'تلاشي', icon: 'blur_on' },
    { type: 'slideRight', label: 'انزلاق', icon: 'swipe_left' },
    { type: 'zoom', label: 'تكبير', icon: 'zoom_in' },
    { type: 'flip', label: 'قلب', icon: 'flip' },
  ];

  // ─── Formatting Toolbar for Selected Element ───────────────
  const FormatBar = () => {
    if (!selectedElement || !editMode) return null;
    const isText = selectedElement.type === 'text' || selectedElement.type === 'heading';
    const updateStyle = (updates: Partial<ElementStyle>) => {
      pushUndo();
      updateElement(selectedElement.id, { style: { ...selectedElement.style, ...updates } });
    };

    return (
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-accent/10 shrink-0 overflow-x-auto no-scrollbar animate-fade-in">
        {isText && (
          <>
            <button onClick={() => updateStyle({ fontWeight: selectedElement.style.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-all ${selectedElement.style.fontWeight === 'bold' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>B</button>
            <button onClick={() => updateStyle({ fontStyle: selectedElement.style.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`w-7 h-7 flex items-center justify-center rounded-md text-xs italic transition-all ${selectedElement.style.fontStyle === 'italic' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>I</button>
            <button onClick={() => updateStyle({ textDecoration: selectedElement.style.textDecoration === 'underline' ? 'none' : 'underline' })} className={`w-7 h-7 flex items-center justify-center rounded-md text-xs underline transition-all ${selectedElement.style.textDecoration === 'underline' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>U</button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <select value={selectedElement.style.fontSize || 14} onChange={e => updateStyle({ fontSize: Number(e.target.value) })} className="bg-card border border-border rounded-md px-1 py-0.5 text-[10px] text-foreground outline-none">
              {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="h-4 w-px bg-border mx-0.5" />
            {(['right', 'center', 'left'] as const).map(align => (
              <button key={align} onClick={() => updateStyle({ textAlign: align })} className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${selectedElement.style.textAlign === align ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                <MaterialIcon icon={`format_align_${align}`} size={14} />
              </button>
            ))}
            <div className="h-4 w-px bg-border mx-0.5" />
            <label className="flex items-center gap-1 text-[9px] text-muted-foreground">
              لون
              <input type="color" value={selectedElement.style.color || '#000000'} onChange={e => updateStyle({ color: e.target.value })} className="w-5 h-5 rounded border border-border cursor-pointer" />
            </label>
            <div className="h-4 w-px bg-border mx-0.5" />
            <button onClick={() => handleTextOperation('translate')} disabled={aiLoading} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-50" title="ترجمة">
              <MaterialIcon icon="translate" size={12} /> ترجمة
            </button>
            <button onClick={() => handleTextOperation('rewrite')} disabled={aiLoading} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-50" title="إعادة صياغة">
              <MaterialIcon icon="edit_note" size={12} /> صياغة
            </button>
            <button onClick={() => handleTextOperation('summarize')} disabled={aiLoading} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-50" title="تلخيص">
              <MaterialIcon icon="summarize" size={12} /> تلخيص
            </button>
            <button onClick={() => handleTextOperation('expand')} disabled={aiLoading} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-50" title="توسيع">
              <MaterialIcon icon="expand" size={12} /> توسيع
            </button>
          </>
        )}
        {selectedElement.type === 'shape' && (
          <>
            <label className="flex items-center gap-1 text-[9px] text-muted-foreground">
              لون
              <input type="color" value={selectedElement.style.backgroundColor || '#3b82f6'} onChange={e => updateStyle({ backgroundColor: e.target.value })} className="w-5 h-5 rounded border border-border cursor-pointer" />
            </label>
            <div className="h-4 w-px bg-border mx-0.5" />
            <label className="flex items-center gap-1 text-[9px] text-muted-foreground">
              شفافية
              <input type="range" min="0" max="100" value={(selectedElement.style.opacity ?? 1) * 100} onChange={e => updateStyle({ opacity: Number(e.target.value) / 100 })} className="w-16 h-1 accent-primary" />
            </label>
            <label className="flex items-center gap-1 text-[9px] text-muted-foreground">
              استدارة
              <input type="range" min="0" max="50" value={selectedElement.style.borderRadius ?? 0} onChange={e => updateStyle({ borderRadius: Number(e.target.value) })} className="w-16 h-1 accent-primary" />
            </label>
          </>
        )}
        <div className="flex-1" />
        <button onClick={() => { pushUndo(); deleteElement(selectedElement.id); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-red-500 hover:bg-red-500/10 transition-all">
          <MaterialIcon icon="delete" size={13} />
          حذف
        </button>
      </div>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────
  const char = theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving;

  // Presentation mode portal renderer
  const renderPresentationMode = () => {
    if (!presentationMode) return null;
    const presSlide = slides[presSlideIndex];
    return createPortal(
      <div className="fixed inset-0 bg-black" style={{ zIndex: 99999 }} onClick={() => setPresSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-full h-full relative overflow-hidden" style={getSlideBackground(presSlide.background)}>
            {presSlide.elements.map(el => (
              <div key={el.id} className="absolute" style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`, animation: el.animation ? `${el.animation.type} ${el.animation.duration}ms ${el.animation.easing} ${el.animation.delay}ms both` : undefined }}>
                {(el.type === 'text' || el.type === 'heading') && (
                  <div style={{ fontSize: `${(el.style.fontSize || 14) * (window.innerWidth / 800)}px`, fontWeight: el.style.fontWeight, fontStyle: el.style.fontStyle, textAlign: el.style.textAlign as any, color: el.style.color, backgroundColor: el.style.backgroundColor || 'transparent', borderRadius: el.style.borderRadius ? `${el.style.borderRadius}px` : undefined, padding: el.style.padding ? `${el.style.padding * (window.innerWidth / 800)}px` : undefined, opacity: el.style.opacity ?? 1, direction: 'rtl', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: el.style.textAlign === 'center' ? 'center' : 'flex-start' }}>
                    {el.content}
                  </div>
                )}
                {el.type === 'shape' && renderShapeElement(el)}
                {el.type === 'chart' && renderChartElement(el, window.innerWidth / 800)}
                {el.type === 'list' && renderListElement(el, window.innerWidth / 800)}
              </div>
            ))}
          </div>
        </div>
        {/* Navigation */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4" style={{ zIndex: 100000 }}>
          <button onClick={e => { e.stopPropagation(); setPresSlideIndex(prev => Math.max(0, prev - 1)); }} className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 backdrop-blur-md transition-all border border-white/10">
            <MaterialIcon icon="chevron_right" size={28} />
          </button>
          <span className="text-white/60 text-base font-medium tabular-nums">{presSlideIndex + 1} / {slides.length}</span>
          <button onClick={e => { e.stopPropagation(); setPresSlideIndex(prev => Math.min(slides.length - 1, prev + 1)); }} className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 backdrop-blur-md transition-all border border-white/10">
            <MaterialIcon icon="chevron_left" size={28} />
          </button>
        </div>
        {/* Top bar: close + timer */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-6" style={{ zIndex: 100000 }}>
          <button onClick={e => { e.stopPropagation(); setPresentationMode(false); }} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 backdrop-blur-md transition-all border border-white/10">
            <MaterialIcon icon="close" size={24} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm font-mono tabular-nums bg-black/30 backdrop-blur-md rounded-lg px-3 py-1 border border-white/10">
              <MaterialIcon icon="timer" size={14} className="inline ml-1" />
              {formatTimer(presenterTimer)}
            </span>
            <button onClick={e => { e.stopPropagation(); setShowPresenterNotes(p => !p); }} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border border-white/10 ${showPresenterNotes ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'}`}>
              <MaterialIcon icon="speaker_notes" size={16} />
            </button>
          </div>
        </div>
        {/* Speaker notes panel */}
        {showPresenterNotes && presSlide.notes && (
          <div className="absolute bottom-20 right-6 max-w-[400px] max-h-[200px] overflow-y-auto bg-black/70 backdrop-blur-md rounded-xl p-4 text-white/80 text-sm border border-white/10" style={{ zIndex: 100000 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-2 text-white/50 text-[10px]">
              <MaterialIcon icon="speaker_notes" size={12} />
              ملاحظات المتحدث
            </div>
            <div style={{ direction: 'rtl', lineHeight: 1.8 }}>{presSlide.notes}</div>
          </div>
        )}
      </div>,
      document.body
    );
  };

  return (
    <>
    {renderPresentationMode()}
    <div className="flex-1 h-full bg-card rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-xl relative gold-border-glow">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line z-10" />
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar glass">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-1" />
        <ToolbarBtn icon="add" label="شريحة" onClick={() => addSlide(activeSlideIndex)} />
        <ToolbarBtn icon="content_copy" label="تكرار" onClick={() => duplicateSlide(activeSlideIndex)} />
        <div className="relative">
          <ToolbarBtn icon="add_box" label="إدراج" onClick={() => setShowInsertMenu(!showInsertMenu)} active={showInsertMenu} />
          {showInsertMenu && (
            <div className="absolute top-full right-0 mt-1 w-[160px] bg-card border border-border rounded-xl shadow-xl z-50 p-1 animate-fade-in-up" dir="rtl">
              {insertItems.map(item => (
                <button key={item.type} onClick={() => addElement(item.type)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-accent transition-all">
                  <MaterialIcon icon={item.icon} size={14} className="text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolbarBtn icon="auto_fix_high" label="توليد AI" onClick={() => setCreateMode(createMode ? null : 'menu')} active={!!createMode} />
        <ToolbarBtn icon="palette" label="القالب" onClick={() => setShowTemplates(!showTemplates)} active={showTemplates} />
        <button
          id="rasid-play-btn"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setPresSlideIndex(0);
            setPresentationMode(true);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 relative z-[100]"
        >
          <MaterialIcon icon="play_arrow" size={14} />
          <span className="hidden sm:inline">عرض</span>
        </button>
        {mode === 'advanced' && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <ToolbarBtn icon="animation" label="حركات" onClick={() => setShowAnimations(!showAnimations)} active={showAnimations} />
            <ToolbarBtn icon="speaker_notes" label="ملاحظات" onClick={() => setShowSpeakerNotes(!showSpeakerNotes)} active={showSpeakerNotes} />
            <ToolbarBtn icon="brush" label="علامة تجارية" onClick={() => setShowBrandKit(!showBrandKit)} active={showBrandKit} />
            <ToolbarBtn icon="quiz" label="اختبار" onClick={() => setQuizSlideOpen(!quizSlideOpen)} active={quizSlideOpen} />
            <ToolbarBtn icon="comment" label="تعليقات" onClick={() => setShowComments(!showComments)} active={showComments} />
            <ToolbarBtn icon={lockedSlides.has(activeSlide.id) ? 'lock' : 'lock_open'} label="قفل" onClick={() => toggleSlideLock(activeSlide.id)} active={lockedSlides.has(activeSlide.id)} />
            <ToolbarBtn icon="group" label="تعاون" onClick={() => setShowCollabPanel(!showCollabPanel)} active={showCollabPanel} />
          </>
        )}
        {/* Save Status */}
        <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} />
        <button onClick={forceSave} title="حفظ يدوي (Ctrl+S)" className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-all">
          <MaterialIcon icon="save" size={14} className="text-muted-foreground" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
          <button onClick={undo} disabled={undoStack.length === 0} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 transition-all" title="تراجع (Ctrl+Z)">
            <MaterialIcon icon="undo" size={14} />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 transition-all" title="إعادة (Ctrl+Y)">
            <MaterialIcon icon="redo" size={14} />
          </button>
        </div>
        <div className="relative">
          <ToolbarBtn icon="download" label="تصدير" onClick={() => setExportMenu(!exportMenu)} />
          {exportMenu && (
            <div className="absolute top-full left-0 mt-1 w-[180px] bg-card border border-border rounded-xl shadow-xl z-50 p-1 animate-fade-in-up" dir="rtl">
              <button onClick={() => { exportToHTML(); setExportMenu(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-accent transition-all">
                <MaterialIcon icon="code" size={14} className="text-muted-foreground" />
                عرض ويب تفاعلي (.html)
              </button>
              <button onClick={() => { exportToPPTX(); setExportMenu(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-accent transition-all">
                <MaterialIcon icon="slideshow" size={14} className="text-primary" />
                عرض تقديمي (.pptx)
              </button>
              <button onClick={() => { exportToPDF(); setExportMenu(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-accent transition-all">
                <MaterialIcon icon="picture_as_pdf" size={14} className="text-red-500" />
                مستند PDF (.pdf)
              </button>
              <button onClick={() => { exportAsImages(); setExportMenu(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-accent transition-all">
                <MaterialIcon icon="image" size={14} className="text-green-500" />
                صور (.jpg)
              </button>
              <button onClick={() => { exportToJSON(); setExportMenu(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-accent transition-all">
                <MaterialIcon icon="data_object" size={14} className="text-muted-foreground" />
                بيانات العرض (.json)
              </button>
            </div>
          )}
        </div>
        <ToolbarBtn icon="share" label="مشاركة" onClick={() => setShowShareDialog(true)} />
      </div>

      {/* ── Format Bar ── */}
      <FormatBar />

      {/* ── Create Source Panel ── */}
      {createMode === 'menu' && (
        <div className="border-b border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground mb-2">إنشاء عرض من:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
            {createSources.map((src, i) => (
              <button key={src.id} onClick={() => setSourceDialogOpen(src.id)} className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all animate-stagger-in group" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <MaterialIcon icon={src.icon} size={16} className="text-primary" />
                </div>
                <span className="text-[9px] font-medium text-foreground text-center leading-tight">{src.label}</span>
              </button>
            ))}
          </div>
          {/* Source Input Dialog */}
          {sourceDialogOpen && (
            <div className="mt-3 p-3 bg-card border border-border rounded-xl animate-fade-in" dir="rtl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-foreground">
                  {createSources.find(s => s.id === sourceDialogOpen)?.label || 'إنشاء'}
                </span>
                <button onClick={() => { setSourceDialogOpen(null); setSourceInput(''); setSourceFile(null); }} className="text-muted-foreground hover:text-foreground">
                  <MaterialIcon icon="close" size={14} />
                </button>
              </div>
              {/* Slide count selector */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-muted-foreground">عدد الشرائح:</span>
                <div className="flex gap-1">
                  {[5, 8, 12, 15, 20].map(n => (
                    <button key={n} onClick={() => setSlideCount(n)} className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${slideCount === n ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground hover:bg-accent/80'}`}>{n}</button>
                  ))}
                </div>
              </div>
              {/* Input based on source type */}
              {(sourceDialogOpen === 'prompt' || sourceDialogOpen === 'url' || sourceDialogOpen === 'research' || sourceDialogOpen === 'json' || sourceDialogOpen === 'video') && (
                <textarea
                  value={sourceInput}
                  onChange={e => setSourceInput(e.target.value)}
                  placeholder={sourceDialogOpen === 'prompt' ? 'اكتب الموضوع أو الفكرة الرئيسية...' : sourceDialogOpen === 'url' ? 'الصق رابط الموقع...' : sourceDialogOpen === 'research' ? 'موضوع البحث المعمق...' : sourceDialogOpen === 'video' ? 'رابط فيديو يوتيوب...' : 'الصق بيانات JSON...'}
                  className="w-full h-[80px] bg-accent/30 border border-border rounded-lg p-2 text-[11px] text-foreground resize-none outline-none focus:border-primary/30"
                />
              )}
              {(sourceDialogOpen === 'pdf' || sourceDialogOpen === 'data' || sourceDialogOpen === 'image') && (
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={sourceDialogOpen === 'pdf' ? '.pdf,.txt,.doc,.docx' : sourceDialogOpen === 'data' ? '.csv,.xlsx,.xls,.tsv' : '.jpg,.jpeg,.png,.gif,.webp'}
                    onChange={e => setSourceFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/30 transition-all">
                    <MaterialIcon icon="upload_file" size={20} className="text-primary" />
                    <span className="text-[11px] text-muted-foreground">{sourceFile ? sourceFile.name : 'اختر ملف...'}</span>
                  </button>
                  {sourceDialogOpen !== 'image' && (
                    <textarea
                      value={sourceInput}
                      onChange={e => setSourceInput(e.target.value)}
                      placeholder="أو الصق المحتوى هنا مباشرة..."
                      className="w-full h-[60px] bg-accent/30 border border-border rounded-lg p-2 text-[11px] text-foreground resize-none outline-none focus:border-primary/30"
                    />
                  )}
                </div>
              )}
              <button
                onClick={() => handleGenerateFromSource(sourceDialogOpen!)}
                disabled={aiLoading || (!sourceInput.trim() && !sourceFile)}
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {aiLoading ? (
                  <><img src={RASED_USAGE.loadingPresentation} alt="" className="w-5 h-5 object-contain animate-bounce-once" /> جاري الإنشاء...</>
                ) : (
                  <><MaterialIcon icon="auto_awesome" size={14} /> إنشاء العرض</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Template Picker ── */}
      {showTemplates && (
        <div className="border-b border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground mb-2">القوالب — انقر لتطبيق</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className={`shrink-0 w-[110px] rounded-lg overflow-hidden border-2 transition-all animate-stagger-in group ${activeTemplate === t.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className={`w-full aspect-[16/9] bg-gradient-to-br ${t.preview.from} ${t.preview.to} flex flex-col items-center justify-center p-2`}>
                  <div className="w-3/4 h-1.5 bg-white/20 rounded-full mb-1" />
                  <div className="w-1/2 h-1 bg-white/10 rounded-full" />
                </div>
                <div className="bg-card px-1.5 py-1 text-center">
                  <span className="text-[9px] font-medium text-foreground">{t.nameAr}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
        {/* Slide Thumbnails */}
        <div className="sm:w-[130px] border-b sm:border-b-0 sm:border-l border-border bg-accent/10 p-1.5 sm:p-2 overflow-auto flex sm:flex-col gap-1.5 shrink-0">
          {slides.map((s, n) => (
            <div key={s.id} className="relative group">
              <button
                draggable
                onDragStart={e => handleSlideDragStart(e, n)}
                onDragOver={e => handleSlideDragOver(e, n)}
                onDragLeave={() => setDragOverSlide(null)}
                onDrop={e => handleSlideDrop(e, n)}
                onClick={() => { setActiveSlideIndex(n); setSelectedElementId(null); }}
                className={`aspect-[16/9] rounded-lg border-2 transition-all cursor-pointer shrink-0 w-[90px] sm:w-full relative overflow-hidden ${
                  n === activeSlideIndex ? 'border-primary shadow-md' : 'border-border/50 hover:border-primary/30'
                } ${dragOverSlide === n ? 'border-primary/60 scale-[1.03]' : ''}`}
              >
                <div className="w-full h-full rounded-md overflow-hidden" style={getSlideBackground(s.background)}>
                  {/* Mini preview of elements */}
                  {s.elements.filter(e => e.type === 'heading' || e.type === 'text').slice(0, 2).map(el => (
                    <div key={el.id} className="absolute truncate" style={{
                      left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`,
                      fontSize: `${Math.max(4, (el.style.fontSize || 14) * 0.15)}px`,
                      fontWeight: el.style.fontWeight, color: el.style.color, textAlign: el.style.textAlign,
                    }}>
                      {el.content}
                    </div>
                  ))}
                </div>
                <span className="absolute bottom-0.5 left-0.5 text-[7px] text-white/70 bg-black/40 rounded px-0.5">{n + 1}</span>
              </button>
              {/* Context menu on hover */}
              <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-10">
                <button onClick={e => { e.stopPropagation(); duplicateSlide(n); }} className="w-4 h-4 rounded bg-black/40 text-white flex items-center justify-center hover:bg-black/60" title="تكرار">
                  <MaterialIcon icon="content_copy" size={8} />
                </button>
                {slides.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); deleteSlide(n); }} className="w-4 h-4 rounded bg-red-500/60 text-white flex items-center justify-center hover:bg-red-500/80" title="حذف">
                    <MaterialIcon icon="close" size={8} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => addSlide()} className="aspect-[16/9] rounded-lg border-2 border-dashed border-border/50 hover:border-primary/30 transition-all cursor-pointer flex items-center justify-center shrink-0 w-[90px] sm:w-full">
            <MaterialIcon icon="add" size={18} className="text-muted-foreground/40" />
          </button>
        </div>

        {/* ── Slide Canvas ── */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-5 bg-accent/5" onClick={() => setSelectedElementId(null)}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => {
            e.preventDefault(); e.stopPropagation();
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            files.forEach((file, i) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const newEl: SlideElement = {
                  id: Math.random().toString(36).slice(2, 9),
                  type: 'image',
                  x: 10 + i * 5, y: 10 + i * 5, width: 40, height: 50,
                  content: file.name,
                  style: { imageSrc: ev.target?.result as string, objectFit: 'cover', opacity: 1 },
                };
                setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s));
              };
              reader.readAsDataURL(file);
            });
          }}
        >
          <div
            ref={canvasRef}
            className="w-full max-w-[700px] aspect-[16/9] rounded-xl border border-border shadow-lg relative overflow-hidden"
            style={getSlideBackground(activeSlide.background)}
          >
            {activeSlide.elements.map(el => (
              <SlideElementRenderer
                key={el.id}
                element={el}
                scale={canvasScale}
                isSelected={selectedElementId === el.id}
                onSelect={() => setSelectedElementId(el.id)}
                onUpdate={updates => updateElement(el.id, updates)}
                onDelete={() => deleteElement(el.id)}
                editMode={editMode}
              />
            ))}
            {/* Slide number */}
            <span className="absolute bottom-2 left-3 text-[10px] opacity-40" style={{ color: activeSlide.elements[0]?.style.color || '#666' }}>
              {activeSlideIndex + 1} / {slides.length}
            </span>
          </div>
        </div>

        {/* ── Right Side Panels (Advanced) ── */}
        {mode === 'advanced' && (
          <div className="hidden lg:flex flex-col w-[200px] border-r border-border bg-accent/10 overflow-y-auto animate-fade-in">
            {/* Slide Properties */}
            <div className="p-2 border-b border-border">
              <p className="text-[10px] font-bold text-muted-foreground mb-2">خصائص الشريحة</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-muted-foreground">الانتقال</span>
                  <div className="grid grid-cols-3 gap-0.5">
                    {transitionOptions.map(t => (
                      <button key={t.type} onClick={() => { pushUndo(); setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, transition: { type: t.type, duration: 500 } } : s)); }} className={`flex flex-col items-center gap-0.5 p-1 rounded text-[7px] transition-all ${activeSlide.transition.type === t.type ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                        <MaterialIcon icon={t.icon} size={12} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-muted-foreground">خلفية</span>
                  <div className="flex gap-1">
                    <input type="color" value={activeSlide.background.gradientFrom || activeSlide.background.color || '#ffffff'} onChange={e => { pushUndo(); setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, background: { type: 'solid', color: e.target.value } } : s)); }} className="w-6 h-6 rounded border border-border cursor-pointer" />
                    <span className="text-[9px] text-muted-foreground self-center">لون الخلفية</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Animations Panel */}
            {showAnimations && selectedElement && (
              <div className="p-2 border-b border-border animate-fade-in">
                <p className="text-[10px] font-bold text-muted-foreground mb-2">حركة العنصر</p>
                <div className="grid grid-cols-2 gap-1">
                  {animationOptions.map(anim => (
                    <button key={anim.id} onClick={() => { pushUndo(); updateElement(selectedElement.id, { animation: { type: anim.id, duration: 600, delay: 0, easing: 'ease-out' } }); }} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all ${selectedElement.animation?.type === anim.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground hover:bg-primary/5'}`}>
                      <MaterialIcon icon={anim.icon} size={14} />
                      <span className="text-[8px]">{anim.label}</span>
                    </button>
                  ))}
                </div>
                {selectedElement.animation && (
                  <button onClick={() => { pushUndo(); updateElement(selectedElement.id, { animation: undefined }); }} className="w-full mt-1 text-[9px] text-red-500 hover:underline text-center">
                    إزالة الحركة
                  </button>
                )}
              </div>
            )}

            {/* Brand Kit */}
            {showBrandKit && (
              <div className="p-2 border-b border-border animate-fade-in">
                <p className="text-[10px] font-bold text-muted-foreground mb-2">العلامة التجارية</p>
                <div className="flex flex-col gap-2">
                  {/* Colors */}
                  <div>
                    <span className="text-[8px] text-muted-foreground block mb-1">الألوان</span>
                    <div className="flex flex-col gap-1">
                      {[
                        { key: 'primaryColor' as const, label: 'رئيسي', val: brandKit.primaryColor },
                        { key: 'secondaryColor' as const, label: 'ثانوي', val: brandKit.secondaryColor },
                        { key: 'accentColor' as const, label: 'تمييز', val: brandKit.accentColor },
                        { key: 'backgroundColor' as const, label: 'خلفية', val: brandKit.backgroundColor },
                      ].map(c => (
                        <div key={c.key} className="flex items-center gap-1.5">
                          <input type="color" value={c.val} onChange={e => setBrandKit(prev => ({ ...prev, [c.key]: e.target.value }))} className="w-5 h-5 rounded border border-border cursor-pointer" />
                          <span className="text-[8px] text-muted-foreground">{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Heading Font */}
                  <div>
                    <span className="text-[8px] text-muted-foreground block mb-0.5">خط العناوين</span>
                    <select value={brandKit.headingFont} onChange={e => setBrandKit(prev => ({ ...prev, headingFont: e.target.value }))} className="w-full px-2 py-1 rounded-lg bg-card border border-border text-[10px] text-foreground outline-none">
                      <option value="Cairo, sans-serif">Cairo</option>
                      <option value="Tajawal, sans-serif">Tajawal</option>
                      <option value="IBM Plex Sans Arabic, sans-serif">IBM Plex Arabic</option>
                      <option value="Noto Kufi Arabic, sans-serif">Noto Kufi</option>
                      <option value="Almarai, sans-serif">Almarai</option>
                      <option value="Amiri, serif">Amiri</option>
                      <option value="Rubik, sans-serif">Rubik</option>
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Poppins, sans-serif">Poppins</option>
                    </select>
                  </div>
                  {/* Body Font */}
                  <div>
                    <span className="text-[8px] text-muted-foreground block mb-0.5">خط النصوص</span>
                    <select value={brandKit.bodyFont} onChange={e => setBrandKit(prev => ({ ...prev, bodyFont: e.target.value }))} className="w-full px-2 py-1 rounded-lg bg-card border border-border text-[10px] text-foreground outline-none">
                      <option value="IBM Plex Sans Arabic, sans-serif">IBM Plex Arabic</option>
                      <option value="Cairo, sans-serif">Cairo</option>
                      <option value="Tajawal, sans-serif">Tajawal</option>
                      <option value="Noto Kufi Arabic, sans-serif">Noto Kufi</option>
                      <option value="Almarai, sans-serif">Almarai</option>
                      <option value="Amiri, serif">Amiri</option>
                      <option value="Rubik, sans-serif">Rubik</option>
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Poppins, sans-serif">Poppins</option>
                    </select>
                  </div>
                  {/* Logo Upload */}
                  <div>
                    <span className="text-[8px] text-muted-foreground block mb-0.5">الشعار</span>
                    {brandKit.logoUrl ? (
                      <div className="flex items-center gap-1.5">
                        <img src={brandKit.logoUrl} alt="logo" className="w-8 h-8 rounded border border-border object-contain bg-white" />
                        <button onClick={() => setBrandKit(prev => ({ ...prev, logoUrl: undefined }))} className="text-[8px] text-red-500 hover:underline">إزالة</button>
                      </div>
                    ) : (
                      <button onClick={() => {
                        const inp = document.createElement('input');
                        inp.type = 'file'; inp.accept = 'image/*';
                        inp.onchange = () => {
                          const f = inp.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => setBrandKit(prev => ({ ...prev, logoUrl: ev.target?.result as string }));
                          reader.readAsDataURL(f);
                        };
                        inp.click();
                      }} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-border text-[9px] text-muted-foreground hover:border-primary/30 transition-all w-full justify-center">
                        <MaterialIcon icon="upload" size={12} />
                        رفع شعار
                      </button>
                    )}
                  </div>
                  {/* Apply to All Slides */}
                  <button onClick={() => {
                    pushUndo();
                    setSlides(prev => prev.map(s => ({
                      ...s,
                      background: { type: 'solid' as const, color: brandKit.backgroundColor },
                      elements: s.elements.map(el => {
                        if (el.type === 'heading') return { ...el, style: { ...el.style, color: brandKit.primaryColor, fontFamily: brandKit.headingFont } };
                        if (el.type === 'text' || el.type === 'list') return { ...el, style: { ...el.style, color: brandKit.secondaryColor, fontFamily: brandKit.bodyFont } };
                        if (el.type === 'shape') return { ...el, style: { ...el.style, backgroundColor: brandKit.accentColor } };
                        if (el.type === 'chart') return { ...el, style: { ...el.style, chartColors: [brandKit.accentColor, brandKit.primaryColor, brandKit.secondaryColor] } };
                        return el;
                      }),
                    })));
                  }} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-[9px] font-medium hover:bg-primary/90 transition-all">
                    <MaterialIcon icon="format_paint" size={12} />
                    تطبيق على كل الشرائح
                  </button>
                  {/* Add Logo to Current Slide */}
                  {brandKit.logoUrl && (
                    <button onClick={() => {
                      pushUndo();
                      const logoEl: SlideElement = {
                        id: uid(), type: 'image', x: 2, y: 2, width: 10, height: 12,
                        content: 'logo',
                        style: { imageSrc: brandKit.logoUrl, objectFit: 'contain', opacity: 1 },
                      };
                      setSlides(prev => prev.map((s, i) => i === activeSlideIndex ? { ...s, elements: [...s.elements, logoEl] } : s));
                    }} className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-accent text-foreground text-[9px] hover:bg-accent/80 transition-all">
                      <MaterialIcon icon="add_photo_alternate" size={12} />
                      إدراج الشعار في الشريحة
                    </button>
                  )}
                  {/* Add Logo to All Slides */}
                  {brandKit.logoUrl && (
                    <button onClick={() => {
                      pushUndo();
                      setSlides(prev => prev.map(s => {
                        const hasLogo = s.elements.some(e => e.type === 'image' && e.content === 'logo');
                        if (hasLogo) return s;
                        return { ...s, elements: [...s.elements, { id: uid(), type: 'image' as const, x: 2, y: 2, width: 10, height: 12, content: 'logo', style: { imageSrc: brandKit.logoUrl, objectFit: 'contain' as const, opacity: 1 } }] };
                      }));
                    }} className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-border text-foreground text-[9px] hover:bg-accent/50 transition-all">
                      <MaterialIcon icon="collections" size={12} />
                      إدراج الشعار في كل الشرائح
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Collaboration */}
            {showCollabPanel && (
              <div className="p-2 border-b border-border animate-fade-in">
                <p className="text-[10px] font-bold text-muted-foreground mb-2">التعاون</p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-border">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">أ</div>
                    <span className="text-[9px] text-foreground">أحمد (يحرر)</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-auto" />
                  </div>
                  <button className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-border text-[9px] text-muted-foreground hover:border-primary/30 transition-all">
                    <MaterialIcon icon="person_add" size={12} />
                    دعوة
                  </button>
                </div>
              </div>
            )}

            {/* Element list */}
            <div className="p-2">
              <p className="text-[10px] font-bold text-muted-foreground mb-2">عناصر الشريحة ({activeSlide.elements.length})</p>
              <div className="flex flex-col gap-0.5">
                {activeSlide.elements.map((el, i) => (
                  <button key={el.id} onClick={() => setSelectedElementId(el.id)} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] transition-all ${selectedElementId === el.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
                    <MaterialIcon icon={el.type === 'heading' ? 'title' : el.type === 'text' ? 'text_fields' : el.type === 'shape' ? 'rectangle' : el.type === 'chart' ? 'bar_chart' : el.type === 'list' ? 'format_list_bulleted' : 'image'} size={12} />
                    <span className="truncate flex-1 text-right">{el.content || el.type}</span>
                    <span className="text-[7px] opacity-50">{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Speaker Notes ── */}
      {showSpeakerNotes && (
        <div className="border-t border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MaterialIcon icon="speaker_notes" size={13} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">ملاحظات المتحدث — شريحة {activeSlideIndex + 1}</span>
            <button onClick={generateSpeakerNotes} disabled={aiLoading} className="mr-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[9px] hover:bg-primary/20 transition-all disabled:opacity-50">
              <MaterialIcon icon={aiLoading ? 'progress_activity' : 'auto_awesome'} size={11} className={aiLoading ? 'animate-spin' : ''} />
              توليد تلقائي
            </button>
          </div>
          <textarea
            value={activeSlide.notes}
            onChange={e => updateNotes(e.target.value)}
            className="w-full h-[50px] bg-card border border-border rounded-lg p-2 text-[11px] text-foreground resize-none outline-none focus:border-primary/30 transition-colors"
            placeholder="أضف ملاحظات للمتحدث..."
          />
        </div>
      )}

      {/* ── Quiz/Poll Generator Panel ── */}
      {quizSlideOpen && (
        <div className="border-t border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0" dir="rtl">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="quiz" size={13} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">إنشاء شرائح اختبار / استطلاع</span>
          </div>
          <div className="flex gap-2">
            <input
              value={quizTopic}
              onChange={e => setQuizTopic(e.target.value)}
              placeholder="موضوع الاختبار..."
              className="flex-1 bg-card border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/30"
            />
            <button onClick={() => handleGenerateQuiz('multiple_choice')} disabled={aiLoading || !quizTopic.trim()} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] hover:bg-primary/90 disabled:opacity-50 transition-all">
              <MaterialIcon icon={aiLoading ? 'progress_activity' : 'check_box'} size={12} className={aiLoading ? 'animate-spin' : ''} />
              اختيار متعدد
            </button>
            <button onClick={() => handleGenerateQuiz('open')} disabled={aiLoading || !quizTopic.trim()} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-foreground text-[10px] hover:bg-accent/80 disabled:opacity-50 transition-all">
              <MaterialIcon icon="edit" size={12} />
              سؤال مفتوح
            </button>
            <button onClick={() => handleGenerateQuiz('poll')} disabled={aiLoading || !quizTopic.trim()} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-foreground text-[10px] hover:bg-accent/80 disabled:opacity-50 transition-all">
              <MaterialIcon icon="poll" size={12} />
              استطلاع
            </button>
          </div>
        </div>
      )}

      {/* ── Comments Panel ── */}
      {showComments && (
        <div className="border-t border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0" dir="rtl">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="comment" size={13} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">تعليقات — شريحة {activeSlideIndex + 1}</span>
          </div>
          <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto mb-1.5">
            {(slideComments[activeSlide.id] || []).map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 px-2 py-1 rounded-lg bg-card border border-border">
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[7px] font-bold text-primary shrink-0 mt-0.5">أ</div>
                <span className="text-[10px] text-foreground">{c}</span>
              </div>
            ))}
            {(!slideComments[activeSlide.id] || slideComments[activeSlide.id].length === 0) && (
              <span className="text-[9px] text-muted-foreground">لا توجد تعليقات بعد</span>
            )}
          </div>
          <div className="flex gap-1">
            <input
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
              placeholder="أضف تعليق..."
              className="flex-1 bg-card border border-border rounded-lg px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/30"
            />
            <button onClick={addComment} disabled={!commentInput.trim()} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] disabled:opacity-50">
              <MaterialIcon icon="send" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── AI Text Operations Result ── */}
      {aiTextOp && aiTextResult && (
        <div className="border-t border-border bg-primary/5 p-2 sm:p-3 animate-fade-in shrink-0" dir="rtl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-primary">
              {aiTextOp === 'translate' ? 'نتيجة الترجمة' : aiTextOp === 'rewrite' ? 'إعادة الصياغة' : aiTextOp === 'summarize' ? 'الملخص' : aiTextOp === 'expand' ? 'النص الموسع' : 'النتيجة'}
            </span>
            <div className="flex gap-1">
              <button onClick={applyTextResult} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary text-primary-foreground text-[9px]">
                <MaterialIcon icon="check" size={11} /> تطبيق
              </button>
              <button onClick={() => { setAiTextOp(null); setAiTextResult(''); }} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent text-foreground text-[9px]">
                <MaterialIcon icon="close" size={11} /> إلغاء
              </button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-2 text-[11px] text-foreground max-h-[80px] overflow-y-auto" style={{ lineHeight: 1.8 }}>
            {aiTextResult}
          </div>
        </div>
      )}

      {/* ── Mini Command Bar ── */}
      <div className="px-2 pb-1.5 pt-1 border-t border-border shrink-0">
        <div className="flex items-center gap-1.5 bg-accent/30 rounded-xl px-2 py-1.5">
          <img src={char} alt="راصد" className="w-5 h-5 rounded-full object-contain" />
          <input 
            type="text" 
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAIGenerateSlides(); }}
            placeholder="اطلب من راصد تعديل العرض... مثال: أضف شريحة للتوصيات مع رسم بياني" 
            className="flex-1 bg-transparent text-[10px] sm:text-[11px] outline-none text-foreground placeholder:text-muted-foreground" 
            disabled={aiLoading}
          />
          <button 
            onClick={handleAIGenerateSlides}
            disabled={aiLoading || !aiPrompt.trim()}
            className={`w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-all`}
          >
            {aiLoading ? (
              <img src={RASED_USAGE.loadingPresentation} alt="" className="w-5 h-5 object-contain animate-spin-slow" />
            ) : (
              <MaterialIcon icon="send" size={13} className="text-primary" />
            )}
          </button>
        </div>
      </div>
     </div>

    {/* Share Dialog */}
    {showShareDialog && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShareDialog(false)}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-6 animate-fade-in-up" dir="rtl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MaterialIcon icon="share" size={18} className="text-primary" />
              مشاركة العرض
            </h3>
            <button onClick={() => setShowShareDialog(false)} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center">
              <MaterialIcon icon="close" size={16} />
            </button>
          </div>
          {shareLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 border border-border">
                <MaterialIcon icon="link" size={16} className="text-primary shrink-0" />
                <input type="text" value={shareLink} readOnly className="flex-1 bg-transparent text-[11px] text-foreground outline-none" dir="ltr" />
                <button onClick={() => { navigator.clipboard.writeText(shareLink); }} className="shrink-0 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[9px] font-medium hover:bg-primary/90 transition-all">
                  نسخ
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <MaterialIcon icon="check_circle" size={12} className="text-green-500" />
                تم إنشاء رابط المشاركة بنجاح{sharePassword ? ' (محمي بكلمة مرور)' : ''}
              </p>
              <button onClick={() => { setShareLink(null); setSharePassword(''); }} className="w-full py-2 rounded-xl border border-border text-[10px] text-muted-foreground hover:bg-accent transition-all">
                إنشاء رابط جديد
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">كلمة مرور (اختياري)</label>
                <input
                  type="password"
                  value={sharePassword}
                  onChange={e => setSharePassword(e.target.value)}
                  placeholder="اترك فارغاً للمشاركة بدون حماية"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-[11px] text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {shareLoading ? (
                  <><MaterialIcon icon="progress_activity" size={14} className="animate-spin" /> جاري الإنشاء...</>
                ) : (
                  <><MaterialIcon icon="link" size={14} /> إنشاء رابط مشاركة</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
// ─── Shared ToolbarBtn (local copy for independence) ─────────
function ToolbarBtn({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all active:scale-95 whitespace-nowrap ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      <MaterialIcon icon={icon} size={14} />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
