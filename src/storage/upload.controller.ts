import {
  Controller,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService, UploadFileOptions } from './storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('image')
  @ApiOperation({ summary: 'رفع صورة واحدة' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'المجلد (اختياري)',
        },
        optimize: {
          type: 'boolean',
          description: 'تحسين الصورة',
        },
        createThumbnails: {
          type: 'boolean',
          description: 'إنشاء thumbnails',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
    @Body('optimize') optimize?: string,
    @Body('createThumbnails') createThumbnails?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    console.log('📤 [UPLOAD] Uploading single image:');
    console.log('  - filename:', file.originalname);
    console.log('  - size:', file.size);
    console.log('  - mimetype:', file.mimetype);
    console.log('  - folder:', folder || 'images');

    const options: UploadFileOptions = {
      folder: folder || 'images',
      optimize: optimize === 'true',
      createThumbnails: createThumbnails === 'true',
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    };

    const result = await this.storageService.uploadFile(file, options);
    
    console.log('✅ [UPLOAD] Image uploaded successfully:');
    console.log('  - original.url:', result.original?.url);
    console.log('  - original.key:', result.original?.key);
    
    return result;
  }

  @Post('images')
  @ApiOperation({ summary: 'رفع عدة صور' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folder: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    console.log('📤 [UPLOAD] Uploading multiple images:');
    console.log('  - files count:', files.length);
    console.log('  - folder:', folder || 'images');
    files.forEach((file, index) => {
      console.log(`  - file ${index + 1}:`, file.originalname, `(${file.size} bytes)`);
    });

    const options: UploadFileOptions = {
      folder: folder || 'images',
      optimize: true,
      createThumbnails: true,
      maxSize: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    };

    const results = await this.storageService.uploadFiles(files, options);
    
    console.log('✅ [UPLOAD] Images uploaded successfully:');
    results.forEach((result, index) => {
      console.log(`  - image ${index + 1} URL:`, result.original?.url);
    });
    
    return results;
  }

  @Post('profile-image')
  @ApiOperation({ summary: 'رفع صورة شخصية' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const options: UploadFileOptions = {
      folder: 'profiles',
      optimize: true,
      createThumbnails: true,
      thumbnailSizes: [
        { name: 'thumb', width: 100, height: 100 },
        { name: 'small', width: 200, height: 200 },
        { name: 'medium', width: 400, height: 400 },
      ],
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
    };

    return this.storageService.uploadFile(file, options);
  }

  @Post('salon-image')
  @ApiOperation({ summary: 'رفع صورة صالون' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSalonImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const options: UploadFileOptions = {
      folder: 'salons',
      optimize: true,
      createThumbnails: true,
      maxSize: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    };

    return this.storageService.uploadFile(file, options);
  }

  @Post('document')
  @ApiOperation({ summary: 'رفع مستند' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const options: UploadFileOptions = {
      folder: 'documents',
      maxSize: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    };

    return this.storageService.uploadFile(file, options);
  }

  @Delete('file')
  @ApiOperation({ summary: 'حذف ملف' })
  async deleteFile(@Body('url') url: string) {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    await this.storageService.deleteFile(url);
    
    return {
      success: true,
      message: 'File deleted successfully',
    };
  }

  @Delete('files')
  @ApiOperation({ summary: 'حذف عدة ملفات' })
  async deleteFiles(@Body('urls') urls: string[]) {
    if (!urls || urls.length === 0) {
      throw new BadRequestException('URLs are required');
    }

    await this.storageService.deleteFiles(urls);
    
    return {
      success: true,
      message: `${urls.length} files deleted successfully`,
    };
  }

  @Get('signed-url/:key')
  @ApiOperation({ summary: 'الحصول على رابط موقّع' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.storageService.getSignedUrl(key);
    
    return {
      url,
      expiresIn: 3600,
    };
  }

  @Get('exists')
  @ApiOperation({ summary: 'التحقق من وجود ملف' })
  async fileExists(@Body('url') url: string) {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    const exists = await this.storageService.fileExists(url);
    
    return {
      exists,
    };
  }
}

