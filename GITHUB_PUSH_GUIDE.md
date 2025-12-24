# دليل رفع الكود إلى GitHub

## المشكلة الحالية
Git يحاول استخدام حساب قديم (`mohamadbadawi123`) للوصول إلى المستودع، لكن الحساب الجديد هو `mm6663495-arch`.

## الحل: استخدام Personal Access Token

### الخطوة 1: إنشاء Personal Access Token

1. اذهب إلى: https://github.com/settings/tokens
2. اضغط على **"Generate new token"** → **"Generate new token (classic)"**
3. اكتب اسم للـ Token (مثلاً: `barber-platform-backend`)
4. اختر صلاحيات:
   - ✅ **repo** (كل الصلاحيات)
5. اضغط **"Generate token"**
6. **انسخ الـ Token فوراً** (لن تتمكن من رؤيته مرة أخرى!)

### الخطوة 2: استخدام الـ Token

#### الطريقة 1: إضافة الـ Token في رابط المستودع (موصى به)

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/mm6663495-arch/barber-platform-backend.git
```

**استبدل `YOUR_TOKEN` بالـ Token الذي نسخته**

مثال:
```bash
git remote set-url origin https://ghp_xxxxxxxxxxxxxxxxxxxx@github.com/mm6663495-arch/barber-platform-backend.git
```

ثم:
```bash
git push -u origin main
```

#### الطريقة 2: إدخال الـ Token عند الطلب

عند عمل `git push`، سيطلب منك:
- **Username**: `mm6663495-arch`
- **Password**: **الصق الـ Token هنا** (ليس كلمة المرور!)

### الخطوة 3: التحقق

```bash
git remote -v
```

يجب أن يظهر:
```
origin  https://github.com/mm6663495-arch/barber-platform-backend.git (fetch)
origin  https://github.com/mm6663495-arch/barber-platform-backend.git (push)
```

## ملاحظات مهمة

⚠️ **احفظ الـ Token في مكان آمن!**
⚠️ **لا تشارك الـ Token مع أحد!**
⚠️ **إذا فقدت الـ Token، احذفه وأنشئ واحد جديد**

## بديل: حذف بيانات الاعتماد القديمة يدوياً

1. اضغط `Win + R`
2. اكتب: `control /name Microsoft.CredentialManager`
3. اذهب إلى **"Windows Credentials"**
4. ابحث عن أي إدخالات تحتوي على `github` أو `mohamadbadawi123`
5. احذفها
6. عند `git push` سيطلب منك إدخال بيانات الاعتماد الجديدة

