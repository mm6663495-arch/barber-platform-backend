# 📁 Upload Module

## نظرة عامة

موديول متكامل لرفع وإدارة الصور والملفات في منصة الحلاقة.

---

## 📂 الملفات

```
upload/
├── upload.module.ts       # Module configuration
├── upload.service.ts      # Business logic
├── upload.controller.ts   # API endpoints
├── dto/
│   └── upload-image.dto.ts
└── README.md
```

---

## ⚙️ الميزات

### ✅ رفع الملفات
- رفع صور الصالونات
- رفع صور البروفايل
- رفع صور عامة
- رفع عدة صور دفعة واحدة

### ✅ معالجة الصور
- تصغير تلقائي
- ضغط الصور
- إنشاء Thumbnails
- تحسين الجودة

### ✅ الأمان
- Validation على نوع الملف
- Validation على حجم الملف
- JWT Authentication
- تنظيف أسماء الملفات

---

## 🔧 الإعدادات

### أنواع الملفات المدعومة:
```typescript
['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
```

### الحد الأقصى لحجم الملف:
```typescript
5 MB (5 * 1024 * 1024 bytes)
```

### مجلدات التخزين:
```
uploads/
├── salons/      # صور الصالونات
├── profiles/    # صور البروفايل
├── general/     # صور عامة
└── documents/   # مستندات
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload/salon-image` | رفع صورة صالون |
| POST | `/upload/profile-image` | رفع صورة بروفايل |
| POST | `/upload/image` | رفع صورة عامة |
| POST | `/upload/multiple-images` | رفع عدة صور |
| DELETE | `/upload/image/:filename` | حذف صورة |
| GET | `/upload/info/:filename` | معلومات ملف |

---

## 🔨 الاستخدام

### في Controller آخر:

```typescript
import { UploadService } from '../upload/upload.service';

@Injectable()
export class SalonsService {
  constructor(private uploadService: UploadService) {}

  async updateSalonImage(salonId: number, imageUrl: string) {
    // استخدام الصورة المرفوعة
    await this.prisma.salon.update({
      where: { id: salonId },
      data: { image: imageUrl },
    });
  }

  async deleteSalon(salonId: number) {
    const salon = await this.prisma.salon.findUnique({ 
      where: { id: salonId } 
    });
    
    // حذف الصورة عند حذف الصالون
    if (salon.image) {
      const filename = this.uploadService.extractFilename(salon.image);
      this.uploadService.deleteFile(`./uploads/salons/${filename}`);
    }
    
    await this.prisma.salon.delete({ where: { id: salonId } });
  }
}
```

---

## 🧪 الاختبار

### من Swagger UI:
1. افتح http://localhost:3000/api/docs
2. اذهب إلى قسم Upload
3. جرب أي endpoint

### من Postman:
```http
POST http://localhost:3000/upload/salon-image
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

Body (form-data):
Key: salonImage
Type: File
Value: [اختر صورة]
```

---

## 📚 الوثائق الكاملة

راجع ملف `FILE_UPLOAD_GUIDE.md` في الجذر للوثائق الكاملة.

---

## 🔄 التطوير المستقبلي

- [ ] AWS S3 Integration
- [ ] Image Watermark
- [ ] Video Upload Support
- [ ] PDF Upload Support
- [ ] Drag & Drop Interface

---

**Created:** 2025
**Status:** ✅ Production Ready

