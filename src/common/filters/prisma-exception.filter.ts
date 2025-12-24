import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Prisma Exception Filter
 * معالجة أخطاء Prisma وتحويلها لرسائل واضحة بالعربية
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'حدث خطأ في قاعدة البيانات';
    let error = 'Database Error';
    let details: any = {};

    // معالجة أخطاء Prisma المعروفة
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaKnownError(exception);
      status = prismaError.status;
      message = prismaError.message;
      error = prismaError.error;
      details = prismaError.details;
    }

    // معالجة أخطاء Validation
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'البيانات المدخلة غير صحيحة';
      error = 'Validation Error';
      details = {
        validationError: this.extractValidationError(exception.message),
      };
    }

    // معالجة أخطاء الاتصال
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'فشل الاتصال بقاعدة البيانات';
      error = 'Database Connection Error';
      details = {
        reason: 'تحقق من إعدادات قاعدة البيانات',
      };
    }

    // معالجة الأخطاء الحرجة
    else if (exception instanceof Prisma.PrismaClientRustPanicError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'خطأ حرج في قاعدة البيانات';
      error = 'Critical Database Error';
    }

    // معالجة الأخطاء غير المعروفة
    else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'خطأ غير متوقع في قاعدة البيانات';
      error = 'Unknown Database Error';
    }

    // إرسال الاستجابة
    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }

  /**
   * معالجة أخطاء Prisma المعروفة حسب الكود
   */
  private handlePrismaKnownError(exception: Prisma.PrismaClientKnownRequestError) {
    const { code, meta } = exception;

    switch (code) {
      // P2000: القيمة طويلة جداً
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `القيمة طويلة جداً للحقل: ${meta?.target || 'غير معروف'}`,
          error: 'Value Too Long',
          details: { field: meta?.target, code },
        };

      // P2001: السجل غير موجود
      case 'P2001':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'السجل المطلوب غير موجود',
          error: 'Record Not Found',
          details: { model: meta?.modelName, code },
        };

      // P2002: قيمة مكررة (Unique constraint)
      case 'P2002':
        const fields = meta?.target as string[];
        const fieldNames = fields
          ? fields.map((f) => this.translateFieldName(f)).join('، ')
          : 'غير معروف';
        return {
          status: HttpStatus.CONFLICT,
          message: `هذا ${fieldNames} مستخدم بالفعل`,
          error: 'Duplicate Entry',
          details: { fields: meta?.target, code },
        };

      // P2003: خطأ في العلاقة (Foreign key constraint)
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'لا يمكن تنفيذ العملية بسبب ارتباطات موجودة',
          error: 'Foreign Key Constraint Failed',
          details: { field: meta?.field_name, code },
        };

      // P2004: خطأ في شرط قاعدة البيانات
      case 'P2004':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'فشل في التحقق من صحة البيانات',
          error: 'Constraint Failed',
          details: { constraint: meta?.constraint, code },
        };

      // P2011: حقل مطلوب فارغ (Null constraint)
      case 'P2011':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `الحقل ${this.translateFieldName(meta?.target as string)} مطلوب`,
          error: 'Null Constraint Violation',
          details: { field: meta?.target, code },
        };

      // P2012: قيمة مفقودة
      case 'P2012':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'قيمة مطلوبة مفقودة',
          error: 'Missing Required Value',
          details: { path: meta?.path, code },
        };

      // P2014: علاقة غير صالحة
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'العلاقة المحددة غير صالحة',
          error: 'Invalid Relation',
          details: { relation: meta?.relation_name, code },
        };

      // P2015: سجل مرتبط غير موجود
      case 'P2015':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'السجل المرتبط غير موجود',
          error: 'Related Record Not Found',
          details: { code },
        };

      // P2025: سجل غير موجود للحذف أو التحديث
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'السجل المطلوب غير موجود',
          error: 'Record Not Found',
          details: { cause: meta?.cause, code },
        };

      // خطأ افتراضي
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'خطأ في قاعدة البيانات',
          error: 'Database Error',
          details: { code, meta },
        };
    }
  }

  /**
   * ترجمة أسماء الحقول من الإنجليزية للعربية
   */
  private translateFieldName(fieldName: string | string[]): string {
    if (Array.isArray(fieldName)) {
      return fieldName.map((f) => this.translateFieldName(f)).join('، ');
    }

    const translations: Record<string, string> = {
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      name: 'الاسم',
      username: 'اسم المستخدم',
      password: 'كلمة المرور',
      title: 'العنوان',
      description: 'الوصف',
      address: 'العنوان',
      city: 'المدينة',
      userId: 'المستخدم',
      salonId: 'الصالون',
      packageId: 'الباقة',
      subscriptionId: 'الاشتراك',
    };

    return translations[fieldName] || fieldName;
  }

  /**
   * استخراج رسالة خطأ من Validation Error
   */
  private extractValidationError(errorMessage: string): string {
    // محاولة استخراج الحقل المفقود
    const missingFieldMatch = errorMessage.match(/Argument `(\w+)` is missing/);
    if (missingFieldMatch) {
      return `الحقل "${this.translateFieldName(missingFieldMatch[1])}" مطلوب`;
    }

    // محاولة استخراج نوع البيانات الخاطئ
    const typeMatch = errorMessage.match(/Expected (\w+), provided (\w+)/);
    if (typeMatch) {
      return `نوع البيانات غير صحيح: متوقع ${typeMatch[1]} لكن تم إرسال ${typeMatch[2]}`;
    }

    return 'البيانات المدخلة غير صحيحة';
  }
}

