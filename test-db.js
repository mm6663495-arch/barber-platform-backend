const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');
    
    const userCount = await prisma.user.count();
    console.log('✅ Database connected successfully!');
    console.log('👥 Total users in database:', userCount);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true
        },
        take: 5
      });
      console.log('📋 Sample users:');
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - Active: ${user.isActive}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
