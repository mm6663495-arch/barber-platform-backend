const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetUserPassword(email, newPassword) {
  try {
    console.log('🔄 Resetting user password...\n');
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.log('❌ User not found:', normalizedEmail);
      console.log('\n💡 Available users:');
      const allUsers = await prisma.user.findMany({
        select: { email: true, role: true, isActive: true },
      });
      allUsers.forEach(u => {
        console.log(`   📧 ${u.email} (${u.role}) - ${u.isActive ? 'Active' : 'Inactive'}`);
      });
      return;
    }

    console.log('✅ User found:');
    console.log('   📧 Email:', user.email);
    console.log('   👤 ID:', user.id);
    console.log('   🎭 Role:', user.role);
    console.log('   ✅ Active:', user.isActive ? 'Yes' : 'No');
    console.log('');

    // Hash new password
    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('   Hash:', hashedPassword.substring(0, 30) + '...');
    console.log('');

    // Update password
    console.log('💾 Updating password in database...');
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    if (!updatedUser) {
      console.error('❌ Failed to update password');
      return;
    }

    console.log('✅ Password updated successfully!');
    console.log('');

    // Verify new password works
    console.log('🔐 Verifying new password...');
    const isPasswordValid = await bcrypt.compare(newPassword, updatedUser.password);
    
    if (isPasswordValid) {
      console.log('✅ New password verified successfully!');
      console.log('');
      console.log('📝 Login credentials:');
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Password: ${newPassword}`);
      console.log('');
      console.log('✅✅✅ Password reset completed successfully!');
    } else {
      console.error('❌ ERROR: Password verification failed!');
      console.error('   This should never happen - there may be a database issue');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and password from command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: node reset-user-password.js <email> <newPassword>');
  console.log('\nExample:');
  console.log('  node reset-user-password.js xxxx@gmail.com 123456');
  console.log('\n⚠️  WARNING: This will reset the user password!');
  process.exit(1);
}

resetUserPassword(email, newPassword);

