const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function verifyUser(email, password) {
  try {
    console.log('🔍 Verifying user...\n');
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        platformAdmin: true,
        salonOwner: true,
        customer: true,
      },
    });

    if (!user) {
      console.log('❌ User not found:', normalizedEmail);
      console.log('\n💡 Available test users:');
      console.log('   📧 admin@barber.com / admin123');
      console.log('   📧 owner@salon.com / owner123');
      console.log('\n💡 To create test users, run:');
      console.log('   npm run seed');
      console.log('   or');
      console.log('   node create-test-user.js');
      return;
    }

    console.log('✅ User found!');
    console.log('   📧 Email:', user.email);
    console.log('   👤 ID:', user.id);
    console.log('   🎭 Role:', user.role);
    console.log('   ✅ Active:', user.isActive ? 'Yes' : 'No');
    
    if (user.platformAdmin) {
      console.log('   👨‍💼 Profile: Platform Admin');
    } else if (user.salonOwner) {
      console.log('   ✂️ Profile: Salon Owner');
    } else if (user.customer) {
      console.log('   👤 Profile: Customer');
    }

    // Check password
    if (password) {
      console.log('\n🔐 Verifying password...');
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (isPasswordValid) {
        console.log('✅ Password is correct!');
      } else {
        console.log('❌ Password is incorrect!');
        console.log('\n💡 Make sure you are using the correct password.');
      }
    } else {
      console.log('\n⚠️ No password provided for verification');
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('\n⚠️ WARNING: User account is deactivated!');
      console.log('   This will prevent login even with correct credentials.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and password from command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email) {
  console.log('Usage: node verify-user.js <email> [password]');
  console.log('\nExample:');
  console.log('  node verify-user.js owner@salon.com owner123');
  process.exit(1);
}

verifyUser(email, password);

