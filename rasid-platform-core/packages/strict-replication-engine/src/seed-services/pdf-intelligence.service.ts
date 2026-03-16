/**
 * PDF Intelligence Service — Adapted from Seed
 *
 * Advanced PDF analysis: structure extraction, table detection,
 * Arabic text handling, and document classification.
 *
 * Adapted: PrismaClient → prismaAdapter, @rasid/shared → @rasid/contracts
 * Original: 04_strict_fidelity_kernel/services/replication-service/src/services/pdf-intelligence.service.ts
 */

import { createHash, randomUUID } from "crypto";
import type {
  BoundingBox,
  CanonicalLayoutGraph,
  LayoutNode,
  LayoutPage,
} from "@rasid/contracts";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG = "[PDFIntelligence]";
const log = {
  info: (msg: string, m?: any) => console.log(`${LOG} ${msg}`, m || ""),
  warn: (msg: string, m?: any) => console.warn(`${LOG} ${msg}`, m || ""),
  error: (msg: string, m?: any) => console.error(`${LOG} ${msg}`, m || ""),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PDFAnalysisRequest {
  buffer: Buffer;
  options?: Partial<PDFAnalysisOptions>;
}

export interface PDFAnalysisOptions {
  extractText: boolean;
  extractTables: boolean;
  extractImages: boolean;
  detectLanguage: boolean;
  detectStructure: boolean;
  ocrFallback: boolean;
  maxPages: number;
}

export interface PDFAnalysisResult {
  documentId: string;
  pageCount: number;
  pages: PDFPageAnalysis[];
  metadata: PDFMetadata;
  structure: DocumentStructure;
  classification: DocumentClassification;
  arabicAnalysis: ArabicTextAnalysis;
  processingTime: number;
}

export interface PDFPageAnalysis {
  pageIndex: number;
  width: number;
  height: number;
  textBlocks: TextBlock[];
  tables: TableDetection[];
  images: ImageDetection[];
  lines: LineDetection[];
  headers: TextBlock[];
  footers: TextBlock[];
}

export interface TextBlock {
  id: string;
  text: string;
  bounds: BoundingBox;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  direction: "rtl" | "ltr";
  isArabic: boolean;
  confidence: number;
  lineIndex: number;
  blockType: "paragraph" | "heading" | "caption" | "footnote" | "header" | "footer";
}

export interface TableDetection {
  id: string;
  bounds: BoundingBox;
  rows: number;
  columns: number;
  cells: TableCell[];
  hasHeader: boolean;
  confidence: number;
}

export interface TableCell {
  row: number;
  col: number;
  text: string;
  bounds: BoundingBox;
  isHeader: boolean;
  colspan: number;
  rowspan: number;
}

export interface ImageDetection {
  id: string;
  bounds: BoundingBox;
  format: string;
  width: number;
  height: number;
  isLogo: boolean;
  isChart: boolean;
  altText: string;
}

export interface LineDetection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  color: string;
  type: "horizontal" | "vertical" | "diagonal";
}

export interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
  encrypted: boolean;
  fileSize: number;
}

export interface DocumentStructure {
  type: "report" | "letter" | "invoice" | "form" | "presentation" | "article" | "unknown";
  sections: DocumentSection[];
  tableOfContents: TOCEntry[];
  hasHeader: boolean;
  hasFooter: boolean;
  hasPageNumbers: boolean;
  columnCount: number;
}

export interface DocumentSection {
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  childSections: DocumentSection[];
}

export interface TOCEntry {
  title: string;
  page: number;
  level: number;
}

export interface DocumentClassification {
  primaryType: string;
  confidence: number;
  language: string;
  direction: "rtl" | "ltr" | "mixed";
  formality: "formal" | "informal" | "technical";
  domain: string;
}

