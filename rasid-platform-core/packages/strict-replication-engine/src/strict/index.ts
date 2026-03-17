/**
 * STRICT 1:1 Engine — Main Entry Point
 *
 * Initializes Tool Registry, registers all handlers, and exposes the strict pipeline.
 * Integrates: PIXEL_LOCK_FINAL, Degrade Policy, USE Engine, CI Gates, Failure Reporting.
 */

import {
  initializeRegistry,
  registerToolHandler,
  executeTool,
  listTools,
  type ToolRequest,
  type ToolResponse,
} from './tools/registry';
import { CdrStore } from './cdr/store';
import { setCdrStore } from './cdr/builder';
import { StrictPipeline, type StrictPipelineConfig, type StrictPipelineResult } from './pipeline/strict-pipeline';
import type { ActionContext, AssetRef, ExportKind } from './cdr/types';
import { setExportContext } from './export/exporters';
import { getStrictArtifactsDir } from './runtime/paths';

// Tool handlers
import { handleExtractPdfDom } from './extract/pdf-dom';
import { handleExtractImageSegments } from './extract/image-segments';
import { handleBuildDesignFromPdf, handleBuildDesignFromImage, handleBuildTableFromImage } from './cdr/builder';
import { handleFontEmbedFullGlyph } from './fonts/font-embedder';
import {
  handleExportPptx,
  handleExportDocx,
  handleExportXlsx,
  handleExportDashboard,
  handleExportPng,
  handleExportPdf,
} from './export/exporters';
import {
  handleRenderPdfToPng,
  handleRenderPptxToPng,
  handleRenderDocxToPng,
  handleRenderXlsxToPng,
  handleRenderDashboardToPng,
} from './render/farm-renderer';
import { handleVerifyPixelDiff } from './verify/pixel-diff';
import { createStructuralEquivalenceHandler } from './verify/structural-equivalence';
import { handleValidateDeterminism } from './verify/determinism';
import { handleDiagnose, handleQuantizeGeometry, handleAdjustTextMetrics, handleRepairLoop } from './repair/repair-loop';
import { handleExtractPptxDom, handleExtractDocxDom, handleExtractXlsxDom } from './extract/office-dom';

// New modules
import {
  PIXEL_LOCK_CONFIG,
  evaluateDualFidelityGate,
  lockCdrAbsolute,
  verifyPreservation,
  snapshotCdrHash,
  verifyZeroMutation,
  computeBuildArtifactHash,
  createBreachReport,
} from './pixel-lock/pixel-lock-final';
import { DegradePolicy } from './policy/degrade-policy';
import { USEEngine } from './use-engine/validators';
import { CIGateRunner } from './ci/gates';
import { GoldenCorpus } from './ci/golden-corpus';
import { FailureReportBuilder } from './diagnose/failure-report';

// ─── Engine Initialization ───────────────────────────────────────────
let initialized = false;
let store: CdrStore;
let degradePolicy: DegradePolicy;
let useEngine: USEEngine;

