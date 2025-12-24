import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionStatus, SubscriptionType } from '@prisma/client';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prismaService: PrismaService;
  let notificationsService: NotificationsService;

  const mockSubscription = {
    id: 1,
    customerId: 1,
    packageId: 1,
    salonId: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    type: SubscriptionType.MONTHLY,
    status: SubscriptionStatus.ACTIVE,
    totalVisits: 10,
    usedVisits: 0,
    remainingVisits: 10,
    qrCode: 'QR123',
    price: 299.99,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPackage = {
    id: 1,
    salonId: 1,
    name: 'Premium Package',
    price: 299.99,
    visits: 10,
    duration: 30,
    isActive: true,
    isPublished: true,
  };

  const mockPrismaService = {
    subscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    package: {
      findUnique: jest.fn(),
    },
    visit: {
      create: jest.fn(),
    },
  };

  const mockNotificationsService = {
    sendSubscriptionNotification: jest.fn(),
    sendVisitNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    prismaService = module.get<PrismaService>(PrismaService);
    notificationsService = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new subscription', async () => {
      mockPrismaService.package.findUnique.mockResolvedValue(mockPackage);
      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription);

      const result = await service.create({
        packageId: 1,
        type: SubscriptionType.MONTHLY,
      }, 1);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('qrCode');
      expect(mockPrismaService.subscription.create).toHaveBeenCalled();
      expect(mockNotificationsService.sendSubscriptionNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if package not found', async () => {
      mockPrismaService.package.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          packageId: 999,
          type: SubscriptionType.MONTHLY,
        }, 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if package is inactive', async () => {
      mockPrismaService.package.findUnique.mockResolvedValue({
        ...mockPackage,
        isActive: false,
      });

      await expect(
        service.create({
          packageId: 1,
          type: SubscriptionType.MONTHLY,
        }, 1)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated subscriptions', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([mockSubscription]);
      mockPrismaService.subscription.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 1);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([]);
      mockPrismaService.subscription.count.mockResolvedValue(0);

      await service.findAll(1, 10, { status: SubscriptionStatus.ACTIVE });

      expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a subscription by id', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.findOne(1);

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('useVisit', () => {
    it('should use a visit from subscription', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        usedVisits: 1,
        remainingVisits: 9,
      });
      mockPrismaService.visit.create.mockResolvedValue({
        id: 1,
        subscriptionId: 1,
        usedAt: new Date(),
      });

      const result = await service.useVisit(1);

      expect(result).toHaveProperty('usedVisits', 1);
      expect(result).toHaveProperty('remainingVisits', 9);
      expect(mockPrismaService.visit.create).toHaveBeenCalled();
      expect(mockNotificationsService.sendVisitNotification).toHaveBeenCalled();
    });

    it('should throw BadRequestException if no visits remaining', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        remainingVisits: 0,
      });

      await expect(service.useVisit(1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if subscription expired', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        endDate: new Date(Date.now() - 1000),
      });

      await expect(service.useVisit(1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if subscription not active', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      });

      await expect(service.useVisit(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel subscription', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
      });

      const result = await service.cancel(1);

      expect(result).toHaveProperty('status', SubscriptionStatus.CANCELLED);
      expect(mockPrismaService.subscription.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await expect(service.cancel(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkExpired', () => {
    it('should mark expired subscriptions', async () => {
      const expiredSubscription = {
        ...mockSubscription,
        endDate: new Date(Date.now() - 1000),
        status: SubscriptionStatus.ACTIVE,
      };

      mockPrismaService.subscription.findMany.mockResolvedValue([expiredSubscription]);
      mockPrismaService.subscription.update.mockResolvedValue({
        ...expiredSubscription,
        status: SubscriptionStatus.EXPIRED,
      });

      await service.checkExpired();

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: expiredSubscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    });
  });
});

