// ─── Image Table → Excel Converter (Section 6.4) ─────────────────────
// Converts image tables to structured XLSX with PixelDiff=0 target

// ─── Types ────────────────────────────────────────────────────────────

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ImageBuffer {
  width: number;
  height: number;
  channels: 3 | 4;
  data: Uint8Array;
}

export interface GridLine {
  axis: "horizontal" | "vertical";
  position: number;
  start: number;
  end: number;
  thickness: number;
}

export interface DetectedGrid {
  horizontalLines: GridLine[];
  verticalLines: GridLine[];
  rows: number;
  cols: number;
  cellBounds: BBox[][];
}

export interface CellMerge {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  spanRows: number;
  spanCols: number;
}

export interface BorderStyle {
  color: string;
  width: number;
  style: "solid" | "dashed" | "dotted" | "double" | "none";
}

export interface CellBorders {
  top: BorderStyle;
  right: BorderStyle;
  bottom: BorderStyle;
  left: BorderStyle;
}

export interface CellFill {
  type: "solid" | "pattern" | "gradient" | "none";
  color: string;
  patternType?: string;
  secondaryColor?: string;
}

export interface CellPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  locale: string;
  isRtl: boolean;
  bbox: BBox;
}

export interface CellValue {
  row: number;
  col: number;
  text: string;
  confidence: number;
  locale: string;
  isRtl: boolean;
  numericValue?: number;
  isNumeric: boolean;
}

export interface CellFormat {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  alignment: "left" | "center" | "right" | "justify";
  verticalAlignment: "top" | "middle" | "bottom";
}

export interface CellStyle {
  borders: CellBorders;
  fill: CellFill;
  padding: CellPadding;
}

export interface StructuredCell {
  r: number;
  c: number;
  value: string;
  format: CellFormat;
  style: CellStyle;
  merge?: CellMerge;
  numericValue?: number;
  isNumeric: boolean;
  ocrConfidence: number;
}

export interface ExcelStructuredData {
  cells: StructuredCell[];
  colWidths: number[];
  rowHeights: number[];
  merges: CellMerge[];
  sheetName: string;
}

export interface PixelDiffResult {
  totalPixels: number;
  diffPixels: number;
  diffRatio: number;
  maxChannelDiff: number;
  diffMap: Uint8Array;
  regions: BBox[];
}

export interface RepairAdjustment {
  kind: "col_width" | "row_height" | "padding" | "font_size" | "border_width";
  target: { row?: number; col?: number };
  oldValue: number;
  newValue: number;
  diffBefore: number;
  diffAfter: number;
}

export interface GuidedQuestion {
  cellRef: string;
  row: number;
  col: number;
  ocrText: string;
  confidence: number;
  question: string;
  suggestedAnswers: string[];
  imageRegion: BBox;
}

export interface PipelineResult {
  excelData: ExcelStructuredData;
  pixelDiff: PixelDiffResult;
  repairIterations: number;
  adjustments: RepairAdjustment[];
  guidedQuestion: GuidedQuestion | null;
  converged: boolean;
}

// ─── Utility Helpers ──────────────────────────────────────────────────

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const val = parseInt(hex.replace("#", ""), 16);
  return { r: (val >> 16) & 0xff, g: (val >> 8) & 0xff, b: val & 0xff };
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

const pixelAt = (img: ImageBuffer, x: number, y: number): Pixel => {
  const idx = (y * img.width + x) * img.channels;
  return {
    r: img.data[idx],
    g: img.data[idx + 1],
    b: img.data[idx + 2],
    a: img.channels === 4 ? img.data[idx + 3] : 255,
  };
};

const luminance = (p: Pixel): number =>
  0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

const isArabicChar = (ch: string): boolean => {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
};

const detectArabic = (text: string): boolean => {
  let arabicCount = 0;
  let totalAlpha = 0;
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      totalAlpha++;
      if (isArabicChar(ch)) arabicCount++;
    }
  }
  return totalAlpha > 0 && arabicCount / totalAlpha > 0.3;
};

const colLabel = (col: number): string => {
  let label = "";
  let c = col;
  while (c >= 0) {
    label = String.fromCharCode(65 + (c % 26)) + label;
    c = Math.floor(c / 26) - 1;
  }
  return label;
};

// ─── GridDetector ─────────────────────────────────────────────────────
// Analyzes image to find table grid lines via horizontal/vertical
// run-length scanning on binarized edge map.

export class GridDetector {
  private readonly darkThreshold: number;
  private readonly minLineLength: number;
  private readonly mergeGap: number;

  constructor(opts?: {
    darkThreshold?: number;
    minLineLength?: number;
    mergeGap?: number;
  }) {
    this.darkThreshold = opts?.darkThreshold ?? 80;
    this.minLineLength = opts?.minLineLength ?? 30;
    this.mergeGap = opts?.mergeGap ?? 4;
  }

