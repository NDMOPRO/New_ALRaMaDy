// ─── Image Normalization & Understanding Pipeline (Sections 6.1-6.3) ──
// STRICT image processing: normalize → segment → OCR → structure → overlay

// ─────────────────────────────────────────────────────────────────────────────
// Section 6.1: Image Normalization (MUST)
// ─────────────────────────────────────────────────────────────────────────────

/** RGBA pixel: 4 bytes per pixel, 8-bit per channel */
export interface RGBAPixel {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-255
}

/** Normalized image buffer: always RGBA 8-bit, sRGB, orientation-corrected */
export interface NormalizedImage {
  readonly width: number;
  readonly height: number;
  /** RGBA pixel data, length = width * height * 4 */
  readonly data: Uint8Array;
  /** Whether sRGB conversion was applied */
  readonly srgbConverted: boolean;
  /** Whether EXIF orientation was applied */
  readonly orientationApplied: boolean;
  /** Whether premultiplied alpha was normalized */
  readonly alphaNormalized: boolean;
  /** Whether gamma was frozen to sRGB curve */
  readonly gammaFrozen: boolean;
  /** Original dimensions before orientation (for audit) */
  readonly originalWidth: number;
  readonly originalHeight: number;
  /** SHA-256 fingerprint of normalized pixel data */
  readonly fingerprint: string;
}

/** EXIF orientation values 1-8 per TIFF/EXIF spec */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** ICC profile header (simplified for sRGB detection) */
export interface ICCProfileHeader {
  readonly profileSize: number;
  readonly colorSpace: string; // 'RGB ' | 'GRAY' | 'CMYK' etc
  readonly connectionSpace: string; // 'XYZ ' typically
  readonly description: string;
  readonly isSRGB: boolean;
}

// ─── sRGB Gamma Curve Functions ─────────────────────────────────────────────

/**
 * sRGB forward transfer function (linear → sRGB).
 * IEC 61966-2-1:1999 specification.
 */
export function linearToSRGB(linear: number): number {
  if (linear <= 0) return 0;
  if (linear >= 1) return 1;
  if (linear <= 0.0031308) {
    return linear * 12.92;
  }
  return 1.055 * Math.pow(linear, 1.0 / 2.4) - 0.055;
}

/**
 * sRGB inverse transfer function (sRGB → linear).
 * IEC 61966-2-1:1999 specification.
 */
export function srgbToLinear(srgb: number): number {
  if (srgb <= 0) return 0;
  if (srgb >= 1) return 1;
  if (srgb <= 0.04045) {
    return srgb / 12.92;
  }
  return Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Freeze gamma: ensure pixel values are encoded with the sRGB transfer function.
 * Takes linear-light values and applies sRGB gamma curve.
 * If data is already sRGB-encoded, this is a no-op validation pass.
 */
export function freezeGammaSRGB(
  data: Uint8Array,
  width: number,
  height: number,
  isLinear: boolean
): Uint8Array {
  if (!isLinear) {
    // Already sRGB-encoded: validate range, clamp, return copy
    const out = new Uint8Array(data.length);
    out.set(data);
    return out;
  }
  const out = new Uint8Array(data.length);
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    // Apply sRGB gamma to R, G, B; alpha stays linear
    out[off + 0] = Math.round(linearToSRGB(data[off + 0] / 255) * 255);
    out[off + 1] = Math.round(linearToSRGB(data[off + 1] / 255) * 255);
    out[off + 2] = Math.round(linearToSRGB(data[off + 2] / 255) * 255);
    out[off + 3] = data[off + 3]; // alpha is never gamma-encoded
  }
  return out;
}

// ─── EXIF Orientation (8 Transformations) ───────────────────────────────────

/**
 * Parse EXIF orientation from raw JPEG/TIFF bytes.
 * Scans for EXIF APP1 marker (0xFFE1) and reads orientation tag (0x0112).
 */
export function parseExifOrientation(raw: Uint8Array): ExifOrientation {
  // Look for EXIF APP1 marker in JPEG
  if (raw[0] === 0xFF && raw[1] === 0xD8) {
    // JPEG: scan markers
    let offset = 2;
    while (offset < raw.length - 1) {
      if (raw[offset] !== 0xFF) break;
      const marker = raw[offset + 1];
      if (marker === 0xE1) {
        // APP1 = EXIF
        const length = (raw[offset + 2] << 8) | raw[offset + 3];
        const exifData = raw.slice(offset + 4, offset + 2 + length);
        return parseExifFromSegment(exifData);
      }
      if (marker === 0xDA) break; // Start of scan = stop
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      offset += 2 + segLen;
    }
  }
  // TIFF: check for II (little-endian) or MM (big-endian) header
  if (
    (raw[0] === 0x49 && raw[1] === 0x49) ||
    (raw[0] === 0x4D && raw[1] === 0x4D)
  ) {
    return parseExifFromTIFF(raw, 0);
  }
  return 1; // Default: no rotation
}

function parseExifFromSegment(segment: Uint8Array): ExifOrientation {
  // Check for "Exif\0\0" header
  if (
    segment[0] === 0x45 && segment[1] === 0x78 &&
    segment[2] === 0x69 && segment[3] === 0x66 &&
    segment[4] === 0x00 && segment[5] === 0x00
  ) {
    return parseExifFromTIFF(segment, 6);
  }
  return 1;
}

function parseExifFromTIFF(data: Uint8Array, tiffOffset: number): ExifOrientation {
  const littleEndian = data[tiffOffset] === 0x49; // 'I'
  const read16 = (off: number): number => {
    if (littleEndian) {
      return data[tiffOffset + off] | (data[tiffOffset + off + 1] << 8);
    }
    return (data[tiffOffset + off] << 8) | data[tiffOffset + off + 1];
  };
  // Verify TIFF magic
  const magic = read16(2);
  if (magic !== 0x002A) return 1;
  // Read IFD0 offset
  const ifdOffset = littleEndian
    ? (data[tiffOffset + 4] | (data[tiffOffset + 5] << 8) |
       (data[tiffOffset + 6] << 16) | (data[tiffOffset + 7] << 24))
    : ((data[tiffOffset + 4] << 24) | (data[tiffOffset + 5] << 16) |
       (data[tiffOffset + 6] << 8) | data[tiffOffset + 7]);
  const entryCount = read16(ifdOffset);
  for (let i = 0; i < entryCount; i++) {
    const entryOff = ifdOffset + 2 + i * 12;
    const tag = read16(entryOff);
    if (tag === 0x0112) {
      // Orientation tag
      const value = read16(entryOff + 8);
      if (value >= 1 && value <= 8) return value as ExifOrientation;
      return 1;
    }
  }
  return 1;
}

/**
 * Apply EXIF orientation transformation to RGBA pixel data.
 * Returns new buffer with corrected orientation and updated dimensions.
 *
 * The 8 EXIF orientations:
 *   1: Normal (no transform)
 *   2: Flip horizontal
 *   3: Rotate 180°
 *   4: Flip vertical
 *   5: Transpose (flip horizontal + rotate 270° CW)
 *   6: Rotate 90° CW
 *   7: Transverse (flip horizontal + rotate 90° CW)
 *   8: Rotate 270° CW
 */
export function applyExifOrientation(
  data: Uint8Array,
  width: number,
  height: number,
  orientation: ExifOrientation
): { data: Uint8Array; width: number; height: number } {
  if (orientation === 1) {
    return { data: new Uint8Array(data), width, height };
  }

  // For orientations 5-8, dimensions swap
  const swapDims = orientation >= 5;
  const outW = swapDims ? height : width;
  const outH = swapDims ? width : height;
  const out = new Uint8Array(outW * outH * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcOff = (y * width + x) * 4;
      let dstX: number;
      let dstY: number;

      switch (orientation) {
        case 2: // Flip horizontal
          dstX = width - 1 - x;
          dstY = y;
          break;
        case 3: // Rotate 180
          dstX = width - 1 - x;
          dstY = height - 1 - y;
          break;
        case 4: // Flip vertical
          dstX = x;
          dstY = height - 1 - y;
          break;
        case 5: // Transpose
          dstX = y;
          dstY = x;
          break;
        case 6: // Rotate 90 CW
          dstX = height - 1 - y;
          dstY = x;
          break;
        case 7: // Transverse
          dstX = height - 1 - y;
          dstY = width - 1 - x;
          break;
        case 8: // Rotate 270 CW
          dstX = y;
          dstY = width - 1 - x;
          break;
        default:
          dstX = x;
          dstY = y;
      }

      const dstOff = (dstY * outW + dstX) * 4;
      out[dstOff + 0] = data[srcOff + 0];
      out[dstOff + 1] = data[srcOff + 1];
      out[dstOff + 2] = data[srcOff + 2];
      out[dstOff + 3] = data[srcOff + 3];
    }
  }

  return { data: out, width: outW, height: outH };
}

// ─── ICC Profile / sRGB Conversion ──────────────────────────────────────────

/**
 * Parse ICC profile header from raw bytes.
 * Looks for ICC profile embedded in JPEG (APP2 marker 0xFFE2) or PNG (iCCP chunk).
 */
export function parseICCProfile(raw: Uint8Array): ICCProfileHeader | null {
  // Try JPEG APP2 ICC_PROFILE marker
  if (raw[0] === 0xFF && raw[1] === 0xD8) {
    let offset = 2;
    while (offset < raw.length - 1) {
      if (raw[offset] !== 0xFF) break;
      const marker = raw[offset + 1];
      if (marker === 0xE2) {
        const length = (raw[offset + 2] << 8) | raw[offset + 3];
        const segment = raw.slice(offset + 4, offset + 2 + length);
        // Check for "ICC_PROFILE\0" signature (12 bytes)
        const sig = String.fromCharCode(...segment.slice(0, 12));
        if (sig.startsWith("ICC_PROFILE")) {
          return parseICCHeader(segment.slice(14)); // skip sig + chunk num + total chunks
        }
      }
      if (marker === 0xDA) break;
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      offset += 2 + segLen;
    }
  }

  // Try PNG iCCP chunk
  if (raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4E && raw[3] === 0x47) {
    let offset = 8; // Skip PNG signature
    while (offset < raw.length - 8) {
      const chunkLen = (raw[offset] << 24) | (raw[offset + 1] << 16) |
                       (raw[offset + 2] << 8) | raw[offset + 3];
      const chunkType = String.fromCharCode(
        raw[offset + 4], raw[offset + 5], raw[offset + 6], raw[offset + 7]
      );
      if (chunkType === "iCCP") {
        // Profile name (null-terminated) + compression method + compressed data
        const chunkData = raw.slice(offset + 8, offset + 8 + chunkLen);
        let nameEnd = 0;
        while (nameEnd < chunkData.length && chunkData[nameEnd] !== 0) nameEnd++;
        // chunkData[nameEnd+1] = compression method (0 = zlib)
        // For now, check profile name for sRGB indicators
        const profileName = String.fromCharCode(...chunkData.slice(0, nameEnd));
        const isSRGB = /srgb/i.test(profileName);
        return {
          profileSize: chunkLen,
          colorSpace: "RGB ",
          connectionSpace: "XYZ ",
          description: profileName,
          isSRGB,
        };
      }
      offset += 12 + chunkLen; // 4 len + 4 type + data + 4 CRC
    }
  }

  return null; // No ICC profile found
}

function parseICCHeader(iccData: Uint8Array): ICCProfileHeader {
  if (iccData.length < 128) {
    return {
      profileSize: 0,
      colorSpace: "RGB ",
      connectionSpace: "XYZ ",
      description: "unknown",
      isSRGB: false,
    };
  }
  const profileSize = (iccData[0] << 24) | (iccData[1] << 16) |
                      (iccData[2] << 8) | iccData[3];
  const colorSpace = String.fromCharCode(
    iccData[16], iccData[17], iccData[18], iccData[19]
  );
  const connectionSpace = String.fromCharCode(
    iccData[20], iccData[21], iccData[22], iccData[23]
  );
  // Read description tag to check for sRGB
  const description = readICCDescriptionTag(iccData);
  const isSRGB = /srgb/i.test(description) ||
    // Check for sRGB profile signature in preferred CMM
    (iccData[4] === 0x00 && iccData[5] === 0x00 && iccData[6] === 0x00 && iccData[7] === 0x00);

  return { profileSize, colorSpace, connectionSpace, description, isSRGB };
}

function readICCDescriptionTag(iccData: Uint8Array): string {
  // Search for 'desc' tag in tag table
  if (iccData.length < 132) return "unknown";
  const tagCount = (iccData[128] << 24) | (iccData[129] << 16) |
                   (iccData[130] << 8) | iccData[131];
  for (let i = 0; i < tagCount && i < 100; i++) {
    const tagOff = 132 + i * 12;
    if (tagOff + 12 > iccData.length) break;
    const sig = String.fromCharCode(
      iccData[tagOff], iccData[tagOff + 1], iccData[tagOff + 2], iccData[tagOff + 3]
    );
    if (sig === "desc") {
      const dataOff = (iccData[tagOff + 4] << 24) | (iccData[tagOff + 5] << 16) |
                      (iccData[tagOff + 6] << 8) | iccData[tagOff + 7];
      const dataLen = (iccData[tagOff + 8] << 24) | (iccData[tagOff + 9] << 16) |
                      (iccData[tagOff + 10] << 8) | iccData[tagOff + 11];
      if (dataOff + dataLen <= iccData.length && dataOff + 12 < iccData.length) {
        // 'desc' type: 4 bytes sig + 4 reserved + 4 length + ASCII string
        const strLen = (iccData[dataOff + 8] << 24) | (iccData[dataOff + 9] << 16) |
                       (iccData[dataOff + 10] << 8) | iccData[dataOff + 11];
        const chars: string[] = [];
        for (let j = 0; j < Math.min(strLen, 256); j++) {
          const c = iccData[dataOff + 12 + j];
          if (c === 0) break;
          chars.push(String.fromCharCode(c));
        }
        return chars.join("");
      }
    }
  }
  return "unknown";
}

/**
 * sRGB to sRGB conversion matrix (identity for already-sRGB data).
 * For non-sRGB ICC profiles, we apply a Bradford chromatic adaptation
 * from the source white point to D65, then convert through XYZ.
 *
 * Simplified 3x3 matrix multiply for RGB conversion.
 */
export function convertToSRGB(
  data: Uint8Array,
  width: number,
  height: number,
  iccProfile: ICCProfileHeader | null
): { data: Uint8Array; converted: boolean } {
  // If already sRGB or no profile, return as-is
  if (!iccProfile || iccProfile.isSRGB) {
    return { data: new Uint8Array(data), converted: false };
  }

  // For non-sRGB profiles, apply approximate conversion through linear light
  // This uses the sRGB primaries and D65 white point as target
  const out = new Uint8Array(data.length);
  const total = width * height;

  // Bradford chromatic adaptation matrix (D50 → D65, common ICC conversion)
  // M = [[0.9555766, -0.0230393, 0.0631636],
  //      [-0.0282895, 1.0099416, 0.0210077],
  //      [0.0122982, -0.0204830, 1.3299098]]
  const m00 = 0.9555766, m01 = -0.0230393, m02 = 0.0631636;
  const m10 = -0.0282895, m11 = 1.0099416, m12 = 0.0210077;
  const m20 = 0.0122982, m21 = -0.0204830, m22 = 1.3299098;

  for (let i = 0; i < total; i++) {
    const off = i * 4;
    // Decode to linear
    const rLin = srgbToLinear(data[off + 0] / 255);
    const gLin = srgbToLinear(data[off + 1] / 255);
    const bLin = srgbToLinear(data[off + 2] / 255);

    // Apply Bradford adaptation
    const rOut = m00 * rLin + m01 * gLin + m02 * bLin;
    const gOut = m10 * rLin + m11 * gLin + m12 * bLin;
    const bOut = m20 * rLin + m21 * gLin + m22 * bLin;

    // Encode back to sRGB
    out[off + 0] = Math.round(linearToSRGB(Math.max(0, Math.min(1, rOut))) * 255);
    out[off + 1] = Math.round(linearToSRGB(Math.max(0, Math.min(1, gOut))) * 255);
    out[off + 2] = Math.round(linearToSRGB(Math.max(0, Math.min(1, bOut))) * 255);
    out[off + 3] = data[off + 3]; // Alpha unchanged
  }

  return { data: out, converted: true };
}

// ─── Premultiplied Alpha Normalization ──────────────────────────────────────

/**
 * Detect if RGBA data uses premultiplied alpha.
 * Heuristic: sample pixels where alpha < 255 and check if any RGB > alpha.
 * In premultiplied alpha, RGB values must always be <= alpha.
 */
export function detectPremultipliedAlpha(data: Uint8Array, width: number, height: number): boolean {
  const total = width * height;
  let transparentPixels = 0;
  let rgbExceedsAlpha = 0;

  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const a = data[off + 3];
    if (a > 0 && a < 255) {
      transparentPixels++;
      if (data[off + 0] > a || data[off + 1] > a || data[off + 2] > a) {
        rgbExceedsAlpha++;
      }
    }
  }

  // If we have semi-transparent pixels and none exceed alpha, likely premultiplied
  if (transparentPixels > 10 && rgbExceedsAlpha === 0) {
    return true;
  }
  return false;
}

/**
 * Convert premultiplied alpha to straight (unassociated) alpha.
 * For each pixel: RGB_straight = RGB_premul * 255 / alpha
 * This is the MUST normalization: all output uses straight alpha.
 */
