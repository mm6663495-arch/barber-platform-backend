# اختبار تغيير كلمة المرور - دليل شامل

## 1. اختبار مباشر باستخدام curl

```bash
# الحصول على token أولاً
curl -X POST http://192.168.119.47:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@salon.com",
    "password": "owner123"
  }'

# استخدام الـ token لتغيير كلمة المرور
curl -X POST http://192.168.119.47:3000/api/v1/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "currentPassword": "owner123",
    "newPassword": "newpassword123"
  }'
```

## 2. التحقق من الـ Endpoint

**Backend:**
- Controller: `@Controller('auth')` في `auth.controller.ts`
- Method: `@Post('change-password')`
- Full path: `/api/v1/auth/change-password` (بسبب `setGlobalPrefix('api/v1')`)

**Frontend:**
- Base URL: `http://192.168.119.47:3000`
- API Version: `/api/v1`
- Path: `/auth/change-password`
- Full URL: `http://192.168.119.47:3000/api/v1/auth/change-password` ✅

## 3. التحقق من الـ Request Body

**المطلوب من الـ Backend (ChangePasswordDto):**
```typescript
{
  currentPassword: string;  // @IsString() @MinLength(6)
  newPassword: string;      // @IsString() @MinLength(6)
}
```

**ما يرسله الـ Frontend:**
```dart
{
  'currentPassword': currentPassword,
  'newPassword': newPassword,
}
```

✅ الأسماء متطابقة!

## 4. التحقق من الـ Response

**ما يرسله الـ Backend:**
```typescript
{
  success: true,
  message: 'Password changed successfully'
}
```

**ما يتوقعه الـ Frontend:**
- يتحقق من `response['success']` و `response['message']`
- إذا كان `success == true` أو `message` يحتوي على "success" → يعتبره نجاح

✅ متوافق!

## 5. خطوات التشخيص

### الخطوة 1: التحقق من الـ Backend Logs
عند محاولة تغيير كلمة المرور، يجب أن ترى:
```
[AuthController] Change password endpoint called
[AuthController] User ID from token: <user_id>
[AuthController] Request body: {...}
[Auth] ========================================
[Auth] Change password request received
...
[Auth] ✅ Password changed successfully for user: <email>
[AuthController] Change password result: { success: true, message: '...' }
```

### الخطوة 2: التحقق من الـ Frontend Logs
```
[SecuritySettingsScreen] Starting password change...
[UserSettingsProvider] changePassword called
[UserSettingsService] Making POST request to /auth/change-password
[API CLIENT] POST /auth/change-password
[API REQUEST] POST http://192.168.119.47:3000/api/v1/auth/change-password
[API RESPONSE] POST /auth/change-password
[API RESPONSE] Status: 200
[UserSettingsService] Response received!
[UserSettingsService] Response: {success: true, message: ...}
[UserSettingsService] ✅ Password changed successfully!
```

### الخطوة 3: التحقق من قاعدة البيانات
```bash
cd barber-platform-backend
node verify-user.js owner@salon.com newpassword123
```

## 6. المشاكل الشائعة والحلول

### المشكلة 1: لا تظهر أي logs في الـ Backend
**السبب:** الطلب لا يصل إلى الـ Backend
**الحل:**
- تحقق من أن الـ Backend يعمل
- تحقق من الـ IP address
- تحقق من الـ network connection

### المشكلة 2: خطأ 401 Unauthorized
**السبب:** الـ token غير صحيح أو منتهي الصلاحية
**الحل:**
- سجل دخول مرة أخرى للحصول على token جديد
- تحقق من أن الـ token يتم إرساله في الـ Authorization header

### المشكلة 3: خطأ 400 Bad Request
**السبب:** البيانات المرسلة غير صحيحة
**الحل:**
- تحقق من أن `currentPassword` و `newPassword` موجودين
- تحقق من أن كلمة المرور الحالية صحيحة
- تحقق من أن كلمة المرور الجديدة 6 أحرف على الأقل

### المشكلة 4: الـ Response لا يحتوي على success
**السبب:** الـ Backend يرسل response مختلف
**الحل:**
- تحقق من الـ Backend logs
- تحقق من أن الـ response يحتوي على `success` و `message`

## 7. اختبار سريع

```bash
# 1. تحقق من المستخدم
node verify-user.js owner@salon.com owner123

# 2. غير كلمة المرور مباشرة في قاعدة البيانات (للاختبار)
node test-change-password.js

# 3. تحقق من كلمة المرور الجديدة
node verify-user.js owner@salon.com newpassword123
```