export interface ArabicTextAnalysis {
  hasArabic: boolean;
  arabicPercentage: number;
  hasTashkeel: boolean;
  hasNumbers: boolean;
  arabicFonts: string[];
  textDirection: "rtl" | "ltr" | "mixed";
  kashidaUsage: boolean;
  ligatureComplexity: "simple" | "moderate" | "complex";
}

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: PDFAnalysisOptions = {
  extractText: true,
  extractTables: true,
  extractImages: true,
  detectLanguage: true,
  detectStructure: true,
  ocrFallback: false,
  maxPages: 100,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PDFIntelligenceService {
  private db: any;

  constructor(dbAdapter?: any) {
    this.db = dbAdapter;
  }

  /**
   * Analyze a PDF document.
   */
  async analyze(request: PDFAnalysisRequest): Promise<PDFAnalysisResult> {
    const startTime = Date.now();
    const documentId = randomUUID();
    const options = { ...DEFAULT_OPTIONS, ...request.options };

    log.info(`Analyzing PDF document ${documentId}`, {
      size: request.buffer.length,
    });

    try {
      // Extract basic metadata
      const metadata = this.extractMetadata(request.buffer);

      // Analyze pages
      const pages = await this.analyzePages(request.buffer, options);

      // Detect document structure
      const structure = this.detectStructure(pages);

      // Classify document
      const classification = this.classifyDocument(pages, metadata);

      // Analyze Arabic text
      const arabicAnalysis = this.analyzeArabicText(pages);

      const result: PDFAnalysisResult = {
        documentId,
        pageCount: pages.length,
        pages,
        metadata,
        structure,
        classification,
        arabicAnalysis,
        processingTime: Date.now() - startTime,
      };

      // Save to DB if available
      if (this.db?.document) {
        await this.db.document.create({
          data: {
            documentId,
            title: metadata.title || "Untitled PDF",
            format: "pdf",
            pageCount: pages.length,
            fileSize: request.buffer.length,
            language: classification.language,
            direction: classification.direction,
            metadata: JSON.stringify({
              classification,
              arabicAnalysis,
              structure: { type: structure.type },
            }),
          },
        });
      }

      log.info(`PDF analysis complete: ${pages.length} pages, ${(Date.now() - startTime)}ms`);
      return result;
    } catch (error) {
      log.error(`PDF analysis failed: ${error}`);
      throw error;
    }
  }

  /**
   * Extract metadata from PDF buffer.
   */
  private extractMetadata(buffer: Buffer): PDFMetadata {
    // Parse PDF header for basic metadata
    const header = buffer.toString("utf-8", 0, Math.min(buffer.length, 4096));

    const extractField = (field: string): string => {
      const regex = new RegExp(`/${field}\\s*\\(([^)]+)\\)`, "i");
      const match = header.match(regex);
      return match ? match[1] : "";
    };

    return {
      title: extractField("Title"),
      author: extractField("Author"),
      subject: extractField("Subject"),
      keywords: extractField("Keywords").split(",").filter(Boolean).map((k) => k.trim()),
      creator: extractField("Creator"),
      producer: extractField("Producer"),
      creationDate: extractField("CreationDate"),
      modificationDate: extractField("ModDate"),
      encrypted: header.includes("/Encrypt"),
      fileSize: buffer.length,
    };
  }

  /**
   * Analyze individual pages.
   */
  private async analyzePages(
    buffer: Buffer,
    options: PDFAnalysisOptions
  ): Promise<PDFPageAnalysis[]> {
    const pages: PDFPageAnalysis[] = [];

    // Count pages from PDF structure
    const content = buffer.toString("binary");
    const pageMatches = content.match(/\/Type\s*\/Page[^s]/g) || [];
    const pageCount = Math.min(pageMatches.length || 1, options.maxPages);

    for (let i = 0; i < pageCount; i++) {
      const page: PDFPageAnalysis = {
        pageIndex: i,
        width: 595,
        height: 842,
        textBlocks: [],
        tables: [],
        images: [],
        lines: [],
        headers: [],
        footers: [],
      };

      if (options.extractText) {
        page.textBlocks = this.extractTextBlocks(buffer, i);
        page.headers = page.textBlocks.filter((b) => b.blockType === "header");
        page.footers = page.textBlocks.filter((b) => b.blockType === "footer");
      }

      if (options.extractTables) {
        page.tables = this.detectTables(page.textBlocks);
      }

      if (options.extractImages) {
        page.images = this.detectImages(buffer, i);
      }

      pages.push(page);
    }

    return pages;
  }

  /**
   * Extract text blocks from a page.
   */
  private extractTextBlocks(buffer: Buffer, pageIndex: number): TextBlock[] {
    const blocks: TextBlock[] = [];
    // Extract readable text from the buffer
    const text = buffer.toString("utf-8").replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\s]/g, " ");
    const lines = text.split(/\n+/).filter((l) => l.trim().length > 3);

    const startLine = pageIndex * 50;
    const endLine = Math.min(startLine + 50, lines.length);

    for (let i = startLine; i < endLine; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const isArabic = /[\u0600-\u06FF]/.test(line);
      const isHeading = line.length < 80 && (line === line.toUpperCase() || /^[\u0600-\u06FF\s]{3,50}$/.test(line));

      blocks.push({
        id: `tb_${pageIndex}_${i}`,
        text: line.substring(0, 500),
        bounds: {
          x: 50,
          y: 50 + (i - startLine) * 16,
          width: 495,
          height: 14,
        },
        fontSize: isHeading ? 16 : 12,
        fontFamily: isArabic ? "Cairo" : "Arial",
        fontWeight: isHeading ? 700 : 400,
        color: "#000000",
        direction: isArabic ? "rtl" : "ltr",
        isArabic,
        confidence: 0.85,
        lineIndex: i - startLine,
        blockType: isHeading
          ? "heading"
          : i - startLine < 2
          ? "header"
          : i - startLine > 45
          ? "footer"
          : "paragraph",
      });
    }

    return blocks;
  }

  /**
   * Detect tables from text blocks.
   */
  private detectTables(textBlocks: TextBlock[]): TableDetection[] {
    const tables: TableDetection[] = [];
    // Simple heuristic: consecutive lines with tab/pipe separators
    let tableStart = -1;
    let tableRows: string[][] = [];

    for (let i = 0; i < textBlocks.length; i++) {
      const block = textBlocks[i];
      const cells = block.text.split(/\t|\|/).map((c) => c.trim()).filter(Boolean);

      if (cells.length >= 2) {
        if (tableStart === -1) tableStart = i;
        tableRows.push(cells);
      } else if (tableStart !== -1 && tableRows.length >= 2) {
        // End of table
        const maxCols = Math.max(...tableRows.map((r) => r.length));
        const tableCells: TableCell[] = [];

        for (let r = 0; r < tableRows.length; r++) {
          for (let c = 0; c < tableRows[r].length; c++) {
            tableCells.push({
              row: r,
              col: c,
              text: tableRows[r][c],
              bounds: { x: 50 + c * 100, y: textBlocks[tableStart].bounds.y + r * 20, width: 100, height: 20 },
              isHeader: r === 0,
              colspan: 1,
              rowspan: 1,
            });
          }
        }

        tables.push({
          id: `table_${tables.length}`,
          bounds: {
            x: 50,
            y: textBlocks[tableStart].bounds.y,
            width: 495,
            height: tableRows.length * 20,
          },
          rows: tableRows.length,
          columns: maxCols,
          cells: tableCells,
          hasHeader: true,
          confidence: 0.7,
        });

        tableStart = -1;
        tableRows = [];
      } else {
        tableStart = -1;
        tableRows = [];
      }
    }

    return tables;
  }

  /**
   * Detect images in a page.
   */
  private detectImages(buffer: Buffer, pageIndex: number): ImageDetection[] {
    const images: ImageDetection[] = [];
    // Detect image streams in PDF
    const content = buffer.toString("binary");
    const imageMatches = content.match(/\/Subtype\s*\/Image/g) || [];

    for (let i = 0; i < Math.min(imageMatches.length, 10); i++) {
      images.push({
        id: `img_${pageIndex}_${i}`,
        bounds: { x: 100, y: 100 + i * 200, width: 400, height: 200 },
        format: "png",
        width: 400,
        height: 200,
        isLogo: i === 0,
        isChart: false,
        altText: "",
      });
    }

    return images;
  }

  /**
   * Detect document structure.
   */
  private detectStructure(pages: PDFPageAnalysis[]): DocumentStructure {
    const allBlocks = pages.flatMap((p) => p.textBlocks);
    const headings = allBlocks.filter((b) => b.blockType === "heading");

    // Classify document type
    const allText = allBlocks.map((b) => b.text).join(" ").toLowerCase();
    let type: DocumentStructure["type"] = "unknown";

    if (allText.includes("invoice") || allText.includes("فاتورة")) type = "invoice";
    else if (allText.includes("report") || allText.includes("تقرير")) type = "report";
    else if (allText.includes("letter") || allText.includes("خطاب")) type = "letter";
    else if (allText.includes("form") || allText.includes("نموذج")) type = "form";
    else if (headings.length > 3) type = "report";

    const sections: DocumentSection[] = headings.map((h, idx) => ({
      title: h.text,
      level: h.fontSize > 14 ? 1 : 2,
      pageStart: pages.findIndex((p) => p.textBlocks.includes(h)),
      pageEnd: idx < headings.length - 1
        ? pages.findIndex((p) => p.textBlocks.includes(headings[idx + 1]))
        : pages.length - 1,
      childSections: [],
    }));

    return {
      type,
      sections,
      tableOfContents: headings.map((h) => ({
        title: h.text,
        page: pages.findIndex((p) => p.textBlocks.includes(h)),
        level: h.fontSize > 14 ? 1 : 2,
      })),
      hasHeader: pages.some((p) => p.headers.length > 0),
      hasFooter: pages.some((p) => p.footers.length > 0),
      hasPageNumbers: allBlocks.some((b) => /^\d+$/.test(b.text.trim())),
      columnCount: 1,
    };
  }

  /**
   * Classify the document.
   */
  private classifyDocument(
    pages: PDFPageAnalysis[],
    metadata: PDFMetadata
  ): DocumentClassification {
    const allBlocks = pages.flatMap((p) => p.textBlocks);
    const arabicBlocks = allBlocks.filter((b) => b.isArabic);
    const arabicPct = allBlocks.length > 0 ? arabicBlocks.length / allBlocks.length : 0;

    return {
      primaryType: metadata.title ? "document" : "unknown",
      confidence: 0.8,
      language: arabicPct > 0.5 ? "ar" : "en",
      direction: arabicPct > 0.7 ? "rtl" : arabicPct > 0.3 ? "mixed" : "ltr",
      formality: "formal",
      domain: "general",
    };
  }

  /**
   * Analyze Arabic text characteristics.
   */
  private analyzeArabicText(pages: PDFPageAnalysis[]): ArabicTextAnalysis {
    const allBlocks = pages.flatMap((p) => p.textBlocks);
    const arabicBlocks = allBlocks.filter((b) => b.isArabic);
    const allText = allBlocks.map((b) => b.text).join(" ");

    const hasTashkeel = /[\u064B-\u065F\u0670]/.test(allText);
    const hasNumbers = /[\u0660-\u0669]/.test(allText);
    const arabicFonts = [...new Set(arabicBlocks.map((b) => b.fontFamily))];

    return {
      hasArabic: arabicBlocks.length > 0,
      arabicPercentage: allBlocks.length > 0 ? (arabicBlocks.length / allBlocks.length) * 100 : 0,
      hasTashkeel,
      hasNumbers,
      arabicFonts,
      textDirection: arabicBlocks.length > allBlocks.length * 0.7 ? "rtl" : arabicBlocks.length > 0 ? "mixed" : "ltr",
      kashidaUsage: allText.includes("\u0640"),
      ligatureComplexity: hasTashkeel ? "complex" : arabicBlocks.length > 0 ? "moderate" : "simple",
    };
  }

  /**
   * Convert analysis result to canonical layout graph.
   */
  toCanonicalLayout(result: PDFAnalysisResult): CanonicalLayoutGraph {
    const pages: LayoutPage[] = result.pages.map((page) => ({
      pageIndex: page.pageIndex,
      width: page.width,
      height: page.height,
      direction: result.classification.direction === "rtl" ? "rtl" : "ltr",
      nodes: [
        ...page.textBlocks.map((block) => ({
          nodeId: block.id,
          bounds: block.bounds,
          content: {
            kind: "text" as const,
            text: block.text,
            fontSize: block.fontSize,
            fontFamily: block.fontFamily,
          },
          style: {
            fontFamily: block.fontFamily,
            fontSize: block.fontSize,
            fontWeight: block.fontWeight,
            color: block.color,
            textAlign: block.direction === "rtl" ? "right" : "left",
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
          zIndex: block.lineIndex,
          children: [],
        })),
        ...page.images.map((img) => ({
          nodeId: img.id,
          bounds: img.bounds,
          content: { kind: "image" as const, src: "", alt: img.altText },
          style: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          zIndex: 100,
          children: [],
        })),
      ],
    }));

    return {
      version: "1.0",
      direction: result.classification.direction === "rtl" ? "rtl" : "ltr",
      language: result.classification.language,
      sceneGraph: {
        pages,
        totalPages: pages.length,
        metadata: result.metadata,
      },
    };
  }
}

export default PDFIntelligenceService;
