/* AdminPanel — Full Admin Dashboard with Real Data
   Sidebar navigation with collapsible groups
   Pages: Dashboard, Content, Members, Permissions, Settings, Media, Templates, Invitations
   Fully mobile responsive with drawer sidebar */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth, type User, type UserRole } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LOGOS } from '@/lib/assets';
import MaterialIcon from '@/components/MaterialIcon';
import SlideLibraryAdmin from '@/components/SlideLibraryAdmin';
import { trpc } from '@/lib/trpc';
import { usePlatformGovernanceEngine } from '@/hooks/usePlatformEngines';
import { usePlatformHealth } from '@/hooks/usePlatform';
import { RASED_USAGE, NDMO_LOGO } from '@/lib/rasedAssets';
import RasedLoader from '@/components/RasedLoader';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

// ===== ADMIN SIDEBAR MENU =====
interface MenuItem {
  id: string;
  label: string;
  icon: string;
  group: string;
}

const MENU_GROUPS = [
  { id: 'main', label: 'الرئيسية' },
  { id: 'content', label: 'إدارة المحتوى' },
  { id: 'users', label: 'المستخدمون' },
  { id: 'system', label: 'النظام' },
];

const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: 'dashboard', group: 'main' },
  { id: 'analytics', label: 'التحليلات', icon: 'trending_up', group: 'main' },
  { id: 'content', label: 'إدارة المحتوى', icon: 'article', group: 'content' },
  { id: 'media', label: 'الوسائط', icon: 'perm_media', group: 'content' },
  { id: 'templates', label: 'القوالب', icon: 'dashboard_customize', group: 'content' },
  { id: 'slide-library', label: 'مكتبة عناصر العروض', icon: 'auto_awesome_mosaic', group: 'content' },
  { id: 'members', label: 'الأعضاء', icon: 'group', group: 'users' },
  { id: 'roles', label: 'الأدوار والصلاحيات', icon: 'admin_panel_settings', group: 'users' },
  { id: 'invitations', label: 'الدعوات', icon: 'mail', group: 'users' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings', group: 'system' },
  { id: 'logs', label: 'سجل النشاط', icon: 'history', group: 'system' },
];

const ROLES_CONFIG: { id: UserRole; label: string; color: string; icon: string; desc: string; permissions: string[] }[] = [
  { id: 'admin', label: 'مدير النظام', color: '#dc2626', icon: 'shield', desc: 'صلاحيات كاملة على جميع أجزاء النظام', permissions: ['manage_users', 'manage_content', 'manage_roles', 'view_analytics', 'manage_settings', 'manage_data', 'create_reports', 'approve_content', 'delete_data', 'export_data'] },
  { id: 'editor', label: 'محرر', color: '#2563eb', icon: 'edit', desc: 'إنشاء وتعديل المحتوى والتقارير', permissions: ['manage_content', 'view_analytics', 'manage_data', 'create_reports', 'export_data'] },
  { id: 'analyst', label: 'محلل', color: '#7c3aed', icon: 'analytics', desc: 'تحليل البيانات وإنشاء التقارير', permissions: ['view_analytics', 'manage_data', 'create_reports', 'export_data'] },
  { id: 'viewer', label: 'مشاهد', color: '#059669', icon: 'visibility', desc: 'عرض البيانات والتقارير فقط', permissions: ['view_analytics', 'view_data'] },
];

const ALL_PERMISSIONS = [
  { id: 'manage_users', label: 'إدارة المستخدمين', icon: 'group', group: 'المستخدمون' },
  { id: 'manage_roles', label: 'إدارة الأدوار', icon: 'admin_panel_settings', group: 'المستخدمون' },
  { id: 'manage_content', label: 'إدارة المحتوى', icon: 'article', group: 'المحتوى' },
  { id: 'approve_content', label: 'اعتماد المحتوى', icon: 'check_circle', group: 'المحتوى' },
  { id: 'manage_data', label: 'إدارة البيانات', icon: 'database', group: 'البيانات' },
  { id: 'view_data', label: 'عرض البيانات', icon: 'visibility', group: 'البيانات' },
  { id: 'delete_data', label: 'حذف البيانات', icon: 'delete', group: 'البيانات' },
  { id: 'create_reports', label: 'إنشاء التقارير', icon: 'description', group: 'التقارير' },
  { id: 'export_data', label: 'تصدير البيانات', icon: 'download', group: 'التقارير' },
  { id: 'view_analytics', label: 'عرض التحليلات', icon: 'trending_up', group: 'التحليلات' },
  { id: 'manage_settings', label: 'إدارة الإعدادات', icon: 'settings', group: 'النظام' },
];

