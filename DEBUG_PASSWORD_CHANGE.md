# دليل تتبع مشكلة تغيير كلمة المرور

## الخطوات المتبعة

### 1. فحص الـ Backend Logs

عند محاولة تغيير كلمة المرور، ستظهر رسائل logging في console الـ backend:

```
[AuthController] Change password endpoint called
[AuthController] User ID from token: <user_id>
[AuthController] Request body: {...}
[Auth] ========================================
[Auth] Change password request received
[Auth] User ID: <user_id>
[Auth] Current password length: <length>
[Auth] New password length: <length>
[Auth] User found: <email>
[Auth] Verifying current password...
[Auth] Current password verified successfully
[Auth] Hashing new password...
[Auth] New password hashed successfully
[Auth] Updating password in database...
[Auth] Password updated in database successfully
[Auth] Verifying new password can be used...
[Auth] ✅ Password changed successfully for user: <email>
[Auth] ========================================
```

### 2. فحص الـ Frontend Logs

في Flutter console، ستظهر رسائل:

```
[UserSettingsProvider] changePassword called
[UserSettingsService] Starting change password request
[UserSettingsService] Current password length: <length>
[UserSettingsService] New password length: <length>
[UserSettingsService] Change password response: {...}
[UserSettingsService] Password changed successfully
[UserSettingsProvider] changePassword succeeded
```

### 3. اختبار قاعدة البيانات مباشرة

قم بتشغيل السكريبت التالي للتحقق من أن تغيير كلمة المرور يعمل في قاعدة البيانات:

```bash
cd barber-platform-backend
node test-change-password.js
```

### 4. التحقق من الـ API مباشرة

يمكنك اختبار الـ API مباشرة باستخدام Postman أو curl:

```bash
curl -X POST http://localhost:3000/api/v1/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "currentPassword": "oldpassword",
    "newPassword": "newpassword123"
  }'
```

### 5. التحقق من قاعدة البيانات مباشرة

```bash
# استخدام Prisma Studio
npx prisma studio

# أو استخدام MySQL مباشرة
mysql -u root -p barber_platform
SELECT id, email, LEFT(password, 20) as password_hash FROM users WHERE email = 'owner@salon.com';
```

## المشاكل المحتملة والحلول

### المشكلة 1: الطلب لا يصل إلى الـ Backend
**الأعراض**: لا تظهر أي logs في الـ backend
**الحل**: 
- تحقق من أن الـ backend يعمل
- تحقق من الـ baseUrl في الـ frontend
- تحقق من الـ network connection

### المشكلة 2: خطأ في التحقق من كلمة المرور الحالية
**الأعراض**: `[Auth] ERROR: Current password incorrect`
**الحل**: 
- تأكد من إدخال كلمة المرور الحالية بشكل صحيح
- تحقق من أن المستخدم موجود في قاعدة البيانات
- استخدم `verify-user.js` للتحقق من كلمة المرور

### المشكلة 3: فشل في تحديث قاعدة البيانات
**الأعراض**: `[Auth] ERROR: Password update returned null`
**الحل**: 
- تحقق من اتصال قاعدة البيانات
- تحقق من أن المستخدم موجود
- تحقق من permissions قاعدة البيانات

### المشكلة 4: كلمة المرور الجديدة لا تعمل بعد التحديث
**الأعراض**: `[Auth] ERROR: Password verification failed after update`
**الحل**: 
- هذه مشكلة خطيرة - يجب التحقق من عملية hashing
- تحقق من أن bcrypt يعمل بشكل صحيح
- تحقق من أن قاعدة البيانات تحفظ البيانات بشكل صحيح

## ملفات مهمة

- `barber-platform-backend/src/auth/auth.controller.ts` - الـ endpoint
- `barber-platform-backend/src/auth/auth.service.ts` - منطق تغيير كلمة المرور
- `barber-platform-backend/src/auth/dto/change-password.dto.ts` - الـ DTO
- `salon_main/lib/core/services/user_settings_service.dart` - الـ frontend service
- `salon_main/lib/core/providers/user_settings_provider.dart` - الـ provider
- `salon_main/lib/features/settings/screens/security_settings_screen.dart` - الـ UI

## نصائح للتشخيص

1. **افتح console الـ backend** واتبع الـ logs خطوة بخطوة
2. **افتح Flutter console** واتبع الـ logs من الـ frontend
3. **استخدم `test-change-password.js`** للتحقق من قاعدة البيانات مباشرة
4. **استخدم `verify-user.js`** للتحقق من حالة المستخدم
5. **اختبر الـ API مباشرة** باستخدام Postman للتأكد من أن المشكلة ليست في الـ frontend