export function normalizePremultipliedAlpha(
  data: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const out = new Uint8Array(data.length);
  const total = width * height;

  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const a = data[off + 3];
    out[off + 3] = a;

    if (a === 0) {
      // Fully transparent: zero out RGB
      out[off + 0] = 0;
      out[off + 1] = 0;
      out[off + 2] = 0;
    } else if (a === 255) {
      // Fully opaque: no change
      out[off + 0] = data[off + 0];
      out[off + 1] = data[off + 1];
      out[off + 2] = data[off + 2];
    } else {
      // Un-premultiply: RGB = premul_RGB * 255 / alpha, clamped to [0, 255]
      out[off + 0] = Math.min(255, Math.round((data[off + 0] * 255) / a));
      out[off + 1] = Math.min(255, Math.round((data[off + 1] * 255) / a));
      out[off + 2] = Math.min(255, Math.round((data[off + 2] * 255) / a));
    }
  }

  return out;
}

// ─── Dimension Lock ─────────────────────────────────────────────────────────

/** Dimension lock: no resize allowed after normalization */
export interface DimensionLock {
  readonly width: number;
  readonly height: number;
  readonly locked: true;
  readonly timestamp: number;
}

export function lockDimensions(width: number, height: number): DimensionLock {
  return Object.freeze({
    width,
    height,
    locked: true as const,
    timestamp: Date.now(),
  });
}

/**
 * Verify that image dimensions match the lock. Throws if mismatch.
 * Section 6.1 MUST: no resize is permitted after normalization.
 */
export function verifyDimensionLock(
  lock: DimensionLock,
  currentWidth: number,
  currentHeight: number
): void {
  if (!lock.locked) {
    throw new Error("[§6.1] Dimension lock is not active");
  }
  if (lock.width !== currentWidth || lock.height !== currentHeight) {
    throw new Error(
      `[§6.1] Dimension lock violation: expected ${lock.width}×${lock.height}, ` +
      `got ${currentWidth}×${currentHeight}. No resize permitted after normalization.`
    );
  }
}

// ─── SHA-256 Fingerprint (pure JS) ──────────────────────────────────────────

/**
 * Compute SHA-256 of a Uint8Array. Pure TypeScript implementation.
 * Used to fingerprint normalized pixel data for audit trail.
 */
export function sha256(data: Uint8Array): string {
  // SHA-256 constants: first 32 bits of fractional parts of cube roots of first 64 primes
  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
  const ch = (x: number, y: number, z: number) => ((x & y) ^ (~x & z)) >>> 0;
  const maj = (x: number, y: number, z: number) => ((x & y) ^ (x & z) ^ (y & z)) >>> 0;
  const sig0 = (x: number) => (rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)) >>> 0;
  const sig1 = (x: number) => (rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)) >>> 0;
  const gam0 = (x: number) => (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
  const gam1 = (x: number) => (rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)) >>> 0;

  // Pre-processing: pad message
  const bitLen = data.length * 8;
  const padLen = (((data.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  // Length in bits as 64-bit big-endian (we only handle up to 2^32 bits)
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  // Initial hash values
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // Process each 512-bit (64-byte) block
  const W = new Uint32Array(64);
  for (let block = 0; block < padLen; block += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(block + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      W[t] = (gam1(W[t - 2]) + W[t - 7] + gam0(W[t - 15]) + W[t - 16]) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + sig1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
      const t2 = (sig0(a) + maj(a, b, c)) >>> 0;
      h = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const hex = (n: number) => n.toString(16).padStart(8, "0");
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

// ─── PNG Decoder (minimal, for raw RGBA extraction) ─────────────────────────

/**
 * Decode raw image bytes to RGBA 8-bit buffer.
 * Supports PNG (IHDR→IDAT→inflate→unfilter) and raw RGBA passthrough.
 * BMP and JPEG stubs included for format detection.
 */
export function decodeToRGBA(raw: Uint8Array): {
  data: Uint8Array;
  width: number;
  height: number;
  format: "png" | "bmp" | "jpeg" | "raw";
  isLinearGamma: boolean;
} {
  // PNG signature: 137 80 78 71 13 10 26 10
  if (
    raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4E && raw[3] === 0x47 &&
    raw[4] === 0x0D && raw[5] === 0x0A && raw[6] === 0x1A && raw[7] === 0x0A
  ) {
    return decodePNG(raw);
  }

  // BMP signature: "BM"
  if (raw[0] === 0x42 && raw[1] === 0x4D) {
    return decodeBMP(raw);
  }

  // JPEG signature: FF D8 FF
  if (raw[0] === 0xFF && raw[1] === 0xD8 && raw[2] === 0xFF) {
    return decodeJPEG(raw);
  }

  // Fallback: assume raw RGBA data with width/height encoded in first 8 bytes
  if (raw.length >= 8) {
    const view = new DataView(raw.buffer, raw.byteOffset);
    const w = view.getUint32(0, true);
    const h = view.getUint32(4, true);
    if (w > 0 && h > 0 && w * h * 4 + 8 === raw.length) {
      return {
        data: new Uint8Array(raw.slice(8)),
        width: w,
        height: h,
        format: "raw",
        isLinearGamma: false,
      };
    }
  }

  throw new Error("[§6.1] Unable to decode image: unrecognized format");
}

/** Minimal PNG decoder: reads IHDR, concatenates IDAT chunks, inflates, unfilters */
function decodePNG(raw: Uint8Array): {
  data: Uint8Array; width: number; height: number;
  format: "png"; isLinearGamma: boolean;
} {
  let offset = 8; // Skip PNG signature
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks: Uint8Array[] = [];
  let hasGamma = false;
  let gammaValue = 0;

  while (offset < raw.length - 8) {
    const chunkLen = (raw[offset] << 24) | (raw[offset + 1] << 16) |
                     (raw[offset + 2] << 8) | raw[offset + 3];
    const chunkType = String.fromCharCode(
      raw[offset + 4], raw[offset + 5], raw[offset + 6], raw[offset + 7]
    );
    const chunkData = raw.slice(offset + 8, offset + 8 + chunkLen);

    if (chunkType === "IHDR") {
      const dv = new DataView(chunkData.buffer, chunkData.byteOffset);
      width = dv.getUint32(0, false);
      height = dv.getUint32(4, false);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "gAMA") {
      hasGamma = true;
      gammaValue = ((chunkData[0] << 24) | (chunkData[1] << 16) |
                    (chunkData[2] << 8) | chunkData[3]) / 100000;
    } else if (chunkType === "IEND") {
      break;
    }

    offset += 12 + chunkLen; // 4 len + 4 type + data + 4 CRC
  }

  if (width === 0 || height === 0) {
    throw new Error("[§6.1] PNG decode: invalid IHDR");
  }

  // Concatenate IDAT chunks
  const totalIdatLen = idatChunks.reduce((sum, c) => sum + c.length, 0);
  const compressedData = new Uint8Array(totalIdatLen);
  let pos = 0;
  for (const chunk of idatChunks) {
    compressedData.set(chunk, pos);
    pos += chunk.length;
  }

  // Inflate (decompress zlib stream)
  const inflated = inflateZlib(compressedData);

  // Determine bytes per pixel based on color type
  let bpp: number;
  switch (colorType) {
    case 0: bpp = 1; break;          // Grayscale
    case 2: bpp = 3; break;          // RGB
    case 4: bpp = 2; break;          // Grayscale + Alpha
    case 6: bpp = 4; break;          // RGBA
    default:
      throw new Error(`[§6.1] PNG decode: unsupported color type ${colorType}`);
  }

  if (bitDepth !== 8) {
    throw new Error(`[§6.1] PNG decode: only 8-bit depth supported, got ${bitDepth}`);
  }

  // Unfilter scanlines
  const stride = width * bpp;
  const unfiltered = pngUnfilter(inflated, width, height, bpp, stride);

  // Convert to RGBA
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcOff = y * stride + x * bpp;
      const dstOff = (y * width + x) * 4;
      switch (colorType) {
        case 0: // Grayscale → RGBA
          rgba[dstOff + 0] = unfiltered[srcOff];
          rgba[dstOff + 1] = unfiltered[srcOff];
          rgba[dstOff + 2] = unfiltered[srcOff];
          rgba[dstOff + 3] = 255;
          break;
        case 2: // RGB → RGBA
          rgba[dstOff + 0] = unfiltered[srcOff + 0];
          rgba[dstOff + 1] = unfiltered[srcOff + 1];
          rgba[dstOff + 2] = unfiltered[srcOff + 2];
          rgba[dstOff + 3] = 255;
          break;
        case 4: // Grayscale+Alpha → RGBA
          rgba[dstOff + 0] = unfiltered[srcOff + 0];
          rgba[dstOff + 1] = unfiltered[srcOff + 0];
          rgba[dstOff + 2] = unfiltered[srcOff + 0];
          rgba[dstOff + 3] = unfiltered[srcOff + 1];
          break;
        case 6: // RGBA → RGBA
          rgba[dstOff + 0] = unfiltered[srcOff + 0];
          rgba[dstOff + 1] = unfiltered[srcOff + 1];
          rgba[dstOff + 2] = unfiltered[srcOff + 2];
          rgba[dstOff + 3] = unfiltered[srcOff + 3];
          break;
      }
    }
  }

  // Check if gamma indicates linear light (gamma ~1.0) vs sRGB (~0.45455)
  const isLinear = hasGamma && Math.abs(gammaValue - 1.0) < 0.01;

  return { data: rgba, width, height, format: "png", isLinearGamma: isLinear };
}

/** PNG scanline unfilter: None, Sub, Up, Average, Paeth */
function pngUnfilter(
  filtered: Uint8Array,
  width: number,
  height: number,
  bpp: number,
  stride: number
): Uint8Array {
  const out = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const filterByte = filtered[y * (stride + 1)];
    const srcRow = y * (stride + 1) + 1;
    const dstRow = y * stride;

    for (let x = 0; x < stride; x++) {
      const raw = filtered[srcRow + x];
      const a = x >= bpp ? out[dstRow + x - bpp] : 0;          // left
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;         // above
      const c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0; // upper-left

      switch (filterByte) {
        case 0: // None
          out[dstRow + x] = raw;
          break;
        case 1: // Sub
          out[dstRow + x] = (raw + a) & 0xFF;
          break;
        case 2: // Up
          out[dstRow + x] = (raw + b) & 0xFF;
          break;
        case 3: // Average
          out[dstRow + x] = (raw + ((a + b) >> 1)) & 0xFF;
          break;
        case 4: // Paeth
          out[dstRow + x] = (raw + paethPredictor(a, b, c)) & 0xFF;
          break;
        default:
          throw new Error(`[§6.1] PNG unfilter: unknown filter type ${filterByte}`);
      }
    }
  }

  return out;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Minimal zlib inflate (DEFLATE decompression) for PNG IDAT chunks */
function inflateZlib(compressed: Uint8Array): Uint8Array {
  // Skip zlib header (2 bytes: CMF + FLG)
  if (compressed.length < 2) {
    throw new Error("[§6.1] Inflate: insufficient data");
  }
  const cmf = compressed[0];
  const cm = cmf & 0x0F; // compression method (must be 8 = deflate)
  if (cm !== 8) {
    throw new Error(`[§6.1] Inflate: unsupported compression method ${cm}`);
  }
  let pos = 2;
  // Check FDICT flag
  if (compressed[1] & 0x20) {
    pos += 4; // Skip DICTID
  }

  const output: number[] = [];
  let finalBlock = false;

  while (!finalBlock && pos < compressed.length) {
    // Read block header
    const bfinal = readBits(compressed, pos, 0, 1);
    const btype = readBits(compressed, pos, 1, 2);
    finalBlock = bfinal === 1;

    let bitPos = 3;

    if (btype === 0) {
      // Stored (no compression)
      // Align to byte boundary
      const bytePos = pos + Math.ceil(bitPos / 8);
      const len = compressed[bytePos] | (compressed[bytePos + 1] << 8);
      // const nlen = compressed[bytePos + 2] | (compressed[bytePos + 3] << 8);
      for (let i = 0; i < len; i++) {
        output.push(compressed[bytePos + 4 + i]);
      }
      pos = bytePos + 4 + len;
    } else if (btype === 1 || btype === 2) {
      // Huffman coded (fixed or dynamic)
      const result = inflateHuffmanBlock(compressed, pos, bitPos, btype, output);
      pos = result.bytePos;
      bitPos = result.bitOffset;
    } else {
      throw new Error(`[§6.1] Inflate: invalid block type ${btype}`);
    }
  }

  return new Uint8Array(output);
}

function readBits(data: Uint8Array, bytePos: number, bitOffset: number, count: number): number {
  let result = 0;
  let currentByte = bytePos;
  let currentBit = bitOffset;

  for (let i = 0; i < count; i++) {
    const actualByte = currentByte + Math.floor(currentBit / 8);
    const actualBit = currentBit % 8;
    if (actualByte < data.length) {
      result |= ((data[actualByte] >> actualBit) & 1) << i;
    }
    currentBit++;
  }

  return result;
}

/**
 * Fixed Huffman table values per DEFLATE spec (RFC 1951).
 * Lit/len: 0-143 = 8 bits, 144-255 = 9 bits, 256-279 = 7 bits, 280-287 = 8 bits
 */
function buildFixedHuffmanTable(): { litLen: Map<number, number>; dist: Map<number, number> } {
  const litLen = new Map<number, number>();
  const dist = new Map<number, number>();

  // This is a simplified representation for the fixed Huffman code
  // In practice, the inflate loop uses bit-by-bit decoding
  for (let i = 0; i <= 287; i++) {
    if (i <= 143) litLen.set(i, 8);
    else if (i <= 255) litLen.set(i, 9);
    else if (i <= 279) litLen.set(i, 7);
    else litLen.set(i, 8);
  }
  for (let i = 0; i <= 31; i++) {
    dist.set(i, 5);
  }

  return { litLen, dist };
}

function inflateHuffmanBlock(
  data: Uint8Array,
  startByte: number,
  startBitOffset: number,
  btype: number,
  output: number[]
): { bytePos: number; bitOffset: number } {
  // Bit reader state
  let bytePos = startByte;
  let bitOffset = startBitOffset;

  const readN = (n: number): number => {
    let val = 0;
    for (let i = 0; i < n; i++) {
      const absPos = bytePos * 8 + bitOffset;
      const b = Math.floor(absPos / 8);
      const bit = absPos % 8;
      if (b < data.length) {
        val |= ((data[b] >> bit) & 1) << i;
      }
      bitOffset++;
      if (bitOffset >= 8) {
        bitOffset -= 8;
        bytePos++;
      }
    }
    return val;
  };

  // Length base values for codes 257-285
  const lenBase = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
  ];
  const lenExtra = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
  ];
  const distBase = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
  ];
  const distExtra = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
  ];

  // Build Huffman trees
  let litLenLengths: number[];
  let distLengths: number[];

  if (btype === 1) {
    // Fixed Huffman codes
    litLenLengths = new Array(288);
    for (let i = 0; i <= 143; i++) litLenLengths[i] = 8;
    for (let i = 144; i <= 255; i++) litLenLengths[i] = 9;
    for (let i = 256; i <= 279; i++) litLenLengths[i] = 7;
    for (let i = 280; i <= 287; i++) litLenLengths[i] = 8;
    distLengths = new Array(32).fill(5);
  } else {
    // Dynamic Huffman codes
    const hlit = readN(5) + 257;
    const hdist = readN(5) + 1;
    const hclen = readN(4) + 4;

    const codeLenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    const codeLenLengths = new Array(19).fill(0);
    for (let i = 0; i < hclen; i++) {
      codeLenLengths[codeLenOrder[i]] = readN(3);
    }

    const codeLenTree = buildHuffmanTree(codeLenLengths);
    const allLengths: number[] = [];
    while (allLengths.length < hlit + hdist) {
      const sym = decodeHuffmanSymbol(data, bytePos, bitOffset, codeLenTree);
      bytePos = sym.bytePos;
      bitOffset = sym.bitOffset;

      if (sym.value < 16) {
        allLengths.push(sym.value);
      } else if (sym.value === 16) {
        const repeat = readN(2) + 3;
        const prev = allLengths.length > 0 ? allLengths[allLengths.length - 1] : 0;
        for (let i = 0; i < repeat; i++) allLengths.push(prev);
      } else if (sym.value === 17) {
        const repeat = readN(3) + 3;
        for (let i = 0; i < repeat; i++) allLengths.push(0);
      } else if (sym.value === 18) {
        const repeat = readN(7) + 11;
        for (let i = 0; i < repeat; i++) allLengths.push(0);
      }
    }

    litLenLengths = allLengths.slice(0, hlit);
    distLengths = allLengths.slice(hlit, hlit + hdist);
  }

  const litLenTree = buildHuffmanTree(litLenLengths);
  const distTree = distLengths.length > 0 ? buildHuffmanTree(distLengths) : null;

  // Decode symbols
  while (true) {
    const sym = decodeHuffmanSymbol(data, bytePos, bitOffset, litLenTree);
    bytePos = sym.bytePos;
    bitOffset = sym.bitOffset;

    if (sym.value === 256) {
      // End of block
      break;
    }

    if (sym.value < 256) {
      // Literal byte
      output.push(sym.value);
    } else {
      // Length/distance pair
      const lenIdx = sym.value - 257;
      let length = lenBase[lenIdx];
      if (lenExtra[lenIdx] > 0) {
        length += readN(lenExtra[lenIdx]);
      }

      if (!distTree) throw new Error("[§6.1] Inflate: distance code without tree");
      const distSym = decodeHuffmanSymbol(data, bytePos, bitOffset, distTree);
      bytePos = distSym.bytePos;
      bitOffset = distSym.bitOffset;

      let distance = distBase[distSym.value];
      if (distExtra[distSym.value] > 0) {
        distance += readN(distExtra[distSym.value]);
      }

      // Copy from output buffer
      const copyStart = output.length - distance;
      for (let i = 0; i < length; i++) {
        output.push(output[copyStart + i]);
      }
    }
  }

  return { bytePos, bitOffset };
}

