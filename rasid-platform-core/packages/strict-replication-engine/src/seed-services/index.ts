/**
 * Seed Services — Adapted algorithms from rasid_core_seed
 *
 * These services contain the core algorithm logic extracted from the
 * seed code and adapted to work with the existing repo infrastructure
 * (sql.js/tRPC instead of Prisma/Express).
 */

export { PixelValidationLoopService } from "./pixel-validation-loop.service";
export type {
  PixelValidationRequest,
  PixelValidationConfig,
  OptimizationAdjustment,
  DiagnosticReport,
  AssetIntegrityMap,
  IterationResult,
} from "./pixel-validation-loop.service";

export { VisualReplicationService } from "./visual-replication.service";
export type {
  ReplicationRequest,
  ReplicationResult,
  ExtractionResult,
  ExtractedPage,
  ExtractedElement,
  FontInfo,
} from "./visual-replication.service";

export { PDFIntelligenceService } from "./pdf-intelligence.service";
export type {
  PDFAnalysisRequest,
  PDFAnalysisResult,
  PDFPageAnalysis,
  TextBlock,
  TableDetection,
  TableCell,
  ImageDetection,
  PDFMetadata,
  DocumentStructure,
  DocumentClassification,
  ArabicTextAnalysis,
} from "./pdf-intelligence.service";

export { ArabicLocalizationService } from "./arabic-localization.service";
export type {
  ArabicTextConfig,
  TextShapingResult,
  TextSegment,
  FontRecommendation,
  NumberFormatResult,
  DateFormatResult,
  BiDiAnalysis,
} from "./arabic-localization.service";

export { ComparisonEngineService } from "./comparison-engine.service";
export type {
  ComparisonRequest,
  ComparisonResult,
  Difference,
  ComparisonSummary,
  NodeMatch,
} from "./comparison-engine.service";
