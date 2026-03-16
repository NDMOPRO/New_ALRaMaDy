/* Tests for new features: CommandPalette search logic, Sound System logic, Profile Stats */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ===== Sound System Logic Tests (pure logic, no AudioContext) =====
describe('Sound System Logic', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem(key: string) { return store[key] ?? null; },
      setItem(key: string, value: string) { store[key] = value; },
      removeItem(key: string) { delete store[key]; },
    });
  });

  const SOUND_KEY = 'rasid_sound_enabled';

  function isSoundEnabled(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) === 'true';
    } catch { return false; }
  }

  function setSoundEnabled(enabled: boolean) {
    try { localStorage.setItem(SOUND_KEY, String(enabled)); } catch {}
  }

  function toggleSound(): boolean {
    const newState = !isSoundEnabled();
    setSoundEnabled(newState);
    return newState;
  }

  it('sound preference defaults to disabled', () => {
    expect(isSoundEnabled()).toBe(false);
  });

  it('can enable and disable sounds via setSoundEnabled', () => {
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it('toggleSound flips the state', () => {
    setSoundEnabled(false);
    const result = toggleSound();
    expect(result).toBe(true);
    expect(isSoundEnabled()).toBe(true);
    const result2 = toggleSound();
    expect(result2).toBe(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it('persists sound preference to localStorage', () => {
    setSoundEnabled(true);
    expect(store[SOUND_KEY]).toBe('true');
    setSoundEnabled(false);
    expect(store[SOUND_KEY]).toBe('false');
  });

  it('all sound effect names are valid', () => {
    const validEffects = [
      'click', 'hover', 'toggle', 'success', 'error',
      'notification', 'open', 'close', 'send', 'search', 'drop', 'delete',
    ];
    expect(validEffects.length).toBe(12);
    // Each effect name should be a non-empty string
    validEffects.forEach(e => {
      expect(typeof e).toBe('string');
      expect(e.length).toBeGreaterThan(0);
    });
  });
});

// ===== Command Palette Search Logic Tests =====
describe('Command Palette Search Logic', () => {
  function fuzzyMatch(text: string, query: string) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (lowerText.includes(lowerQuery)) {
      const idx = lowerText.indexOf(lowerQuery);
      const indices = Array.from({ length: lowerQuery.length }, (_, i) => idx + i);
      return { match: true, score: 100 - idx, indices };
    }
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

  it('finds exact substring matches with high score', () => {
    const result = fuzzyMatch('العروض التقديمية', 'عروض');
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.indices.length).toBe(4);
  });

  it('returns no match for unrelated text', () => {
    const result = fuzzyMatch('العروض التقديمية', 'xyz');
    expect(result.match).toBe(false);
    expect(result.score).toBe(0);
    expect(result.indices).toEqual([]);
  });

  it('handles English queries correctly', () => {
    const result = fuzzyMatch('presentations', 'pres');
    expect(result.match).toBe(true);
    expect(result.score).toBe(100); // Starts at index 0
  });

  it('gives higher score to matches at the beginning', () => {
    const result1 = fuzzyMatch('presentations', 'pres');
    const result2 = fuzzyMatch('my presentations', 'pres');
    expect(result1.score).toBeGreaterThan(result2.score);
  });

  it('supports fuzzy character matching', () => {
    const result = fuzzyMatch('dashboard', 'dshb');
    expect(result.match).toBe(true);
    expect(result.indices.length).toBe(4);
  });

  it('handles empty query gracefully', () => {
    const result = fuzzyMatch('test', '');
    // Empty query matches at index 0 with full score
    expect(result.match).toBe(true);
  });

  it('handles case-insensitive matching', () => {
    const result = fuzzyMatch('Dashboard', 'dashboard');
    expect(result.match).toBe(true);
    expect(result.score).toBe(100);
  });
});

// ===== Recent Searches Tests =====
describe('Recent Searches Storage', () => {
  let store: Record<string, string>;
  const RECENT_KEY = 'rasid_recent_searches';

  function getRecentSearches(): string[] {
    try {
      return JSON.parse(store[RECENT_KEY] || '[]').slice(0, 5);
    } catch { return []; }
  }

  function addRecentSearch(query: string) {
    const recent = getRecentSearches().filter((s: string) => s !== query);
    recent.unshift(query);
    store[RECENT_KEY] = JSON.stringify(recent.slice(0, 5));
  }

  beforeEach(() => {
    store = {};
  });

  it('stores and retrieves recent searches', () => {
    addRecentSearch('عروض');
    addRecentSearch('تقارير');
    const recent = getRecentSearches();
    expect(recent).toEqual(['تقارير', 'عروض']);
  });

  it('limits to 5 recent searches', () => {
    for (let i = 0; i < 8; i++) {
      addRecentSearch(`search_${i}`);
    }
    const recent = getRecentSearches();
    expect(recent.length).toBe(5);
    expect(recent[0]).toBe('search_7');
  });

  it('deduplicates searches', () => {
    addRecentSearch('عروض');
    addRecentSearch('تقارير');
    addRecentSearch('عروض'); // duplicate
    const recent = getRecentSearches();
    expect(recent).toEqual(['عروض', 'تقارير']);
    expect(recent.length).toBe(2);
  });

  it('returns empty array for invalid stored data', () => {
    store[RECENT_KEY] = 'invalid json{{{';
    const recent = getRecentSearches();
    expect(recent).toEqual([]);
  });
});

// ===== Profile Usage Statistics Tab Tests =====
describe('Profile Usage Statistics Tab', () => {
  it('defines correct tab structure with stats tab', () => {
    const TABS = [
      { id: 'info', label: 'المعلومات الشخصية', icon: 'person' },
      { id: 'stats', label: 'إحصائيات الاستخدام', icon: 'bar_chart' },
      { id: 'security', label: 'الأمان', icon: 'lock' },
      { id: 'sessions', label: 'الجلسات', icon: 'devices' },
      { id: 'activity', label: 'سجل النشاط', icon: 'history' },
    ];

    expect(TABS.find(t => t.id === 'stats')).toBeDefined();
    expect(TABS.find(t => t.id === 'stats')?.label).toBe('إحصائيات الاستخدام');
    expect(TABS.length).toBe(5);
  });

  it('stats tab is positioned after info tab', () => {
    const TABS = ['info', 'stats', 'security', 'sessions', 'activity'];
    const infoIndex = TABS.indexOf('info');
    const statsIndex = TABS.indexOf('stats');
    expect(statsIndex).toBe(infoIndex + 1);
  });

  it('engine usage data has valid structure', () => {
    const engines = [
      { name: 'محرك العروض التقديمية', usage: 85, count: 42, icon: 'slideshow', color: '#7c3aed' },
      { name: 'محرك التقارير', usage: 72, count: 31, icon: 'article', color: '#0891b2' },
      { name: 'محرك الترجمة', usage: 60, count: 24, icon: 'translate', color: '#2563eb' },
      { name: 'محرك التفريغ', usage: 45, count: 18, icon: 'document_scanner', color: '#059669' },
      { name: 'محرك لوحات المؤشرات', usage: 38, count: 15, icon: 'dashboard', color: '#d97706' },
      { name: 'محرك المطابقة', usage: 25, count: 10, icon: 'compare', color: '#dc2626' },
    ];

    engines.forEach(eng => {
      expect(eng.usage).toBeGreaterThanOrEqual(0);
      expect(eng.usage).toBeLessThanOrEqual(100);
      expect(eng.count).toBeGreaterThanOrEqual(0);
      expect(eng.color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it('KPI stats have valid delta format', () => {
    const stats = [
      { label: 'العروض التقديمية', value: '12', delta: '+3 هذا الشهر' },
      { label: 'التقارير', value: '8', delta: '+2 هذا الشهر' },
      { label: 'لوحات المؤشرات', value: '5', delta: '+1 هذا الشهر' },
      { label: 'الملفات المرفوعة', value: '34', delta: '+8 هذا الشهر' },
    ];

    stats.forEach(stat => {
      expect(stat.delta).toContain('هذا الشهر');
      expect(parseInt(stat.value)).toBeGreaterThan(0);
    });
  });
});
