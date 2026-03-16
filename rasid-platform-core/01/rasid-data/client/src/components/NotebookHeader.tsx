/* ═══════════════════════════════════════════════════════════════════
   RASID — Institutional Header v4
   Visual DNA: Sovereign, calm, institutional, technically advanced
   - Clean dark navy background with subtle depth
   - Minimal gold accents (single thin line, not overwhelming)
   - Simple icon buttons with soft hover states
   - Professional user menu with clean typography
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import MaterialIcon from './MaterialIcon';
import { LOGOS } from '@/lib/assets';
import { NDMO_LOGO } from '@/lib/rasedAssets';
import NotificationBell from './NotificationBell';
import { useNotifications } from '@/contexts/NotificationContext';
import { playSound, isSoundEnabled, toggleSound } from '@/lib/sounds';
import { useCompactMode } from '@/contexts/CompactModeContext';

interface NotebookHeaderProps {
  onShareClick: () => void;
  onSettingsClick: (e: React.MouseEvent) => void;
  onAnalyticsClick: () => void;
  onSearchClick?: () => void;
  onMenuToggle?: () => void;
  onToggleBoth?: () => void;
  bothPanelsOpen?: boolean;
}

export default function NotebookHeader({
  onShareClick, onSettingsClick, onAnalyticsClick,
  onSearchClick, onMenuToggle, onToggleBoth, bothPanelsOpen = true,
}: NotebookHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [titleEditing, setTitleEditing] = useState(false);
  const [title, setTitle] = useState('مساحة العمل الرئيسية');
  const [themeAnimating, setThemeAnimating] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [headerMounted, setHeaderMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const logo = LOGOS.dark_header;

  useEffect(() => {
    const t = setTimeout(() => setHeaderMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleThemeToggle = useCallback(() => {
    setThemeAnimating(true);
    toggleTheme?.();
    playSound('toggle');
    setTimeout(() => setThemeAnimating(false), 600);
  }, [toggleTheme]);

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    setTimeout(() => { setUserMenuOpen(false); setMenuClosing(false); }, 180);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen, closeMenu]);

  const isAdmin = user?.role === 'admin' || user?.role === 'editor';

  return (
    <header
      className="notebook-header h-[56px] flex items-center px-3 sm:px-5 gap-3 shrink-0 z-50 relative select-none"
      style={{
        background: 'linear-gradient(135deg, #071428 0%, #0c1f3d 40%, #112a4e 70%, #0c1f3d 100%)',
      }}
    >
      {/* ─── Subtle top accent line ─── */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px]" style={{
        background: 'linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.4) 30%, rgba(212,175,55,0.6) 50%, rgba(212,175,55,0.4) 70%, transparent 95%)',
      }} />

      {/* ─── Subtle bottom border ─── */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
      }} />

      {/* ─── Mobile Menu ─── */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all duration-200 active:scale-95"
      >
        <MaterialIcon icon="menu" size={20} />
      </button>

      {/* ═══ RIGHT: Brand Section ═══ */}
      <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
        {/* Rasid Logo — Animated */}
        <div
          className={`relative shrink-0 transition-all duration-500 ${headerMounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
          style={{ transitionDelay: '0.15s' }}
        >
          {/* Animated glow ring behind logo */}
          <div
            className="absolute inset-[-4px] rounded-full opacity-0"
            style={{
              background: 'conic-gradient(from 0deg, transparent, rgba(212,175,55,0.4), transparent, rgba(100,160,255,0.3), transparent)',
              animation: headerMounted ? 'logo-ring-spin 6s linear infinite' : 'none',
              opacity: headerMounted ? 0.6 : 0,
              transition: 'opacity 1s ease 0.5s',
              filter: 'blur(3px)',
            }}
          />
          {/* Subtle pulse glow */}
          <div
            className="absolute inset-[-2px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
              animation: headerMounted ? 'logo-pulse 3s ease-in-out infinite' : 'none',
            }}
          />
          <img
            src={logo}
            alt="راصد"
            className="w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] object-contain relative z-10"
            style={{
              filter: 'drop-shadow(0 2px 10px rgba(212,175,55,0.25))',
              animation: headerMounted ? 'logo-entrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
            }}
          />
        </div>

        {/* Brand text */}
        <div
          className={`flex flex-col leading-tight shrink-0 transition-all duration-500 ${headerMounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
          style={{ transitionDelay: '0.25s' }}
        >
          <span className="text-[15px] sm:text-[17px] font-bold text-white tracking-tight">
            راصد البيانات
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium text-white/35 hidden sm:block tracking-wide">
            أحد مبادرات مكتب إدارة البيانات الوطنية
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 shrink-0 hidden md:block" style={{
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.12), transparent)',
        }} />

        {/* NDMO Logo — Natural colors, clear and visible */}
        <div
          className={`shrink-0 hidden md:flex items-center transition-all duration-500 ${headerMounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
          style={{ transitionDelay: '0.35s' }}
          title="مكتب إدارة البيانات الوطنية — NDMO"
        >
          <div className="rounded-lg px-2.5 py-1.5 bg-white/90 hover:bg-white/95 transition-all duration-200 shadow-sm hover:shadow-md">
            <img
              src={NDMO_LOGO}
              alt="NDMO"
              className="h-[24px] sm:h-[28px] w-auto object-contain"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-5 shrink-0 hidden md:block" style={{
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)',
        }} />

        {/* Editable workspace title */}
        <div
          className={`hidden md:block transition-all duration-500 ${headerMounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
          style={{ transitionDelay: '0.4s' }}
        >
          {titleEditing ? (
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={e => e.key === 'Enter' && setTitleEditing(false)}
              className="text-[12px] bg-white/10 border border-white/20 outline-none text-white px-2.5 py-1 min-w-[130px] rounded-md transition-all focus:border-white/30 focus:bg-white/12"
            />
          ) : (
            <button
              onClick={() => setTitleEditing(true)}
              className="text-[12px] text-white/35 hover:text-white/70 transition-all duration-200 truncate max-w-[180px] hover:bg-white/5 px-2.5 py-1 rounded-md group flex items-center gap-1.5"
            >
              <span>{title}</span>
              <MaterialIcon icon="edit" size={11} className="opacity-0 group-hover:opacity-50 transition-opacity duration-200" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ LEFT: Actions ═══ */}
      <div className="flex items-center gap-1 relative z-10">
        {/* New workspace */}
        <ActionButton
          mounted={headerMounted}
          delay="0.2s"
          className="hidden md:flex"
        >
          <button
            onClick={() => {}}
            className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.85), rgba(190,150,40,0.85))',
              color: '#0a1628',
              boxShadow: '0 2px 8px rgba(212,175,55,0.25)',
            }}
          >
            <MaterialIcon icon="add" size={15} />
            مساحة جديدة
          </button>
        </ActionButton>

        {/* Panel toggle */}
        {onToggleBoth && (
          <ActionButton mounted={headerMounted} delay="0.25s" className="hidden md:flex">
            <IconBtn
              icon={bothPanelsOpen ? 'unfold_less' : 'unfold_more'}
              title={bothPanelsOpen ? 'طي القائمتين (Ctrl+B)' : 'فتح القائمتين (Ctrl+B)'}
              onClick={onToggleBoth}
              active={!bothPanelsOpen}
            />
          </ActionButton>
        )}

        {/* Admin */}
        {isAdmin && (
          <ActionButton mounted={headerMounted} delay="0.3s" className="hidden md:flex">
            <IconBtn icon="admin_panel_settings" title="لوحة التحكم" onClick={() => navigate('/admin')} />
          </ActionButton>
        )}

        {/* Analytics */}
        <ActionButton mounted={headerMounted} delay="0.32s">
          <IconBtn icon="bar_chart" title="التحليلات" onClick={onAnalyticsClick} className="hidden sm:flex" />
        </ActionButton>

        {/* Search */}
        <ActionButton mounted={headerMounted} delay="0.34s">
          <button
            onClick={onSearchClick}
            title="بحث سريع (Ctrl+K)"
            className="group flex items-center gap-1.5 h-8 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 transition-all duration-200"
          >
            <MaterialIcon icon="search" size={15} className="text-white/40 group-hover:text-white/70 transition-colors" />
            <span className="text-[10px] text-white/30 group-hover:text-white/50 hidden sm:inline transition-colors">بحث...</span>
            <kbd className="text-[9px] text-white/25 bg-white/5 px-1 py-0.5 rounded font-mono hidden sm:inline border border-white/8">⌘K</kbd>
          </button>
        </ActionButton>

        {/* Share */}
        <ActionButton mounted={headerMounted} delay="0.36s">
          <IconBtn icon="share" title="مشاركة" onClick={onShareClick} className="hidden sm:flex" />
        </ActionButton>

        {/* Theme toggle */}
        <ActionButton mounted={headerMounted} delay="0.38s">
          <IconBtn
            icon={theme === 'dark' ? 'light_mode' : 'dark_mode'}
            title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            onClick={handleThemeToggle}
            spinning={themeAnimating}
          />
        </ActionButton>

        {/* Settings */}
        <ActionButton mounted={headerMounted} delay="0.4s">
          <IconBtn icon="settings" title="الإعدادات" onClick={onSettingsClick} />
        </ActionButton>

        {/* Sound toggle */}
        <ActionButton mounted={headerMounted} delay="0.42s">
          <SoundToggleButton />
        </ActionButton>

        {/* Compact mode */}
        <ActionButton mounted={headerMounted} delay="0.44s">
          <CompactToggleButton />
        </ActionButton>

        {/* Notifications */}
        <ActionButton mounted={headerMounted} delay="0.46s">
          <NotificationBellWrapper />
        </ActionButton>

        {/* ─── User Avatar ─── */}
        <div
          className={`relative transition-all duration-500 ${headerMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          style={{ transitionDelay: '0.48s' }}
          ref={userMenuRef}
        >
          <button
            onClick={() => userMenuOpen ? closeMenu() : setUserMenuOpen(true)}
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-bold mr-1 cursor-pointer transition-all duration-200 hover:scale-105 overflow-hidden relative"
            title={user?.displayName || 'المستخدم'}
          >
            {/* Subtle ring */}
            <div className="absolute inset-[-1.5px] rounded-full" style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.4), rgba(212,175,55,0.15))',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1.5px',
            }} />
            <div className="absolute inset-0 rounded-full bg-white/5" />
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-full relative z-10" />
            ) : (
              <span className="text-white font-semibold relative z-10 text-[13px]">{user?.displayName?.charAt(0) || 'م'}</span>
            )}
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <div
              className={`absolute left-0 top-full mt-2 w-[240px] rounded-xl shadow-xl z-[100] overflow-hidden ${menuClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
              dir="rtl"
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(180deg, rgba(18,28,48,0.98), rgba(12,20,38,0.99))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(250,251,253,1))',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              }}
            >
              {/* Top accent */}
              <div className="h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />

              {/* User info */}
              <div className="p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0 overflow-hidden relative bg-primary/10">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-primary">{user?.displayName?.charAt(0) || 'م'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">{user?.displayName || 'المستخدم'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</p>
                    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full mt-1 bg-primary/8 text-primary">
                      <MaterialIcon icon="verified" size={9} />
                      {user?.role === 'admin' ? 'مدير النظام' : user?.role === 'editor' ? 'محرر' : user?.role === 'analyst' ? 'محلل' : 'مشاهد'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px mx-3 bg-border/50" />

              {/* Shortcuts */}
              <div className="px-3.5 py-2.5">
                <p className="text-[9px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <MaterialIcon icon="keyboard" size={11} className="text-muted-foreground/60" />
                  اختصارات
                </p>
                <div className="flex flex-col gap-1">
                  {[
                    { label: 'لوحة البيانات', key: 'Ctrl+D' },
                    { label: 'الاستوديو', key: 'Ctrl+Shift+S' },
                    { label: 'طي/فتح الكل', key: 'Ctrl+B' },
                    { label: 'بحث سريع', key: 'Ctrl+K' },
                  ].map(s => (
                    <div key={s.key} className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                      <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground border border-border/40">{s.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px mx-3 bg-border/50" />

              {/* Menu items */}
              <div className="p-1.5">
                {isAdmin && (
                  <DropdownItem icon="admin_panel_settings" label="لوحة التحكم" onClick={() => { closeMenu(); navigate('/admin'); }} />
                )}
                <DropdownItem icon="person" label="الملف الشخصي" onClick={() => { closeMenu(); navigate('/profile'); }} />
                <DropdownItem icon="settings" label="الإعدادات" onClick={() => { closeMenu(); onSettingsClick({} as React.MouseEvent); }} />
                <div className="h-px bg-border/40 my-1 mx-2" />
                <button
                  onClick={() => { closeMenu(); logout(); navigate('/login'); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] text-red-500 hover:bg-red-500/8 transition-all duration-200"
                >
                  <div className="w-6 h-6 rounded-md bg-red-500/8 flex items-center justify-center">
                    <MaterialIcon icon="logout" size={14} />
                  </div>
                  تسجيل الخروج
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ═══ Action Button Wrapper — Staggered entrance ═══ */
function ActionButton({ mounted, delay, className = '', children }: {
  mounted: boolean; delay: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div
      className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'} ${className}`}
      style={{ transitionDelay: delay }}
    >
      {children}
    </div>
  );
}

/* ═══ Icon Button — Clean, minimal ═══ */
function IconBtn({
  icon, title, onClick, spinning, active, className = '',
}: {
  icon: string; title: string; onClick?: (e: React.MouseEvent) => void;
  spinning?: boolean; active?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-95 ${
        active
          ? 'bg-white/15 text-white'
          : 'text-white/45 hover:text-white/80 hover:bg-white/8'
      } ${className}`}
      title={title}
    >
      <MaterialIcon
        icon={icon}
        size={17}
        className={`transition-transform duration-200 ${spinning ? 'animate-icon-spin' : ''}`}
      />
    </button>
  );
}

/* ═══ Sound Toggle ═══ */
function SoundToggleButton() {
  const [enabled, setEnabled] = useState(isSoundEnabled());
  return (
    <button
      onClick={() => { const s = toggleSound(); setEnabled(s); }}
      title={enabled ? 'كتم الأصوات' : 'تفعيل الأصوات'}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
        enabled ? 'bg-white/10 text-amber-300/80' : 'text-white/35 hover:text-white/60 hover:bg-white/8'
      }`}
    >
      <MaterialIcon icon={enabled ? 'volume_up' : 'volume_off'} size={16} />
    </button>
  );
}

/* ═══ Compact Toggle ═══ */
function CompactToggleButton() {
  const { isCompact, toggleCompact } = useCompactMode();
  return (
    <button
      onClick={toggleCompact}
      title={isCompact ? 'العرض العادي' : 'العرض المضغوط'}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
        isCompact ? 'bg-white/10 text-blue-300/80' : 'text-white/35 hover:text-white/60 hover:bg-white/8'
      }`}
    >
      <MaterialIcon icon={isCompact ? 'density_small' : 'density_medium'} size={16} />
    </button>
  );
}

/* ═══ Notification Bell Wrapper ═══ */
function NotificationBellWrapper() {
  const { notifications, markRead, markAllRead, clearAll } = useNotifications();
  return (
    <NotificationBell
      notifications={notifications}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      onClear={clearAll}
    />
  );
}

/* ═══ Dropdown Item ═══ */
function DropdownItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] text-foreground hover:bg-accent/70 transition-all duration-200"
    >
      <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center">
        <MaterialIcon icon={icon} size={14} className="text-muted-foreground" />
      </div>
      {label}
    </button>
  );
}
