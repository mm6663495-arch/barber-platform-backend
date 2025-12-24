const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('🔄 Creating test salon owner...');
    
    const password = await bcrypt.hash('owner123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: 'owner@salon.com' },
      update: {},
      create: {
        email: 'owner@salon.com',
        password: password,
        role: 'SALON_OWNER',
        isActive: true,
        salonOwner: {
          create: {
            fullName: 'Test Salon Owner',
            phone: '+966501234567',
            subscriptionType: 'MONTHLY',
            subscriptionStatus: 'ACTIVE',
            subscriptionStartDate: new Date(),
            subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }
        }
      },
      include: {
        salonOwner: true
      }
    });

    console.log('✅ Test user created successfully!');
    console.log('📧 Email: owner@salon.com');
    console.log('🔑 Password: owner123');
    console.log('👤 User ID:', user.id);
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
