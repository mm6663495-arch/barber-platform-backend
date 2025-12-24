import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom Validation Decorators
 * مجموعة من الـ Decorators المخصصة للتحقق من البيانات
 */

// ======================================
// Saudi Phone Number Validator
// ======================================
@ValidatorConstraint({ name: 'isSaudiPhone', async: false })
export class IsSaudiPhoneConstraint implements ValidatorConstraintInterface {
  validate(phone: string, args: ValidationArguments) {
    if (!phone) return false;

    // Saudi phone format: +966XXXXXXXXX or 05XXXXXXXX or 5XXXXXXXX
    const saudiPhoneRegex = /^(\+966|966|0)?5[0-9]{8}$/;
    return saudiPhoneRegex.test(phone.replace(/\s/g, ''));
  }

  defaultMessage(args: ValidationArguments) {
    return 'رقم الهاتف يجب أن يكون سعودياً صحيحاً (مثال: 0501234567 أو +966501234567)';
  }
}

export function IsSaudiPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSaudiPhoneConstraint,
    });
  };
}

// ======================================
// Strong Password Validator
// ======================================
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(password: string, args: ValidationArguments) {
    if (!password) return false;

    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  defaultMessage(args: ValidationArguments) {
    return 'كلمة المرور يجب أن تحتوي على: 8 أحرف على الأقل، حرف كبير، حرف صغير، رقم، ورمز خاص (@$!%*?&#)';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

// ======================================
// Arabic Text Validator
// ======================================
@ValidatorConstraint({ name: 'isArabicText', async: false })
export class IsArabicTextConstraint implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    if (!text) return false;

    // Arabic characters, numbers, spaces, and common punctuation
    const arabicRegex = /^[\u0600-\u06FF\u0750-\u077F\s\d\-،.!؟]+$/;
    return arabicRegex.test(text);
  }

  defaultMessage(args: ValidationArguments) {
    return 'النص يجب أن يكون باللغة العربية';
  }
}

export function IsArabicText(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsArabicTextConstraint,
    });
  };
}

// ======================================
// Valid Price Validator (positive, max 2 decimals)
// ======================================
@ValidatorConstraint({ name: 'isValidPrice', async: false })
export class IsValidPriceConstraint implements ValidatorConstraintInterface {
  validate(price: any, args: ValidationArguments) {
    if (price === null || price === undefined) return false;

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) return false;

    // Check max 2 decimal places
    const decimalPlaces = (priceNum.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }

  defaultMessage(args: ValidationArguments) {
    return 'السعر يجب أن يكون رقماً موجباً بحد أقصى منزلتين عشريتين';
  }
}

export function IsValidPrice(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPriceConstraint,
    });
  };
}

// ======================================
// Future Date Validator
// ======================================
@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(date: any, args: ValidationArguments) {
    if (!date) return false;

    const inputDate = new Date(date);
    const now = new Date();

    return inputDate > now;
  }

  defaultMessage(args: ValidationArguments) {
    return 'التاريخ يجب أن يكون في المستقبل';
  }
}

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}

// ======================================
// Past Date Validator
// ======================================
@ValidatorConstraint({ name: 'isPastDate', async: false })
export class IsPastDateConstraint implements ValidatorConstraintInterface {
  validate(date: any, args: ValidationArguments) {
    if (!date) return false;

    const inputDate = new Date(date);
    const now = new Date();

    return inputDate < now;
  }

  defaultMessage(args: ValidationArguments) {
    return 'التاريخ يجب أن يكون في الماضي';
  }
}

export function IsPastDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPastDateConstraint,
    });
  };
}

// ======================================
// Rating Validator (1-5)
// ======================================
@ValidatorConstraint({ name: 'isValidRating', async: false })
export class IsValidRatingConstraint implements ValidatorConstraintInterface {
  validate(rating: any, args: ValidationArguments) {
    const ratingNum = Number(rating);
    return !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5;
  }

  defaultMessage(args: ValidationArguments) {
    return 'التقييم يجب أن يكون بين 1 و 5';
  }
}

export function IsValidRating(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidRatingConstraint,
    });
  };
}

// ======================================
// Valid Coordinates Validator
// ======================================
@ValidatorConstraint({ name: 'isValidCoordinates', async: false })
export class IsValidCoordinatesConstraint
  implements ValidatorConstraintInterface
{
  validate(coords: any, args: ValidationArguments) {
    if (!coords || typeof coords !== 'object') return false;

    const { latitude, longitude } = coords;

    if (
      latitude === undefined ||
      longitude === undefined ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return false;
    }

    // Validate latitude (-90 to 90) and longitude (-180 to 180)
    return (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'الإحداثيات غير صحيحة (latitude: -90 to 90, longitude: -180 to 180)';
  }
}

export function IsValidCoordinates(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCoordinatesConstraint,
    });
  };
}

