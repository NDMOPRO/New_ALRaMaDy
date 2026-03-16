/* ═══════════════════════════════════════════════════════════════
   WorkspaceView — 9 engines integrated with CDR Matching & Full Presentations
   All with drag-and-drop, Easy/Advanced modes, responsive layouts
   ═══════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';
import ModeSwitcher from './ModeSwitcher';
import { CHARACTERS, REPORT_ACTIONS, PRESENTATION_ACTIONS, DASHBOARD_ACTIONS } from '@/lib/assets';
import { RASED_USAGE } from '@/lib/rasedAssets';
import { useTheme } from '@/contexts/ThemeContext';
import PresentationsEngine from './PresentationsEngine';
import ReportsEngine from './ReportsEngine';
import DashboardEngine from './DashboardEngine';
import ExcelEngine from './ExcelEngine';
import ExtractionEngine from './ExtractionEngine';
import TranslationEngine from './TranslationEngine';
import VisualMatchEngine from './VisualMatchEngine';
import LibraryEngine from './LibraryEngine';

interface WorkspaceViewProps {
  viewId: string;
}

export default function WorkspaceView({ viewId }: WorkspaceViewProps) {
  const renderEngine = () => {
    switch (viewId) {
      case 'data': return <ExcelEngine />;
      case 'library': return <LibraryEngine />;
      // All other engines are accessed via Chat wizards in the simplified UI.
      // If a direct viewId is passed (e.g. from navigateTo), render the engine inline.
      case 'presentations': return <PresentationsEngine />;
      case 'reports': return <ReportsEngine />;
      case 'dashboard': return <DashboardEngine />;
      case 'matching': return <VisualMatchEngine />;
      case 'extraction': return <ExtractionEngine />;
      case 'translation': return <TranslationEngine />;
      default: return <LibraryEngine />;
    }
  };
  return (
    <div key={viewId} className="h-full animate-engine-enter">
      {renderEngine()}
    </div>
  );
}

/* ===== بياناتي — Enhanced Smart Spreadsheet ===== */
function DataWorkspace() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [formulaBar, setFormulaBar] = useState('');
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [showProfiler, setShowProfiler] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sampleHeaders = ['الجهة', 'نسبة الامتثال', 'مستوى النضج', 'البيانات المفتوحة', 'التصنيف', 'الحالة'];
  const [rows, setRows] = useState([
    ['وزارة المالية', '٩٤٪', 'متقدم', '٨٧٪', 'أ', 'مكتمل'],
    ['وزارة الصحة', '٨٨٪', 'متقدم', '٧٩٪', 'أ', 'مكتمل'],
    ['وزارة التعليم', '٧٦٪', 'متوسط', '٦٥٪', 'ب', 'قيد المراجعة'],
    ['هيئة الاتصالات', '٩١٪', 'متقدم', '٨٣٪', 'أ', 'مكتمل'],
    ['هيئة الزكاة', '٦٩٪', 'مبتدئ', '٤٢٪', 'ج', 'يحتاج تحسين'],
    ['وزارة الداخلية', '٨٢٪', 'متوسط', '٧١٪', 'ب', 'مكتمل'],
    ['هيئة السوق المالية', '٩٦٪', 'متقدم', '٩٠٪', 'أ+', 'مكتمل'],
    ['وزارة الموارد البشرية', '٧٨٪', 'متوسط', '٦٨٪', 'ب', 'قيد المراجعة'],
    ['هيئة الحكومة الرقمية', '٩٣٪', 'متقدم', '٨٥٪', 'أ', 'مكتمل'],
    ['وزارة التجارة', '٨٥٪', 'متقدم', '٧٤٪', 'أ', 'مكتمل'],
  ]);

  const toggleRow = (i: number) => {
    setSelectedRows(prev => prev.includes(i) ? prev.filter(r => r !== i) : [...prev, i]);
  };
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
    setFormulaBar(rows[row]?.[col] || '');
  };
  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setFormulaBar(rows[row]?.[col] || '');
  };
  const handleCellEdit = (value: string) => {
    if (editingCell) {
      const newRows = [...rows];
      newRows[editingCell.row] = [...newRows[editingCell.row]];
      newRows[editingCell.row][editingCell.col] = value;
      setRows(newRows);
    }
    setEditingCell(null);
  };
  const handleSort = (col: number) => {
    if (sortCol === col) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedRows = sortCol !== null ? [...rows].sort((a, b) => {
    const cmp = a[sortCol].localeCompare(b[sortCol], 'ar');
    return sortDir === 'asc' ? cmp : -cmp;
  }) : rows;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'مكتمل': return 'bg-success/10 text-success';
      case 'قيد المراجعة': return 'bg-info/10 text-info';
      case 'يحتاج تحسين': return 'bg-danger/10 text-danger';
      default: return 'bg-warning/10 text-warning';
    }
  };
  const getMaturityStyle = (level: string) => {
    switch (level) {
      case 'متقدم': return 'text-success';
      case 'متوسط': return 'text-warning';
      case 'مبتدئ': return 'text-danger';
      default: return 'text-muted-foreground';
    }
  };

  const profilerStats = [
    { label: 'إجمالي الصفوف', value: rows.length.toString(), icon: 'table_rows' },
    { label: 'الأعمدة', value: sampleHeaders.length.toString(), icon: 'view_column' },
    { label: 'القيم الفارغة', value: '٠', icon: 'block' },
    { label: 'التكرارات', value: '٠', icon: 'content_copy' },
    { label: 'جودة البيانات', value: '٩٨٪', icon: 'verified' },
  ];

  return (
    <div
      className={`flex-1 h-full bg-card rounded-xl sm:rounded-2xl flex flex-col overflow-hidden shadow-sm transition-all ${dragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => setDragOver(false)}
    >
      {/* Enhanced Toolbar */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 border-b border-border shrink-0 overflow-x-auto no-scrollbar">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-1" />
        <ToolbarBtn icon="upload_file" label="استيراد" />
        <ToolbarBtn icon="cleaning_services" label="تنظيف" />
        <ToolbarBtn icon="merge_type" label="دمج" />
        <ToolbarBtn icon="analytics" label="تحليل" />
        <ToolbarBtn icon="download" label="تصدير" />
        {mode === 'advanced' && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <ToolbarBtn icon="functions" label="معادلة" />
            <ToolbarBtn icon="filter_list" label="تصفية" />
            <ToolbarBtn icon="pivot_table_chart" label="محوري" />
            <ToolbarBtn icon="rule" label="تحقق" />
            <ToolbarBtn icon="query_stats" label="ملف تعريف" active={showProfiler} onClick={() => setShowProfiler(!showProfiler)} />
          </>
        )}
        <div className="flex-1" />
        {selectedRows.length > 0 && (
          <span className="text-[9px] sm:text-[10px] text-primary font-medium animate-fade-in">{selectedRows.length} محدد</span>
        )}
        <span className="text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap">{rows.length} صفوف × {sampleHeaders.length} أعمدة</span>
      </div>

      {/* Formula Bar (Advanced mode) */}
      {mode === 'advanced' && (
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1 border-b border-border bg-accent/10 shrink-0 animate-fade-in">
          <MaterialIcon icon="functions" size={14} className="text-primary shrink-0" />
          <span className="text-[9px] text-muted-foreground shrink-0">
            {selectedCell ? `${sampleHeaders[selectedCell.col]}[${selectedCell.row + 1}]` : 'خلية'}
          </span>
          <div className="h-3 w-px bg-border" />
          <input
            type="text"
            value={formulaBar}
            onChange={e => setFormulaBar(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && editingCell) handleCellEdit(formulaBar); }}
            placeholder="أدخل قيمة أو معادلة (=SUM, =AVG, ...)"
            className="flex-1 bg-transparent text-[11px] outline-none text-foreground placeholder:text-muted-foreground font-mono"
          />
        </div>
      )}

      {/* Data Profiler (Advanced mode) */}
      {mode === 'advanced' && showProfiler && (
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 border-b border-border bg-primary/3 shrink-0 overflow-x-auto no-scrollbar animate-fade-in">
          {profilerStats.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card border border-border/50 shrink-0 animate-stagger-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <MaterialIcon icon={stat.icon} size={12} className="text-primary" />
              <span className="text-[9px] text-muted-foreground">{stat.label}:</span>
              <span className="text-[9px] font-bold text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spreadsheet Table */}
      <div className="flex-1 overflow-auto data-grid-container">
        <table className="w-full text-[11px] sm:text-[12px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-accent/30 backdrop-blur-sm">
              <th className="w-8 text-center py-2 text-muted-foreground font-medium text-[9px] sm:text-[10px] border-b border-border">#</th>
              {sampleHeaders.map((h, ci) => (
                <th
                  key={h}
                  onClick={() => handleSort(ci)}
                  className="text-right py-2 px-2 sm:px-3 text-muted-foreground font-medium text-[9px] sm:text-[10px] border-b border-border whitespace-nowrap cursor-pointer hover:bg-accent/40 transition-colors select-none"
                >
                  <span className="flex items-center gap-1">
                    {h}
                    {sortCol === ci && (
                      <MaterialIcon icon={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'} size={10} className="text-primary" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={i}
                onClick={() => toggleRow(i)}
                className={`hover:bg-accent/15 transition-colors border-b border-border/30 cursor-pointer animate-stagger-in ${selectedRows.includes(i) ? 'bg-primary/5' : ''}`}
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <td className="text-center py-1.5 text-muted-foreground text-[9px] sm:text-[10px] border-l border-border/20">{i + 1}</td>
                {row.map((cell, ci) => {
                  const isSelected = selectedCell?.row === i && selectedCell?.col === ci;
                  const isEditing = editingCell?.row === i && editingCell?.col === ci;
                  return (
                    <td
                      key={ci}
                      onClick={e => { e.stopPropagation(); handleCellClick(i, ci); }}
                      onDoubleClick={e => { e.stopPropagation(); handleCellDoubleClick(i, ci); }}
                      className={`py-1.5 px-2 sm:px-3 border-l border-border/10 transition-all ${
                        isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : ''
                      } ${ci === 5 ? '' : ''}`}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={cell}
                          onBlur={e => handleCellEdit(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleCellEdit((e.target as HTMLInputElement).value); }}
                          className="w-full bg-card border border-primary/30 rounded px-1 py-0.5 text-[11px] outline-none"
                        />
                      ) : ci === 5 ? (
                        <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusStyle(cell)}`}>{cell}</span>
                      ) : ci === 2 ? (
                        <span className={`font-medium ${getMaturityStyle(cell)}`}>{cell}</span>
                      ) : (
                        <span>{cell}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RasidMiniBar placeholder="اطلب من راصد تحليل البيانات... مثال: حلل نسب الامتثال" />
    </div>
  );
}

