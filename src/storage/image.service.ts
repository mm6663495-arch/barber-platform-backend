import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  blur?: number;
  grayscale?: boolean;
  rotate?: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * معالجة الصورة بخيارات متعددة
   */
  async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions = {},
  ): Promise<Buffer> {
    try {
      let image = sharp(buffer);

      // Resize
      if (options.width || options.height) {
        image = image.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          withoutEnlargement: true,
        });
      }

      // Rotate
      if (options.rotate) {
        image = image.rotate(options.rotate);
      }

      // Blur
      if (options.blur) {
        image = image.blur(options.blur);
      }

      // Grayscale
      if (options.grayscale) {
        image = image.grayscale();
      }

      // Format & Quality
      const format = options.format || 'jpeg';
      const quality = options.quality || 80;

      switch (format) {
        case 'jpeg':
          image = image.jpeg({ quality, mozjpeg: true });
          break;
        case 'png':
          image = image.png({ quality, compressionLevel: 9 });
          break;
        case 'webp':
          image = image.webp({ quality });
          break;
      }

      const processedBuffer = await image.toBuffer();
      
      this.logger.log(
        `Image processed: ${buffer.length} → ${processedBuffer.length} bytes`,
      );

      return processedBuffer;
    } catch (error) {
      this.logger.error(`Image processing failed: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to process image');
    }
  }

  /**
   * إنشاء thumbnails بأحجام مختلفة
   */
  async createThumbnails(
    buffer: Buffer,
    sizes: Array<{ name: string; width: number; height?: number }>,
  ): Promise<Array<{ name: string; buffer: Buffer }>> {
    try {
      const thumbnails = await Promise.all(
        sizes.map(async (size) => {
          const thumbnail = await this.processImage(buffer, {
            width: size.width,
            height: size.height,
            quality: 80,
            format: 'jpeg',
          });

          return {
            name: size.name,
            buffer: thumbnail,
          };
        }),
      );

      this.logger.log(`Created ${thumbnails.length} thumbnails`);
      return thumbnails;
    } catch (error) {
      this.logger.error(`Thumbnail creation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * الحصول على معلومات الصورة
   */
  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha || false,
      };
    } catch (error) {
      this.logger.error(`Failed to get image metadata: ${error.message}`, error.stack);
      throw new BadRequestException('Invalid image file');
    }
  }

  /**
   * تحسين الصورة للويب
   */
  async optimizeForWeb(buffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await this.getMetadata(buffer);

      // تحديد الأبعاد القصوى
      const maxWidth = 2048;
      const maxHeight = 2048;

      let width = metadata.width;
      let height = metadata.height;

      // Resize إذا كانت أكبر من الحد الأقصى
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      return this.processImage(buffer, {
        width,
        height,
        quality: 85,
        format: 'jpeg',
      });
    } catch (error) {
      this.logger.error(`Web optimization failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * التحقق من أن الملف صورة
   */
  async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      await sharp(buffer).metadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * تحويل الصورة إلى WebP
   */
  async convertToWebP(buffer: Buffer, quality: number = 80): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      this.logger.error(`WebP conversion failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * إضافة watermark
   */
  async addWatermark(
    imageBuffer: Buffer,
    watermarkBuffer: Buffer,
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
  ): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      const watermark = await sharp(watermarkBuffer)
        .resize(Math.round(metadata.width * 0.2)) // 20% من عرض الصورة
        .toBuffer();

      const watermarkMetadata = await sharp(watermark).metadata();

      let gravity: string;
      switch (position) {
        case 'center':
          gravity = 'center';
          break;
        case 'top-left':
          gravity = 'northwest';
          break;
        case 'top-right':
          gravity = 'northeast';
          break;
        case 'bottom-left':
          gravity = 'southwest';
          break;
        case 'bottom-right':
        default:
          gravity = 'southeast';
          break;
      }

      return await image
        .composite([
          {
            input: watermark,
            gravity: gravity as any,
          },
        ])
        .toBuffer();
    } catch (error) {
      this.logger.error(`Failed to add watermark: ${error.message}`, error.stack);
      throw error;
    }
  }
}