  /**
   * Binarize the image into a 1-bit edge map. Pixels darker than
   * darkThreshold are treated as potential grid line pixels (1), rest 0.
   */
  private binarize(img: ImageBuffer): Uint8Array {
    const out = new Uint8Array(img.width * img.height);
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const p = pixelAt(img, x, y);
        out[y * img.width + x] = luminance(p) < this.darkThreshold ? 1 : 0;
      }
    }
    return out;
  }

  /**
   * Scan for horizontal lines: for each row, find runs of consecutive
   * dark pixels longer than minLineLength.
   */
  private scanHorizontal(
    bin: Uint8Array,
    w: number,
    h: number
  ): GridLine[] {
    const raw: GridLine[] = [];

    for (let y = 0; y < h; y++) {
      let runStart = -1;
      for (let x = 0; x <= w; x++) {
        const dark = x < w && bin[y * w + x] === 1;
        if (dark && runStart === -1) {
          runStart = x;
        } else if (!dark && runStart !== -1) {
          const length = x - runStart;
          if (length >= this.minLineLength) {
            raw.push({
              axis: "horizontal",
              position: y,
              start: runStart,
              end: x - 1,
              thickness: 1,
            });
          }
          runStart = -1;
        }
      }
    }

    return this.mergeAdjacentLines(raw, "horizontal");
  }

  /**
   * Scan for vertical lines: for each column, find runs of consecutive
   * dark pixels longer than minLineLength.
   */
  private scanVertical(
    bin: Uint8Array,
    w: number,
    h: number
  ): GridLine[] {
    const raw: GridLine[] = [];

    for (let x = 0; x < w; x++) {
      let runStart = -1;
      for (let y = 0; y <= h; y++) {
        const dark = y < h && bin[y * w + x] === 1;
        if (dark && runStart === -1) {
          runStart = y;
        } else if (!dark && runStart !== -1) {
          const length = y - runStart;
          if (length >= this.minLineLength) {
            raw.push({
              axis: "vertical",
              position: x,
              start: runStart,
              end: y - 1,
              thickness: 1,
            });
          }
          runStart = -1;
        }
      }
    }

    return this.mergeAdjacentLines(raw, "vertical");
  }

  /**
   * Merge lines that are within `mergeGap` pixels of each other on the
   * same axis (e.g. two horizontal lines at y=100 and y=102 become one
   * thicker line at y=101 with thickness=3).
   */
  private mergeAdjacentLines(
    lines: GridLine[],
    axis: "horizontal" | "vertical"
  ): GridLine[] {
    if (lines.length === 0) return [];

    const sorted = [...lines].sort((a, b) => a.position - b.position);
    const merged: GridLine[] = [];
    let group: GridLine[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = group[group.length - 1];
      const cur = sorted[i];

      // Check overlap in the span direction
      const spanOverlap =
        cur.start <= prev.end + this.mergeGap &&
        cur.end >= prev.start - this.mergeGap;
      const posClose =
        Math.abs(cur.position - prev.position) <= this.mergeGap;

      if (posClose && spanOverlap) {
        group.push(cur);
      } else {
        merged.push(this.collapseGroup(group, axis));
        group = [cur];
      }
    }
    merged.push(this.collapseGroup(group, axis));

    return merged;
  }

  private collapseGroup(
    group: GridLine[],
    axis: "horizontal" | "vertical"
  ): GridLine {
    const positions = group.map((l) => l.position);
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const minStart = Math.min(...group.map((l) => l.start));
    const maxEnd = Math.max(...group.map((l) => l.end));

    return {
      axis,
      position: Math.round((minPos + maxPos) / 2),
      start: minStart,
      end: maxEnd,
      thickness: maxPos - minPos + 1,
    };
  }

  /**
   * Build a cell-bounds grid from intersecting horizontal and vertical lines.
   */
  private buildCellBounds(
    hLines: GridLine[],
    vLines: GridLine[]
  ): BBox[][] {
    const sortedH = [...hLines].sort((a, b) => a.position - b.position);
    const sortedV = [...vLines].sort((a, b) => a.position - b.position);

    const rows = sortedH.length - 1;
    const cols = sortedV.length - 1;

    if (rows <= 0 || cols <= 0) return [];

    const grid: BBox[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: BBox[] = [];
      for (let c = 0; c < cols; c++) {
        const x = sortedV[c].position + Math.ceil(sortedV[c].thickness / 2);
        const y = sortedH[r].position + Math.ceil(sortedH[r].thickness / 2);
        const x2 =
          sortedV[c + 1].position -
          Math.floor(sortedV[c + 1].thickness / 2);
        const y2 =
          sortedH[r + 1].position -
          Math.floor(sortedH[r + 1].thickness / 2);
        row.push({ x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) });
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Full grid detection pipeline: binarize -> scan H/V -> build bounds.
   */
  detect(img: ImageBuffer): DetectedGrid {
    const bin = this.binarize(img);
    const hLines = this.scanHorizontal(bin, img.width, img.height);
    const vLines = this.scanVertical(bin, img.width, img.height);
    const cellBounds = this.buildCellBounds(hLines, vLines);

    return {
      horizontalLines: hLines,
      verticalLines: vLines,
      rows: Math.max(0, hLines.length - 1),
      cols: Math.max(0, vLines.length - 1),
      cellBounds,
    };
  }
}

// ─── MergeDetector ────────────────────────────────────────────────────
// Detects merged cells via connected component analysis on the
// interior (non-border) regions between grid lines.

export class MergeDetector {
  private readonly emptyThreshold: number;

  constructor(opts?: { emptyThreshold?: number }) {
    this.emptyThreshold = opts?.emptyThreshold ?? 0.02;
  }

  /**
   * Builds a border-presence map between adjacent cells. A border is
   * considered absent if fewer than `emptyThreshold` fraction of pixels
   * along the shared edge are dark.
   */
  private buildAdjacency(
    img: ImageBuffer,
    grid: DetectedGrid
  ): {
    hBorders: boolean[][];
    vBorders: boolean[][];
  } {
    const { rows, cols, cellBounds } = grid;
    if (rows === 0 || cols === 0) {
      return { hBorders: [], vBorders: [] };
    }

    // hBorders[r][c] = true means there IS a border between row r and row r+1 at col c
    const hBorders: boolean[][] = [];
    for (let r = 0; r < rows - 1; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < cols; c++) {
        const upper = cellBounds[r][c];
        const lower = cellBounds[r + 1][c];
        const scanY = upper.y + upper.h;
        const scanXStart = Math.max(upper.x, lower.x);
        const scanXEnd = Math.min(upper.x + upper.w, lower.x + lower.w);
        const span = Math.max(1, scanXEnd - scanXStart);

        let darkCount = 0;
        for (let x = scanXStart; x < scanXEnd; x++) {
          const px = pixelAt(img, clamp(x, 0, img.width - 1), clamp(scanY, 0, img.height - 1));
          if (luminance(px) < 80) darkCount++;
        }
        row.push(darkCount / span > this.emptyThreshold);
      }
      hBorders.push(row);
    }

    // vBorders[r][c] = true means there IS a border between col c and col c+1 at row r
    const vBorders: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < cols - 1; c++) {
        const left = cellBounds[r][c];
        const right = cellBounds[r][c + 1];
        const scanX = left.x + left.w;
        const scanYStart = Math.max(left.y, right.y);
        const scanYEnd = Math.min(left.y + left.h, right.y + right.h);
        const span = Math.max(1, scanYEnd - scanYStart);

        let darkCount = 0;
        for (let y = scanYStart; y < scanYEnd; y++) {
          const px = pixelAt(img, clamp(scanX, 0, img.width - 1), clamp(y, 0, img.height - 1));
          if (luminance(px) < 80) darkCount++;
        }
        row.push(darkCount / span > this.emptyThreshold);
      }
      vBorders.push(row);
    }

    return { hBorders, vBorders };
  }

  /**
   * Connected component analysis: BFS flood fill on cells where
   * borders between neighbors are absent.
   */
  detect(img: ImageBuffer, grid: DetectedGrid): CellMerge[] {
    const { rows, cols } = grid;
    if (rows === 0 || cols === 0) return [];

    const { hBorders, vBorders } = this.buildAdjacency(img, grid);
    const visited = Array.from({ length: rows }, () =>
      new Array<boolean>(cols).fill(false)
    );
    const merges: CellMerge[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (visited[r][c]) continue;

        // BFS
        const queue: Array<[number, number]> = [[r, c]];
        const component: Array<[number, number]> = [];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          component.push([cr, cc]);

          // Check down neighbor
          if (
            cr < rows - 1 &&
            !visited[cr + 1][cc] &&
            hBorders[cr] &&
            !hBorders[cr][cc]
          ) {
            visited[cr + 1][cc] = true;
            queue.push([cr + 1, cc]);
          }

          // Check right neighbor
          if (
            cc < cols - 1 &&
            !visited[cr][cc + 1] &&
            vBorders[cr] &&
            !vBorders[cr][cc]
          ) {
            visited[cr][cc + 1] = true;
            queue.push([cr, cc + 1]);
          }

          // Check up neighbor
          if (
            cr > 0 &&
            !visited[cr - 1][cc] &&
            hBorders[cr - 1] &&
            !hBorders[cr - 1][cc]
          ) {
            visited[cr - 1][cc] = true;
            queue.push([cr - 1, cc]);
          }

          // Check left neighbor
          if (
            cc > 0 &&
            !visited[cr][cc - 1] &&
            vBorders[cr] &&
            !vBorders[cr][cc - 1]
          ) {
            visited[cr][cc - 1] = true;
            queue.push([cr, cc - 1]);
          }
        }

        // Only record if the component spans more than one cell
        if (component.length > 1) {
          const rowIndices = component.map(([rr]) => rr);
          const colIndices = component.map(([, cc]) => cc);
          const minR = Math.min(...rowIndices);
          const maxR = Math.max(...rowIndices);
          const minC = Math.min(...colIndices);
          const maxC = Math.max(...colIndices);

          merges.push({
            startRow: minR,
            startCol: minC,
            endRow: maxR,
            endCol: maxC,
            spanRows: maxR - minR + 1,
            spanCols: maxC - minC + 1,
          });
        }
      }
    }

    return merges;
  }
}

// ─── BorderStyleExtractor ─────────────────────────────────────────────
// Extracts border styles, fills, and paddings from cell regions.

export class BorderStyleExtractor {
  private readonly sampleDepth: number;

  constructor(opts?: { sampleDepth?: number }) {
    this.sampleDepth = opts?.sampleDepth ?? 6;
  }

  /**
   * Classify a border edge by sampling pixels along it and analyzing
   * continuity patterns to distinguish solid/dashed/dotted/double.
   */
  private classifyBorderEdge(
    img: ImageBuffer,
    samples: Array<{ x: number; y: number }>
  ): BorderStyle {
    if (samples.length === 0) {
      return { color: "#000000", width: 0, style: "none" };
    }

    const darkPixels: boolean[] = [];
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      darkCount = 0;

    for (const { x, y } of samples) {
      const cx = clamp(x, 0, img.width - 1);
      const cy = clamp(y, 0, img.height - 1);
      const px = pixelAt(img, cx, cy);
      const lum = luminance(px);
      const isDark = lum < 128;
      darkPixels.push(isDark);
      if (isDark) {
        totalR += px.r;
        totalG += px.g;
        totalB += px.b;
        darkCount++;
      }
    }

    if (darkCount === 0) {
      return { color: "#000000", width: 0, style: "none" };
    }

    const color = rgbToHex(
      Math.round(totalR / darkCount),
      Math.round(totalG / darkCount),
      Math.round(totalB / darkCount)
    );

    // Analyze run-lengths to classify style
    const runs: Array<{ dark: boolean; length: number }> = [];
    let currentDark = darkPixels[0];
    let runLen = 1;
    for (let i = 1; i < darkPixels.length; i++) {
      if (darkPixels[i] === currentDark) {
        runLen++;
      } else {
        runs.push({ dark: currentDark, length: runLen });
        currentDark = darkPixels[i];
        runLen = 1;
      }
    }
    runs.push({ dark: currentDark, length: runLen });

    const darkRuns = runs.filter((r) => r.dark);
    const ratio = darkCount / samples.length;

    let style: BorderStyle["style"];
    if (ratio > 0.85) {
      // Check for double border: dark-light-dark pattern with thick bands
      const lightRuns = runs.filter((r) => !r.dark && r.length >= 2);
      if (
        darkRuns.length === 2 &&
        lightRuns.length === 1 &&
        lightRuns[0].length >= 2
      ) {
        style = "double";
      } else {
        style = "solid";
      }
    } else if (darkRuns.length > 0) {
      const avgDarkRun =
        darkRuns.reduce((s, r) => s + r.length, 0) / darkRuns.length;
      style = avgDarkRun <= 2 ? "dotted" : "dashed";
    } else {
      style = "none";
    }

    // Estimate width by scanning perpendicular to the edge
    const width = Math.max(1, Math.round(darkCount / Math.max(1, darkRuns.length)));

    return { color, width: Math.min(width, 4), style };
  }

  /**
   * Extract border styles for a single cell by sampling each edge.
   */
  extractBorders(img: ImageBuffer, bbox: BBox): CellBorders {
    const { x, y, w, h } = bbox;
    const step = Math.max(1, Math.floor(Math.max(w, h) / 40));

    // Top edge samples
    const topSamples: Array<{ x: number; y: number }> = [];
    for (let sx = x; sx < x + w; sx += step) {
      topSamples.push({ x: sx, y });
    }

    // Bottom edge samples
    const bottomSamples: Array<{ x: number; y: number }> = [];
    for (let sx = x; sx < x + w; sx += step) {
      bottomSamples.push({ x: sx, y: y + h - 1 });
    }

    // Left edge samples
    const leftSamples: Array<{ x: number; y: number }> = [];
    for (let sy = y; sy < y + h; sy += step) {
      leftSamples.push({ x, y: sy });
    }

    // Right edge samples
    const rightSamples: Array<{ x: number; y: number }> = [];
    for (let sy = y; sy < y + h; sy += step) {
      rightSamples.push({ x: x + w - 1, y: sy });
    }

    return {
      top: this.classifyBorderEdge(img, topSamples),
      bottom: this.classifyBorderEdge(img, bottomSamples),
      left: this.classifyBorderEdge(img, leftSamples),
      right: this.classifyBorderEdge(img, rightSamples),
    };
  }