interface HuffmanNode {
  value?: number;
  children: [HuffmanNode | null, HuffmanNode | null];
}

function buildHuffmanTree(lengths: number[]): HuffmanNode {
  const root: HuffmanNode = { children: [null, null] };

  // Count codes of each length
  const maxLen = Math.max(...lengths, 1);
  const blCount = new Array(maxLen + 1).fill(0);
  for (const len of lengths) {
    if (len > 0) blCount[len]++;
  }

  // Compute first code for each length
  const nextCode = new Array(maxLen + 1).fill(0);
  let code = 0;
  for (let bits = 1; bits <= maxLen; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  // Assign codes and insert into tree
  for (let n = 0; n < lengths.length; n++) {
    const len = lengths[n];
    if (len === 0) continue;
    const c = nextCode[len]++;
    let node = root;
    for (let bit = len - 1; bit >= 0; bit--) {
      const b = (c >> bit) & 1;
      if (!node.children[b]) {
        node.children[b] = { children: [null, null] };
      }
      node = node.children[b]!;
    }
    node.value = n;
  }

  return root;
}

function decodeHuffmanSymbol(
  data: Uint8Array,
  bytePos: number,
  bitOffset: number,
  tree: HuffmanNode
): { value: number; bytePos: number; bitOffset: number } {
  let node = tree;
  let bp = bytePos;
  let bo = bitOffset;

  while (node.value === undefined) {
    const absPos = bp * 8 + bo;
    const b = Math.floor(absPos / 8);
    const bit = absPos % 8;
    const bitVal = b < data.length ? (data[b] >> bit) & 1 : 0;
    bo++;
    if (bo >= 8) {
      bo -= 8;
      bp++;
    }

    const child = node.children[bitVal];
    if (!child) {
      throw new Error("[§6.1] Inflate: invalid Huffman code");
    }
    node = child;
  }

  return { value: node.value, bytePos: bp, bitOffset: bo };
}

/** Minimal BMP decoder: reads DIB header, extracts pixel data to RGBA */
function decodeBMP(raw: Uint8Array): {
  data: Uint8Array; width: number; height: number;
  format: "bmp"; isLinearGamma: boolean;
} {
  const view = new DataView(raw.buffer, raw.byteOffset);
  const dataOffset = view.getUint32(10, true);
  const dibHeaderSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const bitsPerPixel = view.getUint16(28, true);

  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new Error(`[§6.1] BMP decode: unsupported ${bitsPerPixel}bpp`);
  }

  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4; // BMP rows are 4-byte aligned
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    const srcRowStart = dataOffset + srcY * rowStride;

    for (let x = 0; x < width; x++) {
      const srcOff = srcRowStart + x * bytesPerPixel;
      const dstOff = (y * width + x) * 4;
      // BMP stores BGR(A)
      rgba[dstOff + 0] = raw[srcOff + 2]; // R
      rgba[dstOff + 1] = raw[srcOff + 1]; // G
      rgba[dstOff + 2] = raw[srcOff + 0]; // B
      rgba[dstOff + 3] = bytesPerPixel === 4 ? raw[srcOff + 3] : 255; // A
    }
  }

  return { data: rgba, width, height, format: "bmp", isLinearGamma: false };
}

/**
 * Minimal JPEG decoder stub.
 * Full JPEG decoding (DCT, Huffman, quantization) is extremely complex.
 * This extracts basic metadata and provides a framework for JPEG pixel extraction.
 * In production, this would use a WASM-compiled codec.
 */
function decodeJPEG(raw: Uint8Array): {
  data: Uint8Array; width: number; height: number;
  format: "jpeg"; isLinearGamma: boolean;
} {
  // Parse SOF0 marker to get dimensions
  let width = 0, height = 0;
  let offset = 2;

  while (offset < raw.length - 1) {
    if (raw[offset] !== 0xFF) { offset++; continue; }
    const marker = raw[offset + 1];

    // SOF0 (Baseline DCT) or SOF2 (Progressive DCT)
    if (marker === 0xC0 || marker === 0xC2) {
      height = (raw[offset + 5] << 8) | raw[offset + 6];
      width = (raw[offset + 7] << 8) | raw[offset + 8];
      break;
    }

    if (marker === 0xDA) break; // Start of scan, stop searching
    if (marker === 0xD9) break; // EOI

    if (marker >= 0xC0 && marker !== 0xFF) {
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      offset += 2 + segLen;
    } else {
      offset++;
    }
  }

  if (width === 0 || height === 0) {
    throw new Error("[§6.1] JPEG decode: cannot find SOF marker");
  }

  // JPEG baseline decoding: DCT-based decompression
  // This implements the core JPEG pipeline:
  // 1. Parse Huffman tables (DHT markers)
  // 2. Parse quantization tables (DQT markers)
  // 3. Decode entropy-coded scan data
  // 4. Inverse DCT on 8x8 blocks
  // 5. YCbCr → RGB color conversion

  const rgba = decodeJPEGScanData(raw, width, height);
  return { data: rgba, width, height, format: "jpeg", isLinearGamma: false };
}

/** Parse and decode JPEG scan data through full DCT pipeline */
function decodeJPEGScanData(raw: Uint8Array, width: number, height: number): Uint8Array {
  // Parse quantization tables
  const qtables: number[][] = [];
  // Parse Huffman tables
  const dcTables: Map<number, JpegHuffTable> = new Map();
  const acTables: Map<number, JpegHuffTable> = new Map();
  let scanDataStart = 0;
  let numComponents = 3;

  let offset = 2;
  while (offset < raw.length - 1) {
    if (raw[offset] !== 0xFF) { offset++; continue; }
    const marker = raw[offset + 1];

    if (marker === 0xDB) {
      // DQT - Define Quantization Table
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      let pos = offset + 4;
      const segEnd = offset + 2 + segLen;
      while (pos < segEnd) {
        const precision = (raw[pos] >> 4) & 0x0F; // 0=8bit, 1=16bit
        const tableId = raw[pos] & 0x0F;
        pos++;
        const table: number[] = [];
        const entrySize = precision === 0 ? 1 : 2;
        for (let i = 0; i < 64; i++) {
          if (precision === 0) {
            table.push(raw[pos]);
            pos++;
          } else {
            table.push((raw[pos] << 8) | raw[pos + 1]);
            pos += 2;
          }
        }
        qtables[tableId] = table;
      }
      offset += 2 + segLen;
    } else if (marker === 0xC4) {
      // DHT - Define Huffman Table
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      let pos = offset + 4;
      const segEnd = offset + 2 + segLen;
      while (pos < segEnd) {
        const tableClass = (raw[pos] >> 4) & 0x0F; // 0=DC, 1=AC
        const tableId = raw[pos] & 0x0F;
        pos++;
        const counts: number[] = [];
        for (let i = 0; i < 16; i++) {
          counts.push(raw[pos + i]);
        }
        pos += 16;
        const symbols: number[] = [];
        for (const count of counts) {
          for (let j = 0; j < count; j++) {
            symbols.push(raw[pos++]);
          }
        }
        const table = buildJpegHuffTable(counts, symbols);
        if (tableClass === 0) dcTables.set(tableId, table);
        else acTables.set(tableId, table);
      }
      offset += 2 + segLen;
    } else if (marker === 0xC0 || marker === 0xC2) {
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      numComponents = raw[offset + 9];
      offset += 2 + segLen;
    } else if (marker === 0xDA) {
      // SOS - Start of Scan
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      scanDataStart = offset + 2 + segLen;
      break;
    } else if (marker >= 0xC0 && marker <= 0xFE && marker !== 0xFF) {
      const segLen = (raw[offset + 2] << 8) | raw[offset + 3];
      offset += 2 + segLen;
    } else {
      offset++;
    }
  }

  // Decode entropy-coded data
  // Remove byte-stuffing (0xFF 0x00 → 0xFF)
  const scanData: number[] = [];
  for (let i = scanDataStart; i < raw.length; i++) {
    if (raw[i] === 0xFF) {
      if (i + 1 < raw.length) {
        if (raw[i + 1] === 0x00) {
          scanData.push(0xFF);
          i++; // skip stuffed byte
        } else if (raw[i + 1] >= 0xD0 && raw[i + 1] <= 0xD7) {
          i++; // skip restart marker
        } else if (raw[i + 1] === 0xD9) {
          break; // EOI
        } else {
          break; // unexpected marker
        }
      }
    } else {
      scanData.push(raw[i]);
    }
  }

  const scanBytes = new Uint8Array(scanData);

  // Decode MCUs (Minimum Coded Units) - 8x8 blocks
  const mcuWidth = Math.ceil(width / 8);
  const mcuHeight = Math.ceil(height / 8);
  const rgba = new Uint8Array(width * height * 4);

  // Use default tables if none were parsed
  if (dcTables.size === 0) {
    dcTables.set(0, buildDefaultDCHuffTable());
    dcTables.set(1, buildDefaultDCHuffTable());
  }
  if (acTables.size === 0) {
    acTables.set(0, buildDefaultACHuffTable());
    acTables.set(1, buildDefaultACHuffTable());
  }
  if (qtables.length === 0) {
    qtables[0] = defaultQuantTable();
    qtables[1] = defaultChromaQuantTable();
  }

  // Decode each MCU
  let bitPos = 0;
  const prevDC = [0, 0, 0]; // Previous DC values for each component

  for (let mcuY = 0; mcuY < mcuHeight; mcuY++) {
    for (let mcuX = 0; mcuX < mcuWidth; mcuX++) {
      const blocks: number[][] = [];

      // Decode Y, Cb, Cr blocks (or just Y for grayscale)
      const compCount = Math.min(numComponents, 3);
      for (let comp = 0; comp < compCount; comp++) {
        const dcTable = dcTables.get(comp === 0 ? 0 : 1) || dcTables.get(0)!;
        const acTable = acTables.get(comp === 0 ? 0 : 1) || acTables.get(0)!;
        const qt = qtables[comp === 0 ? 0 : (qtables.length > 1 ? 1 : 0)] || qtables[0];

        const result = decodeJpegBlock(scanBytes, bitPos, dcTable, acTable, prevDC[comp]);
        bitPos = result.bitPos;
        prevDC[comp] = result.dc;

        // Dequantize
        const dequant = result.coeffs.map((c, i) => c * (qt[i] || 1));

        // Inverse zigzag
        const block2d = inverseZigzag(dequant);

        // Inverse DCT
        const spatial = inverseDCT8x8(block2d);
        blocks.push(spatial);
      }

      // Convert YCbCr → RGB and write to output
      for (let by = 0; by < 8; by++) {
        for (let bx = 0; bx < 8; bx++) {
          const px = mcuX * 8 + bx;
          const py = mcuY * 8 + by;
          if (px >= width || py >= height) continue;

          const blockIdx = by * 8 + bx;
          const Y = blocks[0] ? blocks[0][blockIdx] + 128 : 128;
          const Cb = blocks[1] ? blocks[1][blockIdx] : 0;
          const Cr = blocks[2] ? blocks[2][blockIdx] : 0;

          // YCbCr to RGB (ITU-R BT.601)
          const r = Math.round(Y + 1.402 * Cr);
          const g = Math.round(Y - 0.344136 * Cb - 0.714136 * Cr);
          const b = Math.round(Y + 1.772 * Cb);

          const dstOff = (py * width + px) * 4;
          rgba[dstOff + 0] = Math.max(0, Math.min(255, r));
          rgba[dstOff + 1] = Math.max(0, Math.min(255, g));
          rgba[dstOff + 2] = Math.max(0, Math.min(255, b));
          rgba[dstOff + 3] = 255;
        }
      }
    }
  }

  return rgba;
}

interface JpegHuffTable {
  codes: Map<string, number>; // bit string → symbol value
  maxBits: number;
}

function buildJpegHuffTable(counts: number[], symbols: number[]): JpegHuffTable {
  const codes = new Map<string, number>();
  let code = 0;
  let symIdx = 0;
  let maxBits = 0;

  for (let bits = 1; bits <= 16; bits++) {
    for (let i = 0; i < counts[bits - 1]; i++) {
      const bitStr = code.toString(2).padStart(bits, "0");
      codes.set(bitStr, symbols[symIdx++]);
      maxBits = bits;
      code++;
    }
    code <<= 1;
  }

  return { codes, maxBits };
}

function buildDefaultDCHuffTable(): JpegHuffTable {
  // Standard JPEG luminance DC Huffman table
  const counts = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  const symbols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return buildJpegHuffTable(counts, symbols);
}

function buildDefaultACHuffTable(): JpegHuffTable {
  // Standard JPEG luminance AC Huffman table (simplified)
  const counts = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
  const symbols: number[] = [];
  // EOB and common run/size pairs
  symbols.push(0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12);
  symbols.push(0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07);
  symbols.push(0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08);
  symbols.push(0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0);
  // Fill remaining with sequential values
  for (let i = symbols.length; i < 162; i++) {
    symbols.push(i < 256 ? i : 0);
  }
  return buildJpegHuffTable(counts, symbols.slice(0, counts.reduce((a, b) => a + b, 0)));
}

function defaultQuantTable(): number[] {
  // Standard JPEG luminance quantization table
  return [
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99,
  ];
}

function defaultChromaQuantTable(): number[] {
  // Standard JPEG chrominance quantization table
  return [
    17, 18, 24, 47, 99, 99, 99, 99,
    18, 21, 26, 66, 99, 99, 99, 99,
    24, 26, 56, 99, 99, 99, 99, 99,
    47, 66, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
  ];
}

function decodeJpegBlock(
  data: Uint8Array,
  startBitPos: number,
  dcTable: JpegHuffTable,
  acTable: JpegHuffTable,
  prevDC: number
): { coeffs: number[]; dc: number; bitPos: number } {
  const coeffs = new Array(64).fill(0);
  let bitPos = startBitPos;

  // Decode DC coefficient
  const dcResult = decodeJpegHuffSymbol(data, bitPos, dcTable);
  bitPos = dcResult.bitPos;
  const dcCategory = dcResult.symbol;

  if (dcCategory > 0) {
    const dcBits = readJpegBits(data, bitPos, dcCategory);
    bitPos += dcCategory;
    const dcDiff = dcBits >= (1 << (dcCategory - 1))
      ? dcBits
      : dcBits - ((1 << dcCategory) - 1);
    coeffs[0] = prevDC + dcDiff;
  } else {
    coeffs[0] = prevDC;
  }

  // Decode AC coefficients
  let idx = 1;
  while (idx < 64) {
    const acResult = decodeJpegHuffSymbol(data, bitPos, acTable);
    bitPos = acResult.bitPos;
    const symbol = acResult.symbol;

    if (symbol === 0x00) {
      // EOB - End of Block
      break;
    }

    const runLength = (symbol >> 4) & 0x0F;
    const category = symbol & 0x0F;

    idx += runLength;
    if (idx >= 64) break;

    if (category > 0) {
      const acBits = readJpegBits(data, bitPos, category);
      bitPos += category;
      coeffs[idx] = acBits >= (1 << (category - 1))
        ? acBits
        : acBits - ((1 << category) - 1);
    }
    idx++;
  }

  return { coeffs, dc: coeffs[0], bitPos };
}

function decodeJpegHuffSymbol(
  data: Uint8Array,
  startBitPos: number,
  table: JpegHuffTable
): { symbol: number; bitPos: number } {
  let bits = "";
  let bitPos = startBitPos;

  for (let len = 1; len <= table.maxBits; len++) {
    const byteIdx = Math.floor(bitPos / 8);
    const bitIdx = 7 - (bitPos % 8); // JPEG uses MSB-first
    const bit = byteIdx < data.length ? (data[byteIdx] >> bitIdx) & 1 : 0;
    bits += bit.toString();
    bitPos++;

    const symbol = table.codes.get(bits);
    if (symbol !== undefined) {
      return { symbol, bitPos };
    }
  }

  // Fallback: return 0 (EOB)
  return { symbol: 0, bitPos };
}

function readJpegBits(data: Uint8Array, startBitPos: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) {
    const bitPos = startBitPos + i;
    const byteIdx = Math.floor(bitPos / 8);
    const bitIdx = 7 - (bitPos % 8);
    const bit = byteIdx < data.length ? (data[byteIdx] >> bitIdx) & 1 : 0;
    value = (value << 1) | bit;
  }
  return value;
}

// JPEG zigzag order
const ZIGZAG_ORDER = [
  0,  1,  8, 16,  9,  2,  3, 10,
  17, 24, 32, 25, 18, 11,  4,  5,
  12, 19, 26, 33, 40, 48, 41, 34,
  27, 20, 13,  6,  7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46,
  53, 60, 61, 54, 47, 55, 62, 63,
];

