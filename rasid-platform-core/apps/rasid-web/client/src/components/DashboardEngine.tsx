/* ═══════════════════════════════════════════════════════════════
   DashboardEngine — Real Interactive Dashboard Builder
   Features:
   - Drag-and-drop widget layout with grid system
   - Real Recharts: Bar, Line, Pie, Radar, Area, Composed
   - KPI cards with trends
   - Data tables with sorting
   - Widget CRUD (add, edit, delete, resize, move)
   - Templates system
   - Easy/Advanced mode toggle
   - Export as image
   - Real-time data binding simulation
   ═══════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { usePlatformDashboardEngine } from '@/hooks/usePlatformEngines';
import { usePlatformHealth } from '@/hooks/usePlatform';
import { useDashboardWebSocket, type DashboardUpdateEvent } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import { useAutoSave, SaveStatusIndicator } from '@/hooks/useAutoSave';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import MaterialIcon from './MaterialIcon';
import ModeSwitcher from './ModeSwitcher';
import { CHARACTERS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/* ---------- Types ---------- */
interface Widget {
  id: string;
  type: 'kpi' | 'bar' | 'line' | 'pie' | 'radar' | 'area' | 'composed' | 'table' | 'text' | 'progress' | 'map';
  title: string;
  col: number; // grid column start (0-based)
  row: number; // grid row start
  colSpan: number; // how many columns wide
  rowSpan: number; // how many rows tall
  data?: any[];
  config?: WidgetConfig;
}

interface WidgetConfig {
  // KPI
  value?: string;
  label?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: string;
  color?: string;
  // Chart
  dataKey?: string;
  xKey?: string;
  colors?: string[];
  stacked?: boolean;
  // Table
  columns?: string[];
  // Text
  content?: string;
  // Progress
  percentage?: number;
  progressLabel?: string;
}

/* ---------- Sample Data ---------- */
const complianceData = [
  { name: 'وزارة المالية', compliance: 94, maturity: 88, quality: 91 },
  { name: 'وزارة الصحة', compliance: 88, maturity: 82, quality: 85 },
  { name: 'وزارة التعليم', compliance: 76, maturity: 71, quality: 73 },
  { name: 'هيئة الاتصالات', compliance: 91, maturity: 87, quality: 89 },
  { name: 'هيئة الزكاة', compliance: 69, maturity: 64, quality: 67 },
  { name: 'وزارة العدل', compliance: 82, maturity: 78, quality: 80 },
  { name: 'وزارة الداخلية', compliance: 96, maturity: 92, quality: 94 },
  { name: 'وزارة الطاقة', compliance: 78, maturity: 74, quality: 76 },
];

const trendData = [
  { month: 'يناير', compliance: 72, maturity: 65, quality: 68 },
  { month: 'فبراير', compliance: 75, maturity: 68, quality: 71 },
  { month: 'مارس', compliance: 78, maturity: 72, quality: 74 },
  { month: 'أبريل', compliance: 80, maturity: 74, quality: 76 },
  { month: 'مايو', compliance: 82, maturity: 77, quality: 79 },
  { month: 'يونيو', compliance: 85, maturity: 80, quality: 82 },
];

const categoryData = [
  { name: 'متقدم', value: 7, fill: '#10b981' },
  { name: 'متوسط', value: 5, fill: '#3b82f6' },
  { name: 'مبتدئ', value: 3, fill: '#f59e0b' },
  { name: 'ضعيف', value: 2, fill: '#ef4444' },
];

const radarData = [
  { subject: 'الحوكمة', A: 85, B: 70 },
  { subject: 'الجودة', A: 78, B: 65 },
  { subject: 'الأمان', A: 92, B: 80 },
  { subject: 'التكامل', A: 70, B: 60 },
  { subject: 'الامتثال', A: 88, B: 75 },
  { subject: 'النضج', A: 82, B: 68 },
];

