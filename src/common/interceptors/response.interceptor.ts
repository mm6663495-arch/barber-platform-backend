import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/response.dto';

/**
 * Response Interceptor
 * interceptor لتوحيد شكل جميع الاستجابات
 * 
 * يمكن تفعيله globally في app.module.ts
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseDto<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // إذا كانت البيانات بالفعل ApiResponseDto، أرجعها كما هي
        if (data instanceof ApiResponseDto) {
          return data;
        }

        // إذا كانت البيانات عادية، غلّفها في ApiResponseDto
        return ApiResponseDto.success(data);
      }),
    );
  }
}