  /**
   * Extract fill color by sampling the interior of the cell, ignoring
   * border and text regions. Uses the dominant color among interior pixels.
   */
  extractFill(img: ImageBuffer, bbox: BBox): CellFill {
    const { x, y, w, h } = bbox;
    const margin = Math.max(2, Math.min(Math.floor(w * 0.15), Math.floor(h * 0.15)));

    const innerX = x + margin;
    const innerY = y + margin;
    const innerW = Math.max(1, w - margin * 2);
    const innerH = Math.max(1, h - margin * 2);

    // Sample at regular intervals
    const colorBuckets = new Map<string, number>();
    const step = Math.max(1, Math.floor(Math.min(innerW, innerH) / 10));

    for (let sy = innerY; sy < innerY + innerH; sy += step) {
      for (let sx = innerX; sx < innerX + innerW; sx += step) {
        const cx = clamp(sx, 0, img.width - 1);
        const cy = clamp(sy, 0, img.height - 1);
        const px = pixelAt(img, cx, cy);
        // Quantize to reduce unique colors
        const qr = Math.round(px.r / 16) * 16;
        const qg = Math.round(px.g / 16) * 16;
        const qb = Math.round(px.b / 16) * 16;
        const key = `${qr},${qg},${qb}`;
        colorBuckets.set(key, (colorBuckets.get(key) ?? 0) + 1);
      }
    }

    if (colorBuckets.size === 0) {
      return { type: "none", color: "#ffffff" };
    }

    // Find dominant color
    let maxCount = 0;
    let dominantKey = "255,255,255";
    for (const [key, count] of colorBuckets) {
      if (count > maxCount) {
        maxCount = count;
        dominantKey = key;
      }
    }

    const [dr, dg, db] = dominantKey.split(",").map(Number);
    const color = rgbToHex(dr, dg, db);

    // White or near-white is "none"
    if (dr >= 240 && dg >= 240 && db >= 240) {
      return { type: "none", color };
    }

    return { type: "solid", color };
  }

  /**
   * Estimate cell padding by scanning inward from each edge to find
   * the first non-background content pixel.
   */
  extractPadding(img: ImageBuffer, bbox: BBox, fillColor: string): CellPadding {
    const { x, y, w, h } = bbox;
    const { r: fr, g: fg, b: fb } = hexToRgb(fillColor);
    const colorDiffThreshold = 40;

    const isContent = (px: Pixel): boolean => {
      const dr = Math.abs(px.r - fr);
      const dg = Math.abs(px.g - fg);
      const db = Math.abs(px.b - fb);
      return dr + dg + db > colorDiffThreshold;
    };

    const midX = clamp(Math.floor(x + w / 2), 0, img.width - 1);
    const midY = clamp(Math.floor(y + h / 2), 0, img.height - 1);

    // Top padding: scan down from top edge at horizontal center
    let topPad = 0;
    for (let sy = y; sy < y + h; sy++) {
      if (isContent(pixelAt(img, midX, clamp(sy, 0, img.height - 1)))) break;
      topPad++;
    }

    // Bottom padding: scan up from bottom edge
    let bottomPad = 0;
    for (let sy = y + h - 1; sy >= y; sy--) {
      if (isContent(pixelAt(img, midX, clamp(sy, 0, img.height - 1)))) break;
      bottomPad++;
    }

    // Left padding: scan right from left edge at vertical center
    let leftPad = 0;
    for (let sx = x; sx < x + w; sx++) {
      if (isContent(pixelAt(img, clamp(sx, 0, img.width - 1), midY))) break;
      leftPad++;
    }

    // Right padding: scan left from right edge
    let rightPad = 0;
    for (let sx = x + w - 1; sx >= x; sx--) {
      if (isContent(pixelAt(img, clamp(sx, 0, img.width - 1), midY))) break;
      rightPad++;
    }

    return {
      top: Math.min(topPad, Math.floor(h / 2)),
      bottom: Math.min(bottomPad, Math.floor(h / 2)),
      left: Math.min(leftPad, Math.floor(w / 2)),
      right: Math.min(rightPad, Math.floor(w / 2)),
    };
  }

  /**
   * Full style extraction for a cell: borders + fill + padding.
   */
  extract(img: ImageBuffer, bbox: BBox): CellStyle {
    const borders = this.extractBorders(img, bbox);
    const fill = this.extractFill(img, bbox);
    const padding = this.extractPadding(img, bbox, fill.color);
    return { borders, fill, padding };
  }
}

// ─── CellExtractor ────────────────────────────────────────────────────
// Extracts cell text values via OCR with Arabic support.

export type OCREngine = (
  imageRegion: ImageBuffer,
  hints?: { locale?: string; rtl?: boolean }
) => Promise<OCRResult>;

export class CellExtractor {
  private readonly ocrEngine: OCREngine;
  private readonly confidenceThreshold: number;

  constructor(ocrEngine: OCREngine, opts?: { confidenceThreshold?: number }) {
    this.ocrEngine = ocrEngine;
    this.confidenceThreshold = opts?.confidenceThreshold ?? 0.7;
  }

  /**
   * Crop an image region from the full image buffer.
   */
  private cropRegion(img: ImageBuffer, bbox: BBox): ImageBuffer {
    const cx = clamp(bbox.x, 0, img.width - 1);
    const cy = clamp(bbox.y, 0, img.height - 1);
    const cw = clamp(bbox.w, 1, img.width - cx);
    const ch = clamp(bbox.h, 1, img.height - cy);

    const out = new Uint8Array(cw * ch * img.channels);
    for (let y = 0; y < ch; y++) {
      const srcOff = ((cy + y) * img.width + cx) * img.channels;
      const dstOff = y * cw * img.channels;
      out.set(img.data.subarray(srcOff, srcOff + cw * img.channels), dstOff);
    }
    return { width: cw, height: ch, channels: img.channels, data: out };
  }

