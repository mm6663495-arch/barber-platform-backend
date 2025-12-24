/**
 * بوت اختبار API تلقائي لمنصة الحلاقة
 * يختبر جميع الجداول والحالات تلقائياً
 */

const axios = require('axios');
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// إعدادات الاختبار
const BASE_URL = 'http://localhost:3000';
const DELAY = 1000; // تأخير بين الطلبات (ميلي ثانية)

// نتائج الاختبار
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Tokens سيتم حفظها هنا
const tokens = {
  admin: null,
  salonOwner: null,
  customer: null
};

// IDs سيتم حفظها هنا
const ids = {
  salonId: null,
  packageId: null,
  subscriptionId: null,
  qrCode: null,
  visitId: null,
  reviewId: null
};

// دالة للانتظار
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// دالة لطباعة النتائج
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('ar-EG');
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`
  };
  console.log(`[${timestamp}] ${prefix[type]} ${message}`);
}

// دالة لاختبار endpoint
async function testEndpoint(name, method, url, options = {}) {
  results.total++;
  try {
    log(`اختبار: ${name}`, 'info');
    
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      ...options
    };

    const response = await axios(config);
    
    log(`نجح: ${name} (${response.status})`, 'success');
    results.passed++;
    return response.data;
  } catch (error) {
    const status = error.response?.status || 'N/A';
    const message = error.response?.data?.message || error.message;
    log(`فشل: ${name} (${status}) - ${message}`, 'error');
    results.failed++;
    results.errors.push({ name, error: message });
    return null;
  } finally {
    await wait(DELAY);
  }
}

// ==========================================
// المرحلة 1: اختبار المصادقة
// ==========================================
async function testAuthentication() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 1: اختبار المصادقة ===${colors.reset}\n`);

  // 1.1 تسجيل دخول Admin
  const adminLogin = await testEndpoint(
    'تسجيل دخول Admin',
    'POST',
    '/auth/login',
    {
      data: {
        email: 'admin@barber.com',
        password: 'admin123'
      }
    }
  );
  if (adminLogin?.token) {
    tokens.admin = adminLogin.token;
    log('تم حفظ Admin Token', 'success');
  }

  // 1.2 تسجيل دخول Salon Owner
  const ownerLogin = await testEndpoint(
    'تسجيل دخول Salon Owner',
    'POST',
    '/auth/login',
    {
      data: {
        email: 'owner@salon.com',
        password: 'owner123'
      }
    }
  );
  if (ownerLogin?.token) {
    tokens.salonOwner = ownerLogin.token;
    log('تم حفظ Salon Owner Token', 'success');
  }

  // 1.3 تسجيل دخول Customer
  const customerLogin = await testEndpoint(
    'تسجيل دخول Customer',
    'POST',
    '/auth/login',
    {
      data: {
        email: 'customer@test.com',
        password: 'customer123'
      }
    }
  );
  if (customerLogin?.token) {
    tokens.customer = customerLogin.token;
    log('تم حفظ Customer Token', 'success');
  }

  // 1.4 عرض الملف الشخصي
  await testEndpoint(
    'عرض ملف Admin الشخصي',
    'GET',
    '/auth/profile',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );
}

// ==========================================
// المرحلة 2: اختبار المستخدمين
// ==========================================
async function testUsers() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 2: اختبار المستخدمين ===${colors.reset}\n`);

  // 2.1 عرض جميع المستخدمين
  await testEndpoint(
    'عرض جميع المستخدمين',
    'GET',
    '/users',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 2.2 إحصائيات المستخدمين
  await testEndpoint(
    'إحصائيات المستخدمين',
    'GET',
    '/users/statistics',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 2.3 المستخدمون الجدد
  await testEndpoint(
    'المستخدمون الجدد',
    'GET',
    '/users/recent?limit=5',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 2.4 عرض مستخدم محدد
  await testEndpoint(
    'عرض مستخدم محدد',
    'GET',
    '/users/1',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );
}

// ==========================================
// المرحلة 3: اختبار الصالونات
// ==========================================
async function testSalons() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 3: اختبار الصالونات ===${colors.reset}\n`);

  // 3.1 عرض جميع الصالونات (عام)
  await testEndpoint(
    'عرض جميع الصالونات (عام)',
    'GET',
    '/salons'
  );

  // 3.2 الصالونات الشائعة
  await testEndpoint(
    'الصالونات الشائعة',
    'GET',
    '/salons/popular?limit=5'
  );

  // 3.3 عرض صالوناتي (Salon Owner)
  const mySalons = await testEndpoint(
    'عرض صالوناتي',
    'GET',
    '/salons/owner/my-salons',
    {
      headers: { Authorization: `Bearer ${tokens.salonOwner}` }
    }
  );

  // حفظ أول salon ID
  if (mySalons && mySalons.length > 0) {
    ids.salonId = mySalons[0].id;
    log(`تم حفظ Salon ID: ${ids.salonId}`, 'success');
  }

  // 3.4 عرض تفاصيل صالون
  if (ids.salonId) {
    await testEndpoint(
      'عرض تفاصيل صالون',
      'GET',
      `/salons/${ids.salonId}`
    );

    // 3.5 عرض باقات الصالون
    await testEndpoint(
      'عرض باقات الصالون',
      'GET',
      `/salons/${ids.salonId}/packages`
    );
  }

  // 3.6 إحصائيات صالوناتي
  await testEndpoint(
    'إحصائيات صالوناتي',
    'GET',
    '/salons/owner/statistics',
    {
      headers: { Authorization: `Bearer ${tokens.salonOwner}` }
    }
  );
}

