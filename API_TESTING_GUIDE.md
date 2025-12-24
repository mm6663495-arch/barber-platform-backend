# دليل اختبار API - منصة الحلاقة

## نظرة عامة

هذا دليل شامل لاختبار جميع الجداول والوظائف في منصة الحلاقة من خلال Swagger API المتاح على `http://localhost:3000/api/docs`.

## الجداول المتاحة

### 1. جداول المستخدمين
- **User** - المستخدمون الأساسيون
- **PlatformAdmin** - مدراء المنصة  
- **SalonOwner** - أصحاب الصالونات
- **Customer** - العملاء

### 2. جداول الصالونات
- **Salon** - الصالونات
- **Package** - باقات الخدمات

### 3. جداول الاشتراكات والزيارات
- **Subscription** - الاشتراكات
- **Visit** - الزيارات

### 4. جداول المراجعات والمدفوعات
- **Review** - المراجعات والتقييمات
- **Payment** - المدفوعات

### 5. جداول النظام
- **Notification** - الإشعارات
- **Report** - البلاغات
- **AuditLog** - سجل المراجعة
- **SystemSetting** - إعدادات النظام

## بيانات تسجيل الدخول التجريبية

### 1. مدير النظام (Admin)
```
Email: admin@barber.com
Password: admin123
```

### 2. صاحب صالون (Salon Owner)
```
Email: owner@salon.com
Password: owner123
```

### 3. عميل (Customer)
```
Email: customer@test.com
Password: customer123
```

## خطوات الاختبار

### الخطوة 1: تشغيل الخادم

```bash
# تأكد من أن قاعدة البيانات تعمل
npm run start:dev
```

### الخطوة 2: فتح Swagger UI

1. افتح المتصفح واذهب إلى: `http://localhost:3000/api/docs`
2. ستظهر واجهة Swagger مع جميع الـ endpoints

### الخطوة 3: الحصول على Token للمصادقة

1. اذهب إلى قسم **Authentication**
2. استخدم endpoint `POST /auth/login`
3. أدخل بيانات تسجيل الدخول:

```json
{
  "email": "admin@barber.com",
  "password": "admin123"
}
```

4. انسخ الـ `accessToken` من الاستجابة

### الخطوة 4: تفعيل المصادقة

1. اضغط على زر **Authorize** في أعلى الصفحة
2. أدخل: `Bearer YOUR_ACCESS_TOKEN`
3. اضغط **Authorize**

## اختبار الـ Endpoints الرئيسية

### 1. إدارة المستخدمين (Users)

#### عرض جميع المستخدمين
```
GET /users
Headers: Authorization: Bearer YOUR_TOKEN
```

#### إنشاء مستخدم جديد (Admin فقط)
```
POST /users
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "email": "newuser@test.com",
  "password": "password123",
  "role": "CUSTOMER",
  "fullName": "اسم المستخدم الجديد"
}
```

#### عرض إحصائيات المستخدمين
```
GET /users/statistics
Headers: Authorization: Bearer YOUR_TOKEN
```

### 2. إدارة الصالونات (Salons)

#### عرض جميع الصالونات (عام)
```
GET /salons
```

#### إنشاء صالون جديد (Salon Owner فقط)
```
POST /salons
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "name": "صالون الجمال",
  "description": "وصف الصالون",
  "address": "العنوان الكامل",
  "latitude": 24.7136,
  "longitude": 46.6753,
  "workingHours": {
    "sunday": "09:00-22:00",
    "monday": "09:00-22:00"
  }
}
```

#### عرض صالوناتي (Salon Owner فقط)
```
GET /salons/owner/my-salons
Headers: Authorization: Bearer YOUR_TOKEN
```

### 3. إدارة الباقات (Packages)

#### إنشاء باقة جديدة
```
POST /salons/{salonId}/packages
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "name": "باقة الشعر الكاملة",
  "description": "تشمل قص وتصفيف",
  "price": 150.0,
  "visitsCount": 5,
  "validityDays": 30
}
```

#### نشر الباقة
```
PATCH /salons/packages/{packageId}/publish
Headers: Authorization: Bearer YOUR_TOKEN
```

### 4. إدارة الاشتراكات (Subscriptions)

#### إنشاء اشتراك جديد (Customer فقط)
```
POST /subscriptions
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "packageId": 1,
  "paymentMethod": "stripe"
}
```

#### عرض اشتراكاتي
```
GET /subscriptions/my-subscriptions
Headers: Authorization: Bearer YOUR_TOKEN
```

#### استخدام زيارة (Salon Owner فقط)
```
POST /subscriptions/use-visit
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "qrCode": "QR_CODE_FROM_SUBSCRIPTION"
}
```

### 5. إدارة المراجعات (Reviews)

#### إنشاء مراجعة جديدة (Customer فقط)
```
POST /reviews
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "salonId": 1,
  "visitId": 1,
  "rating": 5,
  "comment": "خدمة ممتازة!"
}
```

