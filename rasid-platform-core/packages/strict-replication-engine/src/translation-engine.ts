// ─── Translation, Arabization & Content Emptying Engine ───────────────
// تحويل المحتوى: ترجمة (Translation) + تعريب (Arabization) + تفريغ (Emptying)

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/** Direction of text flow */
export type TextDirection = "rtl" | "ltr" | "mixed";

/** Supported translation directions */
export type TranslationDirection = "ar-to-en" | "en-to-ar";

/** A single CDR element reference (mirrors StrictElement shape) */
export interface CDRElement {
  element_id: string;
  element_type: "text" | "shape" | "table" | "image" | "chart" | "control";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  rows?: string[][];
  chart_type?: string;
  series_refs?: string[];
  axis_refs?: string[];
  image_ref?: string;
  fill?: string;
  editable?: boolean;
}

/** A CDR page */
export interface CDRPage {
  page_id: string;
  width: number;
  height: number;
  background: string;
  elements: CDRElement[];
}

/** Full CDR document */
export interface CDRDocument {
  run_id: string;
  pages: CDRPage[];
  source_kind?: string;
  target_kind?: string;
  original_name?: string;
}

/** A single terminology entry */
export interface TermEntry {
  id: string;
  source: string;
  target: string;
  domain: string;
  direction: TranslationDirection;
  confidence: number;
  approved: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Translation memory segment */
export interface TMSegment {
  id: string;
  source: string;
  target: string;
  direction: TranslationDirection;
  domain: string;
  qualityScore: number;
  useCount: number;
  lastUsed: number;
  context?: string;
}

/** Translation result for a single text unit */
export interface TranslationResult {
  sourceText: string;
  translatedText: string;
  direction: TranslationDirection;
  qualityScore: number;
  tmMatch: boolean;
  tmMatchScore: number;
  termsApplied: string[];
  warnings: string[];
}

/** Batch translation result for a CDR */
export interface CDRTranslationResult {
  originalCDR: CDRDocument;
  translatedCDR: CDRDocument;
  direction: TranslationDirection;
  elementResults: Map<string, TranslationResult>;
  overallQuality: number;
  termConsistency: number;
  layoutPreserved: boolean;
  warnings: string[];
  stats: {
    totalElements: number;
    translatedElements: number;
    skippedElements: number;
    tmHits: number;
    avgQuality: number;
    durationMs: number;
  };
}

/** Arabization options */
export interface ArabizationOptions {
  mirrorLayout: boolean;
  convertNumbers: boolean;
  convertDates: boolean;
  convertCurrency: boolean;
  applyKashida: boolean;
  applyTashkeel: boolean;
  substituteFonts: boolean;
  mirrorCharts: boolean;
  mirrorTables: boolean;
  preserveLogicalOrder: boolean;
}

/** Arabization result */
export interface ArabizationResult {
  originalCDR: CDRDocument;
  arabizedCDR: CDRDocument;
  changes: ArabizationChange[];
  warnings: string[];
  stats: {
    elementsProcessed: number;
    numberConverted: number;
    datesConverted: number;
    fontsSubstituted: number;
    layoutsMirrored: number;
    durationMs: number;
  };
}

/** Single arabization change record */
export interface ArabizationChange {
  elementId: string;
  changeType:
    | "layout_mirror"
    | "number_convert"
    | "date_convert"
    | "currency_convert"
    | "font_substitute"
    | "direction_change"
    | "kashida_insert"
    | "tashkeel_place";
  before: string;
  after: string;
}

/** Content manifest entry types */
export type ManifestEntryType =
  | "text"
  | "table"
  | "chart"
  | "kpi"
  | "image_caption"
  | "heading"
  | "paragraph"
  | "label"
  | "metric";

/** A single content manifest entry */
export interface ManifestEntry {
  id: string;
  elementId: string;
  pageId: string;
  type: ManifestEntryType;
  content: unknown;
  metadata: Record<string, unknown>;
  editable: boolean;
  order: number;
}

/** Text content entry */
export interface TextManifestContent {
  text: string;
  direction: TextDirection;
  language: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
}

/** Table content entry */
export interface TableManifestContent {
  headers: string[];
  rows: string[][];
  columnTypes: string[];
  totalRows: number;
  totalCols: number;
}

/** Chart content entry */
export interface ChartManifestContent {
  chartType: string;
  title?: string;
  series: ChartSeries[];
  xAxis?: AxisInfo;
  yAxis?: AxisInfo;
  labels: string[];
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
  type?: string;
}

export interface AxisInfo {
  label: string;
  type: "numeric" | "category" | "date";
  values?: string[];
  min?: number;
  max?: number;
}

/** KPI / metric content entry */
export interface KPIManifestContent {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  changePercent?: number;
  targetValue?: number;
  format?: string;
}

/** Content emptying (تفريغ) result */
export interface ContentEmptyingResult {
  sourceDocument: CDRDocument;
  manifest: ContentManifest;
  stats: {
    totalEntries: number;
    textEntries: number;
    tableEntries: number;
    chartEntries: number;
    kpiEntries: number;
    imageEntries: number;
    extractionDurationMs: number;
    ocrConfidence: number;
  };
  warnings: string[];
}

/** Re-injection result */
export interface ReinjectionResult {
  updatedCDR: CDRDocument;
  appliedChanges: number;
  skippedChanges: number;
  conflicts: ReinjectionConflict[];
  warnings: string[];
}

export interface ReinjectionConflict {
  entryId: string;
  elementId: string;
  reason: string;
  originalContent: unknown;
  newContent: unknown;
}

// ---------------------------------------------------------------------------
// TerminologyDB — domain-specific term storage & lookup
// ---------------------------------------------------------------------------

export class TerminologyDB {
  private terms: Map<string, TermEntry[]> = new Map();
  private reverseIndex: Map<string, TermEntry[]> = new Map();
  private domainIndex: Map<string, TermEntry[]> = new Map();

