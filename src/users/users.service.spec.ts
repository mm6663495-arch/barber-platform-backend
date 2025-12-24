import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    phone: '0501234567',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    salonOwner: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser];
      mockPrismaService.user.findMany.mockResolvedValue(users);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(undefined, 1, 10);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('total', 1);
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('limit', 10);
      expect(result.pagination).toHaveProperty('pages', 1);
      expect(result.users).toHaveLength(1);
      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
    });

    it('should apply filters', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(UserRole.CUSTOMER, 1, 10);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: UserRole.CUSTOMER,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          select: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });


  describe('update', () => {
    it('should update user successfully', async () => {
      const updateDto = { phone: '0509999999' };
      
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        ...updateDto,
      });
      mockPrismaService.customer.update.mockResolvedValue({
        id: 1,
        userId: 1,
        fullName: 'Test User',
        phone: '0509999999',
        profileImage: null,
        address: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update(1, updateDto, 1, UserRole.CUSTOMER);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update(999, {}, 999, UserRole.CUSTOMER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await service.deactivate(1, UserRole.ADMIN);

      expect(result).toHaveProperty('isActive', false);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
    });
  });

  describe('activate', () => {
    it('should activate user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isActive: true,
      });

      const result = await service.activate(1, UserRole.ADMIN);

      expect(result).toHaveProperty('isActive', true);
    });
  });

  describe('getStatistics', () => {
    it('should return user statistics', async () => {
      mockPrismaService.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(1)   // totalAdmins
        .mockResolvedValueOnce(5)   // totalSalonOwners
        .mockResolvedValueOnce(10)  // totalCustomers
        .mockResolvedValueOnce(95)  // activeUsers
        .mockResolvedValueOnce(5);  // inactiveUsers

      const result = await service.getStatistics();

      expect(result).toHaveProperty('totalUsers', 100);
      expect(result).toHaveProperty('totalAdmins', 1);
      expect(result).toHaveProperty('totalSalonOwners', 5);
      expect(result).toHaveProperty('totalCustomers', 10);
      expect(result).toHaveProperty('activeUsers', 95);
      expect(result).toHaveProperty('inactiveUsers', 5);
      expect(mockPrismaService.user.count).toHaveBeenCalledTimes(6);
    });
  });
});

