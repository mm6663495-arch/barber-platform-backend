import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: any;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    store: {
      keys: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should get value from cache', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      
      mockCacheManager.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(result).toEqual(value);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
    });

    it('should return null if key not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in cache with default TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };

      await service.set(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, 3600);
    });

    it('should set value with custom TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const ttl = 600;

      await service.set(key, value, ttl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });
  });

  describe('del', () => {
    it('should delete key from cache', async () => {
      const key = 'test:key';

      await service.del(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });
  });

  describe('wrap', () => {
    it('should return cached value if exists', async () => {
      const key = 'test:key';
      const cachedValue = { data: 'cached' };
      
      mockCacheManager.get.mockResolvedValue(cachedValue);

      const fn = jest.fn();
      const result = await service.wrap(key, fn);

      expect(result).toEqual(cachedValue);
      expect(fn).not.toHaveBeenCalled();
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
    });

    it('should execute function and cache result if not cached', async () => {
      const key = 'test:key';
      const computedValue = { data: 'computed' };
      
      mockCacheManager.get.mockResolvedValue(null);
      const fn = jest.fn().mockResolvedValue(computedValue);

      const result = await service.wrap(key, fn, 600);

      expect(result).toEqual(computedValue);
      expect(fn).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, computedValue, 600);
    });

    it('should handle function errors', async () => {
      const key = 'test:key';
      const error = new Error('Computation failed');
      
      mockCacheManager.get.mockResolvedValue(null);
      const fn = jest.fn().mockRejectedValue(error);

      await expect(service.wrap(key, fn)).rejects.toThrow('Computation failed');
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('Cache key generators', () => {
    it('should generate salon key', () => {
      expect(service.salonKey(1)).toBe('salon:1');
    });

    it('should generate salons list key', () => {
      expect(service.salonsListKey(1, 10)).toBe('salons:list:1:10');
    });

    it('should generate popular salons key', () => {
      expect(service.popularSalonsKey()).toBe('salons:popular');
    });

    it('should generate salon packages key', () => {
      expect(service.salonPackagesKey(1)).toBe('salon:1:packages');
    });

    it('should generate admin dashboard key', () => {
      expect(service.adminDashboardKey()).toBe('admin:dashboard');
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate salon cache', async () => {
      await service.invalidateSalonCache(1);

      expect(mockCacheManager.del).toHaveBeenCalledWith('salon:1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('salon:1:packages');
    });

    it('should invalidate package cache', async () => {
      await service.invalidatePackageCache(1);

      expect(mockCacheManager.del).toHaveBeenCalledWith('package:1');
    });

    it('should invalidate admin cache', async () => {
      await service.invalidateAdminCache();

      expect(mockCacheManager.del).toHaveBeenCalledWith('admin:dashboard');
    });
  });
});

