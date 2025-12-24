import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';

/**
 * Upload Module - إدارة رفع الملفات والصور
 * يدعم: صور الصالونات، صور البروفايل، المستندات
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '24h',
        },
      }),
      inject: [ConfigService],
    }),
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, callback) => {
          // تحديد المجلد بناءً على نوع الملف
          let uploadPath = './uploads';

          if (file.fieldname === 'file' && req.url.includes('salon-image')) {
            uploadPath = './uploads/salons';
          } else if (file.fieldname === 'profileImage') {
            uploadPath = './uploads/profiles';
          } else if (file.fieldname === 'document') {
            uploadPath = './uploads/documents';
          } else {
            uploadPath = './uploads/general';
          }

          // إنشاء المجلد إذا لم يكن موجوداً
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          callback(null, uploadPath);
        },
        filename: (req, file, callback) => {
          // إنشاء اسم فريد للملف
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        // التحقق من نوع الملف
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new Error(
              'نوع الملف غير مدعوم! فقط الصور مسموح بها (JPG, JPEG, PNG, GIF, WEBP)',
            ),
            false,
          );
        }
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

