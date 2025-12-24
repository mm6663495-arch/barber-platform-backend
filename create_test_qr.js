const QRCode = require('qrcode');
const fs = require('fs');

// QR code الجديد من الاشتراك الذي تم إنشاؤه للتو
const newQRCode = 'e623e0c9-5a53-4f4f-afe3-9bda7a7bda08';

async function createTestQR() {
    try {
        console.log('🔄 إنشاء QR Code للاختبار: ' + newQRCode);
        
        // إنشاء QR code كصورة
        const qrImage = await QRCode.toDataURL(newQRCode, {
            width: 300,
            height: 300,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
        });
        
        // حفظ الصورة
        const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync('test_qr_code.png', base64Data, 'base64');
        
        console.log('✅ تم إنشاء QR Code للاختبار: test_qr_code.png');
        console.log('📱 يمكنك الآن استخدام هذا QR code لاختبار التطبيق');
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء QR Code: ' + error.message);
    }
}

createTestQR();