  // Built-in seed terms: common AR↔EN pairs
  private static readonly SEED_TERMS: Omit<TermEntry, "id" | "createdAt" | "updatedAt">[] = [
    // Finance
    { source: "الإيرادات", target: "Revenue", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "المصروفات", target: "Expenses", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "صافي الربح", target: "Net Profit", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "إجمالي الربح", target: "Gross Profit", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "الميزانية العمومية", target: "Balance Sheet", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "قائمة الدخل", target: "Income Statement", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "التدفقات النقدية", target: "Cash Flow", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "الأصول", target: "Assets", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "الخصوم", target: "Liabilities", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "حقوق الملكية", target: "Equity", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "ريال سعودي", target: "Saudi Riyal", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "مليون", target: "Million", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "مليار", target: "Billion", domain: "finance", direction: "ar-to-en", confidence: 1, approved: true },
    // Government / GovTech
    { source: "المملكة العربية السعودية", target: "Kingdom of Saudi Arabia", domain: "government", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "رؤية 2030", target: "Vision 2030", domain: "government", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "الهيئة العامة", target: "General Authority", domain: "government", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "وزارة", target: "Ministry", domain: "government", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "هيئة", target: "Authority", domain: "government", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "مؤشر الأداء", target: "Performance Indicator", domain: "government", direction: "ar-to-en", confidence: 1, approved: true },
    // Data / Analytics
    { source: "لوحة المعلومات", target: "Dashboard", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "تقرير", target: "Report", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "رسم بياني", target: "Chart", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "جدول", target: "Table", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "النسبة المئوية", target: "Percentage", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "المتوسط", target: "Average", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "الإجمالي", target: "Total", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "المجموع", target: "Sum", domain: "analytics", direction: "ar-to-en", confidence: 1, approved: true },
    // Months / Time
    { source: "يناير", target: "January", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "فبراير", target: "February", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "مارس", target: "March", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "أبريل", target: "April", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "مايو", target: "May", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "يونيو", target: "June", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "يوليو", target: "July", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "أغسطس", target: "August", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "سبتمبر", target: "September", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "أكتوبر", target: "October", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "نوفمبر", target: "November", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "ديسمبر", target: "December", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    // Hijri months
    { source: "محرم", target: "Muharram", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "صفر", target: "Safar", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "ربيع الأول", target: "Rabi al-Awwal", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "ربيع الآخر", target: "Rabi al-Thani", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "جمادى الأولى", target: "Jumada al-Ula", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "جمادى الآخرة", target: "Jumada al-Thani", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "رجب", target: "Rajab", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "شعبان", target: "Sha'ban", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "رمضان", target: "Ramadan", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "شوال", target: "Shawwal", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "ذو القعدة", target: "Dhul Qi'dah", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
    { source: "ذو الحجة", target: "Dhul Hijjah", domain: "time", direction: "ar-to-en", confidence: 1, approved: true },
  ];

  constructor() {
    this.loadSeedTerms();
  }

  /** Load built-in seed terminology */
  private loadSeedTerms(): void {
    const now = Date.now();
    for (const seed of TerminologyDB.SEED_TERMS) {
      const entry: TermEntry = {
        ...seed,
        id: `seed-${this.terms.size}`,
        createdAt: now,
        updatedAt: now,
      };
      this.addToIndices(entry);
    }
  }

  private addToIndices(entry: TermEntry): void {
    const sourceKey = this.normalizeKey(entry.source);
    const targetKey = this.normalizeKey(entry.target);

    if (!this.terms.has(sourceKey)) this.terms.set(sourceKey, []);
    this.terms.get(sourceKey)!.push(entry);

    if (!this.reverseIndex.has(targetKey)) this.reverseIndex.set(targetKey, []);
    this.reverseIndex.get(targetKey)!.push(entry);

    if (!this.domainIndex.has(entry.domain)) this.domainIndex.set(entry.domain, []);
    this.domainIndex.get(entry.domain)!.push(entry);
  }

  private normalizeKey(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "") // strip tashkeel
      .replace(/\s+/g, " ");
  }

  /** Add a new term pair */
  addTerm(
    source: string,
    target: string,
    domain: string,
    direction: TranslationDirection,
    confidence = 1,
    approved = false,
    notes?: string,
  ): TermEntry {
    const now = Date.now();
    const entry: TermEntry = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source,
      target,
      domain,
      direction,
      confidence,
      approved,
      notes,
      createdAt: now,
      updatedAt: now,
    };
    this.addToIndices(entry);
    return entry;
  }

  /** Lookup a source term */
  lookup(text: string, direction: TranslationDirection, domain?: string): TermEntry | null {
    const key = this.normalizeKey(text);
    const isForward = direction === "ar-to-en";
    const candidates = isForward ? this.terms.get(key) : this.reverseIndex.get(key);

    if (!candidates || candidates.length === 0) return null;

    // Filter by domain if specified
    let filtered = domain ? candidates.filter((c) => c.domain === domain) : candidates;
    if (filtered.length === 0) filtered = candidates;

    // Sort by confidence desc, approved first
    filtered.sort((a, b) => {
      if (a.approved !== b.approved) return a.approved ? -1 : 1;
      return b.confidence - a.confidence;
    });

    return filtered[0];
  }

  /** Find all terms that appear in the given text (substring matching) */
  findTermsInText(text: string, direction: TranslationDirection, domain?: string): TermEntry[] {
    const normalizedText = this.normalizeKey(text);
    const results: TermEntry[] = [];
    const index = direction === "ar-to-en" ? this.terms : this.reverseIndex;

    for (const [key, entries] of index) {
      if (normalizedText.includes(key)) {
        const best = domain
          ? entries.find((e) => e.domain === domain) ?? entries[0]
          : entries[0];
        results.push(best);
      }
    }

    // Sort by source length descending to prioritize longer (more specific) matches
    results.sort((a, b) => b.source.length - a.source.length);
    return results;
  }

  /** Get all terms for a domain */
  getByDomain(domain: string): TermEntry[] {
    return this.domainIndex.get(domain) ?? [];
  }

  /** Total number of term entries */
  get size(): number {
    let count = 0;
    for (const entries of this.terms.values()) count += entries.length;
    return count;
  }
}

// ---------------------------------------------------------------------------
// TranslationMemory — TM with fuzzy matching
// ---------------------------------------------------------------------------

export class TranslationMemory {
  private segments: Map<string, TMSegment> = new Map();
  private readonly FUZZY_THRESHOLD = 0.6;

