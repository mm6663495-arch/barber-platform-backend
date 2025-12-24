import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { logger } from '../config/logger.config';

/**
 * Cache Service
 * خدمة متقدمة لإدارة الـ Cache
 */
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * الحصول على قيمة من الـ Cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
      } else {
        logger.debug(`Cache MISS: ${key}`);
      }
      return value || null;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * حفظ قيمة في الـ Cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'})`);
    } catch (error) {
      logger.error(`Cache SET error for key ${key}: ${error.message}`);
    }
  }

  /**
   * حذف قيمة من الـ Cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}: ${error.message}`);
    }
  }

  /**
   * حذف عدة مفاتيح بنمط معين
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // Note: This requires Redis SCAN command
      // For now, we'll log it
      logger.debug(`Cache DEL Pattern: ${pattern}`);
      // Implementation depends on cache-manager-redis-yet capabilities
    } catch (error) {
      logger.error(`Cache DEL Pattern error for ${pattern}: ${error.message}`);
    }
  }

  /**
   * مسح الـ Cache بالكامل
   */
  async reset(): Promise<void> {
    try {
      // Note: cache-manager v5+ doesn't have reset()
      // You would need to implement this with Redis FLUSHDB command
      logger.warn('Cache RESET: Method not available in cache-manager v5+');
      // Alternative: delete specific keys or use store.reset() if available
    } catch (error) {
      logger.error(`Cache RESET error: ${error.message}`);
    }
  }

  /**
   * Cache wrapper - يحاول الحصول من Cache أو ينفذ الدالة
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fn();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      logger.error(`Cache WRAP error for key ${key}: ${error.message}`);
      // If cache fails, just execute the function
      return await fn();
    }
  }

  // ==========================================
  // Cache Keys Generators
  // ==========================================

  /**
   * مفتاح Cache للصالونات
   */
  salonKey(id: number): string {
    return `salon:${id}`;
  }

  /**
   * مفتاح Cache لجميع الصالونات
   */
  salonsListKey(page: number = 1, limit: number = 10): string {
    return `salons:list:${page}:${limit}`;
  }

  /**
   * مفتاح Cache للصالونات الشائعة
   */
  popularSalonsKey(): string {
    return 'salons:popular';
  }

  /**
   * مفتاح Cache للباقات
   */
  packageKey(id: number): string {
    return `package:${id}`;
  }

  /**
   * مفتاح Cache لباقات صالون
   */
  salonPackagesKey(salonId: number): string {
    return `salon:${salonId}:packages`;
  }

  /**
   * مفتاح Cache للإحصائيات
   */
  statsKey(type: string): string {
    return `stats:${type}`;
  }

  /**
   * مفتاح Cache للمستخدم
   */
  userKey(id: number): string {
    return `user:${id}`;
  }

  /**
   * مفتاح Cache لإحصائيات لوحة التحكم
   */
  dashboardStatsKey(): string {
    return 'dashboard:stats';
  }

  // ==========================================
  // Cache Invalidation Helpers
  // ==========================================

  /**
   * إلغاء Cache الصالونات
   */
  async invalidateSalonCache(salonId?: number): Promise<void> {
    if (salonId) {
      await this.del(this.salonKey(salonId));
      await this.del(this.salonPackagesKey(salonId));
    }
    
    // Clear lists
    await this.del(this.popularSalonsKey());
    
    // Note: In production, you'd want to clear all paginated lists
    // This would require scanning keys with pattern 'salons:list:*'
  }

  /**
   * إلغاء Cache الباقات
   */
  async invalidatePackageCache(packageId: number, salonId?: number): Promise<void> {
    await this.del(this.packageKey(packageId));
    
    if (salonId) {
      await this.del(this.salonPackagesKey(salonId));
    }
  }

  /**
   * إلغاء Cache الإحصائيات
   */
  async invalidateStatsCache(): Promise<void> {
    await this.del(this.dashboardStatsKey());
    await this.del(this.statsKey('users'));
    await this.del(this.statsKey('salons'));
    await this.del(this.statsKey('subscriptions'));
    await this.del(this.statsKey('payments'));
  }

  /**
   * إلغاء Cache المستخدم
   */
  async invalidateUserCache(userId: number): Promise<void> {
    await this.del(this.userKey(userId));
  }
}

