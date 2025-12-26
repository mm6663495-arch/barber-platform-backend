# 🔧 حل مشكلة "Cannot find module '/opt/render/project/src/dist/main'" على Render

## ❌ المشكلة

```
Error: Cannot find module '/opt/render/project/src/dist/main'
```

**السبب:** 
- `start:prod` script يستخدم `node dist/main`
- لكن الملف المصدري هو `dist/main.js` (مع `.js`)
- Node.js يحتاج `.js` في المسار أو بدون امتداد حسب الإعدادات

---

## ✅ الحل

### تحديث `start:prod` script في package.json

**تم تحديث package.json:**

**قبل:**
```json
"start:prod": "node dist/main"
```

**بعد:**
```json
"start:prod": "node dist/main.js"
```

---

## 📝 الخطوات التالية

### 1. رفع التغييرات على GitHub

```bash
cd barber-platform-backend
git add package.json
git commit -m "Fix: Add .js extension to start:prod script"
git push
```

### 2. Render سيعيد البناء والنشر تلقائياً

بعد رفع التغييرات، Render سيعيد البناء والنشر تلقائياً.

---

## 🔍 التحقق من الحل

بعد إعادة النشر:

1. **راقب Logs في Render**
   - يجب أن ترى:
     ```
     node dist/main.js
     🚀 Barber Platform Backend Started!
     ```

2. **تحقق من Status**
   - Status يجب أن يكون: **"Live"** (أخضر)

---

## 🆘 إذا استمرت المشكلة

### الحل البديل: استخدام المسار المطلق

إذا استمرت المشكلة، يمكن استخدام:

```json
"start:prod": "node ./dist/main.js"
```

### أو التحقق من Root Directory في Render

في Render Dashboard:
1. Settings → Environment
2. تحقق من **Root Directory**
3. إذا كان `barber-platform-backend`، يجب أن يكون:
   ```
   node dist/main.js
   ```
4. إذا كان فارغاً، يجب أن يكون:
   ```
   node dist/main.js
   ```

---

## 📊 ملخص

| المشكلة | الحل | الحالة |
|---------|------|--------|
| `Cannot find module dist/main` | إضافة `.js` extension | ✅ تم |

---

**🎉 بعد رفع التغييرات، يجب أن يعمل السيرفر بنجاح!**

