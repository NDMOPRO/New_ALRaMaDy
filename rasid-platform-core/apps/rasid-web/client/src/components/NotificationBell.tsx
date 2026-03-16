/* ═══════════════════════════════════════════════════════════════════
   RASID — Notification Bell Component
   In-app notification system with bell icon, dropdown, and read/unread states
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback } from 'react';
import MaterialIcon from './MaterialIcon';

export interface RasidNotification {
  id: string;
  title: string;
  message: string;
  icon: string;
  type: 'success' | 'info' | 'warning' | 'error';
  read: boolean;
  timestamp: number;
}

const TYPE_COLORS: Record<string, string> = {
  success: 'text-emerald-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
};

const TYPE_BG: Record<string, string> = {
  success: 'bg-emerald-500/10',
  info: 'bg-blue-500/10',
  warning: 'bg-amber-500/10',
  error: 'bg-red-500/10',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

interface NotificationBellProps {
  notifications: RasidNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}

export default function NotificationBell({ notifications, onMarkRead, onMarkAllRead, onClear }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => open ? close() : setOpen(true)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
        title="الإشعارات"
      >
        <MaterialIcon icon={unreadCount > 0 ? 'notifications_active' : 'notifications'} size={20} className={unreadCount > 0 ? 'animate-icon-shake' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg animate-scale-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute top-full left-0 mt-2 w-[340px] sm:w-[380px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-50 ${closing ? 'animate-fade-out' : 'animate-slide-down'}`}
          style={{ maxHeight: '70vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="notifications" size={18} className="text-amber-500" />
              <span className="text-sm font-bold text-foreground">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-[11px] text-muted-foreground hover:text-amber-500 transition-colors px-2 py-1 rounded-lg hover:bg-amber-500/10"
                >
                  قراءة الكل
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClear}
                  className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                >
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)' }}>
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <MaterialIcon icon="notifications_off" size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => { onMarkRead(n.id); }}
                  className={`w-full text-right flex gap-3 px-4 py-3 border-b border-border/20 last:border-b-0 transition-all duration-300 hover:bg-accent/50 ${!n.read ? 'bg-amber-500/[0.03]' : ''}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className={`w-9 h-9 shrink-0 rounded-lg ${TYPE_BG[n.type]} flex items-center justify-center mt-0.5`}>
                    <MaterialIcon icon={n.icon} size={18} className={TYPE_COLORS[n.type]} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-semibold ${!n.read ? 'text-foreground' : 'text-muted-foreground'} truncate`}>{n.title}</span>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5 animate-pulse" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 block">{timeAgo(n.timestamp)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
