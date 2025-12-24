# دليل إعدادات XAMPP لـ Barber Platform

## 📋 نظرة عامة

هذا الدليل يوضح كيفية تنظيم وإعداد XAMPP لمشروع Barber Platform Backend. تم إنشاء ملفات إعدادات شاملة لضمان عمل التطبيق بشكل مثالي مع XAMPP.

## 🗂️ الملفات المُنشأة

### 1. ملف إعدادات البيئة
- **الملف**: `xampp-config.env`
- **الوصف**: يحتوي على جميع متغيرات البيئة المطلوبة للتطبيق
- **المحتويات**:
  - إعدادات قاعدة البيانات MySQL
  - إعدادات JWT والأمان
  - إعدادات البريد الإلكتروني
  - إعدادات الدفع
  - إعدادات المراقبة والنسخ الاحتياطي

### 2. ملف إعدادات قاعدة البيانات
- **الملف**: `xampp-mysql-config.sql`
- **الوصف**: سكريبت SQL لإعداد قاعدة البيانات وتحسين الأداء
- **المحتويات**:
  - إنشاء قاعدة البيانات
  - إعداد الفهارس للأداء
  - إدراج الإعدادات الافتراضية
  - إجراءات التنظيف التلقائي

### 3. ملف إعدادات Apache
- **الملف**: `xampp-apache-config.conf`
- **الوصف**: إعدادات Apache للتعامل مع API والملفات الثابتة
- **المحتويات**:
  - إعداد Virtual Host
  - إعدادات الأمان
  - إعدادات CORS
  - إعدادات الضغط والتخزين المؤقت

### 4. ملف إعدادات الأمان
- **الملف**: `xampp-security-config.js`
- **الوصف**: إعدادات الأمان الشاملة للتطبيق
- **المحتويات**:
  - إعدادات CORS
  - Rate Limiting
  - Helmet Security Headers
  - JWT Configuration
  - Password Security

### 5. ملف إعدادات البريد الإلكتروني
- **الملف**: `xampp-email-config.js`
- **الوصف**: إعدادات البريد الإلكتروني والقوالب
- **المحتويات**:
  - إعدادات SMTP
  - قوالب البريد الإلكتروني
  - إعدادات Queue
  - وظائف إرسال البريد

## 🚀 خطوات التثبيت والإعداد

### الخطوة 1: إعداد XAMPP

1. **تأكد من تشغيل XAMPP**:
   - Apache (Port 80)
   - MySQL (Port 3306)

2. **إعداد قاعدة البيانات**:
   ```bash
   # تشغيل MySQL من XAMPP
   # فتح phpMyAdmin: http://localhost/phpmyadmin
   ```

3. **تشغيل سكريبت قاعدة البيانات**:
   ```sql
   -- نسخ محتوى xampp-mysql-config.sql
   -- وتشغيله في phpMyAdmin
   ```

### الخطوة 2: إعداد Apache

1. **نسخ إعدادات Apache**:
   ```bash
   # نسخ محتوى xampp-apache-config.conf
   # إلى ملف httpd.conf في XAMPP
   # أو إنشاء ملف منفصل وإدراجه
   ```

2. **إعداد Virtual Host**:
   ```apache
   # إضافة إلى httpd.conf
   Include "path/to/xampp-apache-config.conf"
   ```

3. **إعادة تشغيل Apache**:
   ```bash
   # من XAMPP Control Panel
   # أو من Command Line
   ```

### الخطوة 3: إعداد التطبيق

1. **نسخ ملف البيئة**:
   ```bash
   cp xampp-config.env .env
   ```

2. **تثبيت التبعيات**:
   ```bash
   npm install
   ```

3. **تشغيل Migrations**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **تشغيل التطبيق**:
   ```bash
   npm run start:dev
   ```

## 🔧 إعدادات متقدمة

### إعدادات قاعدة البيانات

```sql
-- تحسين الأداء
SET GLOBAL innodb_buffer_pool_size = 128M;
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_size = 32M;

-- إعدادات الأمان
CREATE USER 'barber_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON barber_platform.* TO 'barber_user'@'localhost';
```

### إعدادات Apache المتقدمة

```apache
# إعدادات الأمان
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"

# إعدادات CORS
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
```

