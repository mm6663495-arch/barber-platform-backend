const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testChangePassword() {
  try {
    console.log('🔍 Testing password change functionality...\n');
    
    // Find a test user
    const testEmail = 'owner@salon.com';
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (!user) {
      console.log('❌ Test user not found:', testEmail);
      console.log('💡 Please create a test user first');
      return;
    }

    console.log('✅ Test user found:');
    console.log('   📧 Email:', user.email);
    console.log('   👤 ID:', user.id);
    console.log('   🔐 Current password hash:', user.password.substring(0, 20) + '...');
    console.log('');

    // Test old password
    const oldPassword = 'owner123';
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    console.log('🔐 Testing old password (owner123):', isOldPasswordValid ? '✅ Valid' : '❌ Invalid');
    console.log('');

    // Create new password
    const newPassword = 'newpassword123';
    console.log('🔄 Creating new password hash...');
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    console.log('   New hash:', newPasswordHash.substring(0, 20) + '...');
    console.log('');

    // Update password in database
    console.log('💾 Updating password in database...');
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { password: newPasswordHash },
    });

    if (!updatedUser) {
      console.error('❌ Failed to update password');
      return;
    }

    console.log('✅ Password updated in database');
    console.log('   New password hash:', updatedUser.password.substring(0, 20) + '...');
    console.log('');

    // Verify new password works
    console.log('🔐 Verifying new password works...');
    const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser.password);
    console.log('   New password (newpassword123):', isNewPasswordValid ? '✅ Valid' : '❌ Invalid');
    console.log('');

    // Verify old password no longer works
    console.log('🔐 Verifying old password no longer works...');
    const isOldPasswordStillValid = await bcrypt.compare(oldPassword, updatedUser.password);
    console.log('   Old password (owner123):', isOldPasswordStillValid ? '❌ Still works (ERROR!)' : '✅ No longer works (Correct!)');
    console.log('');

    if (isNewPasswordValid && !isOldPasswordStillValid) {
      console.log('✅✅✅ Password change test PASSED!');
      console.log('');
      console.log('📝 Summary:');
      console.log('   - Old password no longer works ✅');
      console.log('   - New password works ✅');
      console.log('   - Database update successful ✅');
    } else {
      console.error('❌❌❌ Password change test FAILED!');
      console.error('   Something went wrong with the password update');
    }

    // Reset to original password for testing
    console.log('');
    console.log('🔄 Resetting to original password for future tests...');
    const originalPasswordHash = await bcrypt.hash(oldPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: originalPasswordHash },
    });
    console.log('✅ Password reset to original');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testChangePassword();

