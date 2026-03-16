/**
 * خدمة معالجة الصور الكبيرة
 * تقسيم الصور الكبيرة إلى أجزاء قابلة للمعالجة
 * ثم إعادة تجميعها بعد المعالجة
 */

interface ImageDimensions {
  width: number;
  height: number;
}

interface ImageChunk {
  buffer: Buffer;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

interface ProcessingResult {
  success: boolean;
  chunks: ImageChunk[];
  totalChunks: number;
  originalDimensions: ImageDimensions;
}

export class LargeImageProcessor {
  private readonly MAX_DIMENSION = 4096;
  private readonly MAX_PIXELS = 16777216; // 4096 * 4096
  private readonly CHUNK_SIZE = 2048;
  private readonly OVERLAP = 64; // تداخل بين الأجزاء لتجنب الحواف

  /**
   * فحص ما إذا كانت الصورة كبيرة وتحتاج تقسيم
   */
  async isLargeImage(buffer: Buffer): Promise<boolean> {
    try {
      const dimensions = await this.getImageDimensions(buffer);
      return (
        dimensions.width > this.MAX_DIMENSION ||
        dimensions.height > this.MAX_DIMENSION ||
        dimensions.width * dimensions.height > this.MAX_PIXELS
      );
    } catch {
      return false;
    }
  }

  /**
   * استخراج أبعاد الصورة من Buffer
   */
  async getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
    try {
      // محاولة استخدام sharp إذا كان متاحًا
      const sharp = await import('sharp').catch(() => null);
      if (sharp) {
        const metadata = await sharp.default(buffer).metadata();
        return {
          width: metadata.width || 0,
          height: metadata.height || 0,
        };
      }

      // بديل: قراءة أبعاد PNG من الهيدر
      if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        // PNG
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }

      // بديل: قراءة أبعاد JPEG
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        return this.getJpegDimensions(buffer);
      }

      return { width: 0, height: 0 };
    } catch {
      return { width: 0, height: 0 };
    }
  }

  /**
   * استخراج أبعاد JPEG
   */
  private getJpegDimensions(buffer: Buffer): ImageDimensions {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += segmentLength + 2;
    }
    return { width: 0, height: 0 };
  }

  /**
   * تقسيم صورة كبيرة إلى أجزاء
   */
  async splitImage(buffer: Buffer): Promise<ProcessingResult> {
    const dimensions = await this.getImageDimensions(buffer);

    if (!await this.isLargeImage(buffer)) {
      return {
        success: true,
        chunks: [{
          buffer,
          x: 0,
          y: 0,
          width: dimensions.width,
          height: dimensions.height,
          index: 0,
        }],
        totalChunks: 1,
        originalDimensions: dimensions,
      };
    }

    try {
      const sharp = await import('sharp').catch(() => null);
      if (!sharp) {
        // بدون sharp، نعيد الصورة كاملة
        return {
          success: true,
          chunks: [{
            buffer,
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
            index: 0,
          }],
          totalChunks: 1,
          originalDimensions: dimensions,
        };
      }

      const chunks: ImageChunk[] = [];
      let index = 0;

      for (let y = 0; y < dimensions.height; y += this.CHUNK_SIZE - this.OVERLAP) {
        for (let x = 0; x < dimensions.width; x += this.CHUNK_SIZE - this.OVERLAP) {
          const chunkWidth = Math.min(this.CHUNK_SIZE, dimensions.width - x);
          const chunkHeight = Math.min(this.CHUNK_SIZE, dimensions.height - y);

          const chunkBuffer = await sharp.default(buffer)
            .extract({
              left: x,
              top: y,
              width: chunkWidth,
              height: chunkHeight,
            })
            .png()
            .toBuffer();

          chunks.push({
            buffer: chunkBuffer,
            x,
            y,
            width: chunkWidth,
            height: chunkHeight,
            index: index++,
          });
        }
      }

      return {
        success: true,
        chunks,
        totalChunks: chunks.length,
        originalDimensions: dimensions,
      };
    } catch (error) {
      return {
        success: false,
        chunks: [],
        totalChunks: 0,
        originalDimensions: dimensions,
      };
    }
  }

  /**
   * إعادة تجميع الأجزاء المعالجة إلى صورة واحدة
   */
  async reassembleChunks(
    chunks: ImageChunk[],
    originalDimensions: ImageDimensions
  ): Promise<Buffer> {
    try {
      const sharp = await import('sharp').catch(() => null);
      if (!sharp || chunks.length === 1) {
        return chunks[0]?.buffer || Buffer.alloc(0);
      }

      // إنشاء صورة فارغة بالأبعاد الأصلية
      const composites = chunks.map(chunk => ({
        input: chunk.buffer,
        left: chunk.x,
        top: chunk.y,
      }));

      return await sharp.default({
        create: {
          width: originalDimensions.width,
          height: originalDimensions.height,
          channels: 4 as const,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite(composites)
        .png()
        .toBuffer();
    } catch {
      return chunks[0]?.buffer || Buffer.alloc(0);
    }
  }

  /**
   * تصغير صورة كبيرة مع الحفاظ على النسبة
   */
  async resizeIfNeeded(
    buffer: Buffer,
    maxWidth: number = this.MAX_DIMENSION,
    maxHeight: number = this.MAX_DIMENSION
  ): Promise<Buffer> {
    const dimensions = await this.getImageDimensions(buffer);

    if (dimensions.width <= maxWidth && dimensions.height <= maxHeight) {
      return buffer;
    }

    try {
      const sharp = await import('sharp').catch(() => null);
      if (!sharp) return buffer;

      const scale = Math.min(
        maxWidth / dimensions.width,
        maxHeight / dimensions.height
      );

      return await sharp.default(buffer)
        .resize(
          Math.round(dimensions.width * scale),
          Math.round(dimensions.height * scale),
          { fit: 'inside' }
        )
        .png()
        .toBuffer();
    } catch {
      return buffer;
    }
  }
}

export default LargeImageProcessor;
