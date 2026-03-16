/**
 * RASID Platform - Canonical Intermediate Representation (IR)
 *
 * Universal document representation used across all engines for
 * layout intelligence, pixel-perfect reconstruction, and document understanding.
 * Migrated from rasid_core_seed 02_shared_contracts.
 */

// ---------------------------------------------------------------------------
// Bounding Box & Position
// ---------------------------------------------------------------------------

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Position {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

// ---------------------------------------------------------------------------
// Design Tokens
// ---------------------------------------------------------------------------

export interface DesignTokens {
  colors: ColorToken[];
  fonts: FontToken[];
  spacing: SpacingToken[];
  borders: BorderToken[];
  shadows: ShadowToken[];
  gradients: GradientToken[];
}

export interface ColorToken {
  id: string;
  name: string;
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
  usage: "background" | "text" | "border" | "accent" | "chart" | "icon";
  frequency: number;
}

export interface FontToken {
  id: string;
  family: string;
  size: number;
  weight: number;
  style: "normal" | "italic" | "oblique";
  lineHeight: number;
  letterSpacing: number;
  kerning: number;
  usage: "heading" | "subheading" | "body" | "caption" | "label" | "data";
  confidence: number;
  fallbackFamilies: string[];
}

export interface SpacingToken {
  id: string;
  value: number;
  unit: "px" | "pt" | "em" | "rem" | "%";
  direction: "horizontal" | "vertical" | "all";
  usage: "margin" | "padding" | "gap" | "indent";
}

export interface BorderToken {
  id: string;
  width: number;
  style: "solid" | "dashed" | "dotted" | "double" | "none";
  color: string;
  radius: number;
}

export interface ShadowToken {
  id: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export interface GradientToken {
  id: string;
  type: "linear" | "radial" | "conic";
  angle: number;
  stops: { color: string; position: number }[];
}

// ---------------------------------------------------------------------------
// Layout Graph Nodes
// ---------------------------------------------------------------------------

export type LayoutNodeType =
  | "page"
  | "header"
  | "footer"
  | "sidebar"
  | "section"
  | "row"
  | "column"
  | "text"
  | "image"
  | "table"
  | "chart"
  | "shape"
  | "icon"
  | "spacer"
  | "divider"
  | "group"
  | "container"
  | "overlay"
  | "watermark"
  | "annotation"
  | "kpi"
  | "filter"
  | "widget";

export interface LayoutNode {
  nodeId: string;
  type: LayoutNodeType;
  bounds: BoundingBox;
  zIndex: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  children: string[];
  style: NodeStyle;
  content: NodeContent;
  metadata: Record<string, unknown>;
}

export interface NodeStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundGradient?: GradientToken;
  border?: BorderToken;
  shadow?: ShadowToken;
  padding?: { top: number; right: number; bottom: number; left: number };
  margin?: { top: number; right: number; bottom: number; left: number };
  borderRadius?: number;
  overflow?: "visible" | "hidden" | "scroll" | "auto";
  transform?: string;
  filter?: string;
  mixBlendMode?: string;
}

export type NodeContent =
  | TextContent
  | ImageContent
  | TableContent
  | ChartContent
  | IconContent
  | FilterContent
  | KpiContent
  | WidgetContent
  | EmptyContent;

export interface TextContent {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;
  letterSpacing: number;
  textDecoration: "none" | "underline" | "line-through";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  direction: "ltr" | "rtl";
  language: string;
}

export interface ImageContent {
  kind: "image";
  src: string;
  alt: string;
  objectFit: "cover" | "contain" | "fill" | "none" | "scale-down";
  naturalWidth: number;
  naturalHeight: number;
}

export interface TableContent {
  kind: "table";
  headers: string[];
  rows: TableCell[][];
  mergedCells: MergedCell[];
  columnWidths: number[];
  rowHeights: number[];
  headerStyle: Record<string, unknown>;
  cellStyle: Record<string, unknown>;
  alternateRowColors: boolean;
  showGridLines: boolean;
}

export interface TableCell {
  value: string | number | null;
  type: "text" | "number" | "date" | "formula" | "boolean";
  format?: string;
  style?: Record<string, unknown>;
  colspan?: number;
  rowspan?: number;
}

export interface MergedCell {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ChartContent {
  kind: "chart";
  chartType: ChartType;
  title: string;
  subtitle?: string;
  series: ChartSeries[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  legend: LegendConfig;
  grid: GridConfig;
  colorPalette: string[];
  responsive: boolean;
  animated: boolean;
}

export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "doughnut"
  | "area"
  | "scatter"
  | "radar"
  | "polar"
  | "bubble"
  | "treemap"
  | "heatmap"
  | "waterfall"
  | "funnel"
  | "gauge"
  | "combo";

export interface ChartSeries {
  name: string;
  nameAr?: string;
  data: (number | null)[];
  labels?: string[];
  color?: string;
  type?: ChartType;
  yAxisIndex?: number;
}

export interface AxisConfig {
  title?: string;
  titleAr?: string;
  labels?: string[];
  min?: number;
  max?: number;
  gridLines: boolean;
  tickFormat?: string;
}

export interface LegendConfig {
  show: boolean;
  position: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
}

export interface GridConfig {
  show: boolean;
  color: string;
  dashStyle: "solid" | "dashed" | "dotted";
}

export interface IconContent {
  kind: "icon";
  name: string;
  library: string;
  size: number;
  color: string;
}

export interface FilterContent {
  kind: "filter";
  filterType: "dropdown" | "date-range" | "search" | "checkbox" | "slider";
  label: string;
  labelAr?: string;
  options?: Array<{ value: string; label: string; labelAr?: string }>;
  defaultValue?: unknown;
  targetWidgets: string[];
}

export interface KpiContent {
  kind: "kpi";
  title: string;
  titleAr?: string;
  value: number | string;
  previousValue?: number | string;
  changePercent?: number;
  trend: "up" | "down" | "stable";
  format: "number" | "currency" | "percent" | "text";
  icon?: string;
  color?: string;
  sparklineData?: number[];
}

export interface WidgetContent {
  kind: "widget";
  widgetType: string;
  config: Record<string, unknown>;
}

export interface EmptyContent {
  kind: "empty";
}

// ---------------------------------------------------------------------------
// Scene Graph (full document)
// ---------------------------------------------------------------------------

export interface SceneGraph {
  documentId: string;
  version: number;
  pages: PageNode[];
  designTokens: DesignTokens;
  layers: SceneLayer[];
  relationships: SceneRelationship[];
  metadata: {
    title: string;
    titleAr?: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
    pageCount: number;
    language: "ar" | "en" | "mixed";
    direction: "rtl" | "ltr";
  };
}

export interface PageNode {
  pageId: string;
  pageNumber: number;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  nodes: LayoutNode[];
  background: {
    color?: string;
    image?: string;
    gradient?: GradientToken;
  };
}

export interface SceneLayer {
  layerId: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  nodeIds: string[];
}

export interface SceneRelationship {
  sourceNodeId: string;
  targetNodeId: string;
  type: "parent" | "sibling" | "reference" | "data-binding" | "style-link";
}

// ---------------------------------------------------------------------------
// Canonical Layout Graph (full IR)
// ---------------------------------------------------------------------------

export interface CanonicalLayoutGraph {
  sceneGraph: SceneGraph;
  designTokens: DesignTokens;
  qualityMetrics: QualityMetrics;
  extractionMetadata: {
    sourceFormat: string;
    extractionEngine: string;
    extractionVersion: string;
    extractionDuration: number;
    confidence: number;
  };
}

// ---------------------------------------------------------------------------
// Quality & Validation
// ---------------------------------------------------------------------------

export interface QualityMetrics {
  overallScore: number;
  layoutAccuracy: number;
  colorFidelity: number;
  typographyAccuracy: number;
  contentCompleteness: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  nodeId?: string;
  suggestion?: string;
}

export interface PixelValidationResult {
  matchPercentage: number;
  mismatchCount: number;
  totalPixels: number;
  diffImagePath?: string;
  hotspots: ValidationHotspot[];
}

export interface ValidationHotspot {
  region: BoundingBox;
  severity: "critical" | "major" | "minor";
  mismatchPercent: number;
  description: string;
}

export interface ValidationIssue {
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
}

// ---------------------------------------------------------------------------
// Font Recognition
// ---------------------------------------------------------------------------

export interface FontRecognitionResult {
  detectedFonts: DetectedFont[];
  confidence: number;
  fallbackSuggestions: string[];
}

export interface DetectedFont {
  family: string;
  weight: number;
  style: "normal" | "italic";
  confidence: number;
  source: "embedded" | "system" | "google" | "custom";
  alternates: string[];
}

export type TypographyLevel =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body"
  | "caption"
  | "label"
  | "overline";

// ---------------------------------------------------------------------------
// Document Metadata
// ---------------------------------------------------------------------------

export interface DocumentMetadata {
  documentId: string;
  title: string;
  titleAr?: string;
  format: string;
  pageCount: number;
  fileSize: number;
  language: "ar" | "en" | "mixed";
  direction: "rtl" | "ltr";
  author?: string;
  createdAt: string;
  modifiedAt?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Diagnostic Report
// ---------------------------------------------------------------------------

export interface DiagnosticReport {
  reportId: string;
  timestamp: string;
  duration: number;
  engine: string;
  operation: string;
  status: "success" | "partial" | "failed";
  metrics: Record<string, number>;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Section Metadata
// ---------------------------------------------------------------------------

export interface SectionMetadata {
  sectionId: string;
  title: string;
  titleAr?: string;
  type: string;
  order: number;
  parentId?: string;
  stats: SectionStats;
}

export interface SectionStats {
  nodeCount: number;
  textLength: number;
  imageCount: number;
  chartCount: number;
  tableCount: number;
}

// ---------------------------------------------------------------------------
// Localization Metadata
// ---------------------------------------------------------------------------

export interface LocalizationMetadata {
  sourceLanguage: string;
  targetLanguage: string;
  translationEngine: string;
  confidence: number;
  glossaryTerms: number;
  preservedFormatting: boolean;
}
