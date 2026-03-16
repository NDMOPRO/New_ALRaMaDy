/* ═══════════════════════════════════════════════════════════════
   RASID — Home Page (Ultra Premium Redesign)
   Cohesive visual system with unified design language
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import NotebookHeader from '@/components/NotebookHeader';
import DataPanel from '@/components/DataPanel';
import ChatCanvas, { type ChatCanvasHandle } from '@/components/ChatCanvas';
import StudioPanel from '@/components/StudioPanel';
import MaterialIcon from '@/components/MaterialIcon';
import AddSourceDialog from '@/components/AddSourceDialog';
import ShareDialog from '@/components/ShareDialog';
import AnalyticsDialog from '@/components/AnalyticsDialog';
import SettingsMenu from '@/components/SettingsMenu';
import WorkspaceView from '@/components/WorkspaceView';
import { WORKSPACE_VIEWS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import InspectorPanel, { type InspectorTarget } from '@/components/InspectorPanel';
import EvidenceDrawer, { type EvidenceData } from '@/components/EvidenceDrawer';
import ExecutionTimeline, { type TimelineJob } from '@/components/ExecutionTimeline';
import CompareView from '@/components/CompareView';
import { trpc } from '@/lib/trpc';
import { usePlatformGovernanceEngine, usePlatformDataEngine } from '@/hooks/usePlatformEngines';
import { usePlatformHealth } from '@/hooks/usePlatform';
import OnboardingTour from '@/components/OnboardingTour';
import MobileBottomNav from '@/components/MobileBottomNav';
import CommandPalette, { useCommandPalette } from '@/components/CommandPalette';
import AnimatedWorkspace from '@/components/AnimatedWorkspace';

export interface DataItem {
  id: string;
  title: string;
  type: 'file' | 'table' | 'group' | 'flow';
  status: 'ready' | 'processing' | 'review' | 'failed' | 'merged';
  icon: string;
  size?: string;
}

export interface StudioOutput {
  id: string;
  title: string;
  type: string;
  time: string;
  icon: string;
}

/* ═══════════════════════════════════════════════════════════════
   Collapsed Side Rail — Unified Design System
   Both data and studio rails share the same visual DNA
   ═══════════════════════════════════════════════════════════════ */