  /**
   * Detect the dominant text format from pixel patterns in the cell.
   * Uses run-length analysis on text-pixel rows to estimate font size,
   * and horizontal density variance for bold detection.
   */
  private detectFormat(img: ImageBuffer, bbox: BBox): CellFormat {
    const region = this.cropRegion(img, bbox);
    const { width: w, height: h } = region;

    // Estimate font size from vertical text extent
    let textRowStart = -1;
    let textRowEnd = -1;
    for (let y = 0; y < h; y++) {
      let darkInRow = 0;
      for (let x = 0; x < w; x++) {
        const px = pixelAt(region, x, y);
        if (luminance(px) < 128) darkInRow++;
      }
      if (darkInRow > w * 0.02) {
        if (textRowStart === -1) textRowStart = y;
        textRowEnd = y;
      }
    }

    const textHeight =
      textRowStart >= 0 ? textRowEnd - textRowStart + 1 : Math.floor(h * 0.6);
    const fontSize = Math.max(8, Math.round(textHeight * 0.75));

    // Bold detection: measure average horizontal dark pixel density
    let totalDarkDensity = 0;
    let measuredRows = 0;
    for (
      let y = Math.max(0, textRowStart);
      y <= Math.min(h - 1, textRowEnd);
      y++
    ) {
      let runTotal = 0;
      let runCount = 0;
      let inRun = false;
      let runLen = 0;

      for (let x = 0; x < w; x++) {
        const px = pixelAt(region, x, y);
        if (luminance(px) < 128) {
          if (!inRun) {
            inRun = true;
            runLen = 0;
          }
          runLen++;
        } else if (inRun) {
          runTotal += runLen;
          runCount++;
          inRun = false;
        }
      }
      if (inRun) {
        runTotal += runLen;
        runCount++;
      }

      if (runCount > 0) {
        totalDarkDensity += runTotal / runCount;
        measuredRows++;
      }
    }

    const avgStrokeWidth =
      measuredRows > 0 ? totalDarkDensity / measuredRows : 1;
    const bold = avgStrokeWidth > fontSize * 0.12;

    // Text color: sample dark pixels to find the dominant text color
    let tr = 0,
      tg = 0,
      tb = 0,
      textPxCount = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = pixelAt(region, x, y);
        if (luminance(px) < 100) {
          tr += px.r;
          tg += px.g;
          tb += px.b;
          textPxCount++;
        }
      }
    }
    const textColor =
      textPxCount > 0
        ? rgbToHex(
            Math.round(tr / textPxCount),
            Math.round(tg / textPxCount),
            Math.round(tb / textPxCount)
          )
        : "#000000";

    // Alignment detection: compare left vs right margin of text
    let firstTextCol = w;
    let lastTextCol = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (luminance(pixelAt(region, x, y)) < 128) {
          if (x < firstTextCol) firstTextCol = x;
          if (x > lastTextCol) lastTextCol = x;
          break;
        }
      }
    }
    const leftMargin = firstTextCol;
    const rightMargin = w - lastTextCol - 1;
    const marginDiff = Math.abs(leftMargin - rightMargin);

    let alignment: CellFormat["alignment"];
    if (marginDiff < w * 0.1) {
      alignment = "center";
    } else if (leftMargin > rightMargin) {
      alignment = "right";
    } else {
      alignment = "left";
    }

    return {
      fontFamily: "Arial",
      fontSize,
      bold,
      italic: false,
      underline: false,
      color: textColor,
      alignment,
      verticalAlignment: "middle",
    };
  }

  /**
   * Extract all cell values from the grid.
   */
  async extractAll(
    img: ImageBuffer,
    grid: DetectedGrid
  ): Promise<{
    values: CellValue[][];
    formats: CellFormat[][];
    lowConfidenceCells: Array<{ row: number; col: number; confidence: number }>;
  }> {
    const { rows, cols, cellBounds } = grid;
    const values: CellValue[][] = [];
    const formats: CellFormat[][] = [];
    const lowConfidenceCells: Array<{
      row: number;
      col: number;
      confidence: number;
    }> = [];

    for (let r = 0; r < rows; r++) {
      const valueRow: CellValue[] = [];
      const formatRow: CellFormat[] = [];

      for (let c = 0; c < cols; c++) {
        const bbox = cellBounds[r][c];
        const region = this.cropRegion(img, bbox);

        // Detect if cell has any content
        let darkPixelCount = 0;
        const totalPixels = region.width * region.height;
        for (let y = 0; y < region.height; y++) {
          for (let x = 0; x < region.width; x++) {
            if (luminance(pixelAt(region, x, y)) < 128) darkPixelCount++;
          }
        }
        const contentRatio = darkPixelCount / Math.max(1, totalPixels);

        let ocrResult: OCRResult;
        if (contentRatio < 0.005) {
          // Empty cell — skip OCR
          ocrResult = {
            text: "",
            confidence: 1.0,
            locale: "en",
            isRtl: false,
            bbox,
          };
        } else {
          ocrResult = await this.ocrEngine(region, {});
          // Re-check for Arabic and set RTL
          if (detectArabic(ocrResult.text)) {
            ocrResult.isRtl = true;
            ocrResult.locale = "ar";
          }
        }

        // Parse numeric values
        const stripped = ocrResult.text
          .replace(/[\s,،٬]/g, "")
          .replace(/[٠-٩]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 48)
          )
          .replace(/[۰-۹]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0x06f0 + 48)
          );
        const numericMatch = stripped.match(
          /^[+-]?\d+(\.\d+)?(%)?$/
        );
        const isNumeric = numericMatch !== null;
        const numericValue = isNumeric ? parseFloat(stripped) : undefined;

        valueRow.push({
          row: r,
          col: c,
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          locale: ocrResult.locale,
          isRtl: ocrResult.isRtl,
          isNumeric,
          numericValue,
        });

        if (ocrResult.confidence < this.confidenceThreshold && ocrResult.text.length > 0) {
          lowConfidenceCells.push({
            row: r,
            col: c,
            confidence: ocrResult.confidence,
          });
        }

        formatRow.push(this.detectFormat(img, bbox));
      }

      values.push(valueRow);
      formats.push(formatRow);
    }

    return { values, formats, lowConfidenceCells };
  }
}

// ─── ExcelStructuredExporter ──────────────────────────────────────────
// Creates structured XLSX data: cells array with r, c, value, format, style.

export class ExcelStructuredExporter {
  /**
   * Build the structured cells array from extracted values, formats,
   * styles, and merge info.
   */
  build(
    grid: DetectedGrid,
    values: CellValue[][],
    formats: CellFormat[][],
    styles: CellStyle[][],
    merges: CellMerge[]
  ): ExcelStructuredData {
    const { rows, cols, cellBounds } = grid;
    const cells: StructuredCell[] = [];

    // Build a lookup of which cells are "consumed" by a merge (non-origin cells)
    const mergedOrigins = new Map<string, CellMerge>();
    const mergedNonOrigins = new Set<string>();
    for (const merge of merges) {
      const key = `${merge.startRow},${merge.startCol}`;
      mergedOrigins.set(key, merge);
      for (let mr = merge.startRow; mr <= merge.endRow; mr++) {
        for (let mc = merge.startCol; mc <= merge.endCol; mc++) {
          if (mr !== merge.startRow || mc !== merge.startCol) {
            mergedNonOrigins.add(`${mr},${mc}`);
          }
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;
        // Skip non-origin cells of a merge
        if (mergedNonOrigins.has(key)) continue;

        const val = values[r]?.[c];
        const fmt = formats[r]?.[c];
        const sty = styles[r]?.[c];

        if (!val || !fmt || !sty) continue;

        // For RTL text, set alignment to right if not already explicit
        const adjustedFormat = { ...fmt };
        if (val.isRtl && adjustedFormat.alignment === "left") {
          adjustedFormat.alignment = "right";
        }

        const cell: StructuredCell = {
          r,
          c,
          value: val.text,
          format: adjustedFormat,
          style: sty,
          isNumeric: val.isNumeric,
          numericValue: val.numericValue,
          ocrConfidence: val.confidence,
        };

        const merge = mergedOrigins.get(key);
        if (merge) {
          cell.merge = merge;
        }

        cells.push(cell);
      }
    }

    // Compute column widths and row heights from cell bounds
    const colWidths: number[] = [];
    for (let c = 0; c < cols; c++) {
      const widths = cellBounds.map((row) => row[c]?.w ?? 0);
      colWidths.push(Math.max(...widths));
    }

    const rowHeights: number[] = [];
    for (let r = 0; r < rows; r++) {
      const heights = cellBounds[r].map((cell) => cell.h);
      rowHeights.push(Math.max(...heights));
    }

    return {
      cells,
      colWidths,
      rowHeights,
      merges,
      sheetName: "Sheet1",
    };
  }
}

// ─── TableRepairLoop ──────────────────────────────────────────────────
// Iteratively adjusts widths/heights/padding until PixelDiff=0.

export type RenderFn = (data: ExcelStructuredData) => Promise<ImageBuffer>;
export type DiffFn = (a: ImageBuffer, b: ImageBuffer) => PixelDiffResult;

export class TableRepairLoop {
  private readonly maxIterations: number;
  private readonly targetDiffRatio: number;
  private readonly stepPx: number;

