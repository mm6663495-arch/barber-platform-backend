import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * Enhanced Validation Pipe
 * معالجة وتحسين رسائل الـ Validation بالعربية
 */
@Injectable()
export class EnhancedValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype, type }: ArgumentMetadata) {
    // ⚠️ تجاهل multipart/form-data (file uploads) - Multer يتعامل معها
    if (type === 'custom' || value instanceof Object) {
      // التحقق من أن value يحتوي على Express.Multer.File (file upload)
      if (value && typeof value === 'object') {
        // إذا كان value هو ملف من Multer أو يحتوي على ملفات، نتخطى Validation
        if (
          value.fieldname ||
          value.originalname ||
          value.buffer ||
          (value.files && Array.isArray(value.files))
        ) {
          return value;
        }
      }
    }

    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'فشل التحقق من البيانات',
        errors: this.formatErrors(errors),
      });
    }

    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * تنسيق رسائل الخطأ بالعربية
   */
  private formatErrors(errors: ValidationError[]): any[] {
    return errors.map((error) => {
      const constraints = error.constraints || {};
      const messages = Object.values(constraints).map((msg) =>
        this.translateValidationMessage(msg, error.property),
      );

      return {
        field: this.translateFieldName(error.property),
        fieldName: error.property,
        messages,
        value: error.value,
      };
    });
  }

  /**
   * ترجمة رسائل الـ Validation
   */
  private translateValidationMessage(
    message: string,
    field: string,
  ): string {
    const fieldAr = this.translateFieldName(field);

    // IsNotEmpty
    if (message.includes('should not be empty')) {
      return `${fieldAr} مطلوب ولا يمكن أن يكون فارغاً`;
    }

    // IsString
    if (message.includes('must be a string')) {
      return `${fieldAr} يجب أن يكون نصاً`;
    }

    // IsNumber
    if (message.includes('must be a number')) {
      return `${fieldAr} يجب أن يكون رقماً`;
    }

    // IsInt
    if (message.includes('must be an integer')) {
      return `${fieldAr} يجب أن يكون رقماً صحيحاً`;
    }

    // IsEmail
    if (message.includes('must be an email')) {
      return `${fieldAr} يجب أن يكون بريداً إلكترونياً صحيحاً`;
    }

    // IsPhoneNumber
    if (message.includes('must be a valid phone number')) {
      return `${fieldAr} يجب أن يكون رقم هاتف صحيحاً`;
    }

    // MinLength
    const minLengthMatch = message.match(/must be longer than or equal to (\d+) characters/);
    if (minLengthMatch) {
      return `${fieldAr} يجب أن يكون ${minLengthMatch[1]} أحرف على الأقل`;
    }

    // MaxLength
    const maxLengthMatch = message.match(/must be shorter than or equal to (\d+) characters/);
    if (maxLengthMatch) {
      return `${fieldAr} يجب ألا يتجاوز ${maxLengthMatch[1]} حرفاً`;
    }

    // Min
    const minMatch = message.match(/must not be less than (\d+)/);
    if (minMatch) {
      return `${fieldAr} يجب ألا يقل عن ${minMatch[1]}`;
    }

    // Max
    const maxMatch = message.match(/must not be greater than (\d+)/);
    if (maxMatch) {
      return `${fieldAr} يجب ألا يزيد عن ${maxMatch[1]}`;
    }

    // IsEnum
    if (message.includes('must be one of the following values')) {
      return `${fieldAr} يجب أن يكون من القيم المسموحة`;
    }

    // IsBoolean
    if (message.includes('must be a boolean')) {
      return `${fieldAr} يجب أن يكون true أو false`;
    }

    // IsDate
    if (message.includes('must be a Date')) {
      return `${fieldAr} يجب أن يكون تاريخاً صحيحاً`;
    }

    // IsArray
    if (message.includes('must be an array')) {
      return `${fieldAr} يجب أن يكون قائمة`;
    }

    // IsUrl
    if (message.includes('must be a URL')) {
      return `${fieldAr} يجب أن يكون رابطاً صحيحاً`;
    }

    // Matches (regex)
    if (message.includes('must match')) {
      return `${fieldAr} لا يتطابق مع الصيغة المطلوبة`;
    }

    // IsPositive
    if (message.includes('must be a positive number')) {
      return `${fieldAr} يجب أن يكون رقماً موجباً`;
    }

    // IsNegative
    if (message.includes('must be a negative number')) {
      return `${fieldAr} يجب أن يكون رقماً سالباً`;
    }

    // Default: return original message
    return message;
  }

  /**
   * ترجمة أسماء الحقول
   */
  private translateFieldName(field: string): string {
    const translations: Record<string, string> = {
      // User fields
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      password: 'كلمة المرور',
      name: 'الاسم',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      username: 'اسم المستخدم',
      role: 'الدور',

      // Salon fields
      title: 'عنوان الصالون',
      description: 'وصف الصالون',
      address: 'العنوان',
      city: 'المدينة',
      location: 'الموقع',
      image: 'الصورة',
      rating: 'التقييم',

      // Package fields
      price: 'السعر',
      visitCount: 'عدد الزيارات',
      validityDays: 'مدة الصلاحية',
      type: 'النوع',

      // Subscription fields
      startDate: 'تاريخ البداية',
      endDate: 'تاريخ الانتهاء',
      status: 'الحالة',
      remainingVisits: 'الزيارات المتبقية',

      // Review fields
      comment: 'التعليق',
      response: 'الرد',

      // Payment fields
      amount: 'المبلغ',
      method: 'طريقة الدفع',
      transactionId: 'رقم العملية',

      // Common fields
      id: 'المعرف',
      userId: 'المستخدم',
      salonId: 'الصالون',
      packageId: 'الباقة',
      subscriptionId: 'الاشتراك',
      createdAt: 'تاريخ الإنشاء',
      updatedAt: 'تاريخ التحديث',
    };

    return translations[field] || field;
  }
}