export function initStrictEngine(): void {
  if (initialized) return;

  // Initialize shared CDR store
  store = new CdrStore();
  setCdrStore(store);
  setExportContext({ store, outputDir: getStrictArtifactsDir() });

  // Initialize degrade policy and USE engine
  degradePolicy = new DegradePolicy();
  useEngine = new USEEngine();

  // Initialize tool registry with all definitions
  initializeRegistry();

  // Register all tool handlers
  registerToolHandler('extract.pdf_dom', handleExtractPdfDom as ToolHandler);
  registerToolHandler('extract.image_segments', handleExtractImageSegments as ToolHandler);
  registerToolHandler('cdr.build_design_from_pdf', handleBuildDesignFromPdf as ToolHandler);
  registerToolHandler('cdr.build_design_from_image', handleBuildDesignFromImage as ToolHandler);
  registerToolHandler('cdr.build_table_from_image', handleBuildTableFromImage as ToolHandler);
  registerToolHandler('fonts.embed_full_glyph', handleFontEmbedFullGlyph as ToolHandler);
  registerToolHandler('export.pptx_from_cdr', handleExportPptx as ToolHandler);
  registerToolHandler('export.docx_from_cdr', handleExportDocx as ToolHandler);
  registerToolHandler('export.xlsx_from_table_cdr', handleExportXlsx as ToolHandler);
  registerToolHandler('export.dashboard_from_cdr', handleExportDashboard as ToolHandler);
  registerToolHandler('export.png_from_cdr', handleExportPng as ToolHandler);
  registerToolHandler('export.pdf_from_cdr', handleExportPdf as ToolHandler);
  registerToolHandler('render.pdf_to_png', handleRenderPdfToPng as ToolHandler);
  registerToolHandler('render.pptx_to_png', handleRenderPptxToPng as ToolHandler);
  registerToolHandler('render.docx_to_png', handleRenderDocxToPng as ToolHandler);
  registerToolHandler('render.xlsx_to_png', handleRenderXlsxToPng as ToolHandler);
  registerToolHandler('render.dashboard_to_png', handleRenderDashboardToPng as ToolHandler);
  registerToolHandler('render.png_to_png', handleRenderPdfToPng as ToolHandler); // PNG render reuses PDF path
  registerToolHandler('verify.pixel_diff', handleVerifyPixelDiff as ToolHandler);
  registerToolHandler('verify.structural_equivalence', createStructuralEquivalenceHandler(store) as ToolHandler);
  registerToolHandler('render.validate_determinism', handleValidateDeterminism as ToolHandler);
  registerToolHandler('diagnose.diff_attribution', handleDiagnose as ToolHandler);
  registerToolHandler('repair.quantize_geometry', handleQuantizeGeometry as ToolHandler);
  registerToolHandler('repair.adjust_text_metrics', handleAdjustTextMetrics as ToolHandler);
  registerToolHandler('repair.loop_controller', handleRepairLoop as ToolHandler);
  registerToolHandler('extract.office_pptx', handleExtractPptxDom as ToolHandler);
  registerToolHandler('extract.office_docx', handleExtractDocxDom as ToolHandler);
  registerToolHandler('extract.office_xlsx', handleExtractXlsxDom as ToolHandler);

  initialized = true;
}

// ─── Type helper for handler registration ────────────────────────────
type ToolHandler = (request: ToolRequest) => Promise<ToolResponse>;

// ─── Pipeline Execution ──────────────────────────────────────────────
export async function runStrictPipeline(
  context: ActionContext,
  sourceAsset: AssetRef,
  targetFormat?: ExportKind,
  config?: Partial<StrictPipelineConfig>,
): Promise<StrictPipelineResult> {
  initStrictEngine();
  const pipeline = new StrictPipeline(config);
  return pipeline.execute(context, sourceAsset, targetFormat);
}

// ─── PIXEL_LOCK_FINAL exports ────────────────────────────────────────
export {
  PIXEL_LOCK_CONFIG,
  evaluateDualFidelityGate,
  lockCdrAbsolute,
  verifyPreservation,
  snapshotCdrHash,
  verifyZeroMutation,
  computeBuildArtifactHash,
  createBreachReport,
};

// ─── Degrade Policy exports ──────────────────────────────────────────
export { DegradePolicy };

// ─── USE Engine exports ──────────────────────────────────────────────
export { USEEngine };

// ─── CI Gate exports ─────────────────────────────────────────────────
export { CIGateRunner, GoldenCorpus };

// ─── Failure Report exports ──────────────────────────────────────────
export { FailureReportBuilder };

// ─── API ─────────────────────────────────────────────────────────────
export {
  executeTool,
  listTools,
  CdrStore,
  StrictPipeline,
};

export type {
  ActionContext,
  AssetRef,
  ExportKind,
  StrictPipelineConfig,
  StrictPipelineResult,
  ToolRequest,
  ToolResponse,
};

// Re-export types
export * from './cdr/types';
// Re-export submodules
export * from './pixel-lock/pixel-lock-final';
export * from './policy/degrade-policy';
export * from './use-engine/validators';
export * from './ci/gates';
export * from './ci/golden-corpus';
export * from './diagnose/failure-report';