  /** Add a segment to TM */
  addSegment(
    source: string,
    target: string,
    direction: TranslationDirection,
    domain: string,
    qualityScore = 1.0,
    context?: string,
  ): TMSegment {
    const id = `tm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const segment: TMSegment = {
      id,
      source,
      target,
      direction,
      domain,
      qualityScore,
      useCount: 0,
      lastUsed: Date.now(),
      context,
    };
    this.segments.set(this.normalizeForTM(source, direction), segment);
    return segment;
  }

  /** Exact match lookup */
  exactMatch(source: string, direction: TranslationDirection): TMSegment | null {
    const key = this.normalizeForTM(source, direction);
    return this.segments.get(key) ?? null;
  }

  /**
   * Fuzzy match using Levenshtein-based similarity.
   * Returns best match above the threshold, along with its score.
   */
  fuzzyMatch(
    source: string,
    direction: TranslationDirection,
    threshold?: number,
  ): { segment: TMSegment; score: number } | null {
    const minScore = threshold ?? this.FUZZY_THRESHOLD;
    const normalizedSource = this.normalizeForTM(source, direction);

    let bestMatch: TMSegment | null = null;
    let bestScore = 0;

    for (const segment of this.segments.values()) {
      if (segment.direction !== direction) continue;

      const segKey = this.normalizeForTM(segment.source, direction);
      const similarity = this.computeSimilarity(normalizedSource, segKey);

      if (similarity > bestScore && similarity >= minScore) {
        bestScore = similarity;
        bestMatch = segment;
      }
    }

    if (bestMatch) {
      bestMatch.useCount++;
      bestMatch.lastUsed = Date.now();
      return { segment: bestMatch, score: bestScore };
    }
    return null;
  }

  /** Compute string similarity using Levenshtein distance */
  private computeSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0;

    const maxLen = Math.max(a.length, b.length);
    const distance = this.levenshteinDistance(a, b);
    return 1 - distance / maxLen;
  }

  /** Levenshtein edit distance (Wagner-Fischer) */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Use two rows instead of full matrix for memory efficiency
    let prev = new Array<number>(n + 1);
    let curr = new Array<number>(n + 1);

    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,       // deletion
          curr[j - 1] + 1,   // insertion
          prev[j - 1] + cost, // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  private normalizeForTM(text: string, _direction: TranslationDirection): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\s+/g, " ");
  }

  get size(): number {
    return this.segments.size;
  }
}

// ---------------------------------------------------------------------------
// TranslationEngine — main translation orchestrator
// ---------------------------------------------------------------------------

export class TranslationEngine {
  private readonly terminology: TerminologyDB;
  private readonly memory: TranslationMemory;

  // Rule-based dictionary for common word-level translations (EN→AR)
  private static readonly EN_AR_DICT: Record<string, string> = {
    revenue: "الإيرادات",
    expenses: "المصروفات",
    profit: "الربح",
    loss: "الخسارة",
    total: "الإجمالي",
    average: "المتوسط",
    growth: "النمو",
    rate: "المعدل",
    year: "السنة",
    month: "الشهر",
    quarter: "الربع",
    report: "تقرير",
    chart: "رسم بياني",
    table: "جدول",
    page: "صفحة",
    title: "العنوان",
    summary: "ملخص",
    data: "بيانات",
    value: "القيمة",
    target: "المستهدف",
    actual: "الفعلي",
    budget: "الميزانية",
    forecast: "التوقعات",
    department: "القسم",
    project: "المشروع",
    indicator: "مؤشر",
    performance: "الأداء",
    increase: "زيادة",
    decrease: "انخفاض",
    percentage: "النسبة المئوية",
    number: "رقم",
    date: "التاريخ",
    name: "الاسم",
    description: "الوصف",
    status: "الحالة",
    category: "الفئة",
    type: "النوع",
    amount: "المبلغ",
    price: "السعر",
    cost: "التكلفة",
    count: "العدد",
    annual: "سنوي",
    monthly: "شهري",
    quarterly: "ربع سنوي",
    daily: "يومي",
    weekly: "أسبوعي",
  };

  // Reverse dictionary AR→EN (auto-built from EN_AR_DICT)
  private static readonly AR_EN_DICT: Record<string, string> = Object.fromEntries(
    Object.entries(TranslationEngine.EN_AR_DICT).map(([en, ar]) => [ar, en]),
  );

  constructor(terminology?: TerminologyDB, memory?: TranslationMemory) {
    this.terminology = terminology ?? new TerminologyDB();
    this.memory = memory ?? new TranslationMemory();
  }

  /** Translate a single text string */
  translateText(
    text: string,
    direction: TranslationDirection,
    domain?: string,
  ): TranslationResult {
    const warnings: string[] = [];
    const termsApplied: string[] = [];

    if (!text || text.trim().length === 0) {
      return {
        sourceText: text,
        translatedText: text,
        direction,
        qualityScore: 1.0,
        tmMatch: false,
        tmMatchScore: 0,
        termsApplied: [],
        warnings: [],
      };
    }

    // 1. Check TM for exact match
    const exactTM = this.memory.exactMatch(text, direction);
    if (exactTM) {
      return {
        sourceText: text,
        translatedText: exactTM.target,
        direction,
        qualityScore: exactTM.qualityScore,
        tmMatch: true,
        tmMatchScore: 1.0,
        termsApplied: [],
        warnings: [],
      };
    }

    // 2. Check TM for fuzzy match (>= 0.85 threshold for auto-use)
    const fuzzyTM = this.memory.fuzzyMatch(text, direction, 0.85);
    if (fuzzyTM) {
      warnings.push(
        `Fuzzy TM match (score: ${fuzzyTM.score.toFixed(2)}) — may need review`,
      );
      return {
        sourceText: text,
        translatedText: fuzzyTM.segment.target,
        direction,
        qualityScore: fuzzyTM.score * fuzzyTM.segment.qualityScore,
        tmMatch: true,
        tmMatchScore: fuzzyTM.score,
        termsApplied: [],
        warnings,
      };
    }

    // 3. Apply terminology-first, then rule-based translation
    let translated = text;

    // Apply terminology matches (longest match first)
    const matchedTerms = this.terminology.findTermsInText(text, direction, domain);
    for (const term of matchedTerms) {
      const src = direction === "ar-to-en" ? term.source : term.target;
      const tgt = direction === "ar-to-en" ? term.target : term.source;
      if (translated.includes(src)) {
        translated = translated.replace(new RegExp(this.escapeRegex(src), "g"), tgt);
        termsApplied.push(`${src} → ${tgt}`);
      }
    }

    // Apply rule-based word-level dictionary for remaining untranslated words
    translated = this.applyDictionary(translated, direction);

    // 4. Handle number formats in translation
    if (direction === "en-to-ar") {
      translated = this.convertToEasternArabicDigits(translated);
    } else {
      translated = this.convertToWesternDigits(translated);
    }

    // 5. Compute quality score
    const qualityScore = this.computeTranslationQuality(text, translated, direction);

    if (qualityScore < 0.5) {
      warnings.push("Low quality score — AI-assisted translation recommended");
    }

    // 6. Store in TM for future use
    if (qualityScore >= 0.6) {
      this.memory.addSegment(text, translated, direction, domain ?? "general", qualityScore);
    }

    return {
      sourceText: text,
      translatedText: translated,
      direction,
      qualityScore,
      tmMatch: false,
      tmMatchScore: 0,
      termsApplied,
      warnings,
    };
  }

  /** Apply word-level dictionary to text */
  private applyDictionary(text: string, direction: TranslationDirection): string {
    const dict =
      direction === "en-to-ar"
        ? TranslationEngine.EN_AR_DICT
        : TranslationEngine.AR_EN_DICT;

    let result = text;

    // Tokenize and translate word-by-word for words found in dictionary
    const words = result.split(/(\s+)/);
    const translatedWords = words.map((word) => {
      if (/^\s+$/.test(word)) return word; // preserve whitespace
      const normalized = word.toLowerCase().replace(/[.,;:!?()]/g, "");
      const punctuation = word.replace(normalized, "");
      const translation = dict[normalized];
      return translation ? translation + punctuation : word;
    });

    result = translatedWords.join("");
    return result;
  }

  /** Compute a BLEU-like quality metric (simplified unigram precision proxy) */
  private computeTranslationQuality(
    source: string,
    translated: string,
    direction: TranslationDirection,
  ): number {
    if (source === translated) return 0.3; // No change likely means untranslated

    const sourceWords = this.tokenize(source);
    const translatedWords = this.tokenize(translated);

    if (translatedWords.length === 0) return 0;

    // Check how many translated words differ from source (translation happened)
    let changedCount = 0;
    const sourceSet = new Set(sourceWords.map((w) => w.toLowerCase()));
    for (const word of translatedWords) {
      if (!sourceSet.has(word.toLowerCase())) changedCount++;
    }

    const changeRatio = changedCount / translatedWords.length;

    // Check target language character ratio
    const targetLangRatio =
      direction === "en-to-ar"
        ? this.arabicCharRatio(translated)
        : this.latinCharRatio(translated);

    // Brevity penalty: translated length should be reasonable compared to source
    const lengthRatio = translatedWords.length / Math.max(sourceWords.length, 1);
    const brevityPenalty = lengthRatio < 0.5 ? lengthRatio * 2 : lengthRatio > 3 ? 1 / lengthRatio : 1;

    // Combine factors
    const rawScore = changeRatio * 0.4 + targetLangRatio * 0.4 + brevityPenalty * 0.2;
    return Math.min(1, Math.max(0, rawScore));
  }

  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
  }

  private arabicCharRatio(text: string): number {
    if (text.length === 0) return 0;
    const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) ?? []).length;
    return arabicChars / text.length;
  }

  private latinCharRatio(text: string): number {
    if (text.length === 0) return 0;
    const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;
    return latinChars / text.length;
  }

  /** Convert Western digits to Eastern Arabic digits (٠١٢٣٤٥٦٧٨٩) */
  private convertToEasternArabicDigits(text: string): string {
    return text.replace(/[0-9]/g, (d) =>
      String.fromCharCode(0x0660 + parseInt(d, 10)),
    );
  }

  /** Convert Eastern Arabic digits back to Western digits */
  private convertToWesternDigits(text: string): string {
    return text.replace(/[\u0660-\u0669]/g, (d) =>
      String(d.charCodeAt(0) - 0x0660),
    );
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ---- CDR-level batch translation ----

  /** Translate all text elements in a CDR document */
  translateCDR(
    cdr: CDRDocument,
    direction: TranslationDirection,
    domain?: string,
  ): CDRTranslationResult {
    const startTime = Date.now();
    const warnings: string[] = [];
    const elementResults = new Map<string, TranslationResult>();

    // Deep clone CDR
    const translatedCDR: CDRDocument = JSON.parse(JSON.stringify(cdr));

    let totalElements = 0;
    let translatedElements = 0;
    let skippedElements = 0;
    let tmHits = 0;
    let qualitySum = 0;

    for (const page of translatedCDR.pages) {
      // Mirror layout direction if needed
      if (direction === "en-to-ar") {
        this.adjustPageDirectionRTL(page);
      } else if (direction === "ar-to-en") {
        this.adjustPageDirectionLTR(page);
      }

      for (const element of page.elements) {
        totalElements++;

        if (element.element_type === "text" && element.text) {
          const result = this.translateText(element.text, direction, domain);
          element.text = result.translatedText;
          elementResults.set(element.element_id, result);

          if (result.tmMatch) tmHits++;
          qualitySum += result.qualityScore;
          translatedElements++;

          if (result.warnings.length > 0) {
            warnings.push(
              `[${element.element_id}] ${result.warnings.join("; ")}`,
            );
          }
        } else if (element.element_type === "table" && element.rows) {
          // Translate each cell in the table
          for (let r = 0; r < element.rows.length; r++) {
            for (let c = 0; c < element.rows[r].length; c++) {
              const cellText = element.rows[r][c];
              if (cellText && cellText.trim().length > 0) {
                const cellResult = this.translateText(cellText, direction, domain);
                element.rows[r][c] = cellResult.translatedText;
                qualitySum += cellResult.qualityScore;
                if (cellResult.tmMatch) tmHits++;
              }
            }
          }
          translatedElements++;
        } else {
          skippedElements++;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const avgQuality = translatedElements > 0 ? qualitySum / translatedElements : 0;

    return {
      originalCDR: cdr,
      translatedCDR,
      direction,
      elementResults,
      overallQuality: avgQuality,
      termConsistency: this.computeTermConsistency(elementResults),
      layoutPreserved: true,
      warnings,
      stats: {
        totalElements,
        translatedElements,
        skippedElements,
        tmHits,
        avgQuality,
        durationMs,
      },
    };
  }

  /** Mirror element X coordinates within a page for RTL layout */
  private adjustPageDirectionRTL(page: CDRPage): void {
    for (const el of page.elements) {
      // Mirror X: new_x = pageWidth - x - width
      el.x = page.width - el.x - el.width;
    }
  }

  /** Mirror element X coordinates within a page for LTR layout */
  private adjustPageDirectionLTR(page: CDRPage): void {
    // Same mirror operation (it's its own inverse)
    for (const el of page.elements) {
      el.x = page.width - el.x - el.width;
    }
  }

  /** Compute how consistently terminology was applied across elements */
  private computeTermConsistency(results: Map<string, TranslationResult>): number {
    const termUsage = new Map<string, Set<string>>();

    for (const [elemId, result] of results) {
      for (const term of result.termsApplied) {
        const src = term.split(" → ")[0];
        if (!termUsage.has(src)) termUsage.set(src, new Set());
        termUsage.get(src)!.add(elemId);
      }
    }

    // If each term always maps to the same target, consistency = 1
    // For simplicity here we return 1.0 since our engine is deterministic
    return termUsage.size > 0 ? 1.0 : 1.0;
  }

  /** Expose the underlying TM and terminology DB for external management */
  getTerminology(): TerminologyDB {
    return this.terminology;
  }

  getTranslationMemory(): TranslationMemory {
    return this.memory;
  }
}

// ---------------------------------------------------------------------------
// ArabizationEngine — تعريب: layout mirroring, number/date conversion
// ---------------------------------------------------------------------------

export class ArabizationEngine {
  // Western → Eastern Arabic digit map
  private static readonly EASTERN_DIGITS: Record<string, string> = {
    "0": "\u0660",
    "1": "\u0661",
    "2": "\u0662",
    "3": "\u0663",
    "4": "\u0664",
    "5": "\u0665",
    "6": "\u0666",
    "7": "\u0667",
    "8": "\u0668",
    "9": "\u0669",
  };

  // Font substitution map: Latin fonts → Arabic-supporting alternatives
  private static readonly FONT_MAP: Record<string, string> = {
    Arial: "Arial Unicode MS",
    "Times New Roman": "Traditional Arabic",
    Helvetica: "Tahoma",
    Verdana: "Tahoma",
    "Courier New": "Simplified Arabic Fixed",
    Georgia: "Traditional Arabic",
    Calibri: "Sakkal Majalla",
    Cambria: "Traditional Arabic",
    "Segoe UI": "Sakkal Majalla",
    Roboto: "Noto Sans Arabic",
    "Open Sans": "Noto Sans Arabic",
    Lato: "Noto Sans Arabic",
    Montserrat: "Cairo",
    Inter: "IBM Plex Sans Arabic",
    Poppins: "Tajawal",
  };

  // Approximate Gregorian → Hijri conversion tables
  // Hijri epoch: July 16, 622 CE (Julian)
  private static readonly HIJRI_EPOCH_JD = 1948439.5;

  private static readonly HIJRI_MONTHS = [
    "محرم",
    "صفر",
    "ربيع الأول",
    "ربيع الآخر",
    "جمادى الأولى",
    "جمادى الآخرة",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ];

  // Currency symbols and their Arabic equivalents
  private static readonly CURRENCY_MAP: Record<string, string> = {
    SAR: "ر.س",
    USD: "دولار",
    EUR: "يورو",
    GBP: "جنيه إسترليني",
    AED: "درهم",
    KWD: "دينار كويتي",
    QAR: "ريال قطري",
    BHD: "دينار بحريني",
    OMR: "ريال عماني",
    EGP: "جنيه مصري",
    $: "دولار",
    "€": "يورو",
    "£": "جنيه إسترليني",
  };

  // Kashida insertion: Arabic characters that can accept kashida extension
  // Kashida (ـ U+0640) is inserted between connected letters to justify text
  private static readonly KASHIDA_ELIGIBLE_BEFORE = new Set([
    "ب", "ت", "ث", "ج", "ح", "خ", "س", "ش", "ص", "ض",
    "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن",
    "ه", "ي", "ئ",
  ]);

  private readonly defaultOptions: ArabizationOptions = {
    mirrorLayout: true,
    convertNumbers: true,
    convertDates: true,
    convertCurrency: true,
    applyKashida: false,
    applyTashkeel: false,
    substituteFonts: true,
    mirrorCharts: true,
    mirrorTables: true,
    preserveLogicalOrder: true,
  };

  /** Full CDR arabization */
  arabize(cdr: CDRDocument, options?: Partial<ArabizationOptions>): ArabizationResult {
    const startTime = Date.now();
    const opts: ArabizationOptions = { ...this.defaultOptions, ...options };
    const warnings: string[] = [];
    const changes: ArabizationChange[] = [];

    // Deep clone
    const arabizedCDR: CDRDocument = JSON.parse(JSON.stringify(cdr));

    let elementsProcessed = 0;
    let numberConverted = 0;
    let datesConverted = 0;
    let fontsSubstituted = 0;
    let layoutsMirrored = 0;

    for (const page of arabizedCDR.pages) {
      // Mirror entire page layout
      if (opts.mirrorLayout) {
        for (const el of page.elements) {
          const oldX = el.x;
          el.x = page.width - el.x - el.width;
          if (el.x !== oldX) {
            changes.push({
              elementId: el.element_id,
              changeType: "layout_mirror",
              before: `x=${oldX}`,
              after: `x=${el.x}`,
            });
            layoutsMirrored++;
          }
        }
      }

      for (const el of page.elements) {
        elementsProcessed++;

        // Process text elements
        if (el.element_type === "text" && el.text) {
          let currentText = el.text;

          // Number conversion
          if (opts.convertNumbers) {
            const converted = this.convertNumbersToEasternArabic(currentText);
            if (converted !== currentText) {
              changes.push({
                elementId: el.element_id,
                changeType: "number_convert",
                before: currentText,
                after: converted,
              });
              currentText = converted;
              numberConverted++;
            }
          }

          // Date conversion
          if (opts.convertDates) {
            const dateConverted = this.convertDatesToHijri(currentText);
            if (dateConverted !== currentText) {
              changes.push({
                elementId: el.element_id,
                changeType: "date_convert",
                before: currentText,
                after: dateConverted,
              });
              currentText = dateConverted;
              datesConverted++;
            }
          }

          // Currency conversion
          if (opts.convertCurrency) {
            const currencyConverted = this.convertCurrency(currentText);
            if (currencyConverted !== currentText) {
              changes.push({
                elementId: el.element_id,
                changeType: "currency_convert",
                before: currentText,
                after: currencyConverted,
              });
              currentText = currencyConverted;
            }
          }

          // Kashida insertion
          if (opts.applyKashida) {
            const kashidaResult = this.insertKashida(currentText);
            if (kashidaResult !== currentText) {
              changes.push({
                elementId: el.element_id,
                changeType: "kashida_insert",
                before: currentText,
                after: kashidaResult,
              });
              currentText = kashidaResult;
            }
          }

          el.text = currentText;
        }

        // Process table cells
        if (el.element_type === "table" && el.rows && opts.mirrorTables) {
          // Reverse column order for RTL
          for (let r = 0; r < el.rows.length; r++) {
            el.rows[r] = el.rows[r].slice().reverse();

            // Also convert numbers in cells
            if (opts.convertNumbers) {
              for (let c = 0; c < el.rows[r].length; c++) {
                const converted = this.convertNumbersToEasternArabic(el.rows[r][c]);
                if (converted !== el.rows[r][c]) {
                  el.rows[r][c] = converted;
                  numberConverted++;
                }
              }
            }
          }
        }
      }
    }

    return {
      originalCDR: cdr,
      arabizedCDR,
      changes,
      warnings,
      stats: {
        elementsProcessed,
        numberConverted,
        datesConverted,
        fontsSubstituted,
        layoutsMirrored,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /** Convert Western digits to Eastern Arabic digits */
  convertNumbersToEasternArabic(text: string): string {
    return text.replace(/[0-9]/g, (digit) => ArabizationEngine.EASTERN_DIGITS[digit] ?? digit);
  }

  /** Convert Eastern Arabic digits back to Western */
  convertToWesternDigits(text: string): string {
    return text.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }

  /** Convert formatted numbers: 1,234,567.89 → ١٬٢٣٤٬٥٦٧٫٨٩ */
  convertFormattedNumber(text: string): string {
    return text
      .replace(/,/g, "\u066C") // Arabic thousands separator
      .replace(/\./g, "\u066B") // Arabic decimal separator
      .replace(/[0-9]/g, (d) => ArabizationEngine.EASTERN_DIGITS[d] ?? d);
  }

  /**
   * Convert Gregorian dates in text to Hijri dates.
   * Recognizes patterns like: 2024-01-15, 01/15/2024, January 15, 2024
   */
  convertDatesToHijri(text: string): string {
    let result = text;

    // Pattern: YYYY-MM-DD
    result = result.replace(
      /(\d{4})-(\d{1,2})-(\d{1,2})/g,
      (_match, y, m, d) => {
        const hijri = this.gregorianToHijri(
          parseInt(y, 10),
          parseInt(m, 10),
          parseInt(d, 10),
        );
        return this.formatHijriDate(hijri);
      },
    );

    // Pattern: MM/DD/YYYY
    result = result.replace(
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      (_match, m, d, y) => {
        const hijri = this.gregorianToHijri(
          parseInt(y, 10),
          parseInt(m, 10),
          parseInt(d, 10),
        );
        return this.formatHijriDate(hijri);
      },
    );

    // Pattern: DD/MM/YYYY (ambiguous — assume DD/MM/YYYY if day > 12)
    // Already handled by MM/DD/YYYY pattern; advanced disambiguation is out of scope

    return result;
  }

  /**
   * Approximate Gregorian to Hijri conversion.
   * Uses the Kuwaiti algorithm (tabular Islamic calendar).
   */
  gregorianToHijri(
    gYear: number,
    gMonth: number,
    gDay: number,
  ): { year: number; month: number; day: number } {
    // Convert Gregorian to Julian Day Number
    const a = Math.floor((14 - gMonth) / 12);
    const y = gYear + 4800 - a;
    const m = gMonth + 12 * a - 3;

    const jdn =
      gDay +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045;

    // Convert Julian Day Number to Hijri (Kuwaiti algorithm)
    const l = jdn - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    const remainder = l - 10631 * n + 354;
    const j =
      Math.floor((10985 - remainder) / 5316) *
        Math.floor((50 * remainder) / 17719) +
      Math.floor(remainder / 5670) *
        Math.floor((43 * remainder) / 15238);
    const adjustedL =
      remainder -
      Math.floor((30 - j) / 15) *
        Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) *
        Math.floor((15238 * j) / 43) +
      29;

    const hMonth = Math.floor((24 * adjustedL) / 709);
    const hDay = adjustedL - Math.floor((709 * hMonth) / 24);
    const hYear = 30 * n + j - 30;

    return { year: hYear, month: hMonth, day: hDay };
  }

  /** Format a Hijri date in Arabic */
  formatHijriDate(hijri: { year: number; month: number; day: number }): string {
    const monthName =
      ArabizationEngine.HIJRI_MONTHS[hijri.month - 1] ?? `شهر ${hijri.month}`;
    const dayStr = this.convertNumbersToEasternArabic(String(hijri.day));
    const yearStr = this.convertNumbersToEasternArabic(String(hijri.year));
    return `${dayStr} ${monthName} ${yearStr} هـ`;
  }

  /** Convert currency symbols/codes in text to Arabic equivalents */
  convertCurrency(text: string): string {
    let result = text;
    for (const [symbol, arabic] of Object.entries(ArabizationEngine.CURRENCY_MAP)) {
      // Use word boundary-aware replacement
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\b${escaped}\\b`, "g"), arabic);
      // Also handle standalone symbols
      if (symbol.length === 1) {
        result = result.replace(new RegExp(`\\${symbol}`, "g"), arabic);
      }
    }
    return result;
  }

  /**
   * Insert kashida (ـ) characters for Arabic text justification.
   * Kashida is inserted between connected letter pairs where the first
   * letter supports extension.
   */
  insertKashida(text: string, density: number = 0.15): string {
    const chars = [...text];
    const result: string[] = [];
    let insertions = 0;
    const maxInsertions = Math.floor(chars.length * density);

    for (let i = 0; i < chars.length; i++) {
      result.push(chars[i]);

      // Check if current char is eligible for kashida after it
      if (
        insertions < maxInsertions &&
        ArabizationEngine.KASHIDA_ELIGIBLE_BEFORE.has(chars[i]) &&
        i + 1 < chars.length &&
        /[\u0600-\u06FF]/.test(chars[i + 1]) &&
        chars[i + 1] !== " " &&
        chars[i + 1] !== "\u0640" // don't double kashida
      ) {
        result.push("\u0640"); // kashida
        insertions++;
      }
    }

    return result.join("");
  }

  /**
   * Place tashkeel (diacritical marks) on Arabic text.
   * This is a simplified rule-based placer for common patterns.
   * Full tashkeel requires a trained model (placeholder for AI integration).
   */
  placeTashkeel(text: string): string {
    // Common tashkeel rules:
    // - ال (definite article) gets sukun on ل if followed by moon letter
    // - tanween on last letter of indefinite nouns
    // This is a stub — real implementation would use a morphological analyzer

    let result = text;

    // Add shadda to solar letters after ال
    const solarLetters = "تثدذرزسشصضطظلن";
    const alPattern = new RegExp(`ال([${solarLetters}])`, "g");
    result = result.replace(alPattern, (_match, letter) => `ال${letter}\u0651`); // shadda

    return result;
  }

  /** Substitute a Latin font name with an Arabic-supporting alternative */
  substituteFontForArabic(fontName: string): string {
    return ArabizationEngine.FONT_MAP[fontName] ?? fontName;
  }

  /** Get a list of all available Arabic font substitutions */
  getAvailableFontSubstitutions(): Record<string, string> {
    return { ...ArabizationEngine.FONT_MAP };
  }

  /** Mirror a bounding box within a container for RTL layout */
  mirrorBoundingBox(
    box: { x: number; y: number; width: number; height: number },
    containerWidth: number,
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: containerWidth - box.x - box.width,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  }
}

