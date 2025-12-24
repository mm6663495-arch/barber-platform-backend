import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SalonsService } from './salons.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

describe('SalonsService', () => {
  let service: SalonsService;
  let prismaService: PrismaService;
  let cacheService: CacheService;

  const mockSalon = {
    id: 1,
    ownerId: 1,
    name: 'Test Salon',
    description: 'Test Description',
    address: 'Test Address',
    latitude: 24.7136,
    longitude: 46.6753,
    rating: 4.5,
    isActive: true,
    isApproved: true,
    workingHours: {},
    images: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    salon: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    package: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCacheService = {
    wrap: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidateSalonCache: jest.fn(),
    invalidatePackageCache: jest.fn(),
    salonKey: jest.fn((id) => `salon:${id}`),
    salonsListKey: jest.fn((page, limit) => `salons:list:${page}:${limit}`),
    popularSalonsKey: jest.fn(() => 'salons:popular'),
    salonPackagesKey: jest.fn((id) => `salon:${id}:packages`),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalonsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<SalonsService>(SalonsService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new salon', async () => {
      const createDto = {
        name: 'New Salon',
        description: 'New Description',
        address: 'New Address',
        latitude: 24.7136,
        longitude: 46.6753,
      };

      mockPrismaService.salon.create.mockResolvedValue({
        ...mockSalon,
        ...createDto,
      });

      const result = await service.create(createDto, 1);

      expect(result).toHaveProperty('name', createDto.name);
      expect(mockPrismaService.salon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createDto.name,
          ownerId: 1,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return cached salons list', async () => {
      const salons = [mockSalon];
      
      mockCacheService.wrap.mockImplementation((key, fn) => fn());
      mockPrismaService.salon.findMany.mockResolvedValue(salons);
      mockPrismaService.salon.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 1);
      expect(mockCacheService.wrap).toHaveBeenCalled();
    });

    it('should apply search filter', async () => {
      mockCacheService.wrap.mockImplementation((key, fn) => fn());
      mockPrismaService.salon.findMany.mockResolvedValue([]);
      mockPrismaService.salon.count.mockResolvedValue(0);

      await service.findAll(1, 10, { search: 'test' });

      expect(mockPrismaService.salon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a salon by id', async () => {
      mockCacheService.wrap.mockImplementation((key, fn) => fn());
      mockPrismaService.salon.findUnique.mockResolvedValue(mockSalon);

      const result = await service.findOne(1);

      expect(result).toEqual(mockSalon);
      expect(mockPrismaService.salon.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if salon not found', async () => {
      mockCacheService.wrap.mockImplementation((key, fn) => fn());
      mockPrismaService.salon.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a salon', async () => {
      const updateDto = {
        name: 'Updated Salon',
      };

      mockPrismaService.salon.findUnique.mockResolvedValue(mockSalon);
      mockPrismaService.salon.update.mockResolvedValue({
        ...mockSalon,
        ...updateDto,
      });

      const result = await service.update(1, updateDto, 1);

      expect(result).toHaveProperty('name', updateDto.name);
      expect(mockPrismaService.salon.update).toHaveBeenCalled();
      expect(mockCacheService.invalidateSalonCache).toHaveBeenCalledWith(1);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      mockPrismaService.salon.findUnique.mockResolvedValue(mockSalon);

      await expect(service.update(1, { name: 'Test' }, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if salon not found', async () => {
      mockPrismaService.salon.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { name: 'Test' }, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a salon', async () => {
      mockPrismaService.salon.findUnique.mockResolvedValue(mockSalon);
      mockPrismaService.salon.delete.mockResolvedValue(mockSalon);

      await service.remove(1, 1);

      expect(mockPrismaService.salon.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockCacheService.invalidateSalonCache).toHaveBeenCalledWith(1);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      mockPrismaService.salon.findUnique.mockResolvedValue(mockSalon);

      await expect(service.remove(1, 999)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approveSalon', () => {
    it('should approve a salon', async () => {
      mockPrismaService.salon.findUnique.mockResolvedValue(mockSalon);
      mockPrismaService.salon.update.mockResolvedValue({
        ...mockSalon,
        isApproved: true,
      });

      const result = await service.approveSalon(1);

      expect(result).toHaveProperty('isApproved', true);
      expect(mockPrismaService.salon.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isApproved: true },
      });
    });

    it('should throw NotFoundException if salon not found', async () => {
      mockPrismaService.salon.findUnique.mockResolvedValue(null);

      await expect(service.approveSalon(999)).rejects.toThrow(NotFoundException);
    });
  });
});