// ==========================================
// المرحلة 4: اختبار الباقات
// ==========================================
async function testPackages() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 4: اختبار الباقات ===${colors.reset}\n`);

  if (!ids.salonId) {
    log('لا يوجد Salon ID - تخطي اختبار الباقات', 'warning');
    return;
  }

  // 4.1 إنشاء باقة جديدة
  const newPackage = await testEndpoint(
    'إنشاء باقة جديدة',
    'POST',
    `/salons/${ids.salonId}/packages`,
    {
      headers: { Authorization: `Bearer ${tokens.salonOwner}` },
      data: {
        name: 'باقة اختبار تلقائي',
        description: 'تم إنشاؤها بواسطة البوت',
        price: 100.0,
        visitsCount: 3,
        validityDays: 30
      }
    }
  );

  if (newPackage?.id) {
    ids.packageId = newPackage.id;
    log(`تم حفظ Package ID: ${ids.packageId}`, 'success');

    // 4.2 نشر الباقة
    await testEndpoint(
      'نشر الباقة',
      'PATCH',
      `/salons/packages/${ids.packageId}/publish`,
      {
        headers: { Authorization: `Bearer ${tokens.salonOwner}` }
      }
    );

    // 4.3 عرض تفاصيل الباقة
    await testEndpoint(
      'عرض تفاصيل الباقة',
      'GET',
      `/salons/packages/${ids.packageId}`
    );
  }
}

// ==========================================
// المرحلة 5: اختبار الاشتراكات
// ==========================================
async function testSubscriptions() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 5: اختبار الاشتراكات ===${colors.reset}\n`);

  if (!ids.packageId) {
    log('لا يوجد Package ID - تخطي اختبار الاشتراكات', 'warning');
    return;
  }

  // 5.1 إنشاء اشتراك
  const newSubscription = await testEndpoint(
    'إنشاء اشتراك جديد',
    'POST',
    '/subscriptions',
    {
      headers: { Authorization: `Bearer ${tokens.customer}` },
      data: {
        packageId: ids.packageId,
        paymentMethod: 'cash'
      }
    }
  );

  if (newSubscription?.id) {
    ids.subscriptionId = newSubscription.id;
    ids.qrCode = newSubscription.qrCode;
    log(`تم حفظ Subscription ID: ${ids.subscriptionId}`, 'success');
    log(`تم حفظ QR Code: ${ids.qrCode}`, 'success');

    // 5.2 عرض اشتراكاتي
    await testEndpoint(
      'عرض اشتراكاتي',
      'GET',
      '/subscriptions/my-subscriptions',
      {
        headers: { Authorization: `Bearer ${tokens.customer}` }
      }
    );

    // 5.3 عرض تفاصيل اشتراك
    await testEndpoint(
      'عرض تفاصيل الاشتراك',
      'GET',
      `/subscriptions/${ids.subscriptionId}`,
      {
        headers: { Authorization: `Bearer ${tokens.customer}` }
      }
    );

    // 5.4 البحث بـ QR Code
    await testEndpoint(
      'البحث بـ QR Code',
      'GET',
      `/subscriptions/qr/${ids.qrCode}`,
      {
        headers: { Authorization: `Bearer ${tokens.salonOwner}` }
      }
    );
  }

  // 5.5 إحصائيات الاشتراكات
  await testEndpoint(
    'إحصائيات الاشتراكات',
    'GET',
    '/subscriptions/statistics',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );
}