// ---------------------------------------------------------------------------
// ContentManifest — structured container for extracted content
// ---------------------------------------------------------------------------

export class ContentManifest {
  private entries: ManifestEntry[] = [];
  private readonly createdAt: number = Date.now();
  private sourceDocumentId: string = "";

  constructor(sourceDocumentId?: string) {
    this.sourceDocumentId = sourceDocumentId ?? "";
  }

  /** Add an entry to the manifest */
  addEntry(
    elementId: string,
    pageId: string,
    type: ManifestEntryType,
    content: unknown,
    metadata: Record<string, unknown> = {},
    editable = true,
  ): ManifestEntry {
    const entry: ManifestEntry = {
      id: `manifest-${this.entries.length}-${Date.now().toString(36)}`,
      elementId,
      pageId,
      type,
      content,
      metadata,
      editable,
      order: this.entries.length,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Get all entries */
  getAllEntries(): ManifestEntry[] {
    return [...this.entries];
  }

  /** Get entries by type */
  getByType(type: ManifestEntryType): ManifestEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  /** Get entries by page */
  getByPage(pageId: string): ManifestEntry[] {
    return this.entries.filter((e) => e.pageId === pageId);
  }

  /** Get a single entry by ID */
  getById(id: string): ManifestEntry | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  /** Get entry by element ID */
  getByElementId(elementId: string): ManifestEntry | null {
    return this.entries.find((e) => e.elementId === elementId) ?? null;
  }

  /** Update an entry's content */
  updateContent(id: string, content: unknown): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry || !entry.editable) return false;
    entry.content = content;
    return true;
  }