#### عرض مراجعات الصالون
```
GET /reviews/salon/{salonId}
```

#### الرد على المراجعة (Salon Owner فقط)
```
PATCH /reviews/{reviewId}/respond
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "response": "شكراً لك على المراجعة الرائعة!"
}
```

### 6. إدارة المدفوعات (Payments)

#### معالجة دفع Stripe
```
POST /payments/stripe
Headers: Authorization: Bearer YOUR_TOKEN
Body:
{
  "subscriptionId": 1,
  "amount": 150.0,
  "paymentMethodId": "pm_card_visa"
}
```

#### عرض مدفوعاتي
```
GET /payments/my-payments
Headers: Authorization: Bearer YOUR_TOKEN
```

#### عرض إحصائيات المدفوعات
```
GET /payments/statistics
Headers: Authorization: Bearer YOUR_TOKEN
```

### 7. إدارة الإشعارات (Notifications)

#### عرض إشعاراتي
```
GET /notifications
Headers: Authorization: Bearer YOUR_TOKEN
```

#### وضع علامة مقروءة على الإشعار
```
PATCH /notifications/{id}/read
Headers: Authorization: Bearer YOUR_TOKEN
```

### 8. لوحة الإدارة (Admin Panel)

#### عرض إحصائيات عامة
```
GET /admin/statistics
Headers: Authorization: Bearer YOUR_TOKEN (Admin only)
```

#### موافقة على صالون
```
PATCH /salons/{id}/approve
Headers: Authorization: Bearer YOUR_TOKEN (Admin only)
```

#### رفض صالون
```
PATCH /salons/{id}/reject
Headers: Authorization: Bearer YOUR_TOKEN (Admin only)
```

## أمثلة على اختبار سيناريوهات كاملة

### السيناريو 1: دورة حياة الاشتراك الكاملة

1. **إنشاء صالون** (Salon Owner)
2. **إنشاء باقة** للصالون
3. **نشر الباقة**
4. **العميل يشترك** في الباقة
5. **معالجة الدفع**
6. **استخدام الزيارة** في الصالون
7. **كتابة مراجعة**

### السيناريو 2: إدارة المراجعات

1. **العميل يكتب مراجعة**
2. **صاحب الصالون يرد** على المراجعة
3. **مستخدم آخر يبلغ** عن المراجعة
4. **المدير يراجع البلاغ**

### السيناريو 3: إدارة المدفوعات

1. **إنشاء دفع جديد**
2. **معالجة الدفع** عبر Stripe
3. **عرض تفاصيل الدفع**
4. **إجراء استرداد** (Admin only)

## نصائح للاختبار

### 1. ترتيب الاختبار
- ابدأ بالعمليات التي لا تحتاج مصادقة (عرض الصالونات)
- ثم احصل على token للمصادقة
- اختبر العمليات المحمية

### 2. استخدام البيانات التجريبية
- استخدم البيانات الموجودة في `seed.ts`
- أو أنشئ بيانات جديدة للاختبار

### 3. اختبار الأدوار المختلفة
- اختبر بصلاحيات Admin
- اختبر بصلاحيات Salon Owner  
- اختبر بصلاحيات Customer

### 4. التحقق من الاستجابات
- تأكد من أن الـ status code صحيح
- تحقق من بنية البيانات المُرجعة
- تأكد من وجود validation errors

### 5. اختبار الأخطاء
- اختبر ببيانات خاطئة
- اختبر بصلاحيات غير كافية
- اختبر بمعرفات غير موجودة

## استكشاف الأخطاء

### خطأ 401 Unauthorized
- تأكد من وجود token صحيح
- تأكد من إضافة "Bearer " قبل الـ token

### خطأ 403 Forbidden  
- تأكد من أن المستخدم لديه الصلاحيات المطلوبة
- جرب بدور مختلف

### خطأ 400 Bad Request
- تحقق من صحة البيانات المرسلة
- تأكد من وجود جميع الحقول المطلوبة

### خطأ 404 Not Found
- تأكد من صحة معرف المورد
- تأكد من أن المورد موجود في قاعدة البيانات

## روابط مفيدة

- **Swagger UI**: `http://localhost:3000/api/docs`
- **Prisma Studio**: `http://localhost:5555` (تشغيل `npm run db:studio`)
- **API Base URL**: `http://localhost:3000`

## ملاحظات مهمة

1. تأكد من أن قاعدة البيانات تعمل
2. تأكد من تشغيل `npm run db:seed` لإنشاء البيانات التجريبية
3. جميع الـ timestamps تُرجع بصيغة ISO 8601
4. الـ IDs تُرجع كأرقام صحيحة
5. بعض العمليات تحتاج صلاحيات خاصة (Admin/Salon Owner)

---

**تم إنشاء هذا الدليل لمساعدة المطورين على اختبار جميع وظائف منصة الحلاقة بسهولة وفعالية.**
