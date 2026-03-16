/* ═══════════════════════════════════════════════════════════════════
   AI Presentation Creator — v3
   
   3-Phase Generation Experience:
   Phase 1: Slides Outline — shows planned slides before generation
   Phase 2: Live Progress — real-time progress bar with step descriptions
   Phase 3: Slide Cards — large professional slides appearing one-by-one
   
   Features:
   - Content source: AI / User text / Library / File upload
   - Rich layouts: chart, table, infographic, timeline, kpi, pillars
   - NDMO branded opening/closing slides from reference PPTX
   - Per-slide edit capability with always-visible buttons
   - Professional designs matching Banana Pro quality
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import MaterialIcon from './MaterialIcon';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useTheme } from '@/contexts/ThemeContext';
import type { Slide, SlideElement, BrandKit, SlideBackground } from './PresentationsEngine';
import { RASED_USAGE } from '@/lib/rasedAssets';

// ─── CDN Assets ────────────────────────────────────────────────
const CDN = {
  ndmoTitleBg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB/ndmo-title-bg_f96b0f15.jpg',
  ndmoContentBg: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB/ndmo-content-bg_e5c58b79.jpg',
  sdaiaLogo: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB/sdaia-logo-full_2bb1df51.png',
  sdaiaGeometric: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663343528112/MEGvjvxgcHUoRKwHYpapiB/sdaia-geometric_aae10cbd.png',
};

// ─── Brand Definitions ──────────────────────────────────────────
interface BrandDef {
  id: string;
  label: string;
  icon: string;
  colors: { primary: string; secondary: string; accent: string; bg: string; teal: string };
  headingFont: string;
  bodyFont: string;
  headingColor: string;
  bodyColor: string;
  background: SlideBackground;
  titleBg: SlideBackground;
  closingBg: SlideBackground;
}

const BRANDS: BrandDef[] = [
  {
    id: 'ndmo', label: 'NDMO الرسمي', icon: 'verified',
    colors: { primary: '#0f1a2e', secondary: '#d4af37', accent: '#3E518E', bg: '#0f1a2e', teal: '#0CAB8F' },
    headingFont: "'DIN Next Arabic', sans-serif",
    bodyFont: "'Helvetica Neue Arabic', sans-serif",
    headingColor: '#ffffff',
    bodyColor: '#cbd5e1',
    background: { type: 'gradient', gradientFrom: '#0f1a2e', gradientTo: '#1a2744', gradientDirection: '135deg' },
    titleBg: { type: 'image', imageSrc: CDN.ndmoTitleBg },
    closingBg: { type: 'image', imageSrc: CDN.ndmoTitleBg },
  },
  {
    id: 'sdaia', label: 'سدايا', icon: 'hub',
    colors: { primary: '#1a73e8', secondary: '#374151', accent: '#60a5fa', bg: '#111827', teal: '#0CAB8F' },
    headingFont: "'DIN Next Arabic', sans-serif",
    bodyFont: "'Helvetica Neue Arabic', sans-serif",
    headingColor: '#f0f9ff',
    bodyColor: '#93c5fd',
    background: { type: 'gradient', gradientFrom: '#111827', gradientTo: '#1e3a5f', gradientDirection: '135deg' },
    titleBg: { type: 'gradient', gradientFrom: '#0f172a', gradientTo: '#1e3a5f', gradientDirection: '135deg' },
    closingBg: { type: 'gradient', gradientFrom: '#0f172a', gradientTo: '#1e3a5f', gradientDirection: '135deg' },
  },
  {
    id: 'modern', label: 'عصري', icon: 'auto_awesome',
    colors: { primary: '#6366f1', secondary: '#a78bfa', accent: '#818cf8', bg: '#ffffff', teal: '#10b981' },
    headingFont: "'Objectivity', 'DIN Next Arabic', sans-serif",
    bodyFont: "'Helvetica Neue Arabic', sans-serif",
    headingColor: '#1e1b4b',
    bodyColor: '#4b5563',
    background: { type: 'solid', color: '#ffffff' },
    titleBg: { type: 'gradient', gradientFrom: '#6366f1', gradientTo: '#8b5cf6', gradientDirection: '135deg' },
    closingBg: { type: 'gradient', gradientFrom: '#6366f1', gradientTo: '#8b5cf6', gradientDirection: '135deg' },
  },
  {
    id: 'minimal', label: 'بسيط', icon: 'remove',
    colors: { primary: '#1f2937', secondary: '#6b7280', accent: '#3b82f6', bg: '#fafafa', teal: '#10b981' },
    headingFont: "'Objectivity', 'DIN Next Arabic', sans-serif",
    bodyFont: "'Helvetica Neue Arabic', sans-serif",
    headingColor: '#111827',
    bodyColor: '#6b7280',
    background: { type: 'solid', color: '#fafafa' },
    titleBg: { type: 'gradient', gradientFrom: '#1f2937', gradientTo: '#374151', gradientDirection: '135deg' },
    closingBg: { type: 'gradient', gradientFrom: '#1f2937', gradientTo: '#374151', gradientDirection: '135deg' },
  },
];

// ─── Content Source Types ──────────────────────────────────────
type ContentSource = 'ai' | 'user' | 'library' | 'file';
interface ContentSourceDef {
  id: ContentSource;
  label: string;
  icon: string;
  desc: string;
}
const CONTENT_SOURCES: ContentSourceDef[] = [
  { id: 'ai', label: 'الذكاء الاصطناعي', icon: 'auto_awesome', desc: 'توليد محتوى دسم تلقائياً' },
  { id: 'user', label: 'محتوى مخصص', icon: 'edit_note', desc: 'اكتب المحتوى بنفسك' },
  { id: 'library', label: 'من المكتبة', icon: 'folder_open', desc: 'اختر ملف من مكتبتك' },
  { id: 'file', label: 'رفع ملف', icon: 'upload_file', desc: 'PDF, Word, TXT' },
];

// ─── Preset Templates ───────────────────────────────────────────
interface PresetTemplate {
  id: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  topic: string;
  slideCount: number;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'quarterly-report',
    label: 'تقرير ربعي',
    icon: 'assessment',
    color: '#0CAB8F',
    desc: 'تقرير أداء ربعي شامل بالمؤشرات والإنجازات',
    topic: 'تقرير الأداء الربعي لإدارة البيانات الوطنية - يتضمن مؤشرات الأداء الرئيسية والإنجازات والتحديات والخطط المستقبلية',
    slideCount: 15,
  },
  {
    id: 'strategic-plan',
    label: 'خطة استراتيجية',
    icon: 'flag',
    color: '#3E518E',
    desc: 'خطة استراتيجية متكاملة بالرؤية والأهداف والمبادرات',
    topic: 'الخطة الاستراتيجية لحوكمة البيانات الوطنية 2025-2030 - تتضمن الرؤية والرسالة والركائز الاستراتيجية والمبادرات والجدول الزمني',
    slideCount: 15,
  },
  {
    id: 'data-governance',
    label: 'حوكمة البيانات',
    icon: 'security',
    color: '#d4af37',
    desc: 'إطار حوكمة البيانات بالسياسات والمعايير والأدوار',
    topic: 'إطار حوكمة البيانات الوطنية - يتضمن السياسات والمعايير والأدوار والمسؤوليات وآليات الامتثال والرقابة',
    slideCount: 12,
  },
  {
    id: 'maturity-assessment',
    label: 'تقييم النضج',
    icon: 'trending_up',
    color: '#E74C3C',
    desc: 'نتائج تقييم نضج البيانات بالمستويات والتوصيات',
    topic: 'نتائج تقييم نضج إدارة البيانات الوطنية - يتضمن مستويات النضج لكل محور والفجوات وخطة التحسين والتوصيات',
    slideCount: 12,
  },
  {
    id: 'training-workshop',
    label: 'ورشة تدريبية',
    icon: 'school',
    color: '#8E44AD',
    desc: 'عرض تدريبي متكامل بالمفاهيم والتطبيقات',
    topic: 'ورشة تدريبية: أساسيات إدارة البيانات وجودتها - تتضمن المفاهيم الأساسية والمعايير والتطبيقات العملية ودراسات الحالة',
    slideCount: 10,
  },
  {
    id: 'open-data',
    label: 'البيانات المفتوحة',
    icon: 'public',
    color: '#2ECC71',
    desc: 'مبادرة البيانات المفتوحة بالأهداف والمنصات والإنجازات',
    topic: 'مبادرة البيانات المفتوحة الوطنية - تتضمن الرؤية والأهداف ومنصة البيانات المفتوحة والإنجازات والخطط المستقبلية',
    slideCount: 10,
  },
];

// ─── Outline Item (for the slides outline phase) ──────────────────
interface OutlineItem {
  index: number;
  title: string;
  description: string;
  layout: string;
  icon: string;
}

// Layout descriptions for the outline
const LAYOUT_META: Record<string, { title: string; desc: string; icon: string }> = {
  title: { title: 'شريحة غلاف رسمي', desc: 'الغلاف الرسمي بالهوية البصرية الكاملة مع الخلفية الأصلية والشعارات', icon: 'image' },
  toc: { title: 'فهرس المحتويات', desc: 'قائمة بجميع محاور العرض مع أرقام الشرائح', icon: 'toc' },
  'executive-summary': { title: 'ملخص تنفيذي', desc: 'ملخص شامل بأبرز النتائج والمؤشرات الرئيسية', icon: 'summarize' },
  pillars: { title: 'ركائز ومحاور', desc: 'الركائز الرئيسية للموضوع مع أيقونات ووصف', icon: 'account_tree' },
  content: { title: 'شريحة محتوى', desc: 'محتوى نصي غني مع نقاط تفصيلية وفقرات تحليلية', icon: 'article' },
  chart: { title: 'شريحة رسم بياني', desc: 'رسم بياني تفاعلي مع بيانات وتحليلات مفصلة', icon: 'bar_chart' },
  table: { title: 'شريحة جدول بيانات', desc: 'جدول احترافي بأعمدة وصفوف وحالات ملونة', icon: 'table_chart' },
  infographic: { title: 'شريحة إنفوجرافيك', desc: 'بطاقات بصرية مع أيقونات وأرقام وإحصائيات بارزة', icon: 'insights' },
  kpi: { title: 'شريحة مؤشرات أداء', desc: 'مؤشرات أداء رئيسية بأرقام كبيرة وبارزة مع مقارنات', icon: 'speed' },
  timeline: { title: 'شريحة خط زمني', desc: 'خط زمني يوضح المراحل والأحداث الرئيسية بالتسلسل', icon: 'timeline' },
  'two-column': { title: 'شريحة عمودين', desc: 'تقسيم المحتوى إلى عمودين متوازيين للمقارنة', icon: 'view_column' },
  quote: { title: 'شريحة اقتباس', desc: 'اقتباس مميز بتصميم أنيق ومؤثر', icon: 'format_quote' },
  closing: { title: 'شريحة ختام', desc: 'الختام الرسمي مع شكر وتقدير وبيانات التواصل', icon: 'celebration' },
};

// ─── Utility ────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

// ─── AI Slide type from backend ─────────────────────────────────
interface AISlideData {
  title: string;
  subtitle: string;
  content: string;
  bulletPoints: string[];
  notes: string;
  layout: string;
  chartType?: string;
  chartData?: number[];
  chartLabels?: string[];
  chartColors?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  infographicItems?: { icon: string; label: string; value: string }[];
  timelineItems?: { year: string; title: string; description: string }[];
}

// ─── Convert AI slide to real Slide object ──────────────────────
function aiSlideToSlide(aiSlide: AISlideData, brand: BrandDef, index: number, total: number): Slide {
  const elements: SlideElement[] = [];
  const layout = aiSlide.layout || 'content';
  const isDark = brand.background.type !== 'solid' || brand.background.color !== '#ffffff';
  const cardBg = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';

  // ═══ TITLE SLIDE (first) ═══
  if (layout === 'title' || index === 0) {
    elements.push({
      id: uid(), type: 'heading', x: 8, y: 18, width: 84, height: 20,
      content: aiSlide.title,
      style: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', fontFamily: brand.headingFont },
    });
    if (aiSlide.subtitle) {
      elements.push({
        id: uid(), type: 'text', x: 12, y: 42, width: 76, height: 10,
        content: aiSlide.subtitle,
        style: { fontSize: 18, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontFamily: brand.bodyFont },
      });
    }
    elements.push({
      id: uid(), type: 'shape', x: 35, y: 56, width: 30, height: 0.5, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    elements.push({
      id: uid(), type: 'text', x: 25, y: 62, width: 50, height: 6,
      content: new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }),
      style: { fontSize: 14, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: brand.bodyFont },
    });
    return {
      id: uid(), layout: 'title', notes: aiSlide.notes || '',
      background: { ...brand.titleBg },
      transition: { type: 'fade', duration: 500 }, elements,
    };
  }

  // ═══ CLOSING SLIDE (last) ═══
  if (layout === 'closing' || index === total - 1) {
    elements.push({
      id: uid(), type: 'heading', x: 10, y: 28, width: 80, height: 15,
      content: aiSlide.title || 'حفظكم الله',
      style: { fontSize: 40, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 35, y: 48, width: 30, height: 0.5, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    if (aiSlide.content) {
      elements.push({
        id: uid(), type: 'text', x: 15, y: 54, width: 70, height: 10,
        content: aiSlide.content,
        style: { fontSize: 16, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontFamily: brand.bodyFont },
      });
    }
    return {
      id: uid(), layout: 'closing', notes: aiSlide.notes || '',
      background: { ...brand.closingBg },
      transition: { type: 'fade', duration: 500 }, elements,
    };
  }

  // ═══ TOC SLIDE (Table of Contents) ═══
  if (layout === 'toc') {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title || 'فهرس المحتويات',
      style: { fontSize: 28, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    if (aiSlide.content) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 15, width: 90, height: 6,
        content: aiSlide.content,
        style: { fontSize: 13, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, opacity: 0.7 },
      });
    }
    const bps = aiSlide.bulletPoints || [];
    bps.forEach((bp, i) => {
      const yPos = 24 + i * 9;
      // Number circle
      elements.push({
        id: uid(), type: 'shape', x: 82, y: yPos, width: 6, height: 6, content: '',
        style: { backgroundColor: brand.colors.accent, shapeType: 'circle', borderRadius: 50, opacity: 0.15 },
      });
      elements.push({
        id: uid(), type: 'text', x: 82, y: yPos + 0.5, width: 6, height: 5,
        content: `${i + 1}`,
        style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: brand.colors.accent, fontFamily: brand.headingFont },
      });
      // Topic text
      elements.push({
        id: uid(), type: 'text', x: 5, y: yPos + 0.5, width: 74, height: 5,
        content: bp,
        style: { fontSize: 14, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, lineHeight: 1.6 },
      });
      // Divider line
      if (i < bps.length - 1) {
        elements.push({
          id: uid(), type: 'shape', x: 5, y: yPos + 7.5, width: 83, height: 0.15, content: '',
          style: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0', shapeType: 'rect', borderRadius: 0 },
        });
      }
    });
    return {
      id: uid(), layout: 'toc', notes: aiSlide.notes || '',
      background: { ...brand.background },
      transition: { type: 'fade', duration: 500 }, elements,
    };
  }

  // ═══ EXECUTIVE SUMMARY SLIDE ═══
  if (layout === 'executive-summary') {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title || 'الملخص التنفيذي',
      style: { fontSize: 26, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    // KPI cards at top
    const infoItems = (aiSlide.infographicItems || []).slice(0, 4);
    if (infoItems.length > 0) {
      const cols = infoItems.length;
      infoItems.forEach((item, i) => {
        const w = 90 / cols - 2;
        elements.push({
          id: uid(), type: 'icon', x: 5 + i * (w + 2), y: 17, width: w, height: 22,
          content: JSON.stringify(item),
          style: {
            fontSize: 12, textAlign: 'center', color: brand.bodyColor, fontFamily: brand.bodyFont,
            backgroundColor: cardBg, borderRadius: 10, padding: 8,
            borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
          },
        });
      });
    }
    // Summary text
    if (aiSlide.content) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 42, width: 90, height: 18,
        content: aiSlide.content,
        style: { fontSize: 13, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, lineHeight: 1.8, opacity: 0.9 },
      });
    }
    // Key findings as bullet list
    const bps = aiSlide.bulletPoints || [];
    if (bps.length > 0) {
      elements.push({
        id: uid(), type: 'list', x: 5, y: 62, width: 90, height: 32, content: '',
        style: { fontSize: 13, color: brand.bodyColor, fontFamily: brand.bodyFont, listItems: bps, listStyle: 'check', lineHeight: 1.8 },
      });
    }
    return {
      id: uid(), layout: 'executive-summary', notes: aiSlide.notes || '',
      background: { ...brand.background },
      transition: { type: 'fade', duration: 500 }, elements,
    };
  }

  // ═══ PILLARS SLIDE ═══
  if (layout === 'pillars') {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title || 'الركائز الرئيسية',
      style: { fontSize: 26, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    if (aiSlide.subtitle) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 15, width: 90, height: 5,
        content: aiSlide.subtitle,
        style: { fontSize: 13, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, opacity: 0.7 },
      });
    }
    // Pillar cards
    const pillars = (aiSlide.infographicItems || []).slice(0, 5);
    if (pillars.length > 0) {
      const cols = pillars.length;
      const w = 90 / cols - 2;
      pillars.forEach((item, i) => {
        elements.push({
          id: uid(), type: 'icon', x: 5 + i * (w + 2), y: 23, width: w, height: 45,
          content: JSON.stringify(item),
          style: {
            fontSize: 13, textAlign: 'center', color: brand.bodyColor, fontFamily: brand.bodyFont,
            backgroundColor: cardBg, borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
          },
        });
      });
    }
    // Description text
    if (aiSlide.content) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 72, width: 90, height: 22,
        content: aiSlide.content,
        style: { fontSize: 12, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, lineHeight: 1.7, opacity: 0.8 },
      });
    }
    return {
      id: uid(), layout: 'pillars', notes: aiSlide.notes || '',
      background: { ...brand.background },
      transition: { type: 'fade', duration: 500 }, elements,
    };
  }

  // ═══ CHART SLIDE ═══
  if (layout === 'chart' && aiSlide.chartData && aiSlide.chartData.length > 0) {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    if (aiSlide.subtitle) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 15, width: 90, height: 5,
        content: aiSlide.subtitle,
        style: { fontSize: 13, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, opacity: 0.7 },
      });
    }
    elements.push({
      id: uid(), type: 'chart', x: 5, y: 22, width: 90, height: 55, content: '',
      style: {
        chartType: (aiSlide.chartType as any) || 'bar',
        chartData: aiSlide.chartData,
        chartLabels: aiSlide.chartLabels || [],
        chartColors: aiSlide.chartColors && aiSlide.chartColors.length > 0
          ? aiSlide.chartColors
          : [brand.colors.accent, brand.colors.teal, brand.colors.secondary, '#F2613C', '#FF6600', '#8b5cf6'],
        borderRadius: 8,
        backgroundColor: cardBg,
        padding: 16,
      },
    });
    if (aiSlide.content) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 80, width: 90, height: 15,
        content: aiSlide.content,
        style: { fontSize: 12, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, opacity: 0.8, lineHeight: 1.6 },
      });
    }
  }
  // ═══ TABLE SLIDE ═══
  else if (layout === 'table' && aiSlide.tableHeaders && aiSlide.tableHeaders.length > 0) {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    elements.push({
      id: uid(), type: 'table', x: 5, y: 18, width: 90, height: 72, content: JSON.stringify({
        headers: aiSlide.tableHeaders,
        rows: aiSlide.tableRows || [],
      }),
      style: {
        fontSize: 12, color: brand.bodyColor, fontFamily: brand.bodyFont,
        backgroundColor: cardBg, borderRadius: 8, padding: 8,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
      },
    });
  }
  // ═══ INFOGRAPHIC SLIDE ═══
  else if (layout === 'infographic' && aiSlide.infographicItems && aiSlide.infographicItems.length > 0) {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    const items = aiSlide.infographicItems.slice(0, 6);
    const cols = items.length <= 3 ? items.length : Math.min(3, items.length);
    const rows = Math.ceil(items.length / cols);
    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const w = 90 / cols - 2;
      const h = rows > 1 ? 30 : 60;
      elements.push({
        id: uid(), type: 'icon', x: 5 + col * (w + 2), y: 18 + row * (h + 4), width: w, height: h,
        content: JSON.stringify(item),
        style: {
          fontSize: 14, textAlign: 'center', color: brand.bodyColor, fontFamily: brand.bodyFont,
          backgroundColor: cardBg, borderRadius: 12, padding: 12,
        },
      });
    });
  }
  // ═══ TIMELINE SLIDE ═══
  else if (layout === 'timeline' && aiSlide.timelineItems && aiSlide.timelineItems.length > 0) {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    elements.push({
      id: uid(), type: 'shape', x: 48, y: 18, width: 0.4, height: 75, content: '',
      style: { backgroundColor: brand.colors.teal, shapeType: 'rect', borderRadius: 4, opacity: 0.4 },
    });
    const items = aiSlide.timelineItems.slice(0, 5);
    items.forEach((item, i) => {
      const isLeft = i % 2 === 0;
      elements.push({
        id: uid(), type: 'text', x: isLeft ? 5 : 52, y: 18 + i * 15, width: 42, height: 13,
        content: `${item.year}\n${item.title}\n${item.description}`,
        style: {
          fontSize: 11, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont,
          backgroundColor: cardBg, borderRadius: 10, padding: 8, lineHeight: 1.6,
        },
      });
      elements.push({
        id: uid(), type: 'shape', x: 47, y: 21 + i * 15, width: 2.5, height: 2.5, content: '',
        style: { backgroundColor: brand.colors.teal, shapeType: 'circle', borderRadius: 50 },
      });
    });
  }
  // ═══ KPI SLIDE ═══
  else if (layout === 'kpi') {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    // Use infographicItems for KPI if available
    const infoItems = aiSlide.infographicItems || [];
    if (infoItems.length > 0) {
      const cols = Math.min(infoItems.length, 4);
      infoItems.slice(0, 4).forEach((item, i) => {
        const w = 90 / cols - 2;
        elements.push({
          id: uid(), type: 'icon', x: 5 + i * (w + 2), y: 20, width: w, height: 65,
          content: JSON.stringify(item),
          style: {
            fontSize: 14, textAlign: 'center', color: brand.bodyColor, fontFamily: brand.bodyFont,
            backgroundColor: cardBg, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
          },
        });
      });
    } else {
      const bps = aiSlide.bulletPoints || [];
      const kpiItems = bps.slice(0, 4);
      const cols = kpiItems.length <= 2 ? kpiItems.length : 2;
      kpiItems.forEach((bp, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        elements.push({
          id: uid(), type: 'text', x: 5 + col * 47, y: 18 + row * 34, width: 43, height: 30,
          content: bp,
          style: {
            fontSize: 14, textAlign: 'center', color: brand.bodyColor, fontFamily: brand.bodyFont,
            backgroundColor: cardBg, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
          },
        });
      });
    }
  }
  // ═══ QUOTE SLIDE ═══
  else if (layout === 'quote') {
    elements.push({
      id: uid(), type: 'text', x: 10, y: 12, width: 80, height: 10,
      content: '❝',
      style: { fontSize: 64, textAlign: 'center', color: brand.colors.secondary, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'text', x: 10, y: 30, width: 80, height: 25,
      content: aiSlide.content || aiSlide.title,
      style: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: brand.headingColor, fontFamily: brand.headingFont, lineHeight: 1.9 },
    });
    if (aiSlide.subtitle) {
      elements.push({
        id: uid(), type: 'text', x: 20, y: 60, width: 60, height: 8,
        content: `— ${aiSlide.subtitle}`,
        style: { fontSize: 14, textAlign: 'center', color: brand.bodyColor, fontFamily: brand.bodyFont, opacity: 0.7 },
      });
    }
  }
  // ═══ TWO-COLUMN SLIDE ═══
  else if (layout === 'two-column') {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    const bps = aiSlide.bulletPoints || [];
    const half = Math.ceil(bps.length / 2);
    if (bps.length > 0) {
      elements.push({
        id: uid(), type: 'list', x: 5, y: 18, width: 43, height: 75, content: '',
        style: { fontSize: 13, color: brand.bodyColor, fontFamily: brand.bodyFont, listItems: bps.slice(0, half), listStyle: 'bullet', lineHeight: 1.8 },
      });
    }
    if (bps.length > half) {
      elements.push({
        id: uid(), type: 'list', x: 52, y: 18, width: 43, height: 75, content: '',
        style: { fontSize: 13, color: brand.bodyColor, fontFamily: brand.bodyFont, listItems: bps.slice(half), listStyle: 'bullet', lineHeight: 1.8 },
      });
    }
  }
  // ═══ DEFAULT CONTENT SLIDE ═══
  else {
    elements.push({
      id: uid(), type: 'heading', x: 5, y: 4, width: 90, height: 8,
      content: aiSlide.title,
      style: { fontSize: 26, fontWeight: 'bold', textAlign: 'right', color: brand.headingColor, fontFamily: brand.headingFont },
    });
    elements.push({
      id: uid(), type: 'shape', x: 5, y: 13, width: 18, height: 0.4, content: '',
      style: { backgroundColor: brand.colors.secondary, shapeType: 'rect', borderRadius: 4 },
    });
    if (aiSlide.subtitle) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 15, width: 90, height: 5,
        content: aiSlide.subtitle,
        style: { fontSize: 14, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, opacity: 0.7 },
      });
    }
    const bps = aiSlide.bulletPoints || [];
    if (bps.length > 0) {
      elements.push({
        id: uid(), type: 'list', x: 5, y: 22, width: 90, height: 70, content: '',
        style: { fontSize: 14, color: brand.bodyColor, fontFamily: brand.bodyFont, listItems: bps, listStyle: 'check', lineHeight: 2.0 },
      });
    } else if (aiSlide.content) {
      elements.push({
        id: uid(), type: 'text', x: 5, y: 22, width: 90, height: 70,
        content: aiSlide.content,
        style: { fontSize: 14, textAlign: 'right', color: brand.bodyColor, fontFamily: brand.bodyFont, lineHeight: 1.9 },
      });
    }
  }

  return {
    id: uid(), layout, notes: aiSlide.notes || '',
    background: { ...brand.background },
    transition: { type: 'fade', duration: 500 }, elements,
  };
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT 1: Slides Outline (shown before generation starts)
// ═══════════════════════════════════════════════════════════════════
function SlidesOutline({ items, title, collapsed, onToggle }: {
  items: OutlineItem[];
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden animate-fade-in shadow-lg">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent/30 transition-all"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <MaterialIcon icon="view_list" size={20} className="text-primary" />
        </div>
        <div className="flex-1 text-right min-w-0">
          <p className="text-[14px] font-bold text-foreground">هيكل الشرائح</p>
          <p className="text-[11px] text-muted-foreground truncate">{title}</p>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-[11px]">{collapsed ? 'توسيع' : 'طي'}</span>
          <MaterialIcon icon={collapsed ? 'expand_more' : 'expand_less'} size={18} />
        </div>
      </button>

      {/* Outline Items */}
      {!collapsed && (
        <div className="px-5 pb-5">
          <div className="space-y-0">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 py-3 animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Number badge with vertical line */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-9 h-9 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
                    <span className="text-[14px] font-bold text-primary">{item.index + 1}</span>
                  </div>
                  {i < items.length - 1 && (
                    <div className="w-0.5 h-6 bg-gradient-to-b from-primary/30 to-transparent mt-1" />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <p className="text-[14px] font-bold text-foreground leading-relaxed">{item.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT 2: Live Progress Bar (shown during generation)
// ═══════════════════════════════════════════════════════════════════
function LiveProgressBar({ current, total, currentTitle, elapsed, expanded, onToggle }: {
  current: number;
  total: number;
  currentTitle: string;
  elapsed: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/90 backdrop-blur-sm overflow-hidden shadow-lg animate-fade-in">
      {/* Progress bar at top */}
      <div className="h-1 bg-accent/30 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-l from-primary via-primary/80 to-primary/60 transition-all duration-1000 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Main bar */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-all"
      >
        {/* Terminal preview thumbnail */}
        <div className="w-10 h-10 rounded-lg bg-[#1a1a2e] border border-border/30 flex items-center justify-center shrink-0 overflow-hidden relative">
          <div className="absolute inset-0 flex flex-col p-1 gap-0.5">
            <div className="h-[2px] w-6 bg-emerald-400/40 rounded" />
            <div className="h-[2px] w-4 bg-blue-400/30 rounded" />
            <div className="h-[2px] w-7 bg-amber-400/20 rounded" />
            <div className="h-[2px] w-3 bg-emerald-400/30 rounded" />
          </div>
        </div>

        {/* Status indicator */}
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />

        {/* Description */}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[12px] font-medium text-foreground truncate">{currentTitle}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
            <span className="text-[10px] text-muted-foreground">جاري الإنشاء...</span>
          </div>
        </div>

        {/* Counter */}
        <div className="text-[13px] text-muted-foreground font-medium shrink-0">
          {current} / {total}
        </div>

        {/* Expand/collapse */}
        <MaterialIcon icon={expanded ? 'expand_less' : 'expand_more'} size={18} className="text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT 3: Large Slide Preview Card (full-width, professional)
// ═══════════════════════════════════════════════════════════════════

// --- SVG Bar Chart ---
function BarChart({ data, labels, colors, width = 400, height = 180 }: { data: number[]; labels: string[]; colors: string[]; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const barW = Math.min(40, (width - 80) / data.length - 8);
  const chartH = height - 40;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <g key={i}>
          <line x1={50} y1={10 + chartH * (1 - pct)} x2={width - 10} y2={10 + chartH * (1 - pct)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
          <text x={45} y={14 + chartH * (1 - pct)} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontSize={9}>{Math.round(max * pct)}</text>
        </g>
      ))}
      {/* Bars */}
      {data.map((val, i) => {
        const barH = (val / max) * chartH;
        const x = 60 + i * ((width - 80) / data.length);
        const y = 10 + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={colors[i % colors.length]} opacity={0.9} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill={colors[i % colors.length]} fontSize={10} fontWeight="bold">{val}</text>
            <text x={x + barW / 2} y={height - 5} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontSize={8}>{labels[i] || ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

// --- SVG Pie Chart ---
function PieChart({ data, labels, colors, size = 160 }: { data: number[]; labels: string[]; colors: string[]; size?: number }) {
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let cumAngle = -90;
  const slices = data.map((val, i) => {
    const angle = (val / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return <path key={i} d={d} fill={colors[i % colors.length]} />;
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{slices}</svg>
      <div className="flex flex-col gap-1.5">
        {labels.slice(0, 6).map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-[11px]" style={{ color: 'inherit', opacity: 0.7 }}>{label}</span>
            <span className="text-[11px] font-bold" style={{ color: colors[i % colors.length] }}>{data[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- SVG Line Chart ---
function LineChart({ data, labels, colors, width = 400, height = 160 }: { data: number[]; labels: string[]; colors: string[]; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const chartH = height - 35;
  const chartW = width - 60;
  const points = data.map((val, i) => {
    const x = 50 + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = 10 + chartH - ((val - min) / range) * chartH;
    return { x, y, val };
  });
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `50,${10 + chartH} ${linePoints} ${50 + chartW},${10 + chartH}`;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <line key={i} x1={50} y1={10 + chartH * (1 - pct)} x2={width - 10} y2={10 + chartH * (1 - pct)} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
      ))}
      {/* Area fill */}
      <polygon points={areaPoints} fill={colors[0] || '#3b82f6'} opacity={0.1} />
      {/* Line */}
      <polyline points={linePoints} fill="none" stroke={colors[0] || '#3b82f6'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Points and labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={colors[0] || '#3b82f6'} />
          <circle cx={p.x} cy={p.y} r={2} fill="white" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fill={colors[0] || '#3b82f6'} fontSize={9} fontWeight="bold">{p.val}</text>
          <text x={p.x} y={height - 5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontSize={8}>{labels[i] || ''}</text>
        </g>
      ))}
    </svg>
  );
}

// --- Professional Table ---
function SlideTable({ headers, rows, brandColor, bodyColor, isDark }: { headers: string[]; rows: string[][]; brandColor: string; bodyColor: string; isDark: boolean }) {
  return (
    <div className="w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
      {/* Header row */}
      <div className="flex" style={{ backgroundColor: brandColor }}>
        {headers.map((h, i) => (
          <div key={i} className="flex-1 px-3 py-2.5 border-l first:border-l-0" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            <span className="text-[11px] font-bold text-white block text-center">{h}</span>
          </div>
        ))}
      </div>
      {/* Data rows */}
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          backgroundColor: ri % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc') : 'transparent',
        }}>
          {row.map((cell, ci) => (
            <div key={ci} className="flex-1 px-3 py-2 border-l first:border-l-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }}>
              <span className="text-[10px] block text-center" style={{ color: bodyColor, opacity: 0.85 }}>{cell}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Infographic Card ---
function InfoCard({ icon, label, value, color, bgColor }: { icon: string; label: string; value: string; color: string; bgColor: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-4 gap-2 transition-all" style={{ backgroundColor: bgColor }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <MaterialIcon icon={icon} size={24} style={{ color }} />
      </div>
      <span className="text-[22px] font-black" style={{ color }}>{value}</span>
      <span className="text-[11px] text-center leading-snug" style={{ color: 'inherit', opacity: 0.7 }}>{label}</span>
    </div>
  );
}

// --- Timeline Item ---
function TimelineVis({ items, tealColor, bodyColor, bgColor }: { items: { year: string; title: string; description: string }[]; tealColor: string; bodyColor: string; bgColor: string }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute right-[20px] top-0 bottom-0 w-[3px] rounded-full" style={{ backgroundColor: `${tealColor}30` }} />
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-4 relative animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
            {/* Dot */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-2" style={{ backgroundColor: bgColor, borderColor: tealColor }}>
              <span className="text-[10px] font-bold" style={{ color: tealColor }}>{item.year}</span>
            </div>
            {/* Content */}
            <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: `${tealColor}08`, border: `1px solid ${tealColor}15` }}>
              <p className="text-[12px] font-bold" style={{ color: bodyColor }}>{item.title}</p>
              <p className="text-[10px] mt-1 leading-relaxed" style={{ color: bodyColor, opacity: 0.7 }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ HTML Slide Card (renders full HTML template via iframe) ═══
function HtmlSlideCard({ html, title, layout, index, total, isNew, brand }: {
  html: string;
  title: string;
  layout: string;
  index: number;
  total: number;
  isNew: boolean;
  brand: BrandDef;
}) {
  const layoutLabel: Record<string, string> = {
    title: 'الغلاف', closing: 'الختام', content: 'محتوى', 'two-column': 'عمودين',
    kpi: 'مؤشرات أداء', chart: 'رسم بياني', table: 'جدول', infographic: 'إنفوجرافيك',
    timeline: 'خط زمني', quote: 'اقتباس', toc: 'فهرس المحتويات',
    'executive-summary': 'الملخص التنفيذي', pillars: 'الركائز الرئيسية',
  };

  return (
    <div data-slide-card className={`rounded-2xl overflow-hidden border transition-all duration-700 shadow-xl hover:shadow-2xl ${isNew ? 'animate-slide-card-enter' : ''} border-border/30`}>
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: `${brand.colors.secondary}15`, color: brand.colors.secondary }}>
            {index + 1}
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground leading-tight">{title}</p>
            <p className="text-[9px] text-muted-foreground">{layoutLabel[layout] || layout}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[9px] font-bold flex items-center gap-1">
            <MaterialIcon icon="html" size={12} />
            HTML
          </span>
          <span className="text-[9px] text-muted-foreground">{index + 1}/{total}</span>
        </div>
      </div>

      {/* Gradient accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${brand.colors.teal}, ${brand.colors.accent}, ${brand.colors.secondary})` }} />

      {/* HTML Slide Content via iframe */}
      <div data-slide-content className="aspect-[16/9] relative overflow-hidden bg-white">
        <iframe
          srcDoc={html}
          className="w-full h-full border-0"
          style={{ pointerEvents: 'none' }}
          sandbox="allow-scripts"
          title={`شريحة ${index + 1}`}
        />
      </div>
    </div>
  );
}

// ═══ The Large Slide Card (with inline editing) ═══
function LargeSlideCard({ slide, index, total, brand, isNew, onEdit, onSaveInline, isDragging, dragHandleProps }: {
  slide: Slide; index: number; total: number; brand: BrandDef; isNew: boolean; onEdit?: () => void;
  onSaveInline?: (updatedSlide: Slide) => void;
  isDragging?: boolean;
  dragHandleProps?: {
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    draggable: boolean;
  };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editElements, setEditElements] = useState<SlideElement[]>([]);
  const [editLayout, setEditLayout] = useState(slide.layout);
  const [rewriting, setRewriting] = useState(false);
  const rewriteMutation = trpc.ai.chat.useMutation();

  const startEditing = () => {
    setEditElements([...slide.elements]);
    setEditLayout(slide.layout);
    setIsEditing(true);
  };
  const cancelEditing = () => { setIsEditing(false); setEditElements([]); };
  const saveEditing = () => {
    if (onSaveInline) onSaveInline({ ...slide, elements: editElements, layout: editLayout });
    setIsEditing(false);
  };
  const updateEl = (elId: string, updates: Partial<SlideElement>) => {
    setEditElements(prev => prev.map(el => el.id === elId ? { ...el, ...updates } : el));
  };
  const updateElStyle = (elId: string, styleUpdates: Partial<SlideElement['style']>) => {
    setEditElements(prev => prev.map(el => el.id === elId ? { ...el, style: { ...el.style, ...styleUpdates } } : el));
  };
  const handleAIRewrite = async (elId: string, currentContent: string, instruction: string) => {
    setRewriting(true);
    try {
      const result = await rewriteMutation.mutateAsync({
        messages: [{ role: 'user', content: `أعد كتابة النص التالي بأسلوب احترافي لعرض تقديمي. ${instruction}\n\nالنص الحالي:\n${currentContent}\n\nأعد النص فقط بدون أي شرح إضافي. اكتب بالعربية.` }],
        context: 'أنت كاتب محتوى محترف للعروض التقديمية. أعد النص المطلوب فقط بدون مقدمات.',
      });
      if (result?.content) updateEl(elId, { content: result.content.trim() });
    } catch (err) { console.error('AI rewrite failed:', err); }
    finally { setRewriting(false); }
  };
  const parseTableContent = (content: string): { headers: string[]; rows: string[][] } | null => {
    try { return JSON.parse(content); } catch { return null; }
  };
  const parseInfoItem = (content: string): { icon: string; label: string; value: string } | null => {
    try { return JSON.parse(content); } catch { return null; }
  };
  const inlineLayoutOptions = [
    { id: 'content', label: 'محتوى', icon: 'article' },
    { id: 'two-column', label: 'عمودين', icon: 'view_column' },
    { id: 'toc', label: 'فهرس', icon: 'view_list' },
    { id: 'executive-summary', label: 'ملخص تنفيذي', icon: 'summarize' },
    { id: 'pillars', label: 'ركائز', icon: 'view_column_2' },
    { id: 'kpi', label: 'مؤشرات', icon: 'speed' },
    { id: 'chart', label: 'رسم بياني', icon: 'bar_chart' },
    { id: 'table', label: 'جدول', icon: 'table_chart' },
    { id: 'infographic', label: 'إنفوجرافيك', icon: 'insights' },
    { id: 'timeline', label: 'خط زمني', icon: 'timeline' },
    { id: 'quote', label: 'اقتباس', icon: 'format_quote' },
  ];
  const isDark = brand.background.type !== 'solid' || brand.background.color !== '#ffffff';
  const bgStyle: React.CSSProperties = {};
  if (slide.background.type === 'gradient') {
    bgStyle.background = `linear-gradient(${slide.background.gradientDirection || '135deg'}, ${slide.background.gradientFrom}, ${slide.background.gradientTo})`;
  } else if (slide.background.type === 'solid') {
    bgStyle.backgroundColor = slide.background.color;
  } else if (slide.background.type === 'image' && slide.background.imageSrc) {
    bgStyle.backgroundImage = `url(${slide.background.imageSrc})`;
    bgStyle.backgroundSize = 'cover';
    bgStyle.backgroundPosition = 'center';
  }

  const heading = slide.elements.find(e => e.type === 'heading');
  const subtitle = slide.elements.find(e => e.type === 'text' && e.style.opacity && e.style.opacity < 1);
  const list = slide.elements.find(e => e.type === 'list');
  const chart = slide.elements.find(e => e.type === 'chart');
  const table = slide.elements.find(e => e.type === 'table');
  const infographic = slide.elements.filter(e => e.type === 'icon');
  const bodyText = slide.elements.find(e => e.type === 'text' && !e.style.opacity && e.style.fontSize && e.style.fontSize <= 16 && e.style.fontSize >= 12);
  const timelineTexts = slide.layout === 'timeline' ? slide.elements.filter(e => e.type === 'text' && e.style.backgroundColor) : [];

  const chartData = chart?.style.chartData || [];
  const chartLabels = chart?.style.chartLabels || [];
  const chartColors = chart?.style.chartColors || [brand.colors.accent, brand.colors.teal, brand.colors.secondary, '#F2613C', '#FF6600', '#8b5cf6'];
  const chartType = chart?.style.chartType || 'bar';

  let tableData: { headers: string[]; rows: string[][] } | null = null;
  if (table) { try { tableData = JSON.parse(table.content); } catch { /* */ } }

  const infoItems: { icon: string; label: string; value: string }[] = [];
  infographic.forEach(el => { try { const item = JSON.parse(el.content); if (item.icon && item.label) infoItems.push(item); } catch { /* */ } });

  const timelineItems: { year: string; title: string; description: string }[] = [];
  timelineTexts.forEach(el => {
    const parts = el.content.split('\n');
    if (parts.length >= 2) timelineItems.push({ year: parts[0], title: parts[1], description: parts[2] || '' });
  });

  const layoutLabel: Record<string, string> = {
    title: 'الغلاف', closing: 'الختام', content: 'محتوى', 'two-column': 'عمودين',
    kpi: 'مؤشرات أداء', chart: 'رسم بياني', table: 'جدول', infographic: 'إنفوجرافيك',
    timeline: 'خط زمني', quote: 'اقتباس', toc: 'فهرس المحتويات',
    'executive-summary': 'الملخص التنفيذي', pillars: 'الركائز الرئيسية',
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9';

  return (
    <div data-slide-card className={`rounded-2xl overflow-hidden border transition-all duration-700 shadow-xl hover:shadow-2xl ${isNew ? 'animate-slide-card-enter' : ''} ${isDragging ? 'opacity-50 scale-[0.98] border-primary/50 ring-2 ring-primary/30' : 'border-border/30'}`}>
      {/* ─── Card Header ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border/30">
        <div className="flex items-center gap-3">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="w-6 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-md hover:bg-accent/50 transition-colors -mr-1"
              title="اسحب لإعادة الترتيب"
            >
              <MaterialIcon icon="drag_indicator" size={16} className="text-muted-foreground" />
            </div>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold text-white shadow-sm" style={{ backgroundColor: brand.colors.accent }}>
            {index + 1}
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">{heading?.content || `شريحة ${index + 1}`}</p>
            <p className="text-[10px] text-muted-foreground">{layoutLabel[slide.layout] || slide.layout} • {index + 1}/{total}</p>
          </div>
        </div>
        {onSaveInline && !isEditing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-all active:scale-95"
          >
            <MaterialIcon icon="edit" size={14} />
            تعديل
          </button>
        )}
        {isEditing && (
          <div className="flex items-center gap-1.5">
            {rewriting && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10">
                <img src={RASED_USAGE.loadingAI} alt="" className="w-4 h-4 object-contain animate-bounce-once" />
                <span className="text-[9px] text-amber-600 font-medium">جاري الكتابة...</span>
              </div>
            )}
            <button onClick={saveEditing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 text-[11px] font-medium hover:bg-emerald-500/25 transition-all active:scale-95">
              <MaterialIcon icon="check" size={14} />
              حفظ
            </button>
            <button onClick={cancelEditing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-muted-foreground text-[11px] font-medium hover:bg-accent/80 transition-all active:scale-95">
              <MaterialIcon icon="close" size={14} />
              إلغاء
            </button>
          </div>
        )}
      </div>

      {/* ─── Gradient accent bar ─── */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${brand.colors.teal}, ${brand.colors.accent}, ${brand.colors.secondary})` }} />

      {/* ─── Slide Content ─── */}
      <div data-slide-content className="aspect-[16/9] relative overflow-hidden" style={bgStyle}>
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>

          {/* ── Title / Closing ── */}
          {(slide.layout === 'title' || slide.layout === 'closing') && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              {heading && (
                <h2 className="text-[28px] sm:text-[36px] font-bold leading-tight text-center" style={{ color: '#ffffff', fontFamily: brand.headingFont }}>
                  {heading.content}
                </h2>
              )}
              <div className="w-20 h-[3px] rounded-full" style={{ backgroundColor: brand.colors.secondary }} />
              {subtitle && (
                <p className="text-[14px] sm:text-[16px] text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)', fontFamily: brand.bodyFont }}>
                  {subtitle.content}
                </p>
              )}
            </div>
          )}

          {/* ── TOC (Table of Contents) ── */}
          {slide.layout === 'toc' && (
            <>
              {heading && (
                <h3 className="text-[20px] sm:text-[26px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-4" style={{ backgroundColor: brand.colors.secondary }} />
              {subtitle && <p className="text-[11px] mb-3 opacity-60" style={{ textAlign: 'right' }}>{subtitle.content}</p>}
              <div className="flex-1 space-y-1">
                {(list?.style.listItems || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brand.colors.accent}18` }}>
                      <span className="text-[14px] font-bold" style={{ color: brand.colors.accent }}>{i + 1}</span>
                    </div>
                    <span className="text-[13px] font-medium flex-1" style={{ textAlign: 'right' }}>{item}</span>
                  </div>
                ))}
                {/* Fallback: use bulletPoints from text elements */}
                {!list && slide.elements.filter(e => e.type === 'text' && !e.style.opacity && e.style.fontSize === 14).map((el, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brand.colors.accent}18` }}>
                      <span className="text-[14px] font-bold" style={{ color: brand.colors.accent }}>{i + 1}</span>
                    </div>
                    <span className="text-[13px] font-medium flex-1" style={{ textAlign: 'right' }}>{el.content}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Executive Summary ── */}
          {slide.layout === 'executive-summary' && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-3" style={{ backgroundColor: brand.colors.secondary }} />
              {/* KPI row at top */}
              {infoItems.length > 0 && (
                <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(infoItems.length, 4)}, 1fr)` }}>
                  {infoItems.map((item, i) => (
                    <InfoCard key={i} icon={item.icon} label={item.label} value={item.value} color={[brand.colors.secondary, brand.colors.teal, brand.colors.accent, '#F2613C'][i % 4]} bgColor={cardBg} />
                  ))}
                </div>
              )}
              {/* Summary text */}
              {bodyText && (
                <p className="text-[12px] leading-[1.8] mb-3" style={{ textAlign: 'right', opacity: 0.9 }}>{bodyText.content}</p>
              )}
              {/* Key findings */}
              {list && list.style.listItems && (
                <div className="flex-1 space-y-1.5">
                  {list.style.listItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <MaterialIcon icon="check_circle" size={14} style={{ color: brand.colors.teal }} className="mt-0.5 shrink-0" />
                      <span className="text-[11px] leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Pillars ── */}
          {slide.layout === 'pillars' && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-2" style={{ backgroundColor: brand.colors.secondary }} />
              {subtitle && <p className="text-[11px] mb-3 opacity-60" style={{ textAlign: 'right' }}>{subtitle.content}</p>}
              {infoItems.length > 0 ? (
                <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(infoItems.length, 5)}, 1fr)` }}>
                  {infoItems.map((item, i) => (
                    <div key={i} className="rounded-xl p-3 flex flex-col items-center justify-start gap-2 text-center" style={{ backgroundColor: cardBg, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}` }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${[brand.colors.secondary, brand.colors.teal, brand.colors.accent, '#F2613C', '#8b5cf6'][i % 5]}18` }}>
                        <MaterialIcon icon={item.icon || 'star'} size={20} style={{ color: [brand.colors.secondary, brand.colors.teal, brand.colors.accent, '#F2613C', '#8b5cf6'][i % 5] }} />
                      </div>
                      <span className="text-[12px] font-bold" style={{ color: brand.headingColor }}>{item.label}</span>
                      <span className="text-[10px] leading-relaxed opacity-70">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : list && list.style.listItems ? (
                <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(list.style.listItems.length, 4)}, 1fr)` }}>
                  {list.style.listItems.map((item, i) => (
                    <div key={i} className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center" style={{ backgroundColor: cardBg }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brand.colors.accent}18` }}>
                        <span className="text-[14px] font-bold" style={{ color: brand.colors.accent }}>{i + 1}</span>
                      </div>
                      <span className="text-[11px] font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {bodyText && (
                <p className="text-[10px] mt-2 opacity-60 leading-relaxed" style={{ textAlign: 'right' }}>{bodyText.content}</p>
              )}
            </>
          )}

          {/* ── Chart ── */}
          {slide.layout === 'chart' && chart && chartData.length > 0 && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-3" style={{ backgroundColor: brand.colors.secondary }} />
              {subtitle && <p className="text-[11px] mb-3 opacity-60" style={{ textAlign: 'right' }}>{subtitle.content}</p>}
              <div className="flex-1 flex items-center justify-center rounded-xl p-3" style={{ backgroundColor: cardBg }}>
                {(chartType === 'bar' || chartType === 'donut') && <BarChart data={chartData} labels={chartLabels} colors={chartColors} />}
                {chartType === 'pie' && <PieChart data={chartData} labels={chartLabels} colors={chartColors} />}
                {chartType === 'line' && <LineChart data={chartData} labels={chartLabels} colors={chartColors} />}
              </div>
              {bodyText && <p className="text-[10px] mt-2 opacity-60 leading-relaxed" style={{ textAlign: 'right' }}>{bodyText.content}</p>}
            </>
          )}

          {/* ── Table ── */}
          {slide.layout === 'table' && tableData && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-4" style={{ backgroundColor: brand.colors.secondary }} />
              <div className="flex-1 overflow-auto">
                <SlideTable headers={tableData.headers} rows={tableData.rows} brandColor={brand.colors.primary} bodyColor={isDark ? '#e2e8f0' : '#374151'} isDark={isDark} />
              </div>
            </>
          )}

          {/* ── Infographic ── */}
          {slide.layout === 'infographic' && infoItems.length > 0 && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-4" style={{ backgroundColor: brand.colors.secondary }} />
              <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(infoItems.length, 3)}, 1fr)` }}>
                {infoItems.map((item, i) => (
                  <InfoCard key={i} icon={item.icon} label={item.label} value={item.value} color={[brand.colors.secondary, brand.colors.teal, brand.colors.accent, '#F2613C', '#8b5cf6', '#10b981'][i % 6]} bgColor={cardBg} />
                ))}
              </div>
            </>
          )}

          {/* ── KPI ── */}
          {slide.layout === 'kpi' && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-4" style={{ backgroundColor: brand.colors.secondary }} />
              {infoItems.length > 0 ? (
                <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(infoItems.length, 4)}, 1fr)` }}>
                  {infoItems.map((item, i) => (
                    <InfoCard key={i} icon={item.icon} label={item.label} value={item.value} color={[brand.colors.secondary, brand.colors.teal, brand.colors.accent, '#F2613C'][i % 4]} bgColor={cardBg} />
                  ))}
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {(list?.style.listItems || []).slice(0, 4).map((item, i) => (
                    <div key={i} className="rounded-xl p-4 flex items-center justify-center text-center text-[12px]" style={{ backgroundColor: cardBg }}>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Timeline ── */}
          {slide.layout === 'timeline' && timelineItems.length > 0 && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-4" style={{ backgroundColor: brand.colors.secondary }} />
              <div className="flex-1 overflow-auto">
                <TimelineVis items={timelineItems} tealColor={brand.colors.teal} bodyColor={isDark ? '#e2e8f0' : '#374151'} bgColor={isDark ? '#0f1a2e' : '#ffffff'} />
              </div>
            </>
          )}

          {/* ── Quote ── */}
          {slide.layout === 'quote' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <span className="text-[48px] leading-none" style={{ color: brand.colors.secondary }}>❝</span>
              <p className="text-[16px] sm:text-[20px] font-bold leading-relaxed text-center max-w-[80%]" style={{ color: brand.headingColor, fontFamily: brand.headingFont }}>
                {bodyText?.content || heading?.content}
              </p>
              {subtitle && (
                <p className="text-[12px] mt-2 opacity-60" style={{ fontFamily: brand.bodyFont }}>— {subtitle.content}</p>
              )}
            </div>
          )}

          {/* ── Two-Column ── */}
          {slide.layout === 'two-column' && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-4" style={{ backgroundColor: brand.colors.secondary }} />
              <div className="flex-1 grid grid-cols-2 gap-4">
                {slide.elements.filter(e => e.type === 'list').map((listEl, li) => (
                  <div key={li} className="rounded-xl p-3" style={{ backgroundColor: cardBg }}>
                    {(listEl.style.listItems || []).map((item, i) => (
                      <div key={i} className="flex items-start gap-2 py-1.5">
                        <MaterialIcon icon="check_circle" size={14} style={{ color: brand.colors.teal }} className="mt-0.5 shrink-0" />
                        <span className="text-[11px] leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Content (default) ── */}
          {slide.layout === 'content' && (
            <>
              {heading && (
                <h3 className="text-[18px] sm:text-[22px] font-bold mb-1" style={{ color: brand.headingColor, fontFamily: brand.headingFont, textAlign: 'right' }}>
                  {heading.content}
                </h3>
              )}
              <div className="w-16 h-[3px] rounded-full mb-3" style={{ backgroundColor: brand.colors.secondary }} />
              {subtitle && <p className="text-[11px] mb-3 opacity-60" style={{ textAlign: 'right' }}>{subtitle.content}</p>}
              {list && list.style.listItems && (
                <div className="flex-1 space-y-2">
                  {list.style.listItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1">
                      <MaterialIcon icon="check_circle" size={16} style={{ color: brand.colors.teal }} className="mt-0.5 shrink-0" />
                      <span className="text-[12px] leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              )}
              {!list && bodyText && (
                <p className="text-[12px] leading-[1.9] flex-1" style={{ textAlign: 'right' }}>{bodyText.content}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Inline Edit Panel ─── */}
      {isEditing && (
        <div className="border-t border-border/30 bg-card/95 backdrop-blur-sm p-4 space-y-3 animate-fade-in">
          {/* Layout selector */}
          {slide.layout !== 'title' && slide.layout !== 'closing' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="dashboard" size={13} className="text-primary" />
                نوع التخطيط
              </label>
              <div className="flex flex-wrap gap-1.5">
                {inlineLayoutOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setEditLayout(opt.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                      editLayout === opt.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent text-foreground hover:bg-accent/80'
                    }`}
                  >
                    <MaterialIcon icon={opt.icon} size={12} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Edit each element */}
          {editElements.map((el) => {
            if (el.type === 'shape') return null;
            return (
              <div key={el.id} className="space-y-2 p-3 rounded-xl bg-accent/30 border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MaterialIcon
                      icon={el.type === 'heading' ? 'title' : el.type === 'list' ? 'format_list_bulleted' : el.type === 'chart' ? 'bar_chart' : el.type === 'table' ? 'table_chart' : el.type === 'icon' ? 'insights' : 'text_fields'}
                      size={14} className="text-muted-foreground"
                    />
                    <span className="text-[10px] font-bold text-foreground">
                      {el.type === 'heading' ? 'العنوان' : el.type === 'list' ? 'القائمة' : el.type === 'chart' ? 'الرسم البياني' : el.type === 'table' ? 'الجدول' : el.type === 'icon' ? 'إنفوجرافيك' : 'نص'}
                    </span>
                  </div>
                  {(el.type === 'heading' || el.type === 'text') && el.content && (
                    <button
                      onClick={() => handleAIRewrite(el.id, el.content, el.type === 'heading' ? 'اجعله عنوان قوي ومؤثر' : 'اجعله أكثر تفصيلاً واحترافية')}
                      disabled={rewriting}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[9px] font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50"
                    >
                      <MaterialIcon icon="auto_awesome" size={10} />
                      إعادة كتابة بالذكاء
                    </button>
                  )}
                </div>

                {/* Text/Heading */}
                {(el.type === 'heading' || el.type === 'text') && (
                  <textarea
                    value={el.content}
                    onChange={e => updateEl(el.id, { content: e.target.value })}
                    rows={el.type === 'heading' ? 2 : 3}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/40 transition-all resize-y"
                    dir="rtl"
                  />
                )}

                {/* List items */}
                {el.type === 'list' && el.style.listItems && (
                  <div className="space-y-1.5">
                    {el.style.listItems.map((item, li) => (
                      <div key={li} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-4 text-center shrink-0">{li + 1}</span>
                        <input
                          value={item}
                          onChange={e => {
                            const newItems = [...(el.style.listItems || [])];
                            newItems[li] = e.target.value;
                            updateElStyle(el.id, { listItems: newItems });
                          }}
                          className="flex-1 rounded-lg border border-border/50 bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/40"
                          dir="rtl"
                        />
                        <button
                          onClick={() => {
                            const newItems = (el.style.listItems || []).filter((_, idx) => idx !== li);
                            updateElStyle(el.id, { listItems: newItems });
                          }}
                          className="w-5 h-5 rounded flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <MaterialIcon icon="close" size={10} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updateElStyle(el.id, { listItems: [...(el.style.listItems || []), 'عنصر جديد'] })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-primary hover:bg-primary/10 transition-all"
                    >
                      <MaterialIcon icon="add" size={12} />
                      إضافة عنصر
                    </button>
                  </div>
                )}

                {/* Chart editing */}
                {el.type === 'chart' && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      {(['bar', 'line', 'pie', 'donut'] as const).map(ct => (
                        <button
                          key={ct}
                          onClick={() => updateElStyle(el.id, { chartType: ct as any })}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                            el.style.chartType === ct ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground hover:bg-accent/80'
                          }`}
                        >
                          {ct === 'bar' ? 'أعمدة' : ct === 'line' ? 'خطي' : ct === 'pie' ? 'دائري' : 'حلقي'}
                        </button>
                      ))}
                    </div>
                    {el.style.chartData && el.style.chartLabels && (
                      <div className="space-y-1">
                        {el.style.chartLabels.map((label, di) => (
                          <div key={di} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (el.style.chartColors || [])[di % (el.style.chartColors || []).length] || brand.colors.accent }} />
                            <input
                              value={label}
                              onChange={e => {
                                const newLabels = [...(el.style.chartLabels || [])];
                                newLabels[di] = e.target.value;
                                updateElStyle(el.id, { chartLabels: newLabels });
                              }}
                              className="flex-1 rounded-lg border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40"
                              dir="rtl" placeholder="التسمية"
                            />
                            <input
                              type="number"
                              value={el.style.chartData?.[di] || 0}
                              onChange={e => {
                                const newData = [...(el.style.chartData || [])];
                                newData[di] = parseFloat(e.target.value) || 0;
                                updateElStyle(el.id, { chartData: newData });
                              }}
                              className="w-16 rounded-lg border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40 text-center"
                            />
                            <button
                              onClick={() => {
                                const newLabels = (el.style.chartLabels || []).filter((_, idx) => idx !== di);
                                const newData = (el.style.chartData || []).filter((_, idx) => idx !== di);
                                const newColors = (el.style.chartColors || []).filter((_, idx) => idx !== di);
                                updateElStyle(el.id, { chartLabels: newLabels, chartData: newData, chartColors: newColors });
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                            >
                              <MaterialIcon icon="close" size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            updateElStyle(el.id, {
                              chartLabels: [...(el.style.chartLabels || []), 'جديد'],
                              chartData: [...(el.style.chartData || []), 50],
                              chartColors: [...(el.style.chartColors || []), brand.colors.accent],
                            });
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-primary hover:bg-primary/10 transition-all"
                        >
                          <MaterialIcon icon="add" size={12} />
                          إضافة عمود
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Table editing */}
                {el.type === 'table' && (() => {
                  const tbl = parseTableContent(el.content);
                  if (!tbl) return null;
                  return (
                    <div className="space-y-2">
                      <label className="text-[9px] font-medium text-muted-foreground">رؤوس الأعمدة</label>
                      <div className="flex gap-1 flex-wrap">
                        {tbl.headers.map((h, hi) => (
                          <input
                            key={hi}
                            value={h}
                            onChange={e => {
                              const newHeaders = [...tbl.headers];
                              newHeaders[hi] = e.target.value;
                              updateEl(el.id, { content: JSON.stringify({ headers: newHeaders, rows: tbl.rows }) });
                            }}
                            className="flex-1 min-w-[60px] rounded-lg border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40"
                            dir="rtl"
                          />
                        ))}
                      </div>
                      <label className="text-[9px] font-medium text-muted-foreground">الصفوف</label>
                      {tbl.rows.map((row, ri) => (
                        <div key={ri} className="flex gap-1 items-center">
                          <span className="text-[9px] text-muted-foreground w-4 shrink-0 text-center">{ri + 1}</span>
                          {row.map((cell, ci) => (
                            <input
                              key={ci}
                              value={cell}
                              onChange={e => {
                                const newRows = tbl.rows.map(r => [...r]);
                                newRows[ri][ci] = e.target.value;
                                updateEl(el.id, { content: JSON.stringify({ headers: tbl.headers, rows: newRows }) });
                              }}
                              className="flex-1 min-w-[50px] rounded-lg border border-border/50 bg-background px-1.5 py-1 text-[10px] text-foreground outline-none focus:border-primary/40"
                              dir="rtl"
                            />
                          ))}
                          <button
                            onClick={() => {
                              const newRows = tbl.rows.filter((_, idx) => idx !== ri);
                              updateEl(el.id, { content: JSON.stringify({ headers: tbl.headers, rows: newRows }) });
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                          >
                            <MaterialIcon icon="close" size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newRow = tbl.headers.map(() => '');
                          updateEl(el.id, { content: JSON.stringify({ headers: tbl.headers, rows: [...tbl.rows, newRow] }) });
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-primary hover:bg-primary/10 transition-all"
                      >
                        <MaterialIcon icon="add" size={12} />
                        إضافة صف
                      </button>
                    </div>
                  );
                })()}

                {/* Infographic item editing */}
                {el.type === 'icon' && (() => {
                  const item = parseInfoItem(el.content);
                  if (!item) return null;
                  return (
                    <div className="flex gap-1.5">
                      <input
                        value={item.icon}
                        onChange={e => updateEl(el.id, { content: JSON.stringify({ ...item, icon: e.target.value }) })}
                        className="w-20 rounded-lg border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40"
                        placeholder="الأيقونة"
                      />
                      <input
                        value={item.value}
                        onChange={e => updateEl(el.id, { content: JSON.stringify({ ...item, value: e.target.value }) })}
                        className="w-20 rounded-lg border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40"
                        placeholder="القيمة" dir="rtl"
                      />
                      <input
                        value={item.label}
                        onChange={e => updateEl(el.id, { content: JSON.stringify({ ...item, label: e.target.value }) })}
                        className="flex-1 rounded-lg border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/40"
                        placeholder="العنوان" dir="rtl"
                      />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════
interface AIPresentationCreatorProps {
  onComplete: (slides: Slide[], brandKit: BrandKit, title: string) => void;
  onBack: () => void;
  initialTopic?: string;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AIPresentationCreator({ onComplete, onBack, initialTopic }: AIPresentationCreatorProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Generation phases: input → outline → generating → done
  const [step, setStep] = useState<'input' | 'outline' | 'generating' | 'done'>('input');
  const [outputMode, setOutputMode] = useState<'canvas' | 'html'>('html'); // Default to HTML mode
  const [htmlSlides, setHtmlSlides] = useState<{ htmlTemplate: string | null; hasTemplate: boolean; title: string; layout: string; notes: string }[]>([]);
  const [topic, setTopic] = useState(initialTopic || '');
  const [selectedBrand, setSelectedBrand] = useState<string>('ndmo');
  const [slideCount, setSlideCount] = useState(8);
  const [contentSource, setContentSource] = useState<ContentSource>('ai');
  const [userContent, setUserContent] = useState('');
  const [strictContent, setStrictContent] = useState(false);
  const [selectedLibraryFile, setSelectedLibraryFile] = useState<any>(null);
  const [uploadedFileContent, setUploadedFileContent] = useState('');
  const [generatedSlides, setGeneratedSlides] = useState<Slide[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [presentationTitle, setPresentationTitle] = useState('');
  // editingSlideIndex removed — inline editing is now used

  // Outline state
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);

  // Progress state
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // tRPC
  const generateMutation = trpc.ai.generatePresentation.useMutation();
  const generateHtmlMutation = trpc.ai.generateHtmlPresentation.useMutation();
  const extractMutation = trpc.ai.extractFileContent.useMutation();
  const libraryQuery = trpc.files.list.useQuery(undefined, { enabled: false });

  const brand = useMemo(() => BRANDS.find(b => b.id === selectedBrand) || BRANDS[0], [selectedBrand]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const slidesContainerRef = useRef<HTMLDivElement>(null);

  // PDF Export
  const handleExportPdf = useCallback(async () => {
    if (!slidesContainerRef.current || generatedSlides.length === 0) return;
    setExportingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720] });
      const slideCards = slidesContainerRef.current.querySelectorAll('[data-slide-card]');
      for (let i = 0; i < slideCards.length; i++) {
        const card = slideCards[i] as HTMLElement;
        // Find the slide content area (the aspect-ratio container)
        const slideContent = card.querySelector('[data-slide-content]') as HTMLElement;
        if (!slideContent) continue;
        if (i > 0) pdf.addPage([1280, 720], 'landscape');
        const canvas = await html2canvas(slideContent, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          width: slideContent.offsetWidth,
          height: slideContent.offsetHeight,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720);
      }
      pdf.save(`${presentationTitle || topic || 'presentation'}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExportingPdf(false);
    }
  }, [generatedSlides, presentationTitle, topic]);

  // Drag-and-drop reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 0, 0);
    setTimeout(() => document.body.removeChild(el), 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setGeneratedSlides(prev => {
        const newSlides = [...prev];
        const [moved] = newSlides.splice(dragIdx, 1);
        newSlides.splice(dragOverIdx, 0, moved);
        return newSlides;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, dragOverIdx]);

  const handleDragOver = useCallback((idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  // Auto-focus
  useEffect(() => {
    if (step === 'input') setTimeout(() => inputRef.current?.focus(), 300);
  }, [step]);

  // Timer for progress
  useEffect(() => {
    if (step === 'outline' || step === 'generating') {
      setElapsedTime(0);
      timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [step]);

  // Reveal slides one by one
  useEffect(() => {
    if (step === 'generating' && generatedSlides.length > 0 && revealedCount < generatedSlides.length) {
      const timer = setTimeout(() => {
        const nextIdx = revealedCount;
        const nextSlide = generatedSlides[nextIdx];
        const heading = nextSlide?.elements.find(e => e.type === 'heading');
        setProgressCurrent(nextIdx + 1);
        setProgressTitle(`إنشاء الشريحة ${nextIdx + 1} (${LAYOUT_META[nextSlide?.layout]?.title || nextSlide?.layout || 'محتوى'})`);
        setRevealedCount(prev => prev + 1);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 150);
      }, 800);
      return () => clearTimeout(timer);
    }
    if (step === 'generating' && generatedSlides.length > 0 && revealedCount >= generatedSlides.length) {
      setTimeout(() => {
        setStep('done');
        if (timerRef.current) clearInterval(timerRef.current);
      }, 600);
    }
  }, [step, generatedSlides.length, revealedCount]);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('files', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (data.success && data.files?.[0]) {
        const uploaded = data.files[0];
        const extracted = await extractMutation.mutateAsync({ filePath: uploaded.filePath || uploaded.url });
        if (extracted.text) {
          setUploadedFileContent(extracted.text);
          setTopic(file.name.replace(/\.[^.]+$/, ''));
        } else {
          setGenerationError(extracted.error || 'لم يتم استخراج محتوى من الملف');
        }
      }
    } catch (err: any) {
      setGenerationError('فشل رفع الملف: ' + (err.message || ''));
    }
  }, [extractMutation]);

  // Handle library file selection
  const handleLibrarySelect = useCallback(async (file: any) => {
    setSelectedLibraryFile(file);
    if (file.filePath) {
      try {
        const extracted = await extractMutation.mutateAsync({ filePath: file.filePath });
        if (extracted.text) {
          setUploadedFileContent(extracted.text);
          setTopic(file.title || '');
        } else {
          setGenerationError(extracted.error || 'لم يتم استخراج محتوى من الملف');
        }
      } catch (err: any) {
        setGenerationError('فشل استخراج المحتوى: ' + (err.message || ''));
      }
    }
  }, [extractMutation]);

  // Build outline from layout sequence
  const buildOutline = useCallback((layouts: string[], topicText: string): OutlineItem[] => {
    return layouts.map((layout, i) => {
      const meta = LAYOUT_META[layout] || { title: `شريحة ${layout}`, desc: 'شريحة محتوى', icon: 'article' };
      // Customize first and last
      if (i === 0) {
        return { index: i, title: `شريحة غلاف: ${topicText}`, description: meta.desc, layout, icon: meta.icon };
      }
      if (i === layouts.length - 1) {
        return { index: i, title: 'شريحة ختام رسمي', description: 'الختام الرسمي مع شكر وتقدير وبيانات التواصل', layout, icon: 'celebration' };
      }
      return { index: i, title: meta.title, description: meta.desc, layout, icon: meta.icon };
    });
  }, []);

  // Generate
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;

    // Calculate layout sequence (same logic as backend — with new types)
    const mandatoryLayouts: string[] = ['title'];
    if (slideCount >= 12) mandatoryLayouts.push('toc', 'executive-summary', 'pillars', 'chart', 'table', 'infographic', 'kpi', 'timeline');
    else if (slideCount >= 10) mandatoryLayouts.push('toc', 'executive-summary', 'chart', 'table', 'infographic', 'kpi', 'timeline');
    else if (slideCount >= 8) mandatoryLayouts.push('toc', 'chart', 'table', 'infographic', 'kpi', 'timeline');
    else if (slideCount >= 6) mandatoryLayouts.push('chart', 'table', 'infographic', 'kpi');
    else if (slideCount >= 5) mandatoryLayouts.push('chart', 'table', 'infographic');
    else if (slideCount >= 4) mandatoryLayouts.push('chart', 'infographic');
    else mandatoryLayouts.push('chart');
    mandatoryLayouts.push('closing');
    const remaining = slideCount - mandatoryLayouts.length;
    const fillerOptions = ['content', 'two-column', 'pillars', 'kpi', 'timeline', 'quote'];
    const fillerLayouts = Array.from({ length: remaining }, (_, i) => fillerOptions[i % fillerOptions.length]);
    const layoutSequence = [mandatoryLayouts[0], ...mandatoryLayouts.slice(1, -1), ...fillerLayouts, mandatoryLayouts[mandatoryLayouts.length - 1]];

    // Phase 1: Show outline
    const outline = buildOutline(layoutSequence, topic.trim());
    setOutlineItems(outline);
    setOutlineCollapsed(false);
    setStep('outline');
    setProgressTitle('جاري تحليل الموضوع وتخطيط الشرائح...');
    setProgressCurrent(0);
    setGeneratedSlides([]);
    setRevealedCount(0);
    setGenerationError(null);

    // Wait 2.5 seconds for outline to be visible, then start generating
    await new Promise(resolve => setTimeout(resolve, 2500));
    setOutlineCollapsed(true);

    // Phase 2: Start generation
    setStep('generating');
    setProgressTitle('جاري إنشاء المحتوى بالذكاء الاصطناعي...');

    let finalContent: string | undefined;
    if (contentSource === 'user') finalContent = userContent;
    else if (contentSource === 'library' || contentSource === 'file') finalContent = uploadedFileContent;

    try {
      if (outputMode === 'html') {
        // HTML Template Mode — generates real HTML slides from library templates
        const result = await generateHtmlMutation.mutateAsync({
          topic: topic.trim(),
          slideCount,
          brandId: selectedBrand as any,
          language: 'ar',
          contentSource,
          userContent: finalContent,
          strictContent: contentSource === 'user' ? strictContent : false,
        });
        if (result.slides && result.slides.length > 0) {
          setPresentationTitle(result.title || topic);
          setHtmlSlides(result.slides.map((s: any) => ({
            htmlTemplate: s.htmlTemplate || null,
            hasTemplate: s.hasTemplate || false,
            title: s.title || '',
            layout: s.layout || 'content',
            notes: s.notes || '',
          })));
          // Also generate canvas slides as fallback for non-template slides
          const canvasSlides = result.slides.map((s: any, i: number) =>
            aiSlideToSlide(s, brand, i, result.slides.length)
          );
          setGeneratedSlides(canvasSlides);
          setProgressTitle(`تم إنشاء ${result.slides.length} شريحة HTML — ${result.templateCount} قالب مطبّق`);
        } else {
          setGenerationError('لم يتم توليد شرائح. يرجى المحاولة مرة أخرى.');
          setStep('input');
        }
      } else {
        // Canvas Mode — original generation
        const result = await generateMutation.mutateAsync({
          topic: topic.trim(),
          slideCount,
          brandId: selectedBrand as any,
          language: 'ar',
          contentSource,
          userContent: finalContent,
          strictContent: contentSource === 'user' ? strictContent : false,
        });
        if (result.slides && result.slides.length > 0) {
          setPresentationTitle(result.title || topic);
          const slides = result.slides.map((s: any, i: number) =>
            aiSlideToSlide(s, brand, i, result.slides.length)
          );
          setGeneratedSlides(slides);
          setHtmlSlides([]);
          setProgressTitle(`تم إنشاء ${slides.length} شريحة — جاري العرض...`);
        } else {
          setGenerationError('لم يتم توليد شرائح. يرجى المحاولة مرة أخرى.');
          setStep('input');
        }
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
      setGenerationError(err?.message || 'حدث خطأ أثناء التوليد. يرجى المحاولة مرة أخرى.');
      setStep('input');
    }
  }, [topic, slideCount, selectedBrand, brand, generateMutation, generateHtmlMutation, contentSource, userContent, uploadedFileContent, strictContent, buildOutline, outputMode]);

  // Complete
  const handleComplete = useCallback(() => {
    const brandKit: BrandKit = {
      primaryColor: brand.colors.primary,
      secondaryColor: brand.colors.secondary,
      accentColor: brand.colors.accent,
      backgroundColor: brand.colors.bg,
      headingFont: brand.headingFont,
      bodyFont: brand.bodyFont,
    };
    onComplete(generatedSlides, brandKit, presentationTitle);
  }, [generatedSlides, brand, presentationTitle, onComplete]);

  const SLIDE_COUNTS = [5, 8, 10, 15];

  const canGenerate = topic.trim() && (
    contentSource === 'ai' ||
    (contentSource === 'user' && userContent.trim()) ||
    ((contentSource === 'library' || contentSource === 'file') && uploadedFileContent)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3 sm:px-4 py-2.5 flex items-center gap-2.5">
        <button onClick={onBack} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all active:scale-95">
          <MaterialIcon icon="arrow_forward" size={16} className="text-muted-foreground" />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <MaterialIcon icon="auto_awesome" size={18} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] sm:text-[14px] font-bold text-foreground">إنشاء عرض تقديمي بالذكاء الاصطناعي</h3>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">
            {step === 'input' ? 'أدخل الموضوع واختر الإعدادات' :
             step === 'outline' ? 'جاري تخطيط الشرائح...' :
             step === 'generating' ? `جاري الإنشاء... ${revealedCount}/${generatedSlides.length || slideCount}` :
             `تم إنشاء ${generatedSlides.length} شريحة بنجاح`}
          </p>
        </div>
        {(step === 'outline' || step === 'generating') && (
          <img src={RASED_USAGE.loadingPresentation} alt="" className="w-8 h-8 animate-float" />
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4">
        {/* ═══ Step 1: Input ═══ */}
        {step === 'input' && (
          <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
            {generationError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[12px] flex items-center gap-2">
                <MaterialIcon icon="error" size={16} />
                {generationError}
              </div>
            )}

            {/* ═══ Preset Templates ═══ */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="rocket_launch" size={16} className="text-amber-500" />
                قوالب جاهزة — ابدأ بنقرة واحدة
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setTopic(tpl.topic);
                      setSlideCount(tpl.slideCount);
                    }}
                    className="group flex items-start gap-2.5 p-3 rounded-xl border-2 border-border/30 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-right"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all" style={{ backgroundColor: `${tpl.color}15` }}>
                      <MaterialIcon icon={tpl.icon} size={18} style={{ color: tpl.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors">{tpl.label}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{tpl.desc}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{tpl.slideCount} شريحة</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] text-muted-foreground font-medium">أو أدخل موضوعك الخاص</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="edit_note" size={16} className="text-primary" />
                ما موضوع العرض التقديمي؟
              </label>
              <textarea
                ref={inputRef}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && canGenerate) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="مثال: تقرير نضج البيانات الوطنية للربع الرابع 2025..."
                rows={2}
                className="w-full rounded-xl border-2 border-border/50 bg-accent/30 px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
            </div>

            {/* Content Source */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="source" size={16} className="text-emerald-500" />
                مصدر المحتوى
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CONTENT_SOURCES.map(src => (
                  <button
                    key={src.id}
                    onClick={() => setContentSource(src.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-300 text-right ${
                      contentSource === src.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/30 bg-card hover:border-border/60'
                    }`}
                  >
                    <MaterialIcon icon={src.icon} size={16} className={contentSource === src.id ? 'text-primary' : 'text-muted-foreground'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-foreground">{src.label}</p>
                      <p className="text-[8px] text-muted-foreground truncate">{src.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Source Specific UI */}
            {contentSource === 'user' && (
              <div className="space-y-2 animate-fade-in">
                <textarea
                  value={userContent}
                  onChange={e => setUserContent(e.target.value)}
                  placeholder="اكتب المحتوى الذي تريد تحويله إلى عرض تقديمي..."
                  rows={4}
                  className="w-full rounded-xl border-2 border-border/50 bg-accent/30 px-4 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-all resize-none"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setStrictContent(!strictContent)}
                    className={`w-9 h-5 rounded-full transition-all duration-300 flex items-center ${strictContent ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm mx-0.5" />
                  </div>
                  <span className="text-[11px] text-foreground">الالتزام الكامل بالمحتوى (بدون إضافات)</span>
                </label>
              </div>
            )}

            {contentSource === 'file' && (
              <div className="animate-fade-in">
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv" onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 rounded-xl border-2 border-dashed border-border/50 bg-accent/20 flex flex-col items-center gap-2 hover:border-primary/40 transition-all"
                >
                  {uploadedFileContent ? (
                    <>
                      <MaterialIcon icon="check_circle" size={28} className="text-emerald-500" />
                      <span className="text-[11px] font-medium text-foreground">تم استخراج المحتوى بنجاح</span>
                      <span className="text-[9px] text-muted-foreground">{uploadedFileContent.length} حرف — اضغط لتغيير الملف</span>
                    </>
                  ) : extractMutation.isPending ? (
                    <>
                      <img src={RASED_USAGE.loadingExtraction} alt="" className="w-8 h-8 object-contain animate-bounce-once" />
                      <span className="text-[11px] text-muted-foreground">جاري استخراج المحتوى...</span>
                    </>
                  ) : (
                    <>
                      <MaterialIcon icon="upload_file" size={28} className="text-muted-foreground" />
                      <span className="text-[11px] font-medium text-foreground">اضغط لرفع ملف</span>
                      <span className="text-[9px] text-muted-foreground">PDF, Word, TXT, CSV</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {contentSource === 'library' && (
              <div className="animate-fade-in">
                <button
                  onClick={() => libraryQuery.refetch()}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-border/50 bg-accent/20 flex items-center justify-center gap-2 hover:border-primary/40 transition-all mb-2"
                >
                  <MaterialIcon icon="refresh" size={16} className="text-muted-foreground" />
                  <span className="text-[11px] text-foreground">تحميل ملفات المكتبة</span>
                </button>
                {libraryQuery.data && (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border/30 p-2">
                    {(libraryQuery.data as any[]).filter((f: any) =>
                      f.mimeType?.includes('pdf') || f.mimeType?.includes('word') || f.mimeType?.includes('text') || f.mimeType?.includes('csv')
                    ).map((file: any) => (
                      <button
                        key={file.id}
                        onClick={() => handleLibrarySelect(file)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-right ${
                          selectedLibraryFile?.id === file.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/50'
                        }`}
                      >
                        <MaterialIcon icon={file.icon || 'description'} size={16} className="text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-foreground truncate">{file.title}</p>
                          <p className="text-[8px] text-muted-foreground">{file.size}</p>
                        </div>
                        {selectedLibraryFile?.id === file.id && <MaterialIcon icon="check_circle" size={14} className="text-primary" />}
                      </button>
                    ))}
                    {(libraryQuery.data as any[]).length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-4">لا توجد ملفات في المكتبة</p>
                    )}
                  </div>
                )}
                {uploadedFileContent && selectedLibraryFile && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                    <MaterialIcon icon="check_circle" size={14} className="text-emerald-500" />
                    <span className="text-[10px] text-foreground">تم استخراج المحتوى من: {selectedLibraryFile.title}</span>
                  </div>
                )}
              </div>
            )}

            {/* Brand Selection */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="palette" size={16} className="text-amber-500" />
                الهوية البصرية
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {BRANDS.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBrand(b.id)}
                    className={`relative flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-300 text-right ${
                      selectedBrand === b.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/30 bg-card hover:border-border/60'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <div className="w-3.5 h-3.5 rounded-full shadow-inner" style={{ backgroundColor: b.colors.primary }} />
                      <div className="w-3.5 h-3.5 rounded-full shadow-inner" style={{ backgroundColor: b.colors.secondary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-foreground">{b.label}</p>
                      <p className="text-[8px] text-muted-foreground truncate">
                        {b.id === 'ndmo' ? 'مكتب إدارة البيانات' : b.id === 'sdaia' ? 'الهيئة السعودية' : b.id === 'modern' ? 'تصميم حديث' : 'تصميم نظيف'}
                      </p>
                    </div>
                    {selectedBrand === b.id && (
                      <div className="absolute top-1 left-1">
                        <MaterialIcon icon="check_circle" size={12} className="text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Slide Count */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="view_carousel" size={16} className="text-violet-500" />
                عدد الشرائح
              </label>
              <div className="flex gap-1.5">
                {SLIDE_COUNTS.map(count => (
                  <button
                    key={count}
                    onClick={() => setSlideCount(count)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all duration-300 ${
                      slideCount === count
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'bg-accent/50 text-foreground hover:bg-accent border border-border/30'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Mode Toggle */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="code" size={16} className="text-emerald-500" />
                وضع الإخراج
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setOutputMode('html')}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    outputMode === 'html'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-accent/50 text-foreground hover:bg-accent border border-border/30'
                  }`}
                >
                  <MaterialIcon icon="html" size={16} />
                  HTML (قوالب المكتبة)
                </button>
                <button
                  onClick={() => setOutputMode('canvas')}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    outputMode === 'canvas'
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-accent/50 text-foreground hover:bg-accent border border-border/30'
                  }`}
                >
                  <MaterialIcon icon="brush" size={16} />
                  Canvas (تصميم ديناميكي)
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground">
                {outputMode === 'html'
                  ? 'سيتم استخدام قوالب HTML الاحترافية من المكتبة لإنشاء شرائح بجودة عالية مع رسوم بيانية حقيقية'
                  : 'سيتم توليد تصميم ديناميكي مع إمكانية التحرير المباشر لكل عنصر'
                }
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generateMutation.isPending || generateHtmlMutation.isPending}
              className={`w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                canGenerate
                  ? 'bg-gradient-to-l from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.98]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <MaterialIcon icon="auto_awesome" size={20} />
              إنشاء العرض التقديمي
            </button>
          </div>
        )}

        {/* ═══ Step 2+: Outline + Progress + Slides ═══ */}
        {(step === 'outline' || step === 'generating' || step === 'done') && (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Slides Outline */}
            {outlineItems.length > 0 && (
              <SlidesOutline
                items={outlineItems}
                title={presentationTitle || topic}
                collapsed={outlineCollapsed}
                onToggle={() => setOutlineCollapsed(!outlineCollapsed)}
              />
            )}

            {/* Live Progress Bar */}
            {(step === 'outline' || step === 'generating') && (
              <LiveProgressBar
                current={progressCurrent}
                total={generatedSlides.length || slideCount}
                currentTitle={progressTitle}
                elapsed={elapsedTime}
                expanded={progressExpanded}
                onToggle={() => setProgressExpanded(!progressExpanded)}
              />
            )}

            {/* Loading skeleton */}
            {step === 'generating' && generatedSlides.length === 0 && (
              <div className="rounded-2xl border border-border/30 bg-card/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <img src={RASED_USAGE.loadingPresentation} alt="راصد يعمل" className="w-12 h-12 object-contain animate-float-slow" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">راصد يعمل على إنشاء عرضك...</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">يتم الآن توليد {slideCount} شريحة احترافية بالذكاء الاصطناعي</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-border/20">
                      <div className="h-8 bg-accent/30" />
                      <div className="aspect-[16/9] bg-accent/20" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slide Cards — HTML mode or Canvas mode */}
            {generatedSlides.length > 0 && (
              <div className="space-y-5" ref={slidesContainerRef}>
                {generatedSlides.slice(0, step === 'done' ? generatedSlides.length : revealedCount).map((slide, i) => {
                  const htmlSlide = htmlSlides[i];
                  const useHtml = outputMode === 'html' && htmlSlide?.htmlTemplate;
                  
                  return (
                    <div
                      key={slide.id}
                      onDragOver={step === 'done' ? handleDragOver(i) : undefined}
                      onDrop={step === 'done' ? handleDragEnd : undefined}
                      className={`transition-all duration-200 ${dragOverIdx === i && dragIdx !== i ? 'border-t-2 border-primary pt-2' : ''}`}
                    >
                      {useHtml ? (
                        <HtmlSlideCard
                          html={htmlSlide.htmlTemplate!}
                          title={htmlSlide.title}
                          layout={htmlSlide.layout}
                          index={i}
                          total={generatedSlides.length}
                          isNew={step === 'generating' && i === revealedCount - 1}
                          brand={brand}
                        />
                      ) : (
                        <LargeSlideCard
                          slide={slide}
                          index={i}
                          total={generatedSlides.length}
                          brand={brand}
                          isNew={step === 'generating' && i === revealedCount - 1}
                          isDragging={dragIdx === i}
                          dragHandleProps={step === 'done' ? {
                            draggable: true,
                            onDragStart: handleDragStart(i),
                            onDragEnd: handleDragEnd,
                          } : undefined}
                          onSaveInline={step === 'done' ? (updatedSlide) => {
                            const newSlides = [...generatedSlides];
                            newSlides[i] = updatedSlide;
                            setGeneratedSlides(newSlides);
                          } : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Done actions */}
            {step === 'done' && (
              <div className="flex flex-wrap gap-2 mt-4 animate-fade-in sticky bottom-0 bg-background/80 backdrop-blur-sm p-3 -mx-3 rounded-xl border border-border/30">
                <button
                  onClick={handleComplete}
                  className="flex-1 min-w-[140px] py-3 rounded-xl bg-gradient-to-l from-primary to-primary/90 text-primary-foreground text-[13px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.98] transition-all"
                >
                  <MaterialIcon icon="edit" size={18} />
                  فتح في المحرر
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="flex-1 min-w-[140px] py-3 rounded-xl bg-gradient-to-l from-red-600 to-red-500 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {exportingPdf ? (
                    <><img src={RASED_USAGE.loadingPresentation} alt="" className="w-5 h-5 object-contain animate-spin-slow" /> جاري التصدير...</>
                  ) : (
                    <><MaterialIcon icon="picture_as_pdf" size={18} /> تصدير PDF</>
                  )}
                </button>
                <button
                  onClick={() => {
                    setStep('input');
                    setGeneratedSlides([]);
                    setRevealedCount(0);
                    setOutlineItems([]);
                  }}
                  className="px-4 py-3 rounded-xl bg-accent text-foreground text-[13px] font-medium flex items-center justify-center gap-2 border border-border/30 hover:bg-accent/80 transition-all"
                >
                  <MaterialIcon icon="refresh" size={18} />
                  إعادة
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}