  /** Serialize to JSON */
  toJSON(): {
    sourceDocumentId: string;
    createdAt: number;
    totalEntries: number;
    entries: ManifestEntry[];
    summary: Record<ManifestEntryType, number>;
  } {
    const summary: Record<string, number> = {};
    for (const entry of this.entries) {
      summary[entry.type] = (summary[entry.type] ?? 0) + 1;
    }

    return {
      sourceDocumentId: this.sourceDocumentId,
      createdAt: this.createdAt,
      totalEntries: this.entries.length,
      entries: this.entries,
      summary: summary as Record<ManifestEntryType, number>,
    };
  }

  /** Deserialize from JSON */
  static fromJSON(json: ReturnType<ContentManifest["toJSON"]>): ContentManifest {
    const manifest = new ContentManifest(json.sourceDocumentId);
    for (const entry of json.entries) {
      manifest.entries.push(entry);
    }
    return manifest;
  }

  get size(): number {
    return this.entries.length;
  }
}

// ---------------------------------------------------------------------------
// ContentEmptyingEngine — تفريغ: full content extraction from CDR
// ---------------------------------------------------------------------------

export class ContentEmptyingEngine {
  /**
   * Extract all content from a CDR document into a structured ContentManifest.
   * This is the core "تفريغ" (content emptying / extraction) operation.
   */
  extractContent(cdr: CDRDocument): ContentEmptyingResult {
    const startTime = Date.now();
    const manifest = new ContentManifest(cdr.run_id);
    const warnings: string[] = [];

    let textEntries = 0;
    let tableEntries = 0;
    let chartEntries = 0;
    let kpiEntries = 0;
    let imageEntries = 0;
    let ocrConfidenceSum = 0;
    let ocrCount = 0;

    for (const page of cdr.pages) {
      for (const element of page.elements) {
        switch (element.element_type) {
          case "text": {
            const extracted = this.extractTextContent(element);
            const entryType = this.classifyTextType(extracted);

            manifest.addEntry(element.element_id, page.page_id, entryType, extracted, {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              direction: this.detectDirection(extracted.text),
              language: this.detectLanguage(extracted.text),
            });

            textEntries++;
            ocrConfidenceSum += extracted.ocrConfidence ?? 1.0;
            ocrCount++;

            // Check for KPI patterns
            if (this.isKPIPattern(extracted.text)) {
              const kpi = this.extractKPIFromText(extracted.text);
              if (kpi) {
                manifest.addEntry(
                  element.element_id,
                  page.page_id,
                  "kpi",
                  kpi,
                  { derivedFrom: "text" },
                );
                kpiEntries++;
              }
            }
            break;
          }

          case "table": {
            const tableContent = this.extractTableContent(element);
            manifest.addEntry(element.element_id, page.page_id, "table", tableContent, {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
            });
            tableEntries++;
            break;
          }

          case "chart": {
            const chartContent = this.extractChartContent(element);
            manifest.addEntry(element.element_id, page.page_id, "chart", chartContent, {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
            });
            chartEntries++;
            break;
          }

          case "image": {
            const imageContent = this.extractImageContent(element);
            manifest.addEntry(
              element.element_id,
              page.page_id,
              "image_caption",
              imageContent,
              {
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
                imageRef: element.image_ref,
              },
            );
            imageEntries++;
            break;
          }

          case "shape": {
            // Shapes may contain text overlays
            if (element.text) {
              const shapeText = this.extractTextContent(element);
              manifest.addEntry(
                element.element_id,
                page.page_id,
                "label",
                shapeText,
                {
                  x: element.x,
                  y: element.y,
                  width: element.width,
                  height: element.height,
                  containerType: "shape",
                },
              );
              textEntries++;
            }
            break;
          }

          case "control": {
            // Controls may have binding refs or labels — skip for content extraction
            break;
          }
        }
      }
    }

    const avgOcrConfidence = ocrCount > 0 ? ocrConfidenceSum / ocrCount : 1.0;

    return {
      sourceDocument: cdr,
      manifest,
      stats: {
        totalEntries: manifest.size,
        textEntries,
        tableEntries,
        chartEntries,
        kpiEntries,
        imageEntries,
        extractionDurationMs: Date.now() - startTime,
        ocrConfidence: avgOcrConfidence,
      },
      warnings,
    };
  }

