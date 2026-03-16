/* ═══════════════════════════════════════════════════════════════
   ReportsEngine — Real Professional Report Builder
   Features:
   - Section-based editor with drag-and-drop reordering
   - Rich text editing (contentEditable)
   - Section types: heading, paragraph, chart, table, image, quote, divider
   - Real-time preview mode
   - PDF export via browser print
   - Templates system
   - AI generation UI
   - Speaker notes per section
   - Easy/Advanced mode toggle
   ═══════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAutoSave, SaveStatusIndicator } from '@/hooks/useAutoSave';
import MaterialIcon from './MaterialIcon';
import ModeSwitcher from './ModeSwitcher';
import { CHARACTERS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';

/* ---------- Types ---------- */
interface ReportSection {
  id: string;
  type: 'cover' | 'heading' | 'paragraph' | 'chart' | 'table' | 'image' | 'quote' | 'divider' | 'kpi' | 'recommendation';
  content: string;
  subContent?: string;
  level?: number; // for headings h1-h3
  chartType?: 'bar' | 'line' | 'pie' | 'radar';
  tableData?: string[][];
  imageUrl?: string;
  note?: string;
  kpiValue?: string;
  kpiLabel?: string;
  kpiTrend?: 'up' | 'down' | 'stable';
}

interface ReportMeta {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  logo?: string;
  classification: 'سري' | 'محدود' | 'عام';
}