function CollapsedRail({
  side,
  onExpand,
  label,
  icon,
  count,
  accentColor,
  miniIcons,
}: {
  side: 'data' | 'studio';
  onExpand: () => void;
  label: string;
  icon: string;
  count: number;
  accentColor: string;
  miniIcons: string[];
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Unified accent system — data uses blue tint, studio uses gold tint
  const accent = side === 'data'
    ? { line: 'rgba(100,160,255,0.6)', glow: isDark ? 'rgba(100,160,255,0.15)' : 'rgba(100,140,200,0.1)', text: isDark ? 'rgba(100,160,255,0.65)' : 'rgba(60,100,160,0.65)' }
    : { line: 'rgba(212,175,55,0.7)', glow: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.1)', text: isDark ? 'rgba(212,175,55,0.65)' : 'rgba(180,140,30,0.65)' };

  return (
    <div className="flex flex-col items-center h-full shrink-0 w-[48px] rail-enter">
      <div
        className="h-full w-full rounded-xl flex flex-col items-center py-3 gap-1.5 relative overflow-hidden group/rail transition-all duration-500"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(18,26,46,0.92) 0%, rgba(12,20,38,0.96) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(250,252,255,0.99) 100%)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          boxShadow: isDark
            ? '0 2px 12px rgba(0,0,0,0.2)'
            : '0 2px 12px rgba(0,0,0,0.03)',
        }}
      >
        {/* Top accent — thin line */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full transition-all duration-500 group-hover/rail:w-10"
          style={{ background: `linear-gradient(90deg, transparent, ${accent.line}, transparent)` }}
        />

        {/* Expand button */}
        <button
          onClick={onExpand}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 mt-1 group/btn"
          style={{ background: accent.glow }}
          title={side === 'data' ? 'فتح لوحة البيانات (Ctrl+D)' : 'فتح الاستوديو (Ctrl+Shift+S)'}
        >
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"
            style={{ boxShadow: `0 0 16px 2px ${accent.glow}` }}
          />
          <MaterialIcon icon={icon} size={18} style={{ color: accentColor }} className="transition-transform duration-300 group-hover/btn:scale-110" />
        </button>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          {/* Breathing dot */}
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
            style={{ background: accent.line, boxShadow: `0 0 6px ${accent.glow}` }}
          />

          {/* Vertical label */}
          <span
            className="text-[8px] font-bold writing-mode-vertical tracking-[0.18em] select-none uppercase"
            style={{ color: accent.text }}
          >
            {label}
          </span>

          {/* Mini icon stack */}
          <div className="flex flex-col gap-1.5 items-center">
            {miniIcons.map((mi, i) => (
              <div
                key={mi}
                className="w-6 h-6 rounded-lg flex items-center justify-center animate-stagger-in"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                  animationDelay: `${i * 0.12}s`,
                }}
              >
                <MaterialIcon icon={mi} size={11} className="text-muted-foreground/60" />
              </div>
            ))}
          </div>

          {/* Breathing dot */}
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
            style={{ background: accent.line, animationDelay: '1s' }}
          />
        </div>

        {/* Count badge */}
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center mb-1.5"
          style={{ background: accent.glow }}
        >
          <span className="text-[9px] font-bold" style={{ color: accentColor }}>{count}</span>
        </div>

        {/* Bottom accent */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${accent.line}, transparent)`, opacity: 0.6 }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Workspace Tab Bar — Premium Pill Navigation
   ═══════════════════════════════════════════════════════════════ */
function WorkspaceTabs({
  activeView,
  onViewChange,
  isMobile,
  mobileDrawer,
  onMobileDrawerToggle,
}: {
  activeView: string;
  onViewChange: (id: string) => void;
  isMobile: boolean;
  mobileDrawer: 'data' | 'studio' | null;
  onMobileDrawerToggle: (panel: 'data' | 'studio') => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Animate the active indicator
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector(`[data-tab-id="${activeView}"]`) as HTMLElement;
    if (activeBtn) {
      const containerRect = tabsRef.current.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setIndicatorStyle({
        left: btnRect.left - containerRect.left + tabsRef.current.scrollLeft,
        width: btnRect.width,
      });
    }
  }, [activeView]);

  return (
    <div
      ref={tabsRef}
      data-tour="welcome"
      className="flex items-center gap-0.5 rounded-xl px-1.5 py-1 shrink-0 overflow-x-auto no-scrollbar relative workspace-tabs-container"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(18,26,46,0.88) 0%, rgba(14,22,40,0.92) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(252,253,255,0.99) 100%)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        boxShadow: isDark
          ? '0 2px 12px rgba(0,0,0,0.2)'
          : '0 2px 12px rgba(0,0,0,0.03)',
      }}
    >
      {/* Sliding active indicator */}
      <div
        className="absolute top-1 h-[calc(100%-8px)] rounded-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none z-0"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          background: isDark
            ? 'linear-gradient(135deg, rgba(100,160,255,0.12) 0%, rgba(80,130,220,0.08) 100%)'
            : 'linear-gradient(135deg, var(--primary) 0%, oklch(0.32 0.1 250) 100%)',
          boxShadow: isDark
            ? '0 2px 8px rgba(100,160,255,0.12)'
            : '0 2px 8px rgba(0,0,0,0.08)',
          opacity: indicatorStyle.width > 0 ? 1 : 0,
        }}
      />

      {WORKSPACE_VIEWS.map(view => {
        const isActive = activeView === view.id;
        return (
          <button
            key={view.id}
            data-tab-id={view.id}
            data-tour={`tab-${view.id}`}
            onClick={() => onViewChange(view.id)}
            className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-all duration-300 ${
              isActive
                ? isDark
                  ? 'text-white'
                  : 'text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <MaterialIcon icon={view.icon} size={14} className={isActive ? 'drop-shadow-sm' : ''} />
            <span className="hidden xs:inline sm:inline">{view.label}</span>
          </button>
        );
      })}

      {/* Mobile panel toggles */}
      {isMobile && (
        <>
          <div className="w-px h-5 bg-border/30 mx-1 shrink-0" />
          <button
            onClick={() => onMobileDrawerToggle('data')}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              mobileDrawer === 'data' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <MaterialIcon icon="database" size={15} />
          </button>
          <button
            onClick={() => onMobileDrawerToggle('studio')}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              mobileDrawer === 'studio' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <MaterialIcon icon="auto_awesome" size={15} />
          </button>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shortcut Toast
   ═══════════════════════════════════════════════════════════════ */
function ShortcutToast({ shortcuts, visible }: { shortcuts: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
      <div
        className="rounded-xl px-4 py-2.5 flex items-center gap-2.5"
        style={{
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <MaterialIcon icon="keyboard" size={16} className="text-amber-400" />
        <span className="text-[12px] font-medium text-white/90">{shortcuts}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Ambient Background — Subtle living canvas
   ═══════════════════════════════════════════════════════════════ */
function AmbientBackground() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Primary gradient orb — top right */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[120px] animate-ambient-drift"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(100,160,255,0.04) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(100,140,200,0.03) 0%, transparent 70%)',
          top: '-10%',
          right: '-5%',
        }}
      />
      {/* Gold accent orb — bottom left */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full blur-[100px] animate-ambient-drift-reverse"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(212,175,55,0.03) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(212,175,55,0.02) 0%, transparent 70%)',
          bottom: '-5%',
          left: '10%',
        }}
      />
      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME — Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [dataOpen, setDataOpen] = useState(window.innerWidth >= 1024);
  const [studioOpen, setStudioOpen] = useState(window.innerWidth >= 1024);
  const { activeView, setActiveView } = useWorkspace();
  const [prevView, setPrevView] = useState<string>('chat');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const chatCanvasRef = useRef<ChatCanvasHandle>(null);

  // Mobile
  const [mobileDrawer, setMobileDrawer] = useState<'data' | 'studio' | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Persistent chat sidebar — ALWAYS visible (strict requirement)
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);

  // Command palette
  const commandPalette = useCommandPalette();

  // Shortcut toast
  const [shortcutToast, setShortcutToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showShortcutToast = useCallback((msg: string) => {
    setShortcutToast(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }, []);

  // Panel morphing
  const [dataMorphing, setDataMorphing] = useState(false);
  const [studioMorphing, setStudioMorphing] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
      if (w < 1024) { setDataOpen(false); setStudioOpen(false); }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Real data from DB via tRPC
  const { data: dbFiles } = trpc.files.list.useQuery();
  const { data: dbReports } = trpc.reports.list.useQuery();
  const { data: dbPresentations } = trpc.presentations.list.useQuery();
  const { data: dbDashboards } = trpc.dashboards.list.useQuery();

  // Platform backend integration (ALRaMaDy)
  const { connected: platformConnected } = usePlatformHealth();
  const platformGovernance = usePlatformGovernanceEngine();
  const platformData = usePlatformDataEngine();

  // Load platform data when connected
  useEffect(() => {
    if (platformConnected) {
      platformData.fetchPlatformDatasets();
      platformGovernance.fetchState();
    }
  }, [platformConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const dataItems: DataItem[] = useMemo(() => {
    const items: DataItem[] = [];
    if (dbFiles) {
      dbFiles.forEach((f: any) => {
        items.push({
          id: `f-${f.id}`,
          title: f.title || 'ملف بدون عنوان',
          type: (f.type as DataItem['type']) || 'file',
          status: (f.status as DataItem['status']) || 'ready',
          icon: f.icon || 'insert_drive_file',
          size: f.size || '—',
        });
      });
    }
    if (dbReports) {
      dbReports.forEach((r: any) => {
        items.push({
          id: `r-${r.id}`,
          title: r.title || 'تقرير بدون عنوان',
          type: 'file',
          status: (r.status as DataItem['status']) || 'ready',
          icon: 'description',
          size: '—',
        });
      });
    }
    return items;
  }, [dbFiles, dbReports]);

  const studioOutputs: StudioOutput[] = useMemo(() => {
    const outputs: StudioOutput[] = [];
    if (dbDashboards) {
      dbDashboards.forEach((d: any) => {
        outputs.push({
          id: `d-${d.id}`,
          title: d.title || 'لوحة مؤشرات',
          type: 'dashboard',
          time: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('ar-SA') : '—',
          icon: 'dashboard',
        });
      });
    }
    if (dbReports) {
      dbReports.forEach((r: any) => {
        outputs.push({
          id: `r-${r.id}`,
          title: r.title || 'تقرير',
          type: 'report',
          time: r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('ar-SA') : '—',
          icon: 'description',
        });
      });
    }
    if (dbPresentations) {
      dbPresentations.forEach((p: any) => {
        outputs.push({
          id: `p-${p.id}`,
          title: p.title || 'عرض تقديمي',
          type: 'presentation',
          time: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ar-SA') : '—',
          icon: 'slideshow',
        });
      });
    }
    return outputs;
  }, [dbDashboards, dbReports, dbPresentations]);

  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);

  /* Canvas surfaces */
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceData, setEvidenceData] = useState<EvidenceData | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [timelineJobs, setTimelineJobs] = useState<TimelineJob[]>([]);

  const openInspector = useCallback((target: InspectorTarget) => {
    setInspectorTarget(target);
    setInspectorOpen(true);
  }, []);

  const openEvidence = useCallback(async (jobId: string) => {
    // Try to load real evidence from platform if connected
    if (platformConnected) {
      try {
        const [evidenceResult, auditResult] = await Promise.all([
          platformGovernance.fetchEvidence(),
          platformGovernance.fetchAudit(),
        ]);
        const evidence = evidenceResult?.data;
        const audit = auditResult?.data;
        setEvidenceData({
          jobId,
          capability: 'تحليل البيانات',
          status: 'verified',
          entries: Array.isArray(evidence) ? evidence.map((e: any, i: number) => ({
            id: `e-${i}`, type: e.type || 'metric', label: e.label || e.name || '',
            value: String(e.value || ''), timestamp: e.timestamp || '', icon: e.icon || 'info',
          })) : [],
          auditTrail: Array.isArray(audit) ? audit.map((a: any) => ({
            action: a.action || '', actor: a.actor || '', time: a.time || '', detail: a.detail,
          })) : [],
        });
      } catch {
        setEvidenceData({
          jobId, capability: 'تحليل البيانات', status: 'verified',
          entries: [], auditTrail: [],
        });
      }
    } else {
      setEvidenceData({
        jobId, capability: 'تحليل البيانات', status: 'verified',
        entries: [], auditTrail: [],
      });
    }
    setEvidenceOpen(true);
  }, [platformConnected, platformGovernance]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== Toggle handlers ===== */
  const toggleData = useCallback(() => {
    setDataMorphing(true);
    setDataOpen(prev => !prev);
    setTimeout(() => setDataMorphing(false), 400);
  }, []);

  const toggleStudio = useCallback(() => {
    setStudioMorphing(true);
    setStudioOpen(prev => !prev);
    setTimeout(() => setStudioMorphing(false), 400);
  }, []);

  const toggleBoth = useCallback(() => {
    const bothOpen = dataOpen && studioOpen;
    setDataMorphing(true);
    setStudioMorphing(true);
    setDataOpen(!bothOpen);
    setStudioOpen(!bothOpen);
    setTimeout(() => { setDataMorphing(false); setStudioMorphing(false); }, 400);
    showShortcutToast(bothOpen ? 'تم طي القائمتين — وضع التركيز' : 'تم فتح القائمتين');
  }, [dataOpen, studioOpen, showShortcutToast]);

  /* ===== Keyboard Shortcuts ===== */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey && !e.shiftKey && e.key === 'd') {
        e.preventDefault();
        toggleData();
        showShortcutToast(dataOpen ? 'طي لوحة البيانات (Ctrl+D)' : 'فتح لوحة البيانات (Ctrl+D)');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        toggleStudio();
        showShortcutToast(studioOpen ? 'طي الاستوديو (Ctrl+Shift+S)' : 'فتح الاستوديو (Ctrl+Shift+S)');
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        toggleBoth();
      }
      if (e.key === 'Escape' && mobileDrawer) {
        setMobileDrawer(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleData, toggleStudio, toggleBoth, dataOpen, studioOpen, mobileDrawer, showShortcutToast]);

  const handleToolClick = useCallback((tool: { icon: string; label: string; id: string }) => {
    if (activeView !== 'chat') {
      setPrevView(activeView);
      setActiveView('chat');
    }
    setTimeout(() => {
      chatCanvasRef.current?.sendMessage(tool.label);
    }, 100);
  }, [activeView]);

  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    setSettingsAnchor(e.currentTarget as HTMLElement);
    setSettingsOpen(prev => !prev);
  }, []);

  const handleWorkspaceChange = useCallback((viewId: string) => {
    setPrevView(activeView);
    setActiveView(viewId);
  }, [activeView]);

  const handleMenuToggle = useCallback(() => {
    if (isMobile) {
      setMobileDrawer(prev => prev === 'data' ? null : 'data');
    }
  }, [isMobile]);

  // Workspace switch animation
  useEffect(() => {
    if (workspaceRef.current && prevView !== activeView) {
      workspaceRef.current.classList.remove('animate-workspace-switch');
      void workspaceRef.current.offsetWidth;
      workspaceRef.current.classList.add('animate-workspace-switch');
    }
  }, [activeView, prevView]);

  const bothOpen = dataOpen && studioOpen;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-canvas-bg relative">
      {/* Ambient living background */}
      <AmbientBackground />

      {/* Header */}
      <div className="relative z-10">
        <NotebookHeader
          onShareClick={() => setShareOpen(true)}
          onAnalyticsClick={() => setAnalyticsOpen(true)}
          onSettingsClick={handleSettingsClick}
          onSearchClick={commandPalette.open}
          onMenuToggle={handleMenuToggle}
          onToggleBoth={toggleBoth}
          bothPanelsOpen={bothOpen}
        />
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden p-1.5 sm:p-2 md:p-3 gap-1.5 sm:gap-2 md:gap-3 relative z-10">

        {/* RIGHT Panel: البيانات */}
        {!isMobile && (
          <div
            data-tour="data-panel"
            className={`hidden md:block shrink-0 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden data-panel-container ${dataMorphing ? 'pointer-events-none' : ''}`}
            style={{
              width: dataOpen ? (isTablet ? 220 : 260) : 48,
              minWidth: dataOpen ? (isTablet ? 220 : 260) : 48,
            }}
          >
            {dataOpen ? (
              <div className="h-full animate-morph-in" key="data-open">
                <DataPanel
                  isOpen={dataOpen}
                  onToggle={toggleData}
                  onAddSourceClick={() => setAddSourceOpen(true)}
                  items={dataItems}
                />
              </div>
            ) : (
              <CollapsedRail
                side="data"
                onExpand={toggleData}
                label="البيانات"
                icon="database"
                count={dataItems.length || 0}
                accentColor="var(--primary)"
                miniIcons={['table_chart', 'description', 'folder']}
              />
            )}
          </div>
        )}

        {/* CENTER: Canvas Area */}
        <div className="flex-1 flex flex-col min-w-0 gap-1.5 sm:gap-2 md:gap-3 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
          {/* Workspace Navigation */}
          <WorkspaceTabs
            activeView={activeView}
            onViewChange={handleWorkspaceChange}
            isMobile={isMobile}
            mobileDrawer={mobileDrawer}
            onMobileDrawerToggle={(panel) => setMobileDrawer(prev => prev === panel ? null : panel)}
          />

          {/* Active Workspace Content */}
          <div ref={workspaceRef} className="flex-1 min-h-0 flex gap-2">
            {/* Main content area */}
            {activeView === 'chat' ? (
              /* Chat tab: ChatCanvas takes full width */
              <div
                data-tour="chat-canvas"
                data-tour-complete="complete"
                className="flex-1 min-w-0 h-full"
              >
                <ChatCanvas ref={chatCanvasRef} />
              </div>
            ) : (
              /* Non-chat tabs: WorkspaceView + always-visible ChatCanvas sidebar */
              <>
                <AnimatedWorkspace activeView={activeView}>
                  <div className="flex-1 min-w-0 h-full">
                    <WorkspaceView viewId={activeView} />
                  </div>
                </AnimatedWorkspace>

                {/* Always-visible Chat Sidebar (STRICT: never hidden) */}
                {!isMobile && (
                  <div className={`shrink-0 h-full transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                    chatSidebarOpen ? 'w-[360px] min-w-[360px]' : 'w-[48px] min-w-[48px]'
                  }`}>
                    {chatSidebarOpen ? (
                      <div className="h-full relative animate-chat-sidebar-enter">
                        <button
                          onClick={() => setChatSidebarOpen(false)}
                          className="absolute top-2.5 left-2.5 z-10 w-8 h-8 flex items-center justify-center rounded-xl border border-border/30 hover:border-primary/30 hover:bg-accent transition-all duration-300 active:scale-90 shadow-lg group"
                          style={{
                            background: isDark ? 'rgba(20,28,50,0.9)' : 'rgba(255,255,255,0.95)',
                            backdropFilter: 'blur(12px)',
                          }}
                          title="طي المحادثة"
                        >
                          <MaterialIcon icon="chevron_left" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                        <ChatCanvas ref={chatCanvasRef} />
                      </div>
                    ) : (
                      <CollapsedRail
                        side="data"
                        onExpand={() => setChatSidebarOpen(true)}
                        label="المحادثة"
                        icon="chat"
                        count={0}
                        accentColor="var(--primary)"
                        miniIcons={['smart_toy', 'chat_bubble']}
                      />
                    )}
                  </div>
                )}

                {/* Mobile: Floating chat button that opens chat overlay */}
                {isMobile && (
                  <MobileChatButton onClick={() => handleWorkspaceChange('chat')} />
                )}
              </>
            )}
          </div>
        </div>

        {/* LEFT Panel: الاستوديو */}
        {!isMobile && (
          <div
            data-tour="studio-panel"
            className={`hidden md:block shrink-0 transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden studio-panel-container ${studioMorphing ? 'pointer-events-none' : ''}`}
            style={{
              width: studioOpen ? (isTablet ? 180 : 220) : 48,
              minWidth: studioOpen ? (isTablet ? 180 : 220) : 48,
            }}
          >
            {studioOpen ? (
              <div className="h-full animate-morph-in" key="studio-open">
                <StudioPanel
                  isOpen={studioOpen}
                  onToggle={toggleStudio}
                  onToolClick={handleToolClick}
                  outputs={studioOutputs}
                />
              </div>
            ) : (
              <CollapsedRail
                side="studio"
                onExpand={toggleStudio}
                label="الاستوديو"
                icon="auto_awesome"
                count={studioOutputs.length || 0}
                accentColor="var(--gold)"
                miniIcons={['dashboard', 'description', 'slideshow']}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile Drawer */}
      {isMobile && mobileDrawer && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setMobileDrawer(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
          <div
            className={`relative z-10 h-full w-[280px] sm:w-[300px] max-w-[85vw] bg-card shadow-2xl mobile-drawer-panel ${
              mobileDrawer === 'data' ? 'mr-auto animate-slide-in-right' : 'ml-auto animate-slide-in-left'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {mobileDrawer === 'data' ? (
              <DataPanel
                isOpen={true}
                onToggle={() => setMobileDrawer(null)}
                onAddSourceClick={() => { setAddSourceOpen(true); setMobileDrawer(null); }}
                items={dataItems}
              />
            ) : (
              <StudioPanel
                isOpen={true}
                onToggle={() => setMobileDrawer(null)}
                onToolClick={(tool) => { handleToolClick(tool); setMobileDrawer(null); }}
                outputs={studioOutputs}
              />
            )}
          </div>
        </div>
      )}

      {/* Overlays */}
      <ShortcutToast shortcuts={shortcutToast} visible={toastVisible} />
      <InspectorPanel isOpen={inspectorOpen} onClose={() => setInspectorOpen(false)} target={inspectorTarget} />
      <EvidenceDrawer isOpen={evidenceOpen} onClose={() => setEvidenceOpen(false)} evidence={evidenceData} />
      <CompareView isOpen={compareOpen} onClose={() => setCompareOpen(false)} leftTitle="المصدر" rightTitle="المخرج" />
      <ExecutionTimeline jobs={timelineJobs} onJobClick={(id) => console.log('job', id)} onEvidenceClick={openEvidence} />

      {/* Dialogs */}
      <AddSourceDialog isOpen={addSourceOpen} onClose={() => setAddSourceOpen(false)} />
      <ShareDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} />
      <AnalyticsDialog isOpen={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
      <SettingsMenu isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} anchorEl={settingsAnchor} />
      <OnboardingTour />
      <MobileBottomNav activeView={activeView} onViewChange={handleWorkspaceChange} />
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} onNavigate={handleWorkspaceChange} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Mobile Floating Chat Button — Always accessible on mobile
   ═══════════════════════════════════════════════════════════════ */
function MobileChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 left-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all duration-200 group"
      style={{
        background: 'linear-gradient(135deg, #0c1f3d, #1a3a6b)',
        boxShadow: '0 4px 20px rgba(12,31,61,0.4), 0 0 0 3px rgba(100,160,255,0.15)',
      }}
      title="فتح المحادثة"
    >
      {/* Pulse ring */}
      <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'rgba(100,160,255,0.3)' }} />
      <MaterialIcon icon="smart_toy" size={24} className="text-white group-hover:scale-110 transition-transform" />
      {/* Online indicator */}
      <div className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-sm" />
    </button>
  );
}
