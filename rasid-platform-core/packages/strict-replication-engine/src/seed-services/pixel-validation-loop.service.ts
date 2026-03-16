/**
 * Pixel Validation Loop Service — Adapted from Seed
 *
 * Iterative pixel-level comparison engine that validates visual fidelity
 * between source and generated documents. Uses sharp + pixelmatch for
 * image comparison and generates optimization suggestions.
 *
 * Adapted: PrismaClient → prismaAdapter, @rasid/shared → @rasid/contracts
 * Original: 04_strict_fidelity_kernel/services/replication-service/src/services/pixel-validation-loop.service.ts
 */

import { createHash, randomUUID } from "crypto";
import type {
  PixelValidationResult,
  ValidationHotspot,
  BoundingBox,
  CanonicalLayoutGraph,
  LayoutNode,
  QualityMetrics,
  QualityIssue,
} from "@rasid/contracts";

// ---------------------------------------------------------------------------
// Logger (replaces winston)
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[PixelValidationLoop]";
const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(`${LOG_PREFIX} ${msg}`, meta || ""),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(`${LOG_PREFIX} ${msg}`, meta || ""),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(`${LOG_PREFIX} ${msg}`, meta || ""),
  debug: (msg: string, meta?: Record<string, unknown>) =>
    console.debug(`${LOG_PREFIX} ${msg}`, meta || ""),
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PixelValidationRequest {
  sourceImage: Buffer;
  generatedImage: Buffer;
  layoutGraph: CanonicalLayoutGraph;
  maxIterations: number;
}

export interface OptimizationAdjustment {
  nodeId: string;
  property: string;
  currentValue: unknown;
  suggestedValue: unknown;
  expectedImpact: number;
}

export interface DiagnosticReport {
  status:
    | "PIXEL_PERFECT"
    | "CONVERGENCE_PLATEAU"
    | "MAX_ITERATIONS_EXHAUSTED";
  pixelDiff: number;
  totalPixels: number;
  ssim: number;
  iterationCount: number;
  convergenceHistory: number[];
  missingFonts: string[];
  unavailableAssets: string[];
  renderingInconsistencies: string[];
  unsupportedFeatures: string[];
}

export interface AssetIntegrityMap {
  [nodeId: string]: {
    hash: string;
    type: "image" | "icon" | "vector";
    size: number;
  };
}

export interface PixelValidationConfig {
  threshold: number;
  antiAliasing: boolean;
  diffColor: { r: number; g: number; b: number };
  aaColor: { r: number; g: number; b: number };
  gridSize: number;
  convergenceThreshold: number;
  maxIterations: number;
}

