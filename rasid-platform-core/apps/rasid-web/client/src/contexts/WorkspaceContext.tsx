/* ═══════════════════════════════════════════════════════════════
   WorkspaceContext — Cross-engine navigation & state sharing
   Allows any engine to navigate to another engine with data
   Supports navigation history, breadcrumbs, and back navigation
   ═══════════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface NavigationPayload {
  targetView: string;
  itemId?: number;
  itemType?: string;
  data?: any;
  /** Label for breadcrumb display */
  label?: string;
}

interface NavigationHistoryEntry {
  view: string;
  label: string;
  timestamp: number;
  payload?: NavigationPayload;
}

interface WorkspaceContextType {
  activeView: string;
  setActiveView: (view: string) => void;
  navigateTo: (payload: NavigationPayload) => void;
  pendingNavigation: NavigationPayload | null;
  clearPendingNavigation: () => void;
  /** Navigation history for breadcrumbs */
  navigationHistory: NavigationHistoryEntry[];
  /** Go back to previous view */
  goBack: () => void;
  /** Can we go back? */
  canGoBack: boolean;
}

const VIEW_LABELS: Record<string, string> = {
  chat: 'المحادثة',
  data: 'البيانات',
  dashboard: 'لوحة المؤشرات',
  reports: 'التقارير',
  presentations: 'العروض التقديمية',
  extraction: 'الاستخراج',
  translation: 'الترجمة',
  studio: 'الاستوديو',
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveViewRaw] = useState<string>('chat');
  const [pendingNavigation, setPendingNavigation] = useState<NavigationPayload | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryEntry[]>([
    { view: 'chat', label: 'المحادثة', timestamp: Date.now() },
  ]);

  const setActiveView = useCallback((view: string) => {
    setActiveViewRaw(view);
    setNavigationHistory(prev => {
      // Don't add duplicate consecutive entries
      if (prev.length > 0 && prev[prev.length - 1].view === view) return prev;
      return [...prev.slice(-20), { view, label: VIEW_LABELS[view] || view, timestamp: Date.now() }];
    });
  }, []);

  const navigateTo = useCallback((payload: NavigationPayload) => {
    setPendingNavigation(payload);
    setActiveViewRaw(payload.targetView);
    setNavigationHistory(prev => [
      ...prev.slice(-20),
      {
        view: payload.targetView,
        label: payload.label || VIEW_LABELS[payload.targetView] || payload.targetView,
        timestamp: Date.now(),
        payload,
      },
    ]);
  }, []);

  const goBack = useCallback(() => {
    setNavigationHistory(prev => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      const lastEntry = newHistory[newHistory.length - 1];
      setActiveViewRaw(lastEntry.view);
      if (lastEntry.payload) {
        setPendingNavigation(lastEntry.payload);
      }
      return newHistory;
    });
  }, []);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const canGoBack = navigationHistory.length > 1;

  return (
    <WorkspaceContext.Provider value={{
      activeView, setActiveView, navigateTo,
      pendingNavigation, clearPendingNavigation,
      navigationHistory, goBack, canGoBack,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
