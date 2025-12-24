# ملفات اختبار API - منصة الحلاقة 🧪

## 📚 نظرة عامة

هذا المجلد يحتوي على مجموعة شاملة من ملفات JSON لاختبار جميع APIs في منصة الحلاقة.

## 📁 قائمة الملفات

| الملف | الوصف | عدد Endpoints | الصلاحية المطلوبة |
|------|-------|---------------|-------------------|
| `01-authentication.json` | تسجيل الدخول والمصادقة | 10 | بدون/أي دور |
| `02-users.json` | إدارة المستخدمين | 9 | ADMIN |
| `03-salons.json` | إدارة الصالونات | 11 | بدون/SALON_OWNER/ADMIN |
| `04-packages.json` | إدارة الباقات | 9 | SALON_OWNER |
| `05-subscriptions.json` | إدارة الاشتراكات | 11 | CUSTOMER/SALON_OWNER/ADMIN |
| `06-payments.json` | إدارة المدفوعات | 9 | CUSTOMER/ADMIN |
| `07-reviews.json` | إدارة المراجعات | 8 | CUSTOMER/SALON_OWNER |
| `08-notifications.json` | إدارة الإشعارات | 7 | أي دور |
| `09-admin.json` | لوحة الإدارة | 6 | ADMIN |

**المجموع: 80 endpoint**

## 🚀 البدء السريع

### 1. التحضير
```bash
# تشغيل المشروع
npm run start:dev

# فتح Swagger UI
http://localhost:3000/api/docs
```

### 2. تسجيل الدخول
استخدم `01-authentication.json` للحصول على tokens:
- Admin: `admin@barber.com` / `admin123`
- Salon Owner: `owner@salon.com` / `owner123`
- Customer: `customer@test.com` / `customer123`

### 3. الاختبار
اتبع الترتيب من 01 إلى 09 لضمان اختبار كامل.

## 📖 بنية الملفات

كل ملف JSON يحتوي على:

```json
{
  "description": "وصف الملف",
  "base_url": "http://localhost:3000",
  "endpoints": {
    "endpoint_name": {
      "name": "الاسم بالعربية",
      "method": "HTTP_METHOD",
      "url": "/path",
      "authentication": "required/none",
      "role": "ADMIN/SALON_OWNER/CUSTOMER/ANY",
      "headers": {...},
      "body": {...},
      "expected_response": {...},
      "notes": "ملاحظات"
    }
  },
  "test_scenarios": {...},
  "error_cases": {...}
}
```

## 🎯 الترتيب الموصى به

1. **Authentication** - إلزامي أولاً
2. **Users** - فهم المستخدمين
3. **Salons** - إنشاء صالونات
4. **Packages** - إضافة باقات
5. **Subscriptions** - إنشاء اشتراكات
6. **Payments** - معالجة المدفوعات
7. **Reviews** - المراجعات
8. **Notifications** - الإشعارات
9. **Admin** - لوحة الإدارة

## 💡 نصائح مهمة

### احفظ هذه القيم
- ✅ Admin Token
- ✅ Salon Owner Token
- ✅ Customer Token
- ✅ Salon ID (بعد الإنشاء)
- ✅ Package ID (بعد الإنشاء)
- ✅ Subscription QR Code

### تجنب هذه الأخطاء
- ❌ نسيان "Bearer " قبل الـ token
- ❌ استخدام token منتهي الصلاحية
- ❌ استخدام الدور الخاطئ
- ❌ نسيان إنشاء البيانات المطلوبة أولاً

## 📝 أمثلة سريعة

### مثال 1: تسجيل دخول وعرض المستخدمين
```json
// 1. Login (01-authentication.json -> login_admin)
POST http://localhost:3000/auth/login
Body: {"email": "admin@barber.com", "password": "admin123"}

// 2. Get Users (02-users.json -> get_all_users)
GET http://localhost:3000/users
Headers: {"Authorization": "Bearer YOUR_TOKEN"}
```

### مثال 2: إنشاء صالون وباقة
```json
// 1. Login as Salon Owner
// 2. Create Salon (03-salons.json -> create_salon)
// 3. Create Package (04-packages.json -> create_package)
// 4. Publish Package (04-packages.json -> publish_package)
```

### مثال 3: اشتراك كامل
```json
// 1. Login as Customer
// 2. Create Subscription (05-subscriptions.json)
// 3. Get QR Code from response
// 4. Use Visit (Salon Owner scans QR)
// 5. Write Review (Customer)
```

## 🔧 أدوات الاختبار

### Swagger UI
الأسهل للمبتدئين:
1. افتح `http://localhost:3000/api/docs`
2. استخدم واجهة التجربة المباشرة

### Postman
للاختبار الاحترافي:
1. استورد `../POSTMAN_COLLECTION.json`
2. استخدم الـ Tests التلقائية

### cURL
للاختبار من Terminal:
```bash
# Windows PowerShell
$body = @{email="admin@barber.com"; password="admin123"} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -Body $body -ContentType "application/json"
```

## 📊 الإحصائيات

- **إجمالي Endpoints:** 80+
- **Endpoints عامة:** ~15 (لا تحتاج مصادقة)
- **Endpoints محمية:** ~65
- **أدوار مختلفة:** 3 (Admin, Salon Owner, Customer)

## 🆘 الدعم

- **الدليل التفصيلي:** `../TESTING_INSTRUCTIONS.md`
- **Swagger UI:** `http://localhost:3000/api/docs`
- **Postman Collection:** `../POSTMAN_COLLECTION.json`

## ✅ قائمة تحقق سريعة

قبل البدء، تأكد من:
- [ ] تشغيل المشروع (`npm run start:dev`)
- [ ] وجود البيانات التجريبية (`npm run db:seed`)
- [ ] فتح Swagger UI يعمل
- [ ] فهم بنية ملفات JSON

## 🎉 استمتع بالاختبار!

هذه المجموعة تغطي **100%** من APIs المتاحة في المشروع. استخدمها لفهم واختبار جميع الوظائف بسهولة!

---

**تم إنشاء هذه الملفات بعناية لتسهيل اختبار منصة الحلاقة. جميع الملفات محدثة ومختبرة!** ✨