/* ===== تقاريري — Enhanced Report Editor ===== */
function MatchingWorkspace() {
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [dragOverSource, setDragOverSource] = useState(false);
  const [matchProgress, setMatchProgress] = useState<number | null>(null);
  const [showCDRLayers, setShowCDRLayers] = useState(false);
  const [showFidelityScore, setShowFidelityScore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('matching');
  const [showDiffView, setShowDiffView] = useState(false);

  const categories = [
    { id: 'matching', label: 'مطابقة بصرية', icon: 'compare' },
    { id: 'reconstruction', label: 'إعادة بناء حية', icon: 'construction' },
    { id: 'lct', label: 'تعريب LCT', icon: 'g_translate' },
    { id: 'extraction', label: 'تفريغ واستخراج', icon: 'text_snippet' },
    { id: 'conversion', label: 'تحويل صيغ', icon: 'swap_horiz' },
  ];

  const operations: Record<string, Array<{ icon: string; label: string; desc: string }>> = {
    matching: [
      { icon: 'slideshow', label: 'مطابقة إلى عرض', desc: 'CDR 1:1 — تحويل إلى عرض تقديمي مطابق حرفياً' },
      { icon: 'article', label: 'مطابقة إلى مستند', desc: 'CDR 1:1 — تحويل إلى مستند نصي بدقة كاملة' },
      { icon: 'table_chart', label: 'مطابقة إلى جدول', desc: 'CDR 1:1 — استخراج البيانات في جدول بدقة كاملة' },
      { icon: 'dashboard', label: 'مطابقة إلى لوحة', desc: 'CDR 1:1 — إنشاء لوحة مؤشرات مطابقة' },
    ],
    reconstruction: [
      { icon: 'dashboard_customize', label: 'صورة → لوحة حية', desc: 'إعادة بناء لوحة مؤشرات تفاعلية كاملة من صورة' },
      { icon: 'slideshow', label: 'صورة → عرض حي', desc: 'إعادة بناء عرض تقديمي قابل للتحرير من صورة' },
      { icon: 'description', label: 'صورة → تقرير حي', desc: 'إعادة بناء تقرير كامل قابل للتحرير' },
      { icon: 'grid_on', label: 'صورة → إكسل حي', desc: 'إعادة بناء جدول بيانات بمعادلات حية' },
      { icon: 'picture_as_pdf', label: 'PDF → لوحة BI', desc: 'تحويل PDF إلى لوحة ذكاء أعمال تفاعلية' },
      { icon: 'screenshot', label: 'لقطة → عرض PPT', desc: 'تحويل لقطة شاشة إلى عرض تقديمي' },
    ],
    lct: [
      { icon: 'g_translate', label: 'تعريب احترافي (LCT)', desc: 'تحويل لغوي وثقافي وتقني كامل' },
      { icon: 'translate', label: 'ترجمة متعددة', desc: 'ترجمة مع الحفاظ على التنسيق والتخطيط' },
      { icon: 'swap_horiz', label: 'عكس RTL/LTR', desc: 'عكس اتجاه التخطيط مع حساب رياضي دقيق' },
    ],
    extraction: [
      { icon: 'mic', label: 'تفريغ صوت/فيديو', desc: 'تحويل الصوت والفيديو إلى نص منسق' },
      { icon: 'text_snippet', label: 'استخراج نصوص OCR', desc: 'OCR ذكي مع تصحيح تلقائي وتنسيق' },
      { icon: 'schema', label: 'استخراج هيكلي', desc: 'استخراج البنية الهيكلية من أي مستند' },
    ],
    conversion: [
      { icon: 'transform', label: 'أي صيغة → أي صيغة', desc: 'تحويل شامل بين جميع الصيغ' },
      { icon: 'picture_as_pdf', label: 'PDF → Word', desc: 'تحويل مع الحفاظ على التنسيق' },
      { icon: 'table_chart', label: 'Excel → Dashboard', desc: 'تحويل جدول إلى لوحة مؤشرات' },
    ],
  };

  const cdrLayers = [
    { name: 'البنية الهيكلية', score: 99.8, icon: 'account_tree', color: 'text-success' },
    { name: 'التخطيط المكاني', score: 99.5, icon: 'grid_on', color: 'text-success' },
    { name: 'الطباعة والخطوط', score: 98.9, icon: 'text_fields', color: 'text-success' },
    { name: 'الألوان والتدرجات', score: 99.7, icon: 'palette', color: 'text-success' },
    { name: 'الرسوم البيانية', score: 97.2, icon: 'bar_chart', color: 'text-warning' },
    { name: 'البيانات والمعادلات', score: 100, icon: 'functions', color: 'text-success' },
    { name: 'التفاعلية', score: 96.5, icon: 'touch_app', color: 'text-warning' },
  ];

  const handleSourceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSource(false);
    setSourceFile('ملف_المصدر.pdf');
    if (selectedOp) {
      setMatchProgress(0);
      const interval = setInterval(() => {
        setMatchProgress(prev => {
          if (prev !== null && prev >= 100) { clearInterval(interval); return 100; }
          return (prev || 0) + 5;
        });
      }, 150);
    }
  };

  const currentOps = operations[activeCategory] || [];

  return (
    <div className="flex-1 h-full bg-card rounded-xl sm:rounded-2xl flex flex-col overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 border-b border-border shrink-0 overflow-x-auto no-scrollbar">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-1" />
        {categories.map(cat => (
          <ToolbarBtn
            key={cat.id}
            icon={cat.icon}
            label={cat.label}
            active={activeCategory === cat.id}
            onClick={() => { setActiveCategory(cat.id); setSelectedOp(null); }}
          />
        ))}
        {mode === 'advanced' && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <ToolbarBtn icon="layers" label="CDR 7-Layer" onClick={() => setShowCDRLayers(!showCDRLayers)} active={showCDRLayers} />
            <ToolbarBtn icon="difference" label="فرق بصري" onClick={() => setShowDiffView(!showDiffView)} active={showDiffView} />
            <ToolbarBtn icon="verified" label="نتيجة الدقة" onClick={() => setShowFidelityScore(!showFidelityScore)} active={showFidelityScore} />
            <ToolbarBtn icon="lock" label="STRICT" />
          </>
        )}
        <div className="flex-1" />
        {matchProgress !== null && matchProgress < 100 && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${matchProgress}%` }} />
            </div>
            <span className="text-[9px] text-primary font-medium">{matchProgress}%</span>
          </div>
        )}
        {matchProgress === 100 && (
          <span className="text-[9px] text-success font-medium flex items-center gap-0.5 animate-fade-in">
            <MaterialIcon icon="verified" size={11} />
            CDR 100%
          </span>
        )}
      </div>

      {/* CDR 7-Layer Panel (Advanced) */}
      {mode === 'advanced' && showCDRLayers && (
        <div className="border-b border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="layers" size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">CDR 7-Layer Structural Model</span>
            <span className="text-[8px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium mr-auto">STRICT MODE</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {cdrLayers.map((layer, i) => (
              <div key={layer.name} className="flex flex-col items-center p-2 rounded-xl bg-card border border-border/50 animate-stagger-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <MaterialIcon icon={layer.icon} size={16} className={layer.color} />
                <span className="text-[8px] text-muted-foreground mt-1 text-center leading-tight">{layer.name}</span>
                <span className={`text-[10px] font-bold mt-0.5 ${layer.color}`}>{layer.score}%</span>
                <div className="w-full h-1 bg-accent rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${layer.score >= 99 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${layer.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fidelity Score Panel */}
      {mode === 'advanced' && showFidelityScore && matchProgress === 100 && (
        <div className="border-b border-border bg-success/3 p-2 sm:p-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="verified" size={14} className="text-success" />
            <span className="text-[10px] font-bold text-muted-foreground">Fidelity Scoring Engine</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Structural Score', value: '99.8%', icon: 'account_tree' },
              { label: 'Pixel Score', value: '99.5%', icon: 'grid_on' },
              { label: 'Density Score', value: '99.2%', icon: 'density_medium' },
              { label: 'Hierarchy Score', value: '99.7%', icon: 'format_list_numbered' },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-1.5 p-2 rounded-lg bg-card border border-success/20 animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
                <MaterialIcon icon={s.icon} size={14} className="text-success" />
                <div>
                  <p className="text-[8px] text-muted-foreground">{s.label}</p>
                  <p className="text-[11px] font-bold text-success">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col sm:flex-row gap-2 p-2 sm:p-3 overflow-hidden">
        {/* Source Drop Zone */}
        <div
          className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group p-4 ${
            dragOverSource ? 'border-primary bg-primary/5 scale-[1.01]' : sourceFile ? 'border-success/30 bg-success/3' : 'border-border hover:border-primary/30 hover:bg-primary/3'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOverSource(true); }}
          onDragLeave={() => setDragOverSource(false)}
          onDrop={handleSourceDrop}
        >
          {sourceFile ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-2">
                <MaterialIcon icon="description" size={28} className="text-success" />
              </div>
              <p className="text-[13px] font-medium text-foreground">{sourceFile}</p>
              <p className="text-[10px] text-success mt-0.5">تم تحميل المصدر بنجاح</p>
              <button onClick={() => { setSourceFile(null); setMatchProgress(null); }} className="mt-2 text-[10px] text-muted-foreground hover:text-danger transition-colors">
                إزالة
              </button>
            </div>
          ) : (
            <>
              <MaterialIcon icon="upload_file" size={36} className="text-muted-foreground/20 mb-2 group-hover:text-primary/30 transition-colors" />
              <p className="text-[12px] sm:text-[13px] font-medium text-foreground mb-0.5">أسقط الملف المصدر هنا</p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground text-center">PDF, Word, Excel, PowerPoint, صورة, فيديو, صوت, HTML</p>
              <button className="mt-2 sm:mt-3 px-3 py-1.5 bg-primary/8 text-primary rounded-lg text-[11px] sm:text-[12px] font-medium hover:bg-primary/12 transition-all">
                اختر ملف
              </button>
            </>
          )}
        </div>

        {/* Operations Column */}
        <div className="sm:w-[200px] flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto">
          <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground mb-1 px-0.5 hidden sm:block">
            {categories.find(c => c.id === activeCategory)?.label || 'العمليات'}
          </p>
          {currentOps.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setSelectedOp(opt.label)}
              className={`flex items-center gap-1.5 px-2 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-[11px] font-medium transition-all animate-stagger-in whitespace-nowrap shrink-0 ${
                selectedOp === opt.label
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/20 hover:bg-accent text-foreground'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
              title={opt.desc}
            >
              <MaterialIcon icon={opt.icon} size={14} className={selectedOp === opt.label ? 'text-primary' : 'text-muted-foreground'} />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Output Preview */}
        <div
          className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition-all ${
            matchProgress === 100 ? 'border-success/30 bg-success/3' : 'border-border'
          }`}
        >
          {matchProgress === 100 ? (
            <div className="flex flex-col items-center animate-fade-in-scale">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-2">
                <MaterialIcon icon="verified" size={28} className="text-success" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-0.5">
                {activeCategory === 'reconstruction' ? 'إعادة البناء مكتملة' : 'المطابقة مكتملة'}
              </p>
              <p className="text-[10px] text-success">
                {activeCategory === 'reconstruction'
                  ? 'تم إنشاء مخرج حي وتفاعلي — قابل للتحرير والربط بالبيانات'
                  : 'CDR = ١٠٠٪ — مطابقة حرفية كاملة'}
              </p>
              {activeCategory === 'reconstruction' && (
                <div className="flex flex-wrap gap-1 mt-2 justify-center">
                  {['تفاعلي', 'قابل للتحرير', 'مربوط بالبيانات', 'قابل للتصدير', 'محكوم'].map(tag => (
                    <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 mt-3 flex-wrap justify-center">
                <button className="px-2.5 py-1 bg-primary/8 text-primary rounded-lg text-[10px] font-medium hover:bg-primary/12 transition-all flex items-center gap-1">
                  <MaterialIcon icon="download" size={12} />تحميل
                </button>
                <button className="px-2.5 py-1 bg-accent text-foreground rounded-lg text-[10px] font-medium hover:bg-accent/80 transition-all flex items-center gap-1">
                  <MaterialIcon icon="difference" size={12} />مقارنة
                </button>
                <button className="px-2.5 py-1 bg-accent text-foreground rounded-lg text-[10px] font-medium hover:bg-accent/80 transition-all flex items-center gap-1">
                  <MaterialIcon icon="open_in_new" size={12} />فتح
                </button>
              </div>
            </div>
          ) : matchProgress !== null ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-2 relative overflow-hidden">
                <div className="absolute inset-0 animate-breathe" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)' }} />
                <img src={RASED_USAGE.loadingDefault} alt="راصد" className="w-12 h-12 object-contain animate-float-slow relative z-10" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))' }} />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">
                {activeCategory === 'reconstruction' ? 'جاري إعادة البناء...' : 'جاري المطابقة...'}
              </p>
              <div className="w-32 h-1.5 bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${matchProgress}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{matchProgress}%</p>
              {mode === 'advanced' && matchProgress > 30 && (
                <div className="mt-2 flex flex-col gap-0.5 text-[8px] text-muted-foreground animate-fade-in">
                  <span>• تحليل البنية الهيكلية... ✓</span>
                  {matchProgress > 50 && <span>• استخراج مقاييس الطباعة... ✓</span>}
                  {matchProgress > 70 && <span>• إعادة بناء التخطيط... ✓</span>}
                  {matchProgress > 90 && <span>• التحقق من الدقة البصرية...</span>}
                </div>
              )}
            </div>
          ) : (
            <>
              <MaterialIcon icon="preview" size={36} className="text-muted-foreground/20 mb-2" />
              <p className="text-[12px] sm:text-[13px] font-medium text-foreground mb-0.5">معاينة المخرج</p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground text-center">
                {activeCategory === 'reconstruction'
                  ? 'سيظهر المخرج الحي التفاعلي هنا'
                  : 'سيظهر الناتج هنا بعد التنفيذ'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Diff View (Advanced) */}
      {mode === 'advanced' && showDiffView && matchProgress === 100 && (
        <div className="border-t border-border bg-accent/10 p-2 sm:p-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="difference" size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">Visual Diff — Pixel Comparison (≤ 0.1%)</span>
          </div>
          <div className="flex gap-2 h-[80px]">
            <div className="flex-1 bg-card border border-border rounded-lg flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground">المصدر الأصلي</span>
            </div>
            <div className="w-8 flex items-center justify-center">
              <MaterialIcon icon="compare_arrows" size={16} className="text-primary" />
            </div>
            <div className="flex-1 bg-card border border-border rounded-lg flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground">المخرج المطابق</span>
            </div>
            <div className="flex-1 bg-card border border-success/20 rounded-lg flex items-center justify-center">
              <span className="text-[9px] text-success">الفرق: 0.02%</span>
            </div>
          </div>
        </div>
      )}

      <RasidMiniBar placeholder="اطلب من راصد المطابقة أو التحويل... مثال: طابق هذا الملف إلى عرض تقديمي حي" />
    </div>
  );
}

/* ===== مكتبتي — Enhanced Library ===== */
function LibraryWorkspace() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const sections = [
    {
      title: 'لوحات المؤشرات', icon: 'dashboard',
      items: [
        { title: 'لوحة مؤشرات نضج البيانات الوطنية', date: '٥ مارس ٢٠٢٦', type: 'dashboard', status: 'published' },
        { title: 'لوحة امتثال الجهات', date: '١٢ فبراير ٢٠٢٦', type: 'dashboard', status: 'draft' },
        { title: 'لوحة جودة البيانات المفتوحة', date: '٢٨ يناير ٢٠٢٦', type: 'dashboard', status: 'published' },
      ],
    },
    {
      title: 'التقارير', icon: 'article',
      items: [
        { title: 'تقرير الرصد الربعي للجهات', date: '١٠ مارس ٢٠٢٦', type: 'report', status: 'approved' },
        { title: 'مذكرة تقييم النضج السنوية', date: '٣ يناير ٢٠٢٦', type: 'report', status: 'review' },
      ],
    },
    {
      title: 'العروض التقديمية', icon: 'slideshow',
      items: [
        { title: 'عرض نتائج التقييم الوطني', date: '٨ مارس ٢٠٢٦', type: 'presentation', status: 'published' },
        { title: 'عرض خارطة الطريق', date: '٢٠ فبراير ٢٠٢٦', type: 'presentation', status: 'draft' },
      ],
    },
    {
      title: 'البيانات', icon: 'table_chart',
      items: [
        { title: 'بيانات الجهات الموحدة', date: '٥ مارس ٢٠٢٦', type: 'data', status: 'ready' },
        { title: 'سجل الامتثال المحدّث', date: '١ مارس ٢٠٢٦', type: 'data', status: 'ready' },
      ],
    },
  ];

  const [expanded, setExpanded] = useState<string[]>(['لوحات المؤشرات', 'التقارير', 'العروض التقديمية', 'البيانات']);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dashboard': return 'dashboard';
      case 'report': return 'article';
      case 'presentation': return 'slideshow';
      default: return 'table_chart';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return { label: 'منشور', class: 'bg-success/10 text-success' };
      case 'approved': return { label: 'معتمد', class: 'bg-info/10 text-info' };
      case 'draft': return { label: 'مسودة', class: 'bg-warning/10 text-warning' };
      case 'review': return { label: 'مراجعة', class: 'bg-primary/10 text-primary' };
      default: return { label: 'جاهز', class: 'bg-accent text-muted-foreground' };
    }
  };

  const toggleSection = (title: string) => {
    setExpanded(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
  };

  return (
    <div className="flex-1 h-full bg-card rounded-xl sm:rounded-2xl flex flex-col overflow-hidden shadow-sm">
      <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex-1 flex items-center gap-1.5 bg-accent/30 rounded-lg px-2 py-1">
          <MaterialIcon icon="search" size={14} className="text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث في المكتبة..."
            className="flex-1 bg-transparent text-[11px] outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all"
          title={viewMode === 'list' ? 'عرض شبكي' : 'عرض قائمة'}
        >
          <MaterialIcon icon={viewMode === 'list' ? 'grid_view' : 'view_list'} size={16} className="text-muted-foreground" />
        </button>
        <ToolbarBtn icon="filter_list" label="تصفية" />
        <ToolbarBtn icon="sort" label="ترتيب" />
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-3">
        {viewMode === 'list' ? (
          <div className="flex flex-col gap-1">
            {sections.map(section => (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg hover:bg-accent/30 transition-all"
                >
                  <MaterialIcon icon={expanded.includes(section.title) ? 'expand_more' : 'chevron_left'} size={14} className="text-muted-foreground" />
                  <MaterialIcon icon={section.icon} size={14} className="text-primary" />
                  <span className="text-[11px] font-medium text-foreground">{section.title}</span>
                  <span className="text-[9px] text-muted-foreground mr-auto">{section.items.length}</span>
                </button>
                {expanded.includes(section.title) && (
                  <div className="mr-4 flex flex-col gap-0.5 animate-fade-in">
                    {section.items.map((item, i) => {
                      const badge = getStatusBadge(item.status);
                      return (
                        <div
                          key={item.title}
                          draggable
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-accent/20 transition-all cursor-pointer group animate-stagger-in"
                          style={{ animationDelay: `${i * 0.04}s` }}
                        >
                          <MaterialIcon icon={getTypeIcon(item.type)} size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate">{item.title}</p>
                            <p className="text-[8px] text-muted-foreground">{item.date}</p>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.class}`}>{badge.label}</span>
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MaterialIcon icon="more_vert" size={14} className="text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 grid-responsive">
            {sections.flatMap(s => s.items).map((item, i) => {
              const badge = getStatusBadge(item.status);
              return (
                <div
                  key={item.title}
                  draggable
                  className="p-3 rounded-xl border border-border hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer group animate-stagger-in"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center mb-2">
                    <MaterialIcon icon={getTypeIcon(item.type)} size={16} className="text-muted-foreground" />
                  </div>
                  <p className="text-[11px] font-medium text-foreground truncate mb-0.5">{item.title}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-[8px] text-muted-foreground">{item.date}</p>
                    <span className={`text-[7px] px-1 py-0.5 rounded font-medium ${badge.class}`}>{badge.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Shared Components ===== */
function ToolbarBtn({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all active:scale-95 whitespace-nowrap ${
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <MaterialIcon icon={icon} size={14} />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

function ActionButtons({ actions }: { actions: ReadonlyArray<{ id: string; label: string; icon: string }> }) {
  return (
    <div className="flex items-center gap-0.5">
      {actions.slice(0, 3).map(action => (
        <button
          key={action.id}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all active:scale-95"
          title={action.label}
        >
          <MaterialIcon icon={action.icon} size={13} />
          <span className="hidden lg:inline">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function PropertyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] text-muted-foreground">{label}</span>
      <div className="px-2 py-1 rounded-lg bg-card border border-border text-[10px] text-foreground">{value}</div>
    </div>
  );
}

function RasidMiniBar({ placeholder }: { placeholder: string }) {
  const { theme } = useTheme();
  const char = theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving;

  return (
    <div className="px-2 pb-1.5 pt-1 border-t border-border shrink-0">
      <div className="flex items-center gap-1.5 bg-accent/30 rounded-xl px-2 py-1.5">
        <img src={char} alt="راصد" className="w-5 h-5 rounded-full object-contain" />
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[10px] sm:text-[11px] outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
          <MaterialIcon icon="send" size={13} className="text-primary" />
        </button>
      </div>
    </div>
  );
}
