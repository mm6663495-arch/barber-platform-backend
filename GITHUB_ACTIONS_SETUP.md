# إعداد GitHub Actions - حل مشكلة DATABASE_URL

## المشكلة
```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Error validating datasource `db`: You must provide a nonempty URL. 
The environment variable `DATABASE_URL` resolved to an empty string.
```

## الحل: إضافة Secrets في GitHub

### الخطوة 1: إضافة DATABASE_URL كـ Secret

1. اذهب إلى مستودعك على GitHub:
   ```
   https://github.com/mm6663495-arch/barber-platform-backend
   ```

2. اضغط على **Settings** (الإعدادات)

3. من القائمة الجانبية، اضغط على **Secrets and variables** → **Actions**

4. اضغط على **New repository secret**

5. أضف الـ Secret:
   - **Name**: `DATABASE_URL`
   - **Value**: رابط قاعدة البيانات الخاص بك
   
   مثال لـ MySQL:
   ```
   mysql://username:password@host:port/database_name
   ```
   
   مثال لـ PostgreSQL:
   ```
   postgresql://username:password@host:port/database_name
   ```

6. اضغط **Add secret**

### الخطوة 2: إضافة Secrets أخرى (اختياري)

إذا كان مشروعك يحتاج متغيرات بيئة أخرى، أضفها بنفس الطريقة:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `STRIPE_SECRET_KEY`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
- `GOOGLE_MAPS_API_KEY`
- أي متغيرات بيئة أخرى يحتاجها مشروعك

### الخطوة 3: التحقق من ملف Workflow

تم إنشاء ملف `.github/workflows/deploy.yml` في المشروع.

**ملاحظة مهمة:**
- تأكد من أن ملف `.github/workflows/deploy.yml` موجود في المشروع
- إذا لم يكن موجوداً، أنشئه بنفس المحتوى الموجود في الملف

### الخطوة 4: رفع التغييرات

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow"
git push
```

### الخطوة 5: التحقق من النتيجة

1. اذهب إلى تبويب **Actions** في مستودع GitHub
2. ستجد workflow جديد يعمل
3. اضغط عليه لرؤية النتائج

## هيكل ملف Workflow

الملف `.github/workflows/deploy.yml` يحتوي على:

```yaml
- Checkout code: جلب الكود
- Setup Node.js: إعداد Node.js
- Install dependencies: تثبيت الحزم
- Generate Prisma Client: توليد Prisma Client
- Run Prisma Migrations: تشغيل Migrations
- Build: بناء المشروع
```

## استكشاف الأخطاء

### إذا استمر الخطأ:

1. **تحقق من اسم Secret:**
   - يجب أن يكون بالضبط: `DATABASE_URL`
   - حساس لحالة الأحرف (Case-sensitive)

2. **تحقق من قيمة DATABASE_URL:**
   - تأكد من أن الرابط صحيح
   - تأكد من أن قاعدة البيانات متاحة من الإنترنت (إذا كانت محلية، استخدم tunnel)

3. **تحقق من Workflow:**
   - اذهب إلى Actions → اختر Workflow → اضغط على Run
   - اقرأ الأخطاء بعناية

4. **تحقق من الصلاحيات:**
   - تأكد من أن المستخدم لديه صلاحيات للوصول إلى قاعدة البيانات

## مثال على DATABASE_URL

### MySQL (XAMPP محلي مع ngrok):
```
mysql://root:@localhost:3306/barber_platform
```

### MySQL (خدمة سحابية):
```
mysql://user:password@db.example.com:3306/barber_platform
```

### PostgreSQL:
```
postgresql://user:password@db.example.com:5432/barber_platform
```

## نصائح إضافية

⚠️ **أمان:**
- لا تضع DATABASE_URL في الكود مباشرة
- استخدم دائماً Secrets للمعلومات الحساسة
- لا تشارك Secrets مع أحد

✅ **أفضل الممارسات:**
- استخدم قاعدة بيانات منفصلة للاختبار (Test Database)
- استخدم قاعدة بيانات منفصلة للإنتاج (Production Database)
- راجع Secrets بانتظام واحذف ما لا تحتاجه

