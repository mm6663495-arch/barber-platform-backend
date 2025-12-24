import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { securityLogger } from '../../config/logger.config';

/**
 * Advanced Rate Limiting Guard
 * حماية متقدمة من الطلبات الكثيرة
 */

interface RateLimitStore {
  count: number;
  resetTime: number;
  blocked?: boolean;
  blockUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitStore>();
const ipBlockList = new Set<string>();

@Injectable()
export class AdvancedRateLimitGuard implements CanActivate {
  // إعدادات افتراضية
  private readonly defaultLimit = 100; // 100 طلب
  private readonly defaultWindow = 60 * 1000; // دقيقة واحدة
  private readonly blockDuration = 15 * 60 * 1000; // 15 دقيقة حظر
  private readonly maxViolations = 3; // عدد مرات التجاوز قبل الحظر

  constructor(private reflector: Reflector) {
    // تنظيف المخزن كل 5 دقائق
    setInterval(() => this.cleanupStore(), 5 * 60 * 1000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // فحص إذا كان الـ IP محظوراً
    if (ipBlockList.has(ip)) {
      securityLogger.warn('Blocked IP attempted access', {
        ip,
        url: request.url,
        method: request.method,
      });

      throw new HttpException(
        'تم حظر الوصول مؤقتاً بسبب كثرة المحاولات. حاول مرة أخرى لاحقاً',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const key = this.generateKey(ip, request);
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // إنشاء سجل جديد
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.defaultWindow,
      };
      rateLimitStore.set(key, record);
      return true;
    }

    // فحص إذا كان محظوراً مؤقتاً
    if (record.blocked && record.blockUntil && now < record.blockUntil) {
      const remainingTime = Math.ceil((record.blockUntil - now) / 1000);
      
      throw new HttpException(
        `تم حظرك مؤقتاً. حاول مرة أخرى بعد ${remainingTime} ثانية`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // إذا انتهى الحظر المؤقت
    if (record.blocked && record.blockUntil && now >= record.blockUntil) {
      record.blocked = false;
      record.blockUntil = undefined;
      record.count = 1;
      record.resetTime = now + this.defaultWindow;
      rateLimitStore.set(key, record);
      return true;
    }

    // زيادة العداد
    record.count++;

    // فحص التجاوز
    if (record.count > this.defaultLimit) {
      // حظر مؤقت
      record.blocked = true;
      record.blockUntil = now + this.blockDuration;

      securityLogger.warn('Rate limit exceeded - Temporary block applied', {
        ip,
        url: request.url,
        method: request.method,
        count: record.count,
        blockUntil: new Date(record.blockUntil).toISOString(),
      });

      // إذا تجاوز عدة مرات، حظر دائم
      const violations = this.getViolationCount(ip);
      if (violations >= this.maxViolations) {
        ipBlockList.add(ip);
        
        securityLogger.error('IP permanently blocked due to repeated violations', {
          ip,
          violations,
        });
      }

      throw new HttpException(
        'تم تجاوز عدد الطلبات المسموح به. تم حظرك مؤقتاً لمدة 15 دقيقة',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    rateLimitStore.set(key, record);
    return true;
  }

  /**
   * الحصول على IP العميل
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * إنشاء مفتاح فريد للتخزين
   */
  private generateKey(ip: string, request: Request): string {
    // دمج IP + Endpoint لحدود مختلفة لكل endpoint
    return `${ip}:${request.method}:${request.path}`;
  }

  /**
   * عدد مرات التجاوز لـ IP معين
   */
  private getViolationCount(ip: string): number {
    let count = 0;
    for (const [key, record] of rateLimitStore.entries()) {
      if (key.startsWith(ip) && record.blocked) {
        count++;
      }
    }
    return count;
  }

  /**
   * تنظيف السجلات القديمة
   */
  private cleanupStore(): void {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime && (!record.blockUntil || now > record.blockUntil)) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * إزالة IP من قائمة الحظر (للـ Admin)
   */
  static unblockIp(ip: string): boolean {
    return ipBlockList.delete(ip);
  }

  /**
   * الحصول على قائمة IPs المحظورة
   */
  static getBlockedIps(): string[] {
    return Array.from(ipBlockList);
  }

  /**
   * الحصول على إحصائيات Rate Limiting
   */
  static getStats() {
    const stats = {
      totalRecords: rateLimitStore.size,
      blockedIps: ipBlockList.size,
      activeBlocks: 0,
    };

    const now = Date.now();
    for (const record of rateLimitStore.values()) {
      if (record.blocked && record.blockUntil && now < record.blockUntil) {
        stats.activeBlocks++;
      }
    }

    return stats;
  }
}