  constructor(opts?: {
    maxIterations?: number;
    targetDiffRatio?: number;
    stepPx?: number;
  }) {
    this.maxIterations = opts?.maxIterations ?? 20;
    this.targetDiffRatio = opts?.targetDiffRatio ?? 0;
    this.stepPx = opts?.stepPx ?? 1;
  }

  /**
   * Compute a per-column and per-row diff score by summing diff pixels
   * in each column/row band of the diff map.
   */
  private regionDiffScores(
    diff: PixelDiffResult,
    data: ExcelStructuredData,
    imgWidth: number,
    imgHeight: number
  ): { colScores: number[]; rowScores: number[] } {
    const { colWidths, rowHeights } = data;
    const colScores = new Array<number>(colWidths.length).fill(0);
    const rowScores = new Array<number>(rowHeights.length).fill(0);

    // Build cumulative offsets
    const colOffsets: number[] = [0];
    for (const w of colWidths) colOffsets.push(colOffsets[colOffsets.length - 1] + w);
    const rowOffsets: number[] = [0];
    for (const h of rowHeights) rowOffsets.push(rowOffsets[rowOffsets.length - 1] + h);

    // Walk the diff map
    for (let y = 0; y < imgHeight; y++) {
      for (let x = 0; x < imgWidth; x++) {
        if (diff.diffMap[y * imgWidth + x] > 0) {
          // Assign to column
          for (let c = 0; c < colWidths.length; c++) {
            if (x >= colOffsets[c] && x < colOffsets[c + 1]) {
              colScores[c]++;
              break;
            }
          }
          // Assign to row
          for (let r = 0; r < rowHeights.length; r++) {
            if (y >= rowOffsets[r] && y < rowOffsets[r + 1]) {
              rowScores[r]++;
              break;
            }
          }
        }
      }
    }

    return { colScores, rowScores };
  }

  /**
   * Determine which adjustments to try based on the diff distribution.
   * Returns the single best adjustment to try next.
   */
  private proposeAdjustment(
    diff: PixelDiffResult,
    data: ExcelStructuredData,
    imgWidth: number,
    imgHeight: number
  ): RepairAdjustment | null {
    const { colScores, rowScores } = this.regionDiffScores(
      diff,
      data,
      imgWidth,
      imgHeight
    );

    // Find the column or row with the highest diff score
    let maxColScore = 0;
    let maxColIdx = -1;
    for (let c = 0; c < colScores.length; c++) {
      if (colScores[c] > maxColScore) {
        maxColScore = colScores[c];
        maxColIdx = c;
      }
    }

    let maxRowScore = 0;
    let maxRowIdx = -1;
    for (let r = 0; r < rowScores.length; r++) {
      if (rowScores[r] > maxRowScore) {
        maxRowScore = rowScores[r];
        maxRowIdx = r;
      }
    }

    if (maxColScore === 0 && maxRowScore === 0) return null;

    // Determine whether column or row adjustment is more impactful
    if (maxColScore >= maxRowScore && maxColIdx >= 0) {
      // Check if the diff is at the right edge of the column (width issue)
      // or interior (padding issue)
      const colOffset = data.colWidths
        .slice(0, maxColIdx)
        .reduce((s, w) => s + w, 0);
      const colEnd = colOffset + data.colWidths[maxColIdx];

      let edgeDiffCount = 0;
      let interiorDiffCount = 0;
      const edgeMargin = Math.max(3, Math.floor(data.colWidths[maxColIdx] * 0.1));

      for (let y = 0; y < imgHeight; y++) {
        for (let x = colOffset; x < colEnd && x < imgWidth; x++) {
          if (diff.diffMap[y * imgWidth + x] > 0) {
            if (x >= colEnd - edgeMargin) edgeDiffCount++;
            else interiorDiffCount++;
          }
        }
      }

      if (edgeDiffCount > interiorDiffCount) {
        return {
          kind: "col_width",
          target: { col: maxColIdx },
          oldValue: data.colWidths[maxColIdx],
          newValue: data.colWidths[maxColIdx] + this.stepPx,
          diffBefore: diff.diffRatio,
          diffAfter: -1, // filled after evaluation
        };
      } else {
        // Try padding adjustment on cells in this column
        const paddingCell = data.cells.find((cell) => cell.c === maxColIdx);
        if (paddingCell) {
          return {
            kind: "padding",
            target: { row: paddingCell.r, col: maxColIdx },
            oldValue: paddingCell.style.padding.left,
            newValue: paddingCell.style.padding.left + this.stepPx,
            diffBefore: diff.diffRatio,
            diffAfter: -1,
          };
        }
      }
    }

    if (maxRowIdx >= 0) {
      return {
        kind: "row_height",
        target: { row: maxRowIdx },
        oldValue: data.rowHeights[maxRowIdx],
        newValue: data.rowHeights[maxRowIdx] + this.stepPx,
        diffBefore: diff.diffRatio,
        diffAfter: -1,
      };
    }

    return null;
  }

