// ─── Strict Replication Engine — Complete Module Index ────────────────
// محرك المطابقة البصرية الحرفية 1:1 — فهرس الوحدات الكامل
// PixelDiff = 0 | Structural Functional Equivalence
//
// Modules:
//   1. CDR-Design 7-Layer Schema (Section 5) — EMU-based absolute coordinates
//   2. Image Normalization & Understanding (Sections 6.1-6.3) — RGBA normalize + OCR + segment
//   3. Image Table → Excel (Section 6.4) — structured XLSX from image tables
//   4. Deterministic Farm & PixelDiff (Sections 7-8) — zero-tolerance comparison
//   5. Diagnose & Repair (Sections 9-10) — root-cause + mandatory repair order
//   6. Translation/Arabization/Emptying — ترجمة + تعريب + تفريغ
//   7. Functional Reconstruction (Addendum) — Dashboard/PPTX/DOCX/XLSX
//   8. Evidence Pack & Golden Corpus (Sections 11-12) — proof + CI gates

// ─── 1. CDR-Design 7-Layer Schema ──────────────────────────────────────
export {
  // Units
  EMU_PER_INCH, EMU_PER_PT, EMU_PER_CM, EMU_PER_MM, DEFAULT_DPI,
  ptToEmu, emuToPt, pxToEmu, emuToPx, cmToEmu, mmToEmu, inchToEmu, quantizeEmu,
  // Geometry
  IDENTITY_TRANSFORM, composeTransforms, applyTransform,
  // Types
  type SizeEmu, type BboxEmu, type Transform2D,
  type ColorRGBA, type GradientStop, type FillSpec, type StrokeSpec, type EffectSpec,
  type BackgroundSpec,
  type TextRun, type TextShaping, type TextElement,
  type GeometryType, type ShapeElement,
  type ImageElement,
  type CellSpec, type TableElement,
  type ChartKind, type ChartEncoding, type ChartElement,
  type GroupElement, type BackgroundFragmentElement,
  type CdrElement, type BlendMode, type LayerSpec, type CdrPage,
  type CdrFingerprints, type AssetReference, type CdrDesign,
  type CdrDataColumn, type CdrDataTable, type CdrData, type CdrDesignWithData,
  // Builders
  computeFingerprints, CdrStore,
  buildCdrDesignFromPdfDom, buildCdrDesignFromImage, buildCdrDesignFromOffice,
  type PdfTextObject, type PdfPathObject, type PdfImageObject, type PdfPageDom,
  type ImageSegmentRegion,
  // Utilities
  flattenAllElements, countElementsByKind, validateEditableCore, quantizeDesignGeometry,
} from "./cdr-design-schema";

// ─── 2. Image Normalization & Understanding ─────────────────────────────
export {
  // Normalization
  normalizeImage,
  type NormalizedImage, type RawImageInput,
  // Understanding Pipeline
  runImageUnderstandingPipeline,
  type SegmentRegion, type OcrBlock, type TableStructure, type ChartStructure,
  type StyleExtraction, type ImageUnderstandingOutput,
  // Pixel-Lock Overlay
  createPixelLockOverlay, compareWithOverlay, validateEditableLayerStructure,
  type PixelLockOverlay,
} from "./image-normalization";

// ─── 3. Image Table → Excel ─────────────────────────────────────────────
export {
  GridDetector, CellExtractor, MergeDetector, BorderStyleExtractor,
  ExcelStructuredExporter, TableRepairLoop, ImageTableToExcelPipeline,
  type GridLine, type DetectedGrid, type ExtractedCell, type MergedRegion,
  type BorderStyle, type CellStyle,
  type ExcelCell, type ExcelSheet, type ExcelWorkbook,
  type TableRepairResult, type ExcelPipelineResult,
} from "./image-table-to-excel";

// ─── 4. Deterministic Farm & PixelDiff ──────────────────────────────────
export {
  FarmConfig, DEFAULT_FARM_CONFIG,
  DeterministicRenderer, PixelDiffExact, FingerprintGenerator, FarmValidator,
  type FarmConfigOptions, type RenderResult, type PixelDiffResult, type FingerprintBundle,
  type FarmValidationResult,
} from "./deterministic-farm";

// ─── 5. Diagnose & Repair ───────────────────────────────────────────────
export {
  diagnose, executeRepairLoop, executeRepairLoopAllPages,
  RepairCache, DEFAULT_REPAIR_CONFIG,
  type HeatmapHotspot, type DiagnosticProbeResult, type DiagnosticReport, type RootCause,
  type RepairType, type RepairStep, type RepairResult, type RepairConfig,
  type DiffCalculator,
} from "./diagnose-engine";

// ─── 6. Translation / Arabization / Emptying ────────────────────────────
export {
  TranslationEngine, TerminologyDB, TranslationMemory,
  ArabizationEngine, ContentEmptyingEngine, ContentReinjector, ContentManifest,
  type TranslationResult, type CDRTranslationResult,
  type ArabizationResult, type ArabizationOptions,
  type ContentEmptyingResult,
  type ReinjectionResult,
} from "./translation-engine";

// ─── 7. Functional Reconstruction ───────────────────────────────────────
export {
  detectSourceType,
  DataBindingEngine, SchemaInferenceEngine,
  DashboardReconstructor, PresentationReconstructor,
  ReportReconstructor, ExcelReconstructor,
  FunctionalValidationEngine, UniversalReconstructor,
  type SourceType, type FunctionalParity, type ReconstructionResult,
  type ReconstructedComponent, type DataBinding, type InteractionSpec,
  type FormulaSpec, type ConditionalFormat, type ExcelReconstructionExtra,
} from "./functional-reconstruction";

// ─── 8. Evidence Pack & Golden Corpus ───────────────────────────────────
export {
  EvidencePackGenerator, GoldenCorpusManager,
  type RenderSnapshot, type PixelDiffReport, type StructuralReport,
  type DeterminismReport, type DriftReport, type RepairLogEntry,
  type ReproducibilityPack, type EvidencePackComplete,
  type GoldenCorpusItem, type CIGateCheckResult,
} from "./evidence-pack-generator";