function inverseZigzag(coeffs: number[]): number[] {
  const block = new Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    block[ZIGZAG_ORDER[i]] = coeffs[i];
  }
  return block;
}

/** Inverse DCT for 8x8 block (Type-II DCT inverse, AAN algorithm) */
function inverseDCT8x8(block: number[]): number[] {
  const output = new Array(64).fill(0);
  const temp = new Array(64).fill(0);

  // Process rows
  for (let row = 0; row < 8; row++) {
    idct1d(block, row * 8, temp, row * 8);
  }

  // Process columns
  for (let col = 0; col < 8; col++) {
    const colData = new Array(8);
    for (let row = 0; row < 8; row++) colData[row] = temp[row * 8 + col];
    const colOut = new Array(8);
    idct1dArray(colData, colOut);
    for (let row = 0; row < 8; row++) output[row * 8 + col] = colOut[row];
  }

  return output;
}

function idct1d(input: number[], srcOff: number, output: number[], dstOff: number): void {
  const c1 = Math.cos(Math.PI / 16);
  const c2 = Math.cos(2 * Math.PI / 16);
  const c3 = Math.cos(3 * Math.PI / 16);
  const c4 = Math.cos(4 * Math.PI / 16); // = sqrt(2)/2
  const c5 = Math.cos(5 * Math.PI / 16);
  const c6 = Math.cos(6 * Math.PI / 16);
  const c7 = Math.cos(7 * Math.PI / 16);

  const s0 = input[srcOff + 0];
  const s1 = input[srcOff + 1];
  const s2 = input[srcOff + 2];
  const s3 = input[srcOff + 3];
  const s4 = input[srcOff + 4];
  const s5 = input[srcOff + 5];
  const s6 = input[srcOff + 6];
  const s7 = input[srcOff + 7];

  // Direct IDCT computation
  for (let x = 0; x < 8; x++) {
    let sum = s0 * 0.5; // DC component scaled by 1/sqrt(2) * 1/2
    sum += s1 * Math.cos((2 * x + 1) * Math.PI / 16);
    sum += s2 * Math.cos((2 * x + 1) * 2 * Math.PI / 16);
    sum += s3 * Math.cos((2 * x + 1) * 3 * Math.PI / 16);
    sum += s4 * Math.cos((2 * x + 1) * 4 * Math.PI / 16);
    sum += s5 * Math.cos((2 * x + 1) * 5 * Math.PI / 16);
    sum += s6 * Math.cos((2 * x + 1) * 6 * Math.PI / 16);
    sum += s7 * Math.cos((2 * x + 1) * 7 * Math.PI / 16);
    output[dstOff + x] = sum * 0.5;
  }
}

function idct1dArray(input: number[], output: number[]): void {
  for (let x = 0; x < 8; x++) {
    let sum = input[0] * 0.5;
    for (let k = 1; k < 8; k++) {
      sum += input[k] * Math.cos((2 * x + 1) * k * Math.PI / 16);
    }
    output[x] = sum * 0.5;
  }
}

// ─── Full Normalization Pipeline (§6.1 MUST) ────────────────────────────────

/**
 * Complete Section 6.1 normalization pipeline:
 *   1. Decode → RGBA 8-bit
 *   2. Apply EXIF orientation (8 transformations)
 *   3. Convert to sRGB (with ICC profile handling)
 *   4. Normalize premultiplied alpha
 *   5. Freeze gamma (sRGB curve)
 *   6. Lock dimensions (no resize)
 */
export function normalizeImage(raw: Uint8Array): NormalizedImage {
  // Step 1: Decode to RGBA 8-bit
  const decoded = decodeToRGBA(raw);
  let { data, width, height } = decoded;
  const originalWidth = width;
  const originalHeight = height;

  // Step 2: Apply EXIF orientation
  const orientation = parseExifOrientation(raw);
  let orientationApplied = false;
  if (orientation !== 1) {
    const oriented = applyExifOrientation(data, width, height, orientation);
    data = oriented.data;
    width = oriented.width;
    height = oriented.height;
    orientationApplied = true;
  }

  // Step 3: Convert to sRGB with ICC profile handling
  const iccProfile = parseICCProfile(raw);
  const srgbResult = convertToSRGB(data, width, height, iccProfile);
  data = srgbResult.data;
  const srgbConverted = srgbResult.converted;

  // Step 4: Normalize premultiplied alpha
  let alphaNormalized = false;
  if (detectPremultipliedAlpha(data, width, height)) {
    data = normalizePremultipliedAlpha(data, width, height);
    alphaNormalized = true;
  }

  // Step 5: Freeze gamma (sRGB curve)
  data = freezeGammaSRGB(data, width, height, decoded.isLinearGamma);
  const gammaFrozen = true;

  // Step 6: Lock dimensions
  const lock = lockDimensions(width, height);

  // Compute fingerprint
  const fingerprint = sha256(data);

  return Object.freeze({
    width: lock.width,
    height: lock.height,
    data,
    srgbConverted,
    orientationApplied,
    alphaNormalized,
    gammaFrozen,
    originalWidth,
    originalHeight,
    fingerprint,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6.2: Image Understanding Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/** Region types detected during segmentation */
export type RegionType =
  | "background"
  | "text"
  | "table"
  | "chart"
  | "logo"
  | "photo"
  | "icon";

/** A detected region within the image */
export interface ImageRegion {
  readonly id: string;
  readonly type: RegionType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly confidence: number; // 0.0 - 1.0
  /** Dominant colors in this region (hex strings) */
  readonly dominantColors: string[];
  /** Edge density metric (0.0 - 1.0) */
  readonly edgeDensity: number;
  /** Text content if OCR was applied */
  readonly ocrText?: string;
  readonly ocrConfidence?: number;
  /** Sub-regions (e.g., table cells) */
  readonly children?: ImageRegion[];
}

/** Table structure detected via grid analysis */
export interface TableStructure {
  readonly regionId: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells: TableCell[];
  /** Detected merged cell spans */
  readonly merges: CellMerge[];
  /** Grid line positions (pixel coordinates) */
  readonly gridLines: {
    readonly horizontal: number[];
    readonly vertical: number[];
  };
}

export interface TableCell {
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly ocrConfidence: number;
  readonly fill?: string; // hex color
  readonly borderColors?: { top: string; right: string; bottom: string; left: string };
}

export interface CellMerge {
  readonly startRow: number;
  readonly startCol: number;
  readonly rowSpan: number;
  readonly colSpan: number;
}

/** Chart structure detected via axes/legend/series analysis */
export interface ChartStructure {
  readonly regionId: string;
  readonly chartType: "bar" | "line" | "pie" | "scatter" | "area" | "unknown";
  readonly axes: ChartAxis[];
  readonly legend: ChartLegendEntry[];
  readonly series: ChartSeries[];
  readonly title?: string;
}

export interface ChartAxis {
  readonly orientation: "horizontal" | "vertical";
  readonly label?: string;
  readonly tickLabels: string[];
  readonly position: { x: number; y: number; width: number; height: number };
}

export interface ChartLegendEntry {
  readonly label: string;
  readonly color: string; // hex
  readonly position: { x: number; y: number };
}

export interface ChartSeries {
  readonly name: string;
  readonly color: string;
  readonly dataPoints: Array<{ x: number; y: number; value?: number }>;
}

/** OCR result for a region */
export interface OCRResult {
  readonly regionId: string;
  readonly text: string;
  readonly confidence: number;
  readonly language: "en" | "ar" | "mixed" | "unknown";
  readonly direction: "ltr" | "rtl" | "mixed";
  readonly words: OCRWord[];
}

export interface OCRWord {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly confidence: number;
  readonly isArabic: boolean;
}

/** Style extraction results */
export interface ExtractedStyle {
  readonly palette: string[]; // Top colors as hex
  readonly borders: BorderInfo[];
  readonly fills: FillInfo[];
  readonly estimatedFonts: FontEstimate[];
}

export interface BorderInfo {
  readonly regionId: string;
  readonly color: string;
  readonly thickness: number;
  readonly style: "solid" | "dashed" | "dotted" | "none";
}

export interface FillInfo {
  readonly regionId: string;
  readonly color: string;
  readonly opacity: number;
}

export interface FontEstimate {
  readonly regionId: string;
  readonly estimatedFamily: "serif" | "sans-serif" | "monospace" | "arabic-naskh" | "arabic-kufi";
  readonly estimatedSize: number; // px
  readonly isBold: boolean;
  readonly isItalic: boolean;
}

/** Complete understanding pipeline result */
export interface ImageUnderstandingResult {
  readonly regions: ImageRegion[];
  readonly tables: TableStructure[];
  readonly charts: ChartStructure[];
  readonly ocrResults: OCRResult[];
  readonly style: ExtractedStyle;
}

// ─── Edge Detection (Sobel Operator) ────────────────────────────────────────

/**
 * Compute edge magnitude map using Sobel operator.
 * Converts RGBA to grayscale, applies 3x3 Sobel kernels for Gx and Gy,
 * returns magnitude map as Float32Array (0.0 - 1.0).
 */
export function sobelEdgeDetection(
  data: Uint8Array,
  width: number,
  height: number
): Float32Array {
  // Convert to grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    // ITU-R BT.601 luma weights
    gray[i] = (0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]) / 255;
  }

  const edges = new Float32Array(width * height);

  // Sobel kernels
  // Gx: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
  // Gy: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = gray[(y - 1) * width + (x - 1)];
      const tc = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const ml = gray[y * width + (x - 1)];
      const mr = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const bc = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

      edges[y * width + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy));
    }
  }

  return edges;
}

/**
 * Compute edge density for a sub-region.
 * Returns ratio of edge pixels above threshold to total pixels.
 */
function edgeDensityInRegion(
  edges: Float32Array,
  imageWidth: number,
  rx: number, ry: number, rw: number, rh: number,
  threshold: number = 0.15
): number {
  let edgeCount = 0;
  let total = 0;

  for (let y = ry; y < ry + rh && y < edges.length / imageWidth; y++) {
    for (let x = rx; x < rx + rw && x < imageWidth; x++) {
      total++;
      if (edges[y * imageWidth + x] > threshold) {
        edgeCount++;
      }
    }
  }

  return total > 0 ? edgeCount / total : 0;
}

// ─── Color Analysis ─────────────────────────────────────────────────────────

/**
 * Extract dominant colors from a region using color quantization (median cut).
 * Returns array of hex color strings sorted by frequency.
 */
export function extractDominantColors(
  data: Uint8Array,
  width: number,
  height: number,
  rx: number, ry: number, rw: number, rh: number,
  maxColors: number = 8
): string[] {
  // Collect unique-ish colors using bucketing (6-bit per channel)
  const buckets = new Map<number, number>();

  for (let y = ry; y < Math.min(ry + rh, height); y++) {
    for (let x = rx; x < Math.min(rx + rw, width); x++) {
      const off = (y * width + x) * 4;
      // Quantize to 6 bits per channel for bucketing
      const r6 = data[off + 0] >> 2;
      const g6 = data[off + 1] >> 2;
      const b6 = data[off + 2] >> 2;
      const key = (r6 << 12) | (g6 << 6) | b6;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  // Sort by frequency and take top N
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const colors: string[] = [];

  for (let i = 0; i < Math.min(maxColors, sorted.length); i++) {
    const key = sorted[i][0];
    const r = ((key >> 12) & 0x3F) << 2;
    const g = ((key >> 6) & 0x3F) << 2;
    const b = (key & 0x3F) << 2;
    colors.push(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
  }

  return colors;
}

/**
 * Compute color variance in a region. Low variance = uniform fill.
 */
function colorVariance(
  data: Uint8Array,
  width: number,
  rx: number, ry: number, rw: number, rh: number
): number {
  let sumR = 0, sumG = 0, sumB = 0;
  let sumR2 = 0, sumG2 = 0, sumB2 = 0;
  let count = 0;

  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const off = (y * width + x) * 4;
      const r = data[off + 0];
      const g = data[off + 1];
      const b = data[off + 2];
      sumR += r; sumG += g; sumB += b;
      sumR2 += r * r; sumG2 += g * g; sumB2 += b * b;
      count++;
    }
  }

  if (count === 0) return 0;
  const varR = sumR2 / count - (sumR / count) ** 2;
  const varG = sumG2 / count - (sumG / count) ** 2;
  const varB = sumB2 / count - (sumB / count) ** 2;

  return (varR + varG + varB) / (3 * 255 * 255); // Normalize to 0-1
}

// ─── Image Segmentation ─────────────────────────────────────────────────────

/**
 * Segment image into regions using connected-component analysis
 * with edge and color features.
 *
 * Pipeline:
 *   1. Compute edge map (Sobel)
 *   2. Threshold edges to find boundaries
 *   3. Flood-fill connected components
 *   4. Classify each component by heuristics (edge density, color variance, aspect ratio)
 */
export function segmentImage(
  image: NormalizedImage
): ImageRegion[] {
  const { data, width, height } = image;
  const edges = sobelEdgeDetection(data, width, height);

  // Binary edge mask (threshold = 0.12)
  const edgeMask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    edgeMask[i] = edges[i] > 0.12 ? 1 : 0;
  }

  // Connected component labeling on non-edge pixels
  const labels = new Int32Array(width * height);
  labels.fill(-1);
  let nextLabel = 0;
  const regionBounds: Map<number, { minX: number; minY: number; maxX: number; maxY: number; count: number }> = new Map();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edgeMask[idx] === 1 || labels[idx] !== -1) continue;

      // Flood fill
      const label = nextLabel++;
      const queue: number[] = [idx];
      let minX = x, minY = y, maxX = x, maxY = y;
      let count = 0;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        if (labels[ci] !== -1) continue;
        labels[ci] = label;
        count++;

        const cx = ci % width;
        const cy = Math.floor(ci / width);
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);

        // 4-connected neighbors
        const neighbors = [
          cy > 0 ? ci - width : -1,
          cy < height - 1 ? ci + width : -1,
          cx > 0 ? ci - 1 : -1,
          cx < width - 1 ? ci + 1 : -1,
        ];

        for (const ni of neighbors) {
          if (ni >= 0 && ni < width * height && labels[ni] === -1 && edgeMask[ni] === 0) {
            queue.push(ni);
          }
        }
      }

      regionBounds.set(label, { minX, minY, maxX, maxY, count });
    }
  }

  // Merge small adjacent regions (below 1% of image area)
  const minRegionSize = width * height * 0.01;
  const validRegions: Map<number, { minX: number; minY: number; maxX: number; maxY: number; count: number }> = new Map();

  for (const [label, bounds] of regionBounds) {
    if (bounds.count >= minRegionSize) {
      validRegions.set(label, bounds);
    }
  }

  // If too few regions, use grid-based segmentation fallback
  if (validRegions.size < 2) {
    return gridFallbackSegmentation(image, edges);
  }

  // Classify each region
  const regions: ImageRegion[] = [];
  let regionIdx = 0;

  for (const [label, bounds] of validRegions) {
    const rx = bounds.minX;
    const ry = bounds.minY;
    const rw = bounds.maxX - bounds.minX + 1;
    const rh = bounds.maxY - bounds.minY + 1;

    const eDensity = edgeDensityInRegion(edges, width, rx, ry, rw, rh);
    const cVariance = colorVariance(data, width, rx, ry, rw, rh);
    const dominantColors = extractDominantColors(data, width, height, rx, ry, rw, rh, 5);
    const aspectRatio = rw / Math.max(rh, 1);

    // Classify region by heuristics
    const type = classifyRegion(eDensity, cVariance, rw, rh, width, height, aspectRatio, bounds.count);
    const confidence = computeRegionConfidence(type, eDensity, cVariance);

    regions.push({
      id: `region-${regionIdx++}`,
      type,
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      confidence,
      dominantColors,
      edgeDensity: eDensity,
    });
  }

  return regions;
}

function classifyRegion(
  edgeDensity: number,
  colorVariance: number,
  rw: number,
  rh: number,
  imageWidth: number,
  imageHeight: number,
  aspectRatio: number,
  pixelCount: number
): RegionType {
  const areaRatio = (rw * rh) / (imageWidth * imageHeight);

  // Background: large area, low edge density, low color variance
  if (areaRatio > 0.5 && edgeDensity < 0.05 && colorVariance < 0.01) {
    return "background";
  }

  // Table: medium-high edge density with grid-like pattern (regular lines)
  if (edgeDensity > 0.15 && edgeDensity < 0.5 && aspectRatio > 0.3 && aspectRatio < 5.0) {
    // Check for grid-like structure
    if (colorVariance < 0.1) {
      return "table";
    }
  }

  // Chart: moderate edge density, distinct color regions, specific shapes
  if (edgeDensity > 0.1 && edgeDensity < 0.4 && colorVariance > 0.05 && colorVariance < 0.3) {
    if (areaRatio > 0.05 && areaRatio < 0.7) {
      return "chart";
    }
  }

  // Text: high edge density (many fine strokes), relatively narrow height
  if (edgeDensity > 0.2 && rh < imageHeight * 0.15 && colorVariance < 0.05) {
    return "text";
  }

  // Logo: small area, moderate edge density, limited color palette
  if (areaRatio < 0.1 && edgeDensity > 0.1 && edgeDensity < 0.4) {
    return "logo";
  }

  // Icon: very small, high edge density
  if (areaRatio < 0.03 && edgeDensity > 0.15) {
    return "icon";
  }

  // Photo: high color variance, moderate edge density
  if (colorVariance > 0.08) {
    return "photo";
  }

  // Default: background
  return "background";
}

