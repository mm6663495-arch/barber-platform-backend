# 🔄 تحويل قاعدة البيانات من MySQL إلى PostgreSQL للـ Render

## ⚠️ ملاحظة مهمة

Render يوفر **PostgreSQL** مجاناً، بينما MySQL يتطلب خطة مدفوعة. لذلك يجب تحويل المشروع للعمل مع PostgreSQL.

---

## 📝 الخطوة 1: تحديث Prisma Schema

افتح ملف `prisma/schema.prisma` وغير السطر:

### قبل (MySQL):
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

### بعد (PostgreSQL):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 🔧 الخطوة 2: تحديث DATABASE_URL

### للتطوير المحلي (MySQL):
```env
DATABASE_URL="mysql://root:password@localhost:3306/barber_platform"
```

### للإنتاج على Render (PostgreSQL):
```env
DATABASE_URL="postgresql://user:password@host:5432/database_name?sslmode=require"
```

**💡 ملاحظة:** Render يوفر **Internal Database URL** استخدمه في Environment Variables.

---

## 🚀 الخطوة 3: إنشاء Migration جديد

بعد تغيير Provider في Prisma Schema:

```bash
# توليد Prisma Client للـ PostgreSQL
npx prisma generate

# إنشاء migration جديد
npx prisma migrate dev --name switch-to-postgresql
```

---

## ⚠️ اختلافات بين MySQL و PostgreSQL

### 1. أنواع البيانات

بعض أنواع البيانات قد تحتاج تعديل:

- `@db.Text` → يعمل في كليهما
- `@db.VarChar(255)` → يعمل في كليهما
- `Json` → يعمل في كليهما

### 2. Auto Increment

- **MySQL**: `@default(autoincrement())`
- **PostgreSQL**: `@default(autoincrement())` (نفس الشيء!)

### 3. Boolean

- **MySQL**: `TINYINT(1)`
- **PostgreSQL**: `BOOLEAN`

Prisma يتعامل مع هذا تلقائياً.

---

## ✅ التحقق من التحويل

### 1. اختبار محلياً (اختياري)

إذا أردت اختبار PostgreSQL محلياً:

```bash
# تثبيت PostgreSQL محلياً أو استخدام Docker
docker run --name postgres-test -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres

# تحديث DATABASE_URL
DATABASE_URL="postgresql://postgres:password@localhost:5432/barber_platform"

# تشغيل migrations
npx prisma migrate dev
```

### 2. على Render

بعد رفع الكود وتحديث Prisma Schema:

1. في Render Shell:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

2. تحقق من Logs:
   - يجب أن ترى: `Prisma Client generated successfully`
   - يجب أن ترى: `All migrations have been applied`

---

## 🔄 العودة إلى MySQL (إذا لزم الأمر)

إذا أردت العودة إلى MySQL:

1. غيّر Provider في `schema.prisma` إلى `mysql`
2. حدّث `DATABASE_URL`
3. شغّل:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name switch-back-to-mysql
   ```

---

## 📚 موارد إضافية

- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Prisma Migrate Guide](https://www.prisma.io/docs/guides/migrate)
- [Render PostgreSQL Docs](https://render.com/docs/databases)

---

## ✅ قائمة التحقق

- [ ] غيّرت `provider` في `schema.prisma` إلى `postgresql`
- [ ] حدّثت `DATABASE_URL` في Render Environment Variables
- [ ] شغّلت `npx prisma generate`
- [ ] شغّلت `npx prisma migrate deploy` على Render
- [ ] تحققت من Logs في Render
- [ ] اختبرت الاتصال بقاعدة البيانات

---

**🎉 مبروك! الآن المشروع جاهز للعمل مع PostgreSQL على Render!**