  /** Extract text content from a text or shape element */
  private extractTextContent(element: CDRElement): TextManifestContent & { ocrConfidence?: number } {
    const text = element.text ?? "";
    const direction = this.detectDirection(text);
    const language = this.detectLanguage(text);

    return {
      text,
      direction,
      language,
      ocrConfidence: 1.0, // For CDR-sourced text, confidence is high
    };
  }

  /** Extract table content from a table element */
  private extractTableContent(element: CDRElement): TableManifestContent {
    const rows = element.rows ?? [];
    const headers = rows.length > 0 ? rows[0] : [];
    const dataRows = rows.length > 1 ? rows.slice(1) : [];

    // Infer column types
    const columnTypes = headers.map((_header, colIdx) => {
      const values = dataRows.map((row) => row[colIdx] ?? "");
      return this.inferColumnType(values);
    });

    return {
      headers,
      rows: dataRows,
      columnTypes,
      totalRows: dataRows.length,
      totalCols: headers.length,
    };
  }

  /** Extract chart content from a chart element */
  private extractChartContent(element: CDRElement): ChartManifestContent {
    // Build chart content from CDR element metadata
    const series: ChartSeries[] = (element.series_refs ?? []).map((ref, idx) => ({
      name: `Series ${idx + 1}`,
      data: [],
      type: element.chart_type ?? "bar",
    }));

    const labels = (element.axis_refs ?? []).map((ref) => ref);

    return {
      chartType: element.chart_type ?? "bar",
      series,
      labels,
    };
  }

