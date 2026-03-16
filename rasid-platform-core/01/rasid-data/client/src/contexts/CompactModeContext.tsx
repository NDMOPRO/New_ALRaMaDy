/* ═══════════════════════════════════════════════════════════════
   CompactModeContext — Global Density State
   Persists to localStorage, provides toggle and class injection
   ═══════════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface CompactModeContextType {
  isCompact: boolean;
  toggleCompact: () => void;
  setCompact: (value: boolean) => void;
}

const CompactModeContext = createContext<CompactModeContextType>({
  isCompact: false,
  toggleCompact: () => {},
  setCompact: () => {},
});

const STORAGE_KEY = 'rasid-compact-mode';

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [isCompact, setIsCompact] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Sync compact class on <html> element for CSS-only density adjustments
  useEffect(() => {
    const html = document.documentElement;
    if (isCompact) {
      html.classList.add('compact-mode');
    } else {
      html.classList.remove('compact-mode');
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(isCompact));
    } catch { /* ignore */ }
  }, [isCompact]);

  // Add transition class briefly when toggling for smooth animation
  const toggleCompact = useCallback(() => {
    document.documentElement.classList.add('compact-transition');
    setIsCompact(prev => !prev);
    setTimeout(() => {
      document.documentElement.classList.remove('compact-transition');
    }, 400);
  }, []);

  const setCompact = useCallback((value: boolean) => {
    document.documentElement.classList.add('compact-transition');
    setIsCompact(value);
    setTimeout(() => {
      document.documentElement.classList.remove('compact-transition');
    }, 400);
  }, []);

  return (
    <CompactModeContext.Provider value={{ isCompact, toggleCompact, setCompact }}>
      {children}
    </CompactModeContext.Provider>
  );
}

export function useCompactMode() {
  return useContext(CompactModeContext);
}

export default CompactModeContext;
