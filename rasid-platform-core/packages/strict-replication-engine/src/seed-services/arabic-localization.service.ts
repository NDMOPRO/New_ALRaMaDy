/**
 * Arabic Localization Service — Adapted from Seed
 *
 * Handles Arabic text processing: RTL layout, kashida, tashkeel,
 * font selection, number formatting, and bidirectional text.
 *
 * Original: 04_strict_fidelity_kernel/services/replication-service/src/services/arabic-localization.service.ts
 */

import type { BoundingBox, LayoutNode } from "@rasid/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArabicTextConfig {
  enableKashida: boolean;
  enableTashkeel: boolean;
  enableLigatures: boolean;
  numberFormat: "arabic" | "eastern" | "western";
  calendarType: "hijri" | "gregorian";
  preferredFonts: string[];
  fallbackFonts: string[];
  lineHeightMultiplier: number;
  wordSpacingAdjust: number;
}

export interface TextShapingResult {
  shapedText: string;
  direction: "rtl" | "ltr" | "mixed";
  segments: TextSegment[];
  kashidaPositions: number[];
  ligatures: LigatureInfo[];
  width: number;
  height: number;
}

export interface TextSegment {
  text: string;
  start: number;
  end: number;
  direction: "rtl" | "ltr";
  script: "arabic" | "latin" | "number" | "punctuation";
  font: string;
}

export interface LigatureInfo {
  chars: string;
  position: number;
  type: "mandatory" | "optional" | "kashida";
}

export interface FontRecommendation {
  primary: string;
  fallbacks: string[];
  weight: number;
  style: "normal" | "italic";
  features: string[];
  reason: string;
}

export interface NumberFormatResult {
  formatted: string;
  digits: "arabic" | "eastern" | "western";
  direction: "rtl" | "ltr";
  groupSeparator: string;
  decimalSeparator: string;
}

export interface DateFormatResult {
  formatted: string;
  calendar: "hijri" | "gregorian";
  direction: "rtl";
  components: {
    day: string;
    month: string;
    year: string;
    monthName: string;
  };
}

export interface BiDiAnalysis {
  overallDirection: "rtl" | "ltr" | "mixed";
  segments: BiDiSegment[];
  embeddingLevels: number[];
  needsExplicitMarks: boolean;
  suggestedMarks: BiDiMark[];
}

export interface BiDiSegment {
  text: string;
  direction: "rtl" | "ltr";
  level: number;
  start: number;
  end: number;
}

