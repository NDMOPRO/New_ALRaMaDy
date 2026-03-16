/* ═══════════════════════════════════════════════════════════════
   WorkspaceContext — Cross-engine navigation & state sharing
   Allows any engine to navigate to another engine with data
   ═══════════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface NavigationPayload {
  targetView: string;
  itemId?: number;
  itemType?: string;
  data?: any;
}

interface WorkspaceContextType {
  activeView: string;
  setActiveView: (view: string) => void;
  navigateTo: (payload: NavigationPayload) => void;
  pendingNavigation: NavigationPayload | null;
  clearPendingNavigation: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<string>('chat');
  const [pendingNavigation, setPendingNavigation] = useState<NavigationPayload | null>(null);

  const navigateTo = useCallback((payload: NavigationPayload) => {
    setPendingNavigation(payload);
    setActiveView(payload.targetView);
  }, []);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ activeView, setActiveView, navigateTo, pendingNavigation, clearPendingNavigation }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
