/**
 * RASID Platform - Engine Type Definitions
 *
 * Core engine enum, config interface, and the full ENGINE_REGISTRY
 * for all 13 RASID platform engines.
 * Migrated from rasid_core_seed 02_shared_contracts.
 */

// ---------------------------------------------------------------------------
// Engine enum
// ---------------------------------------------------------------------------

export enum Engine {
  DATA = "data",
  EXCEL = "excel",
  DASHBOARD = "dashboard",
  REPORTING = "reporting",
  PRESENTATION = "presentation",
  INFOGRAPHIC = "infographic",
  REPLICATION = "replication",
  LOCALIZATION = "localization",
  AI = "ai",
  GOVERNANCE = "governance",
  LIBRARY = "library",
  TEMPLATE = "template",
  CONVERSION = "conversion",
}

export enum EngineType {
  CORE = "core",
  SUPPORT = "support",
  INTEGRATION = "integration",
}

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

export interface EngineConfig {
  id: Engine;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  service: string;
  port: number;
  basePath: string;
  featureCount: number;
  moduleCount: number;
  modules: string[];
  healthEndpoint: string;
  docsEndpoint: string;
}

// ---------------------------------------------------------------------------
// Per-engine config interfaces
// ---------------------------------------------------------------------------

export interface DataEngineConfig {
  maxFileSize: number;
  supportedFormats: string[];
  chunkSize: number;
  parallelWorkers: number;
}

export interface ExcelEngineConfig {
  maxRows: number;
  maxColumns: number;
  maxSheets: number;
  formulaTimeout: number;
  pivotTableLimit: number;
}

export interface DashboardEngineConfig {
  maxWidgets: number;
  refreshInterval: number;
  cacheTimeout: number;
  realtimeEnabled: boolean;
}

export interface ReportingEngineConfig {
  maxPages: number;
  templateCacheSize: number;
  pdfQuality: "draft" | "standard" | "high";
  watermarkEnabled: boolean;
}

export interface PresentationEngineConfig {
  maxSlides: number;
  transitionDuration: number;
  exportFormats: string[];
  templateLibrary: string;
}

export interface InfographicEngineConfig {
  maxElements: number;
  renderQuality: "low" | "medium" | "high" | "ultra";
  animationEnabled: boolean;
}

export interface ReplicationEngineConfig {
  pixelTolerance: number;
  maxIterations: number;
  qualityThreshold: number;
  parallelComparisons: number;
}

export interface LocalizationEngineConfig {
  supportedLanguages: string[];
  glossarySize: number;
  autoDetect: boolean;
  preserveFormatting: boolean;
}

export interface AIEngineConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
}

export interface GovernanceEngineConfig {
  auditRetention: number;
  complianceLevel: "basic" | "standard" | "strict";
  autoApproval: boolean;
  notificationEnabled: boolean;
}

export interface LibraryEngineConfig {
  maxAssets: number;
  storageLimitMB: number;
  versioningEnabled: boolean;
  deduplication: boolean;
}

export interface TemplateEngineConfig {
  maxTemplates: number;
  cacheEnabled: boolean;
  hotReload: boolean;
}

