/* CommandPalette — Global Search (Ctrl+K)
   Premium search overlay with fuzzy matching, keyboard navigation,
   recent searches, and quick actions across all workspace areas */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'wouter';
import MaterialIcon from '@/components/MaterialIcon';
import { WORKSPACE_VIEWS, ANALYSIS_TYPES } from '@/lib/assets';
import { RASED_USAGE } from '@/lib/rasedAssets';
import { playSound } from '@/lib/sounds';

/* ===== Search Item Types ===== */
interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  category: 'navigation' | 'engine' | 'analysis' | 'action' | 'recent';
  action: () => void;
  keywords: string[];
}

/* ===== Fuzzy Match Helper ===== */
function fuzzyMatch(text: string, query: string): { match: boolean; score: number; indices: number[] } {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact substring match gets highest score
  if (lowerText.includes(lowerQuery)) {
    const idx = lowerText.indexOf(lowerQuery);
    const indices = Array.from({ length: lowerQuery.length }, (_, i) => idx + i);
    return { match: true, score: 100 - idx, indices };
  }
  
  // Fuzzy character-by-character match
  let queryIdx = 0;
  const indices: number[] = [];
  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      indices.push(i);
      queryIdx++;
    }
  }
  
  if (queryIdx === lowerQuery.length) {
    const spread = indices[indices.length - 1] - indices[0];
    return { match: true, score: 50 - spread, indices };
  }
  
  return { match: false, score: 0, indices: [] };
}

/* ===== Highlighted Text ===== */
function HighlightedText({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>;
  
  const chars = text.split('');
  const indexSet = new Set(indices);
  
  return (
    <>
      {chars.map((char, i) => (
        indexSet.has(i) ? (
          <span key={i} className="text-gold font-bold">{char}</span>
        ) : (
          <span key={i}>{char}</span>
        )
      ))}
    </>
  );
}

/* ===== Category Labels ===== */
const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'التنقل',
  engine: 'المحركات',
  analysis: 'التحليلات',
  action: 'إجراءات سريعة',
  recent: 'عمليات بحث سابقة',
};

