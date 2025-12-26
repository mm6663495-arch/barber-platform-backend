
# 🚀 دليل شامل لنشر الباك اند على Render للمبتدئين

## 📋 نظرة عامة

هذا الدليل سيرشدك خطوة بخطوة لنشر الباك اند الخاص بك على Render بشكل كامل ومفصل.

---

## 🎯 المتطلبات الأساسية

قبل البدء، تأكد من أن لديك:

- ✅ حساب على [Render.com](https://render.com) (مجاني)
- ✅ حساب على GitHub (لرفع الكود)
- ✅ حساب قاعدة بيانات (يمكن استخدام Render PostgreSQL أو MySQL خارجي)
- ✅ معرفة أساسية بـ Git

---

## 📝 الخطوة 1: إعداد المشروع للرفع على GitHub

### 1.1 إنشاء مستودع جديد على GitHub

1. اذهب إلى [GitHub.com](https://github.com)
2. اضغط على **"New repository"** (أو **"+"** → **"New repository"**)
3. أدخل اسم المستودع (مثلاً: `barber-platform-backend`)
4. اختر **Public** أو **Private** حسب رغبتك
5. **لا** تضع علامة على "Initialize with README"
6. اضغط **"Create repository"**

### 1.2 رفع الكود إلى GitHub

افتح Terminal في مجلد المشروع (`barber-platform-backend`) وقم بتنفيذ:

```bash
# تهيئة Git (إذا لم تكن مهيأ مسبقاً)
git init

# إضافة جميع الملفات
git add .

# عمل commit أولي
git commit -m "Initial commit: Backend ready for Render deployment"

# إضافة remote repository (استبدل YOUR_USERNAME و YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# رفع الكود
git branch -M main
git push -u origin main
```

**⚠️ ملاحظة مهمة:** تأكد من وجود ملف `.gitignore` يحتوي على:
```
node_modules/
.env
.env.local
dist/
logs/
*.log
.DS_Store
uploads/
```

---

## 🗄️ الخطوة 2: إنشاء قاعدة بيانات على Render

### 2.1 إنشاء PostgreSQL Database

1. سجل دخول إلى [Render Dashboard](https://dashboard.render.com)
2. اضغط على **"New +"** → **"PostgreSQL"**
3. املأ البيانات:
   - **Name**: `barber-platform-db` (أو أي اسم تريده)
   - **Database**: `barber_platform` (أو اتركه افتراضي)
   - **User**: اتركه افتراضي
   - **Region**: اختر الأقرب إليك (مثلاً: Frankfurt)
   - **PostgreSQL Version**: اختر الأحدث
   - **Plan**: اختر **Free** (للتجربة)
4. اضغط **"Create Database"**

### 2.2 نسخ معلومات الاتصال

بعد إنشاء قاعدة البيانات:

1. اضغط على قاعدة البيانات من القائمة
2. ابحث عن **"Internal Database URL"** أو **"External Database URL"**
3. انسخ الرابط (سيبدو هكذا):
   ```
   postgresql://user:password@host:5432/database_name
   ```

**⚠️ مهم:** احفظ هذا الرابط في مكان آمن، ستحتاجه لاحقاً!

---

## 🔧 الخطوة 3: إعداد المشروع للعمل مع PostgreSQL

### 3.1 تحديث Prisma Schema

افتح ملف `prisma/schema.prisma` وغير السطر:

```prisma
datasource db {
  provider = "postgresql"  // غير من "mysql" إلى "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3.2 تحديث package.json

تأكد من أن `package.json` يحتوي على script للـ build:

```json
{
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main",
    "postinstall": "prisma generate"
  }
}
```

---

## 🚀 الخطوة 4: إنشاء Web Service على Render

### 4.1 إنشاء Service جديد

1. في Render Dashboard، اضغط **"New +"** → **"Web Service"**
2. اختر **"Connect GitHub"** (أو **"Connect GitLab"**)
3. سجّل دخول إلى GitHub واختر المستودع الذي أنشأته
4. املأ البيانات:

#### Basic Settings:
- **Name**: `barber-platform-backend`
- **Region**: اختر الأقرب إليك
- **Branch**: `main` (أو `master`)
- **Root Directory**: ⚠️ **يجب أن يكون فارغاً تماماً** (لا تضع أي قيمة هنا!)
- **Runtime**: `Node`
- **Build Command**: `npm install --legacy-peer-deps && npx prisma generate && npm run build`
  
  **⚠️ مهم:** استخدم `npm run build` وليس `npx nest build` مباشرة!
- **Start Command**: `npx prisma db push && npm run start:prod`

#### Advanced Settings:
- **Environment**: `Node`
- **Node Version**: `20` (أو أحدث)

### 4.2 إضافة Environment Variables

في نفس صفحة الإعداد، ابحث عن قسم **"Environment Variables"** وأضف:

#### متغيرات أساسية (مطلوبة):

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database_name
# (استخدم الرابط الذي نسخته من قاعدة البيانات)

# JWT
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars
JWT_EXPIRES_IN=7d

# Server
NODE_ENV=production
PORT=10000
```

#### متغيرات اختيارية (لكن موصى بها):

```env
# Email (لإرسال الإيميلات)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Stripe (للمدفوعات)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# PayPal (للمدفوعات)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=live

# Firebase (للإشعارات)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

**💡 نصيحة:** لتوليد `JWT_SECRET` قوي، استخدم:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4.3 حفظ والإطلاق

1. اضغط **"Create Web Service"**
2. Render سيبدأ ببناء المشروع تلقائياً
3. انتظر حتى يكتمل البناء (قد يستغرق 5-10 دقائق)

---

## 🔄 الخطوة 5: تشغيل Migrations

بعد نجاح البناء، يجب تشغيل migrations لقاعدة البيانات:

### الطريقة 1: عبر Render Shell

1. في صفحة Web Service، اضغط على **"Shell"** (في القائمة الجانبية)
2. نفّذ الأوامر التالية:

```bash
npx prisma migrate deploy
npx prisma generate
```

### الطريقة 2: عبر Environment Variables

أضف في Environment Variables:

```env
POSTINSTALL_CMD=npx prisma migrate deploy
```

---

## ✅ الخطوة 6: التحقق من النشر

### 6.1 فحص Logs

1. في صفحة Web Service، اضغط على **"Logs"**
2. ابحث عن رسالة:
   ```
   🚀 Barber Platform Backend Started!
   📍 Local: http://localhost:10000
   ```

### 6.2 اختبار API

افتح المتصفح واذهب إلى:
```
https://your-service-name.onrender.com/api/docs
```

يجب أن ترى صفحة Swagger API Documentation.

### 6.3 اختبار Health Check

افتح:
```
https://your-service-name.onrender.com/health
```

يجب أن ترى رسالة `OK` أو `{"status":"ok"}`.

---

## 🔧 الخطوة 7: إعدادات إضافية مهمة

### 7.1 إضافة Health Check Endpoint

تأكد من وجود endpoint للـ health check في `src/app.controller.ts`:

```typescript
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

### 7.2 تحديث CORS

في `src/main.ts`، تأكد من إعداد CORS بشكل صحيح:

```typescript
app.enableCors({
  origin: [
    'https://your-frontend-domain.com',
    'http://localhost:3000', // للتطوير المحلي
  ],
  credentials: true,
});
```

### 7.3 إعداد Static Files

Render يدعم static files، لكن تأكد من أن المسارات صحيحة في `main.ts`.

---

## 🐛 حل المشاكل الشائعة

### مشكلة: Build فشل

**الأسباب المحتملة:**
- خطأ في `package.json`
- مشكلة في dependencies
- خطأ في TypeScript

**الحل:**
1. راجع Logs في Render
2. اختبر البناء محلياً: `npm run build`
3. تأكد من تحديث جميع dependencies

### مشكلة: Database Connection Failed

**الأسباب المحتملة:**
- `DATABASE_URL` غير صحيح
- قاعدة البيانات غير نشطة
- مشكلة في SSL

**الحل:**
1. تحقق من `DATABASE_URL` في Environment Variables
2. تأكد من أن قاعدة البيانات نشطة في Render
3. أضف `?sslmode=require` في نهاية `DATABASE_URL` إذا لزم الأمر

### مشكلة: Service يتوقف بعد بضع دقائق

**السبب:** في الخطة المجانية، Render يوقف الخدمات غير النشطة بعد 15 دقيقة.

**الحل:**
- استخدم خدمة مثل [UptimeRobot](https://uptimerobot.com) لإرسال ping كل 5 دقائق
- أو ترقية إلى خطة مدفوعة

### مشكلة: Prisma Client not found

**الحل:**
أضف في `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

---

## 📊 الخطوة 8: مراقبة الأداء

### 8.1 استخدام Render Logs

- **Logs**: عرض جميع السجلات في الوقت الفعلي
- **Metrics**: مراقبة استخدام CPU والذاكرة
- **Events**: عرض أحداث النشر والتحديثات

### 8.2 إضافة Monitoring

يمكنك إضافة:
- **Sentry**: لتتبع الأخطاء
- **LogRocket**: لتسجيل الجلسات
- **New Relic**: لمراقبة الأداء

---

## 🔒 الأمان

### 1. Environment Variables
- ✅ لا تضع secrets في الكود
- ✅ استخدم Environment Variables دائماً
- ✅ راجع `.gitignore` للتأكد من عدم رفع `.env`

### 2. Database
- ✅ استخدم SSL للاتصال بقاعدة البيانات
- ✅ لا تشارك `DATABASE_URL` مع أحد

### 3. API
- ✅ استخدم HTTPS دائماً
- ✅ فعّل Rate Limiting
- ✅ استخدم JWT بشكل صحيح

---

## 📝 قائمة التحقق النهائية

قبل اعتبار النشر مكتملاً، تأكد من:

- [ ] الكود مرفوع على GitHub
- [ ] قاعدة البيانات منشأة على Render
- [ ] Web Service منشأ ويعمل
- [ ] جميع Environment Variables مضافة
- [ ] Migrations تم تشغيلها
- [ ] Health check يعمل
- [ ] API Documentation متاحة
- [ ] CORS معد بشكل صحيح
- [ ] Logs لا تظهر أخطاء

---

## 🎉 مبروك!

إذا وصلت إلى هنا، فقد نجحت في نشر الباك اند على Render! 🎊

### الخطوات التالية:

1. **ربط Frontend**: حدّث روابط API في تطبيق Flutter
2. **اختبار شامل**: اختبر جميع الـ endpoints
3. **مراقبة**: راقب Logs و Metrics بانتظام
4. **Backup**: أنشئ نسخ احتياطية لقاعدة البيانات

---

## 🆘 الحصول على المساعدة

إذا واجهت مشاكل:

1. **راجع Logs**: في Render Dashboard → Logs
2. **راجع الوثائق**: [Render Docs](https://render.com/docs)
3. **GitHub Issues**: ابحث عن مشاكل مشابهة
4. **Stack Overflow**: ابحث عن حلول

---

## 📚 موارد إضافية

- [Render Documentation](https://render.com/docs)
- [NestJS Deployment Guide](https://docs.nestjs.com/recipes/deployment)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [PostgreSQL on Render](https://render.com/docs/databases)

---

**تم إنشاء هذا الدليل خصيصاً لمشروع Barber Platform Backend**  
**آخر تحديث: 2024**