  /**
   * Apply an adjustment to the Excel data (mutates in place).
   */
  private applyAdjustment(
    data: ExcelStructuredData,
    adj: RepairAdjustment
  ): void {
    switch (adj.kind) {
      case "col_width":
        if (adj.target.col !== undefined) {
          data.colWidths[adj.target.col] = adj.newValue;
        }
        break;
      case "row_height":
        if (adj.target.row !== undefined) {
          data.rowHeights[adj.target.row] = adj.newValue;
        }
        break;
      case "padding": {
        const cell = data.cells.find(
          (c) => c.r === adj.target.row && c.c === adj.target.col
        );
        if (cell) {
          cell.style.padding.left = adj.newValue;
          cell.style.padding.right = adj.newValue;
        }
        break;
      }
      case "font_size": {
        const cell = data.cells.find(
          (c) => c.r === adj.target.row && c.c === adj.target.col
        );
        if (cell) {
          cell.format.fontSize = adj.newValue;
        }
        break;
      }
      case "border_width": {
        const cell = data.cells.find(
          (c) => c.r === adj.target.row && c.c === adj.target.col
        );
        if (cell) {
          cell.style.borders.top.width = adj.newValue;
          cell.style.borders.bottom.width = adj.newValue;
          cell.style.borders.left.width = adj.newValue;
          cell.style.borders.right.width = adj.newValue;
        }
        break;
      }
    }
  }

  /**
   * Revert an adjustment (undo).
   */
  private revertAdjustment(
    data: ExcelStructuredData,
    adj: RepairAdjustment
  ): void {
    const reverse: RepairAdjustment = {
      ...adj,
      oldValue: adj.newValue,
      newValue: adj.oldValue,
    };
    this.applyAdjustment(data, reverse);
  }

  /**
   * Run the repair loop: render -> diff -> propose adjustment -> apply -> repeat.
   */
  async run(
    data: ExcelStructuredData,
    sourceImage: ImageBuffer,
    renderFn: RenderFn,
    diffFn: DiffFn
  ): Promise<{
    iterations: number;
    adjustments: RepairAdjustment[];
    finalDiff: PixelDiffResult;
    converged: boolean;
  }> {
    const adjustments: RepairAdjustment[] = [];
    let currentDiff: PixelDiffResult;
    let iteration = 0;

    // Initial render and diff
    let rendered = await renderFn(data);
    currentDiff = diffFn(sourceImage, rendered);

    while (
      iteration < this.maxIterations &&
      currentDiff.diffRatio > this.targetDiffRatio
    ) {
      iteration++;

      const adj = this.proposeAdjustment(
        currentDiff,
        data,
        rendered.width,
        rendered.height
      );

      if (!adj) break; // No more adjustments to try

      // Apply and evaluate
      this.applyAdjustment(data, adj);
      const newRendered = await renderFn(data);
      const newDiff = diffFn(sourceImage, newRendered);

      adj.diffAfter = newDiff.diffRatio;

      if (newDiff.diffRatio < currentDiff.diffRatio) {
        // Improvement — keep the adjustment
        adjustments.push(adj);
        currentDiff = newDiff;
        rendered = newRendered;
      } else {
        // No improvement — revert and try the opposite direction
        this.revertAdjustment(data, adj);

        const reverseAdj: RepairAdjustment = {
          ...adj,
          newValue: adj.oldValue - this.stepPx,
          diffBefore: currentDiff.diffRatio,
          diffAfter: -1,
        };

        if (reverseAdj.newValue > 0) {
          this.applyAdjustment(data, reverseAdj);
          const revRendered = await renderFn(data);
          const revDiff = diffFn(sourceImage, revRendered);
          reverseAdj.diffAfter = revDiff.diffRatio;

          if (revDiff.diffRatio < currentDiff.diffRatio) {
            adjustments.push(reverseAdj);
            currentDiff = revDiff;
            rendered = revRendered;
          } else {
            this.revertAdjustment(data, reverseAdj);
          }
        }
      }
    }

    return {
      iterations: iteration,
      adjustments,
      finalDiff: currentDiff,
      converged: currentDiff.diffRatio <= this.targetDiffRatio,
    };
  }
}

// ─── Pixel Diff Computation ───────────────────────────────────────────

export function computePixelDiff(
  a: ImageBuffer,
  b: ImageBuffer
): PixelDiffResult {
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const totalPixels = w * h;
  const diffMap = new Uint8Array(w * h);

  let diffPixels = 0;
  let maxChannelDiff = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pa = pixelAt(a, x, y);
      const pb = pixelAt(b, x, y);

      const dr = Math.abs(pa.r - pb.r);
      const dg = Math.abs(pa.g - pb.g);
      const db = Math.abs(pa.b - pb.b);
      const maxDiff = Math.max(dr, dg, db);

      if (maxDiff > maxChannelDiff) maxChannelDiff = maxDiff;

      if (maxDiff > 2) {
        // Threshold of 2 to ignore sub-pixel antialiasing
        diffMap[y * w + x] = maxDiff;
        diffPixels++;
      }
    }
  }

  // Handle size mismatch: all extra pixels count as diff
  const extraPixels =
    Math.abs(a.width * a.height - b.width * b.height);
  diffPixels += extraPixels;

  // Find diff regions via simple flood-fill clustering
  const visited = new Uint8Array(w * h);
  const regions: BBox[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (diffMap[y * w + x] > 0 && !visited[y * w + x]) {
        // BFS to find connected diff region
        let minX = x,
          maxX = x,
          minY = y,
          maxY = y;
        const queue: Array<[number, number]> = [[x, y]];
        visited[y * w + x] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (const [nx, ny] of [
            [cx - 1, cy],
            [cx + 1, cy],
            [cx, cy - 1],
            [cx, cy + 1],
          ]) {
            if (
              nx >= 0 &&
              nx < w &&
              ny >= 0 &&
              ny < h &&
              !visited[ny * w + nx] &&
              diffMap[ny * w + nx] > 0
            ) {
              visited[ny * w + nx] = 1;
              queue.push([nx, ny]);
            }
          }
        }

        regions.push({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
        });
      }
    }
  }

  return {
    totalPixels: totalPixels + extraPixels,
    diffPixels,
    diffRatio: totalPixels > 0 ? diffPixels / (totalPixels + extraPixels) : 0,
    maxChannelDiff,
    diffMap,
    regions,
  };
}

// ─── Guided Question Builder ──────────────────────────────────────────
// Generates a single guided question for the lowest-confidence cell.