export interface IterationResult {
  iteration: number;
  mismatchCount: number;
  mismatchPercentage: number;
  ssim: number;
  adjustments: OptimizationAdjustment[];
  hotspots: ValidationHotspot[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: PixelValidationConfig = {
  threshold: 0.1,
  antiAliasing: true,
  diffColor: { r: 255, g: 0, b: 0 },
  aaColor: { r: 255, g: 255, b: 0 },
  gridSize: 64,
  convergenceThreshold: 0.001,
  maxIterations: 10,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PixelValidationLoopService {
  private config: PixelValidationConfig;
  private db: any;

  constructor(config?: Partial<PixelValidationConfig>, dbAdapter?: any) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = dbAdapter;
  }

  /**
   * Run the full pixel validation loop.
   */
  async runValidationLoop(
    request: PixelValidationRequest
  ): Promise<{
    result: PixelValidationResult;
    diagnostic: DiagnosticReport;
    iterations: IterationResult[];
  }> {
    const startTime = Date.now();
    const iterations: IterationResult[] = [];
    const convergenceHistory: number[] = [];
    let currentImage = request.generatedImage;
    let bestMismatch = Infinity;
    let bestResult: PixelValidationResult | null = null;

    logger.info("Starting pixel validation loop", {
      maxIterations: request.maxIterations,
    });

    for (let i = 0; i < request.maxIterations; i++) {
      const iterStart = Date.now();

      // Compare images
      const comparison = await this.compareImages(
        request.sourceImage,
        currentImage
      );

      const mismatchPct =
        comparison.totalPixels > 0
          ? comparison.mismatchCount / comparison.totalPixels
          : 0;

      convergenceHistory.push(mismatchPct);

      // Detect hotspots
      const hotspots = this.detectHotspots(
        comparison.diffData,
        comparison.width,
        comparison.height
      );

      // Generate optimization suggestions
      const adjustments = this.generateAdjustments(
        hotspots,
        request.layoutGraph
      );

      const ssim = this.calculateSSIM(
        request.sourceImage,
        currentImage,
        comparison.width,
        comparison.height
      );

      const iterResult: IterationResult = {
        iteration: i + 1,
        mismatchCount: comparison.mismatchCount,
        mismatchPercentage: mismatchPct * 100,
        ssim,
        adjustments,
        hotspots,
        duration: Date.now() - iterStart,
      };

      iterations.push(iterResult);

      if (comparison.mismatchCount < bestMismatch) {
        bestMismatch = comparison.mismatchCount;
        bestResult = {
          matchPercentage: (1 - mismatchPct) * 100,
          mismatchCount: comparison.mismatchCount,
          totalPixels: comparison.totalPixels,
          hotspots,
        };
      }

      logger.info(`Iteration ${i + 1}: ${(mismatchPct * 100).toFixed(2)}% mismatch, SSIM: ${ssim.toFixed(4)}`);

      // Check convergence
      if (mismatchPct === 0) {
        logger.info("Pixel-perfect match achieved!");
        break;
      }

      if (
        convergenceHistory.length >= 3 &&
        this.hasConverged(convergenceHistory)
      ) {
        logger.info("Convergence plateau detected");
        break;
      }

      // Apply adjustments for next iteration
      currentImage = await this.applyAdjustments(
        currentImage,
        adjustments,
        comparison.width,
        comparison.height
      );
    }

    const finalMismatchPct =
      bestResult
        ? (bestResult.mismatchCount / bestResult.totalPixels) * 100
        : 100;

    const diagnostic: DiagnosticReport = {
      status:
        finalMismatchPct === 0
          ? "PIXEL_PERFECT"
          : convergenceHistory.length >= 3 &&
            this.hasConverged(convergenceHistory)
          ? "CONVERGENCE_PLATEAU"
          : "MAX_ITERATIONS_EXHAUSTED",
      pixelDiff: bestMismatch,
      totalPixels: bestResult?.totalPixels || 0,
      ssim:
        iterations.length > 0
          ? iterations[iterations.length - 1].ssim
          : 0,
      iterationCount: iterations.length,
      convergenceHistory,
      missingFonts: [],
      unavailableAssets: [],
      renderingInconsistencies: [],
      unsupportedFeatures: [],
    };

    // Save to DB if available
    if (this.db) {
      try {
        await this.db.replicationJob?.create({
          data: {
            jobId: randomUUID(),
            status: "completed",
            fidelityScore: bestResult?.matchPercentage || 0,
            pixelMatch: bestResult?.matchPercentage || 0,
            result: JSON.stringify(bestResult),
            evidencePack: JSON.stringify(diagnostic),
            completedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        logger.warn("Failed to save validation result to DB", {
          error: String(err),
        });
      }
    }

    logger.info("Validation loop complete", {
      status: diagnostic.status,
      iterations: iterations.length,
      duration: Date.now() - startTime,
    });

    return {
      result: bestResult || {
        matchPercentage: 0,
        mismatchCount: 0,
        totalPixels: 0,
        hotspots: [],
      },
      diagnostic,
      iterations,
    };
  }

  /**
   * Compare two images pixel by pixel.
   */
  private async compareImages(
    source: Buffer,
    generated: Buffer
  ): Promise<{
    mismatchCount: number;
    totalPixels: number;
    width: number;
    height: number;
    diffData: Uint8Array;
  }> {
    try {
      const sharp = (await import("sharp")).default;
      const pixelmatch = (await import("pixelmatch")).default;

      // Normalize both images to same dimensions
      const sourceMeta = await sharp(source).metadata();
      const width = sourceMeta.width || 800;
      const height = sourceMeta.height || 600;

      const sourceRaw = await sharp(source)
        .resize(width, height, { fit: "fill" })
        .raw()
        .ensureAlpha()
        .toBuffer();

      const generatedRaw = await sharp(generated)
        .resize(width, height, { fit: "fill" })
        .raw()
        .ensureAlpha()
        .toBuffer();

      const diffData = new Uint8Array(width * height * 4);
      const mismatchCount = pixelmatch(
        new Uint8Array(sourceRaw),
        new Uint8Array(generatedRaw),
        diffData,
        width,
        height,
        {
          threshold: this.config.threshold,
          includeAA: this.config.antiAliasing,
          diffColor: [
            this.config.diffColor.r,
            this.config.diffColor.g,
            this.config.diffColor.b,
          ],
          aaColor: [
            this.config.aaColor.r,
            this.config.aaColor.g,
            this.config.aaColor.b,
          ],
        }
      );

      return {
        mismatchCount,
        totalPixels: width * height,
        width,
        height,
        diffData,
      };
    } catch {
      // Fallback: simple buffer comparison
      logger.warn("sharp/pixelmatch not available, using fallback comparison");
      const len = Math.min(source.length, generated.length);
      let diff = 0;
      for (let i = 0; i < len; i++) {
        if (source[i] !== generated[i]) diff++;
      }
      return {
        mismatchCount: diff,
        totalPixels: len,
        width: 800,
        height: 600,
        diffData: new Uint8Array(0),
      };
    }
  }

  /**
   * Detect hotspots (regions with high mismatch density).
   */
  private detectHotspots(
    diffData: Uint8Array,
    width: number,
    height: number
  ): ValidationHotspot[] {
    if (diffData.length === 0) return [];

    const gridSize = this.config.gridSize;
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    const hotspots: ValidationHotspot[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let mismatchPixels = 0;
        let totalPixels = 0;

        const startX = col * gridSize;
        const startY = row * gridSize;
        const endX = Math.min(startX + gridSize, width);
        const endY = Math.min(startY + gridSize, height);

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            totalPixels++;
            const idx = (y * width + x) * 4;
            // Check if diff pixel is non-zero (mismatch)
            if (
              diffData[idx] > 0 ||
              diffData[idx + 1] > 0 ||
              diffData[idx + 2] > 0
            ) {
              mismatchPixels++;
            }
          }
        }

        const mismatchPercent =
          totalPixels > 0 ? (mismatchPixels / totalPixels) * 100 : 0;

        if (mismatchPercent > 5) {
          hotspots.push({
            region: {
              x: startX,
              y: startY,
              width: endX - startX,
              height: endY - startY,
            },
            severity:
              mismatchPercent > 50
                ? "critical"
                : mismatchPercent > 20
                ? "major"
                : "minor",
            mismatchPercent,
            description: `Region (${startX},${startY}) has ${mismatchPercent.toFixed(1)}% mismatch`,
          });
        }
      }
    }

    return hotspots.sort((a, b) => b.mismatchPercent - a.mismatchPercent);
  }

  /**
   * Generate optimization adjustments based on hotspots and layout graph.
   */
  private generateAdjustments(
    hotspots: ValidationHotspot[],
    layoutGraph: CanonicalLayoutGraph
  ): OptimizationAdjustment[] {
    const adjustments: OptimizationAdjustment[] = [];

    for (const hotspot of hotspots.slice(0, 10)) {
      // Find nodes that overlap with the hotspot region
      const overlappingNodes = this.findOverlappingNodes(
        hotspot.region,
        layoutGraph
      );

      for (const node of overlappingNodes) {
        if (node.content.kind === "text") {
          adjustments.push({
            nodeId: node.nodeId,
            property: "fontSize",
            currentValue: (node.content as any).fontSize,
            suggestedValue:
              ((node.content as any).fontSize || 14) +
              (hotspot.severity === "critical" ? -1 : 0),
            expectedImpact: hotspot.mismatchPercent * 0.3,
          });
        }

        if (node.style.padding) {
          adjustments.push({
            nodeId: node.nodeId,
            property: "padding",
            currentValue: node.style.padding,
            suggestedValue: {
              top: Math.max(0, (node.style.padding.top || 0) - 1),
              right: Math.max(0, (node.style.padding.right || 0) - 1),
              bottom: Math.max(0, (node.style.padding.bottom || 0) - 1),
              left: Math.max(0, (node.style.padding.left || 0) - 1),
            },
            expectedImpact: hotspot.mismatchPercent * 0.2,
          });
        }
      }
    }

    return adjustments;
  }

  /**
   * Find layout nodes that overlap with a given region.
   */
  private findOverlappingNodes(
    region: BoundingBox,
    layoutGraph: CanonicalLayoutGraph
  ): LayoutNode[] {
    const nodes: LayoutNode[] = [];

    if (!layoutGraph?.sceneGraph?.pages) return nodes;

    for (const page of layoutGraph.sceneGraph.pages) {
      for (const node of page.nodes) {
        if (this.regionsOverlap(region, node.bounds)) {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Check if two bounding boxes overlap.
   */
  private regionsOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Calculate Structural Similarity Index (SSIM) approximation.
   */
  private calculateSSIM(
    source: Buffer,
    generated: Buffer,
    width: number,
    height: number
  ): number {
    // Simplified SSIM calculation
    const len = Math.min(source.length, generated.length);
    if (len === 0) return 0;

    let sumSource = 0;
    let sumGenerated = 0;
    let sumSourceSq = 0;
    let sumGeneratedSq = 0;
    let sumCross = 0;
    const n = Math.min(len, width * height * 4);

    for (let i = 0; i < n; i++) {
      const s = source[i] || 0;
      const g = generated[i] || 0;
      sumSource += s;
      sumGenerated += g;
      sumSourceSq += s * s;
      sumGeneratedSq += g * g;
      sumCross += s * g;
    }

    const meanS = sumSource / n;
    const meanG = sumGenerated / n;
    const varS = sumSourceSq / n - meanS * meanS;
    const varG = sumGeneratedSq / n - meanG * meanG;
    const covSG = sumCross / n - meanS * meanG;

    const C1 = (0.01 * 255) ** 2;
    const C2 = (0.03 * 255) ** 2;

    const ssim =
      ((2 * meanS * meanG + C1) * (2 * covSG + C2)) /
      ((meanS ** 2 + meanG ** 2 + C1) * (varS + varG + C2));

    return Math.max(0, Math.min(1, ssim));
  }

  /**
   * Check if the convergence history shows a plateau.
   */
  private hasConverged(history: number[]): boolean {
    if (history.length < 3) return false;
    const last3 = history.slice(-3);
    const maxDiff = Math.max(...last3) - Math.min(...last3);
    return maxDiff < this.config.convergenceThreshold;
  }

  /**
   * Apply adjustments to the generated image (simplified).
   */
  private async applyAdjustments(
    image: Buffer,
    adjustments: OptimizationAdjustment[],
    width: number,
    height: number
  ): Promise<Buffer> {
    // In a full implementation, this would re-render the document
    // with the suggested adjustments. For now, return the image as-is
    // since re-rendering requires the full rendering pipeline.
    if (adjustments.length > 0) {
      logger.debug(`${adjustments.length} adjustments suggested for next iteration`);
    }
    return image;
  }

  /**
   * Validate asset integrity across the layout graph.
   */
  async validateAssetIntegrity(
    layoutGraph: CanonicalLayoutGraph
  ): Promise<AssetIntegrityMap> {
    const integrityMap: AssetIntegrityMap = {};

    if (!layoutGraph?.sceneGraph?.pages) return integrityMap;

    for (const page of layoutGraph.sceneGraph.pages) {
      for (const node of page.nodes) {
        if (node.content.kind === "image") {
          const content = node.content as any;
          integrityMap[node.nodeId] = {
            hash: createHash("sha256")
              .update(content.src || "")
              .digest("hex"),
            type: "image",
            size: 0,
          };
        }
      }
    }

    return integrityMap;
  }

  /**
   * Generate quality metrics from validation results.
   */
  generateQualityMetrics(
    result: PixelValidationResult,
    diagnostic: DiagnosticReport
  ): QualityMetrics {
    const issues: QualityIssue[] = [];

    if (result.matchPercentage < 95) {
      issues.push({
        severity: "error",
        category: "pixel-fidelity",
        message: `Match percentage ${result.matchPercentage.toFixed(1)}% is below 95% threshold`,
        suggestion: "Review hotspot regions and apply suggested adjustments",
      });
    }

    if (diagnostic.missingFonts.length > 0) {
      issues.push({
        severity: "warning",
        category: "typography",
        message: `${diagnostic.missingFonts.length} fonts not available`,
        suggestion: "Install missing fonts or configure fallbacks",
      });
    }

    return {
      overallScore: result.matchPercentage,
      layoutAccuracy: diagnostic.ssim * 100,
      colorFidelity: Math.max(0, result.matchPercentage - 5),
      typographyAccuracy:
        diagnostic.missingFonts.length === 0
          ? result.matchPercentage
          : result.matchPercentage * 0.8,
      contentCompleteness: 100 - diagnostic.unavailableAssets.length * 5,
      issues,
    };
  }
}

export default PixelValidationLoopService;
