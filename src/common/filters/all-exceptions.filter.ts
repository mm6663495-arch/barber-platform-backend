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
 * Global Exception Filter - معالجة جميع الأخطاء الغير معالجة
 * يتم استخدامه كـ fallback إذا لم تتم معالجة الخطأ بواسطة filters أخرى
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'حدث خطأ غير متوقع';
    let error = 'Internal Server Error';

    // معالجة HTTP Exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = exceptionResponse.message || exception.message;
        error = exceptionResponse.error || 'خطأ';
      } else {
        message = exceptionResponse;
        error = exception.name;
      }
    }
    // معالجة Error Objects
    else if (exception instanceof Error) {
      message = exception.message || 'خطأ في الخادم';
      error = exception.name;

      // تسجيل Stack Trace للأخطاء الحرجة
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
    }
    // معالجة الأخطاء غير المعروفة
    else {
      this.logger.error('Unknown Exception:', exception);
    }

    // تسجيل التفاصيل
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
      // في الإنتاج: لا نرسل stack trace للأمان
      ...(process.env.NODE_ENV === 'development' &&
        exception instanceof Error && {
          stack: exception.stack,
        }),
    });
  }

  /**
   * ترجمة أسماء الأخطاء الشائعة
   */
  private translateErrorName(error: string): string {
    const translations: Record<string, string> = {
      'Internal Server Error': 'خطأ في الخادم',
      'Bad Request': 'طلب غير صالح',
      Unauthorized: 'غير مصرح',
      Forbidden: 'ممنوع',
      'Not Found': 'غير موجود',
      Conflict: 'تعارض',
      'Validation Error': 'خطأ في البيانات المدخلة',
      'Database Error': 'خطأ في قاعدة البيانات',
    };

    return translations[error] || error;
  }
}