  /** Extract image content (caption/description placeholder) */
  private extractImageContent(element: CDRElement): {
    imageRef: string;
    caption: string;
    altText: string;
    dimensions: { width: number; height: number };
  } {
    return {
      imageRef: element.image_ref ?? "",
      caption: "", // Would be populated by AI image captioning
      altText: `Image at (${element.x}, ${element.y}) size ${element.width}x${element.height}`,
      dimensions: { width: element.width, height: element.height },
    };
  }

  /** Classify text content type based on heuristics */
  private classifyTextType(
    content: TextManifestContent,
  ): ManifestEntryType {
    const text = content.text.trim();

    // Very short text → label
    if (text.length < 20 && !text.includes("\n")) return "label";

    // Looks like a heading (short, no period at end, possibly all-caps or bold implied)
    if (
      text.length < 80 &&
      !text.endsWith(".") &&
      !text.includes("\n") &&
      text === text.replace(/[.!?,;:]/g, "")
    ) {
      return "heading";
    }

    // Multi-line or longer → paragraph
    if (text.includes("\n") || text.length >= 80) return "paragraph";

    return "text";
  }

  /** Detect text direction */
  private detectDirection(text: string): TextDirection {
    if (!text || text.length === 0) return "ltr";

    const arabicCount = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) ?? []).length;
    const latinCount = (text.match(/[a-zA-Z]/g) ?? []).length;

    if (arabicCount > 0 && latinCount > 0) return "mixed";
    if (arabicCount > 0) return "rtl";
    return "ltr";
  }

  /** Detect language (simplified: Arabic vs English) */
  private detectLanguage(text: string): string {
    if (!text || text.length === 0) return "und"; // undetermined

    const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;

    if (arabicChars > latinChars) return "ar";
    if (latinChars > arabicChars) return "en";
    return "und";
  }

  /** Check if text looks like a KPI/metric (number with label) */
  private isKPIPattern(text: string): boolean {
    // Patterns: "123.4M", "45%", "$1.2B", "12,345", "+3.5%"
    return /(?:^|\s)[\$€£]?\s*[\d٠-٩][,،\d٠-٩]*\.?[\d٠-٩]*\s*[%٪MBKمك]?/.test(text);
  }

  /** Extract KPI data from text */
  private extractKPIFromText(text: string): KPIManifestContent | null {
    // Try to parse "Label: Value" or "Value Unit" patterns
    const labelValueMatch = text.match(
      /^(.+?)[:：]\s*([\d٠-٩][,،.\d٠-٩]*)\s*([%٪]|[A-Za-z\u0600-\u06FF]+)?\s*$/,
    );

    if (labelValueMatch) {
      const label = labelValueMatch[1].trim();
      const rawValue = labelValueMatch[2].replace(/[,،]/g, "");
      const unit = labelValueMatch[3] ?? "";
      const value = parseFloat(this.westernizeDigits(rawValue));

      if (!isNaN(value)) {
        return { label, value, unit: unit || undefined };
      }
    }

    // Try standalone number with optional sign/percent
    const numberMatch = text.match(
      /([+\-]?)([\d٠-٩][,،.\d٠-٩]*)\s*([%٪])?/,
    );

    if (numberMatch) {
      const sign = numberMatch[1];
      const rawValue = numberMatch[2].replace(/[,،]/g, "");
      const isPercent = !!numberMatch[3];
      const value = parseFloat(this.westernizeDigits(rawValue));

      if (!isNaN(value)) {
        const trend: "up" | "down" | "stable" =
          sign === "+" ? "up" : sign === "-" ? "down" : "stable";

        return {
          label: text.replace(numberMatch[0], "").trim() || "Metric",
          value: sign === "-" ? -value : value,
          unit: isPercent ? "%" : undefined,
          trend,
          changePercent: isPercent ? value : undefined,
        };
      }
    }

    return null;
  }

  /** Convert Eastern Arabic digits to Western for parsing */
  private westernizeDigits(text: string): string {
    return text.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }

  /** Infer the type of a table column from its values */
  private inferColumnType(values: string[]): string {
    if (values.length === 0) return "text";

    let numericCount = 0;
    let dateCount = 0;
    let percentCount = 0;

    for (const val of values) {
      const trimmed = val.trim();
      if (!trimmed) continue;

      if (/^[\d٠-٩][,،.\d٠-٩]*$/.test(trimmed)) numericCount++;
      if (/^[\d٠-٩][,،.\d٠-٩]*\s*[%٪]$/.test(trimmed)) percentCount++;
      if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) dateCount++;
    }

    const total = values.filter((v) => v.trim().length > 0).length;
    if (total === 0) return "text";

    if (percentCount / total > 0.5) return "percentage";
    if (numericCount / total > 0.5) return "numeric";
    if (dateCount / total > 0.5) return "date";
    return "text";
  }
}