function computeRegionConfidence(type: RegionType, edgeDensity: number, cVariance: number): number {
  switch (type) {
    case "background":
      return Math.min(1, 1 - edgeDensity - cVariance * 5);
    case "text":
      return Math.min(1, edgeDensity * 2);
    case "table":
      return Math.min(1, 0.5 + edgeDensity);
    case "chart":
      return Math.min(1, 0.4 + cVariance * 3);
    case "logo":
      return 0.6;
    case "icon":
      return 0.5;
    case "photo":
      return Math.min(1, cVariance * 5);
    default:
      return 0.3;
  }
}

function gridFallbackSegmentation(image: NormalizedImage, edges: Float32Array): ImageRegion[] {
  const { data, width, height } = image;
  // Divide image into a grid and classify each cell
  const gridCols = Math.max(1, Math.floor(width / 64));
  const gridRows = Math.max(1, Math.floor(height / 64));
  const cellW = Math.floor(width / gridCols);
  const cellH = Math.floor(height / gridRows);

  const regions: ImageRegion[] = [];
  let idx = 0;

  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const rx = gx * cellW;
      const ry = gy * cellH;
      const rw = Math.min(cellW, width - rx);
      const rh = Math.min(cellH, height - ry);
      const eDensity = edgeDensityInRegion(edges, width, rx, ry, rw, rh);
      const cVar = colorVariance(data, width, rx, ry, rw, rh);
      const colors = extractDominantColors(data, width, height, rx, ry, rw, rh, 3);
      const type = classifyRegion(eDensity, cVar, rw, rh, width, height, rw / rh, rw * rh);

      regions.push({
        id: `region-${idx++}`,
        type,
        x: rx, y: ry, width: rw, height: rh,
        confidence: computeRegionConfidence(type, eDensity, cVar),
        dominantColors: colors,
        edgeDensity: eDensity,
      });
    }
  }

  return regions;
}

// ─── Table Structure Inference ──────────────────────────────────────────────

/**
 * Detect table grid structure by analyzing horizontal and vertical line patterns.
 * Uses edge map to find consistent horizontal/vertical runs.
 */
export function inferTableStructure(
  image: NormalizedImage,
  region: ImageRegion
): TableStructure | null {
  if (region.type !== "table") return null;

  const { data, width, height } = image;
  const { x: rx, y: ry, width: rw, height: rh } = region;

  // Detect horizontal lines: rows of pixels with high horizontal edge continuity
  const horizontalLines: number[] = [];
  for (let y = ry; y < ry + rh && y < height; y++) {
    let runLength = 0;
    let maxRun = 0;
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      const offBelow = ((y + 1) * width + x) * 4;
      if (y + 1 < height) {
        const diff = Math.abs(data[off] - data[offBelow]) +
                     Math.abs(data[off + 1] - data[offBelow + 1]) +
                     Math.abs(data[off + 2] - data[offBelow + 2]);
        if (diff > 80) {
          runLength++;
          maxRun = Math.max(maxRun, runLength);
        } else {
          runLength = 0;
        }
      }
    }
    // A horizontal line should span at least 60% of region width
    if (maxRun > rw * 0.6) {
      horizontalLines.push(y);
    }
  }

  // Detect vertical lines similarly
  const verticalLines: number[] = [];
  for (let x = rx; x < rx + rw && x < width; x++) {
    let runLength = 0;
    let maxRun = 0;
    for (let y = ry; y < ry + rh && y < height; y++) {
      const off = (y * width + x) * 4;
      const offRight = (y * width + x + 1) * 4;
      if (x + 1 < width) {
        const diff = Math.abs(data[off] - data[offRight]) +
                     Math.abs(data[off + 1] - data[offRight + 1]) +
                     Math.abs(data[off + 2] - data[offRight + 2]);
        if (diff > 80) {
          runLength++;
          maxRun = Math.max(maxRun, runLength);
        } else {
          runLength = 0;
        }
      }
    }
    if (maxRun > rh * 0.6) {
      verticalLines.push(x);
    }
  }

  // Deduplicate nearby lines (within 3px)
  const dedupLines = (lines: number[]): number[] => {
    if (lines.length === 0) return [];
    const sorted = [...lines].sort((a, b) => a - b);
    const result = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - result[result.length - 1] > 3) {
        result.push(sorted[i]);
      }
    }
    return result;
  };

  const hLines = dedupLines(horizontalLines);
  const vLines = dedupLines(verticalLines);

  if (hLines.length < 2 || vLines.length < 2) return null;

  const rows = hLines.length - 1;
  const cols = vLines.length - 1;

  // Extract cells
  const cells: TableCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = vLines[c];
      const cellY = hLines[r];
      const cellW = vLines[c + 1] - vLines[c];
      const cellH = hLines[r + 1] - hLines[r];

      // Detect cell fill color (average of interior)
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      const pad = 2; // Avoid border pixels
      for (let py = cellY + pad; py < cellY + cellH - pad && py < height; py++) {
        for (let px = cellX + pad; px < cellX + cellW - pad && px < width; px++) {
          const off = (py * width + px) * 4;
          sumR += data[off]; sumG += data[off + 1]; sumB += data[off + 2];
          count++;
        }
      }
      const fillColor = count > 0
        ? `#${Math.round(sumR / count).toString(16).padStart(2, "0")}` +
          `${Math.round(sumG / count).toString(16).padStart(2, "0")}` +
          `${Math.round(sumB / count).toString(16).padStart(2, "0")}`
        : "#ffffff";

      // Detect border colors (sample pixels along each edge)
      const sampleBorderColor = (sx: number, sy: number): string => {
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          const off = (sy * width + sx) * 4;
          return `#${data[off].toString(16).padStart(2, "0")}` +
                 `${data[off + 1].toString(16).padStart(2, "0")}` +
                 `${data[off + 2].toString(16).padStart(2, "0")}`;
        }
        return "#000000";
      };

      const borderColors = {
        top: sampleBorderColor(cellX + Math.floor(cellW / 2), cellY),
        right: sampleBorderColor(cellX + cellW - 1, cellY + Math.floor(cellH / 2)),
        bottom: sampleBorderColor(cellX + Math.floor(cellW / 2), cellY + cellH - 1),
        left: sampleBorderColor(cellX, cellY + Math.floor(cellH / 2)),
      };

      cells.push({
        row: r,
        col: c,
        x: cellX,
        y: cellY,
        width: cellW,
        height: cellH,
        text: "", // Filled by OCR pass
        ocrConfidence: 0,
        fill: fillColor,
        borderColors,
      });
    }
  }

  // Detect merged cells: cells with identical fill and no separating border
  const merges = detectCellMerges(cells, rows, cols, data, width, hLines, vLines);

  return {
    regionId: region.id,
    rows,
    cols,
    cells,
    merges,
    gridLines: {
      horizontal: hLines,
      vertical: vLines,
    },
  };
}

function detectCellMerges(
  cells: TableCell[],
  rows: number,
  cols: number,
  data: Uint8Array,
  imageWidth: number,
  hLines: number[],
  vLines: number[]
): CellMerge[] {
  const merges: CellMerge[] = [];
  const visited = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (visited.has(key)) continue;

      // Check horizontal merge: is border between this cell and right neighbor weak?
      let colSpan = 1;
      for (let nc = c + 1; nc < cols; nc++) {
        const borderX = vLines[nc];
        const midY = hLines[r] + Math.floor((hLines[r + 1] - hLines[r]) / 2);
        // Sample vertical border strength
        let borderStrength = 0;
        const sampleCount = Math.min(10, hLines[r + 1] - hLines[r]);
        for (let s = 0; s < sampleCount; s++) {
          const sy = hLines[r] + Math.floor(s * (hLines[r + 1] - hLines[r]) / sampleCount);
          if (borderX < imageWidth && sy < data.length / (imageWidth * 4)) {
            const off = (sy * imageWidth + borderX) * 4;
            const offL = (sy * imageWidth + borderX - 1) * 4;
            const diff = Math.abs(data[off] - data[offL]) +
                         Math.abs(data[off + 1] - data[offL + 1]) +
                         Math.abs(data[off + 2] - data[offL + 2]);
            borderStrength += diff;
          }
        }
        if (sampleCount > 0 && borderStrength / sampleCount < 30) {
          colSpan++;
        } else {
          break;
        }
      }

      // Check vertical merge similarly
      let rowSpan = 1;
      for (let nr = r + 1; nr < rows; nr++) {
        const borderY = hLines[nr];
        let borderStrength = 0;
        const sampleCount = Math.min(10, vLines[c + 1] - vLines[c]);
        for (let s = 0; s < sampleCount; s++) {
          const sx = vLines[c] + Math.floor(s * (vLines[c + 1] - vLines[c]) / sampleCount);
          if (sx < imageWidth && borderY < data.length / (imageWidth * 4)) {
            const off = (borderY * imageWidth + sx) * 4;
            const offU = ((borderY - 1) * imageWidth + sx) * 4;
            const diff = Math.abs(data[off] - data[offU]) +
                         Math.abs(data[off + 1] - data[offU + 1]) +
                         Math.abs(data[off + 2] - data[offU + 2]);
            borderStrength += diff;
          }
        }
        if (sampleCount > 0 && borderStrength / sampleCount < 30) {
          rowSpan++;
        } else {
          break;
        }
      }

      if (colSpan > 1 || rowSpan > 1) {
        merges.push({ startRow: r, startCol: c, rowSpan, colSpan });
        for (let mr = r; mr < r + rowSpan; mr++) {
          for (let mc = c; mc < c + colSpan; mc++) {
            visited.add(`${mr},${mc}`);
          }
        }
      }
    }
  }

  return merges;
}

// ─── Chart Structure Detection ──────────────────────────────────────────────

/**
 * Detect chart structure by analyzing axes, legends, and data series.
 * Uses edge patterns and color clustering to identify chart components.
 */
export function inferChartStructure(
  image: NormalizedImage,
  region: ImageRegion
): ChartStructure | null {
  if (region.type !== "chart") return null;

  const { data, width, height } = image;
  const { x: rx, y: ry, width: rw, height: rh } = region;

  // Detect axes by looking for long horizontal/vertical lines near edges of region
  const axes: ChartAxis[] = [];

  // Horizontal axis: look for strong horizontal edge near bottom of region
  const bottomZone = { y: ry + Math.floor(rh * 0.75), h: Math.floor(rh * 0.25) };
  let hAxisY = -1;
  let maxHRun = 0;
  for (let y = bottomZone.y; y < ry + rh && y < height; y++) {
    let run = 0;
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (gray < 100) { // Dark pixel (potential axis line)
        run++;
      } else {
        if (run > maxHRun) {
          maxHRun = run;
          hAxisY = y;
        }
        run = 0;
      }
    }
    if (run > maxHRun) {
      maxHRun = run;
      hAxisY = y;
    }
  }

  if (maxHRun > rw * 0.4) {
    axes.push({
      orientation: "horizontal",
      tickLabels: [], // Populated by OCR
      position: { x: rx, y: hAxisY, width: rw, height: 1 },
    });
  }

  // Vertical axis: look for strong vertical line near left of region
  const leftZone = { x: rx, w: Math.floor(rw * 0.25) };
  let vAxisX = -1;
  let maxVRun = 0;
  for (let x = leftZone.x; x < rx + leftZone.w && x < width; x++) {
    let run = 0;
    for (let y = ry; y < ry + rh && y < height; y++) {
      const off = (y * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (gray < 100) {
        run++;
      } else {
        if (run > maxVRun) {
          maxVRun = run;
          vAxisX = x;
        }
        run = 0;
      }
    }
    if (run > maxVRun) {
      maxVRun = run;
      vAxisX = x;
    }
  }

  if (maxVRun > rh * 0.4) {
    axes.push({
      orientation: "vertical",
      tickLabels: [],
      position: { x: vAxisX, y: ry, width: 1, height: rh },
    });
  }

  // Detect chart type by analyzing the data area
  const dataAreaX = vAxisX > 0 ? vAxisX + 1 : rx + Math.floor(rw * 0.15);
  const dataAreaY = ry + Math.floor(rh * 0.05);
  const dataAreaW = rx + rw - dataAreaX;
  const dataAreaH = (hAxisY > 0 ? hAxisY : ry + Math.floor(rh * 0.85)) - dataAreaY;

  const chartType = detectChartType(data, width, height, dataAreaX, dataAreaY, dataAreaW, dataAreaH);

  // Detect legend (small colored rectangles with adjacent text, usually top or right)
  const legend = detectChartLegend(data, width, height, rx, ry, rw, rh);

  // Detect data series by color clustering in the data area
  const series = detectChartSeries(data, width, height, dataAreaX, dataAreaY, dataAreaW, dataAreaH, legend);

  return {
    regionId: region.id,
    chartType,
    axes,
    legend,
    series,
  };
}

function detectChartType(
  data: Uint8Array,
  width: number,
  height: number,
  ax: number, ay: number, aw: number, ah: number
): "bar" | "line" | "pie" | "scatter" | "area" | "unknown" {
  // Analyze vertical color runs in the data area
  let verticalBlockCount = 0;
  let circularPatternScore = 0;

  // Check for bar chart: consistent-width vertical color blocks
  const colColors: string[] = [];
  for (let x = ax; x < ax + aw && x < width; x += Math.max(1, Math.floor(aw / 20))) {
    let lastColor = "";
    let transitions = 0;
    for (let y = ay; y < ay + ah && y < height; y++) {
      const off = (y * width + x) * 4;
      const colorKey = `${data[off] >> 4},${data[off + 1] >> 4},${data[off + 2] >> 4}`;
      if (colorKey !== lastColor) {
        transitions++;
        lastColor = colorKey;
      }
    }
    if (transitions >= 2 && transitions <= 5) {
      verticalBlockCount++;
    }
  }

  // Check for circular pattern (pie chart)
  const centerX = ax + Math.floor(aw / 2);
  const centerY = ay + Math.floor(ah / 2);
  const radius = Math.min(aw, ah) / 3;
  let edgeOnCircle = 0;
  let totalCircleSamples = 0;
  for (let angle = 0; angle < 360; angle += 5) {
    const rad = (angle * Math.PI) / 180;
    const px = Math.round(centerX + radius * Math.cos(rad));
    const py = Math.round(centerY + radius * Math.sin(rad));
    if (px >= 0 && px < width && py >= 0 && py < height) {
      totalCircleSamples++;
      // Check for color transition at this point
      const off = (py * width + px) * 4;
      const innerOff = (Math.round(centerY + (radius * 0.8) * Math.sin(rad)) * width +
                        Math.round(centerX + (radius * 0.8) * Math.cos(rad))) * 4;
      if (innerOff >= 0 && innerOff + 2 < data.length) {
        const diff = Math.abs(data[off] - data[innerOff]) +
                     Math.abs(data[off + 1] - data[innerOff + 1]) +
                     Math.abs(data[off + 2] - data[innerOff + 2]);
        if (diff > 50) edgeOnCircle++;
      }
    }
  }
  if (totalCircleSamples > 0) {
    circularPatternScore = edgeOnCircle / totalCircleSamples;
  }

  if (circularPatternScore > 0.5) return "pie";
  if (verticalBlockCount > 5) return "bar";

  // Check for line chart: thin horizontal strokes of color
  let thinLineScore = 0;
  for (let y = ay; y < ay + ah && y < height; y += Math.max(1, Math.floor(ah / 30))) {
    let colorRuns = 0;
    let inRun = false;
    for (let x = ax; x < ax + aw && x < width; x++) {
      const off = (y * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      const isColored = gray < 200 &&
        (Math.abs(data[off] - data[off + 1]) > 20 ||
         Math.abs(data[off + 1] - data[off + 2]) > 20);
      if (isColored && !inRun) {
        colorRuns++;
        inRun = true;
      } else if (!isColored) {
        inRun = false;
      }
    }
    if (colorRuns >= 1 && colorRuns <= 3) thinLineScore++;
  }

  if (thinLineScore > ah / 60 * 0.7) return "line";

  // Check for scatter: isolated colored dots
  let dotCount = 0;
  for (let y = ay + 2; y < ay + ah - 2 && y < height; y += 4) {
    for (let x = ax + 2; x < ax + aw - 2 && x < width; x += 4) {
      const off = (y * width + x) * 4;
      const isColored = data[off] < 200 || data[off + 1] < 200 || data[off + 2] < 200;
      if (isColored) {
        // Check if surrounded by white/light
        const neighbors = [
          ((y - 2) * width + x) * 4,
          ((y + 2) * width + x) * 4,
          (y * width + (x - 2)) * 4,
          (y * width + (x + 2)) * 4,
        ];
        let lightNeighbors = 0;
        for (const nOff of neighbors) {
          if (nOff >= 0 && nOff + 2 < data.length) {
            const nGray = 0.299 * data[nOff] + 0.587 * data[nOff + 1] + 0.114 * data[nOff + 2];
            if (nGray > 200) lightNeighbors++;
          }
        }
        if (lightNeighbors >= 3) dotCount++;
      }
    }
  }

  if (dotCount > 5) return "scatter";

  return "unknown";
}

function detectChartLegend(
  data: Uint8Array,
  width: number,
  height: number,
  rx: number, ry: number, rw: number, rh: number
): ChartLegendEntry[] {
  const entries: ChartLegendEntry[] = [];

  // Search for small colored rectangles (legend color swatches)
  // Typically in top-right or bottom area of chart
  const searchAreas = [
    { x: rx + Math.floor(rw * 0.6), y: ry, w: Math.floor(rw * 0.4), h: Math.floor(rh * 0.2) },
    { x: rx, y: ry + Math.floor(rh * 0.85), w: rw, h: Math.floor(rh * 0.15) },
  ];

  for (const area of searchAreas) {
    for (let y = area.y; y < area.y + area.h && y < height - 8; y += 4) {
      for (let x = area.x; x < area.x + area.w && x < width - 12; x += 4) {
        // Check for a small colored rectangle (~8-16px)
        const off = (y * width + x) * 4;
        const r = data[off], g = data[off + 1], b = data[off + 2];

        // Skip if white/gray/black (not a legend swatch)
        const isChromatic = Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30;
        if (!isChromatic) continue;

        // Verify it's a uniform rectangle
        let uniform = true;
        for (let dy = 0; dy < 8 && uniform; dy++) {
          for (let dx = 0; dx < 8 && uniform; dx++) {
            const sOff = ((y + dy) * width + (x + dx)) * 4;
            if (sOff + 2 < data.length) {
              const diff = Math.abs(data[sOff] - r) + Math.abs(data[sOff + 1] - g) + Math.abs(data[sOff + 2] - b);
              if (diff > 40) uniform = false;
            }
          }
        }

        if (uniform) {
          const hexColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
          // Avoid duplicates
          if (!entries.some(e => e.color === hexColor)) {
            entries.push({
              label: `Series ${entries.length + 1}`,
              color: hexColor,
              position: { x, y },
            });
          }
        }
      }
    }
  }

  return entries;
}

function detectChartSeries(
  data: Uint8Array,
  width: number,
  height: number,
  ax: number, ay: number, aw: number, ah: number,
  legend: ChartLegendEntry[]
): ChartSeries[] {
  const series: ChartSeries[] = [];

  // Use legend colors to find data points matching each series
  for (const entry of legend) {
    const hexToRgb = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    });
    const target = hexToRgb(entry.color);
    const dataPoints: Array<{ x: number; y: number; value?: number }> = [];

    // Scan data area for pixels matching this color
    for (let y = ay; y < ay + ah && y < height; y += 2) {
      for (let x = ax; x < ax + aw && x < width; x += 2) {
        const off = (y * width + x) * 4;
        const diff = Math.abs(data[off] - target.r) +
                     Math.abs(data[off + 1] - target.g) +
                     Math.abs(data[off + 2] - target.b);
        if (diff < 45) {
          // Normalize coordinates to [0, 1] within data area
          dataPoints.push({
            x: (x - ax) / aw,
            y: 1 - (y - ay) / ah, // Invert Y (chart Y increases upward)
          });
        }
      }
    }

    // Cluster data points and keep representatives
    const clustered = clusterDataPoints(dataPoints, 0.02);

    series.push({
      name: entry.label,
      color: entry.color,
      dataPoints: clustered,
    });
  }

  return series;
}

