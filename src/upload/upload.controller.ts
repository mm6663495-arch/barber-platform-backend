import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Body,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

/**
 * Upload Controller - إدارة رفع وحذف الملفات
 */
@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * رفع صورة صالون
   */
  @Post('salon-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'رفع صورة صالون' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        salonImage: {
          type: 'string',
          format: 'binary',
          description: 'صورة الصالون (JPG, PNG, GIF, WEBP - حد أقصى 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'تم رفع الصورة بنجاح',
    schema: {
      example: {
        url: '/uploads/salons/salonImage-1234567890-123456789.jpg',
        filename: 'salonImage-1234567890-123456789.jpg',
        size: 245678,
        mimetype: 'image/jpeg',
        path: 'uploads/salons',
      },
    },
  })
  async uploadSalonImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('يجب تحديد ملف صورة');
    }

    this.uploadService.validateFileSize(file, 5);
    this.uploadService.validateImageType(file);

    // معالجة الصورة وتصغيرها
    const processedPath = await this.uploadService.processImage(file.path, {
      width: 1200,
      height: 800,
      quality: 85,
    });

    // إنشاء thumbnail
    const thumbnailPath = await this.uploadService.createThumbnail(
      processedPath,
      300,
    );

    return {
      success: true,
      message: 'تم رفع صورة الصالون بنجاح',
      data: {
        url: this.uploadService.getFileUrl(
          processedPath.split('/').pop() || file.filename,
          'salons',
        ),
        thumbnail: this.uploadService.getFileUrl(
          thumbnailPath.split('/').pop() || file.filename,
          'salons',
        ),
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
    };
  }

  /**
   * رفع صورة بروفايل
   */
  @Post('profile-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'رفع صورة بروفايل' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'صورة البروفايل (JPG, PNG, GIF - حد أقصى 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'تم رفع الصورة بنجاح',
  })
  async uploadProfileImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('يجب تحديد ملف صورة');
    }

    this.uploadService.validateFileSize(file, 5);
    this.uploadService.validateImageType(file);

    // معالجة الصورة (مربعة للبروفايل)
    const processedPath = await this.uploadService.processImage(file.path, {
      width: 500,
      height: 500,
      quality: 85,
    });

    // إنشاء thumbnail
    const thumbnailPath = await this.uploadService.createThumbnail(
      processedPath,
      150,
    );

    return {
      success: true,
      message: 'تم رفع صورة البروفايل بنجاح',
      data: {
        url: this.uploadService.getFileUrl(
          processedPath.split('/').pop() || file.filename,
          'profiles',
        ),
        thumbnail: this.uploadService.getFileUrl(
          thumbnailPath.split('/').pop() || file.filename,
          'profiles',
        ),
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
    };
  }

  /**
   * رفع صورة عامة
   */
  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'رفع صورة عامة' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'صورة عامة (JPG, PNG, GIF, WEBP - حد أقصى 5MB)',
        },
      },
    },
  })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('يجب تحديد ملف صورة');
    }

    this.uploadService.validateFileSize(file, 5);
    this.uploadService.validateImageType(file);

    return {
      success: true,
      message: 'تم رفع الصورة بنجاح',
      data: {
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
      },
    };
  }

  /**
   * رفع عدة صور
   */
  @Post('multiple-images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('images'))
  @ApiOperation({ summary: 'رفع عدة صور (حتى 10 صور)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'الصور (حد أقصى 10 صور، كل صورة حد أقصى 5MB)',
        },
      },
    },
  })
  async uploadMultipleImages(@UploadedFile() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('يجب تحديد صورة واحدة على الأقل');
    }

    if (files.length > 10) {
      throw new BadRequestException('الحد الأقصى 10 صور');
    }

    const uploadedFiles = files.map((file) => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    }));

    return {
      success: true,
      message: `تم رفع ${files.length} صورة بنجاح`,
      data: {
        count: files.length,
        files: uploadedFiles,
      },
    };
  }

  /**
   * حذف صورة
   */
  @Delete('image/:filename')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف صورة' })
  @ApiResponse({
    status: 200,
    description: 'تم حذف الصورة بنجاح',
  })
  async deleteImage(@Param('filename') filename: string) {
    // تنظيف اسم الملف من أي محاولات اختراق
    const sanitizedFilename = this.uploadService.sanitizePath(filename);

    const filePath = `./uploads/${sanitizedFilename}`;

    const deleted = this.uploadService.deleteFile(filePath);

    if (!deleted) {
      throw new BadRequestException('فشل في حذف الصورة أو الصورة غير موجودة');
    }

    return {
      success: true,
      message: 'تم حذف الصورة بنجاح',
    };
  }

  /**
   * الحصول على معلومات ملف
   */
  @Get('info/:filename')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'الحصول على معلومات ملف' })
  async getFileInfo(@Param('filename') filename: string) {
    const sanitizedFilename = this.uploadService.sanitizePath(filename);
    const filePath = `./uploads/${sanitizedFilename}`;

    const info = this.uploadService.getFileInfo(filePath);

    return {
      success: true,
      data: {
        filename: sanitizedFilename,
        ...info,
      },
    };
  }
}

