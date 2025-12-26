import { Injectable, BadRequestException } from '@nestjs/common';
import { existsSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import type { Express } from 'express';

/**
 * Upload Service - معالجة وإدارة الملفات المرفوعة
 */
@Injectable()
export class UploadService {
  /**
   * معالجة الصورة (تصغير، ضغط، تحسين)
   */
  async processImage(
    filePath: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
    },
  ): Promise<string> {
    try {
      const { width = 800, height = 600, quality = 80 } = options || {};

      const processedFilePath = filePath.replace(
        /(\.[^.]+)$/,
        '-processed$1',
      );

      await sharp(filePath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality, progressive: true })
        .png({ quality, compressionLevel: 9 })
        .toFile(processedFilePath);

      // حذف الملف الأصلي
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      return processedFilePath;
    } catch (error) {
      throw new BadRequestException('فشل في معالجة الصورة: ' + error.message);
    }
  }

  /**
   * إنشاء thumbnail للصورة
   */
  async createThumbnail(
    filePath: string,
    size: number = 150,
  ): Promise<string> {
    try {
      const thumbnailPath = filePath.replace(/(\.[^.]+)$/, '-thumb$1');

      await sharp(filePath)
        .resize(size, size, {
          fit: 'cover',
        })
        .jpeg({ quality: 70 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      throw new BadRequestException('فشل في إنشاء thumbnail: ' + error.message);
    }
  }

  /**
   * حذف ملف
   */
  deleteFile(filePath: string): boolean {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * التحقق من وجود ملف
   */
  fileExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  /**
   * الحصول على معلومات الملف
   */
  getFileInfo(filePath: string) {
    try {
      if (!existsSync(filePath)) {
        throw new BadRequestException('الملف غير موجود');
      }

      const stats = statSync(filePath);

      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      throw new BadRequestException(
        'فشل في الحصول على معلومات الملف: ' + error.message,
      );
    }
  }

  /**
   * التحقق من حجم الملف
   */
  validateFileSize(file: Express.Multer.File, maxSizeMB: number = 5): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `حجم الملف كبير جداً! الحد الأقصى ${maxSizeMB}MB`,
      );
    }
    return true;
  }

  /**
   * التحقق من نوع الصورة
   */
  validateImageType(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'نوع الملف غير مدعوم! فقط الصور مسموح بها',
      );
    }
    return true;
  }

  /**
   * إنشاء مسار URL للملف
   */
  getFileUrl(filename: string, category: string = 'general'): string {
    return `/uploads/${category}/${filename}`;
  }

  /**
   * استخراج اسم الملف من المسار
   */
  extractFilename(url: string): string {
    return url.split('/').pop() || '';
  }

  /**
   * تنظيف المسار (إزالة ../ و ./)
   */
  sanitizePath(path: string): string {
    return path.replace(/\.\./g, '').replace(/\\/g, '/');
  }
}

