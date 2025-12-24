/**
 * Script للتحقق من subscription وإصلاحه
 * Usage: node scripts/check_subscription.js <subscriptionId>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubscription(subscriptionId) {
  try {
    console.log(`\n🔍 Checking subscription ID: ${subscriptionId}\n`);

    // البحث عن subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) },
      include: {
        package: {
          include: {
            salon: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!subscription) {
      console.log('❌ Subscription not found!');
      console.log('\n💡 Solution: Create a subscription first');
      return;
    }

    console.log('✅ Subscription found!');
    console.log('\n📋 Details:');
    console.log(`   ID: ${subscription.id}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   QR Code: ${subscription.qrCode}`);
    console.log(`   Visits Remaining: ${subscription.visitsRemaining}`);
    console.log(`   Visits Used: ${subscription.visitsUsed}`);
    console.log(`   Customer: ${subscription.customer?.fullName} (ID: ${subscription.customerId})`);
    console.log(`   Package: ${subscription.package?.name} (ID: ${subscription.packageId})`);
    console.log(`   Salon: ${subscription.package?.salon?.name} (ID: ${subscription.package?.salonId})`);
    console.log(`   Owner ID: ${subscription.package?.salon?.ownerId}`);

    // التحقق من المشاكل
    const issues = [];

    if (subscription.status !== 'ACTIVE') {
      issues.push(`Status is ${subscription.status}, should be ACTIVE`);
    }

    if (subscription.visitsRemaining <= 0) {
      issues.push(`No visits remaining (${subscription.visitsRemaining})`);
    }

    if (!subscription.qrCode) {
      issues.push('QR code is missing');
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Issues found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });

      console.log('\n🔧 Fixing issues...');
      
      // إصلاح المشاكل
      const updateData = {};
      
      if (subscription.status !== 'ACTIVE') {
        updateData.status = 'ACTIVE';
        console.log('   ✅ Setting status to ACTIVE');
      }
      
      if (subscription.visitsRemaining <= 0) {
        updateData.visitsRemaining = subscription.package?.visitsCount || 10;
        updateData.visitsUsed = 0;
        console.log(`   ✅ Setting visits remaining to ${updateData.visitsRemaining}`);
      }
      
      if (!subscription.qrCode) {
        const { v4: uuidv4 } = require('uuid');
        updateData.qrCode = uuidv4();
        console.log(`   ✅ Generating QR code: ${updateData.qrCode}`);
      }

      if (Object.keys(updateData).length > 0) {
        const updated = await prisma.subscription.update({
          where: { id: subscription.id },
          data: updateData,
        });
        console.log('\n✅ Subscription fixed!');
        console.log(`   New status: ${updated.status}`);
        console.log(`   Visits remaining: ${updated.visitsRemaining}`);
        console.log(`   QR code: ${updated.qrCode}`);
      }
    } else {
      console.log('\n✅ No issues found! Subscription is ready to use.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get subscription ID from command line
const subscriptionId = process.argv[2];

if (!subscriptionId) {
  console.log('Usage: node scripts/check_subscription.js <subscriptionId>');
  console.log('Example: node scripts/check_subscription.js 38');
  process.exit(1);
}

checkSubscription(subscriptionId);

