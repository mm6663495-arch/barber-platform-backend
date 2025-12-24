const QRCode = require('qrcode');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createQRCodes() {
  console.log('🚀 بدء إنشاء QR Codes من قاعدة البيانات...');

  try {
    // جلب جميع الاشتراكات النشطة
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        id: 'desc',
      },
      take: 10,
    });

    if (subscriptions.length === 0) {
      console.log('⚠️ لا توجد اشتراكات نشطة.');
      return;
    }

    console.log(`📊 تم العثور على ${subscriptions.length} اشتراك نشط`);

    let count = 1;
    for (const sub of subscriptions) {
      if (!sub.qrCode) {
        console.log(`⚠️ الاشتراك ${sub.id} لا يحتوي على QR Code`);
        continue;
      }

      const qrCodeData = sub.qrCode;
      const fileName = `qr_code_${sub.id}_${count}.png`;
      
      console.log(`\n🔄 إنشاء QR Code للاشتراك ${sub.id}: ${qrCodeData}`);
      
      try {
        await QRCode.toFile(fileName, qrCodeData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        console.log(`✅ تم إنشاء QR Code: ${fileName}`);
        count++;
      } catch (err) {
        console.error(`❌ خطأ في إنشاء QR Code للاشتراك ${sub.id}:`, err.message);
      }
    }

    console.log('\n🎉 تم إنشاء جميع QR Codes بنجاح!');

  } catch (error) {
    console.error('❌ حدث خطأ أثناء إنشاء QR Codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createQRCodes();
