import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Admin User
  console.log('👤 Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@barber.com' },
    update: {},
    create: {
      email: 'admin@barber.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
      platformAdmin: {
        create: {
          fullName: 'System Administrator',
          permissions: {
            users: ['create', 'read', 'update', 'delete'],
            salons: ['create', 'read', 'update', 'delete', 'approve'],
            payments: ['read', 'refund'],
            reports: ['read', 'resolve'],
            system: ['maintenance', 'backup']
          }
        }
      }
    }
  });

  console.log('✅ Admin user created:', admin.email);

  // Create Sample Salon Owner
  console.log('✂️ Creating sample salon owner...');
  const salonOwnerPassword = await bcrypt.hash('owner123', 12);
  
  const salonOwner = await prisma.user.upsert({
    where: { email: 'owner@salon.com' },
    update: {},
    create: {
      email: 'owner@salon.com',
      password: salonOwnerPassword,
      role: UserRole.SALON_OWNER,
      isActive: true,
      salonOwner: {
        create: {
          fullName: 'Ahmed Salon Owner',
          phone: '+966501234567',
          subscriptionType: 'MONTHLY',
          subscriptionStatus: 'ACTIVE',
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }
      }
    },
    include: {
      salonOwner: true
    }
  });

  console.log('✅ Salon owner created:', salonOwner.email);

  // Create Sample Salon
  console.log('🏪 Creating sample salon...');
  const salon = await prisma.salon.create({
    data: {
      ownerId: salonOwner.salonOwner!.id,
      name: 'Elite Barber Shop',
      description: 'Professional barber shop with modern services',
      address: 'King Fahd Road, Riyadh, Saudi Arabia',
      latitude: 24.7136,
      longitude: 46.6753,
      workingHours: {
        monday: { open: '09:00', close: '22:00' },
        tuesday: { open: '09:00', close: '22:00' },
        wednesday: { open: '09:00', close: '22:00' },
        thursday: { open: '09:00', close: '22:00' },
        friday: { open: '14:00', close: '23:00' },
        saturday: { open: '09:00', close: '22:00' },
        sunday: { open: '09:00', close: '22:00' }
      },
      images: [
        'https://example.com/salon1.jpg',
        'https://example.com/salon2.jpg'
      ],
      isActive: true,
      isApproved: true,
    }
  });

  console.log('✅ Salon created:', salon.name);

  // Create Sample Packages
  console.log('📦 Creating sample packages...');
  const packages = await Promise.all([
    prisma.package.create({
      data: {
        salonId: salon.id,
        name: 'Basic Haircut',
        description: 'Simple haircut service',
        price: 50,
        visitsCount: 1,
        validityDays: 30,
        isActive: true,
        isPublished: true,
      }
    }),
    prisma.package.create({
      data: {
        salonId: salon.id,
        name: 'Premium Package',
        description: 'Haircut + Beard trim + Styling',
        price: 120,
        visitsCount: 3,
        validityDays: 60,
        isActive: true,
        isPublished: true,
      }
    }),
    prisma.package.create({
      data: {
        salonId: salon.id,
        name: 'VIP Package',
        description: 'Full service: Haircut + Beard + Styling + Hair wash',
        price: 200,
        visitsCount: 5,
        validityDays: 90,
        isActive: true,
        isPublished: true,
      }
    })
  ]);

  console.log('✅ Packages created:', packages.length);

  // Create Sample Customer
  console.log('👤 Creating sample customer...');
  const customerPassword = await bcrypt.hash('customer123', 12);
  
  const customer = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      email: 'customer@test.com',
      password: customerPassword,
      role: UserRole.CUSTOMER,
      isActive: true,
      customer: {
        create: {
          fullName: 'Mohammed Customer',
          phone: '+966509876543',
          profileImage: 'https://example.com/customer.jpg',
          address: 'Prince Mohammed Bin Abdulaziz Road, Riyadh',
          latitude: 24.7136,
          longitude: 46.6753,
        }
      }
    },
    include: {
      customer: true
    }
  });

  console.log('✅ Customer created:', customer.email);

  // Create Sample Subscription
  console.log('💳 Creating sample subscription...');
  const subscription = await prisma.subscription.create({
    data: {
      customerId: customer.customer!.id,
      packageId: packages[1].id,
      qrCode: 'QR-' + Date.now(),
      visitsRemaining: 3,
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      status: 'ACTIVE',
      autoRenewal: false,
    }
  });

  console.log('✅ Subscription created:', subscription.qrCode);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Sample Accounts:');
  console.log('👑 Admin: admin@barber.com / admin123');
  console.log('✂️ Salon Owner: owner@salon.com / owner123');
  console.log('👤 Customer: customer@test.com / customer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });