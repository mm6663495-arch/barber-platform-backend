/**
 * أداة تشخيص للتحقق من أن الخادم يعمل ويمكن الوصول إليه
 * استخدم: node test-server-connection.js
 */

const http = require('http');
const { networkInterfaces } = require('os');

console.log('🔍 بدء التشخيص...\n');

// الحصول على IP المحلي
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
const port = process.env.PORT || 3000;

console.log(`📍 IP المحلي: ${localIP}`);
console.log(`📍 المنفذ: ${port}\n`);

// اختبار الاتصال
function testConnection(host, port, path) {
  return new Promise((resolve, reject) => {
    const url = `http://${host}:${port}${path}`;
    console.log(`🔄 اختبار: ${url}`);
    
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`   ✅ نجح! Status: ${res.statusCode}`);
        if (data) {
          console.log(`   📄 Response: ${data.substring(0, 100)}...`);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ فشل: ${error.message}`);
      if (error.message.includes('ECONNREFUSED')) {
        console.log(`      → الخادم لا يستمع على ${host}:${port}`);
        console.log(`      → تأكد أن الخادم يعمل (npm run start:dev)`);
      } else if (error.message.includes('EHOSTUNREACH')) {
        console.log(`      → لا يمكن الوصول للعنوان`);
      }
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`   ❌ فشل: انتهت المهلة`);
      reject(new Error('Timeout'));
    });
    
    req.setTimeout(5000);
  });
}

async function runTests() {
  const tests = [
    { host: 'localhost', port, path: '/' },
    { host: 'localhost', port, path: '/health' },
    { host: 'localhost', port, path: '/api/v1/auth/register' },
    { host: localIP, port, path: '/' },
    { host: localIP, port, path: '/health' },
    { host: localIP, port, path: '/api/v1/auth/register' },
  ];
  
  for (const test of tests) {
    try {
      await testConnection(test.host, test.port, test.path);
    } catch (e) {
      // تم التعامل مع الخطأ في testConnection
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ انتهى التشخيص');
  console.log('\n💡 إذا فشلت جميع الاختبارات:');
  console.log('   1. تأكد أن الخادم يعمل (npm run start:dev)');
  console.log('   2. تحقق من المنفذ (يجب أن يكون 3000)');
  console.log('   3. تحقق من أن الخادم يستمع على 0.0.0.0 وليس localhost فقط');
  console.log(`   4. جرّب الوصول من متصفح: http://${localIP}:${port}/health`);
}

runTests().catch(console.error);

