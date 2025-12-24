import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { apiLogger, securityLogger } from '../../config/logger.config';
import { captureException, startTransaction } from '../../config/sentry.config';

/**
 * Enhanced Logging Interceptor
 * تسجيل متقدم لجميع الطلبات مع تتبع الأداء
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;

    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();

    // بدء Transaction للـ Performance Tracking (Sentry)
    // Note: Sentry v7+ uses different transaction API
    let transaction: any = null;
    try {
      transaction = startTransaction(`${method} ${url}`, 'http.server');
    } catch (e) {
      // Sentry might not be configured
    }

    // تسجيل بداية الطلب
    this.logger.log(`→ ${method} ${url} - IP: ${ip}`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          // تسجيل النجاح
          apiLogger.info('API Request', {
            method,
            url,
            statusCode,
            responseTime: `${responseTime}ms`,
            ip,
            userAgent,
            userId: (request as any).user?.id || null,
          });

          this.logger.log(
            `← ${method} ${url} ${statusCode} - ${responseTime}ms`,
          );

          // إنهاء Transaction
          if (transaction) {
            transaction.setHttpStatus(statusCode);
            transaction.finish();
          }

          // تسجيل الطلبات البطيئة
          if (responseTime > 1000) {
            securityLogger.warn('Slow API Request', {
              method,
              url,
              responseTime: `${responseTime}ms`,
              statusCode,
            });
          }
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;

          // تسجيل الخطأ
          apiLogger.error('API Request Failed', {
            method,
            url,
            statusCode,
            responseTime: `${responseTime}ms`,
            ip,
            userAgent,
            error: error.message,
            stack: error.stack,
            userId: (request as any).user?.id || null,
          });

          this.logger.error(
            `← ${method} ${url} ${statusCode} - ${responseTime}ms - ERROR: ${error.message}`,
          );

          // إرسال للـ Sentry (الأخطاء الحرجة فقط)
          if (statusCode >= 500) {
            captureException(error, {
              method,
              url,
              ip,
              userId: (request as any).user?.id,
            });
          }

          // إنهاء Transaction
          if (transaction) {
            transaction.setHttpStatus(statusCode);
            transaction.finish();
          }

          // تسجيل محاولات الوصول غير المصرح
          if (statusCode === 401 || statusCode === 403) {
            securityLogger.warn('Unauthorized Access Attempt', {
              method,
              url,
              ip,
              userAgent,
              statusCode,
            });
          }
        },
      }),
    );
  }
}
