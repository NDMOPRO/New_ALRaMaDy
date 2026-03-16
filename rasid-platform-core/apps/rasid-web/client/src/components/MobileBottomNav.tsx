/* ═══════════════════════════════════════════════════════════════════
   RASID — Mobile Bottom Navigation
   Premium animated bottom nav for mobile with golden accents,
   bounce animations, and haptic-like feedback
   Only visible on screens < 768px
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import MaterialIcon from './MaterialIcon';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  activeIcon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'المحادثة', icon: 'chat_bubble_outline', activeIcon: 'chat_bubble' },
  { id: 'data', label: 'بياناتي', icon: 'table_chart', activeIcon: 'table_chart' },
  { id: 'presentations', label: 'عروضي', icon: 'slideshow', activeIcon: 'slideshow' },
  { id: 'reports', label: 'تقاريري', icon: 'article', activeIcon: 'article' },
  { id: 'more', label: 'المزيد', icon: 'grid_view', activeIcon: 'grid_view' },
];

const MORE_ITEMS = [
  { id: 'dashboard', label: 'لوحاتي', icon: 'dashboard' },
  { id: 'extraction', label: 'تفريغ', icon: 'document_scanner' },
  { id: 'translation', label: 'ترجمة', icon: 'translate' },
  { id: 'matching', label: 'مطابقة', icon: 'compare' },
  { id: 'library', label: 'مكتبتي', icon: 'folder_open' },
];

interface MobileBottomNavProps {
  activeView: string;
  onViewChange: (viewId: string) => void;
}

export default function MobileBottomNav({ activeView, onViewChange }: MobileBottomNavProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreClosing, setMoreClosing] = useState(false);
  const [tappedId, setTappedId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleTap = useCallback((id: string) => {
    setTappedId(id);
    setTimeout(() => setTappedId(null), 300);

    if (id === 'more') {
      if (moreOpen) {
        setMoreClosing(true);
        setTimeout(() => { setMoreOpen(false); setMoreClosing(false); }, 200);
      } else {
        setMoreOpen(true);
      }
    } else {
      onViewChange(id);
      if (moreOpen) {
        setMoreClosing(true);
        setTimeout(() => { setMoreOpen(false); setMoreClosing(false); }, 200);
      }
    }
  }, [moreOpen, onViewChange]);

  if (!isMobile) return null;

  const isActive = (id: string) => {
    if (id === 'more') return MORE_ITEMS.some(m => m.id === activeView);
    return activeView === id;
  };

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div
          className={`fixed inset-0 z-[998] bg-black/30 backdrop-blur-sm ${moreClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
          onClick={() => {
            setMoreClosing(true);
            setTimeout(() => { setMoreOpen(false); setMoreClosing(false); }, 200);
          }}
        />
      )}

      {/* More menu popup */}
      {moreOpen && (
        <div
          className={`fixed bottom-[72px] left-4 right-4 z-[999] bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-3 ${moreClosing ? 'animate-slide-down-reverse' : 'animate-slide-up'}`}
        >
          <div className="grid grid-cols-5 gap-2">
            {MORE_ITEMS.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleTap(item.id)}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-300 ${
                  activeView === item.id
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  activeView === item.id
                    ? 'bg-amber-500/20 shadow-[0_2px_12px_rgba(212,175,55,0.2)]'
                    : 'bg-muted/30'
                }`}>
                  <MaterialIcon icon={item.icon} size={22} />
                </div>
                <span className="text-[10px] font-bold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[999] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Top gold line */}
        <div className="h-[1px] bg-gradient-to-l from-transparent via-amber-400/40 to-transparent" />

        <div
          className="flex items-center justify-around px-2 py-1.5"
          style={{
            background: 'linear-gradient(180deg, rgba(var(--card-rgb, 255,255,255), 0.95) 0%, rgba(var(--card-rgb, 255,255,255), 0.98) 100%)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.08), 0 -1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.id);
            const tapped = tappedId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTap(item.id)}
                className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-300 min-w-[56px] ${
                  active ? 'text-amber-500' : 'text-muted-foreground'
                } ${tapped ? 'scale-90' : 'scale-100'}`}
              >
                {/* Active indicator dot */}
                {active && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-gradient-to-l from-amber-400 to-amber-600 shadow-[0_0_8px_rgba(212,175,55,0.4)] animate-scale-in" />
                )}

                {/* Icon container */}
                <div className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 ${
                  active
                    ? 'bg-amber-500/12'
                    : ''
                } ${tapped ? 'animate-bounce-once' : ''}`}>
                  <MaterialIcon
                    icon={active ? item.activeIcon : item.icon}
                    size={22}
                    className={`transition-all duration-300 ${active ? 'scale-110' : ''}`}
                  />
                  {/* Active glow */}
                  {active && (
                    <div className="absolute inset-0 rounded-lg opacity-50" style={{ boxShadow: '0 0 12px rgba(212,175,55,0.3)' }} />
                  )}
                </div>

                {/* Label */}
                <span className={`text-[10px] font-bold transition-all duration-300 ${
                  active ? 'text-amber-500 translate-y-0 opacity-100' : 'text-muted-foreground opacity-70'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