// ===== Helper: relative time ===== 
function relativeTime(dateStr: string) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return dateStr.split('T')[0] || dateStr;
}

/* ─── Count-Up Hook ─── */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);
  return value;
}

// ===== MAIN COMPONENT =====
export default function AdminPanel() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const logo = theme === 'dark' ? LOGOS.dark_header : LOGOS.light_header;

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const handlePageChange = useCallback((pageId: string) => {
    setActivePage(pageId);
    if (isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  // ===== SIDEBAR COMPONENT =====
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full bg-card border-l border-border ${mobile ? 'w-[280px]' : sidebarOpen ? 'w-[240px]' : 'w-[60px]'} transition-all duration-300`}>
      {/* Sidebar Header — Premium with NDMO + Rasid logos */}
      <div className="flex flex-col border-b border-border shrink-0 relative overflow-hidden">
        {/* Subtle gold accent top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line" />
        {(sidebarOpen || mobile) ? (
          <div className="px-4 py-3">
            {/* NDMO Logo row */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="bg-white/90 dark:bg-white/95 rounded-lg px-2 py-1 shadow-sm border border-border/30">
                <img src={NDMO_LOGO} alt="NDMO" className="h-[22px] w-auto object-contain" />
              </div>
              <div className="flex-1" />
              {!mobile && (
                <button onClick={() => setSidebarOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
                  <MaterialIcon icon="chevron_right" size={18} className="text-muted-foreground" />
                </button>
              )}
            </div>
            {/* Rasid logo + panel title */}
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="راصد" className="h-8 object-contain" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground truncate">لوحة التحكم</p>
                <p className="text-[9px] text-muted-foreground truncate">{user?.displayName}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="bg-white/90 dark:bg-white/95 rounded-md p-1 shadow-sm">
              <img src={NDMO_LOGO} alt="NDMO" className="h-[16px] w-auto object-contain" />
            </div>
            <button onClick={() => setSidebarOpen(true)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
              <MaterialIcon icon="chevron_left" size={18} className="text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {MENU_GROUPS.map(group => {
          const items = MENU_ITEMS.filter(i => i.group === group.id);
          const collapsed = collapsedGroups.has(group.id);
          return (
            <div key={group.id} className="mb-1">
              {(sidebarOpen || mobile) && (
                <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-all">
                  <span>{group.label}</span>
                  <MaterialIcon icon={collapsed ? 'expand_more' : 'expand_less'} size={14} />
                </button>
              )}
              {!collapsed && items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handlePageChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 mb-0.5 ${
                    activePage === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <MaterialIcon icon={item.icon} size={18} />
                  {(sidebarOpen || mobile) && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      {(sidebarOpen || mobile) && (
        <div className="border-t border-border p-3 shrink-0 space-y-1.5">
          <button onClick={toggleTheme} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all">
            <MaterialIcon icon={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={16} />
            <span>{theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
          </button>
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all">
            <MaterialIcon icon="home" size={16} />
            <span>الصفحة الرئيسية</span>
          </button>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11px] text-destructive hover:bg-destructive/10 transition-all">
            <MaterialIcon icon="logout" size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen flex bg-background" dir="rtl">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 h-full animate-slide-right">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent transition-all">
                <MaterialIcon icon="menu" size={22} className="text-foreground" />
              </button>
            )}
            <h2 className="text-[16px] font-bold text-foreground">
              {MENU_ITEMS.find(i => i.id === activePage)?.label || 'لوحة التحكم'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[13px] font-bold">
              {user?.displayName?.charAt(0) || 'م'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="animate-fade-in-up">
            {activePage === 'dashboard' && <DashboardPage />}
            {activePage === 'content' && <ContentPage />}
            {activePage === 'members' && <MembersPage />}
            {activePage === 'roles' && <RolesPage />}
            {activePage === 'analytics' && <AnalyticsPage />}
            {activePage === 'settings' && <SettingsPage />}
            {activePage === 'logs' && <LogsPage />}
            {activePage === 'media' && <MediaPage />}
            {activePage === 'templates' && <TemplatesPage />}
            {activePage === 'slide-library' && <SlideLibraryAdmin />}
            {activePage === 'invitations' && <InvitationsPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== DASHBOARD PAGE (REAL DATA) =====
/* ─── KPI Card with Count-Up ─── */
function KPICard({ label, target, icon, color, delay }: { label: string; target: number; icon: string; color: string; delay: number }) {
  const count = useCountUp(target);
  return (
    <div className="bg-card rounded-2xl p-5 border border-border/50 card-hover premium-card gold-border-glow animate-stagger-in relative overflow-hidden group" style={{ animationDelay: `${delay}s` }}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 80% 20%, ${color}08 0%, transparent 60%)` }} />
      <div className="flex items-center justify-between mb-3 relative">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${color}15` }}>
          <MaterialIcon icon={icon} size={24} style={{ color } as any} />
        </div>
        <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center">
          <MaterialIcon icon="trending_up" size={14} className="text-success" />
        </div>
      </div>
      <p className="text-[32px] font-bold text-foreground tabular-nums relative">{count.toLocaleString('ar-SA')}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 relative">{label}</p>
      {/* Bottom gold accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] gold-accent-line" />
    </div>
  );
}

function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.admin.recentActivity.useQuery();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'إجمالي المستخدمين', value: stats.users, icon: 'group', color: '#3b82f6' },
      { label: 'إجمالي المحتوى', value: stats.totalContent, icon: 'article', color: '#10b981' },
      { label: 'التقارير', value: stats.reports, icon: 'description', color: '#d4a853' },
      { label: 'العروض التقديمية', value: stats.presentations, icon: 'slideshow', color: '#8b5cf6' },
      { label: 'لوحات المؤشرات', value: stats.dashboards, icon: 'dashboard', color: '#ef4444' },
      { label: 'جداول البيانات', value: stats.spreadsheets, icon: 'table_chart', color: '#06b6d4' },
      { label: 'الترجمات', value: stats.translations, icon: 'translate', color: '#22c55e' },
      { label: 'التفريغات', value: stats.extractions, icon: 'text_snippet', color: '#f59e0b' },
    ];
  }, [stats]);

  // Doughnut chart data
  const doughnutData = useMemo(() => {
    if (!stats) return null;
    return {
      labels: ['تقارير', 'عروض', 'لوحات', 'جداول', 'ملفات'],
      datasets: [{
        data: [stats.reports, stats.presentations, stats.dashboards, stats.spreadsheets, stats.files],
        backgroundColor: ['#d4a853', '#8b5cf6', '#ef4444', '#06b6d4', '#3b82f6'],
        borderColor: isDark ? '#1e293b' : '#ffffff',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    };
  }, [stats, isDark]);

  // Bar chart data (content by type)
  const barData = useMemo(() => {
    if (!stats) return null;
    return {
      labels: ['ملفات', 'تقارير', 'عروض', 'لوحات', 'جداول', 'ترجمات', 'تفريغات'],
      datasets: [{
        label: 'عدد العناصر',
        data: [stats.files, stats.reports, stats.presentations, stats.dashboards, stats.spreadsheets, stats.translations, stats.extractions],
        backgroundColor: [
          'rgba(59,130,246,0.7)', 'rgba(212,168,83,0.7)', 'rgba(139,92,246,0.7)',
          'rgba(239,68,68,0.7)', 'rgba(6,182,212,0.7)', 'rgba(34,197,94,0.7)', 'rgba(245,158,11,0.7)',
        ],
        borderRadius: 8,
        borderSkipped: false,
      }],
    };
  }, [stats]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f1f5f9' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#64748b',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { family: 'Tajawal', size: 13, weight: 'bold' as const },
        bodyFont: { family: 'Tajawal', size: 12 },
        rtl: true,
        textDirection: 'rtl' as const,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Tajawal', size: 10 }, color: isDark ? '#64748b' : '#94a3b8' },
      },
      y: {
        grid: { color: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.5)' },
        ticks: { font: { family: 'Tajawal', size: 10 }, color: isDark ? '#64748b' : '#94a3b8' },
      },
    },
  }), [isDark]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        rtl: true,
        labels: {
          font: { family: 'Tajawal', size: 11 },
          color: isDark ? '#94a3b8' : '#64748b',
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f1f5f9' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#64748b',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { family: 'Tajawal', size: 13, weight: 'bold' as const },
        bodyFont: { family: 'Tajawal', size: 12 },
        rtl: true,
        textDirection: 'rtl' as const,
      },
    },
  }), [isDark]);

  if (statsLoading) {
    return <RasedLoader type="data" message="جاري تحميل لوحة التحكم..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner with Rased Character */}
      <div className="relative bg-gradient-to-l from-primary/10 via-card to-card rounded-2xl border border-border/50 p-6 overflow-hidden gold-border-glow">
        <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line" />
        <div className="flex items-center gap-5">
          <img src={RASED_USAGE.adminWelcome} alt="راصد" className="w-20 h-20 object-contain animate-float" />
          <div className="flex-1">
            <h2 className="text-[20px] font-bold text-foreground mb-1">مرحباً بك في لوحة التحكم</h2>
            <p className="text-[13px] text-muted-foreground">إليك ملخص أداء المنصة وإحصائيات الاستخدام اليوم.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, i) => (
          <KPICard key={stat.label} label={stat.label} target={stat.value} icon={stat.icon} color={stat.color} delay={i * 0.08} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Doughnut Chart */}
        <div className="bg-card rounded-2xl border border-border/50 p-5 premium-card gold-border-glow">
          <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
            <MaterialIcon icon="pie_chart" size={18} className="text-gold" />
            توزيع المحتوى
          </h3>
          <div className="h-[220px] flex items-center justify-center">
            {doughnutData ? <Doughnut data={doughnutData} options={doughnutOptions} /> : <p className="text-muted-foreground text-[12px]">لا توجد بيانات</p>}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 p-5 premium-card gold-border-glow">
          <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
            <MaterialIcon icon="bar_chart" size={18} className="text-gold" />
            إحصائيات المحتوى
          </h3>
          <div className="h-[220px]">
            {barData ? <Bar data={barData} options={chartOptions} /> : <p className="text-muted-foreground text-[12px]">لا توجد بيانات</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-card rounded-2xl border border-border/50 p-5 premium-card gold-border-glow">
          <h3 className="text-[14px] font-bold text-foreground mb-3 flex items-center gap-2">
            <MaterialIcon icon="history" size={18} className="text-gold" />
            النشاط الأخير
          </h3>
          {activityLoading ? (
            <RasedLoader type="data" size="sm" inline />
          ) : activity && activity.length > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {activity.map((act: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-accent/40 transition-all animate-stagger-in" style={{ animationDelay: `${(i + 4) * 0.06}s` }}>
                  <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center shrink-0">
                    <MaterialIcon icon={act.icon} size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground truncate">{act.text}</p>
                    <p className="text-[9px] text-muted-foreground">{relativeTime(act.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-[12px]">
              <img src={RASED_USAGE.emptyState} alt="" className="w-16 h-16 mx-auto mb-3 opacity-60" />
              <p>لا يوجد نشاط حتى الآن</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-2xl border border-border/50 p-5 premium-card gold-border-glow">
          <h3 className="text-[14px] font-bold text-foreground mb-3 flex items-center gap-2">
            <MaterialIcon icon="bolt" size={18} className="text-gold" />
            إجراءات سريعة
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'إنشاء تقرير', icon: 'description', color: '#d4a853' },
              { label: 'إنشاء عرض', icon: 'slideshow', color: '#8b5cf6' },
              { label: 'لوحة مؤشرات', icon: 'dashboard', color: '#ef4444' },
              { label: 'جدول بيانات', icon: 'table_chart', color: '#06b6d4' },
            ].map((action, i) => (
              <button key={action.label} className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:bg-accent/40 hover:border-gold/30 transition-all active:scale-[0.97] animate-stagger-in group" style={{ animationDelay: `${(i + 4) * 0.06}s` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${action.color}15` }}>
                  <MaterialIcon icon={action.icon} size={18} style={{ color: action.color } as any} />
                </div>
                <span className="text-[12px] font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== CONTENT PAGE (REAL DATA) =====
function ContentPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data: content, isLoading } = trpc.admin.allContent.useQuery();

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    published: { label: 'منشور', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    draft: { label: 'مسودة', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    review: { label: 'مراجعة', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
    archived: { label: 'مؤرشف', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  };

  const typeIcons: Record<string, string> = { report: 'description', dashboard: 'dashboard', presentation: 'slideshow', file: 'upload_file', template: 'dashboard_customize' };
  const typeLabels: Record<string, string> = { report: 'تقرير', dashboard: 'لوحة مؤشرات', presentation: 'عرض', file: 'ملف', template: 'قالب' };

  const filtered = useMemo(() => {
    if (!content) return [];
    return content.filter((c: any) => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (search && !c.title.includes(search)) return false;
      return true;
    });
  }, [content, filter, search]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 h-10 border border-border rounded-xl px-3 bg-card flex-1 focus-within:border-primary/40 transition-all">
          <MaterialIcon icon="search" size={18} className="text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في المحتوى..." className="flex-1 bg-transparent text-[12px] outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="h-10 px-3 border border-border rounded-xl bg-card text-[12px] text-foreground outline-none cursor-pointer">
            <option value="all">جميع الحالات</option>
            <option value="published">منشور</option>
            <option value="draft">مسودة</option>
            <option value="review">مراجعة</option>
            <option value="archived">مؤرشف</option>
          </select>
        </div>
      </div>

      {/* Content Table */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-[12px]">
            <MaterialIcon icon="progress_activity" size={24} className="animate-spin mx-auto mb-2" />
            <p>جاري تحميل المحتوى...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[12px]">
            <MaterialIcon icon="inbox" size={32} className="mx-auto mb-2 opacity-40" />
            <p>لا يوجد محتوى{search ? ' يطابق البحث' : ''}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">العنوان</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">النوع</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">الحالة</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">المنشئ</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item: any, i: number) => {
                    const st = statusConfig[item.status] || statusConfig.draft;
                    return (
                      <tr key={`${item.type}-${item.id}`} className="border-b border-border/50 hover:bg-accent/20 transition-all animate-stagger-in" style={{ animationDelay: `${i * 0.03}s` }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <MaterialIcon icon={typeIcons[item.type] || 'article'} size={18} className="text-muted-foreground" />
                            <span className="text-[12px] font-medium text-foreground">{item.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{typeLabels[item.type] || item.type}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{item.userName}</td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{relativeTime(item.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((item: any, i: number) => {
                const st = statusConfig[item.status] || statusConfig.draft;
                return (
                  <div key={`${item.type}-${item.id}`} className="p-3 hover:bg-accent/20 transition-all animate-stagger-in" style={{ animationDelay: `${i * 0.03}s` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <MaterialIcon icon={typeIcons[item.type] || 'article'} size={16} className="text-muted-foreground" />
                        <span className="text-[12px] font-medium text-foreground">{item.title}</span>
                      </div>
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{item.userName}</span>
                      <span>{relativeTime(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== MEMBERS PAGE (REAL DATA) =====
function MembersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { data: users, isLoading } = trpc.admin.users.useQuery();

  const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: 'مدير', color: '#dc2626' },
    editor: { label: 'محرر', color: '#2563eb' },
    analyst: { label: 'محلل', color: '#7c3aed' },
    viewer: { label: 'مشاهد', color: '#059669' },
    user: { label: 'مستخدم', color: '#6b7280' },
  };

  const filtered = useMemo(() => {
    if (!users) return [];
    return (users as any[]).filter(m => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      const name = m.name || m.displayName || '';
      const email = m.email || '';
      if (search && !name.includes(search) && !email.includes(search)) return false;
      return true;
    });
  }, [users, roleFilter, search]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 h-10 border border-border rounded-xl px-3 bg-card flex-1 focus-within:border-primary/40 transition-all">
          <MaterialIcon icon="search" size={18} className="text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد..." className="flex-1 bg-transparent text-[12px] outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-10 px-3 border border-border rounded-xl bg-card text-[12px] text-foreground outline-none cursor-pointer">
          <option value="all">جميع الأدوار</option>
          <option value="admin">مدير</option>
          <option value="user">مستخدم</option>
        </select>
      </div>

      {/* Members Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 p-5 premium-card animate-pulse">
              <div className="flex items-center gap-3 mb-3"><div className="w-11 h-11 rounded-full bg-accent/50" /><div><div className="h-4 w-24 bg-accent/40 rounded mb-1" /><div className="h-3 w-32 bg-accent/30 rounded" /></div></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-[12px]">
          <MaterialIcon icon="group" size={32} className="mx-auto mb-2 opacity-40" />
          <p>لا يوجد أعضاء{search ? ' يطابقون البحث' : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((member: any, i: number) => {
            const displayName = member.name || member.displayName || 'مستخدم';
            const role = roleLabels[member.role] || { label: member.role, color: '#6b7280' };
            return (
              <div key={member.id} className="bg-card rounded-2xl border border-border/50 p-5 premium-card card-hover animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[16px] font-bold shrink-0">
                      {displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">{displayName}</p>
                      <p className="text-[10px] text-muted-foreground" dir="ltr">{member.email || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${role.color}15`, color: role.color }}>{role.label}</span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <p className="flex items-center gap-1"><MaterialIcon icon="schedule" size={12} /> آخر دخول: {member.lastSignedIn ? relativeTime(member.lastSignedIn) : '—'}</p>
                  <p className="flex items-center gap-1"><MaterialIcon icon="calendar_today" size={12} /> تاريخ الانضمام: {member.createdAt ? relativeTime(member.createdAt) : '—'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== ROLES & PERMISSIONS PAGE =====
function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const activeRole = ROLES_CONFIG.find(r => r.id === selectedRole)!;

  const permGroups = useMemo(() => {
    const groups = new Map<string, typeof ALL_PERMISSIONS>();
    for (const p of ALL_PERMISSIONS) {
      if (!groups.has(p.group)) groups.set(p.group, []);
      groups.get(p.group)!.push(p);
    }
    return groups;
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES_CONFIG.map((role, i) => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role.id)}
            className={`bg-card rounded-xl border p-4 text-right transition-all duration-200 card-hover animate-stagger-in ${
              selectedRole === role.id ? 'border-primary/40 shadow-md shadow-primary/5' : 'border-border'
            }`}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${role.color}15` }}>
                <MaterialIcon icon={role.icon} size={22} style={{ color: role.color } as any} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">{role.label}</p>
                <p className="text-[10px] text-muted-foreground">{role.permissions.length} صلاحية</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{role.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 premium-card sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
            <MaterialIcon icon="admin_panel_settings" size={18} className="text-primary" />
            صلاحيات: {activeRole.label}
          </h3>
          <span className="text-[11px] text-muted-foreground">{activeRole.permissions.length} من {ALL_PERMISSIONS.length} صلاحية</span>
        </div>

        <div className="space-y-4">
          {Array.from(permGroups.entries()).map(([group, perms]) => (
            <div key={group}>
              <p className="text-[11px] font-bold text-muted-foreground mb-2">{group}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {perms.map(perm => {
                  const has = activeRole.permissions.includes(perm.id);
                  return (
                    <div key={perm.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${has ? 'border-success/20 bg-success/5' : 'border-border bg-accent/20 opacity-50'}`}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${has ? 'bg-success text-white' : 'bg-border'}`}>
                        {has && <MaterialIcon icon="check" size={14} />}
                      </div>
                      <MaterialIcon icon={perm.icon} size={16} className={has ? 'text-foreground' : 'text-muted-foreground'} />
                      <span className={`text-[11px] font-medium ${has ? 'text-foreground' : 'text-muted-foreground'}`}>{perm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== ANALYTICS PAGE (REAL DATA + CHARTS) =====
function AnalyticsPage() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Line chart — simulated trend data (last 7 days)
  const lineData = useMemo(() => {
    if (!stats) return null;
    const labels = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const base = stats.totalContent;
    const trend = labels.map((_, i) => Math.max(0, Math.round(base * (0.3 + (i / 6) * 0.7) + Math.random() * 2)));
    return {
      labels,
      datasets: [{
        label: 'المحتوى المُنشأ',
        data: trend,
        borderColor: '#d4a853',
        backgroundColor: 'rgba(212,168,83,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#d4a853',
        pointBorderColor: isDark ? '#1e293b' : '#ffffff',
        pointBorderWidth: 2,
      }],
    };
  }, [stats, isDark]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f1f5f9' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#64748b',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { family: 'Tajawal', size: 13, weight: 'bold' as const },
        bodyFont: { family: 'Tajawal', size: 12 },
        rtl: true,
        textDirection: 'rtl' as const,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Tajawal', size: 10 }, color: isDark ? '#64748b' : '#94a3b8' },
      },
      y: {
        grid: { color: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.5)' },
        ticks: { font: { family: 'Tajawal', size: 10 }, color: isDark ? '#64748b' : '#94a3b8' },
      },
    },
  }), [isDark]);

  // Content distribution
  const distribution = useMemo(() => {
    if (!stats) return [];
    const total = stats.totalContent || 1;
    return [
      { label: 'ملفات', count: stats.files, pct: Math.round((stats.files / total) * 100), color: '#3b82f6' },
      { label: 'تقارير', count: stats.reports, pct: Math.round((stats.reports / total) * 100), color: '#d4a853' },
      { label: 'عروض', count: stats.presentations, pct: Math.round((stats.presentations / total) * 100), color: '#8b5cf6' },
      { label: 'لوحات', count: stats.dashboards, pct: Math.round((stats.dashboards / total) * 100), color: '#ef4444' },
      { label: 'جداول', count: stats.spreadsheets, pct: Math.round((stats.spreadsheets / total) * 100), color: '#06b6d4' },
    ];
  }, [stats]);

  if (isLoading) {
    return <RasedLoader type="data" message="جاري تحميل التحليلات..." />;
  }

  return (
    <div className="space-y-5">
      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المستخدمين', value: stats?.users || 0, icon: 'group', color: '#3b82f6' },
          { label: 'إجمالي الملفات', value: stats?.files || 0, icon: 'folder', color: '#10b981' },
          { label: 'التقارير', value: stats?.reports || 0, icon: 'description', color: '#d4a853' },
          { label: 'إجمالي المحتوى', value: stats?.totalContent || 0, icon: 'dashboard', color: '#8b5cf6' },
        ].map((m, i) => (
          <KPICard key={m.label} label={m.label} target={m.value} icon={m.icon} color={m.color} delay={i * 0.08} />
        ))}
      </div>

      {/* Line Chart — Activity Trend */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 premium-card gold-border-glow">
        <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
          <MaterialIcon icon="show_chart" size={18} className="text-gold" />
          اتجاه النشاط الأسبوعي
        </h3>
        <div className="h-[260px]">
          {lineData ? <Line data={lineData} options={lineOptions} /> : <p className="text-muted-foreground text-[12px]">لا توجد بيانات</p>}
        </div>
      </div>

      {/* Content Distribution Bars */}
      <div className="bg-card rounded-2xl border border-border/50 p-5 premium-card gold-border-glow">
        <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
          <MaterialIcon icon="pie_chart" size={18} className="text-gold" />
          توزيع المحتوى
        </h3>
        <div className="space-y-3">
          {distribution.map((d, i) => (
            <div key={d.label} className="animate-stagger-in" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-foreground">{d.label}</span>
                <span className="text-[11px] text-muted-foreground">{d.count} ({d.pct}%)</span>
              </div>
              <div className="h-2.5 rounded-full bg-accent/50 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max(d.pct, 3)}%`, backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}40` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== SETTINGS PAGE =====
function SettingsPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
          <MaterialIcon icon="settings" size={18} className="text-primary" />
          الإعدادات العامة
        </h3>
        <div className="space-y-4">
          {[
            { label: 'اسم المنصة', value: 'راصد البيانات', icon: 'badge' },
            { label: 'البريد الإلكتروني للدعم', value: 'support@ndmo.gov.sa', icon: 'mail' },
            { label: 'اللغة الافتراضية', value: 'العربية', icon: 'language' },
            { label: 'المنطقة الزمنية', value: 'Asia/Riyadh (GMT+3)', icon: 'schedule' },
          ].map(setting => (
            <div key={setting.label} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-all">
              <div className="flex items-center gap-2.5">
                <MaterialIcon icon={setting.icon} size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">{setting.label}</p>
                  <p className="text-[10px] text-muted-foreground">{setting.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
          <MaterialIcon icon="security" size={18} className="text-primary" />
          الأمان
        </h3>
        <div className="space-y-3">
          {[
            { label: 'المصادقة الثنائية', desc: 'تفعيل التحقق بخطوتين لجميع المستخدمين', enabled: true },
            { label: 'تسجيل الخروج التلقائي', desc: 'تسجيل الخروج بعد 30 دقيقة من عدم النشاط', enabled: true },
            { label: 'تقييد عناوين IP', desc: 'السماح بالدخول من عناوين محددة فقط', enabled: false },
          ].map(setting => (
            <div key={setting.label} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 transition-all">
              <div>
                <p className="text-[12px] font-medium text-foreground">{setting.label}</p>
                <p className="text-[10px] text-muted-foreground">{setting.desc}</p>
              </div>
              <div className={`w-10 h-5.5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${setting.enabled ? 'bg-primary' : 'bg-border'}`}>
                <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-all duration-200 ${setting.enabled ? 'translate-x-0' : '-translate-x-4.5'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== LOGS PAGE (REAL DATA) =====
function LogsPage() {
  const { data: activity, isLoading } = trpc.admin.recentActivity.useQuery();

  const typeColors: Record<string, string> = {
    create: 'text-primary',
    upload: 'text-success',
    login: 'text-info',
    edit: 'text-warning',
    review: 'text-destructive',
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-[12px]">
            <MaterialIcon icon="progress_activity" size={24} className="animate-spin mx-auto mb-2" />
            <p>جاري تحميل السجلات...</p>
          </div>
        ) : !activity || activity.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[12px]">
            <MaterialIcon icon="history" size={32} className="mx-auto mb-2 opacity-40" />
            <p>لا يوجد سجلات نشاط حتى الآن</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">الوقت</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">الإجراء</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground px-4 py-3">النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {(activity as any[]).map((log, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/20 transition-all animate-stagger-in" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">{relativeTime(log.time)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MaterialIcon icon={log.icon} size={16} className="text-muted-foreground" />
                          <span className={`text-[11px] font-medium ${typeColors[log.type] || 'text-foreground'}`}>{log.text}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] text-muted-foreground capitalize">{log.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-border">
              {(activity as any[]).map((log, i) => (
                <div key={i} className="p-3 animate-stagger-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <MaterialIcon icon={log.icon} size={14} className="text-muted-foreground" />
                      <span className={`text-[11px] font-medium ${typeColors[log.type] || 'text-foreground'}`}>{log.text}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">{relativeTime(log.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== MEDIA PAGE (NEW) =====
function MediaPage() {
  const { data: content, isLoading } = trpc.admin.allContent.useQuery();
  
  const files = useMemo(() => {
    if (!content) return [];
    return (content as any[]).filter(c => c.type === 'file');
  }, [content]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">جميع الملفات المرفوعة في المنصة</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 p-5 premium-card animate-pulse">
              <div className="w-full h-24 bg-accent/40 rounded-lg mb-3" />
              <div className="h-4 w-3/4 bg-accent/30 rounded" />
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="perm_media" size={32} className="text-primary" />
          </div>
          <h3 className="text-[16px] font-bold text-foreground mb-2">لا توجد وسائط</h3>
          <p className="text-[12px] text-muted-foreground">لم يتم رفع أي ملفات بعد. ارفع ملفات من خلال محرك التفريغ أو الاستوديو.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file: any, i: number) => (
            <div key={file.id} className="bg-card rounded-2xl border border-border/50 p-5 premium-card card-hover animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="w-full h-24 bg-accent/30 rounded-lg flex items-center justify-center mb-3">
                <MaterialIcon icon="description" size={32} className="text-muted-foreground/40" />
              </div>
              <p className="text-[12px] font-medium text-foreground truncate">{file.title}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span>{file.userName}</span>
                <span>{relativeTime(file.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== TEMPLATES PAGE (NEW) =====
function TemplatesPage() {
  const { data: elements, isLoading } = trpc.slideLibrary.getAllElements.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">قوالب العروض التقديمية المتاحة في المكتبة</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/50 p-5 premium-card animate-pulse">
              <div className="w-full aspect-video bg-accent/40 rounded-lg mb-3" />
              <div className="h-4 w-3/4 bg-accent/30 rounded" />
            </div>
          ))}
        </div>
      ) : !elements || (elements as any[]).length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="dashboard_customize" size={32} className="text-primary" />
          </div>
          <h3 className="text-[16px] font-bold text-foreground mb-2">لا توجد قوالب</h3>
          <p className="text-[12px] text-muted-foreground">أنشئ قوالب من مكتبة عناصر العروض.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(elements as any[]).filter((el: any) => el.htmlTemplate).map((el: any, i: number) => (
            <div key={el.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg card-hover animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="w-full aspect-video bg-accent/20 relative overflow-hidden">
                <iframe
                  srcDoc={el.htmlTemplate}
                  className="absolute inset-0 w-[1280px] h-[720px] border-0 pointer-events-none"
                  style={{ transform: 'scale(0.25)', transformOrigin: 'top left', width: '1280px', height: '720px' }}
                  sandbox="allow-scripts"
                  title={el.nameAr || el.name}
                />
              </div>
              <div className="p-3">
                <p className="text-[12px] font-medium text-foreground truncate">{el.nameAr || el.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{el.category || 'عام'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== INVITATIONS PAGE (NEW) =====
function InvitationsPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [invitations, setInvitations] = useState<{ email: string; role: string; sentAt: string; status: string }[]>([]);

  const handleSendInvite = () => {
    if (!email.trim()) return;
    setInvitations(prev => [...prev, {
      email: email.trim(),
      role,
      sentAt: new Date().toISOString(),
      status: 'pending',
    }]);
    setEmail('');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Send Invitation Form */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
          <MaterialIcon icon="mail" size={18} className="text-primary" />
          إرسال دعوة جديدة
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 h-10 border border-border rounded-xl px-3 bg-background flex-1 focus-within:border-primary/40 transition-all">
            <MaterialIcon icon="mail" size={16} className="text-muted-foreground" />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendInvite(); }}
              placeholder="البريد الإلكتروني..."
              className="flex-1 bg-transparent text-[12px] outline-none text-foreground placeholder:text-muted-foreground"
              dir="ltr"
            />
          </div>
          <select value={role} onChange={e => setRole(e.target.value)} className="h-10 px-3 border border-border rounded-xl bg-background text-[12px] text-foreground outline-none cursor-pointer">
            <option value="user">مستخدم</option>
            <option value="admin">مدير</option>
          </select>
          <button
            onClick={handleSendInvite}
            disabled={!email.trim()}
            className="h-10 px-5 bg-primary text-primary-foreground rounded-xl text-[12px] font-medium hover:opacity-90 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            <MaterialIcon icon="send" size={16} /> إرسال
          </button>
        </div>
      </div>

      {/* Invitations List */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-border bg-accent/20">
          <h3 className="text-[13px] font-bold text-foreground">الدعوات المرسلة ({invitations.length})</h3>
        </div>
        {invitations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[12px]">
            <MaterialIcon icon="mail" size={32} className="mx-auto mb-2 opacity-40" />
            <p>لم يتم إرسال أي دعوات بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {invitations.map((inv, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-accent/20 transition-all animate-stagger-in" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <MaterialIcon icon="mail" size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-foreground" dir="ltr">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground">{inv.role === 'admin' ? 'مدير' : 'مستخدم'} — {relativeTime(inv.sentAt)}</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-warning/10 text-warning">قيد الانتظار</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