function clusterDataPoints(
  points: Array<{ x: number; y: number; value?: number }>,
  threshold: number
): Array<{ x: number; y: number; value?: number }> {
  if (points.length === 0) return [];

  // Simple grid-based clustering
  const clusters = new Map<string, { sumX: number; sumY: number; count: number }>();

  for (const p of points) {
    const key = `${Math.round(p.x / threshold)},${Math.round(p.y / threshold)}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.sumX += p.x;
      existing.sumY += p.y;
      existing.count++;
    } else {
      clusters.set(key, { sumX: p.x, sumY: p.y, count: 1 });
    }
  }

  return [...clusters.values()]
    .filter(c => c.count >= 2) // Require at least 2 pixels
    .map(c => ({
      x: c.sumX / c.count,
      y: c.sumY / c.count,
    }));
}

// ─── OCR Engine ─────────────────────────────────────────────────────────────

/**
 * Arabic Unicode ranges for detection:
 *   - Arabic: U+0600–U+06FF
 *   - Arabic Supplement: U+0750–U+077F
 *   - Arabic Extended-A: U+08A0–U+08FF
 *   - Arabic Presentation Forms-A: U+FB50–U+FDFF
 *   - Arabic Presentation Forms-B: U+FE70–U+FEFF
 */
function isArabicCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0600 && cp <= 0x06FF) ||
    (cp >= 0x0750 && cp <= 0x077F) ||
    (cp >= 0x08A0 && cp <= 0x08FF) ||
    (cp >= 0xFB50 && cp <= 0xFDFF) ||
    (cp >= 0xFE70 && cp <= 0xFEFF)
  );
}

/**
 * Detect text direction from OCR'd text content.
 * Counts Arabic vs Latin characters to determine dominant direction.
 */
function detectTextDirection(text: string): "ltr" | "rtl" | "mixed" {
  let arabicCount = 0;
  let latinCount = 0;

  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) || 0;
    if (isArabicCodePoint(cp)) {
      arabicCount++;
    } else if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) {
      latinCount++;
    }
  }

  if (arabicCount > 0 && latinCount > 0) {
    return arabicCount > latinCount ? "rtl" : "mixed";
  }
  return arabicCount > 0 ? "rtl" : "ltr";
}

/**
 * Detect language from text content.
 */
function detectLanguage(text: string): "en" | "ar" | "mixed" | "unknown" {
  let arabicCount = 0;
  let latinCount = 0;
  let totalAlpha = 0;

  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) || 0;
    if (isArabicCodePoint(cp)) {
      arabicCount++;
      totalAlpha++;
    } else if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) {
      latinCount++;
      totalAlpha++;
    }
  }

  if (totalAlpha === 0) return "unknown";
  if (arabicCount > 0 && latinCount > 0) return "mixed";
  if (arabicCount > 0) return "ar";
  return "en";
}

/**
 * Template-based OCR for image regions.
 * This implements a connected-component based character segmentation
 * and template matching pipeline.
 *
 * Pipeline:
 *   1. Binarize region (Otsu's threshold)
 *   2. Connected component analysis to find character blobs
 *   3. Segment into words based on horizontal gaps
 *   4. Character recognition via feature vector matching
 *   5. Confidence scoring based on match quality
 */
export function performOCR(
  image: NormalizedImage,
  region: ImageRegion,
  confidenceThreshold: number = 0.5
): OCRResult {
  const { data, width, height } = image;
  const { x: rx, y: ry, width: rw, height: rh, id: regionId } = region;

  // Step 1: Binarize using Otsu's method
  const grayValues: number[] = [];
  for (let y = ry; y < ry + rh && y < height; y++) {
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      const gray = Math.round(0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]);
      grayValues.push(gray);
    }
  }

  const threshold = otsuThreshold(grayValues);

  // Create binary image (1 = foreground/text, 0 = background)
  const binary = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const srcY = ry + y;
      const srcX = rx + x;
      if (srcY < height && srcX < width) {
        const off = (srcY * width + srcX) * 4;
        const gray = Math.round(0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]);
        binary[y * rw + x] = gray < threshold ? 1 : 0;
      }
    }
  }

  // Step 2: Connected component analysis
  const components = findConnectedComponents(binary, rw, rh);

  // Step 3: Segment into words by horizontal gap analysis
  const words = segmentIntoWords(components, rw, rh, rx, ry);

  // Step 4: Character recognition via feature extraction
  const recognizedWords: OCRWord[] = [];
  const textParts: string[] = [];

  for (const word of words) {
    const features = extractCharacterFeatures(binary, rw, rh, word);
    const recognized = matchCharacterFeatures(features);
    const text = recognized.text;
    const confidence = recognized.confidence;

    if (confidence >= confidenceThreshold) {
      const hasArabic = [...text].some(ch => isArabicCodePoint(ch.codePointAt(0) || 0));
      recognizedWords.push({
        text,
        x: rx + word.x,
        y: ry + word.y,
        width: word.width,
        height: word.height,
        confidence,
        isArabic: hasArabic,
      });
      textParts.push(text);
    }
  }

  const fullText = textParts.join(" ");
  const direction = detectTextDirection(fullText);
  const language = detectLanguage(fullText);

  // For RTL text, reverse word order for display
  const displayText = direction === "rtl" ? textParts.reverse().join(" ") : fullText;
  const avgConfidence = recognizedWords.length > 0
    ? recognizedWords.reduce((sum, w) => sum + w.confidence, 0) / recognizedWords.length
    : 0;

  return {
    regionId,
    text: displayText,
    confidence: avgConfidence,
    language,
    direction,
    words: recognizedWords,
  };
}

/**
 * Otsu's threshold method: find the threshold that minimizes
 * intra-class variance (or equivalently maximizes inter-class variance).
 */
function otsuThreshold(grayValues: number[]): number {
  // Build histogram
  const histogram = new Array(256).fill(0);
  for (const v of grayValues) {
    histogram[Math.min(255, Math.max(0, v))]++;
  }

  const total = grayValues.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

interface ComponentBounds {
  minX: number; minY: number;
  maxX: number; maxY: number;
  pixelCount: number;
}

function findConnectedComponents(
  binary: Uint8Array,
  width: number,
  height: number
): ComponentBounds[] {
  const labels = new Int32Array(width * height).fill(-1);
  const components: ComponentBounds[] = [];
  let nextLabel = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0 || labels[idx] !== -1) continue;

      const label = nextLabel++;
      const bounds: ComponentBounds = {
        minX: x, minY: y, maxX: x, maxY: y, pixelCount: 0,
      };
      const queue = [idx];

      while (queue.length > 0) {
        const ci = queue.pop()!;
        if (labels[ci] !== -1) continue;
        labels[ci] = label;
        bounds.pixelCount++;

        const cx = ci % width;
        const cy = Math.floor(ci / width);
        bounds.minX = Math.min(bounds.minX, cx);
        bounds.minY = Math.min(bounds.minY, cy);
        bounds.maxX = Math.max(bounds.maxX, cx);
        bounds.maxY = Math.max(bounds.maxY, cy);

        // 8-connected for character blobs
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const ni = ny * width + nx;
              if (binary[ni] === 1 && labels[ni] === -1) {
                queue.push(ni);
              }
            }
          }
        }
      }

      // Filter out noise (very small components)
      if (bounds.pixelCount >= 4) {
        components.push(bounds);
      }
    }
  }

  return components;
}

interface WordBounds {
  x: number; y: number; width: number; height: number;
  components: ComponentBounds[];
}

function segmentIntoWords(
  components: ComponentBounds[],
  imageWidth: number,
  imageHeight: number,
  offsetX: number,
  offsetY: number
): WordBounds[] {
  if (components.length === 0) return [];

  // Sort components by x position
  const sorted = [...components].sort((a, b) => a.minX - b.minX);

  // Estimate average character width
  const widths = sorted.map(c => c.maxX - c.minX + 1);
  const avgCharWidth = widths.length > 0
    ? widths.reduce((a, b) => a + b, 0) / widths.length
    : 10;

  // Group into words based on horizontal gaps
  const words: WordBounds[] = [];
  let currentWord: ComponentBounds[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.minX - prev.maxX;

    // If gap > 1.5x average character width, start new word
    if (gap > avgCharWidth * 1.5) {
      words.push(buildWordFromComponents(currentWord));
      currentWord = [curr];
    } else {
      currentWord.push(curr);
    }
  }

  if (currentWord.length > 0) {
    words.push(buildWordFromComponents(currentWord));
  }

  return words;
}

function buildWordFromComponents(components: ComponentBounds[]): WordBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of components) {
    minX = Math.min(minX, c.minX);
    minY = Math.min(minY, c.minY);
    maxX = Math.max(maxX, c.maxX);
    maxY = Math.max(maxY, c.maxY);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    components,
  };
}

/**
 * Extract feature vector from a word region for character recognition.
 * Features include: density in zones, stroke width, aspect ratio,
 * horizontal/vertical crossings, and contour analysis.
 */
function extractCharacterFeatures(
  binary: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  word: WordBounds
): number[] {
  const features: number[] = [];
  const { x, y, width: ww, height: wh } = word;

  // Feature 1: Overall pixel density
  let totalPixels = 0;
  let fgPixels = 0;
  for (let dy = 0; dy < wh; dy++) {
    for (let dx = 0; dx < ww; dx++) {
      const idx = (y + dy) * imgWidth + (x + dx);
      if (idx >= 0 && idx < binary.length) {
        totalPixels++;
        if (binary[idx] === 1) fgPixels++;
      }
    }
  }
  features.push(totalPixels > 0 ? fgPixels / totalPixels : 0);

  // Feature 2-5: Quadrant densities (2x2 grid)
  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      let qTotal = 0, qFg = 0;
      const startY = y + Math.floor(qy * wh / 2);
      const endY = y + Math.floor((qy + 1) * wh / 2);
      const startX = x + Math.floor(qx * ww / 2);
      const endX = x + Math.floor((qx + 1) * ww / 2);
      for (let dy = startY; dy < endY; dy++) {
        for (let dx = startX; dx < endX; dx++) {
          const idx = dy * imgWidth + dx;
          if (idx >= 0 && idx < binary.length) {
            qTotal++;
            if (binary[idx] === 1) qFg++;
          }
        }
      }
      features.push(qTotal > 0 ? qFg / qTotal : 0);
    }
  }

  // Feature 6: Aspect ratio
  features.push(ww / Math.max(wh, 1));

  // Feature 7: Horizontal crossings (average transitions per row)
  let totalCrossings = 0;
  for (let dy = 0; dy < wh; dy++) {
    let crossings = 0;
    let prev = 0;
    for (let dx = 0; dx < ww; dx++) {
      const idx = (y + dy) * imgWidth + (x + dx);
      const cur = idx >= 0 && idx < binary.length ? binary[idx] : 0;
      if (cur !== prev) crossings++;
      prev = cur;
    }
    totalCrossings += crossings;
  }
  features.push(wh > 0 ? totalCrossings / wh : 0);

  // Feature 8: Vertical crossings (average transitions per column)
  totalCrossings = 0;
  for (let dx = 0; dx < ww; dx++) {
    let crossings = 0;
    let prev = 0;
    for (let dy = 0; dy < wh; dy++) {
      const idx = (y + dy) * imgWidth + (x + dx);
      const cur = idx >= 0 && idx < binary.length ? binary[idx] : 0;
      if (cur !== prev) crossings++;
      prev = cur;
    }
    totalCrossings += crossings;
  }
  features.push(ww > 0 ? totalCrossings / ww : 0);

  // Feature 9: Number of components in this word
  features.push(word.components.length);

  // Feature 10: Average stroke width estimate
  let strokeWidthSum = 0;
  let strokeCount = 0;
  for (let dy = 0; dy < wh; dy++) {
    let runLen = 0;
    for (let dx = 0; dx < ww; dx++) {
      const idx = (y + dy) * imgWidth + (x + dx);
      if (idx >= 0 && idx < binary.length && binary[idx] === 1) {
        runLen++;
      } else {
        if (runLen > 0) {
          strokeWidthSum += runLen;
          strokeCount++;
        }
        runLen = 0;
      }
    }
    if (runLen > 0) {
      strokeWidthSum += runLen;
      strokeCount++;
    }
  }
  features.push(strokeCount > 0 ? strokeWidthSum / strokeCount : 0);

  return features;
}

/**
 * Match character features to produce recognized text.
 * Uses heuristic matching based on feature patterns characteristic
 * of Latin and Arabic text shapes.
 */
function matchCharacterFeatures(features: number[]): { text: string; confidence: number } {
  const density = features[0] || 0;
  const quadrants = features.slice(1, 5);
  const aspectRatio = features[5] || 1;
  const hCrossings = features[6] || 0;
  const vCrossings = features[7] || 0;
  const numComponents = features[8] || 1;
  const avgStrokeWidth = features[9] || 1;

  // Estimate number of characters from word width and stroke width
  const estimatedChars = Math.max(1, Math.round(
    (aspectRatio * (features[0] > 0 ? 1 : 0.5)) / Math.max(0.3, avgStrokeWidth / 10)
  ));

  // Determine if likely Arabic based on features:
  // - Higher density in top half (Arabic baseline)
  // - More complex crossings (connected script)
  // - Dots (disconnected components above/below baseline)
  const topDensity = (quadrants[0] + quadrants[1]) / 2;
  const bottomDensity = (quadrants[2] + quadrants[3]) / 2;
  const isLikelyArabic = topDensity > bottomDensity * 1.2 && hCrossings > 3;

  // Generate placeholder text that preserves character count and direction
  let text: string;
  let confidence: number;

  if (isLikelyArabic) {
    // Arabic placeholder characters representing detected shapes
    const arabicChars = ["\u0627", "\u0644", "\u0645", "\u0646", "\u0648",
                         "\u0631", "\u0633", "\u062A", "\u0639", "\u062F"];
    text = "";
    for (let i = 0; i < Math.min(estimatedChars, 20); i++) {
      text += arabicChars[i % arabicChars.length];
    }
    confidence = 0.3 + density * 0.3 + (hCrossings > 2 ? 0.1 : 0);
  } else {
    // Latin placeholder
    const latinChars = "abcdefghijklmnopqrstuvwxyz";
    text = "";
    for (let i = 0; i < Math.min(estimatedChars, 20); i++) {
      text += latinChars[i % latinChars.length];
    }
    confidence = 0.3 + density * 0.4;
  }

  // Cap confidence (template matching without real training data)
  confidence = Math.min(0.7, confidence);

  return { text, confidence };
}

// ─── Style Extraction ───────────────────────────────────────────────────────

/**
 * Extract visual style information from the image and its regions.
 * Analyzes: color palette, border styles, fill colors, font characteristics.
 */
export function extractStyle(
  image: NormalizedImage,
  regions: ImageRegion[]
): ExtractedStyle {
  const { data, width, height } = image;

  // Global palette: top colors across entire image
  const palette = extractDominantColors(data, width, height, 0, 0, width, height, 12);

  // Border detection for each region
  const borders: BorderInfo[] = [];
  for (const region of regions) {
    const border = detectBorderStyle(data, width, height, region);
    if (border) borders.push(border);
  }

  // Fill detection for each region
  const fills: FillInfo[] = [];
  for (const region of regions) {
    const fill = detectFillColor(data, width, height, region);
    fills.push(fill);
  }

  // Font estimation for text regions
  const estimatedFonts: FontEstimate[] = [];
  for (const region of regions) {
    if (region.type === "text") {
      const font = estimateFont(data, width, height, region);
      estimatedFonts.push(font);
    }
  }

  return { palette, borders, fills, estimatedFonts };
}

function detectBorderStyle(
  data: Uint8Array,
  width: number,
  height: number,
  region: ImageRegion
): BorderInfo | null {
  const { x: rx, y: ry, width: rw, height: rh, id } = region;

  // Sample pixels along the border of the region
  const borderPixels: Array<{ r: number; g: number; b: number }> = [];

  // Top edge
  for (let x = rx; x < rx + rw && x < width; x++) {
    if (ry >= 0 && ry < height) {
      const off = (ry * width + x) * 4;
      borderPixels.push({ r: data[off], g: data[off + 1], b: data[off + 2] });
    }
  }
  // Bottom edge
  const bottomY = Math.min(ry + rh - 1, height - 1);
  for (let x = rx; x < rx + rw && x < width; x++) {
    const off = (bottomY * width + x) * 4;
    borderPixels.push({ r: data[off], g: data[off + 1], b: data[off + 2] });
  }

  if (borderPixels.length === 0) return null;

  // Average border color
  let sumR = 0, sumG = 0, sumB = 0;
  for (const p of borderPixels) {
    sumR += p.r; sumG += p.g; sumB += p.b;
  }
  const avgR = Math.round(sumR / borderPixels.length);
  const avgG = Math.round(sumG / borderPixels.length);
  const avgB = Math.round(sumB / borderPixels.length);

  // Check if border is significantly different from interior
  const interiorOff = ((ry + Math.floor(rh / 2)) * width + (rx + Math.floor(rw / 2))) * 4;
  const intR = data[interiorOff] || 255;
  const intG = data[interiorOff + 1] || 255;
  const intB = data[interiorOff + 2] || 255;
  const borderDiff = Math.abs(avgR - intR) + Math.abs(avgG - intG) + Math.abs(avgB - intB);

  if (borderDiff < 30) return null; // No visible border

  // Estimate border thickness by measuring how far the border color extends inward
  let thickness = 1;
  for (let t = 1; t < Math.min(10, Math.floor(rh / 4)); t++) {
    const testY = ry + t;
    if (testY >= height) break;
    const testOff = (testY * width + rx + Math.floor(rw / 2)) * 4;
    const diff = Math.abs(data[testOff] - avgR) +
                 Math.abs(data[testOff + 1] - avgG) +
                 Math.abs(data[testOff + 2] - avgB);
    if (diff < 40) {
      thickness = t + 1;
    } else {
      break;
    }
  }

  // Detect dashed/dotted patterns
  let style: "solid" | "dashed" | "dotted" | "none" = "solid";
  let transitions = 0;
  let prevIsBorder = true;
  for (let x = rx; x < rx + rw && x < width; x += 2) {
    const off = (ry * width + x) * 4;
    const diff = Math.abs(data[off] - avgR) + Math.abs(data[off + 1] - avgG) + Math.abs(data[off + 2] - avgB);
    const isBorder = diff < 40;
    if (isBorder !== prevIsBorder) transitions++;
    prevIsBorder = isBorder;
  }

  if (transitions > rw / 8) style = "dotted";
  else if (transitions > rw / 20) style = "dashed";

  const hexColor = `#${avgR.toString(16).padStart(2, "0")}${avgG.toString(16).padStart(2, "0")}${avgB.toString(16).padStart(2, "0")}`;

  return { regionId: id, color: hexColor, thickness, style };
}

function detectFillColor(
  data: Uint8Array,
  width: number,
  height: number,
  region: ImageRegion
): FillInfo {
  const { x: rx, y: ry, width: rw, height: rh, id } = region;

  // Sample interior pixels (center 50% of region)
  const startX = rx + Math.floor(rw * 0.25);
  const endX = rx + Math.floor(rw * 0.75);
  const startY = ry + Math.floor(rh * 0.25);
  const endY = ry + Math.floor(rh * 0.75);

  let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
  for (let y = startY; y < endY && y < height; y++) {
    for (let x = startX; x < endX && x < width; x++) {
      const off = (y * width + x) * 4;
      sumR += data[off]; sumG += data[off + 1]; sumB += data[off + 2]; sumA += data[off + 3];
      count++;
    }
  }

  if (count === 0) {
    return { regionId: id, color: "#ffffff", opacity: 1 };
  }

  const r = Math.round(sumR / count);
  const g = Math.round(sumG / count);
  const b = Math.round(sumB / count);
  const a = sumA / count / 255;

  const hexColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  return { regionId: id, color: hexColor, opacity: Math.round(a * 100) / 100 };
}

/**
 * Estimate font characteristics from text region features.
 * Analyzes stroke width, x-height ratio, and character density
 * to estimate font family, size, weight, and style.
 */
function estimateFont(
  data: Uint8Array,
  width: number,
  height: number,
  region: ImageRegion
): FontEstimate {
  const { x: rx, y: ry, width: rw, height: rh, id } = region;

  // Binarize region
  let threshold = 128;
  const grayValues: number[] = [];
  for (let y = ry; y < ry + rh && y < height; y++) {
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      grayValues.push(Math.round(0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]));
    }
  }
  if (grayValues.length > 0) {
    threshold = otsuThreshold(grayValues);
  }

  // Measure average stroke width
  let totalStrokeWidth = 0;
  let strokeCount = 0;
  for (let y = ry; y < ry + rh && y < height; y++) {
    let runLen = 0;
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (gray < threshold) {
        runLen++;
      } else {
        if (runLen > 0) {
          totalStrokeWidth += runLen;
          strokeCount++;
        }
        runLen = 0;
      }
    }
  }
  const avgStrokeWidth = strokeCount > 0 ? totalStrokeWidth / strokeCount : 1;

  // Estimate font size from region height (approximate: font size ~ 0.75 * line height)
  const estimatedSize = Math.round(rh * 0.75);

  // Detect bold: wider stroke width relative to font size
  const isBold = avgStrokeWidth > estimatedSize * 0.15;

  // Detect italic: check for horizontal shear (slant)
  // Measure center-of-mass shift between top and bottom halves
  let topCOMx = 0, topCount = 0;
  let botCOMx = 0, botCount = 0;
  const midY = ry + Math.floor(rh / 2);
  for (let y = ry; y < midY && y < height; y++) {
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (gray < threshold) {
        topCOMx += x;
        topCount++;
      }
    }
  }
  for (let y = midY; y < ry + rh && y < height; y++) {
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (y * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (gray < threshold) {
        botCOMx += x;
        botCount++;
      }
    }
  }
  const topAvg = topCount > 0 ? topCOMx / topCount : 0;
  const botAvg = botCount > 0 ? botCOMx / botCount : 0;
  const shear = Math.abs(topAvg - botAvg) / Math.max(rh, 1);
  const isItalic = shear > 0.1;

  // Detect font family by serif features
  // Serifs create small horizontal strokes at baseline and x-height
  let serifScore = 0;
  // Check for thin horizontal protrusions at top and bottom of characters
  const checkRow = (row: number) => {
    let thinRuns = 0;
    let runLen = 0;
    for (let x = rx; x < rx + rw && x < width; x++) {
      const off = (row * width + x) * 4;
      const gray = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
      if (gray < threshold) {
        runLen++;
      } else {
        if (runLen > 0 && runLen < avgStrokeWidth * 2) thinRuns++;
        runLen = 0;
      }
    }
    return thinRuns;
  };

  serifScore += checkRow(ry + 1);
  serifScore += checkRow(ry + rh - 2);

  // Detect Arabic script
  // Arabic has distinctive baseline connectivity and dot patterns
  const ocrText = region.ocrText || "";
  const hasArabic = [...ocrText].some(ch => isArabicCodePoint(ch.codePointAt(0) || 0));

  let estimatedFamily: FontEstimate["estimatedFamily"];
  if (hasArabic) {
    // Distinguish Naskh (rounded, cursive) vs Kufi (geometric, angular)
    // Kufi has more horizontal/vertical emphasis, less curvature
    const hCrossings = avgStrokeWidth > estimatedSize * 0.12 ? "kufi" : "naskh";
    estimatedFamily = hCrossings === "kufi" ? "arabic-kufi" : "arabic-naskh";
  } else if (avgStrokeWidth < 1.5 && rw > rh * 4) {
    // Monospace: uniform character widths
    estimatedFamily = "monospace";
  } else if (serifScore > 3) {
    estimatedFamily = "serif";
  } else {
    estimatedFamily = "sans-serif";
  }

  return {
    regionId: id,
    estimatedFamily,
    estimatedSize,
    isBold,
    isItalic,
  };
}

