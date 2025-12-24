const http = require('http');

// اختبار تغيير كلمة المرور مباشرة عبر API
async function testChangePasswordAPI() {
  console.log('🧪 Testing Change Password API...\n');

  // الخطوة 1: تسجيل الدخول للحصول على token
  console.log('1️⃣ Logging in to get token...');
  const loginData = JSON.stringify({
    email: 'xxxx@gmail.com',
    password: 'qwertyu',
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length,
    },
  };

  const loginResponse = await new Promise((resolve, reject) => {
    const req = http.request(loginOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: JSON.parse(data) });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(loginData);
    req.end();
  });

  if (loginResponse.status !== 200) {
    console.error('❌ Login failed:', loginResponse.data);
    return;
  }

  const token = loginResponse.data.data?.accessToken || loginResponse.data.accessToken;
  if (!token) {
    console.error('❌ No token received:', loginResponse.data);
    return;
  }

  console.log('✅ Login successful!');
  console.log('   Token:', token.substring(0, 20) + '...\n');

  // الخطوة 2: تغيير كلمة المرور
  console.log('2️⃣ Changing password...');
  const changePasswordData = JSON.stringify({
    currentPassword: 'qwertyu',
    newPassword: 'newpass123',
  });

  const changePasswordOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/change-password',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': changePasswordData.length,
    },
  };

  const changePasswordResponse = await new Promise((resolve, reject) => {
    const req = http.request(changePasswordOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(changePasswordData);
    req.end();
  });

  console.log('   Status:', changePasswordResponse.status);
  console.log('   Response:', JSON.stringify(changePasswordResponse.data, null, 2));

  if (changePasswordResponse.status === 200) {
    console.log('\n✅✅✅ Password changed successfully via API!');
  } else {
    console.error('\n❌ Password change failed:', changePasswordResponse.data);
  }

  // الخطوة 3: التحقق من كلمة المرور الجديدة
  console.log('\n3️⃣ Verifying new password...');
  const verifyLoginData = JSON.stringify({
    email: 'xxxx@gmail.com',
    password: 'newpass123',
  });

  const verifyOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': verifyLoginData.length,
    },
  };

  const verifyResponse = await new Promise((resolve, reject) => {
    const req = http.request(verifyOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(verifyLoginData);
    req.end();
  });

  if (verifyResponse.status === 200) {
    console.log('✅ New password works!');
  } else {
    console.error('❌ New password does not work:', verifyResponse.data);
  }

  // إعادة تعيين كلمة المرور
  console.log('\n4️⃣ Resetting password back to original...');
  const resetData = JSON.stringify({
    currentPassword: 'newpass123',
    newPassword: 'qwertyu',
  });

  const resetOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/change-password',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': resetData.length,
    },
  };

  // الحصول على token جديد أولاً
  const resetLoginResponse = await new Promise((resolve, reject) => {
    const req = http.request(verifyOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(verifyLoginData);
    req.end();
  });

  if (resetLoginResponse.status === 200) {
    const resetToken = resetLoginResponse.data.data?.accessToken || resetLoginResponse.data.accessToken;
    resetOptions.headers['Authorization'] = `Bearer ${resetToken}`;

    const resetResponse = await new Promise((resolve, reject) => {
      const req = http.request(resetOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(resetData);
      req.end();
    });

    if (resetResponse.status === 200) {
      console.log('✅ Password reset to original');
    }
  }
}

testChangePasswordAPI().catch(console.error);

