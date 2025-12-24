import * as Sentry from '@sentry/node';
import '@sentry/tracing';

/**
 * Sentry Configuration
 * تكوين تتبع الأخطاء والأداء
 */

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  // تفعيل Sentry فقط في الإنتاج أو إذا تم توفير DSN
  if (!dsn || process.env.NODE_ENV === 'development') {
    console.log('Sentry is disabled (Development mode or no DSN provided)');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    
    // تتبع الأداء
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // تكوين Release
    release: process.env.APP_VERSION || 'unknown',
    
    // تصفية البيانات الحساسة
    beforeSend(event, hint) {
      // إزالة معلومات حساسة
      if (event.request) {
        delete event.request.cookies;
        
        // إزالة Authorization header
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }

      // عدم إرسال أخطاء Validation
      if (event.exception?.values?.[0]?.type === 'BadRequestException') {
        return null;
      }

      return event;
    },

    // تجاهل أخطاء معينة
    ignoreErrors: [
      'UnauthorizedException',
      'NotFoundException',
      'BadRequestException',
      'ForbiddenException',
    ],

    // التكامل مع Node.js
    integrations: [
      // Integrations are now automatically enabled in Sentry v7+
    ],
  });

  console.log('✅ Sentry initialized successfully');
}

// Note: Sentry v7+ integrates differently with Express
// Handlers are automatically registered in init()

// تسجيل خطأ يدوياً
export function captureException(error: Error, context?: any) {
  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}

// تسجيل رسالة
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

// إنشاء Transaction للأداء (Sentry v7+ uses startSpan)
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, () => {
    // Transaction logic here
  });
}

export { Sentry };

