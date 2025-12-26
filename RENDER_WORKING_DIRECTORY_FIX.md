# 🔧 حل مشكلة Working Directory على Render

## ❌ المشكلة

```
Error: Cannot find module '/opt/render/project/src/dist/main.js'
==> Running 'npx prisma db push --force-reset && node ./dist/main.js'
```

**السبب:** 
- Start Command يعمل من `/opt/render/project/src/`
- لكن `dist/` موجود في `/opt/render/project/src/dist/` (بعد البناء)
- المسار `./dist/main.js` صحيح نسبياً، لكن Build قد لا يبني بشكل صحيح

---

## ✅ الحل: استخدام cd في Start Command

### في Render Dashboard → Settings → Start Command:

**غيّره إلى:**

```
cd /opt/render/project/src && npx prisma db push --force-reset && node dist/main.js
```

**أو:**

```
npx prisma db push --force-reset && cd /opt/render/project/src && node dist/main.js
```

---

## 🔍 الحل الأفضل: التحقق من Build

المشكلة قد تكون أن Build لا ينتج `dist/` بشكل صحيح.

### تحقق من Build Command:

**في Render Dashboard → Settings → Build Command يجب أن يكون:**

```
npm install --legacy-peer-deps && npx prisma generate && npx nest build
```

**وتأكد من أن Build Command يعمل بشكل صحيح.**

---

## 🎯 الحل النهائي: استخدام npm run start:prod

### في Render Dashboard → Settings → Start Command:

**غيّره إلى:**

```
cd /opt/render/project/src && npx prisma db push --force-reset && npm run start:prod
```

هذا سيستخدم script من package.json والذي يعمل من المجلد الصحيح.

---

## 📋 خطوات الحل

### 1. في Render Dashboard → Settings → Start Command:

**احذف القديم:**

```
npx prisma db push --force-reset && node ./dist/main.js
```

**واستبدله بـ:**

```
cd /opt/render/project/src && npx prisma db push --force-reset && npm run start:prod
```

**أو:**

```
npx prisma db push --force-reset && cd /opt/render/project/src && node dist/main.js
```

### 2. احفظ التغييرات

---

## 🔍 التحقق من Build

### في Render Logs، ابحث عن:

```
> nest build
[Nest] Build completed successfully
```

**إذا لم تر هذه الرسالة، Build لم يكتمل بنجاح.**

---

**🎯 استخدم الحل: `cd /opt/render/project/src && npx prisma db push --force-reset && npm run start:prod`**

