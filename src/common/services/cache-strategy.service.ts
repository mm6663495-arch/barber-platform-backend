import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CACHE_CONSTANTS } from '../config/constants';

/**
 * Cache Strategy Service
 * خدمة موحدة لإدارة استراتيجية التخزين المؤقت
 */
@Injectable()
export class CacheStrategyService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Cache-Aside Pattern
   * جلب البيانات من الـ cache أو من قاعدة البيانات
   */
  async cacheAside<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // محاولة جلب من الـ cache
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    // إذا لم يوجد، جلب من قاعدة البيانات
    const data = await fetchFunction();

    // حفظ في الـ cache
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * Write-Through Cache
   * تحديث الـ cache والبيانات معاً
   */
  async writeThrough<T>(
    key: string,
    data: T,
    updateFunction: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // تحديث في قاعدة البيانات
    const updated = await updateFunction();

    // تحديث في الـ cache
    await this.set(key, updated, ttl);

    return updated;
  }

  /**
   * Write-Behind Cache (Async)
   * تحديث الـ cache فوراً والبيانات بشكل غير متزامن
   */
  async writeBehind<T>(
    key: string,
    data: T,
    updateFunction: () => Promise<void>,
    ttl?: number,
  ): Promise<void> {
    // تحديث الـ cache فوراً
    await this.set(key, data, ttl);

    // تحديث البيانات بشكل غير متزامن
    setImmediate(() => updateFunction().catch(console.error));
  }

  /**
   * Cache Invalidation
   * مسح الـ cache للمفتاح المحدد
   */
  async invalidate(key: string): Promise<void> {
    await this.del(key);
  }

  /**
   * Cache Invalidation بنمط Pattern
   * مسح جميع المفاتيح التي تطابق النمط
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // ملاحظة: يعتمد على Redis - للـ in-memory cache يحتاج تنفيذ مختلف
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map(key => this.del(key)));
    }
  }

  /**
   * Multi-Level Cache
   * جلب من عدة مستويات من الـ cache
   */
  async multiLevelGet<T>(
    key: string,
    levels: {
      level1Ttl: number;
      level2Ttl: number;
      fetchFunction: () => Promise<T>;
    },
  ): Promise<T> {
    // Level 1: In-memory cache (سريع جداً)
    const level1Key = `l1:${key}`;
    const level1Data = await this.get<T>(level1Key);
    if (level1Data) return level1Data;

    // Level 2: Redis cache (سريع)
    const level2Key = `l2:${key}`;
    const level2Data = await this.get<T>(level2Key);
    if (level2Data) {
      // حفظ في Level 1 للمرة القادمة
      await this.set(level1Key, level2Data, levels.level1Ttl);
      return level2Data;
    }

    // Level 3: Database (بطيء)
    const data = await levels.fetchFunction();

    // حفظ في جميع المستويات
    await Promise.all([
      this.set(level1Key, data, levels.level1Ttl),
      this.set(level2Key, data, levels.level2Ttl),
    ]);

    return data;
  }

  /**
   * Cache Warming
   * تحميل البيانات المهمة في الـ cache مسبقاً
   */
  async warmCache<T>(
    keys: Array<{ key: string; fetchFunction: () => Promise<T>; ttl?: number }>,
  ): Promise<void> {
    await Promise.all(
      keys.map(async ({ key, fetchFunction, ttl }) => {
        const data = await fetchFunction();
        await this.set(key, data, ttl);
      }),
    );
  }

  /**
   * TTL-based Caching Strategies
   */
  
  // User Profile - 30 minutes
  async cacheUserProfile<T>(userId: number, fetchFunction: () => Promise<T>): Promise<T> {
    return this.cacheAside(
      `user:profile:${userId}`,
      fetchFunction,
      CACHE_CONSTANTS.USER_PROFILE_TTL,
    );
  }

  // Salon List - 10 minutes
  async cacheSalonList<T>(filters: any, fetchFunction: () => Promise<T>): Promise<T> {
    const key = `salon:list:${JSON.stringify(filters)}`;
    return this.cacheAside(key, fetchFunction, CACHE_CONSTANTS.SALON_LIST_TTL);
  }

  // Subscription - 5 minutes
  async cacheSubscription<T>(subscriptionId: number, fetchFunction: () => Promise<T>): Promise<T> {
    return this.cacheAside(
      `subscription:${subscriptionId}`,
      fetchFunction,
      CACHE_CONSTANTS.SUBSCRIPTION_TTL,
    );
  }

  // Statistics - 1 hour
  async cacheStatistics<T>(key: string, fetchFunction: () => Promise<T>): Promise<T> {
    return this.cacheAside(
      `stats:${key}`,
      fetchFunction,
      CACHE_CONSTANTS.DEFAULT_TTL,
    );
  }

  /**
   * Helper Methods
   */

  private async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  private async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  private async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  private async keys(pattern: string): Promise<string[]> {
    // ملاحظة: يعتمد على Redis
    // للـ in-memory cache، قد تحتاج implementation مختلف
    const stores: any = this.cacheManager.stores;
    if (stores && stores[0] && stores[0].keys) {
      return await stores[0].keys(pattern);
    }
    return [];
  }

  /**
   * Cache Statistics
   */
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    // TODO: implement cache statistics tracking
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
    };
  }
}

