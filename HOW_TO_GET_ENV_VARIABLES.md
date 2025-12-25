# 🔍 كيفية معرفة والحصول على قيم Environment Variables

## 📋 نظرة عامة

هذا الدليل يوضح كيفية الحصول على قيم جميع المتغيرات المطلوبة لنشر الباك اند على Render.

---

## 1️⃣ DATABASE_URL (من Render)

### الخطوات:

1. **اذهب إلى Render Dashboard**
   - سجل دخول إلى [dashboard.render.com](https://dashboard.render.com)

2. **افتح قاعدة البيانات**
   - اضغط على قاعدة البيانات التي أنشأتها (مثلاً: `barber-platform-db`)

3. **انسخ Internal Database URL**
   - في صفحة قاعدة البيانات، ابحث عن قسم **"Connections"** أو **"Database Info"**
   - ستجد **"Internal Database URL"** - انسخه
   - سيبدو هكذا:
     ```
     postgresql://user:password@dpg-xxxxx-a.frankfurt-postgres.render.com/barber_platform
     ```

4. **استخدمه في Environment Variables**
   ```
   NAME_OF_VARIABLE: DATABASE_URL
   value: postgresql://user:password@dpg-xxxxx-a.frankfurt-postgres.render.com/barber_platform
   ```

**⚠️ مهم:** استخدم **Internal Database URL** وليس External (لأنه أسرع وأكثر أماناً)

---

## 2️⃣ JWT_SECRET (توليد مفتاح جديد)

### الطريقة 1: استخدام Node.js (الأفضل)

افتح Terminal في مجلد المشروع ونفّذ:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**مثال على الناتج:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2
```

**انسخ هذا المفتاح واستخدمه:**
```
NAME_OF_VARIABLE: JWT_SECRET
value: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2
```

### الطريقة 2: استخدام موقع Online

اذهب إلى: [https://generate-secret.vercel.app/64](https://generate-secret.vercel.app/64)

### الطريقة 3: استخدام مفتاح مؤقت (للتجربة فقط)

```
NAME_OF_VARIABLE: JWT_SECRET
value: your-super-secret-jwt-key-change-this-in-production-min-64-chars-please
```

**⚠️ تحذير:** في الإنتاج، استخدم مفتاح قوي تم توليده!

---

## 3️⃣ NODE_ENV (قيمة ثابتة)

```
NAME_OF_VARIABLE: NODE_ENV
value: production
```

**لا حاجة لتوليده - فقط اكتب `production`**

---

## 4️⃣ PORT (قيمة ثابتة)

```
NAME_OF_VARIABLE: PORT
value: 10000
```

**Render يستخدم المنفذ 10000 تلقائياً**

---

## 5️⃣ JWT_EXPIRES_IN (قيمة ثابتة)

```
NAME_OF_VARIABLE: JWT_EXPIRES_IN
value: 7d
```

**يعني: 7 أيام (يمكنك تغييره إلى 30d أو 1d حسب رغبتك)**

---

## 🔍 كيفية معرفة المتغيرات من ملف .env المحلي

إذا كان لديك ملف `.env` محلياً، يمكنك رؤية القيم:

### الطريقة 1: فتح الملف مباشرة

1. اذهب إلى مجلد المشروع: `barber-platform-backend`
2. ابحث عن ملف `.env`
3. افتحه بمحرر النصوص
4. ستجد جميع المتغيرات مع قيمها

**⚠️ تحذير:** لا ترفع ملف `.env` على GitHub!

### الطريقة 2: استخدام Terminal

```bash
# في مجلد المشروع
cd barber-platform-backend

# عرض محتوى ملف .env (إذا كان موجوداً)
cat .env

# أو في Windows PowerShell
Get-Content .env
```

---

## 📝 مثال على ملف .env المحلي

إذا كان لديك ملف `.env` محلياً، سيبدو هكذا:

```env
DATABASE_URL="mysql://root:@localhost:3306/barber_platform"
JWT_SECRET="your-local-secret-key"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=3000
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

**ملاحظة:** قيم الإنتاج على Render قد تختلف عن القيم المحلية!

---

## 🎯 قائمة سريعة: ما الذي تحتاجه من أين؟

| المتغير | من أين تحصل عليه |
|---------|-----------------|
| `DATABASE_URL` | Render Dashboard → Database → Internal Database URL |
| `JWT_SECRET` | توليده باستخدام Node.js (انظر أعلاه) |
| `NODE_ENV` | اكتب: `production` |
| `PORT` | اكتب: `10000` |
| `JWT_EXPIRES_IN` | اكتب: `7d` |

---

## 🔐 المتغيرات الاختيارية (إذا كنت تستخدمها)

### SMTP (البريد الإلكتروني)

إذا كنت تستخدم Gmail:

1. **SMTP_HOST**: `smtp.gmail.com` (ثابت)
2. **SMTP_PORT**: `587` (ثابت)
3. **SMTP_USER**: بريدك الإلكتروني (مثلاً: `your-email@gmail.com`)
4. **SMTP_PASS**: App Password من Google
   - اذهب إلى [Google Account](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - أنشئ App Password جديد

### Stripe (المدفوعات)

1. اذهب إلى [Stripe Dashboard](https://dashboard.stripe.com/)
2. Developers → API keys
3. انسخ **Secret key** و **Publishable key**

### PayPal

1. اذهب إلى [PayPal Developer](https://developer.paypal.com/)
2. Dashboard → My Apps & Credentials
3. انسخ **Client ID** و **Secret**

### Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → Service Accounts
3. Generate New Private Key
4. حمّل ملف JSON واستخرج القيم

### Google Maps

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Create Credentials → API Key
4. انسخ المفتاح

---

## ✅ خطوات سريعة

### للحصول على DATABASE_URL:

1. Render Dashboard → Databases
2. اضغط على قاعدة البيانات
3. انسخ **Internal Database URL**

### لتوليد JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### للقيم الثابتة:

- `NODE_ENV` = `production`
- `PORT` = `10000`
- `JWT_EXPIRES_IN` = `7d`

---

## 🆘 إذا لم تجد DATABASE_URL

### تأكد من:

1. ✅ أنشأت قاعدة بيانات على Render
2. ✅ قاعدة البيانات في حالة "Available" (نشطة)
3. ✅ أنت في صفحة قاعدة البيانات الصحيحة
4. ✅ تبحث عن **"Internal Database URL"** وليس External

### إذا لم تكن أنشأت قاعدة بيانات بعد:

1. اذهب إلى Render Dashboard
2. اضغط **"New +"** → **"PostgreSQL"**
3. املأ البيانات وأنشئها
4. ثم انسخ Internal Database URL

---

## 📚 ملاحظات إضافية

- **DATABASE_URL**: يجب أن يبدأ بـ `postgresql://` (وليس `mysql://`)
- **JWT_SECRET**: يجب أن يكون 64 حرف على الأقل
- **NODE_ENV**: في الإنتاج دائماً `production`
- **PORT**: Render يستخدم `10000` تلقائياً، لكن يمكنك تحديده

---

**🎉 الآن أنت تعرف كيفية الحصول على جميع القيم!**

**ابدأ بـ DATABASE_URL من Render، ثم JWT_SECRET، والباقي قيم ثابتة.**