export interface BiDiMark {
  position: number;
  mark: "\u200F" | "\u200E" | "\u202B" | "\u202A" | "\u202C";
  reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const TASHKEEL_RANGE = /[\u064B-\u065F\u0670]/;
const KASHIDA = "\u0640";
const EASTERN_DIGITS: Record<string, string> = {
  "0": "\u0660", "1": "\u0661", "2": "\u0662", "3": "\u0663", "4": "\u0664",
  "5": "\u0665", "6": "\u0666", "7": "\u0667", "8": "\u0668", "9": "\u0669",
};
const WESTERN_FROM_EASTERN: Record<string, string> = Object.fromEntries(
  Object.entries(EASTERN_DIGITS).map(([w, e]) => [e, w])
);

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const GREGORIAN_MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const ARABIC_FONTS_PRIORITY = [
  "Cairo", "Tajawal", "Noto Naskh Arabic", "Amiri",
  "IBM Plex Arabic", "Almarai", "Scheherazade New",
  "Noto Sans Arabic", "Droid Arabic Naskh",
];

// Kashida insertion points (after these character forms)
const KASHIDA_ELIGIBLE = new Set([
  "\u0628", "\u062A", "\u062B", "\u062C", "\u062D", "\u062E",
  "\u0633", "\u0634", "\u0635", "\u0636", "\u0637", "\u0638",
  "\u0639", "\u063A", "\u0641", "\u0642", "\u0643", "\u0644",
  "\u0645", "\u0646", "\u0647", "\u064A",
]);

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ArabicTextConfig = {
  enableKashida: true,
  enableTashkeel: true,
  enableLigatures: true,
  numberFormat: "arabic",
  calendarType: "hijri",
  preferredFonts: ["Cairo", "Tajawal"],
  fallbackFonts: ["Noto Naskh Arabic", "Arial"],
  lineHeightMultiplier: 1.8,
  wordSpacingAdjust: 0.05,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ArabicLocalizationService {
  private config: ArabicTextConfig;

  constructor(config?: Partial<ArabicTextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Shape Arabic text for rendering.
   */
  shapeText(text: string, maxWidth?: number): TextShapingResult {
    const segments = this.segmentText(text);
    let shapedText = text;

    // Apply ligatures
    const ligatures: LigatureInfo[] = [];
    if (this.config.enableLigatures) {
      const ligResult = this.applyLigatures(shapedText);
      shapedText = ligResult.text;
      ligatures.push(...ligResult.ligatures);
    }

    // Calculate kashida positions for justified text
    const kashidaPositions: number[] = [];
    if (this.config.enableKashida && maxWidth) {
      const positions = this.calculateKashidaPositions(shapedText);
      kashidaPositions.push(...positions);
    }

    // Remove tashkeel if disabled
    if (!this.config.enableTashkeel) {
      shapedText = this.removeTashkeel(shapedText);
    }

    const direction = this.detectDirection(text);

    return {
      shapedText,
      direction,
      segments,
      kashidaPositions,
      ligatures,
      width: this.estimateTextWidth(shapedText),
      height: this.estimateTextHeight(shapedText),
    };
  }

  /**
   * Segment text into directional runs.
   */
  segmentText(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentSegment: Partial<TextSegment> | null = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const script = this.classifyChar(char);
      const direction = script === "arabic" ? "rtl" : script === "latin" ? "ltr" : currentSegment?.direction || "rtl";

      if (!currentSegment || currentSegment.direction !== direction || currentSegment.script !== script) {
        if (currentSegment) {
          segments.push(currentSegment as TextSegment);
        }
        currentSegment = {
          text: char,
          start: i,
          end: i + 1,
          direction,
          script,
          font: script === "arabic" ? this.config.preferredFonts[0] : this.config.fallbackFonts[0],
        };
      } else {
        currentSegment.text += char;
        currentSegment.end = i + 1;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment as TextSegment);
    }

    return segments;
  }

  /**
   * Analyze bidirectional text.
   */
  analyzeBiDi(text: string): BiDiAnalysis {
    const segments = this.segmentText(text);
    const biDiSegments: BiDiSegment[] = segments.map((s, idx) => ({
      text: s.text,
      direction: s.direction,
      level: s.direction === "rtl" ? 1 : 0,
      start: s.start,
      end: s.end,
    }));

    const hasRTL = segments.some((s) => s.direction === "rtl");
    const hasLTR = segments.some((s) => s.direction === "ltr");
    const overallDirection = hasRTL && hasLTR ? "mixed" : hasRTL ? "rtl" : "ltr";

    const suggestedMarks: BiDiMark[] = [];
    if (overallDirection === "mixed") {
      for (let i = 1; i < segments.length; i++) {
        if (segments[i].direction !== segments[i - 1].direction) {
          suggestedMarks.push({
            position: segments[i].start,
            mark: segments[i].direction === "rtl" ? "\u200F" : "\u200E",
            reason: `Direction change at position ${segments[i].start}`,
          });
        }
      }
    }

    return {
      overallDirection,
      segments: biDiSegments,
      embeddingLevels: text.split("").map((c) => (ARABIC_RANGE.test(c) ? 1 : 0)),
      needsExplicitMarks: overallDirection === "mixed",
      suggestedMarks,
    };
  }

  /**
   * Format a number according to Arabic conventions.
   */
  formatNumber(value: number, options?: { digits?: "arabic" | "eastern" | "western"; decimals?: number }): NumberFormatResult {
    const digits = options?.digits || this.config.numberFormat;
    const decimals = options?.decimals ?? 2;

    let formatted = value.toFixed(decimals);
    const groupSeparator = digits === "western" ? "," : "\u066C";
    const decimalSeparator = digits === "western" ? "." : "\u066B";

    // Add group separators
    const [intPart, decPart] = formatted.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
    formatted = decPart ? `${grouped}${decimalSeparator}${decPart}` : grouped;

    // Convert digits
    if (digits === "eastern") {
      formatted = formatted.replace(/[0-9]/g, (d) => EASTERN_DIGITS[d] || d);
    }

    return {
      formatted,
      digits,
      direction: digits === "western" ? "ltr" : "rtl",
      groupSeparator,
      decimalSeparator,
    };
  }

  /**
   * Format a date in Arabic.
   */
  formatDate(date: Date, calendar?: "hijri" | "gregorian"): DateFormatResult {
    const cal = calendar || this.config.calendarType;

    if (cal === "hijri") {
      const hijri = this.gregorianToHijri(date);
      return {
        formatted: `${hijri.day} ${HIJRI_MONTHS[hijri.month - 1]} ${hijri.year} هـ`,
        calendar: "hijri",
        direction: "rtl",
        components: {
          day: String(hijri.day),
          month: String(hijri.month),
          year: String(hijri.year),
          monthName: HIJRI_MONTHS[hijri.month - 1],
        },
      };
    }

    return {
      formatted: `${date.getDate()} ${GREGORIAN_MONTHS_AR[date.getMonth()]} ${date.getFullYear()} م`,
      calendar: "gregorian",
      direction: "rtl",
      components: {
        day: String(date.getDate()),
        month: String(date.getMonth() + 1),
        year: String(date.getFullYear()),
        monthName: GREGORIAN_MONTHS_AR[date.getMonth()],
      },
    };
  }

  /**
   * Recommend fonts for Arabic text.
   */
  recommendFont(text: string, context?: { isHeading?: boolean; isFormal?: boolean }): FontRecommendation {
    const hasArabic = ARABIC_RANGE.test(text);
    const hasTashkeel = TASHKEEL_RANGE.test(text);

    if (!hasArabic) {
      return {
        primary: "Inter",
        fallbacks: ["Arial", "Helvetica"],
        weight: context?.isHeading ? 700 : 400,
        style: "normal",
        features: [],
        reason: "Latin text detected",
      };
    }

    let primary = this.config.preferredFonts[0];
    const features: string[] = ["liga"];

    if (hasTashkeel) {
      primary = "Amiri";
      features.push("mark", "mkmk");
    } else if (context?.isHeading) {
      primary = "Cairo";
      features.push("ss01");
    } else if (context?.isFormal) {
      primary = "Noto Naskh Arabic";
    }

    return {
      primary,
      fallbacks: ARABIC_FONTS_PRIORITY.filter((f) => f !== primary).slice(0, 3),
      weight: context?.isHeading ? 700 : 400,
      style: "normal",
      features,
      reason: hasTashkeel ? "Tashkeel requires specialized font" : "Standard Arabic text",
    };
  }

  /**
   * Apply text justification using kashida.
   */
  justifyWithKashida(text: string, targetWidth: number, currentWidth: number): string {
    if (!this.config.enableKashida || currentWidth >= targetWidth) return text;

    const positions = this.calculateKashidaPositions(text);
    if (positions.length === 0) return text;

    const gap = targetWidth - currentWidth;
    const kashidaPerPosition = Math.ceil(gap / (positions.length * 8)); // ~8px per kashida

    let result = text;
    let offset = 0;

    for (const pos of positions) {
      const insertAt = pos + offset;
      const kashidas = KASHIDA.repeat(Math.min(kashidaPerPosition, 3));
      result = result.slice(0, insertAt + 1) + kashidas + result.slice(insertAt + 1);
      offset += kashidas.length;
    }

    return result;
  }

  // ─── Private helpers ────────────────────────────────────────

  private classifyChar(char: string): "arabic" | "latin" | "number" | "punctuation" {
    if (ARABIC_RANGE.test(char)) return "arabic";
    if (/[a-zA-Z]/.test(char)) return "latin";
    if (/[0-9\u0660-\u0669]/.test(char)) return "number";
    return "punctuation";
  }

  private detectDirection(text: string): "rtl" | "ltr" | "mixed" {
    let arabic = 0, latin = 0;
    for (const char of text) {
      if (ARABIC_RANGE.test(char)) arabic++;
      else if (/[a-zA-Z]/.test(char)) latin++;
    }
    if (arabic > 0 && latin > 0) return "mixed";
    return arabic > 0 ? "rtl" : "ltr";
  }

  private applyLigatures(text: string): { text: string; ligatures: LigatureInfo[] } {
    const ligatures: LigatureInfo[] = [];
    // Lam-Alef ligature detection
    const lamAlefRegex = /\u0644[\u0627\u0623\u0625\u0622]/g;
    let match;
    while ((match = lamAlefRegex.exec(text)) !== null) {
      ligatures.push({
        chars: match[0],
        position: match.index,
        type: "mandatory",
      });
    }
    return { text, ligatures };
  }

  private calculateKashidaPositions(text: string): number[] {
    const positions: number[] = [];
    for (let i = 0; i < text.length - 1; i++) {
      if (KASHIDA_ELIGIBLE.has(text[i]) && ARABIC_RANGE.test(text[i + 1])) {
        positions.push(i);
      }
    }
    return positions;
  }

  private removeTashkeel(text: string): string {
    return text.replace(TASHKEEL_RANGE, "");
  }

  private estimateTextWidth(text: string): number {
    return text.length * 8;
  }

  private estimateTextHeight(text: string): number {
    const lines = Math.ceil(text.length / 60);
    return lines * 14 * this.config.lineHeightMultiplier;
  }

  private gregorianToHijri(date: Date): { day: number; month: number; year: number } {
    // Simplified Gregorian to Hijri conversion
    const jd = Math.floor((1461 * (date.getFullYear() + 4800 + Math.floor((date.getMonth() - 13) / 12))) / 4)
      + Math.floor((367 * (date.getMonth() + 1 - 12 * Math.floor((date.getMonth() - 13) / 12))) / 12)
      - Math.floor((3 * Math.floor((date.getFullYear() + 4900 + Math.floor((date.getMonth() - 13) / 12)) / 100)) / 4)
      + date.getDate() - 32075;

    const l = jd - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    const l2 = l - 10631 * n + 354;
    const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
    const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;

    const month = Math.floor((24 * l3) / 709);
    const day = l3 - Math.floor((709 * month) / 24);
    const year = 30 * n + j - 30;

    return { day, month, year };
  }
}

export default ArabicLocalizationService;
