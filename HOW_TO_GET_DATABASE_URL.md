# 🔗 كيفية الحصول على DATABASE_URL من Render

## 📍 الخطوات التفصيلية

### الخطوة 1: إنشاء قاعدة بيانات PostgreSQL على Render

1. سجل دخول إلى [Render Dashboard](https://dashboard.render.com)
2. اضغط على **"New +"** في أعلى الصفحة
3. اختر **"PostgreSQL"** من القائمة

### الخطوة 2: إعداد قاعدة البيانات

املأ البيانات التالية:

- **Name**: `barber-platform-db` (أو أي اسم تريده)
- **Database**: `barber_platform` (أو اتركه افتراضي)
- **User**: اتركه افتراضي (سيتم إنشاؤه تلقائياً)
- **Region**: اختر الأقرب إليك (مثلاً: Frankfurt, Singapore, أو Oregon)
- **PostgreSQL Version**: اختر الأحدث (عادة 15 أو 16)
- **Plan**: اختر **Free** (للتجربة) أو **Starter** (للإنتاج)

4. اضغط **"Create Database"**

### الخطوة 3: الحصول على DATABASE_URL

بعد إنشاء قاعدة البيانات (قد يستغرق دقيقة أو دقيقتين):

1. **اضغط على اسم قاعدة البيانات** من القائمة (مثلاً: `barber-platform-db`)

2. **ستجد قسم "Connections"** في الصفحة

3. **ابحث عن أحد الخيارات التالية:**
   - **"Internal Database URL"** (موصى به للخدمات على Render)
   - **"External Database URL"** (للوصول من خارج Render)

4. **انسخ الرابط** - سيبدو هكذا:
   ```
   postgresql://user:password@dpg-xxxxx-a.frankfurt-postgres.render.com:5432/database_name
   ```

### الخطوة 4: استخدام DATABASE_URL

#### أ) في Render Environment Variables:

1. اذهب إلى **Web Service** الخاص بك (مثلاً: `barber-platform-backend`)
2. اضغط على **"Environment"** من القائمة الجانبية
3. اضغط **"Add Environment Variable"**
4. أضف:
   - **Key**: `DATABASE_URL`
   - **Value**: الصق الرابط الذي نسخته
5. اضغط **"Save Changes"**

#### ب) إذا كنت تستخدم Internal Database URL:

**استخدم Internal Database URL** إذا كان Web Service وقاعدة البيانات على نفس الحساب في Render.

**مثال:**
```
postgresql://user:password@dpg-xxxxx-a.frankfurt-postgres.render.com:5432/database_name
```

#### ج) إذا كنت تستخدم External Database URL:

**استخدم External Database URL** إذا كنت تريد الوصول من خارج Render (مثلاً: من جهازك المحلي).

**مثال:**
```
postgresql://user:password@dpg-xxxxx-a.frankfurt-postgres.render.com:5432/database_name?sslmode=require
```

**⚠️ ملاحظة:** أضف `?sslmode=require` في النهاية للاتصال الآمن.

---

## 🔍 أين تجد DATABASE_URL في Render Dashboard؟

### الطريقة 1: من صفحة قاعدة البيانات

1. اذهب إلى **Dashboard** → **Databases**
2. اضغط على قاعدة البيانات الخاصة بك
3. في الصفحة، ستجد قسم **"Connections"**
4. انسخ **Internal Database URL** أو **External Database URL**

### الطريقة 2: من صفحة Web Service

1. اذهب إلى **Dashboard** → **Services**
2. اضغط على Web Service الخاص بك
3. اضغط على **"Environment"** من القائمة الجانبية
4. إذا كان `DATABASE_URL` موجود، ستجده في القائمة
5. إذا لم يكن موجود، أضفه كما هو موضح أعلاه

---

## 📝 مثال على DATABASE_URL

### Internal Database URL (للخدمات على Render):
```
postgresql://barber_user:abc123xyz@dpg-abc123def456-a.frankfurt-postgres.render.com:5432/barber_platform
```

### External Database URL (للوصول من خارج Render):
```
postgresql://barber_user:abc123xyz@dpg-abc123def456-a.frankfurt-postgres.render.com:5432/barber_platform?sslmode=require
```

---

## ⚠️ ملاحظات مهمة

1. **احفظ DATABASE_URL في مكان آمن** - لا تشاركه مع أحد
2. **استخدم Internal Database URL** للخدمات على Render (أسرع وأكثر أماناً)
3. **استخدم External Database URL** فقط إذا كنت تحتاج الوصول من خارج Render
4. **أضف `?sslmode=require`** إذا كنت تستخدم External Database URL

---

## 🔄 تحديث DATABASE_URL

إذا أردت تحديث `DATABASE_URL`:

1. اذهب إلى Web Service → **Environment**
2. ابحث عن `DATABASE_URL`
3. اضغط على **"Edit"** (أو أيقونة القلم)
4. غيّر القيمة
5. اضغط **"Save Changes"**
6. **أعد تشغيل Service** (Render سيفعل هذا تلقائياً)

---

## ✅ التحقق من DATABASE_URL

بعد إضافة `DATABASE_URL`:

1. اذهب إلى **Logs** في Web Service
2. ابحث عن رسائل مثل:
   - `Prisma Client generated successfully`
   - `All migrations have been applied`
   - `Connected to database`

إذا رأيت أخطاء متعلقة بقاعدة البيانات، تحقق من:
- ✅ `DATABASE_URL` صحيح
- ✅ قاعدة البيانات نشطة (Status: Available)
- ✅ أضفت `?sslmode=require` إذا كنت تستخدم External URL

---

## 🆘 حل المشاكل

### المشكلة: "Connection refused"
**الحل:** تأكد من استخدام **Internal Database URL** إذا كان Web Service على Render

### المشكلة: "SSL required"
**الحل:** أضف `?sslmode=require` في نهاية `DATABASE_URL`

### المشكلة: "Authentication failed"
**الحل:** تحقق من أن `DATABASE_URL` صحيح وأن قاعدة البيانات نشطة

---

**🎉 الآن أنت تعرف كيفية الحصول على DATABASE_URL من Render!**

