# دليل إدارة البيانات التجريبية

## نظرة عامة

تم إنشاء نظام لإدارة البيانات التجريبية لاختبار أقسام التطبيق (الزيارات، العملاء، التقييمات) بدون الحاجة لتطبيق زبون.

## المميزات

- ✅ إنشاء عملاء تجريبيين تلقائياً
- ✅ إنشاء اشتراكات للعملاء
- ✅ إنشاء زيارات عشوائية
- ✅ إنشاء تقييمات للزيارات
- ✅ حذف جميع البيانات التجريبية بضغطة واحدة

## كيفية الاستخدام

### 1. من التطبيق (Flutter)

1. افتح التطبيق وانتقل إلى **Settings** (الإعدادات)
2. ابحث عن قسم **"التطوير والاختبار"** (Development & Testing)
3. اضغط على **"Test Data Management"**
4. اختر عدد العملاء المراد إنشاؤهم (1-20)
5. اضغط على **"إنشاء بيانات تجريبية"**

### 2. من API مباشرة

#### إنشاء بيانات تجريبية

```bash
POST /api/v1/dev/test-data/:salonId
Authorization: Bearer <token>
Content-Type: application/json

{
  "count": 5
}
```

**Response:**
```json
{
  "success": true,
  "message": "تم إنشاء 5 عميل تجريبي بنجاح",
  "data": {
    "salon": {
      "id": 1,
      "name": "My Salon"
    },
    "summary": {
      "customers": 5,
      "subscriptions": 5,
      "visits": 15,
      "reviews": 10
    }
  }
}
```

#### حذف البيانات التجريبية

```bash
DELETE /api/v1/dev/test-data/:salonId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "تم حذف جميع البيانات التجريبية بنجاح",
  "deleted": {
    "subscriptions": 5,
    "customers": 5,
    "users": 5
  }
}
```

## ما يتم إنشاؤه

لكل عميل تجريبي:
- ✅ مستخدم (User) مع email: `test_customer_<timestamp>_<index>@test.com`
- ✅ عميل (Customer) مع اسم ورقم هاتف
- ✅ اشتراك (Subscription) نشط
- ✅ زيارات عشوائية (1 إلى عدد زيارات الباقة)
- ✅ تقييمات (70% من الزيارات المكتملة)

## ملاحظات مهمة

1. **يجب أن يكون لديك باقة نشطة واحدة على الأقل** في الصالون
2. البيانات التجريبية **خاصة بكل صالون** ولا تتداخل
3. عند الحذف، يتم حذف **فقط البيانات التجريبية** (email يحتوي على `@test.com`)
4. البيانات الحقيقية **لن تتأثر** بالحذف

## الأمان

- ✅ فقط أصحاب الصالونات يمكنهم استخدام هذه الميزة
- ✅ التحقق من أن الصالون يخص المستخدم
- ✅ البيانات التجريبية واضحة (email يحتوي على `@test.com`)

## مثال على الاستخدام

```dart
// في Flutter
final devService = DevService();

// إنشاء 10 عملاء تجريبيين
final result = await devService.createTestData(
  salonId: '1',
  count: 10,
);

print('تم إنشاء: ${result['summary']['customers']} عميل');
print('تم إنشاء: ${result['summary']['visits']} زيارة');
print('تم إنشاء: ${result['summary']['reviews']} تقييم');
```

## استكشاف الأخطاء

### خطأ: "Salon must have at least one active package"
**الحل:** تأكد من أن لديك باقة نشطة واحدة على الأقل في الصالون

### خطأ: "Salon not found or access denied"
**الحل:** تأكد من أن الصالون يخصك وأنك مسجل دخول كصاحب صالون