### إعدادات الأمان

```javascript
// Rate Limiting
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Helmet Security
const helmet = require('helmet');
app.use(helmet());
```

## 📊 مراقبة الأداء

### إعدادات المراقبة

```javascript
// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Metrics
app.get('/metrics', (req, res) => {
  // إرجاع مقاييس الأداء
});
```

### إعدادات النسخ الاحتياطي

```javascript
// Backup Configuration
const backupConfig = {
  enabled: true,
  schedule: '0 2 * * *', // Daily at 2 AM
  retention: 30, // 30 days
  path: './backups',
  encryption: true
};
```

## 🔍 استكشاف الأخطاء

### مشاكل شائعة وحلولها

1. **خطأ في الاتصال بقاعدة البيانات**:
   ```bash
   # تأكد من تشغيل MySQL في XAMPP
   # تحقق من إعدادات DATABASE_URL
   ```

2. **مشاكل CORS**:
   ```javascript
   // تأكد من إعدادات CORS في xampp-security-config.js
   cors: {
     origin: ['http://localhost:3000'],
     credentials: true
   }
   ```

3. **مشاكل Apache**:
   ```bash
   # تحقق من logs في C:/xampp/apache/logs/
   # تأكد من صحة إعدادات Virtual Host
   ```

### ملفات السجلات

- **Apache Logs**: `C:/xampp/apache/logs/`
- **MySQL Logs**: `C:/xampp/mysql/data/`
- **Application Logs**: `./logs/`

## 🛡️ الأمان

### إعدادات الأمان الأساسية

1. **تغيير كلمات المرور الافتراضية**
2. **تفعيل HTTPS في الإنتاج**
3. **تحديث JWT Secrets**
4. **إعداد Rate Limiting**
5. **تفعيل Helmet Security Headers**

### إعدادات الأمان المتقدمة

```javascript
// Password Security
const passwordConfig = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  bcryptRounds: 12
};
```

## 📧 إعدادات البريد الإلكتروني

### إعدادات SMTP

```javascript
const smtpConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
};
```

### قوالب البريد الإلكتروني

- **User Registration**: ترحيب بالمستخدمين الجدد
- **Email Verification**: تأكيد البريد الإلكتروني
- **Password Reset**: إعادة تعيين كلمة المرور
- **Subscription Notifications**: إشعارات الاشتراك

## 🚀 النشر والإنتاج

### إعدادات الإنتاج

```bash
# تغيير متغيرات البيئة
NODE_ENV=production
DATABASE_URL=mysql://user:password@localhost:3306/barber_platform
JWT_SECRET=your-super-secret-production-key
```

### إعدادات Apache للإنتاج

```apache
# تفعيل HTTPS
SSLEngine on
SSLCertificateFile "path/to/certificate.crt"
SSLCertificateKeyFile "path/to/private.key"

# إعدادات الأمان المتقدمة
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

## 📞 الدعم والمساعدة

### موارد مفيدة

- **XAMPP Documentation**: https://www.apachefriends.org/docs/
- **Apache Configuration**: https://httpd.apache.org/docs/
- **MySQL Documentation**: https://dev.mysql.com/doc/
- **NestJS Documentation**: https://docs.nestjs.com/

### نصائح للأداء

1. **تحسين قاعدة البيانات**: استخدام الفهارس المناسبة
2. **ضغط الملفات**: تفعيل Gzip في Apache
3. **التخزين المؤقت**: استخدام Redis للتخزين المؤقت
4. **مراقبة الأداء**: استخدام أدوات المراقبة

---

## ✅ قائمة التحقق

- [ ] XAMPP يعمل بشكل صحيح
- [ ] MySQL متصل ويعمل
- [ ] Apache يعمل مع الإعدادات الجديدة
- [ ] قاعدة البيانات تم إنشاؤها
- [ ] التطبيق يعمل على Port 3000
- [ ] API endpoints تعمل بشكل صحيح
- [ ] البريد الإلكتروني يعمل
- [ ] الأمان مفعل
- [ ] النسخ الاحتياطي يعمل
- [ ] المراقبة تعمل

---

**ملاحظة**: تأكد من تحديث جميع كلمات المرور والمفاتيح السرية قبل النشر في الإنتاج.
