import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP Exception Filter المحسن
 * معالجة جميع أخطاء HTTP برسائل واضحة بالعربية
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    // استخراج الرسالة
    let message: string | string[];
    let error: string;

    if (typeof exceptionResponse === 'object') {
      message = exceptionResponse.message || exception.message;
      error = exceptionResponse.error || this.getErrorName(status);
    } else {
      message = exceptionResponse;
      error = this.getErrorName(status);
    }

    // ترجمة الرسائل الشائعة
    message = this.translateMessage(message);

    // تسجيل الخطأ
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${JSON.stringify(message)}`,
    );

    // إرسال الاستجابة
    response.status(status).json({
      success: false,
      statusCode: status,
      error: this.translateErrorName(error),
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }

  /**
   * الحصول على اسم الخطأ من الكود
   */
  private getErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    };

    return errorNames[status] || 'Error';
  }

  /**
   * ترجمة اسم الخطأ
   */
  private translateErrorName(error: string): string {
    const translations: Record<string, string> = {
      'Bad Request': 'طلب غير صالح',
      Unauthorized: 'غير مصرح',
      Forbidden: 'ممنوع',
      'Not Found': 'غير موجود',
      Conflict: 'تعارض',
      'Unprocessable Entity': 'لا يمكن معالجة البيانات',
      'Too Many Requests': 'طلبات كثيرة جداً',
      'Internal Server Error': 'خطأ في الخادم',
      'Service Unavailable': 'الخدمة غير متاحة',
    };

    return translations[error] || error;
  }

  /**
   * ترجمة الرسائل الشائعة
   */
  private translateMessage(message: string | string[]): string | string[] {
    if (Array.isArray(message)) {
      return message.map((msg) => this.translateSingleMessage(msg));
    }

    return this.translateSingleMessage(message);
  }

  /**
   * ترجمة رسالة واحدة
   */
  private translateSingleMessage(message: string): string {
    const translations: Record<string, string> = {
      // Authentication & Authorization
      'Unauthorized': 'غير مصرح - يجب تسجيل الدخول',
      'Invalid credentials': 'بيانات الدخول غير صحيحة',
      'Token expired': 'انتهت صلاحية الجلسة',
      'Invalid token': 'رمز الدخول غير صالح',
      'Access denied': 'تم رفض الوصول',
      'Forbidden resource': 'لا يمكنك الوصول لهذا المحتوى',

      // Validation
      'Validation failed': 'فشل التحقق من البيانات',
      'should not be empty': 'لا يجب أن يكون فارغاً',
      'must be a string': 'يجب أن يكون نصاً',
      'must be a number': 'يجب أن يكون رقماً',
      'must be an email': 'يجب أن يكون بريداً إلكترونياً صحيحاً',
      'must be a valid phone number': 'يجب أن يكون رقم هاتف صحيحاً',
      'is too short': 'قصير جداً',
      'is too long': 'طويل جداً',

      // Not Found
      'Not Found': 'غير موجود',
      'User not found': 'المستخدم غير موجود',
      'Salon not found': 'الصالون غير موجود',
      'Package not found': 'الباقة غير موجودة',
      'Subscription not found': 'الاشتراك غير موجود',

      // Conflict
      'Already exists': 'موجود بالفعل',
      'Email already exists': 'البريد الإلكتروني مستخدم بالفعل',
      'Phone already exists': 'رقم الهاتف مستخدم بالفعل',

      // Rate Limiting
      'Too Many Requests': 'طلبات كثيرة جداً - حاول مرة أخرى لاحقاً',

      // Server Errors
      'Internal server error': 'خطأ في الخادم',
      'Service temporarily unavailable': 'الخدمة غير متاحة مؤقتاً',
    };

    // البحث عن ترجمة مطابقة
    for (const [en, ar] of Object.entries(translations)) {
      if (message.includes(en)) {
        return message.replace(en, ar);
      }
    }

    return message;
  }
}
