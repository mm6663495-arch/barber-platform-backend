# 🔍 التحقق من Build على Render

## ❌ المشكلة

```
Error: Cannot find module '/opt/render/project/src/dist/main.js'
==> Build successful 🎉
```

**المشكلة:** Build ينجح لكن `dist/main.js` غير موجود!

---

## 🔍 التحقق المطلوب

### في Render Logs، ابحث عن:

#### ✅ يجب أن ترى:

```
> nest build
[Nest] Starting build...
[Nest] Build completed successfully
```

#### ❌ إذا لم تر هذه الرسالة:

Build Command قد لا يعمل بشكل صحيح.

---

## ✅ الحل: التحقق من Build Command

### في Render Dashboard → Settings → Build Command:

**يجب أن يكون بالضبط:**

```
npm install --legacy-peer-deps && npx prisma generate && npx nest build
```

**وتأكد من:**
- لا توجد مسافات إضافية
- جميع الأوامر على سطر واحد
- `npx nest build` موجود

---

## 🔧 الحل البديل: استخدام Render Shell للتحقق

### في Render Dashboard → Shell:

نفّذ هذه الأوامر للتحقق:

```bash
# التحقق من الموقع الحالي
pwd

# البحث عن main.js
find . -name "main.js" -type f

# التحقق من dist/
ls -la dist/

# التحقق من محتويات dist/
ls -la dist/src/
```

---

## 🎯 الحل المحتمل: nest build لا يبني بشكل صحيح

### إذا كان nest build لا يعمل:

**في Render Dashboard → Settings → Build Command:**

استبدل `npx nest build` بـ:

```
npm run build
```

**Build Command الكامل:**

```
npm install --legacy-peer-deps && npx prisma generate && npm run build
```

---

## 📋 خطوات الحل

### 1. تحقق من Build Logs

في Render Dashboard → Logs، ابحث عن:
- `[Nest] Build completed successfully`
- إذا لم تجدها، Build Command لا يعمل

### 2. تحقق من Build Command

**Render Dashboard → Settings → Build Command:**
```
npm install --legacy-peer-deps && npx prisma generate && npm run build
```

### 3. استخدم Render Shell

**Render Dashboard → Shell:**
```bash
find . -name "main.js"
ls -la dist/
```

---

**🔍 بعد التحقق من Build Logs، سنعرف المشكلة بالضبط!**

