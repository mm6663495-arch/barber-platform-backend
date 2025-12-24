import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Test Utilities
 * مجموعة من الدوال المساعدة للاختبارات
 */

/**
 * إنشاء تطبيق اختبار كامل مع جميع الإعدادات
 */
export async function createTestApp(module: any): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [module],
  }).compile();

  const app = moduleFixture.createNestApplication();
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

/**
 * إنشاء مستخدم اختبار
 */
export async function createTestUser(
  prismaService: PrismaService,
  role: UserRole = UserRole.CUSTOMER,
) {
  const timestamp = Date.now();
  const hashedPassword = await bcrypt.hash('Password@123', 10);

  const user = await prismaService.user.create({
    data: {
      email: `test${timestamp}@example.com`,
      password: hashedPassword,
      phone: `05012${timestamp.toString().slice(-5)}`,
      role,
      isActive: true,
    },
  });

  // Create role-specific profile
  if (role === UserRole.CUSTOMER) {
    await prismaService.customer.create({
      data: {
        userId: user.id,
        fullName: 'Test Customer',
      },
    });
  } else if (role === UserRole.SALON_OWNER) {
    await prismaService.salonOwner.create({
      data: {
        userId: user.id,
        fullName: 'Test Owner',
      },
    });
  } else if (role === UserRole.PLATFORM_ADMIN) {
    await prismaService.platformAdmin.create({
      data: {
        userId: user.id,
        fullName: 'Test Admin',
      },
    });
  }

  return user;
}

/**
 * إنشاء صالون اختبار
 */
export async function createTestSalon(
  prismaService: PrismaService,
  ownerId: number,
) {
  return prismaService.salon.create({
    data: {
      ownerId,
      name: `Test Salon ${Date.now()}`,
      description: 'Test Description',
      address: 'Riyadh, Saudi Arabia',
      latitude: 24.7136,
      longitude: 46.6753,
      isActive: true,
      isApproved: true,
      workingHours: {
        saturday: { open: '09:00', close: '21:00' },
      },
      images: [],
    },
  });
}

/**
 * إنشاء باقة اختبار
 */
export async function createTestPackage(
  prismaService: PrismaService,
  salonId: number,
) {
  return prismaService.package.create({
    data: {
      salonId,
      name: `Test Package ${Date.now()}`,
      description: 'Test Package Description',
      price: 299.99,
      duration: 30,
      visits: 10,
      isActive: true,
      isPublished: true,
    },
  });
}

/**
 * تنظيف بيانات الاختبار
 */
export async function cleanupTestData(prismaService: PrismaService) {
  // Delete in correct order to avoid foreign key constraints
  await prismaService.visit.deleteMany();
  await prismaService.subscription.deleteMany();
  await prismaService.review.deleteMany();
  await prismaService.payment.deleteMany();
  await prismaService.notification.deleteMany();
  await prismaService.package.deleteMany();
  await prismaService.salon.deleteMany();
  await prismaService.customer.deleteMany();
  await prismaService.salonOwner.deleteMany();
  await prismaService.platformAdmin.deleteMany();
  await prismaService.auditLog.deleteMany();
  await prismaService.user.deleteMany();
}

/**
 * Mock PrismaService
 */
export const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  salon: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  package: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  notification: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  salonOwner: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  platformAdmin: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  visit: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
};

/**
 * Mock JwtService
 */
export const mockJwtService = {
  sign: jest.fn().mockReturnValue('test-token'),
  verify: jest.fn().mockReturnValue({ sub: 1, email: 'test@example.com' }),
};

/**
 * Mock CacheService
 */
export const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  wrap: jest.fn((key, fn) => fn()),
  invalidateSalonCache: jest.fn(),
  invalidatePackageCache: jest.fn(),
  invalidateAdminCache: jest.fn(),
  salonKey: jest.fn((id) => `salon:${id}`),
  salonsListKey: jest.fn((page, limit) => `salons:list:${page}:${limit}`),
  popularSalonsKey: jest.fn(() => 'salons:popular'),
  salonPackagesKey: jest.fn((id) => `salon:${id}:packages`),
  packageKey: jest.fn((id) => `package:${id}`),
  adminDashboardKey: jest.fn(() => 'admin:dashboard'),
};

/**
 * Mock SecurityService
 */
export const mockSecurityService = {
  logSecurityEvent: jest.fn(),
  detectSuspiciousActivity: jest.fn(),
  lockAccount: jest.fn(),
  unlockAccount: jest.fn(),
  validatePasswordStrength: jest.fn().mockReturnValue(true),
  sanitizeInput: jest.fn((input) => input),
};

/**
 * Mock NotificationsService
 */
export const mockNotificationsService = {
  create: jest.fn(),
  sendEmail: jest.fn(),
  sendPushNotification: jest.fn(),
};

/**
 * انتظار async operation
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random string
 */
export function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