export interface ConversionEngineConfig {
  supportedInputFormats: string[];
  supportedOutputFormats: string[];
  maxFileSizeMB: number;
  ocrEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Feature Registry Types
// ---------------------------------------------------------------------------

export interface FeatureRange {
  engine: Engine;
  startId: string;
  endId: string;
  count: number;
}

export interface FeatureEntry {
  featureId: string;
  engine: Engine;
  name: string;
  nameAr: string;
  category: FeatureCategory;
  status: FeatureStatus;
  description: string;
}

export type FeatureCategory =
  | "core"
  | "advanced"
  | "integration"
  | "ui"
  | "api"
  | "admin";

export type FeatureStatus =
  | "active"
  | "beta"
  | "deprecated"
  | "planned"
  | "disabled";

// ---------------------------------------------------------------------------
// Dashboard-specific types
// ---------------------------------------------------------------------------

export interface DashboardFeature {
  featureId: string;
  name: string;
  nameAr: string;
  category: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface DashboardSection {
  sectionId: string;
  title: string;
  titleAr: string;
  order: number;
  widgets: string[];
  layout: "grid" | "flex" | "masonry";
  columns: number;
  collapsible: boolean;
  collapsed: boolean;
}

// ---------------------------------------------------------------------------
// Widget Types
// ---------------------------------------------------------------------------

export type WidgetType =
  | "chart"
  | "table"
  | "kpi"
  | "filter"
  | "text"
  | "image"
  | "map"
  | "timeline"
  | "calendar"
  | "custom";

export interface WidgetConfig {
  widgetId: string;
  type: WidgetType;
  title: string;
  titleAr?: string;
  position: WidgetPosition;
  dataBinding: WidgetDataBinding;
  style: WidgetStyleConfig;
  interactions: WidgetInteraction[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetDataBinding {
  source: string;
  query?: string;
  refreshInterval?: number;
  filters?: Record<string, unknown>;
  transformations?: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
}

export interface WidgetStyleConfig {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  shadow?: boolean;
  opacity?: number;
}

export interface WidgetInteraction {
  type: "click" | "hover" | "filter" | "drill-down" | "export";
  target?: string;
  action: string;
  config?: Record<string, unknown>;
}

export interface WidgetCreateRequest {
  type: WidgetType;
  title: string;
  titleAr?: string;
  sectionId: string;
  dataBinding: WidgetDataBinding;
  style?: Partial<WidgetStyleConfig>;
}

export interface WidgetUpdateRequest {
  title?: string;
  titleAr?: string;
  position?: Partial<WidgetPosition>;
  dataBinding?: Partial<WidgetDataBinding>;
  style?: Partial<WidgetStyleConfig>;
}

export interface WidgetDataResult {
  widgetId: string;
  data: unknown;
  metadata: {
    lastUpdated: string;
    rowCount: number;
    cached: boolean;
  };
}

// ---------------------------------------------------------------------------
// Chart Rendering
// ---------------------------------------------------------------------------

export interface ChartConfig {
  type: string;
  data: unknown;
  options: Record<string, unknown>;
  responsive: boolean;
  width: number;
  height: number;
}

export interface ChartRenderRequest {
  chartConfig: ChartConfig;
  format: "png" | "svg" | "pdf";
  quality?: number;
}

export interface ChartRenderResult {
  imageData: string;
  format: string;
  width: number;
  height: number;
  renderTime: number;
}

// ---------------------------------------------------------------------------
// Filter Widget
// ---------------------------------------------------------------------------

export interface FilterWidgetConfig {
  filterId: string;
  type: "dropdown" | "date-range" | "search" | "checkbox" | "slider" | "radio";
  label: string;
  labelAr?: string;
  options?: Array<{ value: string; label: string; labelAr?: string }>;
  defaultValue?: unknown;
  targetWidgets: string[];
  cascadeFilters?: string[];
}

export interface FilterCreateRequest {
  type: "dropdown" | "date-range" | "search" | "checkbox" | "slider" | "radio";
  label: string;
  labelAr?: string;
  options?: Array<{ value: string; label: string; labelAr?: string }>;
  defaultValue?: unknown;
  targetWidgets: string[];
  sectionId: string;
}

export interface FilterApplyRequest {
  filterId: string;
  value: unknown;
  targetWidgets?: string[];
}

export interface FilterApplyResult {
  affectedWidgets: string[];
  appliedAt: string;
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

export interface KpiConfig {
  kpiId: string;
  title: string;
  titleAr?: string;
  dataSource: string;
  calculation: string;
  format: "number" | "currency" | "percent" | "text";
  thresholds?: {
    warning: number;
    critical: number;
  };
  trend: boolean;
  sparkline: boolean;
  alert?: KpiAlertConfig;
}

export interface KpiAlertConfig {
  enabled: boolean;
  condition: "above" | "below" | "equals" | "change";
  value: number;
  notifyChannels: string[];
}

export interface KpiCalculationResult {
  kpiId: string;
  value: number | string;
  previousValue?: number | string;
  changePercent?: number;
  trend: "up" | "down" | "stable";
  sparklineData?: number[];
  calculatedAt: string;
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

export interface MetricCardConfig {
  metricId: string;
  title: string;
  titleAr?: string;
  icon?: string;
  color?: string;
  format: "number" | "currency" | "percent";
  comparison?: "previous_period" | "target" | "none";
}

// ---------------------------------------------------------------------------
// Table Config
// ---------------------------------------------------------------------------

export interface TableConfig {
  tableId: string;
  columns: TableColumnConfig[];
  pagination: boolean;
  pageSize: number;
  sortable: boolean;
  filterable: boolean;
  exportable: boolean;
  selectable: boolean;
}

export interface TableColumnConfig {
  field: string;
  header: string;
  headerAr?: string;
  type: "text" | "number" | "date" | "boolean" | "currency" | "percent" | "link" | "action";
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  format?: string;
  align?: "left" | "center" | "right";
}

// ---------------------------------------------------------------------------
// Series Config
// ---------------------------------------------------------------------------

export interface SeriesConfig {
  seriesId: string;
  name: string;
  nameAr?: string;
  dataField: string;
  type: string;
  color?: string;
  yAxisIndex?: number;
  stack?: string;
}

// ---------------------------------------------------------------------------
// Theme Config
// ---------------------------------------------------------------------------

export interface ThemeConfig {
  themeId: string;
  name: string;
  nameAr?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontFamilyAr: string;
  borderRadius: number;
  chartColors: string[];
}

export interface ThemePreviewResult {
  themeId: string;
  previewImageUrl: string;
  appliedAt: string;
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export interface RealtimeStreamConfig {
  streamId: string;
  source: string;
  interval: number;
  bufferSize: number;
  compression: boolean;
}

export interface RealtimeDataUpdate {
  streamId: string;
  timestamp: string;
  data: unknown;
  sequence: number;
}

export interface RealtimeConnectionMetrics {
  activeConnections: number;
  messagesPerSecond: number;
  averageLatency: number;
  uptime: number;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportRequest {
  format: "pdf" | "xlsx" | "csv" | "png" | "svg" | "pptx";
  scope: "full" | "selection" | "page";
  options?: Record<string, unknown>;
}

export interface ExportResult {
  fileUrl: string;
  format: string;
  fileSize: number;
  generatedAt: string;
  expiresAt: string;
}

export interface BatchExportRequest {
  items: ExportRequest[];
  archiveFormat?: "zip" | "tar";
  notifyOnComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Bridge types (cross-engine communication)
// ---------------------------------------------------------------------------

export interface BridgePayload {
  sourceEngine: Engine;
  targetEngine: Engine;
  action: string;
  data: unknown;
  correlationId: string;
  timestamp: string;
  priority: "low" | "normal" | "high" | "critical";
}

export interface BridgeSubscription {
  subscriptionId: string;
  sourceEngine: Engine;
  eventPattern: string;
  callback: string;
  active: boolean;
}

export interface DataLineageRecord {
  recordId: string;
  sourceEngine: Engine;
  targetEngine: Engine;
  operation: string;
  inputHash: string;
  outputHash: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface BridgeStats {
  totalMessages: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  activeSubscriptions: number;
  queueDepth: number;
}

export interface PublishOptions {
  priority?: "low" | "normal" | "high" | "critical";
  ttl?: number;
  persistent?: boolean;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface SubscriptionOptions {
  filter?: Record<string, unknown>;
  batchSize?: number;
  batchTimeout?: number;
}

// ---------------------------------------------------------------------------
// Asset Integrity
// ---------------------------------------------------------------------------

export interface AssetIntegrityRecord {
  assetId: string;
  hash: string;
  algorithm: "sha256" | "sha512" | "md5";
  verified: boolean;
  verifiedAt: string;
  source: string;
}
