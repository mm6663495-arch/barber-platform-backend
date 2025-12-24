# دليل اختبار API - تعليمات تفصيلية 🔧

## 📋 المحتويات

1. [الإعداد الأولي](#الإعداد-الأولي)
2. [كيفية استخدام ملفات JSON](#كيفية-استخدام-ملفات-json)
3. [الترتيب الصحيح للاختبار](#الترتيب-الصحيح-للاختبار)
4. [استخدام Swagger UI](#استخدام-swagger-ui)
5. [استخدام Postman](#استخدام-postman)
6. [استخدام cURL](#استخدام-curl)
7. [حل المشاكل الشائعة](#حل-المشاكل-الشائعة)

---

## 🚀 الإعداد الأولي

### 1. تشغيل المشروع
```bash
# في terminal
cd d:\barber-platform-backend
npm run start:dev
```

### 2. التحقق من تشغيل الخادم
افتح المتصفح على: `http://localhost:3000/api/docs`

### 3. التحقق من قاعدة البيانات
تأكد من وجود البيانات التجريبية:
```bash
npm run db:seed
```

---

## 📁 كيفية استخدام ملفات JSON

### هيكل ملف JSON
كل ملف JSON يحتوي على:
- **description**: وصف الملف
- **endpoints**: جميع الـ endpoints
- **test_scenarios**: سيناريوهات اختبار مقترحة
- **error_cases**: حالات اختبار الأخطاء

### قراءة endpoint من JSON
```json
{
  "endpoint_name": {
    "name": "الاسم بالعربية",
    "method": "GET/POST/PATCH/DELETE",
    "url": "/path/to/endpoint",
    "authentication": "required/optional/none",
    "role": "ADMIN/SALON_OWNER/CUSTOMER/ANY",
    "headers": {...},
    "body": {...},
    "expected_response": {...},
    "notes": "ملاحظات مهمة"
  }
}
```

---

## 🔢 الترتيب الصحيح للاختبار

### المرحلة 1: المصادقة (إلزامية)
**ملف:** `01-authentication.json`

#### الخطوة 1.1: تسجيل الدخول كمدير
```
Endpoint: login_admin
Method: POST
URL: http://localhost:3000/auth/login
Body: {
  "email": "admin@barber.com",
  "password": "admin123"
}
```

**⚠️ مهم جداً:** احفظ الـ `token` من الاستجابة!

#### الخطوة 1.2: تسجيل الدخول كصاحب صالون
```
Endpoint: login_salon_owner
Body: {
  "email": "owner@salon.com",
  "password": "owner123"
}
```
احفظ هذا الـ token أيضاً.

#### الخطوة 1.3: تسجيل الدخول كعميل
```
Endpoint: login_customer
Body: {
  "email": "customer@test.com",
  "password": "customer123"
}
```
احفظ هذا الـ token أيضاً.

### المرحلة 2: المستخدمون
**ملف:** `02-users.json`

استخدم الـ **admin_token** من المرحلة 1.

#### اختبار 2.1: عرض جميع المستخدمين
```
Endpoint: get_all_users
Method: GET
URL: http://localhost:3000/users
Headers: {
  "Authorization": "Bearer YOUR_ADMIN_TOKEN"
}
```

#### اختبار 2.2: عرض إحصائيات المستخدمين
```
Endpoint: get_user_statistics
Method: GET
URL: http://localhost:3000/users/statistics
```

### المرحلة 3: الصالونات
**ملف:** `03-salons.json`

#### اختبار 3.1: عرض الصالونات (عام - بدون token)
```
Endpoint: get_all_salons
Method: GET
URL: http://localhost:3000/salons
No Authentication Required
```

#### اختبار 3.2: إنشاء صالون جديد (Salon Owner)
```
Endpoint: create_salon
Method: POST
URL: http://localhost:3000/salons
Headers: {
  "Authorization": "Bearer YOUR_SALON_OWNER_TOKEN"
}
Body: انظر 03-salons.json -> create_salon -> body
```

#### اختبار 3.3: الموافقة على الصالون (Admin)
```
Endpoint: approve_salon
Method: PATCH
URL: http://localhost:3000/salons/{salonId}/approve
Headers: {
  "Authorization": "Bearer YOUR_ADMIN_TOKEN"
}
```

### المرحلة 4: الباقات
**ملف:** `04-packages.json`

#### اختبار 4.1: إنشاء باقة (Salon Owner)
```
Endpoint: create_package
Method: POST
URL: http://localhost:3000/salons/{salonId}/packages
Headers: {
  "Authorization": "Bearer YOUR_SALON_OWNER_TOKEN"
}
Body: انظر 04-packages.json
```

#### اختبار 4.2: نشر الباقة
```
Endpoint: publish_package
Method: PATCH
URL: http://localhost:3000/salons/packages/{packageId}/publish
```

### المرحلة 5: الاشتراكات
**ملف:** `05-subscriptions.json`

#### اختبار 5.1: إنشاء اشتراك (Customer)
```
Endpoint: create_subscription
Method: POST
URL: http://localhost:3000/subscriptions
Headers: {
  "Authorization": "Bearer YOUR_CUSTOMER_TOKEN"
}
Body: {
  "packageId": 1,
  "paymentMethod": "cash"
}
```

**احفظ qrCode من الاستجابة!**

#### اختبار 5.2: استخدام زيارة (Salon Owner)
```
Endpoint: use_visit
Method: POST
URL: http://localhost:3000/subscriptions/use-visit
Headers: {
  "Authorization": "Bearer YOUR_SALON_OWNER_TOKEN"
}
Body: {
  "qrCode": "QR_FROM_STEP_5.1"
}
```

### المرحلة 6: المدفوعات
**ملف:** `06-payments.json`

#### اختبار 6.1: عرض المدفوعات
```
Endpoint: get_my_payments
Method: GET
URL: http://localhost:3000/payments/my-payments
Headers: {
  "Authorization": "Bearer YOUR_CUSTOMER_TOKEN"
}
```

### المرحلة 7: المراجعات
**ملف:** `07-reviews.json`

#### اختبار 7.1: إنشاء مراجعة (Customer)
```
Endpoint: create_review
Method: POST
URL: http://localhost:3000/reviews
Body: {
  "visitId": 1,
  "rating": 5,
  "comment": "خدمة ممتازة!"
}
```

#### اختبار 7.2: الرد على المراجعة (Salon Owner)
```
Endpoint: respond_to_review
Method: PATCH
URL: http://localhost:3000/reviews/{reviewId}/respond
Body: {
  "response": "شكراً لك!"
}
```

### المرحلة 8: الإشعارات
**ملف:** `08-notifications.json`

#### اختبار 8.1: عرض الإشعارات
```
Endpoint: get_my_notifications
Method: GET
URL: http://localhost:3000/notifications
```

### المرحلة 9: لوحة الإدارة
**ملف:** `09-admin.json`

#### اختبار 9.1: لوحة التحكم (Admin)
```
Endpoint: get_dashboard
Method: GET
URL: http://localhost:3000/admin/dashboard
Headers: {
  "Authorization": "Bearer YOUR_ADMIN_TOKEN"
}
```

---

## 🌐 استخدام Swagger UI

### خطوات الاختبار في Swagger:

#### 1. فتح Swagger UI
- اذهب إلى: `http://localhost:3000/api/docs`

#### 2. تسجيل الدخول
1. ابحث عن قسم **Authentication**
2. اضغط على `POST /auth/login`
3. اضغط **Try it out**
4. أدخل:
   ```json
   {
     "email": "admin@barber.com",
     "password": "admin123"
   }
   ```
5. اضغط **Execute**
6. **انسخ الـ token** من Response

#### 3. تفعيل المصادقة
1. اضغط زر **Authorize** في أعلى الصفحة
2. أدخل: `Bearer YOUR_TOKEN_HERE`
3. اضغط **Authorize**
4. اضغط **Close**

#### 4. اختبار Endpoints
الآن يمكنك اختبار أي endpoint محمي:
1. اذهب للـ endpoint المطلوب
2. اضغط **Try it out**
3. أدخل البيانات
4. اضغط **Execute**

---

## 📮 استخدام Postman

### استيراد المجموعة

1. افتح Postman
2. اضغط **Import**
3. اختر `POSTMAN_COLLECTION.json`
4. اضغط **Import**

### إعداد المتغيرات

1. اذهب لـ **Environments**
2. أنشئ environment جديد اسمه "Development"
3. أضف المتغيرات:
   ```
   baseUrl: http://localhost:3000
   admin_token: (سيُملأ تلقائياً)
   salon_owner_token: (سيُملأ تلقائياً)
   customer_token: (سيُملأ تلقائياً)
   ```

### الاختبار التلقائي

المجموعة تحتوي على Tests تلقائية:
- حفظ الـ tokens تلقائياً
- التحقق من status codes
- حفظ IDs للاستخدام لاحقاً

---

## 💻 استخدام cURL

### Windows PowerShell

#### تسجيل الدخول:
```powershell
$body = @{email="admin@barber.com"; password="admin123"} | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $response.token
```

#### استخدام الـ Token:
```powershell
$headers = @{Authorization="Bearer $token"}
Invoke-RestMethod -Uri "http://localhost:3000/users" -Method GET -Headers $headers
```

### Linux/Mac (bash):
```bash
# تسجيل الدخول
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barber.com","password":"admin123"}' \
  | jq -r '.token')

# استخدام الـ Token
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🆘 حل المشاكل الشائعة

### خطأ 401 Unauthorized
**السبب:** Token غير صحيح أو منتهي
**الحل:**
1. تأكد من إضافة "Bearer " قبل الـ token
2. احصل على token جديد من `/auth/login`
3. تحقق من عدم وجود مسافات زائدة

### خطأ 403 Forbidden
**السبب:** لا تملك الصلاحيات المطلوبة
**الحل:**
1. تحقق من role المطلوب للـ endpoint
2. استخدم الـ token الصحيح (admin/salon_owner/customer)
3. راجع الصلاحيات في الملف المناسب

### خطأ 400 Bad Request
**السبب:** بيانات غير صحيحة
**الحل:**
1. راجع الـ body في ملف JSON
2. تأكد من وجود جميع الحقول المطلوبة
3. تحقق من نوع البيانات (string, number, etc.)

### خطأ 404 Not Found
**السبب:** مورد غير موجود
**الحل:**
1. تحقق من صحة الـ ID
2. تأكد من إنشاء المورد أولاً
3. راجع الـ URL

### الخادم لا يستجيب
**الحل:**
```bash
# أعد تشغيل الخادم
npm run start:dev

# تحقق من قاعدة البيانات
npm run db:studio
```

---

## 📊 جدول الأولويات

| المرحلة | الملف | الأولوية | الوقت المقدر |
|---------|-------|----------|--------------|
| 1 | Authentication | عالية جداً | 5 دقائق |
| 2 | Users | عالية | 10 دقائق |
| 3 | Salons | عالية | 15 دقائق |
| 4 | Packages | متوسطة | 10 دقائق |
| 5 | Subscriptions | عالية | 15 دقائق |
| 6 | Payments | متوسطة | 10 دقائق |
| 7 | Reviews | متوسطة | 10 دقائق |
| 8 | Notifications | منخفضة | 5 دقائق |
| 9 | Admin | منخفضة | 10 دقائق |

**الوقت الإجمالي:** ~90 دقيقة للاختبار الكامل

---

## ✅ قائمة تحقق الاختبار

- [ ] تسجيل الدخول بجميع الأدوار
- [ ] حفظ جميع الـ tokens
- [ ] اختبار عمليات المستخدمين
- [ ] إنشاء صالون وباقات
- [ ] إنشاء اشتراك واستخدام زيارة
- [ ] كتابة مراجعة والرد عليها
- [ ] فحص الإشعارات
- [ ] مراجعة لوحة الإدارة

---

## 🎯 نصائح للاختبار الفعال

1. **ابدأ دائماً بالمصادقة**
2. **احفظ الـ tokens في مكان آمن**
3. **اتبع الترتيب المذكور**
4. **اختبر حالات الخطأ أيضاً**
5. **راجع الـ notes في كل endpoint**
6. **استخدم Postman للاختبار المتقدم**
7. **راجع البيانات التجريبية في `prisma/seed.ts`**

---

**🎉 مبروك! أنت الآن جاهز لاختبار جميع الـ APIs بثقة!**
