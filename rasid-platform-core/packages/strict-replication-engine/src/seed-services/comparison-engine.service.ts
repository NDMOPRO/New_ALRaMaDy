/**
 * Comparison Engine Service — Adapted from Seed
 *
 * Multi-dimensional comparison: pixel-level, structural, semantic,
 * and layout comparison between source and replicated documents.
 *
 * Original: 04_strict_fidelity_kernel/services/replication-service/src/services/comparison-engine.service.ts
 */

import { createHash, randomUUID } from "crypto";
import type {
  BoundingBox,
  CanonicalLayoutGraph,
  LayoutNode,
  FidelityScore,
  QualityIssue,
} from "@rasid/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonRequest {
  sourceLayout: CanonicalLayoutGraph;
  replicaLayout: CanonicalLayoutGraph;
  sourceImage?: Buffer;
  replicaImage?: Buffer;
  options?: Partial<ComparisonOptions>;
}

export interface ComparisonOptions {
  enablePixelComparison: boolean;
  enableStructuralComparison: boolean;
  enableSemanticComparison: boolean;
  enableColorComparison: boolean;
  enableTypographyComparison: boolean;
  pixelThreshold: number;
  structuralThreshold: number;
  colorDeltaE: number;
}

export interface ComparisonResult {
  id: string;
  overallScore: number;
  pixelScore: number;
  structuralScore: number;
  semanticScore: number;
  colorScore: number;
  typographyScore: number;
  differences: Difference[];
  summary: ComparisonSummary;
  timestamp: string;
}

export interface Difference {
  id: string;
  type: "missing" | "extra" | "modified" | "shifted" | "resized" | "recolored" | "refont";
  severity: "critical" | "major" | "minor" | "info";
  sourceNode?: string;
  replicaNode?: string;
  region: BoundingBox;
  description: string;
  details: Record<string, unknown>;
  suggestedFix?: string;
}

export interface ComparisonSummary {
  totalNodes: { source: number; replica: number };
  matchedNodes: number;
  missingNodes: number;
  extraNodes: number;
  modifiedNodes: number;
  shiftedNodes: number;
  colorDifferences: number;
  fontDifferences: number;
  overallAssessment: string;
}

