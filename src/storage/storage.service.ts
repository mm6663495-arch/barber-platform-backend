import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service, UploadResult } from './s3.service';
import { LocalStorageService } from './local-storage.service';
import { ImageService } from './image.service';
import * as path from 'path';

export interface UploadFileOptions {
  folder?: string;
  optimize?: boolean;
  createThumbnails?: boolean;
  thumbnailSizes?: Array<{ name: string; width: number; height?: number }>;
  maxSize?: number; // بالبايت
  allowedMimeTypes?: string[];
}

export interface UploadResponse {
  original: UploadResult;
  thumbnails?: Record<string, UploadResult>;
  optimized?: UploadResult;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly useS3: boolean;
  private readonly defaultThumbnailSizes = [
    { name: 'small', width: 150, height: 150 },
    { name: 'medium', width: 300, height: 300 },
    { name: 'large', width: 600, height: 600 },
  ];

  constructor(
    private readonly s3Service: S3Service,
    private readonly localStorageService: LocalStorageService,
    private readonly imageService: ImageService,
    private readonly configService: ConfigService,
  ) {
    // الافتراضي: استخدام التخزين المحلي (ما لم يكن STORAGE_TYPE=s3 صراحة)
    const storageType = this.configService.get<string>('STORAGE_TYPE');
    this.useS3 = storageType === 's3' || storageType === 'S3';
    this.logger.log(`Storage service initialized (S3: ${this.useS3}, Local: ${!this.useS3})`);
    
    if (!this.useS3) {
      this.logger.warn('✅ Using LOCAL storage (uploads/ directory).');
      this.logger.warn('   To use AWS S3, set STORAGE_TYPE=s3 in your .env file.');
    } else {
      this.logger.warn('⚠️  Using AWS S3. Make sure AWS credentials are configured.');
    }
  }

  /**
   * رفع ملف باستخدام S3 أو التخزين المحلي
   */
  private async uploadFileToStorage(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    folder?: string,
  ): Promise<UploadResult> {
    // إذا كان useS3 = true، جرب S3 أولاً، وإذا فشل انتقل للتخزين المحلي
    if (this.useS3) {
      try {
        return await this.s3Service.uploadFile(buffer, fileName, contentType, folder);
      } catch (error) {
        // إذا فشل S3، انتقل تلقائياً للتخزين المحلي
        this.logger.warn(`S3 upload failed, falling back to local storage: ${error.message}`);
        this.logger.warn('Consider setting STORAGE_TYPE=local or configure AWS S3 properly.');
      }
    }
    
    // استخدام التخزين المحلي (الافتراضي أو fallback)
    const result = await this.localStorageService.uploadFile(
      buffer,
      fileName,
      contentType,
      folder,
    );
    
    // ⚠️ Logging للتحقق من البيانات المرسلة
    this.logger.log(`📤 [STORAGE] File uploaded:`);
    this.logger.log(`  - URL: ${result.url}`);
    this.logger.log(`  - Key: ${result.key}`);
    this.logger.log(`  - Folder: ${folder || 'root'}`);
    this.logger.log(`  - Size: ${result.size} bytes`);
    
    // تحويل LocalUploadResult إلى UploadResult
    return {
      url: result.url,
      key: result.key,
      bucket: result.bucket,
      cdnUrl: result.cdnUrl,
      size: result.size,
      contentType: result.contentType,
    };
  }

