// تحديث الباقات مباشرة في قاعدة البيانات
const { PrismaClient } = require('@prisma/client');

async function updatePackages() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 تحديث الباقات...');
    
    // تحديث الباقات 4 و 5 لتكون منشورة
    const result = await prisma.package.updateMany({
      where: {
        id: { in: [4, 5] }
      },
      data: {
        isPublished: true
      }
    });
    
    console.log('✅ تم تحديث', result.count, 'باقة');
    
    // التحقق من النتيجة
    const packages = await prisma.package.findMany({
      where: { id: { in: [4, 5] } },
      select: {
        id: true,
        name: true,
        isPublished: true,
        isActive: true
      }
    });
    
    console.log('📦 الباقات المحدثة:', packages);
    
  } catch (error) {
    console.error('❌ خطأ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePackages();