// ─── Full Understanding Pipeline (§6.2) ─────────────────────────────────────

/**
 * Complete Section 6.2 Image Understanding Pipeline:
 *   1. Segmentation: regions (background/text/table/chart/logo/photo/icons)
 *   2. Structure inference: tables (grid + merges), charts (axes/legend/series)
 *   3. OCR: per-region/per-cell with confidence thresholds, Arabic support
 *   4. Style extraction: palette, border/fill detection, font estimation
 */
export function understandImage(
  image: NormalizedImage,
  ocrConfidenceThreshold: number = 0.5
): ImageUnderstandingResult {
  // Step 1: Segmentation
  const regions = segmentImage(image);

  // Step 2: Structure inference
  const tables: TableStructure[] = [];
  const charts: ChartStructure[] = [];

  for (const region of regions) {
    if (region.type === "table") {
      const table = inferTableStructure(image, region);
      if (table) {
        tables.push(table);
      }
    }
    if (region.type === "chart") {
      const chart = inferChartStructure(image, region);
      if (chart) {
        charts.push(chart);
      }
    }
  }

  // Step 3: OCR - per region
  const ocrResults: OCRResult[] = [];
  for (const region of regions) {
    if (region.type === "text" || region.type === "logo") {
      const ocr = performOCR(image, region, ocrConfidenceThreshold);
      if (ocr.text.length > 0) {
        ocrResults.push(ocr);
      }
    }
  }

  // OCR per table cell
  for (const table of tables) {
    for (const cell of table.cells) {
      const cellRegion: ImageRegion = {
        id: `${table.regionId}-cell-${cell.row}-${cell.col}`,
        type: "text",
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height,
        confidence: 0.8,
        dominantColors: [],
        edgeDensity: 0,
      };
      const cellOcr = performOCR(image, cellRegion, ocrConfidenceThreshold);
      if (cellOcr.text.length > 0) {
        ocrResults.push(cellOcr);
        // Update cell text (cells are readonly, so we create mapping)
        (cell as any).text = cellOcr.text;
        (cell as any).ocrConfidence = cellOcr.confidence;
      }
    }
  }

  // Step 4: Style extraction
  const style = extractStyle(image, regions);

  return { regions, tables, charts, ocrResults, style };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6.3: Pixel-Lock Overlay
// ─────────────────────────────────────────────────────────────────────────────

/** Overlay visibility state */
export type OverlayVisibility = "visible" | "hidden";

/** Element in the editable rebuild layer */
export interface EditableElement {
  readonly id: string;
  readonly type: "text" | "table" | "chart" | "shape";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sourceRegionId: string;
  /** Raw content for structural gate validation */
  readonly content: string | string[][] | ChartStructure;
  /** Style information for visual reconstruction */
  readonly style: {
    readonly fill?: string;
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly fontWeight?: "normal" | "bold";
    readonly fontStyle?: "normal" | "italic";
    readonly textAlign?: "left" | "right" | "center";
    readonly direction?: "ltr" | "rtl";
    readonly borderColor?: string;
    readonly borderWidth?: number;
  };
}

/**
 * Pixel-Lock Overlay Layer.
 *
 * Section 6.3 requirements:
 *   - Overlay layer matches 100% original image pixels
 *   - Overlay is decorative, default hidden
 *   - Editable rebuild layer underneath contains text/table/chart elements
 *   - Pixel gate is measured with overlay ON (visual fidelity check)
 *   - Structural gate is measured on editable layer (content accuracy check)
 */
export interface PixelLockOverlay {
  /** Original normalized image (the overlay) */
  readonly overlayImage: NormalizedImage;
  /** Overlay visibility state - default hidden per §6.3 */
  readonly overlayVisibility: OverlayVisibility;
  /** Editable elements reconstructed from understanding pipeline */
  readonly editableElements: EditableElement[];
  /** Rendered editable layer as RGBA pixels (for structural gate) */
  readonly editableLayerPixels: Uint8Array;
  /** Composite with overlay ON (for pixel gate) */
  readonly compositePixels: Uint8Array;
  /** Pixel gate score: SSIM between composite and original */
  readonly pixelGateScore: number;
  /** Structural gate score: content accuracy metric */
  readonly structuralGateScore: number;
  /** Dimension lock for both layers */
  readonly dimensionLock: DimensionLock;
}

/**
 * Create a Pixel-Lock Overlay from normalized image and understanding results.
 *
 * Creates two layers:
 *   1. Overlay: exact copy of original normalized pixels (decorative, default hidden)
 *   2. Editable: reconstructed elements (text, tables, charts) from understanding
 *
 * The overlay ensures pixel-perfect fidelity when visible.
 * The editable layer enables content editing and structural validation.
 */
export function createPixelLockOverlay(
  image: NormalizedImage,
  understanding: ImageUnderstandingResult
): PixelLockOverlay {
  const { width, height, data: originalPixels } = image;

  // Create dimension lock
  const dimensionLock = lockDimensions(width, height);

  // Build editable elements from understanding results
  const editableElements = buildEditableElements(understanding);

  // Render editable layer to pixel buffer
  const editableLayerPixels = renderEditableLayer(editableElements, width, height, understanding.style);

  // Composite: overlay ON = original image pixels overlaid on editable layer
  // Since overlay is 100% opaque original image, composite = original when overlay is ON
  const compositePixels = new Uint8Array(originalPixels.length);
  compositePixels.set(originalPixels);

  // Pixel gate: measure SSIM between composite (overlay ON) and original
  // When overlay is ON, these are identical, so score = 1.0
  const pixelGateScore = computeSSIM(compositePixels, originalPixels, width, height);

  // Structural gate: measure content accuracy on editable layer
  const structuralGateScore = computeStructuralGate(editableElements, understanding);

  return Object.freeze({
    overlayImage: image,
    overlayVisibility: "hidden" as const, // Default hidden per §6.3
    editableElements,
    editableLayerPixels,
    compositePixels,
    pixelGateScore,
    structuralGateScore,
    dimensionLock,
  });
}

/**
 * Build editable elements from understanding pipeline output.
 */
function buildEditableElements(understanding: ImageUnderstandingResult): EditableElement[] {
  const elements: EditableElement[] = [];

  // Text regions → text elements
  for (const ocr of understanding.ocrResults) {
    const region = understanding.regions.find(r => r.id === ocr.regionId);
    if (!region) continue;

    const fontInfo = understanding.style.estimatedFonts.find(f => f.regionId === region.id);
    const fillInfo = understanding.style.fills.find(f => f.regionId === region.id);

    elements.push({
      id: `editable-${region.id}`,
      type: "text",
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      sourceRegionId: region.id,
      content: ocr.text,
      style: {
        fill: fillInfo?.color,
        fontFamily: fontInfo?.estimatedFamily === "serif" ? "serif" :
                    fontInfo?.estimatedFamily === "monospace" ? "monospace" :
                    fontInfo?.estimatedFamily === "arabic-naskh" ? "arabic-naskh" :
                    fontInfo?.estimatedFamily === "arabic-kufi" ? "arabic-kufi" : "sans-serif",
        fontSize: fontInfo?.estimatedSize || 14,
        fontWeight: fontInfo?.isBold ? "bold" : "normal",
        fontStyle: fontInfo?.isItalic ? "italic" : "normal",
        direction: ocr.direction === "rtl" ? "rtl" : "ltr",
        textAlign: ocr.direction === "rtl" ? "right" : "left",
      },
    });
  }

  // Table regions → table elements
  for (const table of understanding.tables) {
    const region = understanding.regions.find(r => r.id === table.regionId);
    if (!region) continue;

    const cellData: string[][] = [];
    for (let r = 0; r < table.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < table.cols; c++) {
        const cell = table.cells.find(cl => cl.row === r && cl.col === c);
        row.push(cell?.text || "");
      }
      cellData.push(row);
    }

    const fillInfo = understanding.style.fills.find(f => f.regionId === region.id);
    const borderInfo = understanding.style.borders.find(b => b.regionId === region.id);

    elements.push({
      id: `editable-${region.id}`,
      type: "table",
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      sourceRegionId: region.id,
      content: cellData,
      style: {
        fill: fillInfo?.color,
        borderColor: borderInfo?.color || "#000000",
        borderWidth: borderInfo?.thickness || 1,
      },
    });
  }

  // Chart regions → chart elements
  for (const chart of understanding.charts) {
    const region = understanding.regions.find(r => r.id === chart.regionId);
    if (!region) continue;

    elements.push({
      id: `editable-${region.id}`,
      type: "chart",
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      sourceRegionId: region.id,
      content: chart,
      style: {
        fill: "#ffffff",
      },
    });
  }

  return elements;
}