/* ===== Recent Searches Storage ===== */
const RECENT_KEY = 'rasid_recent_searches';
function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5);
  } catch { return []; }
}
function addRecentSearch(query: string) {
  const recent = getRecentSearches().filter(s => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

/* ===== Main Component ===== */
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (viewId: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
      playSound('search');
    }
  }, [isOpen]);

  // Build search index
  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    // Navigation items
    WORKSPACE_VIEWS.forEach(view => {
      items.push({
        id: `nav-${view.id}`,
        title: view.label,
        subtitle: 'انتقل إلى',
        icon: view.icon,
        category: 'navigation',
        action: () => { onNavigate?.(view.id); onClose(); },
        keywords: [view.label, view.id],
      });
    });

    // Analysis types
    ANALYSIS_TYPES.forEach(type => {
      items.push({
        id: `analysis-${type.id}`,
        title: type.label,
        subtitle: type.desc,
        icon: type.icon,
        category: 'analysis',
        action: () => { onNavigate?.('chat'); onClose(); },
        keywords: [type.label, type.desc, type.id],
      });
    });

    // Engine quick actions — all engines route through Chat wizards for simplicity
    const engines = [
      { id: 'new-presentation', title: 'إنشاء عرض تقديمي جديد', icon: 'slideshow', view: 'chat' },
      { id: 'new-report', title: 'إنشاء تقرير جديد', icon: 'article', view: 'chat' },
      { id: 'new-dashboard', title: 'إنشاء لوحة مؤشرات', icon: 'dashboard', view: 'chat' },
      { id: 'upload-data', title: 'رفع بيانات جديدة', icon: 'upload_file', view: 'data' },
      { id: 'translate', title: 'ترجمة مستند', icon: 'translate', view: 'chat' },
      { id: 'extract', title: 'تفريغ مستند', icon: 'document_scanner', view: 'chat' },
      { id: 'match', title: 'مطابقة بصرية', icon: 'compare', view: 'chat' },
    ];
    engines.forEach(eng => {
      items.push({
        id: `engine-${eng.id}`,
        title: eng.title,
        subtitle: 'إجراء سريع',
        icon: eng.icon,
        category: 'engine',
        action: () => { onNavigate?.(eng.view); onClose(); },
        keywords: [eng.title, eng.id],
      });
    });

    // Quick actions
    const actions = [
      { id: 'profile', title: 'الملف الشخصي', icon: 'person', path: '/profile' },
      { id: 'about', title: 'من نحن', icon: 'info', path: '/about' },
      { id: 'admin', title: 'لوحة الإدارة', icon: 'admin_panel_settings', path: '/admin' },
      { id: 'settings', title: 'الإعدادات', icon: 'settings', path: '' },
    ];
    actions.forEach(act => {
      items.push({
        id: `action-${act.id}`,
        title: act.title,
        subtitle: 'إجراء',
        icon: act.icon,
        category: 'action',
        action: () => { if (act.path) navigate(act.path); onClose(); },
        keywords: [act.title, act.id],
      });
    });

    return items;
  }, [onNavigate, onClose, navigate]);

  // Filter results
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Show recent searches + top navigation items
      const recentItems: SearchItem[] = recentSearches.map((s, i) => ({
        id: `recent-${i}`,
        title: s,
        icon: 'history',
        category: 'recent' as const,
        action: () => setQuery(s),
        keywords: [s],
      }));
      return [...recentItems, ...searchItems.slice(0, 8)];
    }

    return searchItems
      .map(item => {
        const titleMatch = fuzzyMatch(item.title, query);
        const keywordMatches = item.keywords.map(k => fuzzyMatch(k, query));
        const bestMatch = [titleMatch, ...keywordMatches].sort((a, b) => b.score - a.score)[0];
        return { ...item, matchResult: bestMatch };
      })
      .filter(item => item.matchResult.match)
      .sort((a, b) => b.matchResult.score - a.matchResult.score)
      .slice(0, 12);
  }, [query, searchItems, recentSearches]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      if (query.trim()) addRecentSearch(query.trim());
      filteredItems[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredItems, selectedIndex, onClose, query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  // Group items by category
  const grouped: Record<string, typeof filteredItems> = {};
  filteredItems.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  let globalIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[301] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <div
          className="w-full max-w-[580px] pointer-events-auto rounded-2xl overflow-hidden animate-bounce-in"
          style={{
            background: 'var(--card)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,175,55,0.15), 0 0 40px rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.2)',
          }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <MaterialIcon icon="search" size={22} className="text-gold shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ابحث في راصد... (أوامر، بيانات، تقارير، عروض)"
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none font-medium"
              dir="rtl"
            />
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-mono border border-border/50">ESC</kbd>
            </div>
          </div>

          {/* Rasid Character Hint */}
          {!query.trim() && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gold/5 border-b border-gold/10">
              <img src={RASED_USAGE.onboardingWelcome} alt="" className="w-6 h-6 object-contain" />
              <span className="text-[11px] text-gold/80 font-medium">اكتب أي شيء للبحث السريع — يمكنك البحث بالعربية أو الإنجليزية</span>
            </div>
          )}

          {/* Results */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2" dir="rtl">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <img src={RASED_USAGE.loadingData} alt="" className="w-16 h-16 object-contain opacity-40" />
                <span className="text-[13px] text-muted-foreground">لا توجد نتائج لـ "{query}"</span>
                <span className="text-[11px] text-muted-foreground/60">جرّب كلمات مختلفة أو تصفّح الأقسام</span>
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                      {CATEGORY_LABELS[category] || category}
                    </span>
                  </div>
                  {items.map(item => {
                    const currentIndex = globalIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    const matchResult = 'matchResult' in item ? (item as any).matchResult : null;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (query.trim()) addRecentSearch(query.trim());
                          item.action();
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-all duration-150 ${
                          isSelected
                            ? 'bg-gold/10 border-r-2 border-gold'
                            : 'hover:bg-accent/50 border-r-2 border-transparent'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground'
                        }`}>
                          <MaterialIcon icon={item.icon} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-foreground truncate">
                            {matchResult ? (
                              <HighlightedText text={item.title} indices={matchResult.indices} />
                            ) : (
                              item.title
                            )}
                          </div>
                          {item.subtitle && (
                            <div className="text-[10px] text-muted-foreground/60 truncate">{item.subtitle}</div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 shrink-0">
                            <kbd className="px-1 py-0.5 rounded bg-gold/10 text-[9px] text-gold font-mono">Enter</kbd>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/30">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono border border-border/30">↑↓</kbd>
                تنقل
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono border border-border/30">↵</kbd>
                تنفيذ
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono border border-border/30">Esc</kbd>
                إغلاق
              </span>
            </div>
            <span className="text-[9px] text-gold/50 font-medium">بحث راصد الذكي</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Hook for Ctrl+K Shortcut ===== */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
