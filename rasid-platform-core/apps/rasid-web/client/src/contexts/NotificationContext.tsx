/* ═══════════════════════════════════════════════════════════════════
   RASID — Notification Context
   Global notification state management with persistence
   ═══════════════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { RasidNotification } from '@/components/NotificationBell';
import { playSound } from '@/lib/sounds';

interface NotificationContextType {
  notifications: RasidNotification[];
  addNotification: (n: Omit<RasidNotification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const STORAGE_KEY = 'rasid_notifications';

function loadNotifications(): RasidNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveNotifications(ns: RasidNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ns.slice(0, 50)));
  } catch { /* ignore */ }
}

const TOAST_ICONS: Record<string, string> = {
  success: '✅',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<RasidNotification[]>(loadNotifications);

  const addNotification = useCallback((n: Omit<RasidNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: RasidNotification = {
      ...n,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      saveNotifications(updated);
      return updated;
    });

    // Play notification sound
    playSound('notification');

    // Also show a toast
    const icon = TOAST_ICONS[n.type] || 'ℹ️';
    if (n.type === 'success') {
      toast.success(n.title, { description: n.message, icon });
    } else if (n.type === 'error') {
      toast.error(n.title, { description: n.message, icon });
    } else if (n.type === 'warning') {
      toast.warning(n.title, { description: n.message, icon });
    } else {
      toast.info(n.title, { description: n.message, icon });
    }
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markRead, markAllRead, clearAll, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
