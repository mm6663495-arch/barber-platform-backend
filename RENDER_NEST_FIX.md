# 🔧 حل مشكلة "nest: not found" على Render

## ❌ المشكلة

```
sh: 1: nest: not found
npm error command failed
npm error command sh -c nest build
```

**السبب:** 
- `@nestjs/cli` موجود في `devDependencies`
- `nest` command غير متاح في PATH
- في بعض بيئات الإنتاج، `devDependencies` قد لا يتم تثبيتها أو `nest` غير متاح مباشرة

---

## ✅ الحل

### تم إصلاحه في package.json:

**قبل:**
```json
"build": "nest build"
```

**بعد:**
```json
"build": "npx nest build"
```

`npx` سيبحث عن `nest` في `node_modules/.bin` ويعمل حتى لو كان في `devDependencies`.

---

## 📝 الخطوات التالية

### 1. رفع التغييرات على GitHub

```bash
cd barber-platform-backend
git add package.json
git commit -m "Fix: Use npx nest build instead of nest build"
git push
```

### 2. Render سيعيد البناء تلقائياً

بعد رفع التغييرات، Render سيكتشف التحديث ويعيد البناء تلقائياً.

---

## 🔍 التحقق من الحل

بعد إعادة البناء:

1. **راقب Logs في Render**
   - يجب أن ترى: `npm install` يعمل بنجاح
   - ثم: `> nest build` يعمل بنجاح
   - ثم: `Build completed successfully`

2. **تحقق من Status**
   - Status يجب أن يكون: **"Live"** (أخضر)

---

## 🔄 الحل البديل (إذا استمرت المشكلة)

### تحديث Build Command في Render

إذا استمرت المشكلة، يمكن تحديث Build Command مباشرة في Render:

**في Render Dashboard → Settings → Build Command:**

```
npm install --legacy-peer-deps && npx prisma generate && npx nest build
```

هذا سيستخدم `npx nest build` مباشرة بدلاً من `npm run build`.

---

## 📚 لماذا هذا الحل؟

### لماذا استخدام `npx`؟

- `npx` يبحث عن الأمر في `node_modules/.bin`
- يعمل حتى لو كان الأمر في `devDependencies`
- أكثر موثوقية في بيئات مختلفة
- لا يحتاج إلى تثبيت global

### لماذا لا نقل `@nestjs/cli` إلى `dependencies`؟

- `@nestjs/cli` أداة تطوير فقط
- لا يحتاجها التطبيق في runtime
- `npx` يحل المشكلة بدون نقل

---

## ✅ قائمة التحقق

- [ ] تم تحديث `package.json` (build script يستخدم npx)
- [ ] تم رفع التغييرات على GitHub
- [ ] Render يعيد البناء تلقائياً
- [ ] Logs تظهر نجاح `nest build`
- [ ] Build completed successfully
- [ ] Service Status = "Live"

---

## 🆘 إذا استمرت المشكلة

### الحل 1: تحديث Build Command مباشرة

في Render Dashboard:
1. Settings → Build Command
2. غيّره إلى:
   ```
   npm install --legacy-peer-deps && npx prisma generate && npx nest build
   ```

### الحل 2: نقل @nestjs/cli إلى dependencies

في `package.json`:
```json
{
  "dependencies": {
    "@nestjs/cli": "^11.0.0",
    // ... باقي dependencies
  },
  "devDependencies": {
    // احذف @nestjs/cli من هنا
  }
}
```

**⚠️ ملاحظة:** هذا الحل ليس موصى به لأن `@nestjs/cli` أداة تطوير فقط.

---

## 📊 ملخص التغييرات

| الملف | التغيير |
|------|---------|
| `package.json` | `"build": "nest build"` → `"build": "npx nest build"` |

---

**🎉 بعد رفع التغييرات، يجب أن يعمل البناء بنجاح!**