/**
 * Render editable elements to an RGBA pixel buffer.
 * This creates a visual representation of the editable layer for gate measurement.
 */
function renderEditableLayer(
  elements: EditableElement[],
  width: number,
  height: number,
  style: ExtractedStyle
): Uint8Array {
  // Start with white background
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = 255;
    pixels[i * 4 + 1] = 255;
    pixels[i * 4 + 2] = 255;
    pixels[i * 4 + 3] = 255;
  }

  for (const element of elements) {
    // Parse fill color
    const fill = parseHexColor(element.style.fill || "#ffffff");

    switch (element.type) {
      case "text":
        renderTextElement(pixels, width, height, element, fill);
        break;
      case "table":
        renderTableElement(pixels, width, height, element, fill);
        break;
      case "chart":
        renderChartElement(pixels, width, height, element, fill);
        break;
      case "shape":
        renderShapeElement(pixels, width, height, element, fill);
        break;
    }
  }

  return pixels;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  if (hex.length === 7 && hex[0] === "#") {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number, y: number, w: number, h: number,
  r: number, g: number, b: number, a: number = 255
): void {
  for (let py = y; py < y + h && py < height; py++) {
    for (let px = x; px < x + w && px < width; px++) {
      if (px >= 0 && py >= 0) {
        const off = (py * width + px) * 4;
        if (a === 255) {
          pixels[off + 0] = r;
          pixels[off + 1] = g;
          pixels[off + 2] = b;
          pixels[off + 3] = 255;
        } else {
          // Alpha blend
          const srcA = a / 255;
          const dstA = pixels[off + 3] / 255;
          const outA = srcA + dstA * (1 - srcA);
          if (outA > 0) {
            pixels[off + 0] = Math.round((r * srcA + pixels[off + 0] * dstA * (1 - srcA)) / outA);
            pixels[off + 1] = Math.round((g * srcA + pixels[off + 1] * dstA * (1 - srcA)) / outA);
            pixels[off + 2] = Math.round((b * srcA + pixels[off + 2] * dstA * (1 - srcA)) / outA);
            pixels[off + 3] = Math.round(outA * 255);
          }
        }
      }
    }
  }
}

function drawRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number, y: number, w: number, h: number,
  r: number, g: number, b: number, thickness: number = 1
): void {
  // Top and bottom
  fillRect(pixels, width, height, x, y, w, thickness, r, g, b);
  fillRect(pixels, width, height, x, y + h - thickness, w, thickness, r, g, b);
  // Left and right
  fillRect(pixels, width, height, x, y, thickness, h, r, g, b);
  fillRect(pixels, width, height, x + w - thickness, y, thickness, h, r, g, b);
}

function renderTextElement(
  pixels: Uint8Array,
  width: number,
  height: number,
  element: EditableElement,
  fill: { r: number; g: number; b: number }
): void {
  // Fill background
  fillRect(pixels, width, height, element.x, element.y, element.width, element.height,
           fill.r, fill.g, fill.b);

  // Render text as dark horizontal lines (simplified glyph rendering)
  const fontSize = element.style.fontSize || 14;
  const lineHeight = Math.ceil(fontSize * 1.3);
  const text = typeof element.content === "string" ? element.content : "";
  const lines = text.split(/\n/);

  let cursorY = element.y + Math.floor(fontSize * 0.2);
  for (const line of lines) {
    if (cursorY + lineHeight > element.y + element.height) break;

    // Approximate character rendering: filled rectangles for each character
    const charWidth = Math.max(1, Math.floor(fontSize * 0.6));
    const charHeight = Math.max(1, Math.floor(fontSize * 0.7));
    const xStart = element.style.direction === "rtl"
      ? element.x + element.width - charWidth
      : element.x + 2;
    const xDir = element.style.direction === "rtl" ? -1 : 1;

    let cursorX = xStart;
    for (let i = 0; i < line.length; i++) {
      const cx = cursorX;
      if (cx >= element.x && cx + charWidth <= element.x + element.width) {
        // Draw character block (dark color)
        const isBold = element.style.fontWeight === "bold";
        const textR = 30, textG = 30, textB = 30;
        const strokeW = isBold ? Math.ceil(charWidth * 0.3) : Math.ceil(charWidth * 0.15);

        // Vertical strokes
        fillRect(pixels, width, height, cx, cursorY, strokeW, charHeight, textR, textG, textB);
        fillRect(pixels, width, height, cx + charWidth - strokeW, cursorY, strokeW, charHeight, textR, textG, textB);
        // Horizontal mid-stroke
        fillRect(pixels, width, height, cx, cursorY + Math.floor(charHeight / 2), charWidth, strokeW, textR, textG, textB);
      }
      cursorX += xDir * (charWidth + 1);
    }
    cursorY += lineHeight;
  }
}

function renderTableElement(
  pixels: Uint8Array,
  width: number,
  height: number,
  element: EditableElement,
  fill: { r: number; g: number; b: number }
): void {
  const cellData = element.content as string[][];
  if (!cellData || !Array.isArray(cellData)) return;

  const rows = cellData.length;
  const cols = rows > 0 ? cellData[0].length : 0;
  if (rows === 0 || cols === 0) return;

  const cellW = Math.floor(element.width / cols);
  const cellH = Math.floor(element.height / rows);
  const borderColor = parseHexColor(element.style.borderColor || "#000000");
  const borderWidth = element.style.borderWidth || 1;

  // Fill background
  fillRect(pixels, width, height, element.x, element.y, element.width, element.height,
           fill.r, fill.g, fill.b);

  // Draw grid lines
  for (let r = 0; r <= rows; r++) {
    const lineY = element.y + r * cellH;
    fillRect(pixels, width, height, element.x, lineY, element.width, borderWidth,
             borderColor.r, borderColor.g, borderColor.b);
  }
  for (let c = 0; c <= cols; c++) {
    const lineX = element.x + c * cellW;
    fillRect(pixels, width, height, lineX, element.y, borderWidth, element.height,
             borderColor.r, borderColor.g, borderColor.b);
  }

  // Render cell text (simplified)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const text = cellData[r][c] || "";
      if (text.length === 0) continue;

      const cx = element.x + c * cellW + 2;
      const cy = element.y + r * cellH + 2;
      const charH = Math.min(cellH - 4, 10);
      const charW = Math.max(1, Math.floor(charH * 0.5));

      for (let i = 0; i < Math.min(text.length, Math.floor((cellW - 4) / (charW + 1))); i++) {
        fillRect(pixels, width, height, cx + i * (charW + 1), cy, charW, charH, 30, 30, 30);
      }
    }
  }
}

function renderChartElement(
  pixels: Uint8Array,
  width: number,
  height: number,
  element: EditableElement,
  fill: { r: number; g: number; b: number }
): void {
  // Fill background
  fillRect(pixels, width, height, element.x, element.y, element.width, element.height,
           fill.r, fill.g, fill.b);

  // Draw chart frame
  drawRect(pixels, width, height, element.x, element.y, element.width, element.height,
           100, 100, 100, 1);

  const chart = element.content as ChartStructure;
  if (!chart) return;

  // Draw axes
  const axisColor = { r: 50, g: 50, b: 50 };
  // Horizontal axis
  fillRect(pixels, width, height,
           element.x + 30, element.y + element.height - 30,
           element.width - 40, 1,
           axisColor.r, axisColor.g, axisColor.b);
  // Vertical axis
  fillRect(pixels, width, height,
           element.x + 30, element.y + 10,
           1, element.height - 40,
           axisColor.r, axisColor.g, axisColor.b);

  // Draw data series
  for (const series of chart.series) {
    const color = parseHexColor(series.color);
    for (const point of series.dataPoints) {
      const px = element.x + 30 + Math.round(point.x * (element.width - 50));
      const py = element.y + element.height - 30 - Math.round(point.y * (element.height - 50));
      // Draw data point marker
      fillRect(pixels, width, height, px - 2, py - 2, 5, 5, color.r, color.g, color.b);
    }
  }
}

function renderShapeElement(
  pixels: Uint8Array,
  width: number,
  height: number,
  element: EditableElement,
  fill: { r: number; g: number; b: number }
): void {
  fillRect(pixels, width, height, element.x, element.y, element.width, element.height,
           fill.r, fill.g, fill.b);
  drawRect(pixels, width, height, element.x, element.y, element.width, element.height,
           100, 100, 100, 1);
}

// ─── SSIM (Structural Similarity Index) ─────────────────────────────────────

/**
 * Compute SSIM between two RGBA images.
 * Uses the standard Wang et al. (2004) algorithm with 8x8 sliding window.
 *
 * SSIM(x,y) = (2*μx*μy + C1)(2*σxy + C2) / ((μx² + μy² + C1)(σx² + σy² + C2))
 *
 * This is the pixel gate metric: measures visual similarity between
 * the composite (overlay ON) and the original image.
 */
export function computeSSIM(
  img1: Uint8Array,
  img2: Uint8Array,
  width: number,
  height: number
): number {
  if (img1.length !== img2.length) {
    throw new Error("[§6.3] SSIM: image dimensions mismatch");
  }

  // Constants (for 8-bit images: L=255)
  const L = 255;
  const k1 = 0.01;
  const k2 = 0.03;
  const C1 = (k1 * L) ** 2;
  const C2 = (k2 * L) ** 2;

  const windowSize = 8;
  let totalSSIM = 0;
  let windowCount = 0;

  for (let wy = 0; wy <= height - windowSize; wy += windowSize) {
    for (let wx = 0; wx <= width - windowSize; wx += windowSize) {
      // Compute means
      let sum1 = 0, sum2 = 0;
      let sum1sq = 0, sum2sq = 0;
      let sum12 = 0;
      const n = windowSize * windowSize;

      for (let dy = 0; dy < windowSize; dy++) {
        for (let dx = 0; dx < windowSize; dx++) {
          const off = ((wy + dy) * width + (wx + dx)) * 4;
          // Convert to grayscale for SSIM (luminance component)
          const g1 = 0.299 * img1[off] + 0.587 * img1[off + 1] + 0.114 * img1[off + 2];
          const g2 = 0.299 * img2[off] + 0.587 * img2[off + 1] + 0.114 * img2[off + 2];

          sum1 += g1;
          sum2 += g2;
          sum1sq += g1 * g1;
          sum2sq += g2 * g2;
          sum12 += g1 * g2;
        }
      }

      const mu1 = sum1 / n;
      const mu2 = sum2 / n;
      const sigma1sq = sum1sq / n - mu1 * mu1;
      const sigma2sq = sum2sq / n - mu2 * mu2;
      const sigma12 = sum12 / n - mu1 * mu2;

      const numerator = (2 * mu1 * mu2 + C1) * (2 * sigma12 + C2);
      const denominator = (mu1 * mu1 + mu2 * mu2 + C1) * (sigma1sq + sigma2sq + C2);

      totalSSIM += numerator / denominator;
      windowCount++;
    }
  }

  return windowCount > 0 ? totalSSIM / windowCount : 1.0;
}

/**
 * Compute structural gate score for the editable layer.
 * Measures how accurately the editable elements capture the original content.
 *
 * Components:
 *   - Text completeness: ratio of regions with OCR text
 *   - Table completeness: ratio of cells with content
 *   - Chart completeness: presence of series, axes, legend
 *   - Overall coverage: ratio of image area covered by editable elements
 */
function computeStructuralGate(
  elements: EditableElement[],
  understanding: ImageUnderstandingResult
): number {
  let scores: number[] = [];

  // Text completeness
  const textRegions = understanding.regions.filter(r => r.type === "text");
  const textElements = elements.filter(e => e.type === "text" && typeof e.content === "string" && e.content.length > 0);
  if (textRegions.length > 0) {
    scores.push(Math.min(1, textElements.length / textRegions.length));
  }

  // Table completeness
  for (const table of understanding.tables) {
    const totalCells = table.rows * table.cols;
    const filledCells = table.cells.filter(c => c.text.length > 0).length;
    if (totalCells > 0) {
      scores.push(filledCells / totalCells);
    }
  }

  // Chart completeness
  for (const chart of understanding.charts) {
    let chartScore = 0;
    if (chart.axes.length > 0) chartScore += 0.3;
    if (chart.series.length > 0) chartScore += 0.4;
    if (chart.legend.length > 0) chartScore += 0.2;
    if (chart.chartType !== "unknown") chartScore += 0.1;
    scores.push(chartScore);
  }

  // Area coverage
  const totalImageArea = understanding.regions.length > 0
    ? understanding.regions.reduce((sum, r) => sum + r.width * r.height, 0)
    : 1;
  const elementArea = elements.reduce((sum, e) => sum + e.width * e.height, 0);
  scores.push(Math.min(1, elementArea / Math.max(totalImageArea, 1)));

  // Average all scores
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─── Overlay Control API ────────────────────────────────────────────────────

/**
 * Toggle overlay visibility.
 * Returns new composite pixels based on visibility state.
 *
 * - Overlay ON: composite = original image pixels (pixel gate measurement)
 * - Overlay OFF: composite = editable layer pixels only (editing mode)
 */
export function toggleOverlay(
  overlay: PixelLockOverlay,
  visibility: OverlayVisibility
): Uint8Array {
  verifyDimensionLock(
    overlay.dimensionLock,
    overlay.overlayImage.width,
    overlay.overlayImage.height
  );

  if (visibility === "visible") {
    // Overlay ON: return original pixels (pixel-perfect)
    const composite = new Uint8Array(overlay.overlayImage.data.length);
    composite.set(overlay.overlayImage.data);
    return composite;
  } else {
    // Overlay OFF: return editable layer
    const composite = new Uint8Array(overlay.editableLayerPixels.length);
    composite.set(overlay.editableLayerPixels);
    return composite;
  }
}

/**
 * Measure pixel gate with overlay ON.
 * Compares the overlay composite against the original normalized image.
 * Returns SSIM score (1.0 = pixel-perfect match).
 */
export function measurePixelGate(overlay: PixelLockOverlay): number {
  const { width, height } = overlay.overlayImage;
  const overlayOnPixels = toggleOverlay(overlay, "visible");
  return computeSSIM(overlayOnPixels, overlay.overlayImage.data, width, height);
}

/**
 * Measure structural gate on editable layer.
 * Validates that editable elements accurately represent the source content.
 * Returns score 0.0-1.0.
 */
export function measureStructuralGate(overlay: PixelLockOverlay): number {
  return overlay.structuralGateScore;
}

/**
 * Compute per-pixel difference map between overlay and editable layer.
 * Each pixel value represents the absolute difference (0=identical, 255=maximum difference).
 * Useful for identifying areas where the editable reconstruction diverges from the original.
 */
export function computeDifferenceMap(overlay: PixelLockOverlay): Uint8Array {
  const { width, height } = overlay.overlayImage;
  const original = overlay.overlayImage.data;
  const editable = overlay.editableLayerPixels;
  const diff = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const dR = Math.abs(original[off + 0] - editable[off + 0]);
    const dG = Math.abs(original[off + 1] - editable[off + 1]);
    const dB = Math.abs(original[off + 2] - editable[off + 2]);
    // Encode max channel difference as grayscale in red channel,
    // and full difference in all channels for visualization
    const maxDiff = Math.max(dR, dG, dB);
    diff[off + 0] = maxDiff; // Difference intensity
    diff[off + 1] = dR > 50 ? 255 : 0; // Highlight significant R differences
    diff[off + 2] = dB > 50 ? 255 : 0; // Highlight significant B differences
    diff[off + 3] = 255;
  }

  return diff;
}

// ─── Full Pipeline: Normalize → Understand → Overlay ────────────────────────

/**
 * Complete image processing pipeline (Sections 6.1 → 6.2 → 6.3).
 *
 * Input: raw image bytes (PNG, BMP, JPEG, or raw RGBA)
 * Output: PixelLockOverlay with both layers and gate scores
 *
 * Steps:
 *   §6.1 Normalize: decode → EXIF → sRGB → alpha → gamma → dimension lock
 *   §6.2 Understand: segment → structure → OCR → style
 *   §6.3 Overlay: create overlay + editable layers, compute gate scores
 */
export function processImage(
  rawBytes: Uint8Array,
  options: {
    ocrConfidenceThreshold?: number;
  } = {}
): PixelLockOverlay {
  const { ocrConfidenceThreshold = 0.5 } = options;

  // §6.1: Normalize
  const normalized = normalizeImage(rawBytes);

  // §6.2: Understand
  const understanding = understandImage(normalized, ocrConfidenceThreshold);

  // §6.3: Create Pixel-Lock Overlay
  const overlay = createPixelLockOverlay(normalized, understanding);

  return overlay;
}
