# 🔧 دليل إعداد ملف البيئة (.env)

## 📋 الخطوات السريعة

### 1️⃣ نسخ ملف البيئة
```bash
# انسخ الملف من المثال
cp .env.example .env

# أو للتطوير المحلي
cp .env.development .env
```

### 2️⃣ تعديل المتغيرات الأساسية
افتح ملف `.env` وعدّل هذه القيم:

---

## 🗄️ **قاعدة البيانات (حرجة! ضرورية)**

### إذا كنت تستخدم XAMPP:
```env
DATABASE_URL="mysql://root:@localhost:3306/barber_platform"
```

### إذا كان لديك كلمة مرور:
```env
DATABASE_URL="mysql://root:your_password@localhost:3306/barber_platform"
```

### في Docker:
```env
DATABASE_URL="mysql://root:password@mysql:3306/barber_platform"
```

**⚠️ ملاحظة مهمة:**
- تأكد من إنشاء قاعدة البيانات `barber_platform` في phpMyAdmin أولاً!

---

## 🔐 **JWT Secret (حرجة جداً!)**

### توليد مفتاح قوي:
```bash
# استخدم هذا الأمر لتوليد مفتاح آمن
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

ثم ضعه في `.env`:
```env
JWT_SECRET=المفتاح_الذي_تم_توليده_هنا
```

**⚠️ مهم جداً:**
- لا تستخدم المفتاح الافتراضي في الإنتاج!
- احفظ المفتاح في مكان آمن

---

## 📧 **إعداد البريد الإلكتروني (اختياري للتطوير)**

### للتطوير المحلي:
يمكنك تركها فارغة، سيتم طباعة الإيميلات في Console

### لاستخدام Gmail:

#### الخطوة 1: تفعيل 2-Step Verification
1. اذهب إلى [Google Account](https://myaccount.google.com/)
2. Security → 2-Step Verification
3. فعّل 2-Step Verification

#### الخطوة 2: إنشاء App Password
1. في نفس الصفحة: App passwords
2. اختر "Other" وأدخل "Barber Platform"
3. انسخ الـ password (16 حرف)

#### الخطوة 3: التكوين
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

---

## 💳 **إعداد Stripe (اختياري)**

### الخطوة 1: إنشاء حساب
1. اذهب إلى [Stripe Dashboard](https://dashboard.stripe.com/)
2. سجل حساب جديد

### الخطوة 2: الحصول على API Keys
1. اذهب إلى Developers → API keys
2. انسخ "Secret key" و "Publishable key"

### الخطوة 3: التكوين
```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

**💡 نصيحة:** استخدم Test keys أثناء التطوير

---

## 🔥 **إعداد Firebase (اختياري)**

### الخطوة 1: إنشاء مشروع
1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. أنشئ مشروع جديد

### الخطوة 2: Service Account
1. Project Settings → Service Accounts
2. Generate New Private Key
3. حمّل ملف JSON

### الخطوة 3: التكوين
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

---

## 🗺️ **Google Maps API (اختياري)**

### الخطوة 1: تفعيل API
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Enable APIs
3. ابحث عن "Maps JavaScript API" وفعّله

### الخطوة 2: إنشاء API Key
1. Credentials → Create Credentials → API Key
2. انسخ المفتاح

### الخطوة 3: التكوين
```env
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

---

## ✅ **التحقق من صحة الإعداد**

### 1. تشغيل Prisma
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 2. تشغيل المشروع
```bash
npm run start:dev
```

### 3. التحقق
إذا ظهرت هذه الرسائل، كل شيء يعمل! ✅
```
🚀 Application is running on:
   - Local: http://localhost:3000
📚 API Documentation: http://localhost:3000/api/docs
```

---

## ⚠️ **أخطاء شائعة وحلولها**

### خطأ: Can't connect to MySQL
```
Error: Can't connect to MySQL server
```
**الحل:**
1. تأكد من تشغيل MySQL في XAMPP
2. تأكد من صحة DATABASE_URL
3. تأكد من إنشاء قاعدة البيانات

### خطأ: JWT must be provided
```
Error: JWT_SECRET must be provided
```
**الحل:**
- تأكد من وجود JWT_SECRET في .env
- أعد تشغيل المشروع

### خطأ: Cannot find module
```
Error: Cannot find module @prisma/client
```
**الحل:**
```bash
npx prisma generate
npm install
```

---

## 🔒 **أمان الملف**

### ⚠️ لا تنسى!
- ✅ ملف `.env` موجود في `.gitignore`
- ❌ لا تشارك ملف `.env` مع أحد
- ❌ لا ترفع `.env` على GitHub
- ✅ استخدم `.env.example` للتوثيق فقط

### للإنتاج:
- استخدم متغيرات البيئة من hosting provider
- لا تضع secrets في الكود
- استخدم مفاتيح قوية

---

## 📝 **قائمة التحقق**

قبل بدء التطوير، تأكد من:

- [ ] نسخت `.env.example` إلى `.env`
- [ ] عدّلت `DATABASE_URL`
- [ ] أنشأت قاعدة البيانات في phpMyAdmin
- [ ] أضفت `JWT_SECRET` قوي
- [ ] (اختياري) أضفت إعدادات SMTP
- [ ] شغلت `npx prisma generate`
- [ ] شغلت `npx prisma migrate dev`
- [ ] شغلت `npm run start:dev`
- [ ] فتحت http://localhost:3000/api/docs

---

## 🆘 **المساعدة**

إذا واجهت مشاكل:
1. راجع الأخطاء الشائعة أعلاه
2. تأكد من تشغيل MySQL
3. تأكد من صحة جميع المتغيرات
4. أعد تشغيل المشروع

---

**🎉 مبروك! أنت الآن جاهز للتطوير!**