export interface NodeMatch {
  sourceNode: LayoutNode;
  replicaNode: LayoutNode;
  similarity: number;
  positionDelta: { dx: number; dy: number };
  sizeDelta: { dw: number; dh: number };
}

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: ComparisonOptions = {
  enablePixelComparison: true,
  enableStructuralComparison: true,
  enableSemanticComparison: true,
  enableColorComparison: true,
  enableTypographyComparison: true,
  pixelThreshold: 0.1,
  structuralThreshold: 0.85,
  colorDeltaE: 3.0,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ComparisonEngineService {
  private db: any;

  constructor(dbAdapter?: any) {
    this.db = dbAdapter;
  }

  /**
   * Run a full comparison between source and replica.
   */
  async compare(request: ComparisonRequest): Promise<ComparisonResult> {
    const id = randomUUID();
    const options = { ...DEFAULT_OPTIONS, ...request.options };
    const differences: Difference[] = [];

    // Structural comparison
    let structuralScore = 0;
    if (options.enableStructuralComparison) {
      const structural = this.compareStructure(
        request.sourceLayout,
        request.replicaLayout
      );
      structuralScore = structural.score;
      differences.push(...structural.differences);
    }

    // Color comparison
    let colorScore = 0;
    if (options.enableColorComparison) {
      const color = this.compareColors(
        request.sourceLayout,
        request.replicaLayout,
        options.colorDeltaE
      );
      colorScore = color.score;
      differences.push(...color.differences);
    }

    // Typography comparison
    let typographyScore = 0;
    if (options.enableTypographyComparison) {
      const typo = this.compareTypography(
        request.sourceLayout,
        request.replicaLayout
      );
      typographyScore = typo.score;
      differences.push(...typo.differences);
    }

    // Semantic comparison
    let semanticScore = 0;
    if (options.enableSemanticComparison) {
      semanticScore = this.compareSemantic(
        request.sourceLayout,
        request.replicaLayout
      );
    }

    // Pixel comparison
    let pixelScore = 0;
    if (options.enablePixelComparison && request.sourceImage && request.replicaImage) {
      pixelScore = await this.comparePixels(
        request.sourceImage,
        request.replicaImage,
        options.pixelThreshold
      );
    } else {
      pixelScore = (structuralScore + colorScore + typographyScore) / 3;
    }

    const overallScore =
      pixelScore * 0.3 +
      structuralScore * 0.3 +
      colorScore * 0.15 +
      typographyScore * 0.15 +
      semanticScore * 0.1;

    const sourceNodes = this.countNodes(request.sourceLayout);
    const replicaNodes = this.countNodes(request.replicaLayout);

    const summary = this.buildSummary(
      sourceNodes,
      replicaNodes,
      differences,
      overallScore
    );

    const result: ComparisonResult = {
      id,
      overallScore,
      pixelScore,
      structuralScore,
      semanticScore,
      colorScore,
      typographyScore,
      differences,
      summary,
      timestamp: new Date().toISOString(),
    };

    // Save to DB
    if (this.db?.comparisonResult) {
      await this.db.comparisonResult.create({
        data: {
          jobId: id,
          comparisonType: "full",
          score: overallScore,
          details: JSON.stringify(result),
        },
      });
    }

    return result;
  }

  /**
   * Compare structural layout between two graphs.
   */
  private compareStructure(
    source: CanonicalLayoutGraph,
    replica: CanonicalLayoutGraph
  ): { score: number; differences: Difference[] } {
    const differences: Difference[] = [];
    let matchedCount = 0;
    let totalCount = 0;

    for (let pageIdx = 0; pageIdx < source.sceneGraph.pages.length; pageIdx++) {
      const sourcePage = source.sceneGraph.pages[pageIdx];
      const replicaPage = replica.sceneGraph.pages[pageIdx];

      if (!replicaPage) {
        differences.push({
          id: randomUUID(),
          type: "missing",
          severity: "critical",
          region: { x: 0, y: 0, width: sourcePage.width, height: sourcePage.height },
          description: `Page ${pageIdx} missing in replica`,
          details: { pageIndex: pageIdx },
        });
        totalCount += sourcePage.nodes.length;
        continue;
      }

      // Match nodes between pages
      const matches = this.matchNodes(sourcePage.nodes, replicaPage.nodes);

      for (const match of matches) {
        totalCount++;
        if (match.similarity >= 0.85) {
          matchedCount++;
        }

        if (Math.abs(match.positionDelta.dx) > 5 || Math.abs(match.positionDelta.dy) > 5) {
          differences.push({
            id: randomUUID(),
            type: "shifted",
            severity: Math.abs(match.positionDelta.dx) > 20 || Math.abs(match.positionDelta.dy) > 20 ? "major" : "minor",
            sourceNode: match.sourceNode.nodeId,
            replicaNode: match.replicaNode.nodeId,
            region: match.sourceNode.bounds,
            description: `Node shifted by (${match.positionDelta.dx}, ${match.positionDelta.dy})px`,
            details: { delta: match.positionDelta },
            suggestedFix: `Adjust position by (${-match.positionDelta.dx}, ${-match.positionDelta.dy})px`,
          });
        }

        if (Math.abs(match.sizeDelta.dw) > 5 || Math.abs(match.sizeDelta.dh) > 5) {
          differences.push({
            id: randomUUID(),
            type: "resized",
            severity: "minor",
            sourceNode: match.sourceNode.nodeId,
            replicaNode: match.replicaNode.nodeId,
            region: match.sourceNode.bounds,
            description: `Node resized by (${match.sizeDelta.dw}, ${match.sizeDelta.dh})px`,
            details: { delta: match.sizeDelta },
          });
        }
      }

      // Find unmatched source nodes (missing in replica)
      const matchedSourceIds = new Set(matches.map((m) => m.sourceNode.nodeId));
      for (const node of sourcePage.nodes) {
        if (!matchedSourceIds.has(node.nodeId)) {
          totalCount++;
          differences.push({
            id: randomUUID(),
            type: "missing",
            severity: "major",
            sourceNode: node.nodeId,
            region: node.bounds,
            description: `Node ${node.nodeId} missing in replica`,
            details: { content: node.content },
          });
        }
      }

      // Find extra nodes in replica
      const matchedReplicaIds = new Set(matches.map((m) => m.replicaNode.nodeId));
      for (const node of replicaPage.nodes) {
        if (!matchedReplicaIds.has(node.nodeId)) {
          differences.push({
            id: randomUUID(),
            type: "extra",
            severity: "minor",
            replicaNode: node.nodeId,
            region: node.bounds,
            description: `Extra node ${node.nodeId} in replica`,
            details: { content: node.content },
          });
        }
      }
    }

    const score = totalCount > 0 ? matchedCount / totalCount : 0;
    return { score, differences };
  }

  /**
   * Match nodes between source and replica pages.
   */
  private matchNodes(sourceNodes: LayoutNode[], replicaNodes: LayoutNode[]): NodeMatch[] {
    const matches: NodeMatch[] = [];
    const usedReplica = new Set<string>();

    for (const sourceNode of sourceNodes) {
      let bestMatch: { node: LayoutNode; similarity: number } | null = null;

      for (const replicaNode of replicaNodes) {
        if (usedReplica.has(replicaNode.nodeId)) continue;

        const similarity = this.calculateNodeSimilarity(sourceNode, replicaNode);
        if (similarity > (bestMatch?.similarity || 0.3)) {
          bestMatch = { node: replicaNode, similarity };
        }
      }

      if (bestMatch) {
        usedReplica.add(bestMatch.node.nodeId);
        matches.push({
          sourceNode,
          replicaNode: bestMatch.node,
          similarity: bestMatch.similarity,
          positionDelta: {
            dx: bestMatch.node.bounds.x - sourceNode.bounds.x,
            dy: bestMatch.node.bounds.y - sourceNode.bounds.y,
          },
          sizeDelta: {
            dw: bestMatch.node.bounds.width - sourceNode.bounds.width,
            dh: bestMatch.node.bounds.height - sourceNode.bounds.height,
          },
        });
      }
    }

    return matches;
  }

  /**
   * Calculate similarity between two nodes.
   */
  private calculateNodeSimilarity(a: LayoutNode, b: LayoutNode): number {
    let score = 0;
    let factors = 0;

    // Content type match
    if (a.content.kind === b.content.kind) {
      score += 0.3;
    }
    factors += 0.3;

    // Position similarity (IoU)
    const iou = this.calculateIoU(a.bounds, b.bounds);
    score += iou * 0.4;
    factors += 0.4;

    // Text content similarity
    if (a.content.kind === "text" && b.content.kind === "text") {
      const textA = (a.content as any).text || "";
      const textB = (b.content as any).text || "";
      const textSim = this.textSimilarity(textA, textB);
      score += textSim * 0.3;
      factors += 0.3;
    } else {
      factors += 0.3;
      score += (a.content.kind === b.content.kind ? 0.15 : 0);
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate Intersection over Union for bounding boxes.
   */
  private calculateIoU(a: BoundingBox, b: BoundingBox): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);

    if (x2 <= x1 || y2 <= y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    const union = areaA + areaB - intersection;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Simple text similarity (Jaccard on words).
   */
  private textSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Compare colors between layouts.
   */
  private compareColors(
    source: CanonicalLayoutGraph,
    replica: CanonicalLayoutGraph,
    maxDeltaE: number
  ): { score: number; differences: Difference[] } {
    const differences: Difference[] = [];
    let totalComparisons = 0;
    let matchedColors = 0;

    const sourceColors = this.extractAllColors(source);
    const replicaColors = this.extractAllColors(replica);

    for (const [nodeId, sourceColor] of sourceColors) {
      totalComparisons++;
      const replicaColor = replicaColors.get(nodeId);

      if (!replicaColor) continue;

      if (sourceColor === replicaColor) {
        matchedColors++;
      } else {
        differences.push({
          id: randomUUID(),
          type: "recolored",
          severity: "minor",
          sourceNode: nodeId,
          region: { x: 0, y: 0, width: 0, height: 0 },
          description: `Color changed from ${sourceColor} to ${replicaColor}`,
          details: { source: sourceColor, replica: replicaColor },
        });
      }
    }

    const score = totalComparisons > 0 ? matchedColors / totalComparisons : 1;
    return { score, differences };
  }

  /**
   * Compare typography between layouts.
   */
  private compareTypography(
    source: CanonicalLayoutGraph,
    replica: CanonicalLayoutGraph
  ): { score: number; differences: Difference[] } {
    const differences: Difference[] = [];
    let totalComparisons = 0;
    let matchedTypo = 0;

    for (let pageIdx = 0; pageIdx < source.sceneGraph.pages.length; pageIdx++) {
      const sourcePage = source.sceneGraph.pages[pageIdx];
      const replicaPage = replica.sceneGraph.pages[pageIdx];
      if (!replicaPage) continue;

      for (const sourceNode of sourcePage.nodes) {
        if (sourceNode.content.kind !== "text") continue;
        totalComparisons++;

        const replicaNode = replicaPage.nodes.find((n) => n.nodeId === sourceNode.nodeId);
        if (!replicaNode) continue;

        const fontMatch = sourceNode.style.fontFamily === replicaNode.style.fontFamily;
        const sizeMatch = sourceNode.style.fontSize === replicaNode.style.fontSize;
        const weightMatch = sourceNode.style.fontWeight === replicaNode.style.fontWeight;

        if (fontMatch && sizeMatch && weightMatch) {
          matchedTypo++;
        } else {
          if (!fontMatch) {
            differences.push({
              id: randomUUID(),
              type: "refont",
              severity: "minor",
              sourceNode: sourceNode.nodeId,
              region: sourceNode.bounds,
              description: `Font changed from ${sourceNode.style.fontFamily} to ${replicaNode.style.fontFamily}`,
              details: { source: sourceNode.style.fontFamily, replica: replicaNode.style.fontFamily },
            });
          }
        }
      }
    }

    const score = totalComparisons > 0 ? matchedTypo / totalComparisons : 1;
    return { score, differences };
  }

  /**
   * Semantic comparison between layouts.
   */
  private compareSemantic(
    source: CanonicalLayoutGraph,
    replica: CanonicalLayoutGraph
  ): number {
    const sourceText = this.extractAllText(source);
    const replicaText = this.extractAllText(replica);
    return this.textSimilarity(sourceText, replicaText);
  }

  /**
   * Pixel-level comparison.
   */
  private async comparePixels(
    sourceImage: Buffer,
    replicaImage: Buffer,
    threshold: number
  ): Promise<number> {
    try {
      const sharp = (await import("sharp")).default;
      const pixelmatch = (await import("pixelmatch")).default;

      const width = 800;
      const height = 600;

      const sourceRaw = await sharp(sourceImage).resize(width, height).raw().ensureAlpha().toBuffer();
      const replicaRaw = await sharp(replicaImage).resize(width, height).raw().ensureAlpha().toBuffer();

      const diff = new Uint8Array(width * height * 4);
      const mismatch = pixelmatch(
        new Uint8Array(sourceRaw),
        new Uint8Array(replicaRaw),
        diff,
        width,
        height,
        { threshold }
      );

      return 1 - mismatch / (width * height);
    } catch {
      return 0.5;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────

  private countNodes(graph: CanonicalLayoutGraph): number {
    let count = 0;
    for (const page of graph.sceneGraph.pages) count += page.nodes.length;
    return count;
  }

  private extractAllColors(graph: CanonicalLayoutGraph): Map<string, string> {
    const colors = new Map<string, string>();
    for (const page of graph.sceneGraph.pages) {
      for (const node of page.nodes) {
        if (node.style.color) colors.set(node.nodeId, String(node.style.color));
      }
    }
    return colors;
  }

  private extractAllText(graph: CanonicalLayoutGraph): string {
    const texts: string[] = [];
    for (const page of graph.sceneGraph.pages) {
      for (const node of page.nodes) {
        if (node.content.kind === "text") {
          texts.push((node.content as any).text || "");
        }
      }
    }
    return texts.join(" ");
  }

  private buildSummary(
    sourceNodes: number,
    replicaNodes: number,
    differences: Difference[],
    overallScore: number
  ): ComparisonSummary {
    const missing = differences.filter((d) => d.type === "missing").length;
    const extra = differences.filter((d) => d.type === "extra").length;
    const modified = differences.filter((d) => d.type === "modified").length;
    const shifted = differences.filter((d) => d.type === "shifted").length;
    const colorDiffs = differences.filter((d) => d.type === "recolored").length;
    const fontDiffs = differences.filter((d) => d.type === "refont").length;

    let assessment = "Excellent fidelity";
    if (overallScore < 0.5) assessment = "Poor fidelity - significant differences";
    else if (overallScore < 0.7) assessment = "Fair fidelity - notable differences";
    else if (overallScore < 0.85) assessment = "Good fidelity - minor differences";
    else if (overallScore < 0.95) assessment = "Very good fidelity - minimal differences";

    return {
      totalNodes: { source: sourceNodes, replica: replicaNodes },
      matchedNodes: sourceNodes - missing,
      missingNodes: missing,
      extraNodes: extra,
      modifiedNodes: modified,
      shiftedNodes: shifted,
      colorDifferences: colorDiffs,
      fontDifferences: fontDiffs,
      overallAssessment: assessment,
    };
  }
}

export default ComparisonEngineService;
