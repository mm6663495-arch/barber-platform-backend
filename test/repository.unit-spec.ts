import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { SubscriptionRepository } from '../src/subscriptions/repositories/subscription.repository';
import { SalonRepository } from '../src/salons/repositories/salon.repository';
import { UserRepository } from '../src/users/repositories/user.repository';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Unit Tests للـ Repository Pattern
 */
describe('Repository Pattern Unit Tests', () => {
  let subscriptionRepo: SubscriptionRepository;
  let salonRepo: SalonRepository;
  let userRepo: UserRepository;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRepository,
        SalonRepository,
        UserRepository,
        {
          provide: PrismaService,
          useValue: {
            subscription: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            salon: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    subscriptionRepo = module.get<SubscriptionRepository>(SubscriptionRepository);
    salonRepo = module.get<SalonRepository>(SalonRepository);
    userRepo = module.get<UserRepository>(UserRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  /**
   * SubscriptionRepository Tests
   */
  describe('SubscriptionRepository', () => {
    it('should be defined', () => {
      expect(subscriptionRepo).toBeDefined();
    });

    it('should find subscriptions with pagination', async () => {
      const mockData = [{ id: 1, qrCode: 'test' }];
      const mockCount = 10;

      jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue(mockData as any);
      jest.spyOn(prismaService.subscription, 'count').mockResolvedValue(mockCount);

      const result = await subscriptionRepo.findWithFilters(
        { page: 1, limit: 10, skip: 0, take: 10 },
        { status: SubscriptionStatus.ACTIVE },
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockData);
      expect(result.meta.totalItems).toBe(mockCount);
    });

    it('should find subscription by QR code', async () => {
      const mockSubscription = { id: 1, qrCode: 'test-qr' };

      jest.spyOn(prismaService.subscription, 'findUnique').mockResolvedValue(mockSubscription as any);

      const result = await subscriptionRepo.findByQrCode('test-qr');

      expect(result).toEqual(mockSubscription);
      expect(prismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { qrCode: 'test-qr' },
        include: expect.any(Object),
      });
    });

    it('should get subscription statistics', async () => {
      jest.spyOn(prismaService.subscription, 'count')
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(50)  // active
        .mockResolvedValueOnce(30)  // expired
        .mockResolvedValueOnce(20); // cancelled

      const stats = await subscriptionRepo.getStatistics({ customerId: 1 });

      expect(stats).toEqual({
        total: 100,
        active: 50,
        expired: 30,
        cancelled: 20,
      });
    });
  });

  /**
   * SalonRepository Tests
   */
  describe('SalonRepository', () => {
    it('should be defined', () => {
      expect(salonRepo).toBeDefined();
    });

    it('should find salons with filters and pagination', async () => {
      const mockData = [{ id: 1, name: 'Test Salon' }];
      const mockCount = 5;

      jest.spyOn(prismaService.salon, 'findMany').mockResolvedValue(mockData as any);
      jest.spyOn(prismaService.salon, 'count').mockResolvedValue(mockCount);

      const result = await salonRepo.findWithFilters(
        { page: 1, limit: 10, skip: 0, take: 10 },
        { isActive: true, isApproved: true },
      );

      expect(result.data).toEqual(mockData);
      expect(result.meta.totalItems).toBe(mockCount);
    });

    it('should search salons by text', async () => {
      const mockData = [{ id: 1, name: 'Best Salon' }];
      
      jest.spyOn(prismaService.salon, 'findMany').mockResolvedValue(mockData as any);
      jest.spyOn(prismaService.salon, 'count').mockResolvedValue(1);

      const result = await salonRepo.findWithFilters(
        { page: 1, limit: 10, skip: 0, take: 10 },
        { search: 'Best' },
      );

      expect(result.data).toEqual(mockData);
    });
  });

  /**
   * UserRepository Tests
   */
  describe('UserRepository', () => {
    it('should be defined', () => {
      expect(userRepo).toBeDefined();
    });

    it('should find user by email', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await userRepo.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: expect.any(Object),
      });
    });

    it('should get user statistics', async () => {
      jest.spyOn(prismaService.user, 'count')
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10)  // admins
        .mockResolvedValueOnce(30)  // salon owners
        .mockResolvedValueOnce(60)  // customers
        .mockResolvedValueOnce(90)  // active
        .mockResolvedValueOnce(10)  // inactive
        .mockResolvedValueOnce(80)  // verified
        .mockResolvedValueOnce(20); // 2FA enabled

      const stats = await userRepo.getStatistics();

      expect(stats).toEqual({
        total: 100,
        admins: 10,
        salonOwners: 30,
        customers: 60,
        active: 90,
        inactive: 10,
        verifiedEmails: 80,
        twoFactorEnabled: 20,
      });
    });
  });

  /**
   * Base Repository Methods Tests
   */
  describe('Base Repository Methods', () => {
    it('should implement findById', async () => {
      const mockData = { id: 1 };
      jest.spyOn(prismaService.subscription, 'findUnique').mockResolvedValue(mockData as any);

      const result = await subscriptionRepo.findById(1);

      expect(result).toEqual(mockData);
    });

    it('should implement create', async () => {
      const mockData = { id: 1, qrCode: 'new-qr' };
      jest.spyOn(prismaService.subscription, 'create').mockResolvedValue(mockData as any);

      const result = await subscriptionRepo.create({ qrCode: 'new-qr' });

      expect(result).toEqual(mockData);
    });

    it('should implement update', async () => {
      const mockData = { id: 1, qrCode: 'updated-qr' };
      jest.spyOn(prismaService.subscription, 'update').mockResolvedValue(mockData as any);

      const result = await subscriptionRepo.update(1, { qrCode: 'updated-qr' });

      expect(result).toEqual(mockData);
    });

    it('should implement delete', async () => {
      const mockData = { id: 1 };
      jest.spyOn(prismaService.subscription, 'delete').mockResolvedValue(mockData as any);

      const result = await subscriptionRepo.delete(1);

      expect(result).toEqual(mockData);
    });

    it('should implement count', async () => {
      jest.spyOn(prismaService.subscription, 'count').mockResolvedValue(42);

      const result = await subscriptionRepo.count();

      expect(result).toBe(42);
    });
  });
});

