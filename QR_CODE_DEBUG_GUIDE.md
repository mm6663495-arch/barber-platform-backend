# 🔍 دليل تشخيص مشكلة QR Code

## المشكلة
QR code يتم مسحه بنجاح لكن Backend يعيد "Invalid QR code"

## الخطوات للتشخيص

### 1. تحقق من Logs في Backend

بعد مسح QR code، افحص logs في Backend. يجب أن ترى:

```
[useVisit] Parsed QR code as JSON: {...}
[useVisit] Looking for subscription with ID: 38
[useVisit] Found subscription by ID: 38, status: ACTIVE
```

أو:

```
[useVisit] Subscription not found with ID: 38
[useVisit] Searching by qrCode: {...}
[useVisit] Invalid QR code - not found by ID or qrCode
```

### 2. تحقق من Subscription في قاعدة البيانات

```sql
-- تحقق من وجود subscription
SELECT * FROM Subscription WHERE id = 38;

-- تحقق من status
SELECT id, status, "visitsRemaining", "visitsUsed" FROM Subscription WHERE id = 38;

-- تحقق من package و salon
SELECT s.id, s.status, p."salonId", p.name as package_name, sal.name as salon_name
FROM Subscription s
JOIN Package p ON s."packageId" = p.id
JOIN Salon sal ON p."salonId" = sal.id
WHERE s.id = 38;
```

### 3. الأسباب المحتملة

#### أ) Subscription غير موجود
- **الحل:** تأكد من أن subscription ID 38 موجود في قاعدة البيانات

#### ب) Subscription غير ACTIVE
- **الحل:** تحقق من status في قاعدة البيانات
- **الحل:** قم بتفعيل subscription:
  ```sql
  UPDATE Subscription SET status = 'ACTIVE' WHERE id = 38;
  ```

#### ج) Subscription لا ينتمي للصالون الصحيح
- **الحل:** تحقق من أن `subscription.package.salonId` يطابق `ownerId` في Salon
- **الحل:** تحقق من أن صاحب الصالون يملك الصالون الصحيح

#### د) QR code ليس JSON صحيح
- **الحل:** تأكد من أن تطبيق العميل يستخدم `jsonEncode` وليس `toString()`
- **الحل:** تحقق من format QR code في logs

### 4. اختبار مباشر

```bash
# Test endpoint مباشرة
curl -X POST http://localhost:3000/api/v1/visits/scan-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"qrCode": "{\"type\":\"subscription_visit\",\"subscriptionId\":38,\"userId\":32,\"salonId\":37,\"packageId\":37,\"oneTime\":true,\"nonce\":\"test\",\"ts\":\"2025-11-22T18:12:59.601915\"}"}'
```

### 5. الحل السريع

إذا كان subscription موجود لكن غير active:

```sql
-- تفعيل subscription
UPDATE Subscription 
SET status = 'ACTIVE', 
    "visitsRemaining" = 10,
    "visitsUsed" = 0
WHERE id = 38;
```

---

*آخر تحديث: 2025-11-22*