function buildGuidedQuestion(
  lowConfidenceCells: Array<{ row: number; col: number; confidence: number }>,
  values: CellValue[][],
  grid: DetectedGrid
): GuidedQuestion | null {
  if (lowConfidenceCells.length === 0) return null;

  // Pick the single worst-confidence cell
  const worst = lowConfidenceCells.reduce((prev, cur) =>
    cur.confidence < prev.confidence ? cur : prev
  );

  const cellVal = values[worst.row]?.[worst.col];
  if (!cellVal) return null;

  const cellRef = `${colLabel(worst.col)}${worst.row + 1}`;
  const bbox = grid.cellBounds[worst.row]?.[worst.col];
  if (!bbox) return null;

  // Build suggested answers: the OCR text + common alternatives
  const suggestions: string[] = [cellVal.text];

  // If it looks numeric, suggest with/without decimal shift
  if (cellVal.isNumeric && cellVal.numericValue !== undefined) {
    suggestions.push(String(cellVal.numericValue * 10));
    suggestions.push(String(cellVal.numericValue / 10));
  }

  // If it contains Arabic, suggest without diacritics
  if (cellVal.isRtl) {
    const stripped = cellVal.text.replace(/[\u064B-\u065F\u0670]/g, "");
    if (stripped !== cellVal.text) suggestions.push(stripped);
  }

  return {
    cellRef,
    row: worst.row,
    col: worst.col,
    ocrText: cellVal.text,
    confidence: worst.confidence,
    question: `Cell ${cellRef}: OCR read "${cellVal.text}" with ${Math.round(worst.confidence * 100)}% confidence. What is the correct value?`,
    suggestedAnswers: [...new Set(suggestions)],
    imageRegion: bbox,
  };
}

// ─── ImageTableToExcelPipeline ────────────────────────────────────────
// Orchestrates the full Section 6.4 pipeline.

export interface PipelineConfig {
  ocrEngine: OCREngine;
  renderFn: RenderFn;
  gridDetectorOpts?: ConstructorParameters<typeof GridDetector>[0];
  mergeDetectorOpts?: ConstructorParameters<typeof MergeDetector>[0];
  borderExtractorOpts?: ConstructorParameters<typeof BorderStyleExtractor>[0];
  cellExtractorOpts?: { confidenceThreshold?: number };
  repairLoopOpts?: ConstructorParameters<typeof TableRepairLoop>[0];
}

export class ImageTableToExcelPipeline {
  private readonly gridDetector: GridDetector;
  private readonly mergeDetector: MergeDetector;
  private readonly borderExtractor: BorderStyleExtractor;
  private readonly cellExtractor: CellExtractor;
  private readonly exporter: ExcelStructuredExporter;
  private readonly repairLoop: TableRepairLoop;
  private readonly renderFn: RenderFn;

  constructor(config: PipelineConfig) {
    this.gridDetector = new GridDetector(config.gridDetectorOpts);
    this.mergeDetector = new MergeDetector(config.mergeDetectorOpts);
    this.borderExtractor = new BorderStyleExtractor(config.borderExtractorOpts);
    this.cellExtractor = new CellExtractor(
      config.ocrEngine,
      config.cellExtractorOpts
    );
    this.exporter = new ExcelStructuredExporter();
    this.repairLoop = new TableRepairLoop(config.repairLoopOpts);
    this.renderFn = config.renderFn;
  }

  /**
   * Execute the full pipeline:
   * 1. Grid detection (line scanning)
   * 2. Merge detection (connected component analysis)
   * 3. Cell OCR extraction (with Arabic support)
   * 4. Border/fill/padding style extraction
   * 5. Build structured XLSX data
   * 6. Repair loop until PixelDiff=0
   * 7. Generate guided question if low-confidence OCR
   */
  async execute(sourceImage: ImageBuffer): Promise<PipelineResult> {
    // Step 1: Detect grid
    const grid = this.gridDetector.detect(sourceImage);

    if (grid.rows === 0 || grid.cols === 0) {
      throw new Error(
        `Grid detection failed: found ${grid.horizontalLines.length} horizontal and ${grid.verticalLines.length} vertical lines, producing ${grid.rows}x${grid.cols} grid. Minimum 1x1 grid required.`
      );
    }

    // Step 2: Detect merged cells
    const merges = this.mergeDetector.detect(sourceImage, grid);

    // Step 3: Extract cell values via OCR
    const { values, formats, lowConfidenceCells } =
      await this.cellExtractor.extractAll(sourceImage, grid);

    // Step 4: Extract styles for all cells
    const styles: CellStyle[][] = [];
    for (let r = 0; r < grid.rows; r++) {
      const styleRow: CellStyle[] = [];
      for (let c = 0; c < grid.cols; c++) {
        const bbox = grid.cellBounds[r][c];
        styleRow.push(this.borderExtractor.extract(sourceImage, bbox));
      }
      styles.push(styleRow);
    }

    // Step 5: Build structured Excel data
    const excelData = this.exporter.build(grid, values, formats, styles, merges);

    // Step 6: Repair loop for PixelDiff=0
    const repairResult = await this.repairLoop.run(
      excelData,
      sourceImage,
      this.renderFn,
      computePixelDiff
    );

    // Step 7: Generate guided question (single question only) for lowest confidence
    const guidedQuestion = buildGuidedQuestion(
      lowConfidenceCells,
      values,
      grid
    );

    return {
      excelData,
      pixelDiff: repairResult.finalDiff,
      repairIterations: repairResult.iterations,
      adjustments: repairResult.adjustments,
      guidedQuestion,
      converged: repairResult.converged,
    };
  }

  /**
   * Apply a user answer to a guided question, updating the cell value
   * and re-running the repair loop.
   */
  async applyGuidedAnswer(
    result: PipelineResult,
    answer: string,
    sourceImage: ImageBuffer
  ): Promise<PipelineResult> {
    if (!result.guidedQuestion) return result;

    const { row, col } = result.guidedQuestion;

    // Update the cell value
    const cell = result.excelData.cells.find(
      (c) => c.r === row && c.c === col
    );
    if (cell) {
      cell.value = answer;
      cell.ocrConfidence = 1.0;

      // Re-check numeric status
      const stripped = answer
        .replace(/[\s,،٬]/g, "")
        .replace(/[٠-٩]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 48)
        );
      const numericMatch = stripped.match(/^[+-]?\d+(\.\d+)?(%)?$/);
      cell.isNumeric = numericMatch !== null;
      cell.numericValue = cell.isNumeric ? parseFloat(stripped) : undefined;
    }

    // Re-run repair loop with updated data
    const repairResult = await this.repairLoop.run(
      result.excelData,
      sourceImage,
      this.renderFn,
      computePixelDiff
    );

    return {
      excelData: result.excelData,
      pixelDiff: repairResult.finalDiff,
      repairIterations: repairResult.iterations,
      adjustments: repairResult.adjustments,
      guidedQuestion: null, // Already answered
      converged: repairResult.converged,
    };
  }
}
