import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../cache.service';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from '../decorators/cache-key.decorator';

/**
 * HTTP Cache Interceptor
 * تطبيق Caching تلقائي على Endpoints
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private cacheService: CacheService,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    const cacheTTL = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );

    // إذا لم يكن هناك cache key، تنفيذ عادي
    if (!cacheKey) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    
    // إنشاء مفتاح فريد بناءً على المعاملات
    const fullKey = this.generateCacheKey(cacheKey, request);

    // محاولة الحصول من Cache
    const cachedResponse = await this.cacheService.get(fullKey);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    // تنفيذ الطلب وحفظ النتيجة
    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheService.set(fullKey, response, cacheTTL);
      }),
    );
  }

  /**
   * إنشاء مفتاح Cache فريد
   */
  private generateCacheKey(baseKey: string, request: any): string {
    const { query, params, user } = request;
    
    const parts = [baseKey];

    // إضافة query parameters
    if (query && Object.keys(query).length > 0) {
      const queryString = JSON.stringify(query);
      parts.push(queryString);
    }

    // إضافة route parameters
    if (params && Object.keys(params).length > 0) {
      const paramsString = JSON.stringify(params);
      parts.push(paramsString);
    }

    // إضافة user ID للـ user-specific cache
    if (user?.id) {
      parts.push(`user:${user.id}`);
    }

    return parts.join(':');
  }
}

