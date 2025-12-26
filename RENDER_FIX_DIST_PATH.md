# 🔧 حل مشكلة مسار dist/main.js على Render

## ❌ المشكلة

```
Error: Cannot find module '/opt/render/project/src/dist/main.js'
> node dist/main.js
```

**السبب:** 
- Render يبحث في `src/dist/main.js`
- لكن `nest build` يبني في `dist/main.js` (جذر المشروع)

---

## ✅ الحل: التحقق من Root Directory

### في Render Dashboard:

1. **Web Service → Settings**
2. **ابحث عن "Root Directory"**
3. **يجب أن يكون فارغاً تماماً** (لا تضع أي قيمة)
4. **احفظ التغييرات**

---

## 🔍 إذا كان Root Directory فارغاً لكن المشكلة ما زالت موجودة

### الحل: استخدام المسار الصحيح

**في Render Dashboard → Settings → Start Command:**

غيّره إلى:

```
npx prisma db push --force-reset && cd /opt/render/project/src && node dist/main.js
```

**أو بشكل أبسط:**

```
npx prisma db push --force-reset && node ./dist/main.js
```

---

## 📋 خطوات الحل

### 1. تحقق من Root Directory

**Render Dashboard → Settings → Root Directory:**
- ✅ يجب أن يكون **فارغاً**

### 2. تحقق من Build Command

**Render Dashboard → Settings → Build Command:**
```
npm install --legacy-peer-deps && npx prisma generate && npx nest build
```

### 3. تحقق من Start Command

**Render Dashboard → Settings → Start Command:**
```
npx prisma db push --force-reset && npm run start:prod
```

### 4. تحقق من package.json

**يجب أن يكون:**
```json
"start:prod": "node dist/main.js"
```

---

## 🆘 إذا استمرت المشكلة

### استخدام Render Shell للتحقق:

**Render Dashboard → Shell:**

```bash
# التحقق من الموقع الحالي
pwd

# البحث عن main.js
find . -name "main.js" -type f

# التحقق من dist/
ls -la dist/
```

---

**🎯 الخطوة الأولى: تحقق من Root Directory - يجب أن يكون فارغاً!**

