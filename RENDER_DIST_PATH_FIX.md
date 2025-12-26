# 🔧 حل مشكلة مسار dist على Render

## ❌ المشكلة

```
Error: Cannot find module '/opt/render/project/src/dist/main.js'
```

**السبب:** 
- Render يبحث في `src/dist/main.js` 
- لكن `nest build` يبني في `dist/main.js` (في جذر المشروع)
- المسار غير صحيح

---

## ✅ الحل: التحقق من Root Directory في Render

### في Render Dashboard:

1. **Web Service → Settings**
2. **ابحث عن "Root Directory"**
3. **يجب أن يكون فارغاً** (أو إذا كان لديك قيمة، احذفها)
4. **احفظ التغييرات**

---

## 🔍 إذا كان Root Directory صحيحاً

### الحل البديل: استخدام المسار المطلق في Start Command

**في Render Dashboard → Settings → Start Command:**

غيّره إلى:

```
cd /opt/render/project/src && node dist/main.js
```

**أو:**

```
node /opt/render/project/src/dist/main.js
```

---

## 🎯 الحل الأفضل: التحقق من Build

### المشكلة قد تكون أن Build لم ينتج dist/

**تحقق من Build Command:**

في Render Dashboard → Settings → Build Command يجب أن يكون:

```
npm install --legacy-peer-deps && npx prisma generate && npx nest build
```

**وتأكد من أن Build Command يعمل بشكل صحيح ويبني dist/**

---

## 📋 خطوات الحل الكاملة

### 1. التحقق من Root Directory

**Render Dashboard → Settings → Root Directory:**
- يجب أن يكون **فارغاً** (أو `barber-platform-backend` إذا كان المشروع في مجلد فرعي)

### 2. التحقق من Build Command

**Render Dashboard → Settings → Build Command:**
```
npm install --legacy-peer-deps && npx prisma generate && npx nest build
```

### 3. التحقق من Start Command

**Render Dashboard → Settings → Start Command:**
```
npx prisma db push --force-reset && npm run start:prod
```

### 4. التحقق من package.json

**يجب أن يكون:**
```json
"start:prod": "node dist/main.js"
```

---

## 🔧 إذا استمرت المشكلة

### الحل: استخدام Shell في Render للتحقق من الملفات

**في Render Shell:**

```bash
# التحقق من وجود dist/
ls -la dist/

# أو
find . -name "main.js" -type f
```

---

## ✅ التوصية

**الخطوة الأولى:** تحقق من **Root Directory** في Render - يجب أن يكون فارغاً!

---

**🎯 بعد تصحيح Root Directory، يجب أن يعمل التطبيق!**

