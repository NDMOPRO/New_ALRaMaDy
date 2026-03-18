/**
 * Rasid Presentation Engine — Core Types & Interfaces
 * Covers: E02-0001 through E02-0448
 * 
 * Design Philosophy: "Royal Digital Sovereignty"
 * Arabic ELITE + Gamma-Class Quality + Full Editability
 */

// ============================================================
// ENUMS
// ============================================================

export type SlideSize = '16:9' | '4:3' | 'A4' | 'custom';
export type Language = 'ar' | 'en' | 'mixed' | 'ar-en';
export type Tone = 'formal' | 'neutral' | 'creative' | 'semi-formal' | 'persuasive' | 'educational' | 'storytelling';
export type Density = 'sparse' | 'standard' | 'dense' | 'minimal' | 'detailed' | 'comprehensive';
export type InfographicLevel = 'none' | 'low' | 'medium' | 'high';
export type MotionLevel = 'none' | 'basic' | 'moderate' | 'cinematic';
export type ChartStyle = 'minimal' | 'boardroom' | 'data-heavy' | 'modern' | 'colorful' | 'dark';
export type ExportFormat = 'pptx' | 'pdf' | 'html' | 'png';

export type ElementType = 'text' | 'image' | 'shape' | 'chart' | 'table' | 'icon' | 'video' | 'infographic';
export type SlideLayoutType = 
  | 'title' | 'title-content' | 'two-column' | 'three-column'
  | 'image-left' | 'image-right' | 'full-image' | 'blank'
  | 'comparison' | 'timeline' | 'kpi' | 'chart-focus'
  | 'infographic' | 'quote' | 'section-header' | 'agenda'
  | 'conclusion' | 'thank-you' | 'team' | 'process';

export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter' | 'radar' | 'waterfall' | 'funnel' | 'gauge' | 'treemap';
export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'star' | 'hexagon' | 'diamond' | 'callout' | 'bracket' | 'line' | 'connector';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextDirection = 'rtl' | 'ltr' | 'auto';
export type FontWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export type PipelineStage = 'idle' | 'parsing' | 'researching' | 'outlining' | 'storyboarding' | 'layouting' | 'styling' | 'generating' | 'qa' | 'done' | 'error';

// ============================================================
// POSITION & SIZE
// ============================================================

export interface Position {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface Size {
  width: number;  // percentage 0-100
  height: number; // percentage 0-100
}

export interface BoundingBox extends Position, Size {}

// ============================================================
// COLOR & STYLING
// ============================================================

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  background: string;
  surface: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface FontScheme {
  titleFamily: string;
  bodyFamily: string;
  headingFamily: string;
  monoFamily: string;
  titleWeight: FontWeight;
  bodyWeight: FontWeight;
  headingWeight: FontWeight;
  titleSize: number;   // pt
  headingSize: number;  // pt
  bodySize: number;     // pt
  captionSize: number;  // pt
}

export interface GradientStop {
  color: string;
  position: number; // 0-100
}

export interface Background {
  type: 'solid' | 'gradient' | 'image' | 'pattern';
  color?: string;
  gradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    stops: GradientStop[];
  };
  imageUrl?: string;
  opacity?: number;
}

export interface Border {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted' | 'none';
  radius?: number;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

// ============================================================
// THEME & BRAND
// ============================================================

export interface Theme {
  id: string;
  name: string;
  nameAr: string;
  colors: ColorPalette;
  fonts: FontScheme;
  slideBackground: Background;
  elementDefaults: {
    borderRadius: number;
    shadow?: Shadow;
    padding: number;
  };
  direction: TextDirection;
  category: 'corporate' | 'creative' | 'minimal' | 'bold' | 'elegant' | 'tech' | 'arabic-classic';
  thumbnail?: string;
}

export interface BrandKit {
  id: string;
  name: string;
  nameAr?: string;
  logo?: string;
  logoUrl?: string;
  logoLight?: string;
  logoDark?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontFamilyAr?: string;
  colors: Partial<ColorPalette>;
  fonts?: Partial<FontScheme>;
  watermark?: string;
}

// ============================================================
// SLIDE ELEMENTS
// ============================================================

export interface TextContent {
  html: string;       // Rich text HTML
  plainText: string;  // Plain text for search/export
  direction: TextDirection;
  align: TextAlign;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: FontWeight;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  listType?: 'none' | 'bullet' | 'numbered';
}

export interface ImageContent {
  url: string;
  alt: string;
  fit: 'cover' | 'contain' | 'fill' | 'none';
  crop?: { x: number; y: number; width: number; height: number };
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
    opacity?: number;
  };
  mask?: 'none' | 'circle' | 'rounded' | 'hexagon' | 'custom';
  borderRadius?: number;
}

export interface ShapeContent {
  shapeType: ShapeType;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
  text?: TextContent;
}

export interface ChartContent {
  chartType: ChartType;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      color?: string;
      backgroundColor?: string;
    }[];
  };
  options: {
    showLegend: boolean;
    showGrid: boolean;
    showLabels?: boolean;
    showValues?: boolean;
    animate?: boolean;
    direction: TextDirection;
  };
}

