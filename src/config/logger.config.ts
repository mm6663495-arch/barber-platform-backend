import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { format } from 'winston';

/**
 * Winston Logger Configuration
 * تكوين نظام تسجيل متقدم مع تدوير الملفات
 */

// تنسيق مخصص للرسائل
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json(),
  format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]`;
    
    if (context) {
      msg += ` [${context}]`;
    }
    
    msg += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    if (trace) {
      msg += `\n${trace}`;
    }
    
    return msg;
  }),
);

// تكوين تدوير الملفات - جميع السجلات
const allLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // حفظ لمدة 14 يوم
  format: customFormat,
});

// تكوين تدوير الملفات - الأخطاء فقط
const errorLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // حفظ الأخطاء لمدة 30 يوم
  level: 'error',
  format: customFormat,
});

// تكوين تدوير الملفات - API Requests
const apiLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: 'logs/api-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d', // حفظ لمدة 7 أيام
  format: customFormat,
});

// تكوين تدوير الملفات - Security Events
const securityLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: 'logs/security-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '90d', // حفظ سجلات الأمان لمدة 90 يوم
  format: customFormat,
});

// إنشاء Logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console للـ Development
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          ({ timestamp, level, message, context }) =>
            `${timestamp} [${level}] ${context ? `[${context}] ` : ''}${message}`,
        ),
      ),
    }),
    // ملفات الـ Logs
    allLogsTransport,
    errorLogsTransport,
    apiLogsTransport,
    securityLogsTransport,
  ],
  // في الإنتاج: عدم الخروج عند حدوث خطأ
  exitOnError: false,
});

// Logger للـ API Requests
export const apiLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [apiLogsTransport],
});

// Logger للأمان
export const securityLogger = winston.createLogger({
  level: 'warn',
  format: customFormat,
  transports: [securityLogsTransport, errorLogsTransport],
});

// إضافة stream للاستخدام مع Morgan (اختياري)
export const stream = {
  write: (message: string) => {
    apiLogger.info(message.trim());
  },
};

// Helper function لـ NestJS Logger
export class WinstonLogger {
  log(message: string, context?: string) {
    logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    logger.error(message, { context, trace });
  }

  warn(message: string, context?: string) {
    logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    logger.verbose(message, { context });
  }
}