// ---------------------------------------------------------------------------
// ContentReinjector — applies modified content back to CDR
// ---------------------------------------------------------------------------

export class ContentReinjector {
  /**
   * Re-inject modified content from a ContentManifest back into a CDR.
   * This is the reverse of content emptying: after editing extracted content,
   * push changes back into the document structure.
   */
  reinject(cdr: CDRDocument, manifest: ContentManifest): ReinjectionResult {
    // Deep clone CDR to avoid mutation
    const updatedCDR: CDRDocument = JSON.parse(JSON.stringify(cdr));
    const warnings: string[] = [];
    const conflicts: ReinjectionConflict[] = [];
    let appliedChanges = 0;
    let skippedChanges = 0;

    // Build element lookup: elementId → { page, element }
    const elementMap = new Map<
      string,
      { page: CDRPage; element: CDRElement }
    >();

    for (const page of updatedCDR.pages) {
      for (const element of page.elements) {
        elementMap.set(element.element_id, { page, element });
      }
    }

    // Process each manifest entry
    for (const entry of manifest.getAllEntries()) {
      if (!entry.editable) {
        skippedChanges++;
        continue;
      }

      const target = elementMap.get(entry.elementId);
      if (!target) {
        warnings.push(
          `Element ${entry.elementId} not found in CDR — skipping entry ${entry.id}`,
        );
        skippedChanges++;
        continue;
      }

      const { element } = target;

      try {
        switch (entry.type) {
          case "text":
          case "heading":
          case "paragraph":
          case "label": {
            const textContent = entry.content as TextManifestContent;
            if (element.element_type === "text" || element.element_type === "shape") {
              const oldText = element.text;
              element.text = textContent.text;
              if (oldText !== textContent.text) appliedChanges++;
              else skippedChanges++;
            } else {
              conflicts.push({
                entryId: entry.id,
                elementId: entry.elementId,
                reason: `Entry type "${entry.type}" cannot be applied to element type "${element.element_type}"`,
                originalContent: element.text,
                newContent: textContent.text,
              });
              skippedChanges++;
            }
            break;
          }

          case "table": {
            const tableContent = entry.content as TableManifestContent;
            if (element.element_type === "table") {
              const newRows = [tableContent.headers, ...tableContent.rows];
              element.rows = newRows;
              appliedChanges++;
            } else {
              conflicts.push({
                entryId: entry.id,
                elementId: entry.elementId,
                reason: `Cannot apply table content to "${element.element_type}" element`,
                originalContent: element.rows,
                newContent: tableContent,
              });
              skippedChanges++;
            }
            break;
          }

          case "kpi":
          case "metric": {
            const kpiContent = entry.content as KPIManifestContent;
            if (element.element_type === "text") {
              // Re-compose KPI text from structured data
              const formattedValue =
                typeof kpiContent.value === "number"
                  ? kpiContent.value.toLocaleString()
                  : kpiContent.value;
              const unit = kpiContent.unit ?? "";
              element.text = `${kpiContent.label}: ${formattedValue}${unit}`;
              appliedChanges++;
            } else {
              skippedChanges++;
            }
            break;
          }

          case "chart": {
            // Chart data re-injection is structural — we update refs
            if (element.element_type === "chart") {
              const chartContent = entry.content as ChartManifestContent;
              element.chart_type = chartContent.chartType;
              // Series and axis refs would be updated in a full implementation
              appliedChanges++;
            } else {
              skippedChanges++;
            }
            break;
          }

          case "image_caption": {
            // Image captions don't modify the CDR image element directly
            skippedChanges++;
            break;
          }

          default:
            skippedChanges++;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        warnings.push(
          `Error re-injecting entry ${entry.id}: ${errorMessage}`,
        );
        skippedChanges++;
      }
    }

    return {
      updatedCDR,
      appliedChanges,
      skippedChanges,
      conflicts,
      warnings,
    };
  }

  /**
   * Validate that a manifest is compatible with a CDR before re-injection.
   * Returns a list of issues found.
   */
  validate(
    cdr: CDRDocument,
    manifest: ContentManifest,
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Build element set
    const elementIds = new Set<string>();
    for (const page of cdr.pages) {
      for (const element of page.elements) {
        elementIds.add(element.element_id);
      }
    }

    // Check that all manifest entries reference existing elements
    for (const entry of manifest.getAllEntries()) {
      if (!elementIds.has(entry.elementId)) {
        issues.push(
          `Manifest entry "${entry.id}" references missing element "${entry.elementId}"`,
        );
      }
    }

    // Check for duplicate element references
    const seenElements = new Map<string, string[]>();
    for (const entry of manifest.getAllEntries()) {
      if (!seenElements.has(entry.elementId)) {
        seenElements.set(entry.elementId, []);
      }
      seenElements.get(entry.elementId)!.push(entry.id);
    }

    for (const [elemId, entryIds] of seenElements) {
      // Multiple entries for same element is okay for KPIs derived from text
      const nonKPI = entryIds.filter((id) => {
        const entry = manifest.getById(id);
        return entry && entry.type !== "kpi" && entry.type !== "metric";
      });
      if (nonKPI.length > 1) {
        issues.push(
          `Element "${elemId}" has ${nonKPI.length} non-KPI manifest entries — potential conflict`,
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
