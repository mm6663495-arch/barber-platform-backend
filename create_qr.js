const QRCode = require('qrcode');
const fs = require('fs');

// QR codes الصحيحة من قاعدة البيانات
const qrCodes = [
    'QR-1761584514851',
    'QR-1761584477148', 
    'QR-1761584462587',
    '00c3f1aa-9783-4d6c-9a85-1172fbf78d71',
    'f010ddee-20db-44c7-8a9a-ad752491580a'
];

async function createQRCode(qrCode, filename) {
    try {
        console.log(`🔄 إنشاء QR Code: ${qrCode}`);
        
        // إنشاء QR code كصورة
        const qrImage = await QRCode.toDataURL(qrCode, {
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
        fs.writeFileSync(filename, base64Data, 'base64');
        
        console.log(`✅ تم إنشاء QR Code: ${filename}`);
        return qrImage;
    } catch (error) {
        console.error(`❌ خطأ في إنشاء QR Code: ${error.message}`);
    }
}

async function createAllQRCodes() {
    console.log('🚀 بدء إنشاء QR Codes الصحيحة...\n');
    
    for (let i = 0; i < qrCodes.length; i++) {
        const qrCode = qrCodes[i];
        const filename = `qr_code_${i + 1}.png`;
        await createQRCode(qrCode, filename);
    }
    
    console.log('\n🎉 تم إنشاء جميع QR Codes بنجاح!');
    console.log('\n📋 QR Codes المتاحة:');
    qrCodes.forEach((code, index) => {
        console.log(`${index + 1}. ${code}`);
    });
}

// تشغيل الدالة
createAllQRCodes();
