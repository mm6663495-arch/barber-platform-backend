import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { securityLogger } from '../../config/logger.config';

/**
 * Security Middleware
 * تطبيق إجراءات الأمان على جميع الطلبات
 */

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // تسجيل محاولات الوصول المشبوهة
    this.detectSuspiciousActivity(req);
    
    // إضافة Security Headers
    this.addSecurityHeaders(res);
    
    next();
  }

  /**
   * كشف النشاط المشبوه
   */
  private detectSuspiciousActivity(req: Request) {
    const suspiciousPatterns = [
      /\.\.\//g,           // Path traversal
      /<script>/gi,        // XSS attempts
      /union.*select/gi,   // SQL injection
      /exec\(/gi,          // Code injection
      /eval\(/gi,          // Code injection
    ];

    const url = req.url ? req.url.toLowerCase() : '';
    const body = req.body ? JSON.stringify(req.body).toLowerCase() : '';

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body)) {
        securityLogger.warn('Suspicious activity detected', {
          ip: req.ip,
          url: req.url,
          method: req.method,
          userAgent: req.headers['user-agent'],
          pattern: pattern.toString(),
        });
        break;
      }
    }
  }

  /**
   * إضافة Security Headers
   */
  private addSecurityHeaders(res: Response) {
    // منع Clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // منع MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // تفعيل XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // إزالة معلومات الخادم
    res.removeHeader('X-Powered-By');
    
    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    );
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );
  }
}

/**
 * Helmet Configuration
 * إعدادات Helmet للأمان المتقدم
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false, // لتجنب مشاكل مع Swagger
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * XSS Sanitization Middleware
 * تنظيف المدخلات من XSS
 */
@Injectable()
export class XssSanitizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body) {
      req.body = this.sanitize(req.body);
    }
    
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = this.sanitize(req.query);
      // Clear existing properties and add sanitized ones
      Object.keys(req.query).forEach(key => delete req.query[key]);
      Object.assign(req.query, sanitizedQuery);
    }
    
    if (req.params && typeof req.params === 'object') {
      const sanitizedParams = this.sanitize(req.params);
      // Clear existing properties and add sanitized ones
      Object.keys(req.params).forEach(key => delete req.params[key]);
      Object.assign(req.params, sanitizedParams);
    }
    
    next();
  }

  /**
   * تنظيف البيانات من XSS
   */
  private sanitize(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = this.sanitize(obj[key]);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * تنظيف النص من XSS
   */
  private sanitizeString(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, ''); // إزالة جميع HTML tags
  }
}