  /**
   * رفع ملف واحد
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadFileOptions = {},
  ): Promise<UploadResponse> {
    try {
      // التحقق من نوع الملف
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `File type not allowed. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
        );
      }

      // التحقق من الحجم
      if (options.maxSize && file.size > options.maxSize) {
        throw new BadRequestException(
          `File size exceeds maximum allowed size: ${options.maxSize} bytes`,
        );
      }

      const isImage = file.mimetype.startsWith('image/');
      let buffer = file.buffer;

      // متغير مؤقت لحفظ النتيجة
      let uploadResult: UploadResult;
      const response: Partial<UploadResponse> = {};

      // معالجة الصور
      if (isImage) {
        // التحقق من صحة الصورة
        const isValid = await this.imageService.validateImage(buffer);
        if (!isValid) {
          throw new BadRequestException('Invalid image file');
        }

        // تحسين الصورة
        if (options.optimize) {
          this.logger.log('Optimizing image...');
          const optimizedBuffer = await this.imageService.optimizeForWeb(buffer);
          
          response.optimized = await this.uploadFileToStorage(
            optimizedBuffer,
            `optimized-${file.originalname}`,
            file.mimetype,
            options.folder,
          );
          
          buffer = optimizedBuffer;
        }

        // إنشاء thumbnails
        if (options.createThumbnails) {
          this.logger.log('Creating thumbnails...');
          const sizes = options.thumbnailSizes || this.defaultThumbnailSizes;
          const thumbnails = await this.imageService.createThumbnails(buffer, sizes);

          response.thumbnails = {};
          
          for (const thumbnail of thumbnails) {
            const result = await this.uploadFileToStorage(
              thumbnail.buffer,
              `${thumbnail.name}-${file.originalname}`,
              file.mimetype,
              options.folder,
            );
            response.thumbnails[thumbnail.name] = result;
          }
        }
      }

      // رفع الملف الأصلي
      uploadResult = await this.uploadFileToStorage(
        buffer,
        file.originalname,
        file.mimetype,
        options.folder,
      );

      response.original = uploadResult;

      this.logger.log(`File uploaded successfully: ${uploadResult.key}`);

      return response as UploadResponse;
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * رفع عدة ملفات
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: UploadFileOptions = {},
  ): Promise<UploadResponse[]> {
    try {
      const results = await Promise.all(
        files.map((file) => this.uploadFile(file, options)),
      );

      this.logger.log(`${files.length} files uploaded successfully`);
      return results;
    } catch (error) {
      this.logger.error(`Multiple upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * حذف ملف
   */
  async deleteFile(url: string): Promise<void> {
    try {
      if (this.useS3) {
        const key = this.s3Service.extractKeyFromUrl(url);
        if (!key) {
          throw new BadRequestException('Invalid file URL');
        }
        await this.s3Service.deleteFile(key);
      } else {
        const key = this.localStorageService.extractKeyFromUrl(url);
        if (!key) {
          throw new BadRequestException('Invalid file URL');
        }
        await this.localStorageService.deleteFile(key);
      }
      this.logger.log(`File deleted: ${url}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * حذف عدة ملفات
   */
  async deleteFiles(urls: string[]): Promise<void> {
    try {
      if (this.useS3) {
        const keys = urls
          .map((url) => this.s3Service.extractKeyFromUrl(url))
          .filter((key) => key !== null);
        await this.s3Service.deleteFiles(keys);
      } else {
        const keys = urls
          .map((url) => this.localStorageService.extractKeyFromUrl(url))
          .filter((key) => key !== null);
        await this.localStorageService.deleteFiles(keys);
      }
      this.logger.log(`${urls.length} files deleted`);
    } catch (error) {
      this.logger.error(`Multiple delete failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * حذف Upload Response
   */
  async deleteUploadResponse(uploadResponse: UploadResponse): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      if (uploadResponse.original) {
        keysToDelete.push(uploadResponse.original.key);
      }

      if (uploadResponse.optimized) {
        keysToDelete.push(uploadResponse.optimized.key);
      }

      if (uploadResponse.thumbnails) {
        Object.values(uploadResponse.thumbnails).forEach((thumbnail) => {
          keysToDelete.push(thumbnail.key);
        });
      }

      if (this.useS3) {
        await this.s3Service.deleteFiles(keysToDelete);
      } else {
        await this.localStorageService.deleteFiles(keysToDelete);
      }
      this.logger.log(`Upload response deleted (${keysToDelete.length} files)`);
    } catch (error) {
      this.logger.error(`Failed to delete upload response: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * الحصول على CDN URL
   */
  getCdnUrl(key: string): string {
    if (this.useS3) {
      return this.s3Service.getCdnUrl(key);
    }
    // للتخزين المحلي، نعيد URL مباشرة
    return `${this.configService.get<string>('HOST') || 'localhost'}:${this.configService.get<number>('PORT') || 3000}/uploads${key}`;
  }

  /**
   * الحصول على signed URL
   */
  async getSignedUrl(url: string, expiresIn: number = 3600): Promise<string> {
    try {
      if (this.useS3) {
        const key = this.s3Service.extractKeyFromUrl(url);
        if (!key) {
          throw new BadRequestException('Invalid file URL');
        }
        return await this.s3Service.getSignedUrl(key, expiresIn);
      } else {
        // للتخزين المحلي، نعيد URL مباشرة (لا حاجة لـ signed URL)
        return url;
      }
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * التحقق من وجود الملف
   */
  async fileExists(url: string): Promise<boolean> {
    try {
      if (this.useS3) {
        const key = this.s3Service.extractKeyFromUrl(url);
        if (!key) {
          return false;
        }
        return await this.s3Service.fileExists(key);
      } else {
        const key = this.localStorageService.extractKeyFromUrl(url);
        if (!key) {
          return false;
        }
        return await this.localStorageService.fileExists(key);
      }
    } catch (error) {
      this.logger.error(`Failed to check file existence: ${error.message}`, error.stack);
      return false;
    }
  }
}

