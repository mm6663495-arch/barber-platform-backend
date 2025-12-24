# ⚡ دليل سريع لنشر الباك اند على Render

## 🎯 الخطوات السريعة (5 دقائق)

### 1️⃣ رفع الكود على GitHub
```bash
git init
git add .
git commit -m "Ready for Render"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2️⃣ إنشاء قاعدة بيانات على Render
1. اذهب إلى [Render Dashboard](https://dashboard.render.com)
2. **New +** → **PostgreSQL**
3. اختر **Free Plan**
4. اضغط **Create Database**
5. انسخ **Internal Database URL**

### 3️⃣ إنشاء Web Service
1. **New +** → **Web Service**
2. اختر مستودع GitHub الخاص بك
3. املأ:
   - **Name**: `barber-platform-backend`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm run start:prod`
4. أضف Environment Variables:
   ```
   DATABASE_URL=postgresql://... (من الخطوة 2)
   JWT_SECRET=your-secret-key-here
   NODE_ENV=production
   PORT=10000
   ```
5. اضغط **Create Web Service**

### 4️⃣ تشغيل Migrations
1. في صفحة Service، اضغط **Shell**
2. نفّذ:
   ```bash
   npx prisma migrate deploy
   ```

### 5️⃣ التحقق
افتح: `https://your-service.onrender.com/api/docs`

---

## ✅ قائمة Environment Variables المطلوبة

### أساسية (مطلوبة):
```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-64-char-secret-key
NODE_ENV=production
PORT=10000
```

### اختيارية:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
STRIPE_SECRET_KEY=sk_live_...
PAYPAL_CLIENT_ID=...
FIREBASE_PROJECT_ID=...
GOOGLE_MAPS_API_KEY=...
```

---

## 🔧 تحديث Prisma Schema

**مهم:** غير في `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // غير من "mysql"
  url      = env("DATABASE_URL")
}
```

---

## 🐛 مشاكل شائعة

### Build فشل؟
- راجع Logs في Render
- اختبر محلياً: `npm run build`

### Database Connection Failed؟
- تحقق من `DATABASE_URL`
- تأكد من استخدام **Internal Database URL**

### Service يتوقف؟
- في الخطة المجانية، Render يوقف الخدمات بعد 15 دقيقة
- استخدم [UptimeRobot](https://uptimerobot.com) لإبقائه نشطاً

---

## 📚 للمزيد من التفاصيل

راجع: [RENDER_DEPLOYMENT_GUIDE_AR.md](./RENDER_DEPLOYMENT_GUIDE_AR.md)

---

**🎉 مبروك! الباك اند الآن على Render!**