export interface TableContent {
  headers: string[];
  rows: string[][];
  headerStyle: {
    background: string;
    color: string;
    fontWeight?: FontWeight;
  };
  cellStyle: {
    borderColor: string;
    padding?: number;
    alternateRowColor?: string;
  };
  direction: TextDirection;
}

export interface IconContent {
  name: string;
  library: 'lucide' | 'custom' | 'brand';
  color: string;
  size: number;
  strokeWidth?: number;
}

export interface InfographicContent {
  type: 'process' | 'comparison' | 'hierarchy' | 'cycle' | 'pyramid' | 'venn' | 'matrix' | 'funnel' | 'timeline' | 'statistics';
  items: {
    label: string;
    value?: string | number;
    icon?: string;
    color?: string;
    description?: string;
  }[];
  style: 'flat' | 'gradient' | '3d' | 'outlined';
  direction: TextDirection;
}

// ============================================================
// SLIDE ELEMENT (UNIFIED)
// ============================================================

export interface SlideElement {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  rotation?: number;
  opacity?: number;
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  animation?: {
    entrance: 'none' | 'fadeIn' | 'slideIn' | 'zoomIn' | 'bounceIn';
    delay: number;
    duration: number;
  };
  // Type-specific content
  textContent?: TextContent;
  imageContent?: ImageContent;
  shapeContent?: ShapeContent;
  chartContent?: ChartContent;
  tableContent?: TableContent;
  iconContent?: IconContent;
  infographicContent?: InfographicContent;
}

// ============================================================
// SLIDE & SLIDE MASTER
// ============================================================

export interface SlideMaster {
  id: string;
  name: string;
  nameAr: string;
  layoutType: SlideLayoutType;
  placeholders: {
    id: string;
    type: ElementType;
    position: Position;
    size: Size;
    label: string;
  }[];
  background?: Background;
  thumbnail?: string;
}

export interface Slide {
  id: string;
  masterId?: string;
  layoutType: SlideLayoutType;
  elements: SlideElement[];
  background?: Background;
  notes?: string;
  transition?: {
    type: 'none' | 'fade' | 'slide' | 'zoom' | 'push';
    duration: number;
  };
  hidden?: boolean;
  order: number;
}

// ============================================================
// DECK (PRESENTATION)
// ============================================================

export interface DeckProperties {
  title: string;
  subtitle?: string;
  author: string;
  organization?: string;
  date?: string;
  slideSize: SlideSize;
  customSize?: { width: number; height: number };
  language: Language;
  direction: TextDirection;
}

export interface Deck {
  id: string;
  version: number;
  properties: DeckProperties;
  slides: Slide[];
  theme: Theme;
  brandKit?: BrandKit;
  masters: SlideMaster[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// GENERATION PARAMETERS (KNOBS)
// ============================================================

export interface GenerationParams {
  prompt: string;
  slideCount?: number;
  tone: Tone;
  density: Density;
  themeId?: string;
  brandKitId?: string;
  language: Language;
  infographicLevel: InfographicLevel;
  motionLevel: MotionLevel;
  chartStyle: ChartStyle;
  iconPack: 'default' | 'brand';
  citations: boolean;
  speakerNotes: boolean;
  attachments?: File[];
}

// ============================================================
// PIPELINE STATE
// ============================================================

export interface PipelineState {
  stage: PipelineStage;
  progress: number; // 0-100
  currentStep: string;
  steps: {
    name: string;
    nameAr: string;
    status: 'pending' | 'active' | 'done' | 'error';
    progress: number;
  }[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================
// OUTLINE & STORYBOARD
// ============================================================

export interface OutlineSection {
  id: string;
  title: string;
  titleAr?: string;
  type: 'cover' | 'agenda' | 'section' | 'content' | 'conclusion' | 'appendix';
  description?: string;
  slideTypes?: string[];
  slides: {
    id: string;
    title: string;
    layoutType: SlideLayoutType;
    contentHints: string[];
    dataNeeds?: string[];
  }[];
}

export interface Outline {
  sections: OutlineSection[];
  totalSlides: number;
  estimatedDuration: number; // minutes
}

export interface StoryboardFrame {
  slideId: string;
  layoutType: SlideLayoutType;
  elements: {
    type: ElementType;
    placeholder: string;
    contentBrief: string;
  }[];
  visualNotes: string;
}

// ============================================================
// EVIDENCE PACK
// ============================================================

export interface EvidencePack {
  id: string;
  deckId: string;
  generatedAt: string;
  screenshots: { slideIndex: number; url: string }[];
  qaReport: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    details: {
      check: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
    }[];
  };
  renderParity: {
    previewHash: string;
    exportHash: string;
    match: boolean;
    diffPercentage: number;
  };
}

// ============================================================
// HISTORY & UNDO
// ============================================================

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  actionAr: string;
  snapshot: string; // JSON stringified deck state
}

// ============================================================
// ASSET LIBRARY
// ============================================================

export interface LibraryAsset {
  id: string;
  type: 'image' | 'icon' | 'logo' | 'template' | 'shape';
  name: string;
  url: string;
  thumbnail?: string;
  tags: string[];
  category: string;
  license?: string;
}
