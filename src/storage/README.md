# 📦 Storage Module - AWS S3 Integration

وحدة شاملة لإدارة الملفات والصور في السحابة

---

## 📋 المحتويات

- [نظرة عامة](#نظرة-عامة)
- [الملفات](#الملفات)
- [الميزات](#الميزات)
- [الاستخدام](#الاستخدام)
- [API Endpoints](#api-endpoints)
- [التكوين](#التكوين)

---

## 🎯 نظرة عامة

هذه الوحدة توفر تكامل كامل مع **AWS S3** لتخزين الملفات والصور في السحابة، مع معالجة الصور وتحسينها تلقائياً.

### الإمكانيات الرئيسية:
- ✅ رفع الملفات إلى AWS S3
- ✅ معالجة وتحسين الصور (Sharp)
- ✅ إنشاء thumbnails تلقائياً
- ✅ دعم CloudFront CDN
- ✅ Signed URLs للأمان
- ✅ حذف وإدارة الملفات

---

## 📁 الملفات

```
src/storage/
├── storage.module.ts      # تعريف الوحدة
├── s3.service.ts          # خدمة AWS S3
├── storage.service.ts     # خدمة التخزين الرئيسية
├── image.service.ts       # معالجة الصور
├── upload.controller.ts   # API endpoints
└── README.md              # هذا الملف
```

### 1. **storage.module.ts**
```typescript
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [UploadController],
  providers: [S3Service, StorageService, ImageService],
  exports: [S3Service, StorageService, ImageService],
})
export class StorageModule {}
```

### 2. **s3.service.ts**
- رفع الملفات إلى S3
- حذف الملفات
- إنشاء Signed URLs
- نسخ الملفات
- إدارة S3 operations

### 3. **storage.service.ts**
- طبقة abstraction للتخزين
- معالجة الصور التلقائية
- إنشاء thumbnails
- تنسيق الاستجابات

### 4. **image.service.ts**
- تحسين الصور (compression)
- تغيير الحجم (resize)
- قص الصور (crop)
- تحويل الصيغ
- إضافة watermarks

### 5. **upload.controller.ts**
- 9 API endpoints
- رفع صور/ملفات
- حذف ملفات
- Signed URLs

---

## ✨ الميزات

### 🖼️ معالجة الصور
```typescript
// تحسين تلقائي
- ضغط 70%
- تحسين الجودة
- تصغير الحجم
```

### 📐 Thumbnails
```typescript
const thumbnails = {
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 },
};
```

### 🔐 الأمان
- JWT Authentication
- Signed URLs
- Access Control
- Validation

### ⚡ الأداء
- CDN Support
- Caching
- Lazy Loading
- Optimization

---

## 🚀 الاستخدام

### في Controllers:
```typescript
import { StorageService } from './storage/storage.service';

@Controller('salons')
export class SalonsController {
  constructor(private storageService: StorageService) {}

  @Post('logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    const result = await this.storageService.uploadFile(file, {
      folder: 'salons/logos',
      optimize: true,
      generateThumbnails: true,
    });
    
    return result;
  }
}
```

### في Services:
```typescript
import { S3Service } from './storage/s3.service';

@Injectable()
export class ProfileService {
  constructor(private s3Service: S3Service) {}

  async updateAvatar(userId: number, file: Buffer) {
    const result = await this.s3Service.uploadFile(
      file,
      `avatar-${userId}.jpg`,
      'image/jpeg',
      'users/avatars',
    );
    
    return result.s3Url;
  }
}
```

---

## 🌐 API Endpoints

### 1. رفع صورة واحدة
```http
POST /upload/image
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  file: [صورة]
  folder: "salons/logos" (optional)
```

**Response:**
```json
{
  "original": {
    "key": "salons/logos/image-123.jpg",
    "s3Url": "https://bucket.s3.region.amazonaws.com/...",
    "cdnUrl": "https://cdn.example.com/...",
    "size": 245678,
    "contentType": "image/jpeg"
  },
  "optimized": { ... },
  "thumbnails": {
    "small": { ... },
    "medium": { ... },
    "large": { ... }
  }
}
```

### 2. رفع صور متعددة
```http
POST /upload/images
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  files: [صورة1, صورة2, ...]
```

### 3. رفع ملف
```http
POST /upload/file
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  file: [ملف]
```

### 4. حذف ملف
```http
DELETE /upload/file
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "url": "https://bucket.s3.region.amazonaws.com/file.jpg"
}
```

### 5. الحصول على Signed URL
```http
GET /upload/signed-url/{key}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "signedUrl": "https://bucket.s3.region.amazonaws.com/file.jpg?X-Amz-...",
  "expiresIn": 3600
}
```

### 6. تحسين صورة
```http
POST /upload/optimize
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  file: [صورة]
  width: 800 (optional)
  height: 600 (optional)
  quality: 80 (optional)
```

### 7. إنشاء thumbnail
```http
POST /upload/thumbnail
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  file: [صورة]
  width: 300
  height: 300
```

### 8. إنشاء thumbnails متعددة
```http
POST /upload/thumbnails
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  file: [صورة]
  sizes: [
    { "name": "small", "width": 150, "height": 150 },
    { "name": "large", "width": 600, "height": 600 }
  ]
```

### 9. رفع ملفات متعددة
```http
POST /upload/files
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  files: [ملف1, ملف2, ...]
```

---

## ⚙️ التكوين

### متغيرات البيئة (.env):
```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# CloudFront CDN (Optional)
AWS_CLOUDFRONT_URL=https://your-cdn.cloudfront.net
```

### التسجيل في الوحدة الرئيسية:
```typescript
// app.module.ts
@Module({
  imports: [
    // ... other modules
    StorageModule,
  ],
})
export class AppModule {}
```

---

## 📊 الأمثلة

### مثال 1: رفع صورة profile
```typescript
@Post('profile/avatar')
@UseInterceptors(FileInterceptor('avatar'))
async uploadAvatar(
  @UploadedFile() file: Express.Multer.File,
  @Request() req,
) {
  const result = await this.storageService.uploadFile(file, {
    folder: `users/${req.user.id}/avatar`,
    optimize: true,
    generateThumbnails: true,
  });

  // حفظ الـ URL في قاعدة البيانات
  await this.usersService.updateAvatar(req.user.id, result.original.cdnUrl);

  return result;
}
```

### مثال 2: رفع صور الصالون
```typescript
@Post('salon/:id/gallery')
@UseInterceptors(FilesInterceptor('images', 10))
async uploadGallery(
  @UploadedFiles() files: Express.Multer.File[],
  @Param('id') salonId: string,
) {
  const results = await Promise.all(
    files.map(file =>
      this.storageService.uploadFile(file, {
        folder: `salons/${salonId}/gallery`,
        optimize: true,
        maxSize: 5 * 1024 * 1024, // 5MB
      }),
    ),
  );

  return { images: results };
}
```

### مثال 3: حذف صورة قديمة
```typescript
async updateLogo(salonId: number, newFile: Express.Multer.File) {
  const salon = await this.prisma.salon.findUnique({
    where: { id: salonId },
  });

  // حذف الصورة القديمة
  if (salon.logoUrl) {
    await this.storageService.deleteFile(salon.logoUrl);
  }

  // رفع الصورة الجديدة
  const result = await this.storageService.uploadFile(newFile, {
    folder: `salons/${salonId}/logo`,
    optimize: true,
  });

  // تحديث قاعدة البيانات
  return this.prisma.salon.update({
    where: { id: salonId },
    data: { logoUrl: result.original.cdnUrl },
  });
}
```

---

## 🔍 استكشاف الأخطاء

### مشكلة: "Nest can't resolve dependencies"
**الحل:** تأكد من استيراد `AuthModule` في `StorageModule`

### مشكلة: AWS Credentials
**الحل:** تحقق من ملف `.env` وتأكد من وجود:
- AWS_REGION
- AWS_S3_BUCKET
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

### مشكلة: Sharp errors
**الحل:** أعد تثبيت sharp:
```bash
npm rebuild sharp
```

---

## 📚 المراجع

- [AWS S3 Guide](../../AWS_S3_GUIDE.md) - دليل شامل
- [AWS S3 Quickstart](../../AWS_S3_QUICKSTART.md) - بداية سريعة
- [AWS S3 Examples](../../AWS_S3_EXAMPLES.md) - أمثلة عملية

---

## 🎯 Best Practices

1. **استخدم Thumbnails** للصور الكبيرة
2. **فعّل CDN** للأداء الأفضل
3. **احذف الملفات القديمة** عند التحديث
4. **استخدم Signed URLs** للملفات الخاصة
5. **اضبط Max Size** حسب الحاجة

---

## ✅ الحالة

- ✅ تم التطوير
- ✅ تم الاختبار
- ✅ موثّق بالكامل
- ✅ جاهز للإنتاج

---

**Built with ❤️ for Barber Platform**  
*Enterprise Grade Storage Solution*