// ==========================================
// المرحلة 6: اختبار المدفوعات
// ==========================================
async function testPayments() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 6: اختبار المدفوعات ===${colors.reset}\n`);

  // 6.1 عرض مدفوعاتي
  await testEndpoint(
    'عرض مدفوعاتي',
    'GET',
    '/payments/my-payments',
    {
      headers: { Authorization: `Bearer ${tokens.customer}` }
    }
  );

  // 6.2 إحصائيات المدفوعات
  await testEndpoint(
    'إحصائيات المدفوعات',
    'GET',
    '/payments/statistics',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 6.3 المدفوعات الأخيرة
  await testEndpoint(
    'المدفوعات الأخيرة',
    'GET',
    '/payments/recent?limit=10',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );
}

// ==========================================
// المرحلة 7: اختبار المراجعات
// ==========================================
async function testReviews() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 7: اختبار المراجعات ===${colors.reset}\n`);

  // 7.1 عرض جميع المراجعات
  await testEndpoint(
    'عرض جميع المراجعات',
    'GET',
    '/reviews'
  );

  // 7.2 المراجعات الأخيرة
  await testEndpoint(
    'المراجعات الأخيرة',
    'GET',
    '/reviews/recent?limit=5'
  );

  // 7.3 إحصائيات المراجعات
  await testEndpoint(
    'إحصائيات المراجعات',
    'GET',
    '/reviews/statistics'
  );

  if (ids.salonId) {
    // 7.4 مراجعات صالون محدد
    await testEndpoint(
      'مراجعات صالون محدد',
      'GET',
      `/reviews/salon/${ids.salonId}`
    );
  }
}

// ==========================================
// المرحلة 8: اختبار الإشعارات
// ==========================================
async function testNotifications() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 8: اختبار الإشعارات ===${colors.reset}\n`);

  // 8.1 عرض إشعاراتي
  await testEndpoint(
    'عرض إشعاراتي',
    'GET',
    '/notifications',
    {
      headers: { Authorization: `Bearer ${tokens.customer}` }
    }
  );

  // 8.2 عدد الإشعارات غير المقروءة
  await testEndpoint(
    'عدد الإشعارات غير المقروءة',
    'GET',
    '/notifications/unread-count',
    {
      headers: { Authorization: `Bearer ${tokens.customer}` }
    }
  );
}

// ==========================================
// المرحلة 9: اختبار لوحة الإدارة
// ==========================================
async function testAdmin() {
  console.log(`\n${colors.bold}${colors.blue}=== المرحلة 9: اختبار لوحة الإدارة ===${colors.reset}\n`);

  // 9.1 لوحة التحكم
  await testEndpoint(
    'لوحة التحكم',
    'GET',
    '/admin/dashboard',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 9.2 النشاط الأخير
  await testEndpoint(
    'النشاط الأخير',
    'GET',
    '/admin/recent-activity',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 9.3 صحة النظام
  await testEndpoint(
    'فحص صحة النظام',
    'GET',
    '/admin/health',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );

  // 9.4 تحليلات الإيرادات
  await testEndpoint(
    'تحليلات الإيرادات',
    'GET',
    '/admin/revenue',
    {
      headers: { Authorization: `Bearer ${tokens.admin}` }
    }
  );
}

// ==========================================
// تشغيل جميع الاختبارات
// ==========================================
async function runAllTests() {
  console.log(`\n${colors.bold}${colors.green}🤖 بدء اختبار API تلقائياً...${colors.reset}\n`);
  console.log(`${colors.yellow}الخادم: ${BASE_URL}${colors.reset}\n`);

  const startTime = Date.now();

  try {
    await testAuthentication();
    await testUsers();
    await testSalons();
    await testPackages();
    await testSubscriptions();
    await testPayments();
    await testReviews();
    await testNotifications();
    await testAdmin();
  } catch (error) {
    log(`خطأ غير متوقع: ${error.message}`, 'error');
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // طباعة النتيجة النهائية
  console.log(`\n${colors.bold}${colors.blue}=== النتيجة النهائية ===${colors.reset}\n`);
  console.log(`إجمالي الاختبارات: ${colors.bold}${results.total}${colors.reset}`);
  console.log(`${colors.green}نجح: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}فشل: ${results.failed}${colors.reset}`);
  console.log(`الوقت المستغرق: ${duration} ثانية\n`);

  if (results.failed > 0) {
    console.log(`${colors.red}${colors.bold}الأخطاء:${colors.reset}`);
    results.errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.name}: ${err.error}`);
    });
  }

  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`\n${colors.bold}معدل النجاح: ${successRate}%${colors.reset}\n`);

  if (successRate >= 90) {
    console.log(`${colors.green}${colors.bold}🎉 رائع! النظام يعمل بشكل ممتاز!${colors.reset}\n`);
  } else if (successRate >= 70) {
    console.log(`${colors.yellow}${colors.bold}⚠️ جيد، لكن يحتاج بعض التحسينات${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}❌ يوجد مشاكل تحتاج إصلاح${colors.reset}\n`);
  }
}

// تشغيل البوت
runAllTests().catch(console.error);

