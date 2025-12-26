# 🔄 تحويل Migrations من MySQL إلى PostgreSQL

## ⚠️ المشكلة

Migrations الموجودة تحتوي على MySQL syntax مثل:
- `AUTO_INCREMENT` → يجب أن يكون `SERIAL` في PostgreSQL
- `DATETIME(3)` → يجب أن يكون `TIMESTAMP(3)` في PostgreSQL
- `ENUM` → syntax مختلف قليلاً
- `DEFAULT CHARACTER SET utf8mb4` → غير موجود في PostgreSQL

---

## ✅ الحل الموصى به: إنشاء Migrations جديدة

### الخطوة 1: محلياً - إنشاء قاعدة بيانات PostgreSQL

```bash
# تثبيت PostgreSQL محلياً أو استخدام Docker
docker run --name postgres-local -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### الخطوة 2: تحديث .env المحلي

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/barber_platform"
```

### الخطوة 3: إنشاء قاعدة البيانات

```bash
# الاتصال بـ PostgreSQL
psql -U postgres -h localhost

# إنشاء قاعدة البيانات
CREATE DATABASE barber_platform;
\q
```

### الخطوة 4: حذف migrations القديمة وإنشاء جديدة

```bash
# احذف migrations القديمة
rm -rf prisma/migrations

# أنشئ migration جديدة
npx prisma migrate dev --name init_postgresql
```

### الخطوة 5: رفع migrations الجديدة

```bash
git add prisma/migrations
git commit -m "Create new PostgreSQL migrations"
git push
```

---

## 🔄 الحل البديل: تحديث migrations يدوياً

إذا لم تستطع إنشاء migrations جديدة، يمكن تحديث migrations الموجودة:

### التحويلات المطلوبة:

| MySQL | PostgreSQL |
|-------|------------|
| `AUTO_INCREMENT` | `SERIAL` أو `GENERATED ALWAYS AS IDENTITY` |
| `DATETIME(3)` | `TIMESTAMP(3)` |
| `ENUM('A', 'B')` | `ENUM('A', 'B')` (نفس الشيء لكن بدون backticks) |
| `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` | احذف هذا السطر |
| Backticks `` `table_name` `` | Double quotes `"table_name"` أو بدون quotes |

### مثال:

**MySQL:**
```sql
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**PostgreSQL:**
```sql
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY ("id")
);
```

---

## 🚀 الحل السريع: استخدام Prisma Migrate Reset

**⚠️ تحذير:** هذا سيحذف جميع البيانات!

### في Render Shell:

```bash
# احذف migrations القديمة
rm -rf prisma/migrations

# أنشئ migration جديدة
npx prisma migrate dev --name init_postgresql
```

لكن هذا يتطلب قاعدة بيانات محلية.

---

## 💡 الحل الأفضل: إنشاء Migration جديدة من Schema

### الخطوات:

1. **محلياً:**
   ```bash
   # احذف migrations القديمة
   rm -rf prisma/migrations
   
   # تأكد من أن schema.prisma يستخدم postgresql
   # (تم بالفعل ✅)
   
   # أنشئ migration جديدة
   npx prisma migrate dev --name init_postgresql
   ```

2. **ارفع على GitHub:**
   ```bash
   git add prisma/migrations
   git commit -m "Create PostgreSQL migrations"
   git push
   ```

3. **Render سيطبق migrations الجديدة**

---

## 📝 ملخص

| الحل | المميزات | العيوب |
|------|----------|--------|
| تحديث migration_lock.toml | سريع | قد يفشل بسبب SQL syntax |
| إنشاء migrations جديدة | موثوق | يتطلب وقتاً إضافياً |
| تحديث migrations يدوياً | لا يتطلب قاعدة بيانات محلية | معقد ومكلف بالوقت |

---

## ✅ التوصية

**الأفضل:** إنشاء migrations جديدة لـ PostgreSQL من الصفر.

**للآن:** جرب تحديث `migration_lock.toml` أولاً - إذا فشل، أنشئ migrations جديدة.

---

**🎯 بعد رفع migration_lock.toml، راقب Logs في Render. إذا ظهرت أخطاء SQL، ستحتاج لإنشاء migrations جديدة.**