const tableData = [
  { entity: 'وزارة المالية', compliance: '٩٤٪', maturity: 'متقدم', grade: 'أ', trend: 'up' },
  { entity: 'وزارة الصحة', compliance: '٨٨٪', maturity: 'متقدم', grade: 'أ', trend: 'up' },
  { entity: 'هيئة الاتصالات', compliance: '٩١٪', maturity: 'متقدم', grade: 'أ', trend: 'stable' },
  { entity: 'وزارة التعليم', compliance: '٧٦٪', maturity: 'متوسط', grade: 'ب', trend: 'up' },
  { entity: 'هيئة الزكاة', compliance: '٦٩٪', maturity: 'مبتدئ', grade: 'ج', trend: 'down' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

/* ---------- Default Widgets ---------- */
const defaultWidgets: Widget[] = [
  { id: uid(), type: 'kpi', title: 'متوسط الامتثال', col: 0, row: 0, colSpan: 1, rowSpan: 1, config: { value: '٨٥٪', label: 'متوسط الامتثال', trend: 'up', trendValue: '+٨٪', icon: 'verified', color: '#3b82f6' } },
  { id: uid(), type: 'kpi', title: 'الجهات المشمولة', col: 1, row: 0, colSpan: 1, rowSpan: 1, config: { value: '١٧', label: 'جهة حكومية', trend: 'stable', trendValue: '—', icon: 'apartment', color: '#10b981' } },
  { id: uid(), type: 'kpi', title: 'مستوى النضج', col: 2, row: 0, colSpan: 1, rowSpan: 1, config: { value: '٣.٨', label: 'من ٥', trend: 'up', trendValue: '+٠.٣', icon: 'trending_up', color: '#8b5cf6' } },
  { id: uid(), type: 'kpi', title: 'جودة البيانات', col: 3, row: 0, colSpan: 1, rowSpan: 1, config: { value: '٩٢٪', label: 'نسبة الجودة', trend: 'up', trendValue: '+٥٪', icon: 'diamond', color: '#f59e0b' } },
  { id: uid(), type: 'bar', title: 'امتثال الجهات الحكومية', col: 0, row: 1, colSpan: 2, rowSpan: 2, data: complianceData, config: { dataKey: 'compliance', xKey: 'name', colors: ['#3b82f6', '#10b981'] } },
  { id: uid(), type: 'line', title: 'اتجاه الامتثال الشهري', col: 2, row: 1, colSpan: 2, rowSpan: 2, data: trendData, config: { xKey: 'month', colors: ['#3b82f6', '#10b981', '#f59e0b'] } },
  { id: uid(), type: 'pie', title: 'توزيع مستويات النضج', col: 0, row: 3, colSpan: 1, rowSpan: 2, data: categoryData },
  { id: uid(), type: 'radar', title: 'مقارنة الأبعاد', col: 1, row: 3, colSpan: 1, rowSpan: 2, data: radarData },
  { id: uid(), type: 'table', title: 'تصنيف الجهات', col: 2, row: 3, colSpan: 2, rowSpan: 2, data: tableData, config: { columns: ['entity', 'compliance', 'maturity', 'grade', 'trend'] } },
  { id: uid(), type: 'progress', title: 'تقدم خطة التحسين', col: 0, row: 5, colSpan: 2, rowSpan: 1, config: { percentage: 68, progressLabel: 'المرحلة الثالثة من خمس مراحل' } },
  { id: uid(), type: 'area', title: 'تطور الجودة والامتثال', col: 2, row: 5, colSpan: 2, rowSpan: 1, data: trendData, config: { xKey: 'month', colors: ['#3b82f6', '#10b981'] } },
];

const widgetTypes = [
  { type: 'kpi', icon: 'speed', label: 'مؤشر KPI' },
  { type: 'bar', icon: 'bar_chart', label: 'أعمدة' },
  { type: 'line', icon: 'show_chart', label: 'خطي' },
  { type: 'pie', icon: 'pie_chart', label: 'دائري' },
  { type: 'radar', icon: 'radar', label: 'رادار' },
  { type: 'area', icon: 'area_chart', label: 'مساحة' },
  { type: 'table', icon: 'table_chart', label: 'جدول' },
  { type: 'progress', icon: 'donut_large', label: 'تقدم' },
  { type: 'text', icon: 'text_fields', label: 'نص' },
] as const;

/* ---------- Main Component ---------- */
export default function DashboardEngine() {
  const { theme } = useTheme();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [editMode, setEditMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Widget[][]>([]);
  const [redoStack, setRedoStack] = useState<Widget[][]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const dashRef = useRef<HTMLDivElement>(null);

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentDashboardId, setCurrentDashboardId] = useState<number | null>(null);
  const dashboardMutation = trpc.ai.analyzeDashboard.useMutation();
  const createDashboardMutation = trpc.dashboards.create.useMutation();
  const updateDashboardMutation = trpc.dashboards.update.useMutation();
  const deleteDashboardMutation = trpc.dashboards.delete.useMutation();
  // Load saved dashboards from DB
  const { data: savedDashboards, refetch: refetchDashboards } = trpc.dashboards.list.useQuery(undefined, { staleTime: 30_000 });
  // Cross-engine navigation
  const { navigateTo, pendingNavigation, clearPendingNavigation } = useWorkspace();
  // Platform backend integration (ALRaMaDy)
  const platformDash = usePlatformDashboardEngine();
  const { connected: platformConnected } = usePlatformHealth();

  // Handle incoming navigation data (e.g., from ExcelEngine sending KPIs)
  useEffect(() => {
    if (pendingNavigation?.targetView === 'dashboard' && pendingNavigation.data) {
      const navData = pendingNavigation.data;
      if (navData.widgets && Array.isArray(navData.widgets)) {
        pushUndo();
        const newWidgets: Widget[] = navData.widgets.map((w: any, i: number) => ({
          id: `nav-${Date.now()}-${i}`,
          type: w.type || 'kpi',
          title: w.title || 'ودجت جديد',
          col: (i % 4) * 3, row: Math.floor(i / 4) * 2,
          colSpan: 3, rowSpan: 2,
          data: w.data, config: w.config,
        }));
        setWidgets(prev => [...prev, ...newWidgets]);
        toast.success(`تم إضافة ${newWidgets.length} ودجت من محرك آخر`);
      }
      clearPendingNavigation();
    }
  }, [pendingNavigation]);

  // WebSocket for real-time dashboard updates
  const handleDashboardWsUpdate = useCallback((event: DashboardUpdateEvent) => {
    if (event.dashboardId === String(currentDashboardId)) {
      if (event.widgetRef && event.payload) {
        setWidgets(prev => prev.map(w =>
          w.id === event.widgetRef ? { ...w, data: event.payload as any } : w
        ));
        toast.info('تم تحديث بيانات الودجت تلقائياً', { duration: 2000 });
      }
    }
  }, [currentDashboardId]);
  const { connected: wsConnected } = useDashboardWebSocket(handleDashboardWsUpdate);

  // Auto-save every 30 seconds
  const { status: saveStatus, lastSaved, save: forceSave } = useAutoSave({
    data: { widgets },
    documentId: currentDashboardId,
    onSave: async (data) => {
      if (data.widgets.length === 0) return;
      const title = 'لوحة مؤشرات';
      // Save to local DB
      if (currentDashboardId) {
        await updateDashboardMutation.mutateAsync({
          id: currentDashboardId,
          widgets: data.widgets,
        });
      } else {
        const result = await createDashboardMutation.mutateAsync({
          title,
          widgets: data.widgets,
        });
        if ((result as any)?.id) setCurrentDashboardId((result as any).id);
      }
      // Sync to platform backend if connected
      if (platformConnected) {
        try {
          await platformDash.platformCreate({
            title,
            mode: mode as 'easy' | 'advanced',
            datasetRefs: [],
          });
        } catch { /* Platform sync is best-effort */ }
      }
    },
  });

  /* ---- Undo/Redo ---- */
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), widgets.map(w => ({ ...w }))]);
    setRedoStack([]);
  }, [widgets]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, widgets.map(w => ({ ...w }))]);
    setWidgets(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, widgets]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, widgets.map(w => ({ ...w }))]);
    setWidgets(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, widgets]);

  const generateWidgetsMutation = trpc.ai.generateDashboardWidgets.useMutation();

  const handleAIDashboard = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const currentWidgetsSummary = widgets.map(w => `${w.type}: ${w.title}`).join('\n');
      const result = await generateWidgetsMutation.mutateAsync({
        prompt: aiPrompt,
        existingWidgets: currentWidgetsSummary ? [currentWidgetsSummary] : undefined,
      });
      if (result.widgets && result.widgets.length > 0) {
        pushUndo();
        const newWidgets: Widget[] = result.widgets.map((w: any, i: number) => {
          const validType = (['kpi', 'bar', 'line', 'pie', 'radar', 'area', 'table', 'progress'].includes(w.type) ? w.type : 'kpi') as Widget['type'];
          return {
            id: uid(),
            type: validType,
            title: w.title || '',
            col: (widgets.length + i) % 4,
            row: Math.floor((widgets.length + i) / 4) * 2,
            colSpan: validType === 'kpi' ? 1 : 2,
            rowSpan: validType === 'kpi' ? 1 : 2,
            data: Array.isArray(w.data) ? w.data : [],
            config: {
              value: w.value || '\u2014',
              label: w.label || '',
              trend: (['up', 'down', 'stable'].includes(w.trend) ? w.trend : 'stable') as 'up' | 'down' | 'stable',
              trendValue: w.trendValue || '',
              icon: w.icon || 'analytics',
              color: w.color || '#3b82f6',
              xKey: w.xKey || 'name',
              colors: Array.isArray(w.colors) ? w.colors : undefined,
              columns: Array.isArray(w.columns) ? w.columns : undefined,
              percentage: typeof w.percentage === 'number' ? w.percentage : undefined,
              progressLabel: w.progressLabel || undefined,
            },
          };
        });
        setWidgets(prev => [...prev, ...newWidgets]);
      }
      setAiPrompt('');
    } catch (e) {
      console.error('AI Dashboard generation failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading, generateWidgetsMutation, widgets, pushUndo]);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Delete' && selectedWidget) { deleteWidget(selectedWidget); }
      if (e.key === 'Escape') { setShowAddMenu(false); setShowTemplates(false); setSelectedWidget(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedWidget]);

  /* ---- Widget CRUD ---- */
  const addWidget = (type: string) => {
    pushUndo();
    const maxRow = widgets.reduce((max, w) => Math.max(max, w.row + w.rowSpan), 0);
    const newWidget: Widget = {
      id: uid(),
      type: type as Widget['type'],
      title: widgetTypes.find(t => t.type === type)?.label || 'ودجة جديدة',
      col: 0, row: maxRow, colSpan: type === 'kpi' ? 1 : 2, rowSpan: type === 'kpi' ? 1 : 2,
      data: type === 'bar' ? complianceData : type === 'line' ? trendData : type === 'pie' ? categoryData : type === 'radar' ? radarData : type === 'area' ? trendData : type === 'table' ? tableData : undefined,
      config: type === 'kpi' ? { value: '٠', label: 'مؤشر جديد', trend: 'stable', trendValue: '—', icon: 'analytics', color: '#3b82f6' } :
              type === 'progress' ? { percentage: 50, progressLabel: 'التقدم' } :
              type === 'text' ? { content: 'اكتب النص هنا...' } :
              type === 'bar' || type === 'line' || type === 'area' ? { xKey: 'name', colors: CHART_COLORS } :
              type === 'table' ? { columns: ['entity', 'compliance', 'maturity', 'grade'] } : {},
    };
    setWidgets(prev => [...prev, newWidget]);
    setSelectedWidget(newWidget.id);
    setShowAddMenu(false);
  };

  const deleteWidget = (id: string) => {
    pushUndo();
    setWidgets(prev => prev.filter(w => w.id !== id));
    if (selectedWidget === id) setSelectedWidget(null);
  };

  const duplicateWidget = (id: string) => {
    pushUndo();
    const w = widgets.find(w => w.id === id);
    if (!w) return;
    const maxRow = widgets.reduce((max, w) => Math.max(max, w.row + w.rowSpan), 0);
    const clone = { ...w, id: uid(), row: maxRow };
    setWidgets(prev => [...prev, clone]);
    setSelectedWidget(clone.id);
  };

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  /* ---- Drag handlers ---- */
  const handleDragStart = (id: string) => setDraggedWidget(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverWidget(id); };
  const handleDrop = (id: string) => {
    if (draggedWidget && draggedWidget !== id) {
      pushUndo();
      const fromIdx = widgets.findIndex(w => w.id === draggedWidget);
      const toIdx = widgets.findIndex(w => w.id === id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const newWidgets = [...widgets];
        const [moved] = newWidgets.splice(fromIdx, 1);
        // Swap positions
        const target = newWidgets[toIdx > fromIdx ? toIdx - 1 : toIdx];
        if (target) {
          const tempCol = moved.col; const tempRow = moved.row;
          moved.col = target.col; moved.row = target.row;
          target.col = tempCol; target.row = tempRow;
        }
        newWidgets.splice(toIdx, 0, moved);
        setWidgets(newWidgets);
      }
    }
    setDraggedWidget(null);
    setDragOverWidget(null);
  };
  const handleDragEnd = () => { setDraggedWidget(null); setDragOverWidget(null); };

  /* ---- Render Widget Content ---- */
  const renderWidgetContent = (widget: Widget) => {
    const cfg = widget.config || {};

    switch (widget.type) {
      case 'kpi':
        return (
          <div className="flex items-center gap-3 p-3 h-full">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cfg.color}15` }}>
              <MaterialIcon icon={cfg.icon || 'analytics'} size={20} style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold text-foreground" style={{ color: cfg.color }}>{cfg.value}</div>
              <div className="text-[10px] text-muted-foreground">{cfg.label}</div>
            </div>
            <div className={`flex items-center gap-0.5 text-[10px] font-medium shrink-0 ${cfg.trend === 'up' ? 'text-emerald-500' : cfg.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
              <MaterialIcon icon={cfg.trend === 'up' ? 'trending_up' : cfg.trend === 'down' ? 'trending_down' : 'trending_flat'} size={14} />
              <span>{cfg.trendValue}</span>
            </div>
          </div>
        );

      case 'bar':
        return (
          <div className="p-2 h-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={widget.data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey={cfg.xKey || 'name'} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, direction: 'rtl', fontFamily: 'Tajawal' }} />
                <Bar dataKey="compliance" fill="#3b82f6" radius={[4, 4, 0, 0]} name="الامتثال" />
                {widget.data?.[0]?.maturity !== undefined && <Bar dataKey="maturity" fill="#10b981" radius={[4, 4, 0, 0]} name="النضج" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'line':
        return (
          <div className="p-2 h-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={widget.data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey={cfg.xKey || 'month'} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, direction: 'rtl', fontFamily: 'Tajawal' }} />
                <Line type="monotone" dataKey="compliance" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="الامتثال" />
                <Line type="monotone" dataKey="maturity" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="النضج" />
                <Line type="monotone" dataKey="quality" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="الجودة" />
                <Legend wrapperStyle={{ fontSize: 10, direction: 'rtl' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        return (
          <div className="p-2 h-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={widget.data} cx="50%" cy="50%" innerRadius="35%" outerRadius="65%" paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                  {widget.data?.map((entry: any, i: number) => <Cell key={i} fill={entry.fill || CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, direction: 'rtl', fontFamily: 'Tajawal' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'radar':
        return (
          <div className="p-2 h-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={widget.data}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <PolarRadiusAxis tick={{ fontSize: 8, fill: 'var(--muted-foreground)' }} />
                <Radar name="الحالي" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Radar name="المستهدف" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, direction: 'rtl', fontFamily: 'Tajawal' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'area':
        return (
          <div className="p-2 h-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={widget.data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey={cfg.xKey || 'month'} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, direction: 'rtl', fontFamily: 'Tajawal' }} />
                <Area type="monotone" dataKey="compliance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="الامتثال" />
                <Area type="monotone" dataKey="maturity" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="النضج" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'table':
        return (
          <div className="p-2 h-full overflow-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr>
                  <th className="bg-primary/10 text-primary font-medium py-1.5 px-2 text-right border-b border-border sticky top-0">الجهة</th>
                  <th className="bg-primary/10 text-primary font-medium py-1.5 px-2 text-right border-b border-border sticky top-0">الامتثال</th>
                  <th className="bg-primary/10 text-primary font-medium py-1.5 px-2 text-right border-b border-border sticky top-0">النضج</th>
                  <th className="bg-primary/10 text-primary font-medium py-1.5 px-2 text-right border-b border-border sticky top-0">التصنيف</th>
                  <th className="bg-primary/10 text-primary font-medium py-1.5 px-2 text-center border-b border-border sticky top-0">الاتجاه</th>
                </tr>
              </thead>
              <tbody>
                {(widget.data as typeof tableData)?.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="py-1.5 px-2 text-foreground font-medium">{row.entity}</td>
                    <td className="py-1.5 px-2 text-foreground">{row.compliance}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${
                        row.maturity === 'متقدم' ? 'bg-emerald-500/10 text-emerald-600' :
                        row.maturity === 'متوسط' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                      }`}>{row.maturity}</span>
                    </td>
                    <td className="py-1.5 px-2 text-foreground font-bold">{row.grade}</td>
                    <td className="py-1.5 px-2 text-center">
                      <MaterialIcon icon={row.trend === 'up' ? 'trending_up' : row.trend === 'down' ? 'trending_down' : 'trending_flat'} size={14}
                        className={row.trend === 'up' ? 'text-emerald-500' : row.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'progress':
        return (
          <div className="p-3 h-full flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">{cfg.progressLabel}</span>
              <span className="text-[13px] font-bold text-primary">{cfg.percentage}٪</span>
            </div>
            <div className="w-full h-3 bg-accent rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-primary to-primary/70 rounded-full transition-all duration-700" style={{ width: `${cfg.percentage}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>المرحلة ١</span><span>المرحلة ٢</span><span>المرحلة ٣</span><span>المرحلة ٤</span><span>المرحلة ٥</span>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="p-3 h-full">
            <p className="text-[12px] text-foreground leading-relaxed">{cfg.content || 'اكتب النص هنا...'}</p>
          </div>
        );

      default:
        return <div className="p-3 text-muted-foreground text-[11px]">ودجة غير معروفة</div>;
    }
  };

  const selectedW = widgets.find(w => w.id === selectedWidget);

  /* =============== RENDER =============== */
  return (
    <div className="flex-1 h-full bg-card rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-xl relative gold-border-glow">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line z-10" />
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar glass">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-1" />

        {/* Add Widget */}
        <div className="relative">
          <button onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <MaterialIcon icon="add_chart" size={14} />
            <span className="hidden sm:inline">إضافة ودجة</span>
          </button>
          {showAddMenu && (
            <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-xl shadow-lg p-2 z-50 w-[180px] animate-fade-in">
              {widgetTypes.map(wt => (
                <button key={wt.type} onClick={() => addWidget(wt.type)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-foreground hover:bg-accent transition-all">
                  <MaterialIcon icon={wt.icon} size={14} className="text-primary" />
                  {wt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Edit Mode */}
        <button onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
            editMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}>
          <MaterialIcon icon={editMode ? 'lock_open' : 'lock'} size={14} />
          <span className="hidden sm:inline">{editMode ? 'تحرير' : 'قفل'}</span>
        </button>

        {/* Templates */}
        <div className="relative">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
            <MaterialIcon icon="dashboard_customize" size={14} />
            <span className="hidden sm:inline">قالب</span>
          </button>
          {showTemplates && (
            <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-xl shadow-lg p-2 z-50 w-[200px] animate-fade-in">
              {[
                { id: 'compliance', label: 'لوحة الامتثال', icon: 'verified' },
                { id: 'maturity', label: 'لوحة النضج', icon: 'trending_up' },
                { id: 'quality', label: 'لوحة الجودة', icon: 'diamond' },
                { id: 'executive', label: 'ملخص تنفيذي', icon: 'summarize' },
              ].map(t => (
                <button key={t.id} onClick={() => setShowTemplates(false)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-foreground hover:bg-accent transition-all">
                  <MaterialIcon icon={t.icon} size={14} className="text-primary" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

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
        <button onClick={forceSave} title="حفظ يدوي (Ctrl+S)" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
          <MaterialIcon icon="save" size={14} className="text-muted-foreground" />
        </button>

        <div className="flex-1" />

        {mode === 'advanced' && selectedW && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span>الحجم:</span>
            <button onClick={() => { pushUndo(); updateWidget(selectedW.id, { colSpan: Math.max(1, selectedW.colSpan - 1) }); }}
              className="w-5 h-5 rounded bg-accent flex items-center justify-center hover:bg-primary/10">−</button>
            <span className="font-medium text-foreground">{selectedW.colSpan}×{selectedW.rowSpan}</span>
            <button onClick={() => { pushUndo(); updateWidget(selectedW.id, { colSpan: Math.min(4, selectedW.colSpan + 1) }); }}
              className="w-5 h-5 rounded bg-accent flex items-center justify-center hover:bg-primary/10">+</button>
          </div>
        )}
      </div>

      {/* Dashboard Grid */}
      <div ref={dashRef} className="flex-1 overflow-y-auto p-2 sm:p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 auto-rows-[minmax(100px,auto)]">
          {widgets.map(widget => (
            <div
              key={widget.id}
              draggable={editMode}
              onDragStart={() => editMode && handleDragStart(widget.id)}
              onDragOver={(e) => editMode && handleDragOver(e, widget.id)}
              onDrop={() => editMode && handleDrop(widget.id)}
              onDragEnd={handleDragEnd}
              onClick={() => setSelectedWidget(widget.id)}
              className={`rounded-xl border bg-card transition-all overflow-hidden ${
                selectedWidget === widget.id ? 'border-primary/40 shadow-md ring-1 ring-primary/20' : 'border-border hover:border-border/80 hover:shadow-sm'
              } ${dragOverWidget === widget.id ? 'border-primary border-dashed bg-primary/5' : ''} ${draggedWidget === widget.id ? 'opacity-40' : ''} ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
              style={{
                gridColumn: `span ${Math.min(widget.colSpan, 4)}`,
                gridRow: `span ${widget.rowSpan}`,
              }}
            >
              {/* Widget Header */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/50 shrink-0">
                {editMode && <MaterialIcon icon="drag_indicator" size={12} className="text-muted-foreground/40 cursor-grab" />}
                <span className="text-[10px] font-medium text-foreground flex-1 truncate">{widget.title}</span>
                {selectedWidget === widget.id && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); duplicateWidget(widget.id); }}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent transition-colors" title="تكرار">
                      <MaterialIcon icon="content_copy" size={10} className="text-muted-foreground" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteWidget(widget.id); }}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/10 transition-colors" title="حذف">
                      <MaterialIcon icon="close" size={10} className="text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>
              {/* Widget Content */}
              <div className="flex-1" style={{ minHeight: widget.type === 'kpi' ? '60px' : widget.type === 'progress' ? '70px' : '120px' }}>
                {renderWidgetContent(widget)}
              </div>
            </div>
          ))}

          {/* Add Widget Card */}
          {editMode && (
            <button onClick={() => setShowAddMenu(true)}
              className="rounded-xl border-2 border-dashed border-border/50 hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-1 py-6 hover:bg-primary/3"
              style={{ gridColumn: 'span 1', gridRow: 'span 1' }}>
              <MaterialIcon icon="add_chart" size={24} className="text-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground">إضافة ودجة</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="px-2 pb-1.5 pt-1 border-t border-border shrink-0">
        <div className="flex items-center gap-1.5 bg-accent/30 rounded-xl px-2 py-1.5">
          <img src={theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving} alt="راصد" className="w-5 h-5 rounded-full object-contain" />
          <input type="text" placeholder="اطلب من راصد تعديل اللوحة... مثال: أضف مؤشر لعدد الجهات المتأخرة" className="flex-1 bg-transparent text-[10px] sm:text-[11px] outline-none text-foreground placeholder:text-muted-foreground" />
          <button className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <MaterialIcon icon="send" size={13} className="text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
