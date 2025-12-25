
# ✅ قائمة التحقق الشاملة لنشر الباك اند على Render

استخدم هذه القائمة للتأكد من إكمال جميع الخطوات بشكل صحيح.

---

## 📋 قبل البدء

- [ ] لديك حساب على [Render.com](https://render.com)
- [ ] لديك حساب على GitHub
- [ ] المشروع يعمل محلياً بدون أخطاء
- [ ] جميع الاختبارات تمر بنجاح

---

## 🔧 إعداد المشروع

### Git & GitHub
- [ ] المشروع مرفوع على GitHub
- [ ] `.gitignore` يحتوي على `.env` و `node_modules/`
- [ ] لا توجد ملفات حساسة في المستودع

### Prisma Schema
- [ ] `provider` في `schema.prisma` مضبوط على `postgresql`
- [ ] جميع Migrations موجودة في `prisma/migrations/`

### Package.json
- [ ] `postinstall` script موجود: `"postinstall": "prisma generate"`
- [ ] `build` script موجود: `"build": "nest build"`
- [ ] `start:prod` script موجود: `"start:prod": "node dist/main"`

---

## 🗄️ قاعدة البيانات على Render

- [ ] قاعدة بيانات PostgreSQL منشأة على Render
- [ ] نسخت **Internal Database URL**
- [ ] قاعدة البيانات نشطة (Status: Available)

---

## 🚀 Web Service على Render

### الإعدادات الأساسية
- [ ] Web Service منشأ على Render
- [ ] متصل بمستودع GitHub الصحيح
- [ ] Branch مضبوط على `main` (أو `master`)
- [ ] Root Directory صحيح (فارغ إذا كان المشروع في الجذر)

### Build & Start Commands
- [ ] **Build Command**: `npm install && npx prisma generate && npm run build`
- [ ] **Start Command**: `npx prisma migrate deploy && npm run start:prod`

### Environment Variables
- [ ] `DATABASE_URL` مضبوط (من Render Database)
- [ ] `JWT_SECRET` موجود وقوي (64 حرف على الأقل)
- [ ] `JWT_EXPIRES_IN` مضبوط (مثلاً: `7d`)
- [ ] `NODE_ENV` مضبوط على `production`
- [ ] `PORT` مضبوط على `10000` (أو اتركه فارغاً)

### Environment Variables الاختيارية
- [ ] `SMTP_HOST` (إذا كنت تستخدم البريد الإلكتروني)
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `STRIPE_SECRET_KEY` (إذا كنت تستخدم Stripe)
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `PAYPAL_CLIENT_ID` (إذا كنت تستخدم PayPal)
- [ ] `PAYPAL_CLIENT_SECRET`
- [ ] `FIREBASE_PROJECT_ID` (إذا كنت تستخدم Firebase)
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `GOOGLE_MAPS_API_KEY` (إذا كنت تستخدم Google Maps)

---

## 🔄 Migrations

- [ ] شغّلت `npx prisma generate` في Render Shell
- [ ] شغّلت `npx prisma migrate deploy` في Render Shell
- [ ] جميع Migrations تم تطبيقها بنجاح
- [ ] لا توجد أخطاء في Logs متعلقة بقاعدة البيانات

---

## ✅ التحقق من النشر

### Health Check
- [ ] `/health` endpoint يعمل
- [ ] يعيد `{"status":"ok"}` أو `OK`

### API Documentation
- [ ] `/api/docs` يعمل (Swagger UI)
- [ ] جميع الـ endpoints ظاهرة

### Logs
- [ ] لا توجد أخطاء في Logs
- [ ] رسالة `🚀 Barber Platform Backend Started!` موجودة
- [ ] Server يستمع على المنفذ الصحيح

### API Testing
- [ ] يمكن الوصول إلى API من خارج Render
- [ ] Authentication يعمل
- [ ] CORS مضبوط بشكل صحيح

---

## 🔒 الأمان

- [ ] جميع Secrets في Environment Variables (وليس في الكود)
- [ ] `JWT_SECRET` قوي وفريد
- [ ] `DATABASE_URL` يستخدم SSL (`?sslmode=require`)
- [ ] CORS مضبوط بشكل صحيح
- [ ] Rate Limiting مفعّل

---

## 📊 المراقبة

- [ ] Logs في Render تعمل
- [ ] Metrics (CPU, Memory) ظاهرة
- [ ] Health Checks تعمل

---

## 🔗 ربط Frontend

- [ ] حدّثت روابط API في تطبيق Flutter
- [ ] CORS يسمح بنطاق Frontend
- [ ] اختبرت الاتصال من Frontend

---

## 🎯 الخطوات التالية

- [ ] أنشأت نسخة احتياطية لقاعدة البيانات
- [ ] أضفت Monitoring (Sentry, LogRocket, etc.)
- [ ] أضفت Uptime Monitoring (UptimeRobot, etc.)
- [ ] وثّقت جميع Environment Variables
- [ ] أضفت Team Members إلى Render (إذا لزم الأمر)

---

## 🆘 في حالة المشاكل

إذا واجهت مشاكل:

1. [ ] راجعت Logs في Render
2. [ ] راجعت Environment Variables
3. [ ] اختبرت البناء محلياً: `npm run build`
4. [ ] تحققت من اتصال قاعدة البيانات
5. [ ] راجعت [RENDER_DEPLOYMENT_GUIDE_AR.md](./RENDER_DEPLOYMENT_GUIDE_AR.md)

---

## 📝 ملاحظات إضافية

اكتب هنا أي ملاحظات أو مشاكل واجهتها:

```
_________________________________________________
_________________________________________________
_________________________________________________
```

---

**🎉 إذا أكملت جميع العناصر أعلاه، فمبروك! الباك اند الآن يعمل على Render!**

---

**تاريخ الإكمال:** _______________

**رابط الخدمة:** https://________________.onrender.com

**رابط قاعدة البيانات:** Render Dashboard → Databases

