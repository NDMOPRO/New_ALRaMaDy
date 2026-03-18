/**
 * Arabic ELITE Text Processing Service
 * E02-0021: Arabic text rendering with ELITE quality
 * E02-0023: Bidirectional text support (RTL/LTR mixed)
 * E02-0024: Arabic typography rules (kashida, tashkeel, ligatures)
 * E02-0025: Arabic numeral conversion
 * E02-0026: Hijri date formatting
 */

// ============================================================
// ARABIC TEXT DIRECTION DETECTION
// ============================================================

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_BLOCK = /[\u0600-\u06FF]{3,}/;

export function detectTextDirection(text: string): 'rtl' | 'ltr' | 'mixed' {
  if (!text) return 'ltr';
  
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const total = arabicChars + latinChars;
  
  if (total === 0) return 'ltr';
  if (arabicChars / total > 0.7) return 'rtl';
  if (latinChars / total > 0.7) return 'ltr';
  return 'mixed';
}

export function isArabicText(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

export function hasArabicBlock(text: string): boolean {
  return ARABIC_BLOCK.test(text);
}

// ============================================================
// ARABIC NUMERAL CONVERSION
// ============================================================

const ARABIC_NUMERALS: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
};

const WESTERN_NUMERALS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function toArabicNumerals(text: string): string {
  return text.replace(/[0-9]/g, d => ARABIC_NUMERALS[d] || d);
}

export function toWesternNumerals(text: string): string {
  return text.replace(/[٠-٩]/g, d => WESTERN_NUMERALS[d] || d);
}

export type NumeralStyle = 'arabic' | 'western' | 'auto';

export function formatNumerals(text: string, style: NumeralStyle): string {
  if (style === 'arabic') return toArabicNumerals(text);
  if (style === 'western') return toWesternNumerals(text);
  // auto: use Arabic numerals if text is mostly Arabic
  if (detectTextDirection(text) === 'rtl') return toArabicNumerals(text);
  return text;
}

// ============================================================
// TASHKEEL (DIACRITICS) HANDLING
// ============================================================

const TASHKEEL_RANGE = /[\u064B-\u065F\u0670]/g;

export function stripTashkeel(text: string): string {
  return text.replace(TASHKEEL_RANGE, '');
}

export function hasTashkeel(text: string): boolean {
  return TASHKEEL_RANGE.test(text);
}

// ============================================================
// KASHIDA (TATWEEL) JUSTIFICATION
// ============================================================

const KASHIDA_CHAR = '\u0640';

// Characters that can receive kashida after them
const KASHIDA_AFTER = new Set([
  'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص', 'ض',
  'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن',
  'ه', 'ي', 'ئ', 'ة',
]);

export function addKashida(text: string, intensity: number = 1): string {
  if (intensity <= 0) return text;
  
  const kashidaStr = KASHIDA_CHAR.repeat(Math.min(Math.round(intensity), 3));
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    result += text[i];
    if (KASHIDA_AFTER.has(text[i]) && i < text.length - 1 && ARABIC_RANGE.test(text[i + 1])) {
      result += kashidaStr;
    }
  }
  
  return result;
}

export function removeKashida(text: string): string {
  return text.replace(new RegExp(KASHIDA_CHAR, 'g'), '');
}

// ============================================================
// HIJRI DATE FORMATTING
// ============================================================

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaban',
  'Ramadan', 'Shawwal', 'Dhul-Qadah', 'Dhul-Hijjah',
];

export function gregorianToHijri(date: Date): { year: number; month: number; day: number } {
  // Approximate conversion using Kuwaiti algorithm
  const jd = Math.floor((date.getTime() / 86400000) + 2440587.5);
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719)
    + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  
  return { year, month, day };
}

export function formatHijriDate(date: Date, lang: 'ar' | 'en' = 'ar'): string {
  const hijri = gregorianToHijri(date);
  const months = lang === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN;
  const monthName = months[hijri.month - 1] || '';
  
  if (lang === 'ar') {
    return `${toArabicNumerals(String(hijri.day))} ${monthName} ${toArabicNumerals(String(hijri.year))} هـ`;
  }
  return `${hijri.day} ${monthName} ${hijri.year} AH`;
}

// ============================================================
// BIDIRECTIONAL TEXT SEGMENTATION
// ============================================================

export interface BiDiSegment {
  text: string;
  direction: 'rtl' | 'ltr';
  isNumeric: boolean;
}

export function segmentBiDiText(text: string): BiDiSegment[] {
  const segments: BiDiSegment[] = [];
  let current = '';
  let currentDir: 'rtl' | 'ltr' = 'ltr';
  let isNum = false;
  
  for (const char of text) {
    const charIsArabic = ARABIC_RANGE.test(char);
    const charIsDigit = /[0-9٠-٩]/.test(char);
    const charDir = charIsArabic ? 'rtl' : 'ltr';
    
    if (char === ' ' || char === '\t') {
      current += char;
      continue;
    }
    
    if (current && (charDir !== currentDir || charIsDigit !== isNum)) {
      segments.push({ text: current, direction: currentDir, isNumeric: isNum });
      current = '';
    }
    
    currentDir = charDir;
    isNum = charIsDigit;
    current += char;
  }
  
  if (current) {
    segments.push({ text: current, direction: currentDir, isNumeric: isNum });
  }
  
  return segments;
}

// ============================================================
// ARABIC FONT RECOMMENDATIONS
// ============================================================

export const ARABIC_FONTS = {
  display: ['Cairo', 'Tajawal', 'Almarai', 'Changa'],
  body: ['Cairo', 'Noto Sans Arabic', 'IBM Plex Sans Arabic', 'Tajawal'],
  formal: ['Amiri', 'Scheherazade New', 'Noto Naskh Arabic'],
  modern: ['Cairo', 'Readex Pro', 'IBM Plex Sans Arabic'],
  calligraphic: ['Aref Ruqaa', 'Lateef', 'Harmattan'],
};

export function getRecommendedFont(style: 'display' | 'body' | 'formal' | 'modern' | 'calligraphic'): string {
  return ARABIC_FONTS[style][0];
}

// ============================================================
// TEXT PROCESSING PIPELINE
// ============================================================

export interface TextProcessingOptions {
  direction?: 'rtl' | 'ltr' | 'auto';
  numeralStyle?: NumeralStyle;
  stripDiacritics?: boolean;
  kashidaIntensity?: number;
}

export function processArabicText(text: string, options: TextProcessingOptions = {}): string {
  let result = text;
  
  // Strip diacritics if requested
  if (options.stripDiacritics) {
    result = stripTashkeel(result);
  }
  
  // Format numerals
  if (options.numeralStyle) {
    result = formatNumerals(result, options.numeralStyle);
  }
  
  // Add kashida for justification
  if (options.kashidaIntensity && options.kashidaIntensity > 0) {
    result = addKashida(result, options.kashidaIntensity);
  }
  
  return result;
}

// ============================================================
// CSS DIRECTION HELPERS
// ============================================================

export function getTextCSSProperties(text: string): React.CSSProperties {
  const dir = detectTextDirection(text);
  
  return {
    direction: dir === 'mixed' ? 'rtl' : dir,
    textAlign: dir === 'rtl' || dir === 'mixed' ? 'right' : 'left',
    unicodeBidi: dir === 'mixed' ? 'embed' : 'normal',
  };
}

export function getSlideDirection(hasArabic: boolean): 'rtl' | 'ltr' {
  return hasArabic ? 'rtl' : 'ltr';
}
