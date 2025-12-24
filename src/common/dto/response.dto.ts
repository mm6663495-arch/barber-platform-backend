import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard API Response
 * الاستجابة القياسية لجميع API endpoints
 */
export class ApiResponseDto<T> {
  @ApiProperty({ description: 'حالة النجاح' })
  success: boolean;

  @ApiProperty({ description: 'رسالة الاستجابة' })
  message?: string;

  @ApiProperty({ description: 'البيانات المرجعة' })
  data?: T;

  @ApiProperty({ description: 'رمز الخطأ (في حالة الفشل)' })
  errorCode?: string;

  @ApiProperty({ description: 'تفاصيل الخطأ' })
  errors?: any[];

  @ApiProperty({ description: 'وقت الاستجابة' })
  timestamp: string;

  constructor(data?: T, message?: string, success: boolean = true) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data?: T, message?: string): ApiResponseDto<T> {
    return new ApiResponseDto(data, message, true);
  }

  static error(message: string, errors?: any[], errorCode?: string): ApiResponseDto<null> {
    const response = new ApiResponseDto(null, message, false);
    response.errors = errors;
    response.errorCode = errorCode;
    return response;
  }
}

/**
 * Success Response Decorator
 * لتوحيد شكل الاستجابات الناجحة
 */
export function SuccessResponse<T>(data?: T, message?: string): ApiResponseDto<T> {
  return ApiResponseDto.success(data, message);
}

/**
 * Error Response Decorator
 * لتوحيد شكل استجابات الأخطاء
 */
export function ErrorResponse(
  message: string,
  errors?: any[],
  errorCode?: string,
): ApiResponseDto<null> {
  return ApiResponseDto.error(message, errors, errorCode);
}

