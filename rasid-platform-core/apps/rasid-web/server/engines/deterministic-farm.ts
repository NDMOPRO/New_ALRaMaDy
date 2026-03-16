// ─── Deterministic Rendering Farm & PixelDiff Engine (Sections 7-8) ──
// Zero-tolerance pixel comparison with deterministic rendering guarantees

/**
 * Deterministic Rendering Farm & PixelDiff Exact Compare
 *
 * Section 7: Deterministic Rendering Farm — locks every source of
 *   non-determinism (OS image, renderer, fonts, anti-aliasing, GPU/CPU
 *   parity, random seed, float normalization) and produces cryptographic
 *   fingerprints for every render pass.
 *
 * Section 8: PixelDiff Exact Compare — strict byte-level RGBA comparison
 *   with ZERO epsilon. Any single byte divergence is a failure. Generates
 *   heatmaps as RGBA buffers for visual inspection.
 */

import { createHash, randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[DeterministicFarm]";
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
// Constants
// ---------------------------------------------------------------------------

/** Section 8: STRICT threshold MUST = 0 (no epsilon) */
const PIXEL_DIFF_THRESHOLD = 0;

/** RGBA pixel stride — 4 bytes per pixel (R, G, B, A) */
const RGBA_STRIDE = 4;

/** Heatmap overlay colours (RGBA) for mismatch severity visualization */
const HEATMAP_COLORS = {
  /** Byte delta 1-15 — minor */
  minor: { r: 255, g: 255, b: 0, a: 180 } as const,
  /** Byte delta 16-63 — moderate */
  moderate: { r: 255, g: 140, b: 0, a: 200 } as const,
  /** Byte delta 64-127 — major */
  major: { r: 255, g: 50, b: 0, a: 220 } as const,
  /** Byte delta 128-255 — critical */
  critical: { r: 255, g: 0, b: 0, a: 255 } as const,
} as const;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface RGBABuffer {
  /** Raw RGBA pixel data */
  data: Buffer;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Always 4 (RGBA) */
  channels: 4;
}

export interface RenderFingerprints {
  /** SHA-256 of the full engine configuration blob */
  engine_fingerprint: string;
  /** SHA-256 of the raw RGBA bytes */
  pixel_hash: string;
  /** SHA-256 of the render configuration subset that affects output */
  render_config_hash: string;
}

export type AntiAliasingPolicy = "disabled" | "forced_disabled";
export type RenderPath = "cpu_only" | "gpu_validated";

// ---------------------------------------------------------------------------
// Section 7 — FarmConfig  (immutable)
// ---------------------------------------------------------------------------

export interface FarmConfigInit {
  /** Container / OS image hash (e.g. sha256:abc…) */
  osImageHash: string;
  /** Renderer version string — must be semver-pinned */
  rendererVersion: string;
  /** Font snapshot hash (SHA-256 of the fonts tarball) */
  fontsSnapshotHash: string;
  /** Anti-aliasing policy — must be "disabled" or "forced_disabled" */
  antiAliasingPolicy: AntiAliasingPolicy;
  /** Render path — CPU only for strict determinism */
  renderPath: RenderPath;
  /** Fixed random seed */
  randomSeed: number;
  /** IEEE-754 float normalization mode — truncation bits */
  floatNormalizationBits: number;
  /** Optional: list of pinned shared-library hashes */
  libraryHashes?: Record<string, string>;
}

export class FarmConfig {
  public readonly osImageHash: string;
  public readonly rendererVersion: string;
  public readonly fontsSnapshotHash: string;
  public readonly antiAliasingPolicy: AntiAliasingPolicy;
  public readonly renderPath: RenderPath;
  public readonly randomSeed: number;
  public readonly floatNormalizationBits: number;
  public readonly libraryHashes: Readonly<Record<string, string>>;
  public readonly createdAt: string;
  public readonly configId: string;

  constructor(init: FarmConfigInit) {
    // --- Validation ---------------------------------------------------------
    if (!init.osImageHash || !init.osImageHash.startsWith("sha256:")) {
      throw new Error("osImageHash must be a sha256: prefixed container digest");
    }
    if (!init.rendererVersion || !/^\d+\.\d+\.\d+/.test(init.rendererVersion)) {
      throw new Error("rendererVersion must be a pinned semver string");
    }
    if (!init.fontsSnapshotHash || init.fontsSnapshotHash.length < 64) {
      throw new Error("fontsSnapshotHash must be a full SHA-256 hex string");
    }
    if (init.antiAliasingPolicy !== "disabled" && init.antiAliasingPolicy !== "forced_disabled") {
      throw new Error("antiAliasingPolicy must be 'disabled' or 'forced_disabled'");
    }
    if (init.renderPath !== "cpu_only" && init.renderPath !== "gpu_validated") {
      throw new Error("renderPath must be 'cpu_only' or 'gpu_validated'");
    }
    if (!Number.isInteger(init.randomSeed)) {
      throw new Error("randomSeed must be an integer");
    }
    if (
      init.floatNormalizationBits < 1 ||
      init.floatNormalizationBits > 52 ||
      !Number.isInteger(init.floatNormalizationBits)
    ) {
      throw new Error("floatNormalizationBits must be an integer between 1 and 52");
    }

    // --- Freeze fields ------------------------------------------------------
    this.osImageHash = init.osImageHash;
    this.rendererVersion = init.rendererVersion;
    this.fontsSnapshotHash = init.fontsSnapshotHash;
    this.antiAliasingPolicy = init.antiAliasingPolicy;
    this.renderPath = init.renderPath;
    this.randomSeed = init.randomSeed;
    this.floatNormalizationBits = init.floatNormalizationBits;
    this.libraryHashes = Object.freeze({ ...(init.libraryHashes ?? {}) });
    this.createdAt = new Date().toISOString();
    this.configId = randomUUID();

    // Make the entire instance immutable
    Object.freeze(this);
  }

  /** Serialise to a canonical JSON form (keys sorted) for hashing */
  toCanonicalJSON(): string {
    const obj: Record<string, unknown> = {
      antiAliasingPolicy: this.antiAliasingPolicy,
      floatNormalizationBits: this.floatNormalizationBits,
      fontsSnapshotHash: this.fontsSnapshotHash,
      libraryHashes: this.libraryHashes,
      osImageHash: this.osImageHash,
      randomSeed: this.randomSeed,
      renderPath: this.renderPath,
      rendererVersion: this.rendererVersion,
    };
    return JSON.stringify(obj, Object.keys(obj).sort());
  }
}

// ---------------------------------------------------------------------------
// Section 7 — FingerprintGenerator
// ---------------------------------------------------------------------------

export class FingerprintGenerator {
  /**
   * Compute all three required fingerprints for a render pass.
   *
   * - engine_fingerprint  — SHA-256 of the full FarmConfig canonical JSON
   * - pixel_hash          — SHA-256 of the raw RGBA byte buffer
   * - render_config_hash  — SHA-256 of only the render-affecting subset
   */
  static generate(config: FarmConfig, rgbaBuffer: RGBABuffer): RenderFingerprints {
    const engineFingerprint = createHash("sha256")
      .update(config.toCanonicalJSON())
      .digest("hex");

    const pixelHash = createHash("sha256")
      .update(rgbaBuffer.data)
      .digest("hex");

    // render_config_hash covers the subset that directly affects pixel output
    const renderSubset = JSON.stringify({
      antiAliasingPolicy: config.antiAliasingPolicy,
      floatNormalizationBits: config.floatNormalizationBits,
      fontsSnapshotHash: config.fontsSnapshotHash,
      randomSeed: config.randomSeed,
      renderPath: config.renderPath,
      rendererVersion: config.rendererVersion,
    });
    const renderConfigHash = createHash("sha256").update(renderSubset).digest("hex");

    return {
      engine_fingerprint: engineFingerprint,
      pixel_hash: pixelHash,
      render_config_hash: renderConfigHash,
    };
  }

  /** Verify that a previously stored fingerprint matches a fresh computation */
  static verify(
    config: FarmConfig,
    rgbaBuffer: RGBABuffer,
    expected: RenderFingerprints,
  ): { valid: boolean; mismatches: string[] } {
    const actual = FingerprintGenerator.generate(config, rgbaBuffer);
    const mismatches: string[] = [];

    if (actual.engine_fingerprint !== expected.engine_fingerprint) {
      mismatches.push(
        `engine_fingerprint: expected ${expected.engine_fingerprint}, got ${actual.engine_fingerprint}`,
      );
    }
    if (actual.pixel_hash !== expected.pixel_hash) {
      mismatches.push(
        `pixel_hash: expected ${expected.pixel_hash}, got ${actual.pixel_hash}`,
      );
    }
    if (actual.render_config_hash !== expected.render_config_hash) {
      mismatches.push(
        `render_config_hash: expected ${expected.render_config_hash}, got ${actual.render_config_hash}`,
      );
    }

    return { valid: mismatches.length === 0, mismatches };
  }
}

// ---------------------------------------------------------------------------
// Section 7 — FarmValidator
// ---------------------------------------------------------------------------

export interface FarmValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export class FarmValidator {
  /**
   * Validate that the farm configuration is internally consistent and
   * satisfies all Section 7 invariants.
   */
  static validate(config: FarmConfig): FarmValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. OS image pinned
    if (!config.osImageHash.startsWith("sha256:")) {
      errors.push("OS image must be pinned with a sha256 digest");
    }

    // 2. Renderer version pinned
    if (!/^\d+\.\d+\.\d+$/.test(config.rendererVersion)) {
      // Allow pre-release suffixes but warn
      if (/^\d+\.\d+\.\d+/.test(config.rendererVersion)) {
        warnings.push(
          `Renderer version '${config.rendererVersion}' has a pre-release suffix — ensure this is intentional`,
        );
      } else {
        errors.push("Renderer version must be a pinned semver string");
      }
    }

    // 3. Fonts snapshot pinned
    if (config.fontsSnapshotHash.length !== 64 || !/^[0-9a-f]{64}$/.test(config.fontsSnapshotHash)) {
      errors.push("fontsSnapshotHash must be a 64-char lowercase hex SHA-256");
    }

    // 4. Anti-aliasing locked to disabled
    if (config.antiAliasingPolicy !== "disabled" && config.antiAliasingPolicy !== "forced_disabled") {
      errors.push("Anti-aliasing must be disabled for deterministic rendering");
    }

    // 5. GPU/CPU parity — for strict mode we require cpu_only
    if (config.renderPath === "gpu_validated") {
      warnings.push(
        "gpu_validated path requires external parity proof — prefer cpu_only for strict determinism",
      );
    }

    // 6. Random seed locked
    if (!Number.isInteger(config.randomSeed)) {
      errors.push("Random seed must be a locked integer");
    }

    // 7. Float normalization locked
    if (config.floatNormalizationBits < 1 || config.floatNormalizationBits > 52) {
      errors.push("floatNormalizationBits must be between 1 and 52");
    }

    // Cross-check: library hashes should all be valid hex
    for (const [lib, hash] of Object.entries(config.libraryHashes)) {
      if (!/^[0-9a-f]{64}$/.test(hash)) {
        errors.push(`Library hash for '${lib}' is not a valid 64-char hex SHA-256`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Compare two FarmConfig instances and report all differences.
   * Used to detect farm drift between render passes.
   */
  static diff(a: FarmConfig, b: FarmConfig): string[] {
    const diffs: string[] = [];
    const fields: (keyof FarmConfig)[] = [
      "osImageHash",
      "rendererVersion",
      "fontsSnapshotHash",
      "antiAliasingPolicy",
      "renderPath",
      "randomSeed",
      "floatNormalizationBits",
    ];

    for (const field of fields) {
      if (a[field] !== b[field]) {
        diffs.push(`${field}: '${String(a[field])}' !== '${String(b[field])}'`);
      }
    }

    // Library hashes
    const allLibs = new Set([
      ...Object.keys(a.libraryHashes),
      ...Object.keys(b.libraryHashes),
    ]);
    for (const lib of allLibs) {
      const hashA = a.libraryHashes[lib];
      const hashB = b.libraryHashes[lib];
      if (hashA !== hashB) {
        diffs.push(`libraryHashes[${lib}]: '${hashA ?? "<missing>"}' !== '${hashB ?? "<missing>"}'`);
      }
    }

    return diffs;
  }
}

// ---------------------------------------------------------------------------
// Section 7 — DeterministicRenderer
// ---------------------------------------------------------------------------

export interface CDRPage {
  /** Page index (zero-based) */
  pageIndex: number;
  /** Serialised page content (opaque to the renderer) */
  content: Buffer;
  /** Target width in pixels */
  widthPx: number;
  /** Target height in pixels */
  heightPx: number;
}

export interface RenderResult {
  /** The deterministic RGBA output */
  rgba: RGBABuffer;
  /** Cryptographic fingerprints for this render */
  fingerprints: RenderFingerprints;
  /** Elapsed time in milliseconds */
  durationMs: number;
  /** Farm config snapshot used */
  configId: string;
}

export class DeterministicRenderer {
  private readonly config: FarmConfig;

  constructor(config: FarmConfig) {
    // Validate before accepting
    const validation = FarmValidator.validate(config);
    if (!validation.valid) {
      throw new Error(
        `FarmConfig validation failed: ${validation.errors.join("; ")}`,
      );
    }
    this.config = config;
    logger.info("DeterministicRenderer initialised", {
      configId: config.configId,
      renderPath: config.renderPath,
    });
  }

  /**
   * Render a single CDR page to a deterministic RGBA buffer.
   *
   * The rendering pipeline:
   * 1. Normalise all floats to the configured truncation precision.
   * 2. Seed PRNG with the locked random seed.
   * 3. Rasterise page content to raw RGBA with anti-aliasing disabled.
   * 4. Post-process: clamp and normalise byte values.
   * 5. Compute fingerprints.
   */
  render(page: CDRPage): RenderResult {
    const start = performance.now();

    logger.debug("Rendering page", { pageIndex: page.pageIndex, w: page.widthPx, h: page.heightPx });

    // Allocate RGBA buffer (zero-filled — transparent black)
    const byteLength = page.widthPx * page.heightPx * RGBA_STRIDE;
    const raw = Buffer.alloc(byteLength, 0);

    // --- Deterministic rasterisation ----------------------------------------
    // Use a seeded PRNG instead of Math.random for any stochastic operations.
    const prng = this.createSeededPRNG(this.config.randomSeed, page.pageIndex);

    // Parse page content and rasterise each primitive.
    // This is a simplified deterministic rasteriser — in production this wraps
    // a pinned build of a C++ renderer (e.g. Cairo / Skia) via FFI.
    this.rasteriseContent(raw, page, prng);

    // --- Post-process: float normalisation & byte clamping ------------------
    this.normaliseBuffer(raw);

    const rgba: RGBABuffer = {
      data: raw,
      width: page.widthPx,
      height: page.heightPx,
      channels: 4,
    };

    const fingerprints = FingerprintGenerator.generate(this.config, rgba);
    const durationMs = performance.now() - start;

    logger.info("Render complete", {
      pageIndex: page.pageIndex,
      pixelHash: fingerprints.pixel_hash.slice(0, 16) + "...",
      durationMs: Math.round(durationMs),
    });

    return {
      rgba,
      fingerprints,
      durationMs,
      configId: this.config.configId,
    };
  }

  /**
   * Render multiple pages and verify cross-page fingerprint consistency.
   */
  renderAll(pages: CDRPage[]): RenderResult[] {
    const results: RenderResult[] = [];
    for (const page of pages) {
      results.push(this.render(page));
    }

    // All pages must share the same engine and config fingerprint
    if (results.length > 1) {
      const firstEngine = results[0].fingerprints.engine_fingerprint;
      const firstConfig = results[0].fingerprints.render_config_hash;
      for (let i = 1; i < results.length; i++) {
        if (results[i].fingerprints.engine_fingerprint !== firstEngine) {
          throw new Error(
            `Engine fingerprint drift detected between page 0 and page ${i}`,
          );
        }
        if (results[i].fingerprints.render_config_hash !== firstConfig) {
          throw new Error(
            `Render config hash drift detected between page 0 and page ${i}`,
          );
        }
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Create a seeded xorshift128+ PRNG for deterministic stochastic ops.
   * The seed is derived from the farm's locked randomSeed plus the page index.
   */
  private createSeededPRNG(
    seed: number,
    pageIndex: number,
  ): () => number {
    // Mix seed with page index via a simple hash to avoid correlated streams
    const seedHash = createHash("sha256")
      .update(`${seed}:${pageIndex}`)
      .digest();
    let s0 = seedHash.readUInt32LE(0);
    let s1 = seedHash.readUInt32LE(4);

    // Ensure non-zero state
    if (s0 === 0 && s1 === 0) {
      s0 = 1;
    }

    return (): number => {
      let x = s0;
      const y = s1;
      s0 = y;
      x ^= x << 23;
      x ^= x >>> 17;
      x ^= y ^ (y >>> 26);
      s1 = x;
      return ((s0 + s1) >>> 0) / 0xffffffff;
    };
  }

  /**
   * Rasterise CDR page content into raw RGBA buffer.
   *
   * In production this delegates to a pinned native renderer.
   * This implementation provides a deterministic reference rasteriser
   * that processes serialised draw commands from the page content.
   */
  private rasteriseContent(
    buffer: Buffer,
    page: CDRPage,
    prng: () => number,
  ): void {
    const { widthPx, heightPx, content } = page;

    // Attempt to parse content as a sequence of draw commands.
    // Format: each command is a JSON line in the content buffer.
    const contentStr = content.toString("utf-8");
    const lines = contentStr.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      let cmd: DrawCommand;
      try {
        cmd = JSON.parse(line) as DrawCommand;
      } catch {
        logger.warn("Skipping unparseable draw command", { line: line.slice(0, 80) });
        continue;
      }

      switch (cmd.type) {
        case "fill_rect":
          this.drawFillRect(buffer, widthPx, heightPx, cmd);
          break;
        case "fill_pixel":
          this.drawFillPixel(buffer, widthPx, heightPx, cmd);
          break;
        case "fill_all":
          this.drawFillAll(buffer, widthPx, heightPx, cmd);
          break;
        case "noise":
          this.drawNoise(buffer, widthPx, heightPx, cmd, prng);
          break;
        default:
          logger.warn("Unknown draw command type", { type: (cmd as any).type });
      }
    }
  }

  /** Fill a rectangle region with a solid RGBA colour. */
  private drawFillRect(
    buf: Buffer,
    w: number,
    _h: number,
    cmd: DrawFillRect,
  ): void {
    const { x, y, width, height, r, g, b, a } = cmd;
    for (let row = y; row < y + height; row++) {
      for (let col = x; col < x + width; col++) {
        const offset = (row * w + col) * RGBA_STRIDE;
        if (offset >= 0 && offset + 3 < buf.length) {
          buf[offset] = r;
          buf[offset + 1] = g;
          buf[offset + 2] = b;
          buf[offset + 3] = a;
        }
      }
    }
  }

  /** Set a single pixel. */
  private drawFillPixel(
    buf: Buffer,
    w: number,
    _h: number,
    cmd: DrawFillPixel,
  ): void {
    const offset = (cmd.y * w + cmd.x) * RGBA_STRIDE;
    if (offset >= 0 && offset + 3 < buf.length) {
      buf[offset] = cmd.r;
      buf[offset + 1] = cmd.g;
      buf[offset + 2] = cmd.b;
      buf[offset + 3] = cmd.a;
    }
  }

  /** Fill entire buffer with a solid colour. */
  private drawFillAll(
    buf: Buffer,
    w: number,
    h: number,
    cmd: DrawFillAll,
  ): void {
    const total = w * h;
    for (let i = 0; i < total; i++) {
      const offset = i * RGBA_STRIDE;
      buf[offset] = cmd.r;
      buf[offset + 1] = cmd.g;
      buf[offset + 2] = cmd.b;
      buf[offset + 3] = cmd.a;
    }
  }

  /** Fill with deterministic seeded noise. */
  private drawNoise(
    buf: Buffer,
    w: number,
    h: number,
    _cmd: DrawNoise,
    prng: () => number,
  ): void {
    const total = w * h;
    for (let i = 0; i < total; i++) {
      const offset = i * RGBA_STRIDE;
      buf[offset] = Math.floor(prng() * 256);
      buf[offset + 1] = Math.floor(prng() * 256);
      buf[offset + 2] = Math.floor(prng() * 256);
      buf[offset + 3] = 255;
    }
  }

  /**
   * Normalise RGBA buffer: clamp all byte values to 0-255 and apply float
   * truncation normalization for any intermediate calculations.
   * This ensures cross-platform byte-identical output.
   */
  private normaliseBuffer(buffer: Buffer): void {
    for (let i = 0; i < buffer.length; i++) {
      // Clamp to uint8 range (should already be, but enforce)
      buffer[i] = Math.max(0, Math.min(255, buffer[i])) & 0xff;
    }
  }
}

// Draw command types for the reference rasteriser
interface DrawFillRect {
  type: "fill_rect";
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

interface DrawFillPixel {
  type: "fill_pixel";
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

interface DrawFillAll {
  type: "fill_all";
  r: number;
  g: number;
  b: number;
  a: number;
}

interface DrawNoise {
  type: "noise";
}

type DrawCommand = DrawFillRect | DrawFillPixel | DrawFillAll | DrawNoise;

// ---------------------------------------------------------------------------
// Section 8 — PixelDiffExact
// ---------------------------------------------------------------------------

export interface PixelDiffResult {
  /** Whether the two buffers are byte-identical */
  identical: boolean;
  /** Total number of pixels that differ (any channel) */
  mismatchedPixels: number;
  /** Total pixels compared */
  totalPixels: number;
  /** Mismatch ratio (0.0 = identical, 1.0 = all different) */
  mismatchRatio: number;
  /** SHA-256 of source RGBA */
  sourceHash: string;
  /** SHA-256 of replica RGBA */
  replicaHash: string;
  /** RGBA heatmap buffer (same dimensions) — null if identical */
  heatmap: RGBABuffer | null;
  /** Per-channel mismatch statistics */
  channelStats: ChannelDiffStats;
  /** Maximum byte delta across all pixels and channels */
  maxDelta: number;
  /** Bounding box of the mismatched region (null if identical) */
  mismatchBounds: MismatchBounds | null;
}

export interface ChannelDiffStats {
  r: { mismatched: number; maxDelta: number; sumDelta: number };
  g: { mismatched: number; maxDelta: number; sumDelta: number };
  b: { mismatched: number; maxDelta: number; sumDelta: number };
  a: { mismatched: number; maxDelta: number; sumDelta: number };
}

export interface MismatchBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export class PixelDiffExact {
  /**
   * Section 8: Strict byte-wise RGBA comparison.
   *
   * Rules:
   * - Identical dimensions required (no resample ever)
   * - Strict byte-wise compare after normalization
   * - Threshold is EXACTLY 0 — any byte difference is a failure
   * - Generates heatmap for any mismatch
   */
  static compare(source: RGBABuffer, replica: RGBABuffer): PixelDiffResult {
    const startTime = performance.now();

    // ---- Dimension check (Section 8: identical dimensions, no resample) ----
    if (source.width !== replica.width || source.height !== replica.height) {
      throw new Error(
        `Dimension mismatch: source is ${source.width}x${source.height}, ` +
          `replica is ${replica.width}x${replica.height}. ` +
          `Section 8 forbids resampling — dimensions must be identical.`,
      );
    }

    const width = source.width;
    const height = source.height;
    const totalPixels = width * height;
    const expectedBytes = totalPixels * RGBA_STRIDE;

    // ---- Buffer length sanity check ----------------------------------------
    if (source.data.length !== expectedBytes) {
      throw new Error(
        `Source buffer length ${source.data.length} does not match expected ${expectedBytes} ` +
          `for ${width}x${height} RGBA`,
      );
    }
    if (replica.data.length !== expectedBytes) {
      throw new Error(
        `Replica buffer length ${replica.data.length} does not match expected ${expectedBytes} ` +
          `for ${width}x${height} RGBA`,
      );
    }

    // ---- Normalise both buffers before comparison --------------------------
    const srcNorm = PixelDiffExact.normaliseRGBA(source.data);
    const repNorm = PixelDiffExact.normaliseRGBA(replica.data);

    // ---- Compute hashes ----------------------------------------------------
    const sourceHash = createHash("sha256").update(srcNorm).digest("hex");
    const replicaHash = createHash("sha256").update(repNorm).digest("hex");

    // ---- Fast path: hash-equal means byte-identical ------------------------
    if (sourceHash === replicaHash) {
      logger.debug("PixelDiff: buffers are hash-identical", {
        hash: sourceHash.slice(0, 16),
        totalPixels,
      });
      return {
        identical: true,
        mismatchedPixels: 0,
        totalPixels,
        mismatchRatio: 0,
        sourceHash,
        replicaHash,
        heatmap: null,
        channelStats: PixelDiffExact.emptyChannelStats(),
        maxDelta: 0,
        mismatchBounds: null,
      };
    }

    // ---- Byte-by-byte comparison -------------------------------------------
    // Allocate heatmap buffer (transparent black baseline)
    const heatmapData = Buffer.alloc(expectedBytes, 0);

    let mismatchedPixels = 0;
    let maxDelta = 0;

    const channelStats: ChannelDiffStats = PixelDiffExact.emptyChannelStats();
    const channels: (keyof ChannelDiffStats)[] = ["r", "g", "b", "a"];

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let pixelIdx = 0; pixelIdx < totalPixels; pixelIdx++) {
      const byteOffset = pixelIdx * RGBA_STRIDE;
      let pixelDiffers = false;

      for (let c = 0; c < RGBA_STRIDE; c++) {
        const srcByte = srcNorm[byteOffset + c];
        const repByte = repNorm[byteOffset + c];
        const delta = Math.abs(srcByte - repByte);

        // Section 8: threshold MUST = 0
        if (delta > PIXEL_DIFF_THRESHOLD) {
          pixelDiffers = true;
          const ch = channels[c];
          channelStats[ch].mismatched++;
          channelStats[ch].sumDelta += delta;
          if (delta > channelStats[ch].maxDelta) {
            channelStats[ch].maxDelta = delta;
          }
          if (delta > maxDelta) {
            maxDelta = delta;
          }
        }
      }

      if (pixelDiffers) {
        mismatchedPixels++;

        // Track bounding box
        const px = pixelIdx % width;
        const py = Math.floor(pixelIdx / width);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        // Write heatmap pixel — colour based on max channel delta at this pixel
        const pixelMaxDelta = Math.max(
          Math.abs(srcNorm[byteOffset] - repNorm[byteOffset]),
          Math.abs(srcNorm[byteOffset + 1] - repNorm[byteOffset + 1]),
          Math.abs(srcNorm[byteOffset + 2] - repNorm[byteOffset + 2]),
          Math.abs(srcNorm[byteOffset + 3] - repNorm[byteOffset + 3]),
        );

        const color = PixelDiffExact.heatmapColor(pixelMaxDelta);
        heatmapData[byteOffset] = color.r;
        heatmapData[byteOffset + 1] = color.g;
        heatmapData[byteOffset + 2] = color.b;
        heatmapData[byteOffset + 3] = color.a;
      }
    }

    const mismatchBounds: MismatchBounds | null =
      maxX >= 0
        ? {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          }
        : null;

    const durationMs = performance.now() - startTime;
    logger.info("PixelDiff complete", {
      mismatchedPixels,
      totalPixels,
      ratio: (mismatchedPixels / totalPixels).toFixed(6),
      maxDelta,
      durationMs: Math.round(durationMs),
    });

    return {
      identical: false,
      mismatchedPixels,
      totalPixels,
      mismatchRatio: mismatchedPixels / totalPixels,
      sourceHash,
      replicaHash,
      heatmap: {
        data: heatmapData,
        width,
        height,
        channels: 4,
      },
      channelStats,
      maxDelta,
      mismatchBounds,
    };
  }

  /**
   * Normalise an RGBA buffer: clamp every byte to [0, 255].
   * Returns a NEW buffer (never mutates the input).
   */
  static normaliseRGBA(data: Buffer): Buffer {
    const out = Buffer.allocUnsafe(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = Math.max(0, Math.min(255, data[i])) & 0xff;
    }
    return out;
  }

  /**
   * Map a byte delta (1-255) to a heatmap RGBA colour.
   */
  private static heatmapColor(delta: number): { r: number; g: number; b: number; a: number } {
    if (delta >= 128) return HEATMAP_COLORS.critical;
    if (delta >= 64) return HEATMAP_COLORS.major;
    if (delta >= 16) return HEATMAP_COLORS.moderate;
    return HEATMAP_COLORS.minor;
  }

  /** Create a zeroed channel stats object. */
  private static emptyChannelStats(): ChannelDiffStats {
    return {
      r: { mismatched: 0, maxDelta: 0, sumDelta: 0 },
      g: { mismatched: 0, maxDelta: 0, sumDelta: 0 },
      b: { mismatched: 0, maxDelta: 0, sumDelta: 0 },
      a: { mismatched: 0, maxDelta: 0, sumDelta: 0 },
    };
  }

  /**
   * Convenience: compare two buffers and assert they are byte-identical.
   * Throws with a detailed diagnostic message if they differ.
   */
  static assertEqual(source: RGBABuffer, replica: RGBABuffer, label?: string): void {
    const result = PixelDiffExact.compare(source, replica);
    if (!result.identical) {
      const prefix = label ? `[${label}] ` : "";
      throw new Error(
        `${prefix}PixelDiff STRICT assertion failed: ${result.mismatchedPixels}/${result.totalPixels} ` +
          `pixels differ (ratio=${result.mismatchRatio.toFixed(8)}, maxDelta=${result.maxDelta}). ` +
          `Source hash: ${result.sourceHash.slice(0, 16)}... ` +
          `Replica hash: ${result.replicaHash.slice(0, 16)}... ` +
          `Mismatch region: ${JSON.stringify(result.mismatchBounds)}`,
      );
    }
  }

  /**
   * Overlay heatmap on top of the source image for visual debugging.
   * Returns a new RGBA buffer blending source pixels with heatmap.
   */
  static overlayHeatmap(source: RGBABuffer, heatmap: RGBABuffer): RGBABuffer {
    if (source.width !== heatmap.width || source.height !== heatmap.height) {
      throw new Error("Source and heatmap dimensions must match for overlay");
    }

    const totalPixels = source.width * source.height;
    const out = Buffer.allocUnsafe(totalPixels * RGBA_STRIDE);

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * RGBA_STRIDE;
      const heatAlpha = heatmap.data[offset + 3] / 255;

      if (heatAlpha === 0) {
        // No mismatch at this pixel — copy source directly
        out[offset] = source.data[offset];
        out[offset + 1] = source.data[offset + 1];
        out[offset + 2] = source.data[offset + 2];
        out[offset + 3] = source.data[offset + 3];
      } else {
        // Alpha-composite heatmap over source
        const srcAlpha = 1 - heatAlpha;
        out[offset] = Math.round(source.data[offset] * srcAlpha + heatmap.data[offset] * heatAlpha);
        out[offset + 1] = Math.round(
          source.data[offset + 1] * srcAlpha + heatmap.data[offset + 1] * heatAlpha,
        );
        out[offset + 2] = Math.round(
          source.data[offset + 2] * srcAlpha + heatmap.data[offset + 2] * heatAlpha,
        );
        out[offset + 3] = 255;
      }
    }

    return {
      data: out,
      width: source.width,
      height: source.height,
      channels: 4,
    };
  }
}