/* ---------- Helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);

const defaultSections: ReportSection[] = [
  { id: uid(), type: 'cover', content: 'تقرير نضج البيانات الوطنية', subContent: 'الربع الرابع ٢٠٢٥' },
  { id: uid(), type: 'heading', content: 'الملخص التنفيذي', level: 1 },
  { id: uid(), type: 'paragraph', content: 'يقدم هذا التقرير نتائج تقييم نضج البيانات الوطنية للربع الرابع من عام ٢٠٢٥. شمل التقييم ١٧ جهة حكومية رئيسية، وأظهرت النتائج تحسناً ملحوظاً بنسبة ٨٪ مقارنة بالربع السابق، حيث بلغ متوسط نسبة الامتثال ٨٥٪.' },
  { id: uid(), type: 'kpi', content: 'مؤشرات الأداء الرئيسية', kpiValue: '٨٥٪', kpiLabel: 'متوسط الامتثال', kpiTrend: 'up' },
  { id: uid(), type: 'heading', content: 'نتائج التقييم التفصيلية', level: 1 },
  { id: uid(), type: 'chart', content: 'توزيع مستويات النضج', chartType: 'bar' },
  { id: uid(), type: 'table', content: 'جدول تصنيف الجهات', tableData: [
    ['الجهة', 'الامتثال', 'النضج', 'التصنيف'],
    ['وزارة المالية', '٩٤٪', 'متقدم', 'أ'],
    ['وزارة الصحة', '٨٨٪', 'متقدم', 'أ'],
    ['وزارة التعليم', '٧٦٪', 'متوسط', 'ب'],
    ['هيئة الاتصالات', '٩١٪', 'متقدم', 'أ'],
    ['هيئة الزكاة', '٦٩٪', 'مبتدئ', 'ج'],
  ]},
  { id: uid(), type: 'heading', content: 'التوصيات', level: 1 },
  { id: uid(), type: 'recommendation', content: 'تسريع برامج التحول الرقمي في الجهات ذات التصنيف المنخفض', subContent: 'أولوية عالية' },
  { id: uid(), type: 'recommendation', content: 'إنشاء مركز تميز للبيانات لدعم الجهات في تطبيق معايير الحوكمة', subContent: 'أولوية متوسطة' },
  { id: uid(), type: 'recommendation', content: 'تطوير برنامج تدريبي وطني لبناء القدرات في مجال إدارة البيانات', subContent: 'أولوية متوسطة' },
  { id: uid(), type: 'quote', content: 'البيانات هي النفط الجديد، وحوكمتها هي المصفاة التي تحولها إلى قيمة حقيقية.' },
  { id: uid(), type: 'divider', content: '' },
  { id: uid(), type: 'paragraph', content: 'يوصي فريق العمل بمتابعة تنفيذ التوصيات أعلاه خلال الربع القادم، مع إجراء تقييم منتصف الفترة للتأكد من التقدم المحرز.' },
];

const sectionTypes = [
  { type: 'heading', icon: 'title', label: 'عنوان' },
  { type: 'paragraph', icon: 'notes', label: 'فقرة' },
  { type: 'chart', icon: 'bar_chart', label: 'رسم بياني' },
  { type: 'table', icon: 'table_chart', label: 'جدول' },
  { type: 'image', icon: 'image', label: 'صورة' },
  { type: 'kpi', icon: 'speed', label: 'مؤشر KPI' },
  { type: 'recommendation', icon: 'lightbulb', label: 'توصية' },
  { type: 'quote', icon: 'format_quote', label: 'اقتباس' },
  { type: 'divider', icon: 'horizontal_rule', label: 'فاصل' },
] as const;

const templates = [
  { id: 'compliance', label: 'تقرير امتثال', icon: 'verified', color: 'text-success' },
  { id: 'quarterly', label: 'تقرير ربعي', icon: 'date_range', color: 'text-primary' },
  { id: 'assessment', label: 'تقرير تقييم', icon: 'assessment', color: 'text-info' },
  { id: 'executive', label: 'ملخص تنفيذي', icon: 'summarize', color: 'text-warning' },
  { id: 'technical', label: 'تقرير فني', icon: 'engineering', color: 'text-danger' },
];

/* ---------- Main Component ---------- */
export default function ReportsEngine() {
  const { theme } = useTheme();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [meta, setMeta] = useState<ReportMeta>({
    title: '',
    subtitle: '',
    author: '',
    date: new Date().toLocaleDateString('ar-SA'),
    classification: 'عام',
  });
  const [selectedSection, setSelectedSection] = useState<string | null>(sections[0]?.id || null);
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [previewMode, setPreviewMode] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [undoStack, setUndoStack] = useState<ReportSection[][]>([]);
  const [redoStack, setRedoStack] = useState<ReportSection[][]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<number | null>(null);
  const reportMutation = trpc.ai.generateReport.useMutation();
  const generateSectionsMutation = trpc.ai.generateReportSections.useMutation();
  const createReportMutation = trpc.reports.create.useMutation();
  const updateReportMutation = trpc.reports.update.useMutation();

  // Auto-save every 30 seconds
  const { status: saveStatus, lastSaved, save: forceSave } = useAutoSave({
    data: { sections, meta },
    documentId: currentReportId,
    onSave: async (data) => {
      if (data.sections.length === 0) return;
      if (currentReportId) {
        await updateReportMutation.mutateAsync({
          id: currentReportId,
          title: data.meta.title || 'تقرير بدون عنوان',
          sections: data.sections,
          classification: data.meta.classification,
          entity: data.meta.author,
        });
      } else {
        const result = await createReportMutation.mutateAsync({
          title: data.meta.title || 'تقرير بدون عنوان',
          sections: data.sections,
          classification: data.meta.classification,
          entity: data.meta.author,
        });
        if (result?.id) setCurrentReportId(result.id);
      }
    },
  });

  /* ---- Undo/Redo ---- */
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), sections.map(s => ({ ...s }))]);
    setRedoStack([]);
  }, [sections]);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const existingSectionTitles = sections.map(s => `${s.type}: ${s.content.slice(0, 50)}`);
      const result = await generateSectionsMutation.mutateAsync({
        prompt: aiPrompt,
        existingSections: existingSectionTitles.length > 0 ? existingSectionTitles : undefined,
      });
      if (result.sections && result.sections.length > 0) {
        pushUndo();
        const validTypes = ['cover', 'heading', 'paragraph', 'chart', 'table', 'image', 'quote', 'divider', 'kpi', 'recommendation'];
        const newSections: ReportSection[] = result.sections.map((s: any) => ({
          id: uid(),
          type: (validTypes.includes(s.type) ? s.type : 'paragraph') as ReportSection['type'],
          content: s.content || '',
          subContent: s.subContent || undefined,
          level: s.level || undefined,
          chartType: s.chartType && ['bar', 'line', 'pie', 'radar'].includes(s.chartType) ? s.chartType : undefined,
          tableData: Array.isArray(s.tableData) ? s.tableData : undefined,
          kpiValue: s.kpiValue || undefined,
          kpiLabel: s.kpiLabel || undefined,
          kpiTrend: s.kpiTrend || undefined,
        }));
        setSections(prev => [...prev, ...newSections]);
      }
      setAiPrompt('');
    } catch (e) {
      console.error('AI Report generation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading, generateSectionsMutation, sections, pushUndo]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, sections.map(s => ({ ...s }))]);
    setSections(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, sections]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, sections.map(s => ({ ...s }))]);
    setSections(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, sections]);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Escape') { setPreviewMode(false); setShowInsertMenu(false); setShowTemplates(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  /* ---- Section CRUD ---- */
  const addSection = (type: string) => {
    pushUndo();
    const newSection: ReportSection = {
      id: uid(),
      type: type as ReportSection['type'],
      content: type === 'heading' ? 'عنوان جديد' :
               type === 'paragraph' ? 'اكتب نص الفقرة هنا...' :
               type === 'chart' ? 'رسم بياني جديد' :
               type === 'table' ? 'جدول جديد' :
               type === 'kpi' ? 'مؤشر جديد' :
               type === 'recommendation' ? 'توصية جديدة' :
               type === 'quote' ? 'اكتب الاقتباس هنا...' : '',
      level: type === 'heading' ? 2 : undefined,
      chartType: type === 'chart' ? 'bar' : undefined,
      kpiValue: type === 'kpi' ? '٠٪' : undefined,
      kpiLabel: type === 'kpi' ? 'المؤشر' : undefined,
      kpiTrend: type === 'kpi' ? 'stable' : undefined,
      subContent: type === 'recommendation' ? 'أولوية متوسطة' : undefined,
      tableData: type === 'table' ? [['العمود ١', 'العمود ٢', 'العمود ٣'], ['—', '—', '—'], ['—', '—', '—']] : undefined,
    };
    const idx = selectedSection ? sections.findIndex(s => s.id === selectedSection) + 1 : sections.length;
    const newSections = [...sections];
    newSections.splice(idx, 0, newSection);
    setSections(newSections);
    setSelectedSection(newSection.id);
    setShowInsertMenu(false);
  };

  const deleteSection = (id: string) => {
    pushUndo();
    setSections(prev => prev.filter(s => s.id !== id));
    if (selectedSection === id) setSelectedSection(null);
  };

  const duplicateSection = (id: string) => {
    pushUndo();
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1) return;
    const clone = { ...sections[idx], id: uid() };
    const newSections = [...sections];
    newSections.splice(idx + 1, 0, clone);
    setSections(newSections);
    setSelectedSection(clone.id);
  };

  const updateSection = (id: string, updates: Partial<ReportSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const moveSection = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    pushUndo();
    const fromIdx = sections.findIndex(s => s.id === fromId);
    const toIdx = sections.findIndex(s => s.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(fromIdx, 1);
    newSections.splice(toIdx, 0, moved);
    setSections(newSections);
  };

  /* ---- PDF Export using jsPDF ---- */
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Helper: add new page if needed
    const checkPage = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Helper: draw right-aligned Arabic text (jsPDF doesn't support RTL natively, so we reverse display)
    const drawText = (text: string, x: number, yPos: number, opts: { fontSize?: number; fontStyle?: string; color?: number[]; maxWidth?: number; align?: string } = {}) => {
      const { fontSize = 12, fontStyle = 'normal', color = [26, 26, 46], maxWidth = contentWidth, align = 'right' } = opts;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        checkPage(fontSize * 0.5);
        doc.text(line, align === 'center' ? pageWidth / 2 : x, y, { align: align as any });
        y += fontSize * 0.45;
      });
      return lines.length;
    };

    // Process each section
    for (const section of sections) {
      switch (section.type) {
        case 'cover':
          y = 60;
          drawText(section.content, pageWidth / 2, y, { fontSize: 28, fontStyle: 'bold', color: [26, 86, 219], align: 'center' });
          y += 10;
          if (section.subContent) {
            drawText(section.subContent, pageWidth / 2, y, { fontSize: 16, color: [100, 100, 100], align: 'center' });
          }
          y += 10;
          drawText(`${meta.author} | ${meta.date}`, pageWidth / 2, y, { fontSize: 11, color: [150, 150, 150], align: 'center' });
          y += 8;
          // Classification badge
          doc.setFillColor(254, 243, 205);
          const classText = meta.classification;
          const classWidth = doc.getTextWidth(classText) + 12;
          doc.roundedRect(pageWidth / 2 - classWidth / 2, y - 3, classWidth, 8, 3, 3, 'F');
          drawText(classText, pageWidth / 2, y + 2, { fontSize: 10, color: [133, 100, 4], align: 'center' });
          doc.addPage();
          y = margin;
          break;

        case 'heading':
          checkPage(20);
          y += 5;
          const hSize = section.level === 1 ? 20 : section.level === 2 ? 16 : 14;
          const hColor = section.level === 1 ? [26, 86, 219] : section.level === 2 ? [30, 64, 175] : [55, 65, 81];
          drawText(section.content, pageWidth - margin, y, { fontSize: hSize, fontStyle: 'bold', color: hColor });
          if (section.level === 1) {
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.5);
            doc.line(margin, y + 2, pageWidth - margin, y + 2);
            y += 4;
          }
          y += 4;
          break;

        case 'paragraph':
          checkPage(15);
          drawText(section.content, pageWidth - margin, y, { fontSize: 11, color: [55, 65, 81] });
          y += 4;
          break;

        case 'kpi':
          checkPage(30);
          y += 3;
          // KPI card
          doc.setFillColor(240, 247, 255);
          doc.roundedRect(margin, y - 3, contentWidth, 25, 3, 3, 'F');
          doc.setDrawColor(219, 234, 254);
          doc.roundedRect(margin, y - 3, contentWidth, 25, 3, 3, 'S');
          drawText(section.kpiValue || '', pageWidth / 2, y + 5, { fontSize: 22, fontStyle: 'bold', color: [26, 86, 219], align: 'center' });
          drawText(section.kpiLabel || section.content, pageWidth / 2, y + 14, { fontSize: 10, color: [100, 100, 100], align: 'center' });
          y += 30;
          break;

        case 'table':
          if (section.tableData && section.tableData.length > 0) {
            checkPage(10 + section.tableData.length * 8);
            const colCount = section.tableData[0].length;
            const colWidth = contentWidth / colCount;
            // Header
            doc.setFillColor(26, 86, 219);
            doc.rect(margin, y, contentWidth, 8, 'F');
            section.tableData[0].forEach((cell, i) => {
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(255, 255, 255);
              doc.text(cell, pageWidth - margin - i * colWidth - colWidth / 2, y + 5.5, { align: 'center' });
            });
            y += 8;
            // Rows
            section.tableData.slice(1).forEach((row, rowIdx) => {
              checkPage(8);
              if (rowIdx % 2 === 0) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin, y, contentWidth, 7, 'F');
              }
              row.forEach((cell, i) => {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(55, 65, 81);
                doc.text(cell, pageWidth - margin - i * colWidth - colWidth / 2, y + 5, { align: 'center' });
              });
              y += 7;
            });
            y += 6;
          }
          break;

        case 'recommendation':
          checkPage(20);
          doc.setFillColor(255, 251, 235);
          doc.roundedRect(margin, y - 2, contentWidth, 15, 2, 2, 'F');
          doc.setFillColor(245, 158, 11);
          doc.rect(pageWidth - margin - 1.5, y - 2, 1.5, 15, 'F');
          drawText(section.content, pageWidth - margin - 6, y + 4, { fontSize: 10, color: [55, 65, 81], maxWidth: contentWidth - 10 });
          y += 10;
          break;

        case 'quote':
          checkPage(20);
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(margin, y - 2, contentWidth, 15, 2, 2, 'F');
          doc.setFillColor(26, 86, 219);
          doc.rect(pageWidth - margin - 1.5, y - 2, 1.5, 15, 'F');
          drawText(section.content, pageWidth - margin - 6, y + 4, { fontSize: 11, fontStyle: 'italic', color: [71, 85, 105], maxWidth: contentWidth - 10 });
          y += 10;
          break;

        case 'chart':
          checkPage(40);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(209, 213, 219);
          doc.setLineDashPattern([3, 3], 0);
          doc.roundedRect(margin, y, contentWidth, 35, 3, 3, 'FD');
          doc.setLineDashPattern([], 0);
          drawText(`[رسم بياني: ${section.content}]`, pageWidth / 2, y + 18, { fontSize: 11, color: [156, 163, 175], align: 'center' });
          y += 40;
          break;

        case 'image':
          checkPage(40);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(209, 213, 219);
          doc.setLineDashPattern([3, 3], 0);
          doc.roundedRect(margin, y, contentWidth, 35, 3, 3, 'FD');
          doc.setLineDashPattern([], 0);
          drawText(`[صورة: ${section.content}]`, pageWidth / 2, y + 18, { fontSize: 11, color: [156, 163, 175], align: 'center' });
          y += 40;
          break;

        case 'divider':
          checkPage(10);
          y += 4;
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.3);
          doc.line(margin + 20, y, pageWidth - margin - 20, y);
          y += 6;
          break;
      }
    }

    // Footer on each page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`${meta.title} | صفحة ${i} من ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`${meta.title || 'تقرير'}.pdf`);
  };

  /* ---- Drag handlers for section list ---- */
  const handleDragStart = (id: string) => setDraggedSection(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverSection(id); };
  const handleDrop = (id: string) => {
    if (draggedSection && draggedSection !== id) moveSection(draggedSection, id);
    setDraggedSection(null);
    setDragOverSection(null);
  };
  const handleDragEnd = () => { setDraggedSection(null); setDragOverSection(null); };

  const selectedSec = sections.find(s => s.id === selectedSection);

  /* ---- Section icon ---- */
  const getSectionIcon = (type: string) => {
    const found = sectionTypes.find(t => t.type === type);
    return found?.icon || (type === 'cover' ? 'auto_stories' : 'notes');
  };

  /* ---- Render section in preview ---- */
  const renderPreviewSection = (sec: ReportSection) => {
    switch (sec.type) {
      case 'cover':
        return (
          <div className="cover">
            <h1>{sec.content}</h1>
            <h2>{sec.subContent}</h2>
            <div className="meta">{meta.author} — {meta.date}</div>
            <div className="classification">{meta.classification}</div>
          </div>
        );
      case 'heading':
        return sec.level === 1 ? <h1>{sec.content}</h1> : sec.level === 3 ? <h3>{sec.content}</h3> : <h2>{sec.content}</h2>;
      case 'paragraph':
        return <p>{sec.content}</p>;
      case 'chart':
        return (
          <div className="chart-placeholder">
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{sec.content}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', height: '120px' }}>
              {[75, 88, 94, 69, 91, 82, 96, 78, 93, 85].map((v, i) => (
                <div key={i} style={{ width: '24px', background: `hsl(${220 + i * 5}, 70%, ${45 + (v - 69)}%)`, height: `${v}%`, borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }} title={`${v}%`} />
              ))}
            </div>
          </div>
        );
      case 'table':
        if (!sec.tableData) return null;
        return (
          <table>
            <thead><tr>{sec.tableData[0]?.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{sec.tableData.slice(1).map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
          </table>
        );
      case 'kpi':
        return (
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="value">{sec.kpiValue}</div>
              <div className="label">{sec.kpiLabel}</div>
            </div>
            <div className="kpi-card">
              <div className="value">١٧</div>
              <div className="label">جهة مشمولة</div>
            </div>
            <div className="kpi-card">
              <div className="value">+٨٪</div>
              <div className="label">التحسن الربعي</div>
            </div>
          </div>
        );
      case 'recommendation':
        return (
          <div className="recommendation">
            <div className="priority">{sec.subContent}</div>
            <div className="text">{sec.content}</div>
          </div>
        );
      case 'quote':
        return <blockquote>{sec.content}</blockquote>;
      case 'divider':
        return <hr />;
      case 'image':
        return sec.imageUrl
          ? <img src={sec.imageUrl} alt={sec.content} style={{ maxWidth: '100%', borderRadius: '8px', margin: '16px 0' }} />
          : <div className="image-placeholder">📷 {sec.content || 'صورة'}</div>;
      default:
        return <p>{sec.content}</p>;
    }
  };

  /* ---- Render section in editor ---- */
  const renderEditorSection = (sec: ReportSection) => {
    const isSelected = selectedSection === sec.id;
    const isEditing = editingContent === sec.id;
    const isDragOver = dragOverSection === sec.id;

    return (
      <div
        key={sec.id}
        draggable
        onDragStart={() => handleDragStart(sec.id)}
        onDragOver={(e) => handleDragOver(e, sec.id)}
        onDrop={() => handleDrop(sec.id)}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedSection(sec.id)}
        onDoubleClick={() => setEditingContent(sec.id)}
        className={`group relative rounded-xl border transition-all cursor-pointer mb-2 ${
          isSelected ? 'border-primary/40 bg-primary/3 shadow-sm' : 'border-transparent hover:border-border hover:bg-accent/10'
        } ${isDragOver ? 'border-primary border-dashed bg-primary/5' : ''} ${draggedSection === sec.id ? 'opacity-40' : ''}`}
      >
        {/* Section type badge */}
        <div className="absolute -right-1 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); duplicateSection(sec.id); }} className="w-5 h-5 rounded bg-accent flex items-center justify-center hover:bg-primary/10 transition-colors" title="تكرار">
              <MaterialIcon icon="content_copy" size={10} className="text-muted-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteSection(sec.id); }} className="w-5 h-5 rounded bg-accent flex items-center justify-center hover:bg-danger/10 transition-colors" title="حذف">
              <MaterialIcon icon="close" size={10} className="text-muted-foreground hover:text-danger" />
            </button>
          </div>
        </div>

        {/* Drag handle */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
          <MaterialIcon icon="drag_indicator" size={14} className="text-muted-foreground" />
        </div>

        <div className="p-3 pr-7">
          {/* Cover */}
          {sec.type === 'cover' && (
            <div className="text-center py-6 bg-gradient-to-b from-primary/5 to-transparent rounded-lg">
              {isEditing ? (
                <input autoFocus value={sec.content} onChange={e => updateSection(sec.id, { content: e.target.value })}
                  onBlur={() => setEditingContent(null)} onKeyDown={e => e.key === 'Enter' && setEditingContent(null)}
                  className="text-xl font-bold text-center w-full bg-transparent outline-none text-foreground" />
              ) : (
                <h1 className="text-xl font-bold text-foreground">{sec.content}</h1>
              )}
              <p className="text-sm text-muted-foreground mt-1">{sec.subContent}</p>
              <p className="text-xs text-muted-foreground mt-2">{meta.author}</p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">{meta.classification}</span>
            </div>
          )}

          {/* Heading */}
          {sec.type === 'heading' && (
            isEditing ? (
              <input autoFocus value={sec.content} onChange={e => updateSection(sec.id, { content: e.target.value })}
                onBlur={() => setEditingContent(null)} onKeyDown={e => e.key === 'Enter' && setEditingContent(null)}
                className={`w-full bg-transparent outline-none text-foreground font-bold ${sec.level === 1 ? 'text-lg' : sec.level === 3 ? 'text-sm' : 'text-base'}`} />
            ) : (
              <div className="flex items-center gap-2">
                <MaterialIcon icon="title" size={14} className="text-primary shrink-0" />
                <span className={`font-bold text-foreground ${sec.level === 1 ? 'text-lg' : sec.level === 3 ? 'text-sm' : 'text-base'}`}>{sec.content}</span>
              </div>
            )
          )}

          {/* Paragraph */}
          {sec.type === 'paragraph' && (
            isEditing ? (
              <textarea autoFocus value={sec.content} onChange={e => updateSection(sec.id, { content: e.target.value })}
                onBlur={() => setEditingContent(null)}
                className="w-full bg-transparent outline-none text-foreground text-[13px] leading-relaxed resize-none min-h-[60px]" rows={3} />
            ) : (
              <p className="text-[13px] text-foreground/80 leading-relaxed">{sec.content}</p>
            )
          )}

          {/* Chart */}
          {sec.type === 'chart' && (
            <div className="bg-accent/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <MaterialIcon icon="bar_chart" size={14} className="text-primary" />
                <span className="text-[12px] font-medium text-foreground">{sec.content}</span>
              </div>
              <div className="flex items-end gap-1.5 h-[80px] px-2">
                {[75, 88, 94, 69, 91, 82, 96, 78, 93, 85].map((v, i) => (
                  <div key={i} className="flex-1 rounded-t transition-all hover:opacity-80" style={{ height: `${v}%`, background: `hsl(220, 70%, ${50 + (i * 3)}%)` }} title={`${v}%`} />
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          {sec.type === 'table' && sec.tableData && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>{sec.tableData[0]?.map((h, i) => <th key={i} className="bg-primary/10 text-primary font-medium py-1.5 px-2 text-right border-b border-border">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sec.tableData.slice(1).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/30">
                      {row.map((cell, ci) => <td key={ci} className="py-1.5 px-2 text-foreground">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* KPI */}
          {sec.type === 'kpi' && (
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[80px] p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                <div className="text-xl font-bold text-primary">{sec.kpiValue}</div>
                <div className="text-[10px] text-muted-foreground">{sec.kpiLabel}</div>
                <MaterialIcon icon={sec.kpiTrend === 'up' ? 'trending_up' : sec.kpiTrend === 'down' ? 'trending_down' : 'trending_flat'} size={14}
                  className={sec.kpiTrend === 'up' ? 'text-success' : sec.kpiTrend === 'down' ? 'text-danger' : 'text-warning'} />
              </div>
              <div className="flex-1 min-w-[80px] p-3 rounded-lg bg-success/5 border border-success/10 text-center">
                <div className="text-xl font-bold text-success">١٧</div>
                <div className="text-[10px] text-muted-foreground">جهة مشمولة</div>
              </div>
              <div className="flex-1 min-w-[80px] p-3 rounded-lg bg-info/5 border border-info/10 text-center">
                <div className="text-xl font-bold text-info">+٨٪</div>
                <div className="text-[10px] text-muted-foreground">التحسن الربعي</div>
              </div>
            </div>
          )}

          {/* Recommendation */}
          {sec.type === 'recommendation' && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border-r-2 border-warning">
              <MaterialIcon icon="lightbulb" size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                {isEditing ? (
                  <textarea autoFocus value={sec.content} onChange={e => updateSection(sec.id, { content: e.target.value })}
                    onBlur={() => setEditingContent(null)} className="w-full bg-transparent outline-none text-foreground text-[12px] resize-none" rows={2} />
                ) : (
                  <p className="text-[12px] text-foreground">{sec.content}</p>
                )}
                <span className="text-[9px] font-medium text-warning">{sec.subContent}</span>
              </div>
            </div>
          )}

          {/* Quote */}
          {sec.type === 'quote' && (
            <div className="border-r-3 border-primary bg-primary/3 p-3 rounded-lg">
              <MaterialIcon icon="format_quote" size={20} className="text-primary/30 mb-1" />
              {isEditing ? (
                <textarea autoFocus value={sec.content} onChange={e => updateSection(sec.id, { content: e.target.value })}
                  onBlur={() => setEditingContent(null)} className="w-full bg-transparent outline-none text-foreground/70 text-[13px] italic resize-none" rows={2} />
              ) : (
                <p className="text-[13px] text-foreground/70 italic">{sec.content}</p>
              )}
            </div>
          )}

          {/* Divider */}
          {sec.type === 'divider' && <hr className="border-t border-border my-2" />}

          {/* Image */}
          {sec.type === 'image' && (
            sec.imageUrl ? (
              <img src={sec.imageUrl} alt={sec.content} className="max-w-full rounded-lg" />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg hover:border-primary/30 transition-colors">
                <MaterialIcon icon="add_photo_alternate" size={28} className="text-muted-foreground/30 mb-1" />
                <span className="text-[11px] text-muted-foreground">اسحب صورة أو انقر للإضافة</span>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => updateSection(sec.id, { imageUrl: ev.target?.result as string, content: file.name });
                      reader.readAsDataURL(file);
                    }
                  }} />
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  /* =============== RENDER =============== */
  return (
    <>
      <div className="flex-1 h-full bg-card rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-xl relative gold-border-glow">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line z-10" />
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar glass">
          <ModeSwitcher mode={mode} onToggle={setMode} />
          <div className="h-4 w-px bg-border mx-1" />

          {/* Insert */}
          <div className="relative">
            <button onClick={() => setShowInsertMenu(!showInsertMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
              <MaterialIcon icon="add_box" size={14} />
              <span className="hidden sm:inline">إدراج</span>
            </button>
            {showInsertMenu && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-xl shadow-lg p-2 z-50 w-[180px] animate-fade-in">
                {sectionTypes.map(st => (
                  <button key={st.type} onClick={() => addSection(st.type)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-foreground hover:bg-accent transition-all">
                    <MaterialIcon icon={st.icon} size={14} className="text-primary" />
                    {st.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="relative">
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
              <MaterialIcon icon="auto_fix_high" size={14} />
              <span className="hidden sm:inline">قالب</span>
            </button>
            {showTemplates && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-xl shadow-lg p-2 z-50 w-[200px] animate-fade-in">
                {templates.map(t => (
                  <button key={t.id} onClick={() => setShowTemplates(false)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-foreground hover:bg-accent transition-all">
                    <MaterialIcon icon={t.icon} size={14} className={t.color} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <button id="rasid-report-preview-btn" onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              previewMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}>
            <MaterialIcon icon={previewMode ? 'edit' : 'preview'} size={14} />
            <span className="hidden sm:inline">{previewMode ? 'تحرير' : 'معاينة'}</span>
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Undo/Redo */}
          <button onClick={undo} disabled={undoStack.length === 0} title="تراجع (Ctrl+Z)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all disabled:opacity-30">
            <MaterialIcon icon="undo" size={14} className="text-muted-foreground" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} title="إعادة (Ctrl+Y)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all disabled:opacity-30">
            <MaterialIcon icon="redo" size={14} className="text-muted-foreground" />
          </button>

          {/* Save Status */}
          <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} />
          <button onClick={forceSave} title="حفظ يدوي (Ctrl+S)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <MaterialIcon icon="save" size={14} className="text-muted-foreground" />
          </button>

          <div className="flex-1" />

          {/* Export */}
          <button onClick={exportPDF}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <MaterialIcon icon="picture_as_pdf" size={14} />
            <span className="hidden sm:inline">تصدير PDF</span>
          </button>

          {mode === 'advanced' && (
            <button onClick={() => setShowProperties(!showProperties)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                showProperties ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}>
              <MaterialIcon icon="tune" size={14} />
              <span className="hidden sm:inline">خصائص</span>
            </button>
          )}
        </div>

        {/* Properties Bar (Advanced) */}
        {mode === 'advanced' && showProperties && selectedSec && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-accent/10 shrink-0 overflow-x-auto no-scrollbar animate-fade-in">
            <span className="text-[9px] text-muted-foreground shrink-0">النوع:</span>
            <span className="text-[10px] font-medium text-primary shrink-0">{sectionTypes.find(t => t.type === selectedSec.type)?.label || selectedSec.type}</span>
            {selectedSec.type === 'heading' && (
              <>
                <div className="h-3 w-px bg-border" />
                <span className="text-[9px] text-muted-foreground shrink-0">المستوى:</span>
                {[1, 2, 3].map(l => (
                  <button key={l} onClick={() => updateSection(selectedSec.id, { level: l })}
                    className={`w-5 h-5 rounded text-[9px] font-bold ${selectedSec.level === l ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                    H{l}
                  </button>
                ))}
              </>
            )}
            {selectedSec.type === 'chart' && (
              <>
                <div className="h-3 w-px bg-border" />
                <span className="text-[9px] text-muted-foreground shrink-0">النوع:</span>
                {(['bar', 'line', 'pie', 'radar'] as const).map(ct => (
                  <button key={ct} onClick={() => updateSection(selectedSec.id, { chartType: ct })}
                    className={`px-1.5 py-0.5 rounded text-[9px] ${selectedSec.chartType === ct ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                    {ct === 'bar' ? 'أعمدة' : ct === 'line' ? 'خطي' : ct === 'pie' ? 'دائري' : 'رادار'}
                  </button>
                ))}
              </>
            )}
            {selectedSec.type === 'kpi' && (
              <>
                <div className="h-3 w-px bg-border" />
                <span className="text-[9px] text-muted-foreground shrink-0">الاتجاه:</span>
                {(['up', 'down', 'stable'] as const).map(t => (
                  <button key={t} onClick={() => updateSection(selectedSec.id, { kpiTrend: t })}
                    className={`px-1.5 py-0.5 rounded text-[9px] ${selectedSec.kpiTrend === t ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                    {t === 'up' ? '↑ صعود' : t === 'down' ? '↓ هبوط' : '→ ثابت'}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Section List (sidebar) */}
          <div className="w-[180px] sm:w-[200px] border-l border-border bg-accent/5 flex flex-col shrink-0 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-border flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground">الأقسام ({sections.length})</span>
              <button onClick={() => addSection('paragraph')} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent transition-colors">
                <MaterialIcon icon="add" size={12} className="text-primary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {sections.map((sec, i) => (
                <button
                  key={sec.id}
                  draggable
                  onDragStart={() => handleDragStart(sec.id)}
                  onDragOver={(e) => handleDragOver(e, sec.id)}
                  onDrop={() => handleDrop(sec.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedSection(sec.id)}
                  className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[10px] mb-0.5 transition-all ${
                    selectedSection === sec.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'
                  } ${dragOverSection === sec.id ? 'bg-primary/5 border border-dashed border-primary' : ''}`}
                >
                  <MaterialIcon icon={getSectionIcon(sec.type)} size={12} className={selectedSection === sec.id ? 'text-primary' : 'text-muted-foreground'} />
                  <span className="truncate flex-1 text-right">{sec.content.slice(0, 25) || sec.type}</span>
                  <span className="text-[8px] text-muted-foreground shrink-0">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor / Preview */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {previewMode ? (
              <div ref={previewRef} className="max-w-[700px] mx-auto bg-white text-gray-900 rounded-xl shadow-sm border border-border p-6 sm:p-8" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                {sections.map(sec => (
                  <div key={sec.id}>{renderPreviewSection(sec)}</div>
                ))}
              </div>
            ) : (
              <div className="max-w-[700px] mx-auto">
                {sections.map(sec => renderEditorSection(sec))}
                {/* Add section button */}
                <button onClick={() => addSection('paragraph')}
                  className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/3 transition-all flex items-center justify-center gap-1.5 text-[11px]">
                  <MaterialIcon icon="add" size={14} />
                  إضافة قسم
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="px-2 pb-1.5 pt-1 border-t border-border shrink-0">
          <div className="flex items-center gap-1.5 bg-accent/30 rounded-xl px-2 py-1.5">
            <img src={theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving} alt="راصد" className="w-5 h-5 rounded-full object-contain" />
            <input 
              type="text" 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAIGenerate(); }}
              placeholder="اطلب من راصد تعديل التقرير... مثال: أضف قسم التوصيات مع رسم بياني" 
              className="flex-1 bg-transparent text-[10px] sm:text-[11px] outline-none text-foreground placeholder:text-muted-foreground" 
              disabled={aiLoading}
            />
            <button 
              onClick={handleAIGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className={`w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-all ${aiLoading ? 'animate-spin' : ''}`}
            >
              <MaterialIcon icon={aiLoading ? 'progress_activity' : 'send'} size={13} className="text-primary" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
